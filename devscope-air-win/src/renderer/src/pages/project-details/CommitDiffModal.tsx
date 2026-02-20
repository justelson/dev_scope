import { useMemo, useState } from 'react'
import {
    Calendar,
    Check,
    ChevronRight,
    ChevronsDownUp,
    ChevronsUpDown,
    Code,
    Copy,
    File,
    FileCode,
    FileJson,
    FileText,
    Folder,
    FolderOpen,
    GitCommitHorizontal,
    Image,
    RefreshCw,
    User,
    X
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { GitCommit } from './types'

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

export function CommitDiffModal({ commit, diff, loading, onClose }: { commit: GitCommit, diff: string, loading: boolean, onClose: () => void }) {
    const [expandedFiles, setExpandedFiles] = useState<Set<string>>(new Set())
    const [showFullDiff, setShowFullDiff] = useState<Set<string>>(new Set())
    const [showCommitInfo, setShowCommitInfo] = useState(false)
    const [copiedHash, setCopiedHash] = useState(false)

    const PREVIEW_LINES = 10 // Show first 10 lines when truncated

    // Parse diff into file sections
    const parsedDiff = useMemo(() => {
        if (!diff) return []

        const files: Array<{ path: string; diff: string; additions: number; deletions: number; totalLines: number }> = []
        const lines = diff.split('\n')
        let currentFile: { path: string; diff: string; additions: number; deletions: number; totalLines: number } | null = null
        let inDiff = false

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i]

            // Detect file header (diff --git a/... b/...)
            if (line.startsWith('diff --git')) {
                if (currentFile) {
                    files.push(currentFile)
                }

                // Extract file path from "diff --git a/path b/path"
                const match = line.match(/diff --git a\/(.*?) b\/(.*)/)
                const path = match ? match[2] : 'unknown'

                currentFile = { path, diff: line + '\n', additions: 0, deletions: 0, totalLines: 0 }
                inDiff = true
            } else if (currentFile && inDiff) {
                currentFile.diff += line + '\n'
                currentFile.totalLines++

                // Count additions and deletions
                if (line.startsWith('+') && !line.startsWith('+++')) {
                    currentFile.additions++
                } else if (line.startsWith('-') && !line.startsWith('---')) {
                    currentFile.deletions++
                }
            }
        }

        if (currentFile) {
            files.push(currentFile)
        }

        return files
    }, [diff])

    const commitMeta = useMemo(() => {
        const lines = diff.split('\n')
        const fullHashLine = lines.find(line => line.startsWith('commit '))
        const authorLine = lines.find(line => line.startsWith('Author:'))
        const authorDateLine = lines.find(line => line.startsWith('AuthorDate:'))
        const commitDateLine = lines.find(line => line.startsWith('CommitDate:'))

        const fullHash = (fullHashLine?.replace(/^commit\s+/, '').trim() || commit.hash).trim()

        let authorName = commit.author
        let authorEmail: string | null = null
        if (authorLine) {
            const raw = authorLine.replace(/^Author:\s*/, '').trim()
            const match = raw.match(/^(.*)\s<(.+)>$/)
            if (match) {
                authorName = match[1].trim() || commit.author
                authorEmail = match[2].trim()
            } else {
                authorName = raw || commit.author
            }
        }

        const authorDate = (authorDateLine?.replace(/^AuthorDate:\s*/, '').trim() || commit.date).trim()
        const commitDate = (commitDateLine?.replace(/^CommitDate:\s*/, '').trim() || commit.date).trim()

        const commitDateIdx = lines.findIndex(line => line.startsWith('CommitDate:'))
        const messageLines: string[] = []
        if (commitDateIdx >= 0) {
            let idx = commitDateIdx + 1
            while (idx < lines.length && lines[idx].trim() === '') idx++
            while (idx < lines.length && lines[idx].startsWith('    ')) {
                messageLines.push(lines[idx].replace(/^    /, ''))
                idx++
            }
        }

        return {
            fullHash,
            shortHash: fullHash.substring(0, 7),
            authorName,
            authorEmail,
            authorDate,
            commitDate,
            messageLines,
            isMerge: commit.parents.length > 1
        }
    }, [commit, diff])

    const totalAdditions = useMemo(() => parsedDiff.reduce((sum, file) => sum + file.additions, 0), [parsedDiff])
    const totalDeletions = useMemo(() => parsedDiff.reduce((sum, file) => sum + file.deletions, 0), [parsedDiff])

    const copyCommitHash = async () => {
        const value = commitMeta.fullHash || commit.hash
        try {
            if (window.devscope.copyToClipboard) {
                await window.devscope.copyToClipboard(value)
            } else {
                await navigator.clipboard.writeText(value)
            }
            setCopiedHash(true)
            setTimeout(() => setCopiedHash(false), 1400)
        } catch {
            setCopiedHash(false)
        }
    }

    const toggleFile = (path: string) => {
        setExpandedFiles(prev => {
            const next = new Set(prev)
            if (next.has(path)) {
                next.delete(path)
            } else {
                next.add(path)
            }
            return next
        })
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

    const expandAll = () => {
        setExpandedFiles(new Set(parsedDiff.map(f => f.path)))
    }

    const collapseAll = () => {
        setExpandedFiles(new Set())
        setShowFullDiff(new Set())
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md animate-fadeIn" onClick={onClose}>
            <div
                className="relative bg-sparkle-card border border-white/10 rounded-2xl shadow-2xl w-full max-w-5xl max-h-[85vh] flex flex-col m-4 overflow-hidden"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-start justify-between p-5 border-b border-white/5 bg-white/5">
                    <div className="flex-1 min-w-0">
                        <h3 className="text-lg font-semibold text-white flex items-center gap-2 mb-2">
                            <GitCommitHorizontal size={20} className="text-[var(--accent-primary)]" />
                            {commit.message}
                        </h3>
                        <div className="flex items-center gap-4 text-xs text-white/50">
                            <span className="font-mono bg-white/5 px-2 py-1 rounded text-white/60">
                                {commit.shortHash}
                            </span>
                            <span className="flex items-center gap-1">
                                <User size={12} /> {commit.author}
                            </span>
                            <span className="flex items-center gap-1">
                                <Calendar size={12} /> {new Date(commit.date).toLocaleString()}
                            </span>
                        </div>

                        {!loading && (
                            <div className="mt-3 space-y-2">
                                <div className="flex flex-wrap items-center gap-2 text-[11px]">
                                    <span className="px-2 py-1 rounded bg-white/5 border border-white/10 text-white/70">
                                        {commitMeta.isMerge ? 'Merge Commit' : 'Regular Commit'}
                                    </span>
                                    <span className="px-2 py-1 rounded bg-white/5 border border-white/10 text-white/70">
                                        {parsedDiff.length} {parsedDiff.length === 1 ? 'file' : 'files'} changed
                                    </span>
                                    <span className="px-2 py-1 rounded bg-green-500/10 border border-green-500/20 text-green-300">
                                        +{totalAdditions}
                                    </span>
                                    <span className="px-2 py-1 rounded bg-red-500/10 border border-red-500/20 text-red-300">
                                        -{totalDeletions}
                                    </span>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                                    <div className="rounded-lg bg-black/25 border border-white/10 px-3 py-2">
                                        <div className="text-white/40 mb-1">Commit Hash</div>
                                        <div className="flex items-center gap-2">
                                            <span className="font-mono text-white/80 break-all">{commitMeta.fullHash}</span>
                                            <button
                                                onClick={copyCommitHash}
                                                className="p-1 rounded hover:bg-white/10 text-white/50 hover:text-white transition-colors shrink-0"
                                                title="Copy full hash"
                                            >
                                                {copiedHash ? <Check size={12} /> : <Copy size={12} />}
                                            </button>
                                        </div>
                                    </div>
                                    <div className="rounded-lg bg-black/25 border border-white/10 px-3 py-2">
                                        <div className="text-white/40 mb-1">Author</div>
                                        <div className="text-white/80">{commitMeta.authorName}</div>
                                        {commitMeta.authorEmail && (
                                            <div className="text-white/50 font-mono text-[11px]">{commitMeta.authorEmail}</div>
                                        )}
                                    </div>
                                    <div className="rounded-lg bg-black/25 border border-white/10 px-3 py-2">
                                        <div className="text-white/40 mb-1">Authored</div>
                                        <div className="text-white/80">{new Date(commitMeta.authorDate).toLocaleString()}</div>
                                    </div>
                                    <div className="rounded-lg bg-black/25 border border-white/10 px-3 py-2">
                                        <div className="text-white/40 mb-1">Committed</div>
                                        <div className="text-white/80">{new Date(commitMeta.commitDate).toLocaleString()}</div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                    <div className="flex items-center gap-2 ml-4 shrink-0">
                        {!loading && (
                            <button
                                onClick={() => setShowCommitInfo(true)}
                                className="px-3 py-1.5 text-xs font-medium rounded-lg bg-white/5 hover:bg-white/10 text-white/70 hover:text-white transition-all border border-white/10"
                            >
                                More Info
                            </button>
                        )}
                        <button onClick={onClose} className="text-white/40 hover:text-white transition-colors p-1 rounded-lg hover:bg-white/10">
                            <X size={20} />
                        </button>
                    </div>
                </div>

                {/* Toolbar */}
                {!loading && parsedDiff.length > 0 && (
                    <div className="flex items-center justify-between px-5 py-3 border-b border-white/5 bg-black/20">
                        <div className="flex items-center gap-3 text-xs text-white/50">
                            <span className="flex items-center gap-1">
                                <File size={12} />
                                {parsedDiff.length} {parsedDiff.length === 1 ? 'file' : 'files'} changed
                            </span>
                            <span className="text-green-400">
                                +{totalAdditions}
                            </span>
                            <span className="text-red-400">
                                -{totalDeletions}
                            </span>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={expandAll}
                                className="px-3 py-1.5 text-xs font-medium rounded-lg bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-all flex items-center gap-1.5"
                            >
                                <ChevronsUpDown size={12} />
                                Expand All
                            </button>
                            <button
                                onClick={collapseAll}
                                className="px-3 py-1.5 text-xs font-medium rounded-lg bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-all flex items-center gap-1.5"
                            >
                                <ChevronsDownUp size={12} />
                                Collapse All
                            </button>
                        </div>
                    </div>
                )}

                {/* Diff Content */}
                <div className="overflow-y-auto p-4 custom-scrollbar flex-1 bg-black/10">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-16 text-white/30">
                            <RefreshCw size={32} className="mb-4 animate-spin" />
                            <p className="text-sm">Loading diff...</p>
                        </div>
                    ) : parsedDiff.length > 0 ? (
                        <div className="space-y-2">
                            {parsedDiff.map((file, idx) => {
                                const isExpanded = expandedFiles.has(file.path)
                                const showFull = showFullDiff.has(file.path)
                                const diffLines = file.diff.split('\n')
                                const shouldTruncate = diffLines.length > PREVIEW_LINES + 5 // Only truncate if significantly longer
                                const displayLines = (isExpanded && !showFull && shouldTruncate)
                                    ? diffLines.slice(0, PREVIEW_LINES)
                                    : diffLines

                                return (
                                    <div key={idx} className="bg-black/30 rounded-xl border border-white/5 overflow-hidden">
                                        {/* File Header */}
                                        <button
                                            onClick={() => toggleFile(file.path)}
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
                                                {getFileIcon(file.path.split('/').pop() || '', false)}
                                                <span className="text-sm font-mono text-white/80 truncate">
                                                    {file.path}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-3 text-xs shrink-0">
                                                {file.additions > 0 && (
                                                    <span className="text-green-400 font-mono">
                                                        +{file.additions}
                                                    </span>
                                                )}
                                                {file.deletions > 0 && (
                                                    <span className="text-red-400 font-mono">
                                                        -{file.deletions}
                                                    </span>
                                                )}
                                            </div>
                                        </button>

                                        {/* File Diff (Collapsible) */}
                                        {isExpanded && (
                                            <div className="border-t border-white/5 bg-black/40">
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

                                                {/* Show More/Less Button */}
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
                                            </div>
                                        )}
                                    </div>
                                )
                            })}
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center py-16 text-white/30">
                            <FileText size={48} className="mb-4 opacity-20" />
                            <p className="text-sm">No changes to display</p>
                        </div>
                    )}
                </div>

                {showCommitInfo && (
                    <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={() => setShowCommitInfo(false)}>
                        <div
                            className="w-full max-w-3xl max-h-[80vh] overflow-y-auto custom-scrollbar rounded-2xl bg-sparkle-card border border-white/10 shadow-2xl"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 bg-white/[0.03]">
                                <h4 className="text-sm font-semibold text-white">Commit Info</h4>
                                <button
                                    onClick={() => setShowCommitInfo(false)}
                                    className="text-white/40 hover:text-white transition-colors p-1 rounded-lg hover:bg-white/10"
                                >
                                    <X size={18} />
                                </button>
                            </div>

                            <div className="p-5 space-y-3 text-xs">
                                <p className="text-white/50 text-[11px]">
                                    Extra details hidden from the default view.
                                </p>

                                {commit.parents.length > 0 && (
                                    <div className="rounded-lg bg-black/25 border border-white/10 px-3 py-2">
                                        <div className="text-white/40 mb-1">Parents ({commit.parents.length})</div>
                                        <div className="flex flex-wrap gap-1.5">
                                            {commit.parents.map(parent => (
                                                <span key={parent} className="px-2 py-0.5 rounded bg-white/5 border border-white/10 text-[11px] font-mono text-white/70">
                                                    {parent}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                <div className="rounded-lg bg-black/25 border border-white/10 px-3 py-2">
                                    <div className="text-white/40 mb-1">Commit Message</div>
                                    <pre className="text-xs text-white/75 whitespace-pre-wrap break-words font-mono">
                                        {commitMeta.messageLines.length > 0 ? commitMeta.messageLines.join('\n') : commit.message}
                                    </pre>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}

