import {
    DEFAULT_INTERVAL_MS,
    NETWORK_SAMPLE_INTERVAL_MS,
    PROCESS_SAMPLE_INTERVAL_MS,
    STATIC_REFRESH_INTERVAL_MS
} from './collector-constants'
import { buildSnapshot, collectFastMetrics, collectNetworkStats, collectProcessMetrics, collectStaticSnapshot } from './collector-samplers'
import { createInitialCollectorState } from './collector-state'
import type { CollectorRequest } from './collector-types'
import { normalizeInterval } from './collector-utils'

const parentPort = (process as any).parentPort
const hasProcessSend = typeof process.send === 'function'

if (!parentPort && !hasProcessSend) {
    process.exit(1)
}

const state = createInitialCollectorState()
let fastIntervalMs = DEFAULT_INTERVAL_MS
let fastTimer: NodeJS.Timeout | null = null
let processTimer: NodeJS.Timeout | null = null
let networkTimer: NodeJS.Timeout | null = null
let staticRefreshTimer: NodeJS.Timeout | null = null

function emit(payload: Record<string, unknown>): void {
    if (parentPort) {
        parentPort.postMessage(payload)
        return
    }
    if (hasProcessSend) {
        process.send?.(payload)
    }
}

function postError(message: string): void {
    emit({ type: 'error', message })
}

function postMetrics(): void {
    emit({ type: 'metrics', data: state.liveMetrics })
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
        await collectFastMetrics(state)
        postMetrics()
    } catch (error) {
        state.liveMetrics = {
            ...state.liveMetrics,
            hasError: true
        }
        postError(error instanceof Error ? error.message : 'fast metrics failed')
    }
}

async function runProcessTick(): Promise<void> {
    try {
        await collectProcessMetrics(state)
    } catch (error) {
        postError(error instanceof Error ? error.message : 'process metrics failed')
    }
}

async function runNetworkTick(): Promise<void> {
    try {
        await collectNetworkStats(state)
    } catch (error) {
        postError(error instanceof Error ? error.message : 'network metrics failed')
    }
}

async function runStaticRefresh(): Promise<void> {
    try {
        await collectStaticSnapshot(state)
    } catch (error) {
        postError(error instanceof Error ? error.message : 'static refresh failed')
    }
}

async function initialize(): Promise<void> {
    await Promise.all([runStaticRefresh(), runProcessTick(), runNetworkTick(), runFastTick()])

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
    const respond = (success: boolean, data?: unknown, error?: string) => {
        emit({
            type: 'response',
            id: message.id,
            success,
            data,
            error
        })
    }

    try {
        switch (message.action) {
            case 'getSnapshot':
                await initPromise
                respond(true, buildSnapshot(state))
                return
            case 'getLiveMetrics':
                await initPromise
                respond(true, state.liveMetrics)
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
    process.on('message', (message: unknown) => {
        if (!message || typeof message !== 'object') return
        if ((message as { type?: string }).type !== 'request') return
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
