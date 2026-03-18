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
    AssistantRuntimeStatus,
    AssistantSendPromptOptions,
    AssistantSession,
    AssistantThread
} from '../../shared/assistant/contracts'
import { ASSISTANT_IPC } from '../../shared/assistant/contracts'
import { CodexAppServerRuntime } from './codex-app-server'
import { AssistantPersistence } from './persistence'
import { applyDomainEvent, createDefaultSnapshot } from './projector'
import { handleAssistantRuntimeEvent } from './service-runtime-events'
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

    getSnapshot() {
        return structuredClone(this.state.snapshot)
    }
    async getStatus(): Promise<AssistantRuntimeStatus> {
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
        const models = await this.runtime.listModels(forceRefresh)
        this.state.snapshot.knownModels = models
        this.persist()
        return { success: true as const, models }
    }

    async connect(options?: AssistantConnectOptions) {
        const session = options?.sessionId
            ? requireSession(this.state.snapshot, options.sessionId)
            : getSelectedSession(this.state.snapshot) || this.ensureSession()
        const thread = requireActiveThread(session)
        await this.runtime.connect(thread, session.projectPath || process.cwd())
        return { success: true as const, threadId: thread.id }
    }

    disconnect(sessionId?: string) {
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

    createSession(title?: string, projectPath?: string) {
        const createdAt = nowIso()
        const sessionId = createAssistantId('assistant-session')
        const thread = createAssistantThread(createdAt, null, projectPath || null)
        const session: AssistantSession = {
            id: sessionId,
            title: title?.trim() || 'New Session',
            projectPath: projectPath?.trim() || null,
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
        requireSession(this.state.snapshot, sessionId)
        this.appendEvent('session.selected', nowIso(), { sessionId }, sessionId)
        return { success: true as const, sessionId }
    }

    renameSession(sessionId: string, title: string) {
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

    archiveSession(sessionId: string, archived = true) {
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

    deleteSession(sessionId: string) {
        const session = requireSession(this.state.snapshot, sessionId)
        const thread = getActiveThread(session)
        if (thread) {
            this.runtime.disconnect(thread.id)
        }
        this.appendEvent('session.deleted', nowIso(), { sessionId }, sessionId)
        return { success: true as const }
    }
    clearLogs(input?: AssistantClearLogsInput) {
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
        const session = input?.sessionId
            ? requireSession(this.state.snapshot, input.sessionId)
            : requireSession(this.state.snapshot, this.state.snapshot.selectedSessionId || '')
        const thread = requireActiveThread(session)
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
    newThread(sessionId?: string) {
        const session = sessionId
            ? requireSession(this.state.snapshot, sessionId)
            : getSelectedSession(this.state.snapshot) || this.ensureSession()
        const previousThread = getActiveThread(session)
        if (previousThread) {
            this.runtime.disconnect(previousThread.id)
        }

        const createdAt = nowIso()
        const thread = createAssistantThread(createdAt, previousThread)
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

        const session = options?.sessionId
            ? requireSession(this.state.snapshot, options.sessionId)
            : this.ensureSession()
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
        const session = requireSession(this.state.snapshot, sessionId)
        const thread = requireActiveThread(session)
        const effectiveTurnId = turnId || thread.latestTurn?.id
        if (effectiveTurnId) {
            await this.runtime.interruptTurn(thread.id, effectiveTurnId)
        }
        return { success: true as const }
    }

    async respondApproval(input: { requestId: string; decision: 'acceptForSession' | 'decline' }) {
        const target = findThreadForApproval(this.state.snapshot, input.requestId)
        if (!target) throw new Error(`Unknown approval request ${input.requestId}.`)
        await this.runtime.respondApproval(target.thread.id, input.requestId, input.decision)
        return { success: true as const }
    }

    async respondUserInput(input: { requestId: string; answers: Record<string, string | string[]> }) {
        const target = findThreadForUserInput(this.state.snapshot, input.requestId)
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

    private handleRuntimeEvent(event: Parameters<typeof handleAssistantRuntimeEvent>[0]) {
        handleAssistantRuntimeEvent(event, {
            planBuffers: this.planBuffers,
            findSessionByThreadId: (threadId) => findSessionByThreadId(this.state.snapshot, threadId),
            requireThread: (threadId) => requireThread(this.state.snapshot, threadId),
            appendEvent: (type, occurredAt, payload, sessionId, threadId) => this.appendEvent(type, occurredAt, payload, sessionId, threadId),
            updateLatestTurnAssistantMessage: (sessionId, threadId, assistantMessageId, occurredAt) => {
                this.updateLatestTurnAssistantMessage(sessionId, threadId, assistantMessageId, occurredAt)
            }
        })
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
        const thread = requireThread(this.state.snapshot, threadId)
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
        const selected = getSelectedSession(this.state.snapshot)
        if (selected) return selected

        const createdAt = nowIso()
        const thread = createAssistantThread(createdAt)
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
        return requireSession(this.state.snapshot, session.id)
    }
}
