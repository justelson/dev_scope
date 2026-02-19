import log from 'electron-log'
import type { Capability } from '../types'
import { getToolsByCategory, ToolDefinition } from '../../../shared/tool-registry'
import { batchCheckTools, BatchResults } from '../batch-detector'

function detectPackageManagerFromBatch(config: ToolDefinition, batchResults: BatchResults): Capability {
    const commands = [config.command, ...(config.alternateCommands || [])]

    for (const cmd of commands) {
        const result = batchResults[cmd]
        if (result && result.exists) {
            return {
                tool: config.id,
                displayName: config.displayName,
                category: 'package_manager',
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
        category: 'package_manager',
        installed: false,
        status: 'not_installed',
        usedFor: config.usedFor,
        description: config.description,
        website: config.website,
        docsUrl: config.docsUrl
    }
}

export async function detectPackageManagers(): Promise<Capability[]> {
    log.info('Detecting package managers (optimized)...')
    const managers = getToolsByCategory('package_manager')

    // 1. Collect all commands
    const allCommands = new Set<string>()
    managers.forEach(tool => {
        allCommands.add(tool.command)
        if (tool.alternateCommands) {
            tool.alternateCommands.forEach(cmd => allCommands.add(cmd))
        }
    })

    // 2. Run batch check
    const batchResults = await batchCheckTools(Array.from(allCommands))

    // 3. Process results
    const results = managers.map(tool => detectPackageManagerFromBatch(tool, batchResults))

    log.info(`Detected ${results.filter(r => r.installed).length}/${results.length} package managers`)
    return results
}
