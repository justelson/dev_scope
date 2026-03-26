import { memo, useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react'
import { ArrowUpRight, Check, ChevronUp, CircleDot, Copy, FileImage, FileText, Loader2, Play, Trash2 } from 'lucide-react'
import { createPortal } from 'react-dom'
import type { AssistantMessage, AssistantProposedPlan } from '@shared/assistant/contracts'
import type { PreviewOpenOptions } from '@/components/ui/file-preview/types'
import type { AssistantTextStreamingMode } from '@/lib/settings'
import MarkdownRenderer from '@/components/ui/MarkdownRenderer'
import { getFileUrl } from '@/components/ui/file-preview/utils'
import { cn } from '@/lib/utils'
import { formatAssistantDateTime } from '@/lib/assistant/selectors'
import { AssistantAttachmentImageCard } from './AssistantAttachmentImageCard'
import { JulianLogo, OpenAILogo, T3CodeLogo } from './AssistantBrandMarks'
import {
    areMessagesEqual,
    canRenderAttachmentImage,
    copyTextToClipboard,
    formatWorkingTimer,
    parseUserMessageAttachments
} from './assistant-timeline-helpers'
import { getDisplayedProposedPlanMarkdown, getProposedPlanTitle, stripProposedPlanBlocks } from './assistant-proposed-plan'
import { useAssistantVisibleText } from './useAssistantVisibleText'

export { TimelineToolCallList } from './AssistantTimelineToolCalls'

const USER_MESSAGE_COLLAPSED_LINE_COUNT = 9

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
    latestTurnStartedAt = null,
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
    latestTurnStartedAt?: string | null
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
    const userBodyRef = useRef<HTMLParagraphElement | null>(null)
    const [shouldCollapseUserBody, setShouldCollapseUserBody] = useState(false)
    const [collapsedUserBodyMaxHeight, setCollapsedUserBodyMaxHeight] = useState<number | null>(null)
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

    useEffect(() => {
        const element = userBodyRef.current
        if (!element || !parsedUserMessage.body) {
            setShouldCollapseUserBody(false)
            setCollapsedUserBodyMaxHeight(null)
            return
        }

        const recalculateCollapse = () => {
            const computedStyle = window.getComputedStyle(element)
            const fontSize = Number.parseFloat(computedStyle.fontSize || '13')
            const parsedLineHeight = Number.parseFloat(computedStyle.lineHeight || '')
            const lineHeight = Number.isFinite(parsedLineHeight) ? parsedLineHeight : fontSize * 1.5
            const collapsedMaxHeight = Math.round(lineHeight * USER_MESSAGE_COLLAPSED_LINE_COUNT)
            setCollapsedUserBodyMaxHeight(collapsedMaxHeight)
            setShouldCollapseUserBody(element.scrollHeight - collapsedMaxHeight > 2)
        }

        recalculateCollapse()
        const resizeObserver = new ResizeObserver(() => recalculateCollapse())
        resizeObserver.observe(element)
        return () => resizeObserver.disconnect()
    }, [parsedUserMessage.body])

    const assistantElapsed = useMemo(
        () => !isAssistant || !isLatestAssistant || !latestTurnStartedAt
            ? null
            : formatWorkingTimer(latestTurnStartedAt, message.streaming ? nowIso : message.updatedAt),
        [isAssistant, isLatestAssistant, latestTurnStartedAt, message.streaming, message.updatedAt, nowIso]
    )

    if (isAssistant) {
        const assistantText = message.streaming ? (visibleAssistantText || ' ') : (message.text || ' ')
        const renderedAssistantText = stripProposedPlanBlocks(assistantText) || (message.streaming ? ' ' : '')
        if (!renderedAssistantText.trim() && !message.streaming) return null
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
                    <div className="mb-1.5 grid gap-1">
                        {parsedUserMessage.attachments.map((attachment) => {
                            const isImage = attachment.type === 'IMAGE'
                            const renderImage = isImage && canRenderAttachmentImage(attachment.path)
                            const previewTarget = attachment.path ? getAttachmentPreviewTarget(attachment.name, attachment.path) : null
                            return (
                                renderImage ? (
                                    <AssistantAttachmentImageCard
                                        key={attachment.id}
                                        name={attachment.name}
                                        src={getFileUrl(String(attachment.path))}
                                        widthClassName="w-[116px]"
                                        heightClassName="h-[84px]"
                                        onClick={(onOpenAttachmentPreview || onOpenFilePath) && attachment.path ? () => {
                                            if (onOpenAttachmentPreview && previewTarget) {
                                                void onOpenAttachmentPreview({ name: previewTarget.name, path: attachment.path || '' }, previewTarget.ext)
                                                return
                                            }
                                            void onOpenFilePath?.(attachment.path || '')
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
                    <div>
                        <p
                            ref={userBodyRef}
                            className="whitespace-pre-wrap break-words text-[13px] leading-6 text-sparkle-text"
                            style={!showFullUserBody && shouldCollapseUserBody && collapsedUserBodyMaxHeight
                                ? { maxHeight: `${collapsedUserBodyMaxHeight}px`, overflow: 'hidden' }
                                : undefined}
                        >
                            {parsedUserMessage.body}
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
        && prev.onOpenFilePath === next.onOpenFilePath
        && prev.onOpenAttachmentPreview === next.onOpenAttachmentPreview
        && prev.filePath === next.filePath
        && prev.onInternalLinkClick === next.onInternalLinkClick
        && areMessagesEqual(prev.message, next.message)
})

export const TimelineProposedPlan = memo(({
    plan,
    canImplement = false,
    onImplement,
    onShowPlanPanel,
    scrollContainerRef,
    overlayContainerRef,
    filePath = null,
    onInternalLinkClick
}: {
    plan: AssistantProposedPlan
    canImplement?: boolean
    onImplement?: (plan: AssistantProposedPlan) => Promise<void> | void
    onShowPlanPanel?: () => void
    scrollContainerRef?: RefObject<HTMLDivElement | null>
    overlayContainerRef?: RefObject<HTMLDivElement | null>
    filePath?: string | null
    onInternalLinkClick?: (href: string) => Promise<void> | void
}) => {
    const [implementing, setImplementing] = useState(false)
    const [expanded, setExpanded] = useState(false)
    const [showFloatingCollapse, setShowFloatingCollapse] = useState(false)
    const planRef = useRef<HTMLElement | null>(null)
    const showFloatingCollapseRef = useRef(false)
    const floatingCollapseRafRef = useRef<number | null>(null)
    const previousScrollTopRef = useRef<number | null>(null)
    const displayedPlanMarkdown = useMemo(
        () => getDisplayedProposedPlanMarkdown(plan.planMarkdown || ''),
        [plan.planMarkdown]
    )
    const planTitle = useMemo(
        () => getProposedPlanTitle(plan.planMarkdown || '') || 'Implementation Plan',
        [plan.planMarkdown]
    )
    const previewClassName = 'text-[13px] leading-6 text-sparkle-text [&_p]:mb-3 [&_p]:leading-6 [&_li]:leading-6 [&_ul]:text-[13px] [&_ol]:text-[13px] [&_pre]:text-[12px] [&_code]:text-[12px]'
    const canExpandPlan = useMemo(() => {
        const planLines = displayedPlanMarkdown
            .split(/\r?\n/)
            .map((line) => line.trim())
            .filter(Boolean)
        return planLines.length > 14
    }, [displayedPlanMarkdown])

    const handleImplement = useCallback(async () => {
        if (!onImplement || !canImplement || implementing) return
        try {
            setImplementing(true)
            await onImplement(plan)
        } finally {
            setImplementing(false)
        }
    }, [canImplement, implementing, onImplement, plan])

    useEffect(() => {
        if (!expanded) {
            if (floatingCollapseRafRef.current !== null) {
                window.cancelAnimationFrame(floatingCollapseRafRef.current)
                floatingCollapseRafRef.current = null
            }
            previousScrollTopRef.current = null
            showFloatingCollapseRef.current = false
            setShowFloatingCollapse(false)
            return
        }

        const scrollContainer = scrollContainerRef?.current || planRef.current?.closest('.overflow-y-auto')

        const updateFloatingCollapse = (isScrollingUp: boolean) => {
            const node = planRef.current
            const container = scrollContainer instanceof HTMLElement ? scrollContainer : null
            if (!node || !container) return
            const nodeRect = node.getBoundingClientRect()
            const containerRect = container.getBoundingClientRect()
            const stillInsidePlan = nodeRect.bottom > containerRect.top + 72
            const nextVisible = isScrollingUp && nodeRect.top < containerRect.top - 32 && stillInsidePlan
            if (showFloatingCollapseRef.current !== nextVisible) {
                showFloatingCollapseRef.current = nextVisible
                setShowFloatingCollapse(nextVisible)
            }
        }

        const handleScroll = () => {
            if (floatingCollapseRafRef.current !== null) return
            floatingCollapseRafRef.current = window.requestAnimationFrame(() => {
                floatingCollapseRafRef.current = null
                if (!(scrollContainer instanceof HTMLElement)) return
                const currentScrollTop = scrollContainer.scrollTop
                const previousScrollTop = previousScrollTopRef.current
                const isScrollingUp = previousScrollTop !== null ? currentScrollTop < previousScrollTop : false
                previousScrollTopRef.current = currentScrollTop
                updateFloatingCollapse(isScrollingUp)
            })
        }

        if (scrollContainer instanceof HTMLElement) {
            previousScrollTopRef.current = scrollContainer.scrollTop
        }
        updateFloatingCollapse(false)
        if (!(scrollContainer instanceof HTMLElement)) {
            showFloatingCollapseRef.current = false
            setShowFloatingCollapse(false)
            return
        }
        scrollContainer.addEventListener('scroll', handleScroll, { passive: true })
        return () => {
            scrollContainer.removeEventListener('scroll', handleScroll)
            if (floatingCollapseRafRef.current !== null) {
                window.cancelAnimationFrame(floatingCollapseRafRef.current)
                floatingCollapseRafRef.current = null
            }
        }
    }, [expanded])

    const floatingCollapseButton = overlayContainerRef?.current
        ? createPortal(
            <div
                className={cn(
                    'pointer-events-none absolute inset-0 z-30 transition-all duration-200',
                    expanded && showFloatingCollapse ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0'
                )}
            >
                <div className="mx-auto flex h-full w-full max-w-3xl items-end justify-end px-4 pb-6">
                    <button
                        type="button"
                        onClick={() => setExpanded(false)}
                        className={cn(
                            'inline-flex h-9 items-center gap-1.5 rounded-full border border-white/10 bg-sparkle-card/95 px-3 text-[11px] font-medium text-sparkle-text-secondary shadow-[0_16px_40px_rgba(0,0,0,0.28)] backdrop-blur-xl transition-colors hover:border-white/20 hover:bg-white/[0.05] hover:text-sparkle-text',
                            expanded && showFloatingCollapse ? 'pointer-events-auto' : 'pointer-events-none'
                        )}
                    >
                        <span>Show less</span>
                        <ChevronUp size={12} />
                    </button>
                </div>
            </div>,
            overlayContainerRef.current
        )
        : null

    return (
        <div className="max-w-4xl py-1">
            <section
                ref={planRef}
                className="overflow-hidden rounded-2xl border border-white/10 bg-sparkle-card"
            >
                <div className="flex items-start justify-between gap-3 border-b border-white/5 px-4 py-3">
                    <div className="min-w-0">
                        <div className="flex items-center gap-2">
                            <span className="rounded-full border border-violet-400/20 bg-violet-500/[0.10] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-violet-200">
                                Plan
                            </span>
                            <span className="text-[11px] text-sparkle-text-muted">
                                {formatAssistantDateTime(plan.updatedAt)}
                            </span>
                        </div>
                        <p className="mt-1 truncate text-[13px] font-medium text-sparkle-text">
                            {planTitle}
                        </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                        {onShowPlanPanel ? (
                            <button
                                type="button"
                                onClick={onShowPlanPanel}
                                className="inline-flex h-8 items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-3 text-[11px] font-medium text-sparkle-text-secondary transition-colors hover:border-white/20 hover:bg-white/[0.05] hover:text-sparkle-text"
                                title="Open full plan in sidebar"
                            >
                                <ArrowUpRight size={12} />
                                <span>Show plan</span>
                            </button>
                        ) : null}
                        {onImplement && canImplement ? (
                            <button
                                type="button"
                                onClick={() => void handleImplement()}
                                disabled={implementing}
                                className={cn(
                                    'inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-[11px] font-medium transition-colors',
                                    implementing
                                        ? 'cursor-not-allowed border-white/8 bg-white/[0.03] text-sparkle-text-muted'
                                        : 'border-emerald-400/20 bg-emerald-500/[0.08] text-emerald-200 hover:border-emerald-300/35 hover:bg-emerald-500/[0.12]'
                                )}
                                title="Start implementing this reviewed plan"
                            >
                                {implementing ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />}
                                <span>{implementing ? 'Implementing...' : 'Implement'}</span>
                            </button>
                        ) : null}
                    </div>
                </div>
                <div className="relative px-4 py-3">
                    <div
                        className={cn(
                            'transition-[max-height] duration-300 ease-out',
                            expanded ? 'overflow-visible max-h-none' : 'overflow-hidden max-h-[22rem]'
                        )}
                    >
                        <MarkdownRenderer
                            content={displayedPlanMarkdown || ''}
                            filePath={filePath || undefined}
                            onInternalLinkClick={onInternalLinkClick}
                            className={previewClassName}
                        />
                    </div>
                    {canExpandPlan && !expanded ? (
                        <div className="pointer-events-none absolute inset-x-4 bottom-3 h-20 bg-gradient-to-t from-sparkle-card via-sparkle-card/92 to-transparent">
                            <div className="pointer-events-auto absolute inset-x-0 bottom-0 flex justify-center pb-1">
                                <button
                                    type="button"
                                    onClick={() => setExpanded(true)}
                                    className="inline-flex h-8 items-center gap-1.5 rounded-full border border-white/10 bg-sparkle-card px-3 text-[11px] font-medium text-sparkle-text-secondary shadow-[0_10px_30px_rgba(0,0,0,0.22)] transition-colors hover:border-white/20 hover:bg-white/[0.05] hover:text-sparkle-text"
                                >
                                    <span>Show more</span>
                                    <ChevronUp size={12} className="rotate-180" />
                                </button>
                            </div>
                        </div>
                    ) : null}
                </div>
                <div className="relative z-10 flex items-start justify-between gap-3 border-t border-white/5 bg-sparkle-card px-4 pb-3.5 pt-3">
                    <p className="flex-1 text-[11px] leading-[1.15rem] text-sparkle-text-muted">
                        Saved in conversation history as a standalone reviewable plan.
                    </p>
                    <div className="flex shrink-0 items-start gap-2">
                        {expanded && canExpandPlan ? (
                            <button
                                type="button"
                                onClick={() => setExpanded(false)}
                                className="shrink-0 pt-[1px] text-[11px] leading-[1.15rem] font-medium text-sparkle-text-muted underline decoration-white/25 underline-offset-4 transition-colors hover:text-sparkle-text"
                            >
                                Show less
                            </button>
                        ) : null}
                        {!canImplement ? (
                            <span className="rounded-full bg-white/[0.04] px-2 py-0.5 text-[10px] leading-[1.15rem] text-sparkle-text-muted">
                                Locked after newer messages
                            </span>
                        ) : null}
                    </div>
                </div>
            </section>
            {floatingCollapseButton}
        </div>
    )
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
