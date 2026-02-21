import { access, open as fsOpen, readdir, stat } from 'fs/promises'
import { join, relative } from 'path'
import log from 'electron-log'
import { getGitStatus, type GitFileStatus } from '../../inspectors/git'

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
