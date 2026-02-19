import log from 'electron-log'
import { join, relative, isAbsolute } from 'path'
import { writeFile, stat, unlink } from 'fs/promises'
import { simpleGit, type SimpleGit } from 'simple-git'

export type GitFileStatus = 'modified' | 'untracked' | 'added' | 'deleted' | 'renamed' | 'ignored' | 'unknown'

export interface GitStatusMap {
    [relativePath: string]: GitFileStatus
}

export interface ProjectGitOverview {
    path: string
    isGitRepo: boolean
    changedCount: number
    unpushedCount: number
    hasRemote: boolean
    error?: string
}

export interface GitBranchSummary {
    name: string
    current: boolean
    commit: string
    label: string
    isRemote: boolean
}

export interface GitRemoteSummary {
    name: string
    fetchUrl: string
    pushUrl: string
}

export interface GitTagSummary {
    name: string
    commit?: string
}

export interface CheckoutBranchOptions {
    autoStash?: boolean
    autoCleanupLock?: boolean
}

export interface CheckoutBranchResult {
    stashed: boolean
    cleanedLock?: boolean
    stashRef?: string
    stashMessage?: string
}

function createGit(projectPath: string): SimpleGit {
    return simpleGit({
        baseDir: projectPath,
        binary: 'git',
        maxConcurrentProcesses: 6,
        trimmed: false
    })
}

function normalizeGitPath(path: string): string {
    return path.replace(/^"|"$/g, '').replace(/\\/g, '/')
}

function toPathSpec(projectPath: string, filePath: string): string {
    const candidateInput = isAbsolute(filePath) ? relative(projectPath, filePath) : filePath
    const candidate = candidateInput && !candidateInput.startsWith('..') && !candidateInput.includes(':')
        ? candidateInput
        : filePath
    return normalizeGitPath(candidate)
}

function toError(err: unknown, fallback: string): Error {
    if (err instanceof Error && err.message) return new Error(err.message)
    return new Error(fallback)
}

function toErrorMessage(err: unknown, fallback: string): string {
    if (err instanceof Error && err.message) return err.message
    return fallback
}

function countTrackedChanges(statusMap: GitStatusMap): number {
    const changed = new Set<string>()

    for (const [filePath, status] of Object.entries(statusMap)) {
        if (status === 'ignored' || status === 'unknown') continue
        changed.add(normalizeGitPath(filePath))
    }

    return changed.size
}

function parseCommitLog(stdout: string): GitCommit[] {
    const recordSep = '\x1e'
    const fieldSep = '\x1f'
    const commits: GitCommit[] = []
    const records = stdout.split(recordSep).map(r => r.trim()).filter(Boolean)

    for (const record of records) {
        const parts = record.split(fieldSep)
        if (parts.length < 5) continue
        const [hash, parentText, author, date, ...messageParts] = parts
        const message = messageParts.join(fieldSep)
        commits.push({
            hash,
            shortHash: hash.substring(0, 7),
            parents: parentText ? parentText.split(' ').filter(Boolean) : [],
            author,
            date,
            message
        })
    }

    return commits
}

function parseRepoOwner(remoteUrl: string): string | null {
    const trimmed = remoteUrl.trim()
    if (!trimmed) return null

    const sshScpMatch = trimmed.match(/^[^@]+@[^:]+:([^/]+)\/.+$/)
    if (sshScpMatch?.[1]) return sshScpMatch[1]

    try {
        const url = new URL(trimmed)
        const segments = url.pathname.split('/').filter(Boolean)
        return segments[0] || null
    } catch {
        return null
    }
}

function assertNonEmpty(value: string, label: string): void {
    if (!value.trim()) {
        throw new Error(`${label} cannot be empty`)
    }
}

function isCheckoutBlockedByLocalChanges(message: string): boolean {
    return /would be overwritten by (checkout|switch)/i.test(message)
}

function isGitIndexLockConflict(message: string): boolean {
    return /index\.lock': File exists/i.test(message) || /Unable to create .*index\.lock/i.test(message)
}

async function cleanupStaleIndexLock(projectPath: string, staleMs: number = 15_000): Promise<'removed' | 'active' | 'missing'> {
    const lockPath = join(projectPath, '.git', 'index.lock')

    try {
        const lockStat = await stat(lockPath)
        const ageMs = Date.now() - lockStat.mtimeMs

        if (ageMs < staleMs) {
            return 'active'
        }

        await unlink(lockPath)
        return 'removed'
    } catch (err: any) {
        if (err?.code === 'ENOENT') return 'missing'
        throw err
    }
}

/**
 * Get git status for a project
 */
export async function getGitStatus(projectPath: string): Promise<GitStatusMap> {
    try {
        const git = createGit(projectPath)
        const stdout = await git.raw(['status', '--porcelain=v1', '--ignored', '-z'])

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

            const normalizedPath = normalizeGitPath(rawPath)
            statusMap[normalizedPath] = status
            statusMap[normalizedPath.replace(/\//g, '\\')] = status

            // In porcelain v1 -z, rename/copy entries include an extra token with original path.
            if (status === 'renamed') {
                const previousPath = entries[i + 1]
                if (previousPath) {
                    const normalizedPrevious = normalizeGitPath(previousPath)
                    statusMap[normalizedPrevious] = 'renamed'
                    statusMap[normalizedPrevious.replace(/\//g, '\\')] = 'renamed'
                    i += 1
                }
            }
        }

        return statusMap
    } catch {
        // Not a git repo or git not installed
        return {}
    }
}

export interface GitCommit {
    hash: string
    shortHash: string
    parents: string[]
    author: string
    date: string
    message: string
}

export interface GitHistoryResult {
    commits: GitCommit[]
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
            `--pretty=format:%H%x1f%P%x1f%an%x1f%ad%x1f%s%x1e`,
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
        const pathSpec = filePath ? ['--', toPathSpec(projectPath, filePath)] : []
        const staged = await git.raw(['diff', '--cached', ...pathSpec]).catch(() => '')
        const unstaged = await git.raw(['diff', ...pathSpec]).catch(() => '')

        // Combine both diffs
        let combined = ''
        if (staged) combined += staged + '\n'
        if (unstaged) combined += unstaged

        return combined || 'No changes'
    } catch (err) {
        log.error('Failed to get working diff', err)
        throw toError(err, 'Failed to get working diff')
    }
}

/**
 * Check if remote origin exists
 */
export async function hasRemoteOrigin(projectPath: string): Promise<boolean> {
    try {
        const git = createGit(projectPath)
        const remotes = await git.getRemotes(true)
        return remotes.some(remote => remote.name === 'origin' && (remote.refs.fetch || remote.refs.push))
    } catch {
        return false
    }
}

/**
 * Get unpushed commits (commits that exist locally but not on remote)
 * If no remote exists, returns all commits on the current branch
 */
export async function getUnpushedCommits(projectPath: string): Promise<GitCommit[]> {
    try {
        const git = createGit(projectPath)
        // Get current branch
        const currentBranch = (await git.raw(['rev-parse', '--abbrev-ref', 'HEAD'])).trim()

        // Check if remote origin exists
        const hasRemote = await hasRemoteOrigin(projectPath)

        // Check if branch has an upstream configured
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
            // No remote - all commits are considered "unpushed"
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
        // No remote or other error
        return []
    }
}

/**
 * Get git user configuration
 */
export async function getGitUser(projectPath: string): Promise<{ name: string; email: string } | null> {
    try {
        const git = createGit(projectPath)
        const config = await git.listConfig().catch(() => ({ all: {} as Record<string, string> }))
        const name = (config.all?.['user.name'] || '').trim()
        const email = (config.all?.['user.email'] || '').trim()

        if (!name && !email) return null

        return { name, email }
    } catch {
        return null
    }
}

/**
 * Get repository owner/author from remote URL
 */
export async function getRepoOwner(projectPath: string): Promise<string | null> {
    try {
        const git = createGit(projectPath)
        const remotes = await git.getRemotes(true)
        const origin = remotes.find(remote => remote.name === 'origin')
        const remoteUrl = origin?.refs.fetch || origin?.refs.push || ''
        return parseRepoOwner(remoteUrl)
    } catch {
        return null
    }
}

/**
 * Stage files for commit
 */
export async function stageFiles(projectPath: string, files: string[]): Promise<void> {
    try {
        if (files.length === 0) return

        const git = createGit(projectPath)
        const pathSpecs = files.map(file => toPathSpec(projectPath, file))
        // `-A` is required to stage deletions/renames reliably, not just added/modified files.
        await git.add(['-A', '--', ...pathSpecs])
    } catch (err) {
        log.error('Failed to stage files', err)
        throw toError(err, 'Failed to stage files')
    }
}

/**
 * Create a commit
 */
export async function createCommit(projectPath: string, message: string): Promise<void> {
    try {
        assertNonEmpty(message, 'Commit message')
        const git = createGit(projectPath)
        await git.commit(message.trim())
    } catch (err) {
        log.error('Failed to create commit', err)
        throw toError(err, 'Failed to create commit')
    }
}

/**
 * Push commits to remote
 */
export async function pushCommits(projectPath: string): Promise<void> {
    try {
        const git = createGit(projectPath)
        const hasRemote = await hasRemoteOrigin(projectPath)
        if (!hasRemote) {
            throw new Error('No remote "origin" configured')
        }

        const upstreamRef = (await git.raw([
            'rev-parse',
            '--abbrev-ref',
            '--symbolic-full-name',
            '@{u}'
        ]).catch(() => '')).trim()

        if (upstreamRef) {
            await git.push()
            return
        }

        const branch = (await git.raw(['rev-parse', '--abbrev-ref', 'HEAD'])).trim()
        if (!branch || branch === 'HEAD') {
            throw new Error('Cannot push detached HEAD without specifying a branch')
        }

        await git.push(['-u', 'origin', branch])
    } catch (err) {
        log.error('Failed to push commits', err)
        throw toError(err, 'Failed to push commits')
    }
}

/**
 * Check if a directory is a git repository
 */
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
                .filter(path => typeof path === 'string')
                .map(path => path.trim())
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

/**
 * Initialize a git repository
 */
export async function initGitRepo(
    projectPath: string,
    branchName: string,
    createGitignore: boolean,
    gitignoreTemplate?: string
): Promise<{ success: boolean; error?: string }> {
    try {
        assertNonEmpty(branchName, 'Branch name')
        const git = createGit(projectPath)

        await git.init()
        await git.raw(['check-ref-format', '--branch', branchName.trim()])
        await git.raw(['branch', '-M', branchName.trim()])

        // Create .gitignore if requested
        if (createGitignore && gitignoreTemplate) {
            const gitignorePath = join(projectPath, '.gitignore')
            await writeFile(gitignorePath, gitignoreTemplate, 'utf-8')
        }

        return { success: true }
    } catch (err: any) {
        log.error('Failed to initialize git repo', err)
        return { success: false, error: err.message || 'Failed to initialize git repository' }
    }
}

/**
 * Create initial commit
 */
export async function createInitialCommit(projectPath: string, message: string): Promise<{ success: boolean; error?: string }> {
    try {
        assertNonEmpty(message, 'Commit message')
        const git = createGit(projectPath)
        // Stage all files
        await git.add('.')

        // Create commit
        await git.commit(message.trim())

        return { success: true }
    } catch (err: any) {
        log.error('Failed to create initial commit', err)
        return { success: false, error: err.message || 'Failed to create initial commit' }
    }
}

/**
 * Add remote origin
 */
export async function addRemoteOrigin(projectPath: string, remoteUrl: string): Promise<{ success: boolean; error?: string }> {
    try {
        assertNonEmpty(remoteUrl, 'Remote URL')
        const git = createGit(projectPath)
        const remotes = await git.getRemotes()
        if (remotes.some(remote => remote.name === 'origin')) {
            return { success: false, error: 'Remote "origin" already exists' }
        }

        await git.addRemote('origin', remoteUrl.trim())

        return { success: true }
    } catch (err: any) {
        log.error('Failed to add remote origin', err)
        return { success: false, error: err.message || 'Failed to add remote origin' }
    }
}

export async function unstageFiles(projectPath: string, files: string[]): Promise<void> {
    try {
        if (files.length === 0) return
        const git = createGit(projectPath)
        const pathSpecs = files.map(file => toPathSpec(projectPath, file))
        await git.raw(['reset', 'HEAD', '--', ...pathSpecs])
    } catch (err) {
        log.error('Failed to unstage files', err)
        throw toError(err, 'Failed to unstage files')
    }
}

export async function discardChanges(projectPath: string, files: string[]): Promise<void> {
    try {
        if (files.length === 0) return
        const git = createGit(projectPath)
        const pathSpecs = files.map(file => toPathSpec(projectPath, file))
        await git.raw(['restore', '--staged', '--worktree', '--', ...pathSpecs]).catch(async () => {
            await git.raw(['checkout', '--', ...pathSpecs])
        })
    } catch (err) {
        log.error('Failed to discard changes', err)
        throw toError(err, 'Failed to discard changes')
    }
}

export async function fetchUpdates(projectPath: string, remoteName: string = 'origin'): Promise<void> {
    try {
        const git = createGit(projectPath)
        await git.fetch(remoteName)
    } catch (err) {
        log.error('Failed to fetch updates', err)
        throw toError(err, 'Failed to fetch updates')
    }
}

export async function pullUpdates(projectPath: string): Promise<void> {
    try {
        const git = createGit(projectPath)
        await git.pull()
    } catch (err) {
        log.error('Failed to pull updates', err)
        throw toError(err, 'Failed to pull updates')
    }
}

export async function listBranches(projectPath: string): Promise<GitBranchSummary[]> {
    try {
        const git = createGit(projectPath)
        const local = await git.branchLocal()
        const remote = await git.branch(['-r'])
        const remoteSet = new Set(remote.all)

        return local.all.map(name => ({
            name,
            current: local.current === name,
            commit: local.branches[name]?.commit || '',
            label: local.branches[name]?.label || '',
            isRemote: remoteSet.has(`origin/${name}`)
        }))
    } catch (err) {
        log.error('Failed to list branches', err)
        throw toError(err, 'Failed to list branches')
    }
}

export async function createBranch(projectPath: string, branchName: string, checkout: boolean = true): Promise<void> {
    try {
        assertNonEmpty(branchName, 'Branch name')
        const git = createGit(projectPath)
        await git.raw(['check-ref-format', '--branch', branchName.trim()])
        if (checkout) {
            await git.checkoutLocalBranch(branchName.trim())
        } else {
            await git.branch([branchName.trim()])
        }
    } catch (err) {
        log.error('Failed to create branch', err)
        throw toError(err, 'Failed to create branch')
    }
}

export async function checkoutBranch(
    projectPath: string,
    branchName: string,
    options: CheckoutBranchOptions = {}
): Promise<CheckoutBranchResult> {
    assertNonEmpty(branchName, 'Branch name')
    const git = createGit(projectPath)
    const targetBranch = branchName.trim()
    const shouldAutoStash = options.autoStash !== false
    const shouldAutoCleanupLock = options.autoCleanupLock !== false
    let cleanedLock = false

    try {
        await git.checkout(targetBranch)
        return { stashed: false }
    } catch (err) {
        let checkoutError: unknown = err
        let message = toErrorMessage(err, 'Failed to checkout branch')

        if (shouldAutoCleanupLock && isGitIndexLockConflict(message)) {
            try {
                const cleanupResult = await cleanupStaleIndexLock(projectPath)
                if (cleanupResult === 'active') {
                    throw new Error(
                        'Git index is currently locked by another running Git process. Close other Git operations and try again.'
                    )
                }

                if (cleanupResult === 'removed') {
                    cleanedLock = true
                    await git.checkout(targetBranch)
                    return { stashed: false, cleanedLock: true }
                }
            } catch (lockRecoveryErr) {
                checkoutError = lockRecoveryErr
                message = toErrorMessage(lockRecoveryErr, message)
            }
        }

        if (!shouldAutoStash || !isCheckoutBlockedByLocalChanges(message)) {
            log.error('Failed to checkout branch', checkoutError)
            throw toError(checkoutError, 'Failed to checkout branch')
        }

        try {
            const stashMessage = `DevScope auto-stash before switching to ${targetBranch} at ${new Date().toISOString()}`
            const beforeStashCount = (await git.stashList().catch(() => ({ total: 0 }))).total || 0

            await git.raw(['stash', 'push', '-u', '-m', stashMessage])
            await git.checkout(targetBranch)

            const afterStashCount = (await git.stashList().catch(() => ({ total: beforeStashCount }))).total || beforeStashCount
            const stashed = afterStashCount > beforeStashCount

            return {
                stashed,
                cleanedLock: cleanedLock || undefined,
                stashRef: stashed ? 'stash@{0}' : undefined,
                stashMessage: stashed ? stashMessage : undefined
            }
        } catch (autoStashErr) {
            log.error('Failed to checkout branch after auto-stash fallback', autoStashErr)
            throw toError(autoStashErr, `Failed to checkout branch: ${message}`)
        }
    }
}

export async function deleteBranch(projectPath: string, branchName: string, force: boolean = false): Promise<void> {
    try {
        assertNonEmpty(branchName, 'Branch name')
        const git = createGit(projectPath)
        await git.deleteLocalBranch(branchName.trim(), force)
    } catch (err) {
        log.error('Failed to delete branch', err)
        throw toError(err, 'Failed to delete branch')
    }
}

export async function listRemotes(projectPath: string): Promise<GitRemoteSummary[]> {
    try {
        const git = createGit(projectPath)
        const remotes = await git.getRemotes(true)
        return remotes.map(remote => ({
            name: remote.name,
            fetchUrl: remote.refs.fetch,
            pushUrl: remote.refs.push
        }))
    } catch (err) {
        log.error('Failed to list remotes', err)
        throw toError(err, 'Failed to list remotes')
    }
}

export async function setRemoteUrl(projectPath: string, remoteName: string, remoteUrl: string): Promise<void> {
    try {
        assertNonEmpty(remoteName, 'Remote name')
        assertNonEmpty(remoteUrl, 'Remote URL')
        const git = createGit(projectPath)
        await git.remote(['set-url', remoteName.trim(), remoteUrl.trim()])
    } catch (err) {
        log.error('Failed to set remote URL', err)
        throw toError(err, 'Failed to set remote URL')
    }
}

export async function removeRemote(projectPath: string, remoteName: string): Promise<void> {
    try {
        assertNonEmpty(remoteName, 'Remote name')
        const git = createGit(projectPath)
        await git.removeRemote(remoteName.trim())
    } catch (err) {
        log.error('Failed to remove remote', err)
        throw toError(err, 'Failed to remove remote')
    }
}

export async function listTags(projectPath: string): Promise<GitTagSummary[]> {
    try {
        const git = createGit(projectPath)
        const result = await git.tags()
        return result.all.map(name => ({ name }))
    } catch (err) {
        log.error('Failed to list tags', err)
        throw toError(err, 'Failed to list tags')
    }
}

export async function createTag(projectPath: string, tagName: string, target?: string): Promise<void> {
    try {
        assertNonEmpty(tagName, 'Tag name')
        const git = createGit(projectPath)
        if (target?.trim()) {
            await git.raw(['tag', tagName.trim(), target.trim()])
        } else {
            await git.addTag(tagName.trim())
        }
    } catch (err) {
        log.error('Failed to create tag', err)
        throw toError(err, 'Failed to create tag')
    }
}

export async function deleteTag(projectPath: string, tagName: string): Promise<void> {
    try {
        assertNonEmpty(tagName, 'Tag name')
        const git = createGit(projectPath)
        await git.raw(['tag', '-d', tagName.trim()])
    } catch (err) {
        log.error('Failed to delete tag', err)
        throw toError(err, 'Failed to delete tag')
    }
}

export async function listStashes(projectPath: string): Promise<Array<{ hash: string; message: string }>> {
    try {
        const git = createGit(projectPath)
        const result = await git.stashList()
        return result.all.map(item => ({ hash: item.hash, message: item.message }))
    } catch (err) {
        log.error('Failed to list stashes', err)
        throw toError(err, 'Failed to list stashes')
    }
}

export async function createStash(projectPath: string, message?: string): Promise<void> {
    try {
        const git = createGit(projectPath)
        const args = ['push', '-u']
        if (message?.trim()) {
            args.push('-m', message.trim())
        }
        await git.raw(['stash', ...args])
    } catch (err) {
        log.error('Failed to create stash', err)
        throw toError(err, 'Failed to create stash')
    }
}

export async function applyStash(projectPath: string, stashRef: string = 'stash@{0}', pop: boolean = false): Promise<void> {
    try {
        const git = createGit(projectPath)
        await git.raw(['stash', pop ? 'pop' : 'apply', stashRef])
    } catch (err) {
        log.error('Failed to apply stash', err)
        throw toError(err, 'Failed to apply stash')
    }
}

export async function dropStash(projectPath: string, stashRef: string = 'stash@{0}'): Promise<void> {
    try {
        const git = createGit(projectPath)
        await git.raw(['stash', 'drop', stashRef])
    } catch (err) {
        log.error('Failed to drop stash', err)
        throw toError(err, 'Failed to drop stash')
    }
}

/**
 * Get .gitignore templates based on project type
 */
export function getGitignoreTemplates(): string[] {
    return [
        'Node.js',
        'Python',
        'Rust',
        'Go',
        'Java',
        '.NET',
        'Ruby',
        'PHP',
        'C/C++',
        'Dart/Flutter',
        'Elixir',
        'General',
        'Custom'
    ]
}

/**
 * Get available gitignore patterns/tags
 */
export interface GitignorePattern {
    id: string
    label: string
    description: string
    category: 'dependencies' | 'build' | 'environment' | 'ide' | 'os' | 'logs' | 'cache' | 'testing'
    patterns: string[]
}

export function getGitignorePatterns(): GitignorePattern[] {
    return [
        // Dependencies
        {
            id: 'node_modules',
            label: 'node_modules',
            description: 'Node.js dependencies',
            category: 'dependencies',
            patterns: ['node_modules/', 'npm-debug.log*', 'yarn-debug.log*', 'yarn-error.log*', 'pnpm-debug.log*']
        },
        {
            id: 'vendor',
            label: 'vendor',
            description: 'PHP/Ruby dependencies',
            category: 'dependencies',
            patterns: ['vendor/', 'composer.lock']
        },
        {
            id: 'python_venv',
            label: 'Python Virtual Env',
            description: 'Python virtual environments',
            category: 'dependencies',
            patterns: ['venv/', 'env/', 'ENV/', '.venv', '__pycache__/', '*.py[cod]', '*$py.class']
        },
        {
            id: 'rust_target',
            label: 'Rust target',
            description: 'Rust build directory',
            category: 'dependencies',
            patterns: ['target/', 'Cargo.lock']
        },
        {
            id: 'go_vendor',
            label: 'Go vendor',
            description: 'Go dependencies',
            category: 'dependencies',
            patterns: ['vendor/', 'go.work']
        },

        // Build outputs
        {
            id: 'dist',
            label: 'dist',
            description: 'Distribution/build output',
            category: 'build',
            patterns: ['dist/', 'build/', 'out/']
        },
        {
            id: 'next_build',
            label: 'Next.js build',
            description: 'Next.js build files',
            category: 'build',
            patterns: ['.next/', '.nuxt/', '.cache/']
        },
        {
            id: 'compiled',
            label: 'Compiled files',
            description: 'Compiled binaries and objects',
            category: 'build',
            patterns: ['*.exe', '*.dll', '*.so', '*.dylib', '*.o', '*.obj', '*.class', '*.jar', '*.war']
        },
        {
            id: 'dotnet_build',
            label: '.NET build',
            description: '.NET build outputs',
            category: 'build',
            patterns: ['bin/', 'obj/', '*.suo', '*.user']
        },

        // Environment
        {
            id: 'env_files',
            label: '.env files',
            description: 'Environment variables',
            category: 'environment',
            patterns: ['.env', '.env.local', '.env.*.local', '.env.development', '.env.production']
        },
        {
            id: 'secrets',
            label: 'Secrets',
            description: 'Secret keys and credentials',
            category: 'environment',
            patterns: ['*.key', '*.pem', '*.p12', 'secrets.json', 'credentials.json']
        },
        {
            id: 'config_local',
            label: 'Local configs',
            description: 'Local configuration files',
            category: 'environment',
            patterns: ['config.local.*', 'settings.local.*', '*.local.json']
        },

        // IDE
        {
            id: 'vscode',
            label: 'VS Code',
            description: 'Visual Studio Code settings',
            category: 'ide',
            patterns: ['.vscode/']
        },
        {
            id: 'idea',
            label: 'IntelliJ IDEA',
            description: 'JetBrains IDE settings',
            category: 'ide',
            patterns: ['.idea/', '*.iml', '*.iws', '*.ipr']
        },
        {
            id: 'vim',
            label: 'Vim',
            description: 'Vim swap files',
            category: 'ide',
            patterns: ['*.swp', '*.swo', '*~', '.*.swp']
        },
        {
            id: 'sublime',
            label: 'Sublime Text',
            description: 'Sublime Text settings',
            category: 'ide',
            patterns: ['*.sublime-project', '*.sublime-workspace']
        },
        {
            id: 'visual_studio',
            label: 'Visual Studio',
            description: 'Visual Studio files',
            category: 'ide',
            patterns: ['.vs/', '*.suo', '*.user', '*.userosscache', '*.sln.docstates']
        },

        // OS
        {
            id: 'macos',
            label: 'macOS',
            description: 'macOS system files',
            category: 'os',
            patterns: ['.DS_Store', '.AppleDouble', '.LSOverride', '._*']
        },
        {
            id: 'windows',
            label: 'Windows',
            description: 'Windows system files',
            category: 'os',
            patterns: ['Thumbs.db', 'ehthumbs.db', 'Desktop.ini', '$RECYCLE.BIN/']
        },
        {
            id: 'linux',
            label: 'Linux',
            description: 'Linux system files',
            category: 'os',
            patterns: ['*~', '.directory', '.Trash-*']
        },

        // Logs
        {
            id: 'logs',
            label: 'Log files',
            description: 'Application logs',
            category: 'logs',
            patterns: ['*.log', 'logs/', 'log/', '*.log.*']
        },
        {
            id: 'npm_logs',
            label: 'npm logs',
            description: 'npm debug logs',
            category: 'logs',
            patterns: ['npm-debug.log*', 'yarn-debug.log*', 'yarn-error.log*', 'lerna-debug.log*']
        },

        // Cache
        {
            id: 'cache',
            label: 'Cache',
            description: 'Cache directories',
            category: 'cache',
            patterns: ['.cache/', 'cache/', '*.cache', '.parcel-cache/']
        },
        {
            id: 'temp',
            label: 'Temp files',
            description: 'Temporary files',
            category: 'cache',
            patterns: ['tmp/', 'temp/', '*.tmp', '*.temp']
        },

        // Testing
        {
            id: 'coverage',
            label: 'Coverage',
            description: 'Test coverage reports',
            category: 'testing',
            patterns: ['coverage/', '.nyc_output/', '*.lcov', 'htmlcov/']
        },
        {
            id: 'test_output',
            label: 'Test output',
            description: 'Test result files',
            category: 'testing',
            patterns: ['test-results/', 'junit.xml', '*.test', '*.spec.js.snap']
        }
    ]
}

/**
 * Generate .gitignore content based on template
 */
export function generateGitignoreContent(template: string): string {
    const templates: Record<string, string> = {
        'Node.js': `# Dependencies
node_modules/
npm-debug.log*
yarn-debug.log*
yarn-error.log*
pnpm-debug.log*

# Build outputs
dist/
build/
out/
.next/
.nuxt/
.cache/

# Environment
.env
.env.local
.env.*.local

# IDE
.vscode/
.idea/
*.swp
*.swo
*~

# OS
.DS_Store
Thumbs.db`,

        'Python': `# Byte-compiled / optimized / DLL files
__pycache__/
*.py[cod]
*$py.class

# Virtual environments
venv/
env/
ENV/
.venv

# Distribution / packaging
dist/
build/
*.egg-info/

# IDE
.vscode/
.idea/
*.swp

# Environment
.env

# OS
.DS_Store
Thumbs.db`,

        'Rust': `# Build outputs
target/
Cargo.lock

# IDE
.vscode/
.idea/
*.swp

# OS
.DS_Store
Thumbs.db`,

        'Go': `# Binaries
*.exe
*.exe~
*.dll
*.so
*.dylib

# Test binary
*.test

# Output
bin/
dist/

# Go workspace file
go.work

# IDE
.vscode/
.idea/
*.swp

# OS
.DS_Store
Thumbs.db`,

        'Java': `# Compiled class files
*.class

# Package Files
*.jar
*.war
*.nar
*.ear
*.zip
*.tar.gz
*.rar

# Build outputs
target/
build/
out/

# IDE
.vscode/
.idea/
*.iml
*.swp

# OS
.DS_Store
Thumbs.db`,

        '.NET': `# Build outputs
bin/
obj/
out/

# User-specific files
*.suo
*.user
*.userosscache
*.sln.docstates

# IDE
.vscode/
.vs/
*.swp

# OS
.DS_Store
Thumbs.db`,

        'Ruby': `# Gems
*.gem
.bundle/
vendor/bundle/

# IDE
.vscode/
.idea/
*.swp

# OS
.DS_Store
Thumbs.db`,

        'PHP': `# Composer
vendor/
composer.lock

# IDE
.vscode/
.idea/
*.swp

# Environment
.env

# OS
.DS_Store
Thumbs.db`,

        'C/C++': `# Compiled Object files
*.o
*.obj
*.exe
*.out
*.app

# Build directories
build/
cmake-build-*/

# IDE
.vscode/
.idea/
*.swp

# OS
.DS_Store
Thumbs.db`,

        'Dart/Flutter': `# Build outputs
build/
.dart_tool/
.flutter-plugins
.flutter-plugins-dependencies
.packages

# IDE
.vscode/
.idea/
*.swp

# OS
.DS_Store
Thumbs.db`,

        'Elixir': `# Build outputs
_build/
deps/
*.ez

# IDE
.vscode/
.idea/
*.swp

# OS
.DS_Store
Thumbs.db`,

        'General': `# Build outputs
dist/
build/
out/

# Dependencies
node_modules/
vendor/

# Environment
.env
.env.local

# IDE
.vscode/
.idea/
*.swp
*.swo
*~

# OS
.DS_Store
Thumbs.db
*.log`
    }

    return templates[template] || templates['General']
}

/**
 * Generate custom .gitignore content from selected patterns
 */
export function generateCustomGitignoreContent(selectedPatternIds: string[]): string {
    const allPatterns = getGitignorePatterns()
    const selectedPatterns = allPatterns.filter(p => selectedPatternIds.includes(p.id))
    
    // Group by category
    const byCategory: Record<string, GitignorePattern[]> = {}
    selectedPatterns.forEach(pattern => {
        if (!byCategory[pattern.category]) {
            byCategory[pattern.category] = []
        }
        byCategory[pattern.category].push(pattern)
    })
    
    // Generate content
    let content = '# Custom .gitignore\n\n'
    
    const categoryNames: Record<string, string> = {
        'dependencies': 'Dependencies',
        'build': 'Build Outputs',
        'environment': 'Environment & Secrets',
        'ide': 'IDE & Editors',
        'os': 'Operating System',
        'logs': 'Logs',
        'cache': 'Cache & Temp',
        'testing': 'Testing'
    }
    
    Object.entries(byCategory).forEach(([category, patterns]) => {
        content += `# ${categoryNames[category] || category}\n`
        patterns.forEach(pattern => {
            pattern.patterns.forEach(p => {
                content += `${p}\n`
            })
        })
        content += '\n'
    })
    
    return content.trim()
}
