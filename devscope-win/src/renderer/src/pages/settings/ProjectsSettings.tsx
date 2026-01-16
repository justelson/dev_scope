/**
 * DevScope - Projects Settings Page
 * Configure projects folder location
 */

import { Link } from 'react-router-dom'
import { ArrowLeft, FolderOpen, Folder, X } from 'lucide-react'
import { useSettings } from '@/lib/settings'

export default function ProjectsSettings() {
    const { settings, updateSettings } = useSettings()

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
                {/* Projects Folder */}
                <div className="bg-sparkle-card rounded-xl border border-sparkle-border p-6">
                    <h3 className="font-medium text-sparkle-text mb-1">Projects Folder</h3>
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

                {/* Info */}
                <div className="bg-indigo-500/5 border border-indigo-500/20 rounded-xl p-4">
                    <p className="text-sm text-indigo-300">
                        <strong>Tip:</strong> DevScope detects projects by looking for common markers like package.json, Cargo.toml, go.mod, .git folders, and more. Each subfolder in your projects directory will be scanned.
                    </p>
                </div>
            </div>
        </div>
    )
}
