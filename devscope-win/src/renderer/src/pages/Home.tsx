/**
 * DevScope - Home Dashboard
 * Comprehensive overview with all general data
 */

import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
    Wrench, Bot, Server, ArrowRight, Check, Code, Cpu, HardDrive, MemoryStick,
    AlertTriangle, Zap, PieChart as PieChartIcon, Sparkles, Monitor, Gauge, Terminal as TerminalIcon, FolderTree
} from 'lucide-react'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import Badge from '@/components/ui/Badge'
import { cn } from '@/lib/utils'
import { getCache, updateCache } from '@/lib/refreshCache'
import { LoadingOverlay, AnalyticsCardSkeleton, CardSkeleton } from '@/components/ui/LoadingState'
import { useSettings } from '@/lib/settings'

interface SystemInfo {
    os: { name: string; version: string; arch: string; hostname: string; username: string }
    cpu: { model: string; cores: number; threads: number }
    memory: { total: number; available: number; used: number; type?: string }
    disks: { name: string; size: number }[]
    gpus: { model: string; vram?: string }[]
}

interface ReadinessInfo {
    level: 'ready' | 'partial' | 'not_ready'
    score: number
    installedTools: number
    totalTools: number
    warnings: { message: string }[]
}

interface ToolingReport {
    languages: any[]
    packageManagers: any[]
    buildTools: any[]
    containers: any[]
    versionControl: any[]
}

interface AIAgentsReport {
    agents: any[]
}

type RefreshDetail = {
    system?: SystemInfo
    readiness?: ReadinessInfo
    tooling?: ToolingReport
    aiAgents?: AIAgentsReport
}

interface Project {
    name: string
    path: string
    type: string
    frameworks: string[]
    lastModified?: number
    isProject: boolean
}

interface TerminalSessionInfo {
    id: string
    name: string
    shell: string
    cwd: string
    status: 'active' | 'exited' | 'error'
    createdAt: number
    lastActivity: number
}

const CATEGORIES = [
    { key: 'languages', title: 'Languages', color: '#3b82f6' },
    { key: 'packageManagers', title: 'Package Mgrs', color: '#a855f7' },
    { key: 'buildTools', title: 'Build Tools', color: '#f97316' },
    { key: 'containers', title: 'Containers', color: '#06b6d4' },
    { key: 'versionControl', title: 'Version Ctrl', color: '#22c55e' }
]

function formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

export default function Home() {
    const { settings } = useSettings()
    const cachedSystemInfo = getCache<SystemInfo>('system')
    const cachedReadiness = getCache<ReadinessInfo>('readiness')
    const cachedTooling = getCache<ToolingReport>('tooling')

    const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(cachedSystemInfo)
    const [readiness, setReadiness] = useState<ReadinessInfo | null>(cachedReadiness)
    const [tooling, setTooling] = useState<ToolingReport | null>(cachedTooling)
    const [aiAgents, setAiAgents] = useState<AIAgentsReport | null>(null)
    const [loading, setLoading] = useState(!cachedSystemInfo || !cachedReadiness)
    const [projects, setProjects] = useState<Project[]>([])
    const [projectsLoading, setProjectsLoading] = useState(false)
    const [terminalSessions, setTerminalSessions] = useState<TerminalSessionInfo[]>([])

    const fetchData = async () => {
        try {
            setLoading(true)
            const [system, readinessReport, toolingData, agentsData] = await Promise.all([
                window.devscope.getSystemOverview(),
                window.devscope.getReadinessReport(),
                window.devscope.getDeveloperTooling(),
                window.devscope.getAIAgents()
            ])
            updateCache({ system, readiness: readinessReport, tooling: toolingData })
            setSystemInfo(system)
            setReadiness(readinessReport)
            setTooling(toolingData)
            setAiAgents(agentsData)
        } catch (err) {
            console.error('Failed to fetch data:', err)
        } finally {
            setLoading(false)
        }
    }
    const loadProjects = async () => {
        if (!settings.projectsFolder) {
            setProjects([])
            return
        }
        setProjectsLoading(true)
        try {
            const result = await window.devscope.scanProjects(settings.projectsFolder)
            if (result.success) {
                setProjects(result.projects || [])
            }
        } catch (err) {
            console.error('Failed to load projects:', err)
        } finally {
            setProjectsLoading(false)
        }
    }

    const loadSessions = async () => {
        try {
            const res = await window.devscope.terminal.list()
            const sessions = (res as any).sessions ?? res
            if (Array.isArray(sessions)) {
                setTerminalSessions(sessions.filter((s: TerminalSessionInfo) => s.status === 'active'))
            }
        } catch (err) {
            console.error('Failed to load terminal sessions:', err)
        }
    }

    useEffect(() => {
        fetchData()
        loadProjects()
        loadSessions()

        const handleRefresh = (event: Event) => {
            const detail = (event as CustomEvent<RefreshDetail>).detail
            if (detail?.system) setSystemInfo(detail.system)
            if (detail?.readiness) setReadiness(detail.readiness)
            if (detail?.tooling) setTooling(detail.tooling)
            if (detail?.aiAgents) setAiAgents(detail.aiAgents)
            setLoading(false)
            loadProjects()
            loadSessions()
        }

        window.addEventListener('devscope:refresh', handleRefresh)
        return () => window.removeEventListener('devscope:refresh', handleRefresh)
    }, [settings.projectsFolder])

    // Analytics calculations
    const pieData = useMemo(() => {
        if (!tooling) return []
        return CATEGORIES.map(cat => ({
            name: cat.title,
            value: (tooling as any)[cat.key]?.filter((t: any) => t.installed).length || 0,
            color: cat.color
        })).filter(d => d.value > 0)
    }, [tooling])

    const totalTools = useMemo(() => {
        if (!tooling) return 0
        return Object.values(tooling).flat().length
    }, [tooling])

    const totalInstalled = useMemo(() => {
        if (!tooling) return 0
        return Object.values(tooling).flat().filter((t: any) => t.installed).length
    }, [tooling])

    const installedAgents = useMemo(() => {
        if (!aiAgents?.agents) return 0
        return aiAgents.agents.filter((a: any) => a.installed).length
    }, [aiAgents])

    const totalAgents = useMemo(() => {
        return aiAgents?.agents?.length || 0
    }, [aiAgents])

    const memoryUsedPercent = useMemo(() => {
        if (!systemInfo?.memory) return 0
        return Math.round((systemInfo.memory.used / systemInfo.memory.total) * 100)
    }, [systemInfo])

    const totalDiskSize = useMemo(() => {
        if (!systemInfo?.disks) return 0
        return systemInfo.disks.reduce((acc, d) => acc + d.size, 0)
    }, [systemInfo])
    const totalProjects = useMemo(() => projects.length, [projects])
    const projectFrameworks = useMemo(() => {
        const set = new Set<string>()
        projects.forEach(p => p.frameworks?.forEach(f => set.add(f)))
        return Array.from(set)
    }, [projects])
    const activeProjectSessions = useMemo(() => {
        if (!projects.length || !terminalSessions.length) return []
        const normalizedProjects = projects.map(p => ({
            ...p,
            norm: p.path.toLowerCase().replace(/\\\\/g, '/')
        }))
        return terminalSessions.map(session => {
            const sessionCwd = session.cwd.toLowerCase().replace(/\\\\/g, '/')
            const projectMatch = normalizedProjects.find(p => sessionCwd.startsWith(p.norm))
            return {
                ...session,
                projectName: projectMatch?.name,
                projectPath: projectMatch?.path
            }
        })
    }, [projects, terminalSessions])
    const activeSessionsCount = activeProjectSessions.filter(s => s.status === 'active').length

    if (loading) {
        return (
            <div className="animate-fadeIn pb-10 relative">
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-sparkle-text mb-2">Welcome back!</h1>
                    <p className="text-sparkle-text-secondary text-lg">Loading your development environment...</p>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-10">
                    <AnalyticsCardSkeleton />
                    <AnalyticsCardSkeleton />
                    <AnalyticsCardSkeleton />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
                    {Array.from({ length: 4 }).map((_, i) => <CardSkeleton key={i} />)}
                </div>
                <LoadingOverlay message="Initializing..." />
            </div>
        )
    }

    return (
        <div className="animate-fadeIn pb-10">
            {/* Greeting */}
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-sparkle-text mb-2">
                    Welcome back, {systemInfo?.os.username || 'Developer'}!
                </h1>
                <p className="text-sparkle-text-secondary text-lg">
                    Here's an overview of your development environment on {systemInfo?.os.hostname || 'your machine'}.
                </p>
            </div>

            {/* System Overview Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                <SystemStatCard
                    icon={<Cpu size={20} />}
                    label="CPU"
                    value={systemInfo?.cpu.model?.split(' ').slice(0, 3).join(' ') || 'Unknown'}
                    subValue={`${systemInfo?.cpu.cores || 0} cores / ${systemInfo?.cpu.threads || 0} threads`}
                    color="blue"
                />
                <SystemStatCard
                    icon={<MemoryStick size={20} />}
                    label="Memory"
                    value={formatBytes(systemInfo?.memory.total || 0)}
                    subValue={`${memoryUsedPercent}% used`}
                    color="purple"
                />
                <SystemStatCard
                    icon={<HardDrive size={20} />}
                    label="Storage"
                    value={formatBytes(totalDiskSize)}
                    subValue={`${systemInfo?.disks?.length || 0} drives`}
                    color="orange"
                />
                <SystemStatCard
                    icon={<Monitor size={20} />}
                    label="GPU"
                    value={systemInfo?.gpus?.[0]?.model?.split(' ').slice(0, 3).join(' ') || 'Integrated'}
                    subValue={systemInfo?.gpus?.[0]?.vram || 'N/A'}
                    color="green"
                />
            </div>
            {/* Project Pulse */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                <Link
                    to="/projects"
                    className="bg-sparkle-card/80 backdrop-blur-sm rounded-2xl p-6 border border-sparkle-border relative overflow-hidden flex items-center gap-4 shadow-xl shadow-black/20 group hover:border-sparkle-border-secondary transition-all hover:-translate-y-1"
                >
                    <div className="p-3 rounded-xl bg-indigo-500/10 text-indigo-300">
                        <FolderTree size={22} />
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-[10px] font-bold text-sparkle-text-muted uppercase tracking-widest mb-1">Projects</p>
                        <p className="text-2xl font-bold text-sparkle-text">{projectsLoading ? 'Scanning...' : totalProjects}</p>
                        <p className="text-xs text-sparkle-text-secondary truncate">
                            {projectFrameworks.length > 0 ? `${projectFrameworks.length} frameworks detected` : 'Open projects hub'}
                        </p>
                    </div>
                    <ArrowRight size={14} className="text-sparkle-text-muted group-hover:text-sparkle-text-secondary transition-colors" />
                </Link>

                <div className="bg-sparkle-card/80 backdrop-blur-sm rounded-2xl p-6 border border-sparkle-border relative overflow-hidden flex items-center gap-4 shadow-xl shadow-black/20">
                    <div className="p-3 rounded-xl bg-purple-500/10 text-purple-300">
                        <TerminalIcon size={22} />
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-[10px] font-bold text-sparkle-text-muted uppercase tracking-widest mb-1">Active Sessions</p>
                        <p className="text-2xl font-bold text-sparkle-text">{activeSessionsCount}</p>
                        <p className="text-xs text-sparkle-text-secondary truncate">
                            {activeSessionsCount > 0 ? 'Linked to project folders' : 'No running sessions'}
                        </p>
                    </div>
                </div>

                <Link
                    to="/ai-agents"
                    className="bg-sparkle-card/80 backdrop-blur-sm rounded-2xl p-6 border border-sparkle-border relative overflow-hidden flex items-center gap-4 shadow-xl shadow-black/20 group hover:border-sparkle-border-secondary transition-all hover:-translate-y-1"
                >
                    <div className="p-3 rounded-xl bg-pink-500/10 text-pink-300">
                        <Sparkles size={22} />
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-[10px] font-bold text-sparkle-text-muted uppercase tracking-widest mb-1">AI Agents</p>
                        <p className="text-2xl font-bold text-sparkle-text">{installedAgents}/{totalAgents}</p>
                        <p className="text-xs text-sparkle-text-secondary truncate">Installed / detected</p>
                    </div>
                    <ArrowRight size={14} className="text-sparkle-text-muted group-hover:text-sparkle-text-secondary transition-colors" />
                </Link>
            </div>

            {/* Main Analytics Row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
                {/* Ecosystem Pie Chart */}
                <Link
                    to="/devtools"
                    className="bg-sparkle-card/80 backdrop-blur-sm rounded-2xl p-6 border border-sparkle-border relative overflow-hidden flex flex-col shadow-xl shadow-black/20 group hover:border-sparkle-border-secondary transition-all hover:-translate-y-1"
                >
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-xs font-bold text-sparkle-text-secondary uppercase tracking-widest">Dev Tools</h3>
                        <PieChartIcon className="text-sparkle-text-muted group-hover:text-sparkle-text-muted transition-colors" size={18} />
                    </div>

                    <div className="flex items-center gap-4 flex-1">
                        <div className="h-36 w-36 flex-shrink-0 relative">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie data={pieData} innerRadius={40} outerRadius={60} paddingAngle={4} dataKey="value" stroke="none" cornerRadius={4}>
                                        {pieData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.color} />
                                        ))}
                                    </Pie>
                                    <Tooltip contentStyle={{ backgroundColor: '#0f0f0f', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', fontSize: '12px' }} />
                                </PieChart>
                            </ResponsiveContainer>
                            <div className="absolute inset-0 flex flex-col items-center justify-center">
                                <span className="text-2xl font-bold text-sparkle-text">{totalInstalled}</span>
                                <span className="text-[9px] text-sparkle-text-muted uppercase">Installed</span>
                            </div>
                        </div>

                        <div className="space-y-2 flex-1 min-w-0">
                            {pieData.map((entry) => (
                                <div key={entry.name} className="flex items-center justify-between text-xs">
                                    <div className="flex items-center gap-2 min-w-0">
                                        <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: entry.color }} />
                                        <span className="text-sparkle-text-secondary truncate">{entry.name}</span>
                                    </div>
                                    <span className="font-mono text-sparkle-text-secondary bg-sparkle-card px-1.5 py-0.5 rounded text-[10px]">{entry.value}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="flex items-center gap-2 mt-4 text-xs text-sparkle-accent opacity-0 group-hover:opacity-100 transition-opacity">
                        <span>View All Tools</span>
                        <ArrowRight size={12} />
                    </div>
                </Link>

                {/* AI Agents Summary */}
                <Link
                    to="/ai-agents"
                    className="bg-sparkle-card/80 backdrop-blur-sm rounded-2xl p-6 border border-sparkle-border relative overflow-hidden flex flex-col shadow-xl shadow-black/20 group hover:border-sparkle-border-secondary transition-all hover:-translate-y-1"
                >
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-xs font-bold text-sparkle-text-secondary uppercase tracking-widest">AI Agents</h3>
                        <Sparkles className="text-sparkle-text-muted group-hover:text-sparkle-text-muted transition-colors" size={18} />
                    </div>

                    <div className="flex-1 flex flex-col justify-center">
                        <div className="text-center mb-4">
                            <div className="text-5xl font-black text-sparkle-text mb-1">{installedAgents}</div>
                            <div className="text-xs text-sparkle-text-muted">of {totalAgents} agents installed</div>
                        </div>

                        <div className="h-2 bg-sparkle-card rounded-full overflow-hidden mb-4">
                            <div
                                className="h-full bg-gradient-to-r from-pink-500 to-purple-500 rounded-full transition-all"
                                style={{ width: `${totalAgents > 0 ? (installedAgents / totalAgents) * 100 : 0}%` }}
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-xs">
                            <div className="bg-sparkle-card rounded-lg p-2 text-center">
                                <div className="text-sparkle-text font-semibold">{installedAgents}</div>
                                <div className="text-sparkle-text-muted">Ready</div>
                            </div>
                            <div className="bg-sparkle-card rounded-lg p-2 text-center">
                                <div className="text-sparkle-text font-semibold">{totalAgents - installedAgents}</div>
                                <div className="text-sparkle-text-muted">Available</div>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 mt-4 text-xs text-sparkle-accent opacity-0 group-hover:opacity-100 transition-opacity">
                        <span>View AI Agents</span>
                        <ArrowRight size={12} />
                    </div>
                </Link>

                {/* Readiness Score */}
                <Link
                    to="/devtools"
                    className="bg-sparkle-card/80 backdrop-blur-sm rounded-2xl p-6 border border-sparkle-border relative overflow-hidden flex flex-col items-center justify-center shadow-xl shadow-black/20 group hover:border-sparkle-border-secondary transition-all hover:-translate-y-1"
                >
                    <div className="absolute top-6 left-6 right-6 flex items-center justify-between">
                        <h3 className="text-xs font-bold text-sparkle-text-secondary uppercase tracking-widest">Readiness</h3>
                        <Gauge className="text-sparkle-text-muted group-hover:text-sparkle-text-muted transition-colors" size={18} />
                    </div>

                    <div className="relative w-36 h-36 flex items-center justify-center">
                        <svg className="w-full h-full transform -rotate-90" viewBox="0 0 140 140">
                            <circle className="text-sparkle-text/5" strokeWidth="8" stroke="currentColor" fill="transparent" r="55" cx="70" cy="70" />
                            <circle
                                className={cn(
                                    "transition-all duration-1000 ease-out",
                                    (readiness?.score || 0) >= 80 ? "text-green-500" :
                                        (readiness?.score || 0) >= 50 ? "text-yellow-500" : "text-red-500"
                                )}
                                strokeWidth="8"
                                strokeDasharray={345}
                                strokeDashoffset={345 - (345 * (readiness?.score || 0)) / 100}
                                strokeLinecap="round"
                                stroke="currentColor"
                                fill="transparent"
                                r="55"
                                cx="70"
                                cy="70"
                            />
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                            <span className="text-4xl font-black text-sparkle-text">{readiness?.score || 0}</span>
                            <span className="text-[10px] text-sparkle-text-muted uppercase">Score</span>
                        </div>
                    </div>

                    <Badge
                        variant={readiness?.level === 'ready' ? 'success' : readiness?.level === 'partial' ? 'warning' : 'error'}
                        className="mt-2"
                    >
                        {readiness?.level === 'ready' ? 'Ready' : readiness?.level === 'partial' ? 'Partial' : 'Not Ready'}
                    </Badge>
                </Link>
            </div>

            {/* Quick Links */}
            <h2 className="text-lg font-bold text-sparkle-text mb-4">Quick Access</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                <QuickLinkCard to="/devtools" icon={<Wrench size={20} />} color="orange" title="Dev Tools" subtitle={`${totalInstalled} installed`} />
                <QuickLinkCard to="/ai" icon={<Bot size={20} />} color="purple" title="AI Runtime" subtitle="ML frameworks" />
                <QuickLinkCard to="/ai-agents" icon={<Sparkles size={20} />} color="pink" title="AI Agents" subtitle={`${installedAgents} ready`} />
                <QuickLinkCard to="/projects" icon={<FolderTree size={20} />} color="blue" title="Projects" subtitle={settings.projectsFolder ? 'Open workspace' : 'Set projects folder'} />
            </div>
            {/* Active Sessions List */}
            {activeProjectSessions.length > 0 && (
                <div className="mb-8">
                    <div className="flex items-center gap-3 mb-3">
                        <div className="p-2 rounded-lg bg-purple-500/10">
                            <TerminalIcon className="text-purple-300" size={18} />
                        </div>
                        <h2 className="text-sm font-semibold text-sparkle-text">Active Sessions by Folder</h2>
                        <span className="text-xs text-sparkle-text-muted">{activeSessionsCount}</span>
                    </div>
                    <div className="space-y-2">
                        {activeProjectSessions.slice(0, 6).map(session => {
                            const folderName = session.cwd.split(/[/\\\\]/).filter(Boolean).pop() || session.cwd
                            const targetPath = encodeURIComponent(session.projectPath || session.cwd)
                            return (
                                <Link
                                    key={session.id}
                                    to={`/folder-browse/${targetPath}`}
                                    className="flex items-center gap-3 p-3 bg-sparkle-card/50 rounded-xl border border-sparkle-border hover:border-sparkle-border-secondary hover:bg-sparkle-card transition-all group"
                                >
                                    <div className="p-2 rounded-lg bg-sparkle-bg border border-sparkle-border">
                                        <TerminalIcon size={16} className="text-purple-300" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm font-semibold text-sparkle-text truncate">{session.name}</span>
                                            <Badge variant="default" className="bg-sparkle-card text-sparkle-text-secondary border-white/10">
                                                {session.shell}
                                            </Badge>
                                        </div>
                                        <p className="text-xs text-sparkle-text-muted truncate">
                                            {session.projectName ? `${session.projectName} • ${folderName}` : folderName}
                                        </p>
                                    </div>
                                    <ArrowRight size={14} className="text-sparkle-text-muted group-hover:text-sparkle-text-secondary transition-colors" />
                                </Link>
                            )
                        })}
                    </div>
                </div>
            )}

            {/* Warnings */}
            {readiness?.warnings && readiness.warnings.length > 0 && (
                <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-3">
                        <AlertTriangle size={18} className="text-yellow-500" />
                        <h3 className="font-semibold text-yellow-500">Attention Needed</h3>
                    </div>
                    <div className="space-y-2">
                        {readiness.warnings.slice(0, 3).map((warning, i) => (
                            <p key={i} className="text-sm text-yellow-500/80">{warning.message}</p>
                        ))}
                    </div>
                </div>
            )}
        </div>
    )
}

function SystemStatCard({ icon, label, value, subValue, color }: {
    icon: React.ReactNode
    label: string
    value: string
    subValue: string
    color: 'blue' | 'purple' | 'orange' | 'green'
}) {
    const colors = {
        blue: 'bg-blue-500/10 text-blue-400',
        purple: 'bg-purple-500/10 text-purple-400',
        orange: 'bg-orange-500/10 text-orange-400',
        green: 'bg-green-500/10 text-green-400'
    }

    return (
        <div className="bg-sparkle-card/50 rounded-xl p-4 border border-sparkle-border">
            <div className="flex items-center gap-3 mb-2">
                <div className={cn('p-2 rounded-lg', colors[color])}>
                    {icon}
                </div>
                <span className="text-xs text-sparkle-text-muted uppercase tracking-wide">{label}</span>
            </div>
            <p className="text-sm font-semibold text-sparkle-text truncate" title={value}>{value}</p>
            <p className="text-xs text-sparkle-text-muted">{subValue}</p>
        </div>
    )
}

function QuickLinkCard({ to, icon, color, title, subtitle }: {
    to: string
    icon: React.ReactNode
    color: 'orange' | 'purple' | 'pink' | 'blue'
    title: string
    subtitle: string
}) {
    const colors = {
        orange: 'bg-orange-500/10 text-orange-400',
        purple: 'bg-purple-500/10 text-purple-400',
        pink: 'bg-pink-500/10 text-pink-400',
        blue: 'bg-blue-500/10 text-blue-400'
    }

    return (
        <Link
            to={to}
            className="group p-4 bg-sparkle-card/50 rounded-xl border border-sparkle-border hover:border-sparkle-border-secondary hover:bg-sparkle-card transition-all hover:-translate-y-1"
        >
            <div className="flex items-center gap-3">
                <div className={cn('p-2.5 rounded-lg', colors[color])}>
                    {icon}
                </div>
                <div className="min-w-0">
                    <h3 className="font-semibold text-sparkle-text text-sm group-hover:text-sparkle-accent transition-colors">{title}</h3>
                    <p className="text-xs text-sparkle-text-secondary truncate">{subtitle}</p>
                </div>
            </div>
        </Link>
    )
}
