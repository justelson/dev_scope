import { useEffect, useRef, useState } from 'react'
import { Check, ChevronUp, Copy } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { AssistantHistoryAttachment } from './assistant-page-types'

const USER_COLLAPSED_LINE_COUNT = 7
const USER_COLLAPSED_MAX_HEIGHT_PX = USER_COLLAPSED_LINE_COUNT * 24
const USER_COLLAPSED_FADE_HEIGHT_PX = 160
const USER_FLOATING_COLLAPSE_BOTTOM_PX = 176

export function CollapsiblePlainMessage({
    text,
    isUser,
    attachments = []
}: {
    text: string
    isUser: boolean
    attachments?: AssistantHistoryAttachment[]
}) {
    const [isCollapsed, setIsCollapsed] = useState(true)
    const [canCollapse, setCanCollapse] = useState(false)
    const [showFloatingCollapse, setShowFloatingCollapse] = useState(false)
    const [floatingRightPx, setFloatingRightPx] = useState(24)
    const [copied, setCopied] = useState(false)
    const contentRef = useRef<HTMLDivElement | null>(null)
    const sectionRef = useRef<HTMLDivElement | null>(null)
    const lastScrollYRef = useRef(0)

    const getScrollParent = (node: HTMLElement | null): HTMLElement | Window => {
        if (!node) return window
        let parent: HTMLElement | null = node.parentElement

        while (parent) {
            const styles = window.getComputedStyle(parent)
            const overflowY = styles.overflowY
            const canScroll = (overflowY === 'auto' || overflowY === 'scroll') && parent.scrollHeight > parent.clientHeight
            if (canScroll) return parent
            parent = parent.parentElement
        }

        return window
    }

    const handleCollapseToTop = () => {
        const section = sectionRef.current
        const scrollParent = getScrollParent(section)
        setIsCollapsed(true)

        if (scrollParent === window) {
            const top = section?.getBoundingClientRect().top || 0
            window.scrollTo({ top: Math.max(0, window.scrollY + top - 8), behavior: 'smooth' })
        } else if (section) {
            const parent = scrollParent as HTMLElement
            const parentRect = parent.getBoundingClientRect()
            const sectionRect = section.getBoundingClientRect()
            const targetTop = parent.scrollTop + (sectionRect.top - parentRect.top) - 8
            parent.scrollTo({ top: Math.max(0, targetTop), behavior: 'smooth' })
        }
    }

    useEffect(() => {
        const contentHeight = contentRef.current?.scrollHeight || 0
        const shouldCollapse = isUser && contentHeight > (USER_COLLAPSED_MAX_HEIGHT_PX + 6)
        setCanCollapse(shouldCollapse)
        if (!shouldCollapse) {
            setIsCollapsed(false)
        } else {
            setIsCollapsed(true)
        }
    }, [text, isUser])

    useEffect(() => {
        if (!isUser || !canCollapse || isCollapsed) {
            setShowFloatingCollapse(false)
            return
        }

        setShowFloatingCollapse(true)
        const section = sectionRef.current
        if (!section) return
        const scrollParent = getScrollParent(section)

        const getScrollTop = () => (
            scrollParent === window
                ? window.scrollY
                : (scrollParent as HTMLElement).scrollTop
        )

        const updateFloatingRight = () => {
            const sectionRect = section.getBoundingClientRect()
            const rightOffset = Math.max(16, window.innerWidth - sectionRect.right + 16)
            setFloatingRightPx((prev) => (Math.abs(prev - rightOffset) < 1 ? prev : rightOffset))
        }

        const updateFloatingState = () => {
            const currentY = getScrollTop()
            const scrollingUp = currentY < lastScrollYRef.current - 2
            const scrollingDown = currentY > lastScrollYRef.current + 2
            lastScrollYRef.current = currentY

            if (scrollingDown) {
                setShowFloatingCollapse(false)
            } else if (scrollingUp) {
                setShowFloatingCollapse(true)
            }
            updateFloatingRight()
        }

        lastScrollYRef.current = getScrollTop()
        updateFloatingRight()
        updateFloatingState()
        if (scrollParent === window) {
            window.addEventListener('scroll', updateFloatingState, { passive: true })
        } else {
            ;(scrollParent as HTMLElement).addEventListener('scroll', updateFloatingState, { passive: true })
        }
        window.addEventListener('resize', updateFloatingState)

        return () => {
            if (scrollParent === window) {
                window.removeEventListener('scroll', updateFloatingState)
            } else {
                ;(scrollParent as HTMLElement).removeEventListener('scroll', updateFloatingState)
            }
            window.removeEventListener('resize', updateFloatingState)
        }
    }, [isUser, canCollapse, isCollapsed])

    const showFade = canCollapse && isCollapsed
    const visibleAttachments = attachments.slice(0, 6)

    const resolveAttachmentName = (attachment: AssistantHistoryAttachment, index: number): string => {
        const trimmedName = String(attachment.name || '').trim()
        if (trimmedName) return trimmedName
        const rawPath = String(attachment.path || '').trim()
        if (!rawPath) return `attachment-${index + 1}`
        const leaf = rawPath.split(/[/\\]/).pop()
        return leaf || rawPath
    }

    const resolveAttachmentKind = (attachment: AssistantHistoryAttachment): 'image' | 'text' | 'file' => {
        const kind = String(attachment.kind || '').toLowerCase()
        const mimeType = String(attachment.mimeType || '').toLowerCase()
        if (kind === 'image' || mimeType.startsWith('image/')) return 'image'
        if (kind === 'doc' || kind === 'code' || mimeType.startsWith('text/')) return 'text'
        if (attachment.textPreview) return 'text'
        return 'file'
    }

    const handleCopy = async () => {
        const raw = String(text || '')
        if (!raw.trim()) return
        await window.devscope.copyToClipboard(raw)
        setCopied(true)
        window.setTimeout(() => setCopied(false), 1400)
    }

    return (
        <div ref={sectionRef} className={cn('group max-w-full', isUser ? 'ml-auto w-auto' : 'w-full')}>
            <div className={cn(
                'relative max-w-[78ch] rounded-2xl px-4 py-3 shadow-sm border whitespace-pre-wrap text-[15px] leading-6 text-sparkle-text bg-sparkle-card border-sparkle-border',
                isUser && 'ml-auto'
            )}>
                {isUser && (
                    <button
                        type="button"
                        onClick={() => void handleCopy()}
                        className="absolute right-2 top-2 inline-flex h-7 w-7 items-center justify-center rounded-md border border-sparkle-border bg-sparkle-bg/90 text-sparkle-text-secondary opacity-0 transition-all hover:bg-sparkle-card-hover hover:text-sparkle-text group-hover:opacity-100"
                        title={copied ? 'Copied' : 'Copy message'}
                    >
                        {copied ? <Check size={13} /> : <Copy size={13} />}
                    </button>
                )}
                {visibleAttachments.length > 0 && (
                    <div className="mb-3 grid gap-2 sm:grid-cols-2">
                        {visibleAttachments.map((attachment, index) => {
                            const name = resolveAttachmentName(attachment, index)
                            const kind = resolveAttachmentKind(attachment)
                            const imagePreview = attachment.previewDataUrl
                            const textPreview = kind === 'text'
                                ? String(attachment.textPreview || attachment.previewText || '').trim()
                                : ''

                            return (
                                <div key={`${attachment.path}-${name}-${index}`} className="overflow-hidden rounded-xl border border-sparkle-border bg-sparkle-bg/85">
                                    <div className="flex items-center justify-between gap-2 border-b border-sparkle-border/70 px-2.5 py-1.5">
                                        <p className="truncate text-[11px] text-sparkle-text" title={name}>{name}</p>
                                        <span className="rounded-md border border-sparkle-border px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-sparkle-text-muted">
                                            {kind}
                                        </span>
                                    </div>
                                    {kind === 'image' && imagePreview ? (
                                        <div className="h-28 bg-black/20">
                                            <img
                                                src={imagePreview}
                                                alt={name}
                                                className="h-full w-full object-cover"
                                            />
                                        </div>
                                    ) : textPreview ? (
                                        <pre className="max-h-32 overflow-auto p-2 text-[11px] leading-5 whitespace-pre-wrap break-words font-mono text-sparkle-text-secondary">
                                            {textPreview}
                                        </pre>
                                    ) : (
                                        <p className="p-2 text-xs text-sparkle-text-secondary">
                                            {attachment.previewText || 'Attached file'}
                                        </p>
                                    )}
                                </div>
                            )
                        })}
                        {attachments.length > visibleAttachments.length && (
                            <p className="self-end text-[11px] text-sparkle-text-muted">
                                +{attachments.length - visibleAttachments.length} more attachment{attachments.length - visibleAttachments.length === 1 ? '' : 's'}
                            </p>
                        )}
                    </div>
                )}
                <div
                    ref={contentRef}
                    className={cn('relative break-words', isUser && 'pr-10')}
                    style={
                        showFade
                            ? {
                                maxHeight: `${USER_COLLAPSED_MAX_HEIGHT_PX}px`,
                                overflow: 'hidden'
                            }
                            : undefined
                    }
                >
                    {text}

                    {showFade && (
                        <button
                            type="button"
                            onClick={() => setIsCollapsed(false)}
                            className="absolute inset-x-0 bottom-0 flex h-40 cursor-pointer items-end justify-center rounded-b-2xl bg-gradient-to-t from-sparkle-card via-sparkle-card/80 to-transparent pb-8 text-sm font-medium text-[var(--accent-primary)] transition-colors hover:text-white"
                            style={{ height: `${USER_COLLAPSED_FADE_HEIGHT_PX}px` }}
                        >
                            Read More
                        </button>
                    )}
                </div>

                {canCollapse && !isCollapsed && (
                    <div className="cursor-pointer px-1 pb-1 pt-3 text-center" onClick={handleCollapseToTop}>
                        <span className="text-sm text-white/40 transition-colors hover:text-white/60">
                            Show Less
                        </span>
                    </div>
                )}
            </div>

            {showFloatingCollapse && canCollapse && !isCollapsed && (
                <button
                    type="button"
                    onClick={handleCollapseToTop}
                    style={{ right: `${floatingRightPx}px`, bottom: `${USER_FLOATING_COLLAPSE_BOTTOM_PX}px` }}
                    className="fixed z-40 inline-flex items-center gap-2 rounded-full border border-white/20 bg-black/65 px-4 py-2 text-sm text-white/90 shadow-lg backdrop-blur-md transition-colors hover:bg-black/80"
                >
                    <ChevronUp size={14} />
                    Show Less
                </button>
            )}
        </div>
    )
}
