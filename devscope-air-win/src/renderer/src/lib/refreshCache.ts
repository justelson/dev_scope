type CacheKey = 'system' | 'tooling' | 'aiRuntime' | 'aiAgents' | 'readiness' | 'detailedSystem' | 'timestamp'

interface CacheEntry<T> {
    data: T
    timestamp: number
}

type CacheStore = Partial<Record<CacheKey, CacheEntry<unknown>>>

const cache: CacheStore = {}

// Cache TTL in milliseconds (how long before data is considered stale)
const CACHE_TTL: Record<string, number> = {
    system: 60000,        // 1 minute
    tooling: 120000,      // 2 minutes (tool detection is slow)
    aiRuntime: 60000,     // 1 minute
    aiAgents: 120000,     // 2 minutes (agent detection is slow)
    readiness: 60000,     // 1 minute
    detailedSystem: 10000, // 10 seconds (for live monitoring)
    timestamp: 60000
}

export const updateCache = (data: Partial<Record<CacheKey, unknown>>): void => {
    const now = Date.now()
    Object.entries(data).forEach(([key, value]) => {
        if (value !== undefined) {
            cache[key as CacheKey] = { data: value, timestamp: now }
        }
    })
}

export const getCache = <T>(key: CacheKey): T | null => {
    const entry = cache[key]
    if (!entry) return null
    return entry.data as T
}

/**
 * Get cache only if it's fresh (within TTL)
 */
export const getFreshCache = <T>(key: CacheKey): T | null => {
    const entry = cache[key]
    if (!entry) return null
    
    const ttl = CACHE_TTL[key] || 60000
    const age = Date.now() - entry.timestamp
    
    if (age > ttl) return null
    return entry.data as T
}

/**
 * Check if cache entry is stale
 */
export const isCacheStale = (key: CacheKey): boolean => {
    const entry = cache[key]
    if (!entry) return true
    
    const ttl = CACHE_TTL[key] || 60000
    return Date.now() - entry.timestamp > ttl
}

export const clearCache = (): void => {
    Object.keys(cache).forEach(key => delete cache[key as CacheKey])
}

/**
 * Prefetch essential data on app start (lightweight version)
 * Only fetches system overview and readiness - tooling loads on demand
 */
export const prefetchEssentialData = async (): Promise<void> => {
    try {
        // Fetch lightweight data first for fast initial render
        const [system, readiness] = await Promise.all([
            window.devscope.getSystemOverview(),
            window.devscope.getReadinessReport()
        ])

        updateCache({ system, readiness })

        // Dispatch event for fast initial render
        window.dispatchEvent(new CustomEvent('devscope:prefetch-complete', {
            detail: { system, readiness }
        }))

        // Then fetch heavier data in background (non-blocking)
        Promise.all([
            window.devscope.getDeveloperTooling(),
            window.devscope.getAIRuntimeStatus()
        ]).then(([tooling, aiRuntime]) => {
            updateCache({ tooling, aiRuntime })
            window.dispatchEvent(new CustomEvent('devscope:background-load', {
                detail: { tooling, aiRuntime }
            }))
        }).catch(err => console.error('Background load failed:', err))

    } catch (err) {
        console.error('Prefetch failed:', err)
    }
}

/**
 * Check if essential cache has data
 */
export const isCacheReady = (): boolean => {
    return !!(cache.system && cache.readiness)
}

/**
 * Get cache age in milliseconds
 */
export const getCacheAge = (key: CacheKey): number => {
    const entry = cache[key]
    return entry ? Date.now() - entry.timestamp : Infinity
}

