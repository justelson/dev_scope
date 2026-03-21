import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Film, Image as ImageIcon, Music4 } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { PreviewFile, PreviewMediaItem } from './types'
import { getFileUrl } from './utils'
import ImagePreviewContent from './ImagePreviewContent'

interface MediaPreviewContentProps {
    file: PreviewFile
    mediaItems?: PreviewMediaItem[]
    onSelectMedia?: (item: PreviewMediaItem) => Promise<void> | void
    isExpanded?: boolean
}

function renderMediaIcon(type: PreviewMediaItem['type']) {
    if (type === 'image') return <ImageIcon size={20} className="text-purple-200" />
    if (type === 'video') return <Film size={20} className="text-rose-200" />
    return <Music4 size={20} className="text-sky-200" />
}

function MediaPeekCard({ item }: { item: PreviewMediaItem }) {
    const [previewFailed, setPreviewFailed] = useState(false)

    return (
        <div className="pointer-events-none w-36 overflow-hidden rounded-2xl border border-white/10 bg-black/75 shadow-2xl backdrop-blur-md">
            <div className="h-24 w-full overflow-hidden bg-white/[0.04]">
                {!previewFailed && item.type === 'image' ? (
                    <img
                        src={getFileUrl(item.thumbnailPath || item.path)}
                        alt={item.name}
                        className="h-full w-full object-cover"
                        loading="lazy"
                        onError={() => setPreviewFailed(true)}
                    />
                ) : !previewFailed && item.type === 'video' ? (
                    <video
                        src={getFileUrl(item.path)}
                        muted
                        preload="metadata"
                        playsInline
                        className="h-full w-full object-cover"
                        onError={() => setPreviewFailed(true)}
                    />
                ) : (
                    <div className="flex h-full w-full items-center justify-center bg-black/20">
                        {renderMediaIcon(item.type)}
                    </div>
                )}
            </div>
            <div className="px-3 py-2">
                <div className="truncate text-[11px] font-medium text-white">{item.name}</div>
                <div className="mt-0.5 text-[10px] uppercase tracking-[0.12em] text-white/45">{item.type}</div>
            </div>
        </div>
    )
}

function MediaNavZone({
    side,
    item,
    isActive,
    onHoverChange,
    onSelect
}: {
    side: 'left' | 'right'
    item: PreviewMediaItem | null
    isActive: boolean
    onHoverChange: (side: 'left' | 'right' | null) => void
    onSelect?: (item: PreviewMediaItem) => Promise<void> | void
}) {
    if (!item) return null

    const previewPositionClassName = side === 'left' ? 'left-14' : 'right-14'
    const zonePositionClassName = side === 'left' ? 'left-0 items-start pl-3' : 'right-0 items-end pr-3'

    return (
        <div
            className={cn('absolute inset-y-0 z-20 flex w-28 items-center', zonePositionClassName)}
            onMouseEnter={() => onHoverChange(side)}
            onMouseLeave={() => onHoverChange(null)}
        >
            <button
                type="button"
                onClick={() => { void onSelect?.(item) }}
                className={cn(
                    'pointer-events-auto relative flex h-14 w-14 items-center justify-center rounded-full border border-white/10 bg-black/55 text-white/80 shadow-xl backdrop-blur-md transition-all duration-200 hover:border-white/20 hover:bg-black/70 hover:text-white',
                    isActive ? 'opacity-100' : 'opacity-0'
                )}
                title={`${side === 'left' ? 'Previous' : 'Next'} media`}
            >
                {side === 'left' ? <ChevronLeft size={20} /> : <ChevronRight size={20} />}
                <div className={cn('absolute top-1/2 -translate-y-1/2', isActive ? 'block' : 'hidden', previewPositionClassName)}>
                    <MediaPeekCard item={item} />
                </div>
            </button>
        </div>
    )
}

function renderMediaStage(targetFile: PreviewFile, activeMediaItem: PreviewMediaItem | undefined, isExpanded: boolean) {
    if (targetFile.type === 'image') {
        return (
            <ImagePreviewContent
                filePath={targetFile.path}
                fileName={targetFile.name}
                isExpanded={isExpanded}
            />
        )
    }

    if (targetFile.type === 'video') {
        return (
            <div className="flex h-full w-full items-center justify-center p-4">
                <video
                    src={getFileUrl(targetFile.path)}
                    controls
                    playsInline
                    className={cn(
                        'max-w-full bg-black/20 object-contain',
                        isExpanded ? 'h-full max-h-full w-full rounded-none shadow-none' : 'max-h-full rounded-xl shadow-2xl'
                    )}
                />
            </div>
        )
    }

    return (
        <div className="flex h-full w-full items-center justify-center p-6">
            <div className="w-full max-w-2xl rounded-3xl border border-white/10 bg-black/35 p-6 shadow-2xl backdrop-blur-md">
                <div className="flex items-center gap-3">
                    {activeMediaItem?.thumbnailPath ? (
                        <img
                            src={getFileUrl(activeMediaItem.thumbnailPath)}
                            alt={`${targetFile.name} cover`}
                            className="h-14 w-14 rounded-2xl border border-white/10 object-cover"
                        />
                    ) : (
                        <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04]">
                            <Music4 size={24} className="text-sky-200" />
                        </div>
                    )}
                    <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-white">{targetFile.name}</div>
                        <div className="text-xs uppercase tracking-[0.16em] text-white/45">Audio Preview</div>
                    </div>
                </div>
                <audio
                    src={getFileUrl(targetFile.path)}
                    controls
                    preload="metadata"
                    className="mt-5 w-full"
                />
            </div>
        </div>
    )
}

export default function MediaPreviewContent({
    file,
    mediaItems = [],
    onSelectMedia,
    isExpanded = false
}: MediaPreviewContentProps) {
    const [hoveredEdge, setHoveredEdge] = useState<'left' | 'right' | null>(null)
    const [transitionState, setTransitionState] = useState<{
        from: PreviewFile
        to: PreviewFile
        direction: 'left' | 'right'
        stage: 'preparing' | 'running'
    } | null>(null)
    const previousFileRef = useRef(file)
    const currentIndex = useMemo(
        () => mediaItems.findIndex((item) => item.path.toLowerCase() === file.path.toLowerCase()),
        [file.path, mediaItems]
    )
    const previousItem = currentIndex > 0 ? mediaItems[currentIndex - 1] : null
    const nextItem = currentIndex >= 0 && currentIndex < mediaItems.length - 1 ? mediaItems[currentIndex + 1] : null
    const mediaItemByPath = useMemo(
        () => new Map(mediaItems.map((item) => [item.path.toLowerCase(), item])),
        [mediaItems]
    )
    const activeMediaItem = mediaItemByPath.get(file.path.toLowerCase())

    useEffect(() => {
        if (!previousItem && !nextItem) return

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.defaultPrevented) return
            if (event.key === 'ArrowLeft' && previousItem) {
                event.preventDefault()
                void onSelectMedia?.(previousItem)
            }
            if (event.key === 'ArrowRight' && nextItem) {
                event.preventDefault()
                void onSelectMedia?.(nextItem)
            }
        }

        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [nextItem, onSelectMedia, previousItem])

    useEffect(() => {
        const previousFile = previousFileRef.current
        if (previousFile.path === file.path) return

        setHoveredEdge(null)
        const previousIndex = mediaItems.findIndex((item) => item.path.toLowerCase() === previousFile.path.toLowerCase())
        const nextIndexValue = mediaItems.findIndex((item) => item.path.toLowerCase() === file.path.toLowerCase())
        const direction: 'left' | 'right' = (
            previousIndex >= 0 && nextIndexValue >= 0 && nextIndexValue > previousIndex
        ) ? 'right' : 'left'

        setTransitionState({
            from: previousFile,
            to: file,
            direction,
            stage: 'preparing'
        })
        previousFileRef.current = file

        const frameId = window.requestAnimationFrame(() => {
            setTransitionState((current) => current ? { ...current, stage: 'running' } : current)
        })
        const timeoutId = window.setTimeout(() => {
            setTransitionState((current) => current?.to.path === file.path ? null : current)
        }, 280)

        return () => {
            window.cancelAnimationFrame(frameId)
            window.clearTimeout(timeoutId)
        }
    }, [file, mediaItems])

    return (
        <div className="relative h-full w-full min-h-0 overflow-hidden">
            {transitionState ? (
                <div className="relative h-full w-full overflow-hidden">
                    <div
                        className={cn(
                            'absolute inset-0 transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]',
                            transitionState.stage === 'running'
                                ? (transitionState.direction === 'right' ? '-translate-x-full' : 'translate-x-full')
                                : 'translate-x-0'
                        )}
                    >
                        {renderMediaStage(
                            transitionState.from,
                            mediaItemByPath.get(transitionState.from.path.toLowerCase()),
                            isExpanded
                        )}
                    </div>
                    <div
                        className={cn(
                            'absolute inset-0 transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]',
                            transitionState.stage === 'running'
                                ? 'translate-x-0'
                                : (transitionState.direction === 'right' ? 'translate-x-full' : '-translate-x-full')
                        )}
                    >
                        {renderMediaStage(transitionState.to, activeMediaItem, isExpanded)}
                    </div>
                </div>
            ) : (
                renderMediaStage(file, activeMediaItem, isExpanded)
            )}

            <MediaNavZone side="left" item={previousItem} isActive={hoveredEdge === 'left'} onHoverChange={setHoveredEdge} onSelect={onSelectMedia} />
            <MediaNavZone side="right" item={nextItem} isActive={hoveredEdge === 'right'} onHoverChange={setHoveredEdge} onSelect={onSelectMedia} />
        </div>
    )
}
