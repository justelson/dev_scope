export type AssistantApprovalMode = 'safe' | 'yolo'
export type AssistantProvider = 'codex'
export type AssistantState = 'offline' | 'connecting' | 'ready' | 'error'
export type AssistantApprovalDecision = 'decline' | 'acceptForSession'
export type AssistantTurnPartKind = 'text' | 'reasoning' | 'tool' | 'tool-result' | 'approval' | 'user-input' | 'final' | 'error'

export interface AssistantUserInputOption {
    label: string
    description: string
}

export interface AssistantUserInputQuestion {
    id: string
    header: string
    question: string
    options: AssistantUserInputOption[]
}

export interface AssistantPendingUserInput {
    requestId: number
    questions: AssistantUserInputQuestion[]
    answers?: Record<string, string | string[]>
    timestamp: number
    turnId?: string
    attemptGroupId?: string
}

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
    streaming?: boolean
    attachments?: AssistantHistoryAttachment[]
    sourcePrompt?: string
    reasoningText?: string
    createdAt: number
    turnId?: string
    attemptGroupId?: string
    attemptIndex?: number
    isActiveAttempt?: boolean
}

export interface AssistantHistoryAttachment {
    path: string
    name?: string
    mimeType?: string
    kind?: 'image' | 'doc' | 'code' | 'file'
    sizeBytes?: number
    previewText?: string
    previewDataUrl?: string
    textPreview?: string
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

export interface AssistantTurnPart {
    id: string
    turnId: string
    attemptGroupId: string
    kind: AssistantTurnPartKind
    timestamp: number
    text?: string
    method?: string
    summary?: string
    decision?: AssistantApprovalDecision
    status?: 'pending' | 'decided'
    payload?: Record<string, unknown>
    provisional?: boolean
}

export interface AssistantEventPayload {
    sequence: number
    type:
    | 'status'
    | 'history'
    | 'turn-start'
    | 'assistant-delta'
    | 'assistant-final'
    | 'assistant-reasoning'
    | 'assistant-activity'
    | 'account/updated'
    | 'account/rateLimits/updated'
    | 'thread/tokenUsage/updated'
    | 'approval-request'
    | 'approval-decision'
    | 'user-input-request'
    | 'user-input-response'
    | 'turn-complete'
    | 'turn-cancelled'
    | 'workflow-status'
    | 'turn-part'
    | 'error'
    timestamp: number
    payload: Record<string, unknown>
}
