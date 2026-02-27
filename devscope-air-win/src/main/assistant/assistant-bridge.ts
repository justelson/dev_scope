import { EventEmitter } from 'events'
import { now } from './assistant-bridge-helpers'
import {
    bridgeArchiveSession,
    bridgeClearEvents,
    bridgeClearHistory,
    bridgeCreateSession,
    bridgeDeleteSession,
    bridgeEstimatePromptTokens,
    bridgeExportConversation,
    bridgeExportEvents,
    bridgeGetEvents,
    bridgeGetHistory,
    bridgeGetProjectModelDefault,
    bridgeGetTelemetryIntegrity,
    bridgeListProfiles,
    bridgeListSessions,
    bridgeNewThread,
    bridgeRenameSession,
    bridgeSelectSession,
    bridgeSetProfile,
    bridgeSetProjectModelDefault,
    bridgeSetSessionProjectPath
} from './assistant-bridge-session'
import {
    bridgeCancelTurn,
    bridgeListModels,
    bridgeRunWorkflow,
    bridgeSendPrompt
} from './assistant-bridge-operations'
import {
    bridgeClaimTurnBuffer,
    bridgeEnsureInitialized,
    bridgeEnsureTurnBuffer,
    bridgeFailPending,
    bridgeHandleLegacyNotification,
    bridgeHandleNotification,
    bridgeHandleServerRequest,
    bridgeNotify,
    bridgeRequest,
    bridgeResolvePending,
    bridgeSend,
    bridgeStartProcess,
    bridgeStopProcess
} from './assistant-bridge-rpc'
import {
    bridgeBuildPromptWithContext,
    bridgeEnsureThread,
    bridgeFinalizeTurn,
    bridgeFindAssistantMessageByTurnId,
    bridgeFindSourcePromptForAssistantTurn,
    bridgeMarkTurnFinalized,
    bridgeResolveSelectedModel
} from './assistant-bridge-core'
import {
    bridgeClearReconnectTimer,
    bridgeCreateDefaultSession,
    bridgeEnsureActiveSession,
    bridgeEnsurePersistenceLoaded,
    bridgeGetActiveSession,
    bridgeGetPersistPath,
    bridgeIsInvalidParamsError,
    bridgeIsMissingModelError,
    bridgePersistState,
    bridgePersistStateSoon,
    bridgeRequestWithRetry,
    bridgeScheduleReconnect,
    bridgeSyncActiveSessionFromRuntime
} from './assistant-bridge-state'
import {
    bridgeEmitActivity,
    bridgeEmitEvent,
    bridgeEmitReasoning,
    bridgeHandleActivityNotification,
    bridgeHandleLegacyActivityNotification,
    bridgeHandleLegacyReasoningNotification,
    bridgeHandleReasoningNotification,
    bridgeNormalizeActivity
} from './assistant-bridge-events'
import type {
    AssistantApprovalMode,
    AssistantConnectOptions,
    AssistantEventPayload,
    AssistantHistoryMessage,
    AssistantModelInfo,
    AssistantSendOptions,
    AssistantStatus
} from './types'
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
    pendingFinalPhase: string | null
    draftKind: 'provisional' | 'final' | null
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
    contextTitleFinalized?: boolean
}
type JsonRpcNotification = {
    method?: string
    params?: Record<string, unknown>
}
const CONNECT_MAX_ATTEMPTS = 3
const CONNECT_RETRY_DELAY_BASE_MS = 600

function isRetryableConnectErrorMessage(message: string): boolean {
    const normalized = String(message || '').toLowerCase()
    if (!normalized) return false
    if (
        normalized.includes('could not find')
        || normalized.includes('codex_bin')
        || normalized.includes('must be an executable')
        || normalized.includes('invalid control characters')
    ) {
        return false
    }
    return normalized.includes('timeout')
        || normalized.includes('econnreset')
        || normalized.includes('pipe')
        || normalized.includes('bridge is not connected')
        || normalized.includes('exited')
        || normalized.includes('failed')
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
    private proc: any = null
    private rl: any = null
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
    private lastActivityEmitByTurn = new Map<string, { timestamp: number; key: string }>()
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
    private connectInFlight: Promise<{ success: boolean; status: AssistantStatus; error?: string }> | null = null
    public subscribe(webContentsId: number) {
        this.subscribers.add(webContentsId)
        return { success: true }
    }
    public unsubscribe(webContentsId: number) {
        this.subscribers.delete(webContentsId)
        return { success: true }
    }
    public async connect(options: AssistantConnectOptions = {}) {
        if (this.connectInFlight) {
            return await this.connectInFlight
        }

        this.connectInFlight = (async () => {
            if (options.approvalMode) {
                this.status.approvalMode = options.approvalMode
            }
            if (options.profile?.trim()) {
                this.setProfile(options.profile)
            }
            if (options.model?.trim()) {
                this.status.model = options.model.trim()
                if (options.projectPath?.trim()) {
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
                let initialized = false
                let lastConnectError: unknown = null
                for (let attempt = 1; attempt <= CONNECT_MAX_ATTEMPTS; attempt += 1) {
                    try {
                        await this.ensureInitialized()
                        initialized = true
                        break
                    } catch (error) {
                        lastConnectError = error
                        const message = error instanceof Error ? error.message : 'Failed to connect assistant bridge.'
                        const canRetry = attempt < CONNECT_MAX_ATTEMPTS && isRetryableConnectErrorMessage(message)
                        if (!canRetry) {
                            throw error
                        }
                        await new Promise((resolve) => setTimeout(resolve, CONNECT_RETRY_DELAY_BASE_MS * attempt))
                    }
                }
                if (!initialized) {
                    throw (lastConnectError instanceof Error ? lastConnectError : new Error('Failed to initialize assistant bridge.'))
                }
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
        })()

        try {
            return await this.connectInFlight
        } finally {
            this.connectInFlight = null
        }
    }
    public disconnect() {
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
        this.lastActivityEmitByTurn.clear()
        this.finalizedTurns.clear()
        this.cancelledTurns.clear()
        this.cachedModels = []
        this.persistStateSoon()
        this.emitEvent('status', { status: this.getStatus() })
        return { success: true, status: this.getStatus() }
    }
    public getStatus() {
        return { ...this.status }
    }
    public setApprovalMode(mode: AssistantApprovalMode) {
        this.status.approvalMode = mode === 'yolo' ? 'yolo' : 'safe'
        this.emitEvent('status', { status: this.getStatus() })
        return { success: true, status: this.getStatus() }
    }
    public getApprovalMode() {
        return { success: true, mode: this.status.approvalMode }
    }
    public getHistory() {
        return bridgeGetHistory(this)
    }
    public clearHistory() {
        return bridgeClearHistory(this)
    }
    public getEvents(options: { limit?: number; types?: string[]; search?: string } = {}) {
        return bridgeGetEvents(this, options)
    }
    public clearEvents() {
        return bridgeClearEvents(this)
    }
    public exportEvents() {
        return bridgeExportEvents(this)
    }
    public exportConversation(format: 'json' | 'markdown' = 'json', sessionId?: string) {
        return bridgeExportConversation(this, format, sessionId)
    }
    public listSessions() {
        return bridgeListSessions(this)
    }
    public listProfiles() {
        return bridgeListProfiles(this)
    }
    public setProfile(profileId: string) {
        return bridgeSetProfile(this, profileId)
    }
    public getProjectModelDefault(projectPath: string) {
        return bridgeGetProjectModelDefault(this, projectPath)
    }
    public setProjectModelDefault(projectPath: string, model: string) {
        return bridgeSetProjectModelDefault(this, projectPath, model)
    }
    public createSession(title?: string) {
        return bridgeCreateSession(this, title)
    }
    public selectSession(sessionId: string) {
        return bridgeSelectSession(this, sessionId)
    }
    public renameSession(sessionId: string, title: string) {
        return bridgeRenameSession(this, sessionId, title)
    }
    public deleteSession(sessionId: string) {
        return bridgeDeleteSession(this, sessionId)
    }
    public archiveSession(sessionId: string, archived = true) {
        return bridgeArchiveSession(this, sessionId, archived)
    }
    public setSessionProjectPath(sessionId: string, projectPath: string) {
        return bridgeSetSessionProjectPath(this, sessionId, projectPath)
    }
    public newThread() {
        return bridgeNewThread(this)
    }
    public estimatePromptTokens(input: {
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
    }) {
        return bridgeEstimatePromptTokens(this, input)
    }
    public getTelemetryIntegrity() {
        return bridgeGetTelemetryIntegrity(this)
    }
    public async runWorkflow(input: {
        kind: 'explain-diff' | 'review-staged' | 'draft-commit'
        projectPath: string
        filePath?: string
        model?: string
    }) {
        return bridgeRunWorkflow.call(this, input)
    }
    public async listModels(forceRefresh = false) {
        return bridgeListModels.call(this, forceRefresh)
    }
    public async cancelTurn(turnId?: string) {
        return bridgeCancelTurn.call(this, turnId)
    }
    public async sendPrompt(prompt: string, options: AssistantSendOptions = {}) {
        return bridgeSendPrompt.call(this, prompt, options)
    }
    public cleanup() {
        this.disconnect()
    }
    private async ensureInitialized() {
        return bridgeEnsureInitialized(this)
    }
    private async startProcess() {
        return bridgeStartProcess(this)
    }
    private stopProcess() {
        bridgeStopProcess(this)
    }
    private request(method: string, params: Record<string, unknown> = {}, timeoutMs?: number) {
        return bridgeRequest(this, method, params, timeoutMs)
    }
    private notify(method: string, params: Record<string, unknown> = {}) {
        bridgeNotify(this, method, params)
    }
    private send(message: Record<string, unknown>) {
        bridgeSend(this, message)
    }
    private resolvePending(message: Record<string, unknown>) {
        bridgeResolvePending(this, message)
    }
    private failPending(error: Error) {
        bridgeFailPending(this, error)
    }
    private handleServerRequest(message: Record<string, unknown>) {
        bridgeHandleServerRequest(this, message)
    }
    private handleNotification(message: JsonRpcNotification) {
        bridgeHandleNotification(this, message)
    }
    private handleLegacyNotification(method: string, params: Record<string, unknown>) {
        bridgeHandleLegacyNotification(this, method, params)
    }
    private claimTurnBuffer(turnId: string, source: TurnEventSource): TurnBuffer | null {
        return bridgeClaimTurnBuffer(this, turnId, source)
    }
    private ensureTurnBuffer(turnId: string): TurnBuffer {
        return bridgeEnsureTurnBuffer(this, turnId)
    }
    private finalizeTurn(
        turnId: string,
        outcome: {
            success: boolean
            reason: TurnTerminalReason
            explicitFinalText?: string
            errorMessage?: string
        }
    ) {
        bridgeFinalizeTurn(this, turnId, outcome)
    }
    private markTurnFinalized(turnId: string) {
        return bridgeMarkTurnFinalized(this, turnId)
    }
    private async resolveSelectedModel(projectPath?: string) {
        return bridgeResolveSelectedModel(this, projectPath)
    }
    private async ensureThread(model: string | null, projectPath?: string) {
        return bridgeEnsureThread(this, model, projectPath)
    }
    private buildPromptWithContext(prompt: string, options: AssistantSendOptions) {
        return bridgeBuildPromptWithContext(this, prompt, options)
    }
    private createDefaultSession() {
        return bridgeCreateDefaultSession(this)
    }
    private ensureActiveSession() {
        bridgeEnsureActiveSession(this)
    }
    private getActiveSession() {
        return bridgeGetActiveSession(this)
    }
    private syncActiveSessionFromRuntime() {
        bridgeSyncActiveSessionFromRuntime(this)
    }
    private async ensurePersistenceLoaded() {
        return bridgeEnsurePersistenceLoaded(this)
    }
    private getPersistPath() {
        return bridgeGetPersistPath()
    }
    private persistStateSoon() {
        bridgePersistStateSoon(this)
    }
    private clearReconnectTimer() {
        bridgeClearReconnectTimer(this)
    }
    private scheduleReconnect() {
        bridgeScheduleReconnect(this)
    }
    private async requestWithRetry(
        method: string,
        params: Record<string, unknown> = {},
        options: { timeoutMs?: number; retries?: number } = {}
    ) {
        return bridgeRequestWithRetry(this, method, params, options)
    }
    private isMissingModelError(error: unknown) {
        return bridgeIsMissingModelError(error)
    }
    private isInvalidParamsError(error: unknown) {
        return bridgeIsInvalidParamsError(error)
    }
    private async persistState() {
        return bridgePersistState(this)
    }
    private findAssistantMessageByTurnId(turnId: string) {
        return bridgeFindAssistantMessageByTurnId(this, turnId)
    }
    private findSourcePromptForAssistantTurn(turnId: string) {
        return bridgeFindSourcePromptForAssistantTurn(this, turnId)
    }
    private handleReasoningNotification(method: string, params: Record<string, unknown>) {
        return bridgeHandleReasoningNotification(this, method, params)
    }
    private handleLegacyReasoningNotification(
        turnId: string,
        eventType: string,
        payload: Record<string, unknown>,
        method: string
    ) {
        return bridgeHandleLegacyReasoningNotification(this, turnId, eventType, payload, method)
    }
    private emitReasoning(turnId: string, text: string, method: string) {
        bridgeEmitReasoning(this, turnId, text, method)
    }
    private handleActivityNotification(method: string, params: Record<string, unknown>) {
        return bridgeHandleActivityNotification(this, method, params)
    }
    private handleLegacyActivityNotification(
        turnId: string,
        eventType: string,
        payload: Record<string, unknown>,
        method: string
    ) {
        return bridgeHandleLegacyActivityNotification(this, turnId, eventType, payload, method)
    }
    private normalizeActivity(method: string, payload: Record<string, unknown>, eventType: string) {
        return bridgeNormalizeActivity(this, method, payload, eventType)
    }
    private emitActivity(
        turnId: string,
        kind: ActivityKind,
        summary: string,
        method: string,
        payload: Record<string, unknown>
    ) {
        bridgeEmitActivity(this, turnId, kind, summary, method, payload)
    }
    private emitEvent(type: AssistantEventPayload['type'], payload: Record<string, unknown>) {
        bridgeEmitEvent(this, type, payload)
    }
}
