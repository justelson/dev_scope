/**
 * DevScope - Settings Store & Context
 * Manages all app settings with localStorage persistence
 */

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'

// Settings Types
export type Theme = 'dark' | 'light' | 'purple' | 'green'
export type Shell = 'powershell' | 'cmd'
export type RefreshInterval = 'manual' | '5' | '15' | '30' | '60'

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
]

export const THEMES = [
    { id: 'dark' as Theme, name: 'Dark', color: '#0c121f' },
    { id: 'light' as Theme, name: 'Light', color: '#f9fafb' },
    { id: 'purple' as Theme, name: 'Purple', color: '#151122' },
    { id: 'green' as Theme, name: 'Green', color: '#0a1a11' }
]

export interface Settings {
    // Appearance
    theme: Theme
    accentColor: AccentColor
    compactMode: boolean

    // Terminal
    defaultShell: Shell
    terminalFontSize: number
    maxOutputBuffer: number

    // Behavior
    autoRefreshInterval: RefreshInterval
    startMinimized: boolean
    startWithWindows: boolean

    // Scanning
    enabledCategories: string[]
    customToolPaths: Record<string, string>

    // Projects
    projectsFolder: string
    additionalFolders: string[]
    enableFolderIndexing: boolean
    autoIndexOnStartup: boolean

    // AI
    groqApiKey: string
}

const DEFAULT_SETTINGS: Settings = {
    theme: 'dark',
    accentColor: ACCENT_COLORS[0],
    compactMode: false,
    defaultShell: 'powershell',
    terminalFontSize: 14,
    maxOutputBuffer: 100000,
    autoRefreshInterval: 'manual',
    startMinimized: false,
    startWithWindows: false,
    enabledCategories: ['language', 'package_manager', 'build_tool', 'container', 'version_control', 'ai_runtime', 'ai_agent'],
    customToolPaths: {},
    projectsFolder: '',
    additionalFolders: [],
    enableFolderIndexing: true,
    autoIndexOnStartup: false,
    groqApiKey: ''
}

const STORAGE_KEY = 'devscope-settings'

// Load settings from localStorage
function loadSettings(): Settings {
    try {
        const stored = localStorage.getItem(STORAGE_KEY)
        if (stored) {
            const parsed = JSON.parse(stored)
            return { ...DEFAULT_SETTINGS, ...parsed }
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

    // Apply terminal font size
    useEffect(() => {
        document.documentElement.style.setProperty('--terminal-font-size', `${settings.terminalFontSize}px`)
    }, [settings.terminalFontSize])

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
    document.body.classList.remove('dark', 'light', 'purple', 'green')
    if (theme !== 'dark') {
        document.body.classList.add(theme)
    }
}

function applyAccentColor(accent: AccentColor) {
    document.documentElement.style.setProperty('--accent-primary', accent.primary)
    document.documentElement.style.setProperty('--accent-secondary', accent.secondary)
}
