import { useMemo, type ReactNode } from 'react'
import { cn } from '@/lib/utils'
import type { AssistantHistoryMessage } from './assistant-page-types'
import { AssistantMessage } from './AssistantMessage'
import { CollapsiblePlainMessage } from './CollapsiblePlainMessage'

type HistoryGroup = {
    id: string
    role: 'user' | 'assistant' | 'system'
    messages: AssistantHistoryMessage[]
}

type ActiveWorkItem = {
    id: string
    turnId?: string
    timestamp: number
    kind: 'thinking' | 'tool'
    primary: string
    secondary?: string
}

type Props = {
    historyGroups: HistoryGroup[]
    compact?: boolean
    streamingTurnId?: string | null
    streamingText?: string
    activeWorkItems?: ActiveWorkItem[]
    assistantIsWorking: boolean
    showThinking: boolean
    onRegenerate: (turnId: string) => void | Promise<void>
}

function getUserMessageDisplayText(message: AssistantHistoryMessage): string {
    const rawText = String(message.text || '')
    const sourcePrompt = String(message.sourcePrompt || '').trim()
    const preferredText = rawText.trim() || sourcePrompt
    if (!preferredText) return ''

    const userPromptMatch = preferredText.match(/##\s+User Prompt\s+([\s\S]*?)(?:\n##\s+[^\n]+|$)/i)
    if (userPromptMatch?.[1]?.trim()) {
        return userPromptMatch[1].trim()
    }

    const withoutLegacyAttachmentBlock = preferredText
        .replace(/\n{1,2}Attached files \(\d+\):[\s\S]*$/i, '')
        .trim()
    if (withoutLegacyAttachmentBlock !== preferredText.trim()) {
        return withoutLegacyAttachmentBlock || 'Attached files for this request.'
    }
    return preferredText
}

function workToneClass(tone: ActiveWorkItem['kind']): string {
    if (tone === 'thinking') return 'text-sparkle-text-secondary/75'
    return 'text-sparkle-text-secondary'
}

function AssistantWorkLog({
    items,
    compact = false
}: {
    items: ActiveWorkItem[]
    compact?: boolean
}) {
    const visibleItems = items.slice(-6)
    const onlyToolEntries = visibleItems.every((entry) => entry.kind === 'tool')
    const label = onlyToolEntries
        ? (visibleItems.length === 1 ? 'Tool call' : `Tool calls (${visibleItems.length})`)
        : (visibleItems.length === 1 ? 'Work event' : `Work log (${visibleItems.length})`)

    return (
        <div className="w-full animate-fadeIn">
            <div className={cn('rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2', compact ? 'mx-1' : 'mx-2')}>
                <div className="mb-1.5 flex items-center justify-between gap-3">
                    <p className="text-[10px] uppercase tracking-[0.12em] text-sparkle-text-muted/70">
                        {label}
                    </p>
                </div>
                <div className="space-y-1">
                    {visibleItems.map((entry) => (
                        <div key={entry.id} className="flex items-start gap-2 py-0.5">
                            <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-white/25" />
                            <p className={cn('py-[2px] text-[11px] leading-relaxed', workToneClass(entry.kind))}>
                                {entry.secondary ? (
                                    <>
                                        {entry.primary}
                                        <span
                                            className="ml-1.5 inline-block max-w-[70ch] truncate align-bottom font-mono text-[11px] opacity-60"
                                            title={entry.secondary}
                                        >
                                            {entry.secondary}
                                        </span>
                                    </>
                                ) : (
                                    entry.primary
                                )}
                            </p>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}

function getGroupTimestamp(group: HistoryGroup): number {
    return group.messages.reduce((earliest, message) => (
        Math.min(earliest, Number(message.createdAt) || Number.MAX_SAFE_INTEGER)
    ), Number.MAX_SAFE_INTEGER)
}

function areSameWorkBucket(left: ActiveWorkItem, right: ActiveWorkItem): boolean {
    return (left.turnId || '') === (right.turnId || '')
        && left.kind === right.kind
}

function AssistantWorkingRow({ compact = false }: { compact?: boolean }) {
    return (
        <div className="w-full animate-fadeIn">
            <div className={cn('flex items-center gap-2 py-1', compact ? 'px-2' : 'px-3')}>
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-white/25" />
                <div className="flex items-center pt-1">
                    <span className="inline-flex items-center gap-[3px]">
                        <span className="h-1 w-1 rounded-full bg-white/30 animate-pulse" />
                        <span className="h-1 w-1 rounded-full bg-white/30 animate-pulse [animation-delay:200ms]" />
                        <span className="h-1 w-1 rounded-full bg-white/30 animate-pulse [animation-delay:400ms]" />
                    </span>
                </div>
            </div>
        </div>
    )
}

export function AssistantTimeline({
    historyGroups,
    compact = false,
    streamingTurnId = null,
    streamingText = '',
    activeWorkItems = [],
    assistantIsWorking,
    showThinking,
    onRegenerate
}: Props) {
    const visibleWorkItems = useMemo(
        () => activeWorkItems.filter((entry) => showThinking || entry.kind !== 'thinking'),
        [activeWorkItems, showThinking]
    )
    const hasAssistantForStreamingTurn = useMemo(() => {
        if (!streamingTurnId) return false
        return historyGroups.some((group) => (
            group.role === 'assistant'
            && group.messages.some((message) => message.turnId === streamingTurnId)
        ))
    }, [historyGroups, streamingTurnId])
    const timelineNodes = useMemo(() => {
        const nodes: ReactNode[] = []
        let workIndex = 0
        let bucketKey = 0

        const flushWorkItemsBefore = (cutoffTimestamp: number) => {
            while (workIndex < visibleWorkItems.length) {
                const item = visibleWorkItems[workIndex]
                if (item.timestamp > cutoffTimestamp) break
                const bucket = [item]
                workIndex += 1
                while (workIndex < visibleWorkItems.length && areSameWorkBucket(bucket[bucket.length - 1], visibleWorkItems[workIndex])) {
                    bucket.push(visibleWorkItems[workIndex])
                    workIndex += 1
                }
                nodes.push(
                    <AssistantWorkLog
                        key={`work-${bucketKey}-${bucket[0]?.id || workIndex}`}
                        items={bucket}
                        compact={compact}
                    />
                )
                bucketKey += 1
            }
        }

        for (const group of historyGroups) {
            flushWorkItemsBefore(getGroupTimestamp(group))
            if (group.role === 'assistant') {
                nodes.push(
                    <div key={group.id} className="w-full">
                        <AssistantMessage
                            attempts={group.messages}
                            onRegenerate={onRegenerate}
                            isBusy={assistantIsWorking}
                            compact={compact}
                            streamingTurnId={streamingTurnId}
                            streamingText={streamingText}
                        />
                    </div>
                )
                continue
            }

            const message = group.messages[0]
            nodes.push(
                <div key={message.id} className={cn('flex animate-fadeIn', message.role === 'user' ? 'justify-end' : 'justify-start')}>
                    <CollapsiblePlainMessage
                        text={getUserMessageDisplayText(message)}
                        isUser={message.role === 'user'}
                        attachments={message.attachments}
                        compact={compact}
                        timestamp={message.createdAt}
                    />
                </div>
            )
        }

        flushWorkItemsBefore(Number.POSITIVE_INFINITY)
        return nodes
    }, [
        assistantIsWorking,
        compact,
        historyGroups,
        onRegenerate,
        streamingText,
        streamingTurnId,
        visibleWorkItems
    ])

    return (
        <div className="mx-auto w-full space-y-3">
            {timelineNodes}

            {!hasAssistantForStreamingTurn && streamingTurnId && streamingText.trim().length > 0 && (
                <div className="w-full">
                    <AssistantMessage
                        attempts={[{
                            id: `streaming-${streamingTurnId}`,
                            text: '',
                            createdAt: Date.now(),
                            turnId: streamingTurnId,
                            isActiveAttempt: true
                        }]}
                        onRegenerate={onRegenerate}
                        isBusy={assistantIsWorking}
                        compact={compact}
                        streamingTurnId={streamingTurnId}
                        streamingText={streamingText}
                    />
                </div>
            )}

            {assistantIsWorking && <AssistantWorkingRow compact={compact} />}
        </div>
    )
}
