import os from 'os'
import si from 'systeminformation'
import { PROCESS_PROBE_TIMEOUT_MS, PROBE_TIMEOUT_MS } from './collector-constants'
import type { CollectorSnapshot, CollectorState } from './collector-types'
import { toNullableBoolean, toNullableNumber, toNumber, withTimeout } from './collector-utils'

export function buildSnapshot(state: CollectorState): CollectorSnapshot {
    const { staticSnapshot, liveMetrics, processStats, networkStats } = state
    const fallbackMemoryTotal = liveMetrics.memoryUsed + Math.max(liveMetrics.memoryFree, liveMetrics.memoryAvailable, 0)
    const memoryTotal = Math.max(staticSnapshot.memory.total, fallbackMemoryTotal, os.totalmem(), 1)

    return {
        cpu: {
            ...staticSnapshot.cpu,
            currentSpeed: liveMetrics.cpuCurrentSpeed || staticSnapshot.cpu.speed,
            temperature: liveMetrics.cpuTemperature,
            load: liveMetrics.cpuLoad
        },
        memory: {
            ...staticSnapshot.memory,
            total: memoryTotal,
            used: liveMetrics.memoryUsed,
            free: liveMetrics.memoryFree,
            available: liveMetrics.memoryAvailable,
            cached: liveMetrics.memoryCached || staticSnapshot.memory.cached,
            buffcache: liveMetrics.memoryBuffcache || staticSnapshot.memory.buffcache,
            swapUsed: liveMetrics.swapUsed,
            swapFree: liveMetrics.swapFree
        },
        disks: staticSnapshot.disks,
        diskIO: {
            rIO: 0,
            wIO: 0,
            tIO: 0,
            rIO_sec: liveMetrics.diskReadPerSecond,
            wIO_sec: liveMetrics.diskWritePerSecond
        },
        network: {
            interfaces: staticSnapshot.networkInterfaces,
            stats: networkStats
        },
        os: staticSnapshot.os,
        battery: staticSnapshot.battery
            ? {
                ...staticSnapshot.battery,
                percent: liveMetrics.batteryPercent ?? 0,
                isCharging: liveMetrics.batteryCharging ?? false,
                acConnected: liveMetrics.batteryAcConnected ?? false,
                timeRemaining: liveMetrics.batteryTimeRemaining ?? 0
            }
            : null,
        processes: processStats,
        timestamp: liveMetrics.updatedAt || Date.now()
    }
}

export async function collectStaticSnapshot(state: CollectorState): Promise<void> {
    const [cpuData, memInfo, memLayout, fsSize, networkInterfaces, osInfo, battery] = await Promise.all([
        withTimeout(si.cpu(), PROBE_TIMEOUT_MS, null as any),
        withTimeout(si.mem(), PROBE_TIMEOUT_MS, null as any),
        withTimeout(si.memLayout(), PROCESS_PROBE_TIMEOUT_MS, [] as any[]),
        withTimeout(si.fsSize(), PROCESS_PROBE_TIMEOUT_MS, [] as any[]),
        withTimeout(si.networkInterfaces(), PROCESS_PROBE_TIMEOUT_MS, [] as any[]),
        withTimeout(si.osInfo(), PROBE_TIMEOUT_MS, null as any),
        withTimeout(si.battery().catch(() => null), PROBE_TIMEOUT_MS, null as any)
    ])

    state.staticSnapshot = {
        cpu: {
            model: cpuData?.brand || cpuData?.manufacturer || 'Unknown CPU',
            manufacturer: cpuData?.manufacturer || 'Unknown',
            cores: toNumber(cpuData?.cores),
            physicalCores: toNumber(cpuData?.physicalCores),
            speed: toNumber(cpuData?.speed),
            speedMin: toNumber(cpuData?.speedMin),
            speedMax: toNumber(cpuData?.speedMax)
        },
        memory: {
            total: Math.max(toNumber(memInfo?.total), os.totalmem(), 1),
            active: toNumber(memInfo?.active),
            cached: toNumber(memInfo?.cached),
            buffcache: toNumber(memInfo?.buffcache),
            swapTotal: toNumber(memInfo?.swaptotal),
            layout: memLayout.map((module) => ({
                size: toNumber(module?.size),
                type: module?.type || '',
                clockSpeed: toNumber(module?.clockSpeed),
                manufacturer: module?.manufacturer || '',
                partNum: module?.partNum || '',
                formFactor: module?.formFactor || ''
            }))
        },
        disks: fsSize.map((fs) => ({
            fs: fs?.fs || '',
            type: fs?.type || '',
            size: toNumber(fs?.size),
            used: toNumber(fs?.used),
            available: toNumber(fs?.available),
            use: toNumber(fs?.use),
            mount: fs?.mount || fs?.fs || ''
        })),
        networkInterfaces: networkInterfaces.map((iface) => ({
            iface: iface?.iface || '',
            ip4: iface?.ip4 || '',
            ip6: iface?.ip6 || '',
            mac: iface?.mac || '',
            type: iface?.type || '',
            speed: toNumber(iface?.speed),
            operstate: iface?.operstate || ''
        })),
        os: {
            platform: osInfo?.platform || process.platform,
            distro: osInfo?.distro || '',
            release: osInfo?.release || '',
            codename: osInfo?.codename || '',
            kernel: osInfo?.kernel || '',
            arch: osInfo?.arch || process.arch,
            hostname: osInfo?.hostname || '',
            build: osInfo?.build || '',
            serial: osInfo?.serial || '',
            uefi: Boolean(osInfo?.uefi)
        },
        battery: battery && battery.hasBattery
            ? {
                hasBattery: true,
                voltage: toNumber(battery.voltage),
                designedCapacity: toNumber(battery.designedCapacity),
                currentCapacity: toNumber(battery.currentCapacity)
            }
            : null
    }
}

export async function collectFastMetrics(state: CollectorState): Promise<void> {
    const [currentLoad, cpuCurrentSpeed, cpuTemperature, memory, diskIo, battery] = await Promise.all([
        withTimeout(si.currentLoad(), PROBE_TIMEOUT_MS, null as any),
        withTimeout(si.cpuCurrentSpeed(), PROBE_TIMEOUT_MS, null as any),
        withTimeout(si.cpuTemperature().catch(() => null), PROBE_TIMEOUT_MS, null as any),
        withTimeout(si.mem(), PROBE_TIMEOUT_MS, null as any),
        withTimeout(si.disksIO().catch(() => null), PROBE_TIMEOUT_MS, null as any),
        withTimeout(si.battery().catch(() => null), PROBE_TIMEOUT_MS, null as any)
    ])

    state.liveMetrics = {
        ...state.liveMetrics,
        cpuLoad: toNumber(currentLoad?.currentLoad),
        cpuCurrentSpeed: toNumber(cpuCurrentSpeed?.avg, state.staticSnapshot.cpu.speed),
        cpuTemperature: toNullableNumber(cpuTemperature?.main),
        memoryUsed: toNumber(memory?.used),
        memoryFree: toNumber(memory?.free),
        memoryAvailable: toNumber(memory?.available),
        memoryCached: toNumber(memory?.cached, state.staticSnapshot.memory.cached),
        memoryBuffcache: toNumber(memory?.buffcache, state.staticSnapshot.memory.buffcache),
        swapUsed: toNumber(memory?.swapused),
        swapFree: toNumber(memory?.swapfree),
        diskReadPerSecond: toNumber(diskIo?.rIO_sec),
        diskWritePerSecond: toNumber(diskIo?.wIO_sec),
        batteryPercent: toNullableNumber(battery?.hasBattery ? battery.percent : null),
        batteryCharging: toNullableBoolean(battery?.hasBattery ? battery.isCharging : null),
        batteryAcConnected: toNullableBoolean(battery?.hasBattery ? battery.acConnected : null),
        batteryTimeRemaining: toNullableNumber(battery?.hasBattery ? battery.timeRemaining : null),
        processAll: state.processStats.all,
        processRunning: state.processStats.running,
        processBlocked: state.processStats.blocked,
        processSleeping: state.processStats.sleeping,
        updatedAt: Date.now(),
        version: state.liveMetrics.version + 1,
        running: true,
        hasError: false
    }
}

export async function collectProcessMetrics(state: CollectorState): Promise<void> {
    const processes = await withTimeout(si.processes().catch(() => null), PROCESS_PROBE_TIMEOUT_MS, null as any)
    if (!processes) return

    state.processStats = {
        all: toNumber(processes.all),
        running: toNumber(processes.running),
        blocked: toNumber(processes.blocked),
        sleeping: toNumber(processes.sleeping)
    }
}

export async function collectNetworkStats(state: CollectorState): Promise<void> {
    const stats = await withTimeout(si.networkStats().catch(() => []), PROCESS_PROBE_TIMEOUT_MS, [] as any[])
    state.networkStats = stats.map((stat) => ({
        iface: stat?.iface || '',
        rx_bytes: toNumber(stat?.rx_bytes),
        tx_bytes: toNumber(stat?.tx_bytes),
        rx_sec: toNumber(stat?.rx_sec),
        tx_sec: toNumber(stat?.tx_sec)
    }))
}
