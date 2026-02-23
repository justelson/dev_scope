import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { getRecentProjects } from '@/lib/recentProjects'
import { primeProjectDetailsCache } from '@/lib/projectViewCache'
import type { DiscoveredProject, ProjectOverviewItem } from './types'
import { mergeProjectOverview, normalizePathKey, type ProjectsGitOverviewResult, type ScanResult } from './homeUtils'

const AUTO_REFRESH_MS = 60_000
const FOREGROUND_REFRESH_COOLDOWN_MS = 8_000
const GIT_PRIORITY_BATCH_SIZE = 14

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
    const lastForegroundRefreshAtRef = useRef(0)
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
            for (const project of mergedProjects) {
                primeProjectDetailsCache(project)
            }
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
            const prioritizedGitPaths = prioritizeGitCandidates(gitCandidates, recentProjects)
            const priorityPaths = prioritizedGitPaths.slice(0, GIT_PRIORITY_BATCH_SIZE)
            const remainingPaths = prioritizedGitPaths.slice(GIT_PRIORITY_BATCH_SIZE)
            let overviewItems: NonNullable<ProjectsGitOverviewResult['items']> = []
            let overviewFailed = false

            const loadedPathKeys = new Set<string>()
            const applyOverviewProgress = () => {
                setItems(mergeProjectOverview(mergedProjects, overviewItems, recentProjects))
                const pending = new Set(
                    Array.from(gitCandidatePathKeys).filter((pathKey) => !loadedPathKeys.has(pathKey))
                )
                setGitLoadingPaths(pending)
                setGitOverviewLoading(pending.size > 0)
            }

            const loadOverviewBatch = async (paths: string[]) => {
                if (paths.length === 0) return
                const batch = await window.devscope.getProjectsGitOverview(paths) as ProjectsGitOverviewResult
                if (!batch.success) {
                    overviewFailed = true
                    return
                }
                const nextItems = Array.isArray(batch.items) ? batch.items : []
                overviewItems = [...overviewItems, ...nextItems]
                for (const item of nextItems) {
                    loadedPathKeys.add(normalizePathKey(item.path))
                }
            }

            if (priorityPaths.length > 0) {
                await loadOverviewBatch(priorityPaths)
                if (isStale()) return
                applyOverviewProgress()
            }

            if (remainingPaths.length > 0) {
                await loadOverviewBatch(remainingPaths)
                if (isStale()) return
                applyOverviewProgress()
            } else if (priorityPaths.length === 0) {
                setGitOverviewLoading(false)
                setGitLoadingPaths(new Set())
            }

            setGitOverviewLoading(false)
            setGitLoadingPaths(new Set())

            prewarmCandidates(
                scanResults,
                gitCandidates.map((project) => project.path),
                prewarmedFolderPathsRef.current,
                prewarmFolderScans
            )

            if (failedScans.length === scanResults.length) {
                setError(failedScans[0]?.error || 'Failed to scan configured project roots')
            } else if (overviewFailed) {
                setError('Git overview partially failed')
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

    useEffect(() => {
        const runForegroundRefresh = () => {
            const now = Date.now()
            if (now - lastForegroundRefreshAtRef.current < FOREGROUND_REFRESH_COOLDOWN_MS) return
            lastForegroundRefreshAtRef.current = now
            void refreshHome('background')
        }

        const handleVisibilityChange = () => {
            if (document.visibilityState !== 'visible') return
            runForegroundRefresh()
        }

        window.addEventListener('focus', runForegroundRefresh)
        document.addEventListener('visibilitychange', handleVisibilityChange)
        return () => {
            window.removeEventListener('focus', runForegroundRefresh)
            document.removeEventListener('visibilitychange', handleVisibilityChange)
        }
    }, [refreshHome])

    const derived = useMemo(() => {
        const gitCandidates: ProjectOverviewItem[] = []
        const needsCommitFiltered: ProjectOverviewItem[] = []
        const needsPushFiltered: ProjectOverviewItem[] = []
        let gitEnabled = 0
        let needsCommit = 0
        let needsPush = 0

        for (const item of items) {
            if (item.isGitRepo) gitEnabled += 1
            if (item.changedCount > 0) {
                needsCommit += 1
                needsCommitFiltered.push(item)
            }
            if (item.unpushedCount > 0) {
                needsPush += 1
                needsPushFiltered.push(item)
            }
            if (item.type === 'git' || item.markers?.includes('.git')) {
                gitCandidates.push(item)
            }
        }

        gitCandidates.sort((a, b) => {
            const recentA = a.lastOpenedAt || 0
            const recentB = b.lastOpenedAt || 0
            if (recentA !== recentB) return recentB - recentA
            return (b.lastModified || 0) - (a.lastModified || 0)
        })

        needsCommitFiltered.sort((a, b) => {
            const recentA = a.lastOpenedAt || 0
            const recentB = b.lastOpenedAt || 0
            if (recentA !== recentB) return recentB - recentA
            if (a.changedCount !== b.changedCount) return b.changedCount - a.changedCount
            return (b.lastModified || 0) - (a.lastModified || 0)
        })

        needsPushFiltered.sort((a, b) => {
            const recentA = a.lastOpenedAt || 0
            const recentB = b.lastOpenedAt || 0
            if (recentA !== recentB) return recentB - recentA
            if (a.unpushedCount !== b.unpushedCount) return b.unpushedCount - a.unpushedCount
            return (b.lastModified || 0) - (a.lastModified || 0)
        })

        const recentActivity = [...items].sort((a, b) => {
            const trackedA = a.lastOpenedAt ? 1 : 0
            const trackedB = b.lastOpenedAt ? 1 : 0
            if (trackedA !== trackedB) return trackedB - trackedA

            const openedA = a.lastOpenedAt || 0
            const openedB = b.lastOpenedAt || 0
            if (openedA !== openedB) return openedB - openedA
            return (b.lastModified || 0) - (a.lastModified || 0)
        })

        const totals = {
            totalProjects: items.length,
            gitEnabled,
            needsCommit,
            needsPush
        }

        return {
            totals,
            needsCommitProjects: gitOverviewLoading ? gitCandidates : needsCommitFiltered,
            needsPushProjects: gitOverviewLoading ? gitCandidates : needsPushFiltered,
            recentActivity
        }
    }, [items, gitOverviewLoading])

    return {
        projectRoots,
        initialLoading,
        refreshing,
        gitOverviewLoading,
        gitLoadingPaths,
        error,
        lastRefreshAt,
        totals: derived.totals,
        needsCommitProjects: derived.needsCommitProjects,
        needsPushProjects: derived.needsPushProjects,
        recentActivity: derived.recentActivity,
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
        window.setTimeout(() => {
            void prewarmFolderScans(prewarmQueue)
        }, 1200)
    }
}

function prioritizeGitCandidates(
    gitCandidates: DiscoveredProject[],
    recentProjects: Record<string, { lastOpenedAt: number }>
): string[] {
    return [...gitCandidates]
        .sort((a, b) => {
            const recentA = recentProjects[normalizePathKey(a.path)]?.lastOpenedAt || 0
            const recentB = recentProjects[normalizePathKey(b.path)]?.lastOpenedAt || 0
            if (recentA !== recentB) return recentB - recentA
            return (b.lastModified || 0) - (a.lastModified || 0)
        })
        .map((project) => project.path)
}
