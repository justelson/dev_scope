import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
    Archive,
    ArchiveRestore,
    ChevronRight,
    FolderOpen,
    PanelLeftClose,
    PanelLeftOpen,
    Pencil,
    Trash2,
    Plus
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { AnimatedHeight } from '@/components/ui/AnimatedHeight'
import { ConfirmModal } from '@/components/ui/ConfirmModal'

export type AssistantSessionSidebarItem = {
    id: string
    title: string
    createdAt: number
    updatedAt: number
    messageCount?: number
    archived?: boolean
    projectPath?: string
}

type AssistantSessionsSidebarProps = {
    collapsed: boolean
    width: number
    compact?: boolean
    sessions: AssistantSessionSidebarItem[]
    activeSessionId: string | null
    isThinking?: boolean
    onSetCollapsed: (collapsed: boolean) => void
    onWidthChange?: (width: number) => void
    onCreateSession: (projectPath?: string) => Promise<void>
    onSelectSession: (sessionId: string) => Promise<void>
    onRenameSession: (sessionId: string, nextTitle: string) => Promise<void>
    onArchiveSession: (sessionId: string, archived?: boolean) => Promise<void>
    onDeleteSession: (sessionId: string) => Promise<void>
    projectPathOptions?: string[]
    selectedProjectPath?: string | null
    onSelectProjectPath?: (projectPath: string) => Promise<unknown>
    onAddProject?: () => Promise<unknown>
}

type SessionDirectoryGroup = {
    key: string
    label: string
    path: string
    sessions: AssistantSessionSidebarItem[]
    updatedAt: number
}

const NO_DIRECTORY_KEY = '__no_directory__'

function normalizeDirectoryPath(value?: string): string {
    return String(value || '').trim()
}

function getDirectoryLabel(path: string): string {
    if (!path) return 'No folder'
    const parts = path.split(/[\\/]/).filter(Boolean)
    return parts[parts.length - 1] || path
}

function getDisplayTitle(title: string): string {
    const trimmed = String(title || '').trim()
    return trimmed || 'Untitled chat'
}

function formatRelativeTime(value: number | null | undefined): string {
    const timestamp = Number(value || 0)
    if (!Number.isFinite(timestamp) || timestamp <= 0) return 'now'
    const deltaMs = Math.max(0, Date.now() - timestamp)
    if (deltaMs < 60_000) return 'now'
    const minutes = Math.floor(deltaMs / 60_000)
    if (minutes < 60) return `${minutes}m ago`
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `${hours}h ago`
    const days = Math.floor(hours / 24)
    if (days < 7) return `${days}d ago`
    return `${Math.floor(days / 7)}w ago`
}

export function AssistantSessionsSidebar({
    collapsed,
    width,
    compact = false,
    sessions,
    activeSessionId,
    isThinking = false,
    onSetCollapsed,
    onWidthChange,
    onCreateSession,
    onSelectSession,
    onRenameSession,
    onArchiveSession,
    onDeleteSession,
    selectedProjectPath,
    onAddProject
}: AssistantSessionsSidebarProps) {
    const location = useLocation()
    const navigate = useNavigate()
    const [expandedGroupKeys, setExpandedGroupKeys] = useState<Set<string>>(new Set())
    const [sessionToDelete, setSessionToDelete] = useState<AssistantSessionSidebarItem | null>(null)
    const [showArchivedSessions, setShowArchivedSessions] = useState(false)
    const isSkillsView = location.pathname === '/assistant/skills'

    const visibleSessions = useMemo(
        () => sessions.filter((session) => Number(session.messageCount || 0) > 0),
        [sessions]
    )
    const activeSessions = useMemo(
        () => visibleSessions.filter((session) => !session.archived),
        [visibleSessions]
    )
    const archivedSessions = useMemo(
        () => visibleSessions
            .filter((session) => session.archived)
            .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)),
        [visibleSessions]
    )

    const groupedSessions = useMemo<SessionDirectoryGroup[]>(() => {
        const byKey = new Map<string, SessionDirectoryGroup>()
        for (const session of [...activeSessions].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))) {
            const path = normalizeDirectoryPath(session.projectPath)
            const key = path || NO_DIRECTORY_KEY
            const existing = byKey.get(key)
            if (existing) {
                existing.sessions.push(session)
                existing.updatedAt = Math.max(existing.updatedAt, session.updatedAt || session.createdAt || 0)
                continue
            }
            byKey.set(key, { key, label: getDirectoryLabel(path), path, sessions: [session], updatedAt: session.createdAt || 0 })
        }
        return Array.from(byKey.values()).sort((a, b) => b.updatedAt - a.updatedAt)
    }, [activeSessions])

    useEffect(() => {
        if (!activeSessionId) return
        if (archivedSessions.some((session) => session.id === activeSessionId)) {
            setShowArchivedSessions(true)
        }
    }, [activeSessionId, archivedSessions])

    useEffect(() => {
        setExpandedGroupKeys((prev) => {
            const next = new Set<string>()
            for (const group of groupedSessions.slice(0, 2)) next.add(group.key)
            if (activeSessionId) {
                const activeGroup = groupedSessions.find((group) => group.sessions.some((session) => session.id === activeSessionId))
                if (activeGroup) next.add(activeGroup.key)
            }
            for (const key of prev) if (groupedSessions.some((group) => group.key === key)) next.add(key)
            return next
        })
    }, [groupedSessions, activeSessionId])

    const minSidebarWidth = compact ? 240 : 260
    const maxSidebarWidth = compact ? 380 : 520
    const resolvedWidth = Math.max(minSidebarWidth, Math.min(maxSidebarWidth, Math.round(width)))

    const handleResizeStart = (event: React.MouseEvent<HTMLDivElement>) => {
        if (collapsed || !onWidthChange) return
        event.preventDefault()
        const startX = event.clientX
        const startWidth = resolvedWidth
        const handleMove = (moveEvent: MouseEvent) => {
            const nextWidth = Math.max(minSidebarWidth, Math.min(maxSidebarWidth, Math.round(startWidth + (moveEvent.clientX - startX))))
            onWidthChange(nextWidth)
        }
        const handleUp = () => {
            document.body.style.cursor = ''
            document.body.style.userSelect = ''
            window.removeEventListener('mousemove', handleMove)
            window.removeEventListener('mouseup', handleUp)
        }
        document.body.style.cursor = 'col-resize'
        document.body.style.userSelect = 'none'
        window.addEventListener('mousemove', handleMove)
        window.addEventListener('mouseup', handleUp)
    }

    const handleCreateSessionFromSidebar = async (projectPath?: string) => {
        await onCreateSession(projectPath || normalizeDirectoryPath(selectedProjectPath || '') || undefined)
        if (isSkillsView) navigate('/assistant')
        if (compact && !collapsed) onSetCollapsed(true)
    }

    const handleSelectSessionFromSidebar = async (sessionId: string) => {
        await onSelectSession(sessionId)
        if (isSkillsView) navigate('/assistant')
        if (compact && !collapsed) onSetCollapsed(true)
    }

    const handleRenameSessionRequest = async (session: AssistantSessionSidebarItem) => {
        const nextTitle = window.prompt('Rename chat', getDisplayTitle(session.title))
        const normalized = String(nextTitle || '').trim()
        if (!normalized) return
        await onRenameSession(session.id, normalized)
    }

    return (
        <>
            <aside className={cn('relative h-full shrink-0 overflow-hidden border-r border-white/10 bg-sparkle-card transition-[width] duration-300', compact && 'bg-sparkle-card/92 backdrop-blur-xl', collapsed ? (compact ? 'w-12' : 'w-14') : '')} style={!collapsed ? { width: resolvedWidth } : undefined}>
                {!collapsed && <div role="separator" aria-orientation="vertical" onMouseDown={handleResizeStart} className={cn('absolute right-0 top-0 z-30 h-full cursor-col-resize bg-transparent transition-colors', compact ? 'w-1 hover:bg-white/10' : 'w-1.5 hover:bg-white/10')} />}
                {collapsed ? (
                    <div className="flex h-full flex-col items-center gap-2 px-1.5 py-3">
                        <button type="button" onClick={() => onSetCollapsed(false)} className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/[0.03] text-sparkle-text-secondary transition-colors hover:border-white/20 hover:bg-white/[0.05] hover:text-sparkle-text"><PanelLeftOpen size={14} /></button>
                        <button type="button" onClick={() => void handleCreateSessionFromSidebar()} className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/[0.03] text-sparkle-text-secondary transition-colors hover:border-white/20 hover:bg-white/[0.05] hover:text-sparkle-text"><Pencil size={14} /></button>
                    </div>
                ) : (
                    <div className="flex h-full flex-col">
                        <div className="border-b border-white/5 px-3 py-3">
                            <div className="flex items-center gap-2">
                                <div className="min-w-0 flex-1">
                                    <p className="text-[10px] uppercase tracking-[0.16em] text-sparkle-text-muted/70">Chats</p>
                                    <h2 className="mt-1 truncate text-sm font-semibold tracking-tight text-sparkle-text">Assistant Threads</h2>
                                </div>
                                <button type="button" onClick={() => void handleCreateSessionFromSidebar()} className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/[0.03] text-sparkle-text-secondary transition-colors hover:border-white/20 hover:bg-white/[0.05] hover:text-sparkle-text"><Pencil size={14} /></button>
                                <button type="button" onClick={() => onSetCollapsed(true)} className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/[0.03] text-sparkle-text-secondary transition-colors hover:border-white/20 hover:bg-white/[0.05] hover:text-sparkle-text"><PanelLeftClose size={14} /></button>
                            </div>
                            <button
                                type="button"
                                onClick={() => void onAddProject?.()}
                                className="mt-3 flex w-full items-center justify-center rounded-xl border border-dashed border-white/6 bg-white/[0.015] px-3 py-2.5 text-xs font-medium text-white/42 transition-colors hover:border-white/12 hover:bg-white/[0.03] hover:text-white/72"
                            >
                                + Add project
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto px-2 py-2">
                            <div className="flex min-h-full flex-col">
                                <div className="space-y-2">
                                {groupedSessions.map((group) => {
                                    const isExpanded = expandedGroupKeys.has(group.key)
                                    return (
                                        <div key={group.key} className="group/project overflow-hidden">
                                            <div className="flex items-center gap-1 px-2 py-1.5">
                                                <button type="button" onClick={() => setExpandedGroupKeys((prev) => { const next = new Set(prev); if (next.has(group.key)) next.delete(group.key); else next.add(group.key); return next })} className="flex min-w-0 flex-1 items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-white/[0.04]">
                                                    <ChevronRight size={14} className={cn('shrink-0 text-white/35 transition-transform', isExpanded && 'rotate-90')} />
                                                    <FolderOpen size={14} className="shrink-0 text-[var(--accent-primary)]/85" />
                                                    <div className="flex min-w-0 flex-1 items-center gap-2">
                                                        <div className="truncate text-[12px] font-medium text-white/92">{group.label}</div>
                                                        <div className="shrink-0 text-[10px] text-white/34">{group.sessions.length}</div>
                                                        <button
                                                            type="button"
                                                            onClick={(e) => {
                                                                e.stopPropagation()
                                                                void handleCreateSessionFromSidebar(group.path || undefined)
                                                            }}
                                                            className="ml-auto inline-flex h-5 w-5 items-center justify-center rounded-md bg-white/[0.03] text-white/55 opacity-0 transition-all hover:bg-white/[0.08] hover:text-white group-hover/project:opacity-100"
                                                            aria-label={`New chat in ${group.label}`}
                                                            title={`New chat in ${group.label}`}
                                                        >
                                                            <Plus size={11} />
                                                        </button>
                                                    </div>
                                                </button>
                                            </div>
                                            <AnimatedHeight isOpen={isExpanded} duration={220}>
                                                <div className="relative ml-5 space-y-0.5 pl-1.5 pb-2 before:absolute before:bottom-2 before:left-0 before:top-0 before:w-px before:bg-white/20">
                                                    {group.sessions.map((session) => (
                                                        <div key={session.id} className="group/session relative rounded-lg transition-colors hover:bg-white/[0.04]">
                                                            <button type="button" onClick={() => void handleSelectSessionFromSidebar(session.id)} className={cn('flex w-full min-w-0 items-center gap-2 rounded-lg px-2.5 py-2 pr-24 text-left transition-colors', activeSessionId === session.id ? 'bg-white/[0.08] text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]' : 'text-white/68 hover:text-white/88')}>
                                                                <span className={cn(
                                                                    'h-1.5 w-1.5 shrink-0 rounded-full transition-colors',
                                                                    activeSessionId === session.id && isThinking
                                                                        ? 'bg-blue-400 animate-pulse'
                                                                        : activeSessionId === session.id
                                                                            ? 'bg-[var(--accent-primary)]'
                                                                            : 'bg-white/18'
                                                                )} />
                                                                <div className="min-w-0 flex-1">
                                                                    <div className={cn('truncate text-xs font-medium', activeSessionId === session.id ? 'text-white' : 'text-white/80')}>{getDisplayTitle(session.title)}</div>
                                                                    <div className="flex items-center gap-1.5 text-[10px] text-white/34"><span>{formatRelativeTime(session.updatedAt || session.createdAt)}</span><span>•</span><span>{Number(session.messageCount || 0)} msgs</span></div>
                                                                </div>
                                                            </button>
                                                            <div className="pointer-events-none absolute right-1 top-1/2 flex -translate-y-1/2 items-center gap-0.5 opacity-0 transition-opacity group-hover/session:pointer-events-auto group-hover/session:opacity-100">
                                                                <button type="button" onClick={() => void handleRenameSessionRequest(session)} className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-sparkle-card/90 text-white/34 backdrop-blur-sm transition hover:bg-white/[0.05] hover:text-white"><Pencil size={11} /></button>
                                                                <button type="button" onClick={() => void onArchiveSession(session.id, true)} className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-sparkle-card/90 text-white/34 backdrop-blur-sm transition hover:bg-white/[0.05] hover:text-white"><Archive size={11} /></button>
                                                                <button type="button" onClick={() => setSessionToDelete(session)} className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-sparkle-card/90 text-white/34 backdrop-blur-sm transition hover:bg-rose-500/10 hover:text-rose-300"><Trash2 size={11} /></button>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </AnimatedHeight>
                                        </div>
                                    )
                                })}
                                </div>
                                {archivedSessions.length > 0 && (
                                    <div className="mt-auto overflow-hidden rounded-xl border-t border-white/5 pt-2">
                                        <button type="button" onClick={() => setShowArchivedSessions((prev) => !prev)} className="flex w-full items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-white/[0.04]">
                                            <ChevronRight size={14} className={cn('shrink-0 text-white/35 transition-transform', showArchivedSessions && 'rotate-90')} />
                                            <Archive size={14} className="shrink-0 text-white/52" />
                                            <div className="min-w-0 flex-1">
                                                <div className="truncate text-xs font-medium text-white/86">Archived</div>
                                                <div className="truncate text-[10px] text-white/34">{archivedSessions.length} chats</div>
                                            </div>
                                        </button>
                                        <AnimatedHeight isOpen={showArchivedSessions} duration={220}>
                                            <div className="space-y-1 px-2 pb-2">
                                                {archivedSessions.map((session) => (
                                                    <div key={`archived-${session.id}`} className="group/session relative rounded-lg transition-colors hover:bg-white/[0.04]">
                                                        <div className="relative flex items-center">
                                                            <button type="button" onClick={() => void handleSelectSessionFromSidebar(session.id)} className={cn('flex min-w-0 flex-1 items-center gap-2 rounded-lg px-2.5 py-2 pr-3 text-left transition-colors', activeSessionId === session.id ? 'bg-white/[0.08] text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]' : 'text-white/68 hover:text-white/88')}>
                                                                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-white/20" />
                                                                <div className="min-w-0 flex-1">
                                                                    <div className={cn('truncate text-xs font-medium', activeSessionId === session.id ? 'text-white' : 'text-white/80')}>{getDisplayTitle(session.title)}</div>
                                                                    <div className="text-[10px] text-white/34">{formatRelativeTime(session.updatedAt || session.createdAt)}</div>
                                                                </div>
                                                            </button>
                                                            <div className="pointer-events-none absolute right-1 top-1/2 flex -translate-y-1/2 items-center gap-0.5 opacity-0 transition-opacity group-hover/session:pointer-events-auto group-hover/session:opacity-100 focus-within:pointer-events-auto focus-within:opacity-100">
                                                                <button type="button" onClick={() => void onArchiveSession(session.id, false)} className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-sparkle-card/90 text-white/34 backdrop-blur-sm transition hover:bg-white/[0.05] hover:text-white"><ArchiveRestore size={12} /></button>
                                                                <button type="button" onClick={() => setSessionToDelete(session)} className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-sparkle-card/90 text-white/34 backdrop-blur-sm transition hover:bg-rose-500/10 hover:text-rose-300"><Trash2 size={12} /></button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </AnimatedHeight>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </aside>
            <ConfirmModal isOpen={Boolean(sessionToDelete)} title="Delete chat" message={`Delete "${sessionToDelete ? getDisplayTitle(sessionToDelete.title) : 'this chat'}"? This cannot be undone.`} confirmLabel="Delete" cancelLabel="Cancel" variant="danger" onCancel={() => setSessionToDelete(null)} onConfirm={() => { if (sessionToDelete) void onDeleteSession(sessionToDelete.id); setSessionToDelete(null) }} />
        </>
    )
}
