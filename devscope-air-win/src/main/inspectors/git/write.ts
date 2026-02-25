import log from 'electron-log'
import { writeFile } from 'fs/promises'
import { join } from 'path'
import {
    assertNonEmpty,
    cleanupStaleIndexLock,
    createGit,
    getRepoContext,
    isCheckoutBlockedByLocalChanges,
    isGitIndexLockConflict,
    toError,
    toErrorMessage,
    toPathSpec
} from './core'
import { hasRemoteOrigin } from './read'
import type { CheckoutBranchOptions, CheckoutBranchResult, GitBranchSummary, GitRemoteSummary, GitTagSummary } from './types'

const INDEX_LOCK_MAX_ATTEMPTS = 8
const INDEX_LOCK_RETRY_DELAY_MS = 350

type GitAction<T> = (git: ReturnType<typeof createGit>) => Promise<T>
const repoWriteQueues = new Map<string, Promise<void>>()

function isBranchPathspecNotFound(message: string): boolean {
    return /pathspec .* did not match any file/i.test(message)
        || /did not match any branch/i.test(message)
}

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
}

function getQueueKey(projectPath: string): string {
    const normalized = projectPath.trim()
    return process.platform === 'win32' ? normalized.toLowerCase() : normalized
}

function enqueueRepoWrite<T>(projectPath: string, actionLabel: string, task: () => Promise<T>): Promise<T> {
    const queueKey = getQueueKey(projectPath)
    const previous = repoWriteQueues.get(queueKey) ?? Promise.resolve()

    const run = previous
        .catch(() => undefined)
        .then(async () => {
            log.debug(`[GitQueue] Starting ${actionLabel} in ${projectPath}`)
            return await task()
        })

    const completion = run.then(() => undefined, () => undefined)
    repoWriteQueues.set(queueKey, completion)
    completion.finally(() => {
        if (repoWriteQueues.get(queueKey) === completion) {
            repoWriteQueues.delete(queueKey)
        }
    })

    return run
}

async function withIndexLockRecovery<T>(projectPath: string, actionLabel: string, action: GitAction<T>): Promise<T> {
    return enqueueRepoWrite(projectPath, actionLabel, async () => {
        let lastError: unknown = null

        for (let attempt = 1; attempt <= INDEX_LOCK_MAX_ATTEMPTS; attempt += 1) {
            const git = createGit(projectPath)

            try {
                return await action(git)
            } catch (err) {
                lastError = err
                const message = toErrorMessage(err, `Failed to ${actionLabel}`)
                if (!isGitIndexLockConflict(message)) {
                    throw err
                }

                try {
                    const cleanupResult = await cleanupStaleIndexLock(projectPath)
                    if (cleanupResult === 'removed') {
                        log.warn(`[Git] Removed stale index.lock before retrying ${actionLabel}`)
                    }

                    const hasMoreAttempts = attempt < INDEX_LOCK_MAX_ATTEMPTS
                    if (!hasMoreAttempts) {
                        if (cleanupResult === 'active') {
                            throw new Error(
                                `Git index is locked by another running Git process. Wait for it to finish, then retry ${actionLabel}.`
                            )
                        }
                        break
                    }

                    const delayMs = cleanupResult === 'active'
                        ? INDEX_LOCK_RETRY_DELAY_MS * attempt
                        : 60
                    await sleep(delayMs)
                } catch (lockCleanupErr) {
                    lastError = lockCleanupErr
                    throw lockCleanupErr
                }
            }
        }

        throw toError(lastError, `Failed to ${actionLabel}`)
    })
}

/**
 * Stage files for commit
 */
export async function stageFiles(projectPath: string, files: string[]): Promise<void> {
    try {
        if (files.length === 0) return

        await withIndexLockRecovery(projectPath, 'stage files', async (git) => {
            const repoContext = await getRepoContext(git, projectPath)
            const pathSpecs = Array.from(new Set(
                (await Promise.all(files.map((file) => toPathSpec(git, projectPath, file, repoContext))))
                    .filter((pathSpec) => pathSpec && pathSpec.trim().length > 0)
            ))
            if (pathSpecs.length === 0) return
            await git.add(['-A', '--', ...pathSpecs])
        })
    } catch (err) {
        log.error('Failed to stage files', err)
        throw toError(err, 'Failed to stage files')
    }
}

export async function createCommit(projectPath: string, message: string): Promise<void> {
    try {
        assertNonEmpty(message, 'Commit message')
        await withIndexLockRecovery(projectPath, 'create commit', async (git) => {
            await git.commit(message.trim())
        })
    } catch (err) {
        log.error('Failed to create commit', err)
        throw toError(err, 'Failed to create commit')
    }
}

export async function pushCommits(projectPath: string): Promise<void> {
    try {
        const hasRemote = await hasRemoteOrigin(projectPath)
        if (!hasRemote) {
            throw new Error('No remote "origin" configured')
        }

        await withIndexLockRecovery(projectPath, 'push commits', async (git) => {
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
        })
    } catch (err) {
        log.error('Failed to push commits', err)
        throw toError(err, 'Failed to push commits')
    }
}

export async function initGitRepo(
    projectPath: string,
    branchName: string,
    createGitignore: boolean,
    gitignoreTemplate?: string
): Promise<{ success: boolean; error?: string }> {
    try {
        assertNonEmpty(branchName, 'Branch name')
        await withIndexLockRecovery(projectPath, 'initialize git repository', async (git) => {
            await git.init()
            await git.raw(['check-ref-format', '--branch', branchName.trim()])
            await git.raw(['branch', '-M', branchName.trim()])
        })

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

export async function createInitialCommit(projectPath: string, message: string): Promise<{ success: boolean; error?: string }> {
    try {
        assertNonEmpty(message, 'Commit message')
        await withIndexLockRecovery(projectPath, 'create initial commit', async (git) => {
            await git.add('.')
            await git.commit(message.trim())
        })
        return { success: true }
    } catch (err: any) {
        log.error('Failed to create initial commit', err)
        return { success: false, error: err.message || 'Failed to create initial commit' }
    }
}

export async function addRemoteOrigin(projectPath: string, remoteUrl: string): Promise<{ success: boolean; error?: string }> {
    try {
        assertNonEmpty(remoteUrl, 'Remote URL')
        await withIndexLockRecovery(projectPath, 'add remote origin', async (git) => {
            const remotes = await git.getRemotes()
            if (remotes.some((remote) => remote.name === 'origin')) {
                throw new Error('Remote "origin" already exists')
            }
            await git.addRemote('origin', remoteUrl.trim())
        })
        return { success: true }
    } catch (err: any) {
        log.error('Failed to add remote origin', err)
        return { success: false, error: err.message || 'Failed to add remote origin' }
    }
}

export async function unstageFiles(projectPath: string, files: string[]): Promise<void> {
    try {
        if (files.length === 0) return
        await withIndexLockRecovery(projectPath, 'unstage files', async (git) => {
            const repoContext = await getRepoContext(git, projectPath)
            const pathSpecs = Array.from(new Set(
                (await Promise.all(files.map((file) => toPathSpec(git, projectPath, file, repoContext))))
                    .filter((pathSpec) => pathSpec && pathSpec.trim().length > 0)
            ))
            if (pathSpecs.length === 0) return
            await git.raw(['reset', 'HEAD', '--', ...pathSpecs])
        })
    } catch (err) {
        log.error('Failed to unstage files', err)
        throw toError(err, 'Failed to unstage files')
    }
}

export async function discardChanges(projectPath: string, files: string[]): Promise<void> {
    try {
        if (files.length === 0) return
        await withIndexLockRecovery(projectPath, 'discard changes', async (git) => {
            const repoContext = await getRepoContext(git, projectPath)
            const pathSpecs = Array.from(new Set(
                (await Promise.all(files.map((file) => toPathSpec(git, projectPath, file, repoContext))))
                    .filter((pathSpec) => pathSpec && pathSpec.trim().length > 0)
            ))
            if (pathSpecs.length === 0) return
            await git.raw(['restore', '--staged', '--worktree', '--', ...pathSpecs]).catch(async () => {
                await git.raw(['checkout', '--', ...pathSpecs])
            })
        })
    } catch (err) {
        log.error('Failed to discard changes', err)
        throw toError(err, 'Failed to discard changes')
    }
}

export async function fetchUpdates(projectPath: string, remoteName: string = 'origin'): Promise<void> {
    try {
        await withIndexLockRecovery(projectPath, 'fetch updates', async (git) => {
            await git.fetch(remoteName)
        })
    } catch (err) {
        log.error('Failed to fetch updates', err)
        throw toError(err, 'Failed to fetch updates')
    }
}

export async function pullUpdates(projectPath: string): Promise<void> {
    try {
        await withIndexLockRecovery(projectPath, 'pull updates', async (git) => {
            await git.pull()
        })
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
        const remoteSet = new Set(remote.all.map((name) => name.trim()))

        const localSummaries: GitBranchSummary[] = local.all.map((name) => ({
            name,
            current: local.current === name,
            commit: local.branches[name]?.commit || '',
            label: local.branches[name]?.label || '',
            isRemote: remoteSet.has(`origin/${name}`),
            isLocal: true
        }))

        const localNames = new Set(local.all)
        const remoteOnlySummaries: GitBranchSummary[] = remote.all
            .map((name) => name.trim())
            .filter((name) => name.startsWith('origin/'))
            .filter((name) => !name.startsWith('origin/HEAD'))
            .map((name) => name.replace(/^origin\//, ''))
            .filter((name) => !!name && !localNames.has(name))
            .map((name) => ({
                name,
                current: false,
                commit: '',
                label: 'Remote tracking branch',
                isRemote: true,
                isLocal: false
            }))

        const combined = [...localSummaries, ...remoteOnlySummaries]
        combined.sort((a, b) => {
            if (a.current !== b.current) return a.current ? -1 : 1
            return a.name.localeCompare(b.name)
        })

        return combined
    } catch (err) {
        log.error('Failed to list branches', err)
        throw toError(err, 'Failed to list branches')
    }
}

export async function createBranch(projectPath: string, branchName: string, checkout: boolean = true): Promise<void> {
    try {
        assertNonEmpty(branchName, 'Branch name')
        await withIndexLockRecovery(projectPath, 'create branch', async (git) => {
            await git.raw(['check-ref-format', '--branch', branchName.trim()])
            if (checkout) {
                await git.checkoutLocalBranch(branchName.trim())
            } else {
                await git.branch([branchName.trim()])
            }
        })
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
    return enqueueRepoWrite(projectPath, 'checkout branch', async () => {
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

            if (isBranchPathspecNotFound(message)) {
                const remoteBranch = `origin/${targetBranch}`
                const remoteBranches = await git.branch(['-r']).catch(() => ({ all: [] as string[] }))
                const hasRemoteBranch = remoteBranches.all
                    .map((name) => name.trim())
                    .includes(remoteBranch)

                if (hasRemoteBranch) {
                    await git.checkout(['--track', remoteBranch])
                    return { stashed: false }
                }
            }

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
    })
}

export async function deleteBranch(projectPath: string, branchName: string, force: boolean = false): Promise<void> {
    try {
        assertNonEmpty(branchName, 'Branch name')
        await withIndexLockRecovery(projectPath, 'delete branch', async (git) => {
            await git.deleteLocalBranch(branchName.trim(), force)
        })
    } catch (err) {
        log.error('Failed to delete branch', err)
        throw toError(err, 'Failed to delete branch')
    }
}

export async function listRemotes(projectPath: string): Promise<GitRemoteSummary[]> {
    try {
        const git = createGit(projectPath)
        const remotes = await git.getRemotes(true)
        return remotes.map((remote) => ({
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
        await withIndexLockRecovery(projectPath, 'set remote URL', async (git) => {
            await git.remote(['set-url', remoteName.trim(), remoteUrl.trim()])
        })
    } catch (err) {
        log.error('Failed to set remote URL', err)
        throw toError(err, 'Failed to set remote URL')
    }
}

export async function removeRemote(projectPath: string, remoteName: string): Promise<void> {
    try {
        assertNonEmpty(remoteName, 'Remote name')
        await withIndexLockRecovery(projectPath, 'remove remote', async (git) => {
            await git.removeRemote(remoteName.trim())
        })
    } catch (err) {
        log.error('Failed to remove remote', err)
        throw toError(err, 'Failed to remove remote')
    }
}

export async function listTags(projectPath: string): Promise<GitTagSummary[]> {
    try {
        const git = createGit(projectPath)
        const result = await git.tags()
        return result.all.map((name) => ({ name }))
    } catch (err) {
        log.error('Failed to list tags', err)
        throw toError(err, 'Failed to list tags')
    }
}

export async function createTag(projectPath: string, tagName: string, target?: string): Promise<void> {
    try {
        assertNonEmpty(tagName, 'Tag name')
        await withIndexLockRecovery(projectPath, 'create tag', async (git) => {
            if (target?.trim()) {
                await git.raw(['tag', tagName.trim(), target.trim()])
            } else {
                await git.addTag(tagName.trim())
            }
        })
    } catch (err) {
        log.error('Failed to create tag', err)
        throw toError(err, 'Failed to create tag')
    }
}

export async function deleteTag(projectPath: string, tagName: string): Promise<void> {
    try {
        assertNonEmpty(tagName, 'Tag name')
        await withIndexLockRecovery(projectPath, 'delete tag', async (git) => {
            await git.raw(['tag', '-d', tagName.trim()])
        })
    } catch (err) {
        log.error('Failed to delete tag', err)
        throw toError(err, 'Failed to delete tag')
    }
}

export async function listStashes(projectPath: string): Promise<Array<{ hash: string; message: string }>> {
    try {
        const git = createGit(projectPath)
        const result = await git.stashList()
        return result.all.map((item) => ({ hash: item.hash, message: item.message }))
    } catch (err) {
        log.error('Failed to list stashes', err)
        throw toError(err, 'Failed to list stashes')
    }
}

export async function createStash(projectPath: string, message?: string): Promise<void> {
    try {
        await withIndexLockRecovery(projectPath, 'create stash', async (git) => {
            const args = ['push', '-u']
            if (message?.trim()) {
                args.push('-m', message.trim())
            }
            await git.raw(['stash', ...args])
        })
    } catch (err) {
        log.error('Failed to create stash', err)
        throw toError(err, 'Failed to create stash')
    }
}

export async function applyStash(projectPath: string, stashRef: string = 'stash@{0}', pop: boolean = false): Promise<void> {
    try {
        await withIndexLockRecovery(projectPath, 'apply stash', async (git) => {
            await git.raw(['stash', pop ? 'pop' : 'apply', stashRef])
        })
    } catch (err) {
        log.error('Failed to apply stash', err)
        throw toError(err, 'Failed to apply stash')
    }
}

export async function dropStash(projectPath: string, stashRef: string = 'stash@{0}'): Promise<void> {
    try {
        await withIndexLockRecovery(projectPath, 'drop stash', async (git) => {
            await git.raw(['stash', 'drop', stashRef])
        })
    } catch (err) {
        log.error('Failed to drop stash', err)
        throw toError(err, 'Failed to drop stash')
    }
}
