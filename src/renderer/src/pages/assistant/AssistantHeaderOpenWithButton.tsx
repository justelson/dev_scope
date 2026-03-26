import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown, FolderOpen, LoaderCircle, Terminal } from 'lucide-react'
import type { DevScopeInstalledIde } from '@shared/contracts/devscope-project-contracts'
import { AnimatedHeight } from '@/components/ui/AnimatedHeight'
import { cn } from '@/lib/utils'
import { IDE_ICON_ASSETS } from '@/pages/project-details/ideIconAssets'

const ALLOWED_IDE_ORDER = ['cursor', 'vscode', 'android-studio'] as const
const ASSISTANT_HEADER_OPEN_WITH_LAST_TARGET_STORAGE_KEY = 'assistant-header-open-with:last-target:v1'
type AssistantOpenWithTargetId = (typeof ALLOWED_IDE_ORDER)[number] | 'explorer' | 'terminal'

function AssistantIdeLogo({ ide }: { ide: DevScopeInstalledIde }) {
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
            className="inline-flex size-5 shrink-0 items-center justify-center overflow-hidden rounded-md border border-white/10"
            style={{ backgroundColor: `${ide.color}20` }}
        >
            {imageFailed || !localIconUrl ? (
                <span className="text-[9px] font-semibold" style={{ color: ide.color }}>
                    {fallbackLabel}
                </span>
            ) : (
                <img
                    src={localIconUrl}
                    alt={`${ide.name} logo`}
                    width={12}
                    height={12}
                    className="h-3 w-3 object-contain"
                    onError={() => setImageFailed(true)}
                    loading="lazy"
                />
            )}
        </span>
    )
}

function AssistantIdeGlyph({ ide }: { ide: DevScopeInstalledIde }) {
    const [imageFailed, setImageFailed] = useState(false)
    const localIconUrl = IDE_ICON_ASSETS[ide.icon] || IDE_ICON_ASSETS[ide.id]
    const fallbackLabel = ide.name
        .split(/\s+/)
        .map((segment) => segment[0])
        .join('')
        .slice(0, 2)
        .toUpperCase()

    if (imageFailed || !localIconUrl) {
        return (
            <span className="inline-flex shrink-0 items-center justify-center text-[11px] font-semibold" style={{ color: ide.color }}>
                {fallbackLabel}
            </span>
        )
    }

    return (
        <img
            src={localIconUrl}
            alt={`${ide.name} logo`}
            width={16}
            height={16}
            className="h-4 w-4 shrink-0 object-contain"
            onError={() => setImageFailed(true)}
            loading="lazy"
        />
    )
}

function formatOpenWithError(result: { success: boolean; error?: string }, fallback: string): string {
    return result.error || fallback
}

function readLastOpenWithTargetId(): AssistantOpenWithTargetId {
    try {
        const stored = localStorage.getItem(ASSISTANT_HEADER_OPEN_WITH_LAST_TARGET_STORAGE_KEY)
        if (stored === 'cursor' || stored === 'vscode' || stored === 'android-studio' || stored === 'explorer' || stored === 'terminal') {
            return stored
        }
    } catch {}
    return 'terminal'
}

function persistLastOpenWithTargetId(targetId: AssistantOpenWithTargetId) {
    try {
        localStorage.setItem(ASSISTANT_HEADER_OPEN_WITH_LAST_TARGET_STORAGE_KEY, targetId)
    } catch {}
}

function OpenWithTriggerIcon(props: {
    targetId: AssistantOpenWithTargetId
    installedIdes: DevScopeInstalledIde[]
    opening: boolean
}) {
    const { installedIdes, opening, targetId } = props
    const matchingIde = installedIdes.find((ide) => ide.id === targetId) || null

    if (opening) {
        return <LoaderCircle size={14} className="shrink-0 animate-spin" />
    }

    if (matchingIde) {
        return <AssistantIdeGlyph ide={matchingIde} />
    }

    if (targetId === 'explorer') {
        return <FolderOpen size={14} className="shrink-0" />
    }

    return <Terminal size={14} className="shrink-0" />
}

export function AssistantHeaderOpenWithButton(props: {
    projectPath: string | null
    preferredShell: 'powershell' | 'cmd'
}) {
    const { projectPath, preferredShell } = props
    const triggerRef = useRef<HTMLDivElement | null>(null)
    const menuRef = useRef<HTMLDivElement | null>(null)
    const [menuOpen, setMenuOpen] = useState(false)
    const [idesLoaded, setIdesLoaded] = useState(false)
    const [loadingIdes, setLoadingIdes] = useState(false)
    const [installedIdes, setInstalledIdes] = useState<DevScopeInstalledIde[]>([])
    const [openingTargetId, setOpeningTargetId] = useState<string | null>(null)
    const [errorMessage, setErrorMessage] = useState<string | null>(null)
    const [lastTargetId, setLastTargetId] = useState<AssistantOpenWithTargetId>(() => readLastOpenWithTargetId())

    const availableIdes = useMemo(() => {
        const order = new Map(ALLOWED_IDE_ORDER.map((id, index) => [id, index]))
        return installedIdes
            .filter((ide) => order.has(ide.id as (typeof ALLOWED_IDE_ORDER)[number]))
            .sort((left, right) => (order.get(left.id as (typeof ALLOWED_IDE_ORDER)[number]) ?? 99) - (order.get(right.id as (typeof ALLOWED_IDE_ORDER)[number]) ?? 99))
    }, [installedIdes])

    const terminalLabel = preferredShell === 'cmd' ? 'CMD' : 'PowerShell'
    const disabled = !projectPath
    const primaryTargetId: AssistantOpenWithTargetId = useMemo(() => {
        if (lastTargetId === 'explorer' || lastTargetId === 'terminal') return lastTargetId
        return installedIdes.some((ide) => ide.id === lastTargetId) ? lastTargetId : 'terminal'
    }, [installedIdes, lastTargetId])

    const loadInstalledIdes = useCallback(async () => {
        if (idesLoaded || loadingIdes) return
        setLoadingIdes(true)
        try {
            const result = await window.devscope.listInstalledIdes()
            if (result.success) {
                setInstalledIdes(result.ides || [])
            } else {
                setInstalledIdes([])
            }
            setIdesLoaded(true)
        } catch {
            setInstalledIdes([])
            setIdesLoaded(true)
        } finally {
            setLoadingIdes(false)
        }
    }, [idesLoaded, loadingIdes])

    useEffect(() => {
        if (!menuOpen) return
        void loadInstalledIdes()
    }, [loadInstalledIdes, menuOpen])

    useEffect(() => {
        if (lastTargetId === 'explorer' || lastTargetId === 'terminal') return
        void loadInstalledIdes()
    }, [lastTargetId, loadInstalledIdes])

    useEffect(() => {
        if (!menuOpen) return

        const handlePointerDown = (event: PointerEvent) => {
            const target = event.target as Node
            if (triggerRef.current?.contains(target) || menuRef.current?.contains(target)) return
            setMenuOpen(false)
            setErrorMessage(null)
        }

        const handleEscape = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                setMenuOpen(false)
                setErrorMessage(null)
            }
        }

        document.addEventListener('pointerdown', handlePointerDown)
        document.addEventListener('keydown', handleEscape)
        return () => {
            document.removeEventListener('pointerdown', handlePointerDown)
            document.removeEventListener('keydown', handleEscape)
        }
    }, [menuOpen])

    useEffect(() => {
        if (menuOpen || !errorMessage) return
        setErrorMessage(null)
    }, [errorMessage, menuOpen])

    const handleOpenExplorer = useCallback(async () => {
        if (!projectPath) return
        setOpeningTargetId('explorer')
        setErrorMessage(null)
        try {
            const result = await window.devscope.openInExplorer(projectPath)
            if (!result.success) {
                setErrorMessage(formatOpenWithError(result, 'Failed to open in File Explorer'))
                return
            }
            setLastTargetId('explorer')
            persistLastOpenWithTargetId('explorer')
            setMenuOpen(false)
        } finally {
            setOpeningTargetId(null)
        }
    }, [projectPath])

    const handleOpenTerminal = useCallback(async () => {
        if (!projectPath) return
        setOpeningTargetId('terminal')
        setErrorMessage(null)
        try {
            const result = await window.devscope.openInTerminal(projectPath, preferredShell)
            if (!result.success) {
                setErrorMessage(formatOpenWithError(result, `Failed to open in ${terminalLabel}`))
                return
            }
            setLastTargetId('terminal')
            persistLastOpenWithTargetId('terminal')
            setMenuOpen(false)
        } finally {
            setOpeningTargetId(null)
        }
    }, [preferredShell, projectPath, terminalLabel])

    const handleOpenIde = useCallback(async (ide: DevScopeInstalledIde) => {
        if (!projectPath) return
        setOpeningTargetId(ide.id)
        setErrorMessage(null)
        try {
            const result = await window.devscope.openProjectInIde(projectPath, ide.id)
            if (!result.success) {
                setErrorMessage(formatOpenWithError(result, `Failed to open in ${ide.name}`))
                return
            }
            setLastTargetId(ide.id as AssistantOpenWithTargetId)
            persistLastOpenWithTargetId(ide.id as AssistantOpenWithTargetId)
            setMenuOpen(false)
        } finally {
            setOpeningTargetId(null)
        }
    }, [projectPath])

    const handlePrimaryAction = useCallback(() => {
        if (disabled) return
        setMenuOpen(false)

        if (primaryTargetId === 'explorer') {
            void handleOpenExplorer()
            return
        }

        if (primaryTargetId === 'terminal') {
            void handleOpenTerminal()
            return
        }

        const targetIde = installedIdes.find((ide) => ide.id === primaryTargetId)
        if (targetIde) {
            void handleOpenIde(targetIde)
            return
        }

        void handleOpenTerminal()
    }, [disabled, handleOpenExplorer, handleOpenIde, handleOpenTerminal, installedIdes, primaryTargetId])

    const primaryActionLabel = useMemo(() => {
        if (primaryTargetId === 'explorer') return 'File Explorer'
        if (primaryTargetId === 'terminal') return terminalLabel
        return installedIdes.find((ide) => ide.id === primaryTargetId)?.name || terminalLabel
    }, [installedIdes, primaryTargetId, terminalLabel])

    return (
        <div className="relative inline-flex" ref={triggerRef}>
            <div
                className={cn(
                    'inline-flex overflow-hidden rounded-lg border bg-sparkle-card',
                    menuOpen && !disabled && 'rounded-b-none bg-white/[0.04]',
                    disabled
                        ? 'border-white/10 opacity-60'
                        : 'border-white/10'
                )}
            >
                <button
                    type="button"
                    onClick={handlePrimaryAction}
                    disabled={disabled || Boolean(openingTargetId)}
                    className={cn(
                        'inline-flex h-8 items-center gap-1.5 px-2.5 text-[11px] font-medium transition-colors',
                        disabled || openingTargetId
                            ? 'cursor-not-allowed text-sparkle-text-muted/60'
                            : 'text-sparkle-text-secondary hover:bg-white/[0.03] hover:text-sparkle-text'
                    )}
                    title={disabled ? 'No project directory selected' : `Open project folder in ${primaryActionLabel}`}
                >
                    <OpenWithTriggerIcon
                        targetId={primaryTargetId}
                        installedIdes={installedIdes}
                        opening={Boolean(openingTargetId && openingTargetId === primaryTargetId)}
                    />
                    <span>Open with</span>
                </button>
                <button
                    type="button"
                    onClick={() => {
                        if (disabled) return
                        setMenuOpen((current) => !current)
                    }}
                    disabled={disabled || Boolean(openingTargetId)}
                    className={cn(
                        'inline-flex h-8 w-8 items-center justify-center border-l border-white/10 transition-colors',
                        disabled || openingTargetId
                            ? 'cursor-not-allowed text-sparkle-text-muted/60'
                            : 'text-sparkle-text-secondary hover:bg-white/[0.03] hover:text-sparkle-text'
                    )}
                    title={disabled ? 'No project directory selected' : 'Choose another app'}
                    aria-label="Choose another app"
                    aria-haspopup="menu"
                    aria-expanded={menuOpen}
                >
                    <ChevronDown size={13} className={cn('transition-transform', menuOpen && 'rotate-180')} />
                </button>
            </div>

            <div
                ref={menuRef}
                className={cn(
                    'pointer-events-none absolute right-0 top-[calc(100%-1px)] z-30 w-full overflow-hidden',
                    menuOpen && 'pointer-events-auto'
                )}
            >
                <AnimatedHeight isOpen={menuOpen} duration={220}>
                    <div className="rounded-b-lg rounded-t-none border border-white/10 border-t-transparent bg-sparkle-card p-1 shadow-2xl shadow-black/30 backdrop-blur-xl">
                    {loadingIdes && !idesLoaded ? (
                        <div className="flex items-center gap-1.5 px-2 py-1.5 text-[11px] text-sparkle-text-secondary">
                            <LoaderCircle size={11} className="animate-spin" />
                            <span>Checking apps...</span>
                        </div>
                    ) : null}

                    {availableIdes.map((ide) => {
                        const opening = openingTargetId === ide.id
                        return (
                            <button
                                key={ide.id}
                                type="button"
                                disabled={Boolean(openingTargetId)}
                                onClick={() => void handleOpenIde(ide)}
                                className={cn(
                                    'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors',
                                    openingTargetId
                                        ? 'cursor-not-allowed text-sparkle-text-muted/60'
                                        : 'text-sparkle-text-secondary hover:bg-white/[0.04] hover:text-sparkle-text'
                                )}
                            >
                                <AssistantIdeLogo ide={ide} />
                                <div className="min-w-0 flex-1 truncate text-[11px] font-medium">{ide.name}</div>
                                {opening ? <LoaderCircle size={11} className="animate-spin text-sparkle-text-muted" /> : null}
                            </button>
                        )
                    })}

                    {idesLoaded && !loadingIdes && availableIdes.length === 0 ? (
                        <div className="px-2.5 py-2 text-[11px] text-sparkle-text-muted">
                            Cursor, VS Code, and Android Studio were not detected.
                        </div>
                    ) : null}

                    <div className="my-1 border-t border-white/5" />

                    <button
                        type="button"
                        disabled={Boolean(openingTargetId)}
                        onClick={() => void handleOpenExplorer()}
                        className={cn(
                            'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors',
                            openingTargetId
                                ? 'cursor-not-allowed text-sparkle-text-muted/60'
                                : 'text-sparkle-text-secondary hover:bg-white/[0.04] hover:text-sparkle-text'
                        )}
                    >
                        <span className="inline-flex size-5 shrink-0 items-center justify-center rounded-md border border-white/10 bg-white/[0.03]">
                            <FolderOpen size={12} />
                        </span>
                        <div className="min-w-0 flex-1 truncate text-[11px] font-medium">File Explorer</div>
                        {openingTargetId === 'explorer' ? <LoaderCircle size={11} className="animate-spin text-sparkle-text-muted" /> : null}
                    </button>

                    <button
                        type="button"
                        disabled={Boolean(openingTargetId)}
                        onClick={() => void handleOpenTerminal()}
                        className={cn(
                            'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors',
                            openingTargetId
                                ? 'cursor-not-allowed text-sparkle-text-muted/60'
                                : 'text-sparkle-text-secondary hover:bg-white/[0.04] hover:text-sparkle-text'
                        )}
                    >
                        <span className="inline-flex size-5 shrink-0 items-center justify-center rounded-md border border-white/10 bg-white/[0.03]">
                            <Terminal size={12} />
                        </span>
                        <div className="min-w-0 flex-1 truncate text-[11px] font-medium">{terminalLabel}</div>
                        {openingTargetId === 'terminal' ? <LoaderCircle size={11} className="animate-spin text-sparkle-text-muted" /> : null}
                    </button>

                    {errorMessage ? (
                        <div className="mt-1 px-2.5 py-2 text-[11px] text-red-300">
                            {errorMessage}
                        </div>
                    ) : null}
                    </div>
                </AnimatedHeight>
            </div>
        </div>
    )
}
