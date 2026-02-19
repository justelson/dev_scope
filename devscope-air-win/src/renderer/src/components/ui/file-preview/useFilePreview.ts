import { useState } from 'react'
import type { PreviewFile } from './types'
import { resolvePreviewType } from './utils'

export interface UseFilePreviewReturn {
    previewFile: PreviewFile | null
    previewContent: string
    loadingPreview: boolean
    previewTruncated: boolean
    previewSize: number | null
    previewBytes: number | null
    openPreview: (file: { name: string; path: string }, ext: string) => Promise<void>
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

export function useFilePreview(): UseFilePreviewReturn {
    const [previewFile, setPreviewFile] = useState<PreviewFile | null>(null)
    const [previewContent, setPreviewContent] = useState<string>('')
    const [loadingPreview, setLoadingPreview] = useState(false)
    const [previewTruncated, setPreviewTruncated] = useState(false)
    const [previewSize, setPreviewSize] = useState<number | null>(null)
    const [previewBytes, setPreviewBytes] = useState<number | null>(null)

    const resetMeta = () => {
        setPreviewTruncated(false)
        setPreviewSize(null)
        setPreviewBytes(null)
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

    const openPreview = async (file: { name: string; path: string }, ext: string) => {
        resetMeta()
        const previewTarget = resolvePreviewType(file.name, ext)

        if (!previewTarget) {
            await openFile(file.path)
            return
        }

        setLoadingPreview(true)
        setPreviewFile({
            name: file.name,
            path: file.path,
            type: previewTarget.type,
            language: previewTarget.language
        })

        if (!previewTarget.needsContent) {
            setPreviewContent('')
            setLoadingPreview(false)
            return
        }

        try {
            const res = await window.devscope.readFileContent(file.path)
            if (res.success) {
                setPreviewContent(normalizePreviewContent(res.content))
                setPreviewTruncated(Boolean(res.truncated))
                setPreviewSize(typeof res.size === 'number' ? res.size : null)
                setPreviewBytes(typeof res.previewBytes === 'number' ? res.previewBytes : null)
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
        setPreviewContent('')
        resetMeta()
    }

    return {
        previewFile,
        previewContent,
        loadingPreview,
        previewTruncated,
        previewSize,
        previewBytes,
        openPreview,
        closePreview,
        openFile
    }
}
