/**
 * Loading state with timer and skeleton
 */

import { useState, useEffect } from 'react'
import { cn } from '@/lib/utils'

interface LoadingStateProps {
    message?: string
    detail?: string
    className?: string
    cardClassName?: string
    minHeightClassName?: string
}

function useElapsedTime() {
    const [elapsed, setElapsed] = useState(0)

    useEffect(() => {
        const start = Date.now()
        const interval = setInterval(() => {
            setElapsed(Date.now() - start)
        }, 100)
        return () => clearInterval(interval)
    }, [])

    return elapsed
}

function formatTime(ms: number) {
    const seconds = Math.floor(ms / 1000)
    const tenths = Math.floor((ms % 1000) / 100)
    return `${seconds}.${tenths}s`
}

function LoadingCard({
    message,
    detail,
    elapsed,
    cardClassName
}: {
    message: string
    detail?: string
    elapsed: number
    cardClassName?: string
}) {
    return (
        <div
            className={cn(
                'flex flex-col items-center gap-4 rounded-2xl border border-white/10 bg-sparkle-card/85 px-8 py-7 shadow-[0_18px_48px_rgba(0,0,0,0.22)] backdrop-blur-sm',
                cardClassName
            )}
        >
            <LoadingContent message={message} detail={detail} elapsed={elapsed} />
        </div>
    )
}

function LoadingContent({
    message,
    detail,
    elapsed
}: {
    message: string
    detail?: string
    elapsed: number
}) {
    return (
        <>
            <div className="relative flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03]">
                <div className="absolute inset-0 rounded-2xl bg-[var(--accent-primary)]/10 blur-md" />
                <div className="relative inline-block h-8 w-8 animate-spin rounded-full border-[3px] border-current border-t-transparent text-[var(--accent-primary)]" />
            </div>
            <div className="text-center">
                <p className="text-base font-medium text-sparkle-text">{message}</p>
                {detail && (
                    <p className="mt-1 text-sm text-sparkle-text-secondary">{detail}</p>
                )}
                <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-xs font-mono text-sparkle-text-muted">
                    <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent-primary)]" />
                    Elapsed {formatTime(elapsed)}
                </div>
            </div>
        </>
    )
}

export function LoadingSpinner({
    message = 'Loading...',
    detail,
    className,
    cardClassName,
    minHeightClassName = 'min-h-[52vh]'
}: LoadingStateProps) {
    const elapsed = useElapsedTime()

    return (
        <div className={cn('flex items-center justify-center px-4 py-10', minHeightClassName, className)}>
            <LoadingCard
                message={message}
                detail={detail}
                elapsed={elapsed}
                cardClassName={cardClassName}
            />
        </div>
    )
}

export function LoadingOverlay({
    message = 'Loading...',
    detail,
    className,
    cardClassName
}: LoadingStateProps) {
    const elapsed = useElapsedTime()

    return (
        <div className={cn('absolute inset-0 z-10 flex items-center justify-center pointer-events-none px-4', className)}>
            <LoadingCard
                message={message}
                detail={detail}
                elapsed={elapsed}
                cardClassName={cardClassName}
            />
        </div>
    )
}

export function CardSkeleton() {
    return (
        <div className="bg-sparkle-card/50 rounded-2xl p-8 border border-white/5 animate-pulse">
            <div className="flex items-center gap-4 mb-5">
                <div className="w-14 h-14 rounded-xl bg-white/5" />
                <div className="flex-1">
                    <div className="h-5 bg-white/5 rounded w-1/3 mb-3" />
                    <div className="h-4 bg-white/5 rounded w-1/2" />
                </div>
            </div>
            <div className="space-y-3">
                <div className="h-4 bg-white/5 rounded w-full" />
                <div className="h-4 bg-white/5 rounded w-2/3" />
            </div>
        </div>
    )
}

export function AnalyticsCardSkeleton() {
    return (
        <div className="bg-sparkle-card/80 backdrop-blur-sm rounded-3xl p-8 border border-white/5 animate-pulse min-h-[280px]">
            <div className="h-4 bg-white/5 rounded w-1/4 mb-8" />
            <div className="flex items-center gap-8">
                <div className="w-52 h-52 rounded-full bg-white/5" />
                <div className="flex-1 space-y-4">
                    <div className="h-4 bg-white/5 rounded w-full" />
                    <div className="h-4 bg-white/5 rounded w-3/4" />
                    <div className="h-4 bg-white/5 rounded w-1/2" />
                    <div className="h-4 bg-white/5 rounded w-2/3" />
                </div>
            </div>
        </div>
    )
}

export function ToolGridSkeleton({ count = 8 }: { count?: number }) {
    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {Array.from({ length: count }).map((_, i) => (
                <div key={i} className="bg-sparkle-card rounded-2xl p-7 border border-white/5 animate-pulse min-h-[160px]">
                    <div className="flex items-start justify-between mb-5">
                        <div className="w-14 h-14 rounded-xl bg-white/5" />
                        <div className="w-20 h-6 rounded-full bg-white/5" />
                    </div>
                    <div className="h-5 bg-white/5 rounded w-2/3 mb-3" />
                    <div className="h-4 bg-white/5 rounded w-1/3" />
                </div>
            ))}
        </div>
    )
}

export function SystemStatsSkeleton() {
    return (
        <div className="space-y-8">
            {/* Top stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
                {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="bg-sparkle-card/50 rounded-2xl p-6 border border-white/5 animate-pulse min-h-[130px]">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 rounded-lg bg-white/5" />
                            <div className="h-3 bg-white/5 rounded w-20" />
                        </div>
                        <div className="h-10 bg-white/5 rounded w-1/2 mb-2" />
                        <div className="h-3 bg-white/5 rounded w-2/3" />
                    </div>
                ))}
            </div>
            
            {/* Main cards */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {Array.from({ length: 2 }).map((_, i) => (
                    <div key={i} className="bg-sparkle-card/50 rounded-2xl p-8 border border-white/5 animate-pulse min-h-[320px]">
                        <div className="flex items-center gap-4 mb-8">
                            <div className="w-14 h-14 rounded-xl bg-white/5" />
                            <div>
                                <div className="h-5 bg-white/5 rounded w-28 mb-3" />
                                <div className="h-4 bg-white/5 rounded w-40" />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-5">
                            {Array.from({ length: 4 }).map((_, j) => (
                                <div key={j} className="bg-white/5 rounded-xl p-5">
                                    <div className="h-3 bg-white/10 rounded w-1/2 mb-3" />
                                    <div className="h-6 bg-white/10 rounded w-3/4" />
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}

