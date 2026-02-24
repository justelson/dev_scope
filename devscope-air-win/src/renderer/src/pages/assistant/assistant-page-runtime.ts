import type {
    AssistantActivity,
    AssistantApproval,
    AssistantEvent,
    AssistantHistoryAttachment,
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
import { toDisplayText, toDisplayTextTrimmed } from './assistant-text-utils'

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

const LIVE_PREVIEW_REASONING_METHOD = 'assistant-live-preview'
const MAX_REASONING_PER_ATTEMPT = 100
const MAX_ACTIVITIES_PER_ATTEMPT = 120
const ACTIVITY_MERGE_WINDOW_MS = 6_000

function normalizeRole(value: unknown): AssistantHistoryMessage['role'] {
    if (value === 'assistant' || value === 'user' || value === 'system') return value
    return 'system'
}

function normalizeAttachmentKind(value: unknown): AssistantHistoryAttachment['kind'] | undefined {
    const normalized = toDisplayTextTrimmed(value).toLowerCase()
    if (normalized === 'image' || normalized === 'doc' || normalized === 'code' || normalized === 'file') {
        return normalized
    }
    return undefined
}

function normalizeHistoryMessages(historyRaw: unknown[]): AssistantHistoryMessage[] {
    return historyRaw.map((rawEntry, index) => {
        const entry = (rawEntry && typeof rawEntry === 'object')
            ? rawEntry as Record<string, unknown>
            : {}
        const attachmentsRaw = Array.isArray(entry.attachments) ? entry.attachments : []
        const attachments = attachmentsRaw
            .map((rawAttachment): AssistantHistoryAttachment | null => {
                if (!rawAttachment || typeof rawAttachment !== 'object') return null
                const attachment = rawAttachment as Record<string, unknown>
                const path = toDisplayTextTrimmed(attachment.path)
                if (!path) return null
                const sizeBytesRaw = Number(attachment.sizeBytes)
                const normalized: AssistantHistoryAttachment = {
                    path,
                    kind: normalizeAttachmentKind(attachment.kind)
                }
                const name = toDisplayTextTrimmed(attachment.name)
                const mimeType = toDisplayTextTrimmed(attachment.mimeType)
                const previewText = toDisplayText(attachment.previewText)
                const previewDataUrl = toDisplayTextTrimmed(attachment.previewDataUrl)
                const textPreview = toDisplayText(attachment.textPreview)
                if (name) normalized.name = name
                if (mimeType) normalized.mimeType = mimeType
                if (Number.isFinite(sizeBytesRaw)) normalized.sizeBytes = sizeBytesRaw
                if (previewText) normalized.previewText = previewText
                if (previewDataUrl) normalized.previewDataUrl = previewDataUrl
                if (textPreview) normalized.textPreview = textPreview
                return normalized
            })
            .filter((item): item is AssistantHistoryAttachment => Boolean(item))

        return {
            id: toDisplayTextTrimmed(entry.id) || `history-${index + 1}`,
            role: normalizeRole(entry.role),
            text: toDisplayText(entry.text),
            attachments: attachments.length > 0 ? attachments : undefined,
            sourcePrompt: toDisplayText(entry.sourcePrompt) || undefined,
            reasoningText: toDisplayText(entry.reasoningText) || undefined,
            createdAt: Number.isFinite(Number(entry.createdAt)) ? Number(entry.createdAt) : Date.now(),
            turnId: toDisplayTextTrimmed(entry.turnId) || undefined,
            attemptGroupId: toDisplayTextTrimmed(entry.attemptGroupId) || undefined,
            attemptIndex: Number.isFinite(Number(entry.attemptIndex)) ? Number(entry.attemptIndex) : undefined,
            isActiveAttempt: typeof entry.isActiveAttempt === 'boolean' ? entry.isActiveAttempt : undefined
        }
    })
}

function stripLivePreviewReasoning(
    source: Record<string, AssistantReasoning[]>,
    turnId?: string | null
): Record<string, AssistantReasoning[]> {
    const targetTurnId = typeof turnId === 'string' ? turnId.trim() : ''
    let changed = false
    const next: Record<string, AssistantReasoning[]> = {}

    for (const [groupId, entries] of Object.entries(source)) {
        const filtered = entries.filter((entry) => {
            if (entry.method !== LIVE_PREVIEW_REASONING_METHOD) return true
            if (!targetTurnId) return false
            return entry.turnId !== targetTurnId
        })
        if (filtered.length !== entries.length) changed = true
        if (filtered.length > 0) next[groupId] = filtered
    }

    return changed ? next : source
}

function appendCappedActivity(
    entries: AssistantActivity[],
    nextEntry: AssistantActivity
): AssistantActivity[] {
    const previous = entries[entries.length - 1]
    if (previous && shouldMergeActivities(previous, nextEntry)) {
        const previousCount = readActivityUpdateCount(previous)
        const nextCount = readActivityUpdateCount(nextEntry)
        const merged: AssistantActivity = {
            ...nextEntry,
            summary: nextEntry.summary || previous.summary,
            payload: {
                ...(previous.payload || {}),
                ...(nextEntry.payload || {}),
                updateCount: previousCount + nextCount
            }
        }
        return [...entries.slice(0, -1), merged]
    }

    const next = [...entries, nextEntry]
    if (next.length <= MAX_ACTIVITIES_PER_ATTEMPT) return next
    return next.slice(next.length - MAX_ACTIVITIES_PER_ATTEMPT)
}

function readActivityUpdateCount(entry: AssistantActivity): number {
    const value = Number((entry.payload || {}).updateCount)
    if (!Number.isFinite(value) || value < 1) return 1
    return Math.floor(value)
}

function normalizeActivityMergeKey(value: string): string {
    return String(value || '').trim().replace(/\s+/g, ' ').toLowerCase()
}

function shouldMergeActivities(previous: AssistantActivity, nextEntry: AssistantActivity): boolean {
    if (nextEntry.timestamp - previous.timestamp > ACTIVITY_MERGE_WINDOW_MS) return false
    if (normalizeActivityMergeKey(previous.kind) !== normalizeActivityMergeKey(nextEntry.kind)) return false

    const previousMethod = normalizeActivityMergeKey(previous.method)
    const nextMethod = normalizeActivityMergeKey(nextEntry.method)
    if (previousMethod !== nextMethod) return false

    const previousSummary = normalizeActivityMergeKey(previous.summary)
    const nextSummary = normalizeActivityMergeKey(nextEntry.summary)
    return previousSummary === nextSummary
}

function appendCappedReasoning(
    entries: AssistantReasoning[],
    nextEntry: AssistantReasoning
): AssistantReasoning[] {
    const next = [...entries, nextEntry]
    if (next.length <= MAX_REASONING_PER_ATTEMPT) return next
    return next.slice(next.length - MAX_REASONING_PER_ATTEMPT)
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
            const activeTurnId = statusResult?.success ? statusResult.status?.activeTurnId || null : null
            const snapshotHistory = historyResult?.success && Array.isArray(historyResult.history)
                ? normalizeHistoryMessages(historyResult.history as unknown[])
                : []
            deps.setHistory(snapshotHistory)

            const snapshotScope = buildSessionScope(
                snapshotHistory,
                activeTurnId,
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
                        const turnId = toDisplayTextTrimmed(ev.payload.turnId)
                        const attemptGroupId = toDisplayTextTrimmed(ev.payload.attemptGroupId) || turnId || 'unknown'
                        const r = {
                            turnId,
                            attemptGroupId,
                            text: toDisplayText(ev.payload.text),
                            method: toDisplayTextTrimmed(ev.payload.method),
                            timestamp: ev.timestamp
                        }
                        if (!nextReasoning[r.attemptGroupId]) nextReasoning[r.attemptGroupId] = []
                        nextReasoning[r.attemptGroupId].push(r)
                    } else if (ev.type === 'assistant-activity') {
                        if (!isTelemetryEventInScope(ev.payload, snapshotScope)) continue
                        const turnId = toDisplayTextTrimmed(ev.payload.turnId)
                        const attemptGroupId = toDisplayTextTrimmed(ev.payload.attemptGroupId) || turnId || 'unknown'
                        const a = {
                            turnId,
                            attemptGroupId,
                            kind: toDisplayTextTrimmed(ev.payload.kind) || 'event',
                            summary: toDisplayText(ev.payload.summary),
                            method: toDisplayTextTrimmed(ev.payload.method) || 'runtime',
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

                for (const [attemptGroupId, arr] of Object.entries(nextReasoning)) {
                    arr.sort((a, b) => a.timestamp - b.timestamp)
                    if (arr.length > MAX_REASONING_PER_ATTEMPT) {
                        nextReasoning[attemptGroupId] = arr.slice(arr.length - MAX_REASONING_PER_ATTEMPT)
                    }
                }
                for (const [attemptGroupId, arr] of Object.entries(nextActivities)) {
                    arr.sort((a, b) => a.timestamp - b.timestamp)
                    if (arr.length > MAX_ACTIVITIES_PER_ATTEMPT) {
                        nextActivities[attemptGroupId] = arr.slice(arr.length - MAX_ACTIVITIES_PER_ATTEMPT)
                    }
                }
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
            const nextHistory = Array.isArray(event.payload.history)
                ? normalizeHistoryMessages(event.payload.history as unknown[])
                : null
            if (nextHistory) deps.setHistory(nextHistory)
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
            const text = toDisplayText(event.payload.text)
            const streamKind = typeof event.payload.streamKind === 'string'
                ? event.payload.streamKind.toLowerCase()
                : ''
            deps.setStreamingTurnId(turnId)
            if (streamKind === 'provisional') {
                deps.setStreamingText('')
                deps.setReasoningByTurn((prev: Record<string, AssistantReasoning[]>) =>
                    stripLivePreviewReasoning(prev, turnId)
                )
                return
            }
            deps.setReasoningByTurn((prev: Record<string, AssistantReasoning[]>) =>
                stripLivePreviewReasoning(prev, turnId)
            )
            deps.setStreamingText(text)
            return
        }
        if (event.type === 'assistant-final') {
            const turnId = typeof event.payload.turnId === 'string' ? event.payload.turnId : null
            const text = toDisplayText(event.payload.text)
            deps.setStreamingTurnId(turnId)
            deps.setReasoningByTurn((prev: Record<string, AssistantReasoning[]>) =>
                stripLivePreviewReasoning(prev, turnId)
            )
            deps.setStreamingText(text)
            return
        }
        if (event.type === 'turn-cancelled' || event.type === 'turn-complete') {
            const turnId = typeof event.payload.turnId === 'string' ? event.payload.turnId : null
            deps.setReasoningByTurn((prev: Record<string, AssistantReasoning[]>) =>
                stripLivePreviewReasoning(prev, turnId)
            )
            if (!turnId || deps.getStreamingTurnId() === turnId) {
                deps.setStreamingTurnId(null)
                deps.setStreamingText('')
            }
            return
        }

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
            const message = toDisplayTextTrimmed(event.payload.message) || 'Assistant request failed.'
            deps.setErrorMessage(message)
            return
        }

        if (event.type === 'assistant-reasoning') {
            if (!isTelemetryEventInScope(event.payload, deps.scopeRef.current)) return
            const turnId = toDisplayTextTrimmed(event.payload.turnId)
            const attemptGroupId = toDisplayTextTrimmed(event.payload.attemptGroupId) || turnId || 'unknown'
            const payload = {
                turnId,
                attemptGroupId,
                text: toDisplayText(event.payload.text),
                method: toDisplayTextTrimmed(event.payload.method)
            } as Omit<AssistantReasoning, 'timestamp'>
            deps.setReasoningByTurn((prev: Record<string, AssistantReasoning[]>) => {
                const arr = prev[payload.attemptGroupId] || []
                return {
                    ...prev,
                    [payload.attemptGroupId]: appendCappedReasoning(arr, { ...payload, timestamp: event.timestamp })
                }
            })
            return
        }

        if (event.type === 'assistant-activity') {
            if (!isTelemetryEventInScope(event.payload, deps.scopeRef.current)) return
            const turnId = toDisplayTextTrimmed(event.payload.turnId)
            const attemptGroupId = toDisplayTextTrimmed(event.payload.attemptGroupId) || turnId || 'unknown'
            const payload = {
                turnId,
                attemptGroupId,
                kind: toDisplayTextTrimmed(event.payload.kind) || 'event',
                summary: toDisplayText(event.payload.summary),
                method: toDisplayTextTrimmed(event.payload.method) || 'runtime',
                payload: (event.payload.payload || {}) as Record<string, unknown>
            } as Omit<AssistantActivity, 'timestamp'>
            deps.setActivitiesByTurn((prev: Record<string, AssistantActivity[]>) => {
                const arr = prev[payload.attemptGroupId] || []
                return {
                    ...prev,
                    [payload.attemptGroupId]: appendCappedActivity(arr, { ...payload, timestamp: event.timestamp })
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
