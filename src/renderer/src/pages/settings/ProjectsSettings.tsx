/**
 * DevScope - Projects Settings Page
 * Configure projects folder location and indexing
 */

import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, FolderOpen, Folder, X, Plus, RefreshCw, Power, CheckCircle, AlertCircle } from 'lucide-react'
import { useSettings } from '@/lib/settings'
import { cn } from '@/lib/utils'

export default function ProjectsSettings() {
    const { settings, updateSettings } = useSettings()
    const [isIndexing, setIsIndexing] = useState(false)
    const [indexResult, setIndexResult] = useState<{ success: boolean; count: number; errors?: any[] } | null>(null)

    const handleSelectFolder = async () => {
        try {
            const result = await window.devscope.selectFolder()
            if (result.success && result.folderPath) {
                updateSettings({ projectsFolder: result.folderPath })
            }
        } catch (err) {
            console.error('Failed to select folder:', err)
        }
    }

    const handleClearFolder = () => {
        updateSettings({ projectsFolder: '' })
    }

    const handleAddAdditionalFolder = async () => {
        try {
            const result = await window.devscope.selectFolder()
            if (result.success && result.folderPath) {
                if (result.folderPath === settings.projectsFolder) return
                if (settings.additionalFolders?.includes(result.folderPath)) return
                updateSettings({
                    additionalFolders: [...(settings.additionalFolders || []), result.folderPath]
                })
            }
        } catch (err) {
            console.error('Failed to select folder:', err)
        }
    }

    const handleRemoveAdditionalFolder = (folderPath: string) => {
        updateSettings({
            additionalFolders: (settings.additionalFolders || []).filter(f => f !== folderPath)
        })
    }

    const handleIndexNow = async () => {
        setIsIndexing(true)
        setIndexResult(null)

        try {
            const foldersToIndex = [settings.projectsFolder, ...(settings.additionalFolders || [])].filter(Boolean)
            if (foldersToIndex.length === 0) {
                setIndexResult({ success: false, count: 0, errors: [{ folder: '', error: 'No folders configured' }] })
                return
            }

            const result = await window.devscope.indexAllFolders(foldersToIndex)
            setIndexResult({
                success: result.success,
                count: result.success ? result.indexedCount || 0 : 0,
                errors: result.success ? result.errors : [{ folder: '', error: result.error || 'Indexing failed' }]
            })
        } catch (err: any) {
            setIndexResult({ success: false, count: 0, errors: [{ folder: '', error: err.message }] })
        } finally {
            setIsIndexing(false)
        }
    }

    const allFoldersCount = [settings.projectsFolder, ...(settings.additionalFolders || [])].filter(Boolean).length

    return (
        <div className="animate-fadeIn">
            <div className="mb-8">
                <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-indigo-500/10">
                            <FolderOpen className="text-indigo-400" size={24} />
                        </div>
                        <div>
                            <h1 className="text-2xl font-semibold text-sparkle-text">Projects</h1>
                            <p className="text-sparkle-text-secondary">Configure where your coding projects are located</p>
                        </div>
                    </div>
                    <Link
                        to="/settings"
                        className="inline-flex items-center gap-2 px-4 py-2 text-sm text-sparkle-text hover:text-[var(--accent-primary)] bg-sparkle-card hover:bg-white/[0.03] border border-white/10 hover:border-white/20 rounded-lg transition-all shrink-0"
                    >
                        <ArrowLeft size={16} />
                        <span>Back to Settings</span>
                    </Link>
                </div>
            </div>

            {/* Quick Start Guide */}
            <div className="mb-6 bg-gradient-to-br from-indigo-500/10 via-indigo-500/5 to-transparent border border-indigo-500/20 rounded-xl p-5">
                <div className="flex items-start gap-3">
                    <div className="rounded-lg bg-indigo-500/20 p-2 mt-0.5">
                        <FolderOpen size={18} className="text-indigo-400" />
                    </div>
                    <div className="flex-1">
                        <h3 className="font-semibold text-sparkle-text mb-1">Getting Started</h3>
                        <p className="text-sm text-sparkle-text-secondary leading-relaxed">
                            Select your main projects folder, then enable indexing to automatically discover all your projects. 
                            DevScope scans for package.json, .git, Cargo.toml, and more.
                        </p>
                    </div>
                </div>
            </div>

            {/* Two Column Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Left Column - Folders */}
                <div className="space-y-6">
                    {/* Main Projects Folder */}
                    <section className="rounded-xl border border-white/10 bg-sparkle-card p-6">
                        <div className="flex items-start justify-between gap-4 mb-4">
                            <div>
                                <h3 className="font-semibold text-sparkle-text mb-1">Main Projects Folder</h3>
                                <p className="text-sm text-sparkle-text-secondary">Primary location for your projects</p>
                            </div>
                            {settings.projectsFolder && (
                                <span className="text-xs px-2.5 py-1 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                                    Active
                                </span>
                            )}
                        </div>

                        {settings.projectsFolder ? (
                            <div className="space-y-3">
                                <div className="flex items-center gap-3 px-4 py-3 bg-white/[0.03] rounded-lg border border-white/10">
                                    <Folder size={18} className="text-indigo-400 shrink-0" />
                                    <span className="text-sm text-sparkle-text truncate font-mono flex-1">
                                        {settings.projectsFolder}
                                    </span>
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        onClick={handleSelectFolder}
                                        className="flex-1 px-4 py-2.5 bg-white/[0.05] text-sparkle-text rounded-lg hover:bg-white/[0.08] border border-white/10 hover:border-white/20 transition-all text-sm font-medium"
                                    >
                                        Change Folder
                                    </button>
                                    <button
                                        onClick={handleClearFolder}
                                        className="px-4 py-2.5 text-red-400 hover:bg-red-500/10 rounded-lg border border-white/10 hover:border-red-500/20 transition-all text-sm font-medium"
                                    >
                                        Clear
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <button
                                onClick={handleSelectFolder}
                                className="w-full flex items-center justify-center gap-3 px-4 py-4 bg-indigo-500/10 text-indigo-400 rounded-lg hover:bg-indigo-500/15 border border-indigo-500/20 hover:border-indigo-500/30 transition-all"
                            >
                                <FolderOpen size={18} />
                                <span className="text-sm font-medium">Select Projects Folder</span>
                            </button>
                        )}
                    </section>

                    {/* Additional Folders */}
                    <section className="rounded-xl border border-white/10 bg-sparkle-card p-6">
                        <div className="flex items-start justify-between gap-4 mb-4">
                            <div>
                                <h3 className="font-semibold text-sparkle-text mb-1">Additional Folders</h3>
                                <p className="text-sm text-sparkle-text-secondary">Add more locations to scan</p>
                            </div>
                            {settings.additionalFolders && settings.additionalFolders.length > 0 && (
                                <span className="text-xs px-2.5 py-1 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/20">
                                    {settings.additionalFolders.length}
                                </span>
                            )}
                        </div>

                        {settings.additionalFolders && settings.additionalFolders.length > 0 && (
                            <div className="space-y-2 mb-4">
                                {settings.additionalFolders.map((folder) => (
                                    <div key={folder} className="flex items-center gap-2">
                                        <div className="flex-1 flex items-center gap-3 px-4 py-2.5 bg-white/[0.03] rounded-lg border border-white/10">
                                            <Folder size={16} className="text-purple-400 shrink-0" />
                                            <span className="text-sm text-sparkle-text truncate font-mono">
                                                {folder}
                                            </span>
                                        </div>
                                        <button
                                            onClick={() => handleRemoveAdditionalFolder(folder)}
                                            className="p-2.5 text-sparkle-text-secondary hover:text-red-400 hover:bg-red-500/10 rounded-lg border border-white/10 hover:border-red-500/20 transition-all"
                                            title="Remove"
                                        >
                                            <X size={16} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}

                        <button
                            onClick={handleAddAdditionalFolder}
                            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-purple-500/10 text-purple-400 rounded-lg hover:bg-purple-500/15 border border-purple-500/20 hover:border-purple-500/30 transition-all text-sm font-medium"
                        >
                            <Plus size={16} />
                            Add Folder
                        </button>
                    </section>
                </div>

                {/* Right Column - Indexing */}
                <div className="space-y-6">
                    {/* Indexing Controls */}
                    <section className="rounded-xl border border-white/10 bg-sparkle-card p-6">
                        <h3 className="font-semibold text-sparkle-text mb-1">Indexing Settings</h3>
                        <p className="text-sm text-sparkle-text-secondary mb-5">Control how DevScope discovers projects</p>

                        <div className="space-y-3">
                            <div className="flex items-center justify-between p-4 rounded-lg border border-white/10 bg-white/[0.02]">
                                <div className="flex items-center gap-3">
                                    <div className="rounded-lg bg-green-500/10 p-2">
                                        <Power size={16} className="text-green-400" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-medium text-sparkle-text">Enable Indexing</p>
                                        <p className="text-xs text-sparkle-text-secondary mt-0.5">Scan folders for projects</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => updateSettings({ enableFolderIndexing: !settings.enableFolderIndexing })}
                                    className={cn(
                                        'relative w-11 h-6 rounded-full transition-all border',
                                        settings.enableFolderIndexing 
                                            ? 'bg-green-500 border-green-500/30' 
                                            : 'bg-white/10 border-white/10'
                                    )}
                                >
                                    <div className={cn(
                                        'absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-all',
                                        settings.enableFolderIndexing ? 'left-5' : 'left-0.5'
                                    )} />
                                </button>
                            </div>

                            <div className="flex items-center justify-between p-4 rounded-lg border border-white/10 bg-white/[0.02]">
                                <div className="flex items-center gap-3">
                                    <div className="rounded-lg bg-blue-500/10 p-2">
                                        <RefreshCw size={16} className="text-blue-400" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-medium text-sparkle-text">Auto-Index on Startup</p>
                                        <p className="text-xs text-sparkle-text-secondary mt-0.5">Scan when app starts</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => updateSettings({ autoIndexOnStartup: !settings.autoIndexOnStartup })}
                                    className={cn(
                                        'relative w-11 h-6 rounded-full transition-all border',
                                        settings.autoIndexOnStartup 
                                            ? 'bg-blue-500 border-blue-500/30' 
                                            : 'bg-white/10 border-white/10'
                                    )}
                                >
                                    <div className={cn(
                                        'absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-all',
                                        settings.autoIndexOnStartup ? 'left-5' : 'left-0.5'
                                    )} />
                                </button>
                            </div>
                        </div>

                        <div className="mt-5 pt-5 border-t border-white/5">
                            <button
                                onClick={handleIndexNow}
                                disabled={isIndexing || allFoldersCount === 0}
                                className={cn(
                                    'w-full flex items-center justify-center gap-3 px-4 py-3.5 rounded-lg transition-all text-sm font-medium border',
                                    isIndexing
                                        ? 'bg-white/5 text-sparkle-text-secondary cursor-wait border-white/10'
                                        : allFoldersCount === 0
                                            ? 'bg-white/5 text-sparkle-text-secondary cursor-not-allowed border-white/10'
                                            : 'bg-[var(--accent-primary)]/10 text-[var(--accent-primary)] hover:bg-[var(--accent-primary)]/15 border-[var(--accent-primary)]/20 hover:border-[var(--accent-primary)]/30'
                                )}
                            >
                                <RefreshCw size={18} className={isIndexing ? 'animate-spin' : ''} />
                                {isIndexing 
                                    ? 'Indexing Projects...' 
                                    : allFoldersCount === 0
                                        ? 'No Folders Configured'
                                        : `Index ${allFoldersCount} Folder${allFoldersCount !== 1 ? 's' : ''} Now`
                                }
                            </button>

                            {indexResult && (
                                <div className={cn(
                                    'mt-3 px-4 py-3 rounded-lg text-sm flex items-start gap-3 border',
                                    indexResult.success
                                        ? 'bg-green-500/10 text-green-300 border-green-500/20'
                                        : 'bg-red-500/10 text-red-300 border-red-500/20'
                                )}>
                                    {indexResult.success ? (
                                        <>
                                            <CheckCircle size={18} className="shrink-0 mt-0.5" />
                                            <span>Found {indexResult.count} project{indexResult.count !== 1 ? 's' : ''}</span>
                                        </>
                                    ) : (
                                        <>
                                            <AlertCircle size={18} className="shrink-0 mt-0.5" />
                                            <span>{indexResult.errors?.[0]?.error || 'Indexing failed'}</span>
                                        </>
                                    )}
                                </div>
                            )}
                        </div>
                    </section>
                </div>
            </div>
        </div>
    )
}
