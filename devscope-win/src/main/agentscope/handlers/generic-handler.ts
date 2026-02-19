/**
 * AgentScope - Generic Handler
 * 
 * Fallback handler for unknown/unregistered agents.
 * Uses base heuristics for status detection.
 */

import { BaseAgentHandler } from './base-handler'
import type { AgentStatusUpdate, AgentPhase } from '../../../shared/agentscope-types'

export class GenericHandler extends BaseAgentHandler {
    readonly agentId: string
    readonly displayName: string
    readonly command: string

    constructor(agentId: string, displayName: string, command: string) {
        super()
        this.agentId = agentId
        this.displayName = displayName
        this.command = command
    }

    parseOutput(data: string): AgentStatusUpdate | null {
        // Use only base parsing for generic handler
        return super.parseOutput(data)
    }

    detectPhase(data: string): AgentPhase {
        return super.detectPhase(data)
    }

    buildStartCommand(task?: string): string {
        if (task) {
            return `${this.command} "${task}"`
        }
        return this.command
    }
}
