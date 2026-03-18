import { useMemo } from 'react'
import type { AssistantActivity, AssistantMessage } from '@shared/assistant/contracts'
import {
    getTimelineEntries,
    TimelineEmptyState,
    TimelineMessage,
    TimelineToolCallList,
    TimelineWorkingIndicator
} from './AssistantTimelineParts'

type AssistantTimelineProps = {
    messages: AssistantMessage[]
    activities: AssistantActivity[]
    isWorking?: boolean
    activeWorkStartedAt?: string | null
    latestAssistantMessageId?: string | null
    latestTurnStartedAt?: string | null
    deletingMessageId?: string | null
    onRequestDeleteUserMessage?: (message: AssistantMessage) => void
}

export function AssistantTimeline({
    messages,
    activities,
    isWorking = false,
    activeWorkStartedAt = null,
    latestAssistantMessageId = null,
    latestTurnStartedAt = null,
    deletingMessageId = null,
    onRequestDeleteUserMessage
}: AssistantTimelineProps) {
    const entries = useMemo(() => getTimelineEntries(messages, activities), [messages, activities])
    const hasStreamingAssistantMessage = useMemo(
        () => messages.some((message) => message.role === 'assistant' && message.streaming),
        [messages]
    )

    if (entries.length === 0) {
        return <TimelineEmptyState />
    }

    return (
        <div className="space-y-4 pb-4">
            {entries.map((entry) => {
                if (entry.type === 'activity-group' && entry.activities) {
                    return <TimelineToolCallList key={entry.id} activities={entry.activities} />
                }
                if (entry.type === 'activity' && entry.activity) {
                    return <TimelineToolCallList key={entry.id} activities={[entry.activity]} />
                }
                if (entry.type === 'message' && entry.message) {
                    return (
                        <TimelineMessage
                            key={entry.id}
                            message={entry.message}
                            isLatestAssistant={entry.message.role === 'assistant' && entry.message.id === latestAssistantMessageId}
                            latestTurnStartedAt={latestTurnStartedAt}
                            deleting={entry.message.id === deletingMessageId}
                            onRequestDelete={entry.message.role === 'user' ? onRequestDeleteUserMessage : undefined}
                        />
                    )
                }
                return null
            })}
            {isWorking && !hasStreamingAssistantMessage ? <TimelineWorkingIndicator startedAt={activeWorkStartedAt} /> : null}
        </div>
    )
}
