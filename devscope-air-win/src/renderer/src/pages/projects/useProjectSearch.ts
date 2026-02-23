import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import type { Settings } from '@/lib/settings'
import { parseFileSearchQuery } from '@/lib/utils'
import { buildFileSearchIndex, searchFileIndex, type FileSearchIndex } from '@/lib/fileSearchIndex'
import type { ContentLayout, FileItem, FolderItem, Project, SearchResults, ViewMode } from './projectsTypes'

const INDEX_RETRY_COOLDOWN_MS = 15000
const SHARED_SEARCH_INDEX_CACHE = new Map<string, FileSearchIndex>()
const SHARED_SEARCH_INDEX_LOADING = new Map<string, Promise<void>>()
const SHARED_SEARCH_INDEX_RETRY_AT = new Map<string, number>()

export function useProjectSearch(
    settings: Settings,
    updateSettings: (partial: Partial<Settings>) => void,
    projects: Project[],
    folders: FolderItem[],
    files: FileItem[]
) {
    const [searchQuery, setSearchQuery] = useState('')
    const [filterType, setFilterType] = useState<string>('all')
    const [showHiddenFiles, setShowHiddenFiles] = useState(false)
    const [isSearching, setIsSearching] = useState(false)
    const [searchResults, setSearchResults] = useState<SearchResults | null>(null)
    const [searchIndexVersion, setSearchIndexVersion] = useState(0)

    const viewMode = settings.browserViewMode as ViewMode
    const contentLayout = settings.browserContentLayout as ContentLayout
    const setViewMode = useCallback((value: ViewMode) => {
        updateSettings({ browserViewMode: value })
    }, [updateSettings])
    const setContentLayout = useCallback((value: ContentLayout) => {
        updateSettings({ browserContentLayout: value })
    }, [updateSettings])

    const deferredSearchQuery = useDeferredValue(searchQuery)
    const searchIndexCacheRef = useRef<Map<string, FileSearchIndex>>(SHARED_SEARCH_INDEX_CACHE)
    const searchIndexLoadingRef = useRef<Map<string, Promise<void>>>(SHARED_SEARCH_INDEX_LOADING)
    const searchIndexRetryAtRef = useRef<Map<string, number>>(SHARED_SEARCH_INDEX_RETRY_AT)

    const searchRoots = useMemo(() => {
        return Array.from(new Set([
            settings.projectsFolder,
            ...(settings.additionalFolders || [])
        ].filter(Boolean)))
    }, [settings.projectsFolder, settings.additionalFolders])

    const searchRootsKey = useMemo(() => searchRoots.join('||'), [searchRoots])

    useEffect(() => {
        // Keep shared cache across navigations so deep-search doesn't rebuild every time.
        setSearchIndexVersion((prev) => prev + 1)
    }, [searchRootsKey])

    const queueSearchIndexBuild = useCallback((root: string) => {
        if (!root) return
        if (searchIndexCacheRef.current.has(root)) return

        const inFlight = searchIndexLoadingRef.current.get(root)
        if (inFlight) return

        const retryAt = searchIndexRetryAtRef.current.get(root) || 0
        if (Date.now() < retryAt) return

        const loadPromise = (async () => {
            try {
                const treeResult = await window.devscope.getFileTree(root, {
                    showHidden: true,
                    maxDepth: -1
                })

                if (!treeResult?.success || !treeResult?.tree) {
                    searchIndexRetryAtRef.current.set(root, Date.now() + INDEX_RETRY_COOLDOWN_MS)
                    return
                }

                searchIndexCacheRef.current.set(root, buildFileSearchIndex(treeResult.tree))
                searchIndexRetryAtRef.current.delete(root)
                setSearchIndexVersion((prev) => prev + 1)
            } catch {
                searchIndexRetryAtRef.current.set(root, Date.now() + INDEX_RETRY_COOLDOWN_MS)
            }
        })()

        searchIndexLoadingRef.current.set(root, loadPromise)
        void loadPromise.finally(() => {
            searchIndexLoadingRef.current.delete(root)
        })
    }, [])

    useEffect(() => {
        if (!settings.enableFolderIndexing || searchRoots.length === 0) return

        let cancelled = false
        const runAutoIndex = async () => {
            for (const root of searchRoots) {
                if (cancelled) break
                queueSearchIndexBuild(root)
                const inFlight = searchIndexLoadingRef.current.get(root)
                if (inFlight) {
                    await inFlight.catch(() => undefined)
                }
            }
        }

        void runAutoIndex()
        return () => {
            cancelled = true
        }
    }, [settings.enableFolderIndexing, searchRoots, queueSearchIndexBuild])

    const performDeepSearch = useCallback(async (query: string) => {
        if (!query.trim() || searchRoots.length === 0) {
            setSearchResults(null)
            setIsSearching(false)
            return
        }

        setIsSearching(true)
        try {
            const parsedQuery = parseFileSearchQuery(query)
            const queryLower = parsedQuery.term
            const hasSearchTerm = queryLower.length > 0
            const matchedProjects: Project[] = []
            const matchedFolders: FolderItem[] = []
            const matchedFiles: FileItem[] = []
            const seenFolderPaths = new Set<string>()
            const seenFilePaths = new Set<string>()

            for (const root of searchRoots) {
                const index = searchIndexCacheRef.current.get(root)
                if (!index) {
                    queueSearchIndexBuild(root)
                    continue
                }

                const searchResult = searchFileIndex(index, parsedQuery, {
                    showHidden: showHiddenFiles,
                    includeDirectories: true,
                    limit: 1200
                })

                for (const entry of searchResult.matches) {
                    if (entry.type === 'directory') {
                        if (!seenFolderPaths.has(entry.path)) {
                            seenFolderPaths.add(entry.path)
                            matchedFolders.push({
                                name: entry.name,
                                path: entry.path,
                                lastModified: undefined,
                                isProject: false
                            })
                        }
                        continue
                    }

                    if (seenFilePaths.has(entry.path)) continue
                    seenFilePaths.add(entry.path)
                    matchedFiles.push({
                        name: entry.name,
                        path: entry.path,
                        size: entry.size || 0,
                        lastModified: undefined,
                        extension: entry.extension
                    })
                }
            }

            if (!parsedQuery.hasExtensionFilter && hasSearchTerm) {
                matchedProjects.push(...projects.filter((project) =>
                    project.name.toLowerCase().includes(queryLower)
                    || project.type.toLowerCase().includes(queryLower)
                    || project.frameworks?.some((framework) => framework.toLowerCase().includes(queryLower))
                ))
            }

            setSearchResults({
                projects: matchedProjects,
                folders: matchedFolders.slice(0, 50),
                files: matchedFiles.slice(0, 100)
            })
        } catch (error) {
            console.error('Deep search failed:', error)
            setSearchResults(null)
        } finally {
            setIsSearching(false)
        }
    }, [projects, queueSearchIndexBuild, searchRoots, showHiddenFiles])

    useEffect(() => {
        const timer = setTimeout(() => {
            if (deferredSearchQuery.length >= 2) {
                void performDeepSearch(deferredSearchQuery)
            } else {
                setSearchResults(null)
            }
        }, 180)
        return () => clearTimeout(timer)
    }, [deferredSearchQuery, performDeepSearch, searchIndexVersion])

    const clearSearch = useCallback(() => {
        setSearchQuery('')
        setSearchResults(null)
    }, [])

    const projectTypes = useMemo(() => {
        const types = new Set(projects.map((project) => project.type))
        return Array.from(types).filter((type) => type !== 'unknown' && type !== 'git')
    }, [projects])

    const filteredProjects = useMemo(() => {
        if (searchResults) return searchResults.projects.filter((project) => project.type !== 'git')
        return projects.filter((project) => {
            if (project.type === 'git') return false
            return filterType === 'all' || project.type === filterType
        })
    }, [projects, filterType, searchResults])

    const gitRepos = useMemo(() => {
        if (searchResults) return searchResults.projects.filter((project) => project.type === 'git')
        return projects.filter((project) => project.type === 'git').sort((a, b) => a.name.localeCompare(b.name))
    }, [projects, searchResults])

    const plainFolders = useMemo(() => {
        if (searchResults) return searchResults.folders
        return [...folders].sort((a, b) => a.name.localeCompare(b.name))
    }, [folders, searchResults])

    const filteredFiles = useMemo(() => {
        const sourceFiles = searchResults ? searchResults.files : files
        return sourceFiles
            .filter((file) => showHiddenFiles || !file.name.startsWith('.'))
            .sort((a, b) => a.name.localeCompare(b.name))
    }, [files, searchResults, showHiddenFiles])

    return {
        searchRoots,
        searchRootsKey,
        searchQuery,
        setSearchQuery,
        filterType,
        setFilterType,
        viewMode,
        setViewMode,
        contentLayout,
        setContentLayout,
        showHiddenFiles,
        setShowHiddenFiles,
        isSearching,
        searchResults,
        clearSearch,
        projectTypes,
        filteredProjects,
        gitRepos,
        plainFolders,
        filteredFiles
    }
}
