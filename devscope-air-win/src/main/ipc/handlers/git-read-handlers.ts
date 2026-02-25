import log from 'electron-log'
import {
    checkIsGitRepo,
    generateCustomGitignoreContent,
    generateGitignoreContent,
    getCommitDiff,
    getGitHistory,
    getGitStatus,
    getGitStatusDetailed,
    getGitUser,
    getGitignorePatterns,
    getGitignoreTemplates,
    getProjectsGitOverview as getProjectsGitOverviewBatch,
    getRepoOwner,
    getUnpushedCommits,
    getWorkingChangesForAI,
    getWorkingDiff,
    hasRemoteOrigin
} from '../../inspectors/git'

export async function handleGetGitHistory(_event: Electron.IpcMainInvokeEvent, projectPath: string) {
    try {
        const result = await getGitHistory(projectPath)
        return { success: true, ...result }
    } catch (err: any) {
        log.error('Failed to get git history:', err)
        return { success: false, error: err.message }
    }
}

export async function handleGetCommitDiff(_event: Electron.IpcMainInvokeEvent, projectPath: string, commitHash: string) {
    try {
        const diff = await getCommitDiff(projectPath, commitHash)
        return { success: true, diff }
    } catch (err: any) {
        log.error('Failed to get commit diff:', err)
        return { success: false, error: err.message }
    }
}

export async function handleGetWorkingDiff(
    _event: Electron.IpcMainInvokeEvent,
    projectPath: string,
    filePath?: string,
    mode: 'combined' | 'staged' | 'unstaged' = 'combined'
) {
    try {
        const diff = await getWorkingDiff(projectPath, filePath, mode)
        return { success: true, diff }
    } catch (err: any) {
        log.error('Failed to get working diff:', err)
        return { success: false, error: err.message }
    }
}

export async function handleGetWorkingChangesForAI(_event: Electron.IpcMainInvokeEvent, projectPath: string) {
    try {
        const context = await getWorkingChangesForAI(projectPath)
        return { success: true, context }
    } catch (err: any) {
        log.error('Failed to get working changes context for AI:', err)
        return { success: false, error: err.message }
    }
}

export async function handleGetGitStatus(_event: Electron.IpcMainInvokeEvent, projectPath: string) {
    try {
        const status = await getGitStatus(projectPath)
        return { success: true, status }
    } catch (err: any) {
        log.error('Failed to get git status:', err)
        return { success: false, error: err.message }
    }
}

export async function handleGetGitStatusDetailed(_event: Electron.IpcMainInvokeEvent, projectPath: string) {
    try {
        const entries = await getGitStatusDetailed(projectPath)
        return { success: true, entries }
    } catch (err: any) {
        log.error('Failed to get detailed git status:', err)
        return { success: false, error: err.message }
    }
}

export async function handleGetUnpushedCommits(_event: Electron.IpcMainInvokeEvent, projectPath: string) {
    try {
        const commits = await getUnpushedCommits(projectPath)
        return { success: true, commits }
    } catch (err: any) {
        log.error('Failed to get unpushed commits:', err)
        return { success: false, error: err.message }
    }
}

export async function handleGetGitUser(_event: Electron.IpcMainInvokeEvent, projectPath: string) {
    try {
        const user = await getGitUser(projectPath)
        return { success: true, user }
    } catch (err: any) {
        log.error('Failed to get git user:', err)
        return { success: false, error: err.message }
    }
}

export async function handleGetRepoOwner(_event: Electron.IpcMainInvokeEvent, projectPath: string) {
    try {
        const owner = await getRepoOwner(projectPath)
        return { success: true, owner }
    } catch (err: any) {
        log.error('Failed to get repo owner:', err)
        return { success: false, error: err.message }
    }
}

export async function handleHasRemoteOrigin(_event: Electron.IpcMainInvokeEvent, projectPath: string) {
    try {
        const hasRemote = await hasRemoteOrigin(projectPath)
        return { success: true, hasRemote }
    } catch (err: any) {
        log.error('Failed to check remote origin:', err)
        return { success: false, error: err.message }
    }
}

export async function handleGetProjectsGitOverview(_event: Electron.IpcMainInvokeEvent, projectPaths: string[]) {
    try {
        const items = await getProjectsGitOverviewBatch(projectPaths)
        return { success: true, items }
    } catch (err: any) {
        log.error('Failed to get project git overview:', err)
        return { success: false, error: err.message }
    }
}

export async function handleCheckIsGitRepo(_event: Electron.IpcMainInvokeEvent, projectPath: string) {
    try {
        const isGitRepo = await checkIsGitRepo(projectPath)
        return { success: true, isGitRepo }
    } catch (err: any) {
        log.error('Failed to check git repo:', err)
        return { success: false, error: err.message }
    }
}

export async function handleGetGitignoreTemplates() {
    try {
        const templates = getGitignoreTemplates()
        return { success: true, templates }
    } catch (err: any) {
        log.error('Failed to get gitignore templates:', err)
        return { success: false, error: err.message }
    }
}

export async function handleGenerateGitignoreContent(_event: Electron.IpcMainInvokeEvent, template: string) {
    try {
        const content = generateGitignoreContent(template)
        return { success: true, content }
    } catch (err: any) {
        log.error('Failed to generate gitignore content:', err)
        return { success: false, error: err.message }
    }
}

export async function handleGetGitignorePatterns() {
    try {
        const patterns = getGitignorePatterns()
        return { success: true, patterns }
    } catch (err: any) {
        log.error('Failed to get gitignore patterns:', err)
        return { success: false, error: err.message }
    }
}

export async function handleGenerateCustomGitignoreContent(_event: Electron.IpcMainInvokeEvent, selectedPatternIds: string[]) {
    try {
        const content = generateCustomGitignoreContent(selectedPatternIds)
        return { success: true, content }
    } catch (err: any) {
        log.error('Failed to generate custom gitignore content:', err)
        return { success: false, error: err.message }
    }
}
