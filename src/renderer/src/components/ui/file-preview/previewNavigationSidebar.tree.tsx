import { useRef } from 'react'
import { useDraggable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { ChevronRight } from 'lucide-react'
import type { DevScopeFileTreeNode } from '@shared/contracts/devscope-project-contracts'
import { VscodeEntryIcon } from '@/components/ui/VscodeEntryIcon'
import { cn, getFileExtension } from '@/lib/utils'
import type { OutlineItem } from './modalShared'

export type VisibleOutlineItem = {
    item: OutlineItem
    depth: number
}

export type VisibleFolderNode = {
    node: DevScopeFileTreeNode
    depth: number
    expanded: boolean
}

export function normalizePathKey(pathValue: string): string {
    return String(pathValue || '').replace(/\\/g, '/').toLowerCase()
}

export function getPathName(pathValue: string): string {
    const normalized = String(pathValue || '').replace(/\\/g, '/').replace(/\/+$/, '')
    const lastSlashIndex = normalized.lastIndexOf('/')
    return lastSlashIndex >= 0 ? normalized.slice(lastSlashIndex + 1) : normalized
}

export function collectDefaultExpandedOutlineIds(items: OutlineItem[], depth = 0): string[] {
    const collected: string[] = []
    for (const item of items) {
        if (item.children.length > 0 && depth < 2) {
            collected.push(item.id, ...collectDefaultExpandedOutlineIds(item.children, depth + 1))
        }
    }
    return collected
}

export function flattenOutlineItems(items: OutlineItem[], expandedIds: Set<string>, depth = 0): VisibleOutlineItem[] {
    const visibleItems: VisibleOutlineItem[] = []
    for (const item of items) {
        visibleItems.push({ item, depth })
        if (item.children.length > 0 && expandedIds.has(item.id)) {
            visibleItems.push(...flattenOutlineItems(item.children, expandedIds, depth + 1))
        }
    }
    return visibleItems
}

export function flattenFolderNodes(nodes: DevScopeFileTreeNode[], expandedPaths: Set<string>, depth = 0): VisibleFolderNode[] {
    const visibleNodes: VisibleFolderNode[] = []
    for (const node of nodes) {
        const nodeKey = normalizePathKey(node.path)
        const expanded = expandedPaths.has(nodeKey)
        visibleNodes.push({ node, depth, expanded })
        if (node.type === 'directory' && expanded && Array.isArray(node.children) && node.children.length > 0) {
            visibleNodes.push(...flattenFolderNodes(node.children, expandedPaths, depth + 1))
        }
    }
    return visibleNodes
}

export function DraggablePreviewFileRow({
    node,
    depth,
    isActiveFile,
    isPreviewable,
    iconTheme,
    onOpen
}: {
    node: DevScopeFileTreeNode
    depth: number
    isActiveFile: boolean
    isPreviewable: boolean
    iconTheme: 'light' | 'dark'
    onOpen: () => void
}) {
    const extension = getFileExtension(node.name)
    const pointerStartRef = useRef<{ x: number; y: number } | null>(null)
    const suppressOpenRef = useRef(false)
    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
        id: `preview-file-tree:${normalizePathKey(node.path)}`,
        data: {
            type: 'preview-file-tree',
            file: { name: node.name, path: node.path },
            ext: extension
        }
    })

    return (
        <button
            ref={setNodeRef}
            type="button"
            onPointerDown={(event) => {
                pointerStartRef.current = { x: event.clientX, y: event.clientY }
                suppressOpenRef.current = false
            }}
            onPointerMove={(event) => {
                const startPoint = pointerStartRef.current
                if (!startPoint || suppressOpenRef.current) return
                const deltaX = event.clientX - startPoint.x
                const deltaY = event.clientY - startPoint.y
                if (Math.hypot(deltaX, deltaY) >= 6) {
                    suppressOpenRef.current = true
                }
            }}
            onPointerUp={() => { pointerStartRef.current = null }}
            onPointerCancel={() => { pointerStartRef.current = null }}
            onClick={(event) => {
                if (suppressOpenRef.current || isDragging) {
                    event.preventDefault()
                    event.stopPropagation()
                    suppressOpenRef.current = false
                    return
                }
                onOpen()
            }}
            className={cn(
                'flex w-full items-center gap-2 rounded-lg border px-2 py-1.5 text-left text-[11px] transition-colors',
                isActiveFile
                    ? 'border-sky-400/30 bg-sky-500/10 text-sky-100'
                    : 'border-transparent text-sparkle-text-secondary hover:border-white/[0.08] hover:bg-white/[0.05] hover:text-sparkle-text',
                !isPreviewable && 'text-sparkle-text-muted',
                isDragging && 'z-20 cursor-grabbing opacity-80 shadow-[0_12px_28px_rgba(0,0,0,0.28)]'
            )}
            style={{
                paddingLeft: `${8 + depth * 16}px`,
                transform: CSS.Translate.toString(transform)
            }}
            title={node.path}
            {...attributes}
            {...listeners}
        >
            <span className="inline-flex size-4 shrink-0 items-center justify-center rounded text-sparkle-text-muted opacity-0">
                <ChevronRight className="size-3.5" />
            </span>
            <VscodeEntryIcon
                pathValue={node.path}
                kind={node.type}
                theme={iconTheme}
                className="size-3.5 shrink-0"
            />
            <span className="min-w-0 flex-1 truncate">{node.name}</span>
            {isActiveFile ? (
                <span className="shrink-0 rounded-full bg-sky-400/80 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide text-sky-950">
                    Open
                </span>
            ) : null}
        </button>
    )
}
