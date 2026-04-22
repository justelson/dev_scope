import type { AssistantCreateSessionInput, AssistantSession, AssistantSnapshot } from '../../shared/assistant/contracts'
import type { AssistantServiceActionDeps } from './service-action-deps'
import { nowIso } from './utils'

function pickFallbackSession(snapshot: AssistantSnapshot): AssistantSession | null {
    return snapshot.sessions.find((session) => !session.archived) || snapshot.sessions[0] || null
}

export function buildDeletedSessionReplacementInput(
    session: AssistantSession,
    options?: { preservePlaygroundLab?: boolean }
): AssistantCreateSessionInput {
    const input: AssistantCreateSessionInput = {
        mode: session.mode
    }

    if (session.projectPath) {
        input.projectPath = session.projectPath
    }

    if (options?.preservePlaygroundLab !== false && session.playgroundLabId) {
        input.playgroundLabId = session.playgroundLabId
    }

    return input
}

export async function ensureAssistantSessionSelectionAfterDeletion(
    deps: AssistantServiceActionDeps,
    deletedSession: AssistantSession,
    options?: { replacementInput?: AssistantCreateSessionInput }
): Promise<void> {
    const snapshot = deps.getSnapshot()
    if (snapshot.selectedSessionId) return

    const fallbackSession = pickFallbackSession(snapshot)
    if (fallbackSession) {
        const occurredAt = nowIso()
        deps.appendEvent('session.selected', occurredAt, { sessionId: fallbackSession.id }, fallbackSession.id, fallbackSession.activeThreadId || undefined)
        return
    }

    await deps.createSession(options?.replacementInput || buildDeletedSessionReplacementInput(deletedSession))
}
