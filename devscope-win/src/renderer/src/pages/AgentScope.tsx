/**
 * AgentScope - AI Agent Orchestration (VERY EARLY ALPHA)
 * 
 * A streamlined interface for managing parallel AI CLI agents.
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import {
    Plus, Play, Square, RotateCw,
    FlaskConical, X, Sparkles, Bot, Layers,
    Loader2, MessageCircle, AlertTriangle, Terminal,
    LayoutGrid, List, AlignJustify
} from 'lucide-react'
import { getCache } from '@/lib/refreshCache'
import ToolIcon from '@/components/ui/ToolIcon'
import AgentTerminalModal from '@/components/agentscope/AgentTerminalModal'
import AgentDirectoryModal from '@/components/agentscope/AgentDirectoryModal'
import AgentChatModal from '@/components/agentscope/AgentChatModal'

// Types matching backend agentscope-types.ts
type AgentStatus = 'ready' | 'running' | 'awaiting_input' | 'awaiting_review' | 'awaiting_confirm' | 'completed' | 'failed'
type AgentPhase = 'idle' | 'analyzing' | 'generating' | 'editing' | 'testing' | 'reviewing' | 'waiting' | 'error'
type AgentLayout = 'kanban' | 'cards' | 'list'
type StatusFilter = 'all' | 'running' | 'awaiting' | 'ready' | 'completed' | 'failed'

interface AgentSession {
    id: string
    agentId: string
    agentName: string
    status: AgentStatus
    phase: AgentPhase
    cwd: string
    startedAt?: number
    endedAt?: number
    lastActivity: number
    outputHistory: string[]
    terminalId?: string
    task?: string
}

type ChatRole = 'system' | 'user' | 'assistant' | 'status'

interface ChatMessage {
    id: string
    role: ChatRole
    text: string
    ts: number
}

const AGENTSCOPE_NOISE_LINES = new Set([
    'IMPORTANT: You are running inside AgentScope, an AI agent orchestrator.',
    'After completing each major step, output a status update in this EXACT JSON format on its own line:',
    '{"agentscope_status": "<status>", "phase": "<phase>", "summary": "<brief summary>"}',
    'Status values: "running", "awaiting_input", "awaiting_review", "awaiting_confirm", "completed", "failed"',
    'Phase values: "analyzing", "generating", "editing", "testing", "reviewing", "waiting", "error"',
    'Example: {"agentscope_status": "completed", "phase": "editing", "summary": "Fixed the login bug"}'
])

function stripAgentScopeNoise(text: string): string {
    if (!text) return text
    const statusLine = /^Status:\s+\w+(?:\s+\([^)]+\))?\s*$/
    const powershellPrompt = /^PS [A-Za-z]:\\.*>.*$/
    const codexPrompt = /^>_\s*/
    const cliBanner = /(OpenAI Codex|model:|directory:|Tip: Paste an image)/i
    const lines = text.split(/\r?\n/)
    const kept = lines.filter(line => {
        const trimmed = line.trim()
        if (!trimmed) return true
        if (AGENTSCOPE_NOISE_LINES.has(trimmed)) return false
        if (trimmed.includes('"agentscope_status"')) return false
        if (statusLine.test(trimmed)) return false
        if (powershellPrompt.test(trimmed)) return false
        if (codexPrompt.test(trimmed)) return false
        if (cliBanner.test(trimmed)) return false
        return true
    })
    return kept.join('\n').replace(/\n{3,}/g, '\n\n')
}

const STATUS_DOT: Record<AgentStatus, string> = {
    ready: 'bg-blue-400',
    running: 'bg-green-400',
    awaiting_input: 'bg-amber-400',
    awaiting_review: 'bg-pink-400',
    awaiting_confirm: 'bg-amber-400',
    completed: 'bg-emerald-400',
    failed: 'bg-red-400'
}

const STATUS_LABEL: Record<AgentStatus, string> = {
    ready: 'Ready',
    running: 'Running',
    awaiting_input: 'Awaiting input',
    awaiting_review: 'Awaiting review',
    awaiting_confirm: 'Awaiting confirm',
    completed: 'Completed',
    failed: 'Failed'
}

const STATUS_BADGE: Record<AgentStatus, string> = {
    ready: 'text-blue-300 bg-blue-500/10 border-blue-500/20',
    running: 'text-green-300 bg-green-500/10 border-green-500/20',
    awaiting_input: 'text-amber-300 bg-amber-500/10 border-amber-500/20',
    awaiting_review: 'text-pink-300 bg-pink-500/10 border-pink-500/20',
    awaiting_confirm: 'text-amber-300 bg-amber-500/10 border-amber-500/20',
    completed: 'text-emerald-300 bg-emerald-500/10 border-emerald-500/20',
    failed: 'text-red-300 bg-red-500/10 border-red-500/20'
}

const STATUS_FILTERS: { id: StatusFilter; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'running', label: 'Running' },
    { id: 'awaiting', label: 'Awaiting' },
    { id: 'ready', label: 'Ready' },
    { id: 'completed', label: 'Completed' },
    { id: 'failed', label: 'Failed' }
]

const LAYOUT_OPTIONS: { id: AgentLayout; label: string; icon: typeof LayoutGrid }[] = [
    { id: 'kanban', label: 'Kanban', icon: AlignJustify },
    { id: 'cards', label: 'Cards', icon: LayoutGrid },
    { id: 'list', label: 'List', icon: List }
]

function AgentRow({
    session,
    onStart,
    onStop,
    onRestart,
    onChat,
    onTerminal,
    onRemove
}: {
    session: AgentSession
    onStart?: () => void
    onStop?: () => void
    onRestart?: () => void
    onChat?: () => void
    onTerminal?: () => void
    onRemove?: () => void
}) {
    const isActive = session.status === 'running' || session.status.startsWith('awaiting')
    const statusLabel = `Status: ${STATUS_LABEL[session.status]} (${session.phase})`
    const terminalAvailable = !!session.terminalId

    return (
        <div className="group flex items-center justify-between gap-3 rounded-xl border border-white/5 bg-white/[0.02] px-3 py-2 transition-colors hover:bg-white/[0.04]">
            <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-lg bg-white/5 border border-white/5 flex items-center justify-center flex-shrink-0">
                    <ToolIcon tool={session.agentId} size={18} />
                </div>
                <div className="min-w-0">
                    <h4 className="text-sm font-medium text-white truncate">{session.agentName}</h4>
                    <div className="flex items-center gap-2 text-xs text-white/50">
                        <span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[session.status]}`} />
                        <span className="truncate">{statusLabel}</span>
                    </div>
                </div>
            </div>
            <div className="flex items-center gap-1">
                {session.status === 'ready' && (
                    <button
                        onClick={onStart}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-green-500/10 hover:bg-green-500/20 text-green-400 text-[11px] font-medium transition-colors"
                    >
                        <Play size={12} /> Start
                    </button>
                )}
                {isActive && (
                    <button
                        onClick={onStop}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 text-[11px] font-medium transition-colors"
                    >
                        <Square size={12} /> Stop
                    </button>
                )}
                {(session.status === 'completed' || session.status === 'failed') && (
                    <button
                        onClick={onRestart}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 text-[11px] font-medium transition-colors"
                    >
                        <RotateCw size={12} /> Restart
                    </button>
                )}
                {onChat && (
                    <button
                        onClick={onChat}
                        className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/40 hover:text-white/70 transition-colors"
                        title="Open chat"
                    >
                        <MessageCircle size={12} />
                    </button>
                )}
                {onTerminal && (
                    <button
                        onClick={terminalAvailable ? onTerminal : undefined}
                        className={`p-2 rounded-lg transition-colors ${terminalAvailable ? "bg-white/5 hover:bg-white/10 text-white/40 hover:text-white/70" : "bg-white/5 text-white/20 cursor-not-allowed"}`}
                        title={terminalAvailable ? "Open terminal" : "Terminal not started"}
                        disabled={!terminalAvailable}
                    >
                        <Terminal size={12} />
                    </button>
                )}
                {onRemove && (
                    <button
                        onClick={onRemove}
                        className="p-2 rounded-lg hover:bg-white/10 text-white/20 hover:text-white/60 transition-colors"
                        title="Remove session"
                    >
                        <X size={12} />
                    </button>
                )}
            </div>
        </div>
    )
}

function AgentCard({
    session,
    onStart,
    onStop,
    onRestart,
    onChat,
    onTerminal,
    onRemove
}: {
    session: AgentSession
    onStart?: () => void
    onStop?: () => void
    onRestart?: () => void
    onChat?: () => void
    onTerminal?: () => void
    onRemove?: () => void
}) {
    const isActive = session.status === 'running' || session.status.startsWith('awaiting')
    const terminalAvailable = !!session.terminalId

    return (
        <div className="group rounded-2xl border border-white/5 bg-white/[0.02] p-4 shadow-sm transition-colors hover:bg-white/[0.04]">
            <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/5 flex items-center justify-center flex-shrink-0">
                        <ToolIcon tool={session.agentId} size={20} />
                    </div>
                    <div className="min-w-0">
                        <h4 className="text-sm font-semibold text-white truncate">{session.agentName}</h4>
                        <p className="text-[11px] text-white/40 truncate">{session.cwd || 'No working directory'}</p>
                    </div>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-[10px] uppercase border ${STATUS_BADGE[session.status]}`}>
                    {STATUS_LABEL[session.status]}
                </span>
            </div>

            <div className="mt-3 flex items-center justify-between text-xs text-white/50">
                <div className="flex items-center gap-2">
                    <span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[session.status]}`} />
                    <span>Phase: {session.phase}</span>
                </div>
                {session.startedAt && isActive && (
                    <span className="text-[10px] text-white/30">Active</span>
                )}
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2">
                {session.status === 'ready' && (
                    <button
                        onClick={onStart}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-green-500/10 hover:bg-green-500/20 text-green-300 text-[11px] font-medium transition-colors"
                    >
                        <Play size={12} /> Start
                    </button>
                )}
                {isActive && (
                    <button
                        onClick={onStop}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-300 text-[11px] font-medium transition-colors"
                    >
                        <Square size={12} /> Stop
                    </button>
                )}
                {(session.status === 'completed' || session.status === 'failed') && (
                    <button
                        onClick={onRestart}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 text-blue-300 text-[11px] font-medium transition-colors"
                    >
                        <RotateCw size={12} /> Restart
                    </button>
                )}
                {onChat && (
                    <button
                        onClick={onChat}
                        className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/50 hover:text-white transition-colors"
                        title="Open chat"
                    >
                        <MessageCircle size={12} />
                    </button>
                )}
                {onTerminal && (
                    <button
                        onClick={terminalAvailable ? onTerminal : undefined}
                        className={`p-2 rounded-lg transition-colors ${terminalAvailable ? "bg-white/5 hover:bg-white/10 text-white/50 hover:text-white" : "bg-white/5 text-white/20 cursor-not-allowed"}`}
                        title={terminalAvailable ? "Open terminal" : "Terminal not started"}
                        disabled={!terminalAvailable}
                    >
                        <Terminal size={12} />
                    </button>
                )}
                {onRemove && (
                    <button
                        onClick={onRemove}
                        className="p-2 rounded-lg hover:bg-white/10 text-white/20 hover:text-white/60 transition-colors"
                        title="Remove session"
                    >
                        <X size={12} />
                    </button>
                )}
            </div>
        </div>
    )
}

type KanbanColumn = 'ready' | 'running' | 'awaiting' | 'reviewing' | 'completed' | 'failed'

function getKanbanColumn(status: AgentStatus): KanbanColumn {
    switch (status) {
        case 'ready': return 'ready'
        case 'running': return 'running'
        case 'awaiting_input':
        case 'awaiting_confirm': return 'awaiting'
        case 'awaiting_review': return 'reviewing'
        case 'completed': return 'completed'
        case 'failed': return 'failed'
        default: return 'ready'
    }
}

const KANBAN_COLUMNS: { id: KanbanColumn; label: string }[] = [
    { id: 'ready', label: 'Ready' },
    { id: 'running', label: 'Running' },
    { id: 'awaiting', label: 'Awaiting' },
    { id: 'reviewing', label: 'Review' },
    { id: 'completed', label: 'Completed' },
    { id: 'failed', label: 'Failed' }
]

// Agent Picker Modal
function AgentPickerModal({
    isOpen,
    onClose,
    onSelect,
    installedAgents
}: {
    isOpen: boolean
    onClose: () => void
    onSelect: (agent: { id: string; name: string }) => void
    installedAgents: any[]
}) {
    if (!isOpen) return null

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
            <div className="relative w-full max-w-md bg-sparkle-card border border-white/10 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-[var(--accent-primary)]/10">
                            <Sparkles size={18} className="text-[var(--accent-primary)]" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-white">Add Agent</h2>
                            <p className="text-xs text-white/40">Select an installed AI agent</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10 text-white/40 hover:text-white transition-colors">
                        <X size={18} />
                    </button>
                </div>
                <div className="p-2 max-h-[400px] overflow-y-auto">
                    {installedAgents.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 text-white/30">
                            <Bot size={48} className="mb-4 opacity-50" />
                            <p className="text-sm">No AI agents installed</p>
                            <p className="text-xs mt-1">Install Claude, Gemini, or other AI CLI tools</p>
                        </div>
                    ) : (
                        installedAgents.map(agent => (
                            <button
                                key={agent.id || agent.tool}
                                onClick={() => {
                                    onSelect({ id: agent.id || agent.tool, name: agent.displayName })
                                    onClose()
                                }}
                                className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-white/5 transition-colors text-left group"
                            >
                                <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center border border-white/5">
                                    <ToolIcon tool={agent.id || agent.tool} size={24} />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h4 className="text-sm font-medium text-white group-hover:text-[var(--accent-primary)] transition-colors">
                                        {agent.displayName}
                                    </h4>
                                    <p className="text-xs text-white/40 truncate">{agent.description}</p>
                                </div>
                                <Plus size={16} className="text-white/20 group-hover:text-white/40" />
                            </button>
                        ))
                    )}
                </div>
            </div>
        </div>
    )
}

// Main AgentScope Page
export default function AgentScope() {
    const [sessions, setSessions] = useState<AgentSession[]>([])
    const [showPicker, setShowPicker] = useState(false)
    const [loading, setLoading] = useState(true)
    const [expandedSessionId, setExpandedSessionId] = useState<string | null>(null)
    const [directoryPicker, setDirectoryPicker] = useState<{ sessionId: string; mode: 'start' | 'restart' } | null>(null)
    const [chatSessionId, setChatSessionId] = useState<string | null>(null)
    const [sessionMessages, setSessionMessages] = useState<Record<string, ChatMessage[]>>({})
    const [pendingSessions, setPendingSessions] = useState<Record<string, boolean>>({})
    const [layout, setLayout] = useState<AgentLayout>('list')
    const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
    const [apiAvailable, setApiAvailable] = useState(false)
    const queuedMessagesRef = useRef<Record<string, string[]>>({})

    const aiAgentsData = getCache('aiAgents') as { agents?: any[] } | null
    const installedAgents = aiAgentsData?.agents?.filter((a: any) => a.installed) || []

    const appendMessage = useCallback((sessionId: string, role: ChatRole, text: string) => {
        if (!text) return
        setSessionMessages(prev => {
            const current = prev[sessionId] ? [...prev[sessionId]] : []
            const last = current[current.length - 1]
            if (last && last.role === role && role === 'assistant') {
                const merged = { ...last, text: last.text + text, ts: Date.now() }
                current[current.length - 1] = merged
            } else {
                current.push({
                    id: `${sessionId}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
                    role,
                    text,
                    ts: Date.now()
                })
            }
            return { ...prev, [sessionId]: current.slice(-500) }
        })
    }, [])

    const setPending = useCallback((sessionId: string, pending: boolean) => {
        setPendingSessions(prev => {
            if (prev[sessionId] === pending) return prev
            return { ...prev, [sessionId]: pending }
        })
    }, [])

    const seedMessages = useCallback((session: AgentSession | null) => {
        if (!session) return
        setSessionMessages(prev => {
            if (prev[session.id]?.length) return prev
            if (!session.outputHistory?.length) return prev
            const seededText = stripAgentScopeNoise(session.outputHistory.join('\n'))
            if (!seededText.trim()) return prev
            return {
                ...prev,
                [session.id]: [{
                    id: `${session.id}_seed_${Date.now()}`,
                    role: 'assistant',
                    text: seededText,
                    ts: session.lastActivity
                }]
            }
        })
    }, [])

    const mapHistoryMessages = useCallback((items: any[]): ChatMessage[] => {
        return items.map((item, index) => {
            const type = item?.type || 'output'
            const role: ChatRole =
                type === 'user' ? 'user' :
                    type === 'system' ? 'system' :
                        type === 'status' || type === 'created' ? 'status' : 'assistant'
            const text = item?.text
                || item?.message
                || (item?.status ? `Status: ${item.status}${item.phase ? ` (${item.phase})` : ''}` : '')
                || ''
            const cleanedText = role === 'assistant' ? stripAgentScopeNoise(text) : text
            return {
                id: `${item?.ts || Date.now()}_${index}`,
                role,
                text: cleanedText,
                ts: item?.ts || Date.now()
            }
        }).filter(item => item.text && item.text.trim())
    }, [])

    // Check API availability
    useEffect(() => {
        setApiAvailable(!!window.devscope?.agentscope)
    }, [])

    // Load existing sessions
    useEffect(() => {
        const loadSessions = async () => {
            if (!window.devscope?.agentscope) {
                console.warn('[AgentScope] API not available')
                setLoading(false)
                return
            }
            try {
                const result = await window.devscope.agentscope.list()
                if (result.success && result.sessions) {
                    setSessions(result.sessions)
                }
            } catch (err) {
                console.error('[AgentScope] Failed to load sessions:', err)
            } finally {
                setLoading(false)
            }
        }
        loadSessions()
    }, [])

    // Subscribe to events
    useEffect(() => {
        if (!window.devscope?.agentscope) return

        const cleanupFns: (() => void)[] = []

        cleanupFns.push(
            window.devscope.agentscope.onSessionUpdated(({ session }) => {
                setSessions(prev => prev.map(s => s.id === session.id ? session : s))
            })
        )

        cleanupFns.push(
            window.devscope.agentscope.onSessionClosed(({ sessionId }) => {
                appendMessage(sessionId, 'status', 'Session closed')
                setSessions(prev => prev.map(s =>
                    s.id === sessionId ? { ...s, status: 'completed' as AgentStatus } : s
                ))
            })
        )

        cleanupFns.push(
            window.devscope.agentscope.onOutput(({ sessionId, data }) => {
                const cleaned = stripAgentScopeNoise(data)
                if (!cleaned.trim()) {
                    return
                }
                setPending(sessionId, false)
                appendMessage(sessionId, 'assistant', cleaned)
                setSessions(prev => prev.map(s => {
                    if (s.id !== sessionId) return s
                    const lines = cleaned.split('\n').filter(l => l.trim())
                    return {
                        ...s,
                        outputHistory: [...s.outputHistory.slice(-95), ...lines].slice(-100),
                        lastActivity: Date.now()
                    }
                }))
            })
        )

        cleanupFns.push(
            window.devscope.agentscope.onStatusChange(({ sessionId, status, phase }) => {
                if (status !== 'running') {
                    setPending(sessionId, false)
                }
                setSessions(prev => prev.map(s => {
                    if (s.id !== sessionId) return s
                    return { ...s, status: status as AgentStatus, phase: (phase || 'idle') as AgentPhase }
                }))
            })
        )

        return () => cleanupFns.forEach(fn => fn())
    }, [appendMessage, setPending])

    const handleAddSession = useCallback(async (agent: { id: string; name: string }) => {
        if (!window.devscope?.agentscope) return
        try {
            const result = await window.devscope.agentscope.create({
                agentId: agent.id,
                cwd: undefined,
                autoStart: false
            })
            if (result.success && result.session) {
                setSessions(prev => [...prev, result.session])
            }
        } catch (err) {
            console.error('[AgentScope] Failed to create session:', err)
        }
    }, [])

    const handleSessionAction = useCallback(async (sessionId: string, action: string) => {
        if (!window.devscope?.agentscope) return
        try {
            switch (action) {
                case 'start': {
                    setDirectoryPicker({ sessionId, mode: 'start' })
                    break
                }
                case 'stop': {
                    await window.devscope.agentscope.kill(sessionId)
                    setPending(sessionId, false)
                    setSessions(prev => prev.map(s =>
                        s.id === sessionId
                            ? { ...s, status: 'completed' as AgentStatus, endedAt: Date.now(), phase: 'idle' as AgentPhase }
                            : s
                    ))
                    break
                }
                case 'restart': {
                    setDirectoryPicker({ sessionId, mode: 'restart' })
                    break
                }
                case 'terminal': {
                    setExpandedSessionId(sessionId)
                    break
                }
                case 'remove': {
                    await window.devscope.agentscope.remove(sessionId)
                    setPending(sessionId, false)
                    queuedMessagesRef.current[sessionId] = []
                    setSessions(prev => prev.filter(s => s.id !== sessionId))
                    setSessionMessages(prev => {
                        if (!prev[sessionId]) return prev
                        const next = { ...prev }
                        delete next[sessionId]
                        return next
                    })
                    break
                }
                case 'chat': {
                    const session = sessions.find(s => s.id === sessionId) || null
                    try {
                        const history = await window.devscope.agentscope.history(sessionId)
                        if (history?.success && Array.isArray(history.messages) && history.messages.length > 0) {
                            setSessionMessages(prev => ({
                                ...prev,
                                [sessionId]: mapHistoryMessages(history.messages)
                            }))
                        } else {
                            seedMessages(session)
                        }
                    } catch {
                        seedMessages(session)
                    }
                    setChatSessionId(sessionId)
                    break
                }
            }
        } catch (err) {
            console.error(`[AgentScope] Action ${action} failed:`, err)
        }
    }, [mapHistoryMessages, seedMessages, sessions, setPending])

    const expandedSession = expandedSessionId
        ? sessions.find(s => s.id === expandedSessionId) || null
        : null

    const directoryPickerSession = directoryPicker
        ? sessions.find(s => s.id === directoryPicker.sessionId) || null
        : null

    const chatSession = chatSessionId
        ? sessions.find(s => s.id === chatSessionId) || null
        : null

    const chatMessages = chatSessionId ? (sessionMessages[chatSessionId] || []) : []
    const chatWaiting = chatSessionId ? !!pendingSessions[chatSessionId] : false

    const handleCloseDirectoryPicker = useCallback(() => {
        if (directoryPicker) {
            setPending(directoryPicker.sessionId, false)
            queuedMessagesRef.current[directoryPicker.sessionId] = []
        }
        setDirectoryPicker(null)
    }, [directoryPicker, setPending])

    const handleConfirmDirectory = useCallback(async (cwd: string) => {
        if (!directoryPicker || !window.devscope?.agentscope) return
        const { sessionId, mode } = directoryPicker
        setDirectoryPicker(null)

        try {
            if (mode === 'restart') {
                await window.devscope.agentscope.kill(sessionId)
            }

            const result = await window.devscope.agentscope.start(sessionId, { cwd })
            if (result.success) {
                setSessions(prev => prev.map(s =>
                    s.id === sessionId
                        ? {
                            ...s,
                            cwd,
                            status: 'running' as AgentStatus,
                            startedAt: Date.now(),
                            endedAt: mode === 'restart' ? undefined : s.endedAt,
                            phase: 'analyzing' as AgentPhase,
                            outputHistory: mode === 'restart' ? [] : s.outputHistory
                        }
                        : s
                ))
                const queued = queuedMessagesRef.current[sessionId] || []
                if (queued.length > 0) {
                    queuedMessagesRef.current[sessionId] = []
                    setTimeout(() => {
                        queued.forEach(message => {
                            window.devscope?.agentscope?.sendMessage(sessionId, message)
                        })
                    }, 500)
                }
            }
        } catch (err) {
            console.error('[AgentScope] Failed to start session:', err)
        }
    }, [directoryPicker])

    const handleSendMessage = useCallback(async (sessionId: string, message: string) => {
        if (!window.devscope?.agentscope) return
        const session = sessions.find(s => s.id === sessionId)
        appendMessage(sessionId, 'user', message)
        setPending(sessionId, true)
        if (session?.status === 'ready') {
            queuedMessagesRef.current[sessionId] = [
                ...(queuedMessagesRef.current[sessionId] || []),
                message
            ]
            setDirectoryPicker({ sessionId, mode: 'start' })
            return
        }
        if (session?.status === 'completed' || session?.status === 'failed') {
            queuedMessagesRef.current[sessionId] = [
                ...(queuedMessagesRef.current[sessionId] || []),
                message
            ]
            setDirectoryPicker({ sessionId, mode: 'restart' })
            return
        }
        try {
            const result = await window.devscope.agentscope.sendMessage(sessionId, message)
            if (!result?.success) {
                setPending(sessionId, false)
                appendMessage(sessionId, 'assistant', 'Failed to send message.')
            }
        } catch (err) {
            setPending(sessionId, false)
            appendMessage(sessionId, 'assistant', 'Failed to send message.')
            console.error('[AgentScope] Send message failed:', err)
        }
    }, [appendMessage, sessions, setPending])

    const displaySessions = [...sessions].sort((a, b) => b.lastActivity - a.lastActivity)
    const filteredSessions = displaySessions.filter(session => {
        switch (statusFilter) {
            case 'all':
                return true
            case 'running':
                return session.status === 'running'
            case 'awaiting':
                return session.status.startsWith('awaiting')
            case 'ready':
                return session.status === 'ready'
            case 'completed':
                return session.status === 'completed'
            case 'failed':
                return session.status === 'failed'
            default:
                return true
        }
    })
    const lastActiveWithTerminal = displaySessions.find(session => !!session.terminalId) || null

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 size={32} className="text-[var(--accent-primary)] animate-spin" />
            </div>
        )
    }

    return (
        <div className="max-w-[1600px] mx-auto animate-fadeIn pb-10">
            {/* Hero Header */}
            <div className="relative mb-8 overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-purple-500/[0.07] via-transparent to-pink-500/[0.05] rounded-2xl" />
                <div className="absolute top-0 right-0 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />

                <div className="relative p-6">
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-4">
                            <div className="relative">
                                <div className="absolute inset-0 bg-purple-500/20 rounded-full blur-lg" />
                                <div className="relative w-14 h-14 rounded-full bg-gradient-to-br from-purple-500/20 to-pink-500/10 border border-purple-500/20 flex items-center justify-center">
                                    <Layers className="text-purple-400" size={26} />
                                </div>
                            </div>
                            <div>
                                <div className="flex items-center gap-3">
                                    <h1 className="text-2xl font-bold text-white tracking-tight">AgentScope</h1>
                                    <span className="px-2.5 py-1 text-[10px] font-bold uppercase bg-amber-500/15 text-amber-400 rounded-lg border border-amber-500/20 flex items-center gap-1">
                                        <FlaskConical size={10} />
                                        Alpha
                                    </span>
                                </div>
                                <p className="text-sm text-white/40 mt-0.5 flex items-center gap-2">
                                    <span className={`w-1.5 h-1.5 rounded-full ${apiAvailable ? "bg-green-400 animate-pulse" : "bg-red-400"}`} />
                                    Run multiple AI agents in parallel
                                </p>
                            </div>
                        </div>

                        <button
                            onClick={() => setShowPicker(true)}
                            className="flex items-center gap-2 px-4 py-2.5 text-white bg-[var(--accent-primary)] hover:bg-[var(--accent-primary)]/80 rounded-xl transition-colors shadow-lg shadow-[var(--accent-primary)]/20"
                        >
                            <Plus size={18} />
                            <span className="text-sm font-medium">New Agent</span>
                        </button>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 border-t border-white/5 pt-4">
                        <div className="flex items-center gap-1 bg-white/5 border border-white/10 rounded-xl p-1">
                            {LAYOUT_OPTIONS.map(option => (
                                <button
                                    key={option.id}
                                    onClick={() => setLayout(option.id)}
                                    className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-colors ${layout === option.id ? "bg-white/10 text-white" : "text-white/50 hover:text-white"}`}
                                >
                                    <option.icon size={14} />
                                    {option.label}
                                </button>
                            ))}
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                            {STATUS_FILTERS.map(filter => (
                                <button
                                    key={filter.id}
                                    onClick={() => setStatusFilter(filter.id)}
                                    className={`px-3 py-1 rounded-full text-[11px] border transition-colors ${statusFilter === filter.id ? "bg-white/10 text-white border-white/20" : "text-white/40 border-white/10 hover:text-white hover:border-white/20"}`}
                                >
                                    {filter.label}
                                </button>
                            ))}
                        </div>

                        <div className="flex items-center gap-2 sm:ml-auto">
                            <button
                                onClick={lastActiveWithTerminal ? () => setExpandedSessionId(lastActiveWithTerminal.id) : undefined}
                                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-[11px] border transition-colors ${lastActiveWithTerminal ? "bg-white/5 border-white/10 text-white/70 hover:text-white hover:border-white/20" : "bg-white/5 border-white/5 text-white/20 cursor-not-allowed"}`}
                                disabled={!lastActiveWithTerminal}
                            >
                                <Terminal size={14} />
                                Terminal
                            </button>
                        </div>
                    </div>

                </div>
            </div>

            {/* API Warning */}
            {!apiAvailable && (
                <div className="mb-6 p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-center gap-3">
                    <AlertTriangle size={20} className="text-amber-400" />
                    <div>
                        <p className="text-sm text-amber-300 font-medium">AgentScope API not available</p>
                        <p className="text-xs text-amber-400/60">Restart the application to enable agent features</p>
                    </div>
                </div>
            )}

            {/* Layout Views */}
            {filteredSessions.length > 0 && layout === 'list' && (
                <div className="space-y-2">
                    {filteredSessions.map(session => (
                        <AgentRow
                            key={session.id}
                            session={session}
                            onStart={() => handleSessionAction(session.id, 'start')}
                            onStop={() => handleSessionAction(session.id, 'stop')}
                            onRestart={() => handleSessionAction(session.id, 'restart')}
                            onChat={() => handleSessionAction(session.id, 'chat')}
                            onTerminal={() => handleSessionAction(session.id, 'terminal')}
                            onRemove={() => handleSessionAction(session.id, 'remove')}
                        />
                    ))}
                </div>
            )}

            {filteredSessions.length > 0 && layout === 'cards' && (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {filteredSessions.map(session => (
                        <AgentCard
                            key={session.id}
                            session={session}
                            onStart={() => handleSessionAction(session.id, 'start')}
                            onStop={() => handleSessionAction(session.id, 'stop')}
                            onRestart={() => handleSessionAction(session.id, 'restart')}
                            onChat={() => handleSessionAction(session.id, 'chat')}
                            onTerminal={() => handleSessionAction(session.id, 'terminal')}
                            onRemove={() => handleSessionAction(session.id, 'remove')}
                        />
                    ))}
                </div>
            )}

            {filteredSessions.length > 0 && layout === 'kanban' && (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {KANBAN_COLUMNS.map(column => {
                        const columnSessions = filteredSessions.filter(session => getKanbanColumn(session.status) === column.id)
                        return (
                            <div key={column.id} className="rounded-xl border border-white/5 bg-white/[0.02] overflow-hidden">
                                <div className="flex items-center justify-between px-3 py-2 border-b border-white/5 bg-white/[0.02]">
                                    <h3 className="text-xs font-semibold text-white/70">{column.label}</h3>
                                    <span className="px-2 py-0.5 rounded-full text-[10px] text-white/50 border border-white/10">
                                        {columnSessions.length}
                                    </span>
                                </div>
                                <div className="p-2 space-y-2 max-h-[520px] overflow-y-auto">
                                    {columnSessions.length === 0 ? (
                                        <div className="text-[11px] text-white/30 text-center py-6">
                                            No agents
                                        </div>
                                    ) : (
                                        columnSessions.map(session => (
                                            <AgentCard
                                                key={session.id}
                                                session={session}
                                                onStart={() => handleSessionAction(session.id, 'start')}
                                                onStop={() => handleSessionAction(session.id, 'stop')}
                                                onRestart={() => handleSessionAction(session.id, 'restart')}
                                                onChat={() => handleSessionAction(session.id, 'chat')}
                                                onTerminal={() => handleSessionAction(session.id, 'terminal')}
                                                onRemove={() => handleSessionAction(session.id, 'remove')}
                                            />
                                        ))
                                    )}
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}

            {/* Filter Empty State */}
            {filteredSessions.length === 0 && sessions.length > 0 && (
                <div className="flex flex-col items-center justify-center py-12 mt-4 bg-white/[0.02] rounded-2xl border border-dashed border-white/10">
                    <h3 className="text-sm font-semibold text-white/60 mb-2">No agents match this filter</h3>
                    <p className="text-xs text-white/40 mb-4 text-center max-w-md">
                        Try a different status filter or switch layouts to find the session you need.
                    </p>
                    <button
                        onClick={() => setStatusFilter('all')}
                        className="px-4 py-2 rounded-lg text-xs border border-white/20 text-white/70 hover:text-white hover:border-white/40 transition-colors"
                    >
                        Clear Filters
                    </button>
                </div>
            )}

            {/* Empty State */}
            {sessions.length === 0 && (
                <div className="flex flex-col items-center justify-center py-16 mt-6 bg-white/[0.02] rounded-2xl border border-dashed border-white/10">
                    <div className="p-4 rounded-2xl bg-white/5 mb-4">
                        <Bot size={48} className="text-white/20" />
                    </div>
                    <h3 className="text-lg font-semibold text-white/60 mb-2">No Agent Sessions</h3>
                    <p className="text-sm text-white/40 mb-6 text-center max-w-md">
                        Create your first AI agent session to start running Claude, Gemini, Codex, or other AI tools in parallel.
                    </p>
                    <button
                        onClick={() => setShowPicker(true)}
                        className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[var(--accent-primary)]/10 hover:bg-[var(--accent-primary)]/20 text-[var(--accent-primary)] text-sm font-medium transition-colors border border-[var(--accent-primary)]/30"
                    >
                        <Plus size={18} />
                        Add Your First Agent
                    </button>
                </div>
            )}

            {/* Modals */}
            <AgentPickerModal
                isOpen={showPicker}
                onClose={() => setShowPicker(false)}
                onSelect={handleAddSession}
                installedAgents={installedAgents}
            />

            <AgentTerminalModal
                isOpen={expandedSession !== null}
                onClose={() => setExpandedSessionId(null)}
                session={expandedSession}
            />

            <AgentDirectoryModal
                isOpen={directoryPicker !== null}
                onClose={handleCloseDirectoryPicker}
                onConfirm={handleConfirmDirectory}
                initialPath={directoryPickerSession?.cwd}
            />

            <AgentChatModal
                isOpen={chatSession !== null}
                onClose={() => setChatSessionId(null)}
                onShowTerminal={chatSession ? () => setExpandedSessionId(chatSession.id) : undefined}
                onSend={(message) => chatSession && handleSendMessage(chatSession.id, message)}
                session={chatSession}
                messages={chatMessages}
                isWaiting={chatWaiting}
            />
        </div>
    )
}
