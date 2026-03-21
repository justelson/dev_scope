import { memo, type RefObject } from 'react'
import { ArrowDown } from 'lucide-react'
import type { AssistantActivity, AssistantMessage } from '@shared/assistant/contracts'
import type { AssistantTextStreamingMode } from '@/lib/settings'
import { LoadingSpinner } from '@/components/ui/LoadingState'
import { cn } from '@/lib/utils'
import { AssistantTimeline } from './AssistantTimeline'
import type { AssistantDiffTarget } from './assistant-diff-types'

export const AssistantConversationTimelinePane = memo(function AssistantConversationTimelinePane(props: {
    loading: boolean
    timelineScrollRef: RefObject<HTMLDivElement | null>
    messages: AssistantMessage[]
    activities: AssistantActivity[]
    latestProjectLabel: string
    projectTitle: string | null
    assistantMessageFilePath?: string | null
    windowKey: string
    isWorking: boolean
    activeStatusLabel: string
    isConnecting: boolean
    activeWorkStartedAt: string | null
    latestAssistantMessageId: string | null
    latestTurnStartedAt: string | null
    deletingMessageId: string | null
    loadingChats: boolean
    assistantTextStreamingMode: AssistantTextStreamingMode
    showScrollToBottom: boolean
    onScrollTimeline: (element: HTMLDivElement) => void
    onScrollToBottom: () => void
    onRequestDeleteUserMessage: (message: AssistantMessage) => void
    onOpenAssistantLink?: (href: string) => Promise<void> | void
    onOpenEditedFile?: (filePath: string) => Promise<void> | void
    onViewDiff?: (target: AssistantDiffTarget) => void
}) {
    const projectRootPath = props.projectTitle

    return (
        <div className="relative flex-1 min-h-0 bg-sparkle-bg">
            {props.loading ? (
                <LoadingSpinner
                    message="Loading assistant snapshot..."
                    className="h-full py-0"
                    minHeightClassName="min-h-0"
                />
            ) : (
                <>
                    <div
                        ref={props.timelineScrollRef}
                        onScroll={(event) => props.onScrollTimeline(event.currentTarget)}
                        className="custom-scrollbar h-full overflow-y-auto px-4 py-4"
                    >
                        <div className="mx-auto w-full max-w-3xl">
                            <AssistantTimeline
                                messages={props.messages}
                                activities={props.activities}
                                projectLabel={props.latestProjectLabel !== 'not set' ? props.latestProjectLabel : null}
                                projectTitle={projectRootPath}
                                projectRootPath={projectRootPath}
                                assistantMessageFilePath={props.assistantMessageFilePath}
                                windowKey={props.windowKey}
                                scrollContainerRef={props.timelineScrollRef}
                                isWorking={props.isWorking}
                                workingLabel={props.activeStatusLabel}
                                activeWorkStartedAt={props.activeWorkStartedAt}
                                latestAssistantMessageId={props.latestAssistantMessageId}
                                latestTurnStartedAt={props.latestTurnStartedAt}
                                deletingMessageId={props.deletingMessageId}
                                loadingChats={props.loadingChats}
                                assistantTextStreamingMode={props.assistantTextStreamingMode}
                                isConnecting={props.isConnecting}
                                onRequestDeleteUserMessage={props.onRequestDeleteUserMessage}
                                onOpenInternalLink={props.onOpenAssistantLink}
                                onOpenFilePath={props.onOpenEditedFile}
                                onViewDiff={props.onViewDiff}
                            />
                        </div>
                    </div>
                    <div className="pointer-events-none absolute inset-x-0 bottom-4 flex justify-center px-4">
                        <button
                            type="button"
                            onClick={props.onScrollToBottom}
                            className={cn(
                                'pointer-events-auto inline-flex items-center gap-2 rounded-full border border-white/10 bg-sparkle-card/95 px-3 py-2 text-xs text-sparkle-text-secondary shadow-lg shadow-black/20 backdrop-blur-xl transition-all hover:border-white/20 hover:bg-white/[0.05] hover:text-sparkle-text',
                                props.showScrollToBottom ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-2 opacity-0'
                            )}
                            title="Scroll to bottom"
                        >
                            <ArrowDown size={13} />
                            Scroll to bottom
                        </button>
                    </div>
                </>
            )}
        </div>
    )
})
