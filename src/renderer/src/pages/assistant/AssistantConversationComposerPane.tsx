import { memo } from 'react'
import type { AssistantPendingUserInput } from '@shared/assistant/contracts'
import { AssistantComposer } from './AssistantComposer'
import { AssistantPendingUserInputPanel } from './AssistantPendingUserInputPanel'
import type { AssistantComposerSendOptions, ComposerContextFile } from './assistant-composer-types'

export const AssistantConversationComposerPane = memo(function AssistantConversationComposerPane(props: {
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
    sendPrompt: (
        prompt: string,
        contextFiles: ComposerContextFile[],
        options: AssistantComposerSendOptions
    ) => Promise<boolean>
    refreshModels: () => void
    respondUserInput: (requestId: string, answers: Record<string, string | string[]>) => Promise<void>
}) {
    const isWaitingForUserInput = props.pendingUserInputs.length > 0

    return (
        <div className="relative px-4 py-3">
            {isWaitingForUserInput ? (
                <AssistantPendingUserInputPanel
                    pendingUserInputs={props.pendingUserInputs}
                    responding={props.commandPending}
                    onRespond={props.respondUserInput}
                />
            ) : null}
            <div className="mx-auto w-full max-w-3xl">
                <AssistantComposer
                    sessionId={props.selectedSessionId}
                    disabled={props.commandPending || isWaitingForUserInput || !props.selectedSessionId || !props.assistantAvailable}
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
                    onRefreshModels={props.refreshModels}
                    onSend={props.sendPrompt}
                />
            </div>
        </div>
    )
})
