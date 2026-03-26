import type { CSSProperties, Dispatch, ReactNode, RefObject, SetStateAction } from 'react'
import { cn } from '@/lib/utils'
import PreviewBody from './PreviewBody'
import PreviewErrorBoundary from './PreviewErrorBoundary'
import PreviewModalHeader from './PreviewModalHeader'
import { VIEWPORT_PRESETS, type ViewportPreset } from './viewport'
import type { GitDiffSummary, GitLineMarker } from './gitDiff'
import type { PreviewFile, PreviewMediaItem } from './types'
import type { OutlineItem } from './modalShared'
import { countLines } from './modalShared'
import { PreviewModalDialogs } from './PreviewModalDialogs'

type PreviewModalLayoutProps = {
    file: PreviewFile
    shellMode?: 'modal' | 'window'
    loading?: boolean
    truncated?: boolean
    size?: number
    previewBytes?: number
    projectPath?: string
    mediaItems: PreviewMediaItem[]
    openMediaItem: (item: PreviewMediaItem) => Promise<void>
    onInternalLinkClick: (href: string) => Promise<void>
    mode: 'preview' | 'edit'
    isExpanded: boolean
    canEdit: boolean
    isDirty: boolean
    isSaving: boolean
    leftPanelOpen: boolean
    rightPanelOpen: boolean
    leftPanelWidth: number
    rightPanelWidth: number
    isResizingPanels: boolean
    setFindRequestToken: Dispatch<SetStateAction<number>>
    setReplaceRequestToken: Dispatch<SetStateAction<number>>
    findRequestToken: number
    replaceRequestToken: number
    editorWordWrap: 'on' | 'off'
    setEditorWordWrap: Dispatch<SetStateAction<'on' | 'off'>>
    editorMinimapEnabled: boolean
    setEditorMinimapEnabled: Dispatch<SetStateAction<boolean>>
    editorFontSize: number
    setEditorFontSize: Dispatch<SetStateAction<number>>
    focusLine: number | null
    saveError: string | null
    sourceContent: string
    draftContent: string
    onDraftContentChange: (value: string) => void
    loadingEditableContent: boolean
    viewport: ViewportPreset
    setViewport: Dispatch<SetStateAction<ViewportPreset>>
    htmlViewMode: 'rendered' | 'code'
    setHtmlViewMode: Dispatch<SetStateAction<'rendered' | 'code'>>
    csvDistinctColorsEnabled: boolean
    setCsvDistinctColorsEnabled: Dispatch<SetStateAction<boolean>>
    pythonRunState: 'idle' | 'running' | 'success' | 'failed' | 'stopped'
    pythonRunMode: 'terminal' | 'output'
    pythonHasOutput: boolean
    setPythonRunMode: Dispatch<SetStateAction<'terminal' | 'output'>>
    canRunPython: boolean
    onRunPython: () => Promise<void>
    onStopPython: () => Promise<boolean>
    onClearPythonOutput: () => void
    canUsePreviewTerminal: boolean
    terminalVisible: boolean
    onTogglePreviewTerminal: () => void
    onOpenInBrowser: () => Promise<void>
    gitDiffText: string
    gitDiffSummary: GitDiffSummary | null
    liveDiffPreview?: {
        additions: number
        deletions: number
    } | null
    totalFileLines: number
    handleModeChange: (nextMode: 'preview' | 'edit') => Promise<void>
    handleSave: () => Promise<boolean>
    handleRevert?: () => void
    handleCloseRequest: () => void
    setIsExpanded: Dispatch<SetStateAction<boolean>>
    setLeftPanelOpen: Dispatch<SetStateAction<boolean>>
    setRightPanelOpen: Dispatch<SetStateAction<boolean>>
    modalStyle: CSSProperties
    previewSurfaceRef: RefObject<HTMLDivElement | null>
    previewResetKey: string
    lineMarkersOverride: GitLineMarker[] | undefined
    presetConfig: (typeof VIEWPORT_PRESETS)[ViewportPreset]
    isCsv: boolean
    isHtml: boolean
    isCompactHtmlViewport: boolean
    centerHtmlRenderedPreview: boolean
    flushResponsiveHtmlPreview: boolean
    hasBottomPanel: boolean
    outlineItems: OutlineItem[]
    onOutlineSelect: (item: OutlineItem) => void
    longLineCount: number
    trailingWhitespaceCount: number
    jsonDiagnostic: { ok: boolean; message: string } | null
    isEditorToolsEnabled: boolean
    getEditorToolButtonClass: (isActive?: boolean) => string
    pythonPanel: ReactNode
    terminalPanel: ReactNode
    showUnsavedModal: boolean
    conflictModifiedAt: number | null
    dismissUnsaved: () => void
    discardUnsaved: () => void
    confirmUnsaved: () => Promise<void>
    dismissConflict: () => void
    reloadConflict: () => Promise<void>
    overwriteConflict: () => Promise<void>
}

export function PreviewModalLayout(props: PreviewModalLayoutProps) {
    const {
        file,
        shellMode = 'modal',
        loading,
        truncated,
        size,
        previewBytes,
        projectPath,
        mediaItems,
        openMediaItem,
        onInternalLinkClick,
        mode,
        isExpanded,
        canEdit,
        isDirty,
        isSaving,
        leftPanelOpen,
        rightPanelOpen,
        leftPanelWidth,
        rightPanelWidth,
        isResizingPanels,
        setFindRequestToken,
        setReplaceRequestToken,
        findRequestToken,
        replaceRequestToken,
        editorWordWrap,
        setEditorWordWrap,
        editorMinimapEnabled,
        setEditorMinimapEnabled,
        editorFontSize,
        setEditorFontSize,
        focusLine,
        saveError,
        sourceContent,
        draftContent,
        onDraftContentChange,
        loadingEditableContent,
        viewport,
        setViewport,
        htmlViewMode,
        setHtmlViewMode,
        csvDistinctColorsEnabled,
        setCsvDistinctColorsEnabled,
        pythonRunState,
        pythonRunMode,
        pythonHasOutput,
        setPythonRunMode,
        canRunPython,
        onRunPython,
        onStopPython,
        onClearPythonOutput,
        canUsePreviewTerminal,
        terminalVisible,
        onTogglePreviewTerminal,
        onOpenInBrowser,
        gitDiffText,
        gitDiffSummary,
        liveDiffPreview,
        totalFileLines,
        handleModeChange,
        handleSave,
        handleRevert,
        handleCloseRequest,
        setIsExpanded,
        setLeftPanelOpen,
        setRightPanelOpen,
        modalStyle,
        previewSurfaceRef,
        previewResetKey,
        lineMarkersOverride,
        presetConfig,
        isCsv,
        isHtml,
        isCompactHtmlViewport,
        centerHtmlRenderedPreview,
        flushResponsiveHtmlPreview,
        hasBottomPanel,
        outlineItems,
        onOutlineSelect,
        longLineCount,
        trailingWhitespaceCount,
        jsonDiagnostic,
        isEditorToolsEnabled,
        getEditorToolButtonClass,
        pythonPanel,
        terminalPanel,
        showUnsavedModal,
        conflictModifiedAt,
        dismissUnsaved,
        discardUnsaved,
        confirmUnsaved,
        dismissConflict,
        reloadConflict,
        overwriteConflict
    } = props

    const renderPreviewBody = (fillEditorHeight: boolean) => (
        <PreviewErrorBoundary resetKey={previewResetKey}>
            <PreviewBody
                file={file}
                content={sourceContent}
                loading={loading}
                meta={{ truncated, size, previewBytes }}
                projectPath={projectPath}
                onInternalLinkClick={onInternalLinkClick}
                gitDiffText={gitDiffText}
                viewport={viewport}
                presetConfig={presetConfig}
                htmlViewMode={htmlViewMode}
                csvDistinctColorsEnabled={csvDistinctColorsEnabled}
                mode={mode}
                editableContent={draftContent}
                onEditableContentChange={onDraftContentChange}
                isEditable={canEdit}
                loadingEditableContent={loadingEditableContent}
                editorWordWrap={editorWordWrap}
                editorMinimapEnabled={editorMinimapEnabled}
                editorFontSize={editorFontSize}
                findRequestToken={findRequestToken}
                replaceRequestToken={replaceRequestToken}
                focusLine={focusLine}
                fillEditorHeight={fillEditorHeight}
                lineMarkersOverride={lineMarkersOverride}
                previewFocusLine={focusLine}
                isExpanded={isExpanded}
                mediaItems={mediaItems}
                onSelectMedia={openMediaItem}
            />
        </PreviewErrorBoundary>
    )

    const isWindowShell = shellMode === 'window'

    const modalContent = (
        <div
            className={cn(
                'flex transition-[background-color,padding,backdrop-filter] duration-320 ease-[cubic-bezier(0.16,1,0.3,1)]',
                isWindowShell
                    ? 'min-h-0 flex-1 items-stretch justify-stretch bg-sparkle-bg'
                    : isExpanded
                        ? 'fixed left-0 right-0 bottom-0 top-[46px] z-[45] items-stretch justify-stretch bg-sparkle-bg'
                        : 'fixed inset-0 z-[80] items-center justify-center bg-black/70 backdrop-blur-md'
            )}
            onClick={!isWindowShell && !isExpanded ? handleCloseRequest : undefined}
            style={!isWindowShell && !isExpanded ? { animation: 'fadeIn 0.18s ease-out' } : undefined}
            onWheel={(event) => event.stopPropagation()}
        >
            <div
                className={cn(
                    'flex flex-col overflow-hidden',
                    isWindowShell
                        ? 'min-h-0 w-full flex-1 bg-sparkle-card'
                        : 'will-change-[opacity,width,height,max-width,max-height,border-radius,margin,box-shadow,border-color] transition-[width,max-width,height,max-height,border-radius,margin,box-shadow,border-color,opacity] duration-320 ease-[cubic-bezier(0.16,1,0.3,1)]',
                    !isWindowShell && (
                        isExpanded
                            ? 'bg-sparkle-card h-full w-full max-h-none max-w-none opacity-100 m-0 rounded-none border-0 shadow-none'
                            : 'bg-sparkle-card m-4 w-full max-h-[90vh] max-w-[95vw] rounded-2xl border border-white/10 opacity-100 shadow-2xl'
                    )
                )}
                onClick={!isWindowShell && !isExpanded ? (event => event.stopPropagation()) : undefined}
                style={isWindowShell ? undefined : modalStyle}
            >
                <PreviewModalHeader
                    file={file}
                    showCloseButton={!isWindowShell}
                    gitDiffSummary={gitDiffSummary}
                    totalFileLines={totalFileLines}
                    mode={mode}
                    isEditable={canEdit}
                    isDirty={isDirty}
                    isSaving={isSaving}
                    isExpanded={isExpanded}
                    leftPanelOpen={leftPanelOpen}
                    rightPanelOpen={rightPanelOpen}
                    loadingEditableContent={loadingEditableContent}
                    viewport={viewport}
                    liveDiffPreview={liveDiffPreview}
                    htmlViewMode={htmlViewMode}
                    csvDistinctColorsEnabled={csvDistinctColorsEnabled}
                    pythonRunState={pythonRunState}
                    pythonHasOutput={pythonHasOutput}
                    pythonRunMode={pythonRunMode}
                    terminalVisible={terminalVisible}
                    onClose={handleCloseRequest}
                    onToggleExpanded={() => setIsExpanded((current) => !current)}
                    onToggleLeftPanel={() => setLeftPanelOpen((current) => !current)}
                    onToggleRightPanel={() => setRightPanelOpen((current) => !current)}
                    onModeChange={handleModeChange}
                    onSave={handleSave}
                    onRevert={handleRevert ?? (() => undefined)}
                    onViewportChange={setViewport}
                    onHtmlViewModeChange={setHtmlViewMode}
                    onCsvDistinctColorsEnabledChange={setCsvDistinctColorsEnabled}
                    canRunPython={canRunPython}
                    onPythonRunModeChange={setPythonRunMode}
                    onRunPython={onRunPython}
                    onStopPython={onStopPython}
                    onClearPythonOutput={onClearPythonOutput}
                    canUseTerminal={canUsePreviewTerminal}
                    onToggleTerminal={onTogglePreviewTerminal}
                    onOpenInBrowser={onOpenInBrowser}
                />

                {saveError && <div className="border-b border-red-500/20 bg-red-500/10 px-4 py-2 text-xs text-red-200">{saveError}</div>}

                {isExpanded ? (
                    <div className="flex-1 min-h-0 flex bg-sparkle-bg">
                        <aside className={cn('relative shrink-0 flex flex-col gap-3 overflow-hidden transition-[width,opacity,transform,padding,border-color] ease-out', isResizingPanels ? 'duration-0' : 'duration-250', leftPanelOpen ? 'border-r border-sparkle-border-secondary bg-sparkle-bg p-3 opacity-100 translate-x-0' : 'w-0 border-r border-transparent bg-transparent p-0 opacity-0 -translate-x-2 pointer-events-none')} style={{ width: leftPanelOpen ? `${leftPanelWidth}px` : '0px' }}>
                            <div className="text-[10px] uppercase tracking-wide text-sparkle-text-muted">Workspace</div>
                            <div className="rounded-xl border border-sparkle-border bg-sparkle-card p-3 flex flex-col gap-2 min-h-0 shadow-sm">
                                <div className="text-xs font-medium text-sparkle-text">Outline</div>
                                {outlineItems.length > 0 ? (
                                    <div className="space-y-1 overflow-y-auto custom-scrollbar pr-1 flex-1 min-h-0">
                                        {outlineItems.map((item) => (
                                            <button key={`${item.kind}:${item.line}:${item.label}`} type="button" onClick={() => onOutlineSelect(item)} className="flex w-full items-center gap-1.5 rounded-md border border-transparent px-2 py-1 text-left text-[11px] whitespace-nowrap transition-colors hover:border-sparkle-border hover:bg-sparkle-card-hover/60" title={`${item.label} (line ${item.line})`}>
                                                <span className="shrink-0 text-[10px] uppercase text-sparkle-text-muted">{item.kind}</span>
                                                <span className="min-w-0 flex-1 truncate text-sparkle-text-secondary">{item.label}</span>
                                                <span className="shrink-0 text-[10px] text-sparkle-text-muted">:{item.line}</span>
                                            </button>
                                        ))}
                                    </div>
                                ) : <div className="text-[11px] text-sparkle-text-muted">No headings or symbols detected.</div>}
                            </div>
                            <div className="rounded-xl border border-sparkle-border bg-sparkle-card p-3 shadow-sm">
                                <div className="text-xs font-medium text-sparkle-text">File Metrics</div>
                                <div className="mt-1 text-[11px] text-sparkle-text-secondary">{countLines(mode === 'edit' ? draftContent : sourceContent)} lines</div>
                                <div className="text-[11px] text-sparkle-text-secondary">{(mode === 'edit' ? draftContent : sourceContent).length.toLocaleString()} chars</div>
                                <div className="text-[11px] text-sparkle-text-secondary">{longLineCount} long lines (&gt;120)</div>
                            </div>
                            <div data-preview-resize-side="left" className={cn('group absolute -right-1 top-0 z-30 h-full w-3 cursor-col-resize bg-transparent transition-colors', leftPanelOpen ? 'hover:bg-[var(--accent-primary)]/14' : 'pointer-events-none')} title="Resize left panel">
                                <div data-preview-resize-side="left" className={cn('pointer-events-none absolute left-1/2 top-1/2 h-16 w-[2px] -translate-x-1/2 -translate-y-1/2 rounded-full transition-all duration-200', leftPanelOpen ? 'bg-sparkle-border-secondary/80 opacity-70 group-hover:h-24 group-hover:bg-[var(--accent-primary)]/70 group-hover:opacity-100' : 'opacity-0')} />
                            </div>
                        </aside>
                        <div ref={previewSurfaceRef} className={cn('flex-1 min-w-0 custom-scrollbar flex', centerHtmlRenderedPreview ? 'items-center justify-center' : 'items-stretch justify-start', isCompactHtmlViewport ? 'p-2 sm:p-3' : 'p-0', mode === 'edit' || isCsv || (isHtml && htmlViewMode === 'code') || (isHtml && htmlViewMode === 'rendered') || hasBottomPanel ? 'overflow-hidden' : 'overflow-auto')} style={{ overscrollBehavior: 'contain' }}>
                            <div className="w-full h-full min-h-0 flex flex-col">
                                <div className={cn('min-h-0', hasBottomPanel ? 'flex-1' : 'h-full', hasBottomPanel && mode !== 'edit' ? 'overflow-auto custom-scrollbar' : '', centerHtmlRenderedPreview ? 'flex items-center justify-center' : '')}>
                                    {renderPreviewBody(isExpanded && mode === 'edit')}
                                </div>
                            </div>
                        </div>
                        <aside className={cn('relative shrink-0 flex flex-col gap-3 overflow-hidden transition-[width,opacity,transform,padding,border-color] ease-out', isResizingPanels ? 'duration-0' : 'duration-250', rightPanelOpen ? 'border-l border-sparkle-border-secondary bg-sparkle-bg p-3 opacity-100 translate-x-0' : 'w-0 border-l border-transparent bg-transparent p-0 opacity-0 translate-x-2 pointer-events-none')} style={{ width: rightPanelOpen ? `${rightPanelWidth}px` : '0px' }}>
                            <div className="text-[10px] uppercase tracking-wide text-sparkle-text-muted">Inspector</div>
                            <div className="rounded-xl border border-sparkle-border bg-sparkle-card p-3 shadow-sm"><div className="text-xs font-medium text-sparkle-text">File</div><div className="mt-1 text-[11px] text-sparkle-text-secondary break-all">{file.path}</div></div>
                            <div className="rounded-xl border border-sparkle-border bg-sparkle-card p-3 shadow-sm"><div className="text-xs font-medium text-sparkle-text">Git Snapshot</div><div className="mt-1 text-[11px] text-emerald-300">+{gitDiffSummary?.additions ?? 0}</div><div className="text-[11px] text-red-300">-{gitDiffSummary?.deletions ?? 0}</div></div>
                            <div className="rounded-xl border border-sparkle-border bg-sparkle-card p-3 shadow-sm"><div className="text-xs font-medium text-sparkle-text">Edit Session</div><div className="mt-1 text-[11px] text-sparkle-text-secondary">{mode === 'edit' ? 'Editing enabled' : 'Preview mode'}</div><div className="text-[11px] text-sparkle-text-secondary">{isDirty ? 'Unsaved changes present' : 'No unsaved changes'}</div></div>
                            <div className="rounded-xl border border-sparkle-border bg-sparkle-card p-3 flex flex-col gap-2 shadow-sm">
                                <div className="text-xs font-medium text-sparkle-text">Editor Tools</div>
                                <div className="flex items-center gap-2 flex-wrap">
                                    <button type="button" onClick={() => setFindRequestToken((current) => current + 1)} disabled={!isEditorToolsEnabled} className={getEditorToolButtonClass(false)}>Find</button>
                                    <button type="button" onClick={() => setReplaceRequestToken((current) => current + 1)} disabled={!isEditorToolsEnabled} className={getEditorToolButtonClass(false)}>Replace</button>
                                </div>
                                <div className="flex items-center justify-between text-[11px] text-sparkle-text-secondary"><span>Wrap</span><button type="button" onClick={() => setEditorWordWrap((current) => current === 'on' ? 'off' : 'on')} disabled={!isEditorToolsEnabled} className={getEditorToolButtonClass(editorWordWrap === 'on')}>{editorWordWrap === 'on' ? 'On' : 'Off'}</button></div>
                                <div className="flex items-center justify-between text-[11px] text-sparkle-text-secondary"><span>Minimap</span><button type="button" onClick={() => setEditorMinimapEnabled((current) => !current)} disabled={!isEditorToolsEnabled} className={getEditorToolButtonClass(editorMinimapEnabled)}>{editorMinimapEnabled ? 'On' : 'Off'}</button></div>
                                <div className="flex items-center justify-between text-[11px] text-sparkle-text-secondary"><span>Font</span><div className="flex items-center gap-1"><button type="button" onClick={() => setEditorFontSize((current) => Math.max(11, current - 1))} disabled={!isEditorToolsEnabled} className={getEditorToolButtonClass(false)}>-</button><span className="min-w-[2rem] text-center text-sparkle-text-secondary">{editorFontSize}</span><button type="button" onClick={() => setEditorFontSize((current) => Math.min(22, current + 1))} disabled={!isEditorToolsEnabled} className={getEditorToolButtonClass(false)}>+</button></div></div>
                            </div>
                            <div className="rounded-xl border border-sparkle-border bg-sparkle-card p-3 shadow-sm">
                                <div className="text-xs font-medium text-sparkle-text">Diagnostics</div>
                                <div className="mt-1 text-[11px] text-sparkle-text-secondary">Trailing whitespace lines: {trailingWhitespaceCount}</div>
                                <div className="text-[11px] text-sparkle-text-secondary">Long lines (&gt;120): {longLineCount}</div>
                                {jsonDiagnostic && <div className={cn('text-[11px]', jsonDiagnostic.ok ? 'text-emerald-300' : 'text-amber-300')}>{jsonDiagnostic.message}</div>}
                            </div>
                            <div data-preview-resize-side="right" className={cn('group absolute -left-1 top-0 z-30 h-full w-3 cursor-col-resize bg-transparent transition-colors', rightPanelOpen ? 'hover:bg-[var(--accent-primary)]/14' : 'pointer-events-none')} title="Resize right panel">
                                <div data-preview-resize-side="right" className={cn('pointer-events-none absolute left-1/2 top-1/2 h-16 w-[2px] -translate-x-1/2 -translate-y-1/2 rounded-full transition-all duration-200', rightPanelOpen ? 'bg-sparkle-border-secondary/80 opacity-70 group-hover:h-24 group-hover:bg-[var(--accent-primary)]/70 group-hover:opacity-100' : 'opacity-0')} />
                            </div>
                        </aside>
                    </div>
                ) : (
                    <div ref={previewSurfaceRef} className={cn('flex-1 custom-scrollbar flex items-stretch justify-center bg-sparkle-bg', flushResponsiveHtmlPreview ? 'p-0' : (isCompactHtmlViewport ? 'p-2 sm:p-3' : 'p-4'), mode === 'edit' || isCsv || (isHtml && htmlViewMode === 'code') || (isHtml && htmlViewMode === 'rendered') || hasBottomPanel ? 'overflow-hidden' : 'overflow-auto')} style={{ overscrollBehavior: 'contain' }}>
                        <div className="w-full h-full min-h-0 flex flex-col"><div className={cn('min-h-0', hasBottomPanel ? 'flex-1' : 'h-full', hasBottomPanel && mode !== 'edit' ? 'overflow-auto custom-scrollbar' : '', centerHtmlRenderedPreview ? 'flex items-center justify-center' : '')}>{renderPreviewBody(false)}</div></div>
                    </div>
                )}
                {pythonPanel}
                {terminalPanel}
            </div>
            <PreviewModalDialogs
                fileName={file.name}
                showUnsavedModal={showUnsavedModal}
                conflictModifiedAt={conflictModifiedAt}
                onCloseUnsaved={dismissUnsaved}
                onDiscardUnsaved={discardUnsaved}
                onSaveUnsaved={confirmUnsaved}
                onCloseConflict={dismissConflict}
                onReloadConflict={reloadConflict}
                onOverwriteConflict={overwriteConflict}
            />
        </div>
    )

    return modalContent
}
