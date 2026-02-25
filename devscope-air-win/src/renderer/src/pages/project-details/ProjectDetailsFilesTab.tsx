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

type FileGitStatus = 'modified' | 'untracked' | 'added' | 'deleted' | 'renamed' | 'ignored' | 'unknown' | undefined

function getGitStatusVisual(status: FileGitStatus) {
    switch (status) {
        case 'modified':
            return {
                nameClass: '!text-[#F4D6A7]',
                metaClass: '!text-[#D9BE93]',
                pulseClass: 'bg-[#E2C08D]',
                badgeClass: 'bg-[#E2C08D]/30 text-[#F4D6A7]',
                badgeLabel: 'M'
            }
        case 'added':
            return {
                nameClass: '!text-[#8DE2AA]',
                metaClass: '!text-[#76C895]',
                pulseClass: 'bg-[#73C991]',
                badgeClass: 'bg-[#73C991]/30 text-[#8DE2AA]',
                badgeLabel: 'A'
            }
        case 'untracked':
            return {
                nameClass: '!text-[#8DE2AA]',
                metaClass: '!text-[#76C895]',
                pulseClass: 'bg-[#73C991]',
                badgeClass: 'bg-[#73C991]/30 text-[#8DE2AA]',
                badgeLabel: 'U'
            }
        case 'deleted':
            return {
                nameClass: '!text-[#FF8A8A] line-through',
                metaClass: '!text-[#E07A7A]',
                pulseClass: 'bg-[#FF6B6B]',
                badgeClass: 'bg-[#FF6B6B]/30 text-[#FF8A8A]',
                badgeLabel: 'D'
            }
        case 'renamed':
            return {
                nameClass: '!text-blue-300',
                metaClass: '!text-blue-300/80',
                pulseClass: 'bg-blue-400',
                badgeClass: 'bg-blue-500/30 text-blue-300',
                badgeLabel: 'R'
            }
        default:
            return {
                nameClass: '',
                metaClass: '',
                pulseClass: '',
                badgeClass: '',
                badgeLabel: ''
            }
    }
}

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
                        (() => {
                            const visual = getGitStatusVisual(node.gitStatus)
                            return (
                                <div
                                    key={node.path}
                                    className={cn(
                                        "grid grid-cols-12 gap-2 px-4 py-0.5 border-b border-white/5 hover:bg-white/5 transition-colors group cursor-pointer",
                                        node.isHidden && "opacity-50"
                                    )}
                                    style={{ paddingLeft: `${12 + depth * 16}px` }}
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
                                            <ChevronRight size={12} className={cn("text-white/30 transition-transform", isExpanded && "rotate-90")} />
                                        ) : (
                                            <span className="w-3" />
                                        )}
                                        {getFileIcon(node.name, isFolder, isExpanded)}
                                        <span className={cn(
                                            "text-[12px] truncate",
                                            isFolder ? "text-white/80 font-medium" : "text-white/60",
                                            visual.nameClass
                                        )}>
                                            {node.name}
                                        </span>
                                        {isFolder && node.gitStatus && node.gitStatus !== 'ignored' && node.gitStatus !== 'unknown' && (
                                            <span className={cn(
                                                "inline-block w-2.5 h-2.5 rounded-full animate-pulse ring-1 ring-white/40 shrink-0",
                                                visual.pulseClass
                                            )} />
                                        )}
                                        {isFolder && !node.gitStatus && (
                                            <span className="w-2.5 h-2.5 shrink-0" />
                                        )}
                                        {!isFolder && (
                                            <span className="w-2.5 h-2.5 shrink-0" />
                                        )}
                                        {node.gitStatus && node.gitStatus !== 'ignored' && node.gitStatus !== 'unknown' && (
                                            <span className={cn(
                                                "text-[8px] uppercase font-bold px-1 py-0.5 rounded shrink-0",
                                                visual.badgeClass
                                            )}>
                                                {visual.badgeLabel}
                                            </span>
                                        )}
                                    </div>

                                    <div className="col-span-2 flex items-center">
                                        <span className={cn("text-[10px] text-white/40 uppercase", visual.metaClass)}>
                                            {isFolder ? 'Folder' : ext || '-'}
                                        </span>
                                    </div>

                                    <div className="col-span-2 flex items-center">
                                        <span className={cn("text-[10px] text-white/40 font-mono", visual.metaClass)}>
                                            {isFolder ? '-' : formatFileSize(node.size)}
                                        </span>
                                    </div>

                                    <div className="col-span-2 flex items-center justify-end gap-2">
                                        {isFolder && childInfo && (
                                            <span className={cn("text-[9px] text-white/30", visual.metaClass)}>
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
                            )
                        })()
                    ))
                )}
            </div>
        </div>
    )
}
