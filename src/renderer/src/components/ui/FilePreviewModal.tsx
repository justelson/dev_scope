import { useCallback, useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { useSettings } from '@/lib/settings'
import { cn } from '@/lib/utils'
import { buildLocalDiffPreview, countLines, extractOutlineItems, isEditableFileType, PREVIEW_TERMINAL_MIN_HEIGHT, type OutlineItem } from './file-preview/modalShared'
import { PreviewModalLayout } from './file-preview/PreviewModalLayout'
import { PreviewPythonOutputPanel } from './file-preview/PreviewPythonOutputPanel'
import { PreviewTerminalPanel } from './file-preview/PreviewTerminalPanel'
import type { PreviewFile, PreviewMediaItem, PreviewMeta, PreviewOpenOptions } from './file-preview/types'
import { useFilePreview } from './file-preview/useFilePreview'
import { useFilePreviewChrome } from './file-preview/useFilePreviewChrome'
import { useFilePreviewEditSession } from './file-preview/useFilePreviewEditSession'
import { useFilePreviewPython } from './file-preview/useFilePreviewPython'
import { useFilePreviewTerminal } from './file-preview/useFilePreviewTerminal'
import { isMediaPreviewType } from './file-preview/utils'
import { navigateMarkdownLink } from './markdown/linkNavigation'

interface FilePreviewModalProps extends PreviewMeta {
    file: PreviewFile
    content: string
    loading?: boolean
    projectPath?: string
    onOpenLinkedPreview?: (file: { name: string; path: string }, ext: string, options?: PreviewOpenOptions) => Promise<void>
    mediaItems?: PreviewMediaItem[]
    onSaved?: (filePath: string) => Promise<void> | void
    onClose: () => void
}

export function FilePreviewModal({
    file,
    content,
    loading,
    truncated,
    size,
    previewBytes,
    modifiedAt,
    projectPath,
    onOpenLinkedPreview,
    mediaItems = [],
    onSaved,
    onClose
}: FilePreviewModalProps) {
    const navigate = useNavigate()
    const { settings, updateSettings } = useSettings()
    const isCsv = file.type === 'csv'
    const isHtml = file.type === 'html'
    const canEdit = isEditableFileType(file.type)
    const defaultMode: 'preview' | 'edit' = canEdit ? settings.filePreviewDefaultMode : 'preview'
    const initialMode: 'preview' | 'edit' = file.startInEditMode && canEdit ? 'edit' : defaultMode
    const defaultStartExpanded = settings.filePreviewOpenInFullscreen
    const defaultLeftPanelOpen = settings.filePreviewFullscreenShowLeftPanel
    const defaultRightPanelOpen = settings.filePreviewFullscreenShowRightPanel
    const canRunPython = file.type === 'code'
        && (file.language === 'python' || /\.py$/i.test(file.name) || /\.py$/i.test(file.path))
    const canUsePreviewTerminal = Boolean(projectPath || file.path)
    const terminalInitialHeight = Math.max(
        PREVIEW_TERMINAL_MIN_HEIGHT,
        Math.min(720, Math.round(settings.filePreviewTerminalPanelHeight || 220))
    )

    const {
        mode,
        setMode,
        htmlViewMode,
        setHtmlViewMode,
        gitDiffText,
        gitDiffSummary,
        sourceContent,
        draftContent,
        setDraftContent,
        loadingEditableContent,
        isSaving,
        saveError,
        setSaveError,
        showUnsavedModal,
        conflictModifiedAt,
        setConflictModifiedAt,
        isDirty,
        dismissUnsavedChanges,
        discardUnsavedChanges,
        confirmUnsavedChanges,
        handleSave,
        ensureEditableContentLoaded,
        reloadFromDisk,
        overwriteOnConflict,
        requestIntent,
        handleCloseRequest
    } = useFilePreviewEditSession({
        file,
        content,
        truncated,
        modifiedAt: modifiedAt ?? undefined,
        projectPath,
        canEdit,
        initialMode,
        isHtml,
        onSaved,
        onClose
    })

    const {
        viewport,
        setViewport,
        isExpanded,
        setIsExpanded,
        leftPanelOpen,
        setLeftPanelOpen,
        rightPanelOpen,
        setRightPanelOpen,
        leftPanelWidth,
        rightPanelWidth,
        isResizingPanels,
        csvDistinctColorsEnabled,
        setCsvDistinctColorsEnabled,
        editorWordWrap,
        setEditorWordWrap,
        editorMinimapEnabled,
        setEditorMinimapEnabled,
        editorFontSize,
        setEditorFontSize,
        findRequestToken,
        setFindRequestToken,
        replaceRequestToken,
        setReplaceRequestToken,
        focusLine,
        setFocusLine,
        previewSurfaceRef,
        modalStyle,
        presetConfig
    } = useFilePreviewChrome({
        resetKey: file.path,
        defaultStartExpanded,
        defaultLeftPanelOpen,
        defaultRightPanelOpen
    })

    const {
        terminalVisible,
        setTerminalVisible,
        terminalSessions,
        terminalState,
        terminalPanelPhase,
        terminalSessionId,
        terminalGroupKey,
        terminalGroupCwd,
        terminalHeight,
        terminalError,
        terminalShellLabel,
        terminalSessionCwd,
        currentTerminalSession,
        terminalTheme,
        terminalHostRef,
        shouldShowTerminalPanel,
        renderTerminalPanel,
        queueTerminalCommand,
        clearTerminalOutput,
        focusTerminal,
        createPreviewTerminalSession,
        restartPreviewTerminal,
        stopPreviewTerminalSession,
        selectPreviewTerminalSession,
        startTerminalResize
    } = useFilePreviewTerminal({
        canUsePreviewTerminal,
        file,
        projectPath,
        defaultShell: settings.defaultShell,
        accentColorPrimary: settings.accentColor.primary,
        themeKey: settings.theme,
        initialHeight: terminalInitialHeight,
        persistHeight: (height) => {
            if (settings.filePreviewTerminalPanelHeight === height) return
            updateSettings({ filePreviewTerminalPanelHeight: height })
        }
    })

    const {
        pythonRunState,
        pythonRunMode,
        setPythonRunMode,
        pythonOutputEntries,
        pythonInterpreter,
        pythonCommand,
        pythonOutputVisible,
        pythonOutputHeight,
        pythonShowTimestamps,
        setPythonShowTimestamps,
        pythonOutputScrollRef,
        handleRunPython,
        stopPythonRun,
        clearPythonOutput,
        startPythonOutputResize
    } = useFilePreviewPython({
        canRunPython,
        file,
        projectPath,
        mode,
        isDirty,
        defaultRunMode: settings.filePreviewPythonRunMode,
        handleSave,
        queueTerminalCommand,
        defaultShell: settings.defaultShell
    })

    useEffect(() => {
        const originalOverflow = document.body.style.overflow
        document.body.style.overflow = 'hidden'
        return () => {
            document.body.style.overflow = originalOverflow
        }
    }, [])

    useEffect(() => {
        if (settings.filePreviewPythonRunMode === pythonRunMode) return
        updateSettings({ filePreviewPythonRunMode: pythonRunMode })
    }, [pythonRunMode, settings.filePreviewPythonRunMode, updateSettings])

    const openMediaItem = useCallback(async (item: PreviewMediaItem) => {
        if (!onOpenLinkedPreview) return
        await onOpenLinkedPreview({ name: item.name, path: item.path }, item.extension, {
            mediaItems: mediaItems.map(({ name, path, extension }) => ({ name, path, extension }))
        })
    }, [mediaItems, onOpenLinkedPreview])

    const handleInternalMarkdownLink = useCallback(async (href: string) => {
        await navigateMarkdownLink({ href, filePath: file.path, navigate, openPreview: onOpenLinkedPreview })
    }, [file.path, navigate, onOpenLinkedPreview])

    const handleModeChange = useCallback(async (nextMode: 'preview' | 'edit') => {
        if (nextMode === mode) return
        if (nextMode === 'preview') {
            requestIntent('preview')
            return
        }
        if (!canEdit) return
        const loaded = await ensureEditableContentLoaded()
        if (!loaded) return
        if (isHtml) setHtmlViewMode('code')
        setMode('edit')
    }, [canEdit, ensureEditableContentLoaded, isHtml, mode, requestIntent, setHtmlViewMode, setMode])

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'e' && canEdit) {
                event.preventDefault()
                void handleModeChange(mode === 'edit' ? 'preview' : 'edit')
                return
            }
            if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's' && mode === 'edit') {
                event.preventDefault()
                void handleSave()
                return
            }
            if (event.key === 'Escape') {
                event.preventDefault()
                handleCloseRequest()
            }
        }

        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [canEdit, handleCloseRequest, handleModeChange, handleSave, mode])

    const handleOpenInBrowser = useCallback(async () => {
        try {
            await window.devscope.openFile(file.path)
        } catch (error) {
            console.error('Failed to open in browser:', error)
        }
    }, [file.path])

    const activeContent = mode === 'edit' ? draftContent : sourceContent
    const totalFileLines = countLines(activeContent)
    const isCompactHtmlViewport = isHtml && viewport !== 'responsive' && presetConfig.width <= 768
    const showPythonOutputPanel = canRunPython && (pythonOutputVisible || pythonRunState !== 'idle')
    const hasBottomPanel = showPythonOutputPanel || renderTerminalPanel
    const centerHtmlRenderedPreview = isHtml && htmlViewMode === 'rendered' && mode === 'preview' && !hasBottomPanel
    const flushResponsiveHtmlPreview = isHtml && htmlViewMode === 'rendered' && viewport === 'responsive' && !isExpanded
    const previewResetKey = isMediaPreviewType(file.type)
        ? `media:${viewport}:${htmlViewMode}:${mode}`
        : `${file.path}:${file.type}:${viewport}:${htmlViewMode}:${mode}`

    const localDiffPreview = useMemo(() => {
        if (mode !== 'edit' || !isDirty) return null
        return buildLocalDiffPreview(sourceContent, draftContent)
    }, [draftContent, isDirty, mode, sourceContent])

    const outlineItems = useMemo(
        () => extractOutlineItems(activeContent, file.type),
        [activeContent, file.type]
    )
    const longLineCount = useMemo(
        () => activeContent.split(/\r?\n/).filter((line) => line.length > 120).length,
        [activeContent]
    )
    const trailingWhitespaceCount = useMemo(
        () => activeContent.split(/\r?\n/).filter((line) => /[ \t]+$/.test(line)).length,
        [activeContent]
    )
    const jsonDiagnostic = useMemo(() => {
        if (file.type !== 'json') return null
        try {
            JSON.parse(activeContent)
            return { ok: true, message: 'Valid JSON structure' }
        } catch (error: any) {
            return { ok: false, message: error?.message || 'Invalid JSON syntax' }
        }
    }, [activeContent, file.type])

    const isEditorToolsEnabled = mode === 'edit'
    const getEditorToolButtonClass = (isActive = false) => cn(
        'inline-flex items-center justify-center rounded-md border px-2 py-1 text-[11px] font-medium transition-colors',
        isEditorToolsEnabled
            ? isActive
                ? 'border-sky-400/45 bg-sky-500/10 text-sky-200 hover:bg-sky-500/15'
                : 'border-sparkle-border-secondary bg-sparkle-bg text-sparkle-text-secondary hover:border-sparkle-border hover:bg-sparkle-card-hover hover:text-sparkle-text'
            : 'border-transparent bg-sparkle-bg/45 text-sparkle-text-muted/80 cursor-not-allowed opacity-70'
    )

    const handleOutlineItemSelect = useCallback((item: OutlineItem) => {
        if (mode === 'edit') {
            setFocusLine(item.line)
            return
        }
        if (file.type === 'md') {
            const root = previewSurfaceRef.current
            if (!root) return
            const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9\s_-]/g, '').replace(/\s+/g, ' ').trim()
            const targetLabel = normalize(item.label)
            const headings = Array.from(root.querySelectorAll('h1,h2,h3,h4,h5,h6')) as HTMLElement[]
            const directMatch = headings.find((heading) => normalize(heading.textContent || '') === targetLabel)
                || headings.find((heading) => normalize(heading.textContent || '').includes(targetLabel))
            if (directMatch) {
                directMatch.scrollIntoView({ block: 'center', behavior: 'smooth' })
                return
            }
        }

        setFocusLine(item.line)
    }, [file.type, mode, previewSurfaceRef, setFocusLine])

    const pythonOutputPanel = showPythonOutputPanel ? (
        <PreviewPythonOutputPanel fileName={file.name} visible={showPythonOutputPanel} runState={pythonRunState} interpreter={pythonInterpreter} command={pythonCommand} entries={pythonOutputEntries} height={pythonOutputHeight} showTimestamps={pythonShowTimestamps} scrollRef={pythonOutputScrollRef} onResizeStart={startPythonOutputResize} onToggleTimestamps={() => setPythonShowTimestamps((current) => !current)} onClear={clearPythonOutput} />
    ) : null

    const terminalPanel = renderTerminalPanel ? (
        <PreviewTerminalPanel
            render={renderTerminalPanel}
            phase={terminalPanelPhase}
            height={terminalHeight}
            state={terminalState}
            shellLabel={terminalShellLabel}
            sessions={terminalSessions}
            groupKey={terminalGroupKey}
            groupCwd={terminalGroupCwd}
            sessionCwd={terminalSessionCwd}
            projectPath={projectPath}
            filePath={file.path}
            currentSession={currentTerminalSession}
            themeBackground={terminalTheme.background}
            hostRef={terminalHostRef}
            onHostInteract={focusTerminal}
            error={terminalError}
            onResizeStart={startTerminalResize}
            onNew={() => { void createPreviewTerminalSession() }}
            onClear={clearTerminalOutput}
            onRestart={() => { void restartPreviewTerminal() }}
            onStop={(sessionId) => { void stopPreviewTerminalSession(sessionId) }}
            onMinimize={() => setTerminalVisible(false)}
            onSelect={selectPreviewTerminalSession}
        />
    ) : null

    const modalContent = (
        <PreviewModalLayout
            file={file}
            loading={loading}
            truncated={truncated}
            size={size ?? undefined}
            previewBytes={previewBytes ?? undefined}
            projectPath={projectPath}
            mediaItems={mediaItems}
            openMediaItem={openMediaItem}
            onInternalLinkClick={handleInternalMarkdownLink}
            mode={mode}
            isExpanded={isExpanded}
            canEdit={canEdit}
            isDirty={isDirty}
            isSaving={isSaving}
            leftPanelOpen={leftPanelOpen}
            rightPanelOpen={rightPanelOpen}
            leftPanelWidth={leftPanelWidth}
            rightPanelWidth={rightPanelWidth}
            isResizingPanels={isResizingPanels}
            setFindRequestToken={setFindRequestToken}
            setReplaceRequestToken={setReplaceRequestToken}
            findRequestToken={findRequestToken}
            replaceRequestToken={replaceRequestToken}
            editorWordWrap={editorWordWrap}
            setEditorWordWrap={setEditorWordWrap}
            editorMinimapEnabled={editorMinimapEnabled}
            setEditorMinimapEnabled={setEditorMinimapEnabled}
            editorFontSize={editorFontSize}
            setEditorFontSize={setEditorFontSize}
            focusLine={focusLine}
            saveError={saveError}
            sourceContent={sourceContent}
            draftContent={draftContent}
            onDraftContentChange={(nextValue) => {
                setDraftContent(nextValue)
                if (saveError) setSaveError(null)
            }}
            loadingEditableContent={loadingEditableContent}
            viewport={viewport}
            setViewport={setViewport}
            htmlViewMode={htmlViewMode}
            setHtmlViewMode={setHtmlViewMode}
            csvDistinctColorsEnabled={csvDistinctColorsEnabled}
            setCsvDistinctColorsEnabled={setCsvDistinctColorsEnabled}
            pythonRunState={pythonRunState}
            pythonRunMode={pythonRunMode}
            pythonHasOutput={pythonOutputEntries.length > 0}
            setPythonRunMode={setPythonRunMode}
            canRunPython={canRunPython}
            onRunPython={handleRunPython}
            onStopPython={stopPythonRun}
            onClearPythonOutput={clearPythonOutput}
            canUsePreviewTerminal={canUsePreviewTerminal}
            terminalVisible={shouldShowTerminalPanel}
            onTogglePreviewTerminal={() => setTerminalVisible((current) => !current)}
            onOpenInBrowser={handleOpenInBrowser}
            gitDiffText={gitDiffText}
            gitDiffSummary={gitDiffSummary}
            liveDiffPreview={localDiffPreview}
            totalFileLines={totalFileLines}
            handleModeChange={handleModeChange}
            handleSave={handleSave}
            handleRevert={() => { setDraftContent(sourceContent); setSaveError(null) }}
            handleCloseRequest={handleCloseRequest}
            setIsExpanded={setIsExpanded}
            setLeftPanelOpen={setLeftPanelOpen}
            setRightPanelOpen={setRightPanelOpen}
            modalStyle={modalStyle}
            previewSurfaceRef={previewSurfaceRef}
            previewResetKey={previewResetKey}
            lineMarkersOverride={localDiffPreview?.markers}
            presetConfig={presetConfig}
            isCsv={isCsv}
            isHtml={isHtml}
            isCompactHtmlViewport={isCompactHtmlViewport}
            centerHtmlRenderedPreview={centerHtmlRenderedPreview}
            flushResponsiveHtmlPreview={flushResponsiveHtmlPreview}
            hasBottomPanel={hasBottomPanel}
            outlineItems={outlineItems}
            onOutlineSelect={handleOutlineItemSelect}
            longLineCount={longLineCount}
            trailingWhitespaceCount={trailingWhitespaceCount}
            jsonDiagnostic={jsonDiagnostic}
            isEditorToolsEnabled={isEditorToolsEnabled}
            getEditorToolButtonClass={getEditorToolButtonClass}
            pythonPanel={pythonOutputPanel}
            terminalPanel={terminalPanel}
            showUnsavedModal={showUnsavedModal}
            conflictModifiedAt={conflictModifiedAt}
            dismissUnsaved={dismissUnsavedChanges}
            discardUnsaved={discardUnsavedChanges}
            confirmUnsaved={confirmUnsavedChanges}
            dismissConflict={() => setConflictModifiedAt(null)}
            reloadConflict={async () => { if (await reloadFromDisk()) setConflictModifiedAt(null) }}
            overwriteConflict={async () => { if (await overwriteOnConflict()) setConflictModifiedAt(null) }}
        />
    )

    if (typeof document === 'undefined') {
        return modalContent
    }

    return createPortal(modalContent, document.body)
}

export { useFilePreview }

export default FilePreviewModal
