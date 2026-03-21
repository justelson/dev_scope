import { cn } from '@/lib/utils'
import { formatRelativeShort, formatTerminalShellLabel, getTerminalPreviewLine } from './tasks-formatters'
import type { DevScopePreviewTerminalSessionSummary } from '@shared/contracts/devscope-api'

type OperationsPanelProps = {
    initialLoading: boolean
    terminalSessions: DevScopePreviewTerminalSessionSummary[]
    sortedTerminalSessions: DevScopePreviewTerminalSessionSummary[]
    terminalSessionGroupsCount: number
    runningTerminalCount: number
    onOpenTerminalTab: () => void
    onOpenTerminalSession: (sessionId: string) => void
    onStopPreviewTerminal: (sessionId: string) => void
}

export function OperationsPanel({
    initialLoading,
    terminalSessions,
    sortedTerminalSessions,
    terminalSessionGroupsCount,
    runningTerminalCount,
    onOpenTerminalTab,
    onOpenTerminalSession,
    onStopPreviewTerminal
}: OperationsPanelProps) {
    return (
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
                            onClick={onOpenTerminalTab}
                            className="rounded-md border border-sky-400/25 bg-sky-500/10 px-2.5 py-1 text-sky-200 transition-colors hover:bg-sky-500/15"
                        >
                            Open Terminal Tab
                        </button>
                        <span className="rounded-full border border-emerald-400/30 bg-emerald-500/10 px-2.5 py-1 text-emerald-300">
                            {runningTerminalCount} running
                        </span>
                        <span className="rounded-full border border-sparkle-border bg-sparkle-card px-2.5 py-1 text-sparkle-text-secondary">
                            {terminalSessionGroupsCount} group{terminalSessionGroupsCount === 1 ? '' : 's'}
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
                                        onClick={() => onOpenTerminalSession(session.sessionId)}
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
                                                    void onStopPreviewTerminal(session.sessionId)
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
    )
}
