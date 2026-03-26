import type {
    AssistantApprovalResponseInput,
    AssistantApprovePendingPlaygroundLabRequestInput,
    AssistantAttachSessionToPlaygroundLabInput,
    AssistantClearLogsInput,
    AssistantConnectOptions,
    AssistantCreatePlaygroundLabInput,
    AssistantCreateSessionInput,
    AssistantDeclinePendingPlaygroundLabRequestInput,
    AssistantDeleteMessageInput,
    AssistantDomainEvent,
    AssistantModelInfo,
    AssistantRuntimeStatus,
    AssistantSendPromptOptions,
    AssistantSnapshot,
    AssistantUserInputResponseInput
} from '@shared/assistant/contracts'
import type { DevScopeResult } from '@shared/contracts/devscope-api'
import { applyAssistantDomainEvents, createDefaultAssistantSnapshot } from '@shared/assistant/projector'
import { collapseAssistantDeltaEvents } from './event-batching'
import {
    applyCachedSessionSelection,
    cacheHydratedSelectedSession,
    hasCachedSessionSelection,
    type CachedHydratedThreadState
} from './session-hydration-cache'

export type AssistantStoreState = {
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

const ASSISTANT_DELTA_EVENT_FLUSH_DELAY_MS = 64

function deriveAssistantRuntimeStatus(snapshot: AssistantSnapshot, currentStatus: AssistantRuntimeStatus): AssistantRuntimeStatus {
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
    private readonly hydratedSessionCache = new Map<string, CachedHydratedThreadState>()
    private eventUnsubscribe: (() => void) | null = null
    private retainCount = 0
    private hydratePromise: Promise<void> | null = null
    private modelRefreshPromise: Promise<DevScopeResult<{ models: AssistantModelInfo[] }>> | null = null
    private pendingAssistantEvents: AssistantDomainEvent[] = []
    private pendingAssistantEventFlushFrame: number | null = null
    private pendingAssistantEventFlushTimeout: number | null = null

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
        if (this.retainCount === 0) {
            this.clearPendingAssistantEvents()
        }
    }

    clearError() {
        this.setState({ error: null })
    }

    async hydrate() {
        if (this.hydratePromise) return this.hydratePromise
        this.clearPendingAssistantEvents()
        this.setState({ hydrating: true, error: null })
        this.hydratePromise = (async () => {
            try {
                const bootstrap = await window.devscope.assistant.bootstrap()
                const bootstrapSnapshot = bootstrap.snapshot
                const hasKnownModels = bootstrapSnapshot.knownModels.length > 0

                this.setState({
                    snapshot: bootstrapSnapshot,
                    status: bootstrap.status,
                    hydrating: false,
                    hydrated: true,
                    modelsLoading: !hasKnownModels,
                    error: null
                })

                if (!hasKnownModels) {
                    void this.refreshModels(false)
                }
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

    async createSession(input?: AssistantCreateSessionInput) {
        return this.runAction(() => window.devscope.assistant.createSession(input), true)
    }

    async selectSession(sessionId: string, options?: { force?: boolean }) {
        const force = options?.force === true
        if (!force && this.state.snapshot.selectedSessionId === sessionId) {
            return { success: true as const, snapshot: this.state.snapshot }
        }

        const canHydrateFromCache = hasCachedSessionSelection(this.state.snapshot, sessionId, this.hydratedSessionCache)
        this.setState((current) => {
            const snapshot = applyCachedSessionSelection(current.snapshot, sessionId, this.hydratedSessionCache)
            return {
                error: null,
                commandPending: !canHydrateFromCache,
                snapshot,
                status: deriveAssistantRuntimeStatus(snapshot, current.status)
            }
        })
        try {
            const result = await window.devscope.assistant.selectSession(sessionId)
            if (!result.success) {
                this.setState({ error: result.error })
                return result
            }
            this.setState((current) => ({
                snapshot: result.snapshot,
                status: deriveAssistantRuntimeStatus(result.snapshot, current.status)
            }))
            return result
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Assistant command failed.'
            this.setState({ error: message })
            return { success: false as const, error: message }
        } finally {
            this.setState({ commandPending: false })
        }
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

    async setPlaygroundRoot(rootPath: string | null) {
        return this.runAction(() => window.devscope.assistant.setPlaygroundRoot({ rootPath }), true)
    }

    async createPlaygroundLab(input: AssistantCreatePlaygroundLabInput) {
        return this.runAction(() => window.devscope.assistant.createPlaygroundLab(input), true)
    }

    async attachSessionToPlaygroundLab(input: AssistantAttachSessionToPlaygroundLabInput) {
        return this.runAction(() => window.devscope.assistant.attachSessionToPlaygroundLab(input), true)
    }

    async approvePendingPlaygroundLabRequest(input: AssistantApprovePendingPlaygroundLabRequestInput) {
        return this.runAction(() => window.devscope.assistant.approvePendingPlaygroundLabRequest(input), true)
    }

    async declinePendingPlaygroundLabRequest(input: AssistantDeclinePendingPlaygroundLabRequestInput) {
        return this.runAction(() => window.devscope.assistant.declinePendingPlaygroundLabRequest(input), true)
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
        if (folderResult.success && folderResult.folderPath && !folderResult.cancelled) {
            return this.runAction(
                () => window.devscope.assistant.setSessionProjectPath(sessionId, folderResult.folderPath || null),
                false
            )
        }
        return folderResult
    }

    async createProjectSession() {
        const folderResult = await window.devscope.selectFolder()
        if (!folderResult.success || folderResult.cancelled || !folderResult.folderPath) {
            return folderResult
        }
        const sessionResult = await this.createSession()
        if (!sessionResult.success) {
            return sessionResult
        }
        return this.runAction(
            () => window.devscope.assistant.setSessionProjectPath(sessionResult.sessionId, folderResult.folderPath || null),
            false
        )
    }

    private ensureEventStream() {
        if (this.eventUnsubscribe) return
        this.eventUnsubscribe = window.devscope.assistant.onEvent((payload) => {
            const events = Array.isArray(payload.events)
                ? payload.events
                : payload.event
                    ? [payload.event]
                    : []

            for (const event of events) {
                const currentSequence = this.getExpectedSnapshotSequence()
                if (event.sequence <= currentSequence) continue
                if (event.sequence !== currentSequence + 1) {
                    this.clearPendingAssistantEvents()
                    void this.hydrate()
                    return
                }
                this.queueAssistantEvent(event)
            }
        })
    }

    private getExpectedSnapshotSequence() {
        if (this.pendingAssistantEvents.length > 0) {
            return this.pendingAssistantEvents[this.pendingAssistantEvents.length - 1].sequence
        }
        return this.state.snapshot.snapshotSequence
    }

    private queueAssistantEvent(event: AssistantDomainEvent) {
        this.pendingAssistantEvents.push(event)
        if (event.type === 'thread.message.assistant.delta') {
            if (this.pendingAssistantEventFlushFrame !== null || this.pendingAssistantEventFlushTimeout !== null) return
            this.pendingAssistantEventFlushTimeout = window.setTimeout(() => {
                this.pendingAssistantEventFlushTimeout = null
                this.flushPendingAssistantEvents()
            }, ASSISTANT_DELTA_EVENT_FLUSH_DELAY_MS)
            return
        }

        if (this.pendingAssistantEventFlushTimeout !== null) {
            window.clearTimeout(this.pendingAssistantEventFlushTimeout)
            this.pendingAssistantEventFlushTimeout = null
        }
        if (this.pendingAssistantEventFlushFrame !== null) return

        this.pendingAssistantEventFlushFrame = window.requestAnimationFrame(() => {
            this.pendingAssistantEventFlushFrame = null
            this.flushPendingAssistantEvents()
        })
    }

    private flushPendingAssistantEvents() {
        if (this.pendingAssistantEventFlushFrame !== null) {
            window.cancelAnimationFrame(this.pendingAssistantEventFlushFrame)
            this.pendingAssistantEventFlushFrame = null
        }
        if (this.pendingAssistantEventFlushTimeout !== null) {
            window.clearTimeout(this.pendingAssistantEventFlushTimeout)
            this.pendingAssistantEventFlushTimeout = null
        }
        if (this.pendingAssistantEvents.length === 0) return

        const queuedEvents = collapseAssistantDeltaEvents(this.pendingAssistantEvents)
        this.pendingAssistantEvents = []
        this.setState((current) => {
            const snapshot = applyAssistantDomainEvents(current.snapshot, queuedEvents)
            return {
                snapshot,
                status: deriveAssistantRuntimeStatus(snapshot, current.status)
            }
        })
    }

    private clearPendingAssistantEvents() {
        if (this.pendingAssistantEventFlushFrame !== null) {
            window.cancelAnimationFrame(this.pendingAssistantEventFlushFrame)
            this.pendingAssistantEventFlushFrame = null
        }
        if (this.pendingAssistantEventFlushTimeout !== null) {
            window.clearTimeout(this.pendingAssistantEventFlushTimeout)
            this.pendingAssistantEventFlushTimeout = null
        }
        this.pendingAssistantEvents = []
    }

    private async runAction<T = Record<string, unknown>>(
        work: () => Promise<DevScopeResult<T>>,
        _refreshStatusAfter: boolean
    ): Promise<DevScopeResult<T>> {
        this.setState({ error: null, commandPending: true })
        try {
            const result = await work()
            if (!result.success) {
                this.setState({ error: result.error })
                return result
            }
            return result
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Assistant command failed.'
            this.setState({ error: message })
            return { success: false as const, error: message }
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
        const partialKeys = Object.keys(partial) as Array<keyof AssistantStoreState>
        if (partialKeys.length === 0) return

        let changed = false
        const previousState = this.state
        const mergedState: AssistantStoreState = { ...previousState }

        for (const key of partialKeys) {
            const nextValue = partial[key]
            if (Object.is(previousState[key], nextValue)) continue
            changed = true
            ;(mergedState as Record<keyof AssistantStoreState, AssistantStoreState[keyof AssistantStoreState]>)[key] = nextValue as AssistantStoreState[keyof AssistantStoreState]
        }

        if (!changed) return

        this.state = mergedState
        if (!Object.is(previousState.snapshot, mergedState.snapshot)) {
            cacheHydratedSelectedSession(this.hydratedSessionCache, mergedState.snapshot)
        }
        for (const listener of this.listeners) {
            listener()
        }
    }
}

export const assistantStore = new AssistantStore()
