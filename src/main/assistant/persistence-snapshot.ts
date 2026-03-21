import type { AssistantSnapshot, AssistantThread } from '../../shared/assistant/contracts'

export type AssistantHydratedThreadData = Pick<
    AssistantThread,
    'messages' | 'proposedPlans' | 'activities' | 'pendingApprovals' | 'pendingUserInputs' | 'activePlan'
>

function shouldKeepHydrated(thread: AssistantThread): boolean {
    return thread.state === 'starting' || thread.state === 'running' || thread.state === 'waiting'
}

export function summarizeThread(thread: AssistantThread): AssistantThread {
    return {
        ...thread,
        activePlan: null,
        messages: [],
        proposedPlans: [],
        activities: [],
        pendingApprovals: [],
        pendingUserInputs: []
    }
}

export function trimSnapshotToFocusedSession(snapshot: AssistantSnapshot, focusedSessionId: string | null): AssistantSnapshot {
    const next = structuredClone(snapshot)
    for (const session of next.sessions) {
        for (let index = 0; index < session.threads.length; index += 1) {
            const thread = session.threads[index]
            const shouldHydrate = (session.id === focusedSessionId && thread.id === session.activeThreadId) || shouldKeepHydrated(thread)
            if (!shouldHydrate) {
                session.threads[index] = summarizeThread(thread)
            }
        }
    }
    return next
}

export function hydrateFocusedSessionSnapshot(
    snapshot: AssistantSnapshot,
    sessionId: string,
    details: AssistantHydratedThreadData | null
): AssistantSnapshot {
    const next = trimSnapshotToFocusedSession(snapshot, sessionId)
    if (!details) return next

    const session = next.sessions.find((entry) => entry.id === sessionId)
    if (!session?.activeThreadId) return next

    const thread = session.threads.find((entry) => entry.id === session.activeThreadId)
    if (!thread) return next

    thread.activePlan = details.activePlan
    thread.messages = details.messages
    thread.proposedPlans = details.proposedPlans
    thread.activities = details.activities
    thread.pendingApprovals = details.pendingApprovals
    thread.pendingUserInputs = details.pendingUserInputs
    return next
}
