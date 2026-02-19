/**
 * DevScope - Folder Browse Page
 * Browse folder contents with same layout as Projects main page
 */

import { useState, useEffect, useMemo, useDeferredValue } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
    FolderOpen, Folder, Settings, RefreshCw,
    ExternalLink, FileCode, AlertCircle, Search, Filter,
    LayoutGrid, List, AlignJustify, ChevronRight, Clock, Code,
    ArrowLeft, File, FileText, MoreVertical, Download, Trash2, Github
} from 'lucide-react'
import { cn, fileNameMatchesQuery, parseFileSearchQuery } from '@/lib/utils'
import ProjectIcon, { FrameworkBadge } from '@/components/ui/ProjectIcon'
import { FilePreviewModal, useFilePreview } from '@/components/ui/FilePreviewModal'
import { trackRecentProject } from '@/lib/recentProjects'

// Inline project type lookup
const PROJECT_TYPES_MAP: Record<string, { displayName: string; themeColor: string }> = {
    // Web/Backend
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
    'git': { displayName: 'Git Repository', themeColor: '#F05032' },
    // Mobile Apps
    'android': { displayName: 'Android', themeColor: '#3DDC84' },
    'ios': { displayName: 'iOS/macOS', themeColor: '#000000' },
    'flutter': { displayName: 'Flutter', themeColor: '#02569B' },
    'react-native': { displayName: 'React Native', themeColor: '#61DAFB' },
    'kotlin-multiplatform': { displayName: 'Kotlin Multiplatform', themeColor: '#7F52FF' },
    'xamarin': { displayName: 'Xamarin/MAUI', themeColor: '#3498DB' },
    'ionic': { displayName: 'Ionic', themeColor: '#3880FF' },
    // Desktop Apps
    'electron': { displayName: 'Electron', themeColor: '#47848F' },
    'tauri': { displayName: 'Tauri', themeColor: '#FFC131' },
    'qt': { displayName: 'Qt', themeColor: '#41CD52' },
    'wpf': { displayName: 'WPF', themeColor: '#512BD4' },
    'winforms': { displayName: 'Windows Forms', themeColor: '#0078D6' },
    'swiftui': { displayName: 'SwiftUI', themeColor: '#F05138' }
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

export default function FolderBrowse() {
    const { folderPath } = useParams<{ folderPath: string }>()
    const navigate = useNavigate()

    const decodedPath = folderPath ? decodeURIComponent(folderPath) : ''
    const folderName = decodedPath.split(/[/\\]/).pop() || 'Folder'

    const [projects, setProjects] = useState<Project[]>([])
    const [folders, setFolders] = useState<FolderItem[]>([])
    const [files, setFiles] = useState<FileItem[]>([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    // UI State
    const [searchQuery, setSearchQuery] = useState('')
    const deferredSearchQuery = useDeferredValue(searchQuery)
    const [filterType, setFilterType] = useState<string>('all')
    const [viewMode, setViewMode] = useState<ViewMode>('grid')
    const [isCurrentFolderGitRepo, setIsCurrentFolderGitRepo] = useState(false)

    // File Preview
    const {
        previewFile,
        previewContent,
        loadingPreview,
        previewTruncated,
        previewSize,
        previewBytes,
        openPreview,
        closePreview,
        openFile
    } = useFilePreview()

    // Check if current folder is a git repo
    useEffect(() => {
        const checkGitRepo = async () => {
            if (!decodedPath) return
            try {
                const result = await window.devscope.checkIsGitRepo(decodedPath)
                const isRepo = result?.isGitRepo === true
                setIsCurrentFolderGitRepo(isRepo)
                if (isRepo) {
                    trackRecentProject(decodedPath, 'folder')
                }
            } catch {
                setIsCurrentFolderGitRepo(false)
            }
        }
        checkGitRepo()
    }, [decodedPath])

    const loadContents = async () => {
        if (!decodedPath) return

        setLoading(true)
        setError(null)

        try {
            const result = await window.devscope.scanProjects(decodedPath)
            if (result.success) {
                setProjects(result.projects || [])
                setFolders(result.folders || [])
                setFiles(result.files || [])
            } else {
                setError(result.error || 'Failed to scan folder')
            }
        } catch (err: any) {
            setError(err.message || 'Failed to scan folder')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        loadContents()
    }, [decodedPath])
    const handleProjectClick = (project: Project) => {
        const encodedPath = encodeURIComponent(project.path)
        // Git repos should go to project details, not folder browse
        navigate(`/projects/${encodedPath}`)
    }

    const handleFolderClick = (folder: FolderItem) => {
        const encodedPath = encodeURIComponent(folder.path)
        navigate(`/folder-browse/${encodedPath}`)
    }




    // Get unique project types for filter
    const projectTypes = useMemo(() => {
        const types = new Set(projects.map(p => p.type))
        return Array.from(types).filter(t => t !== 'unknown' && t !== 'git')
    }, [projects])

    const parsedSearchQuery = useMemo(() => parseFileSearchQuery(deferredSearchQuery), [deferredSearchQuery])

    // Filtered projects
    const filteredProjects = useMemo(() => {
        if (parsedSearchQuery.hasExtensionFilter) return []

        return projects.filter(project => {
            if (project.type === 'git') return false
            const matchesSearch = !parsedSearchQuery.term || project.name.toLowerCase().includes(parsedSearchQuery.term)
            const matchesType = filterType === 'all' || project.type === filterType
            return matchesSearch && matchesType
        })
    }, [projects, parsedSearchQuery, filterType])

    // Filtered folders (exclude git when showing as projects)
    const filteredFolders = useMemo(() => {
        if (deferredSearchQuery) return []

        // Always show regular folders (not Git repos)
        return folders.sort((a, b) => a.name.localeCompare(b.name))
    }, [folders, deferredSearchQuery])

    // Git repositories (shown as projects when toggle is on)
    const gitRepos = useMemo(() => {
        return projects.filter(p => p.type === 'git')
    }, [projects])

    // Displayed projects list (Git repos are always shown as folders, not here)
    const displayedProjects = useMemo(() => {
        return filteredProjects
    }, [filteredProjects])

    // Stats
    const totalProjects = projects.length
    const totalFiles = files.length

    // Filtered files
    const filteredFiles = useMemo(() => {
        if (!deferredSearchQuery) return files
        return files.filter(f => fileNameMatchesQuery(f.name, parsedSearchQuery))
    }, [files, deferredSearchQuery, parsedSearchQuery])

    // Format file size
    const formatFileSize = (bytes: number) => {
        if (bytes < 1024) return `${bytes} B`
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
        if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
        return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`
    }

    // Get file icon color based on extension
    const getFileColor = (ext: string) => {
        const colors: Record<string, string> = {
            'js': '#f7df1e', 'ts': '#3178c6', 'tsx': '#3178c6', 'jsx': '#61dafb',
            'py': '#3776ab', 'rb': '#cc342d', 'go': '#00add8', 'rs': '#dea584',
            'java': '#007396', 'cs': '#512bd4', 'cpp': '#00599c', 'c': '#a8b9cc',
            'html': '#e34f26', 'css': '#1572b6', 'scss': '#cc6699', 'json': '#cbcb41',
            'md': '#083fa1', 'txt': '#6b7280', 'yaml': '#cb171e', 'yml': '#cb171e',
            'xml': '#0060ac', 'sql': '#336791', 'sh': '#4eaa25', 'bat': '#c1f12e'
        }
        return colors[ext.toLowerCase()] || '#6b7280'
    }

    // Format relative time
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

    return (
        <div className="max-w-[1600px] mx-auto animate-fadeIn pb-20">
            {/* Header */}
            <div className="mb-8 flex items-start justify-between">
                <div>
                    <div className="flex items-center gap-3 mb-2">
                        <button
                            onClick={() => navigate(-1)}
                            className="p-2 text-sparkle-text-secondary hover:text-sparkle-text hover:bg-white/5 rounded-lg transition-colors"
                        >
                            <ArrowLeft size={20} />
                        </button>
                        <div className="p-2 rounded-lg bg-yellow-500/10">
                            <FolderOpen className="text-yellow-400" size={24} />
                        </div>
                        <h1 className="text-2xl font-semibold text-sparkle-text">{folderName}</h1>
                        {totalProjects > 0 && (
                            <span className="px-2 py-0.5 text-xs bg-yellow-500/20 text-yellow-300 rounded-full">
                                {totalProjects} projects
                            </span>
                        )}
                    </div>
                    <p className="text-sparkle-text-secondary text-sm">
                        <span className="font-mono text-xs opacity-60">{decodedPath}</span>
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    {/* View as Project button - shown when folder is a git repo */}
                    {isCurrentFolderGitRepo && (
                        <button
                            onClick={() => {
                                const encodedPath = encodeURIComponent(decodedPath)
                                navigate(`/projects/${encodedPath}`)
                            }}
                            className="flex items-center gap-2 px-3 py-2 bg-[var(--accent-primary)] hover:bg-[var(--accent-primary)]/80 text-white text-sm font-medium rounded-lg transition-all"
                            title="View as Project"
                        >
                            <Code size={16} />
                            <span>View as Project</span>
                        </button>
                    )}
                    <button
                        onClick={() => window.devscope.openInExplorer?.(decodedPath)}
                        className="p-2 text-sparkle-text-secondary hover:text-sparkle-text hover:bg-sparkle-border-secondary rounded-lg transition-colors"
                        title="Open in Explorer"
                    >
                        <ExternalLink size={18} />
                    </button>
                    <button
                        onClick={loadContents}
                        disabled={loading}
                        className="flex items-center gap-2 px-3 py-2 text-sparkle-text-secondary hover:text-sparkle-text hover:bg-sparkle-border-secondary rounded-lg transition-colors disabled:opacity-50"
                    >
                        <RefreshCw size={16} className={cn(loading && 'animate-spin')} />
                        <span className="text-sm">Refresh</span>
                    </button>
                </div>
            </div>

            {/* Toolbar */}
            <div className="sticky -top-6 z-20 bg-sparkle-bg/95 backdrop-blur-xl pt-6 pb-4 mb-6 -mx-6 px-6 border-b border-white/5">
                <div className="flex flex-col md:flex-row gap-4 justify-between items-center">
                    {/* Search & Filter */}
                    <div className="flex flex-1 w-full gap-3">
                        <div className="relative flex-1 group/search">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30 group-focus-within/search:text-sparkle-accent transition-colors" size={18} />
                            <input
                                type="text"
                                placeholder="Search in folder..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full bg-sparkle-card border border-white/10 rounded-2xl py-3 pl-11 pr-4 text-sm text-white focus:outline-none focus:border-sparkle-accent/50 focus:ring-4 focus:ring-sparkle-accent/5 transition-all placeholder:text-white/20 shadow-sm"
                            />
                        </div>

                        {projectTypes.length > 0 && (
                            <div className="relative min-w-[180px] group/filter">
                                <Filter className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30 pointer-events-none group-focus-within/filter:text-sparkle-accent transition-colors" size={16} />
                                <select
                                    value={filterType}
                                    onChange={(e) => setFilterType(e.target.value)}
                                    className="w-full appearance-none bg-sparkle-card border border-white/10 rounded-2xl py-3 pl-11 pr-10 text-sm text-white focus:outline-none focus:border-sparkle-accent/50 focus:ring-4 focus:ring-sparkle-accent/5 transition-all cursor-pointer shadow-sm"
                                >
                                    <option value="all">All Types</option>
                                    {projectTypes.map(type => {
                                        const typeInfo = getProjectTypeById(type)
                                        return (
                                            <option key={type} value={type}>
                                                {typeInfo?.displayName || type}
                                            </option>
                                        )
                                    })}
                                </select>
                            </div>
                        )}
                    </div>

                    {/* View Toggles */}
                    <div className="flex items-center gap-2">
                        {/* View Mode Toggle */}
                        <div className="flex items-center gap-1.5 bg-sparkle-card p-1.5 rounded-2xl border border-white/10 shadow-sm">
                            {[
                                { id: 'grid', icon: LayoutGrid },
                                { id: 'detailed', icon: AlignJustify },
                                { id: 'list', icon: List }
                            ].map(({ id, icon: Icon }) => (
                                <button
                                    key={id}
                                    onClick={() => setViewMode(id as ViewMode)}
                                    className={cn(
                                        "p-2.5 rounded-xl transition-all duration-300",
                                        viewMode === id
                                            ? "bg-white/10 text-white shadow-inner scale-105"
                                            : "text-white/30 hover:text-white hover:bg-white/5"
                                    )}
                                >
                                    <Icon size={18} />
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
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
                    <RefreshCw size={24} className="text-yellow-400 animate-spin" />
                </div>
            )}

            {/* Content */}
            {!loading && (
                <div className="space-y-8">
                    {/* Folders */}
                    {filteredFolders.length > 0 && (
                        <div>
                            <div className="flex items-center gap-3 mb-4">
                                <Folder size={18} className="text-yellow-400/70" />
                                <h2 className="text-sm font-medium text-white/60">Folders</h2>
                                <span className="text-xs text-white/30">{filteredFolders.length}</span>
                                <div className="h-px bg-white/5 flex-1" />
                            </div>
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2">
                                {filteredFolders.map((folder) => (
                                    <button
                                        key={folder.path}
                                        onClick={() => handleFolderClick(folder)}
                                        className="flex items-center gap-2 p-2.5 bg-sparkle-card/50 rounded-lg border border-white/5 hover:border-white/20 hover:bg-white/5 transition-all text-left group"
                                    >
                                        <Folder size={16} className="text-yellow-400/70 group-hover:text-yellow-400 transition-colors flex-shrink-0" />
                                        <span className="text-sm text-white/70 truncate group-hover:text-white transition-colors">{folder.name}</span>
                                        <ChevronRight size={12} className="text-white/20 group-hover:text-white/60 ml-auto flex-shrink-0 transition-colors" />
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Git Repos as Folders (when toggle is OFF) */}
                    {gitRepos.length > 0 && (
                        <div>
                            <div className="flex items-center gap-3 mb-4">
                                <Github size={18} className="text-white/70" />
                                <h2 className="text-sm font-medium text-white/60">Git Repositories</h2>
                                <span className="text-xs text-white/30">{gitRepos.length}</span>
                                <div className="h-px bg-white/5 flex-1" />
                            </div>
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2">
                                {gitRepos.map((repo) => (
                                    <button
                                        key={repo.path}
                                        onClick={() => handleFolderClick({ name: repo.name, path: repo.path, isProject: true })}
                                        className="flex items-center gap-2 p-2.5 bg-white/5 rounded-lg border border-white/10 hover:border-white/30 hover:bg-white/10 transition-all text-left group relative"
                                    >
                                        <div className="p-1.5 rounded-md bg-white/10 flex-shrink-0">
                                            <Github size={16} className="text-white" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <span className="text-sm text-white font-medium truncate block">{repo.name}</span>
                                            <span className="text-[10px] text-white/40 uppercase tracking-wide">Git Repo</span>
                                        </div>
                                        <ChevronRight size={12} className="text-white/20 group-hover:text-white/60 ml-auto flex-shrink-0 transition-colors" />
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}


                    {/* Files */}
                    {filteredFiles.length > 0 && (
                        <div>
                            <div className="flex items-center gap-3 mb-4">
                                <File size={18} className="text-blue-400/70" />
                                <h2 className="text-sm font-medium text-white/60">Files</h2>
                                <span className="text-xs text-white/30">{filteredFiles.length}</span>
                                <div className="h-px bg-white/5 flex-1" />
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2">
                                {filteredFiles.map((file) => (
                                    <div
                                        key={file.path}
                                        onClick={() => openPreview(file, file.extension)}
                                        className="flex items-center gap-2.5 p-2.5 bg-sparkle-card/50 rounded-lg border border-white/5 hover:border-blue-400/30 hover:bg-blue-400/5 transition-all group cursor-pointer"
                                    >
                                        <div
                                            className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                                            style={{ backgroundColor: `${getFileColor(file.extension)}15` }}
                                        >
                                            {file.extension === 'md' || file.extension === 'txt' ? (
                                                <FileText size={16} style={{ color: getFileColor(file.extension) }} />
                                            ) : (
                                                <FileCode size={16} style={{ color: getFileColor(file.extension) }} />
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm text-white/80 truncate group-hover:text-white transition-colors">{file.name}</p>
                                            <p className="text-[10px] text-white/30">{formatFileSize(file.size)}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Projects */}
                    {displayedProjects.length > 0 && (
                        <div>
                            <div className="flex items-center gap-3 mb-4">
                                <Code size={18} className="text-sparkle-accent" />
                                <h2 className="text-sm font-medium text-white/60">Projects</h2>
                                <span className="text-xs text-white/30">{displayedProjects.length}</span>
                                <div className="h-px bg-white/5 flex-1" />
                            </div>

                            <div className={cn(
                                "grid gap-4",
                                viewMode === 'grid' && "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4",
                                viewMode === 'detailed' && "grid-cols-1 md:grid-cols-2",
                                viewMode === 'list' && "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
                            )}>
                                {displayedProjects.map((project) => {
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
                                                <>
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

                                                    <div className="relative z-10 flex-1">
                                                        <h3 className="font-bold text-white text-lg mb-1 group-hover:text-white/90 transition-colors truncate">
                                                            {project.name}
                                                        </h3>
                                                        <p className="text-xs text-white/40 mb-3">
                                                            {typeInfo?.displayName || project.type}
                                                        </p>

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
                                                            </div>
                                                        )}
                                                    </div>

                                                    <div className="flex items-center gap-2 relative z-10">
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); window.devscope.openInExplorer?.(project.path) }}
                                                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-sparkle-border-secondary text-sparkle-text-secondary hover:text-sparkle-text rounded-lg transition-colors"
                                                        >
                                                            <ExternalLink size={14} />
                                                            <span>Open</span>
                                                        </button>
                                                    </div>

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
                    {filteredProjects.length === 0 && filteredFolders.length === 0 && filteredFiles.length === 0 && !error && (
                        <div className="flex flex-col items-center justify-center py-16 bg-sparkle-card rounded-xl border border-sparkle-border">
                            <FileCode size={48} className="text-sparkle-text-muted mb-4" />
                            <h3 className="text-lg font-medium text-sparkle-text mb-2">
                                {searchQuery ? 'No Matching Items' : 'Empty Folder'}
                            </h3>
                            <p className="text-sparkle-text-secondary text-center max-w-md">
                                {searchQuery
                                    ? 'Try adjusting your search criteria.'
                                    : 'This folder does not contain any projects or subfolders.'}
                            </p>
                        </div>
                    )}
                </div>
            )}

            {/* File Preview Modal */}
            {previewFile && (
                <FilePreviewModal
                    file={previewFile}
                    content={previewContent}
                    loading={loadingPreview}
                    truncated={previewTruncated}
                    size={previewSize}
                    previewBytes={previewBytes}
                    onClose={closePreview}
                />
            )}
        </div>
    )
}




