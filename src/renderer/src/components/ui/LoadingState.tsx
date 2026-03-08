/**
 * Loading state with timer and skeleton
 */

import { useState, useEffect } from 'react'

interface LoadingStateProps {
    message?: string
}

export function LoadingSpinner({ message = 'Loading...' }: LoadingStateProps) {
    const [elapsed, setElapsed] = useState(0)

    useEffect(() => {
        const start = Date.now()
        const interval = setInterval(() => {
            setElapsed(Date.now() - start)
        }, 100)
        return () => clearInterval(interval)
    }, [])

    const formatTime = (ms: number) => {
        const seconds = Math.floor(ms / 1000)
        const tenths = Math.floor((ms % 1000) / 100)
        return `${seconds}.${tenths}s`
    }

    return (
        <div className="flex items-center justify-center h-[60vh] flex-col gap-5">
            <div className="animate-spin inline-block w-8 h-8 border-[3px] border-current border-t-transparent text-sparkle-primary rounded-full" />
            <div className="text-center">
                <p className="text-sparkle-text-secondary">{message}</p>
                <p className="text-sparkle-text-muted text-sm font-mono mt-1">{formatTime(elapsed)}</p>
            </div>
        </div>
    )
}

export function LoadingOverlay({ message = 'Loading...' }: LoadingStateProps) {
    const [elapsed, setElapsed] = useState(0)

    useEffect(() => {
        const start = Date.now()
        const interval = setInterval(() => {
            setElapsed(Date.now() - start)
        }, 100)
        return () => clearInterval(interval)
    }, [])

    const formatTime = (ms: number) => {
        const seconds = Math.floor(ms / 1000)
        const tenths = Math.floor((ms % 1000) / 100)
        return `${seconds}.${tenths}s`
    }

    return (
        <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
            <div className="flex flex-col items-center gap-4 bg-sparkle-bg/80 backdrop-blur-sm px-8 py-6 rounded-2xl border border-white/10 shadow-2xl">
                <div className="animate-spin inline-block w-10 h-10 border-[3px] border-current border-t-transparent text-sparkle-primary rounded-full" />
                <div className="text-center">
                    <p className="text-white font-medium">{message}</p>
                    <p className="text-sparkle-text-muted text-sm font-mono mt-1">{formatTime(elapsed)}</p>
                </div>
            </div>
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

