import type { SharedSystemMetrics } from '../system-metrics'
import type { FullReport, ReadinessReport, SystemHealth, ToolingReport } from '../../main/inspectors/types'

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

export type DevScopeGitFileStatus = 'modified' | 'untracked' | 'added' | 'deleted' | 'renamed' | 'ignored' | 'unknown'
export type DevScopeGitStatusDetail = {
    path: string
    previousPath?: string
    status: DevScopeGitFileStatus
    code: string
    staged: boolean
    unstaged: boolean
    additions: number
    deletions: number
    stagedAdditions: number
    stagedDeletions: number
    unstagedAdditions: number
    unstagedDeletions: number
}

export type DevScopeProject = {
    name: string
    path: string
    type: string
    markers: string[]
    frameworks: string[]
    lastModified?: number
    isProject: boolean
}

export type DevScopeFolderItem = {
    name: string
    path: string
    lastModified?: number
    isProject: boolean
}

export type DevScopeFileItem = {
    name: string
    path: string
    size: number
    lastModified?: number
    extension: string
}

export type DevScopeProjectDetails = {
    name: string
    displayName: string
    path: string
    type: string
    markers: string[]
    frameworks: string[]
    readme?: string
    scripts?: Record<string, string>
    dependencies?: Record<string, string>
    devDependencies?: Record<string, string>
    [key: string]: unknown
}

export type DevScopeFileTreeNode = {
    name: string
    path: string
    type: 'file' | 'directory'
    size?: number
    children?: DevScopeFileTreeNode[]
    isHidden: boolean
    gitStatus?: DevScopeGitFileStatus
}

export type DevScopeGitCommit = {
    hash: string
    shortHash: string
    parents: string[]
    author: string
    date: string
    message: string
    additions: number
    deletions: number
    filesChanged: number
}

export type DevScopeGitBranchSummary = {
    name: string
    current: boolean
    commit: string
    label: string
    isRemote: boolean
    isLocal?: boolean
}

export type DevScopeGitRemoteSummary = {
    name: string
    fetchUrl: string
    pushUrl: string
}

export type DevScopeGitTagSummary = {
    name: string
    commit?: string
}

export type DevScopeGitStashSummary = {
    hash: string
    message: string
}

export type DevScopeProjectGitOverviewItem = {
    path: string
    isGitRepo: boolean
    changedCount: number
    unpushedCount: number
    hasRemote: boolean
    error?: string
}

export type DevScopeIndexedProject = DevScopeProject & {
    sourceFolder: string
    depth: number
}

export type DevScopeProcessInfo = {
    pid: number
    name: string
    port?: number
    command?: string
    type: 'dev-server' | 'node' | 'python' | 'other'
}

export type DevScopeAssistantStatus = {
    connected: boolean
    state: 'offline' | 'connecting' | 'ready' | 'error'
    approvalMode: 'safe' | 'yolo'
    provider: 'codex'
    model: string
    profile?: string
    activeTurnId: string | null
    lastError: string | null
}

export type DevScopeAssistantHistoryAttachment = {
    path: string
    name?: string
    mimeType?: string
    kind?: 'image' | 'doc' | 'code' | 'file'
    sizeBytes?: number
    previewText?: string
    previewDataUrl?: string
    textPreview?: string
}

export type DevScopeAssistantHistoryMessage = {
    id: string
    role: 'user' | 'assistant' | 'system'
    text: string
    attachments?: DevScopeAssistantHistoryAttachment[]
    sourcePrompt?: string
    reasoningText?: string
    createdAt: number
    turnId?: string
    attemptGroupId?: string
    attemptIndex?: number
    isActiveAttempt?: boolean
}

export type DevScopeAssistantSession = {
    id: string
    title: string
    archived: boolean
    createdAt: number
    updatedAt: number
    messageCount: number
    projectPath?: string
}

export type DevScopeAssistantModelInfo = {
    id: string
    label: string
    isDefault: boolean
    capabilities?: string[]
}

export type DevScopePythonPreviewEvent = {
    sessionId: string
    type: 'started' | 'stdout' | 'stderr' | 'exit' | 'error'
    text?: string
    code?: number | null
    signal?: string | null
    pid?: number | null
    interpreter?: string
    command?: string
    stopped?: boolean
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
    status: (query?: { kind?: string; limit?: number; types?: string[]; search?: string; refreshToken?: boolean }) => Promise<DevScopeResult<{ status: DevScopeAssistantStatus; models?: DevScopeAssistantModelInfo[] }>>
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
    setApprovalMode: (mode: 'safe' | 'yolo') => Promise<DevScopeResult<{ status: DevScopeAssistantStatus }>>
    getApprovalMode: () => Promise<DevScopeResult<{ mode: 'safe' | 'yolo' }>>
    getHistory: (query?: { kind?: string; limit?: number; types?: string[]; search?: string }) => Promise<DevScopeResult<{ history: DevScopeAssistantHistoryMessage[] }>>
    clearHistory: (request?: { kind?: string }) => Promise<DevScopeResult>
    getEvents: (query?: { limit?: number; types?: string[]; search?: string }) => Promise<DevScopeResult<{ events: DevScopeAssistantEvent[] }>>
    clearEvents: () => Promise<DevScopeResult>
    exportEvents: () => Promise<DevScopeResult<{ format: 'json'; content: string }>>
    exportConversation: (input?: { format?: 'json' | 'markdown'; sessionId?: string }) => Promise<DevScopeResult<{ format: 'json' | 'markdown'; content: string }>>
    listSessions: () => Promise<DevScopeResult<{ sessions: DevScopeAssistantSession[]; activeSessionId?: string | null }>>
    createSession: (title?: string) => Promise<DevScopeResult<{ session?: DevScopeAssistantSession }>>
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
    getTelemetryIntegrity: () => Promise<DevScopeResult<{ eventsStored: number; monotonicDescending: boolean; newestTimestamp: number | null; oldestTimestamp: number | null }>>
    readAccount: (refreshToken?: boolean) => Promise<DevScopeResult>
    readRateLimits: () => Promise<DevScopeResult>
    runWorkflowExplainDiff: (projectPath: string, filePath?: string, model?: string) => Promise<DevScopeResult<{ turnId?: string; workflow?: string }>>
    runWorkflowReviewStaged: (projectPath: string, model?: string) => Promise<DevScopeResult<{ turnId?: string; workflow?: string }>>
    runWorkflowDraftCommit: (projectPath: string, model?: string) => Promise<DevScopeResult<{ turnId?: string; workflow?: string }>>
    listModels: () => Promise<DevScopeResult<{ models: DevScopeAssistantModelInfo[] }>>
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
    getSystemOverview: () => Promise<SystemHealth>
    getDetailedSystemStats: () => Promise<Record<string, unknown>>
    getDeveloperTooling: () => Promise<ToolingReport>
    getReadinessReport: () => Promise<ReadinessReport>
    refreshAll: () => Promise<FullReport>
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
    generateCommitMessage: (provider: 'groq' | 'gemini', apiKey: string, diff: string) => Promise<DevScopeResult<{ message: string }>>

    // Assistant
    assistant: DevScopeAssistantApi

    // Projects + Git
    selectFolder: () => Promise<DevScopeResult<{ folderPath?: string; cancelled?: boolean }>>
    scanProjects: (folderPath: string, options?: { forceRefresh?: boolean }) => Promise<DevScopeResult<{ projects: DevScopeProject[]; folders: DevScopeFolderItem[]; files: DevScopeFileItem[]; cached?: boolean; cachedAt?: number }>>
    openInExplorer: (path: string) => Promise<DevScopeResult>
    openInTerminal: (path: string, preferredShell?: 'powershell' | 'cmd', initialCommand?: string) => Promise<DevScopeResult>
    getProjectDetails: (projectPath: string) => Promise<DevScopeResult<{ project: DevScopeProjectDetails }>>
    getFileTree: (projectPath: string, options?: { showHidden?: boolean; maxDepth?: number }) => Promise<DevScopeResult<{ tree: DevScopeFileTreeNode[] }>>
    getGitHistory: (projectPath: string) => Promise<DevScopeResult<{ commits: DevScopeGitCommit[] }>>
    getCommitDiff: (projectPath: string, commitHash: string) => Promise<DevScopeResult<{ diff: string }>>
    getWorkingDiff: (
        projectPath: string,
        filePath?: string,
        mode?: 'combined' | 'staged' | 'unstaged'
    ) => Promise<DevScopeResult<{ diff: string }>>
    getWorkingChangesForAI: (projectPath: string) => Promise<DevScopeResult<{ context: string }>>
    getGitStatus: (projectPath: string) => Promise<DevScopeResult<{ status: Record<string, DevScopeGitFileStatus | undefined> }>>
    getGitStatusDetailed: (projectPath: string) => Promise<DevScopeResult<{ entries: DevScopeGitStatusDetail[] }>>
    getUnpushedCommits: (projectPath: string) => Promise<DevScopeResult<{ commits: DevScopeGitCommit[] }>>
    getGitUser: (projectPath: string) => Promise<DevScopeResult<{ user: { name: string; email: string } | null }>>
    getRepoOwner: (projectPath: string) => Promise<DevScopeResult<{ owner: string | null }>>
    hasRemoteOrigin: (projectPath: string) => Promise<DevScopeResult<{ hasRemote: boolean }>>
    getProjectsGitOverview: (projectPaths: string[]) => Promise<DevScopeResult<{ items: DevScopeProjectGitOverviewItem[] }>>
    stageFiles: (projectPath: string, files: string[]) => Promise<DevScopeResult>
    unstageFiles: (projectPath: string, files: string[]) => Promise<DevScopeResult>
    discardChanges: (projectPath: string, files: string[]) => Promise<DevScopeResult>
    createCommit: (projectPath: string, message: string) => Promise<DevScopeResult>
    pushCommits: (projectPath: string) => Promise<DevScopeResult>
    fetchUpdates: (projectPath: string, remoteName?: string) => Promise<DevScopeResult>
    pullUpdates: (projectPath: string) => Promise<DevScopeResult>
    listBranches: (projectPath: string) => Promise<DevScopeResult<{ branches: DevScopeGitBranchSummary[] }>>
    createBranch: (projectPath: string, branchName: string, checkout?: boolean) => Promise<DevScopeResult>
    checkoutBranch: (projectPath: string, branchName: string, options?: { autoStash?: boolean; autoCleanupLock?: boolean }) => Promise<DevScopeResult<{ stashed: boolean; cleanedLock?: boolean; stashRef?: string; stashMessage?: string }>>
    deleteBranch: (projectPath: string, branchName: string, force?: boolean) => Promise<DevScopeResult>
    listRemotes: (projectPath: string) => Promise<DevScopeResult<{ remotes: DevScopeGitRemoteSummary[] }>>
    setRemoteUrl: (projectPath: string, remoteName: string, remoteUrl: string) => Promise<DevScopeResult>
    removeRemote: (projectPath: string, remoteName: string) => Promise<DevScopeResult>
    listTags: (projectPath: string) => Promise<DevScopeResult<{ tags: DevScopeGitTagSummary[] }>>
    createTag: (projectPath: string, tagName: string, target?: string) => Promise<DevScopeResult>
    deleteTag: (projectPath: string, tagName: string) => Promise<DevScopeResult>
    listStashes: (projectPath: string) => Promise<DevScopeResult<{ stashes: DevScopeGitStashSummary[] }>>
    createStash: (projectPath: string, message?: string) => Promise<DevScopeResult>
    applyStash: (projectPath: string, stashRef?: string, pop?: boolean) => Promise<DevScopeResult>
    dropStash: (projectPath: string, stashRef?: string) => Promise<DevScopeResult>
    checkIsGitRepo: (projectPath: string) => Promise<DevScopeResult<{ isGitRepo: boolean }>>
    initGitRepo: (projectPath: string, branchName: string, createGitignore: boolean, gitignoreTemplate?: string) => Promise<DevScopeResult>
    createInitialCommit: (projectPath: string, message: string) => Promise<DevScopeResult>
    addRemoteOrigin: (projectPath: string, remoteUrl: string) => Promise<DevScopeResult>
    getGitignoreTemplates: () => Promise<DevScopeResult<{ templates: string[] }>>
    generateGitignoreContent: (template: string) => Promise<DevScopeResult<{ content: string }>>
    getGitignorePatterns: () => Promise<DevScopeResult<{ patterns: Array<{ id: string; label: string; description: string; category: string; patterns: string[] }> }>>
    generateCustomGitignoreContent: (selectedPatternIds: string[]) => Promise<DevScopeResult<{ content: string }>>
    copyToClipboard: (text: string) => Promise<DevScopeResult>
    readFileContent: (filePath: string) => Promise<DevScopeResult<{ content: string; size: number; previewBytes: number; truncated: boolean; modifiedAt: number }>>
    readTextFileFull: (filePath: string) => Promise<DevScopeResult<{ content: string; size: number; modifiedAt: number }>>
    writeTextFile: (
        filePath: string,
        content: string,
        expectedModifiedAt?: number
    ) => Promise<DevScopeResult<{ size: number; modifiedAt: number }> | (DevScopeErr & { conflict?: boolean; currentModifiedAt?: number })>
    runPythonPreview: (input: { sessionId: string; filePath: string; projectPath?: string }) =>
        Promise<DevScopeResult<{ pid: number | null; interpreter: string; command: string }>>
    stopPythonPreview: (sessionId: string) => Promise<DevScopeResult<{ stopped: boolean }>>
    onPythonPreviewEvent: (callback: (event: DevScopePythonPreviewEvent) => void) => () => void
    openFile: (filePath: string) => Promise<DevScopeResult>
    openWith: (filePath: string) => Promise<DevScopeResult>
    renameFileSystemItem: (targetPath: string, nextName: string) => Promise<DevScopeResult<{ path: string; name: string }>>
    deleteFileSystemItem: (targetPath: string) => Promise<DevScopeResult>
    pasteFileSystemItem: (sourcePath: string, destinationDirectory: string) => Promise<DevScopeResult<{ path: string; name: string }>>
    getProjectSessions: (projectPath: string) => Promise<DevScopeResult>
    getProjectProcesses: (projectPath: string) => Promise<DevScopeResult<{ isLive: boolean; processes: DevScopeProcessInfo[]; activePorts: number[] }>>
    indexAllFolders: (folders: string[]) => Promise<DevScopeResult<{ projects: DevScopeIndexedProject[]; indexedCount: number; indexedFolders: number; scannedFolderPaths: string[]; errors?: Array<{ folder: string; error: string }> }>>
    getFileSystemRoots: () => Promise<DevScopeResult<{ roots: string[] }>>

    terminal: DevScopeTerminalApi
    agentscope: DevScopeAgentScopeApi
    window: DevScopeWindowApi
}
