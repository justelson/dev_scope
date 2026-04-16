import { X, Plus } from 'lucide-react'
import { SortableContext, horizontalListSortingStrategy, useSortable } from '@dnd-kit/sortable'
import { useDroppable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { useEffect, useRef } from 'react'
import { VscodeEntryIcon } from '@/components/ui/VscodeEntryIcon'
import { cn } from '@/lib/utils'
import type { PreviewTab } from './types'

type PreviewTabStripProps = {
    tabs: PreviewTab[]
    activeTabId: string | null
    activeTabDirty?: boolean
    iconTheme: 'light' | 'dark'
    canCreateSiblingFile?: boolean
    onSelectTab: (tabId: string) => void
    onCloseTab: (tabId: string) => void
    onCreateSiblingFile?: () => void
}

function SortablePreviewTab({
    tab,
    active,
    activeTabDirty = false,
    iconTheme,
    onSelect,
    onClose,
    registerNode
}: {
    tab: PreviewTab
    active: boolean
    activeTabDirty?: boolean
    iconTheme: 'light' | 'dark'
    onSelect: () => void
    onClose: () => void
    registerNode: (tabId: string, node: HTMLDivElement | null) => void
}) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
        id: `preview-tab:${tab.id}`,
        data: { type: 'preview-tab', tabId: tab.id, file: tab.file }
    })

    return (
        <div
            ref={(node) => {
                setNodeRef(node)
                registerNode(tab.id, node)
            }}
            onClick={onSelect}
            onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    onSelect()
                }
            }}
            className={cn(
                'group/tab relative inline-flex h-full min-w-0 max-w-[220px] items-center gap-1.5 border-r border-white/[0.08] px-2 text-[11px] font-normal transition-[background-color,color,opacity] duration-150',
                active ? 'bg-sparkle-card text-white/94' : 'bg-[#0a1018] text-white/58 hover:bg-white/[0.03] hover:text-white/82',
                isDragging && 'z-20 opacity-80'
            )}
            style={{
                transform: CSS.Translate.toString(transform),
                transition
            }}
            {...attributes}
            {...listeners}
            title={tab.file.name}
        >
            <span className="inline-flex h-4 w-4 shrink-0 items-center justify-center">
                <VscodeEntryIcon
                    pathValue={tab.file.path || tab.file.name}
                    kind="file"
                    theme={iconTheme}
                    className="size-3.5 shrink-0"
                />
            </span>
            <span className="min-w-0 flex-1 truncate text-left">{tab.file.name}</span>
            {active && activeTabDirty ? (
                <span className="size-1.5 shrink-0 rounded-full bg-amber-300/85" aria-hidden="true" />
            ) : null}
            <button
                type="button"
                onClick={(event) => {
                    event.stopPropagation()
                    onClose()
                }}
                className={cn(
                    'inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-sm text-white/28 transition-colors',
                    active ? 'hover:bg-black/[0.12] hover:text-white/78' : 'hover:bg-white/[0.06] hover:text-white/70'
                )}
                title={`Close ${tab.file.name}`}
            >
                <X size={10} />
            </button>
        </div>
    )
}

export function PreviewTabStrip({
    tabs,
    activeTabId,
    activeTabDirty = false,
    iconTheme,
    canCreateSiblingFile = false,
    onSelectTab,
    onCloseTab,
    onCreateSiblingFile
}: PreviewTabStripProps) {
    const { setNodeRef: setStripDropRef, isOver: isStripDropOver } = useDroppable({
        id: 'preview-tab-strip',
        data: { type: 'preview-tab-strip' }
    })
    const { setNodeRef: setNewTabDropRef, isOver: isNewTabDropOver } = useDroppable({
        id: 'preview-new-tab',
        data: { type: 'preview-new-tab' }
    })
    const viewportRef = useRef<HTMLDivElement | null>(null)
    const tabNodeMapRef = useRef(new Map<string, HTMLDivElement | null>())

    useEffect(() => {
        if (!activeTabId) return
        const viewportNode = viewportRef.current
        const activeNode = tabNodeMapRef.current.get(activeTabId)
        if (!viewportNode || !activeNode) return

        const viewportRect = viewportNode.getBoundingClientRect()
        const activeRect = activeNode.getBoundingClientRect()

        if (activeRect.left < viewportRect.left) {
            viewportNode.scrollBy({
                left: activeRect.left - viewportRect.left - 16,
                behavior: 'smooth'
            })
            return
        }

        if (activeRect.right > viewportRect.right) {
            viewportNode.scrollBy({
                left: activeRect.right - viewportRect.right + 16,
                behavior: 'smooth'
            })
        }
    }, [activeTabId])

    const registerNode = (tabId: string, node: HTMLDivElement | null) => {
        tabNodeMapRef.current.set(tabId, node)
    }

    return (
        <div className="flex h-full min-w-0 flex-1 items-stretch overflow-hidden">
            <div
                ref={(node) => {
                    setStripDropRef(node)
                    viewportRef.current = node
                }}
                className={cn(
                    'h-full min-w-0 flex-1 overflow-x-auto overflow-y-hidden custom-scrollbar',
                    isStripDropOver && 'bg-white/[0.02]'
                )}
            >
                <div className="inline-flex h-full min-w-max items-stretch">
                    <SortableContext items={tabs.map((tab) => `preview-tab:${tab.id}`)} strategy={horizontalListSortingStrategy}>
                        {tabs.map((tab) => (
                            <SortablePreviewTab
                                key={tab.id}
                                tab={tab}
                                active={tab.id === activeTabId}
                                activeTabDirty={tab.id === activeTabId && activeTabDirty}
                                iconTheme={iconTheme}
                                onSelect={() => onSelectTab(tab.id)}
                                onClose={() => onCloseTab(tab.id)}
                                registerNode={registerNode}
                            />
                        ))}
                    </SortableContext>
                    {canCreateSiblingFile ? (
                        <button
                            ref={setNewTabDropRef}
                            type="button"
                            onClick={onCreateSiblingFile}
                            className={cn(
                                'inline-flex h-full w-7 shrink-0 items-center justify-center border-r border-white/[0.08] bg-[#0a1018] text-white/32 transition-colors duration-150',
                                isNewTabDropOver
                                    ? 'bg-white/[0.08] text-white/88'
                                    : 'hover:bg-white/[0.03] hover:text-white/82 focus-visible:bg-white/[0.03] focus-visible:text-white/82'
                            )}
                            title="New file in current directory"
                        >
                            <Plus size={12} />
                        </button>
                    ) : null}
                </div>
            </div>
        </div>
    )
}
