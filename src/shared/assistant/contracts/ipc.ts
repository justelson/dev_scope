import type {
    AssistantApprovalDecision,
    AssistantInteractionMode,
    AssistantRuntimeMode
} from './runtime'
import type { AssistantDomainEvent } from './read-model'

export const ASSISTANT_IPC = {
    subscribe: 'devscope:assistant:subscribe',
    unsubscribe: 'devscope:assistant:unsubscribe',
    getSnapshot: 'devscope:assistant:getSnapshot',
    getStatus: 'devscope:assistant:getStatus',
    listModels: 'devscope:assistant:listModels',
    connect: 'devscope:assistant:connect',
    disconnect: 'devscope:assistant:disconnect',
    createSession: 'devscope:assistant:createSession',
    selectSession: 'devscope:assistant:selectSession',
    renameSession: 'devscope:assistant:renameSession',
    archiveSession: 'devscope:assistant:archiveSession',
    deleteSession: 'devscope:assistant:deleteSession',
    deleteMessage: 'devscope:assistant:deleteMessage',
    clearLogs: 'devscope:assistant:clearLogs',
    setSessionProjectPath: 'devscope:assistant:setSessionProjectPath',
    newThread: 'devscope:assistant:newThread',
    sendPrompt: 'devscope:assistant:sendPrompt',
    interruptTurn: 'devscope:assistant:interruptTurn',
    respondApproval: 'devscope:assistant:respondApproval',
    respondUserInput: 'devscope:assistant:respondUserInput',
    eventStream: 'devscope:assistant:event'
} as const

export type AssistantIpcChannel = (typeof ASSISTANT_IPC)[keyof typeof ASSISTANT_IPC]

export interface AssistantConnectOptions {
    sessionId?: string
}

export interface AssistantSendPromptOptions {
    sessionId?: string
    model?: string
    runtimeMode?: AssistantRuntimeMode
    interactionMode?: AssistantInteractionMode
    effort?: 'low' | 'medium' | 'high' | 'xhigh'
    serviceTier?: 'fast'
}

export interface AssistantDeleteMessageInput {
    sessionId?: string
    messageId: string
}

export interface AssistantClearLogsInput {
    sessionId?: string
}

export interface AssistantApprovalResponseInput {
    requestId: string
    decision: AssistantApprovalDecision
}

export interface AssistantUserInputResponseInput {
    requestId: string
    answers: Record<string, string | string[]>
}

export interface AssistantEventStreamPayload {
    event: AssistantDomainEvent
}

export function assertAssistantIpcContract(): void {
    const values = Object.values(ASSISTANT_IPC)
    const unique = new Set(values)
    if (unique.size !== values.length) {
        throw new Error('Assistant IPC contract has duplicate channel names.')
    }
}
