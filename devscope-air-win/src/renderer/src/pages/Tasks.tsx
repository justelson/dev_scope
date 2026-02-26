import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Activity, ChevronLeft, ChevronRight, Clock3, Cpu, Gauge, HardDrive, RefreshCw } from 'lucide-react'
import { useSettings } from '@/lib/settings'
import { cn } from '@/lib/utils'

type TaskLogEntry = {
    at: number
    level: 'info' | 'error'
    message: string
}

type ActiveTask = {
    id: string
    type: string
    title: string
    status: 'running' | 'success' | 'failed'
    projectPath?: string
    startedAt: number
    updatedAt: number
    logs?: TaskLogEntry[]
}

type RunningApp = {
    name: string
    category: 'app' | 'background'
    processCount: number
    cpu: number
    memoryMb: number
}

type MemoryUnit = 'mb' | 'gb'
type RunningAppsSort = 'name' | 'processCount' | 'cpu' | 'memoryMb' | 'avgUsage'
type RunningAppWithUsage = RunningApp & {
    avgUsage: number
    cpuUsageScore: number
    memoryUsageScore: number
}

type DeviceStats = {
    cpuModel: string
    cpuCores: number
    cpuThreads: number
    cpuUsagePercent: number | null
    memoryTotalGb: number
    memoryUsedGb: number
}

const APPS_PAGE_SIZE = 10
const RUNNING_APPS_FETCH_LIMIT = 2000
const RUNNING_APPS_PREFS_KEY = 'devscope.tasks.runningApps.prefs.v1'

type RunningAppsPreferences = {
    appScope: 'all' | 'app' | 'background'
    appsFilter: 'all' | 'highCpu' | 'highMemory' | 'multiInstance' | 'activeOnly'
    sortBy: RunningAppsSort
    sortDirection: 'asc' | 'desc'
    memoryUnit: MemoryUnit
}

function formatRelativeShort(timestamp: number): string {
    const deltaMs = Math.max(0, Date.now() - timestamp)
    const seconds = Math.floor(deltaMs / 1000)
    if (seconds < 60) return `${seconds}s ago`
    const minutes = Math.floor(seconds / 60)
    if (minutes < 60) return `${minutes}m ago`
    const hours = Math.floor(minutes / 60)
    return `${hours}h ago`
}

function formatMemoryLabel(memoryMb: number, unit: MemoryUnit): string {
    if (unit === 'gb') return `${(memoryMb / 1024).toFixed(2)} GB`
    return `${memoryMb.toFixed(1)} MB`
}

function formatDeviceMemoryLabel(memoryGb: number, unit: MemoryUnit): string {
    if (unit === 'gb') return `${memoryGb.toFixed(1)} GB`
    return `${(memoryGb * 1024).toFixed(0)} MB`
}

function readRunningAppsPreferences(): Partial<RunningAppsPreferences> {
    try {
        const raw = window.localStorage.getItem(RUNNING_APPS_PREFS_KEY)
        if (!raw) return {}
        const parsed = JSON.parse(raw) as Partial<RunningAppsPreferences>
        return parsed && typeof parsed === 'object' ? parsed : {}
    } catch {
        return {}
    }
}

export default function Tasks() {
    const { settings } = useSettings()
    const savedPrefsRef = useRef<Partial<RunningAppsPreferences> | null>(null)
    if (savedPrefsRef.current === null) {
        savedPrefsRef.current = readRunningAppsPreferences()
    }
    const savedPrefs = savedPrefsRef.current
    const [activeView, setActiveView] = useState<'operations' | 'runningApps'>('operations')
    const [activeTasks, setActiveTasks] = useState<ActiveTask[]>([])
    const [activePorts, setActivePorts] = useState<number[]>([])
    const [runningApps, setRunningApps] = useState<RunningApp[]>([])
    const [deviceStats, setDeviceStats] = useState<DeviceStats | null>(null)
    const [appScope, setAppScope] = useState<'all' | 'app' | 'background'>(
        savedPrefs.appScope === 'app' || savedPrefs.appScope === 'background' ? savedPrefs.appScope : 'all'
    )
    const [appsFilter, setAppsFilter] = useState<'all' | 'highCpu' | 'highMemory' | 'multiInstance' | 'activeOnly'>(
        savedPrefs.appsFilter === 'highCpu'
        || savedPrefs.appsFilter === 'highMemory'
        || savedPrefs.appsFilter === 'multiInstance'
        || savedPrefs.appsFilter === 'activeOnly'
            ? savedPrefs.appsFilter
            : 'all'
    )
    const [memoryUnit, setMemoryUnit] = useState<MemoryUnit>(savedPrefs.memoryUnit === 'gb' ? 'gb' : 'mb')
    const [sortBy, setSortBy] = useState<RunningAppsSort>(
        savedPrefs.sortBy === 'name'
        || savedPrefs.sortBy === 'processCount'
        || savedPrefs.sortBy === 'cpu'
        || savedPrefs.sortBy === 'memoryMb'
        || savedPrefs.sortBy === 'avgUsage'
            ? savedPrefs.sortBy
            : 'avgUsage'
    )
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>(
        savedPrefs.sortDirection === 'asc' ? 'asc' : 'desc'
    )
    const [appsPage, setAppsPage] = useState(1)
    const [initialLoading, setInitialLoading] = useState(true)
    const [refreshing, setRefreshing] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [lastRefreshAt, setLastRefreshAt] = useState<number | null>(null)
    const hasLoadedOnceRef = useRef(false)
    const refreshSequenceRef = useRef(0)
    const runningAppsEnabled = settings.tasksRunningAppsEnabled !== false

    const runningAppTotals = useMemo(() => {
        const totalProcesses = runningApps.reduce((sum, app) => sum + app.processCount, 0)
        const totalCpu = runningApps.reduce((sum, app) => sum + app.cpu, 0)
        const totalMemoryMb = runningApps.reduce((sum, app) => sum + app.memoryMb, 0)
        const appCount = runningApps.filter((app) => app.category === 'app').length
        const backgroundCount = Math.max(0, runningApps.length - appCount)
        const maxCpu = Math.max(1, ...runningApps.map((app) => app.cpu))
        const maxMemoryMb = Math.max(1, ...runningApps.map((app) => app.memoryMb))
        return {
            appCount,
            backgroundCount,
            totalProcesses,
            totalCpu,
            totalMemoryMb,
            maxCpu,
            maxMemoryMb
        }
    }, [runningApps])

    const runningAppsWithUsage = useMemo<RunningAppWithUsage[]>(() => {
        const maxCpu = Math.max(1, runningAppTotals.maxCpu)
        const maxMemoryMb = Math.max(1, runningAppTotals.maxMemoryMb)
        return runningApps.map((app) => {
            const cpuUsageScore = Math.max(0, Math.min(100, (app.cpu / maxCpu) * 100))
            const memoryUsageScore = Math.max(0, Math.min(100, (app.memoryMb / maxMemoryMb) * 100))
            const avgUsage = (cpuUsageScore + memoryUsageScore) / 2
            return {
                ...app,
                avgUsage,
                cpuUsageScore,
                memoryUsageScore
            }
        })
    }, [runningApps, runningAppTotals.maxCpu, runningAppTotals.maxMemoryMb])

    const filteredRunningApps = useMemo(() => (
        runningAppsWithUsage.filter((app) => {
            if (appScope === 'app' && app.category !== 'app') return false
            if (appScope === 'background' && app.category !== 'background') return false
            if (appsFilter === 'highCpu') return app.cpu >= 1
            if (appsFilter === 'highMemory') return app.memoryMb >= 200
            if (appsFilter === 'multiInstance') return app.processCount >= 2
            if (appsFilter === 'activeOnly') return app.cpu > 0 || app.memoryMb > 0
            return true
        })
    ), [runningAppsWithUsage, appsFilter, appScope])
    const sortedRunningApps = useMemo(() => {
        const directionMultiplier = sortDirection === 'asc' ? 1 : -1
        const sortWithinScope = (apps: RunningAppWithUsage[]) => [...apps].sort((a, b) => {
            let comparison = 0
            if (sortBy === 'name') comparison = a.name.localeCompare(b.name)
            else if (sortBy === 'processCount') comparison = a.processCount - b.processCount
            else if (sortBy === 'cpu') comparison = a.cpu - b.cpu
            else if (sortBy === 'memoryMb') comparison = a.memoryMb - b.memoryMb
            else comparison = a.avgUsage - b.avgUsage

            const primarySort = comparison * directionMultiplier
            if (primarySort !== 0) return primarySort
            if (b.avgUsage !== a.avgUsage) return b.avgUsage - a.avgUsage
            return a.name.localeCompare(b.name)
        })

        if (appScope !== 'all') return sortWithinScope(filteredRunningApps)

        const appRows = sortWithinScope(filteredRunningApps.filter((app) => app.category === 'app'))
        const backgroundRows = sortWithinScope(filteredRunningApps.filter((app) => app.category === 'background'))
        return [...appRows, ...backgroundRows]
    }, [filteredRunningApps, sortBy, sortDirection, appScope])
    const totalAppsPages = useMemo(() => Math.max(1, Math.ceil(sortedRunningApps.length / APPS_PAGE_SIZE)), [sortedRunningApps.length])
    const normalizedAppsPage = Math.min(appsPage, totalAppsPages)
    const pagedRunningApps = useMemo(() => {
        const start = (normalizedAppsPage - 1) * APPS_PAGE_SIZE
        return sortedRunningApps.slice(start, start + APPS_PAGE_SIZE)
    }, [sortedRunningApps, normalizedAppsPage])
    const pagedAppsSection = useMemo(() => (
        appScope === 'all'
            ? pagedRunningApps.filter((app) => app.category === 'app')
            : pagedRunningApps
    ), [pagedRunningApps, appScope])
    const pagedBackgroundSection = useMemo(() => (
        appScope === 'all'
            ? pagedRunningApps.filter((app) => app.category === 'background')
            : []
    ), [pagedRunningApps, appScope])

    const deviceMemoryPercent = useMemo(() => {
        if (!deviceStats || deviceStats.memoryTotalGb <= 0) return 0
        return Math.max(0, Math.min(100, (deviceStats.memoryUsedGb / deviceStats.memoryTotalGb) * 100))
    }, [deviceStats])
    useEffect(() => {
        if (appsPage > totalAppsPages) {
            setAppsPage(totalAppsPages)
        }
    }, [appsPage, totalAppsPages])
    useEffect(() => {
        setAppsPage(1)
    }, [appsFilter, appScope, sortBy, sortDirection])
    useEffect(() => {
        const prefs: RunningAppsPreferences = {
            appScope,
            appsFilter,
            sortBy,
            sortDirection,
            memoryUnit
        }
        try {
            window.localStorage.setItem(RUNNING_APPS_PREFS_KEY, JSON.stringify(prefs))
        } catch {
            // Ignore persistence failures in restricted environments.
        }
    }, [appScope, appsFilter, sortBy, sortDirection, memoryUnit])
    useEffect(() => {
        if (runningAppsEnabled) return
        if (activeView === 'runningApps') {
            setActiveView('operations')
        }
        setRunningApps((current) => (current.length > 0 ? [] : current))
        setDeviceStats((current) => (current ? null : current))
    }, [runningAppsEnabled, activeView])

    const refresh = useCallback(async (options?: { quiet?: boolean }) => {
        const quiet = Boolean(options?.quiet)
        const requestSequence = ++refreshSequenceRef.current
        const shouldFetchRunningAppsData = runningAppsEnabled && activeView === 'runningApps'
        if (!quiet && hasLoadedOnceRef.current) {
            setRefreshing(true)
        }

        try {
            const [tasksResult, portsResult, appsResult, systemOverviewResult, systemDetailedResult] = await Promise.allSettled([
                window.devscope.listActiveTasks(),
                window.devscope.getActivePorts(),
                shouldFetchRunningAppsData
                    ? window.devscope.getRunningApps(RUNNING_APPS_FETCH_LIMIT)
                    : Promise.resolve(null),
                shouldFetchRunningAppsData
                    ? window.devscope.getSystemOverview()
                    : Promise.resolve(null),
                shouldFetchRunningAppsData
                    ? window.devscope.getDetailedSystemStats()
                    : Promise.resolve(null)
            ])

            if (requestSequence !== refreshSequenceRef.current) {
                return
            }

            const nextErrors: string[] = []
            let nextTasks: ActiveTask[] | null = null
            let nextPorts: number[] | null = null
            let nextApps: RunningApp[] | null = null
            let nextDeviceStats: DeviceStats | null = null

            if (tasksResult.status === 'fulfilled') {
                if (tasksResult.value.success) {
                    nextTasks = (tasksResult.value.tasks || []) as ActiveTask[]
                } else {
                    nextErrors.push(tasksResult.value.error || 'Failed to load active tasks')
                }
            } else {
                nextErrors.push(tasksResult.reason?.message || 'Failed to load active tasks')
            }

            if (portsResult.status === 'fulfilled') {
                if (portsResult.value.success) {
                    nextPorts = [...new Set(portsResult.value.ports || [])].sort((a, b) => a - b)
                } else {
                    nextErrors.push(portsResult.value.error || 'Failed to load active ports')
                }
            } else {
                nextErrors.push(portsResult.reason?.message || 'Failed to load active ports')
            }

            if (shouldFetchRunningAppsData) {
                if (appsResult.status === 'fulfilled') {
                    const appsPayload = appsResult.value as any
                    if (appsPayload?.success) {
                        nextApps = (appsPayload.apps || []) as RunningApp[]
                    } else {
                        nextErrors.push(appsPayload?.error || 'Failed to load running apps')
                    }
                } else {
                    nextErrors.push(appsResult.reason?.message || 'Failed to load running apps')
                }
            }

            if (shouldFetchRunningAppsData) {
                const overview = systemOverviewResult.status === 'fulfilled' ? systemOverviewResult.value as any : null
                const detailed = systemDetailedResult.status === 'fulfilled' ? systemDetailedResult.value as any : null
                if (overview && typeof overview === 'object') {
                    const overviewTotalBytes = Number(overview.memory?.total) || 0
                    const overviewUsedBytes = Number(overview.memory?.used) || 0
                    const detailedTotalBytes = Number(detailed?.memory?.total) || 0
                    const detailedUsedBytes = Number(detailed?.memory?.used) || 0
                    const cpuUsageCandidates = [
                        Number(detailed?.cpu?.load),
                        Number(overview.cpu?.usage)
                    ]
                    const cpuUsage = cpuUsageCandidates.find((value) => Number.isFinite(value))
                    nextDeviceStats = {
                        cpuModel: String(detailed?.cpu?.model || overview.cpu?.model || 'Unknown CPU'),
                        cpuCores: Number(detailed?.cpu?.cores) || Number(overview.cpu?.cores) || 0,
                        cpuThreads: Number(overview.cpu?.threads) || Number(detailed?.cpu?.physicalCores) || Number(detailed?.cpu?.cores) || 0,
                        cpuUsagePercent: Number.isFinite(cpuUsage as number) ? Number(cpuUsage) : null,
                        memoryTotalGb: (detailedTotalBytes > 0 ? detailedTotalBytes : overviewTotalBytes) / (1024 ** 3),
                        memoryUsedGb: (detailedUsedBytes > 0 ? detailedUsedBytes : overviewUsedBytes) / (1024 ** 3)
                    }
                }
            }

            if (nextTasks !== null) setActiveTasks(nextTasks)
            if (nextPorts !== null) setActivePorts(nextPorts)
            if (nextApps !== null) setRunningApps(nextApps)
            if (nextDeviceStats !== null) setDeviceStats(nextDeviceStats)

            setError(nextErrors.length > 0 ? nextErrors.join(' | ') : null)
            setLastRefreshAt(Date.now())
            hasLoadedOnceRef.current = true
            setInitialLoading(false)
        } catch (err: any) {
            if (requestSequence !== refreshSequenceRef.current) return
            setError(err?.message || 'Failed to refresh task manager data')
            hasLoadedOnceRef.current = true
            setInitialLoading(false)
        } finally {
            if (requestSequence === refreshSequenceRef.current) {
                setRefreshing(false)
            }
        }
    }, [activeView, runningAppsEnabled])

    useEffect(() => {
        void refresh()
    }, [refresh])

    useEffect(() => {
        const timer = window.setInterval(() => {
            void refresh({ quiet: true })
        }, 5000)
        return () => {
            window.clearInterval(timer)
        }
    }, [refresh])

    useEffect(() => {
        const unsubscribe = window.devscope.onTaskEvent?.((event) => {
            if (event.type === 'remove' && event.taskId) {
                setActiveTasks((current) => current.filter((task) => task.id !== event.taskId))
                return
            }

            if (event.type !== 'upsert' || !event.task) return
            setActiveTasks((current) => {
                const incoming = event.task as ActiveTask
                if (incoming.status !== 'running') {
                    return current.filter((task) => task.id !== incoming.id)
                }

                const next = [...current]
                const index = next.findIndex((task) => task.id === incoming.id)
                if (index >= 0) {
                    next[index] = incoming
                } else {
                    next.unshift(incoming)
                }
                return next.sort((a, b) => b.startedAt - a.startedAt)
            })
        })

        return () => {
            unsubscribe?.()
        }
    }, [])

    return (
        <div className="max-w-[1400px] mx-auto pb-14 animate-fadeIn">
            <div className="flex items-start justify-between gap-4 mb-6">
                <div>
                    <h1 className="text-3xl font-bold text-sparkle-text mb-2">Task Manager</h1>
                    <p className="text-sparkle-text-secondary">
                        {runningAppsEnabled
                            ? 'Live view of active tasks, ports, and running apps.'
                            : 'Live view of active tasks and ports.'}
                    </p>
                </div>
                <div className="flex items-center gap-3 text-xs text-sparkle-text-secondary">
                    <span>Last refresh: {lastRefreshAt ? new Date(lastRefreshAt).toLocaleTimeString() : 'pending'}</span>
                    <button
                        onClick={() => { void refresh() }}
                        disabled={refreshing}
                        className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-sparkle-border bg-sparkle-card hover:bg-sparkle-border-secondary transition-colors disabled:opacity-50"
                    >
                        <RefreshCw size={14} className={cn((refreshing || initialLoading) && 'animate-spin')} />
                        <span>{hasLoadedOnceRef.current ? 'Refresh' : 'Loading'}</span>
                    </button>
                </div>
            </div>

            {error && (
                <div className="mb-5 px-4 py-3 rounded-lg border border-amber-500/25 bg-amber-500/10 text-amber-300 text-sm">
                    {error}
                </div>
            )}

            <div className="mb-5 inline-flex items-center rounded-xl border border-sparkle-border bg-sparkle-card p-1">
                <button
                    type="button"
                    onClick={() => setActiveView('operations')}
                    className={cn(
                        'rounded-lg px-3 py-1.5 text-xs transition-colors',
                        activeView === 'operations'
                            ? 'bg-[var(--accent-primary)] text-white'
                            : 'text-sparkle-text-secondary hover:bg-sparkle-bg hover:text-sparkle-text'
                    )}
                >
                    Operations
                </button>
                {runningAppsEnabled && (
                    <button
                        type="button"
                        onClick={() => setActiveView('runningApps')}
                        className={cn(
                            'rounded-lg px-3 py-1.5 text-xs transition-colors',
                            activeView === 'runningApps'
                                ? 'bg-[var(--accent-primary)] text-white'
                                : 'text-sparkle-text-secondary hover:bg-sparkle-bg hover:text-sparkle-text'
                        )}
                    >
                        Running Apps
                    </button>
                )}
            </div>

            {activeView === 'operations' ? (
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                    <div className="rounded-xl border border-sparkle-border bg-sparkle-card p-5">
                        <div className="mb-3 flex items-center gap-2">
                            <Activity size={16} className="text-[var(--accent-primary)]" />
                            <h2 className="text-sm font-semibold text-sparkle-text">Active Git Operations ({activeTasks.length})</h2>
                        </div>
                        {initialLoading && activeTasks.length === 0 ? (
                            <p className="text-sm text-sparkle-text-secondary">Loading active tasks...</p>
                        ) : activeTasks.length === 0 ? (
                            <p className="text-sm text-sparkle-text-secondary">No active Git operations.</p>
                        ) : (
                            <div className="space-y-2">
                                {activeTasks.map((task) => (
                                    <div key={task.id} className="rounded-lg border border-sparkle-border bg-sparkle-bg px-3 py-2 flex items-center justify-between gap-3">
                                        <div className="min-w-0">
                                            <p className="text-sm text-sparkle-text truncate">{task.title}</p>
                                            <p className="text-xs text-sparkle-text-secondary truncate">{task.projectPath || 'Project scope not set'}</p>
                                        </div>
                                        <span className="inline-flex items-center gap-1 text-xs text-sparkle-text-secondary shrink-0">
                                            <Clock3 size={12} />
                                            {formatRelativeShort(task.startedAt)}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="rounded-xl border border-sparkle-border bg-sparkle-card p-5">
                        <h2 className="mb-3 text-sm font-semibold text-sparkle-text">Active Ports ({activePorts.length})</h2>
                        {initialLoading && activePorts.length === 0 ? (
                            <p className="text-sm text-sparkle-text-secondary">Loading active ports...</p>
                        ) : activePorts.length === 0 ? (
                            <p className="text-sm text-sparkle-text-secondary">No active ports right now.</p>
                        ) : (
                            <div className="flex flex-wrap gap-2">
                                {activePorts.map((port) => (
                                    <span
                                        key={port}
                                        className="rounded-md border border-sky-400/35 bg-sky-500/10 px-2.5 py-1 text-xs font-mono text-sky-300"
                                    >
                                        :{port}
                                    </span>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            ) : (
                <div className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                        <div className="rounded-xl border border-sparkle-border bg-sparkle-card p-4">
                            <div className="flex items-center gap-2 text-sparkle-text-secondary text-xs uppercase tracking-wider">
                                <Activity size={14} />
                                App Groups
                            </div>
                            <div className="mt-2 text-2xl font-semibold text-sparkle-text">{runningApps.length}</div>
                            <div className="mt-1 text-[11px] text-sparkle-text-secondary">
                                {runningAppTotals.appCount} apps - {runningAppTotals.backgroundCount} background
                            </div>
                        </div>
                        <div className="rounded-xl border border-sparkle-border bg-sparkle-card p-4">
                            <div className="flex items-center gap-2 text-sparkle-text-secondary text-xs uppercase tracking-wider">
                                <Gauge size={14} />
                                Total Processes
                            </div>
                            <div className="mt-2 text-2xl font-semibold text-sparkle-text">{runningAppTotals.totalProcesses}</div>
                        </div>
                        <div className="rounded-xl border border-sparkle-border bg-sparkle-card p-4">
                            <div className="flex items-center gap-2 text-sparkle-text-secondary text-xs uppercase tracking-wider">
                                <Cpu size={14} />
                                Device CPU
                            </div>
                            <div className="mt-2 text-2xl font-semibold text-amber-300">
                                {deviceStats && deviceStats.cpuUsagePercent !== null ? `${deviceStats.cpuUsagePercent.toFixed(1)}%` : '--'}
                            </div>
                            <div className="mt-1 text-[11px] text-sparkle-text-secondary truncate">
                                {deviceStats ? `${deviceStats.cpuCores} cores / ${deviceStats.cpuThreads} threads` : 'Waiting for CPU stats'}
                            </div>
                            <div className="mt-1 text-[11px] text-sparkle-text-secondary truncate">
                                {deviceStats ? deviceStats.cpuModel : ''}
                            </div>
                        </div>
                        <div className="rounded-xl border border-sparkle-border bg-sparkle-card p-4">
                            <div className="flex items-center gap-2 text-sparkle-text-secondary text-xs uppercase tracking-wider">
                                <HardDrive size={14} />
                                Device RAM ({memoryUnit.toUpperCase()})
                            </div>
                            <div className="mt-2 text-2xl font-semibold text-emerald-300">
                                {deviceStats ? `${formatDeviceMemoryLabel(deviceStats.memoryUsedGb, memoryUnit)} / ${formatDeviceMemoryLabel(deviceStats.memoryTotalGb, memoryUnit)}` : '--'}
                            </div>
                            <div className="mt-2 h-2.5 w-full rounded-full bg-sparkle-bg overflow-hidden">
                                <div
                                    className="h-full rounded-full bg-gradient-to-r from-emerald-500/90 via-teal-400/90 to-sky-500/90"
                                    style={{ width: `${deviceMemoryPercent}%` }}
                                />
                            </div>
                        </div>
                    </div>

                    <div className="rounded-xl border border-sparkle-border bg-sparkle-card overflow-hidden">
                        <div className="px-4 py-3 border-b border-sparkle-border bg-sparkle-bg/70">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                                <div>
                                    <h2 className="text-sm font-semibold text-sparkle-text">Running Apps Resource Table</h2>
                                    <p className="text-xs text-sparkle-text-secondary mt-0.5">
                                        Live CPU and memory usage with per-app resource bars.
                                    </p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <label className="text-[11px] text-sparkle-text-secondary uppercase tracking-wider">Scope</label>
                                    <select
                                        value={appScope}
                                        onChange={(event) => setAppScope(event.target.value as typeof appScope)}
                                        className="rounded-md border border-sparkle-border bg-sparkle-card px-2 py-1 text-xs text-sparkle-text focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)]/60"
                                    >
                                        <option value="all">Apps First</option>
                                        <option value="app">Apps Only</option>
                                        <option value="background">Background Only</option>
                                    </select>
                                    <label className="text-[11px] text-sparkle-text-secondary uppercase tracking-wider">Filter</label>
                                    <select
                                        value={appsFilter}
                                        onChange={(event) => setAppsFilter(event.target.value as typeof appsFilter)}
                                        className="rounded-md border border-sparkle-border bg-sparkle-card px-2 py-1 text-xs text-sparkle-text focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)]/60"
                                    >
                                        <option value="all">All</option>
                                        <option value="highCpu">High CPU</option>
                                        <option value="highMemory">High Memory</option>
                                        <option value="multiInstance">Multi Instance</option>
                                        <option value="activeOnly">Active Only</option>
                                    </select>
                                    <label className="text-[11px] text-sparkle-text-secondary uppercase tracking-wider">RAM Unit</label>
                                    <select
                                        value={memoryUnit}
                                        onChange={(event) => setMemoryUnit(event.target.value as MemoryUnit)}
                                        className="rounded-md border border-sparkle-border bg-sparkle-card px-2 py-1 text-xs text-sparkle-text focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)]/60"
                                    >
                                        <option value="mb">MB</option>
                                        <option value="gb">GB</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full min-w-[980px] table-fixed text-sm">
                                <colgroup>
                                    <col className="w-[28%]" />
                                    <col className="w-[90px]" />
                                    <col className="w-[110px]" />
                                    <col className="w-[22%]" />
                                    <col className="w-[20%]" />
                                    <col className="w-[20%]" />
                                </colgroup>
                                <thead className="text-xs text-sparkle-text-secondary uppercase tracking-wider bg-sparkle-bg/60">
                                    <tr>
                                        <th className="text-left font-medium px-4 py-3">
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    if (sortBy === 'name') setSortDirection((prev) => prev === 'asc' ? 'desc' : 'asc')
                                                    else { setSortBy('name'); setSortDirection('asc') }
                                                }}
                                                className="inline-flex items-center gap-1 hover:text-sparkle-text transition-colors"
                                            >
                                                Application
                                            </button>
                                        </th>
                                        <th className="text-right font-medium px-4 py-3">
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    if (sortBy === 'processCount') setSortDirection((prev) => prev === 'asc' ? 'desc' : 'asc')
                                                    else { setSortBy('processCount'); setSortDirection('desc') }
                                                }}
                                                className="inline-flex items-center gap-1 hover:text-sparkle-text transition-colors"
                                            >
                                                Instances
                                            </button>
                                        </th>
                                        <th className="text-left font-medium px-4 py-3">
                                            Type
                                        </th>
                                        <th className="text-left font-medium px-4 py-3">
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    if (sortBy === 'avgUsage') setSortDirection((prev) => prev === 'asc' ? 'desc' : 'asc')
                                                    else { setSortBy('avgUsage'); setSortDirection('desc') }
                                                }}
                                                className="inline-flex items-center gap-1 hover:text-sparkle-text transition-colors"
                                            >
                                                Avg Usage
                                            </button>
                                        </th>
                                        <th className="text-left font-medium px-4 py-3">
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    if (sortBy === 'cpu') setSortDirection((prev) => prev === 'asc' ? 'desc' : 'asc')
                                                    else { setSortBy('cpu'); setSortDirection('desc') }
                                                }}
                                                className="inline-flex items-center gap-1 hover:text-sparkle-text transition-colors"
                                            >
                                                CPU
                                            </button>
                                        </th>
                                        <th className="text-left font-medium px-4 py-3">
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    if (sortBy === 'memoryMb') setSortDirection((prev) => prev === 'asc' ? 'desc' : 'asc')
                                                    else { setSortBy('memoryMb'); setSortDirection('desc') }
                                                }}
                                                className="inline-flex items-center gap-1 hover:text-sparkle-text transition-colors"
                                            >
                                                Memory ({memoryUnit.toUpperCase()})
                                            </button>
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {initialLoading && sortedRunningApps.length === 0 ? (
                                        <tr>
                                            <td className="px-4 py-4 text-sparkle-text-secondary" colSpan={6}>Loading running apps...</td>
                                        </tr>
                                    ) : sortedRunningApps.length === 0 ? (
                                        <tr>
                                            <td className="px-4 py-4 text-sparkle-text-secondary" colSpan={6}>No running apps found.</td>
                                        </tr>
                                    ) : (
                                        <>
                                            {appScope === 'all' && pagedAppsSection.length > 0 && (
                                                <tr className="border-t border-sparkle-border bg-cyan-500/6">
                                                    <td className="px-4 py-2 text-[11px] uppercase tracking-wider text-cyan-300 font-medium" colSpan={6}>
                                                        Applications
                                                    </td>
                                                </tr>
                                            )}
                                            {pagedAppsSection.map((app) => {
                                                const cpuRatio = app.cpuUsageScore
                                                const memoryRatio = app.memoryUsageScore
                                                return (
                                                    <tr key={`${app.category}:${app.name}`} className="border-t border-sparkle-border hover:bg-sparkle-bg/60 transition-colors">
                                                        <td className="px-4 py-3 text-sparkle-text font-medium">
                                                            <span className="block truncate">{app.name}</span>
                                                        </td>
                                                        <td className="px-4 py-3 text-right text-sparkle-text-secondary font-mono tabular-nums">{app.processCount}</td>
                                                        <td className="px-4 py-3">
                                                            <span
                                                                className={cn(
                                                                    'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wide border',
                                                                    app.category === 'app'
                                                                        ? 'border-cyan-400/35 bg-cyan-500/10 text-cyan-300'
                                                                        : 'border-white/20 bg-white/5 text-sparkle-text-secondary'
                                                                )}
                                                            >
                                                                {app.category === 'app' ? 'App' : 'Background'}
                                                            </span>
                                                        </td>
                                                        <td className="px-4 py-3">
                                                            <div className="flex min-w-0 items-center gap-3">
                                                                <span className="w-16 text-right text-cyan-300 text-xs font-mono tabular-nums">{app.avgUsage.toFixed(1)}%</span>
                                                                <div className="h-2.5 min-w-0 flex-1 rounded-full bg-sparkle-bg overflow-hidden">
                                                                    <div
                                                                        className="h-full rounded-full bg-gradient-to-r from-cyan-500/90 via-sky-400/90 to-blue-500/90"
                                                                        style={{ width: `${app.avgUsage}%` }}
                                                                    />
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className="px-4 py-3">
                                                            <div className="flex min-w-0 items-center gap-3">
                                                                <span className="w-16 text-right text-amber-300 text-xs font-mono tabular-nums">{app.cpu.toFixed(1)}%</span>
                                                                <div className="h-2.5 min-w-0 flex-1 rounded-full bg-sparkle-bg overflow-hidden">
                                                                    <div
                                                                        className="h-full rounded-full bg-gradient-to-r from-amber-500/90 via-orange-400/90 to-red-500/90"
                                                                        style={{ width: `${cpuRatio}%` }}
                                                                    />
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className="px-4 py-3">
                                                            <div className="flex min-w-0 items-center gap-3">
                                                                <span className="w-24 text-right text-emerald-300 text-xs font-mono tabular-nums">{formatMemoryLabel(app.memoryMb, memoryUnit)}</span>
                                                                <div className="h-2.5 min-w-0 flex-1 rounded-full bg-sparkle-bg overflow-hidden">
                                                                    <div
                                                                        className="h-full rounded-full bg-gradient-to-r from-emerald-500/90 via-teal-400/90 to-sky-500/90"
                                                                        style={{ width: `${memoryRatio}%` }}
                                                                    />
                                                                </div>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                )
                                            })}

                                            {appScope === 'all' && pagedBackgroundSection.length > 0 && (
                                                <tr className="border-t border-sparkle-border bg-white/[0.03]">
                                                    <td className="px-4 py-2 text-[11px] uppercase tracking-wider text-sparkle-text-secondary font-medium" colSpan={6}>
                                                        Background Processes
                                                    </td>
                                                </tr>
                                            )}
                                            {pagedBackgroundSection.map((app) => {
                                                const cpuRatio = app.cpuUsageScore
                                                const memoryRatio = app.memoryUsageScore
                                                return (
                                                    <tr key={`${app.category}:${app.name}`} className="border-t border-sparkle-border hover:bg-sparkle-bg/60 transition-colors">
                                                        <td className="px-4 py-3 text-sparkle-text font-medium">
                                                            <span className="block truncate">{app.name}</span>
                                                        </td>
                                                        <td className="px-4 py-3 text-right text-sparkle-text-secondary font-mono tabular-nums">{app.processCount}</td>
                                                        <td className="px-4 py-3">
                                                            <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wide border border-white/20 bg-white/5 text-sparkle-text-secondary">
                                                                Background
                                                            </span>
                                                        </td>
                                                        <td className="px-4 py-3">
                                                            <div className="flex min-w-0 items-center gap-3">
                                                                <span className="w-16 text-right text-cyan-300 text-xs font-mono tabular-nums">{app.avgUsage.toFixed(1)}%</span>
                                                                <div className="h-2.5 min-w-0 flex-1 rounded-full bg-sparkle-bg overflow-hidden">
                                                                    <div
                                                                        className="h-full rounded-full bg-gradient-to-r from-cyan-500/90 via-sky-400/90 to-blue-500/90"
                                                                        style={{ width: `${app.avgUsage}%` }}
                                                                    />
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className="px-4 py-3">
                                                            <div className="flex min-w-0 items-center gap-3">
                                                                <span className="w-16 text-right text-amber-300 text-xs font-mono tabular-nums">{app.cpu.toFixed(1)}%</span>
                                                                <div className="h-2.5 min-w-0 flex-1 rounded-full bg-sparkle-bg overflow-hidden">
                                                                    <div
                                                                        className="h-full rounded-full bg-gradient-to-r from-amber-500/90 via-orange-400/90 to-red-500/90"
                                                                        style={{ width: `${cpuRatio}%` }}
                                                                    />
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className="px-4 py-3">
                                                            <div className="flex min-w-0 items-center gap-3">
                                                                <span className="w-24 text-right text-emerald-300 text-xs font-mono tabular-nums">{formatMemoryLabel(app.memoryMb, memoryUnit)}</span>
                                                                <div className="h-2.5 min-w-0 flex-1 rounded-full bg-sparkle-bg overflow-hidden">
                                                                    <div
                                                                        className="h-full rounded-full bg-gradient-to-r from-emerald-500/90 via-teal-400/90 to-sky-500/90"
                                                                        style={{ width: `${memoryRatio}%` }}
                                                                    />
                                                                </div>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                )
                                            })}
                                        </>
                                    )}
                                </tbody>
                            </table>
                        </div>
                        {sortedRunningApps.length > 0 && (
                            <div className="flex items-center justify-between px-4 py-3 border-t border-sparkle-border bg-sparkle-bg/50">
                                <p className="text-xs text-sparkle-text-secondary">
                                    Showing {(normalizedAppsPage - 1) * APPS_PAGE_SIZE + 1}
                                    -
                                    {Math.min(normalizedAppsPage * APPS_PAGE_SIZE, sortedRunningApps.length)} of {sortedRunningApps.length}
                                </p>
                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setAppsPage((prev) => Math.max(1, prev - 1))}
                                        disabled={normalizedAppsPage <= 1}
                                        className="h-8 w-8 inline-flex items-center justify-center rounded-md border border-sparkle-border text-sparkle-text-secondary hover:text-sparkle-text hover:bg-sparkle-card disabled:opacity-40 disabled:hover:bg-transparent"
                                    >
                                        <ChevronLeft size={14} />
                                    </button>
                                    <span className="text-xs text-sparkle-text-secondary">
                                        Page {normalizedAppsPage}/{totalAppsPages}
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() => setAppsPage((prev) => Math.min(totalAppsPages, prev + 1))}
                                        disabled={normalizedAppsPage >= totalAppsPages}
                                        className="h-8 w-8 inline-flex items-center justify-center rounded-md border border-sparkle-border text-sparkle-text-secondary hover:text-sparkle-text hover:bg-sparkle-card disabled:opacity-40 disabled:hover:bg-transparent"
                                    >
                                        <ChevronRight size={14} />
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}
