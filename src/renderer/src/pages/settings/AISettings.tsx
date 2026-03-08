import { useMemo, useState } from 'react'
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
import { cn } from '@/lib/utils'
import { useSettings, type CommitAIProvider } from '@/lib/settings'

type ProviderStatus = 'idle' | 'testing' | 'success' | 'error'

const PROVIDER_MODELS: Record<CommitAIProvider, string> = {
    groq: 'llama-3.1-8b-instant',
    gemini: 'auto (Gemini Flash)'
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
    const [testStatus, setTestStatus] = useState<Record<CommitAIProvider, ProviderStatus>>({
        groq: 'idle',
        gemini: 'idle'
    })
    const [testError, setTestError] = useState<Record<CommitAIProvider, string>>({
        groq: '',
        gemini: ''
    })

    const setProvider = (provider: CommitAIProvider) => {
        updateSettings({ commitAIProvider: provider })
    }

    const updateProviderKey = (provider: CommitAIProvider, value: string) => {
        if (provider === 'groq') {
            updateSettings({ groqApiKey: value })
        } else {
            updateSettings({ geminiApiKey: value })
        }
        setTestStatus((prev) => ({ ...prev, [provider]: 'idle' }))
        setTestError((prev) => ({ ...prev, [provider]: '' }))
    }

    const handleTestConnection = async (provider: CommitAIProvider) => {
        const apiKey = provider === 'groq' ? settings.groqApiKey : settings.geminiApiKey
        if (!apiKey) return

        setTestStatus((prev) => ({ ...prev, [provider]: 'testing' }))
        setTestError((prev) => ({ ...prev, [provider]: '' }))

        try {
            const result = provider === 'groq'
                ? await window.devscope.testGroqConnection(apiKey)
                : await window.devscope.testGeminiConnection(apiKey)

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
    const activeModel = PROVIDER_MODELS[activeProvider]

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
                                Configure commit AI provider settings.
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
                    <div className="absolute right-0 top-0 h-32 w-32 -translate-y-1/2 translate-x-1/2 rounded-full bg-[var(--accent-primary)]/10 blur-3xl" />
                    <div className="relative">
                        <div className="mb-3 flex items-center gap-2">
                            <Sparkles className="text-[var(--accent-primary)]" size={18} />
                            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--accent-primary)]">
                                Active AI Configuration
                            </p>
                        </div>
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                            <div className="flex items-center gap-3">
                                <div className="rounded-xl border border-white/10 bg-white/[0.05] p-3">
                                    <Wand2 className="text-[var(--accent-primary)]" size={20} />
                                </div>
                                <div>
                                    <p className="text-sm font-semibold text-sparkle-text">
                                        {activeProvider === 'groq' ? 'Groq' : 'Google Gemini'}
                                    </p>
                                    <code className="text-xs text-sparkle-text-secondary">{activeModel}</code>
                                </div>
                            </div>
                            <div className="hidden h-8 w-px bg-white/5 lg:block" />
                            <div className="grid gap-2 text-xs text-sparkle-text-secondary sm:grid-cols-2 lg:min-w-[360px]">
                                <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
                                    Commit AI key: {hasAnyKey ? 'Configured' : 'Missing'}
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                <Card
                    title="Commit Message Provider"
                    description="Choose the default AI provider for commit message generation in DevScope Git flows."
                >
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        {(['groq', 'gemini'] as CommitAIProvider[]).map((provider) => {
                            const selected = settings.commitAIProvider === provider
                            return (
                                <button
                                    key={provider}
                                    type="button"
                                    onClick={() => setProvider(provider)}
                                    className={cn(
                                        'rounded-xl border px-4 py-3 text-left transition-all',
                                        selected
                                            ? 'border-white/20 bg-[var(--accent-primary)]/10'
                                            : 'border-white/10 bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.04]'
                                    )}
                                >
                                    <p className="text-sm font-medium text-sparkle-text">
                                        {provider === 'groq' ? 'Groq' : 'Google Gemini'}
                                    </p>
                                    <p className="mt-1 text-xs text-sparkle-text-secondary">
                                        {provider === 'groq' ? 'Very fast inference' : 'Gemini API models'}
                                    </p>
                                    <p className="mt-1 text-[11px] text-sparkle-text-muted font-mono">
                                        {PROVIDER_MODELS[provider]}
                                    </p>
                                </button>
                            )
                        })}
                    </div>
                </Card>

                <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
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
                </div>

                {hasAnyKey && (
                    <button
                        type="button"
                        onClick={() => {
                            updateSettings({ groqApiKey: '', geminiApiKey: '' })
                            setTestStatus({ groq: 'idle', gemini: 'idle' })
                            setTestError({ groq: '', gemini: '' })
                        }}
                        className="text-sm text-red-400 transition-colors hover:text-red-300"
                    >
                        Clear all commit AI keys
                    </button>
                )}
            </div>
        </div>
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
    provider: CommitAIProvider
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

    return (
        <section className="rounded-2xl border border-white/10 bg-sparkle-card p-6">
            <div className="mb-1 flex items-center gap-2">
                <h3 className="font-medium text-sparkle-text">
                    {isGroq ? 'Groq API Key' : 'Gemini API Key'}
                </h3>
                <span className="rounded-full border border-white/10 bg-white/[0.03] px-2 py-0.5 text-xs text-sparkle-text-secondary">
                    {isGroq ? 'gsk_*' : 'AIza*'}
                </span>
            </div>
            <p className="mb-4 text-sm text-sparkle-text-secondary">
                {isGroq
                    ? 'Used for low-latency commit message generation with Groq-hosted models.'
                    : 'Used for commit message generation through Google Gemini models.'}
            </p>
            <p className="mb-4 font-mono text-[11px] text-sparkle-text-muted">
                Active model: {model}
            </p>

            <div className="mb-4 flex items-center gap-3">
                <div className="relative flex-1">
                    <input
                        type={showKey ? 'text' : 'password'}
                        value={value}
                        onChange={(event) => onChange(event.target.value)}
                        placeholder={isGroq ? 'gsk_xxxxxxxxxxxx...' : 'AIzaSyxxxxxxxxxxxx...'}
                        className="w-full rounded-xl border border-white/10 bg-black/10 px-4 py-3 pr-12 text-sm font-mono text-sparkle-text placeholder:text-sparkle-text-muted focus:border-white/20 focus:outline-none"
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
                    className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-[var(--accent-primary)] px-4 py-3 text-sm font-medium text-white transition-all hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
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
                        'Test Connection'
                    )}
                </button>
            </div>

            {status === 'success' && (
                <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-green-500/10 px-3 py-2 text-sm text-green-300">
                    <Check size={16} />
                    API key is valid and connection succeeded.
                </div>
            )}

            {status === 'error' && (
                <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-red-500/10 px-3 py-2 text-sm text-red-300">
                    <AlertCircle size={16} />
                    {error}
                </div>
            )}

            <div className="mt-4 border-t border-white/5 pt-4">
                <a
                    href={docsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-sm text-[var(--accent-primary)] hover:underline"
                >
                    <ExternalLink size={14} />
                    {isGroq ? 'Get a Groq API key' : 'Get a Gemini API key'}
                </a>
            </div>
        </section>
    )
}
