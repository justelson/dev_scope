import { Link, Navigate } from 'react-router-dom'
import { Folder, FolderTree, Settings } from 'lucide-react'
import { useSettings } from '@/lib/settings'

export default function Projects() {
    const { settings } = useSettings()
    const projectsRoot = String(settings.projectsFolder || '').trim()

    if (!projectsRoot) {
        return (
            <div className="animate-fadeIn">
                <div className="mb-8">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 rounded-lg bg-indigo-500/10">
                            <FolderTree className="text-indigo-400" size={24} />
                        </div>
                        <h1 className="text-2xl font-semibold text-sparkle-text">Projects</h1>
                    </div>
                    <p className="text-sparkle-text-secondary">Your coding projects in one place</p>
                </div>

                <div className="flex flex-col items-center justify-center py-16 bg-sparkle-card rounded-xl border border-sparkle-border">
                    <Folder size={48} className="text-sparkle-text-muted mb-4" />
                    <h3 className="text-lg font-medium text-sparkle-text mb-2">No Projects Folder Configured</h3>
                    <p className="text-sparkle-text-secondary text-center max-w-md mb-6">
                        Set up a projects folder in settings to browse your projects.
                    </p>
                    <Link
                        to="/settings/projects"
                        className="flex items-center gap-2 px-4 py-2 bg-[var(--accent-primary)] text-white rounded-lg hover:bg-[var(--accent-primary)]/90 transition-colors"
                    >
                        <Settings size={16} />
                        <span>Configure Projects Folder</span>
                    </Link>
                </div>
            </div>
        )
    }

    return <Navigate to={`/folder-browse/${encodeURIComponent(projectsRoot)}`} replace />
}
