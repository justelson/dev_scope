import { ChevronRight, ExternalLink, File, FileCode, Folder, FolderOpen, FolderTree, Github, Pencil, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import ProjectIcon from '@/components/ui/ProjectIcon'
import { FileActionsMenu } from '@/components/ui/FileActionsMenu'
import { FinderItem, SectionHeader, WRAP_AND_CLAMP_2 } from '../shared/BrowseSectionPrimitives'
import { ProjectsProjectCard } from './ProjectsProjectCard'
import type { ContentLayout, FileItem, FolderItem, Project, ViewMode } from './projectsTypes'

function parentPathForFile(path: string) {
    const lastSlash = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'))
    return lastSlash > 0 ? path.slice(0, lastSlash) : path
}

export function ProjectsExplorerContent({
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
    onProjectRename,
    onProjectDelete,
    onFileParentOpen,
    openInExplorer,
    searchActive,
    filterActive
}: {
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
}) {
    const explorerEntries = [
        ...plainFolders.map((folder) => ({ id: `folder:${folder.path}`, kind: 'folder' as const, name: folder.name, payload: folder })),
        ...gitRepos.map((repo) => ({ id: `git:${repo.path}`, kind: 'git' as const, name: repo.name, payload: { name: repo.name, path: repo.path, isProject: true } as FolderItem })),
        ...filteredProjects.map((project) => ({ id: `project:${project.path}`, kind: 'project' as const, name: project.name, payload: project })),
        ...filteredFiles.map((file) => ({ id: `file:${file.path}`, kind: 'file' as const, name: file.name, payload: file }))
    ].sort((left, right) => {
        const order: Record<'folder' | 'git' | 'project' | 'file', number> = { folder: 0, git: 1, project: 2, file: 3 }
        const kindDiff = order[left.kind] - order[right.kind]
        if (kindDiff !== 0) return kindDiff
        return left.name.localeCompare(right.name)
    })

    const totalItems = plainFolders.length + gitRepos.length + filteredProjects.length + filteredFiles.length
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
                                : 'grid-cols-2 auto-rows-fr sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6'
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
                                            onProjectRename={onProjectRename}
                                            onProjectDelete={onProjectDelete}
                                        />
                                    )
                                }

                                return (
                                    <div
                                        key={entry.id}
                                        onClick={() => onProjectOpen(project)}
                                        role="button"
                                        tabIndex={0}
                                        onKeyDown={(event) => {
                                            if (event.key === 'Enter' || event.key === ' ') {
                                                event.preventDefault()
                                                onProjectOpen(project)
                                            }
                                        }}
                                        className="group h-full min-h-[136px] rounded-xl border border-white/5 bg-sparkle-card p-3 text-left transition-all hover:-translate-y-1 hover:border-white/15"
                                    >
                                        <div className="mb-2 flex items-center justify-between gap-2">
                                            <div className="rounded-lg border border-white/5 bg-sparkle-bg p-2">
                                                <ProjectIcon projectType={project.type} framework={project.frameworks?.[0]} size={20} />
                                            </div>
                                            <div className="flex items-center gap-1">
                                                <span className="text-[10px] text-white/30">{formatRelativeTime(project.lastModified)}</span>
                                                <FileActionsMenu
                                                    buttonClassName="h-7 w-7 text-white/20 transition-all group-hover:text-white/40 hover:!text-white"
                                                    items={[
                                                        { id: 'open', label: 'Open', icon: <FolderOpen size={13} />, onSelect: () => onProjectOpen(project) },
                                                        { id: 'explorer', label: 'Open in Explorer', icon: <ExternalLink size={13} />, onSelect: () => openInExplorer(project.path) },
                                                        { id: 'rename', label: 'Rename Project', icon: <Pencil size={13} />, onSelect: () => onProjectRename(project) },
                                                        { id: 'delete', label: 'Delete Project', icon: <Trash2 size={13} />, danger: true, onSelect: () => onProjectDelete(project) }
                                                    ]}
                                                />
                                            </div>
                                        </div>
                                        <p className={cn('text-sm font-semibold leading-5 text-white/85 group-hover:text-white', WRAP_AND_CLAMP_2)} title={project.name}>{project.name}</p>
                                        <p className="truncate text-[10px] text-white/40" title={getProjectTypeLabel(project.type)}>{getProjectTypeLabel(project.type)}</p>
                                    </div>
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
                                        className="group relative flex h-full min-h-[136px] cursor-pointer flex-col rounded-xl border border-white/5 bg-sparkle-card p-3 text-left transition-all hover:-translate-y-1 hover:border-cyan-300/30 hover:bg-cyan-300/5"
                                        title={file.path}
                                    >
                                        <div className="mb-2 inline-flex w-fit rounded-lg border border-white/5 bg-sparkle-bg p-2">
                                            <File size={15} className="text-cyan-300/80" />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <div className={cn('text-sm leading-5 text-white/80 group-hover:text-white', WRAP_AND_CLAMP_2)} title={file.name}>{file.name}</div>
                                            <div className="truncate text-[11px] text-sparkle-text-muted" title={parentPath}>{parentPath}</div>
                                        </div>
                                        <div className="mt-auto flex items-center justify-end gap-1 pt-2">
                                            <FileActionsMenu
                                                buttonClassName="h-7 w-7 text-white/20 transition-all group-hover:text-white/40 hover:!text-white"
                                                items={[
                                                    { id: 'open-parent', label: 'Open Parent Folder', icon: <FolderOpen size={13} />, onSelect: () => onFileParentOpen(parentPath) },
                                                    { id: 'explorer', label: 'Open in Explorer', icon: <ExternalLink size={13} />, onSelect: () => openInExplorer(file.path) }
                                                ]}
                                            />
                                            <ExternalLink size={14} className="shrink-0 text-white/10 transition-colors group-hover:text-white/40" />
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
                                <div
                                    key={entry.id}
                                    onClick={() => onFolderOpen(folder.path)}
                                    className="group relative flex h-full min-h-[136px] cursor-pointer flex-col rounded-xl border border-white/5 bg-sparkle-card p-3 text-left transition-all hover:-translate-y-1 hover:border-white/15"
                                >
                                    <div className="mb-2 inline-flex w-fit rounded-lg border border-white/5 bg-sparkle-bg p-2">
                                        {isGit ? (
                                            <Github size={16} className="text-orange-400/70 transition-colors group-hover:text-orange-400" />
                                        ) : (
                                            <Folder size={16} className="text-yellow-400/70 transition-colors group-hover:text-yellow-400" />
                                        )}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <div className={cn('text-sm leading-5 text-white/70 transition-colors group-hover:text-white', WRAP_AND_CLAMP_2)} title={entry.name}>{entry.name}</div>
                                        <div className="text-[10px] text-white/30">{isGit ? 'Git Repo' : 'Folder'}</div>
                                    </div>
                                    <div className="mt-auto flex items-center justify-end gap-1 pt-2">
                                        <FileActionsMenu
                                            buttonClassName="h-7 w-7 text-white/20 transition-all group-hover:text-white/40 hover:!text-white"
                                            items={[
                                                { id: 'open', label: 'Open', icon: <FolderOpen size={13} />, onSelect: () => onFolderOpen(folder.path) },
                                                { id: 'explorer', label: 'Open in Explorer', icon: <ExternalLink size={13} />, onSelect: () => openInExplorer(folder.path) }
                                            ]}
                                        />
                                        <ChevronRight size={14} className="shrink-0 text-white/10 transition-colors group-hover:text-white/40" />
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </div>
            ) : (
                <div className="flex flex-col items-center justify-center rounded-xl border border-sparkle-border bg-sparkle-card py-16">
                    <FileCode size={48} className="mb-4 text-sparkle-text-muted" />
                    <h3 className="mb-2 text-lg font-medium text-sparkle-text">
                        {searchActive || filterActive ? 'No Matching Items' : 'No Items Found'}
                    </h3>
                    <p className="max-w-md text-center text-sparkle-text-secondary">
                        {searchActive || filterActive ? 'Try adjusting your search or filter criteria.' : 'No projects, files, or folders detected.'}
                    </p>
                </div>
            )}
        </div>
    )
}
