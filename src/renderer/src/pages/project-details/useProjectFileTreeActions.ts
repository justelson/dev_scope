import { useCallback, useEffect } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import { getAllFolderPaths } from './fileTreeUtils'
import type { FileTreeNode } from './types'
import {
    getFileExtensionFromName,
    getParentFolderPath,
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

        const result = await window.devscope.pasteFileSystemItem(fileClipboardItem.path, destinationDirectory)
        if (!result.success) {
            showToast(result.error || `Failed to paste "${fileClipboardItem.name}"`, undefined, undefined, 'error')
            return
        }

        showToast(`Pasted ${fileClipboardItem.name}`)
        await refreshVisibleFileTree(destinationDirectory)
    }, [fileClipboardItem, refreshVisibleFileTree, showToast])

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

        const result = await window.devscope.createFileSystemItem(
            createTarget.destinationDirectory,
            normalizedName,
            createTarget.type
        )
        if (!result.success) {
            setCreateErrorMessage(result.error || `Failed to create ${createTarget.type}.`)
            return
        }

        const createdPath = result.path
        const createdName = result.name
        const createdType = result.type

        setCreateTarget(null)
        setCreateDraftState('')
        setCreateErrorMessage(null)

        showToast(`Created ${createdType === 'file' ? 'file' : 'folder'}: ${createdName}`)
        await refreshVisibleFileTree(createTarget.destinationDirectory)

        if (createdType === 'file') {
            const ext = getFileExtensionFromName(createdName) || 'txt'
            await openPreview(
                { name: createdName, path: createdPath },
                ext,
                { startInEditMode: true }
            )
        }
    }, [
        createDraft,
        createTarget,
        openPreview,
        refreshVisibleFileTree,
        setCreateDraftState,
        setCreateErrorMessage,
        setCreateTarget,
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

        const result = await window.devscope.renameFileSystemItem(renameTarget.path, normalizedNextName)
        if (!result.success) {
            setRenameErrorMessage(result.error || `Failed to rename "${renameTarget.name}"`)
            return
        }

        showToast(`Renamed to ${normalizedNextName}`)
        setRenameTarget(null)
        setRenameDraft('')
        setRenameExtensionSuffix('')
        setRenameErrorMessage(null)
        await refreshVisibleFileTree(getParentFolderPath(renameTarget.path) || projectRootPath)
    }, [
        projectRootPath,
        refreshVisibleFileTree,
        renameDraft,
        renameExtensionSuffix,
        renameTarget,
        setRenameDraft,
        setRenameErrorMessage,
        setRenameExtensionSuffix,
        setRenameTarget,
        showToast
    ])

    const confirmDeleteTarget = useCallback(async () => {
        if (!deleteTarget) return
        const result = await window.devscope.deleteFileSystemItem(deleteTarget.path)
        if (!result.success) {
            showToast(result.error || `Failed to delete "${deleteTarget.name}"`, undefined, undefined, 'error')
            return
        }

        if (fileClipboardItem?.path === deleteTarget.path) {
            setFileClipboardItem(null)
        }

        showToast(`Deleted ${deleteTarget.name}`)
        setDeleteTarget(null)
        await refreshVisibleFileTree(getParentFolderPath(deleteTarget.path) || projectRootPath)
    }, [deleteTarget, fileClipboardItem?.path, projectRootPath, refreshVisibleFileTree, setDeleteTarget, setFileClipboardItem, showToast])

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
        handleFileTreeCreateFile,
        handleFileTreeCreateFolder,
        submitCreateTarget,
        submitRenameTarget,
        confirmDeleteTarget
    }
}
