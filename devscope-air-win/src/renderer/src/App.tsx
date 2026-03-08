// ... imports
import { useRef, lazy, Suspense, useEffect, useMemo, createContext, useContext, type ReactNode } from 'react'
import { HashRouter, Routes, Route, useLocation, Navigate, useNavigate } from 'react-router-dom'
import TitleBar from './components/layout/TitleBar'
import Sidebar, { SidebarProvider, useSidebar } from './components/layout/Sidebar'
import { useSmoothScroll } from './lib/useSmoothScroll'
import { LoadingSpinner } from './components/ui/LoadingState'
import { SettingsProvider, useSettings } from './lib/settings'
import { CommandPaletteProvider } from './lib/commandPalette'
import CommandPalette from './components/CommandPalette'
import LinkHoverStatus from './components/ui/LinkHoverStatus'
import { REMOTE_ACCESS_ENABLED } from '@shared/feature-flags'

const Settings = lazy(() => import('./pages/Settings'))
const Home = lazy(() => import('./pages/Home'))
const Tasks = lazy(() => import('./pages/Tasks'))
const ProjectDetails = lazy(() => import('./pages/ProjectDetails'))
const FolderBrowse = lazy(() => import('./pages/FolderBrowse'))
const QuickOpen = lazy(() => import('./pages/QuickOpen'))

// Settings sub-pages
const AppearanceSettings = lazy(() => import('./pages/settings/AppearanceSettings'))
const BehaviorSettings = lazy(() => import('./pages/settings/BehaviorSettings'))
const DataSettings = lazy(() => import('./pages/settings/DataSettings'))
const AboutSettings = lazy(() => import('./pages/settings/AboutSettings'))
const ProjectsSettings = lazy(() => import('./pages/settings/ProjectsSettings'))
const AISettings = lazy(() => import('./pages/settings/AISettings'))
const TerminalSettings = lazy(() => import('./pages/settings/TerminalSettings'))
const LogsSettings = lazy(() => import('./pages/settings/LogsSettings'))
const RemoteAccessSettings = lazy(() => import('./pages/settings/RemoteAccessSettings'))
const LAST_MAIN_TAB_KEY = 'devscope:last-main-tab:v1'

// Terminal Context
interface TerminalContextType {
    isOpen: boolean
    openTerminal: (tool?: { id: string; category: string; displayName: string } | null, cwd?: string, initialCommand?: string) => void
    closeTerminal: () => void
    contextTool: { id: string; category: string; displayName: string } | null
    terminalCwd: string | null
    terminalCommand: string | null
    activeSessionCount: number
}

const BASE_TERMINAL_CONTEXT: TerminalContextType = {
    isOpen: false,
    openTerminal: () => { },
    closeTerminal: () => { },
    contextTool: null,
    terminalCwd: null,
    terminalCommand: null,
    activeSessionCount: 0
}

const TerminalContext = createContext<TerminalContextType>(BASE_TERMINAL_CONTEXT)

export const useTerminal = () => useContext(TerminalContext)

function isProjectsAreaPath(pathname: string): boolean {
    return (
        pathname === '/projects'
        || pathname.startsWith('/projects/')
        || pathname.startsWith('/folder-browse/')
    )
}

function resolveMainTabPath(
    pathname: string,
    options?: { allowTasks?: boolean }
): '/home' | '/projects' | '/settings' | '/tasks' | null {
    const allowTasks = options?.allowTasks !== false
    if (pathname === '/home' || pathname.startsWith('/home/')) return '/home'
    if (allowTasks && (pathname === '/tasks' || pathname.startsWith('/tasks/'))) return '/tasks'
    if (pathname === '/settings' || pathname.startsWith('/settings/')) return '/settings'
    if (isProjectsAreaPath(pathname)) return '/projects'
    return null
}

function readLastMainTabPath(allowTasks: boolean): '/home' | '/projects' | '/settings' | '/tasks' {
    try {
        const stored = String(localStorage.getItem(LAST_MAIN_TAB_KEY) || '').trim()
        const resolved = resolveMainTabPath(stored, { allowTasks })
        if (resolved) return resolved
    } catch {
        // Ignore storage read errors.
    }
    return '/home'
}

function LaunchRedirect() {
    const { settings } = useSettings()
    return <Navigate to={readLastMainTabPath(settings.tasksPageEnabled)} replace />
}

function PageLoader() {
    return <LoadingSpinner message="Loading page..." />
}

function MainContent() {
    const mainRef = useRef<HTMLElement>(null!)
    const location = useLocation()
    const navigate = useNavigate()
    const isSettingsRoute = location.pathname.startsWith('/settings')
    const isProjectsAreaRoute = isProjectsAreaPath(location.pathname)
    const { isCollapsed } = useSidebar()
    const { settings } = useSettings()

    const { targetY, currentY, animationFrame, isAnimating } = useSmoothScroll(mainRef, {
        ease: 0.12,
        enabled: settings.scrollMode === 'smooth'
    })

    // Reset scroll to top when route changes
    useEffect(() => {
        if (animationFrame.current) {
            cancelAnimationFrame(animationFrame.current)
            animationFrame.current = null
        }
        isAnimating.current = false

        targetY.current = 0
        currentY.current = 0
        if (mainRef.current) {
            mainRef.current.scrollTop = 0
        }
    }, [location.pathname])

    useEffect(() => {
        const mainTabPath = resolveMainTabPath(location.pathname, { allowTasks: settings.tasksPageEnabled })
        if (!mainTabPath) return
        try {
            localStorage.setItem(LAST_MAIN_TAB_KEY, mainTabPath)
        } catch {
            // Ignore storage write errors.
        }
    }, [location.pathname, settings.tasksPageEnabled])

    useEffect(() => {
        if (settings.tasksPageEnabled) return
        if (!location.pathname.startsWith('/tasks')) return
        navigate('/home', { replace: true })
    }, [settings.tasksPageEnabled, location.pathname, navigate])

    return (
        <main
            ref={mainRef}
            className={`flex-1 min-h-0 focus:outline-none transition-[margin-left] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] overflow-y-auto overflow-x-hidden p-6${isSettingsRoute ? '' : ' theme-adaptive'} ${isCollapsed ? 'ml-16' : 'ml-64'}`}
            tabIndex={0}
        >
            <Suspense fallback={<PageLoader />}>
                <Routes>
                    <Route path="/" element={<LaunchRedirect />} />
                    <Route path="/home" element={<Home />} />
                    <Route path="/projects" element={<FolderBrowse />} />
                    <Route
                        path="/tasks"
                        element={settings.tasksPageEnabled ? <Tasks /> : <Navigate to="/home" replace />}
                    />
                    <Route path="/projects/:projectPath" element={<ProjectDetails />} />
                    <Route path="/folder-browse/:folderPath" element={<FolderBrowse />} />
                    <Route path="/settings" element={<Settings />} />
                    <Route path="/settings/appearance" element={<AppearanceSettings />} />
                    <Route path="/settings/behavior" element={<BehaviorSettings />} />
                    <Route path="/settings/data" element={<DataSettings />} />
                    <Route path="/settings/about" element={<AboutSettings />} />
                    <Route path="/settings/projects" element={<ProjectsSettings />} />
                    <Route path="/settings/ai" element={<AISettings />} />
                    <Route path="/settings/git" element={<Navigate to="/settings" replace />} />
                    <Route path="/settings/terminal" element={<TerminalSettings />} />
                    <Route path="/settings/logs" element={<LogsSettings />} />
                    <Route
                        path="/settings/remote-access"
                        element={REMOTE_ACCESS_ENABLED ? <RemoteAccessSettings /> : <Navigate to="/settings" replace />}
                    />
                    <Route path="/assistant" element={<Navigate to="/home" replace />} />
                    <Route path="/assistant/skills" element={<Navigate to="/home" replace />} />
                    <Route path="/skills" element={<Navigate to="/home" replace />} />
                    <Route path="/settings/assistant" element={<Navigate to="/settings" replace />} />
                    <Route path="/settings/account" element={<Navigate to="/settings/ai" replace />} />
                    <Route path="/settings/usage" element={<Navigate to="/settings/ai" replace />} />
                    <Route path="*" element={<LaunchRedirect />} />
                </Routes>
            </Suspense>
        </main>
    )
}

function TerminalContextProvider({ children }: { children: ReactNode }) {
    const { settings } = useSettings()

    const openTerminal: TerminalContextType['openTerminal'] = (_tool, cwd, initialCommand) => {
        if (!cwd) {
            window.alert('Terminal can only be opened from a project or folder path in DevScope Air.')
            return
        }

        void window.devscope
            .openInTerminal(cwd, settings.defaultShell, initialCommand)
            .then((result) => {
                if (!result?.success) {
                    window.alert(result?.error || 'Failed to open terminal.')
                }
            })
            .catch((err: any) => {
                window.alert(err?.message || 'Failed to open terminal.')
            })
    }

    const terminalContextValue: TerminalContextType = {
        ...BASE_TERMINAL_CONTEXT,
        openTerminal
    }

    return (
        <TerminalContext.Provider value={terminalContextValue}>
            {children}
        </TerminalContext.Provider>
    )
}

function App() {
    return (
        <SettingsProvider>
            <CommandPaletteProvider>
                <TerminalContextProvider>
                    <HashRouter>
                        <AppContent />
                        <CommandPalette />
                    </HashRouter>
                </TerminalContextProvider>
            </CommandPaletteProvider>
        </SettingsProvider>
    )
}

function AppContent() {
    const location = useLocation()
    const { settings } = useSettings()
    const foldersToIndex = useMemo(() => {
        return Array.from(new Set([
            settings.projectsFolder,
            ...(settings.additionalFolders || [])
        ].filter((folder): folder is string => typeof folder === 'string' && folder.trim().length > 0)))
    }, [settings.projectsFolder, settings.additionalFolders])

    useEffect(() => {
        if (!settings.enableFolderIndexing || !settings.autoIndexOnStartup) return
        if (foldersToIndex.length === 0) return

        // Defer startup indexing so initial UI remains interactive.
        const timer = window.setTimeout(() => {
            void window.devscope.indexAllFolders(foldersToIndex).catch((err: any) => {
                console.error('Auto-index on startup failed:', err)
            })
        }, 1200)

        return () => {
            window.clearTimeout(timer)
        }
    }, [settings.enableFolderIndexing, settings.autoIndexOnStartup, foldersToIndex])

    if (location.pathname === '/quick-open') {
        return (
            <Suspense fallback={<PageLoader />}>
                <QuickOpen />
            </Suspense>
        )
    }

    return (
        <div className={`flex flex-col h-screen bg-sparkle-bg text-sparkle-text overflow-hidden ${settings.compactMode ? 'compact-mode' : ''}`}>
            <TitleBar />
            <SidebarProvider>
                <div className="flex flex-1 pt-[46px] min-h-0">
                    <Sidebar />
                    <MainContent />
                </div>
            </SidebarProvider>
            <LinkHoverStatus />
        </div>
    )
}

export default App
