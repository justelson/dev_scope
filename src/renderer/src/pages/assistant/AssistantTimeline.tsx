import type { RefObject } from 'react'
import { memo, useMemo } from 'react'
import type { AssistantActivity, AssistantMessage } from '@shared/assistant/contracts'
import type { AssistantTextStreamingMode } from '@/lib/settings'
import { LoadingSpinner } from '@/components/ui/LoadingState'
import type { AssistantDiffTarget } from './assistant-diff-types'
import {
    TimelineEmptyState,
    TimelineMessage,
    TimelineToolCallList,
    TimelineWorkingIndicator
} from './AssistantTimelineRows'
import { buildTimelineRows, estimateTimelineRowHeight, type TimelineRenderRow } from './assistant-timeline-helpers'
import { useAssistantTimelineEntries } from './useAssistantTimelineEntries'
import { useAssistantTimelineWindow } from './useAssistantTimelineWindow'

type AssistantTimelineProps = {
    messages: AssistantMessage[]
    activities: AssistantActivity[]
    projectLabel?: string | null
    projectTitle?: string | null
    projectRootPath?: string | null
    assistantMessageFilePath?: string | null
    windowKey?: string
    scrollContainerRef?: RefObject<HTMLDivElement | null>
    isWorking?: boolean
    workingLabel?: string
    activeWorkStartedAt?: string | null
    latestAssistantMessageId?: string | null
    latestTurnStartedAt?: string | null
    deletingMessageId?: string | null
    loadingChats?: boolean
    assistantTextStreamingMode?: AssistantTextStreamingMode
    isConnecting?: boolean
    onRequestDeleteUserMessage?: (message: AssistantMessage) => void
    onOpenInternalLink?: (href: string) => Promise<void> | void
    onOpenFilePath?: (filePath: string) => Promise<void> | void
    onViewDiff?: (target: AssistantDiffTarget) => void
}

function AssistantTimelineImpl({
    messages,
    activities,
    projectLabel = null,
    projectTitle = null,
    projectRootPath = null,
    assistantMessageFilePath = null,
    windowKey = 'default',
    scrollContainerRef,
    isWorking = false,
    workingLabel = 'Working...',
    activeWorkStartedAt = null,
    latestAssistantMessageId = null,
    latestTurnStartedAt = null,
    deletingMessageId = null,
    loadingChats = false,
    assistantTextStreamingMode = 'stream',
    isConnecting = false,
    onRequestDeleteUserMessage,
    onOpenInternalLink,
    onOpenFilePath,
    onViewDiff
}: AssistantTimelineProps) {
    const entries = useAssistantTimelineEntries(messages, activities)
    const timelineWindow = useAssistantTimelineWindow({
        entryCount: entries.length,
        resetKey: windowKey,
        scrollContainerRef
    })
    const visibleEntries = useMemo(
        () => entries.slice(timelineWindow.startIndex),
        [entries, timelineWindow.startIndex]
    )
    const rows = useMemo(
        () => buildTimelineRows(visibleEntries, isWorking, activeWorkStartedAt),
        [activeWorkStartedAt, isWorking, visibleEntries]
    )
    const hasStreamingAssistantMessage = useMemo(
        () => messages.some((message) => message.role === 'assistant' && message.streaming),
        [messages]
    )

    if (loadingChats) {
        return (
            <LoadingSpinner
                message="Loading chat..."
                detail="Restoring the selected conversation."
                className="py-0"
                minHeightClassName="min-h-[280px]"
            />
        )
    }

    if (rows.length === 0) {
        return <TimelineEmptyState projectLabel={projectLabel} projectTitle={projectTitle} isConnecting={isConnecting} connectingLabel={workingLabel} />
    }

    const renderRow = (row: TimelineRenderRow) => {
        if (row.kind === 'activity-group') {
            return (
                <TimelineToolCallList
                    key={row.id}
                    activities={row.activities}
                    projectRootPath={projectRootPath}
                    onOpenFilePath={onOpenFilePath}
                    onViewDiff={onViewDiff}
                />
            )
        }
        if (row.kind === 'activity') {
            return (
                <TimelineToolCallList
                    key={row.id}
                    activities={[row.activity]}
                    projectRootPath={projectRootPath}
                    onOpenFilePath={onOpenFilePath}
                    onViewDiff={onViewDiff}
                />
            )
        }
        if (row.kind === 'working') {
            return hasStreamingAssistantMessage ? null : <TimelineWorkingIndicator key={row.id} startedAt={activeWorkStartedAt} label={workingLabel} />
        }
        return (
            <TimelineMessage
                key={row.id}
                message={row.message}
                isLatestAssistant={row.message.role === 'assistant' && row.message.id === latestAssistantMessageId}
                latestTurnStartedAt={latestTurnStartedAt}
                deleting={row.message.id === deletingMessageId}
                assistantTextStreamingMode={assistantTextStreamingMode}
                onRequestDelete={row.message.role === 'user' ? onRequestDeleteUserMessage : undefined}
                filePath={row.message.role === 'assistant' ? assistantMessageFilePath : null}
                onInternalLinkClick={row.message.role === 'assistant' ? onOpenInternalLink : undefined}
            />
        )
    }

    return (
        <div className="pb-4">
            {rows.map((row) => (
                <div
                    key={row.id}
                    className="pb-4"
                    style={{
                        contentVisibility: 'auto',
                        containIntrinsicSize: `${estimateTimelineRowHeight(row)}px`
                    }}
                >
                    {renderRow(row)}
                </div>
            ))}
        </div>
    )
}

export const AssistantTimeline = memo(AssistantTimelineImpl)
