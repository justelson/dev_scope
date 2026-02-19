# AgentScope Handlers - Development Guide

Add new AI agent handlers to extend AgentScope capabilities.

## Quick Start

1. Copy `_template-handler.ts` to `your-agent-handler.ts`
2. Implement the abstract methods
3. Register in `index.ts`

---

## Handler Structure

```typescript
export class YourAgentHandler extends BaseAgentHandler {
    readonly agentId = 'your-agent'    // matches tool ID from ai-agents.ts
    readonly displayName = 'Your Agent'
    readonly command = 'your-agent'    // CLI command to run

    getSystemPrompt(): string {
        // Return agent-specific status instruction
    }

    parseOutput(data: string): AgentStatusUpdate | null {
        // Parse output for status markers
    }

    detectPhase(data: string): AgentPhase {
        // Detect current phase from output
    }
}
```

---

## Available Status Types

| Status | Description |
|--------|-------------|
| `ready` | Session created, not started |
| `running` | Agent processing |
| `awaiting_input` | Needs user input |
| `awaiting_review` | Needs code review |
| `awaiting_confirm` | Needs Y/N confirmation |
| `completed` | Task done |
| `failed` | Error occurred |

---

## Registered Agents

| Agent | Handler | Status |
|-------|---------|--------|
| Claude Code | `claude-handler.ts` | ✅ Implemented |
| Codex CLI | `codex-handler.ts` | ✅ Implemented |
| Gemini CLI | `gemini-handler.ts` | ✅ Implemented |
| Aider | `aider-handler.ts` | ✅ Implemented |
| GitHub Copilot | `copilot-handler.ts` | ✅ Implemented |
| Cursor | `cursor-handler.ts` | ⏳ TODO |
| Continue | `continue-handler.ts` | ⏳ TODO |
| Cody | `cody-handler.ts` | ⏳ TODO |
| Windsurf | `windsurf-handler.ts` | ⏳ TODO |
| Generic | `generic-handler.ts` | ✅ Fallback |

---

## Detection Patterns

Handlers should look for:
- JSON status markers: `{"agentscope_status": "..."}`
- Prompt patterns (e.g., `>`, `$`, `?`)  
- Completion phrases (e.g., "Done", "Complete", "Finished")
- Error patterns (e.g., "Error:", "Failed:", exceptions)
- Confirmation prompts (e.g., "y/n", "Continue?")
