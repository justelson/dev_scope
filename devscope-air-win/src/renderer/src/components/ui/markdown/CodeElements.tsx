import { useRef, useState, type ReactNode } from 'react'
import { Check, ChevronUp, Copy } from 'lucide-react'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { hasColorToken, renderColorAwareText } from './colorTokens'
import { MermaidDiagram } from './MermaidDiagram'

const flatCodeTheme = Object.fromEntries(
    Object.entries(oneDark).map(([selector, style]) => [
        selector,
        {
            ...(style as Record<string, unknown>),
            background: 'transparent',
            backgroundColor: 'transparent',
            textShadow: 'none'
        }
    ])
)

const TREE_HINTS = ['├──', '└──', '│', 'â”œâ”€â”€', 'â””â”€â”€', 'â”‚']
const TREE_GLYPH_REGEX = /[├└│─┬┴┼]|[â”œâ””â”‚â”€â”¬â”´â”¼]/
const TREE_LINE_REGEX =
    /^([\s├└│─┬┴┼â”œâ””â”‚â”€â”¬â”´â”¼]*(?:├──|└──|│\s+|â”œâ”€â”€|â””â”€â”€|â”‚\s+)?)(.*?)$/

function looksLikeFolderStructure(text: string): boolean {
    if (TREE_HINTS.some((hint) => text.includes(hint))) return true
    return TREE_GLYPH_REGEX.test(text)
}

export function CodeBlock({
    language,
    children,
    maxLines
}: {
    language?: string
    children: string
    maxLines?: number
}) {
    const [copied, setCopied] = useState(false)
    const [expanded, setExpanded] = useState(false)
    const codeBlockRef = useRef<HTMLDivElement | null>(null)

    const handleCopy = async () => {
        await navigator.clipboard.writeText(children)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
    }

    if (language === 'mermaid') {
        return (
            <div className="my-4">
                <MermaidDiagram chart={children} />
            </div>
        )
    }

    const isFolderStructure = looksLikeFolderStructure(children)
    const displayLanguage = language || (isFolderStructure ? 'structure' : 'code')
    const hasColorPreviewTokens = hasColorToken(children)
    const normalizedLines = children.split('\n')
    const lineLimit = Number.isFinite(maxLines) && Number(maxLines) > 0 ? Math.floor(Number(maxLines)) : 0
    const shouldCollapse = lineLimit > 0 && normalizedLines.length > lineLimit
    const visibleLines = shouldCollapse && !expanded ? normalizedLines.slice(0, lineLimit) : normalizedLines
    const visibleText = visibleLines.join('\n')
    const hiddenLineCount = normalizedLines.length - lineLimit
    const estimatedLineHeight = 26
    const collapsedMaxHeight = lineLimit > 0 ? (lineLimit * estimatedLineHeight) + 36 : undefined
    const expandedMaxHeight = shouldCollapse ? Math.max((normalizedLines.length * estimatedLineHeight) + 48, 320) : undefined

    const handleExpand = () => {
        setExpanded(true)
    }

    const handleCollapse = () => {
        setExpanded(false)
        requestAnimationFrame(() => {
            codeBlockRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
        })
    }

    return (
        <div ref={codeBlockRef} className="relative group rounded-lg overflow-hidden my-4 border border-sparkle-border">
            <div className="flex items-center justify-between px-4 py-2 bg-sparkle-accent border-b border-sparkle-border">
                <span className="text-xs font-mono text-sparkle-text-secondary uppercase tracking-wide">
                    {displayLanguage}
                </span>
                <button
                    onClick={handleCopy}
                    className="flex items-center gap-1.5 px-2 py-1 text-xs text-sparkle-text-secondary hover:text-sparkle-text hover:bg-sparkle-border rounded transition-colors"
                >
                    {copied ? (
                        <>
                            <Check size={12} className="text-green-400" />
                            <span className="text-green-400">Copied!</span>
                        </>
                    ) : (
                        <>
                            <Copy size={12} />
                            <span>Copy</span>
                        </>
                    )}
                </button>
            </div>

            <div
                className="relative overflow-hidden transition-[max-height] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]"
                style={
                    shouldCollapse
                        ? { maxHeight: expanded ? expandedMaxHeight : collapsedMaxHeight }
                        : undefined
                }
            >
                {shouldCollapse && (
                    <div
                        className={`pointer-events-none absolute right-3 top-3 z-10 transition-all duration-250 ${
                            expanded ? 'translate-y-0 opacity-100' : '-translate-y-1 opacity-0'
                        }`}
                    >
                        <button
                            type="button"
                            onClick={handleCollapse}
                            className="pointer-events-auto inline-flex items-center gap-1 rounded-md border border-[var(--accent-primary)]/50 bg-sparkle-bg/90 px-2 py-1 text-[11px] font-semibold text-[var(--accent-primary)] backdrop-blur-sm transition-colors hover:bg-[var(--accent-primary)]/15"
                        >
                            <ChevronUp size={12} />
                            Show less
                        </button>
                    </div>
                )}

                {isFolderStructure ? (
                    <pre className="p-4 bg-sparkle-card overflow-x-auto m-0">
                        <code className="text-sm font-mono leading-6 whitespace-pre">
                            {visibleLines.map((line, index) => {
                                const match = line.match(TREE_LINE_REGEX)
                                if (!match) {
                                    return (
                                        <div key={index} className="text-sparkle-text-dark">
                                            {line}
                                        </div>
                                    )
                                }

                                const [, prefix, name] = match
                                const trimmedName = name.trim()
                                const isFolder =
                                    trimmedName.endsWith('/') || (!trimmedName.includes('.') && trimmedName.length > 0)

                                return (
                                    <div key={index} className="hover:bg-sparkle-border">
                                        <span className="text-sparkle-text-muted">{prefix}</span>
                                        <span className={isFolder ? 'text-blue-400' : 'text-emerald-400'}>{name}</span>
                                    </div>
                                )
                            })}
                        </code>
                    </pre>
                ) : hasColorPreviewTokens ? (
                    <pre className="p-4 bg-sparkle-card overflow-x-auto m-0">
                        <code className="text-sm font-mono leading-6 whitespace-pre text-sparkle-text-dark">
                            {visibleLines.map((line, index) => (
                                <div key={index} className="hover:bg-sparkle-border -mx-4 px-4">
                                    {line.length > 0 ? renderColorAwareText(line, `code-color-${index}`) : '\u00A0'}
                                </div>
                            ))}
                        </code>
                    </pre>
                ) : (
                    <SyntaxHighlighter
                        language={language || 'text'}
                        style={flatCodeTheme as any}
                        customStyle={{
                            margin: 0,
                            padding: '1rem',
                            background: 'var(--color-card)',
                            fontSize: '0.875rem',
                            lineHeight: '1.6'
                        }}
                        showLineNumbers={visibleLines.length > 3}
                        lineNumberStyle={{ color: 'var(--color-text-muted)', paddingRight: '1rem' }}
                        wrapLines
                        lineProps={{ style: { background: 'transparent', display: 'block', width: '100%' } }}
                    >
                        {visibleText}
                    </SyntaxHighlighter>
                )}
            </div>
            {shouldCollapse && !expanded && (
                <div className="border-t border-sparkle-border bg-sparkle-bg px-4 py-2">
                    <button
                        type="button"
                        onClick={handleExpand}
                        className="text-xs font-medium text-[var(--accent-primary)] hover:text-sparkle-text transition-colors"
                    >
                        {`Read more (${hiddenLineCount} more lines)`}
                    </button>
                </div>
            )}
        </div>
    )
}

export function InlineCode({ children }: { children: ReactNode }) {
    const text = String(children)
    const isFolderStructure =
        text.includes('â”œâ”€â”€') ||
        text.includes('â””â”€â”€') ||
        text.includes('â”‚') ||
        text.includes('├──') ||
        text.includes('└──') ||
        text.includes('│') ||
        (text.includes('/') && text.split('\n').length > 2)

    if (isFolderStructure) {
        return (
            <pre className="my-4 p-4 bg-sparkle-card rounded-lg overflow-x-auto border border-sparkle-border">
                <code className="text-sm font-mono leading-relaxed whitespace-pre text-sparkle-text-dark">
                    {text.split('\n').map((line, index) => {
                        const match = line.match(/([â”œâ””â”‚â”€├└│─\s]+)?(.+)/)
                        if (!match) return <div key={index}>{line}</div>

                        const [, prefix = '', name] = match
                        const isFolder = name.endsWith('/')

                        return (
                            <div key={index} className="hover:bg-sparkle-border -mx-4 px-4">
                                <span className="text-sparkle-text-muted">{prefix}</span>
                                <span className={isFolder ? 'text-blue-400' : 'text-green-400'}>{name}</span>
                            </div>
                        )
                    })}
                </code>
            </pre>
        )
    }

    return (
        <code className="px-1.5 py-0.5 mx-0.5 text-sm font-mono bg-sparkle-accent text-pink-300 rounded border border-sparkle-border">
            {renderColorAwareText(text, 'inline-code', true)}
        </code>
    )
}
