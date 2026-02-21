import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Archive, Edit2, MessageSquare, PanelLeft, PanelLeftClose, Plus, Shield, Settings2, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'

export type AssistantSessionSidebarItem = {
    id: string
    title: string
    updatedAt: number
}

type AssistantSessionsSidebarProps = {
    collapsed: boolean
    width: number
    sessions: AssistantSessionSidebarItem[]
    activeSessionId: string | null
    onSetCollapsed: (collapsed: boolean) => void
    onCreateSession: () => Promise<void>
    onSelectSession: (sessionId: string) => Promise<void>
    onRenameSession: (sessionId: string, nextTitle: string) => Promise<void>
    onArchiveSession: (sessionId: string) => Promise<void>
    onDeleteSession: (sessionId: string) => Promise<void>
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

    const getDisplayTitle = (title: string): string => {
        const trimmed = String(title || '').trim()
        return trimmed || 'Untitled Session'
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

    const handleDelete = async (sessionId: string) => {
        if (!window.confirm('Delete this session permanently?')) return
        await onDeleteSession(sessionId)
    }

    return (
        <aside
            className={cn(
                'relative h-full shrink-0 overflow-x-hidden border-r border-sparkle-border-secondary bg-sparkle-bg transition-[width] duration-300 ease-in-out',
                collapsed ? 'w-16' : 'w-72'
            )}
            style={!collapsed ? { width } : undefined}
        >
            {collapsed ? (
                <div className="flex h-full flex-col items-center gap-2 px-2 pb-3 pt-4">
                    <button
                        type="button"
                        onClick={() => onSetCollapsed(false)}
                        className="rounded-lg border border-sparkle-border-secondary bg-sparkle-card/70 p-2 text-sparkle-text-secondary transition-colors hover:bg-sparkle-accent/40 hover:text-sparkle-text"
                        title="Expand sidebar"
                    >
                        <PanelLeft size={14} />
                    </button>
                    <button
                        type="button"
                        onClick={() => void onCreateSession()}
                        className="rounded-lg border border-sparkle-border-secondary bg-sparkle-card/70 p-2 text-sparkle-text-secondary transition-colors hover:border-[var(--accent-primary)]/40 hover:bg-[var(--accent-primary)]/10 hover:text-[var(--accent-primary)]"
                        title="New chat"
                    >
                        <Plus size={14} />
                    </button>

                    <div className="my-2 h-px w-8 bg-sparkle-border-secondary" />

                    <div className="flex w-full flex-1 flex-col items-center gap-2 overflow-y-auto pb-2 pt-1">
                        {sessions.map((session) => {
                            const isActive = session.id === activeSessionId
                            return (
                                <button
                                    key={session.id}
                                    onClick={() => void onSelectSession(session.id)}
                                    title={session.title || 'Untitled Session'}
                                    className={cn(
                                        'flex h-9 w-9 items-center justify-center rounded-full border text-xs font-semibold transition-colors focus:outline-none focus-visible:outline-none',
                                        isActive
                                            ? 'border-transparent bg-sparkle-text text-sparkle-bg ring-1 ring-[var(--accent-primary)]/28 shadow-[0_0_0_1px_rgba(0,0,0,0.1)]'
                                            : 'border-transparent bg-sparkle-card/70 text-sparkle-text-secondary hover:bg-sparkle-accent/40 hover:text-sparkle-text'
                                    )}
                                >
                                    {getDisplayTitle(session.title).charAt(0).toUpperCase()}
                                </button>
                            )
                        })}
                    </div>

                    <Link
                        to="/settings/assistant"
                        className="rounded-lg border border-sparkle-border-secondary bg-sparkle-card/70 p-2 text-sparkle-text-secondary transition-colors hover:bg-sparkle-accent/40 hover:text-sparkle-text"
                        title="Assistant settings"
                    >
                        <Shield size={14} />
                    </Link>
                </div>
            ) : (
                <div className="flex h-full flex-col px-4 pb-4 pt-5">
                    <div className="mb-3 flex items-center justify-between gap-2">
                        <button
                            type="button"
                            onClick={() => onSetCollapsed(true)}
                            className="rounded-lg border border-sparkle-border-secondary bg-sparkle-card/70 p-1.5 transition-colors hover:bg-sparkle-accent/40"
                            title="Collapse sidebar"
                        >
                            <PanelLeftClose size={14} className="text-sparkle-text-secondary" />
                        </button>
                        <div className="flex items-center gap-2">
                            <Link
                                to="/settings/assistant"
                                className="rounded-lg border border-sparkle-border-secondary bg-sparkle-card/70 p-1.5 text-sparkle-text-secondary transition-colors hover:bg-sparkle-accent/40 hover:text-sparkle-text"
                                title="Assistant settings"
                            >
                                <Settings2 size={14} />
                            </Link>
                            <button
                                type="button"
                                onClick={() => void onCreateSession()}
                                className="rounded-lg border border-sparkle-border-secondary bg-sparkle-card/70 p-1.5 transition-colors hover:border-[var(--accent-primary)]/40 hover:bg-[var(--accent-primary)]/10 hover:text-[var(--accent-primary)]"
                                title="New chat"
                            >
                                <Plus size={14} />
                            </button>
                        </div>
                    </div>

                    <div className="mb-3 rounded-lg border border-sparkle-border-secondary bg-sparkle-accent/40 px-3 py-2">
                        <div className="mb-1 h-px w-10 bg-[var(--accent-primary)]/55" />
                        <p className="text-[10px] uppercase tracking-widest text-sparkle-text-secondary">Sessions</p>
                        <h3 className="mt-1 text-sm font-semibold text-sparkle-text">Recent Conversations</h3>
                    </div>

                    <div className="flex-1 space-y-1.5 overflow-y-auto pt-1">
                        {sessions.map((session) => (
                            <div key={session.id} className="group relative">
                                <button
                                    className={cn(
                                        'w-full rounded-lg border border-l-4 px-3 py-2 pr-16 text-left transition-colors duration-150 focus-visible:outline-none',
                                        session.id === activeSessionId
                                            ? 'border-transparent border-l-[var(--accent-primary)] bg-[var(--accent-primary)]/14 text-sparkle-text'
                                            : 'border-sparkle-border-secondary border-l-transparent bg-sparkle-card/70 text-sparkle-text-secondary hover:border-[var(--accent-primary)]/25 hover:bg-sparkle-accent/40 hover:text-sparkle-text'
                                    )}
                                    onClick={() => void onSelectSession(session.id)}
                                >
                                    <div className="mb-1 flex items-center gap-2">
                                        <MessageSquare
                                            size={12}
                                            className={session.id === activeSessionId ? 'text-[var(--accent-primary)]' : 'text-sparkle-text-secondary'}
                                        />
                                        <span className={cn(
                                            'text-[11px] font-medium',
                                            session.id === activeSessionId ? 'text-sparkle-text-secondary' : 'text-sparkle-text-secondary'
                                        )}>
                                            {new Date(session.updatedAt).toLocaleDateString()}
                                        </span>
                                    </div>
                                    <div className={cn(
                                        'truncate text-[15px] font-semibold',
                                        session.id === activeSessionId ? 'text-sparkle-text' : 'text-sparkle-text'
                                    )}>
                                        {getDisplayTitle(session.title)}
                                    </div>
                                </button>
                                <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center rounded-md border border-sparkle-border-secondary bg-sparkle-bg/95 px-1 opacity-0 backdrop-blur-sm transition-opacity group-hover:opacity-100">
                                    <button
                                        onClick={() => openRenameModal(session)}
                                        className="p-1.5 text-sparkle-text-muted transition-colors hover:text-sparkle-text"
                                        title="Rename"
                                    >
                                        <Edit2 size={12} />
                                    </button>
                                    <button
                                        onClick={() => void onArchiveSession(session.id)}
                                        className="p-1.5 text-sparkle-text-muted transition-colors hover:text-sparkle-text"
                                        title="Archive"
                                    >
                                        <Archive size={12} />
                                    </button>
                                    <button
                                        onClick={() => void handleDelete(session.id)}
                                        className="p-1.5 text-sparkle-text-muted transition-colors hover:text-amber-400"
                                        title="Delete"
                                    >
                                        <Trash2 size={12} />
                                    </button>
                                </div>
                            </div>
                        ))}

                        {sessions.length === 0 && (
                            <div className="rounded-lg border border-dashed border-sparkle-border-secondary bg-sparkle-card/40 px-3 py-3 text-xs text-sparkle-text-muted">
                                No active sessions found.
                            </div>
                        )}
                    </div>
                </div>
            )}
            {renameTarget && (
                <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/45 p-3 backdrop-blur-sm">
                    <div className="w-full max-w-sm rounded-xl border border-sparkle-border-secondary bg-sparkle-card p-4 shadow-2xl">
                        <h3 className="text-sm font-semibold text-sparkle-text">Edit Thread Title</h3>
                        <p className="mt-1 text-xs text-sparkle-text-muted">
                            Update the chat thread title shown in the sidebar and used for first-turn context.
                        </p>
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
                            className="mt-3 w-full rounded-lg border border-sparkle-border-secondary bg-sparkle-bg px-3 py-2 text-sm text-sparkle-text outline-none transition-colors focus:border-[var(--accent-primary)]/45"
                            placeholder="Thread title"
                            maxLength={120}
                        />
                        <div className="mt-3 flex items-center justify-end gap-2">
                            <button
                                type="button"
                                onClick={closeRenameModal}
                                className="rounded-lg border border-sparkle-border-secondary px-3 py-1.5 text-xs text-sparkle-text-secondary transition-colors hover:bg-sparkle-accent/40 hover:text-sparkle-text"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={() => void submitRename()}
                                disabled={!renameDraft.trim()}
                                className={cn(
                                    'rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors',
                                    renameDraft.trim()
                                        ? 'bg-[var(--accent-primary)] text-white hover:bg-[var(--accent-primary)]/85'
                                        : 'cursor-not-allowed bg-sparkle-border text-sparkle-text-muted'
                                )}
                            >
                                Save Title
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </aside>
    )
}
