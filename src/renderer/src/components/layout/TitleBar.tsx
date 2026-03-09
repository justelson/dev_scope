/**
 * DevScope - TitleBar Component
 * Custom window controls for frameless Electron window
 */

import { useState, useEffect } from 'react'
import { Minus, Square, X, Copy, Search, RefreshCw, Rocket } from 'lucide-react'
import { DevScopeLogoASCIIMini } from '../ui/DevScopeLogo'
import { useCommandPalette } from '@/lib/commandPalette'
import { getUpdateActionLabel, useAppUpdates } from '@/lib/app-updates'
import { cn } from '@/lib/utils'

export default function TitleBar() {
    const [isMaximized, setIsMaximized] = useState(false)
    const { open } = useCommandPalette()
    const { updateState, openModal, statusTone } = useAppUpdates()

    useEffect(() => {
        const checkMaximized = async () => {
            const maximized = await window.devscope.window.isMaximized()
            setIsMaximized(maximized)
        }
        checkMaximized()
    }, [])

    const handleMinimize = () => window.devscope.window.minimize()

    const handleMaximize = () => {
        window.devscope.window.maximize()
        setIsMaximized(!isMaximized)
    }

    const handleClose = () => window.devscope.window.close()
    const updateLabel = getUpdateActionLabel(updateState)

    const rocketToneClass = (() => {
        switch (statusTone) {
            case 'checking':
            case 'downloading':
                return 'border-sky-400/30 bg-sky-400/12 text-sky-200 hover:border-sky-300/45 hover:bg-sky-400/16'
            case 'available':
                return 'border-amber-400/35 bg-amber-400/14 text-amber-200 hover:border-amber-300/50 hover:bg-amber-400/18'
            case 'downloaded':
                return 'border-emerald-400/35 bg-emerald-400/14 text-emerald-200 hover:border-emerald-300/50 hover:bg-emerald-400/18'
            case 'up-to-date':
                return 'border-emerald-400/20 bg-emerald-400/10 text-emerald-100 hover:border-emerald-300/35 hover:bg-emerald-400/14'
            case 'error':
                return 'border-red-400/35 bg-red-400/14 text-red-200 hover:border-red-300/50 hover:bg-red-400/18'
            default:
                return 'border-white/10 bg-white/[0.03] text-white/75 hover:border-white/20 hover:bg-white/[0.06] hover:text-white'
        }
    })()

    return (
        <div className="fixed top-0 left-0 right-0 z-50 flex h-[46px] items-center justify-between border-b border-white/10 bg-sparkle-bg">
            {/* Logo & Title */}
            <div className="flex h-full w-64 items-center gap-3 overflow-hidden border-r border-white/10 px-4" style={{ WebkitAppRegion: 'drag' } as any}>
                <DevScopeLogoASCIIMini />
                <button
                    type="button"
                    onClick={() => openModal()}
                    className={cn(
                        'group inline-flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs transition-colors',
                        rocketToneClass
                    )}
                    style={{ WebkitAppRegion: 'no-drag' } as any}
                    title={updateLabel}
                >
                    {statusTone === 'checking' || statusTone === 'downloading' ? (
                        <RefreshCw size={14} className="animate-spin" />
                    ) : (
                        <Rocket size={14} className={cn(statusTone === 'available' && 'animate-pulse')} />
                    )}
                    <span className="max-w-[128px] truncate">{updateLabel}</span>
                </button>
            </div>

            {/* Center action */}
            <div className="flex-1 h-full flex items-center justify-center px-4" style={{ WebkitAppRegion: 'drag' } as any}>
                <button
                    onClick={(e) => { e.stopPropagation(); open() }}
                    className="group flex w-full max-w-md items-center gap-2 rounded-lg border border-white/10 bg-sparkle-card/70 px-3 py-1.5 text-sm text-sparkle-text-secondary transition-all hover:border-white/20 hover:bg-sparkle-accent/50 hover:text-sparkle-text"
                    style={{ WebkitAppRegion: 'no-drag' } as any}
                    title="Open command palette (Ctrl+K)"
                >
                    <Search size={15} className="text-sparkle-text-muted group-hover:text-sparkle-text" />
                    <span className="flex-1 text-left truncate text-sparkle-text-muted group-hover:text-sparkle-text-secondary text-[13px]">
                        Search everywhere… (Ctrl+K)
                    </span>
                    <span className="hidden rounded-md border border-white/10 bg-sparkle-accent/50 px-2 py-0.5 text-[10px] text-sparkle-text-secondary sm:flex items-center gap-1">
                        Ctrl + K
                    </span>
                </button>
            </div>

            {/* Window Controls */}
            <div className="flex">
                <button
                    onClick={handleMinimize}
                    className="h-[46px] w-11 inline-flex items-center justify-center text-sparkle-text-secondary hover:bg-sparkle-accent transition-colors"
                >
                    <Minus size={15} />
                </button>
                <button
                    onClick={handleMaximize}
                    className="h-[46px] w-11 inline-flex items-center justify-center text-sparkle-text-secondary hover:bg-sparkle-accent transition-colors"
                >
                    {isMaximized ? <Copy size={13} /> : <Square size={13} />}
                </button>
                <button
                    onClick={handleClose}
                    className="h-[46px] w-11 inline-flex items-center justify-center text-sparkle-text-secondary hover:bg-red-600 hover:text-white transition-colors"
                >
                    <X size={15} />
                </button>
            </div>
        </div>
    )
}

