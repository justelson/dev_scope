import { shell } from 'electron'
import { access, cp, lstat, open as fsOpen, readdir, rename, rm, stat } from 'fs/promises'
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
    options?: { showHidden?: boolean; maxDepth?: number }
) {
    log.info('IPC: getFileTree', projectPath, options)

    const showHidden = options?.showHidden ?? false
    const maxDepth = options?.maxDepth ?? 20

    try {
        await access(projectPath)

        let gitStatusMap: Record<string, GitFileStatus> = {}
        try {
            gitStatusMap = await getGitStatus(projectPath)
        } catch {
            // Ignore git errors.
        }

        async function readDirRec(currentPath: string, depth: number): Promise<FileTreeNode[]> {
            if (maxDepth >= 0 && depth > maxDepth) return []

            const entries = await readdir(currentPath, { withFileTypes: true })
            const nodes: FileTreeNode[] = []

            for (const entry of entries) {
                const isHiddenEntry = entry.name.startsWith('.')
                if (!showHidden && isHiddenEntry) continue
                if (entry.name === 'node_modules' || entry.name === '.git') continue

                const fullPath = join(currentPath, entry.name)
                const relativePath = relative(projectPath, fullPath).replace(/\\/g, '/')
                const status = gitStatusMap[relativePath] || gitStatusMap[fullPath]

                if (entry.isDirectory()) {
                    const children = await readDirRec(fullPath, depth + 1)
                    nodes.push({
                        name: entry.name,
                        path: fullPath,
                        type: 'directory',
                        children,
                        isHidden: isHiddenEntry,
                        gitStatus: status
                    })
                } else if (entry.isFile()) {
                    try {
                        const stats = await stat(fullPath)
                        nodes.push({
                            name: entry.name,
                            path: fullPath,
                            type: 'file',
                            size: stats.size,
                            isHidden: isHiddenEntry,
                            gitStatus: status
                        })
                    } catch {
                        // Ignore unreadable file metadata.
                    }
                }
            }

            nodes.sort((a, b) => {
                if (a.type !== b.type) return a.type === 'directory' ? -1 : 1
                return a.name.localeCompare(b.name)
            })

            return nodes
        }

        const tree = await readDirRec(projectPath, 0)
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
                truncated
            }
        } finally {
            await fileHandle.close().catch(() => undefined)
        }
    } catch (err: any) {
        log.error('Failed to read file:', err)
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
