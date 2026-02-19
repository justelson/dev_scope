/**
 * AgentTerminalModal - Full-screen terminal modal for agent interaction
 * 
 * Opens when user clicks "Expand" on an agent card.
 * Allows direct typing to the agent's PTY session.
 */

import { useEffect, useRef, useState } from 'react'
import { Terminal as XTerm } from 'xterm'
import { FitAddon } from 'xterm-addon-fit'
import { X, Maximize2, Minimize2, Keyboard, AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'
import ToolIcon from '@/components/ui/ToolIcon'
import 'xterm/css/xterm.css'

interface AgentSession {
    id: string
    agentId: string
    agentName: string
    status: string
    phase: string
    cwd: string
    terminalId?: string
    outputHistory: string[]
}

interface AgentTerminalModalProps {
    isOpen: boolean
    onClose: () => void
    session: AgentSession | null
}

export default function AgentTerminalModal({ isOpen, onClose, session }: AgentTerminalModalProps) {
    const terminalRef = useRef<HTMLDivElement>(null)
    const xtermRef = useRef<XTerm | null>(null)
    const fitAddonRef = useRef<FitAddon | null>(null)
    const inputEnabledRef = useRef(true) // Use ref to avoid recreating terminal
    const [isFullscreen, setIsFullscreen] = useState(false)
    const [inputEnabled, setInputEnabled] = useState(true)
    const [apiAvailable, setApiAvailable] = useState(false)

    // Sync inputEnabled state to ref
    useEffect(() => {
        inputEnabledRef.current = inputEnabled
    }, [inputEnabled])

    // Check API availability
    useEffect(() => {
        setApiAvailable(!!window.devscope?.agentscope)
    }, [isOpen])

    // Initialize xterm when modal opens
    useEffect(() => {
        if (!isOpen || !terminalRef.current || !session) return

        // Create xterm instance
        const term = new XTerm({
            cursorBlink: true,
            cursorStyle: 'bar',
            fontSize: 14,
            fontFamily: 'JetBrains Mono, Cascadia Code, Consolas, monospace',
            theme: {
                background: '#0c121f',
                foreground: '#e4e4e7',
                cursor: '#8b5cf6',
                cursorAccent: '#0c121f',
                selectionBackground: 'rgba(139, 92, 246, 0.3)',
                black: '#18181b',
                red: '#ef4444',
                green: '#22c55e',
                yellow: '#eab308',
                blue: '#3b82f6',
                magenta: '#a855f7',
                cyan: '#06b6d4',
                white: '#e4e4e7',
                brightBlack: '#3f3f46',
                brightRed: '#f87171',
                brightGreen: '#4ade80',
                brightYellow: '#facc15',
                brightBlue: '#60a5fa',
                brightMagenta: '#c084fc',
                brightCyan: '#22d3ee',
                brightWhite: '#fafafa'
            },
            allowProposedApi: true,
            scrollback: 10000,
            convertEol: true
        })

        const fitAddon = new FitAddon()
        term.loadAddon(fitAddon)

        term.open(terminalRef.current)
        xtermRef.current = term
        fitAddonRef.current = fitAddon

        // Fit after DOM settles
        const fitTimer = setTimeout(() => {
            try {
                fitAddon.fit()
                // Send initial resize to backend
                if (window.devscope?.agentscope) {
                    const dims = fitAddon.proposeDimensions()
                    if (dims) {
                        window.devscope.agentscope.resize(session.id, dims.cols, dims.rows)
                    }
                }
            } catch (e) {
                console.warn('[AgentTerminalModal] Fit failed:', e)
            }
        }, 100)

        // Write existing output history
        if (session.outputHistory?.length > 0) {
            term.writeln('\x1b[90m--- Previous Output ---\x1b[0m')
            session.outputHistory.forEach(line => {
                term.writeln(line)
            })
            term.writeln('\x1b[90m--- Live Output ---\x1b[0m')
        } else {
            term.writeln('\x1b[90m[Waiting for agent output...]\x1b[0m')
        }

        // Handle terminal input - use ref to get current inputEnabled value
        const dataHandler = term.onData((data) => {
            if (!inputEnabledRef.current) {
                console.log('[AgentTerminalModal] Input disabled, ignoring keypress')
                return
            }
            if (window.devscope?.agentscope) {
                window.devscope.agentscope.write(session.id, data)
            } else {
                console.warn('[AgentTerminalModal] API not available for write')
            }
        })

        // Subscribe to output
        let cleanupOutput: (() => void) | undefined
        if (window.devscope?.agentscope) {
            cleanupOutput = window.devscope.agentscope.onOutput(({ sessionId, data }) => {
                if (sessionId === session.id && xtermRef.current) {
                    xtermRef.current.write(data)
                }
            })
        }

        // Resize handler
        const handleResize = () => {
            setTimeout(() => {
                try {
                    fitAddon.fit()
                    if (window.devscope?.agentscope) {
                        const dims = fitAddon.proposeDimensions()
                        if (dims) {
                            window.devscope.agentscope.resize(session.id, dims.cols, dims.rows)
                        }
                    }
                } catch (e) { }
            }, 100)
        }
        window.addEventListener('resize', handleResize)

        // Focus terminal
        term.focus()

        return () => {
            clearTimeout(fitTimer)
            window.removeEventListener('resize', handleResize)
            dataHandler.dispose()
            if (cleanupOutput) cleanupOutput()
            term.dispose()
            xtermRef.current = null
            fitAddonRef.current = null
        }
    }, [isOpen, session?.id]) // Only recreate on modal open/close or session change

    // Refit when fullscreen changes
    useEffect(() => {
        if (fitAddonRef.current && isOpen) {
            setTimeout(() => {
                try {
                    fitAddonRef.current?.fit()
                } catch (e) { }
            }, 100)
        }
    }, [isFullscreen, isOpen])

    // Handle ESC key to close
    useEffect(() => {
        if (!isOpen) return
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                onClose()
            }
        }
        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [isOpen, onClose])

    if (!isOpen || !session) return null

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/80 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Modal */}
            <div className={cn(
                "relative bg-sparkle-card border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col transition-all duration-300",
                isFullscreen
                    ? "fixed inset-4"
                    : "w-[90vw] max-w-5xl h-[80vh]"
            )}>
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-white/[0.02]">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center">
                            <ToolIcon tool={session.agentId} size={20} />
                        </div>
                        <div>
                            <h2 className="text-sm font-semibold text-white">{session.agentName}</h2>
                            <p className="text-[10px] text-white/40 font-mono">{session.cwd || 'No working directory'}</p>
                        </div>
                        <span className={cn(
                            "px-2 py-0.5 rounded text-[10px] font-medium uppercase",
                            session.status === 'running' ? 'text-green-400 bg-green-500/10' :
                                session.status === 'completed' ? 'text-purple-400 bg-purple-500/10' :
                                    session.status === 'failed' ? 'text-red-400 bg-red-500/10' :
                                        'text-blue-400 bg-blue-500/10'
                        )}>
                            {session.status}
                        </span>
                    </div>

                    <div className="flex items-center gap-2">
                        {/* API Warning */}
                        {!apiAvailable && (
                            <span className="text-[10px] text-amber-400 flex items-center gap-1">
                                <AlertTriangle size={12} /> API unavailable
                            </span>
                        )}

                        {/* Input toggle */}
                        <button
                            onClick={() => setInputEnabled(!inputEnabled)}
                            className={cn(
                                "p-2 rounded-lg transition-colors flex items-center gap-2 text-xs",
                                inputEnabled
                                    ? "bg-green-500/10 text-green-400 hover:bg-green-500/20"
                                    : "bg-red-500/10 text-red-400 hover:bg-red-500/20"
                            )}
                            title={inputEnabled ? "Typing enabled - click to disable" : "Typing disabled - click to enable"}
                        >
                            <Keyboard size={14} />
                            {inputEnabled ? "Input On" : "Input Off"}
                        </button>

                        <button
                            onClick={() => setIsFullscreen(!isFullscreen)}
                            className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-colors"
                            title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
                        >
                            {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
                        </button>

                        <button
                            onClick={onClose}
                            className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-colors"
                        >
                            <X size={16} />
                        </button>
                    </div>
                </div>

                {/* Terminal Area */}
                <div className="flex-1 p-2 bg-[#0c121f] overflow-hidden">
                    <div
                        ref={terminalRef}
                        className="h-full w-full"
                        style={{ minHeight: '400px' }}
                    />
                </div>

                {/* Footer */}
                <div className="px-4 py-2 border-t border-white/10 bg-white/[0.02] flex items-center justify-between text-[10px] text-white/40">
                    <span>Session: {session.id} | Terminal: {session.terminalId || 'not started'}</span>
                    <span>
                        {inputEnabled ? 'Type to interact' : 'Input disabled'} • ESC to close
                    </span>
                </div>
            </div>
        </div>
    )
}
