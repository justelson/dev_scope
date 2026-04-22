import { memo, useCallback, useMemo, useState } from 'react'
import type { AssistantActivity } from '@shared/assistant/contracts'
import { cn } from '@/lib/utils'
import { areActivityListsEqual } from './assistant-timeline-helpers'
import {
    buildIssueLogEntry,
    copyTextToClipboard,
    DismissedIssueRow,
    getIssueActivityDismissKey,
    groupIssueActivities,
    IssueLogDetailsModal,
    IssueLogRow,
    readPersistedIssueDismissState,
    type IssueDismissScope,
    type LogDetailsTab,
    writePersistedIssueDismissState
} from './AssistantPageHelpers'

export const TimelineIssueList = memo(({
    activities
}: {
    activities: AssistantActivity[]
}) => {
    const groupedActivities = useMemo(() => groupIssueActivities(activities), [activities])
    const [selectedLogActivity, setSelectedLogActivity] = useState<AssistantActivity | null>(null)
    const [selectedLogActivities, setSelectedLogActivities] = useState<AssistantActivity[] | null>(null)
    const [logDetailsTab, setLogDetailsTab] = useState<LogDetailsTab>('rendered')
    const [copiedLogId, setCopiedLogId] = useState<string | null>(null)
    const [copyErrorByLogId, setCopyErrorByLogId] = useState<Record<string, string | null>>({})
    const [dismissedIssueKeys, setDismissedIssueKeys] = useState<string[]>(() => readPersistedIssueDismissState().keys)
    const [dismissedTones, setDismissedTones] = useState<Array<AssistantActivity['tone']>>(() => readPersistedIssueDismissState().tones)

    const handleCopyLog = useCallback(async (activity: AssistantActivity) => {
        try {
            await copyTextToClipboard(JSON.stringify(buildIssueLogEntry(activity), null, 2))
            setCopiedLogId(activity.id)
            setCopyErrorByLogId((current) => ({ ...current, [activity.id]: null }))
            window.setTimeout(() => setCopiedLogId((current) => current === activity.id ? null : current), 1600)
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to copy to clipboard'
            setCopyErrorByLogId((current) => ({ ...current, [activity.id]: message }))
            window.setTimeout(() => {
                setCopyErrorByLogId((current) => {
                    const next = { ...current }
                    if (next[activity.id] === message) delete next[activity.id]
                    return next
                })
            }, 2400)
        }
    }, [])

    const handleShowLogDetails = useCallback((activity: AssistantActivity, detailActivities?: AssistantActivity[]) => {
        setSelectedLogActivity(activity)
        setSelectedLogActivities(detailActivities && detailActivities.length > 0 ? detailActivities : null)
        setLogDetailsTab('rendered')
    }, [])

    const handleDismissIssue = useCallback((activity: AssistantActivity, scope: IssueDismissScope) => {
        if (scope === 'tone') {
            setDismissedTones((current) => {
                const next = current.includes(activity.tone) ? current : [...current, activity.tone]
                writePersistedIssueDismissState({ keys: dismissedIssueKeys, tones: next })
                return next
            })
            return
        }
        const dismissKey = getIssueActivityDismissKey(activity)
        setDismissedIssueKeys((current) => {
            const next = current.includes(dismissKey) ? current : [...current, dismissKey]
            writePersistedIssueDismissState({ keys: next, tones: dismissedTones })
            return next
        })
    }, [dismissedIssueKeys, dismissedTones])

    const renderedGroups = useMemo(() => groupedActivities.map((group) => {
        const dismissKey = getIssueActivityDismissKey(group.activity)
        const dismissed = dismissedTones.includes(group.activity.tone) || dismissedIssueKeys.includes(dismissKey)
        return { ...group, dismissKey, dismissed }
    }), [dismissedIssueKeys, dismissedTones, groupedActivities])

    return (
        <>
            <div className="max-w-4xl py-2">
                <div className={cn('space-y-2')}>
                        {renderedGroups.map((group) => (
                            group.dismissed ? (
                                <DismissedIssueRow
                                    key={group.activity.id}
                                    activity={group.activity}
                                    activities={group.activities}
                                    count={group.count}
                                    onOpen={handleShowLogDetails}
                                />
                            ) : (
                            <IssueLogRow
                                key={group.activity.id}
                                activity={group.activity}
                                activities={group.activities}
                                count={group.count}
                                copied={copiedLogId === group.activity.id}
                                copyError={copyErrorByLogId[group.activity.id] || null}
                                onDismiss={handleDismissIssue}
                                onCopy={handleCopyLog}
                                onShowMore={handleShowLogDetails}
                            />
                            )
                        ))}
                </div>
            </div>
            <IssueLogDetailsModal
                activity={selectedLogActivity}
                activities={selectedLogActivities}
                tab={logDetailsTab}
                onChangeTab={setLogDetailsTab}
                onClose={() => {
                    setSelectedLogActivity(null)
                    setSelectedLogActivities(null)
                }}
            />
        </>
    )
}, (prev, next) => areActivityListsEqual(prev.activities, next.activities))
