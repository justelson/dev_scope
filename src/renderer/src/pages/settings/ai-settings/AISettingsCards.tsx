import type { ReactNode } from 'react'
import { AlertCircle, Check, ExternalLink, Eye, EyeOff, Trash2, Wand2, Zap } from 'lucide-react'
import { Select } from '@/components/ui/FormControls'
import { cn } from '@/lib/utils'
import type { CommitAIProvider } from '@/lib/settings'
import { PROVIDER_COLORS, type ModelOption, type ProviderStatus } from './aiSettingsConfig'

export function Card({
    title,
    description,
    children,
    className
}: {
    title: string
    description: string
    children: ReactNode
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

export function CodexProviderCard({
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
        <section className={cn('rounded-2xl border p-6 transition-all', 'border-white/10 bg-sparkle-card hover:border-white/15')}>
            <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className={cn('rounded-lg p-2', colors.bg)}>
                        <Zap size={18} className={colors.icon} />
                    </div>
                    <div>
                        <h3 className="font-semibold text-sparkle-text">Codex CLI</h3>
                        <p className="mt-0.5 text-xs text-sparkle-text-secondary">No API key required here</p>
                    </div>
                </div>
            </div>

            <p className="mb-3 text-sm leading-relaxed text-sparkle-text-secondary">
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
                    {modelsError ? <p className="mt-2 text-xs text-amber-300">{modelsError}</p> : null}
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

            {status === 'success' ? (
                <div className="mt-4 flex items-center gap-2 rounded-xl border border-green-500/20 bg-green-500/10 px-4 py-3 text-sm text-green-300">
                    <Check size={16} className="shrink-0" />
                    <span>Codex CLI is available and responded successfully.</span>
                </div>
            ) : null}

            {status === 'error' ? (
                <div className="mt-4 flex items-start gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                    <AlertCircle size={16} className="mt-0.5 shrink-0" />
                    <span>{error}</span>
                </div>
            ) : null}
        </section>
    )
}

export function ProviderKeyCard({
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
        <section className={cn('rounded-2xl border p-6 transition-all', 'border-white/10 bg-sparkle-card hover:border-white/15')}>
            <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className={cn('rounded-lg p-2', colors.bg)}>
                        <Zap size={18} className={colors.icon} />
                    </div>
                    <div>
                        <h3 className="font-semibold text-sparkle-text">{isGroq ? 'Groq API Key' : 'Gemini API Key'}</h3>
                        <p className="mt-0.5 text-xs text-sparkle-text-secondary">{isGroq ? 'gsk_*' : 'AIza*'}</p>
                    </div>
                </div>
            </div>

            <p className="mb-3 text-sm leading-relaxed text-sparkle-text-secondary">
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

            {status === 'success' ? (
                <div className="flex items-center gap-2 rounded-xl border border-green-500/20 bg-green-500/10 px-4 py-3 text-sm text-green-300">
                    <Check size={16} className="shrink-0" />
                    <span>API key is valid and connection succeeded.</span>
                </div>
            ) : null}

            {status === 'error' ? (
                <div className="flex items-start gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                    <AlertCircle size={16} className="mt-0.5 shrink-0" />
                    <span>{error}</span>
                </div>
            ) : null}

            <div className="mt-4 border-t border-white/5 pt-4">
                <a
                    href={docsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={cn('inline-flex items-center gap-2 text-sm transition-colors hover:underline', colors.icon)}
                >
                    <ExternalLink size={14} />
                    {isGroq ? 'Get a Groq API key' : 'Get a Gemini API key'}
                </a>
            </div>
        </section>
    )
}
