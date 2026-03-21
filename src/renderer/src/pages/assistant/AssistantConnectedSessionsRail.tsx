import { memo } from 'react'
import { useAssistantSessionsRailStore } from '@/lib/assistant/store'
import { AssistantSessionsRail } from './AssistantSessionsRail'

export const ConnectedAssistantSessionsRail = memo(function ConnectedAssistantSessionsRail(props: {
    collapsed: boolean
    width: number
    onWidthChange: (next: number) => void
}) {
    const { collapsed, width, onWidthChange } = props
    const railController = useAssistantSessionsRailStore()

    return (
        <AssistantSessionsRail
            collapsed={collapsed}
            width={width}
            compact={false}
            sessions={railController.sessions}
            activeSessionId={railController.activeSessionId}
            commandPending={railController.commandPending}
            onWidthChange={onWidthChange}
            onCreateSession={(projectPath) => railController.createSession(undefined, projectPath)}
            onSelectSession={railController.selectSession}
            onRenameSession={railController.renameSession}
            onArchiveSession={railController.archiveSession}
            onDeleteSession={railController.deleteSession}
            onChooseProjectPath={railController.createProjectSession}
        />
    )
})
