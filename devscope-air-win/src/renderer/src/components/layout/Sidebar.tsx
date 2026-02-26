/**
 * DevScope Air - Sidebar Navigation
 */

import { useLocation, useNavigate } from 'react-router-dom'
import { Settings, FolderOpen, House, ChevronLeft, ChevronRight, Bot, Activity } from 'lucide-react'
import { cn } from '@/lib/utils'
import { createContext, useCallback, useEffect, useContext, type ReactNode } from 'react'
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
    { id: 'tasks', label: 'Tasks', path: '/tasks', icon: Activity },
    { id: 'assistant', label: 'Assistant', path: '/assistant', icon: Bot },
    { id: 'settings', label: 'Settings', path: '/settings', icon: Settings }
]

const LAST_PROJECTS_ROUTE_KEY = 'devscope:last-projects-route:v1'

function isProjectsAreaPath(pathname: string): boolean {
    return (
        pathname === '/projects'
        || pathname.startsWith('/projects/')
        || pathname.startsWith('/folder-browse/')
    )
}

function getProjectsRestorePath(): string {
    try {
        const stored = localStorage.getItem(LAST_PROJECTS_ROUTE_KEY)
        if (stored && isProjectsAreaPath(stored)) return stored
    } catch {
        // Ignore storage read errors.
    }
    return '/projects'
}

export default function Sidebar() {
    const location = useLocation()
    const navigate = useNavigate()
    const { isCollapsed, setIsCollapsed } = useSidebar()
    const { settings } = useSettings()
    const visibleNavItems = settings.tasksPageEnabled
        ? NAV_ITEMS
        : NAV_ITEMS.filter((item) => item.id !== 'tasks')

    useEffect(() => {
        if (!isProjectsAreaPath(location.pathname)) return
        try {
            localStorage.setItem(LAST_PROJECTS_ROUTE_KEY, location.pathname)
        } catch {
            // Ignore storage write errors.
        }
    }, [location.pathname])

    const handleNavClick = useCallback((item: NavItem) => {
        if (item.id === 'projects') {
            navigate(getProjectsRestorePath())
            return
        }
        navigate(item.path)
    }, [navigate])

    return (
        <nav className={cn(
            "h-[calc(100vh-46px)] fixed left-0 top-[46px] flex flex-col py-4 border-r border-sparkle-border-secondary bg-sparkle-bg z-40 transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]",
            isCollapsed ? "w-16" : "w-64"
        )}>
            <div className="flex-1 flex flex-col gap-1 px-3">
                {visibleNavItems.map((item) => {
                    const isActive = item.id === 'projects'
                        ? isProjectsAreaPath(location.pathname)
                        : location.pathname === item.path || location.pathname.startsWith(item.path + '/')
                    const Icon = item.icon

                    return (
                        <button
                            key={item.id}
                            onClick={() => handleNavClick(item)}
                            title={isCollapsed ? item.label : undefined}
                            className={cn(
                                'group flex items-center h-10 rounded-lg transition-all duration-300 ease-out text-left relative overflow-hidden',
                                isActive
                                    ? 'bg-[var(--accent-primary)]/10 text-[var(--accent-primary)]'
                                    : 'text-sparkle-text-secondary hover:bg-white/[0.04] hover:text-sparkle-text'
                            )}
                        >
                            {/* Active Indicator Strip */}
                            <div className={cn(
                                "absolute left-0 w-1 bg-[var(--accent-primary)] transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] rounded-r-full",
                                isActive ? "h-5 opacity-100" : "h-0 opacity-0"
                            )} />

                            <div className="flex items-center min-w-[40px] h-full">
                                {/* Fixed Width Icon Container for stability */}
                                <div className="w-10 h-10 flex items-center justify-center shrink-0">
                                    <Icon size={18} className={cn(
                                        "transition-transform duration-300",
                                        isActive && "scale-110"
                                    )} />
                                </div>

                                <span className={cn(
                                    "text-sm font-medium whitespace-nowrap transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]",
                                    isCollapsed
                                        ? "opacity-0 -translate-x-2 pointer-events-none invisible"
                                        : "opacity-100 translate-x-0 visible ml-0.5"
                                )}>
                                    {item.label}
                                </span>
                            </div>
                        </button>
                    )
                })}
            </div>

            <div className={cn(
                "pt-4 mt-2 border-t border-sparkle-border-secondary transition-all duration-300",
                isCollapsed ? "px-3" : "px-4"
            )}>
                <div className="flex items-center justify-between gap-2 h-8">
                    {!isCollapsed && (
                        <p className="text-[10px] text-sparkle-text-muted flex-1 whitespace-nowrap transition-all duration-300 animate-fadeIn overflow-hidden uppercase tracking-wider font-medium">
                            DevScope Air v1.0.0
                        </p>
                    )}
                    <button
                        onClick={() => setIsCollapsed(!isCollapsed)}
                        title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
                        className={cn(
                            "p-1.5 rounded-md hover:bg-white/[0.04] text-sparkle-text-muted hover:text-[var(--accent-primary)] transition-all duration-300 shrink-0",
                            isCollapsed && "mx-auto"
                        )}
                    >
                        {isCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
                    </button>
                </div>
            </div>
        </nav>
    )
}
