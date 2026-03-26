import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import { ArrowLeft, Check, CircleHelp, GitBranch, Plus, SquarePen } from 'lucide-react'
import type { AssistantPendingUserInput } from '@shared/assistant/contracts'
import { AnimatedHeight } from '@/components/ui/AnimatedHeight'
import { cn } from '@/lib/utils'
import { ComposerFooterControls, ComposerSendButton } from './AssistantComposerSections'
import { useAssistantComposerController } from './useAssistantComposerController'
import type { AssistantComposerSendOptions, ComposerContextFile } from './assistant-composer-types'
import {
    buildAssistantPendingUserInputAnswers,
    deriveAssistantPendingUserInputProgress,
    findFirstUnansweredAssistantPendingUserInputQuestionIndex,
    type AssistantPendingUserInputDraftAnswers
} from './assistant-pending-user-input'

const CUSTOM_ANSWER_LABEL = 'Write your own answer'

export const AssistantPendingUserInputPanel = memo(function AssistantPendingUserInputPanel(props: {
    pendingUserInputs: AssistantPendingUserInput[]
    responding: boolean
    onRespond: (requestId: string, answers: Record<string, string>) => Promise<void> | void
    sessionId: string | null
    assistantAvailable: boolean
    assistantConnected: boolean
    selectedProjectPath: string | null
    availableModels: Array<{ id: string; label: string; description?: string }>
    activeModel: string | undefined
    modelsLoading: boolean
    runtimeMode: 'approval-required' | 'full-access'
    interactionMode: 'default' | 'plan'
    activeProfile: 'safe-dev' | 'yolo-fast'
    activeStatusLabel: string
}) {
    const { pendingUserInputs, responding, onRespond } = props
    const activePrompt = pendingUserInputs[0] || null
    const [draftAnswersByRequestId, setDraftAnswersByRequestId] = useState<Record<string, AssistantPendingUserInputDraftAnswers>>({})
    const [questionIndex, setQuestionIndex] = useState(0)
    const [customQuestionIdByRequestId, setCustomQuestionIdByRequestId] = useState<Record<string, string | null>>({})
    const [questionShellOpen, setQuestionShellOpen] = useState(false)
    const [returnToReview, setReturnToReview] = useState(false)
    const [expandedOptionKey, setExpandedOptionKey] = useState<string | null>(null)
    const customTextareaRef = useRef<HTMLTextAreaElement | null>(null)
    const animatedStepRef = useRef<HTMLDivElement | null>(null)

    const composerController = useAssistantComposerController({
        sessionId: props.sessionId,
        onSend: async (_prompt: string, _contextFiles: ComposerContextFile[], _options: AssistantComposerSendOptions) => false,
        disabled: !props.sessionId || !props.assistantAvailable,
        allowEmptySubmit: true,
        isSending: responding,
        isThinking: false,
        thinkingLabel: props.activeStatusLabel,
        isConnected: props.assistantConnected,
        activeModel: props.activeModel,
        modelOptions: props.availableModels,
        modelsLoading: props.modelsLoading,
        modelsError: null,
        activeProfile: props.activeProfile,
        runtimeMode: props.runtimeMode,
        interactionMode: props.interactionMode,
        projectPath: props.selectedProjectPath,
        submitLabel: 'Continue'
    })

    const activeDraftAnswers = useMemo(
        () => activePrompt ? draftAnswersByRequestId[activePrompt.requestId] || {} : {},
        [activePrompt, draftAnswersByRequestId]
    )
    const progress = useMemo(
        () => deriveAssistantPendingUserInputProgress(activePrompt, activeDraftAnswers, questionIndex),
        [activeDraftAnswers, activePrompt, questionIndex]
    )

    useEffect(() => {
        const pendingRequestIds = new Set(pendingUserInputs.map((entry) => entry.requestId))
        setDraftAnswersByRequestId((current) => {
            const nextEntries = Object.entries(current).filter(([requestId]) => pendingRequestIds.has(requestId))
            return nextEntries.length === Object.keys(current).length ? current : Object.fromEntries(nextEntries)
        })
        setCustomQuestionIdByRequestId((current) => {
            const nextEntries = Object.entries(current).filter(([requestId]) => pendingRequestIds.has(requestId))
            return nextEntries.length === Object.keys(current).length ? current : Object.fromEntries(nextEntries)
        })
    }, [pendingUserInputs])

    useEffect(() => {
        if (!activePrompt) {
            setQuestionIndex(0)
            setReturnToReview(false)
            setExpandedOptionKey(null)
            return
        }
        setQuestionShellOpen(false)
        setReturnToReview(false)
        setExpandedOptionKey(null)
        setQuestionIndex(findFirstUnansweredAssistantPendingUserInputQuestionIndex(activePrompt.questions, activeDraftAnswers))
    }, [activePrompt?.requestId])

    useEffect(() => {
        setExpandedOptionKey(null)
    }, [activePrompt?.requestId, questionIndex])

    useEffect(() => {
        if (!activePrompt) return
        const frame = window.requestAnimationFrame(() => setQuestionShellOpen(true))
        return () => window.cancelAnimationFrame(frame)
    }, [activePrompt?.requestId])

    const handleSelectOption = useCallback((questionId: string, optionLabel: string) => {
        if (!activePrompt) return
        setDraftAnswersByRequestId((current) => ({
            ...current,
            [activePrompt.requestId]: {
                ...(current[activePrompt.requestId] || {}),
                [questionId]: optionLabel
            }
        }))
        setCustomQuestionIdByRequestId((current) => ({
            ...current,
            [activePrompt.requestId]: current[activePrompt.requestId] === questionId ? null : current[activePrompt.requestId] ?? null
        }))
    }, [activePrompt])

    const handleSelectCustom = useCallback((questionId: string) => {
        if (!activePrompt) return
        const activeQuestion = activePrompt.questions.find((question) => question.id === questionId) || null
        setCustomQuestionIdByRequestId((current) => ({
            ...current,
            [activePrompt.requestId]: questionId
        }))
        setDraftAnswersByRequestId((current) => {
            const currentAnswers = current[activePrompt.requestId] || {}
            const currentAnswer = String(currentAnswers[questionId] || '')
            const nextAnswer = activeQuestion?.options.some((option) => option.label === currentAnswer) ? '' : currentAnswer
            return {
                ...current,
                [activePrompt.requestId]: {
                    ...currentAnswers,
                    [questionId]: nextAnswer
                }
            }
        })
        window.requestAnimationFrame(() => {
            const textarea = customTextareaRef.current
            if (!textarea) return
            textarea.focus()
            const cursor = textarea.value.length
            textarea.setSelectionRange(cursor, cursor)
        })
    }, [activePrompt])

    const handleCustomAnswerChange = useCallback((questionId: string, value: string) => {
        if (!activePrompt) return
        setCustomQuestionIdByRequestId((current) => ({
            ...current,
            [activePrompt.requestId]: questionId
        }))
        setDraftAnswersByRequestId((current) => ({
            ...current,
            [activePrompt.requestId]: {
                ...(current[activePrompt.requestId] || {}),
                [questionId]: value
            }
        }))
    }, [activePrompt])

    const handleAdvance = useCallback(async () => {
        if (!activePrompt || !progress) return
        const resolvedAnswers = buildAssistantPendingUserInputAnswers(activePrompt.questions, activeDraftAnswers)

        if (progress.isReviewStep) {
            if (!resolvedAnswers) return
            await onRespond(activePrompt.requestId, resolvedAnswers)
            return
        }

        if (!progress.hasAnswer) return
        if (returnToReview) {
            setQuestionIndex(activePrompt.questions.length)
            setReturnToReview(false)
            return
        }
        if (progress.questionIndex < activePrompt.questions.length - 1) {
            setQuestionIndex(progress.questionIndex + 1)
            return
        }
        setQuestionIndex(activePrompt.questions.length)
    }, [activeDraftAnswers, activePrompt, onRespond, progress])

    useEffect(() => {
        const activeQuestion = progress?.activeQuestion
        if (!activePrompt || !activeQuestion || responding) return

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.metaKey || event.ctrlKey || event.altKey) return
            const target = event.target
            if (target instanceof HTMLTextAreaElement || target instanceof HTMLInputElement || target instanceof HTMLSelectElement) return

            const digit = Number.parseInt(event.key, 10)
            if (!Number.isNaN(digit) && digit >= 1 && digit <= 9) {
                const option = activeQuestion.options[digit - 1]
                if (!option) return
                event.preventDefault()
                handleSelectOption(activeQuestion.id, option.label)
                return
            }

            if ((event.key === 'Enter' || event.key === 'NumpadEnter') && progress.hasAnswer) {
                event.preventDefault()
                void handleAdvance()
            }
        }

        document.addEventListener('keydown', handleKeyDown)
        return () => document.removeEventListener('keydown', handleKeyDown)
    }, [activePrompt, handleAdvance, handleSelectOption, progress, responding])

    useLayoutEffect(() => {
        if (!progress?.activeQuestion || !activePrompt) return
        const activeCustomQuestionId = customQuestionIdByRequestId[activePrompt.requestId] || null
        const shouldFocusCustomComposer = activeCustomQuestionId === progress.activeQuestion.id || progress.isCustomAnswer
        if (!shouldFocusCustomComposer) return
        const textarea = customTextareaRef.current
        if (!textarea) return
        textarea.focus()
        const cursor = textarea.value.length
        textarea.setSelectionRange(cursor, cursor)
    }, [activePrompt, customQuestionIdByRequestId, progress?.activeQuestion, progress?.isCustomAnswer])

    if (!activePrompt || !progress) return null

    const activeQuestion = progress.activeQuestion
    const isReviewStep = progress.isReviewStep
    const activeCustomQuestionId = customQuestionIdByRequestId[activePrompt.requestId] || null
    const showCustomComposer = Boolean(
        activeQuestion
        && (activeCustomQuestionId === activeQuestion.id || progress.isCustomAnswer)
    )
    const animatedStageKey = isReviewStep
        ? `${activePrompt.requestId}:review`
        : `${activePrompt.requestId}:${activeQuestion?.id || questionIndex}`
    const customOptionKey = activeQuestion ? `${activeQuestion.id}:__custom__` : null
    const answeredAllQuestions = progress.answeredQuestionCount >= activePrompt.questions.length
    const actionLabel = responding ? 'Finish' : isReviewStep ? 'Finish' : returnToReview ? 'Back to review' : 'Continue'
    const canAdvance = isReviewStep ? answeredAllQuestions : progress.hasAnswer
    const reviewAnswers = activePrompt.questions.map((question, index) => ({
        question,
        index,
        answer: String(activeDraftAnswers[question.id] || '')
    }))

    const handleCustomTextareaKeyDown = useCallback((event: ReactKeyboardEvent<HTMLTextAreaElement>) => {
        event.stopPropagation()
        if ('nativeEvent' in event && 'stopImmediatePropagation' in event.nativeEvent) {
            event.nativeEvent.stopImmediatePropagation()
        }
        if (!activeQuestion || isReviewStep || responding) return
        if (event.ctrlKey || event.metaKey || event.altKey) return
        if (event.key !== 'Enter' && event.key !== 'NumpadEnter') return
        if (event.shiftKey) return
        if (!progress.hasAnswer) return
        event.preventDefault()
        void handleAdvance()
    }, [activeQuestion, handleAdvance, isReviewStep, progress.hasAnswer, responding])

    useEffect(() => {
        const container = animatedStepRef.current
        if (!container) return

        const animatedNodes = Array.from(container.querySelectorAll<HTMLElement>('[data-guided-animate]'))
        animatedNodes.forEach((node, index) => {
            node.animate(
                [
                    {
                        opacity: 0,
                        transform: 'translateY(14px) scale(0.982)',
                        filter: 'blur(3px)'
                    },
                    {
                        opacity: 1,
                        transform: 'translateY(0) scale(1)',
                        filter: 'blur(0px)'
                    }
                ],
                {
                    duration: 280 + index * 48,
                    easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
                    fill: 'both'
                }
            )
        })
    }, [animatedStageKey])

    return (
        <div className="mx-auto w-full max-w-3xl">
            <div ref={composerController.composerRootRef} className="pointer-events-auto relative z-10">
                <div className="group rounded-[20px] border border-white/10 bg-sparkle-card transition-[border-color,box-shadow] duration-200">
                    <div className="relative px-3 pb-2 pt-3 sm:px-4 sm:pt-4">
                        <AnimatedHeight isOpen={questionShellOpen} duration={240}>
                            <div ref={animatedStepRef} className="mb-3 overflow-hidden rounded-[18px] border border-white/5 bg-sparkle-bg/85">
                                <div data-guided-animate className="border-b border-white/5 px-4 pb-2.5 pt-3">
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0">
                                            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-sparkle-text-muted">
                                                {isReviewStep ? 'Review Decisions' : activeQuestion?.header}
                                            </p>
                                        </div>
                                        <div className="flex shrink-0 items-center gap-2 text-[11px]">
                                            <span className="rounded-full bg-white/[0.04] px-2 py-0.5 font-semibold uppercase tracking-[0.12em] text-emerald-200">
                                                Guided Input
                                            </span>
                                            <span className="rounded-full bg-white/[0.03] px-2 py-0.5 font-medium tabular-nums text-sparkle-text-secondary">
                                                {isReviewStep ? 'Review' : `${progress.questionIndex + 1}/${activePrompt.questions.length}`}
                                            </span>
                                            {pendingUserInputs.length > 1 ? (
                                                <span className="rounded-full bg-white/[0.03] px-2 py-0.5 text-sparkle-text-muted">
                                                    1/{pendingUserInputs.length}
                                                </span>
                                            ) : null}
                                        </div>
                                    </div>
                                    <p className="mt-1.5 text-[13px] leading-5 text-sparkle-text">
                                        {isReviewStep ? 'Review every choice before sending it back.' : activeQuestion?.question}
                                    </p>
                                </div>

                                {isReviewStep ? (
                                    <div className="space-y-1.5 px-3 py-2.5">
                                        {reviewAnswers.map(({ question, index, answer }) => (
                                            <button
                                                data-guided-animate
                                                key={question.id}
                                                type="button"
                                                disabled={responding}
                                                onClick={() => {
                                                    setQuestionIndex(index)
                                                    setReturnToReview(true)
                                                }}
                                                className="flex w-full items-start justify-between gap-3 rounded-2xl bg-white/[0.02] px-3 py-2 text-left transition-colors hover:bg-white/[0.04]"
                                            >
                                                <span className="min-w-0 flex-1">
                                                    <span className="flex items-center gap-2">
                                                        <span className="inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-white/[0.1] px-1.5 text-[10px] font-semibold tabular-nums text-sparkle-text">
                                                            {index + 1}
                                                        </span>
                                                        <span className="truncate text-[12px] font-medium text-sparkle-text">
                                                            {question.question}
                                                        </span>
                                                    </span>
                                                    <span className="mt-1.5 flex items-center gap-2">
                                                        <span className="shrink-0 rounded-full bg-white/[0.07] px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-sparkle-text-secondary">
                                                            {question.header}
                                                        </span>
                                                        <span className="min-w-0 truncate text-[12px] text-sparkle-text-muted">
                                                            {answer || 'No answer provided'}
                                                        </span>
                                                    </span>
                                                </span>
                                                <span className="mt-0.5 shrink-0 rounded-full bg-white/[0.07] px-2 py-0.5 text-[10px] font-medium text-sparkle-text">
                                                    Change
                                                </span>
                                            </button>
                                        ))}
                                    </div>
                                ) : activeQuestion ? (
                                    <div className="space-y-1.5 px-3 py-2.5">
                                        {activeQuestion.options.map((option, index) => {
                                            const selected = progress.selectedOptionLabel === option.label
                                            const optionKey = `${activeQuestion.id}:${option.label}`
                                            const hasDetails = Boolean(option.description && option.description !== option.label)
                                            const detailsOpen = expandedOptionKey === optionKey && hasDetails
                                            return (
                                                <div
                                                    data-guided-animate
                                                    key={optionKey}
                                                    onMouseDown={(event) => event.preventDefault()}
                                                    onClick={() => handleSelectOption(activeQuestion.id, option.label)}
                                                    onKeyDown={(event) => {
                                                        if (responding) return
                                                        if (event.key === 'Enter' || event.key === 'NumpadEnter') {
                                                            event.preventDefault()
                                                            handleSelectOption(activeQuestion.id, option.label)
                                                        }
                                                    }}
                                                    role="button"
                                                    tabIndex={responding ? -1 : 0}
                                                    aria-pressed={selected}
                                                    aria-disabled={responding}
                                                    className={cn(
                                                        'group/option w-full rounded-2xl px-3 py-2 text-left transition-colors',
                                                        selected
                                                            ? 'bg-emerald-500/[0.08] text-sparkle-text'
                                                            : 'bg-white/[0.02] text-sparkle-text-secondary hover:bg-white/[0.04] hover:text-sparkle-text',
                                                        responding && 'cursor-not-allowed opacity-60'
                                                    )}
                                                >
                                                    <div className="flex items-start gap-3">
                                                        <span className="min-w-0 flex-1">
                                                            <span className="flex items-center gap-2">
                                                                <span className={cn(
                                                                    'inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full px-1.5 text-[10px] font-semibold tabular-nums',
                                                                    selected ? 'bg-emerald-500/18 text-emerald-200' : 'bg-white/[0.08] text-sparkle-text-secondary'
                                                                )}>
                                                                    {index + 1}
                                                                </span>
                                                                <span className="text-[12px] font-medium">{option.label}</span>
                                                            </span>
                                                        </span>
                                                        <span className="flex shrink-0 items-center gap-1.5">
                                                            {hasDetails ? (
                                                                <button
                                                                    type="button"
                                                                    disabled={responding}
                                                                    onClick={(event) => {
                                                                        event.stopPropagation()
                                                                        setExpandedOptionKey((current) => current === optionKey ? null : optionKey)
                                                                    }}
                                                                    aria-label={detailsOpen ? `Hide details for ${option.label}` : `Show details for ${option.label}`}
                                                                    aria-pressed={detailsOpen}
                                                                    className={cn(
                                                                        'inline-flex h-5 w-5 items-center justify-center rounded-full transition-all disabled:opacity-50',
                                                                        detailsOpen
                                                                            ? 'bg-white/[0.12] text-sparkle-text shadow-[inset_0_0_0_1px_rgba(255,255,255,0.14)] opacity-100'
                                                                            : 'bg-white/[0.06] text-sparkle-text-secondary opacity-0 group-hover/option:opacity-100 group-focus-within/option:opacity-100 hover:bg-white/[0.12] hover:text-sparkle-text'
                                                                    )}
                                                                >
                                                                    <CircleHelp size={12} strokeWidth={2} aria-hidden="true" />
                                                                </button>
                                                            ) : null}
                                                            <span className={cn(
                                                                'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-colors',
                                                                selected ? 'border-emerald-300/35 bg-emerald-400/12' : 'border-white/12 bg-transparent'
                                                            )}>
                                                                <span className={cn(
                                                                    'h-2 w-2 rounded-full transition-colors',
                                                                    selected ? 'bg-emerald-200' : 'bg-transparent'
                                                                )} />
                                                            </span>
                                                        </span>
                                                    </div>
                                                    <AnimatedHeight isOpen={detailsOpen} duration={220}>
                                                        <div className="pl-7 pr-1 pt-1">
                                                            <p className="text-[11px] leading-4 text-sparkle-text-muted">
                                                                {option.description}
                                                            </p>
                                                        </div>
                                                    </AnimatedHeight>
                                                </div>
                                            )
                                        })}

                                        <div
                                            data-guided-animate
                                            onMouseDown={(event) => event.preventDefault()}
                                            onClick={() => handleSelectCustom(activeQuestion.id)}
                                            onKeyDown={(event) => {
                                                if (responding) return
                                                if (event.key === 'Enter' || event.key === 'NumpadEnter') {
                                                    event.preventDefault()
                                                    handleSelectCustom(activeQuestion.id)
                                                }
                                            }}
                                            role="button"
                                            tabIndex={responding || showCustomComposer ? -1 : 0}
                                            aria-pressed={showCustomComposer}
                                            aria-disabled={responding}
                                            className={cn(
                                                'group/custom w-full rounded-2xl px-3 py-2 text-left transition-colors',
                                                showCustomComposer
                                                    ? 'bg-sky-500/[0.08] text-sparkle-text'
                                                    : 'bg-white/[0.02] text-sparkle-text-secondary hover:bg-white/[0.04] hover:text-sparkle-text',
                                                responding && 'cursor-not-allowed opacity-60'
                                            )}
                                        >
                                            <div className="flex items-start gap-3">
                                                <span className="min-w-0 flex-1">
                                                    <span className="flex items-center gap-2">
                                                        <span className={cn(
                                                            'inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full px-1.5 text-[10px] font-semibold',
                                                            showCustomComposer ? 'bg-sky-500/18 text-sky-200' : 'bg-white/[0.08] text-sparkle-text-secondary'
                                                        )}>
                                                            <SquarePen size={10} />
                                                        </span>
                                                        <span className="text-[12px] font-medium">{CUSTOM_ANSWER_LABEL}</span>
                                                    </span>
                                                </span>
                                                <span className="flex shrink-0 items-center gap-1.5">
                                                    {customOptionKey ? (
                                                        <button
                                                            type="button"
                                                            disabled={responding}
                                                            onClick={(event) => {
                                                                event.stopPropagation()
                                                                setExpandedOptionKey((current) => current === customOptionKey ? null : customOptionKey)
                                                            }}
                                                            aria-label={expandedOptionKey === customOptionKey ? 'Hide details for writing your own answer' : 'Show details for writing your own answer'}
                                                            aria-pressed={expandedOptionKey === customOptionKey}
                                                            className={cn(
                                                                'inline-flex h-5 w-5 items-center justify-center rounded-full transition-all disabled:opacity-50',
                                                                expandedOptionKey === customOptionKey
                                                                    ? 'bg-white/[0.12] text-sparkle-text shadow-[inset_0_0_0_1px_rgba(255,255,255,0.14)] opacity-100'
                                                                    : 'bg-white/[0.06] text-sparkle-text-secondary opacity-0 group-hover/custom:opacity-100 group-focus-within/custom:opacity-100 hover:bg-white/[0.12] hover:text-sparkle-text'
                                                            )}
                                                        >
                                                            <CircleHelp size={12} strokeWidth={2} aria-hidden="true" />
                                                        </button>
                                                    ) : null}
                                                    <span className={cn(
                                                        'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-colors',
                                                        showCustomComposer ? 'border-sky-300/35 bg-sky-400/12' : 'border-white/12 bg-transparent'
                                                    )}>
                                                        <span className={cn(
                                                            'h-2 w-2 rounded-full transition-colors',
                                                            showCustomComposer ? 'bg-sky-200' : 'bg-transparent'
                                                        )} />
                                                    </span>
                                                </span>
                                            </div>
                                            <AnimatedHeight isOpen={expandedOptionKey === customOptionKey} duration={220}>
                                                <div className="pl-7 pr-1 pt-1">
                                                    <p className="text-[11px] leading-4 text-sparkle-text-muted">
                                                        Use the composer area below when none of the predefined answers fit.
                                                    </p>
                                                </div>
                                            </AnimatedHeight>
                                        </div>
                                    </div>
                                ) : null}
                            </div>
                        </AnimatedHeight>

                        <div data-guided-animate className="flex min-h-[56px] items-start gap-2">
                            <button
                                type="button"
                                disabled
                                className="mt-0.5 rounded-full p-1 text-sparkle-text-muted opacity-35"
                                title="Attachments disabled while answering guided input"
                            >
                                <Plus size={18} />
                            </button>
                            <div className="relative min-w-0 flex-1">
                                <textarea
                                    ref={customTextareaRef}
                                    autoFocus={showCustomComposer && !isReviewStep}
                                    rows={3}
                                    value={isReviewStep ? 'Review the decisions above, then press Finish.' : (showCustomComposer ? progress.selectedAnswer || '' : '')}
                                    onFocus={() => {
                                        if (activeQuestion && !isReviewStep) handleSelectCustom(activeQuestion.id)
                                    }}
                                    onChange={(event) => {
                                        if (!activeQuestion || isReviewStep) return
                                        handleCustomAnswerChange(activeQuestion.id, event.target.value)
                                    }}
                                    onKeyDownCapture={(event) => {
                                        event.stopPropagation()
                                        if ('nativeEvent' in event && 'stopImmediatePropagation' in event.nativeEvent) {
                                            event.nativeEvent.stopImmediatePropagation()
                                        }
                                    }}
                                    onKeyDown={handleCustomTextareaKeyDown}
                                    className={cn(
                                        'relative w-full resize-none overflow-y-auto bg-transparent pl-[3px] pr-2 text-sparkle-text outline-none placeholder:text-sparkle-text/20 selection:bg-white/15 min-h-[58px] text-[14px] leading-[1.45rem]',
                                        isReviewStep && 'text-sparkle-text-secondary'
                                    )}
                                    placeholder={isReviewStep ? '' : 'Choose an option above or write your own answer here...'}
                                    disabled={responding || isReviewStep}
                                />
                            </div>
                        </div>
                    </div>

                    <div className={cn('flex items-center justify-between px-1.5 pb-1.5 sm:px-2 sm:pb-2', composerController.isCompactFooter ? 'gap-0.5' : 'flex-wrap gap-1 sm:flex-nowrap sm:gap-0')}>
                        <ComposerFooterControls
                            isCompactFooter={composerController.isCompactFooter}
                            controlsLocked={true}
                            modelDropdownRef={composerController.modelDropdownRef}
                            showModelDropdown={composerController.showModelDropdown}
                            setShowModelDropdown={composerController.setShowModelDropdown}
                            modelsLoading={composerController.modelsLoading}
                            modelsError={composerController.modelsError}
                            modelQuery={composerController.modelQuery}
                            setModelQuery={composerController.setModelQuery}
                            setActiveModelIndex={composerController.setActiveModelIndex}
                            modelCanScrollUp={composerController.modelCanScrollUp}
                            modelCanScrollDown={composerController.modelCanScrollDown}
                            setModelCanScrollUp={composerController.setModelCanScrollUp}
                            setModelCanScrollDown={composerController.setModelCanScrollDown}
                            modelListRef={composerController.modelListRef}
                            filteredModelOptions={composerController.filteredModelOptions}
                            activeModelIndex={composerController.activeModelIndex}
                            selectedModel={composerController.selectedModel}
                            selectedModelLabel={composerController.selectedModelLabel}
                            latestModelId={composerController.latestModelId}
                            setSelectedModel={composerController.setSelectedModel}
                            onRefreshModels={composerController.onRefreshModels}
                            traitsDropdownRef={composerController.traitsDropdownRef}
                            showTraitsDropdown={composerController.showTraitsDropdown}
                            setShowTraitsDropdown={composerController.setShowTraitsDropdown}
                            EFFORT_OPTIONS={composerController.EFFORT_OPTIONS}
                            selectedEffort={composerController.selectedEffort}
                            setSelectedEffort={composerController.setSelectedEffort}
                            EFFORT_LABELS={composerController.EFFORT_LABELS}
                            fastModeEnabled={composerController.fastModeEnabled}
                            setFastModeEnabled={composerController.setFastModeEnabled}
                            selectedInteractionMode={composerController.selectedInteractionMode}
                            setSelectedInteractionMode={composerController.setSelectedInteractionMode}
                            selectedRuntimeMode={composerController.selectedRuntimeMode}
                            setSelectedRuntimeMode={composerController.setSelectedRuntimeMode}
                            displayedProfile={composerController.displayedProfile}
                            setShowFullAccessConfirm={composerController.setShowFullAccessConfirm}
                        />

                        <div className="flex shrink-0 items-center gap-2">
                                {(progress.questionIndex > 0 || isReviewStep) ? (
                                    <button
                                        type="button"
                                        disabled={responding}
                                        onClick={() => {
                                            if (returnToReview) {
                                                setQuestionIndex(activePrompt.questions.length)
                                                setReturnToReview(false)
                                                return
                                            }
                                            setQuestionIndex((current) => Math.max(0, current - 1))
                                        }}
                                        className="inline-flex min-w-[104px] items-center justify-center gap-1 rounded-full bg-white/[0.04] px-3.5 py-2 text-[12px] font-medium text-sparkle-text-secondary transition-colors hover:bg-white/[0.06] hover:text-sparkle-text disabled:opacity-50"
                                    >
                                        <ArrowLeft size={12} />
                                        {returnToReview ? 'Review' : 'Back'}
                                    </button>
                                ) : null}
                            <ComposerSendButton
                                disabled={composerController.disabled || responding}
                                isConnected={composerController.isConnected}
                                isThinking={false}
                                canSend={canAdvance}
                                label={actionLabel}
                                onSend={() => void handleAdvance()}
                            />
                        </div>
                    </div>
                </div>
            </div>

            <div className="pointer-events-auto flex items-center justify-between px-1 pt-2 text-[11px] font-medium text-sparkle-text-secondary">
                <div className="flex items-center gap-2">
                    <span>Local</span>
                    <span className="inline-flex items-center gap-1 text-[10px] text-sparkle-text-muted">
                        <span className="h-1.5 w-1.5 rounded-full bg-amber-300/70" />
                        <span>Input required</span>
                    </span>
                </div>

                <button
                    type="button"
                    disabled
                    className="inline-flex max-w-[220px] items-center gap-1.5 px-1 py-0.5 text-sparkle-text-secondary opacity-45"
                    title={composerController.isGitRepo ? (composerController.currentBranch || 'Current branch') : 'No git repository detected'}
                >
                    {composerController.isGitRepo ? <GitBranch size={12} /> : null}
                    <span className="truncate">{composerController.branchButtonLabel}</span>
                </button>
            </div>
        </div>
    )
})
