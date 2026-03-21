import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
    AlertCircle,
    ArrowLeft,
    Check,
    Eye,
    EyeOff,
    ExternalLink,
    Sparkles,
    Trash2,
    Wand2,
    Zap
} from 'lucide-react'
import { Select } from '@/components/ui/FormControls'
import { cn } from '@/lib/utils'
import { useSettings, type CommitAIProvider } from '@/lib/settings'

type ProviderStatus = 'idle' | 'testing' | 'success' | 'error'
type ModelOption = { id: string; label: string; description?: string }

const PROVIDER_MODELS: Record<CommitAIProvider, string> = {
    groq: 'llama-3.1-8b-instant',
    gemini: 'auto (Gemini Flash)',
    codex: 'custom Codex model'
}

const PROVIDER_COLORS: Record<CommitAIProvider, { primary: string; bg: string; border: string; icon: string }> = {
    groq: {
        primary: '#F55036',
        bg: 'bg-[#F55036]/10',
        border: 'border-[#F55036]/30',
        icon: 'text-[#F55036]'
    },
    gemini: {
        primary: '#4285F4',
        bg: 'bg-[#4285F4]/10',
        border: 'border-[#4285F4]/30',
        icon: 'text-[#4285F4]'
    },
    codex: {
        primary: '#10B981',
        bg: 'bg-[#10B981]/10',
        border: 'border-[#10B981]/30',
        icon: 'text-[#10B981]'
    }
}

function Card({
    title,
    description,
    children,
    className
}: {
    title: string
    description: string
    children: React.ReactNode
    className?: string
}) {
    return (
        <section className={cn('rounded-2xl border border-white/10 bg-sparkle-card p-6', className)}>
            <div className="mb-4">
                <h2 className="text-sm font-semibold text-sparkle-text">{title}</h2>
                <p className="mt-1 text-sm text-sparkle-text-secondary">{description}</p>
            </div>
            {children}
        </section>
    )
}

function ToggleRow({
    title,
    description,
    checked,
    onToggle
}: {
    title: string
    description: string
    checked: boolean
    onToggle: () => void
}) {
    return (
        <div className="flex items-center justify-between gap-4 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
            <div className="min-w-0">
                <p className="text-sm font-medium text-sparkle-text">{title}</p>
                <p className="mt-1 text-xs text-sparkle-text-secondary">{description}</p>
            </div>
            <button
                type="button"
                onClick={onToggle}
                className={cn(
                    'inline-flex h-7 w-12 items-center rounded-full border transition-all',
                    checked
                        ? 'border-white/20 bg-[var(--accent-primary)]/80 justify-end'
                        : 'border-white/10 bg-white/10 justify-start hover:border-white/20'
                )}
            >
                <span className="mx-1 h-4 w-4 rounded-full bg-white shadow-sm" />
            </button>
        </div>
    )
}

export default function AISettings() {
    const { settings, updateSettings } = useSettings()
    const [showGroqKey, setShowGroqKey] = useState(false)
    const [showGeminiKey, setShowGeminiKey] = useState(false)
    const [codexModelOptions, setCodexModelOptions] = useState<ModelOption[]>([])
    const [codexModelsError, setCodexModelsError] = useState('')
    const [testStatus, setTestStatus] = useState<Record<CommitAIProvider, ProviderStatus>>({
        groq: 'idle',
        gemini: 'idle',
        codex: 'idle'
    })
    const [testError, setTestError] = useState<Record<CommitAIProvider, string>>({
        groq: '',
        gemini: '',
        codex: ''
    })

    const setProvider = (provider: CommitAIProvider) => {
        updateSettings({ commitAIProvider: provider })
    }

    const updateProviderKey = (provider: Exclude<CommitAIProvider, 'codex'>, value: string) => {
        if (provider === 'groq') {
            updateSettings({ groqApiKey: value })
        } else {
            updateSettings({ geminiApiKey: value })
        }
        setTestStatus((prev) => ({ ...prev, [provider]: 'idle' }))
        setTestError((prev) => ({ ...prev, [provider]: '' }))
    }

    const updateCodexModel = (value: string) => {
        updateSettings({ codexModel: value })
        setTestStatus((prev) => ({ ...prev, codex: 'idle' }))
        setTestError((prev) => ({ ...prev, codex: '' }))
    }

    useEffect(() => {
        let cancelled = false

        async function loadCodexModels() {
            try {
                const result = await window.devscope.assistant.listModels(false)
                if (!result.success) {
                    throw new Error(result.error || 'Failed to load Codex models.')
                }
                if (cancelled) return
                setCodexModelOptions(Array.isArray(result.models) ? result.models : [])
                setCodexModelsError('')
            } catch (error) {
                if (!cancelled) {
                    setCodexModelOptions([])
                    setCodexModelsError(error instanceof Error ? error.message : 'Failed to load Codex models.')
                }
            }
        }

        void loadCodexModels()
        return () => {
            cancelled = true
        }
    }, [])

    const handleTestConnection = async (provider: CommitAIProvider) => {
        const apiKey = provider === 'groq' ? settings.groqApiKey : provider === 'gemini' ? settings.geminiApiKey : ''
        if (provider !== 'codex' && !apiKey) return

        setTestStatus((prev) => ({ ...prev, [provider]: 'testing' }))
        setTestError((prev) => ({ ...prev, [provider]: '' }))

        try {
            const result = provider === 'groq'
                ? await window.devscope.testGroqConnection(apiKey)
                : provider === 'gemini'
                    ? await window.devscope.testGeminiConnection(apiKey)
                    : await window.devscope.testCodexConnection(settings.codexModel || settings.assistantDefaultModel || undefined)

            if (result.success) {
                setTestStatus((prev) => ({ ...prev, [provider]: 'success' }))
            } else {
                setTestStatus((prev) => ({ ...prev, [provider]: 'error' }))
                setTestError((prev) => ({ ...prev, [provider]: result.error || 'Connection failed' }))
            }
        } catch (error) {
            setTestStatus((prev) => ({ ...prev, [provider]: 'error' }))
            setTestError((prev) => ({
                ...prev,
                [provider]: error instanceof Error ? error.message : 'Connection failed'
            }))
        }
    }

    const hasAnyKey = Boolean(settings.groqApiKey || settings.geminiApiKey)
    const activeProvider = settings.commitAIProvider
    const activeModel = activeProvider === 'codex'
        ? (settings.codexModel || settings.assistantDefaultModel || PROVIDER_MODELS.codex)
        : PROVIDER_MODELS[activeProvider]
    const activeColors = PROVIDER_COLORS[activeProvider]
    const effectiveCodexModel = settings.codexModel || settings.assistantDefaultModel || ''
    const resolvedCodexModelOptions = useMemo(() => {
        const options = [...codexModelOptions]
        const currentValue = String(effectiveCodexModel || '').trim()
        if (currentValue && !options.some((option) => option.id === currentValue)) {
            options.unshift({ id: currentValue, label: currentValue, description: 'Currently selected model' })
        }
        if (options.length === 0) {
            options.push({ id: '', label: 'Default Codex model' })
        } else if (!options.some((option) => option.id === '')) {
            options.unshift({ id: '', label: 'Default Codex model' })
        }
        return options
    }, [codexModelOptions, effectiveCodexModel])

    return (
        <div className="animate-fadeIn">
            <div className="mb-8">
                <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="rounded-lg bg-violet-500/10 p-2">
                            <Sparkles className="text-violet-400" size={24} />
                        </div>
                        <div>
                            <h1 className="text-2xl font-semibold text-sparkle-text">AI Features</h1>
                            <p className="text-sparkle-text-secondary">
                                Configure commit-message and PR-draft AI providers.
                            </p>
                        </div>
                    </div>
                    <Link
                        to="/settings"
                        className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-white/10 bg-sparkle-card px-4 py-2 text-sm text-sparkle-text transition-all hover:border-white/20 hover:bg-white/[0.03] hover:text-[var(--accent-primary)]"
                    >
                        <ArrowLeft size={16} />
                        <span>Back to Settings</span>
                    </Link>
                </div>
            </div>

            <div className="space-y-6">
                <section className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.04] via-white/[0.02] to-transparent p-6">
                    <div 
                        className="absolute right-0 top-0 h-32 w-32 -translate-y-1/2 translate-x-1/2 rounded-full blur-3xl" 
                        style={{ backgroundColor: `${activeColors.primary}20` }}
                    />
                    <div className="relative">
                        <div className="mb-3 flex items-center gap-2">
                            <Zap className={activeColors.icon} size={18} />
                            <p className={cn('text-xs font-semibold uppercase tracking-[0.18em]', activeColors.icon)}>
                                Active AI Configuration
                            </p>
                        </div>
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                            <div className="flex items-center gap-4">
                                <div className={cn('rounded-xl border p-3', activeColors.border, activeColors.bg)}>
                                    <Wand2 className={activeColors.icon} size={20} />
                                </div>
                                <div>
                                    <p className="text-base font-semibold text-sparkle-text">
                                        {activeProvider === 'groq' ? 'Groq' : activeProvider === 'gemini' ? 'Google Gemini' : 'Codex'}
                                    </p>
                                    <code className={cn('text-xs font-mono', activeColors.icon)}>{activeModel}</code>
                                </div>
                            </div>
                            <div className="hidden h-8 w-px bg-white/5 lg:block" />
                            <div className="flex items-center gap-2">
                                <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5">
                                    <span className="text-xs text-sparkle-text-secondary">Access: </span>
                                    <span className={cn(
                                        'text-xs font-medium',
                                        activeProvider === 'codex'
                                            ? 'text-emerald-300'
                                            : hasAnyKey
                                                ? 'text-green-400'
                                                : 'text-red-400'
                                    )}>
                                        {activeProvider === 'codex' ? 'Codex CLI' : hasAnyKey ? 'API key configured' : 'Missing API key'}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                <Card
                    title="Git AI Provider"
                    description="Choose the default AI provider for commit-message generation and AI-authored PR drafts in DevScope Git flows."
                >
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        {(['groq', 'gemini', 'codex'] as CommitAIProvider[]).map((provider) => {
                            const selected = settings.commitAIProvider === provider
                            const colors = PROVIDER_COLORS[provider]
                            return (
                                <button
                                    key={provider}
                                    type="button"
                                    onClick={() => setProvider(provider)}
                                    className={cn(
                                        'group relative rounded-xl border px-5 py-4 text-left transition-all',
                                        selected
                                            ? `${colors.border} ${colors.bg} shadow-lg`
                                            : 'border-white/10 bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.05]'
                                    )}
                                >
                                    {selected && (
                                        <div className="absolute right-3 top-3">
                                            <div className={cn('rounded-full p-1', colors.bg)}>
                                                <Check size={14} className={colors.icon} />
                                            </div>
                                        </div>
                                    )}
                                    <div className="flex items-center gap-3 mb-2">
                                        <div className={cn(
                                            'rounded-lg p-2 transition-colors',
                                            selected ? colors.bg : 'bg-white/[0.05] group-hover:bg-white/[0.08]'
                                        )}>
                                            <Zap size={18} className={selected ? colors.icon : 'text-sparkle-text-secondary'} />
                                        </div>
                                        <p className={cn(
                                            'text-base font-semibold transition-colors',
                                            selected ? colors.icon : 'text-sparkle-text'
                                        )}>
                                            {provider === 'groq' ? 'Groq' : provider === 'gemini' ? 'Google Gemini' : 'Codex'}
                                        </p>
                                    </div>
                                    <p className="text-sm text-sparkle-text-secondary mb-2">
                                        {provider === 'groq' ? 'Very fast inference' : provider === 'gemini' ? 'Gemini API models' : 'Uses the local Codex CLI session'}
                                    </p>
                                    <div className={cn(
                                        'rounded-lg px-2.5 py-1.5 text-[11px] font-mono',
                                        selected 
                                            ? `${colors.bg} ${colors.icon}` 
                                            : 'bg-white/[0.05] text-sparkle-text-muted'
                                    )}>
                                        {PROVIDER_MODELS[provider]}
                                    </div>
                                </button>
                            )
                        })}
                    </div>
                </Card>

                <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
                    <ProviderKeyCard
                        provider="groq"
                        model={PROVIDER_MODELS.groq}
                        value={settings.groqApiKey}
                        showKey={showGroqKey}
                        onToggleShow={() => setShowGroqKey((value) => !value)}
                        onChange={(value) => updateProviderKey('groq', value)}
                        onTest={() => handleTestConnection('groq')}
                        status={testStatus.groq}
                        error={testError.groq}
                        docsUrl="https://console.groq.com/keys"
                    />

                    <ProviderKeyCard
                        provider="gemini"
                        model={PROVIDER_MODELS.gemini}
                        value={settings.geminiApiKey}
                        showKey={showGeminiKey}
                        onToggleShow={() => setShowGeminiKey((value) => !value)}
                        onChange={(value) => updateProviderKey('gemini', value)}
                        onTest={() => handleTestConnection('gemini')}
                        status={testStatus.gemini}
                        error={testError.gemini}
                        docsUrl="https://aistudio.google.com/app/apikey"
                    />

                    <CodexProviderCard
                        model={effectiveCodexModel}
                        modelOptions={resolvedCodexModelOptions}
                        modelsError={codexModelsError}
                        onChange={updateCodexModel}
                        onTest={() => handleTestConnection('codex')}
                        status={testStatus.codex}
                        error={testError.codex}
                    />
                </div>

                {hasAnyKey && (
                    <div className="flex justify-center pt-2">
                        <button
                            type="button"
                            onClick={() => {
                                updateSettings({ groqApiKey: '', geminiApiKey: '' })
                                setTestStatus({ groq: 'idle', gemini: 'idle', codex: testStatus.codex })
                                setTestError({ groq: '', gemini: '', codex: testError.codex })
                            }}
                            className="inline-flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-2 text-sm text-red-400 transition-all hover:border-red-500/30 hover:bg-red-500/15"
                        >
                            <Trash2 size={14} />
                            Clear all API keys
                        </button>
                    </div>
                )}
            </div>
        </div>
    )
}

function CodexProviderCard({
    model,
    modelOptions,
    modelsError,
    onChange,
    onTest,
    status,
    error
}: {
    model: string
    modelOptions: ModelOption[]
    modelsError: string
    onChange: (value: string) => void
    onTest: () => void
    status: ProviderStatus
    error: string
}) {
    const colors = PROVIDER_COLORS.codex

    return (
        <section className={cn(
            'rounded-2xl border p-6 transition-all',
            'border-white/10 bg-sparkle-card hover:border-white/15'
        )}>
            <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className={cn('rounded-lg p-2', colors.bg)}>
                        <Zap size={18} className={colors.icon} />
                    </div>
                    <div>
                        <h3 className="font-semibold text-sparkle-text">Codex CLI</h3>
                        <p className="text-xs text-sparkle-text-secondary mt-0.5">No API key required here</p>
                    </div>
                </div>
            </div>

            <p className="mb-3 text-sm text-sparkle-text-secondary leading-relaxed">
                Uses the installed Codex CLI for commit-message generation and PR draft writing. Set the model you want these Git flows to use.
            </p>

            <div className={cn('mb-4 rounded-lg px-3 py-2 text-xs font-mono', colors.bg, colors.icon)}>
                Model: {model || 'Default Codex model'}
            </div>

            <div className="space-y-3">
                <div>
                    <p className="mb-2 text-[11px] uppercase tracking-[0.18em] text-white/35">Codex model</p>
                    <Select
                        value={model}
                        onChange={onChange}
                        options={modelOptions.map((option) => ({
                            value: option.id,
                            label: option.label
                        }))}
                        placeholder="Select a Codex model"
                    />
                    {modelsError ? (
                        <p className="mt-2 text-xs text-amber-300">{modelsError}</p>
                    ) : null}
                </div>

                <button
                    type="button"
                    onClick={onTest}
                    disabled={status === 'testing'}
                    className={cn(
                        'inline-flex w-full items-center justify-center gap-2 rounded-xl border px-5 py-3 text-sm font-medium text-white transition-all',
                        'disabled:cursor-not-allowed disabled:opacity-50',
                        'hover:opacity-90 active:scale-[0.98]',
                        colors.border
                    )}
                    style={{ backgroundColor: colors.primary }}
                >
                    {status === 'testing' ? (
                        <>
                            <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                            Testing...
                        </>
                    ) : status === 'success' ? (
                        <>
                            <Check size={16} />
                            Connected
                        </>
                    ) : (
                        <>
                            <Zap size={16} />
                            Test Codex CLI
                        </>
                    )}
                </button>
            </div>

            {status === 'success' && (
                <div className="mt-4 flex items-center gap-2 rounded-xl border border-green-500/20 bg-green-500/10 px-4 py-3 text-sm text-green-300">
                    <Check size={16} className="shrink-0" />
                    <span>Codex CLI is available and responded successfully.</span>
                </div>
            )}

            {status === 'error' && (
                <div className="mt-4 flex items-start gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                    <AlertCircle size={16} className="shrink-0 mt-0.5" />
                    <span>{error}</span>
                </div>
            )}
        </section>
    )
}

function ProviderKeyCard({
    provider,
    model,
    value,
    showKey,
    onToggleShow,
    onChange,
    onTest,
    status,
    error,
    docsUrl
}: {
    provider: Exclude<CommitAIProvider, 'codex'>
    model: string
    value: string
    showKey: boolean
    onToggleShow: () => void
    onChange: (value: string) => void
    onTest: () => void
    status: ProviderStatus
    error: string
    docsUrl: string
}) {
    const isGroq = provider === 'groq'
    const colors = PROVIDER_COLORS[provider]

    return (
        <section className={cn(
            'rounded-2xl border p-6 transition-all',
            'border-white/10 bg-sparkle-card hover:border-white/15'
        )}>
            <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className={cn('rounded-lg p-2', colors.bg)}>
                        <Zap size={18} className={colors.icon} />
                    </div>
                    <div>
                        <h3 className="font-semibold text-sparkle-text">
                            {isGroq ? 'Groq API Key' : 'Gemini API Key'}
                        </h3>
                        <p className="text-xs text-sparkle-text-secondary mt-0.5">
                            {isGroq ? 'gsk_*' : 'AIza*'}
                        </p>
                    </div>
                </div>
            </div>
            
            <p className="mb-3 text-sm text-sparkle-text-secondary leading-relaxed">
                {isGroq
                    ? 'Used for low-latency commit message generation with Groq-hosted models.'
                    : 'Used for commit message generation through Google Gemini models.'}
            </p>
            
            <div className={cn('mb-4 rounded-lg px-3 py-2 text-xs font-mono', colors.bg, colors.icon)}>
                Model: {model}
            </div>

            <div className="mb-4 flex flex-col gap-3 sm:flex-row">
                <div className="relative flex-1">
                    <input
                        type={showKey ? 'text' : 'password'}
                        value={value}
                        onChange={(event) => onChange(event.target.value)}
                        placeholder={isGroq ? 'gsk_xxxxxxxxxxxx...' : 'AIzaSyxxxxxxxxxxxx...'}
                        className="w-full rounded-xl border border-white/10 bg-black/10 px-4 py-3 pr-12 text-sm font-mono text-sparkle-text placeholder:text-sparkle-text-muted focus:border-white/20 focus:outline-none transition-colors"
                    />
                    <button
                        type="button"
                        onClick={onToggleShow}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-sparkle-text-muted transition-colors hover:text-sparkle-text"
                        title={showKey ? 'Hide key' : 'Show key'}
                    >
                        {showKey ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                </div>

                <button
                    type="button"
                    onClick={onTest}
                    disabled={!value || status === 'testing'}
                    className={cn(
                        'inline-flex items-center justify-center gap-2 rounded-xl border px-5 py-3 text-sm font-medium text-white transition-all',
                        'disabled:cursor-not-allowed disabled:opacity-50',
                        'hover:opacity-90 active:scale-[0.98]',
                        colors.border
                    )}
                    style={{ backgroundColor: colors.primary }}
                >
                    {status === 'testing' ? (
                        <>
                            <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                            Testing...
                        </>
                    ) : status === 'success' ? (
                        <>
                            <Check size={16} />
                            Connected
                        </>
                    ) : (
                        <>
                            <Zap size={16} />
                            Test Connection
                        </>
                    )}
                </button>
            </div>

            {status === 'success' && (
                <div className="flex items-center gap-2 rounded-xl border border-green-500/20 bg-green-500/10 px-4 py-3 text-sm text-green-300">
                    <Check size={16} className="shrink-0" />
                    <span>API key is valid and connection succeeded.</span>
                </div>
            )}

            {status === 'error' && (
                <div className="flex items-start gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                    <AlertCircle size={16} className="shrink-0 mt-0.5" />
                    <span>{error}</span>
                </div>
            )}

            <div className="mt-4 border-t border-white/5 pt-4">
                <a
                    href={docsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={cn(
                        'inline-flex items-center gap-2 text-sm transition-colors hover:underline',
                        colors.icon
                    )}
                >
                    <ExternalLink size={14} />
                    {isGroq ? 'Get a Groq API key' : 'Get a Gemini API key'}
                </a>
            </div>
        </section>
    )
}
