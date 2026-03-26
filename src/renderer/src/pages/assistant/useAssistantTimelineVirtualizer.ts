import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type RefObject } from 'react'
import type { TimelineRenderRow } from './assistant-timeline-helpers'
import { estimateTimelineRowHeight } from './assistant-timeline-helpers'

const OVERSCAN_PX = 1800
const OVERSCAN_ROWS = 10
const ALWAYS_UNVIRTUALIZED_TAIL_ROWS = 8
const MIN_ROWS_TO_VIRTUALIZE = 40

type MeasuredRowMap = Map<string, number>

type VirtualTimelineRow = {
    row: TimelineRenderRow
    start: number
}

function findRowIndexByOffset(offsets: number[], value: number): number {
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

export function useAssistantTimelineVirtualizer({
    rows,
    resetKey,
    scrollContainerRef
}: {
    rows: TimelineRenderRow[]
    resetKey: string
    scrollContainerRef?: RefObject<HTMLDivElement | null>
}) {
    const measuredHeightsRef = useRef<MeasuredRowMap>(new Map())
    const rowObserversRef = useRef<Map<string, ResizeObserver>>(new Map())
    const rowRefCallbacksRef = useRef<Map<string, (node: HTMLDivElement | null) => void>>(new Map())
    const scrollRafRef = useRef<number | null>(null)
    const [measurementVersion, setMeasurementVersion] = useState(0)
    const [scrollTop, setScrollTop] = useState(0)
    const [viewportHeight, setViewportHeight] = useState(0)

    useEffect(() => {
        measuredHeightsRef.current.clear()
        for (const observer of rowObserversRef.current.values()) observer.disconnect()
        rowObserversRef.current.clear()
        rowRefCallbacksRef.current.clear()
        setMeasurementVersion((current) => current + 1)
    }, [resetKey])

    useLayoutEffect(() => {
        const element = scrollContainerRef?.current
        if (!element) return

        const updateViewportMetrics = () => {
            setViewportHeight(element.clientHeight)
            setScrollTop(element.scrollTop)
        }

        updateViewportMetrics()

        const handleScroll = () => {
            if (scrollRafRef.current !== null) return
            scrollRafRef.current = window.requestAnimationFrame(() => {
                scrollRafRef.current = null
                updateViewportMetrics()
            })
        }

        element.addEventListener('scroll', handleScroll, { passive: true })
        let resizeObserver: ResizeObserver | null = null
        if (typeof ResizeObserver !== 'undefined') {
            resizeObserver = new ResizeObserver(() => updateViewportMetrics())
            resizeObserver.observe(element)
        }

        return () => {
            element.removeEventListener('scroll', handleScroll)
            if (scrollRafRef.current !== null) {
                window.cancelAnimationFrame(scrollRafRef.current)
                scrollRafRef.current = null
            }
            resizeObserver?.disconnect()
        }
    }, [scrollContainerRef])

    const shouldVirtualize = rows.length > MIN_ROWS_TO_VIRTUALIZE
    const virtualizableCount = shouldVirtualize ? Math.max(0, rows.length - ALWAYS_UNVIRTUALIZED_TAIL_ROWS) : 0
    const virtualRows = useMemo(() => rows.slice(0, virtualizableCount), [rows, virtualizableCount])
    const tailRows = useMemo(() => rows.slice(virtualizableCount), [rows, virtualizableCount])

    const offsets = useMemo(() => {
        const nextOffsets = new Array<number>(virtualRows.length + 1)
        nextOffsets[0] = 0
        for (let index = 0; index < virtualRows.length; index += 1) {
            const row = virtualRows[index]
            const measuredHeight = measuredHeightsRef.current.get(row.id)
            const estimatedHeight = measuredHeight ?? estimateTimelineRowHeight(row)
            nextOffsets[index + 1] = nextOffsets[index] + estimatedHeight
        }
        return nextOffsets
    }, [measurementVersion, virtualRows])

    const totalVirtualHeight = offsets[offsets.length - 1] || 0

    const virtualRange = useMemo(() => {
        if (virtualRows.length === 0) {
            return {
                startIndex: 0,
                endIndex: -1,
                rows: [] as VirtualTimelineRow[]
            }
        }

        const viewportEnd = scrollTop + Math.max(viewportHeight, 1)
        const rawStartIndex = findRowIndexByOffset(offsets, Math.max(0, scrollTop - OVERSCAN_PX))
        const rawEndIndex = findRowIndexByOffset(offsets, Math.max(0, viewportEnd + OVERSCAN_PX))
        const startIndex = Math.max(0, rawStartIndex - OVERSCAN_ROWS)
        const endIndex = Math.min(virtualRows.length - 1, rawEndIndex + OVERSCAN_ROWS)

        return {
            startIndex,
            endIndex,
            rows: virtualRows.slice(startIndex, endIndex + 1).map((row, index) => ({
                row,
                start: offsets[startIndex + index] || 0
            }))
        }
    }, [offsets, scrollTop, totalVirtualHeight, viewportHeight, virtualRows])

    const registerMeasuredRow = useCallback((rowId: string, node: HTMLDivElement | null) => {
        const existingObserver = rowObserversRef.current.get(rowId)
        existingObserver?.disconnect()
        rowObserversRef.current.delete(rowId)

        if (!node || typeof ResizeObserver === 'undefined') return

        const measure = () => {
            const nextHeight = Math.ceil(node.getBoundingClientRect().height)
            if (!nextHeight) return
            const previousHeight = measuredHeightsRef.current.get(rowId)
            if (previousHeight === nextHeight) return
            measuredHeightsRef.current.set(rowId, nextHeight)
            setMeasurementVersion((current) => current + 1)
        }

        measure()

        const observer = new ResizeObserver(() => measure())
        observer.observe(node)
        rowObserversRef.current.set(rowId, observer)
    }, [])

    const getMeasuredRowRef = useCallback((rowId: string) => {
        const cached = rowRefCallbacksRef.current.get(rowId)
        if (cached) return cached

        const callback = (node: HTMLDivElement | null) => {
            registerMeasuredRow(rowId, node)
        }
        rowRefCallbacksRef.current.set(rowId, callback)
        return callback
    }, [registerMeasuredRow])

    useEffect(() => {
        return () => {
            for (const observer of rowObserversRef.current.values()) observer.disconnect()
            rowObserversRef.current.clear()
            rowRefCallbacksRef.current.clear()
        }
    }, [])

    return {
        totalVirtualHeight,
        paddingTop: virtualRows.length > 0 ? (offsets[virtualRange.startIndex] || 0) : 0,
        paddingBottom: virtualRows.length > 0 && virtualRange.endIndex >= 0
            ? Math.max(0, totalVirtualHeight - (offsets[virtualRange.endIndex + 1] || 0))
            : 0,
        virtualRows: virtualRange.rows,
        tailRows,
        registerMeasuredRow,
        getMeasuredRowRef
    }
}
