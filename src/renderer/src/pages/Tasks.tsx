import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle, Clock3, Play, RefreshCw, SquareTerminal } from 'lucide-react'
import { useSettings } from '@/lib/settings'
import type { DevScopePreviewTerminalSessionSummary } from '@shared/contracts/devscope-api'
import { formatRelativeShort, readCssVariable } from './tasks/tasks-formatters'
import { TerminalSessionsPanel } from './tasks/TerminalSessionsPanel'
import { useTasksTerminal } from './tasks/useTasksTerminal'

export default function Tasks() {
    const { settings } = useSettings()
    const [terminalSessions, setTerminalSessions] = useState<DevScopePreviewTerminalSessionSummary[]>([])
    const [initialLoading, setInitialLoading] = useState(true)
    const [refreshing, setRefreshing] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [lastRefreshAt, setLastRefreshAt] = useState<number | null>(null)
    const hasLoadedOnceRef = useRef(false)
    const refreshSequenceRef = useRef(0)

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

        if (!quiet && hasLoadedOnceRef.current) {
            setRefreshing(true)
        }

        try {
            const result = await window.devscope.listPreviewTerminalSessions()
            if (requestSequence !== refreshSequenceRef.current) return

            if (!result.success) {
                setError(result.error || 'Failed to load terminal sessions')
                return
            }

            setTerminalSessions([...(result.sessions || [])] as DevScopePreviewTerminalSessionSummary[])
            setError(null)
            setLastRefreshAt(Date.now())
            hasLoadedOnceRef.current = true
            setInitialLoading(false)
        } catch (err: any) {
            if (requestSequence !== refreshSequenceRef.current) return
            setError(err?.message || 'Failed to refresh terminals')
            hasLoadedOnceRef.current = true
            setInitialLoading(false)
        } finally {
            if (requestSequence === refreshSequenceRef.current) {
                setRefreshing(false)
            }
        }
    }, [])

    const {
        tasksTerminalHostRef,
        selectedTerminalSessionId,
        setSelectedTerminalSessionId,
        selectedTerminalSession,
        terminalSessionGroups,
        runningTerminalCount,
        handleStopPreviewTerminal,
        handleCreateTerminalForPath
    } = useTasksTerminal({
        terminalSessions,
        setTerminalSessions,
        defaultShell: settings.defaultShell,
        terminalTheme: tasksTerminalTheme,
        setError,
        refresh
    })

    const handleCreateTerminal = useCallback(async () => {
        try {
            const result = await window.devscope.selectFolder()
            if (!result.success || !result.folderPath) return
            await handleCreateTerminalForPath(result.folderPath)
        } catch (err: any) {
            setError(err?.message || 'Failed to select folder for terminal')
        }
    }, [handleCreateTerminalForPath])

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
        <div className="mx-auto max-w-[1500px] animate-fadeIn pb-10">
            <div className="mb-4 flex items-center justify-between gap-4">
                <div className="min-w-0">
                    <div className="flex items-center gap-2.5">
                        <div className="rounded-lg bg-sky-500/10 p-1.5">
                            <SquareTerminal size={18} className="text-sky-300" />
                        </div>
                        <h1 className="text-xl font-semibold text-sparkle-text">Terminals</h1>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                        <HeaderPill
                            icon={<SquareTerminal size={12} className="text-sky-300" />}
                            label={String(terminalSessions.length)}
                            title={`${terminalSessions.length} terminal session${terminalSessions.length === 1 ? '' : 's'}`}
                        />
                        <HeaderPill
                            icon={<Play size={12} className="text-emerald-300" />}
                            label={String(runningTerminalCount)}
                            title={`${runningTerminalCount} running terminal${runningTerminalCount === 1 ? '' : 's'}`}
                        />
                        <HeaderPill
                            icon={<Clock3 size={12} className="text-sparkle-text-muted" />}
                            label={lastRefreshAt ? formatRelativeShort(lastRefreshAt).replace(/\s+ago$/i, '') : '--'}
                            title={lastRefreshAt ? `Last refresh ${formatRelativeShort(lastRefreshAt)}` : 'Refresh pending'}
                        />
                    </div>
                </div>

                <button
                    type="button"
                    onClick={() => { void refresh() }}
                    disabled={refreshing}
                    title="Refresh terminals"
                    aria-label="Refresh terminals"
                    className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/[0.03] text-sparkle-text-secondary transition-colors hover:border-white/20 hover:bg-white/[0.05] hover:text-sparkle-text disabled:opacity-50"
                >
                    <RefreshCw size={15} className={refreshing || initialLoading ? 'animate-spin' : ''} />
                </button>
            </div>

            {error ? (
                <div className="mb-5 inline-flex max-w-full items-center gap-2 rounded-lg border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-sm text-amber-300">
                    <AlertTriangle size={14} className="shrink-0" />
                    <span className="truncate">{error}</span>
                </div>
            ) : null}

            <TerminalSessionsPanel
                terminalSessions={terminalSessions}
                terminalSessionGroups={terminalSessionGroups}
                selectedTerminalSessionId={selectedTerminalSessionId}
                selectedTerminalSession={selectedTerminalSession}
                tasksTerminalHostRef={tasksTerminalHostRef}
                terminalBackgroundColor={tasksTerminalTheme.background}
                refreshing={refreshing || initialLoading}
                onCreateTerminal={() => { void handleCreateTerminal() }}
                onCreateTerminalForPath={(path) => { void handleCreateTerminalForPath(path) }}
                onSelectTerminalSession={setSelectedTerminalSessionId}
                onStopPreviewTerminal={(sessionId) => { void handleStopPreviewTerminal(sessionId) }}
                onRefresh={() => { void refresh() }}
            />
        </div>
    )
}

function HeaderPill({
    icon,
    label,
    title
}: {
    icon: React.ReactNode
    label: string
    title: string
}) {
    return (
        <span
            title={title}
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-xs text-sparkle-text-secondary"
        >
            {icon}
            <span className="font-medium text-sparkle-text">{label}</span>
        </span>
    )
}
