import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { AssistantActivity, AssistantMessage, AssistantTurnUsage } from '@shared/assistant/contracts'
import { FilePreviewModal } from '@/components/ui/FilePreviewModal'
import { useFilePreview } from '@/components/ui/file-preview/useFilePreview'
import { useAssistantStore } from '@/lib/assistant/store'
import { isAssistantThreadActivelyWorking } from '@/lib/assistant/selectors'
import { ASSISTANT_MAIN_SIDEBAR_COLLAPSED_STORAGE_KEY, useSidebar } from '@/components/layout/Sidebar'
import { ConnectedAssistantSessionsRail } from './AssistantConnectedSessionsRail'
import { AssistantConversationPane } from './AssistantConversationPane'
import { AssistantDiffPanel } from './AssistantDiffPanel'
import { AssistantPlanPanel } from './AssistantPlanPanel'
import {
    DeleteHistoryConfirm,
    formatCompactMetric,
    formatContextMetric,
    getIssueActivities,
    buildIssueLogEntry,
    copyTextToClipboard,
    IssueLogDetailsModal,
    resolveUsageMetricTone,
    type LogDetailsTab,
    type UsageMetricTone
} from './AssistantPageHelpers'
import { AssistantThreadDetailsPanel } from './AssistantThreadDetailsPanel'
import type { AssistantDiffTarget } from './assistant-diff-types'
import { getAssistantActivePlanProgress, hasAssistantPlanPanelContent } from './assistant-plan-utils'
import {
    subscribeAssistantComposerSessionState,
    readAssistantComposerSessionState,
    type AssistantComposerSessionState
} from './assistant-composer-session-state'
import { formatAssistantModelLabel } from './assistant-model-labels'
import {
    SIDEBAR_EFFORT_LABELS,
    useAssistantPageSidebarState,
    type AssistantRightPanelMode
} from './useAssistantPageSidebarState'
import { getAssistantLinkBaseFilePath, openAssistantFileTarget } from './assistant-file-navigation'
import { useAssistantPageTimelineScroll } from './useAssistantPageTimelineScroll'

type IssueActivityGroup = {
    activity: AssistantActivity
    activities: AssistantActivity[]
    count: number
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
    const controller = useAssistantStore()
    const preview = useFilePreview()
    const { isCollapsed: mainSidebarCollapsed, setIsCollapsed: setMainSidebarCollapsed } = useSidebar()
    const headerMenuRef = useRef<HTMLDivElement | null>(null)
    const autoConnectAttemptedSessionRef = useRef<string | null>(null)
    const lastUsageByThreadRef = useRef<Map<string, AssistantTurnUsage>>(new Map())
    const mainSidebarBeforeAssistantRef = useRef<boolean | null>(null)
    const previousMainSidebarCollapsedRef = useRef(mainSidebarCollapsed)
    const autoCollapsedInnerSidebarRef = useRef(false)
    const previousRightPanelModeRef = useRef<AssistantRightPanelMode>('none')
    const {
        leftSidebarCollapsed,
        setLeftSidebarCollapsed,
        leftSidebarWidth,
        setLeftSidebarWidth,
        rightPanelMode,
        setRightPanelMode
    } = useAssistantPageSidebarState()
    const [showHeaderMenu, setShowHeaderMenu] = useState(false)
    const [selectedLogActivity, setSelectedLogActivity] = useState<AssistantActivity | null>(null)
    const [selectedDiffTarget, setSelectedDiffTarget] = useState<AssistantDiffTarget | null>(null)
    const [pendingMessageDelete, setPendingMessageDelete] = useState<AssistantMessage | null>(null)
    const [deletingMessageId, setDeletingMessageId] = useState<string | null>(null)
    const [logDetailsTab, setLogDetailsTab] = useState<LogDetailsTab>('rendered')
    const [copiedLogId, setCopiedLogId] = useState<string | null>(null)
    const [copyErrorByLogId, setCopyErrorByLogId] = useState<Record<string, string | null>>({})
    const [projectPathCopied, setProjectPathCopied] = useState(false)
    const [showFullProjectPath, setShowFullProjectPath] = useState(false)
    const [allLogsCopied, setAllLogsCopied] = useState(false)
    const [clearingLogs, setClearingLogs] = useState(false)
    const [logsExpanded, setLogsExpanded] = useState(false)
    const [composerSessionState, setComposerSessionState] = useState<AssistantComposerSessionState>({})

    useEffect(() => {
        const selectedSessionId = controller.selectedSession?.id || null
        setComposerSessionState(readAssistantComposerSessionState(selectedSessionId))
    }, [controller.selectedSession?.id])

    useEffect(() => subscribeAssistantComposerSessionState((updatedSessionId, nextState) => {
        if (!controller.selectedSession?.id || updatedSessionId !== controller.selectedSession.id) return
        setComposerSessionState(nextState)
    }), [controller.selectedSession?.id])

    useEffect(() => {
        const threadId = controller.activeThread?.id
        const usage = controller.activeThread?.latestTurn?.usage
        if (!threadId || !usage) return
        lastUsageByThreadRef.current.set(threadId, usage)
    }, [controller.activeThread?.id, controller.activeThread?.latestTurn?.usage])

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
        if (!showHeaderMenu) return
        const handlePointerDown = (event: MouseEvent) => {
            if (!headerMenuRef.current?.contains(event.target as Node)) setShowHeaderMenu(false)
        }
        const handleEscape = (event: KeyboardEvent) => {
            if (event.key === 'Escape') setShowHeaderMenu(false)
        }
        document.addEventListener('mousedown', handlePointerDown)
        window.addEventListener('keydown', handleEscape)
        return () => {
            document.removeEventListener('mousedown', handlePointerDown)
            window.removeEventListener('keydown', handleEscape)
        }
    }, [showHeaderMenu])

    const selectedProjectPath = String(controller.selectedSession?.projectPath || controller.activeThread?.cwd || '').trim()
    const assistantMessageFilePath = useMemo(
        () => getAssistantLinkBaseFilePath(selectedProjectPath),
        [selectedProjectPath]
    )
    const planPanelAvailable = hasAssistantPlanPanelContent(controller.activePlan, controller.latestProposedPlan)
    const activePlanProgress = getAssistantActivePlanProgress(controller.activePlan, controller.activeThread?.latestTurn || null)
    const planProgressLabel = activePlanProgress ? `${activePlanProgress.currentStepNumber}/${activePlanProgress.totalSteps}` : null
    const planIsComplete = activePlanProgress?.isComplete === true
    const shouldShowWorkingIndicator = isAssistantThreadActivelyWorking(controller.activeThread)
        && !controller.timelineMessages.some((message) => message.role === 'assistant' && message.streaming)
    const selectedProjectLabel = selectedProjectPath
        ? selectedProjectPath.split(/[\\/]/).filter(Boolean).pop() || selectedProjectPath
        : 'not set'
    const selectedProjectPathWithTilde = selectedProjectPath
        ? selectedProjectPath.replace(/^[A-Z]:\\Users\\[^\\]+/, '~').replace(/\\/g, '/')
        : ''
    const displayProjectPath = showFullProjectPath ? selectedProjectPathWithTilde : selectedProjectLabel
    const availableModels = useMemo(() => {
        if (controller.knownModels.length > 0) return controller.knownModels
        const activeModel = String(controller.activeThread?.model || '').trim()
        return activeModel ? [{ id: activeModel, label: activeModel }] : []
    }, [controller.activeThread?.model, controller.knownModels])
    const sidebarSelectedModel = formatAssistantModelLabel(composerSessionState.model || controller.activeThread?.model || availableModels[0]?.id || '')
    const latestTurnUsage = useMemo(() => {
        const threadId = controller.activeThread?.id
        if (!threadId) return null
        return controller.activeThread?.latestTurn?.usage
            || lastUsageByThreadRef.current.get(threadId)
            || null
    }, [controller.activeThread?.id, controller.activeThread?.latestTurn?.usage])
    const contextUsedTokens = latestTurnUsage?.totalTokens ?? null
    const contextWindowTokens = latestTurnUsage?.modelContextWindow ?? null
    const sessionSidebarWidth = leftSidebarCollapsed ? 0 : Math.max(180, Math.min(520, Math.round(leftSidebarWidth)))
    const sidebarMetricChips = [
        {
            label: 'Input tokens',
            value: latestTurnUsage?.inputTokens != null ? formatCompactMetric(latestTurnUsage.inputTokens) : null,
            tone: resolveUsageMetricTone(latestTurnUsage?.inputTokens, contextWindowTokens, { normal: 12_000, high: 40_000 })
        },
        {
            label: 'Output tokens',
            value: latestTurnUsage?.outputTokens != null ? formatCompactMetric(latestTurnUsage.outputTokens) : null,
            tone: resolveUsageMetricTone(latestTurnUsage?.outputTokens, contextWindowTokens, { normal: 4_000, high: 16_000 })
        },
        {
            label: 'Reasoning tokens',
            value: latestTurnUsage?.reasoningOutputTokens != null ? formatCompactMetric(latestTurnUsage.reasoningOutputTokens) : null,
            tone: resolveUsageMetricTone(latestTurnUsage?.reasoningOutputTokens, contextWindowTokens, { normal: 4_000, high: 16_000 })
        },
        {
            label: 'Cached input',
            value: latestTurnUsage?.cachedInputTokens != null ? formatCompactMetric(latestTurnUsage.cachedInputTokens) : null,
            tone: resolveUsageMetricTone(latestTurnUsage?.cachedInputTokens, contextWindowTokens, { normal: 8_000, high: 24_000 })
        },
        {
            label: 'Total tokens',
            value: latestTurnUsage?.totalTokens != null ? formatCompactMetric(latestTurnUsage.totalTokens) : null,
            tone: resolveUsageMetricTone(latestTurnUsage?.totalTokens, contextWindowTokens, { normal: 16_000, high: 48_000 })
        },
        {
            label: 'Context usage',
            value: contextWindowTokens ? formatContextMetric(contextUsedTokens, contextWindowTokens) : null,
            tone: resolveUsageMetricTone(contextUsedTokens, contextWindowTokens, { normal: 0, high: 0 })
        }
    ].filter((entry): entry is { label: string; value: string; tone: UsageMetricTone } => Boolean(entry.value))
    const selectedThinkingLabel = SIDEBAR_EFFORT_LABELS[composerSessionState.effort || 'high']
    const selectedSpeedLabel = composerSessionState.fastModeEnabled ? 'Fast' : 'Standard'
    const selectedRuntimeMode = composerSessionState.runtimeMode || controller.activeThread?.runtimeMode || 'approval-required'
    const selectedRuntimeLabel = selectedRuntimeMode === 'full-access' ? 'Full access' : 'Supervised'
    const contextUsedDisplay = contextUsedTokens != null ? formatCompactMetric(contextUsedTokens) : controller.activeThread?.latestTurn ? 'Not reported' : 'No turn yet'
    const contextAvailableDisplay = contextWindowTokens != null ? formatCompactMetric(contextWindowTokens) : controller.activeThread?.latestTurn ? 'Not reported' : 'No turn yet'
    const contextPercentage = contextUsedTokens != null && contextWindowTokens != null && contextWindowTokens > 0
        ? Math.round((contextUsedTokens / contextWindowTokens) * 100)
        : null
    const contextColor = contextPercentage != null
        ? contextPercentage >= 90 ? 'text-red-300' : contextPercentage >= 70 ? 'text-amber-300' : 'text-emerald-300'
        : 'text-sparkle-text'
    const lastTimelineMessage = controller.timelineMessages[controller.timelineMessages.length - 1] || null
    const latestTimelineActivity = controller.activityFeed[0] || null
    const shouldComputeIssueActivities = rightPanelMode === 'details' || Boolean(selectedLogActivity)
    const issueActivities = useMemo(() => {
        if (!shouldComputeIssueActivities) return []

        const nextActivities = [...getIssueActivities(controller.activityFeed)]
        if (controller.commandError) {
            nextActivities.unshift({
                id: `assistant-local-error-${controller.commandError}`,
                kind: 'ui.command-error',
                tone: 'error',
                summary: 'Assistant command failed',
                detail: controller.commandError,
                turnId: controller.activeThread?.latestTurn?.id || null,
                createdAt: latestTimelineActivity?.createdAt || controller.activeThread?.updatedAt || controller.selectedSession?.updatedAt || new Date(0).toISOString()
            })
        }
        return nextActivities
    }, [
        controller.activityFeed,
        controller.commandError,
        controller.activeThread?.latestTurn?.id,
        controller.activeThread?.updatedAt,
        controller.selectedSession?.updatedAt,
        latestTimelineActivity?.createdAt,
        shouldComputeIssueActivities
    ])
    const groupedIssueActivities = useMemo<IssueActivityGroup[]>(() => {
        const groups: IssueActivityGroup[] = []
        for (const activity of issueActivities) {
            const lastGroup = groups[groups.length - 1]
            if (lastGroup && lastGroup.activity.summary === activity.summary && lastGroup.activity.tone === activity.tone) {
                lastGroup.count += 1
                lastGroup.activities.push(activity)
            } else {
                groups.push({ activity, activities: [activity], count: 1 })
            }
        }
        return groups
    }, [issueActivities])
    const latestIssueGroup = groupedIssueActivities[0] || null
    const olderIssueGroups = groupedIssueActivities.slice(1)
    const { timelineScrollRef, onScrollTimeline, onScrollToBottom } = useAssistantPageTimelineScroll({
        sessionId: controller.selectedSession?.id || null,
        threadId: controller.activeThread?.id || null,
        loading: controller.loading,
        timelineMessageCount: controller.timelineMessages.length,
        lastTimelineMessageId: lastTimelineMessage?.id || null,
        lastTimelineMessageUpdatedAt: lastTimelineMessage?.updatedAt || null,
        activityFeedCount: controller.activityFeed.length,
        latestTimelineActivityId: latestTimelineActivity?.id || null,
        latestTimelineActivityCreatedAt: latestTimelineActivity?.createdAt || null,
        shouldShowWorkingIndicator,
        latestTurnStartedAt: controller.activeThread?.latestTurn?.startedAt || null,
        latestTurnState: controller.activeThread?.latestTurn?.state || null,
        threadState: controller.activeThread?.state || null
    })

    useEffect(() => {
        if (olderIssueGroups.length === 0 && logsExpanded) setLogsExpanded(false)
    }, [logsExpanded, olderIssueGroups.length])

    useEffect(() => {
        if (rightPanelMode === 'plan' && !planPanelAvailable) setRightPanelMode('none')
    }, [planPanelAvailable, rightPanelMode])

    useEffect(() => {
        if (rightPanelMode === 'diff' && !selectedDiffTarget) setRightPanelMode('none')
    }, [rightPanelMode, selectedDiffTarget])

    useEffect(() => {
        setSelectedDiffTarget(null)
        if (rightPanelMode === 'diff') setRightPanelMode('none')
    }, [controller.selectedSession?.id, controller.activeThread?.id])

    useEffect(() => {
        if (!controller.bootstrapped || !controller.status?.available || controller.status?.connected || controller.commandPending) return
        const sessionId = controller.selectedSession?.id || null
        if (!sessionId || autoConnectAttemptedSessionRef.current === sessionId) return
        autoConnectAttemptedSessionRef.current = sessionId
        void controller.connect(sessionId)
    }, [
        controller.bootstrapped,
        controller.commandPending,
        controller.selectedSession?.id,
        controller.status?.available,
        controller.status?.connected,
        controller.connect
    ])

    const openAssistantTarget = useCallback(async (target: string, startInEditMode = false) => {
        const opened = await openAssistantFileTarget({
            target,
            projectPath: selectedProjectPath,
            navigate,
            openPreview: preview.openPreview,
            previewOptions: startInEditMode ? { startInEditMode: true } : undefined
        })
        return opened
    }, [navigate, preview.openPreview, selectedProjectPath])

    const handleOpenAssistantInternalLink = useCallback(async (href: string) => {
        await openAssistantTarget(href)
    }, [openAssistantTarget])

    const handleOpenEditedFile = useCallback(async (filePath: string) => {
        await openAssistantTarget(filePath, true)
    }, [openAssistantTarget])

    const handleViewActivityDiff = useCallback((target: AssistantDiffTarget) => {
        setSelectedDiffTarget(target)
        setRightPanelMode('diff')
    }, [])

    const handleDeleteUserMessage = async () => {
        if (!pendingMessageDelete) return
        try {
            setDeletingMessageId(pendingMessageDelete.id)
            const result = await controller.deleteMessageResult(pendingMessageDelete.id, controller.selectedSession?.id)
            if (result.success) setPendingMessageDelete(null)
        } finally {
            setDeletingMessageId(null)
        }
    }
    const handleCopyProjectPath = async () => {
        if (!selectedProjectPath) return
        try {
            await copyTextToClipboard(selectedProjectPath)
            setProjectPathCopied(true)
            window.setTimeout(() => setProjectPathCopied(false), 1600)
        } catch {}
    }
    const handleCopyLog = async (activity: AssistantActivity) => {
        try {
            await copyTextToClipboard(JSON.stringify(buildIssueLogEntry(activity), null, 2))
            setCopiedLogId(activity.id)
            setCopyErrorByLogId((current) => ({ ...current, [activity.id]: null }))
            window.setTimeout(() => setCopiedLogId((current) => current === activity.id ? null : current), 1600)
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to copy to clipboard'
            setCopyErrorByLogId((current) => ({ ...current, [activity.id]: message }))
            window.setTimeout(() => {
                setCopyErrorByLogId((current) => {
                    const next = { ...current }
                    if (next[activity.id] === message) delete next[activity.id]
                    return next
                })
            }, 2400)
        }
    }
    const handleCopyAllLogs = async () => {
        if (issueActivities.length === 0) return
        try {
            const allLogs = issueActivities.map((activity) => JSON.stringify(buildIssueLogEntry(activity), null, 2)).join('\n\n---\n\n')
            await copyTextToClipboard(allLogs)
            setAllLogsCopied(true)
            window.setTimeout(() => setAllLogsCopied(false), 1600)
        } catch {}
    }
    const handleClearLogs = async () => {
        if (!controller.selectedSession?.id || !latestIssueGroup || clearingLogs) return
        try {
            setClearingLogs(true)
            setLogsExpanded(false)
            const result = await controller.clearLogsResult(controller.selectedSession.id)
            if (result.success) controller.clearCommandError()
        } finally {
            setClearingLogs(false)
        }
    }

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

    return (
        <div className="-m-6 flex h-[calc(100vh-46px)] min-h-[calc(100vh-46px)] flex-col overflow-hidden animate-fadeIn [--accent-primary:var(--color-primary)] [--accent-secondary:var(--color-secondary)]">
            <div className="min-h-0 flex-1 overflow-hidden">
                <div className="flex h-full">
                    <ConnectedAssistantSessionsRail
                        collapsed={leftSidebarCollapsed}
                        width={sessionSidebarWidth}
                        onWidthChange={setLeftSidebarWidth}
                    />
                    <div className="flex min-w-0 flex-1">
                        <AssistantConversationPane
                            rightPanelOpen={rightPanelMode !== 'none'}
                            rightPanelMode={rightPanelMode}
                            planPanelAvailable={planPanelAvailable}
                            planProgressLabel={planProgressLabel}
                            planIsComplete={planIsComplete}
                            showHeaderMenu={showHeaderMenu}
                            setShowHeaderMenu={setShowHeaderMenu}
                            headerMenuRef={headerMenuRef}
                            timelineScrollRef={timelineScrollRef}
                            deletingMessageId={deletingMessageId}
                            latestProjectLabel={selectedProjectLabel}
                            assistantMessageFilePath={assistantMessageFilePath || null}
                            leftSidebarCollapsed={leftSidebarCollapsed}
                            onToggleLeftSidebar={handleToggleAssistantLeftSidebar}
                            availableModels={availableModels}
                            controller={controller}
                            onScrollTimeline={onScrollTimeline}
                            onScrollToBottom={onScrollToBottom}
                            onRequestDeleteUserMessage={setPendingMessageDelete}
                            onToggleRightSidebar={() => setRightPanelMode((current) => current === 'details' ? 'none' : 'details')}
                            onTogglePlanPanel={() => setRightPanelMode((current) => current === 'plan' ? 'none' : 'plan')}
                            onOpenAssistantLink={handleOpenAssistantInternalLink}
                            onOpenEditedFile={handleOpenEditedFile}
                            onViewDiff={handleViewActivityDiff}
                        />
                        <AssistantDiffPanel
                            open={rightPanelMode === 'diff'}
                            selectedDiff={selectedDiffTarget}
                            onClose={() => {
                                setRightPanelMode('none')
                                setSelectedDiffTarget(null)
                            }}
                        />
                        <AssistantPlanPanel
                            open={rightPanelMode === 'plan'}
                            activePlan={controller.activePlan}
                            latestTurn={controller.activeThread?.latestTurn || null}
                            latestProposedPlan={controller.latestProposedPlan}
                            markdownFilePath={assistantMessageFilePath || null}
                            onClose={() => setRightPanelMode('none')}
                            onOpenInternalLink={handleOpenAssistantInternalLink}
                        />
                        <AssistantThreadDetailsPanel
                            open={rightPanelMode === 'details'}
                            selectedProjectPath={selectedProjectPath}
                            selectedProjectLabel={selectedProjectLabel}
                            displayProjectPath={displayProjectPath}
                            showFullProjectPath={showFullProjectPath}
                            projectPathCopied={projectPathCopied}
                            contextPercentage={contextPercentage}
                            contextColor={contextColor}
                            contextUsedDisplay={contextUsedDisplay}
                            contextAvailableDisplay={contextAvailableDisplay}
                            pendingApprovalsCount={controller.pendingApprovals.length}
                            pendingUserInputsCount={controller.pendingUserInputs.length}
                            sidebarSelectedModel={sidebarSelectedModel}
                            selectedRuntimeLabel={selectedRuntimeLabel}
                            selectedThinkingLabel={selectedThinkingLabel}
                            selectedSpeedLabel={selectedSpeedLabel}
                            sidebarMetricChips={sidebarMetricChips}
                            issueActivities={issueActivities}
                            latestIssueGroup={latestIssueGroup}
                            olderIssueGroups={olderIssueGroups}
                            copiedLogId={copiedLogId}
                            copyErrorByLogId={copyErrorByLogId}
                            allLogsCopied={allLogsCopied}
                            clearingLogs={clearingLogs}
                            logsExpanded={logsExpanded}
                            selectedSessionId={controller.selectedSession?.id || null}
                            assistantConnected={Boolean(controller.status?.connected)}
                            assistantAvailable={Boolean(controller.status?.available)}
                            commandPending={controller.commandPending}
                            onClose={() => setRightPanelMode('none')}
                            onToggleProjectPath={() => setShowFullProjectPath((current) => !current)}
                            onCopyProjectPath={() => void handleCopyProjectPath()}
                            onToggleLogsExpanded={() => setLogsExpanded((current) => !current)}
                            onCopyAllLogs={() => void handleCopyAllLogs()}
                            onClearLogs={() => void handleClearLogs()}
                            onCopyLog={(activity) => void handleCopyLog(activity)}
                            onShowLogDetails={(activity) => {
                                setSelectedLogActivity(activity)
                                setLogDetailsTab('rendered')
                            }}
                            onToggleAssistantConnection={() => {
                                if (controller.status?.connected) {
                                    void controller.disconnect(controller.selectedSession?.id || undefined)
                                } else {
                                    void controller.connect(controller.selectedSession?.id || undefined)
                                }
                            }}
                        />
                    </div>
                </div>
            </div>
            <IssueLogDetailsModal
                activity={selectedLogActivity}
                tab={logDetailsTab}
                onChangeTab={setLogDetailsTab}
                onClose={() => setSelectedLogActivity(null)}
            />
            <DeleteHistoryConfirm
                isOpen={Boolean(pendingMessageDelete)}
                deleting={Boolean(deletingMessageId)}
                onConfirm={() => void handleDeleteUserMessage()}
                onCancel={() => {
                    if (deletingMessageId) return
                    setPendingMessageDelete(null)
                }}
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
                    projectPath={selectedProjectPath || undefined}
                    onOpenLinkedPreview={preview.openPreview}
                    mediaItems={preview.previewMediaItems}
                    onClose={preview.closePreview}
                />
            ) : null}
        </div>
    )
}
