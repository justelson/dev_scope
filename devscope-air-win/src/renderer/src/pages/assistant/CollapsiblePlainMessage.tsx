import { useEffect, useRef, useState } from 'react'
import { ChevronUp } from 'lucide-react'

const USER_COLLAPSED_LINE_COUNT = 7
const USER_COLLAPSED_MAX_HEIGHT_PX = USER_COLLAPSED_LINE_COUNT * 24
const USER_COLLAPSED_FADE_HEIGHT_PX = 64

export function CollapsiblePlainMessage({
    text,
    isUser
}: {
    text: string
    isUser: boolean
}) {
    const [isCollapsed, setIsCollapsed] = useState(true)
    const [canCollapse, setCanCollapse] = useState(false)
    const [showFloatingCollapse, setShowFloatingCollapse] = useState(false)
    const [floatingRightPx, setFloatingRightPx] = useState(24)
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

        const updateFloatingRight = () => {
            const section = sectionRef.current
            if (!section) return
            const sectionRect = section.getBoundingClientRect()
            const viewportWidth = window.innerWidth
            const right = Math.max(16, viewportWidth - sectionRect.right + 12)
            setFloatingRightPx(right)
        }

        const checkVisibility = () => {
            const section = sectionRef.current
            if (!section) return
            const rect = section.getBoundingClientRect()
            const nowY = window.scrollY
            const deltaY = nowY - lastScrollYRef.current
            lastScrollYRef.current = nowY

            const isSectionVisible = rect.bottom > 0 && rect.top < window.innerHeight
            const shouldShow = isSectionVisible && (deltaY < -1 || rect.top < 0)
            setShowFloatingCollapse(shouldShow)
            updateFloatingRight()
        }

        checkVisibility()
        window.addEventListener('scroll', checkVisibility, { passive: true })
        window.addEventListener('resize', checkVisibility)

        return () => {
            window.removeEventListener('scroll', checkVisibility)
            window.removeEventListener('resize', checkVisibility)
        }
    }, [isUser, canCollapse, isCollapsed])

    const showFade = canCollapse && isCollapsed

    return (
        <div ref={sectionRef} className="w-full">
            <div className={'max-w-[78ch] rounded-2xl px-4 py-3 shadow-sm border whitespace-pre-wrap text-[15px] leading-6 text-sparkle-text bg-sparkle-card border-sparkle-border'}>
                <div
                    ref={contentRef}
                    className="relative break-words"
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
                        <div
                            className="pointer-events-none absolute inset-x-0 bottom-0 rounded-b-2xl"
                            style={{
                                height: `${USER_COLLAPSED_FADE_HEIGHT_PX}px`,
                                background: 'linear-gradient(to bottom, rgba(6, 9, 17, 0) 0%, rgba(6, 9, 17, 0.78) 62%, rgba(6, 9, 17, 0.95) 100%)'
                            }}
                        />
                    )}
                </div>

                {canCollapse && (
                    <div className="mt-2 flex">
                        {isCollapsed ? (
                            <button
                                type="button"
                                onClick={() => setIsCollapsed(false)}
                                className="rounded-full border border-sparkle-border bg-sparkle-bg/80 px-3 py-1 text-[11px] font-medium text-sparkle-text-secondary transition-colors hover:bg-sparkle-card-hover hover:text-sparkle-text"
                            >
                                Show more
                            </button>
                        ) : (
                            <button
                                type="button"
                                onClick={handleCollapseToTop}
                                className="rounded-full border border-sparkle-border bg-sparkle-bg/80 px-3 py-1 text-[11px] font-medium text-sparkle-text-secondary transition-colors hover:bg-sparkle-card-hover hover:text-sparkle-text"
                            >
                                Show less
                            </button>
                        )}
                    </div>
                )}
            </div>

            {showFloatingCollapse && canCollapse && !isCollapsed && (
                <button
                    type="button"
                    onClick={handleCollapseToTop}
                    style={{ right: `${floatingRightPx}px`, bottom: '124px' }}
                    className="fixed z-40 inline-flex items-center gap-2 rounded-full border border-white/30 bg-black/65 px-3.5 py-1.5 text-xs text-white/95 shadow-lg backdrop-blur-md transition-colors hover:bg-black/80"
                >
                    <ChevronUp size={13} />
                    Show Less
                </button>
            )}
        </div>
    )
}

