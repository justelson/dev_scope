import { BrowserWindow } from 'electron'

export const TASK_EVENT_CHANNEL = 'devscope:tasks:event'

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

const tasks = new Map<string, DevScopeTask>()
const MAX_TASKS = 200
const MAX_LOG_LINES = 80

function emitTaskEvent(event: DevScopeTaskEvent): void {
    const windows = BrowserWindow.getAllWindows()
    for (const window of windows) {
        if (window.isDestroyed()) continue
        window.webContents.send(TASK_EVENT_CHANNEL, event)
    }
}

function normalizeTask(task: DevScopeTask): DevScopeTask {
    return {
        ...task,
        logs: [...task.logs]
    }
}

function pruneTasks(): void {
    if (tasks.size <= MAX_TASKS) return
    const ordered = [...tasks.values()].sort((a, b) => a.updatedAt - b.updatedAt)
    const overflow = tasks.size - MAX_TASKS
    for (let index = 0; index < overflow; index += 1) {
        const candidate = ordered[index]
        if (!candidate) continue
        tasks.delete(candidate.id)
        emitTaskEvent({ type: 'remove', taskId: candidate.id })
    }
}

export function createTask(input: {
    type: DevScopeTaskType
    title: string
    projectPath?: string
    metadata?: Record<string, string | number | boolean>
    initialLog?: string
}): DevScopeTask {
    const now = Date.now()
    const task: DevScopeTask = {
        id: `task_${now}_${Math.random().toString(36).slice(2, 8)}`,
        type: input.type,
        title: input.title,
        status: 'running',
        projectPath: input.projectPath,
        startedAt: now,
        updatedAt: now,
        metadata: input.metadata,
        logs: input.initialLog
            ? [{ at: now, level: 'info', message: input.initialLog }]
            : []
    }
    tasks.set(task.id, task)
    emitTaskEvent({ type: 'upsert', task: normalizeTask(task) })
    pruneTasks()
    return task
}

export function appendTaskLog(taskId: string, message: string, level: 'info' | 'error' = 'info'): void {
    const task = tasks.get(taskId)
    if (!task) return
    const entry: DevScopeTaskLogEntry = {
        at: Date.now(),
        level,
        message: String(message || '')
    }
    task.logs.push(entry)
    if (task.logs.length > MAX_LOG_LINES) {
        task.logs.splice(0, task.logs.length - MAX_LOG_LINES)
    }
    task.updatedAt = Date.now()
    emitTaskEvent({ type: 'upsert', task: normalizeTask(task) })
}

export function completeTask(taskId: string, status: Extract<DevScopeTaskStatus, 'success' | 'failed'>, message?: string): void {
    const task = tasks.get(taskId)
    if (!task) return
    if (message) {
        appendTaskLog(taskId, message, status === 'failed' ? 'error' : 'info')
    }
    const now = Date.now()
    task.status = status
    task.updatedAt = now
    task.endedAt = now
    emitTaskEvent({ type: 'upsert', task: normalizeTask(task) })

    // Keep completed tasks briefly for observability, then remove.
    setTimeout(() => {
        const current = tasks.get(taskId)
        if (!current) return
        if (current.status === 'running') return
        tasks.delete(taskId)
        emitTaskEvent({ type: 'remove', taskId })
    }, 45_000)
}

export function listActiveTasks(projectPath?: string): DevScopeTask[] {
    const normalizedProjectPath = String(projectPath || '').trim()
    return [...tasks.values()]
        .filter((task) => {
            if (task.status !== 'running') return false
            if (!normalizedProjectPath) return true
            return String(task.projectPath || '').trim().toLowerCase() === normalizedProjectPath.toLowerCase()
        })
        .sort((a, b) => b.startedAt - a.startedAt)
        .map(normalizeTask)
}
