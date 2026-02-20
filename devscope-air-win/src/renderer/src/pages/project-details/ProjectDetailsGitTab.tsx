import { Check, GitBranch, GitCommitHorizontal, GitPullRequest, RefreshCw, User } from 'lucide-react'
import { cn } from '@/lib/utils'
import { WorkingChangesView } from './WorkingChangesView'
import { GitGraph } from './GitGraph'
import { ProjectDetailsGitManageView } from './ProjectDetailsGitManageView'

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
        unpushedCommits,
        refreshGitData,
        loadingGit,
        decodedPath,
        changesPage,
        setChangesPage,
        ITEMS_PER_PAGE,
        handleCommitClick,
        unpushedPage,
        setUnpushedPage,
        COMMITS_PER_PAGE,
        commitPage,
        setCommitPage,
        gitHistory
    } = props

    return (
        <div className="flex flex-col h-full">
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
                        "px-3 py-1.5 text-xs font-medium rounded-lg transition-colors border border-transparent whitespace-nowrap",
                        gitView === 'manage'
                            ? "bg-white/10 text-white border-white/5"
                            : "text-white/50 hover:text-white hover:bg-white/5"
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
                        "px-3 py-1.5 text-xs font-medium rounded-lg transition-colors border border-transparent whitespace-nowrap",
                        gitView === 'changes'
                            ? "bg-white/10 text-white border-white/5"
                            : "text-white/50 hover:text-white hover:bg-white/5"
                    )}
                >
                    Working Changes ({changedFiles.length})
                </button>
                <button
                    onClick={() => setGitView('unpushed')}
                    className={cn(
                        "px-3 py-1.5 text-xs font-medium rounded-lg transition-colors border border-transparent whitespace-nowrap",
                        gitView === 'unpushed'
                            ? "bg-white/10 text-white border-white/5"
                            : "text-white/50 hover:text-white hover:bg-white/5"
                    )}
                >
                    To Push ({unpushedCommits.length})
                </button>
                <button
                    onClick={() => setGitView('history')}
                    className={cn(
                        "px-3 py-1.5 text-xs font-medium rounded-lg transition-colors border border-transparent whitespace-nowrap",
                        gitView === 'history'
                            ? "bg-white/10 text-white border-white/5"
                            : "text-white/50 hover:text-white hover:bg-white/5"
                    )}
                >
                    History
                </button>
                <button
                    onClick={() => void refreshGitData(true)}
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
                    changedFiles.length > 0 ? (
                        <WorkingChangesView
                            files={changedFiles}
                            projectPath={decodedPath}
                            currentPage={changesPage}
                            onPageChange={setChangesPage}
                        />
                    ) : (
                        <div className="flex flex-col items-center justify-center py-24 text-white/30">
                            <Check size={48} className="mb-4 opacity-50 text-green-400" />
                            <p>No local changes</p>
                            <p className="text-xs opacity-50">Working tree is clean</p>
                        </div>
                    )
                ) : gitView === 'unpushed' ? (
                    unpushedCommits.length > 0 ? (
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
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium text-white/90 mb-1">{commit.message}</p>
                                                <div className="flex items-center gap-3 text-xs text-white/40">
                                                    <span className="font-mono">{commit.shortHash}</span>
                                                    <span>{commit.author}</span>
                                                    <span>{new Date(commit.date).toLocaleDateString()}</span>
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
                    )
                ) : gitView === 'history' ? (
                    loadingGit ? (
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
