/**
 * GitHub-style Markdown Renderer
 * Renders markdown with syntax highlighting, proper styling, and all GFM features
 */

import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { Copy, Check, ExternalLink } from 'lucide-react'
import { useState } from 'react'
import { cn } from '@/lib/utils'

interface MarkdownRendererProps {
    content: string
    className?: string
    filePath?: string
}

function getFileUrl(path: string) {
    if (path.startsWith('http') || path.startsWith('data:')) return path

    // For Windows paths, ensure they start with a drive letter or slash
    const normalizedPath = path.replace(/\\/g, '/')

    // Encode parts but keep slashes
    const encodedPath = normalizedPath.split('/').map(part => {
        // Don't encode drive letter colon
        if (part.endsWith(':')) return part
        return encodeURIComponent(part)
    }).join('/')

    return `file:///${encodedPath}`
}

function resolveImageSrc(src: string, methodFilePath?: string): string {
    if (!src || src.startsWith('http') || src.startsWith('data:') || src.startsWith('file:')) {
        return src
    }

    if (!methodFilePath) return src

    // Get directory of the markdown file
    const normalizePath = (p: string) => p.replace(/\\/g, '/')
    const fileDir = normalizePath(methodFilePath).substring(0, normalizePath(methodFilePath).lastIndexOf('/'))

    // Handle absolute paths (starting with C: or /)
    if (src.match(/^[a-zA-Z]:/) || src.startsWith('/')) {
        return getFileUrl(src)
    }

    // Resolve relative path
    // Simple resolution for ./ and ../
    let parts = fileDir.split('/')
    const srcParts = normalizePath(src).split('/')

    for (const part of srcParts) {
        if (part === '.') continue
        if (part === '..') {
            parts.pop()
        } else {
            parts.push(part)
        }
    }

    const resolvedPath = parts.join('/')
    return getFileUrl(resolvedPath)
}

// Code block with copy button
function CodeBlock({ language, children }: { language?: string; children: string }) {
    const [copied, setCopied] = useState(false)

    const handleCopy = async () => {
        await navigator.clipboard.writeText(children)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
    }

    // Detect if this looks like a folder structure
    const isFolderStructure = (
        children.includes('├') ||
        children.includes('└') ||
        children.includes('│') ||
        children.includes('├──') ||
        children.includes('└──') ||
        /[├└│─┬┴┼]/.test(children)
    )

    const displayLanguage = language || (isFolderStructure ? 'structure' : 'code')

    return (
        <div className="relative group rounded-lg overflow-hidden my-4 border border-white/10">
            {/* Language badge & copy button */}
            <div className="flex items-center justify-between px-4 py-2 bg-[#1a1a1a] border-b border-white/10">
                <span className="text-xs font-mono text-white/50 uppercase tracking-wide">
                    {displayLanguage}
                </span>
                <button
                    onClick={handleCopy}
                    className="flex items-center gap-1.5 px-2 py-1 text-xs text-white/50 hover:text-white hover:bg-white/10 rounded transition-colors"
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
            {isFolderStructure ? (
                <pre className="p-4 bg-[#1e1e1e] overflow-x-auto m-0">
                    <code className="text-sm font-mono leading-6 whitespace-pre">
                        {children.split('\n').map((line, i) => {
                            // Split line into tree prefix and name
                            const match = line.match(/^([\s│├└─┬┴┼]*(?:├──|└──|│\s+)?)(.*?)$/)
                            if (match) {
                                const [, prefix, name] = match
                                const trimmedName = name.trim()
                                const isFolder = trimmedName.endsWith('/') || (!trimmedName.includes('.') && trimmedName.length > 0)
                                return (
                                    <div key={i} className="hover:bg-white/5">
                                        <span className="text-white/30">{prefix}</span>
                                        <span className={isFolder ? 'text-blue-400' : 'text-emerald-400'}>{name}</span>
                                    </div>
                                )
                            }
                            return <div key={i} className="text-white/70">{line}</div>
                        })}
                    </code>
                </pre>
            ) : (
                <SyntaxHighlighter
                    language={language || 'text'}
                    style={oneDark}
                    customStyle={{
                        margin: 0,
                        padding: '1rem',
                        background: '#1e1e1e',
                        fontSize: '0.875rem',
                        lineHeight: '1.6',
                    }}
                    showLineNumbers={children.split('\n').length > 3}
                    lineNumberStyle={{ color: '#4a4a4a', paddingRight: '1rem' }}
                >
                    {children}
                </SyntaxHighlighter>
            )}
        </div>
    )
}


// Inline code styling - detect folder structures
function InlineCode({ children }: { children: React.ReactNode }) {
    const text = String(children)

    // Check if this looks like a folder structure (has tree characters or multiple path segments)
    const isFolderStructure =
        text.includes('├──') ||
        text.includes('└──') ||
        text.includes('│') ||
        (text.includes('/') && text.split('\n').length > 2)

    if (isFolderStructure) {
        return (
            <pre className="my-4 p-4 bg-[#1e1e1e] rounded-lg overflow-x-auto border border-white/10">
                <code className="text-sm font-mono leading-relaxed whitespace-pre text-white/80">
                    {text.split('\n').map((line, i) => {
                        // Highlight folder/file names
                        const match = line.match(/([├└│─\s]+)?(.+)/)
                        if (match) {
                            const [, prefix = '', name] = match
                            const isFolder = name.endsWith('/')
                            return (
                                <div key={i} className="hover:bg-white/5 -mx-4 px-4">
                                    <span className="text-white/30">{prefix}</span>
                                    <span className={isFolder ? 'text-blue-400' : 'text-green-400'}>{name}</span>
                                </div>
                            )
                        }
                        return <div key={i}>{line}</div>
                    })}
                </code>
            </pre>
        )
    }

    return (
        <code className="px-1.5 py-0.5 mx-0.5 text-sm font-mono bg-white/10 text-pink-300 rounded border border-white/5">
            {children}
        </code>
    )
}

import rehypeRaw from 'rehype-raw'

// ... existing imports

export default function MarkdownRenderer({ content, className, filePath }: MarkdownRendererProps) {
    return (
        <div className={cn("markdown-body", className)}>
            <Markdown
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeRaw]}
                components={{
                    // Headings with GitHub-style anchor links
                    h1: ({ children }) => (
                        <h1 className="text-2xl font-bold text-white pb-2 mb-4 border-b border-white/10 first:mt-0 mt-8">
                            {children}
                        </h1>
                    ),

                    // Div with alignment support
                    div: ({ className, ...props }: React.HTMLAttributes<HTMLDivElement> & { align?: string }) => {
                        const isCenter = props.align === 'center'
                        return (
                            <div
                                className={cn(
                                    className,
                                    isCenter && "flex flex-col items-center text-center"
                                )}
                                {...props}
                            />
                        )
                    },
                    h2: ({ children }) => (
                        <h2 className="text-xl font-semibold text-white pb-2 mb-3 border-b border-white/10 mt-8 first:mt-0">
                            {children}
                        </h2>
                    ),
                    h3: ({ children }) => (
                        <h3 className="text-lg font-semibold text-white mt-6 mb-3 first:mt-0">
                            {children}
                        </h3>
                    ),
                    h4: ({ children }) => (
                        <h4 className="text-base font-semibold text-white mt-4 mb-2">
                            {children}
                        </h4>
                    ),
                    h5: ({ children }) => (
                        <h5 className="text-sm font-semibold text-white mt-4 mb-2">
                            {children}
                        </h5>
                    ),
                    h6: ({ children }) => (
                        <h6 className="text-sm font-semibold text-white/70 mt-4 mb-2">
                            {children}
                        </h6>
                    ),

                    // Paragraphs
                    p: ({ children }) => (
                        <p className="text-white/70 leading-relaxed mb-4 last:mb-0">
                            {children}
                        </p>
                    ),

                    // Links with external indicator
                    a: ({ href, children }) => (
                        <a
                            href={href}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-400 hover:text-blue-300 hover:underline inline-flex items-center gap-1"
                        >
                            {children}
                            <ExternalLink size={12} className="opacity-50" />
                        </a>
                    ),

                    // Strong/Bold
                    strong: ({ children }) => (
                        <strong className="font-semibold text-white">{children}</strong>
                    ),

                    // Emphasis/Italic
                    em: ({ children }) => (
                        <em className="italic text-white/80">{children}</em>
                    ),

                    // Code blocks
                    code: ({ className, children, ...props }) => {
                        const match = /language-(\w+)/.exec(className || '')
                        const isInline = !match && !className

                        if (isInline) {
                            return <InlineCode>{children}</InlineCode>
                        }

                        return (
                            <CodeBlock language={match?.[1]}>
                                {String(children).replace(/\n$/, '')}
                            </CodeBlock>
                        )
                    },

                    // Pre wrapper - ensure whitespace preservation for ASCII art
                    pre: ({ children, ...props }) => (
                        <pre className="whitespace-pre overflow-x-auto font-mono text-sm leading-none" {...props}>
                            {children}
                        </pre>
                    ),

                    // Lists
                    ul: ({ children }) => (
                        <ul className="list-disc list-outside ml-6 mb-4 space-y-1 text-white/70">
                            {children}
                        </ul>
                    ),
                    ol: ({ children }) => (
                        <ol className="list-decimal list-outside ml-6 mb-4 space-y-1 text-white/70">
                            {children}
                        </ol>
                    ),
                    li: ({ children }) => (
                        <li className="leading-relaxed pl-1">{children}</li>
                    ),

                    // Blockquotes
                    blockquote: ({ children }) => (
                        <blockquote className="border-l-4 border-blue-500/50 pl-4 py-1 my-4 bg-blue-500/5 rounded-r-lg text-white/60 italic">
                            {children}
                        </blockquote>
                    ),

                    // Horizontal rule
                    hr: () => <hr className="border-white/10 my-6" />,

                    // Images
                    img: ({ src, alt }) => (
                        <span className="inline-flex flex-col items-center align-bottom mr-2 mb-2">
                            <img
                                src={resolveImageSrc(src || '', filePath)}
                                alt={alt || ''}
                                className="max-w-full h-auto rounded-lg border border-white/10"
                            />
                            {alt && (
                                <span className="hidden text-center text-sm text-white/40 mt-2 group-hover:block">
                                    {alt}
                                </span>
                            )}
                        </span>
                    ),

                    // Tables (GitHub-style)
                    table: ({ children }) => (
                        <div className="overflow-x-auto my-4 rounded-lg border border-white/10">
                            <table className="w-full border-collapse text-sm">
                                {children}
                            </table>
                        </div>
                    ),
                    thead: ({ children }) => (
                        <thead className="bg-white/5">{children}</thead>
                    ),
                    tbody: ({ children }) => <tbody>{children}</tbody>,
                    tr: ({ children }) => (
                        <tr className="border-b border-white/5 last:border-0 hover:bg-white/5 transition-colors">
                            {children}
                        </tr>
                    ),
                    th: ({ children }) => (
                        <th className="px-4 py-3 text-left font-semibold text-white border-r border-white/5 last:border-r-0">
                            {children}
                        </th>
                    ),
                    td: ({ children }) => (
                        <td className="px-4 py-3 text-white/70 border-r border-white/5 last:border-r-0">
                            {children}
                        </td>
                    ),

                    // Task lists (GFM)
                    input: ({ type, checked }) => {
                        if (type === 'checkbox') {
                            return (
                                <input
                                    type="checkbox"
                                    checked={checked}
                                    readOnly
                                    className="mr-2 rounded border-white/30 bg-transparent checked:bg-blue-500 checked:border-blue-500"
                                />
                            )
                        }
                        return null
                    },

                    // Delete/Strikethrough
                    del: ({ children }) => (
                        <del className="text-white/40 line-through">{children}</del>
                    ),
                }}
            >
                {content}
            </Markdown>
        </div>
    )
}
