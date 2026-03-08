import { app } from 'electron'
import { access, mkdir, writeFile } from 'node:fs/promises'
import { basename, extname, isAbsolute, join } from 'node:path'
import { randomBytes } from 'node:crypto'
import type { AssistantSendOptions } from './types'

type ContextFileEntry = NonNullable<AssistantSendOptions['contextFiles']>[number]

const MIME_EXTENSION_MAP: Record<string, string> = {
    'image/apng': '.apng',
    'image/avif': '.avif',
    'image/bmp': '.bmp',
    'image/x-ms-bmp': '.bmp',
    'image/heic': '.heic',
    'image/heif': '.heif',
    'image/vnd.microsoft.icon': '.ico',
    'image/x-icon': '.ico',
    'image/jfif': '.jfif',
    'image/jpg': '.jpg',
    'image/pjpeg': '.jpg',
    'image/pjp': '.jpg',
    'image/png': '.png',
    'image/jpeg': '.jpg',
    'image/webp': '.webp',
    'image/gif': '.gif',
    'image/jxl': '.jxl',
    'image/x-jxl': '.jxl',
    'image/tiff': '.tif',
    'image/svg+xml': '.svg',
    'text/plain': '.txt',
    'text/markdown': '.md',
    'application/json': '.json'
}

type ParsedDataUrl = {
    mimeType: string
    payload: string
    isBase64: boolean
}

function readString(value: unknown): string {
    return typeof value === 'string' ? value : ''
}

async function exists(filePath: string): Promise<boolean> {
    try {
        await access(filePath)
        return true
    } catch {
        return false
    }
}

function parseDataUrl(value: string): ParsedDataUrl | null {
    const match = value.match(/^data:([^,]*),(.*)$/is)
    if (!match) return null

    const rawMeta = String(match[1] || '').trim()
    const payload = String(match[2] || '')
    const metaParts = rawMeta.split(';').map((part) => part.trim()).filter(Boolean)
    const first = metaParts[0] || ''
    const hasExplicitMime = Boolean(first) && !first.includes('=')
    const mimeType = (hasExplicitMime ? first : 'text/plain').toLowerCase()
    const isBase64 = metaParts.some((part) => part.toLowerCase() === 'base64')

    return {
        mimeType,
        payload,
        isBase64
    }
}

function isDataUrl(value: string): boolean {
    return Boolean(parseDataUrl(value))
}

function decodeDataUrl(value: string): Buffer | null {
    const parsed = parseDataUrl(value)
    if (!parsed) return null
    try {
        if (parsed.isBase64) {
            return Buffer.from(parsed.payload, 'base64')
        }
        return Buffer.from(decodeURIComponent(parsed.payload), 'utf-8')
    } catch {
        return null
    }
}

function extensionFromMimeType(mimeTypeRaw: string): string {
    const mimeType = String(mimeTypeRaw || '').trim().toLowerCase()
    if (!mimeType) return ''
    if (MIME_EXTENSION_MAP[mimeType]) return MIME_EXTENSION_MAP[mimeType]
    if (!mimeType.startsWith('image/')) return ''

    const subtype = mimeType
        .slice('image/'.length)
        .split(';')[0]
        .split('+')[0]
        .trim()
    if (!subtype) return '.img'
    if (subtype === 'jpeg') return '.jpg'
    const safeSubtype = subtype.replace(/[^a-z0-9]/g, '')
    return safeSubtype ? `.${safeSubtype}` : '.img'
}

function sanitizeName(input: string): string {
    const fallback = 'attachment'
    const trimmed = input.trim()
    if (!trimmed) return fallback
    const safe = trimmed.replace(/[<>:"/\\|?*\u0000-\u001F]/g, '-').replace(/\s+/g, ' ').trim()
    return safe || fallback
}

function inferExtension(entry: ContextFileEntry, content: string): string {
    const fromName = extname(readString(entry.name).trim())
    if (fromName) return fromName.toLowerCase()

    const fromPath = extname(readString(entry.path).trim())
    if (fromPath && !/^clipboard:\/\//i.test(readString(entry.path).trim())) return fromPath.toLowerCase()

    const mimeType = readString(entry.mimeType).trim().toLowerCase()
    const fromMime = extensionFromMimeType(mimeType)
    if (fromMime) return fromMime

    const dataUrlMimeType = parseDataUrl(content)?.mimeType || ''
    const fromDataUrlMime = extensionFromMimeType(dataUrlMimeType)
    if (fromDataUrlMime) return fromDataUrlMime

    const kind = readString(entry.kind).trim().toLowerCase()
    if (kind === 'image') return '.img'
    if (kind === 'code') return '.txt'
    if (kind === 'doc') return '.txt'
    if (isDataUrl(content)) return '.bin'
    return '.txt'
}

function normalizePathForName(entry: ContextFileEntry): string {
    const name = readString(entry.name).trim()
    if (name) return name
    const path = readString(entry.path).trim()
    if (!path) return 'attachment'
    const leaf = basename(path)
    return leaf || 'attachment'
}

function needsMaterialization(entry: ContextFileEntry, content: string): boolean {
    const path = readString(entry.path).trim()
    if (path.startsWith('clipboard://')) return true
    if (!path) return true
    if (!isAbsolute(path)) return true
    if (content) return true
    return false
}

async function resolveMaterializeDir(projectPath?: string): Promise<string> {
    if (projectPath && projectPath.trim()) {
        return join(projectPath, '.devscope', 'assistant-context')
    }
    return join(app.getPath('userData'), 'assistant-context')
}

export async function materializeContextFilesForSend(
    contextFiles: AssistantSendOptions['contextFiles'],
    projectPath?: string
): Promise<AssistantSendOptions['contextFiles']> {
    if (!Array.isArray(contextFiles) || contextFiles.length === 0) return contextFiles

    const baseDir = await resolveMaterializeDir(projectPath)
    await mkdir(baseDir, { recursive: true })

    const next: ContextFileEntry[] = []
    for (const rawEntry of contextFiles) {
        const entry = (rawEntry || {}) as ContextFileEntry
        const content = readString(entry.content)
        const currentPath = readString(entry.path).trim()

        if (currentPath && isAbsolute(currentPath) && await exists(currentPath)) {
            next.push({ ...entry, path: currentPath })
            continue
        }

        if (!needsMaterialization(entry, content)) {
            next.push({ ...entry, path: currentPath })
            continue
        }

        const fileNameHint = normalizePathForName(entry)
        const ext = inferExtension(entry, content)
        const stem = sanitizeName(fileNameHint.replace(/\.[^.]+$/, ''))
        const nonce = randomBytes(4).toString('hex')
        const targetPath = join(baseDir, `${Date.now()}-${nonce}-${stem}${ext}`)
        const detectedMimeType = readString(entry.mimeType).trim().toLowerCase()
            || parseDataUrl(content)?.mimeType
            || undefined

        if (isDataUrl(content)) {
            const decoded = decodeDataUrl(content)
            if (decoded) {
                await writeFile(targetPath, decoded)
            } else {
                await writeFile(targetPath, content, 'utf-8')
            }
        } else {
            await writeFile(targetPath, content || '', 'utf-8')
        }

        next.push({
            ...entry,
            path: targetPath,
            mimeType: detectedMimeType
        })
    }

    return next
}
