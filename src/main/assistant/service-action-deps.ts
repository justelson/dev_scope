import type {
    AssistantApprovePendingPlaygroundLabRequestInput,
    AssistantCreatePlaygroundLabInput,
    AssistantCreateSessionInput,
    AssistantDeclinePendingPlaygroundLabRequestInput,
    AssistantDeleteMessageInput,
    AssistantDomainEvent,
    AssistantPlaygroundState,
    AssistantSendPromptOptions,
    AssistantSession,
    AssistantSnapshot,
    AssistantThread
} from '../../shared/assistant/contracts'
import type { CodexAppServerRuntime } from './codex-app-server'

export interface AssistantServiceActionDeps {
    readonly runtime: CodexAppServerRuntime
    ensureReady(): Promise<void>
    getSnapshot(): AssistantSnapshot
    hydrateSelectedSession(sessionId: string): Promise<void>
    appendEvent(
        type: AssistantDomainEvent['type'],
        occurredAt: string,
        payload: Record<string, unknown>,
        sessionId?: string,
        threadId?: string
    ): void
    getSessionRuntimeCwd(
        session: AssistantSession,
        thread: AssistantThread,
        options?: { playgroundTerminalAccess?: boolean }
    ): string
    createSession(input?: AssistantCreateSessionInput): Promise<{ success: true; sessionId: string }>
    createPlaygroundLab(
        input: AssistantCreatePlaygroundLabInput
    ): Promise<{ success: true; labId: string; sessionId: string | null; playground: AssistantPlaygroundState }>
    sendPrompt(
        prompt: string,
        options?: AssistantSendPromptOptions
    ): Promise<{ success: true; sessionId: string; threadId: string; turnId?: string }>
    suppressAssistantTextForTurn(threadId: string, turnId: string): void
}

export type AssistantServicePlaygroundApprovalInput =
    | AssistantApprovePendingPlaygroundLabRequestInput
    | AssistantDeclinePendingPlaygroundLabRequestInput

export type AssistantServiceDeleteMessageInput = AssistantDeleteMessageInput
