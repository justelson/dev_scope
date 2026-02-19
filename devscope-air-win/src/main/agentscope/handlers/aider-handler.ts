/**
 * AgentScope - Aider Handler
 */

import { BaseAgentHandler } from './base-handler'
import type { AgentStatusUpdate, AgentPhase } from '../../../shared/agentscope-types'

export class AiderHandler extends BaseAgentHandler {
    readonly agentId = 'aider'
    readonly displayName = 'Aider'
    readonly command = 'aider'

    getSystemPrompt(): string {
        return super.getSystemPrompt() + `

You are running Aider (AI pair programmer) in AgentScope.
Report status via JSON after each code change or prompt.
`
    }

    parseOutput(data: string): AgentStatusUpdate | null {
        const baseResult = super.parseOutput(data)
        if (baseResult) return baseResult

        // Aider-specific patterns
        if (data.includes('aider>') || data.includes('> ')) {
            return { status: 'awaiting_input', phase: 'waiting' }
        }

        // Aider uses y/n confirmations frequently
        if (data.includes('(y/n)') || data.includes('[Y/n]') || data.includes('[y/N]')) {
            return { status: 'awaiting_confirm', phase: 'waiting' }
        }

        if (data.includes('Applied edit to') || data.includes('Wrote ')) {
            return { status: 'running', phase: 'editing', message: 'Applied changes' }
        }

        if (data.includes('Commit ')) {
            return { status: 'completed', phase: 'idle', message: 'Changes committed' }
        }

        return null
    }

    detectPhase(data: string): AgentPhase {
        if (data.includes('Scanning') || data.includes('repo map')) return 'analyzing'
        if (data.includes('Edit') || data.includes('update')) return 'editing'
        if (data.includes('git diff') || data.includes('Commit')) return 'reviewing'
        return super.detectPhase(data)
    }

    buildStartCommand(task?: string): string {
        // Aider typically runs without a direct task argument
        // but can accept --message
        if (task) {
            return `aider --message "${task}"`
        }
        return 'aider'
    }
}
