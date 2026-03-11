import { useEffect, useMemo, useRef, useState } from 'react'
import { Focus, Minus, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getFileUrl } from './utils'

const MIN_SCALE = 0.1
const MAX_SCALE = 8

interface ImagePreviewContentProps {
    filePath: string
    fileName: string
    isExpanded?: boolean
}

export default function ImagePreviewContent({
    filePath,
    fileName,
    isExpanded = false
}: ImagePreviewContentProps) {
    const viewportRef = useRef<HTMLDivElement | null>(null)
    const hideControlsTimerRef = useRef<number | null>(null)
    const [naturalSize, setNaturalSize] = useState({ width: 0, height: 0 })
    const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 })
    const [scale, setScale] = useState(1)
    const [fitMode, setFitMode] = useState(true)
    const [controlsVisible, setControlsVisible] = useState(false)

    const fitScale = useMemo(() => {
        if (!naturalSize.width || !naturalSize.height || !viewportSize.width || !viewportSize.height) {
            return 1
        }

        return Math.min(
            viewportSize.width / naturalSize.width,
            viewportSize.height / naturalSize.height,
            1
        )
    }, [naturalSize.height, naturalSize.width, viewportSize.height, viewportSize.width])

    useEffect(() => {
        const node = viewportRef.current
        if (!node || typeof ResizeObserver === 'undefined') return

        const observer = new ResizeObserver((entries) => {
            const entry = entries[0]
            if (!entry) return
            setViewportSize({
                width: entry.contentRect.width,
                height: entry.contentRect.height
            })
        })

        observer.observe(node)
        return () => observer.disconnect()
    }, [])

    useEffect(() => {
        if (fitMode) {
            setScale(fitScale)
        }
    }, [fitMode, fitScale])

    useEffect(() => () => {
        if (hideControlsTimerRef.current !== null) {
            window.clearTimeout(hideControlsTimerRef.current)
        }
    }, [])

    const revealControls = () => {
        setControlsVisible(true)
        if (hideControlsTimerRef.current !== null) {
            window.clearTimeout(hideControlsTimerRef.current)
        }
        hideControlsTimerRef.current = window.setTimeout(() => {
            setControlsVisible(false)
        }, 1200)
    }

    const currentScale = fitMode ? fitScale : scale
    const zoomPercent = Math.max(10, Math.round(currentScale * 100))
    const scaledWidth = naturalSize.width > 0 ? naturalSize.width * currentScale : undefined
    const scaledHeight = naturalSize.height > 0 ? naturalSize.height * currentScale : undefined

    const applyScale = (nextScale: number) => {
        setFitMode(false)
        setScale(Math.min(MAX_SCALE, Math.max(MIN_SCALE, nextScale)))
        revealControls()
    }

    return (
        <div
            ref={viewportRef}
            className="relative h-full w-full overflow-auto bg-black/20"
            onMouseMove={revealControls}
            onMouseEnter={revealControls}
            onPointerDown={revealControls}
            onMouseLeave={() => setControlsVisible(false)}
        >
            <div className="flex min-h-full min-w-full items-center justify-center p-4">
                <img
                    src={getFileUrl(filePath)}
                    alt={fileName}
                    onLoad={(event) => {
                        const target = event.currentTarget
                        setNaturalSize({
                            width: target.naturalWidth || 0,
                            height: target.naturalHeight || 0
                        })
                    }}
                    className={cn(
                        'select-none object-contain transition-[width,height] duration-200 ease-out',
                        isExpanded ? 'rounded-none shadow-none' : 'rounded-lg shadow-2xl'
                    )}
                    style={{
                        width: scaledWidth ? `${scaledWidth}px` : undefined,
                        height: scaledHeight ? `${scaledHeight}px` : undefined,
                        maxWidth: 'none',
                        maxHeight: 'none'
                    }}
                    draggable={false}
                />
            </div>

            <div
                className={cn(
                    'pointer-events-none absolute bottom-4 right-4 z-10 transition-all duration-200',
                    controlsVisible ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0'
                )}
            >
                <div className="pointer-events-auto inline-flex items-center gap-1 rounded-full border border-white/10 bg-black/65 p-1.5 text-white/85 shadow-lg backdrop-blur-md">
                    <button
                        type="button"
                        onClick={() => applyScale(currentScale / 1.15)}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-full transition-colors hover:bg-white/[0.08] hover:text-white"
                        title="Zoom out"
                    >
                        <Minus size={14} />
                    </button>
                    <button
                        type="button"
                        onClick={() => {
                            setFitMode(true)
                            revealControls()
                        }}
                        className={cn(
                            'inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-medium transition-colors',
                            fitMode ? 'bg-white/[0.08] text-white' : 'hover:bg-white/[0.08] hover:text-white'
                        )}
                        title="Fit image to view"
                    >
                        <Focus size={13} />
                        Fit
                    </button>
                    <button
                        type="button"
                        onClick={() => applyScale(1)}
                        className={cn(
                            'rounded-full px-3 py-1.5 text-xs font-medium transition-colors',
                            !fitMode && Math.abs(currentScale - 1) < 0.01
                                ? 'bg-white/[0.08] text-white'
                                : 'hover:bg-white/[0.08] hover:text-white'
                        )}
                        title="Actual size"
                    >
                        1:1
                    </button>
                    <button
                        type="button"
                        onClick={() => applyScale(currentScale * 1.15)}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-full transition-colors hover:bg-white/[0.08] hover:text-white"
                        title="Zoom in"
                    >
                        <Plus size={14} />
                    </button>
                    <div className="min-w-[54px] pr-2 text-right text-[11px] font-semibold tracking-[0.08em] text-white/70">
                        {zoomPercent}%
                    </div>
                </div>
            </div>
        </div>
    )
}
