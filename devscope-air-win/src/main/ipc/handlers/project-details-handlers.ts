import { access, readFile, readdir, stat } from 'fs/promises'
import { join } from 'path'
import log from 'electron-log'
import {
    detectFrameworksFromPackageJson,
    detectProjectTypeFromMarkers,
    PROJECT_MARKERS,
    type FrameworkDefinition
} from '../project-detection'

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
