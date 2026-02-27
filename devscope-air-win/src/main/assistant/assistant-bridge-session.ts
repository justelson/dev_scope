import type { AssistantApprovalMode, AssistantEventPayload, AssistantHistoryMessage, AssistantTurnPart } from './types'
import { createId, isAutoSessionTitle, now } from './assistant-bridge-helpers'
type BridgeSessionContext = any
export function bridgeGetHistory(bridge: BridgeSessionContext): {
    success: boolean
    history: AssistantHistoryMessage[]
    activeSessionId: string | null
    sessions: Array<{
        id: string
        title: string
        archived: boolean
        createdAt: number
        updatedAt: number
        messageCount: number
        projectPath: string
    }>
    attempts: Array<{
        groupId: string
        activeTurnId: string | null
        activeAttemptIndex: number
        attempts: Array<{
            turnId: string | null
            attemptIndex: number
            text: string
            createdAt: number
            isActive: boolean
        }>
    }>
    partsByTurn: Record<string, AssistantTurnPart[]>
    pendingApprovals: Array<{
        requestId: number
        method: string
        mode: AssistantApprovalMode
        turnId: string | null
        attemptGroupId: string | null
        createdAt: number
    }>
} {
    bridge.ensureActiveSession()
    bridge.syncActiveSessionFromRuntime()
    const attemptsByGroup = new Map<string, Array<{
        turnId: string | null
        attemptIndex: number
        text: string
        createdAt: number
        isActive: boolean
    }>>()
    for (const message of bridge.history) {
        if (message.role !== 'assistant' || !message.attemptGroupId) continue
        const items = attemptsByGroup.get(message.attemptGroupId) || []
        items.push({
            turnId: message.turnId || null,
            attemptIndex: message.attemptIndex || 1,
            text: message.text,
            createdAt: message.createdAt,
            isActive: message.isActiveAttempt !== false
        })
        attemptsByGroup.set(message.attemptGroupId, items)
    }
    const attempts = Array.from(attemptsByGroup.entries()).map(([groupId, items]) => {
        const sorted = [...items].sort((a, b) => a.attemptIndex - b.attemptIndex || a.createdAt - b.createdAt)
        const active = sorted.find((entry) => entry.isActive) || sorted[sorted.length - 1] || null
        return {
            groupId,
            activeTurnId: active?.turnId || null,
            activeAttemptIndex: active?.attemptIndex || 0,
            attempts: sorted
        }
    })
    return {
        success: true,
        history: [...bridge.history],
        activeSessionId: bridge.activeSessionId,
        sessions: bridge.sessions.map((session: any) => ({
            id: session.id,
            title: session.title,
            archived: session.archived,
            createdAt: session.createdAt,
            updatedAt: session.updatedAt,
            messageCount: session.history.length,
            projectPath: session.projectPath || ''
        })),
        attempts,
        partsByTurn: Object.fromEntries(
            Array.from<[string, AssistantTurnPart[]]>(
                bridge.turnPartsByTurnId.entries() as Iterable<[string, AssistantTurnPart[]]>
            ).map(([turnId, parts]) => [turnId, [...parts]] as [string, AssistantTurnPart[]])
        ),
        pendingApprovals: Array.from(bridge.pendingApprovalRequests.values()).map((entry: any) => ({
            requestId: Number(entry.requestId),
            method: String(entry.method || ''),
            mode: entry.mode === 'yolo' ? 'yolo' : 'safe',
            turnId: entry.turnId ? String(entry.turnId) : null,
            attemptGroupId: entry.attemptGroupId ? String(entry.attemptGroupId) : null,
            createdAt: Number(entry.createdAt) || now()
        }))
    }
}
export function bridgeClearHistory(bridge: BridgeSessionContext): { success: boolean } {
    bridge.ensureActiveSession()
    bridge.history = []
    bridge.turnAttemptGroupByTurnId.clear()
    bridge.turnContexts.clear()
    bridge.turnBuffers.clear()
    bridge.reasoningTextsByTurn.clear()
    bridge.lastReasoningDigestByTurn.clear()
    bridge.lastActivityDigestByTurn.clear()
    bridge.turnPartsByTurnId.clear()
    bridge.pendingApprovalRequests.clear()
    const activeSession = bridge.getActiveSession()
    if (activeSession) {
        activeSession.history = []
        activeSession.threadId = null
        activeSession.updatedAt = now()
    }
    bridge.threadId = null
    bridge.persistStateSoon()
    bridge.emitEvent('history', { history: [...bridge.history] })
    return { success: true }
}
export function bridgeGetEvents(
    bridge: BridgeSessionContext,
    options: {
        limit?: number
        types?: string[]
        search?: string
    } = {}
): { success: boolean; events: AssistantEventPayload[] } {
    const normalizedLimit = Number.isFinite(Number(options.limit))
        ? Math.max(1, Math.min(5000, Number(options.limit)))
        : 200
    const typeFilter = Array.isArray(options.types)
        ? new Set(options.types.map((entry) => String(entry || '').trim()).filter(Boolean))
        : null
    const search = String(options.search || '').trim().toLowerCase()
    const filtered = bridge.eventStore.filter((event: AssistantEventPayload) => {
        if (typeFilter && !typeFilter.has(event.type)) {
            return false
        }
        if (!search) return true
        const payloadText = JSON.stringify(event.payload).toLowerCase()
        return event.type.toLowerCase().includes(search) || payloadText.includes(search)
    })
    return {
        success: true,
        events: filtered.slice(0, normalizedLimit)
    }
}
export function bridgeClearEvents(bridge: BridgeSessionContext): { success: boolean } {
    bridge.eventStore = []
    return { success: true }
}
export function bridgeExportEvents(bridge: BridgeSessionContext): { success: boolean; format: 'json'; content: string } {
    return {
        success: true,
        format: 'json',
        content: JSON.stringify(bridge.eventStore, null, 2)
    }
}
export function bridgeExportConversation(
    bridge: BridgeSessionContext,
    format: 'json' | 'markdown' = 'json',
    sessionId?: string
): { success: boolean; format: 'json' | 'markdown'; content: string; error?: string } {
    bridge.ensureActiveSession()
    bridge.syncActiveSessionFromRuntime()
    const targetSessionId = String(sessionId || bridge.activeSessionId || '').trim()
    const target = bridge.sessions.find((session: any) => session.id === targetSessionId) || bridge.getActiveSession()
    if (!target) {
        return { success: false, format, content: '', error: 'No session available to export.' }
    }
    if (format === 'markdown') {
        const lines: string[] = [
            '# Assistant Conversation',
            '',
            `- Session: ${target.title}`,
            `- Session ID: ${target.id}`,
            `- Exported At: ${new Date().toISOString()}`,
            ''
        ]
        for (const message of target.history) {
            const role = message.role.toUpperCase()
            lines.push(`## ${role}`)
            lines.push('')
            lines.push(message.text || '')
            lines.push('')
        }
        return {
            success: true,
            format,
            content: lines.join('\n').trim()
        }
    }
    return {
        success: true,
        format,
        content: JSON.stringify({
            session: {
                id: target.id,
                title: target.title,
                archived: target.archived,
                createdAt: target.createdAt,
                updatedAt: target.updatedAt
            },
            history: target.history
        }, null, 2)
    }
}
export function bridgeListSessions(bridge: BridgeSessionContext): {
    success: boolean
    activeSessionId: string | null
    sessions: Array<{
        id: string
        title: string
        archived: boolean
        createdAt: number
        updatedAt: number
        messageCount: number
        projectPath: string
    }>
} {
    bridge.ensureActiveSession()
    bridge.syncActiveSessionFromRuntime()
    return {
        success: true,
        activeSessionId: bridge.activeSessionId,
        sessions: bridge.sessions.map((session: any) => ({
            id: session.id,
            title: session.title,
            archived: session.archived,
            createdAt: session.createdAt,
            updatedAt: session.updatedAt,
            messageCount: session.history.length,
            projectPath: session.projectPath || ''
        }))
    }
}
export function bridgeListProfiles(bridge: BridgeSessionContext): {
    success: boolean
    activeProfile: string
    profiles: Array<{
        id: string
        label: string
        approvalMode: AssistantApprovalMode
        description: string
    }>
} {
    return {
        success: true,
        activeProfile: bridge.activeProfile,
        profiles: [
            {
                id: 'safe-dev',
                label: 'Safe Dev',
                approvalMode: 'safe',
                description: 'Conservative default for iterative coding.'
            },
            {
                id: 'review',
                label: 'Review',
                approvalMode: 'safe',
                description: 'Bias toward audit-style responses and caution.'
            },
            {
                id: 'yolo-fast',
                label: 'YOLO Fast',
                approvalMode: 'yolo',
                description: 'Fast workflow with session approvals enabled.'
            }
        ]
    }
}
export function bridgeSetProfile(bridge: BridgeSessionContext, profileId: string): { success: boolean; profile: string } {
    const normalized = String(profileId || '').trim().toLowerCase()
    const selected = normalized || 'safe-dev'
    bridge.activeProfile = selected
    bridge.status.profile = selected
    if (selected === 'yolo-fast') {
        bridge.status.approvalMode = 'yolo'
    } else {
        bridge.status.approvalMode = 'safe'
    }
    bridge.persistStateSoon()
    bridge.emitEvent('status', { status: bridge.getStatus() })
    return { success: true, profile: selected }
}
export function bridgeGetProjectModelDefault(bridge: BridgeSessionContext, projectPath: string): { success: boolean; model: string | null } {
    const key = String(projectPath || '').trim()
    if (!key) return { success: true, model: null }
    return { success: true, model: bridge.projectModelDefaults.get(key) || null }
}
export function bridgeSetProjectModelDefault(
    bridge: BridgeSessionContext,
    projectPath: string,
    model: string
): { success: boolean; error?: string } {
    const key = String(projectPath || '').trim()
    const nextModel = String(model || '').trim()
    if (!key || !nextModel) {
        return { success: false, error: 'projectPath and model are required.' }
    }
    bridge.projectModelDefaults.set(key, nextModel)
    bridge.persistStateSoon()
    return { success: true }
}
export function bridgeCreateSession(
    bridge: BridgeSessionContext,
    title?: string
): { success: boolean; session: { id: string; title: string } } {
    bridge.ensureActiveSession()
    bridge.syncActiveSessionFromRuntime()
    const createdAt = now()
    const id = createId('session')
    const cleanTitle = String(title || '').trim()
    const sessionTitle = cleanTitle || `Session ${bridge.sessions.length + 1}`
    const session = {
        id,
        title: sessionTitle,
        archived: false,
        createdAt,
        updatedAt: createdAt,
        history: [],
        threadId: null,
        projectPath: '',
        contextTitleFinalized: !isAutoSessionTitle(sessionTitle)
    }
    bridge.sessions.unshift(session)
    bridge.activeSessionId = session.id
    bridge.history = []
    bridge.threadId = null
    bridge.activeTurnId = null
    bridge.status.activeTurnId = null
    bridge.turnBuffers.clear()
    bridge.turnContexts.clear()
    bridge.turnAttemptGroupByTurnId.clear()
    bridge.reasoningTextsByTurn.clear()
    bridge.turnPartsByTurnId.clear()
    bridge.pendingApprovalRequests.clear()
    bridge.persistStateSoon()
    bridge.emitEvent('history', { history: [...bridge.history] })
    bridge.emitEvent('status', { status: bridge.getStatus() })
    return {
        success: true,
        session: { id: session.id, title: session.title }
    }
}
export function bridgeSelectSession(bridge: BridgeSessionContext, sessionId: string): { success: boolean; error?: string } {
    const targetId = String(sessionId || '').trim()
    if (!targetId) {
        return { success: false, error: 'sessionId is required.' }
    }
    if (bridge.activeTurnId) {
        return { success: false, error: 'Cannot switch session while a turn is active.' }
    }
    bridge.ensureActiveSession()
    bridge.syncActiveSessionFromRuntime()
    const target = bridge.sessions.find((session: any) => session.id === targetId && !session.archived)
    if (!target) {
        return { success: false, error: `Session not found: ${targetId}` }
    }
    bridge.activeSessionId = target.id
    bridge.history = [...target.history]
    bridge.threadId = target.threadId
    bridge.turnBuffers.clear()
    bridge.turnContexts.clear()
    bridge.turnAttemptGroupByTurnId.clear()
    bridge.reasoningTextsByTurn.clear()
    bridge.turnPartsByTurnId.clear()
    bridge.pendingApprovalRequests.clear()
    bridge.finalizedTurns.clear()
    bridge.cancelledTurns.clear()
    bridge.status.activeTurnId = null
    bridge.activeTurnId = null
    target.updatedAt = now()
    bridge.persistStateSoon()
    bridge.emitEvent('history', { history: [...bridge.history] })
    bridge.emitEvent('status', { status: bridge.getStatus() })
    return { success: true }
}
export function bridgeRenameSession(
    bridge: BridgeSessionContext,
    sessionId: string,
    title: string
): { success: boolean; error?: string } {
    const targetId = String(sessionId || '').trim()
    const nextTitle = String(title || '').trim()
    if (!targetId || !nextTitle) {
        return { success: false, error: 'sessionId and title are required.' }
    }
    const target = bridge.sessions.find((session: any) => session.id === targetId)
    if (!target) {
        return { success: false, error: `Session not found: ${targetId}` }
    }
    target.title = nextTitle
    target.contextTitleFinalized = true
    target.updatedAt = now()
    bridge.persistStateSoon()
    return { success: true }
}
export function bridgeDeleteSession(bridge: BridgeSessionContext, sessionId: string): { success: boolean; error?: string } {
    const targetId = String(sessionId || '').trim()
    if (!targetId) {
        return { success: false, error: 'sessionId is required.' }
    }
    const index = bridge.sessions.findIndex((session: any) => session.id === targetId)
    if (index < 0) {
        return { success: false, error: `Session not found: ${targetId}` }
    }
    bridge.sessions.splice(index, 1)
    if (bridge.sessions.length === 0) {
        bridge.sessions.push(bridge.createDefaultSession())
    }
    if (bridge.activeSessionId === targetId) {
        const replacement = bridge.sessions.find((session: any) => !session.archived) || bridge.sessions[0]
        bridge.activeSessionId = replacement.id
        bridge.history = [...replacement.history]
        bridge.threadId = replacement.threadId
        bridge.activeTurnId = null
        bridge.status.activeTurnId = null
    }
    bridge.persistStateSoon()
    bridge.emitEvent('history', { history: [...bridge.history] })
    bridge.emitEvent('status', { status: bridge.getStatus() })
    return { success: true }
}
export function bridgeArchiveSession(
    bridge: BridgeSessionContext,
    sessionId: string,
    archived = true
): { success: boolean; error?: string } {
    const targetId = String(sessionId || '').trim()
    if (!targetId) {
        return { success: false, error: 'sessionId is required.' }
    }
    const target = bridge.sessions.find((session: any) => session.id === targetId)
    if (!target) {
        return { success: false, error: `Session not found: ${targetId}` }
    }
    target.archived = Boolean(archived)
    target.updatedAt = now()
    bridge.persistStateSoon()
    return { success: true }
}
export function bridgeSetSessionProjectPath(
    bridge: BridgeSessionContext,
    sessionId: string,
    projectPath: string
): { success: boolean; error?: string } {
    const targetId = String(sessionId || '').trim()
    if (!targetId) {
        return { success: false, error: 'sessionId is required.' }
    }
    const target = bridge.sessions.find((session: any) => session.id === targetId)
    if (!target) {
        return { success: false, error: `Session not found: ${targetId}` }
    }
    target.projectPath = String(projectPath || '').trim()
    target.updatedAt = now()
    bridge.persistStateSoon()
    return { success: true }
}
export function bridgeNewThread(bridge: BridgeSessionContext): { success: boolean; threadId: null; error?: string } {
    if (bridge.activeTurnId) {
        return { success: false, threadId: null, error: 'Cannot reset thread while a turn is active.' }
    }
    bridge.ensureActiveSession()
    bridge.threadId = null
    bridge.activeTurnId = null
    bridge.status.activeTurnId = null
    bridge.turnBuffers.clear()
    bridge.turnContexts.clear()
    bridge.turnAttemptGroupByTurnId.clear()
    bridge.reasoningTextsByTurn.clear()
    bridge.turnPartsByTurnId.clear()
    bridge.pendingApprovalRequests.clear()
    const activeSession = bridge.getActiveSession()
    if (activeSession) {
        activeSession.threadId = null
        activeSession.updatedAt = now()
    }
    bridge.persistStateSoon()
    bridge.emitEvent('status', { status: bridge.getStatus() })
    return { success: true, threadId: null }
}
export function bridgeEstimatePromptTokens(
    bridge: BridgeSessionContext,
    input: {
        prompt: string
        contextDiff?: string
        contextFiles?: Array<{
            path: string
            content?: string
            name?: string
            mimeType?: string
            kind?: 'image' | 'doc' | 'code' | 'file'
            sizeBytes?: number
            previewText?: string
        }>
        promptTemplate?: string
    }
): { success: boolean; tokens: number; chars: number } {
    const basePrompt = String(input.prompt || '').trim()
    const enriched = bridge.buildPromptWithContext(basePrompt, {
        contextDiff: input.contextDiff,
        contextFiles: input.contextFiles,
        promptTemplate: input.promptTemplate
    })
    const chars = enriched.length
    const tokens = Math.max(1, Math.ceil(chars / 4))
    return { success: true, tokens, chars }
}
export function bridgeGetTelemetryIntegrity(bridge: BridgeSessionContext): {
    success: boolean
    eventsStored: number
    monotonicDescending: boolean
    newestTimestamp: number | null
    oldestTimestamp: number | null
} {
    let monotonicDescending = true
    for (let i = 1; i < bridge.eventStore.length; i += 1) {
        if (bridge.eventStore[i - 1].timestamp < bridge.eventStore[i].timestamp) { monotonicDescending = false; break }
    }
    return {
        success: true,
        eventsStored: bridge.eventStore.length,
        monotonicDescending,
        newestTimestamp: bridge.eventStore[0]?.timestamp ?? null,
        oldestTimestamp: bridge.eventStore[bridge.eventStore.length - 1]?.timestamp ?? null
    }
}
