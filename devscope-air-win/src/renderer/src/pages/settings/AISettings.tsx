/**
 * DevScope - AI Settings Page
 * Configure AI commit message providers and API keys
 */

import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Sparkles, Eye, EyeOff, ExternalLink, Check, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useSettings, type CommitAIProvider } from '@/lib/settings'

type ProviderStatus = 'idle' | 'testing' | 'success' | 'error'
const PROVIDER_MODELS: Record<CommitAIProvider, string> = {
    groq: 'llama-3.1-8b-instant',
    gemini: 'gemini-1.5-flash'
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
        setTestStatus(prev => ({ ...prev, [provider]: 'idle' }))
        setTestError(prev => ({ ...prev, [provider]: '' }))
    }

    const handleTestConnection = async (provider: CommitAIProvider) => {
        const apiKey = provider === 'groq' ? settings.groqApiKey : settings.geminiApiKey
        if (!apiKey) return

        setTestStatus(prev => ({ ...prev, [provider]: 'testing' }))
        setTestError(prev => ({ ...prev, [provider]: '' }))

        try {
            const result = provider === 'groq'
                ? await window.devscope.testGroqConnection(apiKey)
                : await window.devscope.testGeminiConnection(apiKey)

            if (result.success) {
                setTestStatus(prev => ({ ...prev, [provider]: 'success' }))
            } else {
                setTestStatus(prev => ({ ...prev, [provider]: 'error' }))
                setTestError(prev => ({ ...prev, [provider]: result.error || 'Connection failed' }))
            }
        } catch (err: any) {
            setTestStatus(prev => ({ ...prev, [provider]: 'error' }))
            setTestError(prev => ({ ...prev, [provider]: err.message || 'Connection failed' }))
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
                        <div className="p-2 rounded-lg bg-violet-500/10">
                            <Sparkles className="text-violet-400" size={24} />
                        </div>
                        <div>
                            <h1 className="text-2xl font-semibold text-sparkle-text">AI Features</h1>
                            <p className="text-sparkle-text-secondary">
                                Configure AI provider keys for commit message generation
                            </p>
                        </div>
                    </div>
                    <Link
                        to="/settings"
                        className="inline-flex items-center gap-2 px-4 py-2 text-sm text-sparkle-text hover:text-[var(--accent-primary)] bg-sparkle-card hover:bg-sparkle-card-hover border border-sparkle-border rounded-lg transition-all shrink-0"
                    >
                        <ArrowLeft size={16} />
                        <span className="text-sm">Back to Settings</span>
                    </Link>
                </div>
            </div>

            <div className="space-y-6">
                <div className={cn(
                    "relative overflow-hidden rounded-xl border p-6 bg-gradient-to-br to-transparent",
                    activeProvider === 'groq'
                        ? 'border-violet-500/30 from-violet-500/15 via-violet-500/8'
                        : 'border-sky-500/30 from-sky-500/15 via-sky-500/8'
                )}>
                    <div className={cn(
                        "absolute top-0 right-0 w-32 h-32 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2",
                        activeProvider === 'groq' ? 'bg-violet-500/10' : 'bg-sky-500/10'
                    )} />
                    <div className="relative">
                        <div className="flex items-center gap-2 mb-3">
                            <Sparkles className={activeProvider === 'groq' ? 'text-violet-400' : 'text-sky-400'} size={18} />
                            <p className={cn(
                                "text-xs uppercase tracking-wider font-semibold",
                                activeProvider === 'groq' ? 'text-violet-400' : 'text-sky-400'
                            )}>
                                Active AI Configuration
                            </p>
                        </div>
                        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                            <div className="flex items-center gap-3">
                                <div className={cn(
                                    'p-2 rounded-lg',
                                    activeProvider === 'groq' 
                                        ? 'bg-violet-500/20 border border-violet-500/30' 
                                        : 'bg-sky-500/20 border border-sky-500/30'
                                )}>
                                    <Sparkles className={activeProvider === 'groq' ? 'text-violet-400' : 'text-sky-400'} size={20} />
                                </div>
                                <div>
                                    <p className="text-sm font-semibold text-sparkle-text">
                                        {activeProvider === 'groq' ? 'Groq' : 'Google Gemini'}
                                    </p>
                                    <code className="text-xs text-sparkle-text-secondary font-mono">
                                        {activeModel}
                                    </code>
                                </div>
                            </div>
                            <div className="hidden sm:block h-8 w-px bg-sparkle-border" />
                            <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                                <span className="text-xs text-sparkle-text-secondary">
                                    {settings.groqApiKey || settings.geminiApiKey ? 'API Key Configured' : 'No API Key'}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="bg-sparkle-card rounded-xl border border-sparkle-border p-6">
                    <h3 className="font-medium text-sparkle-text mb-1">Commit Message Provider</h3>
                    <p className="text-sm text-sparkle-text-secondary mb-4">
                        Choose which AI provider is used by default when generating commit messages.
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {(['groq', 'gemini'] as CommitAIProvider[]).map((provider) => (
                            <button
                                key={provider}
                                onClick={() => setProvider(provider)}
                                className={cn(
                                    'rounded-lg border px-4 py-3 text-left transition-colors',
                                    settings.commitAIProvider === provider
                                        ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)]/10'
                                        : 'border-sparkle-border hover:border-sparkle-border-secondary'
                                )}
                            >
                                <p className="text-sm font-medium text-sparkle-text">
                                    {provider === 'groq' ? 'Groq' : 'Google Gemini'}
                                </p>
                                <p className="text-xs text-sparkle-text-secondary mt-1">
                                    {provider === 'groq' ? 'Very fast inference' : 'Gemini API models'}
                                </p>
                                <p className="text-[11px] text-sparkle-text-muted mt-1 font-mono">
                                    {PROVIDER_MODELS[provider]}
                                </p>
                            </button>
                        ))}
                    </div>
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                    <ProviderKeyCard
                        provider="groq"
                        model={PROVIDER_MODELS.groq}
                        value={settings.groqApiKey}
                        showKey={showGroqKey}
                        onToggleShow={() => setShowGroqKey(v => !v)}
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
                        onToggleShow={() => setShowGeminiKey(v => !v)}
                        onChange={(value) => updateProviderKey('gemini', value)}
                        onTest={() => handleTestConnection('gemini')}
                        status={testStatus.gemini}
                        error={testError.gemini}
                        docsUrl="https://aistudio.google.com/app/apikey"
                    />
                </div>

                <div className="bg-violet-500/5 border border-violet-500/20 rounded-xl p-4">
                    <h4 className="font-medium text-violet-300 mb-2">How Commit AI Works</h4>
                    <ul className="text-sm text-violet-300/80 space-y-1.5">
                        <li>- Open a project and go to the Git tab.</li>
                        <li>- In Create Commit, click "Generate with AI".</li>
                        <li>- DevScope analyzes your current staged + unstaged diff.</li>
                        <li>- A detailed conventional commit message is drafted for you.</li>
                    </ul>
                </div>

                {hasAnyKey && (
                    <button
                        onClick={() => {
                            updateSettings({ groqApiKey: '', geminiApiKey: '' })
                            setTestStatus({ groq: 'idle', gemini: 'idle' })
                            setTestError({ groq: '', gemini: '' })
                        }}
                        className="text-sm text-red-400 hover:text-red-300 transition-colors"
                    >
                        Clear All API Keys
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
        <div className="bg-sparkle-card rounded-xl border border-sparkle-border p-6">
            <div className="flex items-center gap-2 mb-1">
                <h3 className="font-medium text-sparkle-text">
                    {isGroq ? 'Groq API Key' : 'Gemini API Key'}
                </h3>
                <span className={cn(
                    'text-xs px-2 py-0.5 rounded-full border',
                    isGroq
                        ? 'bg-violet-500/10 text-violet-400 border-violet-500/20'
                        : 'bg-sky-500/10 text-sky-400 border-sky-500/20'
                )}>
                    {isGroq ? 'gsk_*' : 'AIza*'}
                </span>
            </div>
            <p className="text-sm text-sparkle-text-secondary mb-4">
                {isGroq
                    ? 'Used for low-latency commit message generation with Groq-hosted models.'
                    : 'Used for commit message generation through Google Gemini models.'}
            </p>
            <p className="text-[11px] text-sparkle-text-muted mb-4 font-mono">
                Active model: {model}
            </p>

            <div className="flex items-center gap-3 mb-4">
                <div className="flex-1 relative">
                    <input
                        type={showKey ? 'text' : 'password'}
                        value={value}
                        onChange={(e) => onChange(e.target.value)}
                        placeholder={isGroq ? 'gsk_xxxxxxxxxxxx...' : 'AIzaSyxxxxxxxxxxxx...'}
                        className="w-full bg-sparkle-bg border border-sparkle-border rounded-lg px-4 py-3 pr-12 text-sm text-sparkle-text placeholder:text-sparkle-text-muted focus:outline-none focus:border-[var(--accent-primary)]/50 font-mono"
                    />
                    <button
                        onClick={onToggleShow}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-sparkle-text-muted hover:text-sparkle-text transition-colors"
                        title={showKey ? 'Hide key' : 'Show key'}
                    >
                        {showKey ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                </div>

                <button
                    onClick={onTest}
                    disabled={!value || status === 'testing'}
                    className="px-4 py-3 bg-[var(--accent-primary)] text-white rounded-lg hover:bg-[var(--accent-primary)]/80 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium flex items-center gap-2"
                >
                    {status === 'testing' ? (
                        <>
                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
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
                <div className="flex items-center gap-2 text-sm text-green-400 bg-green-500/10 border border-green-500/20 rounded-lg px-3 py-2">
                    <Check size={16} />
                    API key is valid and connection succeeded.
                </div>
            )}

            {status === 'error' && (
                <div className="flex items-center gap-2 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                    <AlertCircle size={16} />
                    {error}
                </div>
            )}

            <div className="mt-4 pt-4 border-t border-sparkle-border">
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
        </div>
    )
}

