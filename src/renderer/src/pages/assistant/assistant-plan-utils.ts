import type { AssistantActivePlan, AssistantLatestTurn, AssistantPlanStep, AssistantProposedPlan } from '@shared/assistant/contracts'

export type AssistantActivePlanProgress = {
    currentStepNumber: number
    totalSteps: number
    completedSteps: number
    activeStepIndex: number | null
    isComplete: boolean
    steps: AssistantPlanStep[]
}

export function normalizeAssistantPlanSteps(
    activePlan: AssistantActivePlan | null,
    latestTurn: AssistantLatestTurn | null
): AssistantPlanStep[] {
    const steps = activePlan?.plan || []
    if (steps.length === 0) return []

    const sameTurn = !activePlan?.turnId || !latestTurn?.id || activePlan.turnId === latestTurn.id
    const shouldCloseStaleInProgressStep = sameTurn && latestTurn?.state === 'completed'

    if (!shouldCloseStaleInProgressStep) return steps

    return steps.map((step) => step.status === 'inProgress'
        ? { ...step, status: 'completed' }
        : step
    )
}

export function getAssistantActivePlanProgress(
    activePlan: AssistantActivePlan | null,
    latestTurn: AssistantLatestTurn | null
): AssistantActivePlanProgress | null {
    const steps = normalizeAssistantPlanSteps(activePlan, latestTurn) || []
    if (steps.length === 0) return null

    const activeStepIndex = steps.findIndex((step) => step.status === 'inProgress')
    const completedSteps = steps.filter((step) => step.status === 'completed').length
    const isComplete = completedSteps === steps.length
    const fallbackStepNumber = Math.min(steps.length, Math.max(1, completedSteps + 1))

    return {
        currentStepNumber: isComplete ? steps.length : activeStepIndex >= 0 ? activeStepIndex + 1 : fallbackStepNumber,
        totalSteps: steps.length,
        completedSteps,
        activeStepIndex: activeStepIndex >= 0 ? activeStepIndex : null,
        isComplete,
        steps
    }
}

export function hasAssistantPlanPanelContent(
    activePlan: AssistantActivePlan | null,
    latestProposedPlan: AssistantProposedPlan | null
): boolean {
    return (activePlan?.plan.length || 0) > 0 || Boolean(latestProposedPlan?.planMarkdown?.trim())
}
