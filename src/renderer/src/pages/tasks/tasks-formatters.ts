import type { MemoryUnit } from './tasks-types'
import type { DevScopePreviewTerminalSessionSummary } from '@shared/contracts/devscope-api'

export function formatRelativeShort(timestamp: number): string {
    const deltaMs = Math.max(0, Date.now() - timestamp)
    const seconds = Math.floor(deltaMs / 1000)
    if (seconds < 60) return `${seconds}s ago`
    const minutes = Math.floor(seconds / 60)
    if (minutes < 60) return `${minutes}m ago`
    const hours = Math.floor(minutes / 60)
    return `${hours}h ago`
}

export function formatMemoryLabel(memoryMb: number, unit: MemoryUnit): string {
    if (unit === 'gb') return `${(memoryMb / 1024).toFixed(2)} GB`
    return `${memoryMb.toFixed(1)} MB`
}

export function formatDeviceMemoryLabel(memoryGb: number, unit: MemoryUnit): string {
    if (unit === 'gb') return `${memoryGb.toFixed(1)} GB`
    return `${(memoryGb * 1024).toFixed(0)} MB`
}

export function formatTerminalShellLabel(shell: string): string {
    return String(shell || 'terminal')
        .replace(/\.exe$/i, '')
        .replace(/^pwsh$/i, 'PowerShell')
        .replace(/^powershell$/i, 'PowerShell')
        .replace(/^cmd$/i, 'CMD')
}

export function getTerminalPreviewLine(session: DevScopePreviewTerminalSessionSummary): string {
    const previewLine = String(session.recentOutput || '')
        .trim()
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)
        .slice(-1)[0]

    return previewLine || session.cwd
}

export function readCssVariable(name: string, fallback: string): string {
    if (typeof window === 'undefined') return fallback
    const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
    return value || fallback
}

export function createPreviewTerminalSessionId(): string {
    return `tasks-term-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}
