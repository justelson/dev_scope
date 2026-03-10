/**
 * DevScope - Behavior Settings Page
 */

import { useEffect, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import {
    Activity,
    ArrowLeft,
    Edit3,
    Expand,
    Eye,
    EyeOff,
    Gauge,
    ListChecks,
    Mouse,
    PanelLeft,
    PanelRight,
    Power,
    TerminalSquare
} from 'lucide-react'
import { useSettings } from '@/lib/settings'
import { cn } from '@/lib/utils'

export default function BehaviorSettings() {
    const { settings, updateSettings } = useSettings()
    const [startupStatus, setStartupStatus] = useState<string | null>(null)
    const [activeTab, setActiveTab] = useState<'startup' | 'preview' | 'tasks'>('startup')

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
            .catch(() => {})

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
        } catch {
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
            <div className="mb-6">
                <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="rounded-lg bg-blue-500/10 p-2">
                            <Power className="text-blue-400" size={24} />
                        </div>
                        <div>
                            <h1 className="text-xl font-semibold text-sparkle-text">Behavior</h1>
                            <p className="text-sm text-sparkle-text-secondary">Startup, preview, and task controls</p>
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

            <div className="mb-6 inline-flex items-center rounded-lg border border-white/10 bg-sparkle-card p-1">
                <BehaviorTabButton
                    active={activeTab === 'startup'}
                    onClick={() => setActiveTab('startup')}
                    label="Startup & Scroll"
                />
                <BehaviorTabButton
                    active={activeTab === 'preview'}
                    onClick={() => setActiveTab('preview')}
                    label="File Preview"
                />
                <BehaviorTabButton
                    active={activeTab === 'tasks'}
                    onClick={() => setActiveTab('tasks')}
                    label="Tasks"
                />
            </div>

            <div className="space-y-6">
                {activeTab === 'startup' && (
                    <div className="grid gap-6 xl:grid-cols-2">
                        <SettingsSection
                            title="Startup"
                            description="Choose how DevScope behaves when Windows launches."
                        >
                            <div className="space-y-4">
                                <SettingRow
                                    icon={<Power size={20} className="text-sparkle-text-secondary" />}
                                    title={settings.startWithWindows ? 'Launch with Windows' : 'Manual launch only'}
                                    description={startupStatus || 'Open DevScope automatically every time Windows starts.'}
                                    control={(
                                        <ToggleSwitch
                                            checked={settings.startWithWindows}
                                            onChange={handleStartupToggle}
                                        />
                                    )}
                                />
                                <SettingRow
                                    icon={<EyeOff size={20} className="text-sparkle-text-secondary" />}
                                    title={settings.startMinimized ? 'Start hidden in tray' : 'Start with window visible'}
                                    description="Choose whether the app appears immediately or stays tucked into the tray."
                                    control={(
                                        <ToggleSwitch
                                            checked={settings.startMinimized}
                                            onChange={handleMinimizedToggle}
                                        />
                                    )}
                                />
                            </div>
                        </SettingsSection>

                        <SettingsSection
                            title="Scroll Feel"
                            description="Pick the scroll behavior that should be used across the app."
                        >
                            <SettingRow
                                icon={<Mouse size={20} className="text-sparkle-text-secondary" />}
                                title={settings.scrollMode === 'smooth' ? 'Buttery smooth scroll' : 'Native platform scroll'}
                                description="This affects long pages, settings views, and dense panels."
                                control={(
                                    <SegmentedControl
                                        activeKey={settings.scrollMode}
                                        options={[
                                            { key: 'smooth', label: 'Buttery' },
                                            { key: 'native', label: 'Native' }
                                        ]}
                                        onChange={(value) => updateSettings({ scrollMode: value as 'smooth' | 'native' })}
                                    />
                                )}
                            />
                        </SettingsSection>
                    </div>
                )}

                {activeTab === 'preview' && (
                    <div className="grid gap-6 xl:grid-cols-2">
                        <SettingsSection
                            title="Default Open State"
                            description="Control how file previews open by default in File Browse and Project Details."
                        >
                            <div className="space-y-4">
                                <SettingRow
                                    icon={<Expand size={20} className="text-sparkle-text-secondary" />}
                                    title={settings.filePreviewOpenInFullscreen ? 'Open in fullscreen mode' : 'Open in windowed mode'}
                                    description="Applies whenever a file preview modal is opened."
                                    control={(
                                        <ToggleSwitch
                                            checked={settings.filePreviewOpenInFullscreen}
                                            onChange={(next) => updateSettings({ filePreviewOpenInFullscreen: next })}
                                        />
                                    )}
                                />
                                <SettingRow
                                    icon={settings.filePreviewDefaultMode === 'edit'
                                        ? <Edit3 size={20} className="text-sparkle-text-secondary" />
                                        : <Eye size={20} className="text-sparkle-text-secondary" />}
                                    title={`Default mode: ${settings.filePreviewDefaultMode === 'edit' ? 'Edit' : 'Preview'}`}
                                    description="Used as the initial mode for newly opened previews."
                                    control={(
                                        <SegmentedControl
                                            activeKey={settings.filePreviewDefaultMode}
                                            options={[
                                                { key: 'preview', label: 'Preview' },
                                                { key: 'edit', label: 'Edit' }
                                            ]}
                                            onChange={(value) => updateSettings({ filePreviewDefaultMode: value as 'preview' | 'edit' })}
                                        />
                                    )}
                                />
                                <SettingRow
                                    icon={settings.filePreviewPythonRunMode === 'terminal'
                                        ? <TerminalSquare size={20} className="text-sparkle-text-secondary" />
                                        : <ListChecks size={20} className="text-sparkle-text-secondary" />}
                                    title={`Python run default: ${settings.filePreviewPythonRunMode === 'terminal' ? 'Terminal' : 'Output tab'}`}
                                    description="Controls the default selection in the preview Play dropdown."
                                    control={(
                                        <SegmentedControl
                                            activeKey={settings.filePreviewPythonRunMode}
                                            options={[
                                                { key: 'terminal', label: 'Terminal' },
                                                { key: 'output', label: 'Output' }
                                            ]}
                                            onChange={(value) => updateSettings({ filePreviewPythonRunMode: value as 'terminal' | 'output' })}
                                        />
                                    )}
                                />
                            </div>
                        </SettingsSection>

                        <SettingsSection
                            title="Fullscreen Sidebars"
                            description="Choose which side panels stay visible in fullscreen preview."
                        >
                            <div className="space-y-4">
                                <SettingRow
                                    icon={<PanelLeft size={20} className="text-sparkle-text-secondary" />}
                                    title={settings.filePreviewFullscreenShowLeftPanel ? 'Left panel enabled' : 'Left panel hidden'}
                                    description="Controls the left-side navigation and preview context area."
                                    control={(
                                        <ToggleSwitch
                                            checked={settings.filePreviewFullscreenShowLeftPanel}
                                            onChange={(next) => updateSettings({ filePreviewFullscreenShowLeftPanel: next })}
                                        />
                                    )}
                                />
                                <SettingRow
                                    icon={<PanelRight size={20} className="text-sparkle-text-secondary" />}
                                    title={settings.filePreviewFullscreenShowRightPanel ? 'Right panel enabled' : 'Right panel hidden'}
                                    description="Controls the secondary right-side info panel in fullscreen mode."
                                    control={(
                                        <ToggleSwitch
                                            checked={settings.filePreviewFullscreenShowRightPanel}
                                            onChange={(next) => updateSettings({ filePreviewFullscreenShowRightPanel: next })}
                                        />
                                    )}
                                />
                            </div>
                        </SettingsSection>
                    </div>
                )}

                {activeTab === 'tasks' && (
                    <div className="grid gap-6 xl:grid-cols-2">
                        <SettingsSection
                            title="Tasks Tab Availability"
                            description="Enable or disable the entire Tasks page from app navigation."
                        >
                            <SettingRow
                                icon={<Activity size={20} className="text-sparkle-text-secondary" />}
                                title={settings.tasksPageEnabled ? 'Tasks tab enabled' : 'Tasks tab disabled'}
                                description="When disabled, the Tasks tab is hidden and task-manager data is not fetched."
                                control={(
                                    <ToggleSwitch
                                        checked={settings.tasksPageEnabled}
                                        onChange={(next) => updateSettings({ tasksPageEnabled: next })}
                                    />
                                )}
                            />
                        </SettingsSection>

                        <SettingsSection
                            title="Running Apps Monitor"
                            description="Enable or disable the Running Apps section inside the Tasks page."
                        >
                            <SettingRow
                                icon={<Gauge size={20} className="text-sparkle-text-secondary" />}
                                title={settings.tasksRunningAppsEnabled ? 'Running Apps enabled' : 'Running Apps disabled'}
                                description="Disabled state stops running-app and process-resource queries entirely."
                                control={(
                                    <ToggleSwitch
                                        checked={settings.tasksRunningAppsEnabled}
                                        onChange={(next) => updateSettings({ tasksRunningAppsEnabled: next })}
                                        disabled={!settings.tasksPageEnabled}
                                    />
                                )}
                            />
                        </SettingsSection>
                    </div>
                )}
            </div>
        </div>
    )
}

function BehaviorTabButton({
    active,
    onClick,
    label
}: {
    active: boolean
    onClick: () => void
    label: string
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={cn(
                'rounded-md px-3 py-1.5 text-xs transition-colors',
                active
                    ? 'bg-[var(--accent-primary)] text-white'
                    : 'text-sparkle-text-secondary hover:bg-white/[0.03] hover:text-sparkle-text'
            )}
        >
            {label}
        </button>
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
        <div className="h-full rounded-xl border border-white/10 bg-sparkle-card p-5">
            <h2 className="mb-1 font-semibold text-sparkle-text">{title}</h2>
            <p className="mb-4 text-sm text-sparkle-text-secondary">{description}</p>
            {children}
        </div>
    )
}

function SettingRow({
    icon,
    title,
    description,
    control
}: {
    icon: ReactNode
    title: string
    description: string
    control: ReactNode
}) {
    return (
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0 flex-1">
                    <div className="flex items-start gap-3">
                        <div className="mt-0.5 shrink-0">{icon}</div>
                        <div className="min-w-0">
                            <p className="text-sm font-medium text-sparkle-text">{title}</p>
                            <p className="mt-1 text-xs text-sparkle-text-secondary">{description}</p>
                        </div>
                    </div>
                </div>
                <div className="shrink-0 lg:ml-4">
                    {control}
                </div>
            </div>
        </div>
    )
}

function SegmentedControl({
    activeKey,
    options,
    onChange
}: {
    activeKey: string
    options: Array<{ key: string; label: string }>
    onChange: (value: string) => void
}) {
    return (
        <div className="inline-flex items-center rounded-lg border border-white/10 bg-white/[0.03] p-1">
            {options.map((option) => (
                <button
                    key={option.key}
                    type="button"
                    onClick={() => onChange(option.key)}
                    className={cn(
                        'rounded-md px-3 py-1.5 text-xs transition-colors',
                        activeKey === option.key
                            ? 'bg-[var(--accent-primary)] text-white'
                            : 'text-sparkle-text-secondary hover:bg-white/[0.03] hover:text-sparkle-text'
                    )}
                >
                    {option.label}
                </button>
            ))}
        </div>
    )
}

function ToggleSwitch({
    checked,
    onChange,
    disabled
}: {
    checked: boolean
    onChange: (v: boolean) => void
    disabled?: boolean
}) {
    return (
        <button
            type="button"
            onClick={() => !disabled && onChange(!checked)}
            disabled={disabled}
            className={cn(
                'relative h-7 w-12 rounded-full transition-colors',
                checked ? 'bg-[var(--accent-primary)]' : 'bg-white/10',
                disabled && 'cursor-not-allowed opacity-50'
            )}
        >
            <div
                className={cn(
                    'absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-transform',
                    checked ? 'translate-x-6' : 'translate-x-1'
                )}
            />
        </button>
    )
}
