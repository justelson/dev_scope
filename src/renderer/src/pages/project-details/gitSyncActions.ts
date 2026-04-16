import { buildGitPublishPlan, describeGitPublishSuccess, type GitPublishPlan } from '@/lib/gitPublishPlanner'
import { invalidateProjectGitOverview } from '@/lib/projectGitOverview'
import type { GitActionParams } from './gitActionTypes'
import { isTransientPushError, summarizePushError } from './gitActionHelpers'

export function createGitSyncActions(params: GitActionParams) {
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

            invalidateProjectGitOverview(params.decodedPath)
            await params.refreshGitData(false, { mode: 'full' })
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

    return {
        handleFetch: async (remoteName?: string, successLabel?: string) => {
            if (!params.decodedPath) return

            params.setIsFetching(true)
            try {
                const result = await window.devscope.fetchUpdates(params.decodedPath, remoteName)
                if (!result?.success) {
                    throw new Error(result?.error || 'Failed to fetch updates')
                }

                params.setLastFetched(Date.now())
                invalidateProjectGitOverview(params.decodedPath)
                await params.refreshGitData(false, { mode: 'full' })
                params.showToast(successLabel || (remoteName ? `Fetched ${remoteName}.` : 'Fetched remote updates.'))
            } catch (err: any) {
                params.showToast(`Failed to fetch: ${err.message}`, undefined, undefined, 'error')
            } finally {
                params.setIsFetching(false)
            }
        },
        handlePush,
        handlePull: async (options?: { remoteName?: string; branchName?: string; pushRemoteName?: string; successLabel?: string }) => {
            if (!params.decodedPath) return

            params.setIsPulling(true)
            try {
                const result = await window.devscope.pullUpdates(params.decodedPath, options)
                if (!result?.success) {
                    throw new Error(result?.error || 'Failed to pull updates')
                }

                params.setLastPulled(Date.now())
                invalidateProjectGitOverview(params.decodedPath)
                await params.refreshGitData(true, { mode: 'full' })
                params.showToast(options?.successLabel || 'Pulled remote updates successfully.')
            } catch (err: any) {
                params.showToast(`Failed to pull: ${err.message}`, undefined, undefined, 'error')
            } finally {
                params.setIsPulling(false)
            }
        },
        handleSwitchBranch: async () => {
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

                invalidateProjectGitOverview(params.decodedPath)
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
    }
}
