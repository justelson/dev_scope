import type { AssistantSession, AssistantThread } from '@shared/assistant/contracts'
import { getAssistantThreadPhase } from '@/lib/assistant/selectors'

export type AssistantSessionsRailProps = {
    collapsed: boolean
    width: number
    compact?: boolean
    sessions: AssistantSession[]
    activeSessionId: string | null
    commandPending: boolean
    onSetCollapsed: (collapsed: boolean) => void
    onWidthChange?: (width: number) => void
    onCreateSession: (projectPath?: string) => Promise<void>
    onSelectSession: (sessionId: string) => Promise<void>
    onRenameSession: (sessionId: string, title: string) => Promise<void>
    onArchiveSession: (sessionId: string, archived?: boolean) => Promise<void>
    onDeleteSession: (sessionId: string) => Promise<void>
    onChooseProjectPath: () => Promise<void>
}

export type SessionProjectGroup = {
    key: string
    label: string
    path: string
    updatedAt: string
    sessions: AssistantSession[]
}

export interface SessionStatusPill {
    label: string
    colorClass: string
    dotClass: string
    pulse: boolean
}

export function resolveSessionStatusPill(session: AssistantSession): SessionStatusPill | null {
    const activeThread: AssistantThread | null = session.threads.find((t) => t.id === session.activeThreadId) || null
    if (!activeThread) return null
    const phase = getAssistantThreadPhase(activeThread)
    switch (phase.key) {
        case 'running':
        case 'starting':
            return { label: phase.key === 'running' ? 'Working' : 'Starting', colorClass: 'text-sky-400', dotClass: 'bg-sky-400', pulse: true }
        case 'waiting-approval':
            return { label: 'Pending', colorClass: 'text-amber-300', dotClass: 'bg-amber-400', pulse: false }
        case 'waiting-input':
            return { label: 'Input', colorClass: 'text-indigo-300', dotClass: 'bg-indigo-400', pulse: false }
        case 'error':
            return { label: 'Error', colorClass: 'text-red-300', dotClass: 'bg-red-400', pulse: false }
        case 'stopped':
            return { label: 'Stopped', colorClass: 'text-sparkle-text-muted', dotClass: 'bg-sparkle-text-muted/50', pulse: false }
        default:
            return null
    }
}

const NO_PROJECT_KEY = '__assistant-no-project__'

export function normalizeProjectPath(value?: string | null): string {
    return String(value || '').trim()
}

export function getProjectKey(path: string): string {
    return path || NO_PROJECT_KEY
}

export function getProjectLabel(path: string): string {
    if (!path) return 'No Directory'
    const parts = path.split(/[\\/]/).filter(Boolean)
    return parts[parts.length - 1] || path
}

export function getDisplayTitle(title: string): string {
    const trimmed = String(title || '').trim()
    return trimmed || 'Untitled Session'
}

export function getSortableTimestamp(value: string): number {
    const timestamp = Date.parse(value)
    return Number.isFinite(timestamp) ? timestamp : 0
}

export function groupSessionsByProject(sessions: AssistantSession[]): SessionProjectGroup[] {
    const groups = new Map<string, SessionProjectGroup>()
    for (const session of sessions) {
        const latestThread = [...(session.threads || [])].sort((a, b) => getSortableTimestamp(b.updatedAt) - getSortableTimestamp(a.updatedAt))[0]
        const fallbackPath = latestThread?.cwd || null
        const normalizedPath = normalizeProjectPath(session.projectPath || fallbackPath)
        const key = getProjectKey(normalizedPath)
        const existing = groups.get(key)
        if (!existing) {
            groups.set(key, { key, label: getProjectLabel(normalizedPath), path: normalizedPath, updatedAt: session.updatedAt, sessions: [session] })
            continue
        }
        existing.sessions.push(session)
        if (getSortableTimestamp(session.updatedAt) > getSortableTimestamp(existing.updatedAt)) {
            existing.updatedAt = session.updatedAt
        }
    }
    return Array.from(groups.values())
        .map((group) => ({ ...group, sessions: [...group.sessions].sort((left, right) => getSortableTimestamp(right.updatedAt) - getSortableTimestamp(left.updatedAt)) }))
        .sort((left, right) => getSortableTimestamp(right.updatedAt) - getSortableTimestamp(left.updatedAt))
}
