/**
 * DevScope - Version Control Inspector
 */

import log from 'electron-log'
import { commandExists, getCommandVersion } from '../safe-exec'
import type { Capability } from '../types'
import { getToolsByCategory, ToolDefinition } from '../../../shared/tool-registry'

async function detectVCS(config: ToolDefinition): Promise<Capability> {
    const commands = [config.command, ...(config.alternateCommands || [])]

    for (const cmd of commands) {
        const exists = await commandExists(cmd)
        if (exists) {
            const version = await getCommandVersion(cmd, '--version')
            return {
                tool: config.id,
                displayName: config.displayName,
                category: 'version_control',
                installed: true,
                version: version || 'Unknown',
                status: version ? 'healthy' : 'warning',
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
        category: 'version_control',
        installed: false,
        status: 'not_installed',
        usedFor: config.usedFor,
        description: config.description,
        website: config.website,
        docsUrl: config.docsUrl
    }
}

export async function detectVersionControl(): Promise<Capability[]> {
    log.info('Detecting version control...')
    const tools = getToolsByCategory('version_control')
    const results = await Promise.all(tools.map(detectVCS))
    log.info(`Detected ${results.filter(r => r.installed).length}/${results.length} VCS tools`)
    return results
}
