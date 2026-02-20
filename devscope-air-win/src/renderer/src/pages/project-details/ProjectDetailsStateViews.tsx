import { ArrowLeft, AlertCircle, RefreshCw } from 'lucide-react'

interface ErrorViewProps {
    error: string | null
    onBackToProjects: () => void
}

export function ProjectDetailsLoadingView() {
    return (
        <div className="flex flex-col items-center justify-center min-h-[50vh] animate-fadeIn gap-4">
            <RefreshCw size={32} className="text-[var(--accent-primary)] animate-spin" />
            <p className="text-white/40 text-sm">Loading Project...</p>
        </div>
    )
}

export function ProjectDetailsErrorView({ error, onBackToProjects }: ErrorViewProps) {
    return (
        <div className="animate-fadeIn p-8">
            <div className="flex items-center gap-4 mb-8">
                <button onClick={onBackToProjects} className="p-2 text-white/40 hover:text-white bg-white/5 rounded-lg">
                    <ArrowLeft size={20} />
                </button>
                <h1 className="text-xl font-bold text-white">Error</h1>
            </div>
            <div className="p-6 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center gap-4">
                <AlertCircle size={24} className="text-red-400" />
                <span className="text-red-300">{error || 'Project not found'}</span>
            </div>
        </div>
    )
}
