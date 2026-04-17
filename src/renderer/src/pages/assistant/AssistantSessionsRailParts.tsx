import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react'
import {
    type DragCancelEvent,
    type DragEndEvent,
    type DragStartEvent
} from '@dnd-kit/core'
import type { AssistantSession } from '@shared/assistant/contracts'
import type { DevScopeFolderItem } from '@shared/contracts/devscope-api'
import { cn } from '@/lib/utils'
import { AssistantSessionsRailBody } from './AssistantSessionsRailBody'
import {
    LabDeleteModal,
    PlaygroundLabModal,
    ProjectChatsDeleteModal
} from './AssistantSessionsRailDialogs'
import { AssistantSessionsRailFooter } from './AssistantSessionsRailFooter'
import { AssistantSessionsRailHeaderControls } from './AssistantSessionsRailHeaderControls'
import type { ExpandedSessionsRailContentProps } from './AssistantSessionsRailParts.types'
import type { SessionProjectGroup } from './assistant-sessions-rail-utils'
import {
    buildAssistantThreadRecencyTierMap,
    getSessionDisplayTitle
} from './assistant-sessions-rail-utils'
import { createProjectActionMenuItems, createSessionActionMenuItems } from './assistant-sessions-rail-menus'
import { useAssistantRailContextMenu } from './useAssistantRailContextMenu'
import {
    hasSessionChats,
    useAssistantRailCollisionDetection,
    useAssistantRailSensors
} from './AssistantSessionsRailRows'

const CHAT_PAGE_SIZE = 5

function getTrailingPathSegment(value: string): string {
    const normalized = String(value || '').trim().replace(/[\\/]+$/g, '')
    if (!normalized) return ''
    const segment = normalized.split(/[\\/]/).pop()?.trim() || ''
    return segment.replace(/\.git$/i, '').trim()
}

function resolveRequestedLabTitle(input: {
    title: string
    source: 'empty' | 'git-clone' | 'existing-folder'
    repoUrl: string
    existingFolderPath: string
}): string {
    const explicitTitle = input.title.trim()
    if (explicitTitle) return explicitTitle
    if (input.source === 'git-clone') return getTrailingPathSegment(input.repoUrl) || 'New Lab'
    if (input.source === 'existing-folder') return getTrailingPathSegment(input.existingFolderPath) || 'New Lab'
    return 'New Lab'
}

export { RenameSessionModal, SessionDeleteModal } from './AssistantSessionsRailDialogs'

export function ExpandedSessionsRailContent(props: ExpandedSessionsRailContentProps) {
    const {
        compact,
        railMode,
        playground,
        backgroundActivitySessions,
        commandPending,
        groupedSessions,
        groupedArchivedSessions,
        activeSessionId,
        activeThreadId,
        expandedGroupKeys,
        showArchivedSessions,
        onRailModeChange,
        onToggleGroup,
        onChooseProjectPath,
        onCreateSession,
        onCreatePlaygroundSession,
        onSelectSession,
        onSelectThread,
        onOpenRename,
        onArchiveSession,
        onDeleteRequest,
        onDeleteSession,
        onSetShowArchivedSessions,
        onSetPlaygroundRoot,
        onCreatePlaygroundLab,
        onDeletePlaygroundLab,
        onProjectDragStart,
        onProjectDragEnd,
        onProjectDragCancel,
        onSessionDragStart,
        onSessionDragEnd,
        onSessionDragCancel,
        onShowToast
    } = props

    const projectSensors = useAssistantRailSensors()
    const collisionDetection = useAssistantRailCollisionDetection()
    const projectDragInProgressRef = useRef(false)
    const suppressProjectClickAfterDragRef = useRef(false)
    const { openContextMenu, contextMenuPortal } = useAssistantRailContextMenu()
    const [visibleSessionCountByGroup, setVisibleSessionCountByGroup] = useState<Record<string, number>>({})
    const [creatingLab, setCreatingLab] = useState(false)
    const [labDialogOpen, setLabDialogOpen] = useState(false)
    const [labTitle, setLabTitle] = useState('')
    const [labRepoUrl, setLabRepoUrl] = useState('')
    const [labSource, setLabSource] = useState<'empty' | 'git-clone' | 'existing-folder'>('empty')
    const [existingRootFolders, setExistingRootFolders] = useState<DevScopeFolderItem[]>([])
    const [existingRootFoldersLoading, setExistingRootFoldersLoading] = useState(false)
    const [selectedExistingFolderPath, setSelectedExistingFolderPath] = useState('')
    const [labToDelete, setLabToDelete] = useState<{ labId: string; label: string } | null>(null)
    const [projectChatsToDelete, setProjectChatsToDelete] = useState<{ label: string; sessionIds: string[] } | null>(null)
    const [deletingProjectChats, setDeletingProjectChats] = useState(false)
    const [deletingLabId, setDeletingLabId] = useState<string | null>(null)
    const [expandedThreadKeys, setExpandedThreadKeys] = useState<Set<string>>(new Set())

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
    const allVisibleSessions = useMemo(
        () => [...groupedSessions.flatMap((group) => group.sessions), ...groupedArchivedSessions.flatMap((group) => group.sessions)],
        [groupedArchivedSessions, groupedSessions]
    )
    const recencyTierByThreadId = useMemo(() => {
        const sessionsById = new Map<string, AssistantSession>()
        for (const session of allVisibleSessions) sessionsById.set(session.id, session)
        for (const session of backgroundActivitySessions) sessionsById.set(session.id, session)
        return buildAssistantThreadRecencyTierMap(Array.from(sessionsById.values()))
    }, [allVisibleSessions, backgroundActivitySessions])

    const handleDeleteLabRequest = useCallback((labId: string, label: string) => {
        setLabToDelete({ labId, label })
    }, [])

    const handleDeleteProjectChatsRequest = useCallback((group: SessionProjectGroup) => {
        const sessionIds = group.sessions.map((session) => session.id)
        if (sessionIds.length === 0) return
        setProjectChatsToDelete({ label: group.label, sessionIds })
    }, [])

    const getSessionMenuItems = useCallback((session: AssistantSession, archived = false) => (
        createSessionActionMenuItems({
            session,
            archived,
            onOpenRename,
            onArchiveSession,
            onDeleteRequest
        })
    ), [onArchiveSession, onDeleteRequest, onOpenRename])

    const openSessionContextMenu = useCallback((
        event: ReactMouseEvent<HTMLElement>,
        session: AssistantSession,
        archived = false
    ) => {
        openContextMenu(event, `${getSessionDisplayTitle(session)} actions`, getSessionMenuItems(session, archived))
    }, [getSessionMenuItems, openContextMenu])

    const getGroupPlaygroundLabId = useCallback((group: SessionProjectGroup) => {
        const directLabId = group.sessions[0]?.playgroundLabId || null
        if (directLabId) return directLabId
        if (!group.path) return null
        return labByRootPath.get(group.path)?.id || null
    }, [labByRootPath])

    const getProjectMenuItems = useCallback((group: SessionProjectGroup, isExpanded: boolean) => (
        createProjectActionMenuItems({
            railMode,
            group,
            playgroundLabId: getGroupPlaygroundLabId(group),
            isExpanded,
            onToggleGroup,
            onCreateSession,
            onCreatePlaygroundSession,
            onDeletePlaygroundLab: handleDeleteLabRequest,
            onDeleteProjectChats: handleDeleteProjectChatsRequest
        })
    ), [getGroupPlaygroundLabId, handleDeleteLabRequest, handleDeleteProjectChatsRequest, onCreatePlaygroundSession, onCreateSession, onToggleGroup, railMode])

    const openProjectContextMenu = useCallback((
        event: ReactMouseEvent<HTMLElement>,
        group: SessionProjectGroup,
        isExpanded: boolean
    ) => {
        openContextMenu(event, `${group.label} actions`, getProjectMenuItems(group, isExpanded))
    }, [getProjectMenuItems, openContextMenu])

    const handleCreateProjectChat = useCallback((group: SessionProjectGroup) => {
        const labId = getGroupPlaygroundLabId(group)
        if (railMode === 'playground') {
            onCreatePlaygroundSession(labId)
            return
        }
        onCreateSession(group.path || undefined)
    }, [getGroupPlaygroundLabId, onCreatePlaygroundSession, onCreateSession, railMode])

    const handleDeleteProjectGroup = useCallback((group: SessionProjectGroup) => {
        const labId = getGroupPlaygroundLabId(group)
        if (railMode === 'playground' && labId) {
            handleDeleteLabRequest(labId, group.label)
            return
        }
        handleDeleteProjectChatsRequest(group)
    }, [getGroupPlaygroundLabId, handleDeleteLabRequest, handleDeleteProjectChatsRequest, railMode])

    const handleConfirmDeleteProjectChats = useCallback(async () => {
        if (!projectChatsToDelete || deletingProjectChats) return
        const { label, sessionIds } = projectChatsToDelete
        let deletedCount = 0
        let firstError: string | null = null

        try {
            setDeletingProjectChats(true)
            for (const sessionId of sessionIds) {
                const result = await onDeleteSession(sessionId)
                if (result.success) {
                    deletedCount += 1
                    continue
                }
                if (!firstError) firstError = result.error
            }

            if (deletedCount === sessionIds.length) {
                setProjectChatsToDelete(null)
                onShowToast({ message: `Deleted ${deletedCount} chat${deletedCount === 1 ? '' : 's'} from "${label}"` })
                return
            }

            if (deletedCount > 0) {
                setProjectChatsToDelete(null)
                onShowToast({
                    message: `Deleted ${deletedCount} of ${sessionIds.length} chats from "${label}". ${firstError || 'Some chats could not be deleted.'}`,
                    tone: 'error'
                })
                return
            }

            onShowToast({
                message: `Failed to delete chats from "${label}": ${firstError || 'Unknown error.'}`,
                tone: 'error'
            })
        } finally {
            setDeletingProjectChats(false)
        }
    }, [deletingProjectChats, onDeleteSession, onShowToast, projectChatsToDelete])

    const handleConfirmDeleteLab = useCallback(async () => {
        if (!labToDelete || deletingLabId) return

        try {
            setDeletingLabId(labToDelete.labId)
            const result = await onDeletePlaygroundLab(labToDelete.labId)
            if (!result.success) {
                onShowToast({
                    message: `Failed to remove lab "${labToDelete.label}": ${result.error}`,
                    tone: 'error'
                })
                return
            }
            setLabToDelete(null)
            onShowToast({ message: `Removed lab "${labToDelete.label}"` })
        } finally {
            setDeletingLabId(null)
        }
    }, [deletingLabId, labToDelete, onDeletePlaygroundLab, onShowToast])

    useEffect(() => {
        setExpandedThreadKeys((current) => {
            const next = new Set(
                Array.from(current).filter((threadId) =>
                    allVisibleSessions.some((session) => session.threads.some((thread) => thread.id === threadId && thread.source === 'subagent'))
                )
            )

            if (!activeThreadId) return next

            const activeSession = allVisibleSessions.find((session) => session.id === activeSessionId) || null
            const activeThread = activeSession?.threads.find((thread) => thread.id === activeThreadId) || null
            if (!activeSession || !activeThread || activeThread.source !== 'subagent') return next

            const threadById = new Map(activeSession.threads.map((thread) => [thread.id, thread]))
            let parentThreadId = activeThread.parentThreadId

            while (parentThreadId) {
                const parentThread = threadById.get(parentThreadId)
                if (!parentThread || parentThread.source !== 'subagent') break
                next.add(parentThread.id)
                parentThreadId = parentThread.parentThreadId
            }

            if (activeSession.threads.some((thread) => thread.parentThreadId === activeThread.id && thread.source === 'subagent')) {
                next.add(activeThread.id)
            }

            return next
        })
    }, [activeSessionId, activeThreadId, allVisibleSessions])

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

    const handleToggleThread = useCallback((threadId: string) => {
        setExpandedThreadKeys((current) => {
            const next = new Set(current)
            if (next.has(threadId)) next.delete(threadId)
            else next.add(threadId)
            return next
        })
    }, [])

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

    const handleShowMoreSessions = useCallback((groupKey: string, nextVisibleCount: number) => {
        setVisibleSessionCountByGroup((current) => ({
            ...current,
            [groupKey]: Math.max(CHAT_PAGE_SIZE, nextVisibleCount)
        }))
    }, [])

    const handleShowLessSessions = useCallback((groupKey: string, minimumVisibleCount: number) => {
        setVisibleSessionCountByGroup((current) => ({
            ...current,
            [groupKey]: Math.max(CHAT_PAGE_SIZE, minimumVisibleCount)
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
            const requestedLabTitle = resolveRequestedLabTitle({
                title: labTitle,
                source: labSource,
                repoUrl: labRepoUrl,
                existingFolderPath: selectedExistingFolderPath
            })

            if (labSource === 'existing-folder') {
                const existingFolderPath = selectedExistingFolderPath.trim()
                if (!existingFolderPath) return
                const existingLab = labByRootPath.get(existingFolderPath) || null
                if (existingLab) {
                    await Promise.resolve(onCreatePlaygroundSession(existingLab.id))
                    setLabDialogOpen(false)
                    onShowToast({ message: `Opened a new chat in "${existingLab.title}".` })
                } else {
                    const result = await onCreatePlaygroundLab({
                        title: labTitle || undefined,
                        source: 'existing-folder',
                        existingFolderPath,
                        openSession: true
                    })
                    if (!result.success) {
                        onShowToast({
                            message: `Failed to create lab "${requestedLabTitle}": ${result.error}`,
                            tone: 'error'
                        })
                        return
                    }
                    const createdLabTitle = result.playground.labs.find((lab) => lab.id === result.labId)?.title || requestedLabTitle
                    if (result.sessionId) {
                        await Promise.resolve(onSelectSession(result.sessionId))
                    }
                    setLabDialogOpen(false)
                    onShowToast({ message: `"${createdLabTitle}" lab has been created with a new chat open.` })
                }
                return
            }

            const result = await onCreatePlaygroundLab({
                title: labTitle || undefined,
                source: labSource,
                repoUrl: labSource === 'git-clone' ? labRepoUrl : undefined,
                openSession: true
            })

            if (!result.success) {
                onShowToast({
                    message: labSource === 'git-clone'
                        ? `Failed to clone repo into "${requestedLabTitle}": ${result.error}`
                        : `Failed to create lab "${requestedLabTitle}": ${result.error}`,
                    tone: 'error'
                })
                return
            }

            const createdLabTitle = result.playground.labs.find((lab) => lab.id === result.labId)?.title || requestedLabTitle
            if (result.sessionId) {
                await Promise.resolve(onSelectSession(result.sessionId))
            }
            setLabDialogOpen(false)
            onShowToast({
                message: labSource === 'git-clone'
                    ? `Repo cloned. "${createdLabTitle}" lab has been created with a new chat open.`
                    : `"${createdLabTitle}" lab has been created with a new chat open.`
            })
        } finally {
            setCreatingLab(false)
        }
    }, [creatingLab, labByRootPath, labRepoUrl, labSource, labTitle, onCreatePlaygroundLab, onCreatePlaygroundSession, onSelectSession, onShowToast, selectedExistingFolderPath])

    const sectionLabel = railMode === 'playground' ? 'Labs' : 'Projects'
    const playgroundRootMissing = railMode === 'playground' && !playground.rootPath
    const unassignedGroup = railMode === 'playground'
        ? groupedSessions.find((group) => !group.path) || null
        : null
    const labGroups = railMode === 'playground'
        ? groupedSessions.filter((group) => Boolean(group.path))
        : groupedSessions

    return (
        <div className={cn('relative z-10 flex h-full flex-col', compact ? 'pl-2.5 pr-1' : 'pl-3 pr-1.5')}>
            <AssistantSessionsRailHeaderControls
                railMode={railMode}
                commandPending={commandPending}
                playgroundRootMissing={playgroundRootMissing}
                onRailModeChange={onRailModeChange}
                onChooseProjectPath={onChooseProjectPath}
                onOpenLabDialog={() => setLabDialogOpen(true)}
                onChoosePlaygroundRoot={() => void handleChoosePlaygroundRoot()}
                onCreatePlaygroundSession={onCreatePlaygroundSession}
            />

            <AssistantSessionsRailBody
                compact={compact}
                railMode={railMode}
                playgroundRootMissing={playgroundRootMissing}
                sectionLabel={sectionLabel}
                unassignedGroup={unassignedGroup}
                labGroups={labGroups}
                activeSessionId={activeSessionId}
                activeThreadId={activeThreadId}
                expandedGroupKeys={expandedGroupKeys}
                expandedThreadKeys={expandedThreadKeys}
                visibleSessionCountByGroup={visibleSessionCountByGroup}
                recencyTierByThreadId={recencyTierByThreadId}
                projectSensors={projectSensors}
                collisionDetection={collisionDetection}
                getSessionMenuItems={getSessionMenuItems}
                onSessionContextMenu={openSessionContextMenu}
                onSessionDragStart={onSessionDragStart}
                onSessionDragEnd={onSessionDragEnd}
                onSessionDragCancel={onSessionDragCancel}
                onToggleThread={handleToggleThread}
                onSelectThread={onSelectThread}
                onToggleGroup={onToggleGroup}
                onProjectContextMenu={openProjectContextMenu}
                onProjectTitlePointerDownCapture={handleProjectTitlePointerDownCapture}
                onProjectTitleClick={handleProjectTitleClick}
                onProjectDragStart={handleProjectSortStart}
                onProjectDragEnd={handleProjectSortEnd}
                onProjectDragCancel={handleProjectSortCancel}
                onCreateProjectChat={handleCreateProjectChat}
                onDeleteProjectGroup={handleDeleteProjectGroup}
                onChoosePlaygroundRoot={handleChoosePlaygroundRoot}
                onShowMoreSessions={handleShowMoreSessions}
                onShowLessSessions={handleShowLessSessions}
                getGroupPlaygroundLabId={getGroupPlaygroundLabId}
            />

            <AssistantSessionsRailFooter
                compact={compact}
                activeSessionId={activeSessionId}
                activeThreadId={activeThreadId}
                recencyTierByThreadId={recencyTierByThreadId}
                limitedBackgroundActivitySessions={limitedBackgroundActivitySessions}
                remainingBackgroundActivityCount={remainingBackgroundActivityCount}
                archivedCount={archivedCount}
                showArchivedSessions={showArchivedSessions}
                visibleArchivedGroups={visibleArchivedGroups}
                getSessionMenuItems={getSessionMenuItems}
                onSessionContextMenu={openSessionContextMenu}
                onSetShowArchivedSessions={onSetShowArchivedSessions}
                onSelectSession={onSelectSession}
                onSelectThread={onSelectThread}
            />

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
                onClose={() => {
                    if (creatingLab) return
                    setLabDialogOpen(false)
                }}
                onChangeTitle={setLabTitle}
                onChangeRepoUrl={setLabRepoUrl}
                onChangeSource={setLabSource}
                onChangeSelectedExistingFolderPath={setSelectedExistingFolderPath}
                onSubmit={() => void handleCreateLab()}
            />
            <LabDeleteModal
                labToDelete={labToDelete}
                deletingLabId={deletingLabId}
                onConfirm={() => void handleConfirmDeleteLab()}
                onCancel={() => {
                    if (deletingLabId) return
                    setLabToDelete(null)
                }}
            />
            <ProjectChatsDeleteModal
                projectChatsToDelete={projectChatsToDelete}
                deletingProjectChats={deletingProjectChats}
                onConfirm={() => void handleConfirmDeleteProjectChats()}
                onCancel={() => {
                    if (deletingProjectChats) return
                    setProjectChatsToDelete(null)
                }}
            />
            {contextMenuPortal}
        </div>
    )
}
