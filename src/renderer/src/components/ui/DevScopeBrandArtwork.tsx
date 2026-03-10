import blueprintUrl from '@/assets/branding/devscope-air-blueprint.png'
import markUrl from '@/assets/branding/devscope-air-mark.png'
import { cn } from '@/lib/utils'

type DevScopeBrandArtworkProps = {
    className?: string
    alt?: string
    mode?: 'auto' | 'blueprint' | 'mark'
}

export function getDevScopeBrandArtworkUrl(mode: DevScopeBrandArtworkProps['mode'] = 'auto'): string {
    if (mode === 'blueprint') return blueprintUrl
    if (mode === 'mark') return markUrl
    return import.meta.env.DEV ? blueprintUrl : markUrl
}

export function DevScopeBrandArtwork({
    className,
    alt = 'DevScope Air artwork',
    mode = 'auto'
}: DevScopeBrandArtworkProps) {
    return (
        <img
            src={getDevScopeBrandArtworkUrl(mode)}
            alt={alt}
            className={cn('block select-none object-contain', className)}
            draggable={false}
        />
    )
}
