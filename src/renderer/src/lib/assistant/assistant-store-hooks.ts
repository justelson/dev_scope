import { useEffect, useRef, useSyncExternalStore } from 'react'
import type {
    AssistantApprovalResponseInput,
    AssistantLatestTurn,
    AssistantModelInfo,
    AssistantSendPromptOptions,
    AssistantSnapshot
} from '@shared/assistant/contracts'
import {
    getActiveAssistantThread,
    getAssistantActivePlan,
    getAssistantActivityFeed,
    getAssistantLatestProposedPlan,
    getAssistantPendingApprovals,
    getAssistantPendingUserInputs,
    getAssistantThreadPhase,
    getAssistantThreadPhaseLabel,
    getAssistantTimelineMessages,
    getSelectedAssistantSession
} from './selectors'
import { assistantStore, type AssistantStoreState } from './assistant-store-core'

type AssistantWorkspaceSelection = {
    knownModels: AssistantModelInfo[]
    available: boolean
    connected: boolean
    loading: boolean
    bootstrapped: boolean
    modelsLoading: boolean
    commandPending: boolean
    commandError: string | null
    selectedSession: ReturnType<typeof getSelectedAssistantSession>
    activeThread: ReturnType<typeof getActiveAssistantThread>
    timelineMessages: ReturnType<typeof getAssistantTimelineMessages>
    activityFeed: ReturnType<typeof getAssistantActivityFeed>
    pendingApprovals: ReturnType<typeof getAssistantPendingApprovals>
    pendingUserInputs: ReturnType<typeof getAssistantPendingUserInputs>
    activePlan: ReturnType<typeof getAssistantActivePlan>
    latestProposedPlan: ReturnType<typeof getAssistantLatestProposedPlan>
    phase: ReturnType<typeof getAssistantThreadPhase>
    phaseLabel: string
}

type AssistantSessionsRailSelection = {
    sessions: AssistantSnapshot['sessions']
    activeSessionId: string | null
    commandPending: boolean
}

function areAssistantModelsEqual(left: AssistantModelInfo[], right: AssistantModelInfo[]): boolean {
    if (left === right) return true
    if (left.length !== right.length) return false
    for (let index = 0; index < left.length; index += 1) {
        if (
            left[index]?.id !== right[index]?.id
            || left[index]?.label !== right[index]?.label
            || left[index]?.description !== right[index]?.description
        ) {
            return false
        }
    }
    return true
}

function areAssistantLatestTurnsEqual(left: AssistantLatestTurn | null, right: AssistantLatestTurn | null): boolean {
    if (left === right) return true
    if (!left || !right) return left === right
    return left.id === right.id
        && left.state === right.state
        && left.requestedAt === right.requestedAt
        && left.startedAt === right.startedAt
        && left.completedAt === right.completedAt
        && left.assistantMessageId === right.assistantMessageId
        && left.effort === right.effort
        && left.serviceTier === right.serviceTier
        && left.usage?.totalTokens === right.usage?.totalTokens
        && left.usage?.inputTokens === right.usage?.inputTokens
        && left.usage?.outputTokens === right.usage?.outputTokens
        && left.usage?.reasoningOutputTokens === right.usage?.reasoningOutputTokens
        && left.usage?.cachedInputTokens === right.usage?.cachedInputTokens
        && left.usage?.modelContextWindow === right.usage?.modelContextWindow
}

function areAssistantSessionsEqual(
    left: AssistantWorkspaceSelection['selectedSession'],
    right: AssistantWorkspaceSelection['selectedSession']
): boolean {
    if (left === right) return true
    if (!left || !right) return left === right
    return left.id === right.id
        && left.title === right.title
        && left.projectPath === right.projectPath
        && left.archived === right.archived
        && left.createdAt === right.createdAt
        && left.updatedAt === right.updatedAt
        && left.activeThreadId === right.activeThreadId
}

function areAssistantThreadsEqual(
    left: AssistantWorkspaceSelection['activeThread'],
    right: AssistantWorkspaceSelection['activeThread']
): boolean {
    if (left === right) return true
    if (!left || !right) return left === right
    return left.id === right.id
        && left.providerThreadId === right.providerThreadId
        && left.model === right.model
        && left.cwd === right.cwd
        && left.messageCount === right.messageCount
        && left.lastSeenCompletedTurnId === right.lastSeenCompletedTurnId
        && left.runtimeMode === right.runtimeMode
        && left.interactionMode === right.interactionMode
        && left.state === right.state
        && left.lastError === right.lastError
        && left.createdAt === right.createdAt
        && left.updatedAt === right.updatedAt
        && areAssistantLatestTurnsEqual(left.latestTurn, right.latestTurn)
}

function getMessageListSignature(messages: AssistantWorkspaceSelection['timelineMessages']): string {
    if (messages.length === 0) return '0'
    const first = messages[0]
    const last = messages[messages.length - 1]
    return [
        messages.length,
        first?.id || '',
        first?.updatedAt || '',
        first?.streaming ? '1' : '0',
        last?.id || '',
        last?.updatedAt || '',
        last?.streaming ? '1' : '0'
    ].join('|')
}

function getActivityListSignature(activities: AssistantWorkspaceSelection['activityFeed']): string {
    if (activities.length === 0) return '0'
    const newest = activities[0]
    const oldest = activities[activities.length - 1]
    return [
        activities.length,
        newest?.id || '',
        newest?.createdAt || '',
        oldest?.id || '',
        oldest?.createdAt || ''
    ].join('|')
}

function getPendingApprovalSignature(items: AssistantWorkspaceSelection['pendingApprovals']): string {
    if (items.length === 0) return '0'
    const first = items[0]
    const last = items[items.length - 1]
    return [
        items.length,
        first?.requestId || '',
        first?.status || '',
        last?.requestId || '',
        last?.status || ''
    ].join('|')
}

function getPendingUserInputSignature(items: AssistantWorkspaceSelection['pendingUserInputs']): string {
    if (items.length === 0) return '0'
    const first = items[0]
    const last = items[items.length - 1]
    return [
        items.length,
        first?.requestId || '',
        first?.status || '',
        last?.requestId || '',
        last?.status || ''
    ].join('|')
}

function areAssistantPlansEqual(
    left: AssistantWorkspaceSelection['activePlan'],
    right: AssistantWorkspaceSelection['activePlan']
): boolean {
    if (left === right) return true
    if (!left || !right) return left === right
    return left.turnId === right.turnId
        && left.updatedAt === right.updatedAt
        && left.explanation === right.explanation
        && left.plan.length === right.plan.length
}

function areAssistantLatestProposedPlansEqual(
    left: AssistantWorkspaceSelection['latestProposedPlan'],
    right: AssistantWorkspaceSelection['latestProposedPlan']
): boolean {
    if (left === right) return true
    if (!left || !right) return left === right
    return left.id === right.id
        && left.turnId === right.turnId
        && left.createdAt === right.createdAt
        && left.updatedAt === right.updatedAt
        && left.planMarkdown === right.planMarkdown
}

function areAssistantWorkspaceSelectionsEqual(left: AssistantWorkspaceSelection, right: AssistantWorkspaceSelection): boolean {
    return left.available === right.available
        && left.connected === right.connected
        && left.loading === right.loading
        && left.bootstrapped === right.bootstrapped
        && left.modelsLoading === right.modelsLoading
        && left.commandPending === right.commandPending
        && left.commandError === right.commandError
        && left.phase.key === right.phase.key
        && left.phase.label === right.phase.label
        && areAssistantModelsEqual(left.knownModels, right.knownModels)
        && areAssistantSessionsEqual(left.selectedSession, right.selectedSession)
        && areAssistantThreadsEqual(left.activeThread, right.activeThread)
        && getMessageListSignature(left.timelineMessages) === getMessageListSignature(right.timelineMessages)
        && getActivityListSignature(left.activityFeed) === getActivityListSignature(right.activityFeed)
        && getPendingApprovalSignature(left.pendingApprovals) === getPendingApprovalSignature(right.pendingApprovals)
        && getPendingUserInputSignature(left.pendingUserInputs) === getPendingUserInputSignature(right.pendingUserInputs)
        && areAssistantPlansEqual(left.activePlan, right.activePlan)
        && areAssistantLatestProposedPlansEqual(left.latestProposedPlan, right.latestProposedPlan)
}

function getRailSessionSignature(session: AssistantSnapshot['sessions'][number]): string {
    const activeThread = session.threads.find((thread) => thread.id === session.activeThreadId) || null
    const earliestCreatedThread = session.threads.reduce<typeof activeThread>((earliest, thread) => {
        if (!earliest) return thread
        if (thread.createdAt.localeCompare(earliest.createdAt) < 0) return thread
        return earliest
    }, null)
    const hasVisibleChats = session.threads.some((thread) => (thread.messageCount || 0) > 0)

    return [
        session.id,
        session.title,
        session.projectPath || '',
        session.archived ? '1' : '0',
        session.createdAt,
        session.activeThreadId || '',
        hasVisibleChats ? '1' : '0',
        activeThread?.state || '',
        activeThread?.messageCount || 0,
        activeThread?.lastSeenCompletedTurnId || '',
        activeThread?.latestTurn?.id || '',
        activeThread?.latestTurn?.state || '',
        activeThread?.cwd || '',
        earliestCreatedThread?.cwd || ''
    ].join('|')
}

function areAssistantSessionsRailSelectionsEqual(left: AssistantSessionsRailSelection, right: AssistantSessionsRailSelection): boolean {
    if (left.activeSessionId !== right.activeSessionId || left.commandPending !== right.commandPending) {
        return false
    }
    if (left.sessions.length !== right.sessions.length) return false
    for (let index = 0; index < left.sessions.length; index += 1) {
        if (getRailSessionSignature(left.sessions[index]) !== getRailSessionSignature(right.sessions[index])) {
            return false
        }
    }
    return true
}

export function useAssistantStoreSelector<T>(
    selector: (state: AssistantStoreState) => T,
    isEqual: (left: T, right: T) => boolean = Object.is
): T {
    const selectedRef = useRef<T | null>(null)

    return useSyncExternalStore(
        assistantStore.subscribe,
        () => {
            const next = selector(assistantStore.getState())
            const previous = selectedRef.current
            if (previous !== null && isEqual(previous, next)) {
                return previous
            }
            selectedRef.current = next
            return next
        },
        () => {
            const next = selector(assistantStore.getState())
            const previous = selectedRef.current
            if (previous !== null && isEqual(previous, next)) {
                return previous
            }
            selectedRef.current = next
            return next
        }
    )
}

export function useAssistantStoreLifecycle() {
    useEffect(() => {
        assistantStore.retain()
        return () => {
            assistantStore.release()
        }
    }, [])
}

const assistantStoreActions = {
    refresh: () => assistantStore.refresh(),
    refreshModels: () => assistantStore.refreshModels(true),
    createSession: (title?: string, projectPath?: string) => assistantStore.createSession(title, projectPath).then(() => undefined),
    selectSession: (sessionId: string, options?: { force?: boolean }) => assistantStore.selectSession(sessionId, options).then(() => undefined),
    renameSession: (sessionId: string, title: string) => assistantStore.renameSession(sessionId, title).then(() => undefined),
    archiveSession: (sessionId: string, archived = true) => assistantStore.archiveSession(sessionId, archived).then(() => undefined),
    deleteSession: (sessionId: string) => assistantStore.deleteSession(sessionId).then(() => undefined),
    deleteMessage: (messageId: string, sessionId?: string) => assistantStore.deleteMessage({ messageId, sessionId }).then(() => undefined),
    deleteMessageResult: (messageId: string, sessionId?: string) => assistantStore.deleteMessage({ messageId, sessionId }),
    clearLogs: (sessionId?: string) => assistantStore.clearLogs(sessionId ? { sessionId } : undefined).then(() => undefined),
    clearLogsResult: (sessionId?: string) => assistantStore.clearLogs(sessionId ? { sessionId } : undefined),
    clearCommandError: () => assistantStore.clearError(),
    setSessionProjectPath: (sessionId: string, projectPath: string | null) => assistantStore.setSessionProjectPath(sessionId, projectPath).then(() => undefined),
    newThread: (sessionId?: string) => assistantStore.newThread(sessionId).then(() => undefined),
    sendPrompt: (prompt: string, options?: AssistantSendPromptOptions) => assistantStore.sendPrompt(prompt, options).then(() => undefined),
    sendPromptResult: (prompt: string, options?: AssistantSendPromptOptions) => assistantStore.sendPrompt(prompt, options),
    interruptTurn: (turnId?: string, sessionId?: string) => assistantStore.interruptTurn(turnId, sessionId).then(() => undefined),
    connect: (sessionId?: string) => assistantStore.connect(sessionId ? { sessionId } : undefined).then(() => undefined),
    disconnect: (sessionId?: string) => assistantStore.disconnect(sessionId).then(() => undefined),
    respondApproval: (requestId: string, decision: AssistantApprovalResponseInput['decision']) =>
        assistantStore.respondApproval({ requestId, decision }).then(() => undefined),
    respondUserInput: (requestId: string, answers: Record<string, string | string[]>) =>
        assistantStore.respondUserInput({ requestId, answers }).then(() => undefined),
    chooseProjectPath: (sessionId: string) => assistantStore.chooseProjectPath(sessionId).then(() => undefined),
    createProjectSession: () => assistantStore.createProjectSession().then(() => undefined)
}

export function useAssistantSessionsRailStore() {
    useAssistantStoreLifecycle()
    const rail = useAssistantStoreSelector<AssistantSessionsRailSelection>((state) => ({
        sessions: state.snapshot.sessions,
        activeSessionId: state.snapshot.selectedSessionId,
        commandPending: state.commandPending || state.modelsLoading
    }), areAssistantSessionsRailSelectionsEqual)

    return {
        ...rail,
        ...assistantStoreActions
    }
}

export function useAssistantStore() {
    useAssistantStoreLifecycle()
    const workspace = useAssistantStoreSelector<AssistantWorkspaceSelection>((state) => {
        const selectedSession = getSelectedAssistantSession(state.snapshot)
        const activeThread = getActiveAssistantThread(selectedSession)
        const phase = getAssistantThreadPhase(activeThread)

        return {
            knownModels: state.snapshot.knownModels,
            available: state.status.available,
            connected: state.status.connected,
            loading: state.hydrating,
            bootstrapped: state.hydrated,
            modelsLoading: state.modelsLoading,
            commandPending: state.commandPending || state.modelsLoading,
            commandError: state.error,
            selectedSession,
            activeThread,
            timelineMessages: getAssistantTimelineMessages(activeThread),
            activityFeed: getAssistantActivityFeed(activeThread),
            pendingApprovals: getAssistantPendingApprovals(activeThread),
            pendingUserInputs: getAssistantPendingUserInputs(activeThread),
            activePlan: getAssistantActivePlan(activeThread),
            latestProposedPlan: getAssistantLatestProposedPlan(activeThread),
            phase,
            phaseLabel: getAssistantThreadPhaseLabel(activeThread)
        }
    }, areAssistantWorkspaceSelectionsEqual)

    return {
        ...workspace,
        status: {
            available: workspace.available,
            connected: workspace.connected
        },
        ...assistantStoreActions,
        chooseProjectPath: () => {
            if (!workspace.selectedSession) return Promise.resolve()
            return assistantStoreActions.chooseProjectPath(workspace.selectedSession.id)
        }
    }
}
