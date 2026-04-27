import { useCallback, useEffect, useLayoutEffect, useRef } from 'react'

const TIMELINE_HIDE_SCROLL_BUTTON_THRESHOLD_PX = 180
const INITIAL_LATEST_LOCK_MS = 1500

interface UseAssistantPageTimelineScrollArgs {
    sessionId: string | null
    threadId: string | null
    loading: boolean
    timelineMessageCount: number
    lastTimelineMessageId: string | null
    lastTimelineMessageUpdatedAt: string | null
    activityFeedCount: number
    latestTimelineActivityId: string | null
    latestTimelineActivityCreatedAt: string | null
    shouldShowWorkingIndicator: boolean
    latestTurnStartedAt: string | null
    latestTurnState: string | null
    threadState: string | null
}

export function useAssistantPageTimelineScroll(args: UseAssistantPageTimelineScrollArgs) {
    const timelineScrollRef = useRef<HTMLDivElement | null>(null)
    const timelineContentRef = useRef<HTMLDivElement | null>(null)
    const shouldAutoScrollRef = useRef(true)
    const timelineScrollRafRef = useRef<number | null>(null)
    const latestLockRafRef = useRef<number | null>(null)
    const latestLockUntilRef = useRef(0)

    const scrollTimelineToBottom = useCallback((behavior: ScrollBehavior = 'instant') => {
        const element = timelineScrollRef.current
        if (!element) return
        if (behavior === 'instant') element.scrollTop = element.scrollHeight
        else element.scrollTo({ top: element.scrollHeight, behavior })
    }, [])

    const getTimelineDistanceFromBottom = useCallback((element: HTMLDivElement) => {
        return Math.max(0, element.scrollHeight - element.scrollTop - element.clientHeight)
    }, [])

    const isTimelineNearBottom = useCallback(
        (element: HTMLDivElement) => getTimelineDistanceFromBottom(element) <= TIMELINE_HIDE_SCROLL_BUTTON_THRESHOLD_PX,
        [getTimelineDistanceFromBottom]
    )

    const syncTimelineScrollState = useCallback((element: HTMLDivElement) => {
        const nearBottom = isTimelineNearBottom(element)
        shouldAutoScrollRef.current = nearBottom
        if (!nearBottom) {
            latestLockUntilRef.current = 0
        }
    }, [isTimelineNearBottom])

    const onScrollTimeline = useCallback((element: HTMLDivElement) => {
        if (timelineScrollRafRef.current !== null) {
            window.cancelAnimationFrame(timelineScrollRafRef.current)
        }
        timelineScrollRafRef.current = window.requestAnimationFrame(() => {
            timelineScrollRafRef.current = null
            syncTimelineScrollState(element)
        })
    }, [syncTimelineScrollState])

    const onScrollToBottom = useCallback(() => {
        shouldAutoScrollRef.current = true
        scrollTimelineToBottom('smooth')
    }, [scrollTimelineToBottom])

    const cancelLatestLockRaf = useCallback(() => {
        if (latestLockRafRef.current !== null) {
            window.cancelAnimationFrame(latestLockRafRef.current)
            latestLockRafRef.current = null
        }
    }, [])

    const stabilizeLatestPosition = useCallback((remainingFrames: number) => {
        const element = timelineScrollRef.current
        if (!element) return
        const withinLatestLock = Date.now() <= latestLockUntilRef.current
        if (!withinLatestLock && !shouldAutoScrollRef.current && !isTimelineNearBottom(element)) return

        scrollTimelineToBottom('instant')
        syncTimelineScrollState(element)

        if (remainingFrames <= 0) {
            latestLockRafRef.current = null
            return
        }

        latestLockRafRef.current = window.requestAnimationFrame(() => {
            stabilizeLatestPosition(remainingFrames - 1)
        })
    }, [isTimelineNearBottom, scrollTimelineToBottom, syncTimelineScrollState])

    useLayoutEffect(() => {
        const element = timelineScrollRef.current
        if (element) syncTimelineScrollState(element)
    }, [syncTimelineScrollState])

    useLayoutEffect(() => {
        const element = timelineScrollRef.current
        if (!element) return
        cancelLatestLockRaf()
        shouldAutoScrollRef.current = true
        latestLockUntilRef.current = Date.now() + INITIAL_LATEST_LOCK_MS
        scrollTimelineToBottom('instant')
        syncTimelineScrollState(element)
        stabilizeLatestPosition(4)
        return () => {
            cancelLatestLockRaf()
        }
    }, [args.loading, args.sessionId, args.threadId, cancelLatestLockRaf, scrollTimelineToBottom, stabilizeLatestPosition, syncTimelineScrollState])

    useLayoutEffect(() => {
        const element = timelineScrollRef.current
        if (!element) return
        if (!shouldAutoScrollRef.current && !isTimelineNearBottom(element)) return
        scrollTimelineToBottom('instant')
        if (timelineScrollRef.current) syncTimelineScrollState(timelineScrollRef.current)
    }, [
        args.activityFeedCount,
        args.lastTimelineMessageId,
        args.lastTimelineMessageUpdatedAt,
        args.latestTimelineActivityCreatedAt,
        args.latestTimelineActivityId,
        args.latestTurnStartedAt,
        args.latestTurnState,
        args.shouldShowWorkingIndicator,
        args.threadState,
        args.timelineMessageCount,
        isTimelineNearBottom,
        scrollTimelineToBottom,
        syncTimelineScrollState
    ])

    useEffect(() => {
        const contentElement = timelineContentRef.current
        const scrollElement = timelineScrollRef.current
        if (!contentElement || !scrollElement || typeof ResizeObserver === 'undefined') return

        const observer = new ResizeObserver(() => {
            const withinLatestLock = Date.now() <= latestLockUntilRef.current
            if (!withinLatestLock && !shouldAutoScrollRef.current && !isTimelineNearBottom(scrollElement)) return
            scrollTimelineToBottom('instant')
            syncTimelineScrollState(scrollElement)
        })

        observer.observe(contentElement)
        return () => {
            observer.disconnect()
        }
    }, [args.sessionId, args.threadId, isTimelineNearBottom, scrollTimelineToBottom, syncTimelineScrollState])

    useEffect(() => {
        return () => {
            cancelLatestLockRaf()
            if (timelineScrollRafRef.current !== null) {
                window.cancelAnimationFrame(timelineScrollRafRef.current)
            }
        }
    }, [cancelLatestLockRaf])

    return {
        timelineContentRef,
        timelineScrollRef,
        onScrollTimeline,
        onScrollToBottom
    }
}
