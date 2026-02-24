import { cn } from '@/lib/utils'
import { useEffect } from 'react'
import { createPortal } from 'react-dom'

interface ConfirmModalProps {
    isOpen: boolean
    title: string
    message: string
    confirmLabel?: string
    cancelLabel?: string
    onConfirm: () => void
    onCancel: () => void
    variant?: 'danger' | 'warning' | 'info'
    fullscreen?: boolean
}

export function ConfirmModal({
    isOpen,
    title,
    message,
    confirmLabel = 'Confirm',
    cancelLabel = 'Cancel',
    onConfirm,
    onCancel,
    variant = 'danger',
    fullscreen = false
}: ConfirmModalProps) {
    useEffect(() => {
        if (isOpen) {
            const originalOverflow = document.body.style.overflow
            document.body.style.overflow = 'hidden'
            return () => {
                document.body.style.overflow = originalOverflow
            }
        }
    }, [isOpen])

    if (!isOpen) return null
    if (typeof document === 'undefined') return null

    const content = (
        <>
            <h3 className="text-base font-semibold text-sparkle-text">{title}</h3>
            <p className="mt-2 text-sm text-sparkle-text-secondary">
                {message}
            </p>
            <div className="mt-5 flex items-center justify-end gap-2">
                <button
                    type="button"
                    onClick={onCancel}
                    className="rounded-lg border border-sparkle-border px-3 py-1.5 text-sm text-sparkle-text-secondary transition-colors hover:bg-sparkle-card-hover hover:text-sparkle-text"
                >
                    {cancelLabel}
                </button>
                <button
                    type="button"
                    onClick={onConfirm}
                    className={cn(
                        'rounded-lg border px-3 py-1.5 text-sm transition-colors shadow-sm',
                        variant === 'danger' && 'border-red-500/40 bg-red-500/15 text-red-200 hover:bg-red-500/25',
                        variant === 'warning' && 'border-amber-500/40 bg-amber-500/15 text-amber-200 hover:bg-amber-500/25',
                        variant === 'info' && 'border-sparkle-primary/40 bg-sparkle-primary/15 text-white/90 hover:bg-sparkle-primary/25'
                    )}
                >
                    {confirmLabel}
                </button>
            </div>
        </>
    )

    return createPortal((
        <div
            className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 backdrop-blur-md animate-modal-backdrop"
            onClick={onCancel}
        >
            <div
                className={cn(
                    fullscreen
                        ? 'h-screen w-screen max-w-none rounded-none border-0 bg-sparkle-bg/98 p-0 shadow-none'
                        : 'w-full max-w-md rounded-2xl border bg-sparkle-card p-6 shadow-2xl animate-modal-in',
                    !fullscreen && variant === 'danger' && 'border-red-500/30',
                    !fullscreen && variant === 'warning' && 'border-amber-500/30',
                    !fullscreen && variant === 'info' && 'border-sparkle-primary/30'
                )}
                onClick={(e) => e.stopPropagation()}
            >
                {fullscreen ? (
                    <div className="flex h-full w-full items-center justify-center p-6">
                        <div
                            className={cn(
                                'w-full max-w-xl rounded-2xl border bg-sparkle-card p-6 shadow-2xl animate-modal-in',
                                variant === 'danger' && 'border-red-500/30',
                                variant === 'warning' && 'border-amber-500/30',
                                variant === 'info' && 'border-sparkle-primary/30'
                            )}
                        >
                            {content}
                        </div>
                    </div>
                ) : (
                    content
                )}
            </div>
        </div>
    ), document.body)
}
