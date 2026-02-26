import { Check, Code, Copy, ExternalLink, FileJson, FileText, FileType, Film, Image as ImageIcon, Table, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import type { GitDiffSummary } from './gitDiff'
import type { PreviewFile } from './types'
import { VIEWPORT_PRESETS, type ViewportPreset } from './viewport'

interface PreviewModalHeaderProps {
    file: PreviewFile
    gitDiffSummary?: GitDiffSummary | null
    totalFileLines?: number
    viewport: ViewportPreset
    onViewportChange: (viewport: ViewportPreset) => void
    htmlViewMode: 'rendered' | 'code'
    onHtmlViewModeChange: (mode: 'rendered' | 'code') => void
    csvDistinctColorsEnabled: boolean
    onCsvDistinctColorsEnabledChange: (enabled: boolean) => void
    onOpenInBrowser: () => void
    onClose: () => void
}

function PreviewFileIcon({ type }: { type: PreviewFile['type'] }) {
    if (type === 'md') return <FileText size={18} className="text-blue-400 shrink-0" />
    if (type === 'html') return <Code size={18} className="text-orange-400 shrink-0" />
    if (type === 'json') return <FileJson size={18} className="text-yellow-300 shrink-0" />
    if (type === 'csv') return <Table size={18} className="text-emerald-300 shrink-0" />
    if (type === 'code') return <Code size={18} className="text-cyan-300 shrink-0" />
    if (type === 'image') return <ImageIcon size={18} className="text-purple-400 shrink-0" />
    if (type === 'video') return <Film size={18} className="text-red-400 shrink-0" />
    return <FileType size={18} className="text-gray-400 shrink-0" />
}

export default function PreviewModalHeader({
    file,
    gitDiffSummary,
    totalFileLines = 0,
    viewport,
    onViewportChange,
    htmlViewMode,
    onHtmlViewModeChange,
    csvDistinctColorsEnabled,
    onCsvDistinctColorsEnabledChange,
    onOpenInBrowser,
    onClose
}: PreviewModalHeaderProps) {
    const isHtml = file.type === 'html'
    const isCsv = file.type === 'csv'
    const presetConfig = VIEWPORT_PRESETS[viewport]
    const containerRef = useRef<HTMLDivElement | null>(null)
    const [headerWidth, setHeaderWidth] = useState(1280)
    const [copied, setCopied] = useState(false)

    const handleCopyPath = () => {
        navigator.clipboard.writeText(file.path)
        setCopied(true)
        setTimeout(() => setCopied(false), 1500)
    }

    useEffect(() => {
        const node = containerRef.current
        if (!node) return

        const updateWidth = () => {
            setHeaderWidth(node.clientWidth || 1280)
        }

        updateWidth()

        const observer = new ResizeObserver(() => {
            updateWidth()
        })
        observer.observe(node)

        return () => observer.disconnect()
    }, [])

    const isCompactHtmlHeader = isHtml && headerWidth < 1024
    const isVeryCompactHtmlHeader = isHtml && headerWidth < 820
    const isUltraCompactHtmlHeader = isHtml && headerWidth < 680

    const statusTone = !gitDiffSummary ? 'bg-white/10 text-white/60'
        : gitDiffSummary.status === 'added'
            ? 'bg-[#73C991]/20 text-[#73C991]'
            : gitDiffSummary.status === 'deleted'
                ? 'bg-[#FF6B6B]/20 text-[#FF6B6B]'
                : gitDiffSummary.status === 'renamed'
                    ? 'bg-blue-500/20 text-blue-300'
                    : gitDiffSummary.status === 'modified'
                        ? 'bg-[#E2C08D]/20 text-[#E2C08D]'
                        : 'bg-white/10 text-white/60'

    const statusLabel = !gitDiffSummary
        ? 'Unknown'
        : gitDiffSummary.status.charAt(0).toUpperCase() + gitDiffSummary.status.slice(1)

    return (
        <div
            ref={containerRef}
            className={cn(
                'flex items-center justify-between gap-3 border-b border-white/5 bg-white/[0.02] shrink-0',
                isCompactHtmlHeader ? 'flex-wrap px-3 py-2.5' : 'px-5 py-3',
                isUltraCompactHtmlHeader ? 'gap-2' : ''
            )}
        >
            <div className={cn('flex items-center gap-3 min-w-0', isCompactHtmlHeader ? 'flex-1' : '', isUltraCompactHtmlHeader ? 'w-full' : '')}>
                <PreviewFileIcon type={file.type} />
                <div className="min-w-0 flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-white truncate">{file.name}</h3>
                    <button
                        onClick={handleCopyPath}
                        className={cn(
                            "p-1 rounded transition-all shrink-0",
                            copied 
                                ? "text-emerald-400 bg-emerald-400/10" 
                                : "text-white/40 hover:text-white hover:bg-white/10"
                        )}
                        title={copied ? "Copied!" : `Copy path: ${file.path}`}
                    >
                        {copied ? <Check size={14} /> : <Copy size={14} />}
                    </button>
                </div>
            </div>

            {isHtml && (
                <div
                    className={cn(
                        'flex items-center gap-2',
                        isCompactHtmlHeader ? 'order-3 w-full flex-wrap' : '',
                        isVeryCompactHtmlHeader ? 'justify-start' : isCompactHtmlHeader ? 'justify-between' : ''
                    )}
                >
                    <div className={cn('flex items-center gap-1 bg-white/5 rounded-lg p-1 flex-wrap', isUltraCompactHtmlHeader ? 'w-full justify-between' : '')}>
                        {(Object.entries(VIEWPORT_PRESETS) as [ViewportPreset, typeof presetConfig][]).map(([key, preset]) => {
                            const Icon = preset.icon
                            return (
                                <button
                                    key={key}
                                    onClick={() => onViewportChange(key)}
                                    className={cn(
                                        'flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-md transition-all',
                                        viewport === key
                                            ? 'bg-white/15 text-white'
                                            : 'text-white/40 hover:text-white/70 hover:bg-white/5',
                                        isUltraCompactHtmlHeader ? 'px-2 min-w-[2rem] justify-center' : ''
                                    )}
                                    title={key === 'responsive' ? 'Full Width' : `${preset.width}x${preset.height}`}
                                >
                                    {Icon && <Icon size={14} />}
                                    <span className={cn(isVeryCompactHtmlHeader ? 'hidden lg:inline' : isCompactHtmlHeader ? 'hidden md:inline' : 'hidden sm:inline')}>
                                        {preset.label}
                                    </span>
                                </button>
                            )
                        })}
                    </div>
                    <div className={cn('flex items-center gap-1 bg-white/5 rounded-lg p-1', isUltraCompactHtmlHeader ? 'w-full justify-center' : '')}>
                        <button
                            onClick={() => onHtmlViewModeChange('rendered')}
                            className={cn(
                                'px-2.5 py-1.5 text-xs rounded-md transition-all',
                                htmlViewMode === 'rendered'
                                    ? 'bg-white/15 text-white'
                                    : 'text-white/40 hover:text-white/70 hover:bg-white/5'
                            )}
                        >
                            Preview
                        </button>
                        <button
                            onClick={() => onHtmlViewModeChange('code')}
                            className={cn(
                                'px-2.5 py-1.5 text-xs rounded-md transition-all',
                                htmlViewMode === 'code'
                                    ? 'bg-white/15 text-white'
                                    : 'text-white/40 hover:text-white/70 hover:bg-white/5'
                            )}
                        >
                            Code
                        </button>
                    </div>
                </div>
            )}

            <div className={cn('flex items-center gap-2 shrink-0', isCompactHtmlHeader ? 'ml-auto' : '', isUltraCompactHtmlHeader ? 'w-full justify-end' : '')}>
                {gitDiffSummary && (
                    <div className="flex items-center gap-1.5">
                        <span className={cn('text-[10px] uppercase font-semibold px-2 py-1 rounded', statusTone)}>
                            {statusLabel}
                        </span>
                        <span className="text-[10px] px-1.5 py-1 rounded bg-emerald-500/10 text-emerald-300">+{gitDiffSummary.additions}</span>
                        <span className="text-[10px] px-1.5 py-1 rounded bg-red-500/10 text-red-300">-{gitDiffSummary.deletions}</span>
                        <span className="text-[10px] px-1.5 py-1 rounded bg-white/5 text-white/50">{totalFileLines} lines</span>
                    </div>
                )}
                <span className="text-[10px] text-white/30 uppercase px-2 py-1 bg-white/5 rounded">
                    {file.type}
                    {isHtml && ` - ${htmlViewMode}`}
                    {isHtml && !isVeryCompactHtmlHeader && htmlViewMode === 'rendered' && viewport !== 'responsive' && ` - ${presetConfig.width}x${presetConfig.height}`}
                </span>
                {isHtml && (
                    <button
                        onClick={onOpenInBrowser}
                        className={cn(
                            'flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-white/60 hover:text-white hover:bg-white/10 rounded-lg transition-all',
                            isCompactHtmlHeader ? 'px-2' : ''
                        )}
                        title="Open in Browser"
                    >
                        <ExternalLink size={14} />
                        {!isCompactHtmlHeader && <span>Open</span>}
                    </button>
                )}
                {isCsv && (
                    <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-2 py-1.5">
                        <span className="text-xs text-white/60">Column Colors</span>
                        <button
                            type="button"
                            onClick={() => onCsvDistinctColorsEnabledChange(!csvDistinctColorsEnabled)}
                            className="group"
                            title={csvDistinctColorsEnabled ? 'Disable distinct column colors' : 'Enable distinct column colors'}
                            aria-pressed={csvDistinctColorsEnabled}
                        >
                            <span
                                className={cn(
                                    'inline-flex h-5 w-9 items-center rounded-full transition-colors',
                                    csvDistinctColorsEnabled ? 'bg-emerald-400/80' : 'bg-white/20'
                                )}
                            >
                                <span
                                    className={cn(
                                        'h-4 w-4 rounded-full bg-white shadow transition-transform',
                                        csvDistinctColorsEnabled ? 'translate-x-4' : 'translate-x-0.5'
                                    )}
                                />
                            </span>
                        </button>
                    </div>
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
    )
}
