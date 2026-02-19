/**
 * DevScope - Machine Scanner
 * Smart tool detection using multiple methods
 * Scans the machine for installed development tools
 */

import { spawn } from 'child_process'
import log from 'electron-log'
import { persistentCache, ToolCacheEntry } from './persistent-cache'
import { getToolsByCategory, ToolDefinition } from '../../shared/tool-registry'
import { unifiedBatchCheck } from './unified-batch-scanner'

interface ScanResult {
    exists: boolean
    path?: string
    version?: string
}

/**
 * Check if a command exists using 'where' (Windows) or 'which' (Unix)
 */
async function checkCommandExists(command: string): Promise<{ exists: boolean; path?: string }> {
    return new Promise((resolve) => {
        const whereCmd = process.platform === 'win32' ? 'where' : 'which'
        const child = spawn(whereCmd, [command], {
            shell: false,
            windowsHide: true
        })

        let stdout = ''
        const timeout = setTimeout(() => {
            child.kill()
            resolve({ exists: false })
        }, 3000)

        child.stdout?.on('data', (data) => {
            stdout += data.toString()
        })

        child.on('close', (code) => {
            clearTimeout(timeout)
            if (code === 0 && stdout.trim()) {
                const paths = stdout.trim().split('\n')
                resolve({ exists: true, path: paths[0].trim() })
            } else {
                resolve({ exists: false })
            }
        })

        child.on('error', () => {
            clearTimeout(timeout)
            resolve({ exists: false })
        })
    })
}

/**
 * Get version for a command
 */
async function getVersion(command: string): Promise<string | undefined> {
    return new Promise((resolve) => {
        const child = spawn(command, ['--version'], {
            shell: true,
            windowsHide: true
        })

        let output = ''
        const timeout = setTimeout(() => {
            child.kill()
            resolve(undefined)
        }, 5000)

        child.stdout?.on('data', (data) => {
            output += data.toString()
        })

        child.stderr?.on('data', (data) => {
            output += data.toString()
        })

        child.on('close', () => {
            clearTimeout(timeout)
            if (output.trim()) {
                const firstLine = output.trim().split('\n')[0]
                // Try common version patterns
                const patterns = [
                    /v?(\d+\.\d+\.\d+[-.\w]*)/,
                    /version\s*[:\s]?\s*v?(\d+\.\d+[-.\w]*)/i,
                    /(\d+\.\d+[-.\w]*)/
                ]

                for (const pattern of patterns) {
                    const match = firstLine.match(pattern)
                    if (match) {
                        resolve(match[1])
                        return
                    }
                }
                resolve(firstLine.substring(0, 30))
            } else {
                resolve(undefined)
            }
        })

        child.on('error', () => {
            clearTimeout(timeout)
            resolve(undefined)
        })
    })
}

/**
 * Scan a single tool
 */
async function scanTool(command: string): Promise<ScanResult> {
    const existence = await checkCommandExists(command)

    if (!existence.exists) {
        return { exists: false }
    }

    const version = await getVersion(command)
    return {
        exists: true,
        path: existence.path,
        version: version || 'Installed'
    }
}

/**
 * Scan tools by category and update cache
 */
export async function scanCategory(
    category: ToolCacheEntry['category'],
    onProgress?: (current: number, total: number, tool: string) => void
): Promise<ToolCacheEntry[]> {
    const tools = getToolsByCategory(category)
    log.info(`[MachineScanner] Scanning ${tools.length} ${category} tools...`)

    const startTime = Date.now()
    const results: ToolCacheEntry[] = []

    // Collect all commands to check
    const commandMap = new Map<string, ToolDefinition>()
    for (const tool of tools) {
        commandMap.set(tool.command, tool)
        if (tool.alternateCommands) {
            for (const alt of tool.alternateCommands) {
                if (!commandMap.has(alt)) {
                    commandMap.set(alt, tool)
                }
            }
        }
    }

    // Check commands in parallel batches
    const commands = Array.from(commandMap.keys())
    const batchSize = 10
    const commandResults = new Map<string, ScanResult>()

    for (let i = 0; i < commands.length; i += batchSize) {
        const batch = commands.slice(i, i + batchSize)
        const batchResults = await Promise.all(
            batch.map(async (cmd) => {
                const result = await scanTool(cmd)
                return { cmd, result }
            })
        )

        for (const { cmd, result } of batchResults) {
            commandResults.set(cmd, result)
        }

        if (onProgress) {
            onProgress(Math.min(i + batchSize, commands.length), commands.length, batch[0])
        }
    }

    // Map results back to tools
    const processedTools = new Set<string>()

    for (const tool of tools) {
        if (processedTools.has(tool.id)) continue

        let foundResult: ScanResult | null = null
        let foundCommand = tool.command

        // Check primary command
        const primaryResult = commandResults.get(tool.command)
        if (primaryResult?.exists) {
            foundResult = primaryResult
        } else if (tool.alternateCommands) {
            // Check alternate commands
            for (const alt of tool.alternateCommands) {
                const altResult = commandResults.get(alt)
                if (altResult?.exists) {
                    foundResult = altResult
                    foundCommand = alt
                    break
                }
            }
        }

        const entry: ToolCacheEntry = {
            id: tool.id,
            category,
            displayName: tool.displayName,
            installed: foundResult?.exists || false,
            version: foundResult?.version,
            path: foundResult?.path,
            command: foundCommand,
            lastChecked: Date.now(),
            metadata: {
                usedFor: tool.usedFor,
                description: tool.description,
                website: tool.website,
                docsUrl: tool.docsUrl
            }
        }

        results.push(entry)
        persistentCache.setTool(entry)
        processedTools.add(tool.id)
    }

    const duration = Date.now() - startTime
    const installedCount = results.filter(r => r.installed).length
    log.info(`[MachineScanner] Found ${installedCount}/${tools.length} ${category} tools in ${duration}ms`)

    return results
}

/**
 * Scan all categories and update cache
 */
export async function scanAll(
    onProgress?: (category: string, current: number, total: number) => void
): Promise<void> {
    log.info('[MachineScanner] Starting full machine scan...')
    const startTime = Date.now()

    const categories: ToolCacheEntry['category'][] = [
        'ai_agent',
        'ai_runtime',
        'language',
        'build_tool',
        'package_manager'
    ]

    // Scan ALL categories in parallel
    await Promise.all(
        categories.map(async (category, i) => {
            if (onProgress) {
                onProgress(category, i, categories.length)
            }
            await scanCategory(category)
        })
    )

    persistentCache.markScanned()
    persistentCache.save()

    const duration = Date.now() - startTime
    log.info(`[MachineScanner] Full scan completed in ${duration}ms`)
}

/**
 * Get cached results, running scan if needed
 */
export async function getCachedOrScan(
    category: ToolCacheEntry['category']
): Promise<ToolCacheEntry[]> {
    const cached = persistentCache.getToolsByCategory(category)

    // Return cached if we have data
    if (cached.length > 0) {
        log.debug(`[MachineScanner] Returning ${cached.length} cached ${category} tools`)
        return cached
    }

    // No cache, scan now
    log.info(`[MachineScanner] No cache for ${category}, scanning...`)
    return scanCategory(category)
}

/**
 * Export for direct use
 */
export const machineScanner = {
    scanTool,
    scanCategory,
    scanAll,
    getCachedOrScan
}
