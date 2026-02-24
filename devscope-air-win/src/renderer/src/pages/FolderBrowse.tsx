/**
 * DevScope - Folder Browse Page
 * Browse folder contents with same layout as Projects main page
 */

import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import { AlertCircle, RefreshCw } from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'
import { fileNameMatchesQuery, parseFileSearchQuery } from '@/lib/utils'
import { useTerminal } from '@/App'
import { FilePreviewModal, useFilePreview } from '@/components/ui/FilePreviewModal'
import { openAssistantDock } from '@/lib/assistantDockStore'
import { trackRecentProject } from '@/lib/recentProjects'
import { useSettings } from '@/lib/settings'
import { FolderBrowseContent } from './folder-browse/FolderBrowseContent'
import { FolderBrowseHeader } from './folder-browse/FolderBrowseHeader'
import { FolderBrowseToolbar } from './folder-browse/FolderBrowseToolbar'
import type { FileItem, FolderItem, Project } from './folder-browse/types'
import { formatFileSize, formatRelativeTime, getFileColor, getProjectTypes } from './folder-browse/utils'

const FILES_PAGE_SIZE = 300

async function yieldToBrowserPaint(): Promise<void> {
    await new Promise<void>((resolve) => {
        if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
            window.requestAnimationFrame(() => resolve())
            return
        }
        setTimeout(resolve, 0)
    })
}

function getParentFolderPath(currentPath: string): string | null {
    const raw = String(currentPath || '').trim().replace(/\//g, '\\').replace(/[\\]+$/, '')
    if (!raw) return null

    if (/^[A-Za-z]:\\?$/.test(raw)) return null
    if (/^\\\\[^\\]+\\[^\\]+$/.test(raw)) return null

    const lastSepIndex = raw.lastIndexOf('\\')
    if (lastSepIndex < 0) return null

    const parent = raw.slice(0, lastSepIndex)
    if (!parent || parent === raw) return null

    if (/^[A-Za-z]:$/.test(parent)) {
        return `${parent}\\`
    }

    return parent
}

function normalizePath(path: string): string {
    const raw = String(path || '').trim().replace(/\//g, '\\')
    if (!raw) return ''
    if (/^[A-Za-z]:\\?$/.test(raw)) return `${raw.slice(0, 2)}\\`
    if (/^\\\\[^\\]+\\[^\\]+\\?$/.test(raw)) return raw.replace(/[\\]+$/, '')
    return raw.replace(/[\\]+$/, '')
}

function isPathWithinRoot(path: string, root: string): boolean {
    const normalizedPath = normalizePath(path).toLowerCase()
    const normalizedRoot = normalizePath(root).toLowerCase()
    if (!normalizedPath || !normalizedRoot) return false
    if (normalizedPath === normalizedRoot) return true
    return normalizedPath.startsWith(`${normalizedRoot}\\`)
}

function resolveNavigationRoot(path: string, roots: string[]): string | null {
    const normalizedPath = normalizePath(path)
    if (!normalizedPath) return null

    const matchingRoots = roots
        .map((root) => normalizePath(root))
        .filter((root) => root.length > 0)
        .filter((root) => isPathWithinRoot(normalizedPath, root))

    if (matchingRoots.length === 0) return null
    matchingRoots.sort((left, right) => right.length - left.length)
    return matchingRoots[0]
}

function getParentFolderPathWithinRoot(currentPath: string, rootLimit: string | null): string | null {
    const normalizedCurrentPath = normalizePath(currentPath)
    const normalizedRootLimit = normalizePath(rootLimit || '')

    if (!normalizedCurrentPath) return null
    if (normalizedRootLimit && normalizedCurrentPath.toLowerCase() === normalizedRootLimit.toLowerCase()) return null

    const parent = getParentFolderPath(normalizedCurrentPath)
    if (!parent) return null

    if (!normalizedRootLimit) {
        return parent
    }

    if (!isPathWithinRoot(parent, normalizedRootLimit)) {
        return null
    }

    return parent
}

export default function FolderBrowse() {
    const { settings, updateSettings } = useSettings()
    const { openTerminal } = useTerminal()
    const { folderPath } = useParams<{ folderPath: string }>()
    const navigate = useNavigate()

    const decodedPath = folderPath ? decodeURIComponent(folderPath) : ''
    const folderName = decodedPath.split(/[/\\]/).pop() || 'Folder'
    const folderHistoryRef = useRef<string[]>([])
    const configuredBrowseRoots = useMemo(() => (
        Array.from(new Set([
            settings.projectsFolder,
            ...(settings.additionalFolders || [])
        ].filter((path): path is string => typeof path === 'string' && path.trim().length > 0)))
    ), [settings.projectsFolder, settings.additionalFolders])
    const navigationRoot = useMemo(
        () => resolveNavigationRoot(decodedPath, configuredBrowseRoots),
        [decodedPath, configuredBrowseRoots]
    )
    const canNavigateUp = useMemo(
        () => Boolean(getParentFolderPathWithinRoot(decodedPath, navigationRoot)),
        [decodedPath, navigationRoot]
    )

    const [projects, setProjects] = useState<Project[]>([])
    const [folders, setFolders] = useState<FolderItem[]>([])
    const [files, setFiles] = useState<FileItem[]>([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [searchQuery, setSearchQuery] = useState('')
    const deferredSearchQuery = useDeferredValue(searchQuery)
    const [filterType, setFilterType] = useState('all')
    const [isCurrentFolderGitRepo, setIsCurrentFolderGitRepo] = useState(false)
    const [visibleFileCount, setVisibleFileCount] = useState(FILES_PAGE_SIZE)
    const [copiedPath, setCopiedPath] = useState(false)

    const {
        previewFile,
        previewContent,
        loadingPreview,
        previewTruncated,
        previewSize,
        previewBytes,
        openPreview,
        closePreview
    } = useFilePreview()

    const loadContents = useCallback(async () => {
        if (!decodedPath) return

        setLoading(true)
        setError(null)
        await yieldToBrowserPaint()

        try {
            const result = await window.devscope.scanProjects(decodedPath)
            if (!result.success) {
                setError(result.error || 'Failed to scan folder')
                return
            }

            setProjects(result.projects || [])
            setFolders(result.folders || [])
            setFiles(result.files || [])
        } catch (scanError: any) {
            setError(scanError.message || 'Failed to scan folder')
        } finally {
            setLoading(false)
        }
    }, [decodedPath])

    useEffect(() => {
        const checkGitRepo = async () => {
            if (!decodedPath) return
            try {
                const result = await window.devscope.checkIsGitRepo(decodedPath)
                const isRepo = result?.success ? result.isGitRepo === true : false
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

    useEffect(() => {
        loadContents()
    }, [loadContents])

    useEffect(() => {
        if (!decodedPath) return

        const history = folderHistoryRef.current
        const existingIndex = history.lastIndexOf(decodedPath)

        if (existingIndex >= 0) {
            folderHistoryRef.current = history.slice(0, existingIndex + 1)
            return
        }

        history.push(decodedPath)
    }, [decodedPath])

    useEffect(() => {
        setCopiedPath(false)
    }, [decodedPath])

    const parsedSearchQuery = useMemo(
        () => parseFileSearchQuery(deferredSearchQuery),
        [deferredSearchQuery]
    )

    const projectTypes = useMemo(() => getProjectTypes(projects), [projects])

    const filteredProjects = useMemo(() => {
        if (parsedSearchQuery.hasExtensionFilter) return []

        return projects.filter((project) => {
            if (project.type === 'git') return false
            const matchesSearch = !parsedSearchQuery.term || project.name.toLowerCase().includes(parsedSearchQuery.term)
            const matchesType = filterType === 'all' || project.type === filterType
            return matchesSearch && matchesType
        })
    }, [projects, parsedSearchQuery, filterType])

    const filteredFolders = useMemo(() => {
        if (deferredSearchQuery) return []
        return [...folders].sort((left, right) => left.name.localeCompare(right.name))
    }, [folders, deferredSearchQuery])

    const gitRepos = useMemo(() => projects.filter((project) => project.type === 'git'), [projects])

    const filteredFiles = useMemo(() => {
        if (!deferredSearchQuery) return files
        return files.filter((file) => fileNameMatchesQuery(file.name, parsedSearchQuery))
    }, [files, deferredSearchQuery, parsedSearchQuery])

    useEffect(() => {
        setVisibleFileCount(FILES_PAGE_SIZE)
    }, [decodedPath, deferredSearchQuery, files.length])

    const displayedFiles = useMemo(
        () => filteredFiles.slice(0, visibleFileCount),
        [filteredFiles, visibleFileCount]
    )

    const hasMoreFiles = displayedFiles.length < filteredFiles.length

    const loadMoreFiles = useCallback(() => {
        setVisibleFileCount((current) => current + FILES_PAGE_SIZE)
    }, [])

    const handleProjectClick = (project: Project) => {
        navigate(`/projects/${encodeURIComponent(project.path)}`)
    }

    const handleFolderClick = (folder: FolderItem) => {
        navigate(`/folder-browse/${encodeURIComponent(folder.path)}`)
    }

    const handleViewAsProject = () => {
        navigate(`/projects/${encodeURIComponent(decodedPath)}`)
    }

    const handleBack = () => {
        const history = folderHistoryRef.current
        if (history.length > 1) {
            history.pop()
            while (history.length > 0) {
                const previousFolder = history[history.length - 1]
                if (!navigationRoot || isPathWithinRoot(previousFolder, navigationRoot)) {
                    navigate(`/folder-browse/${encodeURIComponent(previousFolder)}`)
                    return
                }
                history.pop()
            }
        }

        const parentPath = getParentFolderPathWithinRoot(decodedPath, navigationRoot)
        if (parentPath && parentPath !== decodedPath) {
            navigate(`/folder-browse/${encodeURIComponent(parentPath)}`)
            return
        }

        navigate(-1)
    }

    const handleNavigateUp = () => {
        const parentPath = getParentFolderPathWithinRoot(decodedPath, navigationRoot)
        if (!parentPath || parentPath === decodedPath) {
            return
        }
        navigate(`/folder-browse/${encodeURIComponent(parentPath)}`)
    }

    const handleCopyPath = useCallback(async () => {
        if (!decodedPath.trim()) return
        try {
            if (window.devscope.copyToClipboard) {
                await window.devscope.copyToClipboard(decodedPath)
            } else {
                await navigator.clipboard.writeText(decodedPath)
            }
            setCopiedPath(true)
            window.setTimeout(() => setCopiedPath(false), 1500)
        } catch {
            setCopiedPath(false)
        }
    }, [decodedPath])

    return (
        <div className="max-w-[1600px] mx-auto animate-fadeIn pb-20">
            <FolderBrowseHeader
                folderName={folderName}
                decodedPath={decodedPath}
                totalProjects={projects.length}
                isCurrentFolderGitRepo={isCurrentFolderGitRepo}
                loading={loading}
                onBack={handleBack}
                onNavigateUp={handleNavigateUp}
                canNavigateUp={canNavigateUp}
                onViewAsProject={handleViewAsProject}
                onOpenTerminal={() => openTerminal({ displayName: folderName, id: 'main', category: 'folder' }, decodedPath)}
                onOpenAssistant={() => openAssistantDock({ contextPath: decodedPath })}
                onCopyPath={handleCopyPath}
                copiedPath={copiedPath}
                onOpenInExplorer={() => window.devscope.openInExplorer?.(decodedPath)}
                onRefresh={loadContents}
            />

            <FolderBrowseToolbar
                searchQuery={searchQuery}
                filterType={filterType}
                projectTypes={projectTypes}
                viewMode={settings.browserViewMode}
                contentLayout={settings.browserContentLayout}
                onSearchQueryChange={setSearchQuery}
                onFilterTypeChange={setFilterType}
                onViewModeChange={(value) => updateSettings({ browserViewMode: value })}
                onContentLayoutChange={(value) => updateSettings({ browserContentLayout: value })}
            />

            {error && (
                <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-xl flex items-center gap-3">
                    <AlertCircle size={20} className="text-red-400" />
                    <span className="text-red-300">{error}</span>
                </div>
            )}

            {loading && (
                <div className="flex items-center justify-center py-16">
                    <RefreshCw size={24} className="text-yellow-400 animate-spin" />
                </div>
            )}

            {!loading && (
                <FolderBrowseContent
                    filteredFolders={filteredFolders}
                    gitRepos={gitRepos}
                    visibleFiles={displayedFiles}
                    totalFilteredFiles={filteredFiles.length}
                    hasMoreFiles={hasMoreFiles}
                    onLoadMoreFiles={loadMoreFiles}
                    displayedProjects={filteredProjects}
                    viewMode={settings.browserViewMode}
                    contentLayout={settings.browserContentLayout}
                    searchQuery={searchQuery}
                    error={error}
                    onFolderClick={handleFolderClick}
                    onProjectClick={handleProjectClick}
                    onOpenFilePreview={(file) => openPreview(file, file.extension)}
                    onOpenProjectInExplorer={(path) => window.devscope.openInExplorer?.(path)}
                    formatFileSize={formatFileSize}
                    getFileColor={getFileColor}
                    formatRelativeTime={formatRelativeTime}
                />
            )}

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
