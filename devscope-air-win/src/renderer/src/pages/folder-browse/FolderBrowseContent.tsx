import { createPortal } from 'react-dom'
import { useEffect, useMemo, useState, type MouseEvent as ReactMouseEvent, type ReactNode } from 'react'
import {
    AppWindow, ClipboardPaste, Copy, ExternalLink, ChevronRight, Code, File,
    FileCode, FileText, Folder, FolderOpen, Github, Pencil, Trash2
} from 'lucide-react'
import ProjectIcon from '@/components/ui/ProjectIcon'
import { cn } from '@/lib/utils'
import { getProjectTypeById, type ContentLayout, type FileItem, type FolderItem, type Project, type ViewMode } from './types'
import { FinderItem, SectionHeader, WRAP_AND_CLAMP_2 } from '../shared/BrowseSectionPrimitives'
import { FolderBrowseProjectCard } from './FolderBrowseProjectCard'

type EntryActionTarget = {
    path: string
    name: string
    type: 'file' | 'directory'
}

interface FileActionsMenuItem {
    id: string
    label: string
    icon?: ReactNode
    onSelect: () => void | Promise<void>
    disabled?: boolean
    danger?: boolean
}

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
    onEntryOpen: (entry: EntryActionTarget) => void | Promise<void>
    onEntryOpenWith: (entry: EntryActionTarget) => void | Promise<void>
    onEntryOpenInExplorer: (entry: EntryActionTarget) => void | Promise<void>
    onEntryCopyPath: (entry: EntryActionTarget) => void | Promise<void>
    onEntryCopy: (entry: EntryActionTarget) => void | Promise<void>
    onEntryRename: (entry: EntryActionTarget) => void | Promise<void>
    onEntryDelete: (entry: EntryActionTarget) => void | Promise<void>
    onEntryPaste: (entry: EntryActionTarget) => void | Promise<void>
    hasFileClipboardItem: boolean
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
    onEntryOpen,
    onEntryOpenWith,
    onEntryOpenInExplorer,
    onEntryCopyPath,
    onEntryCopy,
    onEntryRename,
    onEntryDelete,
    onEntryPaste,
    hasFileClipboardItem,
    formatFileSize,
    getFileColor,
    formatRelativeTime
}: FolderBrowseContentProps) {
    const [contextMenu, setContextMenu] = useState<{
        x: number
        y: number
        title: string
        items: FileActionsMenuItem[]
    } | null>(null)

    const buildEntryActions = (entry: EntryActionTarget): FileActionsMenuItem[] => [
        {
            id: 'open',
            label: 'Open',
            icon: <FolderOpen size={13} />,
            onSelect: () => onEntryOpen(entry)
        },
        ...(entry.type === 'file'
            ? [{
                id: 'open-with',
                label: 'Open With...',
                icon: <AppWindow size={13} />,
                onSelect: () => onEntryOpenWith(entry)
            }]
            : []),
        {
            id: 'open-in-explorer',
            label: 'Open in Explorer',
            icon: <ExternalLink size={13} />,
            onSelect: () => onEntryOpenInExplorer(entry)
        },
        {
            id: 'copy-path',
            label: 'Copy Path',
            icon: <Copy size={13} />,
            onSelect: () => onEntryCopyPath(entry)
        },
        {
            id: 'copy',
            label: 'Copy',
            icon: <Copy size={13} />,
            onSelect: () => onEntryCopy(entry)
        },
        {
            id: 'paste',
            label: 'Paste',
            icon: <ClipboardPaste size={13} />,
            disabled: !hasFileClipboardItem,
            onSelect: () => onEntryPaste(entry)
        },
        {
            id: 'rename',
            label: 'Rename',
            icon: <Pencil size={13} />,
            onSelect: () => onEntryRename(entry)
        },
        {
            id: 'delete',
            label: 'Delete',
            icon: <Trash2 size={13} />,
            danger: true,
            onSelect: () => onEntryDelete(entry)
        }
    ]

    const openEntryContextMenu = (event: ReactMouseEvent<HTMLElement>, entry: EntryActionTarget) => {
        event.preventDefault()
        event.stopPropagation()
        setContextMenu({
            x: event.clientX,
            y: event.clientY,
            title: `${entry.name} actions`,
            items: buildEntryActions(entry)
        })
    }

    useEffect(() => {
        if (!contextMenu) return

        const handlePointerDown = () => setContextMenu(null)
        const handleEscape = (event: KeyboardEvent) => {
            if (event.key === 'Escape') setContextMenu(null)
        }

        document.addEventListener('pointerdown', handlePointerDown)
        document.addEventListener('keydown', handleEscape)
        return () => {
            document.removeEventListener('pointerdown', handlePointerDown)
            document.removeEventListener('keydown', handleEscape)
        }
    }, [contextMenu])

    const contextMenuPosition = useMemo(() => {
        if (!contextMenu || typeof window === 'undefined') return null
        const menuWidth = 220
        const estimatedHeight = 10 + (contextMenu.items.length * 34)
        const margin = 8
        return {
            left: Math.max(margin, Math.min(contextMenu.x, window.innerWidth - menuWidth - margin)),
            top: Math.max(margin, Math.min(contextMenu.y, window.innerHeight - estimatedHeight - margin))
        }
    }, [contextMenu])

    const contextMenuPortal = contextMenu && contextMenuPosition && typeof document !== 'undefined'
        ? createPortal(
            <div
                className="fixed inset-0 z-[170]"
                onClick={() => setContextMenu(null)}
                onContextMenu={(event) => {
                    event.preventDefault()
                    setContextMenu(null)
                }}
            >
                <div
                    className="fixed z-[171] min-w-[220px] max-w-[260px] rounded-xl border border-white/10 bg-sparkle-card p-1 shadow-2xl shadow-black/60"
                    style={{
                        top: `${contextMenuPosition.top}px`,
                        left: `${contextMenuPosition.left}px`
                    }}
                    onClick={(event) => event.stopPropagation()}
                    onPointerDown={(event) => event.stopPropagation()}
                    role="menu"
                    aria-label={contextMenu.title}
                >
                    {contextMenu.items.map((item) => (
                        <button
                            key={item.id}
                            type="button"
                            disabled={item.disabled}
                            onClick={() => {
                                setContextMenu(null)
                                void item.onSelect()
                            }}
                            className={cn(
                                'flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs transition-colors',
                                item.disabled
                                    ? 'cursor-not-allowed text-white/20'
                                    : item.danger
                                        ? 'text-red-200 hover:bg-red-500/15 hover:text-red-100'
                                        : 'text-white/75 hover:bg-white/10 hover:text-white'
                            )}
                            role="menuitem"
                        >
                            {item.icon && <span className="shrink-0">{item.icon}</span>}
                            <span>{item.label}</span>
                        </button>
                    ))}
                </div>
            </div>,
            document.body
        )
        : null

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
            <>
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
                                    const entryTarget: EntryActionTarget = { path: file.path, name: file.name, type: 'file' }
                                    const isText = file.extension === 'md' || file.extension === 'txt'
                                    const iconColor = getFileColor(file.extension)
                                    if (isFinderMode) {
                                        return (
                                            <div
                                                key={entry.id}
                                                className="group mx-auto w-fit"
                                                onContextMenu={(event) => openEntryContextMenu(event, entryTarget)}
                                            >
                                                <FinderItem
                                                    icon={isText ? FileText : FileCode}
                                                    iconClassName="text-white/20"
                                                    title={file.name}
                                                    subtitle={formatFileSize(file.size)}
                                                    tag={file.extension}
                                                    tagColor={iconColor}
                                                    onClick={() => onOpenFilePreview(file)}
                                                />
                                            </div>
                                        )
                                    }

                                    return (
                                        <div
                                            key={entry.id}
                                            className="group relative h-full min-h-[136px] rounded-xl border border-white/5 bg-sparkle-card p-3 text-left transition-all hover:-translate-y-1 hover:border-blue-400/30 hover:bg-blue-400/5 cursor-pointer flex flex-col"
                                            onClick={() => onOpenFilePreview(file)}
                                            onContextMenu={(event) => openEntryContextMenu(event, entryTarget)}
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
                                        </div>
                                    )
                                }

                                const isGit = entry.kind === 'git'
                                const folder = entry.payload as FolderItem
                                const entryTarget: EntryActionTarget = { path: folder.path, name: entry.name, type: 'directory' }
                                if (isFinderMode) {
                                    return (
                                        <div
                                            key={entry.id}
                                            className="group mx-auto w-fit"
                                            onContextMenu={(event) => openEntryContextMenu(event, entryTarget)}
                                        >
                                            <FinderItem
                                                icon={isGit ? Github : Folder}
                                                iconClassName={isGit ? 'text-white' : 'text-yellow-400'}
                                                title={entry.name}
                                                subtitle={isGit ? 'Git Repo' : 'Folder'}
                                                onClick={() => onFolderClick(folder)}
                                            />
                                        </div>
                                    )
                                }

                                return (
                                    <div
                                        key={entry.id}
                                        onClick={() => onFolderClick(folder)}
                                        onContextMenu={(event) => openEntryContextMenu(event, entryTarget)}
                                        className="group relative h-full min-h-[136px] rounded-xl border border-white/5 bg-sparkle-card p-3 text-left transition-all hover:-translate-y-1 hover:border-white/15 flex flex-col cursor-pointer"
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
                {contextMenuPortal}
            </>
        )
    }

    return (
        <>
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
                                <div
                                    key={folder.path}
                                    className="group mx-auto w-fit"
                                    onContextMenu={(event) => openEntryContextMenu(event, { path: folder.path, name: folder.name, type: 'directory' })}
                                >
                                    <FinderItem
                                        icon={Folder}
                                        iconClassName="text-yellow-400"
                                        title={folder.name}
                                        onClick={() => onFolderClick(folder)}
                                    />
                                </div>
                            ) : (
                                <div
                                    key={folder.path}
                                    onClick={() => onFolderClick(folder)}
                                    onContextMenu={(event) => openEntryContextMenu(event, { path: folder.path, name: folder.name, type: 'directory' })}
                                    className="relative flex items-center gap-2 p-2.5 bg-sparkle-card/50 rounded-lg border border-white/5 hover:border-white/20 hover:bg-white/5 transition-all text-left group cursor-pointer"
                                    title={folder.name}
                                >
                                    <Folder size={16} className="text-yellow-400/70 group-hover:text-yellow-400 transition-colors flex-shrink-0" />
                                    <span className={cn('text-sm text-white/70 group-hover:text-white transition-colors leading-5', WRAP_AND_CLAMP_2)}>{folder.name}</span>
                                    <ChevronRight size={12} className="text-white/20 group-hover:text-white/60 ml-auto flex-shrink-0 transition-colors" />
                                </div>
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
                                <div
                                    key={repo.path}
                                    className="group mx-auto w-fit"
                                    onContextMenu={(event) => openEntryContextMenu(event, { path: repo.path, name: repo.name, type: 'directory' })}
                                >
                                    <FinderItem
                                        icon={Github}
                                        iconClassName="text-white"
                                        title={repo.name}
                                        subtitle="Git Repo"
                                        onClick={() => onFolderClick({ name: repo.name, path: repo.path, isProject: true })}
                                    />
                                </div>
                            ) : (
                                <div
                                    key={repo.path}
                                    onClick={() => onFolderClick({ name: repo.name, path: repo.path, isProject: true })}
                                    onContextMenu={(event) => openEntryContextMenu(event, { path: repo.path, name: repo.name, type: 'directory' })}
                                    className="relative flex items-center gap-2 p-2.5 bg-white/5 rounded-lg border border-white/10 hover:border-white/30 hover:bg-white/10 transition-all text-left group cursor-pointer"
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
                                </div>
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
                            const entryTarget: EntryActionTarget = { path: file.path, name: file.name, type: 'file' }
                            return viewMode === 'finder' ? (
                                <div
                                    key={file.path}
                                    className="group mx-auto w-fit"
                                    onContextMenu={(event) => openEntryContextMenu(event, entryTarget)}
                                >
                                    <FinderItem
                                        icon={isText ? FileText : FileCode}
                                        iconClassName="text-white/20"
                                        title={file.name}
                                        subtitle={formatFileSize(file.size)}
                                        tag={file.extension}
                                        tagColor={iconColor}
                                        onClick={() => onOpenFilePreview(file)}
                                    />
                                </div>
                            ) : (
                                <div
                                    key={file.path}
                                    onClick={() => onOpenFilePreview(file)}
                                    onContextMenu={(event) => openEntryContextMenu(event, entryTarget)}
                                    className="relative flex items-center gap-2.5 p-2.5 bg-sparkle-card/50 rounded-lg border border-white/5 hover:border-blue-400/30 hover:bg-blue-400/5 transition-all group cursor-pointer"
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
            {contextMenuPortal}
        </>
    )
}
