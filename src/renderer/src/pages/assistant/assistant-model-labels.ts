export function formatAssistantModelLabel(value: string | null | undefined): string {
    const trimmed = String(value || '').trim()
    if (!trimmed) return ''

    const normalized = trimmed.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim()
    if (!normalized) return ''

    return normalized
        .split(' ')
        .map((segment) => {
            const lower = segment.toLowerCase()
            if (lower === 'gpt') return 'GPT'
            if (lower === 'mini') return 'Mini'
            if (lower === 'nano') return 'Nano'
            if (lower === 'preview') return 'Preview'
            if (lower === 'turbo') return 'Turbo'
            if (lower === 'latest') return 'Latest'
            if (/^[a-z]+\d+$/i.test(segment) || /^\d+[a-z]+$/i.test(segment)) {
                return segment.toUpperCase()
            }
            if (/^[0-9.]+$/.test(segment)) return segment
            if (segment === segment.toUpperCase() && /[A-Z]/.test(segment)) return segment
            return segment.charAt(0).toUpperCase() + segment.slice(1)
        })
        .join(' ')
}
