import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { getRecentProjects } from '@/lib/recentProjects'
import { primeProjectDetailsCache } from '@/lib/projectViewCache'
import type { DiscoveredProject, ProjectGitOverviewItem, ProjectOverviewItem } from './types'
import { mergeProjectOverview, normalizePathKey, type ProjectsGitOverviewResult, type ScanResult } from './homeUtils'

const AUTO_REFRESH_MS = 60_000
const FOREGROUND_REFRESH_COOLDOWN_MS = 8_000
const GIT_PRIORITY_BATCH_SIZE = 14
const HOME_OVERVIEW_CACHE_TTL_MS = 10 * 60_000
const HOME_OVERVIEW_CACHE_MAX_ENTRIES = 3
const BACKGROUND_RECENT_GIT_LIMIT = 18
const FULL_GIT_REFRESH_INTERVAL_MS = 5 * 60_000

type HomeOverviewSettings = {
    projectsFolder?: string
    additionalFolders?: string[]
}

type RefreshMode = 'initial' | 'background' | 'foreground' | 'manual'

type HomeOverviewCacheEntry = {
    cachedAt: number
    items: ProjectOverviewItem[]
    gitOverviewItems: ProjectGitOverviewItem[]
    lastRefreshAt: number
    lastFullGitRefreshAt: number
}

const sharedHomeOverviewCache = new Map<string, HomeOverviewCacheEntry>()

function getFreshHomeOverviewCache(projectRootsKey: string): HomeOverviewCacheEntry | null {
    if (!projectRootsKey) return null
    const cached = sharedHomeOverviewCache.get(projectRootsKey)
    if (!cached) return null
    if (Date.now() - cached.cachedAt > HOME_OVERVIEW_CACHE_TTL_MS) {
        sharedHomeOverviewCache.delete(projectRootsKey)
        return null
    }
    return cached
}

function setHomeOverviewCache(projectRootsKey: string, entry: Omit<HomeOverviewCacheEntry, 'cachedAt'>): void {
    if (!projectRootsKey) return

    sharedHomeOverviewCache.set(projectRootsKey, {
        ...entry,
        cachedAt: Date.now()
    })

    if (sharedHomeOverviewCache.size <= HOME_OVERVIEW_CACHE_MAX_ENTRIES) return

    const staleCandidates = Array.from(sharedHomeOverviewCache.entries())
        .sort((a, b) => a[1].cachedAt - b[1].cachedAt)
        .slice(0, sharedHomeOverviewCache.size - HOME_OVERVIEW_CACHE_MAX_ENTRIES)

    for (const [key] of staleCandidates) {
        sharedHomeOverviewCache.delete(key)
    }
}

function clearHomeOverviewCache(projectRootsKey: string): void {
    if (!projectRootsKey) return
    sharedHomeOverviewCache.delete(projectRootsKey)
}

function getProjectRootsKey(projectRoots: string[]): string {
    return projectRoots.map(normalizePathKey).join('||')
}

function toGitOverviewMap(
    overviewItems: ProjectGitOverviewItem[] | undefined
): Map<string, ProjectGitOverviewItem> {
    const map = new Map<string, ProjectGitOverviewItem>()
    for (const item of overviewItems || []) {
        map.set(normalizePathKey(item.path), item)
    }
    return map
}

export function useHomeOverview(settings: HomeOverviewSettings) {
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

    const projectRootsKey = useMemo(() => getProjectRootsKey(projectRoots), [projectRoots])
    const initialCache = useMemo(() => getFreshHomeOverviewCache(projectRootsKey), [projectRootsKey])

    const [items, setItems] = useState<ProjectOverviewItem[]>(() => initialCache?.items || [])
    const [initialLoading, setInitialLoading] = useState(projectRoots.length > 0 && !initialCache)
    const [refreshing, setRefreshing] = useState(false)
    const [gitOverviewLoading, setGitOverviewLoading] = useState(false)
    const [gitLoadingPaths, setGitLoadingPaths] = useState<Set<string>>(new Set())
    const [error, setError] = useState<string | null>(null)
    const [lastRefreshAt, setLastRefreshAt] = useState<number | null>(initialCache?.lastRefreshAt || null)

    const refreshRequestRef = useRef(0)
    const lastForegroundRefreshAtRef = useRef(0)
    const prewarmedFolderPathsRef = useRef<Set<string>>(new Set())
    const gitOverviewMapRef = useRef<Map<string, ProjectGitOverviewItem>>(toGitOverviewMap(initialCache?.gitOverviewItems))
    const lastFullGitRefreshAtRef = useRef(initialCache?.lastFullGitRefreshAt || 0)

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

    useEffect(() => {
        prewarmedFolderPathsRef.current.clear()
    }, [projectRoots])

    useEffect(() => {
        refreshRequestRef.current += 1
        const cached = getFreshHomeOverviewCache(projectRootsKey)
        if (!cached) {
            gitOverviewMapRef.current = new Map()
            lastFullGitRefreshAtRef.current = 0
            setItems([])
            setInitialLoading(projectRoots.length > 0)
            setLastRefreshAt(null)
        } else {
            gitOverviewMapRef.current = toGitOverviewMap(cached.gitOverviewItems)
            lastFullGitRefreshAtRef.current = cached.lastFullGitRefreshAt
            setItems(cached.items)
            setInitialLoading(false)
            setLastRefreshAt(cached.lastRefreshAt)
        }
        setRefreshing(false)
        setGitOverviewLoading(false)
        setGitLoadingPaths(new Set())
        setError(null)
    }, [projectRootsKey, projectRoots.length])

    const refreshHome = useCallback(async (mode: RefreshMode = 'background') => {
        const refreshRequestId = ++refreshRequestRef.current
        const isStale = () => refreshRequestId !== refreshRequestRef.current

        if (mode === 'initial') setInitialLoading(true)
        if (mode !== 'initial') setRefreshing(true)

        try {
            if (projectRoots.length === 0) {
                if (isStale()) return
                clearHomeOverviewCache(projectRootsKey)
                gitOverviewMapRef.current = new Map()
                lastFullGitRefreshAtRef.current = 0
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

            const failedScans = scanResults.filter((result) => !result.success)
            const gitCandidates = mergedProjects.filter(
                (project) => project.type === 'git' || project.markers?.includes('.git')
            )
            const gitCandidatePathKeys = new Set(gitCandidates.map((project) => normalizePathKey(project.path)))

            let overviewMap = new Map(gitOverviewMapRef.current)
            for (const key of Array.from(overviewMap.keys())) {
                if (!gitCandidatePathKeys.has(key)) {
                    overviewMap.delete(key)
                }
            }

            let mergedItems = mergeProjectOverview(mergedProjects, Array.from(overviewMap.values()), recentProjects)
            if (isStale()) return
            setItems(mergedItems)
            if (mode === 'initial') setInitialLoading(false)

            const prioritizedGitPaths = prioritizeGitCandidates(gitCandidates, recentProjects)
            const runFullGitRefresh = shouldRunFullGitRefresh(mode, lastFullGitRefreshAtRef.current)
            const gitPathsToRefresh = selectGitPathsForRefresh(prioritizedGitPaths, recentProjects, runFullGitRefresh)
            const showGlobalGitLoading = runFullGitRefresh
            const loadingPathKeys = new Set(gitPathsToRefresh.map((path) => normalizePathKey(path)))
            setGitOverviewLoading(showGlobalGitLoading && gitPathsToRefresh.length > 0)
            setGitLoadingPaths(loadingPathKeys)

            const priorityPaths = gitPathsToRefresh.slice(0, GIT_PRIORITY_BATCH_SIZE)
            const remainingPaths = gitPathsToRefresh.slice(GIT_PRIORITY_BATCH_SIZE)
            let overviewFailed = false

            const loadedPathKeys = new Set<string>()
            const applyOverviewProgress = () => {
                mergedItems = mergeProjectOverview(mergedProjects, Array.from(overviewMap.values()), recentProjects)
                setItems(mergedItems)
                const pending = new Set(
                    Array.from(loadingPathKeys).filter((pathKey) => !loadedPathKeys.has(pathKey))
                )
                setGitLoadingPaths(pending)
                setGitOverviewLoading(showGlobalGitLoading && pending.size > 0)
            }

            const loadOverviewBatch = async (paths: string[]) => {
                if (paths.length === 0) return
                const batch = await window.devscope.getProjectsGitOverview(paths) as ProjectsGitOverviewResult
                if (!batch.success) {
                    overviewFailed = true
                    return
                }
                const nextItems = Array.isArray(batch.items) ? batch.items : []
                for (const item of nextItems) {
                    const pathKey = normalizePathKey(item.path)
                    overviewMap.set(pathKey, item)
                    loadedPathKeys.add(pathKey)
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

            if (runFullGitRefresh && !overviewFailed) {
                lastFullGitRefreshAtRef.current = Date.now()
            }
            gitOverviewMapRef.current = overviewMap

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

            const refreshedAt = Date.now()
            setLastRefreshAt(refreshedAt)
            setHomeOverviewCache(projectRootsKey, {
                items: mergedItems,
                gitOverviewItems: Array.from(overviewMap.values()),
                lastRefreshAt: refreshedAt,
                lastFullGitRefreshAt: lastFullGitRefreshAtRef.current
            })
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
    }, [projectRoots, projectRootsKey, prewarmFolderScans])

    useEffect(() => {
        const cached = getFreshHomeOverviewCache(projectRootsKey)
        void refreshHome(cached ? 'background' : 'initial')
    }, [projectRootsKey, refreshHome])

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
            void refreshHome('foreground')
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

function shouldRunFullGitRefresh(mode: RefreshMode, lastFullGitRefreshAt: number): boolean {
    if (mode === 'manual' || mode === 'initial') return true
    if (mode === 'foreground') return false
    return Date.now() - lastFullGitRefreshAt > FULL_GIT_REFRESH_INTERVAL_MS
}

function selectGitPathsForRefresh(
    prioritizedGitPaths: string[],
    recentProjects: Record<string, { lastOpenedAt: number }>,
    runFullGitRefresh: boolean
): string[] {
    if (runFullGitRefresh) return prioritizedGitPaths

    const recentPaths = prioritizedGitPaths.filter((path) => {
        const key = normalizePathKey(path)
        return Boolean(recentProjects[key])
    })

    if (recentPaths.length > 0) {
        return recentPaths.slice(0, BACKGROUND_RECENT_GIT_LIMIT)
    }

    return prioritizedGitPaths.slice(0, BACKGROUND_RECENT_GIT_LIMIT)
}
