import type { AssistantPlaygroundState, AssistantSession, AssistantThread } from '@shared/assistant/contracts'
import { getAssistantThreadPhase } from '@/lib/assistant/selectors'
import { getCachedProjectDetails, primeProjectDetailsCache } from '@/lib/projectViewCache'
import type { AssistantRailMode } from './useAssistantPageSidebarState'

export type AssistantMutationResult = { success: true } | { success: false; error: string }

export type AssistantSessionsRailProps = {
    collapsed: boolean
    width: number
    compact?: boolean
    railMode: AssistantRailMode
    onRailModeChange: (next: AssistantRailMode) => void
    sessions: AssistantSession[]
    playground: AssistantPlaygroundState
    backgroundActivitySessions: AssistantSession[]
    activeSessionId: string | null
    activeThreadId: string | null
    commandPending: boolean
    onWidthChange?: (width: number) => void
    onCreateSession: (projectPath?: string) => Promise<void>
    onCreatePlaygroundSession: (labId?: string | null) => Promise<void>
    onSelectSession: (sessionId: string) => Promise<void>
    onSelectThread: (input: { sessionId: string; threadId: string }) => Promise<void>
    onRenameSession: (sessionId: string, title: string) => Promise<void>
    onArchiveSession: (sessionId: string, archived?: boolean) => Promise<void>
    onDeleteSession: (sessionId: string) => Promise<AssistantMutationResult>
    onChooseProjectPath: () => Promise<void>
    onSetPlaygroundRoot: (rootPath: string | null) => Promise<void>
    onCreatePlaygroundLab: (input: {
        title?: string
        source: 'empty' | 'git-clone' | 'existing-folder'
        repoUrl?: string
        existingFolderPath?: string
        openSession?: boolean
    }) => Promise<unknown> | void
    onDeletePlaygroundLab: (labId: string) => Promise<AssistantMutationResult>
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
    badgeClass?: string
    pulse: boolean
    showLabel?: boolean
}

const RECENCY_TIER_STYLES: Array<Pick<SessionStatusPill, 'label' | 'colorClass' | 'dotClass'>> = [
    { label: 'Most recent', colorClass: 'text-cyan-300', dotClass: 'bg-cyan-300' },
    { label: 'Very recent', colorClass: 'text-sky-300', dotClass: 'bg-sky-300' },
    { label: 'Recent', colorClass: 'text-sky-400', dotClass: 'bg-sky-400' },
    { label: 'Seen lately', colorClass: 'text-sky-500', dotClass: 'bg-sky-500/90' },
    { label: 'Earlier', colorClass: 'text-blue-400', dotClass: 'bg-blue-400/80' },
    { label: 'Older', colorClass: 'text-blue-500/80', dotClass: 'bg-blue-500/60' },
    { label: 'Oldest', colorClass: 'text-sparkle-text-muted', dotClass: 'bg-sparkle-text-muted/30' }
]

export function buildAssistantThreadRecencyTierMap(sessions: AssistantSession[]): ReadonlyMap<string, number> {
    const threads = sessions.flatMap((session) => session.threads)
    if (threads.length === 0) return new Map()

    const sortedThreads = [...threads].sort((left, right) => {
        const updatedDelta = getSortableTimestamp(right.updatedAt) - getSortableTimestamp(left.updatedAt)
        if (updatedDelta !== 0) return updatedDelta
        const createdDelta = getSortableTimestamp(right.createdAt) - getSortableTimestamp(left.createdAt)
        if (createdDelta !== 0) return createdDelta
        return left.id.localeCompare(right.id)
    })
    const tierCount = RECENCY_TIER_STYLES.length
    const tierByThreadId = new Map<string, number>()

    const maxIndex = Math.max(1, sortedThreads.length - 1)

    sortedThreads.forEach((thread, index) => {
        const tier = sortedThreads.length <= 1
            ? 0
            : Math.min(tierCount - 1, Math.round((index / maxIndex) * (tierCount - 1)))
        tierByThreadId.set(thread.id, tier)
    })

    return tierByThreadId
}

function resolveAssistantThreadRecencyPill(
    thread: AssistantThread,
    _isActiveThread: boolean,
    recencyTierByThreadId?: ReadonlyMap<string, number>
): SessionStatusPill {
    const tier = recencyTierByThreadId?.get(thread.id) ?? (RECENCY_TIER_STYLES.length - 1)
    const style = RECENCY_TIER_STYLES[Math.max(0, Math.min(RECENCY_TIER_STYLES.length - 1, tier))]
    return {
        ...style,
        pulse: false,
        showLabel: false
    }
}

export type AssistantSessionThreadTreeNode = {
    thread: AssistantThread
    children: AssistantSessionThreadTreeNode[]
}

export function resolveSessionStatusPill(
    session: AssistantSession,
    activeSessionId: string | null,
    recencyTierByThreadId?: ReadonlyMap<string, number>
): SessionStatusPill | null {
    const activeThread: AssistantThread | null = session.threads.find((t) => t.id === session.activeThreadId) || null
    if (!activeThread) return null
    return resolveAssistantThreadStatusPill(activeThread, session.id === activeSessionId, recencyTierByThreadId)
}

export function resolveAssistantThreadStatusPill(
    thread: AssistantThread | null,
    isActiveThread: boolean,
    recencyTierByThreadId?: ReadonlyMap<string, number>
): SessionStatusPill | null {
    if (!thread) return null
    const phase = getAssistantThreadPhase(thread)
    const latestTurn = thread.latestTurn

    switch (phase.key) {
        case 'starting':
            return {
                label: 'Connecting',
                colorClass: 'text-sky-400',
                dotClass: 'bg-sky-400',
                badgeClass: 'bg-sky-500/[0.12] text-sky-100',
                pulse: true
            }
        case 'running':
        case 'waiting':
            return {
                label: 'Working',
                colorClass: 'text-sky-400',
                dotClass: 'bg-sky-400',
                badgeClass: 'bg-sky-500/[0.12] text-sky-100',
                pulse: true
            }
        case 'waiting-approval':
            return {
                label: 'Pending',
                colorClass: 'text-amber-300',
                dotClass: 'bg-amber-400',
                badgeClass: 'bg-amber-500/[0.12] text-amber-100',
                pulse: false
            }
        case 'waiting-input':
            return {
                label: 'Input needed',
                colorClass: 'text-indigo-300',
                dotClass: 'bg-indigo-400',
                badgeClass: 'bg-indigo-500/[0.12] text-indigo-100',
                pulse: false
            }
        case 'ready':
        case 'idle':
            if (
                !isActiveThread
                && latestTurn?.state === 'completed'
                && thread.lastSeenCompletedTurnId !== latestTurn.id
            ) {
                return {
                    label: 'Done',
                    colorClass: 'text-emerald-300',
                    dotClass: 'bg-emerald-400',
                    badgeClass: 'bg-emerald-500/[0.12] text-emerald-100',
                    pulse: false
                }
            }
            return resolveAssistantThreadRecencyPill(thread, isActiveThread, recencyTierByThreadId)
        case 'error':
            return {
                label: 'Error',
                colorClass: 'text-red-300',
                dotClass: 'bg-red-400',
                badgeClass: 'bg-red-500/[0.12] text-red-100',
                pulse: false
            }
        case 'stopped':
            return resolveAssistantThreadRecencyPill(thread, isActiveThread, recencyTierByThreadId)
        default:
            return resolveAssistantThreadRecencyPill(thread, isActiveThread, recencyTierByThreadId)
    }
}

const NO_PROJECT_KEY = '__assistant-no-project__'

export function normalizeProjectPath(value?: string | null): string {
    return String(value || '').trim()
}

function isDetachedPlaygroundChatSession(session: AssistantSession): boolean {
    return session.mode === 'playground'
        && !normalizeProjectPath(session.projectPath)
        && !session.playgroundLabId
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

export function formatAssistantSidebarRelativeTime(value: string): string {
    const timestamp = Date.parse(value)
    if (!Number.isFinite(timestamp)) return value

    const deltaMs = Math.max(0, Date.now() - timestamp)
    if (deltaMs < 60_000) return 'just now'

    const minutes = Math.floor(deltaMs / 60_000)
    if (minutes < 60) return `${minutes} min${minutes === 1 ? '' : 's'} ago`

    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `${hours} hr${hours === 1 ? '' : 's'} ago`

    const days = Math.floor(hours / 24)
    if (days < 7) return `${days} day${days === 1 ? '' : 's'} ago`

    const weeks = Math.floor(days / 7)
    if (weeks < 5) return `${weeks} week${weeks === 1 ? '' : 's'} ago`

    const months = Math.floor(days / 30)
    if (months < 12) return `${months} month${months === 1 ? '' : 's'} ago`

    const years = Math.floor(days / 365)
    return `${years} year${years === 1 ? '' : 's'} ago`
}

export function isAssistantSubagentThread(thread: AssistantThread): boolean {
    return thread.source === 'subagent'
}

export function getAssistantThreadDisplayTitle(thread: AssistantThread): string {
    return thread.agentNickname || thread.agentRole || 'Subagent'
}

export function getPrimarySessionThread(session: AssistantSession): AssistantThread | null {
    const rootThreads = session.threads.filter((thread) => !isAssistantSubagentThread(thread))
    if (rootThreads.length === 0) return session.threads[0] || null
    return [...rootThreads].sort((left, right) => getSortableTimestamp(left.createdAt) - getSortableTimestamp(right.createdAt))[0] || null
}

export function buildSessionSubagentTree(session: AssistantSession): AssistantSessionThreadTreeNode[] {
    const primaryThread = getPrimarySessionThread(session)
    if (!primaryThread) return []

    const subagentThreads = session.threads.filter(isAssistantSubagentThread)
    if (subagentThreads.length === 0) return []

    const nodeById = new Map<string, AssistantSessionThreadTreeNode>(
        subagentThreads.map((thread) => [thread.id, { thread, children: [] }])
    )
    const roots: AssistantSessionThreadTreeNode[] = []

    for (const thread of subagentThreads) {
        const node = nodeById.get(thread.id)
        if (!node) continue
        const parentId = thread.parentThreadId
        if (parentId && nodeById.has(parentId)) {
            nodeById.get(parentId)?.children.push(node)
            continue
        }
        if (!parentId || parentId === primaryThread.id) {
            roots.push(node)
            continue
        }
        roots.push(node)
    }

    const sortNodes = (nodes: AssistantSessionThreadTreeNode[]): AssistantSessionThreadTreeNode[] => (
        nodes
            .sort((left, right) => getSortableTimestamp(right.thread.updatedAt) - getSortableTimestamp(left.thread.updatedAt))
            .map((node) => ({
                ...node,
                children: sortNodes(node.children)
            }))
    )

    return sortNodes(roots)
}

function isDefaultSessionTitle(title: string): boolean {
    const normalized = getDisplayTitle(title).trim().toLowerCase()
    return normalized === 'new session' || normalized === 'new playground chat'
}

function deriveTitleFromMessage(text: string): string {
    const normalized = String(text || '').replace(/\s+/g, ' ').trim()
    if (!normalized) return 'New Session'
    return normalized.slice(0, 60)
}

export function getSessionDisplayTitle(session: AssistantSession): string {
    if (!isDefaultSessionTitle(session.title)) {
        return getDisplayTitle(session.title)
    }

    const firstUserMessage = session.threads
        .flatMap((thread) => thread.messages || [])
        .find((message) => message.role === 'user' && String(message.text || '').trim().length > 0)

    return firstUserMessage ? deriveTitleFromMessage(firstUserMessage.text) : getDisplayTitle(session.title)
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
    if (isDetachedPlaygroundChatSession(session)) return ''
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
