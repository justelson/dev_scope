import log from 'electron-log'
import { persistentCache } from './persistent-cache'
import { TOOL_REGISTRY, ToolDefinition, DetectionConfig, ToolCategory } from '../../shared/tool-registry'
import { DetectedTool } from './types'
import { commandExists, getCommandVersion, safeExec } from './safe-exec'

class SensingEngine {
    private progressCallback?: (category: string, current: number, total: number, tool: string) => void

    private createInitialState(tool: ToolDefinition): DetectedTool {
        return {
            id: tool.id,
            displayName: tool.displayName,
            category: tool.category as any,
            installed: false,
            status: 'not_installed',
            usedFor: tool.usedFor,
            description: tool.description,
            website: tool.website,
            docsUrl: tool.docsUrl,
            lastChecked: Date.now(),
            metadata: {}
        }
    }

    private async detectViaCli(tool: ToolDefinition, config: DetectionConfig): Promise<Partial<DetectedTool>> {
        const cmd = config.command || tool.command
        const exists = await commandExists(cmd)

        if (!exists) {
            if (tool.alternateCommands) {
                for (const alt of tool.alternateCommands) {
                    if (await commandExists(alt)) {
                        const versionResult = await getCommandVersion(alt, config.versionArgs?.[0] || tool.versionArg)
                        return {
                            installed: true,
                            status: 'healthy',
                            version: versionResult || undefined,
                            metadata: { command: alt }
                        }
                    }
                }
            }

            return { installed: false, status: 'not_installed' }
        }

        const versionResult = await getCommandVersion(cmd, config.versionArgs?.[0] || tool.versionArg)
        return {
            installed: true,
            status: 'healthy',
            version: versionResult || undefined,
            metadata: { command: cmd }
        }
    }

    private async detectViaProcess(tool: ToolDefinition, config: DetectionConfig): Promise<Partial<DetectedTool>> {
        const processName = config.processName || tool.id

        try {
            let isRunning = false
            if (process.platform === 'win32') {
                const cmd = `tasklist /NH /FI "IMAGENAME eq ${processName}.exe"`
                const result = await safeExec('cmd', ['/c', cmd])
                isRunning = result.stdout.toLowerCase().includes(processName.toLowerCase())
            } else {
                try {
                    const result = await safeExec('pgrep', ['-x', processName], { timeout: 3000 })
                    isRunning = result.stdout.trim().length > 0
                } catch {
                    isRunning = false
                }
            }

            const cliExists = await commandExists(tool.command)
            let version: string | undefined
            if (cliExists) {
                const versionResult = await getCommandVersion(tool.command, tool.versionArg)
                version = versionResult || undefined
            }

            return {
                installed: cliExists || isRunning,
                status: isRunning ? 'healthy' : (cliExists ? 'warning' : 'not_installed'),
                version,
                metadata: { running: isRunning }
            }
        } catch {
            return { installed: false, status: 'unknown' }
        }
    }

    async scanTool(id: string): Promise<DetectedTool> {
        const tool = TOOL_REGISTRY.find((item: ToolDefinition) => item.id === id)
        if (!tool) throw new Error(`Tool ${id} not found in registry`)

        let result: Partial<DetectedTool> = { installed: false, status: 'not_installed' }
        const config = tool.detection || { strategy: 'cli' }

        try {
            switch (config.strategy) {
                case 'cli':
                    result = await this.detectViaCli(tool, config)
                    break
                case 'process':
                    result = await this.detectViaProcess(tool, config)
                    break
                default:
                    result = await this.detectViaCli(tool, config)
            }
        } catch (err) {
            log.error(`SensingEngine: Error scanning ${id}:`, err)
            result = { status: 'error' }
        }

        const detected: DetectedTool = {
            ...this.createInitialState(tool),
            ...result,
            lastChecked: Date.now()
        }

        persistentCache.setTool(detected as any)
        return detected
    }

    async scanCategory(category: ToolCategory): Promise<DetectedTool[]> {
        const tools = TOOL_REGISTRY.filter((tool: ToolDefinition) => tool.category === category)
        log.info(`SensingEngine: Scanning category ${category} (${tools.length} tools)`)

        const results: DetectedTool[] = []
        const batchSize = 5

        for (let index = 0; index < tools.length; index += batchSize) {
            const batch = tools.slice(index, index + batchSize)
            const batchResults = await Promise.all(batch.map((tool: ToolDefinition) => this.scanTool(tool.id)))
            results.push(...batchResults)

            if (this.progressCallback && batch.length > 0) {
                this.progressCallback(category, Math.min(index + batchSize, tools.length), tools.length, batch[0].displayName)
            }
        }

        return results
    }

    onProgress(callback: (category: string, current: number, total: number, tool: string) => void) {
        this.progressCallback = callback
    }
}

export const sensingEngine = new SensingEngine()
