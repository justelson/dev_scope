/**
 * DevScope - Settings Store & Context
 * Manages all app settings with localStorage persistence
 */

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'

// Settings Types
export type Theme = 'dark' | 'light' | 'purple' | 'green' | 'midnight' | 'ocean' | 'forest' | 'slate' | 'charcoal' | 'navy'
export type Shell = 'powershell' | 'cmd'
export type CommitAIProvider = 'groq' | 'gemini'

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

    // Projects
    projectsFolder: string
    additionalFolders: string[]
    enableFolderIndexing: boolean
    autoIndexOnStartup: boolean

    // AI
    groqApiKey: string
    geminiApiKey: string
    commitAIProvider: CommitAIProvider
}

const DEFAULT_SETTINGS: Settings = {
    theme: 'dark',
    accentColor: ACCENT_COLORS[0],
    compactMode: false,
    sidebarCollapsed: false,
    defaultShell: 'powershell',
    startMinimized: false,
    startWithWindows: false,
    projectsFolder: '',
    additionalFolders: [],
    enableFolderIndexing: true,
    autoIndexOnStartup: false,
    groqApiKey: '',
    geminiApiKey: '',
    commitAIProvider: 'groq'
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
                projectsFolder: candidate.projectsFolder,
                additionalFolders: candidate.additionalFolders,
                enableFolderIndexing: candidate.enableFolderIndexing,
                autoIndexOnStartup: candidate.autoIndexOnStartup,
                groqApiKey: candidate.groqApiKey,
                geminiApiKey: candidate.geminiApiKey,
                commitAIProvider: candidate.commitAIProvider
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

