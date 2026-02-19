import { RefreshCw } from 'lucide-react'
import TextPreviewContent from './TextPreviewContent'
import type { PreviewFile, PreviewMeta } from './types'
import { formatPreviewBytes, getFileUrl, isTextLikeFileType } from './utils'
import type { ViewportPreset, ViewportPresetConfig } from './viewport'
import SyntaxPreview from './SyntaxPreview'

interface PreviewBodyProps {
    file: PreviewFile
    content: string
    loading?: boolean
    meta: PreviewMeta
    viewport: ViewportPreset
    presetConfig: ViewportPresetConfig
    htmlViewMode: 'rendered' | 'code'
}

export default function PreviewBody({ file, content, loading, meta, viewport, presetConfig, htmlViewMode }: PreviewBodyProps) {
    const isTextLike = isTextLikeFileType(file.type)

    if (loading) {
        return (
            <div className="flex items-center justify-center py-24 w-full">
                <RefreshCw size={32} className="animate-spin text-white/20" />
            </div>
        )
    }

    if (isTextLike) {
        return <TextPreviewContent file={file} content={content} meta={meta} />
    }

    if (file.type === 'image') {
        return (
            <div className="flex items-center justify-center p-4">
                <img
                    src={getFileUrl(file.path)}
                    alt={file.name}
                    className="max-w-full max-h-[80vh] rounded-lg shadow-2xl object-contain"
                />
            </div>
        )
    }

    if (file.type === 'video') {
        return (
            <div className="flex items-center justify-center p-4 w-full">
                <video
                    src={getFileUrl(file.path)}
                    controls
                    className="max-w-full max-h-[80vh] rounded-lg shadow-2xl"
                />
            </div>
        )
    }

    if (file.type === 'html' && htmlViewMode === 'code') {
        const previewSize = formatPreviewBytes(meta.previewBytes)
        const totalSize = formatPreviewBytes(meta.size)

        return (
            <div className="w-full max-w-[96%] flex flex-col gap-3">
                {meta.truncated && (
                    <div className="w-full px-3 py-2 text-xs text-amber-200 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                        Preview truncated for stability.
                        {previewSize ? ` Showing ${previewSize}` : ''}
                        {totalSize ? ` of ${totalSize}` : ''}.
                    </div>
                )}
                <div className="w-full bg-sparkle-card rounded-xl border border-white/5 overflow-hidden">
                    <SyntaxPreview content={content} language={file.language || 'html'} filePath={file.path} />
                </div>
            </div>
        )
    }

    return (
        <div
            className="bg-white rounded-lg shadow-2xl overflow-hidden transition-[width,height] duration-300 ease-out will-change-[width,height]"
            style={{
                width: viewport === 'responsive' ? '100%' : `${presetConfig.width}px`,
                height: viewport === 'responsive' ? '70vh' : `${presetConfig.height}px`,
                minHeight: '400px',
                maxHeight: '80vh',
                maxWidth: '100%'
            }}
        >
            {/* @ts-ignore - webview is an Electron-specific tag */}
            <webview
                src={getFileUrl(file.path)}
                style={{ width: '100%', height: '100%', background: 'white' }}
            />
        </div>
    )
}
