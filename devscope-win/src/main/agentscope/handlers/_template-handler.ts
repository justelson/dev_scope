/**
 * AgentScope - Template Handler
 * 
 * Copy this file to create a new agent handler.
 * Rename to `your-agent-handler.ts` and implement the abstract methods.
 */

import { BaseAgentHandler } from './base-handler'
import type { AgentStatus, AgentPhase, AgentStatusUpdate } from '../../../shared/agentscope-types'

export class TemplateHandler extends BaseAgentHandler {
    // TODO: Change these to match your agent
    readonly agentId = 'your-agent-id'      // Must match ID in ai-agents.ts
    readonly displayName = 'Your Agent Name'
    readonly command = 'your-agent-command' // CLI command

    /**
     * Custom system prompt for this agent.
     * Tell the agent how to report status.
     */
    getSystemPrompt(): string {
        // Use base prompt + any agent-specific additions
        return super.getSystemPrompt() + `

Additional instructions for Your Agent:
- After each file edit, report status
- When waiting for user input, use "awaiting_input"
`
    }

    /**
     * Parse output for this agent's specific patterns.
     */
    parseOutput(data: string): AgentStatusUpdate | null {
        // Try base parsing first (JSON markers)
        const baseResult = super.parseOutput(data)
        if (baseResult) return baseResult

        // Add agent-specific patterns here
        // Example:
        // if (data.includes('YourAgent> ')) {
        //     return { status: 'awaiting_input', phase: 'waiting' }
        // }

        return null
    }

    /**
     * Detect phase from agent-specific output.
     */
    detectPhase(data: string): AgentPhase {
        // Add agent-specific phase detection
        // Example:
        // if (data.includes('[YourAgent] Scanning...')) return 'analyzing'

        // Fallback to base detection
        return super.detectPhase(data)
    }

    /**
     * Build the command to start this agent.
     */
    buildStartCommand(task?: string): string {
        if (task) {
            return `${this.command} "${task}"`
        }
        return this.command
    }
}

// Don't forget to register in handlers/index.ts!
