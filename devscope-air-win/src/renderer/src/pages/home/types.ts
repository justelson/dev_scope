export type RecentProjectRoute = 'project' | 'folder'

export interface RecentProjectEntry {
    lastOpenedAt: number
    openCount: number
    lastRoute: RecentProjectRoute
}

export interface DiscoveredProject {
    name: string
    path: string
    type: string
    markers: string[]
    frameworks: string[]
    lastModified?: number
    isProject: boolean
}

export interface ProjectGitOverviewItem {
    path: string
    isGitRepo: boolean
    changedCount: number
    unpushedCount: number
    hasRemote: boolean
    error?: string
}

export interface ProjectOverviewItem extends DiscoveredProject, ProjectGitOverviewItem {
    lastOpenedAt?: number
    openCount?: number
    lastRoute?: RecentProjectRoute
}
