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
}

function MarkdownRenderer({ content, className, filePath }: MarkdownRendererProps) {
    const components = useMemo(() => createMarkdownComponents(filePath), [filePath])

    return (
        <div className={cn('markdown-body break-words [overflow-wrap:anywhere] [word-break:break-word]', className)}>
            <Markdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]} components={components}>
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
        previous.filePath === next.filePath
)
