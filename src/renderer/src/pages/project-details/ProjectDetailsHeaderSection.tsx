import { createPortal } from 'react-dom'
import { useEffect, useRef, useState } from 'react'
import {
    ArrowLeft, FolderOpen, Terminal, ExternalLink,
    RefreshCw, Copy, Check, BookOpen, Package,
    GitBranch, GitPullRequest, Folder, ChevronDown, LoaderCircle
} from 'lucide-react'
import { cn } from '@/lib/utils'
import ProjectIcon, { FrameworkBadge } from '@/components/ui/ProjectIcon'
import { IDE_ICON_ASSETS } from './ideIconAssets'
import type { InstalledIde } from './types'

interface ProjectDetailsHeaderSectionProps {
    [key: string]: any
}

function IdeLogo({ ide, size = 16 }: { ide: InstalledIde; size?: number }) {
    const [imageFailed, setImageFailed] = useState(false)
    const localIconUrl = IDE_ICON_ASSETS[ide.icon] || IDE_ICON_ASSETS[ide.id]
    const fallbackLabel = ide.name
        .split(/\s+/)
        .map((segment) => segment[0])
        .join('')
        .slice(0, 2)
        .toUpperCase()

    return (
        <span
            className="inline-flex items-center justify-center rounded-lg border border-white/10 shrink-0 overflow-hidden"
            style={{
                width: size + 10,
                height: size + 10,
                backgroundColor: `${ide.color}20`
            }}
        >
            {imageFailed || !localIconUrl ? (
                <span className="text-[10px] font-semibold" style={{ color: ide.color }}>
                    {fallbackLabel}
                </span>
            ) : (
                <img
                    src={localIconUrl}
                    alt={`${ide.name} logo`}
                    width={size}
                    height={size}
                    className="h-4 w-4 object-contain"
                    onError={() => setImageFailed(true)}
                    loading="lazy"
                />
            )}
        </span>
    )
}

function getPreferredIde(installedIdes: InstalledIde[]): InstalledIde | null {
    if (installedIdes.length === 0) return null
    return installedIdes.find((ide) => ide.id === 'vscode') || installedIdes[0]
}

function ProjectIdeLauncherButton(props: {
    installedIdes: InstalledIde[]
    loadingInstalledIdes: boolean
    openingIdeId: string | null
    onOpenProjectInIde: (ideId: string) => void | Promise<void>
    compact?: boolean
}) {
    const {
        installedIdes,
        loadingInstalledIdes,
        openingIdeId,
        onOpenProjectInIde,
        compact = false
    } = props
    const [menuOpen, setMenuOpen] = useState(false)
    const triggerRef = useRef<HTMLButtonElement | null>(null)
    const menuRef = useRef<HTMLDivElement | null>(null)
    const [menuPosition, setMenuPosition] = useState<{ top: number; left: number; originClassName: string } | null>(null)

    const updateMenuPosition = (menuWidth = 280, menuHeight = 280) => {
        const trigger = triggerRef.current
        if (!trigger) return

        const viewportPadding = 12
        const gap = 8
        const rect = trigger.getBoundingClientRect()
        const spaceBelow = window.innerHeight - rect.bottom - viewportPadding
        const spaceAbove = rect.top - viewportPadding
        const shouldOpenUpward = spaceBelow < menuHeight && spaceAbove > spaceBelow
        const maxTop = Math.max(viewportPadding, window.innerHeight - menuHeight - viewportPadding)
        const top = shouldOpenUpward
            ? Math.max(viewportPadding, rect.top - menuHeight - gap)
            : Math.max(viewportPadding, Math.min(maxTop, rect.bottom + gap))
        const maxLeft = Math.max(viewportPadding, window.innerWidth - menuWidth - viewportPadding)
        const left = Math.max(viewportPadding, Math.min(rect.right - menuWidth, maxLeft))

        setMenuPosition({
            top,
            left,
            originClassName: shouldOpenUpward ? 'origin-bottom-right animate-scaleIn' : 'origin-top-right animate-scaleIn'
        })
    }

    useEffect(() => {
        if (!menuOpen) return

        updateMenuPosition()
        const handleResize = () => {
            const width = menuRef.current?.offsetWidth ?? 280
            const height = menuRef.current?.offsetHeight ?? 280
            updateMenuPosition(width, height)
        }

        const rafId = window.requestAnimationFrame(handleResize)
        window.addEventListener('resize', handleResize)
        return () => {
            window.cancelAnimationFrame(rafId)
            window.removeEventListener('resize', handleResize)
        }
    }, [menuOpen])

    useEffect(() => {
        if (!menuOpen) return

        const handleScroll = () => setMenuOpen(false)

        window.addEventListener('scroll', handleScroll, true)
        return () => window.removeEventListener('scroll', handleScroll, true)
    }, [menuOpen])

    useEffect(() => {
        if (!menuOpen) return

        const handlePointerDown = (event: PointerEvent) => {
            const target = event.target as Node
            const insideTrigger = Boolean(triggerRef.current?.contains(target))
            const insideMenu = Boolean(menuRef.current?.contains(target))
            if (!insideTrigger && !insideMenu) {
                setMenuOpen(false)
            }
        }

        const handleEscape = (event: KeyboardEvent) => {
            if (event.key === 'Escape') setMenuOpen(false)
        }

        document.addEventListener('pointerdown', handlePointerDown)
        document.addEventListener('keydown', handleEscape)
        return () => {
            document.removeEventListener('pointerdown', handlePointerDown)
            document.removeEventListener('keydown', handleEscape)
        }
    }, [menuOpen])

    const hasInstalledIdes = installedIdes.length > 0
    const disabled = loadingInstalledIdes || !hasInstalledIdes
    const preferredIde = getPreferredIde(installedIdes)

    return (
        <>
            <button
                ref={triggerRef}
                type="button"
                onClick={() => {
                    if (disabled) return
                    setMenuOpen((current) => !current)
                }}
                disabled={disabled}
                className={cn(
                    compact
                        ? 'inline-flex items-center gap-1.5 p-1.5 rounded-md transition-all'
                        : 'h-11 flex items-center gap-2 px-4 bg-sparkle-card border border-white/10 rounded-xl shadow-sm shrink-0 transition-all',
                    disabled
                        ? 'cursor-not-allowed text-white/25'
                        : 'text-white/60 hover:text-white',
                    compact
                        ? 'hover:bg-white/10'
                        : 'bg-sparkle-card border border-white/10 hover:border-white/20'
                )}
                title={disabled ? (loadingInstalledIdes ? 'Checking installed IDEs' : 'No supported IDEs detected') : 'Open project in an IDE'}
            >
                {loadingInstalledIdes ? (
                    <LoaderCircle size={14} className="animate-spin" />
                ) : preferredIde ? (
                    <IdeLogo ide={preferredIde} size={14} />
                ) : (
                    <Terminal size={14} />
                )}
                {compact ? (
                    hasInstalledIdes && !loadingInstalledIdes && (
                        <ChevronDown size={12} className={cn('transition-transform', menuOpen && 'rotate-180')} />
                    )
                ) : (
                    <>
                        <span className="text-sm font-medium hidden sm:inline">
                            {loadingInstalledIdes ? 'Finding IDEs...' : hasInstalledIdes ? 'Open in IDE' : 'No IDEs Found'}
                        </span>
                        {hasInstalledIdes && !loadingInstalledIdes && (
                            <ChevronDown size={14} className={cn('transition-transform', menuOpen && 'rotate-180')} />
                        )}
                    </>
                )}
            </button>

            {menuOpen && menuPosition && typeof document !== 'undefined' && createPortal(
                <div
                    ref={menuRef}
                    className="fixed z-[160] min-w-[280px]"
                    style={{
                        top: `${menuPosition.top}px`,
                        left: `${menuPosition.left}px`
                    }}
                >
                    <div className={cn(
                        'rounded-2xl border border-white/10 bg-sparkle-card p-1.5 shadow-2xl shadow-black/70 backdrop-blur-xl',
                        menuPosition.originClassName
                    )}>
                        <div className="px-3 py-2 text-[10px] uppercase tracking-[0.24em] text-white/35">
                            Installed IDEs
                        </div>
                        {installedIdes.map((ide) => {
                            const isOpening = openingIdeId === ide.id
                            return (
                                <button
                                    key={ide.id}
                                    type="button"
                                    disabled={Boolean(openingIdeId)}
                                    onClick={() => {
                                        setMenuOpen(false)
                                        void onOpenProjectInIde(ide.id)
                                    }}
                                    className={cn(
                                        'flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition-colors',
                                        openingIdeId
                                            ? 'cursor-not-allowed text-white/35'
                                            : 'text-white/75 hover:bg-white/10 hover:text-white'
                                    )}
                                >
                                    <IdeLogo ide={ide} />
                                    <div className="min-w-0 flex-1">
                                        <div className="truncate text-sm font-medium">{ide.name}</div>
                                        <div className="text-xs text-white/40">
                                            {isOpening ? 'Launching now...' : 'Open this project folder'}
                                        </div>
                                    </div>
                                    {isOpening && <LoaderCircle size={14} className="animate-spin text-white/50" />}
                                </button>
                            )
                        })}
                    </div>
                </div>,
                document.body
            )}
        </>
    )
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
        installedIdes,
        loadingInstalledIdes,
        openingIdeId,
        onOpenProjectInIde,
        loadProjectDetails,
        scriptCount,
        dependencyCount
    } = props

    return (
        <>
            <div className={cn(
                'relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.03] to-transparent transition-[margin] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]',
                isCondensedLayout ? 'mb-6' : 'mb-8'
            )}>
                <div
                    className="absolute -top-20 -right-20 w-40 h-40 rounded-full blur-3xl opacity-20 pointer-events-none"
                    style={{ background: themeColor }}
                />

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
                        <ProjectIcon projectType={project.type} framework={project.frameworks?.[0]} size={isCondensedLayout ? 28 : 32} />
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
                    'flex items-center gap-2 bg-black/20 border-t border-white/5 transition-[padding] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]',
                                isCondensedLayout ? 'px-4 py-2.5' : 'px-5 py-3'
                )}>
                    <FolderOpen size={14} className="text-white/30 shrink-0" />
                    <span className="flex-1 text-xs font-mono text-white/40 truncate">
                        {project.path}
                    </span>
                    <div className="flex items-center gap-1">
                        <ProjectIdeLauncherButton
                            installedIdes={installedIdes}
                            loadingInstalledIdes={loadingInstalledIdes}
                            openingIdeId={openingIdeId}
                            onOpenProjectInIde={onOpenProjectInIde}
                            compact
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
                            title="Refresh"
                        >
                            <RefreshCw size={isCondensedLayout ? 15 : 16} />
                        </button>
                    </div>
                </div>
            </div>
        </>
    )
}
