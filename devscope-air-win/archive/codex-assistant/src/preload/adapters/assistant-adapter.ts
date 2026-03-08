import { ipcRenderer } from 'electron'
import { ASSISTANT_IPC, assertAssistantIpcContract } from '../../shared/contracts/assistant-ipc'

export function createAssistantAdapter() {
    assertAssistantIpcContract()

    return {
        assistant: {
            subscribe: () => ipcRenderer.invoke(ASSISTANT_IPC.subscribe),
            unsubscribe: () => ipcRenderer.invoke(ASSISTANT_IPC.unsubscribe),
            connect: (options?: {
                approvalMode?: 'safe' | 'yolo'
                provider?: 'codex'
                model?: string
                profile?: string
            }) => ipcRenderer.invoke(ASSISTANT_IPC.connect, options),
            disconnect: () => ipcRenderer.invoke(ASSISTANT_IPC.disconnect),
            status: (query?: { kind?: string; limit?: number; types?: string[]; search?: string; refreshToken?: boolean; forceRefresh?: boolean }) =>
                ipcRenderer.invoke(ASSISTANT_IPC.status, query),
            getSnapshot: () => ipcRenderer.invoke(ASSISTANT_IPC.getSnapshot),
            send: (prompt: string, options?: {
                model?: string
                approvalMode?: 'safe' | 'yolo'
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
            }) => ipcRenderer.invoke(ASSISTANT_IPC.send, prompt, options),
            respondApproval: (requestId: number, decision: 'decline' | 'acceptForSession') =>
                ipcRenderer.invoke(ASSISTANT_IPC.respondApproval, requestId, decision),
            respondUserInput: (requestId: number, answers: Record<string, string | string[]>) =>
                ipcRenderer.invoke(ASSISTANT_IPC.respondUserInput, requestId, answers),
            regenerate: (turnId: string, options?: {
                model?: string
                approvalMode?: 'safe' | 'yolo'
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
            }) => ipcRenderer.invoke(ASSISTANT_IPC.send, '', { ...(options || {}), regenerateFromTurnId: turnId }),
            cancelTurn: (turnId?: string) => ipcRenderer.invoke(ASSISTANT_IPC.cancelTurn, turnId),
            setApprovalMode: (mode: 'safe' | 'yolo') => ipcRenderer.invoke(ASSISTANT_IPC.setApprovalMode, mode),
            getApprovalMode: () => ipcRenderer.invoke(ASSISTANT_IPC.getApprovalMode),
            getHistory: (query?: { kind?: string; limit?: number; types?: string[]; search?: string }) =>
                ipcRenderer.invoke(ASSISTANT_IPC.getHistory, query),
            clearHistory: (request?: { kind?: string }) => ipcRenderer.invoke(ASSISTANT_IPC.clearHistory, request),
            getEvents: (query?: { limit?: number; types?: string[]; search?: string }) =>
                ipcRenderer.invoke(ASSISTANT_IPC.getEvents, query),
            clearEvents: () => ipcRenderer.invoke(ASSISTANT_IPC.clearEvents),
            exportEvents: () => ipcRenderer.invoke(ASSISTANT_IPC.exportEvents),
            exportConversation: (input?: { format?: 'json' | 'markdown'; sessionId?: string }) =>
                ipcRenderer.invoke(ASSISTANT_IPC.exportConversation, input),
            listSessions: () => ipcRenderer.invoke(ASSISTANT_IPC.listSessions),
            createSession: (title?: string) => ipcRenderer.invoke(ASSISTANT_IPC.createSession, title),
            selectSession: (sessionId: string) => ipcRenderer.invoke(ASSISTANT_IPC.selectSession, sessionId),
            renameSession: (sessionId: string, title: string) => ipcRenderer.invoke(ASSISTANT_IPC.renameSession, sessionId, title),
            deleteSession: (sessionId: string) => ipcRenderer.invoke(ASSISTANT_IPC.deleteSession, sessionId),
            archiveSession: (sessionId: string, archived: boolean = true) =>
                ipcRenderer.invoke(ASSISTANT_IPC.archiveSession, sessionId, archived),
            setSessionProjectPath: (sessionId: string, projectPath: string) =>
                ipcRenderer.invoke(ASSISTANT_IPC.setSessionProjectPath, sessionId, projectPath),
            newThread: () => ipcRenderer.invoke(ASSISTANT_IPC.newThread),
            estimateTokens: (input: {
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
            }) => ipcRenderer.invoke(ASSISTANT_IPC.estimateTokens, input),
            listProfiles: () => ipcRenderer.invoke(ASSISTANT_IPC.listProfiles),
            setProfile: (profile: string) => ipcRenderer.invoke(ASSISTANT_IPC.setProfile, profile),
            getProjectModel: (projectPath: string) => ipcRenderer.invoke(ASSISTANT_IPC.getProjectModel, projectPath),
            setProjectModel: (projectPath: string, model: string) =>
                ipcRenderer.invoke(ASSISTANT_IPC.setProjectModel, projectPath, model),
            getTelemetryIntegrity: () => ipcRenderer.invoke(ASSISTANT_IPC.getTelemetryIntegrity),
            readAccount: (refreshToken = false) => ipcRenderer.invoke(ASSISTANT_IPC.readAccount, refreshToken),
            readRateLimits: () => ipcRenderer.invoke(ASSISTANT_IPC.readRateLimits),
            runWorkflowExplainDiff: (projectPath: string, filePath?: string, model?: string) =>
                ipcRenderer.invoke(ASSISTANT_IPC.runWorkflowExplainDiff, { projectPath, filePath, model }),
            runWorkflowReviewStaged: (projectPath: string, model?: string) =>
                ipcRenderer.invoke(ASSISTANT_IPC.runWorkflowReviewStaged, { projectPath, model }),
            runWorkflowDraftCommit: (projectPath: string, model?: string) =>
                ipcRenderer.invoke(ASSISTANT_IPC.runWorkflowDraftCommit, { projectPath, model }),
            listModels: (forceRefresh = false) => ipcRenderer.invoke(ASSISTANT_IPC.listModels, { forceRefresh }),
            onEvent: (callback: (event: { sequence: number; type: string; timestamp: number; payload: Record<string, unknown> }) => void) => {
                const listener = (_event: Electron.IpcRendererEvent, payload: {
                    sequence: number
                    type: string
                    timestamp: number
                    payload: Record<string, unknown>
                }) => {
                    callback(payload)
                }
                ipcRenderer.on(ASSISTANT_IPC.eventStream, listener)
                void ipcRenderer.invoke(ASSISTANT_IPC.subscribe).catch(() => undefined)
                return () => {
                    ipcRenderer.removeListener(ASSISTANT_IPC.eventStream, listener)
                    void ipcRenderer.invoke(ASSISTANT_IPC.unsubscribe).catch(() => undefined)
                }
            }
        }
    }
}
