/**
 * AgentScope - OpenAI Codex Handler
 */

import { BaseAgentHandler } from './base-handler'
import type { AgentStatusUpdate, AgentPhase } from '../../../shared/agentscope-types'

export class CodexHandler extends BaseAgentHandler {
    readonly agentId = 'codex'
    readonly displayName = 'Codex CLI'
    readonly command = 'codex'

    getSystemPrompt(): string {
        return super.getSystemPrompt() + `

You are running via OpenAI Codex CLI in AgentScope.
Use the status JSON format after each major action.
`
    }

    parseOutput(data: string): AgentStatusUpdate | null {
        const baseResult = super.parseOutput(data)
        if (baseResult) return baseResult

        // Codex-specific patterns
        if (data.includes('codex>') || data.includes('>>')) {
            return { status: 'awaiting_input', phase: 'waiting' }
        }

        if (data.includes('Apply changes?') || data.includes('Confirm?')) {
            return { status: 'awaiting_confirm', phase: 'waiting' }
        }

        if (data.includes('Successfully') || data.includes('Done!')) {
            return { status: 'completed', phase: 'idle' }
        }

        return null
    }

    detectPhase(data: string): AgentPhase {
        if (data.includes('Analyzing') || data.includes('Understanding')) return 'analyzing'
        if (data.includes('Generating') || data.includes('Writing')) return 'generating'
        if (data.includes('Applying') || data.includes('Editing')) return 'editing'
        return super.detectPhase(data)
    }

    buildStartCommand(task?: string): string {
        if (task) {
            return `codex "${task}"`
        }
        return 'codex'
    }
}
