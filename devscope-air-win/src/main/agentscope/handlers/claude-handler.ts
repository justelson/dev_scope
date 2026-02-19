/**
 * AgentScope - Claude Code Handler
 */

import { BaseAgentHandler } from './base-handler'
import type { AgentStatusUpdate, AgentPhase } from '../../../shared/agentscope-types'

export class ClaudeHandler extends BaseAgentHandler {
    readonly agentId = 'claude'
    readonly displayName = 'Claude Code'
    readonly command = 'claude'

    getSystemPrompt(): string {
        return super.getSystemPrompt() + `

You are running via Claude Code CLI in AgentScope.
Report status after each tool use or significant action.
`
    }

    parseOutput(data: string): AgentStatusUpdate | null {
        const baseResult = super.parseOutput(data)
        if (baseResult) return baseResult

        // Claude-specific patterns
        if (data.includes('Claude >') || data.includes('claude>')) {
            return { status: 'awaiting_input', phase: 'waiting' }
        }

        if (data.includes('Would you like me to')) {
            return { status: 'awaiting_confirm', phase: 'waiting' }
        }

        if (data.includes('I\'ve completed') || data.includes('Changes applied')) {
            return { status: 'completed', phase: 'idle', message: 'Task completed' }
        }

        return null
    }

    detectPhase(data: string): AgentPhase {
        if (data.includes('Reading file') || data.includes('Analyzing')) return 'analyzing'
        if (data.includes('Writing to') || data.includes('Creating file')) return 'editing'
        if (data.includes('Running') || data.includes('Executing')) return 'testing'
        return super.detectPhase(data)
    }

    buildStartCommand(task?: string): string {
        // Claude Code can accept a prompt directly
        if (task) {
            return `claude "${task}"`
        }
        return 'claude'
    }
}
