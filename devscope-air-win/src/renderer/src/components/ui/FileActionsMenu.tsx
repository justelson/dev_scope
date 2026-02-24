import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { MoreVertical } from 'lucide-react'
import { AnimatedHeight } from '@/components/ui/AnimatedHeight'
import { cn } from '@/lib/utils'

export interface FileActionsMenuItem {
    id: string
    label: string
    icon?: React.ReactNode
    onSelect: () => void | Promise<void>
    disabled?: boolean
    danger?: boolean
}

interface FileActionsMenuProps {
    items: FileActionsMenuItem[]
    buttonClassName?: string
    menuClassName?: string
    title?: string
}

export function FileActionsMenu({
    items,
    buttonClassName,
    menuClassName,
    title = 'Actions'
}: FileActionsMenuProps) {
    const [open, setOpen] = useState(false)
    const rootRef = useRef<HTMLDivElement | null>(null)
    const buttonRef = useRef<HTMLButtonElement | null>(null)
    const menuRef = useRef<HTMLDivElement | null>(null)
    const [menuPosition, setMenuPosition] = useState<{ top: number; left: number } | null>(null)

    useEffect(() => {
        if (!open) return

        const updatePosition = () => {
            const button = buttonRef.current
            if (!button) return
            const rect = button.getBoundingClientRect()
            setMenuPosition({
                top: rect.bottom + 6,
                left: rect.right
            })
        }

        updatePosition()
        window.addEventListener('resize', updatePosition)
        window.addEventListener('scroll', updatePosition, true)
        return () => {
            window.removeEventListener('resize', updatePosition)
            window.removeEventListener('scroll', updatePosition, true)
        }
    }, [open])

    useEffect(() => {
        if (!open) return

        const handlePointerDown = (event: PointerEvent) => {
            const target = event.target as Node
            const isInsideButton = Boolean(rootRef.current?.contains(target))
            const isInsideMenu = Boolean(menuRef.current?.contains(target))
            if (!isInsideButton && !isInsideMenu) setOpen(false)
        }

        const handleEscape = (event: KeyboardEvent) => {
            if (event.key === 'Escape') setOpen(false)
        }

        document.addEventListener('pointerdown', handlePointerDown)
        document.addEventListener('keydown', handleEscape)
        return () => {
            document.removeEventListener('pointerdown', handlePointerDown)
            document.removeEventListener('keydown', handleEscape)
        }
    }, [open])

    if (items.length === 0) return null

    return (
        <div ref={rootRef} className="relative">
            <button
                ref={buttonRef}
                type="button"
                onClick={(event) => {
                    event.stopPropagation()
                    setOpen((current) => !current)
                }}
                className={cn(
                    'h-7 w-7 rounded-md border border-transparent text-white/40 transition-colors hover:border-white/10 hover:bg-white/10 hover:text-white',
                    buttonClassName,
                    open && 'border-white/10 bg-white/10 text-white opacity-100'
                )}
                title={title}
            >
                <MoreVertical size={15} className="mx-auto" />
            </button>

            {open && menuPosition && typeof document !== 'undefined' && createPortal(
                <div
                    ref={menuRef}
                    className={cn(
                        'fixed z-[140] min-w-[180px] overflow-hidden',
                        menuClassName
                    )}
                    style={{
                        top: `${menuPosition.top}px`,
                        left: `${menuPosition.left}px`,
                        transform: 'translateX(-100%)'
                    }}
                    onClick={(event) => event.stopPropagation()}
                >
                    <AnimatedHeight isOpen={open} duration={220}>
                        <div className="rounded-xl border border-white/10 bg-sparkle-card p-1 shadow-2xl shadow-black/60 animate-in fade-in-0 zoom-in-95 slide-in-from-top-2 duration-150 origin-top-right">
                            {items.map((item) => (
                                <button
                                    key={item.id}
                                    type="button"
                                    disabled={item.disabled}
                                    onClick={() => {
                                        setOpen(false)
                                        void item.onSelect()
                                    }}
                                    className={cn(
                                        'flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs transition-colors',
                                        item.disabled
                                            ? 'cursor-not-allowed text-white/20'
                                            : item.danger
                                                ? 'text-red-200 hover:bg-red-500/15 hover:text-red-100'
                                                : 'text-white/75 hover:bg-white/10 hover:text-white'
                                    )}
                                >
                                    {item.icon && <span className="shrink-0">{item.icon}</span>}
                                    <span>{item.label}</span>
                                </button>
                            ))}
                        </div>
                    </AnimatedHeight>
                </div>,
                document.body
            )}
        </div>
    )
}
