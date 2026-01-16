/**
 * DevScope - Persistent Tool Cache
 * Disk-based JSON cache for tool detection results
 * Survives app restarts and provides instant UI loading
 */

import { app } from 'electron'
import { join } from 'path'
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs'
import log from 'electron-log'

import { DetectedTool, ToolCategory } from './types'

export interface ToolCacheEntry extends DetectedTool {
    // We can add cache-specific fields here if needed in the future
    command?: string // Specific command found (if alternateCommands were used)
}

export interface PersistentCacheData {
    version: number
    lastFullScan: number
    tools: Record<string, ToolCacheEntry>
}

const CACHE_VERSION = 1
const CACHE_FILE_NAME = 'tool-cache.json'
const CACHE_STALE_TIME = 24 * 60 * 60 * 1000 // 24 hours

class PersistentToolCache {
    private cache: PersistentCacheData
    private cacheFilePath: string
    private dirty = false

    constructor() {
        // Store in app data folder
        const appDataPath = app.getPath('userData')
        const cacheDir = join(appDataPath, 'cache')

        // Ensure cache directory exists
        if (!existsSync(cacheDir)) {
            mkdirSync(cacheDir, { recursive: true })
        }

        this.cacheFilePath = join(cacheDir, CACHE_FILE_NAME)
        this.cache = this.load()

        log.info(`[PersistentCache] Loaded from: ${this.cacheFilePath}`)
        log.info(`[PersistentCache] ${Object.keys(this.cache.tools).length} tools in cache`)
    }

    /**
     * Load cache from disk
     */
    private load(): PersistentCacheData {
        try {
            if (existsSync(this.cacheFilePath)) {
                const data = readFileSync(this.cacheFilePath, 'utf-8')
                const parsed = JSON.parse(data) as PersistentCacheData

                // Check version compatibility
                if (parsed.version === CACHE_VERSION) {
                    return parsed
                }

                log.info('[PersistentCache] Cache version mismatch, creating fresh cache')
            }
        } catch (err) {
            log.warn('[PersistentCache] Failed to load cache:', err)
        }

        // Return empty cache
        return {
            version: CACHE_VERSION,
            lastFullScan: 0,
            tools: {}
        }
    }

    /**
     * Save cache to disk
     */
    save(): void {
        try {
            writeFileSync(this.cacheFilePath, JSON.stringify(this.cache, null, 2), 'utf-8')
            this.dirty = false
            log.debug('[PersistentCache] Cache saved')
        } catch (err) {
            log.error('[PersistentCache] Failed to save cache:', err)
        }
    }

    /**
     * Get a tool from cache
     */
    getTool(id: string): ToolCacheEntry | undefined {
        return this.cache.tools[id]
    }

    /**
     * Get all tools by category
     */
    getToolsByCategory(category: ToolCacheEntry['category']): ToolCacheEntry[] {
        return Object.values(this.cache.tools).filter(t => t.category === category)
    }

    /**
     * Get all installed tools by category
     */
    getInstalledByCategory(category: ToolCacheEntry['category']): ToolCacheEntry[] {
        return Object.values(this.cache.tools).filter(t => t.category === category && t.installed)
    }

    /**
     * Set a tool in cache
     */
    setTool(entry: ToolCacheEntry): void {
        this.cache.tools[entry.id] = {
            ...entry,
            lastChecked: Date.now()
        }
        this.dirty = true
    }

    /**
     * Set multiple tools at once
     */
    setTools(entries: ToolCacheEntry[]): void {
        const now = Date.now()
        for (const entry of entries) {
            this.cache.tools[entry.id] = {
                ...entry,
                lastChecked: now
            }
        }
        this.dirty = true
    }

    /**
     * Check if cache is stale and needs refresh
     */
    isStale(): boolean {
        const age = Date.now() - this.cache.lastFullScan
        return age > CACHE_STALE_TIME
    }

    /**
     * Mark cache as recently scanned
     */
    markScanned(): void {
        this.cache.lastFullScan = Date.now()
        this.dirty = true
    }

    /**
     * Get cache age in human-readable format
     */
    getAge(): string {
        if (this.cache.lastFullScan === 0) return 'Never scanned'

        const age = Date.now() - this.cache.lastFullScan
        const minutes = Math.floor(age / 60000)
        const hours = Math.floor(age / 3600000)
        const days = Math.floor(age / 86400000)

        if (days > 0) return `${days}d ago`
        if (hours > 0) return `${hours}h ago`
        if (minutes > 0) return `${minutes}m ago`
        return 'Just now'
    }

    /**
     * Check if we have any cached data
     */
    hasData(): boolean {
        return Object.keys(this.cache.tools).length > 0
    }

    /**
     * Clear all cache
     */
    clear(): void {
        this.cache = {
            version: CACHE_VERSION,
            lastFullScan: 0,
            tools: {}
        }
        this.save()
    }

    /**
     * Save if dirty (call periodically or on app close)
     */
    flush(): void {
        if (this.dirty) {
            this.save()
        }
    }
}

// Singleton instance
export const persistentCache = new PersistentToolCache()
