import { Suspense, lazy } from 'react'
import { resolveMonacoLanguage } from './monacoLanguage'

const MonacoEditorComponent = lazy(() => import('./MonacoPreviewEditor'))

interface SyntaxPreviewProps {
    content: unknown
    language: string
    filePath?: string
    projectPath?: string
    gitDiffText?: string
}

function normalizeSyntaxContent(content: unknown): string {
    if (typeof content === 'string') return content
    if (content == null) return ''
    if (typeof content === 'number' || typeof content === 'boolean' || typeof content === 'bigint') {
        return String(content)
    }
    try {
        return JSON.stringify(content, null, 2)
    } catch {
        return String(content)
    }
}

export default function SyntaxPreview({ content, language, filePath, projectPath, gitDiffText }: SyntaxPreviewProps) {
    const safeContent = normalizeSyntaxContent(content)
    const monacoLanguage = resolveMonacoLanguage(language)
    const isLargeFile = safeContent.length > 300_000
    const modelPath = filePath ? `file://${encodeURI(filePath.replace(/\\/g, '/'))}` : undefined

    return (
        <div className="w-full" style={{ height: 'min(72vh, 900px)', background: 'var(--color-card)' }}>
            <Suspense
                fallback={
                    <div className="h-full w-full grid place-items-center text-sm text-white/60 bg-sparkle-card">
                        Loading editor preview...
                    </div>
                }
            >
                <MonacoEditorComponent
                    value={safeContent}
                    language={monacoLanguage}
                    modelPath={modelPath}
                    isLargeFile={isLargeFile}
                    filePath={filePath}
                    projectPath={projectPath}
                    gitDiffText={gitDiffText}
                />
            </Suspense>
        </div>
    )
}
