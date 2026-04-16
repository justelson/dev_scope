import type { AssistantComposerDisabledReason } from './assistant-composer-types'

export type AssistantComposerUxMode = 'standard' | 'guided'

export type AssistantComposerUxTone = 'neutral' | 'info' | 'warning'

export type AssistantComposerCapabilities = {
    inputDisabled: boolean
    attachDisabled: boolean
    controlsLocked: boolean
    voiceDisabled: boolean
    canSend: boolean
    canStop: boolean
    sendDisabled: boolean
    showBusySendActions: boolean
    placeholder: string
    statusLabel: string
    detailLabel: string | null
    tone: AssistantComposerUxTone
}

type DeriveAssistantComposerCapabilitiesArgs = {
    mode: AssistantComposerUxMode
    disabled: boolean
    disabledReason?: AssistantComposerDisabledReason | null
    isConnected: boolean
    isSending: boolean
    isThinking: boolean
    allowEmptySubmit: boolean
    hasContent: boolean
    voiceBusy?: boolean
    hasStopHandler?: boolean
    controlsLocked?: boolean
    attachmentsLocked?: boolean
    isResponding?: boolean
    isReviewStep?: boolean
}

export function deriveAssistantComposerDisabledReason(
    args: {
        sessionId?: string | null
        assistantAvailable?: boolean
        sessionMode?: 'work' | 'playground'
        projectPath?: string | null
    }
): AssistantComposerDisabledReason | null {
    const { sessionId, assistantAvailable, sessionMode, projectPath } = args
    if (!sessionId) return 'no-session'
    if (!assistantAvailable) return 'assistant-unavailable'
    if (sessionMode === 'work' && !String(projectPath || '').trim()) return 'project-required'
    return null
}

export function deriveAssistantComposerCapabilities(
    args: DeriveAssistantComposerCapabilitiesArgs
): AssistantComposerCapabilities {
    const {
        mode,
        disabled,
        disabledReason = null,
        isConnected,
        isSending,
        isThinking,
        allowEmptySubmit,
        hasContent,
        voiceBusy = false,
        hasStopHandler = false,
        controlsLocked = false,
        attachmentsLocked = false,
        isResponding = false,
        isReviewStep = false
    } = args

    const canSend = allowEmptySubmit || hasContent
    const canStop = mode === 'standard' && isThinking && hasStopHandler && isConnected && !disabled

    if (disabledReason === 'no-session') {
        return {
            inputDisabled: true,
            attachDisabled: true,
            controlsLocked: true,
            voiceDisabled: true,
            canSend: false,
            canStop: false,
            sendDisabled: true,
            showBusySendActions: false,
            placeholder: 'Select or start a chat to write here',
            statusLabel: 'No active chat',
            detailLabel: 'Create or select a thread before composing a message.',
            tone: 'warning'
        }
    }

    if (disabledReason === 'project-required') {
        return {
            inputDisabled: true,
            attachDisabled: true,
            controlsLocked: true,
            voiceDisabled: true,
            canSend: false,
            canStop: false,
            sendDisabled: true,
            showBusySendActions: false,
            placeholder: 'Choose a project to start this work chat',
            statusLabel: 'Project required',
            detailLabel: 'Work chats need a project folder before you can send messages.',
            tone: 'warning'
        }
    }

    if (disabledReason === 'assistant-unavailable' || disabled) {
        return {
            inputDisabled: true,
            attachDisabled: true,
            controlsLocked: true,
            voiceDisabled: true,
            canSend: false,
            canStop: false,
            sendDisabled: true,
            showBusySendActions: false,
            placeholder: 'Assistant is unavailable right now',
            statusLabel: 'Assistant unavailable',
            detailLabel: 'Wait for the assistant to become available before sending messages.',
            tone: 'warning'
        }
    }

    if (mode === 'guided') {
        if (!isConnected && !isResponding) {
            return {
                inputDisabled: isReviewStep,
                attachDisabled: true,
                controlsLocked: true,
                voiceDisabled: true,
                canSend,
                canStop: false,
                sendDisabled: true,
                showBusySendActions: false,
                placeholder: isReviewStep
                    ? 'Reconnect to finish after reviewing your answers'
                    : 'Write your answer here while the assistant reconnects...',
                statusLabel: 'Disconnected',
                detailLabel: isReviewStep
                    ? 'Review stays available. Reconnect before finishing.'
                    : 'Your draft stays here. Reconnect before sending the answer back.',
                tone: 'warning'
            }
        }

        if (isResponding) {
            return {
                inputDisabled: true,
                attachDisabled: true,
                controlsLocked: true,
                voiceDisabled: true,
                canSend: false,
                canStop: false,
                sendDisabled: true,
                showBusySendActions: false,
                placeholder: 'Submitting your answers...',
                statusLabel: 'Submitting answers',
                detailLabel: 'Your guided response is being sent back to the assistant.',
                tone: 'info'
            }
        }

        if (isReviewStep) {
            return {
                inputDisabled: true,
                attachDisabled: true,
                controlsLocked: true,
                voiceDisabled: true,
                canSend,
                canStop: false,
                sendDisabled: !canSend,
                showBusySendActions: false,
                placeholder: 'Review your answers above before finishing',
                statusLabel: 'Review answers',
                detailLabel: 'Use Back or Change to revise anything before finishing.',
                tone: 'info'
            }
        }

        return {
            inputDisabled: false,
            attachDisabled: true,
            controlsLocked: true,
            voiceDisabled: true,
            canSend,
            canStop: false,
            sendDisabled: !canSend,
            showBusySendActions: false,
            placeholder: 'Choose an option above or write your own answer here...',
            statusLabel: 'Guided input',
            detailLabel: 'Pick one of the suggested answers or write a custom response below.',
            tone: 'info'
        }
    }

    if (!isConnected) {
        return {
            inputDisabled: false,
            attachDisabled: attachmentsLocked,
            controlsLocked,
            voiceDisabled: true,
            canSend,
            canStop: false,
            sendDisabled: true,
            showBusySendActions: false,
            placeholder: 'Draft here while the assistant reconnects...',
            statusLabel: 'Disconnected',
            detailLabel: 'Drafting stays available. Reconnect before sending.',
            tone: 'warning'
        }
    }

    if (isThinking) {
        return {
            inputDisabled: false,
            attachDisabled: attachmentsLocked,
            controlsLocked,
            voiceDisabled: true,
            canSend,
            canStop,
            sendDisabled: !(canStop || canSend),
            showBusySendActions: canSend && !voiceBusy,
            placeholder: 'Ask anything, @tag files/folders',
            statusLabel: 'Assistant is working',
            detailLabel: canSend
                ? 'Queue or force the next message while the current turn is still running.'
                : null,
            tone: 'info'
        }
    }

    if (isSending) {
        return {
            inputDisabled: false,
            attachDisabled: attachmentsLocked,
            controlsLocked,
            voiceDisabled: false,
            canSend,
            canStop: false,
            sendDisabled: true,
            showBusySendActions: false,
            placeholder: 'Ask anything, @tag files/folders',
            statusLabel: 'Sending message',
            detailLabel: 'You can keep editing the draft while the current send completes.',
            tone: 'info'
        }
    }

    return {
        inputDisabled: false,
        attachDisabled: attachmentsLocked,
        controlsLocked,
        voiceDisabled: false,
        canSend,
        canStop: false,
        sendDisabled: !canSend,
        showBusySendActions: false,
        placeholder: 'Ask anything, @tag files/folders',
        statusLabel: 'Ready',
        detailLabel: hasContent ? 'Ready to send when you are.' : null,
        tone: 'neutral'
    }
}
