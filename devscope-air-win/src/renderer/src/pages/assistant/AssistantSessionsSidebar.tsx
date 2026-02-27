import { useEffect, useMemo, useState } from 'react'
import { AnimatedHeight } from '@/components/ui/AnimatedHeight'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { createPortal } from 'react-dom'
import {
    Archive,
    ArchiveRestore,
    ChevronRight,
    Edit2,
    Folder,
    FolderOpen,
    MessageSquarePlus,
    Shield,
    Trash2
} from 'lucide-react'
import { cn } from '@/lib/utils'

export type AssistantSessionSidebarItem = {
    id: string
    title: string
    createdAt: number
    updatedAt: number
    archived?: boolean
    projectPath?: string
}

type AssistantSessionsSidebarProps = {
    collapsed: boolean
    width: number
    compact?: boolean
    sessions: AssistantSessionSidebarItem[]
    activeSessionId: string | null
    onSetCollapsed: (collapsed: boolean) => void
    onWidthChange?: (width: number) => void
    onCreateSession: (projectPath?: string) => Promise<void>
    onSelectSession: (sessionId: string) => Promise<void>
    onRenameSession: (sessionId: string, nextTitle: string) => Promise<void>
    onArchiveSession: (sessionId: string, archived?: boolean) => Promise<void>
    onDeleteSession: (sessionId: string) => Promise<void>
}

type SessionDirectoryGroup = {
    key: string
    label: string
    path: string
    createdAt: number
    updatedAt: number
    sessions: AssistantSessionSidebarItem[]
}

const NO_DIRECTORY_KEY = '__no_directory__'

function normalizeDirectoryPath(value?: string): string {
    return String(value || '').trim()
}

function getDirectoryKey(path: string): string {
    return path || NO_DIRECTORY_KEY
}

function getDirectoryLabel(path: string): string {
    if (!path) return 'No Directory'
    const parts = path.split(/[\\/]/).filter(Boolean)
    return parts[parts.length - 1] || path
}

export function AssistantSessionsSidebar({
    collapsed,
    width,
    compact = false,
    sessions,
    activeSessionId,
    onSetCollapsed,
    onWidthChange,
    onCreateSession,
    onSelectSession,
    onRenameSession,
    onArchiveSession,
    onDeleteSession
}: AssistantSessionsSidebarProps) {
    const location = useLocation()
    const navigate = useNavigate()
    const [renameTarget, setRenameTarget] = useState<AssistantSessionSidebarItem | null>(null)
    const [renameDraft, setRenameDraft] = useState('')
    const [sessionToDelete, setSessionToDelete] = useState<AssistantSessionSidebarItem | null>(null)
    const [expandedGroupKeys, setExpandedGroupKeys] = useState<Set<string>>(new Set())
    const [showArchivedSessions, setShowArchivedSessions] = useState(false)
    const isSkillsView = location.pathname === '/assistant/skills'

    const getDisplayTitle = (title: string): string => {
        const trimmed = String(title || '').trim()
        return trimmed || 'Untitled Session'
    }

    const activeSessions = useMemo(
        () => sessions.filter((session) => !session.archived),
        [sessions]
    )
    const archivedSessions = useMemo(
        () => sessions
            .filter((session) => session.archived)
            .sort((a, b) => (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0)),
        [sessions]
    )

    const groupedSessions = useMemo<SessionDirectoryGroup[]>(() => {
        const byKey = new Map<string, SessionDirectoryGroup>()
        for (const session of activeSessions) {
            const normalizedPath = normalizeDirectoryPath(session.projectPath)
            const key = getDirectoryKey(normalizedPath)
            const existing = byKey.get(key)
            if (!existing) {
                byKey.set(key, {
                    key,
                    label: getDirectoryLabel(normalizedPath),
                    path: normalizedPath,
                    createdAt: session.createdAt,
                    updatedAt: session.updatedAt,
                    sessions: [session]
                })
                continue
            }
            existing.sessions.push(session)
            if (session.createdAt > existing.createdAt) existing.createdAt = session.createdAt
            if (session.updatedAt > existing.updatedAt) existing.updatedAt = session.updatedAt
        }

        return Array.from(byKey.values())
            .map((group) => {
                const sortedSessions = [...group.sessions].sort((a, b) => {
                    const aTime = a.createdAt || 0
                    const bTime = b.createdAt || 0
                    return bTime - aTime
                })
                return { ...group, sessions: sortedSessions }
            })
            // Sort groups by their newest project creation time
            .sort((a, b) => b.createdAt - a.createdAt)
    }, [activeSessions, activeSessionId])

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

            // Only expand the first two groups by default
            const topTwoGroups = groupedSessions.slice(0, 2)
            for (const group of topTwoGroups) {
                if (!prev.has(group.key)) {
                    next.add(group.key)
                }
            }

            if (activeSessionId) {
                const activeGroup = groupedSessions.find((group) => (
                    group.sessions.some((session) => session.id === activeSessionId)
                ))
                if (activeGroup) next.add(activeGroup.key)
            }

            return next
        })
    }, [groupedSessions, activeSessionId])

    const toggleGroup = (key: string) => {
        setExpandedGroupKeys((prev) => {
            const next = new Set(prev)
            if (next.has(key)) next.delete(key)
            else next.add(key)
            return next
        })
    }

    const openRenameModal = (session: AssistantSessionSidebarItem) => {
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

    const handleDeleteClick = (session: AssistantSessionSidebarItem) => {
        setSessionToDelete(session)
    }

    const autoMinimizeIfCompactExpanded = () => {
        if (compact && !collapsed) {
            onSetCollapsed(true)
        }
    }

    const handleCreateSessionFromSidebar = async () => {
        await onCreateSession()
        if (isSkillsView) {
            navigate('/assistant')
        }
        autoMinimizeIfCompactExpanded()
    }

    const confirmDelete = async () => {
        if (!sessionToDelete) return
        await onDeleteSession(sessionToDelete.id)
        setSessionToDelete(null)
    }
    const minSidebarWidth = 180
    const maxSidebarWidth = compact ? 420 : 520
    const resolvedWidth = Math.max(minSidebarWidth, Math.min(maxSidebarWidth, Math.round(width)))
    const clampSidebarWidth = (value: number) => {
        if (!Number.isFinite(value)) return resolvedWidth
        return Math.max(minSidebarWidth, Math.min(maxSidebarWidth, Math.round(value)))
    }

    const handleResizeStart = (event: React.MouseEvent<HTMLDivElement>) => {
        if (collapsed || !onWidthChange) return
        event.preventDefault()
        event.stopPropagation()

        const startX = event.clientX
        const startWidth = resolvedWidth
        document.body.style.cursor = 'col-resize'
        document.body.style.userSelect = 'none'

        const handleMove = (moveEvent: MouseEvent) => {
            const delta = moveEvent.clientX - startX
            onWidthChange(clampSidebarWidth(startWidth + delta))
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
                    className={cn(
                        'absolute right-0 top-0 z-30 h-full w-1.5 cursor-col-resize bg-transparent transition-colors hover:bg-sparkle-border'
                    )}
                    title="Resize assistant sidebar"
                />
            )}

            {collapsed ? (
                <div className={cn('relative z-10 flex h-full flex-col items-center px-2 pb-4 pt-4', compact ? 'gap-3' : 'gap-4')}>
                    {/* Expand Sidebar Toggle (Matches position of collapse button) */}
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
                        onClick={() => { void handleCreateSessionFromSidebar() }}
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


                    {/* Collapsed session avatars */}
                    <div className={cn('flex w-full flex-1 flex-col items-center overflow-y-auto pb-2 pt-1 no-scrollbar', compact ? 'gap-2' : 'gap-2.5')}>
                        {groupedSessions.map((group) => {
                            const primarySession = group.sessions[0]
                            const hasActive = group.sessions.some((session) => session.id === activeSessionId)
                            if (!primarySession) return null
                            return (
                                <button
                                    key={group.key}
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

                    {/* Settings link */}
                    <Link
                        to="/settings/assistant"
                        className="rounded-lg border border-sparkle-border bg-sparkle-card p-2 text-sparkle-text-secondary transition-colors hover:bg-sparkle-card-hover hover:text-sparkle-text"
                        title="Assistant settings"
                    >
                        <Shield size={14} />
                    </Link>
                </div>
            ) : (
                <div className={cn('relative z-10 flex h-full flex-col pb-4 pt-4', compact ? 'px-3' : 'px-4')}>
                    {/* ── Sidebar Toggle (Absolute positioned) ── */}
                    <button
                        type="button"
                        onClick={() => onSetCollapsed(true)}
                        className={cn(
                            'absolute z-20 rounded-lg p-1.5 text-sparkle-text-secondary/70 transition-all hover:bg-sparkle-card-hover hover:text-sparkle-text',
                            compact ? 'right-2 top-2' : 'right-3 top-3'
                        )}
                        title="Collapse sidebar"
                    >
                        <ChevronRight size={compact ? 16 : 18} className="rotate-180" />
                    </button>

                    {/* ── Header actions ── */}
                    <div className={cn(compact ? 'mb-4 pt-8' : 'mb-6 pt-9', 'flex flex-col gap-1')}>
                        <button
                            type="button"
                            onClick={() => { void handleCreateSessionFromSidebar() }}
                            className={cn(
                                'flex items-center rounded-md border border-transparent px-2 text-sparkle-text-secondary transition-colors hover:border-sparkle-border hover:bg-sparkle-bg hover:text-sparkle-text',
                                compact ? 'gap-2 py-1.5' : 'gap-3 py-2'
                            )}
                        >
                            <MessageSquarePlus size={compact ? 16 : 18} />
                            <span className={cn('font-medium', compact ? 'text-xs' : 'text-sm')}>New chat</span>
                        </button>

                        {!compact && (
                            <>
                                <div className="group relative">
                                    <button
                                        type="button"
                                        disabled
                                        className="flex w-full cursor-not-allowed items-center gap-3 rounded-lg px-2 py-2 text-sparkle-text-muted/10 grayscale transition-colors"
                                    >
                                        <svg className="h-[18px] w-[18px] opacity-10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
                                        <span className="text-sm font-medium opacity-40">Automations</span>
                                    </button>

                                    {/* "Coming Soon" Tooltip - Positioned inside to avoid overflow-x-hidden clipping */}
                                    <div className="pointer-events-none absolute right-2 top-1/2 z-50 -translate-y-1/2 scale-90 whitespace-nowrap rounded-md border border-white/10 bg-sparkle-card/90 px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-sparkle-text-muted opacity-0 backdrop-blur-md shadow-xl transition-all duration-200 group-hover:scale-100 group-hover:opacity-100">
                                        Coming Soon
                                    </div>
                                </div>

                                <Link
                                    to="/assistant/skills"
                                    className="flex items-center gap-3 rounded-md border border-transparent px-2 py-2 text-sparkle-text-secondary transition-colors hover:border-sparkle-border hover:bg-sparkle-bg hover:text-sparkle-text"
                                >
                                    <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" /><polyline points="3.29 7 12 12 20.71 7" /><line x1="12" y1="22" x2="12" y2="12" /></svg>
                                    <span className="text-sm font-medium">Skills</span>
                                </Link>
                            </>
                        )}
                    </div>

                    {/* ── Projects Section Label (Divider style) ── */}
                    <div className={cn('flex items-center gap-3 px-1', compact ? 'mb-3' : 'mb-4')}>
                        <div className="h-px flex-1 bg-sparkle-border" />
                        <h3 className="shrink-0 text-[10px] font-bold uppercase tracking-[0.2em] text-sparkle-text-muted">Projects</h3>
                        <div className="h-px flex-1 bg-sparkle-border" />
                    </div>

                    {/* ── Session list ── */}
                    <div className="flex-1 overflow-y-auto no-scrollbar">
                        <div className={cn('flex min-h-full flex-col', compact ? 'gap-3' : 'gap-4')}>
                            <div className={cn(compact ? 'space-y-3' : 'space-y-4')}>
                                {groupedSessions.map((group) => {
                            const isExpanded = expandedGroupKeys.has(group.key)
                            const groupHasActiveSession = group.sessions.some((session) => session.id === activeSessionId)
                            const visibleSessions = group.sessions

                            return (
                                <section key={group.key} className={cn(compact ? 'space-y-0.5' : 'space-y-1')}>
                                    {/* Folder group header */}
                                    <button
                                        type="button"
                                        onClick={() => toggleGroup(group.key)}
                                        className="group flex w-full items-center gap-2 px-1 py-1.5 text-left transition-colors"
                                    >
                                        <div className="relative h-4 w-4 shrink-0 transition-transform duration-300">
                                            <Folder
                                                size={16}
                                                    className={cn(
                                                    'absolute inset-0 transition-all duration-300',
                                                    isExpanded ? 'scale-0 opacity-0 -rotate-12' : 'scale-100 opacity-100 rotate-0',
                                                    groupHasActiveSession ? 'text-[var(--accent-primary)]' : 'text-sparkle-text-muted/70'
                                                )}
                                            />
                                            <FolderOpen
                                                size={16}
                                                className={cn(
                                                    'absolute inset-0 transition-all duration-300',
                                                    isExpanded ? 'scale-100 opacity-100 rotate-0' : 'scale-0 opacity-0 rotate-12',
                                                    groupHasActiveSession ? 'text-[var(--accent-primary)]' : 'text-sparkle-text-muted/70'
                                                )}
                                            />
                                        </div>
                                        <span className={cn(
                                            'truncate font-semibold transition-colors flex-1',
                                            compact ? 'text-[12px]' : 'text-[13px]',
                                            groupHasActiveSession ? 'text-sparkle-text' : 'text-sparkle-text-secondary group-hover:text-sparkle-text'
                                        )}>
                                            {group.label}
                                        </span>
                                        <div className="flex h-4 w-4 shrink-0 items-center justify-center">
                                            <ChevronRight
                                                size={14}
                                                className={cn(
                                                    "text-sparkle-text-muted/70 transition-transform duration-300",
                                                    isExpanded && "rotate-90"
                                                )}
                                            />
                                        </div>
                                    </button>

                                    <AnimatedHeight isOpen={isExpanded} duration={500}>
                                        <div className={cn('ml-4 space-y-0.5 border-l border-sparkle-border pb-2 pt-1', compact ? 'pl-1.5' : 'pl-2')}>
                                            {visibleSessions.map((session) => {
                                                const isActive = session.id === activeSessionId
                                                const timeAgo = Math.floor((Date.now() - (session.createdAt || session.updatedAt)) / 3600000)
                                                const timeLabel = timeAgo < 1 ? 'now' : timeAgo < 24 ? `${timeAgo}h` : `${Math.floor(timeAgo / 24)}d`

                                                return (
                                                    <div
                                                        key={session.id}
                                                        className={cn(
                                                            'group relative flex items-center rounded-md border transition-colors',
                                                            compact ? 'gap-2 px-2 py-2' : 'gap-3 px-3 py-2.5',
                                                            isActive
                                                                ? 'border-2 border-[var(--accent-primary)] bg-[var(--accent-primary)]/20 text-[var(--accent-primary)] ring-1 ring-[var(--accent-primary)]/30'
                                                                : 'border-sparkle-border bg-sparkle-bg text-sparkle-text-secondary hover:bg-sparkle-card-hover hover:text-sparkle-text'
                                                        )}
                                                    >
                                                        {isActive && (
                                                            <span className="absolute left-0 top-1/2 h-[68%] w-[2px] -translate-y-1/2 rounded-r bg-[var(--accent-primary)]" />
                                                        )}
                                                        <button
                                                            className={cn('flex-1 truncate text-left font-medium outline-none', compact ? 'text-[12px]' : 'text-[13px]')}
                                                            onClick={() => {
                                                                void onSelectSession(session.id)
                                                                autoMinimizeIfCompactExpanded()
                                                            }}
                                                            title={getDisplayTitle(session.title)}
                                                        >
                                                            {getDisplayTitle(session.title)}
                                                        </button>

                                                        <span className="shrink-0 rounded-[4px] border border-sparkle-border bg-sparkle-card px-1.5 py-0.5 font-mono text-[9px] font-bold text-sparkle-text-muted tabular-nums uppercase tracking-wide transition-colors group-hover:text-sparkle-text-secondary">
                                                            {timeLabel}
                                                        </span>

                                                        {/* Hover actions */}
                                                        <div className="absolute right-1 top-1/2 hidden -translate-y-1/2 items-center gap-0.5 rounded-md border border-sparkle-border bg-sparkle-bg p-0.5 shadow-sm group-hover:flex">
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); openRenameModal(session); }}
                                                                className="rounded p-1 text-sparkle-text-muted hover:bg-sparkle-bg hover:text-sparkle-text"
                                                            >
                                                                <Edit2 size={10} />
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={(e) => {
                                                                    e.stopPropagation()
                                                                    void onArchiveSession(session.id, true)
                                                                }}
                                                                className="rounded p-1 text-sparkle-text-secondary/50 transition-colors hover:bg-amber-500/10 hover:text-amber-300"
                                                                title="Archive session"
                                                            >
                                                                <Archive size={12} />
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={(e) => {
                                                                    e.stopPropagation()
                                                                    handleDeleteClick(session)
                                                                }}
                                                                className="rounded p-1 text-sparkle-text-secondary/50 transition-colors hover:bg-red-500/10 hover:text-red-500"
                                                                title="Delete session"
                                                            >
                                                                <Trash2 size={13} />
                                                            </button>
                                                        </div>
                                                    </div>
                                                )
                                            })}

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
                                <section className={cn('mt-auto border-t border-sparkle-border pt-2', compact ? 'space-y-0.5' : 'space-y-1')}>
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
                                            {archivedSessions.map((session) => {
                                                const timeAgo = Math.floor((Date.now() - (session.updatedAt || session.createdAt)) / 3600000)
                                                const timeLabel = timeAgo < 1 ? 'now' : timeAgo < 24 ? `${timeAgo}h` : `${Math.floor(timeAgo / 24)}d`
                                                return (
                                                    <div
                                                        key={`archived-${session.id}`}
                                                        className={cn(
                                                            'group relative flex items-center rounded-md border transition-colors',
                                                            compact ? 'gap-2 px-2 py-2' : 'gap-3 px-3 py-2.5',
                                                            'border-sparkle-border bg-sparkle-bg text-sparkle-text-muted hover:bg-sparkle-card-hover'
                                                        )}
                                                    >
                                                        <span
                                                            className={cn('flex-1 truncate text-left font-medium', compact ? 'text-[12px]' : 'text-[13px]')}
                                                            title={getDisplayTitle(session.title)}
                                                        >
                                                            {getDisplayTitle(session.title)}
                                                        </span>
                                                        <span className="shrink-0 rounded-[4px] border border-sparkle-border bg-sparkle-card px-1.5 py-0.5 font-mono text-[9px] font-bold text-sparkle-text-muted tabular-nums uppercase tracking-wide">
                                                            {timeLabel}
                                                        </span>
                                                        <div className="absolute right-1 top-1/2 hidden -translate-y-1/2 items-center gap-0.5 rounded-md border border-sparkle-border bg-sparkle-bg p-0.5 shadow-sm group-hover:flex">
                                                            <button
                                                                type="button"
                                                                onClick={() => void onArchiveSession(session.id, false)}
                                                                className="rounded p-1 text-sparkle-text-secondary/60 transition-colors hover:bg-emerald-500/10 hover:text-emerald-300"
                                                                title="Unarchive session"
                                                            >
                                                                <ArchiveRestore size={12} />
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => handleDeleteClick(session)}
                                                                className="rounded p-1 text-sparkle-text-secondary/50 transition-colors hover:bg-red-500/10 hover:text-red-500"
                                                                title="Delete session"
                                                            >
                                                                <Trash2 size={13} />
                                                            </button>
                                                        </div>
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    </AnimatedHeight>
                                </section>
                            )}
                        </div>
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
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-[var(--accent-primary)]/40 via-[var(--accent-primary)]/10 to-transparent" />

                        <div className="p-6">
                            <h3 className="text-lg font-bold tracking-tight text-white mb-1">Rename Project</h3>
                            <p className="text-sm text-sparkle-text-secondary mb-5">
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
                isOpen={!!sessionToDelete}
                title="Delete Project?"
                message={`Are you sure you want to delete "${sessionToDelete?.title || 'this session'}"? This action cannot be undone.`}
                confirmLabel="Delete Session"
                onConfirm={confirmDelete}
                onCancel={() => setSessionToDelete(null)}
                variant="danger"
                fullscreen
            />
        </aside>
    )
}
