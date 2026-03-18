import { ArrowDownCircle, Copy, ExternalLink, Link, RefreshCw, X } from 'lucide-react'

export function ProjectDetailsRepoInfoModal(props: any) {
    const {
        open,
        onClose,
        originRepoDisplay,
        originRemoteUrl,
        upstreamRepoDisplay,
        upstreamRemoteUrl,
        githubPublishContext,
        repoUsesForkOrigin,
        ensureUpstreamRemote,
        repoFlowSummary,
        handleSyncFromUpstream,
        isPulling,
        refreshGitHubPublishContext,
        handleCopyRepoValue
    } = props

    if (!open) return null

    return (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" onClick={onClose}>
            <div className="w-full max-w-3xl rounded-2xl border border-white/10 bg-sparkle-card shadow-2xl" onClick={(event) => event.stopPropagation()}>
                <div className="flex items-center justify-between border-b border-white/10 bg-white/[0.03] px-5 py-4">
                    <div>
                        <h3 className="text-sm font-semibold text-white">Repo Info</h3>
                        <p className="mt-1 text-xs text-white/45">Current remote links and sync actions.</p>
                    </div>
                    <button onClick={onClose} className="rounded-lg p-1 text-white/40 transition-colors hover:bg-white/10 hover:text-white">
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
                                        <button onClick={() => window.open(originRemoteUrl.replace(/\.git$/i, ''), '_blank', 'noopener,noreferrer')} className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs text-white/75 transition-colors hover:border-white/20 hover:bg-white/[0.05] hover:text-white">
                                            <ExternalLink size={12} />
                                            Open
                                        </button>
                                        <button onClick={() => { void handleCopyRepoValue(originRemoteUrl, 'Origin URL') }} className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs text-white/75 transition-colors hover:border-white/20 hover:bg-white/[0.05] hover:text-white">
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
                                    <button onClick={() => window.open(githubPublishContext.upstream.htmlUrl, '_blank', 'noopener,noreferrer')} className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs text-white/75 transition-colors hover:border-white/20 hover:bg-white/[0.05] hover:text-white">
                                        <ExternalLink size={12} />
                                        Open
                                    </button>
                                ) : null}
                                {repoUsesForkOrigin ? (
                                    <button onClick={() => { void ensureUpstreamRemote() }} className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs text-white/75 transition-colors hover:border-white/20 hover:bg-white/[0.05] hover:text-white">
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
                                <button onClick={() => { void handleSyncFromUpstream() }} disabled={isPulling} className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-xs font-medium text-white/80 transition-colors hover:border-white/20 hover:bg-white/[0.05] disabled:cursor-not-allowed disabled:opacity-40">
                                    <ArrowDownCircle size={12} />
                                    Sync Fork
                                </button>
                            ) : null}
                            <button onClick={() => void refreshGitHubPublishContext()} className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-xs font-medium text-white/80 transition-colors hover:border-white/20 hover:bg-white/[0.05]">
                                <RefreshCw size={12} />
                                Refresh Repo Info
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
