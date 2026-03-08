import { fork, type ChildProcess } from 'child_process'
import { join } from 'path'
import log from 'electron-log'
import { SYSTEM_METRICS_SCHEMA_VERSION } from '../../shared/system-metrics'

const DEFAULT_INTERVAL_MS = 1000
const MIN_INTERVAL_MS = 500
const MAX_INTERVAL_MS = 5000
const IDLE_STOP_DELAY_MS = 15000
const REQUEST_TIMEOUT_MS = 5000

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

type DetailedSystemSnapshot = {
    cpu: {
        model: string
        manufacturer: string
        cores: number
        physicalCores: number
        speed: number
        speedMin: number
        speedMax: number
        currentSpeed: number
        temperature: number | null
        load: number
    }
    memory: {
        total: number
        used: number
        free: number
        available: number
        active: number
        cached: number
        buffcache: number
        swapTotal: number
        swapUsed: number
        swapFree: number
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
    diskIO: {
        rIO: number
        wIO: number
        tIO: number
        rIO_sec: number
        wIO_sec: number
    } | null
    network: {
        interfaces: Array<{
            iface: string
            ip4: string
            ip6: string
            mac: string
            type: string
            speed: number
            operstate: string
        }>
        stats: Array<{
            iface: string
            rx_bytes: number
            tx_bytes: number
            rx_sec: number
            tx_sec: number
        }>
    }
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
        percent: number
        isCharging: boolean
        acConnected: boolean
        timeRemaining: number
        voltage: number
        designedCapacity: number
        currentCapacity: number
    } | null
    processes: {
        all: number
        running: number
        blocked: number
        sleeping: number
    }
    timestamp: number
}

type CollectorRequest = {
    type: 'request'
    id: number
    action: 'getSnapshot' | 'getLiveMetrics' | 'setInterval' | 'refreshStatic' | 'stop'
    data?: Record<string, unknown>
}

type CollectorResponse = {
    type: 'response'
    id: number
    success: boolean
    data?: any
    error?: string
}

type CollectorMetricsPush = {
    type: 'metrics'
    data: LiveMetrics
}

type CollectorErrorPush = {
    type: 'error'
    message: string
}

type CollectorPush = CollectorMetricsPush | CollectorErrorPush
type CollectorMessage = CollectorResponse | CollectorPush

type PendingRequest = {
    resolve: (value: any) => void
    reject: (error: Error) => void
    timer: NodeJS.Timeout
}

function normalizeInterval(value?: number): number {
    const parsed = Number(value)
    if (!Number.isFinite(parsed)) return DEFAULT_INTERVAL_MS
    return Math.min(MAX_INTERVAL_MS, Math.max(MIN_INTERVAL_MS, Math.floor(parsed)))
}

function createEmptyMetrics(): LiveMetrics {
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

class SystemMetricsBridge {
    private collector: ChildProcess | null = null
    private readonly subscribers = new Set<number>()
    private stopTimer: NodeJS.Timeout | null = null
    private intervalMs = DEFAULT_INTERVAL_MS
    private requestId = 0
    private readonly pending = new Map<number, PendingRequest>()
    private latestMetrics: LiveMetrics = createEmptyMetrics()
    private latestSnapshot: DetailedSystemSnapshot | null = null

    private getCollectorPath(): string {
        return join(__dirname, 'system-metrics-collector.js')
    }

    private cancelIdleStop(): void {
        if (!this.stopTimer) return
        clearTimeout(this.stopTimer)
        this.stopTimer = null
    }

    private scheduleIdleStop(): void {
        this.cancelIdleStop()
        this.stopTimer = setTimeout(() => {
            if (this.subscribers.size === 0) {
                void this.stopCollector()
            }
        }, IDLE_STOP_DELAY_MS)
    }

    private rejectPending(reason: string): void {
        for (const [id, pending] of this.pending.entries()) {
            clearTimeout(pending.timer)
            pending.reject(new Error(reason))
            this.pending.delete(id)
        }
    }

    private onCollectorMessage(message: CollectorMessage): void {
        if (!message || typeof message !== 'object') return

        if (message.type === 'metrics') {
            this.latestMetrics = message.data
            return
        }

        if (message.type === 'error') {
            this.latestMetrics = {
                ...this.latestMetrics,
                hasError: true
            }
            log.warn(`[SystemMetrics] Collector reported error: ${message.message}`)
            return
        }

        if (message.type === 'response') {
            const pending = this.pending.get(message.id)
            if (!pending) return
            clearTimeout(pending.timer)
            this.pending.delete(message.id)
            if (!message.success) {
                pending.reject(new Error(message.error || 'Collector request failed'))
                return
            }
            pending.resolve(message.data)
        }
    }

    private ensureCollector(): void {
        if (this.collector) return

        const child = fork(this.getCollectorPath(), [], {
            stdio: ['pipe', 'pipe', 'pipe', 'ipc']
        })
        child.on('spawn', () => {
            log.info('[SystemMetrics] Collector process started')
        })
        child.on('message', (message) => {
            this.onCollectorMessage(message as CollectorMessage)
        })
        child.on('exit', (code) => {
            if (code !== 0) {
                log.warn(`[SystemMetrics] Collector exited with code ${code}`)
            }
            this.collector = null
            this.latestMetrics = {
                ...this.latestMetrics,
                running: false
            }
            this.rejectPending('Collector exited')
        })
        child.on('error', (error) => {
            log.error('[SystemMetrics] Collector error:', error)
            this.latestMetrics = {
                ...this.latestMetrics,
                hasError: true
            }
        })

        this.collector = child
    }

    private async request<T = any>(
        action: CollectorRequest['action'],
        data?: Record<string, unknown>,
        timeoutMs = REQUEST_TIMEOUT_MS
    ): Promise<T> {
        this.ensureCollector()

        if (!this.collector) {
            throw new Error('Collector unavailable')
        }

        const id = ++this.requestId
        const request: CollectorRequest = { type: 'request', id, action, data }

        return await new Promise<T>((resolve, reject) => {
            const timer = setTimeout(() => {
                this.pending.delete(id)
                reject(new Error(`Collector request timeout: ${action}`))
            }, timeoutMs)

            this.pending.set(id, { resolve, reject, timer })
            this.collector?.send(request)
        })
    }

    private async stopCollector(): Promise<void> {
        const collector = this.collector
        if (!collector) return

        try {
            await this.request('stop', undefined, 2000)
        } catch {
            try {
                collector.kill()
            } catch {
                // no-op
            }
        }

        this.collector = null
        this.latestMetrics = {
            ...this.latestMetrics,
            running: false
        }
    }

    async bootstrap() {
        this.ensureCollector()
        try {
            const snapshot = await this.getSnapshot()
            return {
                success: true,
                schemaVersion: SYSTEM_METRICS_SCHEMA_VERSION,
                snapshot
            }
        } catch (error) {
            log.error('[SystemMetrics] bootstrap failed:', error)
            return {
                success: false,
                error: error instanceof Error ? error.message : 'bootstrap failed'
            }
        }
    }

    async getSnapshot(forceRefresh = false): Promise<DetailedSystemSnapshot> {
        if (forceRefresh) {
            await this.request('refreshStatic').catch(() => { })
        }

        const snapshot = await this.request<DetailedSystemSnapshot>('getSnapshot')
        this.latestSnapshot = snapshot
        return snapshot
    }

    invalidateStaticSnapshot(): void {
        void this.request('refreshStatic').catch((err) => {
            log.warn('[SystemMetrics] Failed to refresh static snapshot:', err)
        })
    }

    getLiveMetrics(): LiveMetrics {
        return this.latestMetrics
    }

    subscribe(webContentsId: number, intervalMs?: number) {
        this.cancelIdleStop()
        this.subscribers.add(webContentsId)

        const nextInterval = normalizeInterval(intervalMs)
        if (nextInterval !== this.intervalMs) {
            this.intervalMs = nextInterval
            void this.request('setInterval', { intervalMs: this.intervalMs }).catch((err) => {
                log.warn('[SystemMetrics] Failed to set collector interval:', err)
            })
        } else {
            this.ensureCollector()
        }

        return {
            success: true,
            intervalMs: this.intervalMs,
            subscribers: this.subscribers.size
        }
    }

    unsubscribe(webContentsId: number) {
        this.subscribers.delete(webContentsId)
        if (this.subscribers.size === 0) {
            this.scheduleIdleStop()
        }

        return {
            success: true,
            subscribers: this.subscribers.size
        }
    }

    dispose(): void {
        this.cancelIdleStop()
        this.subscribers.clear()
        this.rejectPending('System metrics bridge disposed')
        void this.stopCollector()
    }
}

export const systemMetricsBridge = new SystemMetricsBridge()

export function disposeSystemMetricsBridge(): void {
    systemMetricsBridge.dispose()
}
