import { Link, useNavigate } from 'react-router-dom'
import { FolderTree, GitBranch, GitCommitHorizontal, RefreshCw, Upload, Wrench } from 'lucide-react'
import { useSettings } from '@/lib/settings'
import { cn } from '@/lib/utils'
import { ProjectListSection } from './home/HomeProjectList'
import { SummaryCard, ListSkeleton } from './home/HomeSummary'
import { getProjectRoute } from './home/homeUtils'
import type { ProjectOverviewItem } from './home/types'
import { useHomeOverview } from './home/useHomeOverview'

export default function Home() {
    const navigate = useNavigate()
    const { settings } = useSettings()
    const overview = useHomeOverview(settings)

    const openProject = (project: ProjectOverviewItem) => {
        navigate(getProjectRoute(project))
    }

    if (!settings.projectsFolder && (!settings.additionalFolders || settings.additionalFolders.length === 0)) {
        return (
            <div className="max-w-[1400px] mx-auto pb-10 animate-fadeIn">
                <div className="mb-6">
                    <h1 className="text-3xl font-bold text-sparkle-text mb-2">Home</h1>
                    <p className="text-sparkle-text-secondary">Configure project roots to enable cross-project Git overview.</p>
                </div>
                <div className="rounded-xl border border-sparkle-border bg-sparkle-card p-6 flex items-center justify-between gap-4">
                    <div>
                        <h2 className="text-lg font-semibold text-sparkle-text">No project roots configured</h2>
                        <p className="text-sm text-sparkle-text-secondary mt-1">Set `Projects Folder` and optional additional folders first.</p>
                    </div>
                    <Link
                        to="/settings/projects"
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--accent-primary)] text-white hover:bg-[var(--accent-primary)]/90 transition-colors"
                    >
                        <Wrench size={16} />
                        <span>Open Settings</span>
                    </Link>
                </div>
            </div>
        )
    }

    return (
        <div className="max-w-[1500px] mx-auto pb-14 animate-fadeIn">
            <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
                <div>
                    <h1 className="text-3xl font-bold text-sparkle-text mb-2">Home</h1>
                    <p className="text-sparkle-text-secondary">Project-first Git overview across all configured roots.</p>
                </div>
                <div className="flex items-center gap-3 text-xs text-sparkle-text-secondary">
                    <span>Last refresh: {overview.lastRefreshAt ? new Date(overview.lastRefreshAt).toLocaleTimeString() : 'pending'}</span>
                    {overview.gitOverviewLoading && (
                        <span className="inline-flex items-center rounded-full border border-amber-500/30 bg-amber-500/15 px-2 py-1 text-[11px] font-medium text-amber-300">
                            Loading Git data
                        </span>
                    )}
                    <button
                        onClick={() => void overview.refreshHome('background')}
                        disabled={overview.refreshing}
                        className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-sparkle-border bg-sparkle-card hover:bg-sparkle-border-secondary transition-colors disabled:opacity-50"
                    >
                        <RefreshCw size={14} className={cn(overview.refreshing && 'animate-spin')} />
                        <span>Refresh</span>
                    </button>
                </div>
            </div>

            {overview.error && (
                <div className="mb-5 px-4 py-3 rounded-lg border border-amber-500/25 bg-amber-500/10 text-amber-300 text-sm">
                    {overview.error}
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-5">
                <SummaryCard icon={<FolderTree size={18} />} label="Total Projects" value={overview.totals.totalProjects} />
                <SummaryCard icon={<GitBranch size={18} />} label="Git Enabled" value={overview.totals.gitEnabled} loading={overview.gitOverviewLoading} />
                <SummaryCard icon={<GitCommitHorizontal size={18} />} label="Needs Commit" value={overview.totals.needsCommit} loading={overview.gitOverviewLoading} />
                <SummaryCard icon={<Upload size={18} />} label="Needs Push" value={overview.totals.needsPush} loading={overview.gitOverviewLoading} />
            </div>

            {overview.initialLoading ? (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                    <ListSkeleton title="Needs Commit" />
                    <ListSkeleton title="Needs Push" />
                    <ListSkeleton title="Recent Activity" />
                </div>
            ) : (
                <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
                    <ProjectListSection
                        title="Needs Commit"
                        subtitle={overview.gitOverviewLoading ? 'Git changes are loading...' : 'Working changes detected'}
                        projects={overview.needsCommitProjects}
                        emptyMessage="No projects with working changes."
                        gitLoadingPaths={overview.gitLoadingPaths}
                        onOpen={openProject}
                    />
                    <ProjectListSection
                        title="Needs Push"
                        subtitle={overview.gitOverviewLoading ? 'Git push status is loading...' : 'Local commits waiting to push'}
                        projects={overview.needsPushProjects}
                        emptyMessage="No projects with unpushed commits."
                        gitLoadingPaths={overview.gitLoadingPaths}
                        onOpen={openProject}
                    />
                    <ProjectListSection
                        title="Recent Activity"
                        subtitle="Recently opened first, then modified"
                        projects={overview.recentActivity}
                        emptyMessage="No discovered projects yet."
                        gitLoadingPaths={overview.gitLoadingPaths}
                        onOpen={openProject}
                    />
                </div>
            )}
        </div>
    )
}
