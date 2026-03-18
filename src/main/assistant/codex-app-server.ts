import { spawn, spawnSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { EventEmitter } from 'node:events'
import readline from 'node:readline'
import log from 'electron-log'
import type {
    AssistantApprovalDecision,
    AssistantInteractionMode,
    AssistantModelInfo,
    AssistantRuntimeEvent,
    AssistantRuntimeMode,
    AssistantThread
} from '../../shared/assistant/contracts'
import { handleResponse, handleStdoutLine } from './codex-runtime-events'
import {
    asRecord,
    asString,
    buildTurnParams,
    killChildTree,
    mapRuntimeMode,
    type JsonRpcMessage,
    type SessionContext
} from './codex-runtime-protocol'

export class CodexAppServerRuntime extends EventEmitter {
    private readonly sessions = new Map<string, SessionContext>()
    private readonly codexBinary = process.platform === 'win32' ? 'codex.cmd' : 'codex'
    private modelCache: AssistantModelInfo[] = []
    private modelCacheLoaded = false
    private modelListPromise: Promise<AssistantModelInfo[]> | null = null
    private availability: { available: boolean; reason: string | null } | null = null

    async checkAvailability(): Promise<{ available: boolean; reason: string | null }> {
        if (this.availability) return this.availability
        try {
            const result = spawnSync(this.codexBinary, ['--version'], {
                shell: process.platform === 'win32',
                stdio: ['ignore', 'pipe', 'pipe'],
                encoding: 'utf8',
                timeout: 4000
            })
            if (result.status === 0) {
                this.availability = { available: true, reason: null }
            } else {
                this.availability = {
                    available: false,
                    reason: (result.stderr || result.stdout || 'Codex CLI is unavailable.').trim()
                }
            }
        } catch (error) {
            this.availability = {
                available: false,
                reason: error instanceof Error ? error.message : 'Codex CLI is unavailable.'
            }
        }
        return this.availability
    }

    async listModels(forceRefresh = false): Promise<AssistantModelInfo[]> {
        if (!forceRefresh && this.modelCacheLoaded && this.modelCache.length > 0) return this.modelCache
        if (this.modelListPromise) return this.modelListPromise

        this.modelListPromise = (async () => {
            const session = this.sessions.values().next().value as SessionContext | undefined
            try {
                const response = session
                    ? await this.sendRequest<any>(session, 'model/list', {}, 8000)
                    : await this.listModelsFromEphemeralServer()
                const models = Array.isArray(response?.data)
                    ? response.data
                    : Array.isArray(response?.models)
                        ? response.models
                        : Array.isArray(response)
                            ? response
                            : []
                const parsed = models
                    .map((entry: unknown) => {
                        const record = asRecord(entry)
                        const id = asString(record?.['model']) || asString(record?.['id']) || asString(entry)
                        if (!id) return null
                        return {
                            id,
                            label: asString(record?.['displayName']) || asString(record?.['title']) || id,
                            description: asString(record?.['description'])
                        } satisfies AssistantModelInfo
                    })
                    .filter((entry: AssistantModelInfo | null): entry is AssistantModelInfo => Boolean(entry))
                if (parsed.length > 0) {
                    this.modelCache = parsed
                    this.modelCacheLoaded = true
                }
            } catch (error) {
                log.warn('[Assistant] model/list failed', error)
            } finally {
                this.modelListPromise = null
            }
            return this.modelCache
        })()

        return this.modelListPromise
    }

    private async listModelsFromEphemeralServer(): Promise<Record<string, unknown>> {
        const child = spawn(this.codexBinary, ['app-server'], {
            cwd: process.cwd(),
            shell: process.platform === 'win32',
            stdio: ['pipe', 'pipe', 'pipe']
        })
        const output = readline.createInterface({ input: child.stdout })
        const context: SessionContext = {
            child,
            output,
            pending: new Map(),
            pendingApprovals: new Map(),
            pendingUserInputs: new Map(),
            nextRequestId: 1,
            stopping: false,
            thread: {
                id: '__ephemeral-model-list__',
                providerThreadId: null,
                model: this.modelCache[0]?.id || '',
                cwd: process.cwd(),
                runtimeMode: 'approval-required',
                interactionMode: 'default',
                state: 'starting',
                lastError: null,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                latestTurn: null,
                activePlan: null,
                messages: [],
                proposedPlans: [],
                activities: [],
                pendingApprovals: [],
                pendingUserInputs: []
            }
        }

        output.on('line', (line) => {
            try {
                const parsed = JSON.parse(line) as JsonRpcMessage
                if (parsed['id'] !== undefined && parsed['method'] === undefined) {
                    handleResponse(context, parsed)
                }
            } catch {
                // Ignore malformed lines from ephemeral model discovery.
            }
        })

        try {
            await this.sendRequest(context, 'initialize', {
                clientInfo: {
                    name: 'devscope_air',
                    title: 'DevScope Air',
                    version: '0.1.0'
                },
                capabilities: {
                    experimentalApi: true
                }
            }, 8000)
            this.writeMessage(context, { method: 'initialized' })
            return await this.sendRequest<Record<string, unknown>>(context, 'model/list', {}, 8000)
        } finally {
            for (const pending of context.pending.values()) {
                clearTimeout(pending.timer)
            }
            context.pending.clear()
            output.close()
            if (!child.killed) {
                killChildTree(child)
            }
        }
    }

    async connect(thread: AssistantThread, cwd: string): Promise<void> {
        if (this.sessions.has(thread.id)) return

        const availability = await this.checkAvailability()
        if (!availability.available) {
            throw new Error(availability.reason || 'Codex CLI is unavailable.')
        }

        this.emitRuntime({
            eventId: randomUUID(),
            type: 'session.state.changed',
            createdAt: new Date().toISOString(),
            threadId: thread.id,
            payload: { state: 'starting', message: 'Starting codex app-server' }
        })

        const child = spawn(this.codexBinary, ['app-server'], {
            cwd,
            shell: process.platform === 'win32',
            stdio: ['pipe', 'pipe', 'pipe']
        })
        const output = readline.createInterface({ input: child.stdout })
        const context: SessionContext = {
            child,
            output,
            pending: new Map(),
            pendingApprovals: new Map(),
            pendingUserInputs: new Map(),
            nextRequestId: 1,
            stopping: false,
            thread: { ...thread, cwd }
        }

        this.sessions.set(thread.id, context)
        this.attachProcessListeners(context)

        this.emitRuntime({
            eventId: randomUUID(),
            type: 'session.started',
            createdAt: new Date().toISOString(),
            threadId: thread.id,
            payload: {
                cwd,
                model: thread.model,
                runtimeMode: thread.runtimeMode,
                interactionMode: thread.interactionMode
            }
        })

        await this.sendRequest(context, 'initialize', {
            clientInfo: {
                name: 'devscope_air',
                title: 'DevScope Air',
                version: '0.1.0'
            },
            capabilities: {
                experimentalApi: true
            }
        })
        this.writeMessage(context, { method: 'initialized' })
        void this.listModels(true)

        const sessionOverrides = {
            cwd,
            model: thread.model,
            ...mapRuntimeMode(thread.runtimeMode)
        }

        let response: Record<string, unknown> | undefined
        if (thread.providerThreadId) {
            try {
                response = await this.sendRequest<Record<string, unknown>>(context, 'thread/resume', {
                    ...sessionOverrides,
                    threadId: thread.providerThreadId
                })
            } catch (error) {
                log.warn('[Assistant] thread/resume failed, falling back to thread/start', error)
            }
        }
        if (!response) {
            response = await this.sendRequest<Record<string, unknown>>(context, 'thread/start', sessionOverrides)
        }

        const providerThreadId = asString(asRecord(response?.['thread'])?.['id']) || asString(response?.['threadId'])
        if (!providerThreadId) {
            throw new Error('Codex thread open response did not include a thread id.')
        }

        context.thread.providerThreadId = providerThreadId
        this.emitRuntime({
            eventId: randomUUID(),
            type: 'thread.started',
            createdAt: new Date().toISOString(),
            threadId: thread.id,
            providerThreadId,
            payload: { providerThreadId }
        })
        this.emitRuntime({
            eventId: randomUUID(),
            type: 'session.state.changed',
            createdAt: new Date().toISOString(),
            threadId: thread.id,
            providerThreadId,
            payload: { state: 'ready', message: `Connected to thread ${providerThreadId}` }
        })
    }

    async sendPrompt(
        threadId: string,
        prompt: string,
        options?: {
            model?: string
            runtimeMode?: AssistantRuntimeMode
            interactionMode?: AssistantInteractionMode
            effort?: 'low' | 'medium' | 'high' | 'xhigh'
            serviceTier?: 'fast'
        }
    ): Promise<{ turnId: string; providerThreadId: string | null }> {
        const context = this.requireSession(threadId)
        if (!context.thread.providerThreadId) {
            throw new Error('Assistant thread is not connected.')
        }

        const response = await this.sendRequest<Record<string, unknown>>(
            context,
            'turn/start',
            buildTurnParams(
                context.thread,
                prompt,
                options?.model,
                options?.runtimeMode,
                options?.interactionMode,
                options?.effort,
                options?.serviceTier
            )
        )
        const turnId = asString(asRecord(response?.['turn'])?.['id']) || asString(response?.['turnId'])
        if (!turnId) {
            throw new Error('turn/start response did not include a turn id.')
        }

        context.thread = {
            ...context.thread,
            model: options?.model || context.thread.model,
            runtimeMode: options?.runtimeMode || context.thread.runtimeMode,
            interactionMode: options?.interactionMode || context.thread.interactionMode
        }
        return { turnId, providerThreadId: context.thread.providerThreadId }
    }

    async interruptTurn(threadId: string, turnId?: string): Promise<void> {
        const context = this.requireSession(threadId)
        if (!context.thread.providerThreadId || !turnId) return
        await this.sendRequest(context, 'turn/interrupt', {
            threadId: context.thread.providerThreadId,
            turnId
        }, 8000)
    }

    async rollbackThread(threadId: string, numTurns: number): Promise<void> {
        const context = this.requireSession(threadId)
        if (!context.thread.providerThreadId || numTurns < 1) return
        await this.sendRequest(context, 'thread/rollback', {
            threadId: context.thread.providerThreadId,
            numTurns
        }, 15000)
    }

    async respondApproval(threadId: string, requestId: string, decision: AssistantApprovalDecision): Promise<void> {
        const context = this.requireSession(threadId)
        const pending = context.pendingApprovals.get(requestId)
        if (!pending) throw new Error(`Unknown approval request: ${requestId}`)

        context.pendingApprovals.delete(requestId)
        this.writeMessage(context, { id: pending.jsonRpcId, result: { decision } })
        this.emitRuntime({
            eventId: randomUUID(),
            type: 'approval.resolved',
            createdAt: new Date().toISOString(),
            threadId,
            turnId: pending.turnId,
            itemId: pending.itemId,
            requestId,
            payload: { decision }
        })
    }

    async respondUserInput(threadId: string, requestId: string, answers: Record<string, string | string[]>): Promise<void> {
        const context = this.requireSession(threadId)
        const pending = context.pendingUserInputs.get(requestId)
        if (!pending) throw new Error(`Unknown user-input request: ${requestId}`)

        context.pendingUserInputs.delete(requestId)
        this.writeMessage(context, { id: pending.jsonRpcId, result: { answers } })
        this.emitRuntime({
            eventId: randomUUID(),
            type: 'user-input.resolved',
            createdAt: new Date().toISOString(),
            threadId,
            turnId: pending.turnId,
            itemId: pending.itemId,
            requestId,
            payload: { answers }
        })
    }

    disconnect(threadId: string): void {
        const context = this.sessions.get(threadId)
        if (!context) return

        context.stopping = true
        for (const pending of context.pending.values()) {
            clearTimeout(pending.timer)
            pending.reject(new Error('Codex session stopped before request completed.'))
        }
        context.pending.clear()
        context.pendingApprovals.clear()
        context.pendingUserInputs.clear()
        context.output.close()
        if (!context.child.killed) {
            killChildTree(context.child)
        }
        this.sessions.delete(threadId)
        this.emitRuntime({
            eventId: randomUUID(),
            type: 'session.state.changed',
            createdAt: new Date().toISOString(),
            threadId,
            payload: { state: 'stopped', message: 'Session disconnected.' }
        })
    }

    dispose(): void {
        for (const threadId of [...this.sessions.keys()]) {
            this.disconnect(threadId)
        }
    }

    private attachProcessListeners(context: SessionContext): void {
        context.output.on('line', (line) => handleStdoutLine(context, line, {
            emitRuntime: (event) => this.emitRuntime(event),
            writeMessage: (targetContext, message) => this.writeMessage(targetContext, message)
        }))
        context.child.stderr.on('data', (chunk) => {
            const message = String(chunk || '').trim()
            if (!message) return
            this.emitRuntime({
                eventId: randomUUID(),
                type: 'activity',
                createdAt: new Date().toISOString(),
                threadId: context.thread.id,
                payload: { kind: 'process.stderr', summary: 'Codex stderr', detail: message, tone: 'warning' }
            })
        })
        context.child.on('error', (error) => {
            this.emitRuntime({
                eventId: randomUUID(),
                type: 'session.state.changed',
                createdAt: new Date().toISOString(),
                threadId: context.thread.id,
                payload: { state: 'error', error: error.message, message: error.message }
            })
        })
        context.child.on('exit', (code, signal) => {
            if (context.stopping) return
            this.sessions.delete(context.thread.id)
            this.emitRuntime({
                eventId: randomUUID(),
                type: 'session.state.changed',
                createdAt: new Date().toISOString(),
                threadId: context.thread.id,
                payload: {
                    state: code === 0 ? 'stopped' : 'error',
                    message: `codex app-server exited (code=${code ?? 'null'}, signal=${signal ?? 'null'}).`
                }
            })
        })
    }

    private async sendRequest<T>(context: SessionContext, method: string, params: Record<string, unknown>, timeoutMs = 20000): Promise<T> {
        const id = context.nextRequestId++
        const result = await new Promise<unknown>((resolve, reject) => {
            const timer = setTimeout(() => {
                context.pending.delete(String(id))
                reject(new Error(`Timed out waiting for ${method}.`))
            }, timeoutMs)
            context.pending.set(String(id), { method, timer, resolve, reject })
            this.writeMessage(context, { id, method, params })
        })
        return result as T
    }

    private writeMessage(context: SessionContext, message: Record<string, unknown>): void {
        if (!context.child.stdin.writable) {
            throw new Error('Cannot write to codex app-server stdin.')
        }
        context.child.stdin.write(`${JSON.stringify(message)}\n`)
    }

    private requireSession(threadId: string): SessionContext {
        const session = this.sessions.get(threadId)
        if (!session) throw new Error(`Unknown assistant runtime session for thread ${threadId}.`)
        return session
    }

    private emitRuntime(event: AssistantRuntimeEvent): void {
        this.emit('runtime', event)
    }
}
