import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { AssistantMessage } from '@shared/assistant/contracts'
import { FilePreviewModal } from '@/components/ui/FilePreviewModal'
import type { PreviewOpenOptions } from '@/components/ui/file-preview/types'
import { useFilePreview } from '@/components/ui/file-preview/useFilePreview'
import { ASSISTANT_MAIN_SIDEBAR_COLLAPSED_STORAGE_KEY, useSidebar } from '@/components/layout/Sidebar'
import { useAssistantStoreActions, useAssistantStoreSelector } from '@/lib/assistant/store'
import { getActiveAssistantThread, getSelectedAssistantSession } from '@/lib/assistant/selectors'
import { ConnectedAssistantSessionsRail } from './AssistantConnectedSessionsRail'
import { AssistantConversationPane } from './AssistantConversationPane'
import { AssistantDiffPanel } from './AssistantDiffPanel'
import { ConnectedAssistantPlanPanel } from './ConnectedAssistantPlanPanel'
import { ConnectedAssistantThreadDetailsPanel } from './ConnectedAssistantThreadDetailsPanel'
import { DeleteHistoryConfirm } from './AssistantPageHelpers'
import type { AssistantDiffTarget } from './assistant-diff-types'
import { openAssistantFileTarget } from './assistant-file-navigation'
import {
    useAssistantPageSidebarState,
    type AssistantRightPanelMode
} from './useAssistantPageSidebarState'

type AssistantPageShellSelection = {
    bootstrapped: boolean
    assistantAvailable: boolean
    assistantConnected: boolean
    commandPending: boolean
    selectedSessionId: string | null
    activeThreadId: string | null
    selectedProjectPath: string
}

function areAssistantPageShellSelectionsEqual(left: AssistantPageShellSelection, right: AssistantPageShellSelection): boolean {
    return left.bootstrapped === right.bootstrapped
        && left.assistantAvailable === right.assistantAvailable
        && left.assistantConnected === right.assistantConnected
        && left.commandPending === right.commandPending
        && left.selectedSessionId === right.selectedSessionId
        && left.activeThreadId === right.activeThreadId
        && left.selectedProjectPath === right.selectedProjectPath
}

function readAssistantMainSidebarCollapsedPreference(): boolean {
    try {
        const stored = localStorage.getItem(ASSISTANT_MAIN_SIDEBAR_COLLAPSED_STORAGE_KEY)
        return stored == null ? true : stored === 'true'
    } catch {
        return true
    }
}

export default function AssistantPage() {
    const navigate = useNavigate()
    const actions = useAssistantStoreActions()
    const shell = useAssistantStoreSelector<AssistantPageShellSelection>((state) => {
        const selectedSession = getSelectedAssistantSession(state.snapshot)
        const activeThread = getActiveAssistantThread(selectedSession)

        return {
            bootstrapped: state.hydrated,
            assistantAvailable: state.status.available,
            assistantConnected: state.status.connected,
            commandPending: state.commandPending,
            selectedSessionId: selectedSession?.id || null,
            activeThreadId: activeThread?.id || null,
            selectedProjectPath: String(selectedSession?.projectPath || activeThread?.cwd || '').trim()
        }
    }, areAssistantPageShellSelectionsEqual)
    const preview = useFilePreview()
    const { isCollapsed: mainSidebarCollapsed, setIsCollapsed: setMainSidebarCollapsed } = useSidebar()
    const autoConnectAttemptedSessionRef = useRef<string | null>(null)
    const mainSidebarBeforeAssistantRef = useRef<boolean | null>(null)
    const previousMainSidebarCollapsedRef = useRef(mainSidebarCollapsed)
    const autoCollapsedInnerSidebarRef = useRef(false)
    const previousRightPanelModeRef = useRef<AssistantRightPanelMode>('none')
    const {
        leftSidebarCollapsed,
        setLeftSidebarCollapsed,
        leftSidebarWidth,
        setLeftSidebarWidth,
        railMode,
        setRailMode,
        rightPanelMode,
        setRightPanelMode
    } = useAssistantPageSidebarState()
    const [selectedDiffTarget, setSelectedDiffTarget] = useState<AssistantDiffTarget | null>(null)
    const [pendingMessageDelete, setPendingMessageDelete] = useState<AssistantMessage | null>(null)
    const [deletingMessageId, setDeletingMessageId] = useState<string | null>(null)

    useEffect(() => {
        mainSidebarBeforeAssistantRef.current = mainSidebarCollapsed
        const preferredCollapsed = readAssistantMainSidebarCollapsedPreference()
        if (mainSidebarCollapsed !== preferredCollapsed) {
            setMainSidebarCollapsed(preferredCollapsed)
        }

        return () => {
            const previousCollapsed = mainSidebarBeforeAssistantRef.current
            mainSidebarBeforeAssistantRef.current = null
            if (typeof previousCollapsed === 'boolean') {
                setMainSidebarCollapsed(previousCollapsed)
            }
        }
    // Intentionally run on assistant page mount/unmount only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    useEffect(() => {
        const previousMode = previousRightPanelModeRef.current
        previousRightPanelModeRef.current = rightPanelMode

        if (rightPanelMode !== 'none') {
            if (previousMode === 'none' && !leftSidebarCollapsed && !mainSidebarCollapsed) {
                autoCollapsedInnerSidebarRef.current = true
                setLeftSidebarCollapsed(true)
            }
            return
        }

        if (previousMode !== 'none' && autoCollapsedInnerSidebarRef.current) {
            autoCollapsedInnerSidebarRef.current = false
            setLeftSidebarCollapsed(false)
        }
    }, [leftSidebarCollapsed, mainSidebarCollapsed, rightPanelMode, setLeftSidebarCollapsed])

    useEffect(() => {
        const previousMainCollapsed = previousMainSidebarCollapsedRef.current
        previousMainSidebarCollapsedRef.current = mainSidebarCollapsed

        if (!previousMainCollapsed || mainSidebarCollapsed) return
        if (leftSidebarCollapsed || rightPanelMode === 'none') return

        autoCollapsedInnerSidebarRef.current = true
        setLeftSidebarCollapsed(true)
    }, [leftSidebarCollapsed, mainSidebarCollapsed, rightPanelMode, setLeftSidebarCollapsed])

    useEffect(() => {
        if (!shell.bootstrapped || !shell.assistantAvailable || shell.assistantConnected || shell.commandPending) return
        const sessionId = shell.selectedSessionId
        if (!sessionId || autoConnectAttemptedSessionRef.current === sessionId) return
        autoConnectAttemptedSessionRef.current = sessionId
        void actions.connect(sessionId)
    }, [actions, shell.assistantAvailable, shell.assistantConnected, shell.bootstrapped, shell.commandPending, shell.selectedSessionId])

    useEffect(() => {
        setSelectedDiffTarget(null)
        if (rightPanelMode === 'diff') setRightPanelMode('none')
    }, [setRightPanelMode, shell.activeThreadId, shell.selectedSessionId])

    const openAssistantTarget = useCallback(async (target: string, startInEditMode = false) => {
        const opened = await openAssistantFileTarget({
            target,
            projectPath: shell.selectedProjectPath,
            navigate,
            openPreview: preview.openPreview,
            previewOptions: startInEditMode ? { startInEditMode: true } : undefined
        })
        return opened
    }, [navigate, preview.openPreview, shell.selectedProjectPath])

    const handleOpenAssistantInternalLink = useCallback(async (href: string) => {
        await openAssistantTarget(href)
    }, [openAssistantTarget])

    const handleOpenEditedFile = useCallback(async (filePath: string) => {
        await openAssistantTarget(filePath, true)
    }, [openAssistantTarget])

    const handleOpenAttachmentPreview = useCallback(async (
        file: { name: string; path: string },
        ext: string,
        options?: PreviewOpenOptions
    ) => {
        await preview.openPreview(file, ext, options)
    }, [preview.openPreview])

    const handleViewActivityDiff = useCallback((target: AssistantDiffTarget) => {
        setSelectedDiffTarget(target)
        setRightPanelMode('diff')
    }, [setRightPanelMode])

    const handleDeleteUserMessage = useCallback(async () => {
        if (!pendingMessageDelete) return
        try {
            setDeletingMessageId(pendingMessageDelete.id)
            const result = await actions.deleteMessageResult(pendingMessageDelete.id, shell.selectedSessionId || undefined)
            if (result.success) setPendingMessageDelete(null)
        } finally {
            setDeletingMessageId(null)
        }
    }, [actions, pendingMessageDelete, shell.selectedSessionId])

    const handleToggleAssistantLeftSidebar = useCallback(() => {
        autoCollapsedInnerSidebarRef.current = false
        setLeftSidebarCollapsed((current) => {
            const nextCollapsed = !current
            if (!nextCollapsed && rightPanelMode !== 'none' && !mainSidebarCollapsed) {
                setMainSidebarCollapsed(true)
            }
            return nextCollapsed
        })
    }, [mainSidebarCollapsed, rightPanelMode, setLeftSidebarCollapsed, setMainSidebarCollapsed])

    const handleToggleRightSidebar = useCallback(() => {
        setRightPanelMode((current) => current === 'details' ? 'none' : 'details')
    }, [setRightPanelMode])

    const handleTogglePlanPanel = useCallback(() => {
        setRightPanelMode((current) => current === 'plan' ? 'none' : 'plan')
    }, [setRightPanelMode])

    const handleCloseRightPanel = useCallback(() => {
        setRightPanelMode('none')
    }, [setRightPanelMode])

    const handleCloseDiffPanel = useCallback(() => {
        setRightPanelMode('none')
        setSelectedDiffTarget(null)
    }, [setRightPanelMode])

    const handleShowThreadDetailsPanel = useCallback(() => {
        setRightPanelMode('details')
    }, [setRightPanelMode])

    const handleShowPlanPanel = useCallback(() => {
        setRightPanelMode('plan')
    }, [setRightPanelMode])

    const handleCancelPendingMessageDelete = useCallback(() => {
        if (deletingMessageId) return
        setPendingMessageDelete(null)
    }, [deletingMessageId])

    const sessionSidebarWidth = leftSidebarCollapsed ? 0 : Math.max(180, Math.min(520, Math.round(leftSidebarWidth)))
    const compactRightPanel = !leftSidebarCollapsed && rightPanelMode !== 'none'

    return (
        <div className="-m-6 flex h-[calc(100vh-46px)] min-h-[calc(100vh-46px)] flex-col overflow-hidden animate-fadeIn [--accent-primary:var(--color-primary)] [--accent-secondary:var(--color-secondary)]">
            <div className="min-h-0 flex-1 overflow-hidden">
                <div className="flex h-full">
                    <ConnectedAssistantSessionsRail
                        collapsed={leftSidebarCollapsed}
                        width={sessionSidebarWidth}
                        railMode={railMode}
                        onRailModeChange={setRailMode}
                        onWidthChange={setLeftSidebarWidth}
                    />
                    <div className="flex min-w-0 flex-1">
                        <AssistantConversationPane
                            rightPanelOpen={rightPanelMode !== 'none'}
                            rightPanelMode={rightPanelMode}
                            deletingMessageId={deletingMessageId}
                            leftSidebarCollapsed={leftSidebarCollapsed}
                            onToggleLeftSidebar={handleToggleAssistantLeftSidebar}
                            onRequestDeleteUserMessage={setPendingMessageDelete}
                            onToggleRightSidebar={handleToggleRightSidebar}
                            onTogglePlanPanel={handleTogglePlanPanel}
                            onOpenAssistantLink={handleOpenAssistantInternalLink}
                            onOpenAttachmentPreview={handleOpenAttachmentPreview}
                            onOpenEditedFile={handleOpenEditedFile}
                            onViewDiff={handleViewActivityDiff}
                        />
                        <AssistantDiffPanel
                            open={rightPanelMode === 'diff'}
                            compact={compactRightPanel}
                            selectedDiff={selectedDiffTarget}
                            onClose={handleCloseDiffPanel}
                        />
                        <ConnectedAssistantPlanPanel
                            open={rightPanelMode === 'plan'}
                            compact={compactRightPanel}
                            onClose={handleCloseRightPanel}
                            onShowThreadDetails={handleShowThreadDetailsPanel}
                            onOpenInternalLink={handleOpenAssistantInternalLink}
                        />
                        <ConnectedAssistantThreadDetailsPanel
                            open={rightPanelMode === 'details'}
                            compact={compactRightPanel}
                            onClose={handleCloseRightPanel}
                            onShowPlan={handleShowPlanPanel}
                        />
                    </div>
                </div>
            </div>
            <DeleteHistoryConfirm
                isOpen={Boolean(pendingMessageDelete)}
                deleting={Boolean(deletingMessageId)}
                onConfirm={() => void handleDeleteUserMessage()}
                onCancel={handleCancelPendingMessageDelete}
            />
            {preview.previewFile ? (
                <FilePreviewModal
                    file={preview.previewFile}
                    content={preview.previewContent}
                    loading={preview.loadingPreview}
                    truncated={preview.previewTruncated}
                    size={preview.previewSize}
                    previewBytes={preview.previewBytes}
                    modifiedAt={preview.previewModifiedAt}
                    projectPath={shell.selectedProjectPath || undefined}
                    onOpenLinkedPreview={preview.openPreview}
                    mediaItems={preview.previewMediaItems}
                    onClose={preview.closePreview}
                />
            ) : null}
        </div>
    )
}
