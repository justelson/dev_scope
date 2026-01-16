/**
 * Utility function for conditionally joining classNames
 */
export function cn(...classes: (string | boolean | undefined | null)[]): string {
    return classes.filter(Boolean).join(' ')
}

/**
 * Format bytes to human readable string
 */
export function formatBytes(bytes: number): string {
    if (bytes === 0 || !bytes) return '0 GB'
    const gb = bytes / 1024 / 1024 / 1024
    return `${gb.toFixed(2)} GB`
}

/**
 * Format timestamp to relative time
 */
export function formatRelativeTime(timestamp: number): string {
    const now = Date.now()
    const diff = now - timestamp

    if (diff < 60000) return 'Just now'
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`
    return `${Math.floor(diff / 86400000)}d ago`
}
