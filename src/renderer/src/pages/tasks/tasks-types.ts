import type { DevScopePreviewTerminalSessionSummary } from '@shared/contracts/devscope-api'

export type TaskLogEntry = {
    at: number
    level: 'info' | 'error'
    message: string
}

export type ActiveTask = {
    id: string
    type: string
    title: string
    status: 'running' | 'success' | 'failed'
    projectPath?: string
    startedAt: number
    updatedAt: number
    logs?: TaskLogEntry[]
}

export type RunningApp = {
    name: string
    category: 'app' | 'background'
    processCount: number
    cpu: number
    memoryMb: number
}

export type MemoryUnit = 'mb' | 'gb'
export type RunningAppsSort = 'name' | 'processCount' | 'cpu' | 'memoryMb' | 'avgUsage'

export type RunningAppWithUsage = RunningApp & {
    avgUsage: number
    cpuUsageScore: number
    memoryUsageScore: number
}

export type DeviceStats = {
    cpuModel: string
    cpuCores: number
    cpuThreads: number
    cpuUsagePercent: number | null
    memoryTotalGb: number
    memoryUsedGb: number
}

export type PreviewTerminalSessionGroup = {
    groupKey: string
    cwd: string
    sessions: DevScopePreviewTerminalSessionSummary[]
    lastActivityAt: number
    latestStartedAt: number
}

export type RunningAppsPreferences = {
    appScope: 'all' | 'app' | 'background'
    appsFilter: 'all' | 'highCpu' | 'highMemory' | 'multiInstance' | 'activeOnly'
    sortBy: RunningAppsSort
    sortDirection: 'asc' | 'desc'
    memoryUnit: MemoryUnit
}

export const APPS_PAGE_SIZE = 10
export const RUNNING_APPS_FETCH_LIMIT = 2000
export const RUNNING_APPS_PREFS_KEY = 'devscope.tasks.runningApps.prefs.v1'
export const TASKS_TERMINAL_PANEL_ANIMATION_MS = 220
