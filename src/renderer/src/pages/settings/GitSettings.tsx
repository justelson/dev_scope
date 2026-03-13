import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, GitBranch, GitPullRequest, Layers3, RefreshCw, Sparkles, UserRound } from 'lucide-react'
import { Checkbox, Input, Select, Textarea } from '@/components/ui/FormControls'
import { useSettings } from '@/lib/settings'
import { cn } from '@/lib/utils'

type GitSettingsTab = 'defaults' | 'workflow' | 'pull-requests' | 'identity' | 'related'

const TABS: Array<{ id: GitSettingsTab; label: string; icon: React.ReactNode }> = [
    { id: 'pull-requests', label: 'Pull Requests', icon: <GitPullRequest size={14} className="text-violet-300" /> },
    { id: 'workflow', label: 'Workflow', icon: <RefreshCw size={14} className="text-sky-300" /> },
    { id: 'defaults', label: 'Defaults', icon: <GitBranch size={14} className="text-orange-300" /> },
    { id: 'identity', label: 'Identity', icon: <UserRound size={14} className="text-emerald-300" /> },
    { id: 'related', label: 'Related', icon: <Layers3 size={14} className="text-amber-300" /> }
]

export default function GitSettings() {
    const { settings, updateSettings } = useSettings()
    const [activeTab, setActiveTab] = useState<GitSettingsTab>('pull-requests')
    const [globalAuthorDraft, setGlobalAuthorDraft] = useState({ name: '', email: '' })
    const [savedGlobalAuthor, setSavedGlobalAuthor] = useState({ name: '', email: '' })
    const [globalAuthorMessage, setGlobalAuthorMessage] = useState<string>('')
    const [globalAuthorLoading, setGlobalAuthorLoading] = useState(false)

    useEffect(() => {
        let cancelled = false
        setGlobalAuthorLoading(true)
        void window.devscope.getGlobalGitUser()
            .then((result) => {
                if (cancelled) return
                const nextAuthor = result?.success && result.user
                    ? { name: String(result.user.name || ''), email: String(result.user.email || '') }
                    : { name: '', email: '' }
                setGlobalAuthorDraft(nextAuthor)
                setSavedGlobalAuthor(nextAuthor)
                setGlobalAuthorMessage(result?.success ? '' : (result?.error || 'Failed to read global Git author.'))
            })
            .catch((err: any) => {
                if (!cancelled) {
                    setGlobalAuthorMessage(err?.message || 'Failed to read global Git author.')
                }
            })
            .finally(() => {
                if (!cancelled) {
                    setGlobalAuthorLoading(false)
                }
            })
        return () => {
            cancelled = true
        }
    }, [])

    const globalAuthorDirty = useMemo(
        () => globalAuthorDraft.name.trim() !== savedGlobalAuthor.name.trim() || globalAuthorDraft.email.trim() !== savedGlobalAuthor.email.trim(),
        [globalAuthorDraft.email, globalAuthorDraft.name, savedGlobalAuthor.email, savedGlobalAuthor.name]
    )

    const saveGlobalAuthor = async () => {
        const name = globalAuthorDraft.name.trim()
        const email = globalAuthorDraft.email.trim()
        if (!name || !email) {
            setGlobalAuthorMessage('Name and email are both required.')
            return
        }
        setGlobalAuthorLoading(true)
        try {
            const result = await window.devscope.setGlobalGitUser({ name, email })
            if (!result?.success) {
                throw new Error(result?.error || 'Failed to save global Git author.')
            }
            setSavedGlobalAuthor({ name, email })
            setGlobalAuthorMessage('Global Git author updated.')
        } catch (err: any) {
            setGlobalAuthorMessage(err?.message || 'Failed to save global Git author.')
        } finally {
            setGlobalAuthorLoading(false)
        }
    }

    const chooseGlobalGuideFile = async () => {
        const result = await window.devscope.selectMarkdownFile()
        if (!result?.success || result.cancelled || !result.filePath) return
        updateSettings({
            gitPullRequestGlobalGuide: {
                ...settings.gitPullRequestGlobalGuide,
                mode: 'file',
                filePath: result.filePath
            }
        })
    }

    return (
        <div className="animate-fadeIn">
            <div className="mb-6 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="rounded-lg bg-orange-500/10 p-2">
                        <GitBranch className="text-orange-400" size={24} />
                    </div>
                    <div>
                        <h1 className="text-xl font-semibold text-sparkle-text">Git</h1>
                        <p className="text-sm text-sparkle-text-secondary">PR defaults, branch behavior, and Git identity live here.</p>
                    </div>
                </div>
                <Link
                    to="/settings"
                    className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-sparkle-card px-4 py-2 text-sm text-sparkle-text transition-all hover:border-white/20 hover:bg-white/[0.04] hover:text-white"
                >
                    <ArrowLeft size={16} />
                    Back to Settings
                </Link>
            </div>

            <div className="mb-6 grid grid-cols-2 gap-3 xl:grid-cols-5">
                {TABS.map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={cn(
                            'rounded-xl border px-4 py-3 text-left transition-all bg-sparkle-card',
                            activeTab === tab.id
                                ? 'border-[var(--accent-primary)]/45 bg-white/[0.04]'
                                : 'border-white/10 hover:border-white/20 hover:bg-white/[0.04]'
                        )}
                    >
                        <div className="flex items-center gap-2">
                            {tab.icon}
                            <span className="text-sm font-medium text-sparkle-text">{tab.label}</span>
                        </div>
                    </button>
                ))}
            </div>

            {activeTab === 'pull-requests' && (
                <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.08fr_0.92fr]">
                    <Section title="Global PR Defaults" description="These values seed the project-level PR flow until a project overrides them.">
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                            <Field label="Default guide source">
                                <Select
                                    value={settings.gitPullRequestDefaultGuideSource}
                                    onChange={(value) => updateSettings({ gitPullRequestDefaultGuideSource: value as typeof settings.gitPullRequestDefaultGuideSource })}
                                    options={[
                                        { value: 'global', label: 'Global guide' },
                                        { value: 'repo-template', label: 'Repo template' },
                                        { value: 'none', label: 'None' }
                                    ]}
                                />
                            </Field>
                            <Field label="Default target branch">
                                <Input value={settings.gitPullRequestDefaultTargetBranch} onChange={(value) => updateSettings({ gitPullRequestDefaultTargetBranch: value.trim() || 'main' })} />
                            </Field>
                            <Field label="Default change source">
                                <Select
                                    value={settings.gitPullRequestDefaultChangeSource}
                                    onChange={(value) => updateSettings({ gitPullRequestDefaultChangeSource: value as typeof settings.gitPullRequestDefaultChangeSource })}
                                    options={[
                                        { value: 'all-local-work', label: 'All local work' },
                                        { value: 'unstaged', label: 'Unstaged changes' },
                                        { value: 'staged', label: 'Staged changes' },
                                        { value: 'local-commits', label: 'Local commits' }
                                    ]}
                                />
                            </Field>
                            <Field label="Default PR state">
                                <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                                    <Checkbox
                                        checked={settings.gitPullRequestDefaultDraft}
                                        onChange={(checked) => updateSettings({ gitPullRequestDefaultDraft: checked })}
                                        label={settings.gitPullRequestDefaultDraft ? 'Create draft PRs by default' : 'Open PRs ready for review by default'}
                                        description="Projects can still override this in their own PR modal."
                                        size="sm"
                                    />
                                </div>
                            </Field>
                        </div>
                    </Section>

                    <Section title="Global PR Guide" description="This is the universal fallback guide. Projects can override it in the PR flow.">
                        <div className="space-y-4">
                            <Field label="Guide mode">
                                <Select
                                    value={settings.gitPullRequestGlobalGuide.mode}
                                    onChange={(value) => updateSettings({
                                        gitPullRequestGlobalGuide: {
                                            ...settings.gitPullRequestGlobalGuide,
                                            mode: value as typeof settings.gitPullRequestGlobalGuide.mode
                                        }
                                    })}
                                    options={[
                                        { value: 'text', label: 'Write it here' },
                                        { value: 'file', label: 'Reference a .md file' }
                                    ]}
                                />
                            </Field>

                            {settings.gitPullRequestGlobalGuide.mode === 'text' ? (
                                <Field label="Global guide note">
                                    <Textarea
                                        value={settings.gitPullRequestGlobalGuide.text}
                                        onChange={(value) => updateSettings({
                                            gitPullRequestGlobalGuide: {
                                                ...settings.gitPullRequestGlobalGuide,
                                                text: value
                                            }
                                        })}
                                        rows={12}
                                        placeholder="Describe the PR format and checklist you want across projects."
                                    />
                                </Field>
                            ) : (
                                <div className="rounded-xl border border-white/10 bg-black/20 p-4">
                                    <div className="flex flex-wrap items-center justify-between gap-3">
                                        <div className="min-w-0">
                                            <p className="text-sm font-medium text-white/82">
                                                {settings.gitPullRequestGlobalGuide.filePath ? tail(settings.gitPullRequestGlobalGuide.filePath) : 'No guide file selected'}
                                            </p>
                                            <p className="mt-1 truncate text-xs text-white/45">
                                                {settings.gitPullRequestGlobalGuide.filePath || 'Choose a markdown guide to use as the global fallback.'}
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <button
                                                type="button"
                                                onClick={() => { void chooseGlobalGuideFile() }}
                                                className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white/75 transition-all hover:border-white/20 hover:bg-white/[0.05] hover:text-white"
                                            >
                                                Choose .md
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => updateSettings({
                                                    gitPullRequestGlobalGuide: {
                                                        ...settings.gitPullRequestGlobalGuide,
                                                        filePath: ''
                                                    }
                                                })}
                                                className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-white/55 transition-all hover:border-white/20 hover:bg-white/[0.04] hover:text-white"
                                            >
                                                Clear
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}

                            <Notice>
                                Priority: project guide override, then this global guide, then repo template, then DevScope&apos;s built-in draft structure.
                            </Notice>
                        </div>
                    </Section>
                </div>
            )}

            {activeTab === 'workflow' && (
                <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                    <Section title="Refresh Behavior" description="Controls how aggressively the app keeps Git data fresh.">
                        <ToggleRow
                            title="Auto-refresh Git on project open"
                            description="Refresh status, history, remotes, and branches when a project details page opens."
                            checked={settings.gitAutoRefreshOnProjectOpen}
                            onChange={(checked) => updateSettings({ gitAutoRefreshOnProjectOpen: checked })}
                        />
                    </Section>
                    <Section title="Safety" description="Checks that prevent destructive or confusing Git actions.">
                        <div className="space-y-4">
                            <ToggleRow
                                title="Warn on author mismatch"
                                description="Confirm before committing when the current Git user does not match the detected repository owner."
                                checked={settings.gitWarnOnAuthorMismatch}
                                onChange={(checked) => updateSettings({ gitWarnOnAuthorMismatch: checked })}
                            />
                            <ToggleRow
                                title="Confirm partial push range"
                                description="Show the local-only push approval modal before pushing only part of the commit chain."
                                checked={settings.gitConfirmPartialPushRange}
                                onChange={(checked) => updateSettings({ gitConfirmPartialPushRange: checked })}
                            />
                        </div>
                    </Section>
                </div>
            )}

            {activeTab === 'defaults' && (
                <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                    <Section title="Init Defaults" description="Used when you initialize Git inside Project Details.">
                        <Field label="Default initial branch">
                            <Input value={settings.gitInitDefaultBranch} onChange={(value) => updateSettings({ gitInitDefaultBranch: value.trim() || 'main' })} />
                        </Field>
                        <div className="mt-4 space-y-4">
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
                    </Section>
                    <Section title="Bulk Action Scope" description="Used by stage-all and unstage-all actions.">
                        <div className="grid grid-cols-1 gap-3">
                            <ChoiceCard active={settings.gitBulkActionScope === 'project'} title="Project only" description="Affects files inside the current project folder only." onClick={() => updateSettings({ gitBulkActionScope: 'project' })} />
                            <ChoiceCard active={settings.gitBulkActionScope === 'repo'} title="Whole repository" description="Affects the full repo, even when the project lives in a subfolder." onClick={() => updateSettings({ gitBulkActionScope: 'repo' })} />
                        </div>
                    </Section>
                </div>
            )}

            {activeTab === 'identity' && (
                <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                    <Section title="Global Git Author" description="Switch the global commit author used by Git on this machine.">
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                            <Field label="Name">
                                <Input value={globalAuthorDraft.name} onChange={(value) => setGlobalAuthorDraft((prev) => ({ ...prev, name: value }))} placeholder="Jane Doe" />
                            </Field>
                            <Field label="Email">
                                <Input value={globalAuthorDraft.email} onChange={(value) => setGlobalAuthorDraft((prev) => ({ ...prev, email: value }))} placeholder="jane@example.com" type="email" />
                            </Field>
                        </div>
                        {globalAuthorMessage ? <Notice className="mt-4">{globalAuthorMessage}</Notice> : null}
                        <div className="mt-4 flex flex-wrap items-center gap-3">
                            <button
                                onClick={() => void saveGlobalAuthor()}
                                disabled={globalAuthorLoading || !globalAuthorDirty}
                                className={cn(
                                    'rounded-xl border px-4 py-2.5 text-sm transition-all',
                                    globalAuthorLoading || !globalAuthorDirty
                                        ? 'border-white/10 bg-white/5 text-white/35 cursor-not-allowed'
                                        : 'border-emerald-500/40 bg-emerald-500/15 text-emerald-200 hover:bg-emerald-500/25'
                                )}
                            >
                                {globalAuthorLoading ? 'Saving...' : 'Save Global Author'}
                            </button>
                        </div>
                    </Section>
                    <Section title="Browser PR Drafting" description="DevScope now keeps PR help simple and browser-based.">
                        <div className="space-y-4">
                            <Notice>
                                DevScope drafts the PR title and body from your repo context, then opens the GitHub PR page in your browser.
                            </Notice>
                            <div className="space-y-3 text-sm text-sparkle-text-secondary">
                                <p>No GitHub token, CLI install, or fork automation is required for this flow.</p>
                                <p>If the branch is still local-only, push it yourself first and then open the PR draft from DevScope.</p>
                            </div>
                        </div>
                    </Section>
                    <Section title="What This Does" description="Git author switching and remote provider sign-in are different layers.">
                        <div className="space-y-3 text-sm text-sparkle-text-secondary">
                            <p>This updates your global <code className="text-sparkle-text">user.name</code> and <code className="text-sparkle-text">user.email</code>.</p>
                            <p>PR drafting in DevScope is browser-based. Normal Git push auth still depends on your Git credentials, SSH keys, or credential manager.</p>
                            <p>The next useful layer after this would be saved author profiles plus more repo-specific drafting presets.</p>
                        </div>
                    </Section>
                </div>
            )}

            {activeTab === 'related' && (
                <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                    <Section title="Related Settings" description="Git-adjacent controls that live elsewhere.">
                        <div className="grid grid-cols-1 gap-3">
                            <Link to="/settings/ai" className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-sparkle-text transition-all hover:border-white/20 hover:bg-white/[0.04]">
                                <Sparkles size={16} className="text-violet-300" />
                                AI providers and API keys
                            </Link>
                            <Link to="/settings/projects" className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-sparkle-text transition-all hover:border-white/20 hover:bg-white/[0.04]">
                                <Layers3 size={16} className="text-indigo-300" />
                                Projects and indexing
                            </Link>
                        </div>
                    </Section>
                    <Section title="Next Good Additions" description="Useful follow-on work after this first PR workflow.">
                        <ul className="space-y-2 text-sm text-sparkle-text-secondary">
                            <li>Provider-specific PR creation with tokens instead of browser handoff.</li>
                            <li>Saved author profiles for one-click switching.</li>
                            <li>Saved branch presets for feature, fix, and chore work.</li>
                            <li>Per-project repo auth health and provider badges.</li>
                        </ul>
                    </Section>
                </div>
            )}
        </div>
    )
}

function Section({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
    return (
        <div className="rounded-xl border border-white/10 bg-sparkle-card p-5">
            <h2 className="font-semibold text-sparkle-text">{title}</h2>
            <p className="mt-1 text-sm text-sparkle-text-secondary">{description}</p>
            <div className="mt-4">{children}</div>
        </div>
    )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div>
            <p className="mb-2 text-[11px] uppercase tracking-[0.18em] text-white/35">{label}</p>
            {children}
        </div>
    )
}

function ToggleRow({ title, description, checked, onChange }: { title: string; description: string; checked: boolean; onChange: (checked: boolean) => void }) {
    return (
        <label className="flex items-start justify-between gap-4 rounded-xl border border-white/10 bg-black/20 px-4 py-3">
            <div>
                <div className="text-sm font-medium text-sparkle-text">{title}</div>
                <div className="mt-1 text-xs text-sparkle-text-muted">{description}</div>
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
                    checked ? 'border-[var(--accent-primary)]/60 bg-[var(--accent-primary)]/30' : 'border-white/10 bg-white/5'
                )}
            >
                <span className={cn('inline-block h-4 w-4 translate-x-1 rounded-full bg-white transition-transform', checked && 'translate-x-6')} />
            </button>
        </label>
    )
}

function ChoiceCard({ active, title, description, onClick }: { active: boolean; title: string; description: string; onClick: () => void }) {
    return (
        <button
            onClick={onClick}
            className={cn(
                'rounded-xl border px-4 py-3 text-left transition-all',
                active ? 'border-cyan-500/40 bg-cyan-500/10' : 'border-white/10 bg-black/20 hover:border-white/20 hover:bg-white/[0.04]'
            )}
        >
            <div className="text-sm font-medium text-sparkle-text">{title}</div>
            <div className="mt-1 text-xs text-sparkle-text-muted">{description}</div>
        </button>
    )
}

function Notice({ children, className }: { children: React.ReactNode; className?: string }) {
    return <div className={cn('rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-sparkle-text-secondary', className)}>{children}</div>
}

function tail(path: string): string {
    const normalized = String(path || '').trim().replace(/[\\/]+$/, '')
    if (!normalized) return ''
    const parts = normalized.split(/[/\\]/)
    return parts[parts.length - 1] || normalized
}
