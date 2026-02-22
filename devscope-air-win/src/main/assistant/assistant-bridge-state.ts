import { app } from 'electron'
import log from 'electron-log'
import { mkdir, readFile, writeFile } from 'fs/promises'
import { dirname, join } from 'path'
import { createId, isAutoSessionTitle, now, readRecord, readString } from './assistant-bridge-helpers'

const REQUEST_TIMEOUT_MS = 120000
const ASSISTANT_STATE_VERSION = 1
const RECONNECT_BASE_DELAY_MS = 1500
const RECONNECT_MAX_ATTEMPTS = 5

type BridgeStateContext = any

export function bridgeCreateDefaultSession(bridge: BridgeStateContext): any {
    const createdAt = now()
    return {
        id: createId('session'),
        title: 'Session 1',
        archived: false,
        createdAt,
        updatedAt: createdAt,
        history: [],
        threadId: null,
        projectPath: '',
        contextTitleFinalized: false
    }
}

export function bridgeEnsureActiveSession(bridge: BridgeStateContext): void {
    if (bridge.sessions.length === 0) {
        const created = bridge.createDefaultSession()
        bridge.sessions = [created]
        bridge.activeSessionId = created.id
        bridge.history = []
        bridge.threadId = null
        return
    }

    const current = bridge.getActiveSession()
    if (current) return

    const fallback = bridge.sessions.find((session: any) => !session.archived) || bridge.sessions[0]
    bridge.activeSessionId = fallback.id
    bridge.history = [...fallback.history]
    bridge.threadId = fallback.threadId
}

export function bridgeGetActiveSession(bridge: BridgeStateContext): any {
    if (!bridge.activeSessionId) return null
    return bridge.sessions.find((session: any) => session.id === bridge.activeSessionId) || null
}

export function bridgeSyncActiveSessionFromRuntime(bridge: BridgeStateContext): void {
    const active = bridge.getActiveSession()
    if (!active) return
    active.history = [...bridge.history]
    active.threadId = bridge.threadId
    active.updatedAt = now()
}

export async function bridgeEnsurePersistenceLoaded(bridge: BridgeStateContext): Promise<void> {
    if (bridge.persistenceLoaded) return
    bridge.persistenceLoaded = true

    const filePath = bridge.getPersistPath()
    bridge.persistPath = filePath

    try {
        const raw = await readFile(filePath, 'utf-8')
        const parsed = JSON.parse(raw) as {
            version?: number
            sessions?: unknown[]
            activeSessionId?: string
            activeProfile?: string
            projectModelDefaults?: Record<string, string>
        }
        if (!parsed || parsed.version !== ASSISTANT_STATE_VERSION || !Array.isArray(parsed.sessions)) {
            return
        }

        bridge.sessions = parsed.sessions
            .filter((session) => session && typeof session === 'object')
            .map((session, index) => {
                const record = session as Record<string, unknown>
                const id = readString(record.id).trim() || createId('session')
                const title = readString(record.title).trim() || `Session ${index + 1}`
                const archived = Boolean(record.archived)
                const createdAt = Number(record.createdAt) || now()
                const updatedAt = Number(record.updatedAt) || createdAt
                const historyRaw = (record.history || []) as unknown
                const history = Array.isArray(historyRaw)
                    ? historyRaw
                        .map((entry) => readRecord(entry))
                        .filter((entry): entry is Record<string, unknown> => Boolean(entry))
                        .map((entry) => {
                            const attachmentsRaw = entry.attachments
                            const attachments = Array.isArray(attachmentsRaw)
                                ? attachmentsRaw
                                    .map((attachment) => readRecord(attachment))
                                    .filter((attachment): attachment is Record<string, unknown> => Boolean(attachment))
                                    .map((attachment) => ({
                                        path: readString(attachment.path),
                                        name: readString(attachment.name) || undefined,
                                        mimeType: readString(attachment.mimeType) || undefined,
                                        kind: readString(attachment.kind) || undefined,
                                        sizeBytes: Number(attachment.sizeBytes) || undefined,
                                        previewText: readString(attachment.previewText) || undefined,
                                        previewDataUrl: readString(attachment.previewDataUrl) || undefined,
                                        textPreview: readString(attachment.textPreview) || undefined
                                    }))
                                    .filter((attachment) =>
                                        attachment.path
                                        || attachment.name
                                        || attachment.mimeType
                                        || attachment.kind
                                        || attachment.sizeBytes
                                        || attachment.previewText
                                        || attachment.previewDataUrl
                                        || attachment.textPreview
                                    )
                                : []

                            return {
                                id: readString(entry.id) || createId('msg'),
                                role: readString(entry.role) || 'system',
                                text: readString(entry.text),
                                attachments: attachments.length > 0 ? attachments : undefined,
                                sourcePrompt: readString(entry.sourcePrompt) || undefined,
                                reasoningText: readString(entry.reasoningText) || undefined,
                                createdAt: Number(entry.createdAt) || now(),
                                turnId: readString(entry.turnId) || undefined,
                                attemptGroupId: readString(entry.attemptGroupId) || undefined,
                                attemptIndex: Number(entry.attemptIndex) || undefined,
                                isActiveAttempt: typeof entry.isActiveAttempt === 'boolean' ? entry.isActiveAttempt : undefined
                            }
                        })
                    : []
                const threadId = readString(record.threadId).trim() || null
                const projectPath = readString(record.projectPath).trim()
                const persistedContextTitleFinalized = typeof record.contextTitleFinalized === 'boolean'
                    ? record.contextTitleFinalized
                    : undefined
                const contextTitleFinalized = persistedContextTitleFinalized ?? !isAutoSessionTitle(title)
                return {
                    id,
                    title,
                    archived,
                    createdAt,
                    updatedAt,
                    history,
                    threadId,
                    projectPath: projectPath || '',
                    contextTitleFinalized
                }
            })

        bridge.activeSessionId = readString(parsed.activeSessionId).trim() || null
        const restoredProfile = readString(parsed.activeProfile).trim()
        if (restoredProfile) {
            bridge.activeProfile = restoredProfile
            bridge.status.profile = restoredProfile
            bridge.status.approvalMode = restoredProfile === 'yolo-fast' ? 'yolo' : 'safe'
        }
        const restoredProjectDefaults = readRecord(parsed.projectModelDefaults)
        if (restoredProjectDefaults) {
            bridge.projectModelDefaults = new Map(
                Object.entries(restoredProjectDefaults)
                    .map(([projectPath, model]) => [String(projectPath).trim(), readString(model).trim()] as const)
                    .filter(([projectPath, model]) => projectPath.length > 0 && model.length > 0)
            )
        }
        bridge.ensureActiveSession()
        const active = bridge.getActiveSession()
        if (active) {
            bridge.history = [...active.history]
            bridge.threadId = active.threadId
        }
    } catch {
        bridge.ensureActiveSession()
    }
}

export function bridgeGetPersistPath(): string {
    try {
        const userDataDir = app.getPath('userData')
        return join(userDataDir, 'assistant-state.json')
    } catch {
        return join(process.cwd(), '.assistant-state.json')
    }
}

export function bridgePersistStateSoon(bridge: BridgeStateContext): void {
    void bridge.persistState().catch((error: unknown) => {
        log.warn('[AssistantBridge] Failed to persist assistant state', { error })
    })
}

export function bridgeClearReconnectTimer(bridge: BridgeStateContext): void {
    if (bridge.reconnectTimer) {
        clearTimeout(bridge.reconnectTimer)
        bridge.reconnectTimer = null
    }
}

export function bridgeScheduleReconnect(bridge: BridgeStateContext): void {
    if (bridge.reconnectAttempts >= RECONNECT_MAX_ATTEMPTS) {
        return
    }
    if (bridge.reconnectTimer) {
        return
    }

    const attempt = bridge.reconnectAttempts + 1
    const delay = RECONNECT_BASE_DELAY_MS * attempt
    bridge.reconnectAttempts = attempt
    bridge.status.connected = false
    bridge.status.state = 'connecting'
    bridge.status.lastError = `Reconnect scheduled (attempt ${attempt}/${RECONNECT_MAX_ATTEMPTS})`
    bridge.emitEvent('status', { status: bridge.getStatus() })

    bridge.reconnectTimer = setTimeout(() => {
        bridge.reconnectTimer = null
        void bridge.ensureInitialized()
            .then(() => {
                bridge.reconnectAttempts = 0
                bridge.status.connected = true
                bridge.status.state = 'ready'
                bridge.status.lastError = null
                bridge.emitEvent('status', { status: bridge.getStatus() })
            })
            .catch((error: unknown) => {
                const message = error instanceof Error ? error.message : 'Reconnect attempt failed.'
                bridge.status.connected = false
                bridge.status.state = 'error'
                bridge.status.lastError = message
                bridge.emitEvent('error', { message })
                bridge.emitEvent('status', { status: bridge.getStatus() })
                bridge.scheduleReconnect()
            })
    }, delay)
}

export async function bridgeRequestWithRetry(
    bridge: BridgeStateContext,
    method: string,
    params: Record<string, unknown> = {},
    options: { timeoutMs?: number; retries?: number } = {}
): Promise<any> {
    const timeoutMs = options.timeoutMs ?? REQUEST_TIMEOUT_MS
    const retries = Math.max(0, Math.trunc(options.retries ?? 1))
    let lastError: unknown = null

    for (let attempt = 0; attempt <= retries; attempt += 1) {
        try {
            return await bridge.request(method, params, timeoutMs)
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

export function bridgeIsMissingModelError(error: unknown): boolean {
    const message = error instanceof Error ? error.message.toLowerCase() : ''
    return message.includes('model')
        && (message.includes('not found')
            || message.includes('unknown')
            || message.includes('unsupported')
            || message.includes('invalid'))
}

export function bridgeIsInvalidParamsError(error: unknown): boolean {
    const message = error instanceof Error ? error.message.toLowerCase() : ''
    return message.includes('invalid params')
        || message.includes('unknown field')
        || message.includes('unexpected field')
        || message.includes('-32602')
}

export async function bridgePersistState(bridge: BridgeStateContext): Promise<void> {
    if (!bridge.persistenceLoaded) return
    bridge.syncActiveSessionFromRuntime()
    const filePath = bridge.persistPath || bridge.getPersistPath()
    bridge.persistPath = filePath
    const dir = dirname(filePath)
    if (dir) {
        await mkdir(dir, { recursive: true }).catch(() => undefined)
    }

    const payload = {
        version: ASSISTANT_STATE_VERSION,
        activeSessionId: bridge.activeSessionId,
        activeProfile: bridge.activeProfile,
        projectModelDefaults: Object.fromEntries(bridge.projectModelDefaults.entries()),
        sessions: bridge.sessions.map((session: any) => ({
            id: session.id,
            title: session.title,
            archived: session.archived,
            createdAt: session.createdAt,
            updatedAt: session.updatedAt,
            history: session.history.map((entry: unknown) => ({ ...(entry as object) })),
            threadId: session.threadId,
            projectPath: session.projectPath || '',
            contextTitleFinalized: Boolean(session.contextTitleFinalized)
        }))
    }

    await writeFile(filePath, JSON.stringify(payload, null, 2), 'utf-8')
}

