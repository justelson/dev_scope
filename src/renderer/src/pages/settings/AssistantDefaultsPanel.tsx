import { useCallback, useEffect, useRef, useState } from 'react'
import { Bot } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import { AssistantComposer, type AssistantComposerSendOptions, type ComposerContextFile } from '../assistant/AssistantComposer'
import { cn } from '@/lib/utils'
import { useSettings } from '@/lib/settings'
import type { AssistantTranscriptionModelState } from '@shared/assistant/contracts'

type ModelOption = { id: string; label: string; description?: string }

export function AssistantDefaultsPanel() {
    const [searchParams, setSearchParams] = useSearchParams()
    const { settings, updateSettings } = useSettings()
    const [modelOptions, setModelOptions] = useState<ModelOption[]>([])
    const [modelsLoading, setModelsLoading] = useState(false)
    const [modelsError, setModelsError] = useState<string | null>(null)
    const [lastAppliedPrompt, setLastAppliedPrompt] = useState('')
    const [lastAppliedAt, setLastAppliedAt] = useState<number | null>(null)
    const [composerResetVersion, setComposerResetVersion] = useState(0)
    const [transcriptionModelState, setTranscriptionModelState] = useState<AssistantTranscriptionModelState | null>(null)
    const [transcriptionModelLoading, setTranscriptionModelLoading] = useState(false)
    const [transcriptionModelError, setTranscriptionModelError] = useState<string | null>(null)
    const [highlightTranscriptionSection, setHighlightTranscriptionSection] = useState(false)
    const transcriptionSectionRef = useRef<HTMLElement | null>(null)

    const loadTranscriptionModelState = useCallback(async () => {
        setTranscriptionModelLoading(true)
        setTranscriptionModelError(null)
        try {
            const result = await window.devscope.assistant.getTranscriptionModelState()
            if (!result.success) {
                throw new Error(result.error || 'Failed to read transcription model state.')
            }
            setTranscriptionModelState(result.state)
        } catch (error) {
            setTranscriptionModelError(error instanceof Error ? error.message : 'Failed to read transcription model state.')
        } finally {
            setTranscriptionModelLoading(false)
        }
    }, [])

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

    useEffect(() => {
        void loadTranscriptionModelState()
    }, [loadTranscriptionModelState])

    useEffect(() => {
        if (transcriptionModelState?.status !== 'downloading') return
        const intervalId = window.setInterval(() => {
            void loadTranscriptionModelState()
        }, 1800)
        return () => window.clearInterval(intervalId)
    }, [loadTranscriptionModelState, transcriptionModelState?.status])

    useEffect(() => {
        if (searchParams.get('highlight') !== 'transcription') return
        setHighlightTranscriptionSection(true)

        const scrollTimeout = window.setTimeout(() => {
            transcriptionSectionRef.current?.scrollIntoView({
                behavior: 'smooth',
                block: 'center'
            })
        }, 80)

        const cleanupParamsTimeout = window.setTimeout(() => {
            const nextParams = new URLSearchParams(searchParams)
            nextParams.delete('highlight')
            setSearchParams(nextParams, { replace: true })
        }, 220)

        const clearHighlightTimeout = window.setTimeout(() => {
            setHighlightTranscriptionSection(false)
        }, 2600)

        return () => {
            window.clearTimeout(scrollTimeout)
            window.clearTimeout(cleanupParamsTimeout)
            window.clearTimeout(clearHighlightTimeout)
        }
    }, [searchParams, setSearchParams])

    const activeProfileLabel = settings.assistantDefaultRuntimeMode === 'full-access' ? 'yolo-fast' : 'safe-dev'

    const handleSandboxSend = useCallback(async (
        prompt: string,
        _contextFiles: ComposerContextFile[],
        options: AssistantComposerSendOptions
    ) => {
        updateSettings({
            assistantDefaultModel: options.model || '',
            assistantDefaultPromptTemplate: prompt,
            assistantDefaultRuntimeMode: options.runtimeMode,
            assistantDefaultInteractionMode: options.interactionMode,
            assistantDefaultEffort: options.effort,
            assistantDefaultFastMode: options.serviceTier === 'fast'
        })
        setLastAppliedPrompt(prompt.trim().slice(0, 120))
        setLastAppliedAt(Date.now())
        setComposerResetVersion((current) => current + 1)
        return true
    }, [updateSettings])

    const handleDownloadTranscriptionModel = useCallback(async () => {
        setTranscriptionModelLoading(true)
        setTranscriptionModelError(null)
        setTranscriptionModelState((previous) => previous ? {
            ...previous,
            status: 'downloading',
            error: null
        } : {
            provider: 'vosk',
            modelId: 'vosk-model-small-en-us-0.15',
            modelName: 'Vosk Small English (US)',
            status: 'downloading',
            installPath: null,
            downloadUrl: 'https://alphacephei.com/vosk/models/vosk-model-small-en-us-0.15.zip',
            error: null
        })
        try {
            const result = await window.devscope.assistant.downloadTranscriptionModel()
            if (!result.success) {
                throw new Error(result.error || 'Failed to download transcription model.')
            }
            setTranscriptionModelState(result.state)
        } catch (error) {
            setTranscriptionModelError(error instanceof Error ? error.message : 'Failed to download transcription model.')
        } finally {
            setTranscriptionModelLoading(false)
        }
    }, [])

    const transcriptionStatusLabel = transcriptionModelState?.status === 'ready'
        ? 'Installed'
        : transcriptionModelState?.status === 'downloading'
            ? 'Downloading'
            : transcriptionModelState?.status === 'error'
                ? 'Error'
                : 'Not installed'

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
                                <li>Write the starter prompt template you want new composers to begin with.</li>
                                <li>Choose the model and controls you want.</li>
                                <li>Send it to save the prompt and controls as the starting defaults for new assistant threads.</li>
                            </ul>
                        </div>
                    </div>
                </section>

                <section className={cn('rounded-2xl border border-white/10 bg-sparkle-card p-3 sm:p-4', modelsLoading && 'opacity-100')}>
                    <AssistantComposer
                        key={`settings-assistant-defaults-${composerResetVersion}`}
                        sessionId={null}
                        disabled={false}
                        allowEmptySubmit
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
                        submitLabel="Save"
                        dirtySubmitLabel="Unsaved"
                        cancelLabel="Cancel"
                        showCancelWhenDirty
                        onSend={handleSandboxSend}
                    />

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

            <section className="mt-4 w-full rounded-2xl border border-white/10 bg-sparkle-card p-4 sm:p-5">
                <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-center">
                    <div>
                        <h2 className="text-sm font-semibold text-sparkle-text">While Assistant Is Busy</h2>
                        <p className="mt-1 text-sm text-sparkle-text-secondary">
                            Choose what the default send action does when a turn is already running.
                        </p>
                    </div>
                    <div className="inline-flex w-full max-w-[280px] justify-self-end rounded-lg border border-white/10 bg-black/10 p-1">
                        {([
                            { id: 'queue', label: 'Queue' },
                            { id: 'force', label: 'Force' }
                        ] as const).map((mode) => {
                            const selected = settings.assistantBusyMessageMode === mode.id
                            return (
                                <button
                                    key={mode.id}
                                    type="button"
                                    onClick={() => updateSettings({ assistantBusyMessageMode: mode.id })}
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
                <p className="mt-3 text-xs text-sparkle-text-muted">
                    Queue waits for the current turn to finish. Force interrupts the current turn and runs the new message first.
                </p>
            </section>

            <section
                ref={transcriptionSectionRef}
                className={cn(
                    'mt-4 w-full rounded-2xl border border-transparent bg-sparkle-card p-4 transition-[background-color,box-shadow] duration-300 sm:p-5',
                    highlightTranscriptionSection
                        ? 'bg-[color-mix(in_srgb,var(--accent-primary)_10%,var(--color-sparkle-card))] shadow-[0_0_0_1px_color-mix(in_srgb,var(--accent-primary)_32%,transparent),0_0_24px_color-mix(in_srgb,var(--accent-primary)_16%,transparent)]'
                        : ''
                )}
            >
                <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-start">
                    <div>
                        <h2 className="text-sm font-semibold text-sparkle-text">Voice Transcription</h2>
                        <p className="mt-1 text-sm text-sparkle-text-secondary">Optional. Off by default.</p>
                    </div>
                    <button
                        type="button"
                        onClick={() => updateSettings({ assistantTranscriptionEnabled: !settings.assistantTranscriptionEnabled })}
                        className={cn(
                            'inline-flex min-w-[140px] items-center justify-center rounded-lg px-3 py-2 text-xs font-medium transition-colors',
                            settings.assistantTranscriptionEnabled
                                ? 'bg-emerald-500/14 text-emerald-100 hover:bg-emerald-500/18'
                                : 'bg-white/[0.03] text-sparkle-text-secondary hover:bg-white/[0.05] hover:text-sparkle-text'
                        )}
                    >
                        {settings.assistantTranscriptionEnabled ? 'Transcription on' : 'Transcription off'}
                    </button>
                </div>

                {settings.assistantTranscriptionEnabled ? (
                    <>
                        <div className="mt-4 inline-flex w-full max-w-[280px] rounded-lg border border-white/10 bg-black/10 p-1">
                            {([
                                { id: 'browser', label: 'Browser' },
                                { id: 'vosk', label: 'Vosk' }
                            ] as const).map((engine) => {
                                const selected = settings.assistantTranscriptionEngine === engine.id
                                return (
                                    <button
                                        key={engine.id}
                                        type="button"
                                        onClick={() => updateSettings({ assistantTranscriptionEngine: engine.id })}
                                        className={cn(
                                            'flex-1 rounded-md px-2.5 py-1.5 text-[11px] font-medium transition-all',
                                            selected
                                                ? 'bg-white/10 text-sparkle-text shadow-sm'
                                                : 'text-sparkle-text-secondary hover:text-sparkle-text'
                                        )}
                                    >
                                        {engine.label}
                                    </button>
                                )
                            })}
                        </div>

                        {settings.assistantTranscriptionEngine === 'browser' ? (
                            <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-xs text-sparkle-text-secondary">
                                Uses the runtime speech service.
                            </div>
                        ) : (
                            <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.03] p-4">
                                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-2">
                                            <h3 className="text-sm font-semibold text-sparkle-text">{transcriptionModelState?.modelName || 'Vosk Small English (US)'}</h3>
                                            <span className={cn(
                                                'rounded-full px-2 py-0.5 text-[10px] font-medium',
                                                transcriptionModelState?.status === 'ready'
                                                    ? 'bg-emerald-500/12 text-emerald-200'
                                                    : transcriptionModelState?.status === 'downloading'
                                                        ? 'bg-sky-500/12 text-sky-200'
                                                        : transcriptionModelState?.status === 'error'
                                                            ? 'bg-rose-500/12 text-rose-200'
                                                            : 'bg-white/[0.04] text-sparkle-text-secondary'
                                            )}>
                                                {transcriptionStatusLabel}
                                            </span>
                                        </div>
                                        <p className="mt-1 text-xs text-sparkle-text-secondary">
                                            Local model. Rolling updates while recording.
                                        </p>
                                    </div>

                                    <button
                                        type="button"
                                        onClick={() => void handleDownloadTranscriptionModel()}
                                        disabled={transcriptionModelLoading || transcriptionModelState?.status === 'downloading' || transcriptionModelState?.status === 'ready'}
                                        className={cn(
                                            'inline-flex min-w-[160px] items-center justify-center rounded-lg px-3 py-2 text-xs font-medium transition-colors',
                                            transcriptionModelState?.status === 'ready'
                                                ? 'bg-emerald-500/12 text-emerald-200'
                                                : 'bg-white/[0.04] text-sparkle-text hover:bg-white/[0.06]',
                                            (transcriptionModelLoading || transcriptionModelState?.status === 'downloading') && 'cursor-wait opacity-80',
                                            (transcriptionModelState?.status === 'ready') && 'cursor-default'
                                        )}
                                    >
                                        {transcriptionModelState?.status === 'ready'
                                            ? 'Installed'
                                            : transcriptionModelState?.status === 'downloading'
                                                ? 'Downloading...'
                                                : 'Download model'}
                                    </button>
                                </div>

                                {transcriptionModelState?.installPath ? (
                                    <p className="mt-3 truncate text-[11px] text-sparkle-text-muted">
                                        {transcriptionModelState.installPath}
                                    </p>
                                ) : null}

                                {transcriptionModelState?.error || transcriptionModelError ? (
                                    <p className="mt-2 text-xs text-rose-300">{transcriptionModelState?.error || transcriptionModelError}</p>
                                ) : null}
                            </div>
                        )}
                    </>
                ) : null}
            </section>
        </div>
    )
}
