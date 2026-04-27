import type { MouseEvent as ReactMouseEvent } from 'react'
import { DndContext, type DragCancelEvent, type DragEndEvent, type DragStartEvent } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { restrictToFirstScrollableAncestor, restrictToVerticalAxis } from '@dnd-kit/modifiers'
import { ChevronRight, GitBranch, SquarePen, Trash2 } from 'lucide-react'
import { AnimatedHeight } from '@/components/ui/AnimatedHeight'
import { cn } from '@/lib/utils'
import { AssistantSessionsRailViewMenu } from './AssistantSessionsRailViewMenu'
import {
    ProjectGroupIcon,
    SortableProjectItem,
    SortableSessionList,
    hasSessionChats
} from './AssistantSessionsRailRows'
import type { SessionProjectGroup } from './assistant-sessions-rail-utils'
import { getGroupPrimaryThreadOrNull } from './assistant-sessions-rail-body-utils'

export function AssistantSessionsRailBody(props: {
    compact: boolean
    railMode: 'work' | 'playground'
    railGroupMode: 'project' | 'flat'
    railSortMode: 'updated' | 'created'
    playgroundRootMissing: boolean
    sectionLabel: string
    unassignedGroup: SessionProjectGroup | null
    labGroups: SessionProjectGroup[]
    activeSessionId: string | null
    activeThreadId: string | null
    activeConnectionPending: boolean
    expandedGroupKeys: Set<string>
    expandedThreadKeys: Set<string>
    visibleSessionCountByGroup: Record<string, number>
    recencyTierByThreadId: ReadonlyMap<string, number>
    projectSensors: ReturnType<typeof import('./AssistantSessionsRailRows').useAssistantRailSensors>
    collisionDetection: ReturnType<typeof import('./AssistantSessionsRailRows').useAssistantRailCollisionDetection>
    getSessionMenuItems: Parameters<typeof SortableSessionList>[0]['getSessionMenuItems']
    onSessionContextMenu: (event: ReactMouseEvent<HTMLElement>, session: SessionProjectGroup['sessions'][number], archived?: boolean) => void
    onSessionDragStart: (sessionId: string, projectKey: string) => void
    onSessionDragEnd: (projectKey: string, activeSessionId: string, overSessionId: string | null) => void
    onSessionDragCancel: () => void
    onToggleThread: (threadId: string) => void
    onSelectThread: (input: { sessionId: string; threadId: string }) => void
    onToggleGroup: (key: string) => void
    onProjectContextMenu: (event: ReactMouseEvent<HTMLElement>, group: SessionProjectGroup, isExpanded: boolean) => void
    onProjectTitlePointerDownCapture: () => void
    onProjectTitleClick: (event: ReactMouseEvent<HTMLButtonElement>, projectKey: string) => void
    onProjectDragStart: (event: DragStartEvent) => void
    onProjectDragEnd: (event: DragEndEvent) => void
    onProjectDragCancel: (event: DragCancelEvent) => void
    onCreateProjectChat: (group: SessionProjectGroup) => void
    onDeleteProjectGroup: (group: SessionProjectGroup) => void
    onChoosePlaygroundRoot: () => Promise<void> | void
    onRailGroupModeChange: (mode: 'project' | 'flat') => void
    onRailSortModeChange: (mode: 'updated' | 'created') => void
    onShowMoreSessions: (groupKey: string, nextVisibleCount: number) => void
    onShowLessSessions: (groupKey: string, minimumVisibleCount: number) => void
    getGroupPlaygroundLabId: (group: SessionProjectGroup) => string | null
}) {
    const {
        compact,
        railMode,
        railGroupMode,
        railSortMode,
        playgroundRootMissing,
        sectionLabel,
        unassignedGroup,
        labGroups,
        activeSessionId,
        activeThreadId,
        activeConnectionPending,
        expandedGroupKeys,
        expandedThreadKeys,
        visibleSessionCountByGroup,
        recencyTierByThreadId,
        projectSensors,
        collisionDetection,
        getSessionMenuItems,
        onSessionContextMenu,
        onSessionDragStart,
        onSessionDragEnd,
        onSessionDragCancel,
        onToggleThread,
        onSelectThread,
        onProjectContextMenu,
        onProjectTitlePointerDownCapture,
        onProjectTitleClick,
        onProjectDragStart,
        onProjectDragEnd,
        onProjectDragCancel,
        onCreateProjectChat,
        onDeleteProjectGroup,
        onChoosePlaygroundRoot,
        onRailGroupModeChange,
        onRailSortModeChange,
        onShowMoreSessions,
        onShowLessSessions,
        getGroupPlaygroundLabId
    } = props

    return (
        <div className="min-h-0 flex-1 overflow-y-auto pr-0.5 scrollbar-hide">
            {playgroundRootMissing ? (
                <div className={cn('flex flex-col items-center gap-3 px-4 text-center', compact ? 'py-6' : 'py-8')}>
                    <GitBranch size={compact ? 20 : 24} className="text-sparkle-text-muted/30" />
                    <p className="text-[11px] leading-5 text-sparkle-text-muted/60">
                        Choose a Playground root before creating labs or starting Playground chats.
                    </p>
                    <button
                        type="button"
                        onClick={() => void onChoosePlaygroundRoot()}
                        className="text-[11px] text-sparkle-text-muted/70 transition-colors hover:text-sparkle-text"
                    >
                        Choose root
                    </button>
                </div>
            ) : null}

            {!playgroundRootMissing ? (
                <div className="space-y-3">
                    {railGroupMode === 'flat' ? (
                        labGroups[0] ? (
                            <UnassignedSessionsSection
                                compact={compact}
                                group={labGroups[0]}
                                activeSessionId={activeSessionId}
                                activeThreadId={activeThreadId}
                                activeConnectionPending={activeConnectionPending}
                                expandedThreadKeys={expandedThreadKeys}
                                visibleSessionCountByGroup={visibleSessionCountByGroup}
                                recencyTierByThreadId={recencyTierByThreadId}
                                getSessionMenuItems={getSessionMenuItems}
                                onToggleThread={onToggleThread}
                                onSelectThread={onSelectThread}
                                onSessionContextMenu={onSessionContextMenu}
                                onSessionDragStart={onSessionDragStart}
                                onSessionDragEnd={onSessionDragEnd}
                                onSessionDragCancel={onSessionDragCancel}
                                onShowMoreSessions={onShowMoreSessions}
                                onShowLessSessions={onShowLessSessions}
                            />
                        ) : (
                            <div className="px-3 py-3 text-center text-[11px] text-sparkle-text-muted/55">
                                No chats yet
                            </div>
                        )
                    ) : unassignedGroup ? (
                        <UnassignedSessionsSection
                            compact={compact}
                            group={unassignedGroup}
                            activeSessionId={activeSessionId}
                            activeThreadId={activeThreadId}
                            activeConnectionPending={activeConnectionPending}
                            expandedThreadKeys={expandedThreadKeys}
                            visibleSessionCountByGroup={visibleSessionCountByGroup}
                            recencyTierByThreadId={recencyTierByThreadId}
                            getSessionMenuItems={getSessionMenuItems}
                            onToggleThread={onToggleThread}
                            onSelectThread={onSelectThread}
                            onSessionContextMenu={onSessionContextMenu}
                            onSessionDragStart={onSessionDragStart}
                            onSessionDragEnd={onSessionDragEnd}
                            onSessionDragCancel={onSessionDragCancel}
                            onShowMoreSessions={onShowMoreSessions}
                            onShowLessSessions={onShowLessSessions}
                        />
                    ) : (
                        railMode === 'playground' ? (
                            <div className="px-3 py-2 text-center text-[11px] text-sparkle-text-muted/55">
                                Start chatting to see your sessions
                            </div>
                        ) : null
                    )}

                    <div className="flex items-center gap-2 px-3">
                        <span className="text-[10px] tracking-wide text-sparkle-text-muted/28">{sectionLabel}</span>
                        <div className="h-px flex-1 bg-white/5" />
                        <AssistantSessionsRailViewMenu
                            groupMode={railGroupMode}
                            sortMode={railSortMode}
                            onGroupModeChange={onRailGroupModeChange}
                            onSortModeChange={onRailSortModeChange}
                            iconOnly
                        />
                    </div>

                    {railGroupMode === 'project' && labGroups.length > 0 ? (
                        <DndContext
                            sensors={projectSensors}
                            collisionDetection={collisionDetection}
                            modifiers={[restrictToVerticalAxis, restrictToFirstScrollableAncestor]}
                            onDragStart={onProjectDragStart}
                            onDragEnd={onProjectDragEnd}
                            onDragCancel={onProjectDragCancel}
                        >
                            <SortableContext items={labGroups.map((group) => group.key)} strategy={verticalListSortingStrategy}>
                                <div className="space-y-0.5">
                                    {labGroups.map((group) => (
                                        <ProjectSessionsSection
                                            key={group.key}
                                            compact={compact}
                                            railMode={railMode}
                                            group={group}
                                            activeSessionId={activeSessionId}
                                            activeThreadId={activeThreadId}
                                            activeConnectionPending={activeConnectionPending}
                                            expanded={expandedGroupKeys.has(group.key)}
                                            expandedThreadKeys={expandedThreadKeys}
                                            visibleSessionCountByGroup={visibleSessionCountByGroup}
                                            recencyTierByThreadId={recencyTierByThreadId}
                                            getGroupPlaygroundLabId={getGroupPlaygroundLabId}
                                            getSessionMenuItems={getSessionMenuItems}
                                            onToggleThread={onToggleThread}
                                            onSelectThread={onSelectThread}
                                            onSessionContextMenu={onSessionContextMenu}
                                            onSessionDragStart={onSessionDragStart}
                                            onSessionDragEnd={onSessionDragEnd}
                                            onSessionDragCancel={onSessionDragCancel}
                                            onProjectContextMenu={onProjectContextMenu}
                                            onProjectTitlePointerDownCapture={onProjectTitlePointerDownCapture}
                                            onProjectTitleClick={onProjectTitleClick}
                                            onCreateProjectChat={onCreateProjectChat}
                                            onDeleteProjectGroup={onDeleteProjectGroup}
                                            onShowMoreSessions={onShowMoreSessions}
                                            onShowLessSessions={onShowLessSessions}
                                        />
                                    ))}
                                </div>
                            </SortableContext>
                        </DndContext>
                    ) : railGroupMode === 'project' ? (
                        <div className="px-3 py-3 text-center text-[11px] text-sparkle-text-muted/55">
                            No labs yet
                        </div>
                    ) : null}
                </div>
            ) : null}
        </div>
    )
}

function UnassignedSessionsSection(props: {
    compact: boolean
    group: SessionProjectGroup
    activeSessionId: string | null
    activeThreadId: string | null
    activeConnectionPending: boolean
    expandedThreadKeys: Set<string>
    visibleSessionCountByGroup: Record<string, number>
    recencyTierByThreadId: ReadonlyMap<string, number>
    getSessionMenuItems: Parameters<typeof SortableSessionList>[0]['getSessionMenuItems']
    onToggleThread: (threadId: string) => void
    onSelectThread: (input: { sessionId: string; threadId: string }) => void
    onSessionContextMenu: (event: ReactMouseEvent<HTMLElement>, session: SessionProjectGroup['sessions'][number], archived?: boolean) => void
    onSessionDragStart: (sessionId: string, projectKey: string) => void
    onSessionDragEnd: (projectKey: string, activeSessionId: string, overSessionId: string | null) => void
    onSessionDragCancel: () => void
    onShowMoreSessions: (groupKey: string, nextVisibleCount: number) => void
    onShowLessSessions: (groupKey: string, minimumVisibleCount: number) => void
}) {
    const {
        compact,
        group,
        activeSessionId,
        activeThreadId,
        activeConnectionPending,
        expandedThreadKeys,
        visibleSessionCountByGroup,
        recencyTierByThreadId,
        getSessionMenuItems,
        onToggleThread,
        onSelectThread,
        onSessionContextMenu,
        onSessionDragStart,
        onSessionDragEnd,
        onSessionDragCancel,
        onShowMoreSessions,
        onShowLessSessions
    } = props
    const chatSessions = group.sessions.filter(hasSessionChats)
    if (chatSessions.length === 0) return null

    const configuredVisibleCount = Math.max(5, visibleSessionCountByGroup[group.key] ?? 5)
    const activeSessionIndex = chatSessions.findIndex((session) => session.id === activeSessionId)
    const minimumVisibleCount = activeSessionIndex >= 0
        ? Math.max(5, Math.ceil((activeSessionIndex + 1) / 5) * 5)
        : 5
    const resolvedVisibleCount = Math.max(configuredVisibleCount, minimumVisibleCount)
    const visibleSessions = chatSessions.slice(0, resolvedVisibleCount)
    const hiddenChatsCount = Math.max(0, chatSessions.length - resolvedVisibleCount)
    const nextShowMoreCount = Math.min(5, hiddenChatsCount)
    const hasMoreChats = hiddenChatsCount > 0
    const canShowLessChats = resolvedVisibleCount > minimumVisibleCount

    return (
        <div className="space-y-1">
            <SortableSessionList
                projectKey={group.key}
                sessions={visibleSessions}
                activeSessionId={activeSessionId}
                activeThreadId={activeThreadId}
                activeConnectionPending={activeConnectionPending}
                recencyTierByThreadId={recencyTierByThreadId}
                compact={compact}
                expandedThreadKeys={expandedThreadKeys}
                onToggleThread={onToggleThread}
                onSelectThread={onSelectThread}
                getSessionMenuItems={getSessionMenuItems}
                onSessionContextMenu={onSessionContextMenu}
                onSessionDragStart={onSessionDragStart}
                onSessionDragEnd={onSessionDragEnd}
                onSessionDragCancel={onSessionDragCancel}
            />
            {hasMoreChats || canShowLessChats ? (
                <div className="flex items-center gap-1.5">
                    {hasMoreChats ? (
                        <button
                            type="button"
                            onClick={() => onShowMoreSessions(group.key, resolvedVisibleCount)}
                            className="flex-1 rounded-md border border-white/10 bg-white/[0.02] px-2 py-1.5 text-[11px] font-medium text-sparkle-text-muted/70 transition-colors hover:border-white/20 hover:bg-white/[0.04] hover:text-sparkle-text"
                        >
                            Show {nextShowMoreCount} more
                        </button>
                    ) : null}
                    {canShowLessChats ? (
                        <button
                            type="button"
                            onClick={() => onShowLessSessions(group.key, minimumVisibleCount)}
                            className="rounded-md border border-transparent bg-white/[0.025] px-2 py-1.5 text-[11px] font-medium text-sparkle-text-muted/65 transition-colors hover:bg-white/[0.05] hover:text-sparkle-text"
                        >
                            Show less
                        </button>
                    ) : null}
                </div>
            ) : null}
        </div>
    )
}

function ProjectSessionsSection(props: {
    compact: boolean
    railMode: 'work' | 'playground'
    group: SessionProjectGroup
    activeSessionId: string | null
    activeThreadId: string | null
    activeConnectionPending: boolean
    expanded: boolean
    expandedThreadKeys: Set<string>
    visibleSessionCountByGroup: Record<string, number>
    recencyTierByThreadId: ReadonlyMap<string, number>
    getGroupPlaygroundLabId: (group: SessionProjectGroup) => string | null
    getSessionMenuItems: Parameters<typeof SortableSessionList>[0]['getSessionMenuItems']
    onToggleThread: (threadId: string) => void
    onSelectThread: (input: { sessionId: string; threadId: string }) => void
    onSessionContextMenu: (event: ReactMouseEvent<HTMLElement>, session: SessionProjectGroup['sessions'][number], archived?: boolean) => void
    onSessionDragStart: (sessionId: string, projectKey: string) => void
    onSessionDragEnd: (projectKey: string, activeSessionId: string, overSessionId: string | null) => void
    onSessionDragCancel: () => void
    onProjectContextMenu: (event: ReactMouseEvent<HTMLElement>, group: SessionProjectGroup, isExpanded: boolean) => void
    onProjectTitlePointerDownCapture: () => void
    onProjectTitleClick: (event: ReactMouseEvent<HTMLButtonElement>, projectKey: string) => void
    onCreateProjectChat: (group: SessionProjectGroup) => void
    onDeleteProjectGroup: (group: SessionProjectGroup) => void
    onShowMoreSessions: (groupKey: string, nextVisibleCount: number) => void
    onShowLessSessions: (groupKey: string, minimumVisibleCount: number) => void
}) {
    const {
        compact,
        railMode,
        group,
        activeSessionId,
        activeThreadId,
        activeConnectionPending,
        expanded,
        expandedThreadKeys,
        visibleSessionCountByGroup,
        recencyTierByThreadId,
        getGroupPlaygroundLabId,
        getSessionMenuItems,
        onToggleThread,
        onSelectThread,
        onSessionContextMenu,
        onSessionDragStart,
        onSessionDragEnd,
        onSessionDragCancel,
        onProjectContextMenu,
        onProjectTitlePointerDownCapture,
        onProjectTitleClick,
        onCreateProjectChat,
        onDeleteProjectGroup,
        onShowMoreSessions,
        onShowLessSessions
    } = props
    const chatSessions = group.sessions.filter(hasSessionChats)
    const hasChats = chatSessions.length > 0
    const configuredVisibleCount = Math.max(5, visibleSessionCountByGroup[group.key] ?? 5)
    const activeSessionIndex = chatSessions.findIndex((session) => session.id === activeSessionId)
    const minimumVisibleCount = activeSessionIndex >= 0
        ? Math.max(5, Math.ceil((activeSessionIndex + 1) / 5) * 5)
        : 5
    const resolvedVisibleCount = Math.max(configuredVisibleCount, minimumVisibleCount)
    const visibleChatSessions = chatSessions.slice(0, resolvedVisibleCount)
    const hiddenChatsCount = Math.max(0, chatSessions.length - resolvedVisibleCount)
    const hasMoreChats = hiddenChatsCount > 0
    const canShowLessChats = resolvedVisibleCount > minimumVisibleCount
    const canDeleteLab = railMode === 'playground' && Boolean(getGroupPlaygroundLabId(group))
    return (
        <SortableProjectItem projectKey={group.key}>
            {(handleProps) => (
                <>
                    <div
                        className={cn(
                            'group/project-header flex min-w-0 items-center gap-1 rounded-lg border border-transparent px-2 py-[4px] transition-[background-color,border-color,box-shadow] duration-200',
                            handleProps.isOver && !handleProps.isDragging && 'border-white/10 bg-white/[0.03] shadow-[0_10px_30px_rgba(0,0,0,0.16)]',
                            handleProps.isDragging
                                ? 'bg-white/[0.03] text-sparkle-text'
                                : 'hover:bg-white/[0.04]'
                        )}
                        onContextMenu={(event) => onProjectContextMenu(event, group, expanded)}
                    >
                        <button
                            type="button"
                            {...handleProps.attributes}
                            {...handleProps.listeners}
                            onPointerDownCapture={onProjectTitlePointerDownCapture}
                            onClick={(event) => onProjectTitleClick(event, group.key)}
                            className={cn(
                                'flex min-w-0 flex-1 items-center gap-2 text-left transition-[color,opacity] duration-150',
                                handleProps.isDragging
                                    ? 'cursor-grabbing text-sparkle-text'
                                    : 'cursor-grab active:cursor-grabbing'
                            )}
                        >
                            <ChevronRight size={14} className={cn('shrink-0 text-sparkle-text-muted/70 transition-transform duration-150', expanded && 'rotate-90')} />
                            <ProjectGroupIcon group={group} size={14} expanded={expanded} />
                            <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-hidden">
                                <span className="truncate text-xs font-medium text-sparkle-text/90">{railMode === 'playground' && !group.path ? 'Unassigned' : group.label}</span>
                                <span className="shrink-0 font-mono text-[10px] text-sparkle-text-muted/40">({chatSessions.length})</span>
                            </div>
                        </button>
                        <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover/project-header:opacity-100 focus-within:opacity-100">
                            <button
                                type="button"
                                onPointerDown={(event) => event.stopPropagation()}
                                onClick={(event) => {
                                    event.stopPropagation()
                                    onCreateProjectChat(group)
                                }}
                                className="inline-flex h-5 w-5 items-center justify-center rounded-md border border-transparent bg-transparent p-0 text-sparkle-text-muted/70 transition-colors hover:bg-white/[0.05] hover:text-sparkle-text"
                                title={railMode === 'playground' ? 'New chat in project' : 'New chat'}
                            >
                                <SquarePen size={11} />
                            </button>
                            {canDeleteLab ? (
                                <button
                                    type="button"
                                    onPointerDown={(event) => event.stopPropagation()}
                                    onClick={(event) => {
                                        event.stopPropagation()
                                        onDeleteProjectGroup(group)
                                    }}
                                    className="inline-flex h-5 w-5 items-center justify-center rounded-md border border-transparent bg-transparent p-0 text-red-200/75 transition-colors hover:bg-red-500/10 hover:text-red-100"
                                    title="Delete lab"
                                >
                                    <Trash2 size={11} />
                                </button>
                            ) : null}
                        </div>
                    </div>
                    <AnimatedHeight isOpen={expanded} duration={350}>
                        <div className="ml-2.5 flex min-w-0 flex-col gap-0.5 border-l border-white/10 px-1 py-0.5">
                            {hasChats ? (
                                <>
                                    <SortableSessionList
                                        projectKey={group.key}
                                        sessions={visibleChatSessions}
                                        activeSessionId={activeSessionId}
                                        activeThreadId={activeThreadId}
                                        activeConnectionPending={activeConnectionPending}
                                        recencyTierByThreadId={recencyTierByThreadId}
                                        compact={compact}
                                        expandedThreadKeys={expandedThreadKeys}
                                        onToggleThread={onToggleThread}
                                        onSelectThread={onSelectThread}
                                        getSessionMenuItems={getSessionMenuItems}
                                        onSessionContextMenu={onSessionContextMenu}
                                        onSessionDragStart={onSessionDragStart}
                                        onSessionDragEnd={onSessionDragEnd}
                                        onSessionDragCancel={onSessionDragCancel}
                                    />
                                    {hasMoreChats || canShowLessChats ? (
                                        <div className="mt-1 flex items-center gap-1.5">
                                            {hasMoreChats ? (
                                                <button
                                                    type="button"
                                                    onClick={() => onShowMoreSessions(group.key, chatSessions.length)}
                                                    className="flex-1 rounded-md border border-white/10 bg-white/[0.02] px-2 py-1.5 text-[11px] font-medium text-sparkle-text-muted/70 transition-colors hover:border-white/20 hover:bg-white/[0.04] hover:text-sparkle-text"
                                                >
                                                    Show {hiddenChatsCount} more
                                                </button>
                                            ) : null}
                                            {canShowLessChats ? (
                                                <button
                                                    type="button"
                                                    onClick={() => onShowLessSessions(group.key, minimumVisibleCount)}
                                                    className="rounded-md border border-transparent bg-white/[0.025] px-2 py-1.5 text-[11px] font-medium text-sparkle-text-muted/65 transition-colors hover:bg-white/[0.05] hover:text-sparkle-text"
                                                >
                                                    Show less
                                                </button>
                                            ) : null}
                                        </div>
                                    ) : null}
                                </>
                            ) : (
                                <button
                                    type="button"
                                    onClick={() => {
                                        const firstTarget = getGroupPrimaryThreadOrNull(group)
                                        if (firstTarget) {
                                            onSelectThread(firstTarget)
                                            return
                                        }
                                        onCreateProjectChat(group)
                                    }}
                                    className="flex w-full items-center gap-2 rounded-md px-2 py-[4px] text-left transition-colors hover:bg-white/[0.04]"
                                    title="Start a new chat"
                                >
                                    <span className="min-w-0 flex-1 truncate text-xs text-sparkle-text-muted/55">No chats yet</span>
                                    <span className="shrink-0 text-[9px] text-sparkle-text-muted/35">Start chatting</span>
                                </button>
                            )}
                        </div>
                    </AnimatedHeight>
                </>
            )}
        </SortableProjectItem>
    )
}
