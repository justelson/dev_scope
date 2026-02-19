/**
 * DevScope - AI Agents Page
 * Shows AI coding assistants and CLI agents
 */

import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
    Bot, Sparkles, Check, X, Search, Filter,
    LayoutGrid, List, Terminal, ExternalLink
} from 'lucide-react'
import Dropdown from '@/components/ui/Dropdown'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import Badge from '@/components/ui/Badge'
import { cn } from '@/lib/utils'
import { getCache, updateCache, isCacheStale } from '@/lib/refreshCache'
import ToolIcon from '@/components/ui/ToolIcon'
import { getToolById } from '../../../shared/tool-registry'
import { LoadingOverlay, AnalyticsCardSkeleton, ToolGridSkeleton } from '@/components/ui/LoadingState'

interface Capability {
    id: string
    displayName: string
    category: string
    installed: boolean
    version?: string
    status: 'healthy' | 'warning' | 'error' | 'not_installed' | 'unknown'
    description?: string
    usedForCount?: number // UI specific
    usedFor: string[]
    lastChecked?: number
    metadata?: Record<string, any>
    docsUrl?: string
}

interface AIAgentsReport {
    agents: Capability[]
    timestamp: number
}

type ViewMode = 'grid' | 'list'

// Tag color mapping for visual distinction
const TAG_COLORS: Record<string, { bg: string; text: string; border: string }> = {
    // Core AI tags
    'ai': { bg: 'bg-purple-500/15', text: 'text-purple-400', border: 'border-purple-500/30' },
    'coding': { bg: 'bg-blue-500/15', text: 'text-blue-400', border: 'border-blue-500/30' },
    'terminal': { bg: 'bg-green-500/15', text: 'text-green-400', border: 'border-green-500/30' },
    'automation': { bg: 'bg-amber-500/15', text: 'text-amber-400', border: 'border-amber-500/30' },

    // Version control & collaboration
    'git': { bg: 'bg-orange-500/15', text: 'text-orange-400', border: 'border-orange-500/30' },
    'github': { bg: 'bg-slate-400/15', text: 'text-slate-300', border: 'border-slate-400/30' },
    'pair-programming': { bg: 'bg-pink-500/15', text: 'text-pink-400', border: 'border-pink-500/30' },

    // Editor/IDE related
    'editor': { bg: 'bg-cyan-500/15', text: 'text-cyan-400', border: 'border-cyan-500/30' },
    'ide': { bg: 'bg-indigo-500/15', text: 'text-indigo-400', border: 'border-indigo-500/30' },
    'autocomplete': { bg: 'bg-sky-500/15', text: 'text-sky-400', border: 'border-sky-500/30' },

    // Capabilities
    'open-source': { bg: 'bg-emerald-500/15', text: 'text-emerald-400', border: 'border-emerald-500/30' },
    'agentic-flow': { bg: 'bg-rose-500/15', text: 'text-rose-400', border: 'border-rose-500/30' },
    'performance': { bg: 'bg-yellow-500/15', text: 'text-yellow-400', border: 'border-yellow-500/30' },
    'fast': { bg: 'bg-yellow-500/15', text: 'text-yellow-400', border: 'border-yellow-500/30' },
    'search': { bg: 'bg-teal-500/15', text: 'text-teal-400', border: 'border-teal-500/30' },
    'codebase': { bg: 'bg-violet-500/15', text: 'text-violet-400', border: 'border-violet-500/30' },
    'context': { bg: 'bg-violet-500/15', text: 'text-violet-400', border: 'border-violet-500/30' },
    'multi-file': { bg: 'bg-fuchsia-500/15', text: 'text-fuchsia-400', border: 'border-fuchsia-500/30' },

    // Specific features
    'code-execution': { bg: 'bg-red-500/15', text: 'text-red-400', border: 'border-red-500/30' },
    'workflow': { bg: 'bg-lime-500/15', text: 'text-lime-400', border: 'border-lime-500/30' },
    'patterns': { bg: 'bg-lime-500/15', text: 'text-lime-400', border: 'border-lime-500/30' },
    'augmentation': { bg: 'bg-lime-500/15', text: 'text-lime-400', border: 'border-lime-500/30' },
    'productivity': { bg: 'bg-blue-400/15', text: 'text-blue-300', border: 'border-blue-400/30' },
    'shell': { bg: 'bg-green-400/15', text: 'text-green-300', border: 'border-green-400/30' },
    'privacy': { bg: 'bg-zinc-500/15', text: 'text-zinc-400', border: 'border-zinc-500/30' },
    'free': { bg: 'bg-emerald-400/15', text: 'text-emerald-300', border: 'border-emerald-400/30' },
    'generation': { bg: 'bg-purple-400/15', text: 'text-purple-300', border: 'border-purple-400/30' },
    'scaffolding': { bg: 'bg-orange-400/15', text: 'text-orange-300', border: 'border-orange-400/30' },
}

const getTagColor = (tag: string) => {
    return TAG_COLORS[tag.toLowerCase()] || { bg: 'bg-white/5', text: 'text-white/50', border: 'border-white/10' }
}

export default function AIAgents() {
    const cachedAgents = getCache<AIAgentsReport>('aiAgents')
    const [data, setData] = useState<AIAgentsReport | null>(cachedAgents)
    const [loading, setLoading] = useState(!cachedAgents)
    const [isRefreshing, setIsRefreshing] = useState(false)

    // UI State
    const [searchQuery, setSearchQuery] = useState('')
    const [filterStatus, setFilterStatus] = useState<'all' | 'installed' | 'not_installed'>('all')
    const [filterTag, setFilterTag] = useState<string>('all')
    const [viewMode, setViewMode] = useState<ViewMode>('grid')

    const fetchData = async (showRefreshIndicator = true) => {
        // Only show subtle refresh, not full loading if we have data
        if (showRefreshIndicator && data) {
            setIsRefreshing(true)
        } else if (!data) {
            setLoading(true)
        }

        try {
            const result = await window.devscope.getAIAgents()
            updateCache({ aiAgents: result })
            setData(result)
        } catch (err) {
            console.error('Failed to fetch AI agents:', err)
        } finally {
            setLoading(false)
            setIsRefreshing(false)
        }
    }

    useEffect(() => {
        // Fetch if no cache or stale
        if (!cachedAgents || isCacheStale('aiAgents')) {
            fetchData(!cachedAgents)
        }

        const handleRefresh = (event: Event) => {
            const detail = (event as CustomEvent).detail
            if (detail?.aiAgents) {
                updateCache({ aiAgents: detail.aiAgents })
                setData(detail.aiAgents)
                setLoading(false)
                setIsRefreshing(false)
                return
            }
            fetchData(true)
        }

        window.addEventListener('devscope:refresh', handleRefresh)
        return () => window.removeEventListener('devscope:refresh', handleRefresh)
    }, [])

    // Analytics
    const totalAgents = data?.agents.length || 0
    const installedAgents = data?.agents.filter(a => a.installed).length || 0
    const installRate = totalAgents > 0 ? Math.round((installedAgents / totalAgents) * 100) : 0

    const pieData = useMemo(() => {
        if (!data) return []
        return [
            { name: 'Installed', value: installedAgents, color: '#22c55e' },
            { name: 'Not Installed', value: totalAgents - installedAgents, color: '#3f3f46' }
        ].filter(d => d.value > 0)
    }, [data, installedAgents, totalAgents])

    // Get all unique tags for filtering
    const allTags = useMemo(() => {
        if (!data) return []
        const tags = new Set<string>()
        data.agents.forEach(agent => {
            agent.usedFor.forEach(tag => tags.add(tag))
        })
        return Array.from(tags).sort()
    }, [data])

    // Filtering
    const filteredAgents = useMemo(() => {
        if (!data) return []

        return data.agents.filter(agent => {
            const matchesSearch = agent.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                agent.id.toLowerCase().includes(searchQuery.toLowerCase())
            const matchesFilter = filterStatus === 'all' ||
                (filterStatus === 'installed' && agent.installed) ||
                (filterStatus === 'not_installed' && !agent.installed)
            const matchesTag = filterTag === 'all' || agent.usedFor.includes(filterTag)
            return matchesSearch && matchesFilter && matchesTag
        })
    }, [data, searchQuery, filterStatus, filterTag])

    if (loading) {
        return (
            <div className="max-w-[1600px] mx-auto animate-fadeIn pb-20 relative">
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-sparkle-text mb-2">AI Agents</h1>
                    <p className="text-sparkle-text-secondary text-lg">Detecting AI coding assistants...</p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-10">
                    <AnalyticsCardSkeleton />
                    <AnalyticsCardSkeleton />
                    <AnalyticsCardSkeleton />
                </div>

                <ToolGridSkeleton count={8} />
                <LoadingOverlay message="Scanning AI agents..." />
            </div>
        )
    }

    return (
        <div className="max-w-[1600px] mx-auto animate-fadeIn pb-20">
            {/* Header */}
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-sparkle-text mb-2">AI Agents</h1>
                <p className="text-sparkle-text-secondary text-lg">
                    CLI-based AI coding assistants and development agents.
                </p>
            </div>

            {/* Analytics Section */}
            {data && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-10 relative">
                    <div className="absolute -top-10 -left-10 w-full h-full bg-orange-500/5 blur-3xl rounded-full pointer-events-none" />

                    {/* Pie Chart */}
                    <div className="bg-sparkle-card/80 backdrop-blur-sm rounded-3xl p-6 border border-white/5 relative overflow-hidden flex flex-col justify-between shadow-xl shadow-black/20 group hover:border-white/10 transition-colors">
                        <div className="flex items-center justify-between mb-4 relative z-10">
                            <h3 className="text-xs font-bold text-sparkle-text-secondary uppercase tracking-widest">AI Agents</h3>
                            <Bot className="text-white/20" size={18} />
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
                                    <span className="text-3xl font-bold text-white">{totalAgents}</span>
                                    <span className="text-[10px] text-white/40 uppercase tracking-wide">Agents</span>
                                </div>
                            </div>

                            <div className="space-y-3 flex-1">
                                {pieData.map((entry) => (
                                    <div key={entry.name} className="flex items-center justify-between text-sm">
                                        <div className="flex items-center gap-3">
                                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
                                            <span className="text-sparkle-text-secondary font-medium">{entry.name}</span>
                                        </div>
                                        <span className="font-mono text-white/60 bg-white/5 px-1.5 py-0.5 rounded text-xs">{entry.value}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Install Rate */}
                    <div className="bg-sparkle-card/80 backdrop-blur-sm rounded-3xl p-6 border border-white/5 relative overflow-hidden flex flex-col justify-center items-center shadow-xl shadow-black/20 group hover:border-white/10 transition-colors">
                        <div className="relative w-48 h-48 flex items-center justify-center">
                            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 180 180">
                                <circle className="text-white/5" strokeWidth="10" stroke="currentColor" fill="transparent" r="70" cx="90" cy="90" />
                                <circle
                                    className={cn(
                                        "transition-all duration-1000 ease-out",
                                        installRate >= 50 ? "text-green-500" : "text-orange-500"
                                    )}
                                    strokeWidth="10"
                                    strokeDasharray={440}
                                    strokeDashoffset={440 - (440 * installRate) / 100}
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
                                    <span className={cn("text-5xl font-black tracking-tighter", installRate >= 50 ? "text-green-400" : "text-orange-400")}>
                                        {installRate}
                                    </span>
                                    <span className="text-2xl font-bold ml-0.5 text-white/60">%</span>
                                </div>
                                <span className={cn(
                                    "text-[10px] uppercase tracking-widest font-bold mt-2 px-3 py-1.5 rounded-full border",
                                    installRate >= 50
                                        ? "text-green-400 bg-green-500/15 border-green-500/30"
                                        : "text-orange-400 bg-orange-500/15 border-orange-500/30"
                                )}>
                                    Coverage
                                </span>
                            </div>
                        </div>
                        <p className="text-xs mt-4 font-medium text-white/30">
                            {installedAgents} of {totalAgents} agents installed
                        </p>
                    </div>

                    {/* Stats Summary */}
                    <div className="bg-sparkle-card/80 backdrop-blur-sm rounded-3xl p-6 border border-white/5 relative overflow-hidden flex flex-col justify-center gap-6 shadow-xl shadow-black/20 group hover:border-white/10 transition-colors">
                        <div className="flex items-center justify-between p-5 bg-gradient-to-br from-white/5 to-transparent rounded-2xl border border-white/5">
                            <div>
                                <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest mb-1.5">Installed</p>
                                <div className="flex items-baseline gap-2">
                                    <p className="text-3xl font-bold text-white tracking-tight">{installedAgents}</p>
                                    <span className="text-sm font-medium text-white/30">/ {totalAgents}</span>
                                </div>
                            </div>
                            <div className="p-3.5 bg-green-500/10 text-green-400 rounded-xl border border-green-500/10">
                                <Check size={24} strokeWidth={2.5} />
                            </div>
                        </div>
                        <div className="flex items-center justify-between p-5 bg-gradient-to-br from-white/5 to-transparent rounded-2xl border border-white/5">
                            <div>
                                <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest mb-1.5">AI Ready</p>
                                <p className="text-3xl font-bold text-white tracking-tight">
                                    {installedAgents > 0 ? 'Yes' : 'No'}
                                </p>
                            </div>
                            <div className={cn(
                                "p-3.5 rounded-xl border",
                                installedAgents > 0
                                    ? "bg-green-500/10 text-green-400 border-green-500/10"
                                    : "bg-yellow-500/10 text-yellow-400 border-yellow-500/10"
                            )}>
                                <Sparkles size={24} strokeWidth={2.5} />
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
                                placeholder="Search AI agents..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full bg-sparkle-card border border-white/10 rounded-2xl py-3 pl-11 pr-4 text-sm text-white focus:outline-none focus:border-sparkle-accent/50 focus:ring-4 focus:ring-sparkle-accent/5 transition-all placeholder:text-white/20 shadow-sm"
                            />
                        </div>

                        <Dropdown
                            value={filterStatus}
                            onChange={(value) => setFilterStatus(value as any)}
                            icon={<Filter size={14} />}
                            className="min-w-[160px]"
                            options={[
                                { value: 'all', label: 'All Agents' },
                                { value: 'installed', label: 'Installed' },
                                { value: 'not_installed', label: 'Not Installed' }
                            ]}
                        />

                        <Dropdown
                            value={filterTag}
                            onChange={(value) => setFilterTag(value)}
                            icon={<Bot size={14} />}
                            className="min-w-[140px]"
                            options={[
                                { value: 'all', label: 'All Tags' },
                                ...allTags.map(tag => ({ value: tag, label: tag }))
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

            {/* Agents Grid */}
            <div className={cn(
                "grid gap-4",
                viewMode === 'grid' ? "grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" : "grid-cols-1"
            )}>
                {filteredAgents.map((agent) => {
                    const staticData = getToolById(agent.id)
                    const themeColor = staticData?.themeColor || '#525252'

                    return (
                        <Link
                            key={agent.id}
                            to={`/devtools/${agent.id}`}
                            className={cn(
                                "group relative border border-white/5 transition-all duration-300 overflow-hidden hover:-translate-y-1 hover:border-white/10 rounded-2xl bg-sparkle-card",
                                viewMode === 'list' ? "p-4 flex items-center gap-4" : "p-6 flex flex-col gap-4"
                            )}
                        >
                            {/* Hover Glow */}
                            <div
                                className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
                                style={{
                                    boxShadow: `inset 0 0 0 1px ${themeColor}40`,
                                    background: `linear-gradient(to bottom right, ${themeColor}08, transparent)`
                                }}
                            />

                            {viewMode === 'list' ? (
                                // List View
                                <>
                                    <div className="p-2.5 rounded-xl bg-sparkle-bg border border-white/5">
                                        <ToolIcon tool={agent.id} size={24} className={!agent.installed ? 'grayscale opacity-50' : ''} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <h3 className="font-bold text-white truncate">{agent.displayName}</h3>
                                            {agent.installed && agent.version && agent.version !== 'Installed' && /\d/.test(agent.version) && (
                                                <span className="text-xs px-1.5 py-0.5 rounded bg-white/5 text-white/50 font-mono">v{agent.version}</span>
                                            )}
                                        </div>
                                        <p className="text-xs text-white/40 truncate mt-0.5">{agent.description}</p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {agent.installed ? (
                                            <Badge variant="success">Installed</Badge>
                                        ) : (
                                            <Badge variant="default" className="bg-white/5 text-white/40">Not Installed</Badge>
                                        )}
                                    </div>
                                </>
                            ) : (
                                // Grid View
                                <>
                                    <div className="flex items-start justify-between w-full relative z-10">
                                        <div className="p-3 rounded-xl bg-sparkle-bg border border-white/5 shadow-inner">
                                            <ToolIcon tool={agent.id} size={32} className={!agent.installed ? 'grayscale opacity-50' : ''} />
                                        </div>
                                        {agent.installed ? (
                                            <Badge variant="success">Installed</Badge>
                                        ) : (
                                            <Badge variant="default" className="bg-white/5 text-white/40 border-white/10">Missing</Badge>
                                        )}
                                    </div>

                                    <div className="flex-1 relative z-10">
                                        <h3 className="font-bold text-white text-lg mb-1">{agent.displayName}</h3>
                                        {agent.installed ? (
                                            <div className="flex items-center gap-2 mb-2">
                                                <Check size={14} className="text-green-500" />
                                                <span className="text-sm text-sparkle-text-secondary font-mono">
                                                    {agent.version && agent.version !== 'Installed' && /\d/.test(agent.version) ? `v${agent.version}` : 'Installed'}
                                                </span>
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-2 mb-2">
                                                <X size={14} className="text-red-500/50" />
                                                <span className="text-sm text-sparkle-text-muted italic">Not installed</span>
                                            </div>
                                        )}
                                        <p className="text-xs text-white/40 line-clamp-2">{agent.description}</p>
                                    </div>

                                    {/* Tags */}
                                    <div className="flex flex-wrap gap-1.5 relative z-10">
                                        {agent.usedFor.slice(0, 4).map((tag) => {
                                            const colors = getTagColor(tag)
                                            return (
                                                <span
                                                    key={tag}
                                                    className={cn(
                                                        "text-[10px] px-2 py-1 rounded-full font-medium border",
                                                        colors.bg,
                                                        colors.text,
                                                        colors.border
                                                    )}
                                                >
                                                    {tag}
                                                </span>
                                            )
                                        })}
                                    </div>

                                    {/* Quick Actions */}
                                    <div className="flex items-center gap-2 pt-3 border-t border-white/5 relative z-10">
                                        <button
                                            onClick={(e) => {
                                                e.preventDefault()
                                                e.stopPropagation()
                                                if (staticData?.website) {
                                                    window.open(staticData.website, '_blank', 'noopener,noreferrer')
                                                }
                                            }}
                                            className="flex items-center gap-1.5 text-xs text-white/40 hover:text-white transition-colors"
                                        >
                                            <ExternalLink size={12} />
                                            Website
                                        </button>
                                        <span className="text-white/10">•</span>
                                        <span className="flex items-center gap-1.5 text-xs text-white/40">
                                            <Terminal size={12} />
                                            CLI Tool
                                        </span>
                                    </div>
                                </>
                            )}
                        </Link>
                    )
                })}
            </div>

            {filteredAgents.length === 0 && (
                <div className="text-center py-20">
                    <Bot className="mx-auto text-white/10 mb-4" size={48} />
                    <p className="text-white/40">No AI agents found matching your criteria</p>
                </div>
            )}
        </div>
    )
}
