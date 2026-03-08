/**
 * DevScope - Terminal Settings Page
 */

import { Link } from 'react-router-dom'
import { ArrowLeft, Terminal } from 'lucide-react'
import { useSettings } from '@/lib/settings'
import { cn } from '@/lib/utils'

export default function TerminalSettings() {
    const { settings, updateSettings } = useSettings()

    return (
        <div className="animate-fadeIn">
            {/* Header */}
            <div className="mb-6">
                <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-green-500/10">
                            <Terminal className="text-green-400" size={24} />
                        </div>
                        <div>
                            <h1 className="text-xl font-semibold text-sparkle-text">Terminal</h1>
                            <p className="text-sm text-sparkle-text-secondary">Shell and terminal preferences</p>
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

            <div className="space-y-6">
                {/* Default Terminal */}
                <SettingsSection title="Default Terminal" description="Choose which terminal shell to use by default">
                    <div className="flex gap-3">
                        <button
                            onClick={() => updateSettings({ defaultShell: 'powershell' })}
                            className={cn(
                                'flex-1 px-4 py-4 rounded-xl border-2 transition-all flex flex-col items-center gap-2',
                                settings.defaultShell === 'powershell'
                                    ? 'border-blue-500 bg-blue-500/10'
                                    : 'border-sparkle-border hover:border-sparkle-border-secondary'
                            )}
                        >
                            <span className="text-2xl font-bold text-blue-400">PS</span>
                            <span className="text-sm font-medium">PowerShell</span>
                            <span className="text-xs text-sparkle-text-muted">Recommended</span>
                        </button>
                        <button
                            onClick={() => updateSettings({ defaultShell: 'cmd' })}
                            className={cn(
                                'flex-1 px-4 py-4 rounded-xl border-2 transition-all flex flex-col items-center gap-2',
                                settings.defaultShell === 'cmd'
                                    ? 'border-yellow-500 bg-yellow-500/10'
                                    : 'border-sparkle-border hover:border-sparkle-border-secondary'
                            )}
                        >
                            <span className="text-2xl font-bold text-yellow-400">CMD</span>
                            <span className="text-sm font-medium">Command Prompt</span>
                            <span className="text-xs text-sparkle-text-muted">Classic</span>
                        </button>
                    </div>
                </SettingsSection>
            </div>
        </div>
    )
}

function SettingsSection({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
    return (
        <div className="bg-sparkle-card rounded-xl border border-sparkle-border p-5">
            <h2 className="font-semibold text-sparkle-text mb-1">{title}</h2>
            <p className="text-sm text-sparkle-text-secondary mb-4">{description}</p>
            {children}
        </div>
    )
}


