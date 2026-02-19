import { parentPort, workerData } from 'worker_threads'
import si from 'systeminformation'
import {
    SYSTEM_METRICS_CONTROL,
    SYSTEM_METRICS_VALUE_SLOTS,
    SYSTEM_METRIC_SLOTS
} from '../../shared/system-metrics'

type WorkerInput = {
    controlBuffer: SharedArrayBuffer
    metricsBuffer: SharedArrayBuffer
    intervalMs?: number
}

type WorkerCommand =
    | { type: 'setInterval'; intervalMs: number }
    | { type: 'stop' }

const MIN_INTERVAL_MS = 500
const DEFAULT_INTERVAL_MS = 2000
const PROBE_TIMEOUT_MS = 1500
const PROCESS_SAMPLE_INTERVAL_MS = 15000
const PROCESS_PROBE_TIMEOUT_MS = 4000

const input = workerData as WorkerInput
const control = new Int32Array(input.controlBuffer)
const metrics = new Float64Array(input.metricsBuffer)

let currentIntervalMs = Math.max(MIN_INTERVAL_MS, Number(input.intervalMs) || DEFAULT_INTERVAL_MS)
let timer: NodeJS.Timeout | null = null
let sampleInFlight = false
let processSampleInFlight = false
let lastProcessSampleAt = 0
let lastProcessSnapshot: { all: number; running: number; blocked: number; sleeping: number } | null = null

for (let i = 0; i < SYSTEM_METRICS_VALUE_SLOTS; i += 1) {
    metrics[i] = Number.NaN
}

function write(slot: number, value: number | null | undefined): void {
    metrics[slot] = typeof value === 'number' && Number.isFinite(value) ? value : Number.NaN
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

async function sampleProcessesIfNeeded(force = false): Promise<void> {
    const now = Date.now()
    if (!force && (now - lastProcessSampleAt) < PROCESS_SAMPLE_INTERVAL_MS) return
    if (processSampleInFlight) return

    processSampleInFlight = true
    try {
        const processes = await withTimeout(
            si.processes().catch(() => null),
            PROCESS_PROBE_TIMEOUT_MS,
            null as any
        )

        if (processes) {
            lastProcessSnapshot = {
                all: typeof processes.all === 'number' ? processes.all : 0,
                running: typeof processes.running === 'number' ? processes.running : 0,
                blocked: typeof processes.blocked === 'number' ? processes.blocked : 0,
                sleeping: typeof processes.sleeping === 'number' ? processes.sleeping : 0
            }
        }

        lastProcessSampleAt = now
    } finally {
        processSampleInFlight = false
    }
}

async function sampleMetrics(): Promise<void> {
    if (sampleInFlight) return
    sampleInFlight = true

    try {
        const [currentLoad, cpuCurrentSpeed, cpuTemperature, memory, diskIo, battery] = await Promise.all([
            withTimeout(si.currentLoad(), PROBE_TIMEOUT_MS, null as any),
            withTimeout(si.cpuCurrentSpeed(), PROBE_TIMEOUT_MS, null as any),
            withTimeout(si.cpuTemperature().catch(() => null), PROBE_TIMEOUT_MS, null as any),
            withTimeout(si.mem(), PROBE_TIMEOUT_MS, null as any),
            withTimeout(si.disksIO().catch(() => null), PROBE_TIMEOUT_MS, null as any),
            withTimeout(si.battery().catch(() => null), PROBE_TIMEOUT_MS, null as any)
        ])

        write(SYSTEM_METRIC_SLOTS.cpuLoad, currentLoad?.currentLoad ?? null)
        write(SYSTEM_METRIC_SLOTS.cpuCurrentSpeed, cpuCurrentSpeed?.avg ?? null)
        write(SYSTEM_METRIC_SLOTS.cpuTemperature, cpuTemperature?.main ?? null)

        write(SYSTEM_METRIC_SLOTS.memoryUsed, memory?.used ?? null)
        write(SYSTEM_METRIC_SLOTS.memoryFree, memory?.free ?? null)
        write(SYSTEM_METRIC_SLOTS.memoryAvailable, memory?.available ?? null)
        write(SYSTEM_METRIC_SLOTS.memoryCached, memory?.cached ?? null)
        write(SYSTEM_METRIC_SLOTS.memoryBuffcache, memory?.buffcache ?? null)
        write(SYSTEM_METRIC_SLOTS.swapUsed, memory?.swapused ?? null)
        write(SYSTEM_METRIC_SLOTS.swapFree, memory?.swapfree ?? null)

        write(SYSTEM_METRIC_SLOTS.diskReadPerSecond, diskIo?.rIO_sec ?? null)
        write(SYSTEM_METRIC_SLOTS.diskWritePerSecond, diskIo?.wIO_sec ?? null)

        void sampleProcessesIfNeeded()
        write(SYSTEM_METRIC_SLOTS.processAll, lastProcessSnapshot?.all ?? null)
        write(SYSTEM_METRIC_SLOTS.processRunning, lastProcessSnapshot?.running ?? null)
        write(SYSTEM_METRIC_SLOTS.processBlocked, lastProcessSnapshot?.blocked ?? null)
        write(SYSTEM_METRIC_SLOTS.processSleeping, lastProcessSnapshot?.sleeping ?? null)

        write(SYSTEM_METRIC_SLOTS.batteryPercent, battery?.hasBattery ? battery.percent : null)
        write(SYSTEM_METRIC_SLOTS.batteryCharging, battery?.hasBattery ? (battery.isCharging ? 1 : 0) : null)
        write(SYSTEM_METRIC_SLOTS.batteryAcConnected, battery?.hasBattery ? (battery.acConnected ? 1 : 0) : null)
        write(SYSTEM_METRIC_SLOTS.batteryTimeRemaining, battery?.hasBattery ? battery.timeRemaining : null)

        write(SYSTEM_METRIC_SLOTS.updatedAt, Date.now())

        Atomics.store(control, SYSTEM_METRICS_CONTROL.running, 1)
        Atomics.store(control, SYSTEM_METRICS_CONTROL.lastError, 0)
        Atomics.add(control, SYSTEM_METRICS_CONTROL.version, 1)
    } catch {
        Atomics.store(control, SYSTEM_METRICS_CONTROL.lastError, 1)
    } finally {
        sampleInFlight = false
    }
}

function stopSampling(): void {
    if (timer) {
        clearInterval(timer)
        timer = null
    }
    Atomics.store(control, SYSTEM_METRICS_CONTROL.running, 0)
}

function startSampling(intervalMs: number): void {
    stopSampling()
    currentIntervalMs = Math.max(MIN_INTERVAL_MS, Number(intervalMs) || DEFAULT_INTERVAL_MS)
    void sampleProcessesIfNeeded(true)
    void sampleMetrics()
    timer = setInterval(() => {
        void sampleMetrics()
    }, currentIntervalMs)
}

parentPort?.on('message', (message: WorkerCommand) => {
    if (message.type === 'stop') {
        stopSampling()
        return
    }
    if (message.type === 'setInterval') {
        startSampling(message.intervalMs)
    }
})

startSampling(currentIntervalMs)
