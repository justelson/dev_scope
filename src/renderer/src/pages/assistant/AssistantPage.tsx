import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { AssistantActivity, AssistantMessage } from '@shared/assistant/contracts'
import { useAssistantStore } from '@/lib/assistant/store'
import { AssistantConversationPane } from './AssistantConversationPane'
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
import { AssistantSessionsRail } from './AssistantSessionsRail'
import { AssistantThreadDetailsPanel } from './AssistantThreadDetailsPanel'
import {
    readAssistantComposerPreferences,
    subscribeAssistantComposerPreferences,
    type AssistantComposerPreferenceEffort,
    type AssistantComposerPreferences
} from './assistant-composer-preferences'

const LEFT_SIDEBAR_COLLAPSED_STORAGE_KEY = 'assistant-left-sidebar-collapsed'
const LEFT_SIDEBAR_WIDTH_STORAGE_KEY = 'assistant-left-sidebar-width'
const RIGHT_SIDEBAR_OPEN_STORAGE_KEY = 'assistant-right-sidebar-open'
const TIMELINE_AUTO_SCROLL_THRESHOLD_PX = 350

const SIDEBAR_EFFORT_LABELS: Record<AssistantComposerPreferenceEffort, string> = {
    low: 'Low',
    medium: 'Medium',
    high: 'High',
    xhigh: 'Extra High'
}

type IssueActivityGroup = {
    activity: AssistantActivity
    activities: AssistantActivity[]
    count: number
}

export default function AssistantPage() {
    const controller = useAssistantStore()
    const headerMenuRef = useRef<HTMLDivElement | null>(null)
    const autoConnectAttemptedSessionRef = useRef<string | null>(null)
    const timelineScrollRef = useRef<HTMLDivElement | null>(null)
    const shouldAutoScrollRef = useRef(true)
    const [leftSidebarCollapsed, setLeftSidebarCollapsed] = useState(() => localStorage.getItem(LEFT_SIDEBAR_COLLAPSED_STORAGE_KEY) === 'true')
    const [leftSidebarWidth, setLeftSidebarWidth] = useState(() => {
        const saved = Number(localStorage.getItem(LEFT_SIDEBAR_WIDTH_STORAGE_KEY))
        return Number.isFinite(saved) && saved > 0 ? saved : 320
    })
    const [rightSidebarOpen, setRightSidebarOpen] = useState(() => {
        const saved = localStorage.getItem(RIGHT_SIDEBAR_OPEN_STORAGE_KEY)
        return saved !== null ? saved === 'true' : true
    })
    const [showHeaderMenu, setShowHeaderMenu] = useState(false)
    const [selectedLogActivity, setSelectedLogActivity] = useState<AssistantActivity | null>(null)
    const [pendingMessageDelete, setPendingMessageDelete] = useState<AssistantMessage | null>(null)
    const [deletingMessageId, setDeletingMessageId] = useState<string | null>(null)
    const [logDetailsTab, setLogDetailsTab] = useState<LogDetailsTab>('rendered')
    const [copiedLogId, setCopiedLogId] = useState<string | null>(null)
    const [copyErrorByLogId, setCopyErrorByLogId] = useState<Record<string, string | null>>({})
    const [showScrollToBottom, setShowScrollToBottom] = useState(false)
    const [projectPathCopied, setProjectPathCopied] = useState(false)
    const [showFullProjectPath, setShowFullProjectPath] = useState(false)
    const [allLogsCopied, setAllLogsCopied] = useState(false)
    const [clearingLogs, setClearingLogs] = useState(false)
    const [logsExpanded, setLogsExpanded] = useState(false)
    const [composerPreferences, setComposerPreferences] = useState<AssistantComposerPreferences>(() => readAssistantComposerPreferences())

    useEffect(() => {
        localStorage.setItem(LEFT_SIDEBAR_COLLAPSED_STORAGE_KEY, String(leftSidebarCollapsed))
    }, [leftSidebarCollapsed])

    useEffect(() => {
        localStorage.setItem(LEFT_SIDEBAR_WIDTH_STORAGE_KEY, String(leftSidebarWidth))
    }, [leftSidebarWidth])

    useEffect(() => {
        localStorage.setItem(RIGHT_SIDEBAR_OPEN_STORAGE_KEY, String(rightSidebarOpen))
    }, [rightSidebarOpen])

    useEffect(() => subscribeAssistantComposerPreferences((preferences) => {
        setComposerPreferences(preferences)
    }), [])

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
    const selectedProjectLabel = selectedProjectPath
        ? selectedProjectPath.split(/[\\/]/).filter(Boolean).pop() || selectedProjectPath
        : 'not set'
    const selectedProjectPathWithTilde = selectedProjectPath
        ? selectedProjectPath.replace(/^[A-Z]:\\Users\\[^\\]+/, '~').replace(/\\/g, '/')
        : ''
    const displayProjectPath = showFullProjectPath ? selectedProjectPathWithTilde : selectedProjectLabel
    const availableModels = useMemo(() => {
        if (controller.snapshot.knownModels.length > 0) return controller.snapshot.knownModels
        const activeModel = String(controller.activeThread?.model || '').trim()
        return activeModel ? [{ id: activeModel, label: activeModel }] : []
    }, [controller.activeThread?.model, controller.snapshot.knownModels])
    const sidebarSelectedModel = composerPreferences.model || controller.activeThread?.model || availableModels[0]?.id || ''
    const latestTurnUsage = controller.activeThread?.latestTurn?.usage || null
    const contextUsedTokens = latestTurnUsage?.totalTokens ?? null
    const contextWindowTokens = latestTurnUsage?.modelContextWindow ?? null
    const sessionSidebarWidth = leftSidebarCollapsed ? 56 : Math.max(180, Math.min(520, Math.round(leftSidebarWidth)))
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
    const selectedThinkingLabel = SIDEBAR_EFFORT_LABELS[composerPreferences.effort || 'high']
    const selectedSpeedLabel = composerPreferences.fastModeEnabled ? 'Fast' : 'Standard'
    const selectedRuntimeLabel = controller.activeThread?.runtimeMode === 'full-access' ? 'Full access' : 'Supervised'
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
    const issueActivities = useMemo(() => {
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
        latestTimelineActivity?.createdAt
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

    useEffect(() => {
        if (olderIssueGroups.length === 0 && logsExpanded) setLogsExpanded(false)
    }, [logsExpanded, olderIssueGroups.length])

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

    const isTimelineNearBottom = (element: HTMLDivElement) => element.scrollHeight - element.scrollTop - element.clientHeight <= TIMELINE_AUTO_SCROLL_THRESHOLD_PX
    const syncTimelineScrollState = (element: HTMLDivElement) => {
        const nearBottom = isTimelineNearBottom(element)
        shouldAutoScrollRef.current = nearBottom
        setShowScrollToBottom(!nearBottom)
    }
    const scrollTimelineToBottom = (behavior: ScrollBehavior = 'instant') => {
        const element = timelineScrollRef.current
        if (!element) return
        if (behavior === 'instant') element.scrollTop = element.scrollHeight
        else element.scrollTo({ top: element.scrollHeight, behavior })
    }

    useLayoutEffect(() => {
        const element = timelineScrollRef.current
        if (element) syncTimelineScrollState(element)
    }, [])

    useLayoutEffect(() => {
        const element = timelineScrollRef.current
        if (!element) return
        const isNearBottom = isTimelineNearBottom(element)
        const hasNoScroll = element.scrollTop === 0 && element.scrollHeight > element.clientHeight
        if (isNearBottom || hasNoScroll) {
            shouldAutoScrollRef.current = true
            setShowScrollToBottom(false)
            scrollTimelineToBottom('instant')
        }
        syncTimelineScrollState(element)
    }, [controller.selectedSession?.id, controller.activeThread?.id, controller.loading])

    useLayoutEffect(() => {
        const element = timelineScrollRef.current
        if (!element) return
        if (!shouldAutoScrollRef.current && !isTimelineNearBottom(element)) {
            setShowScrollToBottom(true)
            return
        }
        scrollTimelineToBottom('instant')
        if (timelineScrollRef.current) syncTimelineScrollState(timelineScrollRef.current)
    }, [
        controller.timelineMessages.length,
        lastTimelineMessage?.id,
        lastTimelineMessage?.updatedAt,
        controller.activityFeed.length,
        latestTimelineActivity?.id,
        latestTimelineActivity?.createdAt
    ])

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

    return (
        <div className="-m-6 flex h-[calc(100vh-46px)] min-h-[calc(100vh-46px)] flex-col overflow-hidden animate-fadeIn [--accent-primary:var(--color-primary)] [--accent-secondary:var(--color-secondary)]">
            <div className="min-h-0 flex-1 overflow-hidden">
                <div className="flex h-full">
                    <AssistantSessionsRail
                        collapsed={leftSidebarCollapsed}
                        width={sessionSidebarWidth}
                        compact={false}
                        sessions={controller.snapshot.sessions}
                        activeSessionId={controller.selectedSession?.id || null}
                        commandPending={controller.commandPending}
                        onSetCollapsed={setLeftSidebarCollapsed}
                        onWidthChange={setLeftSidebarWidth}
                        onCreateSession={(projectPath) => controller.createSession(undefined, projectPath)}
                        onSelectSession={controller.selectSession}
                        onRenameSession={controller.renameSession}
                        onArchiveSession={controller.archiveSession}
                        onDeleteSession={controller.deleteSession}
                        onChooseProjectPath={controller.createProjectSession}
                    />
                    <div className="flex min-w-0 flex-1">
                        <AssistantConversationPane
                            rightSidebarOpen={rightSidebarOpen}
                            showHeaderMenu={showHeaderMenu}
                            setShowHeaderMenu={setShowHeaderMenu}
                            headerMenuRef={headerMenuRef}
                            timelineScrollRef={timelineScrollRef}
                            showScrollToBottom={showScrollToBottom}
                            deletingMessageId={deletingMessageId}
                            latestProjectLabel={selectedProjectLabel}
                            availableModels={availableModels}
                            controller={controller}
                            onScrollTimeline={syncTimelineScrollState}
                            onScrollToBottom={() => {
                                shouldAutoScrollRef.current = true
                                setShowScrollToBottom(false)
                                scrollTimelineToBottom('smooth')
                            }}
                            onRequestDeleteUserMessage={setPendingMessageDelete}
                            onToggleRightSidebar={() => setRightSidebarOpen((current) => !current)}
                        />
                        <AssistantThreadDetailsPanel
                            open={rightSidebarOpen}
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
                            onClose={() => setRightSidebarOpen(false)}
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
        </div>
    )
}
