import { FileText, Search, Terminal, Wrench } from 'lucide-react'
import type { AssistantReasoning } from './assistant-page-types'
import { toDisplayText } from './assistant-text-utils'

const LIVE_PREVIEW_REASONING_METHOD = 'assistant-live-preview'

export function concatReasoningChunk(base: string, chunk: string): string {
    if (!chunk) return base
    if (!base) return chunk
    if (/^\s*#{1,6}\s/.test(chunk) || /^\s*[-*]\s+/.test(chunk) || /^\s*\d+\.\s+/.test(chunk)) {
        return `${base}\n${chunk}`
    }

    const endsWithWord = /[A-Za-z0-9]$/.test(base)
    const startsWithWord = /^[A-Za-z0-9]/.test(chunk)
    if (!endsWithWord || !startsWithWord) {
        return `${base}${chunk}`
    }

    const nextToken = chunk.match(/^[A-Za-z]+/)?.[0] || ''
    const joinSuffixes = new Set([
        's', 'es', 'ed', 'ing', 'ly', 'er', 'ers',
        'tion', 'tions', 'ment', 'ments', 'ness',
        'able', 'ible', 'al', 'ous'
    ])
    if (joinSuffixes.has(nextToken.toLowerCase())) {
        return `${base}${chunk}`
    }

    return `${base} ${chunk}`
}

export function shouldConcatReasoningChunk(prevText: string, nextText: string, gapMs: number): boolean {
    if (!nextText) return false
    if (gapMs > 15000) return false

    const trimmedPrev = prevText.trimEnd()
    const trimmedNext = nextText.trimStart()
    if (!trimmedPrev) return true
    if (!trimmedNext) return false
    return true
}

export function normalizeReasoningMarkdown(text: string): string {
    if (!text) return ''
    let next = toDisplayText(text)
        .replace(/\u0000/g, '')
        .replace(/\r/g, '')

    if (!next.includes('\n') && next.includes('\\n')) {
        next = next.replace(/\\n/g, '\n')
    }

    return next.trim()
}

export function formatStatTimestamp(value?: number): string {
    if (!Number.isFinite(value)) return '--'
    const date = new Date(Number(value))
    if (Number.isNaN(date.getTime())) return '--'
    return date.toLocaleString([], {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    })
}

export function mergeReasoningEntries(
    entries: AssistantReasoning[]
): AssistantReasoning[] {
    return [...entries]
        .sort((a, b) => a.timestamp - b.timestamp)
        .reduce<AssistantReasoning[]>((acc, entry) => {
            const rawText = toDisplayText(entry.text)
            if (!rawText) return acc

            const normalizedEntry: AssistantReasoning = {
                ...entry,
                text: rawText
            }
            const last = acc[acc.length - 1]
            const hasLivePreviewMethod = normalizedEntry.method === LIVE_PREVIEW_REASONING_METHOD
                || last?.method === LIVE_PREVIEW_REASONING_METHOD
            const sameMethod = Boolean(last) && last.method === normalizedEntry.method
            const canMerge = Boolean(last)
                && sameMethod
                && !hasLivePreviewMethod
                && shouldConcatReasoningChunk(
                    last.text,
                    normalizedEntry.text,
                    Math.max(0, normalizedEntry.timestamp - last.timestamp)
                )
            if (last && canMerge) {
                last.text = concatReasoningChunk(last.text, normalizedEntry.text)
                last.timestamp = normalizedEntry.timestamp
                return acc
            }
            acc.push(normalizedEntry)
            return acc
        }, [])
}

export function ActivityIcon({ kind }: { kind: string }) {
    switch (kind) {
        case 'command':
            return <Terminal size={14} className="text-sky-300" />
        case 'file':
            return <FileText size={14} className="text-amber-300" />
        case 'search':
            return <Search size={14} className="text-violet-300" />
        default:
            return <Wrench size={14} className="text-sparkle-text-muted" />
    }
}
