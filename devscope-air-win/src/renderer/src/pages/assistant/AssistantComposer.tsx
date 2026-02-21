import { useEffect, useRef, useState } from 'react'
import { Command, Loader2, Plus, SendHorizontal, X } from 'lucide-react'
import { cn } from '@/lib/utils'

export type ComposerContextFile = {
    path: string
}

export type AssistantComposerProps = {
    onSend: (prompt: string, contextFiles: ComposerContextFile[]) => Promise<boolean>
    disabled: boolean
    isSending: boolean
    isThinking: boolean
    isConnected: boolean
}

const SLASH_COMMANDS = [
    { command: '/yolo', description: 'Sets the assistant approval mode to YOLO locally.' },
    { command: '/safe', description: 'Sets the assistant approval mode back to Safe.' },
    { command: '/include', description: 'Add a file to context.' }
]
const DRAFT_STORAGE_KEY = 'devscope:assistant:draft:v1'

export function AssistantComposer({ onSend, disabled, isSending, isThinking, isConnected }: AssistantComposerProps) {
    const [text, setText] = useState('')
    const [contextFiles, setContextFiles] = useState<ComposerContextFile[]>([])
    const [showSlashMenu, setShowSlashMenu] = useState(false)
    const textareaRef = useRef<HTMLTextAreaElement>(null)

    const resizeComposer = () => {
        const el = textareaRef.current
        if (!el) return
        el.style.height = '0px'
        const maxHeight = 160
        const next = Math.max(24, Math.min(el.scrollHeight, maxHeight))
        el.style.height = `${next}px`
        el.style.overflowY = el.scrollHeight > maxHeight ? 'auto' : 'hidden'
    }

    useEffect(() => {
        try {
            const saved = localStorage.getItem(DRAFT_STORAGE_KEY)
            if (saved && saved.trim()) setText(saved)
        } catch {
            // ignore storage errors
        }
    }, [])

    useEffect(() => {
        try {
            if (text.trim()) localStorage.setItem(DRAFT_STORAGE_KEY, text)
            else localStorage.removeItem(DRAFT_STORAGE_KEY)
        } catch {
            // ignore storage errors
        }
    }, [text])

    useEffect(() => {
        setShowSlashMenu(text.startsWith('/'))
    }, [text])

    useEffect(() => {
        resizeComposer()
    }, [text])

    const handleSend = async () => {
        const prompt = text.trim()
        if (!prompt || disabled || isSending || !isConnected) return

        const success = await onSend(prompt, contextFiles)
        if (!success) return

        setText('')
        setContextFiles([])
        try {
            localStorage.removeItem(DRAFT_STORAGE_KEY)
        } catch {
            // ignore storage errors
        }
    }

    const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault()
            void handleSend()
        }
    }

    const handleCommandSelect = async (command: string) => {
        if (command === '/yolo') {
            await window.devscope.assistant.setApprovalMode('yolo')
            setText('')
            setShowSlashMenu(false)
            return
        }

        if (command === '/safe') {
            await window.devscope.assistant.setApprovalMode('safe')
            setText('')
            setShowSlashMenu(false)
            return
        }

        const path = window.prompt('Enter file path to include:')
        const normalizedPath = path?.trim()
        if (normalizedPath) {
            setContextFiles((prev) =>
                prev.some((entry) => entry.path === normalizedPath)
                    ? prev
                    : [...prev, { path: normalizedPath }]
            )
        }
        setText('')
        setShowSlashMenu(false)
    }

    return (
        <div className="relative flex flex-col gap-2">
            {showSlashMenu && (
                <div className="absolute bottom-full left-0 z-10 mb-2 w-64 overflow-hidden rounded-xl border border-sparkle-border bg-sparkle-card shadow-lg">
                    <div className="flex items-center gap-2 border-b border-sparkle-border bg-sparkle-bg px-3 py-2">
                        <Command size={14} className="text-sparkle-text-muted" />
                        <span className="text-xs font-medium text-sparkle-text-secondary">Slash Commands</span>
                    </div>
                    <div className="max-h-48 overflow-y-auto p-1">
                        {SLASH_COMMANDS.map((command) => (
                            <button
                                key={command.command}
                                onClick={() => handleCommandSelect(command.command)}
                                className="group w-full rounded-lg px-3 py-2 text-left transition-colors hover:bg-[var(--accent-primary)]/10 hover:text-[var(--accent-primary)]"
                            >
                                <span className="text-sm font-medium text-sparkle-text transition-colors group-hover:text-[var(--accent-primary)]">
                                    {command.command}
                                </span>
                                <span className="block text-xs text-sparkle-text-muted">{command.description}</span>
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {contextFiles.length > 0 && (
                <div className="flex flex-wrap gap-2 px-1">
                    {contextFiles.map((file, index) => (
                        <div
                            key={`${file.path}-${index}`}
                            className="flex items-center gap-1.5 rounded-md border border-[var(--accent-primary)]/20 bg-[var(--accent-primary)]/10 px-2.5 py-1 text-xs text-sparkle-text"
                        >
                            <span className="max-w-[200px] truncate" title={file.path}>
                                {file.path.split(/[/\\]/).pop()}
                            </span>
                            <button
                                onClick={() => setContextFiles((prev) => prev.filter((_, i) => i !== index))}
                                className="text-sparkle-text-muted transition-colors hover:text-amber-400"
                            >
                                <X size={12} />
                            </button>
                        </div>
                    ))}
                </div>
            )}

            <div className="rounded-xl border border-sparkle-border bg-sparkle-card/80 p-2">
                <div className="flex items-center gap-2 rounded-lg border border-sparkle-border bg-sparkle-bg px-2 py-2 transition-colors focus-within:border-[var(--accent-primary)]/45 focus-within:ring-2 focus-within:ring-[var(--accent-primary)]/15">
                    <button
                        type="button"
                        onClick={() => void handleCommandSelect('/include')}
                        disabled={disabled}
                        className="rounded-lg border border-sparkle-border bg-sparkle-card p-2.5 text-sparkle-text-secondary transition-colors hover:border-[var(--accent-primary)]/40 hover:bg-[var(--accent-primary)]/10 hover:text-[var(--accent-primary)]"
                        title="Add context file"
                    >
                        <Plus size={16} />
                    </button>
                    <textarea
                        ref={textareaRef}
                        rows={1}
                        value={text}
                        onChange={(event) => setText(event.target.value)}
                        onKeyDown={handleKeyDown}
                        className="flex-1 resize-none bg-transparent px-2 py-0.5 text-sm leading-6 text-sparkle-text outline-none placeholder:text-sparkle-text-muted"
                        placeholder={isConnected ? 'Ask DevScope Assistant (Type "/" for commands)...' : 'Connect assistant to start chatting...'}
                        disabled={disabled || !isConnected}
                    />
                    <button
                        type="button"
                        disabled={disabled || !isConnected || isThinking || !text.trim()}
                        onClick={() => void handleSend()}
                        className={cn(
                            'inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-semibold transition-all',
                            disabled || !isConnected || isThinking || !text.trim()
                                ? 'cursor-not-allowed bg-sparkle-border text-sparkle-text-muted shadow-none'
                                : 'bg-[var(--accent-primary)] text-white hover:bg-[var(--accent-primary)]/85 hover:shadow-[0_0_15px_rgba(var(--accent-primary-rgb),0.25)]'
                        )}
                    >
                        {isThinking ? (
                            <Loader2 size={14} className="animate-spin" />
                        ) : (
                            <SendHorizontal size={14} />
                        )}
                        {isSending ? 'Sending...' : isThinking ? 'Thinking...' : 'Send'}
                    </button>
                </div>
            </div>
        </div>
    )
}
