import type { ReactNode } from 'react'

export function OpenAILogo({ className }: { className?: string }) {
    return (
        <svg viewBox="0 0 158.7128 157.296" aria-hidden="true" className={className} fill="currentColor">
            <path d="M60.8734,57.2556v-14.9432c0-1.2586.4722-2.2029,1.5728-2.8314l30.0443-17.3023c4.0899-2.3593,8.9662-3.4599,13.9988-3.4599,18.8759,0,30.8307,14.6289,30.8307,30.2006,0,1.1007,0,2.3593-.158,3.6178l-31.1446-18.2467c-1.8872-1.1006-3.7754-1.1006-5.6629,0l-39.4812,22.9651ZM131.0276,115.4561v-35.7074c0-2.2028-.9446-3.7756-2.8318-4.8763l-39.481-22.9651,12.8982-7.3934c1.1007-.6285,2.0453-.6285,3.1458,0l30.0441,17.3024c8.6523,5.0341,14.4708,15.7296,14.4708,26.1107,0,11.9539-7.0769,22.965-18.2461,27.527v.0021ZM51.593,83.9964l-12.8982-7.5497c-1.1007-.6285-1.5728-1.5728-1.5728-2.8314v-34.6048c0-16.8303,12.8982-29.5722,30.3585-29.5722,6.607,0,12.7403,2.2029,17.9324,6.1349l-30.987,17.9324c-1.8871,1.1007-2.8314,2.6735-2.8314,4.8764v45.6159l-.0014-.0015ZM79.3562,100.0403l-18.4829-10.3811v-22.0209l18.4829-10.3811,18.4812,10.3811v22.0209l-18.4812,10.3811ZM91.2319,147.8591c-6.607,0-12.7403-2.2031-17.9324-6.1344l30.9866-17.9333c1.8872-1.1005,2.8318-2.6728,2.8318-4.8759v-45.616l13.0564,7.5498c1.1005.6285,1.5723,1.5728,1.5723,2.8314v34.6051c0,16.8297-13.0564,29.5723-30.5147,29.5723v.001ZM53.9522,112.7822l-30.0443-17.3024c-8.652-5.0343-14.471-15.7296-14.471-26.1107,0-12.1119,7.2356-22.9652,18.403-27.5272v35.8634c0,2.2028.9443,3.7756,2.8314,4.8763l39.3248,22.8068-12.8982,7.3938c-1.1007.6287-2.045.6287-3.1456,0ZM52.2229,138.5791c-17.7745,0-30.8306-13.3713-30.8306-29.8871,0-1.2585.1578-2.5169.3143-3.7754l30.987,17.9323c1.8871,1.1005,3.7757,1.1005,5.6628,0l39.4811-22.807v14.9435c0,1.2585-.4721,2.2021-1.5728,2.8308l-30.0443,17.3025c-4.0898,2.359-8.9662,3.4605-13.9989,3.4605h.0014ZM91.2319,157.296c19.0327,0,34.9188-13.5272,38.5383-31.4594,17.6164-4.562,28.9425-21.0779,28.9425-37.908,0-11.0112-4.719-21.7066-13.2133-29.4143.7867-3.3035,1.2595-6.607,1.2595-9.909,0-22.4929-18.2471-39.3247-39.3251-39.3247-4.2461,0-8.3363.6285-12.4262,2.045-7.0792-6.9213-16.8318-11.3254-27.5271-11.3254-19.0331,0-34.9191,13.5268-38.5384,31.4591C11.3255,36.0212,0,52.5373,0,69.3675c0,11.0112,4.7184,21.7065,13.2125,29.4142-.7865,3.3035-1.2586,6.6067-1.2586,9.9092,0,22.4923,18.2466,39.3241,39.3248,39.3241,4.2462,0,8.3362-.6277,12.426-2.0441,7.0776,6.921,16.8302,11.3251,27.5271,11.3251Z" />
        </svg>
    )
}

export function getMentionQuery(text: string, cursor: number): { start: number; query: string } | null {
    const beforeCursor = text.slice(0, cursor)
    const match = beforeCursor.match(/(^|\s)@([^\s@]*)$/)
    if (!match || match.index == null) return null
    const start = match.index + match[1].length
    return { start, query: match[2] || '' }
}

export function normalizeMentionLookupPath(pathValue: string): string {
    return String(pathValue || '').replace(/\\/g, '/').replace(/^\.\//, '').replace(/^\//, '').toLowerCase()
}

export type InlineMentionTag = {
    id: string
    path: string
    relativePath: string
    label: string
    kind: 'file' | 'directory'
    start: number
    end: number
}

export function sortInlineMentionTags(tags: InlineMentionTag[]): InlineMentionTag[] {
    return [...tags].sort((left, right) => left.start - right.start || left.end - right.end)
}

export function reconcileInlineMentionTags(prevText: string, nextText: string, tags: InlineMentionTag[]): InlineMentionTag[] {
    if (tags.length === 0) return []
    if (prevText === nextText) return sortInlineMentionTags(tags)

    let prefixLength = 0
    while (prefixLength < prevText.length && prefixLength < nextText.length && prevText[prefixLength] === nextText[prefixLength]) prefixLength += 1

    let suffixLength = 0
    while (
        suffixLength < prevText.length - prefixLength
        && suffixLength < nextText.length - prefixLength
        && prevText[prevText.length - 1 - suffixLength] === nextText[nextText.length - 1 - suffixLength]
    ) suffixLength += 1

    const previousChangedEnd = prevText.length - suffixLength
    const delta = nextText.length - prevText.length
    return sortInlineMentionTags(tags.flatMap((tag) => {
        if (tag.end <= prefixLength) return [tag]
        if (tag.start >= previousChangedEnd) return [{ ...tag, start: tag.start + delta, end: tag.end + delta }]
        return []
    }))
}

export function removeInlineMentionTagRange(tags: InlineMentionTag[], start: number, end: number): InlineMentionTag[] {
    return tags.filter((tag) => tag.end <= start || tag.start >= end)
}

export function replaceInlineMentionTokensWithLabels(text: string, tags: InlineMentionTag[]): string {
    if (tags.length === 0) return text
    let result = text
    const sortedTags = sortInlineMentionTags(tags)
    for (let index = sortedTags.length - 1; index >= 0; index -= 1) {
        const tag = sortedTags[index]
        result = `${result.slice(0, tag.start)}${tag.label}${result.slice(tag.end)}`
    }
    return result
}

export function renderInlineMentionOverlay(
    text: string,
    tags: InlineMentionTag[],
    renderTag: (tag: InlineMentionTag, rawToken: string) => ReactNode
): ReactNode[] {
    if (text.length === 0) return []
    const segments: ReactNode[] = []
    let cursor = 0
    for (const tag of sortInlineMentionTags(tags)) {
        if (tag.start > cursor) segments.push(text.slice(cursor, tag.start))
        const rawToken = text.slice(tag.start, tag.end)
        segments.push(renderTag(tag, rawToken))
        cursor = tag.end
    }
    if (cursor < text.length) segments.push(text.slice(cursor))
    return segments
}
