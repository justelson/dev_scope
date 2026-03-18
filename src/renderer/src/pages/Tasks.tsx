import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useSettings } from '@/lib/settings'
import type { DevScopePreviewTerminalSessionSummary } from '@shared/contracts/devscope-api'
import { readCssVariable } from './tasks/tasks-formatters'
import { RUNNING_APPS_FETCH_LIMIT, type DeviceStats, type RunningApp } from './tasks/tasks-types'
import { TasksHeader } from './tasks/TasksHeader'
import { OperationsPanel } from './tasks/OperationsPanel'
import { TerminalSessionsPanel } from './tasks/TerminalSessionsPanel'
import { RunningAppsPanel } from './tasks/RunningAppsPanel'
import { useRunningAppsPreferences } from './tasks/useRunningAppsPreferences'
import { useRunningAppsModel } from './tasks/useRunningAppsModel'
import { useTasksTerminal } from './tasks/useTasksTerminal'

export default function Tasks() {
    const { settings } = useSettings()
    const location = useLocation()
    const [activeView, setActiveView] = useState<'operations' | 'terminals' | 'runningApps'>('operations')
    const [terminalSessions, setTerminalSessions] = useState<DevScopePreviewTerminalSessionSummary[]>([])
    const [runningApps, setRunningApps] = useState<RunningApp[]>([])
    const [deviceStats, setDeviceStats] = useState<DeviceStats | null>(null)
    const [initialLoading, setInitialLoading] = useState(true)
    const [refreshing, setRefreshing] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [lastRefreshAt, setLastRefreshAt] = useState<number | null>(null)
    const hasLoadedOnceRef = useRef(false)
    const refreshSequenceRef = useRef(0)
    const runningAppsEnabled = settings.tasksRunningAppsEnabled !== false
    const {
        appScope,
        setAppScope,
        appsFilter,
        setAppsFilter,
        memoryUnit,
        setMemoryUnit,
        sortBy,
        setSortBy,
        sortDirection,
        setSortDirection,
        appsPage,
        setAppsPage
    } = useRunningAppsPreferences()

    const tasksTerminalTheme = useMemo(() => {
        const accent = readCssVariable('--accent-primary', settings.accentColor.primary || '#38bdf8')
        const card = readCssVariable('--color-card', '#0b1220')
        const bg = readCssVariable('--color-bg', '#020617')
        const text = '#e5e7eb'
        const textSecondary = '#94a3b8'
        const borderSecondary = readCssVariable('--color-border-secondary', '#334155')

        return {
            background: card,
            foreground: text,
            cursor: accent,
            cursorAccent: card,
            selectionBackground: `${accent}33`,
            black: bg,
            brightBlack: borderSecondary,
            red: '#f87171',
            brightRed: '#fca5a5',
            green: '#4ade80',
            brightGreen: '#86efac',
            yellow: '#facc15',
            brightYellow: '#fde047',
            blue: '#60a5fa',
            brightBlue: '#93c5fd',
            magenta: '#c084fc',
            brightMagenta: '#e9d5ff',
            cyan: '#22d3ee',
            brightCyan: '#67e8f9',
            white: textSecondary,
            brightWhite: text
        }
    }, [settings.accentColor.primary, settings.theme])

    const refresh = useCallback(async (options?: { quiet?: boolean }) => {
        const quiet = Boolean(options?.quiet)
        const requestSequence = ++refreshSequenceRef.current
        const shouldFetchRunningAppsData = runningAppsEnabled && activeView === 'runningApps'

        if (!quiet && hasLoadedOnceRef.current) {
            setRefreshing(true)
        }

        try {
            const [terminalsResult, appsResult, systemOverviewResult, systemDetailedResult] = await Promise.allSettled([
                window.devscope.listPreviewTerminalSessions(),
                shouldFetchRunningAppsData ? window.devscope.getRunningApps(RUNNING_APPS_FETCH_LIMIT) : Promise.resolve(null),
                shouldFetchRunningAppsData ? window.devscope.getSystemOverview() : Promise.resolve(null),
                shouldFetchRunningAppsData ? window.devscope.getDetailedSystemStats() : Promise.resolve(null)
            ])

            if (requestSequence !== refreshSequenceRef.current) return

            const nextErrors: string[] = []
            let nextTerminalSessions: DevScopePreviewTerminalSessionSummary[] | null = null
            let nextApps: RunningApp[] | null = null
            let nextDeviceStats: DeviceStats | null = null

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
                    const cpuUsage = [Number(detailed?.cpu?.load), Number(overview.cpu?.usage)].find((value) => Number.isFinite(value))

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

    const {
        tasksTerminalHostRef,
        selectedTerminalSessionId,
        setSelectedTerminalSessionId,
        selectedTerminalSession,
        terminalSessionGroups,
        runningTerminalCount,
        sortedTerminalSessions,
        handleStopPreviewTerminal,
        handleCreateTerminalForPath,
        handleOpenTerminalSession
    } = useTasksTerminal({
        activeView,
        setActiveView,
        terminalSessions,
        setTerminalSessions,
        defaultShell: settings.defaultShell,
        terminalTheme: tasksTerminalTheme,
        setError,
        refresh
    })

    const {
        runningAppTotals,
        sortedRunningApps,
        totalAppsPages,
        normalizedAppsPage,
        pagedAppsSection,
        pagedBackgroundSection,
        deviceMemoryPercent
    } = useRunningAppsModel({
        runningApps,
        deviceStats,
        appScope,
        appsFilter,
        sortBy,
        sortDirection,
        appsPage,
        setAppsPage,
        memoryUnit
    })

    useEffect(() => {
        if (runningAppsEnabled) return
        if (activeView === 'runningApps') {
            setActiveView('operations')
        }
        setRunningApps((current) => (current.length > 0 ? [] : current))
        setDeviceStats((current) => (current ? null : current))
    }, [activeView, runningAppsEnabled])

    useEffect(() => {
        const requestedView = (location.state as { initialView?: string } | null)?.initialView
        if (requestedView === 'terminals') {
            setActiveView('terminals')
        }
    }, [location.state])

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

    return (
        <div className="mx-auto max-w-[1400px] animate-fadeIn pb-14">
            <TasksHeader
                activeView={activeView}
                runningAppsEnabled={runningAppsEnabled}
                lastRefreshAt={lastRefreshAt}
                refreshing={refreshing}
                initialLoading={initialLoading}
                hasLoadedOnce={hasLoadedOnceRef.current}
                onRefresh={() => { void refresh() }}
                onSelectView={setActiveView}
            />

            {error && (
                <div className="mb-5 rounded-lg border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
                    {error}
                </div>
            )}

            {activeView === 'operations' ? (
                <OperationsPanel
                    initialLoading={initialLoading}
                    terminalSessions={terminalSessions}
                    sortedTerminalSessions={sortedTerminalSessions}
                    terminalSessionGroupsCount={terminalSessionGroups.length}
                    runningTerminalCount={runningTerminalCount}
                    onOpenTerminalTab={() => setActiveView('terminals')}
                    onOpenTerminalSession={handleOpenTerminalSession}
                    onStopPreviewTerminal={(sessionId) => { void handleStopPreviewTerminal(sessionId) }}
                />
            ) : activeView === 'terminals' ? (
                <TerminalSessionsPanel
                    terminalSessions={terminalSessions}
                    terminalSessionGroups={terminalSessionGroups}
                    selectedTerminalSessionId={selectedTerminalSessionId}
                    selectedTerminalSession={selectedTerminalSession}
                    tasksTerminalHostRef={tasksTerminalHostRef}
                    terminalBackgroundColor={tasksTerminalTheme.background}
                    onCreateTerminalForPath={(path) => { void handleCreateTerminalForPath(path) }}
                    onSelectTerminalSession={setSelectedTerminalSessionId}
                    onStopPreviewTerminal={(sessionId) => { void handleStopPreviewTerminal(sessionId) }}
                    onRefresh={() => { void refresh() }}
                />
            ) : (
                <RunningAppsPanel
                    runningAppsCount={runningApps.length}
                    runningAppTotals={runningAppTotals}
                    deviceStats={deviceStats}
                    memoryUnit={memoryUnit}
                    deviceMemoryPercent={deviceMemoryPercent}
                    appScope={appScope}
                    setAppScope={setAppScope}
                    appsFilter={appsFilter}
                    setAppsFilter={setAppsFilter}
                    setMemoryUnit={setMemoryUnit}
                    sortBy={sortBy}
                    setSortBy={setSortBy}
                    sortDirection={sortDirection}
                    setSortDirection={setSortDirection}
                    initialLoading={initialLoading}
                    sortedRunningApps={sortedRunningApps}
                    pagedAppsSection={pagedAppsSection}
                    pagedBackgroundSection={pagedBackgroundSection}
                    normalizedAppsPage={normalizedAppsPage}
                    totalAppsPages={totalAppsPages}
                    setAppsPage={setAppsPage}
                />
            )}
        </div>
    )
}
