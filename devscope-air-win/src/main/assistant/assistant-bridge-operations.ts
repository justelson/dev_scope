import { getWorkingChangesForAI, getWorkingDiff } from '../inspectors/git/read'
import { createId, deriveSessionTitleFromPrompt, isAutoSessionTitle, now, parseModelList, readRecord, readString } from './assistant-bridge-helpers'
import type { AssistantHistoryAttachment, AssistantHistoryMessage, AssistantModelInfo, AssistantSendOptions } from './types'
import { materializeContextFilesForSend } from './context-file-materializer'

type BridgeOperationsContext = any

function normalizeContextFilesForHistory(
    options: AssistantSendOptions
): Array<{
    path: string
    name: string
    mimeType: string
    kind?: AssistantHistoryAttachment['kind']
    sizeBytes: number
    previewText?: string
    previewDataUrl?: string
    textPreview?: string
}> {
    if (!Array.isArray(options.contextFiles)) return []

    return options.contextFiles
        .map((entry) => {
            const record = (entry || {}) as Record<string, unknown>
            const path = readString(record.path).trim()
            const name = readString(record.name).trim()
            const mimeType = readString(record.mimeType).trim()
            const rawKind = readString(record.kind).trim()
            const kind: AssistantHistoryAttachment['kind'] = rawKind === 'image'
                ? 'image'
                : rawKind === 'doc'
                    ? 'doc'
                    : rawKind === 'code'
                        ? 'code'
                        : rawKind === 'file'
                            ? 'file'
                            : undefined
            const sizeBytes = Number(record.sizeBytes) || 0
            const previewText = readString(record.previewText).trim()
            const rawContent = readString(record.content)
            const hasImageDataUrl = /^data:image\//i.test(rawContent)
            const previewDataUrl = hasImageDataUrl ? rawContent : ''
            const textPreview = !hasImageDataUrl && rawContent
                ? rawContent.slice(0, 2400)
                : ''
            return {
                path,
                name,
                mimeType,
                kind,
                sizeBytes,
                previewText: previewText || undefined,
                previewDataUrl: previewDataUrl || undefined,
                textPreview: textPreview || undefined
            }
        })
        .filter((entry) =>
            entry.path
            || entry.name
            || entry.mimeType
            || entry.kind
            || entry.sizeBytes > 0
            || entry.previewDataUrl
            || entry.textPreview
            || entry.previewText
        )
}

function buildUserMessageDisplayText(prompt: string, options: AssistantSendOptions): string {
    const trimmedPrompt = String(prompt || '').trim()
    const normalizedFiles = normalizeContextFilesForHistory(options)
    if (trimmedPrompt) return trimmedPrompt
    if (normalizedFiles.length > 0) return 'Attached files for this request.'
    return ''
}

const MODEL_LIST_MAX_PAGES = 8

function mergeUniqueModels(
    base: AssistantModelInfo[],
    incoming: AssistantModelInfo[]
): AssistantModelInfo[] {
    if (!Array.isArray(incoming) || incoming.length === 0) {
        return [...base]
    }

    const merged = [...base]
    const seen = new Set(
        merged
            .map((entry) => String(entry?.id || '').trim().toLowerCase())
            .filter(Boolean)
    )

    for (const entry of incoming) {
        const id = String(entry?.id || '').trim()
        if (!id) continue
        const normalizedId = id.toLowerCase()
        if (seen.has(normalizedId)) continue
        merged.push(entry)
        seen.add(normalizedId)
    }

    return merged
}

function readNextCursor(result: unknown): string {
    const root = readRecord(result)
    const nestedResult = readRecord(root?.result)
    return [
        readString(root?.nextCursor).trim(),
        readString(nestedResult?.nextCursor).trim()
    ].find(Boolean) || ''
}

export async function bridgeRunWorkflow(
    this: BridgeOperationsContext,
    input: {
        kind: 'explain-diff' | 'review-staged' | 'draft-commit'
        projectPath: string
        filePath?: string
        model?: string
    }
): Promise<{ success: boolean; turnId?: string; error?: string; workflow: string }> {
    const fallbackProjectPath = String(this.getActiveSession()?.projectPath || '').trim()
    const projectPath = String(input.projectPath || fallbackProjectPath).trim()
    if (!projectPath) {
        return { success: false, error: 'projectPath is required.', workflow: input.kind }
    }
    const activeSession = this.getActiveSession()
    if (activeSession && activeSession.projectPath !== projectPath) {
        activeSession.projectPath = projectPath
        activeSession.updatedAt = now()
        this.persistStateSoon()
    }

    this.emitEvent('workflow-status', {
        workflow: input.kind,
        status: 'started',
        projectPath,
        filePath: input.filePath || null
    })

    try {
        let contextDiff = ''
        if (input.kind === 'review-staged' || input.kind === 'draft-commit') {
            contextDiff = await getWorkingChangesForAI(projectPath)
        } else {
            contextDiff = await getWorkingDiff(projectPath, input.filePath)
        }

        if (!contextDiff || contextDiff.trim() === 'No changes') {
            const error = 'No relevant changes found for workflow.'
            this.emitEvent('workflow-status', {
                workflow: input.kind,
                status: 'failed',
                projectPath,
                error
            })
            return { success: false, error, workflow: input.kind }
        }

        const prompt = input.kind === 'explain-diff'
            ? 'Explain this diff with key changes, risks, and likely runtime impact.'
            : input.kind === 'review-staged'
                ? 'Review these staged/working changes and list findings ordered by severity with file references.'
                : 'Draft a high-quality commit message for these changes with a concise subject and body bullets.'

        const profile = input.kind === 'draft-commit' ? 'safe-dev' : 'review'
        const result = await this.sendPrompt(prompt, {
            model: input.model,
            projectPath,
            profile,
            contextDiff,
            promptTemplate: `Workflow: ${input.kind}`
        })

        this.emitEvent('workflow-status', {
            workflow: input.kind,
            status: result.success ? 'submitted' : 'failed',
            projectPath,
            turnId: result.turnId || null,
            error: result.error || null
        })

        return {
            success: Boolean(result.success),
            turnId: result.turnId,
            error: result.error,
            workflow: input.kind
        }
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Workflow execution failed.'
        this.emitEvent('workflow-status', {
            workflow: input.kind,
            status: 'failed',
            projectPath,
            error: message
        })
        return { success: false, error: message, workflow: input.kind }
    }
}

export async function bridgeListModels(
    this: BridgeOperationsContext,
    forceRefresh = false
): Promise<{ success: boolean; models: AssistantModelInfo[]; error?: string }> {
    if (!forceRefresh && this.cachedModels.length > 0) {
        return { success: true, models: [...this.cachedModels] }
    }

    try {
        await this.ensureInitialized()
        const attempts: Array<{ method: string; params: Record<string, unknown>; preferred?: boolean }> = [
            { method: 'model/list', params: { limit: 200, includeHidden: false }, preferred: true },
            { method: 'model/list', params: { limit: 200, includeHidden: true } },
            { method: 'model/list', params: {} },
            { method: 'models/list', params: { limit: 200, includeHidden: true } },
            { method: 'models/list', params: {} }
        ]

        let bestModels: AssistantModelInfo[] = []
        let lastError: unknown = null

        for (const attempt of attempts) {
            try {
                let merged: AssistantModelInfo[] = []
                let cursor = ''
                for (let page = 0; page < MODEL_LIST_MAX_PAGES; page += 1) {
                    const params = cursor
                        ? { ...attempt.params, cursor }
                        : { ...attempt.params }
                    const result = await this.requestWithRetry(attempt.method, params, { retries: 1 })
                    const parsed = parseModelList(result)
                    merged = mergeUniqueModels(merged, parsed)

                    const nextCursor = readNextCursor(result)
                    if (!nextCursor || nextCursor === cursor) {
                        break
                    }
                    cursor = nextCursor
                }

                const parsed = merged
                if (parsed.length > bestModels.length) {
                    bestModels = parsed
                }
                if (attempt.preferred && parsed.length > 0) {
                    break
                }
                if (bestModels.length >= 2) break
            } catch (error) {
                lastError = error
            }
        }

        if (bestModels.length > 0) {
            this.cachedModels = bestModels
            return { success: true, models: [...bestModels] }
        }
        if (lastError) {
            throw lastError
        }

        const fallbackModel = this.status.model && this.status.model !== 'default'
            ? this.status.model
            : 'default'
        const fallback: AssistantModelInfo[] = [{
            id: fallbackModel,
            label: fallbackModel,
            isDefault: true
        }]
        this.cachedModels = fallback
        return { success: true, models: [...fallback] }
    } catch (error) {
        if (this.cachedModels.length > 0) {
            return { success: true, models: [...this.cachedModels] }
        }
        const fallbackModel = this.status.model && this.status.model !== 'default'
            ? this.status.model
            : 'default'
        const fallback: AssistantModelInfo[] = [{
            id: fallbackModel,
            label: fallbackModel,
            isDefault: true
        }]
        this.cachedModels = fallback
        return {
            success: true,
            models: [...fallback],
            error: error instanceof Error ? error.message : 'Failed to list models.'
        }
    }
}

export async function bridgeReadAccount(
    this: BridgeOperationsContext,
    refreshToken = false
): Promise<{ success: boolean; result?: unknown; error?: string }> {
    try {
        await this.ensureInitialized()
        const result = await this.requestWithRetry('account/read', {
            refreshToken: Boolean(refreshToken)
        }, { retries: 1 })
        return { success: true, result }
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to read account.'
        }
    }
}

export async function bridgeReadAccountRateLimits(
    this: BridgeOperationsContext
): Promise<{ success: boolean; result?: unknown; error?: string }> {
    try {
        await this.ensureInitialized()
        const result = await this.requestWithRetry('account/rateLimits/read', {}, { retries: 1 })
        return { success: true, result }
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to read account rate limits.'
        }
    }
}

export async function bridgeCancelTurn(
    this: BridgeOperationsContext,
    turnId?: string
): Promise<{ success: boolean; error?: string }> {
    const targetTurnId = turnId || this.activeTurnId
    if (!targetTurnId || !this.threadId) {
        return { success: false, error: 'No active turn to cancel.' }
    }

    this.cancelledTurns.add(targetTurnId)

    try {
        await this.requestWithRetry('turn/interrupt', {
            threadId: this.threadId,
            turnId: targetTurnId
        }, { retries: 1 })
        this.finalizeTurn(targetTurnId, {
            success: false,
            reason: 'cancelled'
        })
        return { success: true }
    } catch (error) {
        this.cancelledTurns.delete(targetTurnId)
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to cancel turn.'
        }
    }
}

export async function bridgeSendPrompt(
    this: BridgeOperationsContext,
    prompt: string,
    options: AssistantSendOptions = {}
): Promise<{ success: boolean; turnId?: string; error?: string }> {
    const userPrompt = String(prompt || '').trim()
    if (!userPrompt && !options.regenerateFromTurnId) {
        return { success: false, error: 'Prompt is required.' }
    }

    const requestedProfile = readString(options.profile).trim()
    if (requestedProfile) {
        this.setProfile(requestedProfile)
    } else if (!readString(this.status.profile).trim() && readString(this.activeProfile).trim()) {
        this.setProfile(this.activeProfile)
    }
    if (options.approvalMode) {
        this.status.approvalMode = options.approvalMode
    }
    if (options.model && options.model.trim()) {
        this.status.model = options.model.trim()
    }

    if (this.activeTurnId) {
        return { success: false, error: 'A turn is already in progress.' }
    }

    try {
        await this.ensureInitialized()
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Assistant is not connected.'
        this.status.connected = false
        this.status.state = 'error'
        this.status.lastError = message
        this.emitEvent('error', { message })
        this.emitEvent('status', { status: this.getStatus() })
        return { success: false, error: message }
    }

    this.ensureActiveSession()
    const activeSession = this.getActiveSession()
    const selectedProjectPath = String(
        options.projectPath
        || activeSession?.projectPath
        || ''
    ).trim()
    if (activeSession && activeSession.projectPath !== selectedProjectPath) {
        activeSession.projectPath = selectedProjectPath
        activeSession.updatedAt = now()
        this.persistStateSoon()
    }

    let normalizedContextFiles = options.contextFiles
    try {
        normalizedContextFiles = await materializeContextFilesForSend(
            options.contextFiles,
            selectedProjectPath || undefined
        )
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to materialize attachments.'
        this.emitEvent('error', { message })
    }
    const runtimeOptions: AssistantSendOptions = {
        ...options,
        contextFiles: normalizedContextFiles
    }

    const regenerationTargetTurnId = readString(runtimeOptions.regenerateFromTurnId).trim()
    let effectivePrompt = userPrompt
    let attemptGroupIdSeed: string | null = null

    if (regenerationTargetTurnId) {
        const assistantTarget = this.findAssistantMessageByTurnId(regenerationTargetTurnId)
        if (!assistantTarget) {
            return { success: false, error: `Cannot regenerate unknown turn: ${regenerationTargetTurnId}` }
        }
        const sourcePrompt = this.findSourcePromptForAssistantTurn(regenerationTargetTurnId)
        if (!sourcePrompt) {
            return { success: false, error: `Cannot derive prompt for turn: ${regenerationTargetTurnId}` }
        }
        effectivePrompt = sourcePrompt
        attemptGroupIdSeed = assistantTarget.attemptGroupId || regenerationTargetTurnId
    } else {
        if (activeSession && !activeSession.contextTitleFinalized && isAutoSessionTitle(activeSession.title)) {
            const derivedTitle = deriveSessionTitleFromPrompt(userPrompt)
            if (derivedTitle) {
                activeSession.title = derivedTitle
                activeSession.contextTitleFinalized = true
                activeSession.updatedAt = now()
                this.persistStateSoon()
            }
        }

        const historyAttachments = normalizeContextFilesForHistory(options)
        const displayText = buildUserMessageDisplayText(effectivePrompt, runtimeOptions)
        const userMessage: AssistantHistoryMessage = {
            id: createId('msg'),
            role: 'user',
            text: displayText,
            attachments: historyAttachments.length > 0 ? historyAttachments : undefined,
            sourcePrompt: effectivePrompt,
            createdAt: now()
        }
        this.history.push(userMessage)
        this.emitEvent('history', { history: [...this.history] })
    }

    effectivePrompt = this.buildPromptWithContext(effectivePrompt, runtimeOptions)

    try {
        let resolvedModel = await this.resolveSelectedModel(selectedProjectPath || undefined)
        let threadId: string
        try {
            threadId = await this.ensureThread(resolvedModel, selectedProjectPath || undefined)
        } catch (error) {
            if (!resolvedModel || !this.isMissingModelError(error)) {
                throw error
            }
            const fallbackModel = await this.resolveSelectedModel()
            if (!fallbackModel || fallbackModel === resolvedModel) {
                throw error
            }
            resolvedModel = fallbackModel
            this.status.model = fallbackModel
            if (selectedProjectPath) {
                this.projectModelDefaults.set(selectedProjectPath, fallbackModel)
            }
            threadId = await this.ensureThread(resolvedModel, selectedProjectPath || undefined)
        }
        const turnStartParams: Record<string, unknown> = {
            threadId,
            input: [{ type: 'text', text: effectivePrompt }],
            approvalPolicy: 'on-request'
        }
        if (selectedProjectPath) {
            turnStartParams.projectPath = selectedProjectPath
            turnStartParams.cwd = selectedProjectPath
            turnStartParams.workingDirectory = selectedProjectPath
        }
        if (resolvedModel) {
            turnStartParams.model = resolvedModel
            this.status.model = resolvedModel
            if (selectedProjectPath) {
                this.projectModelDefaults.set(selectedProjectPath, resolvedModel)
            }
        }

        let turnStartResult: unknown
        try {
            turnStartResult = await this.requestWithRetry('turn/start', turnStartParams, { retries: 1 })
        } catch (error) {
            if (selectedProjectPath && this.isInvalidParamsError(error)) {
                const fallbackParams = { ...turnStartParams }
                delete fallbackParams.projectPath
                delete fallbackParams.cwd
                delete fallbackParams.workingDirectory
                turnStartResult = await this.requestWithRetry('turn/start', fallbackParams, { retries: 1 })
            } else {
                if (!resolvedModel || !this.isMissingModelError(error)) {
                    throw error
                }
                const fallbackModel = await this.resolveSelectedModel()
                if (!fallbackModel || fallbackModel === resolvedModel) {
                    throw error
                }
                turnStartParams.model = fallbackModel
                this.status.model = fallbackModel
                if (selectedProjectPath) {
                    this.projectModelDefaults.set(selectedProjectPath, fallbackModel)
                }
                turnStartResult = await this.requestWithRetry('turn/start', turnStartParams, { retries: 1 })
            }
        }

        const turnId = readString((turnStartResult as any)?.turn?.id || '')
        if (!turnId) {
            throw new Error('turn/start did not return turn.id')
        }

        this.activeTurnId = turnId
        this.status.activeTurnId = turnId
        this.status.connected = true
        this.status.state = 'ready'
        this.status.lastError = null
        this.turnBuffers.set(turnId, {
            draft: '',
            pendingFinal: null,
            pendingFinalPhase: null,
            draftKind: null,
            source: null
        })
        this.reasoningTextsByTurn.set(turnId, [])
        const attemptGroupId = attemptGroupIdSeed || turnId
        this.turnContexts.set(turnId, { attemptGroupId })
        this.turnAttemptGroupByTurnId.set(turnId, attemptGroupId)
        this.finalizedTurns.delete(turnId)
        this.cancelledTurns.delete(turnId)
        this.emitEvent('turn-start', {
            turnId,
            attemptGroupId,
            model: this.status.model,
            profile: this.status.profile || this.activeProfile,
            approvalMode: this.status.approvalMode,
            projectPath: selectedProjectPath || undefined
        })
        this.emitEvent('status', { status: this.getStatus() })
        this.syncActiveSessionFromRuntime()
        this.persistStateSoon()
        return { success: true, turnId }
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to start turn.'
        this.status.state = 'error'
        this.status.lastError = message
        this.emitEvent('error', { message })
        this.emitEvent('status', { status: this.getStatus() })
        return { success: false, error: message }
    }
}
