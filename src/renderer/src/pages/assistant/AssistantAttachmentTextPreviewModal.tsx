import { useEffect } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ComposerContextFile } from './assistant-composer-types'

type AttachmentMeta = {
    name: string
    ext: string
    category: 'image' | 'code' | 'doc'
}

interface AssistantAttachmentTextPreviewModalProps {
    file: ComposerContextFile | null
    meta: AttachmentMeta | null
    contentType: string
    sizeLabel: string
    showFormattingWarning: boolean
    onClose: () => void
}

export default function AssistantAttachmentTextPreviewModal({
    file,
    meta,
    contentType,
    sizeLabel,
    showFormattingWarning,
    onClose
}: AssistantAttachmentTextPreviewModalProps) {
    useEffect(() => {
        if (!file) return

        const onEscape = (event: KeyboardEvent) => {
            if (event.key === 'Escape') onClose()
        }

        const originalOverflow = document.body.style.overflow
        document.body.style.overflow = 'hidden'
        window.addEventListener('keydown', onEscape)

        return () => {
            window.removeEventListener('keydown', onEscape)
            document.body.style.overflow = originalOverflow
        }
    }, [file, onClose])

    if (!file || !meta) return null

    const previewText = String(file.content || file.previewText || '').trimEnd()
    const hasPreviewText = Boolean(previewText.trim())

    return (
        <div
            className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 backdrop-blur-md"
            onClick={onClose}
            onWheel={(event) => event.stopPropagation()}
            style={{ animation: 'fadeIn 0.15s ease-out' }}
        >
            <div
                className="m-4 flex max-h-[90vh] w-full max-w-[95vw] flex-col overflow-hidden rounded-2xl border border-white/10 bg-sparkle-card shadow-2xl"
                onClick={(event) => event.stopPropagation()}
                onWheel={(event) => event.stopPropagation()}
                style={{ animation: 'scaleIn 0.15s ease-out' }}
            >
                <div className="flex items-start justify-between gap-3 border-b border-white/10 px-4 py-3">
                    <div className="min-w-0">
                        <h3 className="truncate text-sm font-semibold text-sparkle-text">{meta.name}</h3>
                        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px] text-sparkle-text-muted">
                            <span className="rounded border border-white/10 bg-sparkle-bg px-1.5 py-0.5 font-mono uppercase tracking-wide">
                                {contentType}
                            </span>
                            <span className="rounded border border-white/10 bg-sparkle-bg px-1.5 py-0.5 font-mono uppercase tracking-wide">
                                {meta.ext || 'txt'}
                            </span>
                            {sizeLabel && (
                                <span className="rounded border border-white/10 bg-sparkle-bg px-1.5 py-0.5 font-mono tracking-wide">
                                    {sizeLabel}
                                </span>
                            )}
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-md border border-white/10 p-1.5 text-sparkle-text-muted transition-colors hover:bg-white/[0.03] hover:text-sparkle-text"
                        title="Close preview"
                    >
                        <X size={14} />
                    </button>
                </div>

                <div className="custom-scrollbar flex-1 overflow-auto bg-sparkle-bg p-4" style={{ overscrollBehavior: 'contain' }}>
                    <div className={cn('mx-auto w-full max-w-4xl overflow-hidden rounded-2xl border border-white/5 bg-sparkle-card shadow-[0_1px_0_rgba(255,255,255,0.03)]')}>
                        <div className="border-b border-white/5 px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-sparkle-text-muted">
                            Pasted text
                        </div>
                        <pre className="custom-scrollbar max-h-[70vh] overflow-auto px-4 py-4 text-[13px] leading-6 text-sparkle-text whitespace-pre-wrap break-words">
                            {hasPreviewText ? previewText : 'No text content available.'}
                        </pre>
                    </div>

                    {showFormattingWarning && (
                        <div className="mt-3 rounded-md border border-amber-400/30 bg-amber-500/10 p-2 text-[11px] text-amber-300/90">
                            Text might have not been properly formatted.
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
