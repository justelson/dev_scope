/**
 * DevScope - Projects Page
 * Refactored into controller + presentational sections.
 */

import { Link, useNavigate } from 'react-router-dom'
import { FolderTree, Folder, Settings, AlertCircle, RefreshCw } from 'lucide-react'
import { useSettings } from '@/lib/settings'
import { ProjectsStatsModal, type StatsModalKey } from './projects/ProjectsStatsModal'
import { ProjectsHeader } from './projects/ProjectsHeader'
import { ProjectsToolbar } from './projects/ProjectsToolbar'
import { ProjectsContentSections } from './projects/ProjectsContentSections'
import { useProjectsController } from './projects/useProjectsController'
import { getProjectTypeById, formatRelativeTime } from './projects/projectsTypes'

export default function Projects() {
    const { settings } = useSettings()
    const navigate = useNavigate()
    const controller = useProjectsController(settings, navigate)

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
                    formatRelativeTime={formatRelativeTime}
                    getProjectTypeLabel={(type) => getProjectTypeById(type)?.displayName || type}
                    getProjectThemeColor={(type) => getProjectTypeById(type)?.themeColor || '#525252'}
                    onFolderOpen={controller.handleFolderBrowse}
                    onProjectOpen={controller.handleProjectClick}
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
                getProjectTypeLabel={(type) => getProjectTypeById(type)?.displayName || type}
                onOpenInExplorer={(path) => window.devscope.openInExplorer?.(path)}
            />
        </div>
    )
}
