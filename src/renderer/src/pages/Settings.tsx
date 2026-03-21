/**
 * DevScope Air - Settings Overview Page
 */

import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import {
    Palette,
    RefreshCw,
    Info,
    ChevronRight,
    Settings as SettingsIcon,
    FolderOpen,
    FolderTree,
    Sparkles,
    GitBranch,
    ShieldCheck
} from 'lucide-react'
import { useAppUpdateState } from '@/lib/app-updates'
import { getAssistantDefaultsPreview, useSettings } from '@/lib/settings'
import { cn } from '@/lib/utils'
import { SettingsBetaBadge } from './settings/SettingsBetaBadge'

interface SettingsCardProps {
    to: string
    icon: ReactNode
    iconBg: string
    title: string
    description: string
    preview?: string
    badge?: ReactNode
}

function SettingsCard({ to, icon, iconBg, title, description, preview, badge }: SettingsCardProps) {
    return (
        <Link
            to={to}
            className="group flex flex-col rounded-xl border border-white/10 bg-sparkle-card p-5 transition-all hover:border-white/20 hover:shadow-lg hover:shadow-[var(--accent-primary)]/5"
        >
            <div className="mb-3 flex items-start justify-between">
                <div className={cn('rounded-xl p-3', iconBg)}>
                    {icon}
                </div>
                <div className="flex items-center gap-2">
                    {badge}
                    <ChevronRight
                        size={18}
                        className="mt-1 text-sparkle-text-muted transition-all group-hover:translate-x-1 group-hover:text-[var(--accent-primary)]"
                    />
                </div>
            </div>
            <h3 className="mb-1 font-semibold text-sparkle-text transition-colors group-hover:text-[var(--accent-primary)]">
                {title}
            </h3>
            <p className="flex-1 text-sm text-sparkle-text-secondary">
                {description}
            </p>
            {preview && (
                <p className="mt-3 truncate font-mono text-xs text-sparkle-text-muted">
                    {preview}
                </p>
            )}
        </Link>
    )
}

export default function Settings() {
    const { settings, updateSettings } = useSettings()
    const updateState = useAppUpdateState()

    return (
        <div className="animate-fadeIn">
            <div className="mb-8">
                <div className="mb-2 flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="rounded-lg bg-[var(--accent-primary)]/10 p-2">
                            <SettingsIcon className="text-[var(--accent-primary)]" size={24} />
                        </div>
                        <h1 className="text-2xl font-semibold text-sparkle-text">Settings</h1>
                    </div>

                    <button
                        type="button"
                        role="switch"
                        aria-checked={settings.betaSettingsEnabled}
                        onClick={() => updateSettings({ betaSettingsEnabled: !settings.betaSettingsEnabled })}
                        className={cn(
                            'inline-flex items-center gap-3 rounded-xl border px-3.5 py-2.5 text-sm transition-all',
                            settings.betaSettingsEnabled
                                ? 'border-fuchsia-400/30 bg-fuchsia-500/10 text-fuchsia-100'
                                : 'border-white/10 bg-sparkle-card text-sparkle-text-secondary hover:border-white/20 hover:text-sparkle-text'
                        )}
                    >
                        <span
                            className={cn(
                                'inline-flex h-7 w-7 items-center justify-center rounded-full border text-xs font-semibold',
                                settings.betaSettingsEnabled
                                    ? 'border-fuchsia-300/35 bg-fuchsia-400/14 text-fuchsia-100'
                                    : 'border-white/10 bg-black/20 text-sparkle-text-muted'
                            )}
                        >
                            β
                        </span>
                        <span className="text-left">
                            <span className="block font-medium leading-none">Beta</span>
                            <span className="mt-1 block text-[11px] leading-none opacity-80">
                                {settings.betaSettingsEnabled ? 'Explorer and Git controls visible' : 'Explorer and Git controls hidden'}
                            </span>
                        </span>
                    </button>
                </div>

                <p className="text-sparkle-text-secondary">
                    Customize your DevScope Air experience
                </p>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
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
                    description="Startup, preview, tasks, and terminal defaults"
                    preview={`${settings.startWithWindows ? 'Startup enabled' : 'Startup disabled'} \u2022 ${settings.defaultShell === 'cmd' ? 'CMD' : 'PowerShell'} \u2022 ${settings.scrollMode === 'smooth' ? 'Buttery scroll' : 'Native scroll'}`}
                />

                <SettingsCard
                    to="/settings/projects"
                    icon={<FolderOpen className="text-indigo-400" size={24} />}
                    iconBg="bg-indigo-500/10"
                    title="Projects"
                    description="Configure projects folder location"
                    preview={settings.projectsFolder ? 'Configured' : 'Not set'}
                />

                {settings.betaSettingsEnabled && (
                    <>
                        <SettingsCard
                            to="/settings/explorer"
                            icon={<FolderTree className="text-amber-300" size={24} />}
                            iconBg="bg-amber-500/10"
                            title="Explorer"
                            description="Optional file-browser tab for browsing any folder"
                            preview={
                                settings.explorerTabEnabled
                                    ? `Enabled${settings.explorerHomePath ? ` \u2022 ${getPathTail(settings.explorerHomePath)}` : ' \u2022 Home (~)'}`
                                    : 'Disabled'
                            }
                            badge={<SettingsBetaBadge compact />}
                        />

                        <SettingsCard
                            to="/settings/git"
                            icon={<GitBranch className="text-orange-300" size={24} />}
                            iconBg="bg-orange-500/10"
                            title="Git"
                            description="PR defaults, branch behavior, and Git identity"
                            preview={`${settings.gitPullRequestDefaultDraft ? 'Draft by default' : 'Ready for review'} \u2022 ${settings.gitPullRequestDefaultTargetBranch}`}
                            badge={<SettingsBetaBadge compact />}
                        />
                    </>
                )}

                <SettingsCard
                    to="/settings/ai"
                    icon={<Sparkles className="text-violet-400" size={24} />}
                    iconBg="bg-violet-500/10"
                    title="AI Features"
                    description="Git AI providers, Codex model, and API keys"
                    preview={settings.commitAIProvider === 'codex'
                        ? `CODEX • ${settings.codexModel || settings.assistantDefaultModel || 'default model'}`
                        : settings.commitAIProvider.toUpperCase() + (settings.groqApiKey || settings.geminiApiKey ? ' • Key set' : ' • No key')}
                />

                <SettingsCard
                    to="/settings/account"
                    icon={<ShieldCheck className="text-sky-400" size={24} />}
                    iconBg="bg-sky-500/10"
                    title="Assistant"
                    description="Assistant defaults, account details, and usage limits"
                    preview={getAssistantDefaultsPreview(settings)}
                />

                <SettingsCard
                    to="/settings/about"
                    icon={<Info className="text-emerald-400" size={24} />}
                    iconBg="bg-emerald-500/10"
                    title="About"
                    description="Version info and credits"
                    preview={updateState?.currentDisplayVersion || 'Version info'}
                />
            </div>
        </div>
    )
}

function getPathTail(path: string): string {
    const normalized = String(path || '').trim().replace(/[\\/]+$/, '')
    if (!normalized) return ''
    const parts = normalized.split(/[/\\]/)
    return parts[parts.length - 1] || normalized
}
