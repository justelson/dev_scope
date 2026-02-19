/**
 * AgentScope - GitHub Copilot CLI Handler
 */

import { BaseAgentHandler } from './base-handler'
import type { AgentStatusUpdate, AgentPhase } from '../../../shared/agentscope-types'

export class CopilotHandler extends BaseAgentHandler {
    readonly agentId = 'github-copilot-cli'
    readonly displayName = 'GitHub Copilot CLI'
    readonly command = 'copilot'

    getSystemPrompt(): string {
        // Copilot CLI may not support system prompts the same way
        return super.getSystemPrompt()
    }

    parseOutput(data: string): AgentStatusUpdate | null {
        const baseResult = super.parseOutput(data)
        if (baseResult) return baseResult

        // Copilot CLI patterns
        if (data.includes('?') && data.includes(':')) {
            return { status: 'awaiting_input', phase: 'waiting' }
        }

        if (data.includes('Run this command?') || data.includes('Execute?')) {
            return { status: 'awaiting_confirm', phase: 'waiting' }
        }

        if (data.includes('Suggested command:')) {
            return { status: 'running', phase: 'generating' }
        }

        return null
    }

    detectPhase(data: string): AgentPhase {
        if (data.includes('Thinking') || data.includes('...')) return 'analyzing'
        if (data.includes('Suggested')) return 'generating'
        return super.detectPhase(data)
    }

    buildStartCommand(task?: string): string {
        if (task) {
            return `copilot "${task}"`
        }
        return 'copilot'
    }
}
