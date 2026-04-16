import { useEffect } from 'react'
import { X } from 'lucide-react'
import ImagePreviewContent from '@/components/ui/file-preview/ImagePreviewContent'
import SyntaxPreview from '@/components/ui/file-preview/SyntaxPreview'
import { detectCodeLanguage } from '@/components/ui/file-preview/utils'
import type { ComposerContextFile } from './assistant-composer-types'

type AttachmentMeta = {
    name: string
    ext: string
    category: 'image' | 'code' | 'doc'
}

interface AssistantAttachmentPreviewModalProps {
    file: ComposerContextFile | null
    meta: AttachmentMeta | null
    contentType: string
    sizeLabel: string
    showFormattingWarning: boolean
    onUpdatePastedText?: (fileId: string, nextText: string) => void
    onClose: () => void
}

function inferLanguageFromContent(content: string): string {
    const sample = String(content || '').trim().slice(0, 4000)
    if (!sample) return 'text'

    if ((sample.startsWith('{') && sample.endsWith('}')) || (sample.startsWith('[') && sample.endsWith(']'))) {
        try {
            JSON.parse(sample)
            return 'json'
        } catch {
            // fall through
        }
    }

    if (/^\s*#!/m.test(sample) || /\b(echo|fi|done|esac|export)\b/.test(sample)) return 'bash'
    if (/\b(import\s+[\w*{},\s]+\s+from\s+['"]|export\s+(default|const|function|class)\b|interface\s+\w+\s*[{<])/m.test(sample)) return 'typescript'
    if (/\b(function\s+\w+\s*\(|const\s+\w+\s*=|let\s+\w+\s*=|=>)\b/m.test(sample)) return 'javascript'
    if (/\b(def\s+\w+\s*\(|import\s+\w+|from\s+\w+\s+import\s+|if __name__ == ['"]__main__['"])/m.test(sample)) return 'python'
    if (/<[a-z][\s\S]*>/i.test(sample) && /<\/[a-z]+>/i.test(sample)) return 'html'
    if (/[.#][\w-]+\s*\{[\s\S]*\}/m.test(sample)) return 'css'
    if (/^\s*---\s*$[\s\S]*?:\s*.+$/m.test(sample) || /^\s*\w+:\s*.+$/m.test(sample)) return 'yaml'
    if (/^\s*#+\s+.+$/m.test(sample) || /\[[^\]]+\]\([^)]+\)/.test(sample)) return 'markdown'
    if (/\b(SELECT|INSERT|UPDATE|DELETE|CREATE|ALTER|DROP)\b/i.test(sample)) return 'sql'

    return 'text'
}

function resolvePreviewLanguage(file: ComposerContextFile, meta: AttachmentMeta): string {
    const ext = String(meta.ext || '').toLowerCase()
    const mime = String(file.mimeType || '').toLowerCase()

    if (mime.includes('json') || ext === 'json') return 'json'
    if (mime.includes('markdown') || ext === 'md' || ext === 'mdx') return 'markdown'
    if (mime.includes('xml') || ext === 'xml') return 'xml'
    if (mime.includes('yaml') || ext === 'yml' || ext === 'yaml') return 'yaml'
    if (mime.includes('csv') || ext === 'csv') return 'csv'

    if (meta.category === 'code') {
        const detected = detectCodeLanguage(ext, meta.name)
        return detected || ext || inferLanguageFromContent(file.content || '')
    }

    const detectedFromExt = detectCodeLanguage(ext, meta.name)
    if (detectedFromExt) return detectedFromExt
    return inferLanguageFromContent(file.content || '')
}

export default function AssistantAttachmentPreviewModal({
    file,
    meta,
    contentType,
    sizeLabel,
    showFormattingWarning,
    onUpdatePastedText,
    onClose
}: AssistantAttachmentPreviewModalProps) {
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

    const previewText = String(file.content || file.previewText || '')
    const previewLanguage = resolvePreviewLanguage(file, meta)
    const isPastedTextPreview = file.source === 'paste' && Boolean(file.content)
    const isImagePreview = meta.category === 'image'
    const shouldShowFormattingWarning = showFormattingWarning && !isPastedTextPreview

    return (
        <div
            className="pointer-events-auto fixed inset-0 z-[70] flex items-center justify-center bg-black/70 backdrop-blur-md"
            onClick={onClose}
            onWheel={(event) => event.stopPropagation()}
            style={{ animation: 'fadeIn 0.15s ease-out' }}
        >
            <div
                className={
                    isImagePreview
                        ? 'pointer-events-auto m-4 flex h-[min(82vh,840px)] w-[min(88vw,1180px)] flex-col overflow-hidden rounded-2xl border border-white/10 bg-sparkle-card shadow-2xl'
                        : 'pointer-events-auto m-4 flex max-h-[90vh] w-full max-w-[90vw] flex-col overflow-hidden rounded-2xl border border-white/10 bg-sparkle-card shadow-2xl'
                }
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
                                {meta.ext || 'file'}
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
                        className="rounded-md border border-white/10 p-1.5 text-sparkle-text-muted transition-colors hover:border-rose-400/30 hover:bg-rose-500/10 hover:text-rose-200"
                        title="Close preview"
                    >
                        <X size={14} />
                    </button>
                </div>

                <div
                    className={isImagePreview ? 'min-h-0 flex-1 overflow-hidden bg-black/35 p-0' : 'custom-scrollbar flex-1 overflow-auto bg-sparkle-bg p-4'}
                    style={{ overscrollBehavior: 'contain' }}
                >
                    {isImagePreview ? (
                        <ImagePreviewContent
                            filePath={file.path}
                            fileName={meta.name}
                            isExpanded
                        />
                    ) : isPastedTextPreview ? (
                        <div className="flex h-[min(72vh,760px)] w-full flex-col overflow-hidden rounded-xl border border-white/5 bg-sparkle-card">
                            <div className="flex items-center justify-between gap-2 border-b border-white/5 px-4 py-3">
                                <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-sparkle-text-muted">
                                    Pasted text
                                </span>
                                <span className="text-[10px] text-sparkle-text-muted/70">
                                    Editable
                                </span>
                            </div>
                            <textarea
                                value={previewText}
                                onChange={(event) => {
                                    if (!file?.id || !onUpdatePastedText) return
                                    onUpdatePastedText(file.id, event.target.value)
                                }}
                                spellCheck={false}
                                className="custom-scrollbar min-h-0 flex-1 w-full resize-none overflow-auto bg-transparent px-4 py-4 text-[13px] leading-6 text-sparkle-text outline-none selection:bg-sky-400/25"
                            />
                        </div>
                    ) : previewText ? (
                        <div className="w-full max-w-[96%] overflow-hidden rounded-xl border border-white/5 bg-sparkle-card">
                            <SyntaxPreview
                                content={previewText}
                                language={previewLanguage}
                                filePath={file.path || meta.name}
                            />
                        </div>
                    ) : (
                        <div className="rounded-lg border border-white/10 bg-sparkle-card p-3 text-xs text-sparkle-text-muted">
                            No inline preview for this attachment.
                        </div>
                    )}

                    {shouldShowFormattingWarning && (
                        <div className="mt-3 rounded-md border border-amber-400/30 bg-amber-500/10 p-2 text-[11px] text-amber-300/90">
                            Text might have not been properly formatted.
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
