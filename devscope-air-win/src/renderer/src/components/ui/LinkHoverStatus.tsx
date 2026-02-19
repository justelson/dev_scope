import { useEffect, useState } from 'react'

function formatLinkTarget(anchor: HTMLAnchorElement): string | null {
    const rawHref = anchor.getAttribute('href')?.trim()
    if (!rawHref) return null
    if (rawHref.toLowerCase().startsWith('javascript:')) return null

    try {
        const resolved = new URL(rawHref, window.location.href)
        if (resolved.origin === window.location.origin) {
            if (rawHref.startsWith('#')) {
                return rawHref
            }
            return `${resolved.pathname}${resolved.search}${resolved.hash}`
        }
        return resolved.href
    } catch {
        return rawHref
    }
}

export default function LinkHoverStatus() {
    const [target, setTarget] = useState<string | null>(null)

    useEffect(() => {
        const getAnchor = (node: EventTarget | null): HTMLAnchorElement | null => {
            if (!(node instanceof Element)) return null
            return node.closest('a[href]') as HTMLAnchorElement | null
        }

        const showForAnchor = (anchor: HTMLAnchorElement | null) => {
            if (!anchor) {
                setTarget(null)
                return
            }
            setTarget(formatLinkTarget(anchor))
        }

        const handleMouseOver = (event: MouseEvent) => {
            showForAnchor(getAnchor(event.target))
        }

        const handleMouseOut = (event: MouseEvent) => {
            const fromAnchor = getAnchor(event.target)
            if (!fromAnchor) return

            const toAnchor = getAnchor(event.relatedTarget)
            if (toAnchor === fromAnchor) return

            if (toAnchor) {
                showForAnchor(toAnchor)
                return
            }
            setTarget(null)
        }

        const handleFocusIn = (event: FocusEvent) => {
            showForAnchor(getAnchor(event.target))
        }

        const handleFocusOut = (event: FocusEvent) => {
            const nextAnchor = getAnchor(event.relatedTarget)
            if (nextAnchor) {
                showForAnchor(nextAnchor)
                return
            }
            setTarget(null)
        }

        const clearTarget = () => setTarget(null)

        document.addEventListener('mouseover', handleMouseOver, true)
        document.addEventListener('mouseout', handleMouseOut, true)
        document.addEventListener('focusin', handleFocusIn, true)
        document.addEventListener('focusout', handleFocusOut, true)
        window.addEventListener('blur', clearTarget)

        return () => {
            document.removeEventListener('mouseover', handleMouseOver, true)
            document.removeEventListener('mouseout', handleMouseOut, true)
            document.removeEventListener('focusin', handleFocusIn, true)
            document.removeEventListener('focusout', handleFocusOut, true)
            window.removeEventListener('blur', clearTarget)
        }
    }, [])

    if (!target) return null

    return (
        <div
            className="fixed left-3 bottom-2 z-[9999] max-w-[65vw] truncate rounded-md border border-white/10 bg-sparkle-card/95 px-2 py-1 text-[11px] text-sparkle-text-secondary shadow-lg backdrop-blur-sm pointer-events-none"
            title={target}
        >
            {target}
        </div>
    )
}
