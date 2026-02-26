/**
 * DevScope - Behavior Settings Page
 */

import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Power, EyeOff, Mouse, Expand, Eye, Edit3, PanelLeft, PanelRight } from 'lucide-react'
import { useSettings } from '@/lib/settings'
import { cn } from '@/lib/utils'

export default function BehaviorSettings() {
    const { settings, updateSettings } = useSettings()
    const [startupStatus, setStartupStatus] = useState<string | null>(null)
    const [activeTab, setActiveTab] = useState<'startup' | 'preview'>('startup')

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

            <div className="mb-6 inline-flex items-center rounded-lg border border-sparkle-border bg-sparkle-card p-1">
                <button
                    type="button"
                    onClick={() => setActiveTab('startup')}
                    className={cn(
                        'rounded-md px-3 py-1.5 text-xs transition-colors',
                        activeTab === 'startup'
                            ? 'bg-[var(--accent-primary)] text-white'
                            : 'text-sparkle-text-secondary hover:bg-sparkle-bg hover:text-sparkle-text'
                    )}
                >
                    Startup & Scroll
                </button>
                <button
                    type="button"
                    onClick={() => setActiveTab('preview')}
                    className={cn(
                        'rounded-md px-3 py-1.5 text-xs transition-colors',
                        activeTab === 'preview'
                            ? 'bg-[var(--accent-primary)] text-white'
                            : 'text-sparkle-text-secondary hover:bg-sparkle-bg hover:text-sparkle-text'
                    )}
                >
                    File Preview
                </button>
            </div>

            <div className="space-y-6">
                {activeTab === 'startup' && (
                    <>
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
                    </>
                )}

                {activeTab === 'preview' && (
                    <>
                        <SettingsSection title="Default Open State" description="Control how file previews open by default in File Browse and Project Details">
                            <div className="space-y-5">
                                <div className="flex items-center justify-between gap-4">
                                    <div className="flex items-center gap-3">
                                        <Expand size={20} className="text-sparkle-text-secondary" />
                                        <div>
                                            <p className="text-sm font-medium text-sparkle-text">
                                                {settings.filePreviewOpenInFullscreen ? 'Open in fullscreen mode' : 'Open in windowed mode'}
                                            </p>
                                            <p className="text-xs text-sparkle-text-secondary">Applies when opening any file preview modal</p>
                                        </div>
                                    </div>
                                    <ToggleSwitch
                                        checked={settings.filePreviewOpenInFullscreen}
                                        onChange={(next) => updateSettings({ filePreviewOpenInFullscreen: next })}
                                    />
                                </div>

                                <div className="flex items-center justify-between gap-4">
                                    <div className="flex items-center gap-3">
                                        {settings.filePreviewDefaultMode === 'edit'
                                            ? <Edit3 size={20} className="text-sparkle-text-secondary" />
                                            : <Eye size={20} className="text-sparkle-text-secondary" />}
                                        <p className="text-sm font-medium text-sparkle-text">
                                            Default mode: {settings.filePreviewDefaultMode === 'edit' ? 'Edit' : 'Preview'}
                                        </p>
                                    </div>

                                    <div className="inline-flex items-center rounded-lg border border-sparkle-border bg-sparkle-bg p-1">
                                        <button
                                            type="button"
                                            onClick={() => updateSettings({ filePreviewDefaultMode: 'preview' })}
                                            className={cn(
                                                'px-3 py-1.5 rounded-md text-xs transition-colors',
                                                settings.filePreviewDefaultMode === 'preview'
                                                    ? 'bg-[var(--accent-primary)] text-white'
                                                    : 'text-sparkle-text-secondary hover:text-sparkle-text hover:bg-sparkle-card-hover'
                                            )}
                                        >
                                            Preview
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => updateSettings({ filePreviewDefaultMode: 'edit' })}
                                            className={cn(
                                                'px-3 py-1.5 rounded-md text-xs transition-colors',
                                                settings.filePreviewDefaultMode === 'edit'
                                                    ? 'bg-[var(--accent-primary)] text-white'
                                                    : 'text-sparkle-text-secondary hover:text-sparkle-text hover:bg-sparkle-card-hover'
                                            )}
                                        >
                                            Edit
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </SettingsSection>

                        <SettingsSection title="Fullscreen Sidebars" description="Choose which side panels are shown when entering fullscreen preview">
                            <div className="space-y-4">
                                <div className="flex items-center justify-between gap-4">
                                    <div className="flex items-center gap-3">
                                        <PanelLeft size={20} className="text-sparkle-text-secondary" />
                                        <p className="text-sm font-medium text-sparkle-text">
                                            {settings.filePreviewFullscreenShowLeftPanel ? 'Left panel enabled' : 'Left panel hidden'}
                                        </p>
                                    </div>
                                    <ToggleSwitch
                                        checked={settings.filePreviewFullscreenShowLeftPanel}
                                        onChange={(next) => updateSettings({ filePreviewFullscreenShowLeftPanel: next })}
                                    />
                                </div>

                                <div className="flex items-center justify-between gap-4">
                                    <div className="flex items-center gap-3">
                                        <PanelRight size={20} className="text-sparkle-text-secondary" />
                                        <p className="text-sm font-medium text-sparkle-text">
                                            {settings.filePreviewFullscreenShowRightPanel ? 'Right panel enabled' : 'Right panel hidden'}
                                        </p>
                                    </div>
                                    <ToggleSwitch
                                        checked={settings.filePreviewFullscreenShowRightPanel}
                                        onChange={(next) => updateSettings({ filePreviewFullscreenShowRightPanel: next })}
                                    />
                                </div>
                            </div>
                        </SettingsSection>
                    </>
                )}
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


