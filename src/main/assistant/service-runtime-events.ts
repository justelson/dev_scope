import type {
    AssistantActivity,
    AssistantDomainEvent,
    AssistantLatestTurn,
    AssistantPendingApproval,
    AssistantPendingUserInput,
    AssistantRuntimeEvent,
    AssistantSession,
    AssistantThread
} from '../../shared/assistant/contracts'
import { createAssistantId, extractProposedPlanMarkdown } from './utils'

interface AssistantRuntimeEventHandlerDeps {
    planBuffers: Map<string, string>
    isAssistantTextSuppressed: (threadId: string, turnId?: string | null) => boolean
    findSessionByThreadId: (threadId: string) => AssistantSession | null
    requireThread: (threadId: string) => AssistantThread
    findThreadRecord: (threadId: string) => { session: AssistantSession; thread: AssistantThread } | null
    queueAssistantTextDelta: (entry: {
        sessionId: string
        threadId: string
        messageId: string
        delta: string
        turnId: string | null
        occurredAt: string
    }) => void
    flushAssistantTextDelta: (target?: { threadId: string; messageId: string }) => void
    appendEvent: (
        type: AssistantDomainEvent['type'],
        occurredAt: string,
        payload: Record<string, unknown>,
        sessionId?: string,
        threadId?: string
    ) => void
    updateLatestTurnAssistantMessage: (sessionId: string, threadId: string, assistantMessageId: string, occurredAt: string) => void
}

type RuntimeActivityPayload = Extract<AssistantRuntimeEvent, { type: 'activity' }>['payload']

function buildCodexItemActivityId(itemId?: string): string | null {
    return itemId ? `codex-item-${itemId}` : null
}

function readRuntimePayloadString(value: unknown): string {
    return typeof value === 'string' ? value : ''
}

function hasOwnPayloadKey(payload: Record<string, unknown>, key: string): boolean {
    return Object.prototype.hasOwnProperty.call(payload, key)
}

function hasPayloadValue(payload: Record<string, unknown>, key: string): boolean {
    return hasOwnPayloadKey(payload, key) && payload[key] !== undefined && payload[key] !== null
}

function mergeActivityPayloads(
    previousPayload: Record<string, unknown>,
    incomingPayload: Record<string, unknown>
): Record<string, unknown> {
    const payload = { ...previousPayload }
    for (const [key, value] of Object.entries(incomingPayload)) {
        if (value === undefined) continue
        payload[key] = value
    }
    return payload
}

function appendOrReplaceOutput(previousOutput: unknown, delta: string): string {
    return `${typeof previousOutput === 'string' ? previousOutput : ''}${delta}`
}

function mergeRuntimeActivity(
    existing: AssistantActivity | null,
    incoming: RuntimeActivityPayload,
    turnId: string | null,
    occurredAt: string
): AssistantActivity {
    const incomingPayload = { ...(incoming.data || {}) }
    const previousPayload = { ...(existing?.payload || {}) }
    const payload = mergeActivityPayloads(previousPayload, incomingPayload)

    if (!hasPayloadValue(incomingPayload, 'output') && hasOwnPayloadKey(previousPayload, 'output')) {
        payload['output'] = previousPayload['output']
    }
    if (!hasPayloadValue(incomingPayload, 'patch') && hasOwnPayloadKey(previousPayload, 'patch')) {
        payload['patch'] = previousPayload['patch']
    }

    return {
        id: incoming.activityId || existing?.id || createAssistantId('assistant-activity'),
        kind: incoming.kind || existing?.kind || 'tool',
        tone: incoming.tone || existing?.tone || 'tool',
        summary: incoming.summary || existing?.summary || 'Tool activity',
        detail: incoming.detail ?? existing?.detail,
        turnId: turnId || existing?.turnId || null,
        createdAt: existing?.createdAt || occurredAt,
        payload
    }
}

function mergeRuntimeFileChangeActivity(
    existing: AssistantActivity | null,
    incoming: RuntimeActivityPayload,
    turnId: string | null,
    occurredAt: string
): AssistantActivity {
    const activity = mergeRuntimeActivity(existing, incoming, turnId, occurredAt)
    if (!existing || existing.kind !== 'file-change') return activity

    const incomingPayload = { ...(incoming.data || {}) }
    if (readRuntimePayloadString(incomingPayload['category']) !== 'turn-diff') return activity

    return {
        ...activity,
        summary: existing.summary,
        detail: existing.detail,
        payload: {
            ...activity.payload,
            paths: existing.payload?.['paths'],
            createdPaths: existing.payload?.['createdPaths'],
            fileCount: existing.payload?.['fileCount'],
            patch: existing.payload?.['patch']
        }
    }
}

function buildStreamingToolActivity(input: {
    existing: AssistantActivity | null
    activityId: string
    kind: 'command' | 'file-change'
    delta: string
    turnId: string | null
    itemId?: string
    occurredAt: string
}): AssistantActivity {
    const previousPayload = input.existing?.payload || {}
    const output = appendOrReplaceOutput(previousPayload['output'], input.delta)

    return {
        id: input.activityId,
        kind: input.existing?.kind || input.kind,
        tone: input.existing?.tone || 'tool',
        summary: input.existing?.summary || (input.kind === 'command' ? 'Running command' : 'Applying file changes'),
        detail: input.existing?.detail,
        turnId: input.turnId || input.existing?.turnId || null,
        createdAt: input.existing?.createdAt || input.occurredAt,
        payload: {
            ...previousPayload,
            itemId: input.itemId || readRuntimePayloadString(previousPayload['itemId']) || undefined,
            status: readRuntimePayloadString(previousPayload['status']) || 'inProgress',
            output
        }
    }
}

function findLatestFileChangeActivity(thread: AssistantThread, turnId: string | null): AssistantActivity | null {
    for (let index = thread.activities.length - 1; index >= 0; index -= 1) {
        const activity = thread.activities[index]
        if (!activity || activity.kind !== 'file-change') continue
        if (turnId && activity.turnId !== turnId) continue
        if (readRuntimePayloadString(activity.payload?.['category']) === 'turn-diff') continue
        return activity
    }
    return null
}

export function handleAssistantRuntimeEvent(event: AssistantRuntimeEvent, deps: AssistantRuntimeEventHandlerDeps): void {
    const eventThreadRecord = deps.findThreadRecord(event.threadId)
    const eventSession = eventThreadRecord?.session || deps.findSessionByThreadId(event.threadId)
    const eventThreadId = eventThreadRecord?.thread.id || event.threadId

    if (event.type === 'session.state.changed') {
        if (!eventSession) return
        deps.appendEvent('thread.updated', event.createdAt, {
            threadId: eventThreadId,
            patch: {
                state: event.payload.state,
                lastError: event.payload.error || null,
                updatedAt: event.createdAt
            }
        }, eventSession.id, eventThreadId)
        if (event.payload.message) {
            deps.appendEvent('thread.activity.appended', event.createdAt, {
                threadId: eventThreadId,
                activity: {
                    id: createAssistantId('assistant-activity'),
                    kind: 'session.state',
                    tone: event.payload.state === 'error' ? 'error' : 'info',
                    summary: event.payload.message,
                    turnId: event.turnId || null,
                    createdAt: event.createdAt
                }
            }, eventSession.id, eventThreadId)
        }
        return
    }

    if (event.type === 'thread.started') {
        const existing = deps.findThreadRecord(event.threadId)
        if (!existing && event.payload.source === 'subagent') {
            const parentProviderThreadId = event.payload.parentProviderThreadId || null
            const parentRecord = parentProviderThreadId ? deps.findThreadRecord(parentProviderThreadId) : null
            const parentThread = parentRecord?.thread || null
            const parentSession = parentRecord?.session || eventSession
            if (!parentSession) return

            const thread: AssistantThread = {
                id: createAssistantId('assistant-thread'),
                providerThreadId: event.payload.providerThreadId,
                source: 'subagent',
                parentThreadId: parentThread?.id || null,
                providerParentThreadId: parentProviderThreadId,
                subagentDepth: event.payload.subagentDepth ?? null,
                agentNickname: event.payload.agentNickname || null,
                agentRole: event.payload.agentRole || null,
                model: parentThread?.model || '',
                cwd: event.payload.cwd || parentThread?.cwd || null,
                messageCount: 0,
                lastSeenCompletedTurnId: null,
                runtimeMode: parentThread?.runtimeMode || 'approval-required',
                interactionMode: parentThread?.interactionMode || 'default',
                state: event.payload.state || 'ready',
                lastError: null,
                createdAt: event.createdAt,
                updatedAt: event.createdAt,
                latestTurn: null,
                activePlan: null,
                messages: [],
                proposedPlans: [],
                activities: [],
                pendingApprovals: [],
                pendingUserInputs: []
            }
            deps.appendEvent('thread.created', event.createdAt, {
                sessionId: parentSession.id,
                thread,
                makeActive: false
            }, parentSession.id, thread.id)
            return
        }

        if (!eventSession && !existing) return

        const targetThreadId = existing?.thread.id || event.threadId
        deps.appendEvent('thread.updated', event.createdAt, {
            threadId: targetThreadId,
            patch: {
                providerThreadId: event.payload.providerThreadId,
                source: event.payload.source || existing?.thread.source || 'root',
                providerParentThreadId: event.payload.parentProviderThreadId ?? existing?.thread.providerParentThreadId ?? null,
                parentThreadId: existing?.thread.parentThreadId || null,
                subagentDepth: event.payload.subagentDepth ?? existing?.thread.subagentDepth ?? null,
                agentNickname: event.payload.agentNickname ?? existing?.thread.agentNickname ?? null,
                agentRole: event.payload.agentRole ?? existing?.thread.agentRole ?? null,
                cwd: event.payload.cwd ?? existing?.thread.cwd ?? null,
                state: event.payload.state || 'ready',
                updatedAt: event.createdAt
            }
        }, existing?.session.id || eventSession!.id, targetThreadId)
        return
    }

    if (event.type === 'turn.started') {
        if (!eventSession) return
        const existingThread = eventThreadRecord?.thread || deps.requireThread(event.threadId)
        deps.appendEvent('thread.updated', event.createdAt, {
            threadId: eventThreadId,
            patch: {
                state: 'running',
                model: event.payload.model || existingThread.model,
                interactionMode: event.payload.interactionMode,
                lastError: null,
                activePlan: null,
                updatedAt: event.createdAt
            }
        }, eventSession.id, eventThreadId)
        if (existingThread.latestTurn) {
            deps.appendEvent('thread.latest-turn.updated', event.createdAt, {
                threadId: eventThreadId,
                latestTurn: {
                    ...existingThread.latestTurn,
                    effort: event.payload.effort || existingThread.latestTurn.effort || null,
                    serviceTier: event.payload.serviceTier || existingThread.latestTurn.serviceTier || null
                }
            }, eventSession.id, eventThreadId)
        }
        return
    }

    if (event.type === 'turn.completed') {
        if (!eventSession) return
        const existingThread = eventThreadRecord?.thread || deps.requireThread(event.threadId)
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
        deps.appendEvent('thread.latest-turn.updated', event.createdAt, { threadId: eventThreadId, latestTurn }, eventSession.id, eventThreadId)
        deps.appendEvent('thread.updated', event.createdAt, {
            threadId: eventThreadId,
            patch: {
                state: event.payload.outcome === 'completed' ? 'ready' : event.payload.outcome === 'failed' ? 'error' : 'interrupted',
                lastError: event.payload.errorMessage || null,
                updatedAt: event.createdAt
            }
        }, eventSession.id, eventThreadId)
        return
    }

    if (event.type === 'thread.token-usage.updated') {
        if (!eventSession) return
        const existingThread = eventThreadRecord?.thread || deps.requireThread(event.threadId)
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
        deps.appendEvent('thread.latest-turn.updated', event.createdAt, { threadId: eventThreadId, latestTurn }, eventSession.id, eventThreadId)
        return
    }

    if (event.type === 'content.delta' && event.payload.streamKind === 'assistant_text') {
        if (!eventSession) return
        if (deps.isAssistantTextSuppressed(eventThreadId, event.turnId || null)) return
        const messageId = `assistant-message-${event.itemId || event.turnId || event.eventId}`
        deps.queueAssistantTextDelta({
            sessionId: eventSession.id,
            threadId: eventThreadId,
            messageId,
            delta: event.payload.delta,
            turnId: event.turnId || null,
            occurredAt: event.createdAt
        })
        deps.updateLatestTurnAssistantMessage(eventSession.id, eventThreadId, messageId, event.createdAt)
        return
    }

    if (event.type === 'content.completed' && event.payload.streamKind === 'assistant_text') {
        if (!eventSession) return
        if (deps.isAssistantTextSuppressed(eventThreadId, event.turnId || null)) return
        const messageId = `assistant-message-${event.itemId || event.turnId || event.eventId}`
        deps.flushAssistantTextDelta({ threadId: eventThreadId, messageId })
        const existing = (eventThreadRecord?.thread || deps.requireThread(event.threadId)).messages.find((message) => message.id === messageId)
        if (!existing && event.payload.text) {
            deps.appendEvent('thread.message.assistant.delta', event.createdAt, {
                threadId: eventThreadId,
                messageId,
                delta: event.payload.text,
                turnId: event.turnId || null
            }, eventSession.id, eventThreadId)
        }
        deps.appendEvent('thread.message.assistant.completed', event.createdAt, { threadId: eventThreadId, messageId }, eventSession.id, eventThreadId)
        deps.updateLatestTurnAssistantMessage(eventSession.id, eventThreadId, messageId, event.createdAt)

        const planMarkdown = extractProposedPlanMarkdown(event.payload.text)
        if (planMarkdown) {
            deps.appendEvent('thread.proposed-plan.upserted', event.createdAt, {
                threadId: eventThreadId,
                plan: {
                    id: `assistant-plan-${event.turnId || event.itemId || event.eventId}`,
                    turnId: event.turnId || null,
                    planMarkdown,
                    createdAt: event.createdAt,
                    updatedAt: event.createdAt
                }
            }, eventSession.id, eventThreadId)
        }
        return
    }

    if (event.type === 'content.delta' && event.payload.streamKind === 'plan_text') {
        const key = `${eventThreadId}:${event.turnId || event.itemId || 'active'}`
        deps.planBuffers.set(key, `${deps.planBuffers.get(key) || ''}${event.payload.delta}`)
        return
    }

    if (event.type === 'content.completed' && event.payload.streamKind === 'plan_text') {
        if (!eventSession) return
        const key = `${eventThreadId}:${event.turnId || event.itemId || 'active'}`
        const buffered = deps.planBuffers.get(key) || ''
        const planMarkdown = String(event.payload.text || buffered || '').trim()
        deps.planBuffers.delete(key)
        if (planMarkdown) {
            deps.appendEvent('thread.proposed-plan.upserted', event.createdAt, {
                threadId: eventThreadId,
                plan: {
                    id: `assistant-plan-${event.turnId || event.itemId || event.eventId}`,
                    turnId: event.turnId || null,
                    planMarkdown,
                    createdAt: event.createdAt,
                    updatedAt: event.createdAt
                }
            }, eventSession.id, eventThreadId)
        }
        return
    }

    if (event.type === 'content.delta' && (event.payload.streamKind === 'command_output' || event.payload.streamKind === 'file_change_output')) {
        if (!eventSession) return
        const activityId = buildCodexItemActivityId(event.itemId) || createAssistantId('assistant-activity')
        const existingThread = eventThreadRecord?.thread || deps.requireThread(event.threadId)
        const existingActivity = existingThread.activities.find((activity) => activity.id === activityId) || null
        const activity = buildStreamingToolActivity({
            existing: existingActivity,
            activityId,
            kind: event.payload.streamKind === 'command_output' ? 'command' : 'file-change',
            delta: event.payload.delta,
            turnId: event.turnId || null,
            itemId: event.itemId,
            occurredAt: event.createdAt
        })
        deps.appendEvent('thread.activity.appended', event.createdAt, { threadId: eventThreadId, activity }, eventSession.id, eventThreadId)
        return
    }

    if (event.type === 'plan.updated') {
        if (!eventSession) return
        deps.appendEvent('thread.plan.updated', event.createdAt, {
            threadId: eventThreadId,
            activePlan: {
                explanation: event.payload.explanation,
                plan: event.payload.plan,
                turnId: event.turnId || null,
                updatedAt: event.createdAt
            }
        }, eventSession.id, eventThreadId)
        return
    }

    if (event.type === 'approval.requested' || event.type === 'approval.resolved') {
        if (!eventSession) return
        const existingThread = eventThreadRecord?.thread || deps.requireThread(event.threadId)
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
        deps.appendEvent('thread.approval.updated', event.createdAt, { threadId: eventThreadId, approval }, eventSession.id, eventThreadId)
        deps.appendEvent('thread.activity.appended', event.createdAt, {
            threadId: eventThreadId,
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
        }, eventSession.id, eventThreadId)
        return
    }

    if (event.type === 'user-input.requested' || event.type === 'user-input.resolved') {
        if (!eventSession) return
        const existingThread = eventThreadRecord?.thread || deps.requireThread(event.threadId)
        const current = existingThread.pendingUserInputs.find((entry) => entry.requestId === event.requestId)
        const wasAlreadyResolved = current?.status === 'resolved'
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
        deps.appendEvent('thread.user-input.updated', event.createdAt, { threadId: eventThreadId, userInput }, eventSession.id, eventThreadId)
        if (event.type === 'user-input.resolved' && !wasAlreadyResolved) {
            const answers = event.payload.answers || {}
            const answeredCount = Object.values(answers).filter((value) => {
                if (Array.isArray(value)) return value.length > 0
                return String(value || '').trim().length > 0
            }).length
            deps.appendEvent('thread.activity.appended', event.createdAt, {
                threadId: eventThreadId,
                activity: {
                    id: createAssistantId('assistant-activity'),
                    kind: 'user-input.resolved',
                    tone: 'tool',
                    summary: 'Consulted user',
                    detail: `${answeredCount}/${userInput.questions.length} answers captured`,
                    turnId: event.turnId || null,
                    createdAt: event.createdAt,
                    payload: {
                        requestId: userInput.requestId,
                        questions: userInput.questions,
                        answers,
                        answeredCount,
                        questionCount: userInput.questions.length
                    }
                }
            }, eventSession.id, eventThreadId)
        }
        return
    }

    if (event.type === 'activity') {
        if (!eventSession) return
        const existingThread = eventThreadRecord?.thread || deps.requireThread(event.threadId)
        const payload = { ...(event.payload.data || {}) }
        const senderRecord = typeof payload['senderThreadId'] === 'string' ? deps.findThreadRecord(String(payload['senderThreadId'])) : null
        const receiverProviderThreadIds = Array.isArray(payload['receiverThreadIds'])
            ? payload['receiverThreadIds'].filter((entry): entry is string => typeof entry === 'string')
            : []
        const receiverRecords = receiverProviderThreadIds
            .map((threadId) => deps.findThreadRecord(threadId))
            .filter(Boolean) as Array<{ session: AssistantSession; thread: AssistantThread }>
        if (senderRecord) {
            payload['senderLocalThreadId'] = senderRecord.thread.id
        }
        if (receiverRecords.length > 0) {
            payload['receiverLocalThreadIds'] = receiverRecords.map((entry) => entry.thread.id)
            payload['receiverThreadLabels'] = receiverRecords.map((entry) => ({
                threadId: entry.thread.id,
                providerThreadId: entry.thread.providerThreadId,
                label: entry.thread.agentNickname || entry.thread.agentRole || 'Subagent',
                role: entry.thread.agentRole || null,
                nickname: entry.thread.agentNickname || null,
                state: entry.thread.state
            }))
        }
        const turnId = event.turnId || null
        const turnDiffTargetActivity = readRuntimePayloadString(payload['category']) === 'turn-diff'
            ? findLatestFileChangeActivity(existingThread, turnId)
            : null
        if (turnDiffTargetActivity) {
            payload['category'] = readRuntimePayloadString(turnDiffTargetActivity.payload?.['category']) || 'file-change'
        }
        const targetActivityId = turnDiffTargetActivity?.id || event.payload.activityId
        const existingActivity = targetActivityId
            ? existingThread.activities.find((activity) => activity.id === targetActivityId) || null
            : null
        const activity = mergeRuntimeFileChangeActivity(
            existingActivity,
            {
                ...event.payload,
                activityId: targetActivityId,
                data: payload
            },
            turnId,
            event.createdAt
        )
        deps.appendEvent('thread.activity.appended', event.createdAt, {
            threadId: eventThreadId,
            activity
        }, eventSession.id, eventThreadId)
    }
}
