/**
 * DevScope - Projects Page (Redesigned)
 * File explorer-like interface with project type icons and framework detection
 */

import { useState, useEffect, useMemo, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
    FolderOpen, Folder, GitBranch, Settings, RefreshCw,
    ExternalLink, Terminal, FileCode, AlertCircle, Search, Filter,
    LayoutGrid, List, AlignJustify, ChevronRight, Clock, Code,
    FolderTree, Github, File, Eye, EyeOff, X, Loader2
} from 'lucide-react'
import { useSettings } from '@/lib/settings'
import { useTerminal } from '@/App'
import { cn } from '@/lib/utils'
import ProjectIcon, { FrameworkBadge } from '@/components/ui/ProjectIcon'
import Dropdown from '@/components/ui/Dropdown'

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
    const { openTerminal } = useTerminal()
    const navigate = useNavigate()

    const [projects, setProjects] = useState<Project[]>([])
    const [folders, setFolders] = useState<FolderItem[]>([])
    const [files, setFiles] = useState<FileItem[]>([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    // UI State
    const [searchQuery, setSearchQuery] = useState('')
    const [filterType, setFilterType] = useState<string>('all')
    const [viewMode, setViewMode] = useState<ViewMode>('grid')
    const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set())
    const [showHiddenFiles, setShowHiddenFiles] = useState(false)
    
    // Deep search state
    const [isSearching, setIsSearching] = useState(false)
    const [searchResults, setSearchResults] = useState<{
        projects: Project[]
        folders: FolderItem[]
        files: FileItem[]
    } | null>(null)

    const loadProjects = async () => {
        if (!settings.projectsFolder) return

        setLoading(true)
        setError(null)

        try {
            const result = await window.devscope.scanProjects(settings.projectsFolder)
            if (result.success) {
                setProjects(result.projects || [])
                setFolders(result.folders || [])
                setFiles(result.files || [])
            } else {
                setError(result.error || 'Failed to scan projects')
            }
        } catch (err: any) {
            setError(err.message || 'Failed to scan projects')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        loadProjects()
    }, [settings.projectsFolder])

    // Deep search function - searches recursively through all subfolders
    const performDeepSearch = useCallback(async (query: string) => {
        if (!query.trim() || !settings.projectsFolder) {
            setSearchResults(null)
            setIsSearching(false)
            return
        }

        setIsSearching(true)
        try {
            // Use getFileTree with deep search to get all items
            const result = await window.devscope.getFileTree(settings.projectsFolder, { 
                showHidden: showHiddenFiles, 
                maxDepth: 10 
            })
            
            if (!result.success) {
                setSearchResults(null)
                return
            }

            const queryLower = query.toLowerCase()
            const matchedProjects: Project[] = []
            const matchedFolders: FolderItem[] = []
            const matchedFiles: FileItem[] = []

            // Recursive function to search through tree
            const searchTree = (nodes: any[], parentPath: string = '') => {
                for (const node of nodes) {
                    const nameMatches = node.name.toLowerCase().includes(queryLower)
                    
                    if (nameMatches) {
                        if (node.type === 'directory') {
                            matchedFolders.push({
                                name: node.name,
                                path: node.path,
                                lastModified: undefined,
                                isProject: false
                            })
                        } else {
                            const ext = node.name.includes('.') ? node.name.split('.').pop() || '' : ''
                            matchedFiles.push({
                                name: node.name,
                                path: node.path,
                                size: node.size || 0,
                                lastModified: undefined,
                                extension: ext
                            })
                        }
                    }

                    // Search children
                    if (node.children && node.children.length > 0) {
                        searchTree(node.children, node.path)
                    }
                }
            }

            searchTree(result.tree || [])

            // Also search through projects
            const matchingProjects = projects.filter(p => 
                p.name.toLowerCase().includes(queryLower) ||
                p.type.toLowerCase().includes(queryLower) ||
                p.frameworks?.some(f => f.toLowerCase().includes(queryLower))
            )
            matchedProjects.push(...matchingProjects)

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
    }, [settings.projectsFolder, projects, showHiddenFiles])

    // Debounced search effect
    useEffect(() => {
        const timer = setTimeout(() => {
            if (searchQuery.length >= 2) {
                performDeepSearch(searchQuery)
            } else {
                setSearchResults(null)
            }
        }, 300)

        return () => clearTimeout(timer)
    }, [searchQuery, performDeepSearch])

    // Clear search
    const clearSearch = () => {
        setSearchQuery('')
        setSearchResults(null)
    }

    const handleOpenInTerminal = (project: Project) => {
        openTerminal({
            id: 'terminal',
            category: 'system',
            displayName: project.name
        }, project.path)
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

    if (loading) {
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
            {/* Modern Hero Header */}
            <div className="relative mb-8 overflow-hidden">
                {/* Background gradient accent */}
                <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/[0.07] via-transparent to-purple-500/[0.05] rounded-2xl" />
                <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
                
                <div className="relative p-6">
                    {/* Top row: Title + Actions */}
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-4">
                            <div className="relative">
                                <div className="absolute inset-0 bg-indigo-500/20 rounded-xl blur-lg" />
                                <div className="relative p-3 rounded-xl bg-gradient-to-br from-indigo-500/20 to-purple-500/10 border border-indigo-500/20">
                                    <FolderTree className="text-indigo-400" size={26} />
                                </div>
                            </div>
                            <div>
                                <div className="flex items-center gap-3">
                                    <h1 className="text-2xl font-bold text-white tracking-tight">Projects</h1>
                                    {totalProjects > 0 && (
                                        <span className="px-2.5 py-1 text-xs font-semibold bg-indigo-500/15 text-indigo-300 rounded-lg border border-indigo-500/20">
                                            {totalProjects}
                                        </span>
                                    )}
                                </div>
                                <p className="text-sm text-white/40 mt-0.5 flex items-center gap-2">
                                    <span className="w-1.5 h-1.5 rounded-full bg-green-400/80 animate-pulse" />
                                    <span className="font-mono text-xs text-white/30">{settings.projectsFolder}</span>
                                </p>
                            </div>
                        </div>
                        
                        <div className="flex items-center gap-2">
                            <Link
                                to="/settings/projects"
                                className="p-2.5 text-white/40 hover:text-white hover:bg-white/[0.08] rounded-xl transition-all duration-200"
                                title="Settings"
                            >
                                <Settings size={18} />
                            </Link>
                            <button
                                onClick={loadProjects}
                                disabled={loading}
                                className="flex items-center gap-2 px-4 py-2.5 text-white/60 hover:text-white bg-white/[0.04] hover:bg-white/[0.08] rounded-xl border border-white/[0.06] hover:border-white/[0.12] transition-all duration-200 disabled:opacity-50"
                            >
                                <RefreshCw size={15} className={cn(loading && 'animate-spin')} />
                                <span className="text-sm font-medium">Refresh</span>
                            </button>
                        </div>
                    </div>

                    {/* Inline Stats */}
                    {!loading && totalProjects > 0 && (
                        <div className="flex items-center gap-6 py-4 px-1 border-t border-white/[0.04]">
                            <div className="flex items-center gap-3">
                                <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-indigo-500/10">
                                    <Code size={16} className="text-indigo-400" />
                                </div>
                                <div>
                                    <p className="text-lg font-bold text-white leading-none">{totalProjects}</p>
                                    <p className="text-[10px] uppercase tracking-wider text-white/30 mt-0.5">Projects</p>
                                </div>
                            </div>
                            <div className="w-px h-8 bg-white/[0.06]" />
                            <div className="flex items-center gap-3">
                                <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-emerald-500/10">
                                    <FileCode size={16} className="text-emerald-400" />
                                </div>
                                <div>
                                    <p className="text-lg font-bold text-white leading-none">{frameworkCount}</p>
                                    <p className="text-[10px] uppercase tracking-wider text-white/30 mt-0.5">Frameworks</p>
                                </div>
                            </div>
                            <div className="w-px h-8 bg-white/[0.06]" />
                            <div className="flex items-center gap-3">
                                <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-amber-500/10">
                                    <GitBranch size={16} className="text-amber-400" />
                                </div>
                                <div>
                                    <p className="text-lg font-bold text-white leading-none">{projectTypes.length}</p>
                                    <p className="text-[10px] uppercase tracking-wider text-white/30 mt-0.5">Types</p>
                                </div>
                            </div>
                            <div className="w-px h-8 bg-white/[0.06]" />
                            <div className="flex items-center gap-3">
                                <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-purple-500/10">
                                    <Folder size={16} className="text-purple-400" />
                                </div>
                                <div>
                                    <p className="text-lg font-bold text-white leading-none">{folders.length}</p>
                                    <p className="text-[10px] uppercase tracking-wider text-white/30 mt-0.5">Folders</p>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Modern Toolbar */}
            <div className="sticky -top-6 z-20 bg-sparkle-bg/90 backdrop-blur-2xl pt-6 pb-5 mb-6 -mx-6 px-6">
                <div className="flex flex-col md:flex-row gap-4 justify-between items-center">
                    {/* Search & Filter */}
                    <div className="flex flex-1 w-full gap-3">
                        <div className="relative flex-1 group/search">
                            {isSearching ? (
                                <Loader2 className="absolute left-4 top-1/2 -translate-y-1/2 text-indigo-400 animate-spin" size={16} />
                            ) : (
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-white/25 group-focus-within/search:text-indigo-400 transition-colors duration-200" size={16} />
                            )}
                            <input
                                type="text"
                                placeholder="Deep search all files and folders..."
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
                                                            onClick={(e) => { e.stopPropagation(); handleOpenInTerminal(project) }}
                                                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-sparkle-border-secondary text-sparkle-text-secondary hover:text-sparkle-text rounded-lg transition-colors"
                                                        >
                                                            <Terminal size={14} />
                                                            <span>Terminal</span>
                                                        </button>
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
