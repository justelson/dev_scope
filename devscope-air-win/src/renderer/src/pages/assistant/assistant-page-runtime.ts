import type {
    AssistantActivity,
    AssistantApproval,
    AssistantEvent,
    AssistantHistoryMessage,
    AssistantReasoning,
    AssistantSession,
    AssistantStatus,
    WorkflowState
} from './assistant-page-types'
import type { MutableRefObject } from 'react'
import {
    WORKFLOW_LABELS,
    buildSessionScope,
    isTelemetryEventInScope,
    parseApprovalDecisionPayload,
    parseApprovalPayload
} from './assistant-page-types'

type RuntimeDeps = {
    getStreamingTurnId: () => string | null
    scopeRef: MutableRefObject<{ turnIds: Set<string>; attemptGroupIds: Set<string> }>
    setIsChatHydrating: (value: boolean) => void
    setStatus: (status: AssistantStatus) => void
    setHistory: (history: AssistantHistoryMessage[]) => void
    setSessions: (updater: AssistantSession[] | ((prev: AssistantSession[]) => AssistantSession[])) => void
    setActiveSessionId: (value: string | null) => void
    setTelemetryIntegrity: (value: any) => void
    setReasoningByTurn: (value: any) => void
    setActivitiesByTurn: (value: any) => void
    setApprovalsByTurn: (value: any) => void
    setEventLog: (updater: (prev: AssistantEvent[]) => AssistantEvent[]) => void
    setStreamingTurnId: (value: string | null) => void
    setStreamingText: (value: string) => void
    setWorkflowState: (value: WorkflowState | null) => void
    setWorkflowRunningKind: (value: any) => void
    setErrorMessage: (value: string | null) => void
}

export function createLoadSnapshot(deps: RuntimeDeps) {
    return async (options?: { hydrateChat?: boolean }) => {
        const hydrateChat = options?.hydrateChat === true
        if (hydrateChat) deps.setIsChatHydrating(true)

        try {
            const [statusResult, historyResult, eventsResult, sessionsResult, telemetryResult] = await Promise.all([
                window.devscope.assistant.status(),
                window.devscope.assistant.getHistory(),
                window.devscope.assistant.getEvents({ types: ['assistant-reasoning', 'assistant-activity', 'approval-request', 'approval-decision'], limit: 5000 }),
                window.devscope.assistant.listSessions(),
                window.devscope.assistant.getTelemetryIntegrity()
            ])

            if (statusResult?.success && statusResult.status) {
                deps.setStatus(statusResult.status as AssistantStatus)
            }
            const snapshotHistory = historyResult?.success && Array.isArray(historyResult.history)
                ? historyResult.history as AssistantHistoryMessage[]
                : []
            deps.setHistory(snapshotHistory)

            const snapshotScope = buildSessionScope(
                snapshotHistory,
                statusResult?.status?.activeTurnId || null,
                deps.getStreamingTurnId()
            )
            deps.scopeRef.current = snapshotScope

            if (sessionsResult?.success && Array.isArray(sessionsResult.sessions)) {
                const normalizedSessions = sessionsResult.sessions.map((session: any) => ({
                    id: String(session?.id || ''),
                    title: String(session?.title || ''),
                    archived: Boolean(session?.archived),
                    createdAt: Number(session?.createdAt) || Date.now(),
                    updatedAt: Number(session?.updatedAt) || Date.now(),
                    messageCount: Number(session?.messageCount) || 0,
                    projectPath: typeof session?.projectPath === 'string' ? session.projectPath : ''
                })) as AssistantSession[]
                deps.setSessions(normalizedSessions)
                deps.setActiveSessionId(sessionsResult.activeSessionId ? String(sessionsResult.activeSessionId) : null)
            }

            if (telemetryResult?.success) {
                deps.setTelemetryIntegrity({
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
                        if (!isTelemetryEventInScope(ev.payload, snapshotScope)) continue
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
                        if (!isTelemetryEventInScope(ev.payload, snapshotScope)) continue
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
                    if (!isTelemetryEventInScope(approval as unknown as Record<string, unknown>, snapshotScope)) continue
                    const groupId = approval.attemptGroupId || 'unknown'
                    if (!nextApprovals[groupId]) nextApprovals[groupId] = []
                    nextApprovals[groupId].push(approval)
                }

                for (const arr of Object.values(nextReasoning)) arr.sort((a, b) => a.timestamp - b.timestamp)
                for (const arr of Object.values(nextActivities)) arr.sort((a, b) => a.timestamp - b.timestamp)
                for (const arr of Object.values(nextApprovals)) arr.sort((a, b) => a.timestamp - b.timestamp)

                deps.setReasoningByTurn(nextReasoning)
                deps.setActivitiesByTurn(nextActivities)
                deps.setApprovalsByTurn(nextApprovals)
            }
        } finally {
            if (hydrateChat) deps.setIsChatHydrating(false)
        }
    }
}

export function createAssistantEventHandler(deps: RuntimeDeps) {
    return (event: AssistantEvent) => {
        deps.setEventLog((prev) => [event, ...prev].slice(0, 200))

        if (event.type === 'status') {
            const nextStatus = event.payload.status as AssistantStatus | undefined
            if (nextStatus) deps.setStatus(nextStatus)
            return
        }
        if (event.type === 'history') {
            const nextHistory = event.payload.history as AssistantHistoryMessage[] | undefined
            if (Array.isArray(nextHistory)) deps.setHistory(nextHistory)
            void window.devscope.assistant.listSessions().then((sessionsResult) => {
                if (!sessionsResult?.success || !Array.isArray(sessionsResult.sessions)) return
                const normalizedSessions = sessionsResult.sessions.map((session: any) => ({
                    id: String(session?.id || ''),
                    title: String(session?.title || ''),
                    archived: Boolean(session?.archived),
                    createdAt: Number(session?.createdAt) || Date.now(),
                    updatedAt: Number(session?.updatedAt) || Date.now(),
                    messageCount: Number(session?.messageCount) || 0,
                    projectPath: typeof session?.projectPath === 'string' ? session.projectPath : ''
                })) as AssistantSession[]
                deps.setSessions(normalizedSessions)
                deps.setActiveSessionId(sessionsResult.activeSessionId ? String(sessionsResult.activeSessionId) : null)
            }).catch(() => undefined)
            return
        }
        if (event.type === 'assistant-delta') {
            const turnId = typeof event.payload.turnId === 'string' ? event.payload.turnId : null
            const text = typeof event.payload.text === 'string' ? event.payload.text : ''
            deps.setStreamingTurnId(turnId)
            deps.setStreamingText(text)
            return
        }
        if (event.type === 'assistant-final') return
        if (event.type === 'turn-cancelled' || event.type === 'turn-complete') return

        if (event.type === 'workflow-status') {
            const kindRaw = typeof event.payload.workflow === 'string' ? event.payload.workflow : ''
            if (kindRaw === 'explain-diff' || kindRaw === 'review-staged' || kindRaw === 'draft-commit') {
                const statusRaw = typeof event.payload.status === 'string' ? event.payload.status : 'running'
                const workflowStatus: WorkflowState['status'] = statusRaw === 'failed'
                    ? 'error'
                    : statusRaw === 'submitted' ? 'success' : 'running'
                const message = typeof event.payload.error === 'string' && event.payload.error.trim()
                    ? event.payload.error
                    : workflowStatus === 'success'
                        ? `${WORKFLOW_LABELS[kindRaw]} submitted.`
                        : workflowStatus === 'error'
                            ? `${WORKFLOW_LABELS[kindRaw]} failed.`
                            : `${WORKFLOW_LABELS[kindRaw]} is running...`
                deps.setWorkflowState({
                    kind: kindRaw,
                    status: workflowStatus,
                    message,
                    turnId: typeof event.payload.turnId === 'string' ? event.payload.turnId : undefined,
                    at: event.timestamp
                })
                if (workflowStatus !== 'running') deps.setWorkflowRunningKind(null)
            }
            return
        }
        if (event.type === 'error') {
            const message = typeof event.payload.message === 'string'
                ? event.payload.message
                : 'Assistant request failed.'
            deps.setErrorMessage(message)
            return
        }

        if (event.type === 'assistant-reasoning') {
            if (!isTelemetryEventInScope(event.payload, deps.scopeRef.current)) return
            const payload = event.payload as unknown as Omit<AssistantReasoning, 'timestamp'>
            deps.setReasoningByTurn((prev: Record<string, AssistantReasoning[]>) => {
                const arr = prev[payload.attemptGroupId] || []
                return {
                    ...prev,
                    [payload.attemptGroupId]: [...arr, { ...payload, timestamp: event.timestamp }]
                }
            })
            return
        }

        if (event.type === 'assistant-activity') {
            if (!isTelemetryEventInScope(event.payload, deps.scopeRef.current)) return
            const payload = event.payload as unknown as Omit<AssistantActivity, 'timestamp'>
            deps.setActivitiesByTurn((prev: Record<string, AssistantActivity[]>) => {
                const arr = prev[payload.attemptGroupId] || []
                return {
                    ...prev,
                    [payload.attemptGroupId]: [...arr, { ...payload, timestamp: event.timestamp }]
                }
            })
            return
        }

        if (event.type === 'approval-request') {
            if (!isTelemetryEventInScope(event.payload, deps.scopeRef.current)) return
            const parsed = parseApprovalPayload(event.payload, event.timestamp)
            if (!parsed) return
            deps.setApprovalsByTurn((prev: Record<string, AssistantApproval[]>) => {
                const groupId = parsed.attemptGroupId || 'unknown'
                const arr = prev[groupId] || []
                const index = arr.findIndex((item) => item.requestId === parsed.requestId)
                if (index >= 0) {
                    const next = [...arr]
                    next[index] = { ...next[index], ...parsed }
                    return { ...prev, [groupId]: next }
                }
                return { ...prev, [groupId]: [...arr, parsed] }
            })
            return
        }

        if (event.type === 'approval-decision') {
            const parsed = parseApprovalDecisionPayload(event.payload)
            if (!parsed) return
            deps.setApprovalsByTurn((prev: Record<string, AssistantApproval[]>) => {
                const next = { ...prev }
                for (const groupId of Object.keys(next)) {
                    next[groupId] = next[groupId].map((a) =>
                        a.requestId === parsed.requestId ? { ...a, decision: parsed.decision } : a
                    )
                }
                return next
            })
        }
    }
}
