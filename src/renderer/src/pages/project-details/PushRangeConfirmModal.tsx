import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { ArrowDownCircle, Cloud, GitCommitHorizontal } from 'lucide-react'
import { cn } from '@/lib/utils'
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
}

type PushRangeSelectorProps = {
    commits: GitCommit[]
    activeCommitHash: string | null
    onActiveCommitChange: (commitHash: string) => void
    className?: string
}

type PushRangeConfirmModalProps = {
    isOpen: boolean
    summary: PushRangeSummary | null
    isPushing?: boolean
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
            badgeLabel: 'Stays local'
        }
    }

    if (role === 'selected') {
        return {
            dotClassName: SELECTED_COLOR,
            lineClassName: 'bg-blue-400/70',
            badgeClassName: 'border border-blue-400/20 bg-blue-400/12 text-blue-100',
            badgeLabel: 'Push target'
        }
    }

    return {
        dotClassName: INCLUDED_COLOR,
        lineClassName: 'bg-emerald-400/60',
        badgeClassName: 'border border-emerald-400/20 bg-emerald-400/12 text-emerald-100',
        badgeLabel: 'Included'
    }
}

function PushRangeGraph({
    summary,
    compact = false,
    className,
    showCloudBoundary = true
}: PushRangePreviewProps) {
    const rows = useMemo(
        () => buildPreviewRows(summary, compact, showCloudBoundary),
        [summary, compact, showCloudBoundary]
    )

    return (
        <div className={cn('rounded-xl border border-white/10 bg-white/[0.03] p-3', className)}>
            <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                    <p className="text-[11px] uppercase tracking-[0.18em] text-white/35">Push Range</p>
                    <p className="mt-1 text-xs text-white/55">
                        {formatCommitCount(summary.commitsToPush.length, 'commit')} will push.
                        {' '}
                        {formatCommitCount(summary.newerLocalCommits.length, 'commit')} stays local.
                    </p>
                </div>
                <div className="rounded-lg border border-white/10 bg-black/20 px-2.5 py-1 text-[11px] text-white/60">
                    origin
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
                                <div className="min-w-0 flex-1 rounded-lg border border-white/8 bg-black/20 px-3 py-2 text-[11px] text-white/50">
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
                                <div className="min-w-0 flex-1 rounded-lg border border-white/8 bg-black/20 px-3 py-2 text-[11px] text-white/50">
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
                                <div className="min-w-0 flex-1 rounded-lg border border-emerald-400/15 bg-emerald-400/8 px-3 py-2 text-[11px] text-emerald-100/85">
                                    Origin catches up here after this push.
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
                            <div className="min-w-0 flex-1 rounded-lg border border-white/8 bg-black/20 px-3 py-2.5">
                                <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                        <div className="mb-1 flex items-center gap-2">
                                            <GitCommitHorizontal size={12} className="shrink-0 text-white/40" />
                                            <span className="truncate text-xs font-medium text-white/88">{row.commit.message}</span>
                                            <span className={cn('shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium', tone.badgeClassName)}>
                                                {tone.badgeLabel}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2 text-[11px] text-white/45">
                                            <span className="font-mono text-white/50">{row.commit.shortHash}</span>
                                            <span>{row.commit.author}</span>
                                        </div>
                                    </div>
                                    {!compact && (
                                        <div className="shrink-0 text-[11px] text-white/35">
                                            {new Date(row.commit.date).toLocaleDateString()}
                                        </div>
                                    )}
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
    className
}: PushRangeSelectorProps) {
    const activeIndex = useMemo(
        () => (activeCommitHash ? commits.findIndex((commit) => commit.hash === activeCommitHash) : -1),
        [activeCommitHash, commits]
    )
    const rowHeight = 60
    const rowGap = 8
    const rowStep = rowHeight + rowGap
    const graphWidth = 28
    const nodeX = 14
    const graphHeight = commits.length > 0 ? (commits.length * rowStep) - rowGap : 0

    return (
        <div className={cn('rounded-xl border border-white/10 bg-white/[0.03] p-4', className)}>
            <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                    <p className="text-[11px] uppercase tracking-[0.18em] text-white/35">Push Range</p>
                    <p className="mt-1 text-xs text-white/55">Click a commit in the local stream to choose the push boundary.</p>
                </div>
                <div className="rounded-lg border border-white/10 bg-black/20 px-2.5 py-1 text-[11px] text-white/60">
                    Local stream
                </div>
            </div>

            <div className="relative overflow-x-auto">
                <svg
                    className="pointer-events-none absolute top-0 left-0"
                    width={graphWidth}
                    height={graphHeight}
                >
                    {commits.map((commit, index) => {
                        if (index >= commits.length - 1) {
                            return null
                        }

                        const y = index * rowStep + rowHeight / 2
                        let stroke = 'rgba(255,255,255,0.12)'

                        if (activeIndex >= 0) {
                            if (index < activeIndex - 1) {
                                stroke = 'rgba(245,158,11,0.6)'
                            } else if (index === activeIndex - 1 || index === activeIndex) {
                                stroke = 'rgba(96,165,250,0.78)'
                            } else if (index > activeIndex) {
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
                                strokeWidth={index === activeIndex - 1 || index === activeIndex ? 3 : 2}
                                opacity={0.95}
                            />
                        )
                    })}

                    {commits.map((commit, index) => {
                        const y = index * rowStep + rowHeight / 2
                        const isActive = commit.hash === activeCommitHash
                        const isRetained = activeIndex >= 0 && index < activeIndex
                        const isIncluded = activeIndex >= 0 && index > activeIndex
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

                <div style={{ marginLeft: graphWidth + 8 }}>
                    {commits.map((commit, index) => {
                        const isActive = commit.hash === activeCommitHash
                        const isRetained = activeIndex >= 0 && index < activeIndex
                        const isIncluded = activeIndex >= 0 && index > activeIndex

                        return (
                            <button
                                key={commit.hash}
                                type="button"
                                onClick={() => onActiveCommitChange(commit.hash)}
                                className={cn(
                                    'flex w-full items-center justify-between rounded-xl border px-3 py-3 text-left transition-all',
                                    isActive
                                        ? 'border-blue-400/20 bg-blue-400/8'
                                        : 'border-transparent hover:border-white/10 hover:bg-white/[0.03]'
                                )}
                                style={{
                                    height: rowHeight,
                                    marginBottom: index === commits.length - 1 ? 0 : rowGap
                                }}
                            >
                                <div className="min-w-0">
                                    <div className="flex items-center gap-2">
                                        <span className="truncate text-sm font-medium text-white/88">{commit.message}</span>
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
                                    <div className="mt-1 flex items-center gap-2 text-[11px] text-white/40">
                                        <span className="font-mono text-white/50">{commit.shortHash}</span>
                                        <span>{commit.author}</span>
                                    </div>
                                </div>
                                <div className="shrink-0 text-[11px] text-white/35">
                                    {new Date(commit.date).toLocaleDateString()}
                                </div>
                            </button>
                        )
                    })}
                </div>
            </div>
        </div>
    )
}

export function PushRangeConfirmModal({
    isOpen,
    summary,
    isPushing = false,
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
            className="fixed inset-0 z-[140] flex items-center justify-center bg-black/70 px-4 py-6 backdrop-blur-md"
            onClick={onCancel}
        >
            <div
                className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#07090d]/96 shadow-2xl"
                onClick={(event) => event.stopPropagation()}
            >
                <div className="border-b border-white/10 px-6 py-5">
                    <div className="flex items-start justify-between gap-4">
                        <div>
                            <p className="text-[11px] uppercase tracking-[0.2em] text-white/35">Confirm Partial Push</p>
                            <h3 className="mt-1 text-lg font-semibold text-white">Push up to this commit?</h3>
                            <p className="mt-2 text-sm text-white/60">
                                This will send {formatCommitCount(summary.commitsToPush.length, 'commit')} to origin and leave {formatCommitCount(summary.newerLocalCommits.length, 'newer local commit', 'newer local commits')} on this device.
                            </p>
                        </div>
                        <div className="shrink-0 rounded-xl border border-blue-400/15 bg-blue-400/8 px-3 py-2 text-right">
                            <p className="text-[11px] uppercase tracking-[0.18em] text-blue-100/55">Target</p>
                            <p className="mt-1 text-sm font-medium text-blue-50">{summary.selectedCommit.shortHash}</p>
                        </div>
                    </div>
                </div>

                <div className="project-surface-scrollbar flex-1 overflow-y-auto px-6 py-5">
                    <div className="mb-4 grid gap-3 md:grid-cols-3">
                        <div className="rounded-xl border border-emerald-400/15 bg-emerald-400/8 p-4">
                            <p className="text-[11px] uppercase tracking-[0.18em] text-emerald-100/55">Will Push</p>
                            <p className="mt-2 text-2xl font-semibold text-emerald-100">{summary.commitsToPush.length}</p>
                        </div>
                        <div className="rounded-xl border border-amber-400/15 bg-amber-400/8 p-4">
                            <p className="text-[11px] uppercase tracking-[0.18em] text-amber-100/55">Stays Local</p>
                            <p className="mt-2 text-2xl font-semibold text-amber-100">{summary.newerLocalCommits.length}</p>
                        </div>
                        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                            <p className="text-[11px] uppercase tracking-[0.18em] text-white/35">Selected</p>
                            <p className="mt-2 truncate text-sm font-medium text-white/88">{summary.selectedCommit.message}</p>
                        </div>
                    </div>

                    <PushRangeGraph summary={summary} compact={!showAll} showCloudBoundary className="border-white/10" />

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

                <div className="flex items-center justify-end gap-3 border-t border-white/10 px-6 py-4">
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
        </div>,
        document.body
    )
}
