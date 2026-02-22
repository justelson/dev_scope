import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import {
    ArrowLeft,
    Bot,
    Clock3,
    Gauge,
    MessageSquare,
    RefreshCw,
    Shield,
    Sparkles,
    Workflow
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
    clampPercent,
    formatUsageMetric,
    formatResetAt,
    getUsageDisplayPercent,
    formatWindowDurationMins,
    normalizeRateLimitBuckets,
    selectUsageBucket,
    type RateLimitBucket,
    type UsageDisplayMode
} from './assistant-account-usage'

type DashboardTab = 'account' | 'usage'
type AssistantEventPayload = { type?: string; timestamp?: number }
type AssistantHistoryPayload = { role?: 'user' | 'assistant' | 'system'; text?: string }

type AssistantSnapshot = {
    connected: boolean
    state: string
    provider: string
    model: string
    profile: string
    approvalMode: string
    activeTurnId: string
    lastError: string
    accountMode: string
    accountName: string
    accountEmail: string
    requiresOpenaiAuth: boolean
    rateLimitBucketCount: number
    fiveHourUsedPercent: number | null
    fiveHourWindow: string
    fiveHourReset: string
    weeklyUsedPercent: number | null
    weeklyWindow: string
    weeklyReset: string
    sessionsTotal: number
    sessionsArchived: number
    historyTotal: number
    userMessages: number
    assistantMessages: number
    charsTotal: number
    estimatedTokens: number
    activityEvents: number
    reasoningEvents: number
    approvalEvents: number
    eventsStored: number
    telemetryMonotonic: boolean
    newestEventAt: number | null
    oldestEventAt: number | null
    modelsAvailable: number
    buckets: RateLimitBucket[]
}

const EMPTY_SNAPSHOT: AssistantSnapshot = {
    connected: false,
    state: 'offline',
    provider: 'codex',
    model: 'default',
    profile: 'safe-dev',
    approvalMode: 'safe',
    activeTurnId: 'none',
    lastError: '',
    accountMode: 'unknown',
    accountName: '',
    accountEmail: '',
    requiresOpenaiAuth: false,
    rateLimitBucketCount: 0,
    fiveHourUsedPercent: null,
    fiveHourWindow: 'Unknown window',
    fiveHourReset: 'reset unknown',
    weeklyUsedPercent: null,
    weeklyWindow: 'Unknown window',
    weeklyReset: 'reset unknown',
    sessionsTotal: 0,
    sessionsArchived: 0,
    historyTotal: 0,
    userMessages: 0,
    assistantMessages: 0,
    charsTotal: 0,
    estimatedTokens: 0,
    activityEvents: 0,
    reasoningEvents: 0,
    approvalEvents: 0,
    eventsStored: 0,
    telemetryMonotonic: true,
    newestEventAt: null,
    oldestEventAt: null,
    modelsAvailable: 0,
    buckets: []
}

const asRecord = (value: unknown): Record<string, unknown> | null => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null
    return value as Record<string, unknown>
}

const readString = (value: unknown): string => (typeof value === 'string' ? value.trim() : '')
const tabFromPath = (pathname: string): DashboardTab => pathname.endsWith('/usage') ? 'usage' : 'account'

function formatTime(value: number | null): string {
    if (!value || !Number.isFinite(value)) return '--'
    return new Date(value).toLocaleString()
}

function formatSince(value: number | null): string {
    if (!value || !Number.isFinite(value)) return 'No events yet'
    const delta = Math.max(0, Date.now() - value)
    if (delta < 1000) return 'just now'
    const sec = Math.floor(delta / 1000)
    if (sec < 60) return `${sec}s ago`
    const min = Math.floor(sec / 60)
    if (min < 60) return `${min}m ago`
    const hrs = Math.floor(min / 60)
    if (hrs < 24) return `${hrs}h ago`
    return `${Math.floor(hrs / 24)}d ago`
}

function StatCard({
    title,
    value,
    hint,
    tone = 'default'
}: {
    title: string
    value: string | number
    hint?: string
    tone?: 'default' | 'good' | 'warn' | 'info'
}) {
    return (
        <div className={cn(
            'rounded-xl border bg-sparkle-card p-4 transition-colors',
            tone === 'good' && 'border-emerald-500/30',
            tone === 'warn' && 'border-amber-500/30',
            tone === 'info' && 'border-sky-500/30',
            tone === 'default' && 'border-sparkle-border'
        )}>
            <p className="text-[11px] uppercase tracking-wide text-sparkle-text-muted">{title}</p>
            <p className="mt-2 text-2xl font-semibold text-sparkle-text animate-fadeIn">{value}</p>
            {hint && <p className="mt-1 text-xs text-sparkle-text-secondary">{hint}</p>}
        </div>
    )
}

function UsageProgress({
    label,
    value,
    mode,
    windowText,
    resetText
}: {
    label: string
    value: number | null
    mode: UsageDisplayMode
    windowText: string
    resetText: string
}) {
    const clamped = clampPercent(value)
    const displayPercent = getUsageDisplayPercent(clamped, mode)
    return (
        <div className="rounded-xl border border-sparkle-border bg-sparkle-card p-4">
            <p className="text-xs text-sparkle-text-muted">{label}</p>
            <p className="mt-1 text-xl font-semibold text-sparkle-text">{formatUsageMetric(clamped, mode)}</p>
            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-sparkle-bg">
                <div className={cn(
                    'h-full transition-all duration-500',
                    clamped == null ? 'bg-sparkle-border' : clamped >= 90 ? 'bg-red-400/80' : clamped >= 70 ? 'bg-amber-400/80' : 'bg-emerald-400/80'
                )} style={{ width: `${displayPercent ?? 0}%` }} />
            </div>
            <p className="mt-2 text-[11px] text-sparkle-text-secondary">{windowText} • resets {resetText}</p>
        </div>
    )
}

function UsageModeToggle({
    mode,
    onChange
}: {
    mode: UsageDisplayMode
    onChange: (next: UsageDisplayMode) => void
}) {
    return (
        <div className="inline-flex rounded-lg border border-sparkle-border bg-sparkle-bg p-0.5" role="group" aria-label="Usage display mode">
            <button
                type="button"
                onClick={() => onChange('used')}
                aria-pressed={mode === 'used'}
                className={cn(
                    'rounded-md px-2.5 py-1 text-xs transition-colors',
                    mode === 'used'
                        ? 'border border-cyan-500/30 bg-cyan-500/20 text-cyan-200'
                        : 'text-sparkle-text-secondary hover:bg-sparkle-card hover:text-sparkle-text'
                )}
            >
                Used
            </button>
            <button
                type="button"
                onClick={() => onChange('remaining')}
                aria-pressed={mode === 'remaining'}
                className={cn(
                    'rounded-md px-2.5 py-1 text-xs transition-colors',
                    mode === 'remaining'
                        ? 'border border-violet-500/30 bg-violet-500/20 text-violet-200'
                        : 'text-sparkle-text-secondary hover:bg-sparkle-card hover:text-sparkle-text'
                )}
            >
                Remaining
            </button>
        </div>
    )
}

export default function AssistantAccountSettings({
    embedded = false,
    forcedTab
}: {
    embedded?: boolean
    forcedTab?: DashboardTab
} = {}) {
    const location = useLocation()
    const navigate = useNavigate()
    const [snapshot, setSnapshot] = useState<AssistantSnapshot>(EMPTY_SNAPSHOT)
    const [isLoading, setIsLoading] = useState(true)
    const [isRefreshing, setIsRefreshing] = useState(false)
    const [liveEnabled, setLiveEnabled] = useState(true)
    const [lastUpdatedAt, setLastUpdatedAt] = useState<number>(Date.now())
    const [errorMessage, setErrorMessage] = useState('')
    const [activeTab, setActiveTab] = useState<DashboardTab>(forcedTab || tabFromPath(location.pathname))
    const [usageDisplayMode, setUsageDisplayMode] = useState<UsageDisplayMode>('used')

    const loadSnapshot = useCallback(async () => {
        setIsRefreshing(true)
        try {
            const statusResult = await window.devscope.assistant.status()
            const status = asRecord((statusResult as any)?.status) || {}
            const isConnected = Boolean(status.connected)

            const [sessionsResult, historyResult, eventsResult, integrityResult, optionalRuntime] = await Promise.all([
                window.devscope.assistant.listSessions(),
                window.devscope.assistant.getHistory(),
                window.devscope.assistant.getEvents({ limit: 2000 }),
                window.devscope.assistant.getTelemetryIntegrity(),
                isConnected
                    ? Promise.all([
                        window.devscope.assistant.listModels(),
                        window.devscope.assistant.readAccount(false),
                        window.devscope.assistant.readRateLimits()
                    ])
                    : Promise.resolve([null, null, null] as const)
            ])

            const [modelResult, accountResult, rateLimitResult] = optionalRuntime as readonly [unknown, unknown, unknown]
            const sessions = Array.isArray((sessionsResult as any)?.sessions) ? (sessionsResult as any).sessions : []
            const history = Array.isArray((historyResult as { history?: AssistantHistoryPayload[] })?.history) ? (historyResult as { history: AssistantHistoryPayload[] }).history : []
            const events = Array.isArray((eventsResult as { events?: AssistantEventPayload[] })?.events) ? (eventsResult as { events: AssistantEventPayload[] }).events : []
            const models = Array.isArray((modelResult as any)?.models) ? (modelResult as any).models : []

            const accountPayload = asRecord((accountResult as any)?.result) || {}
            const accountInfo = asRecord(accountPayload.account) || accountPayload
            const accountMode = readString(accountInfo.type || accountPayload.type || accountInfo.authType) || 'unknown'
            const accountName = readString(accountInfo.name || accountInfo.displayName || accountInfo.fullName)
            const accountEmail = readString(accountInfo.email || accountInfo.emailAddress || accountInfo.userEmail)
            const requiresOpenaiAuth = Boolean(accountPayload.requiresOpenaiAuth || accountInfo.requiresOpenaiAuth)

            const rateLimitsPayload = (rateLimitResult as any)?.result
            const buckets = normalizeRateLimitBuckets(rateLimitsPayload)
            const fiveHour = selectUsageBucket(buckets, { windowMins: 300, nameHints: ['5h', '5-hour', 'five', 'hour'] })
            const weekly = selectUsageBucket(buckets, { windowMins: 10080, nameHints: ['week', 'weekly', '7d', '7-day'] })

            const userMessages = history.filter((entry) => entry.role === 'user').length
            const assistantMessages = history.filter((entry) => entry.role === 'assistant').length
            const charsTotal = history.reduce((sum, entry) => sum + String(entry.text || '').length, 0)
            const activityEvents = events.filter((entry) => entry.type === 'assistant-activity').length
            const reasoningEvents = events.filter((entry) => entry.type === 'assistant-reasoning').length
            const approvalEvents = events.filter((entry) => String(entry.type || '').includes('approval')).length

            const telemetry = integrityResult as {
                eventsStored?: number
                monotonicDescending?: boolean
                newestTimestamp?: number | null
                oldestTimestamp?: number | null
            }

            setSnapshot({
                connected: Boolean(status.connected),
                state: readString(status.state) || 'offline',
                provider: readString(status.provider) || 'codex',
                model: readString(status.model) || 'default',
                profile: readString(status.profile) || 'safe-dev',
                approvalMode: readString(status.approvalMode) || 'safe',
                activeTurnId: readString(status.activeTurnId) || 'none',
                lastError: readString(status.lastError),
                accountMode,
                accountName,
                accountEmail,
                requiresOpenaiAuth,
                rateLimitBucketCount: buckets.length,
                fiveHourUsedPercent: clampPercent(fiveHour?.usedPercent ?? null),
                fiveHourWindow: formatWindowDurationMins(fiveHour?.windowDurationMins ?? null),
                fiveHourReset: formatResetAt(fiveHour?.resetsAt ?? null),
                weeklyUsedPercent: clampPercent(weekly?.usedPercent ?? null),
                weeklyWindow: formatWindowDurationMins(weekly?.windowDurationMins ?? null),
                weeklyReset: formatResetAt(weekly?.resetsAt ?? null),
                sessionsTotal: sessions.length,
                sessionsArchived: sessions.filter((session: any) => Boolean(session?.archived)).length,
                historyTotal: history.length,
                userMessages,
                assistantMessages,
                charsTotal,
                estimatedTokens: Math.max(0, Math.ceil(charsTotal / 4)),
                activityEvents,
                reasoningEvents,
                approvalEvents,
                eventsStored: Number(telemetry.eventsStored) || events.length,
                telemetryMonotonic: telemetry.monotonicDescending !== false,
                newestEventAt: telemetry.newestTimestamp ?? events[0]?.timestamp ?? null,
                oldestEventAt: telemetry.oldestTimestamp ?? events[events.length - 1]?.timestamp ?? null,
                modelsAvailable: models.length,
                buckets
            })
            setErrorMessage('')
        } catch (error: any) {
            setErrorMessage(error?.message || 'Failed to load account and usage metrics.')
        } finally {
            setIsLoading(false)
            setIsRefreshing(false)
            setLastUpdatedAt(Date.now())
        }
    }, [])

    useEffect(() => { void loadSnapshot() }, [loadSnapshot])
    useEffect(() => {
        if (!liveEnabled) return
        const timer = window.setInterval(() => { void loadSnapshot() }, 3000)
        return () => window.clearInterval(timer)
    }, [liveEnabled, loadSnapshot])
    useEffect(() => {
        if (forcedTab) {
            setActiveTab(forcedTab)
            return
        }
        setActiveTab(tabFromPath(location.pathname))
    }, [forcedTab, location.pathname])
    useEffect(() => {
        const unsubscribe = window.devscope.assistant.onEvent((event) => {
            if (!event?.type) return
            if (event.type === 'account/updated' || event.type === 'account/rateLimits/updated') {
                void loadSnapshot()
            }
        })
        return () => unsubscribe()
    }, [loadSnapshot])

    const eventMix = useMemo(() => {
        const total = snapshot.activityEvents + snapshot.reasoningEvents + snapshot.approvalEvents
        if (total <= 0) return { activity: 0, reasoning: 0, approvals: 0 }
        return {
            activity: Math.round((snapshot.activityEvents / total) * 100),
            reasoning: Math.round((snapshot.reasoningEvents / total) * 100),
            approvals: Math.round((snapshot.approvalEvents / total) * 100)
        }
    }, [snapshot.activityEvents, snapshot.reasoningEvents, snapshot.approvalEvents])
    const fiveHourDisplayPercent = useMemo(
        () => getUsageDisplayPercent(snapshot.fiveHourUsedPercent, usageDisplayMode),
        [snapshot.fiveHourUsedPercent, usageDisplayMode]
    )
    const weeklyDisplayPercent = useMemo(
        () => getUsageDisplayPercent(snapshot.weeklyUsedPercent, usageDisplayMode),
        [snapshot.weeklyUsedPercent, usageDisplayMode]
    )

    return (
        <div className="animate-fadeIn">
            {!embedded && (
                <div className="mb-8 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-cyan-500/10"><Gauge className="text-cyan-300" size={24} /></div>
                        <div>
                            <h1 className="text-2xl font-semibold text-sparkle-text">Account & Usage</h1>
                            <p className="text-sparkle-text-secondary">Connected ChatGPT/Codex account and live usage limits.</p>
                        </div>
                    </div>
                    <Link to="/settings" className="inline-flex items-center gap-2 px-4 py-2 text-sm text-sparkle-text hover:text-[var(--accent-primary)] bg-sparkle-card hover:bg-sparkle-card-hover border border-sparkle-border rounded-lg transition-all shrink-0">
                        <ArrowLeft size={16} />Back to Settings
                    </Link>
                </div>
            )}

            {!forcedTab && (
                <div className="mb-5 inline-flex rounded-xl border border-sparkle-border bg-sparkle-card p-1">
                    <button type="button" onClick={() => { setActiveTab('account'); if (!location.pathname.endsWith('/account')) navigate('/settings/account') }} className={cn('rounded-lg px-3 py-1.5 text-xs transition-colors', activeTab === 'account' ? 'bg-cyan-500/20 text-cyan-200 border border-cyan-500/30' : 'text-sparkle-text-secondary hover:bg-sparkle-bg hover:text-sparkle-text')}>Account</button>
                    <button type="button" onClick={() => { setActiveTab('usage'); if (!location.pathname.endsWith('/usage')) navigate('/settings/usage') }} className={cn('rounded-lg px-3 py-1.5 text-xs transition-colors', activeTab === 'usage' ? 'bg-violet-500/20 text-violet-200 border border-violet-500/30' : 'text-sparkle-text-secondary hover:bg-sparkle-bg hover:text-sparkle-text')}>Usage</button>
                </div>
            )}

            <div className="mb-6 rounded-xl border border-sparkle-border bg-sparkle-card p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <div className={cn('h-2.5 w-2.5 rounded-full', snapshot.connected ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500')} />
                        <span className="text-sm text-sparkle-text">{snapshot.connected ? 'Connected' : 'Disconnected'} - {snapshot.state}</span>
                        <span className="rounded-md border border-sparkle-border px-2 py-1 text-xs text-sparkle-text-secondary">Last update: {formatSince(lastUpdatedAt)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <button type="button" onClick={() => setLiveEnabled((prev) => !prev)} className={cn('rounded-md border px-3 py-1.5 text-xs transition-colors', liveEnabled ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300' : 'border-sparkle-border bg-sparkle-bg text-sparkle-text-secondary hover:text-sparkle-text')}>Live {liveEnabled ? 'On' : 'Off'}</button>
                        <button type="button" onClick={() => void loadSnapshot()} className="inline-flex items-center gap-1 rounded-md border border-sparkle-border bg-sparkle-bg px-3 py-1.5 text-xs text-sparkle-text-secondary hover:text-sparkle-text hover:bg-sparkle-card-hover"><RefreshCw size={13} className={cn(isRefreshing && 'animate-spin')} />Refresh</button>
                    </div>
                </div>
                {errorMessage && <p className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">{errorMessage}</p>}
            </div>

            {isLoading ? (
                <div className="rounded-xl border border-sparkle-border bg-sparkle-card p-8 text-center"><RefreshCw size={20} className="mx-auto text-cyan-300 animate-spin" /><p className="mt-3 text-sm text-sparkle-text-secondary">Loading account and usage...</p></div>
            ) : (
                <div className="space-y-6">
                    {activeTab === 'account' && (
                        <>
                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                                <StatCard title="Auth Mode" value={snapshot.accountMode.toUpperCase()} hint={snapshot.accountEmail || snapshot.accountName || 'No identity in payload'} tone={snapshot.accountMode.toLowerCase() === 'chatgpt' ? 'good' : 'info'} />
                                <StatCard title="5-Hour Usage" value={fiveHourDisplayPercent == null ? '--' : `${Math.round(fiveHourDisplayPercent)}%`} hint={`${snapshot.fiveHourWindow} • ${usageDisplayMode} • ${snapshot.fiveHourReset}`} tone={snapshot.fiveHourUsedPercent != null && snapshot.fiveHourUsedPercent >= 85 ? 'warn' : 'default'} />
                                <StatCard title="Weekly Usage" value={weeklyDisplayPercent == null ? '--' : `${Math.round(weeklyDisplayPercent)}%`} hint={`${snapshot.weeklyWindow} • ${usageDisplayMode} • ${snapshot.weeklyReset}`} tone={snapshot.weeklyUsedPercent != null && snapshot.weeklyUsedPercent >= 85 ? 'warn' : 'default'} />
                                <StatCard title="Rate Buckets" value={snapshot.rateLimitBucketCount} hint={`${snapshot.modelsAvailable} models detected`} />
                            </div>

                            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                                <div className="rounded-xl border border-sparkle-border bg-sparkle-card p-5">
                                    <div className="flex items-center gap-2 mb-4"><Bot size={16} className="text-cyan-300" /><h3 className="text-sm font-semibold text-sparkle-text">Connected Account</h3></div>
                                    <div className="space-y-2 text-sm">
                                        <p className="text-sparkle-text">Mode: <span className="text-sparkle-text-secondary">{snapshot.accountMode || 'unknown'}</span></p>
                                        <p className="text-sparkle-text">Name: <span className="text-sparkle-text-secondary">{snapshot.accountName || 'not provided'}</span></p>
                                        <p className="text-sparkle-text">Email: <span className="text-sparkle-text-secondary">{snapshot.accountEmail || 'not provided'}</span></p>
                                        <p className="text-sparkle-text">Requires auth: <span className="text-sparkle-text-secondary">{snapshot.requiresOpenaiAuth ? 'yes' : 'no'}</span></p>
                                    </div>
                                </div>
                                <div className="rounded-xl border border-sparkle-border bg-sparkle-card p-5">
                                    <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                                        <div className="flex items-center gap-2"><Workflow size={16} className="text-cyan-300" /><h3 className="text-sm font-semibold text-sparkle-text">Account Usage Overview</h3></div>
                                        <UsageModeToggle mode={usageDisplayMode} onChange={setUsageDisplayMode} />
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        <UsageProgress label="5-Hour Window" value={snapshot.fiveHourUsedPercent} mode={usageDisplayMode} windowText={snapshot.fiveHourWindow} resetText={snapshot.fiveHourReset} />
                                        <UsageProgress label="Weekly Window" value={snapshot.weeklyUsedPercent} mode={usageDisplayMode} windowText={snapshot.weeklyWindow} resetText={snapshot.weeklyReset} />
                                    </div>
                                </div>
                            </div>
                        </>
                    )}

                    {activeTab === 'usage' && (
                        <>
                            <div className="rounded-xl border border-sparkle-border bg-sparkle-card p-5">
                                <div className="flex items-center gap-2 mb-4"><Workflow size={16} className="text-cyan-300" /><h3 className="text-sm font-semibold text-sparkle-text">Usage Counters</h3></div>
                                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
                                    <StatCard title="Messages" value={snapshot.historyTotal} hint={`${snapshot.userMessages} user • ${snapshot.assistantMessages} assistant`} />
                                    <StatCard title="Estimated Tokens" value={snapshot.estimatedTokens} hint={`${snapshot.charsTotal.toLocaleString()} chars`} />
                                    <StatCard title="Reasoning Events" value={snapshot.reasoningEvents} hint="Thought stream updates" />
                                    <StatCard title="Action Events" value={snapshot.activityEvents} hint="Tools and commands" />
                                </div>
                            </div>

                            <div className="rounded-xl border border-sparkle-border bg-sparkle-card p-5">
                                <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                                    <div className="flex items-center gap-2"><Sparkles size={16} className="text-violet-300" /><h3 className="text-sm font-semibold text-sparkle-text">Rate Limit Buckets</h3></div>
                                    <UsageModeToggle mode={usageDisplayMode} onChange={setUsageDisplayMode} />
                                </div>
                                <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1">
                                    {snapshot.buckets.length === 0 && <div className="rounded-lg border border-sparkle-border bg-sparkle-bg p-3 text-sm text-sparkle-text-secondary">No account usage buckets returned yet.</div>}
                                    {snapshot.buckets.map((bucket, index) => {
                                        const pct = clampPercent(bucket.usedPercent)
                                        return (
                                            <div key={`${bucket.limitId}-${bucket.segment}-${index}`} className="rounded-lg border border-sparkle-border bg-sparkle-bg p-3">
                                                <div className="flex items-center justify-between gap-2">
                                                    <p className="text-sm text-sparkle-text">{bucket.limitName} <span className="text-xs text-sparkle-text-muted">({bucket.segment})</span></p>
                                                    <p className="text-xs text-sparkle-text-secondary">{formatUsageMetric(pct, usageDisplayMode)}</p>
                                                </div>
                                                <p className="mt-1 text-[11px] text-sparkle-text-muted">{formatWindowDurationMins(bucket.windowDurationMins)} • resets {formatResetAt(bucket.resetsAt)}</p>
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>

                            <div className="rounded-xl border border-sparkle-border bg-sparkle-card p-5">
                                <div className="flex items-center gap-2 mb-4"><Shield size={16} className="text-violet-300" /><h3 className="text-sm font-semibold text-sparkle-text">Telemetry Stream</h3></div>
                                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
                                    <StatCard title="Events Stored" value={snapshot.eventsStored} hint={snapshot.telemetryMonotonic ? 'Event order healthy' : 'Ordering anomaly detected'} tone={snapshot.telemetryMonotonic ? 'good' : 'warn'} />
                                    <StatCard title="Newest Event" value={formatSince(snapshot.newestEventAt)} hint={formatTime(snapshot.newestEventAt)} />
                                    <StatCard title="Oldest Event" value={formatSince(snapshot.oldestEventAt)} hint={formatTime(snapshot.oldestEventAt)} />
                                    <StatCard title="Approval Events" value={snapshot.approvalEvents} hint={snapshot.approvalMode.toUpperCase() === 'YOLO' ? 'YOLO mode active' : 'SAFE mode active'} tone={snapshot.approvalMode.toUpperCase() === 'YOLO' ? 'warn' : 'good'} />
                                </div>
                                <div className="mt-5 rounded-lg border border-sparkle-border bg-sparkle-bg p-3">
                                    <p className="mb-2 text-xs uppercase tracking-wide text-sparkle-text-muted">Event Mix</p>
                                    <div className="h-2 w-full overflow-hidden rounded-full bg-sparkle-card">
                                        <div className="h-full w-full flex">
                                            <div className="h-full bg-cyan-400/70 transition-all duration-500" style={{ width: `${eventMix.activity}%` }} />
                                            <div className="h-full bg-violet-400/70 transition-all duration-500" style={{ width: `${eventMix.reasoning}%` }} />
                                            <div className="h-full bg-amber-400/70 transition-all duration-500" style={{ width: `${eventMix.approvals}%` }} />
                                        </div>
                                    </div>
                                    <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-sparkle-text-secondary">
                                        <span className="inline-flex items-center gap-1 rounded border border-cyan-500/30 px-2 py-1"><Bot size={11} className="text-cyan-300" /> Activity {eventMix.activity}%</span>
                                        <span className="inline-flex items-center gap-1 rounded border border-violet-500/30 px-2 py-1"><MessageSquare size={11} className="text-violet-300" /> Reasoning {eventMix.reasoning}%</span>
                                        <span className="inline-flex items-center gap-1 rounded border border-amber-500/30 px-2 py-1"><Shield size={11} className="text-amber-300" /> Approvals {eventMix.approvals}%</span>
                                    </div>
                                </div>
                            </div>
                        </>
                    )}

                    {snapshot.lastError && (
                        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4">
                            <div className="flex items-center gap-2 mb-1"><Clock3 size={14} className="text-red-300" /><p className="text-sm font-medium text-red-200">Last assistant runtime error</p></div>
                            <p className="text-sm text-red-200/90">{snapshot.lastError}</p>
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}
