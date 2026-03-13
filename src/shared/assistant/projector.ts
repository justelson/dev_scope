import type {
    AssistantDomainEvent,
    AssistantMessage,
    AssistantPendingApproval,
    AssistantPendingUserInput,
    AssistantSession,
    AssistantSnapshot,
    AssistantThread
} from './contracts'

function cloneSnapshot(snapshot: AssistantSnapshot): AssistantSnapshot {
    return JSON.parse(JSON.stringify(snapshot)) as AssistantSnapshot
}

function findSession(snapshot: AssistantSnapshot, sessionId: string): AssistantSession | undefined {
    return snapshot.sessions.find((session) => session.id === sessionId)
}

function findThread(snapshot: AssistantSnapshot, threadId: string): AssistantThread | undefined {
    for (const session of snapshot.sessions) {
        const thread = session.threads.find((entry) => entry.id === threadId)
        if (thread) return thread
    }
    return undefined
}

function findThreadOwner(snapshot: AssistantSnapshot, threadId: string): AssistantSession | undefined {
    return snapshot.sessions.find((session) => session.threads.some((entry) => entry.id === threadId))
}

function upsertMessage(messages: AssistantMessage[], nextMessage: AssistantMessage): AssistantMessage[] {
    const existingIndex = messages.findIndex((message) => message.id === nextMessage.id)
    if (existingIndex < 0) return [...messages, nextMessage]
    const nextMessages = [...messages]
    nextMessages[existingIndex] = nextMessage
    return nextMessages
}

function sortThreadsNewestFirst(threadIds: string[], threads: AssistantThread[]): string[] {
    const updatedAtById = new Map(threads.map((thread) => [thread.id, thread.updatedAt] as const))
    return [...threadIds].sort((left, right) => {
        const leftUpdatedAt = updatedAtById.get(left) || ''
        const rightUpdatedAt = updatedAtById.get(right) || ''
        return rightUpdatedAt.localeCompare(leftUpdatedAt) || right.localeCompare(left)
    })
}

function pickNextSelectedSessionId(snapshot: AssistantSnapshot, removedSessionId: string): string | null {
    if (snapshot.selectedSessionId !== removedSessionId) return snapshot.selectedSessionId
    const nextSession = snapshot.sessions.find((session) => !session.archived) || snapshot.sessions[0]
    return nextSession?.id || null
}

export function createDefaultAssistantSnapshot(): AssistantSnapshot {
    return {
        snapshotSequence: 0,
        updatedAt: new Date(0).toISOString(),
        selectedSessionId: null,
        sessions: [],
        knownModels: []
    }
}

export function applyAssistantDomainEvent(snapshot: AssistantSnapshot, event: AssistantDomainEvent): AssistantSnapshot {
    const next = cloneSnapshot(snapshot)
    next.snapshotSequence = event.sequence
    next.updatedAt = event.occurredAt

    switch (event.type) {
        case 'session.created': {
            const session = event.payload['session'] as AssistantSession
            next.sessions.push(session)
            next.selectedSessionId = session.id
            break
        }
        case 'session.selected': {
            next.selectedSessionId = String(event.payload['sessionId'] || '') || null
            break
        }
        case 'session.updated': {
            const sessionId = String(event.payload['sessionId'] || '')
            const session = findSession(next, sessionId)
            if (!session) break
            Object.assign(session, event.payload['patch'])
            session.threadIds = sortThreadsNewestFirst(session.threadIds, session.threads)
            break
        }
        case 'session.deleted': {
            const sessionId = String(event.payload['sessionId'] || '')
            next.sessions = next.sessions.filter((session) => session.id !== sessionId)
            next.selectedSessionId = pickNextSelectedSessionId(next, sessionId)
            break
        }
        case 'thread.created': {
            const sessionId = String(event.payload['sessionId'] || '')
            const session = findSession(next, sessionId)
            const thread = event.payload['thread'] as AssistantThread
            if (!session) break
            session.threads.unshift(thread)
            session.threadIds = sortThreadsNewestFirst([thread.id, ...session.threadIds], session.threads)
            session.activeThreadId = thread.id
            session.updatedAt = event.occurredAt
            break
        }
        case 'thread.updated': {
            const threadId = String(event.payload['threadId'] || '')
            const thread = findThread(next, threadId)
            const owner = findThreadOwner(next, threadId)
            if (!thread || !owner) break
            Object.assign(thread, event.payload['patch'])
            thread.updatedAt = String((event.payload['patch'] as Record<string, unknown>)?.['updatedAt'] || event.occurredAt)
            owner.updatedAt = thread.updatedAt
            owner.threadIds = sortThreadsNewestFirst(owner.threadIds, owner.threads)
            break
        }
        case 'thread.message.user':
        case 'thread.message.assistant.delta':
        case 'thread.message.assistant.completed': {
            const threadId = String(event.payload['threadId'] || event.threadId || '')
            const thread = findThread(next, threadId)
            const owner = findThreadOwner(next, threadId)
            if (!thread || !owner) break
            if (event.type === 'thread.message.assistant.delta') {
                const messageId = String(event.payload['messageId'] || '')
                const delta = String(event.payload['delta'] || '')
                const existing = thread.messages.find((message) => message.id === messageId)
                const nextMessage: AssistantMessage = existing
                    ? {
                        ...existing,
                        role: 'assistant',
                        text: `${existing.text}${delta}`,
                        streaming: true,
                        updatedAt: event.occurredAt
                    }
                    : {
                        id: messageId,
                        role: 'assistant',
                        text: delta,
                        turnId: String(event.payload['turnId'] || '') || null,
                        streaming: true,
                        createdAt: event.occurredAt,
                        updatedAt: event.occurredAt
                    }
                thread.messages = upsertMessage(thread.messages, nextMessage)
            } else if (event.type === 'thread.message.assistant.completed') {
                const messageId = String(event.payload['messageId'] || '')
                const existing = thread.messages.find((message) => message.id === messageId)
                if (existing) {
                    thread.messages = upsertMessage(thread.messages, {
                        ...existing,
                        streaming: false,
                        updatedAt: event.occurredAt
                    })
                }
            } else {
                thread.messages = upsertMessage(thread.messages, event.payload['message'] as AssistantMessage)
            }
            thread.updatedAt = event.occurredAt
            owner.updatedAt = event.occurredAt
            break
        }
        case 'thread.plan.updated': {
            const threadId = String(event.payload['threadId'] || event.threadId || '')
            const thread = findThread(next, threadId)
            const owner = findThreadOwner(next, threadId)
            if (!thread || !owner) break
            thread.activePlan = event.payload['activePlan'] as AssistantThread['activePlan']
            thread.updatedAt = event.occurredAt
            owner.updatedAt = event.occurredAt
            break
        }
        case 'thread.proposed-plan.upserted': {
            const threadId = String(event.payload['threadId'] || event.threadId || '')
            const thread = findThread(next, threadId)
            const owner = findThreadOwner(next, threadId)
            if (!thread || !owner) break
            const plan = event.payload['plan'] as AssistantThread['proposedPlans'][number]
            const index = thread.proposedPlans.findIndex((entry) => entry.id === plan.id)
            if (index < 0) thread.proposedPlans.push(plan)
            else thread.proposedPlans[index] = plan
            thread.updatedAt = event.occurredAt
            owner.updatedAt = event.occurredAt
            break
        }
        case 'thread.activity.appended': {
            const threadId = String(event.payload['threadId'] || event.threadId || '')
            const thread = findThread(next, threadId)
            const owner = findThreadOwner(next, threadId)
            if (!thread || !owner) break
            const activity = event.payload['activity'] as AssistantThread['activities'][number]
            const index = thread.activities.findIndex((entry) => entry.id === activity.id)
            if (index < 0) thread.activities.push(activity)
            else thread.activities[index] = activity
            thread.updatedAt = event.occurredAt
            owner.updatedAt = event.occurredAt
            break
        }
        case 'thread.approval.updated': {
            const threadId = String(event.payload['threadId'] || event.threadId || '')
            const thread = findThread(next, threadId)
            const owner = findThreadOwner(next, threadId)
            if (!thread || !owner) break
            const approval = event.payload['approval'] as AssistantPendingApproval
            const index = thread.pendingApprovals.findIndex((entry) => entry.requestId === approval.requestId)
            if (index < 0) thread.pendingApprovals.push(approval)
            else thread.pendingApprovals[index] = approval
            thread.pendingApprovals = [...thread.pendingApprovals].sort((left, right) => left.createdAt.localeCompare(right.createdAt))
            thread.updatedAt = event.occurredAt
            owner.updatedAt = event.occurredAt
            break
        }
        case 'thread.user-input.updated': {
            const threadId = String(event.payload['threadId'] || event.threadId || '')
            const thread = findThread(next, threadId)
            const owner = findThreadOwner(next, threadId)
            if (!thread || !owner) break
            const userInput = event.payload['userInput'] as AssistantPendingUserInput
            const index = thread.pendingUserInputs.findIndex((entry) => entry.requestId === userInput.requestId)
            if (index < 0) thread.pendingUserInputs.push(userInput)
            else thread.pendingUserInputs[index] = userInput
            thread.pendingUserInputs = [...thread.pendingUserInputs].sort((left, right) => left.createdAt.localeCompare(right.createdAt))
            thread.updatedAt = event.occurredAt
            owner.updatedAt = event.occurredAt
            break
        }
        case 'thread.latest-turn.updated': {
            const threadId = String(event.payload['threadId'] || event.threadId || '')
            const thread = findThread(next, threadId)
            const owner = findThreadOwner(next, threadId)
            if (!thread || !owner) break
            thread.latestTurn = event.payload['latestTurn'] as AssistantThread['latestTurn']
            thread.updatedAt = event.occurredAt
            owner.updatedAt = event.occurredAt
            break
        }
    }

    next.sessions = [...next.sessions].sort((left, right) =>
        right.updatedAt.localeCompare(left.updatedAt) || right.id.localeCompare(left.id)
    )

    return next
}
