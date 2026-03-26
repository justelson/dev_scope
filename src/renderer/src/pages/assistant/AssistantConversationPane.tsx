import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type RefObject } from 'react'
import { ChevronLeft, ChevronRight, ListTodo, MoreHorizontal, PanelLeft, PanelRight, SquarePen } from 'lucide-react'
import type { AssistantMessage, AssistantProposedPlan } from '@shared/assistant/contracts'
import type { PreviewOpenOptions } from '@/components/ui/file-preview/types'
import { useSettings } from '@/lib/settings'
import { useAssistantConversationStore, useAssistantStoreActions } from '@/lib/assistant/store'
import { isAssistantThreadActivelyWorking } from '@/lib/assistant/selectors'
import { cn } from '@/lib/utils'
import type { AssistantDiffTarget } from './assistant-diff-types'
import { buildPromptWithContextFiles } from './assistant-composer-utils'
import { AssistantConversationComposerPane } from './AssistantConversationComposerPane'
import { AssistantHeaderOpenWithButton } from './AssistantHeaderOpenWithButton'
import { AssistantConversationTimelinePane } from './AssistantConversationTimelinePane'
import { AssistantProjectGitChip } from './AssistantProjectGitChip'
import type { AssistantComposerSendOptions, AssistantElementBounds, ComposerContextFile } from './assistant-composer-types'
import { getAssistantLinkBaseFilePath } from './assistant-file-navigation'
import { getAssistantActivePlanProgress, hasAssistantPlanPanelContent } from './assistant-plan-utils'
import { useAssistantPageTimelineScroll } from './useAssistantPageTimelineScroll'

const TIMELINE_SHOW_SCROLL_BUTTON_THRESHOLD_PX = 420
const TIMELINE_HIDE_SCROLL_BUTTON_THRESHOLD_PX = 180
const IMPLEMENT_MODE_TOAST_MS = 2600
const SCROLL_BUTTON_ELEVATED_OFFSET_PX = 80

function rectsOverlap(a: AssistantElementBounds, b: AssistantElementBounds): boolean {
    return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top
}

const AssistantConversationHeader = memo(function AssistantConversationHeader(props: {
    rightPanelOpen: boolean
    rightPanelMode: 'none' | 'details' | 'plan' | 'diff'
    planPanelAvailable: boolean
    planProgressLabel: string | null
    planIsComplete: boolean
    showHeaderMenu: boolean
    setShowHeaderMenu: (value: boolean) => void
    headerMenuRef: RefObject<HTMLDivElement | null>
    leftSidebarCollapsed: boolean
    latestProjectLabel: string
    selectedSessionTitle: string
    selectedSessionMode: 'work' | 'playground'
    selectedProjectTooltip: string
    selectedProjectPath: string | null
    preferredShell: 'powershell' | 'cmd'
    gitRefreshToken: string
    onToggleLeftSidebar: () => void
    onTogglePlanPanel: () => void
    onCreateThread: () => void
    onToggleRightSidebar: () => void
}) {
    const {
        rightPanelOpen,
        rightPanelMode,
        planPanelAvailable,
        planProgressLabel,
        planIsComplete,
        showHeaderMenu,
        setShowHeaderMenu,
        headerMenuRef,
        leftSidebarCollapsed,
        latestProjectLabel,
        selectedSessionTitle,
        selectedSessionMode,
        selectedProjectTooltip,
        selectedProjectPath,
        preferredShell,
        gitRefreshToken,
        onToggleLeftSidebar,
        onTogglePlanPanel,
        onCreateThread,
        onToggleRightSidebar
    } = props

    return (
        <div className={cn('flex items-center justify-between gap-2 border-b border-white/10 bg-sparkle-card px-3 py-1.5', rightPanelOpen && 'border-r border-white/10')}>
            <div className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden">
                <button
                    type="button"
                    onClick={onToggleLeftSidebar}
                    className="shrink-0 rounded-lg border border-white/10 bg-sparkle-card p-1.5 text-sparkle-text-secondary transition-colors hover:border-white/20 hover:bg-white/[0.03] hover:text-sparkle-text"
                    title={leftSidebarCollapsed ? 'Expand assistant sidebar' : 'Collapse assistant sidebar'}
                    aria-label={leftSidebarCollapsed ? 'Expand assistant sidebar' : 'Collapse assistant sidebar'}
                >
                    {leftSidebarCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
                </button>
                <h2 className="truncate text-[13px] font-semibold leading-none text-sparkle-text">{selectedSessionTitle}</h2>
                <span className={cn(
                    'inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-[10px] font-medium leading-none',
                    selectedSessionMode === 'playground'
                        ? 'border-violet-400/20 bg-violet-500/[0.08] text-violet-100'
                        : 'border-sky-400/20 bg-sky-500/[0.08] text-sky-100'
                )}>
                    {selectedSessionMode === 'playground' ? 'Playground chat' : 'Work chat'}
                </span>
                <span className="inline-flex max-w-[220px] shrink-0 items-center rounded-full border border-white/10 bg-white/[0.03] px-2 py-0.5 text-[10px] font-medium leading-none text-sparkle-text-secondary" title={selectedProjectTooltip}>
                    <span className="truncate">{latestProjectLabel}</span>
                </span>
            </div>
            <div ref={headerMenuRef} className="relative flex shrink-0 items-center gap-1.5">
                <AssistantProjectGitChip
                    projectPath={selectedProjectPath}
                    refreshToken={gitRefreshToken}
                />
                <AssistantHeaderOpenWithButton
                    projectPath={selectedProjectPath}
                    preferredShell={preferredShell}
                />
                <button
                    type="button"
                    onClick={onTogglePlanPanel}
                    className={cn(
                        'inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-[11px] font-medium transition-colors',
                        rightPanelMode === 'plan' && planIsComplete
                            ? 'border-emerald-400/30 bg-emerald-500/[0.10] text-emerald-100'
                            : rightPanelMode === 'plan'
                                ? 'border-violet-400/30 bg-violet-500/[0.10] text-violet-100'
                                : planIsComplete
                                    ? 'border-emerald-400/20 bg-emerald-500/[0.08] text-emerald-200 hover:border-emerald-300/35 hover:bg-emerald-500/[0.12]'
                                    : 'border-white/10 bg-sparkle-card text-sparkle-text-secondary hover:border-white/20 hover:bg-white/[0.03] hover:text-sparkle-text'
                    )}
                    title={planPanelAvailable ? 'Show plan panel' : 'Show plan panel (no current running todo)'}
                >
                    <ListTodo size={13} />
                    <span>{planPanelAvailable ? (planProgressLabel || 'Plan') : 'Set plan'}</span>
                </button>
                <button type="button" onClick={() => setShowHeaderMenu(!showHeaderMenu)} className="inline-flex size-8 items-center justify-center rounded-lg border border-white/10 bg-sparkle-card text-sparkle-text-secondary transition-colors hover:border-white/20 hover:bg-white/[0.03] hover:text-sparkle-text" title="More actions"><MoreHorizontal size={14} /></button>
                {showHeaderMenu && <div className="absolute right-0 top-full z-20 mt-2 w-52 rounded-lg border border-white/10 bg-sparkle-card p-1 shadow-lg">
                    <button type="button" onClick={onCreateThread} className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-xs text-sparkle-text-secondary transition-colors hover:bg-sparkle-card-hover hover:text-sparkle-text"><SquarePen size={13} />New thread</button>
                    <button type="button" onClick={onToggleRightSidebar} className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-xs text-sparkle-text-secondary transition-colors hover:bg-sparkle-card-hover hover:text-sparkle-text">{rightPanelMode === 'details' ? <PanelRight size={13} /> : <PanelLeft size={13} />}{rightPanelMode === 'details' ? 'Hide details' : 'Show details'}</button>
                </div>}
            </div>
        </div>
    )
})

export function AssistantConversationPane(props: {
    rightPanelOpen: boolean
    rightPanelMode: 'none' | 'details' | 'plan' | 'diff'
    deletingMessageId: string | null
    leftSidebarCollapsed: boolean
    onToggleLeftSidebar: () => void
    onRequestDeleteUserMessage: (message: AssistantMessage) => void
    onToggleRightSidebar: () => void
    onTogglePlanPanel: () => void
    onOpenAttachmentPreview?: (
        file: { name: string; path: string },
        ext: string,
        options?: PreviewOpenOptions
    ) => Promise<void> | void
    onOpenAssistantLink?: (href: string) => Promise<void> | void
    onOpenEditedFile?: (filePath: string) => Promise<void> | void
    onViewDiff?: (target: AssistantDiffTarget) => void
}) {
    const controller = useAssistantConversationStore()
    const actions = useAssistantStoreActions()
    const { settings } = useSettings()
    const headerMenuRef = useRef<HTMLDivElement | null>(null)
    const [showHeaderMenu, setShowHeaderMenu] = useState(false)
    const [showScrollToBottom, setShowScrollToBottom] = useState(false)
    const [elevateScrollToBottom, setElevateScrollToBottom] = useState(false)
    const [attachmentShelfBounds, setAttachmentShelfBounds] = useState<AssistantElementBounds | null>(null)
    const [scrollButtonBounds, setScrollButtonBounds] = useState<AssistantElementBounds | null>(null)
    const [interactionModeOverride, setInteractionModeOverride] = useState<'default' | null>(null)
    const [implementationToastVisible, setImplementationToastVisible] = useState(false)
    const showScrollToBottomRef = useRef(false)
    const scrollButtonRafRef = useRef<number | null>(null)

    const isThreadWorking = isAssistantThreadActivelyWorking(controller.activeThread)
    const isThreadConnecting = controller.phase.key === 'starting'
    const activeStatusLabel = isThreadConnecting ? 'Connecting...' : 'Working...'
    const selectedProjectPath = String(controller.selectedSession?.projectPath || controller.activeThread?.cwd || '').trim()
    const selectedSessionMode = controller.selectedSession?.mode || 'work'
    const selectedSessionTitle = controller.selectedSession?.title || 'Assistant'
    const selectedProjectTooltip = controller.selectedSession?.projectPath || controller.activeThread?.cwd || (selectedSessionMode === 'playground' ? 'No lab attached yet' : 'No project selected')
    const latestProjectLabel = selectedProjectPath
        ? selectedProjectPath.split(/[\\/]/).filter(Boolean).pop() || selectedProjectPath
        : (selectedSessionMode === 'playground' ? 'chat-only' : 'not set')
    const assistantMessageFilePath = useMemo(
        () => getAssistantLinkBaseFilePath(selectedProjectPath),
        [selectedProjectPath]
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
    const shouldShowWorkingIndicator = isThreadWorking
        && !controller.timelineMessages.some((message) => message.role === 'assistant' && message.streaming)
    const lastTimelineMessage = controller.timelineMessages[controller.timelineMessages.length - 1] || null
    const latestTimelineActivity = controller.activityFeed[0] || null
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
        && !controller.loading
        && controller.commandPending
        && controller.selectedSession
        && controller.activeThread
        && controller.timelineMessages.length === 0
        && controller.activityFeed.length === 0
        && (controller.activeThread.messageCount > 0 || controller.activeThread.latestTurn || controller.activeThread.updatedAt)
    )
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
        if (!attachmentShelfBounds || !scrollButtonBounds) {
            setElevateScrollToBottom(false)
            return
        }

        const defaultScrollButtonBounds = elevateScrollToBottom
            ? {
                ...scrollButtonBounds,
                top: scrollButtonBounds.top + SCROLL_BUTTON_ELEVATED_OFFSET_PX,
                bottom: scrollButtonBounds.bottom + SCROLL_BUTTON_ELEVATED_OFFSET_PX
            }
            : scrollButtonBounds

        setElevateScrollToBottom(rectsOverlap(attachmentShelfBounds, defaultScrollButtonBounds))
    }, [attachmentShelfBounds, elevateScrollToBottom, scrollButtonBounds])

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
        if (!implementationToastVisible) return
        const timeoutId = window.setTimeout(() => setImplementationToastVisible(false), IMPLEMENT_MODE_TOAST_MS)
        return () => window.clearTimeout(timeoutId)
    }, [implementationToastVisible])

    const handleScrollToBottomClick = useCallback(() => {
        showScrollToBottomRef.current = false
        setShowScrollToBottom(false)
        onScrollToBottom()
    }, [onScrollToBottom])

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

    const handleSendPrompt = useCallback(async (
        prompt: string,
        contextFiles: ComposerContextFile[],
        options: AssistantComposerSendOptions
    ) => {
        const result = await actions.sendPromptResult(buildPromptWithContextFiles(prompt, contextFiles), {
            sessionId: controller.selectedSession?.id || undefined,
            model: options.model,
            runtimeMode: options.runtimeMode,
            interactionMode: options.interactionMode,
            effort: options.effort,
            serviceTier: options.serviceTier
        })
        return result.success
    }, [actions, controller.selectedSession?.id])

    const handleImplementProposedPlan = useCallback(async (plan: AssistantProposedPlan) => {
        const planMarkdown = String(plan.planMarkdown || '').trim()
        if (!planMarkdown) return

        setInteractionModeOverride('default')
        setImplementationToastVisible(true)
        await actions.sendPromptResult(
            `Implement the approved plan below. Do not re-plan unless you hit a real blocking contradiction. Start executing now.\n\n<approved_plan>\n${planMarkdown}\n</approved_plan>`,
            {
                sessionId: controller.selectedSession?.id || undefined,
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
        controller.selectedSession?.id
    ])

    const handleCreateThread = useCallback(() => {
        void actions.newThread(controller.selectedSession?.id || undefined)
        setShowHeaderMenu(false)
    }, [actions, controller.selectedSession?.id])

    const handleToggleDetailsPanel = useCallback(() => {
        props.onToggleRightSidebar()
        setShowHeaderMenu(false)
    }, [props.onToggleRightSidebar])

    const effectiveInteractionMode = interactionModeOverride || controller.activeThread?.interactionMode || 'default'

    return (
        <section className="flex min-w-0 flex-1 flex-col">
            <AssistantConversationHeader
                rightPanelOpen={props.rightPanelOpen}
                rightPanelMode={props.rightPanelMode}
                planPanelAvailable={planPanelAvailable}
                planProgressLabel={planProgressLabel}
                planIsComplete={planIsComplete}
                showHeaderMenu={showHeaderMenu}
                setShowHeaderMenu={setShowHeaderMenu}
                headerMenuRef={headerMenuRef}
                leftSidebarCollapsed={props.leftSidebarCollapsed}
                latestProjectLabel={latestProjectLabel}
                selectedSessionTitle={selectedSessionTitle}
                selectedSessionMode={selectedSessionMode}
                selectedProjectTooltip={selectedProjectTooltip}
                selectedProjectPath={selectedProjectPath || null}
                preferredShell={settings.defaultShell}
                gitRefreshToken={gitRefreshToken}
                onToggleLeftSidebar={props.onToggleLeftSidebar}
                onTogglePlanPanel={props.onTogglePlanPanel}
                onCreateThread={handleCreateThread}
                onToggleRightSidebar={handleToggleDetailsPanel}
            />
            <AssistantConversationTimelinePane
                loading={controller.loading}
                timelineContentRef={timelineContentRef}
                timelineScrollRef={timelineScrollRef}
                messages={controller.timelineMessages}
                activities={controller.activityFeed}
                proposedPlans={controller.activeThread?.proposedPlans || []}
                latestProjectLabel={latestProjectLabel}
                projectTitle={selectedProjectPath || null}
                assistantMessageFilePath={assistantMessageFilePath}
                windowKey={`${controller.selectedSession?.id || 'no-session'}:${controller.activeThread?.id || 'no-thread'}`}
                isWorking={isThreadWorking}
                activeStatusLabel={activeStatusLabel}
                isConnecting={isThreadConnecting}
                activeWorkStartedAt={controller.activeThread?.latestTurn?.startedAt || null}
                latestAssistantMessageId={controller.activeThread?.latestTurn?.assistantMessageId || null}
                latestTurnStartedAt={controller.activeThread?.latestTurn?.startedAt || null}
                deletingMessageId={props.deletingMessageId}
                loadingChats={isLoadingSelectedChat}
                assistantTextStreamingMode={settings.assistantTextStreamingMode}
                showScrollToBottom={showScrollToBottom}
                elevateScrollToBottom={elevateScrollToBottom}
                onScrollButtonBoundsChange={setScrollButtonBounds}
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
                thinking={controller.commandPending || isThreadWorking}
                selectedSessionId={controller.selectedSession?.id || null}
                assistantAvailable={controller.available}
                assistantConnected={controller.connected}
                selectedProjectPath={selectedProjectPath || null}
                availableModels={availableModels}
                activeModel={controller.activeThread?.model || availableModels[0]?.id || undefined}
                modelsLoading={controller.modelsLoading}
                runtimeMode={controller.activeThread?.runtimeMode || 'approval-required'}
                interactionMode={effectiveInteractionMode}
                activeProfile={controller.activeThread?.runtimeMode === 'full-access' ? 'yolo-fast' : 'safe-dev'}
                activeStatusLabel={activeStatusLabel}
                onStop={handleStopTurn}
                onOpenAttachmentPreview={props.onOpenAttachmentPreview}
                onAttachmentShelfBoundsChange={setAttachmentShelfBounds}
                sendPrompt={handleSendPrompt}
                refreshModels={handleRefreshModels}
                respondUserInput={handleRespondUserInput}
                approvePendingPlaygroundLabRequest={handleApprovePendingPlaygroundLabRequest}
                declinePendingPlaygroundLabRequest={handleDeclinePendingPlaygroundLabRequest}
            />
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
