export type CollectorAction = 'getSnapshot' | 'getLiveMetrics' | 'setInterval' | 'refreshStatic' | 'stop'

export type CollectorRequest = {
    type: 'request'
    id: number
    action: CollectorAction
    data?: Record<string, unknown>
}

export type LiveMetrics = {
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

export type StaticSnapshot = {
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

export type ProcessStats = {
    all: number
    running: number
    blocked: number
    sleeping: number
}

export type NetworkStat = {
    iface: string
    rx_bytes: number
    tx_bytes: number
    rx_sec: number
    tx_sec: number
}

export type CollectorSnapshot = {
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
        used: number
        free: number
        available: number
        swapUsed: number
        swapFree: number
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
    }
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
        stats: NetworkStat[]
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
        voltage: number
        designedCapacity: number
        currentCapacity: number
        percent: number
        isCharging: boolean
        acConnected: boolean
        timeRemaining: number
    } | null
    processes: ProcessStats
    timestamp: number
}

export type CollectorState = {
    staticSnapshot: StaticSnapshot
    liveMetrics: LiveMetrics
    processStats: ProcessStats
    networkStats: NetworkStat[]
}
