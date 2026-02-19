/**
 * AgentScope - Main Orchestrator
 * 
 * Manages agent sessions with PTY terminals and auto-status detection.
 */

import log from 'electron-log'
import { app } from 'electron'
import type { BrowserWindow } from 'electron'
import { appendFile, mkdir, writeFile } from 'fs/promises'
import { join } from 'path'
import { getTerminalManager } from '../inspectors/terminal/manager'
import { getHandler } from './handlers'
import type {
    AgentSession,
    AgentStatus,
    AgentPhase,
    CreateSessionConfig,
    AgentStatusUpdate
} from '../../shared/agentscope-types'

const MAX_OUTPUT_HISTORY = 100 // Lines to keep in memory

export class AgentScopeOrchestrator {
    private sessions = new Map<string, AgentSession>()
    private mainWindow: BrowserWindow | null = null
    private outputBuffers = new Map<string, string>() // For partial line handling
    private sessionStorage = new Map<string, string>()
    private systemPromptSent = new Set<string>()
    private systemPromptLines = new Map<string, Set<string>>()
    private storageRoot: string | null = null

    constructor() {
        log.info('[AgentScope] Orchestrator initialized')
    }

    setMainWindow(window: BrowserWindow): void {
        this.mainWindow = window
    }

    /**
     * Create a new agent session.
     */
    createSession(config: CreateSessionConfig): AgentSession {
        const { agentId, cwd, task, autoStart = false } = config

        // Get handler for this agent
        const handler = getHandler(agentId)

        const sessionId = `agent_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`

        const session: AgentSession = {
            id: sessionId,
            agentId,
            agentName: handler.displayName,
            status: 'ready',
            phase: 'idle',
            cwd: cwd || process.cwd(),
            lastActivity: Date.now(),
            outputHistory: []
        }

        this.sessions.set(sessionId, session)
        void this.initSessionStorage(session)
        log.info(`[AgentScope] Created session ${sessionId} for ${handler.displayName}`)

        // Emit session created
        this.emitEvent('agentscope:session-created', { session })

        // Auto-start if requested
        if (autoStart) {
            this.startSession(sessionId, { task })
        }

        return session
    }

    /**
     * Start an agent session (creates PTY and runs agent command).
     */
    startSession(sessionId: string, options?: { task?: string; cwd?: string }): boolean {
        const session = this.sessions.get(sessionId)
        if (!session) {
            log.warn(`[AgentScope] Session ${sessionId} not found`)
            return false
        }

        if (session.status !== 'ready') {
            log.warn(`[AgentScope] Session ${sessionId} is not in ready state`)
            return false
        }

        const handler = getHandler(session.agentId)
        const terminalManager = getTerminalManager()

        try {
            this.systemPromptSent.delete(sessionId)
            this.systemPromptLines.delete(sessionId)
            const task = options?.task
            if (options?.cwd) {
                session.cwd = options.cwd
            }

            // Create PTY terminal session
            const termInfo = terminalManager.createSession(
                `AgentScope: ${handler.displayName}`,
                session.cwd,
                'powershell'
            )

            session.terminalId = termInfo.id
            session.status = 'running'
            session.phase = 'analyzing'
            session.startedAt = Date.now()
            session.lastActivity = Date.now()
            if (task) {
                session.task = task
            }
            void this.persistMeta(session)
            void this.persistState(session)
            void this.appendEvent(session.id, { type: 'status', status: session.status, phase: session.phase })

            // Listen for terminal output
            this.setupOutputListener(sessionId, termInfo.id)

            // Send the agent command
            const command = handler.buildStartCommand(task)
            setTimeout(() => {
                terminalManager.write(termInfo.id, '\r')
                setTimeout(() => {
                    terminalManager.write(termInfo.id, command + '\r\n')
                }, 200)
            }, 300) // Allow shell to initialize before running agent command

            // Emit status change
            this.emitStatusChange(sessionId, 'running', 'analyzing')
            this.emitEvent('agentscope:session-updated', { session })

            log.info(`[AgentScope] Started session ${sessionId}: ${command}`)
            return true

        } catch (err) {
            log.error(`[AgentScope] Failed to start session ${sessionId}:`, err)
            session.status = 'failed'
            session.phase = 'error'
            this.emitStatusChange(sessionId, 'failed', 'error')
            return false
        }
    }

    /**
     * Write input to an agent session.
     */
    writeToSession(sessionId: string, data: string): boolean {
        const session = this.sessions.get(sessionId)
        if (!session || !session.terminalId) return false

        const terminalManager = getTerminalManager()
        terminalManager.write(session.terminalId, data)
        session.lastActivity = Date.now()

        // If we're awaiting input and user types, go back to running
        if (session.status === 'awaiting_input' ||
            session.status === 'awaiting_confirm') {
            session.status = 'running'
            void this.persistState(session)
            void this.appendEvent(sessionId, { type: 'status', status: session.status, phase: session.phase })
            this.emitStatusChange(sessionId, 'running')
        }

        return true
    }

    /**
     * Send a full user message to an agent session.
     * Injects the system prompt once per session.
     */
    sendMessage(sessionId: string, message: string): boolean {
        const session = this.sessions.get(sessionId)
        if (!session || !session.terminalId) return false

        const handler = getHandler(session.agentId)
        const terminalManager = getTerminalManager()

        terminalManager.write(session.terminalId, '\r')

        if (!this.systemPromptSent.has(sessionId)) {
            const systemPrompt = handler.getSystemPrompt()
            if (systemPrompt) {
                terminalManager.write(session.terminalId, systemPrompt + '\r\n')
                void this.appendEvent(sessionId, { type: 'system', text: systemPrompt })
            }
            this.systemPromptSent.add(sessionId)
            if (systemPrompt) {
                const lines = systemPrompt
                    .split(/\r?\n/)
                    .map(line => line.trim())
                    .filter(Boolean)
                if (lines.length > 0) {
                    this.systemPromptLines.set(sessionId, new Set(lines))
                }
            }
        }

        terminalManager.write(session.terminalId, message + '\r\n')
        void this.appendEvent(sessionId, { type: 'user', text: message })
        session.lastActivity = Date.now()

        if (session.status === 'awaiting_input' || session.status === 'awaiting_confirm') {
            session.status = 'running'
            void this.persistState(session)
            void this.appendEvent(sessionId, { type: 'status', status: session.status, phase: session.phase })
            this.emitStatusChange(sessionId, 'running')
        }

        return true
    }

    /**
     * Kill/stop an agent session.
     */
    killSession(sessionId: string): boolean {
        const session = this.sessions.get(sessionId)
        if (!session) return false

        if (session.terminalId) {
            const terminalManager = getTerminalManager()
            terminalManager.killSession(session.terminalId)
        }

        session.status = 'completed'
        session.phase = 'idle'
        session.endedAt = Date.now()
        void this.persistState(session)
        void this.appendEvent(sessionId, { type: 'status', status: session.status, phase: session.phase })

        this.emitStatusChange(sessionId, 'completed', 'idle')
        this.emitEvent('agentscope:session-closed', {
            sessionId,
            exitCode: 0
        })

        log.info(`[AgentScope] Killed session ${sessionId}`)
        return true
    }

    /**
     * Remove a session from memory.
     */
    removeSession(sessionId: string): boolean {
        this.killSession(sessionId)
        this.sessions.delete(sessionId)
        this.outputBuffers.delete(sessionId)
        this.systemPromptSent.delete(sessionId)
        this.systemPromptLines.delete(sessionId)
        return true
    }

    /**
     * Get a specific session.
     */
    getSession(sessionId: string): AgentSession | undefined {
        return this.sessions.get(sessionId)
    }

    getSessionStoragePath(sessionId: string): string | undefined {
        return this.sessionStorage.get(sessionId)
    }

    /**
     * Get all sessions.
     */
    getAllSessions(): AgentSession[] {
        return Array.from(this.sessions.values())
    }

    /**
     * Resize terminal for a session.
     */
    resizeSession(sessionId: string, cols: number, rows: number): void {
        const session = this.sessions.get(sessionId)
        if (!session?.terminalId) return

        const terminalManager = getTerminalManager()
        terminalManager.resize(session.terminalId, cols, rows)
    }

    /**
     * Set up output listener for a terminal session.
     */
    private setupOutputListener(sessionId: string, terminalId: string): void {
        // The terminal manager sends output via IPC to renderer
        // We need to intercept it for status parsing
        // This is done by listening to the same events

        // For now, we'll hook into the output in the IPC handler
        // The orchestrator will be called from there
    }

    /**
     * Process output from a terminal session.
     * Called from IPC handler when terminal output arrives.
     */
    processOutput(sessionId: string, data: string): void {
        log.info(`[AgentScope] processOutput called for ${sessionId}, data length: ${data.length}`)
        const session = this.sessions.get(sessionId)
        if (!session) {
            log.warn(`[AgentScope] processOutput: session ${sessionId} not found`)
            return
        }

        session.lastActivity = Date.now()

        const cleanedData = this.filterSystemPrompt(sessionId, data)
        const outputData = this.filterStatusMarkers(cleanedData)

        // Add to output history
        const handler = getHandler(session.agentId)
        const statusUpdate = handler.parseOutput(data)

        if (statusUpdate) {
            this.applyStatusUpdate(sessionId, session, statusUpdate)
        } else {
            // Try to detect phase from output
            if (outputData.trim()) {
                const phase = handler.detectPhase(outputData)
                if (phase !== session.phase) {
                    session.phase = phase
                    void this.persistState(session)
                    void this.appendEvent(sessionId, { type: 'status', status: session.status, phase })
                    this.emitEvent('agentscope:session-updated', { session })
                }
            }
        }

        if (!outputData.trim()) {
            return
        }

        const lines = outputData.split('\n')
        session.outputHistory.push(...lines.filter(l => l.trim()))
        if (session.outputHistory.length > MAX_OUTPUT_HISTORY) {
            session.outputHistory = session.outputHistory.slice(-MAX_OUTPUT_HISTORY)
        }
        void this.appendEvent(sessionId, { type: 'output', text: outputData })

        // Forward output to renderer
        this.emitEvent('agentscope:output', { sessionId, data: outputData })
    }

    /**
     * Apply a status update to a session.
     */
    private applyStatusUpdate(
        sessionId: string,
        session: AgentSession,
        update: AgentStatusUpdate
    ): void {
        const oldStatus = session.status

        session.status = update.status
        if (update.phase) session.phase = update.phase

        // Mark completion time
        if (update.status === 'completed' || update.status === 'failed') {
            session.endedAt = Date.now()
        }

        // Emit changes
        if (oldStatus !== update.status) {
            log.info(`[AgentScope] Session ${sessionId}: ${oldStatus} → ${update.status}`)
            this.emitStatusChange(sessionId, update.status, update.phase)
        }

        void this.persistState(session)
        void this.appendEvent(sessionId, { type: 'status', status: update.status, phase: update.phase, message: update.message })
        this.emitEvent('agentscope:session-updated', { session })
    }

    /**
     * Emit a status change event.
     */
    private emitStatusChange(
        sessionId: string,
        status: AgentStatus,
        phase?: AgentPhase
    ): void {
        this.emitEvent('agentscope:status-change', { sessionId, status, phase })
    }

    /**
     * Emit an event to the renderer.
     */
    private emitEvent(channel: string, data: any): void {
        if (this.mainWindow && !this.mainWindow.isDestroyed()) {
            log.info(`[AgentScope] Emitting ${channel} to renderer`)
            this.mainWindow.webContents.send(channel, data)
        } else {
            log.warn(`[AgentScope] Cannot emit ${channel}: mainWindow unavailable`)
        }
    }

    private getStorageRoot(): string {
        if (!this.storageRoot) {
            this.storageRoot = join(app.getPath('userData'), 'agentscope-sessions')
        }
        return this.storageRoot
    }

    private async initSessionStorage(session: AgentSession): Promise<void> {
        try {
            const root = this.getStorageRoot()
            const dir = join(root, session.id)
            await mkdir(dir, { recursive: true })
            this.sessionStorage.set(session.id, dir)
            await this.persistMeta(session)
            await this.persistState(session)
            await this.appendEvent(session.id, { type: 'created', status: session.status, phase: session.phase })
        } catch (err) {
            log.warn(`[AgentScope] Failed to initialize storage for ${session.id}:`, err)
        }
    }

    private async persistMeta(session: AgentSession): Promise<void> {
        try {
            const dir = this.sessionStorage.get(session.id)
            if (!dir) return
            const payload = {
                id: session.id,
                agentId: session.agentId,
                agentName: session.agentName,
                cwd: session.cwd,
                createdAt: session.startedAt || session.lastActivity,
                task: session.task
            }
            await writeFile(join(dir, 'meta.json'), JSON.stringify(payload, null, 2), 'utf-8')
        } catch (err) {
            log.warn(`[AgentScope] Failed to persist meta for ${session.id}:`, err)
        }
    }

    private async persistState(session: AgentSession): Promise<void> {
        try {
            const dir = this.sessionStorage.get(session.id)
            if (!dir) return
            const payload = {
                status: session.status,
                phase: session.phase,
                lastActivity: session.lastActivity,
                startedAt: session.startedAt,
                endedAt: session.endedAt
            }
            await writeFile(join(dir, 'state.json'), JSON.stringify(payload, null, 2), 'utf-8')
        } catch (err) {
            log.warn(`[AgentScope] Failed to persist state for ${session.id}:`, err)
        }
    }

    private async appendEvent(sessionId: string, event: Record<string, any>): Promise<void> {
        try {
            const dir = this.sessionStorage.get(sessionId)
            if (!dir) return
            const entry = {
                ts: Date.now(),
                ...event
            }
            await appendFile(join(dir, 'messages.jsonl'), JSON.stringify(entry) + '\n', 'utf-8')
        } catch (err) {
            log.warn(`[AgentScope] Failed to append event for ${sessionId}:`, err)
        }
    }

    /**
     * Cleanup all sessions.
     */
    cleanup(): void {
        for (const [id] of this.sessions) {
            this.killSession(id)
        }
        this.sessions.clear()
        this.outputBuffers.clear()
        this.systemPromptSent.clear()
        this.systemPromptLines.clear()
        log.info('[AgentScope] Orchestrator cleaned up')
    }

    private filterSystemPrompt(sessionId: string, data: string): string {
        const promptLines = this.systemPromptLines.get(sessionId)
        if (!promptLines || promptLines.size === 0) return data

        const lines = data.split(/\r?\n/)
        const kept: string[] = []

        for (const line of lines) {
            const trimmed = line.trim()
            if (!trimmed) {
                kept.push(line)
                continue
            }
            if (promptLines.has(trimmed)) {
                promptLines.delete(trimmed)
                continue
            }
            kept.push(line)
        }

        if (promptLines.size === 0) {
            this.systemPromptLines.delete(sessionId)
        }

        return kept.join('\n')
    }

    private filterStatusMarkers(data: string): string {
        const statusLine = /^Status:\s+\w+(?:\s+\([^)]+\))?\s*$/
        const lines = data.split(/\r?\n/)
        const kept = lines.filter(line => {
            const trimmed = line.trim()
            if (!trimmed) return true
            if (trimmed.includes('"agentscope_status"')) return false
            if (statusLine.test(trimmed)) return false
            return true
        })
        return kept.join('\n')
    }
}

// Singleton instance
let orchestratorInstance: AgentScopeOrchestrator | null = null

export function getAgentScopeOrchestrator(): AgentScopeOrchestrator {
    if (!orchestratorInstance) {
        orchestratorInstance = new AgentScopeOrchestrator()
    }
    return orchestratorInstance
}

export function cleanupAgentScope(): void {
    if (orchestratorInstance) {
        orchestratorInstance.cleanup()
        orchestratorInstance = null
    }
}
