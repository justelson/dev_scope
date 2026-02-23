import type { SharedSystemMetrics } from '../system-metrics'

export type DevScopeOk<T = Record<string, unknown>> = { success: true } & T
export type DevScopeErr = { success: false; error: string }
export type DevScopeResult<T = Record<string, unknown>> = DevScopeOk<T> | DevScopeErr

export type AssistantAttachmentInput = {
    path: string
    content?: string
    name?: string
    mimeType?: string
    kind?: 'image' | 'doc' | 'code' | 'file'
    sizeBytes?: number
    previewText?: string
}

export type DevScopeAssistantEvent = {
    type: string
    timestamp: number
    payload: Record<string, unknown>
}

export interface DevScopeSystemApi {
    bootstrap: () => Promise<DevScopeResult<{ controlBuffer?: ArrayBuffer; metricsBuffer?: ArrayBuffer }>>
    subscribe: (options?: { intervalMs?: number }) => Promise<DevScopeResult>
    unsubscribe: () => Promise<DevScopeResult>
    readSharedMetrics: () => SharedSystemMetrics | null
    readMetrics: () => Promise<DevScopeResult>
}

export interface DevScopeAssistantApi {
    subscribe: () => Promise<DevScopeResult>
    unsubscribe: () => Promise<DevScopeResult>
    connect: (options?: { approvalMode?: 'safe' | 'yolo'; provider?: 'codex'; model?: string; profile?: string }) => Promise<DevScopeResult>
    disconnect: () => Promise<DevScopeResult>
    status: (query?: { kind?: string; limit?: number; types?: string[]; search?: string; refreshToken?: boolean }) => Promise<DevScopeResult>
    send: (prompt: string, options?: {
        model?: string
        approvalMode?: 'safe' | 'yolo'
        regenerateFromTurnId?: string
        projectPath?: string
        profile?: string
        contextFiles?: AssistantAttachmentInput[]
        contextDiff?: string
        promptTemplate?: string
    }) => Promise<DevScopeResult>
    regenerate: (turnId: string, options?: {
        model?: string
        approvalMode?: 'safe' | 'yolo'
        projectPath?: string
        profile?: string
        contextFiles?: AssistantAttachmentInput[]
        contextDiff?: string
        promptTemplate?: string
    }) => Promise<DevScopeResult>
    cancelTurn: (turnId?: string) => Promise<DevScopeResult>
    setApprovalMode: (mode: 'safe' | 'yolo') => Promise<DevScopeResult>
    getApprovalMode: () => Promise<DevScopeResult<{ mode: 'safe' | 'yolo' }>>
    getHistory: (query?: { kind?: string; limit?: number; types?: string[]; search?: string }) => Promise<DevScopeResult>
    clearHistory: (request?: { kind?: string }) => Promise<DevScopeResult>
    getEvents: (query?: { limit?: number; types?: string[]; search?: string }) => Promise<DevScopeResult<{ events: DevScopeAssistantEvent[] }>>
    clearEvents: () => Promise<DevScopeResult>
    exportEvents: () => Promise<DevScopeResult<{ format: 'json'; content: string }>>
    exportConversation: (input?: { format?: 'json' | 'markdown'; sessionId?: string }) => Promise<DevScopeResult<{ format: 'json' | 'markdown'; content: string }>>
    listSessions: () => Promise<DevScopeResult>
    createSession: (title?: string) => Promise<DevScopeResult>
    selectSession: (sessionId: string) => Promise<DevScopeResult>
    renameSession: (sessionId: string, title: string) => Promise<DevScopeResult>
    deleteSession: (sessionId: string) => Promise<DevScopeResult>
    archiveSession: (sessionId: string, archived?: boolean) => Promise<DevScopeResult>
    setSessionProjectPath: (sessionId: string, projectPath: string) => Promise<DevScopeResult>
    newThread: () => Promise<DevScopeResult>
    estimateTokens: (input: { prompt: string; contextDiff?: string; contextFiles?: AssistantAttachmentInput[]; promptTemplate?: string }) => Promise<DevScopeResult<{ tokens: number; chars: number }>>
    listProfiles: () => Promise<DevScopeResult>
    setProfile: (profile: string) => Promise<DevScopeResult>
    getProjectModel: (projectPath: string) => Promise<DevScopeResult<{ model: string | null }>>
    setProjectModel: (projectPath: string, model: string) => Promise<DevScopeResult>
    getTelemetryIntegrity: () => Promise<DevScopeResult>
    readAccount: (refreshToken?: boolean) => Promise<DevScopeResult>
    readRateLimits: () => Promise<DevScopeResult>
    runWorkflowExplainDiff: (projectPath: string, filePath?: string, model?: string) => Promise<DevScopeResult>
    runWorkflowReviewStaged: (projectPath: string, model?: string) => Promise<DevScopeResult>
    runWorkflowDraftCommit: (projectPath: string, model?: string) => Promise<DevScopeResult>
    listModels: () => Promise<DevScopeResult>
    onEvent: (callback: (event: DevScopeAssistantEvent) => void) => () => void
}

export interface DevScopeWindowApi {
    minimize: () => void
    maximize: () => void
    close: () => void
    isMaximized: () => Promise<boolean>
}

export interface DevScopeTerminalApi {
    [method: string]: (...args: any[]) => any
}

export interface DevScopeAgentScopeApi {
    [method: string]: (...args: any[]) => any
}

export interface DevScopeApi {
    // System
    getSystemOverview: () => Promise<DevScopeResult>
    getDetailedSystemStats: () => Promise<DevScopeResult>
    getDeveloperTooling: () => Promise<DevScopeResult>
    getReadinessReport: () => Promise<DevScopeResult>
    refreshAll: () => Promise<DevScopeResult>
    system: DevScopeSystemApi

    // Capabilities disabled in Air
    getAIRuntimeStatus: () => Promise<DevScopeResult>
    getAIAgents: () => Promise<DevScopeResult<{ agents: unknown[] }>>

    // Settings + AI
    exportData: (data: unknown) => Promise<DevScopeResult>
    setStartupSettings: (settings: { openAtLogin: boolean; openAsHidden: boolean }) => Promise<DevScopeResult>
    getStartupSettings: () => Promise<DevScopeResult>
    getAiDebugLogs: (limit?: number) => Promise<DevScopeResult>
    clearAiDebugLogs: () => Promise<DevScopeResult>
    testGroqConnection: (apiKey: string) => Promise<DevScopeResult>
    testGeminiConnection: (apiKey: string) => Promise<DevScopeResult>
    generateCommitMessage: (provider: 'groq' | 'gemini', apiKey: string, diff: string) => Promise<DevScopeResult>

    // Assistant
    assistant: DevScopeAssistantApi

    // Projects + Git
    selectFolder: () => Promise<DevScopeResult<{ folderPath?: string; cancelled?: boolean }>>
    scanProjects: (folderPath: string) => Promise<DevScopeResult>
    openInExplorer: (path: string) => Promise<DevScopeResult>
    openInTerminal: (path: string, preferredShell?: 'powershell' | 'cmd', initialCommand?: string) => Promise<DevScopeResult>
    getProjectDetails: (projectPath: string) => Promise<DevScopeResult>
    getFileTree: (projectPath: string, options?: { showHidden?: boolean; maxDepth?: number }) => Promise<DevScopeResult>
    getGitHistory: (projectPath: string) => Promise<DevScopeResult>
    getCommitDiff: (projectPath: string, commitHash: string) => Promise<DevScopeResult>
    getWorkingDiff: (projectPath: string, filePath?: string) => Promise<DevScopeResult>
    getWorkingChangesForAI: (projectPath: string) => Promise<DevScopeResult>
    getGitStatus: (projectPath: string) => Promise<DevScopeResult>
    getUnpushedCommits: (projectPath: string) => Promise<DevScopeResult>
    getGitUser: (projectPath: string) => Promise<DevScopeResult>
    getRepoOwner: (projectPath: string) => Promise<DevScopeResult>
    hasRemoteOrigin: (projectPath: string) => Promise<DevScopeResult>
    getProjectsGitOverview: (projectPaths: string[]) => Promise<DevScopeResult>
    stageFiles: (projectPath: string, files: string[]) => Promise<DevScopeResult>
    unstageFiles: (projectPath: string, files: string[]) => Promise<DevScopeResult>
    discardChanges: (projectPath: string, files: string[]) => Promise<DevScopeResult>
    createCommit: (projectPath: string, message: string) => Promise<DevScopeResult>
    pushCommits: (projectPath: string) => Promise<DevScopeResult>
    fetchUpdates: (projectPath: string, remoteName?: string) => Promise<DevScopeResult>
    pullUpdates: (projectPath: string) => Promise<DevScopeResult>
    listBranches: (projectPath: string) => Promise<DevScopeResult>
    createBranch: (projectPath: string, branchName: string, checkout?: boolean) => Promise<DevScopeResult>
    checkoutBranch: (projectPath: string, branchName: string, options?: { autoStash?: boolean; autoCleanupLock?: boolean }) => Promise<DevScopeResult>
    deleteBranch: (projectPath: string, branchName: string, force?: boolean) => Promise<DevScopeResult>
    listRemotes: (projectPath: string) => Promise<DevScopeResult>
    setRemoteUrl: (projectPath: string, remoteName: string, remoteUrl: string) => Promise<DevScopeResult>
    removeRemote: (projectPath: string, remoteName: string) => Promise<DevScopeResult>
    listTags: (projectPath: string) => Promise<DevScopeResult>
    createTag: (projectPath: string, tagName: string, target?: string) => Promise<DevScopeResult>
    deleteTag: (projectPath: string, tagName: string) => Promise<DevScopeResult>
    listStashes: (projectPath: string) => Promise<DevScopeResult>
    createStash: (projectPath: string, message?: string) => Promise<DevScopeResult>
    applyStash: (projectPath: string, stashRef?: string, pop?: boolean) => Promise<DevScopeResult>
    dropStash: (projectPath: string, stashRef?: string) => Promise<DevScopeResult>
    checkIsGitRepo: (projectPath: string) => Promise<DevScopeResult>
    initGitRepo: (projectPath: string, branchName: string, createGitignore: boolean, gitignoreTemplate?: string) => Promise<DevScopeResult>
    createInitialCommit: (projectPath: string, message: string) => Promise<DevScopeResult>
    addRemoteOrigin: (projectPath: string, remoteUrl: string) => Promise<DevScopeResult>
    getGitignoreTemplates: () => Promise<DevScopeResult>
    generateGitignoreContent: (template: string) => Promise<DevScopeResult>
    getGitignorePatterns: () => Promise<DevScopeResult>
    generateCustomGitignoreContent: (selectedPatternIds: string[]) => Promise<DevScopeResult>
    copyToClipboard: (text: string) => Promise<DevScopeResult>
    readFileContent: (filePath: string) => Promise<DevScopeResult>
    openFile: (filePath: string) => Promise<DevScopeResult>
    getProjectSessions: (projectPath: string) => Promise<DevScopeResult>
    getProjectProcesses: (projectPath: string) => Promise<DevScopeResult>
    indexAllFolders: (folders: string[]) => Promise<DevScopeResult>
    getFileSystemRoots: () => Promise<DevScopeResult>

    terminal: DevScopeTerminalApi
    agentscope: DevScopeAgentScopeApi
    window: DevScopeWindowApi
}
