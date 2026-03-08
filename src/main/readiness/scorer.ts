/**
 * DevScope - Readiness Scoring Engine
 * Rule-based scoring for developer environment readiness
 */

import log from 'electron-log'
import type {
    DetectedTool,
    ToolingReport,
    AIRuntimeReport,
    ReadinessReport,
    ReadinessLevel,
    Warning,
    Recommendation,
    WarningSeverity
} from '../inspectors/types'

/**
 * Essential tools that are expected for most development environments
 */
const ESSENTIAL_TOOLS = new Set(['node', 'git', 'python'])

/**
 * Recommended tools by category
 */
const RECOMMENDATIONS: Record<string, { title: string; description: string; installCommand?: string; learnMoreUrl?: string }> = {
    node: {
        title: 'Install Node.js',
        description: 'Node.js is essential for JavaScript/TypeScript development and many build tools.',
        installCommand: 'winget install OpenJS.NodeJS.LTS',
        learnMoreUrl: 'https://nodejs.org/'
    },
    python: {
        title: 'Install Python',
        description: 'Python is recommended for AI/ML workflows and scripting.',
        installCommand: 'winget install Python.Python.3.11',
        learnMoreUrl: 'https://www.python.org/'
    },
    git: {
        title: 'Install Git',
        description: 'Git is the standard for version control.',
        installCommand: 'winget install Git.Git',
        learnMoreUrl: 'https://git-scm.com/'
    },
    docker: {
        title: 'Install Docker',
        description: 'Docker enables containerized development and testing.',
        installCommand: 'winget install Docker.DockerDesktop',
        learnMoreUrl: 'https://www.docker.com/'
    },
    ollama: {
        title: 'Install Ollama',
        description: 'Run local LLMs for AI-assisted development.',
        installCommand: 'winget install Ollama.Ollama',
        learnMoreUrl: 'https://ollama.ai/'
    }
}

/**
 * Calculate readiness score from 0-100
 */
function calculateScore(
    tooling: ToolingReport,
    aiRuntime: AIRuntimeReport
): number {
    const allTools: DetectedTool[] = [
        ...tooling.languages,
        ...tooling.packageManagers,
        ...tooling.buildTools,
        ...tooling.containers,
        ...tooling.versionControl,
        ...aiRuntime.gpuAcceleration,
        ...aiRuntime.aiFrameworks
    ]

    const installedCount = allTools.filter(t => t.installed).length
    const healthyCount = allTools.filter(t => t.status === 'healthy').length
    const totalCount = allTools.length

    if (totalCount === 0) return 0

    // Weight: 60% installation, 40% health
    const installScore = (installedCount / totalCount) * 60
    const healthScore = (healthyCount / Math.max(installedCount, 1)) * 40

    return Math.round(installScore + healthScore)
}

/**
 * Determine readiness level based on score
 */
function getReadinessLevel(score: number, warnings: Warning[]): ReadinessLevel {
    const criticalWarnings = warnings.filter(w => w.severity === 'critical')

    if (criticalWarnings.length > 0 || score < 30) return 'not_ready'
    if (score < 70) return 'partial'
    return 'ready'
}

/**
 * Generate warnings for issues
 */
function generateWarnings(
    tooling: ToolingReport,
    aiRuntime: AIRuntimeReport
): Warning[] {
    const warnings: Warning[] = []
    let id = 1

    // Check essential tools
    for (const essential of ESSENTIAL_TOOLS) {
        const allCapabilities = [
            ...tooling.languages,
            ...tooling.versionControl
        ]
        const tool = allCapabilities.find(t => t.id === essential)

        if (!tool?.installed) {
            warnings.push({
                id: `warn-${id++}`,
                tool: essential,
                message: `Essential tool "${essential}" is not installed`,
                severity: 'high' as WarningSeverity,
                suggestion: RECOMMENDATIONS[essential]?.installCommand
            })
        }
    }

    // Check for warning status tools
    const allTools: DetectedTool[] = [
        ...tooling.languages,
        ...tooling.packageManagers,
        ...tooling.buildTools,
        ...tooling.containers,
        ...tooling.versionControl
    ]

    for (const tool of allTools) {
        if (tool.status === 'warning' && tool.installed) {
            warnings.push({
                id: `warn-${id++}`,
                tool: tool.id,
                message: `${tool.displayName} is installed but may have issues`,
                severity: 'medium' as WarningSeverity
            })
        }
    }

    // Check Docker daemon
    const docker = tooling.containers.find(t => t.id === 'docker')
    if (docker?.installed && docker.status === 'warning') {
        warnings.push({
            id: `warn-${id++}`,
            tool: 'docker',
            message: 'Docker is installed but the daemon is not running',
            severity: 'low' as WarningSeverity,
            suggestion: 'Start Docker Desktop'
        })
    }

    return warnings
}

/**
 * Generate recommendations for missing tools
 */
function generateRecommendations(
    tooling: ToolingReport,
    aiRuntime: AIRuntimeReport
): Recommendation[] {
    const recommendations: Recommendation[] = []
    let priority = 1

    const allTools: DetectedTool[] = [
        ...tooling.languages,
        ...tooling.packageManagers,
        ...tooling.containers,
        ...tooling.versionControl,
        ...aiRuntime.llmRuntimes
    ]

    for (const [toolId, rec] of Object.entries(RECOMMENDATIONS)) {
        const tool = allTools.find(t => t.id === toolId)
        if (!tool?.installed) {
            recommendations.push({
                id: `rec-${priority}`,
                title: rec.title,
                description: rec.description,
                priority: priority++,
                category: tool?.category || 'language',
                installCommand: rec.installCommand,
                learnMoreUrl: rec.learnMoreUrl
            })
        }
    }

    return recommendations.slice(0, 5) // Top 5 recommendations
}

/**
 * Calculate readiness report
 */
export function calculateReadiness(
    tooling: ToolingReport,
    aiRuntime: AIRuntimeReport
): ReadinessReport {
    log.info('Calculating readiness score...')

    const warnings = generateWarnings(tooling, aiRuntime)
    const recommendations = generateRecommendations(tooling, aiRuntime)
    const score = calculateScore(tooling, aiRuntime)
    const level = getReadinessLevel(score, warnings)

    const allTools: DetectedTool[] = [
        ...tooling.languages,
        ...tooling.packageManagers,
        ...tooling.buildTools,
        ...tooling.containers,
        ...tooling.versionControl
    ]

    const report: ReadinessReport = {
        level,
        score,
        totalTools: allTools.length,
        installedTools: allTools.filter(t => t.installed).length,
        healthyTools: allTools.filter(t => t.status === 'healthy').length,
        warnings,
        recommendations,
        timestamp: Date.now()
    }

    log.info(`Readiness: ${level} (${score}/100)`)
    return report
}
