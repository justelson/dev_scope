/**
 * DevScope - Behavior Settings Page
 */

import { useEffect, useState, useRef, type ReactNode } from 'react'
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
    TerminalSquare,
    Play,
    X
} from 'lucide-react'
import { useSettings } from '@/lib/settings'
import { cn } from '@/lib/utils'

export default function BehaviorSettings() {
    const { settings, updateSettings } = useSettings()
    const [startupStatus, setStartupStatus] = useState<string | null>(null)
    const [activeTab, setActiveTab] = useState<'startup' | 'preview' | 'tasks'>('startup')
    const [showScrollPreview, setShowScrollPreview] = useState(false)

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
                            <div className="space-y-4">
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
                                <button
                                    type="button"
                                    onClick={() => setShowScrollPreview(true)}
                                    className="flex w-full items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm text-sparkle-text transition-all hover:border-white/20 hover:bg-white/[0.05]"
                                >
                                    <Play size={16} />
                                    Preview Scroll Behaviors
                                </button>
                            </div>
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

            {showScrollPreview && (
                <ScrollPreviewModal
                    currentMode={settings.scrollMode}
                    onClose={() => setShowScrollPreview(false)}
                    onApply={(mode) => {
                        updateSettings({ scrollMode: mode })
                        setShowScrollPreview(false)
                    }}
                />
            )}
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

function ScrollPreviewModal({
    currentMode,
    onClose,
    onApply
}: {
    currentMode: 'smooth' | 'native'
    onClose: () => void
    onApply: (mode: 'smooth' | 'native') => void
}) {
    const [previewMode, setPreviewMode] = useState<'smooth' | 'native'>(currentMode)
    const smoothScrollRef = useRef<HTMLDivElement>(null)
    const nativeScrollRef = useRef<HTMLDivElement>(null)

    // Smooth scroll implementation
    useEffect(() => {
        const container = smoothScrollRef.current
        if (!container) return

        let targetScrollTop = container.scrollTop
        let currentScrollTop = container.scrollTop
        let animationFrameId: number

        const smoothScroll = () => {
            const diff = targetScrollTop - currentScrollTop
            if (Math.abs(diff) > 0.5) {
                currentScrollTop += diff * 0.1
                container.scrollTop = currentScrollTop
                animationFrameId = requestAnimationFrame(smoothScroll)
            }
        }

        const handleWheel = (e: WheelEvent) => {
            e.preventDefault()
            targetScrollTop = Math.max(
                0,
                Math.min(
                    container.scrollHeight - container.clientHeight,
                    targetScrollTop + e.deltaY
                )
            )
            cancelAnimationFrame(animationFrameId)
            animationFrameId = requestAnimationFrame(smoothScroll)
        }

        container.addEventListener('wheel', handleWheel, { passive: false })

        return () => {
            container.removeEventListener('wheel', handleWheel)
            cancelAnimationFrame(animationFrameId)
        }
    }, [])

    const sampleContent = Array.from({ length: 30 }, (_, i) => {
        const categories = ['Project', 'Task', 'File', 'Component', 'Module', 'Service']
        const statuses = ['Active', 'Pending', 'Completed', 'In Progress', 'Review', 'Draft']
        const category = categories[i % categories.length]
        const status = statuses[i % statuses.length]
        
        return {
            id: i + 1,
            title: `${category} #${i + 1}`,
            status,
            description: `${status} ${category.toLowerCase()} with various properties and metadata. Scroll through this list to experience the ${previewMode} scroll behavior in action.`,
            timestamp: `${Math.floor(Math.random() * 24)}h ago`
        }
    })

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fadeIn">
            <div className="relative w-full max-w-5xl mx-4 rounded-xl border border-white/10 bg-sparkle-bg shadow-2xl">
                <div className="flex items-center justify-between border-b border-white/10 p-4">
                    <div>
                        <h2 className="text-lg font-semibold text-sparkle-text">Scroll Behavior Preview</h2>
                        <p className="text-sm text-sparkle-text-secondary">Try scrolling in each panel to compare</p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-lg p-2 text-sparkle-text-secondary transition-colors hover:bg-white/[0.03] hover:text-sparkle-text"
                    >
                        <X size={20} />
                    </button>
                </div>

                <div className="p-6">
                    <div className="mb-6 flex flex-col items-center gap-3">
                        <span className="text-sm text-sparkle-text-secondary">Select mode to preview:</span>
                        <div className="inline-flex items-center rounded-lg border border-white/10 bg-sparkle-card p-1">
                            <button
                                type="button"
                                onClick={() => setPreviewMode('smooth')}
                                className={cn(
                                    'rounded-md px-6 py-2 text-sm font-medium transition-colors',
                                    previewMode === 'smooth'
                                        ? 'bg-[var(--accent-primary)] text-white'
                                        : 'text-sparkle-text-secondary hover:bg-white/[0.03] hover:text-sparkle-text'
                                )}
                            >
                                Buttery
                            </button>
                            <button
                                type="button"
                                onClick={() => setPreviewMode('native')}
                                className={cn(
                                    'rounded-md px-6 py-2 text-sm font-medium transition-colors',
                                    previewMode === 'native'
                                        ? 'bg-[var(--accent-primary)] text-white'
                                        : 'text-sparkle-text-secondary hover:bg-white/[0.03] hover:text-sparkle-text'
                                )}
                            >
                                Native
                            </button>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className={cn(
                            "rounded-xl border overflow-hidden transition-all duration-300",
                            previewMode === 'smooth' 
                                ? "border-purple-500/50 shadow-lg shadow-purple-500/20 ring-2 ring-purple-500/30" 
                                : "border-white/10"
                        )}>
                            <div className={cn(
                                "border-b p-3 transition-colors",
                                previewMode === 'smooth'
                                    ? "bg-gradient-to-br from-purple-500/20 to-purple-600/10 border-purple-500/30"
                                    : "bg-white/[0.03] border-white/10"
                            )}>
                                <div className="flex items-center gap-2">
                                    <div className={cn(
                                        "h-2.5 w-2.5 rounded-full transition-all duration-300",
                                        previewMode === 'smooth' 
                                            ? "bg-purple-400 shadow-lg shadow-purple-400/50 animate-pulse" 
                                            : "bg-white/20"
                                    )} />
                                    <h3 className={cn(
                                        "text-sm font-semibold transition-colors",
                                        previewMode === 'smooth' ? "text-purple-300" : "text-sparkle-text"
                                    )}>Buttery Smooth</h3>
                                </div>
                                <p className="mt-1 text-xs text-sparkle-text-secondary">Eased, interpolated scrolling</p>
                            </div>
                            <div
                                ref={smoothScrollRef}
                                className={cn(
                                    "h-[400px] overflow-y-auto p-4 space-y-3 transition-colors",
                                    previewMode === 'smooth' ? "bg-purple-500/5" : "bg-sparkle-card"
                                )}
                                style={{ scrollBehavior: 'auto' }}
                            >
                                {sampleContent.map((item) => (
                                    <div
                                        key={item.id}
                                        className={cn(
                                            "rounded-lg border p-4 transition-all",
                                            previewMode === 'smooth'
                                                ? "border-purple-500/20 bg-purple-500/5 hover:bg-purple-500/10 hover:border-purple-500/30"
                                                : "border-white/10 bg-white/[0.03] hover:bg-white/[0.05]"
                                        )}
                                    >
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="flex-1 min-w-0">
                                                <h4 className="text-sm font-semibold text-sparkle-text">{item.title}</h4>
                                                <p className="mt-1.5 text-xs text-sparkle-text-secondary leading-relaxed">{item.description}</p>
                                            </div>
                                            <div className="flex flex-col items-end gap-1 shrink-0">
                                                <span className={cn(
                                                    "text-xs px-2 py-0.5 rounded-full",
                                                    item.status === 'Active' && "bg-green-500/20 text-green-400",
                                                    item.status === 'Pending' && "bg-yellow-500/20 text-yellow-400",
                                                    item.status === 'Completed' && "bg-blue-500/20 text-blue-400",
                                                    item.status === 'In Progress' && "bg-purple-500/20 text-purple-400",
                                                    item.status === 'Review' && "bg-orange-500/20 text-orange-400",
                                                    item.status === 'Draft' && "bg-gray-500/20 text-gray-400"
                                                )}>{item.status}</span>
                                                <span className="text-xs text-sparkle-text-secondary">{item.timestamp}</span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className={cn(
                            "rounded-xl border overflow-hidden transition-all duration-300",
                            previewMode === 'native' 
                                ? "border-blue-500/50 shadow-lg shadow-blue-500/20 ring-2 ring-blue-500/30" 
                                : "border-white/10"
                        )}>
                            <div className={cn(
                                "border-b p-3 transition-colors",
                                previewMode === 'native'
                                    ? "bg-gradient-to-br from-blue-500/20 to-blue-600/10 border-blue-500/30"
                                    : "bg-white/[0.03] border-white/10"
                            )}>
                                <div className="flex items-center gap-2">
                                    <div className={cn(
                                        "h-2.5 w-2.5 rounded-full transition-all duration-300",
                                        previewMode === 'native' 
                                            ? "bg-blue-400 shadow-lg shadow-blue-400/50 animate-pulse" 
                                            : "bg-white/20"
                                    )} />
                                    <h3 className={cn(
                                        "text-sm font-semibold transition-colors",
                                        previewMode === 'native' ? "text-blue-300" : "text-sparkle-text"
                                    )}>Native Platform</h3>
                                </div>
                                <p className="mt-1 text-xs text-sparkle-text-secondary">Direct, instant scrolling</p>
                            </div>
                            <div
                                ref={nativeScrollRef}
                                className={cn(
                                    "h-[400px] overflow-y-auto p-4 space-y-3 transition-colors",
                                    previewMode === 'native' ? "bg-blue-500/5" : "bg-sparkle-card"
                                )}
                            >
                                {sampleContent.map((item) => (
                                    <div
                                        key={item.id}
                                        className={cn(
                                            "rounded-lg border p-4 transition-all",
                                            previewMode === 'native'
                                                ? "border-blue-500/20 bg-blue-500/5 hover:bg-blue-500/10 hover:border-blue-500/30"
                                                : "border-white/10 bg-white/[0.03] hover:bg-white/[0.05]"
                                        )}
                                    >
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="flex-1 min-w-0">
                                                <h4 className="text-sm font-semibold text-sparkle-text">{item.title}</h4>
                                                <p className="mt-1.5 text-xs text-sparkle-text-secondary leading-relaxed">{item.description}</p>
                                            </div>
                                            <div className="flex flex-col items-end gap-1 shrink-0">
                                                <span className={cn(
                                                    "text-xs px-2 py-0.5 rounded-full",
                                                    item.status === 'Active' && "bg-green-500/20 text-green-400",
                                                    item.status === 'Pending' && "bg-yellow-500/20 text-yellow-400",
                                                    item.status === 'Completed' && "bg-blue-500/20 text-blue-400",
                                                    item.status === 'In Progress' && "bg-purple-500/20 text-purple-400",
                                                    item.status === 'Review' && "bg-orange-500/20 text-orange-400",
                                                    item.status === 'Draft' && "bg-gray-500/20 text-gray-400"
                                                )}>{item.status}</span>
                                                <span className="text-xs text-sparkle-text-secondary">{item.timestamp}</span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex items-center justify-end gap-3 border-t border-white/10 p-4">
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-lg border border-white/10 bg-sparkle-card px-4 py-2 text-sm text-sparkle-text transition-all hover:border-white/20 hover:bg-white/[0.03]"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={() => onApply(previewMode)}
                        className="rounded-lg bg-[var(--accent-primary)] px-4 py-2 text-sm text-white transition-all hover:opacity-90"
                    >
                        Apply {previewMode === 'smooth' ? 'Buttery' : 'Native'} Mode
                    </button>
                </div>
            </div>
        </div>
    )
}
