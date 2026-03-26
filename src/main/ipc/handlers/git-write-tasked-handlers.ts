import log from 'electron-log'
import {
    addRemote,
    addRemoteOrigin,
    createCommit,
    fetchUpdates,
    initGitRepo,
    pullUpdates,
    pushCommits,
    pushSingleCommit
} from '../../inspectors/git'
import { appendTaskLog, completeTask, createTask } from '../task-manager'
import { createOrOpenPullRequest, logPullRequestError, summarizePullRequestOutcome } from '../../services/github-pull-request'
import { commitPushAndCreatePullRequest } from '../../services/git-stacked-pull-request'

export async function handleCreateCommit(_event: Electron.IpcMainInvokeEvent, projectPath: string, message: string) {
    const task = createTask({
        type: 'git.commit',
        title: 'Create commit',
        projectPath,
        initialLog: `Preparing commit in ${projectPath}`
    })
    try {
        appendTaskLog(task.id, `Commit message: ${message}`)
        await createCommit(projectPath, message)
        completeTask(task.id, 'success', 'Commit created successfully.')
        return { success: true }
    } catch (err: any) {
        log.error('Failed to create commit:', err)
        completeTask(task.id, 'failed', err?.message || 'Failed to create commit.')
        return { success: false, error: err.message }
    }
}

export async function handlePushCommits(
    _event: Electron.IpcMainInvokeEvent,
    projectPath: string,
    options?: { remoteName?: string; branchName?: string }
) {
    const task = createTask({
        type: 'git.push',
        title: 'Push commits',
        projectPath,
        initialLog: `Pushing commits for ${projectPath}`
    })
    try {
        await pushCommits(projectPath, options)
        completeTask(task.id, 'success', 'Push completed successfully.')
        return { success: true }
    } catch (err: any) {
        log.error('Failed to push commits:', err)
        completeTask(task.id, 'failed', err?.message || 'Failed to push commits.')
        return { success: false, error: err.message }
    }
}

export async function handlePushSingleCommit(
    _event: Electron.IpcMainInvokeEvent,
    projectPath: string,
    commitHash: string,
    options?: { remoteName?: string; branchName?: string }
) {
    const task = createTask({
        type: 'git.push',
        title: 'Push single commit',
        projectPath,
        initialLog: `Pushing commit ${commitHash} for ${projectPath}`
    })
    try {
        await pushSingleCommit(projectPath, commitHash, options)
        completeTask(task.id, 'success', 'Single-commit push completed successfully.')
        return { success: true }
    } catch (err: any) {
        log.error('Failed to push single commit:', err)
        completeTask(task.id, 'failed', err?.message || 'Failed to push single commit.')
        return { success: false, error: err.message }
    }
}

export async function handleCreateOrOpenPullRequest(
    _event: Electron.IpcMainInvokeEvent,
    projectPath: string,
    input: {
        projectName?: string
        targetBranch?: string
        draft?: boolean
        title?: string
        body?: string
        guideText?: string
        provider?: 'groq' | 'gemini' | 'codex'
        apiKey?: string
        model?: string
    }
) {
    const task = createTask({
        type: 'git.pr',
        title: 'Create pull request',
        projectPath,
        initialLog: `Preparing pull request for ${projectPath}`
    })
    try {
        appendTaskLog(task.id, `Target branch: ${String(input?.targetBranch || 'auto').trim() || 'auto'}`)
        if (input?.draft !== false) {
            appendTaskLog(task.id, 'Draft mode: enabled')
        }
        const result = await createOrOpenPullRequest(projectPath, input || {})
        completeTask(task.id, 'success', summarizePullRequestOutcome(result))
        return { success: true, ...result }
    } catch (err: any) {
        const normalized = logPullRequestError('failed to create or open pull request', err)
        completeTask(task.id, 'failed', normalized.message)
        return { success: false, error: normalized.message }
    }
}

export async function handleCommitPushAndCreatePullRequest(
    _event: Electron.IpcMainInvokeEvent,
    projectPath: string,
    input: {
        projectName?: string
        commitMessage?: string
        targetBranch?: string
        draft?: boolean
        guideText?: string
        provider?: 'groq' | 'gemini' | 'codex'
        apiKey?: string
        model?: string
        autoStageAll?: boolean
        stageScope?: 'project' | 'repo'
    }
) {
    const task = createTask({
        type: 'git.stacked',
        title: 'Commit, push and create pull request',
        projectPath,
        initialLog: `Running stacked PR flow for ${projectPath}`
    })
    try {
        appendTaskLog(task.id, `Target branch: ${String(input?.targetBranch || 'auto').trim() || 'auto'}`)
        if (input?.autoStageAll) {
            appendTaskLog(task.id, `Auto-stage all: enabled (${input.stageScope === 'project' ? 'project scope' : 'repo scope'})`)
        }
        if (String(input?.commitMessage || '').trim()) {
            appendTaskLog(task.id, 'Commit message: provided manually')
        } else if (input?.provider) {
            appendTaskLog(task.id, `Commit message: AI generated by ${input.provider}${input?.model ? ` (${input.model})` : ''}`)
        }
        const result = await commitPushAndCreatePullRequest(projectPath, input || {}, (message) => {
            appendTaskLog(task.id, message)
        })
        completeTask(task.id, 'success', `Committed and ${summarizePullRequestOutcome(result).toLowerCase()}`)
        return { success: true, ...result }
    } catch (err: any) {
        const normalized = logPullRequestError('failed to run commit/push/pr flow', err)
        completeTask(task.id, 'failed', normalized.message)
        return { success: false, error: normalized.message }
    }
}

export async function handleFetchUpdates(_event: Electron.IpcMainInvokeEvent, projectPath: string, remoteName?: string) {
    const task = createTask({
        type: 'git.fetch',
        title: 'Fetch updates',
        projectPath,
        initialLog: remoteName ? `Fetching from ${remoteName}` : 'Fetching from default remote'
    })
    try {
        await fetchUpdates(projectPath, remoteName)
        completeTask(task.id, 'success', 'Fetch completed successfully.')
        return { success: true }
    } catch (err: any) {
        log.error('Failed to fetch updates:', err)
        completeTask(task.id, 'failed', err?.message || 'Failed to fetch updates.')
        return { success: false, error: err.message }
    }
}

export async function handlePullUpdates(
    _event: Electron.IpcMainInvokeEvent,
    projectPath: string,
    options?: { remoteName?: string; branchName?: string; pushRemoteName?: string }
) {
    const remoteName = String(options?.remoteName || '').trim()
    const pushRemoteName = String(options?.pushRemoteName || '').trim()
    const branchName = String(options?.branchName || '').trim()
    const task = createTask({
        type: 'git.pull',
        title: remoteName ? `Pull ${remoteName}` : 'Pull updates',
        projectPath,
        initialLog: remoteName
            ? pushRemoteName
                ? `Pulling ${branchName || 'current branch'} from ${remoteName} and syncing to ${pushRemoteName}`
                : `Pulling ${branchName || 'current branch'} from ${remoteName}`
            : 'Pulling latest changes from remote'
    })
    try {
        await pullUpdates(projectPath, options)
        completeTask(task.id, 'success', 'Pull completed successfully.')
        return { success: true }
    } catch (err: any) {
        log.error('Failed to pull updates:', err)
        completeTask(task.id, 'failed', err?.message || 'Failed to pull updates.')
        return { success: false, error: err.message }
    }
}

export async function handleAddRemote(
    _event: Electron.IpcMainInvokeEvent,
    projectPath: string,
    remoteName: string,
    remoteUrl: string
) {
    const task = createTask({
        type: 'git.remote',
        title: `Add remote ${remoteName}`,
        projectPath,
        initialLog: `Adding remote ${remoteName}: ${remoteUrl}`
    })
    try {
        const result = await addRemote(projectPath, remoteName, remoteUrl)
        if (result?.success) {
            completeTask(task.id, 'success', `Remote ${remoteName} added.`)
        } else {
            completeTask(task.id, 'failed', result?.error || `Failed to add remote ${remoteName}.`)
        }
        return result
    } catch (err: any) {
        log.error('Failed to add remote:', err)
        completeTask(task.id, 'failed', err?.message || `Failed to add remote ${remoteName}.`)
        return { success: false, error: err.message }
    }
}

export async function handleInitGitRepo(
    _event: Electron.IpcMainInvokeEvent,
    projectPath: string,
    branchName: string,
    createGitignore: boolean,
    gitignoreTemplate?: string
) {
    const task = createTask({
        type: 'git.init',
        title: 'Initialize repository',
        projectPath,
        initialLog: `Initializing git repository (${branchName})`
    })
    try {
        const result = await initGitRepo(projectPath, branchName, createGitignore, gitignoreTemplate)
        if (result?.success) {
            completeTask(task.id, 'success', 'Repository initialized.')
        } else {
            completeTask(task.id, 'failed', result?.error || 'Failed to initialize repository.')
        }
        return result
    } catch (err: any) {
        log.error('Failed to init git repo:', err)
        completeTask(task.id, 'failed', err?.message || 'Failed to initialize repository.')
        return { success: false, error: err.message }
    }
}

export async function handleAddRemoteOrigin(_event: Electron.IpcMainInvokeEvent, projectPath: string, remoteUrl: string) {
    const task = createTask({
        type: 'git.remote',
        title: 'Add remote origin',
        projectPath,
        initialLog: `Adding remote origin: ${remoteUrl}`
    })
    try {
        const result = await addRemoteOrigin(projectPath, remoteUrl)
        if (result?.success) {
            completeTask(task.id, 'success', 'Remote origin added.')
        } else {
            completeTask(task.id, 'failed', result?.error || 'Failed to add remote origin.')
        }
        return result
    } catch (err: any) {
        log.error('Failed to add remote origin:', err)
        completeTask(task.id, 'failed', err?.message || 'Failed to add remote origin.')
        return { success: false, error: err.message }
    }
}
