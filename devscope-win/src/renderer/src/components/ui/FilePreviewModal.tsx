/**
 * FilePreviewModal - Reusable modal for previewing MD/HTML files
 * Can be used in any folder view across the app
 */

import { useEffect, useState } from 'react'
import { FileText, Code, X, RefreshCw, ExternalLink, Smartphone, Tablet, Monitor, Image as ImageIcon, Film, FileType } from 'lucide-react'
import MarkdownRenderer from './MarkdownRenderer'
import { cn } from '@/lib/utils'

// Device viewport presets
const VIEWPORT_PRESETS = {
    mobile: { width: 375, height: 667, label: 'Mobile', icon: Smartphone },
    tablet: { width: 768, height: 1024, label: 'Tablet', icon: Tablet },
    desktop: { width: 1280, height: 800, label: 'Desktop', icon: Monitor },
    responsive: { width: 0, height: 0, label: 'Full', icon: null } // 0 means 100%
} as const

type ViewportPreset = keyof typeof VIEWPORT_PRESETS

interface FilePreviewModalProps {
    file: { name: string; path: string; type: 'md' | 'html' | 'image' | 'video' | 'text' }
    content: string
    loading?: boolean
    onClose: () => void
}

export function FilePreviewModal({ file, content, loading, onClose }: FilePreviewModalProps) {
    const isMarkdown = file.type === 'md'
    const isHtml = file.type === 'html'
    const isImage = file.type === 'image'
    const isVideo = file.type === 'video'
    const isText = file.type === 'text'

    const [viewport, setViewport] = useState<ViewportPreset>('responsive')
    const presetConfig = VIEWPORT_PRESETS[viewport]

    // Convert file path to a safe devscope:// URL for webview/media.
    const getFileUrl = (filePath: string) => {
        if (filePath.startsWith('devscope://')) return filePath

        const normalized = filePath.replace(/\\/g, '/')
        const isUncPath = normalized.startsWith('//')
        const trimmed = isUncPath
            ? normalized.slice(2)
            : normalized.startsWith('/') ? normalized.slice(1) : normalized
        const encoded = encodeURI(trimmed).replace(/#/g, '%23').replace(/\?/g, '%3F')

        return isUncPath ? `devscope://${encoded}` : `devscope:///${encoded}`
    }

    // Handle Escape key to close
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                onClose()
            }
        }
        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [onClose])

    // Lock body scroll when modal is open
    useEffect(() => {
        const originalOverflow = document.body.style.overflow
        document.body.style.overflow = 'hidden'
        return () => {
            document.body.style.overflow = originalOverflow
        }
    }, [])

    // Open file in system default browser/app
    const handleOpenInBrowser = async () => {
        try {
            await window.devscope.openFile(file.path)
        } catch (err) {
            console.error('Failed to open in browser:', err)
        }
    }

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md"
            onClick={onClose}
            style={{ animation: 'fadeIn 0.15s ease-out' }}
            onWheel={e => e.stopPropagation()}
        >
            <div
                className="bg-sparkle-card border border-white/10 rounded-2xl shadow-2xl w-full max-w-[95vw] max-h-[90vh] flex flex-col m-4 overflow-hidden"
                onClick={e => e.stopPropagation()}
                style={{
                    animation: 'scaleIn 0.15s ease-out',
                    width: viewport === 'responsive' ? '95vw' : `min(${presetConfig.width + 48}px, 95vw)`,
                    maxWidth: viewport === 'responsive' ? '1400px' : `${presetConfig.width + 48}px`
                }}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-3 border-b border-white/5 bg-white/[0.02] shrink-0">
                    <div className="flex items-center gap-3 min-w-0">
                        {isMarkdown ? (
                            <FileText size={18} className="text-blue-400 shrink-0" />
                        ) : isHtml ? (
                            <Code size={18} className="text-orange-400 shrink-0" />
                        ) : isImage ? (
                            <ImageIcon size={18} className="text-purple-400 shrink-0" />
                        ) : isVideo ? (
                            <Film size={18} className="text-red-400 shrink-0" />
                        ) : (
                            <FileType size={18} className="text-gray-400 shrink-0" />
                        )}
                        <div className="min-w-0">
                            <h3 className="text-sm font-semibold text-white truncate">{file.name}</h3>
                        </div>
                    </div>

                    {/* Viewport Presets - only for HTML files */}
                    {isHtml && (
                        <div className="flex items-center gap-1 bg-white/5 rounded-lg p-1">
                            {(Object.entries(VIEWPORT_PRESETS) as [ViewportPreset, typeof presetConfig][]).map(([key, preset]) => {
                                const Icon = preset.icon
                                return (
                                    <button
                                        key={key}
                                        onClick={() => setViewport(key)}
                                        className={cn(
                                            "flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-md transition-all",
                                            viewport === key
                                                ? "bg-white/15 text-white"
                                                : "text-white/40 hover:text-white/70 hover:bg-white/5"
                                        )}
                                        title={key === 'responsive' ? 'Full Width' : `${preset.width}x${preset.height}`}
                                    >
                                        {Icon && <Icon size={14} />}
                                        <span className="hidden sm:inline">{preset.label}</span>
                                    </button>
                                )
                            })}
                        </div>
                    )}

                    <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[10px] text-white/30 uppercase px-2 py-1 bg-white/5 rounded">
                            {file.type}
                            {isHtml && viewport !== 'responsive' && ` · ${presetConfig.width}×${presetConfig.height}`}
                        </span>
                        {/* Open in Browser button for HTML files */}
                        {isHtml && (
                            <button
                                onClick={handleOpenInBrowser}
                                className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-white/60 hover:text-white hover:bg-white/10 rounded-lg transition-all"
                                title="Open in Browser"
                            >
                                <ExternalLink size={14} />
                            </button>
                        )}
                        <button
                            onClick={onClose}
                            className="p-2 text-white/40 hover:text-white hover:bg-white/10 rounded-lg transition-all"
                            title="Close (Esc)"
                        >
                            <X size={18} />
                        </button>
                    </div>
                </div>

                {/* Content - with overscroll containment */}
                <div
                    className="flex-1 overflow-auto custom-scrollbar flex items-start justify-center bg-[#1a1a2e] p-4"
                    style={{ overscrollBehavior: 'contain' }}
                >
                    {loading ? (
                        <div className="flex items-center justify-center py-24 w-full">
                            <RefreshCw size={32} className="animate-spin text-white/20" />
                        </div>
                    ) : isMarkdown ? (
                        <div className="w-full max-w-4xl bg-sparkle-card rounded-xl p-6 border border-white/5">
                            <MarkdownRenderer content={content} filePath={file.path} />
                        </div>
                    ) : isText ? (
                        <div className="w-full max-w-4xl bg-sparkle-card rounded-xl p-6 border border-white/5 font-mono text-sm text-white/80 whitespace-pre-wrap">
                            {content}
                        </div>
                    ) : isImage ? (
                        <div className="flex items-center justify-center p-4">
                            <img
                                src={getFileUrl(file.path)}
                                alt={file.name}
                                className="max-w-full max-h-[80vh] rounded-lg shadow-2xl object-contain"
                            />
                        </div>
                    ) : isVideo ? (
                        <div className="flex items-center justify-center p-4 w-full">
                            <video
                                src={getFileUrl(file.path)}
                                controls
                                className="max-w-full max-h-[80vh] rounded-lg shadow-2xl"
                            />
                        </div>
                    ) : (
                        <div
                            className="bg-white rounded-lg shadow-2xl overflow-hidden transition-all duration-300"
                            style={{
                                width: viewport === 'responsive' ? '100%' : `${presetConfig.width}px`,
                                height: viewport === 'responsive' ? '70vh' : `${presetConfig.height}px`,
                                minHeight: '400px',
                                maxHeight: '80vh'
                            }}
                        >
                            {/* @ts-ignore - webview is an Electron-specific tag */}
                            <webview
                                src={getFileUrl(file.path)}
                                style={{ width: '100%', height: '100%', background: 'white' }}
                            />
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}

// Hook for file preview state management

interface UseFilePreviewReturn {
    previewFile: { name: string; path: string; type: 'md' | 'html' | 'image' | 'video' | 'text' } | null
    previewContent: string
    loadingPreview: boolean
    openPreview: (file: { name: string; path: string }, ext: string) => Promise<void>
    closePreview: () => void
    openFile: (filePath: string) => Promise<void>
}

export function useFilePreview(): UseFilePreviewReturn {
    const [previewFile, setPreviewFile] = useState<{ name: string; path: string; type: 'md' | 'html' | 'image' | 'video' | 'text' } | null>(null)
    const [previewContent, setPreviewContent] = useState<string>('')
    const [loadingPreview, setLoadingPreview] = useState(false)

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
        const extLower = ext.toLowerCase()

        // HTML files also preview in modal using webview  
        if (['html', 'htm'].includes(extLower)) {
            setLoadingPreview(true)
            setPreviewFile({ name: file.name, path: file.path, type: 'html' })
            // No need to read content for webview - it loads directly from file URL
            setPreviewContent('')
            setLoadingPreview(false)
            return
        }

        // Markdown files preview in modal
        if (extLower === 'md') {
            setLoadingPreview(true)
            setPreviewFile({ name: file.name, path: file.path, type: 'md' })
            fetchContent()
            return
        }

        // Image files
        if (['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'ico', 'bmp'].includes(extLower)) {
            setLoadingPreview(true)
            setPreviewFile({ name: file.name, path: file.path, type: 'image' })
            setPreviewContent('') // No text content needed
            setLoadingPreview(false)
            return
        }

        // Video files
        if (['mp4', 'webm', 'ogg', 'mov', 'avi'].includes(extLower)) {
            setLoadingPreview(true)
            setPreviewFile({ name: file.name, path: file.path, type: 'video' })
            setPreviewContent('') // No text content needed
            setLoadingPreview(false)
            return
        }

        // Text/Code files
        if (['txt', 'json', 'js', 'jsx', 'ts', 'tsx', 'css', 'scss', 'less', 'xml', 'yaml', 'yml', 'ini', 'env', 'log', 'conf', 'sh', 'bat', 'ps1', 'c', 'cpp', 'h', 'java', 'py', 'rb', 'php', 'sql'].includes(extLower)) {
            setLoadingPreview(true)
            setPreviewFile({ name: file.name, path: file.path, type: 'text' })
            fetchContent()
            return
        }

        async function fetchContent() {
            try {
                const res = await window.devscope.readFileContent(file.path)
                if (res.success) {
                    setPreviewContent(res.content)
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

        // Other files open with system default
        await openFile(file.path)
    }

    const closePreview = () => {
        setPreviewFile(null)
        setPreviewContent('')
    }

    return {
        previewFile,
        previewContent,
        loadingPreview,
        openPreview,
        closePreview,
        openFile
    }
}

export default FilePreviewModal
