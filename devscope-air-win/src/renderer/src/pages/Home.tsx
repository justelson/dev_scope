import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
    ExternalLink,
    FolderTree,
    GitBranch,
    GitCommitHorizontal,
    RefreshCw,
    Upload,
    Wrench
} from 'lucide-react'
import { useSettings } from '@/lib/settings'
import { cn } from '@/lib/utils'
import { getRecentProjectEntry, getRecentProjects } from '@/lib/recentProjects'
import type {
    DiscoveredProject,
    ProjectGitOverviewItem,
    ProjectOverviewItem,
    RecentProjectEntry
} from './home/types'

const AUTO_REFRESH_MS = 60_000

interface ScanResult {
    success: boolean
    error?: string
    projects?: DiscoveredProject[]
}

interface ProjectsGitOverviewResult {
    success: boolean
    error?: string
    items?: ProjectGitOverviewItem[]
}

function normalizePathKey(path: string): string {
    return path.replace(/\\/g, '/').toLowerCase()
}

function formatRelativeTime(timestamp?: number): string {
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

function getProjectRoute(project: ProjectOverviewItem): string {
    const encodedPath = encodeURIComponent(project.path)
    if (project.type === 'git') return `/folder-browse/${encodedPath}`
    return `/projects/${encodedPath}`
}

function mergeProjectOverview(
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

export default function Home() {
    const navigate = useNavigate()
    const { settings } = useSettings()

    const [items, setItems] = useState<ProjectOverviewItem[]>([])
    const [initialLoading, setInitialLoading] = useState(true)
    const [refreshing, setRefreshing] = useState(false)
    const [gitOverviewLoading, setGitOverviewLoading] = useState(false)
    const [gitLoadingPaths, setGitLoadingPaths] = useState<Set<string>>(new Set())
    const [error, setError] = useState<string | null>(null)
    const [lastRefreshAt, setLastRefreshAt] = useState<number | null>(null)
    const refreshRequestRef = useRef(0)

    const projectRoots = useMemo(() => {
        const allRoots = [settings.projectsFolder, ...(settings.additionalFolders || [])]
            .filter((root): root is string => typeof root === 'string' && root.trim().length > 0)
            .map((root) => root.trim())

        const deduped = new Map<string, string>()
        for (const root of allRoots) {
            const key = normalizePathKey(root)
            if (!deduped.has(key)) deduped.set(key, root)
        }

        return Array.from(deduped.values())
    }, [settings.projectsFolder, settings.additionalFolders])

    const refreshHome = useCallback(async (mode: 'initial' | 'background' = 'background') => {
        const refreshRequestId = ++refreshRequestRef.current
        const isStale = () => refreshRequestId !== refreshRequestRef.current

        if (mode === 'initial') setInitialLoading(true)
        if (mode !== 'initial') setRefreshing(true)

        try {
            if (projectRoots.length === 0) {
                if (isStale()) return
                setItems([])
                setGitOverviewLoading(false)
                setGitLoadingPaths(new Set())
                setError(null)
                setLastRefreshAt(Date.now())
                return
            }

            const scanResults = await Promise.all(
                projectRoots.map(async (root) => {
                    try {
                        return await window.devscope.scanProjects(root) as ScanResult
                    } catch (scanError: any) {
                        return {
                            success: false,
                            error: scanError?.message || 'Scan failed'
                        } as ScanResult
                    }
                })
            )

            const mergedProjects: DiscoveredProject[] = []
            const seenPaths = new Set<string>()

            for (const result of scanResults) {
                if (!result.success || !Array.isArray(result.projects)) continue
                for (const project of result.projects) {
                    const key = normalizePathKey(project.path)
                    if (seenPaths.has(key)) continue
                    seenPaths.add(key)
                    mergedProjects.push(project)
                }
            }

            mergedProjects.sort((a, b) => (b.lastModified || 0) - (a.lastModified || 0))

            const recentProjects = getRecentProjects()
            if (isStale()) return
            setItems(mergeProjectOverview(mergedProjects, undefined, recentProjects))
            if (mode === 'initial') setInitialLoading(false)

            const failedScans = scanResults.filter((result) => !result.success)
            const gitCandidates = mergedProjects.filter(
                (project) => project.type === 'git' || project.markers?.includes('.git')
            )
            const gitCandidatePathKeys = new Set(gitCandidates.map((project) => normalizePathKey(project.path)))
            setGitOverviewLoading(gitCandidates.length > 0)
            setGitLoadingPaths(gitCandidatePathKeys)

            let overviewResult: ProjectsGitOverviewResult = { success: true, items: [] }
            if (gitCandidates.length > 0) {
                overviewResult = await window.devscope.getProjectsGitOverview(
                    gitCandidates.map((project) => project.path)
                ) as ProjectsGitOverviewResult
            }

            if (isStale()) return
            const hydrated = mergeProjectOverview(mergedProjects, overviewResult.items, recentProjects)
            setItems(hydrated)
            setGitOverviewLoading(false)
            setGitLoadingPaths(new Set())

            if (failedScans.length === scanResults.length) {
                const firstError = failedScans[0]?.error || 'Failed to scan configured project roots'
                setError(firstError)
            } else if (!overviewResult.success) {
                setError(overviewResult.error || 'Git overview partially failed')
            } else {
                setError(null)
            }

            setLastRefreshAt(Date.now())
        } catch (refreshError: any) {
            if (isStale()) return
            setError(refreshError?.message || 'Failed to load Home overview')
            setGitOverviewLoading(false)
            setGitLoadingPaths(new Set())
        } finally {
            if (isStale()) return
            if (mode === 'initial') setInitialLoading(false)
            if (mode !== 'initial') setRefreshing(false)
        }
    }, [projectRoots])

    useEffect(() => {
        void refreshHome('initial')
    }, [refreshHome])

    useEffect(() => {
        const interval = window.setInterval(() => {
            void refreshHome('background')
        }, AUTO_REFRESH_MS)

        return () => window.clearInterval(interval)
    }, [refreshHome])

    const totals = useMemo(() => {
        const gitEnabled = items.filter((item) => item.isGitRepo).length
        const needsCommit = items.filter((item) => item.changedCount > 0).length
        const needsPush = items.filter((item) => item.unpushedCount > 0).length

        return {
            totalProjects: items.length,
            gitEnabled,
            needsCommit,
            needsPush
        }
    }, [items])

    const gitCandidates = useMemo(() => {
        return [...items]
            .filter((item) => item.type === 'git' || item.markers?.includes('.git'))
            .sort((a, b) => {
                const recentA = a.lastOpenedAt || 0
                const recentB = b.lastOpenedAt || 0
                if (recentA !== recentB) return recentB - recentA
                return (b.lastModified || 0) - (a.lastModified || 0)
            })
    }, [items])

    const needsCommitProjects = useMemo(() => {
        if (gitOverviewLoading) return gitCandidates

        return [...items]
            .filter((item) => item.changedCount > 0)
            .sort((a, b) => {
                const recentA = a.lastOpenedAt || 0
                const recentB = b.lastOpenedAt || 0
                if (recentA !== recentB) return recentB - recentA
                if (a.changedCount !== b.changedCount) return b.changedCount - a.changedCount
                return (b.lastModified || 0) - (a.lastModified || 0)
            })
    }, [items, gitCandidates, gitOverviewLoading])

    const needsPushProjects = useMemo(() => {
        if (gitOverviewLoading) return gitCandidates

        return [...items]
            .filter((item) => item.unpushedCount > 0)
            .sort((a, b) => {
                const recentA = a.lastOpenedAt || 0
                const recentB = b.lastOpenedAt || 0
                if (recentA !== recentB) return recentB - recentA
                if (a.unpushedCount !== b.unpushedCount) return b.unpushedCount - a.unpushedCount
                return (b.lastModified || 0) - (a.lastModified || 0)
            })
    }, [items, gitCandidates, gitOverviewLoading])

    const recentActivity = useMemo(() => {
        return [...items].sort((a, b) => {
            const trackedA = a.lastOpenedAt ? 1 : 0
            const trackedB = b.lastOpenedAt ? 1 : 0
            if (trackedA !== trackedB) return trackedB - trackedA

            const openedA = a.lastOpenedAt || 0
            const openedB = b.lastOpenedAt || 0
            if (openedA !== openedB) return openedB - openedA

            return (b.lastModified || 0) - (a.lastModified || 0)
        })
    }, [items])

    const openProject = (project: ProjectOverviewItem) => {
        navigate(getProjectRoute(project))
    }

    if (!settings.projectsFolder && (!settings.additionalFolders || settings.additionalFolders.length === 0)) {
        return (
            <div className="max-w-[1400px] mx-auto pb-10 animate-fadeIn">
                <div className="mb-6">
                    <h1 className="text-3xl font-bold text-sparkle-text mb-2">Home</h1>
                    <p className="text-sparkle-text-secondary">Configure project roots to enable cross-project Git overview.</p>
                </div>
                <div className="rounded-xl border border-sparkle-border bg-sparkle-card p-6 flex items-center justify-between gap-4">
                    <div>
                        <h2 className="text-lg font-semibold text-sparkle-text">No project roots configured</h2>
                        <p className="text-sm text-sparkle-text-secondary mt-1">Set `Projects Folder` and optional additional folders first.</p>
                    </div>
                    <Link
                        to="/settings/projects"
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--accent-primary)] text-white hover:bg-[var(--accent-primary)]/90 transition-colors"
                    >
                        <Wrench size={16} />
                        <span>Open Settings</span>
                    </Link>
                </div>
            </div>
        )
    }

    return (
        <div className="max-w-[1500px] mx-auto pb-14 animate-fadeIn">
            <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
                <div>
                    <h1 className="text-3xl font-bold text-sparkle-text mb-2">Home</h1>
                    <p className="text-sparkle-text-secondary">Project-first Git overview across all configured roots.</p>
                </div>
                <div className="flex items-center gap-3 text-xs text-sparkle-text-secondary">
                    <span>Last refresh: {lastRefreshAt ? new Date(lastRefreshAt).toLocaleTimeString() : 'pending'}</span>
                    <button
                        onClick={() => void refreshHome('background')}
                        disabled={refreshing}
                        className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-sparkle-border bg-sparkle-card hover:bg-sparkle-border-secondary transition-colors disabled:opacity-50"
                    >
                        <RefreshCw size={14} className={cn(refreshing && 'animate-spin')} />
                        <span>Refresh</span>
                    </button>
                </div>
            </div>

            {error && (
                <div className="mb-5 px-4 py-3 rounded-lg border border-amber-500/25 bg-amber-500/10 text-amber-300 text-sm">
                    {error}
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-5">
                <SummaryCard icon={<FolderTree size={18} />} label="Total Projects" value={totals.totalProjects} />
                <SummaryCard icon={<GitBranch size={18} />} label="Git Enabled" value={totals.gitEnabled} loading={gitOverviewLoading} />
                <SummaryCard icon={<GitCommitHorizontal size={18} />} label="Needs Commit" value={totals.needsCommit} loading={gitOverviewLoading} />
                <SummaryCard icon={<Upload size={18} />} label="Needs Push" value={totals.needsPush} loading={gitOverviewLoading} />
            </div>

            {initialLoading ? (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                    <ListSkeleton title="Needs Commit" />
                    <ListSkeleton title="Needs Push" />
                    <ListSkeleton title="Recent Activity" />
                </div>
            ) : (
                <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
                    <ProjectListSection
                        title="Needs Commit"
                        subtitle={gitOverviewLoading ? 'Git changes are loading...' : 'Working changes detected'}
                        projects={needsCommitProjects}
                        emptyMessage="No projects with working changes."
                        gitLoadingPaths={gitLoadingPaths}
                        onOpen={openProject}
                    />
                    <ProjectListSection
                        title="Needs Push"
                        subtitle={gitOverviewLoading ? 'Git push status is loading...' : 'Local commits waiting to push'}
                        projects={needsPushProjects}
                        emptyMessage="No projects with unpushed commits."
                        gitLoadingPaths={gitLoadingPaths}
                        onOpen={openProject}
                    />
                    <ProjectListSection
                        title="Recent Activity"
                        subtitle="Recently opened first, then modified"
                        projects={recentActivity}
                        emptyMessage="No discovered projects yet."
                        gitLoadingPaths={gitLoadingPaths}
                        onOpen={openProject}
                    />
                </div>
            )}
        </div>
    )
}

function SummaryCard({
    icon,
    label,
    value,
    loading = false
}: {
    icon: React.ReactNode
    label: string
    value: number
    loading?: boolean
}) {
    return (
        <div className="rounded-xl border border-sparkle-border bg-sparkle-card p-4">
            <div className="flex items-center justify-between mb-2 text-sparkle-text-secondary">
                <span className="text-sm">{label}</span>
                {icon}
            </div>
            <div className="text-2xl font-semibold text-sparkle-text">{loading ? '...' : value}</div>
        </div>
    )
}

function ListSkeleton({ title }: { title: string }) {
    return (
        <div className="rounded-xl border border-sparkle-border bg-sparkle-card p-4">
            <h2 className="text-sm font-semibold text-sparkle-text mb-3">{title}</h2>
            <div className="space-y-2">
                {Array.from({ length: 5 }).map((_, index) => (
                    <div key={index} className="h-14 rounded-lg bg-sparkle-border-secondary animate-pulse" />
                ))}
            </div>
        </div>
    )
}

function ProjectListSection({
    title,
    subtitle,
    projects,
    gitLoadingPaths,
    emptyMessage,
    onOpen
}: {
    title: string
    subtitle: string
    projects: ProjectOverviewItem[]
    gitLoadingPaths: Set<string>
    emptyMessage: string
    onOpen: (project: ProjectOverviewItem) => void
}) {
    const visibleProjects = projects.slice(0, 12)

    return (
        <section className="rounded-xl border border-sparkle-border bg-sparkle-card p-4">
            <div className="mb-3">
                <h2 className="text-sm font-semibold text-sparkle-text">{title}</h2>
                <p className="text-xs text-sparkle-text-secondary">{subtitle}</p>
            </div>

            {visibleProjects.length === 0 ? (
                <div className="h-32 rounded-lg border border-dashed border-sparkle-border-secondary flex items-center justify-center text-sm text-sparkle-text-secondary">
                    {emptyMessage}
                </div>
            ) : (
                <div className="space-y-2">
                    {visibleProjects.map((project) => (
                        <ProjectRow
                            key={project.path}
                            project={project}
                            isGitLoading={gitLoadingPaths.has(normalizePathKey(project.path))}
                            onOpen={onOpen}
                        />
                    ))}
                </div>
            )}
        </section>
    )
}

function ProjectRow({
    project,
    isGitLoading,
    onOpen
}: {
    project: ProjectOverviewItem
    isGitLoading: boolean
    onOpen: (project: ProjectOverviewItem) => void
}) {
    const lastSeenLabel = project.lastOpenedAt
        ? `opened ${formatRelativeTime(project.lastOpenedAt)}`
        : `modified ${formatRelativeTime(project.lastModified)}`

    return (
        <div
            onClick={() => onOpen(project)}
            className="rounded-lg border border-sparkle-border-secondary bg-sparkle-card/70 px-3 py-2.5 hover:bg-sparkle-border-secondary/60 cursor-pointer transition-colors"
        >
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <div className="flex items-center gap-2 min-w-0 mb-0.5">
                        <span className="text-sm font-medium text-sparkle-text truncate">{project.name}</span>
                        <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-white/10 text-sparkle-text-secondary">
                            {project.type}
                        </span>
                        <span
                            className={cn(
                                'text-[10px] px-1.5 py-0.5 rounded uppercase tracking-wide',
                                isGitLoading
                                    ? 'bg-amber-500/20 text-amber-300'
                                    : project.hasRemote
                                        ? 'bg-emerald-500/20 text-emerald-300'
                                        : 'bg-white/10 text-sparkle-text-secondary'
                            )}
                        >
                            {isGitLoading ? 'git...' : project.hasRemote ? 'remote' : 'local only'}
                        </span>
                    </div>
                    <div className="text-[11px] text-sparkle-text-muted truncate">{project.path}</div>
                    <div className="text-[11px] text-sparkle-text-secondary mt-1">
                        {lastSeenLabel}
                        {project.openCount ? ` | ${project.openCount} opens` : ''}
                    </div>
                </div>

                <div className="flex flex-col items-end gap-2 shrink-0">
                    <div className="flex items-center gap-1.5 text-[11px] text-sparkle-text-secondary">
                        <span className="inline-flex items-center gap-1 rounded bg-white/10 px-1.5 py-0.5" title="Changed files">
                            <GitCommitHorizontal size={11} />
                            {isGitLoading ? '...' : project.changedCount}
                        </span>
                        <span className="inline-flex items-center gap-1 rounded bg-white/10 px-1.5 py-0.5" title="Unpushed commits">
                            <Upload size={11} />
                            {isGitLoading ? '...' : project.unpushedCount}
                        </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <button
                            onClick={(event) => {
                                event.stopPropagation()
                                onOpen(project)
                            }}
                            className="text-[11px] px-2 py-1 rounded border border-sparkle-border-secondary hover:bg-sparkle-border-secondary transition-colors inline-flex items-center gap-1"
                        >
                            <ExternalLink size={11} />
                            Open
                        </button>
                        <button
                            onClick={(event) => event.stopPropagation()}
                            className="text-[11px] px-2 py-1 rounded border border-sparkle-border-secondary opacity-60 cursor-default"
                            title="Push actions are planned for Home"
                        >
                            Push soon
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}

