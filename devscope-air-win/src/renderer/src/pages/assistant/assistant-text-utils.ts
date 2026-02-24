export function toDisplayText(value: unknown): string {
    if (value === null || value === undefined) return ''
    if (typeof value === 'string') return value
    if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
        return String(value)
    }
    if (value instanceof Error) {
        if (value.stack && value.stack.trim()) return value.stack
        return value.message || 'Error'
    }
    if (typeof value === 'object') {
        try {
            return JSON.stringify(value, null, 2)
        } catch {
            return Object.prototype.toString.call(value)
        }
    }
    return ''
}

export function toDisplayTextTrimmed(value: unknown): string {
    return toDisplayText(value).trim()
}
