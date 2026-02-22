import { spawn, type ChildProcessByStdio } from 'child_process'
import log from 'electron-log'
import readline from 'readline'
import type { Readable, Writable } from 'stream'
import {
    extractCompletedAgentText,
    extractLegacyTurnId,
    extractTurnError,
    extractTurnIdFromParams,
    isServerRequestMessage,
    now,
    readRecord,
    readString
} from './assistant-bridge-helpers'

const REQUEST_TIMEOUT_MS = 120000
const CODEX_BIN = process.env.CODEX_BIN || 'codex'

type BridgeRpcContext = any
type BridgeProcess = ChildProcessByStdio<Writable, Readable, null>

type JsonRpcNotification = {
    method?: string
    params?: Record<string, unknown>
}

type TurnEventSource = 'modern' | 'legacy'

export async function bridgeEnsureInitialized(bridge: BridgeRpcContext): Promise<void> {
    await bridge.startProcess()
    if (bridge.initialized) return

    await bridge.requestWithRetry('initialize', {
        clientInfo: {
            name: 'devscope_assistant_bridge',
            title: 'DevScope Assistant Bridge',
            version: '0.1.0'
        }
    }, { retries: 1 })
    bridge.notify('initialized', {})
    bridge.initialized = true
}

export async function bridgeStartProcess(bridge: BridgeRpcContext): Promise<void> {
    if (bridge.proc && !bridge.proc.killed) {
        return
    }

    const proc = spawn(CODEX_BIN, ['app-server'], {
        stdio: ['pipe', 'pipe', 'inherit'],
        shell: process.platform === 'win32'
    }) as BridgeProcess
    bridge.proc = proc

    proc.on('error', (error) => {
        const shouldAttemptReconnect = bridge.status.connected
        const message = (error as NodeJS.ErrnoException).code === 'ENOENT'
            ? `Could not find ${CODEX_BIN} in PATH`
            : (error instanceof Error ? error.message : 'Assistant bridge process failed.')
        bridge.failPending(new Error(message))
        bridge.threadId = null
        bridge.activeTurnId = null
        bridge.turnBuffers.clear()
        bridge.turnContexts.clear()
        bridge.turnAttemptGroupByTurnId.clear()
        bridge.reasoningTextsByTurn.clear()
        bridge.lastReasoningDigestByTurn.clear()
        bridge.lastActivityDigestByTurn.clear()
        bridge.finalizedTurns.clear()
        bridge.cancelledTurns.clear()
        bridge.cachedModels = []
        bridge.status.connected = false
        bridge.status.state = 'error'
        bridge.status.lastError = message
        bridge.status.activeTurnId = null
        const activeSession = bridge.getActiveSession()
        if (activeSession) {
            activeSession.threadId = null
            activeSession.updatedAt = now()
        }
        bridge.persistStateSoon()
        bridge.emitEvent('error', { message })
        bridge.emitEvent('status', { status: bridge.getStatus() })
        bridge.proc = null
        bridge.initialized = false
        if (shouldAttemptReconnect) {
            bridge.scheduleReconnect()
        }
    })

    proc.on('exit', (code, signal) => {
        const shouldAttemptReconnect = bridge.status.connected
        const message = `codex app-server exited (code=${code}, signal=${signal})`
        bridge.failPending(new Error(message))
        bridge.proc = null
        bridge.initialized = false
        bridge.threadId = null
        bridge.activeTurnId = null
        bridge.turnBuffers.clear()
        bridge.turnContexts.clear()
        bridge.turnAttemptGroupByTurnId.clear()
        bridge.reasoningTextsByTurn.clear()
        bridge.lastReasoningDigestByTurn.clear()
        bridge.lastActivityDigestByTurn.clear()
        bridge.finalizedTurns.clear()
        bridge.cancelledTurns.clear()
        bridge.cachedModels = []
        bridge.status.connected = false
        bridge.status.state = 'offline'
        bridge.status.activeTurnId = null
        const activeSession = bridge.getActiveSession()
        if (activeSession) {
            activeSession.threadId = null
            activeSession.updatedAt = now()
        }
        bridge.persistStateSoon()
        bridge.emitEvent('status', { status: bridge.getStatus() })
        if (bridge.rl) {
            bridge.rl.close()
            bridge.rl = null
        }
        if (shouldAttemptReconnect) {
            bridge.scheduleReconnect()
        }
    })

    bridge.rl = readline.createInterface({ input: proc.stdout })
    bridge.rl.on('line', (line) => {
        let message: Record<string, unknown>
        try {
            message = JSON.parse(line) as Record<string, unknown>
        } catch {
            bridge.emitEvent('error', { message: line })
            return
        }

        if (Object.prototype.hasOwnProperty.call(message, 'id')) {
            if (isServerRequestMessage(message)) {
                bridge.handleServerRequest(message)
                return
            }
            bridge.resolvePending(message)
            return
        }

        if (typeof message.method === 'string') {
            bridge.handleNotification(message as JsonRpcNotification)
        }
    })
}

export function bridgeStopProcess(bridge: BridgeRpcContext): void {
    bridge.clearReconnectTimer()
    if (bridge.rl) {
        bridge.rl.close()
        bridge.rl = null
    }

    if (bridge.proc && !bridge.proc.killed) {
        bridge.proc.kill()
    }
    bridge.proc = null
    bridge.initialized = false
    bridge.threadId = null
    bridge.activeTurnId = null
    bridge.turnBuffers.clear()
    bridge.turnContexts.clear()
    bridge.turnAttemptGroupByTurnId.clear()
    bridge.reasoningTextsByTurn.clear()
    bridge.lastReasoningDigestByTurn.clear()
    bridge.lastActivityDigestByTurn.clear()
    bridge.finalizedTurns.clear()
    bridge.cancelledTurns.clear()
    bridge.cachedModels = []
    bridge.status.activeTurnId = null
    const activeSession = bridge.getActiveSession()
    if (activeSession) {
        activeSession.threadId = null
        activeSession.updatedAt = now()
    }
    bridge.persistStateSoon()
    bridge.failPending(new Error('Bridge stopped'))
}

export function bridgeRequest(
    bridge: BridgeRpcContext,
    method: string,
    params: Record<string, unknown> = {},
    timeoutMs = REQUEST_TIMEOUT_MS
): Promise<any> {
    if (!bridge.proc || !bridge.proc.stdin.writable) {
        return Promise.reject(new Error('Bridge is not connected'))
    }

    const id = bridge.nextId++
    bridge.send({ method, id, params })

    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
            bridge.pending.delete(id)
            reject(new Error(`Timeout waiting for ${method}`))
        }, timeoutMs)
        bridge.pending.set(id, { resolve, reject, timer, method })
    })
}

export function bridgeNotify(
    bridge: BridgeRpcContext,
    method: string,
    params: Record<string, unknown> = {}
): void {
    if (!bridge.proc || !bridge.proc.stdin.writable) return
    bridge.send({ method, params })
}

export function bridgeSend(
    bridge: BridgeRpcContext,
    message: Record<string, unknown>
): void {
    if (!bridge.proc || !bridge.proc.stdin.writable) return
    bridge.proc.stdin.write(`${JSON.stringify(message)}\n`)
}

export function bridgeResolvePending(
    bridge: BridgeRpcContext,
    message: Record<string, unknown>
): void {
    const id = Number(message.id)
    const entry = bridge.pending.get(id)
    if (!entry) return

    clearTimeout(entry.timer)
    bridge.pending.delete(id)

    if (message.error) {
        entry.reject(new Error(`RPC ${entry.method} failed: ${JSON.stringify(message.error)}`))
        return
    }

    entry.resolve(message.result)
}

export function bridgeFailPending(
    bridge: BridgeRpcContext,
    error: Error
): void {
    for (const entry of bridge.pending.values()) {
        clearTimeout(entry.timer)
        entry.reject(error)
    }
    bridge.pending.clear()
}

export function bridgeHandleServerRequest(
    bridge: BridgeRpcContext,
    message: Record<string, unknown>
): void {
    const method = readString(message.method)
    const id = Number(message.id)
    if (!Number.isFinite(id)) return

    if (method === 'item/commandExecution/requestApproval' || method === 'item/fileChange/requestApproval') {
        const decision = bridge.status.approvalMode === 'yolo' ? 'acceptForSession' : 'decline'
        const requestPayload = readRecord(message.params) || {}
        bridge.emitEvent('approval-request', {
            requestId: id,
            method,
            mode: bridge.status.approvalMode,
            decision,
            request: requestPayload
        })
        bridge.send({ id, result: { decision } })
        bridge.emitEvent('approval-decision', {
            requestId: id,
            method,
            mode: bridge.status.approvalMode,
            decision
        })
        return
    }

    bridge.send({
        id,
        error: {
            code: -32601,
            message: `Unsupported server request method: ${method}`
        }
    })
}

export function bridgeHandleNotification(
    bridge: BridgeRpcContext,
    message: JsonRpcNotification
): void {
    const method = readString(message.method)
    const params = (message.params || {}) as Record<string, unknown>

    if (method === 'item/agentMessage/delta') {
        const turnId = extractTurnIdFromParams(params) || bridge.activeTurnId
        const delta = readString(params.delta)
            || readString(params.textDelta)
            || readString(params.outputTextDelta)
        if (!turnId || !delta) return
        const buffer = bridge.claimTurnBuffer(turnId, 'modern')
        if (!buffer) return
        buffer.draft += delta
        bridge.emitEvent('assistant-delta', { turnId, delta, text: buffer.draft })
        return
    }

    if (method === 'item/completed') {
        const text = extractCompletedAgentText(params)
        if (!text) return
        const turnId = extractTurnIdFromParams(params) || bridge.activeTurnId
        if (!turnId) return
        const buffer = bridge.claimTurnBuffer(turnId, 'modern')
        if (!buffer) return
        buffer.pendingFinal = text
        return
    }

    if (method === 'turn/completed') {
        const turnId = extractTurnIdFromParams(params) || bridge.activeTurnId
        if (!turnId) return
        bridge.finalizeTurn(turnId, {
            success: true,
            reason: 'completed'
        })
        return
    }

    if (method === 'turn/failed' || method === 'turn/interrupted' || method === 'turn/cancelled') {
        const turnId = extractTurnIdFromParams(params) || bridge.activeTurnId
        if (!turnId) return
        const reason = method === 'turn/failed'
            ? 'failed'
            : method === 'turn/interrupted'
                ? 'interrupted'
                : 'cancelled'
        const error = extractTurnError(params)
        bridge.finalizeTurn(turnId, {
            success: false,
            reason,
            errorMessage: error
        })
        return
    }

    if (bridge.handleReasoningNotification(method, params)) {
        return
    }

    if (bridge.handleActivityNotification(method, params)) {
        return
    }

    if (method.startsWith('codex/event/')) {
        bridge.handleLegacyNotification(method, params)
    }
}

export function bridgeHandleLegacyNotification(
    bridge: BridgeRpcContext,
    method: string,
    params: Record<string, unknown>
): void {
    const msg = params.msg as Record<string, unknown> | undefined
    const payload = (msg?.payload || {}) as Record<string, unknown>
    const eventType = readString(msg?.type)
    const turnId = extractLegacyTurnId(params) || bridge.activeTurnId

    if (!turnId) return

    if (eventType === 'agent_message_delta' || eventType === 'agent_message_content_delta') {
        const delta = readString(payload.delta)
        if (!delta) return
        const buffer = bridge.claimTurnBuffer(turnId, 'legacy')
        if (!buffer) return
        buffer.draft += delta
        bridge.emitEvent('assistant-delta', { turnId, delta, text: buffer.draft })
        return
    }

    if (eventType === 'agent_message') {
        const text = readString(payload.message).trim()
        if (!text) return
        const buffer = bridge.claimTurnBuffer(turnId, 'legacy')
        if (!buffer) return
        buffer.pendingFinal = text
        return
    }

    if (eventType === 'task_complete' || method === 'codex/event/task_complete') {
        const finalText = readString(payload.last_agent_message).trim()
        bridge.finalizeTurn(turnId, {
            success: true,
            reason: 'completed',
            explicitFinalText: finalText
        })
        return
    }

    if (eventType === 'task_failed' || eventType === 'task_error' || method === 'codex/event/task_failed') {
        const error = readString(payload.error).trim() || readString(payload.message).trim()
        bridge.finalizeTurn(turnId, {
            success: false,
            reason: 'failed',
            errorMessage: error
        })
        return
    }

    if (eventType === 'task_interrupted' || method === 'codex/event/task_interrupted') {
        const error = readString(payload.error).trim() || readString(payload.message).trim()
        bridge.finalizeTurn(turnId, {
            success: false,
            reason: 'interrupted',
            errorMessage: error
        })
        return
    }

    if (
        eventType === 'task_cancelled'
        || eventType === 'task_canceled'
        || method === 'codex/event/task_cancelled'
        || method === 'codex/event/task_canceled'
    ) {
        bridge.finalizeTurn(turnId, {
            success: false,
            reason: 'cancelled'
        })
        return
    }

    if (bridge.handleLegacyReasoningNotification(turnId, eventType, payload, method)) {
        return
    }

    if (bridge.handleLegacyActivityNotification(turnId, eventType, payload, method)) {
        return
    }
}

export function bridgeClaimTurnBuffer(
    bridge: BridgeRpcContext,
    turnId: string,
    source: TurnEventSource
): any {
    if (bridge.finalizedTurns.has(turnId)) {
        return null
    }

    const buffer = bridge.ensureTurnBuffer(turnId)
    if (!buffer.source) {
        buffer.source = source
        return buffer
    }

    return buffer.source === source ? buffer : null
}

export function bridgeEnsureTurnBuffer(
    bridge: BridgeRpcContext,
    turnId: string
): any {
    const existing = bridge.turnBuffers.get(turnId)
    if (existing) return existing
    const created = { draft: '', pendingFinal: null, source: null }
    bridge.turnBuffers.set(turnId, created)
    return created
}
