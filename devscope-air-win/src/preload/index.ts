/**
 * DevScope Air - Preload Script
 */

import { contextBridge, ipcRenderer } from 'electron'
import {
    SYSTEM_METRIC_SLOTS,
    SYSTEM_METRICS_CONTROL,
    type SharedSystemMetrics
} from '../shared/system-metrics'

const disabledFeature = (feature: string) => ({
    success: false,
    error: `${feature} is disabled in DevScope Air`
})

type SystemSharedViews = {
    control: Int32Array
    values: Float64Array
}

let systemSharedViews: SystemSharedViews | null = null

function toNullableNumber(value: number): number | null {
    return Number.isFinite(value) ? value : null
}

function toNullableBoolean(value: number): boolean | null {
    if (!Number.isFinite(value)) return null
    return value >= 1
}

function readSharedMetrics(): SharedSystemMetrics | null {
    if (!systemSharedViews) return null

    const { control, values } = systemSharedViews

    return {
        cpuLoad: values[SYSTEM_METRIC_SLOTS.cpuLoad] || 0,
        cpuCurrentSpeed: values[SYSTEM_METRIC_SLOTS.cpuCurrentSpeed] || 0,
        cpuTemperature: toNullableNumber(values[SYSTEM_METRIC_SLOTS.cpuTemperature]),
        memoryUsed: values[SYSTEM_METRIC_SLOTS.memoryUsed] || 0,
        memoryFree: values[SYSTEM_METRIC_SLOTS.memoryFree] || 0,
        memoryAvailable: values[SYSTEM_METRIC_SLOTS.memoryAvailable] || 0,
        memoryCached: values[SYSTEM_METRIC_SLOTS.memoryCached] || 0,
        memoryBuffcache: values[SYSTEM_METRIC_SLOTS.memoryBuffcache] || 0,
        swapUsed: values[SYSTEM_METRIC_SLOTS.swapUsed] || 0,
        swapFree: values[SYSTEM_METRIC_SLOTS.swapFree] || 0,
        diskReadPerSecond: values[SYSTEM_METRIC_SLOTS.diskReadPerSecond] || 0,
        diskWritePerSecond: values[SYSTEM_METRIC_SLOTS.diskWritePerSecond] || 0,
        processAll: values[SYSTEM_METRIC_SLOTS.processAll] || 0,
        processRunning: values[SYSTEM_METRIC_SLOTS.processRunning] || 0,
        processBlocked: values[SYSTEM_METRIC_SLOTS.processBlocked] || 0,
        processSleeping: values[SYSTEM_METRIC_SLOTS.processSleeping] || 0,
        batteryPercent: toNullableNumber(values[SYSTEM_METRIC_SLOTS.batteryPercent]),
        batteryCharging: toNullableBoolean(values[SYSTEM_METRIC_SLOTS.batteryCharging]),
        batteryAcConnected: toNullableBoolean(values[SYSTEM_METRIC_SLOTS.batteryAcConnected]),
        batteryTimeRemaining: toNullableNumber(values[SYSTEM_METRIC_SLOTS.batteryTimeRemaining]),
        updatedAt: values[SYSTEM_METRIC_SLOTS.updatedAt] || 0,
        version: Atomics.load(control, SYSTEM_METRICS_CONTROL.version),
        running: Atomics.load(control, SYSTEM_METRICS_CONTROL.running) === 1,
        hasError: Atomics.load(control, SYSTEM_METRICS_CONTROL.lastError) === 1
    }
}

const devScopeAPI = {
    // System
    getSystemOverview: () => ipcRenderer.invoke('devscope:getSystemOverview'),
    getDetailedSystemStats: () => ipcRenderer.invoke('devscope:getDetailedSystemStats'),
    getDeveloperTooling: () => ipcRenderer.invoke('devscope:getDeveloperTooling'),
    getReadinessReport: () => ipcRenderer.invoke('devscope:getReadinessReport'),
    refreshAll: () => ipcRenderer.invoke('devscope:refreshAll'),
    system: {
        bootstrap: async () => {
            const payload = await ipcRenderer.invoke('devscope:system:bootstrap')
            if (payload?.success && payload.controlBuffer && payload.metricsBuffer) {
                systemSharedViews = {
                    control: new Int32Array(payload.controlBuffer),
                    values: new Float64Array(payload.metricsBuffer)
                }
            } else {
                systemSharedViews = null
            }
            return payload
        },
        subscribe: (options?: { intervalMs?: number }) => ipcRenderer.invoke('devscope:system:subscribe', options),
        unsubscribe: () => ipcRenderer.invoke('devscope:system:unsubscribe'),
        readSharedMetrics: () => readSharedMetrics(),
        readMetrics: () => ipcRenderer.invoke('devscope:system:readMetrics')
    },

    // AI runtime is disabled in Air
    getAIRuntimeStatus: () => Promise.resolve(disabledFeature('AI Runtime')),
    getAIAgents: () => Promise.resolve({ success: true, agents: [] }),

    // Settings
    exportData: (data: any) => ipcRenderer.invoke('devscope:exportData', data),
    setStartupSettings: (settings: { openAtLogin: boolean; openAsHidden: boolean }) =>
        ipcRenderer.invoke('devscope:setStartupSettings', settings),
    getStartupSettings: () => ipcRenderer.invoke('devscope:getStartupSettings'),
    getAiDebugLogs: (limit?: number) => ipcRenderer.invoke('devscope:getAiDebugLogs', limit),
    clearAiDebugLogs: () => ipcRenderer.invoke('devscope:clearAiDebugLogs'),
    assistant: {
        subscribe: () => ipcRenderer.invoke('devscope:assistant:subscribe'),
        unsubscribe: () => ipcRenderer.invoke('devscope:assistant:unsubscribe'),
        connect: (options?: {
            approvalMode?: 'safe' | 'yolo'
            provider?: 'codex'
            model?: string
            profile?: string
        }) => ipcRenderer.invoke('devscope:assistant:connect', options),
        disconnect: () => ipcRenderer.invoke('devscope:assistant:disconnect'),
        status: (query?: {
            kind?: string
            limit?: number
            types?: string[]
            search?: string
        }) => ipcRenderer.invoke('devscope:assistant:status', query),
        send: (prompt: string, options?: {
            model?: string
            approvalMode?: 'safe' | 'yolo'
            regenerateFromTurnId?: string
            projectPath?: string
            profile?: string
            contextFiles?: Array<{ path: string; content?: string }>
            contextDiff?: string
            promptTemplate?: string
        }) => ipcRenderer.invoke('devscope:assistant:send', prompt, options),
        regenerate: (turnId: string, options?: {
            model?: string
            approvalMode?: 'safe' | 'yolo'
            projectPath?: string
            profile?: string
            contextFiles?: Array<{ path: string; content?: string }>
            contextDiff?: string
            promptTemplate?: string
        }) => ipcRenderer.invoke('devscope:assistant:send', '', {
            ...(options || {}),
            regenerateFromTurnId: turnId
        }),
        cancelTurn: (turnId?: string) => ipcRenderer.invoke('devscope:assistant:cancelTurn', turnId),
        setApprovalMode: (mode: 'safe' | 'yolo') => ipcRenderer.invoke('devscope:assistant:setApprovalMode', mode),
        getApprovalMode: () => ipcRenderer.invoke('devscope:assistant:getApprovalMode'),
        getHistory: (query?: {
            kind?: string
            limit?: number
            types?: string[]
            search?: string
        }) => ipcRenderer.invoke('devscope:assistant:getHistory', query),
        clearHistory: (request?: { kind?: string }) => ipcRenderer.invoke('devscope:assistant:clearHistory', request),
        getEvents: (query?: {
            limit?: number
            types?: string[]
            search?: string
        }) => ipcRenderer.invoke('devscope:assistant:getHistory', { kind: 'events', ...(query || {}) }),
        clearEvents: () => ipcRenderer.invoke('devscope:assistant:clearHistory', { kind: 'events' }),
        exportEvents: () => ipcRenderer.invoke('devscope:assistant:status', { kind: 'events:export' }),
        listSessions: () => ipcRenderer.invoke('devscope:assistant:status', { kind: 'sessions:list' }),
        createSession: (title?: string) => ipcRenderer.invoke('devscope:assistant:status', { kind: 'sessions:create', title }),
        selectSession: (sessionId: string) => ipcRenderer.invoke('devscope:assistant:status', { kind: 'sessions:select', sessionId }),
        renameSession: (sessionId: string, title: string) =>
            ipcRenderer.invoke('devscope:assistant:status', { kind: 'sessions:rename', sessionId, title }),
        deleteSession: (sessionId: string) => ipcRenderer.invoke('devscope:assistant:status', { kind: 'sessions:delete', sessionId }),
        archiveSession: (sessionId: string, archived: boolean = true) =>
            ipcRenderer.invoke('devscope:assistant:status', { kind: 'sessions:archive', sessionId, archived }),
        newThread: () => ipcRenderer.invoke('devscope:assistant:status', { kind: 'thread:new' }),
        estimateTokens: (input: {
            prompt: string
            contextDiff?: string
            contextFiles?: Array<{ path: string; content?: string }>
            promptTemplate?: string
        }) => ipcRenderer.invoke('devscope:assistant:status', { kind: 'tokens:estimate', ...(input || {}) }),
        listProfiles: () => ipcRenderer.invoke('devscope:assistant:status', { kind: 'profiles:list' }),
        setProfile: (profile: string) => ipcRenderer.invoke('devscope:assistant:status', { kind: 'profiles:set', profile }),
        getProjectModel: (projectPath: string) =>
            ipcRenderer.invoke('devscope:assistant:status', { kind: 'project-model:get', projectPath }),
        setProjectModel: (projectPath: string, model: string) =>
            ipcRenderer.invoke('devscope:assistant:status', { kind: 'project-model:set', projectPath, model }),
        getTelemetryIntegrity: () => ipcRenderer.invoke('devscope:assistant:status', { kind: 'telemetry:integrity' }),
        runWorkflowExplainDiff: (projectPath: string, filePath?: string, model?: string) =>
            ipcRenderer.invoke('devscope:assistant:status', { kind: 'workflow:explain-diff', projectPath, filePath, model }),
        runWorkflowReviewStaged: (projectPath: string, model?: string) =>
            ipcRenderer.invoke('devscope:assistant:status', { kind: 'workflow:review-staged', projectPath, model }),
        runWorkflowDraftCommit: (projectPath: string, model?: string) =>
            ipcRenderer.invoke('devscope:assistant:status', { kind: 'workflow:draft-commit', projectPath, model }),
        exportConversation: (input?: { format?: 'json' | 'markdown'; sessionId?: string }) =>
            ipcRenderer.invoke('devscope:assistant:getHistory', {
                kind: 'conversation:export',
                ...(input || {})
            }),
        listModels: () => ipcRenderer.invoke('devscope:assistant:listModels'),
        onEvent: (callback: (event: { type: string; timestamp: number; payload: Record<string, unknown> }) => void) => {
            const listener = (_event: Electron.IpcRendererEvent, payload: {
                type: string
                timestamp: number
                payload: Record<string, unknown>
            }) => {
                callback(payload)
            }
            ipcRenderer.on('devscope:assistant:event', listener)
            void ipcRenderer.invoke('devscope:assistant:subscribe').catch(() => undefined)
            return () => {
                ipcRenderer.removeListener('devscope:assistant:event', listener)
                void ipcRenderer.invoke('devscope:assistant:unsubscribe').catch(() => undefined)
            }
        }
    },

    // Projects
    selectFolder: () => ipcRenderer.invoke('devscope:selectFolder'),
    scanProjects: (folderPath: string) => ipcRenderer.invoke('devscope:scanProjects', folderPath),
    openInExplorer: (path: string) => ipcRenderer.invoke('devscope:openInExplorer', path),
    openInTerminal: (path: string, preferredShell: 'powershell' | 'cmd' = 'powershell', initialCommand?: string) =>
        ipcRenderer.invoke('devscope:openInTerminal', path, preferredShell, initialCommand),
    getProjectDetails: (projectPath: string) => ipcRenderer.invoke('devscope:getProjectDetails', projectPath),
    getFileTree: (projectPath: string, options?: { showHidden?: boolean; maxDepth?: number }) =>
        ipcRenderer.invoke('devscope:getFileTree', projectPath, options),
    getGitHistory: (projectPath: string) => ipcRenderer.invoke('devscope:getGitHistory', projectPath),
    getCommitDiff: (projectPath: string, commitHash: string) => ipcRenderer.invoke('devscope:getCommitDiff', projectPath, commitHash),
    getWorkingDiff: (projectPath: string, filePath?: string) => ipcRenderer.invoke('devscope:getWorkingDiff', projectPath, filePath),
    getWorkingChangesForAI: (projectPath: string) => ipcRenderer.invoke('devscope:getWorkingChangesForAI', projectPath),
    getGitStatus: (projectPath: string) => ipcRenderer.invoke('devscope:getGitStatus', projectPath),
    getUnpushedCommits: (projectPath: string) => ipcRenderer.invoke('devscope:getUnpushedCommits', projectPath),
    getGitUser: (projectPath: string) => ipcRenderer.invoke('devscope:getGitUser', projectPath),
    getRepoOwner: (projectPath: string) => ipcRenderer.invoke('devscope:getRepoOwner', projectPath),
    hasRemoteOrigin: (projectPath: string) => ipcRenderer.invoke('devscope:hasRemoteOrigin', projectPath),
    getProjectsGitOverview: (projectPaths: string[]) => ipcRenderer.invoke('devscope:getProjectsGitOverview', projectPaths),
    stageFiles: (projectPath: string, files: string[]) => ipcRenderer.invoke('devscope:stageFiles', projectPath, files),
    unstageFiles: (projectPath: string, files: string[]) => ipcRenderer.invoke('devscope:unstageFiles', projectPath, files),
    discardChanges: (projectPath: string, files: string[]) => ipcRenderer.invoke('devscope:discardChanges', projectPath, files),
    createCommit: (projectPath: string, message: string) => ipcRenderer.invoke('devscope:createCommit', projectPath, message),
    pushCommits: (projectPath: string) => ipcRenderer.invoke('devscope:pushCommits', projectPath),
    fetchUpdates: (projectPath: string, remoteName?: string) => ipcRenderer.invoke('devscope:fetchUpdates', projectPath, remoteName),
    pullUpdates: (projectPath: string) => ipcRenderer.invoke('devscope:pullUpdates', projectPath),
    listBranches: (projectPath: string) => ipcRenderer.invoke('devscope:listBranches', projectPath),
    createBranch: (projectPath: string, branchName: string, checkout?: boolean) =>
        ipcRenderer.invoke('devscope:createBranch', projectPath, branchName, checkout),
    checkoutBranch: (
        projectPath: string,
        branchName: string,
        options?: { autoStash?: boolean; autoCleanupLock?: boolean }
    ) =>
        ipcRenderer.invoke('devscope:checkoutBranch', projectPath, branchName, options),
    deleteBranch: (projectPath: string, branchName: string, force?: boolean) =>
        ipcRenderer.invoke('devscope:deleteBranch', projectPath, branchName, force),
    listRemotes: (projectPath: string) => ipcRenderer.invoke('devscope:listRemotes', projectPath),
    setRemoteUrl: (projectPath: string, remoteName: string, remoteUrl: string) =>
        ipcRenderer.invoke('devscope:setRemoteUrl', projectPath, remoteName, remoteUrl),
    removeRemote: (projectPath: string, remoteName: string) => ipcRenderer.invoke('devscope:removeRemote', projectPath, remoteName),
    listTags: (projectPath: string) => ipcRenderer.invoke('devscope:listTags', projectPath),
    createTag: (projectPath: string, tagName: string, target?: string) =>
        ipcRenderer.invoke('devscope:createTag', projectPath, tagName, target),
    deleteTag: (projectPath: string, tagName: string) => ipcRenderer.invoke('devscope:deleteTag', projectPath, tagName),
    listStashes: (projectPath: string) => ipcRenderer.invoke('devscope:listStashes', projectPath),
    createStash: (projectPath: string, message?: string) => ipcRenderer.invoke('devscope:createStash', projectPath, message),
    applyStash: (projectPath: string, stashRef?: string, pop?: boolean) =>
        ipcRenderer.invoke('devscope:applyStash', projectPath, stashRef, pop),
    dropStash: (projectPath: string, stashRef?: string) => ipcRenderer.invoke('devscope:dropStash', projectPath, stashRef),
    checkIsGitRepo: (projectPath: string) => ipcRenderer.invoke('devscope:checkIsGitRepo', projectPath),
    initGitRepo: (projectPath: string, branchName: string, createGitignore: boolean, gitignoreTemplate?: string) =>
        ipcRenderer.invoke('devscope:initGitRepo', projectPath, branchName, createGitignore, gitignoreTemplate),
    createInitialCommit: (projectPath: string, message: string) => ipcRenderer.invoke('devscope:createInitialCommit', projectPath, message),
    addRemoteOrigin: (projectPath: string, remoteUrl: string) => ipcRenderer.invoke('devscope:addRemoteOrigin', projectPath, remoteUrl),
    getGitignoreTemplates: () => ipcRenderer.invoke('devscope:getGitignoreTemplates'),
    generateGitignoreContent: (template: string) => ipcRenderer.invoke('devscope:generateGitignoreContent', template),
    getGitignorePatterns: () => ipcRenderer.invoke('devscope:getGitignorePatterns'),
    generateCustomGitignoreContent: (selectedPatternIds: string[]) => ipcRenderer.invoke('devscope:generateCustomGitignoreContent', selectedPatternIds),
    copyToClipboard: (text: string) => ipcRenderer.invoke('devscope:copyToClipboard', text),
    readFileContent: (filePath: string) => ipcRenderer.invoke('devscope:readFileContent', filePath),
    openFile: (filePath: string) => ipcRenderer.invoke('devscope:openFile', filePath),
    getProjectSessions: (_projectPath: string) => Promise.resolve({ success: true, sessions: [] }),
    getProjectProcesses: (projectPath: string) => ipcRenderer.invoke('devscope:getProjectProcesses', projectPath),
    indexAllFolders: (folders: string[]) => ipcRenderer.invoke('devscope:indexAllFolders', folders),
    getFileSystemRoots: () => ipcRenderer.invoke('devscope:getFileSystemRoots'),

    // Terminal/AgentScope disabled in Air
    terminal: {
        create: () => Promise.resolve(disabledFeature('Terminal')),
        list: () => Promise.resolve({ success: true, sessions: [] }),
        kill: () => Promise.resolve(disabledFeature('Terminal')),
        write: () => Promise.resolve(disabledFeature('Terminal')),
        resize: () => Promise.resolve(disabledFeature('Terminal')),
        capabilities: () => Promise.resolve(disabledFeature('Terminal')),
        suggestions: () => Promise.resolve({ success: true, suggestions: [] }),
        banner: () => Promise.resolve({ success: true, banner: 'DevScope Air: terminal disabled' }),
        onOutput: () => () => { }
    },
    agentscope: {
        create: () => Promise.resolve(disabledFeature('AgentScope')),
        start: () => Promise.resolve(disabledFeature('AgentScope')),
        write: () => Promise.resolve(disabledFeature('AgentScope')),
        sendMessage: () => Promise.resolve(disabledFeature('AgentScope')),
        kill: () => Promise.resolve(disabledFeature('AgentScope')),
        remove: () => Promise.resolve(disabledFeature('AgentScope')),
        get: () => Promise.resolve(disabledFeature('AgentScope')),
        history: () => Promise.resolve({ success: true, messages: [] }),
        list: () => Promise.resolve({ success: true, sessions: [] }),
        resize: () => Promise.resolve(disabledFeature('AgentScope')),
        onSessionCreated: () => () => { },
        onSessionUpdated: () => () => { },
        onSessionClosed: () => () => { },
        onOutput: () => () => { },
        onStatusChange: () => () => { }
    },

    // AI commit message helpers
    testGroqConnection: (apiKey: string) => ipcRenderer.invoke('devscope:testGroqConnection', apiKey),
    testGeminiConnection: (apiKey: string) => ipcRenderer.invoke('devscope:testGeminiConnection', apiKey),
    generateCommitMessage: (provider: 'groq' | 'gemini', apiKey: string, diff: string) =>
        ipcRenderer.invoke('devscope:generateCommitMessage', provider, apiKey, diff),

    // Window controls
    window: {
        minimize: () => ipcRenderer.send('window:minimize'),
        maximize: () => ipcRenderer.send('window:maximize'),
        close: () => ipcRenderer.send('window:close'),
        isMaximized: () => ipcRenderer.invoke('window:isMaximized')
    }
}

contextBridge.exposeInMainWorld('devscope', devScopeAPI)

declare global {
    interface Window {
        devscope: typeof devScopeAPI
    }
}
