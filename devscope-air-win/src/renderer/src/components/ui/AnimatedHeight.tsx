import React from 'react'
import { cn } from '@/lib/utils'

interface AnimatedHeightProps {
    isOpen: boolean
    children: React.ReactNode
    className?: string
    contentClassName?: string
    duration?: number
}

/**
 * A reusable component that animates its height from 0 to auto using grid-template-rows.
 * This provides a smooth, "fluid" expansion and collapse effect.
 */
export const AnimatedHeight: React.FC<AnimatedHeightProps> = ({
    isOpen,
    children,
    className,
    contentClassName,
    duration = 500
}) => {
    return (
        <div
            className={cn(
                "grid transition-all ease-[cubic-bezier(0.16,1,0.3,1)]",
                isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0 shadow-none",
                className
            )}
            style={{ transitionDuration: `${duration}ms` }}
        >
            <div className="overflow-hidden">
                <div className={contentClassName}>
                    {children}
                </div>
            </div>
        </div>
    )
}
