import { spawn, spawnSync, type ChildProcessWithoutNullStreams } from 'node:child_process'
import { EventEmitter } from 'node:events'
import { randomUUID } from 'node:crypto'
import readline from 'node:readline'
import log from 'electron-log'
import type {
    AssistantApprovalDecision,
    AssistantApprovalRequestType,
    AssistantConnectOptions,
    AssistantInteractionMode,
    AssistantModelInfo,
    AssistantRuntimeEvent,
    AssistantRuntimeMode,
    AssistantThread,
    AssistantTurnUsage
} from '../../shared/assistant/contracts'

type JsonRpcId = string | number
type JsonRpcMessage = Record<string, unknown>

interface PendingRpc {
    method: string
    timer: NodeJS.Timeout
    resolve: (value: unknown) => void
    reject: (error: Error) => void
}

interface PendingApprovalRequest {
    requestId: string
    jsonRpcId: JsonRpcId
    requestType: AssistantApprovalRequestType
    threadId: string
    turnId?: string
    itemId?: string
}

interface PendingUserInputRequest {
    requestId: string
    jsonRpcId: JsonRpcId
    threadId: string
    turnId?: string
    itemId?: string
}

interface SessionContext {
    child: ChildProcessWithoutNullStreams
    output: readline.Interface
    pending: Map<string, PendingRpc>
    pendingApprovals: Map<string, PendingApprovalRequest>
    pendingUserInputs: Map<string, PendingUserInputRequest>
    nextRequestId: number
    stopping: boolean
    thread: AssistantThread
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
    return value && typeof value === 'object' ? value as Record<string, unknown> : undefined
}

function asString(value: unknown): string | undefined {
    return typeof value === 'string' ? value : undefined
}

function normalizeItemType(value: unknown): string {
    return String(value || '')
        .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
        .replace(/[._/-]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase()
}

function readTextValue(value: unknown): string | undefined {
    if (typeof value === 'string') {
        const trimmed = value.trim()
        return trimmed || undefined
    }
    if (Array.isArray(value)) {
        const combined = value
            .map((entry) => readTextValue(entry))
            .filter((entry): entry is string => Boolean(entry))
            .join('\n')
            .trim()
        return combined || undefined
    }
    const record = asRecord(value)
    if (!record) return undefined
    return readTextValue(
        record['text']
        ?? record['value']
        ?? record['message']
        ?? record['content']
        ?? record['parts']
        ?? record['output']
    )
}

function readStringArray(value: unknown): string[] {
    if (typeof value === 'string') {
        const trimmed = value.trim()
        return trimmed ? [trimmed] : []
    }
    if (!Array.isArray(value)) return []
    return value
        .map((entry) => {
            if (typeof entry === 'string') return entry.trim()
            const record = asRecord(entry)
            return asString(record?.['path'])?.trim()
                || asString(record?.['filePath'])?.trim()
                || asString(record?.['targetPath'])?.trim()
                || asString(record?.['name'])?.trim()
                || ''
        })
        .filter((entry): entry is string => Boolean(entry))
}

function extractItemPaths(item: Record<string, unknown>): string[] {
    const candidates = [
        ...readStringArray(item['path']),
        ...readStringArray(item['filePath']),
        ...readStringArray(item['targetPath']),
        ...readStringArray(item['paths']),
        ...readStringArray(item['files'])
    ]
    return [...new Set(candidates)]
}

function readToolOutput(item: Record<string, unknown>): string | undefined {
    return readTextValue(item['stdout'])
        || readTextValue(item['stderr'])
        || readTextValue(item['output'])
        || readTextValue(item['result'])
        || readTextValue(asRecord(item['result'])?.['output'])
        || readTextValue(asRecord(item['result'])?.['stdout'])
        || readTextValue(asRecord(item['result'])?.['stderr'])
        || readTextValue(asRecord(item['response'])?.['output'])
        || readTextValue(asRecord(item['response'])?.['result'])
}

function readNumericValue(value: unknown): number | undefined {
    if (typeof value === 'number' && Number.isFinite(value)) return value
    if (typeof value === 'string') {
        const parsed = Number(value)
        if (Number.isFinite(parsed)) return parsed
    }
    return undefined
}

function readToolTiming(item: Record<string, unknown>) {
    const startedAt = asString(item['startedAt']) || asString(item['started_at']) || asString(item['startTime']) || asString(item['start_time'])
    const completedAt = asString(item['completedAt']) || asString(item['completed_at']) || asString(item['finishedAt']) || asString(item['finished_at']) || asString(item['endedAt']) || asString(item['ended_at'])
    const durationMs = readNumericValue(item['durationMs']) || readNumericValue(item['duration_ms']) || readNumericValue(item['elapsedMs']) || readNumericValue(item['elapsed_ms'])

    return {
        startedAt,
        completedAt,
        durationMs
    }
}

function readTurnUsage(turn: Record<string, unknown> | undefined, payload: Record<string, unknown>): AssistantTurnUsage | null {
    const usage = asRecord(turn?.['usage'])
        || asRecord(turn?.['tokenUsage'])
        || asRecord(payload['usage'])
        || asRecord(payload['tokenUsage'])

    const inputTokens = readNumericValue(usage?.['inputTokens'] ?? usage?.['input_tokens'])
    const outputTokens = readNumericValue(usage?.['outputTokens'] ?? usage?.['output_tokens'])
    const reasoningOutputTokens = readNumericValue(usage?.['reasoningOutputTokens'] ?? usage?.['reasoning_output_tokens'])
    const cachedInputTokens = readNumericValue(usage?.['cachedInputTokens'] ?? usage?.['cached_input_tokens'])
    const totalTokens = readNumericValue(usage?.['totalTokens'] ?? usage?.['total_tokens'])
    const modelContextWindow = readNumericValue(usage?.['modelContextWindow'] ?? usage?.['model_context_window'])

    if ([inputTokens, outputTokens, reasoningOutputTokens, cachedInputTokens, totalTokens, modelContextWindow].every((value) => value === undefined)) {
        return null
    }

    return {
        inputTokens: inputTokens ?? null,
        outputTokens: outputTokens ?? null,
        reasoningOutputTokens: reasoningOutputTokens ?? null,
        cachedInputTokens: cachedInputTokens ?? null,
        totalTokens: totalTokens ?? null,
        modelContextWindow: modelContextWindow ?? null
    }
}

function buildToolActivity(item: Record<string, unknown>, itemType: string):
    | {
        kind: string
        summary: string
        detail?: string
        tone: 'tool'
        data: Record<string, unknown>
    }
    | null {
    const command = readTextValue(item['command']) || readTextValue(asRecord(item['input'])?.['command'])
    const query = readTextValue(item['query']) || readTextValue(item['pattern']) || readTextValue(item['url'])
    const toolName = readTextValue(item['tool']) || readTextValue(item['name'])
    const paths = extractItemPaths(item)
    const output = readToolOutput(item)
    const timing = readToolTiming(item)
    const detail = readTextValue(item['detail'])
        || readTextValue(item['summary'])
        || readTextValue(item['description'])
        || readTextValue(item['message'])
        || readTextValue(item['text'])
        || readTextValue(item['content'])
        || output

    if (itemType.includes('file read') || (itemType.includes('file') && !itemType.includes('change') && paths.length > 0)) {
        return {
            kind: 'file-read',
            summary: paths.length > 1 ? 'Read files' : 'Read file',
            detail: paths.join('\n') || detail,
            tone: 'tool',
            data: { itemType, paths, startedAt: timing.startedAt, completedAt: timing.completedAt, durationMs: timing.durationMs }
        }
    }

    if (itemType.includes('file change') || itemType.includes('edit')) {
        return {
            kind: 'file-change',
            summary: paths.length > 1 ? 'Edited files' : 'Edited file',
            detail: paths.join('\n') || detail,
            tone: 'tool',
            data: { itemType, paths, startedAt: timing.startedAt, completedAt: timing.completedAt, durationMs: timing.durationMs }
        }
    }

    if (itemType.includes('search') || itemType.includes('web') || query) {
        return {
            kind: 'search',
            summary: 'Searched',
            detail: query || detail,
            tone: 'tool',
            data: {
                itemType,
                query,
                output: output && output !== query ? output : detail && detail !== query ? detail : undefined,
                startedAt: timing.startedAt,
                completedAt: timing.completedAt,
                durationMs: timing.durationMs
            }
        }
    }

    if (itemType.includes('command') || command) {
        return {
            kind: 'command',
            summary: 'Ran command',
            detail: command || detail,
            tone: 'tool',
            data: {
                itemType,
                command,
                paths,
                output: output && output !== command ? output : detail && detail !== command ? detail : undefined,
                startedAt: timing.startedAt,
                completedAt: timing.completedAt,
                durationMs: timing.durationMs
            }
        }
    }

    if (itemType.includes('tool') || itemType.includes('function') || toolName) {
        return {
            kind: 'tool',
            summary: 'Ran tool',
            detail: toolName || detail,
            tone: 'tool',
            data: {
                itemType,
                toolName,
                paths,
                output: output && output !== toolName ? output : detail && detail !== toolName ? detail : undefined,
                startedAt: timing.startedAt,
                completedAt: timing.completedAt,
                durationMs: timing.durationMs
            }
        }
    }

    return null
}

function isAssistantItemType(itemType: string): boolean {
    return itemType.includes('assistant')
        || itemType.includes('agent message')
        || itemType.includes('agentmessage')
        || itemType.includes('message')
}

function toUserInputQuestions(value: unknown) {
    const questions = Array.isArray(value) ? value : []
    return questions
        .map((entry) => {
            const record = asRecord(entry)
            const options = Array.isArray(record?.['options']) ? record['options'] : []
            const id = asString(record?.['id'])
            const header = asString(record?.['header'])
            const question = asString(record?.['question'])
            if (!id || !header || !question) return null
            return {
                id,
                header,
                question,
                options: options
                    .map((option) => {
                        const optionRecord = asRecord(option)
                        const label = asString(optionRecord?.['label'])
                        const description = asString(optionRecord?.['description'])
                        if (!label || !description) return null
                        return { label, description }
                    })
                    .filter((option): option is { label: string; description: string } => Boolean(option))
            }
        })
        .filter((question): question is {
            id: string
            header: string
            question: string
            options: Array<{ label: string; description: string }>
        } => Boolean(question))
}

function toApprovalRequestType(method: string): AssistantApprovalRequestType | undefined {
    if (method === 'item/commandExecution/requestApproval') return 'command'
    if (method === 'item/fileRead/requestApproval') return 'file-read'
    if (method === 'item/fileChange/requestApproval') return 'file-change'
    return undefined
}

function mapRuntimeMode(mode: AssistantRuntimeMode): { approvalPolicy: 'on-request' | 'never'; sandbox: 'workspace-write' | 'danger-full-access' } {
    if (mode === 'full-access') {
        return { approvalPolicy: 'never', sandbox: 'danger-full-access' }
    }
    return { approvalPolicy: 'on-request', sandbox: 'workspace-write' }
}

function killChildTree(child: ChildProcessWithoutNullStreams): void {
    if (process.platform === 'win32' && child.pid) {
        try {
            spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' })
            return
        } catch {
            // Fall through to direct kill.
        }
    }
    child.kill()
}

function buildTurnParams(
    thread: AssistantThread,
    prompt: string,
    model?: string,
    runtimeMode?: AssistantRuntimeMode,
    _interactionMode?: AssistantInteractionMode,
    effort?: 'low' | 'medium' | 'high' | 'xhigh',
    serviceTier?: 'fast'
) {
    const params: Record<string, unknown> = {
        threadId: thread.providerThreadId,
        input: [{ type: 'text', text: prompt }],
        approvalPolicy: mapRuntimeMode(runtimeMode || thread.runtimeMode).approvalPolicy
    }
    const effectiveModel = model || thread.model
    if (effectiveModel) params['model'] = effectiveModel
    if (effort) params['effort'] = effort
    if (serviceTier) params['serviceTier'] = serviceTier
    return params
}

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
                    this.handleResponse(context, parsed)
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
            buildTurnParams(context.thread, prompt, options?.model, options?.runtimeMode, options?.interactionMode, options?.effort, options?.serviceTier)
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
        context.output.on('line', (line) => this.handleStdoutLine(context, line))
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

    private handleStdoutLine(context: SessionContext, line: string): void {
        let parsed: JsonRpcMessage
        try {
            parsed = JSON.parse(line) as JsonRpcMessage
        } catch {
            return
        }
        if (parsed['id'] !== undefined && parsed['method'] !== undefined) {
            this.handleServerRequest(context, parsed)
            return
        }
        if (parsed['id'] !== undefined) {
            this.handleResponse(context, parsed)
            return
        }
        if (typeof parsed['method'] === 'string') {
            this.handleNotification(context, String(parsed['method']), asRecord(parsed['params']) || {})
        }
    }

    private handleServerRequest(context: SessionContext, message: JsonRpcMessage): void {
        const method = String(message['method'] || '')
        const requestType = toApprovalRequestType(method)
        const payload = asRecord(message['params']) || {}
        const requestId = randomUUID()
        const turnId = asString(payload['turnId']) || asString(asRecord(payload['turn'])?.['id'])
        const itemId = asString(payload['itemId']) || asString(asRecord(payload['item'])?.['id'])
        if (requestType) {
            const pending: PendingApprovalRequest = { requestId, jsonRpcId: message['id'] as JsonRpcId, requestType, threadId: context.thread.id, turnId, itemId }
            context.pendingApprovals.set(requestId, pending)
            this.emitRuntime({
                eventId: randomUUID(),
                type: 'approval.requested',
                createdAt: new Date().toISOString(),
                threadId: context.thread.id,
                turnId,
                itemId,
                requestId,
                payload: {
                    requestType,
                    title: asString(payload['title']),
                    detail: asString(payload['reason']) || asString(payload['detail']) || asString(payload['command']),
                    command: asString(payload['command']),
                    paths: Array.isArray(payload['paths']) ? payload['paths'].filter((entry): entry is string => typeof entry === 'string') : undefined
                }
            })
            return
        }
        if (method === 'item/tool/requestUserInput') {
            const questions = toUserInputQuestions(payload['questions'])
            context.pendingUserInputs.set(requestId, { requestId, jsonRpcId: message['id'] as JsonRpcId, threadId: context.thread.id, turnId, itemId })
            this.emitRuntime({
                eventId: randomUUID(),
                type: 'user-input.requested',
                createdAt: new Date().toISOString(),
                threadId: context.thread.id,
                turnId,
                itemId,
                requestId,
                payload: { questions }
            })
            return
        }
        this.writeMessage(context, {
            id: message['id'],
            error: {
                code: -32601,
                message: `Unsupported server request: ${method}`
            }
        })
    }

    private handleNotification(context: SessionContext, method: string, payload: Record<string, unknown>): void {
        const turnId = asString(payload['turnId']) || asString(asRecord(payload['turn'])?.['id'])
        const itemId = asString(payload['itemId']) || asString(asRecord(payload['item'])?.['id'])
        const eventBase = {
            eventId: randomUUID(),
            createdAt: new Date().toISOString(),
            threadId: context.thread.id,
            turnId,
            itemId,
            providerThreadId: context.thread.providerThreadId || undefined,
            rawMethod: method,
            rawPayload: payload
        }

        if (method === 'thread/started') {
            const providerThreadId = asString(asRecord(payload['thread'])?.['id']) || asString(payload['threadId'])
            if (providerThreadId) {
                context.thread.providerThreadId = providerThreadId
                this.emitRuntime({ ...eventBase, providerThreadId, type: 'thread.started', payload: { providerThreadId } })
            }
            return
        }
        if (method === 'turn/started') {
            const turn = asRecord(payload['turn'])
            const effort = turn?.['reasoningEffort'] === 'low' || turn?.['reasoningEffort'] === 'medium' || turn?.['reasoningEffort'] === 'high' || turn?.['reasoningEffort'] === 'xhigh'
                ? turn['reasoningEffort'] as 'low' | 'medium' | 'high' | 'xhigh'
                : undefined
            const serviceTier = asString(turn?.['serviceTier']) === 'fast' || asString(turn?.['serviceTier']) === 'flex'
                ? asString(turn?.['serviceTier']) as 'fast' | 'flex'
                : undefined
            this.emitRuntime({
                ...eventBase,
                type: 'turn.started',
                payload: {
                    model: asString(turn?.['model']),
                    interactionMode: context.thread.interactionMode,
                    ...(effort ? { effort } : {}),
                    ...(serviceTier ? { serviceTier } : {})
                } as any
            })
            this.emitRuntime({ ...eventBase, type: 'session.state.changed', payload: { state: 'running' } })
            return
        }
        if (method === 'turn/completed') {
            const turn = asRecord(payload['turn'])
            const status = asString(turn?.['status'])
            const errorMessage = asString(asRecord(turn?.['error'])?.['message'])
            const effortValue = asString(turn?.['reasoningEffort']) || asString(turn?.['reasoning_effort'])
            const effort = effortValue === 'low' || effortValue === 'medium' || effortValue === 'high' || effortValue === 'xhigh'
                ? effortValue
                : undefined
            const serviceTierValue = asString(turn?.['serviceTier']) || asString(turn?.['service_tier']) || asString(payload['serviceTier'])
            const serviceTier = serviceTierValue === 'fast' || serviceTierValue === 'flex' ? serviceTierValue : undefined
            const usage = readTurnUsage(turn, payload)
            const outcome = status === 'failed' ? 'failed' : status === 'interrupted' ? 'interrupted' : status === 'cancelled' ? 'cancelled' : 'completed'
            this.emitRuntime({ ...eventBase, type: 'turn.completed', payload: { outcome, errorMessage, effort, serviceTier, usage } })
            this.emitRuntime({ ...eventBase, type: 'session.state.changed', payload: { state: outcome === 'failed' ? 'error' : 'ready', error: errorMessage } })
            return
        }
        if (method === 'thread/tokenUsage/updated') {
            const tokenUsage = asRecord(payload['tokenUsage'])
            const lastUsage = asRecord(tokenUsage?.['last'])
            const usage = readTurnUsage(undefined, { tokenUsage: { ...lastUsage, modelContextWindow: tokenUsage?.['modelContextWindow'] } })
            if (usage) {
                this.emitRuntime({ ...eventBase, type: 'thread.token-usage.updated', payload: { usage } })
            }
            return
        }
        if (method === 'turn/plan/updated') {
            const rawSteps = Array.isArray(payload['plan']) ? payload['plan'] : []
            this.emitRuntime({
                ...eventBase,
                type: 'plan.updated',
                payload: {
                    explanation: asString(payload['explanation']),
                    plan: rawSteps.map((entry) => {
                        const step = asRecord(entry)
                        return {
                            step: asString(step?.['step']) || 'step',
                            status: step?.['status'] === 'completed' || step?.['status'] === 'inProgress' ? step['status'] as any : 'pending'
                        }
                    })
                }
            })
            return
        }
        if (method === 'item/agentMessage/delta' || method === 'item/reasoning/textDelta' || method === 'item/reasoning/summaryTextDelta' || method === 'item/plan/delta') {
            const delta = asString(payload['delta']) || asString(payload['text']) || asString(asRecord(payload['content'])?.['text'])
            if (!delta) return
            const streamKind = method === 'item/agentMessage/delta'
                ? 'assistant_text'
                : method === 'item/reasoning/textDelta'
                    ? 'reasoning_text'
                    : method === 'item/reasoning/summaryTextDelta'
                        ? 'reasoning_summary_text'
                        : 'plan_text'
            this.emitRuntime({ ...eventBase, type: 'content.delta', payload: { streamKind, delta } })
            return
        }
        if (method === 'item/completed') {
            const item = asRecord(payload['item']) || payload
            const itemType = normalizeItemType(item['type'] || item['kind'])
            const text = readTextValue(item['text']) || readTextValue(item['detail']) || readTextValue(item['summary'])
            if (isAssistantItemType(itemType)) {
                this.emitRuntime({ ...eventBase, type: 'content.completed', payload: { streamKind: 'assistant_text', text } })
                return
            }
            if (itemType.includes('plan')) {
                this.emitRuntime({ ...eventBase, type: 'content.completed', payload: { streamKind: 'plan_text', text } })
                return
            }
            const activity = buildToolActivity(item, itemType)
            if (activity) {
                this.emitRuntime({ ...eventBase, type: 'activity', payload: activity })
                return
            }
        }
        if (method === 'item/tool/requestUserInput/answered') {
            const answers = asRecord(payload['answers']) as Record<string, string | string[]> | undefined
            this.emitRuntime({ ...eventBase, type: 'user-input.resolved', requestId: asString(payload['requestId']) || eventBase.itemId, payload: { answers: answers || {} } })
            return
        }
        if (method === 'codex/event/task_started' || method === 'codex/event/agent_reasoning' || method === 'codex/event/task_complete' || method === 'error') {
            this.emitRuntime({
                ...eventBase,
                type: 'activity',
                payload: {
                    kind: method,
                    summary: method === 'codex/event/agent_reasoning' ? 'Reasoning update' : method.replace(/^codex\/event\//, '').replace(/\//g, ' '),
                    detail: asString(asRecord(payload['msg'])?.['text']) || asString(asRecord(payload['msg'])?.['last_agent_message']) || asString(asRecord(payload['error'])?.['message']) || asString(payload['message']),
                    tone: method === 'error' ? 'error' : 'info',
                    data: payload
                }
            })
        }
    }

    private handleResponse(context: SessionContext, message: JsonRpcMessage): void {
        const key = String(message['id'])
        const pending = context.pending.get(key)
        if (!pending) return
        clearTimeout(pending.timer)
        context.pending.delete(key)
        const error = asRecord(message['error'])
        if (error?.['message']) {
            pending.reject(new Error(String(error['message'])))
            return
        }
        pending.resolve(message['result'])
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
