import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
    ArrowLeft,
    Check,
    Sparkles,
    Trash2,
    Zap
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useSettings, type CommitAIProvider } from '@/lib/settings'
import { Card, CodexProviderCard, ProviderKeyCard } from './ai-settings/AISettingsCards'
import { PROVIDER_COLORS, PROVIDER_MODELS, type ProviderStatus } from './ai-settings/aiSettingsConfig'
import { useCodexModelOptions } from './ai-settings/useCodexModelOptions'

export default function AISettings() {
    const { settings, updateSettings } = useSettings()
    const [showGroqKey, setShowGroqKey] = useState(false)
    const [showGeminiKey, setShowGeminiKey] = useState(false)
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
    const { codexModelsError, resolvedCodexModelOptions } = useCodexModelOptions(effectiveCodexModel)

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
                                        <Zap className={activeColors.icon} size={20} />
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
