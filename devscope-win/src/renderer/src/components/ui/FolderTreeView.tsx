/**
 * DevScope - Folder Tree View Component
 * Collapsible file explorer tree for project structure
 */

import { useState, useCallback, useEffect } from 'react'
import {
    ChevronRight, ChevronDown, Folder, FolderOpen,
    File, FileCode, FileJson, FileText, Image,
    Settings, Package, Lock, Eye, EyeOff, ChevronsDownUp, ChevronsUpDown
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface FileTreeNode {
    name: string
    path: string
    type: 'file' | 'directory'
    size?: number
    children?: FileTreeNode[]
    isHidden: boolean
    gitStatus?: 'modified' | 'untracked' | 'added' | 'deleted' | 'renamed' | 'ignored' | 'unknown'
}

interface FolderTreeViewProps {
    tree: FileTreeNode[]
    showHidden?: boolean
    onToggleHidden?: (show: boolean) => void
    onFileClick?: (node: FileTreeNode) => void
    onFolderClick?: (node: FileTreeNode) => void
    maxHeight?: string
    className?: string
}

// Get appropriate file icon based on extension
function getFileIcon(fileName: string) {
    const ext = fileName.split('.').pop()?.toLowerCase()

    switch (ext) {
        case 'json':
            return FileJson
        case 'md':
        case 'txt':
        case 'readme':
            return FileText
        case 'ts':
        case 'tsx':
        case 'js':
        case 'jsx':
        case 'py':
        case 'rs':
        case 'go':
        case 'java':
        case 'cs':
        case 'cpp':
        case 'c':
        case 'h':
            return FileCode
        case 'png':
        case 'jpg':
        case 'jpeg':
        case 'gif':
        case 'svg':
        case 'webp':
        case 'ico':
            return Image
        case 'lock':
            return Lock
        case 'config':
        case 'cfg':
        case 'ini':
        case 'yaml':
        case 'yml':
        case 'toml':
            return Settings
        default:
            // Special file names
            if (fileName === 'package.json') return Package
            if (fileName.startsWith('.')) return Settings
            return File
    }
}

// Get file color based on extension
function getFileColor(fileName: string, gitStatus?: string) {
    if (gitStatus) {
        switch (gitStatus) {
            case 'modified': return '#E2C08D' // Yellow/Orange
            case 'untracked': return '#73C991' // Green
            case 'added': return '#73C991' // Green
            case 'deleted': return '#FF6B6B' // Red
            case 'renamed': return '#9D7CD8' // Purple
            case 'ignored': return '#6B7280' // Gray
        }
    }

    const ext = fileName.split('.').pop()?.toLowerCase()

    switch (ext) {
        case 'ts':
        case 'tsx':
            return '#3178C6' // TypeScript blue
        case 'js':
        case 'jsx':
            return '#F7DF1E' // JavaScript yellow
        case 'json':
            return '#CBCB41' // JSON yellow
        case 'py':
            return '#3776AB' // Python blue
        case 'rs':
            return '#DEA584' // Rust orange
        case 'go':
            return '#00ADD8' // Go cyan
        case 'md':
            return '#083FA1' // Markdown blue
        case 'css':
        case 'scss':
        case 'sass':
            return '#264DE4' // CSS blue
        case 'html':
            return '#E34F26' // HTML orange
        default:
            return '#9CA3AF' // Gray
    }
}

// Format file size
function formatSize(bytes?: number): string {
    if (!bytes) return ''
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

// Tree node component
interface TreeNodeProps {
    node: FileTreeNode
    depth: number
    defaultExpanded?: boolean
    onFileClick?: (node: FileTreeNode) => void
    onFolderClick?: (node: FileTreeNode) => void
}

function TreeNode({ node, depth, defaultExpanded = false, onFileClick, onFolderClick }: TreeNodeProps) {
    const [expanded, setExpanded] = useState(defaultExpanded)

    const toggleExpand = useCallback(() => {
        setExpanded(prev => !prev)
        if (node.type === 'directory' && onFolderClick) {
            onFolderClick(node)
        }
    }, [node, onFolderClick])

    const handleClick = useCallback(() => {
        if (node.type === 'file' && onFileClick) {
            onFileClick(node)
        } else {
            toggleExpand()
        }
    }, [node, onFileClick, toggleExpand])

    const isFolder = node.type === 'directory'
    const FileIcon = isFolder ? (expanded ? FolderOpen : Folder) : getFileIcon(node.name)
    const fileColor = isFolder ? '#60A5FA' : getFileColor(node.name, node.gitStatus)

    return (
        <div>
            <div
                className={cn(
                    "group flex items-center gap-1.5 py-1 px-2 rounded-md cursor-pointer transition-colors",
                    "hover:bg-white/5",
                    node.isHidden && "opacity-50"
                )}
                style={{ paddingLeft: `${depth * 16 + 8}px` }}
                onClick={handleClick}
            >
                {/* Expand/collapse icon for folders */}
                {isFolder ? (
                    <button
                        onClick={(e) => { e.stopPropagation(); toggleExpand() }}
                        className="p-0.5 -ml-1 text-white/40 hover:text-white/70 transition-colors"
                    >
                        {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    </button>
                ) : (
                    <span className="w-[18px]" /> // Spacer for files
                )}

                {/* File/folder icon */}
                <FileIcon
                    size={16}
                    style={{ color: fileColor }}
                    className="flex-shrink-0"
                />

                {/* Name */}
                <span className={cn(
                    "text-sm flex-1 truncate",
                    isFolder ? "text-white font-medium" : "text-white/80",
                    node.gitStatus === 'modified' && "text-[#E2C08D]",
                    node.gitStatus === 'untracked' && "text-[#73C991]",
                    node.gitStatus === 'added' && "text-[#73C991]",
                    node.gitStatus === 'deleted' && "text-[#FF6B6B] line-through",
                    node.gitStatus === 'ignored' && "text-white/30"
                )}>
                    {node.name}
                </span>

                {/* Git Status Badge */}
                {node.gitStatus && (
                    <span className={cn(
                        "text-[9px] px-1 rounded uppercase font-bold mr-1",
                        node.gitStatus === 'modified' && "text-[#E2C08D] bg-[#E2C08D]/10",
                        node.gitStatus === 'untracked' && "text-[#73C991] bg-[#73C991]/10",
                        node.gitStatus === 'added' && "text-[#73C991] bg-[#73C991]/10",
                        node.gitStatus === 'ignored' && "hidden"
                    )}>
                        {node.gitStatus === 'modified' ? 'M' :
                            node.gitStatus === 'untracked' ? 'U' :
                                node.gitStatus === 'added' ? 'A' : ''}
                    </span>
                )}

                {/* File size (for files) */}
                {!isFolder && node.size && (
                    <span className="text-[10px] text-white/30 group-hover:text-white/50">
                        {formatSize(node.size)}
                    </span>
                )}
            </div>

            {/* Children (for expanded folders) */}
            {isFolder && expanded && node.children && node.children.length > 0 && (
                <div className="relative">
                    {/* Vertical guide line */}
                    <div
                        className="absolute left-0 top-0 bottom-0 w-px bg-white/10"
                        style={{ marginLeft: `${depth * 16 + 16}px` }}
                    />
                    {node.children.map((child, index) => (
                        <TreeNode
                            key={child.path || `${child.name}-${index}`}
                            node={child}
                            depth={depth + 1}
                            defaultExpanded={defaultExpanded}
                            onFileClick={onFileClick}
                            onFolderClick={onFolderClick}
                        />
                    ))}
                </div>
            )}
        </div>
    )
}

export default function FolderTreeView({
    tree,
    showHidden = false,
    onToggleHidden,
    onFileClick,
    onFolderClick,
    maxHeight = '400px',
    className
}: FolderTreeViewProps) {
    const [hiddenVisible, setHiddenVisible] = useState(showHidden)
    const [searchTerm, setSearchTerm] = useState('')
    const [treeKey, setTreeKey] = useState(0) // Used to force re-render for collapse/expand
    const [isExpanded, setIsExpanded] = useState(false) // Track expand/collapse state

    useEffect(() => {
        setHiddenVisible(showHidden)
    }, [showHidden])

    const handleToggleHidden = () => {
        const newValue = !hiddenVisible
        setHiddenVisible(newValue)
        onToggleHidden?.(newValue)
    }

    const handleToggleExpandCollapse = () => {
        setIsExpanded(prev => !prev)
        setTreeKey(prev => prev + 1)
    }

    // Filter tree based on hidden status and search term
    const filterTree = useCallback((nodes: FileTreeNode[]): FileTreeNode[] => {
        return nodes
            .filter(node => {
                if (!hiddenVisible && node.isHidden) return false
                // If search is active, keep if name matches OR if children match
                if (!searchTerm) return true

                const matchesName = node.name.toLowerCase().includes(searchTerm.toLowerCase())
                const hasMatchingChildren = node.children && filterTree(node.children).length > 0

                return matchesName || hasMatchingChildren
            })
            .map(node => {
                // If we are searching, we need to return a new object to avoid mutating original
                // We also might need to filter children again for the mapped structure
                if (searchTerm && node.children) {
                    return {
                        ...node,
                        children: filterTree(node.children)
                    }
                }
                return node
            })
    }, [hiddenVisible, searchTerm])

    const filteredTree = filterTree(tree)
    const isSearching = searchTerm.length > 0

    return (
        <div className={cn("bg-sparkle-bg/50 rounded-xl border border-white/5 flex flex-col", className)}>
            {/* Header */}
            <div className="flex flex-col gap-2 p-3 border-b border-white/5">
                <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-white/50 uppercase tracking-wide">
                        File Structure
                    </span>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleToggleExpandCollapse}
                            className={cn(
                                "p-1.5 rounded-md transition-colors",
                                isExpanded
                                    ? "text-white/70 bg-white/10"
                                    : "text-white/40 hover:text-white hover:bg-white/5"
                            )}
                            title={isExpanded ? "Collapse All Folders" : "Expand All Folders"}
                        >
                            {isExpanded ? <ChevronsDownUp size={14} /> : <ChevronsUpDown size={14} />}
                        </button>
                        <button
                            onClick={handleToggleHidden}
                            className={cn(
                                "p-1.5 text-xs rounded-md transition-colors",
                                hiddenVisible
                                    ? "text-white/70 bg-white/10"
                                    : "text-white/40 hover:text-white hover:bg-white/5"
                            )}
                            title={hiddenVisible ? "Hide System Files" : "Show System Files"}
                        >
                            {hiddenVisible ? <Eye size={14} /> : <EyeOff size={14} />}
                        </button>
                    </div>
                </div>

                {/* Search Bar */}
                <div className="relative">
                    <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="Search files..."
                        className="w-full bg-black/20 border border-white/5 rounded-lg px-3 py-1.5 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-white/10 transition-colors"
                    />
                </div>
            </div>

            {/* Tree */}
            <div
                className="p-2 overflow-y-auto flex-1 custom-scrollbar"
                style={{ maxHeight }}
            >
                {filteredTree.length > 0 ? (
                    filteredTree.map((node, index) => (
                        <TreeNode
                            key={`${treeKey}-${node.path || node.name}-${index}`}
                            node={node}
                            depth={0}
                            // Expand based on toggle state or when searching
                            defaultExpanded={isExpanded || isSearching}
                            onFileClick={onFileClick}
                            onFolderClick={onFolderClick}
                        />
                    ))
                ) : (
                    <div className="flex items-center justify-center py-8 text-white/30 text-sm">
                        {searchTerm ? 'No matching files' : 'No files to display'}
                    </div>
                )}
            </div>
        </div>
    )
}
