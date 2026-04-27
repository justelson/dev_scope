import type {
    AssistantBusyMessageMode,
    AssistantDefaultEffort,
    AssistantDefaultInteractionMode,
    AssistantDefaultRuntimeMode,
    Settings
} from './settings'

type AssistantDefaultsSubset = Pick<
    Settings,
    | 'assistantDefaultModel'
    | 'assistantDefaultPromptTemplate'
    | 'assistantDefaultRuntimeMode'
    | 'assistantDefaultInteractionMode'
    | 'assistantDefaultEffort'
    | 'assistantDefaultFastMode'
    | 'assistantBusyMessageMode'
>

export function loadLegacyAssistantComposerDefaults(
    storageKey: string,
    defaults: AssistantDefaultsSubset
): Partial<Settings> {
    try {
        const raw = localStorage.getItem(storageKey)
        if (!raw) return {}
        const parsed = JSON.parse(raw) as {
            model?: unknown
            runtimeMode?: unknown
            interactionMode?: unknown
            effort?: unknown
            fastModeEnabled?: unknown
        }
        return {
            assistantDefaultModel: typeof parsed.model === 'string' ? parsed.model.trim() : defaults.assistantDefaultModel,
            assistantDefaultRuntimeMode: parsed.runtimeMode === 'full-access' ? 'full-access' : defaults.assistantDefaultRuntimeMode,
            assistantDefaultInteractionMode: parsed.interactionMode === 'plan' ? 'plan' : defaults.assistantDefaultInteractionMode,
            assistantDefaultEffort:
                parsed.effort === 'low' || parsed.effort === 'medium' || parsed.effort === 'high' || parsed.effort === 'xhigh'
                    ? parsed.effort
                    : defaults.assistantDefaultEffort,
            assistantDefaultFastMode: typeof parsed.fastModeEnabled === 'boolean'
                ? parsed.fastModeEnabled
                : defaults.assistantDefaultFastMode
        }
    } catch {
        return {}
    }
}

export function sanitizeAssistantDefaultRuntimeMode(value: unknown): AssistantDefaultRuntimeMode {
    return value === 'full-access' ? 'full-access' : 'approval-required'
}

export function sanitizeAssistantDefaultInteractionMode(value: unknown): AssistantDefaultInteractionMode {
    return value === 'plan' ? 'plan' : 'default'
}

export function sanitizeAssistantDefaultEffort(value: unknown): AssistantDefaultEffort {
    return value === 'low' || value === 'medium' || value === 'high' || value === 'xhigh' ? value : 'high'
}

export function getAssistantDefaultRuntimeModeLabel(value: AssistantDefaultRuntimeMode): string {
    return value === 'full-access' ? 'Full access' : 'Supervised'
}

export function getAssistantDefaultInteractionModeLabel(value: AssistantDefaultInteractionMode): string {
    return value === 'plan' ? 'Plan' : 'Chat'
}

export function getAssistantDefaultEffortLabel(value: AssistantDefaultEffort): string {
    switch (value) {
        case 'low':
            return 'Low'
        case 'medium':
            return 'Medium'
        case 'xhigh':
            return 'Extra High'
        case 'high':
        default:
            return 'High'
    }
}

export function getAssistantDefaultSpeedLabel(fastModeEnabled: boolean): string {
    return fastModeEnabled ? 'Fast' : 'Standard'
}

export function getAssistantBusyMessageModeLabel(value: AssistantBusyMessageMode): string {
    return value === 'force' ? 'Force while busy' : 'Queue while busy'
}

export function getAssistantDefaultsPreview(settings: AssistantDefaultsSubset): string {
    const modelLabel = settings.assistantDefaultModel.trim() || 'Auto model'
    const parts = [
        modelLabel,
        getAssistantDefaultInteractionModeLabel(settings.assistantDefaultInteractionMode),
        getAssistantDefaultRuntimeModeLabel(settings.assistantDefaultRuntimeMode),
        getAssistantDefaultEffortLabel(settings.assistantDefaultEffort),
        getAssistantDefaultSpeedLabel(settings.assistantDefaultFastMode),
        getAssistantBusyMessageModeLabel(settings.assistantBusyMessageMode)
    ]

    if (settings.assistantDefaultPromptTemplate.trim()) {
        parts.push('Template set')
    }

    return parts.join(' • ')
}
