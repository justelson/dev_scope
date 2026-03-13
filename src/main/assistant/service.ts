import { webContents } from 'electron'
import log from 'electron-log'
import type {
    AssistantClearLogsInput,
    AssistantConnectOptions,
    AssistantDeleteMessageInput,
    AssistantDomainEvent,
    AssistantEventStreamPayload,
    AssistantLatestTurn,
    AssistantMessage,
    AssistantPendingApproval,
    AssistantPendingUserInput,
    AssistantRuntimeEvent,
    AssistantRuntimeStatus,
    AssistantSendPromptOptions,
    AssistantSession,
    AssistantSnapshot,
    AssistantThread
} from '../../shared/assistant/contracts'
import { ASSISTANT_IPC } from '../../shared/assistant/contracts'
import { CodexAppServerRuntime } from './codex-app-server'
import { AssistantPersistence } from './persistence'
import { applyDomainEvent, createDefaultSnapshot } from './projector'
import {
    createAssistantId,
    deriveSessionTitleFromPrompt,
    extractProposedPlanMarkdown,
    isDefaultSessionTitle,
    nowIso,
    sanitizeOptionalPath
} from './utils'

interface AssistantStateRecord {
    snapshot: AssistantSnapshot
    events: AssistantDomainEvent[]
}

function isClearableIssueActivity(activity: { kind?: string; tone?: string }): boolean {
    return activity.tone === 'warning'
        || activity.tone === 'error'
        || activity.kind === 'process.stderr'
        || activity.kind === 'runtime.error'
        || activity.kind === 'ui.command-error'
}

export class AssistantService {
    private readonly runtime = new CodexAppServerRuntime()
    private readonly persistence = new AssistantPersistence()
    private readonly subscribers = new Set<number>()
    private state: AssistantStateRecord
    private readonly planBuffers = new Map<string, string>()

    constructor() {
        const loaded = this.persistence.load()
        this.state = {
            snapshot: loaded.snapshot || createDefaultSnapshot(),
            events: loaded.events || []
        }
        this.runtime.on('runtime', (event: AssistantRuntimeEvent) => {
            void this.handleRuntimeEvent(event)
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

    getSnapshot(): AssistantSnapshot {
        return structuredClone(this.state.snapshot)
    }

    async getStatus(): Promise<AssistantRuntimeStatus> {
        const availability = await this.runtime.checkAvailability()
        const session = this.getSelectedSession()
        const thread = this.getActiveThread(session)
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
        const models = await this.runtime.listModels(forceRefresh)
        this.state.snapshot.knownModels = models
        this.persist()
        return { success: true as const, models }
    }

    async connect(options?: AssistantConnectOptions) {
        const session = options?.sessionId
            ? this.requireSession(options.sessionId)
            : this.getSelectedSession() || this.ensureSession()
        const thread = this.requireActiveThread(session)
        await this.runtime.connect(thread, session.projectPath || process.cwd())
        return { success: true as const, threadId: thread.id }
    }

    disconnect(sessionId?: string) {
        const session = sessionId
            ? this.requireSession(sessionId)
            : this.getSelectedSession()
        if (!session) {
            return { success: true as const }
        }
        const thread = this.requireActiveThread(session)
        this.runtime.disconnect(thread.id)
        return { success: true as const }
    }

    createSession(title?: string) {
        const createdAt = nowIso()
        const sessionId = createAssistantId('assistant-session')
        const thread = this.createThread(createdAt)
        const session: AssistantSession = {
            id: sessionId,
            title: title?.trim() || 'New Session',
            projectPath: null,
            archived: false,
            createdAt,
            updatedAt: createdAt,
            activeThreadId: thread.id,
            threadIds: [thread.id],
            threads: [thread]
        }
        this.appendEvent('session.created', createdAt, { session }, sessionId, thread.id)
        this.appendEvent('session.selected', createdAt, { sessionId }, sessionId, thread.id)
        return { success: true as const, sessionId }
    }

    selectSession(sessionId: string) {
        this.requireSession(sessionId)
        this.appendEvent('session.selected', nowIso(), { sessionId }, sessionId)
        return { success: true as const, sessionId }
    }

    renameSession(sessionId: string, title: string) {
        const session = this.requireSession(sessionId)
        this.appendEvent('session.updated', nowIso(), {
            sessionId,
            patch: {
                title: title.trim() || session.title,
                updatedAt: nowIso()
            }
        }, sessionId)
        return { success: true as const }
    }

    archiveSession(sessionId: string, archived = true) {
        this.requireSession(sessionId)
        this.appendEvent('session.updated', nowIso(), {
            sessionId,
            patch: {
                archived,
                updatedAt: nowIso()
            }
        }, sessionId)
        return { success: true as const }
    }

    deleteSession(sessionId: string) {
        const session = this.requireSession(sessionId)
        const thread = this.getActiveThread(session)
        if (thread) {
            this.runtime.disconnect(thread.id)
        }
        this.appendEvent('session.deleted', nowIso(), { sessionId }, sessionId)
        return { success: true as const }
    }

    clearLogs(input?: AssistantClearLogsInput) {
        const session = input?.sessionId ? this.requireSession(input.sessionId) : this.requireSession(this.state.snapshot.selectedSessionId || '')
        const thread = this.requireActiveThread(session)
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
        const session = input?.sessionId ? this.requireSession(input.sessionId) : this.requireSession(this.state.snapshot.selectedSessionId || '')
        const thread = this.requireActiveThread(session)
        const messages = [...thread.messages].sort((left, right) => left.createdAt.localeCompare(right.createdAt) || left.id.localeCompare(right.id))
        const targetIndex = messages.findIndex((message) => message.id === input.messageId && message.role === 'user')
        if (targetIndex < 0) throw new Error('User message not found.')

        const inferTurnIdForUserMessage = (index: number): string | null => {
            for (let cursor = index + 1; cursor < messages.length; cursor += 1) {
                if (messages[cursor].role === 'user') break
                if (messages[cursor].turnId) return messages[cursor].turnId
            }
            return messages[index].id === input.messageId ? (thread.latestTurn?.id || null) : null
        }

        const userTurnEntries = messages
            .map((message, index) => message.role === 'user' ? { message, index, turnId: inferTurnIdForUserMessage(index) } : null)
            .filter((entry): entry is { message: AssistantMessage; index: number; turnId: string | null } => Boolean(entry))

        const targetEntry = userTurnEntries.find((entry) => entry.message.id === input.messageId)
        if (!targetEntry) throw new Error('Unable to resolve message turn.')

        const orderedTurnIds = userTurnEntries
            .map((entry) => entry.turnId)
            .filter((turnId, index, array): turnId is string => Boolean(turnId) && array.indexOf(turnId) === index)

        const targetTurnIndex = targetEntry.turnId ? orderedTurnIds.indexOf(targetEntry.turnId) : -1
        if (targetEntry.turnId && targetTurnIndex >= 0) {
            try {
                await this.runtime.rollbackThread(thread.id, Math.max(1, orderedTurnIds.length - targetTurnIndex))
            } catch (error) {
                log.warn('[Assistant] rollbackThread failed during deleteMessage; applying local history trim only', error)
            }
        }

        const removedTurnIds = new Set(targetTurnIndex >= 0 ? orderedTurnIds.slice(targetTurnIndex) : [])
        const keptMessages = messages.slice(0, targetIndex)
        const remainingTurnIds = orderedTurnIds.filter((turnId) => !removedTurnIds.has(turnId))
        const latestRemainingTurnId = remainingTurnIds[remainingTurnIds.length - 1] || null
        const latestRemainingAssistantMessage = latestRemainingTurnId
            ? [...keptMessages].reverse().find((message) => message.role === 'assistant' && message.turnId === latestRemainingTurnId) || null
            : null
        const occurredAt = nowIso()

        this.appendEvent('thread.updated', occurredAt, {
            threadId: thread.id,
            patch: {
                messages: keptMessages,
                activities: thread.activities.filter((activity) => !activity.turnId || !removedTurnIds.has(activity.turnId)),
                proposedPlans: thread.proposedPlans.filter((plan) => !plan.turnId || !removedTurnIds.has(plan.turnId)),
                pendingApprovals: thread.pendingApprovals.filter((approval) => !approval.turnId || !removedTurnIds.has(approval.turnId)),
                pendingUserInputs: thread.pendingUserInputs.filter((entry) => !entry.turnId || !removedTurnIds.has(entry.turnId)),
                activePlan: thread.activePlan && thread.activePlan.turnId && removedTurnIds.has(thread.activePlan.turnId) ? null : thread.activePlan,
                latestTurn: latestRemainingTurnId
                    ? {
                        id: latestRemainingTurnId,
                        state: 'completed',
                        requestedAt: latestRemainingAssistantMessage?.createdAt || occurredAt,
                        startedAt: latestRemainingAssistantMessage?.createdAt || null,
                        completedAt: latestRemainingAssistantMessage?.updatedAt || occurredAt,
                        assistantMessageId: latestRemainingAssistantMessage?.id || null,
                        effort: null,
                        serviceTier: null,
                        usage: null
                    }
                    : null,
                state: 'ready',
                lastError: null,
                updatedAt: occurredAt
            }
        }, session.id, thread.id)

        return { success: true as const }
    }

    setSessionProjectPath(sessionId: string, projectPath: string | null) {
        this.requireSession(sessionId)
        this.appendEvent('session.updated', nowIso(), {
            sessionId,
            patch: {
                projectPath: sanitizeOptionalPath(projectPath),
                updatedAt: nowIso()
            }
        }, sessionId)
        return { success: true as const }
    }

    newThread(sessionId?: string) {
        const session = sessionId
            ? this.requireSession(sessionId)
            : this.getSelectedSession() || this.ensureSession()
        const previousThread = this.getActiveThread(session)
        if (previousThread) {
            this.runtime.disconnect(previousThread.id)
        }
        const createdAt = nowIso()
        const thread = this.createThread(createdAt, previousThread)
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
        const input = String(prompt || '').trim()
        if (!input) throw new Error('Prompt is required.')
        const session = options?.sessionId ? this.requireSession(options.sessionId) : this.ensureSession()
        const thread = this.requireActiveThread(session)
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
        const userMessage: AssistantMessage = {
            id: createAssistantId('assistant-message'),
            role: 'user',
            text: input,
            turnId: null,
            streaming: false,
            createdAt: occurredAt,
            updatedAt: occurredAt
        }
        this.appendEvent('thread.message.user', occurredAt, { threadId: thread.id, message: userMessage }, session.id, thread.id)

        const updatedThreadPatch = {
            model: options?.model || thread.model,
            runtimeMode: options?.runtimeMode || thread.runtimeMode,
            interactionMode: options?.interactionMode || thread.interactionMode,
            cwd: session.projectPath || thread.cwd || process.cwd(),
            state: 'starting',
            lastError: null,
            activePlan: null,
            updatedAt: occurredAt
        }
        this.appendEvent('thread.updated', occurredAt, { threadId: thread.id, patch: updatedThreadPatch }, session.id, thread.id)

        try {
            await this.runtime.connect({ ...thread, ...updatedThreadPatch } as AssistantThread, updatedThreadPatch.cwd)
            const result = await this.runtime.sendPrompt(thread.id, input, {
                model: options?.model,
                runtimeMode: options?.runtimeMode,
                interactionMode: options?.interactionMode,
                effort: options?.effort,
                serviceTier: options?.serviceTier
            })
            const latestTurn: AssistantLatestTurn = {
                id: result.turnId,
                state: 'running',
                requestedAt: occurredAt,
                startedAt: occurredAt,
                completedAt: null,
                assistantMessageId: null,
                effort: options?.effort || null,
                serviceTier: options?.serviceTier || null,
                usage: null
            }
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
        const session = this.requireSession(sessionId)
        const thread = this.requireActiveThread(session)
        const effectiveTurnId = turnId || thread.latestTurn?.id
        if (effectiveTurnId) {
            await this.runtime.interruptTurn(thread.id, effectiveTurnId)
        }
        return { success: true as const }
    }

    async respondApproval(input: { requestId: string; decision: 'acceptForSession' | 'decline' }) {
        const target = this.findThreadForApproval(input.requestId)
        if (!target) throw new Error(`Unknown approval request ${input.requestId}.`)
        await this.runtime.respondApproval(target.thread.id, input.requestId, input.decision)
        return { success: true as const }
    }

    async respondUserInput(input: { requestId: string; answers: Record<string, string | string[]> }) {
        const target = this.findThreadForUserInput(input.requestId)
        if (!target) throw new Error(`Unknown user-input request ${input.requestId}.`)
        await this.runtime.respondUserInput(target.thread.id, input.requestId, input.answers)
        return { success: true as const }
    }

    dispose() {
        this.runtime.dispose()
        this.persistence.flush()
    }

    private persist() {
        this.persistence.replace({
            version: 1,
            snapshot: this.state.snapshot,
            events: this.state.events
        })
    }

    private appendEvent(type: AssistantDomainEvent['type'], occurredAt: string, payload: Record<string, unknown>, sessionId?: string, threadId?: string) {
        const event: AssistantDomainEvent = {
            sequence: this.state.snapshot.snapshotSequence + 1,
            eventId: createAssistantId('assistant-event'),
            type,
            occurredAt,
            ...(sessionId ? { sessionId } : {}),
            ...(threadId ? { threadId } : {}),
            payload
        }
        this.state.events.push(event)
        this.state.snapshot = applyDomainEvent(this.state.snapshot, event)
        this.persist()
        this.broadcast({ event })
    }

    private async handleRuntimeEvent(event: AssistantRuntimeEvent) {
        const session = this.findSessionByThreadId(event.threadId)
        if (!session) return
        if (event.type === 'session.state.changed') {
            this.appendEvent('thread.updated', event.createdAt, {
                threadId: event.threadId,
                patch: {
                    state: event.payload.state,
                    lastError: event.payload.error || null,
                    updatedAt: event.createdAt
                }
            }, session.id, event.threadId)
            if (event.payload.message) {
                this.appendEvent('thread.activity.appended', event.createdAt, {
                    threadId: event.threadId,
                    activity: {
                        id: createAssistantId('assistant-activity'),
                        kind: 'session.state',
                        tone: event.payload.state === 'error' ? 'error' : 'info',
                        summary: event.payload.message,
                        turnId: event.turnId || null,
                        createdAt: event.createdAt
                    }
                }, session.id, event.threadId)
            }
            return
        }
        if (event.type === 'thread.started') {
            this.appendEvent('thread.updated', event.createdAt, {
                threadId: event.threadId,
                patch: {
                    providerThreadId: event.payload.providerThreadId,
                    state: 'ready',
                    updatedAt: event.createdAt
                }
            }, session.id, event.threadId)
            return
        }
        if (event.type === 'turn.started') {
            const existingThread = this.requireThread(event.threadId)
            this.appendEvent('thread.updated', event.createdAt, {
                threadId: event.threadId,
                patch: {
                    state: 'running',
                    model: event.payload.model || existingThread.model,
                    interactionMode: event.payload.interactionMode,
                    lastError: null,
                    activePlan: null,
                    updatedAt: event.createdAt
                }
            }, session.id, event.threadId)
            if (existingThread.latestTurn) {
                this.appendEvent('thread.latest-turn.updated', event.createdAt, {
                    threadId: event.threadId,
                    latestTurn: {
                        ...existingThread.latestTurn,
                        effort: event.payload.effort || existingThread.latestTurn.effort || null,
                        serviceTier: event.payload.serviceTier || existingThread.latestTurn.serviceTier || null
                    }
                }, session.id, event.threadId)
            }
            return
        }
        if (event.type === 'turn.completed') {
            const existingThread = this.requireThread(event.threadId)
            const latestTurn: AssistantLatestTurn = existingThread.latestTurn
                ? {
                    ...existingThread.latestTurn,
                    state: event.payload.outcome === 'completed' ? 'completed' : event.payload.outcome === 'interrupted' || event.payload.outcome === 'cancelled' ? 'interrupted' : 'error',
                    completedAt: event.createdAt,
                    effort: event.payload.effort || existingThread.latestTurn.effort || null,
                    serviceTier: event.payload.serviceTier || existingThread.latestTurn.serviceTier || null,
                    usage: event.payload.usage || existingThread.latestTurn.usage || null
                }
                : {
                    id: event.turnId || createAssistantId('assistant-turn'),
                    state: event.payload.outcome === 'completed' ? 'completed' : event.payload.outcome === 'interrupted' || event.payload.outcome === 'cancelled' ? 'interrupted' : 'error',
                    requestedAt: event.createdAt,
                    startedAt: event.createdAt,
                    completedAt: event.createdAt,
                    assistantMessageId: null,
                    effort: event.payload.effort || null,
                    serviceTier: event.payload.serviceTier || null,
                    usage: event.payload.usage || null
                }
            this.appendEvent('thread.latest-turn.updated', event.createdAt, { threadId: event.threadId, latestTurn }, session.id, event.threadId)
            this.appendEvent('thread.updated', event.createdAt, {
                threadId: event.threadId,
                patch: {
                    state: event.payload.outcome === 'completed' ? 'ready' : event.payload.outcome === 'failed' ? 'error' : 'interrupted',
                    lastError: event.payload.errorMessage || null,
                    updatedAt: event.createdAt
                }
            }, session.id, event.threadId)
            return
        }
        if (event.type === 'thread.token-usage.updated') {
            const existingThread = this.requireThread(event.threadId)
            const latestTurn: AssistantLatestTurn = existingThread.latestTurn
                ? {
                    ...existingThread.latestTurn,
                    usage: event.payload.usage
                }
                : {
                    id: event.turnId || createAssistantId('assistant-turn'),
                    state: 'running',
                    requestedAt: event.createdAt,
                    startedAt: event.createdAt,
                    completedAt: null,
                    assistantMessageId: null,
                    effort: null,
                    serviceTier: null,
                    usage: event.payload.usage
                }
            this.appendEvent('thread.latest-turn.updated', event.createdAt, { threadId: event.threadId, latestTurn }, session.id, event.threadId)
            return
        }
        if (event.type === 'content.delta' && event.payload.streamKind === 'assistant_text') {
            const messageId = `assistant-message-${event.itemId || event.turnId || event.eventId}`
            this.appendEvent('thread.message.assistant.delta', event.createdAt, { threadId: event.threadId, messageId, delta: event.payload.delta, turnId: event.turnId || null }, session.id, event.threadId)
            this.updateLatestTurnAssistantMessage(session.id, event.threadId, messageId, event.createdAt)
            return
        }
        if (event.type === 'content.completed' && event.payload.streamKind === 'assistant_text') {
            const messageId = `assistant-message-${event.itemId || event.turnId || event.eventId}`
            const existing = this.requireThread(event.threadId).messages.find((message) => message.id === messageId)
            if (!existing && event.payload.text) {
                this.appendEvent('thread.message.assistant.delta', event.createdAt, {
                    threadId: event.threadId,
                    messageId,
                    delta: event.payload.text,
                    turnId: event.turnId || null
                }, session.id, event.threadId)
            }
            this.appendEvent('thread.message.assistant.completed', event.createdAt, { threadId: event.threadId, messageId }, session.id, event.threadId)
            this.updateLatestTurnAssistantMessage(session.id, event.threadId, messageId, event.createdAt)
            const planMarkdown = extractProposedPlanMarkdown(event.payload.text)
            if (planMarkdown) {
                this.appendEvent('thread.proposed-plan.upserted', event.createdAt, {
                    threadId: event.threadId,
                    plan: {
                        id: `assistant-plan-${event.turnId || event.itemId || event.eventId}`,
                        turnId: event.turnId || null,
                        planMarkdown,
                        createdAt: event.createdAt,
                        updatedAt: event.createdAt
                    }
                }, session.id, event.threadId)
            }
            return
        }
        if (event.type === 'content.delta' && event.payload.streamKind === 'plan_text') {
            const key = `${event.threadId}:${event.turnId || event.itemId || 'active'}`
            this.planBuffers.set(key, `${this.planBuffers.get(key) || ''}${event.payload.delta}`)
            return
        }
        if (event.type === 'content.completed' && event.payload.streamKind === 'plan_text') {
            const key = `${event.threadId}:${event.turnId || event.itemId || 'active'}`
            const buffered = this.planBuffers.get(key) || ''
            const planMarkdown = String(event.payload.text || buffered || '').trim()
            this.planBuffers.delete(key)
            if (planMarkdown) {
                this.appendEvent('thread.proposed-plan.upserted', event.createdAt, {
                    threadId: event.threadId,
                    plan: {
                        id: `assistant-plan-${event.turnId || event.itemId || event.eventId}`,
                        turnId: event.turnId || null,
                        planMarkdown,
                        createdAt: event.createdAt,
                        updatedAt: event.createdAt
                    }
                }, session.id, event.threadId)
            }
            return
        }
        if (event.type === 'plan.updated') {
            this.appendEvent('thread.plan.updated', event.createdAt, {
                threadId: event.threadId,
                activePlan: {
                    explanation: event.payload.explanation,
                    plan: event.payload.plan,
                    turnId: event.turnId || null,
                    updatedAt: event.createdAt
                }
            }, session.id, event.threadId)
            return
        }
        if (event.type === 'approval.requested' || event.type === 'approval.resolved') {
            const existingThread = this.requireThread(event.threadId)
            const current = existingThread.pendingApprovals.find((entry) => entry.requestId === event.requestId)
            const approval: AssistantPendingApproval = current
                ? {
                    ...current,
                    status: event.type === 'approval.requested' ? 'pending' : 'resolved',
                    decision: event.type === 'approval.resolved' ? event.payload.decision : current.decision,
                    resolvedAt: event.type === 'approval.resolved' ? event.createdAt : current.resolvedAt
                }
                : {
                    id: createAssistantId('assistant-approval'),
                    requestId: event.requestId || createAssistantId('assistant-request'),
                    requestType: event.type === 'approval.requested' ? event.payload.requestType : 'command',
                    title: event.type === 'approval.requested' ? event.payload.title : undefined,
                    detail: event.type === 'approval.requested' ? event.payload.detail : undefined,
                    command: event.type === 'approval.requested' ? event.payload.command : undefined,
                    paths: event.type === 'approval.requested' ? event.payload.paths : undefined,
                    status: event.type === 'approval.requested' ? 'pending' : 'resolved',
                    decision: event.type === 'approval.resolved' ? event.payload.decision : null,
                    turnId: event.turnId || null,
                    createdAt: event.createdAt,
                    resolvedAt: event.type === 'approval.resolved' ? event.createdAt : null
                }
            this.appendEvent('thread.approval.updated', event.createdAt, { threadId: event.threadId, approval }, session.id, event.threadId)
            this.appendEvent('thread.activity.appended', event.createdAt, {
                threadId: event.threadId,
                activity: {
                    id: createAssistantId('assistant-activity'),
                    kind: event.type === 'approval.requested' ? 'approval.requested' : 'approval.resolved',
                    tone: 'info',
                    summary: event.type === 'approval.requested' ? 'Approval requested' : 'Approval resolved',
                    detail: approval.detail,
                    turnId: event.turnId || null,
                    createdAt: event.createdAt,
                    payload: {
                        requestId: approval.requestId,
                        requestType: approval.requestType,
                        decision: approval.decision,
                        command: approval.command,
                        paths: approval.paths,
                        detail: approval.detail,
                        title: approval.title
                    }
                }
            }, session.id, event.threadId)
            return
        }
        if (event.type === 'user-input.requested' || event.type === 'user-input.resolved') {
            const existingThread = this.requireThread(event.threadId)
            const current = existingThread.pendingUserInputs.find((entry) => entry.requestId === event.requestId)
            const userInput: AssistantPendingUserInput = current
                ? {
                    ...current,
                    status: event.type === 'user-input.requested' ? 'pending' : 'resolved',
                    answers: event.type === 'user-input.resolved' ? event.payload.answers : current.answers,
                    resolvedAt: event.type === 'user-input.resolved' ? event.createdAt : current.resolvedAt
                }
                : {
                    id: createAssistantId('assistant-user-input'),
                    requestId: event.requestId || createAssistantId('assistant-request'),
                    questions: event.type === 'user-input.requested' ? event.payload.questions : [],
                    status: event.type === 'user-input.requested' ? 'pending' : 'resolved',
                    answers: event.type === 'user-input.resolved' ? event.payload.answers : null,
                    turnId: event.turnId || null,
                    createdAt: event.createdAt,
                    resolvedAt: event.type === 'user-input.resolved' ? event.createdAt : null
                }
            this.appendEvent('thread.user-input.updated', event.createdAt, { threadId: event.threadId, userInput }, session.id, event.threadId)
            return
        }
        if (event.type === 'activity') {
            this.appendEvent('thread.activity.appended', event.createdAt, {
                threadId: event.threadId,
                activity: {
                    id: createAssistantId('assistant-activity'),
                    kind: event.payload.kind,
                    tone: event.payload.tone,
                    summary: event.payload.summary,
                    detail: event.payload.detail,
                    turnId: event.turnId || null,
                    createdAt: event.createdAt,
                    payload: event.payload.data
                }
            }, session.id, event.threadId)
        }
    }

    private broadcast(payload: AssistantEventStreamPayload) {
        for (const senderId of [...this.subscribers]) {
            const target = webContents.fromId(senderId)
            if (!target || target.isDestroyed()) {
                this.subscribers.delete(senderId)
                continue
            }
            target.send(ASSISTANT_IPC.eventStream, payload)
        }
    }

    private updateLatestTurnAssistantMessage(sessionId: string, threadId: string, assistantMessageId: string, occurredAt: string) {
        const thread = this.requireThread(threadId)
        if (!thread.latestTurn) return
        this.appendEvent('thread.latest-turn.updated', occurredAt, {
            threadId,
            latestTurn: {
                ...thread.latestTurn,
                assistantMessageId
            }
        }, sessionId, threadId)
    }

    private ensureSession() {
        const selected = this.getSelectedSession()
        if (selected) return selected
        const createdAt = nowIso()
        const thread = this.createThread(createdAt)
        const session: AssistantSession = {
            id: createAssistantId('assistant-session'),
            title: 'New Session',
            projectPath: null,
            archived: false,
            createdAt,
            updatedAt: createdAt,
            activeThreadId: thread.id,
            threadIds: [thread.id],
            threads: [thread]
        }
        this.appendEvent('session.created', createdAt, { session }, session.id, thread.id)
        return this.requireSession(session.id)
    }

    private createThread(createdAt: string, previousThread?: AssistantThread | null): AssistantThread {
        return {
            id: createAssistantId('assistant-thread'),
            providerThreadId: null,
            model: previousThread?.model || '',
            cwd: previousThread?.cwd || null,
            runtimeMode: previousThread?.runtimeMode || 'approval-required',
            interactionMode: previousThread?.interactionMode || 'default',
            state: 'idle',
            lastError: null,
            createdAt,
            updatedAt: createdAt,
            latestTurn: null,
            activePlan: null,
            messages: [],
            proposedPlans: [],
            activities: [],
            pendingApprovals: [],
            pendingUserInputs: []
        }
    }

    private getSelectedSession() {
        return this.state.snapshot.sessions.find((session) => session.id === this.state.snapshot.selectedSessionId) || null
    }

    private requireSession(sessionId?: string) {
        const targetId = sessionId || this.state.snapshot.selectedSessionId
        const session = this.state.snapshot.sessions.find((entry) => entry.id === targetId) || null
        if (!session) throw new Error('Assistant session not found.')
        return session
    }

    private getActiveThread(session: AssistantSession | null) {
        if (!session?.activeThreadId) return null
        return session.threads.find((thread) => thread.id === session.activeThreadId) || null
    }

    private requireActiveThread(session: AssistantSession) {
        const thread = this.getActiveThread(session)
        if (!thread) throw new Error('Assistant session has no active thread.')
        return thread
    }

    private requireThread(threadId: string) {
        const session = this.findSessionByThreadId(threadId)
        const thread = session?.threads.find((entry) => entry.id === threadId) || null
        if (!thread) throw new Error(`Assistant thread ${threadId} was not found.`)
        return thread
    }

    private findSessionByThreadId(threadId: string) {
        return this.state.snapshot.sessions.find((session) => session.threads.some((thread) => thread.id === threadId)) || null
    }

    private findThreadForApproval(requestId: string) {
        for (const session of this.state.snapshot.sessions) {
            const thread = session.threads.find((entry) => entry.pendingApprovals.some((approval) => approval.requestId === requestId && approval.status === 'pending'))
            if (thread) return { session, thread }
        }
        return null
    }

    private findThreadForUserInput(requestId: string) {
        for (const session of this.state.snapshot.sessions) {
            const thread = session.threads.find((entry) => entry.pendingUserInputs.some((item) => item.requestId === requestId && item.status === 'pending'))
            if (thread) return { session, thread }
        }
        return null
    }
}
