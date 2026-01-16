import log from 'electron-log'
import type { Capability } from '../types'
import { getToolsByCategory, ToolDefinition } from '../../../shared/tool-registry'
import { batchCheckTools, BatchResults } from '../batch-detector'

/**
 * Detect a single build tool using batch results
 */
function detectBuildToolFromBatch(config: ToolDefinition, batchResults: BatchResults): Capability {
    const commands = [config.command, ...(config.alternateCommands || [])]

    // Find first matching command in batch results
    for (const cmd of commands) {
        const result = batchResults[cmd]
        if (result && result.exists) {
            return {
                tool: config.id,
                displayName: config.displayName,
                category: 'build_tool',
                installed: true,
                version: result.version || 'Unknown',
                status: result.version ? 'healthy' : 'warning',
                usedFor: config.usedFor,
                description: config.description,
                website: config.website,
                docsUrl: config.docsUrl
            }
        }
    }

    return {
        tool: config.id,
        displayName: config.displayName,
        category: 'build_tool',
        installed: false,
        status: 'not_installed',
        usedFor: config.usedFor,
        description: config.description,
        website: config.website,
        docsUrl: config.docsUrl
    }
}

export async function detectBuildTools(): Promise<Capability[]> {
    log.info('Detecting build tools (optimized)...')
    const tools = getToolsByCategory('build_tool')

    // 1. Collect all commands to check
    const allCommands = new Set<string>()
    tools.forEach(tool => {
        allCommands.add(tool.command)
        if (tool.alternateCommands) {
            tool.alternateCommands.forEach(cmd => allCommands.add(cmd))
        }
    })

    // 2. Run batch check
    const batchResults = await batchCheckTools(Array.from(allCommands))

    // 3. Process results
    const results = tools.map(tool => detectBuildToolFromBatch(tool, batchResults))

    log.info(`Detected ${results.filter(r => r.installed).length}/${results.length} build tools`)
    return results
}
