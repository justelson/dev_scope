import { getRecentProjectEntry } from '@/lib/recentProjects'
import type { DiscoveredProject, ProjectGitOverviewItem, ProjectOverviewItem, RecentProjectEntry } from './types'

export interface ScanResult {
    success: boolean
    error?: string
    projects?: DiscoveredProject[]
    folders?: Array<{ path: string }>
}

export interface ProjectsGitOverviewResult {
    success: boolean
    error?: string
    items?: ProjectGitOverviewItem[]
}

export function normalizePathKey(path: string): string {
    return path.replace(/\\/g, '/').toLowerCase()
}

export function formatRelativeTime(timestamp?: number): string {
    if (!timestamp) return 'n/a'

    const deltaMs = Date.now() - timestamp
    if (deltaMs < 60_000) return 'just now'

    const minutes = Math.floor(deltaMs / 60_000)
    if (minutes < 60) return `${minutes}m ago`

    const hours = Math.floor(deltaMs / 3_600_000)
    if (hours < 24) return `${hours}h ago`

    const days = Math.floor(deltaMs / 86_400_000)
    if (days < 7) return `${days}d ago`

    return new Date(timestamp).toLocaleDateString()
}

export function getProjectRoute(project: ProjectOverviewItem): string {
    const encodedPath = encodeURIComponent(project.path)
    if (project.type === 'git') return `/folder-browse/${encodedPath}`
    return `/projects/${encodedPath}`
}

export function mergeProjectOverview(
    projects: DiscoveredProject[],
    overviewItems: ProjectGitOverviewItem[] | undefined,
    recentProjects: Record<string, RecentProjectEntry>
): ProjectOverviewItem[] {
    const overviewMap = new Map<string, ProjectGitOverviewItem>()
    for (const overview of overviewItems || []) {
        overviewMap.set(normalizePathKey(overview.path), overview)
    }

    return projects.map((project) => {
        const overview = overviewMap.get(normalizePathKey(project.path))
        const recent = getRecentProjectEntry(project.path, recentProjects)

        return {
            ...project,
            path: project.path,
            isGitRepo: overview?.isGitRepo ?? false,
            changedCount: overview?.changedCount ?? 0,
            unpushedCount: overview?.unpushedCount ?? 0,
            hasRemote: overview?.hasRemote ?? false,
            error: overview?.error,
            lastOpenedAt: recent?.lastOpenedAt,
            openCount: recent?.openCount,
            lastRoute: recent?.lastRoute
        }
    })
}
