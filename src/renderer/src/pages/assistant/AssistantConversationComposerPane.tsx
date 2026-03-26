import { memo } from 'react'
import type { AssistantPendingUserInput, AssistantPlaygroundPendingLabRequest } from '@shared/assistant/contracts'
import type { PreviewOpenOptions } from '@/components/ui/file-preview/types'
import { AssistantComposer } from './AssistantComposer'
import { AssistantPendingPlaygroundLabPanel } from './AssistantPendingPlaygroundLabPanel'
import { AssistantPendingUserInputPanel } from './AssistantPendingUserInputPanel'
import type { AssistantComposerSendOptions, AssistantElementBounds, ComposerContextFile } from './assistant-composer-types'

export const AssistantConversationComposerPane = memo(function AssistantConversationComposerPane(props: {
    pendingPlaygroundLabRequest: AssistantPlaygroundPendingLabRequest | null
    pendingUserInputs: AssistantPendingUserInput[]
    commandPending: boolean
    thinking: boolean
    selectedSessionId: string | null
    assistantAvailable: boolean
    assistantConnected: boolean
    selectedProjectPath: string | null
    availableModels: Array<{ id: string; label: string; description?: string }>
    activeModel: string | undefined
    modelsLoading: boolean
    runtimeMode: 'approval-required' | 'full-access'
    interactionMode: 'default' | 'plan'
    activeProfile: 'safe-dev' | 'yolo-fast'
    activeStatusLabel: string
    onStop?: () => Promise<void> | void
    onOpenAttachmentPreview?: (
        file: { name: string; path: string },
        ext: string,
        options?: PreviewOpenOptions
    ) => Promise<void> | void
    onAttachmentShelfBoundsChange?: (bounds: AssistantElementBounds | null) => void
    sendPrompt: (
        prompt: string,
        contextFiles: ComposerContextFile[],
        options: AssistantComposerSendOptions
    ) => Promise<boolean>
    refreshModels: () => void
    respondUserInput: (requestId: string, answers: Record<string, string | string[]>) => Promise<void>
    approvePendingPlaygroundLabRequest: (input: { title?: string; source: 'empty' | 'git-clone'; repoUrl?: string }) => Promise<void>
    declinePendingPlaygroundLabRequest: () => Promise<void>
}) {
    const hasPendingPlaygroundLabRequest = Boolean(props.pendingPlaygroundLabRequest)
    const isWaitingForUserInput = props.pendingUserInputs.length > 0

    return (
        <div className="relative px-4 py-3">
            {hasPendingPlaygroundLabRequest && props.pendingPlaygroundLabRequest ? (
                <AssistantPendingPlaygroundLabPanel
                    request={props.pendingPlaygroundLabRequest}
                    responding={props.commandPending}
                    onApprove={props.approvePendingPlaygroundLabRequest}
                    onDecline={props.declinePendingPlaygroundLabRequest}
                />
            ) : null}
            {!hasPendingPlaygroundLabRequest && isWaitingForUserInput ? (
                <AssistantPendingUserInputPanel
                    pendingUserInputs={props.pendingUserInputs}
                    responding={props.commandPending}
                    onRespond={props.respondUserInput}
                    sessionId={props.selectedSessionId}
                    assistantAvailable={props.assistantAvailable}
                    assistantConnected={props.assistantConnected}
                    selectedProjectPath={props.selectedProjectPath}
                    availableModels={props.availableModels}
                    activeModel={props.activeModel}
                    modelsLoading={props.modelsLoading}
                    runtimeMode={props.runtimeMode}
                    interactionMode={props.interactionMode}
                    activeProfile={props.activeProfile}
                    activeStatusLabel={props.activeStatusLabel}
                />
            ) : null}
            {!hasPendingPlaygroundLabRequest && !isWaitingForUserInput ? (
                <div className="mx-auto w-full max-w-3xl">
                    <AssistantComposer
                        sessionId={props.selectedSessionId}
                        disabled={!props.selectedSessionId || !props.assistantAvailable}
                        isSending={props.commandPending}
                        isThinking={props.thinking}
                        thinkingLabel={props.activeStatusLabel}
                        isConnected={props.assistantConnected}
                        activeModel={props.activeModel}
                        modelOptions={props.availableModels}
                        modelsLoading={props.modelsLoading}
                        modelsError={null}
                        activeProfile={props.activeProfile}
                        runtimeMode={props.runtimeMode}
                        interactionMode={props.interactionMode}
                        projectPath={props.selectedProjectPath}
                        onOpenAttachmentPreview={props.onOpenAttachmentPreview}
                        onAttachmentShelfBoundsChange={props.onAttachmentShelfBoundsChange}
                        onRefreshModels={props.refreshModels}
                        onStop={props.onStop}
                        onSend={props.sendPrompt}
                    />
                </div>
            ) : null}
        </div>
    )
})
