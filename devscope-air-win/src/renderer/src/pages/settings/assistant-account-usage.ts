export type RateLimitBucket = {
    limitId: string
    limitName: string
    segment: 'primary' | 'secondary'
    windowDurationMins: number | null
    usedPercent: number | null
    resetsAt: number | null
}

export type UsageDisplayMode = 'used' | 'remaining'

function maybeNumber(value: unknown): number | null {
    if (typeof value === 'number' && Number.isFinite(value)) return value
    if (typeof value === 'string' && value.trim()) {
        const parsed = Number(value)
        if (Number.isFinite(parsed)) return parsed
    }
    return null
}

function asRecord(value: unknown): Record<string, unknown> | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null
    return value as Record<string, unknown>
}

export function normalizeRateLimitBuckets(rateLimitsData: unknown): RateLimitBucket[] {
    const root = asRecord(rateLimitsData)
    if (!root) return []

    const sourceBuckets: Record<string, unknown>[] = []
    const byId = asRecord(root.rateLimitsByLimitId)
    if (byId) {
        for (const value of Object.values(byId)) {
            const bucket = asRecord(value)
            if (bucket) sourceBuckets.push(bucket)
        }
    }
    const mapBuckets = asRecord(root.rateLimits)
    if (mapBuckets) {
        for (const value of Object.values(mapBuckets)) {
            const bucket = asRecord(value)
            if (bucket) sourceBuckets.push(bucket)
        }
    }

    const dedupe = new Set<string>()
    const buckets: RateLimitBucket[] = []

    for (const bucket of sourceBuckets) {
        const limitId = String(bucket.limitId || bucket.limitName || 'unknown')
        const limitName = String(bucket.limitName || bucket.limitId || 'Unknown')
        for (const segment of ['primary', 'secondary'] as const) {
            const info = asRecord(bucket[segment])
            if (!info) continue
            const windowDurationMins = maybeNumber(info.windowDurationMins)
            const usedPercent = maybeNumber(info.usedPercent)
            const resetsAt = maybeNumber(info.resetsAt)
            const key = `${limitId}|${segment}|${windowDurationMins ?? 'na'}|${resetsAt ?? 'na'}`
            if (dedupe.has(key)) continue
            dedupe.add(key)
            buckets.push({
                limitId,
                limitName,
                segment,
                windowDurationMins,
                usedPercent,
                resetsAt
            })
        }
    }

    return buckets.sort((a, b) => {
        const aWindow = a.windowDurationMins ?? Number.POSITIVE_INFINITY
        const bWindow = b.windowDurationMins ?? Number.POSITIVE_INFINITY
        if (aWindow !== bWindow) return aWindow - bWindow
        return `${a.limitName} ${a.segment}`.toLowerCase().localeCompare(`${b.limitName} ${b.segment}`.toLowerCase())
    })
}

export function selectUsageBucket(
    buckets: RateLimitBucket[],
    target: { windowMins?: number; nameHints?: string[] }
): RateLimitBucket | null {
    if (!Array.isArray(buckets) || buckets.length === 0) return null

    if (target.windowMins != null) {
        const exact = buckets.find((bucket) =>
            bucket.windowDurationMins != null
            && Math.abs(bucket.windowDurationMins - target.windowMins!) <= 1
        )
        if (exact) return exact
    }

    const hints = (target.nameHints || []).map((hint) => hint.toLowerCase())
    if (hints.length > 0) {
        const hinted = buckets.find((bucket) => {
            const hay = `${bucket.limitId} ${bucket.limitName}`.toLowerCase()
            return hints.some((hint) => hay.includes(hint))
        })
        if (hinted) return hinted
    }

    return null
}

export function clampPercent(value: number | null): number | null {
    if (value == null || !Number.isFinite(value)) return null
    return Math.max(0, Math.min(100, value))
}

export function getUsageDisplayPercent(
    usedPercent: number | null,
    mode: UsageDisplayMode
): number | null {
    const used = clampPercent(usedPercent)
    if (used == null) return null
    return mode === 'remaining' ? Math.max(0, 100 - used) : used
}

export function formatUsageMetric(
    usedPercent: number | null,
    mode: UsageDisplayMode
): string {
    const shown = getUsageDisplayPercent(usedPercent, mode)
    const modeLabel = mode === 'remaining' ? 'remaining' : 'used'
    if (shown == null) return `-- ${modeLabel}`
    return `${Math.round(shown)}% ${modeLabel}`
}

export function formatWindowDurationMins(minutes: number | null): string {
    if (minutes == null || !Number.isFinite(minutes) || minutes <= 0) return 'Unknown window'
    if (minutes % 10080 === 0) {
        const weeks = minutes / 10080
        return weeks === 1 ? '1 week' : `${weeks} weeks`
    }
    if (minutes % 1440 === 0) return `${minutes / 1440}d window`
    if (minutes % 60 === 0) return `${minutes / 60}h window`
    return `${minutes}m window`
}

export function formatResetAt(timestampSeconds: number | null): string {
    if (timestampSeconds == null || !Number.isFinite(timestampSeconds) || timestampSeconds <= 0) return 'reset unknown'
    const date = new Date(timestampSeconds * 1000)
    if (Number.isNaN(date.getTime())) return 'reset unknown'
    return date.toLocaleString([], {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    })
}
