import { access, readdir, readFile, stat } from 'fs/promises'
import { join } from 'path'
import log from 'electron-log'
import {
    detectFrameworksFromPackageJson,
    detectProjectTypeFromMarkers,
    PROJECT_MARKERS,
    type FrameworkDefinition,
    type ProjectTypeDefinition
} from '../ipc/project-detection'

export type ScannedProject = {
    name: string
    path: string
    type: string
    typeInfo?: ProjectTypeDefinition
    markers: string[]
    frameworks: string[]
    frameworkInfo?: FrameworkDefinition[]
    lastModified?: number
    isProject: boolean
}

export type ScannedFolder = {
    name: string
    path: string
    lastModified?: number
    isProject: boolean
}

export type ScannedFile = {
    name: string
    path: string
    size: number
    lastModified?: number
    extension: string
}

export type ScanProjectsSuccess = {
    success: true
    projects: ScannedProject[]
    folders: ScannedFolder[]
    files: ScannedFile[]
    cached?: boolean
    cachedAt?: number
}

export type ScanProjectsError = {
    success: false
    error: string
}

export type ScanProjectsResult = ScanProjectsSuccess | ScanProjectsError

const SCAN_PROJECTS_CACHE_TTL_MS = 2 * 60 * 1000
const scanProjectsCache = new Map<string, { timestamp: number; value: ScanProjectsSuccess }>()
const scanProjectsInFlight = new Map<string, Promise<ScanProjectsResult>>()

function normalizeScanPathKey(folderPath: string): string {
    return folderPath.replace(/\\/g, '/').toLowerCase()
}

function getCachedScanProjects(folderPath: string): ScanProjectsSuccess | null {
    const key = normalizeScanPathKey(folderPath)
    const cached = scanProjectsCache.get(key)
    if (!cached) return null

    const ageMs = Date.now() - cached.timestamp
    if (ageMs > SCAN_PROJECTS_CACHE_TTL_MS) {
        scanProjectsCache.delete(key)
        return null
    }

    return {
        ...cached.value,
        cached: true,
        cachedAt: cached.timestamp
    }
}

function cacheScanProjects(folderPath: string, value: ScanProjectsSuccess): void {
    scanProjectsCache.set(normalizeScanPathKey(folderPath), {
        timestamp: Date.now(),
        value
    })
}

async function scanProjectsUncached(folderPath: string): Promise<ScanProjectsResult> {
    await access(folderPath)
    const entries = await readdir(folderPath, { withFileTypes: true })
    const projects: ScannedProject[] = []
    const folders: ScannedFolder[] = []
    const files: ScannedFile[] = []

    for (const entry of entries) {
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
                } catch {
                    // Skip files we cannot stat.
                }
            }
            continue
        }

        if (!entry.isDirectory()) continue
        if (entry.name === 'node_modules') continue

        const isHidden = entry.name.startsWith('.')
        const projectPath = join(folderPath, entry.name)
        const markers: string[] = []
        let frameworks: string[] = []
        let frameworkInfo: FrameworkDefinition[] = []

        try {
            const projectEntries = await readdir(projectPath)

            if (projectEntries.includes('.git')) {
                markers.push('.git')
            }

            for (const marker of PROJECT_MARKERS) {
                if (marker === '.git') continue
                if (marker.startsWith('*')) {
                    const ext = marker.slice(1)
                    if (projectEntries.some((projectEntry) => projectEntry.endsWith(ext))) {
                        markers.push(marker)
                    }
                } else if (projectEntries.includes(marker)) {
                    markers.push(marker)
                }
            }

            const projectType = detectProjectTypeFromMarkers(markers)
            if (projectType?.id === 'node' && projectEntries.includes('package.json')) {
                try {
                    const pkgPath = join(projectPath, 'package.json')
                    const pkgContent = await readFile(pkgPath, 'utf-8')
                    const packageJson = JSON.parse(pkgContent)
                    frameworkInfo = detectFrameworksFromPackageJson(packageJson, projectEntries)
                    frameworks = frameworkInfo.map((framework) => framework.id)
                } catch (err) {
                    log.warn(`Could not parse package.json in ${projectPath}`, err)
                }
            }

            const stats = await stat(projectPath)

            if (markers.length > 0) {
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

    projects.sort((a, b) => (b.lastModified || 0) - (a.lastModified || 0))
    folders.sort((a, b) => a.name.localeCompare(b.name))
    files.sort((a, b) => a.name.localeCompare(b.name))

    return { success: true, projects, folders, files }
}

export async function scanProjects(folderPath: string): Promise<ScanProjectsResult> {
    const cached = getCachedScanProjects(folderPath)
    if (cached) {
        return cached
    }

    const key = normalizeScanPathKey(folderPath)
    const inFlight = scanProjectsInFlight.get(key)
    if (inFlight) {
        return await inFlight
    }

    const scanPromise = (async () => {
        try {
            const result = await scanProjectsUncached(folderPath)
            if (result.success) {
                cacheScanProjects(folderPath, result)
            }
            return result
        } catch (err: any) {
            const errorResult: ScanProjectsError = { success: false, error: err?.message || 'Failed to scan projects' }
            return errorResult
        } finally {
            scanProjectsInFlight.delete(key)
        }
    })()

    scanProjectsInFlight.set(key, scanPromise)
    return await scanPromise
}

export async function indexAllFolders(folders: string[]) {
    const maxDepth = Number.POSITIVE_INFINITY
    const allProjects: Array<ScannedProject & { sourceFolder: string; depth: number }> = []
    const errors: Array<{ folder: string; error: string }> = []
    const scannedPaths = new Set<string>()

    async function scanRecursively(folderPath: string, sourceFolder: string, depth: number): Promise<void> {
        if (depth > maxDepth) return
        if (scannedPaths.has(folderPath)) return
        scannedPaths.add(folderPath)

        try {
            const result = await scanProjects(folderPath)
            if (result.success) {
                if (result.projects) {
                    for (const project of result.projects) {
                        allProjects.push({ ...project, sourceFolder, depth })
                    }
                }

                if (result.folders && depth < maxDepth) {
                    for (const subfolder of result.folders) {
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
        }
    }

    for (const folder of folders) {
        if (!folder) continue
        await scanRecursively(folder, folder, 0)
    }

    allProjects.sort((a, b) => (b.lastModified || 0) - (a.lastModified || 0))

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
