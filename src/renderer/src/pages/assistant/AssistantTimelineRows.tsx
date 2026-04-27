import { memo, useEffect, useMemo, useState } from 'react'
import { Check, Copy, Loader2, Trash2 } from 'lucide-react'
import type { AssistantActivity, AssistantMessage, AssistantProposedPlan, AssistantSessionTurnUsageEntry } from '@shared/assistant/contracts'
import type { ComposerContextFile } from './assistant-composer-types'
import type { PreviewOpenOptions } from '@/components/ui/file-preview/types'
import type { AssistantTextStreamingMode } from '@/lib/settings'
import MarkdownRenderer from '@/components/ui/MarkdownRenderer'
import { getFileUrl } from '@/components/ui/file-preview/utils'
import { cn } from '@/lib/utils'
import { formatAssistantDateTime } from '@/lib/assistant/selectors'
import AssistantAttachmentPreviewModal from './AssistantAttachmentPreviewModal'
import { AssistantFileAttachmentCard, AssistantPastedTextCard } from './AssistantAttachmentCards'
import { AssistantAttachmentImageCard } from './AssistantAttachmentImageCard'
import { JulianLogo, OpenAILogo, T3CodeLogo } from './AssistantBrandMarks'
import { CollapsibleUserMessageBody, StreamingAssistantText } from './AssistantTimelineText'
import { getContentTypeTag, getContextFileMeta, toKbLabel } from './assistant-composer-utils'
import {
    areMessagesEqual,
    canRenderAttachmentImage,
    copyTextToClipboard,
    formatWorkingTimer,
    getContextCompactionStatus,
    isClipboardAttachmentReference,
    parseUserMessageAttachments
} from './assistant-timeline-helpers'
import { stripProposedPlanBlocks } from './assistant-proposed-plan'
import { useAssistantVisibleText } from './useAssistantVisibleText'
import { TimelineProposedPlan } from './AssistantTimelineProposedPlan'

export { TimelineToolCallList } from './AssistantTimelineToolCalls'
export { TimelineIssueList } from './AssistantTimelineIssueList'
export { TimelineProposedPlan } from './AssistantTimelineProposedPlan'

function getCompactionLabelStyle(isRunning: boolean): React.CSSProperties | undefined {
    if (!isRunning) return undefined

    return {
        backgroundImage: 'linear-gradient(90deg, rgba(186,230,253,0.58), rgba(125,211,252,1), rgba(186,230,253,0.58))',
        backgroundSize: '240% 100%',
        WebkitBackgroundClip: 'text',
        backgroundClip: 'text',
        color: 'transparent',
        animation: 'shimmer 1.45s linear infinite'
    }
}

function getAttachmentPreviewTarget(attachmentName: string, attachmentPath: string): { name: string; ext: string } {
    const sourceName = String(attachmentName || '').trim() || String(attachmentPath || '').split(/[\\/]/).pop() || 'attachment'
    const pathName = String(attachmentPath || '').split(/[\\/]/).pop() || ''
    const sourceDotIndex = sourceName.lastIndexOf('.')
    if (sourceDotIndex > 0 && sourceDotIndex < sourceName.length - 1) {
        return {
            name: sourceName,
            ext: sourceName.slice(sourceDotIndex + 1).toLowerCase()
        }
    }

    const pathDotIndex = pathName.lastIndexOf('.')
    if (pathDotIndex > 0 && pathDotIndex < pathName.length - 1) {
        return {
            name: sourceName,
            ext: pathName.slice(pathDotIndex + 1).toLowerCase()
        }
    }

    return { name: sourceName, ext: '' }
}

export const TimelineMessage = memo(({
    message,
    isLatestAssistant = false,
    isLastAssistantInTurn = false,
    latestTurnStartedAt = null,
    turnUsage = null,
    deleting = false,
    assistantTextStreamingMode = 'stream',
    onRequestDelete,
    onOpenFilePath = undefined,
    onOpenAttachmentPreview = undefined,
    filePath = null,
    onInternalLinkClick
}: {
    message: AssistantMessage
    isLatestAssistant?: boolean
    isLastAssistantInTurn?: boolean
    latestTurnStartedAt?: string | null
    turnUsage?: AssistantSessionTurnUsageEntry | null
    deleting?: boolean
    assistantTextStreamingMode?: AssistantTextStreamingMode
    onRequestDelete?: (message: AssistantMessage) => void
    onOpenFilePath?: (filePath: string) => Promise<void> | void
    onOpenAttachmentPreview?: (
        file: { name: string; path: string },
        ext: string,
        options?: PreviewOpenOptions
    ) => Promise<void> | void
    filePath?: string | null
    onInternalLinkClick?: (href: string) => Promise<void> | void
}) => {
    const isAssistant = message.role === 'assistant'
    const copyValue = message.text || ''
    const parsedUserMessage = useMemo(
        () => message.role === 'user' ? parseUserMessageAttachments(message.text || '') : { body: message.text || '', attachments: [] },
        [message.role, message.text]
    )
    const [resolvedClipboardAttachmentPaths, setResolvedClipboardAttachmentPaths] = useState<Record<string, string>>({})
    const [copied, setCopied] = useState(false)
    const [nowIso, setNowIso] = useState(() => new Date().toISOString())
    const [previewAttachment, setPreviewAttachment] = useState<ComposerContextFile | null>(null)
    const visibleAssistantText = useAssistantVisibleText(message.text || '', Boolean(message.streaming), assistantTextStreamingMode)

    useEffect(() => {
        if (!message.streaming) return
        const intervalId = window.setInterval(() => setNowIso(new Date().toISOString()), 1000)
        return () => window.clearInterval(intervalId)
    }, [message.streaming])

    useEffect(() => {
        let cancelled = false
        const clipboardAttachments = parsedUserMessage.attachments.filter((attachment) => isClipboardAttachmentReference(attachment.path))

        if (clipboardAttachments.length === 0) {
            setResolvedClipboardAttachmentPaths({})
            return () => {
                cancelled = true
            }
        }

        void (async () => {
            const resolvedEntries = await Promise.all(
                clipboardAttachments.map(async (attachment) => {
                    const result = await window.devscope.assistant.resolveClipboardAttachment({
                        reference: attachment.path || ''
                    })
                    if (!result.success || !result.path) return null
                    return [attachment.id, result.path] as const
                })
            )

            if (cancelled) return

            setResolvedClipboardAttachmentPaths(
                Object.fromEntries(resolvedEntries.filter((entry): entry is readonly [string, string] => Boolean(entry)))
            )
        })()

        return () => {
            cancelled = true
        }
    }, [parsedUserMessage.attachments])

    const assistantElapsed = useMemo(() => {
        if (!isAssistant || !isLastAssistantInTurn) return null

        if (isLatestAssistant && latestTurnStartedAt) {
            return formatWorkingTimer(latestTurnStartedAt, message.streaming ? nowIso : message.updatedAt)
        }

        const turnStartedAt = turnUsage?.startedAt || turnUsage?.requestedAt || null
        const turnCompletedAt = turnUsage?.completedAt || message.updatedAt
        if (!turnStartedAt) return null

        return formatWorkingTimer(turnStartedAt, message.streaming ? nowIso : turnCompletedAt)
    }, [
        isAssistant,
        isLastAssistantInTurn,
        isLatestAssistant,
        latestTurnStartedAt,
        message.streaming,
        message.updatedAt,
        nowIso,
        turnUsage?.completedAt,
        turnUsage?.requestedAt,
        turnUsage?.startedAt
    ])

    if (isAssistant) {
        const assistantText = message.streaming ? (visibleAssistantText || ' ') : (message.text || ' ')
        const renderedAssistantText = stripProposedPlanBlocks(assistantText) || (message.streaming ? ' ' : '')
        if (!renderedAssistantText.trim() && !message.streaming) return null

        return (
            <div className="group max-w-4xl py-1">
                {message.streaming ? (
                    <StreamingAssistantText
                        content={renderedAssistantText || ' '}
                        className="text-[13px] leading-6 text-sparkle-text [overflow-wrap:anywhere]"
                    />
                ) : (
                    <MarkdownRenderer
                        content={renderedAssistantText}
                        filePath={filePath || undefined}
                        onInternalLinkClick={onInternalLinkClick}
                        className="text-[13px] leading-6 text-sparkle-text [&_p]:mb-3 [&_p]:leading-6 [&_li]:leading-6 [&_ul]:text-[13px] [&_ol]:text-[13px] [&_table]:text-[13px] [&_pre]:text-[12px] [&_code]:text-[12px]"
                    />
                )}
                <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-sparkle-text-muted">
                    <span>{formatAssistantDateTime(message.updatedAt)}</span>
                    {assistantElapsed ? <span className="text-sparkle-text">| {assistantElapsed}</span> : null}
                    {isLastAssistantInTurn && copyValue.trim() ? (
                        <button
                            type="button"
                            onClick={async () => {
                                try {
                                    await copyTextToClipboard(copyValue)
                                    setCopied(true)
                                    window.setTimeout(() => setCopied(false), 1600)
                                } catch {}
                            }}
                            className={cn(
                                'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 opacity-0 transition-all duration-150 group-hover:opacity-100',
                                copied
                                    ? 'border-emerald-400/20 bg-emerald-500/[0.08] text-emerald-200'
                                    : 'border-transparent bg-white/[0.03] text-sparkle-text-secondary hover:bg-white/[0.05] hover:text-sparkle-text'
                            )}
                            title={copied ? 'Copied' : 'Copy message'}
                        >
                            {copied ? <Check size={11} /> : <Copy size={11} />}
                            <span>{copied ? 'Copied' : 'Copy'}</span>
                        </button>
                    ) : null}
                </div>
            </div>
        )
    }

    return (
        <div className="ml-auto flex flex-col items-end py-1">
            <div className="group relative max-w-[36rem]">
                <div className="rounded-[1.15rem] border border-white/10 bg-white/[0.03] px-4 py-2.5">
                    {parsedUserMessage.attachments.length > 0 ? (
                        <div
                            className={cn(
                                'mb-1.5 max-w-full overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
                                parsedUserMessage.attachments.length > 3 ? 'w-full max-w-[372px]' : 'max-w-[372px]'
                            )}
                        >
                            <div className="flex w-max min-w-full gap-2">
                            {parsedUserMessage.attachments.map((attachment) => {
                                const isImage = attachment.type === 'IMAGE'
                                const resolvedAttachmentPath = attachment.path && isClipboardAttachmentReference(attachment.path)
                                    ? (resolvedClipboardAttachmentPaths[attachment.id] || null)
                                    : attachment.path
                                const renderImage = isImage && canRenderAttachmentImage(resolvedAttachmentPath)
                                const previewTarget = resolvedAttachmentPath ? getAttachmentPreviewTarget(attachment.name, resolvedAttachmentPath) : null
                                const canPreviewInlineText = Boolean(
                                    attachment.content
                                    && attachment.type !== 'IMAGE'
                                )
                                const previewAttachmentFile: ComposerContextFile | null = canPreviewInlineText
                                    ? {
                                        id: attachment.id,
                                        path: attachment.path || attachment.displayName,
                                        name: attachment.displayName,
                                        mimeType: attachment.mime || 'text/plain',
                                        kind: attachment.type === 'CODE' ? 'code' : 'doc',
                                        content: attachment.content || '',
                                        previewText: attachment.preview || undefined,
                                        sizeBytes: attachment.size ? Number.parseInt(attachment.size, 10) : undefined,
                                        source: 'paste' as const
                                    }
                                    : null
                                return (
                                    renderImage ? (
                                        <AssistantAttachmentImageCard
                                            key={attachment.id}
                                            name={attachment.displayName}
                                            src={getFileUrl(String(resolvedAttachmentPath))}
                                            widthClassName="w-[116px]"
                                            heightClassName="h-[84px]"
                                            onClick={(onOpenAttachmentPreview || onOpenFilePath) && resolvedAttachmentPath ? () => {
                                                if (onOpenAttachmentPreview && previewTarget) {
                                                    void onOpenAttachmentPreview({ name: previewTarget.name, path: resolvedAttachmentPath }, previewTarget.ext)
                                                    return
                                                }
                                                void onOpenFilePath?.(resolvedAttachmentPath)
                                            } : undefined}
                                        />
                                    ) : attachment.isClipboard && attachment.type !== 'IMAGE' ? (
                                        <AssistantPastedTextCard
                                            key={attachment.id}
                                            widthClassName="w-[108px]"
                                            onClick={previewAttachmentFile ? () => setPreviewAttachment(previewAttachmentFile) : undefined}
                                            previewText={attachment.content || attachment.preview}
                                        />
                                    ) : (
                                        <AssistantFileAttachmentCard
                                            key={attachment.id}
                                            widthClassName="w-[116px]"
                                            name={attachment.displayName}
                                            contentType={attachment.type}
                                            category={attachment.type === 'CODE' ? 'code' : 'doc'}
                                            pathLabel={attachment.isClipboard ? null : attachment.path}
                                            previewText={attachment.preview}
                                            onClick={
                                                resolvedAttachmentPath && (onOpenAttachmentPreview || onOpenFilePath)
                                                    ? () => {
                                                        if (onOpenAttachmentPreview && previewTarget) {
                                                            void onOpenAttachmentPreview({ name: previewTarget.name, path: resolvedAttachmentPath }, previewTarget.ext)
                                                            return
                                                        }
                                                        void onOpenFilePath?.(resolvedAttachmentPath)
                                                    }
                                                    : previewAttachmentFile
                                                        ? () => setPreviewAttachment(previewAttachmentFile)
                                                        : undefined
                                            }
                                        />
                                    )
                                )
                            })}
                            </div>
                        </div>
                    ) : null}
                    {parsedUserMessage.body ? (
                        <CollapsibleUserMessageBody content={parsedUserMessage.body} />
                    ) : null}
                </div>
                <div className="mt-2 flex items-center justify-between gap-3 px-1 opacity-0 transition-all duration-150 group-hover:opacity-100">
                    <p className="text-[10px] text-sparkle-text-muted">{formatAssistantDateTime(message.updatedAt)}</p>
                    <div className="flex items-center gap-1">
                        <button type="button" onClick={async () => { try { await copyTextToClipboard(copyValue); setCopied(true); window.setTimeout(() => setCopied(false), 1600) } catch {} }} className={cn('rounded-md border p-1 transition-all', copied ? 'border-emerald-400/20 bg-emerald-500/[0.08] text-emerald-300' : 'border-white/10 bg-white/[0.03] text-sparkle-text-muted hover:border-white/20 hover:text-sparkle-text')} title={copied ? 'Copied' : 'Copy message'}>{copied ? <Check size={12} /> : <Copy size={12} />}</button>
                        {onRequestDelete ? <button type="button" onClick={() => onRequestDelete(message)} disabled={deleting} className={cn('rounded-md border p-1 transition-all', deleting ? 'cursor-not-allowed border-red-400/20 bg-red-500/[0.08] text-red-200/70' : 'border-white/10 bg-white/[0.03] text-sparkle-text-muted hover:border-red-400/20 hover:bg-red-500/[0.08] hover:text-red-200')} title="Delete message from history"><Trash2 size={12} /></button> : null}
                    </div>
                </div>
            </div>
            <AssistantAttachmentPreviewModal
                file={previewAttachment}
                meta={previewAttachment ? getContextFileMeta(previewAttachment) : null}
                contentType={previewAttachment ? getContentTypeTag(previewAttachment) : ''}
                sizeLabel={previewAttachment ? toKbLabel(previewAttachment.sizeBytes) : ''}
                showFormattingWarning={false}
                readOnly
                onClose={() => setPreviewAttachment(null)}
            />
        </div>
    )
}, (prev, next) => {
    return prev.isLatestAssistant === next.isLatestAssistant
        && prev.isLastAssistantInTurn === next.isLastAssistantInTurn
        && prev.latestTurnStartedAt === next.latestTurnStartedAt
        && prev.turnUsage?.id === next.turnUsage?.id
        && prev.turnUsage?.requestedAt === next.turnUsage?.requestedAt
        && prev.turnUsage?.startedAt === next.turnUsage?.startedAt
        && prev.turnUsage?.completedAt === next.turnUsage?.completedAt
        && prev.deleting === next.deleting
        && prev.assistantTextStreamingMode === next.assistantTextStreamingMode
        && prev.onRequestDelete === next.onRequestDelete
        && prev.onOpenFilePath === next.onOpenFilePath
        && prev.onOpenAttachmentPreview === next.onOpenAttachmentPreview
        && prev.filePath === next.filePath
        && prev.onInternalLinkClick === next.onInternalLinkClick
        && areMessagesEqual(prev.message, next.message)
})

export function TimelineContextCompactionMarker({ activity }: { activity: AssistantActivity }) {
    const status = getContextCompactionStatus(activity)
    const isRunning = status === 'running'
    const label = isRunning ? 'AUTO-COMPACTING' : 'AUTO-COMPACTED'
    const labelStyle = getCompactionLabelStyle(isRunning)

    return (
        <div className="max-w-4xl py-2" aria-live={isRunning ? 'polite' : undefined}>
            <div className="flex items-center gap-3">
                <span className={cn(
                    'h-px flex-1 bg-gradient-to-r from-transparent via-white/8 to-white/10',
                    isRunning && 'via-sky-300/25 to-sky-300/15'
                )} />
                <span className={cn(
                    'relative isolate overflow-hidden rounded-full border border-transparent bg-white/[0.03] px-3 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.24em] text-sparkle-text-secondary shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]',
                    isRunning && 'bg-sky-500/[0.08] text-sky-100'
                )}>
                    <span className="relative z-10" style={labelStyle}>{label}</span>
                </span>
                <span className={cn(
                    'h-px flex-1 bg-gradient-to-r from-white/10 via-white/8 to-transparent',
                    isRunning && 'from-sky-300/15 via-sky-300/25'
                )} />
            </div>
        </div>
    )
}

export function TimelineWorkingIndicator({ startedAt, label = 'Working...' }: { startedAt?: string | null; label?: string }) {
    const [nowIso, setNowIso] = useState(() => new Date().toISOString())
    useEffect(() => {
        const intervalId = window.setInterval(() => setNowIso(new Date().toISOString()), 1000)
        return () => window.clearInterval(intervalId)
    }, [])
    const elapsed = startedAt ? formatWorkingTimer(startedAt, nowIso) : null
    const statusText = label === 'Connecting...'
        ? label
        : elapsed ? `Working for ${elapsed}` : label
    return (
        <div className="max-w-4xl py-0.5">
            <div className="flex items-center gap-2 pt-1 text-[11px] text-sparkle-text-secondary/70">
                <span className="inline-flex items-center gap-[3px]">
                    <span className="h-1 w-1 animate-pulse rounded-full bg-white/30" />
                    <span className="h-1 w-1 animate-pulse rounded-full bg-white/30 [animation-delay:200ms]" />
                    <span className="h-1 w-1 animate-pulse rounded-full bg-white/30 [animation-delay:400ms]" />
                </span>
                <span>{statusText}</span>
                <Loader2 size={11} className="animate-spin text-white/30" />
            </div>
        </div>
    )
}

export function TimelineEmptyState({
    projectLabel = null,
    projectTitle = null,
    sessionMode = 'work',
    showStatusIndicator = false,
    statusIndicatorLabel = 'Connecting...'
}: {
    projectLabel?: string | null
    projectTitle?: string | null
    sessionMode?: 'work' | 'playground'
    showStatusIndicator?: boolean
    statusIndicatorLabel?: string
}) {
    const heading = null
    const detail = null

    return (
        <div className="flex h-full min-h-[420px] items-center justify-center">
            <div className="w-full max-w-3xl px-6 py-10">
                <div className="mx-auto flex max-w-2xl flex-col items-center gap-6 text-center">
                    <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-5">
                        <JulianLogo className="h-11 w-11 text-sparkle-text sm:h-14 sm:w-14" />
                        <span className="text-xl font-light text-sparkle-text-muted/35 sm:text-2xl">X</span>
                        <T3CodeLogo className="h-11 w-11 sm:h-14 sm:w-14" />
                        <span className="text-xl font-light text-sparkle-text-muted/35 sm:text-2xl">X</span>
                        <OpenAILogo className="h-11 w-11 text-[#10a37f] sm:h-14 sm:w-14" />
                    </div>
                    {projectLabel || showStatusIndicator ? (
                        <div className="flex flex-wrap items-center justify-center gap-2">
                            {projectLabel ? (
                                <span
                                    className="inline-flex max-w-[220px] shrink-0 items-center overflow-hidden rounded-full border border-white/10 bg-white/[0.03] px-2 py-0.5 text-[10px] font-medium leading-none text-sparkle-text-secondary"
                                    title={projectTitle || projectLabel}
                                >
                                    <span className="truncate">{projectLabel}</span>
                                </span>
                            ) : null}
                            {showStatusIndicator ? (
                                <div className="relative inline-flex items-center overflow-hidden rounded-full border border-sky-400/20 bg-sky-500/[0.10] px-3 py-1 text-[10px] font-medium leading-none text-sky-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                                    <span className="absolute inset-0 animate-shimmer opacity-60" aria-hidden="true" />
                                    <span className="relative z-10 inline-flex items-center gap-2">
                                        <span className="h-1.5 w-1.5 rounded-full bg-sky-300/90 animate-pulse" />
                                        <span>{statusIndicatorLabel}</span>
                                    </span>
                                </div>
                            ) : null}
                        </div>
                    ) : null}
                    <div className="flex flex-col items-center gap-1">
                        <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-sparkle-text-muted/70 sm:text-xs">
                            #devsdontuselightmode
                        </p>
                        <div className="mt-1 space-y-1">
                            {heading ? <p className="text-sm font-medium text-sparkle-text">{heading}</p> : null}
                            {detail ? <p className="max-w-[30rem] text-xs leading-5 text-sparkle-text-muted/70">{detail}</p> : null}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
