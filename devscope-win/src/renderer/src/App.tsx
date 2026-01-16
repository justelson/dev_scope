// ... imports
import { useRef, lazy, Suspense, useEffect, useState, createContext, useContext } from 'react'
import { HashRouter, Routes, Route, useLocation } from 'react-router-dom'
import TitleBar from './components/layout/TitleBar'
import Sidebar from './components/layout/Sidebar'
import { useSmoothScroll } from './lib/useSmoothScroll'
import { LoadingSpinner } from './components/ui/LoadingState'
import { Terminal } from './components/Terminal'
import { SettingsProvider, useSettings } from './lib/settings'
import { CommandPaletteProvider } from './lib/commandPalette'
import CommandPalette from './components/CommandPalette'

// Lazy load pages for faster initial render
const Home = lazy(() => import('./pages/Home'))
const DevTools = lazy(() => import('./pages/DevTools'))
const ToolDetails = lazy(() => import('./pages/ToolDetails'))
const AIRuntime = lazy(() => import('./pages/AIRuntime'))
const AIAgents = lazy(() => import('./pages/AIAgents'))
const System = lazy(() => import('./pages/System'))
const Settings = lazy(() => import('./pages/Settings'))
const Projects = lazy(() => import('./pages/Projects'))
const ProjectDetails = lazy(() => import('./pages/ProjectDetails'))
const FolderBrowse = lazy(() => import('./pages/FolderBrowse'))

// Settings sub-pages
const AppearanceSettings = lazy(() => import('./pages/settings/AppearanceSettings'))
const TerminalSettings = lazy(() => import('./pages/settings/TerminalSettings'))
const BehaviorSettings = lazy(() => import('./pages/settings/BehaviorSettings'))
const ScanningSettings = lazy(() => import('./pages/settings/ScanningSettings'))
const DataSettings = lazy(() => import('./pages/settings/DataSettings'))
const AboutSettings = lazy(() => import('./pages/settings/AboutSettings'))
const ProjectsSettings = lazy(() => import('./pages/settings/ProjectsSettings'))
const AISettings = lazy(() => import('./pages/settings/AISettings'))

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

const TerminalContext = createContext<TerminalContextType>({
    isOpen: false,
    openTerminal: () => { },
    closeTerminal: () => { },
    contextTool: null,
    terminalCwd: null,
    terminalCommand: null,
    activeSessionCount: 0
})

export const useTerminal = () => useContext(TerminalContext)

function PageLoader() {
    return <LoadingSpinner message="Loading page..." />
}

function MainContent() {
    const mainRef = useRef<HTMLElement>(null)
    const location = useLocation()

    const { targetY, currentY, animationFrame, isAnimating } = useSmoothScroll(mainRef, { ease: 0.12 })

    // Reset scroll to top when route changes
    useEffect(() => {
        // Cancel any ongoing animation
        if (animationFrame.current) {
            cancelAnimationFrame(animationFrame.current)
            animationFrame.current = null
        }
        isAnimating.current = false

        // Reset refs and scroll
        targetY.current = 0
        currentY.current = 0
        if (mainRef.current) {
            mainRef.current.scrollTop = 0
        }
    }, [location.pathname])

    return (
        <main
            ref={mainRef}
            className="flex-1 ml-64 p-6 overflow-y-auto min-h-0 focus:outline-none"
            tabIndex={0}
        >
            <Suspense fallback={<PageLoader />}>
                <Routes>
                    <Route path="/" element={<Home />} />
                    <Route path="/devtools" element={<DevTools />} />
                    <Route path="/devtools/:toolId" element={<ToolDetails />} />
                    <Route path="/ai" element={<AIRuntime />} />
                    <Route path="/ai-agents" element={<AIAgents />} />
                    <Route path="/system" element={<System />} />
                    <Route path="/projects" element={<Projects />} />
                    <Route path="/projects/:projectPath" element={<ProjectDetails />} />
                    <Route path="/folder-browse/:folderPath" element={<FolderBrowse />} />
                    <Route path="/settings" element={<Settings />} />
                    <Route path="/settings/appearance" element={<AppearanceSettings />} />
                    <Route path="/settings/terminal" element={<TerminalSettings />} />
                    <Route path="/settings/behavior" element={<BehaviorSettings />} />
                    <Route path="/settings/scanning" element={<ScanningSettings />} />
                    <Route path="/settings/data" element={<DataSettings />} />
                    <Route path="/settings/about" element={<AboutSettings />} />
                    <Route path="/settings/projects" element={<ProjectsSettings />} />
                    <Route path="/settings/ai" element={<AISettings />} />
                </Routes>
            </Suspense>
        </main>
    )
}

function App() {
    const [terminalOpen, setTerminalOpen] = useState(false)
    const [terminalMinimized, setTerminalMinimized] = useState(false)
    const [contextTool, setContextTool] = useState<{ id: string; category: string; displayName: string } | null>(null)
    const [terminalCwd, setTerminalCwd] = useState<string | null>(null)
    const [terminalCommand, setTerminalCommand] = useState<string | null>(null)
    const [activeSessionCount, setActiveSessionCount] = useState(0)

    const openTerminal = (tool?: { id: string; category: string; displayName: string } | null, cwd?: string, initialCommand?: string) => {
        setContextTool(tool || null)
        setTerminalCwd(cwd || null)
        setTerminalCommand(initialCommand || null)
        setTerminalOpen(true)
        setTerminalMinimized(false)
    }

    const closeTerminal = () => {
        setTerminalOpen(false)
        setContextTool(null)
        setTerminalCwd(null)
        setTerminalCommand(null)
    }

    // Keyboard shortcut: Ctrl+` to toggle terminal
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.ctrlKey && e.key === '`') {
                e.preventDefault()
                if (terminalOpen) {
                    closeTerminal()
                } else {
                    openTerminal()
                }
            }
        }
        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [terminalOpen])

    return (
        <SettingsProvider>
            <CommandPaletteProvider>
                <TerminalContext.Provider value={{ isOpen: terminalOpen, openTerminal, closeTerminal, contextTool, terminalCwd, terminalCommand, activeSessionCount }}>
                    <HashRouter>
                        <AppContent
                            terminalOpen={terminalOpen}
                            terminalMinimized={terminalMinimized}
                            setTerminalMinimized={setTerminalMinimized}
                            closeTerminal={closeTerminal}
                            contextTool={contextTool}
                            terminalCwd={terminalCwd}
                            terminalCommand={terminalCommand}
                            onSessionCountChange={setActiveSessionCount}
                        />
                        <CommandPalette />
                    </HashRouter>
                </TerminalContext.Provider>
            </CommandPaletteProvider>
        </SettingsProvider>
    )
}

// Separate component to use settings context
function AppContent({
    terminalOpen,
    terminalMinimized,
    setTerminalMinimized,
    closeTerminal,
    contextTool,
    terminalCwd,
    terminalCommand,
    onSessionCountChange
}: {
    terminalOpen: boolean
    terminalMinimized: boolean
    setTerminalMinimized: (v: boolean) => void
    closeTerminal: () => void
    contextTool: { id: string; category: string; displayName: string } | null
    terminalCwd: string | null
    terminalCommand: string | null
    onSessionCountChange: (count: number) => void
}) {
    const { settings } = useSettings()

    // Auto-refresh based on settings
    useEffect(() => {
        if (settings.autoRefreshInterval === 'manual') return

        const intervalMs = parseInt(settings.autoRefreshInterval) * 60 * 1000

        const doRefresh = async () => {
            try {
                const data = await window.devscope.refreshAll()
                window.dispatchEvent(new CustomEvent('devscope:refresh', { detail: data }))
            } catch (err) {
                console.error('Auto-refresh failed:', err)
            }
        }

        const interval = setInterval(doRefresh, intervalMs)
        return () => clearInterval(interval)
    }, [settings.autoRefreshInterval])

    return (
        <div className={`flex flex-col h-screen bg-sparkle-bg text-sparkle-text overflow-hidden ${settings.compactMode ? 'compact-mode' : ''}`}>
            <TitleBar />
            <div className="flex flex-1 pt-[46px] min-h-0">
                <Sidebar />
                <MainContent />
            </div>
            <Terminal
                isOpen={terminalOpen}
                isVisible={terminalOpen && !terminalMinimized}
                onClose={closeTerminal}
                onMinimize={() => setTerminalMinimized(true)}
                contextTool={contextTool}
                initialCwd={terminalCwd}
                initialCommand={terminalCommand}
                onSessionCountChange={onSessionCountChange}
            />
            {/* Minimized Terminal Tab */}
            {terminalOpen && terminalMinimized && (
                <button
                    onClick={() => setTerminalMinimized(false)}
                    className="fixed bottom-4 right-4 z-50 flex items-center gap-2 px-4 py-2 bg-sparkle-card border border-white/10 rounded-lg shadow-lg hover:bg-white/10 transition-colors"
                >
                    <span className="text-sparkle-accent text-sm">Terminal</span>
                </button>
            )}
        </div>
    )
}

export default App
