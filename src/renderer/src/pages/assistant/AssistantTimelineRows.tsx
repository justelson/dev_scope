import { memo, useEffect, useMemo, useState } from 'react'
import { Check, CircleDot, Copy, FileImage, FileText, Loader2, Trash2 } from 'lucide-react'
import type { AssistantMessage } from '@shared/assistant/contracts'
import type { AssistantTextStreamingMode } from '@/lib/settings'
import MarkdownRenderer from '@/components/ui/MarkdownRenderer'
import { getFileUrl } from '@/components/ui/file-preview/utils'
import { cn } from '@/lib/utils'
import { formatAssistantDateTime } from '@/lib/assistant/selectors'
import { JulianLogo, OpenAILogo, T3CodeLogo } from './AssistantBrandMarks'
import {
    areMessagesEqual,
    canRenderAttachmentImage,
    copyTextToClipboard,
    formatWorkingTimer,
    parseUserMessageAttachments
} from './assistant-timeline-helpers'
import { useAssistantVisibleText } from './useAssistantVisibleText'

export { TimelineToolCallList } from './AssistantTimelineToolCalls'

export const TimelineMessage = memo(({
    message,
    isLatestAssistant = false,
    latestTurnStartedAt = null,
    deleting = false,
    assistantTextStreamingMode = 'stream',
    onRequestDelete,
    filePath = null,
    onInternalLinkClick
}: {
    message: AssistantMessage
    isLatestAssistant?: boolean
    latestTurnStartedAt?: string | null
    deleting?: boolean
    assistantTextStreamingMode?: AssistantTextStreamingMode
    onRequestDelete?: (message: AssistantMessage) => void
    filePath?: string | null
    onInternalLinkClick?: (href: string) => Promise<void> | void
}) => {
    const isAssistant = message.role === 'assistant'
    const copyValue = message.text || ''
    const parsedUserMessage = useMemo(
        () => message.role === 'user' ? parseUserMessageAttachments(message.text || '') : { body: message.text || '', attachments: [] },
        [message.role, message.text]
    )
    const userBodyLines = useMemo(
        () => parsedUserMessage.body ? parsedUserMessage.body.split(/\r?\n/) : [],
        [parsedUserMessage.body]
    )
    const shouldCollapseUserBody = userBodyLines.length > 9
    const [showFullUserBody, setShowFullUserBody] = useState(false)
    const [copied, setCopied] = useState(false)
    const [nowIso, setNowIso] = useState(() => new Date().toISOString())
    const visibleAssistantText = useAssistantVisibleText(message.text || '', Boolean(message.streaming), assistantTextStreamingMode)

    useEffect(() => {
        if (!message.streaming) return
        const intervalId = window.setInterval(() => setNowIso(new Date().toISOString()), 1000)
        return () => window.clearInterval(intervalId)
    }, [message.streaming])

    useEffect(() => {
        setShowFullUserBody(false)
    }, [message.id])

    const assistantElapsed = useMemo(
        () => !isAssistant || !isLatestAssistant || !latestTurnStartedAt
            ? null
            : formatWorkingTimer(latestTurnStartedAt, message.streaming ? nowIso : message.updatedAt),
        [isAssistant, isLatestAssistant, latestTurnStartedAt, message.streaming, message.updatedAt, nowIso]
    )

    if (isAssistant) {
        const renderedAssistantText = message.streaming ? (visibleAssistantText || ' ') : (message.text || ' ')
        return (
            <div className="max-w-4xl py-1">
                <MarkdownRenderer
                    content={renderedAssistantText}
                    filePath={filePath || undefined}
                    lightweight={message.streaming}
                    onInternalLinkClick={onInternalLinkClick}
                    className="text-[13px] leading-6 text-sparkle-text [&_p]:mb-3 [&_p]:leading-6 [&_li]:leading-6 [&_ul]:text-[13px] [&_ol]:text-[13px] [&_table]:text-[13px] [&_pre]:text-[12px] [&_code]:text-[12px]"
                />
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
                    <div className="mb-3 grid gap-2">
                        {parsedUserMessage.attachments.map((attachment) => {
                            const isImage = attachment.type === 'IMAGE'
                            const renderImage = isImage && canRenderAttachmentImage(attachment.path)
                            return (
                                <div key={attachment.id} className="overflow-hidden rounded-xl border border-white/10 bg-black/20">
                                    {renderImage ? (
                                        <div className="bg-black/30 p-1.5">
                                            <img
                                                src={getFileUrl(String(attachment.path))}
                                                alt={attachment.name}
                                                className="max-h-[220px] w-full rounded-lg object-cover"
                                                loading="lazy"
                                            />
                                        </div>
                                    ) : null}
                                    <div className="flex items-start gap-2.5 p-2.5">
                                        <div className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-md border', isImage ? 'border-cyan-400/20 bg-cyan-500/[0.10] text-cyan-300' : 'border-white/10 bg-white/[0.03] text-sparkle-text-secondary')}>
                                            {isImage ? <FileImage size={16} /> : <FileText size={16} />}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-2">
                                                <p className="min-w-0 truncate text-[12px] font-medium text-sparkle-text">{attachment.name}</p>
                                                <span className="shrink-0 rounded border border-white/10 bg-white/[0.03] px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.14em] text-sparkle-text-muted">{attachment.type}</span>
                                            </div>
                                            {attachment.path ? <p className="mt-1 truncate font-mono text-[11px] text-[var(--accent-primary)]">{attachment.path}</p> : null}
                                            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] text-sparkle-text-muted">
                                                {attachment.mime ? <span>{attachment.mime}</span> : null}
                                                {attachment.size ? <span>{attachment.size}</span> : null}
                                            </div>
                                            {attachment.preview && !renderImage ? <p className="mt-1 text-[11px] text-sparkle-text-secondary">{attachment.preview}</p> : null}
                                            {attachment.note && !renderImage ? <p className="mt-1 text-[10px] text-sparkle-text-muted/80">{attachment.note}</p> : null}
                                        </div>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                ) : null}
                {parsedUserMessage.body ? (
                    <div>
                        <p className="whitespace-pre-wrap break-words text-[13px] leading-6 text-sparkle-text">
                            {shouldCollapseUserBody && !showFullUserBody
                                ? userBodyLines.slice(0, 9).join('\n')
                                : parsedUserMessage.body}
                        </p>
                        {shouldCollapseUserBody ? (
                            <button
                                type="button"
                                onClick={() => setShowFullUserBody((current) => !current)}
                                className="mt-2 text-[12px] text-sparkle-text-muted transition-colors hover:text-sparkle-text"
                            >
                                {showFullUserBody ? 'Show less' : 'Show more'}
                            </button>
                        ) : null}
                    </div>
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
        && prev.latestTurnStartedAt === next.latestTurnStartedAt
        && prev.deleting === next.deleting
        && prev.assistantTextStreamingMode === next.assistantTextStreamingMode
        && prev.onRequestDelete === next.onRequestDelete
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
    isConnecting = false,
    connectingLabel = 'Connecting...'
}: {
    projectLabel?: string | null
    projectTitle?: string | null
    isConnecting?: boolean
    connectingLabel?: string
}) {
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
                    {projectLabel ? (
                        <span
                            className={cn(
                                'relative inline-flex max-w-[220px] shrink-0 items-center overflow-hidden rounded-full border px-2 py-0.5 text-[10px] font-medium leading-none',
                                isConnecting
                                    ? 'border-sky-400/20 bg-sky-500/10 text-sky-100'
                                    : 'border-white/10 bg-white/[0.03] text-sparkle-text-secondary'
                            )}
                            title={projectTitle || projectLabel}
                        >
                            {isConnecting ? <span className="absolute inset-0 animate-shimmer opacity-60" aria-hidden="true" /> : null}
                            <span className="relative z-10 truncate">{projectLabel}</span>
                        </span>
                    ) : null}
                    <div className="flex flex-col items-center gap-1">
                        <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-sparkle-text-muted/70 sm:text-xs">
                            #devsdontuselightmode
                        </p>
                        {isConnecting ? (
                            <div className="flex items-center gap-1.5 text-[10px] text-sky-300/80">
                                <Loader2 size={10} className="animate-spin" />
                                <span>{connectingLabel}</span>
                            </div>
                        ) : null}
                    </div>
                </div>
            </div>
        </div>
    )
}
