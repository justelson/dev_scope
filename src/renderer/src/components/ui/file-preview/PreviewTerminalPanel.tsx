import type { RefObject } from 'react'
import { cn } from '@/lib/utils'
import { formatRelativeActivity, PREVIEW_TERMINAL_MIN_HEIGHT, TERMINAL_PANEL_ANIMATION_MS, type PreviewTerminalSessionItem, type PreviewTerminalState, type TerminalPanelPhase } from './modalShared'

type PreviewTerminalPanelProps = {
    render: boolean
    phase: TerminalPanelPhase
    height: number
    state: PreviewTerminalState
    shellLabel: string
    sessions: PreviewTerminalSessionItem[]
    groupKey: string
    groupCwd: string
    sessionCwd: string
    projectPath?: string
    filePath: string
    currentSession: PreviewTerminalSessionItem | null
    themeBackground: string
    hostRef: RefObject<HTMLDivElement | null>
    onHostInteract: () => void
    error: string | null
    onResizeStart: (event: { preventDefault: () => void; clientY: number }) => void
    onNew: () => void
    onClear: () => void
    onRestart: () => void
    onStop: (sessionId?: string) => void
    onMinimize: () => void
    onSelect: (sessionId: string) => void
}

export function PreviewTerminalPanel({
    render,
    phase,
    height,
    state,
    shellLabel,
    sessions,
    groupKey,
    groupCwd,
    sessionCwd,
    projectPath,
    filePath,
    currentSession,
    themeBackground,
    hostRef,
    onHostInteract,
    error,
    onResizeStart,
    onNew,
    onClear,
    onRestart,
    onStop,
    onMinimize,
    onSelect
}: PreviewTerminalPanelProps) {
    if (!render) return null

    const statusDotClass = (
        state === 'active'
            ? 'bg-emerald-300'
            : state === 'connecting'
                ? 'bg-sky-300'
                : state === 'error'
                    ? 'bg-red-300'
                    : state === 'exited'
                        ? 'bg-amber-300'
                        : 'bg-sparkle-text-secondary'
    )

    return (
        <div className={cn('border-t border-sparkle-border bg-sparkle-card/90 backdrop-blur-sm flex flex-col transition-[opacity,transform] ease-out', phase === 'visible' ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2 pointer-events-none')} style={{ height: `${Math.max(PREVIEW_TERMINAL_MIN_HEIGHT, height)}px`, transitionDuration: `${TERMINAL_PANEL_ANIMATION_MS}ms` }}>
            <div onMouseDown={onResizeStart} className="group relative h-2 cursor-row-resize bg-transparent hover:bg-[var(--accent-primary)]/12 transition-colors" title="Resize terminal">
                <div className="pointer-events-none absolute left-1/2 top-1/2 h-[2px] w-12 -translate-x-1/2 -translate-y-1/2 rounded-full bg-sparkle-border-secondary/70 group-hover:bg-[var(--accent-primary)]/65 transition-colors" />
            </div>
            <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-sparkle-border-secondary">
                <div className="min-w-0 flex-1">
                    <div className="text-xs font-medium text-sparkle-text flex items-center gap-1.5">
                        <span className={cn('inline-block h-2 w-2 rounded-full', statusDotClass)} />
                        <span>Terminal</span>
                        <span className="rounded-md border border-amber-400/30 bg-amber-500/10 px-1.5 py-0.5 text-[9px] uppercase tracking-[0.16em] text-amber-200">Beta</span>
                        <span className="rounded-md border border-sparkle-border bg-sparkle-bg/60 px-1.5 py-0.5 text-[9px] uppercase tracking-[0.16em] text-sparkle-text-muted">{shellLabel}</span>
                        <span className="rounded-md border border-sparkle-border bg-sparkle-bg/60 px-1.5 py-0.5 text-[9px] uppercase tracking-[0.16em] text-sparkle-text-muted">{sessions.length} session{sessions.length === 1 ? '' : 's'}</span>
                        {groupKey && <span className="rounded-md border border-sparkle-border bg-sparkle-bg/60 px-1.5 py-0.5 text-[9px] uppercase tracking-[0.16em] text-sparkle-text-muted">linked</span>}
                    </div>
                    <div className="text-[10px] text-sparkle-text-muted truncate">{groupCwd || sessionCwd || projectPath || filePath}</div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0 rounded-lg border border-sparkle-border bg-sparkle-bg/40 p-1">
                    <button type="button" onClick={onNew} className="rounded-md px-2 py-1 text-[10px] text-sparkle-text-secondary hover:bg-sparkle-card-hover hover:text-sparkle-text transition-colors">New</button>
                    <button type="button" onClick={onClear} className="rounded-md px-2 py-1 text-[10px] text-sparkle-text-secondary hover:bg-sparkle-card-hover hover:text-sparkle-text transition-colors">Clear</button>
                    <button type="button" onClick={onRestart} disabled={!currentSession} className="rounded-md px-2 py-1 text-[10px] text-sparkle-text-secondary hover:bg-sparkle-card-hover hover:text-sparkle-text transition-colors disabled:opacity-40 disabled:cursor-not-allowed">Restart</button>
                    <button type="button" onClick={() => onStop()} disabled={!currentSession} className="rounded-md px-2 py-1 text-[10px] text-red-300 hover:bg-red-500/10 hover:text-red-200 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">Stop</button>
                    <button type="button" onClick={onMinimize} className="rounded-md px-2 py-1 text-[10px] text-sparkle-text-secondary hover:bg-sparkle-card-hover hover:text-sparkle-text transition-colors">Hide panel</button>
                </div>
            </div>
            <div className="flex-1 min-h-0 p-2">
                <div className="flex h-full min-h-0 gap-2">
                    <div className="min-w-0 flex-1 rounded-md border border-sparkle-border-secondary bg-sparkle-bg/40 p-2">
                        <div className="mb-2 flex items-center justify-between gap-2">
                            <div className="min-w-0">
                                <div className="text-[11px] font-medium text-sparkle-text truncate">{currentSession?.title || (sessions.length > 0 ? 'Select a terminal session' : 'No terminal session')}</div>
                                <div className="text-[10px] text-sparkle-text-muted truncate">{currentSession ? (sessionCwd || groupCwd || projectPath || filePath) : (groupCwd || projectPath || filePath)}</div>
                            </div>
                            <div className="text-[10px] text-sparkle-text-muted shrink-0">{currentSession ? `${currentSession.status} / ${formatRelativeActivity(currentSession.lastActivityAt)} ago` : ''}</div>
                        </div>
                        {currentSession ? (
                            <div onMouseDownCapture={onHostInteract} ref={hostRef} className="h-[calc(100%-2.25rem)] w-full overflow-hidden rounded-md border border-sparkle-border-secondary focus-within:border-[var(--accent-primary)]/60 focus-within:shadow-[0_0_0_1px_rgba(56,189,248,0.2)]" style={{ backgroundColor: themeBackground }} />
                        ) : (
                            <div className="flex h-[calc(100%-2.25rem)] w-full items-center justify-center rounded-md border border-dashed border-sparkle-border-secondary bg-black/15 px-6 text-center">
                                <div className="max-w-sm space-y-3">
                                    <div className="text-sm font-medium text-sparkle-text">{sessions.length > 0 ? 'Choose a session to continue' : 'No terminal is open'}</div>
                                    <div className="text-xs leading-relaxed text-sparkle-text-secondary">{sessions.length > 0 ? 'Pick a session from the sidebar to attach it here, or start a fresh shell for this directory.' : 'Start a new shell for this file or project. The session will stay grouped here and can be managed from Tasks.'}</div>
                                    <div className="flex items-center justify-center gap-2">
                                        <button type="button" onClick={onNew} className="rounded-md border border-sky-400/30 bg-sky-500/10 px-3 py-1.5 text-[11px] font-medium text-sky-200 transition-colors hover:bg-sky-500/15">New Session</button>
                                        {sessions.length > 0 && <button type="button" onClick={() => onSelect(sessions[0]?.sessionId || '')} className="rounded-md border border-sparkle-border px-3 py-1.5 text-[11px] font-medium text-sparkle-text-secondary transition-colors hover:bg-sparkle-card-hover hover:text-sparkle-text">Select First</button>}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                    <aside className="flex w-[220px] shrink-0 flex-col rounded-md border border-sparkle-border-secondary bg-sparkle-bg/55">
                        <div className="border-b border-sparkle-border-secondary px-3 py-2">
                            <div className="text-[11px] font-medium text-sparkle-text">Session Group</div>
                            <div className="mt-1 text-[10px] text-sparkle-text-muted truncate">{groupCwd || projectPath || filePath}</div>
                        </div>
                        <div className="flex-1 min-h-0 overflow-auto custom-scrollbar p-2 space-y-2">
                            {sessions.length === 0 ? (
                                <div className="rounded-md border border-dashed border-sparkle-border-secondary px-3 py-4 text-center text-[11px] text-sparkle-text-muted">No sessions yet</div>
                            ) : sessions.map((session) => {
                                const isActive = session.sessionId === currentSession?.sessionId
                                const sessionStatusClass = session.status === 'running' ? 'bg-emerald-300' : session.status === 'error' ? 'bg-red-300' : 'bg-amber-300'
                                const sessionPreview = String(session.recentOutput || '').trim().split(/\r?\n/).filter(Boolean).slice(-1)[0] || session.cwd
                                return (
                                    <div key={session.sessionId} className={cn('rounded-lg border p-2 transition-colors', isActive ? 'border-sky-400/35 bg-sky-500/12' : 'border-sparkle-border bg-sparkle-card/60 hover:border-sparkle-border-secondary hover:bg-sparkle-card-hover/60')}>
                                        <div className="flex items-start justify-between gap-2">
                                            <button type="button" onClick={() => onSelect(session.sessionId)} className="min-w-0 flex-1 text-left">
                                                <div className="flex items-center gap-1.5">
                                                    <span className={cn('inline-block h-2 w-2 rounded-full shrink-0', sessionStatusClass)} />
                                                    <span className="truncate text-[11px] font-medium text-sparkle-text">{session.title}</span>
                                                    {session.hasUnreadOutput && !isActive && <span className="h-1.5 w-1.5 rounded-full bg-sky-300 shrink-0" />}
                                                </div>
                                                <div className="mt-1 truncate text-[10px] text-sparkle-text-muted">{session.shell.replace(/\.exe$/i, '')} · {formatRelativeActivity(session.lastActivityAt)} ago</div>
                                                <div className="mt-1 truncate text-[10px] text-sparkle-text-secondary/90">{sessionPreview}</div>
                                            </button>
                                            <button type="button" onClick={() => onStop(session.sessionId)} className="rounded-md px-1.5 py-1 text-[10px] text-red-300 hover:bg-red-500/10 hover:text-red-200 transition-colors" title="Stop session">Stop</button>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </aside>
                </div>
            </div>
            {error && <div className="px-3 pb-2 text-[10px] text-red-300 truncate">{error}</div>}
        </div>
    )
}
