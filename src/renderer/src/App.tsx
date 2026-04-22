// ... imports
import { useRef, lazy, Suspense, useEffect, useMemo, useState, createContext, useContext, type ReactNode } from 'react'
import { HashRouter, Routes, Route, useLocation, Navigate, useNavigate } from 'react-router-dom'
import TitleBar from './components/layout/TitleBar'
import Sidebar, { SidebarProvider, useSidebar } from './components/layout/Sidebar'
import { UpdatePromptCenter } from './components/updates/UpdatePromptCenter'
import { useSmoothScroll } from './lib/useSmoothScroll'
import { LoadingSpinner } from './components/ui/LoadingState'
import { AppUpdatesProvider } from './lib/app-updates'
import { SettingsProvider, useSettings } from './lib/settings'
import { CommandPaletteProvider } from './lib/commandPalette'
import CommandPalette from './components/CommandPalette'
import LinkHoverStatus from './components/ui/LinkHoverStatus'

const Settings = lazy(() => import('./pages/Settings'))
const Home = lazy(() => import('./pages/Home'))
const Terminals = lazy(() => import('./pages/Tasks'))
const ProjectDetails = lazy(() => import('./pages/ProjectDetails'))
const FolderBrowse = lazy(() => import('./pages/FolderBrowse'))
const Explorer = lazy(() => import('./pages/Explorer'))
const QuickOpen = lazy(() => import('./pages/QuickOpen'))
const Assistant = lazy(() => import('./pages/Assistant'))

// Settings sub-pages
const AppearanceSettings = lazy(() => import('./pages/settings/AppearanceSettings'))
const BehaviorSettings = lazy(() => import('./pages/settings/BehaviorSettings'))
const AboutSettings = lazy(() => import('./pages/settings/AboutSettings'))
const ProjectsSettings = lazy(() => import('./pages/settings/ProjectsSettings'))
const ExplorerSettings = lazy(() => import('./pages/settings/ExplorerSettings'))
const AISettings = lazy(() => import('./pages/settings/AISettings'))
const AssistantAccountSettings = lazy(() => import('./pages/settings/AssistantAccountSettings'))
const GitSettings = lazy(() => import('./pages/settings/GitSettings'))
const TerminalSettings = lazy(() => import('./pages/settings/TerminalSettings'))
const LogsSettings = lazy(() => import('./pages/settings/LogsSettings'))
const LAST_MAIN_TAB_KEY = 'devscope:last-main-tab:v1'
const LAST_APP_ROUTE_KEY = 'devscope:last-app-route:v1'
const EXTERNAL_EXPLORER_ACCESS_KEY = 'devscope:external-explorer-access:v1'

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

function isExplorerAreaPath(pathname: string): boolean {
    return pathname === '/explorer' || pathname.startsWith('/explorer/')
}

function isAssistantAreaPath(pathname: string): boolean {
    return pathname === '/assistant' || pathname.startsWith('/assistant/')
}

function resolveMainTabPath(
    pathname: string,
    options?: { allowExplorer?: boolean }
): '/home' | '/projects' | '/settings' | '/terminals' | '/explorer' | '/assistant' | null {
    const allowExplorer = options?.allowExplorer === true
    if (pathname === '/home' || pathname.startsWith('/home/')) return '/home'
    if (pathname === '/terminals' || pathname.startsWith('/terminals/')) return '/terminals'
    if (pathname === '/tasks' || pathname.startsWith('/tasks/')) return '/terminals'
    if (allowExplorer && isExplorerAreaPath(pathname)) return '/explorer'
    if (isAssistantAreaPath(pathname)) return '/assistant'
    if (pathname === '/settings' || pathname.startsWith('/settings/')) return '/settings'
    if (isProjectsAreaPath(pathname)) return '/projects'
    return null
}

function readLastMainTabPath(allowExplorer: boolean): '/home' | '/projects' | '/settings' | '/terminals' | '/explorer' | '/assistant' {
    try {
        const stored = String(localStorage.getItem(LAST_MAIN_TAB_KEY) || '').trim()
        const resolved = resolveMainTabPath(stored, { allowExplorer })
        if (resolved) return resolved
    } catch {
        // Ignore storage read errors.
    }
    return '/home'
}

function normalizeRestorableRoute(
    pathname: string,
    options?: { allowExplorer?: boolean }
): string | null {
    const trimmed = String(pathname || '').trim()
    if (!trimmed || trimmed === '/' || trimmed === '/quick-open') return null

    const allowExplorer = options?.allowExplorer === true

    if (trimmed === '/home' || trimmed.startsWith('/home/')) return '/home'
    if (trimmed === '/projects' || trimmed.startsWith('/projects/')) return trimmed
    if (trimmed.startsWith('/folder-browse/')) return trimmed
    if (trimmed === '/settings' || trimmed.startsWith('/settings/')) return trimmed
    if (trimmed === '/terminals' || trimmed.startsWith('/terminals/')) return trimmed
    if (trimmed === '/tasks' || trimmed.startsWith('/tasks/')) return trimmed.replace(/^\/tasks/, '/terminals')
    if (allowExplorer && (trimmed === '/explorer' || trimmed.startsWith('/explorer/'))) return trimmed
    if (trimmed === '/assistant' || trimmed.startsWith('/assistant/')) return trimmed

    return null
}

function readLastLaunchRoute(allowExplorer: boolean): string {
    try {
        const stored = String(localStorage.getItem(LAST_APP_ROUTE_KEY) || '').trim()
        const resolved = normalizeRestorableRoute(stored, { allowExplorer })
        if (resolved) return resolved
    } catch {
        // Ignore storage read errors.
    }

    return readLastMainTabPath(allowExplorer)
}

function hasExternalExplorerLaunchAccess(pathname: string, search: string): boolean {
    if (!isExplorerAreaPath(pathname)) return false
    return new URLSearchParams(search).get('shellLaunch') === '1'
}

function readExternalExplorerLaunchAccess(): boolean {
    try {
        return sessionStorage.getItem(EXTERNAL_EXPLORER_ACCESS_KEY) === '1'
    } catch {
        return false
    }
}

function LaunchRedirect() {
    const { settings } = useSettings()
    return <Navigate to={readLastLaunchRoute(settings.explorerTabEnabled)} replace />
}

function PageLoader() {
    return <LoadingSpinner message="Loading page..." />
}

function MainContent() {
    const mainRef = useRef<HTMLElement>(null!)
    const location = useLocation()
    const navigate = useNavigate()
    const [externalExplorerAccess, setExternalExplorerAccess] = useState<boolean>(() => readExternalExplorerLaunchAccess())
    const isSettingsRoute = location.pathname.startsWith('/settings')
    const { isCollapsed } = useSidebar()
    const { settings } = useSettings()
    const hasRouteLaunchAccess = hasExternalExplorerLaunchAccess(location.pathname, location.search)
    const allowExplorerRoute = settings.explorerTabEnabled || externalExplorerAccess || hasRouteLaunchAccess

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
        const mainTabPath = resolveMainTabPath(location.pathname, {
            allowExplorer: settings.explorerTabEnabled
        })
        if (!mainTabPath) return
        try {
            localStorage.setItem(LAST_MAIN_TAB_KEY, mainTabPath)
        } catch {
            // Ignore storage write errors.
        }
    }, [location.pathname, settings.explorerTabEnabled])

    useEffect(() => {
        const restorableRoute = normalizeRestorableRoute(location.pathname, {
            allowExplorer: settings.explorerTabEnabled
        })
        if (!restorableRoute) return

        try {
            localStorage.setItem(LAST_APP_ROUTE_KEY, restorableRoute)
        } catch {
            // Ignore storage write errors.
        }
    }, [location.pathname, settings.explorerTabEnabled])

    useEffect(() => {
        if (!hasExternalExplorerLaunchAccess(location.pathname, location.search)) return
        setExternalExplorerAccess(true)
        try {
            sessionStorage.setItem(EXTERNAL_EXPLORER_ACCESS_KEY, '1')
        } catch {
            // Ignore storage write errors.
        }
    }, [location.pathname, location.search])

    useEffect(() => {
        if (!location.pathname.startsWith('/tasks')) return
        navigate(location.pathname.replace(/^\/tasks/, '/terminals') || '/terminals', { replace: true })
    }, [location.pathname, navigate])

    useEffect(() => {
        if (allowExplorerRoute) return
        if (!isExplorerAreaPath(location.pathname)) return
        navigate('/home', { replace: true })
    }, [allowExplorerRoute, location.pathname, navigate])

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
                        path="/explorer"
                        element={allowExplorerRoute ? <Explorer /> : <Navigate to="/home" replace />}
                    />
                    <Route
                        path="/explorer/:folderPath"
                        element={allowExplorerRoute ? <Explorer /> : <Navigate to="/home" replace />}
                    />
                    <Route path="/tasks" element={<Navigate to="/terminals" replace />} />
                    <Route path="/tasks/*" element={<Navigate to="/terminals" replace />} />
                    <Route path="/terminals" element={<Terminals />} />
                    <Route path="/projects/:projectPath" element={<ProjectDetails />} />
                    <Route path="/folder-browse/:folderPath" element={<FolderBrowse />} />
                    <Route path="/settings" element={<Settings />} />
                    <Route path="/settings/appearance" element={<AppearanceSettings />} />
                    <Route path="/settings/behavior" element={<BehaviorSettings />} />
                    <Route path="/settings/data" element={<Navigate to="/settings" replace />} />
                    <Route path="/settings/about" element={<AboutSettings />} />
                    <Route path="/settings/projects" element={<ProjectsSettings />} />
                    <Route
                        path="/settings/explorer"
                        element={settings.betaSettingsEnabled ? <ExplorerSettings /> : <Navigate to="/settings" replace />}
                    />
                    <Route path="/settings/ai" element={<AISettings />} />
                    <Route path="/settings/account" element={<AssistantAccountSettings />} />
                    <Route path="/settings/usage" element={<AssistantAccountSettings />} />
                    <Route
                        path="/settings/git"
                        element={settings.betaSettingsEnabled ? <GitSettings /> : <Navigate to="/settings" replace />}
                    />
                    <Route path="/settings/terminal" element={<TerminalSettings />} />
                    <Route path="/settings/logs" element={<LogsSettings />} />
                    <Route path="/assistant" element={<Assistant />} />
                    <Route path="/assistant/skills" element={<Navigate to="/assistant" replace />} />
                    <Route path="/skills" element={<Navigate to="/assistant" replace />} />
                    <Route path="/settings/assistant" element={<Navigate to="/settings/account" replace />} />
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
                        <AppUpdatesProvider>
                            <AppContent />
                            <CommandPalette />
                        </AppUpdatesProvider>
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
    }, [foldersToIndex])

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
            <UpdatePromptCenter />
            <LinkHoverStatus />
        </div>
    )
}

export default App
