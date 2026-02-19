/**
 * DevScope - InfoCard Component
 * Reusable card for displaying system information
 */

import { type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

interface InfoCardItem {
    label: string
    value: string | number | undefined
}

interface InfoCardProps {
    icon: LucideIcon
    iconBgColor?: string
    iconColor?: string
    title: string
    subtitle?: string
    items: InfoCardItem[]
    className?: string
    onClick?: () => void
}

export default function InfoCard({
    icon: Icon,
    iconBgColor = 'bg-blue-500/10',
    iconColor = 'text-blue-500',
    title,
    subtitle,
    items,
    className,
    onClick
}: InfoCardProps) {
    return (
        <div
            onClick={onClick}
            className={cn(
                'bg-sparkle-card backdrop-blur-sm rounded-xl border border-sparkle-border hover:border-sparkle-border-secondary hover:shadow-lg transition-all duration-200 overflow-hidden p-5',
                onClick && 'cursor-pointer',
                className
            )}
        >
            <div className="flex items-start gap-3 mb-4">
                <div className={cn('p-3 rounded-lg', iconBgColor)}>
                    <Icon className={cn('', iconColor)} size={24} />
                </div>
                <div className="flex-1 min-w-0">
                    <h2 className="text-lg font-semibold text-sparkle-text mb-0.5 truncate">{title}</h2>
                    {subtitle && (
                        <p className="text-sparkle-text-secondary text-sm truncate">{subtitle}</p>
                    )}
                </div>
            </div>
            <div className="space-y-3">
                {items.map((item, index) => (
                    <div key={index}>
                        <p className="text-sparkle-text-secondary text-xs mb-0.5">{item.label}</p>
                        <p className="text-sparkle-text font-medium truncate">
                            {item.value ?? 'Unknown'}
                        </p>
                    </div>
                ))}
            </div>
        </div>
    )
}

