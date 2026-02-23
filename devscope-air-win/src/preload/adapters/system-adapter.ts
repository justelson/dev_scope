import { ipcRenderer } from 'electron'
import {
    SYSTEM_METRIC_SLOTS,
    SYSTEM_METRICS_CONTROL,
    type SharedSystemMetrics
} from '../../shared/system-metrics'

type SystemSharedViews = {
    control: Int32Array
    values: Float64Array
}

let systemSharedViews: SystemSharedViews | null = null

function toNullableNumber(value: number): number | null {
    return Number.isFinite(value) ? value : null
}

function toNullableBoolean(value: number): boolean | null {
    if (!Number.isFinite(value)) return null
    return value >= 1
}

function readSharedMetrics(): SharedSystemMetrics | null {
    if (!systemSharedViews) return null

    const { control, values } = systemSharedViews

    return {
        cpuLoad: values[SYSTEM_METRIC_SLOTS.cpuLoad] || 0,
        cpuCurrentSpeed: values[SYSTEM_METRIC_SLOTS.cpuCurrentSpeed] || 0,
        cpuTemperature: toNullableNumber(values[SYSTEM_METRIC_SLOTS.cpuTemperature]),
        memoryUsed: values[SYSTEM_METRIC_SLOTS.memoryUsed] || 0,
        memoryFree: values[SYSTEM_METRIC_SLOTS.memoryFree] || 0,
        memoryAvailable: values[SYSTEM_METRIC_SLOTS.memoryAvailable] || 0,
        memoryCached: values[SYSTEM_METRIC_SLOTS.memoryCached] || 0,
        memoryBuffcache: values[SYSTEM_METRIC_SLOTS.memoryBuffcache] || 0,
        swapUsed: values[SYSTEM_METRIC_SLOTS.swapUsed] || 0,
        swapFree: values[SYSTEM_METRIC_SLOTS.swapFree] || 0,
        diskReadPerSecond: values[SYSTEM_METRIC_SLOTS.diskReadPerSecond] || 0,
        diskWritePerSecond: values[SYSTEM_METRIC_SLOTS.diskWritePerSecond] || 0,
        processAll: values[SYSTEM_METRIC_SLOTS.processAll] || 0,
        processRunning: values[SYSTEM_METRIC_SLOTS.processRunning] || 0,
        processBlocked: values[SYSTEM_METRIC_SLOTS.processBlocked] || 0,
        processSleeping: values[SYSTEM_METRIC_SLOTS.processSleeping] || 0,
        batteryPercent: toNullableNumber(values[SYSTEM_METRIC_SLOTS.batteryPercent]),
        batteryCharging: toNullableBoolean(values[SYSTEM_METRIC_SLOTS.batteryCharging]),
        batteryAcConnected: toNullableBoolean(values[SYSTEM_METRIC_SLOTS.batteryAcConnected]),
        batteryTimeRemaining: toNullableNumber(values[SYSTEM_METRIC_SLOTS.batteryTimeRemaining]),
        updatedAt: values[SYSTEM_METRIC_SLOTS.updatedAt] || 0,
        version: Atomics.load(control, SYSTEM_METRICS_CONTROL.version),
        running: Atomics.load(control, SYSTEM_METRICS_CONTROL.running) === 1,
        hasError: Atomics.load(control, SYSTEM_METRICS_CONTROL.lastError) === 1
    }
}

export function createSystemAdapter() {
    return {
        getSystemOverview: () => ipcRenderer.invoke('devscope:getSystemOverview'),
        getDetailedSystemStats: () => ipcRenderer.invoke('devscope:getDetailedSystemStats'),
        getDeveloperTooling: () => ipcRenderer.invoke('devscope:getDeveloperTooling'),
        getReadinessReport: () => ipcRenderer.invoke('devscope:getReadinessReport'),
        refreshAll: () => ipcRenderer.invoke('devscope:refreshAll'),
        system: {
            bootstrap: async () => {
                const payload = await ipcRenderer.invoke('devscope:system:bootstrap')
                if (payload?.success && payload.controlBuffer && payload.metricsBuffer) {
                    systemSharedViews = {
                        control: new Int32Array(payload.controlBuffer),
                        values: new Float64Array(payload.metricsBuffer)
                    }
                } else {
                    systemSharedViews = null
                }
                return payload
            },
            subscribe: (options?: { intervalMs?: number }) => ipcRenderer.invoke('devscope:system:subscribe', options),
            unsubscribe: () => ipcRenderer.invoke('devscope:system:unsubscribe'),
            readSharedMetrics: () => readSharedMetrics(),
            readMetrics: () => ipcRenderer.invoke('devscope:system:readMetrics')
        }
    }
}
