import { memo, useEffect, useMemo, useState } from 'react'
import { Bot, Check, ChevronDown, CircleDot, Copy, FilePenLine, FileText, Loader2, Search, Trash2, Wrench } from 'lucide-react'
import type { AssistantActivity, AssistantMessage } from '@shared/assistant/contracts'
import { AnimatedHeight } from '@/components/ui/AnimatedHeight'
import MarkdownRenderer from '@/components/ui/MarkdownRenderer'
import { cn } from '@/lib/utils'
import { formatAssistantDateTime } from '@/lib/assistant/selectors'

export type TimelineEntry =
    | { id: string; createdAt: string; type: 'message'; message: AssistantMessage }
    | { id: string; createdAt: string; type: 'activity'; activity: AssistantActivity }
    | { id: string; createdAt: string; type: 'activity-group'; activities: AssistantActivity[] }

function readActivityString(value: unknown): string {
    return typeof value === 'string' ? value.trim() : ''
}

function readActivityStringArray(value: unknown): string[] {
    if (!Array.isArray(value)) return []
    return value
        .filter((entry): entry is string => typeof entry === 'string')
        .map((entry) => entry.trim())
        .filter(Boolean)
}

async function copyTextToClipboard(value: string): Promise<void> {
    const normalized = String(value || '')
    if (!normalized.trim()) return

    const result = await window.devscope.copyToClipboard?.(normalized)
    if (result && result.success === false) {
        throw new Error(result.error || 'Failed to copy to clipboard')
    }
    if (result) return

    if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(normalized)
        return
    }

    const textarea = document.createElement('textarea')
    textarea.value = normalized
    textarea.setAttribute('readonly', 'true')
    textarea.style.position = 'fixed'
    textarea.style.opacity = '0'
    textarea.style.pointerEvents = 'none'
    document.body.appendChild(textarea)
    textarea.select()
    const success = document.execCommand('copy')
    document.body.removeChild(textarea)
    if (!success) {
        throw new Error('Failed to copy to clipboard')
    }
}

function shouldRenderActivity(activity: AssistantActivity): boolean {
    return activity.tone === 'tool'
}

export function formatWorkingTimer(startIso: string, endIso: string): string | null {
    const startedAtMs = Date.parse(startIso)
    const endedAtMs = Date.parse(endIso)
    if (!Number.isFinite(startedAtMs) || !Number.isFinite(endedAtMs)) return null

    const elapsedSeconds = Math.max(0, Math.floor((endedAtMs - startedAtMs) / 1000))
    if (elapsedSeconds < 60) return `${elapsedSeconds}s`

    const hours = Math.floor(elapsedSeconds / 3600)
    const minutes = Math.floor((elapsedSeconds % 3600) / 60)
    const seconds = elapsedSeconds % 60

    if (hours > 0) {
        return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`
    }

    return seconds > 0 ? `${minutes}m ${seconds}s` : `${minutes}m`
}

export function getTimelineEntries(messages: AssistantMessage[], activities: AssistantActivity[]): TimelineEntry[] {
    const allEntries = [
        ...messages.map((message) => ({
            id: message.id,
            createdAt: message.createdAt,
            type: 'message' as const,
            message
        })),
        ...activities
            .filter(shouldRenderActivity)
            .map((activity) => ({
                id: activity.id,
                createdAt: activity.createdAt,
                type: 'activity' as const,
                activity
            }))
    ].sort((left, right) => left.createdAt.localeCompare(right.createdAt) || left.id.localeCompare(right.id))

    const grouped: TimelineEntry[] = []
    let currentGroup: AssistantActivity[] = []

    for (const entry of allEntries) {
        if (entry.type === 'activity' && entry.activity) {
            currentGroup.push(entry.activity)
            continue
        }
        if (currentGroup.length > 0) {
            grouped.push(
                currentGroup.length === 1
                    ? { id: currentGroup[0].id, createdAt: currentGroup[0].createdAt, type: 'activity', activity: currentGroup[0] }
                    : { id: `group-${currentGroup[0].id}`, createdAt: currentGroup[0].createdAt, type: 'activity-group', activities: currentGroup }
            )
            currentGroup = []
        }
        grouped.push(entry)
    }

    if (currentGroup.length > 0) {
        grouped.push(
            currentGroup.length === 1
                ? { id: currentGroup[0].id, createdAt: currentGroup[0].createdAt, type: 'activity', activity: currentGroup[0] }
                : { id: `group-${currentGroup[0].id}`, createdAt: currentGroup[0].createdAt, type: 'activity-group', activities: currentGroup }
        )
    }

    return grouped
}

function getActivityCommand(activity: AssistantActivity): string {
    const payload = activity.payload || {}
    return readActivityString(payload.command)
        || readActivityString(payload.toolName || payload.tool || payload.name)
        || readActivityString(payload.query)
        || readActivityStringArray(payload.paths)[0]
        || readActivityString(activity.detail)
        || activity.summary
}

function getActivityDetails(activity: AssistantActivity): string[] {
    const payload = activity.payload || {}
    return [...new Set([
        readActivityString(activity.detail),
        ...readActivityStringArray(payload.paths),
        readActivityString(payload.query),
        readActivityString(payload.toolName || payload.tool || payload.name)
    ].filter(Boolean))]
}

function stringifyActivityValue(value: unknown): string {
    if (typeof value === 'string') return value.trim()
    if (typeof value === 'number' || typeof value === 'boolean') return String(value)
    if (Array.isArray(value) || (value && typeof value === 'object')) {
        try {
            return JSON.stringify(value, null, 2)
        } catch {
            return ''
        }
    }
    return ''
}

function getActivityOutput(activity: AssistantActivity): string {
    const payload = activity.payload || {}
    return readActivityString(payload.output)
        || stringifyActivityValue(payload.result)
        || stringifyActivityValue(payload.results)
        || stringifyActivityValue(payload.response)
        || stringifyActivityValue(payload.matches)
}

function isCommandActivity(activity: AssistantActivity): boolean {
    return activity.kind === 'command' || Boolean(readActivityString(activity.payload?.command))
}

function getActivityTitle(activity: AssistantActivity): string {
    if (activity.kind === 'search') return 'Search'
    if (activity.kind === 'file-read') return 'Read file'
    if (activity.kind === 'file-change') return 'Edited file'
    if (isCommandActivity(activity)) return 'Command'
    return activity.summary || 'Tool'
}

function getActivityStatus(activity: AssistantActivity): 'success' | 'running' | 'failed' {
    const payload = activity.payload || {}
    const rawStatus = readActivityString(payload.status) || readActivityString(payload.state) || readActivityString(payload.phase)
    if (activity.tone === 'error') return 'failed'
    if (rawStatus === 'running' || rawStatus === 'in_progress' || rawStatus === 'pending' || rawStatus === 'started') return 'running'
    if (rawStatus === 'error' || rawStatus === 'failed' || rawStatus === 'cancelled') return 'failed'
    return 'success'
}

function getActivityIcon(activity: AssistantActivity) {
    if (activity.kind === 'search') return <Search size={13} />
    if (activity.kind === 'file-read') return <FileText size={13} />
    if (activity.kind === 'file-change') return <FilePenLine size={13} />
    return <Wrench size={13} />
}

function getActivityElapsed(activity: AssistantActivity): string | null {
    const payload = activity.payload || {}
    const durationCandidate = payload.durationMs
    const durationMs = typeof durationCandidate === 'number' ? durationCandidate : typeof durationCandidate === 'string' ? Number(durationCandidate) : NaN
    if (Number.isFinite(durationMs) && durationMs >= 0) {
        if (durationMs < 1000) return `${Math.max(1, Math.round(durationMs))}ms`
        if (durationMs < 60_000) return `${(durationMs / 1000).toFixed(durationMs < 10_000 ? 1 : 0)}s`
        return formatWorkingTimer(new Date(0).toISOString(), new Date(durationMs).toISOString())
    }
    const startedAt = readActivityString(payload.startedAt)
    const completedAt = readActivityString(payload.completedAt) || activity.createdAt
    return startedAt && completedAt ? formatWorkingTimer(startedAt, completedAt) : null
}

const TimelineCopyButton = memo(({ value }: { value: string }) => {
    const [copied, setCopied] = useState(false)
    const [copyError, setCopyError] = useState<string | null>(null)

    const handleCopy = async () => {
        try {
            await copyTextToClipboard(value)
            setCopied(true)
            setCopyError(null)
            window.setTimeout(() => setCopied(false), 1600)
        } catch (error) {
            setCopyError(error instanceof Error ? error.message : 'Failed to copy')
            window.setTimeout(() => setCopyError(null), 2200)
        }
    }

    return (
        <button
            type="button"
            onClick={() => void handleCopy()}
            className={cn(
                'inline-flex items-center rounded-md border p-1 transition-colors',
                copied ? 'border-emerald-400/20 bg-emerald-500/[0.08] text-emerald-300'
                    : copyError ? 'border-red-400/20 bg-red-500/[0.08] text-red-100'
                        : 'border-white/10 bg-white/[0.03] text-sparkle-text-muted hover:border-white/20 hover:text-sparkle-text'
            )}
            title={copyError || (copied ? 'Copied' : 'Copy')}
        >
            {copied ? <Check size={11} /> : <Copy size={11} />}
        </button>
    )
})

const TimelineToolCallCard = memo(({ activity }: { activity: AssistantActivity }) => {
    const [expanded, setExpanded] = useState(false)
    const primaryValue = useMemo(() => getActivityCommand(activity), [activity])
    const output = useMemo(() => getActivityOutput(activity), [activity])
    const detailLines = useMemo(() => getActivityDetails(activity).filter((line) => line !== primaryValue && line !== output), [activity, output, primaryValue])
    const title = useMemo(() => getActivityTitle(activity), [activity])
    const status = useMemo(() => getActivityStatus(activity), [activity])
    const elapsed = useMemo(() => getActivityElapsed(activity), [activity])
    const copyValue = useMemo(() => [primaryValue, output, ...detailLines].filter((value) => String(value || '').trim()).join('\n\n'), [detailLines, output, primaryValue])

    return (
        <div className="px-2 py-1.5">
            <button type="button" onClick={() => setExpanded((current) => !current)} className="flex w-full min-w-0 items-center gap-2 overflow-hidden rounded-lg text-left transition-colors hover:bg-white/[0.02]">
                <span className={cn('inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md border', status === 'success' ? 'border-emerald-400/20 bg-emerald-500/[0.10] text-emerald-300' : status === 'running' ? 'border-amber-400/20 bg-amber-500/[0.10] text-amber-300' : 'border-white/8 bg-white/[0.03] text-white/35')}>
                    {getActivityIcon(activity)}
                </span>
                <div className="min-w-0 flex-1">
                    <p className="truncate font-mono text-[11px] leading-5 text-sparkle-text-secondary">{primaryValue || title}</p>
                    <p className="truncate text-[9px] font-medium uppercase tracking-[0.14em] text-white/20">{title}{elapsed ? <span className="ml-1.5 normal-case tracking-normal text-white/22"> • {elapsed}</span> : null}</p>
                </div>
                <ChevronDown size={11} className={cn('shrink-0 text-white/15 transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] will-change-transform', expanded && 'rotate-180')} />
            </button>
            <AnimatedHeight isOpen={expanded} duration={240}>
                <div className="mt-2 rounded-lg border border-white/5 bg-black/20 p-2.5">
                    <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                            <p className="text-[10px] text-white/18">{formatAssistantDateTime(activity.createdAt)}{elapsed ? <span className="ml-1.5"> • {elapsed}</span> : null}</p>
                            <p className="mt-1 text-[9px] font-medium uppercase tracking-[0.14em] text-white/18">{title}</p>
                        </div>
                        {copyValue ? <TimelineCopyButton value={copyValue} /> : null}
                    </div>
                    <p className="mt-1.5 whitespace-pre-wrap break-all font-mono text-[11px] leading-5 text-white/20">{primaryValue || title}</p>
                    {output && <div className="mt-2 rounded-md border border-white/5 bg-black/25 p-2"><p className="text-[9px] font-medium uppercase tracking-[0.14em] text-white/18">Result</p><p className="mt-1 whitespace-pre-wrap break-all font-mono text-[11px] leading-5 text-white/22">{output}</p></div>}
                    {detailLines.map((line, index) => <p key={`${activity.id}-${index}`} className="mt-1.5 whitespace-pre-wrap break-all font-mono text-[11px] leading-5 text-white/18">{line}</p>)}
                </div>
            </AnimatedHeight>
        </div>
    )
})

export const TimelineToolCallList = memo(({ activities }: { activities: AssistantActivity[] }) => {
    const [expanded, setExpanded] = useState(false)
    const header = useMemo(() => activities.length > 1 ? `Tool Calls (${activities.length})` : 'Tool Calls', [activities.length])
    const hasMore = activities.length > 5
    const visibleActivities = useMemo(() => expanded || !hasMore ? activities : activities.slice(-5), [activities, expanded, hasMore])

    return (
        <div className="max-w-4xl py-2">
            <div className="overflow-hidden rounded-xl border border-white/10 bg-white/[0.03]">
                <div className="flex items-center justify-between gap-2 px-2 pt-1.5 pb-0">
                    <div className="text-[9px] font-medium uppercase tracking-[0.22em] text-white/20">{header}</div>
                    {hasMore && <button type="button" onClick={() => setExpanded(!expanded)} className="rounded border border-white/10 bg-white/[0.03] px-1.5 py-0.5 text-[9px] text-white/40 transition-colors hover:border-white/20 hover:bg-white/[0.05] hover:text-white/60" title={expanded ? 'Show last 5' : 'Show all'}>{expanded ? 'Show last 5' : `Show all ${activities.length}`}</button>}
                </div>
                <div>{visibleActivities.map((activity) => <div key={activity.id}><TimelineToolCallCard activity={activity} /></div>)}</div>
            </div>
        </div>
    )
})

export const TimelineMessage = memo(({
    message,
    isLatestAssistant = false,
    latestTurnStartedAt = null,
    deleting = false,
    onRequestDelete
}: {
    message: AssistantMessage
    isLatestAssistant?: boolean
    latestTurnStartedAt?: string | null
    deleting?: boolean
    onRequestDelete?: (message: AssistantMessage) => void
}) => {
    const isAssistant = message.role === 'assistant'
    const copyValue = message.text || ''
    const [copied, setCopied] = useState(false)
    const [nowIso, setNowIso] = useState(() => new Date().toISOString())

    useEffect(() => {
        if (!message.streaming) return
        const intervalId = window.setInterval(() => setNowIso(new Date().toISOString()), 1000)
        return () => window.clearInterval(intervalId)
    }, [message.streaming])

    const assistantElapsed = useMemo(() => !isAssistant || !isLatestAssistant || !latestTurnStartedAt ? null : formatWorkingTimer(latestTurnStartedAt, message.streaming ? nowIso : message.updatedAt), [isAssistant, isLatestAssistant, latestTurnStartedAt, message.streaming, message.updatedAt, nowIso])

    if (isAssistant) {
        return (
            <div className="max-w-4xl py-1">
                <MarkdownRenderer content={message.text || ' '} className="text-sm leading-7 text-sparkle-text" />
                <div className="mt-3">
                    <p className="text-[11px] text-sparkle-text-muted">{formatAssistantDateTime(message.updatedAt)}{assistantElapsed ? <span className="ml-1.5"> • {assistantElapsed}</span> : null}</p>
                    {message.streaming && <span className="inline-flex items-center gap-1 text-[11px] text-sparkle-text-secondary"><CircleDot size={10} className="animate-pulse" />streaming</span>}
                </div>
            </div>
        )
    }

    return (
        <div className="ml-auto flex flex-col items-end py-1">
            <div className="group relative max-w-[36rem] rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5">
                <p className="whitespace-pre-wrap break-words text-sm leading-6 text-sparkle-text">{message.text}</p>
                <div className="mt-2 flex items-center justify-between gap-3 border-t border-white/5 pt-2">
                    <p className="text-[10px] text-sparkle-text-muted">{formatAssistantDateTime(message.updatedAt)}</p>
                    <div className="flex items-center gap-1 opacity-0 transition-all group-hover:opacity-100">
                        <button type="button" onClick={async () => { try { await copyTextToClipboard(copyValue); setCopied(true); window.setTimeout(() => setCopied(false), 1600) } catch {} }} className={cn('rounded-md border p-1 transition-all', copied ? 'border-emerald-400/20 bg-emerald-500/[0.08] text-emerald-300' : 'border-white/10 bg-white/[0.03] text-sparkle-text-muted hover:border-white/20 hover:text-sparkle-text')} title={copied ? 'Copied' : 'Copy message'}>{copied ? <Check size={12} /> : <Copy size={12} />}</button>
                        {onRequestDelete && <button type="button" onClick={() => onRequestDelete(message)} disabled={deleting} className={cn('rounded-md border p-1 transition-all', deleting ? 'cursor-not-allowed border-red-400/20 bg-red-500/[0.08] text-red-200/70' : 'border-white/10 bg-white/[0.03] text-sparkle-text-muted hover:border-red-400/20 hover:bg-red-500/[0.08] hover:text-red-200')} title="Delete message from history"><Trash2 size={12} /></button>}
                    </div>
                </div>
            </div>
        </div>
    )
})

export function TimelineWorkingIndicator({ startedAt }: { startedAt?: string | null }) {
    const [nowIso, setNowIso] = useState(() => new Date().toISOString())
    useEffect(() => {
        const intervalId = window.setInterval(() => setNowIso(new Date().toISOString()), 1000)
        return () => window.clearInterval(intervalId)
    }, [])
    const elapsed = startedAt ? formatWorkingTimer(startedAt, nowIso) : null
    return (
        <div className="max-w-4xl py-0.5 pl-1.5">
            <div className="flex items-center gap-2 pt-1 text-[11px] text-sparkle-text-secondary/70">
                <span className="inline-flex items-center gap-[3px]">
                    <span className="h-1 w-1 rounded-full bg-white/30 animate-pulse" />
                    <span className="h-1 w-1 rounded-full bg-white/30 animate-pulse [animation-delay:200ms]" />
                    <span className="h-1 w-1 rounded-full bg-white/30 animate-pulse [animation-delay:400ms]" />
                </span>
                <span>{elapsed ? `Working for ${elapsed}` : 'Working...'}</span>
                <Loader2 size={11} className="animate-spin text-white/30" />
            </div>
        </div>
    )
}

export function TimelineEmptyState() {
    return (
        <div className="flex h-full min-h-[420px] items-center justify-center rounded-xl border border-dashed border-white/8 bg-white/[0.015]">
            <div className="max-w-md px-6 text-center">
                <div className="mx-auto mb-4 inline-flex h-16 w-16 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03]">
                    <Bot size={28} className="text-sparkle-text-secondary" />
                </div>
                <h3 className="text-lg font-semibold text-sparkle-text">Start with a real task</h3>
                <p className="mt-3 text-sm leading-6 text-sparkle-text-secondary">Ask for a concrete change and the assistant will stream replies here alongside command, file, and tool actions.</p>
            </div>
        </div>
    )
}
