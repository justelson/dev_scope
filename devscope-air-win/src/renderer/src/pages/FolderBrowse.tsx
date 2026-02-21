/**
 * DevScope - Folder Browse Page
 * Browse folder contents with same layout as Projects main page
 */

import { useCallback, useDeferredValue, useEffect, useMemo, useState } from 'react'
import { AlertCircle, RefreshCw } from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'
import { fileNameMatchesQuery, parseFileSearchQuery } from '@/lib/utils'
import { FilePreviewModal, useFilePreview } from '@/components/ui/FilePreviewModal'
import { trackRecentProject } from '@/lib/recentProjects'
import { FolderBrowseContent } from './folder-browse/FolderBrowseContent'
import { FolderBrowseHeader } from './folder-browse/FolderBrowseHeader'
import { FolderBrowseToolbar } from './folder-browse/FolderBrowseToolbar'
import type { FileItem, FolderItem, Project, ViewMode } from './folder-browse/types'
import { formatFileSize, formatRelativeTime, getFileColor, getProjectTypes } from './folder-browse/utils'

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
    const [searchQuery, setSearchQuery] = useState('')
    const deferredSearchQuery = useDeferredValue(searchQuery)
    const [filterType, setFilterType] = useState('all')
    const [viewMode, setViewMode] = useState<ViewMode>('grid')
    const [isCurrentFolderGitRepo, setIsCurrentFolderGitRepo] = useState(false)

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

    useEffect(() => {
        loadContents()
    }, [loadContents])

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

    const handleProjectClick = (project: Project) => {
        navigate(`/projects/${encodeURIComponent(project.path)}`)
    }

    const handleFolderClick = (folder: FolderItem) => {
        navigate(`/folder-browse/${encodeURIComponent(folder.path)}`)
    }

    const handleViewAsProject = () => {
        navigate(`/projects/${encodeURIComponent(decodedPath)}`)
    }

    return (
        <div className="max-w-[1600px] mx-auto animate-fadeIn pb-20">
            <FolderBrowseHeader
                folderName={folderName}
                decodedPath={decodedPath}
                totalProjects={projects.length}
                isCurrentFolderGitRepo={isCurrentFolderGitRepo}
                loading={loading}
                onBack={() => navigate(-1)}
                onViewAsProject={handleViewAsProject}
                onOpenInExplorer={() => window.devscope.openInExplorer?.(decodedPath)}
                onRefresh={loadContents}
            />

            <FolderBrowseToolbar
                searchQuery={searchQuery}
                filterType={filterType}
                projectTypes={projectTypes}
                viewMode={viewMode}
                onSearchQueryChange={setSearchQuery}
                onFilterTypeChange={setFilterType}
                onViewModeChange={setViewMode}
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
                    filteredFiles={filteredFiles}
                    displayedProjects={filteredProjects}
                    viewMode={viewMode}
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
