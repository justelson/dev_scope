import { useEffect, useSyncExternalStore } from 'react'
import type {
    AssistantApprovalResponseInput,
    AssistantClearLogsInput,
    AssistantConnectOptions,
    AssistantDeleteMessageInput,
    AssistantModelInfo,
    AssistantRuntimeStatus,
    AssistantSendPromptOptions,
    AssistantSnapshot,
    AssistantUserInputResponseInput
} from '@shared/assistant/contracts'
import type { DevScopeResult } from '@shared/contracts/devscope-api'
import { applyAssistantDomainEvent, createDefaultAssistantSnapshot } from '@shared/assistant/projector'
import {
    getActiveAssistantThread,
    getAssistantActivePlan,
    getAssistantActivityFeed,
    getAssistantLatestProposedPlan,
    getAssistantPendingApprovals,
    getAssistantPendingUserInputs,
    getAssistantThreadPhase,
    getAssistantThreadPhaseLabel,
    getAssistantTimelineMessages,
    getSelectedAssistantSession,
    getVisibleAssistantSessions
} from './selectors'

type AssistantStoreState = {
    snapshot: AssistantSnapshot
    status: AssistantRuntimeStatus
    hydrating: boolean
    hydrated: boolean
    modelsLoading: boolean
    commandPending: boolean
    error: string | null
}

const INITIAL_STATUS: AssistantRuntimeStatus = {
    available: false,
    connected: false,
    selectedSessionId: null,
    activeThreadId: null,
    state: 'disconnected',
    reason: null
}

class AssistantStore {
    private state: AssistantStoreState = {
        snapshot: createDefaultAssistantSnapshot(),
        status: INITIAL_STATUS,
        hydrating: false,
        hydrated: false,
        modelsLoading: false,
        commandPending: false,
        error: null
    }
    private readonly listeners = new Set<() => void>()
    private eventUnsubscribe: (() => void) | null = null
    private retainCount = 0
    private hydratePromise: Promise<void> | null = null
    private modelRefreshPromise: Promise<DevScopeResult<{ models: AssistantModelInfo[] }>> | null = null

    subscribe = (listener: () => void) => {
        this.listeners.add(listener)
        return () => {
            this.listeners.delete(listener)
        }
    }

    getState = () => this.state

    retain() {
        this.retainCount += 1
        if (this.retainCount === 1) {
            void this.hydrate()
            this.ensureEventStream()
        }
    }

    release() {
        this.retainCount = Math.max(0, this.retainCount - 1)
        if (this.retainCount === 0 && this.eventUnsubscribe) {
            this.eventUnsubscribe()
            this.eventUnsubscribe = null
        }
    }

    clearError() {
        this.setState({ error: null })
    }

    async hydrate() {
        if (this.hydratePromise) return this.hydratePromise
        this.setState({ hydrating: true, error: null })
        this.hydratePromise = (async () => {
            try {
                const [snapshot, status, modelsResult] = await Promise.all([
                    window.devscope.assistant.getSnapshot(),
                    window.devscope.assistant.getStatus(),
                    window.devscope.assistant.listModels(false)
                ])

                this.setState({
                    snapshot: {
                        ...snapshot,
                        knownModels: modelsResult.success ? modelsResult.models : snapshot.knownModels
                    },
                    status,
                    hydrating: false,
                    hydrated: true,
                    modelsLoading: false,
                    error: modelsResult.success ? null : modelsResult.error
                })
            } catch (error) {
                const message = error instanceof Error ? error.message : 'Failed to load assistant.'
                this.setState({
                    hydrating: false,
                    hydrated: true,
                    modelsLoading: false,
                    error: message
                })
            } finally {
                this.hydratePromise = null
            }
        })()
        return this.hydratePromise
    }

    async refreshStatus() {
        try {
            const status = await window.devscope.assistant.getStatus()
            this.setState({ status })
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to refresh assistant status.'
            this.setState({ error: message })
        }
    }

    async refreshModels(forceRefresh = true) {
        if (this.modelRefreshPromise) return this.modelRefreshPromise
        this.setState({ modelsLoading: true, error: null })
        this.modelRefreshPromise = (async () => {
            try {
                const result = await window.devscope.assistant.listModels(forceRefresh)
                if (!result.success) {
                    this.setState({ modelsLoading: false, error: result.error })
                    return result
                }
                this.setState((current) => ({
                    modelsLoading: false,
                    snapshot: {
                        ...current.snapshot,
                        knownModels: result.models
                    }
                }))
                return result
            } catch (error) {
                const message = error instanceof Error ? error.message : 'Failed to refresh models.'
                this.setState({ modelsLoading: false, error: message })
                return { success: false as const, error: message }
            } finally {
                this.modelRefreshPromise = null
            }
        })()
        return this.modelRefreshPromise
    }

    async refresh() {
        await this.hydrate()
    }

    async createSession(title?: string) {
        return this.runAction(() => window.devscope.assistant.createSession(title), true)
    }

    async selectSession(sessionId: string) {
        return this.runAction(() => window.devscope.assistant.selectSession(sessionId), true)
    }

    async renameSession(sessionId: string, title: string) {
        return this.runAction(() => window.devscope.assistant.renameSession(sessionId, title), false)
    }

    async archiveSession(sessionId: string, archived = true) {
        return this.runAction(() => window.devscope.assistant.archiveSession(sessionId, archived), false)
    }

    async deleteSession(sessionId: string) {
        return this.runAction(() => window.devscope.assistant.deleteSession(sessionId), true)
    }

    async deleteMessage(input: AssistantDeleteMessageInput) {
        return this.runAction(() => window.devscope.assistant.deleteMessage(input), true)
    }

    async clearLogs(input?: AssistantClearLogsInput) {
        return this.runAction(() => window.devscope.assistant.clearLogs(input), false)
    }

    async setSessionProjectPath(sessionId: string, projectPath: string | null) {
        return this.runAction(() => window.devscope.assistant.setSessionProjectPath(sessionId, projectPath), false)
    }

    async newThread(sessionId?: string) {
        return this.runAction(() => window.devscope.assistant.newThread(sessionId), true)
    }

    async connect(options?: AssistantConnectOptions) {
        return this.runAction(() => window.devscope.assistant.connect(options), true)
    }

    async disconnect(sessionId?: string) {
        return this.runAction(() => window.devscope.assistant.disconnect(sessionId), true)
    }

    async sendPrompt(prompt: string, options?: AssistantSendPromptOptions) {
        return this.runAction(() => window.devscope.assistant.sendPrompt(prompt, options), true)
    }

    async interruptTurn(turnId?: string, sessionId?: string) {
        return this.runAction(() => window.devscope.assistant.interruptTurn(turnId, sessionId), true)
    }

    async respondApproval(input: AssistantApprovalResponseInput) {
        return this.runAction(() => window.devscope.assistant.respondApproval(input), true)
    }

    async respondUserInput(input: AssistantUserInputResponseInput) {
        return this.runAction(() => window.devscope.assistant.respondUserInput(input), true)
    }

    async chooseProjectPath(sessionId: string) {
        const folderResult = await window.devscope.selectFolder()
        if (!folderResult.success) {
            this.setState({ error: folderResult.error })
            return folderResult
        }
        if (folderResult.cancelled || !folderResult.folderPath) {
            return { success: true as const, cancelled: true }
        }
        return this.runAction(
            () => window.devscope.assistant.setSessionProjectPath(sessionId, folderResult.folderPath || null),
            false
        )
    }

    private ensureEventStream() {
        if (this.eventUnsubscribe) return
        this.eventUnsubscribe = window.devscope.assistant.onEvent(({ event }) => {
            const currentSequence = this.state.snapshot.snapshotSequence
            if (event.sequence <= currentSequence) return
            if (event.sequence !== currentSequence + 1) {
                void this.hydrate()
                return
            }
            this.setState((current) => ({
                snapshot: applyAssistantDomainEvent(current.snapshot, event)
            }))
            if (
                event.type === 'thread.updated'
                || event.type === 'thread.latest-turn.updated'
                || event.type === 'session.created'
                || event.type === 'session.selected'
                || event.type === 'session.deleted'
            ) {
                void this.refreshStatus()
            }
        })
    }

    private async runAction<T extends DevScopeResult>(work: () => Promise<T>, refreshStatusAfter: boolean) {
        this.setState({ error: null, commandPending: true })
        try {
            const result = await work()
            if (!result.success) {
                this.setState({ error: result.error })
                return result
            }
            if (refreshStatusAfter) {
                void this.refreshStatus()
            }
            return result
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Assistant command failed.'
            this.setState({ error: message })
            return { success: false as const, error: message } as T
        } finally {
            this.setState({ commandPending: false })
        }
    }

    private setState(
        nextState:
        | Partial<AssistantStoreState>
        | ((current: AssistantStoreState) => Partial<AssistantStoreState>)
    ) {
        const partial = typeof nextState === 'function' ? nextState(this.state) : nextState
        this.state = { ...this.state, ...partial }
        for (const listener of this.listeners) {
            listener()
        }
    }
}

export const assistantStore = new AssistantStore()

function useAssistantStoreState<T>(selector: (state: AssistantStoreState) => T): T {
    return useSyncExternalStore(
        assistantStore.subscribe,
        () => selector(assistantStore.getState()),
        () => selector(assistantStore.getState())
    )
}

export function useAssistantStoreLifecycle() {
    useEffect(() => {
        assistantStore.retain()
        return () => {
            assistantStore.release()
        }
    }, [])
}

export function useAssistantStore() {
    useAssistantStoreLifecycle()
    const state = useAssistantStoreState((current) => current)
    const selectedSession = getSelectedAssistantSession(state.snapshot)
    const activeThread = getActiveAssistantThread(selectedSession)
    const visibleSessions = getVisibleAssistantSessions(state.snapshot, false)
    const archivedSessions = getVisibleAssistantSessions(state.snapshot, true).filter((session) => session.archived)
    const phase = getAssistantThreadPhase(activeThread)

    return {
        snapshot: state.snapshot,
        status: state.status,
        loading: state.hydrating,
        bootstrapped: state.hydrated,
        modelsLoading: state.modelsLoading,
        commandPending: state.commandPending || state.modelsLoading,
        commandError: state.error,
        selectedSession,
        activeThread,
        sessions: visibleSessions,
        visibleSessions,
        archivedSessions,
        timelineMessages: getAssistantTimelineMessages(activeThread),
        activityFeed: getAssistantActivityFeed(activeThread),
        pendingApprovals: getAssistantPendingApprovals(activeThread),
        pendingUserInputs: getAssistantPendingUserInputs(activeThread),
        activePlan: getAssistantActivePlan(activeThread),
        latestProposedPlan: getAssistantLatestProposedPlan(activeThread),
        phaseLabel: getAssistantThreadPhaseLabel(activeThread),
        phase,
        refresh: () => assistantStore.refresh(),
        refreshModels: () => assistantStore.refreshModels(true),
        createSession: (title?: string) => assistantStore.createSession(title).then(() => undefined),
        selectSession: (sessionId: string) => assistantStore.selectSession(sessionId).then(() => undefined),
        renameSession: (sessionId: string, title: string) => assistantStore.renameSession(sessionId, title).then(() => undefined),
        archiveSession: (sessionId: string, archived = true) => assistantStore.archiveSession(sessionId, archived).then(() => undefined),
        deleteSession: (sessionId: string) => assistantStore.deleteSession(sessionId).then(() => undefined),
        deleteMessage: (messageId: string, sessionId?: string) => assistantStore.deleteMessage({ messageId, sessionId }).then(() => undefined),
        deleteMessageResult: (messageId: string, sessionId?: string) => assistantStore.deleteMessage({ messageId, sessionId }),
        clearLogs: (sessionId?: string) => assistantStore.clearLogs(sessionId ? { sessionId } : undefined).then(() => undefined),
        clearLogsResult: (sessionId?: string) => assistantStore.clearLogs(sessionId ? { sessionId } : undefined),
        clearCommandError: () => assistantStore.clearError(),
        setSessionProjectPath: (sessionId: string, projectPath: string | null) => assistantStore.setSessionProjectPath(sessionId, projectPath).then(() => undefined),
        newThread: (sessionId?: string) => assistantStore.newThread(sessionId).then(() => undefined),
        sendPrompt: (prompt: string, options?: AssistantSendPromptOptions) => assistantStore.sendPrompt(prompt, options).then(() => undefined),
        sendPromptResult: (prompt: string, options?: AssistantSendPromptOptions) => assistantStore.sendPrompt(prompt, options),
        interruptTurn: (turnId?: string, sessionId?: string) => assistantStore.interruptTurn(turnId, sessionId).then(() => undefined),
        connect: (sessionId?: string) => assistantStore.connect(sessionId ? { sessionId } : undefined).then(() => undefined),
        disconnect: (sessionId?: string) => assistantStore.disconnect(sessionId).then(() => undefined),
        respondApproval: (requestId: string, decision: AssistantApprovalResponseInput['decision']) =>
            assistantStore.respondApproval({ requestId, decision }).then(() => undefined),
        respondUserInput: (requestId: string, answers: Record<string, string | string[]>) =>
            assistantStore.respondUserInput({ requestId, answers }).then(() => undefined),
        chooseProjectPath: () => {
            if (!selectedSession) return Promise.resolve()
            return assistantStore.chooseProjectPath(selectedSession.id).then(() => undefined)
        }
    }
}
