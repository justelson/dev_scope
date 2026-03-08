import type { AssistantActivity } from './assistant-page-types'

export type AssistantWorkLogEntry = {
    id: string
    turnId: string
    timestamp: number
    label: string
    detail?: string
    tone: 'thinking' | 'tool' | 'info' | 'error'
}

export type AssistantPhase = 'idle' | 'connecting' | 'waiting-approval' | 'waiting-input' | 'thinking' | 'answering'

function normalizeValue(value: unknown): string {
    return String(value || '').trim().replace(/\s+/g, ' ').toLowerCase()
}

function cleanValue(value: unknown): string {
    return String(value || '')
        .replace(/\r/g, ' ')
        .replace(/\n+/g, ' ')
        .replace(/\*\*/g, '')
        .replace(/`+/g, '')
        .replace(/\s+/g, ' ')
        .trim()
}

function humanizeMethod(method: unknown): string {
    const normalized = String(method || '').trim()
    if (!normalized) return ''

    return normalized
        .replace(/[._/-]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .replace(/\b\w/g, (char) => char.toUpperCase())
}

function compareActivitiesByOrder(left: AssistantActivity, right: AssistantActivity): number {
    if (left.timestamp !== right.timestamp) return left.timestamp - right.timestamp
    return `${left.attemptGroupId}:${left.method}:${left.summary}`.localeCompare(
        `${right.attemptGroupId}:${right.method}:${right.summary}`
    )
}

function getActivityPayload(activity: AssistantActivity): Record<string, unknown> {
    return activity.payload && typeof activity.payload === 'object' && !Array.isArray(activity.payload)
        ? activity.payload
        : {}
}

function getActivityDetail(activity: AssistantActivity): string | undefined {
    const payload = getActivityPayload(activity)
    const candidates = [
        payload.detail,
        payload.description,
        payload.command,
        payload.filePath,
        payload.path,
        payload.query,
        payload.url,
        payload.name,
        payload.tool,
        payload.target
    ]
    for (const candidate of candidates) {
        const cleaned = cleanValue(candidate)
        if (!cleaned) continue
        if (normalizeValue(cleaned) === normalizeValue(activity.summary)) continue
        return cleaned
    }
    return undefined
}

function getActivityLabel(activity: AssistantActivity): string {
    const payload = getActivityPayload(activity)
    const command = cleanValue(payload.command)
    const normalizedStatus = normalizeValue(payload.status)
    const normalizedMethod = normalizeValue(activity.method)
    const normalizedSummary = normalizeValue(activity.summary)

    if (command) {
        const isCompleted = normalizedStatus === 'completed'
            || normalizedStatus === 'complete'
            || normalizedStatus === 'success'
            || normalizedMethod.includes('complete')
            || normalizedMethod.includes('completed')
            || normalizedMethod.includes('result')
            || normalizedMethod.includes('resolved')
            || normalizedMethod.includes('finish')
            || normalizedMethod.includes('end')
            || normalizedSummary.includes('complete')
            || normalizedSummary.includes('completed')
            || normalizedSummary.includes('result')
            || normalizedSummary.includes('resolved')
            || normalizedSummary.includes('finished')
        const isFailed = normalizedStatus === 'failed'
            || normalizedStatus === 'error'
            || normalizedSummary.includes('failed')
            || normalizedSummary.includes('error')

        if (isFailed) return 'Command run failed'
        if (isCompleted) return 'Command run complete'
        return 'Command run'
    }

    return cleanValue(activity.summary) || humanizeMethod(activity.method)
}

function isSuppressedWorkEntry(activity: AssistantActivity): boolean {
    const normalizedMethod = normalizeValue(activity.method)
    const normalizedSummary = normalizeValue(activity.summary)
    return normalizedMethod === 'toolstarted'
        || normalizedMethod === 'taskstarted'
        || normalizedMethod === 'taskcompleted'
        || normalizedSummary === 'checkpoint captured'
}

function deriveTone(activity: AssistantActivity): AssistantWorkLogEntry['tone'] {
    const payload = getActivityPayload(activity)
    const normalizedStatus = normalizeValue(payload.status)
    const normalizedSummary = normalizeValue(activity.summary)
    if (
        normalizedStatus === 'failed'
        || normalizedStatus === 'error'
        || normalizedSummary.includes('failed')
        || normalizedSummary.includes('error')
    ) {
        return 'error'
    }
    if (activity.kind === 'reasoning') return 'thinking'
    if (activity.kind === 'result') return 'tool'
    if (activity.kind === 'search' || activity.kind === 'file' || activity.kind === 'tool' || activity.kind === 'command') return 'tool'
    return 'info'
}

export function deriveVisibleWorkEntries(
    activities: ReadonlyArray<AssistantActivity>,
    turnId?: string | null
): AssistantWorkLogEntry[] {
    const normalizedTurnId = String(turnId || '').trim()
    const entries = [...activities]
        .sort(compareActivitiesByOrder)
        .filter((activity) => (normalizedTurnId ? activity.turnId === normalizedTurnId : true))
        .filter((activity) => !isSuppressedWorkEntry(activity))
        .flatMap((activity): AssistantWorkLogEntry[] => {
            const label = getActivityLabel(activity)
            if (!label) return []
            return [{
                id: `${activity.turnId || 'turn'}:${activity.timestamp}:${activity.method}:${activity.summary}`,
                turnId: activity.turnId,
                timestamp: activity.timestamp,
                label,
                detail: getActivityDetail(activity),
                tone: deriveTone(activity)
            } satisfies AssistantWorkLogEntry]
        })

    return entries
}

export function deriveAssistantPhase(input: {
    isConnecting: boolean
    isSending: boolean
    isBusy: boolean
    streamingText?: string
    streamingTurnId?: string | null
    activeTurnId?: string | null
    hasPendingApproval?: boolean
    hasPendingUserInput?: boolean
}): AssistantPhase {
    if (input.isConnecting) return 'connecting'
    if (input.hasPendingApproval) return 'waiting-approval'
    if (input.hasPendingUserInput) return 'waiting-input'

    const hasStreamingText = cleanValue(input.streamingText || '').length > 0
    if (hasStreamingText) return 'answering'

    if (
        input.isSending
        || input.isBusy
        || String(input.streamingTurnId || '').trim().length > 0
        || String(input.activeTurnId || '').trim().length > 0
    ) {
        return 'thinking'
    }

    return 'idle'
}

export function getAssistantPhaseLabel(phase: AssistantPhase): string {
    switch (phase) {
        case 'connecting':
            return 'Connecting'
        case 'waiting-approval':
            return 'Pending approval'
        case 'waiting-input':
            return 'Awaiting input'
        case 'thinking':
            return 'Thinking'
        case 'answering':
            return 'Answering'
        default:
            return 'Ready'
    }
}
