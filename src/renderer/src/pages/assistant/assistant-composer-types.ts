import type { AssistantInteractionMode, AssistantRuntimeMode } from '@shared/assistant/contracts'

export type ComposerContextFile = {
    id: string
    path: string
    name?: string
    content?: string
    mimeType?: string
    kind?: 'image' | 'doc' | 'code' | 'file'
    sizeBytes?: number
    previewText?: string
    previewDataUrl?: string
    source?: 'manual' | 'paste'
    animateIn?: boolean
}

export type AssistantComposerSendOptions = {
    model?: string
    runtimeMode: AssistantRuntimeMode
    interactionMode: AssistantInteractionMode
    effort: 'low' | 'medium' | 'high' | 'xhigh'
    serviceTier?: 'fast'
}

export type AssistantComposerProps = {
    onSend: (prompt: string, contextFiles: ComposerContextFile[], options: AssistantComposerSendOptions) => Promise<boolean>
    disabled: boolean
    isSending: boolean
    isThinking: boolean
    isConnected: boolean
    activeModel?: string
    modelOptions?: Array<{ id: string; label: string; description?: string }>
    modelsLoading?: boolean
    modelsError?: string | null
    onRefreshModels?: () => void
    activeProfile?: string
    runtimeMode?: AssistantRuntimeMode
    interactionMode?: AssistantInteractionMode
    projectPath?: string | null
    compact?: boolean
}
