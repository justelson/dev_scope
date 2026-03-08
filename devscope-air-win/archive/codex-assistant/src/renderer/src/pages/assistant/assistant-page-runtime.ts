import type {
    AssistantActivity,
    AssistantApproval,
    AssistantEvent,
    AssistantHistoryAttachment,
    AssistantHistoryMessage,
    AssistantPendingUserInput,
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
    parseUserInputQuestions,
    parseTurnPartPayload
} from './assistant-page-types'
import { toDisplayText, toDisplayTextTrimmed } from './assistant-text-utils'

type RuntimeDeps = {
    getStreamingTurnId: () => string | null
    getSnapshotSequence: () => number
    requestSnapshotSync: () => void
    scopeRef: MutableRefObject<{ turnIds: Set<string>; attemptGroupIds: Set<string> }>
    setIsChatHydrating: (value: boolean) => void
    setSnapshotSequence: (value: number) => void
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
    setPendingUserInputs: (value: AssistantPendingUserInput[] | ((prev: AssistantPendingUserInput[]) => AssistantPendingUserInput[])) => void
    setEventLog: (updater: (prev: AssistantEvent[]) => AssistantEvent[]) => void
    setStreamingTurnId: (value: string | null) => void
    setStreamingText: (value: string) => void
    setWorkflowState: (value: WorkflowState | null) => void
    setWorkflowRunningKind: (value: any) => void
    setErrorMessage: (value: string | null) => void
}

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
            streaming: Boolean(entry.streaming),
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

function parsePendingUserInputs(source: unknown): AssistantPendingUserInput[] {
    if (!Array.isArray(source)) return []
    return source
        .map((entry) => {
            if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return null
            const record = entry as Record<string, unknown>
            const requestId = Number(record.requestId)
            if (!Number.isFinite(requestId)) return null
            const questions = parseUserInputQuestions(record.questions)
            if (questions.length === 0) return null
            return {
                requestId,
                questions,
                answers: undefined,
                timestamp: Number(record.createdAt) || Date.now(),
                turnId: toDisplayTextTrimmed(record.turnId) || undefined,
                attemptGroupId: toDisplayTextTrimmed(record.attemptGroupId) || undefined
            } as AssistantPendingUserInput
        })
        .filter((entry): entry is AssistantPendingUserInput => Boolean(entry))
        .sort((a, b) => a.timestamp - b.timestamp)
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
                const text = toDisplayText(part.summary || part.text)
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

function deriveStreamingStateFromParts(
    partsByTurn: Record<string, AssistantTurnPart[]>,
    activeTurnId: string | null
): { turnId: string | null; text: string } {
    const normalizedTurnId = toDisplayTextTrimmed(activeTurnId)
    if (!normalizedTurnId) {
        return { turnId: null, text: '' }
    }

    const parts = [...(partsByTurn[normalizedTurnId] || [])].sort((a, b) => a.timestamp - b.timestamp)
    const latestStreamable = [...parts]
        .reverse()
        .find((part) => (
            (part.kind === 'text' || part.kind === 'final')
            && toDisplayText(part.text).trim().length > 0
        ))

    if (!latestStreamable) {
        return { turnId: normalizedTurnId, text: '' }
    }

    return {
        turnId: normalizedTurnId,
        text: toDisplayText(latestStreamable.text)
    }
}

function mergeScopePayload(
    scopeRef: MutableRefObject<{ turnIds: Set<string>; attemptGroupIds: Set<string> }>,
    payload: Record<string, unknown>
): void {
    const turnId = toDisplayTextTrimmed(payload.turnId)
    const attemptGroupId = toDisplayTextTrimmed(payload.attemptGroupId)
    if (!turnId && !attemptGroupId) return

    scopeRef.current = {
        turnIds: new Set([
            ...scopeRef.current.turnIds,
            ...(turnId ? [turnId] : [])
        ]),
        attemptGroupIds: new Set([
            ...scopeRef.current.attemptGroupIds,
            ...(attemptGroupId ? [attemptGroupId] : [])
        ])
    }
}

function appendEventActivity(
    previous: Record<string, AssistantActivity[]>,
    payload: Record<string, unknown>,
    timestamp: number
): Record<string, AssistantActivity[]> {
    const turnId = toDisplayTextTrimmed(payload.turnId)
    const attemptGroupId = toDisplayTextTrimmed(payload.attemptGroupId) || turnId || 'unknown'
    const summary = toDisplayText(payload.summary)
    if (!turnId || !summary.trim()) return previous

    const nextEntry: AssistantActivity = {
        turnId,
        attemptGroupId,
        kind: toDisplayTextTrimmed(payload.kind) || 'tool',
        summary,
        method: toDisplayTextTrimmed(payload.method) || 'assistant-activity',
        payload: payload.payload && typeof payload.payload === 'object' && !Array.isArray(payload.payload)
            ? payload.payload as Record<string, unknown>
            : {},
        timestamp
    }
    const next = { ...previous }
    next[attemptGroupId] = appendCappedActivity(next[attemptGroupId] || [], nextEntry)
    return next
}

function appendEventReasoning(
    previous: Record<string, AssistantReasoning[]>,
    payload: Record<string, unknown>,
    timestamp: number
): Record<string, AssistantReasoning[]> {
    const turnId = toDisplayTextTrimmed(payload.turnId)
    const attemptGroupId = toDisplayTextTrimmed(payload.attemptGroupId) || turnId || 'unknown'
    const text = toDisplayText(payload.text)
    if (!turnId || !text.trim()) return previous

    const nextEntry: AssistantReasoning = {
        turnId,
        attemptGroupId,
        text,
        method: toDisplayTextTrimmed(payload.method) || 'assistant-reasoning',
        timestamp
    }
    const next = { ...previous }
    next[attemptGroupId] = appendCappedReasoning(next[attemptGroupId] || [], nextEntry)
    return next
}

function appendEventApproval(
    previous: Record<string, AssistantApproval[]>,
    payload: Record<string, unknown>,
    timestamp: number
): Record<string, AssistantApproval[]> {
    const requestId = Number(payload.requestId)
    if (!Number.isFinite(requestId)) return previous

    const turnId = toDisplayTextTrimmed(payload.turnId)
    const attemptGroupId = toDisplayTextTrimmed(payload.attemptGroupId) || turnId || 'unknown'
    const nextEntry: AssistantApproval = {
        requestId,
        method: toDisplayTextTrimmed(payload.method) || 'approval',
        mode: payload.mode === 'yolo' ? 'yolo' : 'safe',
        decision: payload.decision === 'decline' || payload.decision === 'acceptForSession'
            ? payload.decision
            : undefined,
        request: payload.request && typeof payload.request === 'object' && !Array.isArray(payload.request)
            ? payload.request as Record<string, unknown>
            : undefined,
        timestamp,
        turnId: turnId || undefined,
        attemptGroupId
    }
    const next = { ...previous }
    next[attemptGroupId] = appendCappedApproval(next[attemptGroupId] || [], nextEntry)
    return next
}

function upsertPendingUserInputFromEvent(
    previous: AssistantPendingUserInput[],
    payload: Record<string, unknown>,
    timestamp: number
): AssistantPendingUserInput[] {
    const requestId = Number(payload.requestId)
    if (!Number.isFinite(requestId)) return previous
    const questions = parseUserInputQuestions(payload.questions)
    if (questions.length === 0) return previous

    const nextEntry: AssistantPendingUserInput = {
        requestId,
        questions,
        timestamp,
        turnId: toDisplayTextTrimmed(payload.turnId) || undefined,
        attemptGroupId: toDisplayTextTrimmed(payload.attemptGroupId) || undefined
    }

    const existingIndex = previous.findIndex((entry) => entry.requestId === requestId)
    if (existingIndex < 0) {
        return [...previous, nextEntry].sort((a, b) => a.timestamp - b.timestamp)
    }

    const next = [...previous]
    next[existingIndex] = nextEntry
    return next.sort((a, b) => a.timestamp - b.timestamp)
}

export function createLoadSnapshot(deps: RuntimeDeps) {
    return async (options?: { hydrateChat?: boolean }) => {
        const hydrateChat = options?.hydrateChat === true
        if (hydrateChat) deps.setIsChatHydrating(true)

        try {
            const snapshotResult = await window.devscope.assistant.getSnapshot()
            if (!snapshotResult?.success) {
                return
            }

            const snapshotRecord = snapshotResult as Record<string, unknown>
            deps.setSnapshotSequence(Math.max(0, Number(snapshotRecord.snapshotSequence) || 0))
            const statusRecord = (
                snapshotRecord.status && typeof snapshotRecord.status === 'object'
                    ? snapshotRecord.status
                    : {}
            ) as AssistantStatus
            deps.setStatus(statusRecord)
            deps.setErrorMessage(toDisplayTextTrimmed(statusRecord?.lastError) || null)

            const activeTurnId = statusRecord?.activeTurnId || null
            const snapshotHistory = Array.isArray(snapshotRecord.history)
                ? normalizeHistoryMessages(snapshotRecord.history as unknown[])
                : []
            deps.setHistory(snapshotHistory)

            const partsByTurn = parseHistoryTurnParts(snapshotRecord.partsByTurn)
            const pendingApprovals = parsePendingApprovals(snapshotRecord.pendingApprovals)
            const pendingUserInputs = parsePendingUserInputs(snapshotRecord.pendingUserInputs)
            deps.setPendingUserInputs(pendingUserInputs)

            const derivedStreaming = deriveStreamingStateFromParts(partsByTurn, activeTurnId)
            deps.setStreamingTurnId(derivedStreaming.turnId)
            deps.setStreamingText(derivedStreaming.text)

            const snapshotScope = buildSessionScope(
                snapshotHistory,
                activeTurnId,
                derivedStreaming.turnId
            )
            deps.scopeRef.current = snapshotScope

            if (Array.isArray(snapshotRecord.sessions)) {
                const normalizedSessions = snapshotRecord.sessions.map((session: any) => ({
                    id: String(session?.id || ''),
                    title: String(session?.title || ''),
                    archived: Boolean(session?.archived),
                    createdAt: Number(session?.createdAt) || Date.now(),
                    updatedAt: Number(session?.updatedAt) || Date.now(),
                    messageCount: Number(session?.messageCount) || 0,
                    projectPath: typeof session?.projectPath === 'string' ? session.projectPath : ''
                })) as AssistantSession[]
                deps.setSessions(normalizedSessions)
                deps.setActiveSessionId(snapshotRecord.activeSessionId ? String(snapshotRecord.activeSessionId) : null)
            }

            if (snapshotRecord.telemetryIntegrity && typeof snapshotRecord.telemetryIntegrity === 'object') {
                const telemetryResult = snapshotRecord.telemetryIntegrity as Record<string, unknown>
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

            const partDrivenTelemetry = buildTelemetryFromTurnParts(partsByTurn, pendingApprovals, snapshotScope)
            deps.setReasoningByTurn(partDrivenTelemetry.reasoning)
            deps.setActivitiesByTurn(partDrivenTelemetry.activities)
            deps.setApprovalsByTurn(partDrivenTelemetry.approvals)

            if (snapshotRecord.threadTokenUsage && typeof snapshotRecord.threadTokenUsage === 'object') {
                const tokenUsage = snapshotRecord.threadTokenUsage as Record<string, unknown>
                deps.setThreadTokenUsage({
                    threadId: toDisplayTextTrimmed(tokenUsage.threadId),
                    model: toDisplayTextTrimmed(tokenUsage.model),
                    inputTokens: Number(tokenUsage.inputTokens) || undefined,
                    outputTokens: Number(tokenUsage.outputTokens) || undefined,
                    totalTokens: Number(tokenUsage.totalTokens) || undefined,
                    modelContextWindow: Number(tokenUsage.modelContextWindow) || undefined,
                    at: Number(tokenUsage.at) || Date.now()
                })
            } else {
                deps.setThreadTokenUsage(null)
            }

            deps.setLastAccountUpdateAt(Number(snapshotRecord.lastAccountUpdateAt) || null)
            deps.setLastRateLimitsUpdateAt(Number(snapshotRecord.lastRateLimitsUpdateAt) || null)
        } finally {
            if (hydrateChat) deps.setIsChatHydrating(false)
        }
    }
}

export function createAssistantEventHandler(deps: RuntimeDeps) {
    return (event: AssistantEvent) => {
        deps.setEventLog((prev) => [event, ...prev].slice(0, 200))
        deps.setSnapshotSequence(Number(event.sequence) || 0)

        const payload = event.payload && typeof event.payload === 'object'
            ? event.payload as Record<string, unknown>
            : {}
        mergeScopePayload(deps.scopeRef, payload)

        if (event.type === 'status') {
            const statusPayload = payload.status && typeof payload.status === 'object'
                ? payload.status as AssistantStatus
                : payload as AssistantStatus
            deps.setStatus(statusPayload)
            deps.setErrorMessage(toDisplayTextTrimmed(statusPayload?.lastError) || null)
            if (!toDisplayTextTrimmed(statusPayload?.activeTurnId)) {
                deps.setStreamingTurnId(null)
                deps.setStreamingText('')
            }
            return
        }

        if (event.type === 'history') {
            const historyRaw = Array.isArray(payload.history) ? payload.history : []
            deps.setHistory(normalizeHistoryMessages(historyRaw))
            return
        }

        if (event.type === 'assistant-delta') {
            const turnId = toDisplayTextTrimmed(payload.turnId)
            if (!turnId) return

            const nextText = toDisplayText(payload.text || payload.delta)
            deps.setStreamingTurnId(turnId)
            if (nextText.trim()) deps.setStreamingText(nextText)
            return
        }

        if (event.type === 'assistant-final') {
            const turnId = toDisplayTextTrimmed(payload.turnId)
            const text = toDisplayText(payload.text)
            if (turnId) deps.setStreamingTurnId(turnId)
            if (text.trim()) deps.setStreamingText(text)
            deps.requestSnapshotSync()
            return
        }

        if (event.type === 'assistant-activity') {
            deps.setActivitiesByTurn((prev: Record<string, AssistantActivity[]>) => (
                appendEventActivity(prev, payload, event.timestamp)
            ))
            return
        }

        if (event.type === 'assistant-reasoning') {
            deps.setReasoningByTurn((prev: Record<string, AssistantReasoning[]>) => (
                appendEventReasoning(prev, payload, event.timestamp)
            ))
            return
        }

        if (event.type === 'approval-request' || event.type === 'approval-decision') {
            deps.setApprovalsByTurn((prev: Record<string, AssistantApproval[]>) => (
                appendEventApproval(prev, payload, event.timestamp)
            ))
            return
        }

        if (event.type === 'user-input-request') {
            deps.setPendingUserInputs((prev) => upsertPendingUserInputFromEvent(prev, payload, event.timestamp))
            return
        }

        if (event.type === 'user-input-response') {
            const requestId = Number(payload.requestId)
            if (Number.isFinite(requestId)) {
                deps.setPendingUserInputs((prev) => prev.filter((entry) => entry.requestId !== requestId))
            }
            return
        }

        if (event.type === 'thread/tokenUsage/updated') {
            deps.setThreadTokenUsage({
                threadId: toDisplayTextTrimmed(payload.threadId),
                model: toDisplayTextTrimmed(payload.model),
                inputTokens: Number(payload.inputTokens) || undefined,
                outputTokens: Number(payload.outputTokens) || undefined,
                totalTokens: Number(payload.totalTokens) || undefined,
                modelContextWindow: Number(payload.modelContextWindow) || undefined,
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
            deps.setErrorMessage(toDisplayTextTrimmed(payload.message) || 'Assistant error.')
            deps.requestSnapshotSync()
            return
        }

        if (event.type === 'turn-complete' || event.type === 'turn-cancelled') {
            deps.requestSnapshotSync()
            return
        }

        if (event.type === 'workflow-status') {
            const kindRaw = typeof payload.workflow === 'string' ? payload.workflow : ''
            if (kindRaw === 'explain-diff' || kindRaw === 'review-staged' || kindRaw === 'draft-commit') {
                const statusRaw = typeof payload.status === 'string' ? payload.status : 'running'
                const workflowStatus: WorkflowState['status'] = statusRaw === 'failed'
                    ? 'error'
                    : statusRaw === 'submitted' ? 'success' : 'running'
                const message = typeof payload.error === 'string' && payload.error.trim()
                    ? payload.error
                    : workflowStatus === 'success'
                        ? `${WORKFLOW_LABELS[kindRaw]} submitted.`
                        : workflowStatus === 'error'
                            ? `${WORKFLOW_LABELS[kindRaw]} failed.`
                            : `${WORKFLOW_LABELS[kindRaw]} is running...`
                deps.setWorkflowState({
                    kind: kindRaw,
                    status: workflowStatus,
                    message,
                    turnId: typeof payload.turnId === 'string' ? payload.turnId : undefined,
                    at: event.timestamp
                })
                if (workflowStatus !== 'running') deps.setWorkflowRunningKind(null)
            }
            return
        }

        deps.requestSnapshotSync()
    }
}
