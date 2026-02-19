import { useState, useEffect, useMemo, useDeferredValue } from 'react'
import { Link } from 'react-router-dom'
import {
    Code, Package, Wrench, Container, GitBranch,
    Check, X, Search, Filter,
    LayoutGrid, List, AlignJustify, PieChart as PieChartIcon
} from 'lucide-react'
import Dropdown, { DropdownOption } from '@/components/ui/Dropdown'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import Badge from '@/components/ui/Badge'
import { cn } from '@/lib/utils'
import { getCache, updateCache, isCacheStale } from '@/lib/refreshCache'
import ToolIcon from '@/components/ui/ToolIcon'
import { getToolById } from '../../../shared/tool-registry'
import { LoadingSpinner, LoadingOverlay, AnalyticsCardSkeleton, ToolGridSkeleton } from '@/components/ui/LoadingState'

interface Capability {
    id: string
    displayName: string
    category: string
    installed: boolean
    version?: string
    status: 'healthy' | 'warning' | 'error' | 'not_installed' | 'unknown'
    description?: string
    website?: string
    docsUrl?: string
    usedFor: string[]
    lastChecked?: number
}

interface ToolingReport {
    languages: Capability[]
    packageManagers: Capability[]
    buildTools: Capability[]
    containers: Capability[]
    versionControl: Capability[]
}

type RefreshDetail = {
    tooling?: ToolingReport
}

interface CategoryConfig {
    key: keyof ToolingReport
    title: string
    icon: typeof Code
    color: string
    bg: string
}

const CATEGORIES: CategoryConfig[] = [
    { key: 'languages', title: 'Languages', icon: Code, color: '#3b82f6', bg: 'bg-blue-500/10' },
    { key: 'packageManagers', title: 'Package Managers', icon: Package, color: '#a855f7', bg: 'bg-purple-500/10' },
    { key: 'buildTools', title: 'Build Tools', icon: Wrench, color: '#f97316', bg: 'bg-orange-500/10' },
    { key: 'containers', title: 'Containers', icon: Container, color: '#06b6d4', bg: 'bg-cyan-500/10' },
    { key: 'versionControl', title: 'Version Control', icon: GitBranch, color: '#22c55e', bg: 'bg-green-500/10' }
]

type ViewMode = 'grid' | 'detailed' | 'list'

export default function DevTools() {
    const cachedTooling = getCache<ToolingReport>('tooling')
    const [tooling, setTooling] = useState<ToolingReport | null>(cachedTooling)
    const [loading, setLoading] = useState(!cachedTooling)

    // UI State
    const [searchQuery, setSearchQuery] = useState('')
    const deferredSearchQuery = useDeferredValue(searchQuery)
    const [filterCategory, setFilterCategory] = useState<string>('all')
    const [viewMode, setViewMode] = useState<ViewMode>('grid')

    const fetchData = async () => {
        // Skip if cache is fresh
        if (!isCacheStale('tooling') && tooling) {
            setLoading(false)
            return
        }

        try {
            setLoading(true)
            const data = await window.devscope.getDeveloperTooling()
            updateCache({ tooling: data })
            setTooling(data)
        } catch (err) {
            console.error('Failed to fetch tooling:', err)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        if (!cachedTooling) {
            fetchData()
        }

        // Listen for prefetch complete
        const handlePrefetch = (event: Event) => {
            const detail = (event as CustomEvent).detail
            if (detail?.tooling) {
                setTooling(detail.tooling)
                setLoading(false)
            }
        }

        // Listen for background load (tooling loads after initial prefetch)
        const handleBackgroundLoad = (event: Event) => {
            const detail = (event as CustomEvent).detail
            if (detail?.tooling) {
                setTooling(detail.tooling)
                setLoading(false)
            }
        }

        const handleRefresh = (event: Event) => {
            const detail = (event as CustomEvent<RefreshDetail>).detail
            if (detail?.tooling) {
                updateCache({ tooling: detail.tooling })
                setTooling(detail.tooling)
                setLoading(false)
                return
            }
            fetchData()
        }

        window.addEventListener('devscope:prefetch-complete', handlePrefetch)
        window.addEventListener('devscope:background-load', handleBackgroundLoad)
        window.addEventListener('devscope:refresh', handleRefresh)
        return () => {
            window.removeEventListener('devscope:prefetch-complete', handlePrefetch)
            window.removeEventListener('devscope:background-load', handleBackgroundLoad)
            window.removeEventListener('devscope:refresh', handleRefresh)
        }
    }, [])

    // --- Analytics Data Prep ---
    const pieData = useMemo(() => {
        if (!tooling) return []
        return CATEGORIES.map(cat => ({
            name: cat.title,
            value: tooling[cat.key]?.length || 0,
            color: cat.color
        })).filter(d => d.value > 0)
    }, [tooling])

    const totalTools = useMemo(() => {
        if (!tooling) return 0
        return Object.values(tooling).flat().length
    }, [tooling])

    const totalInstalled = useMemo(() => {
        if (!tooling) return 0
        return Object.values(tooling).flat().filter(t => t.installed).length
    }, [tooling])

    const healthScore = useMemo(() => {
        if (!tooling || totalInstalled === 0) return 0
        const healthy = Object.values(tooling).flat().filter(t => t.status === 'healthy').length
        return Math.round((healthy / totalInstalled) * 100)
    }, [tooling, totalInstalled])

    // --- Filtering Logic ---
    const displayedCategories = useMemo(() => {
        if (!tooling) return []
        const searchValue = deferredSearchQuery.toLowerCase()

        let filteredCats = CATEGORIES
        if (filterCategory !== 'all') {
            filteredCats = CATEGORIES.filter(c => c.key === filterCategory)
        }

        return filteredCats.map(cat => {
            const tools = tooling[cat.key] || []
            const filteredTools = tools.filter(tool => {
                const matchesSearch = tool.displayName.toLowerCase().includes(searchValue) ||
                    tool.id.toLowerCase().includes(searchValue)
                return matchesSearch
            })
            return {
                ...cat,
                tools: filteredTools
            }
        }).filter(cat => cat.tools.length > 0)

    }, [tooling, filterCategory, deferredSearchQuery])

    const getStatusBadge = (status: Capability['status']) => {
        switch (status) {
            case 'healthy': return 'success'
            case 'warning': return 'warning'
            case 'error': return 'error'
            default: return 'default'
        }
    }

    if (loading) {
        return (
            <div className="max-w-[1600px] mx-auto animate-fadeIn pb-20 relative">
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-sparkle-text mb-2">Developer Tools</h1>
                    <p className="text-sparkle-text-secondary text-lg">Detecting your development stack...</p>
                </div>

                {/* Skeleton Analytics */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-10">
                    <AnalyticsCardSkeleton />
                    <AnalyticsCardSkeleton />
                    <AnalyticsCardSkeleton />
                </div>

                {/* Skeleton Tools */}
                <ToolGridSkeleton count={8} />

                {/* Loading Overlay */}
                <LoadingOverlay message="Scanning tools..." />
            </div>
        )
    }

    return (
        <div className="max-w-[1600px] mx-auto animate-fadeIn pb-20">
            {/* Header */}
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-sparkle-text mb-2">Developer Tools</h1>
                <p className="text-sparkle-text-secondary text-lg">
                    Manage and monitor your development stack.
                </p>
            </div>

            {/* Analytics Section */}
            {tooling && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-10 relative">
                    {/* Ambient Glow Background */}
                    <div className="absolute -top-10 -left-10 w-full h-full bg-sparkle-accent/5 blur-3xl rounded-full pointer-events-none" />

                    {/* Widget 1: Tools Distribution (Pie Chart) */}
                    <div className="bg-sparkle-card/80 backdrop-blur-sm rounded-3xl p-6 border border-white/5 relative overflow-hidden flex flex-col justify-between shadow-xl shadow-black/20 group hover:border-white/10 transition-colors cursor-pointer">
                        <div className="flex items-center justify-between mb-4 relative z-10">
                            <h3 className="text-xs font-bold text-sparkle-text-secondary uppercase tracking-widest">Ecosystem</h3>
                            <PieChartIcon className="text-white/20" size={18} />
                        </div>

                        <div className="flex items-center gap-6 relative z-10">
                            <div className="h-48 w-48 flex-shrink-0 relative cursor-pointer">
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
                                            className="cursor-pointer"
                                        >
                                            {pieData.map((entry, index) => (
                                                <Cell
                                                    key={`cell-${index}`}
                                                    fill={entry.color}
                                                    className="stroke-transparent outline-none cursor-pointer hover:opacity-80 transition-opacity"
                                                    style={{ cursor: 'pointer' }}
                                                />
                                            ))}
                                        </Pie>
                                        <Tooltip
                                            contentStyle={{ backgroundColor: '#0f0f0f', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.5)' }}
                                            itemStyle={{ color: '#fff', fontSize: '12px', fontWeight: 600 }}
                                            cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                                        />
                                    </PieChart>
                                </ResponsiveContainer>
                                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                                    <span className="text-3xl font-bold text-white">{totalTools}</span>
                                    <span className="text-[10px] text-white/40 uppercase tracking-wide">Tools</span>
                                </div>
                            </div>

                            <div className="space-y-3 flex-1">
                                {pieData.slice(0, 4).map((entry) => (
                                    <div key={entry.name} className="flex items-center justify-between text-sm group/row">
                                        <div className="flex items-center gap-3">
                                            <div className="w-2 h-2 rounded-full ring-2 ring-opacity-50 ring-offset-1 ring-offset-transparent" style={{ backgroundColor: entry.color, boxShadow: `0 0 8px ${entry.color}40` }} />
                                            <span className="text-sparkle-text-secondary font-medium group-hover/row:text-white transition-colors truncate max-w-[100px]">{entry.name}</span>
                                        </div>
                                        <span className="font-mono text-white/60 bg-white/5 px-1.5 py-0.5 rounded text-xs">{entry.value}</span>
                                    </div>
                                ))}
                                {pieData.length > 4 && (
                                    <div className="text-xs text-right text-white/30 pt-1 font-medium">
                                        + {pieData.length - 4} others
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Widget 2: Health Score */}
                    <div className="bg-sparkle-card/80 backdrop-blur-sm rounded-3xl p-6 border border-white/5 relative overflow-hidden flex flex-col justify-center items-center shadow-xl shadow-black/20 group hover:border-white/10 transition-colors">
                        <div className="relative w-48 h-48 flex items-center justify-center">
                            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 180 180">
                                {/* Background track */}
                                <circle
                                    className="text-white/5"
                                    strokeWidth="10"
                                    stroke="currentColor"
                                    fill="transparent"
                                    r="70"
                                    cx="90"
                                    cy="90"
                                />
                                {/* Progress ring */}
                                <circle
                                    className={cn(
                                        "transition-all duration-1000 ease-out",
                                        healthScore === 100
                                            ? "text-green-500"
                                            : "text-sparkle-accent"
                                    )}
                                    strokeWidth="10"
                                    strokeDasharray={440}
                                    strokeDashoffset={440 - (440 * healthScore) / 100}
                                    strokeLinecap="round"
                                    stroke="currentColor"
                                    fill="transparent"
                                    r="70"
                                    cx="90"
                                    cy="90"
                                />
                                {/* Decorative outer ring for 100% */}
                                {healthScore === 100 && (
                                    <circle
                                        className="text-green-500/20"
                                        strokeWidth="2"
                                        stroke="currentColor"
                                        fill="transparent"
                                        r="82"
                                        cx="90"
                                        cy="90"
                                    />
                                )}
                            </svg>
                            <div className="absolute inset-0 flex flex-col items-center justify-center">
                                <div className="flex items-baseline">
                                    <span className={cn(
                                        "text-5xl font-black tracking-tighter transition-colors",
                                        healthScore === 100 ? "text-green-400" : "text-white"
                                    )}>
                                        {healthScore}
                                    </span>
                                    <span className={cn(
                                        "text-2xl font-bold ml-0.5",
                                        healthScore === 100 ? "text-green-400/80" : "text-white/60"
                                    )}>
                                        %
                                    </span>
                                </div>
                                <span className={cn(
                                    "text-[10px] uppercase tracking-widest font-bold mt-2 px-3 py-1.5 rounded-full border transition-colors",
                                    healthScore === 100
                                        ? "text-green-400 bg-green-500/15 border-green-500/30"
                                        : "text-sparkle-accent bg-sparkle-accent/10 border-sparkle-accent/20"
                                )}>
                                    {healthScore === 100 ? 'Perfect' : 'Health'}
                                </span>
                            </div>
                        </div>

                        {/* Status text */}
                        <p className={cn(
                            "text-xs mt-4 font-medium transition-colors",
                            healthScore === 100 ? "text-green-400/70" : "text-white/30"
                        )}>
                            {healthScore === 100 ? 'All tools healthy' : `${100 - healthScore}% needs attention`}
                        </p>
                    </div>

                    {/* Widget 3: Stats Summary */}
                    <div className="bg-sparkle-card/80 backdrop-blur-sm rounded-3xl p-6 border border-white/5 relative overflow-hidden flex flex-col justify-center gap-6 shadow-xl shadow-black/20 group hover:border-white/10 transition-colors">
                        <div className="flex items-center justify-between p-5 bg-gradient-to-br from-white/5 to-transparent rounded-2xl border border-white/5 group/stat hover:from-white/10 transition-colors">
                            <div>
                                <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest mb-1.5">Installed</p>
                                <div className="flex items-baseline gap-2">
                                    <p className="text-3xl font-bold text-white tracking-tight">{totalInstalled}</p>
                                    <span className="text-sm font-medium text-white/30">/ {totalTools}</span>
                                </div>
                            </div>
                            <div className="p-3.5 bg-green-500/10 text-green-400 rounded-xl border border-green-500/10 shadow-[0_0_15px_rgba(34,197,94,0.1)] group-hover/stat:scale-105 transition-transform">
                                <Check size={24} strokeWidth={2.5} />
                            </div>
                        </div>
                        <div className="flex items-center justify-between p-5 bg-gradient-to-br from-white/5 to-transparent rounded-2xl border border-white/5 group/stat hover:from-white/10 transition-colors">
                            <div>
                                <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest mb-1.5">Coverage</p>
                                <p className="text-3xl font-bold text-white tracking-tight">
                                    {Math.round((totalInstalled / totalTools) * 100)}%
                                </p>
                            </div>
                            <div className="p-3.5 bg-blue-500/10 text-blue-400 rounded-xl border border-blue-500/10 shadow-[0_0_15px_rgba(59,130,246,0.1)] group-hover/stat:scale-105 transition-transform">
                                <Code size={24} strokeWidth={2.5} />
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Toolbar */}
            <div className="sticky -top-6 z-20 bg-sparkle-bg/95 backdrop-blur-xl pt-10 pb-4 mb-8 -mx-6 px-6 border-b border-white/5">
                <div className="flex flex-col md:flex-row gap-4 justify-between items-center group/toolbar">
                    {/* Search & Filter */}
                    <div className="flex flex-1 w-full gap-3">
                        <div className="relative flex-1 group/search">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30 group-focus-within/search:text-sparkle-accent transition-colors" size={18} />
                            <input
                                type="text"
                                placeholder="Search tools..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full bg-sparkle-card border border-white/10 rounded-2xl py-3 pl-11 pr-4 text-sm text-white focus:outline-none focus:border-sparkle-accent/50 focus:ring-4 focus:ring-sparkle-accent/5 transition-all placeholder:text-white/20 shadow-sm"
                            />
                        </div>

                        <Dropdown
                            value={filterCategory}
                            onChange={(value) => setFilterCategory(value)}
                            icon={<Filter size={14} />}
                            className="min-w-[200px]"
                            options={[
                                { value: 'all', label: 'All Categories' },
                                ...CATEGORIES.map(cat => ({
                                    value: cat.key,
                                    label: cat.title,
                                    color: cat.color
                                }))
                            ]}
                        />
                    </div>

                    {/* View Toggles */}
                    <div className="flex items-center gap-1.5 bg-sparkle-card p-1.5 rounded-2xl border border-white/10 shadow-sm">
                        {[
                            { id: 'grid', icon: LayoutGrid, label: 'Grid' },
                            { id: 'detailed', icon: AlignJustify, label: 'Detailed' },
                            { id: 'list', icon: List, label: 'List' }
                        ].map(({ id, icon: Icon }) => (
                            <button
                                key={id}
                                onClick={() => setViewMode(id as ViewMode)}
                                className={cn(
                                    "p-2.5 rounded-xl transition-all duration-300",
                                    viewMode === id
                                        ? "bg-white/10 text-white shadow-inner scale-105"
                                        : "text-white/30 hover:text-white hover:bg-white/5"
                                )}
                            >
                                <Icon size={18} />
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Content Area */}
            <div className="space-y-10">
                {displayedCategories.map((category) => (
                    <div key={category.key} className="animate-slideIn">
                        {/* Only show header if Mixed Mode (All Categories) */}
                        {filterCategory === 'all' && searchQuery === '' && (
                            <div className="flex items-center gap-3 mb-4">
                                <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center', category.bg)}>
                                    <category.icon size={18} style={{ color: category.color }} />
                                </div>
                                <h2 className="text-lg font-bold text-sparkle-text">{category.title}</h2>
                                <div className="h-px bg-white/5 flex-1 ml-4"></div>
                            </div>
                        )}

                        <div className={cn(
                            "grid gap-4",
                            viewMode === 'grid' && "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4",
                            viewMode === 'detailed' && "grid-cols-1 md:grid-cols-2", // Big cards
                            viewMode === 'list' && "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3" // Small dense items
                        )}>
                            {category.tools.map((tool) => {
                                const staticData = getToolById(tool.id)
                                const themeColor = staticData?.themeColor || '#525252'

                                return (
                                    <Link
                                        key={tool.id}
                                        to={`/devtools/${tool.id}`}
                                        className={cn(
                                            "group relative border border-white/5 transition-all duration-300 overflow-hidden hover:-translate-y-1 hover:border-white/10",
                                            viewMode === 'list' ? "rounded-xl p-3 bg-sparkle-card flex items-center gap-3" :
                                                "rounded-2xl bg-sparkle-card p-6 flex flex-col gap-4"
                                        )}
                                    >
                                        {/* Hover Glow */}
                                        <div
                                            className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
                                            style={{
                                                boxShadow: `inset 0 0 0 1px ${themeColor}40`,
                                                background: `linear-gradient(to bottom right, ${themeColor}05, transparent)`
                                            }}
                                        />

                                        {viewMode === 'list' ? (
                                            // --- LIST VIEW (Compact) ---
                                            <>
                                                <div className="p-2 rounded-lg bg-sparkle-bg border border-white/5">
                                                    <ToolIcon tool={tool.id} size={20} className={!tool.installed ? 'grayscale opacity-50' : ''} />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-bold text-sm text-white truncate">{tool.displayName}</span>
                                                        {tool.installed && tool.version && tool.version !== 'Installed' && /\d/.test(tool.version) && <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-white/50 font-mono">v{tool.version}</span>}
                                                    </div>
                                                </div>
                                                {tool.installed ? (
                                                    <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.4)]" />
                                                ) : (
                                                    <div className="w-2 h-2 rounded-full bg-red-500/20" />
                                                )}
                                            </>
                                        ) : (
                                            // --- GRID & DETAILED Views ---
                                            <>
                                                {/* Header Row */}
                                                <div className="flex items-start justify-between w-full relative z-10">
                                                    <div className="p-3 rounded-xl bg-sparkle-bg border border-white/5 shadow-inner">
                                                        <ToolIcon tool={tool.id} size={viewMode === 'detailed' ? 40 : 32} className={!tool.installed ? 'grayscale opacity-50' : ''} />
                                                    </div>

                                                    {tool.installed ? (
                                                        <Badge variant={getStatusBadge(tool.status) as any}>
                                                            {tool.status === 'healthy' ? 'OK' : tool.status}
                                                        </Badge>
                                                    ) : (
                                                        <Badge variant="error" className="bg-red-500/10 text-red-500 border-red-500/20">Missing</Badge>
                                                    )}
                                                </div>

                                                {/* Content */}
                                                <div className="relative z-10 flex-1">
                                                    <h3 className="font-bold text-sparkle-text text-lg mb-1 group-hover:text-white transition-colors text-white">
                                                        {tool.displayName}
                                                    </h3>

                                                    {/* Description only in Detailed View */}
                                                    {viewMode === 'detailed' && (
                                                        <p className="text-sm text-sparkle-text-secondary line-clamp-2 mb-3 h-10">
                                                            {staticData?.description || "No description available."}
                                                        </p>
                                                    )}

                                                    {tool.installed ? (
                                                        <div className="flex items-center gap-2">
                                                            <Check size={14} className="text-green-500" />
                                                            <p className="text-sm text-sparkle-text-secondary font-mono">
                                                                {tool.version && tool.version !== 'Installed' && /\d/.test(tool.version) ? `v${tool.version}` : 'Installed'}
                                                            </p>
                                                        </div>
                                                    ) : (
                                                        <div className="flex items-center gap-2">
                                                            <X size={14} className="text-red-500/50" />
                                                            <p className="text-sm text-sparkle-text-muted italic">Not installed</p>
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Theme Accent Line */}
                                                {tool.installed && (
                                                    <div
                                                        className="absolute bottom-0 left-0 right-0 h-1 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                                                        style={{ background: themeColor }}
                                                    />
                                                )}
                                            </>
                                        )}
                                    </Link>
                                )
                            })}
                        </div>
                    </div>
                ))}
            </div>
        </div >
    )
}

