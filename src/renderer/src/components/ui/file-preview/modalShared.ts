import type { DevScopePreviewTerminalSessionSummary } from '@shared/contracts/devscope-api'
import type { GitLineMarker } from './gitDiff'
import type { PreviewFile } from './types'

export type PendingIntent = 'close' | 'preview'
export type OutlineItem = { label: string; line: number; kind: 'function' | 'class' | 'heading' }
export type LocalDiffPreview = {
    additions: number
    deletions: number
    markers: GitLineMarker[]
}
export type PythonOutputSource = 'stdout' | 'stderr' | 'system'
export type PythonOutputEntry = {
    id: number
    source: PythonOutputSource
    text: string
    at: number
}
export type PreviewTerminalSessionItem = DevScopePreviewTerminalSessionSummary & {
    hasUnreadOutput?: boolean
}
export type PreviewTerminalState = 'idle' | 'connecting' | 'active' | 'exited' | 'error'
export type TerminalPanelPhase = 'hidden' | 'entering' | 'visible' | 'exiting'

export const LEFT_PANEL_MIN_WIDTH = 260
export const LEFT_PANEL_MAX_WIDTH = 460
export const RIGHT_PANEL_MIN_WIDTH = 240
export const RIGHT_PANEL_MAX_WIDTH = 520
export const PYTHON_OUTPUT_MAX_CHARS = 200_000
export const PYTHON_OUTPUT_MIN_HEIGHT = 96
export const PREVIEW_TERMINAL_MIN_HEIGHT = 140
export const TERMINAL_PANEL_ANIMATION_MS = 220

export function countLines(value: string): number {
    if (!value) return 0
    return value.split(/\r?\n/).length
}

export function createPythonPreviewSessionId(): string {
    return `py-prev-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

export function createPreviewTerminalSessionId(): string {
    return `preview-term-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

export function readCssVariable(name: string, fallback: string): string {
    if (typeof window === 'undefined') return fallback
    const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
    return value || fallback
}

export function formatRelativeActivity(timestamp: number): string {
    const deltaMs = Math.max(0, Date.now() - timestamp)
    const seconds = Math.floor(deltaMs / 1000)
    if (seconds < 60) return `${seconds}s`
    const minutes = Math.floor(seconds / 60)
    if (minutes < 60) return `${minutes}m`
    const hours = Math.floor(minutes / 60)
    return `${hours}h`
}

export function mapTerminalStatusToState(status?: string | null): PreviewTerminalState {
    if (status === 'running') return 'active'
    if (status === 'error') return 'error'
    if (status === 'exited') return 'exited'
    return 'idle'
}

export function isEditableFileType(fileType: PreviewFile['type']): boolean {
    return fileType === 'md'
        || fileType === 'json'
        || fileType === 'csv'
        || fileType === 'code'
        || fileType === 'text'
        || fileType === 'html'
}

export function extractOutlineItems(content: string, fileType: PreviewFile['type']): OutlineItem[] {
    const lines = content.split(/\r?\n/)
    const items: OutlineItem[] = []
    const pushItem = (item: OutlineItem) => {
        if (items.length >= 120) return
        items.push(item)
    }

    for (let index = 0; index < lines.length; index += 1) {
        const line = lines[index] || ''
        const trimmed = line.trim()
        if (!trimmed) continue

        const headingMatch = /^(#{1,4})\s+(.+)$/.exec(trimmed)
        if (headingMatch && (fileType === 'md' || fileType === 'text')) {
            pushItem({ label: headingMatch[2].trim(), line: index + 1, kind: 'heading' })
            continue
        }

        const classMatch = /^(?:export\s+)?(?:default\s+)?class\s+([A-Za-z0-9_$]+)/.exec(trimmed)
        if (classMatch) {
            pushItem({ label: classMatch[1], line: index + 1, kind: 'class' })
            continue
        }

        const fnMatch = /^(?:export\s+)?(?:async\s+)?function\s+([A-Za-z0-9_$]+)/.exec(trimmed)
            || /^(?:const|let|var)\s+([A-Za-z0-9_$]+)\s*=\s*(?:async\s*)?(?:\([^)]*\)|[A-Za-z0-9_$]+)\s*=>/.exec(trimmed)
            || /^([A-Za-z0-9_$]+)\s*\([^)]*\)\s*\{?$/.exec(trimmed)
        if (fnMatch) {
            pushItem({ label: fnMatch[1], line: index + 1, kind: 'function' })
            continue
        }
    }

    return items
}

export function buildLocalDiffPreview(previousContent: string, nextContent: string): LocalDiffPreview {
    const previousLines = previousContent.split(/\r?\n/)
    const nextLines = nextContent.split(/\r?\n/)

    let prefix = 0
    const minLength = Math.min(previousLines.length, nextLines.length)
    while (prefix < minLength && previousLines[prefix] === nextLines[prefix]) {
        prefix += 1
    }

    let suffix = 0
    while (
        suffix < (previousLines.length - prefix)
        && suffix < (nextLines.length - prefix)
        && previousLines[previousLines.length - 1 - suffix] === nextLines[nextLines.length - 1 - suffix]
    ) {
        suffix += 1
    }

    const removedCount = Math.max(0, previousLines.length - prefix - suffix)
    const addedCount = Math.max(0, nextLines.length - prefix - suffix)
    const markers: GitLineMarker[] = []

    if (addedCount > 0 && removedCount > 0) {
        for (let index = 0; index < addedCount; index += 1) {
            markers.push({ line: prefix + index + 1, type: 'modified' })
        }
    } else if (addedCount > 0) {
        for (let index = 0; index < addedCount; index += 1) {
            markers.push({ line: prefix + index + 1, type: 'added' })
        }
    } else if (removedCount > 0) {
        markers.push({ line: Math.max(1, prefix + 1), type: 'deleted' })
    }

    return {
        additions: addedCount,
        deletions: removedCount,
        markers
    }
}
