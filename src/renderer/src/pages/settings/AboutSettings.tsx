/**
 * DevScope - About Page
 */

import { Link } from 'react-router-dom'
import { ArrowLeft, Download, ExternalLink, Github, Heart, Info, RefreshCw, Rocket } from 'lucide-react'
import { DevScopeLogoASCII } from '@/components/ui/DevScopeLogo'
import { getUpdateActionLabel, useAppUpdates } from '@/lib/app-updates'
import { cn } from '@/lib/utils'

export default function AboutSettings() {
    const {
        updateState,
        pendingAction,
        openModal,
        checkForUpdates,
        downloadUpdate,
        installUpdate,
        skipAvailableVersion,
        remindLater,
        clearSkippedVersion
    } = useAppUpdates()

    const isBusy = pendingAction !== null
    const updateSummary = getUpdateActionLabel(updateState)
    const updateMessage = updateState?.message && updateState.message !== updateState.disabledReason
        ? updateState.message
        : null

    return (
        <div className="animate-fadeIn">
            <div className="mb-6">
                <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-emerald-500/10">
                            <Info className="text-emerald-400" size={24} />
                        </div>
                        <div>
                            <h1 className="text-xl font-semibold text-sparkle-text">About DevScope</h1>
                            <p className="text-sm text-sparkle-text-secondary">Version, channel, and release updates</p>
                        </div>
                    </div>
                    <Link
                        to="/settings"
                        className="inline-flex items-center gap-2 px-4 py-2 text-sm text-sparkle-text hover:text-[var(--accent-primary)] bg-sparkle-card hover:bg-white/[0.03] border border-white/10 hover:border-white/20 rounded-lg transition-all shrink-0"
                    >
                        <ArrowLeft size={16} />
                        Back to Settings
                    </Link>
                </div>
            </div>

            <div className="space-y-6">
                <div className="bg-sparkle-card rounded-xl border border-white/10 p-8 overflow-hidden">
                    <div className="flex flex-col items-center">
                        <div className="mb-6 overflow-x-auto max-w-full">
                            <DevScopeLogoASCII />
                        </div>

                        <p className="text-sparkle-text-secondary mb-4 text-center">Developer Machine Status System</p>

                        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[var(--accent-primary)]/10 text-[var(--accent-primary)] text-sm font-medium">
                            {updateState?.currentDisplayVersion || 'v1.5 Alpha 3'}
                        </div>

                        <p className="text-xs text-sparkle-text-muted mt-3">
                            {updateState?.currentVersion || '1.5.0-alpha.3'}
                            {updateState?.channel ? ` \u2022 ${updateState.channel} channel` : ''}
                        </p>
                        <p className="text-xs text-sparkle-text-muted mt-2">by justelson</p>
                    </div>
                </div>

                <div className="bg-sparkle-card rounded-xl border border-white/10 p-5">
                    <div className="flex items-start justify-between gap-4">
                        <div>
                            <h3 className="font-semibold text-sparkle-text">App Updates</h3>
                            <p className="text-sm text-sparkle-text-secondary mt-1">
                                {updateSummary}
                            </p>
                            {updateMessage && (
                                <p className="text-xs text-amber-300 mt-2">{updateMessage}</p>
                            )}
                            {updateState?.disabledReason && (
                                <p className="text-xs text-amber-300 mt-2">{updateState.disabledReason}</p>
                            )}
                            {updateState?.repository && (
                                <p className="text-xs text-sparkle-text-muted mt-2">
                                    GitHub Releases: {updateState.repository}
                                </p>
                            )}
                            {updateState?.checkedAt && (
                                <p className="text-xs text-sparkle-text-muted mt-1">
                                    Last checked {new Date(updateState.checkedAt).toLocaleString()}
                                </p>
                            )}
                        </div>
                        <div className="flex flex-wrap justify-end gap-2">
                            <button
                                onClick={() => {
                                    clearSkippedVersion()
                                    void checkForUpdates()
                                }}
                                disabled={isBusy || !updateState?.enabled || updateState.status === 'checking'}
                                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-white/10 bg-white/[0.03] text-sparkle-text hover:bg-white/[0.06] hover:border-white/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                <RefreshCw size={16} className={cn(pendingAction === 'check' && 'animate-spin')} />
                                {updateState?.status === 'checking' ? 'Checking...' : 'Check'}
                            </button>
                            <button
                                onClick={() => { void downloadUpdate() }}
                                disabled={isBusy || updateState?.status !== 'available'}
                                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-white/10 bg-white/[0.03] text-sparkle-text hover:bg-white/[0.06] hover:border-white/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                <Download size={16} />
                                {pendingAction === 'download' ? 'Downloading...' : 'Download'}
                            </button>
                            <button
                                onClick={() => { void installUpdate() }}
                                disabled={isBusy || updateState?.status !== 'downloaded'}
                                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--accent-primary)]/12 border border-white/10 text-[var(--accent-primary)] hover:bg-[var(--accent-primary)]/18 hover:border-white/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                <Rocket size={16} />
                                {pendingAction === 'install' ? 'Restarting...' : 'Restart to Install'}
                            </button>
                            <button
                                onClick={openModal}
                                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-white/10 bg-white/[0.03] text-sparkle-text hover:bg-white/[0.06] hover:border-white/20 transition-colors"
                            >
                                <Rocket size={16} />
                                Open Update Center
                            </button>
                            {updateState?.releasePageUrl && (
                                <a
                                    href={updateState.releasePageUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-white/10 bg-white/[0.03] text-sparkle-text hover:bg-white/[0.06] hover:border-white/20 transition-colors"
                                >
                                    <ExternalLink size={16} />
                                    View Release Page
                                </a>
                            )}
                        </div>
                    </div>
                    {updateState?.status === 'available' && (
                        <div className="mt-4 flex items-center justify-end gap-2">
                            <button
                                onClick={skipAvailableVersion}
                                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-white/10 bg-white/[0.03] text-sparkle-text hover:bg-white/[0.06] hover:border-white/20 transition-colors"
                            >
                                Skip This Version
                            </button>
                        </div>
                    )}
                    {updateState?.status === 'downloaded' && (
                        <div className="mt-4 flex items-center justify-end gap-2">
                            <button
                                onClick={remindLater}
                                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-white/10 bg-white/[0.03] text-sparkle-text hover:bg-white/[0.06] hover:border-white/20 transition-colors"
                            >
                                Do It Later
                            </button>
                        </div>
                    )}
                    {updateState?.status === 'downloading' && updateState.downloadPercent !== null && (
                        <div className="mt-4">
                            <div className="h-2 rounded-full bg-white/[0.05] overflow-hidden">
                                <div
                                    className="h-full bg-[var(--accent-primary)] transition-[width] duration-300"
                                    style={{ width: `${Math.max(0, Math.min(100, updateState.downloadPercent))}%` }}
                                />
                            </div>
                            <p className="text-xs text-sparkle-text-muted mt-2">
                                {Math.round(updateState.downloadPercent)}% downloaded
                            </p>
                        </div>
                    )}
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <InfoCard label="Platform" value="Windows" />
                    <InfoCard label="Framework" value="Electron + React" />
                    <InfoCard label="Channel" value={updateState?.channel || 'alpha'} />
                    <InfoCard label="License" value="MIT" />
                </div>

                <div className="bg-sparkle-card rounded-xl border border-white/10 p-5">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                            <Heart size={20} className="text-white" />
                        </div>
                        <div>
                            <p className="text-sm text-sparkle-text-secondary">Created by</p>
                            <p className="font-semibold text-sparkle-text">justelson</p>
                        </div>
                    </div>
                </div>

                <div className="bg-sparkle-card rounded-xl border border-white/10 p-5">
                    <h3 className="font-semibold text-sparkle-text mb-4">Links</h3>
                    <div className="space-y-2">
                        <LinkRow
                            icon={<Github size={18} />}
                            label="Source Code"
                            href="https://github.com/justelson/dev_scope"
                        />
                        <LinkRow
                            icon={<ExternalLink size={18} />}
                            label="Report an Issue"
                            href="https://github.com/justelson/dev_scope/issues"
                        />
                    </div>
                </div>

                <div className="bg-sparkle-card rounded-xl border border-white/10 p-5">
                    <h3 className="font-semibold text-sparkle-text mb-4">Built With</h3>
                    <div className="flex flex-wrap gap-2">
                        {['Electron', 'React', 'TypeScript', 'Tailwind CSS', 'Vite', 'Lucide Icons'].map((tech) => (
                            <span
                                key={tech}
                                className="px-3 py-1 rounded-full bg-sparkle-accent text-sm text-sparkle-text-secondary"
                            >
                                {tech}
                            </span>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    )
}

function InfoCard({ label, value }: { label: string; value: string }) {
    return (
        <div className="bg-sparkle-card rounded-xl border border-white/10 p-4">
            <p className="text-xs text-sparkle-text-muted uppercase tracking-wide mb-1">{label}</p>
            <p className="font-semibold text-sparkle-text">{value}</p>
        </div>
    )
}

function LinkRow({ icon, label, href }: { icon: React.ReactNode; label: string; href: string }) {
    return (
        <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 p-3 rounded-lg border border-white/10 hover:border-white/20 hover:bg-white/[0.03] transition-colors group"
        >
            <span className="text-sparkle-text-secondary group-hover:text-[var(--accent-primary)] transition-colors">
                {icon}
            </span>
            <span className="text-sm text-sparkle-text group-hover:text-[var(--accent-primary)] transition-colors">
                {label}
            </span>
            <ExternalLink size={14} className="ml-auto text-sparkle-text-muted" />
        </a>
    )
}
