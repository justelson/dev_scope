import { access, readFile, readdir, stat } from 'fs/promises'
import { exec, spawn } from 'child_process'
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
import { appendTaskLog, completeTask, createTask } from '../task-manager'
import { resolveProjectIconPath } from '../../services/project-icon-resolver'

const execAsync = promisify(exec)

type DependencyInstallStatus = {
    installed: boolean | null
    checked: boolean
    ecosystem: 'node' | 'unknown'
    totalPackages: number
    installedPackages: number
    missingPackages: number
    missingDependencies?: string[]
    missingSample?: string[]
    reason?: string
}

type DependencyInstallManager = 'npm' | 'pnpm' | 'yarn' | 'bun'

function getPreferredReadmeFile(entries: string[]): string | null {
    const readmeCandidates = entries.filter((entry) => {
        const normalized = entry.toLowerCase()
        return normalized.startsWith('readme')
            && (normalized.endsWith('.md') || normalized.endsWith('.txt') || !normalized.includes('.'))
    })

    if (readmeCandidates.length === 0) return null

    const scoreReadmeCandidate = (entry: string): number => {
        const normalized = entry.toLowerCase()

        if (/^readme(?:[._-]en(?:[-_][a-z]{2})?)?\.md$/i.test(normalized)) return 1000
        if (/^readme(?:[._-]en(?:[-_][a-z]{2})?)?\.txt$/i.test(normalized)) return 950
        if (/^readme(?:[._-]en(?:[-_][a-z]{2})?)$/i.test(normalized)) return 900
        if (normalized === 'readme.md') return 850
        if (normalized === 'readme.txt') return 800
        if (normalized === 'readme') return 750
        if (/^readme[._-][a-z]{2}(?:[-_][a-z]{2})?\.md$/i.test(normalized)) return 500
        if (/^readme[._-][a-z]{2}(?:[-_][a-z]{2})?\.txt$/i.test(normalized)) return 450
        return 100
    }

    return [...readmeCandidates]
        .sort((left, right) => {
            const scoreDiff = scoreReadmeCandidate(right) - scoreReadmeCandidate(left)
            if (scoreDiff !== 0) return scoreDiff
            return left.localeCompare(right)
        })[0] || null
}

async function pathExists(path: string): Promise<boolean> {
    try {
        await access(path)
        return true
    } catch {
        return false
    }
}

async function detectNodeDependencyInstallStatus(
    projectPath: string,
    packageJson: { dependencies?: Record<string, string>; devDependencies?: Record<string, string> } | null
): Promise<DependencyInstallStatus> {
    const dependencyNames = Array.from(new Set([
        ...Object.keys(packageJson?.dependencies || {}),
        ...Object.keys(packageJson?.devDependencies || {})
    ].filter((name) => name.trim().length > 0)))

    if (dependencyNames.length === 0) {
        return {
            installed: true,
            checked: true,
            ecosystem: 'node',
            totalPackages: 0,
            installedPackages: 0,
            missingPackages: 0
        }
    }

    const nodeModulesPath = join(projectPath, 'node_modules')
    if (!(await pathExists(nodeModulesPath))) {
        return {
            installed: false,
            checked: true,
            ecosystem: 'node',
            totalPackages: dependencyNames.length,
            installedPackages: 0,
            missingPackages: dependencyNames.length,
            missingDependencies: dependencyNames,
            missingSample: dependencyNames.slice(0, 5),
            reason: 'node_modules is missing'
        }
    }

    const checks = await Promise.all(
        dependencyNames.map(async (name) => {
            const packagePath = join(nodeModulesPath, ...name.split('/'))
            const exists = await pathExists(packagePath)
            return { name, exists }
        })
    )

    const missing = checks.filter((item) => !item.exists).map((item) => item.name)
    const installedPackages = dependencyNames.length - missing.length

    return {
        installed: missing.length === 0,
        checked: true,
        ecosystem: 'node',
        totalPackages: dependencyNames.length,
        installedPackages,
        missingPackages: missing.length,
        missingDependencies: missing,
        missingSample: missing.slice(0, 5)
    }
}

type ProjectPackageJson = {
    packageManager?: string
    dependencies?: Record<string, string>
    devDependencies?: Record<string, string>
}

async function detectDependencyInstallManager(
    projectPath: string,
    packageJson: ProjectPackageJson | null
): Promise<DependencyInstallManager> {
    const packageManagerField = String(packageJson?.packageManager || '').trim().toLowerCase()
    if (packageManagerField.startsWith('pnpm')) return 'pnpm'
    if (packageManagerField.startsWith('yarn')) return 'yarn'
    if (packageManagerField.startsWith('bun')) return 'bun'
    if (packageManagerField.startsWith('npm')) return 'npm'

    if (await pathExists(join(projectPath, 'pnpm-lock.yaml'))) return 'pnpm'
    if (await pathExists(join(projectPath, 'yarn.lock'))) return 'yarn'
    if (await pathExists(join(projectPath, 'bun.lockb')) || await pathExists(join(projectPath, 'bun.lock'))) return 'bun'
    return 'npm'
}

function installCommandForManager(manager: DependencyInstallManager): { command: string; args: string[] } {
    if (manager === 'pnpm') return { command: 'pnpm', args: ['install'] }
    if (manager === 'yarn') return { command: 'yarn', args: ['install'] }
    if (manager === 'bun') return { command: 'bun', args: ['install'] }
    return { command: 'npm', args: ['install'] }
}

async function runInstallProcess(
    projectPath: string,
    manager: DependencyInstallManager
): Promise<{ success: boolean; output: string; error: string | null; code: number | null }> {
    const { command, args } = installCommandForManager(manager)
    return await new Promise((resolve) => {
        const child = spawn(command, args, {
            cwd: projectPath,
            shell: process.platform === 'win32',
            windowsHide: true,
            env: process.env
        })

        const outputBuffer: string[] = []
        const appendOutput = (chunk: Buffer | string) => {
            outputBuffer.push(String(chunk || ''))
            if (outputBuffer.length > 220) {
                outputBuffer.splice(0, outputBuffer.length - 220)
            }
        }

        child.stdout?.on('data', appendOutput)
        child.stderr?.on('data', appendOutput)

        child.on('error', (error: Error) => {
            const message = error?.message || `Failed to start ${command}.`
            resolve({
                success: false,
                output: outputBuffer.join(''),
                error: message,
                code: null
            })
        })

        child.on('close', (code) => {
            const mergedOutput = outputBuffer.join('')
            if (code === 0) {
                resolve({
                    success: true,
                    output: mergedOutput,
                    error: null,
                    code: 0
                })
                return
            }
            resolve({
                success: false,
                output: mergedOutput,
                error: `${command} install failed with exit code ${code ?? 'unknown'}.`,
                code: typeof code === 'number' ? code : null
            })
        })
    })
}

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
        let dependencyInstallStatus: DependencyInstallStatus | null = null

        const readmeFile = getPreferredReadmeFile(entries)
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
                dependencyInstallStatus = await detectNodeDependencyInstallStatus(projectPath, packageJson)
            } catch (err) {
                log.warn('Could not parse package.json', err)
            }
        }

        const stats = await stat(projectPath)
        const folderName = projectPath.split(/[\\/]/).pop() || 'Unknown'
        const projectIconPath = await resolveProjectIconPath(projectPath, entries, packageJson)

        return {
            success: true,
            project: {
                name: packageJson?.name || folderName,
                displayName: packageJson?.name || folderName,
                path: projectPath,
                type: projectType?.id || 'unknown',
                projectIconPath,
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
                devDependencies: packageJson?.devDependencies || null,
                dependencyInstallStatus
            }
        }
    } catch (err: any) {
        log.error('Failed to get project details:', err)
        return { success: false, error: err.message }
    }
}

export async function handleInstallProjectDependencies(
    _event: Electron.IpcMainInvokeEvent,
    projectPath: string,
    options?: { onlyMissing?: boolean }
) {
    log.info('IPC: installProjectDependencies', { projectPath, onlyMissing: Boolean(options?.onlyMissing) })
    const mode = options?.onlyMissing ? 'missing' : 'all'
    const task = createTask({
        type: 'project.dependencies.install',
        title: mode === 'missing' ? 'Install missing dependencies' : 'Install project dependencies',
        projectPath,
        initialLog: mode === 'missing'
            ? 'Checking and installing missing dependencies'
            : 'Installing project dependencies'
    })

    try {
        await access(projectPath)
        const packageJsonPath = join(projectPath, 'package.json')
        if (!(await pathExists(packageJsonPath))) {
            completeTask(task.id, 'failed', 'No package.json found in project.')
            return { success: false, error: 'No package.json found in this project.' }
        }

        let packageJson: ProjectPackageJson | null = null
        try {
            const packageContent = await readFile(packageJsonPath, 'utf-8')
            packageJson = JSON.parse(packageContent) as ProjectPackageJson
        } catch (error: any) {
            completeTask(task.id, 'failed', error?.message || 'Failed to read package.json.')
            return { success: false, error: error?.message || 'Failed to read package.json.' }
        }

        const installStatusBefore = await detectNodeDependencyInstallStatus(projectPath, packageJson)
        appendTaskLog(
            task.id,
            `Dependency status before install: ${installStatusBefore.installedPackages}/${installStatusBefore.totalPackages} installed`
        )
        if (options?.onlyMissing && installStatusBefore.missingPackages <= 0) {
            completeTask(task.id, 'success', 'All dependencies are already installed.')
            return {
                success: true,
                manager: await detectDependencyInstallManager(projectPath, packageJson),
                durationMs: 0,
                message: 'All dependencies are already installed.',
                installStatus: installStatusBefore
            }
        }
        const manager = await detectDependencyInstallManager(projectPath, packageJson)
        appendTaskLog(task.id, `Using package manager: ${manager}`)
        const startedAt = Date.now()
        const installRun = await runInstallProcess(projectPath, manager)
        const installStatusAfter = await detectNodeDependencyInstallStatus(projectPath, packageJson)
        appendTaskLog(
            task.id,
            `Dependency status after install: ${installStatusAfter.installedPackages}/${installStatusAfter.totalPackages} installed`
        )

        if (!installRun.success) {
            const outputTail = installRun.output
                .split(/\r?\n/)
                .map((line) => line.trim())
                .filter(Boolean)
                .slice(-2)
                .join(' | ')
            if (outputTail) {
                appendTaskLog(task.id, `Installer output: ${outputTail}`, 'error')
            }
            completeTask(task.id, 'failed', installRun.error || 'Dependency installation failed.')
            return {
                success: false,
                error: installRun.error || 'Dependency installation failed.',
                manager,
                durationMs: Date.now() - startedAt,
                output: installRun.output.slice(-8000),
                installStatus: installStatusAfter
            }
        }

        const label = options?.onlyMissing ? 'missing dependencies' : 'dependencies'
        completeTask(task.id, 'success', `Installed ${label} using ${manager}.`)
        return {
            success: true,
            manager,
            durationMs: Date.now() - startedAt,
            message: `Installed ${label} using ${manager}.`,
            output: installRun.output.slice(-4000),
            installStatus: installStatusAfter
        }
    } catch (err: any) {
        log.error('Failed to install project dependencies:', err)
        completeTask(task.id, 'failed', err?.message || 'Failed to install dependencies.')
        return { success: false, error: err?.message || 'Failed to install dependencies.' }
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
