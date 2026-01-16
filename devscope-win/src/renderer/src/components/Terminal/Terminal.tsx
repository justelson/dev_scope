import { useEffect, useRef, useState, useCallback } from 'react'
import { Terminal as XTerm } from 'xterm'
import { FitAddon } from 'xterm-addon-fit'
import { WebLinksAddon } from 'xterm-addon-web-links'
import { Terminal as TerminalIcon, X, Minus, LayoutPanelLeft, Plus, Monitor, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useSettings } from '@/lib/settings'
import 'xterm/css/xterm.css'

interface TerminalProps {
    isOpen: boolean
    isVisible: boolean
    onClose: () => void
    onMinimize: () => void
    contextTool?: { id: string; category: string; displayName: string } | null
    initialCwd?: string | null
    initialCommand?: string | null
    onSessionCountChange?: (count: number) => void
}

interface TerminalSessionState {
    id: string
    name: string
    cwd: string
    shell: string
    status: 'active' | 'exited' | 'error'
    createdAt: number
    lastActivity: number
}

export default function Terminal({ isOpen, isVisible, onClose, onMinimize, contextTool, initialCwd, initialCommand, onSessionCountChange }: TerminalProps) {
    const { settings, updateSettings } = useSettings()

    // Container Refs
    const terminalContainerRef = useRef<HTMLDivElement>(null)
    const xtermRef = useRef<XTerm | null>(null)
    const fitAddonRef = useRef<FitAddon | null>(null)
    const outputCleanupRef = useRef<(() => void) | null>(null)
    const activeSessionIdRef = useRef<string | null>(null)
    const initialCommandRef = useRef<string | null | undefined>(initialCommand)

    const [sessions, setSessions] = useState<TerminalSessionState[]>([])
    const [activeSessionId, setActiveSessionId] = useState<string | null>(null)
    const [isSidebarOpen, setIsSidebarOpen] = useState(true)
    const [height, setHeight] = useState(350)
    const [isResizing, setIsResizing] = useState(false)
    const [hasInitialized, setHasInitialized] = useState(false)
    const [showShellMenu, setShowShellMenu] = useState(false)

    // Context menu state
    const [contextMenu, setContextMenu] = useState<{ x: number; y: number; hasSelection: boolean } | null>(null)

    // Link hover popup state
    const [linkPopup, setLinkPopup] = useState<{ x: number; y: number; url: string } | null>(null)

    const resizeRef = useRef<number>(0)

    // Keep refs in sync with state and props
    useEffect(() => {
        activeSessionIdRef.current = activeSessionId
    }, [activeSessionId])

    useEffect(() => {
        initialCommandRef.current = initialCommand
    }, [initialCommand])

    // Helper to get active session object
    const activeSession = sessions.find(s => s.id === activeSessionId)

    // -- Initialization --

    const initTerminal = useCallback(async () => {
        if (!terminalContainerRef.current || xtermRef.current) return

        // 1. Create XTerm instance with theme from CSS variables
        const term = new XTerm({
            cursorBlink: true,
            fontFamily: "'JetBrains Mono', 'Fira Code', Consolas, monospace",
            fontSize: settings.terminalFontSize || 14,
            scrollback: 10000, // Limit scrollback to prevent memory bloat in long sessions
            fastScrollModifier: 'shift', // Enable fast scrolling with shift
            fastScrollSensitivity: 5,
            rendererType: 'canvas', // Use canvas renderer for better performance
            windowsMode: true,
            allowProposedApi: true,
            theme: {
                background: getComputedStyle(document.documentElement).getPropertyValue('--color-bg').trim() || '#0c121f',
                foreground: getComputedStyle(document.documentElement).getPropertyValue('--color-text').trim() || '#f0f4f8',
                cursor: getComputedStyle(document.documentElement).getPropertyValue('--color-primary').trim() || '#4f90e6',
                cursorAccent: getComputedStyle(document.documentElement).getPropertyValue('--color-bg').trim() || '#0c121f',
                selectionBackground: getComputedStyle(document.documentElement).getPropertyValue('--color-border-secondary').trim() + '80' || '#212f4480',
                black: '#18181b',
                red: '#ef4444',
                green: '#22c55e',
                yellow: '#eab308',
                blue: '#3b82f6',
                magenta: '#a855f7',
                cyan: '#06b6d4',
                white: '#fafafa',
                brightBlack: '#52525b',
                brightRed: '#f87171',
                brightGreen: '#4ade80',
                brightYellow: '#facc15',
                brightBlue: '#60a5fa',
                brightMagenta: '#c084fc',
                brightCyan: '#22d3ee',
                brightWhite: '#ffffff'
            }
        })

        // 2. Addons
        const fitAddon = new FitAddon()
        // WebLinksAddon with custom handler for Ctrl+click
        const webLinksAddon = new WebLinksAddon((event, uri) => {
            // Ctrl+click to directly open the link
            if (event.ctrlKey) {
                window.open(uri, '_blank')
            } else {
                // Show link popup for regular click
                setLinkPopup({
                    x: event.clientX,
                    y: event.clientY,
                    url: uri
                })
            }
        })
        term.loadAddon(fitAddon)
        term.loadAddon(webLinksAddon)

        // 3. Mount
        term.open(terminalContainerRef.current)
        fitAddon.fit()

        xtermRef.current = term
        fitAddonRef.current = fitAddon

        // Focus the terminal to enable input
        setTimeout(() => {
            term.focus()
        }, 100)

        // 4. Handle Clipboard (Copy/Paste)
        term.attachCustomKeyEventHandler((event) => {
            // Ctrl+C - Copy if there's a selection, otherwise let it pass through (for SIGINT)
            if (event.ctrlKey && event.key === 'c' && event.type === 'keydown') {
                const selection = term.getSelection()
                if (selection) {
                    navigator.clipboard.writeText(selection)
                    return false // Prevent default, we handled it
                }
                // No selection - let Ctrl+C pass through for SIGINT
                return true
            }

            // Ctrl+V - Paste
            if (event.ctrlKey && event.key === 'v' && event.type === 'keydown') {
                navigator.clipboard.readText().then(text => {
                    const currentSessionId = activeSessionIdRef.current
                    if (currentSessionId && text) {
                        window.devscope.terminal.write(currentSessionId, text)
                    }
                }).catch(err => console.error('[Terminal] Paste failed:', err))
                return false // Prevent default
            }

            // Ctrl+Shift+C - Always copy (even for SIGINT cases)
            if (event.ctrlKey && event.shiftKey && event.key === 'C' && event.type === 'keydown') {
                const selection = term.getSelection()
                if (selection) {
                    navigator.clipboard.writeText(selection)
                }
                return false
            }

            // Ctrl+Shift+V - Always paste
            if (event.ctrlKey && event.shiftKey && event.key === 'V' && event.type === 'keydown') {
                navigator.clipboard.readText().then(text => {
                    const currentSessionId = activeSessionIdRef.current
                    if (currentSessionId && text) {
                        window.devscope.terminal.write(currentSessionId, text)
                    }
                }).catch(err => console.error('[Terminal] Paste failed:', err))
                return false
            }

            return true // Let other keys pass through
        })

        // 5. Handle Input
        term.onData(async (data) => {
            // Use ref to get current active session (not closure value)
            const currentSessionId = activeSessionIdRef.current
            if (!currentSessionId) {
                console.warn('[Terminal] No active session for input')
                return
            }

            try {
                await window.devscope.terminal.write(currentSessionId, data)
            } catch (err) {
                console.error('[Terminal] Write failed:', err)
            }
        })

        // 5. Handle Resize (debounced to prevent excessive IPC calls)
        term.onResize(({ cols, rows }) => {
            // Debounce resize calls to prevent spam during window drag
            if (resizeRef.current) {
                clearTimeout(resizeRef.current)
            }
            resizeRef.current = window.setTimeout(async () => {
                const currentSessionId = activeSessionIdRef.current
                if (currentSessionId) {
                    try {
                        await window.devscope.terminal.resize(currentSessionId, cols, rows)
                    } catch (err) {
                        console.error('[Terminal] Resize failed:', err)
                    }
                }
            }, 150) // 150ms debounce for better performance
        })

        // 6. Listen for Output - MUST be set up BEFORE creating sessions
        const cleanupOutput = window.devscope.terminal.onOutput(async (payload) => {
            // Write to terminal regardless of active session (for all sessions)
            if (payload.type === 'stdout' || payload.type === 'stderr') {
                // Only write if this is the active session (use ref to get current value)
                if (payload.id === activeSessionIdRef.current && xtermRef.current) {
                    // Use write() directly - xterm handles buffering internally
                    xtermRef.current.write(payload.data)
                }
            } else if (payload.type === 'close') {
                if (payload.id === activeSessionIdRef.current && xtermRef.current) {
                    xtermRef.current.write('\r\n[Session ended]\r\n')
                }
                // Update session status
                setSessions(prev => prev.map(s =>
                    s.id === payload.id ? { ...s, status: 'exited' as const } : s
                ))
            }
        })

        outputCleanupRef.current = cleanupOutput

        // 7. Initial Session or load existing
        try {
            const listResult = await window.devscope.terminal.list()

            // If initialCwd is provided, always create a new session in that directory
            if (initialCwd) {
                console.log('[Terminal] Creating new session with cwd:', initialCwd, 'command:', initialCommand)
                await createSession(undefined, initialCommand)
            } else if (listResult.success && listResult.sessions && listResult.sessions.length > 0) {
                // Reuse existing session only if no specific directory was requested
                setSessions(listResult.sessions)
                const firstSession = listResult.sessions[0]
                setActiveSessionId(firstSession.id)

                // Wait for terminal to be ready, then show banner
                setTimeout(async () => {
                    if (xtermRef.current) {
                        // Clear the terminal completely
                        xtermRef.current.clear()
                        xtermRef.current.write('\x1b[2J\x1b[H') // Clear screen and move to home

                        // Get and display banner immediately
                        try {
                            const bannerResult = await window.devscope.terminal.banner(firstSession.id)
                            if (bannerResult.success && bannerResult.banner) {
                                xtermRef.current.write(bannerResult.banner + '\r\n\r\n')
                            }
                        } catch (e) {
                            // Fallback banner
                            xtermRef.current.write(`\x1b[36m╭─ DevScope Terminal\x1b[0m\r\n`)
                            xtermRef.current.write(`\x1b[36m╰─\x1b[0m \x1b[32mSession restored\x1b[0m\r\n\r\n`)
                        }

                        // Focus the terminal
                        xtermRef.current.focus()
                    }
                }, 100)

                // Then resize and get prompt
                setTimeout(async () => {
                    if (xtermRef.current) {
                        // Trigger a resize to sync pty with actual terminal size
                        await window.devscope.terminal.resize(firstSession.id, term.cols, term.rows)

                        // Send a newline to get a fresh prompt
                        await window.devscope.terminal.write(firstSession.id, '\r')
                    }
                }, 400)
            } else {
                // Create new session with context-aware path
                console.log('[Terminal] Creating initial session with cwd:', initialCwd)
                await createSession(undefined, initialCommand)
            }
        } catch (err) {
            console.error('[Terminal] Initialization failed:', err)
            await createSession(undefined, initialCommand)
        }

        return () => {
            if (outputCleanupRef.current) {
                outputCleanupRef.current()
                outputCleanupRef.current = null
            }
            term.dispose()
            xtermRef.current = null
        }
    }, [settings.terminalFontSize, initialCwd, initialCommand])

    // -- Use Effects --

    useEffect(() => {
        console.log('[Terminal] Init effect:', { isOpen, hasInitialized, hasTerm: !!xtermRef.current })
        if (isOpen && !hasInitialized) {
            console.log('[Terminal] Starting initialization...')
            setHasInitialized(true)
            setTimeout(() => initTerminal(), 100)
        }
    }, [isOpen, hasInitialized, initTerminal])

    // Cleanup on Close - dispose terminal and reset state for fresh re-init
    useEffect(() => {
        if (!isOpen && hasInitialized) {
            console.log('[Terminal] Cleaning up on close');
            // Cleanup the output listener
            if (outputCleanupRef.current) {
                outputCleanupRef.current()
                outputCleanupRef.current = null
            }
            // Dispose xterm
            if (xtermRef.current) {
                xtermRef.current.dispose()
                xtermRef.current = null
            }
            fitAddonRef.current = null
            // Reset initialization flag so terminal re-inits on next open
            setHasInitialized(false)
            // Clear sessions state (backend sessions persist, but UI resyncs on reopen)
            setSessions([])
            setActiveSessionId(null)
            // Clear command refs to prevent re-executing old commands
            initialCommandRef.current = null
            prevCommandRef.current = undefined
            prevCwdRef.current = undefined
            // Reset first render flag for next open
            isFirstRenderRef.current = true
        }
    }, [isOpen, hasInitialized])

    // Fit on Resize, Open, or Visibility change (un-minimize)
    useEffect(() => {
        if (isVisible && xtermRef.current && fitAddonRef.current) {
            setTimeout(async () => {
                fitAddonRef.current?.fit()
                if (activeSessionId && xtermRef.current) {
                    try {
                        await window.devscope.terminal.resize(activeSessionId, xtermRef.current.cols, xtermRef.current.rows)
                        // Focus terminal when opened or resized
                        xtermRef.current.focus()
                    } catch (err) {
                        console.error('[Terminal] Resize failed:', err)
                    }
                }
            }, 50)
        }
    }, [isOpen, isVisible, height, isSidebarOpen, activeSessionId])

    // On Active Session Change
    useEffect(() => {
        if (activeSessionId && xtermRef.current) {
            xtermRef.current.clear()
            xtermRef.current.focus()
        }
    }, [activeSessionId])

    // Update session count
    useEffect(() => {
        if (onSessionCountChange) {
            onSessionCountChange(sessions.length)
        }
    }, [sessions.length, onSessionCountChange])

    // When initialCwd or initialCommand changes while terminal is already initialized, create a new session
    const prevCwdRef = useRef<string | null | undefined>(undefined)
    const prevCommandRef = useRef<string | null | undefined>(undefined)
    const isFirstRenderRef = useRef(true)

    useEffect(() => {
        // Skip the first render to avoid duplicate session creation during initialization
        if (isFirstRenderRef.current) {
            isFirstRenderRef.current = false
            prevCwdRef.current = initialCwd
            prevCommandRef.current = initialCommand
            return
        }

        // Only trigger if terminal is initialized and cwd has actually changed (or new command with same cwd)
        const cwdChanged = initialCwd && initialCwd !== prevCwdRef.current
        const commandChanged = initialCommand && initialCommand !== prevCommandRef.current && initialCwd === prevCwdRef.current

        if (hasInitialized && (cwdChanged || commandChanged)) {
            console.log('[Terminal] Creating new session:', { cwd: initialCwd, command: initialCommand })
            createSession(undefined, initialCommand)
        }
        prevCwdRef.current = initialCwd
        prevCommandRef.current = initialCommand
    }, [initialCwd, initialCommand, hasInitialized])

    // -- Actions --

    const createSession = async (shellType?: 'cmd' | 'powershell', command?: string | null) => {
        // Use provided command or fall back to ref (for closure safety)
        const commandToRun = command ?? initialCommandRef.current
        console.log('[Terminal] createSession called with command:', commandToRun)

        try {
            const shell = shellType || settings.defaultShell

            // Generate a meaningful name based on context
            let sessionName: string | undefined
            if (initialCwd) {
                // Extract folder name from path
                const folderName = initialCwd.split(/[/\\]/).filter(Boolean).pop() || 'Terminal'
                sessionName = folderName
            }

            const result = await window.devscope.terminal.create(sessionName, initialCwd || undefined, shell)

            if (result.success && result.session) {
                setSessions(prev => [...prev, result.session])
                setActiveSessionId(result.session.id)
                // Immediately update ref so input works right away (don't wait for React state update)
                activeSessionIdRef.current = result.session.id

                // Show welcome banner immediately - don't wait for shell
                setTimeout(async () => {
                    if (xtermRef.current) {
                        // Clear terminal first
                        xtermRef.current.clear()
                        xtermRef.current.write('\x1b[2J\x1b[H') // Clear screen and move to home

                        // Get and display banner immediately
                        try {
                            const bannerResult = await window.devscope.terminal.banner(result.session.id)
                            if (bannerResult.success && bannerResult.banner) {
                                xtermRef.current.write(bannerResult.banner + '\r\n\r\n')
                            }
                        } catch (e) {
                            // Fallback banner if IPC fails
                            const folderName = initialCwd?.split(/[/\\]/).filter(Boolean).pop() || 'Terminal'
                            xtermRef.current.write(`\x1b[36m╭─ DevScope Terminal\x1b[0m\r\n`)
                            xtermRef.current.write(`\x1b[36m├─\x1b[0m \x1b[32m${folderName}\x1b[0m\r\n`)
                            xtermRef.current.write(`\x1b[36m╰─\x1b[0m Ready\r\n\r\n`)
                        }

                        // Focus terminal
                        xtermRef.current.focus()
                    }
                }, 100) // Quick initial display

                // Then resize and trigger shell prompt
                setTimeout(async () => {
                    if (xtermRef.current) {
                        // Resize to actual terminal dimensions
                        await window.devscope.terminal.resize(result.session.id, xtermRef.current.cols, xtermRef.current.rows)

                        // Send a newline to get a fresh prompt after the banner
                        await window.devscope.terminal.write(result.session.id, '\r')

                        // If there's an initial command, execute it after prompt appears
                        if (commandToRun) {
                            setTimeout(async () => {
                                console.log('[Terminal] Executing initial command:', commandToRun)
                                await window.devscope.terminal.write(result.session.id, commandToRun + '\r')
                            }, 300) // Wait for prompt to appear
                        }
                    }
                }, 400) // Give shell time to initialize
            } else {
                console.error('[Terminal] Create failed:', result.error)
            }
        } catch (err) {
            console.error('[Terminal] Create error:', err)
        }
    }

    const killSession = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation()

        try {
            await window.devscope.terminal.kill(id)
            setSessions(prev => prev.filter(s => s.id !== id))

            if (activeSessionId === id) {
                setActiveSessionId(null)
                xtermRef.current?.clear()
            }
        } catch (err) {
            console.error('[Terminal] Kill failed:', err)
        }
    }

    // -- Context Menu Handlers --
    const handleContextMenu = useCallback((e: React.MouseEvent) => {
        e.preventDefault()
        const selection = xtermRef.current?.getSelection() || ''
        setContextMenu({
            x: e.clientX,
            y: e.clientY,
            hasSelection: selection.length > 0
        })
        setLinkPopup(null) // Close link popup when context menu opens
    }, [])

    const handleCopy = useCallback(async () => {
        const selection = xtermRef.current?.getSelection()
        if (selection) {
            await navigator.clipboard.writeText(selection)
        }
        setContextMenu(null)
    }, [])

    const handlePaste = useCallback(async () => {
        try {
            const text = await navigator.clipboard.readText()
            const currentSessionId = activeSessionIdRef.current
            if (currentSessionId && text) {
                await window.devscope.terminal.write(currentSessionId, text)
            }
        } catch (err) {
            console.error('[Terminal] Paste failed:', err)
        }
        setContextMenu(null)
    }, [])

    const handleCloseContextMenu = useCallback(() => {
        setContextMenu(null)
    }, [])

    const handleCloseLinkPopup = useCallback(() => {
        setLinkPopup(null)
    }, [])

    const handleFollowLink = useCallback((url: string) => {
        window.open(url, '_blank')
        setLinkPopup(null)
    }, [])

    // -- Resize Handler --
    const handleResizeStart = useCallback((e: React.MouseEvent) => {
        e.preventDefault()
        setIsResizing(true)
        resizeRef.current = e.clientY
    }, [])

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!isResizing) return
            const delta = resizeRef.current - e.clientY
            resizeRef.current = e.clientY
            setHeight(prev => Math.min(Math.max(200, prev + delta), window.innerHeight - 100))
        }
        const handleMouseUp = () => setIsResizing(false)

        if (isResizing) {
            document.addEventListener('mousemove', handleMouseMove)
            document.addEventListener('mouseup', handleMouseUp)
        }
        return () => {
            document.removeEventListener('mousemove', handleMouseMove)
            document.removeEventListener('mouseup', handleMouseUp)
        }
    }, [isResizing])

    // Don't render if terminal is closed (not just minimized)
    if (!isOpen) return null

    return (
        <div
            className={cn(
                "fixed bottom-0 left-64 right-0 z-40 bg-sparkle-bg border-t border-sparkle-border flex flex-col shadow-2xl",
                !isVisible && "hidden" // Hide with CSS when minimized, keep xterm in DOM
            )}
            style={{ height }}
        >
            {/* Resize Handle */}
            <div
                className="absolute top-0 left-0 right-0 h-1 cursor-ns-resize hover:bg-[var(--accent-primary)]/50 transition-colors z-50"
                onMouseDown={handleResizeStart}
            />

            <div className="flex flex-1 min-h-0 bg-sparkle-bg">
                {/* Main Terminal Area */}
                <div className="flex-1 flex flex-col min-w-0 relative">

                    <div className="flex items-center justify-between px-3 py-1 bg-sparkle-card border-b border-sparkle-border">
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setIsSidebarOpen(prev => !prev)}
                                className={cn("p-1 rounded hover:bg-sparkle-accent transition-colors text-sparkle-text-secondary hover:text-sparkle-text")}
                            >
                                <LayoutPanelLeft size={14} />
                            </button>
                            <span className="text-xs font-medium text-sparkle-text-secondary">
                                {activeSession?.name || 'Terminal'}
                            </span>
                            {activeSession?.status === 'exited' && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/10 text-red-400 border border-red-500/20">
                                    Exited
                                </span>
                            )}
                            {activeSession?.status === 'error' && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-yellow-500/10 text-yellow-400 border border-yellow-500/20">
                                    Error
                                </span>
                            )}
                            {/* Shell Type Badge */}
                            {activeSession && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 font-mono">
                                    {activeSession.shell.includes('powershell') ? 'PS' : 'CMD'}
                                </span>
                            )}
                        </div>
                        <div className="flex items-center gap-1">
                            <button onClick={onMinimize} className="p-1 rounded hover:bg-sparkle-accent transition-colors">
                                <Minus size={14} className="text-sparkle-text-secondary hover:text-sparkle-text" />
                            </button>
                            <button onClick={onClose} className="p-1 rounded hover:bg-red-500/20 hover:text-red-400 transition-colors">
                                <X size={14} className="text-sparkle-text-secondary" />
                            </button>
                        </div>
                    </div>

                    {/* XTerm Container */}
                    <div
                        className="flex-1 overflow-hidden relative bg-sparkle-bg"
                        onContextMenu={handleContextMenu}
                        onClick={handleCloseContextMenu}
                    >
                        <div ref={terminalContainerRef} className="h-full w-full" />

                        {/* Context Menu */}
                        {contextMenu && (
                            <div
                                className="fixed z-50 bg-sparkle-card border border-sparkle-border rounded-lg shadow-xl py-1 min-w-[160px] animate-fadeIn"
                                style={{ left: contextMenu.x, top: contextMenu.y }}
                                onClick={(e) => e.stopPropagation()}
                            >
                                <button
                                    onClick={handleCopy}
                                    disabled={!contextMenu.hasSelection}
                                    className="w-full text-left px-3 py-2 text-sm hover:bg-sparkle-accent transition-colors flex items-center gap-3 disabled:opacity-40 disabled:cursor-not-allowed"
                                >
                                    <span className="text-sparkle-text-secondary">📋</span>
                                    <span className="text-sparkle-text">Copy</span>
                                    <span className="ml-auto text-xs text-sparkle-text-muted">Ctrl+C</span>
                                </button>
                                <button
                                    onClick={handlePaste}
                                    className="w-full text-left px-3 py-2 text-sm hover:bg-sparkle-accent transition-colors flex items-center gap-3"
                                >
                                    <span className="text-sparkle-text-secondary">📥</span>
                                    <span className="text-sparkle-text">Paste</span>
                                    <span className="ml-auto text-xs text-sparkle-text-muted">Ctrl+V</span>
                                </button>
                                <div className="h-px bg-sparkle-border my-1" />
                                <button
                                    onClick={() => { xtermRef.current?.selectAll(); setContextMenu(null) }}
                                    className="w-full text-left px-3 py-2 text-sm hover:bg-sparkle-accent transition-colors flex items-center gap-3"
                                >
                                    <span className="text-sparkle-text-secondary">📄</span>
                                    <span className="text-sparkle-text">Select All</span>
                                </button>
                                <button
                                    onClick={() => { xtermRef.current?.clear(); setContextMenu(null) }}
                                    className="w-full text-left px-3 py-2 text-sm hover:bg-sparkle-accent transition-colors flex items-center gap-3"
                                >
                                    <span className="text-sparkle-text-secondary">🗑️</span>
                                    <span className="text-sparkle-text">Clear</span>
                                </button>
                            </div>
                        )}

                        {/* Link Hover Popup */}
                        {linkPopup && (
                            <div
                                className="fixed z-50 bg-sparkle-card border border-sparkle-border rounded-lg shadow-xl p-3 min-w-[200px] animate-fadeIn"
                                style={{ left: linkPopup.x, top: linkPopup.y }}
                            >
                                <p className="text-xs text-sparkle-text-muted mb-2 truncate max-w-[250px]">{linkPopup.url}</p>
                                <p className="text-[10px] text-sparkle-text-secondary mb-3">Press Ctrl+Click to follow link</p>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => handleFollowLink(linkPopup.url)}
                                        className="flex-1 px-3 py-1.5 text-xs bg-[var(--accent-primary)] text-white rounded-md hover:opacity-90 transition-opacity"
                                    >
                                        Follow Link
                                    </button>
                                    <button
                                        onClick={handleCloseLinkPopup}
                                        className="px-3 py-1.5 text-xs bg-sparkle-border text-sparkle-text-secondary rounded-md hover:bg-sparkle-accent transition-colors"
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Right Sidebar */}
                {isSidebarOpen && (
                    <div className="w-56 bg-sparkle-card border-l border-sparkle-border flex flex-col">
                        <div className="p-3 border-b border-sparkle-border flex items-center justify-between">
                            <span className="text-xs font-semibold text-sparkle-text-muted uppercase tracking-wider">Sessions</span>
                            <div className="flex items-center gap-1">
                                {/* Shell Type Selector */}
                                <div className="relative">
                                    <button
                                        onClick={() => setShowShellMenu(!showShellMenu)}
                                        className="p-1 text-sparkle-text-muted hover:text-[var(--accent-primary)] transition-colors"
                                        title="Select Shell Type"
                                    >
                                        <ChevronDown size={14} />
                                    </button>
                                    {showShellMenu && (
                                        <>
                                            <div
                                                className="fixed inset-0 z-40"
                                                onClick={() => setShowShellMenu(false)}
                                            />
                                            <div className="absolute right-0 top-full mt-1 bg-sparkle-card border border-sparkle-border rounded-lg shadow-xl z-50 py-1 min-w-[140px]">
                                                <button
                                                    onClick={() => {
                                                        createSession('powershell')
                                                        setShowShellMenu(false)
                                                    }}
                                                    className="w-full text-left px-3 py-2 text-xs hover:bg-sparkle-accent transition-colors flex items-center gap-2"
                                                >
                                                    <span className="text-blue-400 font-bold">PS</span>
                                                    <span className="text-sparkle-text">PowerShell</span>
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        createSession('cmd')
                                                        setShowShellMenu(false)
                                                    }}
                                                    className="w-full text-left px-3 py-2 text-xs hover:bg-sparkle-accent transition-colors flex items-center gap-2"
                                                >
                                                    <span className="text-yellow-400 font-bold">CMD</span>
                                                    <span className="text-sparkle-text">Command Prompt</span>
                                                </button>
                                            </div>
                                        </>
                                    )}
                                </div>
                                <button
                                    onClick={() => createSession()}
                                    className="p-1 text-sparkle-text-muted hover:text-[var(--accent-primary)] transition-colors"
                                    title="New Terminal"
                                >
                                    <Plus size={16} />
                                </button>
                            </div>
                        </div>
                        <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
                            {sessions.map(session => (
                                <div
                                    key={session.id}
                                    onClick={() => setActiveSessionId(session.id)}
                                    className={cn(
                                        "group flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-all border",
                                        activeSessionId === session.id
                                            ? "bg-[var(--accent-primary)]/10 border-[var(--accent-primary)]/20 shadow-sm"
                                            : "hover:bg-sparkle-accent border-transparent opacity-70 hover:opacity-100"
                                    )}
                                >
                                    <div className={cn(
                                        "p-1.5 rounded-md",
                                        activeSessionId === session.id
                                            ? "bg-[var(--accent-primary)] text-white"
                                            : "bg-sparkle-border text-sparkle-text-muted"
                                    )}>
                                        <Monitor size={14} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className={cn(
                                            "text-xs font-medium truncate",
                                            activeSessionId === session.id ? "text-[var(--accent-primary)]" : "text-sparkle-text"
                                        )}>
                                            {session.name}
                                        </p>
                                        <p className="text-[10px] text-sparkle-text-muted truncate">
                                            {session.shell.includes('powershell') ? 'PowerShell' : 'CMD'}
                                        </p>
                                    </div>
                                    <button
                                        onClick={(e) => killSession(session.id, e)}
                                        className={cn(
                                            "p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-red-500/20 hover:text-red-400 transition-all",
                                            sessions.length === 1 && "hidden"
                                        )}
                                    >
                                        <X size={12} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
