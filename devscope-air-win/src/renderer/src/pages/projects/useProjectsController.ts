import { startTransition, useCallback, useEffect, useRef, useState } from 'react'
import type { Dispatch, MutableRefObject, SetStateAction } from 'react'
import type { NavigateFunction } from 'react-router-dom'
import type { Settings } from '@/lib/settings'
import type { FileItem, FolderItem, IndexedProject, IndexedTotals, IndexedInventory, IndexAllFoldersResult, Project } from './projectsTypes'
import { useProjectSearch } from './useProjectSearch'
import { useProjectStatsModal } from './useProjectStatsModal'

export function useProjectsController(
    settings: Settings,
    updateSettings: (partial: Partial<Settings>) => void,
    navigate: NavigateFunction
) {
    const [projects, setProjects] = useState<Project[]>([])
    const [folders, setFolders] = useState<FolderItem[]>([])
    const [files, setFiles] = useState<FileItem[]>([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [hasLoadedOnce, setHasLoadedOnce] = useState(false)
    const [showBlockingLoader, setShowBlockingLoader] = useState(false)
    const [indexedTotals, setIndexedTotals] = useState<IndexedTotals | null>(null)
    const [indexedInventory, setIndexedInventory] = useState<IndexedInventory | null>(null)
    const [indexingTotals, setIndexingTotals] = useState(false)

    const inFlightScanKeyRef = useRef<string | null>(null)
    const indexTotalsRunRef = useRef(0)

    const search = useProjectSearch(settings, updateSettings, projects, folders, files)
    const stats = useProjectStatsModal(projects, indexedTotals, indexedInventory, search.searchRootsKey)

    const loadProjects = useCallback(async () => {
        const foldersToScan = search.searchRoots
        if (foldersToScan.length === 0) {
            setProjects([])
            setFolders([])
            setFiles([])
            setIndexedTotals(null)
            setIndexedInventory(null)
            setIndexingTotals(false)
            setHasLoadedOnce(true)
            return
        }

        const scanKey = foldersToScan.join('||')
        if (inFlightScanKeyRef.current === scanKey) return
        inFlightScanKeyRef.current = scanKey

        setLoading(true)
        setError(null)
        await yieldToUi()

        const indexRunId = ++indexTotalsRunRef.current
        setIndexingTotals(true)
        void refreshIndexedTotals(foldersToScan, scanKey, indexRunId, indexTotalsRunRef, setIndexedTotals, setIndexedInventory, setIndexingTotals)

        try {
            const results = await Promise.all(foldersToScan.map((folder) => window.devscope.scanProjects(folder)))
            const aggregated = await aggregateScanResults(results)

            startTransition(() => {
                setProjects(aggregated.projects)
                setFolders(aggregated.folders)
                setFiles(aggregated.files)

                const allFailed = results.every((result) => !result.success)
                if (allFailed && results.length > 0) {
                    setError(results[0].error || 'Failed to scan projects')
                }
            })
        } catch (scanError: any) {
            setError(scanError.message || 'Failed to scan projects')
        } finally {
            setLoading(false)
            setHasLoadedOnce(true)
            inFlightScanKeyRef.current = null
        }
    }, [search.searchRoots])

    useEffect(() => {
        if (!loading) {
            setShowBlockingLoader(false)
            return
        }
        const timer = window.setTimeout(() => setShowBlockingLoader(true), 180)
        return () => window.clearTimeout(timer)
    }, [loading])

    useEffect(() => {
        const timer = window.setTimeout(() => {
            void loadProjects()
        }, 80)
        return () => window.clearTimeout(timer)
    }, [loadProjects])

    const handleProjectClick = useCallback((project: Project) => {
        const encodedPath = encodeURIComponent(project.path)
        if (project.type === 'git') {
            navigate(`/folder-browse/${encodedPath}`)
        } else {
            navigate(`/projects/${encodedPath}`)
        }
    }, [navigate])

    const handleFolderBrowse = useCallback((path: string) => {
        navigate(`/folder-browse/${encodeURIComponent(path)}`)
    }, [navigate])

    return {
        loading,
        error,
        hasLoadedOnce,
        showBlockingLoader,
        indexingTotals,
        loadProjects,
        handleProjectClick,
        handleFolderBrowse,
        totalProjects: stats.totalProjects,
        frameworkCount: stats.frameworkCount,
        typeCount: stats.typeCount,
        statChips: stats.statChips,
        statsModal: stats.statsModal,
        setStatsModal: stats.setStatsModal,
        projectsModalQuery: stats.projectsModalQuery,
        setProjectsModalQuery: stats.setProjectsModalQuery,
        filteredModalProjects: stats.filteredModalProjects,
        modalFrameworks: stats.modalFrameworks,
        modalTypes: stats.modalTypes,
        modalTitle: stats.modalTitle,
        modalCount: stats.modalCount,
        searchRootsKey: search.searchRootsKey,
        searchQuery: search.searchQuery,
        setSearchQuery: search.setSearchQuery,
        filterType: search.filterType,
        setFilterType: search.setFilterType,
        viewMode: search.viewMode,
        setViewMode: search.setViewMode,
        contentLayout: search.contentLayout,
        setContentLayout: search.setContentLayout,
        showHiddenFiles: search.showHiddenFiles,
        setShowHiddenFiles: search.setShowHiddenFiles,
        isSearching: search.isSearching,
        searchResults: search.searchResults,
        clearSearch: search.clearSearch,
        projectTypes: search.projectTypes,
        filteredProjects: search.filteredProjects,
        gitRepos: search.gitRepos,
        plainFolders: search.plainFolders,
        filteredFiles: search.filteredFiles
    }
}

async function refreshIndexedTotals(
    foldersToScan: string[],
    scanKey: string,
    indexRunId: number,
    indexTotalsRunRef: MutableRefObject<number>,
    setIndexedTotals: Dispatch<SetStateAction<IndexedTotals | null>>,
    setIndexedInventory: Dispatch<SetStateAction<IndexedInventory | null>>,
    setIndexingTotals: Dispatch<SetStateAction<boolean>>
): Promise<void> {
    try {
        const indexResult = await window.devscope.indexAllFolders(foldersToScan) as IndexAllFoldersResult
        if (indexRunId !== indexTotalsRunRef.current) return
        if (!indexResult?.success || !Array.isArray(indexResult.projects)) return

        const dedupedProjects = dedupeIndexedProjects(indexResult.projects)
        const { frameworkCount, typeCount } = computeProjectMetadata(dedupedProjects.values())

        setIndexedTotals({
            scanKey,
            projects: dedupedProjects.size,
            frameworks: frameworkCount,
            types: typeCount,
            folders: typeof indexResult.indexedFolders === 'number'
                ? indexResult.indexedFolders
                : foldersToScan.length
        })

        setIndexedInventory({
            scanKey,
            projects: Array.from(dedupedProjects.values()),
            folderPaths: Array.isArray(indexResult.scannedFolderPaths) ? indexResult.scannedFolderPaths : []
        })
    } catch (error) {
        console.warn('Failed to compute indexed totals:', error)
    } finally {
        if (indexRunId === indexTotalsRunRef.current) {
            setIndexingTotals(false)
        }
    }
}

function dedupeIndexedProjects(projects: IndexedProject[]): Map<string, IndexedProject> {
    const deduped = new Map<string, IndexedProject>()
    for (const project of projects) {
        const key = project.path.toLowerCase()
        if (!deduped.has(key)) deduped.set(key, project)
    }
    return deduped
}

function computeProjectMetadata(projects: Iterable<IndexedProject>): { frameworkCount: number; typeCount: number } {
    const frameworks = new Set<string>()
    const types = new Set<string>()

    for (const project of projects) {
        for (const framework of project.frameworks || []) {
            if (framework) frameworks.add(framework)
        }
        if (project.type && project.type !== 'unknown' && project.type !== 'git') {
            types.add(project.type)
        }
    }

    return { frameworkCount: frameworks.size, typeCount: types.size }
}

async function aggregateScanResults(results: Array<{ success: boolean; projects?: Project[]; folders?: FolderItem[]; files?: FileItem[] }>) {
    const projects: Project[] = []
    const folders: FolderItem[] = []
    const files: FileItem[] = []
    const seenPaths = new Set<string>()
    let processed = 0

    for (const result of results) {
        if (!result.success) continue

        for (const project of result.projects || []) {
            if (!seenPaths.has(project.path)) {
                seenPaths.add(project.path)
                projects.push(project)
            }
            processed += 1
            if (processed % 600 === 0) await yieldToUi()
        }

        for (const folder of result.folders || []) {
            if (!seenPaths.has(folder.path)) {
                seenPaths.add(folder.path)
                folders.push(folder)
            }
            processed += 1
            if (processed % 600 === 0) await yieldToUi()
        }

        for (const file of result.files || []) {
            if (!seenPaths.has(file.path)) {
                seenPaths.add(file.path)
                files.push(file)
            }
            processed += 1
            if (processed % 600 === 0) await yieldToUi()
        }
    }

    return { projects, folders, files }
}

async function yieldToUi() {
    await new Promise<void>((resolve) => {
        if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
            window.requestAnimationFrame(() => resolve())
        } else {
            setTimeout(resolve, 0)
        }
    })
}
