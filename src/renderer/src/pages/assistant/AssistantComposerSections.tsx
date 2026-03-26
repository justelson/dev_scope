import { memo, type Dispatch, type RefObject, type SetStateAction } from 'react'
import { AnimatedHeight } from '@/components/ui/AnimatedHeight'
import { VscodeEntryIcon } from '@/components/ui/VscodeEntryIcon'
import { cn } from '@/lib/utils'
import { Check, ChevronDown, ChevronUp, FileCode2, FileText, GitBranch, ListTodo, Loader2, Lock, LockOpen, MessageSquare, Mic, RefreshCw, SendHorizontal, Square, X } from 'lucide-react'
import type { PreviewOpenOptions } from '@/components/ui/file-preview/types'
import { formatAssistantModelLabel } from './assistant-model-labels'
import { OpenAILogo } from './assistant-composer-inline-mentions'
import { getContentTypeTag, getContextFileMeta, isPastedTextAttachment } from './assistant-composer-utils'
import type { ComposerContextFile } from './assistant-composer-types'
import type { MentionCandidate } from './assistant-composer-mentions'
import { AssistantAttachmentImageCard } from './AssistantAttachmentImageCard'

export const ComposerAttachmentsShelf = memo(({
    contextFiles,
    compact,
    removingAttachmentIds,
    onOpenAttachmentPreview,
    onPreview,
    onRemove
}: {
    contextFiles: ComposerContextFile[]
    compact: boolean
    removingAttachmentIds: string[]
    onOpenAttachmentPreview?: (
        file: { name: string; path: string },
        ext: string,
        options?: PreviewOpenOptions
    ) => Promise<void> | void
    onPreview: (file: ComposerContextFile) => void
    onRemove: (id: string) => void
}) => (
    <AnimatedHeight isOpen={contextFiles.length > 0} duration={220}>
        <div className={cn('pointer-events-auto flex flex-wrap items-start', compact ? 'gap-1.5 pb-1' : 'gap-2 pb-1.5')}>
            {contextFiles.map((file) => {
                const meta = getContextFileMeta(file)
                const contentType = getContentTypeTag(file)
                const isRemoving = removingAttachmentIds.includes(file.id)
                const isEntering = Boolean(file.animateIn)
                const isImageAttachment = meta.category === 'image' && Boolean(file.previewDataUrl)
                const isPastedText = isPastedTextAttachment(file)
                const cardWidthClass = isPastedText ? 'w-[92px]' : 'w-[116px]'
                const handleOpenImagePreview = () => {
                    if (onOpenAttachmentPreview) {
                        void onOpenAttachmentPreview({ name: meta.name, path: file.path }, meta.ext)
                        return
                    }
                    onPreview(file)
                }
                const handleOpenPastedTextPreview = () => {
                    onPreview(file)
                }

                return (
                    isImageAttachment ? (
                            <AssistantAttachmentImageCard
                                key={file.id}
                                name={meta.name}
                                src={file.previewDataUrl || ''}
                                widthClassName={cardWidthClass}
                                heightClassName="h-[84px]"
                                onClick={handleOpenImagePreview}
                                onRemove={() => onRemove(file.id)}
                                removable
                                removing={isRemoving || isEntering}
                            />
                    ) : isPastedText ? (
                        <article
                            key={file.id}
                            data-composer-attachment-item="true"
                            className={cn(
                                'group relative overflow-hidden rounded-lg border border-white/10 bg-sparkle-card/95 shadow-lg shadow-black/20 backdrop-blur-xl transition-colors hover:border-white/20 hover:bg-white/[0.05]',
                                cardWidthClass,
                                'h-[96px]'
                            )}
                            style={{
                                transition: 'transform 190ms ease, opacity 190ms ease, filter 190ms ease',
                                transform: isRemoving ? 'translateY(6px) scale(0.82)' : isEntering ? 'translateY(-2px) scale(0.96)' : 'translateY(0) scale(1)',
                                opacity: isRemoving || isEntering ? 0 : 1,
                                filter: isRemoving ? 'blur(1px)' : 'blur(0)'
                            }}
                        >
                            <button
                                type="button"
                                onClick={handleOpenPastedTextPreview}
                                className="relative flex h-full w-full flex-col items-center justify-start gap-1.5 p-[6px] text-left"
                                disabled={isRemoving}
                                title="Open pasted text"
                            >
                                <div className="relative flex h-[64px] w-full items-center justify-center overflow-hidden rounded-[10px] border border-white/10 bg-sparkle-card/95 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                                    <div className="pointer-events-none absolute inset-x-0 top-0 h-8 bg-gradient-to-b from-white/8 to-transparent" />
                                    <FileText size={28} className="relative z-10 text-sparkle-text-secondary" />
                                </div>
                                <span className="block w-full text-center text-[10px] font-semibold uppercase tracking-[0.08em] leading-none text-sparkle-text-secondary">
                                    Pasted Text
                                </span>
                            </button>
                            <button
                                type="button"
                                onClick={(event) => {
                                    event.stopPropagation()
                                    onRemove(file.id)
                                }}
                                className="absolute right-1 top-1 shrink-0 rounded-md border border-white/10 bg-black/35 p-1 text-sparkle-text-muted opacity-90 backdrop-blur-sm transition-colors hover:bg-rose-500/10 hover:text-rose-300"
                                disabled={isRemoving}
                                title="Remove attachment"
                            >
                                <X size={11} />
                            </button>
                        </article>
                    ) : (
                        <article
                            key={file.id}
                            data-composer-attachment-item="true"
                            className={cn(
                                'group relative overflow-hidden rounded-lg border border-white/10 bg-sparkle-card/95 shadow-lg shadow-black/20 backdrop-blur-xl transition-colors hover:border-white/20 hover:bg-white/[0.05]',
                                cardWidthClass
                            )}
                            style={{
                                transition: 'transform 190ms ease, opacity 190ms ease, filter 190ms ease',
                                transform: isRemoving ? 'translateY(6px) scale(0.82)' : isEntering ? 'translateY(-4px) scale(0.92)' : 'translateY(0) scale(1)',
                                opacity: isRemoving || isEntering ? 0 : 1,
                                filter: isRemoving ? 'blur(1px)' : 'blur(0)'
                            }}
                        >
                            <button
                                type="button"
                                onClick={() => onPreview(file)}
                                className="relative block w-full text-left"
                                disabled={isRemoving}
                                title="Open preview"
                            >
                                <div className="flex items-start gap-2 p-2">
                                    <div className={cn('flex h-6 w-6 shrink-0 items-center justify-center rounded-md border', meta.category === 'code' ? 'border-indigo-400/30 bg-indigo-500/10 text-indigo-300' : 'border-white/10 bg-sparkle-bg text-sparkle-text-secondary')}>
                                        {meta.category === 'code' ? <FileCode2 size={13} /> : <FileText size={13} />}
                                    </div>
                                    <span className="min-w-0 flex-1">
                                        <span className="block truncate text-[9px] font-medium text-sparkle-text">{meta.name}</span>
                                        <span className="block truncate font-mono text-[7px] uppercase tracking-[0.1em] text-sparkle-text-muted">{contentType}</span>
                                    </span>
                                </div>
                            </button>
                            <button
                                type="button"
                                onClick={(event) => {
                                    event.stopPropagation()
                                    onRemove(file.id)
                                }}
                                className="absolute right-1 top-1 shrink-0 rounded-md border border-white/10 bg-black/35 p-1 text-sparkle-text-muted opacity-90 backdrop-blur-sm transition-colors hover:bg-rose-500/10 hover:text-rose-300"
                                disabled={isRemoving}
                                title="Remove attachment"
                            >
                                <X size={11} />
                            </button>
                            <div className="px-2 pb-1.5 pt-0">
                                <div className="truncate font-mono text-[8px] text-sparkle-text-muted/80">{file.path}</div>
                            </div>
                        </article>
                    )
                )
            })}
        </div>
    </AnimatedHeight>
))

export const ComposerMentionMenu = memo(({
    isOpen,
    mentionCanScrollUp,
    mentionCanScrollDown,
    mentionLoading,
    mentionCandidates,
    activeMentionIndex,
    mentionListRef,
    iconTheme,
    onScroll,
    onApplyMention
}: {
    isOpen: boolean
    mentionCanScrollUp: boolean
    mentionCanScrollDown: boolean
    mentionLoading: boolean
    mentionCandidates: MentionCandidate[]
    activeMentionIndex: number
    mentionListRef: RefObject<HTMLDivElement | null>
    iconTheme: 'light' | 'dark'
    onScroll: (element: HTMLDivElement) => void
    onApplyMention: (candidate: MentionCandidate) => void
}) => (
    <div className={cn('pointer-events-none absolute inset-x-0 bottom-full z-30 mb-1 overflow-hidden', isOpen ? 'pointer-events-auto' : 'pointer-events-none')}>
        <AnimatedHeight isOpen={isOpen} duration={220}>
            <div className="overflow-hidden rounded-xl border border-white/10 bg-sparkle-card shadow-2xl shadow-black/70 backdrop-blur-xl">
                <div className="relative">
                    {mentionCanScrollUp ? <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex h-6 items-start justify-center before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:h-[150%] before:rounded-t-[10px] before:bg-gradient-to-b before:from-sparkle-card before:from-40% before:to-transparent"><ChevronUp size={11} className="relative mt-0.5 text-sparkle-text-muted/70" /></div> : null}
                    <div ref={mentionListRef} onScroll={(event) => onScroll(event.currentTarget)} className="max-h-56 overflow-y-auto px-1.5 pb-6 pt-6">
                        {mentionLoading ? (
                            <div className="flex items-center gap-2 px-2 py-3 text-[11px] text-sparkle-text-secondary"><Loader2 size={12} className="animate-spin" /><span>Indexing project files...</span></div>
                        ) : mentionCandidates.length === 0 ? (
                            <div className="px-2 py-3 text-[11px] text-sparkle-text-secondary">No matching files or folders.</div>
                        ) : mentionCandidates.map((candidate, index) => (
                            <button key={candidate.path} type="button" data-mention-index={index} onClick={() => onApplyMention(candidate)} className={cn('flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left transition-colors', index === activeMentionIndex ? 'bg-white/[0.08]' : 'hover:bg-white/[0.04]')}>
                                <VscodeEntryIcon pathValue={candidate.relativePath || candidate.name} kind={candidate.type} theme={iconTheme} className="shrink-0" />
                                <div className="min-w-0 flex-1 truncate"><span className="text-[13px] font-semibold text-sparkle-text">{candidate.name}</span><span className="ml-2 font-mono text-[11px] text-white/[0.12]">{candidate.relativePath}</span></div>
                            </button>
                        ))}
                    </div>
                    {mentionCanScrollDown ? <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex h-6 items-end justify-center before:pointer-events-none before:absolute before:inset-x-0 before:bottom-0 before:h-[150%] before:rounded-b-[10px] before:bg-gradient-to-t before:from-sparkle-card before:from-40% before:to-transparent"><ChevronDown size={11} className="relative mb-0.5 text-sparkle-text-muted/70" /></div> : null}
                </div>
            </div>
        </AnimatedHeight>
    </div>
))

export const ComposerSendButton = memo(({
    disabled,
    isConnected,
    isThinking,
    canSend,
    label = 'Send',
    onStop,
    onSend
}: {
    disabled: boolean
    isConnected: boolean
    isThinking: boolean
    canSend: boolean
    label?: string
    onStop?: () => Promise<void> | void
    onSend: () => void
}) => {
    const canStop = isThinking && Boolean(onStop) && isConnected && !disabled
    const isEmptyState = !canStop && !disabled && isConnected && !canSend
    const isDisabled = canStop ? false : disabled || !isConnected || !canSend

    return (
        <button
            type="button"
            disabled={isDisabled}
            onClick={() => {
                if (canStop) {
                    void onStop?.()
                    return
                }
                onSend()
            }}
            className={cn(
                'relative inline-flex h-[36px] items-center justify-center overflow-hidden rounded-full border transition-all duration-150',
                label === 'Send' ? 'w-[36px]' : 'gap-1.5 px-3.5',
                canStop
                    ? 'border-white/10 bg-[#2246a8] text-white hover:scale-[1.03] hover:border-white/20 hover:bg-[#2955ca]'
                    : isEmptyState
                        ? 'border-transparent bg-white/[0.02] text-sparkle-text-muted/80 hover:border-transparent hover:bg-white/[0.03]'
                        : isDisabled
                        ? 'border-transparent bg-white/[0.015] text-sparkle-text-muted/45 opacity-70'
                        : 'border-white/10 bg-[#2246a8] text-white hover:scale-[1.03] hover:border-white/20 hover:bg-[#2955ca]'
            )}
        >
            {canStop ? <span className="absolute inset-0 animate-shimmer opacity-60" aria-hidden="true" /> : null}
            <span className="relative z-10 inline-flex items-center justify-center gap-1.5">
                {canStop ? (
                    <Square size={15} fill="currentColor" />
                ) : label === 'Send' ? (
                    <SendHorizontal size={18} className={isEmptyState ? 'opacity-35' : undefined} />
                ) : (
                    <>
                        <Check size={16} />
                        <span className="text-[12px] font-semibold">{label}</span>
                    </>
                )}
            </span>
        </button>
    )
})

export const ComposerVoiceButton = memo(({
    supported,
    isRecording,
    disabled,
    onToggle
}: {
    supported: boolean
    isRecording: boolean
    disabled: boolean
    onToggle: () => void
}) => {
    if (!supported) return null

    return (
        <button
            type="button"
            disabled={disabled}
            onClick={onToggle}
            className={cn(
                'relative inline-flex h-[36px] w-[36px] items-center justify-center overflow-visible rounded-full border transition-all duration-150',
                isRecording
                    ? 'border-transparent bg-rose-500 text-white hover:scale-[1.03] hover:bg-rose-400'
                    : disabled
                        ? 'border-transparent bg-white/[0.02] text-sparkle-text-muted/45'
                        : 'border-transparent bg-white/[0.03] text-sparkle-text-secondary hover:bg-white/[0.06] hover:text-sparkle-text'
            )}
            title={isRecording ? 'Stop recording' : 'Start voice input'}
        >
            {isRecording ? (
                <>
                    <span className="pointer-events-none absolute inset-0 rounded-full border border-rose-300/28 animate-subtle-recording-ripple" aria-hidden="true" />
                    <span className="pointer-events-none absolute inset-0 rounded-full border border-rose-300/16 animate-subtle-recording-ripple-delayed" aria-hidden="true" />
                    <Square size={14} fill="currentColor" className="relative z-10" />
                </>
            ) : (
                <Mic size={17} className="relative z-10" />
            )}
        </button>
    )
})

function syncScrollAffordanceState(element: HTMLDivElement | null, setCanScrollUp: Dispatch<SetStateAction<boolean>>, setCanScrollDown: Dispatch<SetStateAction<boolean>>) {
    if (!element) {
        setCanScrollUp(false)
        setCanScrollDown(false)
        return
    }
    const maxScrollTop = Math.max(0, element.scrollHeight - element.clientHeight)
    setCanScrollUp(element.scrollTop > 2)
    setCanScrollDown(maxScrollTop - element.scrollTop > 2)
}

export const ComposerFooterControls = memo(({
    isCompactFooter,
    controlsLocked = false,
    modelDropdownRef,
    showModelDropdown,
    setShowModelDropdown,
    modelsLoading,
    modelsError,
    modelQuery,
    setModelQuery,
    setActiveModelIndex,
    modelCanScrollUp,
    modelCanScrollDown,
    setModelCanScrollUp,
    setModelCanScrollDown,
    modelListRef,
    filteredModelOptions,
    activeModelIndex,
    selectedModel,
    selectedModelLabel,
    latestModelId,
    setSelectedModel,
    onRefreshModels,
    traitsDropdownRef,
    showTraitsDropdown,
    setShowTraitsDropdown,
    EFFORT_OPTIONS,
    selectedEffort,
    setSelectedEffort,
    EFFORT_LABELS,
    fastModeEnabled,
    setFastModeEnabled,
    selectedInteractionMode,
    setSelectedInteractionMode,
    selectedRuntimeMode,
    setSelectedRuntimeMode,
    displayedProfile,
    setShowFullAccessConfirm
}: {
    isCompactFooter: boolean
    controlsLocked?: boolean
    modelDropdownRef: RefObject<HTMLDivElement | null>
    showModelDropdown: boolean
    setShowModelDropdown: Dispatch<SetStateAction<boolean>>
    modelsLoading: boolean
    modelsError: string | null
    modelQuery: string
    setModelQuery: Dispatch<SetStateAction<string>>
    setActiveModelIndex: Dispatch<SetStateAction<number>>
    modelCanScrollUp: boolean
    modelCanScrollDown: boolean
    setModelCanScrollUp: Dispatch<SetStateAction<boolean>>
    setModelCanScrollDown: Dispatch<SetStateAction<boolean>>
    modelListRef: RefObject<HTMLDivElement | null>
    filteredModelOptions: Array<{ id: string; label: string; description?: string }>
    activeModelIndex: number
    selectedModel: string
    selectedModelLabel: string
    latestModelId: string | null
    setSelectedModel: Dispatch<SetStateAction<string>>
    onRefreshModels?: () => void
    traitsDropdownRef: RefObject<HTMLDivElement | null>
    showTraitsDropdown: boolean
    setShowTraitsDropdown: Dispatch<SetStateAction<boolean>>
    EFFORT_OPTIONS: string[]
    selectedEffort: string
    setSelectedEffort: Dispatch<SetStateAction<any>>
    EFFORT_LABELS: Record<string, string>
    fastModeEnabled: boolean
    setFastModeEnabled: Dispatch<SetStateAction<boolean>>
    selectedInteractionMode: string
    setSelectedInteractionMode: Dispatch<SetStateAction<any>>
    selectedRuntimeMode: string
    setSelectedRuntimeMode: Dispatch<SetStateAction<any>>
    displayedProfile: string
    setShowFullAccessConfirm: Dispatch<SetStateAction<boolean>>
}) => (
    <div className={cn('flex min-w-0 flex-1 items-center text-[11px]', isCompactFooter ? 'gap-0.5 overflow-hidden' : 'gap-0.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:min-w-max sm:overflow-visible')}>
        <div className="relative min-w-0" ref={modelDropdownRef}>
            <div className={cn('pointer-events-none absolute bottom-full left-0 z-30 mb-2 w-72 overflow-hidden', showModelDropdown ? 'pointer-events-auto' : 'pointer-events-none')}>
                <AnimatedHeight isOpen={showModelDropdown} duration={220}>
                    <div className="overflow-hidden rounded-xl border border-white/10 bg-sparkle-card shadow-2xl shadow-black/70 backdrop-blur-xl">
                        <div className="flex items-center justify-between border-b border-white/5 px-3 pb-1.5 pt-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-sparkle-text-muted"><span>Models</span></div>
                        <div className="px-2.5 py-2"><input value={modelQuery} onChange={(event) => { setModelQuery(event.target.value); setActiveModelIndex(0) }} placeholder="Search models..." className="h-8 w-full rounded-lg border border-white/10 bg-white/[0.03] px-2.5 text-[11px] text-sparkle-text outline-none placeholder:text-sparkle-text-muted/60 focus:border-white/20" /></div>
                        <div className="relative">
                            {modelCanScrollUp ? <div className="pointer-events-none absolute inset-x-1.5 top-0 z-10 flex h-8 items-start justify-center before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:h-[200%] before:rounded-t-[10px] before:bg-gradient-to-b before:from-sparkle-card before:from-50% before:to-transparent"><ChevronUp size={13} className="relative mt-1 text-sparkle-text-muted/85" /></div> : null}
                            <div ref={modelListRef} onScroll={(event) => syncScrollAffordanceState(event.currentTarget, setModelCanScrollUp, setModelCanScrollDown)} className="max-h-64 overflow-y-auto px-1.5 pb-6 pt-6">
                                {filteredModelOptions.length === 0 ? <div className="px-2 py-2.5 text-[11px] text-sparkle-text-secondary">No models found.</div> : filteredModelOptions.map((model, index) => {
                                    const isActive = model.id === selectedModel
                                    const isHighlighted = index === activeModelIndex
                                    const isLatestModel = model.id === latestModelId
                                    return (
                                        <button key={model.id} type="button" data-model-index={index} onClick={() => { setSelectedModel(model.id); setShowModelDropdown(false) }} className={cn('grid min-h-8 w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors', isLatestModel ? 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/15' : isActive ? 'bg-white/[0.06] text-sparkle-text' : 'text-sparkle-text-secondary hover:bg-white/[0.03] hover:text-sparkle-text', isHighlighted && !isActive && !isLatestModel && 'bg-white/[0.04] text-sparkle-text')}>
                                            <OpenAILogo className="h-3 w-3 shrink-0 text-current opacity-70" />
                                            <span className="min-w-0 truncate text-[12px] font-medium">{formatAssistantModelLabel(model.label || model.id)}</span>
                                            <span className="ml-2 flex items-center gap-1">
                                                {isActive ? <span className="rounded border border-white/10 bg-white/[0.06] px-1.5 py-0.5 text-[9px] font-medium text-sparkle-text">Selected</span> : null}
                                                {isLatestModel ? <span className="rounded border border-emerald-400/20 bg-emerald-500/10 px-1.5 py-0.5 text-[9px] font-medium text-emerald-300">Latest</span> : null}
                                            </span>
                                        </button>
                                    )
                                })}
                            </div>
                            {modelCanScrollDown ? <div className="pointer-events-none absolute inset-x-1.5 bottom-0 z-10 flex h-8 items-end justify-center before:pointer-events-none before:absolute before:inset-x-0 before:bottom-0 before:h-[200%] before:rounded-b-[10px] before:bg-gradient-to-t before:from-sparkle-card before:from-50% before:to-transparent"><ChevronDown size={13} className="relative mb-1 text-sparkle-text-muted/85" /></div> : null}
                        </div>
                        {modelsError ? <div className="px-3 pb-2"><p className="text-[10px] font-medium text-rose-400">{modelsError}</p></div> : null}
                    </div>
                </AnimatedHeight>
            </div>
            <button type="button" disabled={controlsLocked} onClick={() => setShowModelDropdown((prev) => { if (controlsLocked) return prev; const next = !prev; if (next && onRefreshModels) onRefreshModels(); return next })} title={modelsLoading ? 'Refreshing models...' : modelsError || 'Select model'} className={cn('min-w-0 shrink-0 whitespace-nowrap px-1.5 text-[13px] font-medium text-sparkle-text-secondary transition-colors hover:text-sparkle-text', isCompactFooter ? 'max-w-40' : 'sm:px-2.5', controlsLocked && 'cursor-not-allowed opacity-45 hover:text-sparkle-text-secondary')}><span className={cn('flex min-w-0 items-center gap-2', isCompactFooter && 'max-w-32')}>{modelsLoading ? <RefreshCw size={14} className="shrink-0 animate-spin text-current opacity-80" /> : <OpenAILogo className="h-3.5 w-3.5 shrink-0 text-current opacity-80" />}<span className="truncate text-[13px] font-medium">{formatAssistantModelLabel(selectedModelLabel)}</span><ChevronDown size={10} className="-mr-0.5 ml-0.5 shrink-0 opacity-60" /></span></button>
        </div>

        <span className="mx-0.5 hidden h-4 w-px bg-white/10 sm:block" />

        <div className="relative min-w-0" ref={traitsDropdownRef}>
            <div className={cn('pointer-events-none absolute bottom-full left-0 z-30 mb-2 w-56 overflow-hidden', showTraitsDropdown ? 'pointer-events-auto' : 'pointer-events-none')}>
                <AnimatedHeight isOpen={showTraitsDropdown} duration={220}>
                    <div className="space-y-2 rounded-xl border border-white/10 bg-sparkle-card p-2 shadow-lg">
                        <div className="px-2 pt-1 text-[9px] font-semibold uppercase tracking-[0.16em] text-sparkle-text-muted">Reasoning</div>
                        <div className="space-y-1 px-1">{EFFORT_OPTIONS.map((effort) => <button key={effort} type="button" onClick={() => setSelectedEffort(effort)} className={cn('flex w-full items-center rounded-md px-2 py-1.5 text-left text-[11px] transition-colors', selectedEffort === effort ? 'bg-white/[0.05] text-sparkle-text' : 'text-sparkle-text-secondary hover:bg-white/[0.03] hover:text-sparkle-text')}>{EFFORT_LABELS[effort]}</button>)}</div>
                        <div className="border-t border-white/5 px-2 pt-2 text-[9px] font-semibold uppercase tracking-[0.16em] text-sparkle-text-muted">Fast Mode</div>
                        <div className="flex gap-1 px-1 pb-1"><button type="button" onClick={() => setFastModeEnabled(false)} className={cn('flex-1 rounded-md px-2 py-1.5 text-[11px] transition-colors', !fastModeEnabled ? 'bg-white/[0.05] text-sparkle-text' : 'text-sparkle-text-secondary hover:bg-white/[0.03] hover:text-sparkle-text')}>off</button><button type="button" onClick={() => setFastModeEnabled(true)} className={cn('flex-1 rounded-md px-2 py-1.5 text-[11px] transition-colors', fastModeEnabled ? 'bg-white/[0.05] text-sparkle-text' : 'text-sparkle-text-secondary hover:bg-white/[0.03] hover:text-sparkle-text')}>on</button></div>
                    </div>
                </AnimatedHeight>
            </div>
            <button type="button" disabled={controlsLocked} onClick={() => setShowTraitsDropdown((prev) => controlsLocked ? prev : !prev)} className={cn('shrink-0 whitespace-nowrap px-1.5 text-[13px] font-medium text-sparkle-text-secondary transition-colors hover:text-sparkle-text sm:px-2.5', controlsLocked && 'cursor-not-allowed opacity-45 hover:text-sparkle-text-secondary')} title="Reasoning and speed"><span className="inline-flex items-center gap-1.5"><span className="text-[13px] font-medium text-amber-200">{EFFORT_LABELS[selectedEffort]}</span>{fastModeEnabled ? <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/20 bg-emerald-500/10 px-1.5 py-0.5 text-[9px] font-medium text-emerald-200"><span className="h-1 w-1 rounded-full bg-emerald-300/90" /><span>Fast</span></span> : null}<ChevronDown size={10} className="-mr-0.5 ml-0.5 opacity-60" /></span></button>
        </div>

        <span className="mx-0.5 hidden h-4 w-px bg-white/10 sm:block" />

        <button type="button" disabled={controlsLocked} onClick={() => setSelectedInteractionMode((current: string) => controlsLocked ? current : current === 'plan' ? 'default' : 'plan')} className={cn('inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1.5 text-[13px] font-medium transition-colors sm:px-3', selectedInteractionMode === 'plan' ? 'border-white/10 bg-violet-500/10 text-violet-200 hover:border-white/20 hover:bg-violet-500/14 hover:text-violet-100' : 'border-white/10 bg-sky-500/10 text-sky-200 hover:border-white/20 hover:bg-sky-500/14 hover:text-sky-100', controlsLocked && 'cursor-not-allowed opacity-45 hover:border-white/10 hover:bg-violet-500/10 hover:text-violet-200')} title={selectedInteractionMode === 'plan' ? 'Plan mode - click to return to normal chat mode' : 'Default mode - click to enter plan mode'}>{selectedInteractionMode === 'plan' ? <ListTodo size={14} /> : <MessageSquare size={14} />}<span>{selectedInteractionMode === 'plan' ? 'Plan' : 'Chat'}</span></button>
        <span className="mx-0.5 hidden h-4 w-px bg-white/10 sm:block" />
        <button type="button" disabled={controlsLocked} onClick={() => { if (controlsLocked) return; if (selectedRuntimeMode === 'full-access') { setSelectedRuntimeMode('approval-required'); return } setShowFullAccessConfirm(true) }} className={cn('shrink-0 whitespace-nowrap px-1.5 text-[13px] font-medium transition-colors sm:px-2.5', selectedRuntimeMode === 'full-access' ? 'text-amber-200 hover:text-amber-100' : 'text-emerald-200 hover:text-emerald-100', controlsLocked && 'cursor-not-allowed opacity-45 hover:text-emerald-200')} title={displayedProfile}><span className="inline-flex items-center gap-1.5">{selectedRuntimeMode === 'full-access' ? <LockOpen size={14} /> : <Lock size={14} />}<span className="text-[13px] font-medium">{selectedRuntimeMode === 'full-access' ? 'Full access' : 'Supervised'}</span></span></button>
    </div>
))

export const ComposerStatusBar = memo(({
    isThinking,
    mentionLoading,
    modelsLoading,
    branchesLoading,
    thinkingLabel,
    fastModeEnabled,
    branchDropdownRef,
    showBranchDropdown,
    setShowBranchDropdown,
    isGitRepo,
    currentBranch,
    branchButtonLabel
}: {
    isThinking: boolean
    mentionLoading: boolean
    modelsLoading: boolean
    branchesLoading: boolean
    thinkingLabel: string
    fastModeEnabled: boolean
    branchDropdownRef: RefObject<HTMLDivElement | null>
    showBranchDropdown: boolean
    setShowBranchDropdown: Dispatch<SetStateAction<boolean>>
    isGitRepo: boolean
    currentBranch: string | null
    branchButtonLabel: string
}) => (
    <div className="flex items-center justify-between px-1 pt-2 text-[11px] font-medium text-sparkle-text-secondary">
        <div className="flex items-center gap-2">
            <span>Local</span>
            {(isThinking || mentionLoading || branchesLoading) ? (
                <span className="inline-flex items-center gap-1 text-[10px] text-sparkle-text-muted">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white/35" />
                    <span>{isThinking ? thinkingLabel : mentionLoading ? 'Indexing...' : 'Loading...'}</span>
                </span>
            ) : null}
        </div>

        <div className="relative" ref={branchDropdownRef}>
            <button type="button" onClick={() => setShowBranchDropdown((prev) => !prev)} className="inline-flex max-w-[220px] items-center gap-1.5 px-1 py-0.5 text-sparkle-text-secondary transition-colors hover:text-sparkle-text" title={isGitRepo ? (currentBranch || 'Current branch') : 'No git repository detected'}>
                {isGitRepo ? <GitBranch size={12} /> : null}
                <span className="truncate">{branchButtonLabel}</span>
                <ChevronDown size={11} className={cn('-mr-0.5 ml-0.5 opacity-60 transition-transform', showBranchDropdown && 'rotate-180')} />
            </button>
        </div>
    </div>
))
