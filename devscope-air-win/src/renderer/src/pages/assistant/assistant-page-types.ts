export type AssistantState = 'offline' | 'connecting' | 'ready' | 'error'
export type AssistantRole = 'user' | 'assistant' | 'system'

export type AssistantStatus = {
    connected: boolean
    state: AssistantState
    approvalMode: 'safe' | 'yolo'
    provider: 'codex'
    model: string
    activeTurnId: string | null
    lastError: string | null
}

export type AssistantHistoryMessage = {
    id: string
    role: AssistantRole
    text: string
    attachments?: AssistantHistoryAttachment[]
    sourcePrompt?: string
    reasoningText?: string
    createdAt: number
    turnId?: string
    attemptGroupId?: string
    attemptIndex?: number
    isActiveAttempt?: boolean
}

export type AssistantHistoryAttachment = {
    path: string
    name?: string
    mimeType?: string
    kind?: 'image' | 'doc' | 'code' | 'file'
    sizeBytes?: number
    previewText?: string
    previewDataUrl?: string
    textPreview?: string
}

export type AssistantEvent = {
    type: string
    timestamp: number
    payload: Record<string, unknown>
}

export type AssistantReasoning = {
    turnId: string
    attemptGroupId: string
    text: string
    method: string
    timestamp: number
}

export type AssistantActivity = {
    turnId: string
    attemptGroupId: string
    kind: string
    summary: string
    method: string
    payload: Record<string, unknown>
    timestamp: number
}

export type AssistantApproval = {
    requestId: number
    method: string
    mode: 'safe' | 'yolo'
    decision?: 'decline' | 'acceptForSession'
    request?: Record<string, unknown>
    timestamp: number
    turnId?: string
    attemptGroupId?: string
}

export type AssistantSession = {
    id: string
    title: string
    archived: boolean
    createdAt: number
    updatedAt: number
    messageCount: number
    projectPath?: string
}

export type WorkflowKind = 'explain-diff' | 'review-staged' | 'draft-commit'

export type WorkflowState = {
    kind: WorkflowKind
    status: 'running' | 'success' | 'error'
    message: string
    turnId?: string
    at: number
}

export type TelemetryIntegrity = {
    eventsStored: number
    monotonicDescending: boolean
    newestTimestamp: number | null
    oldestTimestamp: number | null
}

export type ApprovalDecision = 'decline' | 'acceptForSession'

export const WORKFLOW_LABELS: Record<WorkflowKind, string> = {
    'explain-diff': 'Explain Diff',
    'review-staged': 'Review Staged',
    'draft-commit': 'Draft Commit'
}

export const CHAT_WORKFLOWS: WorkflowKind[] = ['explain-diff', 'review-staged']

export const INITIAL_STATUS: AssistantStatus = {
    connected: false,
    state: 'offline',
    approvalMode: 'safe',
    provider: 'codex',
    model: 'default',
    activeTurnId: null,
    lastError: null
}

export function parseApprovalDecision(value: unknown): ApprovalDecision | undefined {
    if (value === 'decline' || value === 'acceptForSession') return value
    return undefined
}

export function parseApprovalPayload(payload: Record<string, unknown>, timestamp: number): AssistantApproval | null {
    const requestIdRaw = payload.requestId
    const requestId = Number(requestIdRaw)
    if (!Number.isFinite(requestId)) return null

    const method = typeof payload.method === 'string' ? payload.method : ''
    if (!method.trim()) return null

    const mode = payload.mode === 'yolo' ? 'yolo' : 'safe'
    const turnId = typeof payload.turnId === 'string' ? payload.turnId : ''
    const attemptGroupId = typeof payload.attemptGroupId === 'string' ? payload.attemptGroupId : ''
    const request = typeof payload.request === 'object' && payload.request !== null
        ? payload.request as Record<string, unknown>
        : undefined

    return {
        requestId,
        method,
        mode,
        decision: parseApprovalDecision(payload.decision),
        request,
        timestamp,
        turnId,
        attemptGroupId
    }
}

export function parseApprovalDecisionPayload(
    payload: Record<string, unknown>
): { requestId: number; decision: ApprovalDecision } | null {
    const requestId = Number(payload.requestId)
    const decision = parseApprovalDecision(payload.decision)
    if (!Number.isFinite(requestId) || !decision) return null
    return { requestId, decision }
}

export function buildSessionScope(
    historyEntries: AssistantHistoryMessage[],
    activeTurnId: string | null,
    streamingTurnId: string | null
): { turnIds: Set<string>; attemptGroupIds: Set<string> } {
    const turnIds = new Set<string>()
    const attemptGroupIds = new Set<string>()

    for (const entry of historyEntries) {
        if (entry.turnId) turnIds.add(entry.turnId)
        if (entry.attemptGroupId) attemptGroupIds.add(entry.attemptGroupId)
    }
    if (activeTurnId) turnIds.add(activeTurnId)
    if (streamingTurnId) turnIds.add(streamingTurnId)

    return { turnIds, attemptGroupIds }
}

export function isTelemetryEventInScope(
    payload: Record<string, unknown>,
    scope: { turnIds: Set<string>; attemptGroupIds: Set<string> }
): boolean {
    const turnId = typeof payload.turnId === 'string' ? payload.turnId.trim() : ''
    const attemptGroupId = typeof payload.attemptGroupId === 'string' ? payload.attemptGroupId.trim() : ''

    if (turnId && scope.turnIds.has(turnId)) return true
    if (attemptGroupId && scope.attemptGroupIds.has(attemptGroupId)) return true
    return false
}
