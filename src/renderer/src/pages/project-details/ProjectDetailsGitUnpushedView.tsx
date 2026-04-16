import { GitPullRequest, Link, Plus } from 'lucide-react'
import { GitGraph } from './GitGraph'

type InitStepSetter = (step: string) => void
type BoolSetter = (value: boolean) => void

export function ProjectDetailsGitUnpushedView(props: {
    hasRemote: boolean | null
    setInitStep: InitStepSetter
    setShowInitModal: BoolSetter
    showPushAction: boolean
    unpushedStatsLoading: boolean
    currentBranchNeedsPublish: boolean
    compactPushSummaryLines: string[]
    hasGitHubRemote: boolean
    pullRequestActionLabel: string
    pullRequestActionHint: string
    pullRequestActionDisabled: boolean
    onOpenCreatePullRequest: () => void
    unpushedCommits: any[]
    onCommitClick: (commit: any) => void
    localOnlyCommitHashes: Set<string>
}) {
    const {
        hasRemote,
        setInitStep,
        setShowInitModal,
        showPushAction,
        unpushedStatsLoading,
        currentBranchNeedsPublish,
        compactPushSummaryLines,
        hasGitHubRemote,
        pullRequestActionLabel,
        pullRequestActionHint,
        pullRequestActionDisabled,
        onOpenCreatePullRequest,
        unpushedCommits,
        onCommitClick,
        localOnlyCommitHashes
    } = props

    return (
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
                            ? pullRequestActionHint
                            : 'These commits stay local until you push them with your normal Git remote workflow.'}
                    </div>
                    <div className="mt-3 flex justify-end">
                        <button
                            onClick={onOpenCreatePullRequest}
                            disabled={pullRequestActionDisabled}
                            className="inline-flex items-center gap-2 rounded-lg bg-[var(--accent-primary)]/16 px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-[var(--accent-primary)]/24 disabled:cursor-not-allowed disabled:bg-white/[0.04] disabled:text-white/35"
                        >
                            <GitPullRequest size={14} />
                            {hasGitHubRemote ? pullRequestActionLabel : 'GitHub Remote Required'}
                        </button>
                    </div>
                </div>
            )}

            {unpushedCommits.length > 0 ? (
                <GitGraph
                    commits={unpushedCommits}
                    laneSourceCommits={unpushedCommits}
                    onCommitClick={onCommitClick}
                    localOnlyCommitHashes={localOnlyCommitHashes}
                    hasRemote={hasRemote}
                    remoteHeadCommitHash={null}
                />
            ) : (
                <div className="flex flex-col items-center justify-center py-24 text-white/30">
                    <GitPullRequest size={48} className="mb-4 opacity-50" />
                    <p>No unpushed commits</p>
                    <p className="text-xs opacity-50">All commits are synced</p>
                </div>
            )}
        </>
    )
}
