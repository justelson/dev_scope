import { webContents } from 'electron'
import log from 'electron-log'
import { ASSISTANT_IPC } from '../../shared/contracts/assistant-ipc'
import {
    extractTurnIdFromParams,
    normalizeToken,
    now,
    readString,
    readTextFromContent
} from './assistant-bridge-helpers'
import type { AssistantEventPayload } from './types'

const EVENT_RETENTION_LIMIT = 2000
const ACTIVITY_SUMMARY_MAX_LENGTH = 220
const ACTIVITY_PAYLOAD_VALUE_MAX_LENGTH = 280
const ACTIVITY_PAYLOAD_KEYS = [
    'command',
    'description',
    'path',
    'filePath',
    'files',
    'query',
    'pattern',
    'url',
    'tool',
    'name',
    'status',
    'exitCode',
    'additions',
    'deletions',
    'insertions',
    'removals',
    'added',
    'removed',
    'linesAdded',
    'linesDeleted'
]
const ACTIVITY_EMIT_MIN_INTERVAL_MS = 180
const NOISY_ACTIVITY_TOKENS = ['delta', 'chunk', 'token', 'stream', 'progress', 'heartbeat']

type BridgeEventsContext = any
type ActivityKind = 'command' | 'file' | 'search' | 'tool' | 'other'

function collapseWhitespace(value: string): string {
    return value.replace(/\s+/g, ' ').trim()
}

function truncateWithEllipsis(value: string, maxLength: number): string {
    if (value.length <= maxLength) return value
    return `${value.slice(0, maxLength - 1)}...`
}

function formatActivitySummary(value: string): string {
    const collapsed = collapseWhitespace(String(value || ''))
    if (!collapsed) return ''
    return truncateWithEllipsis(collapsed, ACTIVITY_SUMMARY_MAX_LENGTH)
}

function normalizeActivityPayloadValue(value: unknown): string | number | boolean | string[] | undefined {
    if (typeof value === 'string') {
        const collapsed = collapseWhitespace(value)
        if (!collapsed) return undefined
        return truncateWithEllipsis(collapsed, ACTIVITY_PAYLOAD_VALUE_MAX_LENGTH)
    }
    if (typeof value === 'number' && Number.isFinite(value)) return value
    if (typeof value === 'boolean') return value
    if (Array.isArray(value)) {
        const items = value
            .map((item) => {
                if (item && typeof item === 'object' && !Array.isArray(item)) {
                    const record = item as Record<string, unknown>
                    const candidate = readString(record.path) || readString(record.filePath) || readString(record.name)
                    if (candidate.trim()) return normalizeActivityPayloadValue(candidate)
                }
                return normalizeActivityPayloadValue(item)
            })
            .filter((item): item is string | number | boolean => (
                typeof item === 'string' || typeof item === 'number' || typeof item === 'boolean'
            ))
            .slice(0, 12)
            .map((item) => String(item))
        return items.length > 0 ? items : undefined
    }
    return undefined
}

function sanitizeActivityPayload(payload: Record<string, unknown>): Record<string, unknown> {
    const next: Record<string, unknown> = {}
    for (const key of ACTIVITY_PAYLOAD_KEYS) {
        if (!Object.prototype.hasOwnProperty.call(payload, key)) continue
        const normalized = normalizeActivityPayloadValue(payload[key])
        if (normalized === undefined) continue
        next[key] = normalized
    }
    return next
}

function isNoisyActivity(normalizedType: string, normalizedMethod: string): boolean {
    const isNoisy = NOISY_ACTIVITY_TOKENS.some((token) => (
        normalizedType.includes(token) || normalizedMethod.includes(token)
    ))
    if (!isNoisy) return false

    if (normalizedMethod.includes('commandstart') || normalizedMethod.includes('commandend')) return false
    if (normalizedMethod.includes('toolcall') || normalizedType.includes('toolcall')) return false
    return true
}

export function bridgeHandleReasoningNotification(
    bridge: BridgeEventsContext,
    method: string,
    params: Record<string, unknown>
): boolean {
    const normalizedMethod = normalizeToken(method)
    if (!normalizedMethod.includes('reason') && !normalizedMethod.includes('thought')) {
        return false
    }

    const turnId = extractTurnIdFromParams(params) || bridge.activeTurnId
    if (!turnId) return false

    const text = readTextFromContent(
        params.delta
        || params.text
        || params.message
        || params.content
        || params.output
        || params.reasoning
    )
    if (!text.trim()) return false

    bridge.emitReasoning(turnId, text, method)
    return true
}

export function bridgeHandleLegacyReasoningNotification(
    bridge: BridgeEventsContext,
    turnId: string,
    eventType: string,
    payload: Record<string, unknown>,
    method: string
): boolean {
    const normalizedType = normalizeToken(eventType)
    if (!normalizedType.includes('reason') && !normalizedType.includes('thought')) {
        return false
    }

    const text = readTextFromContent(
        payload.delta
        || payload.text
        || payload.message
        || payload.content
        || payload.reasoning
    )
    if (!text.trim()) return false

    bridge.emitReasoning(turnId, text, method)
    return true
}

export function bridgeEmitReasoning(
    bridge: BridgeEventsContext,
    turnId: string,
    text: string,
    method: string
): void {
    const digest = `${method}::${text}`
    if (bridge.lastReasoningDigestByTurn.get(turnId) === digest) {
        return
    }
    bridge.lastReasoningDigestByTurn.set(turnId, digest)
    const reasoningParts = bridge.reasoningTextsByTurn.get(turnId) || []
    reasoningParts.push(text)
    bridge.reasoningTextsByTurn.set(turnId, reasoningParts)

    const attemptGroupId = bridge.turnContexts.get(turnId)?.attemptGroupId
        || bridge.turnAttemptGroupByTurnId.get(turnId)
        || turnId

    bridge.emitEvent('assistant-reasoning', {
        turnId,
        attemptGroupId,
        text,
        method
    })
    bridge.recordTurnPart({
        turnId,
        attemptGroupId,
        kind: 'reasoning',
        text,
        method
    })
}

export function bridgeHandleActivityNotification(
    bridge: BridgeEventsContext,
    method: string,
    params: Record<string, unknown>
): boolean {
    const turnId = extractTurnIdFromParams(params) || bridge.activeTurnId
    if (!turnId) return false

    const activity = bridge.normalizeActivity(method, params, '')
    if (!activity) return false

    bridge.emitActivity(turnId, activity.kind, activity.summary, activity.method, activity.payload)
    return true
}

export function bridgeHandleLegacyActivityNotification(
    bridge: BridgeEventsContext,
    turnId: string,
    eventType: string,
    payload: Record<string, unknown>,
    method: string
): boolean {
    const activity = bridge.normalizeActivity(method, payload, eventType)
    if (!activity) return false

    bridge.emitActivity(turnId, activity.kind, activity.summary, activity.method, activity.payload)
    return true
}

export function bridgeNormalizeActivity(
    _bridge: BridgeEventsContext,
    method: string,
    payload: Record<string, unknown>,
    eventType: string
): { kind: ActivityKind; summary: string; method: string; payload: Record<string, unknown> } | null {
    const activityMethod = method || eventType
    const normalizedMethod = normalizeToken(activityMethod)
    const normalizedType = normalizeToken(eventType)
    const target = normalizedMethod || normalizedType
    if (isNoisyActivity(normalizedType, normalizedMethod)) return null

    let kind: ActivityKind = 'other'
    if (target.includes('command') || target.includes('exec')) kind = 'command'
    else if (target.includes('file')) kind = 'file'
    else if (target.includes('search') || target.includes('web')) kind = 'search'
    else if (target.includes('tool')) kind = 'tool'

    if (kind === 'other') return null

    const summaryCandidates = kind === 'command'
        ? [payload.summary, payload.command, payload.description, payload.name, payload.tool]
        : kind === 'file'
            ? [payload.summary, payload.path, payload.filePath, payload.name]
            : kind === 'search'
                ? [payload.summary, payload.query, payload.pattern, payload.url]
                : [payload.summary, payload.tool, payload.name, payload.description]

    const summary = formatActivitySummary(
        summaryCandidates.map((value) => readString(value)).find((value) => value.trim()) || activityMethod
    )
    if (!summary) return null

    return {
        kind,
        summary,
        method: activityMethod,
        payload: sanitizeActivityPayload(payload)
    }
}

export function bridgeEmitActivity(
    bridge: BridgeEventsContext,
    turnId: string,
    kind: ActivityKind,
    summary: string,
    method: string,
    payload: Record<string, unknown>
): void {
    const normalizedSummary = formatActivitySummary(summary)
    if (!normalizedSummary) return

    const burstKey = `${kind}::${normalizeToken(method) || method}`
    const previousEmit = bridge.lastActivityEmitByTurn.get(turnId)
    const currentTimestamp = now()
    if (
        previousEmit
        && previousEmit.key === burstKey
        && (currentTimestamp - previousEmit.timestamp) < ACTIVITY_EMIT_MIN_INTERVAL_MS
    ) {
        return
    }
    bridge.lastActivityEmitByTurn.set(turnId, {
        timestamp: currentTimestamp,
        key: burstKey
    })

    const digest = `${kind}::${method}::${normalizedSummary}`
    if (bridge.lastActivityDigestByTurn.get(turnId) === digest) {
        return
    }
    bridge.lastActivityDigestByTurn.set(turnId, digest)

    const attemptGroupId = bridge.turnContexts.get(turnId)?.attemptGroupId
        || bridge.turnAttemptGroupByTurnId.get(turnId)
        || turnId

    bridge.emitEvent('assistant-activity', {
        turnId,
        attemptGroupId,
        kind,
        summary: normalizedSummary,
        method,
        payload
    })
    bridge.recordTurnPart({
        turnId,
        attemptGroupId,
        kind: kind === 'command' || kind === 'tool' ? 'tool' : 'tool-result',
        method,
        summary: normalizedSummary,
        payload: {
            kind,
            ...payload
        }
    })
}

export function bridgeEmitEvent(
    bridge: BridgeEventsContext,
    type: AssistantEventPayload['type'],
    payload: Record<string, unknown>
): void {
    const event: AssistantEventPayload = {
        type,
        timestamp: now(),
        payload
    }

    bridge.eventStore.unshift(event)
    if (bridge.eventStore.length > EVENT_RETENTION_LIMIT) {
        bridge.eventStore.length = EVENT_RETENTION_LIMIT
    }

    for (const id of Array.from(bridge.subscribers as Set<number>)) {
        const target = webContents.fromId(Number(id))
        if (!target || target.isDestroyed()) {
            bridge.subscribers.delete(id)
            continue
        }
        try {
            target.send(ASSISTANT_IPC.eventStream, event)
        } catch (error) {
            bridge.subscribers.delete(id)
            log.warn('[AssistantBridge] Failed to emit event to renderer', { id, error })
        }
    }
}
