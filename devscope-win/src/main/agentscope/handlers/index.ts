/**
 * AgentScope - Handler Registry
 * 
 * Exports all agent handlers and provides lookup by agent ID.
 */

import { BaseAgentHandler } from './base-handler'
import { ClaudeHandler } from './claude-handler'
import { CodexHandler } from './codex-handler'
import { GeminiHandler } from './gemini-handler'
import { AiderHandler } from './aider-handler'
import { CopilotHandler } from './copilot-handler'
import { GenericHandler } from './generic-handler'
import { getToolById } from '../../../shared/tool-registry'

// All registered handlers
const handlers: BaseAgentHandler[] = [
    new ClaudeHandler(),
    new CodexHandler(),
    new GeminiHandler(),
    new AiderHandler(),
    new CopilotHandler(),
]

// Handler lookup map
const handlerMap = new Map<string, BaseAgentHandler>()
handlers.forEach(h => handlerMap.set(h.agentId.toLowerCase(), h))

/**
 * Get handler for a specific agent ID.
 * Returns generic handler if no specific handler exists.
 */
export function getHandler(agentId: string, displayName?: string, command?: string): BaseAgentHandler {
    const normalizedId = (agentId || '').toLowerCase()
    const handler = handlerMap.get(normalizedId)
    if (handler) return handler

    // Try resolving via tool registry (maps ids like "claude-code" -> command "claude")
    const tool = getToolById(agentId)
    if (tool) {
        const handlerByCommand = handlerMap.get(tool.command.toLowerCase())
        if (handlerByCommand) return handlerByCommand
        return new GenericHandler(agentId, tool.displayName, tool.command)
    }

    // Return generic handler for unknown agents
    return new GenericHandler(
        agentId,
        displayName || agentId,
        command || agentId
    )
}

/**
 * Get all registered handlers.
 */
export function getAllHandlers(): BaseAgentHandler[] {
    return [...handlers]
}

/**
 * Check if a handler exists for an agent.
 */
export function hasHandler(agentId: string): boolean {
    return handlerMap.has(agentId.toLowerCase())
}

// Re-export base handler for extensions
export { BaseAgentHandler } from './base-handler'
export { GenericHandler } from './generic-handler'
