export type AssistantApprovalMode = 'safe' | 'yolo'
export type AssistantProvider = 'codex'
export type AssistantState = 'offline' | 'connecting' | 'ready' | 'error'

export interface AssistantStatus {
    connected: boolean
    state: AssistantState
    approvalMode: AssistantApprovalMode
    provider: AssistantProvider
    model: string
    profile?: string
    activeTurnId: string | null
    lastError: string | null
}

export interface AssistantHistoryMessage {
    id: string
    role: 'user' | 'assistant' | 'system'
    text: string
    reasoningText?: string
    createdAt: number
    turnId?: string
    attemptGroupId?: string
    attemptIndex?: number
    isActiveAttempt?: boolean
}

export interface AssistantConnectOptions {
    approvalMode?: AssistantApprovalMode
    provider?: AssistantProvider
    model?: string
    projectPath?: string
    profile?: string
}

export interface AssistantSendOptions {
    model?: string
    approvalMode?: AssistantApprovalMode
    regenerateFromTurnId?: string
    projectPath?: string
    profile?: string
    contextFiles?: Array<{
        path: string
        content?: string
        name?: string
        mimeType?: string
        kind?: 'image' | 'doc' | 'code' | 'file'
        sizeBytes?: number
        previewText?: string
    }>
    contextDiff?: string
    promptTemplate?: string
}

export interface AssistantModelInfo {
    id: string
    label: string
    isDefault: boolean
    capabilities?: string[]
}

export interface AssistantEventPayload {
    type:
    | 'status'
    | 'history'
    | 'turn-start'
    | 'assistant-delta'
    | 'assistant-final'
    | 'assistant-reasoning'
    | 'assistant-activity'
    | 'approval-request'
    | 'approval-decision'
    | 'turn-complete'
    | 'turn-cancelled'
    | 'workflow-status'
    | 'error'
    timestamp: number
    payload: Record<string, unknown>
}
