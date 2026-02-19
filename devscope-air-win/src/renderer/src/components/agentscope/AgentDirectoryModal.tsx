/**
 * AgentDirectoryModal - choose working directory for an agent session
 */

import { useEffect, useMemo, useState } from 'react'
import { X, FolderOpen, ArrowUp, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'
import FolderTreeView from '@/components/ui/FolderTreeView'

interface FileTreeNode {
    name: string
    path: string
    type: 'file' | 'directory'
    size?: number
    children?: FileTreeNode[]
    isHidden: boolean
    gitStatus?: 'modified' | 'untracked' | 'added' | 'deleted' | 'renamed' | 'ignored' | 'unknown'
}

interface AgentDirectoryModalProps {
    isOpen: boolean
    onClose: () => void
    onConfirm: (path: string) => void
    initialPath?: string
}

function getParentPath(path: string): string {
    if (!path) return path
    const normalized = path.replace(/\\/g, '/')
    const parts = normalized.split('/').filter(Boolean)
    if (parts.length <= 1) {
        return path
    }
    const parentParts = parts.slice(0, -1)
    const parent = normalized.startsWith('/') ? `/${parentParts.join('/')}` : `${parentParts.join('/')}`
    return path.includes('\\') ? parent.replace(/\//g, '\\') : parent
}

function buildBreadcrumbs(path: string) {
    if (!path) return []
    const normalized = path.replace(/\\/g, '/')
    const parts = normalized.split('/').filter(Boolean)
    const crumbs: { label: string; value: string }[] = []

    parts.forEach((part, index) => {
        const prefix = normalized.startsWith('/') ? '/' : ''
        const value = prefix + parts.slice(0, index + 1).join('/')
        crumbs.push({
            label: index === 0 && part.endsWith(':') ? part + '/' : part,
            value: path.includes('\\') ? value.replace(/\//g, '\\') : value
        })
    })
    return crumbs
}

function filterDirectories(nodes: FileTreeNode[]): FileTreeNode[] {
    return nodes
        .filter(node => node.type === 'directory')
        .map(node => ({
            ...node,
            children: node.children ? filterDirectories(node.children) : []
        }))
}

export default function AgentDirectoryModal({
    isOpen,
    onClose,
    onConfirm,
    initialPath
}: AgentDirectoryModalProps) {
    const [roots, setRoots] = useState<string[]>([])
    const [currentPath, setCurrentPath] = useState('')
    const [selectedPath, setSelectedPath] = useState('')
    const [tree, setTree] = useState<FileTreeNode[]>([])
    const [showHidden, setShowHidden] = useState(false)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const breadcrumbs = useMemo(() => buildBreadcrumbs(currentPath), [currentPath])
    const directoryTree = useMemo(() => filterDirectories(tree), [tree])

    const loadRoots = async () => {
        try {
            const result = await window.devscope.getFileSystemRoots()
            if (result?.success && result.roots?.length) {
                setRoots(result.roots)
                return result.roots
            }
        } catch (err) {
            console.error('[AgentDirectoryModal] Failed to load roots:', err)
        }
        return []
    }

    const loadTree = async (path: string, keepSelection = false, hiddenOverride?: boolean) => {
        if (!path) return
        setLoading(true)
        setError(null)
        try {
            const result = await window.devscope.getFileTree(path, {
                showHidden: hiddenOverride ?? showHidden,
                maxDepth: 2
            })
            if (result.success && result.tree) {
                setTree(result.tree)
                setCurrentPath(path)
                if (!keepSelection) {
                    setSelectedPath(path)
                }
            } else {
                setError(result.error || 'Failed to read directory')
            }
        } catch (err: any) {
            setError(err.message || 'Failed to read directory')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        if (!isOpen) return
        let isMounted = true
        const init = async () => {
            const rootList = await loadRoots()
            const initial = initialPath || rootList[0]
            if (!isMounted || !initial) return
            await loadTree(initial)
        }
        init()
        return () => {
            isMounted = false
        }
    }, [isOpen, initialPath])

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
            <div className={cn(
                "relative w-[92vw] max-w-6xl h-[80vh]",
                "bg-sparkle-card border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col"
            )}>
                <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 bg-white/[0.02]">
                    <div>
                        <h2 className="text-sm font-semibold text-white">Choose Working Directory</h2>
                        <p className="text-[10px] text-white/40">Select where this agent will run</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-colors"
                        title="Close"
                    >
                        <X size={16} />
                    </button>
                </div>

                <div className="flex flex-1 min-h-0">
                    <aside className="w-44 border-r border-white/10 bg-black/20 p-3 space-y-2">
                        <div className="text-[10px] uppercase tracking-wider text-white/30">Drives</div>
                        <div className="space-y-1">
                            {roots.map(root => (
                                <button
                                    key={root}
                                    onClick={() => loadTree(root)}
                                    className={cn(
                                        "w-full text-left px-2 py-1.5 rounded-md text-xs font-mono transition-colors",
                                        currentPath.startsWith(root) ? "bg-white/10 text-white" : "text-white/60 hover:text-white hover:bg-white/5"
                                    )}
                                >
                                    {root}
                                </button>
                            ))}
                        </div>
                    </aside>

                    <div className="flex-1 flex flex-col min-h-0">
                        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-black/10">
                            <div className="flex items-center gap-2 min-w-0">
                                <button
                                    onClick={() => loadTree(getParentPath(currentPath), true)}
                                    className="p-1.5 rounded-md text-white/50 hover:text-white hover:bg-white/5 transition-colors"
                                    title="Go up"
                                >
                                    <ArrowUp size={14} />
                                </button>
                                <div className="flex items-center gap-1 text-[11px] text-white/60 truncate">
                                    {breadcrumbs.map((crumb, index) => (
                                        <button
                                            key={`${crumb.value}-${index}`}
                                            onClick={() => loadTree(crumb.value)}
                                            className={cn(
                                                "truncate hover:text-white transition-colors",
                                                index === breadcrumbs.length - 1 && "text-white"
                                            )}
                                        >
                                            {crumb.label}
                                            {index < breadcrumbs.length - 1 ? ' / ' : ''}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <button
                                onClick={() => loadTree(currentPath, true)}
                                className="p-1.5 rounded-md text-white/50 hover:text-white hover:bg-white/5 transition-colors"
                                title="Refresh"
                            >
                                <RefreshCw size={14} />
                            </button>
                        </div>

                        <div className="flex-1 min-h-0 p-3">
                            {loading && (
                                <div className="text-xs text-white/40 py-4">Loading folder...</div>
                            )}
                            {error && (
                                <div className="text-xs text-rose-300 py-4">{error}</div>
                            )}
                            {!loading && !error && (
                                <FolderTreeView
                                    tree={directoryTree}
                                    showHidden={showHidden}
                                    onToggleHidden={(next) => {
                                        setShowHidden(next)
                                        loadTree(currentPath, true, next)
                                    }}
                                    onFolderClick={(node) => setSelectedPath(node.path)}
                                    maxHeight="100%"
                                    className="h-full"
                                />
                            )}
                        </div>
                    </div>
                </div>

                <div className="flex items-center justify-between px-5 py-3 border-t border-white/10 bg-white/[0.02]">
                    <div className="text-[10px] text-white/40 truncate">
                        Selected: <span className="text-white/70">{selectedPath || currentPath}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => selectedPath && loadTree(selectedPath, true)}
                            className="px-3 py-1.5 rounded-lg text-xs bg-white/5 text-white/60 hover:text-white hover:bg-white/10 transition-colors"
                            disabled={!selectedPath || selectedPath === currentPath}
                        >
                            <FolderOpen size={12} className="inline-block mr-1" />
                            Open
                        </button>
                        <button
                            onClick={() => onConfirm(selectedPath || currentPath)}
                            className="px-4 py-1.5 rounded-lg text-xs bg-[var(--accent-primary)] text-white hover:bg-[var(--accent-primary)]/80 transition-colors"
                            disabled={!selectedPath && !currentPath}
                        >
                            Use Folder
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}

