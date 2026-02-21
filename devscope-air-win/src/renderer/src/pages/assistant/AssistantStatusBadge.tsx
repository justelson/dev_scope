import { cn } from '@/lib/utils'

export function AssistantStatusBadge({
    label,
    tone
}: {
    label: string
    tone: 'neutral' | 'warning' | 'success' | 'danger' | 'info'
}) {
    return (
        <span
            className={cn(
                'inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs',
                tone === 'neutral' && 'border-sparkle-border text-sparkle-text-muted',
                tone === 'warning' && 'border-amber-500/35 text-amber-300 bg-amber-500/10',
                tone === 'success' && 'border-emerald-500/35 text-emerald-300 bg-emerald-500/10',
                tone === 'danger' && 'border-red-500/35 text-red-300 bg-red-500/10',
                tone === 'info' && 'border-sky-500/35 text-sky-300 bg-sky-500/10'
            )}
        >
            <span
                className={cn(
                    'w-1.5 h-1.5 rounded-full',
                    tone === 'neutral' && 'bg-sparkle-text-muted',
                    tone === 'warning' && 'bg-amber-300',
                    tone === 'success' && 'bg-emerald-300',
                    tone === 'danger' && 'bg-red-300',
                    tone === 'info' && 'bg-sky-300'
                )}
            />
            {label}
        </span>
    )
}

