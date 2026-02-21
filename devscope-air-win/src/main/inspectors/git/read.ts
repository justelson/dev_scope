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
    GitHistoryResult,
    GitStatusMap,
    GitFileStatus,
    ProjectGitOverview
} from './types'

/**
 * Get git status for a project
 */
export async function getGitStatus(projectPath: string): Promise<GitStatusMap> {
    try {
        const git = createGit(projectPath)
        const repoContext = await getRepoContext(git, projectPath)
        const stdout = await git.raw(['-c', 'status.relativePaths=true', 'status', '--porcelain=v1', '--ignored', '-z'])

        const statusMap: GitStatusMap = {}
        const entries = stdout.split('\0').filter(Boolean)

        for (let i = 0; i < entries.length; i++) {
            const line = entries[i]
            if (line.length < 3) continue
            const statusPart = line.substring(0, 2)
            const rawPath = line.substring(3)
            let status: GitFileStatus = 'unknown'

            if (statusPart === '??') status = 'untracked'
            else if (statusPart === '!!') status = 'ignored'
            else if (statusPart.includes('R') || statusPart.includes('C')) status = 'renamed'
            else if (statusPart.includes('U')) status = 'modified'
            else if (statusPart.includes('T')) status = 'modified'
            else if (statusPart.includes('A')) status = 'added'
            else if (statusPart.includes('D')) status = 'deleted'
            else if (statusPart.includes('M')) status = 'modified'

            const normalizedPath = stripPathPrefix(normalizeGitPath(rawPath), repoContext.projectRelativeToRepo)
            if (!normalizedPath) continue
            statusMap[normalizedPath] = status
            statusMap[normalizedPath.replace(/\//g, '\\')] = status

            if (status === 'renamed') {
                const previousPath = entries[i + 1]
                if (previousPath) {
                    const normalizedPrevious = stripPathPrefix(
                        normalizeGitPath(previousPath),
                        repoContext.projectRelativeToRepo
                    )
                    if (!normalizedPrevious) {
                        i += 1
                        continue
                    }
                    statusMap[normalizedPrevious] = 'renamed'
                    statusMap[normalizedPrevious.replace(/\//g, '\\')] = 'renamed'
                    i += 1
                }
            }
        }

        return statusMap
    } catch {
        return {}
    }
}

/**
 * Get git history for a project
 */
export async function getGitHistory(projectPath: string, limit: number = 100): Promise<GitHistoryResult> {
    try {
        const git = createGit(projectPath)
        const safeLimit = Math.max(1, Math.min(1000, Math.trunc(limit) || 100))
        const stdout = await git.raw([
            'log',
            '--all',
            '--date=iso',
            '--pretty=format:%H%x1f%P%x1f%an%x1f%ad%x1f%s%x1e',
            '-n',
            String(safeLimit)
        ])

        return { commits: parseCommitLog(stdout) }
    } catch {
        return { commits: [] }
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
export async function getWorkingDiff(projectPath: string, filePath?: string): Promise<string> {
    try {
        const git = createGit(projectPath)
        const repoContext = filePath ? await getRepoContext(git, projectPath) : null
        const pathSpec = filePath
            ? ['--', await toPathSpec(git, projectPath, filePath, repoContext ?? undefined)]
            : []
        const staged = await git.raw(['diff', '--cached', ...pathSpec]).catch(() => '')
        const unstaged = await git.raw(['diff', ...pathSpec]).catch(() => '')

        let combined = ''
        if (staged) combined += `${staged}\n`
        if (unstaged) combined += unstaged

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
    } catch {
        return false
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
                '--pretty=format:%H%x1f%P%x1f%an%x1f%ad%x1f%s%x1e'
            ]).catch(() => '')
        } else if (hasRemote && currentBranch !== 'HEAD') {
            stdout = await git.raw([
                'log',
                `origin/${currentBranch}..HEAD`,
                '--date=iso',
                '--pretty=format:%H%x1f%P%x1f%an%x1f%ad%x1f%s%x1e'
            ]).catch(() => '')
        } else {
            stdout = await git.raw([
                'log',
                'HEAD',
                '--date=iso',
                '--pretty=format:%H%x1f%P%x1f%an%x1f%ad%x1f%s%x1e',
                '-n',
                '50'
            ]).catch(() => '')
        }

        if (!stdout.trim()) return []
        return parseCommitLog(stdout)
    } catch {
        return []
    }
}

export async function getGitUser(projectPath: string): Promise<{ name: string; email: string } | null> {
    try {
        const git = createGit(projectPath)
        const config = await git.listConfig().catch(() => ({ all: {} as Record<string, string> }))
        const toSingleValue = (value: string | string[] | undefined): string =>
            (Array.isArray(value) ? value[0] : value) || ''

        const name = toSingleValue(config.all?.['user.name']).trim()
        const email = toSingleValue(config.all?.['user.email']).trim()
        if (!name && !email) return null
        return { name, email }
    } catch {
        return null
    }
}

export async function getRepoOwner(projectPath: string): Promise<string | null> {
    try {
        const git = createGit(projectPath)
        const remotes = await git.getRemotes(true)
        const origin = remotes.find((remote) => remote.name === 'origin')
        const remoteUrl = origin?.refs.fetch || origin?.refs.push || ''
        return parseRepoOwner(remoteUrl)
    } catch {
        return null
    }
}

export async function checkIsGitRepo(projectPath: string): Promise<boolean> {
    try {
        const git = createGit(projectPath)
        return await git.checkIsRepo()
    } catch {
        return false
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
