/**
 * DevScope - Scanning Settings Page
 */

import { Link } from 'react-router-dom'
import { ArrowLeft, Layers, Check, Code, Package, Hammer, Container, GitBranch, Cpu, Bot } from 'lucide-react'
import { useSettings } from '@/lib/settings'
import { cn } from '@/lib/utils'

const CATEGORIES = [
    { id: 'language', label: 'Languages & Runtimes', icon: Code, color: 'text-blue-400', bg: 'bg-blue-500/10' },
    { id: 'package_manager', label: 'Package Managers', icon: Package, color: 'text-green-400', bg: 'bg-green-500/10' },
    { id: 'build_tool', label: 'Build Tools', icon: Hammer, color: 'text-yellow-400', bg: 'bg-yellow-500/10' },
    { id: 'container', label: 'Containers', icon: Container, color: 'text-cyan-400', bg: 'bg-cyan-500/10' },
    { id: 'version_control', label: 'Version Control', icon: GitBranch, color: 'text-orange-400', bg: 'bg-orange-500/10' },
    { id: 'ai_runtime', label: 'AI Runtimes', icon: Cpu, color: 'text-purple-400', bg: 'bg-purple-500/10' },
    { id: 'ai_agent', label: 'AI Agents', icon: Bot, color: 'text-pink-400', bg: 'bg-pink-500/10' },
]

export default function ScanningSettings() {
    const { settings, updateSettings } = useSettings()

    const toggleCategory = (categoryId: string) => {
        const current = settings.enabledCategories
        const updated = current.includes(categoryId)
            ? current.filter(c => c !== categoryId)
            : [...current, categoryId]
        updateSettings({ enabledCategories: updated })
    }

    const enableAll = () => {
        updateSettings({ enabledCategories: CATEGORIES.map(c => c.id) })
    }

    const disableAll = () => {
        updateSettings({ enabledCategories: [] })
    }

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
                    <div className="p-2 rounded-lg bg-orange-500/10">
                        <Layers className="text-orange-400" size={24} />
                    </div>
                    <div>
                        <h1 className="text-xl font-semibold text-sparkle-text">Scanning</h1>
                        <p className="text-sm text-sparkle-text-secondary">Choose which tool categories to detect</p>
                    </div>
                </div>
            </div>

            <div className="space-y-6">
                {/* Quick Actions */}
                <div className="flex gap-2">
                    <button
                        onClick={enableAll}
                        className="px-4 py-2 text-sm rounded-lg border border-sparkle-border hover:border-[var(--accent-primary)] hover:bg-[var(--accent-primary)]/10 transition-all"
                    >
                        Enable All
                    </button>
                    <button
                        onClick={disableAll}
                        className="px-4 py-2 text-sm rounded-lg border border-sparkle-border hover:border-red-500 hover:bg-red-500/10 transition-all"
                    >
                        Disable All
                    </button>
                </div>

                {/* Categories */}
                <div className="bg-sparkle-card rounded-xl border border-sparkle-border p-5">
                    <h2 className="font-semibold text-sparkle-text mb-1">Tool Categories</h2>
                    <p className="text-sm text-sparkle-text-secondary mb-4">
                        Select which categories to include in scans. Disabled categories won't appear in DevScope.
                    </p>
                    
                    <div className="space-y-2">
                        {CATEGORIES.map((cat) => {
                            const Icon = cat.icon
                            const isEnabled = settings.enabledCategories.includes(cat.id)
                            
                            return (
                                <button
                                    key={cat.id}
                                    onClick={() => toggleCategory(cat.id)}
                                    className={cn(
                                        'w-full px-4 py-3 rounded-xl border-2 transition-all flex items-center gap-4',
                                        isEnabled
                                            ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)]/5'
                                            : 'border-sparkle-border hover:border-sparkle-border-secondary opacity-60'
                                    )}
                                >
                                    <div className={cn('p-2 rounded-lg', cat.bg)}>
                                        <Icon size={20} className={cat.color} />
                                    </div>
                                    <span className="flex-1 text-left font-medium">{cat.label}</span>
                                    <div className={cn(
                                        'w-6 h-6 rounded-md border-2 flex items-center justify-center transition-all',
                                        isEnabled
                                            ? 'bg-[var(--accent-primary)] border-[var(--accent-primary)]'
                                            : 'border-sparkle-border'
                                    )}>
                                        {isEnabled && <Check size={14} className="text-white" />}
                                    </div>
                                </button>
                            )
                        })}
                    </div>
                </div>

                {/* Summary */}
                <div className="text-center text-sm text-sparkle-text-secondary">
                    {settings.enabledCategories.length} of {CATEGORIES.length} categories enabled
                </div>
            </div>
        </div>
    )
}
