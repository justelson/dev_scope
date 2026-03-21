import { useCallback, useEffect, useRef, useState } from 'react'
import type { DevScopePreviewTerminalSessionSummary } from '@shared/contracts/devscope-api'
import type { ActiveTask, DeviceStats, RunningApp } from './tasks-types'
import { RUNNING_APPS_FETCH_LIMIT } from './tasks-types'

export function useTasksRefresh(input: {
    activeView: 'operations' | 'terminals' | 'runningApps'
    runningAppsEnabled: boolean
}) {
    const { activeView, runningAppsEnabled } = input
    const [activeTasks, setActiveTasks] = useState<ActiveTask[]>([])
    const [activePorts, setActivePorts] = useState<number[]>([])
    const [terminalSessions, setTerminalSessions] = useState<DevScopePreviewTerminalSessionSummary[]>([])
    const [runningApps, setRunningApps] = useState<RunningApp[]>([])
    const [deviceStats, setDeviceStats] = useState<DeviceStats | null>(null)
    const [initialLoading, setInitialLoading] = useState(true)
    const [refreshing, setRefreshing] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [lastRefreshAt, setLastRefreshAt] = useState<number | null>(null)
    const hasLoadedOnceRef = useRef(false)
    const refreshSequenceRef = useRef(0)

    const refresh = useCallback(async (options?: { quiet?: boolean }) => {
        const quiet = Boolean(options?.quiet)
        const requestSequence = ++refreshSequenceRef.current
        const shouldFetchRunningAppsData = runningAppsEnabled && activeView === 'runningApps'
        if (!quiet && hasLoadedOnceRef.current) {
            setRefreshing(true)
        }

        try {
            const [tasksResult, portsResult, terminalsResult, appsResult, systemOverviewResult, systemDetailedResult] = await Promise.allSettled([
                window.devscope.listActiveTasks(),
                window.devscope.getActivePorts(),
                window.devscope.listPreviewTerminalSessions(),
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
            let nextTerminalSessions: DevScopePreviewTerminalSessionSummary[] | null = null
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

            if (terminalsResult.status === 'fulfilled') {
                if (terminalsResult.value.success) {
                    nextTerminalSessions = [...(terminalsResult.value.sessions || [])] as DevScopePreviewTerminalSessionSummary[]
                } else {
                    nextErrors.push(terminalsResult.value.error || 'Failed to load terminal sessions')
                }
            } else {
                nextErrors.push(terminalsResult.reason?.message || 'Failed to load terminal sessions')
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
            if (nextTerminalSessions !== null) setTerminalSessions(nextTerminalSessions)
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

    useEffect(() => {
        if (runningAppsEnabled) return
        setRunningApps((current) => (current.length > 0 ? [] : current))
        setDeviceStats((current) => (current ? null : current))
    }, [runningAppsEnabled])

    return {
        activeTasks,
        activePorts,
        terminalSessions,
        setTerminalSessions,
        runningApps,
        deviceStats,
        initialLoading,
        refreshing,
        error,
        setError,
        lastRefreshAt,
        hasLoadedOnceRef,
        refresh
    }
}
