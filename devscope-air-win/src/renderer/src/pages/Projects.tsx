/**
 * DevScope - Projects Page (Redesigned)
 * File explorer-like interface with project type icons and framework detection
 */

import { useState, useEffect, useMemo, useCallback, startTransition, useRef, useDeferredValue } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
    FolderOpen, Folder, GitBranch, Settings, RefreshCw,
    ExternalLink, FileCode, AlertCircle, Search, Filter,
    LayoutGrid, List, AlignJustify, ChevronRight, Clock, Code,
    FolderTree, Github, File, Eye, EyeOff, X, Loader2
} from 'lucide-react'
import { useSettings } from '@/lib/settings'
import { cn, parseFileSearchQuery } from '@/lib/utils'
import ProjectIcon, { FrameworkBadge } from '@/components/ui/ProjectIcon'
import Dropdown from '@/components/ui/Dropdown'
import { buildFileSearchIndex, searchFileIndex, type FileSearchIndex } from '@/lib/fileSearchIndex'

// Inline project type lookup to avoid ESM import issues
const PROJECT_TYPES_MAP: Record<string, { displayName: string; themeColor: string }> = {
    'node': { displayName: 'Node.js', themeColor: '#339933' },
    'python': { displayName: 'Python', themeColor: '#3776AB' },
    'rust': { displayName: 'Rust', themeColor: '#DEA584' },
    'go': { displayName: 'Go', themeColor: '#00ADD8' },
    'java': { displayName: 'Java', themeColor: '#007396' },
    'dotnet': { displayName: '.NET', themeColor: '#512BD4' },
    'ruby': { displayName: 'Ruby', themeColor: '#CC342D' },
    'php': { displayName: 'PHP', themeColor: '#777BB4' },
    'dart': { displayName: 'Dart/Flutter', themeColor: '#0175C2' },
    'elixir': { displayName: 'Elixir', themeColor: '#4B275F' },
    'cpp': { displayName: 'C/C++', themeColor: '#00599C' },
    'git': { displayName: 'Git Repository', themeColor: '#F05032' }
}

function getProjectTypeById(id: string) {
    return PROJECT_TYPES_MAP[id]
}

interface Project {
    name: string
    path: string
    type: string
    markers: string[]
    frameworks: string[]
    lastModified?: number
    isProject: boolean
}

interface FolderItem {
    name: string
    path: string
    lastModified?: number
    isProject: boolean
}

interface FileItem {
    name: string
    path: string
    size: number
    lastModified?: number
    extension: string
}

type ViewMode = 'grid' | 'detailed' | 'list'

export default function Projects() {
    const { settings } = useSettings()
    const navigate = useNavigate()

    const [projects, setProjects] = useState<Project[]>([])
    const [folders, setFolders] = useState<FolderItem[]>([])
    const [files, setFiles] = useState<FileItem[]>([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [hasLoadedOnce, setHasLoadedOnce] = useState(false)
    const [showBlockingLoader, setShowBlockingLoader] = useState(false)
    const inFlightScanKeyRef = useRef<string | null>(null)

    // UI State
    const [searchQuery, setSearchQuery] = useState('')
    const [filterType, setFilterType] = useState<string>('all')
    const [viewMode, setViewMode] = useState<ViewMode>('grid')
    const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set())
    const [showHiddenFiles, setShowHiddenFiles] = useState(false)
    const deferredSearchQuery = useDeferredValue(searchQuery)
    const searchIndexCacheRef = useRef<Map<string, FileSearchIndex>>(new Map())
    const searchIndexLoadingRef = useRef<Map<string, Promise<void>>>(new Map())
    
    // Deep search state
    const [isSearching, setIsSearching] = useState(false)
    const [searchResults, setSearchResults] = useState<{
        projects: Project[]
        folders: FolderItem[]
        files: FileItem[]
    } | null>(null)

    const yieldToUi = () =>
        new Promise<void>(resolve => {
            if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
                window.requestAnimationFrame(() => resolve())
            } else {
                setTimeout(resolve, 0)
            }
        })

    const searchRoots = useMemo(() => {
        return Array.from(new Set([
            settings.projectsFolder,
            ...(settings.additionalFolders || [])
        ].filter(Boolean)))
    }, [settings.projectsFolder, settings.additionalFolders])

    const searchRootsKey = useMemo(() => searchRoots.join('||'), [searchRoots])

    useEffect(() => {
        searchIndexCacheRef.current.clear()
        searchIndexLoadingRef.current.clear()
    }, [searchRootsKey])

    const ensureSearchIndex = useCallback(async (root: string) => {
        if (!root) return
        if (searchIndexCacheRef.current.has(root)) return
        const inFlight = searchIndexLoadingRef.current.get(root)
        if (inFlight) {
            await inFlight
            return
        }

        const loadPromise = (async () => {
            const treeResult = await window.devscope.getFileTree(root, {
                showHidden: true,
                maxDepth: -1
            })

            if (!treeResult?.success || !treeResult?.tree) return
            searchIndexCacheRef.current.set(root, buildFileSearchIndex(treeResult.tree))
        })()

        searchIndexLoadingRef.current.set(root, loadPromise)
        try {
            await loadPromise
        } finally {
            searchIndexLoadingRef.current.delete(root)
        }
    }, [])

    useEffect(() => {
        if (!settings.enableFolderIndexing) return
        if (searchRoots.length === 0) return

        let cancelled = false
        const runAutoIndex = async () => {
            for (const root of searchRoots) {
                if (cancelled) break
                await ensureSearchIndex(root)
            }
        }

        void runAutoIndex()
        return () => {
            cancelled = true
        }
    }, [settings.enableFolderIndexing, searchRoots, ensureSearchIndex])

    const loadProjects = useCallback(async () => {
        // Get all folders to scan (main + additional)
        const foldersToScan = [
            settings.projectsFolder,
            ...(settings.additionalFolders || [])
        ].filter(Boolean)

        if (foldersToScan.length === 0) {
            setHasLoadedOnce(true)
            return
        }

        const scanKey = foldersToScan.join('||')
        if (inFlightScanKeyRef.current === scanKey) {
            return
        }
        inFlightScanKeyRef.current = scanKey

        setLoading(true)
        setError(null)

        try {
            // Scan all folders in parallel
            const results = await Promise.all(
                foldersToScan.map(folder => window.devscope.scanProjects(folder))
            )

            // Merge results from all folders
            const allProjects: Project[] = []
            const allFolders: FolderItem[] = []
            const allFiles: FileItem[] = []
            const seenPaths = new Set<string>()
            let processed = 0

            for (const result of results) {
                if (result.success) {
                    // Deduplicate by path
                    for (const project of (result.projects || [])) {
                        if (!seenPaths.has(project.path)) {
                            seenPaths.add(project.path)
                            allProjects.push(project)
                        }
                        processed += 1
                        if (processed % 600 === 0) {
                            await yieldToUi()
                        }
                    }
                    for (const folder of (result.folders || [])) {
                        if (!seenPaths.has(folder.path)) {
                            seenPaths.add(folder.path)
                            allFolders.push(folder)
                        }
                        processed += 1
                        if (processed % 600 === 0) {
                            await yieldToUi()
                        }
                    }
                    for (const file of (result.files || [])) {
                        if (!seenPaths.has(file.path)) {
                            seenPaths.add(file.path)
                            allFiles.push(file)
                        }
                        processed += 1
                        if (processed % 600 === 0) {
                            await yieldToUi()
                        }
                    }
                }
            }

            // Keep urgent user interactions responsive while applying large list updates.
            startTransition(() => {
                setProjects(allProjects)
                setFolders(allFolders)
                setFiles(allFiles)

                // Set error only if ALL scans failed
                const allFailed = results.every(r => !r.success)
                if (allFailed && results.length > 0) {
                    setError(results[0].error || 'Failed to scan projects')
                }
            })
        } catch (err: any) {
            setError(err.message || 'Failed to scan projects')
        } finally {
            setLoading(false)
            setHasLoadedOnce(true)
            inFlightScanKeyRef.current = null
        }
    }, [settings.projectsFolder, settings.additionalFolders])

    useEffect(() => {
        if (!loading) {
            setShowBlockingLoader(false)
            return
        }

        const timer = window.setTimeout(() => {
            setShowBlockingLoader(true)
        }, 180)

        return () => {
            window.clearTimeout(timer)
        }
    }, [loading])

    useEffect(() => {
        // Let the first frame paint before kicking off potentially heavy scans.
        const timer = window.setTimeout(() => {
            void loadProjects()
        }, 80)

        return () => {
            window.clearTimeout(timer)
        }
    }, [loadProjects])

    // Deep search function - searches recursively through all subfolders
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
            await Promise.all(searchRoots.map((root) => ensureSearchIndex(root)))

            for (const root of searchRoots) {
                const index = searchIndexCacheRef.current.get(root)
                if (!index) continue

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

            // Also search through projects
            if (!parsedQuery.hasExtensionFilter && hasSearchTerm) {
                const matchingProjects = projects.filter(p =>
                    p.name.toLowerCase().includes(queryLower) ||
                    p.type.toLowerCase().includes(queryLower) ||
                    p.frameworks?.some(f => f.toLowerCase().includes(queryLower))
                )
                matchedProjects.push(...matchingProjects)
            }

            setSearchResults({
                projects: matchedProjects,
                folders: matchedFolders.slice(0, 50), // Limit results
                files: matchedFiles.slice(0, 100)
            })
        } catch (err) {
            console.error('Deep search failed:', err)
            setSearchResults(null)
        } finally {
            setIsSearching(false)
        }
    }, [searchRoots, projects, showHiddenFiles, ensureSearchIndex])

    // Debounced search effect
    useEffect(() => {
        const timer = setTimeout(() => {
            if (deferredSearchQuery.length >= 2) {
                performDeepSearch(deferredSearchQuery)
            } else {
                setSearchResults(null)
            }
        }, 180)

        return () => clearTimeout(timer)
    }, [deferredSearchQuery, performDeepSearch])

    // Clear search
    const clearSearch = () => {
        setSearchQuery('')
        setSearchResults(null)
    }

    const handleProjectClick = (project: Project) => {
        // Encode the path for URL
        const encodedPath = encodeURIComponent(project.path)

        // If it's a Git repository (but not another specific project type), treat it as a folder browse
        if (project.type === 'git') {
            navigate(`/folder-browse/${encodedPath}`)
        } else {
            navigate(`/projects/${encodedPath}`)
        }
    }

    const toggleFolder = async (folder: FolderItem) => {
        const newExpanded = new Set(expandedFolders)
        if (newExpanded.has(folder.path)) {
            newExpanded.delete(folder.path)
        } else {
            newExpanded.add(folder.path)
        }
        setExpandedFolders(newExpanded)
    }

    // Get unique project types for filter
    const projectTypes = useMemo(() => {
        const types = new Set(projects.map(p => p.type))
        return Array.from(types).filter(t => t !== 'unknown' && t !== 'git')
    }, [projects])

    // Filtered projects (exclude git)
    const filteredProjects = useMemo(() => {
        if (searchResults) return searchResults.projects.filter(p => p.type !== 'git')
        return projects.filter(project => {
            if (project.type === 'git') return false
            const matchesType = filterType === 'all' || project.type === filterType
            return matchesType
        })
    }, [projects, filterType, searchResults])

    // Git repositories only
    const gitRepos = useMemo(() => {
        if (searchResults) return searchResults.projects.filter(p => p.type === 'git')
        return projects.filter(p => p.type === 'git').sort((a, b) => a.name.localeCompare(b.name))
    }, [projects, searchResults])

    // Plain folders (non-project, non-git)
    const plainFolders = useMemo(() => {
        if (searchResults) return searchResults.folders
        return folders.sort((a, b) => a.name.localeCompare(b.name))
    }, [folders, searchResults])

    // Filtered files - respect hidden files toggle
    const filteredFiles = useMemo(() => {
        const sourceFiles = searchResults ? searchResults.files : files
        return sourceFiles
            .filter(f => showHiddenFiles || !f.name.startsWith('.'))
            .sort((a, b) => a.name.localeCompare(b.name))
    }, [files, searchResults, showHiddenFiles])

    // Stats
    const totalProjects = projects.length
    const frameworkCount = useMemo(() => {
        const frameworks = new Set<string>()
        projects.forEach(p => p.frameworks?.forEach(f => frameworks.add(f)))
        return frameworks.size
    }, [projects])

    const statChips = useMemo(() => ([
        {
            key: 'projects',
            label: 'projects',
            value: totalProjects,
            icon: Code,
            color: 'var(--accent-primary)'
        },
        {
            key: 'frameworks',
            label: 'frameworks',
            value: frameworkCount,
            icon: FileCode,
            color: '#22c55e'
        },
        {
            key: 'types',
            label: 'types',
            value: projectTypes.length,
            icon: GitBranch,
            color: '#f59e0b'
        },
        {
            key: 'folders',
            label: 'folders',
            value: folders.length,
            icon: Folder,
            color: '#a855f7'
        }
    ]), [totalProjects, frameworkCount, projectTypes.length, folders.length])

    const formatRelativeTime = (timestamp?: number) => {
        if (!timestamp) return ''
        const now = Date.now()
        const diff = now - timestamp
        const minutes = Math.floor(diff / 60000)
        const hours = Math.floor(diff / 3600000)
        const days = Math.floor(diff / 86400000)

        if (minutes < 1) return 'Just now'
        if (minutes < 60) return `${minutes}m ago`
        if (hours < 24) return `${hours}h ago`
        if (days < 7) return `${days}d ago`
        return new Date(timestamp).toLocaleDateString()
    }

    if (!hasLoadedOnce && showBlockingLoader) {
        return (
            <div className="flex items-center justify-center min-h-[50vh]">
                <div className="flex flex-col items-center gap-4">
                    <RefreshCw className="animate-spin text-sparkle-accent" size={32} />
                    <p className="text-sparkle-text-secondary">Scanning projects...</p>
                </div>
            </div>
        )
    }

    if (error) {
        return (
            <div className="flex items-center justify-center min-h-[50vh]">
                <div className="flex flex-col items-center gap-4 text-red-400">
                    <AlertCircle size={32} />
                    <p>{error}</p>
                    <button
                        onClick={loadProjects}
                        className="px-4 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-white text-sm transition-colors"
                    >
                        Retry
                    </button>
                </div>
            </div>
        )
    }

    // No folder configured
    if (!settings.projectsFolder) {
        return (
            <div className="animate-fadeIn">
                <div className="mb-8">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 rounded-lg bg-indigo-500/10">
                            <FolderTree className="text-indigo-400" size={24} />
                        </div>
                        <h1 className="text-2xl font-semibold text-sparkle-text">Projects</h1>
                    </div>
                    <p className="text-sparkle-text-secondary">
                        Your coding projects in one place
                    </p>
                </div>

                <div className="flex flex-col items-center justify-center py-16 bg-sparkle-card rounded-xl border border-sparkle-border">
                    <Folder size={48} className="text-sparkle-text-muted mb-4" />
                    <h3 className="text-lg font-medium text-sparkle-text mb-2">No Projects Folder Configured</h3>
                    <p className="text-sparkle-text-secondary text-center max-w-md mb-6">
                        Set up a projects folder in settings to see all your coding projects here.
                    </p>
                    <Link
                        to="/settings/projects"
                        className="flex items-center gap-2 px-4 py-2 bg-[var(--accent-primary)] text-white rounded-lg hover:bg-[var(--accent-primary)]/90 transition-colors"
                    >
                        <Settings size={16} />
                        <span>Configure Projects Folder</span>
                    </Link>
                </div>
            </div>
        )
    }

    return (
        <div className="max-w-[1600px] mx-auto animate-fadeIn pb-20">
            {/* Projects Header - Redesigned */}
            <div className="relative mb-8">
                {/* Main header container */}
                <div className="relative">
                    {/* Single row layout */}
                    <div className="flex items-center justify-between gap-6 mb-6">
                        {/* Left side: Icon + Title + Stats */}
                        <div className="flex items-center gap-6 min-w-0 flex-1">
                            {/* Icon with gradient background */}
                            <div className="relative shrink-0">
                                <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 opacity-25 blur-xl" />
                                <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl border border-amber-300/35 bg-gradient-to-br from-amber-400/20 via-orange-400/15 to-transparent backdrop-blur-sm shadow-[0_0_0_1px_rgba(251,191,36,0.18)_inset]">
                                    <FolderTree className="text-amber-300" size={28} />
                                </div>
                            </div>

                            {/* Title and stats */}
                            <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-3 mb-2">
                                    <h1 className="text-3xl font-bold tracking-tight text-sparkle-text">
                                        Projects
                                    </h1>
                                    {!loading && totalProjects > 0 && (
                                        <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-300/40 bg-gradient-to-r from-amber-400/20 to-orange-400/15 px-3 py-1 text-sm font-semibold text-amber-300">
                                            <span className="h-1.5 w-1.5 rounded-full bg-amber-300 animate-pulse" />
                                            {totalProjects}
                                        </span>
                                    )}
                                </div>
                                <p className="text-sm text-sparkle-text-secondary mb-3">
                                    Your coding projects in one place
                                </p>
                                
                                {/* Stats row + folder path */}
                                <div className="flex items-center gap-3 flex-wrap">
                                    {!loading && totalProjects > 0 && (
                                        <>
                                            {statChips.map(chip => {
                                                const Icon = chip.icon
                                                return (
                                                    <div
                                                        key={chip.key}
                                                        className="flex items-center gap-2 rounded-lg border px-3 py-1.5"
                                                        style={{
                                                            borderColor: `color-mix(in srgb, ${chip.color}, transparent 35%)`,
                                                            background: `linear-gradient(135deg, color-mix(in srgb, ${chip.color}, transparent 72%), color-mix(in srgb, ${chip.color}, transparent 82%))`
                                                        }}
                                                    >
                                                        <Icon size={14} color={chip.color} strokeWidth={2.1} />
                                                        <span className="text-sm font-bold text-sparkle-text">{chip.value}</span>
                                                        <span
                                                            className="text-xs font-semibold tracking-wide"
                                                            style={{ color: chip.color }}
                                                        >
                                                            {chip.label}
                                                        </span>
                                                    </div>
                                                )
                                            })}
                                            <div className="h-4 w-px bg-sparkle-border" />
                                        </>
                                    )}
                                    
                                    {/* Active folder path */}
                                    <div className="flex items-center gap-1.5 rounded-lg bg-sparkle-card px-2.5 py-1.5 border border-sparkle-border">
                                        <FolderOpen size={12} color="var(--accent-primary)" strokeWidth={2} />
                                        <span className="font-mono text-xs text-sparkle-text-muted truncate max-w-xs">
                                            {settings.projectsFolder}
                                        </span>
                                    </div>
                                    {settings.additionalFolders && settings.additionalFolders.length > 0 && (
                                        <span className="text-xs text-sparkle-text-muted">
                                            +{settings.additionalFolders.length} more
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Right side: Action buttons */}
                        <div className="flex items-center gap-2 shrink-0">
                            <Link
                                to="/settings/projects"
                                className="flex items-center gap-2 rounded-xl border border-sparkle-border bg-sparkle-card px-3 py-2 text-sm text-sparkle-text-secondary hover:text-sparkle-text hover:border-[var(--accent-primary)]/30 hover:bg-sparkle-card-hover transition-all"
                                title="Projects settings"
                            >
                                <Settings size={16} />
                                <span className="hidden sm:inline">Settings</span>
                            </Link>
                            <button
                                onClick={loadProjects}
                                disabled={loading}
                                className="flex items-center gap-2 rounded-xl bg-[var(--accent-primary)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--accent-primary)]/90 disabled:opacity-50 transition-all"
                            >
                                <RefreshCw size={16} className={cn(loading && 'animate-spin')} />
                                <span>Refresh</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Modern Toolbar */}
            <div className="sticky -top-6 z-20 bg-sparkle-bg/90 backdrop-blur-2xl pt-6 pb-5 mb-6 -mx-6 px-6">
                <div className="flex flex-col md:flex-row gap-4 justify-between items-center">
                    {/* Search & Filter */}
                    <div className="flex flex-1 w-full gap-3">
                        <div className="relative flex-1 group/search">
                            <div className="absolute left-4 top-1/2 -translate-y-1/2 flex items-center justify-center w-4 h-4">
                                {isSearching ? (
                                    <Loader2 className="text-indigo-400 animate-spin" size={16} />
                                ) : (
                                    <Search className="text-white/25 group-focus-within/search:text-indigo-400 transition-colors duration-200" size={16} />
                                )}
                            </div>
                            <input
                                type="text"
                                placeholder="Deep search all files and folders (try .ts)..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className={cn(
                                    "w-full bg-white/[0.03] border border-white/[0.06] rounded-xl py-2.5 pl-11 pr-10 text-sm text-white focus:outline-none focus:bg-white/[0.05] focus:border-indigo-500/30 transition-all duration-200 placeholder:text-white/20",
                                    searchQuery && "border-indigo-500/30 bg-indigo-500/5"
                                )}
                            />
                            {searchQuery && (
                                <button
                                    onClick={clearSearch}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-white/30 hover:text-white/60 rounded-md hover:bg-white/10 transition-colors"
                                >
                                    <X size={14} />
                                </button>
                            )}
                        </div>

                        <Dropdown
                            value={filterType}
                            onChange={(value) => setFilterType(value)}
                            icon={<Filter size={14} />}
                            className="min-w-[160px]"
                            options={[
                                { value: 'all', label: 'All Types' },
                                ...projectTypes.map(type => {
                                    const typeInfo = getProjectTypeById(type)
                                    return {
                                        value: type,
                                        label: typeInfo?.displayName || type,
                                        color: typeInfo?.themeColor
                                    }
                                })
                            ]}
                        />
                    </div>

                    {/* Controls */}
                    <div className="flex items-center gap-2">
                        {/* Hidden Files Toggle */}
                        <button
                            onClick={() => setShowHiddenFiles(!showHiddenFiles)}
                            className={cn(
                                "flex items-center gap-2 px-3 py-2 rounded-xl border transition-all duration-200 text-sm",
                                showHiddenFiles
                                    ? "bg-indigo-500/15 border-indigo-500/30 text-indigo-300"
                                    : "bg-white/[0.03] border-white/[0.06] text-white/40 hover:text-white/60 hover:bg-white/[0.05]"
                            )}
                            title={showHiddenFiles ? "Hide hidden files" : "Show hidden files"}
                        >
                            {showHiddenFiles ? <Eye size={14} /> : <EyeOff size={14} />}
                            <span className="hidden sm:inline">Hidden</span>
                        </button>

                        {/* View Toggles */}
                        <div className="flex items-center gap-1 bg-white/[0.03] p-1 rounded-xl border border-white/[0.06]">
                            {[
                                { id: 'grid', icon: LayoutGrid, label: 'Grid' },
                                { id: 'detailed', icon: AlignJustify, label: 'Detailed' },
                                { id: 'list', icon: List, label: 'List' }
                            ].map(({ id, icon: Icon }) => (
                                <button
                                    key={id}
                                    onClick={() => setViewMode(id as ViewMode)}
                                    className={cn(
                                        "p-2 rounded-lg transition-all duration-200",
                                        viewMode === id
                                            ? "bg-white/[0.1] text-white"
                                            : "text-white/30 hover:text-white/60 hover:bg-white/[0.04]"
                                    )}
                                >
                                    <Icon size={16} />
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Search Results Header */}
                {searchResults && (
                    <div className="mt-4 pt-4 border-t border-white/[0.04]">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <Search size={16} className="text-indigo-400" />
                                <span className="text-sm text-white/60">
                                    Search results for "<span className="text-white font-medium">{searchQuery}</span>"
                                </span>
                                <span className="text-xs text-white/30">
                                    {searchResults.projects.length + searchResults.folders.length + searchResults.files.length} items found
                                </span>
                            </div>
                            <button
                                onClick={clearSearch}
                                className="text-xs text-white/40 hover:text-white/60 transition-colors"
                            >
                                Clear search
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Error State */}
            {error && (
                <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-xl flex items-center gap-3">
                    <AlertCircle size={20} className="text-red-400" />
                    <span className="text-red-300">{error}</span>
                </div>
            )}

            {/* Loading State */}
            {loading && (
                <div className="flex items-center justify-center py-16">
                    <RefreshCw size={24} className="text-[var(--accent-primary)] animate-spin" />
                </div>
            )}

            {/* Content */}
            {!loading && (
                <div className="space-y-8">
                    {/* 1. Folders */}
                    {plainFolders.length > 0 && (
                        <div>
                            <div className="flex items-center gap-3 mb-4">
                                <Folder size={18} className="text-yellow-400/70" />
                                <h2 className="text-sm font-medium text-white/60">Folders</h2>
                                <span className="text-xs text-white/30">{plainFolders.length}</span>
                                <div className="h-px bg-white/5 flex-1" />
                            </div>
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2">
                                {plainFolders.map((folder) => (
                                    <button
                                        key={folder.path}
                                        onClick={() => {
                                            const encodedPath = encodeURIComponent(folder.path)
                                            navigate(`/folder-browse/${encodedPath}`)
                                        }}
                                        className="flex items-center gap-2 p-2.5 bg-sparkle-card/50 rounded-lg border border-white/5 hover:border-yellow-400/30 hover:bg-yellow-400/5 transition-all text-left group"
                                    >
                                        <Folder size={16} className="text-yellow-400/70 group-hover:text-yellow-400 transition-colors flex-shrink-0" />
                                        <span className="text-sm text-white/70 truncate group-hover:text-white transition-colors">{folder.name}</span>
                                        <ChevronRight size={12} className="text-white/20 group-hover:text-white/60 ml-auto flex-shrink-0 transition-colors" />
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* 2. Git Repositories */}
                    {gitRepos.length > 0 && (
                        <div>
                            <div className="flex items-center gap-3 mb-4">
                                <Github size={18} className="text-orange-400/70" />
                                <h2 className="text-sm font-medium text-white/60">Git Repositories</h2>
                                <span className="text-xs text-white/30">{gitRepos.length}</span>
                                <div className="h-px bg-white/5 flex-1" />
                            </div>
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2">
                                {gitRepos.map((repo) => (
                                    <button
                                        key={repo.path}
                                        onClick={() => {
                                            const encodedPath = encodeURIComponent(repo.path)
                                            navigate(`/folder-browse/${encodedPath}`)
                                        }}
                                        className="flex items-center gap-2 p-2.5 bg-sparkle-card/50 rounded-lg border border-white/5 hover:border-orange-400/30 hover:bg-orange-400/5 transition-all text-left group"
                                    >
                                        <Github size={16} className="text-orange-400/70 group-hover:text-orange-400 transition-colors flex-shrink-0" />
                                        <span className="text-sm text-white/70 truncate group-hover:text-white transition-colors">{repo.name}</span>
                                        <ChevronRight size={12} className="text-white/20 group-hover:text-white/60 ml-auto flex-shrink-0 transition-colors" />
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* 3. Projects */}
                    {filteredProjects.length > 0 && (
                        <div>
                            <div className="flex items-center gap-3 mb-4">
                                <Code size={18} className="text-sparkle-accent" />
                                <h2 className="text-sm font-medium text-white/60">Projects</h2>
                                <span className="text-xs text-white/30">{filteredProjects.length}</span>
                                <div className="h-px bg-white/5 flex-1" />
                            </div>

                            <div className={cn(
                                "grid gap-4",
                                viewMode === 'grid' && "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4",
                                viewMode === 'detailed' && "grid-cols-1 md:grid-cols-2",
                                viewMode === 'list' && "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
                            )}>
                                {filteredProjects.map((project) => {
                                    const typeInfo = getProjectTypeById(project.type)
                                    const themeColor = typeInfo?.themeColor || '#525252'

                                    return (
                                        <div
                                            key={project.path}
                                            onClick={() => handleProjectClick(project)}
                                            className={cn(
                                                "group relative border border-white/5 transition-all duration-300 overflow-hidden cursor-pointer",
                                                "hover:-translate-y-1 hover:border-white/10",
                                                viewMode === 'list'
                                                    ? "rounded-xl p-3 bg-sparkle-card flex items-center gap-3"
                                                    : "rounded-2xl bg-sparkle-card p-5 flex flex-col gap-4"
                                            )}
                                        >
                                            {/* Hover Glow */}
                                            <div
                                                className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
                                                style={{
                                                    boxShadow: `inset 0 0 0 1px ${themeColor}40`,
                                                    background: `linear-gradient(to bottom right, ${themeColor}05, transparent)`
                                                }}
                                            />

                                            {viewMode === 'list' ? (
                                                // LIST VIEW
                                                <>
                                                    <div className="p-2 rounded-lg bg-sparkle-bg border border-white/5">
                                                        <ProjectIcon projectType={project.type} size={20} />
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-2">
                                                            <span className="font-bold text-sm text-white truncate">{project.name}</span>
                                                            {project.frameworks?.slice(0, 1).map(fw => (
                                                                <FrameworkBadge key={fw} framework={fw} size="sm" showLabel={false} />
                                                            ))}
                                                        </div>
                                                    </div>
                                                    <span className="text-[10px] text-white/30">{formatRelativeTime(project.lastModified)}</span>
                                                    <ChevronRight size={16} className="text-white/30 group-hover:text-white/60 transition-colors" />
                                                </>
                                            ) : (
                                                // GRID & DETAILED VIEW
                                                <>
                                                    {/* Header */}
                                                    <div className="flex items-start justify-between w-full relative z-10">
                                                        <div className="p-3 rounded-xl bg-sparkle-bg border border-white/5 shadow-inner">
                                                            <ProjectIcon
                                                                projectType={project.type}
                                                                framework={project.frameworks?.[0]}
                                                                size={viewMode === 'detailed' ? 40 : 32}
                                                            />
                                                        </div>
                                                        <div className="flex items-center gap-1.5 text-[10px] text-white/30">
                                                            <Clock size={12} />
                                                            <span>{formatRelativeTime(project.lastModified)}</span>
                                                        </div>
                                                    </div>

                                                    {/* Content */}
                                                    <div className="relative z-10 flex-1">
                                                        <h3 className="font-bold text-white text-lg mb-1 group-hover:text-white/90 transition-colors truncate">
                                                            {project.name}
                                                        </h3>

                                                        {/* Type badge */}
                                                        <p className="text-xs text-white/40 mb-3">
                                                            {typeInfo?.displayName || project.type}
                                                        </p>

                                                        {/* Frameworks */}
                                                        {project.frameworks && project.frameworks.length > 0 && (
                                                            <div className="flex flex-wrap gap-1.5 mb-3">
                                                                {project.frameworks.slice(0, viewMode === 'detailed' ? 5 : 3).map(fw => (
                                                                    <FrameworkBadge
                                                                        key={fw}
                                                                        framework={fw}
                                                                        size="sm"
                                                                        showLabel={viewMode === 'detailed'}
                                                                    />
                                                                ))}
                                                                {project.frameworks.length > (viewMode === 'detailed' ? 5 : 3) && (
                                                                    <span className="text-[10px] text-white/30 px-1.5 py-0.5">
                                                                        +{project.frameworks.length - (viewMode === 'detailed' ? 5 : 3)}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* Actions */}
                                                    <div className="flex items-center gap-2 relative z-10">
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); window.devscope.openInExplorer?.(project.path) }}
                                                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-sparkle-border-secondary text-sparkle-text-secondary hover:text-sparkle-text rounded-lg transition-colors"
                                                        >
                                                            <ExternalLink size={14} />
                                                            <span>Open</span>
                                                        </button>
                                                    </div>

                                                    {/* Theme Accent Line */}
                                                    <div
                                                        className="absolute bottom-0 left-0 right-0 h-1 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                                                        style={{ background: themeColor }}
                                                    />
                                                </>
                                            )}
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    )}

                    {/* 4. Files */}
                    {filteredFiles.length > 0 && (
                        <div>
                            <div className="flex items-center gap-3 mb-4">
                                <File size={18} className="text-cyan-300/80" />
                                <h2 className="text-sm font-medium text-white/60">Files</h2>
                                <span className="text-xs text-white/30">{filteredFiles.length}</span>
                                <div className="h-px bg-white/5 flex-1" />
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
                                {filteredFiles.map((file) => {
                                    const lastSlash = Math.max(file.path.lastIndexOf('/'), file.path.lastIndexOf('\\'))
                                    const parentPath = lastSlash > 0 ? file.path.slice(0, lastSlash) : file.path
                                    const encodedParentPath = encodeURIComponent(parentPath)
                                    return (
                                        <div
                                            key={file.path}
                                            onClick={() => navigate(`/folder-browse/${encodedParentPath}`)}
                                            className="group flex items-center gap-3 rounded-lg border border-white/5 bg-sparkle-card/50 p-2.5 text-left hover:border-cyan-300/30 hover:bg-cyan-300/5 transition-all cursor-pointer"
                                            title={file.path}
                                        >
                                            <File size={15} className="text-cyan-300/80 flex-shrink-0" />
                                            <div className="min-w-0 flex-1">
                                                <div className="truncate text-sm text-white/80 group-hover:text-white">{file.name}</div>
                                                <div className="truncate text-[11px] text-white/35">{parentPath}</div>
                                            </div>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation()
                                                    window.devscope.openInExplorer?.(file.path)
                                                }}
                                                className="flex items-center gap-1 px-2 py-1 rounded-md text-[11px] text-white/55 hover:text-white hover:bg-white/10 transition-colors"
                                                title="Open in Explorer"
                                            >
                                                <ExternalLink size={12} />
                                                Open
                                            </button>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    )}

                    {/* Empty State */}
                    {filteredProjects.length === 0 && plainFolders.length === 0 && gitRepos.length === 0 && filteredFiles.length === 0 && !error && (
                        <div className="flex flex-col items-center justify-center py-16 bg-sparkle-card rounded-xl border border-sparkle-border">
                            <FileCode size={48} className="text-sparkle-text-muted mb-4" />
                            <h3 className="text-lg font-medium text-sparkle-text mb-2">
                                {searchQuery || filterType !== 'all' ? 'No Matching Items' : 'No Items Found'}
                            </h3>
                            <p className="text-sparkle-text-secondary text-center max-w-md">
                                {searchQuery || filterType !== 'all'
                                    ? 'Try adjusting your search or filter criteria.'
                                    : 'No projects or folders detected.'}
                            </p>
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}




