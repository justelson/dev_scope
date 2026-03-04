/**
 * DevScope - Projects Page
 * Refactored into controller + presentational sections.
 */

import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { FolderTree, Folder, Settings, AlertCircle, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { PromptModal } from '@/components/ui/PromptModal'
import { useSettings } from '@/lib/settings'
import { ProjectsStatsModal, type StatsModalKey } from './projects/ProjectsStatsModal'
import { ProjectsHeader } from './projects/ProjectsHeader'
import { ProjectsToolbar } from './projects/ProjectsToolbar'
import { ProjectsContentSections } from './projects/ProjectsContentSections'
import { useProjectsController } from './projects/useProjectsController'
import { getProjectTypeById, formatRelativeTime, type Project } from './projects/projectsTypes'

export default function Projects() {
    const { settings, updateSettings } = useSettings()
    const navigate = useNavigate()
    const controller = useProjectsController(settings, updateSettings, navigate)
    const [renameTarget, setRenameTarget] = useState<Project | null>(null)
    const [renameDraft, setRenameDraft] = useState('')
    const [renameErrorMessage, setRenameErrorMessage] = useState<string | null>(null)
    const [deleteTarget, setDeleteTarget] = useState<Project | null>(null)
    const [toast, setToast] = useState<{ message: string; visible: boolean; tone?: 'success' | 'error' } | null>(null)

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

    const handleProjectRename = useCallback((project: Project) => {
        setRenameTarget(project)
        setRenameDraft(project.name)
        setRenameErrorMessage(null)
    }, [])

    const submitProjectRename = useCallback(async () => {
        if (!renameTarget) return
        const normalizedNextName = renameDraft.trim()
        if (!normalizedNextName) {
            setRenameErrorMessage('Name cannot be empty.')
            return
        }
        if (normalizedNextName === renameTarget.name) {
            setRenameTarget(null)
            setRenameDraft('')
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
        setRenameErrorMessage(null)
        controller.clearSearch()
        showToast(`Renamed project to ${normalizedNextName}`)
        await controller.loadProjects()
    }, [controller, renameDraft, renameTarget, showToast])

    const handleProjectDelete = useCallback((project: Project) => {
        setDeleteTarget(project)
    }, [])

    const confirmProjectDelete = useCallback(async () => {
        if (!deleteTarget) return
        const result = await window.devscope.deleteFileSystemItem(deleteTarget.path)
        if (!result.success) {
            showToast(result.error || `Failed to delete "${deleteTarget.name}"`, 'error')
            return
        }

        setDeleteTarget(null)
        controller.clearSearch()
        showToast(`Deleted ${deleteTarget.name}`)
        await controller.loadProjects()
    }, [controller, deleteTarget, showToast])

    if (!controller.hasLoadedOnce && controller.showBlockingLoader) {
        return (
            <div className="flex items-center justify-center min-h-[50vh]">
                <div className="flex flex-col items-center gap-4">
                    <RefreshCw className="animate-spin text-sparkle-accent" size={32} />
                    <p className="text-sparkle-text-secondary">Scanning projects...</p>
                </div>
            </div>
        )
    }

    if (controller.error) {
        return (
            <div className="flex items-center justify-center min-h-[50vh]">
                <div className="flex flex-col items-center gap-4 text-red-400">
                    <AlertCircle size={32} />
                    <p>{controller.error}</p>
                    <button
                        onClick={controller.loadProjects}
                        className="px-4 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-white text-sm transition-colors"
                    >
                        Retry
                    </button>
                </div>
            </div>
        )
    }

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
                    <p className="text-sparkle-text-secondary">Your coding projects in one place</p>
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

    const searchResultsCount = controller.searchResults
        ? controller.searchResults.projects.length + controller.searchResults.folders.length + controller.searchResults.files.length
        : 0

    return (
        <div className="max-w-[1600px] mx-auto animate-fadeIn pb-20">
            <ProjectsHeader
                totalProjects={controller.totalProjects}
                loading={controller.loading}
                projectsFolder={settings.projectsFolder}
                additionalFoldersCount={settings.additionalFolders?.length || 0}
                statChips={controller.statChips}
                onRefresh={controller.loadProjects}
                onOpenStats={(key) => controller.setStatsModal(key as StatsModalKey)}
            />

            <ProjectsToolbar
                searchQuery={controller.searchQuery}
                setSearchQuery={controller.setSearchQuery}
                clearSearch={controller.clearSearch}
                isSearching={controller.isSearching}
                filterType={controller.filterType}
                setFilterType={controller.setFilterType}
                projectTypes={controller.projectTypes}
                getProjectTypeLabel={(type) => getProjectTypeById(type)?.displayName || type}
                getProjectTypeColor={(type) => getProjectTypeById(type)?.themeColor}
                showHiddenFiles={controller.showHiddenFiles}
                setShowHiddenFiles={controller.setShowHiddenFiles}
                viewMode={controller.viewMode}
                setViewMode={controller.setViewMode}
                contentLayout={controller.contentLayout}
                setContentLayout={controller.setContentLayout}
                hasSearchResults={Boolean(controller.searchResults)}
                searchResultsCount={searchResultsCount}
            />

            {controller.loading ? (
                <div className="flex items-center justify-center py-16">
                    <RefreshCw size={24} className="text-[var(--accent-primary)] animate-spin" />
                </div>
            ) : (
                <ProjectsContentSections
                    plainFolders={controller.plainFolders}
                    gitRepos={controller.gitRepos}
                    filteredProjects={controller.filteredProjects}
                    filteredFiles={controller.filteredFiles}
                    viewMode={controller.viewMode}
                    contentLayout={controller.contentLayout}
                    formatRelativeTime={formatRelativeTime}
                    getProjectTypeLabel={(type) => getProjectTypeById(type)?.displayName || type}
                    getProjectThemeColor={(type) => getProjectTypeById(type)?.themeColor || '#525252'}
                    onFolderOpen={controller.handleFolderBrowse}
                    onProjectOpen={controller.handleProjectClick}
                    onProjectRename={handleProjectRename}
                    onProjectDelete={handleProjectDelete}
                    onFileParentOpen={controller.handleFolderBrowse}
                    openInExplorer={(path) => {
                        void window.devscope.openInExplorer?.(path)
                    }}
                    searchActive={Boolean(controller.searchQuery)}
                    filterActive={controller.filterType !== 'all'}
                />
            )}

            <ProjectsStatsModal
                statsModal={controller.statsModal}
                modalTitle={controller.modalTitle}
                modalCount={controller.modalCount}
                projectsModalQuery={controller.projectsModalQuery}
                setProjectsModalQuery={controller.setProjectsModalQuery}
                filteredModalProjects={controller.filteredModalProjects}
                modalFrameworks={controller.modalFrameworks}
                modalTypes={controller.modalTypes}
                onClose={() => controller.setStatsModal(null)}
                onProjectClick={controller.handleProjectClick}
                onProjectRename={handleProjectRename}
                onProjectDelete={handleProjectDelete}
                getProjectTypeLabel={(type) => getProjectTypeById(type)?.displayName || type}
                onOpenInExplorer={(path) => window.devscope.openInExplorer?.(path)}
            />

            <PromptModal
                isOpen={Boolean(renameTarget)}
                title="Rename Project"
                message={renameTarget ? `Rename "${renameTarget.name}"` : ''}
                value={renameDraft}
                onChange={(value) => {
                    setRenameDraft(value)
                    if (renameErrorMessage) setRenameErrorMessage(null)
                }}
                onConfirm={() => { void submitProjectRename() }}
                onCancel={() => {
                    setRenameTarget(null)
                    setRenameDraft('')
                    setRenameErrorMessage(null)
                }}
                confirmLabel="Rename"
                placeholder="Enter new project name"
                errorMessage={renameErrorMessage}
            />

            <ConfirmModal
                isOpen={Boolean(deleteTarget)}
                title="Delete Project?"
                message={deleteTarget
                    ? `Are you sure you want to delete "${deleteTarget.name}" from disk? This action cannot be undone.`
                    : ''}
                confirmLabel="Delete"
                onConfirm={() => { void confirmProjectDelete() }}
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
