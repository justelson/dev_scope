/**
 * AgentScope - Google Gemini Handler
 */

import { BaseAgentHandler } from './base-handler'
import type { AgentStatusUpdate, AgentPhase } from '../../../shared/agentscope-types'

export class GeminiHandler extends BaseAgentHandler {
    readonly agentId = 'gemini'
    readonly displayName = 'Gemini CLI'
    readonly command = 'gemini'

    getSystemPrompt(): string {
        return super.getSystemPrompt() + `

You are running via Google Gemini CLI in AgentScope.
Output status JSON after completing each task phase.
`
    }

    parseOutput(data: string): AgentStatusUpdate | null {
        const baseResult = super.parseOutput(data)
        if (baseResult) return baseResult

        // Gemini-specific patterns
        if (data.includes('gemini>') || data.includes('>>>')) {
            return { status: 'awaiting_input', phase: 'waiting' }
        }

        if (data.includes('Would you like') || data.includes('Should I')) {
            return { status: 'awaiting_confirm', phase: 'waiting' }
        }

        if (data.includes('Task completed') || data.includes('All done')) {
            return { status: 'completed', phase: 'idle' }
        }

        // Gemini task view completion
        if (data.includes('Task view mode continues') || data.includes('notify_user')) {
            return { status: 'awaiting_review', phase: 'reviewing' }
        }

        return null
    }

    detectPhase(data: string): AgentPhase {
        if (data.includes('Reading') || data.includes('Analyzing')) return 'analyzing'
        if (data.includes('Creating') || data.includes('Writing')) return 'generating'
        if (data.includes('Editing') || data.includes('Modifying')) return 'editing'
        if (data.includes('Testing') || data.includes('Running')) return 'testing'
        return super.detectPhase(data)
    }

    buildStartCommand(task?: string): string {
        if (task) {
            return `gemini "${task}"`
        }
        return 'gemini'
    }
}
