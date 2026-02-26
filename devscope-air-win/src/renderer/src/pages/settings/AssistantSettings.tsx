import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Bot, RefreshCw, Shield, Sparkles, PanelLeft, PlugZap, SlidersHorizontal, Gauge, BarChart3 } from 'lucide-react'
import { useSettings } from '@/lib/settings'
import { cn } from '@/lib/utils'
import AssistantAccountSettings from './AssistantAccountSettings'
import { ConfirmModal } from '@/components/ui/ConfirmModal'

type RuntimeModel = { id: string; label: string; isDefault: boolean }
type ModelListResponse = { success?: boolean; models?: RuntimeModel[]; error?: string }
const FALLBACK_MODEL_OPTIONS = [{ id: 'default', label: 'Default (server recommended)' }]

const ASSISTANT_PROFILE_OPTIONS = [
    { id: 'safe-dev', label: 'Safe Dev', desc: 'Standard development without execution privileges.' },
    { id: 'review', label: 'Review', desc: 'Read-only profile focused on analyzing code.' },
    { id: 'yolo-fast', label: 'YOLO Fast', desc: 'Optimized speed with full execution capabilities.' },
    { id: 'custom', label: 'Custom', desc: 'Manually composed system prompt behavior.' }
] as const

export default function AssistantSettings() {
    const { settings, updateSettings } = useSettings()
    const [activeTab, setActiveTab] = useState<'connection' | 'defaults' | 'behavior' | 'advanced' | 'account' | 'usage'>('connection')
    const [runtimeModels, setRuntimeModels] = useState<RuntimeModel[]>([])
    const [modelsLoading, setModelsLoading] = useState(false)
    const [modelsError, setModelsError] = useState<string | null>(null)
    const [showYoloConfirmModal, setShowYoloConfirmModal] = useState(false)

    const modelOptions = useMemo(() => {
        const defaultOption: RuntimeModel = { id: 'default', label: 'Default (server recommended)', isDefault: false }
        const source = runtimeModels.length > 0
            ? runtimeModels.map((model) => ({
                id: model.id,
                label: model.isDefault ? `${model.label} (default)` : model.label,
                isDefault: model.isDefault
            }))
            : FALLBACK_MODEL_OPTIONS.map((model) => ({ ...model, isDefault: false }))

        const deduped = new Map<string, RuntimeModel>()
        deduped.set(defaultOption.id, defaultOption)
        for (const model of source) {
            if (!model.id || model.id === 'default') continue
            deduped.set(model.id, model)
        }

        if (settings.assistantDefaultModel && !deduped.has(settings.assistantDefaultModel)) {
            deduped.set(settings.assistantDefaultModel, {
                id: settings.assistantDefaultModel,
                label: `${settings.assistantDefaultModel} (saved)`,
                isDefault: false
            })
        }

        return Array.from(deduped.values())
    }, [runtimeModels, settings.assistantDefaultModel])

    const normalizeModelResponse = (payload: ModelListResponse | null | undefined): RuntimeModel[] => {
        const list = Array.isArray(payload?.models) ? payload?.models : []
        const normalized = list
            .map((entry) => ({
                id: typeof entry?.id === 'string' ? entry.id.trim() : '',
                label: typeof entry?.label === 'string' && entry.label.trim() ? entry.label.trim() : '',
                isDefault: Boolean(entry?.isDefault)
            }))
            .filter((entry) => entry.id.length > 0)

        const seen = new Set<string>()
        const unique: RuntimeModel[] = []
        for (const entry of normalized) {
            if (seen.has(entry.id)) continue
            seen.add(entry.id)
            unique.push({
                ...entry,
                label: entry.label || entry.id
            })
        }
        return unique
    }

    const loadModels = useCallback(async () => {
        setModelsLoading(true)
        setModelsError(null)
        try {
            const directResult = await window.devscope.assistant.listModels()
            const directModels = normalizeModelResponse(directResult as ModelListResponse)
            if (directResult?.success && directModels.length > 0) {
                setRuntimeModels(directModels)
                return
            }

            const statusFallback = await window.devscope.assistant.status({ kind: 'models:list' })
            const fallbackModels = normalizeModelResponse(statusFallback as ModelListResponse)
            if (statusFallback?.success && fallbackModels.length > 0) {
                setRuntimeModels(fallbackModels)
                return
            }

            setRuntimeModels(directModels.length > 0 ? directModels : fallbackModels)
            setModelsError(
                (directResult as ModelListResponse)?.error
                || (statusFallback as ModelListResponse)?.error
                || 'Unable to load models from Codex runtime.'
            )
        } catch (error: any) {
            setRuntimeModels([])
            setModelsError(error?.message || 'Unable to load models from Codex runtime.')
        } finally {
            setModelsLoading(false)
        }
    }, [])

    useEffect(() => {
        void loadModels()
    }, [loadModels])

    return (
        <div className="animate-fadeIn">
            <div className="mb-8">
                <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-indigo-500/10">
                            <Bot className="text-indigo-300" size={24} />
                        </div>
                        <div>
                            <h1 className="text-2xl font-semibold text-sparkle-text">Assistant</h1>
                            <p className="text-sparkle-text-secondary">Control assistant startup, defaults, and safety mode</p>
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

            <div className="mb-6 inline-flex flex-wrap items-center rounded-lg border border-sparkle-border bg-sparkle-card p-1">
                <TabButton
                    title="Connection"
                    icon={<PlugZap size={14} />}
                    active={activeTab === 'connection'}
                    onClick={() => setActiveTab('connection')}
                />
                <TabButton
                    title="Defaults"
                    icon={<Sparkles size={14} />}
                    active={activeTab === 'defaults'}
                    onClick={() => setActiveTab('defaults')}
                />
                <TabButton
                    title="Behavior"
                    icon={<Shield size={14} />}
                    active={activeTab === 'behavior'}
                    onClick={() => setActiveTab('behavior')}
                />
                <TabButton
                    title="Advanced"
                    icon={<SlidersHorizontal size={14} />}
                    active={activeTab === 'advanced'}
                    onClick={() => setActiveTab('advanced')}
                />
                <TabButton
                    title="Account"
                    icon={<Gauge size={14} />}
                    active={activeTab === 'account'}
                    onClick={() => setActiveTab('account')}
                />
                <TabButton
                    title="Usage"
                    icon={<BarChart3 size={14} />}
                    active={activeTab === 'usage'}
                    onClick={() => setActiveTab('usage')}
                />
            </div>

            <div className="space-y-6">
                {activeTab === 'connection' && (
                    <SettingsSection title="Connection" description="Turn assistant on and control startup behavior.">
                        <div className="space-y-4">
                            <ToggleRow
                                icon={<Bot size={16} className="text-indigo-300" />}
                                title={settings.assistantEnabled ? 'Assistant enabled' : 'Assistant disabled'}
                                description="Disabled mode hides runtime controls and chat actions until re-enabled."
                                checked={settings.assistantEnabled}
                                onChange={(checked) => updateSettings({ assistantEnabled: checked })}
                            />
                            <ToggleRow
                                icon={<PlugZap size={16} className="text-cyan-300" />}
                                title="Auto-connect on Assistant page open"
                                description="Attempt connection automatically when opening Assistant."
                                checked={settings.assistantAutoConnectOnOpen}
                                onChange={(checked) => updateSettings({ assistantAutoConnectOnOpen: checked })}
                            />
                        </div>
                    </SettingsSection>
                )}

                {activeTab === 'defaults' && (
                    <SettingsSection title="Session Defaults" description="Choose model and safety policy used by default for new sessions.">
                        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                            <label className="text-sm text-sparkle-text-secondary">
                                <div className="flex items-center justify-between gap-2">
                                    <span>Default model</span>
                                    <button
                                        type="button"
                                        onClick={() => void loadModels()}
                                        disabled={modelsLoading}
                                        className="inline-flex items-center gap-1 rounded-md border border-sparkle-border px-2 py-1 text-xs text-sparkle-text-secondary hover:text-sparkle-text hover:bg-sparkle-card-hover disabled:opacity-50"
                                    >
                                        <RefreshCw size={12} className={cn(modelsLoading && 'animate-spin')} />
                                        Refresh
                                    </button>
                                </div>
                                <div>
                                    <select
                                        value={settings.assistantDefaultModel}
                                        onChange={(event) => updateSettings({ assistantDefaultModel: event.target.value })}
                                        className="mt-2 w-full rounded-lg border border-sparkle-border bg-sparkle-bg px-3 py-2 text-sm text-sparkle-text focus:outline-none focus:border-indigo-500/50"
                                    >
                                        {modelOptions.map((model) => (
                                            <option key={model.id} value={model.id}>
                                                {model.label}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                {modelsError && (
                                    <p className="mt-2 text-xs text-amber-300">
                                        {modelsError}
                                    </p>
                                )}
                                {!modelsError && runtimeModels.length > 0 && (
                                    <p className="mt-2 text-xs text-sparkle-text-muted">
                                        Loaded {runtimeModels.length} models from Codex runtime.
                                    </p>
                                )}
                            </label>

                            <label className="text-sm text-sparkle-text-secondary">
                                Approval mode
                                <div className="mt-2 inline-flex rounded-lg border border-sparkle-border bg-sparkle-bg p-1">
                                    <button
                                        onClick={() => updateSettings({ assistantApprovalMode: 'safe' })}
                                        className={cn(
                                            'px-3 py-1.5 rounded-md text-xs transition-colors',
                                            settings.assistantApprovalMode === 'safe'
                                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/35'
                                                : 'text-sparkle-text-secondary hover:text-sparkle-text hover:bg-sparkle-card-hover'
                                        )}
                                    >
                                        SAFE
                                    </button>
                                    <button
                                        onClick={() => {
                                            if (settings.assistantApprovalMode === 'yolo') return
                                            setShowYoloConfirmModal(true)
                                        }}
                                        className={cn(
                                            'px-3 py-1.5 rounded-md text-xs transition-colors',
                                            settings.assistantApprovalMode === 'yolo'
                                                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/35'
                                                : 'text-sparkle-text-secondary hover:text-sparkle-text hover:bg-sparkle-card-hover'
                                        )}
                                    >
                                        YOLO
                                    </button>
                                </div>
                                <p className="mt-2 text-xs text-sparkle-text-muted">
                                    SAFE asks before sensitive actions. YOLO auto-approves and is for trusted repos only.
                                </p>
                            </label>

                            <div className="col-span-1 xl:col-span-2 pt-2 border-t border-sparkle-border/50">
                                <span className="text-sm text-sparkle-text-secondary">Default Profile</span>
                                <p className="text-xs text-sparkle-text-muted mb-3">Choose the AI's system prompt and behavior model.</p>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    {ASSISTANT_PROFILE_OPTIONS.map(profile => (
                                        <button
                                            key={profile.id}
                                            onClick={() => updateSettings({ assistantProfile: profile.id })}
                                            className={cn(
                                                'px-4 py-3 rounded-lg border text-left transition-colors',
                                                settings.assistantProfile === profile.id
                                                    ? 'bg-indigo-500/10 text-indigo-300 border-indigo-500/35 ring-1 ring-indigo-500/35'
                                                    : 'bg-sparkle-bg border-sparkle-border text-sparkle-text hover:bg-sparkle-card-hover'
                                            )}
                                        >
                                            <div className="font-medium text-sm">{profile.label}</div>
                                            <div className={cn("text-xs mt-1", settings.assistantProfile === profile.id ? 'text-indigo-300/80' : 'text-sparkle-text-secondary')}>{profile.desc}</div>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </SettingsSection>
                )}

                {activeTab === 'behavior' && (
                    <SettingsSection title="Behavior" description="Adjust response detail and page-level assistant behavior.">
                        <div className="space-y-4">
                            <ToggleRow
                                icon={<Sparkles size={16} className="text-violet-300" />}
                                title="Show thinking details"
                                description="Display reasoning/thought stream in assistant responses."
                                checked={settings.assistantShowThinking}
                                onChange={(checked) => updateSettings({ assistantShowThinking: checked })}
                            />
                            <ToggleRow
                                icon={<PanelLeft size={16} className="text-cyan-300" />}
                                title="Allow Event Console in chat UI"
                                description="Show/hide event console controls in the Assistant page."
                                checked={settings.assistantAllowEventConsole}
                                onChange={(checked) => updateSettings({ assistantAllowEventConsole: checked, assistantShowEventPanel: checked ? settings.assistantShowEventPanel : false })}
                            />
                            <ToggleRow
                                icon={<Shield size={16} className="text-amber-300" />}
                                title="Show debug/event panel by default"
                                description="Open assistant with event diagnostics visible."
                                checked={settings.assistantAllowEventConsole && settings.assistantShowEventPanel}
                                disabled={!settings.assistantAllowEventConsole}
                                onChange={(checked) => updateSettings({ assistantShowEventPanel: checked, assistantAllowEventConsole: checked ? true : settings.assistantAllowEventConsole })}
                            />
                        </div>
                    </SettingsSection>
                )}
                {activeTab === 'advanced' && (
                    <SettingsSection title="Advanced Layout" description="Tune assistant sidebar behavior and dimensions.">
                        <div className="space-y-4">
                            <ToggleRow
                                icon={<PanelLeft size={16} className="text-indigo-300" />}
                                title="Sidebar collapsed by default"
                                description="Open assistant with compact sidebar mode."
                                checked={settings.assistantSidebarCollapsed}
                                onChange={(checked) => updateSettings({ assistantSidebarCollapsed: checked })}
                            />

                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <label className="text-sm text-sparkle-text">Default sidebar width</label>
                                    <span className="text-xs text-sparkle-text-muted font-mono">{settings.assistantSidebarWidth}px</span>
                                </div>
                                <input
                                    type="range"
                                    min={240}
                                    max={520}
                                    step={10}
                                    value={settings.assistantSidebarWidth}
                                    onChange={(event) => updateSettings({ assistantSidebarWidth: Number(event.target.value) })}
                                    className="w-full"
                                />
                            </div>
                        </div>
                    </SettingsSection>
                )}

                {activeTab === 'account' && (
                    <AssistantAccountSettings embedded forcedTab="account" />
                )}

                {activeTab === 'usage' && (
                    <AssistantAccountSettings embedded forcedTab="usage" />
                )}

                <div className="pt-1">
                    <button
                        onClick={() =>
                            updateSettings({
                                assistantEnabled: false,
                                assistantDefaultModel: 'default',
                                assistantApprovalMode: 'safe',
                                assistantShowThinking: true,
                                assistantAutoConnectOnOpen: false,
                                assistantSidebarCollapsed: false,
                                assistantSidebarWidth: 320,
                                assistantAllowEventConsole: true,
                                assistantShowEventPanel: false,
                                assistantProfile: 'safe-dev',
                                assistantProjectModels: {},
                                assistantProjectProfiles: {}
                            })
                        }
                        className="text-sm text-sparkle-text-secondary hover:text-[var(--accent-primary)] transition-colors"
                    >
                        Reset Assistant Defaults
                    </button>
                </div>
            </div>
            <ConfirmModal
                isOpen={showYoloConfirmModal}
                title="Enable YOLO mode by default?"
                message="YOLO mode auto-approves command execution and file modifications. Enable this only for trusted repositories."
                confirmLabel="Enable YOLO"
                onConfirm={() => {
                    updateSettings({ assistantApprovalMode: 'yolo' })
                    setShowYoloConfirmModal(false)
                }}
                onCancel={() => setShowYoloConfirmModal(false)}
                variant="warning"
            />
        </div>
    )
}

function TabButton({
    title,
    icon,
    active,
    onClick
}: {
    title: string
    icon: ReactNode
    active: boolean
    onClick: () => void
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={cn(
                'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs transition-colors',
                active
                    ? 'bg-[var(--accent-primary)] text-white'
                    : 'text-sparkle-text-secondary hover:bg-sparkle-bg hover:text-sparkle-text'
            )}
        >
            {icon}
            {title}
        </button>
    )
}

function SettingsSection({ title, description, children }: { title: string; description: string; children: ReactNode }) {
    return (
        <div className="bg-sparkle-card rounded-xl border border-sparkle-border p-6">
            <h2 className="font-semibold text-sparkle-text mb-1">{title}</h2>
            <p className="text-sm text-sparkle-text-secondary mb-4">{description}</p>
            {children}
        </div>
    )
}

function ToggleRow({
    icon,
    title,
    description,
    checked,
    disabled,
    onChange
}: {
    icon: ReactNode
    title: string
    description: string
    checked: boolean
    disabled?: boolean
    onChange: (next: boolean) => void
}) {
    return (
        <div className={cn('flex items-center justify-between gap-3 py-1', disabled && 'opacity-60')}>
            <div className="flex items-start gap-3">
                <span className="mt-0.5">{icon}</span>
                <div>
                    <p className="text-sm font-medium text-sparkle-text">{title}</p>
                    <p className="text-xs text-sparkle-text-secondary">{description}</p>
                </div>
            </div>
            <ToggleSwitch checked={checked} onChange={onChange} disabled={disabled} />
        </div>
    )
}

function ToggleSwitch({ checked, onChange, disabled }: { checked: boolean; onChange: (next: boolean) => void; disabled?: boolean }) {
    return (
        <button
            disabled={disabled}
            onClick={() => onChange(!checked)}
            className={cn(
                'w-12 h-7 rounded-full transition-colors relative shrink-0 disabled:cursor-not-allowed',
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
