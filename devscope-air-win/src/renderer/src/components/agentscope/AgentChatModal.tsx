/**
 * AgentChatModal - UI-first chat view for agent sessions (no terminal by default)
 */

import { useEffect, useRef, useState } from 'react'
import { X, MessageCircle, Terminal, Loader2, User, ArrowUpRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import ToolIcon from '@/components/ui/ToolIcon'

type ChatRole = 'system' | 'user' | 'assistant' | 'status'

interface ChatMessage {
    id: string
    role: ChatRole
    text: string
    ts: number
}

interface AgentSession {
    id: string
    agentId: string
    agentName: string
    status: string
    phase: string
    cwd: string
    terminalId?: string
}

interface AgentChatModalProps {
    isOpen: boolean
    onClose: () => void
    onShowTerminal?: () => void
    onSend: (message: string) => void
    session: AgentSession | null
    messages: ChatMessage[]
    isWaiting?: boolean
}

export default function AgentChatModal({
    isOpen,
    onClose,
    onShowTerminal,
    onSend,
    session,
    messages,
    isWaiting
}: AgentChatModalProps) {
    const [draft, setDraft] = useState('')
    const scrollRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        if (!isOpen) return
        setDraft('')
    }, [isOpen])

    useEffect(() => {
        if (!scrollRef.current) return
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }, [messages, isOpen])

    if (!isOpen || !session) return null

    const handleSend = () => {
        const trimmed = draft.trim()
        if (!trimmed) return
        onSend(trimmed)
        setDraft('')
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

            <div className={cn(
                "relative w-[94vw] max-w-5xl h-[80vh]",
                "bg-[#0b0f1a] border border-white/10 rounded-3xl shadow-2xl overflow-hidden flex flex-col"
            )}>
                <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 bg-gradient-to-r from-white/5 via-transparent to-white/5">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-white/10 border border-white/10 flex items-center justify-center">
                            <ToolIcon tool={session.agentId} size={20} />
                        </div>
                        <div>
                            <h2 className="text-sm font-semibold text-white">{session.agentName}</h2>
                            <p className="text-[10px] text-white/40 font-mono truncate max-w-[320px]">{session.cwd || 'No working directory'}</p>
                        </div>
                        <div className="flex items-center gap-2 text-[10px] text-white/60">
                            <span className="px-2 py-0.5 rounded-full border border-white/15 bg-white/5 uppercase tracking-wide">
                                {session.status}
                            </span>
                            <span className="text-white/40">Phase: {session.phase}</span>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        {onShowTerminal && (
                            <button
                                onClick={onShowTerminal}
                                className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-colors"
                                title="Show terminal"
                            >
                                <Terminal size={16} />
                            </button>
                        )}
                        <button
                            onClick={onClose}
                            className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-colors"
                            title="Close"
                        >
                            <X size={16} />
                        </button>
                    </div>
                </div>

                <div className="flex-1 min-h-0">
                    <div
                        ref={scrollRef}
                        className="h-full overflow-y-auto px-6 py-5 space-y-4 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.06),_transparent_55%)]"
                    >
                        {messages.filter(msg => msg.role !== 'system' && msg.role !== 'status').length === 0 && (
                            <div className="text-xs text-white/40 flex items-center gap-2">
                                <MessageCircle size={14} />
                                No messages yet. Send a prompt to start.
                            </div>
                        )}
                        {messages
                            .filter(msg => msg.role !== 'system' && msg.role !== 'status')
                            .map(msg => {
                                const isUser = msg.role === 'user'
                                return (
                                    <div
                                        key={msg.id}
                                        className={cn(
                                            "flex items-start gap-3",
                                            isUser ? "justify-end" : "justify-start"
                                        )}
                                    >
                                        {!isUser && (
                                            <div className="w-8 h-8 rounded-lg bg-white/10 border border-white/10 flex items-center justify-center flex-shrink-0">
                                                <ToolIcon tool={session.agentId} size={16} />
                                            </div>
                                        )}
                                        <div
                                            className={cn(
                                                "max-w-[78%] rounded-2xl px-4 py-3 text-xs leading-relaxed whitespace-pre-wrap shadow-sm",
                                                isUser
                                                    ? "bg-[var(--accent-primary)]/20 text-white border border-[var(--accent-primary)]/30"
                                                    : "bg-white/5 text-white/90 border border-white/10"
                                            )}
                                        >
                                            {msg.text}
                                        </div>
                                        {isUser && (
                                            <div className="w-8 h-8 rounded-lg bg-white/10 border border-white/10 flex items-center justify-center flex-shrink-0">
                                                <User size={14} className="text-white/70" />
                                            </div>
                                        )}
                                    </div>
                                )
                            })}
                        {isWaiting && (
                            <div className="flex items-center gap-2 text-xs text-white/50 bg-white/5 border border-white/10 rounded-2xl px-3 py-2 w-fit">
                                <Loader2 size={12} className="animate-spin" />
                                Waiting for response...
                            </div>
                        )}
                    </div>
                </div>

                <div className="px-5 py-4 border-t border-white/10 bg-black/40">
                    <div className="flex items-center gap-2">
                        <div className="flex-1 flex items-center gap-2 bg-white/5 border border-white/10 rounded-full px-4 py-2">
                            <MessageCircle size={14} className="text-white/40" />
                            <input
                                value={draft}
                                onChange={(e) => setDraft(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        e.preventDefault()
                                        handleSend()
                                    }
                                }}
                                placeholder="Send a prompt..."
                                className="flex-1 bg-transparent text-xs text-white placeholder:text-white/30 focus:outline-none"
                            />
                        </div>
                        <button
                            onClick={handleSend}
                            disabled={!draft.trim()}
                            className={`px-4 py-2 rounded-full text-xs font-medium border transition-colors ${draft.trim() ? "bg-[var(--accent-primary)] text-white border-[var(--accent-primary)]/50 hover:bg-[var(--accent-primary)]/80" : "bg-white/5 text-white/30 border-white/10 cursor-not-allowed"}`}
                        >
                            <div className="flex items-center gap-1">
                                Send
                                <ArrowUpRight size={14} />
                            </div>
                        </button>
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-white/30 mt-2">
                        <span>Press Enter to send.</span>
                        {isWaiting && <span>Agent is responding...</span>}
                    </div>
                </div>
            </div>
        </div>
    )
}

