import { memo, useMemo, useState } from 'react'
import type { AssistantActivity } from '@shared/assistant/contracts'
import type { AssistantToolOutputDefaultMode } from '@/lib/settings'
import { cn } from '@/lib/utils'
import type { AssistantDiffTarget } from './assistant-diff-types'
import {
    areActivityListsEqual,
    getActivityPaths,
    getCreatedFilePaths,
    isSubagentActivity
} from './assistant-timeline-helpers'
import { TimelineSubagentActivityCard } from './AssistantTimelineSubagentActivityCard'
import { TimelineToolCallCard } from './AssistantTimelineToolCallCard'

function normalizeTimelineFilePath(value: string): string {
    return value.trim().replace(/\\/g, '/').replace(/\/+/g, '/').toLowerCase()
}

function buildDisplayActivityList(activities: AssistantActivity[]): AssistantActivity[] {
    const seenFilePaths = new Set<string>()

    return activities.flatMap((activity) => {
        if (activity.kind !== 'file-change') return [activity]

        const filePaths = getActivityPaths(activity)
        if (filePaths.length === 0) return [activity]

        const nextPaths: string[] = []
        const seenInActivity = new Set<string>()
        for (const filePath of filePaths) {
            const comparablePath = normalizeTimelineFilePath(filePath)
            if (!comparablePath || seenInActivity.has(comparablePath)) continue
            seenInActivity.add(comparablePath)
            if (!seenFilePaths.has(comparablePath)) nextPaths.push(filePath)
        }

        for (const filePath of filePaths) {
            const comparablePath = normalizeTimelineFilePath(filePath)
            if (comparablePath) seenFilePaths.add(comparablePath)
        }

        if (nextPaths.length === 0) return []
        if (nextPaths.length === filePaths.length) return [activity]

        const nextPathKeys = new Set(nextPaths.map(normalizeTimelineFilePath))
        const nextCreatedPaths = getCreatedFilePaths(activity).filter((filePath) => (
            nextPathKeys.has(normalizeTimelineFilePath(filePath))
        ))

        return [{
            ...activity,
            detail: nextPaths.join('\n'),
            payload: {
                ...(activity.payload || {}),
                paths: nextPaths,
                createdPaths: nextCreatedPaths,
                fileCount: nextPaths.length,
                patch: undefined
            }
        }]
    })
}

export const TimelineToolCallList = memo(({
    activities,
    projectRootPath,
    toolOutputDefaultMode = 'expanded',
    onOpenFilePath,
    onViewDiff
}: {
    activities: AssistantActivity[]
    projectRootPath?: string | null
    toolOutputDefaultMode?: AssistantToolOutputDefaultMode
    onOpenFilePath?: (filePath: string) => Promise<void> | void
    onViewDiff?: (target: AssistantDiffTarget) => void
}) => {
    const [expanded, setExpanded] = useState(false)
    const displayActivities = useMemo(() => buildDisplayActivityList(activities), [activities])
    const containsSubagentActivities = useMemo(() => displayActivities.some((activity) => isSubagentActivity(activity)), [displayActivities])
    const header = useMemo(() => {
        if (containsSubagentActivities) {
            return displayActivities.length > 1 ? `Subagent Activity (${displayActivities.length})` : 'Subagent Activity'
        }
        return displayActivities.length > 1 ? `Tool Calls (${displayActivities.length})` : 'Tool Calls'
    }, [containsSubagentActivities, displayActivities.length])
    const hasMore = displayActivities.length > 5
    const visibleActivities = useMemo(() => expanded || !hasMore ? displayActivities : displayActivities.slice(-5), [displayActivities, expanded, hasMore])

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
                            {expanded ? 'Show last 5' : `Show all ${displayActivities.length}`}
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
                                    toolOutputDefaultMode={toolOutputDefaultMode}
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
        && prev.toolOutputDefaultMode === next.toolOutputDefaultMode
        && prev.onOpenFilePath === next.onOpenFilePath
        && prev.onViewDiff === next.onViewDiff
        && areActivityListsEqual(prev.activities, next.activities)
})
