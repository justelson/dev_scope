/**
 * DevScope - IPC Handlers
 * Exposes backend data via Electron IPC
 */

import { ipcMain, app, dialog, shell, BrowserWindow, clipboard } from 'electron'
import { writeFile, readFile, readdir, stat, access, open as fsOpen, unlink } from 'fs/promises'
import { join, relative, dirname } from 'path'
import { spawn } from 'child_process'
import log from 'electron-log'
import si from 'systeminformation'
import {
    getSystemInfo,
    sensingEngine
} from '../inspectors'
import { invalidateUnifiedBatchCache } from '../inspectors/unified-batch-scanner'
import {
    getGitStatus,
    GitFileStatus,
    getGitHistory,
    getCommitDiff,
    getWorkingDiff,
    getUnpushedCommits,
    getGitUser,
    getRepoOwner,
    stageFiles,
    unstageFiles,
    discardChanges,
    createCommit,
    pushCommits,
    fetchUpdates,
    pullUpdates,
    listBranches,
    createBranch,
    checkoutBranch,
    deleteBranch,
    listRemotes,
    setRemoteUrl,
    removeRemote,
    listTags,
    createTag,
    deleteTag,
    listStashes,
    createStash,
    applyStash,
    dropStash,
    checkIsGitRepo,
    initGitRepo,
    createInitialCommit,
    addRemoteOrigin,
    getGitignoreTemplates,
    generateGitignoreContent,
    getGitignorePatterns,
    generateCustomGitignoreContent,
    hasRemoteOrigin,
    getProjectsGitOverview as getProjectsGitOverviewBatch
} from '../inspectors/git'
import { clearCommandCache } from '../inspectors/safe-exec'
import type {
    SystemHealth,
    ToolingReport,
    ReadinessReport,
    FullReport
} from '../inspectors/types'
import { calculateReadiness } from '../readiness/scorer'
import { systemMetricsBridge } from '../system-metrics/manager'
import { testGroqConnection, generateCommitMessage as generateGroqCommitMessage } from '../ai/groq'
import { testGeminiConnection, generateGeminiCommitMessage } from '../ai/gemini'
// Temporarily inlined to debug ESM issue
interface ProjectTypeDefinition {
    id: string
    displayName: string
    icon: string
    themeColor: string
    markers: string[]
    description: string
}

interface FrameworkDefinition {
    id: string
    displayName: string
    icon: string
    themeColor: string
    parentType: string
    detectPatterns: {
        dependencies?: string[]
        devDependencies?: string[]
        files?: string[]
        configFiles?: string[]
    }
}

const PROJECT_TYPES: ProjectTypeDefinition[] = [
    { id: 'node', displayName: 'Node.js', icon: 'nodedotjs', themeColor: '#339933', markers: ['package.json'], description: 'JavaScript/Node.js project' },
    { id: 'python', displayName: 'Python', icon: 'python', themeColor: '#3776AB', markers: ['requirements.txt', 'pyproject.toml', 'setup.py', 'Pipfile'], description: 'Python project' },
    { id: 'rust', displayName: 'Rust', icon: 'rust', themeColor: '#DEA584', markers: ['Cargo.toml'], description: 'Rust project' },
    { id: 'go', displayName: 'Go', icon: 'go', themeColor: '#00ADD8', markers: ['go.mod'], description: 'Go/Golang project' },
    { id: 'java', displayName: 'Java', icon: 'openjdk', themeColor: '#007396', markers: ['pom.xml', 'build.gradle', 'build.gradle.kts'], description: 'Java project' },
    { id: 'dotnet', displayName: '.NET', icon: 'dotnet', themeColor: '#512BD4', markers: ['*.csproj', '*.sln', '*.fsproj'], description: '.NET/C# project' },
    { id: 'ruby', displayName: 'Ruby', icon: 'ruby', themeColor: '#CC342D', markers: ['Gemfile'], description: 'Ruby project' },
    { id: 'php', displayName: 'PHP', icon: 'php', themeColor: '#777BB4', markers: ['composer.json'], description: 'PHP project' },
    { id: 'dart', displayName: 'Dart/Flutter', icon: 'dart', themeColor: '#0175C2', markers: ['pubspec.yaml'], description: 'Dart or Flutter project' },
    { id: 'elixir', displayName: 'Elixir', icon: 'elixir', themeColor: '#4B275F', markers: ['mix.exs'], description: 'Elixir project' },
    { id: 'cpp', displayName: 'C/C++', icon: 'cplusplus', themeColor: '#00599C', markers: ['CMakeLists.txt', 'Makefile'], description: 'C or C++ project' },
    { id: 'git', displayName: 'Git Repository', icon: 'git', themeColor: '#F05032', markers: ['.git'], description: 'Version controlled folder' }
]

const FRAMEWORKS: FrameworkDefinition[] = [
    { id: 'react', displayName: 'React', icon: 'react', themeColor: '#61DAFB', parentType: 'node', detectPatterns: { dependencies: ['react', 'react-dom'] } },
    { id: 'nextjs', displayName: 'Next.js', icon: 'nextdotjs', themeColor: '#000000', parentType: 'node', detectPatterns: { dependencies: ['next'], configFiles: ['next.config.js', 'next.config.mjs', 'next.config.ts'] } },
    { id: 'vue', displayName: 'Vue.js', icon: 'vuedotjs', themeColor: '#4FC08D', parentType: 'node', detectPatterns: { dependencies: ['vue'] } },
    { id: 'angular', displayName: 'Angular', icon: 'angular', themeColor: '#DD0031', parentType: 'node', detectPatterns: { dependencies: ['@angular/core'], configFiles: ['angular.json'] } },
    { id: 'electron', displayName: 'Electron', icon: 'electron', themeColor: '#47848F', parentType: 'node', detectPatterns: { dependencies: ['electron'], devDependencies: ['electron', 'electron-builder', 'electron-vite'] } },
    { id: 'express', displayName: 'Express', icon: 'express', themeColor: '#000000', parentType: 'node', detectPatterns: { dependencies: ['express'] } },
    { id: 'vite', displayName: 'Vite', icon: 'vite', themeColor: '#646CFF', parentType: 'node', detectPatterns: { devDependencies: ['vite'], configFiles: ['vite.config.js', 'vite.config.ts'] } },
    { id: 'tailwind', displayName: 'Tailwind CSS', icon: 'tailwindcss', themeColor: '#06B6D4', parentType: 'node', detectPatterns: { devDependencies: ['tailwindcss'], configFiles: ['tailwind.config.js', 'tailwind.config.ts'] } },
    { id: 'typescript', displayName: 'TypeScript', icon: 'typescript', themeColor: '#3178C6', parentType: 'node', detectPatterns: { devDependencies: ['typescript'], configFiles: ['tsconfig.json'] } }
]

function detectProjectTypeFromMarkers(markers: string[]): ProjectTypeDefinition | undefined {
    for (const type of PROJECT_TYPES) {
        if (type.id === 'git') continue
        for (const marker of type.markers) {
            if (marker.startsWith('*')) {
                const ext = marker.slice(1)
                if (markers.some(m => m.endsWith(ext))) return type
            } else {
                if (markers.includes(marker)) return type
            }
        }
    }
    if (markers.includes('.git')) return PROJECT_TYPES.find(t => t.id === 'git')
    return undefined
}

function detectFrameworksFromPackageJson(
    packageJson: { dependencies?: Record<string, string>; devDependencies?: Record<string, string> },
    fileList: string[]
): FrameworkDefinition[] {
    const detected: FrameworkDefinition[] = []
    const deps = packageJson.dependencies || {}
    const devDeps = packageJson.devDependencies || {}

    for (const framework of FRAMEWORKS.filter(f => f.parentType === 'node')) {
        const patterns = framework.detectPatterns
        let matched = false
        if (patterns.dependencies?.some(d => d in deps)) matched = true
        if (patterns.devDependencies?.some(d => d in devDeps)) matched = true
        if (patterns.configFiles?.some(f => fileList.includes(f))) matched = true
        if (matched) detected.push(framework)
    }
    return detected
}

async function handleSystemMetricsBootstrap() {
    log.info('IPC: system:bootstrap')
    return await systemMetricsBridge.bootstrap()
}

function handleSystemMetricsSubscribe(event: Electron.IpcMainInvokeEvent, options?: { intervalMs?: number }) {
    log.info('IPC: system:subscribe')
    return systemMetricsBridge.subscribe(event.sender.id, options?.intervalMs)
}

function handleSystemMetricsUnsubscribe(event: Electron.IpcMainInvokeEvent) {
    log.info('IPC: system:unsubscribe')
    return systemMetricsBridge.unsubscribe(event.sender.id)
}

function handleSystemMetricsRead() {
    return systemMetricsBridge.getLiveMetrics()
}
/**
 * Get system overview (CPU, GPU, RAM, Disk, OS)
 */
async function handleGetSystemOverview(): Promise<SystemHealth> {
    log.info('IPC: getSystemOverview')
    return getSystemInfo()
}

/**
 * Get detailed system stats (for System page)
 */
async function handleGetDetailedSystemStats() {
    log.info('IPC: getDetailedSystemStats')
    return systemMetricsBridge.getSnapshot()
}

/**
 * Get developer tooling report
 */
async function handleGetDeveloperTooling(): Promise<ToolingReport> {
    log.info('IPC: getDeveloperTooling (SensingEngine)')

    const [languages, packageManagers, buildTools, containers, versionControl, browsers, databases] = await Promise.all([
        sensingEngine.scanCategory('language'),
        sensingEngine.scanCategory('package_manager'),
        sensingEngine.scanCategory('build_tool'),
        sensingEngine.scanCategory('container'),
        sensingEngine.scanCategory('version_control'),
        sensingEngine.scanCategory('browser'),
        sensingEngine.scanCategory('database')
    ])

    return {
        languages,
        packageManagers,
        buildTools,
        containers,
        versionControl,
        timestamp: Date.now()
    }
}

/**
 * Get readiness report
 */
async function handleGetReadinessReport(): Promise<ReadinessReport> {
    log.info('IPC: getReadinessReport')

    const tooling = await handleGetDeveloperTooling()
    const aiRuntime = { llmRuntimes: [], gpuAcceleration: [], aiFrameworks: [], timestamp: Date.now() }

    return calculateReadiness(tooling, aiRuntime as any)
}

/**
 * Refresh all data
 */
async function handleRefreshAll(): Promise<FullReport> {
    log.info('IPC: refreshAll')

    // Clear ALL caches for truly fresh data
    clearCommandCache()
    invalidateUnifiedBatchCache()
    systemMetricsBridge.invalidateStaticSnapshot()

    const [system, tooling] = await Promise.all([
        handleGetSystemOverview(),
        handleGetDeveloperTooling()
    ])

    const aiRuntime = { llmRuntimes: [], gpuAcceleration: [], aiFrameworks: [], timestamp: Date.now() }
    const readiness = calculateReadiness(tooling, aiRuntime as any)

    return {
        system,
        tooling,
        aiRuntime,
        readiness,
        timestamp: Date.now()
    }
}

/**
 * Get file system roots (drives/mount points)
 */
async function handleGetFileSystemRoots() {
    log.info('IPC: getFileSystemRoots')

    try {
        const fsList = await si.fsSize().catch(() => [])
        const roots = Array.from(new Set(
            fsList
                .map((entry: any) => entry.mount)
                .filter((mount: string) => !!mount)
                .map((mount: string) => {
                    if (process.platform === 'win32') {
                        return mount.endsWith('\\') ? mount : `${mount}\\`
                    }
                    return mount
                })
        )).sort()

        if (roots.length > 0) {
            return { success: true, roots }
        }

        return { success: true, roots: [process.platform === 'win32' ? 'C:\\' : '/'] }
    } catch (err: any) {
        log.error('Failed to get file system roots:', err)
        return { success: false, error: err.message }
    }
}

/**
 * Register all IPC handlers
 */
export function registerIpcHandlers(mainWindow: BrowserWindow): void {
    log.info('Registering IPC handlers...')

    // System shared-memory data path
    ipcMain.handle('devscope:system:bootstrap', handleSystemMetricsBootstrap)
    ipcMain.handle('devscope:system:subscribe', handleSystemMetricsSubscribe)
    ipcMain.handle('devscope:system:unsubscribe', handleSystemMetricsUnsubscribe)
    ipcMain.handle('devscope:system:readMetrics', handleSystemMetricsRead)

    // System & Tooling
    ipcMain.handle('devscope:getSystemOverview', handleGetSystemOverview)
    ipcMain.handle('devscope:getDetailedSystemStats', handleGetDetailedSystemStats)
    ipcMain.handle('devscope:getDeveloperTooling', handleGetDeveloperTooling)    ipcMain.handle('devscope:getReadinessReport', handleGetReadinessReport)
    ipcMain.handle('devscope:refreshAll', handleRefreshAll)
    // Settings
    ipcMain.handle('devscope:exportData', handleExportData)
    ipcMain.handle('devscope:setStartupSettings', handleSetStartupSettings)
    ipcMain.handle('devscope:getStartupSettings', handleGetStartupSettings)
    ipcMain.handle('devscope:testGroqConnection', handleTestGroqConnection)
    ipcMain.handle('devscope:testGeminiConnection', handleTestGeminiConnection)
    ipcMain.handle('devscope:generateCommitMessage', handleGenerateCommitMessage)

    // Projects
    ipcMain.handle('devscope:selectFolder', handleSelectFolder)
    ipcMain.handle('devscope:scanProjects', handleScanProjects)
    ipcMain.handle('devscope:openInExplorer', handleOpenInExplorer)
    ipcMain.handle('devscope:openInTerminal', handleOpenInTerminal)
    ipcMain.handle('devscope:copyToClipboard', handleCopyToClipboard)
    ipcMain.handle('devscope:getProjectDetails', handleGetProjectDetails)
    ipcMain.handle('devscope:getFileTree', handleGetFileTree)
    ipcMain.handle('devscope:getGitHistory', handleGetGitHistory)
    ipcMain.handle('devscope:getCommitDiff', handleGetCommitDiff)
    ipcMain.handle('devscope:getWorkingDiff', handleGetWorkingDiff)
    ipcMain.handle('devscope:getGitStatus', handleGetGitStatus)
    ipcMain.handle('devscope:getUnpushedCommits', handleGetUnpushedCommits)
    ipcMain.handle('devscope:getGitUser', handleGetGitUser)
    ipcMain.handle('devscope:getRepoOwner', handleGetRepoOwner)
    ipcMain.handle('devscope:hasRemoteOrigin', handleHasRemoteOrigin)
    ipcMain.handle('devscope:getProjectsGitOverview', handleGetProjectsGitOverview)
    ipcMain.handle('devscope:stageFiles', handleStageFiles)
    ipcMain.handle('devscope:unstageFiles', handleUnstageFiles)
    ipcMain.handle('devscope:discardChanges', handleDiscardChanges)
    ipcMain.handle('devscope:createCommit', handleCreateCommit)
    ipcMain.handle('devscope:pushCommits', handlePushCommits)
    ipcMain.handle('devscope:fetchUpdates', handleFetchUpdates)
    ipcMain.handle('devscope:pullUpdates', handlePullUpdates)
    ipcMain.handle('devscope:listBranches', handleListBranches)
    ipcMain.handle('devscope:createBranch', handleCreateBranch)
    ipcMain.handle('devscope:checkoutBranch', handleCheckoutBranch)
    ipcMain.handle('devscope:deleteBranch', handleDeleteBranch)
    ipcMain.handle('devscope:listRemotes', handleListRemotes)
    ipcMain.handle('devscope:setRemoteUrl', handleSetRemoteUrl)
    ipcMain.handle('devscope:removeRemote', handleRemoveRemote)
    ipcMain.handle('devscope:listTags', handleListTags)
    ipcMain.handle('devscope:createTag', handleCreateTag)
    ipcMain.handle('devscope:deleteTag', handleDeleteTag)
    ipcMain.handle('devscope:listStashes', handleListStashes)
    ipcMain.handle('devscope:createStash', handleCreateStash)
    ipcMain.handle('devscope:applyStash', handleApplyStash)
    ipcMain.handle('devscope:dropStash', handleDropStash)
    ipcMain.handle('devscope:checkIsGitRepo', handleCheckIsGitRepo)
    ipcMain.handle('devscope:initGitRepo', handleInitGitRepo)
    ipcMain.handle('devscope:createInitialCommit', handleCreateInitialCommit)
    ipcMain.handle('devscope:addRemoteOrigin', handleAddRemoteOrigin)
    ipcMain.handle('devscope:getGitignoreTemplates', handleGetGitignoreTemplates)
    ipcMain.handle('devscope:generateGitignoreContent', handleGenerateGitignoreContent)
    ipcMain.handle('devscope:getGitignorePatterns', handleGetGitignorePatterns)
    ipcMain.handle('devscope:generateCustomGitignoreContent', handleGenerateCustomGitignoreContent)
    ipcMain.handle('devscope:readFileContent', handleReadFileContent)
    ipcMain.handle('devscope:openFile', handleOpenFile)
    ipcMain.handle('devscope:getProjectSessions', handleGetProjectSessions)
    ipcMain.handle('devscope:getProjectProcesses', handleGetProjectProcesses)
    ipcMain.handle('devscope:indexAllFolders', handleIndexAllFolders)
    ipcMain.handle('devscope:getFileSystemRoots', handleGetFileSystemRoots)
    log.info('IPC handlers registered')
}

/**
 * Export data to JSON file
 */
async function handleExportData(_event: Electron.IpcMainInvokeEvent, data: any) {
    log.info('IPC: exportData')

    try {
        const result = await dialog.showSaveDialog({
            title: 'Export DevScope Data',
            defaultPath: `devscope-export-${new Date().toISOString().split('T')[0]}.json`,
            filters: [
                { name: 'JSON Files', extensions: ['json'] },
                { name: 'All Files', extensions: ['*'] }
            ]
        })

        if (result.canceled || !result.filePath) {
            return { success: false, cancelled: true }
        }

        await writeFile(result.filePath, JSON.stringify(data, null, 2), 'utf-8')
        return { success: true, filePath: result.filePath }
    } catch (err: any) {
        log.error('Export failed:', err)
        return { success: false, error: err.message }
    }
}

/**
 * Set startup settings (start with Windows, start minimized)
 */
async function handleSetStartupSettings(_event: Electron.IpcMainInvokeEvent, settings: { openAtLogin: boolean; openAsHidden: boolean }) {
    log.info('IPC: setStartupSettings', settings)

    try {
        app.setLoginItemSettings({
            openAtLogin: settings.openAtLogin,
            openAsHidden: settings.openAsHidden,
            args: settings.openAsHidden ? ['--hidden'] : []
        })
        return { success: true }
    } catch (err: any) {
        log.error('Failed to set startup settings:', err)
        return { success: false, error: err.message }
    }
}

/**
 * Get current startup settings
 */
async function handleGetStartupSettings() {
    log.info('IPC: getStartupSettings')

    try {
        const settings = app.getLoginItemSettings()
        return {
            success: true,
            openAtLogin: settings.openAtLogin,
            openAsHidden: settings.openAsHidden
        }
    } catch (err: any) {
        log.error('Failed to get startup settings:', err)
        return { success: false, error: err.message }
    }
}

type CommitAIProvider = 'groq' | 'gemini'

async function handleTestGroqConnection(_event: Electron.IpcMainInvokeEvent, apiKey: string) {
    if (!apiKey?.trim()) {
        return { success: false, error: 'Groq API key is required' }
    }
    return testGroqConnection(apiKey.trim())
}

async function handleTestGeminiConnection(_event: Electron.IpcMainInvokeEvent, apiKey: string) {
    if (!apiKey?.trim()) {
        return { success: false, error: 'Gemini API key is required' }
    }
    return testGeminiConnection(apiKey.trim())
}

async function handleGenerateCommitMessage(
    _event: Electron.IpcMainInvokeEvent,
    provider: CommitAIProvider,
    apiKey: string,
    diff: string
) {
    if (!apiKey?.trim()) {
        return { success: false, error: 'API key is required' }
    }
    if (!diff?.trim()) {
        return { success: false, error: 'No changes to summarize' }
    }
    if (diff.trim() === 'No changes') {
        return { success: false, error: 'No changes to summarize' }
    }

    if (provider === 'gemini') {
        return generateGeminiCommitMessage(apiKey.trim(), diff)
    }

    return generateGroqCommitMessage(apiKey.trim(), diff)
}

/**
 * Select a folder using native dialog
 */
async function handleSelectFolder(event: Electron.IpcMainInvokeEvent) {
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

// Project markers to detect
const PROJECT_MARKERS = [
    // Web/Backend
    'package.json',      // Node.js
    'Cargo.toml',        // Rust
    'go.mod',            // Go
    'pom.xml',           // Java Maven
    'build.gradle',      // Java Gradle
    'build.gradle.kts',  // Java/Kotlin Gradle
    'requirements.txt',  // Python
    'pyproject.toml',    // Python
    'setup.py',          // Python
    'Gemfile',           // Ruby
    'composer.json',     // PHP
    '.git',              // Git repo
    '*.csproj',          // .NET
    '*.sln',             // .NET Solution
    'CMakeLists.txt',    // C/C++ CMake
    'Makefile',          // Make
    'pubspec.yaml',      // Dart/Flutter
    'mix.exs',           // Elixir
    'deno.json',         // Deno
    'bun.lockb',         // Bun
    // Mobile Apps
    'settings.gradle',       // Android
    'settings.gradle.kts',   // Android Kotlin
    'AndroidManifest.xml',   // Android
    '*.xcodeproj',           // iOS/macOS Xcode
    '*.xcworkspace',         // iOS/macOS Xcode Workspace
    'Podfile',               // iOS CocoaPods
    'metro.config.js',       // React Native
    'app.json',              // React Native / Expo
    'ionic.config.json',     // Ionic
    'capacitor.config.json', // Capacitor
    'capacitor.config.ts',   // Capacitor
    // Desktop Apps
    'electron.vite.config.ts',  // Electron Vite
    'electron-builder.yml',     // Electron Builder
    'electron-builder.json',    // Electron Builder
    'tauri.conf.json',          // Tauri
    'src-tauri',                // Tauri folder
    '*.pro',                    // Qt
    '*.qml',                    // Qt QML
    '*.xaml',                   // WPF/MAUI
    '*.Designer.cs',            // WinForms
    'ContentView.swift',        // SwiftUI
]

/**
 * Scan a folder for coding projects with enhanced framework detection
 */
async function handleScanProjects(_event: Electron.IpcMainInvokeEvent, folderPath: string) {
    log.info('IPC: scanProjects', folderPath)

    try {
        // Check if folder exists
        await access(folderPath)

        const entries = await readdir(folderPath, { withFileTypes: true })
        const projects: Array<{
            name: string
            path: string
            type: string
            typeInfo?: ProjectTypeDefinition
            markers: string[]
            frameworks: string[]
            frameworkInfo?: FrameworkDefinition[]
            lastModified?: number
            isProject: boolean
        }> = []
        const folders: Array<{
            name: string
            path: string
            lastModified?: number
            isProject: boolean
        }> = []
        const files: Array<{
            name: string
            path: string
            size: number
            lastModified?: number
            extension: string
        }> = []

        for (const entry of entries) {
            // Handle files
            if (entry.isFile()) {
                const isHidden = entry.name.startsWith('.')
                if (!isHidden) {
                    try {
                        const filePath = join(folderPath, entry.name)
                        const stats = await stat(filePath)
                        const ext = entry.name.includes('.') ? entry.name.split('.').pop() || '' : ''
                        files.push({
                            name: entry.name,
                            path: filePath,
                            size: stats.size,
                            lastModified: stats.mtimeMs,
                            extension: ext
                        })
                    } catch (err) {
                        // Skip files we can't stat
                    }
                }
                continue
            }

            if (!entry.isDirectory()) continue
            // Only skip node_modules folder, NOT .git folders - we want to detect repos
            if (entry.name === 'node_modules') continue

            const isHidden = entry.name.startsWith('.')
            const projectPath = join(folderPath, entry.name)
            const markers: string[] = []
            let frameworks: string[] = []
            let frameworkInfo: FrameworkDefinition[] = []

            try {
                const projectEntries = await readdir(projectPath)

                // Check for .git folder first (git repository)
                if (projectEntries.includes('.git')) {
                    markers.push('.git')
                }

                for (const marker of PROJECT_MARKERS) {
                    if (marker === '.git') continue // Already handled
                    if (marker.startsWith('*')) {
                        const ext = marker.slice(1)
                        if (projectEntries.some(e => e.endsWith(ext))) {
                            markers.push(marker)
                        }
                    } else {
                        if (projectEntries.includes(marker)) {
                            markers.push(marker)
                        }
                    }
                }

                const projectType = detectProjectTypeFromMarkers(markers)

                // Detect frameworks for Node.js projects
                if (projectType?.id === 'node' && projectEntries.includes('package.json')) {
                    try {
                        const pkgPath = join(projectPath, 'package.json')
                        const pkgContent = await readFile(pkgPath, 'utf-8')
                        const packageJson = JSON.parse(pkgContent)

                        frameworkInfo = detectFrameworksFromPackageJson(packageJson, projectEntries)
                        frameworks = frameworkInfo.map(f => f.id)
                    } catch (err) {
                        log.warn(`Could not parse package.json in ${projectPath}`, err)
                    }
                }

                const stats = await stat(projectPath)

                if (markers.length > 0) {
                    // This is a project
                    projects.push({
                        name: entry.name,
                        path: projectPath,
                        type: projectType?.id || 'unknown',
                        typeInfo: projectType,
                        markers,
                        frameworks,
                        frameworkInfo,
                        lastModified: stats.mtimeMs,
                        isProject: true
                    })
                } else if (!isHidden) {
                    // Regular folder that might contain nested projects
                    folders.push({
                        name: entry.name,
                        path: projectPath,
                        lastModified: stats.mtimeMs,
                        isProject: false
                    })
                }
            } catch (err) {
                log.warn(`Could not scan project folder: ${projectPath}`, err)
            }
        }

        // Sort projects by last modified (most recent first), folders alphabetically, files by name
        projects.sort((a, b) => (b.lastModified || 0) - (a.lastModified || 0))
        folders.sort((a, b) => a.name.localeCompare(b.name))
        files.sort((a, b) => a.name.localeCompare(b.name))

        log.info(`Found ${projects.length} projects, ${folders.length} folders, and ${files.length} files in ${folderPath}`)
        return { success: true, projects, folders, files }
    } catch (err: any) {
        log.error('Failed to scan projects:', err)
        return { success: false, error: err.message }
    }
}

/**
 * Index all configured project folders
 * Recursively scans folders and subfolders to find all projects
 */
async function handleIndexAllFolders(_event: Electron.IpcMainInvokeEvent, folders: string[]) {
    log.info('IPC: indexAllFolders', folders)

    const MAX_DEPTH = Number.POSITIVE_INFINITY // Index all nested folders
    const allProjects: Array<{
        name: string
        path: string
        type: string
        markers: string[]
        frameworks: string[]
        lastModified?: number
        sourceFolder: string
        depth: number
    }> = []

    const errors: Array<{ folder: string; error: string }> = []
    const scannedPaths = new Set<string>() // Prevent duplicate scans

    // Recursive function to scan a folder and its subfolders
    async function scanRecursively(folderPath: string, sourceFolder: string, depth: number): Promise<void> {
        if (depth > MAX_DEPTH) return
        if (scannedPaths.has(folderPath)) return
        scannedPaths.add(folderPath)

        try {
            const result = await handleScanProjects(_event, folderPath)

            if (result.success) {
                // Add found projects
                if (result.projects) {
                    for (const project of result.projects) {
                        allProjects.push({
                            ...project,
                            sourceFolder,
                            depth
                        })
                    }
                }

                // Recursively scan non-project folders
                if (result.folders && depth < MAX_DEPTH) {
                    for (const subfolder of result.folders) {
                        // Skip obvious non-project folders
                        const skipFolders = ['node_modules', '.git', 'dist', 'build', 'target', '__pycache__', '.venv', 'venv', '.next', '.nuxt']
                        if (skipFolders.includes(subfolder.name)) continue

                        await scanRecursively(subfolder.path, sourceFolder, depth + 1)
                    }
                }
            }
        } catch (err: any) {
            if (depth === 0) {
                errors.push({ folder: folderPath, error: err.message })
            }
            // Silently ignore errors for nested folders
        }
    }

    // Scan each root folder
    for (const folder of folders) {
        if (!folder) continue
        await scanRecursively(folder, folder, 0)
    }

    // Sort by last modified
    allProjects.sort((a, b) => (b.lastModified || 0) - (a.lastModified || 0))

    log.info(`Indexed ${allProjects.length} projects from ${folders.length} folders (max depth: unlimited)`)

    return {
        success: errors.length === 0 || allProjects.length > 0,
        projects: allProjects,
        totalFolders: folders.length,
        indexedFolders: scannedPaths.size,
        scannedFolderPaths: Array.from(scannedPaths).sort((a, b) => a.localeCompare(b)),
        indexedCount: allProjects.length,
        errors: errors.length > 0 ? errors : undefined
    }
}

/**
 * Detect project type from markers
 */
function detectProjectType(markers: string[]): string {
    if (markers.includes('package.json')) return 'node'
    if (markers.includes('Cargo.toml')) return 'rust'
    if (markers.includes('go.mod')) return 'go'
    if (markers.includes('pom.xml') || markers.includes('build.gradle')) return 'java'
    if (markers.includes('requirements.txt') || markers.includes('pyproject.toml') || markers.includes('setup.py')) return 'python'
    if (markers.includes('Gemfile')) return 'ruby'
    if (markers.includes('composer.json')) return 'php'
    if (markers.some(m => m.includes('.csproj') || m.includes('.sln'))) return 'dotnet'
    if (markers.includes('pubspec.yaml')) return 'dart'
    if (markers.includes('mix.exs')) return 'elixir'
    if (markers.includes('.git')) return 'git'
    return 'unknown'
}

/**
 * Open a path in the system file explorer
 */
async function handleOpenInExplorer(_event: Electron.IpcMainInvokeEvent, path: string) {
    log.info('IPC: openInExplorer', path)

    try {
        const result = await shell.openPath(path)
        if (result) {
            // shell.openPath returns error string if failed, empty string if success
            log.error('shell.openPath failed:', result)
            return { success: false, error: result }
        }
        return { success: true }
    } catch (err: any) {
        log.error('Failed to open in explorer:', err)
        return { success: false, error: err.message }
    }
}

/**
 * Open a file with its default application
 */
async function handleOpenFile(_event: Electron.IpcMainInvokeEvent, filePath: string) {
    log.info('IPC: openFile', filePath)

    try {
        const result = await shell.openPath(filePath)
        if (result) {
            // shell.openPath returns error string if failed, empty string if success
            log.error('shell.openPath failed:', result)
            return { success: false, error: result }
        }
        return { success: true }
    } catch (err: any) {
        log.error('Failed to open file:', err)
        return { success: false, error: err.message }
    }
}

async function handleCopyToClipboard(_event: Electron.IpcMainInvokeEvent, text: string) {
    try {
        clipboard.writeText(text)
        return { success: true }
    } catch (err: any) {
        log.error('Failed to write to clipboard:', err)
        return { success: false, error: err.message }
    }
}

/**
 * Get detailed project information including README and structure
 */
async function handleGetProjectDetails(_event: Electron.IpcMainInvokeEvent, projectPath: string) {
    log.info('IPC: getProjectDetails', projectPath)

    try {
        await access(projectPath)

        const entries = await readdir(projectPath)
        const markers: string[] = []
        let readme: string | null = null
        let packageJson: any = null
        let frameworks: FrameworkDefinition[] = []

        // Check for README
        const readmeFile = entries.find(e =>
            e.toLowerCase().startsWith('readme') &&
            (e.endsWith('.md') || e.endsWith('.txt') || !e.includes('.'))
        )
        if (readmeFile) {
            try {
                readme = await readFile(join(projectPath, readmeFile), 'utf-8')
            } catch (err) {
                log.warn('Could not read README', err)
            }
        }

        // Detect markers
        for (const marker of PROJECT_MARKERS) {
            if (marker.startsWith('*')) {
                const ext = marker.slice(1)
                if (entries.some(e => e.endsWith(ext))) {
                    markers.push(marker)
                }
            } else {
                if (entries.includes(marker)) {
                    markers.push(marker)
                }
            }
        }

        const projectType = detectProjectTypeFromMarkers(markers)

        // Parse package.json if exists
        if (entries.includes('package.json')) {
            try {
                const pkgContent = await readFile(join(projectPath, 'package.json'), 'utf-8')
                packageJson = JSON.parse(pkgContent)
                frameworks = detectFrameworksFromPackageJson(packageJson, entries)
            } catch (err) {
                log.warn('Could not parse package.json', err)
            }
        }

        const stats = await stat(projectPath)
        const folderName = projectPath.split(/[\\/]/).pop() || 'Unknown'

        return {
            success: true,
            project: {
                name: packageJson?.name || folderName,
                displayName: packageJson?.name || folderName,
                path: projectPath,
                type: projectType?.id || 'unknown',
                typeInfo: projectType,
                markers,
                frameworks: frameworks.map(f => f.id),
                frameworkInfo: frameworks,
                description: packageJson?.description || null,
                version: packageJson?.version || null,
                readme,
                lastModified: stats.mtimeMs,
                scripts: packageJson?.scripts || null,
                dependencies: packageJson?.dependencies || null,
                devDependencies: packageJson?.devDependencies || null
            }
        }
    } catch (err: any) {
        log.error('Failed to get project details:', err)
        return { success: false, error: err.message }
    }
}

// File tree node interface
interface FileTreeNode {
    name: string
    path: string
    type: 'file' | 'directory'
    size?: number
    children?: FileTreeNode[]
    isHidden: boolean
    gitStatus?: GitFileStatus
}

const PREVIEW_MAX_BYTES = 2 * 1024 * 1024 // 2MB preview cap to prevent renderer crashes
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

/**
 * Get git history for a project
 */
async function handleGetGitHistory(_event: Electron.IpcMainInvokeEvent, projectPath: string) {
    try {
        const result = await getGitHistory(projectPath)
        return { success: true, ...result }
    } catch (err: any) {
        log.error('Failed to get git history:', err)
        return { success: false, error: err.message }
    }
}

/**
 * Get diff for a specific commit
 */
async function handleGetCommitDiff(_event: Electron.IpcMainInvokeEvent, projectPath: string, commitHash: string) {
    try {
        const diff = await getCommitDiff(projectPath, commitHash)
        return { success: true, diff }
    } catch (err: any) {
        log.error('Failed to get commit diff:', err)
        return { success: false, error: err.message }
    }
}

/**
 * Get diff for working changes
 */
async function handleGetWorkingDiff(_event: Electron.IpcMainInvokeEvent, projectPath: string, filePath?: string) {
    try {
        const diff = await getWorkingDiff(projectPath, filePath)
        return { success: true, diff }
    } catch (err: any) {
        log.error('Failed to get working diff:', err)
        return { success: false, error: err.message }
    }
}

/**
 * Get full git status map for a repository
 */
async function handleGetGitStatus(_event: Electron.IpcMainInvokeEvent, projectPath: string) {
    try {
        const status = await getGitStatus(projectPath)
        return { success: true, status }
    } catch (err: any) {
        log.error('Failed to get git status:', err)
        return { success: false, error: err.message, status: {} }
    }
}

/**
 * Get unpushed commits
 */
async function handleGetUnpushedCommits(_event: Electron.IpcMainInvokeEvent, projectPath: string) {
    try {
        const commits = await getUnpushedCommits(projectPath)
        return { success: true, commits }
    } catch (err: any) {
        log.error('Failed to get unpushed commits:', err)
        return { success: false, error: err.message }
    }
}

/**
 * Get git user info
 */
async function handleGetGitUser(_event: Electron.IpcMainInvokeEvent, projectPath: string) {
    try {
        const user = await getGitUser(projectPath)
        return { success: true, user }
    } catch (err: any) {
        log.error('Failed to get git user:', err)
        return { success: false, error: err.message }
    }
}

/**
 * Get repo owner
 */
async function handleGetRepoOwner(_event: Electron.IpcMainInvokeEvent, projectPath: string) {
    try {
        const owner = await getRepoOwner(projectPath)
        return { success: true, owner }
    } catch (err: any) {
        log.error('Failed to get repo owner:', err)
        return { success: false, error: err.message }
    }
}

/**
 * Check if remote origin exists
 */
async function handleHasRemoteOrigin(_event: Electron.IpcMainInvokeEvent, projectPath: string) {
    try {
        const hasRemote = await hasRemoteOrigin(projectPath)
        return { success: true, hasRemote }
    } catch (err: any) {
        log.error('Failed to check remote origin:', err)
        return { success: false, error: err.message, hasRemote: false }
    }
}

/**
 * Batch git overview for multiple project paths
 */
async function handleGetProjectsGitOverview(_event: Electron.IpcMainInvokeEvent, projectPaths: string[]) {
    try {
        const safePaths = Array.isArray(projectPaths)
            ? projectPaths.filter((path): path is string => typeof path === 'string' && path.trim().length > 0)
            : []
        const items = await getProjectsGitOverviewBatch(safePaths)
        return { success: true, items }
    } catch (err: any) {
        log.error('Failed to get project git overview:', err)
        return { success: false, error: err.message, items: [] }
    }
}

/**
 * Stage files
 */
async function handleStageFiles(_event: Electron.IpcMainInvokeEvent, projectPath: string, files: string[]) {
    try {
        await stageFiles(projectPath, files)
        return { success: true }
    } catch (err: any) {
        log.error('Failed to stage files:', err)
        return { success: false, error: err.message }
    }
}

/**
 * Open system terminal at a path using the selected shell.
 */
async function handleOpenInTerminal(
    _event: Electron.IpcMainInvokeEvent,
    targetPath: string,
    preferredShell: 'powershell' | 'cmd' = 'powershell',
    initialCommand?: string
) {
    log.info('IPC: openInTerminal', { targetPath, preferredShell, hasCommand: Boolean(initialCommand?.trim()) })

    try {
        if (!targetPath) {
            return { success: false, error: 'Path is required' }
        }

        let cwd = targetPath
        const targetStats = await stat(targetPath)
        if (!targetStats.isDirectory()) {
            cwd = dirname(targetPath)
        }

        await access(cwd)

        if (process.platform !== 'win32') {
            return { success: false, error: 'Opening terminal is only supported on Windows in DevScope Air.' }
        }

        const normalizedShell: 'powershell' | 'cmd' = preferredShell === 'cmd' ? 'cmd' : 'powershell'
        const commandToRun = initialCommand?.trim()
        const hasCommand = Boolean(commandToRun)

        let executable = normalizedShell === 'cmd' ? 'cmd.exe' : 'powershell.exe'
        let args: string[] = []
        let tempScriptPath: string | null = null

        if (hasCommand) {
            const scriptSuffix = normalizedShell === 'cmd' ? 'cmd' : 'ps1'
            const scriptName = `devscope-run-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${scriptSuffix}`
            tempScriptPath = join(app.getPath('temp'), scriptName)

            if (normalizedShell === 'cmd') {
                const cmdScript = [
                    '@echo off',
                    `cd /d "${cwd}"`,
                    commandToRun!,
                    ''
                ].join('\r\n')
                await writeFile(tempScriptPath, cmdScript, 'utf-8')
                executable = 'cmd.exe'
                args = ['/k', tempScriptPath]
            } else {
                const escapedCwd = cwd.replace(/'/g, "''")
                const psScript = [
                    `$ErrorActionPreference = 'Continue'`,
                    `Set-Location -LiteralPath '${escapedCwd}'`,
                    commandToRun!,
                    ''
                ].join('\r\n')
                await writeFile(tempScriptPath, psScript, 'utf-8')
                executable = 'powershell.exe'
                args = ['-NoExit', '-ExecutionPolicy', 'Bypass', '-File', tempScriptPath]
            }
        } else {
            args = normalizedShell === 'cmd' ? ['/k'] : ['-NoExit']
        }

        // Use cmd's "start" so terminal windows launch reliably from an Electron GUI process.
        const launcherArgs = ['/d', '/s', '/c', 'start', '""', executable, ...args]
        await new Promise<void>((resolve, reject) => {
            const launcher = spawn('cmd.exe', launcherArgs, {
                cwd,
                stdio: 'ignore',
                windowsHide: true
            })

            launcher.once('error', (error) => {
                reject(error)
            })

            launcher.once('close', (code) => {
                if (code === 0) {
                    resolve()
                    return
                }
                reject(new Error(`Terminal launcher exited with code ${code}`))
            })
        })

        if (tempScriptPath) {
            setTimeout(() => {
                unlink(tempScriptPath!).catch(() => { })
            }, 20000)
        }

        return { success: true }
    } catch (err: any) {
        log.error('Failed to open terminal:', err)
        return { success: false, error: err.message }
    }
}

/**
 * Unstage files
 */
async function handleUnstageFiles(_event: Electron.IpcMainInvokeEvent, projectPath: string, files: string[]) {
    try {
        await unstageFiles(projectPath, files)
        return { success: true }
    } catch (err: any) {
        log.error('Failed to unstage files:', err)
        return { success: false, error: err.message }
    }
}

/**
 * Discard local file changes (staged + unstaged) for specific files
 */
async function handleDiscardChanges(_event: Electron.IpcMainInvokeEvent, projectPath: string, files: string[]) {
    try {
        await discardChanges(projectPath, files)
        return { success: true }
    } catch (err: any) {
        log.error('Failed to discard changes:', err)
        return { success: false, error: err.message }
    }
}

/**
 * Create commit
 */
async function handleCreateCommit(_event: Electron.IpcMainInvokeEvent, projectPath: string, message: string) {
    try {
        await createCommit(projectPath, message)
        return { success: true }
    } catch (err: any) {
        log.error('Failed to create commit:', err)
        return { success: false, error: err.message }
    }
}

/**
 * Push commits
 */
async function handlePushCommits(_event: Electron.IpcMainInvokeEvent, projectPath: string) {
    try {
        await pushCommits(projectPath)
        return { success: true }
    } catch (err: any) {
        log.error('Failed to push commits:', err)
        return { success: false, error: err.message }
    }
}

/**
 * Get file tree for a project
 */
async function handleGetFileTree(
    _event: Electron.IpcMainInvokeEvent,
    projectPath: string,
    options: { showHidden?: boolean; maxDepth?: number } = {}
) {
    log.info('IPC: getFileTree', projectPath, options)

    const showHidden = options.showHidden ?? false
    const requestedDepth = options.maxDepth
    const maxDepth = requestedDepth === undefined ? 3 : Math.trunc(requestedDepth)
    const isUnlimitedDepth = maxDepth < 0

    // Get git status for the whole project
    let gitStatusMap: Record<string, GitFileStatus> = {}
    try {
        gitStatusMap = await getGitStatus(projectPath)
    } catch (e) {
        // Ignore git errors
    }

    async function buildTree(dirPath: string, depth: number): Promise<FileTreeNode[]> {
        if (!isUnlimitedDepth && depth > maxDepth) return []

        try {
            const entries = await readdir(dirPath, { withFileTypes: true })
            const nodes: FileTreeNode[] = []

            for (const entry of entries) {
                const isHidden = entry.name.startsWith('.')
                if (!showHidden && isHidden) continue
                if (entry.name === 'node_modules' || entry.name === '.git') continue

                const fullPath = join(dirPath, entry.name)
                // Get relative path for git status lookup (handle both slash types just in case)
                // git status returns relative paths like "src/main.ts"
                const relativePath = join(relative(projectPath, fullPath)).replace(/\\/g, '/')
                const status = gitStatusMap[relativePath] || gitStatusMap[fullPath]

                if (entry.isDirectory()) {
                    const children = await buildTree(fullPath, depth + 1)
                    nodes.push({
                        name: entry.name,
                        path: fullPath,
                        type: 'directory',
                        children,
                        isHidden,
                        gitStatus: status
                    })
                } else {
                    try {
                        const stats = await stat(fullPath)
                        nodes.push({
                            name: entry.name,
                            path: fullPath,
                            type: 'file',
                            size: stats.size,
                            isHidden,
                            gitStatus: status
                        })
                    } catch {
                        nodes.push({
                            name: entry.name,
                            path: fullPath,
                            type: 'file',
                            isHidden,
                            gitStatus: status
                        })
                    }
                }
            }

            // Sort: directories first, then files, both alphabetically
            nodes.sort((a, b) => {
                if (a.type !== b.type) {
                    return a.type === 'directory' ? -1 : 1
                }
                return a.name.localeCompare(b.name)
            })

            return nodes
        } catch (err) {
            log.warn(`Could not read directory: ${dirPath}`, err)
            return []
        }
    }

    try {
        await access(projectPath)
        const tree = await buildTree(projectPath, 0)
        return { success: true, tree }
    } catch (err: any) {
        log.error('Failed to get file tree:', err)
        return { success: false, error: err.message }
    }
}


/**
 * Read file content (for preview)
 */
async function handleReadFileContent(_event: Electron.IpcMainInvokeEvent, filePath: string) {
    log.info('IPC: readFileContent', filePath)

    let fileHandle: Awaited<ReturnType<typeof fsOpen>> | null = null

    try {
        await access(filePath)
        const fileStats = await stat(filePath)
        const totalBytes = fileStats.size
        const previewBytes = Math.min(totalBytes, PREVIEW_MAX_BYTES)

        fileHandle = await fsOpen(filePath, 'r')
        const buffer = Buffer.alloc(previewBytes)
        const { bytesRead } = await fileHandle.read(buffer, 0, previewBytes, 0)
        const previewBuffer = buffer.subarray(0, bytesRead)
        const sample = previewBuffer.subarray(0, Math.min(previewBuffer.length, BINARY_DETECTION_BYTES))

        if (isLikelyBinaryBuffer(sample)) {
            return {
                success: false,
                error: 'Binary file preview is not supported'
            }
        }

        const content = previewBuffer.toString('utf-8')

        return {
            success: true,
            content,
            truncated: totalBytes > PREVIEW_MAX_BYTES,
            size: totalBytes,
            previewBytes: bytesRead
        }
    } catch (err: any) {
        log.error('Failed to read file:', err)
        return { success: false, error: err.message }
    } finally {
        if (fileHandle) {
            await fileHandle.close().catch(() => undefined)
        }
    }
}

/**
 * Fetch updates from remote
 */
async function handleFetchUpdates(_event: Electron.IpcMainInvokeEvent, projectPath: string, remoteName?: string) {
    try {
        await fetchUpdates(projectPath, remoteName || 'origin')
        return { success: true }
    } catch (err: any) {
        log.error('Failed to fetch updates:', err)
        return { success: false, error: err.message }
    }
}

/**
 * Pull updates from upstream
 */
async function handlePullUpdates(_event: Electron.IpcMainInvokeEvent, projectPath: string) {
    try {
        await pullUpdates(projectPath)
        return { success: true }
    } catch (err: any) {
        log.error('Failed to pull updates:', err)
        return { success: false, error: err.message }
    }
}

/**
 * List local branches
 */
async function handleListBranches(_event: Electron.IpcMainInvokeEvent, projectPath: string) {
    try {
        const branches = await listBranches(projectPath)
        return { success: true, branches }
    } catch (err: any) {
        log.error('Failed to list branches:', err)
        return { success: false, error: err.message }
    }
}

/**
 * Create branch
 */
async function handleCreateBranch(
    _event: Electron.IpcMainInvokeEvent,
    projectPath: string,
    branchName: string,
    checkout: boolean = true
) {
    try {
        await createBranch(projectPath, branchName, checkout)
        return { success: true }
    } catch (err: any) {
        log.error('Failed to create branch:', err)
        return { success: false, error: err.message }
    }
}

/**
 * Checkout branch
 */
async function handleCheckoutBranch(
    _event: Electron.IpcMainInvokeEvent,
    projectPath: string,
    branchName: string,
    options?: { autoStash?: boolean; autoCleanupLock?: boolean }
) {
    try {
        const result = await checkoutBranch(projectPath, branchName, options)
        return { success: true, ...result }
    } catch (err: any) {
        log.error('Failed to checkout branch:', err)
        return { success: false, error: err.message }
    }
}

/**
 * Delete local branch
 */
async function handleDeleteBranch(
    _event: Electron.IpcMainInvokeEvent,
    projectPath: string,
    branchName: string,
    force: boolean = false
) {
    try {
        await deleteBranch(projectPath, branchName, force)
        return { success: true }
    } catch (err: any) {
        log.error('Failed to delete branch:', err)
        return { success: false, error: err.message }
    }
}

/**
 * List remotes
 */
async function handleListRemotes(_event: Electron.IpcMainInvokeEvent, projectPath: string) {
    try {
        const remotes = await listRemotes(projectPath)
        return { success: true, remotes }
    } catch (err: any) {
        log.error('Failed to list remotes:', err)
        return { success: false, error: err.message }
    }
}

/**
 * Set remote URL
 */
async function handleSetRemoteUrl(
    _event: Electron.IpcMainInvokeEvent,
    projectPath: string,
    remoteName: string,
    remoteUrl: string
) {
    try {
        await setRemoteUrl(projectPath, remoteName, remoteUrl)
        return { success: true }
    } catch (err: any) {
        log.error('Failed to set remote URL:', err)
        return { success: false, error: err.message }
    }
}

/**
 * Remove remote
 */
async function handleRemoveRemote(_event: Electron.IpcMainInvokeEvent, projectPath: string, remoteName: string) {
    try {
        await removeRemote(projectPath, remoteName)
        return { success: true }
    } catch (err: any) {
        log.error('Failed to remove remote:', err)
        return { success: false, error: err.message }
    }
}

/**
 * List tags
 */
async function handleListTags(_event: Electron.IpcMainInvokeEvent, projectPath: string) {
    try {
        const tags = await listTags(projectPath)
        return { success: true, tags }
    } catch (err: any) {
        log.error('Failed to list tags:', err)
        return { success: false, error: err.message }
    }
}

/**
 * Create tag
 */
async function handleCreateTag(
    _event: Electron.IpcMainInvokeEvent,
    projectPath: string,
    tagName: string,
    target?: string
) {
    try {
        await createTag(projectPath, tagName, target)
        return { success: true }
    } catch (err: any) {
        log.error('Failed to create tag:', err)
        return { success: false, error: err.message }
    }
}

/**
 * Delete tag
 */
async function handleDeleteTag(_event: Electron.IpcMainInvokeEvent, projectPath: string, tagName: string) {
    try {
        await deleteTag(projectPath, tagName)
        return { success: true }
    } catch (err: any) {
        log.error('Failed to delete tag:', err)
        return { success: false, error: err.message }
    }
}

/**
 * List stashes
 */
async function handleListStashes(_event: Electron.IpcMainInvokeEvent, projectPath: string) {
    try {
        const stashes = await listStashes(projectPath)
        return { success: true, stashes }
    } catch (err: any) {
        log.error('Failed to list stashes:', err)
        return { success: false, error: err.message }
    }
}

/**
 * Create stash
 */
async function handleCreateStash(_event: Electron.IpcMainInvokeEvent, projectPath: string, message?: string) {
    try {
        await createStash(projectPath, message)
        return { success: true }
    } catch (err: any) {
        log.error('Failed to create stash:', err)
        return { success: false, error: err.message }
    }
}

/**
 * Apply stash
 */
async function handleApplyStash(
    _event: Electron.IpcMainInvokeEvent,
    projectPath: string,
    stashRef: string = 'stash@{0}',
    pop: boolean = false
) {
    try {
        await applyStash(projectPath, stashRef, pop)
        return { success: true }
    } catch (err: any) {
        log.error('Failed to apply stash:', err)
        return { success: false, error: err.message }
    }
}

/**
 * Drop stash
 */
async function handleDropStash(
    _event: Electron.IpcMainInvokeEvent,
    projectPath: string,
    stashRef: string = 'stash@{0}'
) {
    try {
        await dropStash(projectPath, stashRef)
        return { success: true }
    } catch (err: any) {
        log.error('Failed to drop stash:', err)
        return { success: false, error: err.message }
    }
}

/**
 * Check if directory is a git repository
 */
async function handleCheckIsGitRepo(_event: Electron.IpcMainInvokeEvent, projectPath: string) {
    try {
        const isGitRepo = await checkIsGitRepo(projectPath)
        return { success: true, isGitRepo }
    } catch (err: any) {
        log.error('Failed to check git repo:', err)
        return { success: false, error: err.message }
    }
}

/**
 * Initialize git repository
 */
async function handleInitGitRepo(
    _event: Electron.IpcMainInvokeEvent,
    projectPath: string,
    branchName: string,
    createGitignore: boolean,
    gitignoreTemplate?: string
) {
    try {
        const result = await initGitRepo(projectPath, branchName, createGitignore, gitignoreTemplate)
        return result
    } catch (err: any) {
        log.error('Failed to init git repo:', err)
        return { success: false, error: err.message }
    }
}

/**
 * Create initial commit
 */
async function handleCreateInitialCommit(_event: Electron.IpcMainInvokeEvent, projectPath: string, message: string) {
    try {
        const result = await createInitialCommit(projectPath, message)
        return result
    } catch (err: any) {
        log.error('Failed to create initial commit:', err)
        return { success: false, error: err.message }
    }
}

/**
 * Add remote origin
 */
async function handleAddRemoteOrigin(_event: Electron.IpcMainInvokeEvent, projectPath: string, remoteUrl: string) {
    try {
        const result = await addRemoteOrigin(projectPath, remoteUrl)
        return result
    } catch (err: any) {
        log.error('Failed to add remote origin:', err)
        return { success: false, error: err.message }
    }
}

/**
 * Get gitignore templates
 */
async function handleGetGitignoreTemplates() {
    try {
        const templates = getGitignoreTemplates()
        return { success: true, templates }
    } catch (err: any) {
        log.error('Failed to get gitignore templates:', err)
        return { success: false, error: err.message }
    }
}

/**
 * Generate gitignore content
 */
async function handleGenerateGitignoreContent(_event: Electron.IpcMainInvokeEvent, template: string) {
    try {
        const content = generateGitignoreContent(template)
        return { success: true, content }
    } catch (err: any) {
        log.error('Failed to generate gitignore content:', err)
        return { success: false, error: err.message }
    }
}

/**
 * Get gitignore patterns
 */
async function handleGetGitignorePatterns() {
    try {
        const patterns = getGitignorePatterns()
        return { success: true, patterns }
    } catch (err: any) {
        log.error('Failed to get gitignore patterns:', err)
        return { success: false, error: err.message }
    }
}

/**
 * Generate custom gitignore content
 */
async function handleGenerateCustomGitignoreContent(_event: Electron.IpcMainInvokeEvent, selectedPatternIds: string[]) {
    try {
        const content = generateCustomGitignoreContent(selectedPatternIds)
        return { success: true, content }
    } catch (err: any) {
        log.error('Failed to generate custom gitignore content:', err)
        return { success: false, error: err.message }
    }
}

/**
 * Get terminal sessions for a specific project
 */
async function handleGetProjectSessions(_event: Electron.IpcMainInvokeEvent, _projectPath: string) {
    return { success: true, sessions: [] }
}

/**
 * Get running processes for a project (dev servers, node, etc.)
 */
async function handleGetProjectProcesses(_event: Electron.IpcMainInvokeEvent, projectPath: string) {
    try {
        const { detectProjectProcesses } = await import('../inspectors/process-detector')
        const status = await detectProjectProcesses(projectPath)
        return { success: true, ...status }
    } catch (err: any) {
        log.error('Failed to get project processes:', err)
        return { success: false, error: err.message, isLive: false, processes: [], activePorts: [] }
    }
}




