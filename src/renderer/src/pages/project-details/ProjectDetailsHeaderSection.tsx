import {
    ArrowLeft, FolderOpen, Terminal, ExternalLink,
    RefreshCw, Copy, Check, BookOpen, Package,
    GitBranch, GitPullRequest, Folder
} from 'lucide-react'
import { OpenWithProjectButton } from '@/components/ui/OpenWithProjectButton'
import { cn } from '@/lib/utils'
import ProjectIcon, { FrameworkBadge } from '@/components/ui/ProjectIcon'

interface ProjectDetailsHeaderSectionProps {
    [key: string]: any
}

export function ProjectDetailsHeaderSection(props: ProjectDetailsHeaderSectionProps) {
    const {
        themeColor,
        project,
        projectDetailsLoading,
        currentBranch,
        isProjectLive,
        activePorts,
        formatRelTime,
        onOpenTerminal,
        handleCopyPath,
        copiedPath,
        handleOpenInExplorer,
        goBack,
        isCondensedLayout,
        activeTab,
        setActiveTab,
        fileTree,
        loadingFiles,
        loadingGit,
        changedFiles,
        unpushedCommits,
        onBrowseFolder,
        onShowScriptsModal,
        onShowDependenciesModal,
        onOpenWithAssistant,
        settings,
        loadProjectDetails,
        scriptCount,
        dependencyCount
    } = props

    return (
        <>
            <div className={cn(
                'relative rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.03] to-transparent transition-[margin] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]',
                isCondensedLayout ? 'mb-6' : 'mb-8'
            )}>
                <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl">
                    <div
                        className="absolute -top-20 -right-20 h-40 w-40 rounded-full opacity-20 blur-3xl"
                        style={{ background: themeColor }}
                    />
                </div>

                <div className={cn(
                    'relative flex items-center transition-[gap,padding] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]',
                    isCondensedLayout ? 'gap-4 p-4' : 'gap-5 p-5'
                )}>
                    <div
                        className={cn(
                            'shrink-0 rounded-xl flex items-center justify-center border border-white/10',
                            isCondensedLayout ? 'h-12 w-12' : 'h-14 w-14'
                        )}
                        style={{ background: `${themeColor}15` }}
                    >
                        <ProjectIcon
                            projectType={project.type}
                            framework={project.frameworks?.[0]}
                            customIconPath={project.projectIconPath}
                            size={isCondensedLayout ? 28 : 32}
                        />
                    </div>

                    <div className="flex-1 min-w-0">
                        <div className={cn('mb-1 flex items-center gap-3', isCondensedLayout && 'gap-2')}>
                            <h1 className={cn(
                                'truncate font-bold text-white',
                                isCondensedLayout ? 'text-lg' : 'text-xl'
                            )}>
                                {project.displayName}
                            </h1>
                            {project.version && (
                                <span className="text-xs font-mono text-white/40 bg-white/5 px-2 py-0.5 rounded">
                                    v{project.version}
                                </span>
                            )}
                            {currentBranch && (
                                <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[10px] font-medium text-white/60">
                                    <GitBranch size={10} className="text-white/38" />
                                    <span className="max-w-[160px] truncate font-mono text-white/68" title={currentBranch}>
                                        {currentBranch}
                                    </span>
                                </span>
                            )}
                            {projectDetailsLoading && (
                                <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.14em] text-white/55">
                                    <RefreshCw size={10} className="animate-spin" />
                                    Loading
                                </span>
                            )}
                        </div>
                        <div className={cn(
                            'flex items-center gap-2 text-white/50',
                                    isCondensedLayout ? 'text-xs' : 'text-sm'
                        )}>
                            <span
                                className="px-2 py-0.5 rounded text-xs font-medium"
                                style={{ background: `${themeColor}20`, color: themeColor }}
                            >
                                {project.typeInfo?.displayName || project.type}
                            </span>
                            {project.frameworks?.map((fw: string) => (
                                <FrameworkBadge key={fw} framework={fw} size="sm" />
                            ))}
                        </div>
                    </div>

                    <div className={cn(
                        'shrink-0 flex items-center',
                        isCondensedLayout ? 'gap-2' : 'gap-3'
                    )}>
                        {isProjectLive && (
                            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-green-500/10 border border-green-500/20 animate-pulse">
                                <div className="w-2 h-2 rounded-full bg-green-500" />
                                <span className="text-xs font-semibold text-green-400">
                                    LIVE {activePorts.length > 0 && `(:${activePorts[0]})`}
                                </span>
                            </div>
                        )}

                            <div className={cn('text-right', isCondensedLayout ? 'hidden xl:block mr-1' : 'hidden md:block mr-2')}>
                            <p className="text-[10px] uppercase tracking-wider text-white/30 font-medium">Modified</p>
                            <p className="text-sm text-white/60">{formatRelTime(project.lastModified)}</p>
                        </div>

                        <button
                            onClick={onOpenTerminal}
                            className={cn(
                                'flex items-center gap-2 rounded-lg bg-[var(--accent-primary)] text-sm font-medium text-white transition-all active:scale-95 hover:bg-[var(--accent-primary)]/80',
                                isCondensedLayout ? 'px-3 py-2.5' : 'px-4 py-2.5'
                            )}
                        >
                            <Terminal size={16} />
                                <span className={cn(isCondensedLayout && 'hidden 2xl:inline')}>Open Terminal</span>
                        </button>
                    </div>
                </div>

                <div className={cn(
                    'relative flex items-center gap-2 bg-black/20 border-t border-white/5 transition-[padding] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]',
                                isCondensedLayout ? 'px-4 py-2.5' : 'px-5 py-3'
                )}>
                    <FolderOpen size={14} className="text-white/30 shrink-0" />
                    <span className="flex-1 text-xs font-mono text-white/40 truncate">
                        {project.path}
                    </span>
                    <div className="flex items-center gap-1">
                        <OpenWithProjectButton
                            projectPath={project?.path || null}
                            preferredShell={settings.defaultShell}
                            menuWidthMode="trigger"
                            menuPresentation="inline"
                            contextActions={[{
                                id: 'assistant',
                                label: 'Assistant',
                                icon: 'assistant',
                                onSelect: onOpenWithAssistant
                            }]}
                        />
                        <button
                            onClick={handleCopyPath}
                            className={cn(
                                'p-1.5 rounded-md text-white/40 hover:text-white hover:bg-white/10 transition-all',
                                copiedPath && 'text-green-400 hover:text-green-400'
                            )}
                            title="Copy path"
                        >
                            {copiedPath ? <Check size={14} /> : <Copy size={14} />}
                        </button>
                        <button
                            onClick={handleOpenInExplorer}
                            className="p-1.5 rounded-md text-white/40 hover:text-white hover:bg-white/10 transition-all"
                            title="Open in Explorer"
                        >
                            <ExternalLink size={14} />
                        </button>
                    </div>
                </div>
            </div>

            <div className={cn(
                'sticky z-20 -mx-6 border-b border-white/5 bg-sparkle-bg/95 px-6 backdrop-blur-xl transition-[padding,margin] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]',
                isCondensedLayout ? '-top-4 mb-5 pb-3 pt-7' : '-top-6 mb-6 pb-4 pt-10'
            )}>
                <div className={cn(
                    'flex items-center justify-between gap-3 transition-[gap] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]',
                    isCondensedLayout ? 'flex-wrap xl:flex-nowrap' : ''
                )}>
                    <div className={cn(
                        'flex min-w-0 items-center gap-3',
                        isCondensedLayout ? 'min-w-0 flex-1' : 'flex-1'
                    )}>
                        <button
                            onClick={goBack}
                            className={cn(
                                'flex items-center justify-center rounded-xl border border-white/10 bg-sparkle-card text-white/50 shadow-sm transition-all hover:border-white/20 hover:text-white shrink-0',
                                isCondensedLayout ? 'h-10 w-10' : 'h-11 w-11'
                            )}
                            title="Go Back"
                        >
                            <ArrowLeft size={isCondensedLayout ? 16 : 18} />
                        </button>

                        <div className={cn(
                            'flex min-w-0 items-center bg-sparkle-card border border-white/10 rounded-xl shadow-sm',
                            isCondensedLayout ? 'h-10 flex-1 p-1' : 'h-11 flex-1 p-1'
                        )}>
                            <button
                                onClick={() => setActiveTab('readme')}
                                className={cn(
                                    'flex-1 h-full flex items-center justify-center gap-2 rounded-lg font-medium transition-all',
                                    isCondensedLayout ? 'text-[13px]' : 'text-sm',
                                    activeTab === 'readme' ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white hover:bg-white/5'
                                )}
                            >
                                <BookOpen size={isCondensedLayout ? 14 : 15} /> README
                            </button>
                            <button
                                onClick={() => setActiveTab('files')}
                                className={cn(
                                    'flex-1 h-full flex items-center justify-center gap-2 rounded-lg font-medium transition-all',
                                    isCondensedLayout ? 'text-[13px]' : 'text-sm',
                                    activeTab === 'files' ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white hover:bg-white/5'
                                )}
                            >
                                <FolderOpen size={isCondensedLayout ? 14 : 15} /> Files
                            </button>
                            <button
                                onClick={() => setActiveTab('git')}
                                className={cn(
                                    'flex-1 h-full flex items-center justify-center gap-2 rounded-lg font-medium transition-all',
                                    isCondensedLayout ? 'text-[13px]' : 'text-sm',
                                    activeTab === 'git' ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white hover:bg-white/5'
                                )}
                            >
                                <GitBranch size={isCondensedLayout ? 14 : 15} />
                                Git
                                {changedFiles.length > 0 && (
                                    <span className="rounded-full bg-[#E2C08D]/20 px-1.5 py-0.5 text-[10px] text-[#E2C08D]">
                                        {changedFiles.length}
                                    </span>
                                )}
                                {unpushedCommits.length > 0 && (
                                    <span className="inline-flex items-center gap-1 rounded-full border border-blue-400/30 bg-blue-500/20 px-1.5 py-0.5 text-[10px] text-blue-300">
                                        <GitPullRequest size={10} />
                                        {unpushedCommits.length}
                                    </span>
                                )}
                            </button>
                        </div>
                    </div>

                    <div className={cn(
                        'flex shrink-0 items-center',
                        isCondensedLayout ? 'gap-2' : 'gap-3'
                    )}>
                        <button
                            onClick={onBrowseFolder}
                            className={cn(
                                'flex items-center gap-2 rounded-xl border border-white/10 bg-sparkle-card text-white/50 shadow-sm transition-all hover:border-white/20 hover:text-white shrink-0',
                                isCondensedLayout ? 'h-10 w-10 justify-center' : 'h-11 px-4'
                            )}
                            title="Browse as Folder"
                        >
                            <Folder size={isCondensedLayout ? 14 : 16} />
                            {!isCondensedLayout && (
                                <span className="hidden text-sm font-medium sm:inline">Browse Folder</span>
                            )}
                        </button>

                        {isCondensedLayout && (
                            <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-sparkle-card p-1 shadow-sm">
                                <button
                                    onClick={onShowScriptsModal}
                                    className="relative flex h-8 w-8 items-center justify-center rounded-lg text-white/55 transition-all hover:bg-white/5 hover:text-white"
                                    title="Open scripts"
                                >
                                    <Terminal size={14} />
                                    {scriptCount > 0 && (
                                        <span className="absolute -right-1 -top-1 min-w-[18px] rounded-full bg-white/10 px-1 py-0.5 text-center text-[10px] text-white/55">
                                            {scriptCount}
                                        </span>
                                    )}
                                </button>

                                <div className="h-5 w-px bg-white/8" />

                                <button
                                    onClick={onShowDependenciesModal}
                                    className="relative flex h-8 w-8 items-center justify-center rounded-lg text-white/55 transition-all hover:bg-white/5 hover:text-white"
                                    title="Open dependencies"
                                >
                                    <Package size={14} />
                                    {dependencyCount > 0 && (
                                        <span className="absolute -right-1 -top-1 min-w-[18px] rounded-full bg-white/10 px-1 py-0.5 text-center text-[10px] text-white/55">
                                            {dependencyCount}
                                        </span>
                                    )}
                                </button>
                            </div>
                        )}

                        <button
                            onClick={loadProjectDetails}
                            className={cn(
                                'flex items-center justify-center rounded-xl border border-white/10 bg-sparkle-card text-white/40 shadow-sm transition-all hover:border-white/20 hover:text-white shrink-0',
                                isCondensedLayout ? 'h-10 w-10' : 'h-11 w-11'
                            )}
                            title={projectDetailsLoading ? 'Refreshing project details' : 'Refresh'}
                        >
                            <RefreshCw size={isCondensedLayout ? 15 : 16} className={cn(projectDetailsLoading && 'animate-spin')} />
                        </button>
                    </div>
                </div>
            </div>
        </>
    )
}
