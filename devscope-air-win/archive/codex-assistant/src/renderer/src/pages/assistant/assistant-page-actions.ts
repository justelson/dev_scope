import type { AssistantPendingUserInput, AssistantSendMetadata, AssistantStatus, WorkflowKind } from './assistant-page-types'
import { WORKFLOW_LABELS } from './assistant-page-types'
import type { ComposerContextFile } from './assistant-composer-types'
import type { MutableRefObject } from 'react'

type ActionContext = {
    settings: any
    activeModel: string
    activeProfile: string
    activeSessionTitle: string
    activeSessionId: string | null
    effectiveProjectPath: string
    workflowProjectPath: string
    workflowFilePath: string
    workflowRunningKind: WorkflowKind | null
    isConnecting: boolean
    isBusy: boolean
    isSending: boolean
    status: AssistantStatus
    history: Array<{ role: string; text: string; createdAt: number }>
    sessions: Array<{ id: string; title: string }>
    showEventConsole: boolean
    setErrorMessage: (value: string | null) => void
    setIsConnecting: (value: boolean) => void
    setStatus: (status: AssistantStatus) => void
    setStreamingTurnId: (value: string | null) => void
    setStreamingText: (value: string) => void
    setIsSending: (value: boolean) => void
    setChatProjectPath: (value: string) => void
    setWorkflowProjectPath: (value: string) => void
    setShowYoloConfirmModal: (value: boolean) => void
    setShowEventConsole: (value: boolean) => void
    setWorkflowRunningKind: (value: WorkflowKind | null) => void
    setWorkflowState: (value: any) => void
    setHistory: (value: any) => void
    setSessions: (updater: any) => void
    setEventLog: (value: any) => void
    setIsChatHydrating: (value: boolean) => void
    setActiveSessionId: (value: string | null) => void
    setReasoningByTurn: (value: any) => void
    setActivitiesByTurn: (value: any) => void
    setApprovalsByTurn: (value: any) => void
    setPendingUserInputs: (value: AssistantPendingUserInput[] | ((prev: AssistantPendingUserInput[]) => AssistantPendingUserInput[])) => void
    setRespondingUserInputRequestIds: (value: number[] | ((prev: number[]) => number[])) => void
    scopeRef: MutableRefObject<{ turnIds: Set<string>; attemptGroupIds: Set<string> }>
    updateSettings: (next: Record<string, unknown>) => void
    scrollChatToBottom: (behavior?: ScrollBehavior) => void
    loadSnapshot: (options?: { hydrateChat?: boolean }) => Promise<void>
}

export function createAssistantPageActions(ctx: ActionContext) {
    const clampSidebarWidth = (value: number): number => {
        if (!Number.isFinite(value)) return 320
        return Math.max(180, Math.min(520, Math.round(value)))
    }

    const persistActiveSessionProjectPath = async (
        nextPath: string,
        options?: { syncSnapshot?: boolean }
    ): Promise<boolean> => {
        const sessionId = String(ctx.activeSessionId || '').trim()
        if (!sessionId) return true
        const normalizedPath = String(nextPath || '').trim()
        try {
            const result = await window.devscope.assistant.setSessionProjectPath(sessionId, normalizedPath)
            if (!result?.success) {
                ctx.setErrorMessage(result?.error || 'Failed to save chat path for this session.')
                return false
            }
            if (options?.syncSnapshot) {
                await ctx.loadSnapshot()
            }
            return true
        } catch (error) {
            ctx.setErrorMessage(error instanceof Error ? error.message : 'Failed to save chat path for this session.')
            return false
        }
    }

    const handleApplyChatProjectPath = async (nextPath: string): Promise<boolean> => {
        const normalizedPath = String(nextPath || '').trim()
        ctx.setChatProjectPath(normalizedPath)
        ctx.setWorkflowProjectPath(normalizedPath || ctx.settings.projectsFolder.trim())
        return await persistActiveSessionProjectPath(normalizedPath, { syncSnapshot: true })
    }

    const handleConnect = async (): Promise<boolean> => {
        if (ctx.isConnecting) return false
        ctx.setErrorMessage(null)
        ctx.setIsConnecting(true)
        try {
            const result = await window.devscope.assistant.connect({
                approvalMode: ctx.settings.assistantApprovalMode,
                provider: ctx.settings.assistantProvider,
                model: ctx.activeModel,
                profile: ctx.activeProfile
            })

            if (!result?.success) {
                ctx.setErrorMessage(result?.error || 'Failed to connect assistant.')
                return false
            }
            await ctx.loadSnapshot()
            return true
        } catch (error) {
            ctx.setErrorMessage(error instanceof Error ? error.message : 'Failed to connect assistant.')
            return false
        } finally {
            ctx.setIsConnecting(false)
        }
    }

    const handleDisconnect = async () => {
        ctx.setErrorMessage(null)
        const result = await window.devscope.assistant.disconnect()
        if (!result?.success) {
            ctx.setErrorMessage(result?.error || 'Failed to disconnect assistant.')
            return
        }
        await ctx.loadSnapshot()
    }

    const handleSend = async (
        prompt: string,
        contextFiles: ComposerContextFile[],
        sendMetadata?: AssistantSendMetadata
    ): Promise<boolean> => {
        const normalizedPrompt = String(prompt || '').trim()
        if ((!normalizedPrompt && contextFiles.length === 0) || ctx.isSending || ctx.isBusy) return false

        if (!ctx.status.connected) {
            if (ctx.isConnecting || ctx.status.state === 'connecting') {
                ctx.setErrorMessage('Assistant is still connecting to Codex.')
                return false
            }
            const connected = await handleConnect()
            if (!connected) {
                ctx.setErrorMessage('Failed to connect to Codex before sending.')
                return false
            }
        }

        ctx.scrollChatToBottom('smooth')
        ctx.setErrorMessage(null)
        ctx.setIsSending(true)
        ctx.setStreamingTurnId(null)
        ctx.setStreamingText('')
        try {
            let currentSessionId = ctx.activeSessionId
            if (!currentSessionId) {
                const created = await window.devscope.assistant.createSession()
                currentSessionId = created?.success ? String(created.session?.id || '').trim() : ''
                if (!currentSessionId) {
                    ctx.setErrorMessage('Failed to create session for this message.')
                    return false
                }
                await ctx.loadSnapshot({ hydrateChat: true })
            }

            if (!(await persistActiveSessionProjectPath(ctx.effectiveProjectPath))) {
                return false
            }

            const effectivePrompt = normalizedPrompt || 'Please use the attached context files.'

            const promptTemplateSections: string[] = []
            if (sendMetadata?.entryMode === 'plan') {
                promptTemplateSections.push(
                    'Collaboration mode: plan.',
                    'Bias toward clarifying the implementation approach and maintaining a concise live plan before heavy execution.'
                )
            }
            if (sendMetadata?.reasoningLevel) {
                promptTemplateSections.push(`Requested reasoning level: ${sendMetadata.reasoningLevel}.`)
            }
            if (sendMetadata?.fastModeEnabled) {
                promptTemplateSections.push('Fast mode requested: prioritize direct execution and concise progress updates.')
            }

            const result = await window.devscope.assistant.send(effectivePrompt, {
                model: ctx.activeModel,
                profile: ctx.activeProfile,
                approvalMode: ctx.settings.assistantApprovalMode,
                contextFiles: contextFiles.length > 0
                    ? contextFiles.map((file) => ({
                        path: file.path,
                        content: file.content,
                        name: file.name,
                        mimeType: file.mimeType,
                        kind: file.kind,
                        sizeBytes: file.sizeBytes,
                        previewText: file.previewText
                    }))
                    : undefined,
                projectPath: ctx.effectiveProjectPath || undefined,
                promptTemplate: promptTemplateSections.length > 0
                    ? promptTemplateSections.join('\n')
                    : undefined
            })

            if (!result?.success) {
                ctx.setErrorMessage(result?.error || 'Failed to send message.')
                return false
            }
            await ctx.loadSnapshot()
            return true
        } catch (error) {
            ctx.setErrorMessage(error instanceof Error ? error.message : 'Unknown error during send.')
            return false
        } finally {
            ctx.setIsSending(false)
        }
    }

    const handleRegenerate = async (turnId: string) => {
        if (ctx.isBusy || ctx.isSending) return
        if (!ctx.status.connected) return

        ctx.scrollChatToBottom('smooth')
        ctx.setErrorMessage(null)
        ctx.setIsSending(true)
        ctx.setStreamingTurnId(null)
        ctx.setStreamingText('')
        try {
            if (!(await persistActiveSessionProjectPath(ctx.effectiveProjectPath))) {
                return
            }
            const result = await window.devscope.assistant.regenerate(turnId, {
                model: ctx.activeModel,
                profile: ctx.activeProfile,
                approvalMode: ctx.settings.assistantApprovalMode,
                projectPath: ctx.effectiveProjectPath || undefined
            })

            if (!result?.success) {
                ctx.setErrorMessage(result?.error || 'Failed to regenerate message.')
            } else {
                await ctx.loadSnapshot()
            }
        } finally {
            ctx.setIsSending(false)
        }
    }

    const handleCancelTurn = async () => {
        if (!ctx.status.activeTurnId) return
        const result = await window.devscope.assistant.cancelTurn(ctx.status.activeTurnId)
        if (!result?.success) {
            ctx.setErrorMessage(result?.error || 'Failed to cancel turn.')
            return
        }
        ctx.setStreamingTurnId(null)
        ctx.setStreamingText('')
        await ctx.loadSnapshot()
    }

    const handleRespondApproval = async (
        requestId: number,
        decision: 'decline' | 'acceptForSession'
    ): Promise<boolean> => {
        try {
            const result = await window.devscope.assistant.respondApproval(requestId, decision)
            if (!result?.success) {
                ctx.setErrorMessage(result?.error || 'Failed to send approval decision.')
                return false
            }
            await ctx.loadSnapshot()
            return true
        } catch (error) {
            ctx.setErrorMessage(error instanceof Error ? error.message : 'Failed to send approval decision.')
            return false
        }
    }

    const handleRespondUserInput = async (
        requestId: number,
        answers: Record<string, string | string[]>
    ): Promise<boolean> => {
        ctx.setRespondingUserInputRequestIds((prev: number[]) => (
            prev.includes(requestId) ? prev : [...prev, requestId]
        ))
        try {
            const result = await window.devscope.assistant.respondUserInput(requestId, answers)
            if (!result?.success) {
                ctx.setErrorMessage(result?.error || 'Failed to submit user input.')
                return false
            }
            await ctx.loadSnapshot()
            return true
        } catch (error) {
            ctx.setErrorMessage(error instanceof Error ? error.message : 'Failed to submit user input.')
            return false
        } finally {
            ctx.setRespondingUserInputRequestIds((prev: number[]) => prev.filter((id) => id !== requestId))
        }
    }

    const handleEnableYoloMode = async () => {
        const result = await window.devscope.assistant.setApprovalMode('yolo')
        if (result?.success) {
            await ctx.loadSnapshot()
        }
        ctx.setShowYoloConfirmModal(false)
    }

    const handleEnableSafeMode = async () => {
        const result = await window.devscope.assistant.setApprovalMode('safe')
        if (result?.success) {
            await ctx.loadSnapshot()
        }
    }

    const handleSelectChatProjectPath = async () => {
        try {
            const result = await window.devscope.selectFolder()
            if (result?.success && typeof result.folderPath === 'string' && result.folderPath.trim()) {
                const nextPath = result.folderPath.trim()
                await handleApplyChatProjectPath(nextPath)
            }
        } catch (error) {
            ctx.setErrorMessage(error instanceof Error ? error.message : 'Failed to select chat folder path.')
        }
    }

    const handleCreateSessionForSelectedProject = async () => {
        try {
            const result = await window.devscope.selectFolder()
            if (result?.success && typeof result.folderPath === 'string' && result.folderPath.trim()) {
                await handleCreateSession(result.folderPath.trim())
            }
        } catch (error) {
            ctx.setErrorMessage(error instanceof Error ? error.message : 'Failed to add project chat.')
        }
    }

    const handleSessionsSidebarCollapsed = (collapsed: boolean) => {
        if (!collapsed && ctx.showEventConsole) {
            ctx.setShowEventConsole(false)
            ctx.updateSettings({
                assistantSidebarCollapsed: false,
                assistantShowEventPanel: false
            })
            return
        }
        ctx.updateSettings({ assistantSidebarCollapsed: collapsed })
    }

    const handleAssistantSidebarWidthChange = (nextWidth: number) => {
        const normalizedWidth = clampSidebarWidth(nextWidth)
        if (normalizedWidth === Number(ctx.settings.assistantSidebarWidth || 320)) return
        ctx.updateSettings({ assistantSidebarWidth: normalizedWidth })
    }

    const handleToggleEventConsole = () => {
        if (!ctx.settings.assistantAllowEventConsole) {
            ctx.setShowEventConsole(false)
            ctx.updateSettings({ assistantShowEventPanel: false })
            return
        }
        const next = !ctx.showEventConsole
        ctx.setShowEventConsole(next)

        if (next && !ctx.settings.assistantSidebarCollapsed) {
            ctx.updateSettings({
                assistantShowEventPanel: true,
                assistantSidebarCollapsed: true
            })
            return
        }
        ctx.updateSettings({ assistantShowEventPanel: next })
    }

    const handleExportConversation = (format: 'markdown' | 'json') => {
        if (!ctx.history || ctx.history.length === 0) return

        let content = ''
        let filename = ''
        const sessionTitle = ctx.sessions.find((s) => s.id === ctx.activeSessionId)?.title || 'session'

        if (format === 'json') {
            content = JSON.stringify(ctx.history, null, 2)
            filename = `devscope-${sessionTitle.replace(/[^a-z0-9]/gi, '_').toLowerCase()}-export.json`
        } else {
            content = ctx.history.map((m) => `### ${m.role.toUpperCase()} (${new Date(m.createdAt).toLocaleString()})\n\n${m.text}\n\n---\n`).join('\n')
            filename = `devscope-${sessionTitle.replace(/[^a-z0-9]/gi, '_').toLowerCase()}-export.md`
        }

        const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = filename
        a.click()
        URL.revokeObjectURL(url)
    }

    const handleExportEvents = async () => {
        try {
            const result = await window.devscope.assistant.exportEvents()
            if (!result?.success || typeof result.content !== 'string') {
                ctx.setErrorMessage('Failed to export assistant events.')
                return
            }

            const blob = new Blob([result.content], { type: 'application/json;charset=utf-8' })
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = `devscope-assistant-events-${new Date().toISOString().replace(/[:.]/g, '-')}.json`
            a.click()
            URL.revokeObjectURL(url)
        } catch (error) {
            ctx.setErrorMessage(error instanceof Error ? error.message : 'Failed to export assistant events.')
        }
    }

    const handleRunWorkflow = async (kind: WorkflowKind) => {
        if (ctx.workflowRunningKind || ctx.isBusy || ctx.isSending) return
        if (kind === 'draft-commit') {
            ctx.setWorkflowState({ kind, status: 'error', message: 'Draft Commit is disabled in chat.', at: Date.now() })
            return
        }

        const projectPath = ctx.workflowProjectPath.trim() || ctx.effectiveProjectPath
        if (!projectPath) {
            ctx.setErrorMessage('Workflow project path is required.')
            return
        }
        if (!(await persistActiveSessionProjectPath(projectPath))) return

        ctx.setErrorMessage(null)
        ctx.setWorkflowRunningKind(kind)
        ctx.setWorkflowState({ kind, status: 'running', message: `${WORKFLOW_LABELS[kind]} is running...`, at: Date.now() })

        try {
            let result: any
            if (kind === 'explain-diff') {
                result = await window.devscope.assistant.runWorkflowExplainDiff(projectPath, ctx.workflowFilePath.trim() || undefined, ctx.activeModel)
            } else if (kind === 'review-staged') {
                result = await window.devscope.assistant.runWorkflowReviewStaged(projectPath, ctx.activeModel)
            } else {
                result = await window.devscope.assistant.runWorkflowDraftCommit(projectPath, ctx.activeModel)
            }

            if (result?.success) {
                ctx.setWorkflowState({
                    kind,
                    status: 'success',
                    message: `${WORKFLOW_LABELS[kind]} queued successfully.`,
                    turnId: typeof result.turnId === 'string' ? result.turnId : undefined,
                    at: Date.now()
                })
                await ctx.loadSnapshot()
            } else {
                const message = result?.error || `${WORKFLOW_LABELS[kind]} failed.`
                ctx.setWorkflowState({ kind, status: 'error', message, at: Date.now() })
                ctx.setErrorMessage(message)
            }
        } catch (error) {
            const message = error instanceof Error ? error.message : `${WORKFLOW_LABELS[kind]} failed.`
            ctx.setWorkflowState({ kind, status: 'error', message, at: Date.now() })
            ctx.setErrorMessage(message)
        } finally {
            ctx.setWorkflowRunningKind(null)
        }
    }

    const handleClearHistory = async () => {
        const result = await window.devscope.assistant.clearHistory()
        if (!result?.success) {
            ctx.setErrorMessage(result?.error || 'Failed to clear chat history.')
            return
        }
        await ctx.loadSnapshot({ hydrateChat: true })
    }

    const handleCreateSession = async (projectPath?: string) => {
        ctx.setErrorMessage(null)
        ctx.setIsChatHydrating(true)
        try {
            const created = await window.devscope.assistant.createSession()
            const createdSessionId = created?.success ? String(created.session?.id || '').trim() : ''
            if (!createdSessionId) {
                const createError = created && 'error' in created ? created.error : undefined
                ctx.setErrorMessage(createError || 'Failed to create session.')
                ctx.setIsChatHydrating(false)
                return
            }
            if (projectPath) {
                ctx.setChatProjectPath(projectPath)
                ctx.setWorkflowProjectPath(projectPath)
                const persistResult = await window.devscope.assistant.setSessionProjectPath(createdSessionId, projectPath)
                if (!persistResult?.success) {
                    ctx.setErrorMessage(persistResult?.error || 'Failed to save chat path for this session.')
                }
            }
            await ctx.loadSnapshot({ hydrateChat: true })
        } catch (error) {
            ctx.setErrorMessage(error instanceof Error ? error.message : 'Failed to create session.')
            ctx.setIsChatHydrating(false)
        }
    }

    const handleSelectSession = async (sessionId: string) => {
        ctx.setIsChatHydrating(true)
        const result = await window.devscope.assistant.selectSession(sessionId)
        if (!result?.success) {
            ctx.setErrorMessage(result?.error || 'Failed to switch session.')
            await ctx.loadSnapshot({ hydrateChat: true })
            return
        }
        await ctx.loadSnapshot({ hydrateChat: true })
    }

    const handleRenameSession = async (sessionId: string, nextTitle: string) => {
        await window.devscope.assistant.renameSession(sessionId, nextTitle)
        await ctx.loadSnapshot()
    }

    const handleArchiveSession = async (sessionId: string, archived: boolean = true) => {
        await window.devscope.assistant.archiveSession(sessionId, archived)
        await ctx.loadSnapshot()
    }

    const handleDeleteSession = async (sessionId: string) => {
        await window.devscope.assistant.deleteSession(sessionId)
        await ctx.loadSnapshot({ hydrateChat: true })
    }

    const handleClearEvents = async () => {
        const result = await window.devscope.assistant.clearEvents()
        if (!result?.success) {
            ctx.setErrorMessage('Failed to clear assistant events.')
            return
        }
        ctx.setEventLog([])
    }

    return {
        persistActiveSessionProjectPath,
        handleApplyChatProjectPath,
        handleConnect,
        handleDisconnect,
        handleSend,
        handleRegenerate,
        handleCancelTurn,
        handleRespondApproval,
        handleRespondUserInput,
        handleEnableYoloMode,
        handleEnableSafeMode,
        handleSelectChatProjectPath,
        handleCreateSessionForSelectedProject,
        handleSessionsSidebarCollapsed,
        handleAssistantSidebarWidthChange,
        handleToggleEventConsole,
        handleExportConversation,
        handleExportEvents,
        handleRunWorkflow,
        handleClearHistory,
        handleCreateSession,
        handleSelectSession,
        handleRenameSession,
        handleArchiveSession,
        handleDeleteSession,
        handleClearEvents
    }
}
