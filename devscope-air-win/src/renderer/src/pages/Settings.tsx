/**
 * DevScope Air - Settings Overview Page
 */

import { Link } from 'react-router-dom'
import {
    Palette, RefreshCw, Download, Info,
    ChevronRight, Settings as SettingsIcon, FolderOpen, Sparkles, Terminal, Bug, Bot
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
            <div className="mb-8">
                <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 rounded-lg bg-[var(--accent-primary)]/10">
                        <SettingsIcon className="text-[var(--accent-primary)]" size={24} />
                    </div>
                    <h1 className="text-2xl font-semibold text-sparkle-text">Settings</h1>
                </div>
                <p className="text-sparkle-text-secondary">
                    Customize your DevScope Air experience
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <SettingsCard
                    to="/settings/appearance"
                    icon={<Palette className="text-purple-400" size={24} />}
                    iconBg="bg-purple-500/10"
                    title="Appearance"
                    description="Theme, accent colors, and display options"
                    preview={`${settings.theme} \u2022 ${settings.accentColor.name}${settings.compactMode ? ' \u2022 Compact' : ''}`}
                />

                <SettingsCard
                    to="/settings/behavior"
                    icon={<RefreshCw className="text-blue-400" size={24} />}
                    iconBg="bg-blue-500/10"
                    title="Behavior"
                    description="Startup options"
                    preview={`${settings.startWithWindows ? 'Startup enabled' : 'Startup disabled'}${settings.startMinimized ? ' \u2022 Hidden start' : ''} \u2022 ${settings.scrollMode === 'smooth' ? 'Buttery scroll' : 'Native scroll'}`}
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
                    to="/settings/assistant"
                    icon={<Bot className="text-indigo-300" size={24} />}
                    iconBg="bg-indigo-400/10"
                    title="Assistant"
                    description="Configure in-app coding assistant behavior"
                    preview={`${settings.assistantEnabled ? 'Enabled' : 'Disabled'} • ${settings.assistantApprovalMode.toUpperCase()}${settings.assistantAutoConnectOnOpen ? ' • Auto-connect' : ''}`}
                />

                <SettingsCard
                    to="/settings/ai"
                    icon={<Sparkles className="text-violet-400" size={24} />}
                    iconBg="bg-violet-500/10"
                    title="AI Features"
                    description="API keys and AI commit generation"
                    preview={settings.commitAIProvider.toUpperCase() + (settings.groqApiKey || settings.geminiApiKey ? ' \u2022 Key set' : ' \u2022 No key')}
                />

                <SettingsCard
                    to="/settings/terminal"
                    icon={<Terminal className="text-green-400" size={24} />}
                    iconBg="bg-green-500/10"
                    title="Terminal"
                    description="Set default terminal and shell behavior"
                    preview={settings.defaultShell === 'cmd' ? 'Default: CMD' : 'Default: PowerShell'}
                />

                <SettingsCard
                    to="/settings/logs"
                    icon={<Bug className="text-amber-400" size={24} />}
                    iconBg="bg-amber-500/10"
                    title="Logs"
                    description="Inspect AI request/response logs"
                    preview="Commit AI traces"
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
                    preview="v1.0.0 Air"
                />
            </div>
        </div>
    )
}



