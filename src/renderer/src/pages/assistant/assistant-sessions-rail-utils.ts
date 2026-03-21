import type { AssistantSession, AssistantThread } from '@shared/assistant/contracts'
import { getAssistantThreadPhase } from '@/lib/assistant/selectors'
import { getCachedProjectDetails, primeProjectDetailsCache } from '@/lib/projectViewCache'

export type AssistantSessionsRailProps = {
    collapsed: boolean
    width: number
    compact?: boolean
    sessions: AssistantSession[]
    activeSessionId: string | null
    commandPending: boolean
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
    createdAt: string
    projectIconPath: string | null
    projectType: string | null
    framework: string | null
    sessions: AssistantSession[]
}

export interface SessionStatusPill {
    label: string
    colorClass: string
    dotClass: string
    pulse: boolean
    showLabel?: boolean
}

export function resolveSessionStatusPill(session: AssistantSession, activeSessionId: string | null): SessionStatusPill | null {
    const activeThread: AssistantThread | null = session.threads.find((t) => t.id === session.activeThreadId) || null
    if (!activeThread) return null
    const phase = getAssistantThreadPhase(activeThread)
    const latestTurn = activeThread.latestTurn
    const isActiveSession = session.id === activeSessionId

    switch (phase.key) {
        case 'starting':
            return { label: 'Connecting', colorClass: 'text-sky-400', dotClass: 'bg-sky-400', pulse: true }
        case 'running':
        case 'waiting':
            return { label: 'Working', colorClass: 'text-sky-400', dotClass: 'bg-sky-400', pulse: true }
        case 'waiting-approval':
            return { label: 'Pending', colorClass: 'text-amber-300', dotClass: 'bg-amber-400', pulse: false }
        case 'waiting-input':
            return { label: 'Input', colorClass: 'text-indigo-300', dotClass: 'bg-indigo-400', pulse: false }
        case 'ready':
        case 'idle':
            if (
                !isActiveSession
                && latestTurn?.state === 'completed'
                && activeThread.lastSeenCompletedTurnId !== latestTurn.id
            ) {
                return { label: 'Done', colorClass: 'text-emerald-300', dotClass: 'bg-emerald-400', pulse: false }
            }
            return { label: 'Idle', colorClass: 'text-sparkle-text-muted', dotClass: 'bg-sparkle-text-muted/60', pulse: false, showLabel: false }
        case 'error':
            return { label: 'Error', colorClass: 'text-red-300', dotClass: 'bg-red-400', pulse: false }
        case 'stopped':
            return { label: 'Stopped', colorClass: 'text-sparkle-text-muted', dotClass: 'bg-sparkle-text-muted/50', pulse: false, showLabel: false }
        default:
            return { label: 'Idle', colorClass: 'text-sparkle-text-muted', dotClass: 'bg-sparkle-text-muted/60', pulse: false, showLabel: false }
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

function resolveProjectPresentation(projectPath: string): Pick<SessionProjectGroup, 'projectIconPath' | 'projectType' | 'framework'> {
    if (!projectPath) {
        return {
            projectIconPath: null,
            projectType: null,
            framework: null
        }
    }

    const cached = getCachedProjectDetails(projectPath) as {
        projectIconPath?: string | null
        type?: string
        frameworks?: unknown
    } | null

    const firstFramework = Array.isArray(cached?.frameworks) ? cached.frameworks.find((value): value is string => typeof value === 'string' && value.trim().length > 0) : null

    return {
        projectIconPath: typeof cached?.projectIconPath === 'string' ? cached.projectIconPath : null,
        projectType: typeof cached?.type === 'string' && cached.type.trim().length > 0 ? cached.type : null,
        framework: firstFramework || null
    }
}

const PROJECT_METADATA_REFRESH_DELAY_MS = 60_000
const PROJECT_METADATA_IN_FLIGHT_PATHS = new Map<string, Promise<boolean>>()
const PROJECT_METADATA_LAST_ATTEMPT_MS = new Map<string, number>()

export function resolveSessionProjectPath(session: AssistantSession): string {
    const activeThread = session.threads.find((thread) => thread.id === session.activeThreadId) || null
    let earliestCreatedThread: AssistantThread | null = null

    for (const thread of session.threads || []) {
        if (!earliestCreatedThread) {
            earliestCreatedThread = thread
            continue
        }
        if (getSortableTimestamp(thread.createdAt) < getSortableTimestamp(earliestCreatedThread.createdAt)) {
            earliestCreatedThread = thread
        }
    }

    return normalizeProjectPath(session.projectPath || activeThread?.cwd || earliestCreatedThread?.cwd || null)
}

export async function hydrateProjectMetadataForPaths(projectPaths: string[]): Promise<number> {
    const now = Date.now()
    const uniquePaths = Array.from(new Set(projectPaths.map((path) => normalizeProjectPath(path)).filter(Boolean)))
    if (uniquePaths.length === 0) return 0

    const requestedPaths = uniquePaths.filter((path) => {
        if (getCachedProjectDetails(path)) return false
        const lastAttempt = PROJECT_METADATA_LAST_ATTEMPT_MS.get(path)
        if (lastAttempt && now - lastAttempt < PROJECT_METADATA_REFRESH_DELAY_MS) return false
        return true
    })

    if (requestedPaths.length === 0) return 0

    let hydratedCount = 0

    const hydratePath = async (projectPath: string): Promise<boolean> => {
        try {
            const cached = getCachedProjectDetails(projectPath)
            if (cached && cached.type) {
                return false
            }

            const result = await window.devscope.getProjectDetails(projectPath)
            if (!result?.success || !result?.project || typeof result.project !== 'object') {
                return false
            }

            const project = result.project as Record<string, unknown>
            const name = typeof project.name === 'string' && project.name.trim().length > 0 ? project.name : null
            const projectIconPath = typeof project.projectIconPath === 'string' ? project.projectIconPath : null
            const type = typeof project.type === 'string' && project.type.trim().length > 0 ? project.type : 'unknown'
            const frameworks = Array.isArray(project.frameworks)
                ? project.frameworks.filter((framework): framework is string => typeof framework === 'string' && framework.trim().length > 0)
                : []
            const lastModified = typeof project.lastModified === 'number' ? project.lastModified : undefined

            primeProjectDetailsCache({
                name: name || projectPath.split(/[\\/]/).filter(Boolean).pop() || 'Project',
                path: projectPath,
                type,
                projectIconPath,
                frameworks,
                markers: Array.isArray(project.markers)
                    ? project.markers.filter((marker): marker is string => typeof marker === 'string' && marker.trim().length > 0)
                    : [],
                lastModified
            })
            return true
        } catch {
            return false
        }
    }

    await Promise.all(
        requestedPaths.map((projectPath) => {
            const existingRequest = PROJECT_METADATA_IN_FLIGHT_PATHS.get(projectPath)
            if (existingRequest) return existingRequest

            const request = hydratePath(projectPath).finally(() => {
                PROJECT_METADATA_IN_FLIGHT_PATHS.delete(projectPath)
                PROJECT_METADATA_LAST_ATTEMPT_MS.set(projectPath, Date.now())
            })

            PROJECT_METADATA_IN_FLIGHT_PATHS.set(projectPath, request)
            return request
        })
    ).then((results) => {
        hydratedCount = results.filter(Boolean).length
    })

    return hydratedCount
}

export function groupSessionsByProject(sessions: AssistantSession[]): SessionProjectGroup[] {
    const groups = new Map<string, SessionProjectGroup>()
    for (const session of sessions) {
        const normalizedPath = resolveSessionProjectPath(session)
        const projectPresentation = resolveProjectPresentation(normalizedPath)
        const key = getProjectKey(normalizedPath)
        const existing = groups.get(key)
        if (!existing) {
            groups.set(key, {
                key,
                label: getProjectLabel(normalizedPath),
                path: normalizedPath,
                createdAt: session.createdAt,
                projectIconPath: projectPresentation.projectIconPath,
                projectType: projectPresentation.projectType,
                framework: projectPresentation.framework,
                sessions: [session]
            })
            continue
        }
        existing.sessions.push(session)
        if (getSortableTimestamp(session.createdAt) > getSortableTimestamp(existing.createdAt)) {
            existing.createdAt = session.createdAt
        }
        if (!existing.projectIconPath && projectPresentation.projectIconPath) {
            existing.projectIconPath = projectPresentation.projectIconPath
        }
        if (!existing.projectType && projectPresentation.projectType) {
            existing.projectType = projectPresentation.projectType
        }
        if (!existing.framework && projectPresentation.framework) {
            existing.framework = projectPresentation.framework
        }
    }
    return Array.from(groups.values())
        .map((group) => ({
            ...group,
            sessions: [...group.sessions].sort((left, right) =>
                getSortableTimestamp(right.createdAt) - getSortableTimestamp(left.createdAt)
            )
        }))
        .sort((left, right) => getSortableTimestamp(right.createdAt) - getSortableTimestamp(left.createdAt))
}
