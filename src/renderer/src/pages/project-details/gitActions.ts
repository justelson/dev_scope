import { resolvePreferredGitTextProvider } from '@/lib/gitAi'
import { buildGitPublishPlan, describeGitPublishSuccess, type GitPublishPlan } from '@/lib/gitPublishPlanner'
import {
    getProjectPullRequestConfig,
    resolvePreferredPullRequestProvider,
    resolvePullRequestGuideText
} from '@/lib/pullRequestWorkflow'
import type { GitCommit, GitStatusDetail } from './types'
import type { GitActionParams } from './gitActionTypes'
import { buildStatusMap, isTransientPushError, summarizePushError } from './gitActionHelpers'
import { createGitWorkingTreeActions } from './gitWorkingTreeActions'

export function createProjectGitActions(params: GitActionParams) {
    const bulkActionScope = params.settings.gitBulkActionScope === 'project' ? 'project' : 'repo'

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
            await params.refreshGitData(false, { mode: 'unpushed' })
            void params.refreshGitData(false, { quiet: true, mode: 'full' })
            params.showToast('Commit created successfully.')
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

        const shouldWarn = params.settings.gitWarnOnAuthorMismatch !== false
        if (shouldWarn && params.gitUser && params.repoOwner && params.gitUser.name !== params.repoOwner) {
            params.setShowAuthorMismatch(true)
            return
        }

        await performCommit()
    }
    const {
        handleStageFile,
        handleUnstageFile,
        handleStageAll,
        handleUnstageAll,
        handleDiscardUnstagedFile,
        handleDiscardUnstagedAll
    } = createGitWorkingTreeActions(params, bulkActionScope, applyOptimisticDetails)

    const handleCommitPushAndCreatePullRequest = async () => {
        if (!params.decodedPath || params.stagedFiles.length === 0) return

        const provider = resolvePreferredPullRequestProvider(params.settings)
        if (!params.commitMessage.trim() && !provider) {
            params.showToast(
                'Enter a commit message or configure an AI provider first.',
                'Open AI Settings',
                '/settings/ai',
                'info'
            )
            return
        }

        params.setIsStackedActionRunning(true)
        try {
            const prConfig = getProjectPullRequestConfig(params.settings, params.decodedPath)
            const guideText = await resolvePullRequestGuideText(
                params.settings,
                params.decodedPath,
                prConfig.guideSource,
                prConfig.guide
            )
            const result = await window.devscope.commitPushAndCreatePullRequest(params.decodedPath, {
                projectName: params.projectName,
                commitMessage: params.commitMessage.trim() || undefined,
                targetBranch: prConfig.targetBranch,
                draft: prConfig.draft,
                guideText,
                provider: provider?.provider,
                apiKey: provider?.apiKey,
                model: provider?.model
            })

            if (!result?.success) {
                throw new Error(result?.error || 'Failed to commit, push, and create the pull request.')
            }

            params.setCommitMessage('')
            await params.refreshGitData(false, { mode: 'unpushed' })
            void params.refreshGitData(false, { quiet: true, mode: 'full' })
            window.open(result.pullRequest.url, '_blank', 'noopener,noreferrer')
            const prNumberLabel = result.pullRequest.number > 0 ? ` #${result.pullRequest.number}` : ''
            params.showToast(
                result.status === 'opened_existing'
                    ? `Committed changes and opened PR${prNumberLabel}.`
                    : `Committed changes and created PR${prNumberLabel}.`
            )
        } catch (err: any) {
            params.showToast(`Failed to commit, push & create PR: ${err.message || 'Unknown error'}`, undefined, undefined, 'error')
        } finally {
            params.setIsStackedActionRunning(false)
        }
    }

    const handleDangerouslyStageCommitPushAndCreatePullRequest = async () => {
        if (!params.decodedPath || (params.stagedFiles.length === 0 && params.unstagedFiles.length === 0)) return

        const provider = resolvePreferredPullRequestProvider(params.settings)
        if (!params.commitMessage.trim() && !provider) {
            params.showToast(
                'Enter a commit message or configure an AI provider first.',
                'Open AI Settings',
                '/settings/ai',
                'info'
            )
            return
        }

        params.setIsStackedActionRunning(true)
        try {
            const prConfig = getProjectPullRequestConfig(params.settings, params.decodedPath)
            const guideText = await resolvePullRequestGuideText(
                params.settings,
                params.decodedPath,
                prConfig.guideSource,
                prConfig.guide
            )
            const result = await window.devscope.commitPushAndCreatePullRequest(params.decodedPath, {
                projectName: params.projectName,
                commitMessage: params.commitMessage.trim() || undefined,
                targetBranch: prConfig.targetBranch,
                draft: prConfig.draft,
                guideText,
                provider: provider?.provider,
                apiKey: provider?.apiKey,
                model: provider?.model,
                autoStageAll: true,
                stageScope: params.settings.gitBulkActionScope === 'project' ? 'project' : 'repo'
            })

            if (!result?.success) {
                throw new Error(result?.error || 'Failed to stage, commit, push, and create the pull request.')
            }

            params.setCommitMessage('')
            await params.refreshGitData(false, { mode: 'unpushed' })
            void params.refreshGitData(false, { quiet: true, mode: 'full' })
            window.open(result.pullRequest.url, '_blank', 'noopener,noreferrer')
            const prNumberLabel = result.pullRequest.number > 0 ? ` #${result.pullRequest.number}` : ''
            params.showToast(
                result.status === 'opened_existing'
                    ? `Staged all changes, committed, and opened PR${prNumberLabel}.`
                    : `Staged all changes, committed, and created PR${prNumberLabel}.`
            )
        } catch (err: any) {
            params.showToast(`Failed to dangerously stage, commit, push & create PR: ${err.message || 'Unknown error'}`, undefined, undefined, 'error')
        } finally {
            params.setIsStackedActionRunning(false)
        }
    }

    const handleGenerateCommitMessage = async () => {
        if (!params.decodedPath) return
        if (params.stagedFiles.length === 0) {
            params.showToast('Stage files first to generate an AI commit message.', undefined, undefined, 'info')
            return
        }

        const selectedProvider = resolvePreferredGitTextProvider(params.settings)

        if (!selectedProvider) {
            params.showToast(
                'No AI provider is configured for commit generation.',
                'Open AI Settings',
                '/settings/ai'
            )
            return
        }

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
                selectedProvider.provider,
                selectedProvider.apiKey || '',
                stagedDiff,
                selectedProvider.model
            )

            if (!generateResult?.success) {
                throw new Error(generateResult?.error || 'Failed to generate commit message')
            }
            if (!generateResult.message) {
                throw new Error('Failed to generate commit message')
            }

            params.setCommitMessage(generateResult.message.trim())
            params.showToast('Commit message generated successfully.')
        } catch (err: any) {
            params.showToast(`AI generation failed: ${err.message || 'Unknown error'}`, undefined, undefined, 'error')
        } finally {
            params.setIsGeneratingCommitMessage(false)
        }
    }

    const handlePush = async (
        publishPlanOverride?: GitPublishPlan,
        options?: { commitHash?: string; commitMessage?: string },
        pushOptions?: { remoteName?: string; branchName?: string }
    ) => {
        if (!params.decodedPath) return
        const targetCommitHash = String(options?.commitHash || '').trim()
        const publishPlan = publishPlanOverride ?? buildGitPublishPlan({
            currentBranch: params.currentBranch,
            branches: params.branches,
            remotes: params.remotes,
            unpushedCommits: params.unpushedCommits,
            selectedCommitHash: targetCommitHash || undefined,
            intent: targetCommitHash ? 'push-range' : 'push-all'
        })

        params.setIsPushing(true)
        try {
            let retriedAfterTransientError = false
            const runPush = async () => {
                const pushResult = targetCommitHash
                    ? await window.devscope.pushSingleCommit(params.decodedPath, targetCommitHash, pushOptions)
                    : await window.devscope.pushCommits(params.decodedPath, pushOptions)
                if (!pushResult?.success) {
                    throw new Error(pushResult?.error || (targetCommitHash ? 'Failed to push selected commit' : 'Failed to push commits'))
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

            await params.refreshGitData(false, { mode: 'unpushed' })
            if (!retriedAfterTransientError) {
                params.showToast(describeGitPublishSuccess(
                    publishPlan,
                    { commitHash: targetCommitHash || undefined, currentBranch: params.currentBranch }
                ))
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
        params.setShowAuthorMismatch(false)
        void performCommit()
    }

    const handleFetch = async (remoteName?: string, successLabel?: string) => {
        if (!params.decodedPath) return

        params.setIsFetching(true)
        try {
            const result = await window.devscope.fetchUpdates(params.decodedPath, remoteName)
            if (!result?.success) {
                throw new Error(result?.error || 'Failed to fetch updates')
            }

            params.setLastFetched(Date.now())
            await params.refreshGitData(false, { quiet: true, mode: 'pulls' })
            params.showToast(successLabel || (remoteName ? `Fetched ${remoteName}.` : 'Fetched remote updates.'))
        } catch (err: any) {
            params.showToast(`Failed to fetch: ${err.message}`, undefined, undefined, 'error')
        } finally {
            params.setIsFetching(false)
        }
    }

    const handlePull = async (options?: { remoteName?: string; branchName?: string; pushRemoteName?: string; successLabel?: string }) => {
        if (!params.decodedPath) return

        params.setIsPulling(true)
        try {
            const result = await window.devscope.pullUpdates(params.decodedPath, options)
            if (!result?.success) {
                throw new Error(result?.error || 'Failed to pull updates')
            }

            params.setLastPulled(Date.now())
            await params.refreshGitData(true, { mode: 'full' })
            params.showToast(options?.successLabel || 'Pulled remote updates successfully.')
        } catch (err: any) {
            params.showToast(`Failed to pull: ${err.message}`, undefined, undefined, 'error')
        } finally {
            params.setIsPulling(false)
        }
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
        handleCommitPushAndCreatePullRequest,
        handleDangerouslyStageCommitPushAndCreatePullRequest,
        handleGenerateCommitMessage,
        handleFetch,
        handlePush,
        handlePull,
        handleStageFile,
        handleUnstageFile,
        handleStageAll,
        handleUnstageAll,
        handleDiscardUnstagedFile,
        handleDiscardUnstagedAll,
        handleSwitchBranch,
        handleInitGit,
        handleAddRemote,
        handleSkipRemote,
        handleAuthorMismatchConfirm,
        handleOpenInExplorer
    }
}
