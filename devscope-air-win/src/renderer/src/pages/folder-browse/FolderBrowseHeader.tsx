import { ArrowLeft, Code, ExternalLink, FolderOpen, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'

interface FolderBrowseHeaderProps {
    folderName: string
    decodedPath: string
    totalProjects: number
    isCurrentFolderGitRepo: boolean
    loading: boolean
    onBack: () => void
    onViewAsProject: () => void
    onOpenInExplorer: () => void
    onRefresh: () => void
}

export function FolderBrowseHeader({
    folderName,
    decodedPath,
    totalProjects,
    isCurrentFolderGitRepo,
    loading,
    onBack,
    onViewAsProject,
    onOpenInExplorer,
    onRefresh
}: FolderBrowseHeaderProps) {
    return (
        <div className="mb-8 flex items-start justify-between">
            <div>
                <div className="flex items-center gap-3 mb-2">
                    <button
                        onClick={onBack}
                        className="p-2 text-sparkle-text-secondary hover:text-sparkle-text hover:bg-white/5 rounded-lg transition-colors"
                    >
                        <ArrowLeft size={20} />
                    </button>
                    <div className="p-2 rounded-lg bg-yellow-500/10">
                        <FolderOpen className="text-yellow-400" size={24} />
                    </div>
                    <h1 className="text-2xl font-semibold text-sparkle-text">{folderName}</h1>
                    {totalProjects > 0 && (
                        <span className="px-2 py-0.5 text-xs bg-yellow-500/20 text-yellow-300 rounded-full">
                            {totalProjects} projects
                        </span>
                    )}
                </div>
                <p className="text-sparkle-text-secondary text-sm">
                    <span className="font-mono text-xs opacity-60">{decodedPath}</span>
                </p>
            </div>
            <div className="flex items-center gap-2">
                {isCurrentFolderGitRepo && (
                    <button
                        onClick={onViewAsProject}
                        className="flex items-center gap-2 px-3 py-2 bg-[var(--accent-primary)] hover:bg-[var(--accent-primary)]/80 text-white text-sm font-medium rounded-lg transition-all"
                        title="View as Project"
                    >
                        <Code size={16} />
                        <span>View as Project</span>
                    </button>
                )}
                <button
                    onClick={onOpenInExplorer}
                    className="p-2 text-sparkle-text-secondary hover:text-sparkle-text hover:bg-sparkle-border-secondary rounded-lg transition-colors"
                    title="Open in Explorer"
                >
                    <ExternalLink size={18} />
                </button>
                <button
                    onClick={onRefresh}
                    disabled={loading}
                    className="flex items-center gap-2 px-3 py-2 text-sparkle-text-secondary hover:text-sparkle-text hover:bg-sparkle-border-secondary rounded-lg transition-colors disabled:opacity-50"
                >
                    <RefreshCw size={16} className={cn(loading && 'animate-spin')} />
                    <span className="text-sm">Refresh</span>
                </button>
            </div>
        </div>
    )
}
