import {
    ArrowLeft, FolderOpen, Terminal, ExternalLink,
    RefreshCw, Copy, Check, BookOpen,
    GitBranch, GitPullRequest, Folder, Bot
} from 'lucide-react'
import { cn } from '@/lib/utils'
import ProjectIcon, { FrameworkBadge } from '@/components/ui/ProjectIcon'

interface ProjectDetailsHeaderSectionProps {
    [key: string]: any
}

export function ProjectDetailsHeaderSection(props: ProjectDetailsHeaderSectionProps) {
    const {
        themeColor,
        project,
        isProjectLive,
        activePorts,
        formatRelTime,
        onOpenTerminal,
        handleCopyPath,
        copiedPath,
        handleOpenInExplorer,
        goBack,
        activeTab,
        setActiveTab,
        fileTree,
        loadingFiles,
        loadingGit,
        changedFiles,
        unpushedCommits,
        onBrowseFolder,
        onShipToAssistant,
        loadProjectDetails
    } = props

    return (
        <>
            <div className="relative rounded-2xl overflow-hidden border border-white/10 bg-gradient-to-br from-white/[0.03] to-transparent mb-8">
                <div
                    className="absolute -top-20 -right-20 w-40 h-40 rounded-full blur-3xl opacity-20 pointer-events-none"
                    style={{ background: themeColor }}
                />

                <div className="relative p-5 flex items-center gap-5">
                    <div
                        className="shrink-0 w-14 h-14 rounded-xl flex items-center justify-center border border-white/10"
                        style={{ background: `${themeColor}15` }}
                    >
                        <ProjectIcon projectType={project.type} framework={project.frameworks?.[0]} size={32} />
                    </div>

                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-1">
                            <h1 className="text-xl font-bold text-white truncate">
                                {project.displayName}
                            </h1>
                            {project.version && (
                                <span className="text-xs font-mono text-white/40 bg-white/5 px-2 py-0.5 rounded">
                                    v{project.version}
                                </span>
                            )}
                        </div>
                        <div className="flex items-center gap-2 text-sm text-white/50">
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

                    <div className="flex items-center gap-3 shrink-0">
                        {isProjectLive && (
                            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-green-500/10 border border-green-500/20 animate-pulse">
                                <div className="w-2 h-2 rounded-full bg-green-500" />
                                <span className="text-xs font-semibold text-green-400">
                                    LIVE {activePorts.length > 0 && `(:${activePorts[0]})`}
                                </span>
                            </div>
                        )}

                        <div className="hidden md:block text-right mr-2">
                            <p className="text-[10px] uppercase tracking-wider text-white/30 font-medium">Modified</p>
                            <p className="text-sm text-white/60">{formatRelTime(project.lastModified)}</p>
                        </div>

                        <button
                            onClick={onOpenTerminal}
                            className="flex items-center gap-2 px-4 py-2.5 bg-[var(--accent-primary)] hover:bg-[var(--accent-primary)]/80 text-white text-sm font-medium rounded-lg transition-all active:scale-95"
                        >
                            <Terminal size={16} />
                            Open Terminal
                        </button>
                    </div>
                </div>

                <div className="flex items-center gap-2 px-5 py-3 bg-black/20 border-t border-white/5">
                    <FolderOpen size={14} className="text-white/30 shrink-0" />
                    <span className="flex-1 text-xs font-mono text-white/40 truncate">
                        {project.path}
                    </span>
                    <div className="flex items-center gap-1">
                        <button
                            onClick={handleCopyPath}
                            className={cn(
                                "p-1.5 rounded-md text-white/40 hover:text-white hover:bg-white/10 transition-all",
                                copiedPath && "text-green-400 hover:text-green-400"
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

            <div className="sticky -top-6 z-20 bg-sparkle-bg/95 backdrop-blur-xl pt-10 pb-4 mb-6 -mx-6 px-6 border-b border-white/5">
                <div className="flex gap-3 items-center">
                    <button
                        onClick={goBack}
                        className="h-11 w-11 flex items-center justify-center text-white/50 hover:text-white bg-sparkle-card border border-white/10 hover:border-white/20 rounded-xl transition-all shadow-sm shrink-0"
                        title="Go Back"
                    >
                        <ArrowLeft size={18} />
                    </button>

                    <div className="flex-1 flex items-center h-11 p-1 bg-sparkle-card border border-white/10 rounded-xl shadow-sm">
                        <button
                            onClick={() => setActiveTab('readme')}
                            className={cn(
                                "flex-1 h-full flex items-center justify-center gap-2 rounded-lg text-sm font-medium transition-all",
                                activeTab === 'readme' ? "bg-white/10 text-white" : "text-white/40 hover:text-white hover:bg-white/5"
                            )}
                        >
                            <BookOpen size={15} /> README
                        </button>
                        <button
                            onClick={() => setActiveTab('files')}
                            className={cn(
                                "flex-1 h-full flex items-center justify-center gap-2 rounded-lg text-sm font-medium transition-all",
                                activeTab === 'files' ? "bg-white/10 text-white" : "text-white/40 hover:text-white hover:bg-white/5"
                            )}
                        >
                            <FolderOpen size={15} /> Files
                            {loadingFiles && (
                                <RefreshCw size={12} className="animate-spin text-[var(--accent-primary)]" />
                            )}
                            <span className={cn(
                                "text-[10px] px-1.5 py-0.5 rounded-full",
                                loadingFiles
                                    ? "bg-[var(--accent-primary)]/15 text-[var(--accent-primary)]"
                                    : activeTab === 'files'
                                        ? "bg-white/10"
                                        : "bg-white/5 opacity-60"
                            )}>
                                {loadingFiles ? '...' : fileTree.length}
                            </span>
                        </button>
                        <button
                            onClick={() => setActiveTab('git')}
                            className={cn(
                                "flex-1 h-full flex items-center justify-center gap-2 rounded-lg text-sm font-medium transition-all",
                                activeTab === 'git' ? "bg-white/10 text-white" : "text-white/40 hover:text-white hover:bg-white/5"
                            )}
                        >
                            <GitBranch size={15} />
                            Git
                            {loadingGit && (
                                <RefreshCw size={12} className="animate-spin text-[var(--accent-primary)]" />
                            )}
                            {changedFiles.length > 0 && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#E2C08D]/20 text-[#E2C08D]">
                                    {changedFiles.length}
                                </span>
                            )}
                            {unpushedCommits.length > 0 && (
                                <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-400/30">
                                    <GitPullRequest size={10} />
                                    {unpushedCommits.length}
                                </span>
                            )}
                        </button>
                    </div>

                    <button
                        onClick={onBrowseFolder}
                        className="h-11 flex items-center gap-2 px-4 text-white/50 hover:text-white bg-sparkle-card border border-white/10 hover:border-white/20 rounded-xl transition-all shadow-sm shrink-0"
                        title="Browse as Folder"
                    >
                        <Folder size={16} />
                        <span className="text-sm font-medium hidden sm:inline">Browse Folder</span>
                    </button>

                    <button
                        onClick={onShipToAssistant}
                        className="h-11 w-11 inline-flex items-center justify-center text-[#E2A257] bg-[#E2A257]/12 border border-[#E2A257]/35 hover:bg-[#E2A257]/22 rounded-xl transition-all shadow-sm shrink-0"
                        title="Open assistant"
                    >
                        <Bot size={16} />
                    </button>

                    <button
                        onClick={loadProjectDetails}
                        className="h-11 w-11 flex items-center justify-center text-white/40 hover:text-white bg-sparkle-card border border-white/10 hover:border-white/20 rounded-xl transition-all shadow-sm shrink-0"
                        title="Refresh"
                    >
                        <RefreshCw size={16} />
                    </button>
                </div>
            </div>
        </>
    )
}
