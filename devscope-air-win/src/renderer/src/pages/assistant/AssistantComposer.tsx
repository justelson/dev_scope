import { useEffect, useRef, useState } from 'react'
import { ChevronDown, Command, FileCode2, FileImage, FileText, Loader2, Plus, SendHorizontal, X } from 'lucide-react'
import { AnimatedHeight } from '@/components/ui/AnimatedHeight'
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
    inferImageExtensionFromMimeType,
    isLargeTextPaste,
    isPastedTextAttachment,
    MAX_ATTACHMENT_CONTENT_CHARS,
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
    activeModel?: string
    modelOptions?: Array<{ id: string; label: string }>
    modelsLoading?: boolean
    modelsError?: string | null
    onSelectModel?: (modelId: string) => void
    onRefreshModels?: () => void
    activeProfile?: string
}

export function AssistantComposer({
    onSend,
    disabled,
    isSending,
    isThinking,
    isConnected,
    activeModel,
    modelOptions,
    modelsLoading,
    modelsError,
    onSelectModel,
    onRefreshModels,
    activeProfile
}: AssistantComposerProps) {
    const [text, setText] = useState('')
    const [contextFiles, setContextFiles] = useState<ComposerContextFile[]>([])
    const [sentPromptHistory, setSentPromptHistory] = useState<string[]>([])
    const [historyCursor, setHistoryCursor] = useState<number | null>(null)
    const [draftBeforeHistory, setDraftBeforeHistory] = useState('')
    const [showSlashMenu, setShowSlashMenu] = useState(false)
    const [showModelDropdown, setShowModelDropdown] = useState(false)
    const [previewAttachment, setPreviewAttachment] = useState<ComposerContextFile | null>(null)
    const [removingAttachmentIds, setRemovingAttachmentIds] = useState<string[]>([])
    const textareaRef = useRef<HTMLTextAreaElement>(null)
    const filePickerRef = useRef<HTMLInputElement>(null)
    const modelDropdownRef = useRef<HTMLDivElement>(null)
    const resolvedModel = activeModel || 'default'
    const availableModelOptions = (Array.isArray(modelOptions) && modelOptions.length > 0)
        ? modelOptions
        : [{ id: resolvedModel, label: resolvedModel === 'default' ? 'Default (server recommended)' : resolvedModel }]
    const selectedModelLabel = availableModelOptions.find((model) => model.id === resolvedModel)?.label || resolvedModel

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
        if (!showModelDropdown) return
        const handleClickOutside = (event: MouseEvent) => {
            if (modelDropdownRef.current && !modelDropdownRef.current.contains(event.target as Node)) {
                setShowModelDropdown(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [showModelDropdown])

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

    const attachFile = async (file: File, source: 'paste' | 'manual') => {
        const declaredMimeType = String(file.type || '').trim().toLowerCase()
        const fallbackName = declaredMimeType.startsWith('image/')
            ? `${source}-image-${Date.now()}.${inferImageExtensionFromMimeType(declaredMimeType)}`
            : `${source}-file-${Date.now()}`
        const name = file.name || fallbackName
        const electronPath = String((file as File & { path?: string }).path || '').trim()
        const metaPath = electronPath || buildAttachmentPath(source, name)
        const mimeType = declaredMimeType || 'application/octet-stream'
        const looksLikeImageByName = /\.(png|jpe?g|gif|webp|svg|bmp|ico|tiff?|avif|apng|heic|heif|jfif|jxl)$/i.test(name)
        const needsInlineImageContent = source === 'paste' || !electronPath || metaPath.startsWith('clipboard://')

        const addImageAttachment = (dataUrl: string, resolvedMimeType: string) => {
            upsertAttachment({
                id: createAttachmentId(),
                path: metaPath,
                name,
                mimeType: resolvedMimeType,
                sizeBytes: file.size,
                kind: 'image',
                previewDataUrl: dataUrl,
                content: needsInlineImageContent ? dataUrl : undefined,
                previewText: source === 'paste'
                    ? (dataUrl.length <= MAX_IMAGE_DATA_URL_CHARS
                        ? 'Pasted image from clipboard.'
                        : 'Pasted image from clipboard (large image, sent as full payload).')
                    : 'Attached image file.',
                source,
                animateIn: true
            })
        }

        if (mimeType.startsWith('image/') || looksLikeImageByName) {
            try {
                const dataUrl = await readFileAsDataUrl(file)
                const dataUrlMimeMatch = dataUrl.match(/^data:([^;,]+)[;,]/i)
                const dataUrlMimeType = String(dataUrlMimeMatch?.[1] || '').trim().toLowerCase()
                const resolvedMimeType = dataUrlMimeType || (mimeType.startsWith('image/') ? mimeType : 'image/png')
                addImageAttachment(dataUrl, resolvedMimeType)
            } catch {
                // ignore invalid image payloads
            }
            return
        }

        if (source === 'paste' && !declaredMimeType) {
            try {
                const dataUrl = await readFileAsDataUrl(file)
                const dataUrlMimeMatch = dataUrl.match(/^data:([^;,]+)[;,]/i)
                const dataUrlMimeType = String(dataUrlMimeMatch?.[1] || '').trim().toLowerCase()
                if (dataUrlMimeType.startsWith('image/')) {
                    addImageAttachment(dataUrl, dataUrlMimeType)
                    return
                }
            } catch {
                // not an image payload; fall through to text/binary handling
            }
        }

        try {
            const rawText = await file.text()
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
                source,
                animateIn: true
            })
        } catch {
            upsertAttachment({
                id: createAttachmentId(),
                path: metaPath,
                name,
                mimeType,
                sizeBytes: file.size,
                kind: 'file',
                previewText: source === 'paste' ? 'Binary attachment from clipboard.' : 'Attached binary file.',
                source,
                animateIn: true
            })
        }
    }

    const handlePickedFiles = (files: FileList | null) => {
        if (!files || files.length === 0) return
        const selectedFiles = Array.from(files)
        for (const file of selectedFiles) {
            void attachFile(file, 'manual')
        }
    }

    const handleSend = async () => {
        const prompt = text.trim()
        if ((prompt.length === 0 && contextFiles.length === 0) || disabled || isSending || !isConnected) return

        // Capture state for possible rollback
        const prevText = text
        const prevFiles = contextFiles

        // Clear immediately for responsive feel
        setText('')
        setContextFiles([])
        setHistoryCursor(null)
        setDraftBeforeHistory('')
        try {
            localStorage.removeItem(DRAFT_STORAGE_KEY)
        } catch {
            // ignore storage errors
        }

        const success = await onSend(prompt, contextFiles)
        if (!success) {
            // Rollback if failed
            setText(prevText)
            setContextFiles(prevFiles)
            return
        }

        if (prompt.length > 0) {
            setSentPromptHistory((prev) => {
                if (prev[prev.length - 1] === prompt) return prev
                return [...prev.slice(-49), prompt]
            })
        }
    }

    const handleRecallPrevious = () => {
        if (sentPromptHistory.length === 0) return
        if (historyCursor == null) {
            setDraftBeforeHistory(text)
            const nextIndex = sentPromptHistory.length - 1
            setHistoryCursor(nextIndex)
            setText(sentPromptHistory[nextIndex])
            return
        }
        const nextIndex = Math.max(0, historyCursor - 1)
        setHistoryCursor(nextIndex)
        setText(sentPromptHistory[nextIndex])
    }

    const handleRecallNext = () => {
        if (historyCursor == null) return
        if (historyCursor >= sentPromptHistory.length - 1) {
            setHistoryCursor(null)
            setText(draftBeforeHistory)
            setDraftBeforeHistory('')
            return
        }
        const nextIndex = historyCursor + 1
        setHistoryCursor(nextIndex)
        setText(sentPromptHistory[nextIndex])
    }

    const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
        const target = event.currentTarget
        const selectionStart = target.selectionStart ?? 0
        const selectionEnd = target.selectionEnd ?? 0
        const atStart = selectionStart === 0 && selectionEnd === 0
        const atEnd = selectionStart === text.length && selectionEnd === text.length

        if (!event.shiftKey && !event.ctrlKey && !event.metaKey && !event.altKey && event.key === 'ArrowUp' && atStart) {
            event.preventDefault()
            handleRecallPrevious()
            return
        }
        if (!event.shiftKey && !event.ctrlKey && !event.metaKey && !event.altKey && event.key === 'ArrowDown' && atEnd) {
            event.preventDefault()
            handleRecallNext()
            return
        }
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
                void attachFile(file, 'paste')
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

            <AnimatedHeight isOpen={contextFiles.length > 0} duration={300}>
                <div className="flex flex-wrap gap-2 px-1 pb-2">
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
            </AnimatedHeight>

            <div className="group relative flex flex-col gap-2 rounded-[22px] border border-sparkle-border bg-sparkle-card/50 p-2.5 transition-all focus-within:bg-sparkle-card focus-within:shadow-2xl">
                <div className="flex items-end gap-2.5 px-1.5 py-1">
                    <input
                        ref={filePickerRef}
                        type="file"
                        className="hidden"
                        multiple
                        accept="image/*,text/*,.md,.markdown,.txt,.json,.yaml,.yml,.xml,.csv,.ts,.tsx,.js,.jsx,.mjs,.cjs,.py,.go,.rs,.java,.kt,.cs,.cpp,.c,.h,.css,.scss,.sass,.html,.sql,.toml,.sh,.ps1"
                        onChange={(event) => {
                            handlePickedFiles(event.target.files)
                            event.currentTarget.value = ''
                        }}
                    />
                    <button
                        type="button"
                        onClick={() => filePickerRef.current?.click()}
                        disabled={disabled}
                        className="mb-1 rounded-xl border border-sparkle-border bg-sparkle-card p-2.5 text-sparkle-text-secondary transition-all hover:scale-105 hover:border-[var(--accent-primary)]/40 hover:bg-[var(--accent-primary)]/10 hover:text-[var(--accent-primary)] active:scale-95"
                        title="Attach files"
                    >
                        <Plus size={18} />
                    </button>

                    <div className="flex-1">
                        <textarea
                            ref={textareaRef}
                            rows={1}
                            value={text}
                            onChange={(event) => {
                                setText(event.target.value)
                                if (historyCursor != null) {
                                    setHistoryCursor(null)
                                }
                            }}
                            onKeyDown={handleKeyDown}
                            onPaste={handlePaste}
                            className="w-full resize-none bg-transparent px-1 py-1 text-sm leading-relaxed text-sparkle-text outline-none placeholder:text-sparkle-text-muted/60"
                            placeholder={isConnected ? 'How can I help you build today?' : 'Connect assistant to start chatting...'}
                            disabled={disabled || !isConnected}
                        />
                    </div>

                    <button
                        type="button"
                        disabled={disabled || !isConnected || isThinking || (!text.trim() && contextFiles.length === 0)}
                        onClick={() => void handleSend()}
                        className={cn(
                            'mb-1 inline-flex h-9 w-9 items-center justify-center rounded-xl transition-all active:scale-95',
                            disabled || !isConnected || isThinking || (!text.trim() && contextFiles.length === 0)
                                ? 'bg-sparkle-border/40 text-sparkle-text-muted cursor-not-allowed opacity-40'
                                : 'bg-[var(--accent-primary)] text-white hover:bg-[var(--accent-primary)]/90 hover:shadow-lg hover:shadow-[var(--accent-primary)]/20'
                        )}
                    >
                        {isThinking ? (
                            <Loader2 size={18} className="animate-spin" />
                        ) : (
                            <SendHorizontal size={18} />
                        )}
                    </button>
                </div>

                <div className="mt-1 flex items-center justify-between px-3 pb-2 text-[10px] font-medium tracking-tight">
                    <div className="relative flex flex-col w-80" ref={modelDropdownRef}>
                        <div
                            className={cn(
                                'pointer-events-none absolute bottom-full left-0 z-30 w-full overflow-hidden',
                                showModelDropdown ? 'pointer-events-auto' : 'pointer-events-none'
                            )}
                        >
                            <AnimatedHeight isOpen={showModelDropdown} duration={300}>
                                <div className="p-2 space-y-1 bg-sparkle-card border border-sparkle-border border-b-transparent rounded-t-xl shadow-2xl shadow-black/80">
                                    <div className="flex items-center justify-between px-3 py-1.5 text-[9px] font-bold uppercase tracking-widest text-sparkle-text-muted/40">
                                        <span>Model Selection</span>
                                        <button
                                            type="button"
                                            onClick={() => onRefreshModels?.()}
                                            className="inline-flex items-center rounded border border-transparent px-1.5 py-0.5 text-sparkle-text-muted hover:border-sparkle-border hover:bg-sparkle-card-hover hover:text-sparkle-text transition-all"
                                            title="Refresh models"
                                        >
                                            <Loader2 size={10} className={cn(modelsLoading && 'animate-spin')} />
                                        </button>
                                    </div>

                                    <div className="max-h-64 space-y-0.5 overflow-y-auto scrollbar-hide px-1 pb-1">
                                        {availableModelOptions.map((model) => {
                                            const isActive = model.id === resolvedModel
                                            return (
                                                <button
                                                    key={model.id}
                                                    type="button"
                                                    onClick={() => {
                                                        onSelectModel?.(model.id)
                                                        setShowModelDropdown(false)
                                                    }}
                                                    className={cn(
                                                        'group relative flex w-full items-center gap-3 rounded-lg border px-3 py-2 transition-all duration-200 backdrop-blur-[2px]',
                                                        isActive
                                                            ? 'border-white/10 bg-[var(--accent-primary)]/10 text-[var(--accent-primary)] shadow-[0_2px_10px_rgba(0,0,0,0.05)]'
                                                            : 'border-white/5 bg-sparkle-bg/40 text-sparkle-text-secondary hover:border-sparkle-border hover:bg-sparkle-card-hover/60 hover:text-sparkle-text'
                                                    )}
                                                >
                                                    <div className="min-w-0 flex-1 overflow-hidden">
                                                        <div className={cn(
                                                            "truncate text-[13px] leading-tight transition-colors text-left",
                                                            isActive ? "font-bold" : "font-medium"
                                                        )}>
                                                            {model.label || model.id}
                                                        </div>
                                                    </div>
                                                </button>
                                            )
                                        })}
                                    </div>

                                    {modelsError && (
                                        <div className="px-2 py-1">
                                            <p className="text-[10px] text-rose-400 font-medium">{modelsError}</p>
                                        </div>
                                    )}
                                </div>
                            </AnimatedHeight>
                        </div>

                        <button
                            type="button"
                            onClick={() => {
                                setShowModelDropdown((prev) => {
                                    const next = !prev
                                    if (next && !modelOptions?.length && onRefreshModels) {
                                        onRefreshModels()
                                    }
                                    return next
                                })
                            }}
                            title={modelsError || 'Select model for this chat path'}
                            className={cn(
                                'flex w-full items-center gap-2 px-3 py-1.5 transition-all outline-none border shadow-sm focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)]/30 focus-visible:border-[var(--accent-primary)]/50',
                                showModelDropdown
                                    ? 'rounded-b-xl border-sparkle-border border-t-transparent bg-sparkle-card-hover'
                                    : 'rounded-xl border-sparkle-border bg-sparkle-card hover:bg-sparkle-card-hover hover:border-[var(--accent-primary)]/40'
                            )}
                        >
                            <Command size={11} className={cn("transition-colors", showModelDropdown ? "text-[var(--accent-primary)]" : "text-sparkle-text-muted/40")} />
                            <span className={cn(
                                "flex-1 truncate text-left",
                                showModelDropdown ? "text-[var(--accent-primary)] font-semibold" : "text-sparkle-text/90 font-medium"
                            )}>
                                {selectedModelLabel}
                            </span>
                            <ChevronDown
                                size={12}
                                className={cn(
                                    'shrink-0 text-sparkle-text-muted transition-transform duration-300',
                                    showModelDropdown && 'rotate-180 text-[var(--accent-primary)]',
                                    modelsLoading && 'animate-pulse'
                                )}
                            />
                        </button>
                    </div>

                    <div className="flex items-center gap-1.5">
                        <div className={cn(
                            "h-1 w-1 rounded-full",
                            activeProfile === 'yolo-fast' ? "bg-[var(--accent-primary)] animate-pulse shadow-[0_0_8px_var(--accent-primary)]" : "bg-emerald-500"
                        )} />
                        <span className={cn(
                            "font-bold uppercase tracking-widest",
                            activeProfile === 'yolo-fast' ? "text-[var(--accent-primary)]" : "text-emerald-400"
                        )}>
                            {activeProfile || 'safe-dev'}
                        </span>
                    </div>
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
        </div >
    )
}
