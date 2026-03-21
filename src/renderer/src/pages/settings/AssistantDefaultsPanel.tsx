import { useCallback, useEffect, useState } from 'react'
import { Bot, CheckCircle2 } from 'lucide-react'
import { AssistantComposer, type AssistantComposerSendOptions, type ComposerContextFile } from '../assistant/AssistantComposer'
import { cn } from '@/lib/utils'
import { useSettings } from '@/lib/settings'

type ModelOption = { id: string; label: string; description?: string }

export function AssistantDefaultsPanel() {
    const { settings, updateSettings } = useSettings()
    const [modelOptions, setModelOptions] = useState<ModelOption[]>([])
    const [modelsLoading, setModelsLoading] = useState(false)
    const [modelsError, setModelsError] = useState<string | null>(null)
    const [lastAppliedPrompt, setLastAppliedPrompt] = useState('')
    const [lastAppliedAt, setLastAppliedAt] = useState<number | null>(null)

    const loadModels = useCallback(async (forceRefresh = false) => {
        setModelsLoading(true)
        setModelsError(null)
        try {
            const result = await window.devscope.assistant.listModels(forceRefresh)
            if (!result.success) {
                throw new Error(result.error || 'Failed to load assistant models.')
            }
            setModelOptions(result.models)
        } catch (error) {
            setModelsError(error instanceof Error ? error.message : 'Failed to load assistant models.')
        } finally {
            setModelsLoading(false)
        }
    }, [])

    useEffect(() => {
        void loadModels(false)
    }, [loadModels])

    const activeProfileLabel = settings.assistantDefaultRuntimeMode === 'full-access' ? 'yolo-fast' : 'safe-dev'

    const handleSandboxSend = useCallback(async (
        prompt: string,
        _contextFiles: ComposerContextFile[],
        options: AssistantComposerSendOptions
    ) => {
        updateSettings({
            assistantDefaultModel: options.model || '',
            assistantDefaultRuntimeMode: options.runtimeMode,
            assistantDefaultInteractionMode: options.interactionMode,
            assistantDefaultEffort: options.effort,
            assistantDefaultFastMode: options.serviceTier === 'fast'
        })
        setLastAppliedPrompt(prompt.trim().slice(0, 120))
        setLastAppliedAt(Date.now())
        return true
    }, [updateSettings])

    return (
        <div className="w-full">
            <div className="grid w-full gap-4 xl:grid-cols-[minmax(280px,0.78fr)_minmax(0,1.22fr)]">
                <section className="rounded-2xl border border-white/10 bg-sparkle-card p-4 sm:p-5">
                    <div className="flex items-start gap-3">
                        <div className="rounded-xl border border-violet-400/20 bg-violet-500/10 p-2.5 text-violet-200">
                            <Bot size={18} />
                        </div>
                        <div className="min-w-0">
                            <h1 className="text-xl font-semibold text-sparkle-text">Use the real composer to set your defaults</h1>
                            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-sparkle-text-secondary">
                                <li>Write a prompt.</li>
                                <li>Choose the model and controls you want.</li>
                                <li>Send it to save those selections as the starting defaults for new assistant threads.</li>
                            </ul>
                        </div>
                    </div>
                </section>

                <section className={cn('rounded-2xl border border-white/10 bg-sparkle-card p-3 sm:p-4', modelsLoading && 'opacity-100')}>
                    <AssistantComposer
                        sessionId="settings-assistant-defaults-sandbox"
                        disabled={false}
                        isSending={false}
                        isThinking={false}
                        thinkingLabel="Previewing..."
                        isConnected={true}
                        activeModel={settings.assistantDefaultModel.trim() || modelOptions[0]?.id || undefined}
                        modelOptions={modelOptions}
                        modelsLoading={modelsLoading}
                        modelsError={modelsError}
                        onRefreshModels={() => void loadModels(true)}
                        activeProfile={activeProfileLabel}
                        runtimeMode={settings.assistantDefaultRuntimeMode}
                        interactionMode={settings.assistantDefaultInteractionMode}
                        projectPath={null}
                        compact={settings.compactMode}
                        onSend={handleSandboxSend}
                    />

                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-white/5 pt-3 text-xs text-sparkle-text-secondary">
                        <span>Send saves the current composer selections as the defaults.</span>
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[10px] text-sparkle-text-muted">
                            <CheckCircle2 size={11} />
                            {lastAppliedAt ? `Applied at ${new Date(lastAppliedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}` : 'No defaults saved yet'}
                        </span>
                    </div>

                    {lastAppliedPrompt ? (
                        <p className="mt-2 truncate text-[11px] text-sparkle-text-muted">
                            Last prompt: {lastAppliedPrompt}
                        </p>
                    ) : null}

                    {modelsError ? <p className="mt-2 text-xs text-rose-300">{modelsError}</p> : null}
                </section>
            </div>

            <section className="mt-4 w-full rounded-2xl border border-white/10 bg-sparkle-card p-4 sm:p-5">
                <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-center">
                    <div>
                        <h2 className="text-sm font-semibold text-sparkle-text">Text Streaming</h2>
                        <p className="mt-1 text-sm text-sparkle-text-secondary">
                            Stream text live for immediacy, or batch into chunks for steadier rendering.
                        </p>
                    </div>
                    <div className="inline-flex w-full max-w-[260px] justify-self-end rounded-lg border border-white/10 bg-black/10 p-1">
                        {([
                            { id: 'stream', label: 'Live stream' },
                            { id: 'chunks', label: 'Chunked' }
                        ] as const).map((mode) => {
                            const selected = settings.assistantTextStreamingMode === mode.id
                            return (
                                <button
                                    key={mode.id}
                                    type="button"
                                    onClick={() => updateSettings({ assistantTextStreamingMode: mode.id })}
                                    className={cn(
                                        'flex-1 rounded-md px-2.5 py-1.5 text-[11px] font-medium transition-all',
                                        selected
                                            ? 'bg-white/10 text-sparkle-text shadow-sm'
                                            : 'text-sparkle-text-secondary hover:text-sparkle-text'
                                    )}
                                >
                                    {mode.label}
                                </button>
                            )
                        })}
                    </div>
                </div>
            </section>
        </div>
    )
}
