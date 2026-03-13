import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import {
    Archive,
    ArchiveRestore,
    ChevronRight,
    Edit2,
    FolderOpen,
    MessageSquarePlus,
    Trash2
} from 'lucide-react'
import type { AssistantSession } from '@shared/assistant/contracts'
import { AnimatedHeight } from '@/components/ui/AnimatedHeight'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { cn } from '@/lib/utils'
import { formatAssistantRelativeTime } from '@/lib/assistant/selectors'

type AssistantSessionsRailProps = {
    collapsed: boolean
    width: number
    compact?: boolean
    sessions: AssistantSession[]
    activeSessionId: string | null
    commandPending: boolean
    onSetCollapsed: (collapsed: boolean) => void
    onWidthChange?: (width: number) => void
    onCreateSession: () => Promise<void>
    onSelectSession: (sessionId: string) => Promise<void>
    onRenameSession: (sessionId: string, title: string) => Promise<void>
    onArchiveSession: (sessionId: string, archived?: boolean) => Promise<void>
    onDeleteSession: (sessionId: string) => Promise<void>
}

type SessionProjectGroup = {
    key: string
    label: string
    path: string
    updatedAt: string
    sessions: AssistantSession[]
}

const NO_PROJECT_KEY = '__assistant-no-project__'

function normalizeProjectPath(value?: string | null): string {
    return String(value || '').trim()
}

function getProjectKey(path: string): string {
    return path || NO_PROJECT_KEY
}

function getProjectLabel(path: string): string {
    if (!path) return 'No Directory'
    const parts = path.split(/[\\/]/).filter(Boolean)
    return parts[parts.length - 1] || path
}

function getDisplayTitle(title: string): string {
    const trimmed = String(title || '').trim()
    return trimmed || 'Untitled Session'
}

function getSortableTimestamp(value: string): number {
    const timestamp = Date.parse(value)
    return Number.isFinite(timestamp) ? timestamp : 0
}

function groupSessionsByProject(sessions: AssistantSession[]): SessionProjectGroup[] {
    const groups = new Map<string, SessionProjectGroup>()

    for (const session of sessions) {
        const normalizedPath = normalizeProjectPath(session.projectPath)
        const key = getProjectKey(normalizedPath)
        const existing = groups.get(key)

        if (!existing) {
            groups.set(key, {
                key,
                label: getProjectLabel(normalizedPath),
                path: normalizedPath,
                updatedAt: session.updatedAt,
                sessions: [session]
            })
            continue
        }

        existing.sessions.push(session)
        if (getSortableTimestamp(session.updatedAt) > getSortableTimestamp(existing.updatedAt)) {
            existing.updatedAt = session.updatedAt
        }
    }

    return Array.from(groups.values())
        .map((group) => ({
            ...group,
            sessions: [...group.sessions].sort((left, right) =>
                getSortableTimestamp(right.updatedAt) - getSortableTimestamp(left.updatedAt)
            )
        }))
        .sort((left, right) => getSortableTimestamp(right.updatedAt) - getSortableTimestamp(left.updatedAt))
}

export function AssistantSessionsRail({
    collapsed,
    width,
    compact = false,
    sessions,
    activeSessionId,
    commandPending,
    onSetCollapsed,
    onWidthChange,
    onCreateSession,
    onSelectSession,
    onRenameSession,
    onArchiveSession,
    onDeleteSession
}: AssistantSessionsRailProps) {
    const [renameTarget, setRenameTarget] = useState<AssistantSession | null>(null)
    const [renameDraft, setRenameDraft] = useState('')
    const [sessionToDelete, setSessionToDelete] = useState<AssistantSession | null>(null)
    const [expandedGroupKeys, setExpandedGroupKeys] = useState<Set<string>>(new Set())
    const [showArchivedSessions, setShowArchivedSessions] = useState(false)

    const activeSessions = useMemo(
        () => sessions.filter((session) => !session.archived),
        [sessions]
    )
    const archivedSessions = useMemo(
        () => sessions.filter((session) => session.archived),
        [sessions]
    )
    const groupedSessions = useMemo(() => groupSessionsByProject(activeSessions), [activeSessions])
    const groupedArchivedSessions = useMemo(() => groupSessionsByProject(archivedSessions), [archivedSessions])

    useEffect(() => {
        if (!activeSessionId) return
        if (archivedSessions.some((session) => session.id === activeSessionId)) {
            setShowArchivedSessions(true)
        }
    }, [activeSessionId, archivedSessions])

    useEffect(() => {
        setExpandedGroupKeys((prev) => {
            const validKeys = new Set(groupedSessions.map((group) => group.key))
            const next = new Set(Array.from(prev).filter((key) => validKeys.has(key)))

            for (const group of groupedSessions.slice(0, 2)) {
                if (!prev.has(group.key)) next.add(group.key)
            }

            if (activeSessionId) {
                const activeGroup = groupedSessions.find((group) =>
                    group.sessions.some((session) => session.id === activeSessionId)
                )
                if (activeGroup) next.add(activeGroup.key)
            }

            return next
        })
    }, [activeSessionId, groupedSessions])

    const toggleGroup = (key: string) => {
        setExpandedGroupKeys((prev) => {
            const next = new Set(prev)
            if (next.has(key)) next.delete(key)
            else next.add(key)
            return next
        })
    }

    const openRenameModal = (session: AssistantSession) => {
        setRenameTarget(session)
        setRenameDraft(getDisplayTitle(session.title))
    }

    const closeRenameModal = () => {
        setRenameTarget(null)
        setRenameDraft('')
    }

    const submitRename = async () => {
        if (!renameTarget) return
        const normalized = renameDraft.trim()
        if (!normalized) return
        await onRenameSession(renameTarget.id, normalized)
        closeRenameModal()
    }

    const minSidebarWidth = 180
    const maxSidebarWidth = compact ? 420 : 520
    const resolvedWidth = Math.max(minSidebarWidth, Math.min(maxSidebarWidth, Math.round(width)))

    const handleResizeStart = (event: React.MouseEvent<HTMLDivElement>) => {
        if (collapsed || !onWidthChange) return
        event.preventDefault()
        event.stopPropagation()

        const startX = event.clientX
        const startWidth = resolvedWidth
        document.body.style.cursor = 'col-resize'
        document.body.style.userSelect = 'none'

        const handleMove = (moveEvent: MouseEvent) => {
            const next = Math.max(minSidebarWidth, Math.min(maxSidebarWidth, Math.round(startWidth + (moveEvent.clientX - startX))))
            onWidthChange(next)
        }

        const handleUp = () => {
            document.body.style.cursor = ''
            document.body.style.userSelect = ''
            window.removeEventListener('mousemove', handleMove)
            window.removeEventListener('mouseup', handleUp)
        }

        window.addEventListener('mousemove', handleMove)
        window.addEventListener('mouseup', handleUp)
    }

    const renderSessionRow = (session: AssistantSession, archived = false) => {
        const isActive = session.id === activeSessionId
        const timeLabel = formatAssistantRelativeTime(session.updatedAt)

        return (
            <div
                key={session.id}
                className={cn(
                    'group relative flex items-center rounded-md border transition-colors',
                    compact ? 'gap-2 px-2 py-2' : 'gap-3 px-3 py-2.5',
                    isActive
                        ? 'border-[var(--accent-primary)]/35 bg-[var(--accent-primary)]/12 text-[var(--accent-primary)]'
                        : 'border-sparkle-border bg-sparkle-bg text-sparkle-text-muted hover:bg-sparkle-card-hover'
                )}
            >
                <button
                    type="button"
                    onClick={() => void onSelectSession(session.id)}
                    className="flex min-w-0 flex-1 items-center gap-3 text-left"
                    title={session.projectPath || undefined}
                >
                    <span
                        className={cn(
                            'h-1.5 w-1.5 shrink-0 rounded-full',
                            isActive ? 'bg-[var(--accent-primary)]' : 'bg-sparkle-text-muted/35'
                        )}
                    />
                    <div className="min-w-0 flex-1">
                        <div className={cn('truncate font-medium', compact ? 'text-[12px]' : 'text-[13px]')}>
                            {getDisplayTitle(session.title)}
                        </div>
                        <div className="truncate text-[10px] text-sparkle-text-muted">
                            {session.projectPath || 'No directory'}
                        </div>
                    </div>
                    <span className="shrink-0 rounded-[4px] border border-sparkle-border bg-sparkle-card px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wide text-sparkle-text-muted">
                        {timeLabel}
                    </span>
                </button>

                <div className="absolute right-1 top-1/2 hidden -translate-y-1/2 items-center gap-0.5 rounded-md border border-sparkle-border bg-sparkle-bg p-0.5 shadow-sm group-hover:flex">
                    {!archived && (
                        <>
                            <button
                                type="button"
                                onClick={(event) => {
                                    event.stopPropagation()
                                    openRenameModal(session)
                                }}
                                className="rounded p-1 text-sparkle-text-secondary/50 transition-colors hover:bg-sparkle-card-hover hover:text-sparkle-text"
                                title="Rename session"
                            >
                                <Edit2 size={12} />
                            </button>
                            <button
                                type="button"
                                onClick={(event) => {
                                    event.stopPropagation()
                                    void onArchiveSession(session.id, true)
                                }}
                                className="rounded p-1 text-sparkle-text-secondary/50 transition-colors hover:bg-amber-500/10 hover:text-amber-300"
                                title="Archive session"
                            >
                                <Archive size={12} />
                            </button>
                        </>
                    )}
                    {archived && (
                        <button
                            type="button"
                            onClick={(event) => {
                                event.stopPropagation()
                                void onArchiveSession(session.id, false)
                            }}
                            className="rounded p-1 text-sparkle-text-secondary/50 transition-colors hover:bg-emerald-500/10 hover:text-emerald-300"
                            title="Restore session"
                        >
                            <ArchiveRestore size={12} />
                        </button>
                    )}
                    <button
                        type="button"
                        onClick={(event) => {
                            event.stopPropagation()
                            setSessionToDelete(session)
                        }}
                        className="rounded p-1 text-sparkle-text-secondary/50 transition-colors hover:bg-red-500/10 hover:text-red-500"
                        title="Delete session"
                    >
                        <Trash2 size={13} />
                    </button>
                </div>
            </div>
        )
    }

    return (
        <aside
            className={cn(
                'relative h-full shrink-0 overflow-x-hidden border-r border-sparkle-border bg-sparkle-card transition-[width] duration-300',
                collapsed ? (compact ? 'w-14' : 'w-16') : (compact ? 'w-64' : 'w-72')
            )}
            style={!collapsed ? { width: resolvedWidth } : undefined}
        >
            {!collapsed && (
                <div
                    role="separator"
                    aria-orientation="vertical"
                    onMouseDown={handleResizeStart}
                    className="absolute right-0 top-0 z-30 h-full w-1.5 cursor-col-resize bg-transparent transition-colors hover:bg-sparkle-border"
                    title="Resize assistant sidebar"
                />
            )}

            {collapsed ? (
                <div className={cn('relative z-10 flex h-full flex-col items-center px-2 pb-4 pt-4', compact ? 'gap-3' : 'gap-4')}>
                    <button
                        type="button"
                        onClick={() => onSetCollapsed(false)}
                        className="rounded-lg p-1.5 text-sparkle-text-secondary/70 transition-all hover:bg-sparkle-card-hover hover:text-sparkle-text"
                        title="Expand sidebar"
                    >
                        <ChevronRight size={18} />
                    </button>

                    <button
                        type="button"
                        onClick={() => void onCreateSession()}
                        disabled={commandPending}
                        className={cn(
                            'group relative flex items-center justify-center rounded-md border border-transparent text-sparkle-text-secondary transition-colors hover:border-sparkle-border hover:bg-sparkle-bg hover:text-sparkle-text',
                            compact ? 'h-8 w-8' : 'h-9 w-9'
                        )}
                        title="New chat"
                    >
                        <MessageSquarePlus size={compact ? 16 : 18} />
                    </button>

                    <div className={cn('my-1 flex flex-col items-center gap-1.5', compact ? 'w-7' : 'w-8')}>
                        <div className="h-px w-full bg-sparkle-border" />
                    </div>

                    <div className={cn('flex w-full flex-1 flex-col items-center overflow-y-auto pb-2 pt-1 no-scrollbar', compact ? 'gap-2' : 'gap-2.5')}>
                        {groupedSessions.map((group) => {
                            const primarySession = group.sessions[0]
                            const hasActive = group.sessions.some((session) => session.id === activeSessionId)
                            if (!primarySession) return null

                            return (
                                <button
                                    key={group.key}
                                    type="button"
                                    onClick={() => void onSelectSession(primarySession.id)}
                                    title={group.path || 'No directory'}
                                    className={cn(
                                        'relative flex items-center justify-center rounded-md border text-[10px] font-bold transition-all duration-200 focus:outline-none',
                                        compact ? 'h-7 w-7' : 'h-8 w-8',
                                        hasActive
                                            ? 'border-2 border-[var(--accent-primary)] bg-[var(--accent-primary)]/22 text-[var(--accent-primary)] ring-1 ring-[var(--accent-primary)]/35'
                                            : 'border-sparkle-border bg-sparkle-bg text-sparkle-text-secondary hover:bg-sparkle-card-hover hover:text-sparkle-text'
                                    )}
                                >
                                    {group.label.charAt(0).toUpperCase() || 'D'}
                                </button>
                            )
                        })}
                    </div>
                </div>
            ) : (
                <div className={cn('relative z-10 flex h-full flex-col pb-4 pt-4', compact ? 'px-3' : 'px-4')}>
                    <div className="mb-4 border-b border-sparkle-border pb-4">
                        <div className="flex items-center justify-between gap-3">
                            <div>
                                <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-sparkle-text-muted">Projects</div>
                                <div className="mt-1 text-sm font-semibold text-sparkle-text">Assistant Chats</div>
                            </div>
                            <button
                                type="button"
                                onClick={() => onSetCollapsed(true)}
                                className="rounded-lg p-1.5 text-sparkle-text-secondary/70 transition-all hover:bg-sparkle-card-hover hover:text-sparkle-text"
                                title="Collapse sidebar"
                            >
                                <ChevronRight size={18} className="rotate-180" />
                            </button>
                        </div>

                        <button
                            type="button"
                            onClick={() => void onCreateSession()}
                            disabled={commandPending}
                            className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-sparkle-border bg-sparkle-bg px-3 py-2.5 text-sm font-medium text-sparkle-text-secondary transition-colors hover:bg-sparkle-card-hover hover:text-sparkle-text disabled:opacity-60"
                        >
                            <MessageSquarePlus size={16} />
                            New Chat
                        </button>
                    </div>

                    <div className="min-h-0 flex-1 overflow-y-auto pr-1 scrollbar-hide">
                        <div className="space-y-2">
                            {groupedSessions.map((group) => {
                                const isExpanded = expandedGroupKeys.has(group.key)

                                return (
                                    <section key={group.key} className="rounded-xl border border-sparkle-border bg-sparkle-bg/60">
                                        <button
                                            type="button"
                                            onClick={() => toggleGroup(group.key)}
                                            className="group flex w-full items-center gap-2 px-3 py-2.5 text-left transition-colors hover:bg-sparkle-card-hover/70"
                                        >
                                            <ChevronRight
                                                size={14}
                                                className={cn(
                                                    'text-sparkle-text-muted/70 transition-transform duration-300',
                                                    isExpanded && 'rotate-90'
                                                )}
                                            />
                                            <FolderOpen size={14} className="text-sparkle-text-secondary" />
                                            <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-sparkle-text-secondary group-hover:text-sparkle-text">
                                                {group.label}
                                            </span>
                                            <span className="rounded-[4px] border border-sparkle-border bg-sparkle-card px-1.5 py-0.5 font-mono text-[9px] text-sparkle-text-muted">
                                                {group.sessions.length}
                                            </span>
                                        </button>

                                        <AnimatedHeight isOpen={isExpanded} duration={350}>
                                            <div className={cn('ml-4 space-y-0.5 border-l border-sparkle-border pb-2 pt-1', compact ? 'pl-1.5' : 'pl-2')}>
                                                {group.sessions.map((session) => renderSessionRow(session))}
                                            </div>
                                        </AnimatedHeight>
                                    </section>
                                )
                            })}

                            {groupedSessions.length === 0 && (
                                <div className={cn('flex flex-col items-center gap-2 px-4 text-center', compact ? 'py-6' : 'py-8')}>
                                    <MessageSquarePlus size={compact ? 20 : 24} className="text-sparkle-text-muted/30" />
                                    <p className="text-xs text-sparkle-text-muted">No projects yet</p>
                                </div>
                            )}
                        </div>

                        {archivedSessions.length > 0 && (
                            <section className={cn('mt-4 border-t border-sparkle-border pt-2', compact ? 'space-y-0.5' : 'space-y-1')}>
                                <button
                                    type="button"
                                    onClick={() => setShowArchivedSessions((prev) => !prev)}
                                    className="group flex w-full items-center gap-2 px-1 py-1.5 text-left transition-colors"
                                >
                                    <Archive size={14} className="text-sparkle-text-muted/70" />
                                    <span className={cn('truncate font-semibold transition-colors flex-1 text-sparkle-text-secondary group-hover:text-sparkle-text', compact ? 'text-[12px]' : 'text-[13px]')}>
                                        Archived
                                    </span>
                                    <span className={cn('rounded-[4px] border border-sparkle-border bg-sparkle-card px-1.5 py-0.5 font-mono text-sparkle-text-muted', compact ? 'text-[8px]' : 'text-[9px]')}>
                                        {archivedSessions.length}
                                    </span>
                                    <ChevronRight
                                        size={14}
                                        className={cn(
                                            'text-sparkle-text-muted/70 transition-transform duration-300',
                                            showArchivedSessions && 'rotate-90'
                                        )}
                                    />
                                </button>

                                <AnimatedHeight isOpen={showArchivedSessions} duration={350}>
                                    <div className={cn('ml-4 space-y-0.5 border-l border-sparkle-border pb-2 pt-1', compact ? 'pl-1.5' : 'pl-2')}>
                                        {groupedArchivedSessions.map((group) => (
                                            <section key={`archived-${group.key}`} className="space-y-1">
                                                <div className="flex items-center gap-2 px-2 py-1">
                                                    <FolderOpen size={13} className="text-sparkle-text-muted/60" />
                                                    <span className="min-w-0 flex-1 truncate text-[11px] font-medium text-sparkle-text-secondary">
                                                        {group.label}
                                                    </span>
                                                </div>
                                                <div className="space-y-0.5">{group.sessions.map((session) => renderSessionRow(session, true))}</div>
                                            </section>
                                        ))}
                                    </div>
                                </AnimatedHeight>
                            </section>
                        )}
                    </div>
                </div>
            )}

            {renameTarget && typeof document !== 'undefined' && createPortal(
                <div
                    className="fixed inset-0 z-[120] flex items-center justify-center p-4"
                    onClick={closeRenameModal}
                >
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-md animate-fadeIn" />
                    <div
                        className="relative w-full max-w-sm overflow-hidden rounded-[24px] border border-sparkle-border bg-sparkle-card shadow-2xl animate-scaleIn"
                        onClick={(event) => event.stopPropagation()}
                    >
                        <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-[var(--accent-primary)]/40 via-[var(--accent-primary)]/10 to-transparent" />

                        <div className="p-6">
                            <h3 className="mb-1 text-lg font-bold tracking-tight text-white">Rename Project</h3>
                            <p className="mb-5 text-sm text-sparkle-text-secondary">
                                Enter a new descriptive title for this conversation.
                            </p>

                            <div className="relative group">
                                <Edit2 size={14} className="absolute left-3 top-3.5 text-sparkle-text-muted transition-colors group-focus-within:text-[var(--accent-primary)]" />
                                <input
                                    autoFocus
                                    value={renameDraft}
                                    onChange={(event) => setRenameDraft(event.target.value)}
                                    onKeyDown={(event) => {
                                        if (event.key === 'Enter') {
                                            event.preventDefault()
                                            void submitRename()
                                        } else if (event.key === 'Escape') {
                                            event.preventDefault()
                                            closeRenameModal()
                                        }
                                    }}
                                    className="w-full rounded-xl border border-sparkle-border bg-sparkle-bg py-3 pl-10 pr-4 text-sm text-sparkle-text outline-none transition-all focus:border-[var(--accent-primary)]/40 focus:ring-4 focus:ring-[var(--accent-primary)]/10"
                                    placeholder="e.g. Refactoring the login flow"
                                    maxLength={160}
                                />
                            </div>

                            <div className="mt-7 flex items-center gap-3">
                                <button
                                    type="button"
                                    onClick={closeRenameModal}
                                    className="flex-1 rounded-xl border border-sparkle-border bg-sparkle-bg px-4 py-2.5 text-sm font-semibold text-sparkle-text-secondary transition-all hover:bg-sparkle-card-hover hover:text-white"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    onClick={() => void submitRename()}
                                    disabled={!renameDraft.trim()}
                                    className={cn(
                                        'flex-1 rounded-xl px-4 py-2.5 text-sm font-bold transition-all shadow-lg',
                                        renameDraft.trim()
                                            ? 'bg-[var(--accent-primary)] text-white hover:bg-[var(--accent-primary)]/90 shadow-[var(--accent-primary)]/20 active:scale-[0.98]'
                                            : 'bg-sparkle-border/40 text-sparkle-text-muted cursor-not-allowed opacity-50'
                                    )}
                                >
                                    Save Changes
                                </button>
                            </div>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            <ConfirmModal
                isOpen={Boolean(sessionToDelete)}
                title="Delete Project?"
                message={`Are you sure you want to delete "${sessionToDelete?.title || 'this session'}"? This action cannot be undone.`}
                confirmLabel="Delete Session"
                onConfirm={() => {
                    if (sessionToDelete) {
                        void onDeleteSession(sessionToDelete.id)
                    }
                    setSessionToDelete(null)
                }}
                onCancel={() => setSessionToDelete(null)}
                variant="danger"
                fullscreen
            />
        </aside>
    )
}
