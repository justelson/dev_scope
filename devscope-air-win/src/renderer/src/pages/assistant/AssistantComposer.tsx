import { useEffect, useRef, useState } from 'react'
import { Command, FileCode2, FileImage, FileText, Loader2, Plus, SendHorizontal, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import AssistantAttachmentPreviewModal from './AssistantAttachmentPreviewModal'
import type { ComposerContextFile } from './assistant-composer-types'
import {
    ATTACHMENT_REMOVE_MS,
    buildAttachmentPath,
    buildTextAttachmentFromPaste,
    createAttachmentId,
    DRAFT_STORAGE_KEY,
    getContentTypeTag,
    getContextFileMeta,
    isLargeTextPaste,
    isPastedTextAttachment,
    MAX_COMPOSER_HEIGHT,
    MAX_IMAGE_DATA_URL_CHARS,
    readFileAsDataUrl,
    SLASH_COMMANDS,
    summarizeTextPreview,
    toKbLabel
} from './assistant-composer-utils'

export type { ComposerContextFile } from './assistant-composer-types'

export type AssistantComposerProps = {
    onSend: (prompt: string, contextFiles: ComposerContextFile[]) => Promise<boolean>
    disabled: boolean
    isSending: boolean
    isThinking: boolean
    isConnected: boolean
}

export function AssistantComposer({ onSend, disabled, isSending, isThinking, isConnected }: AssistantComposerProps) {
    const [text, setText] = useState('')
    const [contextFiles, setContextFiles] = useState<ComposerContextFile[]>([])
    const [showSlashMenu, setShowSlashMenu] = useState(false)
    const [previewAttachment, setPreviewAttachment] = useState<ComposerContextFile | null>(null)
    const [removingAttachmentIds, setRemovingAttachmentIds] = useState<string[]>([])
    const textareaRef = useRef<HTMLTextAreaElement>(null)

    const resizeComposer = () => {
        const el = textareaRef.current
        if (!el) return
        el.style.height = '0px'
        const next = Math.max(24, Math.min(el.scrollHeight, MAX_COMPOSER_HEIGHT))
        el.style.height = `${next}px`
        el.style.overflowY = el.scrollHeight > MAX_COMPOSER_HEIGHT ? 'auto' : 'hidden'
    }

    const upsertAttachment = (attachment: ComposerContextFile) => {
        setContextFiles((prev) => {
            const sameByPath = prev.find((entry) => entry.path === attachment.path && entry.path !== '')
            if (sameByPath) return prev
            return [...prev, attachment]
        })
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
    }, [text, contextFiles.length])

    useEffect(() => {
        if (!contextFiles.some((file) => file.animateIn)) return
        const rafId = window.requestAnimationFrame(() => {
            setContextFiles((prev) => prev.map((file) => (file.animateIn ? { ...file, animateIn: false } : file)))
        })
        return () => window.cancelAnimationFrame(rafId)
    }, [contextFiles])

    useEffect(() => {
        if (!previewAttachment) return
        const stillExists = contextFiles.some((entry) => entry.id === previewAttachment.id)
        if (!stillExists) {
            setPreviewAttachment(null)
        }
    }, [contextFiles, previewAttachment])

    const removeAttachment = (id: string) => {
        setRemovingAttachmentIds((prev) => (prev.includes(id) ? prev : [...prev, id]))
        window.setTimeout(() => {
            setContextFiles((prev) => prev.filter((entry) => entry.id !== id))
            setRemovingAttachmentIds((prev) => prev.filter((entryId) => entryId !== id))
        }, ATTACHMENT_REMOVE_MS)
    }

    const handleSend = async () => {
        const prompt = text.trim()
        if ((prompt.length === 0 && contextFiles.length === 0) || disabled || isSending || !isConnected) return

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

    const handlePaste = (event: React.ClipboardEvent<HTMLTextAreaElement>) => {
        const clipboard = event.clipboardData
        if (!clipboard) return

        const items = Array.from(clipboard.items || [])
        const fileItems = items.filter((item) => item.kind === 'file')

        if (fileItems.length > 0) {
            event.preventDefault()

            for (const item of fileItems) {
                const file = item.getAsFile()
                if (!file) continue

                const fallbackName = file.type.startsWith('image/')
                    ? `pasted-image-${Date.now()}.png`
                    : `pasted-file-${Date.now()}`
                const name = file.name || fallbackName
                const metaPath = buildAttachmentPath('paste', name)
                const mimeType = file.type || 'application/octet-stream'

                if (mimeType.startsWith('image/')) {
                    void readFileAsDataUrl(file)
                        .then((dataUrl) => {
                            const safeDataUrl = dataUrl.length <= MAX_IMAGE_DATA_URL_CHARS ? dataUrl : ''
                            upsertAttachment({
                                id: createAttachmentId(),
                                path: metaPath,
                                name,
                                mimeType,
                                sizeBytes: file.size,
                                kind: 'image',
                                previewDataUrl: dataUrl,
                                content: safeDataUrl || undefined,
                                previewText: safeDataUrl
                                    ? 'Pasted image from clipboard.'
                                    : 'Pasted image is large. Preview available in UI.',
                                source: 'paste',
                                animateIn: true
                            })
                        })
                        .catch(() => undefined)
                    continue
                }

                void file.text()
                    .then((rawText) => {
                        const trimmed = rawText.length > MAX_ATTACHMENT_CONTENT_CHARS
                            ? `${rawText.slice(0, MAX_ATTACHMENT_CONTENT_CHARS)}\n\n[truncated]`
                            : rawText
                        const meta = getContextFileMeta({ path: metaPath, name, mimeType })
                        upsertAttachment({
                            id: createAttachmentId(),
                            path: metaPath,
                            name,
                            mimeType,
                            sizeBytes: file.size,
                            kind: meta.category === 'code' ? 'code' : 'doc',
                            content: trimmed,
                            previewText: summarizeTextPreview(rawText),
                            source: 'paste',
                            animateIn: true
                        })
                    })
                    .catch(() => {
                        upsertAttachment({
                            id: createAttachmentId(),
                            path: metaPath,
                            name,
                            mimeType,
                            sizeBytes: file.size,
                            kind: 'file',
                            previewText: 'Binary attachment from clipboard.',
                            source: 'paste',
                            animateIn: true
                        })
                    })
            }
            return
        }

        const plainText = clipboard.getData('text/plain')
        if (isLargeTextPaste(plainText)) {
            event.preventDefault()
            upsertAttachment(buildTextAttachmentFromPaste(plainText))
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
            const meta = getContextFileMeta({ path: normalizedPath })
            upsertAttachment({
                id: createAttachmentId(),
                path: normalizedPath,
                name: meta.name,
                kind: meta.category === 'image' ? 'image' : meta.category === 'code' ? 'code' : 'file',
                source: 'manual'
            })
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

            <div
                className="overflow-hidden transition-[max-height,opacity,margin] duration-200 ease-out"
                style={{
                    maxHeight: contextFiles.length > 0
                        ? `${Math.min(340, Math.max(104, Math.ceil(contextFiles.length / 4) * 104 + 8))}px`
                        : '0px',
                    opacity: contextFiles.length > 0 ? 1 : 0,
                    marginBottom: contextFiles.length > 0 ? '2px' : '0px'
                }}
            >
                <div className="flex flex-wrap gap-2 px-1">
                    {contextFiles.map((file) => {
                        const meta = getContextFileMeta(file)
                        const contentType = getContentTypeTag(file)
                        const isRemoving = removingAttachmentIds.includes(file.id)
                        const isEntering = Boolean(file.animateIn)
                        return (
                            <article
                                key={file.id}
                                className="group relative h-24 w-24 overflow-hidden rounded-xl border border-sparkle-border bg-sparkle-card/85 p-1.5 shadow-sm transition-colors hover:border-[var(--accent-primary)]/35 hover:bg-sparkle-card"
                                style={{
                                    transition: 'transform 190ms ease, opacity 190ms ease, filter 190ms ease',
                                    transform: isRemoving
                                        ? 'translateY(6px) scale(0.82)'
                                        : isEntering
                                            ? 'translateY(-8px) scale(0.86)'
                                            : 'translateY(0) scale(1)',
                                    opacity: isRemoving || isEntering ? 0 : 1,
                                    filter: isRemoving ? 'blur(1px)' : 'blur(0)'
                                }}
                            >
                                <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-[var(--accent-primary)]/70 via-[var(--accent-primary)]/25 to-transparent opacity-80" />
                                <button
                                    type="button"
                                    onClick={() => setPreviewAttachment(file)}
                                    className="relative h-full w-full overflow-hidden rounded-lg"
                                    disabled={isRemoving}
                                    title="Open preview"
                                >
                                    {meta.category === 'image' && file.previewDataUrl ? (
                                        <img
                                            src={file.previewDataUrl}
                                            alt={meta.name}
                                            className="h-full w-full rounded-lg object-cover"
                                        />
                                    ) : (
                                        <div className={cn(
                                            'flex h-full w-full items-center justify-center rounded-lg border',
                                            meta.category === 'image'
                                                ? 'border-cyan-400/30 bg-cyan-500/10 text-cyan-300'
                                                : meta.category === 'code'
                                                    ? 'border-indigo-400/30 bg-indigo-500/10 text-indigo-300'
                                                    : 'border-sparkle-border bg-sparkle-bg text-sparkle-text-secondary'
                                        )}>
                                            {meta.category === 'image' ? (
                                                <FileImage size={24} />
                                            ) : meta.category === 'code' ? (
                                                <FileCode2 size={24} />
                                            ) : (
                                                <FileText size={24} />
                                            )}
                                        </div>
                                    )}
                                    <div className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-black/55 via-black/25 to-transparent" />
                                    <span className="pointer-events-none absolute bottom-1 right-1 inline-flex items-center rounded border border-white/15 bg-black/70 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wide text-white/95">
                                        {contentType}
                                    </span>
                                </button>
                                <button
                                    type="button"
                                    onClick={(event) => {
                                        event.stopPropagation()
                                        removeAttachment(file.id)
                                    }}
                                    className="absolute right-1.5 top-1.5 rounded-md border border-white/10 bg-black/55 p-1 text-sparkle-text-muted transition-colors hover:bg-rose-500/20 hover:text-rose-300"
                                    disabled={isRemoving}
                                    title="Remove attachment"
                                >
                                    <X size={11} />
                                </button>
                            </article>
                        )
                    })}
                </div>
            </div>

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
                        onPaste={handlePaste}
                        className="flex-1 resize-none bg-transparent px-2 py-0.5 text-sm leading-6 text-sparkle-text outline-none placeholder:text-sparkle-text-muted"
                        placeholder={isConnected ? 'Ask DevScope Assistant (Type "/" for commands, paste image/text/files)...' : 'Connect assistant to start chatting...'}
                        disabled={disabled || !isConnected}
                    />
                    <button
                        type="button"
                        disabled={disabled || !isConnected || isThinking || (!text.trim() && contextFiles.length === 0)}
                        onClick={() => void handleSend()}
                        className={cn(
                            'inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-semibold transition-all',
                            disabled || !isConnected || isThinking || (!text.trim() && contextFiles.length === 0)
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

            <AssistantAttachmentPreviewModal
                file={previewAttachment}
                meta={previewAttachment ? getContextFileMeta(previewAttachment) : null}
                contentType={previewAttachment ? getContentTypeTag(previewAttachment) : ''}
                sizeLabel={previewAttachment ? toKbLabel(previewAttachment.sizeBytes) : ''}
                showFormattingWarning={previewAttachment ? isPastedTextAttachment(previewAttachment) : false}
                onClose={() => setPreviewAttachment(null)}
            />
        </div>
    )
}
