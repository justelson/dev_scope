import { AssistantBridge } from './assistant-bridge'

export const assistantBridge = new AssistantBridge()

export type {
    AssistantApprovalMode,
    AssistantConnectOptions,
    AssistantEventPayload,
    AssistantHistoryMessage,
    AssistantModelInfo,
    AssistantSendOptions,
    AssistantStatus
} from './types'
