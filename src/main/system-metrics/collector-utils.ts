import { DEFAULT_INTERVAL_MS, MAX_INTERVAL_MS, MIN_INTERVAL_MS } from './collector-constants'

export function normalizeInterval(value?: number): number {
    const parsed = Number(value)
    if (!Number.isFinite(parsed)) return DEFAULT_INTERVAL_MS
    return Math.min(MAX_INTERVAL_MS, Math.max(MIN_INTERVAL_MS, Math.floor(parsed)))
}

export function toNumber(value: unknown, fallback = 0): number {
    return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

export function toNullableNumber(value: unknown): number | null {
    return typeof value === 'number' && Number.isFinite(value) ? value : null
}

export function toNullableBoolean(value: unknown): boolean | null {
    return typeof value === 'boolean' ? value : null
}

export async function withTimeout<T>(task: Promise<T>, timeoutMs: number, fallback: T): Promise<T> {
    let timeout: NodeJS.Timeout | null = null

    try {
        return await Promise.race<T>([
            task,
            new Promise<T>((resolve) => {
                timeout = setTimeout(() => resolve(fallback), timeoutMs)
            })
        ])
    } catch {
        return fallback
    } finally {
        if (timeout) clearTimeout(timeout)
    }
}
