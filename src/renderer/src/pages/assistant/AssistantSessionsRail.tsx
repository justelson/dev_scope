import { useEffect, useMemo, useState } from 'react'
import type { AssistantSession } from '@shared/assistant/contracts'
import {
    CollapsedSessionsRailContent,
    ExpandedSessionsRailContent,
    RenameSessionModal,
    SessionDeleteModal
} from './AssistantSessionsRailParts'
import {
    getDisplayTitle,
    groupSessionsByProject,
    type AssistantSessionsRailProps
} from './assistant-sessions-rail-utils'

export function AssistantSessionsRail({
    collapsed,
    width,
    compact = false,
    sessions,
    activeSessionId,
    commandPending,
    onSetCollapsed,
    onWidthChange,
    onCreateSession,
    onSelectSession,
    onRenameSession,
    onArchiveSession,
    onDeleteSession,
    onChooseProjectPath
}: AssistantSessionsRailProps) {
    const [renameTarget, setRenameTarget] = useState<AssistantSession | null>(null)
    const [renameDraft, setRenameDraft] = useState('')
    const [sessionToDelete, setSessionToDelete] = useState<AssistantSession | null>(null)
    const [expandedGroupKeys, setExpandedGroupKeys] = useState<Set<string>>(new Set())
    const [showArchivedSessions, setShowArchivedSessions] = useState(false)

    const activeSessions = useMemo(() => sessions.filter((session) => {
        if (session.archived) return false
        if (activeSessionId === session.id) return true
        return session.threads?.some((thread) => thread.messages?.length > 0)
    }), [sessions, activeSessionId])
    const archivedSessions = useMemo(() => sessions.filter((session) => session.archived), [sessions])
    const groupedSessions = useMemo(() => groupSessionsByProject(activeSessions), [activeSessions])
    const groupedArchivedSessions = useMemo(() => groupSessionsByProject(archivedSessions), [archivedSessions])

    useEffect(() => {
        if (activeSessionId && archivedSessions.some((session) => session.id === activeSessionId)) {
            setShowArchivedSessions(true)
        }
    }, [activeSessionId, archivedSessions])

    useEffect(() => {
        setExpandedGroupKeys((prev) => {
            const validKeys = new Set(groupedSessions.map((group) => group.key))
            const next = new Set(Array.from(prev).filter((key) => validKeys.has(key)))
            for (const group of groupedSessions.slice(0, 2)) {
                if (!prev.has(group.key)) next.add(group.key)
            }
            if (activeSessionId) {
                const activeGroup = groupedSessions.find((group) => group.sessions.some((session) => session.id === activeSessionId))
                if (activeGroup) next.add(activeGroup.key)
            }
            return next
        })
    }, [activeSessionId, groupedSessions])

    const openRenameModal = (session: AssistantSession) => {
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

    const minSidebarWidth = 180
    const maxSidebarWidth = compact ? 420 : 520
    const resolvedWidth = Math.max(minSidebarWidth, Math.min(maxSidebarWidth, Math.round(width)))
    const collapsedWidth = compact ? 56 : 64
    const railTitle = collapsed ? 'Expand assistant sidebar' : onWidthChange ? 'Drag to resize assistant sidebar' : 'Assistant sidebar'

    const handleResizeStart = (event: React.MouseEvent<HTMLButtonElement>) => {
        if (collapsed || !onWidthChange) return
        event.preventDefault()
        event.stopPropagation()
        const startX = event.clientX
        const startWidth = resolvedWidth
        document.body.style.cursor = 'col-resize'
        document.body.style.userSelect = 'none'

        const handleMove = (moveEvent: MouseEvent) => {
            onWidthChange(Math.max(minSidebarWidth, Math.min(maxSidebarWidth, Math.round(startWidth + (moveEvent.clientX - startX)))))
        }
        const handleUp = () => {
            document.body.style.cursor = ''
            document.body.style.userSelect = ''
            window.removeEventListener('mousemove', handleMove)
            window.removeEventListener('mouseup', handleUp)
        }

        window.addEventListener('mousemove', handleMove)
        window.addEventListener('mouseup', handleUp)
    }

    return (
        <div className="group relative h-full shrink-0" data-collapsible={collapsed ? 'icon' : ''} data-side="left" data-state={collapsed ? 'collapsed' : 'expanded'} style={{ ['--assistant-sidebar-width' as string]: `${resolvedWidth}px`, ['--assistant-sidebar-width-icon' as string]: `${collapsedWidth}px` }}>
            <div className={`relative h-full bg-transparent transition-[width] duration-200 ease-linear ${collapsed ? 'w-[var(--assistant-sidebar-width-icon)]' : 'w-[var(--assistant-sidebar-width)]'}`} />
            <div className={`absolute inset-y-0 left-0 z-10 flex h-full transition-[width] duration-200 ease-linear ${collapsed ? 'w-[var(--assistant-sidebar-width-icon)]' : 'w-[var(--assistant-sidebar-width)]'}`}>
                <aside className="relative h-full w-full overflow-x-hidden border-r border-white/10 bg-sparkle-card/95 backdrop-blur-sm">
                    {collapsed ? (
                        <CollapsedSessionsRailContent compact={compact} groupedSessions={groupedSessions} activeSessionId={activeSessionId} onSetCollapsed={onSetCollapsed} onSelectSession={(sessionId) => void onSelectSession(sessionId)} />
                    ) : (
                        <ExpandedSessionsRailContent
                            compact={compact}
                            commandPending={commandPending}
                            groupedSessions={groupedSessions}
                            groupedArchivedSessions={groupedArchivedSessions}
                            activeSessionId={activeSessionId}
                            expandedGroupKeys={expandedGroupKeys}
                            showArchivedSessions={showArchivedSessions}
                            onToggleGroup={(key) => setExpandedGroupKeys((prev) => { const next = new Set(prev); if (next.has(key)) next.delete(key); else next.add(key); return next })}
                            onChooseProjectPath={() => void onChooseProjectPath()}
                            onCreateSession={(projectPath) => void onCreateSession(projectPath)}
                            onSelectSession={(sessionId) => void onSelectSession(sessionId)}
                            onOpenRename={openRenameModal}
                            onArchiveSession={(sessionId, archived) => void onArchiveSession(sessionId, archived)}
                            onDeleteRequest={setSessionToDelete}
                            onSetShowArchivedSessions={setShowArchivedSessions}
                            onSetCollapsed={onSetCollapsed}
                        />
                    )}
                    <button type="button" aria-label={railTitle} onClick={() => { if (collapsed) onSetCollapsed(false) }} onMouseDown={handleResizeStart} className={`absolute inset-y-0 right-0 z-20 hidden w-4 translate-x-1/2 transition-all ease-linear sm:flex ${collapsed ? 'cursor-e-resize' : 'cursor-w-resize'} after:absolute after:inset-y-0 after:left-1/2 after:w-[2px] after:bg-transparent hover:after:bg-white/10`} title={railTitle} />
                    <RenameSessionModal renameTarget={renameTarget} renameDraft={renameDraft} onChangeDraft={setRenameDraft} onClose={closeRenameModal} onSubmit={() => void submitRename()} />
                    <SessionDeleteModal sessionToDelete={sessionToDelete} onConfirm={() => { if (sessionToDelete) void onDeleteSession(sessionToDelete.id); setSessionToDelete(null) }} onCancel={() => setSessionToDelete(null)} />
                </aside>
            </div>
        </div>
    )
}
