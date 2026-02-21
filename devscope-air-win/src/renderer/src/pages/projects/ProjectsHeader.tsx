import { Link } from 'react-router-dom'
import { FolderTree, Loader2, FolderOpen, Settings, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { StatChip } from './projectsTypes'

interface ProjectsHeaderProps {
    totalProjects: number
    loading: boolean
    projectsFolder: string
    additionalFoldersCount: number
    statChips: StatChip[]
    onRefresh: () => void
    onOpenStats: (key: 'projects' | 'frameworks' | 'types') => void
}

export function ProjectsHeader({
    totalProjects,
    loading,
    projectsFolder,
    additionalFoldersCount,
    statChips,
    onRefresh,
    onOpenStats
}: ProjectsHeaderProps) {
    return (
        <div className="relative mb-8">
            <div className="relative">
                <div className="flex items-center justify-between gap-6 mb-6">
                    <div className="flex items-center gap-6 min-w-0 flex-1">
                        <div className="relative shrink-0">
                            <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl border border-amber-300/35 bg-gradient-to-br from-amber-400/20 via-orange-400/15 to-transparent backdrop-blur-sm shadow-[0_0_0_1px_rgba(251,191,36,0.18)_inset]">
                                <FolderTree className="text-amber-300" size={28} />
                            </div>
                        </div>

                        <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-3 mb-2">
                                <h1 className="text-3xl font-bold tracking-tight text-sparkle-text">Projects</h1>
                                {totalProjects > 0 && (
                                    <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-300/40 bg-gradient-to-r from-amber-400/20 to-orange-400/15 px-3 py-1 text-sm font-semibold text-amber-300">
                                        {loading ? (
                                            <Loader2 size={14} className="animate-spin" />
                                        ) : (
                                            <>
                                                <span className="h-1.5 w-1.5 rounded-full bg-amber-300 animate-pulse" />
                                                {totalProjects}
                                            </>
                                        )}
                                    </span>
                                )}
                            </div>
                            <p className="text-sm text-sparkle-text-secondary mb-3">
                                Your coding projects in one place
                            </p>

                            <div className="flex items-center gap-3 flex-wrap">
                                {totalProjects > 0 && (
                                    <>
                                        {statChips.map((chip) => {
                                            const Icon = chip.icon
                                            return (
                                                <button
                                                    key={chip.key}
                                                    onClick={() => onOpenStats(chip.key)}
                                                    disabled={loading}
                                                    className="flex items-center gap-2 rounded-lg border px-3 py-1.5 disabled:cursor-not-allowed"
                                                    style={{
                                                        borderColor: `color-mix(in srgb, ${chip.color}, transparent 35%)`,
                                                        background: `linear-gradient(135deg, color-mix(in srgb, ${chip.color}, transparent 72%), color-mix(in srgb, ${chip.color}, transparent 82%))`
                                                    }}
                                                >
                                                    <Icon size={14} color={chip.color} strokeWidth={2.1} />
                                                    {loading ? (
                                                        <Loader2 size={14} className="animate-spin text-sparkle-text" />
                                                    ) : (
                                                        <span className="text-sm font-bold text-sparkle-text">{chip.value}</span>
                                                    )}
                                                    <span className="text-xs font-semibold tracking-wide" style={{ color: chip.color }}>
                                                        {chip.label}
                                                    </span>
                                                </button>
                                            )
                                        })}
                                        <div className="h-4 w-px bg-sparkle-border" />
                                    </>
                                )}

                                <div className="flex items-center gap-1.5 rounded-lg bg-sparkle-card px-2.5 py-1.5 border border-sparkle-border">
                                    <FolderOpen size={12} color="var(--accent-primary)" strokeWidth={2} />
                                    <span className="font-mono text-xs text-sparkle-text-muted truncate max-w-xs">
                                        {projectsFolder}
                                    </span>
                                </div>
                                {additionalFoldersCount > 0 && (
                                    <span className="text-xs text-sparkle-text-muted">
                                        +{additionalFoldersCount} more
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                        <Link
                            to="/settings/projects"
                            className="flex items-center gap-2 rounded-xl border border-sparkle-border bg-sparkle-card px-3 py-2 text-sm text-sparkle-text-secondary hover:text-sparkle-text hover:border-[var(--accent-primary)]/30 hover:bg-sparkle-card-hover transition-all"
                            title="Projects settings"
                        >
                            <Settings size={16} />
                            <span className="hidden sm:inline">Settings</span>
                        </Link>
                        <button
                            onClick={onRefresh}
                            disabled={loading}
                            className="flex items-center gap-2 rounded-xl bg-[var(--accent-primary)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--accent-primary)]/90 disabled:opacity-50 transition-all"
                        >
                            <RefreshCw size={16} className={cn(loading && 'animate-spin')} />
                            <span>Refresh</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}
