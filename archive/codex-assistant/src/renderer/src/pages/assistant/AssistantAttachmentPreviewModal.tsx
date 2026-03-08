import { useEffect } from 'react'
import { X } from 'lucide-react'
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
    onClose: () => void
}

function normalizePreviewText(content: unknown, fallbackPreviewText: string | undefined): string {
    if (typeof content === 'string' && content) return content
    if (typeof fallbackPreviewText === 'string' && fallbackPreviewText) return fallbackPreviewText
    if (content == null) return ''
    if (typeof content === 'number' || typeof content === 'boolean' || typeof content === 'bigint') {
        return String(content)
    }
    try {
        return JSON.stringify(content, null, 2)
    } catch {
        return String(content)
    }
}

function inferLanguageFromContent(content: string): string {
    const sample = String(content || '').trim().slice(0, 4000)
    if (!sample) return 'text'

    if ((sample.startsWith('{') && sample.endsWith('}')) || (sample.startsWith('[') && sample.endsWith(']'))) {
        try {
            JSON.parse(sample)
            return 'json'
        } catch {
            // continue to other heuristics
        }
    }

    if (/^\s*#!/m.test(sample) || /\b(echo|fi|done|esac|export)\b/.test(sample)) return 'bash'
    if (/\b(import\s+[\w*{},\s]+\s+from\s+['"]|export\s+(default|const|function|class)\b|interface\s+\w+\s*[{<])/m.test(sample)) return 'typescript'
    if (/\b(function\s+\w+\s*\(|const\s+\w+\s*=|let\s+\w+\s*=|=>)\b/m.test(sample)) return 'javascript'
    if (/\b(def\s+\w+\s*\(|import\s+\w+|from\s+\w+\s+import\s+|if __name__ == ['"]__main__['"])/m.test(sample)) return 'python'
    if (/<[a-z][\s\S]*>/i.test(sample) && /<\/[a-z]+>/i.test(sample)) return 'html'
    if (/[.#][\w-]+\s*\{[\s\S]*\}/m.test(sample)) return 'css'
    if (/^\s*[\w.-]+\s*=\s*.+$/m.test(sample)) return 'ini'
    if (/^\s*[\w.-]+\s*=\s*(['"].*['"]|\d+|true|false|\[.*\]|\{.*\})\s*$/m.test(sample)) return 'toml'
    if (/^\s*---\s*$[\s\S]*?:\s*.+$/m.test(sample) || /^\s*\w+:\s*.+$/m.test(sample)) return 'yaml'
    if (/^\s*#+\s+.+$/m.test(sample) || /\[[^\]]+\]\([^)]+\)/.test(sample)) return 'markdown'
    if (/^\s*diff\s--git\b/m.test(sample) || /^\s*@@\s[-+,\d]+\s[-+,\d]+\s@@/m.test(sample)) return 'git'
    if (/^[^\n]*,[^\n]*(\r?\n|$)/.test(sample) || /^[^\n]*\t[^\n]*(\r?\n|$)/.test(sample)) return 'csv'
    if (/\b(SELECT|INSERT|UPDATE|DELETE|CREATE|ALTER|DROP)\b/i.test(sample)) return 'sql'

    return 'text'
}

function resolvePreviewLanguage(file: ComposerContextFile, meta: AttachmentMeta): string {
    const ext = String(meta.ext || '').toLowerCase()
    const mime = String(file.mimeType || '').toLowerCase()
    const content = normalizePreviewText(file.content, file.previewText)

    const languageByMime: Array<[RegExp, string]> = [
        [/json/, 'json'],
        [/markdown/, 'markdown'],
        [/xml/, 'xml'],
        [/(yaml|yml)/, 'yaml'],
        [/(csv|tab-separated-values)/, 'csv'],
        [/html/, 'html'],
        [/css/, 'css'],
        [/(javascript|ecmascript)/, 'javascript'],
        [/typescript/, 'typescript'],
        [/python/, 'python'],
        [/(shell|x-sh|bash|zsh)/, 'bash'],
        [/powershell/, 'powershell'],
        [/sql/, 'sql'],
        [/(toml|ini|dotenv|properties|plain)/, 'text']
    ]

    if (mime.includes('json') || ext === 'json') return 'json'
    if (mime.includes('markdown') || ext === 'md' || ext === 'mdx') return 'markdown'
    if (mime.includes('xml') || ext === 'xml') return 'xml'
    if (mime.includes('yaml') || ext === 'yml' || ext === 'yaml') return 'yaml'
    if (mime.includes('csv') || ext === 'csv') return 'csv'
    if (ext === 'tsv') return 'csv'
    if (ext === 'toml' || ext === 'ini' || ext === 'conf' || ext === 'env' || ext === 'properties') return 'text'

    for (const [pattern, language] of languageByMime) {
        if (pattern.test(mime)) return language
    }

    if (meta.category === 'code') {
        const detected = detectCodeLanguage(ext, meta.name)
        return detected || inferLanguageFromContent(content)
    }

    const detectedFromExt = detectCodeLanguage(ext, meta.name)
    if (detectedFromExt) return detectedFromExt
    if (mime.startsWith('text/')) return inferLanguageFromContent(content)
    return inferLanguageFromContent(content)
}

export function AssistantAttachmentPreviewModal({
    file,
    meta,
    contentType,
    sizeLabel,
    showFormattingWarning,
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

    const previewText = normalizePreviewText(file.content, file.previewText)
    const previewLanguage = resolvePreviewLanguage(file, meta)

    return (
        <div
            className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 backdrop-blur-md"
            onClick={onClose}
            onWheel={(event) => event.stopPropagation()}
            style={{ animation: 'fadeIn 0.15s ease-out' }}
        >
            <div
                className="bg-sparkle-card border border-white/10 rounded-2xl shadow-2xl w-full max-w-[95vw] max-h-[90vh] flex flex-col m-4 overflow-hidden"
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
                        className="rounded-md border border-white/10 p-1.5 text-sparkle-text-muted transition-colors hover:border-white/20 hover:bg-sparkle-bg hover:text-sparkle-text"
                        title="Close preview"
                    >
                        <X size={14} />
                    </button>
                </div>

                <div
                    className="flex-1 custom-scrollbar bg-sparkle-bg overflow-auto p-4"
                    style={{ overscrollBehavior: 'contain' }}
                >
                    {meta.category === 'image' && file.previewDataUrl ? (
                        <div className="flex min-h-full items-start justify-center">
                            <img
                                src={file.previewDataUrl}
                                alt={meta.name}
                                className="max-h-[78vh] max-w-full rounded-lg border border-white/10 object-contain"
                            />
                        </div>
                    ) : previewText ? (
                        <div className="w-full max-w-[96%] rounded-xl border border-white/5 overflow-hidden bg-sparkle-card">
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

                    {showFormattingWarning && (
                        <div className="mt-3 rounded-md border border-amber-400/30 bg-amber-500/10 p-2 text-[11px] text-amber-300/90">
                            This pasted text appears to have been trimmed or contains invalid characters.
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}

export default AssistantAttachmentPreviewModal
