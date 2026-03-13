import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import {
    ArrowDown,
    ArchiveRestore,
    Check,
    ChevronDown,
    ChevronRight,
    Copy,
    Eye,
    Loader2,
    MoreHorizontal,
    PlugZap,
    RefreshCcw,
    ShieldAlert,
    Trash2,
    Unplug,
    X
} from 'lucide-react'
import type { AssistantActivity, AssistantMessage, AssistantPendingUserInput } from '@shared/assistant/contracts'
import { AnimatedHeight } from '@/components/ui/AnimatedHeight'
import MarkdownRenderer from '@/components/ui/MarkdownRenderer'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { cn } from '@/lib/utils'
import { useAssistantStore } from '@/lib/assistant/store'
import { formatAssistantRelativeTime, formatAssistantDateTime, getAssistantSessionSubtitle } from '@/lib/assistant/selectors'
import { AssistantComposer } from './AssistantComposer'
import { AssistantSessionsRail } from './AssistantSessionsRail'
import { AssistantTimeline } from './AssistantTimeline'
import {
    readAssistantComposerPreferences,
    subscribeAssistantComposerPreferences,
    type AssistantComposerPreferenceEffort,
    type AssistantComposerPreferences
} from './assistant-composer-preferences'
import { buildPromptWithContextFiles } from './assistant-composer-utils'

const LEFT_SIDEBAR_COLLAPSED_STORAGE_KEY = 'assistant-left-sidebar-collapsed'
const LEFT_SIDEBAR_WIDTH_STORAGE_KEY = 'assistant-left-sidebar-width'
const RIGHT_SIDEBAR_OPEN_STORAGE_KEY = 'assistant-right-sidebar-open'
const TIMELINE_AUTO_SCROLL_THRESHOLD_PX = 350
const ASSISTANT_CHAT_WIDTH_CLASS = 'max-w-3xl'
const SIDEBAR_EFFORT_LABELS: Record<AssistantComposerPreferenceEffort, string> = {
    low: 'Low',
    medium: 'Medium',
    high: 'High',
    xhigh: 'Extra High'
}
const SIDEBAR_SELECT_CLASS = 'w-full appearance-none rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 pr-9 text-sm text-sparkle-text outline-none transition-colors hover:border-white/20 focus:border-white/20'

type LogDetailsTab = 'rendered' | 'raw'

function formatCompactMetric(value: number | null | undefined): string {
    if (value == null || !Number.isFinite(value)) return 'n/a'
    const absolute = Math.abs(value)
    if (absolute >= 1_000_000) return `${(value / 1_000_000).toFixed(absolute >= 10_000_000 ? 0 : 1)}M`
    if (absolute >= 1_000) return `${(value / 1_000).toFixed(absolute >= 100_000 ? 0 : 1)}k`
    return `${Math.round(value)}`
}

function formatContextMetric(used: number | null | undefined, max: number | null | undefined): string {
    if (used == null && max == null) return 'n/a'
    if (used == null || max == null || max <= 0) return `${formatCompactMetric(used)} / ${formatCompactMetric(max)}`
    return `${((used / max) * 100).toFixed(1)}% / ${formatCompactMetric(max)}`
}

type UsageMetricTone = 'low' | 'normal' | 'high' | 'neutral'

function getUsageMetricToneClass(tone: UsageMetricTone): string {
    if (tone === 'high') return 'text-red-300'
    if (tone === 'normal') return 'text-amber-300'
    if (tone === 'low') return 'text-emerald-300'
    return 'text-sparkle-text'
}

function getUsageMetricDotClass(tone: UsageMetricTone): string {
    if (tone === 'high') return 'bg-red-400'
    if (tone === 'normal') return 'bg-amber-400'
    if (tone === 'low') return 'bg-emerald-400'
    return 'bg-white/20'
}

function resolveUsageMetricTone(
    value: number | null | undefined,
    maxValue: number | null | undefined,
    fallbackThresholds: { normal: number; high: number }
): UsageMetricTone {
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

function getIssueActivities(activities: AssistantActivity[]): AssistantActivity[] {
    return activities.filter((activity) =>
        activity.tone === 'warning'
        || activity.tone === 'error'
        || activity.kind === 'process.stderr'
        || activity.kind === 'runtime.error'
    )
}

function stripAnsi(value: string): string {
    return value.replace(/\u001b\[[0-9;]*m/g, '')
}

function buildIssueLogEntry(activity: AssistantActivity): Record<string, unknown> {
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
        explanation: connectionRefused
            ? 'The assistant tried to reach a local MCP server, but nothing was listening on that port.'
            : undefined,
        detail
    }
}

function getRenderedLogEntries(logEntry: Record<string, unknown>): Array<{ key: string; value: string }> {
    return Object.entries(logEntry)
        .filter(([, value]) => value !== undefined && value !== null && value !== '')
        .map(([key, value]) => ({
            key,
            value: Array.isArray(value)
                ? value.join(', ')
                : typeof value === 'object'
                    ? JSON.stringify(value)
                    : String(value)
        }))
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

function IssueLogRow({
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
                        <span className={cn(
                            'shrink-0 rounded border px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-[0.14em]',
                            activity.tone === 'error'
                                ? 'border-red-400/20 bg-red-500/[0.08] text-red-200'
                                : 'border-amber-300/20 bg-amber-500/[0.08] text-amber-200'
                        )}>
                            {activity.tone}
                        </span>
                        <p className="truncate text-xs text-sparkle-text">{activity.summary}</p>
                        {hasMultiple && (
                            <button
                                type="button"
                                onClick={() => setExpanded(!expanded)}
                                className="shrink-0 rounded-full border border-white/10 bg-white/[0.05] px-1.5 py-0.5 text-[9px] font-medium text-white/40 transition-colors hover:border-white/20 hover:bg-white/[0.08] hover:text-white/60"
                                title={expanded ? 'Collapse' : 'Expand repeated logs'}
                            >
                                ×{count}
                            </button>
                        )}
                    </div>
                </div>

                <div className="flex shrink-0 items-center gap-1">
                    <button
                        type="button"
                        onClick={() => onShowMore(activity)}
                        className="rounded-md border border-white/10 bg-white/[0.03] p-1.5 text-sparkle-text-secondary transition-colors hover:border-white/20 hover:bg-white/[0.05] hover:text-sparkle-text"
                        title="Show details"
                    >
                        <Eye size={13} />
                    </button>
                    <button
                        type="button"
                        onClick={() => onCopy(activity)}
                        className={cn(
                            'rounded-md border p-1.5 transition-colors',
                            copied
                                ? 'border-emerald-400/20 bg-emerald-500/[0.08] text-emerald-200'
                                : copyError
                                    ? 'border-red-400/20 bg-red-500/[0.08] text-red-200'
                                    : 'border-white/10 bg-white/[0.03] text-sparkle-text-secondary hover:border-white/20 hover:bg-white/[0.05] hover:text-sparkle-text'
                        )}
                        title={copied ? 'Copied' : copyError || 'Copy log'}
                    >
                        {copied ? <Check size={13} /> : <Copy size={13} />}
                    </button>
                </div>
            </div>

            {hasMultiple && expanded && (
                <div className="border-t border-white/5 px-3 py-2">
                    <div className="space-y-1">
                        {activities.map((act, index) => (
                            <div key={act.id} className="flex items-center gap-2 rounded px-2 py-1 text-[10px] text-sparkle-text-muted hover:bg-white/[0.03]">
                                <span className="shrink-0 text-white/30">#{index + 1}</span>
                                <span className="flex-1 truncate">{formatAssistantDateTime(act.createdAt)}</span>
                                <button
                                    type="button"
                                    onClick={() => onShowMore(act)}
                                    className="shrink-0 text-sparkle-text-secondary hover:text-sparkle-text"
                                    title="Show details"
                                >
                                    <Eye size={11} />
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    )
}

function IssueLogDetailsModal({
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

        const onEscape = (event: KeyboardEvent) => {
            if (event.key === 'Escape') onClose()
        }

        const originalOverflow = document.body.style.overflow
        document.body.style.overflow = 'hidden'
        window.addEventListener('keydown', onEscape)

        return () => {
            window.removeEventListener('keydown', onEscape)
            document.body.style.overflow = originalOverflow
        }
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
        <div
            className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 backdrop-blur-md"
            onClick={onClose}
            style={{ animation: 'fadeIn 0.15s ease-out' }}
        >
            <div
                className="m-4 flex max-h-[88vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-sparkle-card shadow-2xl"
                onClick={(event) => event.stopPropagation()}
                style={{ animation: 'scaleIn 0.15s ease-out' }}
            >
                <div className="flex items-start justify-between gap-3 border-b border-white/10 px-4 py-3">
                    <div className="min-w-0">
                        <h3 className="truncate text-sm font-semibold text-sparkle-text">{activity.summary}</h3>
                        <p className="mt-1 text-xs text-sparkle-text-secondary">{formatAssistantRelativeTime(activity.createdAt)}</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={() => void handleCopy()}
                            className={cn(
                                'inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-2 text-xs transition-colors',
                                copied
                                    ? 'border-emerald-400/20 bg-emerald-500/[0.08] text-emerald-100'
                                    : copyError
                                        ? 'border-red-400/20 bg-red-500/[0.08] text-red-100'
                                        : 'border-white/10 bg-white/[0.03] text-sparkle-text-secondary hover:border-white/20 hover:bg-white/[0.05] hover:text-sparkle-text'
                            )}
                        >
                            {copied ? <Check size={12} /> : <Copy size={12} />}
                            {copied ? 'Copied' : 'Copy'}
                        </button>
                        <button
                            type="button"
                            onClick={onClose}
                            className="rounded-lg border border-white/10 p-2 text-sparkle-text-secondary transition-colors hover:border-white/20 hover:bg-white/[0.05] hover:text-sparkle-text"
                            title="Close details"
                        >
                            <X size={14} />
                        </button>
                    </div>
                </div>

                <div className="flex items-center gap-2 border-b border-white/10 px-4 py-3">
                    <p className={cn(
                        'min-w-0 flex-1 truncate text-[11px]',
                        copyError ? 'text-red-200' : copied ? 'text-emerald-200' : 'text-sparkle-text-muted'
                    )}>
                        {copyError || (copied ? 'Copied to clipboard' : 'Structured log view')}
                    </p>
                    <button
                        type="button"
                        onClick={() => onChangeTab('rendered')}
                        className={cn(
                            'rounded-lg border px-3 py-1.5 text-xs transition-colors',
                            tab === 'rendered'
                                ? 'border-white/20 bg-white/[0.08] text-sparkle-text'
                                : 'border-white/10 bg-white/[0.03] text-sparkle-text-secondary hover:border-white/20 hover:text-sparkle-text'
                        )}
                    >
                        Rendered UI
                    </button>
                    <button
                        type="button"
                        onClick={() => onChangeTab('raw')}
                        className={cn(
                            'rounded-lg border px-3 py-1.5 text-xs transition-colors',
                            tab === 'raw'
                                ? 'border-white/20 bg-white/[0.08] text-sparkle-text'
                                : 'border-white/10 bg-white/[0.03] text-sparkle-text-secondary hover:border-white/20 hover:text-sparkle-text'
                        )}
                    >
                        Raw JSON
                    </button>
                </div>

                <div className="custom-scrollbar flex-1 overflow-auto bg-sparkle-bg p-4">
                    {tab === 'rendered' ? (
                        <div className="overflow-hidden rounded-xl border border-white/10 bg-white/[0.03]">
                            <div className="grid grid-cols-[160px_minmax(0,1fr)] gap-x-4 border-b border-white/10 bg-white/[0.02] px-4 py-3">
                                <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-sparkle-text-muted">Field</span>
                                <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-sparkle-text-muted">Value</span>
                            </div>
                            {renderedEntries.map((entry) => (
                                <div key={entry.key} className="grid grid-cols-[160px_minmax(0,1fr)] gap-x-4 border-t border-white/5 px-4 py-3 first:border-t-0">
                                    <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-sparkle-text-muted">{entry.key}</p>
                                    <p className="whitespace-pre-wrap break-all text-sm leading-6 text-sparkle-text">{entry.value}</p>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <pre className="overflow-x-auto rounded-xl border border-white/10 bg-black/30 p-4 text-[12px] leading-6 text-sparkle-text-secondary custom-scrollbar">
                            {JSON.stringify(logEntry, null, 2)}
                        </pre>
                    )}
                </div>
            </div>
        </div>
    )
}

function PendingUserInputCard({
    item,
    onSubmit
}: {
    item: AssistantPendingUserInput
    onSubmit: (requestId: string, answers: Record<string, string | string[]>) => Promise<void>
}) {
    const [answers, setAnswers] = useState<Record<string, string | string[]>>({})

    return (
        <div className="rounded-xl border border-sparkle-border bg-sparkle-card p-4">
            <div className="flex items-center justify-between gap-3">
                <div>
                    <h3 className="text-sm font-semibold text-sparkle-text">User input requested</h3>
                    <p className="mt-1 text-xs text-sparkle-text-secondary">{formatAssistantRelativeTime(item.createdAt)}</p>
                </div>
            </div>
            <div className="mt-4 space-y-4">
                {item.questions.map((question) => (
                    <div key={question.id} className="space-y-2">
                        <div>
                            <p className="text-xs font-medium uppercase tracking-[0.16em] text-sparkle-text-muted">{question.header}</p>
                            <p className="mt-1 text-sm text-sparkle-text">{question.question}</p>
                        </div>
                        {question.options.length > 0 && (
                            <div className="flex flex-wrap gap-2">
                                {question.options.map((option) => {
                                    const isSelected = answers[question.id] === option.label
                                    return (
                                        <button
                                            key={option.label}
                                            type="button"
                                            onClick={() => setAnswers((current) => ({ ...current, [question.id]: option.label }))}
                                            className={cn(
                                                'rounded-lg border px-3 py-2 text-xs transition-colors',
                                                isSelected
                                                    ? 'border-white/20 bg-white/[0.08] text-sparkle-text'
                                                    : 'border-sparkle-border bg-sparkle-bg text-sparkle-text-secondary hover:bg-sparkle-card-hover hover:text-sparkle-text'
                                            )}
                                            title={option.description}
                                        >
                                            {option.label}
                                        </button>
                                    )
                                })}
                            </div>
                        )}
                        <textarea
                            rows={3}
                            value={typeof answers[question.id] === 'string' ? String(answers[question.id]) : ''}
                            onChange={(event) => setAnswers((current) => ({ ...current, [question.id]: event.target.value }))}
                            placeholder="Custom answer..."
                            className="w-full rounded-lg border border-sparkle-border bg-sparkle-bg px-3 py-2 text-sm text-sparkle-text outline-none transition-colors placeholder:text-sparkle-text-muted focus:border-[var(--accent-primary)]/35"
                        />
                    </div>
                ))}
            </div>
            <button
                type="button"
                onClick={() => void onSubmit(item.requestId, answers)}
                className="mt-4 rounded-lg border border-sparkle-border bg-sparkle-bg px-4 py-2 text-sm text-sparkle-text transition-colors hover:bg-sparkle-card-hover"
            >
                Submit input
            </button>
        </div>
    )
}

export default function AssistantPage() {
    const controller = useAssistantStore()
    const headerMenuRef = useRef<HTMLDivElement | null>(null)
    const autoConnectAttemptedSessionRef = useRef<string | null>(null)
    const timelineScrollRef = useRef<HTMLDivElement | null>(null)
    const shouldAutoScrollRef = useRef(true)
    const [leftSidebarCollapsed, setLeftSidebarCollapsed] = useState(() => {
        const saved = localStorage.getItem(LEFT_SIDEBAR_COLLAPSED_STORAGE_KEY)
        return saved === 'true'
    })
    const [leftSidebarWidth, setLeftSidebarWidth] = useState(() => {
        const saved = Number(localStorage.getItem(LEFT_SIDEBAR_WIDTH_STORAGE_KEY))
        return Number.isFinite(saved) && saved > 0 ? saved : 320
    })
    const [rightSidebarOpen, setRightSidebarOpen] = useState(() => {
        const saved = localStorage.getItem(RIGHT_SIDEBAR_OPEN_STORAGE_KEY)
        return saved !== null ? saved === 'true' : true
    })
    const [showHeaderMenu, setShowHeaderMenu] = useState(false)
    const [selectedLogActivity, setSelectedLogActivity] = useState<AssistantActivity | null>(null)
    const [pendingMessageDelete, setPendingMessageDelete] = useState<AssistantMessage | null>(null)
    const [deletingMessageId, setDeletingMessageId] = useState<string | null>(null)
    const [logDetailsTab, setLogDetailsTab] = useState<LogDetailsTab>('rendered')
    const [copiedLogId, setCopiedLogId] = useState<string | null>(null)
    const [copyErrorByLogId, setCopyErrorByLogId] = useState<Record<string, string | null>>({})
    const [showScrollToBottom, setShowScrollToBottom] = useState(false)
    const [projectPathCopied, setProjectPathCopied] = useState(false)
    const [showFullProjectPath, setShowFullProjectPath] = useState(false)
    const [allLogsCopied, setAllLogsCopied] = useState(false)
    const [clearingLogs, setClearingLogs] = useState(false)
    const [logsExpanded, setLogsExpanded] = useState(false)
    const [composerPreferences, setComposerPreferences] = useState<AssistantComposerPreferences>(() => readAssistantComposerPreferences())

    useEffect(() => {
        localStorage.setItem(LEFT_SIDEBAR_COLLAPSED_STORAGE_KEY, String(leftSidebarCollapsed))
    }, [leftSidebarCollapsed])

    useEffect(() => {
        localStorage.setItem(LEFT_SIDEBAR_WIDTH_STORAGE_KEY, String(leftSidebarWidth))
    }, [leftSidebarWidth])

    useEffect(() => {
        localStorage.setItem(RIGHT_SIDEBAR_OPEN_STORAGE_KEY, String(rightSidebarOpen))
    }, [rightSidebarOpen])

    useEffect(() => subscribeAssistantComposerPreferences((preferences) => {
        setComposerPreferences(preferences)
    }), [])

    useEffect(() => {
        if (!showHeaderMenu) return

        const handlePointerDown = (event: MouseEvent) => {
            if (!headerMenuRef.current?.contains(event.target as Node)) {
                setShowHeaderMenu(false)
            }
        }

        const handleEscape = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                setShowHeaderMenu(false)
            }
        }

        document.addEventListener('mousedown', handlePointerDown)
        window.addEventListener('keydown', handleEscape)
        return () => {
            document.removeEventListener('mousedown', handlePointerDown)
            window.removeEventListener('keydown', handleEscape)
        }
    }, [showHeaderMenu])

    const availableModels = useMemo(() => {
        if (controller.snapshot.knownModels.length > 0) return controller.snapshot.knownModels
        const activeModel = String(controller.activeThread?.model || '').trim()
        return activeModel ? [{ id: activeModel, label: activeModel }] : []
    }, [controller.activeThread?.model, controller.snapshot.knownModels])
    const sidebarSelectedModel = composerPreferences.model || controller.activeThread?.model || availableModels[0]?.id || ''
    const latestTurnUsage = controller.activeThread?.latestTurn?.usage || null
    const contextUsedTokens = latestTurnUsage?.totalTokens ?? null
    const contextWindowTokens = latestTurnUsage?.modelContextWindow ?? null
    const sessionSidebarWidth = leftSidebarCollapsed ? 56 : Math.max(180, Math.min(520, Math.round(leftSidebarWidth)))
    const selectedProjectPath = String(controller.selectedSession?.projectPath || controller.activeThread?.cwd || '').trim()
    const selectedProjectLabel = selectedProjectPath
        ? selectedProjectPath.split(/[\\/]/).filter(Boolean).pop() || selectedProjectPath
        : 'not set'
    const selectedProjectPathWithTilde = selectedProjectPath
        ? selectedProjectPath.replace(/^[A-Z]:\\Users\\[^\\]+/, '~').replace(/\\/g, '/')
        : ''
    const displayProjectPath = showFullProjectPath ? selectedProjectPathWithTilde : selectedProjectLabel
    
    const sidebarMetricChips = [
        {
            label: 'Input tokens',
            value: latestTurnUsage?.inputTokens != null ? formatCompactMetric(latestTurnUsage.inputTokens) : null,
            tone: resolveUsageMetricTone(latestTurnUsage?.inputTokens, contextWindowTokens, { normal: 12_000, high: 40_000 })
        },
        {
            label: 'Output tokens',
            value: latestTurnUsage?.outputTokens != null ? formatCompactMetric(latestTurnUsage.outputTokens) : null,
            tone: resolveUsageMetricTone(latestTurnUsage?.outputTokens, contextWindowTokens, { normal: 4_000, high: 16_000 })
        },
        {
            label: 'Reasoning tokens',
            value: latestTurnUsage?.reasoningOutputTokens != null ? formatCompactMetric(latestTurnUsage.reasoningOutputTokens) : null,
            tone: resolveUsageMetricTone(latestTurnUsage?.reasoningOutputTokens, contextWindowTokens, { normal: 4_000, high: 16_000 })
        },
        {
            label: 'Cached input',
            value: latestTurnUsage?.cachedInputTokens != null ? formatCompactMetric(latestTurnUsage.cachedInputTokens) : null,
            tone: resolveUsageMetricTone(latestTurnUsage?.cachedInputTokens, contextWindowTokens, { normal: 8_000, high: 24_000 })
        },
        {
            label: 'Total tokens',
            value: latestTurnUsage?.totalTokens != null ? formatCompactMetric(latestTurnUsage.totalTokens) : null,
            tone: resolveUsageMetricTone(latestTurnUsage?.totalTokens, contextWindowTokens, { normal: 16_000, high: 48_000 })
        },
        {
            label: 'Context usage',
            value: contextWindowTokens ? formatContextMetric(contextUsedTokens, contextWindowTokens) : null,
            tone: resolveUsageMetricTone(contextUsedTokens, contextWindowTokens, { normal: 0, high: 0 })
        }
    ].filter((entry): entry is { label: string; value: string; tone: UsageMetricTone } => Boolean(entry.value))
    const selectedThinkingLabel = SIDEBAR_EFFORT_LABELS[composerPreferences.effort || 'high']
    const selectedSpeedLabel = composerPreferences.fastModeEnabled ? 'Fast' : 'Standard'
    const selectedRuntimeLabel = controller.activeThread?.runtimeMode === 'full-access' ? 'Full access' : 'Supervised'
    const contextUsedDisplay = contextUsedTokens != null ? formatCompactMetric(contextUsedTokens) : controller.activeThread?.latestTurn ? 'Not reported' : 'No turn yet'
    const contextAvailableDisplay = contextWindowTokens != null ? formatCompactMetric(contextWindowTokens) : controller.activeThread?.latestTurn ? 'Not reported' : 'No turn yet'
    const contextPercentage = contextUsedTokens != null && contextWindowTokens != null && contextWindowTokens > 0 
        ? Math.round((contextUsedTokens / contextWindowTokens) * 100) 
        : null
    const contextColor = contextPercentage != null 
        ? contextPercentage >= 90 ? 'text-red-300' 
        : contextPercentage >= 70 ? 'text-amber-300' 
        : 'text-emerald-300'
        : 'text-sparkle-text'
    const lastTimelineMessage = controller.timelineMessages[controller.timelineMessages.length - 1] || null
    const latestTimelineActivity = controller.activityFeed[0] || null
    const handleDeleteUserMessage = async () => {
        if (!pendingMessageDelete) return
        try {
            setDeletingMessageId(pendingMessageDelete.id)
            const result = await controller.deleteMessageResult(pendingMessageDelete.id, controller.selectedSession?.id)
            if (!result.success) return
            setPendingMessageDelete(null)
        } finally {
            setDeletingMessageId(null)
        }
    }
    const issueActivities = useMemo(() => {
        const nextActivities = [...getIssueActivities(controller.activityFeed)]
        if (controller.commandError) {
            nextActivities.unshift({
                id: `assistant-local-error-${controller.commandError}`,
                kind: 'ui.command-error',
                tone: 'error',
                summary: 'Assistant command failed',
                detail: controller.commandError,
                turnId: controller.activeThread?.latestTurn?.id || null,
                createdAt: latestTimelineActivity?.createdAt
                    || controller.activeThread?.updatedAt
                    || controller.selectedSession?.updatedAt
                    || new Date(0).toISOString()
            })
        }
        return nextActivities
    }, [
        controller.activityFeed,
        controller.commandError,
        controller.activeThread?.latestTurn?.id,
        controller.activeThread?.updatedAt,
        controller.selectedSession?.updatedAt,
        latestTimelineActivity?.createdAt
    ])

    const groupedIssueActivities = useMemo(() => {
        const groups: Array<{ activity: AssistantActivity; activities: AssistantActivity[]; count: number }> = []
        
        for (const activity of issueActivities) {
            const lastGroup = groups[groups.length - 1]
            if (lastGroup && lastGroup.activity.summary === activity.summary && lastGroup.activity.tone === activity.tone) {
                lastGroup.count++
                lastGroup.activities.push(activity)
            } else {
                groups.push({ activity, activities: [activity], count: 1 })
            }
        }
        
        return groups
    }, [issueActivities])
    const latestIssueGroup = groupedIssueActivities[0] || null
    const olderIssueGroups = groupedIssueActivities.slice(1)

    useEffect(() => {
        if (olderIssueGroups.length === 0 && logsExpanded) {
            setLogsExpanded(false)
        }
    }, [logsExpanded, olderIssueGroups.length])

    useEffect(() => {
        if (!controller.bootstrapped || !controller.status?.available || controller.status?.connected || controller.commandPending) {
            return
        }
        const sessionId = controller.selectedSession?.id || null
        if (!sessionId) return
        if (autoConnectAttemptedSessionRef.current === sessionId) return
        autoConnectAttemptedSessionRef.current = sessionId
        void controller.connect(sessionId)
    }, [
        controller.bootstrapped,
        controller.commandPending,
        controller.selectedSession?.id,
        controller.status?.available,
        controller.status?.connected,
        controller.connect
    ])

    const handleCopyLog = async (activity: AssistantActivity) => {
        try {
            await copyTextToClipboard(JSON.stringify(buildIssueLogEntry(activity), null, 2))
            setCopiedLogId(activity.id)
            setCopyErrorByLogId((current) => ({ ...current, [activity.id]: null }))
            window.setTimeout(() => {
                setCopiedLogId((current) => current === activity.id ? null : current)
            }, 1600)
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
    }

    const isTimelineNearBottom = (element: HTMLDivElement) =>
        element.scrollHeight - element.scrollTop - element.clientHeight <= TIMELINE_AUTO_SCROLL_THRESHOLD_PX

    const syncTimelineScrollState = (element: HTMLDivElement) => {
        const nearBottom = isTimelineNearBottom(element)
        shouldAutoScrollRef.current = nearBottom
        setShowScrollToBottom(!nearBottom)
    }

    const scrollTimelineToBottom = (behavior: ScrollBehavior = 'instant') => {
        const element = timelineScrollRef.current
        if (!element) return
        if (behavior === 'instant') {
            element.scrollTop = element.scrollHeight
        } else {
            element.scrollTo({ top: element.scrollHeight, behavior })
        }
    }

    useLayoutEffect(() => {
        const element = timelineScrollRef.current
        if (!element) return
        syncTimelineScrollState(element)
    }, [])

    useLayoutEffect(() => {
        const element = timelineScrollRef.current
        if (!element) return

        // Anchor the timeline before paint so session switches don't visibly jump.
        const isNearBottom = isTimelineNearBottom(element)
        const hasNoScroll = element.scrollTop === 0 && element.scrollHeight > element.clientHeight

        if (isNearBottom || hasNoScroll) {
            shouldAutoScrollRef.current = true
            setShowScrollToBottom(false)
            scrollTimelineToBottom('instant')
        }

        syncTimelineScrollState(element)
    }, [controller.selectedSession?.id, controller.activeThread?.id, controller.loading])

    useLayoutEffect(() => {
        const element = timelineScrollRef.current
        if (!element) return

        if (!shouldAutoScrollRef.current && !isTimelineNearBottom(element)) {
            setShowScrollToBottom(true)
            return
        }

        scrollTimelineToBottom('instant')
        const nextElement = timelineScrollRef.current
        if (nextElement) syncTimelineScrollState(nextElement)
    }, [
        controller.timelineMessages.length,
        lastTimelineMessage?.id,
        lastTimelineMessage?.updatedAt,
        controller.activityFeed.length,
        latestTimelineActivity?.id,
        latestTimelineActivity?.createdAt
    ])

    return (
        <div className="-m-6 h-[calc(100vh-46px)] min-h-[calc(100vh-46px)] overflow-hidden flex flex-col animate-fadeIn [--accent-primary:var(--color-primary)] [--accent-secondary:var(--color-secondary)]">
            <div className="flex-1 min-h-0 overflow-hidden">
                <div className="h-full flex">
                    <AssistantSessionsRail
                        collapsed={leftSidebarCollapsed}
                        width={sessionSidebarWidth}
                        compact={false}
                        sessions={controller.snapshot.sessions}
                        activeSessionId={controller.selectedSession?.id || null}
                        commandPending={controller.commandPending}
                        onSetCollapsed={setLeftSidebarCollapsed}
                        onWidthChange={setLeftSidebarWidth}
                        onCreateSession={() => controller.createSession()}
                        onSelectSession={controller.selectSession}
                        onRenameSession={(sessionId, title) => controller.renameSession(sessionId, title)}
                        onArchiveSession={controller.archiveSession}
                        onDeleteSession={controller.deleteSession}
                    />

                    <div className="flex min-w-0 flex-1">
                        <section className={cn(
                            'flex min-w-0 flex-1 flex-col transition-all duration-300',
                            rightSidebarOpen && 'border-r border-white/10'
                        )}>
                            <div className="flex items-center justify-between gap-2 border-b border-white/10 bg-sparkle-card px-3 py-1.5">
                                <div className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden">
                                    <h2 className="truncate text-[13px] font-semibold leading-none text-sparkle-text">
                                        {controller.selectedSession?.title || 'Assistant'}
                                    </h2>
                                    <span
                                        className="inline-flex max-w-[220px] shrink-0 items-center rounded-full border border-white/10 bg-white/[0.03] px-2 py-0.5 text-[10px] font-medium leading-none text-sparkle-text-secondary"
                                        title={selectedProjectPath || 'No project selected'}
                                    >
                                        <span className="truncate">{selectedProjectLabel}</span>
                                    </span>
                                </div>

                                <div ref={headerMenuRef} className="relative flex shrink-0 items-center gap-1.5">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            if (controller.status?.connected) {
                                                void controller.disconnect(controller.selectedSession?.id || undefined)
                                            } else {
                                                void controller.connect(controller.selectedSession?.id || undefined)
                                            }
                                        }}
                                        disabled={controller.commandPending}
                                        className={cn(
                                            'rounded-lg border p-1 transition-colors disabled:opacity-60',
                                            controller.status?.connected
                                                ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/15'
                                                : 'border-white/10 bg-sparkle-card text-sparkle-text-secondary hover:border-white/20 hover:bg-white/[0.03] hover:text-sparkle-text'
                                        )}
                                        title={controller.status?.connected ? 'Disconnect assistant' : 'Connect assistant'}
                                    >
                                        <PlugZap size={14} />
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setShowHeaderMenu((prev) => !prev)}
                                        className="rounded-lg border border-white/10 bg-sparkle-card p-1.5 text-sparkle-text-secondary transition-colors hover:border-white/20 hover:bg-white/[0.03] hover:text-sparkle-text"
                                        title="More actions"
                                    >
                                        <MoreHorizontal size={14} />
                                    </button>

                                    {showHeaderMenu && (
                                        <div className="absolute right-0 top-full z-20 mt-2 w-52 rounded-lg border border-white/10 bg-sparkle-card p-1 shadow-lg">
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    void controller.refreshModels()
                                                    setShowHeaderMenu(false)
                                                }}
                                                className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-xs text-sparkle-text-secondary transition-colors hover:bg-sparkle-card-hover hover:text-sparkle-text"
                                            >
                                                <RefreshCcw size={13} />
                                                Refresh models
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    void controller.newThread(controller.selectedSession?.id || undefined)
                                                    setShowHeaderMenu(false)
                                                }}
                                                className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-xs text-sparkle-text-secondary transition-colors hover:bg-sparkle-card-hover hover:text-sparkle-text"
                                            >
                                                <RefreshCcw size={13} />
                                                New thread
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setRightSidebarOpen((current) => !current)
                                                    setShowHeaderMenu(false)
                                                }}
                                                className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-xs text-sparkle-text-secondary transition-colors hover:bg-sparkle-card-hover hover:text-sparkle-text"
                                            >
                                                {rightSidebarOpen ? <Unplug size={13} /> : <PlugZap size={13} />}
                                                {rightSidebarOpen ? 'Hide details' : 'Show details'}
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="relative flex-1 min-h-0 bg-sparkle-bg">
                                {controller.loading ? (
                                    <div className="flex h-full items-center justify-center text-sparkle-text-secondary">
                                        <Loader2 size={18} className="mr-2 animate-spin" />
                                        Loading assistant snapshot...
                                    </div>
                                ) : (
                                    <>
                                        <div
                                            ref={timelineScrollRef}
                                            onScroll={(event) => syncTimelineScrollState(event.currentTarget)}
                                            className="custom-scrollbar h-full overflow-y-auto px-4 py-4"
                                        >
                                            <div className={cn('mx-auto w-full', ASSISTANT_CHAT_WIDTH_CLASS)}>
                                                <AssistantTimeline
                                                    messages={controller.timelineMessages}
                                                    activities={controller.activityFeed}
                                                    isWorking={controller.phase.key === 'running'}
                                                    activeWorkStartedAt={controller.activeThread?.latestTurn?.startedAt || null}
                                                    latestAssistantMessageId={controller.activeThread?.latestTurn?.assistantMessageId || null}
                                                    latestTurnStartedAt={controller.activeThread?.latestTurn?.startedAt || null}
                                                    deletingMessageId={deletingMessageId}
                                                    onRequestDeleteUserMessage={setPendingMessageDelete}
                                                />
                                            </div>
                                        </div>
                                        <div className="pointer-events-none absolute inset-x-0 bottom-4 flex justify-center px-4">
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    shouldAutoScrollRef.current = true
                                                    setShowScrollToBottom(false)
                                                    scrollTimelineToBottom('smooth')
                                                }}
                                                className={cn(
                                                    'pointer-events-auto inline-flex items-center gap-2 rounded-full border border-white/10 bg-sparkle-card/95 px-3 py-2 text-xs text-sparkle-text-secondary shadow-lg shadow-black/20 backdrop-blur-xl transition-all hover:border-white/20 hover:bg-white/[0.05] hover:text-sparkle-text',
                                                    showScrollToBottom ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-2 opacity-0'
                                                )}
                                                title="Scroll to bottom"
                                            >
                                                <ArrowDown size={13} />
                                                Scroll to bottom
                                            </button>
                                        </div>
                                    </>
                                )}
                            </div>

                            <div className="relative px-4 py-3">
                                <div className={cn('mx-auto w-full', ASSISTANT_CHAT_WIDTH_CLASS)}>
                                    <AssistantComposer
                                        disabled={controller.commandPending || !controller.selectedSession || !controller.status?.available}
                                        isSending={controller.commandPending}
                                        isThinking={controller.commandPending || controller.phase.key === 'running'}
                                        isConnected={Boolean(controller.status?.connected)}
                                        activeModel={controller.activeThread?.model || availableModels[0]?.id || undefined}
                                        modelOptions={availableModels}
                                        modelsLoading={controller.modelsLoading}
                                        modelsError={null}
                                        activeProfile={controller.activeThread?.runtimeMode === 'full-access' ? 'yolo-fast' : 'safe-dev'}
                                        runtimeMode={controller.activeThread?.runtimeMode || 'approval-required'}
                                        interactionMode={controller.activeThread?.interactionMode || 'default'}
                                        projectPath={controller.selectedSession?.projectPath || controller.activeThread?.cwd || null}
                                        onRefreshModels={() => void controller.refreshModels()}
                                        onSend={async (prompt, contextFiles, options) => {
                                            const result = await controller.sendPromptResult(buildPromptWithContextFiles(prompt, contextFiles), {
                                                sessionId: controller.selectedSession?.id || undefined,
                                                model: options.model,
                                                runtimeMode: options.runtimeMode,
                                                interactionMode: options.interactionMode,
                                                effort: options.effort,
                                                serviceTier: options.serviceTier
                                            })
                                            return result.success
                                        }}
                                    />
                                </div>
                            </div>
                        </section>

                        <div className={cn(
                            'relative overflow-hidden transition-all duration-300',
                            rightSidebarOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
                        )} style={{ width: rightSidebarOpen ? '380px' : '0px' }}>
                            <aside className="flex h-full min-h-0 flex-col bg-sparkle-bg">
                                {/* Header */}
                                <div className="flex shrink-0 items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
                                    <h2 className="text-sm font-semibold text-sparkle-text">Thread Details</h2>
                                    <button
                                        type="button"
                                        onClick={() => setRightSidebarOpen(false)}
                                        className="rounded-md border border-white/10 bg-white/[0.03] p-1.5 text-sparkle-text-secondary transition-colors hover:border-white/20 hover:bg-white/[0.05] hover:text-sparkle-text"
                                        title="Close panel"
                                    >
                                        <ChevronRight size={14} />
                                    </button>
                                </div>

                                {/* Top Section - Fixed */}
                                <div className="shrink-0 space-y-3 border-b border-white/10 px-4 py-4">
                                    {/* Project */}
                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between gap-2">
                                            <span className="text-[11px] font-medium uppercase tracking-[0.16em] text-sparkle-text-muted">Project</span>
                                            {selectedProjectPath && selectedProjectLabel !== 'Detached' && (
                                                <button
                                                    type="button"
                                                    onClick={async () => {
                                                        try {
                                                            await copyTextToClipboard(selectedProjectPath)
                                                            setProjectPathCopied(true)
                                                            setTimeout(() => setProjectPathCopied(false), 1600)
                                                        } catch {}
                                                    }}
                                                    className={cn(
                                                        'shrink-0 rounded-md border p-1 transition-colors',
                                                        projectPathCopied
                                                            ? 'border-emerald-400/20 bg-emerald-500/[0.08] text-emerald-200'
                                                            : 'border-white/10 bg-white/[0.03] text-sparkle-text-secondary hover:border-white/20 hover:bg-white/[0.05] hover:text-sparkle-text'
                                                    )}
                                                    title={projectPathCopied ? 'Copied!' : `Copy full path: ${selectedProjectPath}`}
                                                >
                                                    {projectPathCopied ? <Check size={11} /> : <Copy size={11} />}
                                                </button>
                                            )}
                                        </div>
                                        {selectedProjectPath && selectedProjectLabel !== 'Detached' ? (
                                            <button
                                                type="button"
                                                onClick={() => setShowFullProjectPath(!showFullProjectPath)}
                                                onDoubleClick={async (e) => {
                                                    e.preventDefault()
                                                    try {
                                                        await copyTextToClipboard(selectedProjectPath)
                                                        setProjectPathCopied(true)
                                                        setTimeout(() => setProjectPathCopied(false), 1600)
                                                    } catch {}
                                                }}
                                                className="w-full truncate text-left text-sm font-medium text-sparkle-text transition-colors hover:text-sparkle-text-secondary"
                                                title={showFullProjectPath ? 'Show folder name (double-click to copy)' : 'Show full path (double-click to copy)'}
                                            >
                                                {displayProjectPath}
                                            </button>
                                        ) : (
                                            <span className="block truncate text-sm font-medium text-sparkle-text">{selectedProjectLabel}</span>
                                        )}
                                    </div>

                                    {/* Status */}
                                    {(controller.pendingApprovals.length > 0 || controller.pendingUserInputs.length > 0) && (
                                        <div className="space-y-2 border-t border-white/5 pt-3">
                                            <span className="text-[11px] font-medium uppercase tracking-[0.16em] text-sparkle-text-muted">Status</span>
                                            <div className="space-y-1.5 text-xs">
                                                {controller.pendingApprovals.length > 0 && (
                                                    <div className="flex items-center justify-between gap-3">
                                                        <span className="text-sparkle-text-secondary">Pending approvals</span>
                                                        <span className="font-medium text-amber-300">{controller.pendingApprovals.length}</span>
                                                    </div>
                                                )}
                                                {controller.pendingUserInputs.length > 0 && (
                                                    <div className="flex items-center justify-between gap-3">
                                                        <span className="text-sparkle-text-secondary">User input needed</span>
                                                        <span className="font-medium text-amber-300">{controller.pendingUserInputs.length}</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    {/* Context */}
                                    <div className="space-y-2 border-t border-white/5 pt-3">
                                        <span className="text-[11px] font-medium uppercase tracking-[0.16em] text-sparkle-text-muted">Context</span>
                                        {contextPercentage != null ? (
                                            <div className="space-y-2">
                                                <div className="flex items-center justify-between text-xs">
                                                    <span className="text-sparkle-text-secondary">Usage</span>
                                                    <span className={cn('font-semibold', contextColor)}>{contextPercentage}%</span>
                                                </div>
                                                <div className="h-1.5 overflow-hidden rounded-full bg-white/5">
                                                    <div 
                                                        className={cn(
                                                            'h-full transition-all duration-300',
                                                            contextPercentage >= 90 ? 'bg-red-400' 
                                                            : contextPercentage >= 70 ? 'bg-amber-400' 
                                                            : 'bg-emerald-400'
                                                        )}
                                                        style={{ width: `${Math.min(contextPercentage, 100)}%` }}
                                                    />
                                                </div>
                                                <div className="flex items-center justify-between text-[11px] text-sparkle-text-muted">
                                                    <span>{contextUsedDisplay} used</span>
                                                    <span>{contextAvailableDisplay} available</span>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="text-xs text-sparkle-text-secondary">
                                                {controller.activeThread?.latestTurn ? 'Not reported' : 'No turn yet'}
                                            </div>
                                        )}
                                    </div>

                                    {/* Configuration */}
                                    <div className="space-y-2 border-t border-white/5 pt-3">
                                        <div className="flex items-center justify-between gap-2">
                                            <span className="text-[11px] font-medium uppercase tracking-[0.16em] text-sparkle-text-muted">Configuration</span>
                                        </div>
                                        <div className="space-y-1.5 text-xs">
                                            <div className="flex items-center justify-between gap-3">
                                                <span className="text-sparkle-text-secondary">Model</span>
                                                <span className="truncate font-medium text-sparkle-text">{sidebarSelectedModel || 'None'}</span>
                                            </div>
                                            <div className="flex items-center justify-between gap-3">
                                                <span className="text-sparkle-text-secondary">Mode</span>
                                                <span className="font-medium text-sparkle-text">{selectedRuntimeLabel}</span>
                                            </div>
                                            <div className="flex items-center justify-between gap-3">
                                                <span className="text-sparkle-text-secondary">Thinking</span>
                                                <span className="font-medium text-sparkle-text">{selectedThinkingLabel}</span>
                                            </div>
                                            <div className="flex items-center justify-between gap-3">
                                                <span className="text-sparkle-text-secondary">Speed</span>
                                                <span className="font-medium text-sparkle-text">{selectedSpeedLabel}</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Usage Metrics Table */}
                                    {sidebarMetricChips.length > 0 && (
                                        <div className="space-y-2 border-t border-white/5 pt-3">
                                            <span className="text-[11px] font-medium uppercase tracking-[0.16em] text-sparkle-text-muted">Usage Metrics</span>
                                            <div className="space-y-1 text-xs">
                                                {sidebarMetricChips.map((chip) => (
                                                    <div key={chip.label} className="flex items-center justify-between gap-3 rounded-lg bg-white/[0.02] px-2 py-1.5">
                                                        <span className="text-sparkle-text-secondary">{chip.label}</span>
                                                        <span className={cn('inline-flex items-center gap-2 font-mono', getUsageMetricToneClass(chip.tone))}>
                                                            <span className={cn('h-1.5 w-1.5 rounded-full', getUsageMetricDotClass(chip.tone))} />
                                                            {chip.value}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Bottom Section - Scrollable Logs */}
                                <div className="flex min-h-0 flex-1 flex-col">
                                    <div className="flex shrink-0 items-center justify-between gap-2 border-b border-white/10 px-4 py-3">
                                        <div className="flex items-center gap-2">
                                            <span className="text-[11px] font-medium uppercase tracking-[0.16em] text-sparkle-text-muted">Logs</span>
                                            <span className="text-[11px] text-sparkle-text-muted">({issueActivities.length})</span>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            {olderIssueGroups.length > 0 && (
                                                <button
                                                    type="button"
                                                    onClick={() => setLogsExpanded((current) => !current)}
                                                    className="rounded-md border border-white/10 bg-white/[0.03] p-1 text-sparkle-text-secondary transition-colors hover:border-white/20 hover:bg-white/[0.05] hover:text-sparkle-text"
                                                    title={logsExpanded ? 'Collapse logs' : `Show ${olderIssueGroups.length} earlier logs`}
                                                >
                                                    <ChevronDown
                                                        size={12}
                                                        className={cn('transition-transform duration-200', logsExpanded && 'rotate-180')}
                                                    />
                                                </button>
                                            )}
                                            <button
                                                type="button"
                                                onClick={async () => {
                                                    try {
                                                        const allLogs = issueActivities.map(activity => 
                                                            JSON.stringify(buildIssueLogEntry(activity), null, 2)
                                                        ).join('\n\n---\n\n')
                                                        await copyTextToClipboard(allLogs)
                                                        setAllLogsCopied(true)
                                                        setTimeout(() => setAllLogsCopied(false), 1600)
                                                    } catch {}
                                                }}
                                                className={cn(
                                                    'rounded-md border p-1 transition-colors',
                                                    allLogsCopied
                                                        ? 'border-emerald-400/20 bg-emerald-500/[0.08] text-emerald-200'
                                                        : 'border-white/10 bg-white/[0.03] text-sparkle-text-secondary hover:border-white/20 hover:bg-white/[0.05] hover:text-sparkle-text'
                                                )}
                                                title={allLogsCopied ? 'Copied!' : 'Copy all logs'}
                                            >
                                                {allLogsCopied ? <Check size={11} /> : <Copy size={11} />}
                                            </button>
                                            <button
                                                type="button"
                                                onClick={async () => {
                                                    if (!controller.selectedSession?.id || !latestIssueGroup || clearingLogs) return
                                                    try {
                                                        setClearingLogs(true)
                                                        setLogsExpanded(false)
                                                        const result = await controller.clearLogsResult(controller.selectedSession.id)
                                                        if (!result.success) return
                                                        controller.clearCommandError()
                                                    } finally {
                                                        setClearingLogs(false)
                                                    }
                                                }}
                                                disabled={!controller.selectedSession?.id || !latestIssueGroup || clearingLogs}
                                                className={cn(
                                                    'rounded-md border p-1 transition-colors',
                                                    !controller.selectedSession?.id || !latestIssueGroup || clearingLogs
                                                        ? 'border-white/10 bg-white/[0.03] text-sparkle-text-secondary opacity-50 cursor-not-allowed'
                                                        : 'border-white/10 bg-white/[0.03] text-sparkle-text-secondary hover:border-white/20 hover:bg-white/[0.05] hover:text-sparkle-text'
                                                )}
                                                title={
                                                    clearingLogs
                                                        ? 'Clearing logs...'
                                                        : latestIssueGroup
                                                            ? 'Clear logs'
                                                            : 'No logs to clear'
                                                }
                                            >
                                                {clearingLogs ? <Loader2 size={11} className="animate-spin" /> : <Trash2 size={11} />}
                                            </button>
                                        </div>
                                    </div>
                                    <div className="flex-1 overflow-y-auto px-4 py-3 custom-scrollbar">
                                        {latestIssueGroup ? (
                                            <div className="space-y-2">
                                                <IssueLogRow
                                                    key={latestIssueGroup.activity.id}
                                                    activity={latestIssueGroup.activity}
                                                    activities={latestIssueGroup.activities}
                                                    count={latestIssueGroup.count}
                                                    copied={copiedLogId === latestIssueGroup.activity.id}
                                                    copyError={copyErrorByLogId[latestIssueGroup.activity.id] || null}
                                                    onCopy={handleCopyLog}
                                                    onShowMore={(nextActivity) => {
                                                        setSelectedLogActivity(nextActivity)
                                                        setLogDetailsTab('rendered')
                                                    }}
                                                />
                                                <AnimatedHeight isOpen={logsExpanded && olderIssueGroups.length > 0} duration={260}>
                                                    <div className="space-y-2 pt-2">
                                                        {olderIssueGroups.map((group) => (
                                                            <IssueLogRow
                                                                key={group.activity.id}
                                                                activity={group.activity}
                                                                activities={group.activities}
                                                                count={group.count}
                                                                copied={copiedLogId === group.activity.id}
                                                                copyError={copyErrorByLogId[group.activity.id] || null}
                                                                onCopy={handleCopyLog}
                                                                onShowMore={(nextActivity) => {
                                                                    setSelectedLogActivity(nextActivity)
                                                                    setLogDetailsTab('rendered')
                                                                }}
                                                            />
                                                        ))}
                                                    </div>
                                                </AnimatedHeight>
                                            </div>
                                        ) : (
                                            <div className="text-center text-xs text-sparkle-text-muted">No logs</div>
                                        )}
                                    </div>
                                </div>
                            </aside>
                        </div>
                    </div>
                </div>
            </div>
            <IssueLogDetailsModal
                activity={selectedLogActivity}
                tab={logDetailsTab}
                onChangeTab={setLogDetailsTab}
                onClose={() => setSelectedLogActivity(null)}
            />
            <ConfirmModal
                isOpen={Boolean(pendingMessageDelete)}
                title="Delete message from history?"
                message="This will remove the selected user message and all later conversation history after it for the current thread. This cannot be undone."
                confirmLabel={deletingMessageId ? 'Deleting...' : 'Delete history'}
                cancelLabel="Cancel"
                variant="danger"
                onConfirm={() => void handleDeleteUserMessage()}
                onCancel={() => {
                    if (deletingMessageId) return
                    setPendingMessageDelete(null)
                }}
            />
        </div>
    )
}
