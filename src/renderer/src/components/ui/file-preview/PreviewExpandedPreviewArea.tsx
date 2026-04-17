import type { ReactNode, RefObject } from 'react'
import { cn } from '@/lib/utils'

type PreviewExpandedPreviewAreaProps = {
    previewSurfaceRef: RefObject<HTMLDivElement | null>
    centerHtmlRenderedPreview: boolean
    isCompactHtmlViewport: boolean
    overflowLocked: boolean
    surfaceBackgroundClass: string
    shouldStretchPreviewBody: boolean
    hasBottomPanel: boolean
    mode: 'preview' | 'edit'
    previewContent: ReactNode
}

export function PreviewExpandedPreviewArea({
    previewSurfaceRef,
    centerHtmlRenderedPreview,
    isCompactHtmlViewport,
    overflowLocked,
    surfaceBackgroundClass,
    shouldStretchPreviewBody,
    hasBottomPanel,
    mode,
    previewContent
}: PreviewExpandedPreviewAreaProps) {
    return (
        <div
            ref={previewSurfaceRef}
            className={cn(
                'h-full w-full custom-scrollbar flex',
                surfaceBackgroundClass,
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
        </div>
    )
}
