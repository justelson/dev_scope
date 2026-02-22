import {
    composeReasoningText,
    createId,
    now,
    readString
} from './assistant-bridge-helpers'
import type { AssistantHistoryMessage, AssistantModelInfo, AssistantSendOptions } from './types'

type BridgeCoreContext = any
type TurnTerminalReason = 'completed' | 'failed' | 'interrupted' | 'cancelled'

export function bridgeFinalizeTurn(
    bridge: BridgeCoreContext,
    turnId: string,
    outcome: {
        success: boolean
        reason: TurnTerminalReason
        explicitFinalText?: string
        errorMessage?: string
    }
): void {
    if (!bridge.markTurnFinalized(turnId)) {
        bridge.cancelledTurns.delete(turnId)
        return
    }

    const buffer = bridge.turnBuffers.get(turnId) || { draft: '', pendingFinal: null, source: null }
    const turnContext = bridge.turnContexts.get(turnId)
    const attemptGroupId = turnContext?.attemptGroupId || bridge.turnAttemptGroupByTurnId.get(turnId) || turnId
    const wasCancelledByRequest = bridge.cancelledTurns.delete(turnId)
    const terminalReason: TurnTerminalReason = (outcome.reason === 'cancelled' || wasCancelledByRequest)
        ? 'cancelled'
        : outcome.reason
    const shouldLockFinal = outcome.success && terminalReason === 'completed'
    const explicitFinalText = (outcome.explicitFinalText || '').trim()
    const finalText = shouldLockFinal
        ? explicitFinalText || buffer.pendingFinal?.trim() || buffer.draft.trim()
        : ''

    if (shouldLockFinal && finalText) {
        const persistedReasoningText = composeReasoningText(bridge.reasoningTextsByTurn.get(turnId) || [])
        const existingAttemptIndexes = bridge.history
            .filter((message: AssistantHistoryMessage) => message.role === 'assistant' && message.attemptGroupId === attemptGroupId)
            .map((message: AssistantHistoryMessage) => message.attemptIndex || 0)
        const nextAttemptIndex = (existingAttemptIndexes.length > 0 ? Math.max(...existingAttemptIndexes) : 0) + 1

        for (const message of bridge.history) {
            if (message.role === 'assistant' && message.attemptGroupId === attemptGroupId) {
                message.isActiveAttempt = false
            }
        }

        const assistantMessage: AssistantHistoryMessage = {
            id: createId('msg'),
            role: 'assistant',
            text: finalText,
            reasoningText: persistedReasoningText || undefined,
            createdAt: now(),
            turnId,
            attemptGroupId,
            attemptIndex: nextAttemptIndex,
            isActiveAttempt: true
        }
        bridge.history.push(assistantMessage)
        bridge.turnAttemptGroupByTurnId.set(turnId, attemptGroupId)
        bridge.emitEvent('assistant-final', {
            turnId,
            text: finalText,
            attemptGroupId,
            attemptIndex: nextAttemptIndex,
            model: bridge.status.model,
            provider: bridge.status.provider
        })
        bridge.emitEvent('history', { history: [...bridge.history] })
    }

    if (terminalReason === 'cancelled') {
        bridge.emitEvent('turn-cancelled', { turnId })
    }

    const errorMessage = (outcome.errorMessage || '').trim()
    if ((terminalReason === 'failed' || terminalReason === 'interrupted') && errorMessage) {
        bridge.status.lastError = errorMessage
        bridge.emitEvent('error', { message: errorMessage, turnId, outcome: terminalReason })
    } else {
        bridge.status.lastError = null
    }

    if (bridge.activeTurnId === turnId) {
        bridge.activeTurnId = null
        bridge.status.activeTurnId = null
    }

    bridge.turnBuffers.delete(turnId)
    bridge.turnContexts.delete(turnId)
    bridge.reasoningTextsByTurn.delete(turnId)
    bridge.lastReasoningDigestByTurn.delete(turnId)
    bridge.lastActivityDigestByTurn.delete(turnId)
    bridge.status.state = bridge.status.connected ? 'ready' : 'offline'
    const completionPayload: Record<string, unknown> = {
        turnId,
        success: terminalReason === 'completed',
        outcome: terminalReason,
        attemptGroupId
    }
    if (errorMessage) {
        completionPayload.error = errorMessage
    }
    bridge.emitEvent('turn-complete', completionPayload)
    bridge.emitEvent('status', { status: bridge.getStatus() })
    bridge.syncActiveSessionFromRuntime()
    bridge.persistStateSoon()
}

export function bridgeMarkTurnFinalized(bridge: BridgeCoreContext, turnId: string): boolean {
    if (bridge.finalizedTurns.has(turnId)) {
        return false
    }

    bridge.finalizedTurns.add(turnId)
    if (bridge.finalizedTurns.size > 500) {
        const oldestTurnId = bridge.finalizedTurns.values().next().value as string | undefined
        if (oldestTurnId) {
            bridge.finalizedTurns.delete(oldestTurnId)
        }
    }
    return true
}

export async function bridgeResolveSelectedModel(
    bridge: BridgeCoreContext,
    projectPath?: string
): Promise<string | null> {
    const projectKey = String(projectPath || '').trim()
    const projectDefault = projectKey ? bridge.projectModelDefaults.get(projectKey) : null
    const selected = (projectDefault || bridge.status.model).trim()
    const listed = await bridge.listModels()
    const knownModels = listed.success ? listed.models : []

    if (selected && selected !== 'default') {
        if (knownModels.length === 0) {
            return selected
        }
        const exactMatch = knownModels.find((model: AssistantModelInfo) => model.id === selected)
        if (exactMatch) {
            return exactMatch.id
        }
        return knownModels.find((model: AssistantModelInfo) => model.isDefault)?.id || knownModels[0].id
    }

    if (knownModels.length === 0) {
        return null
    }
    return knownModels.find((model: AssistantModelInfo) => model.isDefault)?.id || knownModels[0].id
}

export async function bridgeEnsureThread(
    bridge: BridgeCoreContext,
    model: string | null,
    projectPath?: string
): Promise<string> {
    if (bridge.threadId) return bridge.threadId

    const threadStartParams: Record<string, unknown> = {
        approvalPolicy: bridge.status.approvalMode === 'yolo' ? 'on-request' : 'never'
    }
    if (model) {
        threadStartParams.model = model
    }
    const normalizedProjectPath = String(projectPath || '').trim()
    if (normalizedProjectPath) {
        threadStartParams.projectPath = normalizedProjectPath
        threadStartParams.cwd = normalizedProjectPath
        threadStartParams.workingDirectory = normalizedProjectPath
    }

    let started: unknown
    try {
        started = await bridge.requestWithRetry('thread/start', threadStartParams, { retries: 1 })
    } catch (error) {
        if (!normalizedProjectPath || !bridge.isInvalidParamsError(error)) {
            throw error
        }
        const fallbackParams: Record<string, unknown> = {
            approvalPolicy: threadStartParams.approvalPolicy
        }
        if (model) {
            fallbackParams.model = model
        }
        started = await bridge.requestWithRetry('thread/start', fallbackParams, { retries: 1 })
    }

    const threadId = readString((started as any)?.thread?.id || '')
    if (!threadId) {
        throw new Error('thread/start did not return thread.id')
    }

    bridge.threadId = threadId
    return threadId
}

export function bridgeBuildPromptWithContext(
    bridge: BridgeCoreContext,
    prompt: string,
    options: AssistantSendOptions
): string {
    const cleanPrompt = String(prompt || '').trim()
    const template = readString(options.promptTemplate).trim()
    const projectPath = readString(options.projectPath).trim()
    const contextDiff = readString(options.contextDiff).trim()
    const contextFiles = Array.isArray(options.contextFiles)
        ? options.contextFiles
            .map((entry) => ({
                path: readString((entry as Record<string, unknown>)?.path).trim(),
                content: readString((entry as Record<string, unknown>)?.content).trim(),
                name: readString((entry as Record<string, unknown>)?.name).trim(),
                mimeType: readString((entry as Record<string, unknown>)?.mimeType).trim(),
                kind: readString((entry as Record<string, unknown>)?.kind).trim(),
                sizeBytes: Number((entry as Record<string, unknown>)?.sizeBytes) || 0,
                previewText: readString((entry as Record<string, unknown>)?.previewText).trim()
            }))
            .filter((entry) => entry.path || entry.content || entry.name || entry.previewText)
        : []

    if (!template && !contextDiff && contextFiles.length === 0) {
        return cleanPrompt
    }

    const sections: string[] = []
    if (template) {
        sections.push('## Prompt Template')
        sections.push(template)
    }
    if (projectPath) {
        sections.push('## Workspace Context')
        sections.push(`Use this exact working directory for this chat turn: ${projectPath}`)
    }
    if (contextFiles.length > 0) {
        sections.push('## Selected Files')
        for (const file of contextFiles.slice(0, 20)) {
            const displayName = file.name || file.path || '(inline snippet)'
            sections.push(`### ${displayName}`)

            const metaParts: string[] = []
            if (file.path) metaParts.push(`Path: ${file.path}`)
            if (file.mimeType) metaParts.push(`MIME: ${file.mimeType}`)
            if (file.sizeBytes > 0) metaParts.push(`Size: ${file.sizeBytes} bytes`)
            if (metaParts.length > 0) {
                sections.push(metaParts.join(' | '))
            }

            const isImage = file.kind === 'image'
                || /^image\//i.test(file.mimeType)
                || /^data:image\//i.test(file.content)

            if (isImage) {
                sections.push('Attachment type: image')
                if (file.previewText) {
                    sections.push(file.previewText)
                }
                sections.push('[Image data omitted from prompt for token efficiency.]')
                continue
            }

            if (file.content) {
                const boundedContent = file.content.length > 6000
                    ? `${file.content.slice(0, 6000)}\n\n[truncated]`
                    : file.content
                sections.push(boundedContent)
                continue
            }

            if (file.previewText) {
                sections.push(file.previewText)
            } else {
                sections.push('(no content provided)')
            }
        }
    }
    if (contextDiff) {
        sections.push('## Diff Context')
        sections.push(contextDiff)
    }
    sections.push('## User Prompt')
    sections.push(cleanPrompt)

    return sections.join('\n\n').trim()
}

export function bridgeFindAssistantMessageByTurnId(
    bridge: BridgeCoreContext,
    turnId: string
): AssistantHistoryMessage | null {
    for (let index = bridge.history.length - 1; index >= 0; index -= 1) {
        const entry = bridge.history[index]
        if (entry.role === 'assistant' && entry.turnId === turnId) {
            return entry
        }
    }
    return null
}

export function bridgeFindSourcePromptForAssistantTurn(
    bridge: BridgeCoreContext,
    turnId: string
): string {
    let assistantIndex = -1
    for (let index = bridge.history.length - 1; index >= 0; index -= 1) {
        const entry = bridge.history[index]
        if (entry.role === 'assistant' && entry.turnId === turnId) {
            assistantIndex = index
            break
        }
    }

    if (assistantIndex < 0) return ''

    for (let index = assistantIndex - 1; index >= 0; index -= 1) {
        const entry = bridge.history[index]
        if (entry.role === 'user' && entry.text.trim()) {
            return entry.text
        }
    }

    return ''
}
