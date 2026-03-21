import type { AssistantInteractionMode, AssistantRuntimeMode } from '@shared/assistant/contracts'
import type { AssistantComposerPreferenceEffort } from './assistant-composer-preferences'

export type AssistantComposerSessionState = {
    draft?: string
    model?: string
    runtimeMode?: AssistantRuntimeMode
    interactionMode?: AssistantInteractionMode
    effort?: AssistantComposerPreferenceEffort
    fastModeEnabled?: boolean
}

const COMPOSER_SESSION_STORAGE_KEY_PREFIX = 'devscope:assistant:composer-session:v1:'
const COMPOSER_SESSION_EVENT = 'devscope:assistant:composer-session-updated'

export function areAssistantComposerSessionStatesEqual(
    left: AssistantComposerSessionState,
    right: AssistantComposerSessionState
): boolean {
    return left.draft === right.draft
        && left.model === right.model
        && left.runtimeMode === right.runtimeMode
        && left.interactionMode === right.interactionMode
        && left.effort === right.effort
        && left.fastModeEnabled === right.fastModeEnabled
}

function sanitizeAssistantComposerSessionState(value: unknown): AssistantComposerSessionState {
    const record = value && typeof value === 'object' ? value as Record<string, unknown> : {}
    return {
        draft: typeof record.draft === 'string' && record.draft.length > 0 ? record.draft : undefined,
        model: typeof record.model === 'string' && record.model.trim().length > 0 ? record.model.trim() : undefined,
        runtimeMode: record.runtimeMode === 'full-access' || record.runtimeMode === 'approval-required' ? record.runtimeMode : undefined,
        interactionMode: record.interactionMode === 'plan' || record.interactionMode === 'default' ? record.interactionMode : undefined,
        effort: record.effort === 'low' || record.effort === 'medium' || record.effort === 'high' || record.effort === 'xhigh' ? record.effort : undefined,
        fastModeEnabled: typeof record.fastModeEnabled === 'boolean' ? record.fastModeEnabled : undefined
    }
}

function getAssistantComposerSessionStorageKey(sessionId: string): string {
    return `${COMPOSER_SESSION_STORAGE_KEY_PREFIX}${sessionId}`
}

function isAssistantComposerSessionStateEmpty(state: AssistantComposerSessionState): boolean {
    return !state.draft
        && !state.model
        && !state.runtimeMode
        && !state.interactionMode
        && !state.effort
        && state.fastModeEnabled === undefined
}

export function readAssistantComposerSessionState(
    sessionId?: string | null,
    fallback: AssistantComposerSessionState = {}
): AssistantComposerSessionState {
    if (!sessionId) return { ...fallback }
    try {
        const raw = localStorage.getItem(getAssistantComposerSessionStorageKey(sessionId))
        if (!raw) return { ...fallback }
        return { ...fallback, ...sanitizeAssistantComposerSessionState(JSON.parse(raw)) }
    } catch {
        return { ...fallback }
    }
}

export function writeAssistantComposerSessionState(sessionId: string, state: AssistantComposerSessionState): AssistantComposerSessionState {
    const sanitized = sanitizeAssistantComposerSessionState(state)
    try {
        const key = getAssistantComposerSessionStorageKey(sessionId)
        const current = readAssistantComposerSessionState(sessionId)
        if (areAssistantComposerSessionStatesEqual(current, sanitized)) return sanitized
        if (isAssistantComposerSessionStateEmpty(sanitized)) localStorage.removeItem(key)
        else localStorage.setItem(key, JSON.stringify(sanitized))
        window.dispatchEvent(new CustomEvent(COMPOSER_SESSION_EVENT, {
            detail: {
                sessionId,
                state: sanitized
            }
        }))
    } catch {}
    return sanitized
}

export function subscribeAssistantComposerSessionState(
    listener: (sessionId: string, state: AssistantComposerSessionState) => void
): () => void {
    const handleEvent = (event: Event) => {
        const detail = (event as CustomEvent<{ sessionId?: string; state?: AssistantComposerSessionState } | undefined>).detail
        const sessionId = typeof detail?.sessionId === 'string' ? detail.sessionId : ''
        if (!sessionId) return
        listener(sessionId, sanitizeAssistantComposerSessionState(detail?.state))
    }
    window.addEventListener(COMPOSER_SESSION_EVENT, handleEvent)
    return () => window.removeEventListener(COMPOSER_SESSION_EVENT, handleEvent)
}
