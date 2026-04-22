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
    registerThreadAlias: (sessionThreadId: string, aliasThreadId: string) => void
}

type ThreadStartedRuntimePayload = Extract<AssistantRuntimeEvent, { type: 'thread.started' }>['payload']
type ActivityRuntimePayload = Extract<AssistantRuntimeEvent, { type: 'activity' }>['payload']

function readPayloadThreadId(payload: Record<string, unknown>): string | undefined {
    return asString(asRecord(payload['thread'])?.['id'])
        || asString(payload['threadId'])
        || asString(asRecord(payload['turn'])?.['threadId'])
        || asString(asRecord(asRecord(payload['turn'])?.['thread'])?.['id'])
        || asString(asRecord(payload['item'])?.['threadId'])
        || asString(asRecord(asRecord(payload['item'])?.['thread'])?.['id'])
}

function resolveRuntimeThreadId(context: SessionContext, payload: Record<string, unknown>): string {
    return readPayloadThreadId(payload) || context.thread.id
}

function resolveRuntimeProviderThreadId(context: SessionContext, payload: Record<string, unknown>): string | undefined {
    return readPayloadThreadId(payload) || context.thread.providerThreadId || undefined
}

function readThreadStartedPayload(payload: Record<string, unknown>): ThreadStartedRuntimePayload & { providerThreadId: string } {
    const thread = asRecord(payload['thread']) || {}
    const source = asRecord(thread['source'])
    const subagent = asRecord(source?.['subagent'])
    const threadSpawn = asRecord(subagent?.['thread_spawn'])
    const providerThreadId = asString(thread['id']) || asString(payload['threadId']) || ''
    const sourceKind: 'root' | 'subagent' | 'other' = threadSpawn
        ? 'subagent'
        : source && Object.keys(source).length > 0
            ? 'other'
            : 'root'
    const stateValue = asString(thread['state'])
    const state = stateValue === 'idle'
        || stateValue === 'starting'
        || stateValue === 'ready'
        || stateValue === 'running'
        || stateValue === 'waiting'
        || stateValue === 'interrupted'
        || stateValue === 'error'
        || stateValue === 'stopped'
        ? stateValue
        : undefined

    return {
        providerThreadId,
        source: sourceKind,
        parentProviderThreadId: asString(threadSpawn?.['parent_thread_id']),
        agentNickname: asString(thread['agentNickname']) || asString(threadSpawn?.['agent_nickname']),
        agentRole: asString(thread['agentRole']) || asString(threadSpawn?.['agent_role']),
        subagentDepth: typeof threadSpawn?.['depth'] === 'number' ? threadSpawn['depth'] as number : undefined,
        threadName: asString(thread['name']),
        cwd: asString(thread['cwd']),
        state
    }
}

function buildCollabAgentActivity(item: Record<string, unknown>):
    | {
        activityId: string
        kind: string
        summary: string
        detail?: string
        tone: 'tool'
        data: Record<string, unknown>
    }
    | null {
    const activityId = asString(item['id'])
    const tool = asString(item['tool'])
    const status = asString(item['status'])
    if (!activityId || !tool) return null

    const toolKindMap: Record<string, string> = {
        spawnAgent: 'subagent.spawn',
        sendInput: 'subagent.send-input',
        resumeAgent: 'subagent.resume',
        wait: 'subagent.wait',
        closeAgent: 'subagent.close'
    }
    const summaryMap: Record<string, string> = {
        spawnAgent: status === 'inProgress' ? 'Spawning subagent' : 'Spawned subagent',
        sendInput: status === 'inProgress' ? 'Checking in with subagent' : 'Checked in with subagent',
        resumeAgent: status === 'inProgress' ? 'Resuming subagent' : 'Resumed subagent',
        wait: status === 'inProgress' ? 'Waiting on subagent' : 'Subagent wait completed',
        closeAgent: status === 'inProgress' ? 'Closing subagent' : 'Closed subagent'
    }
    const prompt = readTextValue(item['prompt'])
    const receiverThreadIds = Array.isArray(item['receiverThreadIds'])
        ? item['receiverThreadIds'].filter((entry): entry is string => typeof entry === 'string')
        : []
    const agentsStates = Array.isArray(item['agentsStates'])
        ? item['agentsStates'].filter((entry): entry is Record<string, unknown> => Boolean(asRecord(entry)))
        : []
    const detail = prompt || (receiverThreadIds.length > 0 ? receiverThreadIds.join('\n') : undefined)

    return {
        activityId,
        kind: toolKindMap[tool] || 'subagent.tool',
        summary: summaryMap[tool] || 'Subagent activity',
        detail,
        tone: 'tool',
        data: {
            category: 'subagent',
            itemType: normalizeItemType(item['type'] || item['kind']),
            tool,
            status,
            senderThreadId: asString(item['senderThreadId']),
            receiverThreadIds,
            prompt,
            model: asString(item['model']),
            reasoningEffort: asString(item['reasoningEffort']) || asString(item['reasoning_effort']),
            agentsStates
        }
    }
}

function isContextCompactionItemType(itemType: string): boolean {
    return itemType === 'context compaction' || itemType.includes('context compaction')
}

function buildContextCompactionActivity(input: {
    item: Record<string, unknown>
    itemType: string
    status: 'running' | 'completed'
    threadId: string
    providerThreadId?: string
    turnId?: string
    itemId?: string
    sourceMethod: string
}): ActivityRuntimePayload {
    const rawItemId = input.turnId || asString(input.item['id']) || input.itemId || input.threadId
    const status = input.status
    const summary = status === 'running' ? 'AUTO-COMPACTING' : 'AUTO-COMPACTED'

    return {
        activityId: `context-compaction-${rawItemId}`,
        kind: 'context.compaction',
        summary,
        detail: status === 'running'
            ? 'Conversation context is being compacted.'
            : 'Conversation context was compacted.',
        tone: 'tool',
        data: {
            category: 'context-compaction',
            itemType: input.itemType,
            status,
            sourceMethod: input.sourceMethod,
            itemId: rawItemId,
            turnId: input.turnId,
            threadId: input.threadId,
            providerThreadId: input.providerThreadId,
            providerStatus: asString(input.item['status']) || asString(input.item['state'])
        }
    }
}

function readResolvedUserInputAnswers(value: unknown): Record<string, string | string[]> {
    const rawAnswers = asRecord(value) || {}
    return Object.fromEntries(
        Object.entries(rawAnswers).map(([questionId, answerValue]) => {
            if (typeof answerValue === 'string') return [questionId, answerValue]
            if (Array.isArray(answerValue)) {
                return [questionId, answerValue.filter((entry): entry is string => typeof entry === 'string')]
            }
            const answerRecord = asRecord(answerValue)
            const nestedAnswers = Array.isArray(answerRecord?.['answers'])
                ? answerRecord['answers'].filter((entry): entry is string => typeof entry === 'string')
                : []
            return [questionId, nestedAnswers.length <= 1 ? (nestedAnswers[0] || '') : nestedAnswers]
        })
    )
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
    const runtimeThreadId = resolveRuntimeThreadId(context, payload)
    const runtimeProviderThreadId = resolveRuntimeProviderThreadId(context, payload)
    const requestId = randomUUID()
    const turnId = asString(payload['turnId']) || asString(asRecord(payload['turn'])?.['id'])
    const itemId = asString(payload['itemId']) || asString(asRecord(payload['item'])?.['id'])

    if (requestType) {
        const pending: PendingApprovalRequest = {
            requestId,
            jsonRpcId: message['id'] as JsonRpcId,
            requestType,
            threadId: runtimeThreadId,
            turnId,
            itemId
        }
        context.pendingApprovals.set(requestId, pending)
        deps.emitRuntime({
            eventId: randomUUID(),
            type: 'approval.requested',
            createdAt: new Date().toISOString(),
            threadId: runtimeThreadId,
            turnId,
            itemId,
            requestId,
            providerThreadId: runtimeProviderThreadId,
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
            threadId: runtimeThreadId,
            turnId,
            itemId
        })
        deps.emitRuntime({
            eventId: randomUUID(),
            type: 'user-input.requested',
            createdAt: new Date().toISOString(),
            threadId: runtimeThreadId,
            turnId,
            itemId,
            requestId,
            providerThreadId: runtimeProviderThreadId,
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
    const runtimeThreadId = resolveRuntimeThreadId(context, payload)
    const runtimeProviderThreadId = resolveRuntimeProviderThreadId(context, payload)
    const eventBase = {
        eventId: randomUUID(),
        createdAt: new Date().toISOString(),
        threadId: runtimeThreadId,
        turnId,
        itemId,
        providerThreadId: runtimeProviderThreadId,
        rawMethod: method,
        rawPayload: payload
    }

    if (method === 'thread/started') {
        const threadStartedPayload = readThreadStartedPayload(payload)
        if (threadStartedPayload.providerThreadId) {
            deps.registerThreadAlias(context.thread.id, threadStartedPayload.providerThreadId)
            if (threadStartedPayload.source !== 'subagent') {
                context.thread.providerThreadId = threadStartedPayload.providerThreadId
            }
            deps.emitRuntime({
                ...eventBase,
                threadId: threadStartedPayload.providerThreadId,
                providerThreadId: threadStartedPayload.providerThreadId,
                type: 'thread.started',
                payload: threadStartedPayload
            })
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
                        description: asString(step?.['description']) || undefined,
                        status: step?.['status'] === 'completed' || step?.['status'] === 'inProgress'
                            ? step['status'] as 'completed' | 'inProgress'
                            : 'pending'
                    }
                })
            }
        })
        return
    }

    if (method === 'thread/compacted') {
        deps.emitRuntime({
            ...eventBase,
            type: 'activity',
            payload: buildContextCompactionActivity({
                item: payload,
                itemType: 'context compaction',
                status: 'completed',
                threadId: runtimeThreadId,
                providerThreadId: runtimeProviderThreadId,
                turnId,
                itemId,
                sourceMethod: method
            })
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

    if (method === 'item/started' || method === 'item/completed') {
        const item = asRecord(payload['item']) || payload
        const itemType = normalizeItemType(item['type'] || item['kind'])
        if (isContextCompactionItemType(itemType)) {
            deps.emitRuntime({
                ...eventBase,
                type: 'activity',
                payload: buildContextCompactionActivity({
                    item,
                    itemType,
                    status: method === 'item/started' ? 'running' : 'completed',
                    threadId: runtimeThreadId,
                    providerThreadId: runtimeProviderThreadId,
                    turnId,
                    itemId,
                    sourceMethod: method
                })
            })
            return
        }
        const collabActivity = itemType === 'collab agent tool call' ? buildCollabAgentActivity(item) : null
        if (collabActivity) {
            deps.emitRuntime({
                ...eventBase,
                type: 'activity',
                payload: collabActivity
            })
            return
        }
        if (method === 'item/started') {
            return
        }
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
        const answers = readResolvedUserInputAnswers(payload['answers'])
        deps.emitRuntime({
            ...eventBase,
            type: 'user-input.resolved',
            requestId: asString(payload['requestId']) || eventBase.itemId,
            payload: { answers }
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
