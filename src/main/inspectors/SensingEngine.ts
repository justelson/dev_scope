import { spawn } from 'child_process'
import log from 'electron-log'
import { persistentCache, ToolCacheEntry } from './persistent-cache'
import { TOOL_REGISTRY, ToolDefinition, DetectionConfig, ToolCategory } from '../../shared/tool-registry'
import { DetectedTool, ToolStatus } from './types'
import { commandExists, getCommandVersion, safeExec } from './safe-exec'
import { unifiedBatchCheck, invalidateUnifiedBatchCache, BatchResults } from './unified-batch-scanner'

/**
 * SensingEngine
 * Unified orchestrator for tool detection and monitoring
 */
class SensingEngine {
    private isScanning = false
    private progressCallback?: (category: string, current: number, total: number, tool: string) => void

    /**
     * Map a ToolDefinition to a DetectedTool state (not installed by default)
     */
    private createInitialState(tool: ToolDefinition): DetectedTool {
        return {
            id: tool.id,
            displayName: tool.displayName,
            category: tool.category as any, // Cast to match types.ts ToolCategory
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

    /**
     * CLI Detection Strategy
     */
    private async detectViaCli(tool: ToolDefinition, config: DetectionConfig): Promise<Partial<DetectedTool>> {
        const cmd = config.command || tool.command
        const exists = await commandExists(cmd)

        if (!exists) {
            // Check alternate commands if primary fails
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
        const version = versionResult || undefined
        return {
            installed: true,
            status: 'healthy',
            version,
            metadata: { command: cmd }
        }
    }

    /**
     * Process Detection Strategy (for services like Docker, Ollama)
     */
    private async detectViaProcess(tool: ToolDefinition, config: DetectionConfig): Promise<Partial<DetectedTool>> {
        const processName = config.processName || tool.id

        try {
            // Cross-platform process check
            let isRunning = false
            if (process.platform === 'win32') {
                const cmd = `tasklist /NH /FI "IMAGENAME eq ${processName}.exe"`
                const result = await safeExec('cmd', ['/c', cmd])
                isRunning = result.stdout.toLowerCase().includes(processName.toLowerCase())
            } else {
                // macOS/Linux: use pgrep
                try {
                    const result = await safeExec('pgrep', ['-x', processName], { timeout: 3000 })
                    isRunning = result.stdout.trim().length > 0
                } catch {
                    isRunning = false
                }
            }

            // Also check if CLI exists if it's a dual-type tool
            const cliExists = await commandExists(tool.command)
            let version: string | undefined
            if (cliExists) {
                const versionResult = await getCommandVersion(tool.command, tool.versionArg)
                version = versionResult || undefined
            }

            return {
                installed: cliExists || isRunning,
                status: isRunning ? 'healthy' : (cliExists ? 'warning' : 'not_installed'),
                version: version,
                metadata: { running: isRunning }
            }
        } catch (err) {
            return { installed: false, status: 'unknown' }
        }
    }

    /**
     * Custom Detection Strategy (for complex tools)
     */
    private async detectViaCustom(tool: ToolDefinition, config: DetectionConfig): Promise<Partial<DetectedTool>> {
        const detectorName = config.customDetector
        if (!detectorName) return { status: 'error', description: 'Custom detector name not specified' }

        switch (detectorName) {
            case 'cuda':
                return this.detectCUDA(tool)
            case 'pytorch':
                return this.detectAiFramework(tool, 'torch')
            case 'tensorflow':
                return this.detectAiFramework(tool, 'tensorflow')
            default:
                return { status: 'error', description: `Unknown custom detector: ${detectorName}` }
        }
    }

    /**
     * Specialized: CUDA Detection
     */
    private async detectCUDA(tool: ToolDefinition): Promise<Partial<DetectedTool>> {
        try {
            // Check nvidia-smi
            if (await commandExists('nvidia-smi')) {
                const result = await safeExec('nvidia-smi', [
                    '--query-gpu=driver_version,name,memory.total',
                    '--format=csv,noheader'
                ])
                if (result.stdout) {
                    const [driver, name, vram] = result.stdout.trim().split(',').map(s => s.trim())
                    return {
                        installed: true,
                        status: 'healthy',
                        version: driver,
                        description: `${name} • ${vram} VRAM • Driver ${driver}`
                    }
                }
            }
            // Fallback to nvcc
            if (await commandExists('nvcc')) {
                const versionResult = await getCommandVersion('nvcc', '--version')
                return { installed: true, status: 'healthy', version: versionResult || undefined, description: `CUDA Toolkit ${versionResult || 'Installed'}` }
            }
        } catch (err) {
            log.debug('CUDA detection failed:', err)
        }
        return { installed: false, status: 'not_installed' }
    }

    /**
     * Specialized: AI Framework Detection (via pip)
     */
    private async detectAiFramework(tool: ToolDefinition, packageName: string): Promise<Partial<DetectedTool>> {
        try {
            if (await commandExists('pip')) {
                const result = await safeExec('pip', ['show', packageName])
                if (result.stdout && result.stdout.includes(`Name: ${packageName}`)) {
                    const versionMatch = result.stdout.match(/Version: ([^\s]+)/)
                    const version = versionMatch ? versionMatch[1] : 'Unknown'
                    return {
                        installed: true,
                        status: 'healthy',
                        version,
                        description: `${tool.displayName} v${version} (via pip)`
                    }
                }
            }
        } catch (err) {
            log.debug(`${packageName} detection failed:`, err)
        }
        return { installed: false, status: 'not_installed' }
    }

    /**
     * Scan a single tool based on its configuration
     */
    async scanTool(id: string): Promise<DetectedTool> {
        const tool = TOOL_REGISTRY.find((t: ToolDefinition) => t.id === id)
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
                case 'custom':
                    result = await this.detectViaCustom(tool, config)
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

        // Update cache
        persistentCache.setTool(detected as any)
        return detected
    }

    /**
     * Scan an entire category of tools
     */
    async scanCategory(category: ToolCategory): Promise<DetectedTool[]> {
        const tools = TOOL_REGISTRY.filter((t: ToolDefinition) => t.category === category)
        log.info(`SensingEngine: Scanning category ${category} (${tools.length} tools)`)

        const results: DetectedTool[] = []

        // Scan in small batches to avoid overloading
        const batchSize = 5
        for (let i = 0; i < tools.length; i += batchSize) {
            const batch = tools.slice(i, i + batchSize)
            const batchResults = await Promise.all(batch.map((t: ToolDefinition) => this.scanTool(t.id)))
            results.push(...batchResults)

            if (this.progressCallback) {
                this.progressCallback(category, Math.min(i + batchSize, tools.length), tools.length, batch[0].displayName)
            }
        }

        return results
    }

    /**
     * Set progress callback
     */
    onProgress(callback: (category: string, current: number, total: number, tool: string) => void) {
        this.progressCallback = callback
    }

    /**
     * Get aggregated AI runtime report
     */
    async getAIRuntimeReport() {
        const [llmRuntimes, gpuAcceleration, aiFrameworks] = await Promise.all([
            this.scanCategory('ai_runtime'),
            this.scanCategory('gpu_acceleration'),
            this.scanCategory('ai_framework')
        ])

        return {
            llmRuntimes: llmRuntimes as any[],
            gpuAcceleration,
            aiFrameworks,
            timestamp: Date.now()
        }
    }

    /**
     * Scan ALL categories in parallel (fast full scan)
     * Uses unified batch scanner for CLI tools, then runs
     * custom detectors for special tools (CUDA, AI frameworks).
     */
    async scanAllParallel(
        onCategoryComplete?: (category: string, results: DetectedTool[]) => void
    ): Promise<Map<ToolCategory, DetectedTool[]>> {
        log.info('SensingEngine: Starting parallel full scan...')
        const startTime = Date.now()

        // Collect ALL CLI tool commands for unified batch check
        const cliTools = TOOL_REGISTRY.filter(
            (t: ToolDefinition) => !t.detection || t.detection.strategy === 'cli'
        )
        const allCommands = new Set<string>()
        for (const tool of cliTools) {
            allCommands.add(tool.command)
            if (tool.alternateCommands) {
                tool.alternateCommands.forEach((c: string) => allCommands.add(c))
            }
        }

        // Run unified batch check for all CLI tools at once
        const batchResults = await unifiedBatchCheck(Array.from(allCommands))

        // Now build DetectedTool results using batch data
        const allResults = new Map<ToolCategory, DetectedTool[]>()
        const categories = [...new Set(TOOL_REGISTRY.map((t: ToolDefinition) => t.category))] as ToolCategory[]

        // Process each category (using batch results, no new spawns for CLI tools)
        const categoryPromises = categories.map(async (category) => {
            const tools = TOOL_REGISTRY.filter((t: ToolDefinition) => t.category === category)
            const results: DetectedTool[] = []

            for (const tool of tools) {
                const config = tool.detection || { strategy: 'cli' }

                if (config.strategy === 'cli' || !config.strategy) {
                    // Use batch results (instant lookup, no spawn)
                    const batchResult = batchResults[tool.command]
                    let found = batchResult?.exists || false
                    let version = batchResult?.version
                    let path = batchResult?.path

                    // Check alternate commands if primary not found
                    if (!found && tool.alternateCommands) {
                        for (const alt of tool.alternateCommands) {
                            const altResult = batchResults[alt]
                            if (altResult?.exists) {
                                found = true
                                version = altResult.version
                                path = altResult.path
                                break
                            }
                        }
                    }

                    const detected: DetectedTool = {
                        ...this.createInitialState(tool),
                        installed: found,
                        status: found ? 'healthy' : 'not_installed',
                        version: version || undefined,
                        path,
                        lastChecked: Date.now()
                    }
                    results.push(detected)
                    persistentCache.setTool(detected as any)
                } else {
                    // Process/custom detection still uses individual checks
                    const detected = await this.scanTool(tool.id)
                    results.push(detected)
                }
            }

            allResults.set(category, results)
            if (onCategoryComplete) {
                onCategoryComplete(category, results)
            }
        })

        await Promise.all(categoryPromises)

        persistentCache.markScanned()
        persistentCache.save()

        const duration = Date.now() - startTime
        log.info(`SensingEngine: Parallel full scan completed in ${duration}ms`)

        return allResults
    }
}

export const sensingEngine = new SensingEngine()
