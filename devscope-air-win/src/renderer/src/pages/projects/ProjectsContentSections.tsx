import { ChevronRight, Code, ExternalLink, File, FileCode, Folder, FolderTree, Github } from 'lucide-react'
import { cn } from '@/lib/utils'
import ProjectIcon from '@/components/ui/ProjectIcon'
import type { ContentLayout, FileItem, FolderItem, Project, ViewMode } from './projectsTypes'
import { FinderItem, SectionHeader, WRAP_AND_CLAMP_2 } from '../shared/BrowseSectionPrimitives'
import { ProjectsProjectCard } from './ProjectsProjectCard'

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
    onFileParentOpen: (path: string) => void
    openInExplorer: (path: string) => void
    searchActive: boolean
    filterActive: boolean
}

function parentPathForFile(path: string) {
    const lastSlash = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'))
    return lastSlash > 0 ? path.slice(0, lastSlash) : path
}

export function ProjectsContentSections({
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
    onFileParentOpen,
    openInExplorer,
    searchActive,
    filterActive
}: ProjectsContentSectionsProps) {
    const explorerEntries = [
        ...plainFolders.map((folder) => ({
            id: `folder:${folder.path}`,
            kind: 'folder' as const,
            name: folder.name,
            payload: folder
        })),
        ...gitRepos.map((repo) => ({
            id: `git:${repo.path}`,
            kind: 'git' as const,
            name: repo.name,
            payload: { name: repo.name, path: repo.path, isProject: true } as FolderItem
        })),
        ...filteredProjects.map((project) => ({
            id: `project:${project.path}`,
            kind: 'project' as const,
            name: project.name,
            payload: project
        })),
        ...filteredFiles.map((file) => ({
            id: `file:${file.path}`,
            kind: 'file' as const,
            name: file.name,
            payload: file
        }))
    ].sort((left, right) => {
        const order: Record<'folder' | 'git' | 'project' | 'file', number> = {
            folder: 0,
            git: 1,
            project: 2,
            file: 3
        }
        const kindDiff = order[left.kind] - order[right.kind]
        if (kindDiff !== 0) return kindDiff
        return left.name.localeCompare(right.name)
    })

    const totalItems = plainFolders.length + gitRepos.length + filteredProjects.length + filteredFiles.length

    if (contentLayout === 'explorer') {
        const isFinderMode = viewMode === 'finder'
        return (
            <div className="space-y-8">
                {totalItems > 0 ? (
                    <div>
                        <SectionHeader icon={FolderTree} iconClassName="text-indigo-400/80" title="All Items" count={totalItems} />
                        <div
                            className={cn(
                                'grid gap-3',
                                isFinderMode
                                    ? 'grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-8 xl:grid-cols-10'
                                    : 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 auto-rows-fr'
                            )}
                        >
                            {explorerEntries.map((entry) => {
                                if (entry.kind === 'project') {
                                    const project = entry.payload as Project
                                    if (isFinderMode) {
                                        return (
                                            <ProjectsProjectCard
                                                key={entry.id}
                                                project={project}
                                                viewMode="finder"
                                                formatRelativeTime={formatRelativeTime}
                                                getProjectTypeLabel={getProjectTypeLabel}
                                                getProjectThemeColor={getProjectThemeColor}
                                                onProjectOpen={onProjectOpen}
                                                openInExplorer={openInExplorer}
                                            />
                                        )
                                    }

                                    return (
                                        <button
                                            key={entry.id}
                                            onClick={() => onProjectOpen(project)}
                                            className="group h-full min-h-[136px] rounded-xl border border-white/5 bg-sparkle-card p-3 text-left transition-all hover:-translate-y-1 hover:border-white/15"
                                        >
                                            <div className="mb-2 flex items-center justify-between">
                                                <div className="rounded-lg border border-white/5 bg-sparkle-bg p-2">
                                                    <ProjectIcon projectType={project.type} framework={project.frameworks?.[0]} size={20} />
                                                </div>
                                                <span className="text-[10px] text-white/30">{formatRelativeTime(project.lastModified)}</span>
                                            </div>
                                            <p className={cn('text-sm font-semibold text-white/85 group-hover:text-white leading-5', WRAP_AND_CLAMP_2)} title={project.name}>{project.name}</p>
                                            <p className="truncate text-[10px] text-white/40" title={getProjectTypeLabel(project.type)}>{getProjectTypeLabel(project.type)}</p>
                                        </button>
                                    )
                                }

                                if (entry.kind === 'file') {
                                    const file = entry.payload as FileItem
                                    const parentPath = parentPathForFile(file.path)
                                    if (isFinderMode) {
                                        return (
                                            <FinderItem
                                                key={entry.id}
                                                icon={FileCode}
                                                iconClassName="text-cyan-300/80"
                                                title={file.name}
                                                subtitle={file.extension || 'File'}
                                                onClick={() => onFileParentOpen(parentPath)}
                                            />
                                        )
                                    }

                                    return (
                                        <div
                                            key={entry.id}
                                            onClick={() => onFileParentOpen(parentPath)}
                                            className="group h-full min-h-[136px] rounded-xl border border-white/5 bg-sparkle-card p-3 text-left transition-all hover:-translate-y-1 hover:border-cyan-300/30 hover:bg-cyan-300/5 cursor-pointer flex flex-col"
                                            title={file.path}
                                        >
                                            <div className="mb-2 inline-flex w-fit rounded-lg border border-white/5 bg-sparkle-bg p-2">
                                                <File size={15} className="text-cyan-300/80" />
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <div className={cn('text-sm text-white/80 group-hover:text-white leading-5', WRAP_AND_CLAMP_2)} title={file.name}>{file.name}</div>
                                                <div className="truncate text-[11px] text-sparkle-text-muted" title={parentPath}>{parentPath}</div>
                                            </div>
                                            <div className="mt-2">
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
                                        </div>
                                    )
                                }

                                const isGit = entry.kind === 'git'
                                const folder = entry.payload as FolderItem
                                if (isFinderMode) {
                                    return (
                                        <FinderItem
                                            key={entry.id}
                                            icon={isGit ? Github : Folder}
                                            iconClassName={isGit ? 'text-orange-400' : 'text-yellow-400'}
                                            title={entry.name}
                                            subtitle={isGit ? 'Git Repo' : 'Folder'}
                                            onClick={() => onFolderOpen(folder.path)}
                                        />
                                    )
                                }

                                return (
                                    <button
                                        key={entry.id}
                                        onClick={() => onFolderOpen(folder.path)}
                                        className="group h-full min-h-[136px] rounded-xl border border-white/5 bg-sparkle-card p-3 text-left transition-all hover:-translate-y-1 hover:border-white/15 flex flex-col"
                                    >
                                        <div className="mb-2 inline-flex w-fit rounded-lg border border-white/5 bg-sparkle-bg p-2">
                                            {isGit ? (
                                                <Github size={16} className="text-orange-400/70 group-hover:text-orange-400 transition-colors" />
                                            ) : (
                                                <Folder size={16} className="text-yellow-400/70 group-hover:text-yellow-400 transition-colors" />
                                            )}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <div className={cn('text-sm text-white/70 group-hover:text-white transition-colors leading-5', WRAP_AND_CLAMP_2)} title={entry.name}>{entry.name}</div>
                                            <div className="text-[10px] text-white/30">{isGit ? 'Git Repo' : 'Folder'}</div>
                                        </div>
                                        <ChevronRight size={12} className="text-white/20 group-hover:text-white/60 mt-2 transition-colors" />
                                    </button>
                                )
                            })}
                        </div>
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center py-16 bg-sparkle-card rounded-xl border border-sparkle-border">
                        <FileCode size={48} className="text-sparkle-text-muted mb-4" />
                        <h3 className="text-lg font-medium text-sparkle-text mb-2">
                            {searchActive || filterActive ? 'No Matching Items' : 'No Items Found'}
                        </h3>
                        <p className="text-sparkle-text-secondary text-center max-w-md">
                            {searchActive || filterActive
                                ? 'Try adjusting your search or filter criteria.'
                                : 'No projects, files, or folders detected.'}
                        </p>
                    </div>
                )}
            </div>
        )
    }

    return (
        <div className="space-y-8">
            {plainFolders.length > 0 && (
                <div>
                    <SectionHeader icon={Folder} iconClassName="text-yellow-400/70" title="Folders" count={plainFolders.length} />
                    <div className={cn(
                        'grid gap-4',
                        viewMode === 'finder'
                            ? 'grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-8 xl:grid-cols-10'
                            : 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2'
                    )}>
                        {plainFolders.map((folder) => (
                            viewMode === 'finder' ? (
                                <FinderItem
                                    key={folder.path}
                                    icon={Folder}
                                    iconClassName="text-yellow-400"
                                    title={folder.name}
                                    subtitle="Folder"
                                    onClick={() => onFolderOpen(folder.path)}
                                />
                            ) : (
                                <button
                                    key={folder.path}
                                    onClick={() => onFolderOpen(folder.path)}
                                    className="flex items-center gap-2 p-2.5 bg-sparkle-card/50 rounded-lg border border-white/5 hover:border-yellow-400/30 hover:bg-yellow-400/5 transition-all text-left group"
                                    title={folder.name}
                                >
                                    <Folder size={16} className="text-yellow-400/70 group-hover:text-yellow-400 transition-colors flex-shrink-0" />
                                    <span className={cn('text-sm text-white/70 group-hover:text-white transition-colors leading-5', WRAP_AND_CLAMP_2)}>{folder.name}</span>
                                    <ChevronRight size={12} className="text-white/20 group-hover:text-white/60 ml-auto flex-shrink-0 transition-colors" />
                                </button>
                            )
                        ))}
                    </div>
                </div>
            )}

            {gitRepos.length > 0 && (
                <div>
                    <SectionHeader icon={Github} iconClassName="text-orange-400/70" title="Git Repositories" count={gitRepos.length} />
                    <div className={cn(
                        'grid gap-4',
                        viewMode === 'finder'
                            ? 'grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-8 xl:grid-cols-10'
                            : 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2'
                    )}>
                        {gitRepos.map((repo) => (
                            viewMode === 'finder' ? (
                                <FinderItem
                                    key={repo.path}
                                    icon={Github}
                                    iconClassName="text-orange-400"
                                    title={repo.name}
                                    subtitle="Git Repo"
                                    onClick={() => onFolderOpen(repo.path)}
                                />
                            ) : (
                                <button
                                    key={repo.path}
                                    onClick={() => onFolderOpen(repo.path)}
                                    className="flex items-center gap-2 p-2.5 bg-sparkle-card/50 rounded-lg border border-white/5 hover:border-orange-400/30 hover:bg-orange-400/5 transition-all text-left group"
                                    title={repo.name}
                                >
                                    <Github size={16} className="text-orange-400/70 group-hover:text-orange-400 transition-colors flex-shrink-0" />
                                    <span className={cn('text-sm text-white/70 group-hover:text-white transition-colors leading-5', WRAP_AND_CLAMP_2)}>{repo.name}</span>
                                    <ChevronRight size={12} className="text-white/20 group-hover:text-white/60 ml-auto flex-shrink-0 transition-colors" />
                                </button>
                            )
                        ))}
                    </div>
                </div>
            )}

            {filteredProjects.length > 0 && (
                <div>
                    <SectionHeader icon={Code} iconClassName="text-sparkle-accent" title="Projects" count={filteredProjects.length} />
                    <div
                        className={cn(
                            'grid gap-4',
                            viewMode === 'finder' && 'grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-8 xl:grid-cols-10 gap-x-2 gap-y-6',
                            viewMode === 'grid' && 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
                        )}
                    >
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
                            />
                        ))}
                    </div>
                </div>
            )}

            {filteredFiles.length > 0 && (
                <div>
                    <SectionHeader icon={File} iconClassName="text-cyan-300/80" title="Files" count={filteredFiles.length} />
                    <div className={cn(
                        'grid gap-4',
                        viewMode === 'finder'
                            ? 'grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-8 xl:grid-cols-10'
                            : 'grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2'
                    )}>
                        {filteredFiles.map((file) => {
                            const parentPath = parentPathForFile(file.path)
                            return viewMode === 'finder' ? (
                                <FinderItem
                                    key={file.path}
                                    icon={FileCode}
                                    iconClassName="text-cyan-300/80"
                                    title={file.name}
                                    subtitle={file.extension || 'File'}
                                    onClick={() => onFileParentOpen(parentPath)}
                                />
                            ) : (
                                <div
                                    key={file.path}
                                    onClick={() => onFileParentOpen(parentPath)}
                                    className="group flex items-center gap-3 rounded-lg border border-white/5 bg-sparkle-card/50 p-2.5 text-left hover:border-cyan-300/30 hover:bg-cyan-300/5 transition-all cursor-pointer"
                                    title={file.path}
                                >
                                    <File size={15} className="text-cyan-300/80 flex-shrink-0" />
                                    <div className="min-w-0 flex-1">
                                        <div className={cn('text-sm text-white/80 group-hover:text-white leading-5', WRAP_AND_CLAMP_2)} title={file.name}>{file.name}</div>
                                        <div className="truncate text-[11px] text-sparkle-text-muted" title={parentPath}>{parentPath}</div>
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
