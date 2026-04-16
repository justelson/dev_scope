import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AlertCircle, Check, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Copy, FolderOpen, ListTree, PanelLeft } from 'lucide-react'
import type { DevScopeFileTreeNode } from '@shared/contracts/devscope-project-contracts'
import { useSettings } from '@/lib/settings'
import { cn, getFileExtension } from '@/lib/utils'
import type { OutlineItem, OutlineItemKind } from './modalShared'
import type { PreviewFile, PreviewOpenOptions } from './types'
import { resolvePreviewType } from './utils'
import { usePreviewFolderTree } from './usePreviewFolderTree'
import {
    collectDefaultExpandedOutlineIds,
    DraggablePreviewFileRow,
    flattenFolderNodes,
    flattenOutlineItems,
    getPathName,
    normalizePathKey,
    type VisibleFolderNode,
    type VisibleOutlineItem
} from './previewNavigationSidebar.tree'

type SidebarTab = 'outline' | 'folder'

type PreviewNavigationSidebarProps = {
    file: PreviewFile
    projectPath?: string
    outlineItems: OutlineItem[]
    onOutlineSelect: (item: OutlineItem) => void
    onMinimizePanel?: () => void
    onOpenLinkedPreview?: (file: { name: string; path: string }, ext: string, options?: PreviewOpenOptions) => Promise<void>
    onOpenLinkedPreviewInNewTab?: (file: { name: string; path: string }, ext: string, options?: PreviewOpenOptions) => Promise<void>
    refreshToken?: number
    preserveContextRequest?: { path: string; nonce: number } | null
}

const KIND_STYLES: Record<OutlineItemKind, { dot: string; glow: string }> = {
    heading: { dot: 'bg-violet-400', glow: 'shadow-[0_0_0_1px_rgba(167,139,250,0.2)]' },
    class: { dot: 'bg-sky-400', glow: 'shadow-[0_0_0_1px_rgba(56,189,248,0.2)]' },
    function: { dot: 'bg-emerald-400', glow: 'shadow-[0_0_0_1px_rgba(52,211,153,0.2)]' }
}

export function PreviewNavigationSidebar({
    file,
    projectPath,
    outlineItems,
    onOutlineSelect,
    onMinimizePanel,
    onOpenLinkedPreview,
    onOpenLinkedPreviewInNewTab: _onOpenLinkedPreviewInNewTab,
    refreshToken = 0,
    preserveContextRequest = null
}: PreviewNavigationSidebarProps) {
    const { settings } = useSettings()
    const iconTheme = settings.theme === 'light' ? 'light' : 'dark'
    const [activeTab, setActiveTab] = useState<SidebarTab>('folder')
    const [expandedOutlineIds, setExpandedOutlineIds] = useState<Set<string>>(() => new Set())
    const [copiedPath, setCopiedPath] = useState(false)
    const [fileHistory, setFileHistory] = useState<string[]>(() => file.path ? [file.path] : [])
    const [fileHistoryIndex, setFileHistoryIndex] = useState(file.path ? 0 : -1)
    const pendingHistoryTargetRef = useRef<{ pathKey: string; index: number } | null>(null)
    const {
        activeFolderPath,
        tree,
        loading: folderLoading,
        error: folderError,
        expandedPaths,
        toggleDirectory,
        reload,
        preserveContextForFile,
        canNavigateUpFolder,
        navigateUpFolder
    } = usePreviewFolderTree({
        filePath: file.path,
        projectPath,
        refreshToken
    })

    useEffect(() => {
        setExpandedOutlineIds(new Set(collectDefaultExpandedOutlineIds(outlineItems)))
    }, [file.path, outlineItems])

    useEffect(() => {
        const nextPath = String(file.path || '').trim()
        const nextPathKey = normalizePathKey(nextPath)
        if (!nextPathKey) return

        const pendingTarget = pendingHistoryTargetRef.current
        if (pendingTarget?.pathKey === nextPathKey) {
            pendingHistoryTargetRef.current = null
            setFileHistoryIndex(pendingTarget.index)
            return
        }

        setFileHistory((currentHistory) => {
            if (currentHistory.length === 0) {
                setFileHistoryIndex(0)
                return [nextPath]
            }

            const currentEntry = currentHistory[fileHistoryIndex]
            if (normalizePathKey(currentEntry || '') === nextPathKey) {
                return currentHistory
            }

            const trimmedHistory = currentHistory.slice(0, Math.max(0, fileHistoryIndex) + 1)
            if (normalizePathKey(trimmedHistory[trimmedHistory.length - 1] || '') === nextPathKey) {
                setFileHistoryIndex(trimmedHistory.length - 1)
                return trimmedHistory
            }

            const nextHistory = [...trimmedHistory, nextPath]
            setFileHistoryIndex(nextHistory.length - 1)
            return nextHistory
        })
    }, [file.path, fileHistoryIndex])

    useEffect(() => {
        const nextPath = String(preserveContextRequest?.path || '').trim()
        if (!nextPath) return
        preserveContextForFile(nextPath)
    }, [preserveContextForFile, preserveContextRequest?.nonce, preserveContextRequest?.path])

    const visibleOutlineItems = useMemo(
        () => flattenOutlineItems(outlineItems, expandedOutlineIds),
        [expandedOutlineIds, outlineItems]
    )
    const visibleFolderNodes = useMemo(
        () => flattenFolderNodes(tree, expandedPaths),
        [expandedPaths, tree]
    )
    const activeFileKey = useMemo(() => normalizePathKey(file.path), [file.path])

    const handleOutlineToggle = useCallback((item: OutlineItem) => {
        if (item.children.length === 0) return
        setExpandedOutlineIds((currentExpandedIds) => {
            const nextExpandedIds = new Set(currentExpandedIds)
            if (nextExpandedIds.has(item.id)) nextExpandedIds.delete(item.id)
            else nextExpandedIds.add(item.id)
            return nextExpandedIds
        })
    }, [])

    const handleFolderFileOpen = useCallback(async (node: DevScopeFileTreeNode) => {
        if (node.type !== 'file' || !onOpenLinkedPreview) return
        preserveContextForFile(node.path)
        await onOpenLinkedPreview({ name: node.name, path: node.path }, getFileExtension(node.name))
    }, [onOpenLinkedPreview, preserveContextForFile])

    const openHistoryFile = useCallback(async (targetIndex: number) => {
        if (!onOpenLinkedPreview) return

        const targetPath = fileHistory[targetIndex]
        if (!targetPath) return

        pendingHistoryTargetRef.current = {
            pathKey: normalizePathKey(targetPath),
            index: targetIndex
        }
        preserveContextForFile(targetPath)
        const targetName = getPathName(targetPath)
        try {
            await onOpenLinkedPreview({ name: targetName, path: targetPath }, getFileExtension(targetName))
        } catch (error) {
            pendingHistoryTargetRef.current = null
            throw error
        }
    }, [fileHistory, onOpenLinkedPreview, preserveContextForFile])

    const canGoToPreviousFile = fileHistoryIndex > 0
    const canGoToNextFile = fileHistoryIndex >= 0 && fileHistoryIndex < fileHistory.length - 1

    const handleCopyFolderPath = useCallback(async () => {
        if (!activeFolderPath) return
        await navigator.clipboard.writeText(activeFolderPath)
        setCopiedPath(true)
        window.setTimeout(() => setCopiedPath(false), 1200)
    }, [activeFolderPath])

    return (
        <div className="flex min-h-0 flex-1 flex-col bg-[#0c121b]">
            <div className="border-b border-white/[0.06] bg-[#0b1118]/96">
                <div className="relative grid h-9 min-h-9 grid-cols-2">
                    <div
                        className={cn(
                            'pointer-events-none absolute inset-y-0 w-1/2 bg-white/[0.045] transition-transform duration-200 ease-out',
                            activeTab === 'folder' ? 'translate-x-0' : 'translate-x-full'
                        )}
                    />
                    <div className="pointer-events-none absolute inset-y-1.5 left-1/2 w-px -translate-x-1/2 bg-white/[0.08]" />
                    <div
                        className={cn(
                            'relative z-[1] flex min-w-0 items-stretch border-b transition-colors duration-200',
                            activeTab === 'folder' ? 'border-white/55 text-white' : 'border-transparent text-white/34 hover:text-white/72'
                        )}
                    >
                        <button
                            type="button"
                            onClick={onMinimizePanel}
                            className="inline-flex h-full shrink-0 items-center justify-center pl-1.5 pr-2 text-inherit opacity-70 transition-[opacity,color,background-color] duration-200 hover:bg-white/[0.04] hover:opacity-100 hover:text-white"
                            title="Minimize left panel"
                        >
                            <PanelLeft className="size-3.5" />
                        </button>
                        <div className="my-2 w-px shrink-0 bg-white/[0.08]" />
                        <button
                            type="button"
                            onClick={() => setActiveTab('folder')}
                            className={cn(
                                'inline-flex min-w-0 flex-1 items-center justify-center gap-1.5 px-2 text-[11px] font-medium transition-[opacity,color,background-color] duration-200',
                                activeTab === 'folder' ? 'text-white opacity-100' : 'text-white/36 opacity-70 hover:bg-white/[0.04] hover:text-white/78 hover:opacity-100'
                            )}
                        >
                            <FolderOpen className="size-3.5" />
                            <span>Folder</span>
                        </button>
                    </div>
                    <button
                        type="button"
                        onClick={() => setActiveTab('outline')}
                        className={cn(
                            'relative z-[1] inline-flex min-w-0 items-center justify-center gap-1.5 border-b px-2 text-[11px] font-medium transition-[opacity,color,background-color,border-color] duration-200',
                            activeTab === 'outline'
                                ? 'border-white/55 text-white opacity-100'
                                : 'border-transparent text-white/36 opacity-70 hover:bg-white/[0.04] hover:text-white/78 hover:opacity-100'
                        )}
                    >
                        <ListTree className="size-3.5" />
                        <span>File map</span>
                    </button>
                </div>
            </div>

            <div className="relative min-h-0 flex-1 overflow-hidden">
                <div
                    className={cn(
                        'absolute inset-0 flex min-h-0 flex-col transition-[opacity,transform] duration-180 ease-out',
                        activeTab === 'outline'
                            ? 'translate-x-0 opacity-100'
                            : '-translate-x-2 pointer-events-none opacity-0'
                    )}
                >
                    <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto px-2 py-2">
                        {visibleOutlineItems.length > 0 ? (
                            <div className="space-y-0.5">
                                {visibleOutlineItems.map(({ item, depth }) => {
                                    const isExpanded = expandedOutlineIds.has(item.id)
                                    const canExpand = item.children.length > 0
                                    const kindStyle = KIND_STYLES[item.kind]

                                    return (
                                        <button
                                            key={item.id}
                                            type="button"
                                            onClick={() => onOutlineSelect(item)}
                                            className="flex w-full items-center gap-2 rounded-lg border border-transparent px-2 py-1.5 text-left text-[11px] transition-colors hover:border-white/[0.08] hover:bg-white/[0.05]"
                                            style={{ paddingLeft: `${8 + depth * 16}px` }}
                                            title={`${item.label} (line ${item.line})`}
                                        >
                                            <span
                                                onClick={(event) => {
                                                    event.stopPropagation()
                                                    handleOutlineToggle(item)
                                                }}
                                                className={cn(
                                                    'inline-flex size-4 shrink-0 items-center justify-center rounded text-white/45',
                                                    canExpand ? 'hover:bg-white/[0.06] hover:text-white/80' : 'pointer-events-none opacity-0'
                                                )}
                                            >
                                                {canExpand ? (
                                                    isExpanded ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />
                                                ) : (
                                                    <ChevronRight className="size-3.5" />
                                                )}
                                            </span>
                                            <span className={cn('size-2.5 shrink-0 rounded-full', kindStyle.dot, kindStyle.glow)} />
                                            <span className="min-w-0 flex-1 truncate text-white/82">{item.label}</span>
                                            <span className="shrink-0 text-[10px] text-white/35">:{item.line}</span>
                                        </button>
                                    )
                                })}
                            </div>
                        ) : (
                            <div className="rounded-xl border border-dashed border-white/[0.08] bg-white/[0.03] px-3 py-4 text-[11px] text-white/45">
                                No structure.
                            </div>
                        )}
                    </div>
                </div>

                <div
                    className={cn(
                        'absolute inset-0 flex min-h-0 flex-col transition-[opacity,transform] duration-180 ease-out',
                        activeTab === 'folder'
                            ? 'translate-x-0 opacity-100'
                            : 'translate-x-2 pointer-events-none opacity-0'
                    )}
                >
                    <div className="border-b border-white/[0.05] px-3 py-2">
                        <div
                            className="group flex min-w-0 items-center gap-2"
                            onDoubleClick={() => { void reload() }}
                            title={activeFolderPath ? `${activeFolderPath}\nDouble-click to refresh` : 'No folder context'}
                        >
                            <div className="min-w-0 flex-1 truncate text-[11px] text-white/55">
                                {activeFolderPath || 'No folder context'}
                            </div>
                            <button
                                type="button"
                                onClick={(event) => {
                                    event.stopPropagation()
                                    void handleCopyFolderPath()
                                }}
                                className={cn(
                                    'inline-flex size-6 shrink-0 items-center justify-center rounded-md text-white/35 opacity-0 transition-all group-hover:opacity-100 hover:bg-white/[0.06] hover:text-white',
                                    copiedPath && 'opacity-100 text-emerald-300'
                                )}
                                title={copiedPath ? 'Copied' : 'Copy path'}
                            >
                                {copiedPath ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                            </button>
                        </div>
                    </div>

                    <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto px-2 py-2">
                        {folderError ? (
                            <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-3 text-[11px] text-red-200">
                                <div className="flex items-center gap-2">
                                    <AlertCircle className="size-3.5 shrink-0" />
                                    <span className="truncate">{folderError}</span>
                                </div>
                            </div>
                        ) : folderLoading && visibleFolderNodes.length === 0 ? (
                            <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-4 text-[11px] text-white/45">
                                Loading current folder...
                            </div>
                        ) : visibleFolderNodes.length > 0 ? (
                            <div className="space-y-0.5">
                                {visibleFolderNodes.map(({ node, depth, expanded }) => {
                                    const isDirectory = node.type === 'directory'
                                    const nodeKey = normalizePathKey(node.path)
                                    const isActiveFile = !isDirectory && nodeKey === activeFileKey
                                    const extension = getFileExtension(node.name)
                                    const previewTarget = !isDirectory ? resolvePreviewType(node.name, extension) : null
                                    const isPreviewable = Boolean(previewTarget)

                                    if (!isDirectory) {
                                        return (
                                            <DraggablePreviewFileRow
                                                key={node.path}
                                                node={node}
                                                depth={depth}
                                                isActiveFile={isActiveFile}
                                                isPreviewable={isPreviewable}
                                                iconTheme={iconTheme}
                                                onOpen={() => { void handleFolderFileOpen(node) }}
                                            />
                                        )
                                    }

                                    return (
                                        <button
                                            key={node.path}
                                            type="button"
                                            onClick={() => {
                                                if (isDirectory) {
                                                    void toggleDirectory(node)
                                                    return
                                                }
                                                void handleFolderFileOpen(node)
                                            }}
                                            className={cn(
                                                'flex w-full items-center gap-2 rounded-lg border px-2 py-1.5 text-left text-[11px] transition-colors',
                                                isActiveFile
                                                    ? 'border-sky-400/30 bg-sky-500/10 text-sky-100'
                                                    : 'border-transparent text-white/78 hover:border-white/[0.08] hover:bg-white/[0.05]',
                                                !isDirectory && !isPreviewable && 'text-white/45'
                                            )}
                                            style={{ paddingLeft: `${8 + depth * 16}px` }}
                                            title={node.path}
                                        >
                                            <span className={cn(
                                                'inline-flex size-4 shrink-0 items-center justify-center rounded text-white/45',
                                                isDirectory ? 'hover:bg-white/[0.06] hover:text-white/80' : 'opacity-0'
                                            )}>
                                                {isDirectory
                                                    ? (expanded ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />)
                                                    : <ChevronRight className="size-3.5" />}
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
                                })}
                            </div>
                        ) : (
                            <div className="rounded-xl border border-dashed border-white/[0.08] bg-white/[0.03] px-3 py-4 text-[11px] text-white/45">
                                No sibling files found in this folder.
                            </div>
                        )}
                    </div>
                    <div className="border-t border-white/[0.06] bg-[#0b1118]/92">
                        <div className="grid grid-cols-3">
                            <button
                                type="button"
                                onClick={navigateUpFolder}
                                disabled={!canNavigateUpFolder}
                                className={cn(
                                    'inline-flex items-center justify-center gap-1.5 border-r border-white/[0.08] px-2 py-2.5 text-[11px] font-medium transition-colors',
                                    canNavigateUpFolder
                                        ? 'text-white/70 hover:bg-white/[0.05] hover:text-white'
                                        : 'cursor-not-allowed text-white/25'
                                )}
                                title="Go up one folder"
                            >
                                <ChevronUp className="size-3.5" />
                                <span>Up</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => { void openHistoryFile(fileHistoryIndex - 1) }}
                                disabled={!canGoToPreviousFile}
                                className={cn(
                                    'inline-flex items-center justify-center gap-1.5 border-r border-white/[0.08] px-2 py-2.5 text-[11px] font-medium transition-colors',
                                    canGoToPreviousFile
                                        ? 'text-white/70 hover:bg-white/[0.05] hover:text-white'
                                        : 'cursor-not-allowed text-white/25'
                                )}
                                title="Previous file in preview history"
                            >
                                <ChevronLeft className="size-3.5" />
                                <span>Prev</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => { void openHistoryFile(fileHistoryIndex + 1) }}
                                disabled={!canGoToNextFile}
                                className={cn(
                                    'inline-flex items-center justify-center gap-1.5 px-2 py-2.5 text-[11px] font-medium transition-colors',
                                    canGoToNextFile
                                        ? 'text-white/70 hover:bg-white/[0.05] hover:text-white'
                                        : 'cursor-not-allowed text-white/25'
                                )}
                                title="Next file in preview history"
                            >
                                <span>Next</span>
                                <ChevronRight className="size-3.5" />
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
