import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowUpRight, ChevronDown, RefreshCw, Sparkles } from 'lucide-react'
import { resolvePreferredGitTextProvider } from '@/lib/gitAi'
import { getProjectPullRequestConfig } from '@/lib/pullRequestWorkflow'
import { FileDiffDetailModal } from './FileDiffDetailModal'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { Checkbox, Input } from '@/components/ui/FormControls'
import { WorkingChangesSection } from './WorkingChangesSection'
import type { DiffMode, WorkingChangeItem } from './workingChangesTypes'
import { getDiffCounts, getDiffKey } from './workingChangesUtils'

function slugifyBranchSegment(value: string) {
    return String(value || '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 40)
}

function buildBranchSeed(commitMessage: string) {
    const fromCommit = slugifyBranchSegment(commitMessage)
    if (fromCommit) return fromCommit

    const now = new Date()
    const yyyy = now.getFullYear()
    const mm = String(now.getMonth() + 1).padStart(2, '0')
    const dd = String(now.getDate()).padStart(2, '0')
    const hh = String(now.getHours()).padStart(2, '0')
    const min = String(now.getMinutes()).padStart(2, '0')
    return `update-${yyyy}${mm}${dd}-${hh}${min}`
}

function buildProposedBranchName(commitMessage: string, branchNames: string[]) {
    const existing = new Set(branchNames.map((name) => String(name || '').trim().toLowerCase()).filter(Boolean))
    const seed = buildBranchSeed(commitMessage)
    const base = `feature/${seed}`
    if (!existing.has(base.toLowerCase())) return base

    for (let index = 2; index < 100; index += 1) {
        const next = `${base}-${index}`
        if (!existing.has(next.toLowerCase())) return next
    }

    return `${base}-${Date.now()}`
}

export function WorkingChangesView({
    stagedFiles,
    unstagedFiles,
    projectPath,
    commitMessage,
    setCommitMessage,
    handleGenerateCommitMessage,
    isGeneratingCommitMessage,
    isCommitting,
    isStackedActionRunning,
    hasGitHubRemote,
    settings,
    updateSettings,
    currentBranch,
    branches,
    showToast,
    handleCommit,
    handleCommitPushAndCreatePullRequest,
    handleDangerouslyStageCommitPushAndCreatePullRequest,
    handleStageFile,
    handleUnstageFile,
    handleStageAll,
    handleUnstageAll,
    handleDiscardUnstagedFile,
    handleDiscardUnstagedAll,
    ensureStatsForPaths
}: {
    stagedFiles: WorkingChangeItem[]
    unstagedFiles: WorkingChangeItem[]
    projectPath: string
    commitMessage: string
    setCommitMessage: (value: string) => void
    handleGenerateCommitMessage: () => Promise<void>
    isGeneratingCommitMessage: boolean
    isCommitting: boolean
    isStackedActionRunning: boolean
    hasGitHubRemote: boolean
    settings: any
    updateSettings: (partial: any) => void
    currentBranch: string
    branches: Array<{ name: string }>
    showToast: (message: string, actionLabel?: string, actionTo?: string, tone?: 'success' | 'error' | 'info') => void
    handleCommit: () => Promise<void>
    handleCommitPushAndCreatePullRequest: () => Promise<void>
    handleDangerouslyStageCommitPushAndCreatePullRequest: () => Promise<void>
    handleStageFile: (path: string) => Promise<void>
    handleUnstageFile: (path: string) => Promise<void>
    handleStageAll: () => Promise<void>
    handleUnstageAll: () => Promise<void>
    handleDiscardUnstagedFile: (path: string) => Promise<void>
    handleDiscardUnstagedAll: () => Promise<void>
    ensureStatsForPaths?: (paths: string[]) => void
}) {
    const [fileDiffs, setFileDiffs] = useState<Map<string, string>>(new Map())
    const [loadingDiffKeys, setLoadingDiffKeys] = useState<Set<string>>(new Set())
    const [copiedPath, setCopiedPath] = useState<string | null>(null)
    const [pendingActionPath, setPendingActionPath] = useState<string | null>(null)
    const [pendingRevertPath, setPendingRevertPath] = useState<string | null>(null)
    const [selectedDiffFile, setSelectedDiffFile] = useState<WorkingChangeItem | null>(null)
    const [selectedDiffMode, setSelectedDiffMode] = useState<DiffMode>('staged')
    const [selectedDiffContent, setSelectedDiffContent] = useState('')
    const [isDiffModalLoading, setIsDiffModalLoading] = useState(false)
    const [revertTarget, setRevertTarget] = useState<{ file?: WorkingChangeItem; scope: 'file' | 'all' } | null>(null)
    const [showDangerMenu, setShowDangerMenu] = useState(false)
    const [stackedTaskStatusText, setStackedTaskStatusText] = useState('')
    const [showBranchGuardModal, setShowBranchGuardModal] = useState(false)
    const [branchGuardMode, setBranchGuardMode] = useState<'safe' | 'danger'>('safe')
    const [proposedBranchName, setProposedBranchName] = useState('')
    const [autoCreateNextTime, setAutoCreateNextTime] = useState(false)
    const [branchGuardError, setBranchGuardError] = useState('')
    const [isCreatingBranchForStackedFlow, setIsCreatingBranchForStackedFlow] = useState(false)
    const dangerMenuRef = useRef<HTMLDivElement | null>(null)
    const iconTheme = settings?.theme === 'light' ? 'light' : 'dark'
    const resolvedProvider = resolvePreferredGitTextProvider(settings)
    const hasProviderForAutoCommit = Boolean(resolvedProvider)
    const hasOnlyStagedChanges = stagedFiles.length > 0 && unstagedFiles.length === 0
    const hasAnyChanges = stagedFiles.length > 0 || unstagedFiles.length > 0

    const runStackedActionByMode = async (mode: 'safe' | 'danger') => {
        if (mode === 'danger') {
            await handleDangerouslyStageCommitPushAndCreatePullRequest()
            return
        }
        await handleCommitPushAndCreatePullRequest()
    }

    const maybePrepareBranchForStackedFlow = async (mode: 'safe' | 'danger') => {
        const prConfig = getProjectPullRequestConfig(settings, projectPath)
        const targetBranch = String(prConfig.targetBranch || '').trim() || 'main'
        const normalizedCurrentBranch = String(currentBranch || '').trim()
        if (!normalizedCurrentBranch || normalizedCurrentBranch === 'HEAD' || normalizedCurrentBranch !== targetBranch) {
            await runStackedActionByMode(mode)
            return
        }

        const proposed = buildProposedBranchName(
            commitMessage,
            Array.isArray(branches) ? branches.map((branch) => branch.name) : []
        )

        if (settings.gitAutoCreateBranchWhenTargetMatches === true) {
            setIsCreatingBranchForStackedFlow(true)
            try {
                const createResult = await window.devscope.createBranch(projectPath, proposed, true)
                if (!createResult?.success) {
                    throw new Error(createResult?.error || 'Failed to create branch.')
                }
                showToast(`Created branch ${proposed}.`, undefined, undefined, 'success')
                await runStackedActionByMode(mode)
            } catch (err: any) {
                showToast(err?.message || 'Failed to create branch.', undefined, undefined, 'error')
            } finally {
                setIsCreatingBranchForStackedFlow(false)
            }
            return
        }

        setBranchGuardMode(mode)
        setProposedBranchName(proposed)
        setAutoCreateNextTime(false)
        setBranchGuardError('')
        setShowBranchGuardModal(true)
    }

    const confirmBranchGuard = async () => {
        const branchName = String(proposedBranchName || '').trim()
        if (!branchName) {
            setBranchGuardError('Branch name required.')
            return
        }

        setIsCreatingBranchForStackedFlow(true)
        setBranchGuardError('')
        try {
            const createResult = await window.devscope.createBranch(projectPath, branchName, true)
            if (!createResult?.success) {
                throw new Error(createResult?.error || 'Failed to create branch.')
            }

            if (autoCreateNextTime) {
                updateSettings({ gitAutoCreateBranchWhenTargetMatches: true })
            }

            setShowBranchGuardModal(false)
            showToast(`Created branch ${branchName}.`, undefined, undefined, 'success')
            await runStackedActionByMode(branchGuardMode)
        } catch (err: any) {
            setBranchGuardError(err?.message || 'Failed to create branch.')
        } finally {
            setIsCreatingBranchForStackedFlow(false)
        }
    }

    const openFileDiffModal = async (file: WorkingChangeItem, mode: DiffMode) => {
        const key = getDiffKey(mode, file.path)
        const cached = fileDiffs.get(key)

        setSelectedDiffFile(file)
        setSelectedDiffMode(mode)
        setSelectedDiffContent(cached || '')
        setIsDiffModalLoading(!cached)

        if (cached) return

        setLoadingDiffKeys((prev) => new Set(prev).add(key))
        try {
            const result = await window.devscope.getWorkingDiff(projectPath, file.path, mode)
            let nextDiff = result.success ? result.diff : ''

            const shouldTryPreviousPath = Boolean(
                file.previousPath
                && (!result.success || !nextDiff || nextDiff === 'No changes')
            )

            if (shouldTryPreviousPath) {
                const fallback = await window.devscope.getWorkingDiff(projectPath, file.previousPath, mode)
                if (fallback.success && fallback.diff && fallback.diff !== 'No changes') {
                    nextDiff = fallback.diff
                }
            }

            const resolvedDiff = nextDiff || 'No diff available'
            setFileDiffs((prev) => new Map(prev).set(key, resolvedDiff))
            setSelectedDiffContent(resolvedDiff)
        } finally {
            setLoadingDiffKeys((prev) => {
                const next = new Set(prev)
                next.delete(key)
                return next
            })
            setIsDiffModalLoading(false)
        }
    }

    const buildRevertMessage = (target: { file?: WorkingChangeItem; scope: 'file' | 'all' }) => {
        if (target.scope === 'all') {
            return 'This will discard all unstaged changes and keep any staged changes. This cannot be undone.'
        }

        const file = target.file
        if (!file) {
            return 'This will discard the selected unstaged changes. This cannot be undone.'
        }
        if (file.staged) {
            return `This will discard unstaged edits in ${file.name} and keep staged changes. This cannot be undone.`
        }
        if (file.gitStatus === 'untracked') {
            return `This will permanently delete the untracked file ${file.name}. This cannot be undone.`
        }
        return `This will revert unstaged edits in ${file.name} to the last committed state. This cannot be undone.`
    }

    const confirmRevert = async () => {
        if (!revertTarget) return

        const scope = revertTarget.scope
        const pendingKey = scope === 'all' ? '__all__' : revertTarget.file?.path
        if (pendingKey) {
            setPendingRevertPath(pendingKey)
        }

        try {
            if (scope === 'all') {
                await handleDiscardUnstagedAll()
                return
            }

            const file = revertTarget.file
            if (!file) return
            await handleDiscardUnstagedFile(file.path)
        } finally {
            if (pendingKey) {
                setPendingRevertPath(null)
            }
            setRevertTarget(null)
        }
    }

    const commitButtonLabel = useMemo(
        () => (isCommitting ? 'Committing...' : `Commit Staged (${stagedFiles.length})`),
        [isCommitting, stagedFiles.length]
    )
    const stackedActionLabel = useMemo(() => {
        if (isCreatingBranchForStackedFlow) return 'Creating branch...'
        if (isStackedActionRunning) return stackedTaskStatusText || 'Starting...'
        return 'Commit, Push & Create PR'
    }, [isCreatingBranchForStackedFlow, isStackedActionRunning, stackedTaskStatusText])
    const isPrimaryStackedActionDisabled = !hasGitHubRemote || !hasOnlyStagedChanges || isCommitting || isStackedActionRunning || isCreatingBranchForStackedFlow || (!commitMessage.trim() && !hasProviderForAutoCommit)
    const isDangerousStackedActionDisabled = !hasGitHubRemote || !hasAnyChanges || isCommitting || isStackedActionRunning || isCreatingBranchForStackedFlow || (!commitMessage.trim() && !hasProviderForAutoCommit)

    useEffect(() => {
        if (!showDangerMenu) return

        const handlePointerDown = (event: MouseEvent) => {
            const target = event.target as Node | null
            if (target && dangerMenuRef.current?.contains(target)) return
            setShowDangerMenu(false)
        }
        const handleEscape = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                setShowDangerMenu(false)
            }
        }

        document.addEventListener('pointerdown', handlePointerDown)
        document.addEventListener('keydown', handleEscape)
        return () => {
            document.removeEventListener('pointerdown', handlePointerDown)
            document.removeEventListener('keydown', handleEscape)
        }
    }, [showDangerMenu])

    useEffect(() => {
        const normalizedProjectPath = String(projectPath || '').trim().toLowerCase()
        if (!normalizedProjectPath) return

        const applyTask = (task: any) => {
            if (!task || task.type !== 'git.stacked') return false
            if (String(task.projectPath || '').trim().toLowerCase() !== normalizedProjectPath) return false
            if (task.status !== 'running') {
                setStackedTaskStatusText('')
                return true
            }

            const latestLog = Array.isArray(task.logs)
                ? [...task.logs]
                    .reverse()
                    .map((entry) => String(entry?.message || '').trim())
                    .find((message) => message && !/^Target branch:|^Auto-stage all:|^Commit message:/i.test(message))
                : ''
            setStackedTaskStatusText(latestLog || 'Starting...')
            return true
        }

        void window.devscope.listActiveTasks?.(projectPath).then((result) => {
            if (!result?.success || !Array.isArray(result.tasks)) return
            const matchingTask = result.tasks.find((task: any) => applyTask(task))
            if (!matchingTask) {
                setStackedTaskStatusText('')
            }
        }).catch(() => undefined)

        const unsubscribe = window.devscope.onTaskEvent?.((event) => {
            if (event.type === 'remove') {
                void window.devscope.listActiveTasks?.(projectPath).then((result) => {
                    if (!result?.success || !Array.isArray(result.tasks)) {
                        setStackedTaskStatusText('')
                        return
                    }
                    const matchingTask = result.tasks.find((task: any) => applyTask(task))
                    if (!matchingTask) {
                        setStackedTaskStatusText('')
                    }
                }).catch(() => {
                    setStackedTaskStatusText('')
                })
                return
            }
            if (event.type !== 'upsert' || !event.task) return
            applyTask(event.task)
        })

        return () => {
            unsubscribe?.()
        }
    }, [isStackedActionRunning, projectPath])

    return (
        <>
            <div className="space-y-5">
                <div className="bg-black/20 rounded-xl border border-white/5 p-4">
                    <h3 className="text-sm font-medium text-white/80 mb-3">Create Commit (Staged only {stagedFiles.length})</h3>
                    <textarea
                        value={commitMessage}
                        onChange={(event) => setCommitMessage(event.target.value)}
                        placeholder="Enter commit message..."
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[var(--accent-primary)]/50 resize-none mb-3"
                        rows={3}
                    />
                    <div className="mb-3 flex items-center justify-between gap-2">
                        <button
                            onClick={() => { void handleGenerateCommitMessage() }}
                            disabled={isGeneratingCommitMessage || isCommitting || isStackedActionRunning || stagedFiles.length === 0}
                            className="px-3 py-2 bg-violet-500/15 hover:bg-violet-500/25 disabled:opacity-50 disabled:cursor-not-allowed border border-violet-500/30 text-violet-300 text-xs font-medium rounded-lg transition-all flex items-center gap-2"
                        >
                            {isGeneratingCommitMessage ? (
                                <>
                                    <RefreshCw size={14} className="animate-spin" />
                                    Generating...
                                </>
                            ) : (
                                <>
                                    <Sparkles size={14} />
                                    Generate with AI
                                </>
                            )}
                        </button>
                        <span className="text-[11px] text-white/40 uppercase tracking-wide">{settings.commitAIProvider}</span>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2">
                        <button
                            onClick={() => { void handleCommit() }}
                            disabled={!commitMessage.trim() || stagedFiles.length === 0 || isCommitting || isStackedActionRunning}
                            className="w-full px-4 py-2.5 bg-[var(--accent-primary)] hover:bg-[var(--accent-primary)]/80 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-all"
                        >
                            {commitButtonLabel}
                        </button>
                        <div ref={dangerMenuRef} className="relative inline-flex w-full items-stretch rounded-lg border border-violet-500/30 bg-violet-500/15 shadow-sm transition-all hover:border-violet-500/40">
                            <button
                                onClick={() => { void maybePrepareBranchForStackedFlow('safe') }}
                                disabled={isPrimaryStackedActionDisabled || isCreatingBranchForStackedFlow}
                                className="inline-flex min-w-0 flex-1 items-center justify-center gap-2 rounded-l-lg px-4 py-2.5 text-sm font-medium text-violet-100 transition-all hover:bg-violet-500/10 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                {isStackedActionRunning || isCreatingBranchForStackedFlow ? <RefreshCw size={14} className="animate-spin" /> : <ArrowUpRight size={14} />}
                                <span className="truncate">{stackedActionLabel}</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => setShowDangerMenu((current) => !current)}
                                disabled={isCommitting || isStackedActionRunning || isCreatingBranchForStackedFlow}
                                aria-expanded={showDangerMenu}
                                title="More actions"
                                className="inline-flex w-11 items-center justify-center rounded-r-lg border-l border-violet-400/20 text-violet-100 transition-all hover:bg-violet-500/10 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                <ChevronDown size={14} className={showDangerMenu ? 'rotate-180 transition-transform' : 'transition-transform'} />
                            </button>
                            {showDangerMenu ? (
                                <div className="absolute inset-x-0 top-[calc(100%+0.4rem)] z-20 rounded-lg border border-red-500/25 bg-sparkle-card p-1 shadow-2xl shadow-black/60 backdrop-blur-xl">
                                    <button
                                        type="button"
                                        disabled={isDangerousStackedActionDisabled}
                                        onClick={() => {
                                            setShowDangerMenu(false)
                                            void maybePrepareBranchForStackedFlow('danger')
                                        }}
                                        className="flex w-full items-center gap-2 rounded-md px-3 py-2.5 text-left text-sm font-medium text-red-100 transition-colors hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-45"
                                    >
                                        <ArrowUpRight size={15} className="shrink-0 text-red-300" />
                                        <span className="truncate">Stage all, commit, push & create PR</span>
                                    </button>
                                </div>
                            ) : null}
                        </div>
                    </div>
                </div>

                <WorkingChangesSection
                    title="Staged Changes"
                    files={stagedFiles}
                    copiedPath={copiedPath}
                    pendingActionPath={pendingActionPath}
                    pendingRevertPath={pendingRevertPath}
                    loadingDiffKeys={loadingDiffKeys}
                    emptyText="No staged files."
                    actionLabel="Unstage"
                    diffMode="staged"
                    onViewDiff={openFileDiffModal}
                    onActionFile={async (path) => handleUnstageFile(path)}
                    onActionAll={async () => {
                        setPendingActionPath('__all__')
                        await handleUnstageAll()
                        setPendingActionPath(null)
                    }}
                    onEnsureStats={ensureStatsForPaths}
                    setCopiedPath={setCopiedPath}
                    onSetPendingActionPath={setPendingActionPath}
                    iconTheme={iconTheme}
                />

                <WorkingChangesSection
                    title="Unstaged Changes"
                    files={unstagedFiles}
                    copiedPath={copiedPath}
                    pendingActionPath={pendingActionPath}
                    pendingRevertPath={pendingRevertPath}
                    loadingDiffKeys={loadingDiffKeys}
                    emptyText="No unstaged files."
                    actionLabel="Stage"
                    secondaryActionAllLabel="Revert All"
                    diffMode="unstaged"
                    onViewDiff={openFileDiffModal}
                    onActionFile={async (path) => handleStageFile(path)}
                    onRevertFile={(file) => setRevertTarget({ scope: 'file', file })}
                    onActionAll={async () => {
                        setPendingActionPath('__all__')
                        await handleStageAll()
                        setPendingActionPath(null)
                    }}
                    onSecondaryActionAll={async () => {
                        setRevertTarget({ scope: 'all' })
                    }}
                    onEnsureStats={ensureStatsForPaths}
                    setCopiedPath={setCopiedPath}
                    onSetPendingActionPath={setPendingActionPath}
                    iconTheme={iconTheme}
                />
            </div>

            {showBranchGuardModal ? (
                <div
                    className="fixed inset-0 z-[140] flex items-center justify-center bg-black/60 backdrop-blur-md animate-fadeIn"
                    onClick={() => {
                        if (isCreatingBranchForStackedFlow) return
                        setShowBranchGuardModal(false)
                    }}
                >
                    <div
                        className="m-4 w-full max-w-lg rounded-2xl border border-white/10 bg-sparkle-card p-5 shadow-2xl"
                        onClick={(event) => event.stopPropagation()}
                    >
                        <div className="flex items-start gap-3">
                            <div className="rounded-xl border border-amber-500/25 bg-amber-500/12 px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-amber-200">
                                Same branch
                            </div>
                        </div>
                        <h3 className="mt-4 text-lg font-semibold text-white">Create a branch first?</h3>
                        <p className="mt-2 text-sm text-white/62">
                            Current branch and target branch are both <span className="font-medium text-white">{currentBranch}</span>.
                        </p>
                        <div className="mt-4 space-y-3">
                            <div>
                                <div className="mb-2 text-xs uppercase tracking-wide text-white/42">Proposed branch</div>
                                <Input
                                    value={proposedBranchName}
                                    onChange={(value) => {
                                        setProposedBranchName(value)
                                        if (branchGuardError) setBranchGuardError('')
                                    }}
                                    placeholder="feature/my-change"
                                    disabled={isCreatingBranchForStackedFlow}
                                />
                            </div>
                            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                                <Checkbox
                                    checked={autoCreateNextTime}
                                    onChange={setAutoCreateNextTime}
                                    label="Don't show again"
                                    description="Next time DevScope will create a branch automatically."
                                    size="sm"
                                    disabled={isCreatingBranchForStackedFlow}
                                />
                            </div>
                            {branchGuardError ? (
                                <div className="rounded-lg border border-red-500/25 bg-red-500/10 px-3 py-2 text-sm text-red-200">
                                    {branchGuardError}
                                </div>
                            ) : null}
                        </div>
                        <div className="mt-5 flex items-center justify-end gap-2">
                            <button
                                type="button"
                                onClick={() => setShowBranchGuardModal(false)}
                                disabled={isCreatingBranchForStackedFlow}
                                className="rounded-lg border border-white/10 px-3 py-2 text-sm text-white/70 transition-all hover:border-white/20 hover:bg-white/[0.04] hover:text-white disabled:opacity-50"
                            >
                                Deny
                            </button>
                            <button
                                type="button"
                                onClick={() => { void confirmBranchGuard() }}
                                disabled={isCreatingBranchForStackedFlow}
                                className="inline-flex items-center gap-2 rounded-lg border border-violet-500/30 bg-violet-500/15 px-3.5 py-2 text-sm font-medium text-violet-100 transition-all hover:bg-violet-500/22 disabled:opacity-50"
                            >
                                {isCreatingBranchForStackedFlow ? <RefreshCw size={14} className="animate-spin" /> : null}
                                Accept
                            </button>
                        </div>
                    </div>
                </div>
            ) : null}
            <FileDiffDetailModal
                isOpen={Boolean(selectedDiffFile)}
                filePath={selectedDiffFile?.path || ''}
                diff={selectedDiffContent}
                loading={isDiffModalLoading}
                additions={selectedDiffFile ? getDiffCounts(selectedDiffFile, selectedDiffMode).additions : 0}
                deletions={selectedDiffFile ? getDiffCounts(selectedDiffFile, selectedDiffMode).deletions : 0}
                status={selectedDiffFile?.gitStatus}
                subtitle={selectedDiffFile ? `${selectedDiffMode === 'staged' ? 'Staged' : 'Unstaged'} change` : undefined}
                onClose={async () => {
                    setSelectedDiffFile(null)
                    setSelectedDiffContent('')
                    setIsDiffModalLoading(false)
                }}
            />
            <ConfirmModal
                isOpen={Boolean(revertTarget)}
                title="Revert Unstaged Changes"
                message={revertTarget ? buildRevertMessage(revertTarget) : ''}
                confirmLabel="Revert"
                cancelLabel="Cancel"
                onConfirm={() => { void confirmRevert() }}
                onCancel={() => setRevertTarget(null)}
                variant="danger"
            />
        </>
    )
}
