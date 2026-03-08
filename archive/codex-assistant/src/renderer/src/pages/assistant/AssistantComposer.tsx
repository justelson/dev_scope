import { useEffect, useRef, useState } from 'react'
import { ChevronDown, Command, FileCode2, FileImage, FileText, Loader2, Lock, Paperclip, SendHorizontal, Square, X } from 'lucide-react'
import { AnimatedHeight } from '@/components/ui/AnimatedHeight'
import { cn } from '@/lib/utils'
import AssistantAttachmentPreviewModal from './AssistantAttachmentPreviewModal'
import { ActivityDots, OpenAILogo } from './AssistantBrandMarks'
import type { ComposerContextFile } from './assistant-composer-types'
import type { AssistantSendMetadata } from './assistant-page-types'
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
    shouldShowPastedTextFormattingWarning,
    summarizeTextPreview,
    toKbLabel
} from './assistant-composer-utils'

export type { ComposerContextFile } from './assistant-composer-types'

export type AssistantComposerProps = {
    onSend: (prompt: string, contextFiles: ComposerContextFile[], sendMetadata?: AssistantSendMetadata) => Promise<boolean>
    onCancelTurn?: () => void | Promise<void>
    disabled: boolean
    isSending: boolean
    isThinking: boolean
    isConnected: boolean
    approvalMode?: 'safe' | 'yolo' | string
    activeModel?: string
    modelOptions?: Array<{ id: string; label: string }>
    modelsLoading?: boolean
    modelsError?: string | null
    onSelectModel?: (modelId: string) => void
    onRefreshModels?: () => void
    onEnableSafeMode?: () => void | Promise<void>
    onRequestEnableYoloMode?: () => void | Promise<void>
    activeProfile?: string
    phaseLabel?: string
    phase?: 'idle' | 'connecting' | 'waiting-approval' | 'waiting-input' | 'thinking' | 'answering'
    compact?: boolean
}

type EntryMode = 'chat' | 'plan'
type ReasoningLevel = 'extra-high' | 'high' | 'medium' | 'low'

export function AssistantComposer({
    onSend,
    onCancelTurn,
    disabled,
    isSending,
    isThinking,
    isConnected,
    approvalMode,
    activeModel,
    modelOptions,
    modelsLoading,
    modelsError,
    onSelectModel,
    onRefreshModels,
    onEnableSafeMode,
    onRequestEnableYoloMode,
    activeProfile,
    phaseLabel = 'Ready',
    phase = 'idle',
    compact = false
}: AssistantComposerProps) {
    type QueuedDraft = {
        id: string
        prompt: string
        contextFiles: ComposerContextFile[]
        sendMetadata?: AssistantSendMetadata
    }

    const [text, setText] = useState('')
    const [contextFiles, setContextFiles] = useState<ComposerContextFile[]>([])
    const [queuedDrafts, setQueuedDrafts] = useState<QueuedDraft[]>([])
    const [sentPromptHistory, setSentPromptHistory] = useState<string[]>([])
    const [historyCursor, setHistoryCursor] = useState<number | null>(null)
    const [draftBeforeHistory, setDraftBeforeHistory] = useState('')
    const [showSlashMenu, setShowSlashMenu] = useState(false)
    const [showModelDropdown, setShowModelDropdown] = useState(false)
    const [showReasoningDropdown, setShowReasoningDropdown] = useState(false)
    const [showModeDropdown, setShowModeDropdown] = useState(false)
    const [showAccessDropdown, setShowAccessDropdown] = useState(false)
    const [previewAttachment, setPreviewAttachment] = useState<ComposerContextFile | null>(null)
    const [removingAttachmentIds, setRemovingAttachmentIds] = useState<string[]>([])
    const [entryMode, setEntryMode] = useState<EntryMode>('chat')
    const [reasoningLevel, setReasoningLevel] = useState<ReasoningLevel>('high')
    const [fastModeEnabled, setFastModeEnabled] = useState(false)
    const textareaRef = useRef<HTMLTextAreaElement>(null)
    const filePickerRef = useRef<HTMLInputElement>(null)
    const controlsRef = useRef<HTMLDivElement>(null)
    const queueDispatchingRef = useRef(false)
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
        if (!showModelDropdown && !showReasoningDropdown && !showModeDropdown && !showAccessDropdown) return
        const handleClickOutside = (event: MouseEvent) => {
            if (controlsRef.current && !controlsRef.current.contains(event.target as Node)) {
                setShowModelDropdown(false)
                setShowReasoningDropdown(false)
                setShowModeDropdown(false)
                setShowAccessDropdown(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [showModelDropdown, showReasoningDropdown, showModeDropdown, showAccessDropdown])

    useEffect(() => {
        if (!contextFiles.some((file) => file.animateIn)) return
        const rafId = window.requestAnimationFrame(() => {
            setContextFiles((prev) => prev.map((file) => (file.animateIn ? { ...file, animateIn: false } : file)))
        })
        return () => window.cancelAnimationFrame(rafId)
    }, [contextFiles])

    useEffect(() => {
        const textarea = textareaRef.current
        if (!textarea) return

        const computed = window.getComputedStyle(textarea)
        const lineHeight = Number.parseFloat(computed.lineHeight) || (compact ? 20 : 22)
        const verticalPadding = Number.parseFloat(computed.paddingTop) + Number.parseFloat(computed.paddingBottom)
        const maxLines = 5
        const minLines = compact ? 2 : 3
        const minHeight = Math.round((lineHeight * minLines) + verticalPadding)
        const maxHeight = Math.round((lineHeight * maxLines) + verticalPadding)
        const previousPlaceholder = textarea.placeholder
        const shouldIgnorePlaceholderMeasurement = textarea.value.length === 0

        textarea.style.height = 'auto'
        if (shouldIgnorePlaceholderMeasurement) {
            textarea.placeholder = ''
        }
        const measuredScrollHeight = textarea.scrollHeight
        if (shouldIgnorePlaceholderMeasurement) {
            textarea.placeholder = previousPlaceholder
        }
        const nextHeight = Math.max(minHeight, Math.min(measuredScrollHeight, maxHeight))
        textarea.style.height = `${nextHeight}px`
        textarea.style.overflowY = measuredScrollHeight > maxHeight ? 'auto' : 'hidden'
    }, [text, compact])

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

    const focusInput = () => {
        window.requestAnimationFrame(() => {
            textareaRef.current?.focus()
        })
    }

    const clearDraft = () => {
        setText('')
        setContextFiles([])
        setHistoryCursor(null)
        setDraftBeforeHistory('')
        try {
            localStorage.removeItem(DRAFT_STORAGE_KEY)
        } catch {
            // ignore storage errors
        }
        focusInput()
    }

    const rememberSentPrompt = (prompt: string) => {
        if (prompt.length === 0) return
        setSentPromptHistory((prev) => {
            if (prev[prev.length - 1] === prompt) return prev
            return [...prev.slice(-49), prompt]
        })
    }

    const handleSend = async () => {
        const prompt = text.trim()
        if ((prompt.length === 0 && contextFiles.length === 0) || disabled || isSending || !isConnected) return
        if (isThinking) {
            handleQueueDraft()
            return
        }

        // Capture state for possible rollback
        const prevText = text
        const prevFiles = contextFiles

        // Clear immediately for responsive feel
        clearDraft()

        const sendMetadata: AssistantSendMetadata = {
            entryMode,
            reasoningLevel,
            fastModeEnabled
        }
        const success = await onSend(prompt, contextFiles, sendMetadata)
        if (!success) {
            // Rollback if failed
            setText(prevText)
            setContextFiles(prevFiles)
            focusInput()
            return
        }

        rememberSentPrompt(prompt)
    }

    const handleQueueDraft = () => {
        const prompt = text.trim()
        if ((prompt.length === 0 && contextFiles.length === 0) || disabled || !isConnected || !isThinking) return
        const nextQueuedDraft: QueuedDraft = {
            id: createAttachmentId(),
            prompt,
            contextFiles: contextFiles.map((file) => ({ ...file, animateIn: false })),
            sendMetadata: {
                entryMode,
                reasoningLevel,
                fastModeEnabled
            }
        }
        setQueuedDrafts((prev) => [...prev, nextQueuedDraft])
        clearDraft()
    }

    const handleRemoveQueuedDraft = (id: string) => {
        setQueuedDrafts((prev) => prev.filter((draft) => draft.id !== id))
    }

    const handleForceQueuedDraftNow = (id: string) => {
        setQueuedDrafts((prev) => {
            const targetDraft = prev.find((draft) => draft.id === id)
            if (!targetDraft) return prev
            return [targetDraft, ...prev.filter((draft) => draft.id !== id)]
        })
        void onCancelTurn?.()
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
            if (onRequestEnableYoloMode) {
                await onRequestEnableYoloMode()
            } else {
                await window.devscope.assistant.setApprovalMode('yolo')
            }
            setText('')
            setShowSlashMenu(false)
            return
        }

        if (command === '/safe') {
            if (onEnableSafeMode) {
                await onEnableSafeMode()
            } else {
                await window.devscope.assistant.setApprovalMode('safe')
            }
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

    const reasoningLabel = (
        reasoningLevel === 'extra-high' ? 'Extra High'
            : reasoningLevel === 'high' ? 'High'
                : reasoningLevel === 'medium' ? 'Medium'
                    : 'Low'
    )
    const selectedModelDisplayLabel = resolvedModel === 'default' ? 'GPT-5.4' : selectedModelLabel
    const isFullAccess = String(approvalMode || activeProfile || '').toLowerCase().includes('yolo')

    const setApprovalMode = async (mode: 'safe' | 'yolo') => {
        if (mode === 'safe') {
            if (onEnableSafeMode) {
                await onEnableSafeMode()
            } else {
                await window.devscope.assistant.setApprovalMode('safe')
            }
        } else if (onRequestEnableYoloMode) {
            await onRequestEnableYoloMode()
        } else {
            await window.devscope.assistant.setApprovalMode('yolo')
        }
        setShowAccessDropdown(false)
    }

    useEffect(() => {
        if (queueDispatchingRef.current || isThinking || isSending || disabled || !isConnected || queuedDrafts.length === 0) return
        const nextDraft = queuedDrafts[0]
        if (!nextDraft) return

        queueDispatchingRef.current = true
        void (async () => {
            const success = await onSend(nextDraft.prompt, nextDraft.contextFiles, nextDraft.sendMetadata)
            if (success) {
                rememberSentPrompt(nextDraft.prompt)
                setQueuedDrafts((prev) => prev.filter((draft) => draft.id !== nextDraft.id))
            } else {
                setQueuedDrafts((prev) => prev.filter((draft) => draft.id !== nextDraft.id))
                if (!text.trim() && contextFiles.length === 0) {
                    setText(nextDraft.prompt)
                    setContextFiles(nextDraft.contextFiles)
                }
            }
            queueDispatchingRef.current = false
        })()
    }, [queuedDrafts, isThinking, isSending, disabled, isConnected, onSend, text, contextFiles])

    const hasDraftContent = text.trim().length > 0 || contextFiles.length > 0
    const canSendNow = !disabled && !isConnected ? false : !disabled && isConnected && !isThinking && hasDraftContent
    const showStopButton = isThinking
    const showQueueAsPrimary = isThinking && hasDraftContent
    const showPhaseIndicator = isConnected && phase !== 'idle'
    const phaseToneClass = phase === 'waiting-approval'
        ? 'text-amber-300'
        : phase === 'waiting-input'
            ? 'text-sky-300'
            : phase === 'answering'
                ? 'text-emerald-300'
                : 'text-sparkle-text-secondary'
    const queuedDraftLabel = queuedDrafts.length === 1 ? '1 queued' : `${queuedDrafts.length} queued`

    return (
        <div className={cn('relative flex flex-col', compact ? 'gap-1.5' : 'gap-2')}>
            {showSlashMenu && (
                <div className={cn(
                    'absolute bottom-full left-0 z-20 mb-2 overflow-hidden rounded-lg border border-white/10 bg-sparkle-card shadow-lg',
                    compact ? 'w-56' : 'w-64'
                )}>
                    <div className="flex items-center gap-2 border-b border-white/5 bg-sparkle-bg px-3 py-2">
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
                        const isPasted = isPastedTextAttachment(file)
                        const isRemoving = removingAttachmentIds.includes(file.id)
                        const isEntering = Boolean(file.animateIn)
                        
                        const displayName = isPasted 
                            ? 'Pasted text' 
                            : file.source === 'paste' && meta.category === 'image'
                                ? 'Pasted image'
                                : meta.name
                        
                        return (
                            <article
                                key={file.id}
                                className={cn(
                                    'group relative overflow-hidden rounded-lg border transition-all shadow-sm',
                                    meta.category === 'image'
                                        ? 'border-cyan-400/20 bg-gradient-to-br from-cyan-500/5 to-cyan-600/10 hover:border-cyan-400/40 hover:shadow-cyan-500/10'
                                        : meta.category === 'code'
                                            ? 'border-indigo-400/20 bg-gradient-to-br from-indigo-500/5 to-indigo-600/10 hover:border-indigo-400/40 hover:shadow-indigo-500/10'
                                            : 'border-white/10 bg-gradient-to-br from-sparkle-card to-sparkle-bg hover:border-white/20',
                                    compact ? 'w-[90px] max-w-[90px]' : 'w-[105px] max-w-[105px]'
                                )}
                                style={{
                                    transition: 'transform 190ms ease, opacity 190ms ease, filter 190ms ease, box-shadow 190ms ease',
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
                                    className="relative flex w-full flex-col overflow-hidden"
                                    disabled={isRemoving}
                                    title={isPasted ? `${displayName} - Click to preview` : `${meta.name} - Click to preview`}
                                >
                                    {meta.category === 'image' && file.previewDataUrl ? (
                                        <div className="relative h-16 w-full overflow-hidden bg-black/20">
                                            <img
                                                src={file.previewDataUrl}
                                                alt={displayName}
                                                className="h-full w-full object-cover"
                                            />
                                        </div>
                                    ) : (
                                        <div className={cn(
                                            'flex h-12 w-full items-center justify-center',
                                            meta.category === 'code'
                                                ? 'bg-indigo-500/5'
                                                : 'bg-sparkle-bg/50'
                                        )}>
                                            {meta.category === 'code' ? (
                                                <FileCode2 size={20} className="text-indigo-300/60" />
                                            ) : (
                                                <FileText size={20} className="text-sparkle-text-secondary/60" />
                                            )}
                                        </div>
                                    )}
                                    <div className="flex min-w-0 flex-1 items-center gap-1 px-2 py-1.5">
                                        <span className="min-w-0 flex-1 text-left">
                                            <span className="block truncate text-[10px] font-medium text-sparkle-text">{displayName}</span>
                                            <span className="block truncate font-mono text-[8px] uppercase tracking-wide text-sparkle-text-muted">{contentType}</span>
                                        </span>
                                    </div>
                                </button>
                                <button
                                    type="button"
                                    onClick={(event) => {
                                        event.stopPropagation()
                                        removeAttachment(file.id)
                                    }}
                                    className="absolute right-1 top-1 rounded-md bg-black/40 p-0.5 text-white/80 opacity-0 backdrop-blur-sm transition-all hover:bg-rose-500/80 hover:text-white group-hover:opacity-100"
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

            <AnimatedHeight isOpen={queuedDrafts.length > 0} duration={240}>
                <div className={cn('flex flex-col items-end', compact ? 'gap-1.5 pb-1' : 'gap-2 pb-1.5')}>
                    {queuedDrafts.map((draft, index) => {
                        const attachmentCount = draft.contextFiles.length
                        return (
                            <div
                                key={draft.id}
                                className={cn(
                                    'w-full border border-white/10 bg-sparkle-card/88 shadow-[0_-8px_24px_rgba(0,0,0,0.16)] backdrop-blur-sm animate-fadeIn',
                                    compact ? 'max-w-[88%] rounded-t-xl rounded-b-md px-3 py-2' : 'max-w-[92%] rounded-t-2xl rounded-b-lg px-4 py-2.5'
                                )}
                                style={{ animationDelay: `${index * 40}ms`, animationFillMode: 'both' }}
                            >
                                <div className="flex items-start gap-3">
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-2">
                                            <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-sparkle-text-muted">
                                                Queued
                                            </span>
                                            {attachmentCount > 0 && (
                                                <span className="text-[10px] text-sparkle-text-muted">
                                                    {attachmentCount} attachment{attachmentCount === 1 ? '' : 's'}
                                                </span>
                                            )}
                                        </div>
                                        <p className={cn('mt-1 truncate text-sparkle-text', compact ? 'text-[11px]' : 'text-xs')}>
                                            {draft.prompt || 'Attached context only'}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <button
                                            type="button"
                                            onClick={() => handleForceQueuedDraftNow(draft.id)}
                                            className="rounded-md border border-[var(--accent-primary)]/25 bg-[var(--accent-primary)]/10 px-2 py-1 text-[10px] font-semibold text-[var(--accent-primary)] transition-colors hover:bg-[var(--accent-primary)]/18"
                                        >
                                            Force now
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => handleRemoveQueuedDraft(draft.id)}
                                            className="rounded-md p-1 text-sparkle-text-muted transition-colors hover:bg-sparkle-bg hover:text-sparkle-text"
                                            title="Remove queued draft"
                                        >
                                            <X size={compact ? 12 : 13} />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )
                    })}
                </div>
            </AnimatedHeight>

            <div className={cn(
                'assistant-t3-composer-shell group relative z-10 flex flex-col rounded-xl border border-white/10 bg-sparkle-bg shadow-sm transition-colors focus-within:bg-sparkle-bg',
                compact ? 'gap-1.5 px-2 py-1.5' : 'gap-2 px-2.5 py-2'
            )}>
                <div className={cn('flex items-start', compact ? 'gap-2 px-1 py-0.5' : 'gap-2.5 px-1.5 py-1.5')}>
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
                            'mt-1 shrink-0 rounded-md border border-white/10 bg-sparkle-bg text-sparkle-text-secondary transition-colors hover:border-white/20 hover:bg-sparkle-card-hover hover:text-sparkle-text',
                            compact ? 'p-1.5' : 'p-2'
                        )}
                        title="Attach files"
                    >
                        <Paperclip size={compact ? 14 : 16} />
                    </button>

                    <div className="flex-1 flex items-end">
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
                                'assistant-t3-composer-input w-full resize-none overflow-y-auto bg-transparent px-1 leading-relaxed text-sparkle-text outline-none placeholder:text-sparkle-text-muted/40',
                                compact ? 'min-h-10 max-h-[6.75rem] text-[13px] py-2' : 'min-h-14 max-h-[8.5rem] text-sm py-3'
                            )}
                            placeholder={isConnected ? (compact ? 'Ask a question or run a command...' : 'Ask a question, edit code, or run commands...') : 'Connect assistant to start chatting...'}
                            disabled={disabled || !isConnected}
                        />
                    </div>

                </div>

                <div className={cn(
                    'assistant-t3-composer-meta relative z-0 -mx-2.5 -mb-2 -mt-0.5 flex items-center justify-between rounded-b-xl border-t border-white/5 bg-transparent px-2.5 pb-2 pt-3 font-medium tracking-tight',
                    compact ? 'text-[9px]' : 'text-[10px]'
                )}>
                    <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2 pr-2" ref={controlsRef}>
                        <div className="relative flex flex-col">
                            <div
                                className={cn(
                                    'pointer-events-none absolute bottom-full left-0 z-30 w-52 overflow-hidden',
                                    showModelDropdown ? 'pointer-events-auto' : 'pointer-events-none'
                                )}
                                >
                                <AnimatedHeight isOpen={showModelDropdown} duration={220}>
                                    <div className="space-y-1 rounded-lg border border-white/10 bg-sparkle-card p-2 shadow-lg">
                                        <div className="px-2.5 pb-1 pt-0.5 text-[10px] uppercase tracking-[0.12em] text-sparkle-text-muted">
                                            Model
                                        </div>
                                        <div className="max-h-64 space-y-0.5 overflow-y-auto scrollbar-hide">
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
                                                            'flex w-full items-center justify-between rounded-md px-2.5 py-2 text-left text-xs transition-colors',
                                                            isActive
                                                                ? 'bg-sparkle-bg text-sparkle-text'
                                                                : 'text-sparkle-text-secondary hover:bg-sparkle-bg hover:text-sparkle-text'
                                                        )}
                                                    >
                                                        <span className="truncate pr-3">{model.label || model.id}</span>
                                                        {isActive && <span>✓</span>}
                                                    </button>
                                                )
                                            })}
                                        </div>
                                        {modelsError && (
                                            <>
                                                <div className="my-1 border-t border-white/5" />
                                                <div className="px-2.5 py-1">
                                                    <p className="text-[10px] font-medium text-rose-400">{modelsError}</p>
                                                </div>
                                            </>
                                        )}
                                        {!modelsError && (
                                            <>
                                                <div className="my-1 border-t border-white/5" />
                                                <div className="px-2.5 py-1 text-[10px] text-sparkle-text-muted">
                                                    Select the model for this thread.
                                                </div>
                                            </>
                                        )}
                                        {modelsLoading && !modelsError && (
                                            <div className="px-2.5 pb-1 text-[10px] text-sparkle-text-muted">
                                                Updating model list...
                                            </div>
                                        )}
                                    </div>
                                </AnimatedHeight>
                            </div>
                            <button
                                type="button"
                                onClick={() => {
                                    setShowReasoningDropdown(false)
                                    setShowModeDropdown(false)
                                    setShowAccessDropdown(false)
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
                                    'flex shrink-0 items-center gap-2 rounded-md border border-transparent bg-transparent px-1.5 py-1.5 transition-colors hover:bg-sparkle-card-hover',
                                    showModelDropdown && 'bg-sparkle-card-hover',
                                    compact ? 'max-w-[120px]' : 'max-w-[160px]'
                                )}
                            >
                                <OpenAILogo className="h-4 w-4 shrink-0 text-sparkle-text-secondary" />
                                <span className={cn('flex-1 truncate text-left text-sparkle-text', compact ? 'text-[11px]' : 'text-xs')}>
                                    {selectedModelDisplayLabel}
                                </span>
                                <ChevronDown size={compact ? 11 : 12} className={cn('shrink-0 text-sparkle-text-muted transition-transform duration-300', showModelDropdown && 'rotate-180')} />
                            </button>
                        </div>

                        <div className="h-4 w-px shrink-0 bg-white/8" />

                        <div className="relative flex flex-col">
                            <div
                                className={cn(
                                    'pointer-events-none absolute bottom-full left-0 z-30 w-44 overflow-hidden',
                                    showReasoningDropdown ? 'pointer-events-auto' : 'pointer-events-none'
                                )}
                                >
                                <AnimatedHeight isOpen={showReasoningDropdown} duration={220}>
                                    <div className="space-y-1 rounded-lg border border-white/10 bg-sparkle-card p-2 shadow-lg">
                                        {([
                                            ['extra-high', 'Extra High'],
                                            ['high', 'High (default)'],
                                            ['medium', 'Medium'],
                                            ['low', 'Low']
                                        ] as Array<[ReasoningLevel, string]>).map(([value, label]) => (
                                            <button
                                                key={value}
                                                type="button"
                                                onClick={() => {
                                                    setReasoningLevel(value)
                                                    setShowReasoningDropdown(false)
                                                }}
                                                className={cn(
                                                    'flex w-full items-center justify-between rounded-md px-2.5 py-2 text-left text-xs transition-colors',
                                                    reasoningLevel === value
                                                        ? 'bg-sparkle-bg text-sparkle-text'
                                                        : 'text-sparkle-text-secondary hover:bg-sparkle-bg hover:text-sparkle-text'
                                                )}
                                            >
                                                <span>{label}</span>
                                                {reasoningLevel === value && <span>✓</span>}
                                            </button>
                                        ))}
                                        <div className="my-1 border-t border-white/5" />
                                        <div className="px-2.5 pb-1 pt-0.5 text-[10px] uppercase tracking-[0.12em] text-sparkle-text-muted">
                                            Fast Mode
                                        </div>
                                        {([
                                            ['off', false],
                                            ['on', true]
                                        ] as Array<[string, boolean]>).map(([label, value]) => (
                                            <button
                                                key={label}
                                                type="button"
                                                onClick={() => {
                                                    setFastModeEnabled(value)
                                                    setShowReasoningDropdown(false)
                                                }}
                                                className={cn(
                                                    'flex w-full items-center justify-between rounded-md px-2.5 py-2 text-left text-xs transition-colors',
                                                    fastModeEnabled === value
                                                        ? 'bg-sparkle-bg text-sparkle-text'
                                                        : 'text-sparkle-text-secondary hover:bg-sparkle-bg hover:text-sparkle-text'
                                                )}
                                            >
                                                <span>{label}</span>
                                                {fastModeEnabled === value && <span>✓</span>}
                                            </button>
                                        ))}
                                    </div>
                                </AnimatedHeight>
                            </div>
                            <button
                                type="button"
                                onClick={() => {
                                    setShowModelDropdown(false)
                                    setShowModeDropdown(false)
                                    setShowAccessDropdown(false)
                                    setShowReasoningDropdown((prev) => !prev)
                                }}
                                className={cn(
                                    'flex shrink-0 items-center gap-1.5 rounded-md border border-transparent bg-transparent px-1.5 py-1.5 text-sparkle-text-secondary transition-colors hover:bg-sparkle-card-hover hover:text-sparkle-text',
                                    showReasoningDropdown && 'bg-sparkle-card-hover text-sparkle-text'
                                )}
                            >
                                <span className={cn('whitespace-nowrap', compact ? 'text-[11px]' : 'text-xs')}>{reasoningLabel}</span>
                                <ChevronDown size={compact ? 11 : 12} className={cn('transition-transform duration-300', showReasoningDropdown && 'rotate-180')} />
                            </button>
                        </div>

                        <div className="h-4 w-px shrink-0 bg-white/8" />

                        <button
                            type="button"
                            onClick={() => setEntryMode(entryMode === 'chat' ? 'plan' : 'chat')}
                            className={cn(
                                'flex shrink-0 items-center gap-1.5 rounded-md border px-2 py-1.5 transition-all',
                                compact ? 'text-[11px]' : 'text-xs',
                                entryMode === 'chat'
                                    ? 'border-blue-400/30 bg-blue-500/10 text-blue-300 hover:bg-blue-500/15'
                                    : 'border-purple-400/30 bg-purple-500/10 text-purple-300 hover:bg-purple-500/15'
                            )}
                            title={`Switch to ${entryMode === 'chat' ? 'Plan' : 'Chat'} mode`}
                        >
                            <span className="whitespace-nowrap">{entryMode === 'chat' ? 'Chat' : 'Plan'}</span>
                        </button>

                        <div className="h-4 w-px shrink-0 bg-white/8" />

                        <button
                            type="button"
                            onClick={() => { void setApprovalMode(isFullAccess ? 'safe' : 'yolo') }}
                            className={cn(
                                'inline-flex shrink-0 items-center gap-2 rounded-md border px-2 py-1.5 transition-all',
                                compact ? 'text-[11px]' : 'text-xs',
                                isFullAccess
                                    ? 'border-amber-400/30 bg-amber-500/10 text-amber-300 hover:bg-amber-500/15'
                                    : 'border-green-400/30 bg-green-500/10 text-green-300 hover:bg-green-500/15'
                            )}
                            title={`Switch to ${isFullAccess ? 'Safe mode' : 'Full access'}`}
                        >
                            <Lock size={compact ? 11 : 12} />
                            <span className="whitespace-nowrap">
                                {isFullAccess ? 'Full access' : 'Safe mode'}
                            </span>
                        </button>
                    </div>

                    <div className="flex shrink-0 items-center gap-2">
                        {showPhaseIndicator && phase !== 'thinking' && phase !== 'answering' && (
                            <div className={cn(
                                'inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1.5',
                                compact ? 'text-[10px]' : 'text-[11px]'
                            )}>
                                {phase === 'connecting' && (
                                    <ActivityDots className={cn('inline-flex items-center gap-[3px]', phaseToneClass)} />
                                )}
                                <span className={cn('font-medium', phaseToneClass)}>
                                    {phaseLabel}
                                </span>
                            </div>
                        )}

                        {showStopButton && showQueueAsPrimary && (
                            <button
                                type="button"
                                onClick={() => void onCancelTurn?.()}
                                className={cn(
                                    'inline-flex items-center gap-1.5 rounded-full border border-rose-400/25 bg-rose-500/8 px-3 py-1.5 text-rose-300 shadow-sm transition-all animate-fadeIn hover:bg-rose-500/14',
                                    compact ? 'h-8 text-[11px]' : 'h-10 text-xs'
                                )}
                                title="Stop current turn"
                            >
                                <Square size={compact ? 12 : 13} className="fill-current" />
                                <span>Stop</span>
                            </button>
                        )}

                        <button
                            type="button"
                            disabled={showQueueAsPrimary ? false : (showStopButton ? false : !canSendNow)}
                            onClick={() => {
                                if (showQueueAsPrimary) {
                                    handleQueueDraft()
                                    return
                                }
                                if (showStopButton) {
                                    void onCancelTurn?.()
                                    return
                                }
                                void handleSend()
                            }}
                            className={cn(
                                'assistant-t3-composer-send inline-flex shrink-0 items-center justify-center rounded-xl border transition-all duration-200',
                                compact ? 'h-8 min-w-8 px-2.5' : 'h-10 min-w-10 px-3',
                                showQueueAsPrimary
                                    ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)] text-white hover:border-[var(--accent-primary)]/90 hover:bg-[var(--accent-primary)]/90'
                                    : showStopButton
                                    ? 'border-rose-400/30 bg-rose-500/10 text-rose-300 hover:bg-rose-500/15'
                                    : canSendNow
                                        ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)] text-white hover:border-[var(--accent-primary)]/90 hover:bg-[var(--accent-primary)]/90'
                                        : 'cursor-not-allowed border-white/10 bg-sparkle-bg text-sparkle-text-muted/70 opacity-45'
                            )}
                        >
                            {showQueueAsPrimary ? (
                                <>
                                    <SendHorizontal size={compact ? 14 : 15} />
                                    <span className={cn('ml-1', compact ? 'text-[11px]' : 'text-xs')}>
                                        {queuedDrafts.length > 0 ? `Queue (${queuedDraftLabel})` : 'Queue'}
                                    </span>
                                </>
                            ) : showStopButton ? (
                                <>
                                    <Square size={compact ? 12 : 13} className="fill-current" />
                                    <span className={cn('ml-1', compact ? 'text-[11px]' : 'text-xs')}>Stop</span>
                                </>
                            ) : isSending ? (
                                <Loader2 size={compact ? 15 : 16} className="animate-spin" />
                            ) : (
                                <SendHorizontal size={compact ? 15 : 16} />
                            )}
                        </button>
                    </div>
                </div>
            </div>

            <AssistantAttachmentPreviewModal
                file={previewAttachment}
                meta={previewAttachment ? getContextFileMeta(previewAttachment) : null}
                contentType={previewAttachment ? getContentTypeTag(previewAttachment) : ''}
                sizeLabel={previewAttachment ? toKbLabel(previewAttachment.sizeBytes) : ''}
                showFormattingWarning={shouldShowPastedTextFormattingWarning(previewAttachment)}
                onClose={() => setPreviewAttachment(null)}
            />
        </div >
    )
}
