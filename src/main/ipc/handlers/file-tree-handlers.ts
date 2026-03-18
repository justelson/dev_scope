import { shell } from 'electron'
import { access, cp, lstat, mkdir, open as fsOpen, readFile, readdir, rename, rm, stat, writeFile } from 'fs/promises'
import { basename, dirname, join, parse, relative, resolve, sep } from 'path'
import log from 'electron-log'
import { getGitStatus, type GitFileStatus } from '../../inspectors/git'
import { invalidateScanProjectsCache } from '../../services/project-discovery-service'

interface FileTreeNode {
    name: string
    path: string
    type: 'file' | 'directory'
    size?: number
    children?: FileTreeNode[]
    childrenLoaded?: boolean
    isHidden: boolean
    gitStatus?: GitFileStatus
}

const PREVIEW_MAX_BYTES = 2 * 1024 * 1024
const BINARY_DETECTION_BYTES = 4096

function normalizePathForComparison(pathValue: string): string {
    const normalized = resolve(String(pathValue || ''))
    return process.platform === 'win32' ? normalized.toLowerCase() : normalized
}

async function pathExists(pathValue: string): Promise<boolean> {
    try {
        await access(pathValue)
        return true
    } catch {
        return false
    }
}

function buildCopyName(sourceName: string, copyIndex: number): string {
    if (copyIndex <= 0) return sourceName
    const parsed = parse(sourceName)
    const suffix = copyIndex === 1 ? ' Copy' : ` Copy ${copyIndex}`
    return `${parsed.name}${suffix}${parsed.ext}`
}

async function resolveCopyDestinationPath(destinationDirectory: string, sourceName: string): Promise<string> {
    let copyIndex = 0
    while (copyIndex < 1000) {
        const candidateName = buildCopyName(sourceName, copyIndex)
        const candidatePath = join(destinationDirectory, candidateName)
        if (!(await pathExists(candidatePath))) {
            return candidatePath
        }
        copyIndex += 1
    }
    throw new Error('Unable to resolve destination path for copy operation.')
}

function isLikelyBinaryBuffer(buffer: Buffer): boolean {
    if (buffer.length === 0) return false

    let suspicious = 0
    for (let i = 0; i < buffer.length; i++) {
        const byte = buffer[i]
        if (byte === 0) return true
        const isControl = byte < 32 && byte !== 9 && byte !== 10 && byte !== 13
        if (isControl) suspicious += 1
    }

    return suspicious / buffer.length > 0.2
}

export async function handleGetFileTree(
    _event: Electron.IpcMainInvokeEvent,
    projectPath: string,
    options?: { showHidden?: boolean; maxDepth?: number; rootPath?: string }
) {
    log.info('IPC: getFileTree', projectPath, options)

    const showHidden = options?.showHidden ?? false
    const maxDepth = options?.maxDepth ?? 20
    const resolvedProjectPath = resolve(projectPath)
    const resolvedRootPath = resolve(options?.rootPath || projectPath)

    try {
        const normalizedProjectPath = normalizePathForComparison(resolvedProjectPath)
        const normalizedRootPath = normalizePathForComparison(resolvedRootPath)
        const rootPathPrefix = process.platform === 'win32'
            ? `${normalizedProjectPath}\\`
            : `${normalizedProjectPath}/`

        if (
            normalizedRootPath !== normalizedProjectPath
            && !normalizedRootPath.startsWith(rootPathPrefix)
        ) {
            return { success: false, error: 'Requested path is outside the project root.' }
        }

        await access(resolvedRootPath)
        const rootStats = await lstat(resolvedRootPath)
        if (!rootStats.isDirectory()) {
            return { success: false, error: 'Requested path is not a directory.' }
        }

        let gitStatusMap: Record<string, GitFileStatus> = {}
        try {
            gitStatusMap = await getGitStatus(resolvedProjectPath)
        } catch {
            // Ignore git errors.
        }

        async function readDirRec(currentPath: string, depth: number): Promise<FileTreeNode[]> {
            if (maxDepth >= 0 && depth > maxDepth) return []

            const entries = await readdir(currentPath, { withFileTypes: true })
            const nodes = await Promise.all(entries.map(async (entry) => {
                const isHiddenEntry = entry.name.startsWith('.')
                if (!showHidden && isHiddenEntry) return null
                if (entry.name === 'node_modules' || entry.name === '.git') return null

                const fullPath = join(currentPath, entry.name)
                const relativePath = relative(resolvedProjectPath, fullPath).replace(/\\/g, '/')
                const status = gitStatusMap[relativePath] || gitStatusMap[fullPath]

                if (entry.isDirectory()) {
                    const shouldLoadChildren = maxDepth < 0 || depth < maxDepth
                    const children = shouldLoadChildren
                        ? await readDirRec(fullPath, depth + 1)
                        : undefined
                    return {
                        name: entry.name,
                        path: fullPath,
                        type: 'directory',
                        children,
                        childrenLoaded: shouldLoadChildren,
                        isHidden: isHiddenEntry,
                        gitStatus: status
                    } satisfies FileTreeNode
                } else if (entry.isFile()) {
                    try {
                        const stats = await stat(fullPath)
                        return {
                            name: entry.name,
                            path: fullPath,
                            type: 'file',
                            size: stats.size,
                            isHidden: isHiddenEntry,
                            gitStatus: status
                        } satisfies FileTreeNode
                    } catch {
                        // Ignore unreadable file metadata.
                        return null
                    }
                }
                return null
            }))

            const filteredNodes = nodes.filter((node): node is NonNullable<typeof node> => node !== null)

            filteredNodes.sort((a, b) => {
                if (a.type !== b.type) return a.type === 'directory' ? -1 : 1
                return a.name.localeCompare(b.name)
            })

            return filteredNodes
        }

        const tree = await readDirRec(resolvedRootPath, 0)
        return { success: true, tree }
    } catch (err: any) {
        log.error('Failed to get file tree:', err)
        return { success: false, error: err.message }
    }
}

export async function handleReadFileContent(_event: Electron.IpcMainInvokeEvent, filePath: string) {
    log.info('IPC: readFileContent', filePath)

    try {
        await access(filePath)
        const stats = await stat(filePath)
        const size = stats.size

        const fileHandle = await fsOpen(filePath, 'r')
        try {
            const probeBytes = Math.min(BINARY_DETECTION_BYTES, size)
            const probeBuffer = Buffer.alloc(probeBytes)
            if (probeBytes > 0) {
                await fileHandle.read(probeBuffer, 0, probeBytes, 0)
            }

            if (isLikelyBinaryBuffer(probeBuffer.subarray(0, probeBytes))) {
                return {
                    success: false,
                    error: 'Binary files cannot be previewed safely in text mode.',
                    isBinary: true,
                    size
                }
            }

            const previewBytes = Math.min(size, PREVIEW_MAX_BYTES)
            const previewBuffer = Buffer.alloc(previewBytes)
            if (previewBytes > 0) {
                await fileHandle.read(previewBuffer, 0, previewBytes, 0)
            }

            const content = previewBuffer.toString('utf-8')
            const truncated = size > PREVIEW_MAX_BYTES

            return {
                success: true,
                content,
                size,
                previewBytes,
                truncated,
                modifiedAt: stats.mtimeMs
            }
        } finally {
            await fileHandle.close().catch(() => undefined)
        }
    } catch (err: any) {
        log.error('Failed to read file:', err)
        return { success: false, error: err.message }
    }
}

export async function handleReadTextFileFull(_event: Electron.IpcMainInvokeEvent, filePath: string) {
    log.info('IPC: readTextFileFull', filePath)

    try {
        await access(filePath)
        const fileStats = await stat(filePath)

        const fileHandle = await fsOpen(filePath, 'r')
        try {
            const probeBytes = Math.min(BINARY_DETECTION_BYTES, fileStats.size)
            const probeBuffer = Buffer.alloc(probeBytes)
            if (probeBytes > 0) {
                await fileHandle.read(probeBuffer, 0, probeBytes, 0)
            }

            if (isLikelyBinaryBuffer(probeBuffer.subarray(0, probeBytes))) {
                return {
                    success: false,
                    error: 'Binary files cannot be edited in text mode.',
                    isBinary: true,
                    size: fileStats.size
                }
            }
        } finally {
            await fileHandle.close().catch(() => undefined)
        }

        const fullText = await readFile(filePath, 'utf-8')
        return {
            success: true,
            content: fullText,
            size: fileStats.size,
            modifiedAt: fileStats.mtimeMs
        }
    } catch (err: any) {
        log.error('Failed to read full text file:', err)
        return { success: false, error: err.message }
    }
}

export async function handleGetPathInfo(_event: Electron.IpcMainInvokeEvent, targetPath: string) {
    log.info('IPC: getPathInfo', targetPath)

    try {
        const normalizedTargetPath = String(targetPath || '').trim()
        if (!normalizedTargetPath) {
            return { success: false, error: 'Path is required.' }
        }

        const resolvedTargetPath = resolve(normalizedTargetPath)

        if (!(await pathExists(resolvedTargetPath))) {
            return {
                success: true,
                path: resolvedTargetPath,
                name: basename(resolvedTargetPath),
                exists: false,
                type: null
            }
        }

        const targetStats = await lstat(resolvedTargetPath)
        return {
            success: true,
            path: resolvedTargetPath,
            name: basename(resolvedTargetPath),
            exists: true,
            type: targetStats.isDirectory() ? 'directory' : 'file'
        }
    } catch (err: any) {
        log.error('Failed to get path info:', err)
        return { success: false, error: err.message }
    }
}

export async function handleWriteTextFile(
    _event: Electron.IpcMainInvokeEvent,
    filePath: string,
    content: string,
    expectedModifiedAt?: number
) {
    log.info('IPC: writeTextFile', filePath)

    try {
        const normalizedFilePath = String(filePath || '').trim()
        if (!normalizedFilePath) {
            return { success: false, error: 'File path is required.' }
        }

        await access(normalizedFilePath)
        const currentStats = await stat(normalizedFilePath)
        if (typeof expectedModifiedAt === 'number' && Number.isFinite(expectedModifiedAt)) {
            const delta = Math.abs(currentStats.mtimeMs - expectedModifiedAt)
            if (delta > 1) {
                return {
                    success: false,
                    error: 'File changed on disk since it was opened.',
                    conflict: true,
                    currentModifiedAt: currentStats.mtimeMs
                }
            }
        }

        const fileHandle = await fsOpen(normalizedFilePath, 'r')
        try {
            const probeBytes = Math.min(BINARY_DETECTION_BYTES, currentStats.size)
            const probeBuffer = Buffer.alloc(probeBytes)
            if (probeBytes > 0) {
                await fileHandle.read(probeBuffer, 0, probeBytes, 0)
            }

            if (isLikelyBinaryBuffer(probeBuffer.subarray(0, probeBytes))) {
                return { success: false, error: 'Binary files cannot be edited in text mode.' }
            }
        } finally {
            await fileHandle.close().catch(() => undefined)
        }

        await writeFile(normalizedFilePath, String(content ?? ''), 'utf-8')
        const nextStats = await stat(normalizedFilePath)
        invalidateScanProjectsCache(dirname(normalizedFilePath))
        invalidateScanProjectsCache(normalizedFilePath, { includeParents: false })

        return {
            success: true,
            size: nextStats.size,
            modifiedAt: nextStats.mtimeMs
        }
    } catch (err: any) {
        log.error('Failed to write text file:', err)
        return { success: false, error: err.message }
    }
}

export async function handleRenameFileSystemItem(
    _event: Electron.IpcMainInvokeEvent,
    targetPath: string,
    nextName: string
) {
    log.info('IPC: renameFileSystemItem', targetPath, nextName)

    try {
        const normalizedTargetPath = String(targetPath || '').trim()
        const normalizedNextName = String(nextName || '').trim()

        if (!normalizedTargetPath) return { success: false, error: 'Target path is required.' }
        if (!normalizedNextName) return { success: false, error: 'New name is required.' }
        if (normalizedNextName.includes('/') || normalizedNextName.includes('\\')) {
            return { success: false, error: 'Name cannot include path separators.' }
        }

        await access(normalizedTargetPath)

        const destinationPath = join(dirname(normalizedTargetPath), normalizedNextName)
        const normalizedSource = normalizePathForComparison(normalizedTargetPath)
        const normalizedDestination = normalizePathForComparison(destinationPath)
        if (normalizedSource === normalizedDestination) {
            return { success: true, path: destinationPath, name: normalizedNextName }
        }

        if (await pathExists(destinationPath)) {
            return { success: false, error: `A file or folder named "${normalizedNextName}" already exists.` }
        }

        await rename(normalizedTargetPath, destinationPath)
        invalidateScanProjectsCache(dirname(normalizedTargetPath))
        invalidateScanProjectsCache(dirname(destinationPath))
        invalidateScanProjectsCache(normalizedTargetPath, { includeParents: false })
        invalidateScanProjectsCache(destinationPath, { includeParents: false })
        return { success: true, path: destinationPath, name: normalizedNextName }
    } catch (err: any) {
        log.error('Failed to rename file system item:', err)
        return { success: false, error: err.message }
    }
}

export async function handleCreateFileSystemItem(
    _event: Electron.IpcMainInvokeEvent,
    destinationDirectory: string,
    name: string,
    type: 'file' | 'directory'
) {
    log.info('IPC: createFileSystemItem', destinationDirectory, name, type)

    try {
        const normalizedDestinationDirectory = String(destinationDirectory || '').trim()
        const normalizedName = String(name || '').trim()
        const normalizedType = type === 'file' || type === 'directory' ? type : null

        if (!normalizedDestinationDirectory) return { success: false, error: 'Destination directory is required.' }
        if (!normalizedName) return { success: false, error: 'Name is required.' }
        if (!normalizedType) return { success: false, error: 'Type must be "file" or "directory".' }
        if (normalizedName === '.' || normalizedName === '..') {
            return { success: false, error: 'Name cannot be "." or "..".' }
        }
        if (normalizedName.includes('/') || normalizedName.includes('\\')) {
            return { success: false, error: 'Name cannot include path separators.' }
        }

        await access(normalizedDestinationDirectory)
        const destinationStat = await lstat(normalizedDestinationDirectory)
        if (!destinationStat.isDirectory()) {
            return { success: false, error: 'Destination must be a folder.' }
        }

        const targetPath = join(normalizedDestinationDirectory, normalizedName)
        if (await pathExists(targetPath)) {
            return { success: false, error: `A file or folder named "${normalizedName}" already exists.` }
        }

        if (normalizedType === 'file') {
            const fileHandle = await fsOpen(targetPath, 'wx')
            await fileHandle.close()
        } else {
            await mkdir(targetPath, { recursive: false })
        }

        invalidateScanProjectsCache(normalizedDestinationDirectory)
        invalidateScanProjectsCache(targetPath, { includeParents: false })

        return { success: true, path: targetPath, name: normalizedName, type: normalizedType }
    } catch (err: any) {
        log.error('Failed to create file system item:', err)
        return { success: false, error: err.message }
    }
}

export async function handleDeleteFileSystemItem(_event: Electron.IpcMainInvokeEvent, targetPath: string) {
    log.info('IPC: deleteFileSystemItem', targetPath)

    try {
        const normalizedTargetPath = String(targetPath || '').trim()
        if (!normalizedTargetPath) return { success: false, error: 'Target path is required.' }

        await access(normalizedTargetPath)

        try {
            await shell.trashItem(normalizedTargetPath)
        } catch {
            await rm(normalizedTargetPath, { recursive: true, force: false })
        }

        invalidateScanProjectsCache(dirname(normalizedTargetPath))
        invalidateScanProjectsCache(normalizedTargetPath, { includeParents: false })

        return { success: true }
    } catch (err: any) {
        log.error('Failed to delete file system item:', err)
        return { success: false, error: err.message }
    }
}

export async function handlePasteFileSystemItem(
    _event: Electron.IpcMainInvokeEvent,
    sourcePath: string,
    destinationDirectory: string
) {
    log.info('IPC: pasteFileSystemItem', sourcePath, destinationDirectory)

    try {
        const normalizedSourcePath = String(sourcePath || '').trim()
        const normalizedDestinationDirectory = String(destinationDirectory || '').trim()

        if (!normalizedSourcePath) return { success: false, error: 'Source path is required.' }
        if (!normalizedDestinationDirectory) return { success: false, error: 'Destination directory is required.' }

        await access(normalizedSourcePath)
        const destinationStat = await lstat(normalizedDestinationDirectory)
        if (!destinationStat.isDirectory()) {
            return { success: false, error: 'Destination must be a folder.' }
        }

        const sourceStat = await lstat(normalizedSourcePath)
        const normalizedSource = normalizePathForComparison(normalizedSourcePath)
        const normalizedDestination = normalizePathForComparison(normalizedDestinationDirectory)
        if (sourceStat.isDirectory() && (
            normalizedDestination === normalizedSource
            || normalizedDestination.startsWith(`${normalizedSource}${sep}`)
        )) {
            return { success: false, error: 'Cannot copy a folder into itself.' }
        }

        const sourceName = basename(normalizedSourcePath)
        const destinationPath = await resolveCopyDestinationPath(normalizedDestinationDirectory, sourceName)

        await cp(normalizedSourcePath, destinationPath, {
            recursive: sourceStat.isDirectory(),
            errorOnExist: true,
            force: false
        })

        invalidateScanProjectsCache(normalizedDestinationDirectory)
        invalidateScanProjectsCache(destinationPath, { includeParents: false })

        return { success: true, path: destinationPath, name: basename(destinationPath) }
    } catch (err: any) {
        log.error('Failed to paste file system item:', err)
        return { success: false, error: err.message }
    }
}

export async function handleMoveFileSystemItem(
    _event: Electron.IpcMainInvokeEvent,
    sourcePath: string,
    destinationDirectory: string
) {
    log.info('IPC: moveFileSystemItem', sourcePath, destinationDirectory)

    try {
        const normalizedSourcePath = String(sourcePath || '').trim()
        const normalizedDestinationDirectory = String(destinationDirectory || '').trim()

        if (!normalizedSourcePath) return { success: false, error: 'Source path is required.' }
        if (!normalizedDestinationDirectory) return { success: false, error: 'Destination directory is required.' }

        await access(normalizedSourcePath)
        const destinationStat = await lstat(normalizedDestinationDirectory)
        if (!destinationStat.isDirectory()) {
            return { success: false, error: 'Destination must be a folder.' }
        }

        const sourceStat = await lstat(normalizedSourcePath)
        const normalizedSource = normalizePathForComparison(normalizedSourcePath)
        const normalizedDestinationDir = normalizePathForComparison(normalizedDestinationDirectory)

        if (sourceStat.isDirectory() && (
            normalizedDestinationDir === normalizedSource
            || normalizedDestinationDir.startsWith(`${normalizedSource}${sep}`)
        )) {
            return { success: false, error: 'Cannot move a folder into itself.' }
        }

        const sourceName = basename(normalizedSourcePath)
        const destinationPath = join(normalizedDestinationDirectory, sourceName)
        const normalizedDestinationPath = normalizePathForComparison(destinationPath)

        if (normalizedDestinationPath === normalizedSource) {
            return { success: true, path: destinationPath, name: sourceName }
        }

        if (await pathExists(destinationPath)) {
            return { success: false, error: `A file or folder named "${sourceName}" already exists in the destination.` }
        }

        try {
            await rename(normalizedSourcePath, destinationPath)
        } catch (err: any) {
            if (err?.code !== 'EXDEV') {
                throw err
            }

            await cp(normalizedSourcePath, destinationPath, {
                recursive: sourceStat.isDirectory(),
                errorOnExist: true,
                force: false
            })
            await rm(normalizedSourcePath, { recursive: sourceStat.isDirectory(), force: false })
        }

        invalidateScanProjectsCache(dirname(normalizedSourcePath))
        invalidateScanProjectsCache(dirname(destinationPath))
        invalidateScanProjectsCache(normalizedSourcePath, { includeParents: false })
        invalidateScanProjectsCache(destinationPath, { includeParents: false })

        return { success: true, path: destinationPath, name: sourceName }
    } catch (err: any) {
        log.error('Failed to move file system item:', err)
        return { success: false, error: err.message }
    }
}
