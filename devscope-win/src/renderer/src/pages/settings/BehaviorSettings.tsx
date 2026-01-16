/**
 * DevScope - Behavior Settings Page
 */

import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, RefreshCw, Power, EyeOff } from 'lucide-react'
import { useSettings, RefreshInterval } from '@/lib/settings'
import { cn } from '@/lib/utils'

const REFRESH_INTERVALS: { value: RefreshInterval; label: string; description: string }[] = [
    { value: 'manual', label: 'Manual', description: 'Only refresh when you click' },
    { value: '5', label: '5 min', description: 'Frequent updates' },
    { value: '15', label: '15 min', description: 'Balanced' },
    { value: '30', label: '30 min', description: 'Less frequent' },
    { value: '60', label: '1 hour', description: 'Minimal updates' },
]

export default function BehaviorSettings() {
    const { settings, updateSettings } = useSettings()
    const [startupStatus, setStartupStatus] = useState<string | null>(null)

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
                <Link 
                    to="/settings" 
                    className="inline-flex items-center gap-2 text-sm text-sparkle-text-secondary hover:text-[var(--accent-primary)] transition-colors mb-4"
                >
                    <ArrowLeft size={16} />
                    Back to Settings
                </Link>
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-blue-500/10">
                        <RefreshCw className="text-blue-400" size={24} />
                    </div>
                    <div>
                        <h1 className="text-xl font-semibold text-sparkle-text">Behavior</h1>
                        <p className="text-sm text-sparkle-text-secondary">Auto-refresh and startup options</p>
                    </div>
                </div>
            </div>

            <div className="space-y-6">
                {/* Auto Refresh */}
                <SettingsSection title="Auto Refresh" description="Automatically re-scan tools at regular intervals">
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                        {REFRESH_INTERVALS.map((opt) => (
                            <button
                                key={opt.value}
                                onClick={() => updateSettings({ autoRefreshInterval: opt.value })}
                                className={cn(
                                    'px-3 py-3 rounded-xl border-2 transition-all flex flex-col items-center gap-1',
                                    settings.autoRefreshInterval === opt.value
                                        ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)]/10'
                                        : 'border-sparkle-border hover:border-sparkle-border-secondary'
                                )}
                            >
                                <span className="text-sm font-medium">{opt.label}</span>
                                <span className="text-xs text-sparkle-text-muted">{opt.description}</span>
                            </button>
                        ))}
                    </div>
                </SettingsSection>

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
