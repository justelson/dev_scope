import type { RefObject } from 'react'
import {
    CircleAlert,
    CircleCheckBig,
    Folder,
    FolderOpen,
    Plus,
    RefreshCw,
    SquareTerminal,
    Terminal,
    X
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatRelativeShort, formatTerminalShellLabel } from './tasks-formatters'
import type { PreviewTerminalSessionGroup } from './tasks-types'
import type { DevScopePreviewTerminalSessionSummary } from '@shared/contracts/devscope-api'

type TerminalSessionsPanelProps = {
    terminalSessions: DevScopePreviewTerminalSessionSummary[]
    terminalSessionGroups: PreviewTerminalSessionGroup[]
    selectedTerminalSessionId: string
    selectedTerminalSession: DevScopePreviewTerminalSessionSummary | null
    tasksTerminalHostRef: RefObject<HTMLDivElement | null>
    terminalBackgroundColor: string
    refreshing: boolean
    onCreateTerminal: () => void
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
    refreshing,
    onCreateTerminal,
    onCreateTerminalForPath,
    onSelectTerminalSession,
    onStopPreviewTerminal,
    onRefresh
}: TerminalSessionsPanelProps) {
    const selectedGroupKey = selectedTerminalSession
        ? String(selectedTerminalSession.groupKey || selectedTerminalSession.cwd || selectedTerminalSession.sessionId)
        : ''
    const selectedGroup = terminalSessionGroups.find((group) => group.groupKey === selectedGroupKey) || terminalSessionGroups[0] || null
    const visibleSessions = selectedGroup?.sessions || []

    return (
        <div className="grid h-[calc(100vh-236px)] min-h-[520px] max-h-[calc(100vh-236px)] grid-cols-1 gap-4 overflow-hidden xl:grid-cols-[230px_minmax(0,1fr)]">
            <div className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-white/10 bg-sparkle-card">
                <div className="border-b border-white/5 bg-sparkle-bg/45 px-3 py-2.5">
                    <div className="flex items-center justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-2">
                            <SquareTerminal size={15} className="shrink-0 text-sky-300" />
                            <h2 className="text-sm font-semibold text-sparkle-text">Folders</h2>
                            <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-white/[0.05] px-1.5 text-[10px] text-sparkle-text-secondary">
                                {terminalSessions.length}
                            </span>
                        </div>
                        <ToolbarIconButton
                            title="New terminal"
                            ariaLabel="Create terminal"
                            onClick={onCreateTerminal}
                            icon={<Plus size={14} />}
                        />
                    </div>
                </div>

                <div className="custom-scrollbar min-h-0 flex-1 space-y-2 overflow-y-auto overflow-x-hidden p-2">
                    {terminalSessionGroups.length === 0 ? (
                        <div className="flex flex-col items-center rounded-xl border border-dashed border-white/10 bg-sparkle-bg/35 px-4 py-7 text-center">
                            <div className="rounded-lg bg-white/[0.04] p-2">
                                <Terminal size={18} className="text-sparkle-text-secondary" />
                            </div>
                            <div className="mt-3 text-sm font-medium text-sparkle-text">No terminals</div>
                            <button
                                type="button"
                                onClick={onCreateTerminal}
                                className="mt-3 inline-flex items-center gap-2 rounded-lg border border-[var(--accent-primary)]/25 bg-[var(--accent-primary)]/10 px-3 py-2 text-xs font-medium text-[var(--accent-primary)] transition-all hover:border-[var(--accent-primary)]/35 hover:bg-[var(--accent-primary)]/15"
                            >
                                <Plus size={14} />
                                Start terminal
                            </button>
                        </div>
                    ) : (
                        terminalSessionGroups.map((group) => {
                            const isActiveGroup = group.groupKey === selectedGroup?.groupKey
                            const nextSessionId = group.sessions[0]?.sessionId || ''
                            const runningCount = group.sessions.filter((session) => session.status === 'running').length

                            return (
                                <section
                                    key={group.groupKey}
                                    className={cn(
                                        'overflow-hidden rounded-xl border transition-colors',
                                        isActiveGroup
                                            ? 'border-sky-400/30 bg-sky-500/10'
                                            : 'border-white/8 bg-sparkle-bg/38 hover:border-white/12 hover:bg-white/[0.04]'
                                    )}
                                >
                                    <div className="flex items-center gap-2 px-2 py-2">
                                        <button
                                            type="button"
                                            onClick={() => onSelectTerminalSession(nextSessionId)}
                                            title={group.cwd}
                                            className="flex min-w-0 flex-1 items-center gap-2 text-left"
                                        >
                                            <Folder size={13} className={cn('shrink-0', isActiveGroup ? 'text-sky-300' : 'text-amber-300')} />
                                            <div className="min-w-0">
                                                <div className="truncate text-[11px] font-medium text-sparkle-text">
                                                    {getPathTail(group.cwd)}
                                                </div>
                                                <div className="mt-0.5 flex items-center gap-1.5 text-[10px] text-sparkle-text-muted">
                                                    <span>{group.sessions.length} tab{group.sessions.length === 1 ? '' : 's'}</span>
                                                    {runningCount > 0 ? (
                                                        <span className="inline-flex items-center gap-1 text-emerald-300">
                                                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />
                                                            {runningCount}
                                                        </span>
                                                    ) : null}
                                                </div>
                                            </div>
                                        </button>

                                        <ToolbarIconButton
                                            title={`New terminal in ${group.cwd}`}
                                            ariaLabel={`New terminal in ${group.cwd}`}
                                            onClick={() => onCreateTerminalForPath(group.cwd)}
                                            icon={<Plus size={13} />}
                                            compact
                                        />
                                    </div>
                                </section>
                            )
                        })
                    )}
                </div>
            </div>

            <div className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-white/10 bg-sparkle-card">
                <div className="border-b border-white/5 bg-sparkle-bg/45">
                    <div className="flex items-center justify-between gap-3 px-3 py-2">
                        <div className="custom-scrollbar min-w-0 flex-1 overflow-x-auto overflow-y-hidden">
                            <div className="flex w-max min-w-full items-center gap-1.5 pr-2">
                                {visibleSessions.length > 0 ? visibleSessions.map((session) => {
                                    const isSelected = session.sessionId === selectedTerminalSessionId

                                    return (
                                        <button
                                            key={session.sessionId}
                                            type="button"
                                            onClick={() => onSelectTerminalSession(session.sessionId)}
                                            className={cn(
                                                'inline-flex h-8 max-w-[220px] items-center gap-2 rounded-lg border px-2.5 text-xs transition-colors',
                                                isSelected
                                                    ? 'border-sky-400/30 bg-sky-500/12 text-sparkle-text'
                                                    : 'border-transparent bg-white/[0.03] text-sparkle-text-secondary hover:border-white/10 hover:bg-white/[0.05] hover:text-sparkle-text'
                                            )}
                                        >
                                            <span className={cn('h-2 w-2 shrink-0 rounded-full', getTerminalStatusDotClass(session.status))} />
                                            <Terminal size={12} className="shrink-0" />
                                            <span className="truncate font-medium">
                                                {session.title}
                                            </span>
                                        </button>
                                    )
                                }) : (
                                    <div className="inline-flex h-8 items-center rounded-lg bg-white/[0.03] px-2.5 text-xs text-sparkle-text-muted">
                                        No terminals
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            <ToolbarIconButton
                                title="New terminal"
                                ariaLabel="Create terminal"
                                onClick={onCreateTerminal}
                                icon={<Plus size={14} />}
                            />
                            {selectedTerminalSession ? (
                                <ToolbarIconButton
                                    title="Stop terminal"
                                    ariaLabel="Stop selected terminal"
                                    onClick={() => onStopPreviewTerminal(selectedTerminalSession.sessionId)}
                                    icon={<X size={14} />}
                                    tone="danger"
                                />
                            ) : null}
                            <ToolbarIconButton
                                title="Refresh terminals"
                                ariaLabel="Refresh terminals"
                                onClick={onRefresh}
                                icon={<RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />}
                            />
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 px-3 pb-2">
                        <div className="inline-flex max-w-full items-center gap-2 rounded-md bg-white/[0.03] px-2 py-1 text-[11px] text-sparkle-text-secondary">
                            <FolderOpen size={12} className="shrink-0 text-sparkle-text-muted" />
                            <span className="truncate font-mono">
                                {selectedTerminalSession?.cwd || 'Pick a terminal'}
                            </span>
                        </div>
                        {selectedTerminalSession ? (
                            <>
                                <span className="rounded-md bg-white/[0.04] px-1.5 py-0.5 text-[10px] uppercase tracking-[0.16em] text-sparkle-text-muted">
                                    {formatTerminalShellLabel(selectedTerminalSession.shell)}
                                </span>
                                <StatusPill session={selectedTerminalSession} />
                                <MetaPill>{formatRelativeShort(selectedTerminalSession.lastActivityAt)}</MetaPill>
                            </>
                        ) : null}
                        {selectedGroup && selectedGroup.sessions.length > 1 ? (
                            <MetaPill>{selectedGroup.sessions.length} tabs</MetaPill>
                        ) : null}
                    </div>
                </div>

                <div className="min-h-0 flex-1 overflow-hidden p-3">
                    {selectedTerminalSession ? (
                        <div
                            ref={tasksTerminalHostRef}
                            className="h-full w-full overflow-hidden rounded-xl border border-white/10 focus-within:border-[var(--accent-primary)]/60 focus-within:shadow-[0_0_0_1px_rgba(56,189,248,0.2)]"
                            style={{ backgroundColor: terminalBackgroundColor }}
                        />
                    ) : (
                        <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-white/10 bg-sparkle-bg/35 px-6 text-center">
                            <div className="flex max-w-md flex-col items-center">
                                <div className="rounded-xl bg-white/[0.04] p-3">
                                    <FolderOpen size={20} className="text-sparkle-text-secondary" />
                                </div>
                                <div className="mt-3 text-sm font-medium text-sparkle-text">Open a terminal</div>
                                <button
                                    type="button"
                                    onClick={onCreateTerminal}
                                    className="mt-3 inline-flex items-center gap-2 rounded-lg border border-[var(--accent-primary)]/25 bg-[var(--accent-primary)]/10 px-3 py-2 text-xs font-medium text-[var(--accent-primary)] transition-all hover:border-[var(--accent-primary)]/35 hover:bg-[var(--accent-primary)]/15"
                                >
                                    <Plus size={14} />
                                    Start terminal
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}

function ToolbarIconButton({
    title,
    ariaLabel,
    onClick,
    icon,
    compact = false,
    tone = 'default'
}: {
    title: string
    ariaLabel: string
    onClick: () => void
    icon: React.ReactNode
    compact?: boolean
    tone?: 'default' | 'danger'
}) {
    return (
        <button
            type="button"
            title={title}
            aria-label={ariaLabel}
            onClick={onClick}
            className={cn(
                'inline-flex shrink-0 items-center justify-center rounded-lg border transition-colors',
                compact ? 'h-6 w-6' : 'h-8 w-8',
                tone === 'danger'
                    ? 'border-red-400/20 bg-red-500/8 text-red-300 hover:border-red-400/30 hover:bg-red-500/14 hover:text-red-200'
                    : 'border-white/10 bg-white/[0.03] text-sparkle-text-secondary hover:border-white/20 hover:bg-white/[0.05] hover:text-sparkle-text'
            )}
        >
            {icon}
        </button>
    )
}

function MetaPill({ children }: { children: React.ReactNode }) {
    return (
        <span className="rounded-md bg-white/[0.04] px-1.5 py-0.5 text-[10px] text-sparkle-text-muted">
            {children}
        </span>
    )
}

function StatusPill({ session }: { session: DevScopePreviewTerminalSessionSummary }) {
    if (session.status === 'running') {
        return (
            <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/10 px-1.5 py-0.5 text-[10px] uppercase tracking-[0.14em] text-emerald-300">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />
                Live
            </span>
        )
    }

    if (session.status === 'error') {
        return (
            <span className="inline-flex items-center gap-1 rounded-md bg-red-500/10 px-1.5 py-0.5 text-[10px] uppercase tracking-[0.14em] text-red-300">
                <CircleAlert size={10} />
                Error
            </span>
        )
    }

    return (
        <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/10 px-1.5 py-0.5 text-[10px] uppercase tracking-[0.14em] text-amber-300">
            <CircleCheckBig size={10} />
            Done
        </span>
    )
}

function getTerminalStatusDotClass(status: DevScopePreviewTerminalSessionSummary['status']): string {
    if (status === 'running') return 'bg-emerald-300'
    if (status === 'error') return 'bg-red-300'
    return 'bg-amber-300'
}

function getPathTail(path: string): string {
    const normalized = String(path || '').trim().replace(/[\\/]+$/, '')
    if (!normalized) return path
    const parts = normalized.split(/[/\\]/)
    return parts[parts.length - 1] || normalized
}
