import { useEffect, useRef, useState } from 'react'
import { AnimatedHeight } from '@/components/ui/AnimatedHeight'
import {
    Bot,
    Brain,
    Check,
    ChevronDown,
    ChevronLeft,
    ChevronRight,
    Copy,
    RotateCcw,
    type LucideIcon
} from 'lucide-react'
import { cn } from '@/lib/utils'
import MarkdownRenderer from '@/components/ui/MarkdownRenderer'
import type { AssistantActivity, AssistantApproval, AssistantReasoning } from './assistant-page-types'
import {
    ActivityIcon,
    formatStatTimestamp
} from './assistant-message-utils'

const MAX_VISIBLE_THOUGHTS = 80
const THOUGHT_COLLAPSE_WINDOW_MS = 12_000
const MAX_VISIBLE_MODIFIED_FILES = 8
const MAX_DIFF_STATS_FILES = 8
const FILE_MUTATION_HINTS = ['edit', 'write', 'applypatch', 'patch', 'rename', 'move', 'delete', 'create']
const FILE_NON_MUTATING_HINTS = ['read', 'list', 'grep', 'glob', 'search', 'scan', 'open']

type CollapsedThought = AssistantActivity & {
    updateCount: number
    startTimestamp: number
    endTimestamp: number
}

type ModifiedFileEntry = {
    path: string
    updateCount: number
    lastTimestamp: number
    additions: number
    deletions: number
}

type FileDiffStats = {
    additions: number
    deletions: number
}

function readDiffNumber(value: unknown): number {
    const parsed = Number(value)
    if (!Number.isFinite(parsed) || parsed <= 0) return 0
    return Math.floor(parsed)
}

function parseActivityDiffStats(payload: Record<string, unknown>): FileDiffStats {
    return {
        additions: readDiffNumber(
            payload.additions
            ?? payload.insertions
            ?? payload.added
            ?? payload.linesAdded
        ),
        deletions: readDiffNumber(
            payload.deletions
            ?? payload.removals
            ?? payload.removed
            ?? payload.linesDeleted
        )
    }
}

function parseDiffLineStats(diffText: string): FileDiffStats {
    if (!diffText || diffText === 'No changes') return { additions: 0, deletions: 0 }
    const lines = diffText.split('\n')
    let additions = 0
    let deletions = 0

    for (const line of lines) {
        if (!line) continue
        if (line.startsWith('+++') || line.startsWith('---')) continue
        if (line.startsWith('+')) additions += 1
        else if (line.startsWith('-')) deletions += 1
    }

    return { additions, deletions }
}

function CompactDiffBars({ additions, deletions, compact }: { additions: number; deletions: number; compact: boolean }) {
    const slotCount = compact ? 8 : 10
    const total = additions + deletions
    let plusSlots = 0
    let minusSlots = 0

    if (total > 0) {
        plusSlots = Math.round((additions / total) * slotCount)
        minusSlots = Math.round((deletions / total) * slotCount)

        if (additions > 0 && plusSlots === 0) plusSlots = 1
        if (deletions > 0 && minusSlots === 0) minusSlots = 1
        if (plusSlots + minusSlots > slotCount) {
            const overflow = plusSlots + minusSlots - slotCount
            if (plusSlots >= minusSlots) plusSlots -= overflow
            else minusSlots -= overflow
        }
    }

    return (
        <span className="inline-flex items-center gap-[2px]">
            {Array.from({ length: slotCount }).map((_, index) => {
                const isPlus = index < plusSlots
                const isMinus = !isPlus && index < (plusSlots + minusSlots)
                return (
                    <span
                        key={`bar-${index}`}
                        className={cn(
                            'h-2 w-[3px] rounded-[2px]',
                            isPlus
                                ? 'bg-emerald-400/95'
                                : isMinus
                                    ? 'bg-rose-400/95'
                                    : 'bg-sparkle-border/70'
                        )}
                    />
                )
            })}
        </span>
    )
}

function normalizeThoughtKey(value: string): string {
    return String(value || '').trim().replace(/\s+/g, ' ').toLowerCase()
}

function getThoughtUpdateCount(activity: AssistantActivity): number {
    const value = Number((activity.payload || {}).updateCount)
    if (!Number.isFinite(value) || value < 1) return 1
    return Math.floor(value)
}

function collapseThoughts(entries: AssistantActivity[]): CollapsedThought[] {
    const collapsed: CollapsedThought[] = []

    for (const entry of entries) {
        const updateCount = getThoughtUpdateCount(entry)
        const last = collapsed[collapsed.length - 1]
        const sameAsLast = last
            ? normalizeThoughtKey(last.kind) === normalizeThoughtKey(entry.kind)
                && normalizeThoughtKey(last.method) === normalizeThoughtKey(entry.method)
                && normalizeThoughtKey(last.summary) === normalizeThoughtKey(entry.summary)
                && (entry.timestamp - last.endTimestamp) <= THOUGHT_COLLAPSE_WINDOW_MS
            : false

        if (sameAsLast && last) {
            last.updateCount += updateCount
            last.endTimestamp = entry.timestamp
            if (String(entry.summary || '').length > String(last.summary || '').length) {
                last.summary = entry.summary
            }
            continue
        }

        collapsed.push({
            ...entry,
            updateCount,
            startTimestamp: entry.timestamp,
            endTimestamp: entry.timestamp
        })
    }

    return collapsed
}

function normalizeModifiedFilePath(value: string): string {
    const trimmed = String(value || '').trim().replace(/^['"`]+|['"`]+$/g, '')
    if (!trimmed) return ''
    return trimmed.replace(/\\/g, '/').replace(/^\.\//, '')
}

function toModifiedFileKey(value: string): string {
    return normalizeModifiedFilePath(value).toLowerCase()
}

function collectActivityFilePaths(payload: Record<string, unknown>): string[] {
    const paths: string[] = []
    const addPath = (value: unknown) => {
        if (typeof value !== 'string') return
        const normalized = normalizeModifiedFilePath(value)
        if (!normalized) return
        paths.push(normalized)
    }

    addPath(payload.filePath)
    addPath(payload.path)

    const files = payload.files
    if (Array.isArray(files)) {
        for (const file of files) {
            if (typeof file === 'string') {
                addPath(file)
            } else if (file && typeof file === 'object') {
                const record = file as Record<string, unknown>
                addPath(record.path)
                addPath(record.filePath)
                addPath(record.name)
            }
        }
    }

    return Array.from(new Set(paths))
}

function isLikelyFileMutation(activity: AssistantActivity): boolean {
    const method = normalizeThoughtKey(activity.method)
    const kind = normalizeThoughtKey(activity.kind)
    const payload = (activity.payload || {}) as Record<string, unknown>
    const tool = normalizeThoughtKey(String(payload.tool || ''))
    const hasMutationHint = FILE_MUTATION_HINTS.some((token) => method.includes(token) || tool.includes(token))
    if (hasMutationHint) return true

    const hasNonMutatingHint = FILE_NON_MUTATING_HINTS.some((token) => method.includes(token) || tool.includes(token))
    if (hasNonMutatingHint) return false

    const hasFilePaths = collectActivityFilePaths(payload).length > 0
    return kind === 'file' && hasFilePaths
}

function buildModifiedFiles(entries: AssistantActivity[]): ModifiedFileEntry[] {
    const byPath = new Map<string, ModifiedFileEntry>()
    const sorted = [...entries].sort((a, b) => a.timestamp - b.timestamp)

    for (const activity of sorted) {
        if (!isLikelyFileMutation(activity)) continue
        const payload = (activity.payload || {}) as Record<string, unknown>
        const paths = collectActivityFilePaths(payload)
        if (paths.length === 0) continue
        const updateCount = getThoughtUpdateCount(activity)
        const activityDiff = parseActivityDiffStats(payload)
        const canApplyActivityDiff = paths.length === 1

        for (const path of paths) {
            const key = toModifiedFileKey(path)
            if (!key) continue
            const existing = byPath.get(key)
            if (existing) {
                existing.updateCount += updateCount
                existing.lastTimestamp = Math.max(existing.lastTimestamp, activity.timestamp)
                if (canApplyActivityDiff) {
                    existing.additions += activityDiff.additions
                    existing.deletions += activityDiff.deletions
                }
                continue
            }
            byPath.set(key, {
                path,
                updateCount,
                lastTimestamp: activity.timestamp,
                additions: canApplyActivityDiff ? activityDiff.additions : 0,
                deletions: canApplyActivityDiff ? activityDiff.deletions : 0
            })
        }
    }

    return Array.from(byPath.values()).sort((a, b) => {
        if (a.lastTimestamp !== b.lastTimestamp) return b.lastTimestamp - a.lastTimestamp
        return a.path.localeCompare(b.path)
    })
}

function splitModifiedFilePath(path: string): { directory: string; filename: string } {
    const normalized = normalizeModifiedFilePath(path)
    if (!normalized) return { directory: '', filename: '' }
    const lastSlash = normalized.lastIndexOf('/')
    if (lastSlash < 0) return { directory: '', filename: normalized }
    return {
        directory: normalized.slice(0, lastSlash + 1),
        filename: normalized.slice(lastSlash + 1)
    }
}

type AssistantMessageAttempt = {
    id: string
    text: string
    reasoningText?: string
    createdAt?: number
    turnId?: string
    attemptGroupId?: string
    isActiveAttempt?: boolean
}

interface AssistantMessageProps {
    attempts: AssistantMessageAttempt[]
    onRegenerate: (turnId: string) => void | Promise<void>
    isBusy: boolean
    compact?: boolean
    activeModel?: string
    activeProfile?: string
    streamingTurnId?: string | null
    streamingText?: string
    projectPath?: string
    reasoning?: AssistantReasoning[]
    activities?: AssistantActivity[]
    approvals?: AssistantApproval[]
}

export function AssistantMessage({
    attempts,
    onRegenerate,
    isBusy,
    compact = false,
    activeModel = 'default',
    activeProfile = 'safe-dev',
    streamingTurnId = null,
    streamingText = '',
    projectPath,
    activities = [],
}: AssistantMessageProps) {
    const activeIndex = attempts.findIndex((attempt) => attempt.isActiveAttempt)
    const initialIndex = activeIndex >= 0 ? activeIndex : Math.max(0, attempts.length - 1)

    const [viewIndex, setViewIndex] = useState(initialIndex)
    const [copied, setCopied] = useState(false)
    const [isThoughtsOpen, setIsThoughtsOpen] = useState(false)
    const [isMessageInfoOpen, setIsMessageInfoOpen] = useState(false)
    const [isRegenerating, setIsRegenerating] = useState(false)
    const [isAttemptPinned, setIsAttemptPinned] = useState(false)
    const [elapsedNowMs, setElapsedNowMs] = useState(() => Date.now())
    const [diffStatsByPath, setDiffStatsByPath] = useState<Record<string, FileDiffStats>>({})
    const diffStatsCacheRef = useRef<Map<string, FileDiffStats>>(new Map())
    const thoughtsBodyRef = useRef<HTMLDivElement | null>(null)

    useEffect(() => {
        if (viewIndex >= Math.max(1, attempts.length)) {
            setViewIndex(Math.max(0, attempts.length - 1))
        }
    }, [attempts.length, viewIndex])

    useEffect(() => {
        if (activeIndex < 0) return
        setViewIndex((prev) => {
            if (!isAttemptPinned) return activeIndex
            if (prev >= attempts.length) return Math.max(0, attempts.length - 1)
            return prev
        })
    }, [activeIndex, attempts.length, isAttemptPinned])

    useEffect(() => {
        if (!isBusy) setIsRegenerating(false)
    }, [isBusy])

    const currentAttempt = attempts[viewIndex]
    if (!currentAttempt) return null
    const isStreamingCurrentAttempt = Boolean(streamingText) && (
        (Boolean(currentAttempt.turnId) && currentAttempt.turnId === streamingTurnId)
        || (Boolean(currentAttempt.isActiveAttempt) && !currentAttempt.turnId)
    )
    const displayedText = isStreamingCurrentAttempt ? streamingText : currentAttempt.text

    const turnActivities = activities.filter((entry) => {
        const sameTurn = Boolean(currentAttempt.turnId) && entry.turnId === currentAttempt.turnId
        const sameGroup = Boolean(currentAttempt.attemptGroupId) && entry.attemptGroupId === currentAttempt.attemptGroupId
        return sameTurn || sameGroup
    })
    const commandActivities = turnActivities.filter((entry) => String(entry.kind || '').toLowerCase() === 'command')
    const modifiedFiles = buildModifiedFiles(turnActivities)
    const visibleModifiedFiles = modifiedFiles.slice(0, MAX_VISIBLE_MODIFIED_FILES)
    const visibleModifiedFilesKey = visibleModifiedFiles
        .map((file) => `${toModifiedFileKey(file.path)}:${file.updateCount}:${file.additions}:${file.deletions}`)
        .join('|')
    const hiddenModifiedFilesCount = Math.max(0, modifiedFiles.length - visibleModifiedFiles.length)
    const totalModifiedFileUpdates = modifiedFiles.reduce((sum, file) => sum + file.updateCount, 0)
    const allThoughts = [...commandActivities].sort(
        (a, b) => a.timestamp - b.timestamp
    )
    const collapsedThoughts = collapseThoughts(allThoughts)
    const visibleThoughts = collapsedThoughts.slice(-MAX_VISIBLE_THOUGHTS)
    const firstThoughtAt = allThoughts.length > 0 ? allThoughts[0].timestamp : null
    const lastThoughtAt = allThoughts.length > 0 ? allThoughts[allThoughts.length - 1].timestamp : null
    const isLiveAttempt = isBusy && (isStreamingCurrentAttempt || Boolean(currentAttempt.isActiveAttempt))
    const elapsedStartAt = firstThoughtAt !== null
        ? firstThoughtAt
        : (isLiveAttempt && Number.isFinite(currentAttempt.createdAt) ? Number(currentAttempt.createdAt) : null)
    const elapsedEndAt = elapsedStartAt !== null
        ? (isLiveAttempt ? elapsedNowMs : (lastThoughtAt ?? elapsedStartAt))
        : null
    const thoughtElapsedMs = (elapsedStartAt !== null && elapsedEndAt !== null)
        ? Math.max(0, elapsedEndAt - elapsedStartAt)
        : 0

    const handleCopy = async () => {
        if (!displayedText) return
        await window.devscope.copyToClipboard(displayedText)
        setCopied(true)
        window.setTimeout(() => setCopied(false), 1400)
    }

    const handleRegenerate = async () => {
        if (isBusy || !currentAttempt.turnId) return
        setIsAttemptPinned(false)
        setIsRegenerating(true)
        try {
            await Promise.resolve(onRegenerate(currentAttempt.turnId))
        } catch {
            setIsRegenerating(false)
        }
    }

    const hasMultipleAttempts = attempts.length > 1
    const hasThoughts = allThoughts.length > 0
    const outputChars = displayedText.trim().length
    const outputTokens = outputChars > 0 ? Math.max(1, Math.round(outputChars / 4)) : 0
    const thoughtSummaryCount = collapsedThoughts.length
    const activityCount = commandActivities.length
    const approvalCount = 0
    const canRegenerate = Boolean(currentAttempt.turnId)
    const timestampLabel = formatStatTimestamp(currentAttempt.createdAt)
    const thoughtElapsedLabel = thoughtElapsedMs > 0
        ? `${(thoughtElapsedMs / 1000).toFixed(thoughtElapsedMs < 10_000 ? 1 : 0)}s`
        : isLiveAttempt
            ? 'live'
            : '0.0s'
    const isCurrentThinkingTurn = isBusy && (
        Boolean(currentAttempt.isActiveAttempt)
        || (Boolean(currentAttempt.turnId) && currentAttempt.turnId === streamingTurnId)
    )
    const stats = [
        { id: 'tok', prefix: '', value: String(outputTokens), suffix: 'tok' },
        { id: 'chars', prefix: '', value: String(outputChars), suffix: 'chars' },
        { id: 'commands', prefix: '', value: String(thoughtSummaryCount), suffix: 'commands' },
        { id: 'actions', prefix: '', value: String(activityCount), suffix: 'actions' },
        { id: 'approvals', prefix: '', value: String(approvalCount), suffix: 'approvals' },
        { id: 'time', prefix: 'at', value: timestampLabel, suffix: '' },
        { id: 'elapsed', prefix: 'elapsed', value: thoughtElapsedLabel, suffix: '' }
    ] as const
    const compactStats = [
        { id: 'commands', prefix: '', value: String(thoughtSummaryCount), suffix: 'commands' },
        { id: 'elapsed', prefix: 'elapsed', value: thoughtElapsedLabel, suffix: '' }
    ] as const

    useEffect(() => {
        const normalizedProjectPath = String(projectPath || '').trim()
        if (!normalizedProjectPath || visibleModifiedFiles.length === 0) {
            setDiffStatsByPath({})
            return
        }

        const targets = visibleModifiedFiles.slice(0, MAX_DIFF_STATS_FILES)
        const base: Record<string, FileDiffStats> = {}
        const missingTargets = targets.filter((file) => {
            const key = `${normalizedProjectPath}::${toModifiedFileKey(file.path)}`
            const cached = diffStatsCacheRef.current.get(key)
            if (cached) {
                base[toModifiedFileKey(file.path)] = cached
                return false
            }

            if (file.additions > 0 || file.deletions > 0) {
                const initialStats = { additions: file.additions, deletions: file.deletions }
                diffStatsCacheRef.current.set(key, initialStats)
                base[toModifiedFileKey(file.path)] = initialStats
                return false
            }

            return true
        })

        let cancelled = false
        setDiffStatsByPath(base)

        if (missingTargets.length === 0) return

        void Promise.all(missingTargets.map(async (file) => {
            try {
                const diff = await window.devscope.getWorkingDiff(normalizedProjectPath, file.path)
                const text = diff?.success ? String(diff.diff || '') : ''
                const stats = parseDiffLineStats(text)
                return { key: toModifiedFileKey(file.path), stats }
            } catch {
                return { key: toModifiedFileKey(file.path), stats: { additions: 0, deletions: 0 } }
            }
        })).then((results) => {
            if (cancelled) return
            setDiffStatsByPath((prev) => {
                const next = { ...prev }
                for (const result of results) {
                    next[result.key] = result.stats
                    diffStatsCacheRef.current.set(`${normalizedProjectPath}::${result.key}`, result.stats)
                }
                return next
            })
        })

        return () => {
            cancelled = true
        }
    }, [projectPath, visibleModifiedFilesKey])

    useEffect(() => {
        if (!isLiveAttempt) return
        const timer = window.setInterval(() => {
            setElapsedNowMs(Date.now())
        }, 200)
        return () => window.clearInterval(timer)
    }, [isLiveAttempt])

    useEffect(() => {
        if (!isCurrentThinkingTurn || !hasThoughts) return
        setIsThoughtsOpen(true)
    }, [isCurrentThinkingTurn, hasThoughts])

    useEffect(() => {
        if (!isThoughtsOpen) return
        const el = thoughtsBodyRef.current
        if (!el) return
        el.scrollTo({
            top: el.scrollHeight,
            behavior: isBusy ? 'auto' : 'smooth'
        })
    }, [isThoughtsOpen, allThoughts.length, isBusy])

    return (
        <div className="group w-full max-w-none space-y-2.5 animate-fadeIn">
            {hasThoughts && (
                <div className="w-full rounded-xl border border-sparkle-border bg-sparkle-card/70 animate-fadeIn">
                    <button
                        type="button"
                        onClick={() => setIsThoughtsOpen((prev) => !prev)}
                        className={cn(
                            'flex w-full items-center justify-between px-3 py-2 text-sparkle-text-secondary transition-colors hover:bg-sparkle-card-hover',
                            compact ? 'text-[10px]' : 'text-xs'
                        )}
                    >
                        <div className="flex items-center gap-2.5">
                            <Brain size={13} className="text-indigo-300" />
                            <span className={cn('font-mono uppercase tracking-wide text-sparkle-text-muted', compact ? 'text-[8px]' : 'text-[10px]')}>Commands Ran</span>
                            {isBusy && (
                                <span className="inline-flex h-2 w-2 rounded-full bg-indigo-300 animate-pulse" />
                            )}
                            <span className={cn('rounded-[4px] border border-sparkle-border px-2 py-0.5 font-mono text-sparkle-text-muted', compact ? 'text-[8px]' : 'text-[10px]')}>
                                {collapsedThoughts.length}
                            </span>
                            {allThoughts.length > collapsedThoughts.length && (
                                <span className={cn('rounded-[4px] border border-sparkle-border px-2 py-0.5 font-mono text-sparkle-text-muted', compact ? 'text-[8px]' : 'text-[10px]')}>
                                    {allThoughts.length} updates
                                </span>
                            )}
                            <span className={cn('rounded-[4px] border border-sparkle-border px-2 py-0.5 font-mono text-sparkle-text-muted', compact ? 'text-[8px]' : 'text-[10px]')}>for {thoughtElapsedLabel}</span>
                        </div>
                        <ChevronDown
                            size={13}
                            className={cn('transition-transform', isThoughtsOpen ? 'rotate-180' : '')}
                        />
                    </button>

                    <AnimatedHeight isOpen={isThoughtsOpen} duration={500}>
                        <div
                            ref={thoughtsBodyRef}
                            className="max-h-[42vh] space-y-2 overflow-y-auto border-t border-sparkle-border p-3"
                        >
                            {visibleThoughts.map((item, index) => {
                                const animationStyle = {
                                    animationDelay: `${Math.min(index, 10) * 45}ms`,
                                    animationFillMode: 'both' as const
                                }
                                return (
                                    <div
                                        key={`activity-${index}`}
                                        className={cn(
                                            'flex items-start gap-2 rounded-md border border-sparkle-border bg-sparkle-bg px-3 py-2 animate-fadeIn',
                                            compact ? 'text-[10px]' : 'text-xs'
                                        )}
                                        style={animationStyle}
                                    >
                                        <span className="mt-0.5">
                                            <ActivityIcon kind={item.kind} />
                                        </span>
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-2 text-sparkle-text">
                                                <span className="rounded-full border border-sparkle-border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide text-sparkle-text-muted">
                                                    {item.kind}
                                                </span>
                                                <span className={cn('font-mono text-sparkle-text-secondary', compact ? 'text-[9px]' : 'text-[11px]')}>
                                                    {item.method}
                                                </span>
                                            </div>
                                            <p className={cn('mt-1 text-sparkle-text-secondary', compact && 'text-[10px]')}>
                                                {item.updateCount > 1
                                                    ? `${item.summary || 'Running command...'} (x${item.updateCount} updates)`
                                                    : (item.summary || 'Running command...')}
                                            </p>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </AnimatedHeight>
                </div>
            )}

            <div className={cn(
                'w-full rounded-xl border border-transparent bg-sparkle-card/10 px-3 py-2 transition-all duration-200',
                'hover:border-[var(--accent-primary)]/20 hover:bg-sparkle-card/30 hover:shadow-[0_0_0_1px_rgba(59,130,246,0.12)]',
                'focus-within:border-[var(--accent-primary)]/20 focus-within:bg-sparkle-card/30',
                (isRegenerating && isBusy) && 'border-amber-500/45 bg-amber-500/10'
            )}>
                <div className="mb-1 flex w-full items-center gap-2">
                    <span className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-sparkle-border bg-sparkle-card text-sparkle-text-secondary">
                        <Bot size={11} />
                    </span>
                    <span className="font-mono text-[10px] uppercase tracking-wide text-sparkle-text-muted">assistant</span>
                    {isStreamingCurrentAttempt && (
                        <span className="inline-flex h-2 w-2 rounded-full bg-indigo-300 animate-pulse" />
                    )}
                    <div className="ml-auto mr-1 flex shrink-0 items-center gap-1 opacity-60 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                        <button
                            type="button"
                            onClick={() => void handleCopy()}
                            className="group/copy rounded-md p-1.5 text-sparkle-text-muted transition-colors hover:bg-[var(--accent-primary)]/12 hover:text-sparkle-text"
                            title="Copy response"
                        >
                            {copied ? (
                                <Check size={13} className="text-emerald-300" />
                            ) : (
                                <Copy size={13} className="transition-transform duration-200 group-hover/copy:scale-105" />
                            )}
                        </button>
                        <button
                            type="button"
                            onClick={() => void handleRegenerate()}
                            disabled={isBusy || !canRegenerate}
                            hidden={!canRegenerate}
                            className="group/regen rounded-md p-1.5 text-sparkle-text-muted transition-colors hover:bg-[var(--accent-primary)]/12 hover:text-sparkle-text disabled:cursor-not-allowed disabled:opacity-30"
                            title="Regenerate response"
                        >
                            <RotateCcw
                                size={13}
                                className={cn(
                                    'transition-transform duration-200 group-hover/regen:rotate-45',
                                    (isRegenerating && isBusy) && 'animate-spin'
                                )}
                            />
                        </button>
                    </div>
                </div>

                <div className={cn(
                    'max-w-[86ch] text-sparkle-text relative min-h-[1.75rem] break-words [overflow-wrap:anywhere] [word-break:break-word]',
                    compact ? 'text-[12px] leading-5' : 'text-[15px] leading-7'
                )}>
                    {(!displayedText && isBusy) ? (
                        <div className="space-y-3 py-2 animate-fadeIn">
                            {!hasThoughts ? (
                                <>
                                    <div className="h-3 w-[85%] rounded bg-sparkle-border/40 animate-shimmer" />
                                    <div className="h-3 w-[65%] rounded bg-sparkle-border/40 animate-shimmer" />
                                    <div className="h-3 w-[75%] rounded bg-sparkle-border/40 animate-shimmer" />
                                </>
                            ) : (
                                <div className="flex items-center gap-2 py-1">
                                    <div className="h-2 w-24 rounded bg-sparkle-border/40 animate-shimmer" />
                                    <span className="text-[10px] uppercase tracking-widest text-sparkle-text-muted font-mono opacity-50">Thinking...</span>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className={cn("transition-opacity duration-500", !displayedText ? "opacity-0" : "opacity-100")}>
                            <MarkdownRenderer
                                content={displayedText}
                                className="bg-transparent p-0 text-sparkle-text prose-invert break-words [overflow-wrap:anywhere] prose-p:break-words prose-p:[overflow-wrap:anywhere] prose-li:break-words prose-li:[overflow-wrap:anywhere] prose-td:break-words prose-td:[overflow-wrap:anywhere]"
                            />
                        </div>
                    )}
                </div>

                {modifiedFiles.length > 0 && (
                    <div className="mt-3 rounded-lg border border-sparkle-border bg-sparkle-bg/80 px-2.5 py-2">
                        <div className={cn('flex items-center gap-2 text-sparkle-text-secondary', compact ? 'text-[10px]' : 'text-xs')}>
                            <span className="font-mono uppercase tracking-wide text-sparkle-text-muted">Modified files</span>
                            <span className="rounded-[4px] border border-sparkle-border px-1.5 py-0.5 font-mono text-sparkle-text-muted">
                                {modifiedFiles.length}
                            </span>
                            {totalModifiedFileUpdates > modifiedFiles.length && (
                                <span className="rounded-[4px] border border-sparkle-border px-1.5 py-0.5 font-mono text-sparkle-text-muted">
                                    {totalModifiedFileUpdates} updates
                                </span>
                            )}
                        </div>

                        <div className="mt-2 space-y-1.5">
                            {visibleModifiedFiles.map((file) => {
                                const pathKey = toModifiedFileKey(file.path)
                                const stats = diffStatsByPath[pathKey] || { additions: file.additions, deletions: file.deletions }
                                const splitPath = splitModifiedFilePath(file.path)

                                return (
                                    <div
                                        key={file.path}
                                        title={file.path}
                                        className={cn(
                                            'flex items-center justify-between rounded-md border border-sparkle-border bg-sparkle-card px-2 py-1.5',
                                            compact ? 'text-[10px]' : 'text-[11px]'
                                        )}
                                    >
                                        <span className="min-w-0 truncate font-mono text-sparkle-text-secondary">
                                            {splitPath.directory && (
                                                <span className="text-sparkle-text-muted">{splitPath.directory}</span>
                                            )}
                                            <span className="font-semibold text-sparkle-text">{splitPath.filename || file.path}</span>
                                            {file.updateCount > 1 ? ` x${file.updateCount}` : ''}
                                        </span>
                                        <span className="ml-2 inline-flex shrink-0 items-center gap-2">
                                            <CompactDiffBars
                                                additions={stats.additions}
                                                deletions={stats.deletions}
                                                compact={compact}
                                            />
                                            <span className="font-mono text-emerald-300">+{stats.additions}</span>
                                            <span className="font-mono text-rose-300">-{stats.deletions}</span>
                                        </span>
                                    </div>
                                )
                            })}
                            {hiddenModifiedFilesCount > 0 && (
                                <span
                                    className={cn(
                                        'rounded-md border border-sparkle-border bg-sparkle-card px-2 py-1 font-mono text-sparkle-text-muted',
                                        compact ? 'text-[10px]' : 'text-[11px]'
                                    )}
                                >
                                    +{hiddenModifiedFilesCount} more
                                </span>
                            )}
                        </div>
                    </div>
                )}

                {compact && isMessageInfoOpen && (
                    <div className="mt-2 rounded-md border border-sparkle-border bg-sparkle-bg/85 p-2.5 text-xs text-sparkle-text-secondary">
                        <div className="mb-2 flex items-center justify-between gap-2">
                            <span className="font-mono text-[10px] uppercase tracking-wider text-sparkle-text-muted">Message Info</span>
                            <button
                                type="button"
                                onClick={() => setIsMessageInfoOpen(false)}
                                className="rounded-md border border-sparkle-border bg-sparkle-card px-2 py-0.5 text-[10px] font-medium text-sparkle-text-secondary transition-colors hover:bg-sparkle-card-hover hover:text-sparkle-text"
                            >
                                Minimize
                            </button>
                        </div>
                        <div className="mb-2 flex flex-wrap items-center gap-2">
                            <span className="rounded-[4px] border border-sparkle-border px-2 py-0.5 font-mono text-[10px]">
                                model {activeModel || 'default'}
                            </span>
                            <span className="rounded-[4px] border border-sparkle-border px-2 py-0.5 font-mono text-[10px]">
                                profile {activeProfile || 'safe-dev'}
                            </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5">
                            {stats.map((stat) => (
                                <span
                                    key={`full-${stat.id}`}
                                    className="rounded-[4px] border border-sparkle-border bg-sparkle-card px-2 py-0.5 font-mono text-[10px] tabular-nums"
                                >
                                    {stat.prefix ? `${stat.prefix} ` : ''}
                                    {stat.value}
                                    {stat.suffix ? ` ${stat.suffix}` : ''}
                                </span>
                            ))}
                        </div>
                    </div>
                )}

                <div className="mt-2 flex w-full items-center justify-between gap-2">
                    <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5 text-xs text-sparkle-text-muted">
                        {compact && (
                            <button
                                type="button"
                                onClick={() => setIsMessageInfoOpen((prev) => !prev)}
                                className={cn(
                                    'rounded-[4px] border bg-sparkle-bg/85 px-2 py-0.5 font-mono tabular-nums transition-colors',
                                    compact ? 'text-[9px]' : 'text-[10px]',
                                    isMessageInfoOpen
                                        ? 'border-[var(--accent-primary)]/45 text-[var(--accent-primary)]'
                                        : 'border-sparkle-border text-sparkle-text-secondary hover:border-[var(--accent-primary)]/30 hover:text-sparkle-text'
                                )}
                                title="Show full message info"
                            >
                                model {activeModel || 'default'}
                            </button>
                        )}
                        {(compact ? compactStats : stats).map((stat) => (
                            <span
                                key={stat.id}
                                className={cn(
                                    'rounded-[4px] border border-sparkle-border bg-sparkle-bg/85 px-2 py-0.5 font-mono text-sparkle-text-secondary tabular-nums',
                                    compact ? 'text-[9px]' : 'text-[10px]'
                                )}
                            >
                                {stat.prefix ? `${stat.prefix} ` : ''}
                                <span className="tabular-nums">{stat.value}</span>
                                {stat.suffix ? ` ${stat.suffix}` : ''}
                            </span>
                        ))}
                    </div>
                    {hasMultipleAttempts && (
                        <div className="ml-auto inline-flex shrink-0 items-center gap-1 rounded-md border border-sparkle-border bg-sparkle-bg/80 px-1 py-0.5">
                            <button
                                type="button"
                                disabled={viewIndex === 0}
                                onClick={() => {
                                    setIsAttemptPinned(true)
                                    setViewIndex((prev) => Math.max(0, prev - 1))
                                }}
                                className="rounded p-1 transition-colors hover:bg-sparkle-card disabled:opacity-30"
                            >
                                <ChevronLeft size={13} />
                            </button>
                            <span className="min-w-[46px] text-center font-mono text-[10px] text-sparkle-text-secondary">
                                {viewIndex + 1}/{attempts.length}
                            </span>
                            <button
                                type="button"
                                disabled={viewIndex === attempts.length - 1}
                                onClick={() => {
                                    setIsAttemptPinned(true)
                                    setViewIndex((prev) => Math.min(attempts.length - 1, prev + 1))
                                }}
                                className="rounded p-1 transition-colors hover:bg-sparkle-card disabled:opacity-30"
                            >
                                <ChevronRight size={13} />
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
