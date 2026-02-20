/**
 * DevScope Air - Sidebar Navigation
 */

import { useLocation, useNavigate } from 'react-router-dom'
import { Settings, FolderOpen, House, ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { createContext, useContext, type ReactNode } from 'react'
import { useSettings } from '@/lib/settings'

interface SidebarContextType {
    isCollapsed: boolean
    setIsCollapsed: (collapsed: boolean) => void
}

const SidebarContext = createContext<SidebarContextType | undefined>(undefined)

export function useSidebar() {
    const context = useContext(SidebarContext)
    if (!context) {
        throw new Error('useSidebar must be used within SidebarProvider')
    }
    return context
}

export function SidebarProvider({ children }: { children: ReactNode }) {
    const { settings, updateSettings } = useSettings()

    const setIsCollapsed = (collapsed: boolean) => {
        updateSettings({ sidebarCollapsed: collapsed })
    }

    const isCollapsed = settings.sidebarCollapsed

    return (
        <SidebarContext.Provider value={{ isCollapsed, setIsCollapsed }}>
            {children}
        </SidebarContext.Provider>
    )
}

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
    const { isCollapsed, setIsCollapsed } = useSidebar()

    return (
        <nav className={cn(
            "h-[calc(100vh-46px)] fixed left-0 top-[46px] flex flex-col py-4 border-r border-sparkle-border-secondary bg-sparkle-bg z-40 transition-[width] duration-300 ease-in-out",
            isCollapsed ? "w-16" : "w-64"
        )}>
            <div className="flex-1 flex flex-col gap-1 px-3">
                {NAV_ITEMS.map((item) => {
                    const isActive = location.pathname === item.path || location.pathname.startsWith(item.path + '/')
                    const Icon = item.icon

                    return (
                        <button
                            key={item.id}
                            onClick={() => navigate(item.path)}
                            title={isCollapsed ? item.label : undefined}
                            className={cn(
                                'flex items-center gap-3 py-2.5 rounded-lg transition-all duration-300 ease-in-out text-left relative overflow-hidden',
                                !isCollapsed && 'border-l-4 px-3',
                                isCollapsed && 'justify-center pl-1',
                                isActive
                                    ? 'bg-[var(--accent-primary)]/10 text-[var(--accent-primary)]'
                                    : 'text-sparkle-text-secondary hover:bg-sparkle-border-secondary hover:text-sparkle-text',
                                isActive && !isCollapsed && 'border-[var(--accent-primary)]',
                                !isActive && !isCollapsed && 'border-transparent'
                            )}
                        >
                            <Icon size={18} className="shrink-0" />
                            <span className={cn(
                                "text-sm font-medium whitespace-nowrap transition-all duration-300 ease-in-out",
                                isCollapsed ? "opacity-0 w-0" : "opacity-100 w-auto"
                            )}>
                                {item.label}
                            </span>
                        </button>
                    )
                })}
            </div>

            <div className="px-4 pt-4 mt-2 border-t border-sparkle-border-secondary transition-all duration-300 ease-in-out">
                <div className="flex items-center justify-between gap-2">
                    <p className={cn(
                        "text-xs text-sparkle-text-muted flex-1 whitespace-nowrap transition-all duration-300 ease-in-out overflow-hidden",
                        isCollapsed ? "opacity-0 w-0" : "opacity-100 w-auto"
                    )}>
                        DevScope Air v1.0.0
                    </p>
                    <button
                        onClick={() => setIsCollapsed(!isCollapsed)}
                        title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
                        className="p-1.5 rounded hover:bg-sparkle-border-secondary text-sparkle-text-muted hover:text-sparkle-text transition-colors shrink-0"
                    >
                        {isCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
                    </button>
                </div>
            </div>
        </nav>
    )
}
