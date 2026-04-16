import { ExternalLink, Save, Undo2, X } from 'lucide-react'
import { cn } from '@/lib/utils'

type PreviewHeaderStatusActionsProps = {
    showCloseButton?: boolean
    isIdeChrome?: boolean
    isMediaFile: boolean
    isEditMode: boolean
    isDirty: boolean
    isSaving: boolean
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
    showCloseButton = true,
    isIdeChrome = false,
    isMediaFile,
    isEditMode,
    isDirty,
    isSaving,
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
            {!isIdeChrome && !isMediaFile && isEditMode && (
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
                {isHtml && !isEditMode && (
                    <button
                        onClick={onOpenInBrowser}
                        className={cn(
                            isIdeChrome
                                ? 'inline-flex h-7 w-7 items-center justify-center rounded-md text-xs text-white/55 transition-colors hover:bg-white/[0.06] hover:text-white'
                                : 'inline-flex h-8 w-8 items-center justify-center rounded-lg text-xs text-white/60 transition-all hover:bg-white/10 hover:text-white'
                        )}
                        title="Open in Browser"
                        aria-label="Open in browser"
                    >
                        <ExternalLink size={14} />
                        <span className="sr-only">Open</span>
                    </button>
                )}
                {isCsv && (
                    <div className={cn(
                        'flex items-center',
                        isIdeChrome
                            ? 'gap-1.5 rounded-md border border-white/[0.07] bg-white/[0.03] px-1.5 py-1'
                            : 'gap-2 rounded-lg border border-white/10 bg-white/5 px-2 py-1.5'
                    )}>
                        <span className={cn(isIdeChrome ? 'text-[11px] text-white/45' : 'text-xs text-white/60')}>
                            {isIdeChrome ? 'Columns' : 'Column Colors'}
                        </span>
                        <button
                            type="button"
                            onClick={() => onCsvDistinctColorsEnabledChange(!csvDistinctColorsEnabled)}
                            className="group"
                            title={csvDistinctColorsEnabled ? 'Disable distinct column colors' : 'Enable distinct column colors'}
                            aria-pressed={csvDistinctColorsEnabled}
                        >
                            <span className={cn(
                                'inline-flex items-center rounded-full transition-colors',
                                isIdeChrome ? 'h-4 w-7' : 'h-5 w-9',
                                csvDistinctColorsEnabled ? 'bg-emerald-400/80' : 'bg-white/20'
                            )}>
                                <span className={cn(
                                    'rounded-full bg-white shadow transition-transform',
                                    isIdeChrome ? 'h-3 w-3' : 'h-4 w-4',
                                    csvDistinctColorsEnabled
                                        ? (isIdeChrome ? 'translate-x-3.5' : 'translate-x-4')
                                        : 'translate-x-0.5'
                                )} />
                            </span>
                        </button>
                    </div>
                )}
            </div>

            {showCloseButton && (
                <button
                    onClick={onClose}
                    className={cn(
                        'shrink-0 items-center justify-center transition-colors',
                        isIdeChrome
                            ? 'inline-flex h-7 w-7 rounded-md border border-transparent text-white/45 hover:bg-white/[0.06] hover:text-white'
                            : 'inline-flex h-10 w-10 rounded-xl border border-white/10 bg-white/[0.04] text-white/40 transition-all hover:bg-white/10 hover:text-white'
                    )}
                    title="Close (Esc)"
                >
                    <X size={isIdeChrome ? 15 : 18} />
                </button>
            )}
        </div>
    )
}
