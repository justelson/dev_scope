import { ExternalLink, Save, Undo2, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { GitDiffSummary } from './gitDiff'
import type { PreviewFile } from './types'

type PreviewHeaderStatusActionsProps = {
    file: PreviewFile
    gitDiffSummary?: GitDiffSummary | null
    totalFileLines: number
    isMediaFile: boolean
    isEditMode: boolean
    isDirty: boolean
    isSaving: boolean
    showGitSummary: boolean
    showUnsavedDiffSummary: boolean
    showStandaloneUnsavedChip: boolean
    showDetailedFileMeta: boolean
    statusTone: string
    statusLabel: string
    pythonStatusTone: string
    pythonStatusLabel: string
    canRunPython: boolean
    liveDiffPreview?: { additions: number; deletions: number } | null
    htmlViewMode: 'rendered' | 'code'
    viewportLabel?: string
    isHtml: boolean
    isCsv: boolean
    csvDistinctColorsEnabled: boolean
    onCsvDistinctColorsEnabledChange: (enabled: boolean) => void
    onOpenInBrowser: () => void
    onRevert: () => void
    onSave: () => void
    onClose: () => void
    controlGroupClass: string
    iconButtonBaseClass: string
}

export function PreviewHeaderStatusActions({
    file,
    gitDiffSummary,
    totalFileLines,
    isMediaFile,
    isEditMode,
    isDirty,
    isSaving,
    showGitSummary,
    showUnsavedDiffSummary,
    showStandaloneUnsavedChip,
    showDetailedFileMeta,
    statusTone,
    statusLabel,
    pythonStatusTone,
    pythonStatusLabel,
    canRunPython,
    liveDiffPreview,
    htmlViewMode,
    viewportLabel,
    isHtml,
    isCsv,
    csvDistinctColorsEnabled,
    onCsvDistinctColorsEnabledChange,
    onOpenInBrowser,
    onRevert,
    onSave,
    onClose,
    controlGroupClass,
    iconButtonBaseClass
}: PreviewHeaderStatusActionsProps) {
    return (
        <div className="flex min-w-0 flex-wrap items-center gap-2 justify-end">
            {!isMediaFile && isEditMode && (
                <div className={controlGroupClass}>
                    <button
                        onClick={onRevert}
                        disabled={!isDirty || isSaving}
                        className={cn(
                            iconButtonBaseClass,
                            isDirty && !isSaving
                                ? 'border-transparent text-white/80 hover:bg-white/10'
                                : 'cursor-not-allowed border-transparent text-white/35'
                        )}
                        title="Revert local changes"
                        aria-label="Revert local changes"
                    >
                        <Undo2 size={13} />
                    </button>
                    <button
                        onClick={onSave}
                        disabled={!isDirty || isSaving}
                        className={cn(
                            iconButtonBaseClass,
                            isDirty && !isSaving
                                ? 'border-emerald-400/40 bg-emerald-500/15 text-emerald-200 hover:bg-emerald-500/25'
                                : isSaving
                                    ? 'border-emerald-400/30 bg-emerald-500/10 text-emerald-200'
                                    : 'cursor-not-allowed border-transparent text-white/35'
                        )}
                        title={isSaving ? 'Saving changes...' : 'Save changes (Ctrl/Cmd+S)'}
                        aria-label={isSaving ? 'Saving changes' : 'Save changes'}
                        aria-busy={isSaving}
                    >
                        <Save size={13} className={isSaving ? 'animate-pulse' : ''} />
                    </button>
                </div>
            )}

            <div className="flex min-w-0 flex-wrap items-center gap-1.5 justify-end">
                {!isMediaFile && canRunPython && (
                    <span className={cn('rounded px-2 py-1 text-[10px] font-semibold uppercase', pythonStatusTone)}>
                        {pythonStatusLabel}
                    </span>
                )}
                {!isMediaFile && showGitSummary && (
                    <div className="flex items-center gap-1.5">
                        <span className={cn('rounded px-2 py-1 text-[10px] font-semibold uppercase', statusTone)}>
                            {statusLabel}
                        </span>
                        <span className="rounded bg-emerald-500/10 px-1.5 py-1 text-[10px] text-emerald-300">+{gitDiffSummary?.additions ?? 0}</span>
                        <span className="rounded bg-red-500/10 px-1.5 py-1 text-[10px] text-red-300">-{gitDiffSummary?.deletions ?? 0}</span>
                        <span className="rounded bg-white/5 px-1.5 py-1 text-[10px] text-white/50">{totalFileLines} lines</span>
                    </div>
                )}
                {!isMediaFile && showUnsavedDiffSummary && liveDiffPreview && (
                    <div className="flex items-center gap-1.5">
                        <span className="rounded bg-sky-500/20 px-2 py-1 text-[10px] font-semibold uppercase text-sky-300">
                            Unsaved
                        </span>
                        <span className="rounded bg-emerald-500/10 px-1.5 py-1 text-[10px] text-emerald-300">+{liveDiffPreview.additions}</span>
                        <span className="rounded bg-red-500/10 px-1.5 py-1 text-[10px] text-red-300">-{liveDiffPreview.deletions}</span>
                    </div>
                )}
                {!isMediaFile && (
                    <span className="rounded bg-white/5 px-2 py-1 text-[10px] uppercase text-white/30">
                        {file.type}
                        {isEditMode ? ' - edit' : ''}
                        {isHtml && showDetailedFileMeta && ` - ${htmlViewMode}`}
                        {viewportLabel ? ` - ${viewportLabel}` : ''}
                    </span>
                )}
                {!isMediaFile && showStandaloneUnsavedChip && (
                    <span className="rounded bg-amber-500/15 px-1.5 py-1 text-[10px] text-amber-200">Unsaved</span>
                )}
                {isHtml && !isEditMode && (
                    <button
                        onClick={onOpenInBrowser}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-xs text-white/60 transition-all hover:bg-white/10 hover:text-white"
                        title="Open in Browser"
                        aria-label="Open in browser"
                    >
                        <ExternalLink size={14} />
                        <span className="sr-only">Open</span>
                    </button>
                )}
                {isCsv && (
                    <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-2 py-1.5">
                        <span className="text-xs text-white/60">Column Colors</span>
                        <button
                            type="button"
                            onClick={() => onCsvDistinctColorsEnabledChange(!csvDistinctColorsEnabled)}
                            className="group"
                            title={csvDistinctColorsEnabled ? 'Disable distinct column colors' : 'Enable distinct column colors'}
                            aria-pressed={csvDistinctColorsEnabled}
                        >
                            <span className={cn('inline-flex h-5 w-9 items-center rounded-full transition-colors', csvDistinctColorsEnabled ? 'bg-emerald-400/80' : 'bg-white/20')}>
                                <span className={cn('h-4 w-4 rounded-full bg-white shadow transition-transform', csvDistinctColorsEnabled ? 'translate-x-4' : 'translate-x-0.5')} />
                            </span>
                        </button>
                    </div>
                )}
            </div>

            <button
                onClick={onClose}
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-white/40 transition-all hover:bg-white/10 hover:text-white"
                title="Close (Esc)"
            >
                <X size={18} />
            </button>
        </div>
    )
}
