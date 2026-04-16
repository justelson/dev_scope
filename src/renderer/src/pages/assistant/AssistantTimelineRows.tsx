import { memo, useCallback, useEffect, useMemo, useState } from 'react'
import { Check, CircleDot, Copy, FileImage, FileText, Loader2, Trash2 } from 'lucide-react'
import type { AssistantMessage, AssistantProposedPlan, AssistantSessionTurnUsageEntry } from '@shared/assistant/contracts'
import type { PreviewOpenOptions } from '@/components/ui/file-preview/types'
import type { AssistantTextStreamingMode } from '@/lib/settings'
import MarkdownRenderer from '@/components/ui/MarkdownRenderer'
import { getFileUrl } from '@/components/ui/file-preview/utils'
import { cn } from '@/lib/utils'
import { formatAssistantDateTime } from '@/lib/assistant/selectors'
import { AssistantAttachmentImageCard } from './AssistantAttachmentImageCard'
import { JulianLogo, OpenAILogo, T3CodeLogo } from './AssistantBrandMarks'
import { CollapsibleUserMessageBody, StreamingAssistantText } from './AssistantTimelineText'
import {
    areMessagesEqual,
    canRenderAttachmentImage,
    copyTextToClipboard,
    formatWorkingTimer,
    isClipboardAttachmentReference,
    parseUserMessageAttachments
} from './assistant-timeline-helpers'
import { stripProposedPlanBlocks } from './assistant-proposed-plan'
import { useAssistantVisibleText } from './useAssistantVisibleText'
import { TimelineProposedPlan } from './AssistantTimelineProposedPlan'

export { TimelineToolCallList } from './AssistantTimelineToolCalls'

function getAttachmentPreviewTarget(attachmentName: string, attachmentPath: string): { name: string; ext: string } {
    const sourceName = String(attachmentName || '').trim() || String(attachmentPath || '').split(/[\\/]/).pop() || 'attachment'
    const dotIndex = sourceName.lastIndexOf('.')
    if (dotIndex <= 0 || dotIndex === sourceName.length - 1) {
        return { name: sourceName, ext: '' }
    }
    return {
        name: sourceName,
        ext: sourceName.slice(dotIndex + 1).toLowerCase()
    }
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
            <div className="max-w-4xl py-1">
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
                <div className="mt-3">
                    <p className="text-[11px] text-sparkle-text-muted">{formatAssistantDateTime(message.updatedAt)}{assistantElapsed ? <span className="ml-1.5 text-white"> • {assistantElapsed}</span> : null}</p>
                    {message.streaming ? <span className="inline-flex items-center gap-1 text-[11px] text-sparkle-text-secondary"><CircleDot size={10} className="animate-pulse" />{assistantTextStreamingMode === 'chunks' ? 'updating in chunks' : 'streaming'}</span> : null}
                </div>
            </div>
        )
    }

    return (
        <div className="ml-auto flex flex-col items-end py-1">
            <div className="group relative max-w-[36rem] rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5">
                {parsedUserMessage.attachments.length > 0 ? (
                    <div className="mb-1.5 grid gap-1">
                        {parsedUserMessage.attachments.map((attachment) => {
                            const isImage = attachment.type === 'IMAGE'
                            const resolvedAttachmentPath = attachment.path && isClipboardAttachmentReference(attachment.path)
                                ? (resolvedClipboardAttachmentPaths[attachment.id] || null)
                                : attachment.path
                            const renderImage = isImage && canRenderAttachmentImage(resolvedAttachmentPath)
                            const previewTarget = resolvedAttachmentPath ? getAttachmentPreviewTarget(attachment.name, resolvedAttachmentPath) : null
                            return (
                                renderImage ? (
                                    <AssistantAttachmentImageCard
                                        key={attachment.id}
                                        name={attachment.name}
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
                                ) : (
                                    <div key={attachment.id} className="w-[116px] overflow-hidden rounded-lg border border-white/10 bg-sparkle-card/95 shadow-lg shadow-black/20 backdrop-blur-xl">
                                        <div className="flex items-start gap-1 p-1.5">
                                            <div className={cn('flex h-5 w-5 shrink-0 items-center justify-center rounded-md border', isImage ? 'border-cyan-400/20 bg-cyan-500/[0.10] text-cyan-300' : 'border-white/10 bg-white/[0.03] text-sparkle-text-secondary')}>
                                                {isImage ? <FileImage size={12} /> : <FileText size={12} />}
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <div className="flex items-center gap-1">
                                                    <p className="min-w-0 truncate text-[9px] font-medium text-sparkle-text">{attachment.name}</p>
                                                    <span className="shrink-0 rounded border border-white/10 bg-white/[0.03] px-1 py-0.5 font-mono text-[7px] uppercase tracking-[0.12em] text-sparkle-text-muted">{attachment.type}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )
                            )
                        })}
                    </div>
                ) : null}
                {parsedUserMessage.body ? (
                    <CollapsibleUserMessageBody content={parsedUserMessage.body} />
                ) : null}
                <div className="mt-2 flex items-center justify-between gap-3 border-t border-white/5 pt-2">
                    <p className="text-[10px] text-sparkle-text-muted">{formatAssistantDateTime(message.updatedAt)}</p>
                    <div className="flex items-center gap-1 opacity-0 transition-all group-hover:opacity-100">
                        <button type="button" onClick={async () => { try { await copyTextToClipboard(copyValue); setCopied(true); window.setTimeout(() => setCopied(false), 1600) } catch {} }} className={cn('rounded-md border p-1 transition-all', copied ? 'border-emerald-400/20 bg-emerald-500/[0.08] text-emerald-300' : 'border-white/10 bg-white/[0.03] text-sparkle-text-muted hover:border-white/20 hover:text-sparkle-text')} title={copied ? 'Copied' : 'Copy message'}>{copied ? <Check size={12} /> : <Copy size={12} />}</button>
                        {onRequestDelete ? <button type="button" onClick={() => onRequestDelete(message)} disabled={deleting} className={cn('rounded-md border p-1 transition-all', deleting ? 'cursor-not-allowed border-red-400/20 bg-red-500/[0.08] text-red-200/70' : 'border-white/10 bg-white/[0.03] text-sparkle-text-muted hover:border-red-400/20 hover:bg-red-500/[0.08] hover:text-red-200')} title="Delete message from history"><Trash2 size={12} /></button> : null}
                    </div>
                </div>
            </div>
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
