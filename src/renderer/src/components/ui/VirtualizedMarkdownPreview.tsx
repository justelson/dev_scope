import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { estimateMarkdownBlockHeight, parseMarkdownBlocks, type MarkdownEstimateProfile } from '@/lib/text-layout/markdown-blocks'
import { MarkdownContentRenderer, type MarkdownRendererProps } from './MarkdownRenderer'

const OVERSCAN_PX = 1200
const OVERSCAN_BLOCKS = 4

type VirtualizedMarkdownPreviewProps = Pick<
    MarkdownRendererProps,
    'content' | 'className' | 'filePath' | 'codeBlockMaxLines' | 'onInternalLinkClick'
> & {
    profile?: MarkdownEstimateProfile
    viewportClassName?: string
}

function findIndexByOffset(offsets: number[], value: number): number {
    let low = 0
    let high = offsets.length - 1

    while (low <= high) {
        const mid = Math.floor((low + high) / 2)
        const start = offsets[mid]
        const end = offsets[mid + 1] ?? Number.POSITIVE_INFINITY
        if (value < start) {
            high = mid - 1
        } else if (value >= end) {
            low = mid + 1
        } else {
            return mid
        }
    }

    return Math.max(0, Math.min(offsets.length - 2, low))
}

function VirtualizedMarkdownPreviewImpl({
    content,
    className,
    filePath,
    codeBlockMaxLines,
    onInternalLinkClick,
    profile = 'preview',
    viewportClassName
}: VirtualizedMarkdownPreviewProps) {
    const scrollRef = useRef<HTMLDivElement | null>(null)
    const measuredHeightsRef = useRef<Map<string, number>>(new Map())
    const resizeObserversRef = useRef<Map<string, ResizeObserver>>(new Map())
    const [measurementVersion, setMeasurementVersion] = useState(0)
    const [scrollTop, setScrollTop] = useState(0)
    const [viewportHeight, setViewportHeight] = useState(0)
    const [viewportWidth, setViewportWidth] = useState(0)

    const blocks = useMemo(() => parseMarkdownBlocks(content), [content])

    useEffect(() => {
        measuredHeightsRef.current.clear()
        for (const observer of resizeObserversRef.current.values()) observer.disconnect()
        resizeObserversRef.current.clear()
        setMeasurementVersion((current) => current + 1)
        if (scrollRef.current) {
            scrollRef.current.scrollTop = 0
        }
        setScrollTop(0)
    }, [content])

    useEffect(() => {
        return () => {
            for (const observer of resizeObserversRef.current.values()) observer.disconnect()
            resizeObserversRef.current.clear()
        }
    }, [])

    useLayoutEffect(() => {
        const node = scrollRef.current
        if (!node) return

        const updateMetrics = () => {
            setScrollTop(node.scrollTop)
            setViewportHeight(node.clientHeight)
            setViewportWidth(node.clientWidth)
        }

        updateMetrics()
        const handleScroll = () => updateMetrics()
        node.addEventListener('scroll', handleScroll, { passive: true })

        const observer = typeof ResizeObserver !== 'undefined'
            ? new ResizeObserver(() => updateMetrics())
            : null
        observer?.observe(node)

        return () => {
            node.removeEventListener('scroll', handleScroll)
            observer?.disconnect()
        }
    }, [])

    const estimatedHeights = useMemo(() => {
        const width = Math.max(240, viewportWidth - 8)
        return blocks.map((block) => measuredHeightsRef.current.get(block.id) ?? estimateMarkdownBlockHeight(block, width, profile))
    }, [blocks, measurementVersion, profile, viewportWidth])

    const offsets = useMemo(() => {
        const next = new Array<number>(blocks.length + 1)
        next[0] = 0
        for (let index = 0; index < blocks.length; index += 1) {
            next[index + 1] = next[index] + (estimatedHeights[index] || 0)
        }
        return next
    }, [blocks.length, estimatedHeights])

    const totalHeight = offsets[offsets.length - 1] || 0

    const range = useMemo(() => {
        if (blocks.length === 0) {
            return { startIndex: 0, endIndex: -1 }
        }
        const viewportEnd = scrollTop + Math.max(1, viewportHeight)
        const rawStartIndex = findIndexByOffset(offsets, Math.max(0, scrollTop - OVERSCAN_PX))
        const rawEndIndex = findIndexByOffset(offsets, Math.max(0, viewportEnd + OVERSCAN_PX))
        return {
            startIndex: Math.max(0, rawStartIndex - OVERSCAN_BLOCKS),
            endIndex: Math.min(blocks.length - 1, rawEndIndex + OVERSCAN_BLOCKS)
        }
    }, [blocks.length, offsets, scrollTop, viewportHeight])

    const visibleBlocks = useMemo(
        () => range.endIndex < range.startIndex
            ? []
            : blocks.slice(range.startIndex, range.endIndex + 1).map((block, offset) => ({
                block,
                index: range.startIndex + offset
            })),
        [blocks, range.endIndex, range.startIndex]
    )

    const registerMeasuredBlock = useCallback((blockId: string, node: HTMLDivElement | null) => {
        const existing = resizeObserversRef.current.get(blockId)
        existing?.disconnect()
        resizeObserversRef.current.delete(blockId)

        if (!node || typeof ResizeObserver === 'undefined') return

        const measure = () => {
            const nextHeight = Math.ceil(node.getBoundingClientRect().height)
            if (!nextHeight) return
            const previousHeight = measuredHeightsRef.current.get(blockId)
            if (previousHeight === nextHeight) return
            measuredHeightsRef.current.set(blockId, nextHeight)
            setMeasurementVersion((current) => current + 1)
        }

        measure()
        const observer = new ResizeObserver(() => measure())
        observer.observe(node)
        resizeObserversRef.current.set(blockId, observer)
    }, [])

    return (
        <div ref={scrollRef} className={viewportClassName}>
            <div style={{ paddingTop: offsets[range.startIndex] || 0, paddingBottom: Math.max(0, totalHeight - (offsets[range.endIndex + 1] || 0)) }}>
                {visibleBlocks.map((block) => (
                    <div
                        key={block.block.id}
                        ref={(node) => registerMeasuredBlock(block.block.id, node)}
                        style={{ containIntrinsicSize: `${estimatedHeights[block.index] || 0}px`, contentVisibility: 'auto' }}
                    >
                        <MarkdownContentRenderer
                            content={block.block.raw}
                            className={className}
                            filePath={filePath}
                            codeBlockMaxLines={codeBlockMaxLines}
                            onInternalLinkClick={onInternalLinkClick}
                        />
                    </div>
                ))}
            </div>
        </div>
    )
}

export default memo(VirtualizedMarkdownPreviewImpl)
