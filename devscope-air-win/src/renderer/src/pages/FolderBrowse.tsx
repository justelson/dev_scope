/**
 * DevScope - Folder Browse Page
 * Browse folder contents with same layout as Projects main page
 */

import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import { AlertCircle, RefreshCw } from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'
import { fileNameMatchesQuery, parseFileSearchQuery } from '@/lib/utils'
import { cn } from '@/lib/utils'
import { useTerminal } from '@/App'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { FilePreviewModal, useFilePreview } from '@/components/ui/FilePreviewModal'
import { PromptModal } from '@/components/ui/PromptModal'
import { openAssistantDock } from '@/lib/assistantDockStore'
import { trackRecentProject } from '@/lib/recentProjects'
import { useSettings } from '@/lib/settings'
import { FolderBrowseContent } from './folder-browse/FolderBrowseContent'
import { FolderBrowseHeader } from './folder-browse/FolderBrowseHeader'
import { FolderBrowseToolbar } from './folder-browse/FolderBrowseToolbar'
import type { FileItem, FolderItem, Project } from './folder-browse/types'
import { formatFileSize, formatRelativeTime, getFileColor, getProjectTypes } from './folder-browse/utils'

const FILES_PAGE_SIZE = 300

type FileSystemClipboardItem = {
    path: string
    name: string
    type: 'file' | 'directory'
}

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

function splitFileNameForRename(name: string): { baseName: string; extensionSuffix: string } {
    const raw = String(name || '')
    const dotIndex = raw.lastIndexOf('.')
    if (dotIndex <= 0 || dotIndex === raw.length - 1) {
        return { baseName: raw, extensionSuffix: '' }
    }
    return {
        baseName: raw.slice(0, dotIndex),
        extensionSuffix: raw.slice(dotIndex)
    }
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
    const [fileClipboardItem, setFileClipboardItem] = useState<FileSystemClipboardItem | null>(null)
    const [renameTarget, setRenameTarget] = useState<FileSystemClipboardItem | null>(null)
    const [renameDraft, setRenameDraft] = useState('')
    const [renameExtensionSuffix, setRenameExtensionSuffix] = useState('')
    const [renameErrorMessage, setRenameErrorMessage] = useState<string | null>(null)
    const [deleteTarget, setDeleteTarget] = useState<FileSystemClipboardItem | null>(null)
    const [toast, setToast] = useState<{ message: string; visible: boolean; tone?: 'success' | 'error' } | null>(null)

    const {
        previewFile,
        previewContent,
        loadingPreview,
        previewTruncated,
        previewSize,
        previewBytes,
        previewModifiedAt,
        openPreview,
        closePreview
    } = useFilePreview()

    const loadContents = useCallback(async (forceRefresh: boolean = false) => {
        if (!decodedPath) return

        setLoading(true)
        setError(null)
        await yieldToBrowserPaint()

        try {
            const result = await window.devscope.scanProjects(decodedPath, { forceRefresh })
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
        loadContents(false)
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

    const showToast = useCallback((message: string, tone: 'success' | 'error' = 'success') => {
        setToast({ message, visible: false, tone })
        window.setTimeout(() => {
            setToast((current) => current ? { ...current, visible: true } : current)
        }, 8)
    }, [])

    useEffect(() => {
        if (!toast?.visible) return
        const hideTimer = window.setTimeout(() => {
            setToast((current) => current ? { ...current, visible: false } : current)
        }, 2200)
        const removeTimer = window.setTimeout(() => {
            setToast(null)
        }, 2600)
        return () => {
            window.clearTimeout(hideTimer)
            window.clearTimeout(removeTimer)
        }
    }, [toast?.visible])

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

    const copyTextToClipboard = useCallback(async (value: string): Promise<boolean> => {
        try {
            if (window.devscope.copyToClipboard) {
                const result = await window.devscope.copyToClipboard(value)
                if (!result.success) {
                    setError(result.error || 'Failed to copy to clipboard')
                    return false
                }
            } else {
                await navigator.clipboard.writeText(value)
            }
            return true
        } catch (err: any) {
            setError(err?.message || 'Failed to copy to clipboard')
            return false
        }
    }, [])

    const handleCopyPath = useCallback(async () => {
        if (!decodedPath.trim()) return
        const copied = await copyTextToClipboard(decodedPath)
        setCopiedPath(copied)
        if (copied) {
            showToast('Copied folder path')
            window.setTimeout(() => setCopiedPath(false), 1500)
        }
    }, [decodedPath, copyTextToClipboard, showToast])

    const handleEntryOpen = useCallback(async (entry: FileSystemClipboardItem) => {
        if (entry.type === 'directory') {
            navigate(`/folder-browse/${encodeURIComponent(entry.path)}`)
            return
        }
        const result = await window.devscope.openFile(entry.path)
        if (!result.success) {
            setError(result.error || `Failed to open "${entry.name}"`)
        }
    }, [navigate])

    const handleEntryOpenWith = useCallback(async (entry: FileSystemClipboardItem) => {
        if (entry.type === 'directory') return
        const result = await window.devscope.openWith(entry.path)
        if (!result.success) {
            setError(result.error || `Failed to open "${entry.name}" with...`)
        }
    }, [])

    const handleEntryOpenInExplorer = useCallback(async (entry: FileSystemClipboardItem) => {
        const result = await window.devscope.openInExplorer(entry.path)
        if (!result.success) {
            setError(result.error || `Failed to open "${entry.name}" in explorer`)
        }
    }, [])

    const handleEntryCopyPath = useCallback(async (entry: FileSystemClipboardItem) => {
        const copied = await copyTextToClipboard(entry.path)
        if (copied) showToast(`Copied path: ${entry.name}`)
    }, [copyTextToClipboard, showToast])

    const handleEntryCopy = useCallback((entry: FileSystemClipboardItem) => {
        setFileClipboardItem({
            path: entry.path,
            name: entry.name,
            type: entry.type
        })
        setError(null)
        showToast(`Copied ${entry.type === 'directory' ? 'folder' : 'file'}: ${entry.name}`)
    }, [showToast])

    const handleEntryRename = useCallback(async (entry: FileSystemClipboardItem) => {
        const splitName = entry.type === 'file'
            ? splitFileNameForRename(entry.name)
            : { baseName: entry.name, extensionSuffix: '' }
        setRenameTarget(entry)
        setRenameDraft(splitName.baseName)
        setRenameExtensionSuffix(splitName.extensionSuffix)
        setRenameErrorMessage(null)
    }, [])

    const handleEntryDelete = useCallback(async (entry: FileSystemClipboardItem) => {
        setDeleteTarget(entry)
    }, [])

    const handleEntryPaste = useCallback(async (entry: FileSystemClipboardItem) => {
        if (!fileClipboardItem) return

        const destinationDirectory = entry.type === 'directory'
            ? entry.path
            : getParentFolderPath(entry.path)

        if (!destinationDirectory) {
            setError('Unable to resolve destination folder for paste.')
            return
        }

        const result = await window.devscope.pasteFileSystemItem(fileClipboardItem.path, destinationDirectory)
        if (!result.success) {
            setError(result.error || `Failed to paste "${fileClipboardItem.name}"`)
            return
        }

        showToast(`Pasted ${fileClipboardItem.name}`)
        await loadContents(true)
    }, [fileClipboardItem, loadContents, showToast])

    const submitRenameTarget = useCallback(async () => {
        if (!renameTarget) return

        const normalizedBaseName = renameDraft.trim()
        if (!normalizedBaseName) {
            setRenameErrorMessage('Name cannot be empty.')
            return
        }
        const normalizedNextName = renameTarget.type === 'file'
            ? `${normalizedBaseName}${renameExtensionSuffix}`
            : normalizedBaseName
        if (normalizedNextName === renameTarget.name) {
            setRenameTarget(null)
            setRenameDraft('')
            setRenameExtensionSuffix('')
            setRenameErrorMessage(null)
            return
        }

        const result = await window.devscope.renameFileSystemItem(renameTarget.path, normalizedNextName)
        if (!result.success) {
            setRenameErrorMessage(result.error || `Failed to rename "${renameTarget.name}"`)
            return
        }

        setRenameTarget(null)
        setRenameDraft('')
        setRenameExtensionSuffix('')
        setRenameErrorMessage(null)
        showToast(`Renamed to ${normalizedNextName}`)
        await loadContents(true)
    }, [loadContents, renameDraft, renameExtensionSuffix, renameTarget, showToast])

    const confirmDeleteTarget = useCallback(async () => {
        if (!deleteTarget) return

        const result = await window.devscope.deleteFileSystemItem(deleteTarget.path)
        if (!result.success) {
            setError(result.error || `Failed to delete "${deleteTarget.name}"`)
            return
        }

        if (fileClipboardItem?.path === deleteTarget.path) {
            setFileClipboardItem(null)
        }

        setDeleteTarget(null)
        showToast(`Deleted ${deleteTarget.name}`)
        await loadContents(true)
    }, [deleteTarget, fileClipboardItem?.path, loadContents, showToast])

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
                onRefresh={() => { void loadContents(true) }}
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
                    onEntryOpen={handleEntryOpen}
                    onEntryOpenWith={handleEntryOpenWith}
                    onEntryOpenInExplorer={handleEntryOpenInExplorer}
                    onEntryCopyPath={handleEntryCopyPath}
                    onEntryCopy={handleEntryCopy}
                    onEntryRename={handleEntryRename}
                    onEntryDelete={handleEntryDelete}
                    onEntryPaste={handleEntryPaste}
                    hasFileClipboardItem={Boolean(fileClipboardItem)}
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
                    modifiedAt={previewModifiedAt}
                    projectPath={decodedPath}
                    onSaved={async () => {
                        await loadContents(true)
                    }}
                    onClose={closePreview}
                />
            )}

            <PromptModal
                isOpen={Boolean(renameTarget)}
                title="Rename Item"
                message={renameTarget
                    ? renameTarget.type === 'file'
                        ? `Rename "${renameTarget.name}" (file extension is locked for safety)`
                        : `Rename "${renameTarget.name}"`
                    : ''}
                value={renameDraft}
                onChange={(value) => {
                    setRenameDraft(value)
                    if (renameErrorMessage) setRenameErrorMessage(null)
                }}
                onConfirm={() => { void submitRenameTarget() }}
                onCancel={() => {
                    setRenameTarget(null)
                    setRenameDraft('')
                    setRenameExtensionSuffix('')
                    setRenameErrorMessage(null)
                }}
                confirmLabel="Rename"
                placeholder="Enter new name"
                valueSuffix={renameTarget?.type === 'file' ? renameExtensionSuffix : ''}
                errorMessage={renameErrorMessage}
            />
            <ConfirmModal
                isOpen={Boolean(deleteTarget)}
                title="Delete Item?"
                message={deleteTarget ? `Are you sure you want to delete "${deleteTarget.name}"? This action cannot be undone.` : ''}
                confirmLabel="Delete"
                onConfirm={() => { void confirmDeleteTarget() }}
                onCancel={() => setDeleteTarget(null)}
                variant="danger"
                fullscreen
            />

            {toast && (
                <div
                    className={cn(
                        'fixed bottom-4 right-4 z-[120] max-w-sm rounded-xl px-4 py-3 text-sm shadow-lg backdrop-blur-md transition-all duration-300',
                        toast.tone === 'error'
                            ? 'border border-red-500/30 bg-red-500/10 text-red-200'
                            : 'border border-emerald-500/30 bg-emerald-500/10 text-emerald-200',
                        toast.visible ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0 pointer-events-none'
                    )}
                >
                    {toast.message}
                </div>
            )}
        </div>
    )
}
