/**
 * DevScope - Appearance Settings Page
 */

import { Link } from 'react-router-dom'
import { ArrowLeft, Palette, Check } from 'lucide-react'
import { useSettings, THEMES, ACCENT_COLORS } from '@/lib/settings'
import { cn } from '@/lib/utils'

export default function AppearanceSettings() {
    const { settings, updateSettings } = useSettings()

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
                    <div className="p-2 rounded-lg bg-purple-500/10">
                        <Palette className="text-purple-400" size={24} />
                    </div>
                    <div>
                        <h1 className="text-xl font-semibold text-sparkle-text">Appearance</h1>
                        <p className="text-sm text-sparkle-text-secondary">Theme, colors, and display options</p>
                    </div>
                </div>
            </div>

            <div className="space-y-6">
                {/* Theme Selection */}
                <SettingsSection title="Theme" description="Choose your preferred color scheme">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        {THEMES.map((t) => (
                            <button
                                key={t.id}
                                onClick={() => updateSettings({ theme: t.id })}
                                className={cn(
                                    'p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-3',
                                    settings.theme === t.id
                                        ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)]/10'
                                        : 'border-sparkle-border hover:border-sparkle-border-secondary'
                                )}
                            >
                                <div
                                    className="w-12 h-12 rounded-lg border border-white/10 shadow-inner"
                                    style={{ backgroundColor: t.color }}
                                />
                                <span className="text-sm font-medium">{t.name}</span>
                                {settings.theme === t.id && (
                                    <Check size={16} className="text-[var(--accent-primary)]" />
                                )}
                            </button>
                        ))}
                    </div>
                </SettingsSection>

                {/* Accent Color */}
                <SettingsSection title="Accent Color" description="Customize the highlight color throughout the app">
                    <div className="flex gap-3 flex-wrap">
                        {ACCENT_COLORS.map((color) => (
                            <button
                                key={color.name}
                                onClick={() => updateSettings({ accentColor: color })}
                                className={cn(
                                    'w-12 h-12 rounded-xl border-2 transition-all flex items-center justify-center',
                                    settings.accentColor.name === color.name
                                        ? 'border-white scale-110 shadow-lg'
                                        : 'border-transparent hover:scale-105'
                                )}
                                style={{ backgroundColor: color.primary }}
                                title={color.name}
                            >
                                {settings.accentColor.name === color.name && (
                                    <Check size={18} className="text-white drop-shadow" />
                                )}
                            </button>
                        ))}
                    </div>
                    <p className="text-xs text-sparkle-text-muted mt-3">
                        Current: <span className="text-[var(--accent-primary)]">{settings.accentColor.name}</span>
                    </p>
                </SettingsSection>

                {/* Compact Mode */}
                <SettingsSection title="Compact Mode" description="Reduce spacing for a denser interface">
                    <ToggleOption
                        checked={settings.compactMode}
                        onChange={(v) => updateSettings({ compactMode: v })}
                        label={settings.compactMode ? 'Enabled' : 'Disabled'}
                    />
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

function ToggleOption({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
    return (
        <div className="flex items-center justify-between">
            <span className="text-sm text-sparkle-text">{label}</span>
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
        </div>
    )
}
