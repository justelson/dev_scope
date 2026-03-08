import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useSettings } from '@/lib/settings'
import {
    type AssistantActivity,
    type AssistantApproval,
    type AssistantEvent,
    type AssistantHistoryMessage,
    type AssistantPendingUserInput,
    type AssistantReasoning,
    type AssistantSession,
    type AssistantStatus,
    type AssistantThreadTokenUsage,
    type TelemetryIntegrity,
    type WorkflowKind,
    type WorkflowState,
    INITIAL_STATUS,
    buildSessionScope,
    isTelemetryEventInScope
} from './assistant-page-types'
import {
    buildPendingUserInputAnswers,
    derivePendingUserInputProgress,
    setPendingUserInputCustomAnswer,
    type PendingUserInputDraftAnswer
} from './assistant-pending-user-input'
import { deriveAssistantPhase, deriveVisibleWorkEntries, getAssistantPhaseLabel } from './assistant-session-logic'
import { createAssistantPageActions } from './assistant-page-actions'
import { createAssistantEventHandler, createLoadSnapshot } from './assistant-page-runtime'

type SessionScope = { turnIds: Set<string>; attemptGroupIds: Set<string> }
type RuntimeModel = { id: string; label: string; isDefault: boolean }
type ModelListResponse = { success?: boolean; models?: RuntimeModel[]; error?: string }
const FALLBACK_MODEL_OPTIONS: RuntimeModel[] = [{ id: 'default', label: 'Default (server recommended)', isDefault: false }]
const AUTO_CONNECT_MAX_ATTEMPTS = 4
const AUTO_CONNECT_BASE_RETRY_MS = 1200
const AUTO_CONNECT_MAX_RETRY_MS = 12000

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
    const [threadTokenUsage, setThreadTokenUsage] = useState<AssistantThreadTokenUsage | null>(null)
    const [lastAccountUpdateAt, setLastAccountUpdateAt] = useState<number | null>(null)
    const [lastRateLimitsUpdateAt, setLastRateLimitsUpdateAt] = useState<number | null>(null)
    const [isChatHydrating, setIsChatHydrating] = useState(true)
    const [reasoningByTurn, setReasoningByTurn] = useState<Record<string, AssistantReasoning[]>>({})
    const [activitiesByTurn, setActivitiesByTurn] = useState<Record<string, AssistantActivity[]>>({})
    const [approvalsByTurn, setApprovalsByTurn] = useState<Record<string, AssistantApproval[]>>({})
    const [pendingUserInputs, setPendingUserInputs] = useState<AssistantPendingUserInput[]>([])
    const [respondingUserInputRequestIds, setRespondingUserInputRequestIds] = useState<number[]>([])
    const [pendingUserInputAnswersByRequestId, setPendingUserInputAnswersByRequestId] = useState<
        Record<string, Record<string, PendingUserInputDraftAnswer>>
    >({})
    const [pendingUserInputQuestionIndexByRequestId, setPendingUserInputQuestionIndexByRequestId] = useState<Record<string, number>>({})
    const [sessions, setSessions] = useState<AssistantSession[]>([])
    const [activeSessionId, setActiveSessionId] = useState<string | null>(null)
    const [runtimeModels, setRuntimeModels] = useState<RuntimeModel[]>([])
    const [modelsLoading, setModelsLoading] = useState(false)
    const [modelsError, setModelsError] = useState<string | null>(null)
    const [autoConnectRetryTick, setAutoConnectRetryTick] = useState(0)

    const autoConnectAttemptedRef = useRef(false)
    const autoConnectAttemptsRef = useRef(0)
    const autoConnectRetryTimerRef = useRef<number | null>(null)
    const headerMenuRef = useRef<HTMLDivElement | null>(null)
    const chatScrollRef = useRef<HTMLDivElement | null>(null)
    const chatAutoScrollRef = useRef(true)
    const pendingInitialChatPositionRef = useRef(true)
    const chatMessageCountRef = useRef(0)
    const chatThoughtCountRef = useRef(0)
    const scopeRef = useRef<SessionScope>({ turnIds: new Set<string>(), attemptGroupIds: new Set<string>() })
    const snapshotSequenceRef = useRef(0)
    const snapshotSyncTimerRef = useRef<number | null>(null)
    const snapshotSyncInFlightRef = useRef(false)
    const pendingSnapshotSyncRef = useRef(false)

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

    const loadModels = useCallback(async (forceRefresh = false) => {
        if (!forceRefresh && (!settings.assistantEnabled || !status.connected)) {
            setModelsError(null)
            setModelsLoading(false)
            return
        }
        setModelsLoading(true)
        setModelsError(null)
        try {
            const directResult = await window.devscope.assistant.listModels(forceRefresh)
            const directModels = normalizeRuntimeModels(directResult as ModelListResponse)
            setRuntimeModels(directModels)
            if (!directResult?.success) {
                setModelsError(
                    (directResult as ModelListResponse)?.error
                    || 'Unable to load models from Codex runtime.'
                )
            }
        } catch (error: any) {
            setRuntimeModels([])
            setModelsError(error?.message || 'Unable to load models from Codex runtime.')
        } finally {
            setModelsLoading(false)
        }
    }, [settings.assistantEnabled, status.connected])

    const handleSelectModel = useCallback((modelId: string) => {
        const normalizedModel = String(modelId || '').trim() || 'default'
        const currentDefaultModel = String(settings.assistantDefaultModel || 'default').trim() || 'default'
        const currentOverride = String(settings.assistantProjectModels[activeProjectPath] || '').trim()

        if (currentOverride === normalizedModel && currentDefaultModel === normalizedModel) return

        const nextProjectModels = { ...settings.assistantProjectModels }
        if (normalizedModel === currentDefaultModel || normalizedModel === 'default') {
            delete nextProjectModels[activeProjectPath]
        } else {
            nextProjectModels[activeProjectPath] = normalizedModel
        }
        updateSettings({
            assistantDefaultModel: normalizedModel,
            assistantProjectModels: nextProjectModels
        })
    }, [activeProjectPath, settings.assistantDefaultModel, settings.assistantProjectModels, updateSettings])

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
                const lastTurnId = last?.messages[last.messages.length - 1]?.turnId
                const nextTurnId = msg.turnId || null
                const isAlternateAttempt = Boolean(
                    last
                    && last.role === 'assistant'
                    && last.messages[0].attemptGroupId === msg.attemptGroupId
                    && lastTurnId
                    && nextTurnId
                    && lastTurnId !== nextTurnId
                )
                if (isAlternateAttempt && last) {
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
    const unresolvedApprovals = useMemo(() => {
        const approvalsByRequestId = new Map<number, AssistantApproval>()
        for (const entry of [...allApprovals].sort((a, b) => a.timestamp - b.timestamp)) {
            const existing = approvalsByRequestId.get(entry.requestId)
            approvalsByRequestId.set(entry.requestId, existing ? { ...existing, ...entry } : entry)
        }
        return Array.from(approvalsByRequestId.values()).filter((entry) => !entry.decision)
    }, [allApprovals])
    const activePendingUserInput = pendingUserInputs[0] || null
    const activePendingDraftAnswers = useMemo(
        () => activePendingUserInput
            ? (pendingUserInputAnswersByRequestId[String(activePendingUserInput.requestId)] || {})
            : {},
        [activePendingUserInput, pendingUserInputAnswersByRequestId]
    )
    const activePendingQuestionIndex = activePendingUserInput
        ? (pendingUserInputQuestionIndexByRequestId[String(activePendingUserInput.requestId)] || 0)
        : 0
    const activePendingProgress = useMemo(
        () => derivePendingUserInputProgress(activePendingUserInput, activePendingDraftAnswers, activePendingQuestionIndex),
        [activePendingUserInput, activePendingDraftAnswers, activePendingQuestionIndex]
    )
    const activePendingResolvedAnswers = useMemo(
        () => activePendingUserInput
            ? buildPendingUserInputAnswers(activePendingUserInput.questions, activePendingDraftAnswers)
            : null,
        [activePendingDraftAnswers, activePendingUserInput]
    )
    const activePendingIsResponding = activePendingUserInput
        ? respondingUserInputRequestIds.includes(activePendingUserInput.requestId)
        : false

    useEffect(() => {
        const activeRequestIds = new Set(pendingUserInputs.map((entry) => String(entry.requestId)))

        setRespondingUserInputRequestIds((prev) => {
            const next = prev.filter((requestId) => activeRequestIds.has(String(requestId)))
            return next.length === prev.length ? prev : next
        })

        setPendingUserInputAnswersByRequestId((prev) => {
            let changed = false
            const next: Record<string, Record<string, PendingUserInputDraftAnswer>> = {}
            for (const [requestId, answers] of Object.entries(prev)) {
                if (!activeRequestIds.has(requestId)) {
                    changed = true
                    continue
                }
                next[requestId] = answers
            }
            return changed ? next : prev
        })

        setPendingUserInputQuestionIndexByRequestId((prev) => {
            let changed = false
            const next: Record<string, number> = {}
            for (const [requestId, questionIndex] of Object.entries(prev)) {
                if (!activeRequestIds.has(requestId)) {
                    changed = true
                    continue
                }
                next[requestId] = questionIndex
            }
            return changed ? next : prev
        })
    }, [pendingUserInputs])

    const timelineWorkItems = useMemo(() => {
        return deriveVisibleWorkEntries(allActivities)
            .map((entry) => ({
                id: entry.id,
                timestamp: entry.timestamp,
                kind: entry.tone === 'thinking' ? 'thinking' as const : 'tool' as const,
                turnId: entry.turnId,
                primary: entry.label,
                secondary: entry.detail
            }))
            .sort((a, b) => a.timestamp - b.timestamp)
    }, [allActivities])
    const assistantPhase = useMemo(() => deriveAssistantPhase({
        isConnecting,
        isSending,
        isBusy,
        streamingText,
        streamingTurnId,
        activeTurnId: status.activeTurnId,
        hasPendingApproval: unresolvedApprovals.length > 0,
        hasPendingUserInput: pendingUserInputs.length > 0
    }), [
        isConnecting,
        isSending,
        isBusy,
        streamingText,
        streamingTurnId,
        status.activeTurnId,
        unresolvedApprovals.length,
        pendingUserInputs.length
    ])
    const assistantPhaseLabel = useMemo(
        () => getAssistantPhaseLabel(assistantPhase),
        [assistantPhase]
    )
    const assistantIsWorking = assistantPhase === 'thinking' || assistantPhase === 'answering'
    const isEmptyChatState = !isChatHydrating && history.length === 0 && !streamingText && !isSending && !isBusy

    const displayHistoryGroups = useMemo(() => groupedHistory, [groupedHistory])

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

    const baseLoadSnapshotRef = useRef<((options?: { hydrateChat?: boolean }) => Promise<void>) | null>(null)
    const requestSnapshotSync = useCallback(() => {
        if (snapshotSyncTimerRef.current !== null) return
        snapshotSyncTimerRef.current = window.setTimeout(() => {
            snapshotSyncTimerRef.current = null
            if (snapshotSyncInFlightRef.current) {
                pendingSnapshotSyncRef.current = true
                return
            }

            snapshotSyncInFlightRef.current = true
            void Promise.resolve(baseLoadSnapshotRef.current?.({ hydrateChat: false }))
                .catch(() => undefined)
                .finally(() => {
                    snapshotSyncInFlightRef.current = false
                    if (!pendingSnapshotSyncRef.current) return
                    pendingSnapshotSyncRef.current = false
                    requestSnapshotSync()
                })
        }, 48)
    }, [])

    const baseRuntimeDeps = {
        getStreamingTurnId: () => streamingTurnId,
        getSnapshotSequence: () => snapshotSequenceRef.current,
        requestSnapshotSync,
        scopeRef,
        setIsChatHydrating,
        setSnapshotSequence: (value: number) => {
            snapshotSequenceRef.current = Math.max(snapshotSequenceRef.current, Number(value) || 0)
        },
        setStatus,
        setHistory,
        setSessions: setSessions as any,
        setActiveSessionId,
        setTelemetryIntegrity,
        setThreadTokenUsage,
        setLastAccountUpdateAt,
        setLastRateLimitsUpdateAt,
        setReasoningByTurn: setReasoningByTurn as any,
        setActivitiesByTurn: setActivitiesByTurn as any,
        setApprovalsByTurn: setApprovalsByTurn as any,
        setPendingUserInputs: setPendingUserInputs as any,
        setEventLog: setEventLog as any,
        setStreamingTurnId,
        setStreamingText,
        setWorkflowState,
        setWorkflowRunningKind,
        setErrorMessage
    }
    const baseLoadSnapshot = createLoadSnapshot(baseRuntimeDeps)
    baseLoadSnapshotRef.current = baseLoadSnapshot
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
        isConnecting,
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
        setPendingUserInputs,
        setRespondingUserInputRequestIds,
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
                if (isMounted) setIsChatHydrating(false)
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
        if (!status.connected) return
        void loadModels()
    }, [status.connected, loadModels])

    useEffect(() => {
        return () => {
            if (autoConnectRetryTimerRef.current !== null) {
                window.clearTimeout(autoConnectRetryTimerRef.current)
                autoConnectRetryTimerRef.current = null
            }
            if (snapshotSyncTimerRef.current !== null) {
                window.clearTimeout(snapshotSyncTimerRef.current)
                snapshotSyncTimerRef.current = null
            }
        }
    }, [])

    useEffect(() => {
        if (!settings.assistantEnabled) {
            autoConnectAttemptedRef.current = false
            autoConnectAttemptsRef.current = 0
            if (autoConnectRetryTimerRef.current !== null) {
                window.clearTimeout(autoConnectRetryTimerRef.current)
                autoConnectRetryTimerRef.current = null
            }
            return
        }
        if (status.connected) {
            autoConnectAttemptedRef.current = true
            autoConnectAttemptsRef.current = AUTO_CONNECT_MAX_ATTEMPTS
            if (autoConnectRetryTimerRef.current !== null) {
                window.clearTimeout(autoConnectRetryTimerRef.current)
                autoConnectRetryTimerRef.current = null
            }
            return
        }
        if (status.state === 'connecting' || autoConnectRetryTimerRef.current !== null) {
            return
        }
        if (!autoConnectAttemptedRef.current) {
            autoConnectAttemptedRef.current = true
            autoConnectAttemptsRef.current = 0
        }
        if (autoConnectAttemptsRef.current >= AUTO_CONNECT_MAX_ATTEMPTS) {
            return
        }

        autoConnectAttemptsRef.current += 1
        const attemptNumber = autoConnectAttemptsRef.current
        void actions.handleConnect()
            .then((success) => {
                if (success) {
                    autoConnectAttemptsRef.current = AUTO_CONNECT_MAX_ATTEMPTS
                    return
                }
                if (attemptNumber >= AUTO_CONNECT_MAX_ATTEMPTS) return
                const delay = Math.min(
                    AUTO_CONNECT_MAX_RETRY_MS,
                    AUTO_CONNECT_BASE_RETRY_MS * (2 ** Math.max(0, attemptNumber - 1))
                )
                autoConnectRetryTimerRef.current = window.setTimeout(() => {
                    autoConnectRetryTimerRef.current = null
                    setAutoConnectRetryTick((value) => value + 1)
                }, delay)
            })
            .catch(() => {
                if (attemptNumber >= AUTO_CONNECT_MAX_ATTEMPTS) return
                const delay = Math.min(
                    AUTO_CONNECT_MAX_RETRY_MS,
                    AUTO_CONNECT_BASE_RETRY_MS * (2 ** Math.max(0, attemptNumber - 1))
                )
                autoConnectRetryTimerRef.current = window.setTimeout(() => {
                    autoConnectRetryTimerRef.current = null
                    setAutoConnectRetryTick((value) => value + 1)
                }, delay)
            })
    }, [settings.assistantEnabled, status.connected, status.state, autoConnectRetryTick])

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
        setPendingUserInputs([])
        setRespondingUserInputRequestIds([])
        setPendingUserInputAnswersByRequestId({})
        setPendingUserInputQuestionIndexByRequestId({})
        setWorkflowState(null)
        setWorkflowRunningKind(null)
        setThreadTokenUsage(null)
        setLastAccountUpdateAt(null)
        setLastRateLimitsUpdateAt(null)
        snapshotSequenceRef.current = 0
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

    const setActivePendingUserInputQuestionIndex = useCallback((nextQuestionIndex: number) => {
        if (!activePendingUserInput) return
        setPendingUserInputQuestionIndexByRequestId((existing) => ({
            ...existing,
            [String(activePendingUserInput.requestId)]: nextQuestionIndex
        }))
    }, [activePendingUserInput])

    const handlePendingUserInputSelectOption = useCallback((questionId: string, optionLabel: string) => {
        if (!activePendingUserInput) return
        setPendingUserInputAnswersByRequestId((existing) => ({
            ...existing,
            [String(activePendingUserInput.requestId)]: {
                ...(existing[String(activePendingUserInput.requestId)] || {}),
                [questionId]: { selectedOptionLabel: optionLabel }
            }
        }))
    }, [activePendingUserInput])

    const handlePendingUserInputCustomAnswer = useCallback((questionId: string, customAnswer: string) => {
        if (!activePendingUserInput) return
        setPendingUserInputAnswersByRequestId((existing) => ({
            ...existing,
            [String(activePendingUserInput.requestId)]: {
                ...(existing[String(activePendingUserInput.requestId)] || {}),
                [questionId]: setPendingUserInputCustomAnswer(
                    existing[String(activePendingUserInput.requestId)]?.[questionId],
                    customAnswer
                )
            }
        }))
    }, [activePendingUserInput])

    const handlePendingUserInputPrevious = useCallback(() => {
        if (!activePendingProgress) return
        setActivePendingUserInputQuestionIndex(Math.max(activePendingProgress.questionIndex - 1, 0))
    }, [activePendingProgress, setActivePendingUserInputQuestionIndex])

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
        threadTokenUsage,
        lastAccountUpdateAt,
        lastRateLimitsUpdateAt,
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
        pendingUserInputs,
        activePendingUserInput,
        activePendingProgress,
        activePendingResolvedAnswers,
        activePendingIsResponding,
        activeWorkItems: timelineWorkItems,
        activeTelemetryTurnId: status.activeTurnId || streamingTurnId || null,
        assistantPhase,
        assistantPhaseLabel,
        assistantIsWorking,
        isEmptyChatState,
        displayHistoryGroups,
        headerMenuRef,
        chatScrollRef,
        setShowHeaderMenu,
        setShowYoloConfirmModal,
        setChatProjectPath,
        handleSelectModel,
        handleRefreshModels: () => loadModels(true),
        setWorkflowProjectPath,
        setWorkflowFilePath,
        handleChatScroll,
        loadSnapshot,
        handlePendingUserInputSelectOption,
        handlePendingUserInputCustomAnswer,
        handlePendingUserInputPrevious,
        handlePendingUserInputNext: () => {
            if (!activePendingProgress) return
            if (activePendingProgress.isLastQuestion || !activePendingProgress.canAdvance) return
            setActivePendingUserInputQuestionIndex(activePendingProgress.questionIndex + 1)
        },
        ...actions
    }
}

export type AssistantPageController = ReturnType<typeof useAssistantPageController>
