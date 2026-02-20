import { useDeferredValue, useMemo } from 'react'
import { parseFileSearchQuery } from '@/lib/utils'
import { buildFileSearchIndex, searchFileIndex } from '@/lib/fileSearchIndex'
import { buildDirectoryChildInfoMap, getAllFolderPaths } from './fileTreeUtils'
import type { FileTreeNode } from './types'

export interface FlatFileItem {
    node: FileTreeNode
    depth: number
    isExpanded: boolean
    isFolder: boolean
    ext: string
    isPreviewable: boolean
    childInfo: { files: number; folders: number } | null
}

interface UseProjectFileViewParams {
    fileTree: FileTreeNode[]
    gitStatusMap: Record<string, FileTreeNode['gitStatus']>
    showHidden: boolean
    sortBy: 'name' | 'size' | 'type'
    sortAsc: boolean
    fileSearch: string
    expandedFolders: Set<string>
    previewableExtensions: Set<string>
    previewableFileNames: Set<string>
}

export function useProjectFileView({
    fileTree,
    gitStatusMap,
    showHidden,
    sortBy,
    sortAsc,
    fileSearch,
    expandedFolders,
    previewableExtensions,
    previewableFileNames
}: UseProjectFileViewParams) {
    const changedFiles = useMemo(() => {
        const byPath = new Map<string, FileTreeNode>()

        for (const [rawPath, status] of Object.entries(gitStatusMap)) {
            if (!status || status === 'ignored' || status === 'unknown') continue

            const normalizedPath = rawPath.replace(/\\/g, '/').replace(/^\.\//, '')
            const dedupeKey = normalizedPath.toLowerCase()
            if (byPath.has(dedupeKey)) continue

            const segments = normalizedPath.split('/').filter(Boolean)
            const name = segments[segments.length - 1] || normalizedPath

            byPath.set(dedupeKey, {
                name,
                path: normalizedPath,
                type: 'file',
                isHidden: name.startsWith('.'),
                gitStatus: status
            })
        }

        return Array.from(byPath.values()).sort((a, b) => a.path.localeCompare(b.path))
    }, [gitStatusMap])

    const allFolderPathsSet = useMemo(() => new Set(getAllFolderPaths(fileTree)), [fileTree])
    const deferredFileSearch = useDeferredValue(fileSearch)
    const parsedFileSearch = useMemo(() => parseFileSearchQuery(deferredFileSearch), [deferredFileSearch])
    const hasFileSearch = deferredFileSearch.trim().length > 0
    const fileSearchIndex = useMemo(() => buildFileSearchIndex(fileTree), [fileTree])
    const folderChildInfoMap = useMemo(() => buildDirectoryChildInfoMap(fileTree), [fileTree])

    const indexedSearch = useMemo(() => {
        if (!hasFileSearch) return null
        return searchFileIndex(fileSearchIndex, parsedFileSearch, {
            showHidden,
            includeDirectories: true
        })
    }, [hasFileSearch, fileSearchIndex, parsedFileSearch, showHidden])

    const searchExpandedFolders = useMemo(() => {
        if (!indexedSearch) return new Set<string>()
        return indexedSearch.expandedFolderPathSet
    }, [indexedSearch])

    const effectiveExpandedFolders = useMemo(() => {
        if (hasFileSearch) {
            return new Set([...expandedFolders, ...searchExpandedFolders])
        }
        return expandedFolders
    }, [expandedFolders, searchExpandedFolders, hasFileSearch])

    const visibleFileList = useMemo((): FlatFileItem[] => {
        const result: FlatFileItem[] = []
        const searchVisiblePaths = indexedSearch?.visiblePathSet

        const processNodes = (nodes: FileTreeNode[], depth: number) => {
            const filtered = nodes
                .filter((node) => showHidden || !node.isHidden)
                .filter((node) => !hasFileSearch || Boolean(searchVisiblePaths?.has(node.path)))
                .sort((a, b) => {
                    if (a.type !== b.type) return a.type === 'directory' ? -1 : 1
                    if (sortBy === 'name') return sortAsc ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name)
                    if (sortBy === 'size') return sortAsc ? (a.size || 0) - (b.size || 0) : (b.size || 0) - (a.size || 0)
                    const extA = a.name.split('.').pop() || ''
                    const extB = b.name.split('.').pop() || ''
                    return sortAsc ? extA.localeCompare(extB) : extB.localeCompare(extA)
                })

            for (const node of filtered) {
                const isFolder = node.type === 'directory'
                const ext = node.name.split('.').pop()?.toLowerCase() || ''
                const isPreviewable = previewableExtensions.has(ext) || previewableFileNames.has(node.name.toLowerCase())
                const childInfo = isFolder ? (folderChildInfoMap.get(node.path) || null) : null
                const isExpanded = effectiveExpandedFolders.has(node.path)

                result.push({ node, depth, isExpanded, isFolder, ext, isPreviewable, childInfo })

                if (isFolder && isExpanded && node.children) {
                    processNodes(node.children, depth + 1)
                }
            }
        }

        processNodes(fileTree, 0)
        return result
    }, [
        fileTree,
        showHidden,
        hasFileSearch,
        indexedSearch,
        sortBy,
        sortAsc,
        effectiveExpandedFolders,
        folderChildInfoMap,
        previewableExtensions,
        previewableFileNames
    ])

    return {
        changedFiles,
        allFolderPathsSet,
        hasFileSearch,
        parsedFileSearch,
        folderChildInfoMap,
        effectiveExpandedFolders,
        visibleFileList
    }
}
