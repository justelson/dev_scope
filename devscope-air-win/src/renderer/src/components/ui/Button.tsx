/**
 * DevScope - Button Component
 */

import { cn } from '@/lib/utils'
import type { ButtonHTMLAttributes, ReactNode } from 'react'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'primary' | 'secondary' | 'outline' | 'danger' | 'ghost'
    size?: 'sm' | 'md' | 'lg'
    children: ReactNode
}

const variants = {
    primary: 'bg-sparkle-primary text-white hover:brightness-110 border-sparkle-primary',
    secondary: 'bg-sparkle-card border border-sparkle-border text-sparkle-text hover:bg-sparkle-accent',
    outline: 'border border-sparkle-primary text-sparkle-primary hover:bg-sparkle-primary hover:text-white',
    danger: 'bg-red-600 text-white border border-red-700 hover:bg-red-700',
    ghost: 'text-sparkle-text-secondary hover:text-sparkle-text hover:bg-sparkle-accent border-transparent'
}

const sizes = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-base',
    lg: 'px-5 py-3 text-lg'
}

export default function Button({
    variant = 'primary',
    size = 'sm',
    className,
    disabled,
    children,
    ...props
}: ButtonProps) {
    return (
        <button
            className={cn(
                'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-all duration-200 select-none focus:outline-none focus:ring-2 focus:ring-sparkle-primary/50 active:scale-95 border',
                variants[variant],
                sizes[size],
                disabled && 'opacity-50 cursor-not-allowed pointer-events-none',
                className
            )}
            disabled={disabled}
            {...props}
        >
            {children}
        </button>
    )
}

