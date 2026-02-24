/**
 * FilePreviewModal - Reusable modal for previewing files
 */

import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import type { PreviewFile, PreviewMeta } from './file-preview/types'
import PreviewBody from './file-preview/PreviewBody'
import PreviewErrorBoundary from './file-preview/PreviewErrorBoundary'
import PreviewModalHeader from './file-preview/PreviewModalHeader'
import { VIEWPORT_PRESETS, type ViewportPreset } from './file-preview/viewport'
import { useFilePreview } from './file-preview/useFilePreview'

interface FilePreviewModalProps extends PreviewMeta {
    file: PreviewFile
    content: string
    loading?: boolean
    onClose: () => void
}

export function FilePreviewModal({ file, content, loading, truncated, size, previewBytes, onClose }: FilePreviewModalProps) {
    const isCsv = file.type === 'csv'
    const isHtml = file.type === 'html'

    const [viewport, setViewport] = useState<ViewportPreset>('responsive')
    const [htmlViewMode, setHtmlViewMode] = useState<'rendered' | 'code'>('rendered')
    const [csvDistinctColorsEnabled, setCsvDistinctColorsEnabled] = useState(true)
    const presetConfig = VIEWPORT_PRESETS[viewport]
    const isCompactHtmlViewport = isHtml && viewport !== 'responsive' && presetConfig.width <= 768

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose()
        }
        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [onClose])

    useEffect(() => {
        const originalOverflow = document.body.style.overflow
        document.body.style.overflow = 'hidden'
        return () => {
            document.body.style.overflow = originalOverflow
        }
    }, [])

    useEffect(() => {
        setHtmlViewMode('rendered')
    }, [file.path])

    const handleOpenInBrowser = async () => {
        try {
            await window.devscope.openFile(file.path)
        } catch (err) {
            console.error('Failed to open in browser:', err)
        }
    }

    return (
        <div
            className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 backdrop-blur-md"
            onClick={onClose}
            style={{ animation: 'fadeIn 0.15s ease-out' }}
            onWheel={e => e.stopPropagation()}
        >
            <div
                className="bg-sparkle-card border border-white/10 rounded-2xl shadow-2xl w-full max-w-[95vw] max-h-[90vh] flex flex-col m-4 overflow-hidden transition-[width,max-width] duration-300 ease-out"
                onClick={e => e.stopPropagation()}
                style={{
                    animation: 'scaleIn 0.15s ease-out',
                    width: viewport === 'responsive' ? '95vw' : `min(${presetConfig.width + 48}px, 95vw)`,
                    maxWidth: viewport === 'responsive' ? '1400px' : `${presetConfig.width + 48}px`
                }}
            >
                <PreviewModalHeader
                    file={file}
                    viewport={viewport}
                    onViewportChange={setViewport}
                    htmlViewMode={htmlViewMode}
                    onHtmlViewModeChange={setHtmlViewMode}
                    csvDistinctColorsEnabled={csvDistinctColorsEnabled}
                    onCsvDistinctColorsEnabledChange={setCsvDistinctColorsEnabled}
                    onOpenInBrowser={handleOpenInBrowser}
                    onClose={onClose}
                />

                <div
                    className={cn(
                        'flex-1 custom-scrollbar flex items-start justify-center bg-sparkle-bg',
                        isCompactHtmlViewport ? 'p-2 sm:p-3' : 'p-4',
                        isCsv || (isHtml && htmlViewMode === 'code') ? 'overflow-hidden' : 'overflow-auto'
                    )}
                    style={{ overscrollBehavior: 'contain' }}
                >
                    <PreviewErrorBoundary resetKey={`${file.path}:${file.type}:${viewport}:${htmlViewMode}`}>
                        <PreviewBody
                            file={file}
                            content={content}
                            loading={loading}
                            meta={{ truncated, size, previewBytes }}
                            viewport={viewport}
                            presetConfig={presetConfig}
                            htmlViewMode={htmlViewMode}
                            csvDistinctColorsEnabled={csvDistinctColorsEnabled}
                        />
                    </PreviewErrorBoundary>
                </div>
            </div>
        </div>
    )
}

export { useFilePreview }

export default FilePreviewModal
