import { useEffect, useRef, useState } from 'react'
import type { AssistantTextStreamingMode } from '@/lib/settings'

const STREAM_FLUSH_MS = 72
const CHUNKED_STREAM_FLUSH_MS = 140

export function useAssistantVisibleText(text: string, streaming: boolean, mode: AssistantTextStreamingMode): string {
    const [visibleText, setVisibleText] = useState(text)
    const latestTextRef = useRef(text)
    const flushTimeoutRef = useRef<number | null>(null)

    useEffect(() => {
        latestTextRef.current = text

        if (!streaming) {
            if (flushTimeoutRef.current !== null) {
                window.clearTimeout(flushTimeoutRef.current)
                flushTimeoutRef.current = null
            }
            setVisibleText(text)
            return
        }

        const flushDelayMs = mode === 'chunks' ? CHUNKED_STREAM_FLUSH_MS : STREAM_FLUSH_MS
        if (flushTimeoutRef.current !== null) return

        flushTimeoutRef.current = window.setTimeout(() => {
            flushTimeoutRef.current = null
            setVisibleText((current) => current === latestTextRef.current ? current : latestTextRef.current)
        }, flushDelayMs)
    }, [mode, streaming, text])

    useEffect(() => {
        return () => {
            if (flushTimeoutRef.current !== null) {
                window.clearTimeout(flushTimeoutRef.current)
            }
        }
    }, [])

    return streaming ? visibleText : text
}
