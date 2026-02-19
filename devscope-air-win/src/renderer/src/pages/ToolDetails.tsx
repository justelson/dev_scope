import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
    ArrowLeft, ExternalLink, Copy, Check, Terminal,
    FolderOpen, RefreshCw, Download, Info,
    CheckCircle, XCircle, AlertCircle, CirclePlay, Zap
} from 'lucide-react'
import Button from '@/components/ui/Button'
import ToolIcon from '@/components/ui/ToolIcon'
import { getCache, updateCache } from '@/lib/refreshCache'
import { cn } from '@/lib/utils'
import { getToolById } from '../../../shared/tool-registry'
import { useTerminal } from '@/App'

export default function ToolDetails() {
    const { toolId } = useParams()
    const navigate = useNavigate()
    const { openTerminal } = useTerminal()
    const [tooling, setTooling] = useState<any>(getCache('tooling'))
    const [aiRuntime, setAiRuntime] = useState<any>(getCache('aiRuntime'))
    const [aiAgents, setAiAgents] = useState<any>(getCache('aiAgents'))
    const [isLoading, setIsLoading] = useState(false)
    const [copiedItem, setCopiedItem] = useState<string | null>(null)
    const [isRefreshing, setIsRefreshing] = useState(false)
    const [templateCommands, setTemplateCommands] = useState<{ command: string; description: string }[]>([])

    const handleCopy = (text: string, type: string) => {
        navigator.clipboard.writeText(text)
        setCopiedItem(type)
        setTimeout(() => setCopiedItem(null), 2000)
    }

    const handleRefreshTool = async () => {
        setIsRefreshing(true)
        try {
            const [toolingData, aiRuntimeData, aiAgentsData] = await Promise.all([
                window.devscope.getDeveloperTooling(),
                window.devscope.getAIRuntimeStatus(),
                window.devscope.getAIAgents()
            ])
            updateCache({ tooling: toolingData, aiRuntime: aiRuntimeData, aiAgents: aiAgentsData })
            setTooling(toolingData)
            setAiRuntime(aiRuntimeData)
            setAiAgents(aiAgentsData)
        } catch (err) {
            console.error('Failed to refresh:', err)
        } finally {
            setTimeout(() => setIsRefreshing(false), 500)
        }
    }

    // Find tool data from all sources
    let toolData: any = null
    let dataSource: string = ''

    // Check developer tooling first
    if (tooling) {
        Object.values(tooling).forEach((category: any) => {
            if (Array.isArray(category)) {
                const found = category.find((t: any) => t.id?.toLowerCase() === toolId?.toLowerCase())
                if (found) {
                    toolData = found
                    dataSource = 'tooling'
                }
            }
        })
    }

    // Check AI runtime (LLM runtimes, GPU, frameworks)
    if (!toolData && aiRuntime) {
        const allAiTools = [
            ...(aiRuntime.llmRuntimes || []),
            ...(aiRuntime.gpuAcceleration || []),
            ...(aiRuntime.aiFrameworks || [])
        ]
        const found = allAiTools.find((t: any) => t.id?.toLowerCase() === toolId?.toLowerCase())
        if (found) {
            toolData = found
            dataSource = 'aiRuntime'
        }
    }

    // Check AI agents
    if (!toolData && aiAgents?.agents) {
        const found = aiAgents.agents.find((t: any) => t.id?.toLowerCase() === toolId?.toLowerCase())
        if (found) {
            toolData = found
            dataSource = 'aiAgents'
        }
    }

    // Static metadata from the shared registry
    const staticData = toolId ? getToolById(toolId) : undefined

    // Merge static registry data with dynamic backend data
    if (staticData) {
        toolData = {
            ...toolData,
            tool: staticData.id,
            displayName: staticData.displayName,
            description: staticData.description,
            themeColor: staticData.themeColor,
            website: staticData.website,
            docsUrl: staticData.docsUrl,
            usedFor: staticData.usedFor,
            category: staticData.category,
            command: staticData.command,
            installCommand: staticData.installCommand,
            version: toolData?.version || 'checking...',
            status: toolData?.status || 'unknown',
            installed: toolData?.installed ?? false,
            path: toolData?.path || toolData?.metadata?.path
        }
    } else if (!toolData) {
        toolData = {
            tool: toolId,
            displayName: toolId,
            description: "Information unavailable for this tool.",
            status: 'unknown',
            installed: false
        }
    }

    // Subscribe to cache updates
    useEffect(() => {
        const handleRefresh = (event: Event) => {
            const detail = (event as CustomEvent<any>).detail
            if (detail?.tooling) setTooling(detail.tooling)
            if (detail?.aiRuntime) setAiRuntime(detail.aiRuntime)
            if (detail?.aiAgents) setAiAgents(detail.aiAgents)
            setIsLoading(false)
        }
        window.addEventListener('devscope:refresh', handleRefresh)
        window.addEventListener('devscope:background-load', handleRefresh)

        // Fetch data if not available
        const fetchData = async () => {
            setIsLoading(true)
            try {
                const [toolingData, aiRuntimeData, aiAgentsData] = await Promise.all([
                    window.devscope.getDeveloperTooling(),
                    window.devscope.getAIRuntimeStatus(),
                    window.devscope.getAIAgents()
                ])
                updateCache({ tooling: toolingData, aiRuntime: aiRuntimeData, aiAgents: aiAgentsData })
                setTooling(toolingData)
                setAiRuntime(aiRuntimeData)
                setAiAgents(aiAgentsData)
            } catch (err) {
                console.error('Failed to fetch data:', err)
            } finally {
                setIsLoading(false)
            }
        }

        if (!toolData || !toolData.description) {
            fetchData()
        }

        return () => {
            window.removeEventListener('devscope:refresh', handleRefresh)
            window.removeEventListener('devscope:background-load', handleRefresh)
        }
    }, [toolId])

    // Load context-aware template commands for this tool
    // Note: suggestions API may not be fully implemented yet
    useEffect(() => {
        // If terminal.suggestions is available, use it
        if (toolId && typeof window.devscope.terminal?.suggestions === 'function') {
            window.devscope.terminal.suggestions(toolId)
                .then((data: any) => {
                    // Handle both old format (string[]) and new format ({ command, description }[])
                    if (Array.isArray(data) && data.length > 0) {
                        if (typeof data[0] === 'string') {
                            setTemplateCommands(data.map((cmd: string) => ({ command: cmd, description: '' })))
                        } else {
                            setTemplateCommands(data)
                        }
                    } else {
                        setTemplateCommands([])
                    }
                })
                .catch(() => setTemplateCommands([]))
        }
    }, [toolId, toolData?.category])

    const handleOpenTerminalWithContext = () => {
        openTerminal({
            id: toolId || '',
            category: toolData?.category || '',
            displayName: toolData?.displayName || toolId || ''
        }, toolData?.path)
    }

    const handleRunCommand = (command: string) => {
        openTerminal({
            id: toolId || '',
            category: toolData?.category || '',
            displayName: toolData?.displayName || toolId || ''
        }, toolData?.path, command)
    }

    const statusColor = toolData?.status === 'healthy' ? 'text-green-400' :
        toolData?.status === 'error' ? 'text-red-400' :
            toolData?.status === 'warning' ? 'text-yellow-400' :
                'text-sparkle-text-secondary'

    const StatusIcon = toolData?.status === 'healthy' ? CheckCircle :
        toolData?.status === 'error' ? XCircle :
            toolData?.status === 'warning' ? AlertCircle : Info

    return (
        <div className="max-w-6xl mx-auto animate-fadeIn pb-10">
            <Button
                variant="ghost"
                className="mb-8 pl-0 hover:pl-2 transition-all gap-2 text-sparkle-text-secondary hover:text-sparkle-text"
                onClick={() => navigate(-1)}
            >
                <ArrowLeft size={18} />
                Back
            </Button>

            {/* Hero Section */}
            <div
                className="relative overflow-hidden rounded-3xl p-10 mb-8 transition-all duration-500"
                style={{
                    background: `linear-gradient(to bottom right, ${toolData?.themeColor || '#22d3ee'}33, ${toolData?.themeColor || '#22d3ee'}00)`
                }}
            >
                <div className="absolute inset-0 opacity-10"
                    style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, rgba(255,255,255,0.15) 1px, transparent 0)', backgroundSize: '24px 24px' }}
                />

                <div className="relative z-10 flex flex-col md:flex-row items-center gap-10">
                    <div className="relative group">
                        <div className="relative p-6 bg-black/40 backdrop-blur-md rounded-2xl shadow-2xl border border-sparkle-border">
                            <ToolIcon tool={toolId || 'unknown'} size={96} className={cn("drop-shadow-lg", !toolData?.installed && "grayscale opacity-60")} />
                        </div>
                    </div>

                    <div className="flex-1 text-center md:text-left space-y-4">
                        <div className="flex flex-col md:flex-row items-center gap-4">
                            <h1 className="text-5xl font-bold text-sparkle-text tracking-tight">
                                {toolData?.displayName || toolId}
                            </h1>
                            <span className={cn(
                                "px-4 py-1.5 rounded-full text-xs font-bold tracking-wide uppercase bg-black/30 backdrop-blur-md flex items-center gap-2",
                                statusColor
                            )}>
                                <StatusIcon size={14} />
                                {toolData?.installed ? toolData.status : 'Not Installed'}
                            </span>
                        </div>

                        <div className="flex flex-wrap justify-center md:justify-start gap-3">
                            {toolData?.version && toolData.installed && (
                                <div className="flex items-center gap-2 bg-sparkle-card px-3 py-1.5 rounded-lg border border-sparkle-border">
                                    <span className="text-sparkle-text-secondary text-sm">Version</span>
                                    <span className="font-mono text-sparkle-text text-sm">v{toolData.version}</span>
                                </div>
                            )}
                            {toolData?.category && (
                                <div className="flex items-center gap-2 bg-sparkle-card px-3 py-1.5 rounded-lg border border-sparkle-border">
                                    <span className="capitalize text-sparkle-text-secondary text-sm">{toolData.category.replace('_', ' ')}</span>
                                </div>
                            )}
                            {toolData?.capabilities?.map((cap: string) => (
                                <div key={cap} className="flex items-center gap-2 bg-sparkle-accent/10 px-3 py-1.5 rounded-lg border border-sparkle-accent/20">
                                    <span className="text-sparkle-accent text-sm font-medium">{cap}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Quick Actions */}
                    <div className="flex gap-2">
                        <Button
                            variant="ghost"
                            size="sm"
                            className="bg-sparkle-card hover:bg-sparkle-card border border-sparkle-border"
                            onClick={handleRefreshTool}
                            disabled={isRefreshing}
                        >
                            <RefreshCw size={16} className={cn(isRefreshing && "animate-spin")} />
                        </Button>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Main Content */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Quick Actions Card */}
                    <div className="rounded-2xl p-6 bg-sparkle-card/30 backdrop-blur-sm border border-sparkle-border">
                        <h2 className="text-lg font-bold text-sparkle-text mb-4 flex items-center gap-2">
                            <Terminal size={20} className="text-sparkle-accent" />
                            Quick Actions
                        </h2>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {/* Copy Command */}
                            <button
                                onClick={() => handleCopy(`${toolData?.command || toolData?.tool} --version`, 'version-cmd')}
                                className="flex items-center gap-3 p-4 rounded-xl bg-sparkle-card border border-sparkle-border hover:bg-sparkle-card hover:border-sparkle-border transition-all text-left group"
                            >
                                <div className={cn(
                                    "p-2 rounded-lg transition-colors",
                                    copiedItem === 'version-cmd' ? "bg-green-500/20 text-green-400" : "bg-sparkle-accent/20 text-sparkle-accent"
                                )}>
                                    {copiedItem === 'version-cmd' ? <Check size={18} /> : <Copy size={18} />}
                                </div>
                                <div>
                                    <p className="text-sparkle-text font-medium text-sm">Copy Version Command</p>
                                    <p className="text-sparkle-text-muted text-xs font-mono">{toolData?.command || toolData?.tool} --version</p>
                                </div>
                            </button>

                            {/* Copy Path */}
                            {toolData?.path && (
                                <button
                                    onClick={() => handleCopy(toolData.path, 'path')}
                                    className="flex items-center gap-3 p-4 rounded-xl bg-sparkle-card border border-sparkle-border hover:bg-sparkle-card hover:border-sparkle-border transition-all text-left group"
                                >
                                    <div className={cn(
                                        "p-2 rounded-lg transition-colors",
                                        copiedItem === 'path' ? "bg-green-500/20 text-green-400" : "bg-blue-500/20 text-blue-400"
                                    )}>
                                        {copiedItem === 'path' ? <Check size={18} /> : <FolderOpen size={18} />}
                                    </div>
                                    <div>
                                        <p className="text-sparkle-text font-medium text-sm">Copy Install Path</p>
                                        <p className="text-sparkle-text-muted text-xs font-mono truncate max-w-[200px]">{toolData.path}</p>
                                    </div>
                                </button>
                            )}

                            {/* Run in Terminal */}
                            <button
                                onClick={() => handleCopy(toolData?.command || toolData?.tool, 'cmd')}
                                className="flex items-center gap-3 p-4 rounded-xl bg-sparkle-card border border-sparkle-border hover:bg-sparkle-card hover:border-sparkle-border transition-all text-left group"
                            >
                                <div className={cn(
                                    "p-2 rounded-lg transition-colors",
                                    copiedItem === 'cmd' ? "bg-green-500/20 text-green-400" : "bg-purple-500/20 text-purple-400"
                                )}>
                                    {copiedItem === 'cmd' ? <Check size={18} /> : <Terminal size={18} />}
                                </div>
                                <div>
                                    <p className="text-sparkle-text font-medium text-sm">Copy Command</p>
                                    <p className="text-sparkle-text-muted text-xs font-mono">{toolData?.command || toolData?.tool}</p>
                                </div>
                            </button>

                            {/* Run in Terminal */}
                            <button
                                onClick={() => handleOpenTerminalWithContext()}
                                className="flex items-center gap-3 p-4 rounded-xl bg-sparkle-accent/5 border border-sparkle-accent/10 hover:bg-sparkle-accent/10 hover:border-sparkle-accent/20 transition-all text-left group"
                            >
                                <div className="p-2 rounded-lg bg-sparkle-accent/20 text-sparkle-accent">
                                    <CirclePlay size={18} />
                                </div>
                                <div>
                                    <p className="text-sparkle-text font-medium text-sm">Open in Terminal</p>
                                    <p className="text-sparkle-text-muted text-xs">Launch context-aware console</p>
                                </div>
                            </button>

                            {/* Install Command (if not installed) */}
                            {!toolData?.installed && toolData?.installCommand && (
                                <button
                                    onClick={() => handleCopy(toolData.installCommand, 'install')}
                                    className="flex items-center gap-3 p-4 rounded-xl bg-green-500/10 border border-green-500/20 hover:bg-green-500/20 transition-all text-left group"
                                >
                                    <div className={cn(
                                        "p-2 rounded-lg transition-colors",
                                        copiedItem === 'install' ? "bg-green-500/30 text-green-300" : "bg-green-500/20 text-green-400"
                                    )}>
                                        {copiedItem === 'install' ? <Check size={18} /> : <Download size={18} />}
                                    </div>
                                    <div>
                                        <p className="text-green-400 font-medium text-sm">Copy Install Command</p>
                                        <p className="text-green-400/60 text-xs font-mono truncate max-w-[200px]">{toolData.installCommand}</p>
                                    </div>
                                </button>
                            )}

                            {/* Copy Website URL */}
                            {toolData?.website && (
                                <button
                                    onClick={() => handleCopy(toolData.website, 'website')}
                                    className="flex items-center gap-3 p-4 rounded-xl bg-sparkle-card border border-sparkle-border hover:bg-sparkle-card hover:border-sparkle-border transition-all text-left group"
                                >
                                    <div className={cn(
                                        "p-2 rounded-lg transition-colors",
                                        copiedItem === 'website' ? "bg-green-500/20 text-green-400" : "bg-orange-500/20 text-orange-400"
                                    )}>
                                        {copiedItem === 'website' ? <Check size={18} /> : <ExternalLink size={18} />}
                                    </div>
                                    <div>
                                        <p className="text-sparkle-text font-medium text-sm">Copy Website URL</p>
                                        <p className="text-sparkle-text-muted text-xs font-mono truncate max-w-[200px]">{toolData.website}</p>
                                    </div>
                                </button>
                            )}

                            {/* Copy Docs URL */}
                            {toolData?.docsUrl && (
                                <button
                                    onClick={() => handleCopy(toolData.docsUrl, 'docs')}
                                    className="flex items-center gap-3 p-4 rounded-xl bg-sparkle-card border border-sparkle-border hover:bg-sparkle-card hover:border-sparkle-border transition-all text-left group"
                                >
                                    <div className={cn(
                                        "p-2 rounded-lg transition-colors",
                                        copiedItem === 'docs' ? "bg-green-500/20 text-green-400" : "bg-cyan-500/20 text-cyan-400"
                                    )}>
                                        {copiedItem === 'docs' ? <Check size={18} /> : <ExternalLink size={18} />}
                                    </div>
                                    <div>
                                        <p className="text-sparkle-text font-medium text-sm">Copy Docs URL</p>
                                        <p className="text-sparkle-text-muted text-xs font-mono truncate max-w-[200px]">{toolData.docsUrl}</p>
                                    </div>
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Context-Aware Terminal Card */}
                    {templateCommands.length > 0 && (
                        <div className="rounded-2xl p-6 bg-sparkle-card/30 backdrop-blur-sm border border-sparkle-border">
                            <div className="flex items-center justify-between mb-6">
                                <div>
                                    <h2 className="text-lg font-bold text-sparkle-text flex items-center gap-2">
                                        <Zap size={20} className="text-yellow-400" />
                                        {toolData?.displayName} Commands
                                    </h2>
                                    <p className="text-sparkle-text-muted text-sm mt-1">
                                        Useful commands for working with {toolData?.displayName}
                                    </p>
                                </div>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="bg-sparkle-accent/10 hover:bg-sparkle-accent/20 text-sparkle-accent border border-sparkle-accent/20"
                                    onClick={handleOpenTerminalWithContext}
                                >
                                    <Terminal size={14} className="mr-2" />
                                    Open Terminal
                                </Button>
                            </div>

                            <div className="space-y-3">
                                {templateCommands.map((item, index) => (
                                    <div
                                        key={index}
                                        className="group rounded-xl bg-black/30 border border-sparkle-border hover:border-sparkle-border transition-all overflow-hidden"
                                    >
                                        <div className="flex items-center justify-between p-4">
                                            <div className="flex-1 min-w-0 mr-4">
                                                <code className="text-sm font-mono text-sparkle-accent block mb-1">
                                                    {item.command}
                                                </code>
                                                {item.description && (
                                                    <p className="text-xs text-sparkle-text-secondary">
                                                        {item.description}
                                                    </p>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-2 shrink-0">
                                                <button
                                                    onClick={() => handleRunCommand(item.command)}
                                                    className="flex items-center gap-2 px-4 py-2 rounded-lg transition-all bg-gradient-to-r from-green-500/20 to-emerald-500/20 text-green-400 hover:from-green-500/30 hover:to-emerald-500/30 border border-green-500/30 hover:border-green-400/50 shadow-lg shadow-green-500/10 hover:shadow-green-500/20 font-medium text-sm"
                                                    title="Run in terminal"
                                                >
                                                    <CirclePlay size={16} />
                                                    <span>Run</span>
                                                </button>
                                                <button
                                                    onClick={() => handleCopy(item.command, `template-${index}`)}
                                                    className={cn(
                                                        "p-2.5 rounded-lg transition-all",
                                                        copiedItem === `template-${index}`
                                                            ? "bg-green-500/20 text-green-400"
                                                            : "bg-sparkle-card text-sparkle-text-muted hover:bg-sparkle-card hover:text-sparkle-text"
                                                    )}
                                                    title="Copy command"
                                                >
                                                    {copiedItem === `template-${index}` ? <Check size={16} /> : <Copy size={16} />}
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* About Card */}
                    <div className="rounded-2xl p-6 bg-sparkle-card/30 backdrop-blur-sm border border-sparkle-border">
                        <h2 className="text-lg font-bold text-sparkle-text mb-4">About</h2>
                        {isLoading && !toolData?.description ? (
                            <div className="flex flex-col gap-3 animate-pulse">
                                <div className="h-4 bg-sparkle-card rounded w-3/4"></div>
                                <div className="h-4 bg-sparkle-card rounded w-1/2"></div>
                            </div>
                        ) : (
                            <p className="text-sparkle-text-secondary leading-relaxed">
                                {toolData?.description || "Description unavailable for this tool."}
                            </p>
                        )}

                        {toolData?.usedFor && toolData.usedFor.length > 0 && (
                            <div className="mt-6 pt-4 border-t border-sparkle-border">
                                <p className="text-xs font-semibold text-sparkle-text-muted uppercase tracking-widest mb-3">Use Cases</p>
                                <div className="flex flex-wrap gap-2">
                                    {toolData.usedFor.map((tag: string) => (
                                        <span key={tag} className="px-3 py-1.5 rounded-lg text-sm bg-sparkle-card text-sparkle-text-secondary">
                                            {tag}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Installation Guide (if not installed) */}
                    {!toolData?.installed && (
                        <div className="rounded-2xl p-6 bg-yellow-500/5 border border-yellow-500/20">
                            <h2 className="text-lg font-bold text-yellow-400 mb-4 flex items-center gap-2">
                                <Download size={20} />
                                Installation Required
                            </h2>
                            <p className="text-yellow-400/70 mb-4">
                                This tool is not installed on your system. Install it to unlock full functionality.
                            </p>

                            {toolData?.installCommand && (
                                <div className="bg-black/30 rounded-xl p-4 font-mono text-sm">
                                    <div className="flex items-center justify-between">
                                        <code className="text-yellow-300">{toolData.installCommand}</code>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className={cn(
                                                "h-8 w-8 p-0",
                                                copiedItem === 'install-guide' ? "text-green-400" : "text-yellow-400/60 hover:text-yellow-400"
                                            )}
                                            onClick={() => handleCopy(toolData.installCommand, 'install-guide')}
                                        >
                                            {copiedItem === 'install-guide' ? <Check size={16} /> : <Copy size={16} />}
                                        </Button>
                                    </div>
                                </div>
                            )}

                            {toolData?.website && (
                                <a
                                    href={toolData.website}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex items-center gap-2 mt-4 text-yellow-400 hover:text-yellow-300 text-sm"
                                >
                                    Visit official website
                                    <ExternalLink size={14} />
                                </a>
                            )}
                        </div>
                    )}
                </div>

                {/* Sidebar */}
                <div className="space-y-6">
                    {/* Status Card */}
                    <div className="rounded-2xl p-6 bg-sparkle-card/30 backdrop-blur-sm border border-sparkle-border">
                        <h3 className="text-xs font-bold text-sparkle-text-muted uppercase tracking-widest mb-4">Status</h3>

                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-sparkle-text-secondary">Installed</span>
                                <span className={cn(
                                    "flex items-center gap-1.5 text-sm font-medium",
                                    toolData?.installed ? "text-green-400" : "text-red-400"
                                )}>
                                    {toolData?.installed ? <CheckCircle size={14} /> : <XCircle size={14} />}
                                    {toolData?.installed ? 'Yes' : 'No'}
                                </span>
                            </div>

                            <div className="flex items-center justify-between">
                                <span className="text-sm text-sparkle-text-secondary">Health</span>
                                <span className={cn("text-sm font-medium capitalize", statusColor)}>
                                    {toolData?.status || 'Unknown'}
                                </span>
                            </div>

                            {toolData?.version && toolData.installed && (
                                <div className="flex items-center justify-between">
                                    <span className="text-sm text-sparkle-text-secondary">Version</span>
                                    <span className="text-sm font-mono text-sparkle-text">{toolData.version}</span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* System Info */}
                    <div className="rounded-2xl p-6 bg-sparkle-card/30 backdrop-blur-sm border border-sparkle-border">
                        <h3 className="text-xs font-bold text-sparkle-text-muted uppercase tracking-widest mb-4">System</h3>

                        <div className="space-y-4">
                            <div>
                                <span className="text-xs text-sparkle-text-muted block mb-1">Command</span>
                                <code className="text-sm font-mono text-sparkle-accent bg-sparkle-accent/10 px-2 py-1 rounded block">
                                    {toolData?.command || toolData?.tool || 'unknown'}
                                </code>
                            </div>

                            {toolData?.path && (
                                <div>
                                    <span className="text-xs text-sparkle-text-muted block mb-1">Path</span>
                                    <code className="text-xs font-mono text-sparkle-text-secondary bg-sparkle-card px-2 py-1 rounded block truncate" title={toolData.path}>
                                        {toolData.path}
                                    </code>
                                </div>
                            )}

                            <div>
                                <span className="text-xs text-sparkle-text-muted block mb-1">Category</span>
                                <span className="text-sm text-sparkle-text-secondary capitalize">{toolData?.category?.replace('_', ' ') || 'Unknown'}</span>
                            </div>
                        </div>
                    </div>

                    {/* Quick Links */}
                    <div className="rounded-2xl p-6 bg-sparkle-card/30 backdrop-blur-sm border border-sparkle-border">
                        <h3 className="text-xs font-bold text-sparkle-text-muted uppercase tracking-widest mb-4">Links</h3>

                        <div className="space-y-3">
                            {toolData?.website && (
                                <a
                                    href={toolData.website}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="flex items-center justify-between p-3 rounded-xl bg-sparkle-card hover:bg-sparkle-card transition-all group"
                                >
                                    <span className="text-sm text-sparkle-text-secondary group-hover:text-sparkle-text">Website</span>
                                    <ExternalLink size={14} className="text-sparkle-text-muted group-hover:text-sparkle-text" />
                                </a>
                            )}

                            {toolData?.docsUrl && (
                                <a
                                    href={toolData.docsUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="flex items-center justify-between p-3 rounded-xl bg-sparkle-card hover:bg-sparkle-card transition-all group"
                                >
                                    <span className="text-sm text-sparkle-text-secondary group-hover:text-sparkle-text">Documentation</span>
                                    <ExternalLink size={14} className="text-sparkle-text-muted group-hover:text-sparkle-text" />
                                </a>
                            )}

                            {!toolData?.website && !toolData?.docsUrl && (
                                <p className="text-sm text-sparkle-text-muted italic">No links available</p>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

