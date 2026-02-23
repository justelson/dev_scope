import { assistantBridge } from '../assistant'
import { bridgeReadAccount, bridgeReadAccountRateLimits } from '../assistant/assistant-bridge-operations'
import type { AssistantConnectOptions, AssistantSendOptions } from '../assistant'
import { indexAllFolders, scanProjects } from '../services/project-discovery-service'

export const devscopeCore = {
    projects: {
        scanProjects,
        indexAllFolders
    },
    assistant: {
        subscribe: (senderId: number) => assistantBridge.subscribe(senderId),
        unsubscribe: (senderId: number) => assistantBridge.unsubscribe(senderId),
        connect: (senderId: number, options?: AssistantConnectOptions) => {
            assistantBridge.subscribe(senderId)
            return assistantBridge.connect(options)
        },
        disconnect: (senderId: number) => {
            assistantBridge.unsubscribe(senderId)
            return assistantBridge.disconnect()
        },
        status: () => ({ success: true, status: assistantBridge.getStatus() }),
        sendPrompt: async (senderId: number, prompt: string, options?: AssistantSendOptions) => {
            assistantBridge.subscribe(senderId)
            return await assistantBridge.sendPrompt(prompt, options)
        },
        cancelTurn: (turnId?: string) => assistantBridge.cancelTurn(turnId),
        setApprovalMode: (mode: 'safe' | 'yolo') => assistantBridge.setApprovalMode(mode),
        getApprovalMode: () => assistantBridge.getApprovalMode(),
        getHistory: () => assistantBridge.getHistory(),
        clearHistory: () => assistantBridge.clearHistory(),
        listModels: async () => await assistantBridge.listModels(true),
        getEvents: (input?: { limit?: number; types?: string[]; search?: string }) => assistantBridge.getEvents(input),
        clearEvents: () => assistantBridge.clearEvents(),
        exportEvents: () => assistantBridge.exportEvents(),
        exportConversation: (format: 'json' | 'markdown' = 'json', sessionId?: string) =>
            assistantBridge.exportConversation(format, sessionId),
        listSessions: () => assistantBridge.listSessions(),
        createSession: (title?: string) => assistantBridge.createSession(title),
        selectSession: (sessionId: string) => assistantBridge.selectSession(sessionId),
        renameSession: (sessionId: string, title: string) => assistantBridge.renameSession(sessionId, title),
        deleteSession: (sessionId: string) => assistantBridge.deleteSession(sessionId),
        archiveSession: (sessionId: string, archived = true) => assistantBridge.archiveSession(sessionId, archived),
        setSessionProjectPath: (sessionId: string, projectPath: string) => assistantBridge.setSessionProjectPath(sessionId, projectPath),
        newThread: () => assistantBridge.newThread(),
        estimatePromptTokens: (input: {
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
        }) => assistantBridge.estimatePromptTokens(input),
        listProfiles: () => assistantBridge.listProfiles(),
        setProfile: (profile: string) => assistantBridge.setProfile(profile),
        getProjectModelDefault: (projectPath: string) => assistantBridge.getProjectModelDefault(projectPath),
        setProjectModelDefault: (projectPath: string, model: string) => assistantBridge.setProjectModelDefault(projectPath, model),
        getTelemetryIntegrity: () => assistantBridge.getTelemetryIntegrity(),
        readAccount: (refreshToken = false) => bridgeReadAccount.call(assistantBridge as any, refreshToken),
        readRateLimits: () => bridgeReadAccountRateLimits.call(assistantBridge as any),
        runWorkflow: (input: {
            kind: 'explain-diff' | 'review-staged' | 'draft-commit'
            projectPath: string
            filePath?: string
            model?: string
        }) => assistantBridge.runWorkflow(input)
    }
}
