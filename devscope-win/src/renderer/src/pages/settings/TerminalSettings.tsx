/**
 * DevScope - Terminal Settings Page
 */

import { Link } from 'react-router-dom'
import { ArrowLeft, Terminal } from 'lucide-react'
import { useSettings } from '@/lib/settings'
import { cn } from '@/lib/utils'

const FONT_SIZES = [12, 13, 14, 15, 16, 18, 20]
const BUFFER_SIZES = [
    { value: 50000, label: '50 KB' },
    { value: 100000, label: '100 KB' },
    { value: 250000, label: '250 KB' },
    { value: 500000, label: '500 KB' },
    { value: 1000000, label: '1 MB' },
]

export default function TerminalSettings() {
    const { settings, updateSettings } = useSettings()

    return (
        <div className="animate-fadeIn">
            {/* Header */}
            <div className="mb-6">
                <Link 
                    to="/settings" 
                    className="inline-flex items-center gap-2 text-sm text-sparkle-text-secondary hover:text-[var(--accent-primary)] transition-colors mb-4"
                >
                    <ArrowLeft size={16} />
                    Back to Settings
                </Link>
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-green-500/10">
                        <Terminal className="text-green-400" size={24} />
                    </div>
                    <div>
                        <h1 className="text-xl font-semibold text-sparkle-text">Terminal</h1>
                        <p className="text-sm text-sparkle-text-secondary">Shell and terminal preferences</p>
                    </div>
                </div>
            </div>

            <div className="space-y-6">
                {/* Default Shell */}
                <SettingsSection title="Default Shell" description="Choose which shell to use by default">
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

                {/* Font Size */}
                <SettingsSection title="Font Size" description="Adjust the terminal text size">
                    <div className="flex gap-2 flex-wrap">
                        {FONT_SIZES.map((size) => (
                            <button
                                key={size}
                                onClick={() => updateSettings({ terminalFontSize: size })}
                                className={cn(
                                    'w-14 h-14 rounded-xl border-2 transition-all text-sm font-mono',
                                    settings.terminalFontSize === size
                                        ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)]/10 text-[var(--accent-primary)]'
                                        : 'border-sparkle-border hover:border-sparkle-border-secondary'
                                )}
                            >
                                {size}px
                            </button>
                        ))}
                    </div>
                    {/* Preview */}
                    <div className="mt-4 p-4 bg-[#0a0f1a] rounded-lg border border-white/5">
                        <p className="text-sparkle-text-muted text-xs mb-2">Preview:</p>
                        <p 
                            className="font-mono text-green-400"
                            style={{ fontSize: `${settings.terminalFontSize}px` }}
                        >
                            PS C:\Users\dev&gt; npm install
                        </p>
                    </div>
                </SettingsSection>

                {/* Max Output Buffer */}
                <SettingsSection title="Max Output Buffer" description="Limit terminal output to prevent memory issues with large outputs">
                    <div className="flex gap-2 flex-wrap">
                        {BUFFER_SIZES.map((opt) => (
                            <button
                                key={opt.value}
                                onClick={() => updateSettings({ maxOutputBuffer: opt.value })}
                                className={cn(
                                    'px-4 py-3 rounded-xl border-2 transition-all text-sm',
                                    settings.maxOutputBuffer === opt.value
                                        ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)]/10 text-[var(--accent-primary)]'
                                        : 'border-sparkle-border hover:border-sparkle-border-secondary'
                                )}
                            >
                                {opt.label}
                            </button>
                        ))}
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
