import log from 'electron-log'
import type {
    AssistantAccountOverview,
    AssistantClearLogsInput,
    AssistantConnectOptions,
    AssistantDeleteMessageInput,
    AssistantDomainEvent,
    AssistantLatestTurn,
    AssistantMessage,
    AssistantRuntimeStatus,
    AssistantSendPromptOptions,
    AssistantThread
} from '../../shared/assistant/contracts'
import { AssistantTextDeltaBuffer } from './assistant-text-delta-buffer'
import { CodexAppServerRuntime } from './codex-app-server'
import { AssistantPersistence } from './persistence'
import { applyDomainEvent, createDefaultSnapshot } from './projector'
import {
    broadcastAssistantPayload,
    createAssistantDomainEvent,
    ensureAssistantSession,
    markActiveThreadCompletionSeen,
    trimAssistantEvents,
    updateLatestTurnAssistantMessage
} from './service-helpers'
import { handleAssistantRuntimeEvent } from './service-runtime-events'
import { buildDeleteMessagePlan } from './service-history'
import {
    createAssistantSessionRecord,
    createAssistantUserMessage,
    createRunningLatestTurn
} from './service-records'
import {
    type AssistantStateRecord,
    createAssistantThread,
    findSessionByThreadId,
    findThreadForApproval,
    findThreadForUserInput,
    getActiveThread,
    getSelectedSession,
    isClearableIssueActivity,
    requireActiveThread,
    requireSession,
    requireThread
} from './service-state'
import {
    createAssistantId,
    deriveSessionTitleFromPrompt,
    isDefaultSessionTitle,
    nowIso,
    sanitizeOptionalPath
} from './utils'

export class AssistantService {
    private static readonly MAX_IN_MEMORY_EVENTS = 256
    private static readonly ASSISTANT_TEXT_DELTA_FLUSH_MS = 40
    private static readonly ASSISTANT_EVENT_BROADCAST_BATCH_MS = 16
    private readonly runtime = new CodexAppServerRuntime()
    private readonly persistence = new AssistantPersistence()
    private readonly assistantTextDeltaBuffer = new AssistantTextDeltaBuffer({
        flushDelayMs: AssistantService.ASSISTANT_TEXT_DELTA_FLUSH_MS,
        onFlush: (entry) => {
            this.appendEvent('thread.message.assistant.delta', entry.occurredAt, {
                threadId: entry.threadId,
                messageId: entry.messageId,
                delta: entry.delta,
                turnId: entry.turnId
            }, entry.sessionId, entry.threadId)
        }
    })
    private readonly subscribers = new Set<number>()
    private state: AssistantStateRecord = {
        snapshot: createDefaultSnapshot(),
        events: []
    }
    private readonly planBuffers = new Map<string, string>()
    private pendingBroadcastEvents: AssistantDomainEvent[] = []
    private pendingBroadcastTimer: NodeJS.Timeout | null = null
    private readonly readyPromise: Promise<void>

    constructor() {
        this.readyPromise = this.initialize()
        this.runtime.on('runtime', (event) => {
            this.handleRuntimeEvent(event)
        })
    }

    subscribe(senderId: number) {
        this.subscribers.add(senderId)
        return { success: true as const }
    }

    unsubscribe(senderId: number) {
        this.subscribers.delete(senderId)
        return { success: true as const }
    }

    async getSnapshot() {
        await this.ensureReady()
        return structuredClone(this.state.snapshot)
    }

    async getBootstrap() {
        await this.ensureReady()
        const status = await this.getStatus()
        return {
            snapshot: structuredClone(this.state.snapshot),
            status
        }
    }

    async getStatus(): Promise<AssistantRuntimeStatus> {
        await this.ensureReady()
        const availability = await this.runtime.checkAvailability()
        const session = getSelectedSession(this.state.snapshot)
        const thread = getActiveThread(session)
        return {
            available: availability.available,
            connected: Boolean(thread && (thread.state === 'ready' || thread.state === 'running' || thread.state === 'waiting')),
            selectedSessionId: session?.id || null,
            activeThreadId: thread?.id || null,
            state: thread?.state || 'disconnected',
            reason: availability.reason
        }
    }

    async listModels(forceRefresh = false) {
        await this.ensureReady()
        const models = await this.runtime.listModels(forceRefresh)
        this.state.snapshot.knownModels = models
        this.persistence.updateMetadata(this.state.snapshot)
        return { success: true as const, models }
    }

    async getAccountOverview() {
        await this.ensureReady()
        const [accountPayload, rateLimitPayload] = await Promise.all([
            this.runtime.getAccount(),
            this.runtime.getAccountRateLimits()
        ])

        const overview: AssistantAccountOverview = {
            account: accountPayload.account,
            authMode: accountPayload.authMode,
            requiresOpenaiAuth: accountPayload.requiresOpenaiAuth,
            rateLimits: rateLimitPayload.rateLimits,
            rateLimitsByLimitId: rateLimitPayload.rateLimitsByLimitId,
            fetchedAt: nowIso()
        }

        return { success: true as const, overview }
    }

    async connect(options?: AssistantConnectOptions) {
        await this.ensureReady()
        const session = options?.sessionId
            ? requireSession(this.state.snapshot, options.sessionId)
            : getSelectedSession(this.state.snapshot) || ensureAssistantSession(this.state.snapshot, (type, occurredAt, payload, sessionId, threadId) => {
                this.appendEvent(type, occurredAt, payload, sessionId, threadId)
            })
        const thread = requireActiveThread(session)
        await this.runtime.connect(thread, session.projectPath || process.cwd())
        return { success: true as const, threadId: thread.id }
    }

    async disconnect(sessionId?: string) {
        await this.ensureReady()
        const session = sessionId
            ? requireSession(this.state.snapshot, sessionId)
            : getSelectedSession(this.state.snapshot)
        if (!session) {
            return { success: true as const }
        }
        const thread = requireActiveThread(session)
        this.runtime.disconnect(thread.id)
        return { success: true as const }
    }

    async createSession(title?: string, projectPath?: string) {
        await this.ensureReady()
        const createdAt = nowIso()
        const sessionId = createAssistantId('assistant-session')
        const thread = createAssistantThread(createdAt, null, projectPath || null)
        const session = createAssistantSessionRecord({
            sessionId,
            title: title?.trim() || 'New Session',
            projectPath: projectPath?.trim() || null,
            createdAt,
            thread
        })
        this.appendEvent('session.created', createdAt, { session }, sessionId, thread.id)
        this.appendEvent('session.selected', createdAt, { sessionId }, sessionId, thread.id)
        return { success: true as const, sessionId }
    }

    async selectSession(sessionId: string) {
        await this.ensureReady()
        requireSession(this.state.snapshot, sessionId)
        this.state.snapshot = await this.persistence.hydrateSelectedSession(this.state.snapshot, sessionId)
        const session = requireSession(this.state.snapshot, sessionId)
        const occurredAt = nowIso()
        this.appendEvent('session.selected', occurredAt, { sessionId }, sessionId)
        markActiveThreadCompletionSeen(session, occurredAt, (type, eventOccurredAt, payload, eventSessionId, threadId) => {
            this.appendEvent(type, eventOccurredAt, payload, eventSessionId, threadId)
        })
        return { success: true as const, sessionId, snapshot: structuredClone(this.state.snapshot) }
    }

    async renameSession(sessionId: string, title: string) {
        await this.ensureReady()
        const session = requireSession(this.state.snapshot, sessionId)
        this.appendEvent('session.updated', nowIso(), {
            sessionId,
            patch: {
                title: title.trim() || session.title,
                updatedAt: nowIso()
            }
        }, sessionId)
        return { success: true as const }
    }

    async archiveSession(sessionId: string, archived = true) {
        await this.ensureReady()
        requireSession(this.state.snapshot, sessionId)
        this.appendEvent('session.updated', nowIso(), {
            sessionId,
            patch: {
                archived,
                updatedAt: nowIso()
            }
        }, sessionId)
        return { success: true as const }
    }

    async deleteSession(sessionId: string) {
        await this.ensureReady()
        const session = requireSession(this.state.snapshot, sessionId)
        const thread = getActiveThread(session)
        if (thread) {
            this.runtime.disconnect(thread.id)
        }
        this.appendEvent('session.deleted', nowIso(), { sessionId }, sessionId)
        return { success: true as const }
    }

    async clearLogs(input?: AssistantClearLogsInput) {
        await this.ensureReady()
        const session = input?.sessionId
            ? requireSession(this.state.snapshot, input.sessionId)
            : requireSession(this.state.snapshot, this.state.snapshot.selectedSessionId || '')
        const thread = requireActiveThread(session)
        const occurredAt = nowIso()

        this.appendEvent('thread.updated', occurredAt, {
            threadId: thread.id,
            patch: {
                activities: thread.activities.filter((activity) => !isClearableIssueActivity(activity)),
                updatedAt: occurredAt
            }
        }, session.id, thread.id)

        return { success: true as const }
    }

    async deleteMessage(input: AssistantDeleteMessageInput) {
        await this.ensureReady()
        const session = input?.sessionId
            ? requireSession(this.state.snapshot, input.sessionId)
            : requireSession(this.state.snapshot, this.state.snapshot.selectedSessionId || '')
        const thread = requireActiveThread(session)
        const occurredAt = nowIso()
        const deletePlan = buildDeleteMessagePlan(thread, input.messageId, occurredAt)

        if (deletePlan.rollbackTurnCount) {
            try {
                await this.runtime.rollbackThread(thread.id, deletePlan.rollbackTurnCount)
            } catch (error) {
                log.warn('[Assistant] rollbackThread failed during deleteMessage; applying local history trim only', error)
            }
        }

        this.appendEvent('thread.updated', occurredAt, {
            threadId: thread.id,
            patch: deletePlan.patch
        }, session.id, thread.id)

        return { success: true as const }
    }

    async setSessionProjectPath(sessionId: string, projectPath: string | null) {
        await this.ensureReady()
        requireSession(this.state.snapshot, sessionId)
        this.appendEvent('session.updated', nowIso(), {
            sessionId,
            patch: {
                projectPath: sanitizeOptionalPath(projectPath),
                updatedAt: nowIso()
            }
        }, sessionId)
        return { success: true as const }
    }

    async newThread(sessionId?: string) {
        await this.ensureReady()
        const session = sessionId
            ? requireSession(this.state.snapshot, sessionId)
            : getSelectedSession(this.state.snapshot) || ensureAssistantSession(this.state.snapshot, (type, occurredAt, payload, eventSessionId, threadId) => {
                this.appendEvent(type, occurredAt, payload, eventSessionId, threadId)
            })
        const previousThread = getActiveThread(session)
        if (previousThread) {
            this.runtime.disconnect(previousThread.id)
        }

        const createdAt = nowIso()
        const thread = createAssistantThread(
            createdAt,
            previousThread,
            session.projectPath ?? previousThread?.cwd ?? null
        )
        this.appendEvent('thread.created', createdAt, { sessionId: session.id, thread }, session.id, thread.id)
        this.appendEvent('session.updated', createdAt, {
            sessionId: session.id,
            patch: {
                activeThreadId: thread.id,
                updatedAt: createdAt
            }
        }, session.id, thread.id)
        return { success: true as const, threadId: thread.id }
    }

    async sendPrompt(prompt: string, options?: AssistantSendPromptOptions) {
        await this.ensureReady()
        const input = String(prompt || '').trim()
        if (!input) throw new Error('Prompt is required.')

        const session = options?.sessionId
            ? requireSession(this.state.snapshot, options.sessionId)
            : ensureAssistantSession(this.state.snapshot, (type, occurredAt, payload, sessionId, threadId) => {
                this.appendEvent(type, occurredAt, payload, sessionId, threadId)
            })
        const thread = requireActiveThread(session)
        const occurredAt = nowIso()
        const title = isDefaultSessionTitle(session.title) ? deriveSessionTitleFromPrompt(input) : session.title
        if (title !== session.title) {
            this.appendEvent('session.updated', occurredAt, {
                sessionId: session.id,
                patch: {
                    title,
                    updatedAt: occurredAt
                }
            }, session.id, thread.id)
        }

        const userMessage = createAssistantUserMessage(input, occurredAt, createAssistantId('assistant-message'))
        this.appendEvent('thread.message.user', occurredAt, { threadId: thread.id, message: userMessage }, session.id, thread.id)

        const runtimeCwd = session.projectPath || thread.cwd || process.cwd()
        const updatedThreadPatch: Partial<AssistantThread> & Pick<AssistantThread, 'model' | 'runtimeMode' | 'interactionMode' | 'cwd' | 'state' | 'lastError' | 'activePlan' | 'updatedAt'> = {
            model: options?.model || thread.model,
            runtimeMode: options?.runtimeMode || thread.runtimeMode,
            interactionMode: options?.interactionMode || thread.interactionMode,
            cwd: runtimeCwd,
            state: 'starting',
            lastError: null,
            activePlan: null,
            updatedAt: occurredAt
        }
        this.appendEvent('thread.updated', occurredAt, { threadId: thread.id, patch: updatedThreadPatch }, session.id, thread.id)

        try {
            await this.runtime.connect({ ...thread, ...updatedThreadPatch }, runtimeCwd)
            const result = await this.runtime.sendPrompt(thread.id, input, {
                model: options?.model,
                runtimeMode: options?.runtimeMode,
                interactionMode: options?.interactionMode,
                effort: options?.effort,
                serviceTier: options?.serviceTier
            })
            const latestTurn = createRunningLatestTurn(result.turnId, occurredAt, options)
            this.appendEvent('thread.latest-turn.updated', occurredAt, { threadId: thread.id, latestTurn }, session.id, thread.id)
            return { success: true as const, sessionId: session.id, threadId: thread.id, turnId: result.turnId }
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to send prompt.'
            this.appendEvent('thread.updated', nowIso(), {
                threadId: thread.id,
                patch: {
                    state: 'error',
                    lastError: message,
                    updatedAt: nowIso()
                }
            }, session.id, thread.id)
            this.appendEvent('thread.activity.appended', nowIso(), {
                threadId: thread.id,
                activity: {
                    id: createAssistantId('assistant-activity'),
                    kind: 'runtime.error',
                    tone: 'error',
                    summary: 'Failed to start turn',
                    detail: message,
                    turnId: null,
                    createdAt: nowIso()
                }
            }, session.id, thread.id)
            throw error
        }
    }

    async interruptTurn(turnId?: string, sessionId?: string) {
        await this.ensureReady()
        const session = requireSession(this.state.snapshot, sessionId)
        const thread = requireActiveThread(session)
        const effectiveTurnId = turnId || thread.latestTurn?.id
        if (effectiveTurnId) {
            await this.runtime.interruptTurn(thread.id, effectiveTurnId)
        }
        return { success: true as const }
    }

    async respondApproval(input: { requestId: string; decision: 'acceptForSession' | 'decline' }) {
        await this.ensureReady()
        const target = findThreadForApproval(this.state.snapshot, input.requestId)
        if (!target) throw new Error(`Unknown approval request ${input.requestId}.`)
        await this.runtime.respondApproval(target.thread.id, input.requestId, input.decision)
        return { success: true as const }
    }

    async respondUserInput(input: { requestId: string; answers: Record<string, string | string[]> }) {
        await this.ensureReady()
        const target = findThreadForUserInput(this.state.snapshot, input.requestId)
        if (!target) throw new Error(`Unknown user-input request ${input.requestId}.`)
        await this.runtime.respondUserInput(target.thread.id, input.requestId, input.answers)
        return { success: true as const }
    }
    dispose() {
        this.assistantTextDeltaBuffer.dispose()
        this.runtime.dispose()
        void this.persistence.flush()
    }

    private async initialize() {
        const loaded = await this.persistence.load()
        this.state = {
            snapshot: loaded.snapshot || createDefaultSnapshot(),
            events: loaded.events || []
        }
    }

    private async ensureReady() {
        await this.readyPromise
    }

    private appendEvent(type: AssistantDomainEvent['type'], occurredAt: string, payload: Record<string, unknown>, sessionId?: string, threadId?: string) {
        const event = createAssistantDomainEvent(this.state.snapshot.snapshotSequence, type, occurredAt, payload, sessionId, threadId)
        this.state.events.push(event)
        this.state.events = trimAssistantEvents(this.state.events, AssistantService.MAX_IN_MEMORY_EVENTS)
        this.state.snapshot = applyDomainEvent(this.state.snapshot, event)
        this.persistence.appendEvent(event, this.state.snapshot)
        this.queueBroadcastEvent(event)
    }

    private queueBroadcastEvent(event: AssistantDomainEvent): void {
        this.pendingBroadcastEvents.push(event)
        if (this.pendingBroadcastTimer) return

        this.pendingBroadcastTimer = setTimeout(() => {
            this.pendingBroadcastTimer = null
            this.flushBroadcastEvents()
        }, AssistantService.ASSISTANT_EVENT_BROADCAST_BATCH_MS)
        this.pendingBroadcastTimer.unref?.()
    }

    private flushBroadcastEvents(): void {
        if (this.pendingBroadcastEvents.length === 0) return
        const events = this.pendingBroadcastEvents.splice(0, this.pendingBroadcastEvents.length)
        broadcastAssistantPayload(this.subscribers, events.length === 1 ? { event: events[0] } : { events })
    }

    private handleRuntimeEvent(event: Parameters<typeof handleAssistantRuntimeEvent>[0]) {
        handleAssistantRuntimeEvent(event, {
            planBuffers: this.planBuffers,
            findSessionByThreadId: (threadId) => findSessionByThreadId(this.state.snapshot, threadId),
            requireThread: (threadId) => requireThread(this.state.snapshot, threadId),
            queueAssistantTextDelta: (entry) => this.assistantTextDeltaBuffer.queue(entry),
            flushAssistantTextDelta: (target) => this.assistantTextDeltaBuffer.flush(target),
            appendEvent: (type, occurredAt, payload, sessionId, threadId) => this.appendEvent(type, occurredAt, payload, sessionId, threadId),
            updateLatestTurnAssistantMessage: (sessionId, threadId, assistantMessageId, occurredAt) => {
                updateLatestTurnAssistantMessage(this.state.snapshot, sessionId, threadId, assistantMessageId, occurredAt, (type, eventOccurredAt, payload, eventSessionId, eventThreadId) => {
                    this.appendEvent(type, eventOccurredAt, payload, eventSessionId, eventThreadId)
                })
            }
        })

        if (event.type !== 'turn.completed') return

        const selectedSession = getSelectedSession(this.state.snapshot)
        const activeThread = getActiveThread(selectedSession)
        if (!selectedSession || !activeThread || activeThread.id !== event.threadId) return
        if (!activeThread.latestTurn || activeThread.latestTurn.state !== 'completed') return
        if (activeThread.lastSeenCompletedTurnId === activeThread.latestTurn.id) return

        this.appendEvent('thread.updated', event.createdAt, {
            threadId: activeThread.id,
            patch: {
                lastSeenCompletedTurnId: activeThread.latestTurn.id
            }
        }, selectedSession.id, activeThread.id)
    }
}
