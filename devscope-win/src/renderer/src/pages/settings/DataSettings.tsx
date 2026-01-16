/**
 * DevScope - Data & Export Settings Page
 */

import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Download, Trash2, RotateCcw, RefreshCw, CheckCircle, AlertCircle } from 'lucide-react'
import { useSettings } from '@/lib/settings'
import { updateCache } from '@/lib/refreshCache'
import { cn } from '@/lib/utils'

export default function DataSettings() {
    const { settings, resetSettings, clearCache } = useSettings()
    const [isRefreshing, setIsRefreshing] = useState(false)
    const [exportStatus, setExportStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
    const [cacheCleared, setCacheCleared] = useState(false)
    const [showResetConfirm, setShowResetConfirm] = useState(false)

    const handleRefreshAll = async () => {
        setIsRefreshing(true)
        try {
            const data = await window.devscope.refreshAll()
            updateCache(data)
            window.dispatchEvent(new CustomEvent('devscope:refresh', { detail: data }))
        } finally {
            setTimeout(() => setIsRefreshing(false), 500)
        }
    }

    const handleExport = async () => {
        try {
            setExportStatus({ type: 'success', message: 'Preparing export...' })
            const data = await window.devscope.refreshAll()
            const exportData = {
                exportedAt: new Date().toISOString(),
                version: '1.0.0',
                settings: settings,
                ...data
            }
            
            const result = await (window.devscope as any).exportData?.(exportData)
            if (result?.success) {
                setExportStatus({ type: 'success', message: 'Exported successfully!' })
            } else if (result?.cancelled) {
                setExportStatus(null)
            } else {
                // Fallback: download as file
                const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
                const url = URL.createObjectURL(blob)
                const a = document.createElement('a')
                a.href = url
                a.download = `devscope-export-${new Date().toISOString().split('T')[0]}.json`
                a.click()
                URL.revokeObjectURL(url)
                setExportStatus({ type: 'success', message: 'Downloaded to your browser!' })
            }
        } catch (err) {
            setExportStatus({ type: 'error', message: 'Export failed' })
        }
        setTimeout(() => setExportStatus(null), 4000)
    }

    const handleClearCache = () => {
        clearCache()
        setCacheCleared(true)
        setTimeout(() => setCacheCleared(false), 3000)
    }

    const handleReset = () => {
        resetSettings()
        setShowResetConfirm(false)
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
                    <div className="p-2 rounded-lg bg-cyan-500/10">
                        <Download className="text-cyan-400" size={24} />
                    </div>
                    <div>
                        <h1 className="text-xl font-semibold text-sparkle-text">Data & Export</h1>
                        <p className="text-sm text-sparkle-text-secondary">Manage your data and settings</p>
                    </div>
                </div>
            </div>

            <div className="space-y-4">
                {/* Refresh All */}
                <ActionCard
                    icon={<RefreshCw size={20} className={cn('text-blue-400', isRefreshing && 'animate-spin')} />}
                    iconBg="bg-blue-500/10"
                    title="Refresh All Data"
                    description="Re-scan your system for all developer tools and runtimes"
                    action={
                        <button
                            onClick={handleRefreshAll}
                            disabled={isRefreshing}
                            className="px-4 py-2 rounded-lg bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 transition-colors disabled:opacity-50"
                        >
                            {isRefreshing ? 'Refreshing...' : 'Refresh'}
                        </button>
                    }
                />

                {/* Export */}
                <ActionCard
                    icon={<Download size={20} className="text-green-400" />}
                    iconBg="bg-green-500/10"
                    title="Export Tool Inventory"
                    description="Save all detected tools, versions, and settings as a JSON file"
                    status={exportStatus && (
                        <div className={cn(
                            'flex items-center gap-2 text-sm',
                            exportStatus.type === 'success' ? 'text-green-400' : 'text-red-400'
                        )}>
                            {exportStatus.type === 'success' ? <CheckCircle size={14} /> : <AlertCircle size={14} />}
                            {exportStatus.message}
                        </div>
                    )}
                    action={
                        <button
                            onClick={handleExport}
                            className="px-4 py-2 rounded-lg bg-green-500/10 text-green-400 hover:bg-green-500/20 transition-colors"
                        >
                            Export JSON
                        </button>
                    }
                />

                {/* Clear Cache */}
                <ActionCard
                    icon={<Trash2 size={20} className="text-yellow-400" />}
                    iconBg="bg-yellow-500/10"
                    title="Clear Cached Data"
                    description="Remove cached scan results. Data will be refreshed on next scan."
                    status={cacheCleared && (
                        <div className="flex items-center gap-2 text-sm text-green-400">
                            <CheckCircle size={14} />
                            Cache cleared
                        </div>
                    )}
                    action={
                        <button
                            onClick={handleClearCache}
                            className="px-4 py-2 rounded-lg bg-yellow-500/10 text-yellow-400 hover:bg-yellow-500/20 transition-colors"
                        >
                            Clear Cache
                        </button>
                    }
                />

                {/* Reset Settings */}
                <ActionCard
                    icon={<RotateCcw size={20} className="text-red-400" />}
                    iconBg="bg-red-500/10"
                    title="Reset All Settings"
                    description="Restore all settings to their default values. This cannot be undone."
                    action={
                        showResetConfirm ? (
                            <div className="flex gap-2">
                                <button
                                    onClick={handleReset}
                                    className="px-4 py-2 rounded-lg bg-red-500 text-white hover:bg-red-600 transition-colors"
                                >
                                    Confirm Reset
                                </button>
                                <button
                                    onClick={() => setShowResetConfirm(false)}
                                    className="px-4 py-2 rounded-lg bg-sparkle-border text-sparkle-text hover:bg-sparkle-border-secondary transition-colors"
                                >
                                    Cancel
                                </button>
                            </div>
                        ) : (
                            <button
                                onClick={() => setShowResetConfirm(true)}
                                className="px-4 py-2 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors"
                            >
                                Reset
                            </button>
                        )
                    }
                />
            </div>
        </div>
    )
}

function ActionCard({ 
    icon, 
    iconBg, 
    title, 
    description, 
    status,
    action 
}: { 
    icon: React.ReactNode
    iconBg: string
    title: string
    description: string
    status?: React.ReactNode
    action: React.ReactNode
}) {
    return (
        <div className="bg-sparkle-card rounded-xl border border-sparkle-border p-5">
            <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-4">
                    <div className={cn('p-3 rounded-xl', iconBg)}>
                        {icon}
                    </div>
                    <div>
                        <h3 className="font-semibold text-sparkle-text">{title}</h3>
                        <p className="text-sm text-sparkle-text-secondary mt-1">{description}</p>
                        {status && <div className="mt-2">{status}</div>}
                    </div>
                </div>
                <div className="shrink-0">
                    {action}
                </div>
            </div>
        </div>
    )
}
