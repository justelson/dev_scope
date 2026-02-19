/**
 * AgentScope - Shared Types
 */

// Agent session status (maps to Kanban columns)
export type AgentStatus =
    | 'ready'           // Not started
    | 'running'         // Actively processing
    | 'awaiting_input'  // Waiting for user input
    | 'awaiting_review' // Needs code review
    | 'awaiting_confirm'// Needs Y/N confirmation
    | 'completed'       // Successfully finished
    | 'failed'          // Error occurred

// Current phase of agent work
export type AgentPhase =
    | 'idle'
    | 'analyzing'
    | 'generating'
    | 'editing'
    | 'testing'
    | 'reviewing'
    | 'waiting'
    | 'error'

// Agent session info
export interface AgentSession {
    id: string
    agentId: string           // e.g., 'claude', 'codex', 'gemini'
    agentName: string
    status: AgentStatus
    phase: AgentPhase
    cwd: string
    startedAt?: number
    endedAt?: number
    lastActivity: number
    outputHistory: string[]   // Last N lines of output
    terminalId?: string       // PTY terminal session ID
    task?: string             // Optional task description
}

// Status update from parser
export interface AgentStatusUpdate {
    status: AgentStatus
    phase?: AgentPhase
    message?: string
    file?: string
    summary?: string
    error?: string
}

// JSON status marker format (agents output this)
export interface AgentScopeStatusMarker {
    agentscope_status: AgentStatus
    phase?: AgentPhase
    file?: string
    summary?: string
    error?: string
}

// Session creation config
export interface CreateSessionConfig {
    agentId: string
    cwd?: string
    task?: string
    autoStart?: boolean
}

// IPC event payloads
export interface AgentScopeEvents {
    'agentscope:session-created': { session: AgentSession }
    'agentscope:session-updated': { session: AgentSession }
    'agentscope:session-closed': { sessionId: string; exitCode: number }
    'agentscope:output': { sessionId: string; data: string }
    'agentscope:status-change': { sessionId: string; status: AgentStatus; phase?: AgentPhase }
}
