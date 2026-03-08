import { cn } from '@/lib/utils'

interface DiffStatsProps {
    additions?: number
    deletions?: number
    compact?: boolean
    className?: string
}

export function DiffStats({ additions = 0, deletions = 0, compact = false, className }: DiffStatsProps) {
    const safeAdditions = Math.max(0, additions)
    const safeDeletions = Math.max(0, deletions)
    const total = safeAdditions + safeDeletions
    const addRatio = total > 0 ? (safeAdditions / total) * 100 : 0
    const delRatio = total > 0 ? (safeDeletions / total) * 100 : 0

    return (
        <div className={cn('flex items-center gap-2', className)}>
            <span className={cn(compact ? 'text-[10px]' : 'text-xs', 'font-mono text-emerald-400')}>
                +{safeAdditions}
            </span>
            <span className={cn(compact ? 'text-[10px]' : 'text-xs', 'font-mono text-rose-400')}>
                -{safeDeletions}
            </span>
            <div className={cn(compact ? 'h-1.5 w-16' : 'h-2 w-24', 'overflow-hidden rounded-none bg-white/10 border border-white/10')}>
                {total > 0 ? (
                    <div className="flex h-full w-full">
                        <div className="h-full bg-emerald-500/90" style={{ width: `${addRatio}%` }} />
                        <div className="h-full bg-rose-500/90" style={{ width: `${delRatio}%` }} />
                    </div>
                ) : (
                    <div className="h-full w-full bg-white/15" />
                )}
            </div>
        </div>
    )
}
