import { memo, useEffect, useState } from 'react'
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
    const [svg, setSvg] = useState<string>(() => mermaidSvgCache.get(chart) || '')
    const [error, setError] = useState('')

    useEffect(() => {
        const cachedSvg = mermaidSvgCache.get(chart)
        if (cachedSvg) {
            setSvg((previous) => (previous === cachedSvg ? previous : cachedSvg))
            setError((previous) => (previous ? '' : previous))
            return
        }

        let cancelled = false
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

        renderDiagram()

        return () => {
            cancelled = true
        }
    }, [chart])

    if (error) {
        return (
            <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
                <strong>Mermaid Error:</strong> {error}
            </div>
        )
    }

    if (!svg) {
        return (
            <div className="p-4 bg-sparkle-card rounded-lg text-sparkle-text-secondary text-sm">
                Rendering diagram...
            </div>
        )
    }

    return (
        <div
            className="mermaid-diagram flex justify-center items-center p-4 bg-sparkle-card rounded-lg overflow-x-auto"
            dangerouslySetInnerHTML={{ __html: svg }}
        />
    )
}, (previous, next) => previous.chart === next.chart)
