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
                // Check if folder already exists in main or additional folders
                if (result.folderPath === settings.projectsFolder) {
                    return // Already the main folder
                }
                if (settings.additionalFolders?.includes(result.folderPath)) {
                    return // Already in additional folders
                }
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
            // Collect all folders to index
            const foldersToIndex = [
                settings.projectsFolder,
                ...(settings.additionalFolders || [])
            ].filter(Boolean)

            if (foldersToIndex.length === 0) {
                setIndexResult({ success: false, count: 0, errors: [{ folder: '', error: 'No folders configured' }] })
                return
            }

            const result = await window.devscope.indexAllFolders(foldersToIndex)
            setIndexResult({
                success: result.success,
                count: result.indexedCount || 0,
                errors: result.errors
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
            {/* Header */}
            <div className="mb-8">
                <Link
                    to="/settings"
                    className="inline-flex items-center gap-2 text-sparkle-text-secondary hover:text-sparkle-text transition-colors mb-4"
                >
                    <ArrowLeft size={16} />
                    <span className="text-sm">Back to Settings</span>
                </Link>
                <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 rounded-lg bg-indigo-500/10">
                        <FolderOpen className="text-indigo-400" size={24} />
                    </div>
                    <h1 className="text-2xl font-semibold text-sparkle-text">Projects</h1>
                </div>
                <p className="text-sparkle-text-secondary">
                    Configure where your coding projects are located
                </p>
            </div>

            {/* Settings Content */}
            <div className="space-y-6">
                {/* Indexing Controls */}
                <div className="bg-sparkle-card rounded-xl border border-sparkle-border p-6">
                    <h3 className="font-medium text-sparkle-text mb-1">Folder Indexing</h3>
                    <p className="text-sm text-sparkle-text-secondary mb-4">
                        Control how DevScope indexes your project folders to discover projects.
                    </p>

                    <div className="space-y-4">
                        {/* Enable Indexing Toggle */}
                        <div className="flex items-center justify-between py-3 border-b border-sparkle-border">
                            <div className="flex items-center gap-3">
                                <Power size={18} className="text-green-400" />
                                <div>
                                    <p className="text-sm font-medium text-sparkle-text">Enable Folder Indexing</p>
                                    <p className="text-xs text-sparkle-text-secondary">Scan configured folders for projects</p>
                                </div>
                            </div>
                            <button
                                onClick={() => updateSettings({ enableFolderIndexing: !settings.enableFolderIndexing })}
                                className={cn(
                                    'relative w-12 h-6 rounded-full transition-colors',
                                    settings.enableFolderIndexing ? 'bg-green-500' : 'bg-sparkle-border'
                                )}
                            >
                                <div className={cn(
                                    'absolute top-1 w-4 h-4 rounded-full bg-white transition-all',
                                    settings.enableFolderIndexing ? 'left-7' : 'left-1'
                                )} />
                            </button>
                        </div>

                        {/* Auto-Index on Startup Toggle */}
                        <div className="flex items-center justify-between py-3 border-b border-sparkle-border">
                            <div className="flex items-center gap-3">
                                <RefreshCw size={18} className="text-blue-400" />
                                <div>
                                    <p className="text-sm font-medium text-sparkle-text">Auto-Index on Startup</p>
                                    <p className="text-xs text-sparkle-text-secondary">Automatically scan folders when DevScope starts</p>
                                </div>
                            </div>
                            <button
                                onClick={() => updateSettings({ autoIndexOnStartup: !settings.autoIndexOnStartup })}
                                className={cn(
                                    'relative w-12 h-6 rounded-full transition-colors',
                                    settings.autoIndexOnStartup ? 'bg-blue-500' : 'bg-sparkle-border'
                                )}
                            >
                                <div className={cn(
                                    'absolute top-1 w-4 h-4 rounded-full bg-white transition-all',
                                    settings.autoIndexOnStartup ? 'left-7' : 'left-1'
                                )} />
                            </button>
                        </div>

                        {/* Index Now Button */}
                        <div className="pt-2">
                            <button
                                onClick={handleIndexNow}
                                disabled={isIndexing || allFoldersCount === 0}
                                className={cn(
                                    'flex items-center gap-3 px-4 py-3 rounded-lg transition-all text-sm font-medium',
                                    isIndexing
                                        ? 'bg-sparkle-border text-sparkle-text-secondary cursor-wait'
                                        : allFoldersCount === 0
                                            ? 'bg-sparkle-border/50 text-sparkle-text-secondary cursor-not-allowed'
                                            : 'bg-[var(--accent-primary)]/10 text-[var(--accent-primary)] hover:bg-[var(--accent-primary)]/20'
                                )}
                            >
                                <RefreshCw size={18} className={isIndexing ? 'animate-spin' : ''} />
                                {isIndexing ? 'Indexing...' : `Index Now (${allFoldersCount} folder${allFoldersCount !== 1 ? 's' : ''})`}
                            </button>

                            {/* Index Result */}
                            {indexResult && (
                                <div className={cn(
                                    'mt-3 px-4 py-2 rounded-lg text-sm flex items-center gap-2',
                                    indexResult.success
                                        ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                                        : 'bg-red-500/10 text-red-400 border border-red-500/20'
                                )}>
                                    {indexResult.success ? (
                                        <>
                                            <CheckCircle size={16} />
                                            Found {indexResult.count} projects
                                        </>
                                    ) : (
                                        <>
                                            <AlertCircle size={16} />
                                            {indexResult.errors?.[0]?.error || 'Indexing failed'}
                                        </>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Main Projects Folder */}
                <div className="bg-sparkle-card rounded-xl border border-sparkle-border p-6">
                    <h3 className="font-medium text-sparkle-text mb-1">Main Projects Folder</h3>
                    <p className="text-sm text-sparkle-text-secondary mb-4">
                        Select a folder containing your coding projects. DevScope will scan for projects with package.json, .git, or other project markers.
                    </p>

                    {settings.projectsFolder ? (
                        <div className="flex items-center gap-3">
                            <div className="flex-1 flex items-center gap-3 px-4 py-3 bg-sparkle-bg rounded-lg border border-sparkle-border">
                                <Folder size={18} className="text-indigo-400 shrink-0" />
                                <span className="text-sm text-sparkle-text truncate font-mono">
                                    {settings.projectsFolder}
                                </span>
                            </div>
                            <button
                                onClick={handleSelectFolder}
                                className="px-4 py-3 bg-[var(--accent-primary)]/10 text-[var(--accent-primary)] rounded-lg hover:bg-[var(--accent-primary)]/20 transition-colors text-sm font-medium"
                            >
                                Change
                            </button>
                            <button
                                onClick={handleClearFolder}
                                className="p-3 text-sparkle-text-secondary hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                                title="Clear folder"
                            >
                                <X size={18} />
                            </button>
                        </div>
                    ) : (
                        <button
                            onClick={handleSelectFolder}
                            className="flex items-center gap-3 px-4 py-3 bg-[var(--accent-primary)]/10 text-[var(--accent-primary)] rounded-lg hover:bg-[var(--accent-primary)]/20 transition-colors"
                        >
                            <FolderOpen size={18} />
                            <span className="text-sm font-medium">Select Projects Folder</span>
                        </button>
                    )}
                </div>

                {/* Additional Indexed Folders */}
                <div className="bg-sparkle-card rounded-xl border border-sparkle-border p-6">
                    <h3 className="font-medium text-sparkle-text mb-1">Additional Indexed Folders</h3>
                    <p className="text-sm text-sparkle-text-secondary mb-4">
                        Add more folders to be scanned alongside your main projects folder. All projects from these folders will appear in your Projects view.
                    </p>

                    {/* List of additional folders */}
                    {settings.additionalFolders && settings.additionalFolders.length > 0 && (
                        <div className="space-y-2 mb-4">
                            {settings.additionalFolders.map((folder) => (
                                <div key={folder} className="flex items-center gap-3">
                                    <div className="flex-1 flex items-center gap-3 px-4 py-3 bg-sparkle-bg rounded-lg border border-sparkle-border">
                                        <Folder size={18} className="text-purple-400 shrink-0" />
                                        <span className="text-sm text-sparkle-text truncate font-mono">
                                            {folder}
                                        </span>
                                    </div>
                                    <button
                                        onClick={() => handleRemoveAdditionalFolder(folder)}
                                        className="p-3 text-sparkle-text-secondary hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                                        title="Remove folder"
                                    >
                                        <X size={18} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}

                    <button
                        onClick={handleAddAdditionalFolder}
                        className="flex items-center gap-3 px-4 py-3 bg-purple-500/10 text-purple-400 rounded-lg hover:bg-purple-500/20 transition-colors border border-purple-500/20 hover:border-purple-500/30"
                    >
                        <Plus size={18} />
                        <span className="text-sm font-medium">Add Folder</span>
                    </button>
                </div>

                {/* Info */}
                <div className="bg-indigo-500/5 border border-indigo-500/20 rounded-xl p-4">
                    <p className="text-sm text-indigo-300">
                        <strong>Tip:</strong> DevScope detects projects by looking for common markers like package.json, Cargo.toml, go.mod, .git folders, and more. Each subfolder in your indexed directories will be scanned.
                    </p>
                </div>
            </div>
        </div>
    )
}
