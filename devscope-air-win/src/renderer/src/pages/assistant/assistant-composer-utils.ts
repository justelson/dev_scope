import type { ComposerContextFile } from './assistant-composer-types'

export const SLASH_COMMANDS = [
    { command: '/yolo', description: 'Sets the assistant approval mode to YOLO locally.' },
    { command: '/safe', description: 'Sets the assistant approval mode back to Safe.' },
    { command: '/include', description: 'Add a file to context.' }
]
export const DRAFT_STORAGE_KEY = 'devscope:assistant:draft:v1'
export const MAX_COMPOSER_HEIGHT = 160
const LARGE_PASTE_MIN_LINES = 40
const LARGE_PASTE_MIN_CHARS = 1200
const MAX_ATTACHMENT_CONTENT_CHARS = 12_000
const MAX_PREVIEW_TEXT_CHARS = 220

export const MAX_IMAGE_DATA_URL_CHARS = 180_000
export const ATTACHMENT_REMOVE_MS = 190

export function createAttachmentId(): string {
    return `ctx_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

export function summarizeTextPreview(raw: string): string {
    const normalized = String(raw || '')
        .replace(/\r/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim()
    if (!normalized) return ''
    const preview = normalized.slice(0, MAX_PREVIEW_TEXT_CHARS)
    return preview.length < normalized.length ? `${preview}...` : preview
}

export function isLargeTextPaste(raw: string): boolean {
    const text = String(raw || '')
    if (!text.trim()) return false
    const lines = text.split(/\r?\n/).length
    return lines >= LARGE_PASTE_MIN_LINES || text.length >= LARGE_PASTE_MIN_CHARS
}

export function toKbLabel(bytes?: number): string {
    if (!Number.isFinite(bytes)) return ''
    const value = Number(bytes)
    if (value < 1024) return `${value} B`
    return `${(value / 1024).toFixed(value >= 10 * 1024 ? 0 : 1)} KB`
}

export function getContextFileMeta(file: Partial<ComposerContextFile>): {
    name: string
    ext: string
    category: 'image' | 'code' | 'doc'
} {
    const rawPath = String(file.path || '').trim()
    const rawName = String(file.name || '').trim()
    const normalized = rawName || rawPath
    const name = normalized.split(/[/\\]/).pop() || normalized || 'attachment'
    const dotIndex = name.lastIndexOf('.')
    const ext = dotIndex > 0 ? name.slice(dotIndex + 1).toLowerCase() : ''
    const mimeType = String(file.mimeType || '').toLowerCase()

    const imageExts = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'ico', 'tif', 'tiff'])
    const codeExts = new Set([
        'ts', 'tsx', 'js', 'jsx', 'mjs', 'cjs', 'json', 'py', 'go', 'rs', 'java', 'kt', 'cs', 'cpp', 'c', 'h',
        'css', 'scss', 'sass', 'html', 'xml', 'yml', 'yaml', 'toml', 'sh', 'ps1', 'sql', 'md'
    ])

    if (file.kind === 'image' || mimeType.startsWith('image/') || imageExts.has(ext)) {
        return { name, ext: ext || 'img', category: 'image' }
    }
    if (file.kind === 'code' || codeExts.has(ext)) {
        return { name, ext: ext || 'code', category: 'code' }
    }
    return { name, ext: ext || 'file', category: 'doc' }
}

export function buildAttachmentPath(source: 'paste' | 'manual', name: string): string {
    if (source === 'paste') return `clipboard://${name}`
    return name
}

export async function readFileAsDataUrl(file: File): Promise<string> {
    return await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onerror = () => reject(new Error('Failed to read image from clipboard.'))
        reader.onload = () => resolve(String(reader.result || ''))
        reader.readAsDataURL(file)
    })
}

export function buildTextAttachmentFromPaste(text: string): ComposerContextFile {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const name = `pasted-snippet-${timestamp}.txt`
    const trimmed = text.length > MAX_ATTACHMENT_CONTENT_CHARS
        ? `${text.slice(0, MAX_ATTACHMENT_CONTENT_CHARS)}\n\n[truncated]`
        : text

    return {
        id: createAttachmentId(),
        path: buildAttachmentPath('paste', name),
        name,
        kind: 'doc',
        mimeType: 'text/plain',
        sizeBytes: text.length,
        content: trimmed,
        previewText: summarizeTextPreview(text),
        source: 'paste',
        animateIn: true
    }
}

export function isPastedTextAttachment(file: ComposerContextFile): boolean {
    const mime = String(file.mimeType || '').toLowerCase()
    const hasTextLikeMime = mime.startsWith('text/') || mime.includes('json') || mime.includes('xml')
    const isTextKind = file.kind === 'doc' || file.kind === 'code'
    return file.source === 'paste' && Boolean(file.content) && (hasTextLikeMime || isTextKind)
}

export function getContentTypeTag(file: ComposerContextFile): string {
    const meta = getContextFileMeta(file)
    if (meta.category === 'image') return 'IMAGE'
    if (meta.category === 'code') return 'CODE'
    if (isPastedTextAttachment(file)) return 'TEXT'
    return 'FILE'
}
