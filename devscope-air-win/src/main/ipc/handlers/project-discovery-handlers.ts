import { clipboard, BrowserWindow, dialog, shell } from 'electron'
import { spawn } from 'child_process'
import { stat } from 'fs/promises'
import log from 'electron-log'
import { devscopeCore } from '../../core/devscope-core'
import type { ScanProjectsResult } from '../../services/project-discovery-service'

export async function handleSelectFolder(event: Electron.IpcMainInvokeEvent) {
    log.info('IPC: selectFolder')

    try {
        const win = BrowserWindow.fromWebContents(event.sender)
        const result = await dialog.showOpenDialog(win!, {
            title: 'Select Projects Folder',
            properties: ['openDirectory']
        })

        if (result.canceled || result.filePaths.length === 0) {
            return { success: false, cancelled: true }
        }

        return { success: true, folderPath: result.filePaths[0] }
    } catch (err: any) {
        log.error('Failed to select folder:', err)
        return { success: false, error: err.message }
    }
}

export async function handleScanProjects(
    _event: Electron.IpcMainInvokeEvent,
    folderPath: string,
    options?: { forceRefresh?: boolean }
): Promise<ScanProjectsResult> {
    log.info('IPC: scanProjects', folderPath)
    const result = await devscopeCore.projects.scanProjects(folderPath, options)
    if (result.success) {
        log.info(
            `Found ${result.projects.length} projects, ${result.folders.length} folders, and ${result.files.length} files in ${folderPath}`
        )
    }
    return result
}

export async function handleIndexAllFolders(_event: Electron.IpcMainInvokeEvent, folders: string[]) {
    log.info('IPC: indexAllFolders', folders)
    const result = await devscopeCore.projects.indexAllFolders(folders)
    log.info(`Indexed ${result.indexedCount} projects from ${folders.length} folders (max depth: unlimited)`)
    return result
}

export async function handleOpenInExplorer(_event: Electron.IpcMainInvokeEvent, path: string) {
    log.info('IPC: openInExplorer', path)

    try {
        const normalizedPath = String(path || '').trim()
        if (!normalizedPath) return { success: false, error: 'Path is required.' }

        try {
            const targetStats = await stat(normalizedPath)
            if (targetStats.isFile()) {
                shell.showItemInFolder(normalizedPath)
                return { success: true }
            }
        } catch {
            // Fall back to shell.openPath when stats are unavailable.
        }

        const result = await shell.openPath(normalizedPath)
        if (result) {
            log.error('shell.openPath failed:', result)
            return { success: false, error: result }
        }
        return { success: true }
    } catch (err: any) {
        log.error('Failed to open in explorer:', err)
        return { success: false, error: err.message }
    }
}

export async function handleOpenFile(_event: Electron.IpcMainInvokeEvent, filePath: string) {
    log.info('IPC: openFile', filePath)

    try {
        const result = await shell.openPath(filePath)
        if (result) {
            log.error('shell.openPath failed:', result)
            return { success: false, error: result }
        }
        return { success: true }
    } catch (err: any) {
        log.error('Failed to open file:', err)
        return { success: false, error: err.message }
    }
}

export async function handleOpenWith(_event: Electron.IpcMainInvokeEvent, filePath: string) {
    log.info('IPC: openWith', filePath)

    try {
        const normalizedPath = String(filePath || '').trim()
        if (!normalizedPath) return { success: false, error: 'Path is required.' }

        if (process.platform === 'win32') {
            const child = spawn('rundll32.exe', ['shell32.dll,OpenAs_RunDLL', normalizedPath], {
                detached: true,
                windowsHide: true,
                stdio: 'ignore'
            })
            child.unref()
            return { success: true }
        }

        const result = await shell.openPath(normalizedPath)
        if (result) {
            log.error('shell.openPath failed:', result)
            return { success: false, error: result }
        }
        return { success: true }
    } catch (err: any) {
        log.error('Failed to open with:', err)
        return { success: false, error: err.message }
    }
}

export async function handleCopyToClipboard(_event: Electron.IpcMainInvokeEvent, text: string) {
    try {
        clipboard.writeText(text)
        return { success: true }
    } catch (err: any) {
        log.error('Failed to write to clipboard:', err)
        return { success: false, error: err.message }
    }
}
