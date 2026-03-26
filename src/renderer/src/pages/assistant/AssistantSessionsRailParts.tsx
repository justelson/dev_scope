import { createPortal } from 'react-dom'
import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react'
import {
    DndContext,
    type DragCancelEvent,
    type DragEndEvent,
    type DragStartEvent
} from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { restrictToFirstScrollableAncestor, restrictToVerticalAxis } from '@dnd-kit/modifiers'
import { Archive, BriefcaseBusiness, ChevronRight, Edit2, GitBranch, MessageSquarePlus, Plus, SquarePen } from 'lucide-react'
import type { AssistantPlaygroundState, AssistantSession } from '@shared/assistant/contracts'
import type { DevScopeFolderItem } from '@shared/contracts/devscope-api'
import { AnimatedHeight } from '@/components/ui/AnimatedHeight'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { cn } from '@/lib/utils'
import type { SessionProjectGroup } from './assistant-sessions-rail-utils'
import { resolveSessionStatusPill } from './assistant-sessions-rail-utils'
import type { AssistantRailMode } from './useAssistantPageSidebarState'
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
    railMode: AssistantRailMode
    playground: AssistantPlaygroundState
    backgroundActivitySessions: AssistantSession[]
    commandPending: boolean
    groupedSessions: SessionProjectGroup[]
    groupedArchivedSessions: SessionProjectGroup[]
    activeSessionId: string | null
    expandedGroupKeys: Set<string>
    showArchivedSessions: boolean
    onRailModeChange: (mode: AssistantRailMode) => void
    onToggleGroup: (key: string) => void
    onChooseProjectPath: () => void
    onCreateSession: (projectPath?: string) => void
    onCreatePlaygroundSession: (labId?: string | null) => void
    onSelectSession: (sessionId: string) => void
    onOpenRename: (session: AssistantSession) => void
    onArchiveSession: (sessionId: string, archived?: boolean) => void
    onDeleteRequest: (session: AssistantSession) => void
    onSetShowArchivedSessions: (value: boolean) => void
    onSetPlaygroundRoot: (rootPath: string | null) => Promise<void> | void
    onCreatePlaygroundLab: (input: {
        title?: string
        source: 'empty' | 'git-clone' | 'existing-folder'
        repoUrl?: string
        existingFolderPath?: string
        openSession?: boolean
    }) => Promise<void> | void
    onProjectDragStart: (projectKey: string) => void
    onProjectDragEnd: (activeProjectKey: string, overProjectKey: string | null) => void
    onProjectDragCancel: () => void
    onSessionDragStart: (sessionId: string, projectKey: string) => void
    onSessionDragEnd: (projectKey: string, activeSessionId: string, overSessionId: string | null) => void
    onSessionDragCancel: () => void
}) {
    const {
        compact,
        railMode,
        playground,
        backgroundActivitySessions,
        commandPending,
        groupedSessions,
        groupedArchivedSessions,
        activeSessionId,
        expandedGroupKeys,
        showArchivedSessions,
        onRailModeChange,
        onToggleGroup,
        onChooseProjectPath,
        onCreateSession,
        onCreatePlaygroundSession,
        onSelectSession,
        onOpenRename,
        onArchiveSession,
        onDeleteRequest,
        onSetShowArchivedSessions,
        onSetPlaygroundRoot,
        onCreatePlaygroundLab,
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
    const [creatingLab, setCreatingLab] = useState(false)
    const [labDialogOpen, setLabDialogOpen] = useState(false)
    const [labTitle, setLabTitle] = useState('')
    const [labRepoUrl, setLabRepoUrl] = useState('')
    const [labSource, setLabSource] = useState<'empty' | 'git-clone' | 'existing-folder'>('empty')
    const [existingRootFolders, setExistingRootFolders] = useState<DevScopeFolderItem[]>([])
    const [existingRootFoldersLoading, setExistingRootFoldersLoading] = useState(false)
    const [selectedExistingFolderPath, setSelectedExistingFolderPath] = useState('')

    const visibleArchivedGroups = groupedArchivedSessions
        .map((group) => ({ ...group, sessions: group.sessions.filter(hasSessionChats) }))
        .filter((group) => group.sessions.length > 0)
    const archivedCount = visibleArchivedGroups.reduce((sum, group) => sum + group.sessions.length, 0)
    const limitedBackgroundActivitySessions = backgroundActivitySessions.slice(0, 3)
    const remainingBackgroundActivityCount = Math.max(0, backgroundActivitySessions.length - limitedBackgroundActivitySessions.length)
    const labByRootPath = useMemo(
        () => new Map(playground.labs.map((lab) => [lab.rootPath, lab])),
        [playground.labs]
    )

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

    useEffect(() => {
        if (!labDialogOpen || labSource !== 'existing-folder' || !playground.rootPath) return

        const rootPath = playground.rootPath
        let cancelled = false
        setExistingRootFoldersLoading(true)

        void (async () => {
            try {
                const result = await window.devscope.scanProjects(rootPath, { forceRefresh: true })
                if (cancelled || !result.success) return
                const folders = [...(result.folders || [])].sort((left, right) => left.name.localeCompare(right.name))
                setExistingRootFolders(folders)
                setSelectedExistingFolderPath((current) => {
                    if (current && folders.some((folder) => folder.path === current)) return current
                    return folders[0]?.path || ''
                })
            } finally {
                if (!cancelled) setExistingRootFoldersLoading(false)
            }
        })()

        return () => {
            cancelled = true
        }
    }, [labDialogOpen, labSource, playground.rootPath])

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

    const handleShowMoreSessions = useCallback((groupKey: string, currentVisibleCount: number) => {
        setVisibleSessionCountByGroup((current) => ({
            ...current,
            [groupKey]: Math.max(CHAT_PAGE_SIZE, currentVisibleCount) + CHAT_PAGE_SIZE
        }))
    }, [])

    const handleShowLessSessions = useCallback((groupKey: string, minimumVisibleCount: number, currentVisibleCount: number) => {
        setVisibleSessionCountByGroup((current) => ({
            ...current,
            [groupKey]: Math.max(minimumVisibleCount, currentVisibleCount - CHAT_PAGE_SIZE)
        }))
    }, [])

    const handleChoosePlaygroundRoot = useCallback(async () => {
        const folderResult = await window.devscope.selectFolder()
        if (!folderResult.success || folderResult.cancelled || !folderResult.folderPath) return
        await onSetPlaygroundRoot(folderResult.folderPath)
    }, [onSetPlaygroundRoot])

    const handleCreateLab = useCallback(async () => {
        if (creatingLab) return
        setCreatingLab(true)
        try {
            if (labSource === 'existing-folder') {
                const existingFolderPath = selectedExistingFolderPath.trim()
                if (!existingFolderPath) return
                const existingLab = labByRootPath.get(existingFolderPath) || null
                if (existingLab) {
                    onCreatePlaygroundSession(existingLab.id)
                } else {
                    await onCreatePlaygroundLab({
                        title: labTitle || undefined,
                        source: 'existing-folder',
                        existingFolderPath,
                        openSession: true
                    })
                }
                setLabDialogOpen(false)
                return
            }
            await onCreatePlaygroundLab({
                title: labTitle || undefined,
                source: labSource,
                repoUrl: labSource === 'git-clone' ? labRepoUrl : undefined,
                openSession: true
            })
            setLabDialogOpen(false)
        } finally {
            setCreatingLab(false)
        }
    }, [creatingLab, labByRootPath, labRepoUrl, labSource, labTitle, onCreatePlaygroundLab, onCreatePlaygroundSession, selectedExistingFolderPath])

    const sectionLabel = railMode === 'playground' ? 'Labs' : 'Projects'
    const addButtonLabel = railMode === 'playground' ? 'Add Lab' : 'Add Project'
    const addButtonTitle = railMode === 'playground' ? 'Add Playground lab' : 'Add project (Open Folder)'
    const emptyStateTitle = railMode === 'playground' ? 'No labs yet' : 'No projects yet'
    const emptyStateAction = railMode === 'playground' ? 'Create your first lab' : 'Add a project to begin'
    const playgroundRootMissing = railMode === 'playground' && !playground.rootPath
    const nextRailMode: AssistantRailMode = railMode === 'work' ? 'playground' : 'work'
    const railToggleLabel = nextRailMode === 'playground' ? 'Playground' : 'Work'
    const railToggleTitle = nextRailMode === 'playground' ? 'Switch sidebar to Playground' : 'Switch sidebar to Work'
    const RailToggleIcon = nextRailMode === 'playground' ? GitBranch : BriefcaseBusiness

    return (
        <div className={cn('relative z-10 flex h-full flex-col', compact ? 'px-2.5' : 'px-3')}>
            <div className="flex items-center justify-between gap-2 px-1 py-3">
                <div className="flex min-w-0 flex-1 items-center gap-1.5">
                    <span className="text-sm font-semibold tracking-tight text-sparkle-text">T3 x dvs</span>
                    <span className="rounded-full bg-white/[0.06] px-1.5 py-0.5 text-[8px] font-medium uppercase tracking-[0.18em] text-sparkle-text-muted/60">Alpha</span>
                </div>
                <button
                    type="button"
                    onClick={() => onRailModeChange(nextRailMode)}
                    className={cn(
                        'inline-flex h-8 items-center gap-1.5 rounded-full border border-transparent px-3 text-[11px] font-medium transition-colors',
                        nextRailMode === 'playground'
                            ? 'bg-violet-500/[0.12] text-violet-200 hover:bg-violet-500/[0.18] hover:text-violet-100'
                            : 'bg-sky-500/[0.12] text-sky-200 hover:bg-sky-500/[0.18] hover:text-sky-100'
                    )}
                    title={railToggleTitle}
                >
                    <RailToggleIcon size={12} className="shrink-0" />
                    <span>{railToggleLabel}</span>
                </button>
            </div>
            <div className="mb-3 px-2">
                <button
                    type="button"
                    onClick={() => {
                        if (railMode === 'playground') {
                            if (!playground.rootPath) {
                                void handleChoosePlaygroundRoot()
                                return
                            }
                            setLabDialogOpen(true)
                            return
                        }
                        onChooseProjectPath()
                    }}
                    disabled={commandPending}
                    className="flex w-full items-center justify-center gap-2 rounded-md border border-dashed border-white/10 bg-white/[0.02] px-3 py-2 text-xs text-sparkle-text-muted/70 transition-all hover:border-[var(--accent-primary)]/50 hover:bg-[var(--accent-primary)]/10 hover:text-[var(--accent-primary)] disabled:opacity-40"
                    title={addButtonTitle}
                >
                    {railMode === 'playground' ? <GitBranch size={14} /> : <Plus size={14} />}
                    <span>{playgroundRootMissing ? 'Choose Playground Root' : addButtonLabel}</span>
                </button>
            </div>
            <div className="relative mb-3 flex items-center px-3"><div className="h-px flex-1 bg-white/5" /><span className="px-3 text-[10px] tracking-wide text-sparkle-text-muted/25">{sectionLabel}</span><div className="h-px flex-1 bg-white/5" /></div>
            <div className="min-h-0 flex-1 overflow-y-auto pr-1 scrollbar-hide">
                {playgroundRootMissing ? (
                    <div className={cn('flex flex-col items-center gap-3 px-4 text-center', compact ? 'py-6' : 'py-8')}>
                        <MessageSquarePlus size={compact ? 20 : 24} className="text-sparkle-text-muted/30" />
                        <div className="space-y-1">
                            <p className="text-xs font-medium text-sparkle-text">Choose your Playground root</p>
                            <p className="text-[11px] text-sparkle-text-muted">Pick one folder for labs and temp repos.</p>
                        </div>
                        <button
                            type="button"
                            onClick={() => void handleChoosePlaygroundRoot()}
                            className="rounded-md border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-sparkle-text-secondary transition-colors hover:border-white/20 hover:bg-white/[0.05] hover:text-sparkle-text"
                        >
                            Choose root
                        </button>
                        <button
                            type="button"
                            onClick={() => onCreatePlaygroundSession(null)}
                            className="text-[11px] text-sparkle-text-muted/70 transition-colors hover:text-sparkle-text"
                        >
                            Start chat only
                        </button>
                    </div>
                ) : null}
                {!playgroundRootMissing ? (
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
                                const minimumVisibleCount = activeSessionIndex >= 0
                                    ? Math.max(CHAT_PAGE_SIZE, Math.ceil((activeSessionIndex + 1) / CHAT_PAGE_SIZE) * CHAT_PAGE_SIZE)
                                    : CHAT_PAGE_SIZE
                                const resolvedVisibleCount = Math.max(configuredVisibleCount, minimumVisibleCount)
                                const visibleChatSessions = chatSessions.slice(0, resolvedVisibleCount)
                                const hasMoreChats = chatSessions.length > resolvedVisibleCount
                                const hiddenChatsCount = Math.max(0, chatSessions.length - resolvedVisibleCount)
                                const nextShowMoreCount = Math.min(CHAT_PAGE_SIZE, hiddenChatsCount)
                                const canShowLessChats = resolvedVisibleCount > minimumVisibleCount

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
                                                        <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-hidden"><span className="truncate text-xs font-medium text-sparkle-text/90">{railMode === 'playground' && !group.path ? 'Unassigned' : group.label}</span><span className="shrink-0 font-mono text-[10px] text-sparkle-text-muted/40">({chatSessions.length})</span></div>
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={(event) => {
                                                            event.stopPropagation()
                                                            railMode === 'playground'
                                                                ? onCreatePlaygroundSession(group.sessions[0]?.playgroundLabId || null)
                                                                : onCreateSession(group.path && group.path !== '' ? group.path : undefined)
                                                        }}
                                                        className={cn(
                                                            'absolute right-1 top-1 items-center justify-center rounded-md text-sparkle-text-muted/70 transition-colors hover:bg-white/[0.06] hover:text-sparkle-text',
                                                            railMode === 'playground'
                                                                ? 'inline-flex gap-1 px-1.5 py-1 text-[10px]'
                                                                : 'hidden size-5 p-0',
                                                            railMode !== 'playground' && !handleProps.isDragging && 'group-hover/project-header:flex'
                                                        )}
                                                        title={railMode === 'playground' ? 'New chat in lab' : 'New chat in project'}
                                                    >
                                                        <SquarePen size={12} />
                                                        {railMode === 'playground' ? <span>New</span> : null}
                                                    </button>
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
                                                                {hasMoreChats || canShowLessChats ? (
                                                                    <div className="mt-1 flex items-center gap-1.5">
                                                                        {hasMoreChats ? (
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => handleShowMoreSessions(group.key, resolvedVisibleCount)}
                                                                                className="flex-1 rounded-md border border-white/10 bg-white/[0.02] px-2 py-1.5 text-[11px] font-medium text-sparkle-text-muted/70 transition-colors hover:border-white/20 hover:bg-white/[0.04] hover:text-sparkle-text"
                                                                            >
                                                                                Show {nextShowMoreCount} more
                                                                            </button>
                                                                        ) : null}
                                                                        {canShowLessChats ? (
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => handleShowLessSessions(group.key, minimumVisibleCount, resolvedVisibleCount)}
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
                            {groupedSessions.length === 0 ? <div className={cn('flex flex-col items-center gap-2 px-4 text-center', compact ? 'py-6' : 'py-8')}><MessageSquarePlus size={compact ? 20 : 24} className="text-sparkle-text-muted/30" /><p className="text-xs text-sparkle-text-muted">{emptyStateTitle}</p><p className="text-[11px] text-sparkle-text-muted/55">{emptyStateAction}</p></div> : null}
                        </div>
                    </SortableContext>
                </DndContext>
                ) : null}
            </div>
            <div className="mt-auto space-y-0.5 border-t border-white/10 px-1 py-2">
                {limitedBackgroundActivitySessions.length > 0 ? (
                    <div className="mb-2 space-y-1">
                        <div className="flex items-center justify-between px-2">
                            <span className="text-[10px] uppercase tracking-[0.18em] text-sparkle-text-muted/35">Background Activity</span>
                            {remainingBackgroundActivityCount > 0 ? <span className="text-[10px] text-sparkle-text-muted/35">+{remainingBackgroundActivityCount} more</span> : null}
                        </div>
                        <div className="space-y-1">
                            {limitedBackgroundActivitySessions.map((session) => (
                                (() => {
                                    const status = resolveSessionStatusPill(session, activeSessionId)
                                    return (
                                        <button
                                            key={`background-${session.id}`}
                                            type="button"
                                            onClick={() => onSelectSession(session.id)}
                                            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-white/[0.04]"
                                        >
                                            <span className={cn('h-1.5 w-1.5 rounded-full shrink-0', status?.dotClass || (session.mode === 'playground' ? 'bg-violet-400' : 'bg-sky-400'))} />
                                            <div className="min-w-0 flex-1">
                                                <div className="truncate text-[11px] font-medium text-sparkle-text">{session.title}</div>
                                                <div className="truncate text-[10px] text-sparkle-text-muted/55">{session.mode === 'playground' ? 'Playground' : 'Work'} · {status?.label || 'Active'}</div>
                                            </div>
                                        </button>
                                    )
                                })()
                            ))}
                        </div>
                    </div>
                ) : null}
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
            <PlaygroundLabModal
                open={labDialogOpen}
                playground={playground}
                title={labTitle}
                repoUrl={labRepoUrl}
                source={labSource}
                creating={creatingLab}
                existingRootFolders={existingRootFolders}
                existingRootFoldersLoading={existingRootFoldersLoading}
                selectedExistingFolderPath={selectedExistingFolderPath}
                onClose={() => setLabDialogOpen(false)}
                onChangeTitle={setLabTitle}
                onChangeRepoUrl={setLabRepoUrl}
                onChangeSource={setLabSource}
                onChangeSelectedExistingFolderPath={setSelectedExistingFolderPath}
                onSubmit={() => void handleCreateLab()}
            />
        </div>
    )
}

function PlaygroundLabModal(props: {
    open: boolean
    playground: AssistantPlaygroundState
    title: string
    repoUrl: string
    source: 'empty' | 'git-clone' | 'existing-folder'
    creating: boolean
    existingRootFolders: DevScopeFolderItem[]
    existingRootFoldersLoading: boolean
    selectedExistingFolderPath: string
    onClose: () => void
    onChangeTitle: (value: string) => void
    onChangeRepoUrl: (value: string) => void
    onChangeSource: (value: 'empty' | 'git-clone' | 'existing-folder') => void
    onChangeSelectedExistingFolderPath: (value: string) => void
    onSubmit: () => void
}) {
    const {
        open,
        playground,
        title,
        repoUrl,
        source,
        creating,
        existingRootFolders,
        existingRootFoldersLoading,
        selectedExistingFolderPath,
        onClose,
        onChangeTitle,
        onChangeRepoUrl,
        onChangeSource,
        onChangeSelectedExistingFolderPath,
        onSubmit
    } = props
    if (!open || typeof document === 'undefined') return null
    const registeredLabByPath = new Map(playground.labs.map((lab) => [lab.rootPath, lab]))
    const hasExistingFolders = existingRootFolders.length > 0

    return createPortal(
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4" onClick={onClose}>
            <div className="absolute inset-0 bg-black/60 backdrop-blur-md animate-fadeIn" />
            <div className="relative w-full max-w-md overflow-hidden rounded-[24px] border border-white/10 bg-sparkle-card shadow-2xl animate-scaleIn" onClick={(event) => event.stopPropagation()}>
                <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-[var(--accent-primary)]/40 via-[var(--accent-primary)]/10 to-transparent" />
                <div className="p-6">
                    <h3 className="mb-1 text-lg font-bold tracking-tight text-white">Add Lab</h3>
                    <p className="mb-5 text-sm text-sparkle-text-secondary">Create a fresh lab, clone a repo, or register an existing Playground folder.</p>
                    <div className="mb-4 grid grid-cols-3 gap-2">
                        {([
                            ['empty', 'Empty'],
                            ['git-clone', 'Clone'],
                            ['existing-folder', 'Existing']
                        ] as const).map(([value, label]) => (
                            <button
                                key={value}
                                type="button"
                                onClick={() => onChangeSource(value)}
                                className={cn(
                                    'rounded-lg border px-2 py-2 text-xs font-medium transition-colors',
                                    source === value
                                        ? 'border-white/20 bg-white/[0.08] text-sparkle-text'
                                        : 'border-white/10 bg-white/[0.02] text-sparkle-text-muted/70 hover:bg-white/[0.04] hover:text-sparkle-text'
                                )}
                            >
                                {label}
                            </button>
                        ))}
                    </div>
                    <div className="space-y-3">
                        <input
                            value={title}
                            onChange={(event) => onChangeTitle(event.target.value)}
                            className="w-full rounded-xl border border-white/10 bg-sparkle-bg px-4 py-3 text-sm text-sparkle-text outline-none transition-all focus:border-[var(--accent-primary)]/40 focus:ring-4 focus:ring-[var(--accent-primary)]/10"
                            placeholder="Lab name"
                            maxLength={120}
                        />
                        {source === 'git-clone' ? (
                            <input
                                value={repoUrl}
                                onChange={(event) => onChangeRepoUrl(event.target.value)}
                                className="w-full rounded-xl border border-white/10 bg-sparkle-bg px-4 py-3 text-sm text-sparkle-text outline-none transition-all focus:border-[var(--accent-primary)]/40 focus:ring-4 focus:ring-[var(--accent-primary)]/10"
                                placeholder="https://github.com/owner/repo.git"
                            />
                        ) : null}
                        {source === 'existing-folder' ? (
                            <div className="space-y-2">
                                {existingRootFoldersLoading ? (
                                    <p className="rounded-xl border border-white/10 bg-white/[0.02] px-3 py-3 text-xs text-sparkle-text-muted/70">
                                        Loading folders from your Playground root...
                                    </p>
                                ) : hasExistingFolders ? (
                                    <div className="max-h-44 space-y-1 overflow-y-auto rounded-xl border border-white/10 bg-white/[0.02] p-2 custom-scrollbar">
                                        {existingRootFolders.map((folder) => {
                                            const existingLab = registeredLabByPath.get(folder.path) || null
                                            return (
                                                <button
                                                    key={folder.path}
                                                    type="button"
                                                    onClick={() => onChangeSelectedExistingFolderPath(folder.path)}
                                                    className={cn(
                                                        'flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left transition-colors',
                                                        selectedExistingFolderPath === folder.path
                                                            ? 'bg-white/[0.08] text-sparkle-text'
                                                            : 'text-sparkle-text-secondary hover:bg-white/[0.04]'
                                                    )}
                                                >
                                                    <div className="min-w-0">
                                                        <div className="truncate text-sm font-medium">{folder.name}</div>
                                                        <div className="truncate text-[11px] text-sparkle-text-muted/60">{folder.path}</div>
                                                    </div>
                                                    <span className="shrink-0 rounded-full bg-white/[0.05] px-2 py-0.5 text-[10px] text-sparkle-text-muted/75">
                                                        {existingLab ? 'Lab exists' : 'Folder'}
                                                    </span>
                                                </button>
                                            )
                                        })}
                                    </div>
                                ) : (
                                    <div className="rounded-xl border border-white/10 bg-white/[0.02] px-3 py-3 text-xs text-sparkle-text-muted/70">
                                        <p>No folders found in this Playground root.</p>
                                        <button
                                            type="button"
                                            onClick={() => onChangeSource('empty')}
                                            className="mt-2 text-[11px] font-medium text-sparkle-text transition-colors hover:text-white"
                                        >
                                            Create an empty lab instead
                                        </button>
                                    </div>
                                )}
                            </div>
                        ) : null}
                    </div>
                    <div className="mt-7 flex items-center gap-3">
                        <button type="button" onClick={onClose} className="flex-1 rounded-xl border border-white/10 bg-sparkle-bg px-4 py-2.5 text-sm font-semibold text-sparkle-text-secondary transition-all hover:border-white/20 hover:bg-sparkle-card-hover hover:text-white">Cancel</button>
                        <button
                            type="button"
                            onClick={onSubmit}
                            disabled={creating || (source === 'git-clone' && !repoUrl.trim()) || (source === 'existing-folder' && !selectedExistingFolderPath && hasExistingFolders)}
                            className={cn(
                                'flex-1 rounded-xl px-4 py-2.5 text-sm font-bold transition-all shadow-lg',
                                creating || (source === 'git-clone' && !repoUrl.trim()) || (source === 'existing-folder' && !selectedExistingFolderPath && hasExistingFolders)
                                    ? 'bg-sparkle-border/40 text-sparkle-text-muted cursor-not-allowed opacity-50'
                                    : 'bg-[var(--accent-primary)] text-white hover:bg-[var(--accent-primary)]/90 shadow-[var(--accent-primary)]/20 active:scale-[0.98]'
                            )}
                        >
                            {creating ? 'Creating...' : source === 'existing-folder' && registeredLabByPath.get(selectedExistingFolderPath) ? 'Open Lab Chat' : 'Create Lab'}
                        </button>
                    </div>
                </div>
            </div>
        </div>,
        document.body
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
