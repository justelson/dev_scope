/**
 * DevScope - Unified Cross-Platform Batch Scanner
 * 
 * Replaces the Windows-only PowerShell batch-detector with a cross-platform
 * approach that uses a single shell invocation to check tool existence and
 * versions. Works on Windows (cmd), macOS (sh/zsh), and Linux (sh/bash).
 * 
 * Performance: ~200ms for 30+ tools vs ~3-5s with individual spawns.
 */

import { spawn } from 'child_process'
import log from 'electron-log'
import { cacheManager } from './cache-manager'

// ============================================================================
// Types
// ============================================================================

export interface BatchToolResult {
    exists: boolean
    path?: string
    version?: string
    error?: string
}

export interface BatchResults {
    [tool: string]: BatchToolResult
}

// ============================================================================
// Constants
// ============================================================================

const BATCH_CACHE_KEY = 'unified-batch-detection'
const BATCH_CACHE_TTL = 5 * 60 * 1000 // 5 minutes
const isWindows = process.platform === 'win32'

// Delimiter used to separate tool results in shell output
const TOOL_DELIMITER = '___DEVSCOPE_TOOL___'

// ============================================================================
// Core: Cross-Platform Shell Execution
// ============================================================================

/**
 * Execute a shell command and return stdout/stderr.
 * Uses cmd on Windows, sh on Unix.
 */
function shellExec(command: string, timeout = 10000): Promise<{ stdout: string; stderr: string }> {
    return new Promise((resolve) => {
        const shell = isWindows ? 'cmd' : 'sh'
        const args = isWindows ? ['/c', command] : ['-c', command]

        const child = spawn(shell, args, {
            windowsHide: true,
            timeout,
            env: { ...process.env }
        })

        let stdout = ''
        let stderr = ''

        child.stdout?.on('data', (data) => {
            stdout += data.toString()
        })

        child.stderr?.on('data', (data) => {
            stderr += data.toString()
        })

        const timer = setTimeout(() => {
            child.kill()
            resolve({ stdout, stderr: stderr || 'Timeout' })
        }, timeout)

        child.on('close', () => {
            clearTimeout(timer)
            resolve({ stdout, stderr })
        })

        child.on('error', (err) => {
            clearTimeout(timer)
            resolve({ stdout: '', stderr: err.message })
        })
    })
}

// ============================================================================
// Phase 1: Batch Existence Check (single shell call)
// ============================================================================

/**
 * Build a shell command that checks existence of ALL tools at once.
 * Each tool result is separated by a delimiter for easy parsing.
 * 
 * Windows: `(where node 2>nul || echo NOT_FOUND) & echo ___DELIM___ & ...`
 * Unix:    `(which node 2>/dev/null || echo NOT_FOUND); echo ___DELIM___; ...`
 */
function buildExistenceCommand(tools: string[]): string {
    const whereCmd = isWindows ? 'where' : 'which'
    const nullRedirect = isWindows ? '2>nul' : '2>/dev/null'
    const separator = isWindows ? ' & ' : '; '
    const delimiter = `echo ${TOOL_DELIMITER}`

    const parts = tools.map(tool => {
        return `(${whereCmd} ${tool} ${nullRedirect} || echo NOT_FOUND)${separator}${delimiter}`
    })

    return parts.join(separator)
}

/**
 * Parse the output of the batch existence command.
 * Returns a map of tool -> { exists, path }.
 */
function parseExistenceOutput(output: string, tools: string[]): Map<string, { exists: boolean; path?: string }> {
    const results = new Map<string, { exists: boolean; path?: string }>()
    const sections = output.split(TOOL_DELIMITER)

    for (let i = 0; i < tools.length; i++) {
        const section = sections[i]?.trim() || ''

        if (!section || section.includes('NOT_FOUND') || section === '') {
            results.set(tools[i], { exists: false })
        } else {
            // The first non-empty line is the path
            const lines = section.split('\n').map(l => l.trim()).filter(l => l && l !== '')
            const firstPath = lines[0] || undefined
            results.set(tools[i], { exists: true, path: firstPath })
        }
    }

    return results
}

// ============================================================================
// Phase 2: Batch Version Check (single shell call, only for existing tools)
// ============================================================================

/**
 * Build a shell command that fetches versions for all existing tools.
 * Uses `tool --version` with output separation by delimiter.
 */
function buildVersionCommand(tools: string[], versionArgs?: Map<string, string>): string {
    const separator = isWindows ? ' & ' : '; '
    const delimiter = `echo ${TOOL_DELIMITER}`

    const parts = tools.map(tool => {
        const vArg = versionArgs?.get(tool) || '--version'
        // Capture both stdout and stderr (some tools output version to stderr)
        return `(${tool} ${vArg} 2>&1 || echo VERSION_FAILED)${separator}${delimiter}`
    })

    return parts.join(separator)
}

/**
 * Parse version output from batch command.
 * Extracts semver-like patterns from each tool's output.
 */
function parseVersionOutput(output: string, tools: string[]): Map<string, string | undefined> {
    const results = new Map<string, string | undefined>()
    const sections = output.split(TOOL_DELIMITER)

    const versionPatterns = [
        /v?(\d+\.\d+\.\d+[-.\w]*)/i,
        /version\s*[:\s]?\s*v?(\d+\.\d+\.?\d*[-.\w]*)/i,
        /(\d+\.\d+\.?\d*[-.\w]*)/,
    ]

    for (let i = 0; i < tools.length; i++) {
        const section = sections[i]?.trim() || ''

        if (!section || section.includes('VERSION_FAILED')) {
            results.set(tools[i], undefined)
            continue
        }

        const firstLine = section.split('\n')[0]?.trim() || ''
        let version: string | undefined

        for (const pattern of versionPatterns) {
            const match = firstLine.match(pattern)
            if (match?.[1]) {
                version = match[1]
                break
            }
        }

        // Fallback: use first 30 chars of first line
        if (!version && firstLine) {
            version = firstLine.substring(0, 30)
        }

        results.set(tools[i], version)
    }

    return results
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Check multiple tools at once using cross-platform batch scanning.
 * 
 * This is the main entry point — replaces both the old PowerShell
 * batch-detector and the native-detector with a single, fast implementation.
 * 
 * @param tools - Array of command names to check (e.g. ['node', 'git', 'docker'])
 * @param versionArgs - Optional map of tool -> version argument (default: '--version')
 * @returns Map of tool -> { exists, path, version }
 */
export async function unifiedBatchCheck(
    tools: string[],
    versionArgs?: Map<string, string>
): Promise<BatchResults> {
    // Check cache first
    const cached = cacheManager.get<BatchResults>(BATCH_CACHE_KEY)
    if (cached) {
        log.debug(`[UnifiedBatch] Cache hit for ${tools.length} tools`)
        return cached
    }

    log.info(`[UnifiedBatch] Scanning ${tools.length} tools (${isWindows ? 'Windows' : process.platform})...`)
    const startTime = Date.now()

    const results: BatchResults = {}

    try {
        // ── Phase 1: Check existence of all tools in one shell call ──
        // Split into batches of 20 to avoid command line length limits
        const existenceMap = new Map<string, { exists: boolean; path?: string }>()
        const existBatchSize = 20

        for (let i = 0; i < tools.length; i += existBatchSize) {
            const batch = tools.slice(i, i + existBatchSize)
            const existenceCmd = buildExistenceCommand(batch)
            const existenceOutput = await shellExec(existenceCmd, 8000)
            const batchMap = parseExistenceOutput(existenceOutput.stdout, batch)
            for (const [k, v] of batchMap) {
                existenceMap.set(k, v)
            }
        }

        // Collect tools that exist for version checking
        const existingTools: string[] = []
        for (const [tool, result] of existenceMap) {
            if (result.exists) {
                existingTools.push(tool)
            } else {
                results[tool] = { exists: false }
            }
        }

        const existenceDuration = Date.now() - startTime
        log.info(`[UnifiedBatch] Existence check: ${existingTools.length}/${tools.length} found in ${existenceDuration}ms`)

        // ── Phase 2: Get versions for existing tools in batched shell calls ──
        if (existingTools.length > 0) {
            const versionBatchSize = 10
            for (let i = 0; i < existingTools.length; i += versionBatchSize) {
                const batch = existingTools.slice(i, i + versionBatchSize)
                const versionCmd = buildVersionCommand(batch, versionArgs)
                const versionOutput = await shellExec(versionCmd, 10000)
                const versionMap = parseVersionOutput(versionOutput.stdout, batch)

                for (const tool of batch) {
                    const existence = existenceMap.get(tool)!
                    const version = versionMap.get(tool)
                    results[tool] = {
                        exists: true,
                        path: existence.path,
                        version: version || 'Installed'
                    }
                }
            }
        }
    } catch (error) {
        log.error('[UnifiedBatch] Scan failed:', error)
        // Fallback: mark unchecked tools
        for (const tool of tools) {
            if (!results[tool]) {
                results[tool] = { exists: false, error: 'Scan failed' }
            }
        }
    }

    const totalDuration = Date.now() - startTime
    const installedCount = Object.values(results).filter(r => r.exists).length
    log.info(`[UnifiedBatch] Complete: ${installedCount}/${tools.length} tools in ${totalDuration}ms`)

    // Cache the results
    cacheManager.set(BATCH_CACHE_KEY, results, BATCH_CACHE_TTL)

    return results
}

/**
 * Invalidate the unified batch cache (call on manual refresh)
 */
export function invalidateUnifiedBatchCache(): void {
    cacheManager.invalidate(BATCH_CACHE_KEY)
    log.info('[UnifiedBatch] Cache invalidated')
}

/**
 * Convenience: check if a tool exists from batch results
 */
export function toolExists(results: BatchResults, tool: string): boolean {
    return results[tool]?.exists || false
}

/**
 * Convenience: get version from batch results
 */
export function getVersion(results: BatchResults, tool: string): string | null {
    const result = results[tool]
    return result?.exists && result.version ? result.version : null
}
