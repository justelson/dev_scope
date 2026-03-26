import { app } from 'electron'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import log from 'electron-log'
import type {
    AssistantAccountOverview,
    AssistantApprovePendingPlaygroundLabRequestInput,
    AssistantAttachSessionToPlaygroundLabInput,
    AssistantClearLogsInput,
    AssistantConnectOptions,
    AssistantCreatePlaygroundLabInput,
    AssistantCreateSessionInput,
    AssistantDeclinePendingPlaygroundLabRequestInput,
    AssistantDeleteMessageInput,
    AssistantDomainEvent,
    AssistantGetSessionTurnUsageInput,
    AssistantLatestTurn,
    AssistantMessage,
    AssistantRuntimeStatus,
    AssistantSendPromptOptions,
    AssistantSessionTurnUsagePayload,
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
    createPlaygroundLabRecord,
    derivePlaygroundLabTitle,
    ensurePlaygroundLabExists
} from './playground-service'
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

    async getSessionTurnUsage(input?: AssistantGetSessionTurnUsageInput) {
        await this.ensureReady()
        const session = input?.sessionId
            ? requireSession(this.state.snapshot, input.sessionId)
            : requireSession(this.state.snapshot, this.state.snapshot.selectedSessionId || '')
        const persistedTurns = await this.persistence.readSessionTurnUsage(session.id)
        const turnMap = new Map(persistedTurns.map((turn) => [turn.id, turn]))
        for (const thread of session.threads) {
            if (!thread.latestTurn) continue
            turnMap.set(thread.latestTurn.id, {
                id: thread.latestTurn.id,
                sessionId: session.id,
                threadId: thread.id,
                model: thread.model,
                state: thread.latestTurn.state,
                requestedAt: thread.latestTurn.requestedAt,
                startedAt: thread.latestTurn.startedAt,
                completedAt: thread.latestTurn.completedAt,
                assistantMessageId: thread.latestTurn.assistantMessageId,
                effort: thread.latestTurn.effort,
                serviceTier: thread.latestTurn.serviceTier,
                usage: thread.latestTurn.usage || null,
                updatedAt: thread.latestTurn.completedAt || thread.latestTurn.startedAt || thread.latestTurn.requestedAt
            })
        }
        const usage: AssistantSessionTurnUsagePayload = {
            sessionId: session.id,
            turns: [...turnMap.values()].sort((left, right) => left.requestedAt.localeCompare(right.requestedAt) || left.id.localeCompare(right.id)),
            fetchedAt: nowIso()
        }
        return { success: true as const, usage }
    }

    async connect(options?: AssistantConnectOptions) {
        await this.ensureReady()
        const session = options?.sessionId
            ? requireSession(this.state.snapshot, options.sessionId)
            : getSelectedSession(this.state.snapshot) || ensureAssistantSession(this.state.snapshot, (type, occurredAt, payload, sessionId, threadId) => {
                this.appendEvent(type, occurredAt, payload, sessionId, threadId)
            })
        const thread = requireActiveThread(session)
        await this.runtime.connect(thread, this.getSessionRuntimeCwd(session, thread))
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

    async createSession(input?: AssistantCreateSessionInput) {
        await this.ensureReady()
        const createdAt = nowIso()
        const sessionId = createAssistantId('assistant-session')
        const mode = input?.mode === 'playground' ? 'playground' : 'work'
        const playgroundLabId = mode === 'playground' ? input?.playgroundLabId || null : null
        const playgroundLab = playgroundLabId ? ensurePlaygroundLabExists(this.state.snapshot.playground.labs, playgroundLabId) : null
        const projectPath = mode === 'playground'
            ? (playgroundLab?.rootPath || null)
            : (input?.projectPath?.trim() || null)
        const thread = createAssistantThread(createdAt, null, projectPath || null)
        const session = createAssistantSessionRecord({
            sessionId,
            title: input?.title?.trim() || (mode === 'playground' ? 'New Playground Chat' : 'New Session'),
            mode,
            projectPath,
            playgroundLabId,
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
            patch: deletePlan.patch,
            removedTurnIds: deletePlan.removedTurnIds
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
                playgroundLabId: null,
                pendingLabRequest: null,
                updatedAt: nowIso()
            }
        }, sessionId)
        return { success: true as const }
    }

    async setPlaygroundRoot(input: { rootPath: string | null }) {
        await this.ensureReady()
        const rootPath = sanitizeOptionalPath(input.rootPath)
        this.appendEvent('playground.updated', nowIso(), {
            playground: {
                ...this.state.snapshot.playground,
                rootPath
            }
        })
        return { success: true as const, playground: structuredClone(this.state.snapshot.playground) }
    }

    async createPlaygroundLab(input: AssistantCreatePlaygroundLabInput) {
        await this.ensureReady()
        const rootPath = this.state.snapshot.playground.rootPath
        if (!rootPath) throw new Error('Choose a Playground root first.')

        const lab = await createPlaygroundLabRecord({
            rootPath,
            title: input.title,
            source: input.source,
            repoUrl: input.repoUrl,
            existingFolderPath: input.existingFolderPath
        })
        const nextPlayground = {
            ...this.state.snapshot.playground,
            labs: [lab, ...this.state.snapshot.playground.labs]
        }
        const occurredAt = nowIso()
        this.appendEvent('playground.updated', occurredAt, { playground: nextPlayground })

        let sessionId: string | null = null
        if (input.openSession) {
            const created = await this.createSession({
                title: lab.title,
                mode: 'playground',
                playgroundLabId: lab.id
            })
            sessionId = created.sessionId
        }

        return {
            success: true as const,
            labId: lab.id,
            sessionId,
            playground: structuredClone(this.state.snapshot.playground)
        }
    }

    async attachSessionToPlaygroundLab(input: AssistantAttachSessionToPlaygroundLabInput) {
        await this.ensureReady()
        const session = requireSession(this.state.snapshot, input.sessionId)
        const lab = ensurePlaygroundLabExists(this.state.snapshot.playground.labs, input.labId)
        this.appendEvent('session.updated', nowIso(), {
            sessionId: session.id,
            patch: {
                mode: 'playground',
                projectPath: lab.rootPath,
                playgroundLabId: lab.id,
                pendingLabRequest: null,
                updatedAt: nowIso()
            }
        }, session.id, session.activeThreadId || undefined)
        return { success: true as const, playground: structuredClone(this.state.snapshot.playground) }
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
        const labRequest = this.maybeBuildPendingPlaygroundLabRequest(session, input)
        if (labRequest) {
            const occurredAt = nowIso()
            this.appendEvent('session.updated', occurredAt, {
                sessionId: session.id,
                patch: {
                    pendingLabRequest: labRequest,
                    updatedAt: occurredAt
                }
            }, session.id, thread.id)
            this.appendEvent('thread.activity.appended', occurredAt, {
                threadId: thread.id,
                activity: {
                    id: createAssistantId('assistant-activity'),
                    kind: 'playground.lab-requested',
                    tone: 'info',
                    summary: labRequest.kind === 'clone-repo' ? 'Playground repo clone requested' : 'Playground lab requested',
                    detail: labRequest.kind === 'clone-repo'
                        ? `Approve creating a Playground lab by cloning ${labRequest.repoUrl || 'the provided repository'}.`
                        : 'Approve creating a Playground lab before filesystem work continues.',
                    turnId: null,
                    createdAt: occurredAt,
                    payload: {
                        requestId: labRequest.id,
                        kind: labRequest.kind,
                        repoUrl: labRequest.repoUrl,
                        suggestedLabName: labRequest.suggestedLabName
                    }
                }
            }, session.id, thread.id)
            return { success: true as const, sessionId: session.id, threadId: thread.id, turnId: labRequest.id }
        }

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

        const runtimeCwd = this.getSessionRuntimeCwd(session, thread)
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

    async approvePendingPlaygroundLabRequest(input: AssistantApprovePendingPlaygroundLabRequestInput) {
        await this.ensureReady()
        const session = requireSession(this.state.snapshot, input.sessionId)
        const pendingLabRequest = session.pendingLabRequest
        if (!pendingLabRequest) throw new Error('There is no pending Playground lab request for this chat.')

        const result = await this.createPlaygroundLab({
            title: input.title || pendingLabRequest.suggestedLabName,
            source: input.source,
            repoUrl: input.repoUrl || pendingLabRequest.repoUrl || undefined,
            openSession: false
        })
        const lab = ensurePlaygroundLabExists(this.state.snapshot.playground.labs, result.labId)
        this.appendEvent('session.updated', nowIso(), {
            sessionId: session.id,
            patch: {
                mode: 'playground',
                projectPath: lab.rootPath,
                playgroundLabId: lab.id,
                pendingLabRequest: null,
                updatedAt: nowIso()
            }
        }, session.id, session.activeThreadId || undefined)
        await this.sendPrompt(pendingLabRequest.prompt, { sessionId: session.id })
        return {
            success: true as const,
            sessionId: session.id,
            labId: lab.id,
            playground: structuredClone(this.state.snapshot.playground)
        }
    }

    async declinePendingPlaygroundLabRequest(input: AssistantDeclinePendingPlaygroundLabRequestInput) {
        await this.ensureReady()
        const session = requireSession(this.state.snapshot, input.sessionId)
        if (!session.pendingLabRequest) return { success: true as const }
        const thread = requireActiveThread(session)
        const occurredAt = nowIso()
        this.appendEvent('session.updated', occurredAt, {
            sessionId: session.id,
            patch: {
                pendingLabRequest: null,
                updatedAt: occurredAt
            }
        }, session.id, thread.id)
        this.appendEvent('thread.activity.appended', occurredAt, {
            threadId: thread.id,
            activity: {
                id: createAssistantId('assistant-activity'),
                kind: 'playground.lab-request.declined',
                tone: 'warning',
                summary: 'Playground lab request declined',
                detail: 'The assistant cannot continue filesystem work for this Playground chat without a lab.',
                turnId: null,
                createdAt: occurredAt
            }
        }, session.id, thread.id)
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

    private getSessionRuntimeCwd(session: ReturnType<typeof requireSession>, thread: AssistantThread): string {
        if (session.mode === 'playground') {
            return sanitizeOptionalPath(session.projectPath)
                || sanitizeOptionalPath(thread.cwd)
                || this.getDetachedPlaygroundChatRoot()
        }
        return session.projectPath || thread.cwd || process.cwd()
    }

    private getDetachedPlaygroundChatRoot(): string {
        const rootPath = join(app.getPath('userData'), 'assistant', 'playground-chat-only')
        mkdirSync(rootPath, { recursive: true })
        return rootPath
    }

    private maybeBuildPendingPlaygroundLabRequest(session: ReturnType<typeof requireSession>, prompt: string) {
        if (session.mode !== 'playground') return null
        if (session.playgroundLabId || sanitizeOptionalPath(session.projectPath)) return null
        if (session.pendingLabRequest) return null

        const repoUrlMatch = prompt.match(/https?:\/\/[^\s]+(?:\.git)?/i)
        const repoUrl = repoUrlMatch ? repoUrlMatch[0] : null
        const needsWorkspace = repoUrl
            || /\b(create|build|make|scaffold|generate|implement|code|repo|repository|project|app|workspace|files?)\b/i.test(prompt)

        if (!needsWorkspace) return null

        return {
            id: createAssistantId('assistant-playground-lab-request'),
            kind: repoUrl ? 'clone-repo' as const : 'create-empty' as const,
            prompt,
            suggestedLabName: derivePlaygroundLabTitle(undefined, repoUrl, undefined),
            repoUrl,
            createdAt: nowIso()
        }
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
