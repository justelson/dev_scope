import { spawn, type ChildProcessByStdio } from 'child_process'
import log from 'electron-log'
import readline from 'readline'
import type { Readable, Writable } from 'stream'
import {
    extractAgentMessageDeltaPhase,
    extractAgentMessageDeltaItemType,
    extractCompletedAgentPhase,
    extractCompletedAgentText,
    extractLegacyTurnId,
    extractTurnError,
    extractTurnIdFromParams,
    isServerRequestMessage,
    isFinalAnswerPhase,
    mergeAgentMessageDraft,
    shouldTreatAgentDeltaAsProvisional,
    now,
    readRecord,
    readString
} from './assistant-bridge-helpers'
import type { AssistantApprovalDecision } from './types'

const REQUEST_TIMEOUT_MS = 120000
const DEFAULT_CODEX_BIN = process.platform === 'win32' ? 'codex.cmd' : 'codex'
const CODEX_BIN_ENV = String(process.env.CODEX_BIN || '').trim()

type BridgeRpcContext = any
type BridgeProcess = ChildProcessByStdio<Writable, Readable, Readable>

type JsonRpcNotification = {
    method?: string
    params?: Record<string, unknown>
}

type TurnEventSource = 'modern' | 'legacy'

function normalizeApprovalDecision(value: unknown): AssistantApprovalDecision | null {
    return value === 'acceptForSession' || value === 'decline'
        ? value
        : null
}

function resolveCodexBinary(): string {
    const candidate = CODEX_BIN_ENV || DEFAULT_CODEX_BIN
    const normalized = String(candidate || '').trim()

    if (!normalized) {
        return DEFAULT_CODEX_BIN
    }
    if (normalized.length > 512) {
        throw new Error('Configured CODEX_BIN path is too long.')
    }
    if (/[\0\r\n]/.test(normalized)) {
        throw new Error('Configured CODEX_BIN contains invalid control characters.')
    }
    if (/["'`]/.test(normalized)) {
        throw new Error('Configured CODEX_BIN must be an executable path only (no quotes).')
    }
    if (normalized.startsWith('-')) {
        throw new Error('Configured CODEX_BIN must be an executable name/path, not flags.')
    }
    if (/\s/.test(normalized) && !/[\\/]/.test(normalized)) {
        throw new Error('Configured CODEX_BIN must not include inline arguments.')
    }

    return normalized
}

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
    const codexBin = resolveCodexBinary()
    const useWindowsShell = process.platform === 'win32'

    const proc = spawn(codexBin, ['app-server'], {
        stdio: ['pipe', 'pipe', 'pipe'],
        // On Windows the Codex launcher is typically a .cmd shim and can fail with EINVAL when
        // spawned directly. Running via shell avoids that failure mode for auto-connect.
        shell: useWindowsShell,
        windowsHide: true
    }) as BridgeProcess
    bridge.proc = proc

    proc.stderr?.on('data', (chunk) => {
        const message = String(chunk || '').trim()
        if (!message) return
        log.warn('[AssistantBridge] codex stderr:', message)
    })

    proc.on('error', (error) => {
        const shouldAttemptReconnect = bridge.status.connected
        const code = (error as NodeJS.ErrnoException).code
        const message = code === 'ENOENT'
            ? `Could not find ${codexBin} in PATH`
            : code === 'EINVAL'
                ? `Failed to launch ${codexBin} (spawn EINVAL). Verify CODEX_BIN points to a valid Codex executable.`
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
        bridge.pendingApprovalRequests.clear()
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
        bridge.pendingApprovalRequests.clear()
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
    bridge.rl.on('line', (line: string) => {
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
    bridge.pendingApprovalRequests.clear()
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
    if (bridge.pendingApprovalRequests.size > 0) {
        for (const pending of bridge.pendingApprovalRequests.values()) {
            bridge.emitEvent('approval-decision', {
                requestId: pending.requestId,
                method: pending.method,
                mode: pending.mode,
                decision: 'decline',
                turnId: pending.turnId,
                attemptGroupId: pending.attemptGroupId,
                reason: 'bridge-stopped'
            })
            if (pending.turnId) {
                bridge.recordTurnPart({
                    turnId: pending.turnId,
                    attemptGroupId: pending.attemptGroupId || undefined,
                    kind: 'approval',
                    method: pending.method,
                    status: 'decided',
                    decision: 'decline',
                    payload: {
                        ...(pending.request || {}),
                        requestId: pending.requestId,
                        mode: pending.mode,
                        reason: 'bridge-stopped'
                    }
                })
            }
        }
        bridge.pendingApprovalRequests.clear()
    }
}

export function bridgeHandleServerRequest(
    bridge: BridgeRpcContext,
    message: Record<string, unknown>
): void {
    const method = readString(message.method)
    const id = Number(message.id)
    if (!Number.isFinite(id)) return

    if (method === 'item/commandExecution/requestApproval' || method === 'item/fileChange/requestApproval') {
        const requestPayload = readRecord(message.params) || {}
        const turnId = extractTurnIdFromParams(requestPayload) || bridge.activeTurnId || null
        const attemptGroupId = turnId
            ? (bridge.turnContexts.get(turnId)?.attemptGroupId
                || bridge.turnAttemptGroupByTurnId.get(turnId)
                || turnId)
            : null
        bridge.pendingApprovalRequests.set(id, {
            requestId: id,
            method,
            request: requestPayload,
            mode: bridge.status.approvalMode,
            turnId,
            attemptGroupId,
            createdAt: now()
        })
        bridge.emitEvent('approval-request', {
            requestId: id,
            method,
            mode: bridge.status.approvalMode,
            request: requestPayload,
            turnId,
            attemptGroupId
        })
        if (turnId) {
            bridge.recordTurnPart({
                turnId,
                attemptGroupId: attemptGroupId || undefined,
                kind: 'approval',
                method,
                status: 'pending',
                payload: {
                    ...requestPayload,
                    requestId: id,
                    mode: bridge.status.approvalMode
                }
            })
        }
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

export function bridgeRespondToApproval(
    bridge: BridgeRpcContext,
    requestIdRaw: number,
    decisionRaw?: AssistantApprovalDecision
): { success: boolean; requestId?: number; decision?: AssistantApprovalDecision; error?: string } {
    const requestId = Number(requestIdRaw)
    if (!Number.isFinite(requestId)) {
        return { success: false, error: 'requestId must be a number.' }
    }

    const pending = bridge.pendingApprovalRequests.get(requestId)
    if (!pending) {
        return { success: false, error: `No pending approval request found: ${requestId}` }
    }

    const decision = normalizeApprovalDecision(decisionRaw)
    if (!decision) {
        return { success: false, error: 'decision must be either "decline" or "acceptForSession".' }
    }
    if (!bridge.proc || !bridge.proc.stdin?.writable) {
        return { success: false, error: 'Assistant bridge is not connected.' }
    }

    bridge.pendingApprovalRequests.delete(requestId)
    bridge.send({ id: requestId, result: { decision } })
    bridge.emitEvent('approval-decision', {
        requestId,
        method: pending.method,
        mode: pending.mode,
        decision,
        turnId: pending.turnId,
        attemptGroupId: pending.attemptGroupId
    })
    if (pending.turnId) {
        bridge.recordTurnPart({
            turnId: pending.turnId,
            attemptGroupId: pending.attemptGroupId || undefined,
            kind: 'approval',
            method: pending.method,
            status: 'decided',
            decision,
            payload: {
                ...(pending.request || {}),
                requestId,
                mode: pending.mode
            }
        })
    }
    return { success: true, requestId, decision }
}

export function bridgeHandleNotification(
    bridge: BridgeRpcContext,
    message: JsonRpcNotification
): void {
    const method = readString(message.method)
    const params = (message.params || {}) as Record<string, unknown>

    if (method === 'item/agentMessage/delta') {
        const turnId = extractTurnIdFromParams(params) || bridge.activeTurnId
        const snapshotText = readString(params.text) || readString(params.message)
        const delta = readString(params.delta)
            || readString(params.textDelta)
            || readString(params.outputTextDelta)
        if (!turnId || (!delta && !snapshotText)) return
        const buffer = bridge.claimTurnBuffer(turnId, 'modern')
        if (!buffer) return
        const attemptGroupId = bridge.turnContexts.get(turnId)?.attemptGroupId
            || bridge.turnAttemptGroupByTurnId.get(turnId)
            || turnId
        const phase = extractAgentMessageDeltaPhase(params)
        const itemType = extractAgentMessageDeltaItemType(params)
        const isProvisional = shouldTreatAgentDeltaAsProvisional(params)
        const updateText = snapshotText || delta

        if (isProvisional && updateText) {
            // Provisional streams can be either cumulative snapshots or token deltas.
            // Merge intelligently: replace on disjoint "new status" updates, append on continuations.
            buffer.draft = mergeAgentMessageDraft(buffer.draft, updateText, {
                preferReplaceForDisjointLong: true
            })
            buffer.draftKind = 'provisional'
            bridge.emitEvent('assistant-delta', {
                turnId,
                attemptGroupId,
                delta: updateText,
                text: buffer.draft,
                streamKind: 'provisional',
                draftKind: 'provisional'
            })
            bridge.recordTurnPart({
                turnId,
                attemptGroupId,
                kind: 'text',
                text: buffer.draft,
                method,
                provisional: true
            })
            return
        }

        if (isFinalAnswerPhase(phase) && buffer.draftKind === 'provisional') {
            // Clear provisional preview text when final-answer streaming starts.
            buffer.draft = ''
        }
        if (itemType && itemType !== 'agentmessage' && itemType !== 'assistantmessage' && itemType !== 'message') {
            buffer.draftKind = 'provisional'
        } else {
            buffer.draftKind = 'final'
        }

        if (snapshotText) {
            // Some providers send the full provisional text on each update.
            // Replace instead of append so status updates do not stack.
            buffer.draft = snapshotText
            bridge.emitEvent('assistant-delta', {
                turnId,
                attemptGroupId,
                delta: delta || snapshotText,
                text: buffer.draft,
                streamKind: buffer.draftKind === 'provisional' ? 'provisional' : 'final',
                draftKind: buffer.draftKind || undefined
            })
            bridge.recordTurnPart({
                turnId,
                attemptGroupId,
                kind: 'text',
                text: buffer.draft,
                method,
                provisional: buffer.draftKind === 'provisional'
            })
            return
        }

        buffer.draft = mergeAgentMessageDraft(buffer.draft, delta)
        bridge.emitEvent('assistant-delta', {
            turnId,
            attemptGroupId,
            delta,
            text: buffer.draft,
            streamKind: buffer.draftKind === 'provisional' ? 'provisional' : 'final',
            draftKind: buffer.draftKind || undefined
        })
        bridge.recordTurnPart({
            turnId,
            attemptGroupId,
            kind: 'text',
            text: buffer.draft,
            method,
            provisional: buffer.draftKind === 'provisional'
        })
        return
    }

    if (method === 'item/completed') {
        const text = extractCompletedAgentText(params)
        if (!text) return
        const phase = extractCompletedAgentPhase(params)
        const turnId = extractTurnIdFromParams(params) || bridge.activeTurnId
        if (!turnId) return
        const buffer = bridge.claimTurnBuffer(turnId, 'modern')
        if (!buffer) return
        if (isFinalAnswerPhase(phase)) {
            buffer.pendingFinalPhase = text
            buffer.draftKind = 'final'
        } else {
            buffer.pendingFinal = text
        }
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

    if (
        method === 'account/updated'
        || method === 'account/rateLimits/updated'
        || method === 'thread/tokenUsage/updated'
    ) {
        bridge.emitEvent(method as 'account/updated' | 'account/rateLimits/updated' | 'thread/tokenUsage/updated', { ...params })
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
        // Ignore legacy token deltas for assistant rendering.
        // Some models emit provisional token streams here that should not be treated as final output.
        return
    }

    if (eventType === 'agent_message') {
        const text = readString(payload.message).trim()
        if (!text) return
        const buffer = bridge.claimTurnBuffer(turnId, 'legacy')
        if (!buffer) return
        const attemptGroupId = bridge.turnContexts.get(turnId)?.attemptGroupId
            || bridge.turnAttemptGroupByTurnId.get(turnId)
            || turnId
        buffer.pendingFinal = text
        // Legacy agent_message events are provisional updates; keep the latest visible.
        buffer.draft = text
        buffer.draftKind = 'provisional'
        bridge.emitEvent('assistant-delta', {
            turnId,
            attemptGroupId,
            delta: text,
            text: buffer.draft,
            streamKind: 'provisional',
            draftKind: 'provisional'
        })
        bridge.recordTurnPart({
            turnId,
            attemptGroupId,
            kind: 'text',
            text: buffer.draft,
            method,
            provisional: true
        })
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
    const created = { draft: '', pendingFinal: null, pendingFinalPhase: null, draftKind: null, source: null }
    bridge.turnBuffers.set(turnId, created)
    return created
}
