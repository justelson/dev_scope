import { ArrowDownCircle, Link, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'
import { DiffStats } from './DiffStats'

export function ProjectDetailsGitPullsView(props: any) {
    const {
        repoUsesForkOrigin,
        incomingStatsLoading,
        gitSyncStatus,
        currentBranch,
        originRepoDisplay,
        upstreamRepoDisplay,
        isFetching,
        activeFetchTarget,
        canFetchOrigin,
        showFetchUpstreamButton,
        canSyncFromUpstream,
        isPulling,
        hasRemote,
        shouldHighlightPull,
        pullStatusItems,
        lastFetched,
        lastPulled,
        pagedIncomingCommits,
        incomingCommits,
        pullsPage,
        setPullsPage,
        ITEMS_PER_PAGE,
        handleFetchOrigin,
        handleFetchUpstream,
        handleSyncFromUpstream,
        handlePull,
        handleCommitClick
    } = props

    return (
        <>
            <div className={cn('mb-4 grid grid-cols-2 gap-2', repoUsesForkOrigin ? 'xl:grid-cols-5' : 'xl:grid-cols-4')}>
                <div className="min-w-0 rounded-xl border border-white/10 bg-black/20 p-3">
                    <p className="text-[11px] uppercase tracking-wide text-white/40">Current Branch</p>
                    <p className="mt-1 truncate text-sm font-medium text-white/85" title={incomingStatsLoading ? 'Loading...' : (gitSyncStatus?.currentBranch || currentBranch || 'Unknown')}>
                        {incomingStatsLoading ? 'Loading...' : (gitSyncStatus?.currentBranch || currentBranch || 'Unknown')}
                    </p>
                </div>
                <div className="min-w-0 rounded-xl border border-white/10 bg-black/20 p-3">
                    <p className="text-[11px] uppercase tracking-wide text-white/40">Tracked Branch</p>
                    <p className="mt-1 truncate text-sm font-medium text-white/85" title={incomingStatsLoading ? 'Loading...' : (gitSyncStatus?.upstreamBranch || 'Not configured')}>
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
                                    shouldHighlightPull ? 'bg-white/[0.08] hover:bg-white/[0.12]' : 'bg-white/[0.03] hover:bg-white/[0.05]'
                                )}
                            >
                                {isPulling ? <RefreshCw size={14} className="animate-spin" /> : <ArrowDownCircle size={14} />}
                                Pull Latest
                            </button>
                        )}
                    </div>
                </div>
                <div className="flex items-center justify-between gap-4 text-xs text-white/45">
                    <span>{lastFetched ? `Last fetched: ${new Date(lastFetched).toLocaleString()}` : 'Never fetched'}</span>
                    <span>{lastPulled ? `Last pulled: ${new Date(lastPulled).toLocaleString()}` : 'Never pulled'}</span>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                    {pullStatusItems.map((item: string) => (
                        <span key={item} className={cn('rounded-full border px-2.5 py-1 text-[11px]', item === 'Ready to pull' ? 'border-emerald-400/25 bg-emerald-400/10 text-emerald-200/85' : 'border-white/10 bg-white/[0.03] text-white/55')}>
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
                            <div key={commit.hash} onClick={() => handleCommitClick(commit)} className="cursor-pointer rounded-xl border border-white/5 bg-black/30 p-4 transition-colors hover:bg-white/5">
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
                                <button onClick={() => setPullsPage((p: number) => Math.max(1, p - 1))} disabled={pullsPage === 1} className="px-3 py-1.5 text-xs font-medium rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-all">Previous</button>
                                <span className="px-2 text-xs text-white/60">{pullsPage} / {Math.ceil(incomingCommits.length / ITEMS_PER_PAGE)}</span>
                                <button onClick={() => setPullsPage((p: number) => Math.min(Math.ceil(incomingCommits.length / ITEMS_PER_PAGE), p + 1))} disabled={pullsPage >= Math.ceil(incomingCommits.length / ITEMS_PER_PAGE)} className="px-3 py-1.5 text-xs font-medium rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-all">Next</button>
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
    )
}
