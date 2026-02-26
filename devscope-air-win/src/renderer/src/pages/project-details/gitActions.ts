import type { FileTreeNode, GitCommit, GitStatusDetail } from './types'

type RefreshGitOptions = {
    quiet?: boolean
}

interface GitActionParams {
    decodedPath: string
    commitMessage: string
    changedFiles: Array<{ path: string }>
    stagedFiles: Array<{ path: string }>
    unstagedFiles: Array<{ path: string }>
    gitUser: { name: string; email: string } | null
    repoOwner: string | null
    settings: any
    unpushedCommits: GitCommit[]
    targetBranch: string
    currentBranch: string
    branchName: 'main' | 'master' | 'custom'
    customBranchName: string
    createGitignore: boolean
    gitignoreTemplate: string
    selectedPatterns: Set<string>
    createInitialCommit: boolean
    initialCommitMessage: string
    remoteUrl: string
    dontShowAuthorWarning: boolean
    projectPath?: string
    refreshGitData: (refreshFileTree?: boolean, options?: RefreshGitOptions) => Promise<void>
    showToast: (
        message: string,
        actionLabel?: string,
        actionTo?: string,
        tone?: 'success' | 'error' | 'info'
    ) => void
    setSelectedCommit: (commit: GitCommit | null) => void
    setLoadingDiff: (loading: boolean) => void
    setCommitDiff: (diff: string) => void
    setShowAuthorMismatch: (show: boolean) => void
    setIsGeneratingCommitMessage: (loading: boolean) => void
    setCommitMessage: (value: string) => void
    setIsCommitting: (loading: boolean) => void
    setIsPushing: (loading: boolean) => void
    setIsSwitchingBranch: (loading: boolean) => void
    setIsInitializing: (loading: boolean) => void
    setIsGitRepo: (value: boolean) => void
    setInitStep: (step: 'config' | 'remote') => void
    setRemoteUrl: (value: string) => void
    setHasRemote: (value: boolean) => void
    setShowInitModal: (value: boolean) => void
    setIsAddingRemote: (value: boolean) => void
    setGitStatusDetails: (
        value: GitStatusDetail[] | ((prev: GitStatusDetail[]) => GitStatusDetail[])
    ) => void
    setGitStatusMap: (
        value: Record<string, FileTreeNode['gitStatus']> | ((prev: Record<string, FileTreeNode['gitStatus']>) => Record<string, FileTreeNode['gitStatus']>)
    ) => void
}

const PUSH_TRANSIENT_ERROR_PATTERNS: RegExp[] = [
    /\bHTTP\s*408\b/i,
    /\bcurl\s*22\b.*\b408\b/i,
    /\bRPC failed\b/i,
    /\bunexpected disconnect\b/i,
    /\bremote end hung up unexpectedly\b/i,
    /\bsideband packet\b/i,
    /\btimed out\b/i
]

function isTransientPushError(message: string): boolean {
    return PUSH_TRANSIENT_ERROR_PATTERNS.some((pattern) => pattern.test(message))
}

function summarizePushError(rawMessage: string): string {
    const message = String(rawMessage || '').trim()
    const compact = message.replace(/\s+/g, ' ')

    if (/\bHTTP\s*408\b/i.test(message) || /\bcurl\s*22\b.*\b408\b/i.test(message)) {
        return 'Push timed out (HTTP 408). Retry push. If it keeps failing, check network/VPN/proxy or remote status.'
    }

    if (isTransientPushError(message)) {
        return 'Push connection dropped while uploading pack data. Retry push; if it repeats, verify network stability and remote availability.'
    }

    if (/\bAuthentication failed\b/i.test(message) || /\b403\b/.test(message) || /\b401\b/.test(message)) {
        return 'Push was rejected by remote authentication. Re-authenticate Git credentials/token and retry.'
    }

    if (/\bnon-fast-forward\b/i.test(message) || /\brejected\b/i.test(message)) {
        return 'Push rejected (non-fast-forward). Pull/rebase the latest remote changes, then push again.'
    }

    return compact || 'Failed to push commits'
}

function normalizePath(path: string): string {
    return path.replace(/\\/g, '/').trim()
}

function buildStatusMap(details: GitStatusDetail[]): Record<string, FileTreeNode['gitStatus']> {
    const statusMap: Record<string, FileTreeNode['gitStatus']> = {}
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

function toStagedDetail(detail: GitStatusDetail): GitStatusDetail {
    return {
        ...detail,
        status: detail.status === 'untracked' ? 'added' : detail.status,
        staged: true,
        unstaged: false
    }
}

function toUnstagedDetail(detail: GitStatusDetail): GitStatusDetail {
    return {
        ...detail,
        status: detail.status === 'added' ? 'untracked' : detail.status,
        staged: false,
        unstaged: true
    }
}

export function createProjectGitActions(params: GitActionParams) {
    const applyOptimisticDetails = (
        mutate: (prev: GitStatusDetail[]) => GitStatusDetail[]
    ): (() => void) => {
        let snapshot: GitStatusDetail[] = []
        params.setGitStatusDetails((prev) => {
            snapshot = prev
            const next = mutate(prev)
            params.setGitStatusMap(buildStatusMap(next))
            return next
        })

        return () => {
            params.setGitStatusDetails(snapshot)
            params.setGitStatusMap(buildStatusMap(snapshot))
        }
    }

    const performCommit = async () => {
        if (!params.decodedPath || !params.commitMessage.trim()) return

        params.setIsCommitting(true)
        try {
            if (params.stagedFiles.length === 0) {
                throw new Error('No staged files to commit')
            }

            const commitResult = await window.devscope.createCommit(params.decodedPath, params.commitMessage)
            if (!commitResult?.success) {
                throw new Error(commitResult?.error || 'Failed to create commit')
            }

            params.setCommitMessage('')
            await params.refreshGitData(false)
        } catch (err: any) {
            params.showToast(`Failed to commit: ${err.message}`, undefined, undefined, 'error')
        } finally {
            params.setIsCommitting(false)
        }
    }

    const handleCommitClick = async (commit: GitCommit) => {
        if (!params.decodedPath) return

        params.setSelectedCommit(commit)
        params.setLoadingDiff(true)
        params.setCommitDiff('')

        try {
            const result = await window.devscope.getCommitDiff(params.decodedPath, commit.hash)
            if (result.success) {
                params.setCommitDiff(result.diff)
            } else {
                params.setCommitDiff(`Error loading diff: ${result.error}`)
            }
        } catch (err: any) {
            params.setCommitDiff(`Error: ${err.message}`)
        } finally {
            params.setLoadingDiff(false)
        }
    }

    const handleCommit = async () => {
        if (!params.decodedPath || !params.commitMessage.trim() || params.stagedFiles.length === 0) return

        const shouldWarn = localStorage.getItem('dontShowAuthorWarning') !== 'true'
        if (shouldWarn && params.gitUser && params.repoOwner && params.gitUser.name !== params.repoOwner) {
            params.setShowAuthorMismatch(true)
            return
        }

        await performCommit()
    }

    const handleStageFile = async (filePath: string) => {
        if (!params.decodedPath || !filePath.trim()) return
        const normalizedTarget = normalizePath(filePath)
        const rollback = applyOptimisticDetails((prev) => {
            let changed = false
            const next = prev.map((detail) => {
                if (normalizePath(detail.path) !== normalizedTarget) return detail
                changed = true
                return toStagedDetail(detail)
            })
            return changed ? next : prev
        })

        try {
            const result = await window.devscope.stageFiles(params.decodedPath, [filePath])
            if (!result?.success) {
                throw new Error(result?.error || 'Failed to stage file')
            }
            void params.refreshGitData(false, { quiet: true })
        } catch (err: any) {
            rollback()
            params.showToast(`Failed to stage file: ${err.message}`, undefined, undefined, 'error')
        }
    }

    const handleUnstageFile = async (filePath: string) => {
        if (!params.decodedPath || !filePath.trim()) return
        const normalizedTarget = normalizePath(filePath)
        const rollback = applyOptimisticDetails((prev) => {
            let changed = false
            const next = prev.map((detail) => {
                if (normalizePath(detail.path) !== normalizedTarget) return detail
                changed = true
                return toUnstagedDetail(detail)
            })
            return changed ? next : prev
        })

        try {
            const result = await window.devscope.unstageFiles(params.decodedPath, [filePath])
            if (!result?.success) {
                throw new Error(result?.error || 'Failed to unstage file')
            }
            void params.refreshGitData(false, { quiet: true })
        } catch (err: any) {
            rollback()
            params.showToast(`Failed to unstage file: ${err.message}`, undefined, undefined, 'error')
        }
    }

    const handleStageAll = async () => {
        if (!params.decodedPath || params.unstagedFiles.length === 0) return
        const rollback = applyOptimisticDetails((prev) => {
            const next = prev.map((detail) => (detail.unstaged ? toStagedDetail(detail) : detail))
            return next
        })

        try {
            const result = await window.devscope.stageFiles(
                params.decodedPath,
                params.unstagedFiles.map((file) => file.path)
            )
            if (!result?.success) {
                throw new Error(result?.error || 'Failed to stage all files')
            }
            void params.refreshGitData(false, { quiet: true })
        } catch (err: any) {
            rollback()
            params.showToast(`Failed to stage files: ${err.message}`, undefined, undefined, 'error')
        }
    }

    const handleUnstageAll = async () => {
        if (!params.decodedPath || params.stagedFiles.length === 0) return
        const rollback = applyOptimisticDetails((prev) => {
            const next = prev.map((detail) => (detail.staged ? toUnstagedDetail(detail) : detail))
            return next
        })

        try {
            const result = await window.devscope.unstageFiles(
                params.decodedPath,
                params.stagedFiles.map((file) => file.path)
            )
            if (!result?.success) {
                throw new Error(result?.error || 'Failed to unstage all files')
            }
            void params.refreshGitData(false, { quiet: true })
        } catch (err: any) {
            rollback()
            params.showToast(`Failed to unstage files: ${err.message}`, undefined, undefined, 'error')
        }
    }

    const handleGenerateCommitMessage = async () => {
        if (!params.decodedPath) return
        if (params.stagedFiles.length === 0) {
            params.showToast('Stage files first to generate an AI commit message.', undefined, undefined, 'info')
            return
        }

        const providerOrder = params.settings.commitAIProvider === 'groq'
            ? (['groq', 'gemini'] as const)
            : (['gemini', 'groq'] as const)

        const selectedProvider = providerOrder.find((provider) => {
            if (provider === 'groq') return Boolean(params.settings.groqApiKey?.trim())
            return Boolean(params.settings.geminiApiKey?.trim())
        })

        if (!selectedProvider) {
            params.showToast(
                'No API key configured for commit generation.',
                'Open AI Settings',
                '/settings/ai'
            )
            return
        }

        const apiKey = selectedProvider === 'groq' ? params.settings.groqApiKey : params.settings.geminiApiKey

        params.setIsGeneratingCommitMessage(true)
        try {
            const stagedDiffResult = await window.devscope.getWorkingDiff(params.decodedPath, undefined, 'staged')
            if (!stagedDiffResult?.success) {
                throw new Error(stagedDiffResult?.error || 'Failed to read staged changes')
            }

            const stagedDiff = String(stagedDiffResult.diff || '').trim()
            if (!stagedDiff || stagedDiff === 'No changes') {
                throw new Error('No staged diff available to generate a commit message.')
            }

            const generateResult = await window.devscope.generateCommitMessage(
                selectedProvider,
                apiKey,
                stagedDiff
            )

            if (!generateResult?.success) {
                throw new Error(generateResult?.error || 'Failed to generate commit message')
            }
            if (!generateResult.message) {
                throw new Error('Failed to generate commit message')
            }

            params.setCommitMessage(generateResult.message.trim())
        } catch (err: any) {
            params.showToast(`AI generation failed: ${err.message || 'Unknown error'}`, undefined, undefined, 'error')
        } finally {
            params.setIsGeneratingCommitMessage(false)
        }
    }

    const handlePush = async (mode: 'push' | 'publish' = 'push') => {
        if (!params.decodedPath) return
        const hadUnpushedCommits = params.unpushedCommits.length > 0

        params.setIsPushing(true)
        try {
            let retriedAfterTransientError = false
            const runPush = async () => {
                const pushResult = await window.devscope.pushCommits(params.decodedPath)
                if (!pushResult?.success) {
                    throw new Error(pushResult?.error || 'Failed to push commits')
                }
            }

            try {
                await runPush()
            } catch (initialError: any) {
                const initialMessage = String(initialError?.message || initialError || '')
                if (!isTransientPushError(initialMessage)) {
                    throw initialError
                }

                params.showToast('Push interrupted by network timeout. Retrying once...')
                await new Promise((resolve) => setTimeout(resolve, 1200))
                await runPush()
                retriedAfterTransientError = true
                params.showToast('Push succeeded after retry.')
            }

            await params.refreshGitData(false)
            if (!retriedAfterTransientError) {
                if (mode === 'publish' || !hadUnpushedCommits) {
                    params.showToast(`Published branch "${params.currentBranch || 'current'}" to remote.`)
                } else {
                    params.showToast('Pushed commits to remote.')
                }
            }
        } catch (err: any) {
            const rawMessage = String(err?.message || err || 'Failed to push commits')
            params.showToast(`Failed to push: ${summarizePushError(rawMessage)}`, undefined, undefined, 'error')
        } finally {
            params.setIsPushing(false)
        }
    }

    const handleSwitchBranch = async () => {
        if (!params.decodedPath || !params.targetBranch || params.targetBranch === params.currentBranch) return

        params.setIsSwitchingBranch(true)
        try {
            const checkoutResult = await window.devscope.checkoutBranch(params.decodedPath, params.targetBranch, {
                autoStash: true,
                autoCleanupLock: true
            })
            if (!checkoutResult?.success) {
                throw new Error(checkoutResult?.error || 'Failed to switch branch')
            }

            await params.refreshGitData(true)
            if (checkoutResult?.cleanedLock && checkoutResult?.stashed) {
                params.showToast(`Recovered stale Git lock and auto-stashed changes (${checkoutResult.stashRef || 'stash@{0}'}).`)
            } else if (checkoutResult?.cleanedLock) {
                params.showToast('Recovered stale Git lock and switched branch.')
            } else if (checkoutResult?.stashed) {
                params.showToast(`Switched branch after auto-stashing local changes (${checkoutResult.stashRef || 'stash@{0}'}).`)
            }
        } catch (err: any) {
            params.showToast(`Failed to switch branch: ${err.message}`, undefined, undefined, 'error')
        } finally {
            params.setIsSwitchingBranch(false)
        }
    }

    const handleInitGit = async () => {
        if (!params.decodedPath) return

        params.setIsInitializing(true)
        try {
            let gitignoreContent: string | undefined
            if (params.createGitignore && params.gitignoreTemplate) {
                if (params.gitignoreTemplate === 'Custom') {
                    const result = await window.devscope.generateCustomGitignoreContent(Array.from(params.selectedPatterns))
                    if (result.success) {
                        gitignoreContent = result.content
                    }
                } else {
                    const result = await window.devscope.generateGitignoreContent(params.gitignoreTemplate)
                    if (result.success) {
                        gitignoreContent = result.content
                    }
                }
            }

            const finalBranchName = params.branchName === 'custom' ? params.customBranchName : params.branchName

            const initResult = await window.devscope.initGitRepo(
                params.decodedPath,
                finalBranchName,
                params.createGitignore,
                gitignoreContent
            )

            if (!initResult.success) {
                params.showToast(`Failed to initialize git: ${initResult.error}`, undefined, undefined, 'error')
                params.setIsInitializing(false)
                return
            }

            params.setIsGitRepo(true)

            if (params.createInitialCommit) {
                const commitResult = await window.devscope.createInitialCommit(
                    params.decodedPath,
                    params.initialCommitMessage
                )

                if (!commitResult.success) {
                    params.showToast(
                        `Git initialized but failed to create initial commit: ${commitResult.error}`,
                        undefined,
                        undefined,
                        'error'
                    )
                }
            }

            await params.refreshGitData(true)
            params.setInitStep('remote')
        } catch (err: any) {
            params.showToast(`Failed to initialize git: ${err.message}`, undefined, undefined, 'error')
        } finally {
            params.setIsInitializing(false)
        }
    }

    const handleAddRemote = async () => {
        if (!params.decodedPath || !params.remoteUrl.trim()) return

        params.setIsAddingRemote(true)
        try {
            const result = await window.devscope.addRemoteOrigin(params.decodedPath, params.remoteUrl)

            if (!result.success) {
                params.showToast(`Failed to add remote: ${result.error}`, undefined, undefined, 'error')
                params.setIsAddingRemote(false)
                return
            }

            params.setShowInitModal(false)
            params.setInitStep('config')
            params.setRemoteUrl('')
            params.setIsGitRepo(true)
            params.setHasRemote(true)

            await params.refreshGitData(true)
        } catch (err: any) {
            params.showToast(`Failed to add remote: ${err.message}`, undefined, undefined, 'error')
        } finally {
            params.setIsAddingRemote(false)
        }
    }

    const handleSkipRemote = async () => {
        params.setShowInitModal(false)
        params.setInitStep('config')
        params.setRemoteUrl('')
        params.setIsGitRepo(true)
        params.setHasRemote(false)

        await params.refreshGitData(true)
    }

    const handleAuthorMismatchConfirm = () => {
        if (params.dontShowAuthorWarning) {
            localStorage.setItem('dontShowAuthorWarning', 'true')
        }
        params.setShowAuthorMismatch(false)
        void performCommit()
    }

    const handleOpenInExplorer = async () => {
        if (params.projectPath) {
            try {
                const result = await window.devscope.openInExplorer?.(params.projectPath)
                if (result && !result.success) {
                    params.showToast(`Failed to open folder: ${result.error}`, undefined, undefined, 'error')
                }
            } catch (err) {
                params.showToast(`Failed to invoke openInExplorer: ${err}`, undefined, undefined, 'error')
            }
        }
    }

    return {
        handleCommitClick,
        handleCommit,
        handleGenerateCommitMessage,
        handlePush,
        handleStageFile,
        handleUnstageFile,
        handleStageAll,
        handleUnstageAll,
        handleSwitchBranch,
        handleInitGit,
        handleAddRemote,
        handleSkipRemote,
        handleAuthorMismatchConfirm,
        handleOpenInExplorer
    }
}
