import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
    ArrowLeft,
    GitBranch,
    RefreshCw,
    Shield,
    Layers3,
    Sparkles,
    UserRound,
    CheckCircle2,
    AlertCircle
} from 'lucide-react'
import { useSettings } from '@/lib/settings'
import { cn } from '@/lib/utils'

type InitBranchPreset = 'main' | 'master' | 'custom'
type GitSettingsTab = 'defaults' | 'workflow' | 'identity' | 'related'

function resolveInitBranchPreset(branch: string): InitBranchPreset {
    const normalized = String(branch || '').trim().toLowerCase()
    if (normalized === 'main') return 'main'
    if (normalized === 'master') return 'master'
    return 'custom'
}

const TABS: Array<{
    id: GitSettingsTab
    label: string
    icon: React.ReactNode
    description: string
}> = [
    {
        id: 'defaults',
        label: 'Defaults',
        icon: <GitBranch size={14} className="text-orange-300" />,
        description: 'Init presets'
    },
    {
        id: 'workflow',
        label: 'Workflow',
        icon: <RefreshCw size={14} className="text-sky-300" />,
        description: 'Refresh and bulk scope'
    },
    {
        id: 'identity',
        label: 'Identity',
        icon: <UserRound size={14} className="text-emerald-300" />,
        description: 'Author switching'
    },
    {
        id: 'related',
        label: 'Related',
        icon: <Layers3 size={14} className="text-violet-300" />,
        description: 'Adjacent settings'
    }
]

export default function GitSettings() {
    const { settings, updateSettings } = useSettings()
    const [activeTab, setActiveTab] = useState<GitSettingsTab>('defaults')
    const [globalAuthorDraft, setGlobalAuthorDraft] = useState({ name: '', email: '' })
    const [savedGlobalAuthor, setSavedGlobalAuthor] = useState({ name: '', email: '' })
    const [globalAuthorLoaded, setGlobalAuthorLoaded] = useState(false)
    const [globalAuthorLoading, setGlobalAuthorLoading] = useState(false)
    const [globalAuthorSaving, setGlobalAuthorSaving] = useState(false)
    const [globalAuthorMessage, setGlobalAuthorMessage] = useState<{ tone: 'success' | 'error' | 'info'; text: string } | null>(null)
    const initBranchPreset = resolveInitBranchPreset(settings.gitInitDefaultBranch)

    useEffect(() => {
        let cancelled = false
        setGlobalAuthorLoading(true)

        void window.devscope.getGlobalGitUser()
            .then((result) => {
                if (cancelled) return
                if (result?.success && result.user) {
                    const nextAuthor = {
                        name: String(result.user.name || ''),
                        email: String(result.user.email || '')
                    }
                    setGlobalAuthorDraft(nextAuthor)
                    setSavedGlobalAuthor(nextAuthor)
                    setGlobalAuthorMessage(null)
                    return
                }
                if (result?.success) {
                    setGlobalAuthorDraft({ name: '', email: '' })
                    setSavedGlobalAuthor({ name: '', email: '' })
                    setGlobalAuthorMessage({
                        tone: 'info',
                        text: 'No global Git author is configured yet.'
                    })
                    return
                }
                setGlobalAuthorMessage({
                    tone: 'error',
                    text: result?.error || 'Failed to read global Git author.'
                })
            })
            .catch((err: any) => {
                if (cancelled) return
                setGlobalAuthorMessage({
                    tone: 'error',
                    text: err?.message || 'Failed to read global Git author.'
                })
            })
            .finally(() => {
                if (!cancelled) {
                    setGlobalAuthorLoading(false)
                    setGlobalAuthorLoaded(true)
                }
            })

        return () => {
            cancelled = true
        }
    }, [])

    const globalAuthorDirty = useMemo(() => {
        if (!globalAuthorLoaded) return false
        return (
            globalAuthorDraft.name.trim() !== savedGlobalAuthor.name.trim()
            || globalAuthorDraft.email.trim() !== savedGlobalAuthor.email.trim()
        )
    }, [globalAuthorDraft.email, globalAuthorDraft.name, globalAuthorLoaded, savedGlobalAuthor.email, savedGlobalAuthor.name])

    const saveGlobalAuthor = async () => {
        const name = globalAuthorDraft.name.trim()
        const email = globalAuthorDraft.email.trim()
        if (!name || !email) {
            setGlobalAuthorMessage({
                tone: 'error',
                text: 'Name and email are both required.'
            })
            return
        }

        setGlobalAuthorSaving(true)
        try {
            const result = await window.devscope.setGlobalGitUser({ name, email })
            if (!result?.success) {
                throw new Error(result?.error || 'Failed to save global Git author.')
            }
            setSavedGlobalAuthor({ name, email })
            setGlobalAuthorDraft({ name, email })
            setGlobalAuthorMessage({
                tone: 'success',
                text: 'Global Git author updated.'
            })
        } catch (err: any) {
            setGlobalAuthorMessage({
                tone: 'error',
                text: err?.message || 'Failed to save global Git author.'
            })
        } finally {
            setGlobalAuthorSaving(false)
        }
    }

    return (
        <div className="animate-fadeIn">
            <div className="mb-6">
                <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-orange-500/10">
                            <GitBranch className="text-orange-400" size={24} />
                        </div>
                        <div>
                            <h1 className="text-xl font-semibold text-sparkle-text">Git</h1>
                            <p className="text-sm text-sparkle-text-secondary">Use tabs to manage defaults, workflow, and identity without one oversized page.</p>
                        </div>
                    </div>
                    <Link
                        to="/settings"
                        className="inline-flex items-center gap-2 px-4 py-2 text-sm text-sparkle-text hover:text-[var(--accent-primary)] bg-sparkle-card hover:bg-sparkle-card-hover border border-sparkle-border rounded-lg transition-all shrink-0"
                    >
                        <ArrowLeft size={16} />
                        Back to Settings
                    </Link>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-3 xl:grid-cols-4 mb-6">
                {TABS.map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={cn(
                            'rounded-xl border px-4 py-3 text-left transition-all bg-sparkle-card',
                            activeTab === tab.id
                                ? 'border-[var(--accent-primary)]/50 shadow-lg shadow-[var(--accent-primary)]/5'
                                : 'border-sparkle-border hover:border-sparkle-border-secondary'
                        )}
                    >
                        <div className="flex items-center gap-2">
                            {tab.icon}
                            <span className="text-sm font-medium text-sparkle-text">{tab.label}</span>
                        </div>
                        <div className="mt-1 text-xs text-sparkle-text-muted">{tab.description}</div>
                    </button>
                ))}
            </div>

            {activeTab === 'defaults' && (
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                    <SettingsSection
                        title="Repository Defaults"
                        description="Used when you initialize Git inside Project Details."
                        icon={<GitBranch size={16} className="text-orange-300" />}
                    >
                        <div>
                            <p className="text-sm font-medium text-sparkle-text mb-3">Default initial branch</p>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                {(['main', 'master', 'custom'] as const).map((preset) => (
                                    <button
                                        key={preset}
                                        onClick={() => {
                                            if (preset === 'custom') {
                                                updateSettings({
                                                    gitInitDefaultBranch:
                                                        initBranchPreset === 'custom' && settings.gitInitDefaultBranch.trim()
                                                            ? settings.gitInitDefaultBranch
                                                            : 'develop'
                                                })
                                                return
                                            }
                                            updateSettings({ gitInitDefaultBranch: preset })
                                        }}
                                        className={cn(
                                            'rounded-xl border px-4 py-3 text-left transition-all',
                                            initBranchPreset === preset
                                                ? 'border-orange-500/50 bg-orange-500/10'
                                                : 'border-sparkle-border hover:border-sparkle-border-secondary bg-black/10'
                                        )}
                                    >
                                        <div className="text-sm font-medium text-sparkle-text capitalize">{preset}</div>
                                        <div className="text-xs text-sparkle-text-muted mt-1">
                                            {preset === 'main' ? 'Modern default' : preset === 'master' ? 'Legacy default' : 'Any branch name'}
                                        </div>
                                    </button>
                                ))}
                            </div>
                            {initBranchPreset === 'custom' && (
                                <input
                                    type="text"
                                    value={settings.gitInitDefaultBranch}
                                    onChange={(e) => updateSettings({
                                        gitInitDefaultBranch: e.target.value.trim() || 'develop'
                                    })}
                                    placeholder="develop"
                                    className="mt-3 w-full rounded-xl border border-sparkle-border bg-black/20 px-3 py-2.5 text-sm text-sparkle-text outline-none transition-colors focus:border-[var(--accent-primary)]/50"
                                />
                            )}
                        </div>
                    </SettingsSection>

                    <SettingsSection
                        title="Init Presets"
                        description="Preselected options for new repositories."
                        icon={<Layers3 size={16} className="text-amber-300" />}
                    >
                        <div className="space-y-4">
                            <ToggleRow
                                title="Create .gitignore by default"
                                description="Preselect .gitignore generation when starting a new repository."
                                checked={settings.gitInitCreateGitignore}
                                onChange={(checked) => updateSettings({ gitInitCreateGitignore: checked })}
                            />
                            <ToggleRow
                                title="Create initial commit by default"
                                description="Preselect the first commit step in the init flow."
                                checked={settings.gitInitCreateInitialCommit}
                                onChange={(checked) => updateSettings({ gitInitCreateInitialCommit: checked })}
                            />
                        </div>
                    </SettingsSection>
                </div>
            )}

            {activeTab === 'workflow' && (
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                    <SettingsSection
                        title="Refresh Behavior"
                        description="Controls how aggressively the app keeps Git data fresh."
                        icon={<RefreshCw size={16} className="text-sky-300" />}
                    >
                        <ToggleRow
                            title="Auto-refresh Git on project open"
                            description="Refresh status, history, remotes, and branches when a project details page opens."
                            checked={settings.gitAutoRefreshOnProjectOpen}
                            onChange={(checked) => updateSettings({ gitAutoRefreshOnProjectOpen: checked })}
                        />
                    </SettingsSection>

                    <SettingsSection
                        title="Bulk Action Scope"
                        description="Used by stage-all and unstage-all actions."
                        icon={<Layers3 size={16} className="text-cyan-300" />}
                    >
                        <div className="grid grid-cols-1 gap-3">
                            <button
                                onClick={() => updateSettings({ gitBulkActionScope: 'project' })}
                                className={cn(
                                    'rounded-xl border px-4 py-3 text-left transition-all',
                                    settings.gitBulkActionScope === 'project'
                                        ? 'border-cyan-500/50 bg-cyan-500/10'
                                        : 'border-sparkle-border hover:border-sparkle-border-secondary bg-black/10'
                                )}
                            >
                                <div className="text-sm font-medium text-sparkle-text">Project only</div>
                                <div className="text-xs text-sparkle-text-muted mt-1">Affects files inside the current project folder only.</div>
                            </button>
                            <button
                                onClick={() => updateSettings({ gitBulkActionScope: 'repo' })}
                                className={cn(
                                    'rounded-xl border px-4 py-3 text-left transition-all',
                                    settings.gitBulkActionScope === 'repo'
                                        ? 'border-cyan-500/50 bg-cyan-500/10'
                                        : 'border-sparkle-border hover:border-sparkle-border-secondary bg-black/10'
                                )}
                            >
                                <div className="text-sm font-medium text-sparkle-text">Whole repository</div>
                                <div className="text-xs text-sparkle-text-muted mt-1">Affects the full repo, even when this project is a subfolder.</div>
                            </button>
                        </div>
                    </SettingsSection>

                    <SettingsSection
                        title="Safety"
                        description="Checks that prevent accidental commits with the wrong identity."
                        icon={<Shield size={16} className="text-amber-300" />}
                    >
                        <ToggleRow
                            title="Warn on author mismatch"
                            description="Show a confirmation if the current Git user does not match the detected repository owner."
                            checked={settings.gitWarnOnAuthorMismatch}
                            onChange={(checked) => updateSettings({ gitWarnOnAuthorMismatch: checked })}
                        />
                    </SettingsSection>
                </div>
            )}

            {activeTab === 'identity' && (
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                    <SettingsSection
                        title="Global Git Author"
                        description="Switch the global commit author used by Git on this machine."
                        icon={<UserRound size={16} className="text-emerald-300" />}
                    >
                        <div className="space-y-4">
                            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                <div>
                                    <label className="block text-xs uppercase tracking-wide text-sparkle-text-muted mb-2">Name</label>
                                    <input
                                        type="text"
                                        value={globalAuthorDraft.name}
                                        onChange={(e) => setGlobalAuthorDraft((prev) => ({ ...prev, name: e.target.value }))}
                                        placeholder="Jane Doe"
                                        className="w-full rounded-xl border border-sparkle-border bg-black/20 px-3 py-2.5 text-sm text-sparkle-text outline-none transition-colors focus:border-[var(--accent-primary)]/50"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs uppercase tracking-wide text-sparkle-text-muted mb-2">Email</label>
                                    <input
                                        type="email"
                                        value={globalAuthorDraft.email}
                                        onChange={(e) => setGlobalAuthorDraft((prev) => ({ ...prev, email: e.target.value }))}
                                        placeholder="jane@example.com"
                                        className="w-full rounded-xl border border-sparkle-border bg-black/20 px-3 py-2.5 text-sm text-sparkle-text outline-none transition-colors focus:border-[var(--accent-primary)]/50"
                                    />
                                </div>
                            </div>

                            {globalAuthorMessage && (
                                <StatusBanner tone={globalAuthorMessage.tone}>
                                    {globalAuthorMessage.text}
                                </StatusBanner>
                            )}

                            <div className="flex flex-wrap items-center gap-3">
                                <button
                                    onClick={() => void saveGlobalAuthor()}
                                    disabled={globalAuthorLoading || globalAuthorSaving || !globalAuthorDirty}
                                    className={cn(
                                        'rounded-xl border px-4 py-2.5 text-sm transition-all',
                                        globalAuthorLoading || globalAuthorSaving || !globalAuthorDirty
                                            ? 'border-sparkle-border bg-white/5 text-sparkle-text-muted cursor-not-allowed'
                                            : 'border-emerald-500/40 bg-emerald-500/15 text-emerald-200 hover:bg-emerald-500/25'
                                    )}
                                >
                                    {globalAuthorSaving ? 'Saving...' : 'Save Global Author'}
                                </button>
                                <button
                                    onClick={() => {
                                        setGlobalAuthorLoading(true)
                                        setGlobalAuthorMessage(null)
                                        void window.devscope.getGlobalGitUser()
                                            .then((result) => {
                                                if (result?.success && result.user) {
                                                    const nextAuthor = {
                                                        name: String(result.user.name || ''),
                                                        email: String(result.user.email || '')
                                                    }
                                                    setGlobalAuthorDraft(nextAuthor)
                                                    setSavedGlobalAuthor(nextAuthor)
                                                    return
                                                }
                                                setGlobalAuthorDraft({ name: '', email: '' })
                                                setSavedGlobalAuthor({ name: '', email: '' })
                                            })
                                            .catch((err: any) => {
                                                setGlobalAuthorMessage({
                                                    tone: 'error',
                                                    text: err?.message || 'Failed to refresh global Git author.'
                                                })
                                            })
                                            .finally(() => setGlobalAuthorLoading(false))
                                    }}
                                    disabled={globalAuthorLoading || globalAuthorSaving}
                                    className="rounded-xl border border-sparkle-border bg-black/10 px-4 py-2.5 text-sm text-sparkle-text hover:border-sparkle-border-secondary transition-all"
                                >
                                    Refresh
                                </button>
                            </div>
                        </div>
                    </SettingsSection>

                    <SettingsSection
                        title="What This Does"
                        description="Git author switching and remote provider sign-in are different layers."
                        icon={<AlertCircle size={16} className="text-amber-300" />}
                    >
                        <div className="space-y-3 text-sm text-sparkle-text-secondary">
                            <p>
                                This page now switches your global <code className="text-sparkle-text">user.name</code> and <code className="text-sparkle-text">user.email</code>.
                                That changes who your commits are authored as.
                            </p>
                            <p>
                                It does not yet sign you into GitHub, GitLab, or another provider. Remote auth still depends on your Git credential manager, SSH keys, or stored tokens.
                            </p>
                            <p>
                                The right next step for full account switching is saved author profiles plus a separate remote-auth manager.
                            </p>
                        </div>
                    </SettingsSection>
                </div>
            )}

            {activeTab === 'related' && (
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                    <SettingsSection
                        title="Related Settings"
                        description="Git-adjacent controls that live elsewhere."
                        icon={<Layers3 size={16} className="text-violet-300" />}
                    >
                        <div className="grid grid-cols-1 gap-3">
                            <Link
                                to="/settings/ai"
                                className="inline-flex items-center gap-2 rounded-xl border border-sparkle-border bg-black/10 px-4 py-3 text-sm text-sparkle-text hover:border-sparkle-border-secondary hover:bg-sparkle-card-hover transition-all"
                            >
                                <Sparkles size={16} className="text-violet-300" />
                                AI commit provider and API keys
                            </Link>
                            <Link
                                to="/settings/projects"
                                className="inline-flex items-center gap-2 rounded-xl border border-sparkle-border bg-black/10 px-4 py-3 text-sm text-sparkle-text hover:border-sparkle-border-secondary hover:bg-sparkle-card-hover transition-all"
                            >
                                <Layers3 size={16} className="text-indigo-300" />
                                Projects and indexing
                            </Link>
                        </div>
                    </SettingsSection>

                    <SettingsSection
                        title="Recommended Next Git Controls"
                        description="Worth adding after this first identity pass."
                        icon={<CheckCircle2 size={16} className="text-emerald-300" />}
                    >
                        <ul className="space-y-2 text-sm text-sparkle-text-secondary">
                            <li>Saved author profiles for one-click switching.</li>
                            <li>Per-repo author override in Project Details.</li>
                            <li>Pull strategy: merge vs rebase.</li>
                            <li>Auto-fetch interval and default remote selection.</li>
                            <li>Remote credential status and provider-specific sign-in surface.</li>
                        </ul>
                    </SettingsSection>
                </div>
            )}
        </div>
    )
}

function SettingsSection({
    title,
    description,
    icon,
    children
}: {
    title: string
    description: string
    icon?: React.ReactNode
    children: React.ReactNode
}) {
    return (
        <div className="bg-sparkle-card rounded-xl border border-sparkle-border p-5">
            <div className="flex items-start gap-3 mb-4">
                {icon ? <div className="mt-0.5">{icon}</div> : null}
                <div>
                    <h2 className="font-semibold text-sparkle-text">{title}</h2>
                    <p className="text-sm text-sparkle-text-secondary mt-1">{description}</p>
                </div>
            </div>
            {children}
        </div>
    )
}

function ToggleRow({
    title,
    description,
    checked,
    onChange
}: {
    title: string
    description: string
    checked: boolean
    onChange: (checked: boolean) => void
}) {
    return (
        <label className="flex items-start justify-between gap-4 rounded-xl border border-sparkle-border bg-black/10 px-4 py-3 cursor-pointer">
            <div>
                <div className="text-sm font-medium text-sparkle-text">{title}</div>
                <div className="text-xs text-sparkle-text-muted mt-1">{description}</div>
            </div>
            <button
                type="button"
                role="switch"
                aria-checked={checked}
                onClick={(event) => {
                    event.preventDefault()
                    onChange(!checked)
                }}
                className={cn(
                    'relative mt-1 inline-flex h-6 w-11 shrink-0 items-center rounded-full border transition-colors',
                    checked
                        ? 'border-[var(--accent-primary)]/60 bg-[var(--accent-primary)]/30'
                        : 'border-sparkle-border bg-white/5'
                )}
            >
                <span
                    className={cn(
                        'inline-block h-4 w-4 translate-x-1 rounded-full bg-white transition-transform',
                        checked && 'translate-x-6'
                    )}
                />
            </button>
        </label>
    )
}

function StatusBanner({
    tone,
    children
}: {
    tone: 'success' | 'error' | 'info'
    children: React.ReactNode
}) {
    return (
        <div
            className={cn(
                'rounded-xl border px-4 py-3 text-sm',
                tone === 'success' && 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200',
                tone === 'error' && 'border-red-500/30 bg-red-500/10 text-red-200',
                tone === 'info' && 'border-sparkle-border bg-black/10 text-sparkle-text-secondary'
            )}
        >
            {children}
        </div>
    )
}
