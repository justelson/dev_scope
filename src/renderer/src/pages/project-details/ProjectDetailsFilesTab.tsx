import { startTransition, useCallback, useMemo, useState, type DragEvent } from 'react'
import {
    Search, RefreshCw, ChevronsDownUp, ChevronsUpDown, Eye, EyeOff,
    ChevronUp, ChevronDown, ChevronRight, AppWindow, ClipboardPaste, Copy,
    ExternalLink, FolderOpen, Plus, Pencil, Trash2
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { buildMediaPreviewSources } from '@/components/ui/file-preview/utils'
import { formatFileSize } from './fileTreeUtils'
import { VscodeEntryIcon } from '@/components/ui/VscodeEntryIcon'
import { useSettings } from '@/lib/settings'
import { AnimatedHeight } from '@/components/ui/AnimatedHeight'
import { FileActionsMenu } from '@/components/ui/FileActionsMenu'
import { normalizeFileSystemPath, getParentFolderPath } from './projectDetailsPageHelpers'

interface ProjectDetailsFilesTabProps {
    [key: string]: any
}

const EMPTY_SET = new Set<string>()

type FileGitStatus = 'modified' | 'untracked' | 'added' | 'deleted' | 'renamed' | 'ignored' | 'unknown' | undefined

function getGitStatusVisual(status: FileGitStatus) {
    switch (status) {
        case 'modified':
            return {
                nameClass: 'font-semibold',
                metaClass: '!text-[#EAC883]',
                nameColor: '#F6D38F',
                metaColor: '',
                pulseColor: '#E2C08D',
                badgeClass: 'bg-[#E2C08D]/30 text-[#F4D6A7]',
                badgeLabel: 'M'
            }
        case 'added':
            return {
                nameClass: 'font-semibold',
                metaClass: '!text-[#86E0A2]',
                nameColor: '#9AF3B5',
                metaColor: '',
                pulseColor: '#73C991',
                badgeClass: 'bg-[#73C991]/30 text-[#8DE2AA]',
                badgeLabel: 'A'
            }
        case 'untracked':
            return {
                nameClass: 'font-semibold',
                metaClass: '!text-[#86E0A2]',
                nameColor: '#9AF3B5',
                metaColor: '',
                pulseColor: '#73C991',
                badgeClass: 'bg-[#73C991]/30 text-[#8DE2AA]',
                badgeLabel: 'U'
            }
        case 'deleted':
            return {
                nameClass: 'font-semibold line-through',
                metaClass: '!text-[#EF8A8A]',
                nameColor: '#FF9A9A',
                metaColor: '',
                pulseColor: '#FF6B6B',
                badgeClass: 'bg-[#FF6B6B]/30 text-[#FF8A8A]',
                badgeLabel: 'D'
            }
        case 'renamed':
            return {
                nameClass: 'font-semibold',
                metaClass: '!text-[#78BFF5]',
                nameColor: '#88CCFF',
                metaColor: '',
                pulseColor: '#60A5FA',
                badgeClass: 'bg-blue-500/30 text-blue-300',
                badgeLabel: 'R'
            }
        default:
            return {
                nameClass: '',
                metaClass: '',
                nameColor: '',
                metaColor: '',
                pulseColor: '',
                badgeClass: '',
                badgeLabel: ''
            }
    }
}

function statusPriority(status: FileGitStatus): number {
    switch (status) {
        case 'deleted': return 5
        case 'modified': return 4
        case 'renamed': return 3
        case 'added':
        case 'untracked':
            return 2
        default:
            return 0
    }
}

export function ProjectDetailsFilesTab(props: ProjectDetailsFilesTabProps) {
    const {
        fileSearch,
        setFileSearch,
        setIsExpandingFolders,
        expandedFolders,
        setExpandedFolders,
        loadingFolderPaths,
        allFolderPathsSet,
        isExpandingFolders,
        showHidden,
        setShowHidden,
        fileTree,
        sortBy,
        setSortBy,
        sortAsc,
        setSortAsc,
        visibleFileList,
        changedFiles,
        project,
        openPreview,
        onFileTreeOpen,
        onFileTreeOpenWith,
        onFileTreeOpenInExplorer,
        onFileTreeCopyPath,
        onFileTreeCopy,
        onFileTreeRename,
        onFileTreeDelete,
        onFileTreePaste,
        onFileTreeMove,
        onFileTreeCreateFile,
        onFileTreeCreateFolder,
        hasFileClipboardItem,
        loadingFiles,
        refreshFileTree,
        onToggleFolder,
        onToggleAllFolders
    } = props

    const { settings } = useSettings()
    const iconTheme = settings.theme === 'light' ? 'light' : 'dark'
    const renderEntryIcon = (pathValue: string, kind: 'file' | 'directory') => (
        <VscodeEntryIcon pathValue={pathValue} kind={kind} theme={iconTheme} className="size-3.5 shrink-0" />
    )
    const projectRootPath = useMemo(() => normalizeFileSystemPath(project?.path || ''), [project?.path])
    const [draggedNode, setDraggedNode] = useState<any | null>(null)
    const [dragOverPath, setDragOverPath] = useState<string | null>(null)
    const [isDragging, setIsDragging] = useState(false)
    const normalizedDragOverPath = useMemo(() => {
        if (!dragOverPath || dragOverPath === '__root__') return null
        return normalizeFileSystemPath(dragOverPath)
    }, [dragOverPath])

    const changedStatusLookup = useMemo(() => {
        const lookup = new Map<string, Exclude<FileGitStatus, undefined>>()
        for (const file of (changedFiles || [])) {
            const status = file?.gitStatus as Exclude<FileGitStatus, undefined>
            const relPath = normalizeFileSystemPath(file?.path || '')
            if (!status || !relPath) continue
            lookup.set(relPath, status)
            if (projectRootPath) {
                lookup.set(normalizeFileSystemPath(`${projectRootPath}/${relPath}`), status)
            }
        }
        return lookup
    }, [changedFiles, projectRootPath])

    const changedPathList = useMemo(() => {
        const paths: string[] = []
        for (const file of (changedFiles || [])) {
            const relPath = normalizeFileSystemPath(file?.path || '')
            if (!relPath) continue
            paths.push(relPath)
            if (projectRootPath) {
                paths.push(normalizeFileSystemPath(`${projectRootPath}/${relPath}`))
            }
        }
        return paths
    }, [changedFiles, projectRootPath])

    const resolveNodeStatus = (node: any): FileGitStatus => {
        const fromNode = node.gitStatus as FileGitStatus
        if (fromNode && fromNode !== 'unknown' && fromNode !== 'ignored') return fromNode
        const normalizedNodePath = normalizeFileSystemPath(node.path || '')
        return changedStatusLookup.get(normalizedNodePath)
    }

    const resolveDirectStatus = (node: any): FileGitStatus => {
        const normalizedNodePath = normalizeFileSystemPath(node.path || '')
        const direct = changedStatusLookup.get(normalizedNodePath)
        if (direct && direct !== 'unknown' && direct !== 'ignored') return direct
        return undefined
    }

    const folderHasNestedChanges = (folderPath: string): boolean => {
        const normalizedFolderPath = normalizeFileSystemPath(folderPath)
        if (!normalizedFolderPath) return false
        return changedPathList.some((changedPath) => (
            changedPath === normalizedFolderPath
            || changedPath.startsWith(`${normalizedFolderPath}/`)
        ))
    }

    const resolveFolderNestedStatus = (folderPath: string): FileGitStatus => {
        const normalizedFolderPath = normalizeFileSystemPath(folderPath)
        if (!normalizedFolderPath) return undefined

        let best: FileGitStatus = undefined
        for (const [pathKey, status] of changedStatusLookup.entries()) {
            if (pathKey === normalizedFolderPath || pathKey.startsWith(`${normalizedFolderPath}/`)) {
                if (statusPriority(status) > statusPriority(best)) {
                    best = status
                }
            }
        }
        return best
    }

    const resolveDropDestination = useCallback((targetNode?: any): string | null => {
        if (!project?.path) return null
        if (!targetNode) return project.path
        if (targetNode.type === 'directory') return targetNode.path
        return getParentFolderPath(targetNode.path) || project.path
    }, [project?.path])

    const isMoveAllowed = useCallback((sourceNode: any, destinationDirectory: string | null) => {
        if (!sourceNode?.path || !destinationDirectory) return false
        const normalizedSourcePath = normalizeFileSystemPath(sourceNode.path)
        const normalizedDestDir = normalizeFileSystemPath(destinationDirectory)
        if (!normalizedSourcePath || !normalizedDestDir) return false
        const sourceParent = getParentFolderPath(sourceNode.path)
        if (sourceParent && normalizeFileSystemPath(sourceParent) === normalizedDestDir) return false
        if (sourceNode.type === 'directory') {
            if (normalizedDestDir === normalizedSourcePath) return false
            if (normalizedDestDir.startsWith(`${normalizedSourcePath}/`)) return false
        }
        return true
    }, [])

    const handleDragStart = useCallback((event: DragEvent, node: any) => {
        event.stopPropagation()
        event.dataTransfer.effectAllowed = 'move'
        event.dataTransfer.setData('text/plain', node.path)
        setDraggedNode(node)
        setIsDragging(true)
    }, [])

    const handleDragEnd = useCallback(() => {
        setDraggedNode(null)
        setDragOverPath(null)
        setIsDragging(false)
    }, [])

    const handleDragOver = useCallback((event: DragEvent, node?: any) => {
        if (!draggedNode) return
        event.preventDefault()
        const destinationDirectory = resolveDropDestination(node)
        const allowed = isMoveAllowed(draggedNode, destinationDirectory)
        event.dataTransfer.dropEffect = allowed ? 'move' : 'none'
        if (!allowed) {
            setDragOverPath(null)
            return
        }
        if (!destinationDirectory) {
            setDragOverPath(null)
            return
        }
        if (!node?.path) {
            setDragOverPath('__root__')
        } else {
            setDragOverPath(destinationDirectory)
        }
    }, [draggedNode, isMoveAllowed, resolveDropDestination])

    const handleDragLeave = useCallback((event: DragEvent, node?: any) => {
        if (!draggedNode) return
        const related = event.relatedTarget as Node | null
        if (related && event.currentTarget.contains(related)) return
        const destinationDirectory = resolveDropDestination(node)
        if (node?.path && destinationDirectory && dragOverPath === destinationDirectory) {
            setDragOverPath(null)
        } else if (!node?.path && dragOverPath === '__root__') {
            setDragOverPath(null)
        }
    }, [draggedNode, dragOverPath, resolveDropDestination])

    const handleDrop = useCallback(async (event: DragEvent, targetNode?: any) => {
        if (!draggedNode) return
        event.preventDefault()
        event.stopPropagation()
        const destinationDirectory = resolveDropDestination(targetNode)
        if (!isMoveAllowed(draggedNode, destinationDirectory)) {
            handleDragEnd()
            return
        }
        if (onFileTreeMove) {
            await onFileTreeMove(draggedNode, destinationDirectory)
        }
        handleDragEnd()
    }, [draggedNode, handleDragEnd, isMoveAllowed, onFileTreeMove, resolveDropDestination])

    return (
        <div className="flex flex-col h-full">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-white/5 bg-white/[0.02]">
                <div className="relative flex-1">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
                    <input
                        type="text"
                        value={fileSearch}
                        onChange={(e) => setFileSearch(e.target.value)}
                        placeholder="Search files..."
                        className="w-full bg-white/5 border border-white/10 rounded-lg pl-9 pr-3 py-1.5 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-white/20 transition-all"
                    />
                </div>

                <button
                    onClick={() => { void refreshFileTree?.() }}
                    disabled={loadingFiles}
                    className={cn(
                        "p-2 rounded-lg transition-all",
                        loadingFiles
                            ? "opacity-50 cursor-not-allowed text-white/30"
                            : "text-white/40 hover:text-white hover:bg-white/5"
                    )}
                    title="Refresh files"
                >
                    <RefreshCw size={16} className={cn(loadingFiles && "animate-spin")} />
                </button>

                <button
                    onClick={() => {
                        if (onToggleAllFolders) {
                            void onToggleAllFolders()
                            return
                        }
                        setIsExpandingFolders(true)
                        startTransition(() => {
                            if (expandedFolders.size > 0) {
                                setExpandedFolders(EMPTY_SET)
                            } else {
                                setExpandedFolders(allFolderPathsSet)
                            }
                            setTimeout(() => setIsExpandingFolders(false), 300)
                        })
                    }}
                    disabled={isExpandingFolders}
                    className={cn(
                        "p-2 rounded-lg transition-all",
                        isExpandingFolders && "opacity-50 cursor-not-allowed",
                        expandedFolders.size > 0 ? "text-white/60 hover:text-white hover:bg-white/5" : "text-white/40 hover:text-white hover:bg-white/5"
                    )}
                    title={isExpandingFolders ? "Loading..." : expandedFolders.size > 0 ? "Collapse all folders" : "Expand all folders"}
                >
                    {isExpandingFolders ? (
                        <RefreshCw size={16} className="animate-spin" />
                    ) : expandedFolders.size > 0 ? (
                        <ChevronsDownUp size={16} />
                    ) : (
                        <ChevronsUpDown size={16} />
                    )}
                </button>

                <button
                    onClick={() => setShowHidden(!showHidden)}
                    className={cn(
                        "p-2 rounded-lg transition-all",
                        showHidden ? "bg-white/10 text-white" : "text-white/40 hover:text-white hover:bg-white/5"
                    )}
                    title={showHidden ? "Hide hidden files" : "Show hidden files"}
                >
                    {showHidden ? <Eye size={16} /> : <EyeOff size={16} />}
                </button>
                <FileActionsMenu
                    title="Create"
                    buttonClassName="!h-auto !w-auto !rounded-lg !border-transparent !bg-transparent !p-2 text-white/40 hover:text-white hover:!bg-white/5"
                    triggerIcon={<Plus size={16} className="mx-auto" />}
                    items={[
                        {
                            id: 'new-file-type',
                            label: 'New File (Choose Type...)',
                            icon: renderEntryIcon('file', 'file'),
                            onSelect: () => onFileTreeCreateFile()
                        },
                        {
                            id: 'new-md-file',
                            label: 'Markdown (.md)',
                            icon: renderEntryIcon('file.md', 'file'),
                            onSelect: () => onFileTreeCreateFile(undefined, 'md')
                        },
                        {
                            id: 'new-json-file',
                            label: 'JSON (.json)',
                            icon: renderEntryIcon('file.json', 'file'),
                            onSelect: () => onFileTreeCreateFile(undefined, 'json')
                        },
                        {
                            id: 'new-ts-file',
                            label: 'TypeScript (.ts)',
                            icon: renderEntryIcon('file.ts', 'file'),
                            onSelect: () => onFileTreeCreateFile(undefined, 'ts')
                        },
                        {
                            id: 'new-txt-file',
                            label: 'Text (.txt)',
                            icon: renderEntryIcon('file.txt', 'file'),
                            onSelect: () => onFileTreeCreateFile(undefined, 'txt')
                        },
                        {
                            id: 'new-folder',
                            label: 'New Folder',
                            icon: renderEntryIcon('folder', 'directory'),
                            onSelect: () => onFileTreeCreateFolder()
                        }
                    ]}
                />

                <span className="text-xs text-white/40 whitespace-nowrap">
                    {fileTree.length} items
                </span>
            </div>

            <div className="grid grid-cols-12 gap-2 px-4 py-2 border-b border-white/5 text-[10px] uppercase tracking-wider text-white/30 font-medium bg-black/10">
                <div className="col-span-6 flex items-center gap-1 cursor-pointer hover:text-white/50" onClick={() => { setSortBy('name'); setSortAsc(sortBy === 'name' ? !sortAsc : true) }}>
                    Name {sortBy === 'name' && (sortAsc ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}
                </div>
                <div className="col-span-2 flex items-center gap-1 cursor-pointer hover:text-white/50" onClick={() => { setSortBy('type'); setSortAsc(sortBy === 'type' ? !sortAsc : true) }}>
                    Type {sortBy === 'type' && (sortAsc ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}
                </div>
                <div className="col-span-2 flex items-center gap-1 cursor-pointer hover:text-white/50" onClick={() => { setSortBy('size'); setSortAsc(sortBy === 'size' ? !sortAsc : true) }}>
                    Size {sortBy === 'size' && (sortAsc ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}
                </div>
                <div className="col-span-2 text-right">Info</div>
            </div>

                <div
                    className={cn(
                        "project-surface-scrollbar flex-1 overflow-y-auto",
                        isDragging && dragOverPath === '__root__' && "bg-white/[0.03]"
                    )}
                    onDragOver={(event) => handleDragOver(event)}
                    onDragLeave={(event) => handleDragLeave(event)}
                    onDrop={(event) => { void handleDrop(event) }}
                >
                {loadingFiles && visibleFileList.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 opacity-60">
                        <div className="w-10 h-10 rounded-full border-2 border-[var(--accent-primary)]/20 border-t-[var(--accent-primary)] animate-spin mb-5" />
                        <div className="text-white font-medium text-lg">Loading files...</div>
                    </div>
                ) : visibleFileList.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-white/30">
                        <Search size={32} className="mb-3 opacity-30" />
                        <p className="text-sm">No files found</p>
                        {fileSearch && (
                            <button
                                onClick={() => setFileSearch('')}
                                className="mt-2 text-xs text-[var(--accent-primary)] hover:underline"
                            >
                                Clear search
                            </button>
                        )}
                    </div>
                ) : (
                    visibleFileList.map(({ node, depth, isExpanded, isFolder, ext, isPreviewable, childInfo }: any) => {
                        const normalizedNodePath = normalizeFileSystemPath(node.path || '')
                        const isDragTarget = Boolean(
                            normalizedDragOverPath
                            && (normalizedNodePath === normalizedDragOverPath
                                || normalizedNodePath.startsWith(`${normalizedDragOverPath}/`))
                        )
                        const isDragTargetRoot = normalizedDragOverPath && normalizedNodePath === normalizedDragOverPath
                        const directStatus = resolveDirectStatus(node)
                        const hasNestedChanges = isFolder && folderHasNestedChanges(node.path)
                        const nestedStatus = isFolder ? resolveFolderNestedStatus(node.path) : undefined
                        const effectiveStatus = resolveNodeStatus(node) || nestedStatus || (hasNestedChanges ? 'modified' : undefined)
                        const effectiveVisual = getGitStatusVisual(effectiveStatus)
                        const directVisual = getGitStatusVisual(directStatus)
                        const hasStatusNameColor = Boolean(effectiveVisual.nameColor)
                        const isFolderLoading = Boolean(isFolder && loadingFolderPaths?.has(node.path))
                        return (
                            <div
                                key={node.path}
                                className={cn(
                                    "grid grid-cols-12 gap-2 px-4 py-0.5 border-b border-white/5 hover:bg-white/5 transition-colors group cursor-pointer",
                                    node.isHidden && "opacity-50",
                                    isDragTarget && "bg-white/[0.03]",
                                    isDragTargetRoot && "bg-white/[0.06] border-white/20"
                                )}
                                style={{ paddingLeft: `${12 + depth * 16}px` }}
                                draggable
                                onDragStart={(event) => handleDragStart(event, node)}
                                onDragEnd={handleDragEnd}
                                onDragOver={(event) => {
                                    event.stopPropagation()
                                    handleDragOver(event, node)
                                }}
                                onDragLeave={(event) => {
                                    event.stopPropagation()
                                    handleDragLeave(event, node)
                                }}
                                onDrop={(event) => { void handleDrop(event, node) }}
                                onClick={() => {
                                    if (isFolder) {
                                        if (onToggleFolder) {
                                            void onToggleFolder(node)
                                            return
                                        }
                                        startTransition(() => {
                                            setExpandedFolders((prev: Set<string>) => {
                                                const next = new Set(prev)
                                                if (next.has(node.path)) {
                                                    next.delete(node.path)
                                                } else {
                                                    next.add(node.path)
                                                }
                                                return next
                                            })
                                        })
                                    } else {
                                        void openPreview(
                                            { name: node.name, path: node.path },
                                            ext,
                                            {
                                                mediaItems: buildMediaPreviewSources(visibleFileList
                                                    .filter((entry: any) => !entry.isFolder)
                                                    .map((entry: any) => ({
                                                        name: entry.node.name,
                                                        path: entry.node.path,
                                                        extension: entry.ext
                                                    })))
                                            }
                                        )
                                    }
                                }}
                            >
                                    <div className="col-span-6 flex items-center gap-2 min-w-0">
                                        {isFolder ? (
                                            isFolderLoading ? (
                                                <RefreshCw size={12} className="text-white/40 animate-spin" />
                                            ) : (
                                                <ChevronRight size={12} className={cn("text-white/30 transition-transform", isExpanded && "rotate-90")} />
                                            )
                                        ) : (
                                            <span className="w-3" />
                                        )}
                                        <VscodeEntryIcon
                                            pathValue={node.path || node.name}
                                            kind={isFolder ? 'directory' : 'file'}
                                            theme={iconTheme}
                                            className="shrink-0"
                                        />
                                        <span className={cn(
                                            "text-[14px] truncate",
                                            !hasStatusNameColor && (isFolder ? "text-white/80 font-medium" : "text-white/60"),
                                            effectiveVisual.nameClass
                                        )}
                                        style={effectiveVisual.nameColor ? { color: effectiveVisual.nameColor } : undefined}
                                        >
                                            {node.name}
                                        </span>
                                        {isFolder && hasNestedChanges && (
                                            <span className="relative inline-flex w-3.5 h-3.5 shrink-0">
                                                <span
                                                    className="absolute inset-[1px] rounded-full border"
                                                    style={{ borderColor: effectiveVisual.pulseColor || '#7dd3fc', backgroundColor: 'rgba(255,255,255,0.16)' }}
                                                />
                                                <span
                                                    className="absolute inset-[4px] rounded-full"
                                                    style={{ backgroundColor: effectiveVisual.pulseColor || '#7dd3fc' }}
                                                />
                                            </span>
                                        )}
                                        {isFolder && !hasNestedChanges && (
                                            <span className="w-3.5 h-3.5 shrink-0" />
                                        )}
                                        {!isFolder && (
                                            <span className="w-3.5 h-3.5 shrink-0" />
                                        )}
                                        {directStatus && (
                                            <span className={cn(
                                                "text-[8px] uppercase font-bold px-1 py-0.5 rounded shrink-0",
                                                directVisual.badgeClass
                                            )}>
                                                {directVisual.badgeLabel}
                                            </span>
                                        )}
                                    </div>

                                    <div className="col-span-2 flex items-center">
                                        <span
                                            className={cn("text-[12px] text-white/40 uppercase", effectiveVisual.metaClass)}
                                        >
                                            {isFolder ? 'Folder' : ext || '-'}
                                        </span>
                                    </div>

                                    <div className="col-span-2 flex items-center">
                                        <span
                                            className={cn("text-[12px] text-white/40 font-mono", effectiveVisual.metaClass)}
                                        >
                                            {isFolder ? '-' : formatFileSize(node.size)}
                                        </span>
                                    </div>

                                    <div className="col-span-2 flex items-center justify-end gap-2">
                                        {isFolder && childInfo && (
                                            <span
                                                className={cn("text-[11px] text-white/30", effectiveVisual.metaClass)}
                                            >
                                                {childInfo.folders > 0 && `${childInfo.folders} folders`}
                                                {childInfo.folders > 0 && childInfo.files > 0 && ', '}
                                                {childInfo.files > 0 && `${childInfo.files} files`}
                                            </span>
                                        )}
                                        {isPreviewable && !isFolder && (
                                            <span className="text-[10px] text-[var(--accent-primary)] opacity-0 group-hover:opacity-100 transition-opacity">
                                                Preview
                                            </span>
                                        )}
                                        <FileActionsMenu
                                            title={`${node.name} actions`}
                                            items={[
                                                {
                                                    id: 'open',
                                                    label: 'Open',
                                                    icon: <FolderOpen size={13} />,
                                                    onSelect: () => onFileTreeOpen(node)
                                                },
                                                ...(!isFolder ? [{
                                                    id: 'open-with',
                                                    label: 'Open With...',
                                                    icon: <AppWindow size={13} />,
                                                    onSelect: () => onFileTreeOpenWith(node)
                                                }] : []),
                                                {
                                                    id: 'open-in-explorer',
                                                    label: 'Open in Explorer',
                                                    icon: <ExternalLink size={13} />,
                                                    onSelect: () => onFileTreeOpenInExplorer(node)
                                                },
                                                {
                                                    id: 'copy-path',
                                                    label: 'Copy Path',
                                                    icon: <Copy size={13} />,
                                                    onSelect: () => onFileTreeCopyPath(node)
                                                },
                                                {
                                                    id: 'copy',
                                                    label: 'Copy',
                                                    icon: <Copy size={13} />,
                                                    onSelect: () => onFileTreeCopy(node)
                                                },
                                                {
                                                    id: 'paste',
                                                    label: 'Paste',
                                                    icon: <ClipboardPaste size={13} />,
                                                    disabled: !hasFileClipboardItem,
                                                    onSelect: () => onFileTreePaste(node)
                                                },
                                                {
                                                    id: 'new-file',
                                                    label: 'New File',
                                                    icon: renderEntryIcon('file', 'file'),
                                                    onSelect: () => onFileTreeCreateFile(node)
                                                },
                                                {
                                                    id: 'new-folder',
                                                    label: 'New Folder',
                                                    icon: renderEntryIcon('folder', 'directory'),
                                                    onSelect: () => onFileTreeCreateFolder(node)
                                                },
                                                {
                                                    id: 'rename',
                                                    label: 'Rename',
                                                    icon: <Pencil size={13} />,
                                                    onSelect: () => onFileTreeRename(node)
                                                },
                                                {
                                                    id: 'delete',
                                                    label: 'Delete',
                                                    icon: <Trash2 size={13} />,
                                                    danger: true,
                                                    onSelect: () => onFileTreeDelete(node)
                                                }
                                            ]}
                                        />
                                    </div>
                            </div>
                        )
                    })
                )}
            </div>
        </div>
    )
}
