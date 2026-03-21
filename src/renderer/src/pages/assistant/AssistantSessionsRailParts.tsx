import { createPortal } from 'react-dom'
import { useCallback, useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react'
import {
    DndContext,
    type DragCancelEvent,
    type DragEndEvent,
    type DragStartEvent
} from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { restrictToFirstScrollableAncestor, restrictToVerticalAxis } from '@dnd-kit/modifiers'
import { Archive, ChevronRight, Edit2, MessageSquarePlus, Plus, SquarePen } from 'lucide-react'
import type { AssistantSession } from '@shared/assistant/contracts'
import { AnimatedHeight } from '@/components/ui/AnimatedHeight'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { cn } from '@/lib/utils'
import type { SessionProjectGroup } from './assistant-sessions-rail-utils'
import {
    ProjectGroupIcon,
    SessionRow,
    SortableProjectItem,
    SortableSessionList,
    hasSessionChats,
    useAssistantRailCollisionDetection,
    useAssistantRailSensors
} from './AssistantSessionsRailRows'

const CHAT_PAGE_SIZE = 5

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
    onProjectDragStart: (projectKey: string) => void
    onProjectDragEnd: (activeProjectKey: string, overProjectKey: string | null) => void
    onProjectDragCancel: () => void
    onSessionDragStart: (sessionId: string, projectKey: string) => void
    onSessionDragEnd: (projectKey: string, activeSessionId: string, overSessionId: string | null) => void
    onSessionDragCancel: () => void
}) {
    const {
        compact,
        commandPending,
        groupedSessions,
        groupedArchivedSessions,
        activeSessionId,
        expandedGroupKeys,
        showArchivedSessions,
        onToggleGroup,
        onChooseProjectPath,
        onCreateSession,
        onSelectSession,
        onOpenRename,
        onArchiveSession,
        onDeleteRequest,
        onSetShowArchivedSessions,
        onProjectDragStart,
        onProjectDragEnd,
        onProjectDragCancel,
        onSessionDragStart,
        onSessionDragEnd,
        onSessionDragCancel
    } = props
    const projectSensors = useAssistantRailSensors()
    const collisionDetection = useAssistantRailCollisionDetection()
    const projectDragInProgressRef = useRef(false)
    const suppressProjectClickAfterDragRef = useRef(false)
    const [visibleSessionCountByGroup, setVisibleSessionCountByGroup] = useState<Record<string, number>>({})

    const visibleArchivedGroups = groupedArchivedSessions
        .map((group) => ({ ...group, sessions: group.sessions.filter(hasSessionChats) }))
        .filter((group) => group.sessions.length > 0)
    const archivedCount = visibleArchivedGroups.reduce((sum, group) => sum + group.sessions.length, 0)

    useEffect(() => {
        setVisibleSessionCountByGroup((current) => {
            const nextEntries = groupedSessions.map((group) => [group.key, Math.max(CHAT_PAGE_SIZE, current[group.key] ?? CHAT_PAGE_SIZE)] as const)
            const next = Object.fromEntries(nextEntries)
            const currentKeys = Object.keys(current)
            if (
                currentKeys.length === nextEntries.length
                && currentKeys.every((key) => current[key] === next[key])
            ) {
                return current
            }
            return next
        })
    }, [groupedSessions])

    const handleProjectTitlePointerDownCapture = useCallback(() => {
        suppressProjectClickAfterDragRef.current = false
    }, [])

    const handleProjectTitleClick = useCallback((event: ReactMouseEvent<HTMLButtonElement>, projectKey: string) => {
        if (projectDragInProgressRef.current) {
            event.preventDefault()
            event.stopPropagation()
            return
        }
        if (suppressProjectClickAfterDragRef.current) {
            suppressProjectClickAfterDragRef.current = false
            event.preventDefault()
            event.stopPropagation()
            return
        }
        onToggleGroup(projectKey)
    }, [onToggleGroup])

    const handleProjectSortStart = useCallback((event: DragStartEvent) => {
        projectDragInProgressRef.current = true
        suppressProjectClickAfterDragRef.current = true
        onProjectDragStart(String(event.active.id))
    }, [onProjectDragStart])

    const handleProjectSortEnd = useCallback((event: DragEndEvent) => {
        projectDragInProgressRef.current = false
        onProjectDragEnd(String(event.active.id), event.over ? String(event.over.id) : null)
    }, [onProjectDragEnd])

    const handleProjectSortCancel = useCallback((_event: DragCancelEvent) => {
        projectDragInProgressRef.current = false
        onProjectDragCancel()
    }, [onProjectDragCancel])

    const handleShowMoreSessions = useCallback((groupKey: string) => {
        setVisibleSessionCountByGroup((current) => ({
            ...current,
            [groupKey]: Math.max(CHAT_PAGE_SIZE, current[groupKey] ?? CHAT_PAGE_SIZE) + CHAT_PAGE_SIZE
        }))
    }, [])

    return (
        <div className={cn('relative z-10 flex h-full flex-col', compact ? 'px-2.5' : 'px-3')}>
            <div className="flex items-center justify-between gap-2 px-1 py-3">
                <div className="flex min-w-0 flex-1 items-center gap-1.5">
                    <span className="text-sm font-semibold tracking-tight text-sparkle-text">T3 x dvs</span>
                    <span className="rounded-full bg-white/[0.06] px-1.5 py-0.5 text-[8px] font-medium uppercase tracking-[0.18em] text-sparkle-text-muted/60">Alpha</span>
                </div>
            </div>
            <div className="mb-3 px-2">
                <button type="button" onClick={() => onChooseProjectPath()} disabled={commandPending} className="flex w-full items-center justify-center gap-2 rounded-md border border-dashed border-white/10 bg-white/[0.02] px-3 py-2 text-xs text-sparkle-text-muted/70 transition-all hover:border-[var(--accent-primary)]/50 hover:bg-[var(--accent-primary)]/10 hover:text-[var(--accent-primary)] disabled:opacity-40" title="Add project (Open Folder)"><Plus size={14} /><span>Add Project</span></button>
            </div>
            <div className="relative mb-3 flex items-center px-3"><div className="h-px flex-1 bg-white/5" /><span className="px-3 text-[10px] tracking-wide text-sparkle-text-muted/25">Projects</span><div className="h-px flex-1 bg-white/5" /></div>
            <div className="min-h-0 flex-1 overflow-y-auto pr-1 scrollbar-hide">
                <DndContext
                    sensors={projectSensors}
                    collisionDetection={collisionDetection}
                    modifiers={[restrictToVerticalAxis, restrictToFirstScrollableAncestor]}
                    onDragStart={handleProjectSortStart}
                    onDragEnd={handleProjectSortEnd}
                    onDragCancel={handleProjectSortCancel}
                >
                    <SortableContext items={groupedSessions.map((group) => group.key)} strategy={verticalListSortingStrategy}>
                        <div className="space-y-0.5">
                            {groupedSessions.map((group) => {
                                const isExpanded = expandedGroupKeys.has(group.key)
                                const projectIcon = (
                                    <ProjectGroupIcon
                                        group={group}
                                        size={14}
                                        expanded={isExpanded}
                                    />
                                )
                                const chatSessions = group.sessions.filter(hasSessionChats)
                                const hasChats = chatSessions.length > 0
                                const configuredVisibleCount = Math.max(CHAT_PAGE_SIZE, visibleSessionCountByGroup[group.key] ?? CHAT_PAGE_SIZE)
                                const activeSessionIndex = chatSessions.findIndex((session) => session.id === activeSessionId)
                                const resolvedVisibleCount = activeSessionIndex >= 0
                                    ? Math.max(configuredVisibleCount, Math.ceil((activeSessionIndex + 1) / CHAT_PAGE_SIZE) * CHAT_PAGE_SIZE)
                                    : configuredVisibleCount
                                const visibleChatSessions = chatSessions.slice(0, resolvedVisibleCount)
                                const hasMoreChats = chatSessions.length > resolvedVisibleCount

                                return (
                                    <SortableProjectItem key={group.key} projectKey={group.key}>
                                        {(handleProps) => (
                                            <>
                                                <div className={cn('group/project-header relative rounded-lg border border-transparent transition-[background-color,border-color,box-shadow] duration-200', handleProps.isOver && !handleProps.isDragging && 'border-white/10 bg-white/[0.03] shadow-[0_10px_30px_rgba(0,0,0,0.16)]')}>
                                                    <button
                                                        type="button"
                                                        {...handleProps.attributes}
                                                        {...handleProps.listeners}
                                                        onPointerDownCapture={handleProjectTitlePointerDownCapture}
                                                        onClick={(event) => handleProjectTitleClick(event, group.key)}
                                                        className={cn(
                                                            'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition-[background-color,color,opacity] duration-150',
                                                            handleProps.isDragging
                                                                ? 'cursor-grabbing bg-white/[0.03] text-sparkle-text'
                                                                : 'cursor-grab active:cursor-grabbing hover:bg-white/[0.04] group-hover/project-header:bg-white/[0.04]'
                                                        )}
                                                    >
                                                        <ChevronRight size={14} className={cn('shrink-0 text-sparkle-text-muted/70 transition-transform duration-150', isExpanded && 'rotate-90')} />
                                                        {projectIcon}
                                                        <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-hidden"><span className="truncate text-xs font-medium text-sparkle-text/90">{group.label}</span><span className="shrink-0 font-mono text-[10px] text-sparkle-text-muted/40">({chatSessions.length})</span></div>
                                                    </button>
                                                    <button type="button" onClick={(event) => { event.stopPropagation(); onCreateSession(group.path && group.path !== '' ? group.path : undefined) }} className={cn('absolute right-1 top-1 hidden size-5 items-center justify-center rounded-md p-0 text-sparkle-text-muted/70 transition-colors hover:bg-white/[0.06] hover:text-sparkle-text', !handleProps.isDragging && 'group-hover/project-header:flex')} title="New chat in project"><SquarePen size={12} /></button>
                                                </div>
                                                <AnimatedHeight isOpen={isExpanded} duration={350}>
                                                    <div className="ml-2.5 flex min-w-0 flex-col gap-0.5 border-l border-white/10 px-1 py-0.5">
                                                        {hasChats ? (
                                                            <>
                                                                <SortableSessionList
                                                                    projectKey={group.key}
                                                                    sessions={visibleChatSessions}
                                                                    activeSessionId={activeSessionId}
                                                                    compact={compact}
                                                                    onSelectSession={onSelectSession}
                                                                    onOpenRename={onOpenRename}
                                                                    onArchiveSession={onArchiveSession}
                                                                    onDeleteRequest={onDeleteRequest}
                                                                    onSessionDragStart={onSessionDragStart}
                                                                    onSessionDragEnd={onSessionDragEnd}
                                                                    onSessionDragCancel={onSessionDragCancel}
                                                                />
                                                                {hasMoreChats ? (
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => handleShowMoreSessions(group.key)}
                                                                        className="mt-1 flex w-full items-center justify-center rounded-md border border-white/10 bg-white/[0.02] px-2 py-1.5 text-[11px] font-medium text-sparkle-text-muted/70 transition-colors hover:border-white/20 hover:bg-white/[0.04] hover:text-sparkle-text"
                                                                    >
                                                                        Show 5 more
                                                                    </button>
                                                                ) : null}
                                                            </>
                                                        ) : (
                                                            <button
                                                                type="button"
                                                                onClick={() => { const firstSession = group.sessions[0]; if (firstSession) onSelectSession(firstSession.id) }}
                                                                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-white/[0.04]"
                                                                title="Open empty project session"
                                                            >
                                                                <span className="min-w-0 flex-1 truncate text-xs text-sparkle-text-muted/55">No chats yet</span>
                                                                <span className="shrink-0 text-[10px] text-sparkle-text-muted/35">Start chatting</span>
                                                            </button>
                                                        )}
                                                    </div>
                                                </AnimatedHeight>
                                            </>
                                        )}
                                    </SortableProjectItem>
                                )
                            })}
                            {groupedSessions.length === 0 ? <div className={cn('flex flex-col items-center gap-2 px-4 text-center', compact ? 'py-6' : 'py-8')}><MessageSquarePlus size={compact ? 20 : 24} className="text-sparkle-text-muted/30" /><p className="text-xs text-sparkle-text-muted">No projects yet</p></div> : null}
                        </div>
                    </SortableContext>
                </DndContext>
            </div>
            <div className="mt-auto space-y-0.5 border-t border-white/10 px-1 py-2">
                {archivedCount > 0 ? <button type="button" onClick={() => onSetShowArchivedSessions(!showArchivedSessions)} className={cn('group flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs transition-colors', showArchivedSessions ? 'bg-white/[0.06] text-sparkle-text' : 'text-sparkle-text-muted/70 hover:bg-white/[0.04] hover:text-sparkle-text')}><Archive size={14} className={cn('transition-colors', showArchivedSessions ? 'text-amber-400' : 'text-sparkle-text-muted/50')} /><span className="flex-1 text-left">Archived Chats</span><span className="rounded-[4px] border border-white/10 bg-white/[0.03] px-1 py-0.5 text-[9px]">{archivedCount}</span></button> : null}
                <AnimatedHeight isOpen={showArchivedSessions} duration={300}>
                    <div className="mt-1 max-h-[30vh] overflow-y-auto rounded-lg bg-black/20 p-1 custom-scrollbar">
                        {visibleArchivedGroups.length > 0 ? visibleArchivedGroups.map((group) => (
                            <section key={`footer-archived-${group.key}`} className="mb-2 space-y-0.5 last:mb-0">
                                <div className="flex items-center gap-2 px-2 py-1 text-[10px] uppercase tracking-widest text-sparkle-text-muted/40">
                                    <ProjectGroupIcon group={group} size={10} expanded />
                                    <span className="truncate">{group.label}</span>
                                </div>
                                {group.sessions.map((session) => <div key={session.id} className="group/menu-item relative"><SessionRow session={session} activeSessionId={activeSessionId} archived compact={compact} onClick={(event) => { event.preventDefault(); if (session.id === activeSessionId) return; onSelectSession(session.id) }} onOpenRename={onOpenRename} onArchiveSession={onArchiveSession} onDeleteRequest={onDeleteRequest} /></div>)}
                            </section>
                        )) : <div className="py-4 text-center text-[10px] italic text-sparkle-text-muted/40">No archived sessions</div>}
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
