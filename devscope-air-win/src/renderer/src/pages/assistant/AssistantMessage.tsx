import { useEffect, useRef, useState } from 'react'
import {
    Bot,
    Brain,
    Check,
    ChevronDown,
    ChevronLeft,
    ChevronRight,
    Copy,
    RotateCcw,
    Shield,
    type LucideIcon
} from 'lucide-react'
import { cn } from '@/lib/utils'
import MarkdownRenderer from '@/components/ui/MarkdownRenderer'
import type { AssistantActivity, AssistantApproval, AssistantReasoning } from './assistant-page-types'
import {
    ActivityIcon,
    formatStatTimestamp,
    mergeReasoningEntries,
    normalizeReasoningMarkdown
} from './assistant-message-utils'

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
    streamingTurnId?: string | null
    streamingText?: string
    reasoning?: AssistantReasoning[]
    activities?: AssistantActivity[]
    approvals?: AssistantApproval[]
}

export function AssistantMessage({
    attempts,
    onRegenerate,
    isBusy,
    streamingTurnId = null,
    streamingText = '',
    reasoning = [],
    activities = [],
    approvals = []
}: AssistantMessageProps) {
    const activeIndex = attempts.findIndex((attempt) => attempt.isActiveAttempt)
    const initialIndex = activeIndex >= 0 ? activeIndex : Math.max(0, attempts.length - 1)

    const [viewIndex, setViewIndex] = useState(initialIndex)
    const [copied, setCopied] = useState(false)
    const [isThoughtsOpen, setIsThoughtsOpen] = useState(false)
    const [isRegenerating, setIsRegenerating] = useState(false)
    const [isAttemptPinned, setIsAttemptPinned] = useState(false)
    const [elapsedNowMs, setElapsedNowMs] = useState(() => Date.now())
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
    const isStreamingCurrentAttempt = Boolean(streamingText)
        && Boolean(currentAttempt.turnId)
        && currentAttempt.turnId === streamingTurnId
    const displayedText = isStreamingCurrentAttempt ? streamingText : currentAttempt.text

    const turnReasoning = reasoning.filter((entry) => {
        const sameTurn = Boolean(currentAttempt.turnId) && entry.turnId === currentAttempt.turnId
        const sameGroup = Boolean(currentAttempt.attemptGroupId) && entry.attemptGroupId === currentAttempt.attemptGroupId
        return sameTurn || sameGroup
    })
    const turnActivities = activities.filter((entry) => {
        const sameTurn = Boolean(currentAttempt.turnId) && entry.turnId === currentAttempt.turnId
        const sameGroup = Boolean(currentAttempt.attemptGroupId) && entry.attemptGroupId === currentAttempt.attemptGroupId
        return sameTurn || sameGroup
    })
    const turnApprovals = approvals.filter((entry) => {
        const sameTurn = Boolean(currentAttempt.turnId && entry.turnId) && entry.turnId === currentAttempt.turnId
        const sameGroup = Boolean(currentAttempt.attemptGroupId && entry.attemptGroupId) && entry.attemptGroupId === currentAttempt.attemptGroupId
        return sameTurn || sameGroup
    })

    const persistedReasoningText = String(currentAttempt.reasoningText || '').trim()
    const persistedReasoning: AssistantReasoning[] = persistedReasoningText
        ? [{
            turnId: currentAttempt.turnId || 'persisted',
            attemptGroupId: currentAttempt.attemptGroupId || currentAttempt.turnId || 'persisted',
            text: persistedReasoningText,
            method: 'persisted',
            timestamp: 0
        }]
        : []

    const normalizedReasoning = persistedReasoning.length > 0
        ? persistedReasoning
        : mergeReasoningEntries(turnReasoning)

    const allThoughts = [...normalizedReasoning, ...turnActivities, ...turnApprovals].sort(
        (a, b) => a.timestamp - b.timestamp
    )
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
    const thoughtSummaryCount = normalizedReasoning.length
    const activityCount = turnActivities.length
    const approvalCount = turnApprovals.length
    const canRegenerate = Boolean(currentAttempt.turnId)
    const timestampLabel = formatStatTimestamp(currentAttempt.createdAt)
    const thoughtElapsedLabel = thoughtElapsedMs > 0
        ? `${(thoughtElapsedMs / 1000).toFixed(thoughtElapsedMs < 10_000 ? 1 : 0)}s`
        : isLiveAttempt
            ? 'live'
            : '0.0s'
    const stats = [
        { id: 'tok', prefix: '', value: String(outputTokens), suffix: 'tok' },
        { id: 'chars', prefix: '', value: String(outputChars), suffix: 'chars' },
        { id: 'thoughts', prefix: '', value: String(thoughtSummaryCount), suffix: 'thoughts' },
        { id: 'actions', prefix: '', value: String(activityCount), suffix: 'actions' },
        { id: 'approvals', prefix: '', value: String(approvalCount), suffix: 'approvals' },
        { id: 'time', prefix: 'at', value: timestampLabel, suffix: '' },
        { id: 'elapsed', prefix: 'elapsed', value: thoughtElapsedLabel, suffix: '' }
    ] as const

    useEffect(() => {
        if (!isLiveAttempt) return
        const timer = window.setInterval(() => {
            setElapsedNowMs(Date.now())
        }, 200)
        return () => window.clearInterval(timer)
    }, [isLiveAttempt])

    useEffect(() => {
        if (isBusy && hasThoughts) {
            setIsThoughtsOpen(true)
        }
    }, [isBusy, hasThoughts])

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
                        className="flex w-full items-center justify-between px-3 py-2 text-xs text-sparkle-text-secondary transition-colors hover:bg-sparkle-card-hover"
                    >
                        <div className="flex items-center gap-2.5">
                            <Brain size={13} className="text-indigo-300" />
                            <span className="font-mono text-[10px] uppercase tracking-wide text-sparkle-text-muted">Thought Process</span>
                            {isBusy && (
                                <span className="inline-flex h-2 w-2 rounded-full bg-indigo-300 animate-pulse" />
                            )}
                            <span className="rounded-[4px] border border-sparkle-border px-2 py-0.5 font-mono text-[10px] text-sparkle-text-muted">
                                {allThoughts.length}
                            </span>
                            <span className="rounded-[4px] border border-sparkle-border px-2 py-0.5 font-mono text-[10px] text-sparkle-text-muted">
                                Thought for {thoughtElapsedLabel}
                            </span>
                        </div>
                        <ChevronDown
                            size={13}
                            className={cn('transition-transform', isThoughtsOpen ? 'rotate-180' : '')}
                        />
                    </button>

                    {isThoughtsOpen && (
                        <div
                            ref={thoughtsBodyRef}
                            className="max-h-[42vh] space-y-2 overflow-y-auto border-t border-sparkle-border p-3 animate-fadeIn"
                        >
                            {allThoughts.map((item, index) => {
                                const animationStyle = {
                                    animationDelay: `${Math.min(index, 10) * 45}ms`,
                                    animationFillMode: 'both' as const
                                }
                                if ('text' in item) {
                                    return (
                                        <div
                                            key={`reason-${index}`}
                                            className="rounded-md border border-sparkle-border bg-sparkle-bg px-3 py-2 text-sm text-sparkle-text-secondary animate-fadeIn"
                                            style={animationStyle}
                                        >
                                            <MarkdownRenderer
                                                content={normalizeReasoningMarkdown(item.text)}
                                                className="bg-transparent p-0 text-sparkle-text-secondary prose-invert max-w-none break-words prose-p:my-1 prose-p:break-words prose-p:whitespace-pre-wrap prose-li:break-words prose-li:whitespace-pre-wrap prose-pre:my-1 prose-pre:whitespace-pre-wrap prose-code:text-xs"
                                            />
                                        </div>
                                    )
                                }

                                if ('kind' in item) {
                                    return (
                                        <div
                                            key={`activity-${index}`}
                                            className="flex items-start gap-2 rounded-md border border-sparkle-border bg-sparkle-bg px-3 py-2 text-xs animate-fadeIn"
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
                                                    <span className="font-mono text-[11px] text-sparkle-text-secondary">
                                                        {item.method}
                                                    </span>
                                                </div>
                                                <p className="mt-1 text-sparkle-text-secondary">{item.summary}</p>
                                            </div>
                                        </div>
                                    )
                                }

                                const isDeclined = item.decision === 'decline'
                                const isApproved = item.decision === 'acceptForSession'

                                return (
                                    <div
                                        key={`approval-${index}`}
                                        className={cn(
                                            'flex items-start gap-2 rounded-md border px-3 py-2 text-xs animate-fadeIn',
                                            isDeclined
                                                ? 'border-amber-500/30 bg-amber-500/10 text-amber-200'
                                                : isApproved
                                                    ? 'border-[var(--accent-primary)]/30 bg-[var(--accent-primary)]/10 text-[var(--accent-primary)]'
                                                    : 'border-sparkle-border bg-sparkle-bg text-sparkle-text-secondary'
                                        )}
                                        style={animationStyle}
                                    >
                                        <Shield size={14} className="mt-0.5" />
                                        <div>
                                            <p className="font-medium">
                                                {isDeclined ? 'Blocked' : isApproved ? 'Approved' : 'Pending'} - {item.method}
                                            </p>
                                            <p className="mt-1 opacity-85">
                                                {isDeclined
                                                    ? 'Action was blocked by current approval policy.'
                                                    : isApproved
                                                        ? 'Action was approved for this session.'
                                                        : 'Waiting for approval decision.'}
                                            </p>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )}
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

                <div className="max-w-[86ch] text-[15px] leading-7 text-sparkle-text">
                    <MarkdownRenderer
                        content={displayedText}
                        className="bg-transparent p-0 text-sparkle-text prose-invert"
                    />
                </div>

                <div className="mt-2 flex w-full items-center justify-between gap-2">
                    <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5 text-xs text-sparkle-text-muted">
                        {stats.map((stat) => (
                            <span
                                key={stat.id}
                                className="rounded-[4px] border border-sparkle-border bg-sparkle-bg/85 px-2 py-0.5 font-mono text-[10px] text-sparkle-text-secondary tabular-nums"
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
