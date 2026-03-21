import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, Check, Loader2 } from 'lucide-react'
import type { AssistantPendingUserInput } from '@shared/assistant/contracts'
import { cn } from '@/lib/utils'
import {
    buildAssistantPendingUserInputAnswers,
    deriveAssistantPendingUserInputProgress,
    findFirstUnansweredAssistantPendingUserInputQuestionIndex,
    type AssistantPendingUserInputDraftAnswers
} from './assistant-pending-user-input'

export const AssistantPendingUserInputPanel = memo(function AssistantPendingUserInputPanel(props: {
    pendingUserInputs: AssistantPendingUserInput[]
    responding: boolean
    onRespond: (requestId: string, answers: Record<string, string>) => Promise<void> | void
}) {
    const { pendingUserInputs, responding, onRespond } = props
    const activePrompt = pendingUserInputs[0] || null
    const [draftAnswersByRequestId, setDraftAnswersByRequestId] = useState<Record<string, AssistantPendingUserInputDraftAnswers>>({})
    const [questionIndex, setQuestionIndex] = useState(0)
    const autoAdvanceTimerRef = useRef<number | null>(null)

    const activeDraftAnswers = useMemo(
        () => activePrompt ? draftAnswersByRequestId[activePrompt.requestId] || {} : {},
        [activePrompt, draftAnswersByRequestId]
    )
    const progress = useMemo(
        () => deriveAssistantPendingUserInputProgress(activePrompt, activeDraftAnswers, questionIndex),
        [activeDraftAnswers, activePrompt, questionIndex]
    )

    useEffect(() => {
        return () => {
            if (autoAdvanceTimerRef.current !== null) window.clearTimeout(autoAdvanceTimerRef.current)
        }
    }, [])

    useEffect(() => {
        const pendingRequestIds = new Set(pendingUserInputs.map((entry) => entry.requestId))
        setDraftAnswersByRequestId((current) => {
            const nextEntries = Object.entries(current).filter(([requestId]) => pendingRequestIds.has(requestId))
            return nextEntries.length === Object.keys(current).length ? current : Object.fromEntries(nextEntries)
        })
    }, [pendingUserInputs])

    useEffect(() => {
        if (!activePrompt) {
            setQuestionIndex(0)
            return
        }
        const nextQuestionIndex = findFirstUnansweredAssistantPendingUserInputQuestionIndex(activePrompt.questions, activeDraftAnswers)
        setQuestionIndex(nextQuestionIndex)
    }, [activeDraftAnswers, activePrompt?.requestId])

    const handleSelectOption = useCallback((questionId: string, optionLabel: string) => {
        if (!activePrompt) return
        setDraftAnswersByRequestId((current) => ({
            ...current,
            [activePrompt.requestId]: {
                ...(current[activePrompt.requestId] || {}),
                [questionId]: optionLabel
            }
        }))
    }, [activePrompt])

    const handleAdvance = useCallback(async () => {
        if (!activePrompt || !progress) return
        const resolvedAnswers = buildAssistantPendingUserInputAnswers(activePrompt.questions, activeDraftAnswers)
        if (!resolvedAnswers) return

        if (!progress.isLastQuestion) {
            setQuestionIndex(Math.min(progress.questionIndex + 1, activePrompt.questions.length - 1))
            return
        }

        await onRespond(activePrompt.requestId, resolvedAnswers)
    }, [activeDraftAnswers, activePrompt, onRespond, progress])

    const handleSelectOptionAndAdvance = useCallback((questionId: string, optionLabel: string) => {
        handleSelectOption(questionId, optionLabel)
        if (autoAdvanceTimerRef.current !== null) window.clearTimeout(autoAdvanceTimerRef.current)
        autoAdvanceTimerRef.current = window.setTimeout(() => {
            autoAdvanceTimerRef.current = null
            void handleAdvance()
        }, 180)
    }, [handleAdvance, handleSelectOption])

    useEffect(() => {
        const activeQuestion = progress?.activeQuestion
        if (!activePrompt || !activeQuestion || responding) return

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.metaKey || event.ctrlKey || event.altKey) return
            const target = event.target
            if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) return
            const digit = Number.parseInt(event.key, 10)
            if (Number.isNaN(digit) || digit < 1 || digit > 9) return
            const option = activeQuestion.options[digit - 1]
            if (!option) return
            event.preventDefault()
            handleSelectOptionAndAdvance(activeQuestion.id, option.label)
        }

        document.addEventListener('keydown', handleKeyDown)
        return () => document.removeEventListener('keydown', handleKeyDown)
    }, [activePrompt, handleSelectOptionAndAdvance, progress?.activeQuestion, responding])

    if (!activePrompt || !progress?.activeQuestion) return null

    const activeQuestion = progress.activeQuestion

    return (
        <div className="mx-auto mb-3 w-full max-w-3xl">
            <div className="overflow-hidden rounded-[20px] border border-white/10 bg-sparkle-card shadow-[0_14px_32px_rgba(0,0,0,0.18)]">
                <div className="border-b border-white/5 bg-white/[0.03] px-4 py-3">
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-md border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-indigo-200">
                            Input Needed
                        </span>
                        {activePrompt.questions.length > 1 ? (
                            <span className="rounded-md border border-white/10 bg-white/[0.03] px-2 py-0.5 text-[11px] font-medium tabular-nums text-sparkle-text-secondary">
                                {progress.questionIndex + 1}/{activePrompt.questions.length}
                            </span>
                        ) : null}
                        {pendingUserInputs.length > 1 ? (
                            <span className="text-[11px] text-sparkle-text-muted">
                                request 1/{pendingUserInputs.length}
                            </span>
                        ) : null}
                    </div>
                    <p className="mt-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-sparkle-text-muted">
                        {activeQuestion.header}
                    </p>
                    <p className="mt-1 text-sm text-sparkle-text">
                        {activeQuestion.question}
                    </p>
                </div>

                <div className="space-y-2 px-4 py-3">
                    {activeQuestion.options.map((option, index) => {
                        const selected = progress.selectedOptionLabel === option.label
                        return (
                            <button
                                key={`${activeQuestion.id}:${option.label}`}
                                type="button"
                                disabled={responding}
                                onClick={() => handleSelectOptionAndAdvance(activeQuestion.id, option.label)}
                                className={cn(
                                    'group flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors',
                                    selected
                                        ? 'border-blue-400/30 bg-blue-500/[0.10] text-sparkle-text'
                                        : 'border-white/10 bg-white/[0.02] text-sparkle-text-secondary hover:border-white/20 hover:bg-white/[0.04] hover:text-sparkle-text',
                                    responding && 'cursor-not-allowed opacity-60'
                                )}
                            >
                                <span className={cn(
                                    'flex size-5 shrink-0 items-center justify-center rounded-md text-[11px] font-semibold tabular-nums',
                                    selected ? 'bg-blue-500/20 text-blue-200' : 'bg-white/[0.05] text-sparkle-text-muted'
                                )}>
                                    {index + 1}
                                </span>
                                <span className="min-w-0 flex-1">
                                    <span className="text-sm font-medium">{option.label}</span>
                                    {option.description && option.description !== option.label ? (
                                        <span className="ml-2 text-xs text-sparkle-text-muted">
                                            {option.description}
                                        </span>
                                    ) : null}
                                </span>
                                {selected ? <Check size={14} className="shrink-0 text-blue-200" /> : null}
                            </button>
                        )
                    })}
                </div>

                <div className="flex items-center justify-between gap-3 border-t border-white/5 px-4 py-3">
                    <div className="text-[11px] text-sparkle-text-muted">
                        {progress.answeredQuestionCount}/{activePrompt.questions.length} answered
                    </div>
                    <div className="flex items-center gap-2">
                        {progress.questionIndex > 0 ? (
                            <button
                                type="button"
                                disabled={responding}
                                onClick={() => setQuestionIndex((current) => Math.max(0, current - 1))}
                                className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1.5 text-[12px] text-sparkle-text-secondary transition-colors hover:border-white/20 hover:bg-white/[0.05] hover:text-sparkle-text disabled:opacity-50"
                            >
                                <ArrowLeft size={12} />
                                Back
                            </button>
                        ) : null}
                        <button
                            type="button"
                            disabled={responding || !progress.selectedOptionLabel}
                            onClick={() => void handleAdvance()}
                            className={cn(
                                'inline-flex min-w-[102px] items-center justify-center gap-2 rounded-lg border px-3 py-1.5 text-[12px] font-medium transition-colors',
                                responding || !progress.selectedOptionLabel
                                    ? 'cursor-not-allowed border-white/10 bg-white/[0.03] text-sparkle-text-muted opacity-60'
                                    : 'border-blue-400/25 bg-blue-500/[0.10] text-blue-100 hover:border-blue-300/35 hover:bg-blue-500/[0.16]'
                            )}
                        >
                            {responding ? <Loader2 size={13} className="animate-spin" /> : null}
                            <span>{responding ? 'Submitting...' : progress.isLastQuestion ? 'Submit Answer' : 'Continue'}</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
})
