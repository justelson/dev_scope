import type { AssistantMessage } from '@shared/assistant/contracts'
import type { PreviewOpenOptions } from '@/components/ui/file-preview/types'
import type { AssistantDiffTarget } from './assistant-diff-types'

export type AssistantConversationPaneProps = {
    rightPanelOpen: boolean
    rightPanelMode: 'none' | 'details' | 'plan' | 'diff'
    deletingMessageId: string | null
    leftSidebarCollapsed: boolean
    fallbackSessionMode: 'work' | 'playground'
    playgroundRootMissing: boolean
    onToggleLeftSidebar: () => void
    onChoosePlaygroundRoot: () => Promise<void> | void
    onRequestDeleteUserMessage: (message: AssistantMessage) => void
    onToggleRightSidebar: () => void
    onTogglePlanPanel: () => void
    onStartDetachedPlaygroundChat: () => Promise<void> | void
    onOpenAttachmentPreview?: (
        file: { name: string; path: string },
        ext: string,
        options?: PreviewOpenOptions
    ) => Promise<void> | void
    onOpenAssistantLink?: (href: string) => Promise<void> | void
    onOpenEditedFile?: (filePath: string) => Promise<void> | void
    onViewDiff?: (target: AssistantDiffTarget) => void
}
