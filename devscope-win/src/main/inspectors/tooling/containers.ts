/**
 * DevScope - Container & Virtualization Inspector
 */

import log from 'electron-log'
import { safeExec, commandExists, getCommandVersion } from '../safe-exec'
import type { Capability } from '../types'
import { getToolsByCategory, ToolDefinition } from '../../../shared/tool-registry'

async function detectContainer(config: ToolDefinition): Promise<Capability> {
    const commands = [config.command, ...(config.alternateCommands || [])]

    for (const cmd of commands) {
        const exists = await commandExists(cmd)
        if (exists) {
            const version = await getCommandVersion(cmd, '--version')

            // Check if Docker daemon is running
            let status: 'healthy' | 'warning' = 'healthy'
            if (config.id === 'docker' && config.detectRunning) {
                try {
                    const result = await safeExec('docker', ['info'], { timeout: 5000 })
                    if (result.stderr.includes('error') || result.stderr.includes('Cannot connect')) {
                        status = 'warning'
                    }
                } catch {
                    status = 'warning'
                }
            }

            return {
                tool: config.id,
                displayName: config.displayName,
                category: 'container',
                installed: true,
                version: version || 'Unknown',
                status,
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
        category: 'container',
        installed: false,
        status: 'not_installed',
        usedFor: config.usedFor,
        description: config.description,
        website: config.website,
        docsUrl: config.docsUrl
    }
}

export async function detectContainers(): Promise<Capability[]> {
    log.info('Detecting containers and virtualization...')
    const containers = getToolsByCategory('container')
    const results = await Promise.all(containers.map(detectContainer))
    log.info(`Detected ${results.filter(r => r.installed).length}/${results.length} container tools`)
    return results
}
