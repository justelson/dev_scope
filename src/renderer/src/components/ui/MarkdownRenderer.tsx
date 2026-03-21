/**
 * GitHub-style Markdown Renderer
 * Renders markdown with syntax highlighting, proper styling, and all GFM features
 */

import { memo, useMemo } from 'react'
import Markdown from 'react-markdown'
import rehypeRaw from 'rehype-raw'
import remarkGfm from 'remark-gfm'
import { cn } from '@/lib/utils'
import { createMarkdownComponents } from './markdown/components'

interface MarkdownRendererProps {
    content: string
    className?: string
    filePath?: string
    codeBlockMaxLines?: number
    lightweight?: boolean
    onInternalLinkClick?: (href: string) => Promise<void> | void
}

function MarkdownRenderer({ content, className, filePath, codeBlockMaxLines, lightweight = false, onInternalLinkClick }: MarkdownRendererProps) {
    const components = useMemo(
        () => createMarkdownComponents(filePath, {
            codeBlockMaxLines,
            onInternalLinkClick,
            plainCodeBlocks: lightweight
        }),
        [filePath, codeBlockMaxLines, lightweight, onInternalLinkClick]
    )

    return (
        <div className={cn('markdown-body break-words [overflow-wrap:anywhere] [word-break:break-word]', className)}>
            <Markdown remarkPlugins={[remarkGfm]} rehypePlugins={lightweight ? [] : [rehypeRaw]} components={components}>
                {content}
            </Markdown>
        </div>
    )
}

export default memo(
    MarkdownRenderer,
    (previous, next) =>
        previous.content === next.content &&
        previous.className === next.className &&
        previous.filePath === next.filePath &&
        previous.codeBlockMaxLines === next.codeBlockMaxLines &&
        previous.lightweight === next.lightweight &&
        previous.onInternalLinkClick === next.onInternalLinkClick
)
