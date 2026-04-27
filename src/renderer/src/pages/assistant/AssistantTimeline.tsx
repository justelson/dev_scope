import type { ReactNode, RefObject } from 'react'
import { memo, useMemo } from 'react'
import type { AssistantActivity, AssistantMessage, AssistantProposedPlan, AssistantSessionTurnUsageEntry } from '@shared/assistant/contracts'
import type { PreviewOpenOptions } from '@/components/ui/file-preview/types'
import type { AssistantTextStreamingMode, AssistantToolOutputDefaultMode } from '@/lib/settings'
import type { AssistantDiffTarget } from './assistant-diff-types'
import {
    TimelineContextCompactionMarker,
    TimelineEmptyState,
    TimelineIssueList,
    TimelineMessage,
    TimelineProposedPlan,
    TimelineToolCallList,
    TimelineWorkingIndicator
} from './AssistantTimelineRows'
import { buildTimelineRows, isContextCompactionActivity, isIssueActivity, type TimelineRenderRow } from './assistant-timeline-helpers'
import { useAssistantTimelineEntries } from './useAssistantTimelineEntries'
import { useAssistantTimelineWindow } from './useAssistantTimelineWindow'

type AssistantTimelineProps = {
    messages: AssistantMessage[]
    activities: AssistantActivity[]
    proposedPlans?: AssistantProposedPlan[]
    projectLabel?: string | null
    projectTitle?: string | null
    sessionMode?: 'work' | 'playground'
    projectRootPath?: string | null
    assistantMessageFilePath?: string | null
    windowKey?: string
    scrollContainerRef?: RefObject<HTMLDivElement | null>
    overlayContainerRef?: RefObject<HTMLDivElement | null>
    isWorking?: boolean
    workingLabel?: string
    activeWorkStartedAt?: string | null
    latestAssistantMessageId?: string | null
    latestTurnStartedAt?: string | null
    turnUsageById?: ReadonlyMap<string, AssistantSessionTurnUsageEntry>
    deletingMessageId?: string | null
    loadingChats?: boolean
    assistantTextStreamingMode?: AssistantTextStreamingMode
    assistantToolOutputDefaultMode?: AssistantToolOutputDefaultMode
    isConnecting?: boolean
    onRequestDeleteUserMessage?: (message: AssistantMessage) => void
    onImplementProposedPlan?: (plan: AssistantProposedPlan) => Promise<void> | void
    onShowPlanPanel?: () => void
    onOpenAttachmentPreview?: (
        file: { name: string; path: string },
        ext: string,
        options?: PreviewOpenOptions
    ) => Promise<void> | void
    onOpenInternalLink?: (href: string) => Promise<void> | void
    onOpenFilePath?: (filePath: string) => Promise<void> | void
    onViewDiff?: (target: AssistantDiffTarget) => void
}

function AssistantTimelineImpl({
    messages,
    activities,
    proposedPlans = [],
    projectLabel = null,
    projectTitle = null,
    sessionMode = 'work',
    projectRootPath = null,
    assistantMessageFilePath = null,
    windowKey = 'default',
    scrollContainerRef,
    overlayContainerRef,
    isWorking = false,
    workingLabel = 'Working...',
    activeWorkStartedAt = null,
    latestAssistantMessageId = null,
    latestTurnStartedAt = null,
    turnUsageById,
    deletingMessageId = null,
    loadingChats = false,
    assistantTextStreamingMode = 'stream',
    assistantToolOutputDefaultMode = 'expanded',
    isConnecting = false,
    onRequestDeleteUserMessage,
    onImplementProposedPlan,
    onShowPlanPanel,
    onOpenAttachmentPreview,
    onOpenInternalLink,
    onOpenFilePath,
    onViewDiff
}: AssistantTimelineProps) {
    const timelineEntryCount = messages.length + activities.length + proposedPlans.length
    const timelineWindow = useAssistantTimelineWindow({
        entryCount: timelineEntryCount,
        resetKey: windowKey,
        scrollContainerRef
    })
    const entries = useAssistantTimelineEntries(
        messages,
        activities,
        proposedPlans,
        timelineWindow.loadedEntryCount
    )
    const visibleEntries = entries
    const rows = useMemo(
        () => buildTimelineRows(visibleEntries, isWorking, activeWorkStartedAt),
        [activeWorkStartedAt, isWorking, visibleEntries]
    )
    const lastAssistantMessageIdByTurn = useMemo(() => {
        const next = new Map<string, string>()
        for (const message of messages) {
            if (message.role !== 'assistant' || !message.turnId) continue
            next.set(message.turnId, message.id)
        }
        return next
    }, [messages])

    if (loadingChats) {
        return <div className="min-h-[220px]" aria-busy="true" />
    }

    if (rows.length === 0) {
        return (
            <TimelineEmptyState
                projectLabel={projectLabel}
                projectTitle={projectTitle}
                sessionMode={sessionMode}
                showStatusIndicator={isConnecting || isWorking}
                statusIndicatorLabel={workingLabel}
            />
        )
    }

    const renderRow = (row: TimelineRenderRow) => {
        if (row.kind === 'activity-group') {
            if (row.activities.every((activity) => isIssueActivity(activity))) {
                return (
                    <TimelineIssueList
                        key={row.id}
                        activities={row.activities}
                    />
                )
            }
            return (
                <TimelineToolCallList
                    key={row.id}
                    activities={row.activities}
                    projectRootPath={projectRootPath}
                    toolOutputDefaultMode={assistantToolOutputDefaultMode}
                    onOpenFilePath={onOpenFilePath}
                    onViewDiff={onViewDiff}
                />
            )
        }
        if (row.kind === 'activity') {
            if (isContextCompactionActivity(row.activity)) {
                return (
                    <TimelineContextCompactionMarker
                        key={row.id}
                        activity={row.activity}
                    />
                )
            }
            if (isIssueActivity(row.activity)) {
                return (
                    <TimelineIssueList
                        key={row.id}
                        activities={[row.activity]}
                    />
                )
            }
            return (
                <TimelineToolCallList
                    key={row.id}
                    activities={[row.activity]}
                    projectRootPath={projectRootPath}
                    toolOutputDefaultMode={assistantToolOutputDefaultMode}
                    onOpenFilePath={onOpenFilePath}
                    onViewDiff={onViewDiff}
                />
            )
        }
        if (row.kind === 'working') {
            return <TimelineWorkingIndicator key={row.id} startedAt={activeWorkStartedAt} label={workingLabel} />
        }
        if (row.kind === 'plan') {
            return (
                <TimelineProposedPlan
                    key={row.id}
                    plan={row.plan}
                    canImplement={row.canImplement && !isWorking}
                    onImplement={onImplementProposedPlan}
                    onShowPlanPanel={onShowPlanPanel}
                    scrollContainerRef={scrollContainerRef}
                    overlayContainerRef={overlayContainerRef}
                    filePath={assistantMessageFilePath}
                    onInternalLinkClick={onOpenInternalLink}
                />
            )
        }
        return (
            <TimelineMessage
                key={row.id}
                message={row.message}
                isLatestAssistant={row.message.role === 'assistant' && row.message.id === latestAssistantMessageId}
                isLastAssistantInTurn={row.message.role === 'assistant' && !!row.message.turnId && lastAssistantMessageIdByTurn.get(row.message.turnId) === row.message.id}
                latestTurnStartedAt={latestTurnStartedAt}
                turnUsage={row.message.role === 'assistant' && row.message.turnId ? (turnUsageById?.get(row.message.turnId) || null) : null}
                deleting={row.message.id === deletingMessageId}
                assistantTextStreamingMode={assistantTextStreamingMode}
                onRequestDelete={row.message.role === 'user' ? onRequestDeleteUserMessage : undefined}
                onOpenFilePath={row.message.role === 'user' ? onOpenFilePath : undefined}
                filePath={row.message.role === 'assistant' ? assistantMessageFilePath : null}
                onInternalLinkClick={row.message.role === 'assistant' ? onOpenInternalLink : undefined}
                onOpenAttachmentPreview={row.message.role === 'user' ? onOpenAttachmentPreview : undefined}
            />
        )
    }

    const renderRowContainer = (row: TimelineRenderRow, content: ReactNode) => {
        if (!content) return null
        return (
            <div
                key={row.id}
                className="pb-4"
            >
                {content}
            </div>
        )
    }

    return (
        <div>
            {rows.map((row) => renderRowContainer(row, renderRow(row)))}
        </div>
    )
}

export const AssistantTimeline = memo(AssistantTimelineImpl)
