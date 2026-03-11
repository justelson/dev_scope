import { memo, useEffect, useRef, useState } from 'react'
import mermaid from 'mermaid'

mermaid.initialize({
    startOnLoad: false,
    theme: 'dark',
    themeVariables: {
        primaryColor: '#6366f1',
        primaryTextColor: '#e2e8f0',
        primaryBorderColor: '#4f46e5',
        lineColor: '#64748b',
        secondaryColor: '#8b5cf6',
        tertiaryColor: '#ec4899',
        background: '#1e293b',
        mainBkg: '#1e293b',
        secondBkg: '#334155',
        textColor: '#e2e8f0',
        fontSize: '14px'
    }
})

const mermaidSvgCache = new Map<string, string>()

function hashString(input: string): string {
    let hash = 0
    for (let i = 0; i < input.length; i++) {
        hash = ((hash << 5) - hash) + input.charCodeAt(i)
        hash |= 0
    }
    return Math.abs(hash).toString(36)
}

export const MermaidDiagram = memo(function MermaidDiagram({ chart }: { chart: string }) {
    const containerRef = useRef<HTMLDivElement | null>(null)
    const [svg, setSvg] = useState<string>(() => mermaidSvgCache.get(chart) || '')
    const [error, setError] = useState('')
    const [isNearViewport, setIsNearViewport] = useState<boolean>(() => Boolean(mermaidSvgCache.get(chart)))

    useEffect(() => {
        if (svg) {
            setIsNearViewport(true)
            return
        }

        const node = containerRef.current
        if (!node) return

        const observer = new IntersectionObserver((entries) => {
            const [entry] = entries
            if (!entry?.isIntersecting) return
            setIsNearViewport(true)
            observer.disconnect()
        }, {
            rootMargin: '480px 0px'
        })

        observer.observe(node)

        return () => {
            observer.disconnect()
        }
    }, [svg, chart])

    useEffect(() => {
        const cachedSvg = mermaidSvgCache.get(chart)
        if (cachedSvg) {
            setSvg((previous) => (previous === cachedSvg ? previous : cachedSvg))
            setError((previous) => (previous ? '' : previous))
            return
        }

        if (!isNearViewport) return

        let cancelled = false
        let timeoutId: ReturnType<typeof setTimeout> | null = null
        setSvg('')
        setError('')

        const renderDiagram = async () => {
            try {
                const id = `mermaid-${hashString(chart)}`
                const { svg: renderedSvg } = await mermaid.render(id, chart)
                if (cancelled) return

                mermaidSvgCache.set(chart, renderedSvg)
                setSvg(renderedSvg)
            } catch (renderError: any) {
                if (!cancelled) {
                    console.error('Mermaid render error:', renderError)
                    setError(renderError.message || 'Failed to render diagram')
                }
            }
        }

        if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
            const idleId = window.requestIdleCallback(() => {
                void renderDiagram()
            }, { timeout: 300 })

            return () => {
                cancelled = true
                window.cancelIdleCallback(idleId)
            }
        }

        timeoutId = window.setTimeout(() => {
            void renderDiagram()
        }, 16)

        return () => {
            cancelled = true
            if (timeoutId !== null) {
                window.clearTimeout(timeoutId)
            }
        }
    }, [chart, isNearViewport])

    if (error) {
        return (
            <div ref={containerRef} className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
                <strong>Mermaid Error:</strong> {error}
            </div>
        )
    }

    if (!svg) {
        return (
            <div
                ref={containerRef}
                className="flex min-h-[220px] items-center justify-center rounded-lg border border-white/10 bg-sparkle-card p-4 text-sm text-sparkle-text-secondary"
            >
                {isNearViewport ? 'Rendering diagram...' : 'Diagram will render when you scroll here'}
            </div>
        )
    }

    return (
        <div
            ref={containerRef}
            className="mermaid-diagram flex items-center justify-center overflow-x-auto rounded-lg border border-white/10 bg-sparkle-card p-4 [content-visibility:auto]"
            dangerouslySetInnerHTML={{ __html: svg }}
        />
    )
}, (previous, next) => previous.chart === next.chart)
