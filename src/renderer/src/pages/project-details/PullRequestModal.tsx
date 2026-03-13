import { createPortal } from 'react-dom'
import { type ReactNode, useCallback, useEffect, useState } from 'react'
import {
    ArrowUpRight,
    Copy,
    GitPullRequest,
    ListTree,
    Loader2,
    Settings2,
    Sparkles,
    X
} from 'lucide-react'
import { Checkbox, Input, Select, Textarea } from '@/components/ui/FormControls'
import { PushRangeSelector } from './PushRangeConfirmModal'
import type { PullRequestModalProps } from './pull-request/types'
import { usePullRequestModalController } from './pull-request/usePullRequestModalController'
import { GUIDE_SOURCE_OPTIONS, SCOPE_OPTIONS } from './pull-request/utils'
import { Field, InlineHint, StatusBanner } from './pull-request/ui'

type OverlayProps = {
    children: ReactNode
    zIndexClass: string
    onClose: () => void
}

function TopLevelOverlay({ children, zIndexClass, onClose }: OverlayProps) {
    if (typeof document === 'undefined') return null

    return createPortal(
        <div
            className={`fixed inset-0 ${zIndexClass} flex items-center justify-center bg-black/60 backdrop-blur-md animate-fadeIn`}
            onClick={onClose}
        >
            {children}
        </div>,
        document.body
    )
}

function getPublishStepText(controller: ReturnType<typeof usePullRequestModalController>) {
    if (!controller.publishPreview.hasRemote) {
        return 'Add a GitHub remote first.'
    }

    if (controller.publishPreview.strategy === 'publish-branch') {
        return `Push this branch to ${controller.publishPreview.remoteName || 'remote'} yourself before opening the PR.`
    }

    return 'DevScope will not stage, commit, or push anything automatically.'
}

function getWhatHappensLines(controller: ReturnType<typeof usePullRequestModalController>) {
    return [
        `Include ${controller.executionPlan.changeSourceLabel.toLowerCase()}.`,
        'Generate or reuse the PR title and body.',
        getPublishStepText(controller),
        `Open a ${controller.draftMode ? 'draft ' : ''}GitHub PR in the browser targeting ${controller.targetBranch || 'the target branch'}.`
    ]
}

export function PullRequestModal(props: PullRequestModalProps) {
    const controller = usePullRequestModalController(props)
    const whatHappensLines = getWhatHappensLines(controller)
    const [isWhatHappensOpen, setIsWhatHappensOpen] = useState(false)

    const handleClose = useCallback(() => {
        controller.persistProjectConfig()
        props.onClose()
    }, [controller, props])

    useEffect(() => {
        if (!props.isOpen) return

        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && !controller.isAdvancedOpen && !controller.isDraftEditorOpen && !isWhatHappensOpen) {
                handleClose()
            }
        }

        document.addEventListener('keydown', handleEscape)
        return () => document.removeEventListener('keydown', handleEscape)
    }, [props.isOpen, controller.isAdvancedOpen, controller.isDraftEditorOpen, handleClose, isWhatHappensOpen])

    if (!props.isOpen || typeof document === 'undefined') {
        return null
    }

    return (
        <>
            {createPortal(
                <div
                    className="fixed inset-0 z-[145] flex items-center justify-center bg-black/65 backdrop-blur-md animate-fadeIn"
                    onClick={handleClose}
                >
                    <div
                        className="relative m-4 flex max-h-[95vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-sparkle-card shadow-2xl"
                        onClick={(event) => event.stopPropagation()}
                    >
                        <div className="border-b border-white/10 bg-white/[0.02] px-5 py-4">
                            <div className="flex items-start justify-between gap-4">
                                <div>
                                    <p className="text-[11px] uppercase tracking-[0.2em] text-white/35">Create Pull Request</p>
                                    <div className="mt-1 flex items-center gap-2 text-lg font-semibold text-white">
                                        <GitPullRequest size={18} className="text-[var(--accent-primary)]" />
                                        <span className="truncate">{props.projectName}</span>
                                    </div>
                                    <p className="mt-2 text-sm text-white/58">
                                        Pick the local work to describe. DevScope drafts the PR and opens GitHub in the browser without changing your repo state.
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={handleClose}
                                    className="rounded-lg border border-white/10 bg-white/[0.03] p-2 text-white/65 transition-all hover:border-white/20 hover:bg-white/[0.05] hover:text-white"
                                    aria-label="Close pull request modal"
                                >
                                    <X size={16} />
                                </button>
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto px-5 py-4">
                            <div className="space-y-4">
                                <Field label="Change source">
                                    <Select
                                        value={controller.changeSource}
                                        onChange={(value) => controller.setChangeSource(value as typeof controller.changeSource)}
                                        options={SCOPE_OPTIONS.map((option) => ({ value: option.value, label: option.label }))}
                                    />
                                </Field>

                                {controller.changeSource === 'local-commits' && props.unpushedCommits.length > 0 && (
                                    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                                        <PushRangeSelector
                                            commits={props.unpushedCommits}
                                            activeCommitHash={controller.selectedCommitHash}
                                            onActiveCommitChange={controller.setSelectedCommitHash}
                                            onCommitClick={props.onCommitClick}
                                            remoteName={controller.publishPreview.remoteName}
                                        />
                                    </div>
                                )}

                                <div className="grid gap-3 md:grid-cols-1">
                                    <Field label="Target branch">
                                        <Select
                                            value={controller.targetBranch}
                                            onChange={controller.setTargetBranch}
                                            options={controller.targetBranchOptions}
                                        />
                                    </Field>
                                </div>

                                <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                                    <Checkbox
                                        checked={controller.draftMode}
                                        onChange={controller.setDraftMode}
                                        label={controller.draftMode ? 'Open as draft pull request' : 'Open ready for review'}
                                        description="This only changes the GitHub PR page that DevScope opens."
                                        size="sm"
                                    />
                                </div>

                                <button
                                    type="button"
                                    onClick={() => setIsWhatHappensOpen(true)}
                                    className="flex w-full items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-left transition-all hover:border-white/20 hover:bg-white/[0.05]"
                                >
                                    <div>
                                        <p className="text-[11px] uppercase tracking-[0.18em] text-white/35">What Happens</p>
                                    <p className="mt-1 text-sm text-white/58">
                                            See what DevScope will do when you open this PR draft.
                                        </p>
                                    </div>
                                    <span className="inline-flex items-center gap-2 text-sm text-white/68">
                                        <ListTree size={15} />
                                        View
                                    </span>
                                </button>

                                {controller.selectedPushSummary && controller.changeSource === 'local-commits' && (
                                    <InlineHint>
                                        Draft context uses {controller.selectedPushSummary.commitsToPush.length} commit{controller.selectedPushSummary.commitsToPush.length === 1 ? '' : 's'} and leaves {controller.selectedPushSummary.newerLocalCommits.length} local out of the draft.
                                    </InlineHint>
                                )}

                                {controller.executionPlan.missingReason && (
                                    <StatusBanner tone="error" className="border-amber-400/20 bg-amber-400/10 text-amber-100">
                                        {controller.executionPlan.missingReason}
                                    </StatusBanner>
                                )}

                                {!controller.hasGitHubRemote && (
                                    <StatusBanner tone="error">
                                        Add a GitHub remote before DevScope can open the PR flow.
                                    </StatusBanner>
                                )}

                                {controller.statusMessage && (
                                    <StatusBanner tone={controller.statusMessage.tone}>
                                        {controller.statusMessage.text}
                                    </StatusBanner>
                                )}
                            </div>
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 bg-white/[0.02] px-5 py-4">
                            <button
                                type="button"
                                onClick={() => controller.setIsAdvancedOpen(true)}
                                className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-sm text-white/70 transition-all hover:border-white/20 hover:bg-white/[0.04] hover:text-white"
                            >
                                <Settings2 size={15} />
                                Advanced
                            </button>
                            <div className="flex flex-wrap items-center gap-3">
                                <button
                                    type="button"
                                    onClick={() => controller.setIsDraftEditorOpen(true)}
                                    className="rounded-lg border border-white/10 px-3 py-2 text-sm text-white/70 transition-all hover:border-white/20 hover:bg-white/[0.04] hover:text-white"
                                >
                                    Edit draft
                                </button>
                                <button
                                    type="button"
                                    onClick={handleClose}
                                    className="rounded-lg border border-white/10 px-3 py-2 text-sm text-white/70 transition-all hover:border-white/20 hover:bg-white/[0.04] hover:text-white"
                                >
                                    Close
                                </button>
                                <button
                                    type="button"
                                    onClick={() => { void controller.openGitHubPr() }}
                                    disabled={
                                        controller.isGenerating
                                        || controller.isExecuting
                                        || Boolean(controller.executionPlan.missingReason)
                                        || !controller.hasGitHubRemote
                                    }
                                    className="inline-flex items-center gap-2 rounded-lg border border-[var(--accent-primary)]/25 bg-[var(--accent-primary)]/14 px-4 py-2 text-sm font-medium text-white transition-all hover:bg-[var(--accent-primary)]/22 disabled:cursor-not-allowed disabled:opacity-45"
                                >
                                    {controller.isExecuting ? <Loader2 size={15} className="animate-spin" /> : <ArrowUpRight size={15} />}
                                    {controller.primaryActionLabel}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {controller.isAdvancedOpen && (
                <TopLevelOverlay zIndexClass="z-[146]" onClose={() => controller.setIsAdvancedOpen(false)}>
                    <div
                        className="m-4 flex max-h-[92vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-sparkle-card shadow-2xl"
                        onClick={(event) => event.stopPropagation()}
                    >
                        <div className="border-b border-white/10 bg-white/[0.02] px-5 py-4">
                            <div className="flex items-start justify-between gap-4">
                                <div>
                                    <p className="text-[11px] uppercase tracking-[0.2em] text-white/35">Advanced PR Settings</p>
                                    <h3 className="mt-1 text-base font-semibold text-white">Project draft details</h3>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => controller.setIsAdvancedOpen(false)}
                                    className="rounded-lg border border-white/10 bg-white/[0.03] p-2 text-white/65 transition-all hover:border-white/20 hover:bg-white/[0.05] hover:text-white"
                                    aria-label="Close advanced settings"
                                >
                                    <X size={16} />
                                </button>
                            </div>
                        </div>
                        <div className="flex-1 overflow-y-auto px-5 py-4">
                            <div className="space-y-4">
                                <Field label="Guide source">
                                    <Select
                                        value={controller.guideSource}
                                        onChange={(value) => controller.setGuideSource(value as typeof controller.guideSource)}
                                        options={GUIDE_SOURCE_OPTIONS.map((option) => ({ value: option.value, label: option.label }))}
                                    />
                                </Field>
                                {controller.guideSource === 'project' && (
                                    <>
                                        <Field label="Project guide mode">
                                            <Select
                                                value={controller.guideMode}
                                                onChange={(value) => controller.setGuideMode(value as typeof controller.guideMode)}
                                                options={[
                                                    { value: 'text', label: 'Custom note' },
                                                    { value: 'file', label: 'Markdown file' }
                                                ]}
                                            />
                                        </Field>
                                        {controller.guideMode === 'text' ? (
                                            <Field label="Project guide note">
                                                <Textarea
                                                    value={controller.guideText}
                                                    onChange={controller.setGuideText}
                                                    rows={6}
                                                    placeholder="Describe the PR structure this project expects."
                                                />
                                            </Field>
                                        ) : (
                                            <div className="space-y-2 rounded-xl border border-white/10 bg-black/20 p-3">
                                                <p className="text-sm text-white/80">
                                                    {controller.guideFilePath || 'No guide file selected'}
                                                </p>
                                                <div className="flex items-center gap-2">
                                                    <button
                                                        type="button"
                                                        onClick={() => { void controller.handlePickGuideFile() }}
                                                        className="rounded-lg border border-white/10 px-3 py-2 text-sm text-white/70 transition-all hover:border-white/20 hover:bg-white/[0.04] hover:text-white"
                                                    >
                                                        Choose .md
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => controller.setGuideFilePath('')}
                                                        className="rounded-lg border border-white/10 px-3 py-2 text-sm text-white/70 transition-all hover:border-white/20 hover:bg-white/[0.04] hover:text-white"
                                                    >
                                                        Clear
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </>
                                )}
                                {controller.guideSource !== 'project' && (
                                    <InlineHint>
                                        {controller.guideSource === 'global'
                                            ? 'Using the global Git settings PR guide.'
                                            : controller.guideSource === 'repo-template'
                                                ? 'DevScope will use the repo PR template if one exists.'
                                                : 'This project will use the built-in draft structure.'}
                                    </InlineHint>
                                )}
                            </div>
                        </div>
                        <div className="flex justify-end border-t border-white/10 bg-white/[0.02] px-5 py-4">
                            <button
                                type="button"
                                onClick={() => controller.setIsAdvancedOpen(false)}
                                className="rounded-lg border border-white/10 px-3 py-2 text-sm text-white/70 transition-all hover:border-white/20 hover:bg-white/[0.04] hover:text-white"
                            >
                                Done
                            </button>
                        </div>
                    </div>
                </TopLevelOverlay>
            )}

            {isWhatHappensOpen && (
                <TopLevelOverlay zIndexClass="z-[146]" onClose={() => setIsWhatHappensOpen(false)}>
                    <div
                        className="m-4 flex max-h-[92vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-sparkle-card shadow-2xl"
                        onClick={(event) => event.stopPropagation()}
                    >
                        <div className="border-b border-white/10 bg-white/[0.02] px-5 py-4">
                            <div className="flex items-start justify-between gap-4">
                                <div>
                                    <p className="text-[11px] uppercase tracking-[0.2em] text-white/35">What Happens</p>
                                    <p className="mt-2 text-sm text-white/58">
                                        DevScope drafts the PR and opens the GitHub page. It does not push or fork from here.
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setIsWhatHappensOpen(false)}
                                    className="rounded-lg border border-white/10 bg-white/[0.03] p-2 text-white/65 transition-all hover:border-white/20 hover:bg-white/[0.05] hover:text-white"
                                    aria-label="Close what happens modal"
                                >
                                    <X size={16} />
                                </button>
                            </div>
                        </div>
                        <div className="flex-1 overflow-y-auto px-5 py-4">
                            <div className="grid gap-2">
                                {whatHappensLines.map((line) => (
                                    <div key={line} className="rounded-lg border border-white/5 bg-black/20 px-3 py-2 text-sm text-white/72">
                                        {line}
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className="flex justify-end border-t border-white/10 bg-white/[0.02] px-5 py-4">
                            <button
                                type="button"
                                onClick={() => setIsWhatHappensOpen(false)}
                                className="rounded-lg border border-white/10 px-3 py-2 text-sm text-white/70 transition-all hover:border-white/20 hover:bg-white/[0.04] hover:text-white"
                            >
                                Done
                            </button>
                        </div>
                    </div>
                </TopLevelOverlay>
            )}

            {controller.isDraftEditorOpen && (
                <TopLevelOverlay zIndexClass="z-[147]" onClose={() => controller.setIsDraftEditorOpen(false)}>
                    <div
                        className="m-4 flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-sparkle-card shadow-2xl"
                        onClick={(event) => event.stopPropagation()}
                    >
                        <div className="border-b border-white/10 bg-white/[0.02] px-5 py-4">
                            <div className="flex items-start justify-between gap-4">
                                <div>
                                    <p className="text-[11px] uppercase tracking-[0.2em] text-white/35">Draft Editor</p>
                                    <p className="mt-2 text-sm text-white/58">
                                        Leave both fields blank to auto-generate when you create the PR.
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => controller.setIsDraftEditorOpen(false)}
                                    className="rounded-lg border border-white/10 bg-white/[0.03] p-2 text-white/65 transition-all hover:border-white/20 hover:bg-white/[0.05] hover:text-white"
                                    aria-label="Close draft editor"
                                >
                                    <X size={16} />
                                </button>
                            </div>
                        </div>
                        <div className="flex-1 overflow-y-auto px-5 py-4">
                            <div className="space-y-4">
                                <Field label="PR title">
                                    <Input
                                        value={controller.draftTitle}
                                        onChange={controller.setDraftTitle}
                                        placeholder="Leave blank to auto-generate"
                                    />
                                </Field>
                                <Field label="PR body">
                                    <Textarea
                                        value={controller.draftBody}
                                        onChange={controller.setDraftBody}
                                        rows={12}
                                        placeholder="Leave blank to auto-generate"
                                    />
                                </Field>
                                {controller.statusMessage && (
                                    <StatusBanner tone={controller.statusMessage.tone}>
                                        {controller.statusMessage.text}
                                    </StatusBanner>
                                )}
                            </div>
                        </div>
                        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 bg-white/[0.02] px-5 py-4">
                            <button
                                type="button"
                                onClick={() => {
                                    controller.setDraftTitle('')
                                    controller.setDraftBody('')
                                }}
                                className="rounded-lg border border-white/10 px-3 py-2 text-sm text-white/70 transition-all hover:border-white/20 hover:bg-white/[0.04] hover:text-white"
                            >
                                Clear
                            </button>
                            <div className="flex items-center gap-3">
                                <button
                                    type="button"
                                    onClick={() => { void controller.handleGenerateDraft() }}
                                    disabled={controller.isGenerating || controller.isExecuting || Boolean(controller.executionPlan.missingReason)}
                                    className="inline-flex items-center gap-2 rounded-lg border border-[var(--accent-primary)]/25 bg-[var(--accent-primary)]/12 px-3.5 py-2 text-sm font-medium text-white transition-all hover:bg-[var(--accent-primary)]/18 disabled:cursor-not-allowed disabled:opacity-45"
                                >
                                    {controller.isGenerating ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                                    Generate
                                </button>
                                <button
                                    type="button"
                                    onClick={() => { void controller.handleCopyDraft() }}
                                    disabled={!controller.draftTitle.trim() || !controller.draftBody.trim()}
                                    className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3.5 py-2 text-sm text-white/72 transition-all hover:border-white/20 hover:bg-white/[0.05] hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                                >
                                    <Copy size={14} />
                                    Copy
                                </button>
                                <button
                                    type="button"
                                    onClick={() => controller.setIsDraftEditorOpen(false)}
                                    className="rounded-lg border border-white/10 px-3 py-2 text-sm text-white/70 transition-all hover:border-white/20 hover:bg-white/[0.04] hover:text-white"
                                >
                                    Done
                                </button>
                            </div>
                        </div>
                    </div>
                </TopLevelOverlay>
            )}
        </>
    )
}
