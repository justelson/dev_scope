/**
 * DevScope Air - Sidebar Navigation
 */

import { useLocation, useNavigate } from 'react-router-dom'
import { Settings, FolderOpen, House } from 'lucide-react'
import { cn } from '@/lib/utils'

interface NavItem {
    id: string
    label: string
    path: string
    icon: typeof FolderOpen
}

const NAV_ITEMS: NavItem[] = [
    { id: 'home', label: 'Home', path: '/home', icon: House },
    { id: 'projects', label: 'Projects', path: '/projects', icon: FolderOpen },
    { id: 'settings', label: 'Settings', path: '/settings', icon: Settings }
]

export default function Sidebar() {
    const location = useLocation()
    const navigate = useNavigate()

    return (
        <nav className="h-[calc(100vh-46px)] w-64 fixed left-0 top-[46px] flex flex-col py-4 border-r border-sparkle-border-secondary bg-sparkle-bg z-40">
            <div className="flex-1 flex flex-col gap-1 px-3">
                {NAV_ITEMS.map((item) => {
                    const isActive = location.pathname === item.path || location.pathname.startsWith(item.path + '/')
                    const Icon = item.icon

                    return (
                        <button
                            key={item.id}
                            onClick={() => navigate(item.path)}
                            className={cn(
                                'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 border-l-4 text-left relative',
                                isActive
                                    ? 'bg-[var(--accent-primary)]/10 border-[var(--accent-primary)] text-[var(--accent-primary)]'
                                    : 'text-sparkle-text-secondary hover:bg-sparkle-border-secondary hover:text-sparkle-text border-transparent'
                            )}
                        >
                            <Icon size={18} />
                            <span className="text-sm font-medium">{item.label}</span>
                        </button>
                    )
                })}
            </div>

            <div className="px-4 pt-4 mt-2 border-t border-sparkle-border-secondary">
                <p className="text-xs text-sparkle-text-muted text-center">
                    DevScope Air v1.0.0
                </p>
            </div>
        </nav>
    )
}
