import { cn } from '@/lib/utils'
import PreviewBody from './PreviewBody'
import PreviewErrorBoundary from './PreviewErrorBoundary'
import PreviewModalHeader from './PreviewModalHeader'
import { VIEWPORT_PRESETS, type ViewportPreset } from './viewport'
import { PreviewModalDialogs } from './PreviewModalDialogs'
import { PreviewFloatingInfo, type PreviewFloatingInfoChip } from './PreviewFloatingInfo'
import { PreviewNavigationSidebar } from './PreviewNavigationSidebar'
import { PreviewExpandedWorkspace } from './PreviewExpandedWorkspace'
import { PreviewInspectorSidebar } from './PreviewInspectorSidebar'
import { PreviewExpandedPreviewArea } from './PreviewExpandedPreviewArea'
import type { PreviewModalLayoutProps } from './previewModalLayout.types'

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
        onMinimizeLeftPanel,
        onOpenLinkedPreview,
        onOpenLinkedPreviewInNewTab,
        folderTreeRefreshToken = 0,
        preserveSidebarContextRequest = null,
        previewTabs,
        activePreviewTabId,
        onSelectPreviewTab,
        onClosePreviewTab,
        canCreateSiblingFile = false,
        onCreateSiblingFile,
        longLineCount,
        trailingWhitespaceCount,
        jsonDiagnostic,
        isEditorToolsEnabled,
        getEditorToolButtonClass,
        pythonPanel,
        terminalPanel,
        previewModeEnabled,
        showUnsavedModal,
        conflictModifiedAt,
        dismissUnsaved,
        discardUnsaved,
        confirmUnsaved,
        dismissConflict,
        reloadConflict,
        overwriteConflict
    } = props

    const isMediaFile = file.type === 'image' || file.type === 'video' || file.type === 'audio'
    const isEditMode = mode === 'edit'
    const hasUnsavedChanges = isEditMode && isDirty
    const lockPreviewBodyHeight = mode === 'edit'
        || isCsv
        || isHtml
        || hasBottomPanel
    const shouldStretchPreviewBody = lockPreviewBodyHeight || isMediaFile || file.type === 'md'
    const showUnsavedDiffSummary = hasUnsavedChanges && !!liveDiffPreview
    const showGitSummary = !!gitDiffSummary && !showUnsavedDiffSummary
    const viewportMetaLabel = isHtml && mode !== 'edit' && viewport !== 'responsive'
        ? `${presetConfig.width}x${presetConfig.height}`
        : undefined
    const floatingInfoChips: PreviewFloatingInfoChip[] = !isMediaFile
        ? [
            ...(canRunPython
                ? [{
                    label:
                        pythonRunState === 'success'
                            ? 'Run OK'
                            : pythonRunState === 'failed'
                                ? 'Run Failed'
                                : pythonRunState === 'stopped'
                                    ? 'Run Stopped'
                                    : pythonRunState === 'running'
                                        ? 'Running'
                                        : 'Idle',
                    className: `rounded px-2 py-1 text-[10px] font-semibold uppercase ${pythonRunState === 'success'
                        ? 'bg-emerald-500/20 text-emerald-300'
                        : pythonRunState === 'failed'
                            ? 'bg-red-500/20 text-red-300'
                            : pythonRunState === 'stopped'
                                ? 'bg-amber-500/20 text-amber-300'
                                : pythonRunState === 'running'
                                    ? 'bg-sky-500/20 text-sky-300'
                                    : 'bg-white/10 text-white/60'}`
                }]
                : []),
            ...(showGitSummary
                ? [
                    {
                        label: gitDiffSummary?.status ? gitDiffSummary.status.charAt(0).toUpperCase() + gitDiffSummary.status.slice(1) : 'Unknown',
                        className: `rounded px-2 py-1 text-[10px] font-semibold uppercase ${!gitDiffSummary
                            ? 'bg-white/10 text-white/60'
                            : gitDiffSummary.status === 'added'
                                ? 'bg-[#73C991]/20 text-[#73C991]'
                                : gitDiffSummary.status === 'deleted'
                                    ? 'bg-[#FF6B6B]/20 text-[#FF6B6B]'
                                    : gitDiffSummary.status === 'renamed'
                                        ? 'bg-blue-500/20 text-blue-300'
                                        : gitDiffSummary.status === 'modified'
                                            ? 'bg-[#E2C08D]/20 text-[#E2C08D]'
                                            : 'bg-white/10 text-white/60'}`
                    },
                    { label: `+${gitDiffSummary?.additions ?? 0}`, className: 'rounded bg-emerald-500/10 px-1.5 py-1 text-[10px] text-emerald-300' },
                    { label: `-${gitDiffSummary?.deletions ?? 0}`, className: 'rounded bg-red-500/10 px-1.5 py-1 text-[10px] text-red-300' },
                    { label: `${totalFileLines} lines`, className: 'rounded bg-white/5 px-1.5 py-1 text-[10px] text-white/50' }
                ]
                : []),
            ...(showUnsavedDiffSummary && liveDiffPreview
                ? [
                    { label: 'Unsaved', className: 'rounded bg-sky-500/20 px-2 py-1 text-[10px] font-semibold uppercase text-sky-300' },
                    { label: `+${liveDiffPreview.additions}`, className: 'rounded bg-emerald-500/10 px-1.5 py-1 text-[10px] text-emerald-300' },
                    { label: `-${liveDiffPreview.deletions}`, className: 'rounded bg-red-500/10 px-1.5 py-1 text-[10px] text-red-300' }
                ]
                : []),
            {
                label: [
                    file.type,
                    isEditMode ? 'edit' : null,
                    isHtml && !isEditMode ? 'rendered' : null,
                    viewportMetaLabel
                ].filter(Boolean).join(' / '),
                className: 'rounded bg-white/5 px-2 py-1 text-[10px] uppercase text-white/30'
            },
            ...(hasUnsavedChanges && !showUnsavedDiffSummary
                ? [{ label: 'Unsaved', className: 'rounded bg-amber-500/15 px-1.5 py-1 text-[10px] text-amber-200' }]
                : [])
        ]
        : []

    const isWindowShell = shellMode === 'window'

    function renderPreviewBody(fillEditorHeight: boolean) {
        return (
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
    }

    const previewHeaderNode = (
        <PreviewModalHeader
            file={file}
            showCloseButton={!isWindowShell}
            previewModeEnabled={previewModeEnabled}
            mode={mode}
            isEditable={canEdit}
            isDirty={isDirty}
            isSaving={isSaving}
            isExpanded={isExpanded}
            leftPanelOpen={leftPanelOpen}
            rightPanelOpen={rightPanelOpen}
            loadingEditableContent={loadingEditableContent}
            viewport={viewport}
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
            onCsvDistinctColorsEnabledChange={setCsvDistinctColorsEnabled}
            canRunPython={canRunPython}
            onPythonRunModeChange={setPythonRunMode}
            onRunPython={onRunPython}
            onStopPython={onStopPython}
            onClearPythonOutput={onClearPythonOutput}
            canUseTerminal={canUsePreviewTerminal}
            onToggleTerminal={onTogglePreviewTerminal}
            onOpenInBrowser={onOpenInBrowser}
            previewTabs={previewTabs}
            activePreviewTabId={activePreviewTabId}
            onSelectPreviewTab={onSelectPreviewTab}
            onClosePreviewTab={onClosePreviewTab}
            canCreateSiblingFile={canCreateSiblingFile}
            onCreateSiblingFile={onCreateSiblingFile}
        />
    )

    const expandedPreviewArea = (
        <PreviewExpandedPreviewArea
            previewSurfaceRef={previewSurfaceRef}
            centerHtmlRenderedPreview={centerHtmlRenderedPreview}
            isCompactHtmlViewport={isCompactHtmlViewport}
            overflowLocked={mode === 'edit' || isCsv || isHtml || hasBottomPanel}
            shouldStretchPreviewBody={shouldStretchPreviewBody}
            hasBottomPanel={hasBottomPanel}
            mode={mode}
            previewContent={renderPreviewBody(true)}
            floatingInfoChips={floatingInfoChips}
        />
    )

    const expandedRightInspector = (
        <PreviewInspectorSidebar
            filePath={file.path}
            gitDiffSummary={gitDiffSummary}
            mode={mode}
            isDirty={isDirty}
            setFindRequestToken={setFindRequestToken}
            setReplaceRequestToken={setReplaceRequestToken}
            isEditorToolsEnabled={isEditorToolsEnabled}
            getEditorToolButtonClass={getEditorToolButtonClass}
            editorWordWrap={editorWordWrap}
            setEditorWordWrap={setEditorWordWrap}
            editorMinimapEnabled={editorMinimapEnabled}
            setEditorMinimapEnabled={setEditorMinimapEnabled}
            editorFontSize={editorFontSize}
            setEditorFontSize={setEditorFontSize}
            trailingWhitespaceCount={trailingWhitespaceCount}
            longLineCount={longLineCount}
            jsonDiagnostic={jsonDiagnostic}
        />
    )

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
                            : isMediaFile
                                ? 'bg-sparkle-card m-4 h-[min(86vh,860px)] w-[min(90vw,1220px)] rounded-2xl border border-white/10 opacity-100 shadow-2xl'
                                : 'bg-sparkle-card m-4 w-full max-h-[90vh] max-w-[95vw] rounded-2xl border border-white/10 opacity-100 shadow-2xl'
                    )
                )}
                onClick={!isWindowShell && !isExpanded ? (event => event.stopPropagation()) : undefined}
                style={isWindowShell ? undefined : modalStyle}
            >
                {!isExpanded ? previewHeaderNode : null}
                {!isExpanded && saveError ? <div className="border-b border-red-500/20 bg-red-500/10 px-4 py-2 text-xs text-red-200">{saveError}</div> : null}

                {isExpanded ? (
                    <PreviewExpandedWorkspace
                        header={previewHeaderNode}
                        saveError={saveError}
                        leftPanelOpen={leftPanelOpen}
                        leftPanelWidth={leftPanelWidth}
                        rightPanelOpen={rightPanelOpen}
                        rightPanelWidth={rightPanelWidth}
                        isResizingPanels={isResizingPanels}
                        leftSidebar={
                            <PreviewNavigationSidebar
                                file={file}
                                projectPath={projectPath}
                                outlineItems={outlineItems}
                                onOutlineSelect={onOutlineSelect}
                                onMinimizePanel={onMinimizeLeftPanel}
                                onOpenLinkedPreview={onOpenLinkedPreview}
                                onOpenLinkedPreviewInNewTab={onOpenLinkedPreviewInNewTab}
                                refreshToken={folderTreeRefreshToken}
                                preserveContextRequest={preserveSidebarContextRequest}
                            />
                        }
                        previewArea={expandedPreviewArea}
                        rightInspector={expandedRightInspector}
                    />
                ) : (
                    <div className="group/preview relative flex-1 min-h-0">
                        <div
                            ref={previewSurfaceRef}
                            className={cn(
                                'h-full w-full custom-scrollbar flex items-stretch justify-center bg-sparkle-bg',
                                isMediaFile
                                    ? 'p-0'
                                    : flushResponsiveHtmlPreview
                                        ? 'p-0'
                                        : (isCompactHtmlViewport ? 'p-2 sm:p-3' : 'p-4'),
                                mode === 'edit' || isCsv || isHtml || hasBottomPanel || isMediaFile
                                    ? 'overflow-hidden'
                                    : 'overflow-auto'
                            )}
                            style={{ overscrollBehavior: 'contain' }}
                        >
                            <div className={cn('w-full flex flex-col', shouldStretchPreviewBody ? 'h-full min-h-0' : 'min-h-full')}><div className={cn(shouldStretchPreviewBody && 'min-h-0', hasBottomPanel ? 'flex-1' : (shouldStretchPreviewBody ? 'h-full' : ''), hasBottomPanel && mode !== 'edit' ? 'overflow-auto custom-scrollbar' : '', centerHtmlRenderedPreview ? 'flex items-center justify-center' : '')}>{renderPreviewBody(false)}</div></div>
                        </div>
                        <PreviewFloatingInfo chips={floatingInfoChips} />
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
