/**
 * DevScope - Sidebar Navigation
 */

import { useLocation, useNavigate } from 'react-router-dom'
import { Home, Wrench, Bot, Sparkles, Server, Settings, RefreshCw, Terminal, FolderOpen } from 'lucide-react'
import { cn } from '@/lib/utils'
import { updateCache } from '@/lib/refreshCache'
import { useState } from 'react'
import { useTerminal } from '@/App'

interface NavItem {
    id: string
    label: string
    path: string
    icon: typeof Home
}

const NAV_ITEMS: NavItem[] = [
    { id: 'home', label: 'Dashboard', path: '/', icon: Home },
    { id: 'devtools', label: 'Dev Tools', path: '/devtools', icon: Wrench },
    { id: 'ai-agents', label: 'AI Agents', path: '/ai-agents', icon: Sparkles },
    { id: 'ai', label: 'AI Runtime', path: '/ai', icon: Bot },
    { id: 'projects', label: 'Projects', path: '/projects', icon: FolderOpen },
    { id: 'system', label: 'System', path: '/system', icon: Server },
    { id: 'settings', label: 'Settings', path: '/settings', icon: Settings }
]

export default function Sidebar() {
    const location = useLocation()
    const navigate = useNavigate()
    const [isRefreshing, setIsRefreshing] = useState(false)

    const { isOpen: terminalOpen, openTerminal, closeTerminal, activeSessionCount } = useTerminal()

    const handleRefresh = async () => {
        setIsRefreshing(true)
        try {
            const data = await window.devscope.refreshAll()
            updateCache(data)
            // Trigger a re-render in the current page with fresh data
            window.dispatchEvent(new CustomEvent('devscope:refresh', { detail: data }))
        } finally {
            setTimeout(() => setIsRefreshing(false), 500)
        }
    }

    return (
        <nav className="h-[calc(100vh-46px)] w-64 fixed left-0 top-[46px] flex flex-col py-4 border-r border-sparkle-border-secondary bg-sparkle-bg z-40">
            {/* Navigation Items */}
            <div className="flex-1 flex flex-col gap-1 px-3">
                {NAV_ITEMS.map((item) => {
                    // Exact match for home, prefix match for others (but check longer paths first due to ordering)
                    const isActive = item.path === '/'
                        ? location.pathname === '/'
                        : location.pathname === item.path || location.pathname.startsWith(item.path + '/')
                    const Icon = item.icon

                    return (
                        <button
                            key={item.id}
                            onClick={() => navigate(item.path)}
                            className={cn(
                                'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 border text-left',
                                isActive
                                    ? 'bg-sparkle-primary/10 border-sparkle-primary/30 text-sparkle-primary'
                                    : 'text-sparkle-text-secondary hover:bg-sparkle-border-secondary hover:text-sparkle-text border-transparent'
                            )}
                        >
                            <Icon size={18} />
                            <span className="text-sm font-medium">{item.label}</span>
                        </button>
                    )
                })}
            </div>

            {/* Refresh Button */}
            <div className="px-3 mt-auto space-y-1">
                {/* Terminal Button */}
                <button
                    onClick={() => terminalOpen ? closeTerminal() : openTerminal()}
                    className={cn(
                        "flex items-center gap-3 w-full px-3 py-2.5 rounded-lg transition-all duration-200 border relative",
                        terminalOpen
                            ? "bg-sparkle-accent/10 border-sparkle-accent/30 text-sparkle-accent"
                            : "text-sparkle-text-secondary hover:bg-sparkle-border-secondary hover:text-sparkle-text border-transparent"
                    )}
                >
                    <Terminal size={18} />
                    <span className="text-sm font-medium">Terminal</span>

                    {activeSessionCount > 0 && (
                        <span className="ml-auto flex items-center justify-center min-w-[20px] h-5 px-1.5 text-[10px] font-bold rounded-full bg-[var(--accent-primary)] text-white shadow-sm border border-white/10">
                            {activeSessionCount}
                        </span>
                    )}

                    {activeSessionCount === 0 && (
                        <span className="ml-auto text-xs text-white/30 hidden hover:block">Ctrl+`</span>
                    )}
                </button>

                <button
                    onClick={handleRefresh}
                    disabled={isRefreshing}
                    className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg transition-all duration-200 text-sparkle-text-secondary hover:bg-sparkle-border-secondary hover:text-sparkle-text border border-transparent disabled:opacity-50"
                >
                    <RefreshCw size={18} className={cn(isRefreshing && 'animate-spin')} />
                    <span className="text-sm font-medium">
                        {isRefreshing ? 'Refreshing...' : 'Refresh All'}
                    </span>
                </button>
            </div>

            {/* Footer */}
            <div className="px-4 pt-4 mt-2 border-t border-sparkle-border-secondary">
                <p className="text-xs text-sparkle-text-muted text-center">
                    DevScope v1.0.0
                </p>
            </div>
        </nav>
    )
}
