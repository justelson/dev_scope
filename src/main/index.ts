/**
 * DevScope - Developer Machine Status System
 * Main Process Entry Point
 */

import { app, BrowserWindow, shell, ipcMain, protocol } from 'electron'
import { basename, extname, join } from 'path'
import { existsSync, statSync } from 'fs'
import { electronApp, is } from './utils'
import log from 'electron-log'
import { registerIpcHandlers } from './ipc'
import { disposeSystemMetricsBridge } from './system-metrics/manager'
import { disposeUpdater, initializeUpdater, registerUpdateWindow } from './update/manager'

// Configure logging
log.transports.file.level = 'info'
log.transports.console.level = 'debug'
console.log = log.log
console.error = log.error
console.warn = log.warn

let mainWindow: BrowserWindow | null = null
let quickPreviewWindow: BrowserWindow | null = null
let hasRegisteredIpcHandlers = false
const FILE_PROTOCOL = 'devscope'
const QUICK_PREVIEW_ROUTE = '/quick-open'
const ASSOCIATED_CODE_EXTENSIONS = new Set([
    '.md', '.markdown', '.mdx', '.txt', '.log',
    '.js', '.jsx', '.mjs', '.cjs',
    '.ts', '.tsx',
    '.json', '.jsonc', '.json5',
    '.css', '.scss', '.less',
    '.html', '.htm', '.xml',
    '.yml', '.yaml', '.toml', '.ini', '.conf',
    '.sh', '.bash', '.zsh', '.ps1', '.bat', '.cmd',
    '.py', '.rb', '.php', '.java', '.kt', '.kts',
    '.c', '.h', '.cpp', '.cxx', '.hpp',
    '.cs', '.go', '.rs', '.swift', '.dart', '.scala', '.sql',
    '.vue', '.svelte', '.gradle'
])
const ASSOCIATED_DOTFILES = new Set([
    '.gitignore',
    '.gitattributes',
    '.editorconfig',
    '.npmrc',
    '.eslintrc',
    '.prettierrc'
])

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

function getZoomShortcutAction(input: Electron.Input): 'in' | 'out' | 'reset' | null {
    if (input.type !== 'keyDown' || (!input.control && !input.meta)) return null

    const key = input.key?.toLowerCase()
    const code = String(input.code || '')

    if (key === '-' || code === 'Minus' || code === 'NumpadSubtract') return 'out'
    if (key === '+' || key === '=' || code === 'Equal' || code === 'NumpadAdd') return 'in'
    if (key === '0' || code === 'Digit0' || code === 'Numpad0') return 'reset'

    return null
}

function shouldTreatAsAssociatedFile(arg: string): boolean {
    const trimmed = String(arg || '').trim()
    if (!trimmed || trimmed.startsWith('-')) return false
    if (!existsSync(trimmed)) return false

    try {
        const stat = statSync(trimmed)
        if (!stat.isFile()) return false
    } catch {
        return false
    }

    const fileName = basename(trimmed).toLowerCase()
    const extension = extname(trimmed).toLowerCase()
    return ASSOCIATED_CODE_EXTENSIONS.has(extension) || ASSOCIATED_DOTFILES.has(fileName)
}

function extractAssociatedFileFromArgv(argv: string[]): string | null {
    const startIndex = app.isPackaged ? 1 : 2
    for (let i = startIndex; i < argv.length; i += 1) {
        const candidate = String(argv[i] || '').trim()
        if (shouldTreatAsAssociatedFile(candidate)) {
            return candidate
        }
    }
    return null
}

function ensureIpcHandlersRegistered(targetWindow: BrowserWindow): void {
    if (hasRegisteredIpcHandlers) return
    registerIpcHandlers(targetWindow)
    hasRegisteredIpcHandlers = true
}

function loadRendererRoute(window: BrowserWindow, routeWithSearch: string): void {
    if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
        const url = new URL(process.env['ELECTRON_RENDERER_URL'])
        url.hash = routeWithSearch
        void window.loadURL(url.toString())
        return
    }
    void window.loadFile(join(__dirname, '../renderer/index.html'), { hash: routeWithSearch })
}

function createWindow(showOnReady = true): BrowserWindow {
    const iconPath = getAppIconPath()
    const window = new BrowserWindow({
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

    window.on('ready-to-show', () => {
        if (showOnReady) window.show()
    })

    window.webContents.setWindowOpenHandler((details) => {
        shell.openExternal(details.url)
        return { action: 'deny' }
    })

    window.webContents.on('before-input-event', (event, input) => {
        const zoomAction = getZoomShortcutAction(input)
        if (zoomAction) {
            event.preventDefault()
            const currentZoomLevel = window.webContents.getZoomLevel()

            if (zoomAction === 'reset') {
                window.webContents.setZoomLevel(0)
                return
            }

            const delta = zoomAction === 'in' ? 0.5 : -0.5
            const nextZoomLevel = Math.max(-3, Math.min(3, currentZoomLevel + delta))
            window.webContents.setZoomLevel(nextZoomLevel)
            return
        }

        if (!isDevToolsShortcut(input)) return

        event.preventDefault()
        if (window.webContents.isDevToolsOpened()) {
            window.webContents.closeDevTools()
        } else {
            window.webContents.openDevTools({ mode: 'detach' })
        }
    })

    loadRendererRoute(window, '/')
    registerUpdateWindow(window)

    return window
}

function createQuickPreviewWindow(filePath: string): BrowserWindow {
    const iconPath = getAppIconPath()
    const route = `${QUICK_PREVIEW_ROUTE}?file=${encodeURIComponent(filePath)}`

    if (quickPreviewWindow && !quickPreviewWindow.isDestroyed()) {
        loadRendererRoute(quickPreviewWindow, route)
        if (quickPreviewWindow.isMinimized()) quickPreviewWindow.restore()
        quickPreviewWindow.show()
        quickPreviewWindow.focus()
        return quickPreviewWindow
    }

    const window = new BrowserWindow({
        width: 1160,
        height: 860,
        minWidth: 760,
        minHeight: 520,
        show: false,
        backgroundColor: '#0c121f',
        autoHideMenuBar: true,
        ...(iconPath ? { icon: iconPath } : {}),
        webPreferences: {
            preload: getPreloadPath(),
            sandbox: false,
            contextIsolation: true,
            nodeIntegration: false,
            webviewTag: false,
            devTools: true
        }
    })

    window.on('ready-to-show', () => window.show())
    window.on('closed', () => {
        quickPreviewWindow = null
    })
    window.webContents.setWindowOpenHandler((details) => {
        shell.openExternal(details.url)
        return { action: 'deny' }
    })

    loadRendererRoute(window, route)
    quickPreviewWindow = window
    return window
}

const initialAssociatedFilePath = extractAssociatedFileFromArgv(process.argv)
const hasSingleInstanceLock = app.requestSingleInstanceLock()

if (!hasSingleInstanceLock) {
    app.quit()
}

app.on('second-instance', (_event, argv) => {
    const associatedFilePath = extractAssociatedFileFromArgv(argv)
    if (associatedFilePath) {
        createQuickPreviewWindow(associatedFilePath)
        return
    }

    if (!mainWindow || mainWindow.isDestroyed()) {
        mainWindow = createWindow(true)
        ensureIpcHandlersRegistered(mainWindow)
        return
    }

    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.show()
    mainWindow.focus()
})

app.whenReady().then(() => {
    app.setName('DevScope Air')
    electronApp.setAppUserModelId('com.devscope.air.win')
    void initializeUpdater()

    protocol.registerBufferProtocol(FILE_PROTOCOL, (request, callback) => {
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

            // Read file and return as buffer with permissive CSP
            import('fs').then(({ readFile }) => {
                readFile(filePath, (err, data) => {
                    if (err) {
                        log.error('Failed to read file:', filePath, err)
                        callback({ statusCode: 404, data: Buffer.from('') })
                        return
                    }

                    // Determine MIME type
                    const ext = filePath.split('.').pop()?.toLowerCase() || ''
                    const mimeTypes: Record<string, string> = {
                        'html': 'text/html',
                        'htm': 'text/html',
                        'css': 'text/css',
                        'js': 'application/javascript',
                        'json': 'application/json',
                        'png': 'image/png',
                        'jpg': 'image/jpeg',
                        'jpeg': 'image/jpeg',
                        'gif': 'image/gif',
                        'svg': 'image/svg+xml',
                        'mp4': 'video/mp4',
                        'webm': 'video/webm'
                    }
                    const mimeType = mimeTypes[ext] || 'application/octet-stream'

                    callback({
                        statusCode: 200,
                        data,
                        mimeType,
                        headers: {
                            'Content-Security-Policy': "default-src * 'unsafe-inline' 'unsafe-eval' data: blob:;"
                        }
                    })
                })
            }).catch(err => {
                log.error('Failed to import fs:', err)
                callback({ statusCode: 500, data: Buffer.from('') })
            })
        } catch (err) {
            log.error('Failed to resolve protocol URL:', request.url, err)
            callback({ statusCode: 500, data: Buffer.from('') })
        }
    })

    // Keep the full app alive in background for quick-file preview launches.
    const launchHidden = Boolean(initialAssociatedFilePath)
    mainWindow = createWindow(!launchHidden)
    ensureIpcHandlersRegistered(mainWindow)
    if (initialAssociatedFilePath) {
        createQuickPreviewWindow(initialAssociatedFilePath)
    }

    app.on('activate', function () {
        if (!mainWindow || mainWindow.isDestroyed()) {
            mainWindow = createWindow(true)
            ensureIpcHandlersRegistered(mainWindow)
            return
        }
        if (!mainWindow.isVisible()) mainWindow.show()
        mainWindow.focus()
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
    disposeUpdater()
    if (process.platform !== 'darwin') {
        app.quit()
    }
})

app.on('before-quit', () => {
    disposeUpdater()
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


