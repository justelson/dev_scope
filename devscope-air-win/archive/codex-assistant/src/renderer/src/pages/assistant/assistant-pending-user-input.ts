import type { AssistantPendingUserInput, AssistantUserInputQuestion } from './assistant-page-types'

export type PendingUserInputDraftAnswer = {
    selectedOptionLabel?: string
    customAnswer?: string
}

export type PendingUserInputProgress = {
    questionIndex: number
    activeQuestion: AssistantUserInputQuestion | null
    activeDraft: PendingUserInputDraftAnswer | undefined
    selectedOptionLabel: string | undefined
    customAnswer: string
    resolvedAnswer: string | null
    usingCustomAnswer: boolean
    answeredQuestionCount: number
    isLastQuestion: boolean
    isComplete: boolean
    canAdvance: boolean
}

function normalizeDraftAnswer(value: string | undefined): string | null {
    if (typeof value !== 'string') return null
    const trimmed = value.trim()
    return trimmed.length > 0 ? trimmed : null
}

export function resolvePendingUserInputAnswer(
    draft: PendingUserInputDraftAnswer | undefined
): string | null {
    const customAnswer = normalizeDraftAnswer(draft?.customAnswer)
    if (customAnswer) return customAnswer
    return normalizeDraftAnswer(draft?.selectedOptionLabel)
}

export function setPendingUserInputCustomAnswer(
    draft: PendingUserInputDraftAnswer | undefined,
    customAnswer: string
): PendingUserInputDraftAnswer {
    const selectedOptionLabel = customAnswer.trim().length > 0 ? undefined : draft?.selectedOptionLabel
    return {
        customAnswer,
        ...(selectedOptionLabel ? { selectedOptionLabel } : {})
    }
}

export function buildPendingUserInputAnswers(
    questions: ReadonlyArray<AssistantUserInputQuestion>,
    draftAnswers: Record<string, PendingUserInputDraftAnswer>
): Record<string, string> | null {
    const answers: Record<string, string> = {}
    for (const question of questions) {
        const answer = resolvePendingUserInputAnswer(draftAnswers[question.id])
        if (!answer) return null
        answers[question.id] = answer
    }
    return answers
}

export function countAnsweredPendingUserInputQuestions(
    questions: ReadonlyArray<AssistantUserInputQuestion>,
    draftAnswers: Record<string, PendingUserInputDraftAnswer>
): number {
    return questions.reduce((count, question) => (
        resolvePendingUserInputAnswer(draftAnswers[question.id]) ? count + 1 : count
    ), 0)
}

export function derivePendingUserInputProgress(
    prompt: AssistantPendingUserInput | null,
    draftAnswers: Record<string, PendingUserInputDraftAnswer>,
    questionIndex: number
): PendingUserInputProgress | null {
    if (!prompt) return null
    const questions = prompt.questions
    const normalizedQuestionIndex = questions.length === 0
        ? 0
        : Math.max(0, Math.min(questionIndex, questions.length - 1))
    const activeQuestion = questions[normalizedQuestionIndex] ?? null
    const activeDraft = activeQuestion ? draftAnswers[activeQuestion.id] : undefined
    const resolvedAnswer = resolvePendingUserInputAnswer(activeDraft)
    const customAnswer = activeDraft?.customAnswer ?? ''
    const answeredQuestionCount = countAnsweredPendingUserInputQuestions(questions, draftAnswers)
    const isLastQuestion = questions.length === 0 ? true : normalizedQuestionIndex >= questions.length - 1

    return {
        questionIndex: normalizedQuestionIndex,
        activeQuestion,
        activeDraft,
        selectedOptionLabel: activeDraft?.selectedOptionLabel,
        customAnswer,
        resolvedAnswer,
        usingCustomAnswer: customAnswer.trim().length > 0,
        answeredQuestionCount,
        isLastQuestion,
        isComplete: buildPendingUserInputAnswers(questions, draftAnswers) !== null,
        canAdvance: Boolean(resolvedAnswer)
    }
}
