import { useCallback, useRef, type KeyboardEvent as ReactKeyboardEvent, type MouseEvent as ReactMouseEvent, type ReactNode } from 'react'
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
import { Bot, ChevronRight, Folder, FolderOpen, MoreVertical } from 'lucide-react'
import type { AssistantSession, AssistantThread } from '@shared/assistant/contracts'
import { FileActionsMenu, type FileActionsMenuItem } from '@/components/ui/FileActionsMenu'
import ProjectIcon from '@/components/ui/ProjectIcon'
import { cn } from '@/lib/utils'
import {
    buildSessionSubagentTree,
    formatAssistantSidebarRelativeTime,
    getAssistantThreadDisplayTitle,
    getPrimarySessionThread,
    getSessionDisplayTitle,
    resolveAssistantThreadStatusPill,
    type AssistantSessionThreadTreeNode,
    type SessionProjectGroup
} from './assistant-sessions-rail-utils'

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
    thread,
    isActive,
    recencyTierByThreadId,
    archived = false,
    compact = false,
    dragHandleProps,
    isDragging = false,
    isOver = false,
    onPointerDownCapture,
    onActivate,
    onContextMenu,
    menuItems
}: {
    session: AssistantSession
    thread: AssistantThread | null
    isActive: boolean
    recencyTierByThreadId: ReadonlyMap<string, number>
    archived?: boolean
    compact?: boolean
    dragHandleProps?: SortableHandleProps
    isDragging?: boolean
    isOver?: boolean
    onPointerDownCapture?: () => void
    onActivate: () => void
    onContextMenu?: (event: ReactMouseEvent<HTMLElement>) => void
    menuItems?: FileActionsMenuItem[]
}) {
    const timeLabel = formatAssistantSidebarRelativeTime(thread?.updatedAt || session.updatedAt)
    const statusPill = resolveAssistantThreadStatusPill(thread, isActive, recencyTierByThreadId)

    const handleKeyDown = useCallback((event: ReactKeyboardEvent<HTMLDivElement>) => {
        if (event.key !== 'Enter' && event.key !== ' ') return
        event.preventDefault()
        onActivate()
    }, [onActivate])

    return (
        <div
            role="button"
            tabIndex={0}
            {...dragHandleProps?.attributes}
            {...dragHandleProps?.listeners}
            onPointerDownCapture={onPointerDownCapture}
            onClick={onActivate}
            onKeyDown={handleKeyDown}
            onContextMenu={onContextMenu}
            className={cn(
                'relative flex w-full min-w-0 items-center gap-1 rounded-md text-left transition-[background-color,color,opacity,box-shadow] duration-150 select-none',
                compact ? 'min-h-[24px] px-1 py-[2px]' : 'min-h-[26px] px-1.5 py-[3px]',
                isOver && !isDragging && 'bg-white/[0.05] ring-1 ring-[var(--accent-primary)]/25 shadow-[0_10px_24px_rgba(0,0,0,0.14)]',
                isActive
                    ? 'bg-white/[0.07] text-sparkle-text font-medium'
                    : 'text-sparkle-text-secondary hover:bg-white/[0.04] hover:text-sparkle-text',
                !archived && !isDragging && 'cursor-pointer',
                isDragging && 'cursor-grabbing'
            )}
        >
            <div
                className={cn(
                    'flex min-w-0 flex-1 items-center gap-1 text-left',
                    menuItems && menuItems.length > 0 && 'pr-6'
                )}
            >
                <span
                    className="inline-flex h-4 w-3 shrink-0 items-center justify-center"
                    title={statusPill?.label || 'Idle'}
                    aria-hidden="true"
                >
                    <span className={cn('h-1.5 w-1.5 rounded-full', statusPill?.dotClass || 'bg-sparkle-text-muted/60', statusPill?.pulse && 'animate-pulse')} />
                </span>
                <span className="min-w-0 flex-1 truncate text-[11px] leading-4">{getSessionDisplayTitle(session)}</span>
                {statusPill && statusPill.showLabel !== false ? (
                    <span
                        className={cn(
                            'shrink-0 rounded-full px-1.5 py-0.5 text-[8.5px] font-medium leading-none',
                            statusPill.badgeClass || 'bg-white/[0.05] text-sparkle-text-secondary'
                        )}
                    >
                        {statusPill.label}
                    </span>
                ) : null}
                <span className={cn(
                    'shrink-0 text-[8.5px] leading-none',
                    'mr-1',
                    isActive ? 'text-sparkle-text/60' : 'text-sparkle-text-muted/40'
                )}>{timeLabel}</span>
            </div>
            {menuItems && menuItems.length > 0 ? (
                <div
                    className={cn(
                        'absolute right-1 top-1/2 z-[1] -translate-y-1/2 transition-opacity',
                        isDragging ? 'pointer-events-none opacity-0' : 'pointer-events-auto opacity-100'
                    )}
                >
                    <FileActionsMenu
                        items={menuItems}
                        title={archived ? 'Archived chat actions' : 'Chat actions'}
                        triggerIcon={<MoreVertical size={11} strokeWidth={1.65} className="mx-auto" />}
                        presentation="portal"
                        buttonClassName="h-3.5 w-3.5 rounded-none border-transparent bg-transparent p-0 text-sparkle-text-muted/45 hover:border-transparent hover:bg-transparent hover:text-sparkle-text"
                        openButtonClassName="rounded-none border-transparent bg-transparent p-0 text-sparkle-text"
                    />
                </div>
            ) : null}
        </div>
    )
}

function SubagentThreadNode({
    node,
    sessionId,
    activeSessionId,
    activeThreadId,
    recencyTierByThreadId,
    compact,
    expandedThreadKeys,
    onToggleThread,
    onSelectThread,
    depth = 0
}: {
    node: AssistantSessionThreadTreeNode
    sessionId: string
    activeSessionId: string | null
    activeThreadId: string | null
    recencyTierByThreadId: ReadonlyMap<string, number>
    compact: boolean
    expandedThreadKeys: Set<string>
    onToggleThread: (threadId: string) => void
    onSelectThread: (input: { sessionId: string; threadId: string }) => void
    depth?: number
}) {
    const hasChildren = node.children.length > 0
    const isExpanded = hasChildren ? expandedThreadKeys.has(node.thread.id) : false
    const isActive = sessionId === activeSessionId && node.thread.id === activeThreadId
    const statusPill = resolveAssistantThreadStatusPill(node.thread, isActive, recencyTierByThreadId)
    const timeLabel = formatAssistantSidebarRelativeTime(node.thread.updatedAt)

    return (
        <div className="space-y-1">
            <div
                className={cn(
                    'flex items-center gap-1 rounded-md border border-transparent pr-2 transition-colors',
                    compact ? 'pl-1.5 py-[3px]' : 'pl-2 py-[4px]',
                    isActive
                        ? 'bg-white/[0.06] text-sparkle-text'
                        : 'text-sparkle-text-muted/80 hover:bg-white/[0.03] hover:text-sparkle-text'
                )}
                style={{ marginLeft: `${depth * 12}px` }}
            >
                <button
                    type="button"
                    onClick={() => {
                        if (hasChildren) onToggleThread(node.thread.id)
                    }}
                    className={cn(
                        'inline-flex size-4 shrink-0 items-center justify-center rounded text-sparkle-text-muted/45 transition-colors',
                        hasChildren ? 'hover:bg-white/[0.04] hover:text-sparkle-text-secondary' : 'cursor-default opacity-50'
                    )}
                    aria-label={hasChildren ? (isExpanded ? 'Collapse subagents' : 'Expand subagents') : 'No nested subagents'}
                >
                    {hasChildren ? <ChevronRight size={10} className={cn('transition-transform', isExpanded && 'rotate-90')} /> : <span className="size-1.5 rounded-full bg-white/[0.08]" />}
                </button>
                <button
                    type="button"
                    onClick={() => onSelectThread({ sessionId, threadId: node.thread.id })}
                    className="flex min-w-0 flex-1 items-center gap-1.5 text-left"
                >
                    <span className="inline-flex size-4 shrink-0 items-center justify-center rounded-md border border-white/[0.06] bg-white/[0.03] text-sky-100/70">
                        <Bot size={10} />
                    </span>
                    <div className="min-w-0 flex-1">
                        <div className="flex min-w-0 items-center gap-1.5">
                            <span className="truncate text-[10px] font-medium">{getAssistantThreadDisplayTitle(node.thread)}</span>
                            {statusPill?.showLabel !== false ? (
                                <span className={cn('hidden shrink-0 text-[9px] uppercase tracking-[0.14em] md:inline', statusPill?.colorClass || 'text-sparkle-text-muted/50')}>
                                    {statusPill?.label}
                                </span>
                            ) : null}
                        </div>
                        <div className="flex min-w-0 items-center gap-1.5 text-[9px] text-sparkle-text-muted/45">
                            <span className="truncate">{node.thread.agentRole || 'Subagent thread'}</span>
                            <span>·</span>
                            <span className="shrink-0">{timeLabel}</span>
                        </div>
                    </div>
                    {statusPill ? <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', statusPill.dotClass, statusPill.pulse && 'animate-pulse')} /> : null}
                </button>
            </div>
            {hasChildren && isExpanded ? (
                <div className="ml-2 border-l border-white/[0.05] pl-1.5">
                    {node.children.map((childNode) => (
                        <SubagentThreadNode
                            key={childNode.thread.id}
                            node={childNode}
                            sessionId={sessionId}
                            activeSessionId={activeSessionId}
                            activeThreadId={activeThreadId}
                            recencyTierByThreadId={recencyTierByThreadId}
                            compact={compact}
                            expandedThreadKeys={expandedThreadKeys}
                            onToggleThread={onToggleThread}
                            onSelectThread={onSelectThread}
                            depth={depth + 1}
                        />
                    ))}
                </div>
            ) : null}
        </div>
    )
}

export function SortableSessionList({
    projectKey,
    sessions,
    activeSessionId,
    activeThreadId,
    recencyTierByThreadId,
    compact,
    expandedThreadKeys,
    onToggleThread,
    onSelectThread,
    getSessionMenuItems,
    onSessionContextMenu,
    onSessionDragStart,
    onSessionDragEnd,
    onSessionDragCancel
}: {
    projectKey: string
    sessions: AssistantSession[]
    activeSessionId: string | null
    activeThreadId: string | null
    recencyTierByThreadId: ReadonlyMap<string, number>
    compact: boolean
    expandedThreadKeys: Set<string>
    onToggleThread: (threadId: string) => void
    onSelectThread: (input: { sessionId: string; threadId: string }) => void
    getSessionMenuItems: (session: AssistantSession, archived?: boolean) => FileActionsMenuItem[]
    onSessionContextMenu: (event: ReactMouseEvent<HTMLElement>, session: AssistantSession, archived?: boolean) => void
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

    const handleSessionActivate = useCallback((session: AssistantSession) => {
        const primaryThread = getPrimarySessionThread(session)
        if (!primaryThread) return
        if (sessionDragInProgressRef.current === session.id) {
            return
        }
        if (suppressSessionClickAfterDragRef.current === session.id) {
            suppressSessionClickAfterDragRef.current = null
            return
        }
        if (session.id === activeSessionId && primaryThread.id === activeThreadId) return
        onSelectThread({ sessionId: session.id, threadId: primaryThread.id })
    }, [activeSessionId, activeThreadId, onSelectThread])

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
                {sessions.map((session) => {
                    const primaryThread = getPrimarySessionThread(session)
                    const isRootActive = session.id === activeSessionId && primaryThread?.id === activeThreadId
                    const subagentTree = buildSessionSubagentTree(session)

                    return (
                        <SortableSessionItem key={session.id} sessionId={session.id}>
                            {(handleProps) => (
                                <div className="space-y-1">
                                    <SessionRow
                                        session={session}
                                        thread={primaryThread}
                                        isActive={isRootActive}
                                        recencyTierByThreadId={recencyTierByThreadId}
                                        compact={compact}
                                        dragHandleProps={handleProps}
                                        isDragging={handleProps.isDragging}
                                        isOver={handleProps.isOver}
                                        onPointerDownCapture={() => handleSessionPointerDownCapture(session.id)}
                                        onActivate={() => handleSessionActivate(session)}
                                        onContextMenu={(event) => onSessionContextMenu(event, session)}
                                        menuItems={getSessionMenuItems(session)}
                                    />
                                    {subagentTree.length > 0 ? (
                                        <div className="ml-2 border-l border-white/[0.04] pl-1">
                                            {subagentTree.map((node) => (
                                                <SubagentThreadNode
                                                    key={node.thread.id}
                                                    node={node}
                                                    sessionId={session.id}
                                                    activeSessionId={activeSessionId}
                                                    activeThreadId={activeThreadId}
                                                    recencyTierByThreadId={recencyTierByThreadId}
                                                    compact={compact}
                                                    expandedThreadKeys={expandedThreadKeys}
                                                    onToggleThread={onToggleThread}
                                                    onSelectThread={onSelectThread}
                                                />
                                            ))}
                                        </div>
                                    ) : null}
                                </div>
                            )}
                        </SortableSessionItem>
                    )
                })}
            </SortableContext>
        </DndContext>
    )
}

export function hasSessionChats(session: AssistantSession): boolean {
    return session.threads?.some((thread) => (thread.messageCount || thread.messages?.length || 0) > 0) || false
}
