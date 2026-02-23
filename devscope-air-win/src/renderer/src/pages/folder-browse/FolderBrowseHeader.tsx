import { ArrowLeft, ArrowUp, Check, Code, Copy, ExternalLink, FolderOpen, RefreshCw, Terminal } from 'lucide-react'
import { cn } from '@/lib/utils'

interface FolderBrowseHeaderProps {
    folderName: string
    decodedPath: string
    totalProjects: number
    isCurrentFolderGitRepo: boolean
    loading: boolean
    onBack: () => void
    onNavigateUp: () => void
    canNavigateUp: boolean
    onViewAsProject: () => void
    onOpenTerminal: () => void
    onCopyPath: () => void
    copiedPath: boolean
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
    onNavigateUp,
    canNavigateUp,
    onViewAsProject,
    onOpenTerminal,
    onCopyPath,
    copiedPath,
    onOpenInExplorer,
    onRefresh
}: FolderBrowseHeaderProps) {
    return (
        <div className="mb-8 flex flex-col gap-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex items-center gap-4 min-w-0">
                    {/* Navigation Actions */}
                    <div className="flex items-center gap-1.5 p-1 bg-white/5 rounded-xl border border-white/5 shrink-0">
                        <button
                            onClick={onBack}
                            className="h-9 w-9 flex items-center justify-center text-white/50 hover:text-white hover:bg-white/10 rounded-lg transition-all active:scale-95"
                            title="Back"
                        >
                            <ArrowLeft size={18} />
                        </button>
                        <button
                            onClick={onNavigateUp}
                            disabled={!canNavigateUp}
                            className="h-9 w-9 flex items-center justify-center text-white/50 hover:text-white hover:bg-white/10 rounded-lg transition-all active:scale-95 disabled:opacity-30 disabled:pointer-events-none"
                            title="Go to parent folder"
                        >
                            <ArrowUp size={18} />
                        </button>
                    </div>

                    {/* Folder Info */}
                    <div className="flex items-center gap-3 min-w-0">
                        <div className="p-2.5 rounded-xl bg-yellow-500/10 border border-yellow-500/10 shrink-0">
                            <FolderOpen className="text-yellow-400" size={22} />
                        </div>
                        <div className="min-w-0 flex items-center gap-3">
                            <h1 className="text-2xl font-bold text-white truncate leading-tight">
                                {folderName}
                            </h1>
                            {totalProjects > 0 && (
                                <span className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider bg-yellow-500/20 text-yellow-300 rounded-full border border-yellow-500/20 shadow-sm shrink-0">
                                    {totalProjects} {totalProjects === 1 ? 'project' : 'projects'}
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                {/* Primary Actions */}
                <div className="flex items-center gap-2 shrink-0 self-end lg:self-auto">
                    <div className="flex items-center gap-1.5 mr-2">
                        <button
                            onClick={onRefresh}
                            disabled={loading}
                            className="h-10 w-10 flex items-center justify-center text-white/40 hover:text-white hover:bg-white/5 rounded-xl border border-white/5 transition-all disabled:opacity-50"
                            title="Refresh"
                        >
                            <RefreshCw size={16} className={cn(loading && 'animate-spin')} />
                        </button>
                        <button
                            onClick={onOpenInExplorer}
                            className="h-10 w-10 flex items-center justify-center text-white/40 hover:text-white hover:bg-white/5 rounded-xl border border-white/5 transition-all"
                            title="Open in folder"
                        >
                            <ExternalLink size={16} />
                        </button>
                    </div>

                    <div className="h-8 w-[1px] bg-white/10 mx-1 hidden sm:block" />

                    {isCurrentFolderGitRepo && (
                        <button
                            onClick={onViewAsProject}
                            className="flex items-center gap-2 px-4 py-2.5 bg-sky-500 hover:bg-sky-400 text-white text-sm font-bold rounded-xl transition-all active:scale-95 shadow-lg shadow-sky-500/20"
                            title="View as Project"
                        >
                            <Code size={18} />
                            <span>View as Project</span>
                        </button>
                    )}
                    <button
                        onClick={onOpenTerminal}
                        className="flex items-center gap-2 px-4 py-2.5 text-white/70 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl transition-all font-medium text-sm"
                        title="Open terminal in this folder"
                    >
                        <Terminal size={17} />
                        <span>Terminal</span>
                    </button>
                </div>
            </div>

            {/* Path Bar */}
            <div className="flex items-center gap-3 rounded-xl border border-white/5 bg-white/[0.02] pl-4 pr-2 py-2 group hover:bg-white/[0.04] transition-colors">
                <FolderOpen size={14} className="text-white/20 shrink-0" />
                <span className="min-w-0 flex-1 truncate font-mono text-xs text-white/40 group-hover:text-white/60 transition-colors">
                    {decodedPath}
                </span>
                <button
                    onClick={onCopyPath}
                    className={cn(
                        "flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
                        copiedPath
                            ? "text-green-400 bg-green-500/10"
                            : "text-white/30 hover:text-white hover:bg-white/10"
                    )}
                    title={copiedPath ? "Copied path" : "Copy path"}
                >
                    {copiedPath ? <Check size={14} /> : <Copy size={14} />}
                    <span className="opacity-0 group-hover:opacity-100 transition-opacity">
                        {copiedPath ? 'Copied!' : 'Copy Path'}
                    </span>
                </button>
            </div>
        </div>
    )

}
