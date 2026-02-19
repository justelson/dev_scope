/**
 * DevScope - AI Runtime Page
 * Shows AI/ML tools and local LLM runtimes with analytics
 */

import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
    Bot, Cpu, Brain, Check, X, Zap,
    Search, Filter, LayoutGrid, List
} from 'lucide-react'
import Dropdown from '@/components/ui/Dropdown'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import Badge from '@/components/ui/Badge'
import { cn } from '@/lib/utils'
import { getCache, updateCache, isCacheStale } from '@/lib/refreshCache'
import ToolIcon from '@/components/ui/ToolIcon'
import { LoadingSpinner, LoadingOverlay, AnalyticsCardSkeleton, ToolGridSkeleton } from '@/components/ui/LoadingState'

interface AIRuntimeInfo {
    tool: string
    displayName: string
    installed: boolean
    version?: string
    status: string
    running?: boolean
    port?: number
    models?: string[]
    endpoint?: string
    usedFor: string[]
    description?: string
}

interface Capability {
    id: string
    displayName: string
    category: string
    installed: boolean
    version?: string
    status: 'healthy' | 'warning' | 'error' | 'not_installed' | 'unknown'
    usedFor: string[]
    description?: string
    lastChecked?: number
    metadata?: Record<string, any>
}

interface AIRuntimeReport {
    llmRuntimes: AIRuntimeInfo[]
    gpuAcceleration: Capability[]
    aiFrameworks: Capability[]
}

type RefreshDetail = {
    aiRuntime?: AIRuntimeReport
}

type ViewMode = 'grid' | 'list'
type FilterCategory = 'all' | 'llm' | 'gpu' | 'frameworks'

const CATEGORY_CONFIG = [
    { key: 'llm', title: 'LLM Runtimes', color: '#a855f7', icon: Bot },
    { key: 'gpu', title: 'GPU Acceleration', color: '#22c55e', icon: Zap },
    { key: 'frameworks', title: 'AI Frameworks', color: '#3b82f6', icon: Brain }
]

export default function AIRuntime() {
    const cachedAIRuntime = getCache<AIRuntimeReport>('aiRuntime')
    const [data, setData] = useState<AIRuntimeReport | null>(cachedAIRuntime)
    const [loading, setLoading] = useState(!cachedAIRuntime)
    const [isRefreshing, setIsRefreshing] = useState(false)

    // UI State
    const [searchQuery, setSearchQuery] = useState('')
    const [filterCategory, setFilterCategory] = useState<FilterCategory>('all')
    const [viewMode, setViewMode] = useState<ViewMode>('grid')

    const fetchData = async (showRefreshIndicator = true) => {
        // Only show subtle refresh, not full loading if we have data
        if (showRefreshIndicator && data) {
            setIsRefreshing(true)
        } else if (!data) {
            setLoading(true)
        }

        try {
            const result = await window.devscope.getAIRuntimeStatus()
            updateCache({ aiRuntime: result })
            setData(result)
        } catch (err) {
            console.error('Failed to fetch AI runtime status:', err)
        } finally {
            setLoading(false)
            setIsRefreshing(false)
        }
    }

    useEffect(() => {
        // Fetch if no cache or stale
        if (!cachedAIRuntime || isCacheStale('aiRuntime')) {
            fetchData(!cachedAIRuntime)
        }

        const handleRefresh = (event: Event) => {
            const detail = (event as CustomEvent<RefreshDetail>).detail
            if (detail?.aiRuntime) {
                updateCache({ aiRuntime: detail.aiRuntime })
                setData(detail.aiRuntime)
                setLoading(false)
                setIsRefreshing(false)
                return
            }
            fetchData(true)
        }

        window.addEventListener('devscope:refresh', handleRefresh)
        return () => {
            window.removeEventListener('devscope:refresh', handleRefresh)
        }
    }, [])

    // Analytics
    const pieData = useMemo(() => {
        if (!data) return []
        return [
            { name: 'LLM Runtimes', value: data.llmRuntimes.length, color: '#a855f7' },
            { name: 'GPU Acceleration', value: data.gpuAcceleration.length, color: '#22c55e' },
            { name: 'AI Frameworks', value: data.aiFrameworks.length, color: '#3b82f6' }
        ].filter(d => d.value > 0)
    }, [data])

    const totalTools = useMemo(() => {
        if (!data) return 0
        return data.llmRuntimes.length + data.gpuAcceleration.length + data.aiFrameworks.length
    }, [data])

    const totalInstalled = useMemo(() => {
        if (!data) return 0
        return [
            ...data.llmRuntimes,
            ...data.gpuAcceleration,
            ...data.aiFrameworks
        ].filter(t => t.installed).length
    }, [data])

    const runningRuntimes = useMemo(() => {
        if (!data) return 0
        return data.llmRuntimes.filter(r => r.running).length
    }, [data])

    // Filtering
    const filteredData = useMemo(() => {
        if (!data) return { llmRuntimes: [], gpuAcceleration: [], aiFrameworks: [] }

        const filterItem = (item: any) => {
            return item.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                item.id.toLowerCase().includes(searchQuery.toLowerCase())
        }

        return {
            llmRuntimes: filterCategory === 'all' || filterCategory === 'llm'
                ? data.llmRuntimes.filter(filterItem) : [],
            gpuAcceleration: filterCategory === 'all' || filterCategory === 'gpu'
                ? data.gpuAcceleration.filter(filterItem) : [],
            aiFrameworks: filterCategory === 'all' || filterCategory === 'frameworks'
                ? data.aiFrameworks.filter(filterItem) : []
        }
    }, [data, searchQuery, filterCategory])

    if (loading) {
        return (
            <div className="max-w-[1600px] mx-auto animate-fadeIn pb-20 relative">
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-sparkle-text mb-2">AI Runtime</h1>
                    <p className="text-sparkle-text-secondary text-lg">Detecting AI tools and runtimes...</p>
                </div>

                {/* Skeleton Analytics */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-10">
                    <AnalyticsCardSkeleton />
                    <AnalyticsCardSkeleton />
                    <AnalyticsCardSkeleton />
                </div>

                {/* Skeleton Tools */}
                <ToolGridSkeleton count={6} />

                {/* Loading Overlay */}
                <LoadingOverlay message="Scanning AI runtimes..." />
            </div>
        )
    }

    return (
        <div className="max-w-[1600px] mx-auto animate-fadeIn pb-20">
            {/* Header */}
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-sparkle-text mb-2">AI Runtime</h1>
                <p className="text-sparkle-text-secondary text-lg">
                    Local LLM runtimes, GPU acceleration, and AI frameworks.
                </p>
            </div>

            {/* Analytics Section */}
            {data && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-10 relative">
                    <div className="absolute -top-10 -left-10 w-full h-full bg-purple-500/5 blur-3xl rounded-full pointer-events-none" />

                    {/* Pie Chart */}
                    <div className="bg-sparkle-card/80 backdrop-blur-sm rounded-3xl p-6 border border-white/5 relative overflow-hidden flex flex-col justify-between shadow-xl shadow-black/20 group hover:border-white/10 transition-colors">
                        <div className="flex items-center justify-between mb-4 relative z-10">
                            <h3 className="text-xs font-bold text-sparkle-text-secondary uppercase tracking-widest">AI Ecosystem</h3>
                            <Brain className="text-white/20" size={18} />
                        </div>

                        <div className="flex items-center gap-6 relative z-10">
                            <div className="h-48 w-48 flex-shrink-0 relative">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={pieData}
                                            innerRadius={55}
                                            outerRadius={80}
                                            paddingAngle={6}
                                            dataKey="value"
                                            stroke="none"
                                            cornerRadius={6}
                                        >
                                            {pieData.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={entry.color} />
                                            ))}
                                        </Pie>
                                        <Tooltip
                                            contentStyle={{ backgroundColor: '#0f0f0f', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)' }}
                                            itemStyle={{ color: '#fff', fontSize: '12px', fontWeight: 600 }}
                                        />
                                    </PieChart>
                                </ResponsiveContainer>
                                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                                    <span className="text-3xl font-bold text-white">{totalTools}</span>
                                    <span className="text-[10px] text-white/40 uppercase tracking-wide">Tools</span>
                                </div>
                            </div>

                            <div className="space-y-3 flex-1">
                                {pieData.map((entry) => (
                                    <div key={entry.name} className="flex items-center justify-between text-sm">
                                        <div className="flex items-center gap-3">
                                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
                                            <span className="text-sparkle-text-secondary font-medium truncate max-w-[100px]">{entry.name}</span>
                                        </div>
                                        <span className="font-mono text-white/60 bg-white/5 px-1.5 py-0.5 rounded text-xs">{entry.value}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Running Status */}
                    <div className="bg-sparkle-card/80 backdrop-blur-sm rounded-3xl p-6 border border-white/5 relative overflow-hidden flex flex-col justify-center items-center shadow-xl shadow-black/20 group hover:border-white/10 transition-colors">
                        <div className="relative w-48 h-48 flex items-center justify-center">
                            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 180 180">
                                <circle className="text-white/5" strokeWidth="10" stroke="currentColor" fill="transparent" r="70" cx="90" cy="90" />
                                <circle
                                    className={cn(
                                        "transition-all duration-1000 ease-out",
                                        runningRuntimes > 0 ? "text-green-500" : "text-purple-500"
                                    )}
                                    strokeWidth="10"
                                    strokeDasharray={440}
                                    strokeDashoffset={data.llmRuntimes.length > 0 ? 440 - (440 * runningRuntimes) / data.llmRuntimes.length : 440}
                                    strokeLinecap="round"
                                    stroke="currentColor"
                                    fill="transparent"
                                    r="70"
                                    cx="90"
                                    cy="90"
                                />
                            </svg>
                            <div className="absolute inset-0 flex flex-col items-center justify-center">
                                <div className="flex items-baseline">
                                    <span className={cn("text-5xl font-black tracking-tighter", runningRuntimes > 0 ? "text-green-400" : "text-white")}>
                                        {runningRuntimes}
                                    </span>
                                </div>
                                <span className={cn(
                                    "text-[10px] uppercase tracking-widest font-bold mt-2 px-3 py-1.5 rounded-full border",
                                    runningRuntimes > 0
                                        ? "text-green-400 bg-green-500/15 border-green-500/30"
                                        : "text-purple-400 bg-purple-500/10 border-purple-500/20"
                                )}>
                                    {runningRuntimes > 0 ? 'Running' : 'Idle'}
                                </span>
                            </div>
                        </div>
                        <p className="text-xs mt-4 font-medium text-white/30">
                            {runningRuntimes} of {data.llmRuntimes.length} LLM runtimes active
                        </p>
                    </div>

                    {/* Stats Summary */}
                    <div className="bg-sparkle-card/80 backdrop-blur-sm rounded-3xl p-6 border border-white/5 relative overflow-hidden flex flex-col justify-center gap-6 shadow-xl shadow-black/20 group hover:border-white/10 transition-colors">
                        <div className="flex items-center justify-between p-5 bg-gradient-to-br from-white/5 to-transparent rounded-2xl border border-white/5">
                            <div>
                                <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest mb-1.5">Installed</p>
                                <div className="flex items-baseline gap-2">
                                    <p className="text-3xl font-bold text-white tracking-tight">{totalInstalled}</p>
                                    <span className="text-sm font-medium text-white/30">/ {totalTools}</span>
                                </div>
                            </div>
                            <div className="p-3.5 bg-green-500/10 text-green-400 rounded-xl border border-green-500/10">
                                <Check size={24} strokeWidth={2.5} />
                            </div>
                        </div>
                        <div className="flex items-center justify-between p-5 bg-gradient-to-br from-white/5 to-transparent rounded-2xl border border-white/5">
                            <div>
                                <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest mb-1.5">GPU Ready</p>
                                <p className="text-3xl font-bold text-white tracking-tight">
                                    {data.gpuAcceleration.filter(g => g.installed).length > 0 ? 'Yes' : 'No'}
                                </p>
                            </div>
                            <div className={cn(
                                "p-3.5 rounded-xl border",
                                data.gpuAcceleration.filter(g => g.installed).length > 0
                                    ? "bg-green-500/10 text-green-400 border-green-500/10"
                                    : "bg-yellow-500/10 text-yellow-400 border-yellow-500/10"
                            )}>
                                <Zap size={24} strokeWidth={2.5} />
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Toolbar */}
            <div className="sticky -top-6 z-20 bg-sparkle-bg/95 backdrop-blur-xl pt-10 pb-4 mb-8 -mx-6 px-6 border-b border-white/5">
                <div className="flex flex-col md:flex-row gap-4 justify-between items-center">
                    <div className="flex flex-1 w-full gap-3">
                        <div className="relative flex-1 group/search">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30 group-focus-within/search:text-sparkle-accent transition-colors" size={18} />
                            <input
                                type="text"
                                placeholder="Search AI tools..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full bg-sparkle-card border border-white/10 rounded-2xl py-3 pl-11 pr-4 text-sm text-white focus:outline-none focus:border-sparkle-accent/50 focus:ring-4 focus:ring-sparkle-accent/5 transition-all placeholder:text-white/20 shadow-sm"
                            />
                        </div>

                        <Dropdown
                            value={filterCategory}
                            onChange={(value) => setFilterCategory(value as FilterCategory)}
                            icon={<Filter size={14} />}
                            className="min-w-[200px]"
                            options={[
                                { value: 'all', label: 'All Categories' },
                                { value: 'llm', label: 'LLM Runtimes', color: '#a855f7' },
                                { value: 'gpu', label: 'GPU Acceleration', color: '#22c55e' },
                                { value: 'frameworks', label: 'AI Frameworks', color: '#3b82f6' }
                            ]}
                        />
                    </div>

                    <div className="flex items-center gap-1.5 bg-sparkle-card p-1.5 rounded-2xl border border-white/10 shadow-sm">
                        {[
                            { id: 'grid', icon: LayoutGrid },
                            { id: 'list', icon: List }
                        ].map(({ id, icon: Icon }) => (
                            <button
                                key={id}
                                onClick={() => setViewMode(id as ViewMode)}
                                className={cn(
                                    "p-2.5 rounded-xl transition-all duration-300",
                                    viewMode === id
                                        ? "bg-white/10 text-white shadow-inner"
                                        : "text-white/30 hover:text-white hover:bg-white/5"
                                )}
                            >
                                <Icon size={18} />
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* LLM Runtimes Section */}
            {filteredData.llmRuntimes.length > 0 && (
                <div className="mb-10">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-purple-500/10">
                            <Bot size={18} className="text-purple-500" />
                        </div>
                        <h2 className="text-lg font-bold text-sparkle-text">Local LLM Runtimes</h2>
                        <div className="h-px bg-white/5 flex-1 ml-4" />
                    </div>

                    <div className={cn(
                        "grid gap-4",
                        viewMode === 'grid' ? "grid-cols-1 md:grid-cols-2 lg:grid-cols-3" : "grid-cols-1"
                    )}>
                        {filteredData.llmRuntimes.map((runtime) => (
                            <Link
                                to={`/devtools/${runtime.id}`}
                                key={runtime.id}
                                className={cn(
                                    "group relative border border-white/5 transition-all duration-300 overflow-hidden hover:-translate-y-1 hover:border-white/10 rounded-2xl bg-sparkle-card p-6 cursor-pointer",
                                    viewMode === 'list' && "flex items-center gap-6"
                                )}
                            >
                                {/* Hover Glow */}
                                <div
                                    className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
                                    style={{
                                        background: `linear-gradient(to bottom right, #a855f705, transparent)`
                                    }}
                                />

                                <div className={cn("flex items-start gap-4", viewMode === 'list' && "flex-1")}>
                                    <div className="p-3 rounded-xl bg-sparkle-bg border border-white/5">
                                        <ToolIcon tool={runtime.id} size={viewMode === 'list' ? 24 : 32} className={!runtime.installed ? 'grayscale opacity-50' : ''} />
                                    </div>

                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                            <h3 className="font-bold text-white text-lg">{runtime.displayName}</h3>
                                            {runtime.running && (
                                                <span className="flex items-center gap-1 text-xs text-green-400 bg-green-500/10 px-2 py-0.5 rounded-full">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                                                    Running
                                                </span>
                                            )}
                                        </div>

                                        {runtime.installed ? (
                                            <div className="flex items-center gap-2">
                                                <Check size={14} className="text-green-500" />
                                                <p className="text-sm text-sparkle-text-secondary font-mono">
                                                    {runtime.version && runtime.version !== 'Installed' && /\d/.test(runtime.version) ? `v${runtime.version}` : 'Installed'}
                                                </p>
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-2">
                                                <X size={14} className="text-red-500/50" />
                                                <p className="text-sm text-sparkle-text-muted italic">Not installed</p>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Runtime Details */}
                                {runtime.installed && runtime.running && viewMode === 'grid' && (
                                    <div className="mt-4 pt-4 border-t border-white/5 space-y-2">
                                        {runtime.port && (
                                            <div className="flex items-center justify-between text-sm">
                                                <span className="text-white/40">Port</span>
                                                <code className="bg-white/5 px-2 py-0.5 rounded text-purple-400 font-mono">{runtime.port}</code>
                                            </div>
                                        )}
                                        {runtime.endpoint && (
                                            <div className="flex items-center justify-between text-sm">
                                                <span className="text-white/40">Endpoint</span>
                                                <code className="bg-white/5 px-2 py-0.5 rounded text-purple-400 font-mono text-xs truncate max-w-[150px]">{runtime.endpoint}</code>
                                            </div>
                                        )}
                                        {runtime.models && runtime.models.length > 0 && (
                                            <div className="pt-2">
                                                <p className="text-xs text-white/40 mb-2">Models ({runtime.models.length})</p>
                                                <div className="flex flex-wrap gap-1">
                                                    {runtime.models.slice(0, 3).map((model) => (
                                                        <span key={model} className="text-xs bg-purple-500/10 text-purple-400 px-2 py-1 rounded">{model}</span>
                                                    ))}
                                                    {runtime.models.length > 3 && (
                                                        <span className="text-xs bg-white/5 text-white/40 px-2 py-1 rounded">+{runtime.models.length - 3}</span>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Status Badge */}
                                {viewMode === 'grid' && (
                                    <div className="absolute top-4 right-4">
                                        {runtime.installed ? (
                                            <Badge variant={runtime.running ? 'success' : 'warning'}>
                                                {runtime.running ? 'Active' : 'Stopped'}
                                            </Badge>
                                        ) : (
                                            <Badge variant="error" className="bg-red-500/10 text-red-500 border-red-500/20">Missing</Badge>
                                        )}
                                    </div>
                                )}
                            </Link>
                        ))}
                    </div>
                </div>
            )}

            {/* GPU Acceleration Section */}
            {filteredData.gpuAcceleration.length > 0 && (
                <div className="mb-10">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-green-500/10">
                            <Zap size={18} className="text-green-500" />
                        </div>
                        <h2 className="text-lg font-bold text-sparkle-text">GPU Acceleration</h2>
                        <div className="h-px bg-white/5 flex-1 ml-4" />
                    </div>

                    <div className={cn(
                        "grid gap-4",
                        viewMode === 'grid' ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4" : "grid-cols-1 sm:grid-cols-2"
                    )}>
                        {filteredData.gpuAcceleration.map((gpu) => (
                            <Link
                                to={`/devtools/${gpu.id}`}
                                key={gpu.id}
                                className={cn(
                                    "group relative border border-white/5 transition-all duration-300 overflow-hidden hover:-translate-y-1 hover:border-white/10 rounded-2xl bg-sparkle-card p-5 flex items-center gap-4 cursor-pointer",
                                    !gpu.installed && "opacity-60"
                                )}
                            >
                                <div className="p-2.5 rounded-xl bg-sparkle-bg border border-white/5">
                                    <ToolIcon tool={gpu.id} size={24} className={!gpu.installed ? 'grayscale opacity-50' : ''} />
                                </div>

                                <div className="flex-1 min-w-0">
                                    <h3 className="font-bold text-white">{gpu.displayName}</h3>
                                    {gpu.version && gpu.version !== 'Installed' && /\d/.test(gpu.version) && (
                                        <p className="text-xs text-sparkle-text-secondary font-mono">v{gpu.version}</p>
                                    )}
                                </div>

                                {gpu.installed ? (
                                    <div className="w-2.5 h-2.5 rounded-full bg-green-500" />
                                ) : (
                                    <div className="w-2.5 h-2.5 rounded-full bg-red-500/30" />
                                )}
                            </Link>
                        ))}
                    </div>
                </div>
            )}

            {/* AI Frameworks Section */}
            {filteredData.aiFrameworks.length > 0 && (
                <div className="mb-10">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-blue-500/10">
                            <Brain size={18} className="text-blue-500" />
                        </div>
                        <h2 className="text-lg font-bold text-sparkle-text">AI Frameworks</h2>
                        <div className="h-px bg-white/5 flex-1 ml-4" />
                    </div>

                    <div className={cn(
                        "grid gap-4",
                        viewMode === 'grid' ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4" : "grid-cols-1 sm:grid-cols-2"
                    )}>
                        {filteredData.aiFrameworks.map((framework) => (
                            <Link
                                to={`/devtools/${framework.id}`}
                                key={framework.id}
                                className={cn(
                                    "group relative border border-white/5 transition-all duration-300 overflow-hidden hover:-translate-y-1 hover:border-white/10 rounded-2xl bg-sparkle-card p-5 flex items-center gap-4 cursor-pointer",
                                    !framework.installed && "opacity-60"
                                )}
                            >
                                <div className="p-2.5 rounded-xl bg-sparkle-bg border border-white/5">
                                    <ToolIcon tool={framework.id} size={24} className={!framework.installed ? 'grayscale opacity-50' : ''} />
                                </div>

                                <div className="flex-1 min-w-0">
                                    <h3 className="font-bold text-white">{framework.displayName}</h3>
                                    {framework.version && framework.version !== 'Installed' && /\d/.test(framework.version) && (
                                        <p className="text-xs text-sparkle-text-secondary font-mono">v{framework.version}</p>
                                    )}
                                </div>

                                {framework.installed ? (
                                    <div className="w-2.5 h-2.5 rounded-full bg-green-500" />
                                ) : (
                                    <div className="w-2.5 h-2.5 rounded-full bg-red-500/30" />
                                )}
                            </Link>
                        ))}
                    </div>
                </div>
            )}

            {/* Empty State */}
            {filteredData.llmRuntimes.length === 0 &&
                filteredData.gpuAcceleration.length === 0 &&
                filteredData.aiFrameworks.length === 0 && (
                    <div className="text-center py-20">
                        <Brain size={48} className="mx-auto text-white/20 mb-4" />
                        <p className="text-white/40">No AI tools found matching your search.</p>
                    </div>
                )}
        </div>
    )
}
