import type { AssistantSnapshot, AssistantThread } from '@shared/assistant/contracts'

export type CachedHydratedThreadState = Pick<
    AssistantThread,
    'activePlan' | 'messages' | 'proposedPlans' | 'activities' | 'pendingApprovals' | 'pendingUserInputs'
> & {
    threadId: string
}

function hasHydratedThreadState(thread: AssistantThread): boolean {
    return Boolean(thread.activePlan)
        || thread.messages.length > 0
        || thread.proposedPlans.length > 0
        || thread.activities.length > 0
        || thread.pendingApprovals.length > 0
        || thread.pendingUserInputs.length > 0
}

function areCachedThreadStatesReferentiallyEqual(
    left: CachedHydratedThreadState | undefined,
    right: CachedHydratedThreadState
): boolean {
    return left?.threadId === right.threadId
        && left.activePlan === right.activePlan
        && left.messages === right.messages
        && left.proposedPlans === right.proposedPlans
        && left.activities === right.activities
        && left.pendingApprovals === right.pendingApprovals
        && left.pendingUserInputs === right.pendingUserInputs
}

export function cacheHydratedSelectedSession(
    cache: Map<string, CachedHydratedThreadState>,
    snapshot: AssistantSnapshot
): void {
    const selectedSession = snapshot.sessions.find((session) => session.id === snapshot.selectedSessionId)
    const activeThread = selectedSession?.threads.find((thread) => thread.id === selectedSession.activeThreadId)
    if (!selectedSession || !activeThread || !hasHydratedThreadState(activeThread)) return

    const nextCachedState: CachedHydratedThreadState = {
        threadId: activeThread.id,
        activePlan: activeThread.activePlan,
        messages: activeThread.messages,
        proposedPlans: activeThread.proposedPlans,
        activities: activeThread.activities,
        pendingApprovals: activeThread.pendingApprovals,
        pendingUserInputs: activeThread.pendingUserInputs
    }

    const previousCachedState = cache.get(selectedSession.id)
    if (areCachedThreadStatesReferentiallyEqual(previousCachedState, nextCachedState)) return

    cache.set(selectedSession.id, nextCachedState)
}

export function applyCachedSessionSelection(
    snapshot: AssistantSnapshot,
    sessionId: string,
    cache: Map<string, CachedHydratedThreadState>
): AssistantSnapshot {
    const cached = cache.get(sessionId)
    const nextSessions = snapshot.sessions.map((session) => {
        if (session.id !== sessionId) return session
        if (!cached || session.activeThreadId !== cached.threadId) return session

        let threadChanged = false
        const nextThreads = session.threads.map((thread) => {
            if (thread.id !== cached.threadId) return thread
            if (
                thread.activePlan === cached.activePlan
                && thread.messages === cached.messages
                && thread.proposedPlans === cached.proposedPlans
                && thread.activities === cached.activities
                && thread.pendingApprovals === cached.pendingApprovals
                && thread.pendingUserInputs === cached.pendingUserInputs
            ) {
                return thread
            }

            threadChanged = true
            return {
                ...thread,
                activePlan: cached.activePlan,
                messages: cached.messages,
                proposedPlans: cached.proposedPlans,
                activities: cached.activities,
                pendingApprovals: cached.pendingApprovals,
                pendingUserInputs: cached.pendingUserInputs
            }
        })

        if (!threadChanged) return session
        return {
            ...session,
            threads: nextThreads
        }
    })

    if (snapshot.selectedSessionId === sessionId && nextSessions === snapshot.sessions) {
        return snapshot
    }

    return {
        ...snapshot,
        selectedSessionId: sessionId,
        sessions: nextSessions
    }
}

export function hasCachedSessionSelection(
    snapshot: AssistantSnapshot,
    sessionId: string,
    cache: Map<string, CachedHydratedThreadState>
): boolean {
    const cached = cache.get(sessionId)
    if (!cached) return false

    const session = snapshot.sessions.find((entry) => entry.id === sessionId)
    return Boolean(session?.activeThreadId && session.activeThreadId === cached.threadId)
}
