/**
 * DevScope - Settings Overview Page
 * Main settings hub with 3x3 grid of cards linking to specific settings pages
 */

import { Link } from 'react-router-dom'
import {
    Palette, Terminal, RefreshCw, Layers, Download, Info,
    ChevronRight, Settings as SettingsIcon, Keyboard, Shield, FolderOpen, Sparkles
} from 'lucide-react'
import { useSettings } from '@/lib/settings'
import { cn } from '@/lib/utils'

interface SettingsCardProps {
    to: string
    icon: React.ReactNode
    iconBg: string
    title: string
    description: string
    preview?: string
}

function SettingsCard({ to, icon, iconBg, title, description, preview }: SettingsCardProps) {
    return (
        <Link
            to={to}
            className="group bg-sparkle-card rounded-xl border border-sparkle-border p-5 hover:border-[var(--accent-primary)]/50 transition-all hover:shadow-lg hover:shadow-[var(--accent-primary)]/5 flex flex-col"
        >
            <div className="flex items-start justify-between mb-3">
                <div className={cn('p-3 rounded-xl', iconBg)}>
                    {icon}
                </div>
                <ChevronRight
                    size={18}
                    className="text-sparkle-text-muted group-hover:text-[var(--accent-primary)] group-hover:translate-x-1 transition-all mt-1"
                />
            </div>
            <h3 className="font-semibold text-sparkle-text group-hover:text-[var(--accent-primary)] transition-colors mb-1">
                {title}
            </h3>
            <p className="text-sm text-sparkle-text-secondary flex-1">
                {description}
            </p>
            {preview && (
                <p className="text-xs text-sparkle-text-muted mt-3 font-mono truncate">
                    {preview}
                </p>
            )}
        </Link>
    )
}

export default function Settings() {
    const { settings } = useSettings()

    return (
        <div className="animate-fadeIn">
            {/* Header */}
            <div className="mb-8">
                <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 rounded-lg bg-[var(--accent-primary)]/10">
                        <SettingsIcon className="text-[var(--accent-primary)]" size={24} />
                    </div>
                    <h1 className="text-2xl font-semibold text-sparkle-text">Settings</h1>
                </div>
                <p className="text-sparkle-text-secondary">
                    Customize your DevScope experience
                </p>
            </div>

            {/* Settings Cards 3x3 Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <SettingsCard
                    to="/settings/appearance"
                    icon={<Palette className="text-purple-400" size={24} />}
                    iconBg="bg-purple-500/10"
                    title="Appearance"
                    description="Theme, accent colors, and display options"
                    preview={`${settings.theme} • ${settings.accentColor.name}${settings.compactMode ? ' • Compact' : ''}`}
                />

                <SettingsCard
                    to="/settings/terminal"
                    icon={<Terminal className="text-green-400" size={24} />}
                    iconBg="bg-green-500/10"
                    title="Terminal"
                    description="Shell preferences and terminal settings"
                    preview={`${settings.defaultShell === 'powershell' ? 'PowerShell' : 'CMD'} • ${settings.terminalFontSize}px`}
                />

                <SettingsCard
                    to="/settings/behavior"
                    icon={<RefreshCw className="text-blue-400" size={24} />}
                    iconBg="bg-blue-500/10"
                    title="Behavior"
                    description="Auto-refresh and startup options"
                    preview={`${settings.autoRefreshInterval === 'manual' ? 'Manual' : `${settings.autoRefreshInterval}m`}${settings.startWithWindows ? ' • Startup' : ''}`}
                />

                <SettingsCard
                    to="/settings/scanning"
                    icon={<Layers className="text-orange-400" size={24} />}
                    iconBg="bg-orange-500/10"
                    title="Scanning"
                    description="Tool categories and detection"
                    preview={`${settings.enabledCategories.length}/7 categories`}
                />

                <SettingsCard
                    to="/settings/projects"
                    icon={<FolderOpen className="text-indigo-400" size={24} />}
                    iconBg="bg-indigo-500/10"
                    title="Projects"
                    description="Configure projects folder location"
                    preview={settings.projectsFolder ? 'Configured' : 'Not set'}
                />

                <SettingsCard
                    to="/settings/data"
                    icon={<Download className="text-cyan-400" size={24} />}
                    iconBg="bg-cyan-500/10"
                    title="Data & Export"
                    description="Export, clear cache, reset settings"
                />

                <SettingsCard
                    to="/settings/about"
                    icon={<Info className="text-emerald-400" size={24} />}
                    iconBg="bg-emerald-500/10"
                    title="About"
                    description="Version info and credits"
                    preview="v1.0.0 Beta"
                />

                {/* Placeholder cards for 3x3 grid - can be future features */}
                <SettingsCard
                    to="/settings/ai"
                    icon={<Sparkles className="text-violet-400" size={24} />}
                    iconBg="bg-violet-500/10"
                    title="AI Features"
                    description="Groq API key for AI commit messages"
                    preview={settings.groqApiKey ? 'Configured' : 'Not set'}
                />
            </div>
        </div>
    )
}
