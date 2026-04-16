import type { AssistantPlaygroundState, AssistantSession } from '@shared/assistant/contracts'
import type { AssistantToastInput } from './AssistantPageHelpers'
import type { AssistantMutationResult, SessionProjectGroup } from './assistant-sessions-rail-utils'
import type { AssistantRailMode } from './useAssistantPageSidebarState'

export type ExpandedSessionsRailContentProps = {
    compact: boolean
    railMode: AssistantRailMode
    playground: AssistantPlaygroundState
    backgroundActivitySessions: AssistantSession[]
    commandPending: boolean
    groupedSessions: SessionProjectGroup[]
    groupedArchivedSessions: SessionProjectGroup[]
    activeSessionId: string | null
    activeThreadId: string | null
    expandedGroupKeys: Set<string>
    showArchivedSessions: boolean
    onRailModeChange: (mode: AssistantRailMode) => void
    onToggleGroup: (key: string) => void
    onChooseProjectPath: () => void
    onCreateSession: (projectPath?: string) => void
    onCreatePlaygroundSession: (labId?: string | null) => void
    onSelectSession: (sessionId: string) => void
    onSelectThread: (input: { sessionId: string; threadId: string }) => void
    onOpenRename: (session: AssistantSession) => void
    onArchiveSession: (sessionId: string, archived?: boolean) => void
    onDeleteRequest: (session: AssistantSession) => void
    onDeleteSession: (sessionId: string) => Promise<AssistantMutationResult> | AssistantMutationResult
    onSetShowArchivedSessions: (value: boolean) => void
    onSetPlaygroundRoot: (rootPath: string | null) => Promise<void> | void
    onCreatePlaygroundLab: (input: {
        title?: string
        source: 'empty' | 'git-clone' | 'existing-folder'
        repoUrl?: string
        existingFolderPath?: string
        openSession?: boolean
    }) => Promise<void> | void
    onDeletePlaygroundLab: (labId: string) => Promise<AssistantMutationResult> | AssistantMutationResult
    onProjectDragStart: (projectKey: string) => void
    onProjectDragEnd: (activeProjectKey: string, overProjectKey: string | null) => void
    onProjectDragCancel: () => void
    onSessionDragStart: (sessionId: string, projectKey: string) => void
    onSessionDragEnd: (projectKey: string, activeSessionId: string, overSessionId: string | null) => void
    onSessionDragCancel: () => void
    onShowToast: (input: AssistantToastInput) => void
}
