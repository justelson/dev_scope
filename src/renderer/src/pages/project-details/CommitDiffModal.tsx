import { useEffect, useMemo, useState, type MouseEvent } from 'react'
import {
    Calendar,
    Check,
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
import { parsePatchForRendering, summarizeFileDiff, type FileDiffSummary } from '@/lib/diffRendering'
import type { GitCommit } from './types'
import { DiffStats } from './DiffStats'
import { FileDiffDetailModal } from './FileDiffDetailModal'

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
    const FILES_PER_PAGE = 15
    const [showCommitInfo, setShowCommitInfo] = useState(false)
    const [copiedHash, setCopiedHash] = useState(false)
    const [copiedPath, setCopiedPath] = useState<string | null>(null)
    const [selectedFilePath, setSelectedFilePath] = useState<string | null>(null)
    const [parsedDiff, setParsedDiff] = useState<FileDiffSummary[]>([])
    const [isPreparingDiff, setIsPreparingDiff] = useState(false)
    const [currentPage, setCurrentPage] = useState(1)

    const handleCopyPath = (path: string, e: MouseEvent) => {
        e.stopPropagation()
        navigator.clipboard.writeText(path)
        setCopiedPath(path)
        setTimeout(() => setCopiedPath(null), 1500)
    }

    useEffect(() => {
        if (loading || !diff.trim()) {
            setParsedDiff([])
            setIsPreparingDiff(false)
            return
        }

        let cancelled = false
        let frameId = 0
        let timeoutId = 0

        setIsPreparingDiff(true)
        frameId = window.requestAnimationFrame(() => {
            timeoutId = window.setTimeout(() => {
                if (cancelled) return
                const next = parsePatchForRendering(diff, `commit-diff:${commit.hash}`).files.map(summarizeFileDiff)
                if (cancelled) return
                setParsedDiff(next)
                setIsPreparingDiff(false)
            }, 0)
        })

        return () => {
            cancelled = true
            window.cancelAnimationFrame(frameId)
            window.clearTimeout(timeoutId)
        }
    }, [commit.hash, diff, loading])

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
            while (idx < lines.length && lines[idx].trim() === '') idx += 1
            while (idx < lines.length && lines[idx].startsWith('    ')) {
                messageLines.push(lines[idx].replace(/^    /, ''))
                idx += 1
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
    const totalPages = useMemo(() => Math.max(1, Math.ceil(parsedDiff.length / FILES_PER_PAGE)), [parsedDiff.length, FILES_PER_PAGE])
    const paginatedFiles = useMemo(() => {
        const start = (currentPage - 1) * FILES_PER_PAGE
        return parsedDiff.slice(start, start + FILES_PER_PAGE)
    }, [currentPage, parsedDiff, FILES_PER_PAGE])
    const pageStart = parsedDiff.length === 0 ? 0 : ((currentPage - 1) * FILES_PER_PAGE) + 1
    const pageEnd = parsedDiff.length === 0 ? 0 : Math.min(currentPage * FILES_PER_PAGE, parsedDiff.length)
    const selectedFileDiff = useMemo<FileDiffSummary | null>(
        () => parsedDiff.find((file) => file.path === selectedFilePath) || null,
        [parsedDiff, selectedFilePath]
    )

    useEffect(() => {
        setCurrentPage((page) => Math.min(page, totalPages))
    }, [totalPages])

    useEffect(() => {
        setCurrentPage(1)
    }, [commit.hash])

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

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md animate-fadeIn" onClick={onClose}>
            <div
                className="relative bg-sparkle-card border border-white/10 rounded-2xl shadow-2xl w-full max-w-5xl max-h-[85vh] flex flex-col m-4 overflow-hidden"
                onClick={e => e.stopPropagation()}
            >
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

                        {!loading && !isPreparingDiff && (
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

                {!loading && !isPreparingDiff && parsedDiff.length > 0 && (
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
                        <span className="text-xs text-white/40">Open any file to view its full diff</span>
                    </div>
                )}

                <div className="overflow-y-auto p-4 custom-scrollbar flex-1 bg-black/10">
                    {loading || isPreparingDiff ? (
                        <div className="flex flex-col items-center justify-center py-16 text-white/30">
                            <RefreshCw size={32} className="mb-4 animate-spin" />
                            <p className="text-sm">{loading ? 'Loading diff...' : 'Preparing diff...'}</p>
                        </div>
                    ) : parsedDiff.length > 0 ? (
                        <>
                            <div className="space-y-2">
                                {paginatedFiles.map((file) => {
                                    return (
                                        <div key={file.path} className="group rounded-xl border border-white/5 bg-black/30 p-3 transition-all hover:border-white/10">
                                            <div className="flex items-center justify-between gap-3">
                                                <div className="flex items-start gap-3 flex-1 min-w-0">
                                                    {getFileIcon(file.path.split('/').pop() || '', false)}
                                                    <div className="min-w-0">
                                                        <p className="text-sm font-mono text-white/80 truncate">{file.path}</p>
                                                        {file.previousPath && (
                                                            <p className="text-[11px] text-blue-300/80 truncate">from {file.previousPath}</p>
                                                        )}
                                                        <p className="text-xs text-white/45">{file.totalLines} diff lines</p>
                                                    </div>
                                                    <button
                                                        onClick={(e) => handleCopyPath(file.path, e)}
                                                        className={cn(
                                                            'p-1 rounded transition-all shrink-0 opacity-0 group-hover:opacity-100',
                                                            copiedPath === file.path
                                                                ? 'text-emerald-400 bg-emerald-400/10'
                                                                : 'text-white/40 hover:text-white hover:bg-white/10'
                                                        )}
                                                        title={copiedPath === file.path ? 'Copied!' : `Copy path: ${file.path}`}
                                                    >
                                                        {copiedPath === file.path ? <Check size={14} /> : <Copy size={14} />}
                                                    </button>
                                                </div>
                                                <div className="flex items-center gap-2 shrink-0">
                                                    <DiffStats additions={file.additions} deletions={file.deletions} compact />
                                                    <button
                                                        onClick={() => setSelectedFilePath(file.path)}
                                                        className="rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[11px] text-white/75 transition-all hover:border-white/20 hover:bg-white/10 hover:text-white"
                                                    >
                                                        View Diff
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                            {parsedDiff.length > FILES_PER_PAGE && (
                                <div className="mt-4 flex items-center justify-between rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-[11px] text-white/55">
                                    <span>Showing {pageStart}-{pageEnd} of {parsedDiff.length}</span>
                                    <div className="flex items-center gap-1.5">
                                        <button
                                            onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                                            disabled={currentPage <= 1}
                                            className="rounded-md border border-white/15 px-2 py-1 text-white/75 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-35"
                                        >
                                            Prev
                                        </button>
                                        <span className="min-w-[54px] text-center text-white/65">{currentPage}/{totalPages}</span>
                                        <button
                                            onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                                            disabled={currentPage >= totalPages}
                                            className="rounded-md border border-white/15 px-2 py-1 text-white/75 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-35"
                                        >
                                            Next
                                        </button>
                                    </div>
                                </div>
                            )}
                        </>
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

                <FileDiffDetailModal
                    isOpen={Boolean(selectedFileDiff)}
                    filePath={selectedFileDiff?.path || ''}
                    diff=""
                    fileDiff={selectedFileDiff?.fileDiff || null}
                    additions={selectedFileDiff?.additions || 0}
                    deletions={selectedFileDiff?.deletions || 0}
                    subtitle={selectedFileDiff ? `Commit diff - ${commit.shortHash}` : undefined}
                    onClose={() => setSelectedFilePath(null)}
                />
            </div>
        </div>
    )
}
