import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSettings } from '@/lib/settings'
import { cn } from '@/lib/utils'
import { AnimatedHeight } from '@/components/ui/AnimatedHeight'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { VscodeEntryIcon } from '@/components/ui/VscodeEntryIcon'
import {
    Clock3,
    Check,
    ChevronDown,
    ChevronUp,
    Zap,
    FileCode2,
    FileImage,
    FileText,
    GitBranch,
    ListTodo,
    Loader2,
    Lock,
    LockOpen,
    MessageSquare,
    Plus,
    SendHorizontal,
    X
} from 'lucide-react'
import AssistantAttachmentPreviewModal from './AssistantAttachmentPreviewModal'
import { ComposerAttachmentsShelf, ComposerFooterControls, ComposerMentionMenu, ComposerSendButton, ComposerVoiceButton } from './AssistantComposerSections'
import { formatAssistantModelLabel } from './assistant-model-labels'
import {
    OpenAILogo,
    reconcileInlineMentionTags,
} from './assistant-composer-inline-mentions'
import type { AssistantComposerController } from './useAssistantComposerController'
import { deriveAssistantComposerViewState } from './assistant-composer-view-state'
import {
    getContentTypeTag,
    getContextFileMeta,
    isPastedTextAttachment,
    toKbLabel
} from './assistant-composer-utils'

export function AssistantComposerView({ controller }: { controller: AssistantComposerController }) {
    const navigate = useNavigate()
    const { settings } = useSettings()
    const transcriptionEnabled = settings.assistantTranscriptionEnabled
    const capabilities = controller.capabilities
    const canSend = capabilities.canSend
    const showBusySendActions = capabilities.showBusySendActions
    const defaultBusyActionLabel = controller.busyMessageMode === 'force' ? 'Force' : 'Queue'
    const secondaryBusyActionLabel = controller.busyMessageMode === 'force' ? 'Queue' : 'Force'
    const [showBrowserSpeechFallbackModal, setShowBrowserSpeechFallbackModal] = useState(false)
    const attachmentShelfRef = useRef<HTMLDivElement | null>(null)
    const {
        composerStatusDotClass,
        composerStatusToneClass,
        iconTheme,
        transientStatus,
        voiceBusy
    } = deriveAssistantComposerViewState({
        capabilities,
        controller,
        settings
    })

    useEffect(() => {
        if (settings.assistantTranscriptionEngine !== 'browser') {
            setShowBrowserSpeechFallbackModal(false)
            return
        }
        if (controller.voiceInput.speechErrorKind === 'network') {
            setShowBrowserSpeechFallbackModal(true)
        }
    }, [controller.voiceInput.speechErrorKind, settings.assistantTranscriptionEngine])

    useLayoutEffect(() => {
        const host = attachmentShelfRef.current
        if (!host) return

        const measure = () => {
            const itemRects = Array.from(host.querySelectorAll<HTMLElement>('[data-composer-attachment-item="true"]'))
                .map((element) => element.getBoundingClientRect())
                .filter((rect) => rect.width > 0 && rect.height > 0)

            if (itemRects.length === 0) {
                controller.onAttachmentShelfBoundsChange?.(null)
                return
            }

            const bounds = itemRects.reduce((acc, rect) => ({
                top: Math.min(acc.top, rect.top),
                right: Math.max(acc.right, rect.right),
                bottom: Math.max(acc.bottom, rect.bottom),
                left: Math.min(acc.left, rect.left),
                width: 0,
                height: 0
            }), {
                top: itemRects[0].top,
                right: itemRects[0].right,
                bottom: itemRects[0].bottom,
                left: itemRects[0].left,
                width: 0,
                height: 0
            })

            controller.onAttachmentShelfBoundsChange?.({
                ...bounds,
                width: Math.max(0, bounds.right - bounds.left),
                height: Math.max(0, bounds.bottom - bounds.top)
            })
        }

        const frameId = window.requestAnimationFrame(measure)
        const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => measure()) : null
        observer?.observe(host)
        window.addEventListener('resize', measure)

        return () => {
            window.cancelAnimationFrame(frameId)
            observer?.disconnect()
            window.removeEventListener('resize', measure)
        }
    }, [controller.contextFiles.length, controller.onAttachmentShelfBoundsChange])

    return (
        <>
            <div className="relative flex pointer-events-none flex-col gap-0">
                <div ref={attachmentShelfRef} className="pointer-events-none absolute inset-x-0 bottom-full z-20 mb-1">
                    <div className="flex flex-col gap-1.5">
                        <AnimatedHeight isOpen={controller.queuedMessages.length > 0} duration={220}>
                            <div className="pointer-events-auto flex flex-col gap-1.5">
                                {controller.queuedMessages.map((queuedMessage, index) => {
                                    const isForce = queuedMessage.dispatchMode === 'force'
                                    return (
                                        <div
                                            key={queuedMessage.id}
                                            data-composer-attachment-item="true"
                                            className={cn(
                                                'overflow-hidden rounded-xl border bg-sparkle-card/95 px-3 py-2.5 shadow-[0_12px_28px_rgba(0,0,0,0.22)] backdrop-blur-xl',
                                                isForce
                                                    ? 'border-amber-400/20'
                                                    : 'border-white/10'
                                            )}
                                        >
                                            <div className="flex items-start gap-2.5">
                                                <div className={cn(
                                                    'mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg',
                                                    isForce
                                                        ? 'bg-amber-500/12 text-amber-200'
                                                        : 'bg-white/[0.05] text-sparkle-text-secondary'
                                                )}>
                                                    {isForce ? <Zap size={13} /> : <Clock3 size={13} />}
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <div className="flex items-center gap-2">
                                                        <span className={cn(
                                                            'rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.12em]',
                                                            isForce
                                                                ? 'bg-amber-500/12 text-amber-100'
                                                                : 'bg-white/[0.05] text-sparkle-text-muted'
                                                        )}>
                                                            {isForce ? 'Force next' : `Queued ${index + 1}`}
                                                        </span>
                                                    </div>
                                                    <p
                                                        className="mt-1.5 whitespace-pre-wrap break-words text-[12px] leading-5 text-sparkle-text"
                                                        style={{
                                                            display: '-webkit-box',
                                                            WebkitBoxOrient: 'vertical',
                                                            WebkitLineClamp: 3,
                                                            overflow: 'hidden'
                                                        }}
                                                    >
                                                        {queuedMessage.prompt.trim() || 'Attachment-only message'}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        </AnimatedHeight>
                        <ComposerAttachmentsShelf
                            contextFiles={controller.contextFiles}
                            compact={controller.compact}
                            removingAttachmentIds={controller.removingAttachmentIds}
                            onOpenAttachmentPreview={controller.onOpenAttachmentPreview}
                            onPreview={controller.setPreviewAttachment}
                            onRemove={controller.removeAttachment}
                        />
                    </div>
                </div>
                <div ref={controller.composerRootRef} className="pointer-events-auto relative z-10">
                    <div className="group rounded-[20px] border border-white/10 bg-sparkle-card transition-[border-color,box-shadow] duration-200 focus-within:border-[var(--accent-primary)]/28 focus-within:shadow-[0_0_0_1px_color-mix(in_srgb,var(--accent-primary)_18%,transparent),0_0_18px_color-mix(in_srgb,var(--accent-primary)_12%,transparent)]">
                        <input
                            ref={controller.filePickerRef}
                            type="file"
                            className="hidden"
                            multiple
                            accept="image/*,text/*,.md,.markdown,.txt,.json,.yaml,.yml,.xml,.csv,.ts,.tsx,.js,.jsx,.mjs,.cjs,.py,.go,.rs,.java,.kt,.cs,.cpp,.c,.h,.css,.scss,.sass,.html,.sql,.toml,.sh,.ps1"
                            onChange={(event) => {
                                const files = event.target.files
                                if (files?.length) {
                                    for (const file of Array.from(files)) void controller.attachFile(file, 'manual')
                                }
                                event.currentTarget.value = ''
                            }}
                        />
                        <div ref={controller.mentionMenuRef} className="relative px-3 pb-2 pt-3 sm:px-4 sm:pt-4">
                            <ComposerMentionMenu
                                isOpen={controller.showMentionMenu}
                                mentionCanScrollUp={controller.mentionCanScrollUp}
                                mentionCanScrollDown={controller.mentionCanScrollDown}
                                mentionLoading={controller.mentionLoading}
                                mentionCandidates={controller.mentionCandidates}
                                activeMentionIndex={controller.activeMentionIndex}
                                mentionListRef={controller.mentionListRef}
                                iconTheme={iconTheme}
                                onScroll={(element) => controller.syncScrollAffordance(element, controller.setMentionCanScrollUp, controller.setMentionCanScrollDown)}
                                onApplyMention={controller.applyMentionCandidate}
                            />

                            <div className="flex min-h-[56px] items-start gap-2">
                                <button
                                    type="button"
                                    onClick={() => controller.filePickerRef.current?.click()}
                                    disabled={capabilities.attachDisabled}
                                    className="mt-0.5 rounded-lg p-1 text-sparkle-text-muted transition-colors hover:bg-white/[0.03] hover:text-sparkle-text disabled:opacity-50"
                                    title={capabilities.attachDisabled
                                        ? capabilities.detailLabel || 'Attachments are unavailable right now'
                                        : 'Attach files'}
                                >
                                    <Plus size={18} />
                                </button>
                                <div className="relative min-w-0 flex-1">
                                    <textarea
                                        ref={controller.textareaRef}
                                        rows={3}
                                        value={controller.text}
                                        onChange={(event) => {
                                            const nextText = event.target.value
                                            controller.setInlineMentionTags((current) => reconcileInlineMentionTags(controller.text, nextText, current))
                                            controller.setText(nextText)
                                            controller.setComposerCursor(event.target.selectionStart ?? nextText.length)
                                            if (controller.historyCursor != null) controller.setHistoryCursor(null)
                                        }}
                                        onClick={(event) => controller.syncComposerCursor(event.currentTarget)}
                                        onKeyUp={(event) => controller.syncComposerCursor(event.currentTarget)}
                                        onSelect={(event) => controller.syncComposerCursor(event.currentTarget)}
                                        onKeyDown={controller.handleKeyDown}
                                        onPaste={controller.handlePaste}
                                        className={cn('relative w-full resize-none overflow-y-auto bg-transparent pl-[3px] pr-2 text-sparkle-text outline-none placeholder:text-sparkle-text/20 selection:bg-white/15', controller.compact ? 'min-h-[52px] text-[13px] leading-[1.35rem]' : 'min-h-[58px] text-[14px] leading-[1.45rem]')}
                                        placeholder={capabilities.placeholder}
                                        disabled={capabilities.inputDisabled || voiceBusy}
                                    />
                                </div>
                            </div>
                        </div>
                        <div className={cn('flex items-center justify-between px-1.5 pb-1.5 sm:px-2 sm:pb-2', controller.isCompactFooter ? 'gap-0.5' : 'flex-wrap gap-1 sm:flex-nowrap sm:gap-0')}>
                        <ComposerFooterControls
                            isCompactFooter={controller.isCompactFooter}
                            controlsLocked={capabilities.controlsLocked}
                            modelDropdownRef={controller.modelDropdownRef}
                            showModelDropdown={controller.showModelDropdown}
                                setShowModelDropdown={controller.setShowModelDropdown}
                                modelsLoading={controller.modelsLoading}
                                modelsError={controller.modelsError}
                                modelQuery={controller.modelQuery}
                                setModelQuery={controller.setModelQuery}
                                setActiveModelIndex={controller.setActiveModelIndex}
                                modelCanScrollUp={controller.modelCanScrollUp}
                                modelCanScrollDown={controller.modelCanScrollDown}
                                setModelCanScrollUp={controller.setModelCanScrollUp}
                                setModelCanScrollDown={controller.setModelCanScrollDown}
                                modelListRef={controller.modelListRef}
                                filteredModelOptions={controller.filteredModelOptions}
                                activeModelIndex={controller.activeModelIndex}
                                selectedModel={controller.selectedModel}
                                selectedModelLabel={controller.selectedModelLabel}
                                latestModelId={controller.latestModelId}
                                setSelectedModel={controller.setSelectedModel}
                                onRefreshModels={controller.onRefreshModels}
                                traitsDropdownRef={controller.traitsDropdownRef}
                                showTraitsDropdown={controller.showTraitsDropdown}
                                setShowTraitsDropdown={controller.setShowTraitsDropdown}
                                EFFORT_OPTIONS={controller.EFFORT_OPTIONS}
                                selectedEffort={controller.selectedEffort}
                                setSelectedEffort={controller.setSelectedEffort}
                                EFFORT_LABELS={controller.EFFORT_LABELS}
                                fastModeEnabled={controller.fastModeEnabled}
                                setFastModeEnabled={controller.setFastModeEnabled}
                                selectedInteractionMode={controller.selectedInteractionMode}
                                setSelectedInteractionMode={controller.setSelectedInteractionMode}
                                selectedRuntimeMode={controller.selectedRuntimeMode}
                                setSelectedRuntimeMode={controller.setSelectedRuntimeMode}
                                displayedProfile={controller.displayedProfile}
                                setShowFullAccessConfirm={controller.setShowFullAccessConfirm}
                            />

                            <div className="flex shrink-0 items-center gap-2">
                                {controller.showCancelWhenDirty && controller.isDirty ? (
                                    <button
                                        type="button"
                                        onClick={controller.handleCancelDirty}
                                        className="inline-flex h-[36px] items-center justify-center rounded-full border border-transparent bg-white/[0.03] px-3.5 text-[12px] font-semibold text-sparkle-text-secondary transition-colors hover:bg-white/[0.05] hover:text-sparkle-text"
                                    >
                                        {controller.cancelLabel}
                                    </button>
                                ) : null}
                                <ComposerVoiceButton
                                    supported={transcriptionEnabled && controller.voiceInput.isSupported}
                                    isRecording={controller.voiceInput.isRecording}
                                    disabled={capabilities.voiceDisabled || controller.voiceInput.isTranscribing}
                                    onToggle={controller.voiceInput.toggleRecording}
                                />
                                {controller.queuedMessageCount > 0 ? (
                                    <span className="inline-flex h-[36px] items-center rounded-full border border-transparent bg-white/[0.03] px-3 text-[11px] font-medium text-sparkle-text-secondary">
                                        {controller.queuedMessageCount} queued
                                    </span>
                                ) : null}
                                {showBusySendActions ? (
                                    <>
                                        <button
                                            type="button"
                                            onClick={() => void controller.handleSend()}
                                            className="inline-flex h-[36px] items-center justify-center rounded-full border border-white/10 bg-[#2246a8] px-3.5 text-[12px] font-semibold text-white transition-all duration-150 hover:scale-[1.03] hover:border-white/20 hover:bg-[#2955ca]"
                                            title={`${defaultBusyActionLabel} this message while the current turn is still running`}
                                        >
                                            {defaultBusyActionLabel}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => void (controller.busyMessageMode === 'force' ? controller.handleQueueSend() : controller.handleForceSend())}
                                            className="inline-flex h-[36px] items-center justify-center rounded-full border border-transparent bg-white/[0.03] px-3.5 text-[12px] font-semibold text-sparkle-text-secondary transition-colors hover:bg-white/[0.05] hover:text-sparkle-text"
                                            title={`${secondaryBusyActionLabel} this message instead of using the default busy-send action`}
                                        >
                                            {secondaryBusyActionLabel}
                                        </button>
                                        <ComposerSendButton
                                            disabled={capabilities.sendDisabled || voiceBusy}
                                            isConnected={controller.isConnected}
                                            isThinking={true}
                                            canSend={false}
                                            label={controller.isDirty && controller.dirtySubmitLabel ? controller.dirtySubmitLabel : controller.submitLabel}
                                            onStop={controller.onStop}
                                            onSend={() => void controller.handleSend()}
                                        />
                                    </>
                                ) : (
                                    <ComposerSendButton
                                        disabled={capabilities.sendDisabled || voiceBusy}
                                        isConnected={controller.isConnected}
                                        isThinking={controller.isThinking}
                                        canSend={canSend}
                                        label={controller.isDirty && controller.dirtySubmitLabel ? controller.dirtySubmitLabel : controller.submitLabel}
                                        onStop={controller.onStop}
                                        onSend={() => void controller.handleSend()}
                                    />
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="pointer-events-auto flex items-center justify-between px-1 pt-2 text-[11px] font-medium text-sparkle-text-secondary">
                    <div className="flex items-center gap-2">
                        {transientStatus ? (
                            <span className={cn('inline-flex items-center gap-1.5', transientStatus.toneClass)}>
                                <span className={cn('h-1.5 w-1.5 rounded-full', transientStatus.dotClass)} />
                                <span>{transientStatus.label}</span>
                            </span>
                        ) : (
                            <>
                                <span className={cn('inline-flex items-center gap-1.5', composerStatusToneClass)}>
                                    <span className={cn('h-1.5 w-1.5 rounded-full', composerStatusDotClass)} />
                                    <span>{capabilities.statusLabel}</span>
                                </span>
                            </>
                        )}
                        {controller.queuedMessageCount > 0 ? (
                            <span className="inline-flex items-center gap-1 text-[10px] text-sparkle-text-muted">
                                <span className="h-1.5 w-1.5 rounded-full bg-sky-300/70" />
                                <span>{controller.queuedMessageCount} queued</span>
                            </span>
                        ) : null}
                    </div>

                    <div className="relative" ref={controller.branchDropdownRef}>
                        <button type="button" onClick={() => controller.setShowBranchDropdown((prev) => !prev)} className="inline-flex max-w-[220px] items-center gap-1.5 px-1 py-0.5 text-sparkle-text-secondary transition-colors hover:text-sparkle-text" title={controller.isGitRepo ? (controller.currentBranch || 'Current branch') : 'No git repository detected'}>
                            {controller.isGitRepo && <GitBranch size={12} />}
                            <span className="truncate">{controller.branchButtonLabel}</span>
                            <ChevronDown size={11} className="-mr-0.5 ml-0.5 opacity-60" />
                        </button>

                        <div className={cn('pointer-events-none absolute bottom-full right-0 z-[170] mb-2 w-64 overflow-hidden', controller.showBranchDropdown ? 'pointer-events-auto' : 'pointer-events-none')}>
                            <AnimatedHeight isOpen={controller.showBranchDropdown} duration={220}>
                                <div className="rounded-lg border border-white/10 bg-sparkle-card p-1.5 shadow-lg">
                                    {!controller.isGitRepo ? (
                                        <div className="px-1.5 py-1.5 text-[10px] text-sparkle-text-secondary">This folder is not a git repository.</div>
                                    ) : controller.branches.length === 0 ? (
                                        <div className="flex items-center gap-1.5 px-1.5 py-1.5 text-[10px] text-sparkle-text-secondary">{controller.branchesLoading && <Loader2 size={11} className="animate-spin" />}<span>{controller.branchesLoading ? 'Loading branches...' : 'No branches found.'}</span></div>
                                    ) : (
                                        <>
                                            <div className="px-1.5 pb-1.5 pt-0.5 text-[9px] font-semibold uppercase tracking-[0.14em] text-sparkle-text-muted">
                                                {controller.isSwitchingBranch ? 'Switching branch...' : 'Switch branch'}
                                            </div>
                                            <div className="pb-1"><input value={controller.branchQuery} onChange={(event) => { controller.setBranchQuery(event.target.value); controller.setActiveBranchIndex(0) }} placeholder="Search branches..." className="block h-8 w-full min-w-0 rounded-md border border-white/10 bg-white/[0.03] px-2 py-1 text-[10px] text-sparkle-text outline-none placeholder:text-sparkle-text-muted/60" /></div>
                                            <div className="max-h-56 space-y-0.5 overflow-y-auto scrollbar-hide px-0.5">
                                                {controller.filteredBranches.length === 0 ? <div className="px-2 py-1.5 text-[10px] text-sparkle-text-secondary">No branches found.</div> : controller.filteredBranches.map((branch, index) => {
                                                    const isCurrent = Boolean(branch.current)
                                                    const isDefault = controller.defaultBranchName === branch.name
                                                    const isHighlighted = index === controller.activeBranchIndex
                                                    return (
                                                    <button
                                                        key={`${branch.name}-${branch.commit}`}
                                                        type="button"
                                                        onClick={() => void controller.handleBranchSwitch(branch.name)}
                                                        disabled={controller.isSwitchingBranch || isCurrent}
                                                        className={cn(
                                                            'flex w-full items-center justify-between rounded-md border px-2 py-1.5 text-left transition-colors',
                                                            isCurrent
                                                                ? 'border-white/10 bg-white/[0.04] text-sparkle-text'
                                                                : 'border-transparent text-sparkle-text-secondary hover:bg-white/[0.03] hover:text-sparkle-text',
                                                            isHighlighted && !isCurrent && 'bg-white/[0.03] text-sparkle-text',
                                                            (controller.isSwitchingBranch || isCurrent) && 'cursor-default'
                                                        )}
                                                    >
                                                        <div className="min-w-0 flex-1">
                                                            <div className="flex flex-wrap items-center gap-1">
                                                                <div
                                                                    className="min-w-0 overflow-hidden break-words whitespace-normal text-[11px] font-medium leading-[1.05rem]"
                                                                    style={{
                                                                        display: '-webkit-box',
                                                                        WebkitBoxOrient: 'vertical',
                                                                        WebkitLineClamp: 2
                                                                    }}
                                                                >
                                                                    {branch.name}
                                                                </div>
                                                                {isCurrent ? <span className="rounded border border-emerald-400/20 bg-emerald-500/10 px-1 py-0.5 text-[9px] text-emerald-200">Current</span> : null}
                                                                {isDefault ? <span className="rounded border border-sky-400/20 bg-sky-500/10 px-1 py-0.5 text-[9px] text-sky-200">Default</span> : null}
                                                                {branch.isLocal === false ? <span className="rounded border border-white/10 bg-white/[0.03] px-1 py-0.5 text-[9px] text-sparkle-text-secondary">Remote</span> : null}
                                                                {!isCurrent && branch.label ? <span className="truncate text-[9px]">{branch.label}</span> : null}
                                                            </div>
                                                        </div>
                                                        {!isCurrent ? <span className="ml-2 text-[9px] font-medium uppercase tracking-[0.08em] text-sparkle-text-secondary">Switch</span> : null}
                                                    </button>
                                                )})}
                                            </div>
                                            {controller.branchActionError ? (
                                                <div className="px-2 pt-1.5 text-[9px] font-medium text-rose-300">
                                                    {controller.branchActionError}
                                                </div>
                                            ) : null}
                                        </>
                                    )}
                                </div>
                            </AnimatedHeight>
                        </div>
                    </div>
                </div>

                <AssistantAttachmentPreviewModal
                    file={controller.previewAttachment}
                    meta={controller.previewAttachment ? getContextFileMeta(controller.previewAttachment) : null}
                    contentType={controller.previewAttachment ? getContentTypeTag(controller.previewAttachment) : ''}
                    sizeLabel={controller.previewAttachment ? toKbLabel(controller.previewAttachment.sizeBytes) : ''}
                    showFormattingWarning={controller.previewAttachment ? isPastedTextAttachment(controller.previewAttachment) : false}
                    onUpdatePastedText={controller.updateContextFileText}
                    onClose={() => controller.setPreviewAttachment(null)}
                />
            </div>

            <ConfirmModal
                isOpen={controller.showFullAccessConfirm}
                title="Enable full access?"
                message="Full access disables approval prompts and lets Codex run with danger-full-access for this assistant thread. Only continue if you trust the current project and prompt."
                confirmLabel="Enable full access"
                cancelLabel="Stay safe"
                variant="warning"
                onConfirm={() => {
                    controller.setSelectedRuntimeMode('full-access')
                    controller.setShowFullAccessConfirm(false)
                }}
                onCancel={() => controller.setShowFullAccessConfirm(false)}
            />
            <ConfirmModal
                isOpen={showBrowserSpeechFallbackModal}
                title="Browser speech failed"
                message="The runtime speech service could not complete transcription. Open assistant settings to switch engines or install the local Vosk model."
                confirmLabel="Open settings"
                cancelLabel="Dismiss"
                variant="info"
                onConfirm={() => {
                    setShowBrowserSpeechFallbackModal(false)
                    navigate('/settings/account?highlight=transcription')
                }}
                onCancel={() => setShowBrowserSpeechFallbackModal(false)}
            />
        </>
    )
}
