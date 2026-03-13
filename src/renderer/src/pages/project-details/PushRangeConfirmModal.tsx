import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { ArrowDownCircle, Cloud, GitCommitHorizontal } from 'lucide-react'
import { cn } from '@/lib/utils'
import { DiffStats } from './DiffStats'
import type { GitCommit } from './types'

export interface PushRangeSummary {
    selectedCommit: GitCommit
    newerLocalCommits: GitCommit[]
    commitsToPush: GitCommit[]
}

type PushRangePreviewProps = {
    summary: PushRangeSummary
    compact?: boolean
    className?: string
    showCloudBoundary?: boolean
    remoteName?: string | null
}

type PushRangeSelectorProps = {
    commits: GitCommit[]
    activeCommitHash: string | null
    onActiveCommitChange: (commitHash: string) => void
    onCommitClick?: (commit: GitCommit) => void
    className?: string
    remoteName?: string | null
}

type PushRangeConfirmModalProps = {
    isOpen: boolean
    summary: PushRangeSummary | null
    isPushing?: boolean
    dontShowAgain: boolean
    setDontShowAgain: (value: boolean) => void
    remoteName?: string | null
    onCancel: () => void
    onConfirm: () => void
}

type PreviewRow =
    | { kind: 'collapsed-local'; count: number }
    | { kind: 'collapsed-push'; count: number }
    | { kind: 'commit'; commit: GitCommit; role: 'retained' | 'selected' | 'included' }
    | { kind: 'cloud-boundary' }

const RETAINED_COLOR = 'bg-amber-400'
const SELECTED_COLOR = 'bg-blue-400'
const INCLUDED_COLOR = 'bg-emerald-400'

export function buildPushRangeSummary(commits: GitCommit[], commitHash: string): PushRangeSummary | null {
    const selectedIndex = commits.findIndex((commit) => commit.hash === commitHash)
    if (selectedIndex < 0) {
        return null
    }

    return {
        selectedCommit: commits[selectedIndex],
        newerLocalCommits: commits.slice(0, selectedIndex),
        commitsToPush: commits.slice(selectedIndex)
    }
}

function formatCommitCount(count: number, singular: string, plural = `${singular}s`) {
    return `${count} ${count === 1 ? singular : plural}`
}

function buildPreviewRows(summary: PushRangeSummary, compact: boolean, showCloudBoundary: boolean): PreviewRow[] {
    if (!compact) {
        const rows: PreviewRow[] = [
            ...summary.newerLocalCommits.map((commit) => ({ kind: 'commit' as const, commit, role: 'retained' as const })),
            { kind: 'commit' as const, commit: summary.selectedCommit, role: 'selected' as const },
            ...summary.commitsToPush.slice(1).map((commit) => ({ kind: 'commit' as const, commit, role: 'included' as const }))
        ]

        if (showCloudBoundary) {
            rows.push({ kind: 'cloud-boundary' })
        }

        return rows
    }

    const retainedPreview = summary.newerLocalCommits.slice(0, 2)
    const includedPreview = summary.commitsToPush.slice(1, 3)
    const hiddenRetained = Math.max(0, summary.newerLocalCommits.length - retainedPreview.length)
    const hiddenIncluded = Math.max(0, (summary.commitsToPush.length - 1) - includedPreview.length)

    const rows: PreviewRow[] = []

    if (hiddenRetained > 0) {
        rows.push({ kind: 'collapsed-local', count: hiddenRetained })
    }

    retainedPreview.forEach((commit) => {
        rows.push({ kind: 'commit', commit, role: 'retained' })
    })

    rows.push({ kind: 'commit', commit: summary.selectedCommit, role: 'selected' })

    includedPreview.forEach((commit) => {
        rows.push({ kind: 'commit', commit, role: 'included' })
    })

    if (hiddenIncluded > 0) {
        rows.push({ kind: 'collapsed-push', count: hiddenIncluded })
    }

    if (showCloudBoundary) {
        rows.push({ kind: 'cloud-boundary' })
    }

    return rows
}

function getRoleTone(role: 'retained' | 'selected' | 'included') {
    if (role === 'retained') {
        return {
            dotClassName: RETAINED_COLOR,
            lineClassName: 'bg-amber-400/60',
            badgeClassName: 'border border-amber-400/20 bg-amber-400/12 text-amber-200',
            badgeLabel: 'Stays local',
            rowClassName: 'border border-amber-400/15 bg-amber-400/6 hover:bg-amber-400/10'
        }
    }

    if (role === 'selected') {
        return {
            dotClassName: SELECTED_COLOR,
            lineClassName: 'bg-blue-400/70',
            badgeClassName: 'border border-blue-400/20 bg-blue-400/12 text-blue-100',
            badgeLabel: 'Push target',
            rowClassName: 'border border-blue-400/20 bg-blue-400/8 hover:bg-blue-400/12'
        }
    }

    return {
        dotClassName: INCLUDED_COLOR,
        lineClassName: 'bg-emerald-400/60',
        badgeClassName: 'border border-emerald-400/20 bg-emerald-400/12 text-emerald-100',
        badgeLabel: 'Included',
        rowClassName: 'border border-emerald-400/15 bg-emerald-400/5 hover:bg-emerald-400/10'
    }
}

function PushRangeGraph({
    summary,
    compact = false,
    className,
    showCloudBoundary = true,
    remoteName
}: PushRangePreviewProps) {
    const rows = useMemo(
        () => buildPreviewRows(summary, compact, showCloudBoundary),
        [summary, compact, showCloudBoundary]
    )

    return (
        <div className={cn('rounded-xl border border-white/10 bg-sparkle-card p-3', className)}>
            <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                    <p className="text-[11px] uppercase tracking-[0.18em] text-white/35">Push Range</p>
                    <p className="mt-1 text-xs text-white/55">
                        {formatCommitCount(summary.commitsToPush.length, 'commit')} will push.
                        {' '}
                        {formatCommitCount(summary.newerLocalCommits.length, 'commit')} stays local.
                    </p>
                </div>
                <div className="rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[11px] text-white/60">
                    {remoteName || 'remote'}
                </div>
            </div>

            <div className="space-y-2">
                {rows.map((row, index) => {
                    const isLastRow = index === rows.length - 1

                    if (row.kind === 'collapsed-local') {
                        return (
                            <div key={`collapsed-local-${index}`} className="flex items-start gap-3">
                                <div className="flex w-5 flex-col items-center">
                                    <div className="h-2 w-2 rounded-full bg-amber-400/75" />
                                    {!isLastRow && <div className="mt-1 h-7 w-px bg-amber-400/35" />}
                                </div>
                                <div className="min-w-0 flex-1 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-[11px] text-white/50">
                                    +{row.count} newer local {row.count === 1 ? 'commit' : 'commits'}
                                </div>
                            </div>
                        )
                    }

                    if (row.kind === 'collapsed-push') {
                        return (
                            <div key={`collapsed-push-${index}`} className="flex items-start gap-3">
                                <div className="flex w-5 flex-col items-center">
                                    <div className="h-2 w-2 rounded-full bg-emerald-400/75" />
                                    {!isLastRow && <div className="mt-1 h-7 w-px bg-emerald-400/35" />}
                                </div>
                                <div className="min-w-0 flex-1 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-[11px] text-white/50">
                                    +{row.count} more included {row.count === 1 ? 'commit' : 'commits'}
                                </div>
                            </div>
                        )
                    }

                    if (row.kind === 'cloud-boundary') {
                        return (
                            <div key={`cloud-${index}`} className="flex items-start gap-3">
                                <div className="flex w-5 flex-col items-center">
                                    <div className="flex h-4 w-4 items-center justify-center rounded-full border border-emerald-400/25 bg-emerald-400/12 text-emerald-100">
                                        <Cloud size={10} />
                                    </div>
                                </div>
                                <div className="min-w-0 flex-1 rounded-lg border border-emerald-400/20 bg-emerald-400/8 px-3 py-2 text-[11px] text-emerald-100/85">
                                    {remoteName || 'Remote'} catches up here after this push.
                                </div>
                            </div>
                        )
                    }

                    const tone = getRoleTone(row.role)

                    return (
                        <div key={row.commit.hash} className="flex items-start gap-3">
                            <div className="flex w-5 flex-col items-center">
                                <div className={cn('h-2.5 w-2.5 rounded-full', tone.dotClassName)} />
                                {!isLastRow && <div className={cn('mt-1 h-9 w-px', tone.lineClassName)} />}
                            </div>
                            <div className={cn('group min-w-0 flex-1 rounded-xl pl-3 pr-2 py-2.5 transition-colors', tone.rowClassName)}>
                                <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0 pr-4">
                                        <div className="mb-0.5 flex items-center gap-2">
                                            <GitCommitHorizontal size={12} className="shrink-0 text-white/40" />
                                            <span className="truncate text-sm font-medium text-white">{row.commit.message}</span>
                                            <span className={cn('shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium', tone.badgeClassName)}>
                                                {tone.badgeLabel}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-3 text-[11px] text-white/40">
                                            <span className="rounded bg-white/5 px-1.5 py-0.5 font-mono text-white/50">{row.commit.shortHash}</span>
                                            <span>{row.commit.author}</span>
                                            {!compact && <span>{new Date(row.commit.date).toLocaleDateString()}</span>}
                                        </div>
                                    </div>
                                    <div className="shrink-0">
                                        <DiffStats
                                            additions={row.commit.additions}
                                            deletions={row.commit.deletions}
                                            compact
                                            loading={row.commit.statsLoaded === false}
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    )
                })}
            </div>
        </div>
    )
}

export function PushRangePreview(props: PushRangePreviewProps) {
    return <PushRangeGraph {...props} />
}

export function PushRangeSelector({
    commits,
    activeCommitHash,
    onActiveCommitChange,
    onCommitClick,
    className,
    remoteName
}: PushRangeSelectorProps) {
    const PAGE_SIZE = 15
    const [page, setPage] = useState(1)
    const activeIndex = useMemo(
        () => (activeCommitHash ? commits.findIndex((commit) => commit.hash === activeCommitHash) : -1),
        [activeCommitHash, commits]
    )
    const totalPages = Math.max(1, Math.ceil(commits.length / PAGE_SIZE))
    const pageStart = (page - 1) * PAGE_SIZE
    const pageEnd = pageStart + PAGE_SIZE
    const visibleCommits = useMemo(
        () => commits.slice(pageStart, pageEnd),
        [commits, pageStart, pageEnd]
    )
    const rowHeight = 56
    const rowGap = 6
    const rowStep = rowHeight + rowGap
    const graphWidth = 28
    const nodeX = 14
    const graphHeight = visibleCommits.length > 0 ? (visibleCommits.length * rowStep) - rowGap : 0

    useEffect(() => {
        if (page > totalPages) {
            setPage(totalPages)
        }
    }, [page, totalPages])

    useEffect(() => {
        if (activeIndex < 0) {
            return
        }

        const nextPage = Math.floor(activeIndex / PAGE_SIZE) + 1
        if (nextPage !== page) {
            setPage(nextPage)
        }
    }, [activeIndex, page])

    return (
        <div className={cn(className)}>
            <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                    <p className="text-[11px] uppercase tracking-[0.18em] text-white/35">Push Range</p>
                    <p className="mt-1 text-xs text-white/55">Click a commit in the local stream to choose the push boundary.</p>
                </div>
                <div className="rounded-lg border border-white/10 bg-black/20 px-2.5 py-1 text-[11px] text-white/60">
                    {remoteName ? `${remoteName} push boundary` : 'Local stream'}
                </div>
            </div>

            <div className="relative min-w-0">
                <svg
                    className="pointer-events-none absolute top-0 left-0"
                    width={graphWidth}
                    height={graphHeight}
                >
                    {visibleCommits.map((commit, index) => {
                        const globalIndex = pageStart + index
                        if (index >= visibleCommits.length - 1) {
                            return null
                        }

                        const y = index * rowStep + rowHeight / 2
                        let stroke = 'rgba(255,255,255,0.12)'

                        if (activeIndex >= 0) {
                            if (globalIndex < activeIndex - 1) {
                                stroke = 'rgba(245,158,11,0.6)'
                            } else if (globalIndex === activeIndex - 1 || globalIndex === activeIndex) {
                                stroke = 'rgba(96,165,250,0.78)'
                            } else if (globalIndex > activeIndex) {
                                stroke = 'rgba(52,211,153,0.6)'
                            }
                        }

                        return (
                            <line
                                key={`push-line-${commit.hash}`}
                                x1={nodeX}
                                y1={y + 6}
                                x2={nodeX}
                                y2={(index + 1) * rowStep + (rowHeight / 2) - 6}
                                stroke={stroke}
                                strokeWidth={globalIndex === activeIndex - 1 || globalIndex === activeIndex ? 3 : 2}
                                opacity={0.95}
                            />
                        )
                    })}

                    {visibleCommits.map((commit, index) => {
                        const y = index * rowStep + rowHeight / 2
                        const globalIndex = pageStart + index
                        const isActive = commit.hash === activeCommitHash
                        const isRetained = activeIndex >= 0 && globalIndex < activeIndex
                        const isIncluded = activeIndex >= 0 && globalIndex > activeIndex
                        const stroke = isActive
                            ? '#60a5fa'
                            : isRetained
                                ? '#f59e0b'
                                : isIncluded
                                    ? '#34d399'
                                    : 'rgba(255,255,255,0.35)'
                        const fill = isActive
                            ? 'rgba(96,165,250,0.22)'
                            : isRetained
                                ? 'rgba(245,158,11,0.16)'
                                : isIncluded
                                    ? 'rgba(52,211,153,0.16)'
                                    : '#09090b'

                        return (
                            <circle
                                key={`push-node-${commit.hash}`}
                                cx={nodeX}
                                cy={y}
                                r={isActive ? 6 : 5}
                                fill={fill}
                                stroke={stroke}
                                strokeWidth={isActive ? 3 : 2}
                            />
                        )
                    })}
                </svg>

                <div className="min-w-0" style={{ marginLeft: graphWidth + 8 }}>
                    {visibleCommits.map((commit, index) => {
                        const globalIndex = pageStart + index
                        const isActive = commit.hash === activeCommitHash
                        const isRetained = activeIndex >= 0 && globalIndex < activeIndex
                        const isIncluded = activeIndex >= 0 && globalIndex > activeIndex

                        return (
                            <div
                                key={commit.hash}
                                className={cn(
                                    'group flex items-center justify-between rounded-xl border pl-3 pr-2 transition-colors',
                                    isActive
                                        ? 'border-blue-400/25 bg-blue-400/10 hover:bg-blue-400/15'
                                        : isRetained
                                            ? 'border-amber-400/15 bg-amber-400/6 hover:bg-amber-400/10'
                                            : isIncluded
                                                ? 'border-emerald-400/15 bg-emerald-400/6 hover:bg-emerald-400/10'
                                                : 'border-white/10 bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.05]'
                                )}
                                style={{
                                    height: rowHeight,
                                    marginBottom: index === visibleCommits.length - 1 ? 0 : rowGap
                                }}
                            >
                                <button
                                    type="button"
                                    onClick={() => onCommitClick?.(commit)}
                                    className="flex min-w-0 flex-1 items-center justify-between gap-3 py-2 text-left"
                                >
                                    <div className="min-w-0 pr-4">
                                        <div className="mb-0.5 flex items-center gap-2">
                                            <span className="truncate text-sm font-medium text-white">{commit.message}</span>
                                            {isActive ? (
                                                <span className="rounded-full border border-blue-400/20 bg-blue-400/12 px-2 py-0.5 text-[10px] font-medium text-blue-100">
                                                    Target
                                                </span>
                                            ) : isRetained ? (
                                                <span className="rounded-full border border-amber-400/20 bg-amber-400/12 px-2 py-0.5 text-[10px] font-medium text-amber-200">
                                                    Stay local
                                                </span>
                                            ) : isIncluded ? (
                                                <span className="rounded-full border border-emerald-400/20 bg-emerald-400/12 px-2 py-0.5 text-[10px] font-medium text-emerald-100">
                                                    Included
                                                </span>
                                            ) : null}
                                        </div>
                                        <div className="mt-1 flex items-center gap-3 text-[11px] text-white/40">
                                            <span className="rounded bg-white/5 px-1.5 py-0.5 font-mono text-white/50">{commit.shortHash}</span>
                                            <span>{commit.author}</span>
                                            <span>{new Date(commit.date).toLocaleDateString()}</span>
                                        </div>
                                    </div>
                                    <div className="shrink-0">
                                        <DiffStats
                                            additions={commit.additions}
                                            deletions={commit.deletions}
                                            compact
                                            loading={commit.statsLoaded === false}
                                        />
                                    </div>
                                </button>
                                <div className="shrink-0 pl-3">
                                    <button
                                        type="button"
                                        onClick={() => onActiveCommitChange(commit.hash)}
                                        className={cn(
                                            'rounded-lg border px-3 py-1.5 text-[11px] font-medium transition-colors',
                                            isActive
                                                ? 'border-blue-400/25 bg-blue-400/15 text-blue-100'
                                                : 'border-white/10 bg-white/[0.03] text-white/70 hover:border-white/20 hover:bg-white/[0.05] hover:text-white'
                                        )}
                                    >
                                        {isActive ? 'Selected' : 'Set Target'}
                                    </button>
                                </div>
                            </div>
                        )
                    })}
                </div>
            </div>

            {totalPages > 1 && (
                <div className="mt-3 flex items-center justify-between gap-3 border-t border-white/5 pt-3">
                    <p className="text-xs text-white/45">
                        Showing {pageStart + 1}-{Math.min(pageEnd, commits.length)} of {commits.length} local commits.
                    </p>
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={() => setPage((current) => Math.max(1, current - 1))}
                            disabled={page <= 1}
                            className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs text-white/70 transition-colors hover:border-white/20 hover:bg-white/[0.05] hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                        >
                            Previous
                        </button>
                        <span className="text-xs text-white/45">
                            {page} / {totalPages}
                        </span>
                        <button
                            type="button"
                            onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                            disabled={page >= totalPages}
                            className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs text-white/70 transition-colors hover:border-white/20 hover:bg-white/[0.05] hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                        >
                            Next
                        </button>
                    </div>
                </div>
            )}
        </div>
    )
}

export function PushRangeConfirmModal({
    isOpen,
    summary,
    isPushing = false,
    dontShowAgain,
    setDontShowAgain,
    remoteName,
    onCancel,
    onConfirm
}: PushRangeConfirmModalProps) {
    const [showAll, setShowAll] = useState(false)

    useEffect(() => {
        if (!isOpen) {
            setShowAll(false)
            return
        }

        const originalOverflow = document.body.style.overflow
        document.body.style.overflow = 'hidden'

        return () => {
            document.body.style.overflow = originalOverflow
        }
    }, [isOpen])

    if (!isOpen || !summary || typeof document === 'undefined') {
        return null
    }

    return createPortal(
        <div
            className="fixed inset-0 z-[140] flex items-center justify-center bg-black/60 backdrop-blur-md animate-fadeIn"
            onClick={onCancel}
        >
            <div
                className="flex max-h-[95vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-sparkle-card shadow-2xl m-4"
                onClick={(event) => event.stopPropagation()}
            >
                <div className="border-b border-white/10 bg-white/[0.02] px-6 py-5">
                    <div className="flex items-start justify-between gap-4">
                        <div>
                            <p className="text-[11px] uppercase tracking-[0.2em] text-white/35">Confirm Partial Push</p>
                            <h3 className="mt-1 text-lg font-semibold text-white">Push up to this commit?</h3>
                            <p className="mt-2 text-sm text-white/60">
                                This will send {formatCommitCount(summary.commitsToPush.length, 'commit')} to {remoteName || 'remote'} and leave {formatCommitCount(summary.newerLocalCommits.length, 'newer local commit', 'newer local commits')} on this device.
                            </p>
                        </div>
                        <div className="shrink-0 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-right">
                            <p className="text-[11px] uppercase tracking-[0.18em] text-white/35">Target</p>
                            <p className="mt-1 text-sm font-medium text-white/90">{summary.selectedCommit.shortHash}</p>
                        </div>
                    </div>
                </div>

                <div className="project-surface-scrollbar flex-1 overflow-y-auto px-6 py-5">
                    <div className="mb-4 grid gap-3 md:grid-cols-3">
                        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                            <p className="text-[11px] uppercase tracking-[0.18em] text-white/35">Will Push</p>
                            <p className="mt-2 text-2xl font-semibold text-emerald-100">{summary.commitsToPush.length}</p>
                        </div>
                        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                            <p className="text-[11px] uppercase tracking-[0.18em] text-white/35">Stays Local</p>
                            <p className="mt-2 text-2xl font-semibold text-amber-100">{summary.newerLocalCommits.length}</p>
                        </div>
                        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                            <p className="text-[11px] uppercase tracking-[0.18em] text-white/35">Selected</p>
                            <p className="mt-2 truncate text-sm font-medium text-white/88">{summary.selectedCommit.message}</p>
                        </div>
                    </div>

                    <PushRangeGraph summary={summary} compact={!showAll} showCloudBoundary className="border-white/10" remoteName={remoteName} />

                    <div className="mt-4 flex items-center justify-between gap-3">
                        <button
                            type="button"
                            onClick={() => setShowAll((value) => !value)}
                            className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white/70 transition-all hover:border-white/20 hover:bg-white/[0.06] hover:text-white"
                        >
                            <ArrowDownCircle size={14} className={cn('transition-transform', showAll && 'rotate-180')} />
                            {showAll ? 'Show Smaller Subset' : 'Show Full Commit Chain'}
                        </button>
                        <p className="text-xs text-white/40">
                            Review the exact chain before approving the push.
                        </p>
                    </div>
                </div>

                <div className="flex items-center justify-between gap-3 border-t border-white/10 bg-white/[0.02] px-6 py-4">
                    <label className="inline-flex cursor-pointer items-center gap-3 text-sm text-white/70">
                        <input
                            type="checkbox"
                            checked={dontShowAgain}
                            onChange={(event) => setDontShowAgain(event.target.checked)}
                            className="h-4 w-4 rounded border border-white/20 bg-transparent accent-[var(--accent-primary)]"
                        />
                        <span>Don't show again</span>
                    </label>
                    <div className="flex items-center gap-3">
                        <button
                            type="button"
                            onClick={onCancel}
                            className="rounded-lg border border-white/10 px-3.5 py-2 text-sm text-white/65 transition-all hover:border-white/20 hover:bg-white/[0.04] hover:text-white"
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            onClick={onConfirm}
                            disabled={isPushing}
                            className="rounded-lg border border-blue-400/25 bg-blue-400/12 px-4 py-2 text-sm font-medium text-blue-100 transition-all hover:bg-blue-400/20 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                            {isPushing ? 'Pushing...' : 'Approve Push Range'}
                        </button>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    )
}
