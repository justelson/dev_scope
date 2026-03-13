import log from 'electron-log'
import type {
    AssistantApprovalResponseInput,
    AssistantClearLogsInput,
    AssistantConnectOptions,
    AssistantDeleteMessageInput,
    AssistantSendPromptOptions,
    AssistantUserInputResponseInput
} from '../../../shared/assistant/contracts'
import { getAssistantService } from '../../assistant'

async function withAssistantResult<T>(work: () => Promise<T> | T): Promise<T | { success: false; error: string }> {
    try {
        return await work()
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Assistant request failed.'
        log.error('Assistant IPC failed:', error)
        return { success: false as const, error: message }
    }
}

export function handleAssistantSubscribe(event: Electron.IpcMainInvokeEvent) {
    log.info('IPC: assistant:subscribe', { senderId: event.sender.id })
    return withAssistantResult(() => getAssistantService().subscribe(event.sender.id))
}

export function handleAssistantUnsubscribe(event: Electron.IpcMainInvokeEvent) {
    log.info('IPC: assistant:unsubscribe', { senderId: event.sender.id })
    return withAssistantResult(() => getAssistantService().unsubscribe(event.sender.id))
}

export async function handleAssistantGetSnapshot() {
    return getAssistantService().getSnapshot()
}

export async function handleAssistantGetStatus() {
    return getAssistantService().getStatus()
}

export function handleAssistantListModels(_event: Electron.IpcMainInvokeEvent, forceRefresh?: boolean) {
    log.info('IPC: assistant:listModels', { forceRefresh: Boolean(forceRefresh) })
    return withAssistantResult(() => getAssistantService().listModels(Boolean(forceRefresh)))
}

export function handleAssistantConnect(_event: Electron.IpcMainInvokeEvent, options?: AssistantConnectOptions) {
    log.info('IPC: assistant:connect', { options })
    return withAssistantResult(() => getAssistantService().connect(options))
}

export function handleAssistantDisconnect(_event: Electron.IpcMainInvokeEvent, sessionId?: string) {
    log.info('IPC: assistant:disconnect', { sessionId })
    return withAssistantResult(() => getAssistantService().disconnect(sessionId))
}

export function handleAssistantCreateSession(_event: Electron.IpcMainInvokeEvent, title?: string) {
    log.info('IPC: assistant:createSession', { title })
    return withAssistantResult(() => getAssistantService().createSession(title))
}

export function handleAssistantSelectSession(_event: Electron.IpcMainInvokeEvent, sessionId: string) {
    log.info('IPC: assistant:selectSession', { sessionId })
    return withAssistantResult(() => getAssistantService().selectSession(sessionId))
}

export function handleAssistantRenameSession(_event: Electron.IpcMainInvokeEvent, sessionId: string, title: string) {
    log.info('IPC: assistant:renameSession', { sessionId })
    return withAssistantResult(() => getAssistantService().renameSession(sessionId, title))
}

export function handleAssistantArchiveSession(_event: Electron.IpcMainInvokeEvent, sessionId: string, archived?: boolean) {
    log.info('IPC: assistant:archiveSession', { sessionId, archived: archived !== false })
    return withAssistantResult(() => getAssistantService().archiveSession(sessionId, archived))
}

export function handleAssistantDeleteSession(_event: Electron.IpcMainInvokeEvent, sessionId: string) {
    log.info('IPC: assistant:deleteSession', { sessionId })
    return withAssistantResult(() => getAssistantService().deleteSession(sessionId))
}

export function handleAssistantDeleteMessage(_event: Electron.IpcMainInvokeEvent, input: AssistantDeleteMessageInput) {
    log.info('IPC: assistant:deleteMessage', { sessionId: input?.sessionId, messageId: input?.messageId })
    return withAssistantResult(() => getAssistantService().deleteMessage(input))
}

export function handleAssistantClearLogs(_event: Electron.IpcMainInvokeEvent, input?: AssistantClearLogsInput) {
    log.info('IPC: assistant:clearLogs', { sessionId: input?.sessionId })
    return withAssistantResult(() => getAssistantService().clearLogs(input))
}

export function handleAssistantSetSessionProjectPath(_event: Electron.IpcMainInvokeEvent, sessionId: string, projectPath: string | null) {
    log.info('IPC: assistant:setSessionProjectPath', { sessionId, hasProjectPath: Boolean(projectPath) })
    return withAssistantResult(() => getAssistantService().setSessionProjectPath(sessionId, projectPath))
}

export function handleAssistantNewThread(_event: Electron.IpcMainInvokeEvent, sessionId?: string) {
    log.info('IPC: assistant:newThread', { sessionId })
    return withAssistantResult(() => getAssistantService().newThread(sessionId))
}

export function handleAssistantSendPrompt(_event: Electron.IpcMainInvokeEvent, prompt: string, options?: AssistantSendPromptOptions) {
    log.info('IPC: assistant:sendPrompt', { sessionId: options?.sessionId, model: options?.model })
    return withAssistantResult(() => getAssistantService().sendPrompt(prompt, options))
}

export function handleAssistantInterruptTurn(_event: Electron.IpcMainInvokeEvent, turnId?: string, sessionId?: string) {
    log.info('IPC: assistant:interruptTurn', { turnId, sessionId })
    return withAssistantResult(() => getAssistantService().interruptTurn(turnId, sessionId))
}

export function handleAssistantRespondApproval(_event: Electron.IpcMainInvokeEvent, input: AssistantApprovalResponseInput) {
    log.info('IPC: assistant:respondApproval', { requestId: input?.requestId, decision: input?.decision })
    return withAssistantResult(() => getAssistantService().respondApproval(input))
}

export function handleAssistantRespondUserInput(_event: Electron.IpcMainInvokeEvent, input: AssistantUserInputResponseInput) {
    log.info('IPC: assistant:respondUserInput', { requestId: input?.requestId })
    return withAssistantResult(() => getAssistantService().respondUserInput(input))
}
