import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import {
    Archive,
    ArchiveRestore,
    ChevronRight,
    Edit2,
    Folder,
    FolderOpen,
    MessageSquarePlus,
    Plus,
    SquarePen,
    Trash2
} from 'lucide-react'
import type { AssistantSession, AssistantThread } from '@shared/assistant/contracts'
import { AnimatedHeight } from '@/components/ui/AnimatedHeight'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { cn } from '@/lib/utils'
import { formatAssistantRelativeTime, getAssistantThreadPhase } from '@/lib/assistant/selectors'
import { useNavigate } from 'react-router-dom'

/* ─────────────────────────── Types ─────────────────────────── */

type AssistantSessionsRailProps = {
    collapsed: boolean
    width: number
    compact?: boolean
    sessions: AssistantSession[]
    activeSessionId: string | null
    commandPending: boolean
    onSetCollapsed: (collapsed: boolean) => void
    onWidthChange?: (width: number) => void
    onCreateSession: (projectPath?: string) => Promise<void>
    onSelectSession: (sessionId: string) => Promise<void>
    onRenameSession: (sessionId: string, title: string) => Promise<void>
    onArchiveSession: (sessionId: string, archived?: boolean) => Promise<void>
    onDeleteSession: (sessionId: string) => Promise<void>
    onChooseProjectPath: () => Promise<void>
}

type SessionProjectGroup = {
    key: string
    label: string
    path: string
    updatedAt: string
    sessions: AssistantSession[]
}

/* ─────────────────────── Status pills ─────────────────────── */

interface SessionStatusPill {
    label: string
    colorClass: string
    dotClass: string
    pulse: boolean
}

function resolveSessionStatusPill(session: AssistantSession): SessionStatusPill | null {
    const activeThread: AssistantThread | null =
        session.threads.find((t) => t.id === session.activeThreadId) || null
    if (!activeThread) return null

    const phase = getAssistantThreadPhase(activeThread)

    switch (phase.key) {
        case 'running':
            return {
                label: 'Working',
                colorClass: 'text-sky-400',
                dotClass: 'bg-sky-400',
                pulse: true
            }
        case 'starting':
            return {
                label: 'Starting',
                colorClass: 'text-sky-400',
                dotClass: 'bg-sky-400',
                pulse: true
            }
        case 'waiting-approval':
            return {
                label: 'Pending',
                colorClass: 'text-amber-300',
                dotClass: 'bg-amber-400',
                pulse: false
            }
        case 'waiting-input':
            return {
                label: 'Input',
                colorClass: 'text-indigo-300',
                dotClass: 'bg-indigo-400',
                pulse: false
            }
        case 'error':
            return {
                label: 'Error',
                colorClass: 'text-red-300',
                dotClass: 'bg-red-400',
                pulse: false
            }
        case 'stopped':
            return {
                label: 'Stopped',
                colorClass: 'text-sparkle-text-muted',
                dotClass: 'bg-sparkle-text-muted/50',
                pulse: false
            }
        default:
            return null
    }
}

/* ─────────────────────── Helpers ─────────────────────────── */

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
        // Find the most recent thread's cwd as a fallback
        const latestThread = [...(session.threads || [])].sort(
            (a, b) => getSortableTimestamp(b.updatedAt) - getSortableTimestamp(a.updatedAt)
        )[0]
        const fallbackPath = latestThread?.cwd || null

        const normalizedPath = normalizeProjectPath(session.projectPath || fallbackPath)
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

/* ─────────────────────── Component ─────────────────────────── */

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
    onDeleteSession,
    onChooseProjectPath
}: AssistantSessionsRailProps) {
    const navigate = useNavigate()
    const [renameTarget, setRenameTarget] = useState<AssistantSession | null>(null)
    const [renameDraft, setRenameDraft] = useState('')
    const [sessionToDelete, setSessionToDelete] = useState<AssistantSession | null>(null)
    const [expandedGroupKeys, setExpandedGroupKeys] = useState<Set<string>>(new Set())
    const [showArchivedSessions, setShowArchivedSessions] = useState(false)

    const activeSessions = useMemo(
        () => sessions.filter((session) => {
            if (session.archived) return false
            if (activeSessionId === session.id) return true
            // Only show sessions with at least one thread that has at least one message
            return session.threads?.some(t => t.messages?.length > 0)
        }),
        [sessions, activeSessionId]
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
    const collapsedWidth = compact ? 56 : 64
    const railTitle = collapsed ? 'Expand assistant sidebar' : onWidthChange ? 'Drag to resize assistant sidebar' : 'Assistant sidebar'

    const handleResizeStart = (event: React.MouseEvent<HTMLButtonElement>) => {
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

    /* ─── Session row ─── */
    const renderSessionRow = (session: AssistantSession, archived = false) => {
        const isActive = session.id === activeSessionId
        const timeLabel = formatAssistantRelativeTime(session.updatedAt)
        const statusPill = resolveSessionStatusPill(session)

        return (
            <div key={session.id} className="group/menu-item relative" data-thread-item>
                <button
                    type="button"
                    onClick={() => void onSelectSession(session.id)}
                    className={cn(
                        'flex w-full min-w-0 items-center gap-1.5 rounded-md py-1.5 pr-2 text-left transition-colors select-none cursor-default',
                        compact ? 'pl-2.5' : 'pl-3.5',
                        isActive
                            ? 'bg-white/[0.07] text-sparkle-text font-medium'
                            : 'text-sparkle-text-secondary hover:bg-white/[0.04] hover:text-sparkle-text'
                    )}
                >
                    {/* Status / active dot */}
                    {statusPill ? (
                        <span className={cn('inline-flex items-center gap-1 text-[10px] shrink-0', statusPill.colorClass)}>
                            <span className={cn(
                                'h-1.5 w-1.5 rounded-full',
                                statusPill.dotClass,
                                statusPill.pulse && 'animate-pulse'
                            )} />
                            <span className="hidden md:inline">{statusPill.label}</span>
                        </span>
                    ) : null}

                    {/* Title */}
                    <span className="min-w-0 flex-1 truncate text-xs">
                        {getDisplayTitle(session.title)}
                    </span>

                    {/* Timestamp */}
                    <span className={cn(
                        'shrink-0 text-[10px]',
                        isActive ? 'text-sparkle-text/60' : 'text-sparkle-text-muted/40'
                    )}>
                        {timeLabel}
                    </span>
                </button>

                {/* Hover actions toolbar */}
                <div className="absolute right-1 top-1/2 hidden -translate-y-1/2 items-center gap-0.5 rounded-md border border-white/10 bg-sparkle-card p-0.5 shadow-lg/10 group-hover/menu-item:flex">
                    {!archived && (
                        <>
                            <button
                                type="button"
                                onClick={(event) => {
                                    event.stopPropagation()
                                    openRenameModal(session)
                                }}
                                className="rounded p-1 text-sparkle-text-secondary/60 transition-colors hover:bg-white/[0.05] hover:text-sparkle-text"
                                title="Rename"
                            >
                                <Edit2 size={11} />
                            </button>
                            <button
                                type="button"
                                onClick={(event) => {
                                    event.stopPropagation()
                                    void onArchiveSession(session.id, true)
                                }}
                                className="rounded p-1 text-sparkle-text-secondary/60 transition-colors hover:bg-amber-500/10 hover:text-amber-300"
                                title="Archive"
                            >
                                <Archive size={11} />
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
                            className="rounded p-1 text-sparkle-text-secondary/60 transition-colors hover:bg-emerald-500/10 hover:text-emerald-300"
                            title="Restore"
                        >
                            <ArchiveRestore size={11} />
                        </button>
                    )}
                    <button
                        type="button"
                        onClick={(event) => {
                            event.stopPropagation()
                            setSessionToDelete(session)
                        }}
                        className="rounded p-1 text-sparkle-text-secondary/60 transition-colors hover:bg-red-500/10 hover:text-red-500"
                        title="Delete"
                    >
                        <Trash2 size={11} />
                    </button>
                </div>
            </div>
        )
    }

    /* ─── Render ─── */
    return (
        <div
            className="group relative h-full shrink-0"
            data-collapsible={collapsed ? 'icon' : ''}
            data-side="left"
            data-state={collapsed ? 'collapsed' : 'expanded'}
            style={{
                ['--assistant-sidebar-width' as string]: `${resolvedWidth}px`,
                ['--assistant-sidebar-width-icon' as string]: `${collapsedWidth}px`
            }}
        >
            <div
                className={cn(
                    'relative h-full bg-transparent transition-[width] duration-200 ease-linear',
                    collapsed ? 'w-[var(--assistant-sidebar-width-icon)]' : 'w-[var(--assistant-sidebar-width)]'
                )}
            />

            <div
                className={cn(
                    'absolute inset-y-0 left-0 z-10 flex h-full transition-[width] duration-200 ease-linear',
                    collapsed ? 'w-[var(--assistant-sidebar-width-icon)]' : 'w-[var(--assistant-sidebar-width)]'
                )}
            >
                <aside className="relative h-full w-full overflow-x-hidden border-r border-white/10 bg-sparkle-card/95 backdrop-blur-sm">
                    {collapsed ? (
                        /* ──────── Collapsed State ──────── */
                        <div className={cn('relative z-10 flex h-full flex-col items-center px-2 pb-3 pt-3', compact ? 'gap-2.5' : 'gap-3')}>
                            <button
                                type="button"
                                onClick={() => onSetCollapsed(false)}
                                className="rounded-lg p-1.5 text-sparkle-text-secondary/70 transition-all hover:bg-white/[0.03] hover:text-sparkle-text"
                                title="Expand sidebar"
                            >
                                <ChevronRight size={18} />
                            </button>


                            <div className={cn('my-1 flex flex-col items-center gap-1.5', compact ? 'w-7' : 'w-8')}>
                                <div className="h-px w-full bg-white/10" />
                            </div>

                            <div className={cn('flex w-full flex-1 flex-col items-center overflow-y-auto pb-2 pt-1 no-scrollbar', compact ? 'gap-1.5' : 'gap-2')}>
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
                                                    ? 'border-white/10 bg-white/[0.05] text-[var(--accent-primary)]'
                                                    : 'border-transparent bg-transparent text-sparkle-text-secondary hover:border-white/10 hover:bg-white/[0.03] hover:text-sparkle-text'
                                            )}
                                        >
                                            {group.label.charAt(0).toUpperCase() || 'D'}
                                        </button>
                                    )
                                })}
                            </div>

                            {/* Collapsed footer */}
                            <div className={cn('flex flex-col items-center gap-1.5', compact ? 'w-7' : 'w-8')}>
                                <div className="h-px w-full bg-white/10" />
                            </div>
                        </div>
                    ) : (
                        /* ──────── Expanded State ──────── */
                        <div className={cn('relative z-10 flex h-full flex-col', compact ? 'px-2.5' : 'px-3')}>
                            {/* Header – Wordmark style */}
                            <div className="flex items-center justify-between gap-2 py-3 px-1">
                                <div className="flex min-w-0 flex-1 items-center gap-1.5">
                                    <span className="text-sm font-semibold tracking-tight text-sparkle-text">T3 x dvs</span>
                                    <span className="rounded-full bg-white/[0.06] px-1.5 py-0.5 text-[8px] font-medium uppercase tracking-[0.18em] text-sparkle-text-muted/60">
                                        Alpha
                                    </span>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => onSetCollapsed(true)}
                                    className="rounded-md p-1 text-sparkle-text-muted/60 transition-colors hover:bg-white/[0.04] hover:text-sparkle-text"
                                    title="Collapse sidebar"
                                >
                                    <ChevronRight size={16} className="rotate-180" />
                                </button>
                            </div>

                            {/* Add project button */}
                            <div className="mb-3 px-2">
                                <button
                                    type="button"
                                    onClick={() => void onChooseProjectPath()}
                                    disabled={commandPending}
                                    className="flex w-full items-center justify-center gap-2 rounded-md border border-dashed border-white/10 bg-white/[0.02] px-3 py-2 text-xs text-sparkle-text-muted/70 transition-all hover:border-[var(--accent-primary)]/50 hover:bg-[var(--accent-primary)]/10 hover:text-[var(--accent-primary)] disabled:opacity-40"
                                    title="Add project (Open Folder)"
                                >
                                    <Plus size={14} />
                                    <span>Add Project</span>
                                </button>
                            </div>

                            {/* Projects section title with divider */}
                            <div className="relative mb-3 flex items-center px-3">
                                <div className="h-px flex-1 bg-white/5" />
                                <span className="px-3 text-[10px] tracking-wide text-sparkle-text-muted/25">
                                    Projects
                                </span>
                                <div className="h-px flex-1 bg-white/5" />
                            </div>

                            {/* Session list */}
                            <div className="min-h-0 flex-1 overflow-y-auto pr-1 scrollbar-hide">
                                <div className="space-y-0.5">
                                    {groupedSessions.map((group) => {
                                        const isExpanded = expandedGroupKeys.has(group.key)

                                        return (
                                            <section key={group.key}>
                                                {/* Project group header */}
                                                <div className="group/project-header relative">
                                                    <button
                                                        type="button"
                                                        onClick={() => toggleGroup(group.key)}
                                                        className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-white/[0.04] group-hover/project-header:bg-white/[0.04]"
                                                    >
                                                        <ChevronRight
                                                            size={14}
                                                            className={cn(
                                                                '-ml-0.5 shrink-0 text-sparkle-text-muted/70 transition-transform duration-150',
                                                                isExpanded && 'rotate-90'
                                                            )}
                                                        />
                                                        {isExpanded ? (
                                                            <FolderOpen size={14} className="shrink-0 text-sparkle-text-muted/50" />
                                                        ) : (
                                                            <Folder size={14} className="shrink-0 text-sparkle-text-muted/50" />
                                                        )}
                                                        <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-hidden">
                                                            <span className="truncate text-xs font-medium text-sparkle-text/90">
                                                                {group.label}
                                                            </span>
                                                            <span className="shrink-0 text-[10px] text-sparkle-text-muted/40 font-mono">
                                                                ({group.sessions.length})
                                                            </span>
                                                        </div>
                                                    </button>

                                                    {/* Per-project new chat – appears on hover */}
                                                    <button
                                                        type="button"
                                                        onClick={(event) => {
                                                            event.stopPropagation()
                                                            const projectPath = group.path && group.path !== '' ? group.path : undefined
                                                            void onCreateSession(projectPath)
                                                        }}
                                                        className="absolute right-1 top-1 hidden size-5 items-center justify-center rounded-md p-0 text-sparkle-text-muted/70 transition-colors hover:bg-white/[0.06] hover:text-sparkle-text group-hover/project-header:flex"
                                                        title="New chat in project"
                                                    >
                                                        <SquarePen size={12} />
                                                    </button>
                                                </div>

                                                {/* Sessions under this project */}
                                                <AnimatedHeight isOpen={isExpanded} duration={350}>
                                                    <div className="ml-3.5 border-l border-white/10 flex min-w-0 flex-col gap-0.5 py-0.5 px-1">
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
                            </div>

                            {/* Footer – actions */}
                            <div className="mt-auto space-y-0.5 border-t border-white/10 px-1 py-2">
                                {archivedSessions.length > 0 && (
                                    <button
                                        type="button"
                                        onClick={() => setShowArchivedSessions((prev) => !prev)}
                                        className={cn(
                                            'group flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs transition-colors',
                                            showArchivedSessions
                                                ? 'bg-white/[0.06] text-sparkle-text'
                                                : 'text-sparkle-text-muted/70 hover:bg-white/[0.04] hover:text-sparkle-text'
                                        )}
                                    >
                                        <Archive size={14} className={cn('transition-colors', showArchivedSessions ? 'text-amber-400' : 'text-sparkle-text-muted/50')} />
                                        <span className="flex-1 text-left">Archived Chats</span>
                                        <span className="rounded-[4px] border border-white/10 bg-white/[0.03] px-1 py-0.5 text-[9px]">
                                            {archivedSessions.length}
                                        </span>
                                    </button>
                                )}

                                <AnimatedHeight isOpen={showArchivedSessions} duration={300}>
                                    <div className="mt-1 max-h-[30vh] overflow-y-auto rounded-lg bg-black/20 p-1 custom-scrollbar">
                                        {groupedArchivedSessions.length > 0 ? (
                                            groupedArchivedSessions.map((group) => (
                                                <section key={`footer-archived-${group.key}`} className="space-y-0.5 mb-2 last:mb-0">
                                                    <div className="flex items-center gap-2 px-2 py-1 text-[10px] text-sparkle-text-muted/40 uppercase tracking-widest">
                                                        <FolderOpen size={10} />
                                                        <span className="truncate">{group.label}</span>
                                                    </div>
                                                    {group.sessions.map((session) => renderSessionRow(session, true))}
                                                </section>
                                            ))
                                        ) : (
                                            <div className="py-4 text-center text-[10px] text-sparkle-text-muted/40 italic">
                                                No archived sessions
                                            </div>
                                        )}
                                    </div>
                                </AnimatedHeight>
                            </div>
                        </div>
                    )}

                    {/* Resize rail */}
                    <button
                        type="button"
                        aria-label={railTitle}
                        onClick={() => {
                            if (collapsed) onSetCollapsed(false)
                        }}
                        onMouseDown={handleResizeStart}
                        className={cn(
                            'absolute inset-y-0 right-0 z-20 hidden w-4 translate-x-1/2 transition-all ease-linear sm:flex',
                            collapsed ? 'cursor-e-resize' : 'cursor-w-resize',
                            'after:absolute after:inset-y-0 after:left-1/2 after:w-[2px] after:bg-transparent hover:after:bg-white/10'
                        )}
                        title={railTitle}
                    />

                    {/* Rename modal */}
                    {renameTarget && typeof document !== 'undefined' && createPortal(
                        <div
                            className="fixed inset-0 z-[120] flex items-center justify-center p-4"
                            onClick={closeRenameModal}
                        >
                            <div className="absolute inset-0 bg-black/60 backdrop-blur-md animate-fadeIn" />
                            <div
                                className="relative w-full max-w-sm overflow-hidden rounded-[24px] border border-white/10 bg-sparkle-card shadow-2xl animate-scaleIn"
                                onClick={(event) => event.stopPropagation()}
                            >
                                <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-[var(--accent-primary)]/40 via-[var(--accent-primary)]/10 to-transparent" />

                                <div className="p-6">
                                    <h3 className="mb-1 text-lg font-bold tracking-tight text-white">Rename Session</h3>
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
                                            className="w-full rounded-xl border border-white/10 bg-sparkle-bg py-3 pl-10 pr-4 text-sm text-sparkle-text outline-none transition-all focus:border-[var(--accent-primary)]/40 focus:ring-4 focus:ring-[var(--accent-primary)]/10"
                                            placeholder="e.g. Refactoring the login flow"
                                            maxLength={160}
                                        />
                                    </div>

                                    <div className="mt-7 flex items-center gap-3">
                                        <button
                                            type="button"
                                            onClick={closeRenameModal}
                                            className="flex-1 rounded-xl border border-white/10 bg-sparkle-bg px-4 py-2.5 text-sm font-semibold text-sparkle-text-secondary transition-all hover:border-white/20 hover:bg-sparkle-card-hover hover:text-white"
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
                        title="Delete Session?"
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
            </div>
        </div>
    )
}
