import log from 'electron-log'
import { assistantBridge } from '../../assistant'
import type {
    AssistantConnectOptions,
    AssistantSendOptions
} from '../../assistant'

type AssistantDataQuery = {
    kind?: string
    limit?: number
    types?: string[]
    search?: string
    sessionId?: string
    title?: string
    archived?: boolean
    prompt?: string
    contextDiff?: string
    contextFiles?: Array<{ path: string; content?: string }>
    promptTemplate?: string
    format?: 'json' | 'markdown'
    projectPath?: string
    model?: string
    profile?: string
    filePath?: string
}

export function handleAssistantSubscribe(event: Electron.IpcMainInvokeEvent) {
    log.info('IPC: assistant:subscribe', { senderId: event.sender.id })
    return assistantBridge.subscribe(event.sender.id)
}

export function handleAssistantUnsubscribe(event: Electron.IpcMainInvokeEvent) {
    log.info('IPC: assistant:unsubscribe', { senderId: event.sender.id })
    return assistantBridge.unsubscribe(event.sender.id)
}

export function handleAssistantConnect(
    event: Electron.IpcMainInvokeEvent,
    options?: AssistantConnectOptions
) {
    log.info('IPC: assistant:connect', { senderId: event.sender.id, options })
    assistantBridge.subscribe(event.sender.id)
    return assistantBridge.connect(options)
}

export function handleAssistantDisconnect(event: Electron.IpcMainInvokeEvent) {
    log.info('IPC: assistant:disconnect', { senderId: event.sender.id })
    assistantBridge.unsubscribe(event.sender.id)
    return assistantBridge.disconnect()
}

export function handleAssistantStatus(event: Electron.IpcMainInvokeEvent, query?: AssistantDataQuery) {
    assistantBridge.subscribe(event.sender.id)
    if (query?.kind === 'events:export') {
        return assistantBridge.exportEvents()
    }
    if (query?.kind === 'sessions:list') {
        return assistantBridge.listSessions()
    }
    if (query?.kind === 'sessions:create') {
        return assistantBridge.createSession(query.title)
    }
    if (query?.kind === 'sessions:select') {
        return assistantBridge.selectSession(String(query.sessionId || ''))
    }
    if (query?.kind === 'sessions:rename') {
        return assistantBridge.renameSession(String(query.sessionId || ''), String(query.title || ''))
    }
    if (query?.kind === 'sessions:delete') {
        return assistantBridge.deleteSession(String(query.sessionId || ''))
    }
    if (query?.kind === 'sessions:archive') {
        return assistantBridge.archiveSession(String(query.sessionId || ''), Boolean(query.archived))
    }
    if (query?.kind === 'thread:new') {
        return assistantBridge.newThread()
    }
    if (query?.kind === 'tokens:estimate') {
        return assistantBridge.estimatePromptTokens({
            prompt: String(query.prompt || ''),
            contextDiff: query.contextDiff,
            contextFiles: query.contextFiles,
            promptTemplate: query.promptTemplate
        })
    }
    if (query?.kind === 'profiles:list') {
        return assistantBridge.listProfiles()
    }
    if (query?.kind === 'profiles:set') {
        return assistantBridge.setProfile(String(query.profile || ''))
    }
    if (query?.kind === 'models:list') {
        return assistantBridge.listModels(true)
    }
    if (query?.kind === 'project-model:get') {
        return assistantBridge.getProjectModelDefault(String(query.projectPath || ''))
    }
    if (query?.kind === 'project-model:set') {
        return assistantBridge.setProjectModelDefault(String(query.projectPath || ''), String(query.model || ''))
    }
    if (query?.kind === 'telemetry:integrity') {
        return assistantBridge.getTelemetryIntegrity()
    }
    if (
        query?.kind === 'workflow:explain-diff'
        || query?.kind === 'workflow:review-staged'
        || query?.kind === 'workflow:draft-commit'
    ) {
        const workflowKind = query.kind === 'workflow:explain-diff'
            ? 'explain-diff'
            : query.kind === 'workflow:review-staged'
                ? 'review-staged'
                : 'draft-commit'
        return assistantBridge.runWorkflow({
            kind: workflowKind,
            projectPath: String(query.projectPath || ''),
            filePath: query.filePath,
            model: query.model
        })
    }
    return { success: true, status: assistantBridge.getStatus() }
}

export async function handleAssistantSend(
    event: Electron.IpcMainInvokeEvent,
    prompt: string,
    options?: AssistantSendOptions
) {
    log.info('IPC: assistant:send', {
        senderId: event.sender.id,
        hasPrompt: Boolean(prompt?.trim()),
        model: options?.model,
        regenerateFromTurnId: options?.regenerateFromTurnId
    })
    assistantBridge.subscribe(event.sender.id)
    return await assistantBridge.sendPrompt(prompt, options)
}

export function handleAssistantCancelTurn(
    _event: Electron.IpcMainInvokeEvent,
    turnId?: string
) {
    log.info('IPC: assistant:cancelTurn', { turnId })
    return assistantBridge.cancelTurn(turnId)
}

export function handleAssistantSetApprovalMode(
    _event: Electron.IpcMainInvokeEvent,
    mode: 'safe' | 'yolo'
) {
    log.info('IPC: assistant:setApprovalMode', { mode })
    return assistantBridge.setApprovalMode(mode === 'yolo' ? 'yolo' : 'safe')
}

export function handleAssistantGetApprovalMode() {
    return assistantBridge.getApprovalMode()
}

export function handleAssistantGetHistory(event: Electron.IpcMainInvokeEvent, query?: AssistantDataQuery) {
    assistantBridge.subscribe(event.sender.id)
    if (query?.kind === 'events') {
        return assistantBridge.getEvents({
            limit: query.limit,
            types: query.types,
            search: query.search
        })
    }
    if (query?.kind === 'events:export') {
        return assistantBridge.exportEvents()
    }
    if (query?.kind === 'conversation:export') {
        return assistantBridge.exportConversation(query.format || 'json', query.sessionId)
    }
    return assistantBridge.getHistory()
}

export function handleAssistantClearHistory(
    _event: Electron.IpcMainInvokeEvent,
    request?: { kind?: string }
) {
    if (request?.kind === 'events') {
        return assistantBridge.clearEvents()
    }
    return assistantBridge.clearHistory()
}

export async function handleAssistantListModels() {
    return await assistantBridge.listModels(true)
}
