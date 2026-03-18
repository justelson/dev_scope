import { Code, Eye } from 'lucide-react'
import { cn } from '@/lib/utils'
import { VIEWPORT_PRESETS, type ViewportPreset } from './viewport'

export function PreviewHeaderHtmlControls({
    isCompactHtmlHeader,
    isVeryCompactHtmlHeader,
    isUltraCompactHtmlHeader,
    htmlViewMode,
    viewport,
    onViewportChange,
    onHtmlViewModeChange
}: {
    isCompactHtmlHeader: boolean
    isVeryCompactHtmlHeader: boolean
    isUltraCompactHtmlHeader: boolean
    htmlViewMode: 'rendered' | 'code'
    viewport: ViewportPreset
    onViewportChange: (viewport: ViewportPreset) => void
    onHtmlViewModeChange: (mode: 'rendered' | 'code') => void
}) {
    return (
        <div
            className={cn(
                'flex items-center gap-2',
                isCompactHtmlHeader ? 'order-3 w-full flex-wrap' : '',
                isVeryCompactHtmlHeader ? 'justify-start' : isCompactHtmlHeader ? 'justify-between' : ''
            )}
        >
            {htmlViewMode === 'rendered' && (
                <div className={cn('flex items-center gap-2 rounded-lg bg-white/5 p-1.5', isUltraCompactHtmlHeader ? 'w-full' : '')}>
                    <span className="px-1 text-[11px] text-white/60">Viewport</span>
                    <select
                        value={viewport}
                        onChange={(event) => {
                            const nextViewport = event.target.value
                            if (nextViewport in VIEWPORT_PRESETS) {
                                onViewportChange(nextViewport as ViewportPreset)
                                return
                            }
                            onViewportChange('responsive')
                        }}
                        className="h-7 rounded-md border border-white/15 bg-white/10 px-2 text-xs text-white outline-none transition-colors hover:bg-white/15 focus:border-white/30 focus:bg-white/15"
                        title="Choose preview viewport size"
                        aria-label="Choose preview viewport size"
                    >
                        {(Object.entries(VIEWPORT_PRESETS) as [ViewportPreset, (typeof VIEWPORT_PRESETS)[ViewportPreset]][]).map(([key, preset]) => (
                            <option key={key} value={key} className="bg-slate-900 text-white">
                                {key === 'responsive' ? 'Full Width' : `${preset.label} (${preset.width}x${preset.height})`}
                            </option>
                        ))}
                    </select>
                </div>
            )}
            <div className={cn('flex items-center gap-1 rounded-lg bg-white/5 p-1', isUltraCompactHtmlHeader ? 'w-full justify-center' : '')}>
                <button
                    onClick={() => onHtmlViewModeChange('rendered')}
                    className={cn(
                        'inline-flex h-8 w-8 items-center justify-center rounded-md text-xs transition-all',
                        htmlViewMode === 'rendered' ? 'bg-white/15 text-white' : 'text-white/40 hover:bg-white/5 hover:text-white/70'
                    )}
                    title="Rendered HTML preview"
                    aria-label="Rendered HTML preview"
                >
                    <Eye size={13} />
                    <span className="sr-only">Rendered</span>
                </button>
                <button
                    onClick={() => onHtmlViewModeChange('code')}
                    className={cn(
                        'inline-flex h-8 w-8 items-center justify-center rounded-md text-xs transition-all',
                        htmlViewMode === 'code' ? 'bg-white/15 text-white' : 'text-white/40 hover:bg-white/5 hover:text-white/70'
                    )}
                    title="HTML source preview"
                    aria-label="HTML source preview"
                >
                    <Code size={13} />
                    <span className="sr-only">Source</span>
                </button>
            </div>
        </div>
    )
}
