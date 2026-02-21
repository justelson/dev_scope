/**
 * DevScope - Behavior Settings Page
 */

import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Power, EyeOff, Mouse } from 'lucide-react'
import { useSettings } from '@/lib/settings'
import { cn } from '@/lib/utils'

export default function BehaviorSettings() {
    const { settings, updateSettings } = useSettings()
    const [startupStatus, setStartupStatus] = useState<string | null>(null)

    useEffect(() => {
        let isMounted = true

        void window.devscope.getStartupSettings?.()
            .then((result: any) => {
                if (!isMounted || !result?.success) return
                updateSettings({
                    startWithWindows: Boolean(result.openAtLogin),
                    startMinimized: Boolean(result.openAsHidden)
                })
            })
            .catch(() => { })

        return () => {
            isMounted = false
        }
    }, [])

    const handleStartupToggle = async (enabled: boolean) => {
        try {
            const result = await (window.devscope as any).setStartupSettings?.({
                openAtLogin: enabled,
                openAsHidden: settings.startMinimized
            })
            if (result?.success) {
                updateSettings({ startWithWindows: enabled })
                setStartupStatus(enabled ? 'Startup enabled' : 'Startup disabled')
            } else {
                setStartupStatus('Failed to update')
            }
        } catch (err) {
            setStartupStatus('Failed to update')
        }
        setTimeout(() => setStartupStatus(null), 3000)
    }

    const handleMinimizedToggle = async (minimized: boolean) => {
        updateSettings({ startMinimized: minimized })
        if (settings.startWithWindows) {
            await (window.devscope as any).setStartupSettings?.({
                openAtLogin: true,
                openAsHidden: minimized
            })
        }
    }

    return (
        <div className="animate-fadeIn">
            {/* Header */}
            <div className="mb-6">
                <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-blue-500/10">
                            <Power className="text-blue-400" size={24} />
                        </div>
                        <div>
                            <h1 className="text-xl font-semibold text-sparkle-text">Behavior</h1>
                            <p className="text-sm text-sparkle-text-secondary">Startup options</p>
                        </div>
                    </div>
                    <Link
                        to="/settings"
                        className="inline-flex items-center gap-2 px-4 py-2 text-sm text-sparkle-text hover:text-[var(--accent-primary)] bg-sparkle-card hover:bg-sparkle-card-hover border border-sparkle-border rounded-lg transition-all shrink-0"
                    >
                        <ArrowLeft size={16} />
                        Back to Settings
                    </Link>
                </div>
            </div>

            <div className="space-y-6">
                {/* Start with Windows */}
                <SettingsSection title="Start with Windows" description="Launch DevScope automatically when Windows starts">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <Power size={20} className="text-sparkle-text-secondary" />
                            <div>
                                <p className="text-sm font-medium text-sparkle-text">
                                    {settings.startWithWindows ? 'Enabled' : 'Disabled'}
                                </p>
                                {startupStatus && (
                                    <p className="text-xs text-[var(--accent-primary)]">{startupStatus}</p>
                                )}
                            </div>
                        </div>
                        <ToggleSwitch
                            checked={settings.startWithWindows}
                            onChange={handleStartupToggle}
                        />
                    </div>
                </SettingsSection>

                {/* Start Minimized */}
                <SettingsSection title="Start Minimized" description="Start in the system tray instead of showing the window">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <EyeOff size={20} className="text-sparkle-text-secondary" />
                            <p className="text-sm font-medium text-sparkle-text">
                                {settings.startMinimized ? 'Start hidden' : 'Start visible'}
                            </p>
                        </div>
                        <ToggleSwitch
                            checked={settings.startMinimized}
                            onChange={handleMinimizedToggle}
                        />
                    </div>
                </SettingsSection>

                <SettingsSection title="Scroll Feel" description="Choose between DevScope buttery scrolling and native app scrolling">
                    <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <Mouse size={20} className="text-sparkle-text-secondary" />
                            <p className="text-sm font-medium text-sparkle-text">
                                {settings.scrollMode === 'smooth' ? 'Buttery smooth' : 'Native'}
                            </p>
                        </div>

                        <div className="inline-flex items-center rounded-lg border border-sparkle-border bg-sparkle-bg p-1">
                            <button
                                onClick={() => updateSettings({ scrollMode: 'smooth' })}
                                className={cn(
                                    'px-3 py-1.5 rounded-md text-xs transition-colors',
                                    settings.scrollMode === 'smooth'
                                        ? 'bg-[var(--accent-primary)] text-white'
                                        : 'text-sparkle-text-secondary hover:text-sparkle-text hover:bg-sparkle-card-hover'
                                )}
                            >
                                Buttery
                            </button>
                            <button
                                onClick={() => updateSettings({ scrollMode: 'native' })}
                                className={cn(
                                    'px-3 py-1.5 rounded-md text-xs transition-colors',
                                    settings.scrollMode === 'native'
                                        ? 'bg-[var(--accent-primary)] text-white'
                                        : 'text-sparkle-text-secondary hover:text-sparkle-text hover:bg-sparkle-card-hover'
                                )}
                            >
                                Native
                            </button>
                        </div>
                    </div>
                </SettingsSection>
            </div>
        </div>
    )
}

function SettingsSection({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
    return (
        <div className="bg-sparkle-card rounded-xl border border-sparkle-border p-5">
            <h2 className="font-semibold text-sparkle-text mb-1">{title}</h2>
            <p className="text-sm text-sparkle-text-secondary mb-4">{description}</p>
            {children}
        </div>
    )
}

function ToggleSwitch({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
    return (
        <button
            onClick={() => onChange(!checked)}
            className={cn(
                'w-12 h-7 rounded-full transition-colors relative',
                checked ? 'bg-[var(--accent-primary)]' : 'bg-sparkle-border'
            )}
        >
            <div
                className={cn(
                    'absolute top-1 w-5 h-5 rounded-full bg-white transition-transform shadow',
                    checked ? 'translate-x-6' : 'translate-x-1'
                )}
            />
        </button>
    )
}


