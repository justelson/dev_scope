import type { RefObject } from 'react'
import { ArrowDown, MoreHorizontal, PlugZap, RefreshCcw, Unplug } from 'lucide-react'
import { cn } from '@/lib/utils'
import { LoadingSpinner } from '@/components/ui/LoadingState'
import { AssistantComposer } from './AssistantComposer'
import { AssistantTimeline } from './AssistantTimeline'
import { buildPromptWithContextFiles } from './assistant-composer-utils'

export function AssistantConversationPane(props: {
    rightSidebarOpen: boolean
    showHeaderMenu: boolean
    setShowHeaderMenu: (value: boolean) => void
    headerMenuRef: RefObject<HTMLDivElement | null>
    timelineScrollRef: RefObject<HTMLDivElement | null>
    showScrollToBottom: boolean
    deletingMessageId: string | null
    latestProjectLabel: string
    availableModels: Array<{ id: string; label: string; description?: string }>
    controller: any
    onScrollTimeline: (element: HTMLDivElement) => void
    onScrollToBottom: () => void
    onRequestDeleteUserMessage: (message: any) => void
    onToggleRightSidebar: () => void
}) {
    const { rightSidebarOpen, showHeaderMenu, setShowHeaderMenu, headerMenuRef, timelineScrollRef, showScrollToBottom, deletingMessageId, latestProjectLabel, availableModels, controller, onScrollTimeline, onScrollToBottom, onRequestDeleteUserMessage, onToggleRightSidebar } = props

    return (
        <section className={cn('flex min-w-0 flex-1 flex-col transition-all duration-300', rightSidebarOpen && 'border-r border-white/10')}>
            <div className="flex items-center justify-between gap-2 border-b border-white/10 bg-sparkle-card px-3 py-1.5">
                <div className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden">
                    <h2 className="truncate text-[13px] font-semibold leading-none text-sparkle-text">{controller.selectedSession?.title || 'Assistant'}</h2>
                    <span className="inline-flex max-w-[220px] shrink-0 items-center rounded-full border border-white/10 bg-white/[0.03] px-2 py-0.5 text-[10px] font-medium leading-none text-sparkle-text-secondary" title={controller.selectedSession?.projectPath || controller.activeThread?.cwd || 'No project selected'}>
                        <span className="truncate">{latestProjectLabel}</span>
                    </span>
                </div>
                <div ref={headerMenuRef} className="relative flex shrink-0 items-center gap-1.5">
                    <button type="button" onClick={() => { if (controller.status?.connected) { void controller.disconnect(controller.selectedSession?.id || undefined) } else { void controller.connect(controller.selectedSession?.id || undefined) } }} disabled={controller.commandPending} className={cn('rounded-lg border p-1 transition-colors disabled:opacity-60', controller.status?.connected ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/15' : 'border-white/10 bg-sparkle-card text-sparkle-text-secondary hover:border-white/20 hover:bg-white/[0.03] hover:text-sparkle-text')} title={controller.status?.connected ? 'Disconnect assistant' : 'Connect assistant'}><PlugZap size={14} /></button>
                    <button type="button" onClick={() => setShowHeaderMenu(!showHeaderMenu)} className="rounded-lg border border-white/10 bg-sparkle-card p-1.5 text-sparkle-text-secondary transition-colors hover:border-white/20 hover:bg-white/[0.03] hover:text-sparkle-text" title="More actions"><MoreHorizontal size={14} /></button>
                    {showHeaderMenu && <div className="absolute right-0 top-full z-20 mt-2 w-52 rounded-lg border border-white/10 bg-sparkle-card p-1 shadow-lg">
                        <button type="button" onClick={() => { void controller.refreshModels(); setShowHeaderMenu(false) }} className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-xs text-sparkle-text-secondary transition-colors hover:bg-sparkle-card-hover hover:text-sparkle-text"><RefreshCcw size={13} />Refresh models</button>
                        <button type="button" onClick={() => { void controller.newThread(controller.selectedSession?.id || undefined); setShowHeaderMenu(false) }} className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-xs text-sparkle-text-secondary transition-colors hover:bg-sparkle-card-hover hover:text-sparkle-text"><RefreshCcw size={13} />New thread</button>
                        <button type="button" onClick={() => { onToggleRightSidebar(); setShowHeaderMenu(false) }} className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-xs text-sparkle-text-secondary transition-colors hover:bg-sparkle-card-hover hover:text-sparkle-text">{rightSidebarOpen ? <Unplug size={13} /> : <PlugZap size={13} />}{rightSidebarOpen ? 'Hide details' : 'Show details'}</button>
                    </div>}
                </div>
            </div>
            <div className="relative flex-1 min-h-0 bg-sparkle-bg">
                {controller.loading ? (
                    <LoadingSpinner
                        message="Loading assistant snapshot..."
                        className="h-full py-0"
                        minHeightClassName="min-h-0"
                    />
                ) : (
                    <>
                        <div ref={timelineScrollRef} onScroll={(event) => onScrollTimeline(event.currentTarget)} className="custom-scrollbar h-full overflow-y-auto px-4 py-4">
                            <div className="mx-auto w-full max-w-3xl">
                                <AssistantTimeline
                                    messages={controller.timelineMessages}
                                    activities={controller.activityFeed}
                                    isWorking={controller.phase.key === 'running'}
                                    activeWorkStartedAt={controller.activeThread?.latestTurn?.startedAt || null}
                                    latestAssistantMessageId={controller.activeThread?.latestTurn?.assistantMessageId || null}
                                    latestTurnStartedAt={controller.activeThread?.latestTurn?.startedAt || null}
                                    deletingMessageId={deletingMessageId}
                                    onRequestDeleteUserMessage={onRequestDeleteUserMessage}
                                />
                            </div>
                        </div>
                        <div className="pointer-events-none absolute inset-x-0 bottom-4 flex justify-center px-4">
                            <button type="button" onClick={onScrollToBottom} className={cn('pointer-events-auto inline-flex items-center gap-2 rounded-full border border-white/10 bg-sparkle-card/95 px-3 py-2 text-xs text-sparkle-text-secondary shadow-lg shadow-black/20 backdrop-blur-xl transition-all hover:border-white/20 hover:bg-white/[0.05] hover:text-sparkle-text', showScrollToBottom ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-2 opacity-0')} title="Scroll to bottom"><ArrowDown size={13} />Scroll to bottom</button>
                        </div>
                    </>
                )}
            </div>
            <div className="relative px-4 py-3">
                <div className="mx-auto w-full max-w-3xl">
                    <AssistantComposer
                        disabled={controller.commandPending || !controller.selectedSession || !controller.status?.available}
                        isSending={controller.commandPending}
                        isThinking={controller.commandPending || controller.phase.key === 'running'}
                        isConnected={Boolean(controller.status?.connected)}
                        activeModel={controller.activeThread?.model || availableModels[0]?.id || undefined}
                        modelOptions={availableModels}
                        modelsLoading={controller.modelsLoading}
                        modelsError={null}
                        activeProfile={controller.activeThread?.runtimeMode === 'full-access' ? 'yolo-fast' : 'safe-dev'}
                        runtimeMode={controller.activeThread?.runtimeMode || 'approval-required'}
                        interactionMode={controller.activeThread?.interactionMode || 'default'}
                        projectPath={controller.selectedSession?.projectPath || controller.activeThread?.cwd || null}
                        onRefreshModels={() => void controller.refreshModels()}
                        onSend={async (prompt, contextFiles, options) => {
                            const result = await controller.sendPromptResult(buildPromptWithContextFiles(prompt, contextFiles), {
                                sessionId: controller.selectedSession?.id || undefined,
                                model: options.model,
                                runtimeMode: options.runtimeMode,
                                interactionMode: options.interactionMode,
                                effort: options.effort,
                                serviceTier: options.serviceTier
                            })
                            return result.success
                        }}
                    />
                </div>
            </div>
        </section>
    )
}
