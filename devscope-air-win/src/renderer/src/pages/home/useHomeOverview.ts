import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { getRecentProjects } from '@/lib/recentProjects'
import type { DiscoveredProject, ProjectOverviewItem } from './types'
import { mergeProjectOverview, normalizePathKey, type ProjectsGitOverviewResult, type ScanResult } from './homeUtils'

const AUTO_REFRESH_MS = 60_000

type HomeOverviewSettings = {
    projectsFolder?: string
    additionalFolders?: string[]
}

type RefreshMode = 'initial' | 'background'

export function useHomeOverview(settings: HomeOverviewSettings) {
    const [items, setItems] = useState<ProjectOverviewItem[]>([])
    const [initialLoading, setInitialLoading] = useState(true)
    const [refreshing, setRefreshing] = useState(false)
    const [gitOverviewLoading, setGitOverviewLoading] = useState(false)
    const [gitLoadingPaths, setGitLoadingPaths] = useState<Set<string>>(new Set())
    const [error, setError] = useState<string | null>(null)
    const [lastRefreshAt, setLastRefreshAt] = useState<number | null>(null)
    const refreshRequestRef = useRef(0)
    const prewarmedFolderPathsRef = useRef<Set<string>>(new Set())

    const prewarmFolderScans = useCallback(async (folderPaths: string[]) => {
        if (folderPaths.length === 0) return

        const queue = [...folderPaths]
        const concurrency = Math.min(3, queue.length)

        const worker = async () => {
            while (queue.length > 0) {
                const path = queue.shift()
                if (!path) continue
                try {
                    await window.devscope.scanProjects(path)
                } catch {
                    // Best-effort prewarm.
                }
            }
        }

        await Promise.all(Array.from({ length: concurrency }, () => worker()))
    }, [])

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

    useEffect(() => {
        prewarmedFolderPathsRef.current.clear()
    }, [projectRoots])

    const refreshHome = useCallback(async (mode: RefreshMode = 'background') => {
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

            const mergedProjects = mergeProjects(scanResults)
            const recentProjects = getRecentProjects()

            if (isStale()) return
            setItems(mergeProjectOverview(mergedProjects, undefined, recentProjects))
            if (mode === 'initial') setInitialLoading(false)

            const failedScans = scanResults.filter((result) => !result.success)
            const gitCandidates = mergedProjects.filter(
                (project) => project.type === 'git' || project.markers?.includes('.git')
            )

            prewarmCandidates(scanResults, gitCandidates.map((project) => project.path), prewarmedFolderPathsRef.current, prewarmFolderScans)

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
            setItems(mergeProjectOverview(mergedProjects, overviewResult.items, recentProjects))
            setGitOverviewLoading(false)
            setGitLoadingPaths(new Set())

            if (failedScans.length === scanResults.length) {
                setError(failedScans[0]?.error || 'Failed to scan configured project roots')
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
    }, [projectRoots, prewarmFolderScans])

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

        return { totalProjects: items.length, gitEnabled, needsCommit, needsPush }
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

    return {
        projectRoots,
        initialLoading,
        refreshing,
        gitOverviewLoading,
        gitLoadingPaths,
        error,
        lastRefreshAt,
        totals,
        needsCommitProjects,
        needsPushProjects,
        recentActivity,
        refreshHome
    }
}

function mergeProjects(scanResults: ScanResult[]): DiscoveredProject[] {
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
    return mergedProjects
}

function prewarmCandidates(
    scanResults: ScanResult[],
    gitCandidatePaths: string[],
    prewarmed: Set<string>,
    prewarmFolderScans: (paths: string[]) => Promise<void>
): void {
    const candidateFolderPaths = [
        ...scanResults.flatMap((result) => (result.success ? (result.folders || []).map((folder) => folder.path) : [])),
        ...gitCandidatePaths
    ]
    const prewarmQueue: string[] = []
    for (const path of candidateFolderPaths) {
        const key = normalizePathKey(path)
        if (prewarmed.has(key)) continue
        prewarmed.add(key)
        prewarmQueue.push(path)
        if (prewarmQueue.length >= 40) break
    }
    if (prewarmQueue.length > 0) {
        void prewarmFolderScans(prewarmQueue)
    }
}
