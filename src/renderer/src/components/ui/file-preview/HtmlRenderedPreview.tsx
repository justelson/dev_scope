import { useMemo } from 'react'
import { cn } from '@/lib/utils'
import type { ViewportPreset, ViewportPresetConfig } from './viewport'

interface HtmlRenderedPreviewProps {
    filePath: string
    fileName: string
    content: string
    viewport: ViewportPreset
    presetConfig: ViewportPresetConfig
    isExpanded?: boolean
}

function getBaseHref(filePath: string): string {
    const normalized = String(filePath || '').replace(/\\/g, '/')
    const lastSlashIndex = normalized.lastIndexOf('/')
    const directoryPath = lastSlashIndex >= 0 ? normalized.slice(0, lastSlashIndex + 1) : normalized
    const trimmed = directoryPath.startsWith('/') ? directoryPath.slice(1) : directoryPath
    return `devscope:///${encodeURI(trimmed).replace(/#/g, '%23').replace(/\?/g, '%3F')}`
}

function buildPreviewDocument(content: string, filePath: string): string {
    const baseHref = getBaseHref(filePath)

    if (/<head(\s[^>]*)?>/i.test(content)) {
        return content.replace(/<head(\s[^>]*)?>/i, (match) => `${match}<base href="${baseHref}">`)
    }

    if (/<html(\s[^>]*)?>/i.test(content)) {
        return content.replace(/<html(\s[^>]*)?>/i, (match) => `${match}<head><base href="${baseHref}"></head>`)
    }

    return `<!DOCTYPE html><html><head><base href="${baseHref}"></head><body>${content}</body></html>`
}

export default function HtmlRenderedPreview({
    filePath,
    fileName,
    content,
    viewport,
    presetConfig,
    isExpanded = false
}: HtmlRenderedPreviewProps) {
    const previewDocument = useMemo(
        () => buildPreviewDocument(content, filePath),
        [content, filePath]
    )

    return (
        <div className="h-full w-full min-h-0 overflow-hidden bg-sparkle-bg">
            <div
                className={cn(
                    'mx-auto h-full overflow-hidden bg-white',
                    isExpanded ? 'rounded-none shadow-none' : 'rounded-lg shadow-2xl'
                )}
                style={{
                    width: viewport === 'responsive' ? '100%' : `${presetConfig.width}px`,
                    maxWidth: '100%'
                }}
            >
                <iframe
                    srcDoc={previewDocument}
                    title={`${fileName} preview`}
                    className="block h-full w-full"
                    style={{
                        minHeight: isExpanded ? '100%' : '400px',
                        background: 'white',
                        border: 'none'
                    }}
                />
            </div>
        </div>
    )
}
