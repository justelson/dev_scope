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

type BridgeEventsContext = any
type ActivityKind = 'command' | 'file' | 'search' | 'tool' | 'other'

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

    let kind: ActivityKind = 'other'
    if (target.includes('command') || target.includes('exec')) kind = 'command'
    else if (target.includes('file')) kind = 'file'
    else if (target.includes('search') || target.includes('web')) kind = 'search'
    else if (target.includes('tool')) kind = 'tool'

    if (kind === 'other') return null

    const summary = readString(payload.summary).trim()
        || readString(payload.command).trim()
        || readString(payload.path).trim()
        || readString(payload.filePath).trim()
        || readString(payload.query).trim()
        || readString(payload.tool).trim()
        || readString(payload.name).trim()
        || readString(payload.message).trim()
        || activityMethod

    return {
        kind,
        summary,
        method: activityMethod,
        payload
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
    const digest = `${kind}::${method}::${summary}`
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
        summary,
        method,
        payload
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
