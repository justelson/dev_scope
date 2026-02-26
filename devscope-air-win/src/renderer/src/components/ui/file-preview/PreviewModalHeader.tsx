import { Check, Code, Copy, Edit3, Expand, ExternalLink, Eye, FileJson, FileText, FileType, Film, Image as ImageIcon, Minimize, PanelLeft, PanelRight, Play, Save, Square, Table, Trash2, Undo2, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import type { GitDiffSummary } from './gitDiff'
import type { PreviewFile } from './types'
import { VIEWPORT_PRESETS, type ViewportPreset } from './viewport'

interface PreviewModalHeaderProps {
    file: PreviewFile
    gitDiffSummary?: GitDiffSummary | null
    totalFileLines?: number
    mode: 'preview' | 'edit'
    isEditable: boolean
    isDirty: boolean
    isSaving: boolean
    isExpanded: boolean
    leftPanelOpen: boolean
    rightPanelOpen: boolean
    loadingEditableContent?: boolean
    onModeChange: (mode: 'preview' | 'edit') => void
    onSave: () => void
    onRevert: () => void
    onToggleExpanded: () => void
    onToggleLeftPanel: () => void
    onToggleRightPanel: () => void
    viewport: ViewportPreset
    onViewportChange: (viewport: ViewportPreset) => void
    htmlViewMode: 'rendered' | 'code'
    onHtmlViewModeChange: (mode: 'rendered' | 'code') => void
    csvDistinctColorsEnabled: boolean
    onCsvDistinctColorsEnabledChange: (enabled: boolean) => void
    onOpenInBrowser: () => void
    onClose: () => void
    liveDiffPreview?: {
        additions: number
        deletions: number
    } | null
    canRunPython?: boolean
    pythonRunState?: 'idle' | 'running' | 'success' | 'failed' | 'stopped'
    pythonHasOutput?: boolean
    onRunPython?: () => void
    onStopPython?: () => void
    onClearPythonOutput?: () => void
}

function PreviewFileIcon({ type }: { type: PreviewFile['type'] }) {
    if (type === 'md') return <FileText size={18} className="text-blue-400 shrink-0" />
    if (type === 'html') return <Code size={18} className="text-orange-400 shrink-0" />
    if (type === 'json') return <FileJson size={18} className="text-yellow-300 shrink-0" />
    if (type === 'csv') return <Table size={18} className="text-emerald-300 shrink-0" />
    if (type === 'code') return <Code size={18} className="text-cyan-300 shrink-0" />
    if (type === 'image') return <ImageIcon size={18} className="text-purple-400 shrink-0" />
    if (type === 'video') return <Film size={18} className="text-red-400 shrink-0" />
    return <FileType size={18} className="text-gray-400 shrink-0" />
}

export default function PreviewModalHeader({
    file,
    gitDiffSummary,
    totalFileLines = 0,
    mode,
    isEditable,
    isDirty,
    isSaving,
    isExpanded,
    leftPanelOpen,
    rightPanelOpen,
    loadingEditableContent,
    onModeChange,
    onSave,
    onRevert,
    onToggleExpanded,
    onToggleLeftPanel,
    onToggleRightPanel,
    viewport,
    onViewportChange,
    htmlViewMode,
    onHtmlViewModeChange,
    csvDistinctColorsEnabled,
    onCsvDistinctColorsEnabledChange,
    onOpenInBrowser,
    onClose,
    liveDiffPreview,
    canRunPython = false,
    pythonRunState = 'idle',
    pythonHasOutput = false,
    onRunPython,
    onStopPython,
    onClearPythonOutput
}: PreviewModalHeaderProps) {
    const isHtml = file.type === 'html'
    const isCsv = file.type === 'csv'
    const presetConfig = VIEWPORT_PRESETS[viewport]
    const containerRef = useRef<HTMLDivElement | null>(null)
    const [headerWidth, setHeaderWidth] = useState(1280)
    const [copied, setCopied] = useState(false)

    const handleCopyPath = () => {
        navigator.clipboard.writeText(file.path)
        setCopied(true)
        setTimeout(() => setCopied(false), 1500)
    }

    useEffect(() => {
        const node = containerRef.current
        if (!node) return

        const updateWidth = () => {
            setHeaderWidth(node.clientWidth || 1280)
        }

        updateWidth()

        const observer = new ResizeObserver(() => {
            updateWidth()
        })
        observer.observe(node)

        return () => observer.disconnect()
    }, [])

    const isCompactHtmlHeader = isHtml && headerWidth < 1024
    const isVeryCompactHtmlHeader = isHtml && headerWidth < 820
    const isUltraCompactHtmlHeader = isHtml && headerWidth < 680
    const isCompactHeader = headerWidth < 1240

    const statusTone = !gitDiffSummary ? 'bg-white/10 text-white/60'
        : gitDiffSummary.status === 'added'
            ? 'bg-[#73C991]/20 text-[#73C991]'
            : gitDiffSummary.status === 'deleted'
                ? 'bg-[#FF6B6B]/20 text-[#FF6B6B]'
                : gitDiffSummary.status === 'renamed'
                    ? 'bg-blue-500/20 text-blue-300'
                    : gitDiffSummary.status === 'modified'
                        ? 'bg-[#E2C08D]/20 text-[#E2C08D]'
                        : 'bg-white/10 text-white/60'

    const statusLabel = !gitDiffSummary
        ? 'Unknown'
        : gitDiffSummary.status.charAt(0).toUpperCase() + gitDiffSummary.status.slice(1)

    const isEditMode = mode === 'edit'
    const hasUnsavedChanges = isEditMode && isDirty
    const showUnsavedDiffSummary = hasUnsavedChanges && !!liveDiffPreview
    const showGitSummary = !!gitDiffSummary && !showUnsavedDiffSummary
    const showStandaloneUnsavedChip = hasUnsavedChanges && !showUnsavedDiffSummary
    const showDetailedFileMeta = !(showUnsavedDiffSummary || isCompactHeader)
    const isPythonRunning = pythonRunState === 'running'
    const pythonStatusTone = (
        pythonRunState === 'success'
            ? 'bg-emerald-500/20 text-emerald-300'
            : pythonRunState === 'failed'
                ? 'bg-red-500/20 text-red-300'
                : pythonRunState === 'stopped'
                    ? 'bg-amber-500/20 text-amber-300'
                    : pythonRunState === 'running'
                        ? 'bg-sky-500/20 text-sky-300'
                        : 'bg-white/10 text-white/60'
    )
    const pythonStatusLabel = (
        pythonRunState === 'success'
            ? 'Run OK'
            : pythonRunState === 'failed'
                ? 'Run Failed'
                : pythonRunState === 'stopped'
                    ? 'Run Stopped'
                    : pythonRunState === 'running'
                        ? 'Running'
                        : 'Idle'
    )

    return (
        <div
            ref={containerRef}
            className={cn(
                'flex items-center justify-between gap-3 border-b border-white/5 bg-white/[0.02] shrink-0',
                isCompactHeader ? 'flex-wrap px-3 py-2.5' : 'px-5 py-3',
                isUltraCompactHtmlHeader ? 'gap-2' : ''
            )}
        >
            <div className={cn('flex items-center gap-3 min-w-0', isCompactHeader ? 'flex-1 flex-wrap w-full' : '', isUltraCompactHtmlHeader ? 'w-full' : '')}>
                <PreviewFileIcon type={file.type} />
                <div className="min-w-0 flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-white truncate">{file.name}</h3>
                    <button
                        onClick={handleCopyPath}
                        className={cn(
                            "p-1 rounded transition-all shrink-0",
                            copied 
                                ? "text-emerald-400 bg-emerald-400/10" 
                                : "text-white/40 hover:text-white hover:bg-white/10"
                        )}
                        title={copied ? "Copied!" : `Copy path: ${file.path}`}
                    >
                        {copied ? <Check size={14} /> : <Copy size={14} />}
                    </button>
                </div>
                <div className="flex items-center gap-1 bg-white/5 rounded-lg p-1 shrink-0">
                    <button
                        onClick={() => onModeChange('preview')}
                        className={cn(
                            'flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-md transition-all',
                            !isEditMode
                                ? 'bg-white/15 text-white'
                                : 'text-white/50 hover:text-white/80 hover:bg-white/10'
                        )}
                        title="Preview mode"
                    >
                        <Eye size={13} />
                        <span>Preview</span>
                    </button>
                    <button
                        onClick={() => onModeChange('edit')}
                        disabled={!isEditable || !!loadingEditableContent}
                        className={cn(
                            'flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-md transition-all',
                            isEditMode
                                ? 'bg-white/15 text-white'
                                : 'text-white/50 hover:text-white/80 hover:bg-white/10',
                            (!isEditable || !!loadingEditableContent) && 'opacity-50 cursor-not-allowed hover:bg-transparent hover:text-white/50'
                        )}
                        title={isEditable ? 'Edit mode' : 'This file type is preview-only'}
                    >
                        <Edit3 size={13} />
                        <span>Edit</span>
                    </button>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                    {canRunPython && (
                        <>
                            <button
                                type="button"
                                onClick={isPythonRunning ? onStopPython : onRunPython}
                                className={cn(
                                    'inline-flex h-8 w-8 items-center justify-center rounded-lg border transition-colors',
                                    isPythonRunning
                                        ? 'border-amber-400/35 bg-amber-500/15 text-amber-200 hover:bg-amber-500/25'
                                        : 'border-emerald-400/35 bg-emerald-500/15 text-emerald-200 hover:bg-emerald-500/25'
                                )}
                                title={isPythonRunning ? 'Stop Python run' : 'Run Python script'}
                            >
                                {isPythonRunning ? <Square size={13} /> : <Play size={13} />}
                            </button>
                            <button
                                type="button"
                                onClick={onClearPythonOutput}
                                disabled={!pythonHasOutput && !isPythonRunning}
                                className={cn(
                                    'inline-flex h-8 w-8 items-center justify-center rounded-lg border transition-colors',
                                    (pythonHasOutput || isPythonRunning)
                                        ? 'border-white/20 text-white/70 hover:bg-white/10 hover:text-white'
                                        : 'border-white/10 text-white/30 cursor-not-allowed'
                                )}
                                title="Clear run output"
                            >
                                <Trash2 size={13} />
                            </button>
                        </>
                    )}
                    <button
                        onClick={onToggleExpanded}
                        className={cn(
                            'group p-2 rounded-lg border transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]',
                            isExpanded
                                ? 'border-sky-400/30 bg-sky-500/12 text-sky-200'
                                : 'border-transparent text-white/50 hover:text-white hover:bg-white/10'
                        )}
                        title={isExpanded ? 'Collapse workspace' : 'Expand workspace'}
                    >
                        <span className="relative block h-4 w-4">
                            <Expand
                                size={16}
                                className={cn(
                                    'absolute inset-0 transition-all duration-250 ease-out',
                                    isExpanded ? 'scale-75 -rotate-45 opacity-0' : 'scale-100 rotate-0 opacity-100'
                                )}
                            />
                            <Minimize
                                size={16}
                                className={cn(
                                    'absolute inset-0 transition-all duration-250 ease-out',
                                    isExpanded ? 'scale-100 rotate-0 opacity-100' : 'scale-75 rotate-45 opacity-0'
                                )}
                            />
                        </span>
                    </button>
                    {isExpanded && (
                        <>
                            <button
                                onClick={onToggleLeftPanel}
                                className={cn(
                                    'p-2 rounded-lg transition-all',
                                    leftPanelOpen
                                        ? 'text-white bg-white/10'
                                        : 'text-white/50 hover:text-white hover:bg-white/10'
                                )}
                                title={leftPanelOpen ? 'Hide left panel' : 'Show left panel'}
                            >
                                <PanelLeft size={16} />
                            </button>
                            <button
                                onClick={onToggleRightPanel}
                                className={cn(
                                    'p-2 rounded-lg transition-all',
                                    rightPanelOpen
                                        ? 'text-white bg-white/10'
                                        : 'text-white/50 hover:text-white hover:bg-white/10'
                                )}
                                title={rightPanelOpen ? 'Hide right panel' : 'Show right panel'}
                            >
                                <PanelRight size={16} />
                            </button>
                        </>
                    )}
                </div>
            </div>

            {isHtml && !isEditMode && (
                <div
                    className={cn(
                        'flex items-center gap-2',
                        isCompactHtmlHeader ? 'order-3 w-full flex-wrap' : '',
                        isVeryCompactHtmlHeader ? 'justify-start' : isCompactHtmlHeader ? 'justify-between' : ''
                    )}
                >
                    <div className={cn('flex items-center gap-1 bg-white/5 rounded-lg p-1 flex-wrap', isUltraCompactHtmlHeader ? 'w-full justify-between' : '')}>
                        {(Object.entries(VIEWPORT_PRESETS) as [ViewportPreset, typeof presetConfig][]).map(([key, preset]) => {
                            const Icon = preset.icon
                            return (
                                <button
                                    key={key}
                                    onClick={() => onViewportChange(key)}
                                    className={cn(
                                        'flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-md transition-all',
                                        viewport === key
                                            ? 'bg-white/15 text-white'
                                            : 'text-white/40 hover:text-white/70 hover:bg-white/5',
                                        isUltraCompactHtmlHeader ? 'px-2 min-w-[2rem] justify-center' : ''
                                    )}
                                    title={key === 'responsive' ? 'Full Width' : `${preset.width}x${preset.height}`}
                                >
                                    {Icon && <Icon size={14} />}
                                    <span className={cn(isVeryCompactHtmlHeader ? 'hidden lg:inline' : isCompactHtmlHeader ? 'hidden md:inline' : 'hidden sm:inline')}>
                                        {preset.label}
                                    </span>
                                </button>
                            )
                        })}
                    </div>
                    <div className={cn('flex items-center gap-1 bg-white/5 rounded-lg p-1', isUltraCompactHtmlHeader ? 'w-full justify-center' : '')}>
                        <button
                            onClick={() => onHtmlViewModeChange('rendered')}
                            className={cn(
                                'px-2.5 py-1.5 text-xs rounded-md transition-all',
                                htmlViewMode === 'rendered'
                                    ? 'bg-white/15 text-white'
                                    : 'text-white/40 hover:text-white/70 hover:bg-white/5'
                            )}
                        >
                            Preview
                        </button>
                        <button
                            onClick={() => onHtmlViewModeChange('code')}
                            className={cn(
                                'px-2.5 py-1.5 text-xs rounded-md transition-all',
                                htmlViewMode === 'code'
                                    ? 'bg-white/15 text-white'
                                    : 'text-white/40 hover:text-white/70 hover:bg-white/5'
                            )}
                        >
                            Code
                        </button>
                    </div>
                </div>
            )}

            <div className={cn(
                'flex items-center gap-2 min-w-0 flex-wrap justify-end',
                isCompactHeader ? 'w-full ml-auto' : '',
                isUltraCompactHtmlHeader ? 'w-full justify-end' : ''
            )}>
                {isEditMode && (
                    <div className="flex items-center gap-2 shrink-0">
                        <button
                            onClick={onRevert}
                            disabled={!isDirty || isSaving}
                            className={cn(
                                'inline-flex h-8 w-8 items-center justify-center rounded-lg border transition-all',
                                isDirty && !isSaving
                                    ? 'border-white/20 text-white/80 hover:bg-white/10'
                                    : 'border-white/10 text-white/35 cursor-not-allowed'
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
                                'inline-flex h-8 w-8 items-center justify-center rounded-lg border transition-all',
                                isDirty && !isSaving
                                    ? 'border-emerald-400/40 bg-emerald-500/15 text-emerald-200 hover:bg-emerald-500/25'
                                    : isSaving
                                        ? 'border-emerald-400/30 bg-emerald-500/10 text-emerald-200'
                                        : 'border-white/10 text-white/35 cursor-not-allowed'
                            )}
                            title={isSaving ? 'Saving changes...' : 'Save changes (Ctrl/Cmd+S)'}
                            aria-label={isSaving ? 'Saving changes' : 'Save changes'}
                            aria-busy={isSaving}
                        >
                            <Save size={13} className={isSaving ? 'animate-pulse' : ''} />
                        </button>
                    </div>
                )}

                <div className="flex items-center gap-1.5 min-w-0 flex-wrap justify-end">
                    {canRunPython && (
                        <span className={cn('text-[10px] uppercase font-semibold px-2 py-1 rounded', pythonStatusTone)}>
                            {pythonStatusLabel}
                        </span>
                    )}
                    {showGitSummary && (
                        <div className="flex items-center gap-1.5">
                            <span className={cn('text-[10px] uppercase font-semibold px-2 py-1 rounded', statusTone)}>
                                {statusLabel}
                            </span>
                            <span className="text-[10px] px-1.5 py-1 rounded bg-emerald-500/10 text-emerald-300">+{gitDiffSummary?.additions ?? 0}</span>
                            <span className="text-[10px] px-1.5 py-1 rounded bg-red-500/10 text-red-300">-{gitDiffSummary?.deletions ?? 0}</span>
                            <span className="text-[10px] px-1.5 py-1 rounded bg-white/5 text-white/50">{totalFileLines} lines</span>
                        </div>
                    )}
                    {showUnsavedDiffSummary && liveDiffPreview && (
                        <div className="flex items-center gap-1.5">
                            <span className="text-[10px] uppercase font-semibold px-2 py-1 rounded bg-sky-500/20 text-sky-300">
                                Unsaved
                            </span>
                            <span className="text-[10px] px-1.5 py-1 rounded bg-emerald-500/10 text-emerald-300">+{liveDiffPreview.additions}</span>
                            <span className="text-[10px] px-1.5 py-1 rounded bg-red-500/10 text-red-300">-{liveDiffPreview.deletions}</span>
                        </div>
                    )}
                    <span className="text-[10px] text-white/30 uppercase px-2 py-1 bg-white/5 rounded">
                        {file.type}
                        {isEditMode ? ' - edit' : ''}
                        {isHtml && showDetailedFileMeta && ` - ${htmlViewMode}`}
                        {isHtml && showDetailedFileMeta && !isVeryCompactHtmlHeader && htmlViewMode === 'rendered' && viewport !== 'responsive' && ` - ${presetConfig.width}x${presetConfig.height}`}
                    </span>
                    {showStandaloneUnsavedChip && (
                        <span className="text-[10px] px-1.5 py-1 rounded bg-amber-500/15 text-amber-200">Unsaved</span>
                    )}
                    {isHtml && !isEditMode && (
                        <button
                            onClick={onOpenInBrowser}
                            className={cn(
                                'flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-white/60 hover:text-white hover:bg-white/10 rounded-lg transition-all',
                                isCompactHtmlHeader ? 'px-2' : ''
                            )}
                            title="Open in Browser"
                        >
                            <ExternalLink size={14} />
                            {!isCompactHtmlHeader && <span>Open</span>}
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
                                <span
                                    className={cn(
                                        'inline-flex h-5 w-9 items-center rounded-full transition-colors',
                                        csvDistinctColorsEnabled ? 'bg-emerald-400/80' : 'bg-white/20'
                                    )}
                                >
                                    <span
                                        className={cn(
                                            'h-4 w-4 rounded-full bg-white shadow transition-transform',
                                            csvDistinctColorsEnabled ? 'translate-x-4' : 'translate-x-0.5'
                                        )}
                                    />
                                </span>
                            </button>
                        </div>
                    )}
                </div>

                <button
                    onClick={onClose}
                    className="p-2 text-white/40 hover:text-white hover:bg-white/10 rounded-lg transition-all shrink-0"
                    title="Close (Esc)"
                >
                    <X size={18} />
                </button>
            </div>
        </div>
    )
}
