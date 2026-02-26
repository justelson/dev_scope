import * as pty from 'node-pty'
import { dirname, resolve } from 'path'
import { stat } from 'fs/promises'
import log from 'electron-log'
import { getAugmentedEnv } from '../../inspectors/safe-exec'

export const PREVIEW_TERMINAL_EVENT_CHANNEL = 'devscope:previewTerminal:event'

type PreviewTerminalEventPayload = {
    sessionId: string
    type: 'started' | 'output' | 'exit' | 'error'
    data?: string
    message?: string
    shell?: string
    cwd?: string
    exitCode?: number
}

type PreviewTerminalSession = {
    sessionId: string
    key: string
    proc: pty.IPty
    webContents: Electron.WebContents
}

const previewTerminalSessions = new Map<string, PreviewTerminalSession>()

function normalizeSessionId(raw: unknown): string {
    const value = String(raw || '').trim()
    return value.length > 0 ? value : ''
}

function getSessionKey(senderId: number, sessionId: string): string {
    return `${senderId}:${sessionId}`
}

function emitTerminalEvent(session: PreviewTerminalSession, payload: PreviewTerminalEventPayload): void {
    if (session.webContents.isDestroyed()) return
    session.webContents.send(PREVIEW_TERMINAL_EVENT_CHANNEL, payload)
}

async function resolveTerminalCwd(targetPathInput?: string): Promise<string> {
    const targetPath = String(targetPathInput || '').trim()
    if (!targetPath) return process.cwd()

    const resolved = resolve(targetPath)
    try {
        const targetStats = await stat(resolved)
        if (targetStats.isDirectory()) return resolved
        return dirname(resolved)
    } catch {
        return process.cwd()
    }
}

function stopTerminalSession(session: PreviewTerminalSession): boolean {
    try {
        session.proc.kill()
        return true
    } catch {
        return false
    }
}

function stopExistingSession(sessionKey: string): void {
    const existing = previewTerminalSessions.get(sessionKey)
    if (!existing) return
    stopTerminalSession(existing)
    previewTerminalSessions.delete(sessionKey)
}

export async function handleCreatePreviewTerminal(
    event: Electron.IpcMainInvokeEvent,
    input: {
        sessionId: string
        targetPath?: string
        preferredShell?: 'powershell' | 'cmd'
        cols?: number
        rows?: number
    }
) {
    const sessionId = normalizeSessionId(input?.sessionId)
    const preferredShell = input?.preferredShell === 'cmd' ? 'cmd' : 'powershell'
    log.info('IPC: createPreviewTerminal', { sessionId, preferredShell, targetPath: input?.targetPath || null })

    try {
        if (!sessionId) {
            return { success: false, error: 'Session ID is required.' }
        }

        const senderId = event.sender.id
        const sessionKey = getSessionKey(senderId, sessionId)
        stopExistingSession(sessionKey)

        const cwd = await resolveTerminalCwd(input?.targetPath)
        const shell = process.platform === 'win32'
            ? (preferredShell === 'cmd' ? 'cmd.exe' : 'powershell.exe')
            : (process.env.SHELL || 'bash')
        const args = shell.toLowerCase().includes('powershell') ? ['-NoLogo'] : []
        const cols = Math.max(40, Math.floor(Number(input?.cols) || 100))
        const rows = Math.max(10, Math.floor(Number(input?.rows) || 28))

        const terminalProc = pty.spawn(shell, args, {
            name: 'xterm-256color',
            cwd,
            cols,
            rows,
            env: {
                ...getAugmentedEnv(),
                TERM: 'xterm-256color',
                COLORTERM: 'truecolor',
                FORCE_COLOR: '1'
            } as any,
            useConpty: process.platform === 'win32',
            conptyInheritCursor: true
        })

        const session: PreviewTerminalSession = {
            sessionId,
            key: sessionKey,
            proc: terminalProc,
            webContents: event.sender
        }
        previewTerminalSessions.set(sessionKey, session)

        emitTerminalEvent(session, {
            sessionId,
            type: 'started',
            shell,
            cwd
        })

        terminalProc.onData((data: string) => {
            emitTerminalEvent(session, {
                sessionId,
                type: 'output',
                data: String(data || '')
            })
        })

        terminalProc.onExit((result) => {
            const active = previewTerminalSessions.get(sessionKey)
            if (active && active.proc === terminalProc) {
                previewTerminalSessions.delete(sessionKey)
            }
            emitTerminalEvent(session, {
                sessionId,
                type: 'exit',
                exitCode: Number(result?.exitCode ?? 0)
            })
        })

        return { success: true, shell, cwd }
    } catch (err: any) {
        log.error('Failed to create preview terminal:', err)
        return { success: false, error: err?.message || 'Failed to create preview terminal.' }
    }
}

export async function handleWritePreviewTerminal(
    event: Electron.IpcMainInvokeEvent,
    input: {
        sessionId: string
        data: string
    }
) {
    const sessionId = normalizeSessionId(input?.sessionId)
    try {
        if (!sessionId) {
            return { success: false, error: 'Session ID is required.' }
        }
        const sessionKey = getSessionKey(event.sender.id, sessionId)
        const session = previewTerminalSessions.get(sessionKey)
        if (!session) {
            return { success: false, error: 'Preview terminal session not found.' }
        }
        session.proc.write(String(input?.data || ''))
        return { success: true }
    } catch (err: any) {
        log.error('Failed to write preview terminal input:', err)
        return { success: false, error: err?.message || 'Failed to write terminal input.' }
    }
}

export async function handleResizePreviewTerminal(
    event: Electron.IpcMainInvokeEvent,
    input: {
        sessionId: string
        cols: number
        rows: number
    }
) {
    const sessionId = normalizeSessionId(input?.sessionId)
    try {
        if (!sessionId) {
            return { success: false, error: 'Session ID is required.' }
        }
        const sessionKey = getSessionKey(event.sender.id, sessionId)
        const session = previewTerminalSessions.get(sessionKey)
        if (!session) {
            return { success: false, error: 'Preview terminal session not found.' }
        }
        const cols = Math.max(40, Math.floor(Number(input?.cols) || 100))
        const rows = Math.max(10, Math.floor(Number(input?.rows) || 28))
        session.proc.resize(cols, rows)
        return { success: true }
    } catch (err: any) {
        log.error('Failed to resize preview terminal:', err)
        return { success: false, error: err?.message || 'Failed to resize preview terminal.' }
    }
}

export async function handleClosePreviewTerminal(
    event: Electron.IpcMainInvokeEvent,
    sessionIdInput: string
) {
    const sessionId = normalizeSessionId(sessionIdInput)
    try {
        if (!sessionId) {
            return { success: false, error: 'Session ID is required.' }
        }
        const sessionKey = getSessionKey(event.sender.id, sessionId)
        const session = previewTerminalSessions.get(sessionKey)
        if (!session) {
            return { success: true, closed: false }
        }

        const closed = stopTerminalSession(session)
        previewTerminalSessions.delete(sessionKey)
        return { success: true, closed }
    } catch (err: any) {
        log.error('Failed to close preview terminal:', err)
        return { success: false, error: err?.message || 'Failed to close preview terminal.' }
    }
}
