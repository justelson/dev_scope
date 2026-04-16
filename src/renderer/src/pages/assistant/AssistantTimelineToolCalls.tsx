import { memo, useMemo, useState } from 'react'
import type { AssistantActivity } from '@shared/assistant/contracts'
import { cn } from '@/lib/utils'
import type { AssistantDiffTarget } from './assistant-diff-types'
import { areActivityListsEqual, isSubagentActivity } from './assistant-timeline-helpers'
import { TimelineSubagentActivityCard } from './AssistantTimelineSubagentActivityCard'
import { TimelineToolCallCard } from './AssistantTimelineToolCallCard'

export const TimelineToolCallList = memo(({
    activities,
    projectRootPath,
    onOpenFilePath,
    onViewDiff
}: {
    activities: AssistantActivity[]
    projectRootPath?: string | null
    onOpenFilePath?: (filePath: string) => Promise<void> | void
    onViewDiff?: (target: AssistantDiffTarget) => void
}) => {
    const [expanded, setExpanded] = useState(false)
    const containsSubagentActivities = useMemo(() => activities.some((activity) => isSubagentActivity(activity)), [activities])
    const header = useMemo(() => {
        if (containsSubagentActivities) {
            return activities.length > 1 ? `Subagent Activity (${activities.length})` : 'Subagent Activity'
        }
        return activities.length > 1 ? `Tool Calls (${activities.length})` : 'Tool Calls'
    }, [activities.length, containsSubagentActivities])
    const hasMore = activities.length > 5
    const visibleActivities = useMemo(() => expanded || !hasMore ? activities : activities.slice(-5), [activities, expanded, hasMore])

    return (
        <div className="max-w-4xl py-2">
            <div className={cn(
                'overflow-hidden rounded-xl',
                containsSubagentActivities
                    ? 'border border-violet-400/12 bg-violet-500/[0.03]'
                    : 'border border-white/10 bg-white/[0.03]'
            )}>
                <div className="flex items-center justify-between gap-2 px-2 pb-0 pt-1.5">
                    <div className="text-[9px] font-medium uppercase tracking-[0.22em] text-white/20">{header}</div>
                    {hasMore ? (
                        <button
                            type="button"
                            onClick={() => setExpanded(!expanded)}
                            className="rounded border border-white/10 bg-white/[0.03] px-1.5 py-0.5 text-[9px] text-white/40 transition-colors hover:border-white/20 hover:bg-white/[0.05] hover:text-white/60"
                            title={expanded ? 'Show last 5' : 'Show all'}
                        >
                            {expanded ? 'Show last 5' : `Show all ${activities.length}`}
                        </button>
                    ) : null}
                </div>
                <div>
                    {visibleActivities.map((activity) => (
                        <div key={activity.id}>
                            {isSubagentActivity(activity) ? (
                                <TimelineSubagentActivityCard activity={activity} />
                            ) : (
                                <TimelineToolCallCard
                                    activity={activity}
                                    projectRootPath={projectRootPath}
                                    onOpenFilePath={onOpenFilePath}
                                    onViewDiff={onViewDiff}
                                />
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}, (prev, next) => {
    return prev.projectRootPath === next.projectRootPath
        && prev.onOpenFilePath === next.onOpenFilePath
        && prev.onViewDiff === next.onViewDiff
        && areActivityListsEqual(prev.activities, next.activities)
})
