import type { AssistantPendingUserInput, AssistantUserInputQuestion } from '@shared/assistant/contracts'

export type AssistantPendingUserInputDraftAnswers = Record<string, string>

export type AssistantPendingUserInputProgress = {
    questionIndex: number
    activeQuestion: AssistantUserInputQuestion | null
    selectedOptionLabel: string | null
    answeredQuestionCount: number
    isLastQuestion: boolean
}

export function buildAssistantPendingUserInputAnswers(
    questions: ReadonlyArray<AssistantUserInputQuestion>,
    draftAnswers: AssistantPendingUserInputDraftAnswers
): Record<string, string> | null {
    const answers: Record<string, string> = {}

    for (const question of questions) {
        const answer = String(draftAnswers[question.id] || '').trim()
        if (!answer) return null
        answers[question.id] = answer
    }

    return answers
}

export function findFirstUnansweredAssistantPendingUserInputQuestionIndex(
    questions: ReadonlyArray<AssistantUserInputQuestion>,
    draftAnswers: AssistantPendingUserInputDraftAnswers
): number {
    const unansweredIndex = questions.findIndex((question) => !String(draftAnswers[question.id] || '').trim())
    if (unansweredIndex >= 0) return unansweredIndex
    return Math.max(questions.length - 1, 0)
}

export function deriveAssistantPendingUserInputProgress(
    pendingInput: AssistantPendingUserInput | null,
    draftAnswers: AssistantPendingUserInputDraftAnswers,
    questionIndex: number
): AssistantPendingUserInputProgress | null {
    if (!pendingInput) return null

    const questions = pendingInput.questions
    if (questions.length === 0) {
        return {
            questionIndex: 0,
            activeQuestion: null,
            selectedOptionLabel: null,
            answeredQuestionCount: 0,
            isLastQuestion: true
        }
    }

    const normalizedQuestionIndex = Math.max(0, Math.min(questionIndex, questions.length - 1))
    const activeQuestion = questions[normalizedQuestionIndex] || null

    return {
        questionIndex: normalizedQuestionIndex,
        activeQuestion,
        selectedOptionLabel: activeQuestion ? String(draftAnswers[activeQuestion.id] || '').trim() || null : null,
        answeredQuestionCount: questions.reduce((count, question) => count + (String(draftAnswers[question.id] || '').trim() ? 1 : 0), 0),
        isLastQuestion: normalizedQuestionIndex >= questions.length - 1
    }
}

