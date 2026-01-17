/**
 * DevScope - Preload Script
 * Exposes secure IPC bridge to renderer
 */

import { contextBridge, ipcRenderer } from 'electron'

/**
 * DevScope API exposed to renderer
 */
const devScopeAPI = {
    // System Information
    getSystemOverview: () => ipcRenderer.invoke('devscope:getSystemOverview'),
    getDetailedSystemStats: () => ipcRenderer.invoke('devscope:getDetailedSystemStats'),
    getDeveloperTooling: () => ipcRenderer.invoke('devscope:getDeveloperTooling'),
    getAIRuntimeStatus: () => ipcRenderer.invoke('devscope:getAIRuntimeStatus'),
    getAIAgents: () => ipcRenderer.invoke('devscope:getAIAgents'),
    getReadinessReport: () => ipcRenderer.invoke('devscope:getReadinessReport'),
    refreshAll: () => ipcRenderer.invoke('devscope:refreshAll'),

    // Settings
    exportData: (data: any) => ipcRenderer.invoke('devscope:exportData', data),
    setStartupSettings: (settings: { openAtLogin: boolean; openAsHidden: boolean }) =>
        ipcRenderer.invoke('devscope:setStartupSettings', settings),
    getStartupSettings: () => ipcRenderer.invoke('devscope:getStartupSettings'),

    // Projects
    selectFolder: () => ipcRenderer.invoke('devscope:selectFolder'),
    scanProjects: (folderPath: string) => ipcRenderer.invoke('devscope:scanProjects', folderPath),
    openInExplorer: (path: string) => ipcRenderer.invoke('devscope:openInExplorer', path),
    getProjectDetails: (projectPath: string) => ipcRenderer.invoke('devscope:getProjectDetails', projectPath),
    getFileTree: (projectPath: string, options?: { showHidden?: boolean; maxDepth?: number }) =>
        ipcRenderer.invoke('devscope:getFileTree', projectPath, options),
    getGitHistory: (projectPath: string) => ipcRenderer.invoke('devscope:getGitHistory', projectPath),
    getCommitDiff: (projectPath: string, commitHash: string) => ipcRenderer.invoke('devscope:getCommitDiff', projectPath, commitHash),
    getWorkingDiff: (projectPath: string, filePath?: string) => ipcRenderer.invoke('devscope:getWorkingDiff', projectPath, filePath),
    getUnpushedCommits: (projectPath: string) => ipcRenderer.invoke('devscope:getUnpushedCommits', projectPath),
    getGitUser: (projectPath: string) => ipcRenderer.invoke('devscope:getGitUser', projectPath),
    getRepoOwner: (projectPath: string) => ipcRenderer.invoke('devscope:getRepoOwner', projectPath),
    hasRemoteOrigin: (projectPath: string) => ipcRenderer.invoke('devscope:hasRemoteOrigin', projectPath),
    stageFiles: (projectPath: string, files: string[]) => ipcRenderer.invoke('devscope:stageFiles', projectPath, files),
    createCommit: (projectPath: string, message: string) => ipcRenderer.invoke('devscope:createCommit', projectPath, message),
    pushCommits: (projectPath: string) => ipcRenderer.invoke('devscope:pushCommits', projectPath),
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
    getProjectSessions: (projectPath: string) => ipcRenderer.invoke('devscope:getProjectSessions', projectPath),
    getProjectProcesses: (projectPath: string) => ipcRenderer.invoke('devscope:getProjectProcesses', projectPath),
    indexAllFolders: (folders: string[]) => ipcRenderer.invoke('devscope:indexAllFolders', folders),

    // Terminal
    terminal: {
        create: (name?: string, cwd?: string, shell?: 'cmd' | 'powershell') =>
            ipcRenderer.invoke('devscope:terminal:create', name, cwd, shell),
        list: () =>
            ipcRenderer.invoke('devscope:terminal:list'),
        kill: (id: string) =>
            ipcRenderer.invoke('devscope:terminal:kill', id),
        write: (id: string, data: string) =>
            ipcRenderer.invoke('devscope:terminal:write', id, data),
        resize: (id: string, cols: number, rows: number) =>
            ipcRenderer.invoke('devscope:terminal:resize', id, cols, rows),
        capabilities: () =>
            ipcRenderer.invoke('devscope:terminal:capabilities'),
        suggestions: (toolId: string) =>
            ipcRenderer.invoke('devscope:terminal:suggestions', toolId),
        banner: (sessionId?: string) =>
            ipcRenderer.invoke('devscope:terminal:banner', sessionId),
        onOutput: (callback: (data: { id: string; data: string; type: string; exitCode?: number }) => void) => {
            const handler = (_event: Electron.IpcRendererEvent, payload: { id: string; data: string; type: string; exitCode?: number }) => {
                callback(payload)
            }
            ipcRenderer.on('devscope:terminal:output', handler)
            // Return cleanup function
            return () => ipcRenderer.removeListener('devscope:terminal:output', handler)
        }
    },

    // AgentScope - AI Agent Orchestration (ALPHA)
    agentscope: {
        create: (config: { agentId: string; cwd?: string; task?: string; autoStart?: boolean }) =>
            ipcRenderer.invoke('devscope:agentscope:create', config),
        start: (sessionId: string, task?: string) =>
            ipcRenderer.invoke('devscope:agentscope:start', sessionId, task),
        write: (sessionId: string, data: string) =>
            ipcRenderer.invoke('devscope:agentscope:write', sessionId, data),
        kill: (sessionId: string) =>
            ipcRenderer.invoke('devscope:agentscope:kill', sessionId),
        remove: (sessionId: string) =>
            ipcRenderer.invoke('devscope:agentscope:remove', sessionId),
        get: (sessionId: string) =>
            ipcRenderer.invoke('devscope:agentscope:get', sessionId),
        list: () =>
            ipcRenderer.invoke('devscope:agentscope:list'),
        resize: (sessionId: string, cols: number, rows: number) =>
            ipcRenderer.invoke('devscope:agentscope:resize', sessionId, cols, rows),
        // Event listeners for real-time updates
        onSessionCreated: (callback: (data: any) => void) => {
            const handler = (_event: Electron.IpcRendererEvent, payload: any) => callback(payload)
            ipcRenderer.on('agentscope:session-created', handler)
            return () => ipcRenderer.removeListener('agentscope:session-created', handler)
        },
        onSessionUpdated: (callback: (data: any) => void) => {
            const handler = (_event: Electron.IpcRendererEvent, payload: any) => callback(payload)
            ipcRenderer.on('agentscope:session-updated', handler)
            return () => ipcRenderer.removeListener('agentscope:session-updated', handler)
        },
        onSessionClosed: (callback: (data: any) => void) => {
            const handler = (_event: Electron.IpcRendererEvent, payload: any) => callback(payload)
            ipcRenderer.on('agentscope:session-closed', handler)
            return () => ipcRenderer.removeListener('agentscope:session-closed', handler)
        },
        onOutput: (callback: (data: { sessionId: string; data: string }) => void) => {
            const handler = (_event: Electron.IpcRendererEvent, payload: { sessionId: string; data: string }) => callback(payload)
            ipcRenderer.on('agentscope:output', handler)
            return () => ipcRenderer.removeListener('agentscope:output', handler)
        },
        onStatusChange: (callback: (data: { sessionId: string; status: string; phase?: string }) => void) => {
            const handler = (_event: Electron.IpcRendererEvent, payload: { sessionId: string; status: string; phase?: string }) => callback(payload)
            ipcRenderer.on('agentscope:status-change', handler)
            return () => ipcRenderer.removeListener('agentscope:status-change', handler)
        }
    },

    // AI Features
    testGroqConnection: (apiKey: string) => ipcRenderer.invoke('devscope:testGroqConnection', apiKey),
    generateCommitMessage: (apiKey: string, diff: string) => ipcRenderer.invoke('devscope:generateCommitMessage', apiKey, diff),

    // Window Controls
    window: {
        minimize: () => ipcRenderer.send('window:minimize'),
        maximize: () => ipcRenderer.send('window:maximize'),
        close: () => ipcRenderer.send('window:close'),
        isMaximized: () => ipcRenderer.invoke('window:isMaximized')
    }
}

// Expose to renderer
contextBridge.exposeInMainWorld('devscope', devScopeAPI)

// Type declaration for TypeScript
declare global {
    interface Window {
        devscope: typeof devScopeAPI
    }
}
