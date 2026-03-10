import type { SharedSystemMetrics } from '../system-metrics'
import type { FullReport, ReadinessReport, SystemHealth, ToolingReport } from '../../main/inspectors/types'

export type DevScopeOk<T = Record<string, unknown>> = { success: true } & T
export type DevScopeErr = { success: false; error: string }
export type DevScopeResult<T = Record<string, unknown>> = DevScopeOk<T> | DevScopeErr

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
    statsLoaded?: boolean
}

export type DevScopeGitStatusEntryStats = {
    path: string
    additions: number
    deletions: number
    stagedAdditions: number
    stagedDeletions: number
    unstagedAdditions: number
    unstagedDeletions: number
    statsLoaded: boolean
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
    dependencyInstallStatus?: {
        installed: boolean | null
        checked: boolean
        ecosystem: 'node' | 'unknown'
        totalPackages: number
        installedPackages: number
        missingPackages: number
        missingDependencies?: string[]
        missingSample?: string[]
        reason?: string
    } | null
    [key: string]: unknown
}

export type DevScopeFileTreeNode = {
    name: string
    path: string
    type: 'file' | 'directory'
    size?: number
    children?: DevScopeFileTreeNode[]
    childrenLoaded?: boolean
    isHidden: boolean
    gitStatus?: DevScopeGitFileStatus
}

export type DevScopePathInfo = {
    path: string
    name: string
    exists: boolean
    type: 'file' | 'directory' | null
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
    statsLoaded?: boolean
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

export type DevScopeGitSyncStatus = {
    currentBranch: string
    upstreamBranch: string | null
    headHash: string | null
    upstreamHeadHash: string | null
    hasRemote: boolean
    ahead: number
    behind: number
    workingTreeChanged: boolean
    workingTreeChangeCount: number
    statusToken: string
    detached: boolean
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

export type DevScopeRunningApp = {
    name: string
    category: 'app' | 'background'
    processCount: number
    cpu: number
    memoryMb: number
}

export type DevScopeInstalledIde = {
    id: string
    name: string
    icon: string
    color: string
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

export type DevScopePreviewTerminalEvent = {
    sessionId: string
    type: 'started' | 'output' | 'exit' | 'error'
    data?: string
    message?: string
    shell?: string
    cwd?: string
    title?: string
    groupKey?: string
    status?: 'running' | 'exited' | 'error'
    exitCode?: number
}

export type DevScopePreviewTerminalSessionSummary = {
    sessionId: string
    title: string
    shell: string
    cwd: string
    groupKey: string
    status: 'running' | 'exited' | 'error'
    startedAt: number
    lastActivityAt: number
    exitCode?: number | null
    recentOutput?: string
}

export type DevScopeTaskType =
    | 'git.commit'
    | 'git.push'
    | 'git.fetch'
    | 'git.pull'
    | 'git.checkout'
    | 'git.init'
    | 'git.remote'
    | 'git.tag'
    | 'git.stash'
    | 'project.dependencies.install'

export type DevScopeTaskStatus = 'running' | 'success' | 'failed'

export type DevScopeTaskLogEntry = {
    at: number
    level: 'info' | 'error'
    message: string
}

export type DevScopeTask = {
    id: string
    type: DevScopeTaskType
    title: string
    status: DevScopeTaskStatus
    projectPath?: string
    startedAt: number
    updatedAt: number
    endedAt?: number
    metadata?: Record<string, string | number | boolean>
    logs: DevScopeTaskLogEntry[]
}

export type DevScopeTaskEvent = {
    type: 'upsert' | 'remove'
    task?: DevScopeTask
    taskId?: string
}

export type DevScopeReleaseChannel = 'alpha' | 'beta' | 'stable'
export type DevScopeUpdateStatus =
    | 'disabled'
    | 'idle'
    | 'checking'
    | 'available'
    | 'downloading'
    | 'downloaded'
    | 'up-to-date'
    | 'error'

export type DevScopeUpdateErrorContext = 'check' | 'download' | 'install' | null

export type DevScopeUpdateState = {
    enabled: boolean
    status: DevScopeUpdateStatus
    currentVersion: string
    currentDisplayVersion: string
    channel: DevScopeReleaseChannel
    repository: string
    releasePageUrl: string
    disabledReason: string | null
    availableVersion: string | null
    availableDisplayVersion: string | null
    downloadedVersion: string | null
    downloadedDisplayVersion: string | null
    downloadPercent: number | null
    checkedAt: string | null
    message: string | null
    errorContext: DevScopeUpdateErrorContext
    canRetry: boolean
}

export type DevScopeUpdateActionResult = {
    accepted: boolean
    completed: boolean
    state: DevScopeUpdateState
}

export interface DevScopeSystemApi {
    bootstrap: () => Promise<DevScopeResult<{ controlBuffer?: ArrayBuffer; metricsBuffer?: ArrayBuffer }>>
    subscribe: (options?: { intervalMs?: number }) => Promise<DevScopeResult>
    unsubscribe: () => Promise<DevScopeResult>
    readSharedMetrics: () => SharedSystemMetrics | null
    readMetrics: () => Promise<DevScopeResult>
}

export interface DevScopeWindowApi {
    minimize: () => void
    maximize: () => void
    close: () => void
    isMaximized: () => Promise<boolean>
}

export interface DevScopeUpdatesApi {
    getState: () => Promise<DevScopeUpdateState>
    checkForUpdates: () => Promise<DevScopeUpdateActionResult>
    downloadUpdate: () => Promise<DevScopeUpdateActionResult>
    installUpdate: () => Promise<DevScopeUpdateActionResult>
    onStateChange: (callback: (state: DevScopeUpdateState) => void) => () => void
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
    setStartupSettings: (settings: { openAtLogin: boolean; openAsHidden: boolean }) => Promise<DevScopeResult>
    getStartupSettings: () => Promise<DevScopeResult>
    getAiDebugLogs: (limit?: number) => Promise<DevScopeResult>
    clearAiDebugLogs: () => Promise<DevScopeResult>
    testGroqConnection: (apiKey: string) => Promise<DevScopeResult>
    testGeminiConnection: (apiKey: string) => Promise<DevScopeResult>
    generateCommitMessage: (provider: 'groq' | 'gemini', apiKey: string, diff: string) => Promise<DevScopeResult<{ message: string }>>

    // Projects + Git
    selectFolder: () => Promise<DevScopeResult<{ folderPath?: string; cancelled?: boolean }>>
    scanProjects: (folderPath: string, options?: { forceRefresh?: boolean }) => Promise<DevScopeResult<{ projects: DevScopeProject[]; folders: DevScopeFolderItem[]; files: DevScopeFileItem[]; cached?: boolean; cachedAt?: number }>>
    openInExplorer: (path: string) => Promise<DevScopeResult>
    openInTerminal: (path: string, preferredShell?: 'powershell' | 'cmd', initialCommand?: string) => Promise<DevScopeResult>
    listInstalledIdes: () => Promise<DevScopeResult<{ ides: DevScopeInstalledIde[] }>>
    openProjectInIde: (projectPath: string, ideId: string) => Promise<DevScopeResult<{ ide: DevScopeInstalledIde }>>
    installProjectDependencies: (
        projectPath: string,
        options?: { onlyMissing?: boolean }
    ) => Promise<DevScopeResult<{
        manager: 'npm' | 'pnpm' | 'yarn' | 'bun'
        durationMs: number
        message?: string
        output?: string
        installStatus?: {
            installed: boolean | null
            checked: boolean
            ecosystem: 'node' | 'unknown'
            totalPackages: number
            installedPackages: number
            missingPackages: number
            missingDependencies?: string[]
            missingSample?: string[]
            reason?: string
        } | null
    }>>
    getProjectDetails: (projectPath: string) => Promise<DevScopeResult<{ project: DevScopeProjectDetails }>>
    getFileTree: (
        projectPath: string,
        options?: { showHidden?: boolean; maxDepth?: number; rootPath?: string }
    ) => Promise<DevScopeResult<{ tree: DevScopeFileTreeNode[] }>>
    getGitHistory: (
        projectPath: string,
        limit?: number,
        options?: { all?: boolean; includeStats?: boolean }
    ) => Promise<DevScopeResult<{ commits: DevScopeGitCommit[] }>>
    getGitCommitStats: (
        projectPath: string,
        commitHashes: string[]
    ) => Promise<DevScopeResult<{ commits: DevScopeGitCommit[] }>>
    getCommitDiff: (projectPath: string, commitHash: string) => Promise<DevScopeResult<{ diff: string }>>
    getWorkingDiff: (
        projectPath: string,
        filePath?: string,
        mode?: 'combined' | 'staged' | 'unstaged'
    ) => Promise<DevScopeResult<{ diff: string }>>
    getWorkingChangesForAI: (projectPath: string) => Promise<DevScopeResult<{ context: string }>>
    getGitStatus: (projectPath: string) => Promise<DevScopeResult<{ status: Record<string, DevScopeGitFileStatus | undefined> }>>
    getGitStatusDetailed: (
        projectPath: string,
        options?: { includeStats?: boolean }
    ) => Promise<DevScopeResult<{ entries: DevScopeGitStatusDetail[] }>>
    getGitStatusEntryStats: (
        projectPath: string,
        filePaths: string[]
    ) => Promise<DevScopeResult<{ entries: DevScopeGitStatusEntryStats[] }>>
    getGitSyncStatus: (projectPath: string) => Promise<DevScopeResult<{ sync: DevScopeGitSyncStatus }>>
    getIncomingCommits: (projectPath: string, limit?: number) => Promise<DevScopeResult<{ commits: DevScopeGitCommit[] }>>
    getUnpushedCommits: (projectPath: string) => Promise<DevScopeResult<{ commits: DevScopeGitCommit[] }>>
    getGitUser: (projectPath: string) => Promise<DevScopeResult<{ user: { name: string; email: string } | null }>>
    getGlobalGitUser: () => Promise<DevScopeResult<{ user: { name: string; email: string } | null }>>
    getRepoOwner: (projectPath: string) => Promise<DevScopeResult<{ owner: string | null }>>
    hasRemoteOrigin: (projectPath: string) => Promise<DevScopeResult<{ hasRemote: boolean }>>
    getProjectsGitOverview: (projectPaths: string[]) => Promise<DevScopeResult<{ items: DevScopeProjectGitOverviewItem[] }>>
    stageFiles: (
        projectPath: string,
        files: string[],
        options?: { scope?: 'project' | 'repo' }
    ) => Promise<DevScopeResult>
    unstageFiles: (
        projectPath: string,
        files: string[],
        options?: { scope?: 'project' | 'repo' }
    ) => Promise<DevScopeResult>
    discardChanges: (
        projectPath: string,
        files: string[],
        options?: { scope?: 'project' | 'repo' }
    ) => Promise<DevScopeResult>
    createCommit: (projectPath: string, message: string) => Promise<DevScopeResult>
    setGlobalGitUser: (user: { name: string; email: string }) => Promise<DevScopeResult>
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
    getPathInfo: (targetPath: string) => Promise<DevScopeResult<DevScopePathInfo>>
    writeTextFile: (
        filePath: string,
        content: string,
        expectedModifiedAt?: number
    ) => Promise<DevScopeResult<{ size: number; modifiedAt: number }> | (DevScopeErr & { conflict?: boolean; currentModifiedAt?: number })>
    runPythonPreview: (input: { sessionId: string; filePath: string; projectPath?: string }) =>
        Promise<DevScopeResult<{ pid: number | null; interpreter: string; command: string }>>
    stopPythonPreview: (sessionId: string) => Promise<DevScopeResult<{ stopped: boolean }>>
    onPythonPreviewEvent: (callback: (event: DevScopePythonPreviewEvent) => void) => () => void
    createPreviewTerminal: (input: {
        sessionId: string
        targetPath?: string
        preferredShell?: 'powershell' | 'cmd'
        cols?: number
        rows?: number
        title?: string
    }) => Promise<DevScopeResult<{ shell: string; cwd: string; groupKey: string; session: DevScopePreviewTerminalSessionSummary }>>
    listPreviewTerminalSessions: (input?: { targetPath?: string }) =>
        Promise<DevScopeResult<{ groupKey?: string; cwd?: string; sessions: DevScopePreviewTerminalSessionSummary[] }>>
    writePreviewTerminal: (input: { sessionId: string; data: string }) => Promise<DevScopeResult>
    resizePreviewTerminal: (input: { sessionId: string; cols: number; rows: number }) => Promise<DevScopeResult>
    closePreviewTerminal: (sessionId: string) => Promise<DevScopeResult<{ closed: boolean }>>
    onPreviewTerminalEvent: (callback: (event: DevScopePreviewTerminalEvent) => void) => () => void
    listActiveTasks: (projectPath?: string) => Promise<DevScopeResult<{ tasks: DevScopeTask[] }>>
    onTaskEvent: (callback: (event: DevScopeTaskEvent) => void) => () => void
    openFile: (filePath: string) => Promise<DevScopeResult>
    openWith: (filePath: string) => Promise<DevScopeResult>
    createFileSystemItem: (
        destinationDirectory: string,
        name: string,
        type: 'file' | 'directory'
    ) => Promise<DevScopeResult<{ path: string; name: string; type: 'file' | 'directory' }>>
    renameFileSystemItem: (targetPath: string, nextName: string) => Promise<DevScopeResult<{ path: string; name: string }>>
    deleteFileSystemItem: (targetPath: string) => Promise<DevScopeResult>
    pasteFileSystemItem: (sourcePath: string, destinationDirectory: string) => Promise<DevScopeResult<{ path: string; name: string }>>
    getProjectSessions: (projectPath: string) => Promise<DevScopeResult>
    getProjectProcesses: (projectPath: string) => Promise<DevScopeResult<{ isLive: boolean; processes: DevScopeProcessInfo[]; activePorts: number[] }>>
    getRunningApps: (limit?: number) => Promise<DevScopeResult<{ apps: DevScopeRunningApp[] }>>
    getActivePorts: () => Promise<DevScopeResult<{ ports: number[] }>>
    indexAllFolders: (folders: string[]) => Promise<DevScopeResult<{ projects: DevScopeIndexedProject[]; indexedCount: number; indexedFolders: number; scannedFolderPaths: string[]; errors?: Array<{ folder: string; error: string }> }>>
    getFileSystemRoots: () => Promise<DevScopeResult<{ roots: string[] }>>

    terminal: DevScopeTerminalApi
    agentscope: DevScopeAgentScopeApi
    updates: DevScopeUpdatesApi
    window: DevScopeWindowApi
}
