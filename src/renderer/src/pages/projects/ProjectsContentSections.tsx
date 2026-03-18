import { Code, ExternalLink, File, FileCode, Folder, FolderOpen, Github } from 'lucide-react'
import { cn } from '@/lib/utils'
import { FinderItem, SectionHeader, WRAP_AND_CLAMP_2 } from '../shared/BrowseSectionPrimitives'
import { ProjectsProjectCard } from './ProjectsProjectCard'
import type { ContentLayout, FileItem, FolderItem, Project, ViewMode } from './projectsTypes'
import { FileActionsMenu } from '@/components/ui/FileActionsMenu'
import { ProjectsExplorerContent } from './ProjectsExplorerContent'

interface ProjectsContentSectionsProps {
    plainFolders: FolderItem[]
    gitRepos: Project[]
    filteredProjects: Project[]
    filteredFiles: FileItem[]
    viewMode: ViewMode
    contentLayout: ContentLayout
    formatRelativeTime: (timestamp?: number) => string
    getProjectTypeLabel: (type: string) => string
    getProjectThemeColor: (type: string) => string
    onFolderOpen: (path: string) => void
    onProjectOpen: (project: Project) => void
    onProjectRename: (project: Project) => void | Promise<void>
    onProjectDelete: (project: Project) => void | Promise<void>
    onFileParentOpen: (path: string) => void
    openInExplorer: (path: string) => void
    searchActive: boolean
    filterActive: boolean
}

function parentPathForFile(path: string) {
    const lastSlash = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'))
    return lastSlash > 0 ? path.slice(0, lastSlash) : path
}

export function ProjectsContentSections(props: ProjectsContentSectionsProps) {
    const {
        plainFolders,
        gitRepos,
        filteredProjects,
        filteredFiles,
        viewMode,
        contentLayout,
        formatRelativeTime,
        getProjectTypeLabel,
        getProjectThemeColor,
        onFolderOpen,
        onProjectOpen,
        onProjectRename,
        onProjectDelete,
        onFileParentOpen,
        openInExplorer,
        searchActive,
        filterActive
    } = props

    if (contentLayout === 'explorer') {
        return <ProjectsExplorerContent {...props} />
    }

    return (
        <div className="space-y-8">
            {plainFolders.length > 0 && (
                <div>
                    <SectionHeader icon={Folder} iconClassName="text-yellow-400/70" title="Folders" count={plainFolders.length} />
                    <div className={cn('grid gap-4', viewMode === 'finder' ? 'grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-8 xl:grid-cols-10' : 'grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6')}>
                        {plainFolders.map((folder) => (
                            viewMode === 'finder' ? (
                                <FinderItem key={folder.path} icon={Folder} iconClassName="text-yellow-400" title={folder.name} subtitle="Folder" onClick={() => onFolderOpen(folder.path)} />
                            ) : (
                                <div
                                    key={folder.path}
                                    onClick={() => onFolderOpen(folder.path)}
                                    className="group flex cursor-pointer items-center gap-2 rounded-lg border border-white/5 bg-sparkle-card/50 p-2.5 text-left transition-all hover:border-yellow-400/30 hover:bg-yellow-400/5"
                                    title={folder.name}
                                >
                                    <Folder size={16} className="shrink-0 text-yellow-400/70 transition-colors group-hover:text-yellow-400" />
                                    <span className={cn('text-sm leading-5 text-white/70 transition-colors group-hover:text-white', WRAP_AND_CLAMP_2)}>{folder.name}</span>
                                </div>
                            )
                        ))}
                    </div>
                </div>
            )}

            {gitRepos.length > 0 && (
                <div>
                    <SectionHeader icon={Github} iconClassName="text-orange-400/70" title="Git Repositories" count={gitRepos.length} />
                    <div className={cn('grid gap-4', viewMode === 'finder' ? 'grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-8 xl:grid-cols-10' : 'grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6')}>
                        {gitRepos.map((repo) => (
                            viewMode === 'finder' ? (
                                <FinderItem key={repo.path} icon={Github} iconClassName="text-orange-400" title={repo.name} subtitle="Git Repo" onClick={() => onFolderOpen(repo.path)} />
                            ) : (
                                <div
                                    key={repo.path}
                                    onClick={() => onFolderOpen(repo.path)}
                                    className="group flex cursor-pointer items-center gap-2 rounded-lg border border-white/5 bg-sparkle-card/50 p-2.5 text-left transition-all hover:border-orange-400/30 hover:bg-orange-400/5"
                                    title={repo.name}
                                >
                                    <Github size={16} className="shrink-0 text-orange-400/70 transition-colors group-hover:text-orange-400" />
                                    <span className={cn('text-sm leading-5 text-white/70 transition-colors group-hover:text-white', WRAP_AND_CLAMP_2)}>{repo.name}</span>
                                </div>
                            )
                        ))}
                    </div>
                </div>
            )}

            {filteredProjects.length > 0 && (
                <div>
                    <SectionHeader icon={Code} iconClassName="text-sparkle-accent" title="Projects" count={filteredProjects.length} />
                    <div className={cn('grid gap-4', viewMode === 'finder' && 'grid-cols-3 gap-x-2 gap-y-6 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-8 xl:grid-cols-10', viewMode === 'grid' && 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4')}>
                        {filteredProjects.map((project) => (
                            <ProjectsProjectCard
                                key={project.path}
                                project={project}
                                viewMode={viewMode}
                                formatRelativeTime={formatRelativeTime}
                                getProjectTypeLabel={getProjectTypeLabel}
                                getProjectThemeColor={getProjectThemeColor}
                                onProjectOpen={onProjectOpen}
                                openInExplorer={openInExplorer}
                                onProjectRename={onProjectRename}
                                onProjectDelete={onProjectDelete}
                            />
                        ))}
                    </div>
                </div>
            )}

            {filteredFiles.length > 0 && (
                <div>
                    <SectionHeader icon={File} iconClassName="text-cyan-300/80" title="Files" count={filteredFiles.length} />
                    <div className={cn('grid gap-4', viewMode === 'finder' ? 'grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-8 xl:grid-cols-10' : 'grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3')}>
                        {filteredFiles.map((file) => {
                            const parentPath = parentPathForFile(file.path)
                            return viewMode === 'finder' ? (
                                <FinderItem key={file.path} icon={FileCode} iconClassName="text-cyan-300/80" title={file.name} subtitle={file.extension || 'File'} onClick={() => onFileParentOpen(parentPath)} />
                            ) : (
                                <div
                                    key={file.path}
                                    onClick={() => onFileParentOpen(parentPath)}
                                    className="group flex cursor-pointer items-center gap-3 rounded-lg border border-white/5 bg-sparkle-card/50 p-2.5 text-left transition-all hover:border-cyan-300/30 hover:bg-cyan-300/5"
                                    title={file.path}
                                >
                                    <File size={15} className="shrink-0 text-cyan-300/80" />
                                    <div className="min-w-0 flex-1">
                                        <div className={cn('text-sm leading-5 text-white/80 group-hover:text-white', WRAP_AND_CLAMP_2)} title={file.name}>{file.name}</div>
                                        <div className="truncate text-[11px] text-sparkle-text-muted" title={parentPath}>{parentPath}</div>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <ExternalLink size={12} className="shrink-0 text-white/20 transition-colors group-hover:text-white/60" />
                                        <FileActionsMenu
                                            buttonClassName="h-7 w-7 opacity-0 transition-opacity group-hover:opacity-100"
                                            items={[
                                                { id: 'open-parent', label: 'Open Parent Folder', icon: <FolderOpen size={13} />, onSelect: () => onFileParentOpen(parentPath) },
                                                { id: 'explorer', label: 'Open in Explorer', icon: <ExternalLink size={13} />, onSelect: () => openInExplorer(file.path) }
                                            ]}
                                        />
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </div>
            )}

            {filteredProjects.length === 0 && plainFolders.length === 0 && gitRepos.length === 0 && filteredFiles.length === 0 && (
                <div className="flex flex-col items-center justify-center rounded-xl border border-sparkle-border bg-sparkle-card py-16">
                    <FileCode size={48} className="mb-4 text-sparkle-text-muted" />
                    <h3 className="mb-2 text-lg font-medium text-sparkle-text">
                        {searchActive || filterActive ? 'No Matching Items' : 'No Items Found'}
                    </h3>
                    <p className="max-w-md text-center text-sparkle-text-secondary">
                        {searchActive || filterActive ? 'Try adjusting your search or filter criteria.' : 'No projects or folders detected.'}
                    </p>
                </div>
            )}
        </div>
    )
}
