import os from 'os'
import type { CollectorState, LiveMetrics, StaticSnapshot } from './collector-types'

export function createInitialStaticSnapshot(): StaticSnapshot {
    return {
        cpu: {
            model: 'Unknown CPU',
            manufacturer: 'Unknown',
            cores: 0,
            physicalCores: 0,
            speed: 0,
            speedMin: 0,
            speedMax: 0
        },
        memory: {
            total: os.totalmem(),
            active: 0,
            cached: 0,
            buffcache: 0,
            swapTotal: 0,
            layout: []
        },
        disks: [],
        networkInterfaces: [],
        os: {
            platform: process.platform,
            distro: '',
            release: '',
            codename: '',
            kernel: '',
            arch: process.arch,
            hostname: '',
            build: '',
            serial: '',
            uefi: false
        },
        battery: null
    }
}

export function createInitialLiveMetrics(): LiveMetrics {
    return {
        cpuLoad: 0,
        cpuCurrentSpeed: 0,
        cpuTemperature: null,
        memoryUsed: 0,
        memoryFree: 0,
        memoryAvailable: 0,
        memoryCached: 0,
        memoryBuffcache: 0,
        swapUsed: 0,
        swapFree: 0,
        diskReadPerSecond: 0,
        diskWritePerSecond: 0,
        processAll: 0,
        processRunning: 0,
        processBlocked: 0,
        processSleeping: 0,
        batteryPercent: null,
        batteryCharging: null,
        batteryAcConnected: null,
        batteryTimeRemaining: null,
        updatedAt: 0,
        version: 0,
        running: false,
        hasError: false
    }
}

export function createInitialCollectorState(): CollectorState {
    return {
        staticSnapshot: createInitialStaticSnapshot(),
        liveMetrics: createInitialLiveMetrics(),
        processStats: { all: 0, running: 0, blocked: 0, sleeping: 0 },
        networkStats: []
    }
}
