import type { RefObject } from 'react'
import { cn } from '@/lib/utils'
import { formatRelativeShort, formatTerminalShellLabel, getTerminalPreviewLine } from './tasks-formatters'
import type { PreviewTerminalSessionGroup } from './tasks-types'
import type { DevScopePreviewTerminalSessionSummary } from '@shared/contracts/devscope-api'

type TerminalSessionsPanelProps = {
    terminalSessions: DevScopePreviewTerminalSessionSummary[]
    terminalSessionGroups: PreviewTerminalSessionGroup[]
    selectedTerminalSessionId: string
    selectedTerminalSession: DevScopePreviewTerminalSessionSummary | null
    tasksTerminalHostRef: RefObject<HTMLDivElement | null>
    terminalBackgroundColor: string
    onCreateTerminalForPath: (path: string) => void
    onSelectTerminalSession: (sessionId: string) => void
    onStopPreviewTerminal: (sessionId: string) => void
    onRefresh: () => void
}

export function TerminalSessionsPanel({
    terminalSessions,
    terminalSessionGroups,
    selectedTerminalSessionId,
    selectedTerminalSession,
    tasksTerminalHostRef,
    terminalBackgroundColor,
    onCreateTerminalForPath,
    onSelectTerminalSession,
    onStopPreviewTerminal,
    onRefresh
}: TerminalSessionsPanelProps) {
    return (
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
                                        onClick={() => onCreateTerminalForPath(group.cwd)}
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
                                                onClick={() => onSelectTerminalSession(session.sessionId)}
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
                                onClick={() => onStopPreviewTerminal(selectedTerminalSession.sessionId)}
                                className="rounded-md border border-red-400/25 bg-red-500/8 px-3 py-1.5 text-[11px] font-medium text-red-300 transition-colors hover:bg-red-500/12 hover:text-red-200"
                            >
                                Stop
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={onRefresh}
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
                            style={{ backgroundColor: terminalBackgroundColor }}
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
    )
}
