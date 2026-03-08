import log from 'electron-log'
import si from 'systeminformation'
import {
    getSystemInfo,
    sensingEngine
} from '../../inspectors'
import { invalidateUnifiedBatchCache } from '../../inspectors/unified-batch-scanner'
import type {
    FullReport,
    ReadinessReport,
    SystemHealth,
    ToolingReport
} from '../../inspectors/types'
import { clearCommandCache } from '../../inspectors/safe-exec'
import { calculateReadiness } from '../../readiness/scorer'
import { systemMetricsBridge } from '../../system-metrics/manager'

export async function handleSystemMetricsBootstrap() {
    log.info('IPC: system:bootstrap')
    return await systemMetricsBridge.bootstrap()
}

export function handleSystemMetricsSubscribe(event: Electron.IpcMainInvokeEvent, options?: { intervalMs?: number }) {
    log.info('IPC: system:subscribe')
    return systemMetricsBridge.subscribe(event.sender.id, options?.intervalMs)
}

export function handleSystemMetricsUnsubscribe(event: Electron.IpcMainInvokeEvent) {
    log.info('IPC: system:unsubscribe')
    return systemMetricsBridge.unsubscribe(event.sender.id)
}

export function handleSystemMetricsRead() {
    return systemMetricsBridge.getLiveMetrics()
}

export async function handleGetSystemOverview(): Promise<SystemHealth> {
    log.info('IPC: getSystemOverview')
    return getSystemInfo()
}

export async function handleGetDetailedSystemStats() {
    log.info('IPC: getDetailedSystemStats')
    return systemMetricsBridge.getSnapshot()
}

export async function handleGetDeveloperTooling(): Promise<ToolingReport> {
    log.info('IPC: getDeveloperTooling (SensingEngine)')

    const [languages, packageManagers, buildTools, containers, versionControl] = await Promise.all([
        sensingEngine.scanCategory('language'),
        sensingEngine.scanCategory('package_manager'),
        sensingEngine.scanCategory('build_tool'),
        sensingEngine.scanCategory('container'),
        sensingEngine.scanCategory('version_control')
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

export async function handleGetReadinessReport(): Promise<ReadinessReport> {
    log.info('IPC: getReadinessReport')
    const tooling = await handleGetDeveloperTooling()
    const aiRuntime = { llmRuntimes: [], gpuAcceleration: [], aiFrameworks: [], timestamp: Date.now() }
    return calculateReadiness(tooling, aiRuntime as any)
}

export async function handleRefreshAll(): Promise<FullReport> {
    log.info('IPC: refreshAll')

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

export async function handleGetFileSystemRoots() {
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
