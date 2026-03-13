import { useEffect, useMemo, useRef, useState } from 'react'
import { AlertCircle, ArrowDownCircle, Check, Copy, ExternalLink, GitBranch, GitCommitHorizontal, GitPullRequest, Info, Link, Plus, RefreshCw, User, X } from 'lucide-react'
import { buildGitPublishPlan } from '@/lib/gitPublishPlanner'
import { cn } from '@/lib/utils'
import { useSettings } from '@/lib/settings'
import { WorkingChangesView } from './WorkingChangesView'
import { GitGraph } from './GitGraph'
import { DiffStats } from './DiffStats'
import { ProjectDetailsGitManageView } from './ProjectDetailsGitManageView'
import { PullRequestModal } from './PullRequestModal'
import type { GitCommit } from './types'
import { useGitHubPublishContext } from './useGitHubPublishContext'

interface ProjectDetailsGitTabProps {
    lastFetched?: number
    lastPulled?: number
    [key: string]: any
}

function isGitHubRemoteUrl(remoteUrl: string) {
    return /github\.com[:/]/i.test(String(remoteUrl || '').trim())
}

function parseGitHubRemoteFullName(remoteUrl: string) {
    const trimmed = String(remoteUrl || '').trim()
    if (!trimmed) return null

    const sshMatch = trimmed.match(/^git@github\.com:([^/]+)\/(.+?)(?:\.git)?$/i)
    if (sshMatch) {
        return `${sshMatch[1]}/${sshMatch[2].replace(/\.git$/i, '')}`
    }

    try {
        const url = new URL(trimmed)
        if (!/github\.com$/i.test(url.hostname)) return null
        const segments = url.pathname.split('/').filter(Boolean)
        if (segments.length < 2) return null
        return `${segments[0]}/${segments[1].replace(/\.git$/i, '')}`
    } catch {
        return null
    }
}

function normalizeIdentityToken(value: string | null | undefined) {
    return String(value || '').trim().toLowerCase().replace(/\s+/g, '')
}

function isVerbosePublishLine(line: string) {
    return /^Remote "/.test(line)
}

function getRefreshModeForGitView(gitView: 'changes' | 'history' | 'unpushed' | 'pulls' | 'manage') {
    if (gitView === 'changes') return 'working'
    if (gitView === 'history') return 'history'
    if (gitView === 'unpushed') return 'unpushed'
    if (gitView === 'pulls') return 'pulls'
    return 'full'
}

export function ProjectDetailsGitTab(props: ProjectDetailsGitTabProps) {
    const { updateSettings } = useSettings()
    const {
        project,
        gitUser,
        repoOwner,
        gitView,
        setGitView,
        changedFiles,
        stagedFiles,
        unstagedFiles,
        unpushedCommits,
        incomingCommits,
        gitSyncStatus,
        refreshGitData,
        loadingGit,
        loadingGitHistory,
        gitError,
        decodedPath,
        handleCommitClick,
        pullsPage,
        setPullsPage,
        ITEMS_PER_PAGE,
        COMMITS_PER_PAGE,
        commitPage,
        setCommitPage,
        gitHistory,
        gitHistoryTotalCount,
        historyHasMore,
        loadingMoreHistory,
        loadMoreGitHistory,
        commitMessage,
        setCommitMessage,
        handleGenerateCommitMessage,
        isGeneratingCommitMessage,
        isCommitting,
        settings,
        handleCommit,
        handleStageFile,
        handleUnstageFile,
        handleStageAll,
        handleUnstageAll,
        ensureStatsForPaths,
        hasRemote,
        setInitStep,
        setShowInitModal,
        currentBranch,
        branches,
        handlePush,
        isPushing,
        handleFetch,
        handlePull,
        isFetching,
        isPulling,
        remotes,
        showToast
    } = props

    const githubRemoteUrls = useMemo(
        () => (remotes || []).map((remote: any) => String(remote.pushUrl || '')).filter(Boolean),
        [remotes]
    )
    const {
        context: githubPublishContext,
        loading: loadingGitHubPublishContext,
        error: gitHubPublishContextError,
        refresh: refreshGitHubPublishContext
    } = useGitHubPublishContext({
        projectPath: decodedPath,
        enabled: hasRemote === true,
        remoteUrls: githubRemoteUrls
    })
    const hasGitHubRemote = useMemo(
        () => githubRemoteUrls.some((remoteUrl: string) => isGitHubRemoteUrl(remoteUrl)),
        [githubRemoteUrls]
    )
    const originRemote = useMemo(
        () => (remotes || []).find((remote: any) => remote.name === 'origin') || null,
        [remotes]
    )
    const originRemoteFullName = useMemo(
        () => parseGitHubRemoteFullName(String(originRemote?.pushUrl || originRemote?.fetchUrl || '')),
        [originRemote]
    )
    const configuredUpstreamRemote = useMemo(() => {
        const upstreamFullName = githubPublishContext?.upstream?.fullName
        if (!upstreamFullName) return null
        return (remotes || []).find((remote: any) => {
            const remoteFullName = parseGitHubRemoteFullName(String(remote.pushUrl || remote.fetchUrl || ''))
            return remoteFullName === upstreamFullName && remote.name !== 'origin'
        }) || null
    }, [githubPublishContext?.upstream?.fullName, remotes])
    const effectiveUpstreamRemoteName = configuredUpstreamRemote?.name
        || (originRemoteFullName && originRemoteFullName === githubPublishContext?.upstream?.fullName ? originRemote?.name : null)
    const repoUsesForkOrigin = Boolean(
        originRemoteFullName
        && githubPublishContext?.upstream?.fullName
        && originRemoteFullName !== githubPublishContext.upstream.fullName
    )
    const upstreamRepoDisplay = githubPublishContext?.upstream?.fullName || 'Not configured'
    const originRepoDisplay = originRemoteFullName || originRemote?.name || 'Not configured'
    const canFetchOrigin = Boolean(originRemote?.name)
    const canFetchUpstream = Boolean(
        effectiveUpstreamRemoteName
        || (repoUsesForkOrigin && githubPublishContext?.upstream?.cloneUrl)
    )
    const canSyncFromUpstream = Boolean(
        repoUsesForkOrigin
        && originRemote?.name
        && currentBranch
        && (effectiveUpstreamRemoteName || githubPublishContext?.upstream?.cloneUrl)
    )
    const showFetchUpstreamButton = Boolean(repoUsesForkOrigin && canFetchUpstream)
    const pushAccessIndicator = useMemo(() => {
        const ownerToken = normalizeIdentityToken(repoOwner)
        const gitUserNameToken = normalizeIdentityToken(gitUser?.name)
        const gitUserEmailToken = normalizeIdentityToken(String(gitUser?.email || '').split('@')[0])

        const inferredOwnerMatch = Boolean(
            ownerToken
            && (ownerToken === gitUserNameToken || ownerToken === gitUserEmailToken)
        )

        return {
            allowed: inferredOwnerMatch,
            inferred: inferredOwnerMatch
        }
    }, [gitUser?.email, gitUser?.name, repoOwner])
    const pushPlan = useMemo(
        () => buildGitPublishPlan({
            currentBranch,
            branches,
            remotes: remotes || [],
            unpushedCommits,
            intent: 'push-all',
            githubPublishContext
        }),
        [branches, currentBranch, githubPublishContext, remotes, unpushedCommits]
    )
    const compactPushSummaryLines = useMemo(
        () => pushPlan.summaryLines.filter((line) => !isVerbosePublishLine(line)),
        [pushPlan.summaryLines]
    )
    const currentBranchNeedsPublish = pushPlan.currentBranchNeedsPublish
    const showPushAction = hasRemote === true && (unpushedCommits.length > 0 || currentBranchNeedsPublish)
    const visibleHistorySource = gitHistory
    const historyPageStart = Math.max(0, (commitPage - 1) * COMMITS_PER_PAGE)
    const historyPageEnd = Math.max(historyPageStart, commitPage * COMMITS_PER_PAGE)
    const visibleHistoryCommits = useMemo(
        () => visibleHistorySource.slice(historyPageStart, historyPageEnd),
        [visibleHistorySource, historyPageStart, historyPageEnd]
    )
    const effectiveHistoryTotalCount = Math.max(gitHistoryTotalCount || 0, visibleHistorySource.length)
    const totalHistoryPages = Math.max(1, Math.ceil(effectiveHistoryTotalCount / COMMITS_PER_PAGE))
    const gitCountsLoading = loadingGit && !gitError
    const unpushedStatsLoading = gitCountsLoading && unpushedCommits.length === 0
    const incomingStatsLoading = gitCountsLoading && incomingCommits.length === 0 && !gitSyncStatus
    const historyLoading = loadingGitHistory && !gitError
    const hasFetchedSinceLastPull = Boolean(
        props.lastFetched
        && (!props.lastPulled || props.lastFetched > props.lastPulled)
    )
    const shouldHighlightPull = hasFetchedSinceLastPull && (gitSyncStatus?.behind || 0) > 0
    const pullStatusItems = useMemo(() => {
        if (incomingStatsLoading) {
            return ['Loading']
        }

        const items: string[] = []
        items.push(
            gitSyncStatus?.workingTreeChanged
                ? `${gitSyncStatus.workingTreeChangeCount} local change${gitSyncStatus.workingTreeChangeCount === 1 ? '' : 's'}`
                : 'Clean'
        )
        items.push(
            repoUsesForkOrigin
                ? 'Syncs upstream to fork'
                : `Pulls ${currentBranch || 'branch'}`
        )
        if (shouldHighlightPull) {
            items.push('Ready to pull')
        }
        return items
    }, [
        currentBranch,
        gitSyncStatus?.workingTreeChangeCount,
        gitSyncStatus?.workingTreeChanged,
        incomingStatsLoading,
        repoUsesForkOrigin,
        shouldHighlightPull
    ])
    const pagedIncomingCommits = useMemo(
        () => incomingCommits.slice((pullsPage - 1) * ITEMS_PER_PAGE, pullsPage * ITEMS_PER_PAGE),
        [incomingCommits, pullsPage, ITEMS_PER_PAGE]
    )
    const localOnlyCommitHashes = useMemo(
        () => new Set<string>(unpushedCommits.map((commit: GitCommit) => commit.hash)),
        [unpushedCommits]
    )
    const [showPullRequestModal, setShowPullRequestModal] = useState(false)
    const [showRepoInfoModal, setShowRepoInfoModal] = useState(false)
    const [activeFetchTarget, setActiveFetchTarget] = useState<'origin' | 'upstream' | null>(null)
    const upstreamLinkAttemptRef = useRef<string | null>(null)
    const remoteHeadCommitHash = useMemo(() => {
        if (hasRemote !== true) {
            return null
        }

        const firstRemoteCommit = visibleHistorySource.find((commit: GitCommit) => !localOnlyCommitHashes.has(commit.hash))
        return firstRemoteCommit?.hash ?? null
    }, [hasRemote, localOnlyCommitHashes, visibleHistorySource])
    const handleNextHistoryPage = async () => {
        if (commitPage < totalHistoryPages) {
            setCommitPage((p: number) => Math.min(totalHistoryPages, p + 1))
            return
        }

        if (!historyHasMore || loadingMoreHistory) {
            return
        }

        const loadedMore = await loadMoreGitHistory?.()
        if (loadedMore) {
            setCommitPage((p: number) => p + 1)
        }
    }
    useEffect(() => {
        const upstreamCloneUrl = githubPublishContext?.upstream?.cloneUrl
        const upstreamFullName = githubPublishContext?.upstream?.fullName
        if (!decodedPath || !repoUsesForkOrigin || !upstreamCloneUrl || !upstreamFullName) {
            return
        }

        const linkedRemote = (remotes || []).find((remote: any) => {
            const remoteFullName = parseGitHubRemoteFullName(String(remote.pushUrl || remote.fetchUrl || ''))
            return remoteFullName === upstreamFullName
        })
        if (linkedRemote) {
            return
        }

        const attemptKey = `${decodedPath}:${upstreamFullName}`
        if (upstreamLinkAttemptRef.current === attemptKey) {
            return
        }
        upstreamLinkAttemptRef.current = attemptKey

        const existingUpstreamRemote = (remotes || []).find((remote: any) => remote.name === 'upstream')

        void (async () => {
            try {
                const result = existingUpstreamRemote
                    ? await window.devscope.setRemoteUrl(decodedPath, 'upstream', upstreamCloneUrl)
                    : await window.devscope.addRemote(decodedPath, 'upstream', upstreamCloneUrl)
                if (!result?.success) {
                    throw new Error(result?.error || 'Failed to link upstream remote.')
                }
                await refreshGitData(false, { quiet: true, mode: 'pulls' })
            } catch (err) {
                console.error('[GitTab] Failed to link upstream remote automatically', err)
            }
        })()
    }, [decodedPath, githubPublishContext?.upstream?.cloneUrl, githubPublishContext?.upstream?.fullName, refreshGitData, remotes, repoUsesForkOrigin])
    const ensureUpstreamRemote = async () => {
        if (effectiveUpstreamRemoteName) {
            return effectiveUpstreamRemoteName
        }

        const upstreamCloneUrl = githubPublishContext?.upstream?.cloneUrl
        const upstreamFullName = githubPublishContext?.upstream?.fullName
        if (!repoUsesForkOrigin || !upstreamCloneUrl || !decodedPath) {
            return null
        }

        const existingUpstreamRemote = (remotes || []).find((remote: any) => remote.name === 'upstream')
        if (existingUpstreamRemote) {
            const existingFullName = parseGitHubRemoteFullName(String(existingUpstreamRemote.pushUrl || existingUpstreamRemote.fetchUrl || ''))
            if (upstreamFullName && existingFullName !== upstreamFullName) {
                const updateResult = await window.devscope.setRemoteUrl(decodedPath, 'upstream', upstreamCloneUrl)
                if (!updateResult?.success) {
                    throw new Error(updateResult?.error || 'Failed to update upstream remote.')
                }
                await refreshGitData(false, { quiet: true, mode: 'pulls' })
            }
            return 'upstream'
        }

        const addResult = await window.devscope.addRemote(decodedPath, 'upstream', upstreamCloneUrl)
        if (!addResult?.success) {
            throw new Error(addResult?.error || 'Failed to add upstream remote.')
        }

        await refreshGitData(false, { quiet: true, mode: 'pulls' })
        return 'upstream'
    }
    const handleFetchOrigin = async () => {
        if (!originRemote?.name) return
        setActiveFetchTarget('origin')
        try {
            await handleFetch(originRemote.name, `Fetched ${originRemote.name}.`)
        } finally {
            setActiveFetchTarget(null)
        }
    }
    const handleFetchUpstream = async () => {
        setActiveFetchTarget('upstream')
        try {
            const remoteName = await ensureUpstreamRemote()
            if (!remoteName) {
                throw new Error('No upstream remote is configured for this repository.')
            }
            await handleFetch(remoteName, `Fetched ${remoteName}.`)
        } catch (err: any) {
            showToast(`Failed to fetch upstream: ${err.message}`, undefined, undefined, 'error')
        } finally {
            setActiveFetchTarget(null)
        }
    }
    const handleSyncFromUpstream = async () => {
        try {
            const upstreamRemoteName = await ensureUpstreamRemote()
            if (!upstreamRemoteName || !originRemote?.name) {
                throw new Error('Origin and upstream remotes must both be configured.')
            }
            await handlePull({
                remoteName: upstreamRemoteName,
                branchName: currentBranch,
                pushRemoteName: originRemote.name,
                successLabel: `Synced ${currentBranch || 'current branch'} from ${upstreamRemoteName} to ${originRemote.name}.`
            })
        } catch (err: any) {
            showToast(`Failed to sync upstream: ${err.message}`, undefined, undefined, 'error')
        }
    }
    const originRemoteUrl = String(originRemote?.pushUrl || originRemote?.fetchUrl || '')
    const upstreamRemoteUrl = repoUsesForkOrigin
        ? String(githubPublishContext?.upstream?.cloneUrl || '')
        : ''
    const repoFlowSummary = repoUsesForkOrigin
        ? `${originRepoDisplay} -> ${upstreamRepoDisplay}`
        : `${originRepoDisplay} -> ${gitSyncStatus?.upstreamBranch || 'tracked branch'}`
    const handleCopyRepoValue = async (value: string, label: string) => {
        const trimmed = String(value || '').trim()
        if (!trimmed) return
        const result = await window.devscope.copyToClipboard(trimmed)
        if (result?.success) {
            showToast(`${label} copied.`)
        } else {
            showToast(`Failed to copy ${label.toLowerCase()}.`, undefined, undefined, 'error')
        }
    }
    return (
        <div className="flex flex-col h-full">
            {gitError && (
                <div className="mx-4 mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-200 flex items-start gap-2">
                    <AlertCircle size={14} className="mt-0.5 shrink-0" />
                    <span className="break-words">{gitError}</span>
                </div>
            )}

            {gitUser && (
                <div className="p-4 border-b border-white/5 bg-white/[0.02]">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-white/5">
                                <User size={16} className="text-white/60" />
                            </div>
                            <div>
                                <p className="text-xs text-white/40">Repository Owner</p>
                                <p className="text-sm font-medium text-white/80">{repoOwner || 'Unknown'}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="text-right">
                                <p className="text-xs text-white/40">Current User</p>
                                <div className="flex items-center justify-end gap-2">
                                    <p className="text-sm font-medium text-white/80">{gitUser.name}</p>
                                    {pushAccessIndicator.allowed ? (
                                        <span
                                            className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-emerald-400/35 bg-emerald-400/15 text-emerald-200"
                                            title={pushAccessIndicator.inferred
                                                ? 'Owner match suggests this user can push to the remote.'
                                                : 'This account can push to the remote.'}
                                        >
                                            <Check size={11} strokeWidth={3} />
                                        </span>
                                    ) : (
                                        <span
                                            className="h-2.5 w-2.5 rounded-full bg-white/20"
                                            title="This account is not matched as a direct pusher for the current remote."
                                        />
                                    )}
                                </div>
                            </div>
                            <div className="p-2 rounded-lg bg-[var(--accent-primary)]/10">
                                <User size={16} className="text-[var(--accent-primary)]" />
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <div className="flex items-center gap-1 px-4 py-3 border-b border-white/5 overflow-x-auto">
                <button
                    onClick={() => setGitView('manage')}
                    className={cn(
                        'px-3 py-1.5 text-xs font-medium rounded-lg transition-colors border border-transparent whitespace-nowrap',
                        gitView === 'manage'
                            ? 'bg-white/10 text-white border-white/5'
                            : 'text-white/50 hover:text-white hover:bg-white/5'
                    )}
                >
                    <span className="flex items-center gap-1.5">
                        <GitBranch size={12} />
                        Manage
                    </span>
                </button>
                <button
                    onClick={() => setGitView('changes')}
                    className={cn(
                        'px-3 py-1.5 text-xs font-medium rounded-lg transition-colors border border-transparent whitespace-nowrap',
                        gitView === 'changes'
                            ? 'bg-white/10 text-white border-white/5'
                            : 'text-white/50 hover:text-white hover:bg-white/5'
                    )}
                >
                    Working Changes ({changedFiles.length})
                </button>
                <button
                    onClick={() => setGitView('unpushed')}
                    className={cn(
                        'px-3 py-1.5 text-xs font-medium rounded-lg transition-colors border border-transparent whitespace-nowrap',
                        gitView === 'unpushed'
                            ? 'bg-white/10 text-white border-white/5'
                            : 'text-white/50 hover:text-white hover:bg-white/5'
                    )}
                >
                    To Push ({unpushedCommits.length})
                </button>
                <button
                    onClick={() => setGitView('pulls')}
                    className={cn(
                        'px-3 py-1.5 text-xs font-medium rounded-lg transition-colors border border-transparent whitespace-nowrap',
                        gitView === 'pulls'
                            ? 'bg-white/10 text-white border-white/5'
                            : 'text-white/50 hover:text-white hover:bg-white/5'
                    )}
                >
                    Pulls ({gitSyncStatus?.behind || 0})
                </button>
                <button
                    onClick={() => setGitView('history')}
                    className={cn(
                        'px-3 py-1.5 text-xs font-medium rounded-lg transition-colors border border-transparent whitespace-nowrap',
                        gitView === 'history'
                            ? 'bg-white/10 text-white border-white/5'
                            : 'text-white/50 hover:text-white hover:bg-white/5'
                    )}
                >
                    History
                </button>
                <button
                    onClick={() => setShowRepoInfoModal(true)}
                    title="Repo Info"
                    aria-label="Repo Info"
                    className="ml-auto inline-flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 text-white/70 transition-colors hover:bg-white/5 hover:text-white"
                >
                    <Info size={13} />
                </button>
                <button
                    onClick={() => void refreshGitData(false, { mode: getRefreshModeForGitView(gitView) })}
                    disabled={gitView === 'history' ? historyLoading : loadingGit}
                    className="px-3 py-1.5 text-xs font-medium rounded-lg transition-colors border border-white/10 text-white/70 hover:text-white hover:bg-white/5 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                >
                    <span className="flex items-center gap-1.5">
                        <RefreshCw size={12} className={cn((gitView === 'history' ? historyLoading : loadingGit) && 'animate-spin')} />
                        Refresh Git
                    </span>
                </button>
            </div>

            <div className="project-surface-scrollbar p-4 flex-1 overflow-y-auto">
                {gitView === 'manage' ? (
                    <ProjectDetailsGitManageView
                        {...props}
                        githubPublishContext={githubPublishContext}
                        loadingGitHubPublishContext={loadingGitHubPublishContext}
                        gitHubPublishContextError={gitHubPublishContextError}
                        hasGitHubRemote={hasGitHubRemote}
                        onOpenCreatePullRequest={() => setShowPullRequestModal(true)}
                    />
                ) : gitView === 'changes' ? (
                    <WorkingChangesView
                        stagedFiles={stagedFiles}
                        unstagedFiles={unstagedFiles}
                        projectPath={decodedPath}
                        commitMessage={commitMessage}
                        setCommitMessage={setCommitMessage}
                        handleGenerateCommitMessage={handleGenerateCommitMessage}
                        isGeneratingCommitMessage={isGeneratingCommitMessage}
                        isCommitting={isCommitting}
                        settings={settings}
                        handleCommit={handleCommit}
                        handleStageFile={handleStageFile}
                        handleUnstageFile={handleUnstageFile}
                        handleStageAll={handleStageAll}
                        handleUnstageAll={handleUnstageAll}
                        ensureStatsForPaths={ensureStatsForPaths}
                    />
                ) : gitView === 'unpushed' ? (
                    <>
                        {hasRemote === false ? (
                            <div className="bg-amber-500/10 rounded-xl border border-amber-500/20 p-4 mb-4">
                                <h3 className="text-sm font-medium text-amber-400 mb-3 flex items-center gap-2">
                                    <Link size={16} />
                                    No Remote Repository
                                </h3>
                                <p className="text-xs text-white/50 mb-3">
                                    Add a remote repository to publish this branch and push commits.
                                </p>
                                <button
                                    onClick={() => {
                                        setInitStep('remote')
                                        setShowInitModal(true)
                                    }}
                                    className="w-full px-4 py-2.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 text-sm font-medium rounded-lg transition-all flex items-center justify-center gap-2 border border-amber-500/30"
                                >
                                    <Plus size={16} />
                                    Add Remote Repository
                                </button>
                            </div>
                        ) : null}

                        {showPushAction && (
                            <div className="bg-black/20 rounded-xl border border-white/5 p-4 mb-4">
                                <h3 className="text-sm font-medium text-white/80 mb-3 flex items-center gap-2">
                                    <GitPullRequest size={16} />
                                    Local Commits
                                </h3>
                                {unpushedStatsLoading && !currentBranchNeedsPublish ? (
                                    <p className="text-xs text-white/50 mb-3">Loading unpushed commit summary...</p>
                                ) : null}
                                <div className="mb-3 space-y-2">
                                    {compactPushSummaryLines.map((line) => (
                                        <div key={line} className="rounded-lg border border-white/5 bg-black/20 px-3 py-2 text-xs text-white/62">
                                            {line}
                                        </div>
                                    ))}
                                </div>
                                <div className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-white/62">
                                    {hasGitHubRemote
                                        ? 'DevScope drafts the PR from this branch. Push the branch yourself when you are ready.'
                                        : 'These commits stay local until you push them with your normal Git remote workflow.'}
                                </div>
                                <div className="mt-3 flex justify-end">
                                    <button
                                        onClick={() => setShowPullRequestModal(true)}
                                        disabled={!hasGitHubRemote}
                                        className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-xs font-medium text-white/80 transition-colors hover:border-white/20 hover:bg-white/[0.05] disabled:cursor-not-allowed disabled:opacity-40"
                                    >
                                        <GitPullRequest size={14} />
                                        {hasGitHubRemote ? 'Create PR' : 'GitHub Remote Required'}
                                    </button>
                                </div>
                            </div>
                        )}

                        {unpushedCommits.length > 0 ? (
                            <>
                                <GitGraph
                                    commits={unpushedCommits}
                                    laneSourceCommits={unpushedCommits}
                                    onCommitClick={handleCommitClick}
                                    localOnlyCommitHashes={localOnlyCommitHashes}
                                    hasRemote={hasRemote}
                                    remoteHeadCommitHash={null}
                                />
                            </>
                        ) : (
                            <div className="flex flex-col items-center justify-center py-24 text-white/30">
                                <GitPullRequest size={48} className="mb-4 opacity-50" />
                                <p>No unpushed commits</p>
                                <p className="text-xs opacity-50">All commits are synced</p>
                            </div>
                        )}
                    </>
                ) : gitView === 'pulls' ? (
                    <>
                        <div className={cn('mb-4 grid grid-cols-2 gap-2', repoUsesForkOrigin ? 'xl:grid-cols-5' : 'xl:grid-cols-4')}>
                            <div className="min-w-0 rounded-xl border border-white/10 bg-black/20 p-3">
                                <p className="text-[11px] uppercase tracking-wide text-white/40">Current Branch</p>
                                <p
                                    className="mt-1 truncate text-sm font-medium text-white/85"
                                    title={incomingStatsLoading ? 'Loading...' : (gitSyncStatus?.currentBranch || currentBranch || 'Unknown')}
                                >
                                    {incomingStatsLoading ? 'Loading...' : (gitSyncStatus?.currentBranch || currentBranch || 'Unknown')}
                                </p>
                            </div>
                            <div className="min-w-0 rounded-xl border border-white/10 bg-black/20 p-3">
                                <p className="text-[11px] uppercase tracking-wide text-white/40">Tracked Branch</p>
                                <p
                                    className="mt-1 truncate text-sm font-medium text-white/85"
                                    title={incomingStatsLoading ? 'Loading...' : (gitSyncStatus?.upstreamBranch || 'Not configured')}
                                >
                                    {incomingStatsLoading ? 'Loading...' : (gitSyncStatus?.upstreamBranch || 'Not configured')}
                                </p>
                            </div>
                            <div className="min-w-0 rounded-xl border border-white/10 bg-black/20 p-3">
                                <p className="text-[11px] uppercase tracking-wide text-white/40">Origin</p>
                                <p className="mt-1 truncate text-sm font-medium text-white/85" title={originRepoDisplay}>{originRepoDisplay}</p>
                            </div>
                            {repoUsesForkOrigin ? (
                                <div className="min-w-0 rounded-xl border border-white/10 bg-black/20 p-3">
                                    <p className="text-[11px] uppercase tracking-wide text-white/40">Upstream</p>
                                    <p className="mt-1 truncate text-sm font-medium text-white/85" title={upstreamRepoDisplay}>{upstreamRepoDisplay}</p>
                                </div>
                            ) : null}
                            <div className="min-w-0 rounded-xl border border-white/10 bg-black/20 p-3">
                                <p className="text-[11px] uppercase tracking-wide text-white/40">Behind</p>
                                <p className="mt-1 text-xl font-semibold text-white/85">{incomingStatsLoading ? '...' : (gitSyncStatus?.behind || 0)}</p>
                            </div>
                        </div>

                        <div className="mb-4 rounded-xl border border-white/10 bg-black/20 p-4">
                            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                                <div className="flex flex-wrap items-center gap-2">
                                    <button
                                        onClick={() => { void handleFetchOrigin() }}
                                        disabled={isFetching || !canFetchOrigin}
                                        className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-4 py-2 text-sm text-white/75 transition-all hover:border-white/20 hover:bg-white/[0.05] hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                                    >
                                        {isFetching && activeFetchTarget === 'origin' ? <RefreshCw size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                                        Fetch Origin
                                    </button>
                                    {showFetchUpstreamButton ? (
                                        <button
                                            onClick={() => { void handleFetchUpstream() }}
                                            disabled={isFetching}
                                            className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-4 py-2 text-sm text-white/75 transition-all hover:border-white/20 hover:bg-white/[0.05] hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                                        >
                                            {isFetching && activeFetchTarget === 'upstream' ? <RefreshCw size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                                            Fetch Upstream
                                        </button>
                                    ) : null}
                                </div>
                                <div className="flex items-center">
                                    {canSyncFromUpstream ? (
                                        <button
                                            onClick={() => { void handleSyncFromUpstream() }}
                                            disabled={isPulling}
                                            className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-4 py-2 text-sm text-white transition-all hover:border-white/20 hover:bg-white/[0.05] disabled:cursor-not-allowed disabled:opacity-40"
                                        >
                                            {isPulling ? <RefreshCw size={14} className="animate-spin" /> : <ArrowDownCircle size={14} />}
                                            Sync Upstream To Fork
                                        </button>
                                    ) : (
                                        <button
                                            onClick={() => { void handlePull() }}
                                            disabled={isPulling || hasRemote !== true || (gitSyncStatus?.behind || 0) === 0}
                                            className={cn(
                                                'inline-flex items-center gap-2 rounded-lg border border-white/10 px-4 py-2 text-sm text-white transition-all hover:border-white/20 disabled:cursor-not-allowed disabled:opacity-40',
                                                shouldHighlightPull
                                                    ? 'bg-white/[0.08] hover:bg-white/[0.12]'
                                                    : 'bg-white/[0.03] hover:bg-white/[0.05]'
                                            )}
                                        >
                                            {isPulling ? <RefreshCw size={14} className="animate-spin" /> : <ArrowDownCircle size={14} />}
                                            Pull Latest
                                        </button>
                                    )}
                                </div>
                            </div>
                            <div className="flex items-center justify-between gap-4 text-xs text-white/45">
                                <span>
                                    {props.lastFetched ? `Last fetched: ${new Date(props.lastFetched).toLocaleString()}` : 'Never fetched'}
                                </span>
                                <span>
                                    {props.lastPulled ? `Last pulled: ${new Date(props.lastPulled).toLocaleString()}` : 'Never pulled'}
                                </span>
                            </div>
                            <div className="mt-2 flex flex-wrap items-center gap-2">
                                {pullStatusItems.map((item) => (
                                    <span
                                        key={item}
                                        className={cn(
                                            'rounded-full border px-2.5 py-1 text-[11px]',
                                            item === 'Ready to pull'
                                                ? 'border-emerald-400/25 bg-emerald-400/10 text-emerald-200/85'
                                                : 'border-white/10 bg-white/[0.03] text-white/55'
                                        )}
                                    >
                                        {item}
                                    </span>
                                ))}
                            </div>
                        </div>

                        {hasRemote === false ? (
                            <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-4">
                                <h3 className="mb-2 flex items-center gap-2 text-sm font-medium text-amber-400">
                                    <Link size={16} />
                                    No Remote Repository
                                </h3>
                                <p className="text-xs text-white/50">Add a remote before fetch and pull are available.</p>
                            </div>
                        ) : incomingCommits.length > 0 ? (
                            <>
                                <div className="space-y-2">
                                    {pagedIncomingCommits.map((commit: any) => (
                                        <div
                                            key={commit.hash}
                                            onClick={() => handleCommitClick(commit)}
                                            className="cursor-pointer rounded-xl border border-white/5 bg-black/30 p-4 transition-colors hover:bg-white/5"
                                        >
                                            <div className="flex items-start gap-3">
                                                <ArrowDownCircle size={16} className="mt-0.5 text-amber-300" />
                                                <div className="flex min-w-0 flex-1 items-start justify-between gap-3">
                                                    <div className="min-w-0">
                                                        <p className="mb-1 truncate text-sm font-medium text-white/90">{commit.message}</p>
                                                        <div className="flex items-center gap-3 text-xs text-white/40">
                                                            <span className="font-mono">{commit.shortHash}</span>
                                                            <span>{commit.author}</span>
                                                            <span>{new Date(commit.date).toLocaleDateString()}</span>
                                                        </div>
                                                    </div>
                                                    <div className="shrink-0">
                                                        <DiffStats additions={commit.additions} deletions={commit.deletions} loading={incomingStatsLoading} />
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                {incomingCommits.length > ITEMS_PER_PAGE && (
                                    <div className="mt-4 flex items-center justify-between border-t border-white/5 pt-4">
                                        <span className="text-xs text-white/40">
                                            Showing {((pullsPage - 1) * ITEMS_PER_PAGE) + 1}-{Math.min(pullsPage * ITEMS_PER_PAGE, incomingCommits.length)} of {incomingCommits.length}
                                        </span>
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() => setPullsPage((p: number) => Math.max(1, p - 1))}
                                                disabled={pullsPage === 1}
                                                className="px-3 py-1.5 text-xs font-medium rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                                            >
                                                Previous
                                            </button>
                                            <span className="px-2 text-xs text-white/60">
                                                {pullsPage} / {Math.ceil(incomingCommits.length / ITEMS_PER_PAGE)}
                                            </span>
                                            <button
                                                onClick={() => setPullsPage((p: number) => Math.min(Math.ceil(incomingCommits.length / ITEMS_PER_PAGE), p + 1))}
                                                disabled={pullsPage >= Math.ceil(incomingCommits.length / ITEMS_PER_PAGE)}
                                                className="px-3 py-1.5 text-xs font-medium rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                                            >
                                                Next
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </>
                        ) : (
                            <div className="flex flex-col items-center justify-center py-24 text-white/30">
                                <ArrowDownCircle size={48} className="mb-4 opacity-50" />
                                <p>No incoming commits</p>
                                <p className="text-xs opacity-50">Your branch is not behind its upstream.</p>
                            </div>
                        )}
                    </>
                    ) : gitView === 'history' ? (
                        historyLoading && visibleHistorySource.length === 0 ? (
                            <div className="flex items-center justify-center py-24 text-white/30">
                                <RefreshCw size={24} className="animate-spin mb-2" />
                                <p className="text-xs">Loading history...</p>
                            </div>
                        ) : visibleHistorySource.length > 0 ? (
                        <>
                            <GitGraph
                                commits={visibleHistoryCommits}
                                laneSourceCommits={visibleHistorySource}
                                onCommitClick={handleCommitClick}
                                localOnlyCommitHashes={localOnlyCommitHashes}
                                hasRemote={hasRemote}
                                remoteHeadCommitHash={remoteHeadCommitHash}
                            />
                            {(effectiveHistoryTotalCount > COMMITS_PER_PAGE || historyHasMore || loadingMoreHistory) && (
                                <div className="flex items-center justify-between pt-4 mt-4 border-t border-white/5">
                                    <span className="text-xs text-white/40">
                                        Showing {((commitPage - 1) * COMMITS_PER_PAGE) + 1}-{Math.min(commitPage * COMMITS_PER_PAGE, effectiveHistoryTotalCount)} of {effectiveHistoryTotalCount}
                                    </span>
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => setCommitPage((p: number) => Math.max(1, p - 1))}
                                            disabled={commitPage === 1}
                                            className="px-3 py-1.5 text-xs font-medium rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                                        >
                                            Previous
                                        </button>
                                        <span className="text-xs text-white/60 px-2">
                                            {commitPage} / {totalHistoryPages}
                                        </span>
                                        <button
                                            onClick={() => { void handleNextHistoryPage() }}
                                            disabled={loadingMoreHistory || (!historyHasMore && commitPage >= totalHistoryPages)}
                                            className="px-3 py-1.5 text-xs font-medium rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                                        >
                                            {loadingMoreHistory ? 'Loading…' : commitPage >= totalHistoryPages && historyHasMore ? 'Load More' : 'Next'}
                                        </button>
                                    </div>
                                </div>
                            )}
                            {loadingMoreHistory && (
                                <div className="mt-3 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-xs text-white/55">
                                    <div className="flex items-center gap-2">
                                        <RefreshCw size={12} className="animate-spin text-[var(--accent-primary)]" />
                                        <span>Loading more history...</span>
                                    </div>
                                </div>
                            )}
                        </>
                    ) : (
                        <div className="flex flex-col items-center justify-center py-24 text-white/30">
                            <GitBranch size={48} className="mb-4 opacity-50" />
                            <p>No commit history found</p>
                        </div>
                    )
                    ) : null}
            </div>
            <PullRequestModal
                isOpen={showPullRequestModal}
                onClose={() => setShowPullRequestModal(false)}
                projectName={project?.displayName || project?.name || 'Project'}
                projectPath={decodedPath}
                currentBranch={currentBranch}
                branches={branches}
                remotes={remotes || []}
                unstagedFiles={unstagedFiles}
                stagedFiles={stagedFiles}
                unpushedCommits={unpushedCommits}
                githubPublishContext={githubPublishContext}
                settings={settings}
                updateSettings={updateSettings}
                showToast={showToast}
                onCommitClick={handleCommitClick}
            />
            {showRepoInfoModal ? (
                <div
                    className="absolute inset-0 z-30 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
                    onClick={() => setShowRepoInfoModal(false)}
                >
                    <div
                        className="w-full max-w-3xl rounded-2xl border border-white/10 bg-sparkle-card shadow-2xl"
                        onClick={(event) => event.stopPropagation()}
                    >
                        <div className="flex items-center justify-between border-b border-white/10 bg-white/[0.03] px-5 py-4">
                            <div>
                                <h3 className="text-sm font-semibold text-white">Repo Info</h3>
                                <p className="mt-1 text-xs text-white/45">Current remote links and sync actions.</p>
                            </div>
                            <button
                                onClick={() => setShowRepoInfoModal(false)}
                                className="rounded-lg p-1 text-white/40 transition-colors hover:bg-white/10 hover:text-white"
                            >
                                <X size={18} />
                            </button>
                        </div>
                        <div className="space-y-4 p-5">
                            <div className="grid gap-3 md:grid-cols-2">
                                <div className="rounded-xl border border-white/10 bg-black/20 p-4">
                                    <p className="text-[11px] uppercase tracking-wide text-white/40">Origin Repo</p>
                                    <p className="mt-1 truncate text-sm font-medium text-white/85" title={originRepoDisplay}>{originRepoDisplay}</p>
                                    <p className="mt-1 truncate text-xs text-white/45" title={originRemoteUrl}>{originRemoteUrl || 'Not configured'}</p>
                                    <div className="mt-3 flex flex-wrap gap-2">
                                        {originRemoteUrl ? (
                                            <>
                                                <button
                                                    onClick={() => window.open(originRemoteUrl.replace(/\.git$/i, ''), '_blank', 'noopener,noreferrer')}
                                                    className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs text-white/75 transition-colors hover:border-white/20 hover:bg-white/[0.05] hover:text-white"
                                                >
                                                    <ExternalLink size={12} />
                                                    Open
                                                </button>
                                                <button
                                                    onClick={() => { void handleCopyRepoValue(originRemoteUrl, 'Origin URL') }}
                                                    className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs text-white/75 transition-colors hover:border-white/20 hover:bg-white/[0.05] hover:text-white"
                                                >
                                                    <Copy size={12} />
                                                    Copy URL
                                                </button>
                                            </>
                                        ) : null}
                                    </div>
                                </div>
                                <div className="rounded-xl border border-white/10 bg-black/20 p-4">
                                    <p className="text-[11px] uppercase tracking-wide text-white/40">Upstream Repo</p>
                                    <p className="mt-1 truncate text-sm font-medium text-white/85" title={upstreamRepoDisplay}>{upstreamRepoDisplay}</p>
                                    <p className="mt-1 truncate text-xs text-white/45" title={upstreamRemoteUrl || githubPublishContext?.upstream?.htmlUrl || ''}>
                                        {upstreamRemoteUrl || githubPublishContext?.upstream?.htmlUrl || 'Not configured'}
                                    </p>
                                    <div className="mt-3 flex flex-wrap gap-2">
                                        {githubPublishContext?.upstream?.htmlUrl ? (
                                            <button
                                                onClick={() => window.open(githubPublishContext.upstream!.htmlUrl, '_blank', 'noopener,noreferrer')}
                                                className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs text-white/75 transition-colors hover:border-white/20 hover:bg-white/[0.05] hover:text-white"
                                            >
                                                <ExternalLink size={12} />
                                                Open
                                            </button>
                                        ) : null}
                                        {repoUsesForkOrigin ? (
                                            <button
                                                onClick={() => { void ensureUpstreamRemote() }}
                                                className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs text-white/75 transition-colors hover:border-white/20 hover:bg-white/[0.05] hover:text-white"
                                            >
                                                <Link size={12} />
                                                Link Upstream
                                            </button>
                                        ) : null}
                                    </div>
                                </div>
                            </div>

                            <div className="rounded-xl border border-white/10 bg-black/20 p-4">
                                <p className="text-[11px] uppercase tracking-wide text-white/40">Flow</p>
                                <p className="mt-1 text-sm font-medium text-white/85">{repoFlowSummary}</p>
                                <p className="mt-1 text-xs text-white/45">
                                    {repoUsesForkOrigin
                                        ? 'Origin is your fork, and upstream is the original repository used for sync and PR targeting.'
                                        : 'This repo is tracking its configured remote branch directly.'}
                                </p>
                            </div>

                            <div className="rounded-xl border border-white/10 bg-black/20 p-4">
                                <p className="text-[11px] uppercase tracking-wide text-white/40">Quick Actions</p>
                                <div className="mt-3 flex flex-wrap gap-2">
                                    {repoUsesForkOrigin ? (
                                        <button
                                            onClick={() => { void handleSyncFromUpstream() }}
                                            disabled={isPulling}
                                            className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-xs font-medium text-white/80 transition-colors hover:border-white/20 hover:bg-white/[0.05] disabled:cursor-not-allowed disabled:opacity-40"
                                        >
                                            <ArrowDownCircle size={12} />
                                            Sync Fork
                                        </button>
                                    ) : null}
                                    <button
                                        onClick={() => void refreshGitHubPublishContext()}
                                        className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-xs font-medium text-white/80 transition-colors hover:border-white/20 hover:bg-white/[0.05]"
                                    >
                                        <RefreshCw size={12} />
                                        Refresh Repo Info
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            ) : null}
        </div>
    )
}
