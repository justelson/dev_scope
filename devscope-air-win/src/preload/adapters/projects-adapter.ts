import { ipcRenderer } from 'electron'

export function createProjectsAdapter() {
    return {
        selectFolder: () => ipcRenderer.invoke('devscope:selectFolder'),
        scanProjects: (folderPath: string, options?: { forceRefresh?: boolean }) =>
            ipcRenderer.invoke('devscope:scanProjects', folderPath, options),
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
        openWith: (filePath: string) => ipcRenderer.invoke('devscope:openWith', filePath),
        renameFileSystemItem: (targetPath: string, nextName: string) =>
            ipcRenderer.invoke('devscope:renameFileSystemItem', targetPath, nextName),
        deleteFileSystemItem: (targetPath: string) => ipcRenderer.invoke('devscope:deleteFileSystemItem', targetPath),
        pasteFileSystemItem: (sourcePath: string, destinationDirectory: string) =>
            ipcRenderer.invoke('devscope:pasteFileSystemItem', sourcePath, destinationDirectory),
        getProjectSessions: (_projectPath: string) => Promise.resolve({ success: true, sessions: [] }),
        getProjectProcesses: (projectPath: string) => ipcRenderer.invoke('devscope:getProjectProcesses', projectPath),
        indexAllFolders: (folders: string[]) => ipcRenderer.invoke('devscope:indexAllFolders', folders),
        getFileSystemRoots: () => ipcRenderer.invoke('devscope:getFileSystemRoots')
    }
}
