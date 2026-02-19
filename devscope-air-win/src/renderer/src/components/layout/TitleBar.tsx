/**
 * DevScope - TitleBar Component
 * Custom window controls for frameless Electron window
 */

import { useState, useEffect } from 'react'
import { Minus, Square, X, Copy, Search } from 'lucide-react'
import { DevScopeLogoASCIIMini } from '../ui/DevScopeLogo'
import { useCommandPalette } from '@/lib/commandPalette'

export default function TitleBar() {
    const [isMaximized, setIsMaximized] = useState(false)
    const { open } = useCommandPalette()

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

    return (
        <div className="h-[46px] fixed top-0 left-0 right-0 z-50 flex justify-between items-center bg-sparkle-bg border-b border-sparkle-border-secondary">
            {/* Logo & Title */}
            <div className="flex items-center gap-3 h-full w-64 px-4 border-r border-sparkle-border-secondary overflow-hidden" style={{ WebkitAppRegion: 'drag' } as any}>
                <DevScopeLogoASCIIMini />
            </div>

            {/* Center action */}
            <div className="flex-1 h-full flex items-center justify-center px-4" style={{ WebkitAppRegion: 'drag' } as any}>
                <button
                    onClick={(e) => { e.stopPropagation(); open() }}
                    className="group flex items-center gap-2 w-full max-w-md px-3 py-1.5 rounded-lg bg-sparkle-card/70 border border-sparkle-border-secondary text-sm text-sparkle-text-secondary hover:text-sparkle-text hover:bg-sparkle-accent/50 transition-all"
                    style={{ WebkitAppRegion: 'no-drag' } as any}
                    title="Open command palette (Ctrl+K)"
                >
                    <Search size={15} className="text-sparkle-text-muted group-hover:text-sparkle-text" />
                    <span className="flex-1 text-left truncate text-sparkle-text-muted group-hover:text-sparkle-text-secondary text-[13px]">
                        Search everywhere… (Ctrl+K)
                    </span>
                    <span className="hidden sm:flex items-center gap-1 text-[10px] text-sparkle-text-secondary bg-sparkle-accent/50 px-2 py-0.5 rounded-md border border-sparkle-border-secondary">
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

