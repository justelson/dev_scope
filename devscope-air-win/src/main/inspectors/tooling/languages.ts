import log from 'electron-log'
import type { Capability } from '../types'
import { getToolsByCategory, ToolDefinition } from '../../../shared/tool-registry'
import { batchCheckTools, BatchResults } from '../batch-detector'

/**
 * Detect a single language/runtime using batch results
 */
function detectLanguageFromBatch(config: ToolDefinition, batchResults: BatchResults): Capability {
    const commands = [config.command, ...(config.alternateCommands || [])]

    // Find first matching command in batch results
    for (const cmd of commands) {
        const result = batchResults[cmd]
        if (result && result.exists) {
            return {
                tool: config.id, // Use ID as the stable identifier
                displayName: config.displayName,
                category: 'language',
                installed: true,
                version: result.version || 'Unknown',
                status: result.version ? 'healthy' : 'warning',
                usedFor: config.usedFor,
                description: config.description,
                website: config.website,
                docsUrl: config.docsUrl,
                metadata: { command: cmd }
            }
        }
    }

    return {
        tool: config.id,
        displayName: config.displayName,
        category: 'language',
        installed: false,
        status: 'not_installed',
        usedFor: config.usedFor,
        description: config.description,
        website: config.website,
        docsUrl: config.docsUrl
    }
}

/**
 * Detect all languages and runtimes
 */
export async function detectLanguages(): Promise<Capability[]> {
    log.info('Detecting languages and runtimes (optimized)...')
    const languages = getToolsByCategory('language')

    // 1. Collect all commands to check
    const allCommands = new Set<string>()
    languages.forEach(tool => {
        allCommands.add(tool.command)
        if (tool.alternateCommands) {
            tool.alternateCommands.forEach(cmd => allCommands.add(cmd))
        }
    })

    // 2. Run batch check
    const batchResults = await batchCheckTools(Array.from(allCommands))

    // 3. Process results
    const results = languages.map(tool => detectLanguageFromBatch(tool, batchResults))

    log.info(`Detected ${results.filter(r => r.installed).length}/${results.length} languages`)
    return results
}
