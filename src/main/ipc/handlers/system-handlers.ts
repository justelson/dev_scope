import log from 'electron-log'
import si from 'systeminformation'
import { getSystemInfo } from '../../inspectors'
import type { SystemHealth } from '../../inspectors/types'
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
