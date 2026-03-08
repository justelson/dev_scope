import { useEffect, useState } from 'react'
import { Check, ChevronLeft, ChevronRight, Copy, RotateCcw } from 'lucide-react'
import { cn } from '@/lib/utils'
import MarkdownRenderer from '@/components/ui/MarkdownRenderer'
import { formatStatTimestamp } from './assistant-message-utils'

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
    streamingTurnId?: string | null
    streamingText?: string
}

export function AssistantMessage({
    attempts,
    onRegenerate,
    isBusy,
    compact = false,
    streamingTurnId = null,
    streamingText = ''
}: AssistantMessageProps) {
    const activeIndex = attempts.findIndex((attempt) => attempt.isActiveAttempt)
    const initialIndex = activeIndex >= 0 ? activeIndex : Math.max(0, attempts.length - 1)

    const [viewIndex, setViewIndex] = useState(initialIndex)
    const [copied, setCopied] = useState(false)
    const [isRegenerating, setIsRegenerating] = useState(false)
    const [isAttemptPinned, setIsAttemptPinned] = useState(false)

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
    const hasDisplayedContent = displayedText.length > 0
    const hasMultipleAttempts = attempts.length > 1
    const canRegenerate = Boolean(currentAttempt.turnId)
    const timestampLabel = formatStatTimestamp(currentAttempt.createdAt)

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

    return (
        <div className="assistant-t3-message group w-full animate-fadeIn">
            <div className={cn('assistant-t3-response relative w-full transition-colors', compact ? 'px-1 py-1.5' : 'px-2 py-2')}>
                <div className={cn('min-h-[1.75rem] break-words [overflow-wrap:anywhere] [word-break:break-word]', compact ? 'text-[12px] leading-5' : 'text-[15px] leading-7')}>
                    {hasDisplayedContent ? (
                        <MarkdownRenderer
                            content={displayedText}
                            codeBlockMaxLines={20}
                            className={cn(
                                'bg-transparent p-0 text-sparkle-text prose-sm prose-invert break-words [overflow-wrap:anywhere] prose-p:break-words prose-p:[overflow-wrap:anywhere] prose-li:break-words prose-li:[overflow-wrap:anywhere] prose-td:break-words prose-td:[overflow-wrap:anywhere]',
                                isStreamingCurrentAttempt && 'transition-opacity duration-150'
                            )}
                        />
                    ) : (
                        <p className={cn('font-mono uppercase tracking-[0.16em] text-sparkle-text-muted', compact ? 'text-[10px]' : 'text-[11px]')}>
                            Waiting...
                        </p>
                    )}
                </div>

                <div className="mt-3 flex w-full items-center justify-between gap-2">
                    <div className="flex min-w-0 flex-1 items-center gap-1.5">
                        <span className={cn('font-mono text-sparkle-text-muted tabular-nums', compact ? 'text-[9px]' : 'text-[10px]')}>
                            at {timestampLabel}
                        </span>
                    </div>

                    <div className="ml-auto inline-flex shrink-0 items-center gap-1">
                        <button
                            type="button"
                            onClick={() => void handleCopy()}
                            className="rounded-md p-1.5 text-sparkle-text-muted transition-colors hover:bg-white/[0.03] hover:text-sparkle-text"
                            title="Copy response"
                        >
                            {copied ? <Check size={13} className="text-emerald-300" /> : <Copy size={13} />}
                        </button>
                        <button
                            type="button"
                            onClick={() => void handleRegenerate()}
                            disabled={isBusy || !canRegenerate}
                            hidden={!canRegenerate}
                            className="rounded-md p-1.5 text-sparkle-text-muted transition-colors hover:bg-white/[0.03] hover:text-sparkle-text disabled:cursor-not-allowed disabled:opacity-30"
                            title="Regenerate response"
                        >
                            <RotateCcw size={13} className={cn((isRegenerating && isBusy) && 'animate-spin')} />
                        </button>

                        {hasMultipleAttempts && (
                            <div className="ml-1 inline-flex items-center gap-1 rounded-md border border-white/10 bg-white/[0.03] px-1 py-0.5">
                                <button
                                    type="button"
                                    disabled={viewIndex === 0}
                                    onClick={() => {
                                        setIsAttemptPinned(true)
                                        setViewIndex((prev) => Math.max(0, prev - 1))
                                    }}
                                    className="rounded p-1 transition-colors hover:bg-white/[0.03] disabled:opacity-30"
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
                                    className="rounded p-1 transition-colors hover:bg-white/[0.03] disabled:opacity-30"
                                >
                                    <ChevronRight size={13} />
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
            <div className="mx-auto mt-6 h-px w-full bg-gradient-to-r from-transparent via-white/10 to-transparent" />
        </div>
    )
}
