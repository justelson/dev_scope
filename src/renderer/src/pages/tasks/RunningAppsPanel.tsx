import type { Dispatch, SetStateAction } from 'react'
import { Activity, ChevronLeft, ChevronRight, Cpu, Gauge, HardDrive } from 'lucide-react'
import { cn } from '@/lib/utils'
import { APPS_PAGE_SIZE } from './tasks-types'
import { formatDeviceMemoryLabel, formatMemoryLabel } from './tasks-formatters'
import type { DeviceStats, MemoryUnit, RunningAppsSort, RunningAppWithUsage } from './tasks-types'

type RunningAppsPanelProps = {
    runningAppsCount: number
    runningAppTotals: {
        appCount: number
        backgroundCount: number
        totalProcesses: number
    }
    deviceStats: DeviceStats | null
    memoryUnit: MemoryUnit
    deviceMemoryPercent: number
    appScope: 'all' | 'app' | 'background'
    setAppScope: (scope: 'all' | 'app' | 'background') => void
    appsFilter: 'all' | 'highCpu' | 'highMemory' | 'multiInstance' | 'activeOnly'
    setAppsFilter: (filter: 'all' | 'highCpu' | 'highMemory' | 'multiInstance' | 'activeOnly') => void
    setMemoryUnit: (unit: MemoryUnit) => void
    sortBy: RunningAppsSort
    setSortBy: (sortBy: RunningAppsSort) => void
    sortDirection: 'asc' | 'desc'
    setSortDirection: Dispatch<SetStateAction<'asc' | 'desc'>>
    initialLoading: boolean
    sortedRunningApps: RunningAppWithUsage[]
    pagedAppsSection: RunningAppWithUsage[]
    pagedBackgroundSection: RunningAppWithUsage[]
    normalizedAppsPage: number
    totalAppsPages: number
    setAppsPage: Dispatch<SetStateAction<number>>
}

function toggleSort(
    currentSortBy: RunningAppsSort,
    nextSortBy: RunningAppsSort,
    setSortBy: (sortBy: RunningAppsSort) => void,
    setSortDirection: Dispatch<SetStateAction<'asc' | 'desc'>>,
    initialDirection: 'asc' | 'desc'
) {
    if (currentSortBy === nextSortBy) {
        setSortDirection((prev) => prev === 'asc' ? 'desc' : 'asc')
        return
    }

    setSortBy(nextSortBy)
    setSortDirection(initialDirection)
}

export function RunningAppsPanel({
    runningAppsCount,
    runningAppTotals,
    deviceStats,
    memoryUnit,
    deviceMemoryPercent,
    appScope,
    setAppScope,
    appsFilter,
    setAppsFilter,
    setMemoryUnit,
    sortBy,
    setSortBy,
    setSortDirection,
    initialLoading,
    sortedRunningApps,
    pagedAppsSection,
    pagedBackgroundSection,
    normalizedAppsPage,
    totalAppsPages,
    setAppsPage
}: RunningAppsPanelProps) {
    return (
        <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                <div className="rounded-xl border border-sparkle-border bg-sparkle-card p-4">
                    <div className="flex items-center gap-2 text-sparkle-text-secondary text-xs uppercase tracking-wider">
                        <Activity size={14} />
                        App Groups
                    </div>
                    <div className="mt-2 text-2xl font-semibold text-sparkle-text">{runningAppsCount}</div>
                    <div className="mt-1 text-[11px] text-sparkle-text-secondary">
                        {runningAppTotals.appCount} apps - {runningAppTotals.backgroundCount} background
                    </div>
                </div>
                <div className="rounded-xl border border-sparkle-border bg-sparkle-card p-4">
                    <div className="flex items-center gap-2 text-sparkle-text-secondary text-xs uppercase tracking-wider">
                        <Gauge size={14} />
                        Total Processes
                    </div>
                    <div className="mt-2 text-2xl font-semibold text-sparkle-text">{runningAppTotals.totalProcesses}</div>
                </div>
                <div className="rounded-xl border border-sparkle-border bg-sparkle-card p-4">
                    <div className="flex items-center gap-2 text-sparkle-text-secondary text-xs uppercase tracking-wider">
                        <Cpu size={14} />
                        Device CPU
                    </div>
                    <div className="mt-2 text-2xl font-semibold text-amber-300">
                        {deviceStats && deviceStats.cpuUsagePercent !== null ? `${deviceStats.cpuUsagePercent.toFixed(1)}%` : '--'}
                    </div>
                    <div className="mt-1 text-[11px] text-sparkle-text-secondary truncate">
                        {deviceStats ? `${deviceStats.cpuCores} cores / ${deviceStats.cpuThreads} threads` : 'Waiting for CPU stats'}
                    </div>
                    <div className="mt-1 text-[11px] text-sparkle-text-secondary truncate">
                        {deviceStats ? deviceStats.cpuModel : ''}
                    </div>
                </div>
                <div className="rounded-xl border border-sparkle-border bg-sparkle-card p-4">
                    <div className="flex items-center gap-2 text-sparkle-text-secondary text-xs uppercase tracking-wider">
                        <HardDrive size={14} />
                        Device RAM ({memoryUnit.toUpperCase()})
                    </div>
                    <div className="mt-2 text-2xl font-semibold text-emerald-300">
                        {deviceStats ? `${formatDeviceMemoryLabel(deviceStats.memoryUsedGb, memoryUnit)} / ${formatDeviceMemoryLabel(deviceStats.memoryTotalGb, memoryUnit)}` : '--'}
                    </div>
                    <div className="mt-2 h-2.5 w-full rounded-full bg-sparkle-bg overflow-hidden">
                        <div
                            className="h-full rounded-full bg-gradient-to-r from-emerald-500/90 via-teal-400/90 to-sky-500/90"
                            style={{ width: `${deviceMemoryPercent}%` }}
                        />
                    </div>
                </div>
            </div>

            <div className="rounded-xl border border-sparkle-border bg-sparkle-card overflow-hidden">
                <div className="px-4 py-3 border-b border-sparkle-border bg-sparkle-bg/70">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                            <h2 className="text-sm font-semibold text-sparkle-text">Running Apps Resource Table</h2>
                            <p className="text-xs text-sparkle-text-secondary mt-0.5">
                                Live CPU and memory usage with per-app resource bars.
                            </p>
                        </div>
                        <div className="flex items-center gap-2">
                            <label className="text-[11px] text-sparkle-text-secondary uppercase tracking-wider">Scope</label>
                            <select
                                value={appScope}
                                onChange={(event) => setAppScope(event.target.value as typeof appScope)}
                                className="rounded-md border border-sparkle-border bg-sparkle-card px-2 py-1 text-xs text-sparkle-text focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)]/60"
                            >
                                <option value="all">Apps First</option>
                                <option value="app">Apps Only</option>
                                <option value="background">Background Only</option>
                            </select>
                            <label className="text-[11px] text-sparkle-text-secondary uppercase tracking-wider">Filter</label>
                            <select
                                value={appsFilter}
                                onChange={(event) => setAppsFilter(event.target.value as typeof appsFilter)}
                                className="rounded-md border border-sparkle-border bg-sparkle-card px-2 py-1 text-xs text-sparkle-text focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)]/60"
                            >
                                <option value="all">All</option>
                                <option value="highCpu">High CPU</option>
                                <option value="highMemory">High Memory</option>
                                <option value="multiInstance">Multi Instance</option>
                                <option value="activeOnly">Active Only</option>
                            </select>
                            <label className="text-[11px] text-sparkle-text-secondary uppercase tracking-wider">RAM Unit</label>
                            <select
                                value={memoryUnit}
                                onChange={(event) => setMemoryUnit(event.target.value as MemoryUnit)}
                                className="rounded-md border border-sparkle-border bg-sparkle-card px-2 py-1 text-xs text-sparkle-text focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)]/60"
                            >
                                <option value="mb">MB</option>
                                <option value="gb">GB</option>
                            </select>
                        </div>
                    </div>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full min-w-[980px] table-fixed text-sm">
                        <colgroup>
                            <col className="w-[28%]" />
                            <col className="w-[90px]" />
                            <col className="w-[110px]" />
                            <col className="w-[22%]" />
                            <col className="w-[20%]" />
                            <col className="w-[20%]" />
                        </colgroup>
                        <thead className="text-xs text-sparkle-text-secondary uppercase tracking-wider bg-sparkle-bg/60">
                            <tr>
                                <th className="text-left font-medium px-4 py-3">
                                    <button
                                        type="button"
                                        onClick={() => toggleSort(sortBy, 'name', setSortBy, setSortDirection, 'asc')}
                                        className="inline-flex items-center gap-1 hover:text-sparkle-text transition-colors"
                                    >
                                        Application
                                    </button>
                                </th>
                                <th className="text-right font-medium px-4 py-3">
                                    <button
                                        type="button"
                                        onClick={() => toggleSort(sortBy, 'processCount', setSortBy, setSortDirection, 'desc')}
                                        className="inline-flex items-center gap-1 hover:text-sparkle-text transition-colors"
                                    >
                                        Instances
                                    </button>
                                </th>
                                <th className="text-left font-medium px-4 py-3">Type</th>
                                <th className="text-left font-medium px-4 py-3">
                                    <button
                                        type="button"
                                        onClick={() => toggleSort(sortBy, 'avgUsage', setSortBy, setSortDirection, 'desc')}
                                        className="inline-flex items-center gap-1 hover:text-sparkle-text transition-colors"
                                    >
                                        Avg Usage
                                    </button>
                                </th>
                                <th className="text-left font-medium px-4 py-3">
                                    <button
                                        type="button"
                                        onClick={() => toggleSort(sortBy, 'cpu', setSortBy, setSortDirection, 'desc')}
                                        className="inline-flex items-center gap-1 hover:text-sparkle-text transition-colors"
                                    >
                                        CPU
                                    </button>
                                </th>
                                <th className="text-left font-medium px-4 py-3">
                                    <button
                                        type="button"
                                        onClick={() => toggleSort(sortBy, 'memoryMb', setSortBy, setSortDirection, 'desc')}
                                        className="inline-flex items-center gap-1 hover:text-sparkle-text transition-colors"
                                    >
                                        Memory ({memoryUnit.toUpperCase()})
                                    </button>
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {initialLoading && sortedRunningApps.length === 0 ? (
                                <tr>
                                    <td className="px-4 py-4 text-sparkle-text-secondary" colSpan={6}>Loading running apps...</td>
                                </tr>
                            ) : sortedRunningApps.length === 0 ? (
                                <tr>
                                    <td className="px-4 py-4 text-sparkle-text-secondary" colSpan={6}>No running apps found.</td>
                                </tr>
                            ) : (
                                <>
                                    {appScope === 'all' && pagedAppsSection.length > 0 && (
                                        <tr className="border-t border-sparkle-border bg-cyan-500/6">
                                            <td className="px-4 py-2 text-[11px] uppercase tracking-wider text-cyan-300 font-medium" colSpan={6}>
                                                Applications
                                            </td>
                                        </tr>
                                    )}
                                    {pagedAppsSection.map((app) => {
                                        const cpuRatio = app.cpuUsageScore
                                        const memoryRatio = app.memoryUsageScore
                                        return (
                                            <tr key={`${app.category}:${app.name}`} className="border-t border-sparkle-border hover:bg-sparkle-bg/60 transition-colors">
                                                <td className="px-4 py-3 text-sparkle-text font-medium"><span className="block truncate">{app.name}</span></td>
                                                <td className="px-4 py-3 text-right text-sparkle-text-secondary font-mono tabular-nums">{app.processCount}</td>
                                                <td className="px-4 py-3">
                                                    <span
                                                        className={cn(
                                                            'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wide border',
                                                            app.category === 'app'
                                                                ? 'border-cyan-400/35 bg-cyan-500/10 text-cyan-300'
                                                                : 'border-white/20 bg-white/5 text-sparkle-text-secondary'
                                                        )}
                                                    >
                                                        {app.category === 'app' ? 'App' : 'Background'}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <div className="flex min-w-0 items-center gap-3">
                                                        <span className="w-16 text-right text-cyan-300 text-xs font-mono tabular-nums">{app.avgUsage.toFixed(1)}%</span>
                                                        <div className="h-2.5 min-w-0 flex-1 rounded-full bg-sparkle-bg overflow-hidden">
                                                            <div className="h-full rounded-full bg-gradient-to-r from-cyan-500/90 via-sky-400/90 to-blue-500/90" style={{ width: `${app.avgUsage}%` }} />
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <div className="flex min-w-0 items-center gap-3">
                                                        <span className="w-16 text-right text-amber-300 text-xs font-mono tabular-nums">{app.cpu.toFixed(1)}%</span>
                                                        <div className="h-2.5 min-w-0 flex-1 rounded-full bg-sparkle-bg overflow-hidden">
                                                            <div className="h-full rounded-full bg-gradient-to-r from-amber-500/90 via-orange-400/90 to-red-500/90" style={{ width: `${cpuRatio}%` }} />
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <div className="flex min-w-0 items-center gap-3">
                                                        <span className="w-24 text-right text-emerald-300 text-xs font-mono tabular-nums">{formatMemoryLabel(app.memoryMb, memoryUnit)}</span>
                                                        <div className="h-2.5 min-w-0 flex-1 rounded-full bg-sparkle-bg overflow-hidden">
                                                            <div className="h-full rounded-full bg-gradient-to-r from-emerald-500/90 via-teal-400/90 to-sky-500/90" style={{ width: `${memoryRatio}%` }} />
                                                        </div>
                                                    </div>
                                                </td>
                                            </tr>
                                        )
                                    })}
                                    {appScope === 'all' && pagedBackgroundSection.length > 0 && (
                                        <tr className="border-t border-sparkle-border bg-white/[0.03]">
                                            <td className="px-4 py-2 text-[11px] uppercase tracking-wider text-sparkle-text-secondary font-medium" colSpan={6}>
                                                Background Processes
                                            </td>
                                        </tr>
                                    )}
                                    {pagedBackgroundSection.map((app) => {
                                        const cpuRatio = app.cpuUsageScore
                                        const memoryRatio = app.memoryUsageScore
                                        return (
                                            <tr key={`${app.category}:${app.name}`} className="border-t border-sparkle-border hover:bg-sparkle-bg/60 transition-colors">
                                                <td className="px-4 py-3 text-sparkle-text font-medium"><span className="block truncate">{app.name}</span></td>
                                                <td className="px-4 py-3 text-right text-sparkle-text-secondary font-mono tabular-nums">{app.processCount}</td>
                                                <td className="px-4 py-3">
                                                    <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wide border border-white/20 bg-white/5 text-sparkle-text-secondary">
                                                        Background
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <div className="flex min-w-0 items-center gap-3">
                                                        <span className="w-16 text-right text-cyan-300 text-xs font-mono tabular-nums">{app.avgUsage.toFixed(1)}%</span>
                                                        <div className="h-2.5 min-w-0 flex-1 rounded-full bg-sparkle-bg overflow-hidden">
                                                            <div className="h-full rounded-full bg-gradient-to-r from-cyan-500/90 via-sky-400/90 to-blue-500/90" style={{ width: `${app.avgUsage}%` }} />
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <div className="flex min-w-0 items-center gap-3">
                                                        <span className="w-16 text-right text-amber-300 text-xs font-mono tabular-nums">{app.cpu.toFixed(1)}%</span>
                                                        <div className="h-2.5 min-w-0 flex-1 rounded-full bg-sparkle-bg overflow-hidden">
                                                            <div className="h-full rounded-full bg-gradient-to-r from-amber-500/90 via-orange-400/90 to-red-500/90" style={{ width: `${cpuRatio}%` }} />
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <div className="flex min-w-0 items-center gap-3">
                                                        <span className="w-24 text-right text-emerald-300 text-xs font-mono tabular-nums">{formatMemoryLabel(app.memoryMb, memoryUnit)}</span>
                                                        <div className="h-2.5 min-w-0 flex-1 rounded-full bg-sparkle-bg overflow-hidden">
                                                            <div className="h-full rounded-full bg-gradient-to-r from-emerald-500/90 via-teal-400/90 to-sky-500/90" style={{ width: `${memoryRatio}%` }} />
                                                        </div>
                                                    </div>
                                                </td>
                                            </tr>
                                        )
                                    })}
                                </>
                            )}
                        </tbody>
                    </table>
                </div>
                {sortedRunningApps.length > 0 && (
                    <div className="flex items-center justify-between px-4 py-3 border-t border-sparkle-border bg-sparkle-bg/50">
                        <p className="text-xs text-sparkle-text-secondary">
                            Showing {(normalizedAppsPage - 1) * APPS_PAGE_SIZE + 1}-{Math.min(normalizedAppsPage * APPS_PAGE_SIZE, sortedRunningApps.length)} of {sortedRunningApps.length}
                        </p>
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={() => setAppsPage((prev) => Math.max(1, prev - 1))}
                                disabled={normalizedAppsPage <= 1}
                                className="h-8 w-8 inline-flex items-center justify-center rounded-md border border-sparkle-border text-sparkle-text-secondary hover:text-sparkle-text hover:bg-sparkle-card disabled:opacity-40 disabled:hover:bg-transparent"
                            >
                                <ChevronLeft size={14} />
                            </button>
                            <span className="text-xs text-sparkle-text-secondary">Page {normalizedAppsPage}/{totalAppsPages}</span>
                            <button
                                type="button"
                                onClick={() => setAppsPage((prev) => Math.min(totalAppsPages, prev + 1))}
                                disabled={normalizedAppsPage >= totalAppsPages}
                                className="h-8 w-8 inline-flex items-center justify-center rounded-md border border-sparkle-border text-sparkle-text-secondary hover:text-sparkle-text hover:bg-sparkle-card disabled:opacity-40 disabled:hover:bg-transparent"
                            >
                                <ChevronRight size={14} />
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
