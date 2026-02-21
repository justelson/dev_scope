import type { ReactNode } from 'react'

export function SummaryCard({
    icon,
    label,
    value,
    loading = false
}: {
    icon: ReactNode
    label: string
    value: number
    loading?: boolean
}) {
    return (
        <div className="rounded-xl border border-sparkle-border bg-sparkle-card p-4">
            <div className="flex items-center justify-between mb-2 text-sparkle-text-secondary">
                <span className="text-sm">{label}</span>
                {icon}
            </div>
            <div className="text-2xl font-semibold text-sparkle-text">{loading ? '...' : value}</div>
        </div>
    )
}

export function ListSkeleton({ title }: { title: string }) {
    return (
        <div className="rounded-xl border border-sparkle-border bg-sparkle-card p-4">
            <h2 className="text-sm font-semibold text-sparkle-text mb-3">{title}</h2>
            <div className="space-y-2">
                {Array.from({ length: 5 }).map((_, index) => (
                    <div key={index} className="h-14 rounded-lg bg-sparkle-border-secondary animate-pulse" />
                ))}
            </div>
        </div>
    )
}
