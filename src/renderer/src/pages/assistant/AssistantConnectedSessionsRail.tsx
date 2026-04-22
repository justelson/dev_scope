import { memo } from 'react'
import { useAssistantSessionsRailStore } from '@/lib/assistant/store'
import { getAssistantBackgroundActivitySessions, getAssistantSessionsByMode } from '@/lib/assistant/selectors'
import type { AssistantToastInput } from './AssistantPageHelpers'
import { AssistantSessionsRail } from './AssistantSessionsRail'
import type {
    AssistantRailFilterMode,
    AssistantRailGroupMode,
    AssistantRailMode,
    AssistantRailSortMode
} from './useAssistantPageSidebarState'

export const ConnectedAssistantSessionsRail = memo(function ConnectedAssistantSessionsRail(props: {
    collapsed: boolean
    width: number
    railMode: AssistantRailMode
    railGroupMode: AssistantRailGroupMode
    railSortMode: AssistantRailSortMode
    railFilterMode: AssistantRailFilterMode
    onRailModeChange: (next: AssistantRailMode) => void
    onRailGroupModeChange: (next: AssistantRailGroupMode) => void
    onRailSortModeChange: (next: AssistantRailSortMode) => void
    onRailFilterModeChange: (next: AssistantRailFilterMode) => void
    onWidthChange: (next: number) => void
    onShowToast: (input: AssistantToastInput) => void
}) {
    const {
        collapsed,
        width,
        railMode,
        railGroupMode,
        railSortMode,
        railFilterMode,
        onRailModeChange,
        onRailGroupModeChange,
        onRailSortModeChange,
        onRailFilterModeChange,
        onWidthChange,
        onShowToast
    } = props
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
            railGroupMode={railGroupMode}
            railSortMode={railSortMode}
            railFilterMode={railFilterMode}
            onRailGroupModeChange={onRailGroupModeChange}
            onRailSortModeChange={onRailSortModeChange}
            onRailFilterModeChange={onRailFilterModeChange}
            sessions={visibleSessions}
            playground={railController.playground}
            backgroundActivitySessions={backgroundActivitySessions}
            activeSessionId={railController.activeSessionId}
            activeThreadId={railController.activeThreadId}
            commandPending={railController.commandPending}
            onWidthChange={onWidthChange}
            onCreateSession={(projectPath) => railController.createSession({ projectPath })}
            onCreatePlaygroundSession={(labId) => railController.createSession({ mode: 'playground', playgroundLabId: labId || null })}
            onSelectSession={railController.selectSession}
            onSelectThread={railController.selectThread}
            onRenameSession={railController.renameSession}
            onArchiveSession={railController.archiveSession}
            onDeleteSession={railController.deleteSessionResult}
            onChooseProjectPath={railController.createProjectSession}
            onSetPlaygroundRoot={railController.setPlaygroundRoot}
            onCreatePlaygroundLab={railController.createPlaygroundLabResult}
            onDeletePlaygroundLab={railController.deletePlaygroundLabResult}
            onShowToast={onShowToast}
        />
    )
})
