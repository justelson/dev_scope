import type {
    AssistantActivity,
    AssistantApproval,
    AssistantEvent,
    AssistantHistoryAttachment,
    AssistantHistoryMessage,
    AssistantReasoning,
    AssistantSession,
    AssistantStatus,
    AssistantThreadTokenUsage,
    AssistantTurnPart,
    WorkflowState
} from './assistant-page-types'
import type { MutableRefObject } from 'react'
import {
    WORKFLOW_LABELS,
    buildSessionScope,
    isTelemetryEventInScope,
    parseApprovalDecisionPayload,
    parseApprovalPayload,
    parseTurnPartPayload
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
    setThreadTokenUsage: (value: AssistantThreadTokenUsage | null) => void
    setLastAccountUpdateAt: (value: number | null) => void
    setLastRateLimitsUpdateAt: (value: number | null) => void
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
const MAX_APPROVALS_PER_ATTEMPT = 120

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

function appendCappedApproval(
    entries: AssistantApproval[],
    nextEntry: AssistantApproval
): AssistantApproval[] {
    const existingIndex = entries.findIndex((entry) => entry.requestId === nextEntry.requestId)
    if (existingIndex >= 0) {
        const next = [...entries]
        next[existingIndex] = { ...next[existingIndex], ...nextEntry }
        return next
    }
    const next = [...entries, nextEntry]
    if (next.length <= MAX_APPROVALS_PER_ATTEMPT) return next
    return next.slice(next.length - MAX_APPROVALS_PER_ATTEMPT)
}

function parseHistoryTurnParts(
    source: unknown
): Record<string, AssistantTurnPart[]> {
    if (!source || typeof source !== 'object' || Array.isArray(source)) return {}
    const next: Record<string, AssistantTurnPart[]> = {}
    for (const [turnIdRaw, listRaw] of Object.entries(source as Record<string, unknown>)) {
        const turnId = toDisplayTextTrimmed(turnIdRaw)
        if (!turnId || !Array.isArray(listRaw)) continue
        const parsed = listRaw
            .map((entry) => (
                entry && typeof entry === 'object' && !Array.isArray(entry)
                    ? parseTurnPartPayload(entry as Record<string, unknown>)
                    : null
            ))
            .filter((entry): entry is AssistantTurnPart => Boolean(entry))
            .sort((a, b) => a.timestamp - b.timestamp)
        if (parsed.length > 0) next[turnId] = parsed
    }
    return next
}

function parsePendingApprovals(source: unknown): AssistantApproval[] {
    if (!Array.isArray(source)) return []
    return source
        .map((entry) => {
            if (!entry || typeof entry !== 'object') return null
            const record = entry as Record<string, unknown>
            const requestId = Number(record.requestId)
            if (!Number.isFinite(requestId)) return null
            const method = toDisplayTextTrimmed(record.method)
            if (!method) return null
            return {
                requestId,
                method,
                mode: record.mode === 'yolo' ? 'yolo' : 'safe',
                decision: undefined,
                request: (record.request && typeof record.request === 'object' && !Array.isArray(record.request))
                    ? record.request as Record<string, unknown>
                    : undefined,
                timestamp: Number(record.createdAt) || Date.now(),
                turnId: toDisplayTextTrimmed(record.turnId) || undefined,
                attemptGroupId: toDisplayTextTrimmed(record.attemptGroupId) || undefined
            } as AssistantApproval
        })
        .filter((entry): entry is AssistantApproval => Boolean(entry))
}

function buildTelemetryFromTurnParts(
    partsByTurn: Record<string, AssistantTurnPart[]>,
    pendingApprovals: AssistantApproval[],
    scope: { turnIds: Set<string>; attemptGroupIds: Set<string> }
): {
    reasoning: Record<string, AssistantReasoning[]>
    activities: Record<string, AssistantActivity[]>
    approvals: Record<string, AssistantApproval[]>
} {
    const nextReasoning: Record<string, AssistantReasoning[]> = {}
    const nextActivities: Record<string, AssistantActivity[]> = {}
    const nextApprovals: Record<string, AssistantApproval[]> = {}

    for (const parts of Object.values(partsByTurn)) {
        for (const part of parts) {
            if (!isTelemetryEventInScope(part as unknown as Record<string, unknown>, scope)) continue
            const attemptGroupId = part.attemptGroupId || part.turnId || 'unknown'
            if (part.kind === 'reasoning') {
                const text = toDisplayText(part.text)
                if (!text.trim()) continue
                const nextEntry: AssistantReasoning = {
                    turnId: part.turnId,
                    attemptGroupId,
                    text,
                    method: toDisplayTextTrimmed(part.method) || 'turn-part',
                    timestamp: part.timestamp
                }
                const arr = nextReasoning[attemptGroupId] || []
                nextReasoning[attemptGroupId] = appendCappedReasoning(arr, nextEntry)
                continue
            }

            if (part.kind === 'tool' || part.kind === 'tool-result') {
                const summary = toDisplayText(part.summary || part.text)
                const nextEntry: AssistantActivity = {
                    turnId: part.turnId,
                    attemptGroupId,
                    kind: part.kind === 'tool' ? 'tool' : 'result',
                    summary,
                    method: toDisplayTextTrimmed(part.method) || 'turn-part',
                    payload: (part.payload && typeof part.payload === 'object' ? part.payload : {}),
                    timestamp: part.timestamp
                }
                const arr = nextActivities[attemptGroupId] || []
                nextActivities[attemptGroupId] = appendCappedActivity(arr, nextEntry)
                continue
            }

            if (part.kind === 'approval') {
                const payloadRequest = (
                    part.payload && typeof part.payload === 'object' && !Array.isArray(part.payload)
                        ? part.payload
                        : undefined
                )
                const requestIdCandidate = Number(payloadRequest?.requestId)
                const requestId = Number.isFinite(requestIdCandidate)
                    ? requestIdCandidate
                    : Math.round(part.timestamp)
                const nextEntry: AssistantApproval = {
                    requestId,
                    method: toDisplayTextTrimmed(part.method) || 'approval',
                    mode: payloadRequest?.mode === 'yolo' ? 'yolo' : 'safe',
                    decision: part.decision,
                    request: payloadRequest,
                    timestamp: part.timestamp,
                    turnId: part.turnId,
                    attemptGroupId
                }
                const arr = nextApprovals[attemptGroupId] || []
                nextApprovals[attemptGroupId] = appendCappedApproval(arr, nextEntry)
            }
        }
    }

    for (const pending of pendingApprovals) {
        if (!isTelemetryEventInScope(pending as unknown as Record<string, unknown>, scope)) continue
        const attemptGroupId = toDisplayTextTrimmed(pending.attemptGroupId) || toDisplayTextTrimmed(pending.turnId) || 'unknown'
        const arr = nextApprovals[attemptGroupId] || []
        nextApprovals[attemptGroupId] = appendCappedApproval(arr, {
            ...pending,
            attemptGroupId
        })
    }

    for (const arr of Object.values(nextReasoning)) arr.sort((a, b) => a.timestamp - b.timestamp)
    for (const arr of Object.values(nextActivities)) arr.sort((a, b) => a.timestamp - b.timestamp)
    for (const arr of Object.values(nextApprovals)) arr.sort((a, b) => a.timestamp - b.timestamp)

    return {
        reasoning: nextReasoning,
        activities: nextActivities,
        approvals: nextApprovals
    }
}

export function createLoadSnapshot(deps: RuntimeDeps) {
    return async (options?: { hydrateChat?: boolean }) => {
        const hydrateChat = options?.hydrateChat === true
        if (hydrateChat) deps.setIsChatHydrating(true)

        try {
            const [statusResult, historyResult, eventsResult, sessionsResult, telemetryResult] = await Promise.all([
                window.devscope.assistant.status(),
                window.devscope.assistant.getHistory(),
                window.devscope.assistant.getEvents({
                    types: [
                        'turn-part',
                        'assistant-reasoning',
                        'assistant-activity',
                        'approval-request',
                        'approval-decision',
                        'thread/tokenUsage/updated',
                        'account/updated',
                        'account/rateLimits/updated'
                    ],
                    limit: 5000
                }),
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

            const historyRecord = (historyResult && typeof historyResult === 'object')
                ? historyResult as Record<string, unknown>
                : {}
            const partsByTurn = parseHistoryTurnParts(historyRecord.partsByTurn)
            const pendingApprovals = parsePendingApprovals(historyRecord.pendingApprovals)

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
                const partDrivenTelemetry = buildTelemetryFromTurnParts(partsByTurn, pendingApprovals, snapshotScope)
                let nextReasoning = partDrivenTelemetry.reasoning
                let nextActivities = partDrivenTelemetry.activities
                let nextApprovals = partDrivenTelemetry.approvals

                const hasPartTelemetry = Object.keys(nextReasoning).length > 0
                    || Object.keys(nextActivities).length > 0
                    || Object.keys(nextApprovals).length > 0

                if (!hasPartTelemetry) {
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

                    const fallbackReasoning: Record<string, AssistantReasoning[]> = {}
                    const fallbackActivities: Record<string, AssistantActivity[]> = {}
                    const fallbackApprovals: Record<string, AssistantApproval[]> = {}
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
                            if (!fallbackReasoning[r.attemptGroupId]) fallbackReasoning[r.attemptGroupId] = []
                            fallbackReasoning[r.attemptGroupId].push(r)
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
                            if (!fallbackActivities[a.attemptGroupId]) fallbackActivities[a.attemptGroupId] = []
                            fallbackActivities[a.attemptGroupId].push(a)
                        }
                    }
                    for (const approval of reqMap.values()) {
                        if (!isTelemetryEventInScope(approval as unknown as Record<string, unknown>, snapshotScope)) continue
                        const groupId = approval.attemptGroupId || 'unknown'
                        if (!fallbackApprovals[groupId]) fallbackApprovals[groupId] = []
                        fallbackApprovals[groupId].push(approval)
                    }
                    nextReasoning = fallbackReasoning
                    nextActivities = fallbackActivities
                    nextApprovals = fallbackApprovals
                }

                deps.setReasoningByTurn(nextReasoning)
                deps.setActivitiesByTurn(nextActivities)
                deps.setApprovalsByTurn(nextApprovals)

                const latestTokenUsageEvent = [...eventsResult.events]
                    .filter((event) => event.type === 'thread/tokenUsage/updated')
                    .sort((a, b) => b.timestamp - a.timestamp)[0]
                if (latestTokenUsageEvent) {
                    const payload = latestTokenUsageEvent.payload || {}
                    deps.setThreadTokenUsage({
                        threadId: toDisplayTextTrimmed((payload as Record<string, unknown>).threadId),
                        model: toDisplayTextTrimmed((payload as Record<string, unknown>).model),
                        inputTokens: Number((payload as Record<string, unknown>).inputTokens) || undefined,
                        outputTokens: Number((payload as Record<string, unknown>).outputTokens) || undefined,
                        totalTokens: Number((payload as Record<string, unknown>).totalTokens) || undefined,
                        modelContextWindow: Number((payload as Record<string, unknown>).modelContextWindow) || undefined,
                        at: latestTokenUsageEvent.timestamp
                    })
                } else {
                    deps.setThreadTokenUsage(null)
                }

                const latestAccountUpdate = [...eventsResult.events]
                    .filter((event) => event.type === 'account/updated')
                    .sort((a, b) => b.timestamp - a.timestamp)[0]
                deps.setLastAccountUpdateAt(latestAccountUpdate ? latestAccountUpdate.timestamp : null)

                const latestRateLimitsUpdate = [...eventsResult.events]
                    .filter((event) => event.type === 'account/rateLimits/updated')
                    .sort((a, b) => b.timestamp - a.timestamp)[0]
                deps.setLastRateLimitsUpdateAt(latestRateLimitsUpdate ? latestRateLimitsUpdate.timestamp : null)
            }
        } finally {
            if (hydrateChat) deps.setIsChatHydrating(false)
        }
    }
}

export function createAssistantEventHandler(deps: RuntimeDeps) {
    let hasTurnPartStream = false
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
        if (event.type === 'turn-part') {
            hasTurnPartStream = true
            const part = parseTurnPartPayload(event.payload)
            if (!part) return
            if (!isTelemetryEventInScope(part as unknown as Record<string, unknown>, deps.scopeRef.current)) return

            if (part.kind === 'reasoning') {
                const text = toDisplayText(part.text)
                if (text.trim()) {
                    deps.setReasoningByTurn((prev: Record<string, AssistantReasoning[]>) => {
                        const arr = prev[part.attemptGroupId] || []
                        return {
                            ...prev,
                            [part.attemptGroupId]: appendCappedReasoning(arr, {
                                turnId: part.turnId,
                                attemptGroupId: part.attemptGroupId,
                                text,
                                method: toDisplayTextTrimmed(part.method) || 'turn-part',
                                timestamp: part.timestamp
                            })
                        }
                    })
                }
                return
            }

            if (part.kind === 'tool' || part.kind === 'tool-result') {
                deps.setActivitiesByTurn((prev: Record<string, AssistantActivity[]>) => {
                    const arr = prev[part.attemptGroupId] || []
                    return {
                        ...prev,
                        [part.attemptGroupId]: appendCappedActivity(arr, {
                            turnId: part.turnId,
                            attemptGroupId: part.attemptGroupId,
                            kind: part.kind === 'tool' ? 'tool' : 'result',
                            summary: toDisplayText(part.summary || part.text),
                            method: toDisplayTextTrimmed(part.method) || 'turn-part',
                            payload: (part.payload && typeof part.payload === 'object' ? part.payload : {}),
                            timestamp: part.timestamp
                        })
                    }
                })
                return
            }

            if (part.kind === 'approval') {
                const payload = (part.payload && typeof part.payload === 'object') ? part.payload : {}
                const requestIdCandidate = Number((payload as Record<string, unknown>).requestId)
                const requestId = Number.isFinite(requestIdCandidate) ? requestIdCandidate : Math.round(part.timestamp)
                const nextApproval: AssistantApproval = {
                    requestId,
                    method: toDisplayTextTrimmed(part.method) || 'approval',
                    mode: (payload as Record<string, unknown>).mode === 'yolo' ? 'yolo' : 'safe',
                    decision: part.decision,
                    request: payload,
                    timestamp: part.timestamp,
                    turnId: part.turnId,
                    attemptGroupId: part.attemptGroupId
                }
                deps.setApprovalsByTurn((prev: Record<string, AssistantApproval[]>) => {
                    const arr = prev[part.attemptGroupId] || []
                    return {
                        ...prev,
                        [part.attemptGroupId]: appendCappedApproval(arr, nextApproval)
                    }
                })
                return
            }

            if (part.kind === 'text') {
                deps.setStreamingTurnId(part.turnId)
                if (part.provisional) {
                    deps.setStreamingText('')
                    return
                }
                deps.setStreamingText(toDisplayText(part.text))
                return
            }

            if (part.kind === 'final') {
                deps.setStreamingTurnId(part.turnId)
                deps.setStreamingText(toDisplayText(part.text))
                return
            }

            if (part.kind === 'error') {
                const message = toDisplayTextTrimmed(part.text || part.summary) || 'Assistant request failed.'
                deps.setErrorMessage(message)
            }
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
        if (event.type === 'thread/tokenUsage/updated') {
            const payload = event.payload || {}
            deps.setThreadTokenUsage({
                threadId: toDisplayTextTrimmed((payload as Record<string, unknown>).threadId),
                model: toDisplayTextTrimmed((payload as Record<string, unknown>).model),
                inputTokens: Number((payload as Record<string, unknown>).inputTokens) || undefined,
                outputTokens: Number((payload as Record<string, unknown>).outputTokens) || undefined,
                totalTokens: Number((payload as Record<string, unknown>).totalTokens) || undefined,
                modelContextWindow: Number((payload as Record<string, unknown>).modelContextWindow) || undefined,
                at: event.timestamp
            })
            return
        }
        if (event.type === 'account/updated') {
            deps.setLastAccountUpdateAt(event.timestamp)
            return
        }
        if (event.type === 'account/rateLimits/updated') {
            deps.setLastRateLimitsUpdateAt(event.timestamp)
            return
        }
        if (event.type === 'error') {
            const message = toDisplayTextTrimmed(event.payload.message) || 'Assistant request failed.'
            deps.setErrorMessage(message)
            return
        }

        if (event.type === 'assistant-reasoning') {
            if (hasTurnPartStream) return
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
            if (hasTurnPartStream) return
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
            if (hasTurnPartStream) return
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
            if (hasTurnPartStream) return
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
