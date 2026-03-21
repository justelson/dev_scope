import { useCallback, useEffect, useLayoutEffect, useRef } from 'react'

const TIMELINE_HIDE_SCROLL_BUTTON_THRESHOLD_PX = 180

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
    const shouldAutoScrollRef = useRef(true)
    const timelineScrollRafRef = useRef<number | null>(null)

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
        shouldAutoScrollRef.current = isTimelineNearBottom(element)
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

    useLayoutEffect(() => {
        const element = timelineScrollRef.current
        if (element) syncTimelineScrollState(element)
    }, [syncTimelineScrollState])

    useLayoutEffect(() => {
        const element = timelineScrollRef.current
        if (!element) return
        shouldAutoScrollRef.current = true
        scrollTimelineToBottom('instant')
        syncTimelineScrollState(element)
    }, [args.loading, args.sessionId, args.threadId, scrollTimelineToBottom, syncTimelineScrollState])

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
        return () => {
            if (timelineScrollRafRef.current !== null) {
                window.cancelAnimationFrame(timelineScrollRafRef.current)
            }
        }
    }, [])

    return {
        timelineScrollRef,
        onScrollTimeline,
        onScrollToBottom
    }
}
