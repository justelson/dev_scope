import { RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'
import TextPreviewContent from './TextPreviewContent'
import type { PreviewFile, PreviewMeta } from './types'
import { formatPreviewBytes, getFileUrl, isTextLikeFileType } from './utils'
import type { ViewportPreset, ViewportPresetConfig } from './viewport'
import SyntaxPreview from './SyntaxPreview'
import type { editor as MonacoEditor } from 'monaco-editor'
import type { GitLineMarker } from './gitDiff'

interface PreviewBodyProps {
    file: PreviewFile
    content: string
    loading?: boolean
    meta: PreviewMeta
    projectPath?: string
    gitDiffText?: string
    viewport: ViewportPreset
    presetConfig: ViewportPresetConfig
    htmlViewMode: 'rendered' | 'code'
    csvDistinctColorsEnabled: boolean
    mode: 'preview' | 'edit'
    editableContent: string
    onEditableContentChange: (value: string) => void
    isEditable: boolean
    loadingEditableContent?: boolean
    onEditorMount?: (editor: MonacoEditor.IStandaloneCodeEditor) => void
    editorWordWrap?: 'on' | 'off'
    editorMinimapEnabled?: boolean
    editorFontSize?: number
    findRequestToken?: number
    replaceRequestToken?: number
    focusLine?: number | null
    fillEditorHeight?: boolean
    lineMarkersOverride?: GitLineMarker[]
    previewFocusLine?: number | null
    isExpanded?: boolean
    fullBleed?: boolean
}

function resolveEditorLanguage(file: PreviewFile): string {
    if (file.type === 'md') return 'markdown'
    if (file.type === 'json') return 'json'
    if (file.type === 'csv') return file.language === 'tsv' ? 'plaintext' : 'csv'
    if (file.type === 'html') return 'html'
    if (file.type === 'code') return file.language || 'text'
    return 'text'
}

export default function PreviewBody({
    file,
    content,
    loading,
    meta,
    projectPath,
    gitDiffText,
    viewport,
    presetConfig,
    htmlViewMode,
    csvDistinctColorsEnabled,
    mode,
    editableContent,
    onEditableContentChange,
    isEditable,
    loadingEditableContent,
    onEditorMount,
    editorWordWrap,
    editorMinimapEnabled,
    editorFontSize,
    findRequestToken,
    replaceRequestToken,
    focusLine,
    fillEditorHeight = false,
    lineMarkersOverride,
    previewFocusLine,
    isExpanded = false,
    fullBleed = false
}: PreviewBodyProps) {
    const isTextLike = isTextLikeFileType(file.type)
    const useFullBleed = isExpanded || fullBleed

    if (loading || loadingEditableContent) {
        return (
            <div className="flex items-center justify-center py-24 w-full">
                <RefreshCw size={32} className="animate-spin text-white/20" />
            </div>
        )
    }

    if (mode === 'edit') {
        if (!isEditable) {
            return (
                <div className="w-full max-w-4xl rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
                    This file type is preview-only right now.
                </div>
            )
        }

        return (
            <div className={cn(
                'w-full h-full max-h-full max-w-[98%] bg-sparkle-card rounded-xl border border-white/5 overflow-hidden',
                (fillEditorHeight || useFullBleed) ? 'h-full max-h-full max-w-none rounded-none border-0' : ''
            )}>
                <SyntaxPreview
                    content={editableContent}
                    language={resolveEditorLanguage(file)}
                    filePath={file.path}
                    projectPath={projectPath}
                    gitDiffText={gitDiffText}
                    readOnly={false}
                    onChange={onEditableContentChange}
                    onEditorMount={onEditorMount}
                    wordWrap={editorWordWrap}
                    minimapEnabled={editorMinimapEnabled}
                    fontSize={editorFontSize}
                    findRequestToken={findRequestToken}
                    replaceRequestToken={replaceRequestToken}
                    focusLine={focusLine}
                    height={(fillEditorHeight || useFullBleed) ? '100%' : undefined}
                    lineMarkersOverride={lineMarkersOverride}
                />
            </div>
        )
    }

    if (isTextLike) {
        return (
            <div className="w-full h-full min-h-0">
                <TextPreviewContent
                    file={file}
                    content={content}
                    meta={meta}
                    projectPath={projectPath}
                    gitDiffText={gitDiffText}
                    csvDistinctColorsEnabled={csvDistinctColorsEnabled}
                    focusLine={previewFocusLine}
                    isExpanded={useFullBleed}
                />
            </div>
        )
    }

    if (file.type === 'image') {
        return (
            <div className="flex items-center justify-center p-4">
                <img
                    src={getFileUrl(file.path)}
                    alt={file.name}
                    className={cn(
                        'max-w-full object-contain',
                        useFullBleed ? 'h-full max-h-full w-full rounded-none shadow-none' : 'max-h-full rounded-lg shadow-2xl'
                    )}
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
                    className={cn(
                        'max-w-full',
                        useFullBleed ? 'h-full max-h-full w-full rounded-none shadow-none' : 'max-h-full rounded-lg shadow-2xl'
                    )}
                />
            </div>
        )
    }

    if (file.type === 'html' && htmlViewMode === 'code') {
        const previewSize = formatPreviewBytes(meta.previewBytes)
        const totalSize = formatPreviewBytes(meta.size)

        return (
            <div className={cn('w-full h-full min-h-0 flex flex-col gap-3', useFullBleed ? 'max-w-none gap-0' : 'max-w-[96%]')}>
                {meta.truncated && (
                    <div className="w-full px-3 py-2 text-xs text-amber-200 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                        Preview truncated for stability.
                        {previewSize ? ` Showing ${previewSize}` : ''}
                        {totalSize ? ` of ${totalSize}` : ''}.
                    </div>
                )}
                <div className={cn(
                    'w-full h-full min-h-0 bg-sparkle-card overflow-hidden',
                    useFullBleed ? 'rounded-none border-0' : 'rounded-xl border border-white/5'
                )}>
                    <SyntaxPreview
                        content={content}
                        language={file.language || 'html'}
                        filePath={file.path}
                        projectPath={projectPath}
                        gitDiffText={gitDiffText}
                        onEditorMount={onEditorMount}
                        height={useFullBleed ? '100%' : undefined}
                    />
                </div>
            </div>
        )
    }

    return (
        <div
            className={cn(
                'bg-white overflow-hidden transition-[width,height] duration-300 ease-out will-change-[width,height]',
                useFullBleed ? 'rounded-none shadow-none' : 'rounded-lg shadow-2xl'
            )}
            style={{
                width: viewport === 'responsive' ? '100%' : `${presetConfig.width}px`,
                height: useFullBleed ? '100%' : (viewport === 'responsive' ? '70vh' : `${presetConfig.height}px`),
                minHeight: useFullBleed ? '100%' : '400px',
                maxHeight: '100%',
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
