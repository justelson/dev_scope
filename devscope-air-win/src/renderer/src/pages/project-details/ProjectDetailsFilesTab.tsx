import { startTransition } from 'react'
import {
    Search, RefreshCw, ChevronsDownUp, ChevronsUpDown, Eye, EyeOff,
    ChevronUp, ChevronDown, ChevronRight, AppWindow, ClipboardPaste, Copy,
    ExternalLink, FolderOpen, Pencil, Trash2
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatFileSize } from './fileTreeUtils'
import { getFileIcon } from './fileIcons'
import { AnimatedHeight } from '@/components/ui/AnimatedHeight'
import { FileActionsMenu } from '@/components/ui/FileActionsMenu'

interface ProjectDetailsFilesTabProps {
    [key: string]: any
}

const EMPTY_SET = new Set<string>()

export function ProjectDetailsFilesTab(props: ProjectDetailsFilesTabProps) {
    const {
        fileSearch,
        setFileSearch,
        setIsExpandingFolders,
        expandedFolders,
        setExpandedFolders,
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
        openPreview,
        onFileTreeOpen,
        onFileTreeOpenWith,
        onFileTreeOpenInExplorer,
        onFileTreeCopyPath,
        onFileTreeCopy,
        onFileTreeRename,
        onFileTreeDelete,
        onFileTreePaste,
        hasFileClipboardItem,
        loadingFiles
    } = props

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
                    onClick={() => {
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

            <div className="flex-1 overflow-y-auto custom-scrollbar">
                {loadingFiles ? (
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
                    visibleFileList.map(({ node, depth, isExpanded, isFolder, ext, isPreviewable, childInfo }: any) => (
                        <div
                            key={node.path}
                            className={cn(
                                "grid grid-cols-12 gap-2 px-4 py-2 border-b border-white/5 hover:bg-white/5 transition-colors group cursor-pointer",
                                node.isHidden && "opacity-50"
                            )}
                            style={{ paddingLeft: `${16 + depth * 20}px` }}
                            onClick={() => {
                                if (isFolder) {
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
                                    openPreview({ name: node.name, path: node.path }, ext)
                                }
                            }}
                        >
                            <div className="col-span-6 flex items-center gap-2 min-w-0">
                                {isFolder ? (
                                    <ChevronRight size={14} className={cn("text-white/30 transition-transform", isExpanded && "rotate-90")} />
                                ) : (
                                    <span className="w-3.5" />
                                )}
                                {getFileIcon(node.name, isFolder, isExpanded)}
                                <span className={cn(
                                    "text-sm truncate",
                                    isFolder ? "text-white/80 font-medium" : "text-white/60",
                                    node.gitStatus === 'modified' && "text-[#E2C08D]",
                                    node.gitStatus === 'added' && "text-[#73C991]",
                                    node.gitStatus === 'untracked' && "text-[#73C991]",
                                    node.gitStatus === 'deleted' && "text-[#FF6B6B] line-through"
                                )}>
                                    {node.name}
                                </span>
                                {node.gitStatus && node.gitStatus !== 'ignored' && node.gitStatus !== 'unknown' && (
                                    <span className={cn(
                                        "text-[9px] uppercase font-bold px-1 py-0.5 rounded shrink-0",
                                        node.gitStatus === 'modified' && "bg-[#E2C08D]/20 text-[#E2C08D]",
                                        node.gitStatus === 'added' && "bg-[#73C991]/20 text-[#73C991]",
                                        node.gitStatus === 'untracked' && "bg-[#73C991]/20 text-[#73C991]",
                                        node.gitStatus === 'deleted' && "bg-[#FF6B6B]/20 text-[#FF6B6B]"
                                    )}>
                                        {node.gitStatus.charAt(0)}
                                    </span>
                                )}
                            </div>

                            <div className="col-span-2 flex items-center">
                                <span className="text-xs text-white/40 uppercase">
                                    {isFolder ? 'Folder' : ext || '-'}
                                </span>
                            </div>

                            <div className="col-span-2 flex items-center">
                                <span className="text-xs text-white/40 font-mono">
                                    {isFolder ? '-' : formatFileSize(node.size)}
                                </span>
                            </div>

                            <div className="col-span-2 flex items-center justify-end gap-2">
                                {isFolder && childInfo && (
                                    <span className="text-[10px] text-white/30">
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
                    ))
                )}
            </div>
        </div>
    )
}
