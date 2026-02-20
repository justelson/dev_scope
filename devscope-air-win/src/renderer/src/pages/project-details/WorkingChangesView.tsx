import { useState } from 'react'
import {
    ChevronRight,
    ChevronsDownUp,
    ChevronsUpDown,
    Code,
    File,
    FileCode,
    FileJson,
    FileText,
    Folder,
    FolderOpen,
    Image,
    RefreshCw
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { FileTreeNode } from './types'

function getFileIcon(name: string, isDirectory: boolean, isExpanded?: boolean) {
    if (isDirectory) {
        return isExpanded ? <FolderOpen size={16} className="text-blue-400" /> : <Folder size={16} className="text-blue-400" />
    }

    const ext = name.split('.').pop()?.toLowerCase()
    switch (ext) {
        case 'js':
        case 'jsx':
            return <FileCode size={16} className="text-yellow-400" />
        case 'ts':
        case 'tsx':
            return <FileCode size={16} className="text-blue-400" />
        case 'json':
            return <FileJson size={16} className="text-yellow-500" />
        case 'md':
            return <FileText size={16} className="text-white/60" />
        case 'html':
        case 'htm':
            return <Code size={16} className="text-orange-400" />
        case 'css':
        case 'scss':
        case 'sass':
            return <FileCode size={16} className="text-pink-400" />
        case 'png':
        case 'jpg':
        case 'jpeg':
        case 'gif':
        case 'svg':
        case 'webp':
            return <Image size={16} className="text-purple-400" />
        default:
            return <File size={16} className="text-white/40" />
    }
}

export function WorkingChangesView({
    files,
    projectPath,
    currentPage,
    onPageChange
}: {
    files: FileTreeNode[],
    projectPath: string,
    currentPage: number,
    onPageChange: (page: number) => void
}) {
    const [expandedFiles, setExpandedFiles] = useState<Set<string>>(new Set())
    const [fileDiffs, setFileDiffs] = useState<Map<string, string>>(new Map())
    const [loadingDiffs, setLoadingDiffs] = useState<Set<string>>(new Set())
    const [showFullDiff, setShowFullDiff] = useState<Set<string>>(new Set())
    const [isExpandingAll, setIsExpandingAll] = useState(false)

    const PREVIEW_LINES = 10
    const ITEMS_PER_PAGE = 15

    // Paginate files
    const paginatedFiles = files.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE)
    const totalPages = Math.ceil(files.length / ITEMS_PER_PAGE)

    const toggleFile = async (file: FileTreeNode) => {
        const isExpanded = expandedFiles.has(file.path)

        if (isExpanded) {
            // Collapse
            setExpandedFiles(prev => {
                const next = new Set(prev)
                next.delete(file.path)
                return next
            })
        } else {
            // Expand and load diff if not already loaded
            setExpandedFiles(prev => new Set(prev).add(file.path))

            if (!fileDiffs.has(file.path)) {
                setLoadingDiffs(prev => new Set(prev).add(file.path))

                try {
                    const result = await window.devscope.getWorkingDiff(projectPath, file.path)
                    if (result.success) {
                        setFileDiffs(prev => new Map(prev).set(file.path, result.diff))
                    }
                } catch (err) {
                    console.error('Failed to load diff:', err)
                } finally {
                    setLoadingDiffs(prev => {
                        const next = new Set(prev)
                        next.delete(file.path)
                        return next
                    })
                }
            }
        }
    }

    const toggleFullDiff = (path: string) => {
        setShowFullDiff(prev => {
            const next = new Set(prev)
            if (next.has(path)) {
                next.delete(path)
            } else {
                next.add(path)
            }
            return next
        })
    }

    const expandAll = async () => {
        setIsExpandingAll(true)

        // Expand all files first
        setExpandedFiles(new Set(paginatedFiles.map(f => f.path)))

        // Load diffs for files that don't have them yet
        const filesToLoad = paginatedFiles.filter(file => !fileDiffs.has(file.path))

        if (filesToLoad.length > 0) {
            // Load all diffs in parallel
            const loadPromises = filesToLoad.map(async (file) => {
                setLoadingDiffs(prev => new Set(prev).add(file.path))

                try {
                    const result = await window.devscope.getWorkingDiff(projectPath, file.path)
                    if (result.success) {
                        setFileDiffs(prev => new Map(prev).set(file.path, result.diff))
                    }
                } catch (err) {
                    console.error('Failed to load diff:', err)
                } finally {
                    setLoadingDiffs(prev => {
                        const next = new Set(prev)
                        next.delete(file.path)
                        return next
                    })
                }
            })

            await Promise.all(loadPromises)
        }

        setIsExpandingAll(false)
    }

    const collapseAll = () => {
        setExpandedFiles(new Set())
        setShowFullDiff(new Set())
    }

    return (
        <div className="space-y-2">
            {/* Toolbar */}
            <div className="flex items-center justify-between pb-2">
                <div className="text-xs text-white/50">
                    {files.length} {files.length === 1 ? 'file' : 'files'} changed
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={expandAll}
                        disabled={isExpandingAll}
                        className="px-3 py-1.5 text-xs font-medium rounded-lg bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-all flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isExpandingAll ? (
                            <>
                                <RefreshCw size={12} className="animate-spin" />
                                Loading...
                            </>
                        ) : (
                            <>
                                <ChevronsUpDown size={12} />
                                Expand All
                            </>
                        )}
                    </button>
                    <button
                        onClick={collapseAll}
                        disabled={isExpandingAll}
                        className="px-3 py-1.5 text-xs font-medium rounded-lg bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-all flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <ChevronsDownUp size={12} />
                        Collapse All
                    </button>
                </div>
            </div>

            {/* File List */}
            {paginatedFiles.map((file) => {
                const isExpanded = expandedFiles.has(file.path)
                const isLoading = loadingDiffs.has(file.path)
                const diff = fileDiffs.get(file.path) || ''
                const showFull = showFullDiff.has(file.path)
                const diffLines = diff.split('\n')
                const shouldTruncate = diffLines.length > PREVIEW_LINES + 5
                const displayLines = (isExpanded && !showFull && shouldTruncate)
                    ? diffLines.slice(0, PREVIEW_LINES)
                    : diffLines

                return (
                    <div key={file.path} className="bg-black/30 rounded-xl border border-white/5 overflow-hidden">
                        {/* File Header */}
                        <button
                            onClick={() => toggleFile(file)}
                            className="w-full flex items-center justify-between p-3 hover:bg-white/5 transition-colors group"
                        >
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                                <ChevronRight
                                    size={16}
                                    className={cn(
                                        "text-white/40 transition-transform shrink-0",
                                        isExpanded && "rotate-90"
                                    )}
                                />
                                <span className={cn(
                                    "text-[10px] uppercase font-bold px-1.5 py-0.5 rounded shrink-0",
                                    file.gitStatus === 'modified' && "bg-[#E2C08D]/20 text-[#E2C08D]",
                                    file.gitStatus === 'untracked' && "bg-[#73C991]/20 text-[#73C991]",
                                    file.gitStatus === 'added' && "bg-[#73C991]/20 text-[#73C991]",
                                    file.gitStatus === 'deleted' && "bg-[#FF6B6B]/20 text-[#FF6B6B]",
                                )}>
                                    {file.gitStatus?.substring(0, 1) || '?'}
                                </span>
                                {getFileIcon(file.name, false)}
                                <span className="text-sm font-mono text-white/80 truncate">
                                    {file.name}
                                </span>
                            </div>
                            <span className="text-xs text-white/30 truncate max-w-[200px] shrink-0">
                                {file.path.replace(file.name, '')}
                            </span>
                        </button>

                        {/* File Diff */}
                        {isExpanded && (
                            <div className="border-t border-white/5 bg-black/40">
                                {isLoading ? (
                                    <div className="flex items-center justify-center py-8 text-white/30">
                                        <RefreshCw size={16} className="animate-spin mr-2" />
                                        <span className="text-xs">Loading diff...</span>
                                    </div>
                                ) : diff ? (
                                    <>
                                        <pre className="text-xs font-mono text-white/70 whitespace-pre-wrap break-words p-4 overflow-x-auto">
                                            {displayLines.map((line, lineIdx) => {
                                                let lineClass = ''
                                                if (line.startsWith('+') && !line.startsWith('+++')) {
                                                    lineClass = 'text-green-400 bg-green-500/10'
                                                } else if (line.startsWith('-') && !line.startsWith('---')) {
                                                    lineClass = 'text-red-400 bg-red-500/10'
                                                } else if (line.startsWith('@@')) {
                                                    lineClass = 'text-blue-400 bg-blue-500/10'
                                                } else if (line.startsWith('diff') || line.startsWith('index') || line.startsWith('---') || line.startsWith('+++')) {
                                                    lineClass = 'text-white/40'
                                                }

                                                return (
                                                    <div key={lineIdx} className={cn('px-2 -mx-2', lineClass)}>
                                                        {line || ' '}
                                                    </div>
                                                )
                                            })}
                                        </pre>

                                        {shouldTruncate && (
                                            <div className="border-t border-white/5 p-3 text-center">
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation()
                                                        toggleFullDiff(file.path)
                                                    }}
                                                    className="text-xs text-[var(--accent-primary)] hover:text-white transition-colors font-medium"
                                                >
                                                    {showFull
                                                        ? `Show Less`
                                                        : `Show ${diffLines.length - PREVIEW_LINES} More Lines...`
                                                    }
                                                </button>
                                            </div>
                                        )}
                                    </>
                                ) : (
                                    <div className="flex items-center justify-center py-8 text-white/30">
                                        <span className="text-xs">No diff available</span>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )
            })}

            {/* Pagination */}
            {files.length > ITEMS_PER_PAGE && (
                <div className="flex items-center justify-between pt-4 mt-4 border-t border-white/5">
                    <span className="text-xs text-white/40">
                        Showing {((currentPage - 1) * ITEMS_PER_PAGE) + 1}-{Math.min(currentPage * ITEMS_PER_PAGE, files.length)} of {files.length}
                    </span>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => onPageChange(Math.max(1, currentPage - 1))}
                            disabled={currentPage === 1}
                            className="px-3 py-1.5 text-xs font-medium rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                        >
                            Previous
                        </button>
                        <span className="text-xs text-white/60 px-2">
                            {currentPage} / {totalPages}
                        </span>
                        <button
                            onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
                            disabled={currentPage >= totalPages}
                            className="px-3 py-1.5 text-xs font-medium rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                        >
                            Next
                        </button>
                    </div>
                </div>
            )}
        </div>
    )
}

