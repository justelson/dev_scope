import { createPortal } from 'react-dom'
import { Archive, ArchiveRestore, ChevronRight, Edit2, Folder, FolderOpen, MessageSquarePlus, Plus, SquarePen, Trash2 } from 'lucide-react'
import type { AssistantSession } from '@shared/assistant/contracts'
import { AnimatedHeight } from '@/components/ui/AnimatedHeight'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { cn } from '@/lib/utils'
import { formatAssistantRelativeTime } from '@/lib/assistant/selectors'
import { getDisplayTitle, resolveSessionStatusPill, type SessionProjectGroup } from './assistant-sessions-rail-utils'

function SessionRow({
    session,
    activeSessionId,
    archived = false,
    compact = false,
    onSelectSession,
    onOpenRename,
    onArchiveSession,
    onDeleteRequest
}: {
    session: AssistantSession
    activeSessionId: string | null
    archived?: boolean
    compact?: boolean
    onSelectSession: (sessionId: string) => void
    onOpenRename: (session: AssistantSession) => void
    onArchiveSession: (sessionId: string, archived?: boolean) => void
    onDeleteRequest: (session: AssistantSession) => void
}) {
    const isActive = session.id === activeSessionId
    const timeLabel = formatAssistantRelativeTime(session.updatedAt)
    const statusPill = resolveSessionStatusPill(session)

    return (
        <div key={session.id} className="group/menu-item relative" data-thread-item>
            <button
                type="button"
                onClick={() => onSelectSession(session.id)}
                className={cn('flex w-full min-w-0 items-center gap-1.5 rounded-md py-1.5 pr-2 text-left transition-colors select-none cursor-default', compact ? 'pl-2.5' : 'pl-3.5', isActive ? 'bg-white/[0.07] text-sparkle-text font-medium' : 'text-sparkle-text-secondary hover:bg-white/[0.04] hover:text-sparkle-text')}
            >
                {statusPill ? <span className={cn('inline-flex items-center gap-1 text-[10px] shrink-0', statusPill.colorClass)}><span className={cn('h-1.5 w-1.5 rounded-full', statusPill.dotClass, statusPill.pulse && 'animate-pulse')} /><span className="hidden md:inline">{statusPill.label}</span></span> : null}
                <span className="min-w-0 flex-1 truncate text-xs">{getDisplayTitle(session.title)}</span>
                <span className={cn('shrink-0 text-[10px]', isActive ? 'text-sparkle-text/60' : 'text-sparkle-text-muted/40')}>{timeLabel}</span>
            </button>
            <div className="absolute right-1 top-1/2 hidden -translate-y-1/2 items-center gap-0.5 rounded-md border border-white/10 bg-sparkle-card p-0.5 shadow-lg/10 group-hover/menu-item:flex">
                {!archived && <>
                    <button type="button" onClick={(event) => { event.stopPropagation(); onOpenRename(session) }} className="rounded p-1 text-sparkle-text-secondary/60 transition-colors hover:bg-white/[0.05] hover:text-sparkle-text" title="Rename"><Edit2 size={11} /></button>
                    <button type="button" onClick={(event) => { event.stopPropagation(); onArchiveSession(session.id, true) }} className="rounded p-1 text-sparkle-text-secondary/60 transition-colors hover:bg-amber-500/10 hover:text-amber-300" title="Archive"><Archive size={11} /></button>
                </>}
                {archived && <button type="button" onClick={(event) => { event.stopPropagation(); onArchiveSession(session.id, false) }} className="rounded p-1 text-sparkle-text-secondary/60 transition-colors hover:bg-emerald-500/10 hover:text-emerald-300" title="Restore"><ArchiveRestore size={11} /></button>}
                <button type="button" onClick={(event) => { event.stopPropagation(); onDeleteRequest(session) }} className="rounded p-1 text-sparkle-text-secondary/60 transition-colors hover:bg-red-500/10 hover:text-red-500" title="Delete"><Trash2 size={11} /></button>
            </div>
        </div>
    )
}

export function CollapsedSessionsRailContent({
    compact,
    groupedSessions,
    activeSessionId,
    onSetCollapsed,
    onSelectSession
}: {
    compact: boolean
    groupedSessions: SessionProjectGroup[]
    activeSessionId: string | null
    onSetCollapsed: (collapsed: boolean) => void
    onSelectSession: (sessionId: string) => void
}) {
    return (
        <div className={cn('relative z-10 flex h-full flex-col items-center px-2 pb-3 pt-3', compact ? 'gap-2.5' : 'gap-3')}>
            <button type="button" onClick={() => onSetCollapsed(false)} className="rounded-lg p-1.5 text-sparkle-text-secondary/70 transition-all hover:bg-white/[0.03] hover:text-sparkle-text" title="Expand sidebar"><ChevronRight size={18} /></button>
            <div className={cn('my-1 flex flex-col items-center gap-1.5', compact ? 'w-7' : 'w-8')}><div className="h-px w-full bg-white/10" /></div>
            <div className={cn('flex w-full flex-1 flex-col items-center overflow-y-auto pb-2 pt-1 no-scrollbar', compact ? 'gap-1.5' : 'gap-2')}>
                {groupedSessions.map((group) => {
                    const primarySession = group.sessions[0]
                    const hasActive = group.sessions.some((session) => session.id === activeSessionId)
                    if (!primarySession) return null
                    return (
                        <button key={group.key} type="button" onClick={() => onSelectSession(primarySession.id)} title={group.path || 'No directory'} className={cn('relative flex items-center justify-center rounded-md border text-[10px] font-bold transition-all duration-200 focus:outline-none', compact ? 'h-7 w-7' : 'h-8 w-8', hasActive ? 'border-white/10 bg-white/[0.05] text-[var(--accent-primary)]' : 'border-transparent bg-transparent text-sparkle-text-secondary hover:border-white/10 hover:bg-white/[0.03] hover:text-sparkle-text')}>
                            {group.label.charAt(0).toUpperCase() || 'D'}
                        </button>
                    )
                })}
            </div>
            <div className={cn('flex flex-col items-center gap-1.5', compact ? 'w-7' : 'w-8')}><div className="h-px w-full bg-white/10" /></div>
        </div>
    )
}

export function ExpandedSessionsRailContent(props: {
    compact: boolean
    commandPending: boolean
    groupedSessions: SessionProjectGroup[]
    groupedArchivedSessions: SessionProjectGroup[]
    activeSessionId: string | null
    expandedGroupKeys: Set<string>
    showArchivedSessions: boolean
    onToggleGroup: (key: string) => void
    onChooseProjectPath: () => void
    onCreateSession: (projectPath?: string) => void
    onSelectSession: (sessionId: string) => void
    onOpenRename: (session: AssistantSession) => void
    onArchiveSession: (sessionId: string, archived?: boolean) => void
    onDeleteRequest: (session: AssistantSession) => void
    onSetShowArchivedSessions: (value: boolean) => void
    onSetCollapsed: (collapsed: boolean) => void
}) {
    const { compact, commandPending, groupedSessions, groupedArchivedSessions, activeSessionId, expandedGroupKeys, showArchivedSessions, onToggleGroup, onChooseProjectPath, onCreateSession, onSelectSession, onOpenRename, onArchiveSession, onDeleteRequest, onSetShowArchivedSessions, onSetCollapsed } = props
    const archivedCount = groupedArchivedSessions.reduce((sum, group) => sum + group.sessions.length, 0)

    return (
        <div className={cn('relative z-10 flex h-full flex-col', compact ? 'px-2.5' : 'px-3')}>
            <div className="flex items-center justify-between gap-2 py-3 px-1">
                <div className="flex min-w-0 flex-1 items-center gap-1.5"><span className="text-sm font-semibold tracking-tight text-sparkle-text">T3 x dvs</span><span className="rounded-full bg-white/[0.06] px-1.5 py-0.5 text-[8px] font-medium uppercase tracking-[0.18em] text-sparkle-text-muted/60">Alpha</span></div>
                <button type="button" onClick={() => onSetCollapsed(true)} className="rounded-md p-1 text-sparkle-text-muted/60 transition-colors hover:bg-white/[0.04] hover:text-sparkle-text" title="Collapse sidebar"><ChevronRight size={16} className="rotate-180" /></button>
            </div>
            <div className="mb-3 px-2">
                <button type="button" onClick={() => onChooseProjectPath()} disabled={commandPending} className="flex w-full items-center justify-center gap-2 rounded-md border border-dashed border-white/10 bg-white/[0.02] px-3 py-2 text-xs text-sparkle-text-muted/70 transition-all hover:border-[var(--accent-primary)]/50 hover:bg-[var(--accent-primary)]/10 hover:text-[var(--accent-primary)] disabled:opacity-40" title="Add project (Open Folder)"><Plus size={14} /><span>Add Project</span></button>
            </div>
            <div className="relative mb-3 flex items-center px-3"><div className="h-px flex-1 bg-white/5" /><span className="px-3 text-[10px] tracking-wide text-sparkle-text-muted/25">Projects</span><div className="h-px flex-1 bg-white/5" /></div>
            <div className="min-h-0 flex-1 overflow-y-auto pr-1 scrollbar-hide">
                <div className="space-y-0.5">
                    {groupedSessions.map((group) => {
                        const isExpanded = expandedGroupKeys.has(group.key)
                        return (
                            <section key={group.key}>
                                <div className="group/project-header relative">
                                    <button type="button" onClick={() => onToggleGroup(group.key)} className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-white/[0.04] group-hover/project-header:bg-white/[0.04]">
                                        <ChevronRight size={14} className={cn('-ml-0.5 shrink-0 text-sparkle-text-muted/70 transition-transform duration-150', isExpanded && 'rotate-90')} />
                                        {isExpanded ? <FolderOpen size={14} className="shrink-0 text-sparkle-text-muted/50" /> : <Folder size={14} className="shrink-0 text-sparkle-text-muted/50" />}
                                        <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-hidden"><span className="truncate text-xs font-medium text-sparkle-text/90">{group.label}</span><span className="shrink-0 text-[10px] text-sparkle-text-muted/40 font-mono">({group.sessions.length})</span></div>
                                    </button>
                                    <button type="button" onClick={(event) => { event.stopPropagation(); onCreateSession(group.path && group.path !== '' ? group.path : undefined) }} className="absolute right-1 top-1 hidden size-5 items-center justify-center rounded-md p-0 text-sparkle-text-muted/70 transition-colors hover:bg-white/[0.06] hover:text-sparkle-text group-hover/project-header:flex" title="New chat in project"><SquarePen size={12} /></button>
                                </div>
                                <AnimatedHeight isOpen={isExpanded} duration={350}>
                                    <div className="ml-3.5 border-l border-white/10 flex min-w-0 flex-col gap-0.5 py-0.5 px-1">
                                        {group.sessions.map((session) => <SessionRow key={session.id} session={session} activeSessionId={activeSessionId} compact={compact} onSelectSession={onSelectSession} onOpenRename={onOpenRename} onArchiveSession={onArchiveSession} onDeleteRequest={onDeleteRequest} />)}
                                    </div>
                                </AnimatedHeight>
                            </section>
                        )
                    })}
                    {groupedSessions.length === 0 && <div className={cn('flex flex-col items-center gap-2 px-4 text-center', compact ? 'py-6' : 'py-8')}><MessageSquarePlus size={compact ? 20 : 24} className="text-sparkle-text-muted/30" /><p className="text-xs text-sparkle-text-muted">No projects yet</p></div>}
                </div>
            </div>
            <div className="mt-auto space-y-0.5 border-t border-white/10 px-1 py-2">
                {archivedCount > 0 && <button type="button" onClick={() => onSetShowArchivedSessions(!showArchivedSessions)} className={cn('group flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs transition-colors', showArchivedSessions ? 'bg-white/[0.06] text-sparkle-text' : 'text-sparkle-text-muted/70 hover:bg-white/[0.04] hover:text-sparkle-text')}><Archive size={14} className={cn('transition-colors', showArchivedSessions ? 'text-amber-400' : 'text-sparkle-text-muted/50')} /><span className="flex-1 text-left">Archived Chats</span><span className="rounded-[4px] border border-white/10 bg-white/[0.03] px-1 py-0.5 text-[9px]">{archivedCount}</span></button>}
                <AnimatedHeight isOpen={showArchivedSessions} duration={300}>
                    <div className="mt-1 max-h-[30vh] overflow-y-auto rounded-lg bg-black/20 p-1 custom-scrollbar">
                        {groupedArchivedSessions.length > 0 ? groupedArchivedSessions.map((group) => (
                            <section key={`footer-archived-${group.key}`} className="space-y-0.5 mb-2 last:mb-0">
                                <div className="flex items-center gap-2 px-2 py-1 text-[10px] text-sparkle-text-muted/40 uppercase tracking-widest"><FolderOpen size={10} /><span className="truncate">{group.label}</span></div>
                                {group.sessions.map((session) => <SessionRow key={session.id} session={session} activeSessionId={activeSessionId} archived compact={compact} onSelectSession={onSelectSession} onOpenRename={onOpenRename} onArchiveSession={onArchiveSession} onDeleteRequest={onDeleteRequest} />)}
                            </section>
                        )) : <div className="py-4 text-center text-[10px] text-sparkle-text-muted/40 italic">No archived sessions</div>}
                    </div>
                </AnimatedHeight>
            </div>
        </div>
    )
}

export function RenameSessionModal({
    renameTarget,
    renameDraft,
    onChangeDraft,
    onClose,
    onSubmit
}: {
    renameTarget: AssistantSession | null
    renameDraft: string
    onChangeDraft: (value: string) => void
    onClose: () => void
    onSubmit: () => void
}) {
    if (!renameTarget || typeof document === 'undefined') return null
    return createPortal(
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4" onClick={onClose}>
            <div className="absolute inset-0 bg-black/60 backdrop-blur-md animate-fadeIn" />
            <div className="relative w-full max-w-sm overflow-hidden rounded-[24px] border border-white/10 bg-sparkle-card shadow-2xl animate-scaleIn" onClick={(event) => event.stopPropagation()}>
                <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-[var(--accent-primary)]/40 via-[var(--accent-primary)]/10 to-transparent" />
                <div className="p-6">
                    <h3 className="mb-1 text-lg font-bold tracking-tight text-white">Rename Session</h3>
                    <p className="mb-5 text-sm text-sparkle-text-secondary">Enter a new descriptive title for this conversation.</p>
                    <div className="relative group">
                        <Edit2 size={14} className="absolute left-3 top-3.5 text-sparkle-text-muted transition-colors group-focus-within:text-[var(--accent-primary)]" />
                        <input autoFocus value={renameDraft} onChange={(event) => onChangeDraft(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); onSubmit() } else if (event.key === 'Escape') { event.preventDefault(); onClose() } }} className="w-full rounded-xl border border-white/10 bg-sparkle-bg py-3 pl-10 pr-4 text-sm text-sparkle-text outline-none transition-all focus:border-[var(--accent-primary)]/40 focus:ring-4 focus:ring-[var(--accent-primary)]/10" placeholder="e.g. Refactoring the login flow" maxLength={160} />
                    </div>
                    <div className="mt-7 flex items-center gap-3">
                        <button type="button" onClick={onClose} className="flex-1 rounded-xl border border-white/10 bg-sparkle-bg px-4 py-2.5 text-sm font-semibold text-sparkle-text-secondary transition-all hover:border-white/20 hover:bg-sparkle-card-hover hover:text-white">Cancel</button>
                        <button type="button" onClick={onSubmit} disabled={!renameDraft.trim()} className={cn('flex-1 rounded-xl px-4 py-2.5 text-sm font-bold transition-all shadow-lg', renameDraft.trim() ? 'bg-[var(--accent-primary)] text-white hover:bg-[var(--accent-primary)]/90 shadow-[var(--accent-primary)]/20 active:scale-[0.98]' : 'bg-sparkle-border/40 text-sparkle-text-muted cursor-not-allowed opacity-50')}>Save Changes</button>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    )
}

export function SessionDeleteModal({
    sessionToDelete,
    onConfirm,
    onCancel
}: {
    sessionToDelete: AssistantSession | null
    onConfirm: () => void
    onCancel: () => void
}) {
    return (
        <ConfirmModal
            isOpen={Boolean(sessionToDelete)}
            title="Delete Session?"
            message={`Are you sure you want to delete "${sessionToDelete?.title || 'this session'}"? This action cannot be undone.`}
            confirmLabel="Delete Session"
            onConfirm={onConfirm}
            onCancel={onCancel}
            variant="danger"
            fullscreen
        />
    )
}
