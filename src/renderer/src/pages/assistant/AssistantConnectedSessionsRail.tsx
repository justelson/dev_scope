import { memo } from 'react'
import { useAssistantSessionsRailStore } from '@/lib/assistant/store'
import { getAssistantBackgroundActivitySessions, getAssistantSessionsByMode } from '@/lib/assistant/selectors'
import { AssistantSessionsRail } from './AssistantSessionsRail'
import type { AssistantRailMode } from './useAssistantPageSidebarState'

export const ConnectedAssistantSessionsRail = memo(function ConnectedAssistantSessionsRail(props: {
    collapsed: boolean
    width: number
    railMode: AssistantRailMode
    onRailModeChange: (next: AssistantRailMode) => void
    onWidthChange: (next: number) => void
}) {
    const { collapsed, width, railMode, onRailModeChange, onWidthChange } = props
    const railController = useAssistantSessionsRailStore()
    const otherMode: AssistantRailMode = railMode === 'work' ? 'playground' : 'work'
    const visibleSessions = getAssistantSessionsByMode(railController.snapshot, railMode, true)
    const backgroundActivitySessions = getAssistantBackgroundActivitySessions(railController.snapshot, otherMode, railController.activeSessionId)

    return (
        <AssistantSessionsRail
            collapsed={collapsed}
            width={width}
            compact={false}
            railMode={railMode}
            onRailModeChange={onRailModeChange}
            sessions={visibleSessions}
            playground={railController.playground}
            backgroundActivitySessions={backgroundActivitySessions}
            activeSessionId={railController.activeSessionId}
            commandPending={railController.commandPending}
            onWidthChange={onWidthChange}
            onCreateSession={(projectPath) => railController.createSession({ projectPath })}
            onCreatePlaygroundSession={(labId) => railController.createSession({ mode: 'playground', playgroundLabId: labId || null })}
            onSelectSession={railController.selectSession}
            onRenameSession={railController.renameSession}
            onArchiveSession={railController.archiveSession}
            onDeleteSession={railController.deleteSession}
            onChooseProjectPath={railController.createProjectSession}
            onSetPlaygroundRoot={railController.setPlaygroundRoot}
            onCreatePlaygroundLab={railController.createPlaygroundLabResult}
        />
    )
})
