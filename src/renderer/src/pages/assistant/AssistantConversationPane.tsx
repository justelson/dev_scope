import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { AssistantProposedPlan, AssistantSessionTurnUsageEntry } from '@shared/assistant/contracts'
import { useSettings } from '@/lib/settings'
import { useAssistantConversationStore, useAssistantStoreActions, useAssistantStoreSelector } from '@/lib/assistant/store'
import { isAssistantThreadActivelyWorking } from '@/lib/assistant/selectors'
import { cn } from '@/lib/utils'
import { buildPromptWithContextFiles } from './assistant-composer-utils'
import { AssistantChatOnboardingOverlay } from './AssistantChatOnboardingOverlay'
import { AssistantConnectionRecoveryBanner } from './AssistantConnectionRecoveryBanner'
import { AssistantConversationHeader } from './AssistantConversationHeader'
import { AssistantConversationComposerPane } from './AssistantConversationComposerPane'
import { AssistantConversationTimelinePane } from './AssistantConversationTimelinePane'
import type { AssistantConversationPaneProps } from './AssistantConversationPane.types'
import type { AssistantComposerSendOptions, ComposerContextFile } from './assistant-composer-types'
import { getAssistantLinkBaseFilePath } from './assistant-file-navigation'
import { getAssistantActivePlanProgress, hasAssistantPlanPanelContent } from './assistant-plan-utils'
import { getAssistantThreadDisplayTitle, getSessionDisplayTitle, resolveSessionProjectPath } from './assistant-sessions-rail-utils'
import { useAssistantConnectionRecovery } from './useAssistantConnectionRecovery'
import { useAssistantQueuedComposer } from './useAssistantQueuedComposer'
import { useAssistantSessionTurnUsage } from './useAssistantSessionTurnUsage'
import { useAssistantPageTimelineScroll } from './useAssistantPageTimelineScroll'

const TIMELINE_SHOW_SCROLL_BUTTON_THRESHOLD_PX = 420
const TIMELINE_HIDE_SCROLL_BUTTON_THRESHOLD_PX = 180
const IMPLEMENT_MODE_TOAST_MS = 2600

export function AssistantConversationPane(props: AssistantConversationPaneProps) {
    const controller = useAssistantConversationStore()
    const actions = useAssistantStoreActions()
    const { settings } = useSettings()
    const headerMenuRef = useRef<HTMLDivElement | null>(null)
    const [activeHeaderMenu, setActiveHeaderMenu] = useState<'none' | 'open-with' | 'more'>('none')
    const [showScrollToBottom, setShowScrollToBottom] = useState(false)
    const [interactionModeOverride, setInteractionModeOverride] = useState<'default' | null>(null)
    const [implementationToastVisible, setImplementationToastVisible] = useState(false)
    const showScrollToBottomRef = useRef(false)
    const scrollButtonRafRef = useRef<number | null>(null)

    const isThreadWorking = isAssistantThreadActivelyWorking(controller.activeThread)
    const selectedSessionId = controller.selectedSession?.id || null
    const selectedPlaygroundLabId = controller.selectedSession?.playgroundLabId || null
    const selectedPlaygroundLabTitle = useAssistantStoreSelector((state) => {
        if (!selectedPlaygroundLabId) return null
        return state.snapshot.playground.labs.find((lab) => lab.id === selectedPlaygroundLabId)?.title || null
    })
    const selectedProjectPath = controller.selectedSession ? resolveSessionProjectPath(controller.selectedSession) : ''
    const lastResolvedProjectPathBySessionRef = useRef<Record<string, string>>({})
    const selectedSessionMode = controller.selectedSession?.mode || props.fallbackSessionMode
    const displayProjectPath = selectedProjectPath || (
        (controller.commandPending || controller.loading) && selectedSessionId
            ? lastResolvedProjectPathBySessionRef.current[selectedSessionId] || ''
            : ''
    )
    const selectedSessionTitle = controller.selectedSession ? getSessionDisplayTitle(controller.selectedSession) : 'Assistant'
    const activeThreadIsSubagent = controller.activeThread?.source === 'subagent'
    const activeThreadLabel = controller.activeThread ? getAssistantThreadDisplayTitle(controller.activeThread) : null
    const selectedProjectTooltip = displayProjectPath || (
        selectedSessionMode === 'playground'
            ? (props.playgroundRootMissing
                ? 'Choose a Playground root before creating Playground chats or labs.'
                : 'Detached Playground chat. Create or attach a lab only when you need files.')
            : 'Select a project to start a work chat.'
    )
    const latestProjectLabel = displayProjectPath
        ? (
            selectedSessionMode === 'playground' && selectedPlaygroundLabTitle
                ? selectedPlaygroundLabTitle
                : (displayProjectPath.split(/[\\/]/).filter(Boolean).pop() || displayProjectPath)
        )
        : (selectedSessionMode === 'playground'
            ? (selectedPlaygroundLabTitle || (props.playgroundRootMissing ? 'choose root' : 'chat-only'))
            : 'select project')
    const assistantMessageFilePath = useMemo(
        () => getAssistantLinkBaseFilePath(displayProjectPath),
        [displayProjectPath]
    )
    const availableModels = useMemo(() => {
        if (controller.knownModels.length > 0) return controller.knownModels
        const activeModel = String(controller.activeThread?.model || '').trim()
        return activeModel ? [{ id: activeModel, label: activeModel }] : []
    }, [controller.activeThread?.model, controller.knownModels])
    const planPanelAvailable = hasAssistantPlanPanelContent(controller.activePlan, controller.latestProposedPlan)
    const activePlanProgress = getAssistantActivePlanProgress(controller.activePlan, controller.activeThread?.latestTurn || null)
    const planProgressLabel = activePlanProgress ? `${activePlanProgress.currentStepNumber}/${activePlanProgress.totalSteps}` : null
    const planIsComplete = activePlanProgress?.isComplete === true
    const { sessionTurnUsage } = useAssistantSessionTurnUsage({
        sessionId: selectedSessionId,
        enabled: Boolean(selectedSessionId),
        refreshKey: `${controller.activeThread?.latestTurn?.id || ''}:${controller.activeThread?.latestTurn?.completedAt || ''}:${controller.activeThread?.latestTurn?.state || ''}`
    })
    const turnUsageById = useMemo(() => {
        const next = new Map<string, AssistantSessionTurnUsageEntry>()
        for (const turn of sessionTurnUsage?.turns || []) {
            next.set(turn.id, turn)
        }
        return next
    }, [sessionTurnUsage])
    const shouldShowWorkingIndicator = isThreadWorking
        && !controller.timelineMessages.some((message) => message.role === 'assistant' && message.streaming)
    const lastTimelineMessage = controller.timelineMessages[controller.timelineMessages.length - 1] || null
    const latestTimelineActivity = controller.activityFeed[0] || null
    const selectedThreadHasHistoricalContent = Boolean(
        ((controller.activeThread?.messageCount || 0) > 0)
        || Boolean(controller.activeThread?.latestTurn)
        || Boolean(controller.activeThread?.activePlan)
        || (controller.activeThread?.proposedPlans.length || 0) > 0
        || (controller.activeThread?.pendingApprovals.length || 0) > 0
        || (controller.activeThread?.pendingUserInputs.length || 0) > 0
    )
    const connectionRecovery = useAssistantConnectionRecovery({
        selectedSessionId,
        activeThreadId: controller.activeThread?.id || null,
        threadState: controller.activeThread?.state || null,
        loading: controller.loading,
        connected: controller.connected,
        commandPending: controller.commandPending,
        threadLastError: controller.activeThread?.lastError || null,
        commandError: controller.commandError,
        activities: controller.activityFeed,
        connectResult: (sessionId) => actions.connectResult(sessionId),
        disconnect: (sessionId) => actions.disconnect(sessionId)
    })
    const isReconnectPending = connectionRecovery.reconnectPending || (controller.commandPending && !controller.connected && !isThreadWorking)
    const isThreadConnecting = controller.phase.key === 'starting' || isReconnectPending
    const activeStatusLabel = isThreadConnecting ? 'Connecting...' : 'Working...'
    const { timelineContentRef, timelineScrollRef, onScrollTimeline, onScrollToBottom } = useAssistantPageTimelineScroll({
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
    const isLoadingSelectedChat = Boolean(
        !isThreadConnecting
        && controller.selectedSession
        && controller.timelineMessages.length === 0
        && controller.activityFeed.length === 0
        && (
            controller.selectionHydrating
            || (
                !controller.loading
                && selectedThreadHasHistoricalContent
            )
        )
    )
    const showPlaygroundRootOnboarding = !controller.loading
        && props.fallbackSessionMode === 'playground'
        && props.playgroundRootMissing
    const showWorkProjectOnboarding = !showPlaygroundRootOnboarding
        && !controller.loading
        && !controller.commandPending
        && selectedSessionMode === 'work'
        && !displayProjectPath
    const showPlaygroundDetachedOnboarding = !showPlaygroundRootOnboarding
        && !controller.loading
        && !props.autoStartDetachedPlaygroundChat
        && selectedSessionMode === 'playground'
        && !controller.selectedSession
    const showChatOnboardingOverlay = showPlaygroundRootOnboarding || showWorkProjectOnboarding || showPlaygroundDetachedOnboarding
    const gitRefreshToken = `${controller.selectedSession?.id || 'no-session'}:${controller.activeThread?.id || 'no-thread'}:${controller.activeThread?.latestTurn?.completedAt || controller.activeThread?.lastSeenCompletedTurnId || 'idle'}`

    const getDistanceFromBottom = useCallback((element: HTMLDivElement) => {
        return Math.max(0, element.scrollHeight - element.scrollTop - element.clientHeight)
    }, [])

    const syncScrollButtonVisibility = useCallback((element: HTMLDivElement) => {
        const distanceFromBottom = getDistanceFromBottom(element)
        const shouldShowButton = showScrollToBottomRef.current
            ? distanceFromBottom > TIMELINE_HIDE_SCROLL_BUTTON_THRESHOLD_PX
            : distanceFromBottom > TIMELINE_SHOW_SCROLL_BUTTON_THRESHOLD_PX

        if (showScrollToBottomRef.current !== shouldShowButton) {
            showScrollToBottomRef.current = shouldShowButton
            setShowScrollToBottom(shouldShowButton)
        }
    }, [getDistanceFromBottom])

    const handleTimelineScrollEvent = useCallback((element: HTMLDivElement) => {
        onScrollTimeline(element)
        if (scrollButtonRafRef.current !== null) {
            window.cancelAnimationFrame(scrollButtonRafRef.current)
        }
        scrollButtonRafRef.current = window.requestAnimationFrame(() => {
            scrollButtonRafRef.current = null
            syncScrollButtonVisibility(element)
        })
    }, [onScrollTimeline, syncScrollButtonVisibility])

    useEffect(() => {
        if (!selectedSessionId || !selectedProjectPath) return
        lastResolvedProjectPathBySessionRef.current[selectedSessionId] = selectedProjectPath
    }, [selectedProjectPath, selectedSessionId])

    useEffect(() => {
        if (activeHeaderMenu !== 'more') return
        const handlePointerDown = (event: MouseEvent) => {
            if (!headerMenuRef.current?.contains(event.target as Node)) setActiveHeaderMenu('none')
        }
        const handleEscape = (event: KeyboardEvent) => {
            if (event.key === 'Escape') setActiveHeaderMenu('none')
        }
        document.addEventListener('mousedown', handlePointerDown)
        window.addEventListener('keydown', handleEscape)
        return () => {
            document.removeEventListener('mousedown', handlePointerDown)
            window.removeEventListener('keydown', handleEscape)
        }
    }, [activeHeaderMenu])

    useLayoutEffect(() => {
        const element = timelineScrollRef.current
        if (!element) return
        showScrollToBottomRef.current = false
        setShowScrollToBottom(false)
        syncScrollButtonVisibility(element)
    }, [controller.activeThread?.id, controller.loading, controller.selectedSession?.id, syncScrollButtonVisibility, timelineScrollRef])

    useLayoutEffect(() => {
        const element = timelineScrollRef.current
        if (!element) return
        syncScrollButtonVisibility(element)
    }, [
        controller.activityFeed.length,
        controller.timelineMessages.length,
        isLoadingSelectedChat,
        syncScrollButtonVisibility,
        timelineScrollRef
    ])

    useEffect(() => {
        return () => {
            if (scrollButtonRafRef.current !== null) {
                window.cancelAnimationFrame(scrollButtonRafRef.current)
            }
        }
    }, [])

    useEffect(() => {
        if (controller.activeThread?.interactionMode === 'default') {
            setInteractionModeOverride(null)
        }
    }, [controller.activeThread?.interactionMode, controller.activeThread?.id])

    useEffect(() => {
        setActiveHeaderMenu('none')
        setInteractionModeOverride(null)
        setImplementationToastVisible(false)
    }, [controller.activeThread?.id, selectedSessionId])

    useEffect(() => {
        if (!implementationToastVisible) return
        const timeoutId = window.setTimeout(() => setImplementationToastVisible(false), IMPLEMENT_MODE_TOAST_MS)
        return () => window.clearTimeout(timeoutId)
    }, [implementationToastVisible])

    const handleScrollToBottomClick = useCallback(() => {
        showScrollToBottomRef.current = false
        setShowScrollToBottom(false)
        onScrollToBottom()
    }, [onScrollToBottom])

    const handleComposerOverflowWheel = useCallback((deltaY: number) => {
        if (deltaY === 0) return
        const element = timelineScrollRef.current
        if (!element) return
        element.scrollTop += deltaY
        handleTimelineScrollEvent(element)
    }, [handleTimelineScrollEvent, timelineScrollRef])

    const handleRefreshModels = useCallback(() => {
        actions.refreshModels()
    }, [actions])

    const handleRespondUserInput = useCallback(async (requestId: string, answers: Record<string, string | string[]>) => {
        await actions.respondUserInput(requestId, answers)
    }, [actions])

    const handleApprovePendingPlaygroundLabRequest = useCallback(async (input: { title?: string; source: 'empty' | 'git-clone'; repoUrl?: string }) => {
        const sessionId = controller.selectedSession?.id
        if (!sessionId) return
        await actions.approvePendingPlaygroundLabRequest({
            sessionId,
            source: input.source,
            title: input.title,
            repoUrl: input.repoUrl
        })
    }, [actions, controller.selectedSession?.id])

    const handleDeclinePendingPlaygroundLabRequest = useCallback(async () => {
        const sessionId = controller.selectedSession?.id
        if (!sessionId) return
        await actions.declinePendingPlaygroundLabRequest({ sessionId })
    }, [actions, controller.selectedSession?.id])

    const handleStopTurn = useCallback(async () => {
        await actions.interruptTurn(
            controller.activeThread?.latestTurn?.id,
            controller.selectedSession?.id || undefined
        )
    }, [actions, controller.activeThread?.latestTurn?.id, controller.selectedSession?.id])

    const handleReconnectAssistant = useCallback(() => {
        connectionRecovery.reconnect()
    }, [connectionRecovery])

    const handleDispatchPrompt = useCallback(async (
        sessionId: string,
        prompt: string,
        contextFiles: ComposerContextFile[],
        options: AssistantComposerSendOptions
    ) => {
        if (!sessionId) return false
        const result = await actions.sendPromptResult(buildPromptWithContextFiles(prompt, contextFiles), {
            sessionId,
            model: options.model,
            runtimeMode: options.runtimeMode,
            interactionMode: options.interactionMode,
            effort: options.effort,
            serviceTier: options.serviceTier
        })
        return result.success
    }, [actions])
    const isAssistantBusy = controller.commandPending || isThreadWorking
    const {
        sendingComposerPrompt,
        queuedComposerMessageCount,
        queuedComposerMessageItems,
        handleSendPrompt,
        handleForceQueuedMessage,
        handleDeleteQueuedMessage,
        handleMoveQueuedMessage
    } = useAssistantQueuedComposer({
        selectedSessionId,
        isAssistantBusy,
        commandPending: controller.commandPending,
        isThreadWorking,
        activeTurnId: controller.activeThread?.latestTurn?.id || null,
        busyMessageMode: settings.assistantBusyMessageMode,
        dispatchPrompt: handleDispatchPrompt,
        interruptTurn: (turnId, sessionId) => actions.interruptTurn(turnId, sessionId)
    })
    const handleImplementProposedPlan = useCallback(async (plan: AssistantProposedPlan) => {
        const planMarkdown = String(plan.planMarkdown || '').trim()
        if (!planMarkdown) return

        setInteractionModeOverride('default')
        setImplementationToastVisible(true)
        await actions.sendPromptResult(
            `Implement the approved plan below. Do not re-plan unless you hit a real blocking contradiction. Start executing now.\n\n<approved_plan>\n${planMarkdown}\n</approved_plan>`,
            {
                sessionId: selectedSessionId || undefined,
                model: controller.activeThread?.model || undefined,
                runtimeMode: controller.activeThread?.runtimeMode || 'approval-required',
                interactionMode: 'default',
                effort: controller.activeThread?.latestTurn?.effort || undefined,
                serviceTier: controller.activeThread?.latestTurn?.serviceTier === 'fast' ? 'fast' : undefined
            }
        )
    }, [
        actions,
        controller.activeThread?.latestTurn?.effort,
        controller.activeThread?.latestTurn?.serviceTier,
        controller.activeThread?.model,
        controller.activeThread?.runtimeMode,
        selectedSessionId
    ])

    const handleCreateThread = useCallback(() => {
        void actions.newThread(controller.selectedSession?.id || undefined)
        setActiveHeaderMenu('none')
    }, [actions, controller.selectedSession?.id])

    const handleChooseProjectForWorkChat = useCallback(async () => {
        if (controller.commandPending) return
        if (controller.selectedSession?.id) {
            await actions.chooseProjectPath(controller.selectedSession.id)
            return
        }
        await actions.createProjectSession()
    }, [actions, controller.commandPending, controller.selectedSession?.id])

    const handleToggleDetailsPanel = useCallback(() => {
        props.onToggleRightSidebar()
        setActiveHeaderMenu('none')
    }, [props.onToggleRightSidebar])

    const effectiveInteractionMode = interactionModeOverride || controller.activeThread?.interactionMode || 'default'

    return (
        <section className="relative flex min-w-0 flex-1 flex-col">
            <div className={cn(
                'flex min-h-0 flex-1 flex-col transition-[filter,opacity] duration-200',
                showChatOnboardingOverlay && 'pointer-events-none select-none blur-[2px] opacity-55'
            )}>
                <AssistantConversationHeader
                    rightPanelOpen={props.rightPanelOpen}
                    rightPanelMode={props.rightPanelMode}
                    planPanelAvailable={planPanelAvailable}
                    planProgressLabel={planProgressLabel}
                    planIsComplete={planIsComplete}
                    activeHeaderMenu={activeHeaderMenu}
                    setActiveHeaderMenu={setActiveHeaderMenu}
                    headerMenuRef={headerMenuRef}
                    leftSidebarCollapsed={props.leftSidebarCollapsed}
                    latestProjectLabel={latestProjectLabel}
                    selectedSessionTitle={selectedSessionTitle}
                    selectedSessionMode={selectedSessionMode}
                    activeThreadIsSubagent={activeThreadIsSubagent}
                    activeThreadLabel={activeThreadLabel}
                    selectedProjectTooltip={selectedProjectTooltip}
                    selectedProjectPath={displayProjectPath || null}
                    preferredShell={settings.defaultShell}
                    gitRefreshToken={gitRefreshToken}
                    onToggleLeftSidebar={props.onToggleLeftSidebar}
                    onTogglePlanPanel={props.onTogglePlanPanel}
                    onCreateThread={handleCreateThread}
                    onToggleRightSidebar={handleToggleDetailsPanel}
                />
                <div className="relative flex min-h-0 flex-1 flex-col">
                    {connectionRecovery.showBanner && connectionRecovery.issue ? (
                        <AssistantConnectionRecoveryBanner
                            issue={connectionRecovery.issue}
                            reconnectPending={connectionRecovery.reconnectPending}
                            reconnectAttempt={connectionRecovery.reconnectAttempt}
                            reconnectMaxAttempts={connectionRecovery.reconnectMaxAttempts}
                            reconnectExhausted={connectionRecovery.reconnectExhausted}
                            onReconnect={handleReconnectAssistant}
                        />
                    ) : null}
                    <AssistantConversationTimelinePane
                        loading={controller.loading}
                        timelineContentRef={timelineContentRef}
                        timelineScrollRef={timelineScrollRef}
                        messages={controller.timelineMessages}
                        activities={controller.activityFeed}
                        proposedPlans={controller.activeThread?.proposedPlans || []}
                        sessionMode={selectedSessionMode}
                        latestProjectLabel={latestProjectLabel}
                        projectTitle={displayProjectPath || null}
                        assistantMessageFilePath={assistantMessageFilePath}
                        windowKey={`${controller.selectedSession?.id || 'no-session'}:${controller.activeThread?.id || 'no-thread'}`}
                        isWorking={isThreadWorking}
                        activeStatusLabel={activeStatusLabel}
                        isConnecting={isThreadConnecting}
                        activeWorkStartedAt={controller.activeThread?.latestTurn?.startedAt || null}
                        latestAssistantMessageId={controller.activeThread?.latestTurn?.assistantMessageId || null}
                        latestTurnStartedAt={controller.activeThread?.latestTurn?.startedAt || null}
                        turnUsageById={turnUsageById}
                        deletingMessageId={props.deletingMessageId}
                        loadingChats={isLoadingSelectedChat}
                        assistantTextStreamingMode={settings.assistantTextStreamingMode}
                        showScrollToBottom={showScrollToBottom}
                        onScrollTimeline={handleTimelineScrollEvent}
                        onScrollToBottom={handleScrollToBottomClick}
                        onRequestDeleteUserMessage={props.onRequestDeleteUserMessage}
                        onImplementProposedPlan={handleImplementProposedPlan}
                        onShowPlanPanel={props.rightPanelMode !== 'plan' ? props.onTogglePlanPanel : undefined}
                        onOpenAttachmentPreview={props.onOpenAttachmentPreview}
                        onOpenAssistantLink={props.onOpenAssistantLink}
                        onOpenEditedFile={props.onOpenEditedFile}
                        onViewDiff={props.onViewDiff}
                    />
                    <AssistantConversationComposerPane
                        pendingPlaygroundLabRequest={controller.selectedSession?.pendingLabRequest || null}
                        pendingUserInputs={controller.pendingUserInputs}
                        commandPending={controller.commandPending}
                        sending={sendingComposerPrompt}
                        thinking={controller.commandPending || isThreadWorking}
                        queuedMessageCount={queuedComposerMessageCount}
                        queuedMessages={queuedComposerMessageItems}
                        onForceQueuedMessage={handleForceQueuedMessage}
                        onDeleteQueuedMessage={handleDeleteQueuedMessage}
                        onMoveQueuedMessage={handleMoveQueuedMessage}
                        selectedSessionId={controller.selectedSession?.id || null}
                        selectedSessionMode={selectedSessionMode}
                        assistantAvailable={controller.available}
                        assistantConnected={controller.connected}
                        selectedProjectPath={displayProjectPath || null}
                        availableModels={availableModels}
                        activeModel={controller.activeThread?.model || availableModels[0]?.id || undefined}
                        modelsLoading={controller.modelsLoading}
                        latestTurnUsage={controller.activeThread?.latestTurn?.usage || null}
                        runtimeMode={controller.activeThread?.runtimeMode || 'approval-required'}
                        interactionMode={effectiveInteractionMode}
                        activeProfile={controller.activeThread?.runtimeMode === 'full-access' ? 'yolo-fast' : 'safe-dev'}
                        activeStatusLabel={activeStatusLabel}
                        isConnecting={isThreadConnecting}
                        reconnectPending={connectionRecovery.reconnectPending}
                        onOverflowWheel={handleComposerOverflowWheel}
                        onStop={handleStopTurn}
                        onReconnect={handleReconnectAssistant}
                        onBlockedSend={(message) => props.onShowToast?.(message, 'info')}
                        onOpenAttachmentPreview={props.onOpenAttachmentPreview}
                        sendPrompt={handleSendPrompt}
                        refreshModels={handleRefreshModels}
                        respondUserInput={handleRespondUserInput}
                        approvePendingPlaygroundLabRequest={handleApprovePendingPlaygroundLabRequest}
                        declinePendingPlaygroundLabRequest={handleDeclinePendingPlaygroundLabRequest}
                    />
                </div>
            </div>
            {showPlaygroundRootOnboarding ? (
                <AssistantChatOnboardingOverlay
                    mode="playground-root"
                    busy={controller.commandPending}
                    onChoosePlaygroundRoot={props.onChoosePlaygroundRoot}
                />
            ) : null}
            {showWorkProjectOnboarding ? (
                <AssistantChatOnboardingOverlay
                    mode="work-project"
                    busy={controller.commandPending}
                    hasSession={Boolean(controller.selectedSession)}
                    onChooseProject={handleChooseProjectForWorkChat}
                    playgroundRootConfigured={!props.playgroundRootMissing}
                    onChoosePlaygroundRoot={props.onChoosePlaygroundRoot}
                    onStartDetachedPlaygroundChat={props.onStartDetachedPlaygroundChat}
                />
            ) : null}
            {showPlaygroundDetachedOnboarding ? (
                <AssistantChatOnboardingOverlay
                    mode="playground-chat"
                    busy={controller.commandPending}
                    onStartDetachedPlaygroundChat={props.onStartDetachedPlaygroundChat}
                />
            ) : null}
            <div className="pointer-events-none absolute inset-x-0 bottom-24 z-30 flex justify-center px-4">
                <div
                    className={cn(
                        'inline-flex items-center gap-2 rounded-full border border-white/10 bg-sparkle-card/95 px-3 py-2 text-[12px] font-medium text-sparkle-text-secondary shadow-[0_16px_40px_rgba(0,0,0,0.28)] backdrop-blur-xl transition-all duration-200',
                        implementationToastVisible ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0'
                    )}
                >
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-300/80" />
                    <span>Moving to implementation. Switching from Plan to Chat.</span>
                </div>
            </div>
        </section>
    )
}
