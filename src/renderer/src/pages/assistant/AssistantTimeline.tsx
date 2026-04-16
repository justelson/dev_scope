import type { ReactNode, RefObject } from 'react'
import { memo, useMemo } from 'react'
import type { AssistantActivity, AssistantMessage, AssistantProposedPlan, AssistantSessionTurnUsageEntry } from '@shared/assistant/contracts'
import type { PreviewOpenOptions } from '@/components/ui/file-preview/types'
import type { AssistantTextStreamingMode } from '@/lib/settings'
import { LoadingSpinner } from '@/components/ui/LoadingState'
import type { AssistantDiffTarget } from './assistant-diff-types'
import {
    TimelineEmptyState,
    TimelineMessage,
    TimelineProposedPlan,
    TimelineToolCallList,
    TimelineWorkingIndicator
} from './AssistantTimelineRows'
import { buildTimelineRows, estimateTimelineRowHeight, type TimelineRenderRow } from './assistant-timeline-helpers'
import { useAssistantTimelineEntries } from './useAssistantTimelineEntries'
import { useAssistantTimelineVirtualizer } from './useAssistantTimelineVirtualizer'
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
    isConnecting = false,
    onRequestDeleteUserMessage,
    onImplementProposedPlan,
    onShowPlanPanel,
    onOpenAttachmentPreview,
    onOpenInternalLink,
    onOpenFilePath,
    onViewDiff
}: AssistantTimelineProps) {
    const entries = useAssistantTimelineEntries(messages, activities, proposedPlans)
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
    const timelineVirtualizer = useAssistantTimelineVirtualizer({
        rows,
        resetKey: windowKey,
        scrollContainerRef
    })
    const hasStreamingAssistantMessage = useMemo(
        () => messages.some((message) => message.role === 'assistant' && message.streaming),
        [messages]
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

    const renderRowContainer = (row: TimelineRenderRow, content: ReactNode, measured = false) => {
        if (!content) return null
        return (
            <div
                key={row.id}
                ref={measured ? timelineVirtualizer.getMeasuredRowRef(row.id) : undefined}
                className="pb-4"
                style={{
                    contentVisibility: 'auto',
                    containIntrinsicSize: `${estimateTimelineRowHeight(row, { containerWidth: timelineVirtualizer.viewportWidth })}px`
                }}
            >
                {content}
            </div>
        )
    }

    return (
        <div className="pb-4">
            {timelineWindow.hasHiddenEntries ? (
                <div className="mb-4">
                    <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/6 bg-white/[0.02] px-4 py-3">
                        <div className="min-w-0">
                            <p className="text-[12px] font-medium text-sparkle-text">Older timeline entries are collapsed for performance.</p>
                            <p className="mt-1 text-[11px] text-sparkle-text-muted">
                                Showing latest {timelineWindow.loadedEntryCount} of {entries.length} entries, with {timelineWindow.hiddenEntryCount} hidden above.
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={timelineWindow.loadOlder}
                            className="shrink-0 rounded-full border border-transparent bg-white/[0.03] px-3 py-1.5 text-[11px] font-medium text-sparkle-text-secondary transition-colors hover:bg-white/[0.05] hover:text-sparkle-text"
                        >
                            Load older
                        </button>
                    </div>
                </div>
            ) : null}
            {timelineVirtualizer.paddingTop > 0 ? (
                <div
                    aria-hidden="true"
                    style={{
                        height: timelineVirtualizer.paddingTop
                    }}
                />
            ) : null}
            {timelineVirtualizer.virtualRows.map(({ row }) => renderRowContainer(row, renderRow(row), true))}
            {timelineVirtualizer.tailRows.map((row) => renderRowContainer(row, renderRow(row), true))}
            {timelineVirtualizer.paddingBottom > 0 ? (
                <div
                    aria-hidden="true"
                    style={{
                        height: timelineVirtualizer.paddingBottom
                    }}
                />
            ) : null}
        </div>
    )
}

export const AssistantTimeline = memo(AssistantTimelineImpl)
