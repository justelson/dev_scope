import type { CSSProperties } from 'react'
import { useEffect, useMemo, useState } from 'react'
import { Copy, Minus, Square, X } from 'lucide-react'
import { DevScopeLogoASCIIMini } from '@/components/ui/DevScopeLogo'
import { useSettings } from '@/lib/settings'
import { cn } from '@/lib/utils'

function shortenPath(filePath: string): string {
    const normalized = filePath.replace(/\\/g, '/')
    return normalized.replace(/^([A-Z]:)\/Users\/[^/]+/i, '$1/Users/~')
}

export function QuickPreviewTitleBar(props: {
    fileName: string
    filePath: string
    extension?: string
    title?: string
}) {
    const { fileName, filePath, extension, title = 'Quick Preview' } = props
    const { settings } = useSettings()
    const [isMaximized, setIsMaximized] = useState(false)
    const iconTheme = settings.theme === 'light' ? 'light' : 'dark'
    const displayPath = useMemo(() => shortenPath(filePath), [filePath])
    const extensionLabel = useMemo(() => {
        const normalized = String(extension || '').trim().replace(/^\./, '').toUpperCase()
        return normalized || 'FILE'
    }, [extension])

    useEffect(() => {
        let cancelled = false

        void window.devscope.window.isMaximized().then((maximized) => {
            if (!cancelled) setIsMaximized(maximized)
        }).catch(() => {})

        return () => {
            cancelled = true
        }
    }, [])

    const handleMinimize = () => window.devscope.window.minimize()
    const handleToggleMaximize = () => {
        window.devscope.window.maximize()
        setIsMaximized((current) => !current)
    }
    const handleClose = () => window.devscope.window.close()

    return (
        <div className="flex h-[46px] shrink-0 items-center justify-between border-b border-white/10 bg-sparkle-bg">
            <div
                className="flex h-full min-w-0 flex-1 items-center gap-3 overflow-hidden border-r border-white/10 px-4"
                style={{ WebkitAppRegion: 'drag' } as CSSProperties}
                onDoubleClick={handleToggleMaximize}
            >
                <DevScopeLogoASCIIMini />
                <div className="flex min-w-0 items-center gap-2">
                    <span className="inline-flex shrink-0 items-center rounded-md border border-white/10 bg-white/[0.03] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-sparkle-text-secondary">
                        {extensionLabel}
                    </span>
                    <div className="min-w-0">
                        <div className="truncate text-[12px] font-medium text-sparkle-text">{fileName || title}</div>
                        <div className="truncate text-[10px] text-sparkle-text-muted">{displayPath || title}</div>
                    </div>
                </div>
                <button
                    type="button"
                    onClick={() => void navigator.clipboard.writeText(filePath).catch(() => undefined)}
                    className="ml-1 inline-flex size-7 shrink-0 items-center justify-center rounded-md border border-transparent bg-white/[0.02] text-sparkle-text-muted transition-colors hover:bg-white/[0.05] hover:text-sparkle-text"
                    style={{ WebkitAppRegion: 'no-drag' } as CSSProperties}
                    title="Copy file path"
                    aria-label="Copy file path"
                >
                    <Copy size={12} />
                </button>
            </div>
            <div className="flex shrink-0">
                <button
                    type="button"
                    onClick={handleMinimize}
                    className="inline-flex h-[46px] w-11 items-center justify-center text-sparkle-text-secondary transition-colors hover:bg-sparkle-accent"
                    aria-label="Minimize window"
                >
                    <Minus size={15} />
                </button>
                <button
                    type="button"
                    onClick={handleToggleMaximize}
                    className="inline-flex h-[46px] w-11 items-center justify-center text-sparkle-text-secondary transition-colors hover:bg-sparkle-accent"
                    aria-label={isMaximized ? 'Restore window' : 'Maximize window'}
                >
                    <Square size={13} className={cn(isMaximized && 'scale-[0.92]')} />
                </button>
                <button
                    type="button"
                    onClick={handleClose}
                    className="inline-flex h-[46px] w-11 items-center justify-center text-sparkle-text-secondary transition-colors hover:bg-red-600 hover:text-white"
                    aria-label="Close window"
                >
                    <X size={15} />
                </button>
            </div>
        </div>
    )
}

export default QuickPreviewTitleBar
