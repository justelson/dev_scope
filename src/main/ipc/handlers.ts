/**
 * DevScope - IPC Handler Registry
 */

import { BrowserWindow, ipcMain } from 'electron'
import log from 'electron-log'
import { systemMetricsBridge } from '../system-metrics/manager'
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
    handleGenerateCommitMessage,
    handleGetAiDebugLogs,
    handleGetStartupSettings,
    handleSetStartupSettings,
    handleTestCodexConnection,
    handleTestGeminiConnection,
    handleTestGroqConnection
} from './handlers/settings-ai-handlers'
import {
    handleAssistantArchiveSession,
    handleAssistantBootstrap,
    handleAssistantClearLogs,
    handleAssistantConnect,
    handleAssistantCreateSession,
    handleAssistantDeleteMessage,
    handleAssistantDeleteSession,
    handleAssistantDisconnect,
    handleAssistantGetAccountOverview,
    handleAssistantGetSnapshot,
    handleAssistantGetStatus,
    handleAssistantInterruptTurn,
    handleAssistantListModels,
    handleAssistantNewThread,
    handleAssistantPersistClipboardImage,
    handleAssistantRenameSession,
    handleAssistantRespondApproval,
    handleAssistantRespondUserInput,
    handleAssistantSelectSession,
    handleAssistantSendPrompt,
    handleAssistantSetSessionProjectPath,
    handleAssistantSubscribe,
    handleAssistantUnsubscribe
} from './handlers/assistant-handlers'
import { ASSISTANT_IPC } from '../../shared/assistant/contracts'
import { peekAssistantService } from '../assistant'
import {
    handleCopyToClipboard,
    handleGetUserHomePath,
    handleIndexAllFolders,
    handleOpenFile,
    handleOpenInExplorer,
    handleOpenProjectInIde,
    handleOpenWith,
    handleListInstalledIdes,
    handleScanProjects,
    handleSelectFolder,
    handleSelectMarkdownFile
} from './handlers/project-discovery-handlers'
import {
    handleGetActivePorts,
    handleGetProjectDetails,
    handleInstallProjectDependencies,
    handleGetRunningApps,
    handleGetProjectProcesses,
    handleGetProjectSessions
} from './handlers/project-details-handlers'
import {
    handleCreateFileSystemItem,
    handleDeleteFileSystemItem,
    handleGetFileTree,
    handleGetPathInfo,
    handlePasteFileSystemItem,
    handleMoveFileSystemItem,
    handleReadFileContent,
    handleReadTextFileFull,
    handleRenameFileSystemItem,
    handleWriteTextFile
} from './handlers/file-tree-handlers'
import { handleOpenInTerminal } from './handlers/terminal-handlers'
import {
    handleClosePreviewTerminal,
    handleCreatePreviewTerminal,
    handleListPreviewTerminalSessions,
    handleResizePreviewTerminal,
    handleWritePreviewTerminal
} from './handlers/preview-terminal-handlers'
import { handleRunPythonPreview, handleStopPythonPreview } from './handlers/python-preview-handlers'
import { handleListActiveTasks } from './handlers/task-manager-handlers'
import {
    handleCheckForUpdates,
    handleDownloadUpdate,
    handleGetUpdateState,
    handleInstallUpdate
} from './handlers/update-handlers'
import {
    handleCheckIsGitRepo,
    handleGenerateCustomGitignoreContent,
    handleGenerateGitignoreContent,
    handleGetCommitDiff,
    handleGetGitCommitStats,
    handleGetGitHistory,
    handleGetGitHistoryCount,
    handleGetGitStatusEntryStats,
    handleGetGitSyncStatus,
    handleGetGitStatus,
    handleGetGitStatusDetailed,
    handleGetGitHubPublishContext,
    handleGetCurrentBranchPullRequest,
    handleGetGlobalGitUser,
    handleGetGitUser,
    handleGetGitignorePatterns,
    handleGetGitignoreTemplates,
    handleGetIncomingCommits,
    handleGetProjectsGitOverview,
    handleGetRepoOwner,
    handleGetUnpushedCommits,
    handleGetWorkingChangesForAI,
    handleGetWorkingDiff,
    handleHasRemoteOrigin
} from './handlers/git-read-handlers'
import {
    handleAddRemote,
    handleAddRemoteOrigin,
    handleApplyStash,
    handleCheckoutBranch,
    handleCreateBranch,
    handleCreateCommit,
    handleCreateOrOpenPullRequest,
    handleCommitPushAndCreatePullRequest,
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
    handlePushSingleCommit,
    handleRemoveRemote,
    handleSetRemoteUrl,
    handleSetGlobalGitUser,
    handleStageFiles,
    handleUnstageFiles
} from './handlers/git-write-handlers'
import {
    UPDATE_CHECK_CHANNEL,
    UPDATE_DOWNLOAD_CHANNEL,
    UPDATE_GET_STATE_CHANNEL,
    UPDATE_INSTALL_CHANNEL
} from '../update/manager'

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
    ipcMain.handle(UPDATE_GET_STATE_CHANNEL, handleGetUpdateState)
    ipcMain.handle(UPDATE_CHECK_CHANNEL, handleCheckForUpdates)
    ipcMain.handle(UPDATE_DOWNLOAD_CHANNEL, handleDownloadUpdate)
    ipcMain.handle(UPDATE_INSTALL_CHANNEL, handleInstallUpdate)

    ipcMain.handle('devscope:setStartupSettings', handleSetStartupSettings)
    ipcMain.handle('devscope:getStartupSettings', handleGetStartupSettings)
    ipcMain.handle('devscope:testGroqConnection', handleTestGroqConnection)
    ipcMain.handle('devscope:testGeminiConnection', handleTestGeminiConnection)
    ipcMain.handle('devscope:testCodexConnection', handleTestCodexConnection)
    ipcMain.handle('devscope:generateCommitMessage', handleGenerateCommitMessage)
    ipcMain.handle('devscope:getAiDebugLogs', handleGetAiDebugLogs)
    ipcMain.handle('devscope:clearAiDebugLogs', handleClearAiDebugLogs)
    ipcMain.handle(ASSISTANT_IPC.subscribe, handleAssistantSubscribe)
    ipcMain.handle(ASSISTANT_IPC.unsubscribe, handleAssistantUnsubscribe)
    ipcMain.handle(ASSISTANT_IPC.bootstrap, handleAssistantBootstrap)
    ipcMain.handle(ASSISTANT_IPC.getSnapshot, handleAssistantGetSnapshot)
    ipcMain.handle(ASSISTANT_IPC.getStatus, handleAssistantGetStatus)
    ipcMain.handle(ASSISTANT_IPC.getAccountOverview, handleAssistantGetAccountOverview)
    ipcMain.handle(ASSISTANT_IPC.listModels, handleAssistantListModels)
    ipcMain.handle(ASSISTANT_IPC.connect, handleAssistantConnect)
    ipcMain.handle(ASSISTANT_IPC.disconnect, handleAssistantDisconnect)
    ipcMain.handle(ASSISTANT_IPC.createSession, handleAssistantCreateSession)
    ipcMain.handle(ASSISTANT_IPC.selectSession, handleAssistantSelectSession)
    ipcMain.handle(ASSISTANT_IPC.renameSession, handleAssistantRenameSession)
    ipcMain.handle(ASSISTANT_IPC.archiveSession, handleAssistantArchiveSession)
    ipcMain.handle(ASSISTANT_IPC.deleteSession, handleAssistantDeleteSession)
    ipcMain.handle(ASSISTANT_IPC.deleteMessage, handleAssistantDeleteMessage)
    ipcMain.handle(ASSISTANT_IPC.clearLogs, handleAssistantClearLogs)
    ipcMain.handle(ASSISTANT_IPC.setSessionProjectPath, handleAssistantSetSessionProjectPath)
    ipcMain.handle(ASSISTANT_IPC.persistClipboardImage, handleAssistantPersistClipboardImage)
    ipcMain.handle(ASSISTANT_IPC.newThread, handleAssistantNewThread)
    ipcMain.handle(ASSISTANT_IPC.sendPrompt, handleAssistantSendPrompt)
    ipcMain.handle(ASSISTANT_IPC.interruptTurn, handleAssistantInterruptTurn)
    ipcMain.handle(ASSISTANT_IPC.respondApproval, handleAssistantRespondApproval)
    ipcMain.handle(ASSISTANT_IPC.respondUserInput, handleAssistantRespondUserInput)

    ipcMain.handle('devscope:selectFolder', handleSelectFolder)
    ipcMain.handle('devscope:selectMarkdownFile', handleSelectMarkdownFile)
    ipcMain.handle('devscope:getUserHomePath', handleGetUserHomePath)
    ipcMain.handle('devscope:scanProjects', handleScanProjects)
    ipcMain.handle('devscope:indexAllFolders', handleIndexAllFolders)
    ipcMain.handle('devscope:openInExplorer', handleOpenInExplorer)
    ipcMain.handle('devscope:openInTerminal', handleOpenInTerminal)
    ipcMain.handle('devscope:listInstalledIdes', handleListInstalledIdes)
    ipcMain.handle('devscope:openProjectInIde', handleOpenProjectInIde)
    ipcMain.handle('devscope:tasks:listActive', handleListActiveTasks)
    ipcMain.handle('devscope:previewTerminal:create', handleCreatePreviewTerminal)
    ipcMain.handle('devscope:previewTerminal:list', handleListPreviewTerminalSessions)
    ipcMain.handle('devscope:previewTerminal:write', handleWritePreviewTerminal)
    ipcMain.handle('devscope:previewTerminal:resize', handleResizePreviewTerminal)
    ipcMain.handle('devscope:previewTerminal:close', handleClosePreviewTerminal)
    ipcMain.handle('devscope:pythonPreview:run', handleRunPythonPreview)
    ipcMain.handle('devscope:pythonPreview:stop', handleStopPythonPreview)
    ipcMain.handle('devscope:copyToClipboard', handleCopyToClipboard)
    ipcMain.handle('devscope:getProjectDetails', handleGetProjectDetails)
    ipcMain.handle('devscope:installProjectDependencies', handleInstallProjectDependencies)
    ipcMain.handle('devscope:getFileTree', handleGetFileTree)
    ipcMain.handle('devscope:readFileContent', handleReadFileContent)
    ipcMain.handle('devscope:readTextFileFull', handleReadTextFileFull)
    ipcMain.handle('devscope:getPathInfo', handleGetPathInfo)
    ipcMain.handle('devscope:writeTextFile', handleWriteTextFile)
    ipcMain.handle('devscope:openFile', handleOpenFile)
    ipcMain.handle('devscope:openWith', handleOpenWith)
    ipcMain.handle('devscope:createFileSystemItem', handleCreateFileSystemItem)
    ipcMain.handle('devscope:renameFileSystemItem', handleRenameFileSystemItem)
    ipcMain.handle('devscope:deleteFileSystemItem', handleDeleteFileSystemItem)
    ipcMain.handle('devscope:pasteFileSystemItem', handlePasteFileSystemItem)
    ipcMain.handle('devscope:moveFileSystemItem', handleMoveFileSystemItem)
    ipcMain.handle('devscope:getProjectSessions', handleGetProjectSessions)
    ipcMain.handle('devscope:getProjectProcesses', handleGetProjectProcesses)
    ipcMain.handle('devscope:getRunningApps', handleGetRunningApps)
    ipcMain.handle('devscope:getActivePorts', handleGetActivePorts)

    ipcMain.handle('devscope:getGitHistory', handleGetGitHistory)
    ipcMain.handle('devscope:getGitHistoryCount', handleGetGitHistoryCount)
    ipcMain.handle('devscope:getGitCommitStats', handleGetGitCommitStats)
    ipcMain.handle('devscope:getCommitDiff', handleGetCommitDiff)
    ipcMain.handle('devscope:getWorkingDiff', handleGetWorkingDiff)
    ipcMain.handle('devscope:getWorkingChangesForAI', handleGetWorkingChangesForAI)
    ipcMain.handle('devscope:getGitStatus', handleGetGitStatus)
    ipcMain.handle('devscope:getGitStatusDetailed', handleGetGitStatusDetailed)
    ipcMain.handle('devscope:getGitStatusEntryStats', handleGetGitStatusEntryStats)
    ipcMain.handle('devscope:getGitSyncStatus', handleGetGitSyncStatus)
    ipcMain.handle('devscope:getIncomingCommits', handleGetIncomingCommits)
    ipcMain.handle('devscope:getUnpushedCommits', handleGetUnpushedCommits)
    ipcMain.handle('devscope:getGitUser', handleGetGitUser)
    ipcMain.handle('devscope:getGlobalGitUser', handleGetGlobalGitUser)
    ipcMain.handle('devscope:getRepoOwner', handleGetRepoOwner)
    ipcMain.handle('devscope:getGitHubPublishContext', handleGetGitHubPublishContext)
    ipcMain.handle('devscope:getCurrentBranchPullRequest', handleGetCurrentBranchPullRequest)
    ipcMain.handle('devscope:hasRemoteOrigin', handleHasRemoteOrigin)
    ipcMain.handle('devscope:getProjectsGitOverview', handleGetProjectsGitOverview)
    ipcMain.handle('devscope:checkIsGitRepo', handleCheckIsGitRepo)

    ipcMain.handle('devscope:stageFiles', handleStageFiles)
    ipcMain.handle('devscope:unstageFiles', handleUnstageFiles)
    ipcMain.handle('devscope:discardChanges', handleDiscardChanges)
    ipcMain.handle('devscope:createCommit', handleCreateCommit)
    ipcMain.handle('devscope:createOrOpenPullRequest', handleCreateOrOpenPullRequest)
    ipcMain.handle('devscope:commitPushAndCreatePullRequest', handleCommitPushAndCreatePullRequest)
    ipcMain.handle('devscope:setGlobalGitUser', handleSetGlobalGitUser)
    ipcMain.handle('devscope:pushCommits', handlePushCommits)
    ipcMain.handle('devscope:pushSingleCommit', handlePushSingleCommit)
    ipcMain.handle('devscope:fetchUpdates', handleFetchUpdates)
    ipcMain.handle('devscope:pullUpdates', handlePullUpdates)
    ipcMain.handle('devscope:listBranches', handleListBranches)
    ipcMain.handle('devscope:createBranch', handleCreateBranch)
    ipcMain.handle('devscope:checkoutBranch', handleCheckoutBranch)
    ipcMain.handle('devscope:deleteBranch', handleDeleteBranch)
    ipcMain.handle('devscope:addRemote', handleAddRemote)
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
        peekAssistantService()?.unsubscribe(mainWindow.webContents.id)
    })
}
