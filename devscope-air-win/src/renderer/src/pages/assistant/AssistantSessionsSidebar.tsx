import { useEffect, useMemo, useState } from 'react'
import { AnimatedHeight } from '@/components/ui/AnimatedHeight'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { Link } from 'react-router-dom'
import {
    Archive,
    ChevronDown,
    ChevronRight,
    Edit2,
    Folder,
    FolderOpen,
    MessageSquarePlus,
    PanelLeft,
    PanelLeftClose,
    Plus,
    Shield,
    Settings2,
    Sparkles,
    Trash2
} from 'lucide-react'
import { cn } from '@/lib/utils'

export type AssistantSessionSidebarItem = {
    id: string
    title: string
    createdAt: number
    updatedAt: number
    projectPath?: string
}

type AssistantSessionsSidebarProps = {
    collapsed: boolean
    width: number
    sessions: AssistantSessionSidebarItem[]
    activeSessionId: string | null
    onSetCollapsed: (collapsed: boolean) => void
    onCreateSession: (projectPath?: string) => Promise<void>
    onSelectSession: (sessionId: string) => Promise<void>
    onRenameSession: (sessionId: string, nextTitle: string) => Promise<void>
    onArchiveSession: (sessionId: string) => Promise<void>
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
    sessions,
    activeSessionId,
    onSetCollapsed,
    onCreateSession,
    onSelectSession,
    onRenameSession,
    onArchiveSession,
    onDeleteSession
}: AssistantSessionsSidebarProps) {
    const [renameTarget, setRenameTarget] = useState<AssistantSessionSidebarItem | null>(null)
    const [renameDraft, setRenameDraft] = useState('')
    const [sessionToDelete, setSessionToDelete] = useState<AssistantSessionSidebarItem | null>(null)
    const [expandedGroupKeys, setExpandedGroupKeys] = useState<Set<string>>(new Set())
    const [showAllGroupKeys, setShowAllGroupKeys] = useState<Set<string>>(new Set())

    const getDisplayTitle = (title: string): string => {
        const trimmed = String(title || '').trim()
        return trimmed || 'Untitled Session'
    }

    const groupedSessions = useMemo<SessionDirectoryGroup[]>(() => {
        const byKey = new Map<string, SessionDirectoryGroup>()
        for (const session of sessions) {
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
            // Sort groups by their newest thread creation time
            .sort((a, b) => b.createdAt - a.createdAt)
    }, [sessions, activeSessionId])

    useEffect(() => {
        setExpandedGroupKeys((prev) => {
            const validKeys = new Set(groupedSessions.map((group) => group.key))
            const next = new Set(Array.from(prev).filter((key) => validKeys.has(key)))

            for (const group of groupedSessions) {
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

    const toggleShowAll = (key: string) => {
        setShowAllGroupKeys((prev) => {
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

    const confirmDelete = async () => {
        if (!sessionToDelete) return
        await onDeleteSession(sessionToDelete.id)
        setSessionToDelete(null)
    }

    return (
        <aside
            className={cn(
                'relative h-full shrink-0 overflow-x-hidden border-r border-sparkle-border bg-sparkle-bg transition-[width] duration-500 [transition-timing-function:cubic-bezier(0.16,1,0.3,1)]',
                collapsed ? 'w-16' : 'w-72'
            )}
            style={!collapsed ? { width } : undefined}
        >
            {/* Decorative top gradient bar */}
            <div
                className="pointer-events-none absolute left-0 right-0 top-0 h-32 opacity-40 transition-opacity duration-500"
                style={{
                    background: `linear-gradient(180deg, color-mix(in srgb, var(--accent-primary), transparent 55%) 0%, transparent 100%)`
                }}
            />

            {collapsed ? (
                <div className="relative z-10 flex h-full flex-col items-center gap-4 px-2 pb-4 pt-4">
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
                        onClick={() => void onCreateSession()}
                        className="group relative flex h-9 w-9 items-center justify-center rounded-lg text-sparkle-text-secondary transition-colors hover:bg-sparkle-card-hover hover:text-sparkle-text"
                        title="New thread"
                    >
                        <MessageSquarePlus size={18} />
                    </button>

                    {/* Accent divider */}
                    <div className="my-1 flex w-8 flex-col items-center gap-1.5">
                        <div className="h-px w-full bg-white/5" />
                    </div>


                    {/* Collapsed session avatars */}
                    <div className="flex w-full flex-1 flex-col items-center gap-2.5 overflow-y-auto pb-2 pt-1 no-scrollbar">
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
                                        'relative flex h-8 w-8 items-center justify-center rounded-lg text-[10px] font-bold transition-all duration-200 focus:outline-none',
                                        hasActive
                                            ? 'bg-[var(--accent-primary)] text-white ring-1 ring-[var(--accent-primary)]/40 shadow-sm'
                                            : 'bg-sparkle-card/50 text-sparkle-text-secondary hover:bg-sparkle-card-hover hover:text-sparkle-text'
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
                <div className="relative z-10 flex h-full flex-col px-4 pb-4 pt-4">
                    {/* ── Sidebar Toggle (Absolute positioned) ── */}
                    <button
                        type="button"
                        onClick={() => onSetCollapsed(true)}
                        className="absolute right-3 top-3 z-20 rounded-lg p-1.5 text-sparkle-text-secondary/70 transition-all hover:bg-sparkle-card-hover hover:text-sparkle-text"
                        title="Collapse sidebar"
                    >
                        <ChevronRight size={18} className="rotate-180" />
                    </button>

                    {/* ── Header actions ── */}
                    <div className="mb-6 flex flex-col gap-1 pt-2">
                        <button
                            type="button"
                            onClick={() => void onCreateSession()}
                            className="flex items-center gap-3 rounded-lg px-2 py-2 text-sparkle-text-secondary transition-colors hover:bg-sparkle-card-hover hover:text-sparkle-text"
                        >
                            <MessageSquarePlus size={18} />
                            <span className="text-sm font-medium">New thread</span>
                        </button>

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

                        <button
                            type="button"
                            className="flex items-center gap-3 rounded-lg px-2 py-2 text-sparkle-text-secondary transition-colors hover:bg-sparkle-card-hover hover:text-sparkle-text"
                        >
                            <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" /><polyline points="3.29 7 12 12 20.71 7" /><line x1="12" y1="22" x2="12" y2="12" /></svg>
                            <span className="text-sm font-medium">Skills</span>
                        </button>
                    </div>

                    {/* ── Threads Section Label (Divider style) ── */}
                    <div className="mb-4 flex items-center gap-3 px-1">
                        <div className="h-px flex-1 bg-white/5" />
                        <h3 className="shrink-0 text-[10px] font-bold uppercase tracking-[0.2em] text-sparkle-text-muted/40">Threads</h3>
                        <div className="h-px flex-1 bg-white/5" />
                    </div>

                    {/* ── Session list ── */}
                    <div className="flex-1 space-y-4 overflow-y-auto no-scrollbar">
                        {groupedSessions.map((group) => {
                            const isExpanded = expandedGroupKeys.has(group.key)
                            const isShowingAll = showAllGroupKeys.has(group.key)
                            const groupHasActiveSession = group.sessions.some((session) => session.id === activeSessionId)
                            const visibleSessions = isShowingAll ? group.sessions : group.sessions.slice(0, 6)

                            return (
                                <section key={group.key} className="space-y-1">
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
                                            'truncate text-[13px] font-semibold transition-colors flex-1',
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
                                        <div className="ml-4 space-y-0.5 border-l border-white/5 pb-2 pl-2 pt-1">
                                            {visibleSessions.map((session) => {
                                                const isActive = session.id === activeSessionId
                                                const timeAgo = Math.floor((Date.now() - (session.createdAt || session.updatedAt)) / 3600000)
                                                const timeLabel = timeAgo < 1 ? 'now' : timeAgo < 24 ? `${timeAgo}h` : `${Math.floor(timeAgo / 24)}d`

                                                return (
                                                    <div
                                                        key={session.id}
                                                        className={cn(
                                                            'group relative flex items-center gap-3 rounded-lg border px-3 py-2.5 transition-all duration-200 backdrop-blur-[2px]',
                                                            isActive
                                                                ? 'border-white/10 bg-[var(--accent-primary)]/10 text-[var(--accent-primary)] shadow-[0_2px_10px_rgba(0,0,0,0.05)]'
                                                                : 'border-white/5 bg-sparkle-bg/40 text-sparkle-text-secondary hover:border-sparkle-border hover:bg-sparkle-card-hover/60 hover:text-sparkle-text'
                                                        )}
                                                    >
                                                        <button
                                                            className="flex-1 truncate text-left text-[13px] font-medium outline-none"
                                                            onClick={() => void onSelectSession(session.id)}
                                                            title={getDisplayTitle(session.title)}
                                                        >
                                                            {getDisplayTitle(session.title)}
                                                        </button>

                                                        <span className="shrink-0 rounded-[4px] border border-white/5 bg-sparkle-bg/50 px-1.5 py-0.5 font-mono text-[9px] font-bold text-sparkle-text-muted/60 tabular-nums uppercase tracking-wide transition-colors group-hover:text-sparkle-text-muted">
                                                            {timeLabel}
                                                        </span>

                                                        {/* Hover actions */}
                                                        <div className="absolute right-1 top-1/2 hidden -translate-y-1/2 items-center gap-0.5 rounded-md border border-white/10 bg-sparkle-card p-0.5 shadow-sm group-hover:flex">
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

                                            {/* Show more toggle */}
                                            {group.sessions.length > 6 && (
                                                <button
                                                    onClick={() => toggleShowAll(group.key)}
                                                    className="mt-1 flex w-full items-center gap-2 px-3 py-1 text-[11px] font-semibold text-[var(--accent-primary)]/80 transition-colors hover:text-[var(--accent-primary)]"
                                                >
                                                    {isShowingAll ? (
                                                        <>
                                                            <ChevronDown size={12} className="rotate-180" />
                                                            <span>Show less</span>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <ChevronRight size={12} className="rotate-90" />
                                                            <span>Show more ({group.sessions.length - 6})</span>
                                                        </>
                                                    )}
                                                </button>
                                            )}
                                        </div>
                                    </AnimatedHeight>
                                </section>
                            )
                        })}

                        {groupedSessions.length === 0 && (
                            <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
                                <MessageSquarePlus size={24} className="text-sparkle-text-muted/30" />
                                <p className="text-xs text-sparkle-text-muted">No threads yet</p>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {renameTarget && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center p-4"
                    onClick={closeRenameModal}
                >
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-md animate-fadeIn" />
                    <div
                        className="relative w-full max-w-sm overflow-hidden rounded-[24px] border border-sparkle-border bg-sparkle-card shadow-2xl animate-scaleIn"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-[var(--accent-primary)]/40 via-[var(--accent-primary)]/10 to-transparent" />

                        <div className="p-6">
                            <h3 className="text-lg font-bold tracking-tight text-white mb-1">Rename Thread</h3>
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
                </div>
            )}

            <ConfirmModal
                isOpen={!!sessionToDelete}
                title="Delete Thread?"
                message={`Are you sure you want to delete "${sessionToDelete?.title || 'this session'}"? This action cannot be undone.`}
                confirmLabel="Delete Session"
                onConfirm={confirmDelete}
                onCancel={() => setSessionToDelete(null)}
                variant="danger"
            />
        </aside>
    )
}
