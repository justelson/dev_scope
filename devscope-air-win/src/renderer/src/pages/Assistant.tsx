/**
 * DevScope - Assistant Page
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { MessageSquare, PlugZap, Shield, Zap, Settings2, XCircle, Terminal, MessageSquarePlus, Trash2, Download, MoreHorizontal, FolderOpen } from 'lucide-react'
import { useSettings } from '@/lib/settings'
import { cn } from '@/lib/utils'
import { AssistantMessage } from './assistant/AssistantMessage'
import { AssistantEventConsole } from './assistant/AssistantEventConsole'
import { AssistantComposer, ComposerContextFile } from './assistant/AssistantComposer'
import { AssistantSessionsSidebar } from './assistant/AssistantSessionsSidebar'

type AssistantState = 'offline' | 'connecting' | 'ready' | 'error'
type AssistantRole = 'user' | 'assistant' | 'system'

type AssistantStatus = {
    connected: boolean
    state: AssistantState
    approvalMode: 'safe' | 'yolo'
    provider: 'codex'
    model: string
    activeTurnId: string | null
    lastError: string | null
}

export type AssistantHistoryMessage = {
    id: string
    role: AssistantRole
    text: string
    reasoningText?: string
    createdAt: number
    turnId?: string
    attemptGroupId?: string
    attemptIndex?: number
    isActiveAttempt?: boolean
}

type AssistantEvent = {
    type: string
    timestamp: number
    payload: Record<string, unknown>
}

export type AssistantReasoning = {
    turnId: string
    attemptGroupId: string
    text: string
    method: string
    timestamp: number
}

export type AssistantActivity = {
    turnId: string
    attemptGroupId: string
    kind: string
    summary: string
    method: string
    payload: Record<string, unknown>
    timestamp: number
}

export type AssistantApproval = {
    requestId: number
    method: string
    mode: 'safe' | 'yolo'
    decision?: 'decline' | 'acceptForSession'
    request?: Record<string, unknown>
    timestamp: number
    turnId?: string
    attemptGroupId?: string
}

export type AssistantSession = {
    id: string
    title: string
    archived: boolean
    createdAt: number
    updatedAt: number
    messageCount: number
}

type WorkflowKind = 'explain-diff' | 'review-staged' | 'draft-commit'

type WorkflowState = {
    kind: WorkflowKind
    status: 'running' | 'success' | 'error'
    message: string
    turnId?: string
    at: number
}

type TelemetryIntegrity = {
    eventsStored: number
    monotonicDescending: boolean
    newestTimestamp: number | null
    oldestTimestamp: number | null
}

const WORKFLOW_LABELS: Record<WorkflowKind, string> = {
    'explain-diff': 'Explain Diff',
    'review-staged': 'Review Staged',
    'draft-commit': 'Draft Commit'
}
const CHAT_WORKFLOWS: WorkflowKind[] = ['explain-diff', 'review-staged']

type ApprovalDecision = 'decline' | 'acceptForSession'

function parseApprovalDecision(value: unknown): ApprovalDecision | undefined {
    if (value === 'decline' || value === 'acceptForSession') return value
    return undefined
}

function parseApprovalPayload(payload: Record<string, unknown>, timestamp: number): AssistantApproval | null {
    const requestIdRaw = payload.requestId
    const requestId = Number(requestIdRaw)
    if (!Number.isFinite(requestId)) return null

    const method = typeof payload.method === 'string' ? payload.method : ''
    if (!method.trim()) return null

    const mode = payload.mode === 'yolo' ? 'yolo' : 'safe'
    const turnId = typeof payload.turnId === 'string' ? payload.turnId : ''
    const attemptGroupId = typeof payload.attemptGroupId === 'string' ? payload.attemptGroupId : ''
    const request = typeof payload.request === 'object' && payload.request !== null
        ? payload.request as Record<string, unknown>
        : undefined

    return {
        requestId,
        method,
        mode,
        decision: parseApprovalDecision(payload.decision),
        request,
        timestamp,
        turnId,
        attemptGroupId
    }
}

function parseApprovalDecisionPayload(
    payload: Record<string, unknown>
): { requestId: number; decision: ApprovalDecision } | null {
    const requestId = Number(payload.requestId)
    const decision = parseApprovalDecision(payload.decision)
    if (!Number.isFinite(requestId) || !decision) return null
    return { requestId, decision }
}

const INITIAL_STATUS: AssistantStatus = {
    connected: false,
    state: 'offline',
    approvalMode: 'safe',
    provider: 'codex',
    model: 'default',
    activeTurnId: null,
    lastError: null
}

export default function Assistant() {
    const { settings, updateSettings } = useSettings()
    const [status, setStatus] = useState<AssistantStatus>(INITIAL_STATUS)
    const [history, setHistory] = useState<AssistantHistoryMessage[]>([])
    const [streamingText, setStreamingText] = useState('')
    const [streamingTurnId, setStreamingTurnId] = useState<string | null>(null)
    const [isConnecting, setIsConnecting] = useState(false)
    const [isSending, setIsSending] = useState(false)
    const [errorMessage, setErrorMessage] = useState<string | null>(null)
    const [eventLog, setEventLog] = useState<AssistantEvent[]>([])
    const [showEventConsole, setShowEventConsole] = useState(settings.assistantShowEventPanel)
    const [showHeaderMenu, setShowHeaderMenu] = useState(false)
    const [showYoloConfirmModal, setShowYoloConfirmModal] = useState(false)
    const [chatProjectPath, setChatProjectPath] = useState(settings.projectsFolder || '')
    const [workflowProjectPath, setWorkflowProjectPath] = useState(settings.projectsFolder || '')
    const [workflowFilePath, setWorkflowFilePath] = useState('')
    const [workflowRunningKind, setWorkflowRunningKind] = useState<WorkflowKind | null>(null)
    const [workflowState, setWorkflowState] = useState<WorkflowState | null>(null)
    const [telemetryIntegrity, setTelemetryIntegrity] = useState<TelemetryIntegrity | null>(null)

    // Phase 04: Thoughts State
    const [reasoningByTurn, setReasoningByTurn] = useState<Record<string, AssistantReasoning[]>>({})
    const [activitiesByTurn, setActivitiesByTurn] = useState<Record<string, AssistantActivity[]>>({})
    const [approvalsByTurn, setApprovalsByTurn] = useState<Record<string, AssistantApproval[]>>({})

    // Phase 07: Sessions
    const [sessions, setSessions] = useState<AssistantSession[]>([])
    const [activeSessionId, setActiveSessionId] = useState<string | null>(null)

    // Phase 10: Profile & Model Resolution
    const normalizedChatProjectPath = chatProjectPath.trim()
    const fallbackRootPath = settings.projectsFolder.trim()
    const effectiveProjectPath = normalizedChatProjectPath || fallbackRootPath
    const activeProjectPath = effectiveProjectPath || 'global'
    const activeModel = settings.assistantProjectModels[activeProjectPath] || settings.assistantDefaultModel || 'default'
    const activeProfile = settings.assistantProjectProfiles[activeProjectPath] || settings.assistantProfile || 'safe-dev'
    const availableProjectRoots = useMemo(() => {
        const roots = [
            settings.projectsFolder,
            ...(settings.additionalFolders || [])
        ]
            .map((value) => String(value || '').trim())
            .filter(Boolean)
        return Array.from(new Set(roots))
    }, [settings.projectsFolder, settings.additionalFolders])

    const autoConnectAttemptedRef = useRef(false)
    const headerMenuRef = useRef<HTMLDivElement | null>(null)
    const chatScrollRef = useRef<HTMLDivElement | null>(null)
    const chatAutoScrollRef = useRef(true)
    const chatMessageCountRef = useRef(0)
    const chatThoughtCountRef = useRef(0)

    const connectionState = useMemo(() => {
        if (!settings.assistantEnabled) return 'disabled' as const
        if (status.state === 'connecting') return 'connecting' as const
        if (status.connected && status.state === 'ready') return 'connected' as const
        if (status.state === 'error') return 'error' as const
        return 'disconnected' as const
    }, [settings.assistantEnabled, status])

    const isBusy = Boolean(status.activeTurnId)
    const activeSessions = useMemo(
        () => sessions.filter((session) => !session.archived),
        [sessions]
    )
    const activeSessionTitle = useMemo(() => {
        const raw = sessions.find((session) => session.id === activeSessionId)?.title || ''
        const trimmed = raw.trim()
        return trimmed || 'Untitled Session'
    }, [sessions, activeSessionId])

    const groupedHistory = useMemo(() => {
        const groups: Array<{ id: string; role: 'user' | 'assistant' | 'system'; messages: AssistantHistoryMessage[] }> = []

        for (const msg of history) {
            if (msg.role === 'assistant') {
                const groupId = msg.attemptGroupId
                if (groupId) {
                    const lastGroup = groups[groups.length - 1]
                    if (lastGroup && lastGroup.role === 'assistant' && lastGroup.messages[0].attemptGroupId === groupId) {
                        lastGroup.messages.push(msg)
                        continue
                    }
                }
            }
            groups.push({ id: msg.id, role: msg.role, messages: [msg] })
        }
        return groups
    }, [history])
    const allReasoning = useMemo(
        () => Object.values(reasoningByTurn).flat(),
        [reasoningByTurn]
    )
    const allActivities = useMemo(
        () => Object.values(activitiesByTurn).flat(),
        [activitiesByTurn]
    )
    const allApprovals = useMemo(
        () => Object.values(approvalsByTurn).flat(),
        [approvalsByTurn]
    )
    const isEmptyChatState = history.length === 0 && !streamingText && !isSending && !isBusy
    const displayHistoryGroups = useMemo(() => {
        const latestThoughtTurnId = [...allReasoning, ...allActivities]
            .sort((a, b) => b.timestamp - a.timestamp)
            .find((entry) => entry.turnId)?.turnId || null
        const pendingTurnId = status.activeTurnId || streamingTurnId || latestThoughtTurnId
        if (!pendingTurnId) return groupedHistory

        const hasAssistantForPendingTurn = history.some(
            (message) => message.role === 'assistant' && message.turnId === pendingTurnId
        )
        if (hasAssistantForPendingTurn) return groupedHistory

        const hasThoughtsForPendingTurn = allReasoning.some((entry) => entry.turnId === pendingTurnId)
            || allActivities.some((entry) => entry.turnId === pendingTurnId)
            || allApprovals.some((entry) => entry.turnId === pendingTurnId)
        if (!streamingText && !hasThoughtsForPendingTurn) return groupedHistory

        return [
            ...groupedHistory,
            {
                id: `streaming-${pendingTurnId}`,
                role: 'assistant' as const,
                messages: [{
                    id: `streaming-${pendingTurnId}`,
                    role: 'assistant',
                    text: streamingText,
                    createdAt: (history[history.length - 1]?.createdAt || Date.now()) + 1,
                    turnId: pendingTurnId,
                    isActiveAttempt: true
                }]
            }
        ]
    }, [
        groupedHistory,
        history,
        streamingTurnId,
        streamingText,
        status.activeTurnId,
        allReasoning,
        allActivities,
        allApprovals
    ])

    const scrollChatToBottom = (behavior: ScrollBehavior = 'smooth') => {
        const el = chatScrollRef.current
        if (!el) return
        el.scrollTo({ top: el.scrollHeight, behavior })
    }

    const handleChatScroll = () => {
        const el = chatScrollRef.current
        if (!el) return
        const distanceFromBottom = el.scrollHeight - (el.scrollTop + el.clientHeight)
        chatAutoScrollRef.current = distanceFromBottom < 96
    }

    const loadSnapshot = async () => {
        const [statusResult, historyResult, eventsResult, sessionsResult, telemetryResult] = await Promise.all([
            window.devscope.assistant.status(),
            window.devscope.assistant.getHistory(),
            window.devscope.assistant.getEvents({ types: ['assistant-reasoning', 'assistant-activity', 'approval-request', 'approval-decision'], limit: 5000 }),
            window.devscope.assistant.listSessions(),
            window.devscope.assistant.getTelemetryIntegrity()
        ])

        if (statusResult?.success && statusResult.status) {
            setStatus(statusResult.status as AssistantStatus)
        }
        if (historyResult?.success && Array.isArray(historyResult.history)) {
            setHistory(historyResult.history as AssistantHistoryMessage[])
        }
        if (sessionsResult?.success && Array.isArray(sessionsResult.sessions)) {
            setSessions(sessionsResult.sessions as AssistantSession[])
            setActiveSessionId(sessionsResult.activeSessionId ? String(sessionsResult.activeSessionId) : null)
        }
        if (telemetryResult?.success) {
            setTelemetryIntegrity({
                eventsStored: Number(telemetryResult.eventsStored) || 0,
                monotonicDescending: Boolean(telemetryResult.monotonicDescending),
                newestTimestamp: Number.isFinite(Number(telemetryResult.newestTimestamp))
                    ? Number(telemetryResult.newestTimestamp)
                    : null,
                oldestTimestamp: Number.isFinite(Number(telemetryResult.oldestTimestamp))
                    ? Number(telemetryResult.oldestTimestamp)
                    : null
            })
        }
        if (eventsResult?.success && Array.isArray(eventsResult.events)) {
            const nextReasoning: Record<string, AssistantReasoning[]> = {}
            const nextActivities: Record<string, AssistantActivity[]> = {}
            const nextApprovals: Record<string, AssistantApproval[]> = {}

            // Group approvals by requestId first to map decisions to requests
            const reqMap = new Map<number, AssistantApproval>()
            for (const ev of eventsResult.events) {
                if (ev.type === 'approval-request') {
                    const parsed = parseApprovalPayload(ev.payload, ev.timestamp)
                    if (!parsed) continue
                    reqMap.set(parsed.requestId, parsed)
                } else if (ev.type === 'approval-decision') {
                    const parsed = parseApprovalDecisionPayload(ev.payload)
                    if (!parsed) continue
                    const existing = reqMap.get(parsed.requestId)
                    if (!existing) continue
                    existing.decision = parsed.decision
                }
            }

            for (const ev of eventsResult.events) {
                if (ev.type === 'assistant-reasoning') {
                    const r = {
                        turnId: String(ev.payload.turnId || ''),
                        attemptGroupId: String(ev.payload.attemptGroupId || ''),
                        text: String(ev.payload.text || ''),
                        method: String(ev.payload.method || ''),
                        timestamp: ev.timestamp
                    }
                    if (!nextReasoning[r.attemptGroupId]) nextReasoning[r.attemptGroupId] = []
                    nextReasoning[r.attemptGroupId].push(r)
                } else if (ev.type === 'assistant-activity') {
                    const a = {
                        turnId: String(ev.payload.turnId || ''),
                        attemptGroupId: String(ev.payload.attemptGroupId || ''),
                        kind: String(ev.payload.kind || ''),
                        summary: String(ev.payload.summary || ''),
                        method: String(ev.payload.method || ''),
                        payload: (ev.payload.payload || {}) as Record<string, unknown>,
                        timestamp: ev.timestamp
                    }
                    if (!nextActivities[a.attemptGroupId]) nextActivities[a.attemptGroupId] = []
                    nextActivities[a.attemptGroupId].push(a)
                }
            }

            for (const approval of reqMap.values()) {
                const groupId = approval.attemptGroupId || 'unknown'
                if (!nextApprovals[groupId]) nextApprovals[groupId] = []
                nextApprovals[groupId].push(approval)
            }

            // Sort arrays by timestamp
            for (const arr of Object.values(nextReasoning)) arr.sort((a, b) => a.timestamp - b.timestamp)
            for (const arr of Object.values(nextActivities)) arr.sort((a, b) => a.timestamp - b.timestamp)
            for (const arr of Object.values(nextApprovals)) arr.sort((a, b) => a.timestamp - b.timestamp)

            setReasoningByTurn(nextReasoning)
            setActivitiesByTurn(nextActivities)
            setApprovalsByTurn(nextApprovals)
        }
    }

    const handleAssistantEvent = (event: AssistantEvent) => {
        setEventLog((prev) => [event, ...prev].slice(0, 200))

        if (event.type === 'status') {
            const nextStatus = event.payload.status as AssistantStatus | undefined
            if (nextStatus) setStatus(nextStatus)
            return
        }

        if (event.type === 'history') {
            const nextHistory = event.payload.history as AssistantHistoryMessage[] | undefined
            if (Array.isArray(nextHistory)) {
                setHistory(nextHistory)
            }
            return
        }

        if (event.type === 'assistant-delta') {
            const turnId = typeof event.payload.turnId === 'string' ? event.payload.turnId : null
            const text = typeof event.payload.text === 'string' ? event.payload.text : ''
            setStreamingTurnId(turnId)
            setStreamingText(text)
            return
        }

        if (event.type === 'assistant-final') {
            // Do not clear streaming state here to prevent flicker. 
            // It will be hidden automatically when the final history event arrives.
            return
        }

        if (event.type === 'turn-cancelled' || event.type === 'turn-complete') {
            // Do not clear streaming state here to prevent flicker.
            return
        }

        if (event.type === 'workflow-status') {
            const kindRaw = typeof event.payload.workflow === 'string' ? event.payload.workflow : ''
            if (kindRaw === 'explain-diff' || kindRaw === 'review-staged' || kindRaw === 'draft-commit') {
                const statusRaw = typeof event.payload.status === 'string' ? event.payload.status : 'running'
                const status: WorkflowState['status'] = statusRaw === 'failed'
                    ? 'error'
                    : statusRaw === 'submitted'
                        ? 'success'
                        : 'running'
                const message = typeof event.payload.error === 'string' && event.payload.error.trim()
                    ? event.payload.error
                    : status === 'success'
                        ? `${WORKFLOW_LABELS[kindRaw]} submitted.`
                        : status === 'error'
                            ? `${WORKFLOW_LABELS[kindRaw]} failed.`
                            : `${WORKFLOW_LABELS[kindRaw]} is running...`
                setWorkflowState({
                    kind: kindRaw,
                    status,
                    message,
                    turnId: typeof event.payload.turnId === 'string' ? event.payload.turnId : undefined,
                    at: event.timestamp
                })
                if (status !== 'running') {
                    setWorkflowRunningKind(null)
                }
            }
            return
        }

        if (event.type === 'error') {
            const message = typeof event.payload.message === 'string'
                ? event.payload.message
                : 'Assistant request failed.'
            setErrorMessage(message)
            return
        }

        if (event.type === 'assistant-reasoning') {
            const payload = event.payload as unknown as Omit<AssistantReasoning, 'timestamp'>
            setReasoningByTurn(prev => {
                const arr = prev[payload.attemptGroupId] || []
                return {
                    ...prev,
                    [payload.attemptGroupId]: [...arr, { ...payload, timestamp: event.timestamp }]
                }
            })
            return
        }

        if (event.type === 'assistant-activity') {
            const payload = event.payload as unknown as Omit<AssistantActivity, 'timestamp'>
            setActivitiesByTurn(prev => {
                const arr = prev[payload.attemptGroupId] || []
                return {
                    ...prev,
                    [payload.attemptGroupId]: [...arr, { ...payload, timestamp: event.timestamp }]
                }
            })
            return
        }

        if (event.type === 'approval-request') {
            const parsed = parseApprovalPayload(event.payload, event.timestamp)
            if (!parsed) return
            setApprovalsByTurn(prev => {
                const groupId = parsed.attemptGroupId || 'unknown'
                const arr = prev[groupId] || []
                const index = arr.findIndex((item) => item.requestId === parsed.requestId)
                if (index >= 0) {
                    const next = [...arr]
                    next[index] = { ...next[index], ...parsed }
                    return {
                        ...prev,
                        [groupId]: next
                    }
                }
                return {
                    ...prev,
                    [groupId]: [...arr, parsed]
                }
            })
            return
        }

        if (event.type === 'approval-decision') {
            const parsed = parseApprovalDecisionPayload(event.payload)
            if (!parsed) return
            setApprovalsByTurn(prev => {
                const next = { ...prev }
                for (const groupId of Object.keys(next)) {
                    next[groupId] = next[groupId].map(a =>
                        a.requestId === parsed.requestId ? { ...a, decision: parsed.decision } : a
                    )
                }
                return next
            })
            return
        }
    }

    useEffect(() => {
        let isMounted = true
        const unsubscribe = window.devscope.assistant.onEvent((event) => {
            if (!isMounted) return
            handleAssistantEvent(event as AssistantEvent)
        })

        void loadSnapshot().catch(() => undefined)

        return () => {
            isMounted = false
            unsubscribe()
        }
    }, [])

    useEffect(() => {
        if (!settings.assistantEnabled) return
        if (!settings.assistantAutoConnectOnOpen) return
        if (autoConnectAttemptedRef.current) return
        if (status.connected || status.state === 'connecting') return

        autoConnectAttemptedRef.current = true
        void handleConnect().catch(() => undefined)
    }, [
        settings.assistantEnabled,
        settings.assistantAutoConnectOnOpen,
        status.connected,
        status.state
    ])

    useEffect(() => {
        setShowEventConsole(settings.assistantShowEventPanel)
    }, [settings.assistantShowEventPanel])

    useEffect(() => {
        if (!showEventConsole) return
        if (settings.assistantSidebarCollapsed) return
        updateSettings({ assistantSidebarCollapsed: true })
    }, [showEventConsole, settings.assistantSidebarCollapsed, updateSettings])

    useEffect(() => {
        if (!showHeaderMenu) return

        const handleWindowPointerDown = (event: MouseEvent) => {
            if (!headerMenuRef.current) return
            if (headerMenuRef.current.contains(event.target as Node)) return
            setShowHeaderMenu(false)
        }

        window.addEventListener('mousedown', handleWindowPointerDown)
        return () => window.removeEventListener('mousedown', handleWindowPointerDown)
    }, [showHeaderMenu])

    useEffect(() => {
        if (chatProjectPath.trim()) return
        if (!settings.projectsFolder.trim()) return
        setChatProjectPath(settings.projectsFolder.trim())
    }, [settings.projectsFolder, chatProjectPath])

    useEffect(() => {
        const normalizedWorkflowPath = workflowProjectPath.trim()
        const normalizedEffectivePath = effectiveProjectPath.trim()
        if (normalizedWorkflowPath === normalizedEffectivePath) return
        setWorkflowProjectPath(effectiveProjectPath)
    }, [effectiveProjectPath, workflowProjectPath])

    useEffect(() => {
        if (!streamingTurnId) return
        if (isBusy) return

        const hasAssistantForStreamingTurn = history.some(
            (message) => message.role === 'assistant' && message.turnId === streamingTurnId
        )
        if (!hasAssistantForStreamingTurn) return

        setStreamingTurnId(null)
        setStreamingText('')
    }, [history, isBusy, streamingTurnId])

    useEffect(() => {
        chatAutoScrollRef.current = true
        window.requestAnimationFrame(() => scrollChatToBottom('auto'))
    }, [activeSessionId])

    useEffect(() => {
        const visibleMessageCount = history.length + (streamingText ? 1 : 0)
        const thoughtEventCount = allReasoning.length + allActivities.length + allApprovals.length
        const hasUpdate = visibleMessageCount !== chatMessageCountRef.current
            || thoughtEventCount !== chatThoughtCountRef.current
            || Boolean(streamingText)
        if (!hasUpdate) return

        if (chatAutoScrollRef.current || isSending || isBusy) {
            window.requestAnimationFrame(() => {
                scrollChatToBottom(streamingText ? 'auto' : 'smooth')
            })
        }

        chatMessageCountRef.current = visibleMessageCount
        chatThoughtCountRef.current = thoughtEventCount
    }, [
        history.length,
        streamingText,
        isSending,
        isBusy,
        allReasoning.length,
        allActivities.length,
        allApprovals.length
    ])

    const handleConnect = async () => {
        setErrorMessage(null)
        setIsConnecting(true)
        try {
            const result = await window.devscope.assistant.connect({
                approvalMode: settings.assistantApprovalMode,
                provider: settings.assistantProvider,
                model: activeModel,
                profile: activeProfile
            })

            if (!result?.success) {
                setErrorMessage(result?.error || 'Failed to connect assistant.')
                return
            }

            if (result.status) {
                setStatus(result.status as AssistantStatus)
            }
            await loadSnapshot()
        } finally {
            setIsConnecting(false)
        }
    }

    const handleDisconnect = async () => {
        setErrorMessage(null)
        const result = await window.devscope.assistant.disconnect()
        if (!result?.success) {
            setErrorMessage(result?.error || 'Failed to disconnect assistant.')
            return
        }
        await loadSnapshot()
        setStreamingTurnId(null)
        setStreamingText('')
    }

    const handleSend = async (prompt: string, contextFiles: ComposerContextFile[]): Promise<boolean> => {
        if (!prompt || isSending || isBusy) return false

        if (!status.connected) {
            setErrorMessage('Assistant is disconnected. Connect and start first.')
            return false
        }

        chatAutoScrollRef.current = true
        window.requestAnimationFrame(() => scrollChatToBottom('smooth'))
        setErrorMessage(null)
        setIsSending(true)
        try {
            const hasAssistantReply = history.some((message) => message.role === 'assistant')
            const titleLooksAutoGenerated = /^session\s+\d+$/i.test(activeSessionTitle) || /^untitled session$/i.test(activeSessionTitle)
            const normalizedTitle = activeSessionTitle.replace(/\s+/g, ' ').trim()
            const includeThreadTitleInFirstReply = !hasAssistantReply && !titleLooksAutoGenerated && normalizedTitle.length > 0
            const firstReplyTemplate = includeThreadTitleInFirstReply
                ? [
                    '## Thread Metadata',
                    `Thread title: ${normalizedTitle}`,
                    '',
                    'For this first assistant reply in this thread:',
                    `- Start the response with this exact markdown heading: "# ${normalizedTitle}"`,
                    '- Then continue with the normal answer.'
                ].join('\n')
                : undefined

            const result = await window.devscope.assistant.send(prompt, {
                model: activeModel,
                profile: activeProfile,
                approvalMode: settings.assistantApprovalMode,
                contextFiles: contextFiles.length > 0 ? contextFiles.map(f => ({ path: f.path })) : undefined,
                projectPath: effectiveProjectPath || undefined,
                promptTemplate: firstReplyTemplate
            })

            if (!result?.success) {
                setErrorMessage(result?.error || 'Failed to send message.')
                return false
            } else {
                await loadSnapshot()
                return true
            }
        } catch (error) {
            setErrorMessage(error instanceof Error ? error.message : 'Unknown error during send.')
            return false
        } finally {
            setIsSending(false)
        }
    }

    const handleRegenerate = async (turnId: string) => {
        if (isBusy || isSending) return
        if (!status.connected) return

        chatAutoScrollRef.current = true
        window.requestAnimationFrame(() => scrollChatToBottom('smooth'))
        setErrorMessage(null)
        setIsSending(true)
        try {
            const result = await window.devscope.assistant.regenerate(turnId, {
                model: activeModel,
                profile: activeProfile,
                approvalMode: settings.assistantApprovalMode,
                projectPath: effectiveProjectPath || undefined
            })

            if (!result?.success) {
                setErrorMessage(result?.error || 'Failed to regenerate message.')
            } else {
                await loadSnapshot()
            }
        } finally {
            setIsSending(false)
        }
    }

    const handleCancelTurn = async () => {
        if (!status.activeTurnId) return
        const result = await window.devscope.assistant.cancelTurn(status.activeTurnId)
        if (!result?.success) {
            setErrorMessage(result?.error || 'Failed to cancel turn.')
        }
    }

    const handleEnableYoloMode = async () => {
        const result = await window.devscope.assistant.setApprovalMode('yolo')
        if (result?.success && result.status) {
            setStatus(result.status as AssistantStatus)
        }
        setShowYoloConfirmModal(false)
    }

    const handleSelectChatProjectPath = async () => {
        try {
            const result = await window.devscope.selectFolder()
            if (result?.success && typeof result.folderPath === 'string' && result.folderPath.trim()) {
                const nextPath = result.folderPath.trim()
                setChatProjectPath(nextPath)
                setWorkflowProjectPath(nextPath)
            }
        } catch (error) {
            setErrorMessage(error instanceof Error ? error.message : 'Failed to select chat folder path.')
        }
    }

    const handleSessionsSidebarCollapsed = (collapsed: boolean) => {
        if (!collapsed && showEventConsole) {
            setShowEventConsole(false)
            updateSettings({
                assistantSidebarCollapsed: false,
                assistantShowEventPanel: false
            })
            return
        }
        updateSettings({ assistantSidebarCollapsed: collapsed })
    }

    const handleToggleEventConsole = () => {
        const next = !showEventConsole
        setShowEventConsole(next)

        if (next && !settings.assistantSidebarCollapsed) {
            updateSettings({
                assistantShowEventPanel: true,
                assistantSidebarCollapsed: true
            })
            return
        }

        updateSettings({ assistantShowEventPanel: next })
    }

    const handleExportConversation = (format: 'markdown' | 'json') => {
        if (!history || history.length === 0) return

        let content = ''
        let filename = ''
        const sessionTitle = sessions.find(s => s.id === activeSessionId)?.title || 'session'

        if (format === 'json') {
            content = JSON.stringify(history, null, 2)
            filename = `devscope-${sessionTitle.replace(/[^a-z0-9]/gi, '_').toLowerCase()}-export.json`
        } else {
            content = history.map(m => `### ${m.role.toUpperCase()} (${new Date(m.createdAt).toLocaleString()})\n\n${m.text}\n\n---\n`).join('\n')
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
                setErrorMessage('Failed to export assistant events.')
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
            setErrorMessage(error instanceof Error ? error.message : 'Failed to export assistant events.')
        }
    }

    const handleRunWorkflow = async (kind: WorkflowKind) => {
        if (workflowRunningKind || isBusy || isSending) return
        if (kind === 'draft-commit') {
            setWorkflowState({
                kind,
                status: 'error',
                message: 'Draft Commit is disabled in chat.',
                at: Date.now()
            })
            return
        }

        const projectPath = workflowProjectPath.trim() || effectiveProjectPath
        if (!projectPath) {
            setErrorMessage('Workflow project path is required.')
            return
        }

        setErrorMessage(null)
        setWorkflowRunningKind(kind)
        setWorkflowState({
            kind,
            status: 'running',
            message: `${WORKFLOW_LABELS[kind]} is running...`,
            at: Date.now()
        })

        try {
            let result: any
            if (kind === 'explain-diff') {
                result = await window.devscope.assistant.runWorkflowExplainDiff(
                    projectPath,
                    workflowFilePath.trim() || undefined,
                    activeModel
                )
            } else if (kind === 'review-staged') {
                result = await window.devscope.assistant.runWorkflowReviewStaged(projectPath, activeModel)
            } else {
                result = await window.devscope.assistant.runWorkflowDraftCommit(projectPath, activeModel)
            }

            if (result?.success) {
                setWorkflowState({
                    kind,
                    status: 'success',
                    message: `${WORKFLOW_LABELS[kind]} queued successfully.`,
                    turnId: typeof result.turnId === 'string' ? result.turnId : undefined,
                    at: Date.now()
                })
                await loadSnapshot()
            } else {
                const message = result?.error || `${WORKFLOW_LABELS[kind]} failed.`
                setWorkflowState({
                    kind,
                    status: 'error',
                    message,
                    at: Date.now()
                })
                setErrorMessage(message)
            }
        } catch (error) {
            const message = error instanceof Error ? error.message : `${WORKFLOW_LABELS[kind]} failed.`
            setWorkflowState({
                kind,
                status: 'error',
                message,
                at: Date.now()
            })
            setErrorMessage(message)
        } finally {
            setWorkflowRunningKind(null)
        }
    }

    const handleClearHistory = async () => {
        const result = await window.devscope.assistant.clearHistory()
        if (!result?.success) {
            setErrorMessage(result?.error || 'Failed to clear chat history.')
            return
        }
        setHistory([])
        setStreamingText('')
        setStreamingTurnId(null)
    }

    return (

        <div className="h-full flex flex-col animate-fadeIn">
            {settings.assistantEnabled && (errorMessage || connectionState === 'error' || connectionState === 'disconnected') && (
                <div className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
                    <div className="flex items-center gap-2">
                        <XCircle size={16} className="shrink-0 text-amber-400" />
                        <div>
                            <span className="font-semibold text-amber-400 mr-2">Connection Issue:</span>
                            <span className="opacity-90">{errorMessage || 'The assistant background process disconnected.'}</span>
                        </div>
                    </div>
                    <button
                        onClick={() => void handleConnect()}
                        disabled={isConnecting}
                        className={cn(
                            "px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors border",
                            isConnecting
                                ? "bg-amber-500/10 border-amber-500/20 text-amber-500/50 cursor-not-allowed"
                                : "bg-amber-500/20 border-amber-500/40 text-amber-100 hover:bg-amber-500/30 hover:border-amber-500/60 shadow-sm"
                        )}
                    >
                        {isConnecting ? 'Reconnecting...' : 'Reconnect Now'}
                    </button>
                </div>
            )}

            {!settings.assistantEnabled ? (
                <div className="flex-1 rounded-2xl border border-dashed border-sparkle-border bg-sparkle-card/60 flex items-center justify-center p-8">
                    <div className="max-w-xl text-center">
                        <div className="mx-auto w-12 h-12 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center mb-4">
                            <PlugZap className="text-indigo-300" size={24} />
                        </div>
                        <h2 className="text-xl font-semibold text-sparkle-text mb-2">Assistant is turned off</h2>
                        <p className="text-sm text-sparkle-text-secondary mb-5">
                            Enable Assistant in settings, choose your defaults, then come back here to connect and start a session.
                        </p>
                        <Link
                            to="/settings/assistant"
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--accent-primary)] text-white hover:bg-[var(--accent-primary)]/85 transition-colors"
                        >
                            <Settings2 size={16} />
                            Open Assistant Settings
                        </Link>
                    </div>
                </div>
            ) : (
                <div className="flex-1 min-h-0 overflow-hidden">
                    <div className="h-full flex">
                        <AssistantSessionsSidebar
                            collapsed={settings.assistantSidebarCollapsed}
                            width={Number(settings.assistantSidebarWidth) || 320}
                            sessions={activeSessions.map((session) => ({
                                id: session.id,
                                title: session.title,
                                updatedAt: session.updatedAt
                            }))}
                            activeSessionId={activeSessionId}
                            onSetCollapsed={handleSessionsSidebarCollapsed}
                            onCreateSession={async () => {
                                await window.devscope.assistant.createSession()
                                await loadSnapshot()
                            }}
                            onSelectSession={async (sessionId) => {
                                await window.devscope.assistant.selectSession(sessionId)
                                await loadSnapshot()
                            }}
                            onRenameSession={async (sessionId, nextTitle) => {
                                await window.devscope.assistant.renameSession(sessionId, nextTitle)
                                await loadSnapshot()
                            }}
                            onArchiveSession={async (sessionId) => {
                                await window.devscope.assistant.archiveSession(sessionId, true)
                                await loadSnapshot()
                            }}
                            onDeleteSession={async (sessionId) => {
                                await window.devscope.assistant.deleteSession(sessionId)
                                await loadSnapshot()
                            }}
                        />

                        <div className="flex-1 flex min-w-0">
                            <section className={cn('flex min-w-0 flex-1 flex-col transition-all duration-300', showEventConsole && 'border-r border-sparkle-border')}>
                                <div className="flex items-center justify-between gap-3 border-b border-sparkle-border bg-sparkle-card px-4 py-2.5">
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-2">
                                            <MessageSquare size={15} className="text-sparkle-text-secondary" />
                                            <h2 className="text-sm font-semibold text-sparkle-text">Conversation</h2>
                                        </div>
                                        <div className="mt-1 flex flex-wrap items-center gap-1.5">
                                            <span className="rounded-full border border-sparkle-border bg-sparkle-bg px-2 py-0.5 text-[10px] text-sparkle-text-secondary">
                                                Thread <strong className="inline-block max-w-[24ch] truncate align-bottom">{activeSessionTitle}</strong>
                                            </span>
                                            <span className="rounded-full border border-sparkle-border bg-sparkle-bg px-2 py-0.5 text-[10px] text-sparkle-text-secondary">
                                                Turn <strong>{isBusy ? 'running' : 'idle'}</strong>
                                            </span>
                                            <span
                                                className="max-w-[56ch] rounded-full border border-sparkle-border bg-sparkle-bg px-2 py-0.5 text-[10px] text-sparkle-text-secondary"
                                                title={effectiveProjectPath || 'No chat path selected'}
                                            >
                                                Path <strong className="inline-block max-w-[42ch] truncate align-bottom">{effectiveProjectPath || 'not set'}</strong>
                                            </span>
                                        </div>
                                    </div>
                                    <div className="relative flex items-center gap-2" ref={headerMenuRef}>
                                        <button
                                            type="button"
                                            onClick={() => void handleSelectChatProjectPath()}
                                            className="p-1.5 rounded-lg border border-sparkle-border text-sparkle-text-secondary hover:bg-sparkle-card-hover transition-colors"
                                            title="Choose chat path"
                                        >
                                            <FolderOpen size={14} />
                                        </button>

                                        <div className="inline-flex rounded-md border border-sparkle-border bg-sparkle-bg p-0.5">
                                            <button
                                                onClick={() => {
                                                    if (status.approvalMode === 'safe') return
                                                    void window.devscope.assistant.setApprovalMode('safe').then((res) => {
                                                        if (res?.success && res.status) setStatus(res.status as AssistantStatus)
                                                    })
                                                }}
                                                className={cn(
                                                    'p-1.5 rounded transition-colors',
                                                    status.approvalMode === 'safe'
                                                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/35'
                                                        : 'text-sparkle-text-secondary hover:text-sparkle-text hover:bg-sparkle-card-hover'
                                                )}
                                                title="Safe approval mode"
                                            >
                                                <Shield size={13} />
                                            </button>
                                            <button
                                                onClick={() => {
                                                    if (status.approvalMode === 'yolo') return
                                                    setShowYoloConfirmModal(true)
                                                }}
                                                className={cn(
                                                    'p-1.5 rounded transition-colors',
                                                    status.approvalMode === 'yolo'
                                                        ? 'bg-amber-500/20 text-amber-400 border border-amber-500/35'
                                                        : 'text-sparkle-text-secondary hover:text-sparkle-text hover:bg-sparkle-card-hover'
                                                )}
                                                title="YOLO approval mode"
                                            >
                                                <Zap size={13} />
                                            </button>
                                        </div>

                                        {connectionState === 'connected' && (
                                            <button
                                                type="button"
                                                onClick={async () => {
                                                    await window.devscope.assistant.newThread()
                                                    await loadSnapshot()
                                                }}
                                                className="p-1.5 rounded-lg border border-sparkle-border text-sparkle-text-secondary hover:bg-sparkle-card-hover transition-colors"
                                                title="New thread"
                                            >
                                                <MessageSquarePlus size={14} />
                                            </button>
                                        )}

                                        <button
                                            type="button"
                                            onClick={handleToggleEventConsole}
                                            className={cn(
                                                "p-1.5 rounded-lg border transition-colors",
                                                showEventConsole
                                                    ? "border-cyan-400/50 bg-cyan-500/15 text-cyan-300 shadow-[0_0_0_1px_rgba(34,211,238,0.22)]"
                                                    : "border-sparkle-border hover:bg-sparkle-card-hover text-sparkle-text-secondary"
                                            )}
                                            title="Toggle Event Console"
                                        >
                                            <Terminal size={14} />
                                        </button>

                                        {isBusy && (
                                            <button
                                                type="button"
                                                onClick={handleCancelTurn}
                                                className="p-1.5 rounded-lg border border-amber-500/40 text-amber-300 bg-amber-500/10 hover:bg-amber-500/15 transition-colors"
                                                title="Cancel active turn"
                                            >
                                                <XCircle size={14} />
                                            </button>
                                        )}

                                        <button
                                            type="button"
                                            onClick={() => {
                                                if (connectionState === 'connected') {
                                                    void handleDisconnect()
                                                } else {
                                                    void handleConnect()
                                                }
                                            }}
                                            disabled={isConnecting}
                                            className={cn(
                                                'p-1.5 rounded-lg border transition-colors disabled:opacity-60',
                                                connectionState === 'connected'
                                                    ? 'border-emerald-500/40 text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/15'
                                                    : 'border-sparkle-border text-sparkle-text-secondary hover:bg-sparkle-card-hover'
                                            )}
                                            title={connectionState === 'connected' ? 'Disconnect assistant' : 'Connect assistant'}
                                        >
                                            <PlugZap size={14} />
                                        </button>

                                        <button
                                            type="button"
                                            onClick={() => setShowHeaderMenu((prev) => !prev)}
                                            className="p-1.5 rounded-lg border border-sparkle-border text-sparkle-text-secondary hover:bg-sparkle-card-hover transition-colors"
                                            title="More actions"
                                        >
                                            <MoreHorizontal size={14} />
                                        </button>

                                        {showHeaderMenu && (
                                            <div className="absolute right-0 top-full z-20 mt-2 w-52 rounded-lg border border-sparkle-border bg-sparkle-card p-1 shadow-lg">
                                                {connectionState === 'connected' && (
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            handleExportConversation('markdown')
                                                            setShowHeaderMenu(false)
                                                        }}
                                                        className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-xs text-sparkle-text-secondary hover:bg-sparkle-card-hover hover:text-sparkle-text transition-colors"
                                                    >
                                                        <Download size={13} />
                                                        Export Markdown
                                                    </button>
                                                )}
                                                {connectionState === 'connected' && (
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            handleExportConversation('json')
                                                            setShowHeaderMenu(false)
                                                        }}
                                                        className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-xs text-sparkle-text-secondary hover:bg-sparkle-card-hover hover:text-sparkle-text transition-colors"
                                                    >
                                                        <Download size={13} />
                                                        Export JSON
                                                    </button>
                                                )}
                                                <button
                                                    type="button"
                                                    onClick={async () => {
                                                        await handleClearHistory()
                                                        setShowHeaderMenu(false)
                                                    }}
                                                    className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-xs text-amber-300 hover:bg-amber-500/10 transition-colors"
                                                >
                                                    <Trash2 size={13} />
                                                    Clear Chat
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div
                                    ref={chatScrollRef}
                                    onScroll={handleChatScroll}
                                    className="flex-1 overflow-y-auto bg-sparkle-bg px-4 py-3"
                                >
                                    <div className={cn(
                                        "flex min-h-full w-full flex-col gap-3",
                                        isEmptyChatState ? "justify-center pb-0" : "justify-end pb-8"
                                    )}>
                                        <div className={cn("space-y-3", isEmptyChatState ? "pb-0" : "pb-4")}>
                                            {displayHistoryGroups.map((group) => {
                                                if (group.role === 'assistant') {
                                                    return (
                                                        <div key={group.id} className="w-full">
                                                            <AssistantMessage
                                                                attempts={group.messages}
                                                                onRegenerate={handleRegenerate}
                                                                isBusy={isBusy || isSending}
                                                                streamingTurnId={streamingTurnId}
                                                                streamingText={streamingText}
                                                                reasoning={allReasoning}
                                                                activities={allActivities}
                                                                approvals={allApprovals}
                                                            />
                                                        </div>
                                                    )
                                                }

                                                const message = group.messages[0]
                                                return (
                                                    <div key={message.id} className={cn('flex animate-fadeIn', message.role === 'user' ? 'justify-end' : 'justify-start')}>
                                                        <div
                                                            className={cn(
                                                                'inline-block w-fit max-w-[76%] whitespace-pre-wrap rounded-2xl border px-4 py-2.5 text-[14px] leading-6 shadow-sm',
                                                                message.role === 'user'
                                                                    ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)] text-white rounded-br-lg'
                                                                    : 'border-sparkle-border bg-sparkle-card text-xs text-sparkle-text-muted'
                                                            )}
                                                        >
                                                            {message.text}
                                                        </div>
                                                    </div>
                                                )
                                            })}

                                            {isEmptyChatState && (
                                                <div className="mx-auto w-full max-w-[560px] rounded-2xl border border-sparkle-border bg-sparkle-card/80 px-6 py-6 text-center">
                                                    <div className="mx-auto mb-3 inline-flex h-11 w-11 items-center justify-center rounded-xl border border-sparkle-border bg-sparkle-bg text-[var(--accent-primary)]">
                                                        <MessageSquarePlus size={20} />
                                                    </div>
                                                    <h3 className="text-base font-semibold text-sparkle-text">Start a new chat</h3>
                                                    <p className="mt-2 text-sm text-sparkle-text-secondary">
                                                        Ask for code changes, reviews, or repository analysis. Thoughts and actions will appear automatically per reply.
                                                    </p>
                                                    <div className="mt-4 rounded-xl border border-sparkle-border bg-sparkle-bg/80 p-3 text-left">
                                                        <div className="mb-2 flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-sparkle-text-secondary">
                                                            <FolderOpen size={12} />
                                                            <span>Chat Path</span>
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <input
                                                                type="text"
                                                                value={chatProjectPath}
                                                                onChange={(event) => setChatProjectPath(event.target.value)}
                                                                placeholder={settings.projectsFolder || 'Select a folder path for this chat'}
                                                                className="h-9 flex-1 rounded-lg border border-sparkle-border bg-sparkle-card px-3 text-xs text-sparkle-text placeholder:text-sparkle-text-muted/70 focus:border-[var(--accent-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]/20"
                                                            />
                                                            <button
                                                                type="button"
                                                                onClick={() => void handleSelectChatProjectPath()}
                                                                className="h-9 rounded-lg border border-sparkle-border bg-sparkle-card px-3 text-xs font-medium text-sparkle-text-secondary transition-colors hover:bg-sparkle-card-hover hover:text-sparkle-text"
                                                            >
                                                                Browse
                                                            </button>
                                                        </div>
                                                        {availableProjectRoots.length > 0 && (
                                                            <div className="mt-2 flex flex-wrap gap-1.5">
                                                                {availableProjectRoots.map((rootPath) => (
                                                                    <button
                                                                        key={rootPath}
                                                                        type="button"
                                                                        onClick={() => setChatProjectPath(rootPath)}
                                                                        className={cn(
                                                                            'max-w-full truncate rounded-md border px-2.5 py-1 text-[11px] transition-colors',
                                                                            rootPath === effectiveProjectPath
                                                                                ? 'border-[var(--accent-primary)]/50 bg-[var(--accent-primary)]/15 text-sparkle-text'
                                                                                : 'border-sparkle-border bg-sparkle-card text-sparkle-text-secondary hover:bg-sparkle-card-hover hover:text-sparkle-text'
                                                                        )}
                                                                        title={rootPath}
                                                                    >
                                                                        {rootPath}
                                                                    </button>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                    </div>
                                </div>

                                <div className="border-t border-sparkle-border bg-sparkle-card px-4 py-3">
                                    <AssistantComposer
                                        onSend={handleSend}
                                        disabled={isBusy}
                                        isSending={isSending}
                                        isThinking={isSending || isBusy}
                                        isConnected={status.connected}
                                    />
                                </div>
                            </section>
                            <aside
                                aria-hidden={!showEventConsole}
                                className={cn(
                                    'shrink-0 overflow-hidden bg-sparkle-bg transition-all duration-300 ease-out',
                                    showEventConsole
                                        ? 'w-[430px] opacity-100 translate-x-0 border-l border-sparkle-border'
                                        : 'w-0 opacity-0 translate-x-4 pointer-events-none border-l border-transparent'
                                )}
                            >
                                <div className="h-full w-[430px]">
                                    <AssistantEventConsole
                                        events={eventLog}
                                        onClear={async () => {
                                            const result = await window.devscope.assistant.clearEvents()
                                            if (!result?.success) {
                                                setErrorMessage('Failed to clear assistant events.')
                                                return
                                            }
                                            setEventLog([])
                                        }}
                                        onExport={() => void handleExportEvents()}
                                    />
                                </div>
                            </aside>
                        </div>
                    </div>
                </div>
            )}
            {showYoloConfirmModal && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md animate-fadeIn"
                    onClick={() => setShowYoloConfirmModal(false)}
                >
                    <div
                        className="w-full max-w-md rounded-2xl border border-amber-500/30 bg-sparkle-card p-6 shadow-2xl"
                        onClick={(event) => event.stopPropagation()}
                    >
                        <h3 className="text-base font-semibold text-sparkle-text">Enable YOLO mode?</h3>
                        <p className="mt-2 text-sm text-sparkle-text-secondary">
                            YOLO mode allows the AI to execute commands and modify files without asking for permission in this session.
                        </p>
                        <div className="mt-5 flex items-center justify-end gap-2">
                            <button
                                type="button"
                                onClick={() => setShowYoloConfirmModal(false)}
                                className="rounded-lg border border-sparkle-border px-3 py-1.5 text-sm text-sparkle-text-secondary transition-colors hover:bg-sparkle-card-hover hover:text-sparkle-text"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={() => void handleEnableYoloMode()}
                                className="rounded-lg border border-amber-500/40 bg-amber-500/15 px-3 py-1.5 text-sm text-amber-200 transition-colors hover:bg-amber-500/25"
                            >
                                Enable YOLO
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

