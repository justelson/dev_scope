import { useEffect, useMemo } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import type {
    DeviceStats,
    MemoryUnit,
    RunningApp,
    RunningAppsSort,
    RunningAppWithUsage
} from './tasks-types'
import { APPS_PAGE_SIZE } from './tasks-types'

export function useRunningAppsModel(input: {
    runningApps: RunningApp[]
    deviceStats: DeviceStats | null
    appScope: 'all' | 'app' | 'background'
    appsFilter: 'all' | 'highCpu' | 'highMemory' | 'multiInstance' | 'activeOnly'
    sortBy: RunningAppsSort
    sortDirection: 'asc' | 'desc'
    appsPage: number
    setAppsPage: Dispatch<SetStateAction<number>>
    memoryUnit: MemoryUnit
}) {
    const {
        runningApps,
        deviceStats,
        appScope,
        appsFilter,
        sortBy,
        sortDirection,
        appsPage,
        setAppsPage,
        memoryUnit
    } = input

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

    const totalAppsPages = useMemo(
        () => Math.max(1, Math.ceil(sortedRunningApps.length / APPS_PAGE_SIZE)),
        [sortedRunningApps.length]
    )
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
    }, [appsPage, totalAppsPages, setAppsPage])

    return {
        memoryUnit,
        runningAppTotals,
        sortedRunningApps,
        totalAppsPages,
        normalizedAppsPage,
        pagedAppsSection,
        pagedBackgroundSection,
        deviceMemoryPercent
    }
}
