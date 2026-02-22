import { ChevronRight, Code, File, FileCode, FileText, Folder, Github } from 'lucide-react'
import ProjectIcon from '@/components/ui/ProjectIcon'
import { cn } from '@/lib/utils'
import { getProjectTypeById, type ContentLayout, type FileItem, type FolderItem, type Project, type ViewMode } from './types'
import { FinderItem, SectionHeader, WRAP_AND_CLAMP_2 } from '../shared/BrowseSectionPrimitives'
import { FolderBrowseProjectCard } from './FolderBrowseProjectCard'

interface FolderBrowseContentProps {
    filteredFolders: FolderItem[]
    gitRepos: Project[]
    visibleFiles: FileItem[]
    totalFilteredFiles: number
    hasMoreFiles: boolean
    onLoadMoreFiles: () => void
    displayedProjects: Project[]
    viewMode: ViewMode
    contentLayout: ContentLayout
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

export function FolderBrowseContent({
    filteredFolders,
    gitRepos,
    visibleFiles,
    totalFilteredFiles,
    hasMoreFiles,
    onLoadMoreFiles,
    displayedProjects,
    viewMode,
    contentLayout,
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
    const explorerEntries = [
        ...filteredFolders.map((folder) => ({
            id: `folder:${folder.path}`,
            kind: 'folder' as const,
            name: folder.name,
            path: folder.path,
            payload: folder
        })),
        ...gitRepos.map((repo) => ({
            id: `git:${repo.path}`,
            kind: 'git' as const,
            name: repo.name,
            path: repo.path,
            payload: { name: repo.name, path: repo.path, isProject: true } as FolderItem
        })),
        ...displayedProjects.map((project) => ({
            id: `project:${project.path}`,
            kind: 'project' as const,
            name: project.name,
            path: project.path,
            payload: project
        })),
        ...visibleFiles.map((file) => ({
            id: `file:${file.path}`,
            kind: 'file' as const,
            name: file.name,
            path: file.path,
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

    const totalExplorerCount = filteredFolders.length + gitRepos.length + displayedProjects.length + totalFilteredFiles

    if (contentLayout === 'explorer') {
        const isFinderMode = viewMode === 'finder'
        return (
            <div className="space-y-8">
                {totalExplorerCount > 0 ? (
                    <div>
                        <SectionHeader icon={Folder} iconClassName="text-yellow-400/70" title="All Items" count={totalExplorerCount} />
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
                                            <FolderBrowseProjectCard
                                                key={entry.id}
                                                project={project}
                                                viewMode="finder"
                                                onProjectClick={onProjectClick}
                                                onOpenProjectInExplorer={onOpenProjectInExplorer}
                                                formatRelativeTime={formatRelativeTime}
                                            />
                                        )
                                    }

                                    const typeInfo = getProjectTypeById(project.type)
                                    return (
                                        <button
                                            key={entry.id}
                                            onClick={() => onProjectClick(project)}
                                            className="group h-full min-h-[136px] rounded-xl border border-white/5 bg-sparkle-card p-3 text-left transition-all hover:-translate-y-1 hover:border-white/15"
                                        >
                                            <div className="mb-2 flex items-center justify-between">
                                                <div className="rounded-lg border border-white/5 bg-sparkle-bg p-2">
                                                    <ProjectIcon projectType={project.type} framework={project.frameworks?.[0]} size={20} />
                                                </div>
                                                <span className="text-[10px] text-white/30">{formatRelativeTime(project.lastModified)}</span>
                                            </div>
                                            <p className={cn('text-sm font-semibold text-white/85 group-hover:text-white leading-5', WRAP_AND_CLAMP_2)} title={project.name}>{project.name}</p>
                                            <p className="truncate text-[10px] text-white/40" title={typeInfo?.displayName || project.type}>{typeInfo?.displayName || project.type}</p>
                                        </button>
                                    )
                                }

                                if (entry.kind === 'file') {
                                    const file = entry.payload as FileItem
                                    const isText = file.extension === 'md' || file.extension === 'txt'
                                    const iconColor = getFileColor(file.extension)
                                    if (isFinderMode) {
                                        return (
                                            <FinderItem
                                                key={entry.id}
                                                icon={isText ? FileText : FileCode}
                                                iconClassName="text-white/20"
                                                title={file.name}
                                                subtitle={formatFileSize(file.size)}
                                                tag={file.extension}
                                                tagColor={iconColor}
                                                onClick={() => onOpenFilePreview(file)}
                                            />
                                        )
                                    }

                                    return (
                                        <button
                                            key={entry.id}
                                            onClick={() => onOpenFilePreview(file)}
                                            className="group h-full min-h-[136px] rounded-xl border border-white/5 bg-sparkle-card p-3 text-left transition-all hover:-translate-y-1 hover:border-blue-400/30 hover:bg-blue-400/5 cursor-pointer flex flex-col"
                                        >
                                            <div className="mb-2 inline-flex w-fit rounded-lg border border-white/5 bg-sparkle-bg p-2">
                                                {isText ? <FileText size={16} style={{ color: iconColor }} /> : <FileCode size={16} style={{ color: iconColor }} />}
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <p className={cn('text-sm text-white/80 group-hover:text-white transition-colors leading-5', WRAP_AND_CLAMP_2)} title={file.name}>{file.name}</p>
                                                <p className="text-[10px] text-white/30">{formatFileSize(file.size)}</p>
                                            </div>
                                            <div className="mt-2">
                                                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] text-sparkle-text-secondary bg-sparkle-card-hover">
                                                    <FileCode size={12} />
                                                    Preview
                                                </span>
                                            </div>
                                        </button>
                                    )
                                }

                                const isGit = entry.kind === 'git'
                                const folder = entry.payload as FolderItem
                                if (isFinderMode) {
                                    return (
                                        <FinderItem
                                            key={entry.id}
                                            icon={isGit ? Github : Folder}
                                            iconClassName={isGit ? 'text-white' : 'text-yellow-400'}
                                            title={entry.name}
                                            subtitle={isGit ? 'Git Repo' : 'Folder'}
                                            onClick={() => onFolderClick(folder)}
                                        />
                                    )
                                }

                                return (
                                    <button
                                        key={entry.id}
                                        onClick={() => onFolderClick(folder)}
                                        className="group h-full min-h-[136px] rounded-xl border border-white/5 bg-sparkle-card p-3 text-left transition-all hover:-translate-y-1 hover:border-white/15 flex flex-col"
                                    >
                                        <div className="mb-2 inline-flex w-fit rounded-lg border border-white/5 bg-sparkle-bg p-2">
                                            {isGit ? (
                                                <Github size={16} className="text-white/80 group-hover:text-white transition-colors" />
                                            ) : (
                                                <Folder size={16} className="text-yellow-400/70 group-hover:text-yellow-400 transition-colors" />
                                            )}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <p className={cn('text-sm text-white/70 group-hover:text-white transition-colors leading-5', WRAP_AND_CLAMP_2)} title={entry.name}>{entry.name}</p>
                                            <p className="text-[10px] text-white/30">{isGit ? 'Git Repo' : 'Folder'}</p>
                                        </div>
                                        <ChevronRight size={12} className="text-white/20 group-hover:text-white/60 mt-2 transition-colors" />
                                    </button>
                                )
                            })}
                        </div>
                        {hasMoreFiles && (
                            <div className="mt-4 flex justify-center">
                                <button
                                    onClick={onLoadMoreFiles}
                                    className="px-4 py-2 text-sm rounded-lg border border-white/15 text-white/80 hover:text-white hover:border-white/30 bg-sparkle-card/60 hover:bg-sparkle-card transition-colors"
                                >
                                    Show more files
                                </button>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center py-16 bg-sparkle-card rounded-xl border border-sparkle-border">
                        <FileCode size={48} className="text-sparkle-text-muted mb-4" />
                        <h3 className="text-lg font-medium text-sparkle-text mb-2">
                            {searchQuery ? 'No Matching Items' : 'Empty Folder'}
                        </h3>
                        <p className="text-sparkle-text-secondary text-center max-w-md">
                            {searchQuery
                                ? 'Try adjusting your search criteria.'
                                : 'This folder does not contain any projects, files, or subfolders.'}
                        </p>
                    </div>
                )}
            </div>
        )
    }

    return (
        <div className="space-y-8">
            {filteredFolders.length > 0 && (
                <div>
                    <SectionHeader icon={Folder} iconClassName="text-yellow-400/70" title="Folders" count={filteredFolders.length} />
                    <div className={cn(
                        "grid gap-4",
                        viewMode === 'finder'
                            ? "grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-8 xl:grid-cols-10"
                            : "grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2"
                    )}>
                        {filteredFolders.map((folder) => (
                            viewMode === 'finder' ? (
                                <FinderItem
                                    key={folder.path}
                                    icon={Folder}
                                    iconClassName="text-yellow-400"
                                    title={folder.name}
                                    onClick={() => onFolderClick(folder)}
                                />
                            ) : (
                                <button
                                    key={folder.path}
                                    onClick={() => onFolderClick(folder)}
                                    className="flex items-center gap-2 p-2.5 bg-sparkle-card/50 rounded-lg border border-white/5 hover:border-white/20 hover:bg-white/5 transition-all text-left group"
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
                    <SectionHeader icon={Github} iconClassName="text-white/70" title="Git Repositories" count={gitRepos.length} />
                    <div className={cn(
                        "grid gap-4",
                        viewMode === 'finder'
                            ? "grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-8 xl:grid-cols-10"
                            : "grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2"
                    )}>
                        {gitRepos.map((repo) => (
                            viewMode === 'finder' ? (
                                <FinderItem
                                    key={repo.path}
                                    icon={Github}
                                    iconClassName="text-white"
                                    title={repo.name}
                                    subtitle="Git Repo"
                                    onClick={() => onFolderClick({ name: repo.name, path: repo.path, isProject: true })}
                                />
                            ) : (
                                <button
                                    key={repo.path}
                                    onClick={() => onFolderClick({ name: repo.name, path: repo.path, isProject: true })}
                                    className="flex items-center gap-2 p-2.5 bg-white/5 rounded-lg border border-white/10 hover:border-white/30 hover:bg-white/10 transition-all text-left group relative"
                                    title={repo.name}
                                >
                                    <div className="p-1.5 rounded-md bg-white/10 flex-shrink-0">
                                        <Github size={16} className="text-white" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <span className={cn('text-sm text-white font-medium block leading-5', WRAP_AND_CLAMP_2)}>{repo.name}</span>
                                        <span className="text-[10px] text-white/40 uppercase tracking-wide">Git Repo</span>
                                    </div>
                                    <ChevronRight size={12} className="text-white/20 group-hover:text-white/60 ml-auto flex-shrink-0 transition-colors" />
                                </button>
                            )
                        ))}
                    </div>
                </div>
            )}

            {totalFilteredFiles > 0 && (
                <div>
                    <SectionHeader icon={File} iconClassName="text-blue-400/70" title="Files" count={totalFilteredFiles} />
                    <div className={cn(
                        "grid gap-4",
                        viewMode === 'finder'
                            ? "grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-8 xl:grid-cols-10"
                            : "grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2"
                    )}>
                        {visibleFiles.map((file) => {
                            const iconColor = getFileColor(file.extension)
                            const isText = file.extension === 'md' || file.extension === 'txt'
                            return viewMode === 'finder' ? (
                                <FinderItem
                                    key={file.path}
                                    icon={isText ? FileText : FileCode}
                                    iconClassName="text-white/20"
                                    title={file.name}
                                    subtitle={formatFileSize(file.size)}
                                    tag={file.extension}
                                    tagColor={iconColor}
                                    onClick={() => onOpenFilePreview(file)}
                                />
                            ) : (
                                <div
                                    key={file.path}
                                    onClick={() => onOpenFilePreview(file)}
                                    className="flex items-center gap-2.5 p-2.5 bg-sparkle-card/50 rounded-lg border border-white/5 hover:border-blue-400/30 hover:bg-blue-400/5 transition-all group cursor-pointer"
                                    title={file.name}
                                >
                                    <div
                                        className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                                        style={{ backgroundColor: `${iconColor}15` }}
                                    >
                                        {isText ? (
                                            <FileText size={16} style={{ color: iconColor }} />
                                        ) : (
                                            <FileCode size={16} style={{ color: iconColor }} />
                                        )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className={cn('text-sm text-white/80 group-hover:text-white transition-colors leading-5', WRAP_AND_CLAMP_2)}>{file.name}</p>
                                        <p className="text-[10px] text-white/30">{formatFileSize(file.size)}</p>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                    {hasMoreFiles && (
                        <div className="mt-4 flex justify-center">
                            <button
                                onClick={onLoadMoreFiles}
                                className="px-4 py-2 text-sm rounded-lg border border-white/15 text-white/80 hover:text-white hover:border-white/30 bg-sparkle-card/60 hover:bg-sparkle-card transition-colors"
                            >
                                Show more files
                            </button>
                        </div>
                    )}
                </div>
            )}

            {displayedProjects.length > 0 && (
                <div>
                    <SectionHeader icon={Code} iconClassName="text-sparkle-accent" title="Projects" count={displayedProjects.length} />

                    <div
                        className={cn(
                            'grid gap-4',
                            viewMode === 'finder' && 'grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-8 xl:grid-cols-10 gap-x-2 gap-y-6',
                            viewMode === 'grid' && 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
                        )}
                    >
                        {displayedProjects.map((project) => (
                            <FolderBrowseProjectCard
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

            {displayedProjects.length === 0 && filteredFolders.length === 0 && gitRepos.length === 0 && totalFilteredFiles === 0 && !error && (
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
