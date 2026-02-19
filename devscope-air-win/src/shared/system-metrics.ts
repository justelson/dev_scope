export const SYSTEM_METRICS_SCHEMA_VERSION = 1

export const SYSTEM_METRICS_CONTROL = {
    version: 0,
    running: 1,
    lastError: 2
} as const

export const SYSTEM_METRIC_SLOTS = {
    cpuLoad: 0,
    cpuCurrentSpeed: 1,
    cpuTemperature: 2,
    memoryUsed: 3,
    memoryFree: 4,
    memoryAvailable: 5,
    memoryCached: 6,
    memoryBuffcache: 7,
    swapUsed: 8,
    swapFree: 9,
    diskReadPerSecond: 10,
    diskWritePerSecond: 11,
    processAll: 12,
    processRunning: 13,
    processBlocked: 14,
    processSleeping: 15,
    batteryPercent: 16,
    batteryCharging: 17,
    batteryAcConnected: 18,
    batteryTimeRemaining: 19,
    updatedAt: 20
} as const

export const SYSTEM_METRICS_CONTROL_SLOTS = 4
export const SYSTEM_METRICS_VALUE_SLOTS = 21

export interface SharedSystemMetrics {
    cpuLoad: number
    cpuCurrentSpeed: number
    cpuTemperature: number | null
    memoryUsed: number
    memoryFree: number
    memoryAvailable: number
    memoryCached: number
    memoryBuffcache: number
    swapUsed: number
    swapFree: number
    diskReadPerSecond: number
    diskWritePerSecond: number
    processAll: number
    processRunning: number
    processBlocked: number
    processSleeping: number
    batteryPercent: number | null
    batteryCharging: boolean | null
    batteryAcConnected: boolean | null
    batteryTimeRemaining: number | null
    updatedAt: number
    version: number
    running: boolean
    hasError: boolean
}
