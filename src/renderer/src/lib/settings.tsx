/**
 * DevScope - Settings Store & Context
 * Manages all app settings with localStorage persistence
 */

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import {
    loadLegacyAssistantComposerDefaults,
    sanitizeAssistantDefaultEffort,
    sanitizeAssistantDefaultInteractionMode,
    sanitizeAssistantDefaultRuntimeMode
} from './settings-assistant-defaults'

export {
    getAssistantDefaultEffortLabel,
    getAssistantDefaultInteractionModeLabel,
    getAssistantDefaultRuntimeModeLabel,
    getAssistantDefaultSpeedLabel,
    getAssistantDefaultsPreview
} from './settings-assistant-defaults'

// Settings Types
export type Theme = 'dark' | 'light' | 'purple' | 'green' | 'midnight' | 'ocean' | 'forest' | 'slate' | 'charcoal' | 'navy'
export type DarkTheme = Exclude<Theme, 'light'>
export type Shell = 'powershell' | 'cmd'
export type CommitAIProvider = 'groq' | 'gemini' | 'codex'
export type ScrollMode = 'smooth' | 'native'
export type BrowserViewMode = 'grid' | 'finder'
export type BrowserContentLayout = 'grouped' | 'explorer'
export type GitBulkActionScope = 'project' | 'repo'
export type FilePreviewDefaultMode = 'preview' | 'edit'
export type FilePreviewPythonRunMode = 'terminal' | 'output'
export type PullRequestGuideSource = 'project' | 'global' | 'repo-template' | 'none'
export type PullRequestGuideMode = 'text' | 'file'
export type PullRequestChangeSource = 'unstaged' | 'staged' | 'local-commits' | 'all-local-work'
export type AssistantUsageDisplayMode = 'remaining' | 'used'
export type AssistantTextStreamingMode = 'stream' | 'chunks'
export type AssistantDefaultRuntimeMode = 'approval-required' | 'full-access'
export type AssistantDefaultInteractionMode = 'default' | 'plan'
export type AssistantDefaultEffort = 'low' | 'medium' | 'high' | 'xhigh'

export interface PullRequestGuideConfig {
    mode: PullRequestGuideMode
    text: string
    filePath: string
}

export interface ProjectPullRequestConfig {
    guideSource: PullRequestGuideSource
    guide: PullRequestGuideConfig
    targetBranch: string
    draft: boolean
    changeSource: PullRequestChangeSource
}

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
    { name: 'Sky', primary: '#0ea5e9', secondary: '#38bdf8' }
]

export const THEMES = [
    { id: 'dark' as Theme, name: 'Dark', color: '#0c121f', description: 'Classic dark theme', accentColor: 'Blue' },
    { id: 'midnight' as Theme, name: 'Midnight', color: '#0a0e1a', description: 'Deep blue darkness', accentColor: 'Indigo' },
    { id: 'purple' as Theme, name: 'Purple Haze', color: '#151122', description: 'Purple-tinted darkness', accentColor: 'Purple' },
    { id: 'ocean' as Theme, name: 'Ocean Deep', color: '#0a1520', description: 'Deep ocean blue', accentColor: 'Cyan' },
    { id: 'forest' as Theme, name: 'Forest Night', color: '#0a1a11', description: 'Dark forest green', accentColor: 'Emerald' },
    { id: 'slate' as Theme, name: 'Slate', color: '#1a1d23', description: 'Cool gray slate', accentColor: 'Sky' },
    { id: 'charcoal' as Theme, name: 'Charcoal', color: '#16181d', description: 'Warm charcoal gray', accentColor: 'Amber' },
    { id: 'navy' as Theme, name: 'Cursor Dark', color: '#0b0d10', description: 'Near-black Cursor-inspired theme', accentColor: 'Blue' }
]

export interface Settings {
    theme: Theme
    lastDarkTheme: DarkTheme
    accentColor: AccentColor
    compactMode: boolean
    sidebarCollapsed: boolean
    betaSettingsEnabled: boolean
    explorerTabEnabled: boolean
    explorerHomePath: string
    defaultShell: Shell
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
    projectsFolder: string
    additionalFolders: string[]
    enableFolderIndexing: boolean
    autoIndexOnStartup: boolean
    gitAutoRefreshOnProjectOpen: boolean
    gitInitDefaultBranch: string
    gitInitCreateGitignore: boolean
    gitInitCreateInitialCommit: boolean
    gitWarnOnAuthorMismatch: boolean
    gitConfirmPartialPushRange: boolean
    gitBulkActionScope: GitBulkActionScope
    gitPullRequestGlobalGuide: PullRequestGuideConfig
    gitPullRequestDefaultGuideSource: PullRequestGuideSource
    gitPullRequestDefaultTargetBranch: string
    gitPullRequestDefaultDraft: boolean
    gitPullRequestDefaultChangeSource: PullRequestChangeSource
    gitProjectPullRequestConfigs: Record<string, ProjectPullRequestConfig>
    gitAutoCreateBranchWhenTargetMatches: boolean
    groqApiKey: string
    geminiApiKey: string
    codexModel: string
    commitAIProvider: CommitAIProvider
    assistantUsageDisplayMode: AssistantUsageDisplayMode
    assistantTextStreamingMode: AssistantTextStreamingMode
    assistantDefaultModel: string
    assistantDefaultRuntimeMode: AssistantDefaultRuntimeMode
    assistantDefaultInteractionMode: AssistantDefaultInteractionMode
    assistantDefaultEffort: AssistantDefaultEffort
    assistantDefaultFastMode: boolean
}

const DEFAULT_SETTINGS: Settings = {
    theme: 'dark',
    lastDarkTheme: 'dark',
    accentColor: ACCENT_COLORS[0],
    compactMode: false,
    sidebarCollapsed: false,
    betaSettingsEnabled: false,
    explorerTabEnabled: false,
    explorerHomePath: '',
    defaultShell: 'powershell',
    startMinimized: false,
    startWithWindows: false,
    scrollMode: 'smooth',
    browserViewMode: 'finder',
    browserContentLayout: 'explorer',
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
    gitAutoRefreshOnProjectOpen: true,
    gitInitDefaultBranch: 'main',
    gitInitCreateGitignore: true,
    gitInitCreateInitialCommit: false,
    gitWarnOnAuthorMismatch: true,
    gitConfirmPartialPushRange: true,
    gitBulkActionScope: 'repo',
    gitPullRequestGlobalGuide: {
        mode: 'text',
        text: '',
        filePath: ''
    },
    gitPullRequestDefaultGuideSource: 'global',
    gitPullRequestDefaultTargetBranch: 'main',
    gitPullRequestDefaultDraft: true,
    gitPullRequestDefaultChangeSource: 'all-local-work',
    gitProjectPullRequestConfigs: {},
    gitAutoCreateBranchWhenTargetMatches: false,
    groqApiKey: '',
    geminiApiKey: '',
    codexModel: '',
    commitAIProvider: 'groq',
    assistantUsageDisplayMode: 'remaining',
    assistantTextStreamingMode: 'stream',
    assistantDefaultModel: '',
    assistantDefaultRuntimeMode: 'approval-required',
    assistantDefaultInteractionMode: 'default',
    assistantDefaultEffort: 'high',
    assistantDefaultFastMode: false
}

const STORAGE_KEY = 'devscope-settings'
const LEGACY_ASSISTANT_COMPOSER_PREFERENCES_STORAGE_KEY = 'devscope:assistant-composer-preferences'

function isTheme(value: unknown): value is Theme {
    return typeof value === 'string' && ['dark', 'light', 'purple', 'green', 'midnight', 'ocean', 'forest', 'slate', 'charcoal', 'navy'].includes(value)
}

function isDarkTheme(value: unknown): value is DarkTheme {
    return isTheme(value) && value !== 'light'
}

function sanitizePullRequestGuideConfig(value: unknown): PullRequestGuideConfig {
    const candidate = typeof value === 'object' && value !== null ? value as Partial<PullRequestGuideConfig> : {}
    return {
        mode: candidate.mode === 'file' ? 'file' : 'text',
        text: typeof candidate.text === 'string' ? candidate.text : '',
        filePath: typeof candidate.filePath === 'string' ? candidate.filePath : ''
    }
}

function sanitizePullRequestChangeSource(value: unknown, fallback: PullRequestChangeSource): PullRequestChangeSource {
    if (value === 'unstaged' || value === 'staged' || value === 'local-commits' || value === 'all-local-work') {
        return value
    }
    if (value === 'selected-commits') return 'local-commits'
    if (value === 'all-ready') return 'all-local-work'
    return fallback
}

function sanitizeProjectPullRequestConfig(value: unknown, defaults: Settings): ProjectPullRequestConfig {
    const candidate = typeof value === 'object' && value !== null ? value as Partial<ProjectPullRequestConfig> : {}
    return {
        guideSource: candidate.guideSource === 'project' || candidate.guideSource === 'repo-template' || candidate.guideSource === 'none'
            ? candidate.guideSource
            : 'global',
        guide: sanitizePullRequestGuideConfig(candidate.guide),
        targetBranch: typeof candidate.targetBranch === 'string' && candidate.targetBranch.trim()
            ? candidate.targetBranch.trim()
            : defaults.gitPullRequestDefaultTargetBranch,
        draft: candidate.draft !== false,
        changeSource: sanitizePullRequestChangeSource(
            (candidate as Partial<ProjectPullRequestConfig> & { scope?: unknown }).changeSource
                ?? (candidate as Partial<ProjectPullRequestConfig> & { scope?: unknown }).scope,
            defaults.gitPullRequestDefaultChangeSource
        )
    }
}

function loadSettings(): Settings {
    try {
        const legacyAssistantDefaults = loadLegacyAssistantComposerDefaults(
            LEGACY_ASSISTANT_COMPOSER_PREFERENCES_STORAGE_KEY,
            DEFAULT_SETTINGS
        )
        const stored = localStorage.getItem(STORAGE_KEY)
        if (stored) {
            const parsed = JSON.parse(stored)
            const candidate = { ...DEFAULT_SETTINGS, ...legacyAssistantDefaults, ...parsed }
            const theme = isTheme(candidate.theme) ? candidate.theme : DEFAULT_SETTINGS.theme
            const lastDarkTheme = isDarkTheme(candidate.lastDarkTheme)
                ? candidate.lastDarkTheme
                : isDarkTheme(theme)
                    ? theme
                    : DEFAULT_SETTINGS.lastDarkTheme

            return {
                theme,
                lastDarkTheme,
                accentColor: candidate.accentColor,
                compactMode: candidate.compactMode,
                sidebarCollapsed: candidate.sidebarCollapsed,
                betaSettingsEnabled: candidate.betaSettingsEnabled === true,
                explorerTabEnabled: candidate.explorerTabEnabled === true,
                explorerHomePath: typeof candidate.explorerHomePath === 'string' ? candidate.explorerHomePath : '',
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
                gitAutoRefreshOnProjectOpen: candidate.gitAutoRefreshOnProjectOpen !== false,
                gitInitDefaultBranch: typeof candidate.gitInitDefaultBranch === 'string' && candidate.gitInitDefaultBranch.trim()
                    ? candidate.gitInitDefaultBranch.trim()
                    : 'main',
                gitInitCreateGitignore: candidate.gitInitCreateGitignore !== false,
                gitInitCreateInitialCommit: !!candidate.gitInitCreateInitialCommit,
                gitWarnOnAuthorMismatch: candidate.gitWarnOnAuthorMismatch !== false,
                gitConfirmPartialPushRange: candidate.gitConfirmPartialPushRange !== false,
                gitBulkActionScope: candidate.gitBulkActionScope === 'project' ? 'project' : 'repo',
                gitPullRequestGlobalGuide: sanitizePullRequestGuideConfig(candidate.gitPullRequestGlobalGuide),
                gitPullRequestDefaultGuideSource:
                    candidate.gitPullRequestDefaultGuideSource === 'project'
                    || candidate.gitPullRequestDefaultGuideSource === 'repo-template'
                    || candidate.gitPullRequestDefaultGuideSource === 'none'
                        ? candidate.gitPullRequestDefaultGuideSource
                        : 'global',
                gitPullRequestDefaultTargetBranch: typeof candidate.gitPullRequestDefaultTargetBranch === 'string' && candidate.gitPullRequestDefaultTargetBranch.trim()
                    ? candidate.gitPullRequestDefaultTargetBranch.trim()
                    : DEFAULT_SETTINGS.gitPullRequestDefaultTargetBranch,
                gitPullRequestDefaultDraft: candidate.gitPullRequestDefaultDraft !== false,
                gitPullRequestDefaultChangeSource: sanitizePullRequestChangeSource(
                    candidate.gitPullRequestDefaultChangeSource ?? candidate.gitPullRequestDefaultScope,
                    DEFAULT_SETTINGS.gitPullRequestDefaultChangeSource
                ),
                gitProjectPullRequestConfigs: Object.fromEntries(
                    Object.entries(
                        typeof candidate.gitProjectPullRequestConfigs === 'object' && candidate.gitProjectPullRequestConfigs !== null
                            ? candidate.gitProjectPullRequestConfigs as Record<string, unknown>
                            : {}
                    ).map(([projectPath, config]) => [
                        projectPath,
                        sanitizeProjectPullRequestConfig(config, DEFAULT_SETTINGS)
                    ])
                ),
                gitAutoCreateBranchWhenTargetMatches: candidate.gitAutoCreateBranchWhenTargetMatches === true,
                groqApiKey: candidate.groqApiKey,
                geminiApiKey: candidate.geminiApiKey,
                codexModel: typeof candidate.codexModel === 'string' ? candidate.codexModel.trim() : '',
                commitAIProvider: candidate.commitAIProvider === 'gemini' || candidate.commitAIProvider === 'codex' ? candidate.commitAIProvider : 'groq',
                assistantUsageDisplayMode: candidate.assistantUsageDisplayMode === 'used' ? 'used' : 'remaining',
                assistantTextStreamingMode: candidate.assistantTextStreamingMode === 'chunks' ? 'chunks' : 'stream',
                assistantDefaultModel: typeof candidate.assistantDefaultModel === 'string' ? candidate.assistantDefaultModel.trim() : '',
                assistantDefaultRuntimeMode: sanitizeAssistantDefaultRuntimeMode(candidate.assistantDefaultRuntimeMode),
                assistantDefaultInteractionMode: sanitizeAssistantDefaultInteractionMode(candidate.assistantDefaultInteractionMode),
                assistantDefaultEffort: sanitizeAssistantDefaultEffort(candidate.assistantDefaultEffort),
                assistantDefaultFastMode: !!candidate.assistantDefaultFastMode
            }
        }
    } catch (e) {
        console.error('Failed to load settings:', e)
    }
    return {
        ...DEFAULT_SETTINGS,
        ...loadLegacyAssistantComposerDefaults(LEGACY_ASSISTANT_COMPOSER_PREFERENCES_STORAGE_KEY, DEFAULT_SETTINGS)
    }
}

function saveSettings(settings: Settings): void {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
    } catch (e) {
        console.error('Failed to save settings:', e)
    }
}

interface SettingsContextType {
    settings: Settings
    updateSettings: (partial: Partial<Settings>) => void
    resetSettings: () => void
    clearCache: () => void
}

const SettingsContext = createContext<SettingsContextType | null>(null)

export function SettingsProvider({ children }: { children: ReactNode }) {
    const [settings, setSettings] = useState<Settings>(loadSettings)

    useEffect(() => {
        applyTheme(settings.theme)
    }, [settings.theme])

    useEffect(() => {
        applyAccentColor(settings.accentColor)
    }, [settings.accentColor])

    useEffect(() => {
        if (settings.compactMode) {
            document.body.classList.add('compact-mode')
        } else {
            document.body.classList.remove('compact-mode')
        }
    }, [settings.compactMode])

    useEffect(() => {
        saveSettings(settings)
    }, [settings])

    const updateSettings = (partial: Partial<Settings>) => {
        setSettings((prev) => {
            const nextTheme = partial.theme ?? prev.theme
            const nextLastDarkTheme = isDarkTheme(partial.lastDarkTheme)
                ? partial.lastDarkTheme
                : isDarkTheme(nextTheme)
                    ? nextTheme
                    : prev.lastDarkTheme

            return {
                ...prev,
                ...partial,
                theme: nextTheme,
                lastDarkTheme: nextLastDarkTheme
            }
        })
    }

    const resetSettings = () => {
        setSettings(DEFAULT_SETTINGS)
        localStorage.removeItem(STORAGE_KEY)
    }

    const clearCache = () => {
        const keysToRemove: string[] = []
        for (let index = 0; index < localStorage.length; index += 1) {
            const key = localStorage.key(index)
            if (key && key.startsWith('devscope-') && key !== STORAGE_KEY) {
                keysToRemove.push(key)
            }
        }
        keysToRemove.forEach((key) => localStorage.removeItem(key))
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
