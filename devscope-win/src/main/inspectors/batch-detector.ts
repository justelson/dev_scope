/**
 * DevScope - Batch Tool Detector
 * Checks multiple tools in a single PowerShell execution for 10-15x performance improvement
 */

import { join, dirname } from 'path'
import { safeExec } from './safe-exec'
import log from 'electron-log'
import { cacheManager } from './cache-manager'
import { app } from 'electron'
import { existsSync } from 'fs'

export interface BatchToolResult {
  exists: boolean
  path?: string
  version?: string
  error?: string
}

export interface BatchResults {
  [tool: string]: BatchToolResult
}

const BATCH_CACHE_KEY = 'batch-tool-detection'
const BATCH_CACHE_TTL = 5 * 60 * 1000 // 5 minutes

/**
 * Get the path to the batch-check-tools.ps1 script
 * Works in both development and production modes
 */
function getScriptPath(): string {
  // Try multiple possible locations
  const possiblePaths = [
    // Production: in the same directory as the bundled code
    join(__dirname, 'batch-check-tools.ps1'),
    // Production: in inspectors subdirectory
    join(__dirname, 'inspectors', 'batch-check-tools.ps1'),
    // Development: in the source directory
    join(app.getAppPath(), 'src', 'main', 'inspectors', 'batch-check-tools.ps1'),
    // Development: relative to out/main
    join(dirname(__dirname), '..', 'src', 'main', 'inspectors', 'batch-check-tools.ps1')
  ]

  for (const p of possiblePaths) {
    if (existsSync(p)) {
      log.debug(`Found batch script at: ${p}`)
      return p
    }
  }

  // Default fallback
  log.warn('Could not find batch-check-tools.ps1, using default path')
  return possiblePaths[2] // Development path as fallback
}

/**
 * Check multiple tools at once using PowerShell batch script
 * This is 10-15x faster than checking each tool individually
 */
export async function batchCheckTools(tools: string[]): Promise<BatchResults> {
  // Check cache first
  const cached = cacheManager.get<BatchResults>(BATCH_CACHE_KEY)
  if (cached) {
    log.debug(`Batch tool check: using cached results for ${tools.length} tools`)
    return cached
  }

  try {
    const scriptPath = getScriptPath()
    const toolsArg = tools.join(',')

    log.info(`Batch checking ${tools.length} tools...`)
    const startTime = Date.now()

    const result = await safeExec('powershell', [
      '-NoLogo',
      '-NoProfile',
      '-NonInteractive',
      '-ExecutionPolicy', 'Bypass',
      '-File', scriptPath,
      '-Tools', toolsArg
    ], { timeout: 10000 })

    const elapsed = Date.now() - startTime
    log.info(`Batch tool check completed in ${elapsed}ms`)

    if (result.stdout) {
      // Robust JSON parsing using delimiters
      const stdout = result.stdout
      const startMarker = '__JSON_START__'
      const endMarker = '__JSON_END__'

      const startIndex = stdout.indexOf(startMarker)
      const endIndex = stdout.indexOf(endMarker)

      if (startIndex === -1 || endIndex === -1) {
        log.warn('Batch tool check failed: No JSON delimiters found', stdout.substring(0, 200))
        throw new Error('No valid JSON delimiters found in output')
      }

      // Extract content between markers
      const jsonStr = stdout.substring(startIndex + startMarker.length, endIndex).trim()

      if (!jsonStr) {
        throw new Error('Empty JSON content between delimiters')
      }

      const results: BatchResults = JSON.parse(jsonStr)

      // Cache the results
      cacheManager.set(BATCH_CACHE_KEY, results, BATCH_CACHE_TTL)

      const installedCount = Object.values(results).filter(r => r.exists).length
      log.info(`Found ${installedCount}/${tools.length} tools installed`)

      return results
    }
  } catch (error) {
    // If syntax error in parsing, log the raw output for debugging
    if (error instanceof SyntaxError) {
      log.error('Batch tool check JSON parse error. Output might contain noise.')
    }
    log.error('Batch tool check failed:', error)
  }

  // Fallback: return empty results
  const fallback: BatchResults = {}
  tools.forEach(tool => {
    fallback[tool] = { exists: false }
  })
  return fallback
}

/**
 * Check if a specific tool exists (from batch results)
 */
export function toolExistsInBatch(results: BatchResults, tool: string): boolean {
  return results[tool]?.exists || false
}

/**
 * Get version from batch results
 */
export function getVersionFromBatch(results: BatchResults, tool: string): string | null {
  const result = results[tool]
  if (result?.exists && result.version) {
    return result.version
  }
  return null
}

/**
 * Invalidate batch cache (call on manual refresh)
 */
export function invalidateBatchCache(): void {
  cacheManager.invalidate(BATCH_CACHE_KEY)
  log.info('Batch tool cache invalidated')
}
