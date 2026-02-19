import os from 'os'
import si from 'systeminformation'

const DEFAULT_INTERVAL_MS = 1000
const MIN_INTERVAL_MS = 500
const MAX_INTERVAL_MS = 5000
const PROBE_TIMEOUT_MS = 1500
const PROCESS_PROBE_TIMEOUT_MS = 4000
const PROCESS_SAMPLE_INTERVAL_MS = 15000
const NETWORK_SAMPLE_INTERVAL_MS = 30000
const STATIC_REFRESH_INTERVAL_MS = 5 * 60 * 1000

type CollectorRequest = {
    type: 'request'
    id: number
    action: 'getSnapshot' | 'getLiveMetrics' | 'setInterval' | 'refreshStatic' | 'stop'
    data?: Record<string, unknown>
}

type LiveMetrics = {
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

type StaticSnapshot = {
    cpu: {
        model: string
        manufacturer: string
        cores: number
        physicalCores: number
        speed: number
        speedMin: number
        speedMax: number
    }
    memory: {
        total: number
        active: number
        cached: number
        buffcache: number
        swapTotal: number
        layout: Array<{
            size: number
            type: string
            clockSpeed: number
            manufacturer: string
            partNum: string
            formFactor: string
        }>
    }
    disks: Array<{
        fs: string
        type: string
        size: number
        used: number
        available: number
        use: number
        mount: string
    }>
    networkInterfaces: Array<{
        iface: string
        ip4: string
        ip6: string
        mac: string
        type: string
        speed: number
        operstate: string
    }>
    os: {
        platform: string
        distro: string
        release: string
        codename: string
        kernel: string
        arch: string
        hostname: string
        build: string
        serial: string
        uefi: boolean
    }
    battery: {
        hasBattery: boolean
        voltage: number
        designedCapacity: number
        currentCapacity: number
    } | null
}

type ProcessStats = {
    all: number
    running: number
    blocked: number
    sleeping: number
}

type NetworkStat = {
    iface: string
    rx_bytes: number
    tx_bytes: number
    rx_sec: number
    tx_sec: number
}

const parentPort = (process as any).parentPort
const hasProcessSend = typeof process.send === 'function'

if (!parentPort && !hasProcessSend) {
    process.exit(1)
}

let fastIntervalMs = DEFAULT_INTERVAL_MS
let fastTimer: NodeJS.Timeout | null = null
let processTimer: NodeJS.Timeout | null = null
let networkTimer: NodeJS.Timeout | null = null
let staticRefreshTimer: NodeJS.Timeout | null = null

let processStats: ProcessStats = { all: 0, running: 0, blocked: 0, sleeping: 0 }
let networkStats: NetworkStat[] = []

let staticSnapshot: StaticSnapshot = {
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

let liveMetrics: LiveMetrics = {
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

function normalizeInterval(value?: number): number {
    const parsed = Number(value)
    if (!Number.isFinite(parsed)) return DEFAULT_INTERVAL_MS
    return Math.min(MAX_INTERVAL_MS, Math.max(MIN_INTERVAL_MS, Math.floor(parsed)))
}

function toNumber(value: unknown, fallback = 0): number {
    return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function toNullableNumber(value: unknown): number | null {
    return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function toNullableBoolean(value: unknown): boolean | null {
    if (typeof value !== 'boolean') return null
    return value
}

async function withTimeout<T>(task: Promise<T>, timeoutMs: number, fallback: T): Promise<T> {
    let timeout: NodeJS.Timeout | null = null

    try {
        return await Promise.race<T>([
            task,
            new Promise<T>((resolve) => {
                timeout = setTimeout(() => resolve(fallback), timeoutMs)
            })
        ])
    } catch {
        return fallback
    } finally {
        if (timeout) clearTimeout(timeout)
    }
}

function postError(message: string): void {
    if (parentPort) {
        parentPort.postMessage({ type: 'error', message })
        return
    }
    if (hasProcessSend) {
        process.send?.({ type: 'error', message })
    }
}

function postMetrics(): void {
    if (parentPort) {
        parentPort.postMessage({ type: 'metrics', data: liveMetrics })
        return
    }
    if (hasProcessSend) {
        process.send?.({ type: 'metrics', data: liveMetrics })
    }
}

function buildSnapshot() {
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

async function collectStaticSnapshot(): Promise<void> {
    const [cpuData, memInfo, memLayout, fsSize, networkInterfaces, osInfo, battery] = await Promise.all([
        withTimeout(si.cpu(), PROBE_TIMEOUT_MS, null as any),
        withTimeout(si.mem(), PROBE_TIMEOUT_MS, null as any),
        withTimeout(si.memLayout(), PROCESS_PROBE_TIMEOUT_MS, [] as any[]),
        withTimeout(si.fsSize(), PROCESS_PROBE_TIMEOUT_MS, [] as any[]),
        withTimeout(si.networkInterfaces(), PROCESS_PROBE_TIMEOUT_MS, [] as any[]),
        withTimeout(si.osInfo(), PROBE_TIMEOUT_MS, null as any),
        withTimeout(si.battery().catch(() => null), PROBE_TIMEOUT_MS, null as any)
    ])

    staticSnapshot = {
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

async function collectFastMetrics(): Promise<void> {
    const [currentLoad, cpuCurrentSpeed, cpuTemperature, memory, diskIo, battery] = await Promise.all([
        withTimeout(si.currentLoad(), PROBE_TIMEOUT_MS, null as any),
        withTimeout(si.cpuCurrentSpeed(), PROBE_TIMEOUT_MS, null as any),
        withTimeout(si.cpuTemperature().catch(() => null), PROBE_TIMEOUT_MS, null as any),
        withTimeout(si.mem(), PROBE_TIMEOUT_MS, null as any),
        withTimeout(si.disksIO().catch(() => null), PROBE_TIMEOUT_MS, null as any),
        withTimeout(si.battery().catch(() => null), PROBE_TIMEOUT_MS, null as any)
    ])

    liveMetrics = {
        ...liveMetrics,
        cpuLoad: toNumber(currentLoad?.currentLoad),
        cpuCurrentSpeed: toNumber(cpuCurrentSpeed?.avg, staticSnapshot.cpu.speed),
        cpuTemperature: toNullableNumber(cpuTemperature?.main),
        memoryUsed: toNumber(memory?.used),
        memoryFree: toNumber(memory?.free),
        memoryAvailable: toNumber(memory?.available),
        memoryCached: toNumber(memory?.cached, staticSnapshot.memory.cached),
        memoryBuffcache: toNumber(memory?.buffcache, staticSnapshot.memory.buffcache),
        swapUsed: toNumber(memory?.swapused),
        swapFree: toNumber(memory?.swapfree),
        diskReadPerSecond: toNumber(diskIo?.rIO_sec),
        diskWritePerSecond: toNumber(diskIo?.wIO_sec),
        batteryPercent: toNullableNumber(battery?.hasBattery ? battery.percent : null),
        batteryCharging: toNullableBoolean(battery?.hasBattery ? battery.isCharging : null),
        batteryAcConnected: toNullableBoolean(battery?.hasBattery ? battery.acConnected : null),
        batteryTimeRemaining: toNullableNumber(battery?.hasBattery ? battery.timeRemaining : null),
        processAll: processStats.all,
        processRunning: processStats.running,
        processBlocked: processStats.blocked,
        processSleeping: processStats.sleeping,
        updatedAt: Date.now(),
        version: liveMetrics.version + 1,
        running: true,
        hasError: false
    }
}

async function collectProcessMetrics(): Promise<void> {
    const processes = await withTimeout(si.processes().catch(() => null), PROCESS_PROBE_TIMEOUT_MS, null as any)
    if (!processes) return

    processStats = {
        all: toNumber(processes.all),
        running: toNumber(processes.running),
        blocked: toNumber(processes.blocked),
        sleeping: toNumber(processes.sleeping)
    }
}

async function collectNetworkStats(): Promise<void> {
    const stats = await withTimeout(si.networkStats().catch(() => []), PROCESS_PROBE_TIMEOUT_MS, [] as any[])
    networkStats = stats.map((stat) => ({
        iface: stat?.iface || '',
        rx_bytes: toNumber(stat?.rx_bytes),
        tx_bytes: toNumber(stat?.tx_bytes),
        rx_sec: toNumber(stat?.rx_sec),
        tx_sec: toNumber(stat?.tx_sec)
    }))
}

function clearTimer(timer: NodeJS.Timeout | null): void {
    if (timer) clearInterval(timer)
}

function restartFastTimer(): void {
    clearTimer(fastTimer)
    fastTimer = setInterval(() => {
        void runFastTick()
    }, fastIntervalMs)
}

async function runFastTick(): Promise<void> {
    try {
        await collectFastMetrics()
        postMetrics()
    } catch (error) {
        liveMetrics = {
            ...liveMetrics,
            hasError: true
        }
        postError(error instanceof Error ? error.message : 'fast metrics failed')
    }
}

async function runProcessTick(): Promise<void> {
    try {
        await collectProcessMetrics()
    } catch (error) {
        postError(error instanceof Error ? error.message : 'process metrics failed')
    }
}

async function runNetworkTick(): Promise<void> {
    try {
        await collectNetworkStats()
    } catch (error) {
        postError(error instanceof Error ? error.message : 'network metrics failed')
    }
}

async function runStaticRefresh(): Promise<void> {
    try {
        await collectStaticSnapshot()
    } catch (error) {
        postError(error instanceof Error ? error.message : 'static refresh failed')
    }
}

async function initialize(): Promise<void> {
    await Promise.all([
        runStaticRefresh(),
        runProcessTick(),
        runNetworkTick(),
        runFastTick()
    ])

    restartFastTimer()
    processTimer = setInterval(() => {
        void runProcessTick()
    }, PROCESS_SAMPLE_INTERVAL_MS)
    networkTimer = setInterval(() => {
        void runNetworkTick()
    }, NETWORK_SAMPLE_INTERVAL_MS)
    staticRefreshTimer = setInterval(() => {
        void runStaticRefresh()
    }, STATIC_REFRESH_INTERVAL_MS)
}

function cleanup(): void {
    clearTimer(fastTimer)
    clearTimer(processTimer)
    clearTimer(networkTimer)
    clearTimer(staticRefreshTimer)
    fastTimer = null
    processTimer = null
    networkTimer = null
    staticRefreshTimer = null
}

async function handleRequest(message: CollectorRequest): Promise<void> {
    const respond = (success: boolean, data?: any, error?: string) => {
        const payload = {
            type: 'response',
            id: message.id,
            success,
            data,
            error
        }

        if (parentPort) {
            parentPort.postMessage(payload)
            return
        }
        if (hasProcessSend) {
            process.send?.(payload)
        }
    }

    try {
        switch (message.action) {
            case 'getSnapshot':
                await initPromise
                respond(true, buildSnapshot())
                return
            case 'getLiveMetrics':
                await initPromise
                respond(true, liveMetrics)
                return
            case 'setInterval':
                fastIntervalMs = normalizeInterval(message.data?.intervalMs as number | undefined)
                restartFastTimer()
                respond(true, { intervalMs: fastIntervalMs })
                return
            case 'refreshStatic':
                await runStaticRefresh()
                respond(true, { refreshed: true })
                return
            case 'stop':
                cleanup()
                respond(true, { stopped: true })
                setTimeout(() => process.exit(0), 10)
                return
            default:
                respond(false, undefined, `Unknown action: ${(message as any).action}`)
        }
    } catch (error) {
        respond(false, undefined, error instanceof Error ? error.message : 'request failed')
    }
}

if (parentPort) {
    parentPort.on('message', (message: CollectorRequest) => {
        if (!message || message.type !== 'request') return
        void handleRequest(message)
    })
} else {
    process.on('message', (message: any) => {
        if (!message || message.type !== 'request') return
        void handleRequest(message as CollectorRequest)
    })
}

process.on('uncaughtException', (error) => {
    postError(error.message)
})

process.on('unhandledRejection', (reason) => {
    const message = reason instanceof Error ? reason.message : String(reason)
    postError(message)
})

const initPromise = initialize().catch((error) => {
    postError(error instanceof Error ? error.message : 'collector init failed')
})
