import { spawn, type ChildProcessByStdio } from 'child_process'
import { app, webContents } from 'electron'
import { EventEmitter } from 'events'
import { mkdir, readFile, writeFile } from 'fs/promises'
import log from 'electron-log'
import { dirname, join } from 'path'
import readline from 'readline'
import type { Readable, Writable } from 'stream'
import { getWorkingChangesForAI, getWorkingDiff } from '../inspectors/git/read'
import type {
    AssistantApprovalMode,
    AssistantConnectOptions,
    AssistantEventPayload,
    AssistantHistoryMessage,
    AssistantModelInfo,
    AssistantSendOptions,
    AssistantStatus
} from './types'

const REQUEST_TIMEOUT_MS = 120000
const CODEX_BIN = process.env.CODEX_BIN || 'codex'
const EVENT_RETENTION_LIMIT = 2000
const ASSISTANT_STATE_VERSION = 1
const RECONNECT_BASE_DELAY_MS = 1500
const RECONNECT_MAX_ATTEMPTS = 5

type BridgeProcess = ChildProcessByStdio<Writable, Readable, null>

type PendingRpcEntry = {
    resolve: (value: any) => void
    reject: (error: Error) => void
    timer: NodeJS.Timeout
    method: string
}

type TurnEventSource = 'modern' | 'legacy'
type TurnTerminalReason = 'completed' | 'failed' | 'interrupted' | 'cancelled'

type TurnBuffer = {
    draft: string
    pendingFinal: string | null
    source: TurnEventSource | null
}

type TurnContext = {
    attemptGroupId: string
}

type ActivityKind = 'command' | 'file' | 'search' | 'tool' | 'other'

type AssistantSessionSnapshot = {
    id: string
    title: string
    archived: boolean
    createdAt: number
    updatedAt: number
    history: AssistantHistoryMessage[]
    threadId: string | null
    projectPath?: string
}

type AssistantPersistedState = {
    version: number
    activeSessionId: string | null
    sessions: AssistantSessionSnapshot[]
    activeProfile?: string
    projectModelDefaults?: Record<string, string>
}

type JsonRpcNotification = {
    method?: string
    params?: Record<string, unknown>
}

function now(): number {
    return Date.now()
}

function createId(prefix: string): string {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

function isServerRequestMessage(message: Record<string, unknown>): boolean {
    return Object.prototype.hasOwnProperty.call(message, 'id')
        && Object.prototype.hasOwnProperty.call(message, 'method')
        && !Object.prototype.hasOwnProperty.call(message, 'result')
        && !Object.prototype.hasOwnProperty.call(message, 'error')
}

function extractTurnIdFromParams(params: Record<string, unknown> | undefined): string | null {
    if (!params) return null
    const direct = params.turnId
    if (typeof direct === 'string' && direct.trim()) return direct

    const turn = params.turn
    if (turn && typeof turn === 'object') {
        const turnId = (turn as Record<string, unknown>).id
        if (typeof turnId === 'string' && turnId.trim()) return turnId
    }
    return null
}

function extractLegacyTurnId(params: Record<string, unknown> | undefined): string | null {
    if (!params) return null
    const msg = params.msg
    if (!msg || typeof msg !== 'object') return null
    const payload = (msg as Record<string, unknown>).payload
    if (!payload || typeof payload !== 'object') return null
    const raw = (payload as Record<string, unknown>).turn_id
    if (typeof raw === 'string' && raw.trim()) return raw
    return null
}

function readString(value: unknown): string {
    return typeof value === 'string' ? value : ''
}

function readRecord(value: unknown): Record<string, unknown> | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null
    return value as Record<string, unknown>
}

function extractTurnError(params: Record<string, unknown>): string {
    const direct = readString(params.error).trim()
    if (direct) return direct

    const turn = readRecord(params.turn)
    const fromTurn = readString(turn?.error).trim()
    if (fromTurn) return fromTurn

    const details = readRecord(turn?.details)
    const fromDetails = readString(details?.message).trim()
    if (fromDetails) return fromDetails

    return ''
}

function normalizeToken(value: string): string {
    return value.replace(/[^a-z]/gi, '').toLowerCase()
}

function isAssistantLikeRole(value: unknown): boolean {
    const normalized = normalizeToken(readString(value))
    return normalized === 'assistant' || normalized === 'agent' || normalized === 'model'
}

function isAssistantMessageItem(item: Record<string, unknown>): boolean {
    const itemType = normalizeToken(readString(item.type))
    if (
        itemType === 'agentmessage'
        || itemType === 'assistantmessage'
        || itemType === 'message'
    ) {
        return true
    }

    return isAssistantLikeRole(item.role) || isAssistantLikeRole(item.author)
}

function readTextFromContent(value: unknown): string {
    if (!value) return ''
    if (typeof value === 'string') return value

    if (Array.isArray(value)) {
        return value.map((entry) => readTextFromContent(entry)).join('')
    }

    const record = readRecord(value)
    if (!record) return ''

    const direct = readString(record.text) || readString(record.value) || readString(record.message)
    if (direct) return direct

    return readTextFromContent(record.content || record.parts || record.output)
}

function extractCompletedAgentText(params: Record<string, unknown>): string {
    const item = readRecord(params.item)
    if (!item || !isAssistantMessageItem(item)) {
        return ''
    }

    const directText = readString(item.text).trim()
    if (directText) return directText

    const contentText = readTextFromContent(item.content || item.parts).trim()
    if (contentText) return contentText

    return readString(item.message).trim()
}

function parseModelList(result: unknown): AssistantModelInfo[] {
    const root = readRecord(result)
    const nestedData = readRecord(root?.data)
    const nestedResult = readRecord(root?.result)
    const dataCandidates: unknown[] = [
        result,
        root?.data,
        root?.models,
        nestedData?.models,
        root?.result,
        nestedResult?.data,
        nestedResult?.models
    ]

    const data = dataCandidates.find((candidate) => Array.isArray(candidate)) as unknown[] | undefined
    if (!data || data.length === 0) return []

    const models: AssistantModelInfo[] = []
    const seen = new Set<string>()

    for (const raw of data) {
        if (typeof raw === 'string') {
            const id = raw.trim()
            if (!id || seen.has(id)) continue
            models.push({ id, label: id, isDefault: false })
            seen.add(id)
            continue
        }

        const entry = readRecord(raw)
        if (!entry) continue

        const id = readString(entry.model) || readString(entry.id)
        if (!id || seen.has(id)) continue

        const displayName = readString(entry.displayName) || readString(entry.name)
        const capabilitiesRaw = (entry.capabilities || entry.tags || []) as unknown
        const capabilities = Array.isArray(capabilitiesRaw)
            ? capabilitiesRaw
                .map((capability) => {
                    if (typeof capability === 'string') return capability.trim()
                    const capRecord = readRecord(capability)
                    return readString(capRecord?.id || capRecord?.name || capRecord?.label).trim()
                })
                .filter(Boolean)
            : []
        models.push({
            id,
            label: displayName || id,
            isDefault: Boolean(entry.isDefault),
            capabilities: capabilities.length > 0 ? capabilities : undefined
        })
        seen.add(id)
    }

    if (models.length > 0 && !models.some((model) => model.isDefault)) {
        models[0].isDefault = true
    }

    return models
}

export class AssistantBridge extends EventEmitter {
    private subscribers = new Set<number>()
    private history: AssistantHistoryMessage[] = []
    private status: AssistantStatus = {
        connected: false,
        state: 'offline',
        approvalMode: 'safe',
        provider: 'codex',
        model: 'default',
        profile: 'safe-dev',
        activeTurnId: null,
        lastError: null
    }

    private proc: BridgeProcess | null = null
    private rl: readline.Interface | null = null
    private initialized = false
    private nextId = 1
    private pending = new Map<number, PendingRpcEntry>()
    private threadId: string | null = null
    private activeTurnId: string | null = null
    private turnBuffers = new Map<string, TurnBuffer>()
    private turnContexts = new Map<string, TurnContext>()
    private turnAttemptGroupByTurnId = new Map<string, string>()
    private reasoningTextsByTurn = new Map<string, string[]>()
    private lastReasoningDigestByTurn = new Map<string, string>()
    private lastActivityDigestByTurn = new Map<string, string>()
    private finalizedTurns = new Set<string>()
    private cancelledTurns = new Set<string>()
    private cachedModels: AssistantModelInfo[] = []
    private eventStore: AssistantEventPayload[] = []
    private sessions: AssistantSessionSnapshot[] = []
    private activeSessionId: string | null = null
    private persistenceLoaded = false
    private persistPath: string | null = null
    private projectModelDefaults = new Map<string, string>()
    private activeProfile = 'safe-dev'
    private reconnectAttempts = 0
    private reconnectTimer: NodeJS.Timeout | null = null

    public subscribe(webContentsId: number): { success: boolean } {
        this.subscribers.add(webContentsId)
        return { success: true }
    }

    public unsubscribe(webContentsId: number): { success: boolean } {
        this.subscribers.delete(webContentsId)
        return { success: true }
    }

    public async connect(options: AssistantConnectOptions = {}): Promise<{ success: boolean; status: AssistantStatus; error?: string }> {
        if (options.approvalMode) {
            this.status.approvalMode = options.approvalMode
        }
        if (options.profile && options.profile.trim()) {
            this.setProfile(options.profile)
        }
        if (options.model && options.model.trim()) {
            this.status.model = options.model.trim()
            if (options.projectPath && options.projectPath.trim()) {
                this.projectModelDefaults.set(options.projectPath.trim(), options.model.trim())
            }
        }

        if (this.status.connected && this.status.state === 'ready' && this.proc && !this.proc.killed) {
            return { success: true, status: this.getStatus() }
        }

        this.status.state = 'connecting'
        this.emitEvent('status', { status: this.getStatus() })

        try {
            await this.ensurePersistenceLoaded()
            this.ensureActiveSession()
            await this.ensureInitialized()
            this.clearReconnectTimer()
            this.reconnectAttempts = 0
            this.status.connected = true
            this.status.state = 'ready'
            this.status.lastError = null
            this.emitEvent('status', { status: this.getStatus() })
            return { success: true, status: this.getStatus() }
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to connect assistant bridge.'
            this.status.connected = false
            this.status.state = 'error'
            this.status.lastError = message
            this.emitEvent('error', { message })
            this.emitEvent('status', { status: this.getStatus() })
            return { success: false, status: this.getStatus(), error: message }
        }
    }

    public disconnect(): { success: boolean; status: AssistantStatus } {
        this.syncActiveSessionFromRuntime()
        this.clearReconnectTimer()
        this.reconnectAttempts = 0
        this.status.connected = false
        this.stopProcess()
        this.status.state = 'offline'
        this.status.activeTurnId = null
        this.status.lastError = null
        this.threadId = null
        const activeSession = this.getActiveSession()
        if (activeSession) {
            activeSession.threadId = null
            activeSession.updatedAt = now()
        }
        this.activeTurnId = null
        this.turnBuffers.clear()
        this.turnContexts.clear()
        this.turnAttemptGroupByTurnId.clear()
        this.reasoningTextsByTurn.clear()
        this.lastReasoningDigestByTurn.clear()
        this.lastActivityDigestByTurn.clear()
        this.finalizedTurns.clear()
        this.cancelledTurns.clear()
        this.cachedModels = []
        this.persistStateSoon()
        this.emitEvent('status', { status: this.getStatus() })
        return { success: true, status: this.getStatus() }
    }

    public getStatus(): AssistantStatus {
        return { ...this.status }
    }

    public setApprovalMode(mode: AssistantApprovalMode): { success: boolean; status: AssistantStatus } {
        this.status.approvalMode = mode === 'yolo' ? 'yolo' : 'safe'
        this.emitEvent('status', { status: this.getStatus() })
        return { success: true, status: this.getStatus() }
    }

    public getApprovalMode(): { success: boolean; mode: AssistantApprovalMode } {
        return { success: true, mode: this.status.approvalMode }
    }

    public getHistory(): {
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
    } {
        this.ensureActiveSession()
        this.syncActiveSessionFromRuntime()
        const attemptsByGroup = new Map<string, Array<{
            turnId: string | null
            attemptIndex: number
            text: string
            createdAt: number
            isActive: boolean
        }>>()

        for (const message of this.history) {
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
            history: [...this.history],
            activeSessionId: this.activeSessionId,
            sessions: this.sessions.map((session) => ({
                id: session.id,
                title: session.title,
                archived: session.archived,
                createdAt: session.createdAt,
                updatedAt: session.updatedAt,
                messageCount: session.history.length
            })),
            attempts
        }
    }

    public clearHistory(): { success: boolean } {
        this.ensureActiveSession()
        this.history = []
        this.turnAttemptGroupByTurnId.clear()
        this.turnContexts.clear()
        this.turnBuffers.clear()
        this.reasoningTextsByTurn.clear()
        this.lastReasoningDigestByTurn.clear()
        this.lastActivityDigestByTurn.clear()
        const activeSession = this.getActiveSession()
        if (activeSession) {
            activeSession.history = []
            activeSession.threadId = null
            activeSession.updatedAt = now()
        }
        this.threadId = null
        this.persistStateSoon()
        this.emitEvent('history', { history: [...this.history] })
        return { success: true }
    }

    public getEvents(options: {
        limit?: number
        types?: string[]
        search?: string
    } = {}): { success: boolean; events: AssistantEventPayload[] } {
        const normalizedLimit = Number.isFinite(Number(options.limit))
            ? Math.max(1, Math.min(5000, Number(options.limit)))
            : 200
        const typeFilter = Array.isArray(options.types)
            ? new Set(options.types.map((entry) => String(entry || '').trim()).filter(Boolean))
            : null
        const search = String(options.search || '').trim().toLowerCase()

        const filtered = this.eventStore.filter((event) => {
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

    public clearEvents(): { success: boolean } {
        this.eventStore = []
        return { success: true }
    }

    public exportEvents(): { success: boolean; format: 'json'; content: string } {
        return {
            success: true,
            format: 'json',
            content: JSON.stringify(this.eventStore, null, 2)
        }
    }

    public exportConversation(
        format: 'json' | 'markdown' = 'json',
        sessionId?: string
    ): { success: boolean; format: 'json' | 'markdown'; content: string; error?: string } {
        this.ensureActiveSession()
        this.syncActiveSessionFromRuntime()
        const targetSessionId = String(sessionId || this.activeSessionId || '').trim()
        const target = this.sessions.find((session) => session.id === targetSessionId) || this.getActiveSession()
        if (!target) {
            return { success: false, format, content: '', error: 'No session available to export.' }
        }

        if (format === 'markdown') {
            const lines: string[] = [
                `# Assistant Conversation`,
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

    public listSessions(): {
        success: boolean
        activeSessionId: string | null
        sessions: Array<{
            id: string
            title: string
            archived: boolean
            createdAt: number
            updatedAt: number
            messageCount: number
        }>
    } {
        this.ensureActiveSession()
        this.syncActiveSessionFromRuntime()
        return {
            success: true,
            activeSessionId: this.activeSessionId,
            sessions: this.sessions.map((session) => ({
                id: session.id,
                title: session.title,
                archived: session.archived,
                createdAt: session.createdAt,
                updatedAt: session.updatedAt,
                messageCount: session.history.length
            }))
        }
    }

    public listProfiles(): {
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
            activeProfile: this.activeProfile,
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

    public setProfile(profileId: string): { success: boolean; profile: string } {
        const normalized = String(profileId || '').trim().toLowerCase()
        const selected = normalized || 'safe-dev'
        this.activeProfile = selected
        this.status.profile = selected
        if (selected === 'yolo-fast') {
            this.status.approvalMode = 'yolo'
        } else {
            this.status.approvalMode = 'safe'
        }
        this.persistStateSoon()
        this.emitEvent('status', { status: this.getStatus() })
        return { success: true, profile: selected }
    }

    public getProjectModelDefault(projectPath: string): { success: boolean; model: string | null } {
        const key = String(projectPath || '').trim()
        if (!key) return { success: true, model: null }
        return { success: true, model: this.projectModelDefaults.get(key) || null }
    }

    public setProjectModelDefault(projectPath: string, model: string): { success: boolean; error?: string } {
        const key = String(projectPath || '').trim()
        const nextModel = String(model || '').trim()
        if (!key || !nextModel) {
            return { success: false, error: 'projectPath and model are required.' }
        }
        this.projectModelDefaults.set(key, nextModel)
        this.persistStateSoon()
        return { success: true }
    }

    public createSession(title?: string): { success: boolean; session: { id: string; title: string } } {
        this.ensureActiveSession()
        this.syncActiveSessionFromRuntime()
        const createdAt = now()
        const id = createId('session')
        const cleanTitle = String(title || '').trim()
        const session: AssistantSessionSnapshot = {
            id,
            title: cleanTitle || `Session ${this.sessions.length + 1}`,
            archived: false,
            createdAt,
            updatedAt: createdAt,
            history: [],
            threadId: null
        }
        this.sessions.unshift(session)
        this.activeSessionId = session.id
        this.history = []
        this.threadId = null
        this.activeTurnId = null
        this.status.activeTurnId = null
        this.turnBuffers.clear()
        this.turnContexts.clear()
        this.turnAttemptGroupByTurnId.clear()
        this.reasoningTextsByTurn.clear()
        this.persistStateSoon()
        this.emitEvent('history', { history: [...this.history] })
        this.emitEvent('status', { status: this.getStatus() })
        return {
            success: true,
            session: { id: session.id, title: session.title }
        }
    }

    public selectSession(sessionId: string): { success: boolean; error?: string } {
        const targetId = String(sessionId || '').trim()
        if (!targetId) {
            return { success: false, error: 'sessionId is required.' }
        }
        if (this.activeTurnId) {
            return { success: false, error: 'Cannot switch session while a turn is active.' }
        }

        this.ensureActiveSession()
        this.syncActiveSessionFromRuntime()
        const target = this.sessions.find((session) => session.id === targetId && !session.archived)
        if (!target) {
            return { success: false, error: `Session not found: ${targetId}` }
        }

        this.activeSessionId = target.id
        this.history = [...target.history]
        this.threadId = target.threadId
        this.turnBuffers.clear()
        this.turnContexts.clear()
        this.turnAttemptGroupByTurnId.clear()
        this.reasoningTextsByTurn.clear()
        this.finalizedTurns.clear()
        this.cancelledTurns.clear()
        this.status.activeTurnId = null
        this.activeTurnId = null
        target.updatedAt = now()
        this.persistStateSoon()
        this.emitEvent('history', { history: [...this.history] })
        this.emitEvent('status', { status: this.getStatus() })
        return { success: true }
    }

    public renameSession(sessionId: string, title: string): { success: boolean; error?: string } {
        const targetId = String(sessionId || '').trim()
        const nextTitle = String(title || '').trim()
        if (!targetId || !nextTitle) {
            return { success: false, error: 'sessionId and title are required.' }
        }

        const target = this.sessions.find((session) => session.id === targetId)
        if (!target) {
            return { success: false, error: `Session not found: ${targetId}` }
        }

        target.title = nextTitle
        target.updatedAt = now()
        this.persistStateSoon()
        return { success: true }
    }

    public deleteSession(sessionId: string): { success: boolean; error?: string } {
        const targetId = String(sessionId || '').trim()
        if (!targetId) {
            return { success: false, error: 'sessionId is required.' }
        }

        const index = this.sessions.findIndex((session) => session.id === targetId)
        if (index < 0) {
            return { success: false, error: `Session not found: ${targetId}` }
        }

        this.sessions.splice(index, 1)
        if (this.sessions.length === 0) {
            this.sessions.push(this.createDefaultSession())
        }

        if (this.activeSessionId === targetId) {
            const replacement = this.sessions.find((session) => !session.archived) || this.sessions[0]
            this.activeSessionId = replacement.id
            this.history = [...replacement.history]
            this.threadId = replacement.threadId
            this.activeTurnId = null
            this.status.activeTurnId = null
        }

        this.persistStateSoon()
        this.emitEvent('history', { history: [...this.history] })
        this.emitEvent('status', { status: this.getStatus() })
        return { success: true }
    }

    public archiveSession(sessionId: string, archived = true): { success: boolean; error?: string } {
        const targetId = String(sessionId || '').trim()
        if (!targetId) {
            return { success: false, error: 'sessionId is required.' }
        }

        const target = this.sessions.find((session) => session.id === targetId)
        if (!target) {
            return { success: false, error: `Session not found: ${targetId}` }
        }

        target.archived = Boolean(archived)
        target.updatedAt = now()
        this.persistStateSoon()
        return { success: true }
    }

    public newThread(): { success: boolean; threadId: null; error?: string } {
        if (this.activeTurnId) {
            return { success: false, threadId: null, error: 'Cannot reset thread while a turn is active.' }
        }
        this.ensureActiveSession()
        this.threadId = null
        this.activeTurnId = null
        this.status.activeTurnId = null
        this.turnBuffers.clear()
        this.turnContexts.clear()
        this.turnAttemptGroupByTurnId.clear()
        this.reasoningTextsByTurn.clear()
        const activeSession = this.getActiveSession()
        if (activeSession) {
            activeSession.threadId = null
            activeSession.updatedAt = now()
        }
        this.persistStateSoon()
        this.emitEvent('status', { status: this.getStatus() })
        return { success: true, threadId: null }
    }

    public estimatePromptTokens(input: {
        prompt: string
        contextDiff?: string
        contextFiles?: Array<{ path: string; content?: string }>
        promptTemplate?: string
    }): { success: boolean; tokens: number; chars: number } {
        const basePrompt = String(input.prompt || '').trim()
        const enriched = this.buildPromptWithContext(basePrompt, {
            contextDiff: input.contextDiff,
            contextFiles: input.contextFiles,
            promptTemplate: input.promptTemplate
        })
        const chars = enriched.length
        const tokens = Math.max(1, Math.ceil(chars / 4))
        return { success: true, tokens, chars }
    }

    public getTelemetryIntegrity(): {
        success: boolean
        eventsStored: number
        monotonicDescending: boolean
        newestTimestamp: number | null
        oldestTimestamp: number | null
    } {
        let monotonicDescending = true
        for (let i = 1; i < this.eventStore.length; i += 1) {
            if (this.eventStore[i - 1].timestamp < this.eventStore[i].timestamp) {
                monotonicDescending = false
                break
            }
        }
        return {
            success: true,
            eventsStored: this.eventStore.length,
            monotonicDescending,
            newestTimestamp: this.eventStore[0]?.timestamp ?? null,
            oldestTimestamp: this.eventStore[this.eventStore.length - 1]?.timestamp ?? null
        }
    }

    public async runWorkflow(input: {
        kind: 'explain-diff' | 'review-staged' | 'draft-commit'
        projectPath: string
        filePath?: string
        model?: string
    }): Promise<{ success: boolean; turnId?: string; error?: string; workflow: string }> {
        const projectPath = String(input.projectPath || '').trim()
        if (!projectPath) {
            return { success: false, error: 'projectPath is required.', workflow: input.kind }
        }

        this.emitEvent('workflow-status', {
            workflow: input.kind,
            status: 'started',
            projectPath,
            filePath: input.filePath || null
        })

        try {
            let contextDiff = ''
            if (input.kind === 'review-staged' || input.kind === 'draft-commit') {
                contextDiff = await getWorkingChangesForAI(projectPath)
            } else {
                contextDiff = await getWorkingDiff(projectPath, input.filePath)
            }

            if (!contextDiff || contextDiff.trim() === 'No changes') {
                const error = 'No relevant changes found for workflow.'
                this.emitEvent('workflow-status', {
                    workflow: input.kind,
                    status: 'failed',
                    projectPath,
                    error
                })
                return { success: false, error, workflow: input.kind }
            }

            const prompt = input.kind === 'explain-diff'
                ? 'Explain this diff with key changes, risks, and likely runtime impact.'
                : input.kind === 'review-staged'
                    ? 'Review these staged/working changes and list findings ordered by severity with file references.'
                    : 'Draft a high-quality commit message for these changes with a concise subject and body bullets.'

            const profile = input.kind === 'draft-commit' ? 'safe-dev' : 'review'
            const result = await this.sendPrompt(prompt, {
                model: input.model,
                projectPath,
                profile,
                contextDiff,
                promptTemplate: `Workflow: ${input.kind}`
            })

            this.emitEvent('workflow-status', {
                workflow: input.kind,
                status: result.success ? 'submitted' : 'failed',
                projectPath,
                turnId: result.turnId || null,
                error: result.error || null
            })

            return {
                success: Boolean(result.success),
                turnId: result.turnId,
                error: result.error,
                workflow: input.kind
            }
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Workflow execution failed.'
            this.emitEvent('workflow-status', {
                workflow: input.kind,
                status: 'failed',
                projectPath,
                error: message
            })
            return { success: false, error: message, workflow: input.kind }
        }
    }

    public async listModels(forceRefresh = false): Promise<{ success: boolean; models: AssistantModelInfo[]; error?: string }> {
        if (!forceRefresh && this.cachedModels.length > 0) {
            return { success: true, models: [...this.cachedModels] }
        }

        try {
            await this.ensureInitialized()
            const result = await this.requestWithRetry('model/list', {
                limit: 100,
                includeHidden: false
            }, { retries: 1 })
            const models = parseModelList(result)
            this.cachedModels = models
            return { success: true, models: [...models] }
        } catch (error) {
            return {
                success: false,
                models: [],
                error: error instanceof Error ? error.message : 'Failed to load assistant models.'
            }
        }
    }

    public async cancelTurn(turnId?: string): Promise<{ success: boolean; error?: string }> {
        const targetTurnId = turnId || this.activeTurnId
        if (!targetTurnId || !this.threadId) {
            return { success: false, error: 'No active turn to cancel.' }
        }

        this.cancelledTurns.add(targetTurnId)

        try {
            await this.requestWithRetry('turn/interrupt', {
                threadId: this.threadId,
                turnId: targetTurnId
            }, { retries: 1 })
            this.finalizeTurn(targetTurnId, {
                success: false,
                reason: 'cancelled'
            })
            return { success: true }
        } catch (error) {
            this.cancelledTurns.delete(targetTurnId)
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to cancel turn.'
            }
        }
    }

    public async sendPrompt(
        prompt: string,
        options: AssistantSendOptions = {}
    ): Promise<{ success: boolean; turnId?: string; error?: string }> {
        const userPrompt = String(prompt || '').trim()
        if (!userPrompt && !options.regenerateFromTurnId) {
            return { success: false, error: 'Prompt is required.' }
        }

        if (options.approvalMode) {
            this.status.approvalMode = options.approvalMode
        }
        if (options.model && options.model.trim()) {
            this.status.model = options.model.trim()
        }

        if (this.activeTurnId) {
            return { success: false, error: 'A turn is already in progress.' }
        }

        try {
            await this.ensureInitialized()
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Assistant is not connected.'
            this.status.connected = false
            this.status.state = 'error'
            this.status.lastError = message
            this.emitEvent('error', { message })
            this.emitEvent('status', { status: this.getStatus() })
            return { success: false, error: message }
        }

        this.ensureActiveSession()

        const regenerationTargetTurnId = readString(options.regenerateFromTurnId).trim()
        let effectivePrompt = userPrompt
        let attemptGroupIdSeed: string | null = null

        if (regenerationTargetTurnId) {
            const assistantTarget = this.findAssistantMessageByTurnId(regenerationTargetTurnId)
            if (!assistantTarget) {
                return { success: false, error: `Cannot regenerate unknown turn: ${regenerationTargetTurnId}` }
            }
            const sourcePrompt = this.findSourcePromptForAssistantTurn(regenerationTargetTurnId)
            if (!sourcePrompt) {
                return { success: false, error: `Cannot derive prompt for turn: ${regenerationTargetTurnId}` }
            }
            effectivePrompt = sourcePrompt
            attemptGroupIdSeed = assistantTarget.attemptGroupId || regenerationTargetTurnId
        } else {
            const userMessage: AssistantHistoryMessage = {
                id: createId('msg'),
                role: 'user',
                text: effectivePrompt,
                createdAt: now()
            }
            this.history.push(userMessage)
            this.emitEvent('history', { history: [...this.history] })
        }

        effectivePrompt = this.buildPromptWithContext(effectivePrompt, options)

        try {
            let resolvedModel = await this.resolveSelectedModel(options.projectPath)
            let threadId: string
            try {
                threadId = await this.ensureThread(resolvedModel)
            } catch (error) {
                if (!resolvedModel || !this.isMissingModelError(error)) {
                    throw error
                }
                const fallbackModel = await this.resolveSelectedModel()
                if (!fallbackModel || fallbackModel === resolvedModel) {
                    throw error
                }
                resolvedModel = fallbackModel
                this.status.model = fallbackModel
                if (options.projectPath && options.projectPath.trim()) {
                    this.projectModelDefaults.set(options.projectPath.trim(), fallbackModel)
                }
                threadId = await this.ensureThread(resolvedModel)
            }
            const turnStartParams: Record<string, unknown> = {
                threadId,
                input: [{ type: 'text', text: effectivePrompt }],
                approvalPolicy: this.status.approvalMode === 'yolo' ? 'on-request' : 'never'
            }
            if (resolvedModel) {
                turnStartParams.model = resolvedModel
                this.status.model = resolvedModel
                if (options.projectPath && options.projectPath.trim()) {
                    this.projectModelDefaults.set(options.projectPath.trim(), resolvedModel)
                }
            }

            let turnStartResult: unknown
            try {
                turnStartResult = await this.requestWithRetry('turn/start', turnStartParams, { retries: 1 })
            } catch (error) {
                if (!resolvedModel || !this.isMissingModelError(error)) {
                    throw error
                }
                const fallbackModel = await this.resolveSelectedModel()
                if (!fallbackModel || fallbackModel === resolvedModel) {
                    throw error
                }
                turnStartParams.model = fallbackModel
                this.status.model = fallbackModel
                turnStartResult = await this.requestWithRetry('turn/start', turnStartParams, { retries: 1 })
            }

            const turnId = readString((turnStartResult as any)?.turn?.id || '')
            if (!turnId) {
                throw new Error('turn/start did not return turn.id')
            }

            this.activeTurnId = turnId
            this.status.activeTurnId = turnId
            this.status.connected = true
            this.status.state = 'ready'
            this.status.lastError = null
            this.turnBuffers.set(turnId, { draft: '', pendingFinal: null, source: null })
            this.reasoningTextsByTurn.set(turnId, [])
            const attemptGroupId = attemptGroupIdSeed || turnId
            this.turnContexts.set(turnId, { attemptGroupId })
            this.turnAttemptGroupByTurnId.set(turnId, attemptGroupId)
            this.finalizedTurns.delete(turnId)
            this.cancelledTurns.delete(turnId)
            this.emitEvent('turn-start', { turnId })
            this.emitEvent('status', { status: this.getStatus() })
            this.syncActiveSessionFromRuntime()
            this.persistStateSoon()
            return { success: true, turnId }
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to start turn.'
            this.status.state = 'error'
            this.status.lastError = message
            this.emitEvent('error', { message })
            this.emitEvent('status', { status: this.getStatus() })
            return { success: false, error: message }
        }
    }

    public cleanup(): void {
        this.disconnect()
    }

    private async ensureInitialized(): Promise<void> {
        await this.startProcess()
        if (this.initialized) return

        await this.requestWithRetry('initialize', {
            clientInfo: {
                name: 'devscope_assistant_bridge',
                title: 'DevScope Assistant Bridge',
                version: '0.1.0'
            }
        }, { retries: 1 })
        this.notify('initialized', {})
        this.initialized = true
    }

    private async startProcess(): Promise<void> {
        if (this.proc && !this.proc.killed) {
            return
        }

        const proc = spawn(CODEX_BIN, ['app-server'], {
            stdio: ['pipe', 'pipe', 'inherit'],
            shell: process.platform === 'win32'
        })
        this.proc = proc

        proc.on('error', (error) => {
            const shouldAttemptReconnect = this.status.connected
            const message = (error as NodeJS.ErrnoException).code === 'ENOENT'
                ? `Could not find ${CODEX_BIN} in PATH`
                : (error instanceof Error ? error.message : 'Assistant bridge process failed.')
            this.failPending(new Error(message))
            this.threadId = null
            this.activeTurnId = null
            this.turnBuffers.clear()
            this.turnContexts.clear()
            this.turnAttemptGroupByTurnId.clear()
            this.reasoningTextsByTurn.clear()
            this.lastReasoningDigestByTurn.clear()
            this.lastActivityDigestByTurn.clear()
            this.finalizedTurns.clear()
            this.cancelledTurns.clear()
            this.cachedModels = []
            this.status.connected = false
            this.status.state = 'error'
            this.status.lastError = message
            this.status.activeTurnId = null
            const activeSession = this.getActiveSession()
            if (activeSession) {
                activeSession.threadId = null
                activeSession.updatedAt = now()
            }
            this.persistStateSoon()
            this.emitEvent('error', { message })
            this.emitEvent('status', { status: this.getStatus() })
            this.proc = null
            this.initialized = false
            if (shouldAttemptReconnect) {
                this.scheduleReconnect()
            }
        })

        proc.on('exit', (code, signal) => {
            const shouldAttemptReconnect = this.status.connected
            const message = `codex app-server exited (code=${code}, signal=${signal})`
            this.failPending(new Error(message))
            this.proc = null
            this.initialized = false
            this.threadId = null
            this.activeTurnId = null
            this.turnBuffers.clear()
            this.turnContexts.clear()
            this.turnAttemptGroupByTurnId.clear()
            this.reasoningTextsByTurn.clear()
            this.lastReasoningDigestByTurn.clear()
            this.lastActivityDigestByTurn.clear()
            this.finalizedTurns.clear()
            this.cancelledTurns.clear()
            this.cachedModels = []
            this.status.connected = false
            this.status.state = 'offline'
            this.status.activeTurnId = null
            const activeSession = this.getActiveSession()
            if (activeSession) {
                activeSession.threadId = null
                activeSession.updatedAt = now()
            }
            this.persistStateSoon()
            this.emitEvent('status', { status: this.getStatus() })
            if (this.rl) {
                this.rl.close()
                this.rl = null
            }
            if (shouldAttemptReconnect) {
                this.scheduleReconnect()
            }
        })

        this.rl = readline.createInterface({ input: proc.stdout })
        this.rl.on('line', (line) => {
            let message: Record<string, unknown>
            try {
                message = JSON.parse(line) as Record<string, unknown>
            } catch {
                this.emitEvent('error', { message: line })
                return
            }

            if (Object.prototype.hasOwnProperty.call(message, 'id')) {
                if (isServerRequestMessage(message)) {
                    this.handleServerRequest(message)
                    return
                }
                this.resolvePending(message)
                return
            }

            if (typeof message.method === 'string') {
                this.handleNotification(message as JsonRpcNotification)
            }
        })
    }

    private stopProcess(): void {
        this.clearReconnectTimer()
        if (this.rl) {
            this.rl.close()
            this.rl = null
        }

        if (this.proc && !this.proc.killed) {
            this.proc.kill()
        }
        this.proc = null
        this.initialized = false
        this.threadId = null
        this.activeTurnId = null
        this.turnBuffers.clear()
        this.turnContexts.clear()
        this.turnAttemptGroupByTurnId.clear()
        this.reasoningTextsByTurn.clear()
        this.lastReasoningDigestByTurn.clear()
        this.lastActivityDigestByTurn.clear()
        this.finalizedTurns.clear()
        this.cancelledTurns.clear()
        this.cachedModels = []
        this.status.activeTurnId = null
        const activeSession = this.getActiveSession()
        if (activeSession) {
            activeSession.threadId = null
            activeSession.updatedAt = now()
        }
        this.persistStateSoon()
        this.failPending(new Error('Bridge stopped'))
    }

    private request(method: string, params: Record<string, unknown> = {}, timeoutMs = REQUEST_TIMEOUT_MS): Promise<any> {
        if (!this.proc || !this.proc.stdin.writable) {
            return Promise.reject(new Error('Bridge is not connected'))
        }

        const id = this.nextId++
        this.send({ method, id, params })

        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                this.pending.delete(id)
                reject(new Error(`Timeout waiting for ${method}`))
            }, timeoutMs)
            this.pending.set(id, { resolve, reject, timer, method })
        })
    }

    private notify(method: string, params: Record<string, unknown> = {}): void {
        if (!this.proc || !this.proc.stdin.writable) return
        this.send({ method, params })
    }

    private send(message: Record<string, unknown>): void {
        if (!this.proc || !this.proc.stdin.writable) return
        this.proc.stdin.write(`${JSON.stringify(message)}\n`)
    }

    private resolvePending(message: Record<string, unknown>): void {
        const id = Number(message.id)
        const entry = this.pending.get(id)
        if (!entry) return

        clearTimeout(entry.timer)
        this.pending.delete(id)

        if (message.error) {
            entry.reject(new Error(`RPC ${entry.method} failed: ${JSON.stringify(message.error)}`))
            return
        }

        entry.resolve(message.result)
    }

    private failPending(error: Error): void {
        for (const entry of this.pending.values()) {
            clearTimeout(entry.timer)
            entry.reject(error)
        }
        this.pending.clear()
    }

    private handleServerRequest(message: Record<string, unknown>): void {
        const method = readString(message.method)
        const id = Number(message.id)
        if (!Number.isFinite(id)) return

        if (method === 'item/commandExecution/requestApproval' || method === 'item/fileChange/requestApproval') {
            const decision = this.status.approvalMode === 'yolo' ? 'acceptForSession' : 'decline'
            const requestPayload = readRecord(message.params) || {}
            this.emitEvent('approval-request', {
                requestId: id,
                method,
                mode: this.status.approvalMode,
                decision,
                request: requestPayload
            })
            this.send({ id, result: { decision } })
            this.emitEvent('approval-decision', {
                requestId: id,
                method,
                mode: this.status.approvalMode,
                decision
            })
            return
        }

        this.send({
            id,
            error: {
                code: -32601,
                message: `Unsupported server request method: ${method}`
            }
        })
    }

    private handleNotification(message: JsonRpcNotification): void {
        const method = readString(message.method)
        const params = (message.params || {}) as Record<string, unknown>

        if (method === 'item/agentMessage/delta') {
            const turnId = extractTurnIdFromParams(params) || this.activeTurnId
            const delta = readString(params.delta)
                || readString(params.textDelta)
                || readString(params.outputTextDelta)
            if (!turnId || !delta) return
            const buffer = this.claimTurnBuffer(turnId, 'modern')
            if (!buffer) return
            buffer.draft += delta
            this.emitEvent('assistant-delta', { turnId, delta, text: buffer.draft })
            return
        }

        if (method === 'item/completed') {
            const text = extractCompletedAgentText(params)
            if (!text) return
            const turnId = extractTurnIdFromParams(params) || this.activeTurnId
            if (!turnId) return
            const buffer = this.claimTurnBuffer(turnId, 'modern')
            if (!buffer) return
            buffer.pendingFinal = text
            return
        }

        if (method === 'turn/completed') {
            const turnId = extractTurnIdFromParams(params) || this.activeTurnId
            if (!turnId) return
            this.finalizeTurn(turnId, {
                success: true,
                reason: 'completed'
            })
            return
        }

        if (method === 'turn/failed' || method === 'turn/interrupted' || method === 'turn/cancelled') {
            const turnId = extractTurnIdFromParams(params) || this.activeTurnId
            if (!turnId) return
            const reason: TurnTerminalReason = method === 'turn/failed'
                ? 'failed'
                : method === 'turn/interrupted'
                    ? 'interrupted'
                    : 'cancelled'
            const error = extractTurnError(params)
            this.finalizeTurn(turnId, {
                success: false,
                reason,
                errorMessage: error
            })
            return
        }

        if (this.handleReasoningNotification(method, params)) {
            return
        }

        if (this.handleActivityNotification(method, params)) {
            return
        }

        if (method.startsWith('codex/event/')) {
            this.handleLegacyNotification(method, params)
        }
    }

    private handleLegacyNotification(method: string, params: Record<string, unknown>): void {
        const msg = params.msg as Record<string, unknown> | undefined
        const payload = (msg?.payload || {}) as Record<string, unknown>
        const eventType = readString(msg?.type)
        const turnId = extractLegacyTurnId(params) || this.activeTurnId

        if (!turnId) return

        if (eventType === 'agent_message_delta' || eventType === 'agent_message_content_delta') {
            const delta = readString(payload.delta)
            if (!delta) return
            const buffer = this.claimTurnBuffer(turnId, 'legacy')
            if (!buffer) return
            buffer.draft += delta
            this.emitEvent('assistant-delta', { turnId, delta, text: buffer.draft })
            return
        }

        if (eventType === 'agent_message') {
            const text = readString(payload.message).trim()
            if (!text) return
            const buffer = this.claimTurnBuffer(turnId, 'legacy')
            if (!buffer) return
            buffer.pendingFinal = text
            return
        }

        if (eventType === 'task_complete' || method === 'codex/event/task_complete') {
            const finalText = readString(payload.last_agent_message).trim()
            this.finalizeTurn(turnId, {
                success: true,
                reason: 'completed',
                explicitFinalText: finalText
            })
            return
        }

        if (eventType === 'task_failed' || eventType === 'task_error' || method === 'codex/event/task_failed') {
            const error = readString(payload.error).trim() || readString(payload.message).trim()
            this.finalizeTurn(turnId, {
                success: false,
                reason: 'failed',
                errorMessage: error
            })
            return
        }

        if (eventType === 'task_interrupted' || method === 'codex/event/task_interrupted') {
            const error = readString(payload.error).trim() || readString(payload.message).trim()
            this.finalizeTurn(turnId, {
                success: false,
                reason: 'interrupted',
                errorMessage: error
            })
            return
        }

        if (
            eventType === 'task_cancelled'
            || eventType === 'task_canceled'
            || method === 'codex/event/task_cancelled'
            || method === 'codex/event/task_canceled'
        ) {
            this.finalizeTurn(turnId, {
                success: false,
                reason: 'cancelled'
            })
            return
        }

        if (this.handleLegacyReasoningNotification(turnId, eventType, payload, method)) {
            return
        }

        if (this.handleLegacyActivityNotification(turnId, eventType, payload, method)) {
            return
        }
    }

    private claimTurnBuffer(turnId: string, source: TurnEventSource): TurnBuffer | null {
        if (this.finalizedTurns.has(turnId)) {
            return null
        }

        const buffer = this.ensureTurnBuffer(turnId)
        if (!buffer.source) {
            buffer.source = source
            return buffer
        }

        return buffer.source === source ? buffer : null
    }

    private ensureTurnBuffer(turnId: string): TurnBuffer {
        const existing = this.turnBuffers.get(turnId)
        if (existing) return existing
        const created: TurnBuffer = { draft: '', pendingFinal: null, source: null }
        this.turnBuffers.set(turnId, created)
        return created
    }

    private finalizeTurn(
        turnId: string,
        outcome: {
            success: boolean
            reason: TurnTerminalReason
            explicitFinalText?: string
            errorMessage?: string
        }
    ): void {
        if (!this.markTurnFinalized(turnId)) {
            this.cancelledTurns.delete(turnId)
            return
        }

        const buffer = this.turnBuffers.get(turnId) || { draft: '', pendingFinal: null, source: null }
        const turnContext = this.turnContexts.get(turnId)
        const attemptGroupId = turnContext?.attemptGroupId || this.turnAttemptGroupByTurnId.get(turnId) || turnId
        const wasCancelledByRequest = this.cancelledTurns.delete(turnId)
        const terminalReason: TurnTerminalReason = (outcome.reason === 'cancelled' || wasCancelledByRequest)
            ? 'cancelled'
            : outcome.reason
        const shouldLockFinal = outcome.success && terminalReason === 'completed'
        const explicitFinalText = (outcome.explicitFinalText || '').trim()
        const finalText = shouldLockFinal
            ? explicitFinalText || buffer.pendingFinal?.trim() || buffer.draft.trim()
            : ''

        if (shouldLockFinal && finalText) {
            const persistedReasoningText = (this.reasoningTextsByTurn.get(turnId) || [])
                .map((part) => String(part || ''))
                .filter(Boolean)
                .join('\n\n')
                .trim()
            const existingAttemptIndexes = this.history
                .filter((message) => message.role === 'assistant' && message.attemptGroupId === attemptGroupId)
                .map((message) => message.attemptIndex || 0)
            const nextAttemptIndex = (existingAttemptIndexes.length > 0 ? Math.max(...existingAttemptIndexes) : 0) + 1

            for (const message of this.history) {
                if (message.role === 'assistant' && message.attemptGroupId === attemptGroupId) {
                    message.isActiveAttempt = false
                }
            }

            const assistantMessage: AssistantHistoryMessage = {
                id: createId('msg'),
                role: 'assistant',
                text: finalText,
                reasoningText: persistedReasoningText || undefined,
                createdAt: now(),
                turnId,
                attemptGroupId,
                attemptIndex: nextAttemptIndex,
                isActiveAttempt: true
            }
            this.history.push(assistantMessage)
            this.turnAttemptGroupByTurnId.set(turnId, attemptGroupId)
            this.emitEvent('assistant-final', {
                turnId,
                text: finalText,
                attemptGroupId,
                attemptIndex: nextAttemptIndex,
                model: this.status.model,
                provider: this.status.provider
            })
            this.emitEvent('history', { history: [...this.history] })
        }

        if (terminalReason === 'cancelled') {
            this.emitEvent('turn-cancelled', { turnId })
        }

        const errorMessage = (outcome.errorMessage || '').trim()
        if ((terminalReason === 'failed' || terminalReason === 'interrupted') && errorMessage) {
            this.status.lastError = errorMessage
            this.emitEvent('error', { message: errorMessage, turnId, outcome: terminalReason })
        } else {
            this.status.lastError = null
        }

        if (this.activeTurnId === turnId) {
            this.activeTurnId = null
            this.status.activeTurnId = null
        }

        this.turnBuffers.delete(turnId)
        this.turnContexts.delete(turnId)
        this.reasoningTextsByTurn.delete(turnId)
        this.lastReasoningDigestByTurn.delete(turnId)
        this.lastActivityDigestByTurn.delete(turnId)
        this.status.state = this.status.connected ? 'ready' : 'offline'
        const completionPayload: Record<string, unknown> = {
            turnId,
            success: terminalReason === 'completed',
            outcome: terminalReason,
            attemptGroupId
        }
        if (errorMessage) {
            completionPayload.error = errorMessage
        }
        this.emitEvent('turn-complete', completionPayload)
        this.emitEvent('status', { status: this.getStatus() })
        this.syncActiveSessionFromRuntime()
        this.persistStateSoon()
    }

    private markTurnFinalized(turnId: string): boolean {
        if (this.finalizedTurns.has(turnId)) {
            return false
        }

        this.finalizedTurns.add(turnId)
        if (this.finalizedTurns.size > 500) {
            const oldestTurnId = this.finalizedTurns.values().next().value as string | undefined
            if (oldestTurnId) {
                this.finalizedTurns.delete(oldestTurnId)
            }
        }
        return true
    }

    private async resolveSelectedModel(projectPath?: string): Promise<string | null> {
        const projectKey = String(projectPath || '').trim()
        const projectDefault = projectKey ? this.projectModelDefaults.get(projectKey) : null
        const selected = (projectDefault || this.status.model).trim()
        const listed = await this.listModels()
        const knownModels = listed.success ? listed.models : []

        if (selected && selected !== 'default') {
            if (knownModels.length === 0) {
                return selected
            }
            const exactMatch = knownModels.find((model) => model.id === selected)
            if (exactMatch) {
                return exactMatch.id
            }
            return knownModels.find((model) => model.isDefault)?.id || knownModels[0].id
        }

        if (knownModels.length === 0) {
            return null
        }
        return knownModels.find((model) => model.isDefault)?.id || knownModels[0].id
    }

    private async ensureThread(model: string | null): Promise<string> {
        if (this.threadId) return this.threadId

        const threadStartParams: Record<string, unknown> = {
            approvalPolicy: this.status.approvalMode === 'yolo' ? 'on-request' : 'never'
        }
        if (model) {
            threadStartParams.model = model
        }

        const started = await this.requestWithRetry('thread/start', threadStartParams, { retries: 1 })

        const threadId = readString((started as any)?.thread?.id || '')
        if (!threadId) {
            throw new Error('thread/start did not return thread.id')
        }

        this.threadId = threadId
        return threadId
    }

    private buildPromptWithContext(prompt: string, options: AssistantSendOptions): string {
        const cleanPrompt = String(prompt || '').trim()
        const template = readString(options.promptTemplate).trim()
        const contextDiff = readString(options.contextDiff).trim()
        const contextFiles = Array.isArray(options.contextFiles)
            ? options.contextFiles
                .map((entry) => ({
                    path: readString((entry as Record<string, unknown>)?.path).trim(),
                    content: readString((entry as Record<string, unknown>)?.content).trim()
                }))
                .filter((entry) => entry.path || entry.content)
            : []

        if (!template && !contextDiff && contextFiles.length === 0) {
            return cleanPrompt
        }

        const sections: string[] = []
        if (template) {
            sections.push('## Prompt Template')
            sections.push(template)
        }
        if (contextFiles.length > 0) {
            sections.push('## Selected Files')
            for (const file of contextFiles.slice(0, 20)) {
                sections.push(`### ${file.path || '(inline snippet)'}`)
                sections.push(file.content || '(no content provided)')
            }
        }
        if (contextDiff) {
            sections.push('## Diff Context')
            sections.push(contextDiff)
        }
        sections.push('## User Prompt')
        sections.push(cleanPrompt)

        return sections.join('\n\n').trim()
    }

    private createDefaultSession(): AssistantSessionSnapshot {
        const createdAt = now()
        return {
            id: createId('session'),
            title: 'Session 1',
            archived: false,
            createdAt,
            updatedAt: createdAt,
            history: [],
            threadId: null
        }
    }

    private ensureActiveSession(): void {
        if (this.sessions.length === 0) {
            const created = this.createDefaultSession()
            this.sessions = [created]
            this.activeSessionId = created.id
            this.history = []
            this.threadId = null
            return
        }

        const current = this.getActiveSession()
        if (current) return

        const fallback = this.sessions.find((session) => !session.archived) || this.sessions[0]
        this.activeSessionId = fallback.id
        this.history = [...fallback.history]
        this.threadId = fallback.threadId
    }

    private getActiveSession(): AssistantSessionSnapshot | null {
        if (!this.activeSessionId) return null
        return this.sessions.find((session) => session.id === this.activeSessionId) || null
    }

    private syncActiveSessionFromRuntime(): void {
        const active = this.getActiveSession()
        if (!active) return
        active.history = [...this.history]
        active.threadId = this.threadId
        active.updatedAt = now()
    }

    private async ensurePersistenceLoaded(): Promise<void> {
        if (this.persistenceLoaded) return
        this.persistenceLoaded = true

        const filePath = this.getPersistPath()
        this.persistPath = filePath

        try {
            const raw = await readFile(filePath, 'utf-8')
            const parsed = JSON.parse(raw) as AssistantPersistedState
            if (!parsed || parsed.version !== ASSISTANT_STATE_VERSION || !Array.isArray(parsed.sessions)) {
                return
            }

            this.sessions = parsed.sessions
                .filter((session) => session && typeof session === 'object')
                .map((session, index) => {
                    const id = readString((session as Record<string, unknown>).id).trim() || createId('session')
                    const title = readString((session as Record<string, unknown>).title).trim() || `Session ${index + 1}`
                    const archived = Boolean((session as Record<string, unknown>).archived)
                    const createdAt = Number((session as Record<string, unknown>).createdAt) || now()
                    const updatedAt = Number((session as Record<string, unknown>).updatedAt) || createdAt
                    const historyRaw = ((session as Record<string, unknown>).history || []) as unknown
                    const history = Array.isArray(historyRaw)
                        ? historyRaw
                            .map((entry) => readRecord(entry))
                            .filter((entry): entry is Record<string, unknown> => Boolean(entry))
                            .map((entry) => ({
                                id: readString(entry.id) || createId('msg'),
                                role: (readString(entry.role) as AssistantHistoryMessage['role']) || 'system',
                                text: readString(entry.text),
                                reasoningText: readString(entry.reasoningText) || undefined,
                                createdAt: Number(entry.createdAt) || now(),
                                turnId: readString(entry.turnId) || undefined,
                                attemptGroupId: readString(entry.attemptGroupId) || undefined,
                                attemptIndex: Number(entry.attemptIndex) || undefined,
                                isActiveAttempt: typeof entry.isActiveAttempt === 'boolean' ? entry.isActiveAttempt : undefined
                            }))
                        : []
                    const threadId = readString((session as Record<string, unknown>).threadId).trim() || null
                    return { id, title, archived, createdAt, updatedAt, history, threadId }
                })

            this.activeSessionId = readString(parsed.activeSessionId).trim() || null
            const restoredProfile = readString(parsed.activeProfile).trim()
            if (restoredProfile) {
                this.activeProfile = restoredProfile
                this.status.profile = restoredProfile
                this.status.approvalMode = restoredProfile === 'yolo-fast' ? 'yolo' : 'safe'
            }
            const restoredProjectDefaults = readRecord(parsed.projectModelDefaults)
            if (restoredProjectDefaults) {
                this.projectModelDefaults = new Map(
                    Object.entries(restoredProjectDefaults)
                        .map(([projectPath, model]) => [String(projectPath).trim(), readString(model).trim()] as const)
                        .filter(([projectPath, model]) => projectPath.length > 0 && model.length > 0)
                )
            }
            this.ensureActiveSession()
            const active = this.getActiveSession()
            if (active) {
                this.history = [...active.history]
                this.threadId = active.threadId
            }
        } catch {
            this.ensureActiveSession()
        }
    }

    private getPersistPath(): string {
        try {
            const userDataDir = app.getPath('userData')
            return join(userDataDir, 'assistant-state.json')
        } catch {
            return join(process.cwd(), '.assistant-state.json')
        }
    }

    private persistStateSoon(): void {
        void this.persistState().catch((error) => {
            log.warn('[AssistantBridge] Failed to persist assistant state', { error })
        })
    }

    private clearReconnectTimer(): void {
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer)
            this.reconnectTimer = null
        }
    }

    private scheduleReconnect(): void {
        if (this.reconnectAttempts >= RECONNECT_MAX_ATTEMPTS) {
            return
        }
        if (this.reconnectTimer) {
            return
        }

        const attempt = this.reconnectAttempts + 1
        const delay = RECONNECT_BASE_DELAY_MS * attempt
        this.reconnectAttempts = attempt
        this.status.connected = false
        this.status.state = 'connecting'
        this.status.lastError = `Reconnect scheduled (attempt ${attempt}/${RECONNECT_MAX_ATTEMPTS})`
        this.emitEvent('status', { status: this.getStatus() })

        this.reconnectTimer = setTimeout(() => {
            this.reconnectTimer = null
            void this.ensureInitialized()
                .then(() => {
                    this.reconnectAttempts = 0
                    this.status.connected = true
                    this.status.state = 'ready'
                    this.status.lastError = null
                    this.emitEvent('status', { status: this.getStatus() })
                })
                .catch((error) => {
                    const message = error instanceof Error ? error.message : 'Reconnect attempt failed.'
                    this.status.connected = false
                    this.status.state = 'error'
                    this.status.lastError = message
                    this.emitEvent('error', { message })
                    this.emitEvent('status', { status: this.getStatus() })
                    this.scheduleReconnect()
                })
        }, delay)
    }

    private async requestWithRetry(
        method: string,
        params: Record<string, unknown> = {},
        options: { timeoutMs?: number; retries?: number } = {}
    ): Promise<any> {
        const timeoutMs = options.timeoutMs ?? REQUEST_TIMEOUT_MS
        const retries = Math.max(0, Math.trunc(options.retries ?? 1))
        let lastError: unknown = null

        for (let attempt = 0; attempt <= retries; attempt += 1) {
            try {
                return await this.request(method, params, timeoutMs)
            } catch (error) {
                lastError = error
                const message = error instanceof Error ? error.message.toLowerCase() : ''
                const isTransient = message.includes('timeout')
                    || message.includes('econnreset')
                    || message.includes('pipe')
                    || message.includes('bridge is not connected')

                if (!isTransient || attempt >= retries) {
                    throw error
                }
            }
        }

        throw lastError instanceof Error ? lastError : new Error(`RPC ${method} failed`)
    }

    private isMissingModelError(error: unknown): boolean {
        const message = error instanceof Error ? error.message.toLowerCase() : ''
        return message.includes('model')
            && (message.includes('not found')
                || message.includes('unknown')
                || message.includes('unsupported')
                || message.includes('invalid'))
    }

    private async persistState(): Promise<void> {
        if (!this.persistenceLoaded) return
        this.syncActiveSessionFromRuntime()
        const filePath = this.persistPath || this.getPersistPath()
        this.persistPath = filePath
        const dir = dirname(filePath)
        if (dir) {
            await mkdir(dir, { recursive: true }).catch(() => undefined)
        }

        const payload: AssistantPersistedState = {
            version: ASSISTANT_STATE_VERSION,
            activeSessionId: this.activeSessionId,
            activeProfile: this.activeProfile,
            projectModelDefaults: Object.fromEntries(this.projectModelDefaults.entries()),
            sessions: this.sessions.map((session) => ({
                id: session.id,
                title: session.title,
                archived: session.archived,
                createdAt: session.createdAt,
                updatedAt: session.updatedAt,
                history: session.history.map((entry) => ({ ...entry })),
                threadId: session.threadId
            }))
        }

        await writeFile(filePath, JSON.stringify(payload, null, 2), 'utf-8')
    }

    private findAssistantMessageByTurnId(turnId: string): AssistantHistoryMessage | null {
        for (let index = this.history.length - 1; index >= 0; index -= 1) {
            const entry = this.history[index]
            if (entry.role === 'assistant' && entry.turnId === turnId) {
                return entry
            }
        }
        return null
    }

    private findSourcePromptForAssistantTurn(turnId: string): string {
        let assistantIndex = -1
        for (let index = this.history.length - 1; index >= 0; index -= 1) {
            const entry = this.history[index]
            if (entry.role === 'assistant' && entry.turnId === turnId) {
                assistantIndex = index
                break
            }
        }

        if (assistantIndex < 0) return ''

        for (let index = assistantIndex - 1; index >= 0; index -= 1) {
            const entry = this.history[index]
            if (entry.role === 'user' && entry.text.trim()) {
                return entry.text
            }
        }

        return ''
    }

    private handleReasoningNotification(method: string, params: Record<string, unknown>): boolean {
        const normalizedMethod = normalizeToken(method)
        if (!normalizedMethod.includes('reason') && !normalizedMethod.includes('thought')) {
            return false
        }

        const turnId = extractTurnIdFromParams(params) || this.activeTurnId
        if (!turnId) return false

        const text = readTextFromContent(
            params.delta
            || params.text
            || params.message
            || params.content
            || params.output
            || params.reasoning
        ).trim()
        if (!text) return false

        this.emitReasoning(turnId, text, method)
        return true
    }

    private handleLegacyReasoningNotification(
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
        ).trim()
        if (!text) return false

        this.emitReasoning(turnId, text, method)
        return true
    }

    private emitReasoning(turnId: string, text: string, method: string): void {
        const digest = `${method}::${text}`
        if (this.lastReasoningDigestByTurn.get(turnId) === digest) {
            return
        }
        this.lastReasoningDigestByTurn.set(turnId, digest)
        const reasoningParts = this.reasoningTextsByTurn.get(turnId) || []
        reasoningParts.push(text)
        this.reasoningTextsByTurn.set(turnId, reasoningParts)

        const attemptGroupId = this.turnContexts.get(turnId)?.attemptGroupId
            || this.turnAttemptGroupByTurnId.get(turnId)
            || turnId

        this.emitEvent('assistant-reasoning', {
            turnId,
            attemptGroupId,
            text,
            method
        })
    }

    private handleActivityNotification(method: string, params: Record<string, unknown>): boolean {
        const turnId = extractTurnIdFromParams(params) || this.activeTurnId
        if (!turnId) return false

        const activity = this.normalizeActivity(method, params, '')
        if (!activity) return false

        this.emitActivity(turnId, activity.kind, activity.summary, activity.method, activity.payload)
        return true
    }

    private handleLegacyActivityNotification(
        turnId: string,
        eventType: string,
        payload: Record<string, unknown>,
        method: string
    ): boolean {
        const activity = this.normalizeActivity(method, payload, eventType)
        if (!activity) return false

        this.emitActivity(turnId, activity.kind, activity.summary, activity.method, activity.payload)
        return true
    }

    private normalizeActivity(
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

    private emitActivity(
        turnId: string,
        kind: ActivityKind,
        summary: string,
        method: string,
        payload: Record<string, unknown>
    ): void {
        const digest = `${kind}::${method}::${summary}`
        if (this.lastActivityDigestByTurn.get(turnId) === digest) {
            return
        }
        this.lastActivityDigestByTurn.set(turnId, digest)

        const attemptGroupId = this.turnContexts.get(turnId)?.attemptGroupId
            || this.turnAttemptGroupByTurnId.get(turnId)
            || turnId

        this.emitEvent('assistant-activity', {
            turnId,
            attemptGroupId,
            kind,
            summary,
            method,
            payload
        })
    }

    private emitEvent(type: AssistantEventPayload['type'], payload: Record<string, unknown>): void {
        const event: AssistantEventPayload = {
            type,
            timestamp: now(),
            payload
        }

        this.eventStore.unshift(event)
        if (this.eventStore.length > EVENT_RETENTION_LIMIT) {
            this.eventStore.length = EVENT_RETENTION_LIMIT
        }

        for (const id of Array.from(this.subscribers)) {
            const target = webContents.fromId(id)
            if (!target || target.isDestroyed()) {
                this.subscribers.delete(id)
                continue
            }
            try {
                target.send('devscope:assistant:event', event)
            } catch (error) {
                this.subscribers.delete(id)
                log.warn('[AssistantBridge] Failed to emit event to renderer', { id, error })
            }
        }
    }
}
