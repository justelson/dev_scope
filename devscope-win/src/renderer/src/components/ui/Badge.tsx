/**
 * DevScope - Badge Component
 */

import { cn } from '@/lib/utils'

interface BadgeProps {
    variant?: 'default' | 'success' | 'warning' | 'error' | 'info'
    children: React.ReactNode
    className?: string
}

const variants = {
    default: 'bg-sparkle-accent text-sparkle-text-secondary',
    success: 'bg-green-500/10 text-green-500',
    warning: 'bg-yellow-500/10 text-yellow-500',
    error: 'bg-red-500/10 text-red-500',
    info: 'bg-blue-500/10 text-blue-500'
}

export default function Badge({ variant = 'default', children, className }: BadgeProps) {
    return (
        <span
            className={cn(
                'inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium',
                variants[variant],
                className
            )}
        >
            {children}
        </span>
    )
}
