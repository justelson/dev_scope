import log from 'electron-log'
import {
    compactPatchForAI,
    countTrackedChanges,
    createGit,
    getRepoContext,
    normalizeGitPath,
    parseCommitLog,
    parseRepoOwner,
    stripPathPrefix,
    toError,
    toErrorMessage,
    toPathSpec,
    assertNonEmpty
} from './core'
import type {
    GitCommit,
    GitStatusDetail,
    GitHistoryResult,
    GitStatusMap,
    GitFileStatus,
    ProjectGitOverview
} from './types'

function classifyGitStatus(code: string): GitFileStatus {
    if (code === '??') return 'untracked'
    if (code === '!!') return 'ignored'
    if (code.includes('R') || code.includes('C')) return 'renamed'
    if (code.includes('U')) return 'modified'
    if (code.includes('T')) return 'modified'
    if (code.includes('A')) return 'added'
    if (code.includes('D')) return 'deleted'
    if (code.includes('M')) return 'modified'
    return 'unknown'
}

function toStatusDetailMap(details: GitStatusDetail[]): GitStatusMap {
    const statusMap: GitStatusMap = {}
    for (const detail of details) {
        statusMap[detail.path] = detail.status
        statusMap[detail.path.replace(/\//g, '\\')] = detail.status
        if (detail.previousPath) {
            statusMap[detail.previousPath] = 'renamed'
            statusMap[detail.previousPath.replace(/\//g, '\\')] = 'renamed'
        }
    }
    return statusMap
}

function toNumstatPath(pathText: string): string {
    const trimmed = normalizeGitPath(pathText).trim()
    if (!trimmed.includes(' => ')) return trimmed
    const rhs = trimmed.split(' => ').pop() || trimmed
    return rhs.replace(/[{}]/g, '').trim()
}

function parseNumstat(stdout: string, projectRelativeToRepo: string): Map<string, { additions: number; deletions: number }> {
    const result = new Map<string, { additions: number; deletions: number }>()
    for (const rawLine of stdout.split(/\r?\n/)) {
        const line = rawLine.trim()
        if (!line) continue
        const columns = line.split('\t')
        if (columns.length < 3) continue

        const additions = columns[0] === '-' ? 0 : Number.parseInt(columns[0], 10)
        const deletions = columns[1] === '-' ? 0 : Number.parseInt(columns[1], 10)
        const candidatePath = toNumstatPath(columns.slice(2).join('\t'))
        const path = stripPathPrefix(candidatePath, projectRelativeToRepo)
        if (!path) continue

        const prev = result.get(path) || { additions: 0, deletions: 0 }
        result.set(path, {
            additions: prev.additions + (Number.isNaN(additions) ? 0 : additions),
            deletions: prev.deletions + (Number.isNaN(deletions) ? 0 : deletions)
        })
    }
    return result
}

export async function getGitStatusDetailed(projectPath: string): Promise<GitStatusDetail[]> {
    try {
        const git = createGit(projectPath)
        const repoContext = await getRepoContext(git, projectPath)
        const stdout = await git.raw(['-c', 'status.relativePaths=true', 'status', '--porcelain=v1', '--ignored', '-z'])
        const [stagedNumstatRaw, unstagedNumstatRaw] = await Promise.all([
            git.raw(['diff', '--cached', '--numstat']).catch(() => ''),
            git.raw(['diff', '--numstat']).catch(() => '')
        ])

        const stagedNumstat = parseNumstat(stagedNumstatRaw, repoContext.projectRelativeToRepo)
        const unstagedNumstat = parseNumstat(unstagedNumstatRaw, repoContext.projectRelativeToRepo)

        const entries = stdout.split('\0').filter(Boolean)
        const details: GitStatusDetail[] = []

        for (let i = 0; i < entries.length; i += 1) {
            const line = entries[i]
            if (line.length < 3) continue
            const code = line.substring(0, 2)
            const rawPath = line.substring(3)
            const status = classifyGitStatus(code)
            const path = stripPathPrefix(normalizeGitPath(rawPath), repoContext.projectRelativeToRepo)
            if (!path) continue

            const indexCode = code[0] || ' '
            const workTreeCode = code[1] || ' '
            const staged = code !== '??' && code !== '!!' && indexCode !== ' '
            const unstaged = code === '??' || (code !== '!!' && workTreeCode !== ' ')

            let previousPath: string | undefined
            if (status === 'renamed') {
                const rawPrevious = entries[i + 1]
                if (rawPrevious) {
                    previousPath = stripPathPrefix(normalizeGitPath(rawPrevious), repoContext.projectRelativeToRepo) || undefined
                    i += 1
                }
            }

            const stagedStats = stagedNumstat.get(path) || { additions: 0, deletions: 0 }
            const unstagedStats = unstagedNumstat.get(path) || { additions: 0, deletions: 0 }

            details.push({
                path,
                previousPath,
                status,
                code,
                staged,
                unstaged,
                additions: stagedStats.additions + unstagedStats.additions,
                deletions: stagedStats.deletions + unstagedStats.deletions,
                stagedAdditions: stagedStats.additions,
                stagedDeletions: stagedStats.deletions,
                unstagedAdditions: unstagedStats.additions,
                unstagedDeletions: unstagedStats.deletions
            })
        }

        details.sort((a, b) => a.path.localeCompare(b.path))
        return details
    } catch (err) {
        log.error('Failed to get detailed git status', err)
        throw toError(err, 'Failed to get detailed git status')
    }
}

/**
 * Get git status for a project
 */
export async function getGitStatus(projectPath: string): Promise<GitStatusMap> {
    try {
        const details = await getGitStatusDetailed(projectPath)
        return toStatusDetailMap(details)
    } catch (err) {
        log.error('Failed to get git status', err)
        throw toError(err, 'Failed to get git status')
    }
}

/**
 * Get git history for a project
 */
export async function getGitHistory(projectPath: string, limit: number = 0): Promise<GitHistoryResult> {
    try {
        const git = createGit(projectPath)
        const safeLimit = Math.trunc(limit)
        const limitArgs = safeLimit > 0 ? ['-n', String(Math.max(1, Math.min(5000, safeLimit)))] : []
        const stdout = await git.raw([
            'log',
            '--all',
            '--date=iso',
            '--pretty=format:%x1e%H%x1f%P%x1f%an%x1f%ad%x1f%s',
            '--numstat',
            ...limitArgs
        ])

        return { commits: parseCommitLog(stdout) }
    } catch (err) {
        log.error('Failed to get git history', err)
        throw toError(err, 'Failed to get git history')
    }
}

/**
 * Get diff for a specific commit
 */
export async function getCommitDiff(projectPath: string, commitHash: string): Promise<string> {
    try {
        assertNonEmpty(commitHash, 'Commit hash')
        const git = createGit(projectPath)
        return await git.raw(['show', commitHash.trim(), '--format=fuller'])
    } catch (err) {
        log.error('Failed to get commit diff', err)
        throw toError(err, 'Failed to get commit diff')
    }
}

/**
 * Get diff for working changes (unstaged + staged)
 */
export async function getWorkingDiff(
    projectPath: string,
    filePath?: string,
    mode: 'combined' | 'staged' | 'unstaged' = 'combined'
): Promise<string> {
    try {
        const git = createGit(projectPath)
        const repoContext = filePath ? await getRepoContext(git, projectPath) : null
        const pathSpec = filePath
            ? ['--', await toPathSpec(git, projectPath, filePath, repoContext ?? undefined)]
            : []
        const staged = await git.raw(['diff', '--cached', ...pathSpec]).catch(() => '')
        const unstaged = await git.raw(['diff', ...pathSpec]).catch(() => '')

        if (mode === 'staged') {
            return staged || 'No changes'
        }
        if (mode === 'unstaged') {
            return unstaged || 'No changes'
        }

        const combined = [staged, unstaged].filter(Boolean).join('\n')
        return combined || 'No changes'
    } catch (err) {
        log.error('Failed to get working diff', err)
        throw toError(err, 'Failed to get working diff')
    }
}

/**
 * Build richer git context for commit-message AI.
 */
export async function getWorkingChangesForAI(projectPath: string): Promise<string> {
    try {
        const git = createGit(projectPath)
        const [statusShortRaw, stagedStatRaw, unstagedStatRaw, stagedPatchRaw, unstagedPatchRaw] = await Promise.all([
            git.raw(['status', '--short']).catch(() => ''),
            git.raw(['diff', '--cached', '--stat']).catch(() => ''),
            git.raw(['diff', '--stat']).catch(() => ''),
            git.raw(['diff', '--cached', '--unified=2']).catch(() => ''),
            git.raw(['diff', '--unified=2']).catch(() => '')
        ])

        const toText = (value: string | string[]): string => (Array.isArray(value) ? value.join('\n') : value)

        const statusShort = toText(statusShortRaw)
        const stagedStat = toText(stagedStatRaw)
        const unstagedStat = toText(unstagedStatRaw)
        const stagedPatch = toText(stagedPatchRaw)
        const unstagedPatch = toText(unstagedPatchRaw)

        if (!statusShort.trim() && !stagedPatch.trim() && !unstagedPatch.trim()) {
            return 'No changes'
        }

        const stagedPatchCompact = compactPatchForAI(stagedPatch)
        const unstagedPatchCompact = compactPatchForAI(unstagedPatch)

        const sections: string[] = []
        sections.push('## WORKING TREE STATUS (SHORT)')
        sections.push(statusShort.trim() || '(none)')
        sections.push('')
        sections.push('## STAGED CHANGES STAT')
        sections.push(stagedStat.trim() || '(none)')
        sections.push('')
        sections.push('## UNSTAGED CHANGES STAT')
        sections.push(unstagedStat.trim() || '(none)')
        sections.push('')
        sections.push('## STAGED PATCH')
        sections.push(stagedPatchCompact.text || '(none)')
        if (stagedPatchCompact.omittedFiles.length > 0) {
            sections.push('')
            sections.push('### STAGED PATCH OMITTED FILES')
            sections.push(stagedPatchCompact.omittedFiles.slice(0, 30).join('\n'))
            if (stagedPatchCompact.omittedFiles.length > 30) {
                sections.push(`... (${stagedPatchCompact.omittedFiles.length - 30} more omitted files)`)
            }
        }
        sections.push('')
        sections.push('## UNSTAGED PATCH')
        sections.push(unstagedPatchCompact.text || '(none)')
        if (unstagedPatchCompact.omittedFiles.length > 0) {
            sections.push('')
            sections.push('### UNSTAGED PATCH OMITTED FILES')
            sections.push(unstagedPatchCompact.omittedFiles.slice(0, 30).join('\n'))
            if (unstagedPatchCompact.omittedFiles.length > 30) {
                sections.push(`... (${unstagedPatchCompact.omittedFiles.length - 30} more omitted files)`)
            }
        }

        return sections.join('\n')
    } catch (err) {
        log.error('Failed to get working changes context for AI', err)
        throw toError(err, 'Failed to get working changes context')
    }
}

export async function hasRemoteOrigin(projectPath: string): Promise<boolean> {
    try {
        const git = createGit(projectPath)
        const remotes = await git.getRemotes(true)
        return remotes.some((remote) => remote.name === 'origin' && (remote.refs.fetch || remote.refs.push))
    } catch (err) {
        log.error('Failed to inspect remotes', err)
        throw toError(err, 'Failed to inspect remotes')
    }
}

export async function getUnpushedCommits(projectPath: string): Promise<GitCommit[]> {
    try {
        const git = createGit(projectPath)
        const currentBranch = (await git.raw(['rev-parse', '--abbrev-ref', 'HEAD'])).trim()
        const hasRemote = await hasRemoteOrigin(projectPath)
        const upstreamRef = (await git.raw([
            'rev-parse',
            '--abbrev-ref',
            '--symbolic-full-name',
            '@{u}'
        ]).catch(() => '')).trim()

        let stdout = ''
        if (upstreamRef) {
            stdout = await git.raw([
                'log',
                `${upstreamRef}..HEAD`,
                '--date=iso',
                '--pretty=format:%x1e%H%x1f%P%x1f%an%x1f%ad%x1f%s',
                '--numstat'
            ]).catch(() => '')
        } else if (hasRemote && currentBranch !== 'HEAD') {
            stdout = await git.raw([
                'log',
                `origin/${currentBranch}..HEAD`,
                '--date=iso',
                '--pretty=format:%x1e%H%x1f%P%x1f%an%x1f%ad%x1f%s',
                '--numstat'
            ]).catch(() => '')
        } else {
            stdout = await git.raw([
                'log',
                'HEAD',
                '--date=iso',
                '--pretty=format:%x1e%H%x1f%P%x1f%an%x1f%ad%x1f%s',
                '--numstat',
                '-n',
                '50'
            ]).catch(() => '')
        }

        if (!stdout.trim()) return []
        return parseCommitLog(stdout)
    } catch (err) {
        log.error('Failed to get unpushed commits', err)
        throw toError(err, 'Failed to get unpushed commits')
    }
}

export async function getGitUser(projectPath: string): Promise<{ name: string; email: string } | null> {
    try {
        const git = createGit(projectPath)
        const config = await git.listConfig()
        const toSingleValue = (value: string | string[] | undefined): string =>
            (Array.isArray(value) ? value[0] : value) || ''

        const name = toSingleValue(config.all?.['user.name']).trim()
        const email = toSingleValue(config.all?.['user.email']).trim()
        if (!name && !email) return null
        return { name, email }
    } catch (err) {
        log.error('Failed to get git user config', err)
        throw toError(err, 'Failed to get git user config')
    }
}

export async function getRepoOwner(projectPath: string): Promise<string | null> {
    try {
        const git = createGit(projectPath)
        const remotes = await git.getRemotes(true)
        const origin = remotes.find((remote) => remote.name === 'origin')
        const remoteUrl = origin?.refs.fetch || origin?.refs.push || ''
        return parseRepoOwner(remoteUrl)
    } catch (err) {
        log.error('Failed to get repository owner', err)
        throw toError(err, 'Failed to get repository owner')
    }
}

export async function checkIsGitRepo(projectPath: string): Promise<boolean> {
    try {
        const git = createGit(projectPath)
        return await git.checkIsRepo()
    } catch (err) {
        log.error('Failed to detect git repository', err)
        throw toError(err, 'Failed to detect git repository')
    }
}

export async function getProjectGitOverview(projectPath: string): Promise<ProjectGitOverview> {
    try {
        const isGitRepo = await checkIsGitRepo(projectPath)
        if (!isGitRepo) {
            return {
                path: projectPath,
                isGitRepo: false,
                changedCount: 0,
                unpushedCount: 0,
                hasRemote: false
            }
        }

        const [statusMap, unpushedCommits, hasRemote] = await Promise.all([
            getGitStatus(projectPath),
            getUnpushedCommits(projectPath),
            hasRemoteOrigin(projectPath)
        ])

        return {
            path: projectPath,
            isGitRepo: true,
            changedCount: countTrackedChanges(statusMap),
            unpushedCount: unpushedCommits.length,
            hasRemote
        }
    } catch (err) {
        return {
            path: projectPath,
            isGitRepo: false,
            changedCount: 0,
            unpushedCount: 0,
            hasRemote: false,
            error: toErrorMessage(err, 'Failed to inspect repository')
        }
    }
}

export async function getProjectsGitOverview(
    projectPaths: string[],
    maxConcurrent: number = 5
): Promise<ProjectGitOverview[]> {
    const uniquePaths = Array.from(
        new Set(
            projectPaths
                .filter((path) => typeof path === 'string')
                .map((path) => path.trim())
                .filter(Boolean)
        )
    )

    if (uniquePaths.length === 0) return []

    const results: ProjectGitOverview[] = new Array(uniquePaths.length)
    let index = 0
    const workerCount = Math.max(1, Math.min(maxConcurrent, uniquePaths.length))

    await Promise.all(
        Array.from({ length: workerCount }, async () => {
            while (true) {
                const currentIndex = index
                index += 1
                if (currentIndex >= uniquePaths.length) return
                results[currentIndex] = await getProjectGitOverview(uniquePaths[currentIndex])
            }
        })
    )

    return results
}
