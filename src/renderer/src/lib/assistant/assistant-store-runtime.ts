import type { AssistantRuntimeStatus, AssistantSnapshot } from '@shared/assistant/contracts'

export type AssistantStoreState = {
    snapshot: AssistantSnapshot
    status: AssistantRuntimeStatus
    hydrating: boolean
    hydrated: boolean
    modelsLoading: boolean
    commandPending: boolean
    selectionHydrationKey: string | null
    error: string | null
}

export const INITIAL_ASSISTANT_RUNTIME_STATUS: AssistantRuntimeStatus = {
    available: false,
    connected: false,
    selectedSessionId: null,
    activeThreadId: null,
    state: 'disconnected',
    reason: null
}

export function deriveAssistantRuntimeStatus(
    snapshot: AssistantSnapshot,
    currentStatus: AssistantRuntimeStatus
): AssistantRuntimeStatus {
    const selectedSession = snapshot.sessions.find((session) => session.id === snapshot.selectedSessionId) || null
    const activeThread = selectedSession?.threads.find((thread) => thread.id === selectedSession.activeThreadId) || null
    const threadState = activeThread?.state || 'disconnected'

    return {
        ...currentStatus,
        selectedSessionId: selectedSession?.id || null,
        activeThreadId: activeThread?.id || null,
        state: threadState,
        connected: Boolean(activeThread && (threadState === 'ready' || threadState === 'running' || threadState === 'waiting'))
    }
}
