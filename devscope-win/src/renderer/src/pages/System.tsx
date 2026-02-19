/**
 * DevScope - System Information Page
 * Detailed hardware and OS information with analytics
 */

import { useState, useEffect } from 'react'
import {
    Cpu, Monitor, MemoryStick, HardDrive, Wifi, Battery,
    Activity, Thermometer, Server, RefreshCw
} from 'lucide-react'
import {
    PieChart, Pie, Cell, ResponsiveContainer
} from 'recharts'
import { cn } from '@/lib/utils'
import { getCache, updateCache, isCacheStale } from '@/lib/refreshCache'
import { LoadingSpinner, LoadingOverlay, SystemStatsSkeleton } from '@/components/ui/LoadingState'

interface DetailedStats {
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
        layout: {
            size: number
            type: string
            clockSpeed: number
            manufacturer: string
            partNum: string
            formFactor: string
        }[]
    }
    disks: {
        fs: string
        type: string
        size: number
        used: number
        available: number
        use: number
        mount: string
    }[]
    diskIO: {
        rIO: number
        wIO: number
        tIO: number
        rIO_sec: number
        wIO_sec: number
    } | null
    network: {
        interfaces: {
            iface: string
            ip4: string
            ip6: string
            mac: string
            type: string
            speed: number
            operstate: string
        }[]
        stats: {
            iface: string
            rx_bytes: number
            tx_bytes: number
            rx_sec: number
            tx_sec: number
        }[]
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

const formatBytes = (bytes: number, decimals = 2) => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(decimals)) + ' ' + sizes[i]
}

const formatSpeed = (bytes: number) => {
    if (bytes === 0) return '0 B/s'
    const k = 1024
    const sizes = ['B/s', 'KB/s', 'MB/s', 'GB/s']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

export default function System() {
    // Load cached data immediately
    const cachedStats = getCache<DetailedStats>('detailedSystem')
    const [stats, setStats] = useState<DetailedStats | null>(cachedStats)
    const [loading, setLoading] = useState(!cachedStats) // Only show loading if no cache
    const [isRefreshing, setIsRefreshing] = useState(false)

    const fetchData = async (showRefreshIndicator = true) => {
        // Show subtle refresh indicator, not full loading
        if (showRefreshIndicator && stats) {
            setIsRefreshing(true)
        }

        try {
            const data = await (window as any).devscope.getDetailedSystemStats()
            updateCache({ detailedSystem: data })
            setStats(data)
        } catch (err) {
            console.error('Failed to fetch system stats:', err)
        } finally {
            setLoading(false)
            setIsRefreshing(false)
        }
    }

    useEffect(() => {
        // If no cache or cache is stale, fetch new data
        if (!cachedStats || isCacheStale('detailedSystem')) {
            fetchData(!cachedStats) // Only show full loading if no cached data
        }

        // Refresh every 30 seconds
        const interval = setInterval(() => fetchData(true), 30000)
        return () => clearInterval(interval)
    }, [])

    if (loading || !stats) {
        return (
            <div className="max-w-[1600px] mx-auto animate-fadeIn pb-10 relative">
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-sparkle-text mb-2">System Information</h1>
                    <p className="text-sparkle-text-secondary text-lg">Gathering hardware information...</p>
                </div>

                <SystemStatsSkeleton />

                <LoadingOverlay message="Scanning hardware..." />
            </div>
        )
    }

    const memoryUsagePercent = Math.round((stats.memory.used / stats.memory.total) * 100)
    const memoryPieData = [
        { name: 'Used', value: stats.memory.used, color: '#3b82f6' },
        { name: 'Cached', value: stats.memory.cached, color: '#8b5cf6' },
        { name: 'Free', value: stats.memory.free, color: '#1e293b' }
    ]

    const diskData = stats.disks.map(d => ({
        name: d.mount.length > 10 ? d.mount.substring(0, 10) + '...' : d.mount,
        used: d.use,
        free: 100 - d.use
    }))

    return (
        <div className="max-w-[1600px] mx-auto animate-fadeIn pb-10">
            {/* Header */}
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-sparkle-text mb-2">System Information</h1>
                <div className="flex items-center gap-2">
                    <p className="text-sparkle-text-secondary text-lg">
                        Real-time hardware monitoring and system specifications.
                    </p>
                    {isRefreshing && (
                        <RefreshCw size={14} className="text-sparkle-accent animate-spin" />
                    )}
                </div>
            </div>

            {/* Top Stats Row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                <div className="bg-sparkle-card/50 rounded-2xl p-5 border border-sparkle-border">
                    <div className="flex items-center gap-3 mb-3">
                        <div className="p-2 rounded-lg bg-blue-500/10">
                            <Cpu className="text-blue-400" size={18} />
                        </div>
                        <span className="text-xs text-sparkle-text-muted uppercase tracking-wider font-bold">CPU Load</span>
                    </div>
                    <p className="text-3xl font-bold text-sparkle-text">{Math.round(stats.cpu.load)}%</p>
                    <p className="text-xs text-sparkle-text-muted mt-1">{stats.cpu.currentSpeed.toFixed(2)} GHz</p>
                </div>

                <div className="bg-sparkle-card/50 rounded-2xl p-5 border border-sparkle-border">
                    <div className="flex items-center gap-3 mb-3">
                        <div className="p-2 rounded-lg bg-purple-500/10">
                            <MemoryStick className="text-purple-400" size={18} />
                        </div>
                        <span className="text-xs text-sparkle-text-muted uppercase tracking-wider font-bold">Memory</span>
                    </div>
                    <p className="text-3xl font-bold text-sparkle-text">{memoryUsagePercent}%</p>
                    <p className="text-xs text-sparkle-text-muted mt-1">{formatBytes(stats.memory.used)} / {formatBytes(stats.memory.total)}</p>
                </div>

                <div className="bg-sparkle-card/50 rounded-2xl p-5 border border-sparkle-border">
                    <div className="flex items-center gap-3 mb-3">
                        <div className="p-2 rounded-lg bg-green-500/10">
                            <Activity className="text-green-400" size={18} />
                        </div>
                        <span className="text-xs text-sparkle-text-muted uppercase tracking-wider font-bold">Processes</span>
                    </div>
                    <p className="text-3xl font-bold text-sparkle-text">{stats.processes.all}</p>
                    <p className="text-xs text-sparkle-text-muted mt-1">{stats.processes.running} running</p>
                </div>

                {stats.cpu.temperature && (
                    <div className="bg-sparkle-card/50 rounded-2xl p-5 border border-sparkle-border">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="p-2 rounded-lg bg-orange-500/10">
                                <Thermometer className="text-orange-400" size={18} />
                            </div>
                            <span className="text-xs text-sparkle-text-muted uppercase tracking-wider font-bold">CPU Temp</span>
                        </div>
                        <p className="text-3xl font-bold text-sparkle-text">{Math.round(stats.cpu.temperature)}°C</p>
                    </div>
                )}

                {stats.battery?.hasBattery && (
                    <div className="bg-sparkle-card/50 rounded-2xl p-5 border border-sparkle-border">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="p-2 rounded-lg bg-yellow-500/10">
                                <Battery className="text-yellow-400" size={18} />
                            </div>
                            <span className="text-xs text-sparkle-text-muted uppercase tracking-wider font-bold">Battery</span>
                        </div>
                        <p className="text-3xl font-bold text-sparkle-text">{stats.battery.percent}%</p>
                        <p className="text-xs text-sparkle-text-muted mt-1">{stats.battery.isCharging ? 'Charging' : 'On Battery'}</p>
                    </div>
                )}
            </div>

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                {/* CPU Details */}
                <div className="bg-sparkle-card/50 rounded-2xl p-6 border border-sparkle-border">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="p-3 rounded-xl bg-blue-500/10">
                            <Cpu className="text-blue-400" size={22} />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-sparkle-text">Processor</h2>
                            <p className="text-sm text-sparkle-text-muted">{stats.cpu.model}</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-sparkle-card rounded-xl p-4">
                            <p className="text-xs text-sparkle-text-muted uppercase tracking-wider mb-1">Cores</p>
                            <p className="text-xl font-bold text-sparkle-text">{stats.cpu.physicalCores} Physical</p>
                            <p className="text-sm text-sparkle-text-secondary">{stats.cpu.cores} Logical</p>
                        </div>
                        <div className="bg-sparkle-card rounded-xl p-4">
                            <p className="text-xs text-sparkle-text-muted uppercase tracking-wider mb-1">Speed</p>
                            <p className="text-xl font-bold text-sparkle-text">{stats.cpu.speed} GHz</p>
                            <p className="text-sm text-sparkle-text-secondary">Max: {stats.cpu.speedMax} GHz</p>
                        </div>
                        <div className="bg-sparkle-card rounded-xl p-4">
                            <p className="text-xs text-sparkle-text-muted uppercase tracking-wider mb-1">Current Speed</p>
                            <p className="text-xl font-bold text-sparkle-text">{stats.cpu.currentSpeed.toFixed(2)} GHz</p>
                        </div>
                        <div className="bg-sparkle-card rounded-xl p-4">
                            <p className="text-xs text-sparkle-text-muted uppercase tracking-wider mb-1">Manufacturer</p>
                            <p className="text-xl font-bold text-sparkle-text">{stats.cpu.manufacturer}</p>
                        </div>
                    </div>

                    {/* CPU Load Bar */}
                    <div className="mt-6">
                        <div className="flex justify-between text-sm mb-2">
                            <span className="text-sparkle-text-muted">CPU Usage</span>
                            <span className="text-blue-400 font-mono">{Math.round(stats.cpu.load)}%</span>
                        </div>
                        <div className="h-3 bg-sparkle-card rounded-full overflow-hidden">
                            <div
                                className="h-full bg-gradient-to-r from-blue-500 to-blue-400 rounded-full transition-all duration-500"
                                style={{ width: `${stats.cpu.load}%` }}
                            />
                        </div>
                    </div>
                </div>

                {/* Memory Details */}
                <div className="bg-sparkle-card/50 rounded-2xl p-6 border border-sparkle-border">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="p-3 rounded-xl bg-purple-500/10">
                            <MemoryStick className="text-purple-400" size={22} />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-sparkle-text">Memory</h2>
                            <p className="text-sm text-sparkle-text-muted">{formatBytes(stats.memory.total)} Total</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-6">
                        {/* Pie Chart */}
                        <div className="w-36 h-36 relative">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={memoryPieData}
                                        innerRadius={40}
                                        outerRadius={55}
                                        paddingAngle={2}
                                        dataKey="value"
                                        stroke="none"
                                    >
                                        {memoryPieData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.color} />
                                        ))}
                                    </Pie>
                                </PieChart>
                            </ResponsiveContainer>
                            <div className="absolute inset-0 flex flex-col items-center justify-center">
                                <span className="text-2xl font-bold text-sparkle-text">{memoryUsagePercent}%</span>
                            </div>
                        </div>

                        {/* Legend */}
                        <div className="flex-1 space-y-3">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <div className="w-3 h-3 rounded-full bg-blue-500" />
                                    <span className="text-sm text-sparkle-text-secondary">Used</span>
                                </div>
                                <span className="text-sm font-mono text-sparkle-text">{formatBytes(stats.memory.used)}</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <div className="w-3 h-3 rounded-full bg-purple-500" />
                                    <span className="text-sm text-sparkle-text-secondary">Cached</span>
                                </div>
                                <span className="text-sm font-mono text-sparkle-text">{formatBytes(stats.memory.cached)}</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <div className="w-3 h-3 rounded-full bg-slate-800" />
                                    <span className="text-sm text-sparkle-text-secondary">Free</span>
                                </div>
                                <span className="text-sm font-mono text-sparkle-text">{formatBytes(stats.memory.free)}</span>
                            </div>
                        </div>
                    </div>

                    {/* Memory Modules */}
                    {stats.memory.layout.length > 0 && stats.memory.layout[0].size > 0 && (
                        <div className="mt-6 pt-4 border-t border-sparkle-border">
                            <p className="text-xs text-sparkle-text-muted uppercase tracking-wider mb-3">Memory Modules</p>
                            <div className="space-y-2">
                                {stats.memory.layout.filter(m => m.size > 0).map((module, i) => (
                                    <div key={i} className="flex items-center justify-between text-sm bg-sparkle-card rounded-lg px-3 py-2">
                                        <span className="text-sparkle-text-secondary">Slot {i + 1}</span>
                                        <span className="text-sparkle-text font-mono">
                                            {formatBytes(module.size)} {module.type} @ {module.clockSpeed} MHz
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Storage Section */}
            <div className="bg-sparkle-card/50 rounded-2xl p-6 border border-sparkle-border mb-8">
                <div className="flex items-center gap-3 mb-6">
                    <div className="p-3 rounded-xl bg-orange-500/10">
                        <HardDrive className="text-orange-400" size={22} />
                    </div>
                    <div>
                        <h2 className="text-lg font-bold text-sparkle-text">Storage</h2>
                        <p className="text-sm text-sparkle-text-muted">{stats.disks.length} drive(s) detected</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {stats.disks.map((disk, i) => (
                        <div key={i} className="bg-sparkle-card rounded-xl p-4">
                            <div className="flex items-center justify-between mb-3">
                                <span className="text-sparkle-text font-medium truncate">{disk.mount}</span>
                                <span className="text-xs text-sparkle-text-muted bg-sparkle-card px-2 py-1 rounded">{disk.type}</span>
                            </div>
                            <div className="mb-2">
                                <div className="flex justify-between text-xs mb-1">
                                    <span className="text-sparkle-text-muted">{formatBytes(disk.used)} used</span>
                                    <span className="text-sparkle-text-muted">{formatBytes(disk.size)} total</span>
                                </div>
                                <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                                    <div
                                        className={cn(
                                            "h-full rounded-full transition-all",
                                            disk.use > 90 ? "bg-red-500" : disk.use > 70 ? "bg-yellow-500" : "bg-orange-500"
                                        )}
                                        style={{ width: `${disk.use}%` }}
                                    />
                                </div>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-orange-400 font-mono">{disk.use.toFixed(1)}%</span>
                                <span className="text-sparkle-text-muted">{formatBytes(disk.available)} free</span>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Disk I/O */}
                {stats.diskIO && (
                    <div className="mt-6 pt-4 border-t border-sparkle-border">
                        <p className="text-xs text-sparkle-text-muted uppercase tracking-wider mb-3">Disk I/O</p>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-sparkle-card rounded-lg p-3 flex items-center justify-between">
                                <span className="text-sparkle-text-secondary text-sm">Read Speed</span>
                                <span className="text-green-400 font-mono">{formatSpeed(stats.diskIO.rIO_sec || 0)}</span>
                            </div>
                            <div className="bg-sparkle-card rounded-lg p-3 flex items-center justify-between">
                                <span className="text-sparkle-text-secondary text-sm">Write Speed</span>
                                <span className="text-blue-400 font-mono">{formatSpeed(stats.diskIO.wIO_sec || 0)}</span>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Network & OS Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Network */}
                <div className="bg-sparkle-card/50 rounded-2xl p-6 border border-sparkle-border">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="p-3 rounded-xl bg-cyan-500/10">
                            <Wifi className="text-cyan-400" size={22} />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-sparkle-text">Network</h2>
                            <p className="text-sm text-sparkle-text-muted">{stats.network.interfaces.filter(i => i.operstate === 'up').length} active interface(s)</p>
                        </div>
                    </div>

                    <div className="space-y-3">
                        {stats.network.interfaces.filter(i => i.ip4 && i.operstate === 'up').slice(0, 4).map((iface, i) => {
                            const netStat = stats.network.stats.find(s => s.iface === iface.iface)
                            return (
                                <div key={i} className="bg-sparkle-card rounded-xl p-4">
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-sparkle-text font-medium">{iface.iface}</span>
                                        <span className={cn(
                                            "text-xs px-2 py-1 rounded",
                                            iface.operstate === 'up' ? "bg-green-500/10 text-green-400" : "bg-red-500/10 text-red-400"
                                        )}>
                                            {iface.operstate}
                                        </span>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2 text-sm">
                                        <div>
                                            <span className="text-sparkle-text-muted">IP: </span>
                                            <span className="text-sparkle-text font-mono">{iface.ip4}</span>
                                        </div>
                                        <div>
                                            <span className="text-sparkle-text-muted">Type: </span>
                                            <span className="text-sparkle-text">{iface.type}</span>
                                        </div>
                                    </div>
                                    {netStat && (
                                        <div className="flex gap-4 mt-2 pt-2 border-t border-sparkle-border text-xs">
                                            <span className="text-green-400">↓ {formatSpeed(netStat.rx_sec || 0)}</span>
                                            <span className="text-blue-400">↑ {formatSpeed(netStat.tx_sec || 0)}</span>
                                        </div>
                                    )}
                                </div>
                            )
                        })}
                    </div>
                </div>

                {/* Operating System */}
                <div className="bg-sparkle-card/50 rounded-2xl p-6 border border-sparkle-border">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="p-3 rounded-xl bg-red-500/10">
                            <Server className="text-red-400" size={22} />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-sparkle-text">Operating System</h2>
                            <p className="text-sm text-sparkle-text-muted">{stats.os.distro}</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div className="bg-sparkle-card rounded-lg p-3">
                            <p className="text-xs text-sparkle-text-muted mb-1">Version</p>
                            <p className="text-sparkle-text font-mono text-sm">{stats.os.release}</p>
                        </div>
                        <div className="bg-sparkle-card rounded-lg p-3">
                            <p className="text-xs text-sparkle-text-muted mb-1">Build</p>
                            <p className="text-sparkle-text font-mono text-sm">{stats.os.build || 'N/A'}</p>
                        </div>
                        <div className="bg-sparkle-card rounded-lg p-3">
                            <p className="text-xs text-sparkle-text-muted mb-1">Architecture</p>
                            <p className="text-sparkle-text font-mono text-sm">{stats.os.arch}</p>
                        </div>
                        <div className="bg-sparkle-card rounded-lg p-3">
                            <p className="text-xs text-sparkle-text-muted mb-1">Kernel</p>
                            <p className="text-sparkle-text font-mono text-sm truncate">{stats.os.kernel}</p>
                        </div>
                        <div className="bg-sparkle-card rounded-lg p-3">
                            <p className="text-xs text-sparkle-text-muted mb-1">Hostname</p>
                            <p className="text-sparkle-text font-mono text-sm">{stats.os.hostname}</p>
                        </div>
                        <div className="bg-sparkle-card rounded-lg p-3">
                            <p className="text-xs text-sparkle-text-muted mb-1">Boot Mode</p>
                            <p className="text-sparkle-text font-mono text-sm">{stats.os.uefi ? 'UEFI' : 'Legacy BIOS'}</p>
                        </div>
                    </div>

                    {/* Processes Summary */}
                    <div className="mt-6 pt-4 border-t border-sparkle-border">
                        <p className="text-xs text-sparkle-text-muted uppercase tracking-wider mb-3">Processes</p>
                        <div className="flex gap-4">
                            <div className="flex-1 bg-sparkle-card rounded-lg p-3 text-center">
                                <p className="text-2xl font-bold text-sparkle-text">{stats.processes.all}</p>
                                <p className="text-xs text-sparkle-text-muted">Total</p>
                            </div>
                            <div className="flex-1 bg-sparkle-card rounded-lg p-3 text-center">
                                <p className="text-2xl font-bold text-green-400">{stats.processes.running}</p>
                                <p className="text-xs text-sparkle-text-muted">Running</p>
                            </div>
                            <div className="flex-1 bg-sparkle-card rounded-lg p-3 text-center">
                                <p className="text-2xl font-bold text-yellow-400">{stats.processes.sleeping}</p>
                                <p className="text-xs text-sparkle-text-muted">Sleeping</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
