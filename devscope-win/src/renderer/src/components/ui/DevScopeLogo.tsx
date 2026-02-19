/**
 * DevScope Logo Component
 * Stylized logo based on the ASCII art banner
 */

import { cn } from '@/lib/utils'

interface DevScopeLogoProps {
    size?: 'sm' | 'md' | 'lg' | 'xl'
    showText?: boolean
    className?: string
}

export default function DevScopeLogo({ size = 'md', showText = false, className }: DevScopeLogoProps) {
    const sizes = {
        sm: { icon: 24, text: 'text-xs' },
        md: { icon: 28, text: 'text-sm' },
        lg: { icon: 48, text: 'text-lg' },
        xl: { icon: 80, text: 'text-2xl' }
    }

    // Default to md if size not found
    const { text } = sizes[size] || sizes.md;

    return (
        <div className={cn('flex items-center gap-2', className)}>
            <div
                className="relative flex items-center justify-center"
                style={{ width: icon, height: icon }}
            >
                {/* Background glow */}
                <div
                    className="absolute inset-0 rounded-lg bg-gradient-to-br from-cyan-500/20 to-blue-500/20 blur-sm"
                />

                {/* Main logo container */}
                <div
                    className="relative w-full h-full rounded-lg bg-gradient-to-br from-[#0a1628] to-[#0c1a2e] border border-cyan-500/30 flex items-center justify-center overflow-hidden"
                >
                    {/* ASCII-style D character */}
                    <svg
                        viewBox="0 0 24 24"
                        className="w-[70%] h-[70%]"
                        fill="none"
                    >
                        {/* Stylized "D" made of blocks like ASCII art */}
                        <g className="text-cyan-400">
                            {/* Top horizontal */}
                            <rect x="4" y="4" width="3" height="2" fill="currentColor" opacity="0.9" />
                            <rect x="7" y="4" width="3" height="2" fill="currentColor" opacity="0.8" />
                            <rect x="10" y="4" width="3" height="2" fill="currentColor" opacity="0.7" />
                            <rect x="13" y="5" width="2" height="2" fill="currentColor" opacity="0.6" />

                            {/* Left vertical */}
                            <rect x="4" y="6" width="3" height="2" fill="currentColor" opacity="0.9" />
                            <rect x="4" y="8" width="3" height="2" fill="currentColor" opacity="0.85" />
                            <rect x="4" y="10" width="3" height="2" fill="currentColor" opacity="0.8" />
                            <rect x="4" y="12" width="3" height="2" fill="currentColor" opacity="0.85" />
                            <rect x="4" y="14" width="3" height="2" fill="currentColor" opacity="0.9" />
                            <rect x="4" y="16" width="3" height="2" fill="currentColor" opacity="0.9" />

                            {/* Right curve */}
                            <rect x="15" y="7" width="2" height="2" fill="currentColor" opacity="0.5" />
                            <rect x="16" y="9" width="2" height="2" fill="currentColor" opacity="0.4" />
                            <rect x="17" y="11" width="2" height="2" fill="currentColor" opacity="0.35" />
                            <rect x="16" y="13" width="2" height="2" fill="currentColor" opacity="0.4" />
                            <rect x="15" y="15" width="2" height="2" fill="currentColor" opacity="0.5" />

                            {/* Bottom horizontal */}
                            <rect x="4" y="18" width="3" height="2" fill="currentColor" opacity="0.9" />
                            <rect x="7" y="18" width="3" height="2" fill="currentColor" opacity="0.8" />
                            <rect x="10" y="18" width="3" height="2" fill="currentColor" opacity="0.7" />
                            <rect x="13" y="17" width="2" height="2" fill="currentColor" opacity="0.6" />
                        </g>

                        {/* Accent pixel */}
                        <rect x="2" y="2" width="2" height="2" fill="#22d3ee" opacity="0.8" />
                    </svg>

                    {/* Scan line effect */}
                    <div className="absolute inset-0 bg-gradient-to-b from-transparent via-cyan-400/5 to-transparent animate-pulse" />
                </div>
            </div>

            {showText && (
                <span className={cn('font-semibold text-sparkle-text', text)}>
                    DevScope
                </span>
            )}
        </div>
    )
}

// Mini version for tight spaces
export function DevScopeLogoMini({ className }: { className?: string }) {
    return (
        <div className={cn(
            'w-7 h-7 rounded-lg bg-gradient-to-br from-[#0a1628] to-[#0c1a2e] border border-cyan-500/30 flex items-center justify-center relative overflow-hidden',
            className
        )}>
            {/* Simple D */}
            <span className="text-cyan-400 font-bold text-sm relative z-10">D</span>
            {/* Accent dot */}
            <div className="absolute top-0.5 left-0.5 w-1 h-1 bg-cyan-400 rounded-full" />
        </div>
    )
}

// ASCII art version for About page
export function DevScopeLogoASCII({ className }: { className?: string }) {
    return (
        <pre className={cn(
            'text-cyan-400 text-[8px] leading-[1.1] font-mono select-none',
            className
        )}>
            {`    ██
 ██████╗ ███████╗██╗   ██╗███████╗ ██████╗ ██████╗ ██████╗ ███████╗
 ██╔══██╗██╔════╝██║   ██║██╔════╝██╔════╝██╔═══██╗██╔══██╗██╔════╝
 ██║  ██║█████╗  ██║   ██║███████╗██║     ██║   ██║██████╔╝█████╗  
 ██║  ██║██╔══╝  ╚██╗ ██╔╝╚════██║██║     ██║   ██║██╔═══╝ ██╔══╝  
 ██████╔╝███████╗ ╚████╔╝ ███████║╚██████╗╚██████╔╝██║     ███████╗
 ╚═════╝ ╚══════╝  ╚═══╝  ╚══════╝ ╚═════╝ ╚═════╝ ╚═╝     ╚══════╝`}
        </pre>
    )
}

// Compact ASCII for title bar - smaller version
export function DevScopeLogoASCIIMini({ className }: { className?: string }) {
    return (
        <pre className={cn(
            'text-cyan-400 text-[4px] leading-[1] font-mono select-none',
            className
        )}>
            {`██████╗ ███████╗██╗   ██╗███████╗ ██████╗ ██████╗ ██████╗ ███████╗
██╔══██╗██╔════╝██║   ██║██╔════╝██╔════╝██╔═══██╗██╔══██╗██╔════╝
██║  ██║█████╗  ██║   ██║███████╗██║     ██║   ██║██████╔╝█████╗  
██║  ██║██╔══╝  ╚██╗ ██╔╝╚════██║██║     ██║   ██║██╔═══╝ ██╔══╝  
██████╔╝███████╗ ╚████╔╝ ███████║╚██████╗╚██████╔╝██║     ███████╗
╚═════╝ ╚══════╝  ╚═══╝  ╚══════╝ ╚═════╝ ╚═════╝ ╚═╝     ╚══════╝`}
        </pre>
    )
}
