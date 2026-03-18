import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Activity, ChevronLeft, ChevronRight, Clock3, Cpu, Gauge, HardDrive, RefreshCw } from 'lucide-react'
import { Terminal as XtermTerminal } from 'xterm'
import { FitAddon } from 'xterm-addon-fit'
import { WebLinksAddon } from 'xterm-addon-web-links'
import 'xterm/css/xterm.css'
import { useLocation } from 'react-router-dom'
import { useSettings } from '@/lib/settings'
import { cn } from '@/lib/utils'
import type { DevScopePreviewTerminalSessionSummary } from '@shared/contracts/devscope-api'
import {
    createPreviewTerminalSessionId,
    formatDeviceMemoryLabel,
    formatMemoryLabel,
    formatRelativeShort,
    formatTerminalShellLabel,
    getTerminalPreviewLine,
    readCssVariable
} from './tasks/tasks-formatters'
import {
    APPS_PAGE_SIZE,
    RUNNING_APPS_FETCH_LIMIT,
    RUNNING_APPS_PREFS_KEY,
    TASKS_TERMINAL_PANEL_ANIMATION_MS,
    type ActiveTask,
    type DeviceStats,
    type MemoryUnit,
    type PreviewTerminalSessionGroup,
    type RunningApp,
    type RunningAppsPreferences,
    type RunningAppsSort,
    type RunningAppWithUsage
} from './tasks/tasks-types'

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
    const location = useLocation()
    const savedPrefsRef = useRef<Partial<RunningAppsPreferences> | null>(null)
    if (savedPrefsRef.current === null) {
        savedPrefsRef.current = readRunningAppsPreferences()
    }
    const savedPrefs = savedPrefsRef.current
    const [activeView, setActiveView] = useState<'operations' | 'terminals' | 'runningApps'>('operations')
    const [activeTasks, setActiveTasks] = useState<ActiveTask[]>([])
    const [activePorts, setActivePorts] = useState<number[]>([])
    const [terminalSessions, setTerminalSessions] = useState<DevScopePreviewTerminalSessionSummary[]>([])
    const [selectedTerminalSessionId, setSelectedTerminalSessionId] = useState('')
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
    const tasksTerminalHostRef = useRef<HTMLDivElement | null>(null)
    const tasksXtermRef = useRef<XtermTerminal | null>(null)
    const tasksFitAddonRef = useRef<FitAddon | null>(null)
    const tasksTerminalHydratedSessionIdRef = useRef('')
    const selectedTerminalSessionIdRef = useRef(selectedTerminalSessionId)
    const selectedTerminalSessionRef = useRef<DevScopePreviewTerminalSessionSummary | null>(null)
    const runningAppsEnabled = settings.tasksRunningAppsEnabled !== false
    const terminalSessionGroups = useMemo<PreviewTerminalSessionGroup[]>(() => {
        const groups = new Map<string, PreviewTerminalSessionGroup>()

        for (const session of terminalSessions) {
            const groupKey = String(session.groupKey || session.cwd || session.sessionId)
            const existing = groups.get(groupKey)
            if (existing) {
                existing.sessions.push(session)
                existing.lastActivityAt = Math.max(existing.lastActivityAt, session.lastActivityAt)
                existing.latestStartedAt = Math.max(existing.latestStartedAt, session.startedAt)
                continue
            }

            groups.set(groupKey, {
                groupKey,
                cwd: session.cwd,
                sessions: [session],
                lastActivityAt: session.lastActivityAt,
                latestStartedAt: session.startedAt
            })
        }

        return Array.from(groups.values())
            .map((group) => ({
                ...group,
                sessions: [...group.sessions].sort((a, b) => {
                    if (a.status === 'running' && b.status !== 'running') return -1
                    if (a.status !== 'running' && b.status === 'running') return 1
                    if (b.startedAt !== a.startedAt) return b.startedAt - a.startedAt
                    return b.lastActivityAt - a.lastActivityAt
                })
            }))
            .sort((a, b) => {
                if (b.latestStartedAt !== a.latestStartedAt) return b.latestStartedAt - a.latestStartedAt
                return b.lastActivityAt - a.lastActivityAt
            })
    }, [terminalSessions])
    const runningTerminalCount = useMemo(
        () => terminalSessions.filter((session) => session.status === 'running').length,
        [terminalSessions]
    )
    const sortedTerminalSessions = useMemo(
        () => [...terminalSessions].sort((a, b) => {
            if (a.status === 'running' && b.status !== 'running') return -1
            if (a.status !== 'running' && b.status === 'running') return 1
            if (b.startedAt !== a.startedAt) return b.startedAt - a.startedAt
            return b.lastActivityAt - a.lastActivityAt
        }),
        [terminalSessions]
    )
    const selectedTerminalSession = useMemo(
        () => terminalSessions.find((session) => session.sessionId === selectedTerminalSessionId) || null,
        [selectedTerminalSessionId, terminalSessions]
    )
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

    useEffect(() => {
        const requestedView = (location.state as { initialView?: string } | null)?.initialView
        if (requestedView === 'terminals') {
            setActiveView('terminals')
        }
    }, [location.state])

    useEffect(() => {
        selectedTerminalSessionIdRef.current = selectedTerminalSessionId
    }, [selectedTerminalSessionId])

    useEffect(() => {
        selectedTerminalSessionRef.current = selectedTerminalSession
    }, [selectedTerminalSession])

    useEffect(() => {
        const nextSessionId = (
            terminalSessions.find((session) => session.sessionId === selectedTerminalSessionId)?.sessionId
            || terminalSessions.find((session) => session.status === 'running')?.sessionId
            || terminalSessions[0]?.sessionId
            || ''
        )

        if (nextSessionId === selectedTerminalSessionId) return
        selectedTerminalSessionIdRef.current = nextSessionId
        setSelectedTerminalSessionId(nextSessionId)
    }, [selectedTerminalSessionId, terminalSessions])

    const disposeTasksTerminal = useCallback(() => {
        tasksTerminalHydratedSessionIdRef.current = ''
        tasksFitAddonRef.current = null
        tasksXtermRef.current?.dispose()
        tasksXtermRef.current = null
    }, [])

    useEffect(() => {
        if (activeView !== 'terminals') {
            disposeTasksTerminal()
            return
        }

        const activeSession = selectedTerminalSessionRef.current
        if (!activeSession) {
            disposeTasksTerminal()
            return
        }

        const host = tasksTerminalHostRef.current
        if (!host) return

        let terminal = tasksXtermRef.current
        let fitAddon = tasksFitAddonRef.current
        if (!terminal || !fitAddon) {
            terminal = new XtermTerminal({
                cursorBlink: true,
                fontFamily: 'Consolas, "Cascadia Code", monospace',
                fontSize: Math.max(11, Number.parseInt(readCssVariable('--terminal-font-size', '14'), 10) || 14),
                convertEol: true,
                scrollback: 5000,
                allowProposedApi: true,
                theme: tasksTerminalTheme
            })
            fitAddon = new FitAddon()
            const webLinksAddon = new WebLinksAddon()
            terminal.loadAddon(fitAddon)
            terminal.loadAddon(webLinksAddon)
            terminal.open(host)
            terminal.focus()
            tasksXtermRef.current = terminal
            tasksFitAddonRef.current = fitAddon

            terminal.onData((data) => {
                void window.devscope.writePreviewTerminal({
                    sessionId: selectedTerminalSessionIdRef.current,
                    data
                }).catch(() => undefined)
            })
        } else {
            terminal.options.theme = tasksTerminalTheme
        }

        const syncTerminalSize = () => {
            const activeFitAddon = tasksFitAddonRef.current
            if (!activeFitAddon) return
            activeFitAddon.fit()
            const dimensions = activeFitAddon.proposeDimensions?.()
            if (!dimensions) return
            void window.devscope.resizePreviewTerminal({
                sessionId: selectedTerminalSessionIdRef.current,
                cols: dimensions.cols,
                rows: dimensions.rows
            }).catch(() => undefined)
        }

        const hydrateTerminalSnapshot = () => {
            if (tasksTerminalHydratedSessionIdRef.current === activeSession.sessionId) return
            syncTerminalSize()
            terminal?.reset()
            if (activeSession.recentOutput) {
                terminal?.write(activeSession.recentOutput)
            }
            tasksTerminalHydratedSessionIdRef.current = activeSession.sessionId
            window.setTimeout(() => tasksXtermRef.current?.focus(), 0)
        }

        const resizeObserver = new ResizeObserver(() => {
            syncTerminalSize()
        })
        resizeObserver.observe(host)
        window.addEventListener('resize', syncTerminalSize)
        const initialSyncTimer = window.setTimeout(hydrateTerminalSnapshot, 0)
        const settleSyncTimer = window.setTimeout(syncTerminalSize, TASKS_TERMINAL_PANEL_ANIMATION_MS + 40)

        return () => {
            resizeObserver.disconnect()
            window.removeEventListener('resize', syncTerminalSize)
            window.clearTimeout(initialSyncTimer)
            window.clearTimeout(settleSyncTimer)
        }
    }, [activeView, disposeTasksTerminal, selectedTerminalSessionId, tasksTerminalTheme])

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
        const unsubscribe = window.devscope.onPreviewTerminalEvent((event) => {
            if (!event?.sessionId) return

            if (event.type === 'output') {
                const outputChunk = String(event.data || '')
                setTerminalSessions((current) => current.map((session) => {
                    if (session.sessionId !== event.sessionId) return session
                    return {
                        ...session,
                        title: event.title || session.title,
                        shell: event.shell || session.shell,
                        cwd: event.cwd || session.cwd,
                        groupKey: event.groupKey || session.groupKey,
                        status: event.status || session.status,
                        lastActivityAt: Date.now(),
                        recentOutput: `${session.recentOutput || ''}${outputChunk}`.slice(-60_000)
                    }
                }))

                if (activeView === 'terminals' && event.sessionId === selectedTerminalSessionIdRef.current) {
                    tasksXtermRef.current?.write(outputChunk)
                }
                return
            }

            void refresh({ quiet: true })
        })

        return () => {
            unsubscribe()
        }
    }, [activeView, refresh])

    useEffect(() => {
        return () => {
            disposeTasksTerminal()
        }
    }, [disposeTasksTerminal])

    const handleStopPreviewTerminal = useCallback(async (sessionId: string) => {
        const targetSessionId = String(sessionId || '').trim()
        if (!targetSessionId) return
        await window.devscope.closePreviewTerminal(targetSessionId).catch(() => undefined)
        void refresh({ quiet: true })
    }, [refresh])

    const handleCreateTerminalForPath = useCallback(async (targetPath: string) => {
        const normalizedTargetPath = String(targetPath || '').trim()
        if (!normalizedTargetPath) return

        const sessionId = createPreviewTerminalSessionId()
        const result = await window.devscope.createPreviewTerminal({
            sessionId,
            targetPath: normalizedTargetPath,
            preferredShell: settings.defaultShell,
            cols: 100,
            rows: 28
        })

        if (!result?.success) {
            setError(result?.error || 'Failed to create terminal session')
            return
        }

        setSelectedTerminalSessionId(sessionId)
        setActiveView('terminals')
        void refresh({ quiet: true })
    }, [refresh, settings.defaultShell])

    const handleOpenTerminalSession = useCallback((sessionId: string) => {
        const normalizedSessionId = String(sessionId || '').trim()
        if (!normalizedSessionId) return
        setSelectedTerminalSessionId(normalizedSessionId)
        setActiveView('terminals')
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
                <button
                    type="button"
                    onClick={() => setActiveView('terminals')}
                    className={cn(
                        'rounded-lg px-3 py-1.5 text-xs transition-colors',
                        activeView === 'terminals'
                            ? 'bg-[var(--accent-primary)] text-white'
                            : 'text-sparkle-text-secondary hover:bg-sparkle-bg hover:text-sparkle-text'
                    )}
                >
                    Terminals
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
                <div className="space-y-4">
                    <div className="rounded-xl border border-sparkle-border bg-sparkle-card overflow-hidden">
                        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-sparkle-border px-5 py-4 bg-sparkle-bg/50">
                            <div>
                                <div className="flex flex-wrap items-center gap-2">
                                    <h2 className="text-sm font-semibold text-sparkle-text">
                                        Terminal Sessions ({terminalSessions.length})
                                    </h2>
                                    <span className="rounded-md border border-amber-400/30 bg-amber-500/10 px-1.5 py-0.5 text-[10px] uppercase tracking-[0.16em] text-amber-200">
                                        Beta
                                    </span>
                                </div>
                                <p className="mt-1 text-xs text-sparkle-text-secondary">
                                    Grouped by working directory. Sessions keep running after preview windows close.
                                </p>
                            </div>
                            <div className="flex flex-wrap items-center gap-2 text-[11px]">
                                <button
                                    type="button"
                                    onClick={() => setActiveView('terminals')}
                                    className="rounded-md border border-sky-400/25 bg-sky-500/10 px-2.5 py-1 text-sky-200 transition-colors hover:bg-sky-500/15"
                                >
                                    Open Terminal Tab
                                </button>
                                <span className="rounded-full border border-emerald-400/30 bg-emerald-500/10 px-2.5 py-1 text-emerald-300">
                                    {runningTerminalCount} running
                                </span>
                                <span className="rounded-full border border-sparkle-border bg-sparkle-card px-2.5 py-1 text-sparkle-text-secondary">
                                    {terminalSessionGroups.length} group{terminalSessionGroups.length === 1 ? '' : 's'}
                                </span>
                            </div>
                        </div>
                        <div className="p-4">
                            {initialLoading && terminalSessions.length === 0 ? (
                                <p className="text-sm text-sparkle-text-secondary">Loading terminal sessions...</p>
                            ) : sortedTerminalSessions.length === 0 ? (
                                <div className="rounded-xl border border-dashed border-sparkle-border bg-sparkle-bg/40 px-4 py-6 text-sm text-sparkle-text-secondary">
                                    No preview terminal sessions are active yet.
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                                    {sortedTerminalSessions.map((session) => {
                                        const isRunning = session.status === 'running'
                                        const statusClass = isRunning
                                            ? 'bg-emerald-300'
                                            : session.status === 'error'
                                                ? 'bg-red-300'
                                                : 'bg-amber-300'

                                        return (
                                            <button
                                                key={session.sessionId}
                                                type="button"
                                                onClick={() => handleOpenTerminalSession(session.sessionId)}
                                                className="rounded-xl border border-sparkle-border bg-sparkle-bg/35 p-3 text-left transition-colors hover:border-sky-400/35 hover:bg-sky-500/8"
                                            >
                                                <div className="flex items-start justify-between gap-3">
                                                    <div className="min-w-0 flex-1">
                                                        <div className="flex items-center gap-2">
                                                            <span className={cn('h-2 w-2 rounded-full shrink-0', statusClass)} />
                                                            <p className="truncate text-[12px] font-medium text-sparkle-text">
                                                                {session.title}
                                                            </p>
                                                        </div>
                                                        <div className="mt-1 truncate text-[10px] text-sparkle-text-muted">
                                                            {session.cwd}
                                                        </div>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={(event) => {
                                                            event.stopPropagation()
                                                            void handleStopPreviewTerminal(session.sessionId)
                                                        }}
                                                        className="shrink-0 rounded-md border border-red-400/25 bg-red-500/8 px-2 py-1 text-[10px] text-red-300 transition-colors hover:bg-red-500/12 hover:text-red-200"
                                                    >
                                                        Stop
                                                    </button>
                                                </div>
                                                <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px] text-sparkle-text-muted">
                                                    <span>{formatTerminalShellLabel(session.shell)}</span>
                                                    <span>{formatRelativeShort(session.lastActivityAt)}</span>
                                                    {typeof session.exitCode === 'number' && session.status !== 'running' && (
                                                        <span>exit {session.exitCode}</span>
                                                    )}
                                                </div>
                                                <div className="mt-2 truncate rounded-lg border border-sparkle-border-secondary bg-black/15 px-2.5 py-2 font-mono text-[10px] text-sparkle-text-secondary/90">
                                                    {getTerminalPreviewLine(session)}
                                                </div>
                                            </button>
                                        )
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            ) : activeView === 'terminals' ? (
                <div className="grid h-[calc(100vh-320px)] min-h-[480px] max-h-[calc(100vh-320px)] grid-cols-1 gap-3 overflow-hidden xl:grid-cols-[240px_minmax(0,1fr)]">
                    <div className="flex min-h-0 flex-col rounded-xl border border-sparkle-border bg-sparkle-card overflow-hidden">
                        <div className="border-b border-sparkle-border px-4 py-3 bg-sparkle-bg/60">
                            <div className="flex flex-wrap items-center gap-2">
                                <h2 className="text-sm font-semibold text-sparkle-text">
                                    Terminal Browser ({terminalSessions.length})
                                </h2>
                                <span className="rounded-md border border-amber-400/30 bg-amber-500/10 px-1.5 py-0.5 text-[10px] uppercase tracking-[0.16em] text-amber-200">
                                    Beta
                                </span>
                            </div>
                            <p className="mt-1 text-xs text-sparkle-text-secondary">
                                Click any live session to open it in the right-hand terminal pane.
                            </p>
                        </div>
                        <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden p-2 space-y-2 custom-scrollbar">
                            {terminalSessionGroups.length === 0 ? (
                                <div className="rounded-xl border border-dashed border-sparkle-border bg-sparkle-bg/40 px-4 py-6 text-sm text-sparkle-text-secondary">
                                    No preview terminal sessions are active yet.
                                </div>
                            ) : (
                                terminalSessionGroups.map((group) => (
                                    <section
                                        key={group.groupKey}
                                        className="rounded-xl border border-sparkle-border bg-sparkle-bg/45 overflow-hidden"
                                    >
                                        <div className="flex items-start justify-between gap-2 border-b border-sparkle-border-secondary px-3 py-2">
                                            <div className="min-w-0 flex-1">
                                                <div className="truncate text-[10px] font-medium text-sparkle-text">
                                                    {group.cwd}
                                                </div>
                                                <div className="mt-0.5 text-[10px] text-sparkle-text-muted">
                                                    {group.sessions.length} session{group.sessions.length === 1 ? '' : 's'}
                                                </div>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => { void handleCreateTerminalForPath(group.cwd) }}
                                                className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-sparkle-border bg-sparkle-card text-[13px] font-semibold text-sparkle-text-secondary transition-colors hover:bg-sparkle-card-hover hover:text-sparkle-text"
                                                title={`New terminal in ${group.cwd}`}
                                            >
                                                +
                                            </button>
                                        </div>
                                        <div className="p-1.5 space-y-1.5">
                                            {group.sessions.map((session) => {
                                                const isSelected = session.sessionId === selectedTerminalSessionId
                                                const statusClass = session.status === 'running'
                                                    ? 'bg-emerald-300'
                                                    : session.status === 'error'
                                                        ? 'bg-red-300'
                                                        : 'bg-amber-300'

                                                return (
                                                    <button
                                                        key={session.sessionId}
                                                        type="button"
                                                        onClick={() => setSelectedTerminalSessionId(session.sessionId)}
                                                        className={cn(
                                                            'w-full rounded-lg border px-2 py-1.5 text-left transition-colors',
                                                            isSelected
                                                                ? 'border-sky-400/35 bg-sky-500/12'
                                                                : 'border-sparkle-border bg-sparkle-card/70 hover:border-sparkle-border-secondary hover:bg-sparkle-card-hover/60'
                                                        )}
                                                    >
                                                        <div className="flex items-center gap-2">
                                                            <span className={cn('h-2 w-2 rounded-full shrink-0', statusClass)} />
                                                            <span className="truncate text-[11px] font-medium text-sparkle-text">
                                                                {session.title}
                                                            </span>
                                                        </div>
                                                        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px] text-sparkle-text-muted">
                                                            <span>{formatTerminalShellLabel(session.shell)}</span>
                                                            <span>{formatRelativeShort(session.lastActivityAt)}</span>
                                                            {typeof session.exitCode === 'number' && session.status !== 'running' && (
                                                                <span>exit {session.exitCode}</span>
                                                            )}
                                                        </div>
                                                        <div className="mt-0.5 truncate font-mono text-[10px] text-sparkle-text-secondary/90">
                                                            {getTerminalPreviewLine(session)}
                                                        </div>
                                                    </button>
                                                )
                                            })}
                                        </div>
                                    </section>
                                ))
                            )}
                        </div>
                    </div>

                    <div className="flex min-h-0 flex-col rounded-xl border border-sparkle-border bg-sparkle-card overflow-hidden">
                        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-sparkle-border px-4 py-3 bg-sparkle-bg/50">
                            <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                    <h2 className="text-sm font-semibold text-sparkle-text">
                                        {selectedTerminalSession?.title || 'No terminal selected'}
                                    </h2>
                                    {selectedTerminalSession && (
                                        <span className="rounded-md border border-sparkle-border bg-sparkle-card px-1.5 py-0.5 text-[10px] uppercase tracking-[0.16em] text-sparkle-text-muted">
                                            {formatTerminalShellLabel(selectedTerminalSession.shell)}
                                        </span>
                                    )}
                                </div>
                                <p className="mt-1 truncate text-xs text-sparkle-text-secondary">
                                    {selectedTerminalSession?.cwd || 'Select a session from the left to open it here.'}
                                </p>
                            </div>
                            <div className="flex items-center gap-2">
                                {selectedTerminalSession && (
                                    <button
                                        type="button"
                                        onClick={() => { void handleStopPreviewTerminal(selectedTerminalSession.sessionId) }}
                                        className="rounded-md border border-red-400/25 bg-red-500/8 px-3 py-1.5 text-[11px] font-medium text-red-300 transition-colors hover:bg-red-500/12 hover:text-red-200"
                                    >
                                        Stop
                                    </button>
                                )}
                                <button
                                    type="button"
                                    onClick={() => { void refresh() }}
                                    className="rounded-md border border-sparkle-border px-3 py-1.5 text-[11px] font-medium text-sparkle-text-secondary transition-colors hover:bg-sparkle-card-hover hover:text-sparkle-text"
                                >
                                    Refresh Sessions
                                </button>
                            </div>
                        </div>
                        <div className="min-h-0 flex-1 overflow-hidden p-3">
                            {selectedTerminalSession ? (
                                <div
                                    ref={tasksTerminalHostRef}
                                    className="h-full w-full overflow-hidden rounded-xl border border-sparkle-border-secondary focus-within:border-[var(--accent-primary)]/60 focus-within:shadow-[0_0_0_1px_rgba(56,189,248,0.2)]"
                                    style={{ backgroundColor: tasksTerminalTheme.background }}
                                />
                            ) : (
                                <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-sparkle-border-secondary bg-sparkle-bg/35 px-6 text-center">
                                    <div className="max-w-md space-y-3">
                                        <div className="text-base font-medium text-sparkle-text">No terminal selected</div>
                                        <div className="text-sm leading-relaxed text-sparkle-text-secondary">
                                            Pick a session from the left to open the live terminal here. This view attaches to the existing session instead of starting a duplicate shell.
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
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
