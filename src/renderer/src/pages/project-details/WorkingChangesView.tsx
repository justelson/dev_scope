import { useEffect, useMemo, useState, type Dispatch, type MouseEvent, type SetStateAction } from 'react'
import {
    Check,
    Copy,
    File,
    FileCode,
    FileJson,
    FileText,
    Image,
    RefreshCw,
    Sparkles
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { DiffStats } from './DiffStats'
import { FileDiffDetailModal } from './FileDiffDetailModal'

export interface WorkingChangeItem {
    path: string
    previousPath?: string
    name: string
    gitStatus?: 'modified' | 'untracked' | 'added' | 'deleted' | 'renamed' | 'ignored' | 'unknown'
    staged?: boolean
    unstaged?: boolean
    additions: number
    deletions: number
    stagedAdditions?: number
    stagedDeletions?: number
    unstagedAdditions?: number
    unstagedDeletions?: number
    statsLoaded?: boolean
}

type DiffMode = 'staged' | 'unstaged'
const PAGE_SIZE = 10

function getDiffCounts(file: WorkingChangeItem, mode: DiffMode) {
    if (mode === 'staged') {
        const stagedAdditions = Math.max(0, Number(file.stagedAdditions) || 0)
        const stagedDeletions = Math.max(0, Number(file.stagedDeletions) || 0)

        if (stagedAdditions === 0 && stagedDeletions === 0 && file.unstaged !== true) {
            return {
                additions: Math.max(0, Number(file.additions) || 0),
                deletions: Math.max(0, Number(file.deletions) || 0)
            }
        }

        return {
            additions: stagedAdditions,
            deletions: stagedDeletions
        }
    }

    const unstagedAdditions = Math.max(0, Number(file.unstagedAdditions) || 0)
    const unstagedDeletions = Math.max(0, Number(file.unstagedDeletions) || 0)

    if (unstagedAdditions === 0 && unstagedDeletions === 0 && file.staged !== true) {
        return {
            additions: Math.max(0, Number(file.additions) || 0),
            deletions: Math.max(0, Number(file.deletions) || 0)
        }
    }

    return {
        additions: unstagedAdditions,
        deletions: unstagedDeletions
    }
}

function getStatusBadge(status?: WorkingChangeItem['gitStatus']) {
    switch (status) {
        case 'modified':
            return { label: 'M', className: 'bg-[#E2C08D]/20 text-[#E2C08D]' }
        case 'untracked':
            return { label: 'U', className: 'bg-[#73C991]/20 text-[#73C991]' }
        case 'added':
            return { label: 'A', className: 'bg-[#73C991]/20 text-[#73C991]' }
        case 'deleted':
            return { label: 'D', className: 'bg-[#FF6B6B]/20 text-[#FF6B6B]' }
        case 'renamed':
            return { label: 'R', className: 'bg-blue-500/20 text-blue-300' }
        case 'ignored':
            return { label: 'I', className: 'bg-white/10 text-white/50' }
        default:
            return { label: '?', className: 'bg-white/10 text-white/50' }
    }
}

function getFileIcon(name: string) {
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

function getDiffKey(mode: DiffMode, path: string): string {
    return `${mode}:${path}`
}

function Section({
    title,
    files,
    copiedPath,
    pendingActionPath,
    loadingDiffKeys,
    emptyText,
    actionLabel,
    diffMode,
    onViewDiff,
    onActionFile,
    onActionAll,
    onEnsureStats,
    setCopiedPath,
    onSetPendingActionPath
}: {
    title: string
    files: WorkingChangeItem[]
    copiedPath: string | null
    pendingActionPath: string | null
    loadingDiffKeys: Set<string>
    emptyText: string
    actionLabel: string
    diffMode: DiffMode
    onViewDiff: (file: WorkingChangeItem, mode: DiffMode) => Promise<void>
    onActionFile: (path: string) => Promise<void>
    onActionAll: () => Promise<void>
    onEnsureStats?: (paths: string[]) => void
    setCopiedPath: Dispatch<SetStateAction<string | null>>
    onSetPendingActionPath: (path: string | null) => void
}) {
    const [currentPage, setCurrentPage] = useState(1)
    const sectionAdditions = useMemo(
        () => files.reduce((sum, file) => sum + getDiffCounts(file, diffMode).additions, 0),
        [diffMode, files]
    )
    const sectionDeletions = useMemo(
        () => files.reduce((sum, file) => sum + getDiffCounts(file, diffMode).deletions, 0),
        [diffMode, files]
    )
    const totalLineChanges = sectionAdditions + sectionDeletions
    const totalPages = Math.max(1, Math.ceil(files.length / PAGE_SIZE))
    const paginatedFiles = useMemo(() => {
        const start = (currentPage - 1) * PAGE_SIZE
        return files.slice(start, start + PAGE_SIZE)
    }, [files, currentPage])

    useEffect(() => {
        setCurrentPage((page) => Math.min(page, totalPages))
    }, [totalPages])

    useEffect(() => {
        const missingStatsPaths = paginatedFiles
            .filter((file) => file.statsLoaded !== true)
            .map((file) => file.path)

        if (missingStatsPaths.length > 0) {
            onEnsureStats?.(missingStatsPaths)
        }
    }, [onEnsureStats, paginatedFiles])

    const pageStart = files.length === 0 ? 0 : ((currentPage - 1) * PAGE_SIZE) + 1
    const pageEnd = files.length === 0 ? 0 : Math.min(currentPage * PAGE_SIZE, files.length)
    const loadedStatsCount = useMemo(
        () => files.filter((file) => file.statsLoaded === true).length,
        [files]
    )
    const hasPartialStats = loadedStatsCount < files.length

    const handleCopyPath = (path: string, e: MouseEvent) => {
        e.stopPropagation()
        navigator.clipboard.writeText(path)
        setCopiedPath(path)
        setTimeout(() => setCopiedPath(null), 1200)
    }

    return (
        <div className="space-y-2">
            <div className="rounded-xl border border-white/10 bg-black/25 px-3 py-2.5">
                <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="text-sm font-medium text-white/85">{title}</h4>
                            <span className="rounded-md border border-white/15 bg-white/5 px-1.5 py-0.5 text-[10px] text-white/65">
                                {files.length} files
                            </span>
                        </div>
                        <p className="text-[11px] text-white/45">
                            {hasPartialStats
                                ? `Counting line changes... ${loadedStatsCount}/${files.length} files resolved`
                                : `Totals across all files: ${totalLineChanges} lines changed`}
                        </p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                        <DiffStats
                            additions={sectionAdditions}
                            deletions={sectionDeletions}
                            loading={hasPartialStats}
                            preserveValuesWhileLoading
                        />
                        <button
                            onClick={() => { void onActionAll() }}
                            disabled={files.length === 0 || pendingActionPath === '__all__'}
                            className="px-3 py-1.5 text-xs font-medium rounded-lg bg-white/5 hover:bg-white/10 text-white/70 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                        >
                            {pendingActionPath === '__all__' ? 'Working...' : `${actionLabel} All`}
                        </button>
                    </div>
                </div>
            </div>

            {files.length === 0 ? (
                <div className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-xs text-white/40">{emptyText}</div>
            ) : paginatedFiles.map((file) => {
                const badge = getStatusBadge(file.gitStatus)
                const diffKey = getDiffKey(diffMode, file.path)
                const isLoadingDiff = loadingDiffKeys.has(diffKey)
                const fileCounts = getDiffCounts(file, diffMode)

                return (
                    <div key={file.path} className="group bg-black/30 rounded-xl border border-white/5 hover:border-white/15 p-3 transition-all">
                        <div className="flex items-center justify-between gap-3">
                            <div className="flex items-start gap-3 flex-1 min-w-0">
                                <span className={cn('text-[10px] uppercase font-bold px-1.5 py-0.5 rounded shrink-0 mt-0.5', badge.className)}>
                                    {badge.label}
                                </span>
                                {getFileIcon(file.name)}
                                <div className="min-w-0">
                                    <p className="text-sm font-mono text-white/80 truncate">{file.name}</p>
                                    <p className="text-xs text-white/45 truncate">{file.path}</p>
                                    {file.previousPath && (
                                        <p className="text-[11px] text-blue-300/80 truncate">from {file.previousPath}</p>
                                    )}
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

                            <div className="flex items-center justify-end gap-2 shrink-0 min-w-[220px]">
                                <DiffStats
                                    additions={fileCounts.additions}
                                    deletions={fileCounts.deletions}
                                    compact
                                    loading={file.statsLoaded !== true}
                                />
                                <button
                                    onClick={() => { void onViewDiff(file, diffMode) }}
                                    disabled={isLoadingDiff}
                                    className="px-2 py-1 text-[11px] rounded border border-blue-400/25 text-blue-300 hover:text-blue-100 hover:bg-blue-500/10 disabled:opacity-40 disabled:cursor-not-allowed"
                                >
                                    {isLoadingDiff ? 'Loading...' : 'View Diff'}
                                </button>
                                <button
                                    onClick={() => {
                                        onSetPendingActionPath(file.path)
                                        void onActionFile(file.path).finally(() => onSetPendingActionPath(null))
                                    }}
                                    disabled={pendingActionPath === file.path}
                                    className="px-2 py-1 text-[11px] rounded border border-white/15 text-white/70 hover:text-white hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed"
                                >
                                    {pendingActionPath === file.path ? '...' : actionLabel}
                                </button>
                            </div>
                        </div>
                    </div>
                )
            })}

            {files.length > PAGE_SIZE && (
                <div className="flex items-center justify-between rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-[11px] text-white/55">
                    <span>Showing {pageStart}-{pageEnd} of {files.length}</span>
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
        </div>
    )
}

export function WorkingChangesView({
    stagedFiles,
    unstagedFiles,
    projectPath,
    commitMessage,
    setCommitMessage,
    handleGenerateCommitMessage,
    isGeneratingCommitMessage,
    isCommitting,
    settings,
    handleCommit,
    handleStageFile,
    handleUnstageFile,
    handleStageAll,
    handleUnstageAll,
    ensureStatsForPaths
}: {
    stagedFiles: WorkingChangeItem[]
    unstagedFiles: WorkingChangeItem[]
    projectPath: string
    commitMessage: string
    setCommitMessage: (value: string) => void
    handleGenerateCommitMessage: () => Promise<void>
    isGeneratingCommitMessage: boolean
    isCommitting: boolean
    settings: any
    handleCommit: () => Promise<void>
    handleStageFile: (path: string) => Promise<void>
    handleUnstageFile: (path: string) => Promise<void>
    handleStageAll: () => Promise<void>
    handleUnstageAll: () => Promise<void>
    ensureStatsForPaths?: (paths: string[]) => void
}) {
    const [fileDiffs, setFileDiffs] = useState<Map<string, string>>(new Map())
    const [loadingDiffKeys, setLoadingDiffKeys] = useState<Set<string>>(new Set())
    const [copiedPath, setCopiedPath] = useState<string | null>(null)
    const [pendingActionPath, setPendingActionPath] = useState<string | null>(null)
    const [selectedDiffFile, setSelectedDiffFile] = useState<WorkingChangeItem | null>(null)
    const [selectedDiffMode, setSelectedDiffMode] = useState<DiffMode>('staged')
    const [selectedDiffContent, setSelectedDiffContent] = useState('')
    const [isDiffModalLoading, setIsDiffModalLoading] = useState(false)

    const openFileDiffModal = async (file: WorkingChangeItem, mode: DiffMode) => {
        const key = getDiffKey(mode, file.path)
        const cached = fileDiffs.get(key)

        setSelectedDiffFile(file)
        setSelectedDiffMode(mode)
        setSelectedDiffContent(cached || '')
        setIsDiffModalLoading(!cached)

        if (cached) return

        setLoadingDiffKeys((prev) => new Set(prev).add(key))
        try {
            const result = await window.devscope.getWorkingDiff(projectPath, file.path, mode)
            let nextDiff = result.success ? result.diff : ''

            const shouldTryPreviousPath = Boolean(
                file.previousPath
                && (!result.success || !nextDiff || nextDiff === 'No changes')
            )

            if (shouldTryPreviousPath) {
                const fallback = await window.devscope.getWorkingDiff(projectPath, file.previousPath, mode)
                if (fallback.success && fallback.diff && fallback.diff !== 'No changes') {
                    nextDiff = fallback.diff
                }
            }

            const resolvedDiff = nextDiff || 'No diff available'
            setFileDiffs((prev) => new Map(prev).set(key, resolvedDiff))
            setSelectedDiffContent(resolvedDiff)
        } finally {
            setLoadingDiffKeys((prev) => {
                const next = new Set(prev)
                next.delete(key)
                return next
            })
            setIsDiffModalLoading(false)
        }
    }

    return (
        <>
            <div className="space-y-5">
                <div className="bg-black/20 rounded-xl border border-white/5 p-4">
                    <h3 className="text-sm font-medium text-white/80 mb-3">Create Commit (Staged only {stagedFiles.length})</h3>
                    <textarea
                        value={commitMessage}
                        onChange={(e) => setCommitMessage(e.target.value)}
                        placeholder="Enter commit message..."
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[var(--accent-primary)]/50 resize-none mb-3"
                        rows={3}
                    />
                    <div className="mb-3 flex items-center justify-between gap-2">
                        <button
                            onClick={() => { void handleGenerateCommitMessage() }}
                            disabled={isGeneratingCommitMessage || isCommitting || stagedFiles.length === 0}
                            className="px-3 py-2 bg-violet-500/15 hover:bg-violet-500/25 disabled:opacity-50 disabled:cursor-not-allowed border border-violet-500/30 text-violet-300 text-xs font-medium rounded-lg transition-all flex items-center gap-2"
                        >
                            {isGeneratingCommitMessage ? (
                                <>
                                    <RefreshCw size={14} className="animate-spin" />
                                    Generating...
                                </>
                            ) : (
                                <>
                                    <Sparkles size={14} />
                                    Generate with AI
                                </>
                            )}
                        </button>
                        <span className="text-[11px] text-white/40 uppercase tracking-wide">{settings.commitAIProvider}</span>
                    </div>
                    <button
                        onClick={() => { void handleCommit() }}
                        disabled={!commitMessage.trim() || stagedFiles.length === 0 || isCommitting}
                        className="w-full px-4 py-2.5 bg-[var(--accent-primary)] hover:bg-[var(--accent-primary)]/80 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-all"
                    >
                        {isCommitting ? 'Committing...' : `Commit Staged (${stagedFiles.length})`}
                    </button>
                </div>

                <Section
                    title="Staged Changes"
                    files={stagedFiles}
                    copiedPath={copiedPath}
                    pendingActionPath={pendingActionPath}
                    loadingDiffKeys={loadingDiffKeys}
                    emptyText="No staged files."
                    actionLabel="Unstage"
                    diffMode="staged"
                    onViewDiff={openFileDiffModal}
                    onActionFile={async (path) => handleUnstageFile(path)}
                    onActionAll={async () => {
                        setPendingActionPath('__all__')
                        await handleUnstageAll()
                        setPendingActionPath(null)
                    }}
                    onEnsureStats={ensureStatsForPaths}
                    setCopiedPath={setCopiedPath}
                    onSetPendingActionPath={setPendingActionPath}
                />

                <Section
                    title="Unstaged Changes"
                    files={unstagedFiles}
                    copiedPath={copiedPath}
                    pendingActionPath={pendingActionPath}
                    loadingDiffKeys={loadingDiffKeys}
                    emptyText="No unstaged files."
                    actionLabel="Stage"
                    diffMode="unstaged"
                    onViewDiff={openFileDiffModal}
                    onActionFile={async (path) => handleStageFile(path)}
                    onActionAll={async () => {
                        setPendingActionPath('__all__')
                        await handleStageAll()
                        setPendingActionPath(null)
                    }}
                    onEnsureStats={ensureStatsForPaths}
                    setCopiedPath={setCopiedPath}
                    onSetPendingActionPath={setPendingActionPath}
                />
            </div>

            <FileDiffDetailModal
                isOpen={Boolean(selectedDiffFile)}
                filePath={selectedDiffFile?.path || ''}
                diff={selectedDiffContent}
                loading={isDiffModalLoading}
                additions={selectedDiffFile ? getDiffCounts(selectedDiffFile, selectedDiffMode).additions : 0}
                deletions={selectedDiffFile ? getDiffCounts(selectedDiffFile, selectedDiffMode).deletions : 0}
                status={selectedDiffFile?.gitStatus}
                subtitle={selectedDiffFile ? `${selectedDiffMode === 'staged' ? 'Staged' : 'Unstaged'} change` : undefined}
                onClose={() => {
                    setSelectedDiffFile(null)
                    setSelectedDiffContent('')
                    setIsDiffModalLoading(false)
                }}
            />
        </>
    )
}
