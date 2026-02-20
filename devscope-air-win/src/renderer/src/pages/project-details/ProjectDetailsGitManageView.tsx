import { GitBranch, GitCommitHorizontal, GitPullRequest, Link, Plus, RefreshCw, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Select } from '@/components/ui/FormControls'

interface ProjectDetailsGitManageViewProps {
    [key: string]: any
}

export function ProjectDetailsGitManageView(props: ProjectDetailsGitManageViewProps) {
    const {
        isGitRepo,
        setShowInitModal,
        currentBranch,
        targetBranch,
        setTargetBranch,
        branches,
        isSwitchingBranch,
        handleSwitchBranch,
        changedFiles,
        commitMessage,
        setCommitMessage,
        handleGenerateCommitMessage,
        isGeneratingCommitMessage,
        isCommitting,
        settings,
        handleCommit,
        hasRemote,
        setInitStep,
        unpushedCommits,
        handlePush,
        isPushing,
        gitHistory,
        setGitView,
        remotes,
        tags,
        stashes
    } = props

    if (isGitRepo === false) {
        return (
            <div className="flex flex-col items-center justify-center py-16 px-4">
                <div className="p-6 rounded-2xl bg-white/5 border border-white/10 mb-6">
                    <GitBranch size={48} className="text-white/30" />
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">Git Not Initialized</h3>
                <p className="text-sm text-white/50 text-center mb-6 max-w-md">
                    This project is not a Git repository yet. Initialize Git to start tracking changes and collaborate with others.
                </p>
                <button
                    onClick={() => setShowInitModal(true)}
                    className="px-6 py-3 bg-[var(--accent-primary)] hover:bg-[var(--accent-primary)]/80 text-white text-sm font-medium rounded-lg transition-all flex items-center gap-2"
                >
                    <GitBranch size={18} />
                    Initialize Git Repository
                </button>
            </div>
        )
    }

    return (
        <div className="space-y-4">
            <div className="bg-black/20 rounded-xl border border-white/5 p-4">
                <div className="flex items-center justify-between gap-3 mb-3">
                    <h3 className="text-sm font-medium text-white/80 flex items-center gap-2">
                        <GitBranch size={16} />
                        Branch Switching
                    </h3>
                    <span className="text-xs text-white/40">
                        Current: <span className="font-mono text-white/70">{currentBranch || 'n/a'}</span>
                    </span>
                </div>
                <div className="flex items-center gap-2">
                    <Select
                        value={targetBranch}
                        onChange={setTargetBranch}
                        options={branches.map((branch: any) => ({
                            value: branch.name,
                            label: `${branch.current ? '* ' : ''}${branch.name}`
                        }))}
                        placeholder="No branches found"
                        disabled={branches.length === 0 || isSwitchingBranch}
                        className="flex-1"
                        size="md"
                    />
                    <button
                        onClick={handleSwitchBranch}
                        disabled={!targetBranch || targetBranch === currentBranch || isSwitchingBranch}
                        className="px-4 py-2 text-sm font-medium rounded-lg bg-[var(--accent-primary)] hover:bg-[var(--accent-primary)]/80 disabled:opacity-50 disabled:cursor-not-allowed text-white transition-all flex items-center gap-2"
                    >
                        {isSwitchingBranch ? (
                            <>
                                <RefreshCw size={14} className="animate-spin" />
                                Switching...
                            </>
                        ) : (
                            <>
                                <GitBranch size={14} />
                                Switch
                            </>
                        )}
                    </button>
                </div>
            </div>

            {changedFiles.length > 0 && (
                <div className="bg-black/20 rounded-xl border border-white/5 p-4">
                    <h3 className="text-sm font-medium text-white/80 mb-3 flex items-center gap-2">
                        <GitCommitHorizontal size={16} />
                        Create Commit
                    </h3>
                    <div className="relative">
                        <textarea
                            value={commitMessage}
                            onChange={(e) => setCommitMessage(e.target.value)}
                            placeholder="Enter commit message..."
                            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 pr-12 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[var(--accent-primary)]/50 resize-none mb-3"
                            rows={3}
                        />
                    </div>
                    <div className="mb-3 flex items-center justify-between gap-2">
                        <button
                            onClick={handleGenerateCommitMessage}
                            disabled={isGeneratingCommitMessage || isCommitting}
                            className="px-3 py-2 bg-violet-500/15 hover:bg-violet-500/25 disabled:opacity-50 disabled:cursor-not-allowed border border-violet-500/30 text-violet-300 text-xs font-medium rounded-lg transition-all flex items-center gap-2"
                        >
                            {isGeneratingCommitMessage ? (
                                <>
                                    <RefreshCw size={14} className="animate-spin" />
                                    Generating...
                                </>
                            ) : (
                                <>
                                    <Sparkles size={14} />
                                    Generate with AI
                                </>
                            )}
                        </button>
                        <span className="text-[11px] text-white/40 uppercase tracking-wide">
                            {settings.commitAIProvider}
                        </span>
                    </div>
                    <button
                        onClick={handleCommit}
                        disabled={!commitMessage.trim() || isCommitting}
                        className="w-full px-4 py-2.5 bg-[var(--accent-primary)] hover:bg-[var(--accent-primary)]/80 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-all flex items-center justify-center gap-2"
                    >
                        {isCommitting ? (
                            <>
                                <RefreshCw size={16} className="animate-spin" />
                                Committing...
                            </>
                        ) : (
                            <>
                                <GitCommitHorizontal size={16} />
                                Commit {changedFiles.length} {changedFiles.length === 1 ? 'File' : 'Files'}
                            </>
                        )}
                    </button>
                </div>
            )}

            {hasRemote === false ? (
                <div className="bg-amber-500/10 rounded-xl border border-amber-500/20 p-4">
                    <h3 className="text-sm font-medium text-amber-400 mb-3 flex items-center gap-2">
                        <Link size={16} />
                        No Remote Repository
                    </h3>
                    <p className="text-xs text-white/50 mb-3">
                        Add a remote repository to push your commits to GitHub, GitLab, or other Git hosting services.
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
            ) : unpushedCommits.length > 0 && (
                <div className="bg-black/20 rounded-xl border border-white/5 p-4">
                    <h3 className="text-sm font-medium text-white/80 mb-3 flex items-center gap-2">
                        <GitPullRequest size={16} />
                        Push to Remote
                    </h3>
                    <p className="text-xs text-white/50 mb-3">
                        You have {unpushedCommits.length} unpushed {unpushedCommits.length === 1 ? 'commit' : 'commits'}
                    </p>
                    <button
                        onClick={handlePush}
                        disabled={isPushing}
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
                                Push Commits
                            </>
                        )}
                    </button>
                </div>
            )}

            <div className="space-y-3">
                {(() => {
                    const hasWorkingChanges = changedFiles.length > 0
                    const hasUnpushedCommits = unpushedCommits.length > 0
                    const hasRecentCommits = gitHistory.length > 0
                    const visibleSummaryCards =
                        (hasWorkingChanges ? 1 : 0) +
                        (hasUnpushedCommits ? 1 : 0) +
                        (hasRecentCommits ? 1 : 0)

                    return (
                        <div className={cn(
                            "grid gap-3",
                            visibleSummaryCards >= 2 ? "grid-cols-1 md:grid-cols-2" : "grid-cols-1"
                        )}>
                            {hasWorkingChanges && (
                                <div className="bg-[#E2C08D]/5 rounded-xl border border-[#E2C08D]/20 p-4">
                                    <div className="flex items-center justify-between mb-2">
                                        <h4 className="text-sm font-medium text-[#E2C08D]">Working Changes</h4>
                                        <span className="text-xs bg-[#E2C08D]/20 text-[#E2C08D] px-2 py-0.5 rounded-full">
                                            {changedFiles.length}
                                        </span>
                                    </div>
                                    <div className="space-y-1">
                                        {changedFiles.slice(0, 3).map((file: any) => (
                                            <div key={file.path} className="flex items-center gap-2 text-xs text-white/60">
                                                <span className={cn(
                                                    "text-[9px] uppercase font-bold px-1 py-0.5 rounded",
                                                    file.gitStatus === 'modified' && "bg-[#E2C08D]/20 text-[#E2C08D]",
                                                    file.gitStatus === 'added' && "bg-[#73C991]/20 text-[#73C991]",
                                                    file.gitStatus === 'deleted' && "bg-[#FF6B6B]/20 text-[#FF6B6B]"
                                                )}>
                                                    {file.gitStatus?.substring(0, 1)}
                                                </span>
                                                <span className="truncate">{file.name}</span>
                                            </div>
                                        ))}
                                        {changedFiles.length > 3 && (
                                            <button
                                                onClick={() => setGitView('changes')}
                                                className="text-xs text-[#E2C08D] hover:underline"
                                            >
                                                +{changedFiles.length - 3} more...
                                            </button>
                                        )}
                                    </div>
                                </div>
                            )}

                            {hasUnpushedCommits && (
                                <div className="bg-blue-500/5 rounded-xl border border-blue-500/20 p-4">
                                    <div className="flex items-center justify-between mb-2">
                                        <h4 className="text-sm font-medium text-blue-400">Recent Changes (To Push)</h4>
                                        <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded-full">
                                            {unpushedCommits.length}
                                        </span>
                                    </div>
                                    <div className="space-y-1">
                                        {unpushedCommits.slice(0, 3).map((commit: any) => (
                                            <div key={commit.hash} className="text-xs text-white/60 truncate">
                                                <span className="font-mono text-white/40">{commit.shortHash}</span> {commit.message}
                                            </div>
                                        ))}
                                        {unpushedCommits.length > 3 && (
                                            <button
                                                onClick={() => setGitView('unpushed')}
                                                className="text-xs text-blue-400 hover:underline"
                                            >
                                                +{unpushedCommits.length - 3} more...
                                            </button>
                                        )}
                                    </div>
                                </div>
                            )}

                            {hasRecentCommits && (
                                <div className={cn(
                                    "bg-white/5 rounded-xl border border-white/5 p-4",
                                    visibleSummaryCards === 3 && "md:col-span-2"
                                )}>
                                    <div className="flex items-center justify-between mb-2">
                                        <h4 className="text-sm font-medium text-white/80">Recent Commits</h4>
                                        <span className="text-xs bg-white/10 text-white/60 px-2 py-0.5 rounded-full">
                                            {gitHistory.length}
                                        </span>
                                    </div>
                                    <div className="space-y-1">
                                        {gitHistory.slice(0, 3).map((commit: any) => (
                                            <div key={commit.hash} className="text-xs text-white/60 truncate">
                                                <span className="font-mono text-white/40">{commit.shortHash}</span> {commit.message}
                                            </div>
                                        ))}
                                        {gitHistory.length > 3 && (
                                            <button
                                                onClick={() => setGitView('history')}
                                                className="text-xs text-[var(--accent-primary)] hover:underline"
                                            >
                                                View all...
                                            </button>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    )
                })()}

                {(branches.length > 0 || remotes.length > 0 || tags.length > 0 || stashes.length > 0) && (
                    <div className="bg-white/5 rounded-xl border border-white/5 p-4 space-y-4">
                        <div className="flex items-center justify-between">
                            <h4 className="text-sm font-medium text-white/80">Repository Details</h4>
                            <span className="text-xs text-white/40">Live Git metadata</span>
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-xs">
                            <div className="bg-black/20 rounded-lg border border-white/5 px-3 py-2">
                                <div className="text-white/40">Branches</div>
                                <div className="text-white/80 font-medium">{branches.length}</div>
                            </div>
                            <div className="bg-black/20 rounded-lg border border-white/5 px-3 py-2">
                                <div className="text-white/40">Remotes</div>
                                <div className="text-white/80 font-medium">{remotes.length}</div>
                            </div>
                            <div className="bg-black/20 rounded-lg border border-white/5 px-3 py-2">
                                <div className="text-white/40">Tags</div>
                                <div className="text-white/80 font-medium">{tags.length}</div>
                            </div>
                            <div className="bg-black/20 rounded-lg border border-white/5 px-3 py-2">
                                <div className="text-white/40">Stashes</div>
                                <div className="text-white/80 font-medium">{stashes.length}</div>
                            </div>
                        </div>

                        {branches.length > 0 && (
                            <div className="space-y-1">
                                <div className="text-xs text-white/40">Active Branches</div>
                                {branches.slice(0, 4).map((branch: any) => (
                                    <div key={branch.name} className="text-xs text-white/65 truncate">
                                        <span className={cn('font-mono', branch.current && 'text-green-300')}>
                                            {branch.current ? '* ' : ''}{branch.name}
                                        </span>
                                        {branch.isRemote ? ' (remote)' : ''}
                                    </div>
                                ))}
                            </div>
                        )}

                        {remotes.length > 0 && (
                            <div className="space-y-1">
                                <div className="text-xs text-white/40">Remotes</div>
                                {remotes.slice(0, 3).map((remote: any) => (
                                    <div key={remote.name} className="text-xs text-white/65 truncate">
                                        <span className="font-mono">{remote.name}</span>{' '}
                                        <span className="text-white/40">{remote.fetchUrl || remote.pushUrl}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    )
}
