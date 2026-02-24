/**
 * DevScope - Developer Machine Status System
 * Main Process Entry Point
 */

import { app, BrowserWindow, shell, ipcMain, protocol } from 'electron'
import { join } from 'path'
import { existsSync } from 'fs'
import { electronApp, is } from './utils'
import log from 'electron-log'
import { registerIpcHandlers } from './ipc'
import { disposeSystemMetricsBridge } from './system-metrics/manager'

// Configure logging
log.transports.file.level = 'info'
log.transports.console.level = 'debug'
console.log = log.log
console.error = log.error
console.warn = log.warn

let mainWindow: BrowserWindow | null = null
const FILE_PROTOCOL = 'devscope'

protocol.registerSchemesAsPrivileged([
    {
        scheme: FILE_PROTOCOL,
        privileges: {
            standard: true,
            secure: true,
            supportFetchAPI: true,
            stream: true
        }
    }
])

const getPreloadPath = (): string => {
    const preloadMjs = join(__dirname, '../preload/index.mjs')
    const preloadJs = join(__dirname, '../preload/index.js')
    return existsSync(preloadMjs) ? preloadMjs : preloadJs
}

const getAppIconPath = (): string | undefined => {
    const candidates = [
        join(process.resourcesPath, 'icon.png'),
        join(app.getAppPath(), 'resources/icon.png'),
        join(process.cwd(), 'resources/icon.png')
    ]
    return candidates.find((candidate) => existsSync(candidate))
}

function isDevToolsShortcut(input: Electron.Input): boolean {
    const key = input.key?.toLowerCase()
    return input.type === 'keyDown' && !!input.control && !!input.shift && key === 'i'
}

function createWindow(): void {
    const iconPath = getAppIconPath()
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        minWidth: 900,
        minHeight: 600,
        show: false,
        frame: false,
        backgroundColor: '#0c121f',
        ...(iconPath ? { icon: iconPath } : {}),
        webPreferences: {
            preload: getPreloadPath(),
            sandbox: false,
            contextIsolation: true,
            nodeIntegration: false,
            webviewTag: true,
            devTools: true
        }
    })

    mainWindow.on('ready-to-show', () => {
        mainWindow?.show()
    })

    mainWindow.webContents.setWindowOpenHandler((details) => {
        shell.openExternal(details.url)
        return { action: 'deny' }
    })

    mainWindow.webContents.on('before-input-event', (event, input) => {
        if (!mainWindow || !isDevToolsShortcut(input)) return

        event.preventDefault()
        if (mainWindow.webContents.isDevToolsOpened()) {
            mainWindow.webContents.closeDevTools()
        } else {
            mainWindow.webContents.openDevTools({ mode: 'detach' })
        }
    })

    // Load the renderer
    if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
        mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
    } else {
        mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
    }
}

app.whenReady().then(() => {
    // Set app user model id for Windows
    electronApp.setAppUserModelId('com.devscope.win')

    protocol.registerFileProtocol(FILE_PROTOCOL, (request, callback) => {
        try {
            const url = new URL(request.url)
            let filePath = decodeURIComponent(url.pathname)

            // Handle case where drive letter is interpreted as hostname (e.g. devscope://c/Users/...)
            if (url.hostname && url.hostname.length === 1 && /^[a-zA-Z]$/.test(url.hostname)) {
                filePath = `${url.hostname}:${filePath}`
            }
            // Handle UNC paths
            else if (url.hostname) {
                filePath = `//${url.hostname}${filePath}`
            }
            // Handle standard Windows paths with leading slash (e.g. /C:/Users/...)
            else if (process.platform === 'win32' && filePath.startsWith('/')) {
                filePath = filePath.slice(1)
            }
            callback({ path: filePath })
        } catch (err) {
            log.error('Failed to resolve protocol URL:', request.url, err)
            callback({ path: '' })
        }
    })

    // Create window
    createWindow()

    // Register IPC handlers with mainWindow reference
    if (mainWindow) {
        registerIpcHandlers(mainWindow)
    }

    app.on('activate', function () {
        if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })

    app.on('render-process-gone', (_event, webContents, details) => {
        log.error('[Process] Renderer gone', {
            id: webContents.id,
            reason: details.reason,
            exitCode: details.exitCode
        })
    })

    app.on('child-process-gone', (_event, details) => {
        log.error('[Process] Child process gone', details)
    })
})

app.on('window-all-closed', () => {
    disposeSystemMetricsBridge()
    if (process.platform !== 'darwin') {
        app.quit()
    }
})

// Handle window control IPC
ipcMain.on('window:minimize', () => {
    log.info('Window minimize requested')
    mainWindow?.minimize()
})

ipcMain.on('window:maximize', () => {
    log.info('Window maximize requested')
    if (mainWindow?.isMaximized()) {
        mainWindow.unmaximize()
    } else {
        mainWindow?.maximize()
    }
})

ipcMain.on('window:close', () => {
    log.info('Window close requested')
    mainWindow?.close()
})

ipcMain.handle('window:isMaximized', () => {
    return mainWindow?.isMaximized() ?? false
})


