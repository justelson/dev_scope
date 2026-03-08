import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowUpRight, BookOpen, ChevronUp } from 'lucide-react'
import { cn } from '@/lib/utils'
import MarkdownRenderer from '@/components/ui/MarkdownRenderer'
import { navigateMarkdownLink } from '@/components/ui/markdown/linkNavigation'

interface ProjectDetailsReadmeTabProps {
    [key: string]: any
}

export function ProjectDetailsReadmeTab(props: ProjectDetailsReadmeTabProps) {
    const {
        project,
        openPreview,
        readmeContentRef,
        readmeExpanded,
        readmeNeedsExpand,
        setReadmeExpanded
    } = props
    const navigate = useNavigate()
    const readmeSectionRef = useRef<HTMLDivElement | null>(null)
    const lastScrollYRef = useRef(0)
    const [showFloatingCollapse, setShowFloatingCollapse] = useState(false)
    const [floatingRightPx, setFloatingRightPx] = useState(24)

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
        const section = readmeSectionRef.current
        const scrollParent = getScrollParent(section)

        setReadmeExpanded(false)

        if (scrollParent === window) {
            window.scrollTo({ top: 0, behavior: 'smooth' })
        } else {
            ;(scrollParent as HTMLElement).scrollTo({ top: 0, behavior: 'smooth' })
        }
    }

    useEffect(() => {
        if (!readmeExpanded || !readmeNeedsExpand) {
            setShowFloatingCollapse(false)
            return
        }
        setShowFloatingCollapse(true)

        const section = readmeSectionRef.current
        if (!section) return
        const scrollParent = getScrollParent(section)

        const getScrollTop = () => (
            scrollParent === window
                ? window.scrollY
                : (scrollParent as HTMLElement).scrollTop
        )

        const updateFloatingPosition = () => {
            const rect = section.getBoundingClientRect()
            const rightOffset = Math.max(16, window.innerWidth - rect.right + 16)
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

            updateFloatingPosition()
        }

        lastScrollYRef.current = getScrollTop()
        updateFloatingPosition()
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
    }, [readmeExpanded, readmeNeedsExpand])

    return (
        <div ref={readmeSectionRef} className="relative">
            {project.readme ? (
                <>
                    <div
                        ref={readmeContentRef}
                        className={cn(
                            "p-8 pt-6 overflow-hidden transition-all duration-300",
                            !readmeExpanded && "max-h-[500px]"
                        )}
                    >
                        <MarkdownRenderer
                            content={project.readme}
                            filePath={`${project.path}/README.md`}
                            onInternalLinkClick={async (href) => {
                                await navigateMarkdownLink({
                                    href,
                                    filePath: `${project.path}/README.md`,
                                    navigate,
                                    openPreview
                                })
                            }}
                        />
                    </div>
                    {readmeNeedsExpand && !readmeExpanded && (
                        <div
                            onClick={() => setReadmeExpanded(true)}
                            className="absolute bottom-0 left-0 right-0 h-40 bg-gradient-to-t from-sparkle-card via-sparkle-card/80 to-transparent flex items-end justify-center pb-8 cursor-pointer group"
                        >
                            <span className="text-sm font-medium text-[var(--accent-primary)] group-hover:text-white transition-colors">
                                Read More
                            </span>
                        </div>
                    )}
                    {readmeNeedsExpand && readmeExpanded && (
                        <div
                            onClick={handleCollapseToTop}
                            className="px-8 pb-6 pt-4 text-center cursor-pointer group"
                        >
                            <span className="text-sm text-white/40 group-hover:text-white/60 transition-colors">
                                Show Less
                            </span>
                        </div>
                    )}

                    {showFloatingCollapse && (
                        <div
                            style={{ right: `${floatingRightPx}px`, bottom: '20px' }}
                            className="fixed z-40 inline-flex items-center gap-2"
                        >
                            <button
                                type="button"
                                onClick={() => {
                                    void openPreview?.(
                                        { name: 'README.md', path: `${project.path}/README.md` },
                                        'md'
                                    )
                                }}
                                className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/65 px-4 py-2 text-sm text-white/85 shadow-lg backdrop-blur-md transition-colors hover:border-white/20 hover:bg-black/80 hover:text-white"
                            >
                                <ArrowUpRight size={14} />
                                View In Detail
                            </button>
                            <button
                                type="button"
                                onClick={handleCollapseToTop}
                                className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/65 px-4 py-2 text-sm text-white/90 shadow-lg backdrop-blur-md transition-colors hover:border-white/20 hover:bg-black/80"
                            >
                                <ChevronUp size={14} />
                                Show Less
                            </button>
                        </div>
                    )}
                </>
            ) : (
                <div className="flex flex-col items-center justify-center py-24 text-white/20">
                    <BookOpen size={48} className="mb-4 opacity-50" />
                    <p>No README.md found</p>
                </div>
            )}
        </div>
    )
}
