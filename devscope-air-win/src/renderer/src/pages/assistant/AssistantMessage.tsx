import { useEffect, useRef, useState } from 'react'
import {
    Bot,
    Brain,
    Check,
    ChevronDown,
    ChevronLeft,
    ChevronRight,
    Copy,
    FileText,
    RotateCcw,
    Search,
    Shield,
    Terminal,
    Wrench
} from 'lucide-react'
import { cn } from '@/lib/utils'
import MarkdownRenderer from '@/components/ui/MarkdownRenderer'

export type AssistantReasoning = {
    turnId: string
    attemptGroupId: string
    text: string
    method: string
    timestamp: number
}

export type AssistantActivity = {
    turnId: string
    attemptGroupId: string
    kind: string
    summary: string
    method: string
    payload: Record<string, unknown>
    timestamp: number
}

export type AssistantApproval = {
    requestId: number
    method: string
    mode: 'safe' | 'yolo'
    decision?: 'decline' | 'acceptForSession'
    request?: Record<string, unknown>
    timestamp: number
    turnId?: string
    attemptGroupId?: string
}

type AssistantMessageAttempt = {
    id: string
    text: string
    reasoningText?: string
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

function concatReasoningChunk(base: string, chunk: string): string {
    if (!chunk) return base
    if (!base) return chunk
    if (/^\s*#{1,6}\s/.test(chunk) || /^\s*[-*]\s+/.test(chunk) || /^\s*\d+\.\s+/.test(chunk)) {
        return `${base}\n${chunk}`
    }

    const endsWithWord = /[A-Za-z0-9]$/.test(base)
    const startsWithWord = /^[A-Za-z0-9]/.test(chunk)
    if (!endsWithWord || !startsWithWord) {
        return `${base}${chunk}`
    }

    const nextToken = chunk.match(/^[A-Za-z]+/)?.[0] || ''
    const joinSuffixes = new Set([
        's', 'es', 'ed', 'ing', 'ly', 'er', 'ers',
        'tion', 'tions', 'ment', 'ments', 'ness',
        'able', 'ible', 'al', 'ous'
    ])
    if (joinSuffixes.has(nextToken.toLowerCase())) {
        return `${base}${chunk}`
    }

    return `${base} ${chunk}`
}

function shouldConcatReasoningChunk(prevText: string, nextText: string, gapMs: number): boolean {
    if (!nextText) return false
    if (gapMs > 2500) return false

    const trimmedPrev = prevText.trimEnd()
    const trimmedNext = nextText.trimStart()
    if (!trimmedPrev) return true
    if (!trimmedNext) return false

    const prevEndedSentence = /[.!?]["')\]]?\s*$/.test(trimmedPrev)
    const nextLooksNewSentence = /^[A-Z][a-z]/.test(trimmedNext)
    if (prevEndedSentence && nextLooksNewSentence) return false

    if (/^\s*[#>*-]/.test(nextText)) return false
    if (/^\s*\d+\./.test(nextText)) return false
    return true
}

function normalizeReasoningDisplayText(text: string): string {
    if (!text) return ''
    return String(text)
        .replace(/\u0000/g, '')
        .replace(/\r/g, '')
        .replace(/([a-z])([A-Z])/g, '$1 $2')
        .replace(/([.!?])([A-Za-z])/g, '$1 $2')
        .replace(/\s+([,.;:!?])/g, '$1')
        .trim()
}

function ActivityIcon({ kind }: { kind: string }) {
    switch (kind) {
        case 'command':
            return <Terminal size={14} className="text-sky-300" />
        case 'file':
            return <FileText size={14} className="text-amber-300" />
        case 'search':
            return <Search size={14} className="text-violet-300" />
        default:
            return <Wrench size={14} className="text-sparkle-text-muted" />
    }
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
        : [...turnReasoning]
            .sort((a, b) => a.timestamp - b.timestamp)
            .reduce<AssistantReasoning[]>((acc, entry) => {
                const rawText = String(entry.text || '')
                if (!rawText) return acc

                const normalizedEntry: AssistantReasoning = {
                    ...entry,
                    text: rawText
                }
                const last = acc[acc.length - 1]
                const canMerge = Boolean(last)
                    && last.method === normalizedEntry.method
                    && shouldConcatReasoningChunk(
                        last.text,
                        normalizedEntry.text,
                        Math.max(0, normalizedEntry.timestamp - last.timestamp)
                    )
                if (last && canMerge) {
                    last.text = concatReasoningChunk(last.text, normalizedEntry.text)
                    last.timestamp = normalizedEntry.timestamp
                    return acc
                }
                acc.push(normalizedEntry)
                return acc
            }, [])

    const allThoughts = [...normalizedReasoning, ...turnActivities, ...turnApprovals].sort(
        (a, b) => a.timestamp - b.timestamp
    )
    const firstThoughtAt = allThoughts.length > 0 ? allThoughts[0].timestamp : null
    const lastThoughtAt = allThoughts.length > 0 ? allThoughts[allThoughts.length - 1].timestamp : null
    const thoughtElapsedMs = (firstThoughtAt !== null && lastThoughtAt !== null)
        ? Math.max(0, lastThoughtAt - firstThoughtAt)
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
    const thoughtElapsedLabel = thoughtElapsedMs > 0
        ? `${(thoughtElapsedMs / 1000).toFixed(thoughtElapsedMs < 10_000 ? 1 : 0)}s`
        : isBusy && hasThoughts
            ? 'live'
            : '0.0s'
    const statsLineParts = [
        `${outputTokens} tok`,
        `${outputChars} chars`,
        `${thoughtSummaryCount} thoughts`,
        `${activityCount} actions`,
        `${approvalCount} approvals`,
        `elapsed ${thoughtElapsedLabel}`
    ] as string[]

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
    }, [isThoughtsOpen, allThoughts.length, thoughtElapsedMs, isBusy])

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
                                                content={item.method === 'persisted' ? item.text : normalizeReasoningDisplayText(item.text)}
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
                        {statsLineParts.map((part) => (
                            <span
                                key={part}
                                className="rounded-[4px] border border-sparkle-border bg-sparkle-bg/85 px-2 py-0.5 font-mono text-[10px] text-sparkle-text-secondary animate-fadeIn"
                            >
                                {part}
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
