import { randomUUID } from 'node:crypto'
import type { AssistantRuntimeEvent } from '../../shared/assistant/contracts'
import type {
    JsonRpcMessage,
    JsonRpcId,
    PendingApprovalRequest,
    SessionContext
} from './codex-runtime-protocol'
import {
    asRecord,
    asString,
    buildToolActivity,
    isAssistantItemType,
    normalizeItemType,
    readTextValue,
    readTurnUsage,
    toApprovalRequestType,
    toUserInputQuestions
} from './codex-runtime-protocol'

interface RuntimeEventHandlerDeps {
    emitRuntime: (event: AssistantRuntimeEvent) => void
    writeMessage: (context: SessionContext, message: Record<string, unknown>) => void
}

export function handleStdoutLine(context: SessionContext, line: string, deps: RuntimeEventHandlerDeps): void {
    let parsed: JsonRpcMessage
    try {
        parsed = JSON.parse(line) as JsonRpcMessage
    } catch {
        return
    }

    if (parsed['id'] !== undefined && parsed['method'] !== undefined) {
        handleServerRequest(context, parsed, deps)
        return
    }
    if (parsed['id'] !== undefined) {
        handleResponse(context, parsed)
        return
    }
    if (typeof parsed['method'] === 'string') {
        handleNotification(context, String(parsed['method']), asRecord(parsed['params']) || {}, deps)
    }
}

export function handleResponse(context: SessionContext, message: JsonRpcMessage): void {
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

function handleServerRequest(context: SessionContext, message: JsonRpcMessage, deps: RuntimeEventHandlerDeps): void {
    const method = String(message['method'] || '')
    const requestType = toApprovalRequestType(method)
    const payload = asRecord(message['params']) || {}
    const requestId = randomUUID()
    const turnId = asString(payload['turnId']) || asString(asRecord(payload['turn'])?.['id'])
    const itemId = asString(payload['itemId']) || asString(asRecord(payload['item'])?.['id'])

    if (requestType) {
        const pending: PendingApprovalRequest = {
            requestId,
            jsonRpcId: message['id'] as JsonRpcId,
            requestType,
            threadId: context.thread.id,
            turnId,
            itemId
        }
        context.pendingApprovals.set(requestId, pending)
        deps.emitRuntime({
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
        context.pendingUserInputs.set(requestId, {
            requestId,
            jsonRpcId: message['id'] as JsonRpcId,
            threadId: context.thread.id,
            turnId,
            itemId
        })
        deps.emitRuntime({
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

    deps.writeMessage(context, {
        id: message['id'],
        error: {
            code: -32601,
            message: `Unsupported server request: ${method}`
        }
    })
}

function handleNotification(
    context: SessionContext,
    method: string,
    payload: Record<string, unknown>,
    deps: RuntimeEventHandlerDeps
): void {
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
            deps.emitRuntime({ ...eventBase, providerThreadId, type: 'thread.started', payload: { providerThreadId } })
        }
        return
    }

    if (method === 'turn/started') {
        const turn = asRecord(payload['turn'])
        const effortValue = turn?.['reasoningEffort']
        const effort = effortValue === 'low' || effortValue === 'medium' || effortValue === 'high' || effortValue === 'xhigh'
            ? effortValue as 'low' | 'medium' | 'high' | 'xhigh'
            : undefined
        const serviceTierValue = asString(turn?.['serviceTier'])
        const serviceTier = serviceTierValue === 'fast' || serviceTierValue === 'flex'
            ? serviceTierValue as 'fast' | 'flex'
            : undefined

        deps.emitRuntime({
            ...eventBase,
            type: 'turn.started',
            payload: {
                model: asString(turn?.['model']),
                interactionMode: context.thread.interactionMode,
                ...(effort ? { effort } : {}),
                ...(serviceTier ? { serviceTier } : {})
            }
        })
        deps.emitRuntime({ ...eventBase, type: 'session.state.changed', payload: { state: 'running' } })
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

        deps.emitRuntime({ ...eventBase, type: 'turn.completed', payload: { outcome, errorMessage, effort, serviceTier, usage } })
        deps.emitRuntime({
            ...eventBase,
            type: 'session.state.changed',
            payload: { state: outcome === 'failed' ? 'error' : 'ready', error: errorMessage }
        })
        return
    }

    if (method === 'thread/tokenUsage/updated') {
        const tokenUsage = asRecord(payload['tokenUsage'])
        const lastUsage = asRecord(tokenUsage?.['last'])
        const usage = readTurnUsage(undefined, { tokenUsage: { ...lastUsage, modelContextWindow: tokenUsage?.['modelContextWindow'] } })
        if (usage) {
            deps.emitRuntime({ ...eventBase, type: 'thread.token-usage.updated', payload: { usage } })
        }
        return
    }

    if (method === 'turn/plan/updated') {
        const rawSteps = Array.isArray(payload['plan']) ? payload['plan'] : []
        deps.emitRuntime({
            ...eventBase,
            type: 'plan.updated',
            payload: {
                explanation: asString(payload['explanation']),
                plan: rawSteps.map((entry) => {
                    const step = asRecord(entry)
                    return {
                        step: asString(step?.['step']) || 'step',
                        status: step?.['status'] === 'completed' || step?.['status'] === 'inProgress'
                            ? step['status'] as 'completed' | 'inProgress'
                            : 'pending'
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

        deps.emitRuntime({ ...eventBase, type: 'content.delta', payload: { streamKind, delta } })
        return
    }

    if (method === 'item/completed') {
        const item = asRecord(payload['item']) || payload
        const itemType = normalizeItemType(item['type'] || item['kind'])
        const text = readTextValue(item['text']) || readTextValue(item['detail']) || readTextValue(item['summary'])

        if (isAssistantItemType(itemType)) {
            deps.emitRuntime({ ...eventBase, type: 'content.completed', payload: { streamKind: 'assistant_text', text } })
            return
        }
        if (itemType.includes('plan')) {
            deps.emitRuntime({ ...eventBase, type: 'content.completed', payload: { streamKind: 'plan_text', text } })
            return
        }

        const activity = buildToolActivity(item, itemType)
        if (activity) {
            deps.emitRuntime({ ...eventBase, type: 'activity', payload: activity })
        }
        return
    }

    if (method === 'item/tool/requestUserInput/answered') {
        const answers = asRecord(payload['answers']) as Record<string, string | string[]> | undefined
        deps.emitRuntime({
            ...eventBase,
            type: 'user-input.resolved',
            requestId: asString(payload['requestId']) || eventBase.itemId,
            payload: { answers: answers || {} }
        })
        return
    }

    if (method === 'codex/event/task_started' || method === 'codex/event/agent_reasoning' || method === 'codex/event/task_complete' || method === 'error') {
        deps.emitRuntime({
            ...eventBase,
            type: 'activity',
            payload: {
                kind: method,
                summary: method === 'codex/event/agent_reasoning' ? 'Reasoning update' : method.replace(/^codex\/event\//, '').replace(/\//g, ' '),
                detail: asString(asRecord(payload['msg'])?.['text'])
                    || asString(asRecord(payload['msg'])?.['last_agent_message'])
                    || asString(asRecord(payload['error'])?.['message'])
                    || asString(payload['message']),
                tone: method === 'error' ? 'error' : 'info',
                data: payload
            }
        })
    }
}
