import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import type { Shell } from '@/lib/settings'
import { Terminal as XtermTerminal } from 'xterm'
import { FitAddon } from 'xterm-addon-fit'
import { WebLinksAddon } from 'xterm-addon-web-links'
import type { DevScopePreviewTerminalSessionSummary } from '@shared/contracts/devscope-api'
import { createPreviewTerminalSessionId, readCssVariable } from './tasks-formatters'
import { TASKS_TERMINAL_PANEL_ANIMATION_MS } from './tasks-types'
import type { PreviewTerminalSessionGroup } from './tasks-types'

export function useTasksTerminal(input: {
    activeView: 'operations' | 'terminals' | 'runningApps'
    setActiveView: Dispatch<SetStateAction<'operations' | 'terminals' | 'runningApps'>>
    terminalSessions: DevScopePreviewTerminalSessionSummary[]
    setTerminalSessions: Dispatch<SetStateAction<DevScopePreviewTerminalSessionSummary[]>>
    defaultShell: Shell
    terminalTheme: Record<string, string>
    setError: Dispatch<SetStateAction<string | null>>
    refresh: (options?: { quiet?: boolean }) => Promise<void>
}) {
    const {
        activeView,
        setActiveView,
        terminalSessions,
        setTerminalSessions,
        defaultShell,
        terminalTheme,
        setError,
        refresh
    } = input

    const [selectedTerminalSessionId, setSelectedTerminalSessionId] = useState('')
    const tasksTerminalHostRef = useRef<HTMLDivElement | null>(null)
    const tasksXtermRef = useRef<XtermTerminal | null>(null)
    const tasksFitAddonRef = useRef<FitAddon | null>(null)
    const tasksTerminalHydratedSessionIdRef = useRef('')
    const selectedTerminalSessionIdRef = useRef(selectedTerminalSessionId)
    const selectedTerminalSessionRef = useRef<DevScopePreviewTerminalSessionSummary | null>(null)

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
                theme: terminalTheme
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
            terminal.options.theme = terminalTheme
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
    }, [activeView, disposeTasksTerminal, selectedTerminalSessionId, terminalTheme])

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
    }, [activeView, refresh, setTerminalSessions])

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
            preferredShell: defaultShell,
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
    }, [defaultShell, refresh, setActiveView, setError])

    const handleOpenTerminalSession = useCallback((sessionId: string) => {
        const normalizedSessionId = String(sessionId || '').trim()
        if (!normalizedSessionId) return
        setSelectedTerminalSessionId(normalizedSessionId)
        setActiveView('terminals')
    }, [setActiveView])

    return {
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
    }
}
