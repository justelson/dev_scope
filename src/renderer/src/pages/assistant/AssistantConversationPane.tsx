import { useCallback, useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react'
import { ChevronLeft, ChevronRight, ListTodo, MoreHorizontal, PanelLeft, PanelRight, SquarePen } from 'lucide-react'
import { useSettings } from '@/lib/settings'
import { cn } from '@/lib/utils'
import { isAssistantThreadActivelyWorking } from '@/lib/assistant/selectors'
import type { AssistantDiffTarget } from './assistant-diff-types'
import { buildPromptWithContextFiles } from './assistant-composer-utils'
import { AssistantConversationComposerPane } from './AssistantConversationComposerPane'
import { AssistantConversationTimelinePane } from './AssistantConversationTimelinePane'
import { AssistantProjectGitChip } from './AssistantProjectGitChip'
import type { AssistantComposerSendOptions, ComposerContextFile } from './assistant-composer-types'

const TIMELINE_SHOW_SCROLL_BUTTON_THRESHOLD_PX = 420
const TIMELINE_HIDE_SCROLL_BUTTON_THRESHOLD_PX = 180

export function AssistantConversationPane(props: {
    rightPanelOpen: boolean
    rightPanelMode: 'none' | 'details' | 'plan' | 'diff'
    planPanelAvailable: boolean
    planProgressLabel: string | null
    planIsComplete: boolean
    showHeaderMenu: boolean
    setShowHeaderMenu: (value: boolean) => void
    headerMenuRef: RefObject<HTMLDivElement | null>
    timelineScrollRef: RefObject<HTMLDivElement | null>
    deletingMessageId: string | null
    latestProjectLabel: string
    assistantMessageFilePath?: string | null
    leftSidebarCollapsed: boolean
    onToggleLeftSidebar: () => void
    availableModels: Array<{ id: string; label: string; description?: string }>
    controller: any
    onScrollTimeline: (element: HTMLDivElement) => void
    onScrollToBottom: () => void
    onRequestDeleteUserMessage: (message: any) => void
    onToggleRightSidebar: () => void
    onTogglePlanPanel: () => void
    onOpenAssistantLink?: (href: string) => Promise<void> | void
    onOpenEditedFile?: (filePath: string) => Promise<void> | void
    onViewDiff?: (target: AssistantDiffTarget) => void
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
        timelineScrollRef,
        deletingMessageId,
        latestProjectLabel,
        assistantMessageFilePath,
        leftSidebarCollapsed,
        onToggleLeftSidebar,
        availableModels,
        controller,
        onScrollTimeline,
        onScrollToBottom,
        onRequestDeleteUserMessage,
        onToggleRightSidebar,
        onTogglePlanPanel,
        onOpenAssistantLink,
        onOpenEditedFile,
        onViewDiff
    } = props
    const { settings } = useSettings()
    const isThreadWorking = isAssistantThreadActivelyWorking(controller.activeThread)
    const isThreadConnecting = controller.phase.key === 'starting' || (controller.commandPending && !isThreadWorking)
    const activeStatusLabel = isThreadConnecting ? 'Connecting...' : 'Working...'
    const [showScrollToBottom, setShowScrollToBottom] = useState(false)
    const showScrollToBottomRef = useRef(false)
    const scrollButtonRafRef = useRef<number | null>(null)
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

    const handleScrollToBottomClick = useCallback(() => {
        showScrollToBottomRef.current = false
        setShowScrollToBottom(false)
        onScrollToBottom()
    }, [onScrollToBottom])

    const handleRefreshModels = useCallback(() => {
        void controller.refreshModels()
    }, [controller.refreshModels])

    const handleRespondUserInput = useCallback(async (requestId: string, answers: Record<string, string | string[]>) => {
        await controller.respondUserInput(requestId, answers)
    }, [controller.respondUserInput])

    const handleSendPrompt = useCallback(async (
        prompt: string,
        contextFiles: ComposerContextFile[],
        options: AssistantComposerSendOptions
    ) => {
        const result = await controller.sendPromptResult(buildPromptWithContextFiles(prompt, contextFiles), {
            sessionId: controller.selectedSession?.id || undefined,
            model: options.model,
            runtimeMode: options.runtimeMode,
            interactionMode: options.interactionMode,
            effort: options.effort,
            serviceTier: options.serviceTier
        })
        return result.success
    }, [controller.selectedSession?.id, controller.sendPromptResult])
    const selectedProjectPath = controller.selectedSession?.projectPath || controller.activeThread?.cwd || null
    const gitRefreshToken = `${controller.selectedSession?.id || 'no-session'}:${controller.activeThread?.id || 'no-thread'}:${controller.activeThread?.latestTurn?.id || 'no-turn'}:${controller.activeThread?.latestTurn?.state || 'idle'}:${controller.commandPending ? 'busy' : 'idle'}`

    return (
        <section className={cn('flex min-w-0 flex-1 flex-col', rightPanelOpen && 'border-r border-white/10')}>
            <div className="flex items-center justify-between gap-2 border-b border-white/10 bg-sparkle-card px-3 py-1.5">
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
                    <h2 className="truncate text-[13px] font-semibold leading-none text-sparkle-text">{controller.selectedSession?.title || 'Assistant'}</h2>
                    <span className="inline-flex max-w-[220px] shrink-0 items-center rounded-full border border-white/10 bg-white/[0.03] px-2 py-0.5 text-[10px] font-medium leading-none text-sparkle-text-secondary" title={controller.selectedSession?.projectPath || controller.activeThread?.cwd || 'No project selected'}>
                        <span className="truncate">{latestProjectLabel}</span>
                    </span>
                </div>
                <div ref={headerMenuRef} className="relative flex shrink-0 items-center gap-1.5">
                    <AssistantProjectGitChip
                        projectPath={selectedProjectPath}
                        refreshToken={gitRefreshToken}
                    />
                    {planPanelAvailable ? (
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
                            title="Show plan panel"
                        >
                            <ListTodo size={13} />
                            <span>{planProgressLabel || 'Plan'}</span>
                        </button>
                    ) : null}
                    <button type="button" onClick={() => setShowHeaderMenu(!showHeaderMenu)} className="inline-flex size-8 items-center justify-center rounded-lg border border-white/10 bg-sparkle-card text-sparkle-text-secondary transition-colors hover:border-white/20 hover:bg-white/[0.03] hover:text-sparkle-text" title="More actions"><MoreHorizontal size={14} /></button>
                    {showHeaderMenu && <div className="absolute right-0 top-full z-20 mt-2 w-52 rounded-lg border border-white/10 bg-sparkle-card p-1 shadow-lg">
                        <button type="button" onClick={() => { void controller.newThread(controller.selectedSession?.id || undefined); setShowHeaderMenu(false) }} className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-xs text-sparkle-text-secondary transition-colors hover:bg-sparkle-card-hover hover:text-sparkle-text"><SquarePen size={13} />New thread</button>
                        <button type="button" onClick={() => { onToggleRightSidebar(); setShowHeaderMenu(false) }} className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-xs text-sparkle-text-secondary transition-colors hover:bg-sparkle-card-hover hover:text-sparkle-text">{rightPanelMode === 'details' ? <PanelRight size={13} /> : <PanelLeft size={13} />}{rightPanelMode === 'details' ? 'Hide details' : 'Show details'}</button>
                    </div>}
                </div>
            </div>
            <AssistantConversationTimelinePane
                loading={controller.loading}
                timelineScrollRef={timelineScrollRef}
                messages={controller.timelineMessages}
                activities={controller.activityFeed}
                latestProjectLabel={latestProjectLabel}
                projectTitle={controller.selectedSession?.projectPath || controller.activeThread?.cwd || null}
                assistantMessageFilePath={assistantMessageFilePath}
                windowKey={`${controller.selectedSession?.id || 'no-session'}:${controller.activeThread?.id || 'no-thread'}`}
                isWorking={isThreadWorking}
                activeStatusLabel={activeStatusLabel}
                isConnecting={isThreadConnecting}
                activeWorkStartedAt={controller.activeThread?.latestTurn?.startedAt || null}
                latestAssistantMessageId={controller.activeThread?.latestTurn?.assistantMessageId || null}
                latestTurnStartedAt={controller.activeThread?.latestTurn?.startedAt || null}
                deletingMessageId={deletingMessageId}
                loadingChats={isLoadingSelectedChat}
                assistantTextStreamingMode={settings.assistantTextStreamingMode}
                showScrollToBottom={showScrollToBottom}
                onScrollTimeline={handleTimelineScrollEvent}
                onScrollToBottom={handleScrollToBottomClick}
                onRequestDeleteUserMessage={onRequestDeleteUserMessage}
                onOpenAssistantLink={onOpenAssistantLink}
                onOpenEditedFile={onOpenEditedFile}
                onViewDiff={onViewDiff}
            />
            <AssistantConversationComposerPane
                pendingUserInputs={controller.pendingUserInputs}
                commandPending={controller.commandPending}
                thinking={controller.commandPending || isThreadWorking}
                selectedSessionId={controller.selectedSession?.id || null}
                assistantAvailable={Boolean(controller.status?.available)}
                assistantConnected={Boolean(controller.status?.connected)}
                selectedProjectPath={controller.selectedSession?.projectPath || controller.activeThread?.cwd || null}
                availableModels={availableModels}
                activeModel={controller.activeThread?.model || availableModels[0]?.id || undefined}
                modelsLoading={controller.modelsLoading}
                runtimeMode={controller.activeThread?.runtimeMode || 'approval-required'}
                interactionMode={controller.activeThread?.interactionMode || 'default'}
                activeProfile={controller.activeThread?.runtimeMode === 'full-access' ? 'yolo-fast' : 'safe-dev'}
                activeStatusLabel={activeStatusLabel}
                sendPrompt={handleSendPrompt}
                refreshModels={handleRefreshModels}
                respondUserInput={handleRespondUserInput}
            />
        </section>
    )
}
