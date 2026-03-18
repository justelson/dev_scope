import { useMemo, useState } from 'react'
import { RefreshCw, Sparkles } from 'lucide-react'
import { FileDiffDetailModal } from './FileDiffDetailModal'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { WorkingChangesSection } from './WorkingChangesSection'
import type { DiffMode, WorkingChangeItem } from './workingChangesTypes'
import { getDiffCounts, getDiffKey } from './workingChangesUtils'

export function WorkingChangesView({
    stagedFiles,
    unstagedFiles,
    projectPath,
    commitMessage,
    setCommitMessage,
    handleGenerateCommitMessage,
    isGeneratingCommitMessage,
    isCommitting,
    settings,
    handleCommit,
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
    settings: any
    handleCommit: () => Promise<void>
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
    const iconTheme = settings?.theme === 'light' ? 'light' : 'dark'

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
                            disabled={isGeneratingCommitMessage || isCommitting || stagedFiles.length === 0}
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
                    <button
                        onClick={() => { void handleCommit() }}
                        disabled={!commitMessage.trim() || stagedFiles.length === 0 || isCommitting}
                        className="w-full px-4 py-2.5 bg-[var(--accent-primary)] hover:bg-[var(--accent-primary)]/80 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-all"
                    >
                        {commitButtonLabel}
                    </button>
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
