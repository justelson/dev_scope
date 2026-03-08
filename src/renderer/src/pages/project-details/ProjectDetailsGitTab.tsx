import { useMemo } from 'react'
import { AlertCircle, ArrowDownCircle, GitBranch, GitCommitHorizontal, GitPullRequest, Link, Plus, RefreshCw, User } from 'lucide-react'
import { cn } from '@/lib/utils'
import { WorkingChangesView } from './WorkingChangesView'
import { GitGraph } from './GitGraph'
import { ProjectDetailsGitManageView } from './ProjectDetailsGitManageView'
import { DiffStats } from './DiffStats'

interface ProjectDetailsGitTabProps {
    lastFetched?: number
    lastPulled?: number
    [key: string]: any
}

function getRefreshModeForGitView(gitView: 'changes' | 'history' | 'unpushed' | 'pulls' | 'manage') {
    if (gitView === 'changes') return 'working'
    if (gitView === 'unpushed') return 'unpushed'
    if (gitView === 'pulls') return 'pulls'
    return 'full'
}

export function ProjectDetailsGitTab(props: ProjectDetailsGitTabProps) {
    const {
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
        unpushedPage,
        setUnpushedPage,
        pullsPage,
        setPullsPage,
        ITEMS_PER_PAGE,
        COMMITS_PER_PAGE,
        commitPage,
        setCommitPage,
        gitHistory,
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
        isPulling
    } = props

    const currentBranchMeta = branches.find((branch: any) => branch.name === currentBranch)
    const currentBranchNeedsPublish = Boolean(
        hasRemote === true
        && currentBranch
        && currentBranchMeta
        && currentBranchMeta.isLocal !== false
        && !currentBranchMeta.isRemote
    )
    const showPushAction = hasRemote === true && (unpushedCommits.length > 0 || currentBranchNeedsPublish)
    const visibleHistorySource = gitHistory
    const historyPageStart = Math.max(0, (commitPage - 1) * COMMITS_PER_PAGE)
    const historyPageEnd = Math.max(historyPageStart, commitPage * COMMITS_PER_PAGE)
    const visibleHistoryCommits = useMemo(
        () => visibleHistorySource.slice(historyPageStart, historyPageEnd),
        [visibleHistorySource, historyPageStart, historyPageEnd]
    )
    const visibleLaneSourceCommits = useMemo(
        () => visibleHistorySource.slice(0, Math.min(visibleHistorySource.length, historyPageEnd)),
        [visibleHistorySource, historyPageEnd]
    )
    const isLargeHistory = visibleHistorySource.length > COMMITS_PER_PAGE * 8
    const gitCountsLoading = loadingGit && !gitError
    const unpushedStatsLoading = gitCountsLoading && unpushedCommits.length === 0
    const incomingStatsLoading = gitCountsLoading && incomingCommits.length === 0 && !gitSyncStatus
    const historyLoading = loadingGitHistory && !gitError
    const historyRefreshing = historyLoading && visibleHistorySource.length > 0
    const hasFetchedSinceLastPull = Boolean(
        props.lastFetched
        && (!props.lastPulled || props.lastFetched > props.lastPulled)
    )
    const shouldHighlightPull = hasFetchedSinceLastPull && (gitSyncStatus?.behind || 0) > 0
    const pagedIncomingCommits = useMemo(
        () => incomingCommits.slice((pullsPage - 1) * ITEMS_PER_PAGE, pullsPage * ITEMS_PER_PAGE),
        [incomingCommits, pullsPage, ITEMS_PER_PAGE]
    )

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
                                <p className="text-sm font-medium text-white/80">{gitUser.name}</p>
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
                    onClick={() => void refreshGitData(false, { mode: getRefreshModeForGitView(gitView) })}
                    disabled={gitView === 'history' ? historyLoading : loadingGit}
                    className="ml-auto px-3 py-1.5 text-xs font-medium rounded-lg transition-colors border border-white/10 text-white/70 hover:text-white hover:bg-white/5 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                >
                    <span className="flex items-center gap-1.5">
                        <RefreshCw size={12} className={cn((gitView === 'history' ? historyLoading : loadingGit) && 'animate-spin')} />
                        Refresh Git
                    </span>
                </button>
            </div>

            <div className="project-surface-scrollbar p-4 flex-1 overflow-y-auto">
                {gitView === 'manage' ? (
                    <ProjectDetailsGitManageView {...props} />
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
                                    {currentBranchNeedsPublish ? 'Publish Branch' : 'Push to Remote'}
                                </h3>
                                <p className="text-xs text-white/50 mb-3">
                                    {currentBranchNeedsPublish
                                        ? `Current branch "${currentBranch}" has no upstream branch on origin yet.`
                                        : unpushedStatsLoading
                                            ? 'Loading unpushed commit summary...'
                                            : `You have ${unpushedCommits.length} unpushed ${unpushedCommits.length === 1 ? 'commit' : 'commits'}.`}
                                </p>
                                <button
                                    onClick={() => { void handlePush(currentBranchNeedsPublish ? 'publish' : 'push') }}
                                    disabled={isPushing || hasRemote !== true}
                                    className="w-full px-4 py-2.5 bg-blue-500/20 hover:bg-blue-500/30 disabled:opacity-50 disabled:cursor-not-allowed text-blue-400 text-sm font-medium rounded-lg transition-all flex items-center justify-center gap-2 border border-blue-500/30"
                                >
                                    {isPushing ? (
                                        <>
                                            <RefreshCw size={16} className="animate-spin" />
                                            Pushing...
                                        </>
                                    ) : (
                                        <>
                                            <GitPullRequest size={16} />
                                            {currentBranchNeedsPublish ? 'Publish Branch' : 'Push Commits'}
                                        </>
                                    )}
                                </button>
                            </div>
                        )}

                        {unpushedCommits.length > 0 ? (
                            <>
                                <div className="space-y-2">
                                    {unpushedCommits.slice((unpushedPage - 1) * ITEMS_PER_PAGE, unpushedPage * ITEMS_PER_PAGE).map((commit: any) => (
                                        <div
                                            key={commit.hash}
                                            onClick={() => handleCommitClick(commit)}
                                            className="bg-black/30 rounded-xl border border-white/5 p-4 hover:bg-white/5 cursor-pointer transition-colors"
                                        >
                                            <div className="flex items-start gap-3">
                                                <GitCommitHorizontal size={16} className="text-blue-400 mt-0.5" />
                                                <div className="flex-1 min-w-0 flex items-start justify-between gap-3">
                                                    <div className="min-w-0">
                                                        <p className="text-sm font-medium text-white/90 mb-1 truncate">{commit.message}</p>
                                                        <div className="flex items-center gap-3 text-xs text-white/40">
                                                            <span className="font-mono">{commit.shortHash}</span>
                                                            <span>{commit.author}</span>
                                                            <span>{new Date(commit.date).toLocaleDateString()}</span>
                                                        </div>
                                                    </div>
                                                    <div className="shrink-0">
                                                        <DiffStats additions={commit.additions} deletions={commit.deletions} loading={unpushedStatsLoading} />
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                {unpushedCommits.length > ITEMS_PER_PAGE && (
                                    <div className="flex items-center justify-between pt-4 mt-4 border-t border-white/5">
                                        <span className="text-xs text-white/40">
                                            Showing {((unpushedPage - 1) * ITEMS_PER_PAGE) + 1}-{Math.min(unpushedPage * ITEMS_PER_PAGE, unpushedCommits.length)} of {unpushedCommits.length}
                                        </span>
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() => setUnpushedPage((p: number) => Math.max(1, p - 1))}
                                                disabled={unpushedPage === 1}
                                                className="px-3 py-1.5 text-xs font-medium rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                                            >
                                                Previous
                                            </button>
                                            <span className="text-xs text-white/60 px-2">
                                                {unpushedPage} / {Math.ceil(unpushedCommits.length / ITEMS_PER_PAGE)}
                                            </span>
                                            <button
                                                onClick={() => setUnpushedPage((p: number) => Math.min(Math.ceil(unpushedCommits.length / ITEMS_PER_PAGE), p + 1))}
                                                disabled={unpushedPage >= Math.ceil(unpushedCommits.length / ITEMS_PER_PAGE)}
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
                                <GitPullRequest size={48} className="mb-4 opacity-50" />
                                <p>No unpushed commits</p>
                                <p className="text-xs opacity-50">All commits are synced</p>
                            </div>
                        )}
                    </>
                ) : gitView === 'pulls' ? (
                    <>
                        <div className="mb-4 grid gap-3 md:grid-cols-4">
                            <div className="rounded-xl border border-white/10 bg-black/20 p-4">
                                <p className="text-[11px] uppercase tracking-wide text-white/40">Current Branch</p>
                                <p className="mt-1 text-sm font-medium text-white/85">
                                    {incomingStatsLoading ? 'Loading...' : (gitSyncStatus?.currentBranch || currentBranch || 'Unknown')}
                                </p>
                            </div>
                            <div className="rounded-xl border border-white/10 bg-black/20 p-4">
                                <p className="text-[11px] uppercase tracking-wide text-white/40">Upstream</p>
                                <p className="mt-1 text-sm font-medium text-white/85">
                                    {incomingStatsLoading ? 'Loading...' : (gitSyncStatus?.upstreamBranch || 'Not configured')}
                                </p>
                            </div>
                            <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-4">
                                <p className="text-[11px] uppercase tracking-wide text-blue-300/70">Ahead</p>
                                <p className="mt-1 text-xl font-semibold text-blue-300">{incomingStatsLoading ? '...' : (gitSyncStatus?.ahead || 0)}</p>
                            </div>
                            <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
                                <p className="text-[11px] uppercase tracking-wide text-amber-300/70">Behind</p>
                                <p className="mt-1 text-xl font-semibold text-amber-300">{incomingStatsLoading ? '...' : (gitSyncStatus?.behind || 0)}</p>
                            </div>
                        </div>

                        <div className="mb-4 rounded-xl border border-white/10 bg-black/20 p-4">
                            <div className="flex items-center justify-between gap-4 mb-3">
                                <button
                                    onClick={() => { void handleFetch() }}
                                    disabled={isFetching || hasRemote !== true}
                                    className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-4 py-2 text-sm text-white/75 transition-all hover:border-white/20 hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                                >
                                    {isFetching ? <RefreshCw size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                                    Fetch
                                </button>
                                <button
                                    onClick={() => { void handlePull() }}
                                    disabled={isPulling || hasRemote !== true || (gitSyncStatus?.behind || 0) === 0}
                                    className={cn(
                                        'inline-flex items-center gap-2 rounded-lg border border-white/10 px-4 py-2 text-sm transition-all hover:border-white/20 disabled:cursor-not-allowed disabled:opacity-40',
                                        shouldHighlightPull
                                            ? 'bg-emerald-400/15 text-emerald-100 hover:bg-emerald-400/25'
                                            : 'bg-[var(--accent-primary)]/15 text-white hover:bg-[var(--accent-primary)]/25'
                                    )}
                                >
                                    {isPulling ? <RefreshCw size={14} className="animate-spin" /> : <ArrowDownCircle size={14} />}
                                    Pull Latest
                                </button>
                            </div>
                            <div className="flex items-center justify-between gap-4 text-xs text-white/45">
                                <span>
                                    {props.lastFetched ? `Last fetched: ${new Date(props.lastFetched).toLocaleString()}` : 'Never fetched'}
                                </span>
                                <span>
                                    {props.lastPulled ? `Last pulled: ${new Date(props.lastPulled).toLocaleString()}` : 'Never pulled'}
                                </span>
                            </div>
                            <div className="mt-2 text-xs text-white/45">
                                {incomingStatsLoading
                                    ? 'Loading sync status...'
                                    : gitSyncStatus?.workingTreeChanged
                                    ? `Working tree has ${gitSyncStatus.workingTreeChangeCount} local change${gitSyncStatus.workingTreeChangeCount === 1 ? '' : 's'}.`
                                    : 'Working tree is clean.'}
                            </div>
                            {shouldHighlightPull && (
                                <div className="mt-2 text-xs text-emerald-200/80">
                                    Remote updates were fetched and are ready to pull.
                                </div>
                            )}
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
                            {historyRefreshing && (
                                <div className="mb-4 flex items-center gap-2 rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-xs text-white/55">
                                    <RefreshCw size={12} className="animate-spin text-[var(--accent-primary)]" />
                                    Refreshing history...
                                </div>
                            )}
                            {isLargeHistory && (
                                <div className="mb-4 rounded-xl border border-white/5 bg-black/20 px-4 py-3 text-xs text-white/45">
                                    Rendering the graph with page-local history context to keep large repositories smooth.
                                </div>
                            )}
                            <GitGraph
                                commits={visibleHistoryCommits}
                                laneSourceCommits={visibleLaneSourceCommits}
                                onCommitClick={handleCommitClick}
                            />
                            {visibleHistorySource.length > COMMITS_PER_PAGE && (
                                <div className="flex items-center justify-between pt-4 mt-4 border-t border-white/5">
                                    <span className="text-xs text-white/40">
                                        Showing {((commitPage - 1) * COMMITS_PER_PAGE) + 1}-{Math.min(commitPage * COMMITS_PER_PAGE, visibleHistorySource.length)} of {visibleHistorySource.length}
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
                                            {commitPage} / {Math.ceil(visibleHistorySource.length / COMMITS_PER_PAGE)}
                                        </span>
                                        <button
                                            onClick={() => setCommitPage((p: number) => Math.min(Math.ceil(visibleHistorySource.length / COMMITS_PER_PAGE), p + 1))}
                                            disabled={commitPage >= Math.ceil(visibleHistorySource.length / COMMITS_PER_PAGE)}
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
                            <GitBranch size={48} className="mb-4 opacity-50" />
                            <p>No commit history found</p>
                        </div>
                    )
                ) : null}
            </div>
        </div>
    )
}
