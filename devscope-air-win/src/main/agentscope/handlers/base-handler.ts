/**
 * AgentScope - Base Agent Handler
 * 
 * Abstract base class for agent-specific handlers.
 * Each agent (Claude, Codex, Gemini, etc.) extends this.
 */

import type { AgentStatus, AgentPhase, AgentStatusUpdate } from '../../../shared/agentscope-types'

export abstract class BaseAgentHandler {
    /** Agent ID matching the tool registry (e.g., 'claude', 'codex') */
    abstract readonly agentId: string

    /** Display name for UI */
    abstract readonly displayName: string

    /** CLI command to invoke this agent */
    abstract readonly command: string

    /**
     * Get the system prompt/instruction to inject for status reporting.
     * This tells the agent how to report its status as JSON.
     */
    getSystemPrompt(): string {
        return `
IMPORTANT: You are running inside AgentScope, an AI agent orchestrator.
After completing each major step, output a status update in this EXACT JSON format on its own line:
{"agentscope_status": "<status>", "phase": "<phase>", "summary": "<brief summary>"}

Status values: "running", "awaiting_input", "awaiting_review", "awaiting_confirm", "completed", "failed"
Phase values: "analyzing", "generating", "editing", "testing", "reviewing", "waiting", "error"

Example: {"agentscope_status": "completed", "phase": "editing", "summary": "Fixed the login bug"}
`.trim()
    }

    /**
     * Parse agent output for status markers.
     * Returns status update if found, null otherwise.
     */
    parseOutput(data: string): AgentStatusUpdate | null {
        // Try JSON marker first
        const jsonMatch = data.match(/\{"agentscope_status"\s*:\s*"([^"]+)"[^}]*\}/g)
        if (jsonMatch) {
            try {
                const lastMatch = jsonMatch[jsonMatch.length - 1]
                const parsed = JSON.parse(lastMatch)
                if (parsed.agentscope_status) {
                    return {
                        status: parsed.agentscope_status as AgentStatus,
                        phase: parsed.phase as AgentPhase,
                        message: parsed.summary || parsed.message,
                        file: parsed.file,
                        error: parsed.error
                    }
                }
            } catch {
                // JSON parse failed, try heuristics
            }
        }

        // Fallback to heuristic detection
        return this.detectStatusHeuristic(data)
    }

    /**
     * Heuristic status detection from output patterns.
     * Override in subclasses for agent-specific patterns.
     */
    protected detectStatusHeuristic(data: string): AgentStatusUpdate | null {
        const lower = data.toLowerCase()

        // Error patterns
        if (lower.includes('error:') || lower.includes('failed:') || lower.includes('exception:')) {
            return { status: 'failed', phase: 'error', error: data.substring(0, 200) }
        }

        // Completion patterns
        if (lower.includes('done') || lower.includes('complete') || lower.includes('finished')) {
            return { status: 'completed', phase: 'idle' }
        }

        // Confirmation prompts
        if (lower.includes('(y/n)') || lower.includes('[y/n]') || lower.includes('continue?')) {
            return { status: 'awaiting_confirm', phase: 'waiting' }
        }

        // Review prompts
        if (lower.includes('review') || lower.includes('check the changes')) {
            return { status: 'awaiting_review', phase: 'reviewing' }
        }

        return null
    }

    /**
     * Detect the current phase from output.
     * Override for agent-specific phase detection.
     */
    detectPhase(data: string): AgentPhase {
        const lower = data.toLowerCase()

        if (lower.includes('analyzing') || lower.includes('reading')) return 'analyzing'
        if (lower.includes('generating') || lower.includes('writing')) return 'generating'
        if (lower.includes('editing') || lower.includes('modifying')) return 'editing'
        if (lower.includes('testing') || lower.includes('running tests')) return 'testing'
        if (lower.includes('reviewing') || lower.includes('checking')) return 'reviewing'
        if (lower.includes('waiting') || lower.includes('...')) return 'waiting'

        return 'idle'
    }

    /**
     * Build the initial command to start the agent.
     * Override for agents that need special arguments.
     */
    buildStartCommand(task?: string): string {
        return this.command
    }
}
