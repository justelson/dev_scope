import { useMemo } from 'react'
import MarkdownRenderer from '../MarkdownRenderer'
import { HIGHLIGHT_MAX_CHARS, HIGHLIGHT_MAX_LINES } from './constants'
import type { PreviewFile, PreviewMeta } from './types'
import { formatPreviewBytes } from './utils'
import CsvPreviewTable from './CsvPreviewTable'
import SyntaxPreview from './SyntaxPreview'

interface TextPreviewContentProps {
    file: PreviewFile
    content: string
    meta: PreviewMeta
}

export default function TextPreviewContent({ file, content, meta }: TextPreviewContentProps) {
    const isLargeTextPreview = useMemo(() => {
        const lineCount = content.split(/\r?\n/).length
        return content.length > HIGHLIGHT_MAX_CHARS || lineCount > HIGHLIGHT_MAX_LINES
    }, [content])

    const jsonState = useMemo(() => {
        if (file.type !== 'json') {
            return { formatted: null as string | null, invalid: false, skippedFormatting: false }
        }
        if (isLargeTextPreview) {
            return { formatted: null as string | null, invalid: false, skippedFormatting: true }
        }
        try {
            return { formatted: JSON.stringify(JSON.parse(content), null, 2), invalid: false, skippedFormatting: false }
        } catch {
            return { formatted: null as string | null, invalid: true, skippedFormatting: false }
        }
    }, [content, file.type, isLargeTextPreview])

    const previewSize = formatPreviewBytes(meta.previewBytes)
    const totalSize = formatPreviewBytes(meta.size)

    return (
        <div className="w-full flex flex-col items-center gap-3">
            {meta.truncated && (
                <div className="w-full max-w-5xl px-3 py-2 text-xs text-amber-200 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                    Preview truncated for stability.
                    {previewSize ? ` Showing ${previewSize}` : ''}
                    {totalSize ? ` of ${totalSize}` : ''}.
                </div>
            )}

            {file.type === 'md' && (
                <div className="w-full max-w-4xl bg-sparkle-card rounded-xl p-6 border border-white/5">
                    <MarkdownRenderer content={content} filePath={file.path} />
                </div>
            )}

            {file.type === 'json' && (
                <div className="w-full max-w-[96%] bg-sparkle-card rounded-xl border border-white/5 overflow-hidden">
                    {jsonState.formatted ? (
                        <SyntaxPreview content={jsonState.formatted} language="json" filePath={file.path} />
                    ) : (
                        <div>
                            {jsonState.invalid && (
                                <div className="text-xs text-amber-300 px-4 pt-3">Invalid JSON format. Showing raw content.</div>
                            )}
                            {jsonState.skippedFormatting && (
                                <div className="text-xs text-sky-300/80 px-4 pt-3">Large file: showing raw JSON preview.</div>
                            )}
                            <SyntaxPreview content={content} language="json" filePath={file.path} />
                        </div>
                    )}
                </div>
            )}

            {file.type === 'csv' && (
                <CsvPreviewTable content={content} language={file.language} />
            )}

            {file.type === 'code' && (
                <div className="w-full max-w-[96%] bg-sparkle-card rounded-xl border border-white/5 overflow-hidden">
                    <SyntaxPreview content={content} language={file.language || 'text'} filePath={file.path} />
                </div>
            )}

            {file.type === 'text' && (
                <div className="w-full max-w-[96%] bg-sparkle-card rounded-xl border border-white/5 overflow-hidden">
                    <SyntaxPreview content={content} language="text" filePath={file.path} />
                </div>
            )}
        </div>
    )
}
