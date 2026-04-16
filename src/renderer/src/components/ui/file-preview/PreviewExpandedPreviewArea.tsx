import type { ReactNode, RefObject } from 'react'
import { cn } from '@/lib/utils'
import { PreviewFloatingInfo, type PreviewFloatingInfoChip } from './PreviewFloatingInfo'

type PreviewExpandedPreviewAreaProps = {
    previewSurfaceRef: RefObject<HTMLDivElement | null>
    centerHtmlRenderedPreview: boolean
    isCompactHtmlViewport: boolean
    overflowLocked: boolean
    shouldStretchPreviewBody: boolean
    hasBottomPanel: boolean
    mode: 'preview' | 'edit'
    previewContent: ReactNode
    floatingInfoChips: PreviewFloatingInfoChip[]
}

export function PreviewExpandedPreviewArea({
    previewSurfaceRef,
    centerHtmlRenderedPreview,
    isCompactHtmlViewport,
    overflowLocked,
    shouldStretchPreviewBody,
    hasBottomPanel,
    mode,
    previewContent,
    floatingInfoChips
}: PreviewExpandedPreviewAreaProps) {
    return (
        <div
            ref={previewSurfaceRef}
            className={cn(
                'h-full w-full custom-scrollbar flex',
                centerHtmlRenderedPreview ? 'items-center justify-center' : 'items-stretch justify-start',
                isCompactHtmlViewport ? 'p-2 sm:p-3' : 'p-0',
                overflowLocked ? 'overflow-hidden' : 'overflow-auto'
            )}
            style={{ overscrollBehavior: 'contain' }}
        >
            <div className={cn('w-full flex flex-col', shouldStretchPreviewBody ? 'h-full min-h-0' : 'min-h-full')}>
                <div
                    className={cn(
                        shouldStretchPreviewBody && 'min-h-0',
                        hasBottomPanel ? 'flex-1' : (shouldStretchPreviewBody ? 'h-full' : ''),
                        hasBottomPanel && mode !== 'edit' ? 'overflow-auto custom-scrollbar' : '',
                        centerHtmlRenderedPreview ? 'flex items-center justify-center' : ''
                    )}
                >
                    {previewContent}
                </div>
            </div>
            <PreviewFloatingInfo chips={floatingInfoChips} />
        </div>
    )
}
