import { useCallback, useRef, type MouseEvent as ReactMouseEvent, type ReactNode } from 'react'
import {
    DndContext,
    PointerSensor,
    closestCorners,
    pointerWithin,
    useSensor,
    useSensors,
    type CollisionDetection,
    type DragCancelEvent,
    type DragEndEvent,
    type DragStartEvent
} from '@dnd-kit/core'
import {
    SortableContext,
    useSortable,
    verticalListSortingStrategy
} from '@dnd-kit/sortable'
import { restrictToFirstScrollableAncestor, restrictToVerticalAxis } from '@dnd-kit/modifiers'
import { CSS } from '@dnd-kit/utilities'
import { Archive, ArchiveRestore, Edit2, Folder, FolderOpen, Trash2 } from 'lucide-react'
import type { AssistantSession } from '@shared/assistant/contracts'
import ProjectIcon from '@/components/ui/ProjectIcon'
import { cn } from '@/lib/utils'
import { getDisplayTitle, resolveSessionStatusPill, type SessionProjectGroup } from './assistant-sessions-rail-utils'

function formatSidebarRelativeTime(value: string): string {
    const timestamp = Date.parse(value)
    if (!Number.isFinite(timestamp)) return value

    const deltaMs = Math.max(0, Date.now() - timestamp)
    if (deltaMs < 60_000) return 'just now'

    const minutes = Math.floor(deltaMs / 60_000)
    if (minutes < 60) return `${minutes} min${minutes === 1 ? '' : 's'} ago`

    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `${hours} hr${hours === 1 ? '' : 's'} ago`

    const days = Math.floor(hours / 24)
    if (days < 7) return `${days} day${days === 1 ? '' : 's'} ago`

    const weeks = Math.floor(days / 7)
    if (weeks < 5) return `${weeks} week${weeks === 1 ? '' : 's'} ago`

    const months = Math.floor(days / 30)
    if (months < 12) return `${months} month${months === 1 ? '' : 's'} ago`

    const years = Math.floor(days / 365)
    return `${years} year${years === 1 ? '' : 's'} ago`
}

export function ProjectGroupIcon({
    group,
    size,
    collapsed = false,
    expanded = false
}: {
    group: SessionProjectGroup
    size: number
    collapsed?: boolean
    expanded?: boolean
}) {
    if (!group.path) {
        const FolderIcon = expanded && !collapsed ? FolderOpen : Folder
        return <FolderIcon size={size} className="shrink-0 text-sparkle-text-muted/50" />
    }

    const hasMeaningfulProjectType = Boolean(
        group.projectType
        && !['unknown', 'default', 'folder'].includes(group.projectType)
    )
    const hasProjectIconMetadata = Boolean(
        group.projectIconPath
        || group.framework
        || hasMeaningfulProjectType
    )

    if (!hasProjectIconMetadata) {
        const FolderIcon = expanded && !collapsed ? FolderOpen : Folder
        return <FolderIcon size={size} className="shrink-0 text-sparkle-text-muted/50" />
    }

    return (
        <ProjectIcon
            projectType={hasMeaningfulProjectType ? group.projectType || undefined : undefined}
            framework={group.framework || undefined}
            customIconPath={group.projectIconPath}
            size={size}
            className={cn(
                'shrink-0 overflow-hidden rounded-sm',
                collapsed && 'rounded-[6px]',
                expanded && 'opacity-95'
            )}
        />
    )
}

type SortableHandleProps = Pick<ReturnType<typeof useSortable>, 'attributes' | 'listeners'>

export function useAssistantRailSensors() {
    return useSensors(
        useSensor(PointerSensor, {
            activationConstraint: { distance: 6 }
        })
    )
}

export function useAssistantRailCollisionDetection() {
    return useCallback<CollisionDetection>((args) => {
        const pointerCollisions = pointerWithin(args)
        if (pointerCollisions.length > 0) return pointerCollisions
        return closestCorners(args)
    }, [])
}

export function SortableProjectItem({
    projectKey,
    children
}: {
    projectKey: string
    children: (handleProps: SortableHandleProps & { isDragging: boolean; isOver: boolean }) => ReactNode
}) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging, isOver } = useSortable({ id: projectKey })

    return (
        <section
            ref={setNodeRef}
            style={{
                transform: CSS.Translate.toString(transform),
                transition
            }}
            className={cn('relative rounded-xl', isDragging && 'z-20 opacity-80')}
            data-dragging={isDragging ? 'true' : 'false'}
        >
            {children({ attributes, listeners, isDragging, isOver })}
        </section>
    )
}

function SortableSessionItem({
    sessionId,
    children
}: {
    sessionId: string
    children: (handleProps: SortableHandleProps & { isDragging: boolean; isOver: boolean }) => ReactNode
}) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging, isOver } = useSortable({ id: sessionId })

    return (
        <div
            ref={setNodeRef}
            style={{
                transform: CSS.Translate.toString(transform),
                transition
            }}
            className={cn('group/menu-item relative', isDragging && 'z-20 opacity-80')}
            data-thread-item
            data-dragging={isDragging ? 'true' : 'false'}
        >
            {children({ attributes, listeners, isDragging, isOver })}
        </div>
    )
}

export function SessionRow({
    session,
    activeSessionId,
    archived = false,
    compact = false,
    dragHandleProps,
    isDragging = false,
    isOver = false,
    onPointerDownCapture,
    onClick,
    onOpenRename,
    onArchiveSession,
    onDeleteRequest
}: {
    session: AssistantSession
    activeSessionId: string | null
    archived?: boolean
    compact?: boolean
    dragHandleProps?: SortableHandleProps
    isDragging?: boolean
    isOver?: boolean
    onPointerDownCapture?: () => void
    onClick: (event: ReactMouseEvent<HTMLButtonElement>) => void
    onOpenRename: (session: AssistantSession) => void
    onArchiveSession: (sessionId: string, archived?: boolean) => void
    onDeleteRequest: (session: AssistantSession) => void
}) {
    const isActive = session.id === activeSessionId
    const timeLabel = formatSidebarRelativeTime(session.updatedAt)
    const statusPill = resolveSessionStatusPill(session, activeSessionId)

    return (
        <>
            <button
                type="button"
                {...dragHandleProps?.attributes}
                {...dragHandleProps?.listeners}
                onPointerDownCapture={onPointerDownCapture}
                onClick={onClick}
                className={cn(
                    'flex w-full min-w-0 items-center gap-1.5 rounded-md py-1.5 pr-2 text-left transition-[background-color,color,opacity,box-shadow] duration-150 select-none',
                    compact ? 'pl-1.5' : 'pl-2',
                    !archived && !isDragging && 'cursor-pointer',
                    isDragging && 'cursor-grabbing',
                    isOver && !isDragging && 'bg-white/[0.05] ring-1 ring-[var(--accent-primary)]/25 shadow-[0_10px_24px_rgba(0,0,0,0.14)]',
                    isActive
                        ? 'bg-white/[0.07] text-sparkle-text font-medium'
                        : 'text-sparkle-text-secondary hover:bg-white/[0.04] hover:text-sparkle-text'
                )}
            >
                {statusPill ? (
                    <span className={cn('inline-flex items-center gap-1 text-[10px] shrink-0', statusPill.colorClass)}>
                        <span className={cn('h-1.5 w-1.5 rounded-full', statusPill.dotClass, statusPill.pulse && 'animate-pulse')} />
                        {statusPill.showLabel !== false ? <span className="hidden md:inline">{statusPill.label}</span> : null}
                    </span>
                ) : null}
                <span className="min-w-0 flex-1 truncate text-xs">{getDisplayTitle(session.title)}</span>
                <span className={cn('shrink-0 text-[10px]', isActive ? 'text-sparkle-text/60' : 'text-sparkle-text-muted/40')}>{timeLabel}</span>
            </button>
            <div className={cn('absolute right-1 top-1/2 hidden -translate-y-1/2 items-center gap-0.5 rounded-md border border-white/10 bg-sparkle-card p-0.5 shadow-lg/10', !isDragging && 'group-hover/menu-item:flex')}>
                {!archived ? (
                    <>
                        <button type="button" onClick={(event) => { event.stopPropagation(); onOpenRename(session) }} className="rounded p-1 text-sparkle-text-secondary/60 transition-colors hover:bg-white/[0.05] hover:text-sparkle-text" title="Rename"><Edit2 size={11} /></button>
                        <button type="button" onClick={(event) => { event.stopPropagation(); onArchiveSession(session.id, true) }} className="rounded p-1 text-sparkle-text-secondary/60 transition-colors hover:bg-amber-500/10 hover:text-amber-300" title="Archive"><Archive size={11} /></button>
                    </>
                ) : (
                    <button type="button" onClick={(event) => { event.stopPropagation(); onArchiveSession(session.id, false) }} className="rounded p-1 text-sparkle-text-secondary/60 transition-colors hover:bg-emerald-500/10 hover:text-emerald-300" title="Restore"><ArchiveRestore size={11} /></button>
                )}
                <button type="button" onClick={(event) => { event.stopPropagation(); onDeleteRequest(session) }} className="rounded p-1 text-sparkle-text-secondary/60 transition-colors hover:bg-red-500/10 hover:text-red-500" title="Delete"><Trash2 size={11} /></button>
            </div>
        </>
    )
}

export function SortableSessionList({
    projectKey,
    sessions,
    activeSessionId,
    compact,
    onSelectSession,
    onOpenRename,
    onArchiveSession,
    onDeleteRequest,
    onSessionDragStart,
    onSessionDragEnd,
    onSessionDragCancel
}: {
    projectKey: string
    sessions: AssistantSession[]
    activeSessionId: string | null
    compact: boolean
    onSelectSession: (sessionId: string) => void
    onOpenRename: (session: AssistantSession) => void
    onArchiveSession: (sessionId: string, archived?: boolean) => void
    onDeleteRequest: (session: AssistantSession) => void
    onSessionDragStart: (sessionId: string, projectKey: string) => void
    onSessionDragEnd: (projectKey: string, activeSessionId: string, overSessionId: string | null) => void
    onSessionDragCancel: () => void
}) {
    const sensors = useAssistantRailSensors()
    const collisionDetection = useAssistantRailCollisionDetection()
    const sessionDragInProgressRef = useRef<string | null>(null)
    const suppressSessionClickAfterDragRef = useRef<string | null>(null)

    const handleSessionPointerDownCapture = useCallback((sessionId: string) => {
        if (suppressSessionClickAfterDragRef.current === sessionId) {
            suppressSessionClickAfterDragRef.current = null
        }
    }, [])

    const handleSessionClick = useCallback((event: ReactMouseEvent<HTMLButtonElement>, sessionId: string) => {
        if (sessionDragInProgressRef.current === sessionId) {
            event.preventDefault()
            event.stopPropagation()
            return
        }
        if (suppressSessionClickAfterDragRef.current === sessionId) {
            suppressSessionClickAfterDragRef.current = null
            event.preventDefault()
            event.stopPropagation()
            return
        }
        if (sessionId === activeSessionId) return
        onSelectSession(sessionId)
    }, [activeSessionId, onSelectSession])

    const handleSessionSortStart = useCallback((event: DragStartEvent) => {
        const activeId = String(event.active.id)
        sessionDragInProgressRef.current = activeId
        suppressSessionClickAfterDragRef.current = activeId
        onSessionDragStart(activeId, projectKey)
    }, [onSessionDragStart, projectKey])

    const handleSessionSortEnd = useCallback((event: DragEndEvent) => {
        const activeId = String(event.active.id)
        sessionDragInProgressRef.current = null
        onSessionDragEnd(projectKey, activeId, event.over ? String(event.over.id) : null)
    }, [onSessionDragEnd, projectKey])

    const handleSessionSortCancel = useCallback((_event: DragCancelEvent) => {
        sessionDragInProgressRef.current = null
        onSessionDragCancel()
    }, [onSessionDragCancel])

    return (
        <DndContext
            sensors={sensors}
            collisionDetection={collisionDetection}
            modifiers={[restrictToVerticalAxis, restrictToFirstScrollableAncestor]}
            onDragStart={handleSessionSortStart}
            onDragEnd={handleSessionSortEnd}
            onDragCancel={handleSessionSortCancel}
        >
            <SortableContext items={sessions.map((session) => session.id)} strategy={verticalListSortingStrategy}>
                {sessions.map((session) => (
                    <SortableSessionItem key={session.id} sessionId={session.id}>
                        {(handleProps) => (
                            <SessionRow
                                session={session}
                                activeSessionId={activeSessionId}
                                compact={compact}
                                dragHandleProps={handleProps}
                                isDragging={handleProps.isDragging}
                                isOver={handleProps.isOver}
                                onPointerDownCapture={() => handleSessionPointerDownCapture(session.id)}
                                onClick={(event) => handleSessionClick(event, session.id)}
                                onOpenRename={onOpenRename}
                                onArchiveSession={onArchiveSession}
                                onDeleteRequest={onDeleteRequest}
                            />
                        )}
                    </SortableSessionItem>
                ))}
            </SortableContext>
        </DndContext>
    )
}

export function hasSessionChats(session: AssistantSession): boolean {
    return session.threads?.some((thread) => (thread.messageCount || thread.messages?.length || 0) > 0) || false
}
