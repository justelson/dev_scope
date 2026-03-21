import { startTransition, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type RefObject } from 'react'

const INITIAL_WINDOW_SIZE = 72
const LOAD_MORE_SIZE = 48
const TOP_LOAD_THRESHOLD_PX = 220

type PendingAnchor = {
    previousHeight: number
    previousTop: number
}

export function useAssistantTimelineWindow({
    entryCount,
    resetKey,
    scrollContainerRef
}: {
    entryCount: number
    resetKey: string
    scrollContainerRef?: RefObject<HTMLDivElement | null>
}) {
    const [startIndex, setStartIndex] = useState(() => Math.max(0, entryCount - INITIAL_WINDOW_SIZE))
    const pendingAnchorRef = useRef<PendingAnchor | null>(null)
    const loadingOlderRef = useRef(false)
    const previousResetKeyRef = useRef(resetKey)

    useEffect(() => {
        if (previousResetKeyRef.current === resetKey) return
        previousResetKeyRef.current = resetKey
        pendingAnchorRef.current = null
        loadingOlderRef.current = false
        setStartIndex(Math.max(0, entryCount - INITIAL_WINDOW_SIZE))
    }, [entryCount, resetKey])

    useEffect(() => {
        setStartIndex((current) => {
            if (entryCount <= INITIAL_WINDOW_SIZE) return 0
            return Math.min(current, Math.max(0, entryCount - 1))
        })
    }, [entryCount])

    const hasHiddenEntries = useMemo(() => startIndex > 0, [startIndex])

    const loadOlder = useCallback(() => {
        if (!hasHiddenEntries || loadingOlderRef.current) return
        const element = scrollContainerRef?.current
        if (element) {
            pendingAnchorRef.current = {
                previousHeight: element.scrollHeight,
                previousTop: element.scrollTop
            }
        }
        loadingOlderRef.current = true
        startTransition(() => {
            setStartIndex((current) => Math.max(0, current - LOAD_MORE_SIZE))
        })
    }, [hasHiddenEntries, scrollContainerRef])

    useEffect(() => {
        const element = scrollContainerRef?.current
        if (!element || !hasHiddenEntries) return

        const handleScroll = () => {
            if (element.scrollTop > TOP_LOAD_THRESHOLD_PX) return
            loadOlder()
        }

        element.addEventListener('scroll', handleScroll, { passive: true })
        return () => element.removeEventListener('scroll', handleScroll)
    }, [hasHiddenEntries, loadOlder, scrollContainerRef])

    useLayoutEffect(() => {
        const pendingAnchor = pendingAnchorRef.current
        const element = scrollContainerRef?.current
        if (!pendingAnchor || !element) return
        pendingAnchorRef.current = null
        const heightDelta = element.scrollHeight - pendingAnchor.previousHeight
        element.scrollTop = pendingAnchor.previousTop + heightDelta
        loadingOlderRef.current = false
    }, [scrollContainerRef, startIndex])

    useEffect(() => {
        if (!loadingOlderRef.current) return
        loadingOlderRef.current = false
    }, [startIndex])

    return {
        startIndex,
        loadOlder
    }
}
