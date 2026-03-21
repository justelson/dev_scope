import { createPortal } from 'react-dom'
import { useEffect, useRef, useState } from 'react'
import { ChevronDown, LoaderCircle, Terminal } from 'lucide-react'
import { cn } from '@/lib/utils'
import { IDE_ICON_ASSETS } from './ideIconAssets'
import type { InstalledIde } from './types'

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
            className="inline-flex shrink-0 items-center justify-center overflow-hidden rounded-lg border border-white/10"
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

type ProjectIdeLauncherButtonProps = {
    installedIdes: InstalledIde[]
    loadingInstalledIdes: boolean
    openingIdeId: string | null
    onOpenProjectInIde: (ideId: string) => void | Promise<void>
    compact?: boolean
}

export function ProjectIdeLauncherButton({
    installedIdes,
    loadingInstalledIdes,
    openingIdeId,
    onOpenProjectInIde,
    compact = false
}: ProjectIdeLauncherButtonProps) {
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
                        ? 'inline-flex items-center gap-1.5 rounded-md p-1.5 transition-all'
                        : 'h-11 shrink-0 items-center gap-2 rounded-xl border border-white/10 bg-sparkle-card px-4 shadow-sm transition-all',
                    disabled
                        ? 'cursor-not-allowed text-white/25'
                        : 'text-white/60 hover:text-white',
                    compact
                        ? 'hover:bg-white/10'
                        : 'bg-sparkle-card border border-white/10 hover:border-white/20',
                    !compact && 'flex'
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
                        <span className="hidden text-sm font-medium sm:inline">
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
                    <div
                        className={cn(
                            'rounded-2xl border border-white/10 bg-sparkle-card p-1.5 shadow-2xl shadow-black/70 backdrop-blur-xl',
                            menuPosition.originClassName
                        )}
                    >
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
