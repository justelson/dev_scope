import { ExternalLink, GitCommitHorizontal, Upload } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ProjectOverviewItem } from './types'
import { formatRelativeTime, normalizePathKey } from './homeUtils'

export function ProjectListSection({
    title,
    subtitle,
    projects,
    gitLoadingPaths,
    emptyMessage,
    onOpen
}: {
    title: string
    subtitle: string
    projects: ProjectOverviewItem[]
    gitLoadingPaths: Set<string>
    emptyMessage: string
    onOpen: (project: ProjectOverviewItem) => void
}) {
    const visibleProjects = projects.slice(0, 12)

    return (
        <section className="rounded-xl border border-sparkle-border bg-sparkle-card p-4">
            <div className="mb-3">
                <h2 className="text-sm font-semibold text-sparkle-text">{title}</h2>
                <p className="text-xs text-sparkle-text-secondary">{subtitle}</p>
            </div>

            {visibleProjects.length === 0 ? (
                <div className="h-32 rounded-lg border border-dashed border-sparkle-border-secondary flex items-center justify-center text-sm text-sparkle-text-secondary">
                    {emptyMessage}
                </div>
            ) : (
                <div className="space-y-2">
                    {visibleProjects.map((project) => (
                        <ProjectRow
                            key={project.path}
                            project={project}
                            isGitLoading={gitLoadingPaths.has(normalizePathKey(project.path))}
                            onOpen={onOpen}
                        />
                    ))}
                </div>
            )}
        </section>
    )
}

function ProjectRow({
    project,
    isGitLoading,
    onOpen
}: {
    project: ProjectOverviewItem
    isGitLoading: boolean
    onOpen: (project: ProjectOverviewItem) => void
}) {
    const lastSeenLabel = project.lastOpenedAt
        ? `opened ${formatRelativeTime(project.lastOpenedAt)}`
        : `modified ${formatRelativeTime(project.lastModified)}`

    return (
        <div
            onClick={() => onOpen(project)}
            className="rounded-lg border border-sparkle-border-secondary bg-sparkle-card/70 px-3 py-2.5 hover:bg-sparkle-border-secondary/60 cursor-pointer transition-colors"
        >
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <div className="flex items-center gap-2 min-w-0 mb-0.5">
                        <span className="text-sm font-medium text-sparkle-text truncate">{project.name}</span>
                        <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-white/10 text-sparkle-text-secondary">
                            {project.type}
                        </span>
                        <span
                            className={cn(
                                'text-[10px] px-1.5 py-0.5 rounded uppercase tracking-wide',
                                isGitLoading
                                    ? 'bg-amber-500/20 text-amber-300'
                                    : project.hasRemote
                                        ? 'bg-emerald-500/20 text-emerald-300'
                                        : 'bg-white/10 text-sparkle-text-secondary'
                            )}
                        >
                            {isGitLoading ? 'git...' : project.hasRemote ? 'remote' : 'local only'}
                        </span>
                    </div>
                    <div className="text-[11px] text-sparkle-text-muted truncate">{project.path}</div>
                    <div className="text-[11px] text-sparkle-text-secondary mt-1">
                        {lastSeenLabel}
                        {project.openCount ? ` | ${project.openCount} opens` : ''}
                    </div>
                </div>

                <div className="flex flex-col items-end gap-2 shrink-0">
                    <div className="flex items-center gap-1.5 text-[11px] text-sparkle-text-secondary">
                        <span className="inline-flex items-center gap-1 rounded bg-white/10 px-1.5 py-0.5" title="Changed files">
                            <GitCommitHorizontal size={11} />
                            {isGitLoading ? '...' : project.changedCount}
                        </span>
                        <span className="inline-flex items-center gap-1 rounded bg-white/10 px-1.5 py-0.5" title="Unpushed commits">
                            <Upload size={11} />
                            {isGitLoading ? '...' : project.unpushedCount}
                        </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <button
                            onClick={(event) => {
                                event.stopPropagation()
                                onOpen(project)
                            }}
                            className="text-[11px] px-2 py-1 rounded border border-sparkle-border-secondary hover:bg-sparkle-border-secondary transition-colors inline-flex items-center gap-1"
                        >
                            <ExternalLink size={11} />
                            Open
                        </button>
                        <button
                            onClick={(event) => event.stopPropagation()}
                            className="text-[11px] px-2 py-1 rounded border border-sparkle-border-secondary opacity-60 cursor-default"
                            title="Push actions are planned for Home"
                        >
                            Push soon
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}
