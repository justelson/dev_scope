import { useCallback, useEffect, useState } from 'react'
import { AlertCircle, Check, Copy, Eye, Loader2, Trash2, X } from 'lucide-react'
import type { AssistantActivity } from '@shared/assistant/contracts'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
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

function stripAnsi(value: string): string {
    return value.replace(/\u001b\[[0-9;]*m/g, '')
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
    onCopy,
    onShowMore
}: {
    activity: AssistantActivity
    activities?: AssistantActivity[]
    count?: number
    copied: boolean
    copyError: string | null
    onCopy: (activity: AssistantActivity) => void
    onShowMore: (activity: AssistantActivity) => void
}) {
    const [expanded, setExpanded] = useState(false)
    const logEntry = buildIssueLogEntry(activity)
    const primaryValue = String(logEntry.target || logEntry.issue || logEntry.kind || '').trim()
    const hasMultiple = count && count > 1 && activities && activities.length > 1

    return (
        <div className="rounded-lg border border-white/10 bg-white/[0.03]">
            <div className="group flex items-center justify-between gap-2 px-3 py-2 transition-colors hover:bg-white/[0.05]">
                <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                        <span className={cn('shrink-0 rounded border px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-[0.14em]', activity.tone === 'error' ? 'border-red-400/20 bg-red-500/[0.08] text-red-200' : 'border-amber-300/20 bg-amber-500/[0.08] text-amber-200')}>{activity.tone}</span>
                        <p className="truncate text-xs text-sparkle-text">{activity.summary}</p>
                        {hasMultiple && <button type="button" onClick={() => setExpanded(!expanded)} className="shrink-0 rounded-full border border-white/10 bg-white/[0.05] px-1.5 py-0.5 text-[9px] font-medium text-white/40 transition-colors hover:border-white/20 hover:bg-white/[0.08] hover:text-white/60" title={expanded ? 'Collapse' : 'Expand repeated logs'}>×{count}</button>}
                    </div>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                    <button type="button" onClick={() => onShowMore(activity)} className="rounded-md border border-white/10 bg-white/[0.03] p-1.5 text-sparkle-text-secondary transition-colors hover:border-white/20 hover:bg-white/[0.05] hover:text-sparkle-text" title="Show details"><Eye size={13} /></button>
                    <button type="button" onClick={() => onCopy(activity)} className={cn('rounded-md border p-1.5 transition-colors', copied ? 'border-emerald-400/20 bg-emerald-500/[0.08] text-emerald-200' : copyError ? 'border-red-400/20 bg-red-500/[0.08] text-red-200' : 'border-white/10 bg-white/[0.03] text-sparkle-text-secondary hover:border-white/20 hover:bg-white/[0.05] hover:text-sparkle-text')} title={copied ? 'Copied' : copyError || 'Copy log'}>{copied ? <Check size={13} /> : <Copy size={13} />}</button>
                </div>
            </div>
            {hasMultiple && expanded && <div className="border-t border-white/5 px-3 py-2"><div className="space-y-1">{activities.map((act, index) => <div key={act.id} className="flex items-center gap-2 rounded px-2 py-1 text-[10px] text-sparkle-text-muted hover:bg-white/[0.03]"><span className="shrink-0 text-white/30">#{index + 1}</span><span className="flex-1 truncate">{formatAssistantDateTime(act.createdAt)}</span><button type="button" onClick={() => onShowMore(act)} className="shrink-0 text-sparkle-text-secondary hover:text-sparkle-text" title="Show details"><Eye size={11} /></button></div>)}</div></div>}
        </div>
    )
}

export function IssueLogDetailsModal({
    activity,
    tab,
    onChangeTab,
    onClose
}: {
    activity: AssistantActivity | null
    tab: LogDetailsTab
    onChangeTab: (tab: LogDetailsTab) => void
    onClose: () => void
}) {
    const [copied, setCopied] = useState(false)
    const [copyError, setCopyError] = useState<string | null>(null)

    useEffect(() => {
        if (!activity) return
        const onEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose() }
        const originalOverflow = document.body.style.overflow
        document.body.style.overflow = 'hidden'
        window.addEventListener('keydown', onEscape)
        return () => { window.removeEventListener('keydown', onEscape); document.body.style.overflow = originalOverflow }
    }, [activity, onClose])

    if (!activity) return null
    const logEntry = buildIssueLogEntry(activity)
    const renderedEntries = getRenderedLogEntries(logEntry)

    const handleCopy = async () => {
        try {
            await copyTextToClipboard(JSON.stringify(buildIssueLogEntry(activity), null, 2))
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
                    <div className="min-w-0"><h3 className="truncate text-sm font-semibold text-sparkle-text">{activity.summary}</h3><p className="mt-1 text-xs text-sparkle-text-secondary">{formatAssistantRelativeTime(activity.createdAt)}</p></div>
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
                        ? <div className="overflow-hidden rounded-xl border border-white/10 bg-white/[0.03]"><div className="grid grid-cols-[160px_minmax(0,1fr)] gap-x-4 border-b border-white/10 bg-white/[0.02] px-4 py-3"><span className="text-[11px] font-medium uppercase tracking-[0.18em] text-sparkle-text-muted">Field</span><span className="text-[11px] font-medium uppercase tracking-[0.18em] text-sparkle-text-muted">Value</span></div>{renderedEntries.map((entry) => <div key={entry.key} className="grid grid-cols-[160px_minmax(0,1fr)] gap-x-4 border-t border-white/5 px-4 py-3 first:border-t-0"><p className="text-[11px] font-medium uppercase tracking-[0.18em] text-sparkle-text-muted">{entry.key}</p><p className="whitespace-pre-wrap break-all text-sm leading-6 text-sparkle-text">{entry.value}</p></div>)}</div>
                        : <pre className="overflow-x-auto rounded-xl border border-white/10 bg-black/30 p-4 text-[12px] leading-6 text-sparkle-text-secondary custom-scrollbar">{JSON.stringify(logEntry, null, 2)}</pre>}
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
