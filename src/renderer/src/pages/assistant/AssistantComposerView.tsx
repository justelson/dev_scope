import { useSettings } from '@/lib/settings'
import { cn } from '@/lib/utils'
import { AnimatedHeight } from '@/components/ui/AnimatedHeight'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { VscodeEntryIcon } from '@/components/ui/VscodeEntryIcon'
import {
    Check,
    ChevronDown,
    ChevronUp,
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
import { ComposerAttachmentsShelf, ComposerFooterControls, ComposerMentionMenu, ComposerSendButton } from './AssistantComposerSections'
import { formatAssistantModelLabel } from './assistant-model-labels'
import {
    OpenAILogo,
    reconcileInlineMentionTags,
} from './assistant-composer-inline-mentions'
import type { AssistantComposerController } from './useAssistantComposerController'
import {
    getContentTypeTag,
    getContextFileMeta,
    isPastedTextAttachment,
    toKbLabel
} from './assistant-composer-utils'

export function AssistantComposerView({ controller }: { controller: AssistantComposerController }) {
    const { settings } = useSettings()
    const iconTheme = settings.theme === 'light' ? 'light' : 'dark'

    return (
        <>
            <div className={cn('relative flex pointer-events-none flex-col', controller.contextFiles.length > 0 ? (controller.compact ? 'gap-1' : 'gap-1.5') : 'gap-0')}>
                <ComposerAttachmentsShelf
                    contextFiles={controller.contextFiles}
                    compact={controller.compact}
                    removingAttachmentIds={controller.removingAttachmentIds}
                    onPreview={controller.setPreviewAttachment}
                    onRemove={controller.removeAttachment}
                />

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
                                <button type="button" onClick={() => controller.filePickerRef.current?.click()} disabled={controller.disabled} className="mt-0.5 rounded-lg p-1 text-sparkle-text-muted transition-colors hover:bg-white/[0.03] hover:text-sparkle-text disabled:opacity-50" title="Attach files"><Plus size={18} /></button>
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
                                        placeholder="Ask anything, @tag files/folders"
                                        disabled={controller.disabled || !controller.isConnected}
                                    />
                                </div>
                            </div>
                        </div>
                        <div className={cn('flex items-center justify-between px-1.5 pb-1.5 sm:px-2 sm:pb-2', controller.isCompactFooter ? 'gap-0.5' : 'flex-wrap gap-1 sm:flex-nowrap sm:gap-0')}>
                            <ComposerFooterControls
                                isCompactFooter={controller.isCompactFooter}
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
                                <ComposerSendButton
                                    disabled={controller.disabled}
                                    isConnected={controller.isConnected}
                                    isThinking={controller.isThinking}
                                    canSend={Boolean(controller.text.trim() || controller.contextFiles.length > 0)}
                                    onSend={() => void controller.handleSend()}
                                />
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex items-center justify-between px-1 pt-2 text-[11px] font-medium text-sparkle-text-secondary">
                    <div className="flex items-center gap-2">
                        <span>Local</span>
                        {(controller.isThinking || controller.mentionLoading || controller.modelsLoading || controller.branchesLoading) && (
                            <span className="inline-flex items-center gap-1 text-[10px] text-sparkle-text-muted">
                                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white/35" />
                                {controller.isThinking ? controller.thinkingLabel : controller.mentionLoading ? 'Indexing...' : controller.modelsLoading ? 'Loading models...' : 'Loading...'}
                            </span>
                        )}
                    </div>

                    <div className="relative" ref={controller.branchDropdownRef}>
                        <button type="button" onClick={() => controller.setShowBranchDropdown((prev) => !prev)} className="inline-flex max-w-[220px] items-center gap-1.5 px-1 py-0.5 text-sparkle-text-secondary transition-colors hover:text-sparkle-text" title={controller.isGitRepo ? (controller.currentBranch || 'Current branch') : 'No git repository detected'}>
                            {controller.isGitRepo && <GitBranch size={12} />}
                            <span className="truncate">{controller.branchButtonLabel}</span>
                            <ChevronDown size={11} className="-mr-0.5 ml-0.5 opacity-60" />
                        </button>

                        <div className={cn('pointer-events-none absolute bottom-full right-0 z-30 mb-2 w-72 overflow-hidden', controller.showBranchDropdown ? 'pointer-events-auto' : 'pointer-events-none')}>
                            <AnimatedHeight isOpen={controller.showBranchDropdown} duration={220}>
                                <div className="rounded-xl border border-white/10 bg-sparkle-card p-2 shadow-lg">
                                    {!controller.isGitRepo ? (
                                        <div className="px-2 py-2 text-[11px] text-sparkle-text-secondary">This folder is not a git repository.</div>
                                    ) : controller.branches.length === 0 ? (
                                        <div className="flex items-center gap-2 px-2 py-2 text-[11px] text-sparkle-text-secondary">{controller.branchesLoading && <Loader2 size={12} className="animate-spin" />}<span>{controller.branchesLoading ? 'Loading branches...' : 'No branches found.'}</span></div>
                                    ) : (
                                        <>
                                            <div className="pb-1"><input value={controller.branchQuery} onChange={(event) => { controller.setBranchQuery(event.target.value); controller.setActiveBranchIndex(0) }} placeholder="Search branches..." className="block w-full min-w-0 rounded-md border border-white/10 bg-white/[0.03] px-2.5 py-1.5 text-[11px] text-sparkle-text outline-none placeholder:text-sparkle-text-muted/60" /></div>
                                            <div className="max-h-64 space-y-0.5 overflow-y-auto scrollbar-hide px-1">
                                                {controller.filteredBranches.length === 0 ? <div className="px-2.5 py-2 text-[11px] text-sparkle-text-secondary">No branches found.</div> : controller.filteredBranches.map((branch, index) => (
                                                    <div key={`${branch.name}-${branch.commit}`} className={cn('flex items-center justify-between rounded-md border px-2.5 py-2 text-left transition-colors', branch.current ? 'border-white/10 bg-white/[0.04] text-sparkle-text' : 'border-transparent text-sparkle-text-secondary hover:bg-white/[0.03]', index === controller.activeBranchIndex && !branch.current && 'bg-white/[0.03] text-sparkle-text')}>
                                                        <div className="min-w-0"><div className="truncate text-[12px] font-medium">{branch.name}</div><div className="truncate text-[10px] text-sparkle-text-muted">{branch.current ? 'Current branch' : branch.label}</div></div>
                                                        {branch.current && <span className="ml-3 text-[10px] font-medium text-sparkle-text-secondary">Current</span>}
                                                    </div>
                                                ))}
                                            </div>
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
        </>
    )
}
