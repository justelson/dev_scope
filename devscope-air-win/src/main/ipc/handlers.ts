/**
 * DevScope - IPC Handler Registry
 */

import { BrowserWindow, ipcMain } from 'electron'
import log from 'electron-log'
import {
    handleGetDetailedSystemStats,
    handleGetDeveloperTooling,
    handleGetFileSystemRoots,
    handleGetReadinessReport,
    handleGetSystemOverview,
    handleRefreshAll,
    handleSystemMetricsBootstrap,
    handleSystemMetricsRead,
    handleSystemMetricsSubscribe,
    handleSystemMetricsUnsubscribe
} from './handlers/system-handlers'
import {
    handleClearAiDebugLogs,
    handleExportData,
    handleGenerateCommitMessage,
    handleGetAiDebugLogs,
    handleGetStartupSettings,
    handleSetStartupSettings,
    handleTestGeminiConnection,
    handleTestGroqConnection
} from './handlers/settings-ai-handlers'
import {
    handleCopyToClipboard,
    handleIndexAllFolders,
    handleOpenFile,
    handleOpenInExplorer,
    handleScanProjects,
    handleSelectFolder
} from './handlers/project-discovery-handlers'
import {
    handleGetProjectDetails,
    handleGetProjectProcesses,
    handleGetProjectSessions
} from './handlers/project-details-handlers'
import { handleGetFileTree, handleReadFileContent } from './handlers/file-tree-handlers'
import { handleOpenInTerminal } from './handlers/terminal-handlers'
import {
    handleCheckIsGitRepo,
    handleGenerateCustomGitignoreContent,
    handleGenerateGitignoreContent,
    handleGetCommitDiff,
    handleGetGitHistory,
    handleGetGitStatus,
    handleGetGitUser,
    handleGetGitignorePatterns,
    handleGetGitignoreTemplates,
    handleGetProjectsGitOverview,
    handleGetRepoOwner,
    handleGetUnpushedCommits,
    handleGetWorkingChangesForAI,
    handleGetWorkingDiff,
    handleHasRemoteOrigin
} from './handlers/git-read-handlers'
import {
    handleAddRemoteOrigin,
    handleApplyStash,
    handleCheckoutBranch,
    handleCreateBranch,
    handleCreateCommit,
    handleCreateInitialCommit,
    handleCreateStash,
    handleCreateTag,
    handleDeleteBranch,
    handleDeleteTag,
    handleDiscardChanges,
    handleDropStash,
    handleFetchUpdates,
    handleInitGitRepo,
    handleListBranches,
    handleListRemotes,
    handleListStashes,
    handleListTags,
    handlePullUpdates,
    handlePushCommits,
    handleRemoveRemote,
    handleSetRemoteUrl,
    handleStageFiles,
    handleUnstageFiles
} from './handlers/git-write-handlers'

export function registerIpcHandlers(mainWindow: BrowserWindow): void {
    log.info('Registering IPC handlers...')

    ipcMain.handle('devscope:system:bootstrap', handleSystemMetricsBootstrap)
    ipcMain.handle('devscope:system:subscribe', handleSystemMetricsSubscribe)
    ipcMain.handle('devscope:system:unsubscribe', handleSystemMetricsUnsubscribe)
    ipcMain.handle('devscope:system:readMetrics', handleSystemMetricsRead)

    ipcMain.handle('devscope:getSystemOverview', handleGetSystemOverview)
    ipcMain.handle('devscope:getDetailedSystemStats', handleGetDetailedSystemStats)
    ipcMain.handle('devscope:getDeveloperTooling', handleGetDeveloperTooling)
    ipcMain.handle('devscope:getReadinessReport', handleGetReadinessReport)
    ipcMain.handle('devscope:refreshAll', handleRefreshAll)
    ipcMain.handle('devscope:getFileSystemRoots', handleGetFileSystemRoots)

    ipcMain.handle('devscope:exportData', handleExportData)
    ipcMain.handle('devscope:setStartupSettings', handleSetStartupSettings)
    ipcMain.handle('devscope:getStartupSettings', handleGetStartupSettings)
    ipcMain.handle('devscope:testGroqConnection', handleTestGroqConnection)
    ipcMain.handle('devscope:testGeminiConnection', handleTestGeminiConnection)
    ipcMain.handle('devscope:generateCommitMessage', handleGenerateCommitMessage)
    ipcMain.handle('devscope:getAiDebugLogs', handleGetAiDebugLogs)
    ipcMain.handle('devscope:clearAiDebugLogs', handleClearAiDebugLogs)

    ipcMain.handle('devscope:selectFolder', handleSelectFolder)
    ipcMain.handle('devscope:scanProjects', handleScanProjects)
    ipcMain.handle('devscope:indexAllFolders', handleIndexAllFolders)
    ipcMain.handle('devscope:openInExplorer', handleOpenInExplorer)
    ipcMain.handle('devscope:openInTerminal', handleOpenInTerminal)
    ipcMain.handle('devscope:copyToClipboard', handleCopyToClipboard)
    ipcMain.handle('devscope:getProjectDetails', handleGetProjectDetails)
    ipcMain.handle('devscope:getFileTree', handleGetFileTree)
    ipcMain.handle('devscope:readFileContent', handleReadFileContent)
    ipcMain.handle('devscope:openFile', handleOpenFile)
    ipcMain.handle('devscope:getProjectSessions', handleGetProjectSessions)
    ipcMain.handle('devscope:getProjectProcesses', handleGetProjectProcesses)

    ipcMain.handle('devscope:getGitHistory', handleGetGitHistory)
    ipcMain.handle('devscope:getCommitDiff', handleGetCommitDiff)
    ipcMain.handle('devscope:getWorkingDiff', handleGetWorkingDiff)
    ipcMain.handle('devscope:getWorkingChangesForAI', handleGetWorkingChangesForAI)
    ipcMain.handle('devscope:getGitStatus', handleGetGitStatus)
    ipcMain.handle('devscope:getUnpushedCommits', handleGetUnpushedCommits)
    ipcMain.handle('devscope:getGitUser', handleGetGitUser)
    ipcMain.handle('devscope:getRepoOwner', handleGetRepoOwner)
    ipcMain.handle('devscope:hasRemoteOrigin', handleHasRemoteOrigin)
    ipcMain.handle('devscope:getProjectsGitOverview', handleGetProjectsGitOverview)
    ipcMain.handle('devscope:checkIsGitRepo', handleCheckIsGitRepo)

    ipcMain.handle('devscope:stageFiles', handleStageFiles)
    ipcMain.handle('devscope:unstageFiles', handleUnstageFiles)
    ipcMain.handle('devscope:discardChanges', handleDiscardChanges)
    ipcMain.handle('devscope:createCommit', handleCreateCommit)
    ipcMain.handle('devscope:pushCommits', handlePushCommits)
    ipcMain.handle('devscope:fetchUpdates', handleFetchUpdates)
    ipcMain.handle('devscope:pullUpdates', handlePullUpdates)
    ipcMain.handle('devscope:listBranches', handleListBranches)
    ipcMain.handle('devscope:createBranch', handleCreateBranch)
    ipcMain.handle('devscope:checkoutBranch', handleCheckoutBranch)
    ipcMain.handle('devscope:deleteBranch', handleDeleteBranch)
    ipcMain.handle('devscope:listRemotes', handleListRemotes)
    ipcMain.handle('devscope:setRemoteUrl', handleSetRemoteUrl)
    ipcMain.handle('devscope:removeRemote', handleRemoveRemote)
    ipcMain.handle('devscope:listTags', handleListTags)
    ipcMain.handle('devscope:createTag', handleCreateTag)
    ipcMain.handle('devscope:deleteTag', handleDeleteTag)
    ipcMain.handle('devscope:listStashes', handleListStashes)
    ipcMain.handle('devscope:createStash', handleCreateStash)
    ipcMain.handle('devscope:applyStash', handleApplyStash)
    ipcMain.handle('devscope:dropStash', handleDropStash)
    ipcMain.handle('devscope:initGitRepo', handleInitGitRepo)
    ipcMain.handle('devscope:createInitialCommit', handleCreateInitialCommit)
    ipcMain.handle('devscope:addRemoteOrigin', handleAddRemoteOrigin)
    ipcMain.handle('devscope:getGitignoreTemplates', handleGetGitignoreTemplates)
    ipcMain.handle('devscope:generateGitignoreContent', handleGenerateGitignoreContent)
    ipcMain.handle('devscope:getGitignorePatterns', handleGetGitignorePatterns)
    ipcMain.handle('devscope:generateCustomGitignoreContent', handleGenerateCustomGitignoreContent)

    ipcMain.removeAllListeners('window:minimize')
    ipcMain.removeAllListeners('window:maximize')
    ipcMain.removeAllListeners('window:close')
    ipcMain.removeHandler('window:isMaximized')

    ipcMain.on('window:minimize', () => {
        if (!mainWindow.isDestroyed()) mainWindow.minimize()
    })
    ipcMain.on('window:maximize', () => {
        if (!mainWindow.isDestroyed()) {
            if (mainWindow.isMaximized()) mainWindow.unmaximize()
            else mainWindow.maximize()
        }
    })
    ipcMain.on('window:close', () => {
        if (!mainWindow.isDestroyed()) mainWindow.close()
    })
    ipcMain.handle('window:isMaximized', () => {
        if (mainWindow.isDestroyed()) return false
        return mainWindow.isMaximized()
    })

    mainWindow.webContents.once('destroyed', () => {
        systemMetricsBridge.unsubscribe(mainWindow.webContents.id)
    })
}
