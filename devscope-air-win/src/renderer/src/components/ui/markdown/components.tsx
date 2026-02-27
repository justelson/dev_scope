import type { Components } from 'react-markdown'
import type { HTMLAttributes } from 'react'
import { ExternalLink } from 'lucide-react'
import { cn } from '@/lib/utils'
import { CodeBlock, InlineCode } from './CodeElements'
import { renderColorAwareChildren } from './colorTokens'
import { resolveImageSrc } from './paths'

type DivProps = HTMLAttributes<HTMLDivElement> & { align?: string }

export function createMarkdownComponents(
    filePath?: string,
    options?: { codeBlockMaxLines?: number }
): Components {
    return {
        h1: ({ children }) => (
            <h1 className="text-2xl font-bold text-sparkle-text pb-2 mb-4 border-b border-sparkle-border first:mt-0 mt-8">
                {children}
            </h1>
        ),
        div: ({ className, ...props }: DivProps) => {
            const isCenter = props.align === 'center'
            return <div className={cn(className, isCenter && 'flex flex-col items-center text-center')} {...props} />
        },
        h2: ({ children }) => (
            <h2 className="text-xl font-semibold text-sparkle-text pb-2 mb-3 border-b border-sparkle-border mt-8 first:mt-0">
                {children}
            </h2>
        ),
        h3: ({ children }) => (
            <h3 className="text-lg font-semibold text-sparkle-text mt-6 mb-3 first:mt-0">{children}</h3>
        ),
        h4: ({ children }) => <h4 className="text-base font-semibold text-sparkle-text mt-4 mb-2">{children}</h4>,
        h5: ({ children }) => <h5 className="text-sm font-semibold text-sparkle-text mt-4 mb-2">{children}</h5>,
        h6: ({ children }) => (
            <h6 className="text-sm font-semibold text-sparkle-text-dark mt-4 mb-2">{children}</h6>
        ),
        p: ({ children }) => (
            <p className="text-sparkle-text-dark leading-relaxed mb-4 last:mb-0 break-words [overflow-wrap:anywhere]">
                {renderColorAwareChildren(children, 'p')}
            </p>
        ),
        a: ({ href, children }) => (
            <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-400 hover:text-blue-300 hover:underline inline-flex items-center gap-1"
            >
                {renderColorAwareChildren(children, 'a')}
                <ExternalLink size={12} className="opacity-50" />
            </a>
        ),
        strong: ({ children }) => (
            <strong className="font-semibold text-sparkle-text">
                {renderColorAwareChildren(children, 'strong')}
            </strong>
        ),
        em: ({ children }) => (
            <em className="italic text-sparkle-text-dark">{renderColorAwareChildren(children, 'em')}</em>
        ),
        code: ({ className, children }) => {
            const match = /language-(\w+)/.exec(className || '')
            const isInline = !match && !className

            if (isInline) {
                return <InlineCode>{children}</InlineCode>
            }

            return (
                <CodeBlock
                    language={match?.[1]}
                    maxLines={options?.codeBlockMaxLines}
                >
                    {String(children).replace(/\n$/, '')}
                </CodeBlock>
            )
        },
        pre: ({ children, ...props }) => (
            <pre className="whitespace-pre overflow-x-auto font-mono text-sm leading-none" {...props}>
                {children}
            </pre>
        ),
        ul: ({ children }) => (
            <ul className="list-disc list-outside ml-6 mb-4 space-y-1 text-sparkle-text-dark">{children}</ul>
        ),
        ol: ({ children }) => (
            <ol className="list-decimal list-outside ml-6 mb-4 space-y-1 text-sparkle-text-dark">{children}</ol>
        ),
        li: ({ children }) => <li className="leading-relaxed pl-1 break-words [overflow-wrap:anywhere]">{renderColorAwareChildren(children, 'li')}</li>,
        blockquote: ({ children }) => (
            <blockquote className="border-l-4 border-blue-500/50 pl-4 py-1 my-4 bg-blue-500/5 rounded-r-lg text-sparkle-text-secondary italic">
                {renderColorAwareChildren(children, 'blockquote')}
            </blockquote>
        ),
        hr: () => <hr className="border-sparkle-border my-6" />,
        img: ({ src, alt }) => (
            <span className="inline-flex flex-col items-center align-bottom mr-2 mb-2">
                <img
                    src={resolveImageSrc(src || '', filePath)}
                    alt={alt || ''}
                    className="max-w-full h-auto rounded-lg border border-sparkle-border"
                />
                {alt && (
                    <span className="hidden text-center text-sm text-sparkle-text-secondary mt-2 group-hover:block">
                        {alt}
                    </span>
                )}
            </span>
        ),
        table: ({ children }) => (
            <div className="overflow-x-auto my-4 rounded-lg border border-sparkle-border">
                <table className="w-full border-collapse text-sm">{children}</table>
            </div>
        ),
        thead: ({ children }) => <thead className="bg-sparkle-accent">{children}</thead>,
        tbody: ({ children }) => <tbody>{children}</tbody>,
        tr: ({ children }) => (
            <tr className="border-b border-sparkle-border last:border-0 hover:bg-sparkle-accent transition-colors">
                {children}
            </tr>
        ),
        th: ({ children }) => (
            <th className="px-4 py-3 text-left font-semibold text-sparkle-text border-r border-sparkle-border last:border-r-0">
                {renderColorAwareChildren(children, 'th')}
            </th>
        ),
        td: ({ children }) => (
            <td className="px-4 py-3 text-sparkle-text-dark border-r border-sparkle-border last:border-r-0 break-words [overflow-wrap:anywhere]">
                {renderColorAwareChildren(children, 'td')}
            </td>
        ),
        input: ({ type, checked }) => {
            if (type !== 'checkbox') return null

            return (
                <input
                    type="checkbox"
                    checked={checked}
                    readOnly
                    className="mr-2 rounded border-sparkle-border bg-transparent checked:bg-blue-500 checked:border-blue-500"
                />
            )
        },
        del: ({ children }) => <del className="text-sparkle-text-secondary line-through">{children}</del>
    }
}
