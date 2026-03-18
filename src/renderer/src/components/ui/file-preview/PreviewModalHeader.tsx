import { Check, ChevronDown, Code, Copy, Edit3, Expand, ExternalLink, Eye, Minimize, PanelLeft, PanelRight, Play, Save, Square, Terminal, Trash2, Undo2, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import { VscodeEntryIcon } from '@/components/ui/VscodeEntryIcon'
import { useSettings } from '@/lib/settings'
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
    pythonRunMode?: 'terminal' | 'output'
    onRunPython?: () => void
    onStopPython?: () => void
    onClearPythonOutput?: () => void
    onPythonRunModeChange?: (mode: 'terminal' | 'output') => void
    canUseTerminal?: boolean
    terminalVisible?: boolean
    onToggleTerminal?: () => void
}

function formatPreviewFileName(name: string, maxLength: number): string {
    const raw = String(name || '').trim()
    if (!raw || raw.length <= maxLength) return raw

    const dotIndex = raw.lastIndexOf('.')
    const hasExtension = dotIndex > 0 && dotIndex < raw.length - 1
    const extension = hasExtension ? raw.slice(dotIndex) : ''
    const baseName = hasExtension ? raw.slice(0, dotIndex) : raw
    const budget = Math.max(8, maxLength - extension.length - 3)
    const startLength = Math.max(4, Math.ceil(budget * 0.6))
    const endLength = Math.max(3, budget - startLength)

    if (baseName.length <= startLength + endLength + 3) {
        return raw
    }

    return `${baseName.slice(0, startLength)}...${baseName.slice(-endLength)}${extension}`
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
    pythonRunMode = 'terminal',
    onRunPython,
    onStopPython,
    onClearPythonOutput,
    onPythonRunModeChange,
    canUseTerminal = false,
    terminalVisible = false,
    onToggleTerminal
}: PreviewModalHeaderProps) {
    const { settings } = useSettings()
    const iconTheme = settings.theme === 'light' ? 'light' : 'dark'
    const isHtml = file.type === 'html'
    const isCsv = file.type === 'csv'
    const isMediaFile = file.type === 'image' || file.type === 'video' || file.type === 'audio'
    const presetConfig = VIEWPORT_PRESETS[viewport]
    const containerRef = useRef<HTMLDivElement | null>(null)
    const pythonRunModeMenuRef = useRef<HTMLDivElement | null>(null)
    const [headerWidth, setHeaderWidth] = useState(1280)
    const [copied, setCopied] = useState(false)
    const [pythonRunModeMenuOpen, setPythonRunModeMenuOpen] = useState(false)

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

    useEffect(() => {
        if (!pythonRunModeMenuOpen) return
        const handlePointerDown = (event: MouseEvent) => {
            const target = event.target as Node | null
            if (!pythonRunModeMenuRef.current?.contains(target)) {
                setPythonRunModeMenuOpen(false)
            }
        }
        window.addEventListener('mousedown', handlePointerDown)
        return () => window.removeEventListener('mousedown', handlePointerDown)
    }, [pythonRunModeMenuOpen])

    const isCompactHtmlHeader = isHtml && headerWidth < 1024
    const isVeryCompactHtmlHeader = isHtml && headerWidth < 820
    const isUltraCompactHtmlHeader = isHtml && headerWidth < 680
    const isCompactHeader = headerWidth < 1240
    const visibleFileName = formatPreviewFileName(file.name, headerWidth < 820 ? 28 : headerWidth < 1080 ? 40 : 56)

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
    const controlGroupClass = 'flex items-center gap-1 rounded-xl border border-white/10 bg-white/[0.04] p-1 shrink-0'
    const iconButtonBaseClass = 'inline-flex h-8 w-8 items-center justify-center rounded-lg border transition-all'
    const ghostIconButtonClass = `${iconButtonBaseClass} border-transparent text-white/55 hover:bg-white/10 hover:text-white`
    const activeIconButtonClass = `${iconButtonBaseClass} border-white/15 bg-white/10 text-white`

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
                <VscodeEntryIcon
                    pathValue={file.path || file.name}
                    kind="file"
                    theme={iconTheme}
                    className="size-[18px] shrink-0"
                />
                <div className="min-w-0 flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-white" title={file.name}>
                        {visibleFileName}
                    </h3>
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
                {!isMediaFile && (
                    <div className="flex items-center gap-1 bg-white/5 rounded-lg p-1 shrink-0">
                        <button
                            onClick={() => onModeChange('preview')}
                            className={cn(
                                'inline-flex h-8 w-8 items-center justify-center text-xs rounded-md transition-all',
                                !isEditMode
                                    ? 'bg-white/15 text-white'
                                    : 'text-white/50 hover:text-white/80 hover:bg-white/10'
                            )}
                            title="Preview mode"
                            aria-label="Preview mode"
                        >
                            <Eye size={13} />
                            <span className="sr-only">Preview</span>
                        </button>
                        <button
                            onClick={() => onModeChange('edit')}
                            disabled={!isEditable || !!loadingEditableContent}
                            className={cn(
                                'inline-flex h-8 w-8 items-center justify-center text-xs rounded-md transition-all',
                                isEditMode
                                    ? 'bg-white/15 text-white'
                                    : 'text-white/50 hover:text-white/80 hover:bg-white/10',
                                (!isEditable || !!loadingEditableContent) && 'opacity-50 cursor-not-allowed hover:bg-transparent hover:text-white/50'
                            )}
                            title={isEditable ? 'Edit mode' : 'This file type is preview-only'}
                            aria-label={isEditable ? 'Edit mode' : 'This file type is preview-only'}
                        >
                            <Edit3 size={13} />
                            <span className="sr-only">Edit</span>
                        </button>
                    </div>
                )}
                {!isMediaFile && (canUseTerminal || canRunPython) && (
                    <div className={controlGroupClass}>
                        {canUseTerminal && (
                            <button
                                type="button"
                                onClick={onToggleTerminal}
                                className={cn(
                                    iconButtonBaseClass,
                                    terminalVisible
                                        ? 'border-sky-400/35 bg-sky-500/15 text-sky-200 hover:bg-sky-500/25'
                                        : 'border-transparent text-white/60 hover:bg-white/10 hover:text-white'
                                )}
                                title={terminalVisible ? 'Hide terminal panel' : 'Show terminal panel'}
                            >
                                <Terminal size={13} />
                            </button>
                        )}
                        {canRunPython && (
                            <div ref={pythonRunModeMenuRef} className="relative inline-flex items-center rounded-lg border border-white/10 bg-black/10">
                                <button
                                    type="button"
                                    onClick={isPythonRunning ? onStopPython : onRunPython}
                                    className={cn(
                                        'inline-flex h-8 w-8 items-center justify-center transition-colors rounded-l-lg',
                                        isPythonRunning
                                            ? 'bg-amber-500/15 text-amber-200 hover:bg-amber-500/25'
                                            : 'bg-emerald-500/15 text-emerald-200 hover:bg-emerald-500/25'
                                    )}
                                    title={isPythonRunning ? 'Stop Python run' : `Run Python (${pythonRunMode === 'terminal' ? 'terminal' : 'output'})`}
                                >
                                    {isPythonRunning ? <Square size={13} /> : <Play size={13} />}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setPythonRunModeMenuOpen((current) => !current)}
                                    className="inline-flex h-8 w-6 items-center justify-center border-l border-white/10 text-white/70 hover:bg-white/10 hover:text-white transition-colors rounded-r-lg"
                                    title="Choose run mode"
                                    aria-expanded={pythonRunModeMenuOpen}
                                >
                                    <ChevronDown size={12} />
                                </button>
                                {pythonRunModeMenuOpen && (
                                    <div className="absolute right-0 top-9 z-40 w-44 rounded-lg border border-white/10 bg-sparkle-card p-1.5 shadow-2xl">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                onPythonRunModeChange?.('terminal')
                                                setPythonRunModeMenuOpen(false)
                                            }}
                                            className={cn(
                                                'flex w-full items-center justify-between rounded-md px-2 py-1.5 text-xs transition-colors',
                                                pythonRunMode === 'terminal'
                                                    ? 'bg-[var(--accent-primary)]/20 text-[var(--accent-primary)]'
                                                    : 'text-sparkle-text-secondary hover:bg-white/[0.03] hover:text-sparkle-text'
                                            )}
                                        >
                                            <span>Run in Terminal</span>
                                            {pythonRunMode === 'terminal' && <Check size={12} />}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                onPythonRunModeChange?.('output')
                                                setPythonRunModeMenuOpen(false)
                                            }}
                                            className={cn(
                                                'flex w-full items-center justify-between rounded-md px-2 py-1.5 text-xs transition-colors',
                                                pythonRunMode === 'output'
                                                    ? 'bg-[var(--accent-primary)]/20 text-[var(--accent-primary)]'
                                                    : 'text-sparkle-text-secondary hover:bg-white/[0.03] hover:text-sparkle-text'
                                            )}
                                        >
                                            <span>Run in Output</span>
                                            {pythonRunMode === 'output' && <Check size={12} />}
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}
                        {canRunPython && (
                            <button
                                type="button"
                                onClick={onClearPythonOutput}
                                disabled={!pythonHasOutput && !isPythonRunning}
                                className={cn(
                                    iconButtonBaseClass,
                                    (pythonHasOutput || isPythonRunning)
                                        ? 'border-transparent text-white/60 hover:bg-white/10 hover:text-white'
                                        : 'border-transparent text-white/25 cursor-not-allowed'
                                )}
                                title="Clear run output"
                            >
                                <Trash2 size={13} />
                            </button>
                        )}
                    </div>
                )}
                {!isMediaFile && (
                    <div className={controlGroupClass}>
                        <button
                            onClick={onToggleExpanded}
                            className={cn(
                                iconButtonBaseClass,
                                isExpanded
                                    ? 'border-sky-400/30 bg-sky-500/12 text-sky-200'
                                    : 'border-transparent text-white/55 hover:bg-white/10 hover:text-white'
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
                                    className={cn(leftPanelOpen ? activeIconButtonClass : ghostIconButtonClass)}
                                    title={leftPanelOpen ? 'Hide left panel' : 'Show left panel'}
                                >
                                    <PanelLeft size={16} />
                                </button>
                                <button
                                    onClick={onToggleRightPanel}
                                    className={cn(rightPanelOpen ? activeIconButtonClass : ghostIconButtonClass)}
                                    title={rightPanelOpen ? 'Hide right panel' : 'Show right panel'}
                                >
                                    <PanelRight size={16} />
                                </button>
                            </>
                        )}
                    </div>
                )}
            </div>

            {isHtml && !isEditMode && (
                <div
                    className={cn(
                        'flex items-center gap-2',
                        isCompactHtmlHeader ? 'order-3 w-full flex-wrap' : '',
                        isVeryCompactHtmlHeader ? 'justify-start' : isCompactHtmlHeader ? 'justify-between' : ''
                    )}
                >
                    {htmlViewMode === 'rendered' && (
                        <div className={cn('flex items-center gap-2 bg-white/5 rounded-lg p-1.5', isUltraCompactHtmlHeader ? 'w-full' : '')}>
                            <span className="text-[11px] text-white/60 px-1">Viewport</span>
                            <select
                                value={viewport}
                                onChange={(event) => {
                                    const nextViewport = event.target.value
                                    if (nextViewport in VIEWPORT_PRESETS) {
                                        onViewportChange(nextViewport as ViewportPreset)
                                        return
                                    }
                                    onViewportChange('responsive')
                                }}
                                className="h-7 rounded-md border border-white/15 bg-white/10 px-2 text-xs text-white outline-none transition-colors hover:bg-white/15 focus:border-white/30 focus:bg-white/15"
                                title="Choose preview viewport size"
                                aria-label="Choose preview viewport size"
                            >
                                {(Object.entries(VIEWPORT_PRESETS) as [ViewportPreset, typeof presetConfig][]).map(([key, preset]) => (
                                    <option key={key} value={key} className="bg-slate-900 text-white">
                                        {key === 'responsive' ? 'Full Width' : `${preset.label} (${preset.width}x${preset.height})`}
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}
                    <div className={cn('flex items-center gap-1 bg-white/5 rounded-lg p-1', isUltraCompactHtmlHeader ? 'w-full justify-center' : '')}>
                        <button
                            onClick={() => onHtmlViewModeChange('rendered')}
                            className={cn(
                                'inline-flex h-8 w-8 items-center justify-center text-xs rounded-md transition-all',
                                htmlViewMode === 'rendered'
                                    ? 'bg-white/15 text-white'
                                    : 'text-white/40 hover:text-white/70 hover:bg-white/5'
                            )}
                            title="Rendered HTML preview"
                            aria-label="Rendered HTML preview"
                        >
                            <Eye size={13} />
                            <span className="sr-only">Rendered</span>
                        </button>
                        <button
                            onClick={() => onHtmlViewModeChange('code')}
                            className={cn(
                                'inline-flex h-8 w-8 items-center justify-center text-xs rounded-md transition-all',
                                htmlViewMode === 'code'
                                    ? 'bg-white/15 text-white'
                                    : 'text-white/40 hover:text-white/70 hover:bg-white/5'
                            )}
                            title="HTML source preview"
                            aria-label="HTML source preview"
                        >
                            <Code size={13} />
                            <span className="sr-only">Source</span>
                        </button>
                    </div>
                </div>
            )}

            <div className={cn(
                'flex items-center gap-2 min-w-0 flex-wrap justify-end',
                isCompactHeader ? 'w-full ml-auto' : '',
                isUltraCompactHtmlHeader ? 'w-full justify-end' : ''
            )}>
                {!isMediaFile && isEditMode && (
                    <div className={controlGroupClass}>
                        <button
                            onClick={onRevert}
                            disabled={!isDirty || isSaving}
                            className={cn(
                                iconButtonBaseClass,
                                isDirty && !isSaving
                                    ? 'border-transparent text-white/80 hover:bg-white/10'
                                    : 'border-transparent text-white/35 cursor-not-allowed'
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
                                        : 'border-transparent text-white/35 cursor-not-allowed'
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
                    {!isMediaFile && canRunPython && (
                        <span className={cn('text-[10px] uppercase font-semibold px-2 py-1 rounded', pythonStatusTone)}>
                            {pythonStatusLabel}
                        </span>
                    )}
                    {!isMediaFile && showGitSummary && (
                        <div className="flex items-center gap-1.5">
                            <span className={cn('text-[10px] uppercase font-semibold px-2 py-1 rounded', statusTone)}>
                                {statusLabel}
                            </span>
                            <span className="text-[10px] px-1.5 py-1 rounded bg-emerald-500/10 text-emerald-300">+{gitDiffSummary?.additions ?? 0}</span>
                            <span className="text-[10px] px-1.5 py-1 rounded bg-red-500/10 text-red-300">-{gitDiffSummary?.deletions ?? 0}</span>
                            <span className="text-[10px] px-1.5 py-1 rounded bg-white/5 text-white/50">{totalFileLines} lines</span>
                        </div>
                    )}
                    {!isMediaFile && showUnsavedDiffSummary && liveDiffPreview && (
                        <div className="flex items-center gap-1.5">
                            <span className="text-[10px] uppercase font-semibold px-2 py-1 rounded bg-sky-500/20 text-sky-300">
                                Unsaved
                            </span>
                            <span className="text-[10px] px-1.5 py-1 rounded bg-emerald-500/10 text-emerald-300">+{liveDiffPreview.additions}</span>
                            <span className="text-[10px] px-1.5 py-1 rounded bg-red-500/10 text-red-300">-{liveDiffPreview.deletions}</span>
                        </div>
                    )}
                    {!isMediaFile && (
                        <span className="text-[10px] text-white/30 uppercase px-2 py-1 bg-white/5 rounded">
                            {file.type}
                            {isEditMode ? ' - edit' : ''}
                            {isHtml && showDetailedFileMeta && ` - ${htmlViewMode}`}
                            {isHtml && showDetailedFileMeta && !isVeryCompactHtmlHeader && htmlViewMode === 'rendered' && viewport !== 'responsive' && ` - ${presetConfig.width}x${presetConfig.height}`}
                        </span>
                    )}
                    {!isMediaFile && showStandaloneUnsavedChip && (
                        <span className="text-[10px] px-1.5 py-1 rounded bg-amber-500/15 text-amber-200">Unsaved</span>
                    )}
                    {isHtml && !isEditMode && (
                        <button
                            onClick={onOpenInBrowser}
                            className={cn(
                                'inline-flex h-8 w-8 items-center justify-center rounded-lg text-xs text-white/60 hover:text-white hover:bg-white/10 transition-all'
                            )}
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
                    className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-white/40 hover:bg-white/10 hover:text-white transition-all shrink-0"
                    title="Close (Esc)"
                >
                    <X size={18} />
                </button>
            </div>
        </div>
    )
}
