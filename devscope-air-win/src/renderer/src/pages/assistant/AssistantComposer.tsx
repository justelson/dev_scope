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
    compact?: boolean
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
    activeProfile,
    compact = false
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
        <div className={cn('relative flex flex-col', compact ? 'gap-1.5' : 'gap-2')}>
            {showSlashMenu && (
                <div className={cn(
                    'absolute bottom-full left-0 z-20 mb-2 overflow-hidden rounded-lg border border-sparkle-border bg-sparkle-card shadow-lg',
                    compact ? 'w-56' : 'w-64'
                )}>
                    <div className="flex items-center gap-2 border-b border-sparkle-border bg-sparkle-bg px-3 py-2">
                        <Command size={13} className="text-sparkle-text-muted" />
                        <span className="text-[11px] font-medium uppercase tracking-wide text-sparkle-text-secondary">Slash Commands</span>
                    </div>
                    <div className="max-h-48 overflow-y-auto p-1">
                        {SLASH_COMMANDS.map((command) => (
                            <button
                                key={command.command}
                                onClick={() => handleCommandSelect(command.command)}
                                className="group w-full rounded-md px-3 py-2 text-left transition-colors hover:bg-sparkle-bg"
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
                <div className={cn('flex flex-wrap items-center', compact ? 'gap-1.5 pb-1.5' : 'gap-2 pb-2')}>
                    {contextFiles.map((file) => {
                        const meta = getContextFileMeta(file)
                        const contentType = getContentTypeTag(file)
                        const isRemoving = removingAttachmentIds.includes(file.id)
                        const isEntering = Boolean(file.animateIn)
                        return (
                            <article
                                key={file.id}
                                className={cn(
                                    'group relative overflow-hidden rounded-md border border-sparkle-border bg-sparkle-card px-2 py-1.5 transition-colors hover:bg-sparkle-bg',
                                    compact ? 'w-[220px]' : 'w-[280px]'
                                )}
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
                                <button
                                    type="button"
                                    onClick={() => setPreviewAttachment(file)}
                                    className="relative flex min-w-0 flex-1 items-center gap-2 overflow-hidden rounded-md"
                                    disabled={isRemoving}
                                    title="Open preview"
                                >
                                    {meta.category === 'image' && file.previewDataUrl ? (
                                        <img
                                            src={file.previewDataUrl}
                                            alt={meta.name}
                                            className="h-7 w-7 rounded object-cover"
                                        />
                                    ) : (
                                        <div className={cn(
                                            'flex h-7 w-7 shrink-0 items-center justify-center rounded border',
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
                                    <span className="min-w-0 flex-1 text-left">
                                        <span className="block truncate text-[11px] font-medium text-sparkle-text">{meta.name}</span>
                                        <span className="block truncate font-mono text-[10px] uppercase tracking-wide text-sparkle-text-muted">{contentType}</span>
                                    </span>
                                </button>
                                <button
                                    type="button"
                                    onClick={(event) => {
                                        event.stopPropagation()
                                        removeAttachment(file.id)
                                    }}
                                    className="ml-1 shrink-0 rounded p-1 text-sparkle-text-muted transition-colors hover:bg-rose-500/10 hover:text-rose-300"
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

            <div className={cn(
                'group relative z-10 flex flex-col rounded-xl border border-sparkle-border bg-sparkle-card/90 shadow-sm transition-colors focus-within:bg-sparkle-card',
                compact ? 'gap-1.5 px-2 py-1.5' : 'gap-2 px-2.5 py-2'
            )}>
                <div className={cn('flex items-end', compact ? 'gap-2 px-1 py-0.5' : 'gap-2.5 px-1.5 py-1')}>
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
                        className={cn(
                            'mb-1 rounded-md border border-sparkle-border bg-sparkle-bg text-sparkle-text-secondary transition-colors hover:bg-sparkle-card-hover hover:text-sparkle-text',
                            compact ? 'p-1.5' : 'p-2'
                        )}
                        title="Attach files"
                    >
                        <Plus size={compact ? 14 : 16} />
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
                            className={cn(
                                'w-full resize-none overflow-y-auto bg-transparent px-1 py-1 leading-relaxed text-sparkle-text outline-none placeholder:text-sparkle-text-muted/70',
                                compact ? 'h-8 min-h-8 max-h-8 text-[13px]' : 'h-9 min-h-9 max-h-9 text-sm'
                            )}
                            placeholder={isConnected ? (compact ? 'Ask assistant...' : 'Ask, edit, or run commands...') : 'Connect assistant to start chatting...'}
                            disabled={disabled || !isConnected}
                        />
                    </div>

                    <button
                        type="button"
                        disabled={disabled || !isConnected || isThinking || (!text.trim() && contextFiles.length === 0)}
                        onClick={() => void handleSend()}
                        className={cn(
                            'mb-1 inline-flex items-center justify-center rounded-md border transition-colors',
                            compact ? 'h-8 w-8' : 'h-9 w-9',
                            disabled || !isConnected || isThinking || (!text.trim() && contextFiles.length === 0)
                                ? 'cursor-not-allowed border-sparkle-border bg-sparkle-bg text-sparkle-text-muted/70'
                                : 'border-[var(--accent-primary)]/35 bg-[var(--accent-primary)]/15 text-[var(--accent-primary)] hover:bg-[var(--accent-primary)]/25'
                        )}
                    >
                        {isThinking ? (
                            <Loader2 size={compact ? 15 : 16} className="animate-spin" />
                        ) : (
                            <SendHorizontal size={compact ? 15 : 16} />
                        )}
                    </button>
                </div>

                <div className={cn(
                    'relative z-0 -mx-2.5 -mb-2 -mt-0.5 flex items-center justify-between rounded-b-xl border border-sparkle-border bg-sparkle-bg px-2.5 pb-2 pt-4 font-medium tracking-tight',
                    compact ? 'text-[9px]' : 'text-[10px]'
                )}>
                    <div className={cn('relative flex flex-col', compact ? 'w-60' : 'w-80')} ref={modelDropdownRef}>
                        <div
                            className={cn(
                                'pointer-events-none absolute bottom-full left-0 z-30 w-full overflow-hidden',
                                showModelDropdown ? 'pointer-events-auto' : 'pointer-events-none'
                            )}
                        >
                            <AnimatedHeight isOpen={showModelDropdown} duration={300}>
                                <div className="space-y-1 rounded-lg border border-sparkle-border bg-sparkle-card p-2 shadow-lg">
                                    <div className="flex items-center justify-between px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.16em] text-sparkle-text-muted">
                                        <span>Models</span>
                                        <button
                                            type="button"
                                            onClick={() => onRefreshModels?.()}
                                            className="inline-flex items-center rounded border border-transparent px-1 py-0.5 text-sparkle-text-muted transition-colors hover:border-sparkle-border hover:text-sparkle-text"
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
                                                        'flex w-full items-center rounded-md border px-2.5 py-1.5 text-left transition-colors',
                                                        isActive
                                                            ? 'border-[var(--accent-primary)]/35 bg-[var(--accent-primary)]/12 text-[var(--accent-primary)]'
                                                            : 'border-transparent text-sparkle-text-secondary hover:border-sparkle-border hover:bg-sparkle-bg hover:text-sparkle-text'
                                                    )}
                                                >
                                                    <span className="truncate text-[12px]">{model.label || model.id}</span>
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
                                'flex w-full items-center gap-2 rounded-md border border-sparkle-border bg-sparkle-card px-2.5 py-1.5 transition-colors hover:bg-sparkle-card-hover',
                                showModelDropdown
                                    ? 'bg-sparkle-card-hover'
                                    : ''
                            )}
                        >
                            <Command size={compact ? 10 : 11} className="text-sparkle-text-muted" />
                            <span className={cn(
                                'flex-1 truncate text-left',
                                compact ? 'text-[11px]' : 'text-xs',
                                'text-sparkle-text'
                            )}>
                                {selectedModelLabel}
                            </span>
                            <ChevronDown
                                size={compact ? 11 : 12}
                                className={cn(
                                    'shrink-0 text-sparkle-text-muted transition-transform duration-300',
                                    showModelDropdown && 'rotate-180'
                                )}
                            />
                        </button>
                    </div>

                    <div className="flex items-center gap-1.5">
                        <div className={cn(
                            'h-1 w-1 rounded-full',
                            activeProfile === 'yolo-fast' ? 'bg-amber-300' : 'bg-emerald-400'
                        )} />
                        <span className={cn(
                            'font-mono uppercase tracking-[0.12em]',
                            compact ? 'text-[9px]' : 'text-[10px]',
                            'text-sparkle-text-secondary'
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
