/**
 * DevScope - Appearance Settings Page
 */

import { useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, ArrowLeft, Check, ChevronDown, ChevronUp, Palette } from 'lucide-react'
import { useSettings, THEMES, ACCENT_COLORS } from '@/lib/settings'
import { cn } from '@/lib/utils'

export default function AppearanceSettings() {
    const { settings, updateSettings } = useSettings()
    const [advancedOpen, setAdvancedOpen] = useState(false)

    const handleThemeChange = (themeId: string) => {
        const selectedTheme = THEMES.find((theme) => theme.id === themeId)
        if (!selectedTheme) return

        const matchingAccent = ACCENT_COLORS.find((color) => color.name === selectedTheme.accentColor)
        if (matchingAccent) {
            updateSettings({
                theme: selectedTheme.id,
                accentColor: matchingAccent
            })
            return
        }

        updateSettings({ theme: selectedTheme.id })
    }

    const isLightModeEnabled = settings.theme === 'light'
    const handleLightModeToggle = (enabled: boolean) => {
        if (enabled) {
            updateSettings({ theme: 'light' })
            return
        }

        if (settings.theme === 'light') {
            updateSettings({ theme: settings.lastDarkTheme })
        }
    }

    return (
        <div className="animate-fadeIn">
            <div className="mb-6">
                <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="rounded-lg bg-purple-500/10 p-2">
                            <Palette className="text-purple-400" size={24} />
                        </div>
                        <div>
                            <h1 className="text-xl font-semibold text-sparkle-text">Appearance</h1>
                            <p className="text-sm text-sparkle-text-secondary">Theme, colors, and display options</p>
                        </div>
                    </div>
                    <Link
                        to="/settings"
                        className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-white/10 bg-sparkle-card px-4 py-2 text-sm text-sparkle-text transition-all hover:border-white/20 hover:bg-white/[0.03] hover:text-[var(--accent-primary)]"
                    >
                        <ArrowLeft size={16} />
                        Back to Settings
                    </Link>
                </div>
            </div>

            <div className="space-y-6">
                <SettingsSection title="Theme" description="Choose your preferred color scheme.">
                    <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
                        {THEMES.map((theme) => {
                            const active = settings.theme === theme.id
                            return (
                                <button
                                    key={theme.id}
                                    type="button"
                                    onClick={() => handleThemeChange(theme.id)}
                                    className={cn(
                                        'w-full rounded-xl border px-4 py-3 text-left transition-colors',
                                        active
                                            ? 'border-white/20 bg-white/[0.05]'
                                            : 'border-white/10 bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.04]'
                                    )}
                                >
                                    <div className="flex items-start gap-3">
                                        <ThemeRadio active={active} />
                                        <div
                                            className="mt-0.5 h-9 w-9 shrink-0 rounded-lg border border-white/10 shadow-inner"
                                            style={{ backgroundColor: theme.color }}
                                        />
                                        <div className="min-w-0 flex-1">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <p className="text-sm font-medium text-sparkle-text">{theme.name}</p>
                                                {active && (
                                                    <span className="inline-flex rounded-full border border-white/10 bg-[var(--accent-primary)]/12 px-2 py-0.5 text-[10px] uppercase tracking-[0.18em] text-[var(--accent-primary)]">
                                                        Active
                                                    </span>
                                                )}
                                            </div>
                                            <p className="mt-1 text-xs text-sparkle-text-secondary">{theme.description}</p>
                                        </div>
                                    </div>
                                </button>
                            )
                        })}
                    </div>
                </SettingsSection>

                <SettingsSection title="Accent Color" description="Customize the highlight color throughout the app.">
                    <div className="flex flex-wrap gap-3">
                        {ACCENT_COLORS.map((color) => (
                            <button
                                key={color.name}
                                onClick={() => updateSettings({ accentColor: color })}
                                className={cn(
                                    'flex h-12 w-12 items-center justify-center rounded-xl border-2 transition-all',
                                    settings.accentColor.name === color.name
                                        ? 'scale-110 border-white shadow-lg'
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
                    <p className="mt-3 text-xs text-sparkle-text-muted">
                        Current: <span className="text-[var(--accent-primary)]">{settings.accentColor.name}</span>
                    </p>
                </SettingsSection>

                <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(280px,0.7fr)]">
                    <SettingsSection title="Compact Mode" description="Reduce spacing for a denser interface.">
                        <ToggleOption
                            checked={settings.compactMode}
                            onChange={(value) => updateSettings({ compactMode: value })}
                            label={settings.compactMode ? 'Enabled' : 'Disabled'}
                        />
                    </SettingsSection>

                    <div className="self-start">
                        <button
                            onClick={() => setAdvancedOpen((prev) => !prev)}
                            className="ml-auto inline-flex items-center gap-1 rounded-md border border-white/10 px-2.5 py-1 text-[11px] text-sparkle-text-secondary transition-colors hover:border-white/20 hover:text-sparkle-text"
                        >
                            <span>Advanced</span>
                            {advancedOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        </button>

                        {advancedOpen && (
                            <div className="mt-2 rounded-xl border border-red-400/20 bg-red-500/8 p-4 text-left">
                                <div className="flex items-start gap-3">
                                    <div className="mt-0.5 rounded-lg border border-red-400/20 bg-red-500/10 p-2 text-red-200">
                                        <AlertTriangle size={15} />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-red-200">
                                            Danger Zone
                                        </p>
                                        <p className="mt-2 text-sm font-medium text-sparkle-text">
                                            Light mode
                                        </p>
                                        <p className="mt-1 text-xs text-sparkle-text-secondary">
                                            Built by people who live in dark mode. Light mode exists, but some screens may still come out a little cursed because that path gets far less real use.
                                        </p>
                                        <div className="mt-4 rounded-lg border border-white/10 bg-black/10 p-3">
                                            <ToggleOption
                                                checked={isLightModeEnabled}
                                                onChange={handleLightModeToggle}
                                                label={isLightModeEnabled ? 'Enabled' : 'Disabled'}
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}

function ThemeRadio({ active }: { active: boolean }) {
    return (
        <span
            className={cn(
                'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-colors',
                active
                    ? 'border-[var(--accent-primary)]'
                    : 'border-white/15'
            )}
        >
            <span
                className={cn(
                    'h-2.5 w-2.5 rounded-full transition-colors',
                    active ? 'bg-[var(--accent-primary)]' : 'bg-transparent'
                )}
            />
        </span>
    )
}

function SettingsSection({
    title,
    description,
    children
}: {
    title: string
    description: string
    children: ReactNode
}) {
    return (
        <div className="rounded-xl border border-white/10 bg-sparkle-card p-5">
            <h2 className="mb-1 font-semibold text-sparkle-text">{title}</h2>
            <p className="mb-4 text-sm text-sparkle-text-secondary">{description}</p>
            {children}
        </div>
    )
}

function ToggleOption({
    checked,
    onChange,
    label
}: {
    checked: boolean
    onChange: (value: boolean) => void
    label: string
}) {
    return (
        <div className="flex items-center justify-between">
            <span className="text-sm text-sparkle-text">{label}</span>
            <button
                onClick={() => onChange(!checked)}
                className={cn(
                    'relative h-7 w-12 rounded-full transition-colors',
                    checked ? 'bg-[var(--accent-primary)]' : 'bg-white/10'
                )}
            >
                <div
                    className={cn(
                        'absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-transform',
                        checked ? 'translate-x-6' : 'translate-x-1'
                    )}
                />
            </button>
        </div>
    )
}
