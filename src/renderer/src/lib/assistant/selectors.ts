import type {
    AssistantActivePlan,
    AssistantMessage,
    AssistantPendingApproval,
    AssistantPendingUserInput,
    AssistantSession,
    AssistantSnapshot,
    AssistantThread
} from '@shared/assistant/contracts'

export function getSelectedAssistantSession(snapshot: AssistantSnapshot): AssistantSession | null {
    return snapshot.sessions.find((session) => session.id === snapshot.selectedSessionId) || null
}

export function getActiveAssistantThread(session: AssistantSession | null): AssistantThread | null {
    if (!session?.activeThreadId) return null
    return session.threads.find((thread) => thread.id === session.activeThreadId) || null
}

export function getVisibleAssistantSessions(snapshot: AssistantSnapshot, includeArchived = false): AssistantSession[] {
    return snapshot.sessions.filter((session) => includeArchived || !session.archived)
}

export function getAssistantPendingApprovals(thread: AssistantThread | null): AssistantPendingApproval[] {
    if (!thread) return []
    return thread.pendingApprovals.filter((approval) => approval.status === 'pending')
}

export function getAssistantPendingUserInputs(thread: AssistantThread | null): AssistantPendingUserInput[] {
    if (!thread) return []
    return thread.pendingUserInputs.filter((item) => item.status === 'pending')
}

export function getAssistantActivePlan(thread: AssistantThread | null): AssistantActivePlan | null {
    return thread?.activePlan || null
}

export function getAssistantLatestProposedPlan(thread: AssistantThread | null) {
    if (!thread || thread.proposedPlans.length === 0) return null
    return [...thread.proposedPlans].sort((left, right) =>
        right.updatedAt.localeCompare(left.updatedAt) || right.id.localeCompare(left.id)
    )[0]
}

export function getAssistantTimelineMessages(thread: AssistantThread | null): AssistantMessage[] {
    if (!thread) return []
    return [...thread.messages].sort((left, right) =>
        left.createdAt.localeCompare(right.createdAt) || left.id.localeCompare(right.id)
    )
}

export function getAssistantActivityFeed(thread: AssistantThread | null) {
    if (!thread) return []
    return [...thread.activities].sort((left, right) =>
        right.createdAt.localeCompare(left.createdAt) || right.id.localeCompare(left.id)
    )
}

export function getAssistantThreadPhase(thread: AssistantThread | null): {
    key: 'idle' | 'starting' | 'running' | 'waiting-approval' | 'waiting-input' | 'error' | 'stopped'
    label: string
} {
    if (!thread) return { key: 'idle', label: 'No active thread' }
    if (getAssistantPendingApprovals(thread).length > 0) {
        return { key: 'waiting-approval', label: 'Waiting for approval' }
    }
    if (getAssistantPendingUserInputs(thread).length > 0) {
        return { key: 'waiting-input', label: 'Waiting for input' }
    }

    switch (thread.state) {
        case 'idle':
            return { key: 'idle', label: 'Idle' }
        case 'starting':
            return { key: 'starting', label: 'Starting' }
        case 'ready':
            return { key: 'starting', label: 'Ready' }
        case 'running':
            return { key: 'running', label: 'Running' }
        case 'waiting':
            return { key: 'running', label: 'Waiting' }
        case 'interrupted':
            return { key: 'stopped', label: 'Interrupted' }
        case 'stopped':
            return { key: 'stopped', label: 'Stopped' }
        case 'error':
            return { key: 'error', label: 'Error' }
        default:
            return { key: 'idle', label: 'Unknown' }
    }
}

export function getAssistantThreadPhaseLabel(thread: AssistantThread | null): string {
    return getAssistantThreadPhase(thread).label
}

export function getAssistantSessionSubtitle(session: AssistantSession): string {
    const trimmedPath = String(session.projectPath || '').trim()
    if (!trimmedPath) return 'No project attached'
    const parts = trimmedPath.split(/[\\/]/).filter(Boolean)
    return parts[parts.length - 1] || trimmedPath
}

export function formatAssistantRelativeTime(value: string): string {
    const timestamp = Date.parse(value)
    if (!Number.isFinite(timestamp)) return value
    const deltaMs = Math.max(0, Date.now() - timestamp)
    if (deltaMs < 60_000) return 'now'
    const minutes = Math.floor(deltaMs / 60_000)
    if (minutes < 60) return `${minutes}m`
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `${hours}h`
    const days = Math.floor(hours / 24)
    if (days < 7) return `${days}d`
    return new Date(timestamp).toLocaleDateString()
}

export function formatAssistantDateTime(value: string): string {
    const timestamp = Date.parse(value)
    if (!Number.isFinite(timestamp)) return value

    return new Intl.DateTimeFormat(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit'
    }).format(new Date(timestamp))
}
