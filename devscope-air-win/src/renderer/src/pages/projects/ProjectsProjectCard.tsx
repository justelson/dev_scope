import { Clock, ExternalLink, FolderOpen } from 'lucide-react'
import { cn } from '@/lib/utils'
import ProjectIcon, { FrameworkBadge } from '@/components/ui/ProjectIcon'
import type { Project, ViewMode } from './projectsTypes'
import { WRAP_AND_CLAMP_2 } from '../shared/BrowseSectionPrimitives'
import { FileActionsMenu } from '@/components/ui/FileActionsMenu'

interface ProjectsProjectCardProps {
    project: Project
    viewMode: ViewMode
    formatRelativeTime: (timestamp?: number) => string
    getProjectTypeLabel: (type: string) => string
    getProjectThemeColor: (type: string) => string
    onProjectOpen: (project: Project) => void
    openInExplorer: (path: string) => void
}

export function ProjectsProjectCard({
    project,
    viewMode,
    formatRelativeTime,
    getProjectTypeLabel,
    getProjectThemeColor,
    onProjectOpen,
    openInExplorer
}: ProjectsProjectCardProps) {
    const themeColor = getProjectThemeColor(project.type)
    const frameworkDisplayLimit = 3

    return (
        <div
            onClick={() => onProjectOpen(project)}
            className={cn(
                'group relative cursor-pointer overflow-hidden border border-white/5 transition-all duration-300',
                'hover:-translate-y-1 hover:border-white/10',
                viewMode === 'finder'
                    ? 'flex flex-col items-center rounded-xl bg-sparkle-card p-4 text-center'
                    : 'flex flex-col gap-4 rounded-2xl bg-sparkle-card p-5'
            )}
        >
            <div
                className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100"
                style={{
                    boxShadow: `inset 0 0 0 1px ${themeColor}40`,
                    background: `linear-gradient(to bottom right, ${themeColor}05, transparent)`
                }}
            />

            {viewMode === 'finder' ? (
                <>
                    <div className="absolute top-2 right-2 z-20">
                        <FileActionsMenu
                            buttonClassName="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity bg-black/20"
                            items={[
                                { id: 'open', label: 'Open', icon: <FolderOpen size={13} />, onSelect: () => onProjectOpen(project) },
                                { id: 'explorer', label: 'Open in Explorer', icon: <ExternalLink size={13} />, onSelect: () => openInExplorer(project.path) }
                            ]}
                        />
                    </div>
                    <div className="relative mb-3 flex h-16 w-16 items-center justify-center rounded-2xl border border-white/5 bg-sparkle-bg shadow-inner group-hover:border-white/20">
                        <ProjectIcon
                            projectType={project.type}
                            framework={project.frameworks?.[0]}
                            size={40}
                        />
                    </div>
                    <span className={cn('min-h-8 w-full text-xs font-bold leading-4 text-white', WRAP_AND_CLAMP_2)} title={project.name}>
                        {project.name}
                    </span>
                    <span className="w-full truncate text-[10px] text-white/40" title={getProjectTypeLabel(project.type)}>{getProjectTypeLabel(project.type)}</span>
                </>
            ) : (
                <>
                    <div className="relative z-10 flex w-full items-start justify-between">
                        <div className="rounded-xl border border-white/5 bg-sparkle-bg p-3 shadow-inner">
                            <ProjectIcon
                                projectType={project.type}
                                framework={project.frameworks?.[0]}
                                size={32}
                            />
                        </div>
                        <div className="flex flex-col items-end gap-2">
                            <div className="flex items-center gap-1.5 text-[10px] text-white/30">
                                <Clock size={12} />
                                <span>{formatRelativeTime(project.lastModified)}</span>
                            </div>
                            <FileActionsMenu
                                buttonClassName="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                                items={[
                                    { id: 'open', label: 'Open', icon: <FolderOpen size={13} />, onSelect: () => onProjectOpen(project) },
                                    { id: 'explorer', label: 'Open in Explorer', icon: <ExternalLink size={13} />, onSelect: () => openInExplorer(project.path) }
                                ]}
                            />
                        </div>
                    </div>

                    <div className="relative z-10 flex-1">
                        <h3 className={cn('mb-1 text-lg font-bold leading-6 text-white transition-colors group-hover:text-white/90', WRAP_AND_CLAMP_2)} title={project.name}>
                            {project.name}
                        </h3>
                        <p className="mb-3 truncate text-xs text-white/40" title={getProjectTypeLabel(project.type)}>{getProjectTypeLabel(project.type)}</p>

                        {project.frameworks && project.frameworks.length > 0 && (
                            <div className="mb-3 flex flex-wrap gap-1.5">
                                {project.frameworks.slice(0, frameworkDisplayLimit).map((fw) => (
                                    <FrameworkBadge
                                        key={fw}
                                        framework={fw}
                                        size="sm"
                                        showLabel={false}
                                    />
                                ))}
                                {project.frameworks.length > frameworkDisplayLimit && (
                                    <span className="px-1.5 py-0.5 text-[10px] text-white/30">
                                        +{project.frameworks.length - frameworkDisplayLimit}
                                    </span>
                                )}
                            </div>
                        )}
                    </div>

                    <div className="relative z-10 flex items-center gap-2">
                        <button
                            onClick={(e) => {
                                e.stopPropagation()
                                openInExplorer(project.path)
                            }}
                            className="flex items-center gap-1.5 rounded-lg bg-sparkle-border-secondary px-3 py-1.5 text-xs text-sparkle-text-secondary transition-colors hover:text-sparkle-text"
                        >
                            <ExternalLink size={14} />
                            <span>Open</span>
                        </button>
                    </div>

                    <div
                        className="absolute bottom-0 left-0 right-0 h-1 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                        style={{ background: themeColor }}
                    />
                </>
            )}
        </div>
    )
}
