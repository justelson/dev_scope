/**
 * DevScope - Native Tool Detector
 * Uses Node.js child_process to detect CLI tools without PowerShell batch script
 * This is more reliable on Windows than the PowerShell approach
 */

import { spawn } from 'child_process'
import log from 'electron-log'
import { cacheManager } from './cache-manager'

export interface NativeToolResult {
    exists: boolean
    path?: string
    version?: string
    error?: string
}

export interface NativeToolResults {
    [tool: string]: NativeToolResult
}

const NATIVE_CACHE_KEY = 'native-tool-detection'
const NATIVE_CACHE_TTL = 5 * 60 * 1000 // 5 minutes

/**
 * Check if a single command exists using 'where' on Windows
 */
async function checkCommandExists(command: string): Promise<{ exists: boolean; path?: string }> {
    return new Promise((resolve) => {
        const whereCmd = process.platform === 'win32' ? 'where' : 'which'
        const child = spawn(whereCmd, [command], {
            shell: false,
            windowsHide: true,
            timeout: 3000
        })

        let stdout = ''
        let stderr = ''

        child.stdout?.on('data', (data) => {
            stdout += data.toString()
        })

        child.stderr?.on('data', (data) => {
            stderr += data.toString()
        })

        child.on('close', (code) => {
            if (code === 0 && stdout.trim()) {
                // Return the first path found
                const paths = stdout.trim().split('\n')
                resolve({ exists: true, path: paths[0].trim() })
            } else {
                resolve({ exists: false })
            }
        })

        child.on('error', () => {
            resolve({ exists: false })
        })

        // Timeout fallback
        setTimeout(() => {
            child.kill()
            resolve({ exists: false })
        }, 3000)
    })
}

/**
 * Try to get version for a command
 */
async function getCommandVersion(command: string): Promise<string | undefined> {
    return new Promise((resolve) => {
        const child = spawn(command, ['--version'], {
            shell: true,
            windowsHide: true,
            timeout: 5000
        })

        let stdout = ''

        child.stdout?.on('data', (data) => {
            stdout += data.toString()
        })

        child.stderr?.on('data', (data) => {
            stdout += data.toString() // Some tools output version to stderr
        })

        child.on('close', () => {
            if (stdout.trim()) {
                // Extract version number
                const firstLine = stdout.trim().split('\n')[0]
                // Try common version patterns
                const patterns = [
                    /v?(\d+\.\d+\.\d+[-.\w]*)/,
                    /version\s*[:\s]?\s*v?(\d+\.\d+\.\d*[-.\w]*)/i,
                    /(\d+\.\d+\.\d*[-.\w]*)/
                ]

                for (const pattern of patterns) {
                    const match = firstLine.match(pattern)
                    if (match) {
                        resolve(match[1])
                        return
                    }
                }
                // Return first line truncated if no pattern matches
                resolve(firstLine.substring(0, 30))
            } else {
                resolve(undefined)
            }
        })

        child.on('error', () => {
            resolve(undefined)
        })

        // Timeout
        setTimeout(() => {
            child.kill()
            resolve(undefined)
        }, 5000)
    })
}

/**
 * Check multiple tools natively (without PowerShell)
 */
export async function nativeCheckTools(tools: string[]): Promise<NativeToolResults> {
    // Check cache first
    const cached = cacheManager.get<NativeToolResults>(NATIVE_CACHE_KEY)
    if (cached) {
        log.debug(`Native tool check: using cached results for ${tools.length} tools`)
        return cached
    }

    log.info(`Native checking ${tools.length} tools...`)
    const startTime = Date.now()

    const results: NativeToolResults = {}

    // Check existence in parallel (fast)
    const existenceChecks = await Promise.all(
        tools.map(async (tool) => {
            const result = await checkCommandExists(tool)
            return { tool, ...result }
        })
    )

    // For tools that exist, get versions in parallel
    const existingTools = existenceChecks.filter(r => r.exists)
    const versionChecks = await Promise.all(
        existingTools.map(async (item) => {
            const version = await getCommandVersion(item.tool)
            return { tool: item.tool, path: item.path, version }
        })
    )

    // Build results map
    for (const check of existenceChecks) {
        if (check.exists) {
            const versionInfo = versionChecks.find(v => v.tool === check.tool)
            results[check.tool] = {
                exists: true,
                path: check.path,
                version: versionInfo?.version || 'Installed'
            }
        } else {
            results[check.tool] = { exists: false }
        }
    }

    const duration = Date.now() - startTime
    log.info(`Native tool check completed in ${duration}ms`)
    log.info(`Found ${existingTools.length}/${tools.length} tools`)

    // Cache results
    cacheManager.set(NATIVE_CACHE_KEY, results, NATIVE_CACHE_TTL)

    return results
}
