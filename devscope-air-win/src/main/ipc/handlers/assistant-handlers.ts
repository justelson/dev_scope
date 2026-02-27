import log from 'electron-log'
import type {
    AssistantConnectOptions,
    AssistantSendOptions
} from '../../assistant'
import { devscopeCore } from '../../core/devscope-core'

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
    contextFiles?: Array<{
        path: string
        content?: string
        name?: string
        mimeType?: string
        kind?: 'image' | 'doc' | 'code' | 'file'
        sizeBytes?: number
        previewText?: string
    }>
    promptTemplate?: string
    format?: 'json' | 'markdown'
    projectPath?: string
    model?: string
    profile?: string
    filePath?: string
    refreshToken?: boolean
}

function subscribeSender(event: Electron.IpcMainInvokeEvent): void {
    devscopeCore.assistant.subscribe(event.sender.id)
}

export function handleAssistantSubscribe(event: Electron.IpcMainInvokeEvent) {
    log.info('IPC: assistant:subscribe', { senderId: event.sender.id })
    return devscopeCore.assistant.subscribe(event.sender.id)
}

export function handleAssistantUnsubscribe(event: Electron.IpcMainInvokeEvent) {
    log.info('IPC: assistant:unsubscribe', { senderId: event.sender.id })
    return devscopeCore.assistant.unsubscribe(event.sender.id)
}

export function handleAssistantConnect(
    event: Electron.IpcMainInvokeEvent,
    options?: AssistantConnectOptions
) {
    log.info('IPC: assistant:connect', { senderId: event.sender.id, options })
    return devscopeCore.assistant.connect(event.sender.id, options)
}

export function handleAssistantDisconnect(event: Electron.IpcMainInvokeEvent) {
    log.info('IPC: assistant:disconnect', { senderId: event.sender.id })
    return devscopeCore.assistant.disconnect(event.sender.id)
}

export function handleAssistantStatus(event: Electron.IpcMainInvokeEvent, query?: AssistantDataQuery) {
    subscribeSender(event)

    // Backward-compat shim: legacy kind-based multiplexing.
    if (query?.kind === 'events:export') return devscopeCore.assistant.exportEvents()
    if (query?.kind === 'sessions:list') return devscopeCore.assistant.listSessions()
    if (query?.kind === 'sessions:create') return devscopeCore.assistant.createSession(query.title)
    if (query?.kind === 'sessions:select') return devscopeCore.assistant.selectSession(String(query.sessionId || ''))
    if (query?.kind === 'sessions:rename') return devscopeCore.assistant.renameSession(String(query.sessionId || ''), String(query.title || ''))
    if (query?.kind === 'sessions:delete') return devscopeCore.assistant.deleteSession(String(query.sessionId || ''))
    if (query?.kind === 'sessions:archive') return devscopeCore.assistant.archiveSession(String(query.sessionId || ''), Boolean(query.archived))
    if (query?.kind === 'sessions:set-project-path') {
        return devscopeCore.assistant.setSessionProjectPath(String(query.sessionId || ''), String(query.projectPath || ''))
    }
    if (query?.kind === 'thread:new') return devscopeCore.assistant.newThread()
    if (query?.kind === 'tokens:estimate') {
        return devscopeCore.assistant.estimatePromptTokens({
            prompt: String(query.prompt || ''),
            contextDiff: query.contextDiff,
            contextFiles: query.contextFiles,
            promptTemplate: query.promptTemplate
        })
    }
    if (query?.kind === 'profiles:list') return devscopeCore.assistant.listProfiles()
    if (query?.kind === 'profiles:set') return devscopeCore.assistant.setProfile(String(query.profile || ''))
    if (query?.kind === 'models:list') return devscopeCore.assistant.listModels()
    if (query?.kind === 'project-model:get') return devscopeCore.assistant.getProjectModelDefault(String(query.projectPath || ''))
    if (query?.kind === 'project-model:set') {
        return devscopeCore.assistant.setProjectModelDefault(String(query.projectPath || ''), String(query.model || ''))
    }
    if (query?.kind === 'telemetry:integrity') return devscopeCore.assistant.getTelemetryIntegrity()
    if (query?.kind === 'account:read') return devscopeCore.assistant.readAccount(Boolean(query.refreshToken))
    if (query?.kind === 'account:rate-limits') return devscopeCore.assistant.readRateLimits()
    if (query?.kind === 'workflow:explain-diff') {
        return devscopeCore.assistant.runWorkflow({
            kind: 'explain-diff',
            projectPath: String(query.projectPath || ''),
            filePath: query.filePath,
            model: query.model
        })
    }
    if (query?.kind === 'workflow:review-staged') {
        return devscopeCore.assistant.runWorkflow({
            kind: 'review-staged',
            projectPath: String(query.projectPath || ''),
            model: query.model
        })
    }
    if (query?.kind === 'workflow:draft-commit') {
        return devscopeCore.assistant.runWorkflow({
            kind: 'draft-commit',
            projectPath: String(query.projectPath || ''),
            model: query.model
        })
    }

    return devscopeCore.assistant.status()
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
    return await devscopeCore.assistant.sendPrompt(event.sender.id, prompt, options)
}

export function handleAssistantRespondApproval(
    event: Electron.IpcMainInvokeEvent,
    requestId: number,
    decision: 'decline' | 'acceptForSession'
) {
    subscribeSender(event)
    log.info('IPC: assistant:respondApproval', { requestId, decision })
    return devscopeCore.assistant.respondApproval(Number(requestId), decision)
}

export function handleAssistantCancelTurn(
    _event: Electron.IpcMainInvokeEvent,
    turnId?: string
) {
    log.info('IPC: assistant:cancelTurn', { turnId })
    return devscopeCore.assistant.cancelTurn(turnId)
}

export function handleAssistantSetApprovalMode(
    _event: Electron.IpcMainInvokeEvent,
    mode: 'safe' | 'yolo'
) {
    log.info('IPC: assistant:setApprovalMode', { mode })
    return devscopeCore.assistant.setApprovalMode(mode === 'yolo' ? 'yolo' : 'safe')
}

export function handleAssistantGetApprovalMode() {
    return devscopeCore.assistant.getApprovalMode()
}

export function handleAssistantGetHistory(event: Electron.IpcMainInvokeEvent, query?: AssistantDataQuery) {
    subscribeSender(event)
    if (query?.kind === 'events') {
        return devscopeCore.assistant.getEvents({
            limit: query.limit,
            types: query.types,
            search: query.search
        })
    }
    if (query?.kind === 'events:export') {
        return devscopeCore.assistant.exportEvents()
    }
    if (query?.kind === 'conversation:export') {
        return devscopeCore.assistant.exportConversation(query.format || 'json', query.sessionId)
    }
    return devscopeCore.assistant.getHistory()
}

export function handleAssistantClearHistory(
    _event: Electron.IpcMainInvokeEvent,
    request?: { kind?: string }
) {
    if (request?.kind === 'events') {
        return devscopeCore.assistant.clearEvents()
    }
    return devscopeCore.assistant.clearHistory()
}

export async function handleAssistantListModels() {
    return await devscopeCore.assistant.listModels()
}

export function handleAssistantGetEvents(
    event: Electron.IpcMainInvokeEvent,
    query?: { limit?: number; types?: string[]; search?: string }
) {
    subscribeSender(event)
    return devscopeCore.assistant.getEvents(query)
}

export function handleAssistantClearEvents() {
    return devscopeCore.assistant.clearEvents()
}

export function handleAssistantExportEvents() {
    return devscopeCore.assistant.exportEvents()
}

export function handleAssistantExportConversation(
    event: Electron.IpcMainInvokeEvent,
    input?: { format?: 'json' | 'markdown'; sessionId?: string }
) {
    subscribeSender(event)
    return devscopeCore.assistant.exportConversation(input?.format || 'json', input?.sessionId)
}

export function handleAssistantListSessions(event: Electron.IpcMainInvokeEvent) {
    subscribeSender(event)
    return devscopeCore.assistant.listSessions()
}

export function handleAssistantCreateSession(event: Electron.IpcMainInvokeEvent, title?: string) {
    subscribeSender(event)
    return devscopeCore.assistant.createSession(title)
}

export function handleAssistantSelectSession(event: Electron.IpcMainInvokeEvent, sessionId: string) {
    subscribeSender(event)
    return devscopeCore.assistant.selectSession(String(sessionId || ''))
}

export function handleAssistantRenameSession(
    event: Electron.IpcMainInvokeEvent,
    sessionId: string,
    title: string
) {
    subscribeSender(event)
    return devscopeCore.assistant.renameSession(String(sessionId || ''), String(title || ''))
}

export function handleAssistantDeleteSession(event: Electron.IpcMainInvokeEvent, sessionId: string) {
    subscribeSender(event)
    return devscopeCore.assistant.deleteSession(String(sessionId || ''))
}

export function handleAssistantArchiveSession(
    event: Electron.IpcMainInvokeEvent,
    sessionId: string,
    archived: boolean = true
) {
    subscribeSender(event)
    return devscopeCore.assistant.archiveSession(String(sessionId || ''), Boolean(archived))
}

export function handleAssistantSetSessionProjectPath(
    event: Electron.IpcMainInvokeEvent,
    sessionId: string,
    projectPath: string
) {
    subscribeSender(event)
    return devscopeCore.assistant.setSessionProjectPath(String(sessionId || ''), String(projectPath || ''))
}

export function handleAssistantNewThread(event: Electron.IpcMainInvokeEvent) {
    subscribeSender(event)
    return devscopeCore.assistant.newThread()
}

export function handleAssistantEstimateTokens(
    event: Electron.IpcMainInvokeEvent,
    input: {
        prompt: string
        contextDiff?: string
        contextFiles?: Array<{
            path: string
            content?: string
            name?: string
            mimeType?: string
            kind?: 'image' | 'doc' | 'code' | 'file'
            sizeBytes?: number
            previewText?: string
        }>
        promptTemplate?: string
    }
) {
    subscribeSender(event)
    return devscopeCore.assistant.estimatePromptTokens({
        prompt: String(input?.prompt || ''),
        contextDiff: input?.contextDiff,
        contextFiles: input?.contextFiles,
        promptTemplate: input?.promptTemplate
    })
}

export function handleAssistantListProfiles(event: Electron.IpcMainInvokeEvent) {
    subscribeSender(event)
    return devscopeCore.assistant.listProfiles()
}

export function handleAssistantSetProfile(event: Electron.IpcMainInvokeEvent, profile: string) {
    subscribeSender(event)
    return devscopeCore.assistant.setProfile(String(profile || ''))
}

export function handleAssistantGetProjectModel(event: Electron.IpcMainInvokeEvent, projectPath: string) {
    subscribeSender(event)
    return devscopeCore.assistant.getProjectModelDefault(String(projectPath || ''))
}

export function handleAssistantSetProjectModel(
    event: Electron.IpcMainInvokeEvent,
    projectPath: string,
    model: string
) {
    subscribeSender(event)
    return devscopeCore.assistant.setProjectModelDefault(String(projectPath || ''), String(model || ''))
}

export function handleAssistantGetTelemetryIntegrity(event: Electron.IpcMainInvokeEvent) {
    subscribeSender(event)
    return devscopeCore.assistant.getTelemetryIntegrity()
}

export function handleAssistantReadAccount(event: Electron.IpcMainInvokeEvent, refreshToken = false) {
    subscribeSender(event)
    return devscopeCore.assistant.readAccount(Boolean(refreshToken))
}

export function handleAssistantReadRateLimits(event: Electron.IpcMainInvokeEvent) {
    subscribeSender(event)
    return devscopeCore.assistant.readRateLimits()
}

export function handleAssistantRunWorkflowExplainDiff(
    event: Electron.IpcMainInvokeEvent,
    input: { projectPath: string; filePath?: string; model?: string }
) {
    subscribeSender(event)
    return devscopeCore.assistant.runWorkflow({
        kind: 'explain-diff',
        projectPath: String(input?.projectPath || ''),
        filePath: input?.filePath,
        model: input?.model
    })
}

export function handleAssistantRunWorkflowReviewStaged(
    event: Electron.IpcMainInvokeEvent,
    input: { projectPath: string; model?: string }
) {
    subscribeSender(event)
    return devscopeCore.assistant.runWorkflow({
        kind: 'review-staged',
        projectPath: String(input?.projectPath || ''),
        model: input?.model
    })
}

export function handleAssistantRunWorkflowDraftCommit(
    event: Electron.IpcMainInvokeEvent,
    input: { projectPath: string; model?: string }
) {
    subscribeSender(event)
    return devscopeCore.assistant.runWorkflow({
        kind: 'draft-commit',
        projectPath: String(input?.projectPath || ''),
        model: input?.model
    })
}
