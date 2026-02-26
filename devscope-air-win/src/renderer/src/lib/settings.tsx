/**
 * DevScope - Settings Store & Context
 * Manages all app settings with localStorage persistence
 */

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'

// Settings Types
export type Theme = 'dark' | 'light' | 'purple' | 'green' | 'midnight' | 'ocean' | 'forest' | 'slate' | 'charcoal' | 'navy'
export type Shell = 'powershell' | 'cmd'
export type CommitAIProvider = 'groq' | 'gemini'
export type ScrollMode = 'smooth' | 'native'
export type BrowserViewMode = 'grid' | 'finder'
export type BrowserContentLayout = 'grouped' | 'explorer'
export type AssistantProvider = 'codex'
export type AssistantApprovalMode = 'safe' | 'yolo'
export type AssistantProfile = 'safe-dev' | 'review' | 'yolo-fast' | 'custom'
export type FilePreviewDefaultMode = 'preview' | 'edit'
export type FilePreviewPythonRunMode = 'terminal' | 'output'

export interface AccentColor {
    name: string
    primary: string
    secondary: string
}

export const ACCENT_COLORS: AccentColor[] = [
    { name: 'Blue', primary: '#3b82f6', secondary: '#60a5fa' },
    { name: 'Purple', primary: '#8b5cf6', secondary: '#a78bfa' },
    { name: 'Pink', primary: '#ec4899', secondary: '#f472b6' },
    { name: 'Green', primary: '#22c55e', secondary: '#4ade80' },
    { name: 'Orange', primary: '#f97316', secondary: '#fb923c' },
    { name: 'Cyan', primary: '#06b6d4', secondary: '#22d3ee' },
    { name: 'Red', primary: '#ef4444', secondary: '#f87171' },
    { name: 'Yellow', primary: '#eab308', secondary: '#facc15' },
    { name: 'Teal', primary: '#14b8a6', secondary: '#2dd4bf' },
    { name: 'Indigo', primary: '#6366f1', secondary: '#818cf8' },
    { name: 'Rose', primary: '#f43f5e', secondary: '#fb7185' },
    { name: 'Emerald', primary: '#10b981', secondary: '#34d399' },
    { name: 'Violet', primary: '#7c3aed', secondary: '#a78bfa' },
    { name: 'Amber', primary: '#f59e0b', secondary: '#fbbf24' },
    { name: 'Lime', primary: '#84cc16', secondary: '#a3e635' },
    { name: 'Sky', primary: '#0ea5e9', secondary: '#38bdf8' },
]

export const THEMES = [
    { id: 'dark' as Theme, name: 'Dark', color: '#0c121f', description: 'Classic dark theme', accentColor: 'Blue' },
    { id: 'midnight' as Theme, name: 'Midnight', color: '#0a0e1a', description: 'Deep blue darkness', accentColor: 'Indigo' },
    { id: 'purple' as Theme, name: 'Purple Haze', color: '#151122', description: 'Purple-tinted darkness', accentColor: 'Purple' },
    { id: 'ocean' as Theme, name: 'Ocean Deep', color: '#0a1520', description: 'Deep ocean blue', accentColor: 'Cyan' },
    { id: 'forest' as Theme, name: 'Forest Night', color: '#0a1a11', description: 'Dark forest green', accentColor: 'Emerald' },
    { id: 'slate' as Theme, name: 'Slate', color: '#1a1d23', description: 'Cool gray slate', accentColor: 'Sky' },
    { id: 'charcoal' as Theme, name: 'Charcoal', color: '#16181d', description: 'Warm charcoal gray', accentColor: 'Amber' },
    { id: 'navy' as Theme, name: 'Navy', color: '#0d1520', description: 'Deep navy blue', accentColor: 'Blue' },
]

export interface Settings {
    // Appearance
    theme: Theme
    accentColor: AccentColor
    compactMode: boolean
    sidebarCollapsed: boolean

    // Terminal
    defaultShell: Shell

    // Behavior
    startMinimized: boolean
    startWithWindows: boolean
    scrollMode: ScrollMode
    browserViewMode: BrowserViewMode
    browserContentLayout: BrowserContentLayout
    filePreviewOpenInFullscreen: boolean
    filePreviewFullscreenShowLeftPanel: boolean
    filePreviewFullscreenShowRightPanel: boolean
    filePreviewDefaultMode: FilePreviewDefaultMode
    filePreviewPythonRunMode: FilePreviewPythonRunMode
    filePreviewTerminalPanelHeight: number
    projectDetailsShowTaskManagerTab: boolean
    tasksPageEnabled: boolean
    tasksRunningAppsEnabled: boolean

    // Projects
    projectsFolder: string
    additionalFolders: string[]
    enableFolderIndexing: boolean
    autoIndexOnStartup: boolean

    // AI
    groqApiKey: string
    geminiApiKey: string
    commitAIProvider: CommitAIProvider

    // Assistant
    assistantEnabled: boolean
    assistantProvider: AssistantProvider
    assistantDefaultModel: string
    assistantApprovalMode: AssistantApprovalMode
    assistantShowThinking: boolean
    assistantAutoConnectOnOpen: boolean
    assistantSidebarCollapsed: boolean
    assistantSidebarWidth: number
    assistantAllowEventConsole: boolean
    assistantShowEventPanel: boolean
    assistantProfile: AssistantProfile
    assistantProjectModels: Record<string, string>
    assistantProjectProfiles: Record<string, AssistantProfile>
}

const ASSISTANT_PROFILES: AssistantProfile[] = ['safe-dev', 'review', 'yolo-fast', 'custom']

function clampAssistantSidebarWidth(value: unknown): number {
    const numeric = Number(value)
    if (!Number.isFinite(numeric)) return 320
    return Math.max(180, Math.min(520, Math.round(numeric)))
}

function normalizeAssistantProfile(value: unknown): AssistantProfile {
    return ASSISTANT_PROFILES.includes(value as AssistantProfile)
        ? value as AssistantProfile
        : 'safe-dev'
}

function normalizeStringRecord(value: unknown): Record<string, string> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
    const next: Record<string, string> = {}
    for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
        const normalizedKey = key.trim()
        const normalizedValue = typeof raw === 'string' ? raw.trim() : ''
        if (!normalizedKey || !normalizedValue) continue
        next[normalizedKey] = normalizedValue
    }
    return next
}

function normalizeAssistantProjectProfiles(value: unknown): Record<string, AssistantProfile> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
    const next: Record<string, AssistantProfile> = {}
    for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
        const normalizedKey = key.trim()
        if (!normalizedKey) continue
        next[normalizedKey] = normalizeAssistantProfile(raw)
    }
    return next
}

const DEFAULT_SETTINGS: Settings = {
    theme: 'dark',
    accentColor: ACCENT_COLORS[0],
    compactMode: false,
    sidebarCollapsed: false,
    defaultShell: 'powershell',
    startMinimized: false,
    startWithWindows: false,
    scrollMode: 'smooth',
    browserViewMode: 'grid',
    browserContentLayout: 'grouped',
    filePreviewOpenInFullscreen: false,
    filePreviewFullscreenShowLeftPanel: true,
    filePreviewFullscreenShowRightPanel: false,
    filePreviewDefaultMode: 'preview',
    filePreviewPythonRunMode: 'terminal',
    filePreviewTerminalPanelHeight: 220,
    projectDetailsShowTaskManagerTab: true,
    tasksPageEnabled: true,
    tasksRunningAppsEnabled: false,
    projectsFolder: '',
    additionalFolders: [],
    enableFolderIndexing: true,
    autoIndexOnStartup: false,
    groqApiKey: '',
    geminiApiKey: '',
    commitAIProvider: 'groq',
    assistantEnabled: false,
    assistantProvider: 'codex',
    assistantDefaultModel: 'default',
    assistantApprovalMode: 'safe',
    assistantShowThinking: true,
    assistantAutoConnectOnOpen: false,
    assistantSidebarCollapsed: false,
    assistantSidebarWidth: 320,
    assistantAllowEventConsole: true,
    assistantShowEventPanel: false,
    assistantProfile: 'safe-dev',
    assistantProjectModels: {},
    assistantProjectProfiles: {}
}

const STORAGE_KEY = 'devscope-settings'

// Load settings from localStorage
function loadSettings(): Settings {
    try {
        const stored = localStorage.getItem(STORAGE_KEY)
        if (stored) {
            const parsed = JSON.parse(stored)
            const candidate = { ...DEFAULT_SETTINGS, ...parsed }

            // Keep only active settings keys to drop obsolete/dead fields from older app versions.
            return {
                theme: candidate.theme,
                accentColor: candidate.accentColor,
                compactMode: candidate.compactMode,
                sidebarCollapsed: candidate.sidebarCollapsed,
                defaultShell: candidate.defaultShell,
                startMinimized: candidate.startMinimized,
                startWithWindows: candidate.startWithWindows,
                scrollMode: candidate.scrollMode === 'native' ? 'native' : 'smooth',
                browserViewMode: candidate.browserViewMode === 'finder' ? 'finder' : 'grid',
                browserContentLayout: candidate.browserContentLayout === 'explorer' ? 'explorer' : 'grouped',
                filePreviewOpenInFullscreen: !!candidate.filePreviewOpenInFullscreen,
                filePreviewFullscreenShowLeftPanel: candidate.filePreviewFullscreenShowLeftPanel !== false,
                filePreviewFullscreenShowRightPanel: !!candidate.filePreviewFullscreenShowRightPanel,
                filePreviewDefaultMode: candidate.filePreviewDefaultMode === 'edit' ? 'edit' : 'preview',
                filePreviewPythonRunMode: candidate.filePreviewPythonRunMode === 'output' ? 'output' : 'terminal',
                filePreviewTerminalPanelHeight: Number.isFinite(Number(candidate.filePreviewTerminalPanelHeight))
                    ? Math.max(140, Math.min(720, Math.round(Number(candidate.filePreviewTerminalPanelHeight))))
                    : 220,
                projectDetailsShowTaskManagerTab: candidate.projectDetailsShowTaskManagerTab !== false,
                tasksPageEnabled: candidate.tasksPageEnabled !== false,
                tasksRunningAppsEnabled: candidate.tasksRunningAppsEnabled !== false,
                projectsFolder: candidate.projectsFolder,
                additionalFolders: candidate.additionalFolders,
                enableFolderIndexing: candidate.enableFolderIndexing,
                autoIndexOnStartup: candidate.autoIndexOnStartup,
                groqApiKey: candidate.groqApiKey,
                geminiApiKey: candidate.geminiApiKey,
                commitAIProvider: candidate.commitAIProvider,
                assistantEnabled: Boolean(candidate.assistantEnabled),
                assistantProvider: candidate.assistantProvider === 'codex' ? 'codex' : 'codex',
                assistantDefaultModel: typeof candidate.assistantDefaultModel === 'string' && candidate.assistantDefaultModel.trim()
                    ? candidate.assistantDefaultModel.trim()
                    : 'default',
                assistantApprovalMode: candidate.assistantApprovalMode === 'yolo' ? 'yolo' : 'safe',
                assistantShowThinking: candidate.assistantShowThinking !== false,
                assistantAutoConnectOnOpen: !!candidate.assistantAutoConnectOnOpen,
                assistantSidebarCollapsed: !!candidate.assistantSidebarCollapsed,
                assistantSidebarWidth: clampAssistantSidebarWidth(candidate.assistantSidebarWidth),
                assistantAllowEventConsole: candidate.assistantAllowEventConsole !== false,
                assistantShowEventPanel: !!candidate.assistantShowEventPanel,
                assistantProfile: normalizeAssistantProfile(candidate.assistantProfile),
                assistantProjectModels: normalizeStringRecord(candidate.assistantProjectModels),
                assistantProjectProfiles: normalizeAssistantProjectProfiles(candidate.assistantProjectProfiles)
            }
        }
    } catch (e) {
        console.error('Failed to load settings:', e)
    }
    return DEFAULT_SETTINGS
}

// Save settings to localStorage
function saveSettings(settings: Settings): void {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
    } catch (e) {
        console.error('Failed to save settings:', e)
    }
}

// Context
interface SettingsContextType {
    settings: Settings
    updateSettings: (partial: Partial<Settings>) => void
    resetSettings: () => void
    clearCache: () => void
}

const SettingsContext = createContext<SettingsContextType | null>(null)

export function SettingsProvider({ children }: { children: ReactNode }) {
    const [settings, setSettings] = useState<Settings>(loadSettings)

    // Apply theme on mount and change
    useEffect(() => {
        applyTheme(settings.theme)
    }, [settings.theme])

    // Apply accent color on mount and change
    useEffect(() => {
        applyAccentColor(settings.accentColor)
    }, [settings.accentColor])

    // Apply compact mode
    useEffect(() => {
        if (settings.compactMode) {
            document.body.classList.add('compact-mode')
        } else {
            document.body.classList.remove('compact-mode')
        }
    }, [settings.compactMode])

    // Save settings whenever they change
    useEffect(() => {
        saveSettings(settings)
    }, [settings])

    const updateSettings = (partial: Partial<Settings>) => {
        setSettings(prev => ({ ...prev, ...partial }))
    }

    const resetSettings = () => {
        setSettings(DEFAULT_SETTINGS)
        localStorage.removeItem(STORAGE_KEY)
    }

    const clearCache = () => {
        // Clear all devscope-related localStorage items except settings
        const keysToRemove: string[] = []
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i)
            if (key && key.startsWith('devscope-') && key !== STORAGE_KEY) {
                keysToRemove.push(key)
            }
        }
        keysToRemove.forEach(key => localStorage.removeItem(key))

        // Dispatch event to notify components
        window.dispatchEvent(new CustomEvent('devscope:cache-cleared'))
    }

    return (
        <SettingsContext.Provider value={{ settings, updateSettings, resetSettings, clearCache }}>
            {children}
        </SettingsContext.Provider>
    )
}

export function useSettings() {
    const context = useContext(SettingsContext)
    if (!context) {
        throw new Error('useSettings must be used within a SettingsProvider')
    }
    return context
}

// Helper functions
function applyTheme(theme: Theme) {
    document.body.classList.remove('dark', 'light', 'purple', 'green', 'midnight', 'ocean', 'forest', 'slate', 'charcoal', 'navy')
    if (theme !== 'dark') {
        document.body.classList.add(theme)
    }
}

function applyAccentColor(accent: AccentColor) {
    document.documentElement.style.setProperty('--accent-primary', accent.primary)
    document.documentElement.style.setProperty('--accent-secondary', accent.secondary)
}

