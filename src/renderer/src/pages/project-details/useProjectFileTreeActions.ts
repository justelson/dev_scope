import { useCallback, useEffect, useRef } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import { getAllFolderPaths } from './fileTreeUtils'
import type { FileTreeNode } from './types'
import {
    getFileExtensionFromName,
    getParentFolderPath,
    normalizeFileSystemPath,
    splitFileNameForRename,
    validateCreateName
} from './projectDetailsPageHelpers'

type UseProjectFileTreeActionsParams = {
    activeTab: 'readme' | 'files' | 'git'
    loadingFiles: boolean
    projectRootPath: string
    fileSearch: string
    fileTreeFullyLoaded: boolean
    refreshFileTree: (options?: { deep?: boolean; targetPath?: string }) => Promise<FileTreeNode[] | undefined>
    expandedFolders: Set<string>
    setExpandedFolders: Dispatch<SetStateAction<Set<string>>>
    setLoadingFolderPaths: Dispatch<SetStateAction<Set<string>>>
    setIsExpandingFolders: Dispatch<SetStateAction<boolean>>
    fileTree: FileTreeNode[]
    setFileTree: Dispatch<SetStateAction<FileTreeNode[]>>
    openFile: (path: string) => Promise<void>
    openPreview: (
        file: { name: string; path: string },
        ext: string,
        options?: { startInEditMode?: boolean }
    ) => Promise<void>
    showToast: (message: string, actionLabel?: string, actionTo?: string, tone?: 'success' | 'error' | 'info') => void
    fileClipboardItem: { path: string; name: string; type: 'file' | 'directory' } | null
    setFileClipboardItem: Dispatch<SetStateAction<{ path: string; name: string; type: 'file' | 'directory' } | null>>
    setRenameTarget: Dispatch<SetStateAction<FileTreeNode | null>>
    setRenameDraft: Dispatch<SetStateAction<string>>
    setRenameExtensionSuffix: Dispatch<SetStateAction<string>>
    setRenameErrorMessage: Dispatch<SetStateAction<string | null>>
    setCreateTarget: Dispatch<SetStateAction<{ destinationDirectory: string; type: 'file' | 'directory'; presetExtension?: string } | null>>
    setCreateDraft: Dispatch<SetStateAction<string>>
    setCreateErrorMessage: Dispatch<SetStateAction<string | null>>
    setDeleteTarget: Dispatch<SetStateAction<FileTreeNode | null>>
    createTarget: { destinationDirectory: string; type: 'file' | 'directory'; presetExtension?: string } | null
    createDraft: string
    setCreateDraftState: Dispatch<SetStateAction<string>>
    renameTarget: FileTreeNode | null
    renameDraft: string
    renameExtensionSuffix: string
    deleteTarget: FileTreeNode | null
}

function pathsMatch(left: string, right: string): boolean {
    return normalizeFileSystemPath(left) === normalizeFileSystemPath(right)
}

function resolvePathSeparator(pathValue: string): string {
    return pathValue.includes('\\') ? '\\' : '/'
}

function joinFileSystemPath(directory: string, name: string): string {
    const rawDir = String(directory || '')
    const separator = resolvePathSeparator(rawDir)
    const trimmed = rawDir.replace(/[\\/]+$/, '')
    if (!trimmed) {
        return `${separator}${name}`
    }
    return `${trimmed}${separator}${name}`
}

function replacePathPrefix(pathValue: string, oldPrefix: string, newPrefix: string): string {
    if (pathValue === oldPrefix) return newPrefix
    if (pathValue.startsWith(oldPrefix)) {
        return `${newPrefix}${pathValue.slice(oldPrefix.length)}`
    }
    return pathValue
}

function updateNodePathPrefix(node: FileTreeNode, oldPrefix: string, newPrefix: string): FileTreeNode {
    const nextPath = replacePathPrefix(node.path, oldPrefix, newPrefix)
    const nextChildren = node.children
        ? node.children.map((child) => updateNodePathPrefix(child, oldPrefix, newPrefix))
        : node.children

    if (nextPath === node.path && nextChildren === node.children) return node
    return {
        ...node,
        path: nextPath,
        children: nextChildren
    }
}

function extractNodeByPath(
    nodes: FileTreeNode[],
    targetPath: string
): { nodes: FileTreeNode[]; removed: FileTreeNode | null } {
    let removed: FileTreeNode | null = null
    let changed = false

    const nextNodes = nodes.reduce<FileTreeNode[]>((acc, node) => {
        if (pathsMatch(node.path, targetPath)) {
            removed = node
            changed = true
            return acc
        }

        if (node.type === 'directory' && node.children) {
            const result = extractNodeByPath(node.children, targetPath)
            if (result.removed) {
                removed = result.removed
            }
            if (result.nodes !== node.children) {
                changed = true
                acc.push({ ...node, children: result.nodes })
                return acc
            }
        }

        acc.push(node)
        return acc
    }, [])

    return {
        nodes: changed ? nextNodes : nodes,
        removed
    }
}

function insertNodeAtDirectory(
    nodes: FileTreeNode[],
    destinationDirectory: string,
    nodeToInsert: FileTreeNode,
    projectRootPath: string
): { nodes: FileTreeNode[]; inserted: boolean } {
    if (projectRootPath && pathsMatch(destinationDirectory, projectRootPath)) {
        if (nodes.some((node) => pathsMatch(node.path, nodeToInsert.path))) {
            return { nodes, inserted: false }
        }
        return { nodes: [...nodes, nodeToInsert], inserted: true }
    }

    let inserted = false

    const visit = (items: FileTreeNode[]): FileTreeNode[] => {
        let localChanged = false
        const nextItems = items.map((node) => {
            if (node.type !== 'directory') return node

            if (pathsMatch(node.path, destinationDirectory)) {
                const children = node.children ? [...node.children] : []
                if (!children.some((child) => pathsMatch(child.path, nodeToInsert.path))) {
                    children.push(nodeToInsert)
                    inserted = true
                    localChanged = true
                    const nextNode: FileTreeNode = {
                        ...node,
                        children
                    }
                    if (node.childrenLoaded === false) {
                        nextNode.childrenLoaded = false
                    }
                    return nextNode
                }
            }

            if (node.children) {
                const nextChildren = visit(node.children)
                if (nextChildren !== node.children) {
                    localChanged = true
                    return { ...node, children: nextChildren }
                }
            }

            return node
        })

        return localChanged ? nextItems : items
    }

    const nextNodes = visit(nodes)
    return { nodes: inserted ? nextNodes : nodes, inserted }
}

function renameNodeByPath(
    nodes: FileTreeNode[],
    targetPath: string,
    nextName: string,
    nextPath: string
): FileTreeNode[] {
    let changed = false

    const visit = (items: FileTreeNode[]): FileTreeNode[] => {
        let localChanged = false
        const nextItems = items.map((node) => {
            if (pathsMatch(node.path, targetPath)) {
                const updatedNode = updateNodePathPrefix(node, node.path, nextPath)
                localChanged = true
                changed = true
                return {
                    ...updatedNode,
                    name: nextName
                }
            }

            if (node.type === 'directory' && node.children) {
                const nextChildren = visit(node.children)
                if (nextChildren !== node.children) {
                    localChanged = true
                    return { ...node, children: nextChildren }
                }
            }

            return node
        })

        return localChanged ? nextItems : items
    }

    const nextNodes = visit(nodes)
    return changed ? nextNodes : nodes
}

function buildCopyName(sourceName: string, copyIndex: number): string {
    if (copyIndex <= 0) return sourceName
    const dotIndex = sourceName.lastIndexOf('.')
    const base = dotIndex > 0 ? sourceName.slice(0, dotIndex) : sourceName
    const ext = dotIndex > 0 ? sourceName.slice(dotIndex) : ''
    const suffix = copyIndex === 1 ? ' Copy' : ` Copy ${copyIndex}`
    return `${base}${suffix}${ext}`
}

function findDirectoryNode(nodes: FileTreeNode[], targetPath: string): FileTreeNode | null {
    for (const node of nodes) {
        if (node.type !== 'directory') continue
        if (pathsMatch(node.path, targetPath)) return node
        if (node.children) {
            const found = findDirectoryNode(node.children, targetPath)
            if (found) return found
        }
    }
    return null
}

function resolveOptimisticCopyName(
    sourceName: string,
    destinationDirectory: string,
    tree: FileTreeNode[],
    projectRootPath: string
): string {
    const targetChildren = projectRootPath && pathsMatch(destinationDirectory, projectRootPath)
        ? tree
        : findDirectoryNode(tree, destinationDirectory)?.children

    if (!targetChildren) return sourceName

    const existingNames = new Set(targetChildren.map((child) => child.name.toLowerCase()))
    for (let copyIndex = 0; copyIndex < 1000; copyIndex += 1) {
        const candidate = buildCopyName(sourceName, copyIndex)
        if (!existingNames.has(candidate.toLowerCase())) {
            return candidate
        }
    }

    return sourceName
}

export function useProjectFileTreeActions({
    activeTab,
    loadingFiles,
    projectRootPath,
    fileSearch,
    fileTreeFullyLoaded,
    refreshFileTree,
    expandedFolders,
    setExpandedFolders,
    setLoadingFolderPaths,
    setIsExpandingFolders,
    fileTree,
    setFileTree,
    openFile,
    openPreview,
    showToast,
    fileClipboardItem,
    setFileClipboardItem,
    setRenameTarget,
    setRenameDraft,
    setRenameExtensionSuffix,
    setRenameErrorMessage,
    setCreateTarget,
    setCreateDraft,
    setCreateErrorMessage,
    setDeleteTarget,
    createTarget,
    createDraft,
    setCreateDraftState,
    renameTarget,
    renameDraft,
    renameExtensionSuffix,
    deleteTarget
}: UseProjectFileTreeActionsParams) {
    const fileTreeRef = useRef(fileTree)

    useEffect(() => {
        fileTreeRef.current = fileTree
    }, [fileTree])

    const applyOptimisticFileTree = useCallback((
        updater: (tree: FileTreeNode[]) => FileTreeNode[]
    ) => {
        const previousTree = fileTreeRef.current
        const nextTree = updater(previousTree)
        if (nextTree !== previousTree) {
            setFileTree(nextTree)
        }
        return previousTree
    }, [setFileTree])

    const refreshVisibleFileTree = useCallback(async (targetPath?: string) => {
        const normalizedTargetPath = String(targetPath || '').trim()
        const shouldDeepRefresh = fileTreeFullyLoaded || fileSearch.trim().length > 0

        if (!projectRootPath || !normalizedTargetPath || normalizedTargetPath === projectRootPath) {
            return refreshFileTree({ deep: shouldDeepRefresh })
        }

        if (shouldDeepRefresh) {
            return refreshFileTree({ deep: true })
        }

        return refreshFileTree({ targetPath: normalizedTargetPath })
    }, [fileSearch, fileTreeFullyLoaded, projectRootPath, refreshFileTree])

    const handleToggleFolder = useCallback(async (node: FileTreeNode) => {
        if (node.type !== 'directory') return

        if (expandedFolders.has(node.path)) {
            setExpandedFolders((prev) => {
                const next = new Set(prev)
                next.delete(node.path)
                return next
            })
            return
        }

        setExpandedFolders((prev) => {
            const next = new Set(prev)
            next.add(node.path)
            return next
        })

        const needsChildren = node.childrenLoaded === false || typeof node.children === 'undefined'
        if (needsChildren) {
            setLoadingFolderPaths((prev) => new Set(prev).add(node.path))
            try {
                await refreshFileTree({ targetPath: node.path })
            } catch (err: any) {
                showToast(err?.message || `Failed to load "${node.name}"`, undefined, undefined, 'error')
                setExpandedFolders((prev) => {
                    const next = new Set(prev)
                    next.delete(node.path)
                    return next
                })
                return
            } finally {
                setLoadingFolderPaths((prev) => {
                    const next = new Set(prev)
                    next.delete(node.path)
                    return next
                })
            }
        }
    }, [expandedFolders, refreshFileTree, setExpandedFolders, setLoadingFolderPaths, showToast])

    const handleToggleAllFolders = useCallback(async () => {
        setIsExpandingFolders(true)
        try {
            if (expandedFolders.size > 0) {
                setExpandedFolders(new Set())
                return
            }

            const nextTree = fileTreeFullyLoaded
                ? fileTree
                : (await refreshFileTree({ deep: true })) || fileTree

            setExpandedFolders(new Set(getAllFolderPaths(nextTree)))
        } finally {
            setIsExpandingFolders(false)
        }
    }, [expandedFolders.size, fileTree, fileTreeFullyLoaded, refreshFileTree, setExpandedFolders, setIsExpandingFolders])

    const handleFileTreeOpen = useCallback(async (node: FileTreeNode) => {
        if (node.type === 'directory') {
            await handleToggleFolder(node)
            return
        }
        await openFile(node.path)
    }, [handleToggleFolder, openFile])

    const handleFileTreeOpenWith = useCallback(async (node: FileTreeNode) => {
        if (node.type === 'directory') return
        const result = await window.devscope.openWith(node.path)
        if (!result.success) {
            showToast(result.error || `Failed to open "${node.name}" with...`, undefined, undefined, 'error')
        }
    }, [showToast])

    const handleFileTreeOpenInExplorer = useCallback(async (node: FileTreeNode) => {
        const result = await window.devscope.openInExplorer(node.path)
        if (!result.success) {
            showToast(result.error || `Failed to open "${node.name}" in explorer`, undefined, undefined, 'error')
        }
    }, [showToast])

    const handleFileTreeCopyPath = useCallback(async (node: FileTreeNode) => {
        try {
            if (window.devscope.copyToClipboard) {
                const result = await window.devscope.copyToClipboard(node.path)
                if (!result.success) {
                    showToast(result.error || 'Failed to copy to clipboard', undefined, undefined, 'error')
                    return
                }
            } else {
                await navigator.clipboard.writeText(node.path)
            }
            showToast(`Copied path: ${node.name}`)
        } catch (err: any) {
            showToast(err?.message || 'Failed to copy to clipboard', undefined, undefined, 'error')
        }
    }, [showToast])

    const handleFileTreeCopy = useCallback((node: FileTreeNode) => {
        setFileClipboardItem({
            path: node.path,
            name: node.name,
            type: node.type
        })
        showToast(`Copied ${node.type === 'directory' ? 'folder' : 'file'}: ${node.name}`)
    }, [setFileClipboardItem, showToast])

    const handleFileTreeRename = useCallback(async (node: FileTreeNode) => {
        const splitName = splitFileNameForRename(node.name)
        setRenameTarget(node)
        setRenameDraft(splitName.baseName)
        setRenameExtensionSuffix(node.type === 'file' ? splitName.extensionSuffix : '')
        setRenameErrorMessage(null)
    }, [setRenameDraft, setRenameErrorMessage, setRenameExtensionSuffix, setRenameTarget])

    const handleFileTreeDelete = useCallback(async (node: FileTreeNode) => {
        setDeleteTarget(node)
    }, [setDeleteTarget])

    const handleFileTreePaste = useCallback(async (node: FileTreeNode) => {
        if (!fileClipboardItem) return

        const destinationDirectory = node.type === 'directory'
            ? node.path
            : getParentFolderPath(node.path)

        if (!destinationDirectory) {
            showToast('Unable to resolve destination folder for paste.', undefined, undefined, 'error')
            return
        }

        const optimisticName = resolveOptimisticCopyName(
            fileClipboardItem.name,
            destinationDirectory,
            fileTreeRef.current,
            projectRootPath
        )
        const optimisticPath = joinFileSystemPath(destinationDirectory, optimisticName)
        const optimisticNode: FileTreeNode = {
            name: optimisticName,
            path: optimisticPath,
            type: fileClipboardItem.type,
            isHidden: optimisticName.startsWith('.'),
            ...(fileClipboardItem.type === 'directory'
                ? { childrenLoaded: false }
                : {})
        }

        const previousTree = applyOptimisticFileTree((currentTree) => {
            const { nodes } = insertNodeAtDirectory(
                currentTree,
                destinationDirectory,
                optimisticNode,
                projectRootPath
            )
            return nodes
        })

        showToast(`Pasting ${fileClipboardItem.name}...`, undefined, undefined, 'info')

        const result = await window.devscope.pasteFileSystemItem(fileClipboardItem.path, destinationDirectory)
        if (!result.success) {
            setFileTree(previousTree)
            showToast(result.error || `Failed to paste "${fileClipboardItem.name}"`, undefined, undefined, 'error')
            return
        }

        if (result.path && result.name && result.path !== optimisticPath) {
            setFileTree((currentTree) => renameNodeByPath(currentTree, optimisticPath, result.name, result.path))
        }

        showToast(`Pasted ${result.name || fileClipboardItem.name}`)
        await refreshVisibleFileTree(destinationDirectory)
    }, [applyOptimisticFileTree, fileClipboardItem, projectRootPath, refreshVisibleFileTree, setFileTree, showToast])

    const handleFileTreeMove = useCallback(async (node: FileTreeNode, destinationDirectory: string) => {
        if (!node?.path || !destinationDirectory) return
        const normalizedDestination = String(destinationDirectory || '').trim()
        if (!normalizedDestination) return

        const sourceParent = getParentFolderPath(node.path)
        if (sourceParent && normalizeFileSystemPath(sourceParent) === normalizeFileSystemPath(normalizedDestination)) {
            return
        }

        const previousTree = applyOptimisticFileTree((currentTree) => {
            const extraction = extractNodeByPath(currentTree, node.path)
            if (!extraction.removed) return currentTree
            const destinationPath = joinFileSystemPath(normalizedDestination, extraction.removed.name)
            const movedNode = updateNodePathPrefix(extraction.removed, extraction.removed.path, destinationPath)
            const insertion = insertNodeAtDirectory(
                extraction.nodes,
                normalizedDestination,
                movedNode,
                projectRootPath
            )
            return insertion.nodes
        })

        showToast(`Moving ${node.name}...`, undefined, undefined, 'info')

        const result = await window.devscope.moveFileSystemItem(node.path, normalizedDestination)
        if (!result.success) {
            setFileTree(previousTree)
            showToast(result.error || `Failed to move "${node.name}"`, undefined, undefined, 'error')
            return
        }

        showToast(`Moved ${node.name}`)
        const sourceParentPath = sourceParent || projectRootPath
        if (sourceParentPath && normalizeFileSystemPath(sourceParentPath) !== normalizeFileSystemPath(normalizedDestination)) {
            await refreshVisibleFileTree(sourceParentPath)
        }
        await refreshVisibleFileTree(normalizedDestination)
    }, [applyOptimisticFileTree, projectRootPath, refreshVisibleFileTree, setFileTree, showToast])

    const resolveCreateDestinationDirectory = useCallback((node?: FileTreeNode): string | null => {
        if (!node) {
            return projectRootPath || null
        }
        if (node.type === 'directory') return node.path
        return getParentFolderPath(node.path)
    }, [projectRootPath])

    const openCreatePrompt = useCallback((destinationDirectory: string, type: 'file' | 'directory', presetExtension?: string) => {
        setCreateTarget({ destinationDirectory, type, presetExtension })
        setCreateDraft('')
        setCreateErrorMessage(null)
    }, [setCreateErrorMessage, setCreateDraft, setCreateTarget])

    const handleFileTreeCreateFile = useCallback((node?: FileTreeNode, presetExtension?: string) => {
        const destinationDirectory = resolveCreateDestinationDirectory(node)
        if (!destinationDirectory) {
            showToast('Unable to resolve destination folder.', undefined, undefined, 'error')
            return
        }
        openCreatePrompt(destinationDirectory, 'file', presetExtension)
    }, [openCreatePrompt, resolveCreateDestinationDirectory, showToast])

    const handleFileTreeCreateFolder = useCallback((node?: FileTreeNode) => {
        const destinationDirectory = resolveCreateDestinationDirectory(node)
        if (!destinationDirectory) {
            showToast('Unable to resolve destination folder.', undefined, undefined, 'error')
            return
        }
        openCreatePrompt(destinationDirectory, 'directory')
    }, [openCreatePrompt, resolveCreateDestinationDirectory, showToast])

    const submitCreateTarget = useCallback(async (nextName?: string) => {
        if (!createTarget) return

        const normalizedName = String(nextName ?? createDraft).trim()
        const validationError = validateCreateName(normalizedName)
        if (validationError) {
            setCreateErrorMessage(validationError)
            return
        }

        const destinationDirectory = createTarget.destinationDirectory
        const optimisticPath = joinFileSystemPath(destinationDirectory, normalizedName)
        const optimisticNode: FileTreeNode = {
            name: normalizedName,
            path: optimisticPath,
            type: createTarget.type,
            isHidden: normalizedName.startsWith('.'),
            ...(createTarget.type === 'directory'
                ? { children: [], childrenLoaded: true }
                : {})
        }

        const previousTree = applyOptimisticFileTree((currentTree) => {
            const { nodes } = insertNodeAtDirectory(
                currentTree,
                destinationDirectory,
                optimisticNode,
                projectRootPath
            )
            return nodes
        })

        setCreateTarget(null)
        setCreateDraftState('')
        setCreateErrorMessage(null)
        showToast(`Creating ${createTarget.type === 'file' ? 'file' : 'folder'}: ${normalizedName}...`, undefined, undefined, 'info')

        const result = await window.devscope.createFileSystemItem(
            destinationDirectory,
            normalizedName,
            createTarget.type
        )
        if (!result.success) {
            setFileTree(previousTree)
            showToast(result.error || `Failed to create ${createTarget.type}.`, undefined, undefined, 'error')
            return
        }

        const createdPath = result.path
        const createdName = result.name
        const createdType = result.type

        if (createdPath && createdName && createdPath !== optimisticPath) {
            setFileTree((currentTree) => renameNodeByPath(currentTree, optimisticPath, createdName, createdPath))
        }

        showToast(`Created ${createdType === 'file' ? 'file' : 'folder'}: ${createdName}`)
        await refreshVisibleFileTree(destinationDirectory)

        if (createdType === 'file') {
            const ext = getFileExtensionFromName(createdName) || 'txt'
            await openPreview(
                { name: createdName, path: createdPath },
                ext,
                { startInEditMode: true }
            )
        }
    }, [
        applyOptimisticFileTree,
        createDraft,
        createTarget,
        openPreview,
        projectRootPath,
        refreshVisibleFileTree,
        setCreateDraftState,
        setCreateErrorMessage,
        setCreateTarget,
        setFileTree,
        showToast
    ])

    const submitRenameTarget = useCallback(async () => {
        if (!renameTarget) return
        const normalizedBaseName = renameDraft.trim()
        if (!normalizedBaseName) {
            setRenameErrorMessage('Name cannot be empty.')
            return
        }
        const normalizedNextName = renameTarget.type === 'file'
            ? `${normalizedBaseName}${renameExtensionSuffix}`
            : normalizedBaseName
        if (normalizedNextName === renameTarget.name) {
            setRenameTarget(null)
            setRenameDraft('')
            setRenameExtensionSuffix('')
            setRenameErrorMessage(null)
            return
        }

        const targetPath = renameTarget.path
        const nextPath = joinFileSystemPath(getParentFolderPath(targetPath) || projectRootPath, normalizedNextName)

        const previousTree = applyOptimisticFileTree((currentTree) => (
            renameNodeByPath(currentTree, targetPath, normalizedNextName, nextPath)
        ))

        setRenameTarget(null)
        setRenameDraft('')
        setRenameExtensionSuffix('')
        setRenameErrorMessage(null)
        showToast(`Renaming ${renameTarget.name}...`, undefined, undefined, 'info')

        const result = await window.devscope.renameFileSystemItem(targetPath, normalizedNextName)
        if (!result.success) {
            setFileTree(previousTree)
            showToast(result.error || `Failed to rename "${renameTarget.name}"`, undefined, undefined, 'error')
            return
        }

        if (result.path && result.name && result.path !== nextPath) {
            setFileTree((currentTree) => renameNodeByPath(currentTree, nextPath, result.name, result.path))
        }

        showToast(`Renamed to ${result.name || normalizedNextName}`)
        await refreshVisibleFileTree(getParentFolderPath(targetPath) || projectRootPath)
    }, [
        applyOptimisticFileTree,
        projectRootPath,
        refreshVisibleFileTree,
        renameDraft,
        renameExtensionSuffix,
        renameTarget,
        setRenameDraft,
        setRenameErrorMessage,
        setRenameExtensionSuffix,
        setRenameTarget,
        setFileTree,
        showToast
    ])

    const confirmDeleteTarget = useCallback(async () => {
        if (!deleteTarget) return
        const target = deleteTarget
        const previousClipboard = fileClipboardItem

        const previousTree = applyOptimisticFileTree((currentTree) => {
            const extraction = extractNodeByPath(currentTree, target.path)
            return extraction.nodes
        })

        setDeleteTarget(null)

        if (fileClipboardItem?.path === target.path) {
            setFileClipboardItem(null)
        }

        showToast(`Deleting ${target.name}...`, undefined, undefined, 'info')

        const result = await window.devscope.deleteFileSystemItem(target.path)
        if (!result.success) {
            setFileTree(previousTree)
            if (previousClipboard) {
                setFileClipboardItem(previousClipboard)
            }
            showToast(result.error || `Failed to delete "${target.name}"`, undefined, undefined, 'error')
            return
        }

        showToast(`Deleted ${target.name}`)
        await refreshVisibleFileTree(getParentFolderPath(target.path) || projectRootPath)
    }, [
        applyOptimisticFileTree,
        deleteTarget,
        fileClipboardItem,
        projectRootPath,
        refreshVisibleFileTree,
        setDeleteTarget,
        setFileClipboardItem,
        setFileTree,
        showToast
    ])

    useEffect(() => {
        if (activeTab !== 'files' || loadingFiles) return
        if (!fileSearch.trim()) return
        if (fileTreeFullyLoaded) return
        void refreshFileTree({ deep: true })
    }, [activeTab, fileSearch, fileTreeFullyLoaded, loadingFiles, refreshFileTree])

    return {
        refreshVisibleFileTree,
        handleToggleFolder,
        handleToggleAllFolders,
        handleFileTreeOpen,
        handleFileTreeOpenWith,
        handleFileTreeOpenInExplorer,
        handleFileTreeCopyPath,
        handleFileTreeCopy,
        handleFileTreeRename,
        handleFileTreeDelete,
        handleFileTreePaste,
        handleFileTreeMove,
        handleFileTreeCreateFile,
        handleFileTreeCreateFolder,
        submitCreateTarget,
        submitRenameTarget,
        confirmDeleteTarget
    }
}
