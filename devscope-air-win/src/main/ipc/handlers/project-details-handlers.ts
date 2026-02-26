import { access, readFile, readdir, stat } from 'fs/promises'
import { exec } from 'child_process'
import { join } from 'path'
import { promisify } from 'util'
import log from 'electron-log'
import si from 'systeminformation'
import {
    detectFrameworksFromPackageJson,
    detectProjectTypeFromMarkers,
    PROJECT_MARKERS,
    type FrameworkDefinition
} from '../project-detection'

const execAsync = promisify(exec)

function parseTasklistMemoryMb(raw: string): number {
    const normalized = String(raw || '').replace(/[\s,]/g, '').toUpperCase()
    const match = normalized.match(/^([0-9]+(?:\.[0-9]+)?)(K|M|G)?$/)
    if (!match) return 0
    const value = Number(match[1]) || 0
    const unit = match[2] || 'K'
    if (unit === 'G') return value * 1024
    if (unit === 'M') return value
    return value / 1024
}

function parseTasklistLine(line: string): string[] {
    const trimmed = String(line || '').trim()
    if (!trimmed) return []
    if (!(trimmed.startsWith('"') && trimmed.endsWith('"'))) {
        return trimmed.split(',').map((part) => part.trim())
    }
    return trimmed.slice(1, -1).split('","')
}

function hasVisibleWindowTitle(rawTitle: string): boolean {
    const title = String(rawTitle || '').trim().toLowerCase()
    if (!title) return false
    if (title === 'n/a' || title === 'unknown') return false
    return true
}

const APP_NAME_HINTS = [
    'chrome.exe', 'msedge.exe', 'firefox.exe', 'brave.exe', 'opera.exe',
    'code.exe', 'code - insiders.exe', 'devenv.exe', 'explorer.exe', 'notepad.exe', 'notepad++.exe',
    'idea64.exe', 'pycharm64.exe', 'webstorm64.exe', 'rider64.exe', 'clion64.exe', 'studio64.exe',
    'slack.exe', 'discord.exe', 'teams.exe', 'spotify.exe', 'steam.exe', 'obs64.exe',
    'windowsterminal.exe', 'wt.exe', 'cmd.exe', 'powershell.exe', 'pwsh.exe', 'wezterm.exe'
]

const BACKGROUND_NAME_HINTS = [
    'svchost.exe', 'dllhost.exe', 'conhost.exe', 'taskhostw.exe', 'searchindexer.exe',
    'runtimebroker.exe', 'runtime broker', 'fontdrvhost.exe', 'sihost.exe', 'smss.exe',
    'csrss.exe', 'wininit.exe', 'lsass.exe', 'services.exe', 'spoolsv.exe',
    'wmi', 'defender', 'antimalware', 'telemetry', 'updater', 'service', 'host', 'broker'
]

async function getVisibleWindowPidSet(): Promise<{ pids: Set<number>; signalAvailable: boolean }> {
    const pids = new Set<number>()
    let signalAvailable = false

    try {
        const { stdout } = await execAsync(
            'powershell -NoProfile -Command "Get-Process | Where-Object { $_.MainWindowHandle -ne 0 } | Select-Object -ExpandProperty Id"',
            { timeout: 6000, maxBuffer: 2 * 1024 * 1024 }
        )
        const lines = String(stdout || '').split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
        for (const line of lines) {
            const pid = Number.parseInt(line, 10)
            if (!Number.isFinite(pid) || pid <= 0) continue
            pids.add(pid)
        }
        if (pids.size > 0) {
            signalAvailable = true
            return { pids, signalAvailable }
        }
    } catch (err) {
        log.warn('powershell visible-window pid probe failed:', err)
    }

    try {
        const { stdout } = await execAsync('tasklist /V /FO CSV /NH', { timeout: 6000, maxBuffer: 4 * 1024 * 1024 })
        const lines = String(stdout || '').split(/\r?\n/).filter((line) => line.trim().length > 0)
        let parsedRows = 0
        for (const line of lines) {
            const parts = parseTasklistLine(line)
            if (parts.length < 9) continue
            parsedRows += 1
            const pid = Number.parseInt(String(parts[1] || '').trim(), 10)
            if (!Number.isFinite(pid) || pid <= 0) continue
            const windowTitle = String(parts[8] || '')
            if (!hasVisibleWindowTitle(windowTitle)) continue
            pids.add(pid)
        }
        signalAvailable = parsedRows > 0
    } catch (err) {
        log.warn('tasklist /V visible-window pid probe failed:', err)
    }

    return { pids, signalAvailable }
}

function inferProcessCategory(
    name: string,
    pid: number,
    visibleWindowPids: Set<number>,
    windowSignalAvailable: boolean
): 'app' | 'background' {
    const normalized = String(name || '').trim().toLowerCase()
    if (!normalized) return 'background'

    if (visibleWindowPids.has(pid)) return 'app'

    const explicitBackground = BACKGROUND_NAME_HINTS.some((hint) => normalized.includes(hint))
    if (explicitBackground) return 'background'

    const explicitApp = APP_NAME_HINTS.some((hint) => normalized === hint || normalized.endsWith(`\\${hint}`))
    if (explicitApp) return 'app'

    if (windowSignalAvailable) {
        return 'background'
    }

    if (normalized.endsWith('.exe') && !normalized.includes('service') && !normalized.includes('host')) {
        return 'app'
    }

    return 'background'
}

export async function handleGetProjectDetails(_event: Electron.IpcMainInvokeEvent, projectPath: string) {
    log.info('IPC: getProjectDetails', projectPath)

    try {
        await access(projectPath)

        const entries = await readdir(projectPath)
        const markers: string[] = []
        let readme: string | null = null
        let packageJson: any = null
        let frameworks: FrameworkDefinition[] = []

        const readmeFile = entries.find((entry) =>
            entry.toLowerCase().startsWith('readme')
            && (entry.endsWith('.md') || entry.endsWith('.txt') || !entry.includes('.'))
        )
        if (readmeFile) {
            try {
                readme = await readFile(join(projectPath, readmeFile), 'utf-8')
            } catch (err) {
                log.warn('Could not read README', err)
            }
        }

        for (const marker of PROJECT_MARKERS) {
            if (marker.startsWith('*')) {
                const ext = marker.slice(1)
                if (entries.some((entry) => entry.endsWith(ext))) {
                    markers.push(marker)
                }
            } else if (entries.includes(marker)) {
                markers.push(marker)
            }
        }

        const projectType = detectProjectTypeFromMarkers(markers)

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
                frameworks: frameworks.map((framework) => framework.id),
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

export async function handleGetProjectSessions(_event: Electron.IpcMainInvokeEvent, _projectPath: string) {
    return { success: true, sessions: [] }
}

export async function handleGetProjectProcesses(_event: Electron.IpcMainInvokeEvent, projectPath: string) {
    try {
        const { detectProjectProcesses } = await import('../../inspectors/process-detector')
        const status = await detectProjectProcesses(projectPath)
        return { success: true, ...status }
    } catch (err: any) {
        log.error('Failed to get project processes:', err)
        return { success: false, error: err.message, isLive: false, processes: [], activePorts: [] }
    }
}

export async function handleGetRunningApps(_event: Electron.IpcMainInvokeEvent, limit: number = 500) {
    try {
        const { pids: visibleWindowPids, signalAvailable: windowSignalAvailable } = await getVisibleWindowPidSet()

        const processes = await si.processes()
        const list = Array.isArray(processes?.list) ? processes.list : []
        const aggregated = new Map<string, { processCount: number; cpu: number; memoryMb: number; appProcessCount: number }>()
        const ignored = new Set([
            'system', 'system idle process', 'registry', 'idle', 'memory compression'
        ])

        for (const process of list) {
            const name = String(process?.name || '').trim()
            if (!name) continue
            if (ignored.has(name.toLowerCase())) continue

            const pid = Number(process?.pid) || 0
            const category = inferProcessCategory(name, pid, visibleWindowPids, windowSignalAvailable)
            const classifiedAsApp = category === 'app'
            const cpu = Number(process?.cpu) || 0
            // systeminformation `memRss` is reported in KB; convert to MB.
            const memoryMb = Math.max(0, Number(process?.memRss) || 0) / 1024
            const current = aggregated.get(name)

            if (current) {
                current.processCount += 1
                current.cpu += cpu
                current.memoryMb += memoryMb
                if (classifiedAsApp) current.appProcessCount += 1
                continue
            }

            aggregated.set(name, {
                processCount: 1,
                cpu,
                memoryMb,
                appProcessCount: classifiedAsApp ? 1 : 0
            })
        }

        const normalizedLimit = Math.max(20, Math.min(2000, Number(limit) || 500))
        let apps = [...aggregated.entries()]
            .map(([name, metrics]) => ({
                name,
                category: metrics.appProcessCount > 0 ? 'app' as const : 'background' as const,
                processCount: metrics.processCount,
                cpu: Number(metrics.cpu.toFixed(1)),
                memoryMb: Number(metrics.memoryMb.toFixed(1))
            }))
            .sort((a, b) => {
                if (a.category !== b.category) return a.category === 'app' ? -1 : 1
                if (b.cpu !== a.cpu) return b.cpu - a.cpu
                if (b.memoryMb !== a.memoryMb) return b.memoryMb - a.memoryMb
                return a.name.localeCompare(b.name)
            })
            .slice(0, normalizedLimit)

        // Fallback for cases where systeminformation returns empty process list on some Windows environments.
        if (apps.length === 0) {
            try {
                const { stdout } = await execAsync('tasklist /FO CSV /NH', { timeout: 5000, maxBuffer: 2 * 1024 * 1024 })
                const fallbackMap = new Map<string, { processCount: number; memoryMb: number; appProcessCount: number }>()
                const lines = stdout.split(/\r?\n/).filter((line) => line.trim().length > 0)
                for (const line of lines) {
                    const parts = parseTasklistLine(line)
                    if (parts.length < 5) continue

                    const name = String(parts[0] || '').trim()
                    if (!name) continue
                    if (ignored.has(name.toLowerCase())) continue

                    const pid = Number.parseInt(String(parts[1] || '').trim(), 10)
                    const category = inferProcessCategory(
                        name,
                        Number.isFinite(pid) ? pid : 0,
                        visibleWindowPids,
                        windowSignalAvailable
                    )
                    const isApp = category === 'app'
                    const memoryMb = parseTasklistMemoryMb(parts[4])
                    const current = fallbackMap.get(name)
                    if (current) {
                        current.processCount += 1
                        current.memoryMb += memoryMb
                        if (isApp) current.appProcessCount += 1
                    } else {
                        fallbackMap.set(name, {
                            processCount: 1,
                            memoryMb,
                            appProcessCount: isApp ? 1 : 0
                        })
                    }
                }

                apps = [...fallbackMap.entries()]
                    .map(([name, metrics]) => ({
                        name,
                        category: metrics.appProcessCount > 0 ? 'app' as const : 'background' as const,
                        processCount: metrics.processCount,
                        cpu: 0,
                        memoryMb: Number(metrics.memoryMb.toFixed(1))
                    }))
                    .sort((a, b) => {
                        if (a.category !== b.category) return a.category === 'app' ? -1 : 1
                        if (b.memoryMb !== a.memoryMb) return b.memoryMb - a.memoryMb
                        return a.name.localeCompare(b.name)
                    })
                    .slice(0, normalizedLimit)
            } catch (fallbackErr) {
                log.warn('tasklist fallback failed:', fallbackErr)
            }
        }

        return { success: true, apps }
    } catch (err: any) {
        log.error('Failed to get running apps:', err)
        return { success: false, error: err.message, apps: [] }
    }
}

export async function handleGetActivePorts(_event: Electron.IpcMainInvokeEvent) {
    try {
        const { getActivePorts } = await import('../../inspectors/process-detector')
        const ports = await getActivePorts()
        return { success: true, ports }
    } catch (err: any) {
        log.error('Failed to get active ports:', err)
        return { success: false, error: err.message, ports: [] }
    }
}
