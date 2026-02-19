import log from 'electron-log'
import { safeExec, commandExists, getCommandVersion } from '../safe-exec'
import type { Capability } from '../types'
import { getToolsByCategory } from '../../../shared/tool-registry'

/**
 * ACCURATE AI AGENT DETECTION
 * Prioritizes correctness over speed - performs thorough checks for each tool
 */

/**
 * Detect Cursor AI Editor
 */
async function detectCursor(): Promise<Capability> {
    const tool = {
        tool: 'cursor',
        displayName: 'Cursor',
        category: 'ai_agent' as const,
        installed: false,
        status: 'not_installed' as const,
        usedFor: ['ai', 'coding', 'editor', 'autocomplete'],
        description: 'AI-first code editor with GPT-4 integration'
    }

    try {
        // Check if cursor command exists
        const exists = await commandExists('cursor')
        if (!exists) return tool

        // Verify it's actually Cursor by running --version
        const result = await safeExec('cursor', ['--version'], { timeout: 10000 })
        if (result.stdout && result.stdout.length > 0) {
            const version = result.stdout.split('\n')[0].trim()
            return {
                ...tool,
                installed: true,
                version,
                status: 'healthy',
                description: 'AI-first code editor - Installed and ready'
            }
        }
    } catch (err) {
        log.debug('Cursor detection failed:', err)
    }

    return tool
}

/**
 * Detect Claude Code CLI
 * Example: `claude --version` outputs "2.0.76 (Claude Code)"
 */
async function detectClaude(): Promise<Capability> {
    const tool = {
        tool: 'claude',
        displayName: 'Claude Code',
        category: 'ai_agent' as const,
        installed: false,
        status: 'not_installed' as const,
        usedFor: ['ai', 'coding', 'terminal', 'agentic'],
        description: 'Anthropic Claude AI coding assistant'
    }

    try {
        const exists = await commandExists('claude')
        if (!exists) return tool

        // Run claude --version to get version info
        const result = await safeExec('claude', ['--version'], { timeout: 10000 })
        const output = result.stdout || result.stderr
        if (output && output.length > 0) {
            // Parse version like "2.0.76 (Claude Code)"
            const versionMatch = output.match(/(\d+\.\d+\.\d+)/)
            const version = versionMatch ? versionMatch[1] : output.split('\n')[0].trim()
            return {
                ...tool,
                installed: true,
                version,
                status: 'healthy',
                description: 'Claude Code CLI - Installed and ready'
            }
        }
    } catch (err) {
        log.debug('Claude detection failed:', err)
    }

    return tool
}

/**
 * Detect OpenAI Codex CLI
 * Example: `codex --version` outputs "codex-cli 0.84.0"
 */
async function detectCodex(): Promise<Capability> {
    const tool = {
        tool: 'codex',
        displayName: 'Codex CLI',
        category: 'ai_agent' as const,
        installed: false,
        status: 'not_installed' as const,
        usedFor: ['ai', 'coding', 'terminal', 'openai'],
        description: 'OpenAI Codex command-line coding assistant'
    }

    try {
        const exists = await commandExists('codex')
        if (!exists) return tool

        // Run codex --version to get version info
        const result = await safeExec('codex', ['--version'], { timeout: 10000 })
        const output = result.stdout || result.stderr
        if (output && output.length > 0) {
            // Parse version like "codex-cli 0.84.0"
            const versionMatch = output.match(/(\d+\.\d+\.\d+)/)
            const version = versionMatch ? versionMatch[1] : output.split('\n')[0].trim()
            return {
                ...tool,
                installed: true,
                version,
                status: 'healthy',
                description: 'Codex CLI - Installed and ready'
            }
        }
    } catch (err) {
        log.debug('Codex detection failed:', err)
    }

    return tool
}

/**
 * Detect Google Gemini CLI
 * Example: `gemini --version` outputs version info
 */
async function detectGemini(): Promise<Capability> {
    const tool = {
        tool: 'gemini',
        displayName: 'Gemini CLI',
        category: 'ai_agent' as const,
        installed: false,
        status: 'not_installed' as const,
        usedFor: ['ai', 'coding', 'terminal', 'google'],
        description: 'Google Gemini AI coding assistant'
    }

    try {
        const exists = await commandExists('gemini')
        if (!exists) return tool

        // Run gemini --version to get version info
        const result = await safeExec('gemini', ['--version'], { timeout: 10000 })
        const output = result.stdout || result.stderr
        if (output && output.length > 0) {
            // Parse version number
            const versionMatch = output.match(/(\d+\.\d+\.\d+)/)
            const version = versionMatch ? versionMatch[1] : output.split('\n')[0].trim()
            return {
                ...tool,
                installed: true,
                version,
                status: 'healthy',
                description: 'Gemini CLI - Installed and ready'
            }
        }
    } catch (err) {
        log.debug('Gemini detection failed:', err)
    }

    return tool
}

/**
 * Detect Aider AI coding assistant
 */
async function detectAider(): Promise<Capability> {
    const tool = {
        tool: 'aider',
        displayName: 'Aider',
        category: 'ai_agent' as const,
        installed: false,
        status: 'not_installed' as const,
        usedFor: ['ai', 'coding', 'terminal', 'pair-programming'],
        description: 'AI pair programming in your terminal'
    }

    try {
        const exists = await commandExists('aider')
        if (!exists) return tool

        // Get version to confirm it's working
        const version = await getCommandVersion('aider', '--version')
        if (version) {
            return {
                ...tool,
                installed: true,
                version,
                status: 'healthy',
                description: 'AI pair programming - Installed and ready'
            }
        }
    } catch (err) {
        log.debug('Aider detection failed:', err)
    }

    return tool
}

/**
 * Detect GitHub Copilot CLI
 */
async function detectGitHubCopilotCLI(): Promise<Capability> {
    const tool = {
        tool: 'github-copilot-cli',
        displayName: 'GitHub Copilot CLI',
        category: 'ai_agent' as const,
        installed: false,
        status: 'not_installed' as const,
        usedFor: ['ai', 'terminal', 'github', 'automation'],
        description: 'AI-powered command suggestions in terminal'
    }

    try {
        const copilotExists = await commandExists('copilot')
        if (copilotExists) {
            const version = await getCommandVersion('copilot', '--version')
            return {
                ...tool,
                installed: true,
                version: version || 'Installed',
                status: 'healthy',
                description: 'GitHub Copilot CLI - Installed and ready'
            }
        }

        // Fallback: check GitHub CLI extension
        const ghExists = await commandExists('gh')
        if (!ghExists) return tool

        const result = await safeExec('gh', ['extension', 'list'], { timeout: 10000 })
        if (result.stdout && result.stdout.toLowerCase().includes('copilot')) {
            let version = 'Installed'
            try {
                const versionResult = await safeExec('gh', ['copilot', '--version'], { timeout: 5000 })
                if (versionResult.stdout) {
                    version = versionResult.stdout.split('\n')[0].trim()
                }
            } catch {
                // Version check failed, but extension is installed
            }

            return {
                ...tool,
                installed: true,
                version,
                status: 'healthy',
                description: 'GitHub Copilot CLI extension - Installed and ready'
            }
        }
    } catch (err) {
        log.debug('GitHub Copilot CLI detection failed:', err)
    }

    return tool
}

/**
 * Detect Continue.dev
 */
async function detectContinue(): Promise<Capability> {
    const tool = {
        tool: 'continue',
        displayName: 'Continue',
        category: 'ai_agent' as const,
        installed: false,
        status: 'not_installed' as const,
        usedFor: ['ai', 'coding', 'autocomplete', 'open-source'],
        description: 'Open-source AI code assistant'
    }

    try {
        const cnExists = await commandExists('cn')
        if (cnExists) {
            const version = await getCommandVersion('cn', '--version')
            return {
                ...tool,
                installed: true,
                version: version || 'Installed',
                status: 'healthy',
                description: 'Open-source AI assistant - Installed and ready'
            }
        }

        const exists = await commandExists('continue')
        if (!exists) return tool

        const version = await getCommandVersion('continue', '--version')
        if (version) {
            return {
                ...tool,
                installed: true,
                version,
                status: 'healthy',
                description: 'Open-source AI assistant - Installed and ready'
            }
        }
    } catch (err) {
        log.debug('Continue detection failed:', err)
    }

    return tool
}

/**
 * Detect Cody AI
 */
async function detectCody(): Promise<Capability> {
    const tool = {
        tool: 'cody',
        displayName: 'Cody',
        category: 'ai_agent' as const,
        installed: false,
        status: 'not_installed' as const,
        usedFor: ['ai', 'coding', 'codebase', 'search'],
        description: 'AI coding assistant with codebase context'
    }

    try {
        const exists = await commandExists('cody')
        if (!exists) return tool

        const version = await getCommandVersion('cody', '--version')
        if (version) {
            return {
                ...tool,
                installed: true,
                version,
                status: 'healthy',
                description: 'Codebase-aware AI assistant - Installed and ready'
            }
        }
    } catch (err) {
        log.debug('Cody detection failed:', err)
    }

    return tool
}

/**
 * Detect Tabnine
 */
async function detectTabnine(): Promise<Capability> {
    const tool = {
        tool: 'tabnine',
        displayName: 'Tabnine',
        category: 'ai_agent' as const,
        installed: false,
        status: 'not_installed' as const,
        usedFor: ['ai', 'autocomplete', 'coding'],
        description: 'AI code completion assistant'
    }

    try {
        const exists = await commandExists('tabnine')
        if (!exists) return tool

        const version = await getCommandVersion('tabnine', '--version')
        if (version) {
            return {
                ...tool,
                installed: true,
                version,
                status: 'healthy',
                description: 'AI code completion - Installed and ready'
            }
        }
    } catch (err) {
        log.debug('Tabnine detection failed:', err)
    }

    return tool
}

/**
 * Detect Warp Terminal (has AI features)
 */
async function detectWarp(): Promise<Capability> {
    const tool = {
        tool: 'warp',
        displayName: 'Warp',
        category: 'ai_agent' as const,
        installed: false,
        status: 'not_installed' as const,
        usedFor: ['terminal', 'ai', 'productivity'],
        description: 'Modern terminal with AI command search'
    }

    try {
        const exists = await commandExists('warp')
        if (!exists) return tool

        const version = await getCommandVersion('warp', '--version')
        if (version) {
            return {
                ...tool,
                installed: true,
                version,
                status: 'healthy',
                description: 'AI-powered terminal - Installed and ready'
            }
        }
    } catch (err) {
        log.debug('Warp detection failed:', err)
    }

    return tool
}

/**
 * Detect Windsurf Editor
 */
async function detectWindsurf(): Promise<Capability> {
    const tool = {
        tool: 'windsurf',
        displayName: 'Windsurf',
        category: 'ai_agent' as const,
        installed: false,
        status: 'not_installed' as const,
        usedFor: ['ai', 'coding', 'editor', 'agentic-flow'],
        description: 'Agentic AI code editor'
    }

    try {
        const exists = await commandExists('windsurf')
        if (!exists) return tool

        const version = await getCommandVersion('windsurf', '--version')
        if (version) {
            return {
                ...tool,
                installed: true,
                version,
                status: 'healthy',
                description: 'Agentic AI editor - Installed and ready'
            }
        }
    } catch (err) {
        log.debug('Windsurf detection failed:', err)
    }

    return tool
}

/**
 * Detect Supermaven
 */
async function detectSupermaven(): Promise<Capability> {
    const tool = {
        tool: 'supermaven',
        displayName: 'Supermaven',
        category: 'ai_agent' as const,
        installed: false,
        status: 'not_installed' as const,
        usedFor: ['ai', 'autocomplete', 'fast', 'performance'],
        description: 'Fast AI code completion'
    }

    try {
        const exists = await commandExists('supermaven')
        if (!exists) return tool

        const version = await getCommandVersion('supermaven', '--version')
        if (version) {
            return {
                ...tool,
                installed: true,
                version,
                status: 'healthy',
                description: 'High-performance AI completion - Installed and ready'
            }
        }
    } catch (err) {
        log.debug('Supermaven detection failed:', err)
    }

    return tool
}

/**
 * Detect all AI agents with thorough, accurate checks
 * NO CACHING - Always performs fresh detection
 */
export async function detectAIAgents(): Promise<Capability[]> {
    log.info('🔍 Starting THOROUGH AI agent detection (accuracy-first)...')
    const startTime = Date.now()

    // Run all detections sequentially for maximum accuracy
    // This ensures each check completes fully before moving to the next
    const results: Capability[] = []

    log.info('  → Checking Cursor...')
    results.push(await detectCursor())

    log.info('  → Checking Claude Code...')
    results.push(await detectClaude())

    log.info('  → Checking Codex CLI...')
    results.push(await detectCodex())

    log.info('  → Checking Gemini CLI...')
    results.push(await detectGemini())

    log.info('  → Checking Aider...')
    results.push(await detectAider())

    log.info('  → Checking GitHub Copilot CLI...')
    results.push(await detectGitHubCopilotCLI())

    log.info('  → Checking Continue...')
    results.push(await detectContinue())

    log.info('  → Checking Cody...')
    results.push(await detectCody())

    log.info('  → Checking Tabnine...')
    results.push(await detectTabnine())

    log.info('  → Checking Warp...')
    results.push(await detectWarp())

    log.info('  → Checking Windsurf...')
    results.push(await detectWindsurf())

    log.info('  → Checking Supermaven...')
    results.push(await detectSupermaven())

    const installedCount = results.filter(r => r.installed).length
    const duration = Date.now() - startTime

    log.info(`✅ AI agent detection complete: ${installedCount}/${results.length} installed (${duration}ms)`)

    // Log installed agents for debugging
    results.filter(r => r.installed).forEach(agent => {
        log.info(`   ✓ ${agent.displayName} v${agent.version}`)
    })

    return results
}

/**
 * Get AI agents - ALWAYS performs fresh detection
 * No cache, no shortcuts - maximum accuracy
 */
export async function getAIAgentsWithCache(): Promise<{
    results: Capability[]
    fromCache: boolean
    isStale: boolean
}> {
    log.info('📊 Fetching AI agents (fresh scan, no cache)')
    const results = await detectAIAgents()

    return {
        results,
        fromCache: false,
        isStale: false
    }
}
