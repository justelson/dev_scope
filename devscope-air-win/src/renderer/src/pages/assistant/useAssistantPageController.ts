import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useSettings } from '@/lib/settings'
import {
    type AssistantActivity,
    type AssistantApproval,
    type AssistantEvent,
    type AssistantHistoryMessage,
    type AssistantReasoning,
    type AssistantSession,
    type AssistantStatus,
    type TelemetryIntegrity,
    type WorkflowKind,
    type WorkflowState,
    INITIAL_STATUS,
    buildSessionScope,
    isTelemetryEventInScope
} from './assistant-page-types'
import { createAssistantPageActions } from './assistant-page-actions'
import { createAssistantEventHandler, createLoadSnapshot } from './assistant-page-runtime'

type SessionScope = { turnIds: Set<string>; attemptGroupIds: Set<string> }
type RuntimeModel = { id: string; label: string; isDefault: boolean }
type ModelListResponse = { success?: boolean; models?: RuntimeModel[]; error?: string }
const FALLBACK_MODEL_OPTIONS: RuntimeModel[] = [{ id: 'default', label: 'Default (server recommended)', isDefault: false }]

function normalizeRuntimeModels(payload: ModelListResponse | null | undefined): RuntimeModel[] {
    const list = Array.isArray(payload?.models) ? payload.models : []
    const normalized = list
        .map((entry) => ({
            id: typeof entry?.id === 'string' ? entry.id.trim() : '',
            label: typeof entry?.label === 'string' && entry.label.trim() ? entry.label.trim() : '',
            isDefault: Boolean(entry?.isDefault)
        }))
        .filter((entry) => entry.id.length > 0)

    const seen = new Set<string>()
    const unique: RuntimeModel[] = []
    for (const entry of normalized) {
        if (seen.has(entry.id)) continue
        seen.add(entry.id)
        unique.push({
            ...entry,
            label: entry.label || entry.id
        })
    }
    return unique
}

export function useAssistantPageController() {
    const { settings, updateSettings } = useSettings()
    const [status, setStatus] = useState<AssistantStatus>(INITIAL_STATUS)
    const [history, setHistory] = useState<AssistantHistoryMessage[]>([])
    const [streamingText, setStreamingText] = useState('')
    const [streamingTurnId, setStreamingTurnId] = useState<string | null>(null)
    const [isConnecting, setIsConnecting] = useState(false)
    const [isSending, setIsSending] = useState(false)
    const [errorMessage, setErrorMessage] = useState<string | null>(null)
    const [eventLog, setEventLog] = useState<AssistantEvent[]>([])
    const [showEventConsole, setShowEventConsole] = useState(
        settings.assistantAllowEventConsole && settings.assistantShowEventPanel
    )
    const [showHeaderMenu, setShowHeaderMenu] = useState(false)
    const [showYoloConfirmModal, setShowYoloConfirmModal] = useState(false)
    const [chatProjectPath, setChatProjectPath] = useState(settings.projectsFolder || '')
    const [workflowProjectPath, setWorkflowProjectPath] = useState(settings.projectsFolder || '')
    const [workflowFilePath, setWorkflowFilePath] = useState('')
    const [workflowRunningKind, setWorkflowRunningKind] = useState<WorkflowKind | null>(null)
    const [workflowState, setWorkflowState] = useState<WorkflowState | null>(null)
    const [telemetryIntegrity, setTelemetryIntegrity] = useState<TelemetryIntegrity | null>(null)
    const [isChatHydrating, setIsChatHydrating] = useState(true)
    const [reasoningByTurn, setReasoningByTurn] = useState<Record<string, AssistantReasoning[]>>({})
    const [activitiesByTurn, setActivitiesByTurn] = useState<Record<string, AssistantActivity[]>>({})
    const [approvalsByTurn, setApprovalsByTurn] = useState<Record<string, AssistantApproval[]>>({})
    const [sessions, setSessions] = useState<AssistantSession[]>([])
    const [activeSessionId, setActiveSessionId] = useState<string | null>(null)
    const [runtimeModels, setRuntimeModels] = useState<RuntimeModel[]>([])
    const [modelsLoading, setModelsLoading] = useState(false)
    const [modelsError, setModelsError] = useState<string | null>(null)

    const autoConnectAttemptedRef = useRef(false)
    const headerMenuRef = useRef<HTMLDivElement | null>(null)
    const chatScrollRef = useRef<HTMLDivElement | null>(null)
    const chatAutoScrollRef = useRef(true)
    const pendingInitialChatPositionRef = useRef(true)
    const chatMessageCountRef = useRef(0)
    const chatThoughtCountRef = useRef(0)
    const scopeRef = useRef<SessionScope>({ turnIds: new Set<string>(), attemptGroupIds: new Set<string>() })

    const normalizedChatProjectPath = chatProjectPath.trim()
    const fallbackRootPath = settings.projectsFolder.trim()
    const effectiveProjectPath = normalizedChatProjectPath || fallbackRootPath
    const activeProjectPath = effectiveProjectPath || 'global'
    const activeModel = settings.assistantProjectModels[activeProjectPath] || settings.assistantDefaultModel || 'default'
    const activeProfile = settings.assistantProjectProfiles[activeProjectPath] || settings.assistantProfile || 'safe-dev'
    const modelOptions = useMemo(() => {
        const defaultOption: RuntimeModel = { id: 'default', label: 'Default (server recommended)', isDefault: false }
        const source = runtimeModels.length > 0
            ? runtimeModels.map((model) => ({
                id: model.id,
                label: model.isDefault ? `${model.label} (default)` : model.label,
                isDefault: model.isDefault
            }))
            : FALLBACK_MODEL_OPTIONS

        const deduped = new Map<string, RuntimeModel>()
        deduped.set(defaultOption.id, defaultOption)
        for (const model of source) {
            if (!model.id || model.id === 'default') continue
            deduped.set(model.id, model)
        }

        if (settings.assistantDefaultModel && !deduped.has(settings.assistantDefaultModel)) {
            deduped.set(settings.assistantDefaultModel, {
                id: settings.assistantDefaultModel,
                label: `${settings.assistantDefaultModel} (saved)`,
                isDefault: false
            })
        }

        if (activeModel && !deduped.has(activeModel)) {
            deduped.set(activeModel, {
                id: activeModel,
                label: `${activeModel} (active)`,
                isDefault: false
            })
        }

        return Array.from(deduped.values())
    }, [runtimeModels, settings.assistantDefaultModel, activeModel])

    const loadModels = useCallback(async () => {
        setModelsLoading(true)
        setModelsError(null)
        try {
            const directResult = await window.devscope.assistant.listModels()
            const directModels = normalizeRuntimeModels(directResult as ModelListResponse)
            if (directResult?.success && directModels.length > 0) {
                setRuntimeModels(directModels)
                return
            }

            const statusFallback = await window.devscope.assistant.status({ kind: 'models:list' })
            const fallbackModels = normalizeRuntimeModels(statusFallback as ModelListResponse)
            if (statusFallback?.success && fallbackModels.length > 0) {
                setRuntimeModels(fallbackModels)
                return
            }

            setRuntimeModels(directModels.length > 0 ? directModels : fallbackModels)
            setModelsError(
                (directResult as ModelListResponse)?.error
                || (statusFallback as ModelListResponse)?.error
                || 'Unable to load models from Codex runtime.'
            )
        } catch (error: any) {
            setRuntimeModels([])
            setModelsError(error?.message || 'Unable to load models from Codex runtime.')
        } finally {
            setModelsLoading(false)
        }
    }, [])

    const handleSelectModel = useCallback((modelId: string) => {
        const normalizedModel = String(modelId || '').trim() || 'default'
        const currentOverride = String(settings.assistantProjectModels[activeProjectPath] || '').trim()

        if (!currentOverride && normalizedModel === 'default') return
        if (currentOverride === normalizedModel) return

        const nextProjectModels = { ...settings.assistantProjectModels }
        if (normalizedModel === 'default') {
            delete nextProjectModels[activeProjectPath]
        } else {
            nextProjectModels[activeProjectPath] = normalizedModel
        }
        updateSettings({ assistantProjectModels: nextProjectModels })
    }, [activeProjectPath, settings.assistantProjectModels, updateSettings])

    const availableProjectRoots = useMemo(() => {
        const roots = [settings.projectsFolder, ...(settings.additionalFolders || [])]
            .map((value) => String(value || '').trim())
            .filter(Boolean)
        return Array.from(new Set(roots))
    }, [settings.projectsFolder, settings.additionalFolders])

    const connectionState = useMemo(() => {
        if (!settings.assistantEnabled) return 'disabled' as const
        if (status.state === 'connecting') return 'connecting' as const
        if (status.connected && status.state === 'ready') return 'connected' as const
        if (status.state === 'error') return 'error' as const
        return 'disconnected' as const
    }, [settings.assistantEnabled, status])

    const isBusy = Boolean(status.activeTurnId)
    const canUseEventConsole = settings.assistantAllowEventConsole
    const activeSessions = useMemo(() => sessions.filter((session) => !session.archived), [sessions])
    const activeSessionTitle = useMemo(() => {
        const raw = sessions.find((session) => session.id === activeSessionId)?.title || ''
        return raw.trim() || 'Untitled Session'
    }, [sessions, activeSessionId])

    const groupedHistory = useMemo(() => {
        const groups: Array<{ id: string; role: 'user' | 'assistant' | 'system'; messages: AssistantHistoryMessage[] }> = []
        for (const msg of history) {
            if (msg.role === 'assistant' && msg.attemptGroupId) {
                const last = groups[groups.length - 1]
                if (last && last.role === 'assistant' && last.messages[0].attemptGroupId === msg.attemptGroupId) {
                    last.messages.push(msg)
                    continue
                }
            }
            groups.push({ id: msg.id, role: msg.role, messages: [msg] })
        }
        return groups
    }, [history])

    const allReasoning = useMemo(
        () => Object.values(reasoningByTurn).flat().filter((entry) => isTelemetryEventInScope(entry, scopeRef.current)),
        [reasoningByTurn, history, status.activeTurnId, streamingTurnId]
    )
    const allActivities = useMemo(
        () => Object.values(activitiesByTurn).flat().filter((entry) => isTelemetryEventInScope(entry, scopeRef.current)),
        [activitiesByTurn, history, status.activeTurnId, streamingTurnId]
    )
    const allApprovals = useMemo(
        () => Object.values(approvalsByTurn).flat().filter((entry) => isTelemetryEventInScope(entry as unknown as Record<string, unknown>, scopeRef.current)),
        [approvalsByTurn, history, status.activeTurnId, streamingTurnId]
    )

    const isEmptyChatState = !isChatHydrating && history.length === 0 && !streamingText && !isSending && !isBusy

    const displayHistoryGroups = useMemo(() => {
        const latestThoughtTurnId = [...allReasoning, ...allActivities]
            .sort((a, b) => b.timestamp - a.timestamp)
            .find((entry) => entry.turnId)?.turnId || null
        const pendingTurnId = status.activeTurnId || streamingTurnId || latestThoughtTurnId

        const hasAssistantForPendingTurn = Boolean(pendingTurnId)
            && history.some((message) => message.role === 'assistant' && message.turnId === pendingTurnId)
        const hasPendingTelemetry = Boolean(pendingTurnId) && (
            allReasoning.some((entry) => entry.turnId === pendingTurnId)
            || allActivities.some((entry) => entry.turnId === pendingTurnId)
            || allApprovals.some((entry) => entry.turnId === pendingTurnId)
        )
        const shouldInjectPendingAssistant = (
            Boolean(pendingTurnId)
            && !hasAssistantForPendingTurn
            && (isSending || isBusy || Boolean(streamingText) || hasPendingTelemetry)
        ) || (
            !pendingTurnId
            && (isSending || isBusy || Boolean(streamingText))
        )

        if (shouldInjectPendingAssistant) {
            const syntheticTurnId = pendingTurnId || streamingTurnId || null
            const pendingId = syntheticTurnId ? `streaming-${syntheticTurnId}` : 'pending-assistant'
            return [...groupedHistory, {
                id: pendingId,
                role: 'assistant' as const,
                messages: [{
                    id: `${pendingId}-msg`,
                    role: 'assistant' as const,
                    text: streamingText || '',
                    createdAt: Date.now(),
                    turnId: syntheticTurnId || undefined,
                    isActiveAttempt: true
                }]
            }]
        }

        if (!pendingTurnId) return groupedHistory

        return groupedHistory
    }, [groupedHistory, history, streamingTurnId, streamingText, status.activeTurnId, allReasoning, allActivities, allApprovals])

    const scrollChatToBottom = (behavior: ScrollBehavior = 'smooth') => {
        const el = chatScrollRef.current
        if (!el) return
        el.scrollTo({ top: el.scrollHeight, behavior })
    }

    const handleChatScroll = () => {
        const el = chatScrollRef.current
        if (!el) return
        chatAutoScrollRef.current = (el.scrollHeight - (el.scrollTop + el.clientHeight)) < 96
    }

    const baseRuntimeDeps = {
        getStreamingTurnId: () => streamingTurnId,
        scopeRef,
        setIsChatHydrating,
        setStatus,
        setHistory,
        setSessions: setSessions as any,
        setActiveSessionId,
        setTelemetryIntegrity,
        setReasoningByTurn: setReasoningByTurn as any,
        setActivitiesByTurn: setActivitiesByTurn as any,
        setApprovalsByTurn: setApprovalsByTurn as any,
        setEventLog: setEventLog as any,
        setStreamingTurnId,
        setStreamingText,
        setWorkflowState,
        setWorkflowRunningKind,
        setErrorMessage
    }
    const baseLoadSnapshot = createLoadSnapshot(baseRuntimeDeps)
    const loadSnapshot = async (options?: { hydrateChat?: boolean }) => {
        if (options?.hydrateChat) pendingInitialChatPositionRef.current = true
        await baseLoadSnapshot(options)
    }
    const handleAssistantEvent = createAssistantEventHandler(baseRuntimeDeps)

    const actions = createAssistantPageActions({
        settings,
        activeModel,
        activeProfile,
        activeSessionTitle,
        activeSessionId,
        effectiveProjectPath,
        workflowProjectPath,
        workflowFilePath,
        workflowRunningKind,
        isBusy,
        isSending,
        status,
        history,
        sessions,
        showEventConsole,
        setErrorMessage,
        setIsConnecting,
        setStatus,
        setStreamingTurnId,
        setStreamingText,
        setIsSending,
        setChatProjectPath,
        setWorkflowProjectPath,
        setShowYoloConfirmModal,
        setShowEventConsole,
        setWorkflowRunningKind,
        setWorkflowState,
        setHistory,
        setSessions: setSessions as any,
        setEventLog,
        setIsChatHydrating,
        setActiveSessionId,
        setReasoningByTurn,
        setActivitiesByTurn,
        setApprovalsByTurn,
        scopeRef,
        updateSettings,
        scrollChatToBottom: (behavior?: ScrollBehavior) => {
            chatAutoScrollRef.current = true
            window.requestAnimationFrame(() => scrollChatToBottom(behavior || 'smooth'))
        },
        loadSnapshot
    })

    useEffect(() => {
        scopeRef.current = buildSessionScope(history, status.activeTurnId, streamingTurnId)
    }, [history, status.activeTurnId, streamingTurnId])

    useEffect(() => {
        let isMounted = true
        const unsubscribe = window.devscope.assistant.onEvent((event) => {
            if (!isMounted) return
            handleAssistantEvent(event as AssistantEvent)
        })

        void (async () => {
            setIsChatHydrating(true)
            try {
                await loadSnapshot()
                if (!isMounted) return
                await actions.handleCreateSession()
            } catch {
                if (isMounted) setIsChatHydrating(false)
            }
        })()

        return () => {
            isMounted = false
            unsubscribe()
        }
    }, [])

    useEffect(() => {
        void loadModels()
    }, [loadModels])

    useEffect(() => {
        if (!settings.assistantEnabled || !settings.assistantAutoConnectOnOpen) return
        if (autoConnectAttemptedRef.current) return
        if (status.connected || status.state === 'connecting') return
        autoConnectAttemptedRef.current = true
        void actions.handleConnect().catch(() => undefined)
    }, [settings.assistantEnabled, settings.assistantAutoConnectOnOpen, status.connected, status.state])

    useEffect(() => {
        setShowEventConsole(canUseEventConsole && settings.assistantShowEventPanel)
    }, [canUseEventConsole, settings.assistantShowEventPanel])
    useEffect(() => {
        if (canUseEventConsole) return
        if (!showEventConsole && !settings.assistantShowEventPanel) return
        setShowEventConsole(false)
        if (settings.assistantShowEventPanel) {
            updateSettings({ assistantShowEventPanel: false })
        }
    }, [canUseEventConsole, showEventConsole, settings.assistantShowEventPanel, updateSettings])
    useEffect(() => {
        if (!showEventConsole || settings.assistantSidebarCollapsed) return
        updateSettings({ assistantSidebarCollapsed: true })
    }, [showEventConsole, settings.assistantSidebarCollapsed, updateSettings])

    useEffect(() => {
        if (!showHeaderMenu) return
        const onWindowPointerDown = (event: MouseEvent) => {
            if (!headerMenuRef.current) return
            if (headerMenuRef.current.contains(event.target as Node)) return
            setShowHeaderMenu(false)
        }
        window.addEventListener('mousedown', onWindowPointerDown)
        return () => window.removeEventListener('mousedown', onWindowPointerDown)
    }, [showHeaderMenu])

    useEffect(() => {
        const sessionPath = sessions.find((session) => session.id === activeSessionId)?.projectPath?.trim() || ''
        const nextPath = sessionPath || settings.projectsFolder.trim()
        setChatProjectPath((prev) => (prev.trim() === nextPath ? prev : nextPath))
    }, [activeSessionId, sessions, settings.projectsFolder])

    useEffect(() => {
        const normalizedWorkflowPath = workflowProjectPath.trim()
        const normalizedEffectivePath = effectiveProjectPath.trim()
        if (normalizedWorkflowPath === normalizedEffectivePath) return
        setWorkflowProjectPath(effectiveProjectPath)
    }, [effectiveProjectPath, workflowProjectPath])

    useEffect(() => {
        if (!streamingTurnId || isBusy) return
        if (!history.some((message) => message.role === 'assistant' && message.turnId === streamingTurnId)) return
        setStreamingTurnId(null)
        setStreamingText('')
    }, [history, isBusy, streamingTurnId])

    useEffect(() => {
        chatAutoScrollRef.current = true
        pendingInitialChatPositionRef.current = true
        setStreamingTurnId(null)
        setStreamingText('')
        setReasoningByTurn({})
        setActivitiesByTurn({})
        setApprovalsByTurn({})
        setWorkflowState(null)
        setWorkflowRunningKind(null)
        scopeRef.current = buildSessionScope([], null, null)
    }, [activeSessionId])

    useLayoutEffect(() => {
        if (isChatHydrating || !pendingInitialChatPositionRef.current) return
        const el = chatScrollRef.current
        if (!el) return
        el.scrollTop = el.scrollHeight
        chatAutoScrollRef.current = true
        pendingInitialChatPositionRef.current = false
    }, [isChatHydrating, activeSessionId, displayHistoryGroups.length])

    useEffect(() => {
        const visibleMessageCount = history.length + (streamingText ? 1 : 0)
        const thoughtEventCount = allReasoning.length + allActivities.length + allApprovals.length
        const hasUpdate = visibleMessageCount !== chatMessageCountRef.current
            || thoughtEventCount !== chatThoughtCountRef.current
            || Boolean(streamingText)
        if (!hasUpdate) return
        if (chatAutoScrollRef.current || isSending || isBusy) {
            const behavior: ScrollBehavior = (streamingText || pendingInitialChatPositionRef.current) ? 'auto' : 'smooth'
            window.requestAnimationFrame(() => scrollChatToBottom(behavior))
        }
        chatMessageCountRef.current = visibleMessageCount
        chatThoughtCountRef.current = thoughtEventCount
    }, [history.length, streamingText, isSending, isBusy, allReasoning.length, allActivities.length, allApprovals.length])

    return {
        settings,
        status,
        history,
        streamingText,
        streamingTurnId,
        isConnecting,
        isSending,
        errorMessage,
        eventLog,
        showEventConsole,
        showHeaderMenu,
        showYoloConfirmModal,
        chatProjectPath,
        workflowProjectPath,
        workflowFilePath,
        workflowRunningKind,
        workflowState,
        telemetryIntegrity,
        isChatHydrating,
        sessions,
        activeSessionId,
        activeModel,
        modelOptions,
        modelsLoading,
        modelsError,
        activeProfile,
        availableProjectRoots,
        effectiveProjectPath,
        connectionState,
        isBusy,
        activeSessions,
        activeSessionTitle,
        allReasoning,
        allActivities,
        allApprovals,
        isEmptyChatState,
        displayHistoryGroups,
        headerMenuRef,
        chatScrollRef,
        setShowHeaderMenu,
        setShowYoloConfirmModal,
        setChatProjectPath,
        handleSelectModel,
        handleRefreshModels: loadModels,
        setWorkflowProjectPath,
        setWorkflowFilePath,
        handleChatScroll,
        loadSnapshot,
        ...actions
    }
}

export type AssistantPageController = ReturnType<typeof useAssistantPageController>
