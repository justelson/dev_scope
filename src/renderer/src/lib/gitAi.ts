import type { CommitAIProvider, Settings } from './settings'

export type ResolvedGitTextProvider = {
    provider: CommitAIProvider
    apiKey?: string
    model?: string
}

function readProviderApiKey(settings: Settings, provider: Exclude<CommitAIProvider, 'codex'>) {
    return provider === 'groq'
        ? String(settings.groqApiKey || '').trim()
        : String(settings.geminiApiKey || '').trim()
}

function buildResolvedProvider(settings: Settings, provider: CommitAIProvider): ResolvedGitTextProvider | null {
    if (provider === 'codex') {
        const model = String(settings.codexModel || settings.assistantDefaultModel || '').trim()
        return {
            provider,
            ...(model ? { model } : {})
        }
    }

    const apiKey = readProviderApiKey(settings, provider)
    if (!apiKey) return null
    return { provider, apiKey }
}

export function resolvePreferredGitTextProvider(settings: Settings): ResolvedGitTextProvider | null {
    const preferred = buildResolvedProvider(settings, settings.commitAIProvider)
    if (preferred) return preferred

    for (const provider of ['groq', 'gemini'] as Exclude<CommitAIProvider, 'codex'>[]) {
        if (provider === settings.commitAIProvider) continue
        const candidate = buildResolvedProvider(settings, provider)
        if (candidate) return candidate
    }

    return null
}

export function formatGitTextProviderLabel(provider: CommitAIProvider) {
    if (provider === 'groq') return 'Groq'
    if (provider === 'gemini') return 'Gemini'
    return 'Codex'
}
