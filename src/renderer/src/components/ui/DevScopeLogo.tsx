/**
 * DevScope Logo Component
 * Stylized logo based on the original README banner
 */

import { cn } from '@/lib/utils'
import { useSettings } from '@/lib/settings'

interface DevScopeLogoProps {
    size?: 'sm' | 'md' | 'lg' | 'xl'
    showText?: boolean
    className?: string
}

const THEME_COLORS = {
    dark: { primary: '#22d3ee', secondary: '#06b6d4', glow: 'cyan' },
    midnight: { primary: '#6366f1', secondary: '#4f46e5', glow: 'indigo' },
    purple: { primary: '#a78bfa', secondary: '#8b5cf6', glow: 'purple' },
    ocean: { primary: '#22d3ee', secondary: '#06b6d4', glow: 'cyan' },
    forest: { primary: '#34d399', secondary: '#10b981', glow: 'emerald' },
    slate: { primary: '#38bdf8', secondary: '#0ea5e9', glow: 'sky' },
    charcoal: { primary: '#fbbf24', secondary: '#f59e0b', glow: 'amber' },
    navy: { primary: '#60a5fa', secondary: '#3b82f6', glow: 'blue' },
    light: { primary: '#22d3ee', secondary: '#06b6d4', glow: 'cyan' },
    green: { primary: '#34d399', secondary: '#10b981', glow: 'emerald' }
} as const

const CLEAN_README_ASCII_BANNER = [
    '██████╗ ███████╗██╗   ██╗███████╗ ██████╗ ██████╗ ██████╗ ███████╗',
    '██╔══██╗██╔════╝██║   ██║██╔════╝██╔════╝██╔═══██╗██╔══██╗██╔════╝',
    '██║  ██║█████╗  ██║   ██║███████╗██║     ██║   ██║██████╔╝█████╗  ',
    '██║  ██║██╔══╝  ╚██╗ ██╔╝╚════██║██║     ██║   ██║██╔═══╝ ██╔══╝  ',
    '██████╔╝███████╗ ╚████╔╝ ███████║╚██████╗╚██████╔╝██║     ███████╗',
    '╚═════╝ ╚══════╝  ╚═══╝  ╚══════╝ ╚═════╝ ╚═════╝ ╚═╝     ╚══════╝'
].join('\n')

export default function DevScopeLogo({ size = 'md', showText = false, className }: DevScopeLogoProps) {
    const { settings } = useSettings()
    const themeColors = THEME_COLORS[settings.theme] || THEME_COLORS.dark

    const sizes = {
        sm: { icon: 24, text: 'text-xs' },
        md: { icon: 28, text: 'text-sm' },
        lg: { icon: 48, text: 'text-lg' },
        xl: { icon: 80, text: 'text-2xl' }
    }

    const { icon, text } = sizes[size] || sizes.md

    return (
        <div className={cn('flex items-center gap-2', className)}>
            <div
                className="relative flex items-center justify-center"
                style={{ width: icon, height: icon }}
            >
                <div
                    className="absolute inset-0 rounded-lg blur-sm"
                    style={{
                        background: `linear-gradient(to bottom right, ${themeColors.primary}33, ${themeColors.secondary}33)`
                    }}
                />

                <div
                    className="relative flex h-full w-full items-center justify-center overflow-hidden rounded-lg border bg-gradient-to-br from-[#0a1628] to-[#0c1a2e]"
                    style={{ borderColor: `${themeColors.primary}4D` }}
                >
                    <svg viewBox="0 0 24 24" className="h-[70%] w-[70%]" fill="none">
                        <g style={{ color: themeColors.primary }}>
                            <rect x="4" y="4" width="3" height="2" fill="currentColor" opacity="0.9" />
                            <rect x="7" y="4" width="3" height="2" fill="currentColor" opacity="0.8" />
                            <rect x="10" y="4" width="3" height="2" fill="currentColor" opacity="0.7" />
                            <rect x="13" y="5" width="2" height="2" fill="currentColor" opacity="0.6" />
                            <rect x="4" y="6" width="3" height="2" fill="currentColor" opacity="0.9" />
                            <rect x="4" y="8" width="3" height="2" fill="currentColor" opacity="0.85" />
                            <rect x="4" y="10" width="3" height="2" fill="currentColor" opacity="0.8" />
                            <rect x="4" y="12" width="3" height="2" fill="currentColor" opacity="0.85" />
                            <rect x="4" y="14" width="3" height="2" fill="currentColor" opacity="0.9" />
                            <rect x="4" y="16" width="3" height="2" fill="currentColor" opacity="0.9" />
                            <rect x="15" y="7" width="2" height="2" fill="currentColor" opacity="0.5" />
                            <rect x="16" y="9" width="2" height="2" fill="currentColor" opacity="0.4" />
                            <rect x="17" y="11" width="2" height="2" fill="currentColor" opacity="0.35" />
                            <rect x="16" y="13" width="2" height="2" fill="currentColor" opacity="0.4" />
                            <rect x="15" y="15" width="2" height="2" fill="currentColor" opacity="0.5" />
                            <rect x="4" y="18" width="3" height="2" fill="currentColor" opacity="0.9" />
                            <rect x="7" y="18" width="3" height="2" fill="currentColor" opacity="0.8" />
                            <rect x="10" y="18" width="3" height="2" fill="currentColor" opacity="0.7" />
                            <rect x="13" y="17" width="2" height="2" fill="currentColor" opacity="0.6" />
                        </g>
                        <rect x="2" y="2" width="2" height="2" fill={themeColors.primary} opacity="0.8" />
                    </svg>
                    <div
                        className="absolute inset-0 animate-pulse bg-gradient-to-b from-transparent via-transparent to-transparent"
                        style={{
                            backgroundImage: `linear-gradient(to bottom, transparent, ${themeColors.primary}0D, transparent)`
                        }}
                    />
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

export function DevScopeLogoMini({ className }: { className?: string }) {
    const { settings } = useSettings()
    const themeColors = THEME_COLORS[settings.theme] || THEME_COLORS.dark

    return (
        <div className={cn('relative inline-flex', className)}>
            <div
                className="relative flex h-7 w-7 items-center justify-center overflow-hidden rounded-lg border bg-gradient-to-br from-[#0a1628] to-[#0c1a2e]"
                style={{ borderColor: `${themeColors.primary}4D` }}
            >
                <span className="relative z-10 text-sm font-bold" style={{ color: themeColors.primary }}>D</span>
                <div
                    className="absolute left-0.5 top-0.5 h-1 w-1 rounded-full"
                    style={{ backgroundColor: themeColors.primary }}
                />
            </div>
        </div>
    )
}

export function DevScopeLogoASCII({ className }: { className?: string }) {
    const { settings } = useSettings()
    const themeColors = THEME_COLORS[settings.theme] || THEME_COLORS.dark

    return (
        <div className={cn('relative inline-block', className)}>
            <pre
                className="m-0 whitespace-pre text-[8px] leading-[1.1] font-mono select-none"
                style={{ color: themeColors.primary }}
            >
                {CLEAN_README_ASCII_BANNER}
            </pre>
        </div>
    )
}

export function DevScopeLogoASCIIMini({ className }: { className?: string }) {
    const { settings } = useSettings()
    const themeColors = THEME_COLORS[settings.theme] || THEME_COLORS.dark

    return (
        <div className={cn('relative inline-block', className)}>
            <pre
                className="m-0 whitespace-pre text-[4px] leading-[1] font-mono select-none"
                style={{ color: themeColors.primary }}
            >
                {CLEAN_README_ASCII_BANNER}
            </pre>
        </div>
    )
}
