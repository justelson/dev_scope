import { ExternalLink, FileCode, Folder, FolderTree, Github, Code, File, ChevronRight, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'
import ProjectIcon, { FrameworkBadge } from '@/components/ui/ProjectIcon'
import type { FileItem, FolderItem, Project, ViewMode } from './projectsTypes'

interface ProjectsContentSectionsProps {
    plainFolders: FolderItem[]
    gitRepos: Project[]
    filteredProjects: Project[]
    filteredFiles: FileItem[]
    viewMode: ViewMode
    formatRelativeTime: (timestamp?: number) => string
    getProjectTypeLabel: (type: string) => string
    getProjectThemeColor: (type: string) => string
    onFolderOpen: (path: string) => void
    onProjectOpen: (project: Project) => void
    onFileParentOpen: (path: string) => void
    openInExplorer: (path: string) => void
    searchActive: boolean
    filterActive: boolean
}

export function ProjectsContentSections({
    plainFolders,
    gitRepos,
    filteredProjects,
    filteredFiles,
    viewMode,
    formatRelativeTime,
    getProjectTypeLabel,
    getProjectThemeColor,
    onFolderOpen,
    onProjectOpen,
    onFileParentOpen,
    openInExplorer,
    searchActive,
    filterActive
}: ProjectsContentSectionsProps) {
    return (
        <div className="space-y-8">
            {plainFolders.length > 0 && (
                <div>
                    <div className="flex items-center gap-3 mb-4">
                        <Folder size={18} className="text-yellow-400/70" />
                        <h2 className="text-sm font-medium text-white/60">Folders</h2>
                        <span className="text-xs text-white/30">{plainFolders.length}</span>
                        <div className="h-px bg-white/5 flex-1" />
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2">
                        {plainFolders.map((folder) => (
                            <button
                                key={folder.path}
                                onClick={() => onFolderOpen(folder.path)}
                                className="flex items-center gap-2 p-2.5 bg-sparkle-card/50 rounded-lg border border-white/5 hover:border-yellow-400/30 hover:bg-yellow-400/5 transition-all text-left group"
                            >
                                <Folder size={16} className="text-yellow-400/70 group-hover:text-yellow-400 transition-colors flex-shrink-0" />
                                <span className="text-sm text-white/70 truncate group-hover:text-white transition-colors">{folder.name}</span>
                                <ChevronRight size={12} className="text-white/20 group-hover:text-white/60 ml-auto flex-shrink-0 transition-colors" />
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {gitRepos.length > 0 && (
                <div>
                    <div className="flex items-center gap-3 mb-4">
                        <Github size={18} className="text-orange-400/70" />
                        <h2 className="text-sm font-medium text-white/60">Git Repositories</h2>
                        <span className="text-xs text-white/30">{gitRepos.length}</span>
                        <div className="h-px bg-white/5 flex-1" />
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2">
                        {gitRepos.map((repo) => (
                            <button
                                key={repo.path}
                                onClick={() => onFolderOpen(repo.path)}
                                className="flex items-center gap-2 p-2.5 bg-sparkle-card/50 rounded-lg border border-white/5 hover:border-orange-400/30 hover:bg-orange-400/5 transition-all text-left group"
                            >
                                <Github size={16} className="text-orange-400/70 group-hover:text-orange-400 transition-colors flex-shrink-0" />
                                <span className="text-sm text-white/70 truncate group-hover:text-white transition-colors">{repo.name}</span>
                                <ChevronRight size={12} className="text-white/20 group-hover:text-white/60 ml-auto flex-shrink-0 transition-colors" />
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {filteredProjects.length > 0 && (
                <div>
                    <div className="flex items-center gap-3 mb-4">
                        <Code size={18} className="text-sparkle-accent" />
                        <h2 className="text-sm font-medium text-white/60">Projects</h2>
                        <span className="text-xs text-white/30">{filteredProjects.length}</span>
                        <div className="h-px bg-white/5 flex-1" />
                    </div>

                    <div
                        className={cn(
                            'grid gap-4',
                            viewMode === 'grid' && 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4',
                            viewMode === 'detailed' && 'grid-cols-1 md:grid-cols-2',
                            viewMode === 'list' && 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
                        )}
                    >
                        {filteredProjects.map((project) => {
                            const themeColor = getProjectThemeColor(project.type)
                            const frameworkDisplayLimit = viewMode === 'detailed' ? 5 : 3
                            return (
                                <div
                                    key={project.path}
                                    onClick={() => onProjectOpen(project)}
                                    className={cn(
                                        'group relative border border-white/5 transition-all duration-300 overflow-hidden cursor-pointer',
                                        'hover:-translate-y-1 hover:border-white/10',
                                        viewMode === 'list'
                                            ? 'rounded-xl p-3 bg-sparkle-card flex items-center gap-3'
                                            : 'rounded-2xl bg-sparkle-card p-5 flex flex-col gap-4'
                                    )}
                                >
                                    <div
                                        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
                                        style={{
                                            boxShadow: `inset 0 0 0 1px ${themeColor}40`,
                                            background: `linear-gradient(to bottom right, ${themeColor}05, transparent)`
                                        }}
                                    />

                                    {viewMode === 'list' ? (
                                        <>
                                            <div className="p-2 rounded-lg bg-sparkle-bg border border-white/5">
                                                <ProjectIcon projectType={project.type} size={20} />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-bold text-sm text-white truncate">{project.name}</span>
                                                    {project.frameworks?.slice(0, 1).map((fw) => (
                                                        <FrameworkBadge key={fw} framework={fw} size="sm" showLabel={false} />
                                                    ))}
                                                </div>
                                            </div>
                                            <span className="text-[10px] text-white/30">{formatRelativeTime(project.lastModified)}</span>
                                            <ChevronRight size={16} className="text-white/30 group-hover:text-white/60 transition-colors" />
                                        </>
                                    ) : (
                                        <>
                                            <div className="flex items-start justify-between w-full relative z-10">
                                                <div className="p-3 rounded-xl bg-sparkle-bg border border-white/5 shadow-inner">
                                                    <ProjectIcon
                                                        projectType={project.type}
                                                        framework={project.frameworks?.[0]}
                                                        size={viewMode === 'detailed' ? 40 : 32}
                                                    />
                                                </div>
                                                <div className="flex items-center gap-1.5 text-[10px] text-white/30">
                                                    <Clock size={12} />
                                                    <span>{formatRelativeTime(project.lastModified)}</span>
                                                </div>
                                            </div>

                                            <div className="relative z-10 flex-1">
                                                <h3 className="font-bold text-white text-lg mb-1 group-hover:text-white/90 transition-colors truncate">
                                                    {project.name}
                                                </h3>
                                                <p className="text-xs text-white/40 mb-3">{getProjectTypeLabel(project.type)}</p>

                                                {project.frameworks && project.frameworks.length > 0 && (
                                                    <div className="flex flex-wrap gap-1.5 mb-3">
                                                        {project.frameworks.slice(0, frameworkDisplayLimit).map((fw) => (
                                                            <FrameworkBadge
                                                                key={fw}
                                                                framework={fw}
                                                                size="sm"
                                                                showLabel={viewMode === 'detailed'}
                                                            />
                                                        ))}
                                                        {project.frameworks.length > frameworkDisplayLimit && (
                                                            <span className="text-[10px] text-white/30 px-1.5 py-0.5">
                                                                +{project.frameworks.length - frameworkDisplayLimit}
                                                            </span>
                                                        )}
                                                    </div>
                                                )}
                                            </div>

                                            <div className="flex items-center gap-2 relative z-10">
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation()
                                                        openInExplorer(project.path)
                                                    }}
                                                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-sparkle-border-secondary text-sparkle-text-secondary hover:text-sparkle-text rounded-lg transition-colors"
                                                >
                                                    <ExternalLink size={14} />
                                                    <span>Open</span>
                                                </button>
                                            </div>

                                            <div
                                                className="absolute bottom-0 left-0 right-0 h-1 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                                                style={{ background: themeColor }}
                                            />
                                        </>
                                    )}
                                </div>
                            )
                        })}
                    </div>
                </div>
            )}

            {filteredFiles.length > 0 && (
                <div>
                    <div className="flex items-center gap-3 mb-4">
                        <File size={18} className="text-cyan-300/80" />
                        <h2 className="text-sm font-medium text-white/60">Files</h2>
                        <span className="text-xs text-white/30">{filteredFiles.length}</span>
                        <div className="h-px bg-white/5 flex-1" />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
                        {filteredFiles.map((file) => {
                            const lastSlash = Math.max(file.path.lastIndexOf('/'), file.path.lastIndexOf('\\'))
                            const parentPath = lastSlash > 0 ? file.path.slice(0, lastSlash) : file.path
                            return (
                                <div
                                    key={file.path}
                                    onClick={() => onFileParentOpen(parentPath)}
                                    className="group flex items-center gap-3 rounded-lg border border-white/5 bg-sparkle-card/50 p-2.5 text-left hover:border-cyan-300/30 hover:bg-cyan-300/5 transition-all cursor-pointer"
                                    title={file.path}
                                >
                                    <File size={15} className="text-cyan-300/80 flex-shrink-0" />
                                    <div className="min-w-0 flex-1">
                                        <div className="truncate text-sm text-white/80 group-hover:text-white">{file.name}</div>
                                        <div className="truncate text-[11px] text-sparkle-text-muted">{parentPath}</div>
                                    </div>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation()
                                            openInExplorer(file.path)
                                        }}
                                        className="flex items-center gap-1 px-2 py-1 rounded-md text-[11px] text-sparkle-text-secondary hover:text-sparkle-text hover:bg-sparkle-card-hover transition-colors"
                                        title="Open in Explorer"
                                    >
                                        <ExternalLink size={12} />
                                        Open
                                    </button>
                                </div>
                            )
                        })}
                    </div>
                </div>
            )}

            {filteredProjects.length === 0 && plainFolders.length === 0 && gitRepos.length === 0 && filteredFiles.length === 0 && (
                <div className="flex flex-col items-center justify-center py-16 bg-sparkle-card rounded-xl border border-sparkle-border">
                    <FileCode size={48} className="text-sparkle-text-muted mb-4" />
                    <h3 className="text-lg font-medium text-sparkle-text mb-2">
                        {searchActive || filterActive ? 'No Matching Items' : 'No Items Found'}
                    </h3>
                    <p className="text-sparkle-text-secondary text-center max-w-md">
                        {searchActive || filterActive
                            ? 'Try adjusting your search or filter criteria.'
                            : 'No projects or folders detected.'}
                    </p>
                </div>
            )}
        </div>
    )
}
