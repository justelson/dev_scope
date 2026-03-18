import type {
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
    findSessionByThreadId: (threadId: string) => AssistantSession | null
    requireThread: (threadId: string) => AssistantThread
    appendEvent: (
        type: AssistantDomainEvent['type'],
        occurredAt: string,
        payload: Record<string, unknown>,
        sessionId?: string,
        threadId?: string
    ) => void
    updateLatestTurnAssistantMessage: (sessionId: string, threadId: string, assistantMessageId: string, occurredAt: string) => void
}

export function handleAssistantRuntimeEvent(event: AssistantRuntimeEvent, deps: AssistantRuntimeEventHandlerDeps): void {
    const session = deps.findSessionByThreadId(event.threadId)
    if (!session) return

    if (event.type === 'session.state.changed') {
        deps.appendEvent('thread.updated', event.createdAt, {
            threadId: event.threadId,
            patch: {
                state: event.payload.state,
                lastError: event.payload.error || null,
                updatedAt: event.createdAt
            }
        }, session.id, event.threadId)
        if (event.payload.message) {
            deps.appendEvent('thread.activity.appended', event.createdAt, {
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
        deps.appendEvent('thread.updated', event.createdAt, {
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
        const existingThread = deps.requireThread(event.threadId)
        deps.appendEvent('thread.updated', event.createdAt, {
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
            deps.appendEvent('thread.latest-turn.updated', event.createdAt, {
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
        const existingThread = deps.requireThread(event.threadId)
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
        deps.appendEvent('thread.latest-turn.updated', event.createdAt, { threadId: event.threadId, latestTurn }, session.id, event.threadId)
        deps.appendEvent('thread.updated', event.createdAt, {
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
        const existingThread = deps.requireThread(event.threadId)
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
        deps.appendEvent('thread.latest-turn.updated', event.createdAt, { threadId: event.threadId, latestTurn }, session.id, event.threadId)
        return
    }

    if (event.type === 'content.delta' && event.payload.streamKind === 'assistant_text') {
        const messageId = `assistant-message-${event.itemId || event.turnId || event.eventId}`
        deps.appendEvent('thread.message.assistant.delta', event.createdAt, {
            threadId: event.threadId,
            messageId,
            delta: event.payload.delta,
            turnId: event.turnId || null
        }, session.id, event.threadId)
        deps.updateLatestTurnAssistantMessage(session.id, event.threadId, messageId, event.createdAt)
        return
    }

    if (event.type === 'content.completed' && event.payload.streamKind === 'assistant_text') {
        const messageId = `assistant-message-${event.itemId || event.turnId || event.eventId}`
        const existing = deps.requireThread(event.threadId).messages.find((message) => message.id === messageId)
        if (!existing && event.payload.text) {
            deps.appendEvent('thread.message.assistant.delta', event.createdAt, {
                threadId: event.threadId,
                messageId,
                delta: event.payload.text,
                turnId: event.turnId || null
            }, session.id, event.threadId)
        }
        deps.appendEvent('thread.message.assistant.completed', event.createdAt, { threadId: event.threadId, messageId }, session.id, event.threadId)
        deps.updateLatestTurnAssistantMessage(session.id, event.threadId, messageId, event.createdAt)

        const planMarkdown = extractProposedPlanMarkdown(event.payload.text)
        if (planMarkdown) {
            deps.appendEvent('thread.proposed-plan.upserted', event.createdAt, {
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
        deps.planBuffers.set(key, `${deps.planBuffers.get(key) || ''}${event.payload.delta}`)
        return
    }

    if (event.type === 'content.completed' && event.payload.streamKind === 'plan_text') {
        const key = `${event.threadId}:${event.turnId || event.itemId || 'active'}`
        const buffered = deps.planBuffers.get(key) || ''
        const planMarkdown = String(event.payload.text || buffered || '').trim()
        deps.planBuffers.delete(key)
        if (planMarkdown) {
            deps.appendEvent('thread.proposed-plan.upserted', event.createdAt, {
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
        deps.appendEvent('thread.plan.updated', event.createdAt, {
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
        const existingThread = deps.requireThread(event.threadId)
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
        deps.appendEvent('thread.approval.updated', event.createdAt, { threadId: event.threadId, approval }, session.id, event.threadId)
        deps.appendEvent('thread.activity.appended', event.createdAt, {
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
        const existingThread = deps.requireThread(event.threadId)
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
        deps.appendEvent('thread.user-input.updated', event.createdAt, { threadId: event.threadId, userInput }, session.id, event.threadId)
        return
    }

    if (event.type === 'activity') {
        deps.appendEvent('thread.activity.appended', event.createdAt, {
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
