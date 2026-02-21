import type { ComponentType } from 'react'
import { ChevronRight, Clock, Code, ExternalLink, File, FileCode, FileText, Folder, Github } from 'lucide-react'
import ProjectIcon, { FrameworkBadge } from '@/components/ui/ProjectIcon'
import { cn } from '@/lib/utils'
import { getProjectTypeById, type FileItem, type FolderItem, type Project, type ViewMode } from './types'

interface SectionHeaderProps {
    icon: ComponentType<{ size?: number; className?: string }>
    iconClassName: string
    title: string
    count: number
}

function SectionHeader({ icon: Icon, iconClassName, title, count }: SectionHeaderProps) {
    return (
        <div className="flex items-center gap-3 mb-4">
            <Icon size={18} className={iconClassName} />
            <h2 className="text-sm font-medium text-white/60">{title}</h2>
            <span className="text-xs text-white/30">{count}</span>
            <div className="h-px bg-white/5 flex-1" />
        </div>
    )
}

interface FolderBrowseContentProps {
    filteredFolders: FolderItem[]
    gitRepos: Project[]
    filteredFiles: FileItem[]
    displayedProjects: Project[]
    viewMode: ViewMode
    searchQuery: string
    error: string | null
    onFolderClick: (folder: FolderItem) => void
    onProjectClick: (project: Project) => void
    onOpenFilePreview: (file: FileItem) => void
    onOpenProjectInExplorer: (path: string) => void
    formatFileSize: (bytes: number) => string
    getFileColor: (ext: string) => string
    formatRelativeTime: (timestamp?: number) => string
}

function ProjectCard({
    project,
    viewMode,
    onProjectClick,
    onOpenProjectInExplorer,
    formatRelativeTime
}: {
    project: Project
    viewMode: ViewMode
    onProjectClick: (project: Project) => void
    onOpenProjectInExplorer: (path: string) => void
    formatRelativeTime: (timestamp?: number) => string
}) {
    const typeInfo = getProjectTypeById(project.type)
    const themeColor = typeInfo?.themeColor || '#525252'

    return (
        <div
            key={project.path}
            onClick={() => onProjectClick(project)}
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
                            {project.frameworks?.slice(0, 1).map((framework) => (
                                <FrameworkBadge key={framework} framework={framework} size="sm" showLabel={false} />
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
                        <p className="text-xs text-white/40 mb-3">{typeInfo?.displayName || project.type}</p>

                        {project.frameworks && project.frameworks.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 mb-3">
                                {project.frameworks.slice(0, viewMode === 'detailed' ? 5 : 3).map((framework) => (
                                    <FrameworkBadge
                                        key={framework}
                                        framework={framework}
                                        size="sm"
                                        showLabel={viewMode === 'detailed'}
                                    />
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="flex items-center gap-2 relative z-10">
                        <button
                            onClick={(event) => {
                                event.stopPropagation()
                                onOpenProjectInExplorer(project.path)
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
}

export function FolderBrowseContent({
    filteredFolders,
    gitRepos,
    filteredFiles,
    displayedProjects,
    viewMode,
    searchQuery,
    error,
    onFolderClick,
    onProjectClick,
    onOpenFilePreview,
    onOpenProjectInExplorer,
    formatFileSize,
    getFileColor,
    formatRelativeTime
}: FolderBrowseContentProps) {
    return (
        <div className="space-y-8">
            {filteredFolders.length > 0 && (
                <div>
                    <SectionHeader icon={Folder} iconClassName="text-yellow-400/70" title="Folders" count={filteredFolders.length} />
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2">
                        {filteredFolders.map((folder) => (
                            <button
                                key={folder.path}
                                onClick={() => onFolderClick(folder)}
                                className="flex items-center gap-2 p-2.5 bg-sparkle-card/50 rounded-lg border border-white/5 hover:border-white/20 hover:bg-white/5 transition-all text-left group"
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
                    <SectionHeader icon={Github} iconClassName="text-white/70" title="Git Repositories" count={gitRepos.length} />
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2">
                        {gitRepos.map((repo) => (
                            <button
                                key={repo.path}
                                onClick={() => onFolderClick({ name: repo.name, path: repo.path, isProject: true })}
                                className="flex items-center gap-2 p-2.5 bg-white/5 rounded-lg border border-white/10 hover:border-white/30 hover:bg-white/10 transition-all text-left group relative"
                            >
                                <div className="p-1.5 rounded-md bg-white/10 flex-shrink-0">
                                    <Github size={16} className="text-white" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <span className="text-sm text-white font-medium truncate block">{repo.name}</span>
                                    <span className="text-[10px] text-white/40 uppercase tracking-wide">Git Repo</span>
                                </div>
                                <ChevronRight size={12} className="text-white/20 group-hover:text-white/60 ml-auto flex-shrink-0 transition-colors" />
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {filteredFiles.length > 0 && (
                <div>
                    <SectionHeader icon={File} iconClassName="text-blue-400/70" title="Files" count={filteredFiles.length} />
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2">
                        {filteredFiles.map((file) => {
                            const iconColor = getFileColor(file.extension)
                            return (
                                <div
                                    key={file.path}
                                    onClick={() => onOpenFilePreview(file)}
                                    className="flex items-center gap-2.5 p-2.5 bg-sparkle-card/50 rounded-lg border border-white/5 hover:border-blue-400/30 hover:bg-blue-400/5 transition-all group cursor-pointer"
                                >
                                    <div
                                        className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                                        style={{ backgroundColor: `${iconColor}15` }}
                                    >
                                        {file.extension === 'md' || file.extension === 'txt' ? (
                                            <FileText size={16} style={{ color: iconColor }} />
                                        ) : (
                                            <FileCode size={16} style={{ color: iconColor }} />
                                        )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm text-white/80 truncate group-hover:text-white transition-colors">{file.name}</p>
                                        <p className="text-[10px] text-white/30">{formatFileSize(file.size)}</p>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </div>
            )}

            {displayedProjects.length > 0 && (
                <div>
                    <SectionHeader icon={Code} iconClassName="text-sparkle-accent" title="Projects" count={displayedProjects.length} />

                    <div
                        className={cn(
                            'grid gap-4',
                            viewMode === 'grid' && 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4',
                            viewMode === 'detailed' && 'grid-cols-1 md:grid-cols-2',
                            viewMode === 'list' && 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
                        )}
                    >
                        {displayedProjects.map((project) => (
                            <ProjectCard
                                key={project.path}
                                project={project}
                                viewMode={viewMode}
                                onProjectClick={onProjectClick}
                                onOpenProjectInExplorer={onOpenProjectInExplorer}
                                formatRelativeTime={formatRelativeTime}
                            />
                        ))}
                    </div>
                </div>
            )}

            {displayedProjects.length === 0 && filteredFolders.length === 0 && filteredFiles.length === 0 && !error && (
                <div className="flex flex-col items-center justify-center py-16 bg-sparkle-card rounded-xl border border-sparkle-border">
                    <FileCode size={48} className="text-sparkle-text-muted mb-4" />
                    <h3 className="text-lg font-medium text-sparkle-text mb-2">
                        {searchQuery ? 'No Matching Items' : 'Empty Folder'}
                    </h3>
                    <p className="text-sparkle-text-secondary text-center max-w-md">
                        {searchQuery
                            ? 'Try adjusting your search criteria.'
                            : 'This folder does not contain any projects or subfolders.'}
                    </p>
                </div>
            )}
        </div>
    )
}
