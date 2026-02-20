// ... imports
import { useRef, lazy, Suspense, useEffect, useMemo, createContext, useContext, type ReactNode } from 'react'
import { HashRouter, Routes, Route, useLocation, Navigate } from 'react-router-dom'
import TitleBar from './components/layout/TitleBar'
import Sidebar, { SidebarProvider, useSidebar } from './components/layout/Sidebar'
import { useSmoothScroll } from './lib/useSmoothScroll'
import { LoadingSpinner } from './components/ui/LoadingState'
import { SettingsProvider, useSettings } from './lib/settings'
import { CommandPaletteProvider } from './lib/commandPalette'
import CommandPalette from './components/CommandPalette'
import LinkHoverStatus from './components/ui/LinkHoverStatus'

const Settings = lazy(() => import('./pages/Settings'))
const Home = lazy(() => import('./pages/Home'))
const Projects = lazy(() => import('./pages/Projects'))
const ProjectDetails = lazy(() => import('./pages/ProjectDetails'))
const FolderBrowse = lazy(() => import('./pages/FolderBrowse'))

// Settings sub-pages
const AppearanceSettings = lazy(() => import('./pages/settings/AppearanceSettings'))
const BehaviorSettings = lazy(() => import('./pages/settings/BehaviorSettings'))
const DataSettings = lazy(() => import('./pages/settings/DataSettings'))
const AboutSettings = lazy(() => import('./pages/settings/AboutSettings'))
const ProjectsSettings = lazy(() => import('./pages/settings/ProjectsSettings'))
const AISettings = lazy(() => import('./pages/settings/AISettings'))
const TerminalSettings = lazy(() => import('./pages/settings/TerminalSettings'))
const LogsSettings = lazy(() => import('./pages/settings/LogsSettings'))

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

function PageLoader() {
    return <LoadingSpinner message="Loading page..." />
}

function MainContent() {
    const mainRef = useRef<HTMLElement>(null)
    const location = useLocation()
    const isSettingsRoute = location.pathname.startsWith('/settings')
    const { isCollapsed } = useSidebar()

    const { targetY, currentY, animationFrame, isAnimating } = useSmoothScroll(mainRef, { ease: 0.12 })

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

    return (
        <main
            ref={mainRef}
            className={`flex-1 p-6 overflow-y-auto overflow-x-hidden min-h-0 focus:outline-none transition-[margin] duration-300 ease-in-out${isSettingsRoute ? '' : ' theme-adaptive'} ${isCollapsed ? 'ml-16' : 'ml-64'}`}
            tabIndex={0}
        >
            <Suspense fallback={<PageLoader />}>
                <Routes>
                    <Route path="/" element={<Navigate to="/home" replace />} />
                    <Route path="/home" element={<Home />} />
                    <Route path="/projects" element={<Projects />} />
                    <Route path="/projects/:projectPath" element={<ProjectDetails />} />
                    <Route path="/folder-browse/:folderPath" element={<FolderBrowse />} />
                    <Route path="/settings" element={<Settings />} />
                    <Route path="/settings/appearance" element={<AppearanceSettings />} />
                    <Route path="/settings/behavior" element={<BehaviorSettings />} />
                    <Route path="/settings/data" element={<DataSettings />} />
                    <Route path="/settings/about" element={<AboutSettings />} />
                    <Route path="/settings/projects" element={<ProjectsSettings />} />
                    <Route path="/settings/ai" element={<AISettings />} />
                    <Route path="/settings/terminal" element={<TerminalSettings />} />
                    <Route path="/settings/logs" element={<LogsSettings />} />
                    <Route path="*" element={<Navigate to="/home" replace />} />
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
