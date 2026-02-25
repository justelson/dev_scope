import { AlertCircle, GitBranch, GitCommitHorizontal, GitPullRequest, Link, Plus, RefreshCw, User } from 'lucide-react'
import { cn } from '@/lib/utils'
import { WorkingChangesView } from './WorkingChangesView'
import { GitGraph } from './GitGraph'
import { ProjectDetailsGitManageView } from './ProjectDetailsGitManageView'
import { DiffStats } from './DiffStats'

interface ProjectDetailsGitTabProps {
    [key: string]: any
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
        refreshGitData,
        loadingGit,
        gitError,
        decodedPath,
        handleCommitClick,
        unpushedPage,
        setUnpushedPage,
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
        isPushing
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
                    onClick={() => void refreshGitData(false)}
                    disabled={loadingGit}
                    className="ml-auto px-3 py-1.5 text-xs font-medium rounded-lg transition-colors border border-white/10 text-white/70 hover:text-white hover:bg-white/5 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                >
                    <span className="flex items-center gap-1.5">
                        <RefreshCw size={12} className={cn(loadingGit && 'animate-spin')} />
                        Refresh Git
                    </span>
                </button>
            </div>

            <div className="p-4 flex-1 overflow-y-auto custom-scrollbar">
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
                                                        <DiffStats additions={commit.additions} deletions={commit.deletions} />
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
                ) : gitView === 'history' ? (
                    loadingGit && gitHistory.length === 0 ? (
                        <div className="flex items-center justify-center py-24 text-white/30">
                            <RefreshCw size={24} className="animate-spin mb-2" />
                            <p className="text-xs">Loading history...</p>
                        </div>
                    ) : gitHistory.length > 0 ? (
                        <>
                            <GitGraph
                                commits={gitHistory.slice((commitPage - 1) * COMMITS_PER_PAGE, commitPage * COMMITS_PER_PAGE)}
                                onCommitClick={handleCommitClick}
                            />
                            {gitHistory.length > COMMITS_PER_PAGE && (
                                <div className="flex items-center justify-between pt-4 mt-4 border-t border-white/5">
                                    <span className="text-xs text-white/40">
                                        Showing {((commitPage - 1) * COMMITS_PER_PAGE) + 1}-{Math.min(commitPage * COMMITS_PER_PAGE, gitHistory.length)} of {gitHistory.length}
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
                                            {commitPage} / {Math.ceil(gitHistory.length / COMMITS_PER_PAGE)}
                                        </span>
                                        <button
                                            onClick={() => setCommitPage((p: number) => Math.min(Math.ceil(gitHistory.length / COMMITS_PER_PAGE), p + 1))}
                                            disabled={commitPage >= Math.ceil(gitHistory.length / COMMITS_PER_PAGE)}
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
