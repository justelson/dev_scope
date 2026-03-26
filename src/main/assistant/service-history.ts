import type { AssistantLatestTurn, AssistantMessage, AssistantThread } from '../../shared/assistant/contracts'

type UserTurnEntry = {
    message: AssistantMessage
    index: number
    turnId: string | null
}

type AssistantDeleteMessagePlan = {
    rollbackTurnCount: number | null
    removedTurnIds: string[]
    patch: Pick<
        AssistantThread,
        | 'messages'
        | 'activities'
        | 'proposedPlans'
        | 'pendingApprovals'
        | 'pendingUserInputs'
        | 'activePlan'
        | 'latestTurn'
        | 'state'
        | 'lastError'
        | 'updatedAt'
    >
}

function getSortedMessages(thread: AssistantThread): AssistantMessage[] {
    return [...thread.messages].sort((left, right) => left.createdAt.localeCompare(right.createdAt) || left.id.localeCompare(right.id))
}

function inferTurnIdForUserMessage(messages: AssistantMessage[], index: number, targetMessageId: string, fallbackTurnId: string | null): string | null {
    for (let cursor = index + 1; cursor < messages.length; cursor += 1) {
        if (messages[cursor]?.role === 'user') break
        if (messages[cursor]?.turnId) return messages[cursor].turnId
    }

    return messages[index]?.id === targetMessageId ? fallbackTurnId : null
}

function getUserTurnEntries(messages: AssistantMessage[], targetMessageId: string, fallbackTurnId: string | null): UserTurnEntry[] {
    return messages
        .map((message, index) => message.role === 'user'
            ? {
                message,
                index,
                turnId: inferTurnIdForUserMessage(messages, index, targetMessageId, fallbackTurnId)
            }
            : null
        )
        .filter((entry): entry is UserTurnEntry => Boolean(entry))
}

function getLatestRemainingTurn(threadMessages: AssistantMessage[], orderedTurnIds: string[], removedTurnIds: Set<string>, occurredAt: string): AssistantLatestTurn | null {
    const remainingTurnIds = orderedTurnIds.filter((turnId) => !removedTurnIds.has(turnId))
    const latestRemainingTurnId = remainingTurnIds[remainingTurnIds.length - 1] || null
    if (!latestRemainingTurnId) return null

    const latestRemainingAssistantMessage = [...threadMessages]
        .reverse()
        .find((message) => message.role === 'assistant' && message.turnId === latestRemainingTurnId) || null

    return {
        id: latestRemainingTurnId,
        state: 'completed',
        requestedAt: latestRemainingAssistantMessage?.createdAt || occurredAt,
        startedAt: latestRemainingAssistantMessage?.createdAt || null,
        completedAt: latestRemainingAssistantMessage?.updatedAt || occurredAt,
        assistantMessageId: latestRemainingAssistantMessage?.id || null,
        effort: null,
        serviceTier: null,
        usage: null
    }
}

export function buildDeleteMessagePlan(thread: AssistantThread, messageId: string, occurredAt: string): AssistantDeleteMessagePlan {
    const messages = getSortedMessages(thread)
    const targetIndex = messages.findIndex((message) => message.id === messageId && message.role === 'user')
    if (targetIndex < 0) {
        throw new Error('User message not found.')
    }

    const userTurnEntries = getUserTurnEntries(messages, messageId, thread.latestTurn?.id || null)
    const targetEntry = userTurnEntries.find((entry) => entry.message.id === messageId)
    if (!targetEntry) {
        throw new Error('Unable to resolve message turn.')
    }

    const orderedTurnIds = userTurnEntries
        .map((entry) => entry.turnId)
        .filter((turnId, index, array): turnId is string => Boolean(turnId) && array.indexOf(turnId) === index)

    const targetTurnIndex = targetEntry.turnId ? orderedTurnIds.indexOf(targetEntry.turnId) : -1
    const removedTurnIds = new Set(targetTurnIndex >= 0 ? orderedTurnIds.slice(targetTurnIndex) : [])
    const keptMessages = messages.slice(0, targetIndex)
    const latestTurn = getLatestRemainingTurn(keptMessages, orderedTurnIds, removedTurnIds, occurredAt)

    return {
        rollbackTurnCount: targetTurnIndex >= 0 ? Math.max(1, orderedTurnIds.length - targetTurnIndex) : null,
        removedTurnIds: [...removedTurnIds],
        patch: {
            messages: keptMessages,
            activities: thread.activities.filter((activity) => !activity.turnId || !removedTurnIds.has(activity.turnId)),
            proposedPlans: thread.proposedPlans.filter((plan) => !plan.turnId || !removedTurnIds.has(plan.turnId)),
            pendingApprovals: thread.pendingApprovals.filter((approval) => !approval.turnId || !removedTurnIds.has(approval.turnId)),
            pendingUserInputs: thread.pendingUserInputs.filter((entry) => !entry.turnId || !removedTurnIds.has(entry.turnId)),
            activePlan: thread.activePlan && thread.activePlan.turnId && removedTurnIds.has(thread.activePlan.turnId) ? null : thread.activePlan,
            latestTurn,
            state: 'ready',
            lastError: null,
            updatedAt: occurredAt
        }
    }
}
