import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertCircle, Check, Copy, EyeOff, Loader2, Trash2, X } from 'lucide-react'
import type { AssistantActivity } from '@shared/assistant/contracts'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { FileActionsMenu, type FileActionsMenuItem } from '@/components/ui/FileActionsMenu'
import { cn } from '@/lib/utils'
import { formatAssistantDateTime, formatAssistantRelativeTime } from '@/lib/assistant/selectors'

export type UsageMetricTone = 'low' | 'normal' | 'high' | 'neutral'
export type LogDetailsTab = 'rendered' | 'raw'
export type AssistantToastTone = 'success' | 'error' | 'info'
export type AssistantToastState = {
    message: string
    visible: boolean
    tone?: AssistantToastTone
}
export type AssistantToastInput = {
    message: string
    tone?: AssistantToastTone
}
export type IssueActivityGroup = {
    activity: AssistantActivity
    activities: AssistantActivity[]
    count: number
}

export type IssueDismissScope = 'type' | 'tone'

type PersistedIssueDismissState = {
    keys: string[]
    tones: Array<AssistantActivity['tone']>
}

const ISSUE_DISMISS_STORAGE_KEY = 'devscope.assistant.dismissed-issues.v1'

export function useAssistantTransientToast() {
    const [toast, setToast] = useState<AssistantToastState | null>(null)

    const showToast = useCallback((input: string | AssistantToastInput, tone: AssistantToastTone = 'success') => {
        const nextToast = typeof input === 'string'
            ? { message: input, tone }
            : { message: input.message, tone: input.tone ?? 'success' }

        setToast({ ...nextToast, visible: false })
        window.setTimeout(() => {
            setToast((current) => current ? { ...current, visible: true } : current)
        }, 10)
    }, [])

    useEffect(() => {
        if (!toast?.visible) return

        const hideTimer = window.setTimeout(() => {
            setToast((current) => current ? { ...current, visible: false } : current)
        }, 2600)
        const removeTimer = window.setTimeout(() => {
            setToast(null)
        }, 3000)

        return () => {
            window.clearTimeout(hideTimer)
            window.clearTimeout(removeTimer)
        }
    }, [toast?.visible])

    return { toast, showToast }
}

export function AssistantTransientToast({ toast }: { toast: AssistantToastState | null }) {
    if (!toast) return null

    return (
        <div
            className={cn(
                'fixed bottom-4 right-4 z-[110] max-w-sm rounded-xl px-4 py-3 text-sm shadow-lg backdrop-blur-md transition-all duration-300',
                toast.tone === 'error'
                    ? 'border border-red-500/30 bg-red-500/10 text-red-200'
                    : toast.tone === 'success'
                        ? 'border border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
                        : 'border border-amber-500/30 bg-amber-500/10 text-amber-300',
                toast.visible ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-4 opacity-0'
            )}
        >
            <div className="flex items-start gap-2">
                <AlertCircle size={16} className="mt-0.5 shrink-0" />
                <span>{toast.message}</span>
            </div>
        </div>
    )
}

export function formatCompactMetric(value: number | null | undefined): string {
    if (value == null || !Number.isFinite(value)) return 'n/a'
    const absolute = Math.abs(value)
    if (absolute >= 1_000_000) return `${(value / 1_000_000).toFixed(absolute >= 10_000_000 ? 0 : 1)}M`
    if (absolute >= 1_000) return `${(value / 1_000).toFixed(absolute >= 100_000 ? 0 : 1)}k`
    return `${Math.round(value)}`
}

export function formatContextMetric(used: number | null | undefined, max: number | null | undefined): string {
    if (used == null && max == null) return 'n/a'
    if (used == null || max == null || max <= 0) return `${formatCompactMetric(used)} / ${formatCompactMetric(max)}`
    return `${((used / max) * 100).toFixed(1)}% / ${formatCompactMetric(max)}`
}

export function getUsageMetricToneClass(tone: UsageMetricTone): string {
    if (tone === 'high') return 'text-red-300'
    if (tone === 'normal') return 'text-amber-300'
    if (tone === 'low') return 'text-emerald-300'
    return 'text-sparkle-text'
}

export function getUsageMetricDotClass(tone: UsageMetricTone): string {
    if (tone === 'high') return 'bg-red-400'
    if (tone === 'normal') return 'bg-amber-400'
    if (tone === 'low') return 'bg-emerald-400'
    return 'bg-white/20'
}

export function resolveUsageMetricTone(value: number | null | undefined, maxValue: number | null | undefined, fallbackThresholds: { normal: number; high: number }): UsageMetricTone {
    if (value == null || !Number.isFinite(value) || value <= 0) return 'neutral'
    if (maxValue != null && Number.isFinite(maxValue) && maxValue > 0) {
        const ratio = value / maxValue
        if (ratio >= 0.85) return 'high'
        if (ratio >= 0.45) return 'normal'
        return 'low'
    }
    if (value >= fallbackThresholds.high) return 'high'
    if (value >= fallbackThresholds.normal) return 'normal'
    return 'low'
}

export function getIssueActivities(activities: AssistantActivity[]): AssistantActivity[] {
    return activities.filter((activity) => activity.tone === 'warning' || activity.tone === 'error' || activity.kind === 'process.stderr' || activity.kind === 'runtime.error')
}

export function groupIssueActivities(activities: AssistantActivity[]): IssueActivityGroup[] {
    const groups: IssueActivityGroup[] = []
    for (const activity of activities) {
        const lastGroup = groups[groups.length - 1]
        if (lastGroup && lastGroup.activity.summary === activity.summary && lastGroup.activity.tone === activity.tone) {
            lastGroup.count += 1
            lastGroup.activities.push(activity)
            continue
        }
        groups.push({ activity, activities: [activity], count: 1 })
    }
    return groups
}

export function getIssueActivityDismissKey(activity: AssistantActivity): string {
    return [
        activity.tone || 'neutral',
        activity.kind || 'unknown',
        String(activity.summary || '').trim().toLowerCase()
    ].join('::')
}

export function readPersistedIssueDismissState(): PersistedIssueDismissState {
    if (typeof window === 'undefined' || !window.localStorage) {
        return { keys: [], tones: [] }
    }

    try {
        const raw = window.localStorage.getItem(ISSUE_DISMISS_STORAGE_KEY)
        if (!raw) return { keys: [], tones: [] }
        const parsed = JSON.parse(raw) as Partial<PersistedIssueDismissState> | null
        const keys = Array.isArray(parsed?.keys)
            ? parsed.keys.filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
            : []
        const tones = Array.isArray(parsed?.tones)
            ? parsed.tones.filter((value): value is AssistantActivity['tone'] => value === 'warning' || value === 'error')
            : []
        return { keys, tones }
    } catch {
        return { keys: [], tones: [] }
    }
}

export function writePersistedIssueDismissState(state: PersistedIssueDismissState): PersistedIssueDismissState {
    const nextState: PersistedIssueDismissState = {
        keys: [...new Set(state.keys.filter((value) => typeof value === 'string' && value.trim().length > 0))],
        tones: [...new Set(state.tones.filter((value) => value === 'warning' || value === 'error'))]
    }

    if (typeof window === 'undefined' || !window.localStorage) {
        return nextState
    }

    try {
        if (nextState.keys.length === 0 && nextState.tones.length === 0) {
            window.localStorage.removeItem(ISSUE_DISMISS_STORAGE_KEY)
        } else {
            window.localStorage.setItem(ISSUE_DISMISS_STORAGE_KEY, JSON.stringify(nextState))
        }
    } catch {
        // ignore persistence failures
    }

    return nextState
}

function stripAnsi(value: string): string {
    return value.replace(/\u001b\[[0-9;]*m/g, '')
}

function normalizeIssueDetailLines(activity: AssistantActivity): string[] {
    return stripAnsi(String(activity.detail || ''))
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)
}

function scoreIssueDetailLine(line: string): number {
    if (!line) return Number.NEGATIVE_INFINITY
    let score = 0

    if (/is denied|permission denied|unauthorized|refused|timed out|timeout|not found|failed|exception|cannot |could not |access to the path|econnrefused|enoent/i.test(line)) {
        score += 8
    }
    if (/^\w[^:]{0,80}\s:\s.+/.test(line)) {
        score += 5
    }
    if (/error=/i.test(line)) {
        score += 2
    }
    if (/^at line:/i.test(line) || /^\+\s/.test(line) || /^categoryinfo:/i.test(line) || /^fullyqualifiederrorid:/i.test(line) || /^wall time:/i.test(line) || /^output:$/i.test(line)) {
        score -= 10
    }
    if (/^import\s.+|^test\(|^assert\./i.test(line)) {
        score -= 8
    }
    if (/codex_core::tools::router|^202\d-\d\d-\d\d.*\berror\b/i.test(line)) {
        score -= 4
    }

    return score
}

export function getIssueActivityBrief(activity: AssistantActivity, maxLength = 180): string {
    const lines = normalizeIssueDetailLines(activity)
    if (lines.length === 0) return activity.summary

    const bestLine = [...lines]
        .sort((left, right) => scoreIssueDetailLine(right) - scoreIssueDetailLine(left) || left.length - right.length)[0]
        || lines[0]

    const normalized = bestLine.replace(/^.*error=/i, '').replace(/\s+/g, ' ').trim()
    if (normalized.length <= maxLength) return normalized
    return `${normalized.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`
}

function getIssueToneLabel(tone: AssistantActivity['tone']): 'Error' | 'Warning' {
    return tone === 'error' ? 'Error' : 'Warning'
}

function getIssueToneSurface(tone: AssistantActivity['tone']) {
    return {
        card: 'bg-red-500/[0.055]',
        hover: 'hover:bg-red-500/[0.085]',
        divider: '',
        subtleRow: 'hover:bg-red-500/[0.05]',
        button: 'bg-red-500/[0.12] text-red-100/90 hover:bg-red-500/[0.18] hover:text-red-50',
        countButton: 'border-red-500/14 bg-red-500/[0.08] text-red-100/75 hover:border-red-400/24 hover:bg-red-500/[0.12] hover:text-red-50',
        badge: tone === 'error'
            ? 'border-red-400/20 bg-red-500/[0.14] text-red-100'
            : 'border-amber-400/20 bg-amber-500/[0.12] text-amber-100',
        detail: 'text-red-100/75'
    }
}

export function buildIssueLogEntry(activity: AssistantActivity): Record<string, unknown> {
    const detail = stripAnsi(String(activity.detail || '').trim())
    const localhostTargetMatch = detail.match(/http:\/\/127\.0\.0\.1:(\d+)(\/\S*)?/i)
    const tcpTargetMatch = detail.match(/127\.0\.0\.1:(\d+)/)
    const codeMatch = detail.match(/code:\s*(\d+)/i)
    const connectionRefused = /connectionrefused|actively refused|tcp connect error/i.test(detail)
    return {
        timestamp: activity.createdAt,
        level: activity.tone,
        kind: activity.kind,
        summary: activity.summary,
        issue: connectionRefused ? 'local_mcp_connection_refused' : undefined,
        target: localhostTargetMatch?.[0] || (tcpTargetMatch ? `127.0.0.1:${tcpTargetMatch[1]}` : undefined),
        host: tcpTargetMatch ? '127.0.0.1' : undefined,
        port: tcpTargetMatch ? Number(tcpTargetMatch[1]) : undefined,
        path: localhostTargetMatch?.[2] || undefined,
        osCode: codeMatch ? Number(codeMatch[1]) : undefined,
        explanation: connectionRefused ? 'The assistant tried to reach a local MCP server, but nothing was listening on that port.' : undefined,
        detail
    }
}

function getRenderedLogEntries(logEntry: Record<string, unknown>): Array<{ key: string; value: string }> {
    return Object.entries(logEntry).filter(([, value]) => value !== undefined && value !== null && value !== '').map(([key, value]) => ({
        key,
        value: Array.isArray(value) ? value.join(', ') : typeof value === 'object' ? JSON.stringify(value) : String(value)
    }))
}

export async function copyTextToClipboard(value: string): Promise<void> {
    const normalized = String(value || '')
    if (!normalized.trim()) return
    const result = await window.devscope.copyToClipboard?.(normalized)
    if (result && result.success === false) throw new Error(result.error || 'Failed to copy to clipboard')
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
    if (!success) throw new Error('Failed to copy to clipboard')
}

export function IssueLogRow({
    activity,
    activities,
    count,
    copied,
    copyError,
    onDismiss,
    onCopy,
    onShowMore
}: {
    activity: AssistantActivity
    activities?: AssistantActivity[]
    count?: number
    copied: boolean
    copyError: string | null
    onDismiss?: (activity: AssistantActivity, scope: IssueDismissScope) => void
    onCopy: (activity: AssistantActivity) => void
    onShowMore: (activity: AssistantActivity, activities?: AssistantActivity[]) => void
}) {
    const [expanded, setExpanded] = useState(false)
    const brief = getIssueActivityBrief(activity)
    const hasMultiple = count && count > 1 && activities && activities.length > 1
    const toneSurface = getIssueToneSurface(activity.tone)
    const openDetails = () => onShowMore(activity, activities)
    const toneLabel = getIssueToneLabel(activity.tone)
    const dismissItems = useMemo<FileActionsMenuItem[]>(() => {
        if (!onDismiss) return []
        return [
            {
                id: 'dismiss-type',
                label: `Dismiss this ${toneLabel.toLowerCase()} type`,
                icon: <EyeOff size={13} />,
                onSelect: () => onDismiss(activity, 'type')
            },
            {
                id: 'dismiss-tone',
                label: `Dismiss all ${toneLabel.toLowerCase()}s`,
                icon: <EyeOff size={13} />,
                onSelect: () => onDismiss(activity, 'tone')
            }
        ]
    }, [activity, onDismiss, toneLabel])

    return (
        <div className={cn('rounded-lg', toneSurface.card)}>
            <div
                role="button"
                tabIndex={0}
                onClick={openDetails}
                onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault()
                        openDetails()
                    }
                }}
                className={cn('group flex items-center justify-between gap-2 px-3 py-2 transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-red-300/35', toneSurface.hover)}
            >
                <div className="min-w-0 flex-1">
                    <div className="min-w-0">
                        <div className="flex items-center gap-2">
                            <p className="truncate text-xs text-sparkle-text">{activity.summary}</p>
                            <span className={cn('shrink-0 rounded-full border px-1.5 py-[1px] text-[8px] font-medium uppercase tracking-[0.14em]', toneSurface.badge)}>{activity.tone}</span>
                            {hasMultiple && <button type="button" onClick={(event) => { event.stopPropagation(); setExpanded(!expanded) }} className={cn('shrink-0 rounded-full border px-1.5 py-[1px] text-[8px] font-medium transition-colors', toneSurface.countButton)} title={expanded ? 'Collapse' : 'Expand repeated logs'}>x{count}</button>}
                        </div>
                        {brief ? <p className={cn('mt-1 line-clamp-2 text-[11px] leading-5', toneSurface.detail)}>{brief}</p> : null}
                    </div>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                    {dismissItems.length > 0 ? (
                        <FileActionsMenu
                            items={dismissItems}
                            presentation="portal"
                            preferredDirection="up"
                            title={`Dismiss ${toneLabel.toLowerCase()} options`}
                            buttonClassName="h-7 w-7 rounded-md border-transparent bg-transparent text-red-100/45 hover:border-transparent hover:bg-red-500/[0.08] hover:text-red-50"
                            openButtonClassName="border-transparent bg-red-500/[0.12] text-red-50"
                            menuClassName="min-w-[188px]"
                        />
                    ) : null}
                    <button
                        type="button"
                        onClick={(event) => { event.stopPropagation(); void onCopy(activity) }}
                        className={cn(
                            'inline-flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-medium transition-colors',
                            copied
                                ? 'bg-emerald-500/[0.12] text-emerald-200'
                                : copyError
                                    ? 'bg-red-500/[0.16] text-red-100'
                                    : toneSurface.button
                        )}
                        title={copied ? 'Copied' : copyError || 'Copy log'}
                    >
                        {copied ? <Check size={12} /> : <Copy size={12} />}
                        <span>{copied ? 'Copied' : 'Copy'}</span>
                    </button>
                </div>
            </div>
            {hasMultiple && expanded && <div className="px-3 pb-2 pt-1"><div className="space-y-1">{activities.map((act, index) => <div key={act.id} role="button" tabIndex={0} onClick={() => onShowMore(act)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onShowMore(act) } }} className={cn('flex items-center gap-2 rounded px-2 py-1 text-[10px] text-sparkle-text-muted focus:outline-none focus-visible:ring-1 focus-visible:ring-red-300/30', toneSurface.subtleRow)}><span className="shrink-0 text-white/35">#{index + 1}</span><span className="flex-1 truncate">{formatAssistantDateTime(act.createdAt)}</span></div>)}</div></div>}
        </div>
    )
}

export function DismissedIssueRow({
    activity,
    activities,
    count,
    onOpen
}: {
    activity: AssistantActivity
    activities?: AssistantActivity[]
    count?: number
    onOpen: (activity: AssistantActivity, activities?: AssistantActivity[]) => void
}) {
    const toneLabel = getIssueToneLabel(activity.tone)
    const lineLabel = `${toneLabel} occurred`
    const hasMultiple = Boolean(count && count > 1)

    return (
        <div
            role="button"
            tabIndex={0}
            onClick={() => onOpen(activity, activities)}
            onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    onOpen(activity, activities)
                }
            }}
            className={cn(
                'flex items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-red-300/25',
                'text-[11px] text-red-100/62 hover:bg-red-500/[0.05] hover:text-red-100/82'
            )}
            title={activity.summary}
        >
            <span className="truncate font-medium">{lineLabel}</span>
            {hasMultiple ? <span className="shrink-0 text-[10px] text-red-100/42">×{count}</span> : null}
        </div>
    )
}

export function IssueLogDetailsModal({
    activity,
    activities = null,
    tab,
    onChangeTab,
    onClose
}: {
    activity: AssistantActivity | null
    activities?: AssistantActivity[] | null
    tab: LogDetailsTab
    onChangeTab: (tab: LogDetailsTab) => void
    onClose: () => void
}) {
    const [copied, setCopied] = useState(false)
    const [copyError, setCopyError] = useState<string | null>(null)
    const detailActivities = activities && activities.length > 0
        ? activities
        : activity
            ? [activity]
            : []
    const primaryActivity = detailActivities[0] || null

    useEffect(() => {
        if (!primaryActivity) return
        const onEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose() }
        const originalOverflow = document.body.style.overflow
        document.body.style.overflow = 'hidden'
        window.addEventListener('keydown', onEscape)
        return () => { window.removeEventListener('keydown', onEscape); document.body.style.overflow = originalOverflow }
    }, [onClose, primaryActivity])

    if (!primaryActivity) return null
    const logEntries = detailActivities.map((entry) => buildIssueLogEntry(entry))
    const renderedEntries = logEntries.map((entry) => getRenderedLogEntries(entry))
    const title = detailActivities.length > 1
        ? `${primaryActivity.tone === 'error' ? 'Errors' : 'Warnings'} (${detailActivities.length})`
        : primaryActivity.summary

    const handleCopy = async () => {
        try {
            await copyTextToClipboard(JSON.stringify(detailActivities.length > 1 ? logEntries : logEntries[0], null, 2))
            setCopied(true)
            setCopyError(null)
            window.setTimeout(() => setCopied(false), 1600)
        } catch (error) {
            setCopyError(error instanceof Error ? error.message : 'Failed to copy to clipboard')
        }
    }

    return (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 backdrop-blur-md" onClick={onClose} style={{ animation: 'fadeIn 0.15s ease-out' }}>
            <div className="m-4 flex max-h-[88vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-sparkle-card shadow-2xl" onClick={(event) => event.stopPropagation()} style={{ animation: 'scaleIn 0.15s ease-out' }}>
                <div className="flex items-start justify-between gap-3 border-b border-white/10 px-4 py-3">
                    <div className="min-w-0"><h3 className="truncate text-sm font-semibold text-sparkle-text">{title}</h3><p className="mt-1 text-xs text-sparkle-text-secondary">{detailActivities.length > 1 ? `${formatAssistantDateTime(detailActivities[detailActivities.length - 1].createdAt)} → ${formatAssistantDateTime(primaryActivity.createdAt)}` : formatAssistantRelativeTime(primaryActivity.createdAt)}</p></div>
                    <div className="flex items-center gap-2">
                        <button type="button" onClick={() => void handleCopy()} className={cn('inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-2 text-xs transition-colors', copied ? 'border-emerald-400/20 bg-emerald-500/[0.08] text-emerald-100' : copyError ? 'border-red-400/20 bg-red-500/[0.08] text-red-100' : 'border-white/10 bg-white/[0.03] text-sparkle-text-secondary hover:border-white/20 hover:bg-white/[0.05] hover:text-sparkle-text')}>{copied ? <Check size={12} /> : <Copy size={12} />}{copied ? 'Copied' : 'Copy'}</button>
                        <button type="button" onClick={onClose} className="rounded-lg border border-white/10 p-2 text-sparkle-text-secondary transition-colors hover:border-white/20 hover:bg-white/[0.05] hover:text-sparkle-text" title="Close details"><X size={14} /></button>
                    </div>
                </div>
                <div className="flex items-center gap-2 border-b border-white/10 px-4 py-3">
                    <p className={cn('min-w-0 flex-1 truncate text-[11px]', copyError ? 'text-red-200' : copied ? 'text-emerald-200' : 'text-sparkle-text-muted')}>{copyError || (copied ? 'Copied to clipboard' : 'Structured log view')}</p>
                    <button type="button" onClick={() => onChangeTab('rendered')} className={cn('rounded-lg border px-3 py-1.5 text-xs transition-colors', tab === 'rendered' ? 'border-white/20 bg-white/[0.08] text-sparkle-text' : 'border-white/10 bg-white/[0.03] text-sparkle-text-secondary hover:border-white/20 hover:text-sparkle-text')}>Rendered UI</button>
                    <button type="button" onClick={() => onChangeTab('raw')} className={cn('rounded-lg border px-3 py-1.5 text-xs transition-colors', tab === 'raw' ? 'border-white/20 bg-white/[0.08] text-sparkle-text' : 'border-white/10 bg-white/[0.03] text-sparkle-text-secondary hover:border-white/20 hover:text-sparkle-text')}>Raw JSON</button>
                </div>
                <div className="custom-scrollbar flex-1 overflow-auto bg-sparkle-bg p-4">
                    {tab === 'rendered'
                        ? detailActivities.length > 1
                            ? <div className="space-y-4">{renderedEntries.map((entryGroup, index) => <div key={detailActivities[index].id} className="overflow-hidden rounded-xl border border-white/10 bg-white/[0.03]"><div className="flex items-center justify-between gap-3 border-b border-white/10 bg-white/[0.02] px-4 py-3"><span className="text-[11px] font-medium uppercase tracking-[0.18em] text-sparkle-text-muted">Entry {index + 1}</span><span className="text-[11px] text-sparkle-text-secondary">{formatAssistantDateTime(detailActivities[index].createdAt)}</span></div>{entryGroup.map((entry) => <div key={`${detailActivities[index].id}-${entry.key}`} className="grid grid-cols-[160px_minmax(0,1fr)] gap-x-4 border-t border-white/5 px-4 py-3 first:border-t-0"><p className="text-[11px] font-medium uppercase tracking-[0.18em] text-sparkle-text-muted">{entry.key}</p><p className="whitespace-pre-wrap break-all text-sm leading-6 text-sparkle-text">{entry.value}</p></div>)}</div>)}</div>
                            : <div className="overflow-hidden rounded-xl border border-white/10 bg-white/[0.03]"><div className="grid grid-cols-[160px_minmax(0,1fr)] gap-x-4 border-b border-white/10 bg-white/[0.02] px-4 py-3"><span className="text-[11px] font-medium uppercase tracking-[0.18em] text-sparkle-text-muted">Field</span><span className="text-[11px] font-medium uppercase tracking-[0.18em] text-sparkle-text-muted">Value</span></div>{renderedEntries[0].map((entry) => <div key={entry.key} className="grid grid-cols-[160px_minmax(0,1fr)] gap-x-4 border-t border-white/5 px-4 py-3 first:border-t-0"><p className="text-[11px] font-medium uppercase tracking-[0.18em] text-sparkle-text-muted">{entry.key}</p><p className="whitespace-pre-wrap break-all text-sm leading-6 text-sparkle-text">{entry.value}</p></div>)}</div>
                        : <pre className="overflow-x-auto rounded-xl border border-white/10 bg-black/30 p-4 text-[12px] leading-6 text-sparkle-text-secondary custom-scrollbar">{JSON.stringify(detailActivities.length > 1 ? logEntries : logEntries[0], null, 2)}</pre>}
                </div>
            </div>
        </div>
    )
}

export function DeleteHistoryConfirm({
    isOpen,
    deleting,
    onConfirm,
    onCancel
}: {
    isOpen: boolean
    deleting: boolean
    onConfirm: () => void
    onCancel: () => void
}) {
    return (
        <ConfirmModal
            isOpen={isOpen}
            title="Delete message from history?"
            message="This will remove only the selected user message and its associated assistant turn from this thread history. Later messages stay intact. This cannot be undone."
            confirmLabel={deleting ? 'Deleting...' : 'Delete message'}
            cancelLabel="Cancel"
            variant="danger"
            onConfirm={onConfirm}
            onCancel={onCancel}
        />
    )
}
