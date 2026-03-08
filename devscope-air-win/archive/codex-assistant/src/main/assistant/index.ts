import { AssistantBridge } from './assistant-bridge'

export const assistantBridge = new AssistantBridge()

export type {
    AssistantApprovalDecision,
    AssistantApprovalMode,
    AssistantConnectOptions,
    AssistantEventPayload,
    AssistantHistoryMessage,
    AssistantModelInfo,
    AssistantSendOptions,
    AssistantStatus,
    AssistantTurnPart
} from './types'
