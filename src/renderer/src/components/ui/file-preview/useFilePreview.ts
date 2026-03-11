import { useState } from 'react'
import type { PreviewFile, PreviewMediaItem, PreviewMediaSource, PreviewOpenOptions } from './types'
import { isMediaPreviewType, resolvePreviewType } from './utils'

async function yieldToBrowserPaint(): Promise<void> {
    await new Promise<void>((resolve) => {
        if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
            window.requestAnimationFrame(() => resolve())
            return
        }
        setTimeout(resolve, 0)
    })
}

export interface UseFilePreviewReturn {
    previewFile: PreviewFile | null
    previewMediaItems: PreviewMediaItem[]
    previewContent: string
    loadingPreview: boolean
    previewTruncated: boolean
    previewSize: number | null
    previewBytes: number | null
    previewModifiedAt: number | null
    openPreview: (
        file: { name: string; path: string },
        ext: string,
        options?: PreviewOpenOptions
    ) => Promise<void>
    closePreview: () => void
    openFile: (filePath: string) => Promise<void>
}

function normalizePreviewContent(content: unknown): string {
    if (typeof content === 'string') return content
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

function normalizeMediaItems(items?: PreviewMediaSource[]): PreviewMediaItem[] {
    if (!items?.length) return []

    const deduped = new Map<string, PreviewMediaItem>()
    for (const item of items) {
        const name = String(item?.name || '').trim()
        const path = String(item?.path || '').trim()
        const extension = String(item?.extension || '').trim().toLowerCase()
        if (!name || !path) continue

        const previewTarget = resolvePreviewType(name, extension)
        if (!previewTarget || !isMediaPreviewType(previewTarget.type)) continue

        const dedupeKey = path.toLowerCase()
        if (deduped.has(dedupeKey)) continue

        deduped.set(dedupeKey, {
            name,
            path,
            extension,
            thumbnailPath: item.thumbnailPath ?? null,
            type: previewTarget.type
        })
    }

    return Array.from(deduped.values())
}

export function useFilePreview(): UseFilePreviewReturn {
    const [previewFile, setPreviewFile] = useState<PreviewFile | null>(null)
    const [previewMediaItems, setPreviewMediaItems] = useState<PreviewMediaItem[]>([])
    const [previewContent, setPreviewContent] = useState<string>('')
    const [loadingPreview, setLoadingPreview] = useState(false)
    const [previewTruncated, setPreviewTruncated] = useState(false)
    const [previewSize, setPreviewSize] = useState<number | null>(null)
    const [previewBytes, setPreviewBytes] = useState<number | null>(null)
    const [previewModifiedAt, setPreviewModifiedAt] = useState<number | null>(null)

    const resetMeta = () => {
        setPreviewTruncated(false)
        setPreviewSize(null)
        setPreviewBytes(null)
        setPreviewModifiedAt(null)
    }

    const openFile = async (filePath: string) => {
        try {
            const res = await window.devscope.openFile(filePath)
            if (!res.success) {
                console.error('Failed to open file:', res.error)
            }
        } catch (err) {
            console.error('Failed to open file:', err)
        }
    }

    const openPreview = async (
        file: { name: string; path: string },
        ext: string,
        options?: PreviewOpenOptions
    ) => {
        resetMeta()
        setLoadingPreview(false)
        setPreviewMediaItems(normalizeMediaItems(options?.mediaItems))
        const previewTarget = resolvePreviewType(file.name, ext)

        if (!previewTarget) {
            void openFile(file.path)
            return
        }

        setPreviewFile({
            name: file.name,
            path: file.path,
            type: previewTarget.type,
            language: previewTarget.language,
            startInEditMode: options?.startInEditMode === true
        })

        if (!previewTarget.needsContent) {
            setPreviewContent('')
            return
        }

        setLoadingPreview(true)
        await yieldToBrowserPaint()

        try {
            const res = await window.devscope.readFileContent(file.path)
            if (res.success) {
                setPreviewContent(normalizePreviewContent(res.content))
                setPreviewTruncated(Boolean(res.truncated))
                setPreviewSize(typeof res.size === 'number' ? res.size : null)
                setPreviewBytes(typeof res.previewBytes === 'number' ? res.previewBytes : null)
                setPreviewModifiedAt(typeof res.modifiedAt === 'number' ? res.modifiedAt : null)
            } else {
                console.error('Failed to load file:', res.error)
                setPreviewFile(null)
            }
        } catch (err) {
            console.error('Failed to load file:', err)
            setPreviewFile(null)
        } finally {
            setLoadingPreview(false)
        }
    }

    const closePreview = () => {
        setPreviewFile(null)
        setPreviewMediaItems([])
        setPreviewContent('')
        resetMeta()
    }

    return {
        previewFile,
        previewMediaItems,
        previewContent,
        loadingPreview,
        previewTruncated,
        previewSize,
        previewBytes,
        previewModifiedAt,
        openPreview,
        closePreview,
        openFile
    }
}
