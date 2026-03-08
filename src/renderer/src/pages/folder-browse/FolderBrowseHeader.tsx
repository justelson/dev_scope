import { ArrowLeft, ArrowUp, Check, Code, Copy, ExternalLink, FileJson, FilePlus, FileText, FolderOpen, FolderPlus, Plus, RefreshCw, Settings, Terminal } from 'lucide-react'
import { cn } from '@/lib/utils'
import { FileActionsMenu } from '@/components/ui/FileActionsMenu'

type RootStats = {
    projects: number
    frameworks: number
    types: number
}

interface FolderBrowseHeaderProps {
    folderName: string
    decodedPath: string
    totalProjects: number
    isProjectsRootView?: boolean
    rootStats?: RootStats
    isCurrentFolderGitRepo: boolean
    loading: boolean
    onBack: () => void
    onNavigateUp: () => void
    canNavigateUp: boolean
    onViewAsProject: () => void
    onOpenTerminal: () => void
    onCopyPath: () => void
    copiedPath: boolean
    onOpenStats?: (key: 'projects' | 'frameworks' | 'types') => void
    onOpenProjectsSettings?: () => void
    onOpenInExplorer: () => void
    onRefresh: () => void
    onCreateFile: (presetExtension?: string) => void
    onCreateFolder: () => void
}

export function FolderBrowseHeader({
    folderName,
    decodedPath,
    totalProjects,
    isProjectsRootView = false,
    rootStats,
    isCurrentFolderGitRepo,
    loading,
    onBack,
    onNavigateUp,
    canNavigateUp,
    onViewAsProject,
    onOpenTerminal,
    onCopyPath,
    copiedPath,
    onOpenStats,
    onOpenProjectsSettings,
    onOpenInExplorer,
    onRefresh,
    onCreateFile,
    onCreateFolder
}: FolderBrowseHeaderProps) {
    const title = isProjectsRootView ? 'Projects' : folderName
    const stats = rootStats ?? { projects: totalProjects, frameworks: 0, types: 0 }

    return (
        <div className={cn(
            'flex flex-col transition-[margin,gap] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]',
            'mb-8 gap-5'
        )}>
            <div className={cn(
                'flex flex-col gap-4 transition-[gap] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]',
                'lg:flex-row lg:items-center lg:justify-between'
            )}>
                <div className="flex items-center gap-4 min-w-0">
                    {!isProjectsRootView && (
                        <div className={cn(
                            'flex items-center gap-1.5 rounded-xl border border-white/5 bg-white/5 shrink-0',
                            'p-1'
                        )}>
                            <button
                                onClick={onBack}
                                className={cn(
                                    'flex items-center justify-center rounded-lg text-white/50 transition-all active:scale-95 hover:bg-white/10 hover:text-white',
                                    'h-9 w-9'
                                )}
                                title="Back"
                            >
                                <ArrowLeft size={18} />
                            </button>
                            <button
                                onClick={onNavigateUp}
                                disabled={!canNavigateUp}
                                className={cn(
                                    'flex items-center justify-center rounded-lg text-white/50 transition-all active:scale-95 hover:bg-white/10 hover:text-white disabled:pointer-events-none disabled:opacity-30',
                                    'h-9 w-9'
                                )}
                                title="Go to parent folder"
                            >
                                <ArrowUp size={18} />
                            </button>
                        </div>
                    )}

                    {/* Folder Info */}
                    <div className="flex items-center gap-3 min-w-0">
                        <div className={cn(
                            'rounded-xl bg-yellow-500/10 border border-yellow-500/10 shrink-0',
                            'p-2.5'
                        )}>
                            <FolderOpen className="text-yellow-400" size={22} />
                        </div>
                        <div className="min-w-0">
                            <div className="min-w-0 flex items-center gap-3">
                                <h1 className={cn(
                                    'truncate font-bold text-white leading-tight',
                                    'text-2xl'
                                )}>
                                    {title}
                                </h1>
                                {!isProjectsRootView && totalProjects > 0 && (
                                    <span className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider bg-yellow-500/20 text-yellow-300 rounded-full border border-yellow-500/20 shadow-sm shrink-0">
                                        {totalProjects} {totalProjects === 1 ? 'project' : 'projects'}
                                    </span>
                                )}
                            </div>
                            {isProjectsRootView && (
                                <div className="mt-2 flex items-center gap-2 flex-wrap">
                                    <button
                                        type="button"
                                        onClick={() => onOpenStats?.('projects')}
                                        className="px-2.5 py-1 rounded-md border border-amber-400/45 bg-amber-500/15 text-xs font-semibold text-amber-300 hover:bg-amber-500/25 transition-colors"
                                    >
                                        {stats.projects} projects
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => onOpenStats?.('frameworks')}
                                        className="px-2.5 py-1 rounded-md border border-emerald-400/45 bg-emerald-500/15 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/25 transition-colors"
                                    >
                                        {stats.frameworks} frameworks
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => onOpenStats?.('types')}
                                        className="px-2.5 py-1 rounded-md border border-yellow-400/45 bg-yellow-500/15 text-xs font-semibold text-yellow-300 hover:bg-yellow-500/25 transition-colors"
                                    >
                                        {stats.types} types
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Primary Actions */}
                <div className={cn(
                    'flex items-center gap-2 shrink-0 self-end',
                    'lg:self-auto'
                )}>
                    {isProjectsRootView && onOpenProjectsSettings && (
                        <button
                            onClick={onOpenProjectsSettings}
                            className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/75 hover:text-white hover:bg-white/10 transition-all"
                            title="Projects settings"
                        >
                            <Settings size={16} />
                        </button>
                    )}
                    <div className={cn('flex items-center gap-1.5 mr-2', isProjectsRootView && 'ml-1')}>
                        <button
                            onClick={onRefresh}
                            disabled={loading}
                            className={cn(
                                'flex items-center justify-center rounded-xl border border-white/5 text-white/40 transition-all hover:bg-white/5 hover:text-white disabled:opacity-50',
                                'h-10 w-10'
                            )}
                            title="Refresh"
                        >
                            <RefreshCw size={16} className={cn(loading && 'animate-spin')} />
                        </button>
                        <button
                            onClick={onOpenInExplorer}
                            className={cn(
                                'flex items-center justify-center rounded-xl border border-white/5 text-white/40 transition-all hover:bg-white/5 hover:text-white',
                                'h-10 w-10'
                            )}
                            title="Open in folder"
                        >
                            <ExternalLink size={16} />
                        </button>
                        <FileActionsMenu
                            title="Create"
                            buttonClassName={cn(
                                '!inline-flex !items-center !justify-center !rounded-xl !border-white/5 !text-white/40 hover:!text-white hover:!bg-white/5',
                                '!h-10 !w-10'
                            )}
                            triggerIcon={<Plus size={16} className="mx-auto" />}
                            items={[
                                {
                                    id: 'new-file-type',
                                    label: 'New File (Choose Type...)',
                                    icon: <FilePlus size={13} />,
                                    onSelect: () => onCreateFile()
                                },
                                {
                                    id: 'new-md-file',
                                    label: 'Markdown (.md)',
                                    icon: <FileText size={13} />,
                                    onSelect: () => onCreateFile('md')
                                },
                                {
                                    id: 'new-json-file',
                                    label: 'JSON (.json)',
                                    icon: <FileJson size={13} />,
                                    onSelect: () => onCreateFile('json')
                                },
                                {
                                    id: 'new-ts-file',
                                    label: 'TypeScript (.ts)',
                                    icon: <Code size={13} />,
                                    onSelect: () => onCreateFile('ts')
                                },
                                {
                                    id: 'new-txt-file',
                                    label: 'Text (.txt)',
                                    icon: <FileText size={13} />,
                                    onSelect: () => onCreateFile('txt')
                                },
                                {
                                    id: 'new-folder',
                                    label: 'New Folder',
                                    icon: <FolderPlus size={13} />,
                                    onSelect: onCreateFolder
                                }
                            ]}
                        />
                    </div>

                    <div className="h-8 w-[1px] bg-white/10 mx-1 hidden sm:block" />

                    {isCurrentFolderGitRepo && (
                        <button
                            onClick={onViewAsProject}
                            className={cn(
                                'flex items-center gap-2 rounded-xl bg-sky-500 text-white font-bold transition-all active:scale-95 shadow-lg shadow-sky-500/20 hover:bg-sky-400',
                                'px-4 py-2.5 text-sm'
                            )}
                            title="View as Project"
                        >
                            <Code size={18} />
                            <span>View as Project</span>
                        </button>
                    )}
                    <button
                        onClick={onOpenTerminal}
                        className={cn(
                            'flex items-center gap-2 border border-white/10 bg-white/5 text-white/70 font-medium rounded-xl transition-all hover:bg-white/10 hover:text-white',
                            'px-4 py-2.5 text-sm'
                        )}
                        title="Open terminal in this folder"
                    >
                        <Terminal size={17} />
                        <span>Terminal</span>
                    </button>
                </div>
            </div>

            {/* Path Bar */}
            <div className={cn(
                'group flex items-center gap-3 rounded-xl border border-white/5 bg-white/[0.02] pr-2 transition-[padding,background-color] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] hover:bg-white/[0.04]',
                'pl-4 py-2'
            )}>
                <FolderOpen size={14} className="text-white/20 shrink-0" />
                <span className="min-w-0 flex-1 truncate font-mono text-xs text-white/40 group-hover:text-white/60 transition-colors">
                    {decodedPath}
                </span>
                <button
                    onClick={onCopyPath}
                    className={cn(
                        "flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all border border-transparent",
                        copiedPath
                            ? "text-green-400 bg-green-500/10 border-green-500/20"
                            : "text-white/40 hover:text-white hover:bg-white/10 hover:border-white/5"
                    )}
                    title={copiedPath ? "Copied path" : "Copy path"}
                >
                    {copiedPath ? <Check size={14} /> : <Copy size={14} />}
                    <span className="leading-none">
                        {copiedPath ? 'Copied!' : 'Copy Path'}
                    </span>
                </button>
            </div>
        </div>
    )

}
