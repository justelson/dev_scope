import { RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'

type TasksHeaderProps = {
    activeView: 'operations' | 'terminals' | 'runningApps'
    runningAppsEnabled: boolean
    lastRefreshAt: number | null
    refreshing: boolean
    initialLoading: boolean
    hasLoadedOnce: boolean
    onRefresh: () => void
    onSelectView: (view: 'operations' | 'terminals' | 'runningApps') => void
}

export function TasksHeader({
    activeView,
    runningAppsEnabled,
    lastRefreshAt,
    refreshing,
    initialLoading,
    hasLoadedOnce,
    onRefresh,
    onSelectView
}: TasksHeaderProps) {
    return (
        <>
            <div className="flex items-start justify-between gap-4 mb-6">
                <div>
                    <h1 className="text-3xl font-bold text-sparkle-text mb-2">Task Manager</h1>
                    <p className="text-sparkle-text-secondary">
                        {runningAppsEnabled
                            ? 'Live view of active tasks, ports, and running apps.'
                            : 'Live view of active tasks and ports.'}
                    </p>
                </div>
                <div className="flex items-center gap-3 text-xs text-sparkle-text-secondary">
                    <span>Last refresh: {lastRefreshAt ? new Date(lastRefreshAt).toLocaleTimeString() : 'pending'}</span>
                    <button
                        onClick={onRefresh}
                        disabled={refreshing}
                        className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-sparkle-border bg-sparkle-card hover:bg-sparkle-border-secondary transition-colors disabled:opacity-50"
                    >
                        <RefreshCw size={14} className={cn((refreshing || initialLoading) && 'animate-spin')} />
                        <span>{hasLoadedOnce ? 'Refresh' : 'Loading'}</span>
                    </button>
                </div>
            </div>

            <div className="mb-5 inline-flex items-center rounded-xl border border-sparkle-border bg-sparkle-card p-1">
                <button
                    type="button"
                    onClick={() => onSelectView('operations')}
                    className={cn(
                        'rounded-lg px-3 py-1.5 text-xs transition-colors',
                        activeView === 'operations'
                            ? 'bg-[var(--accent-primary)] text-white'
                            : 'text-sparkle-text-secondary hover:bg-sparkle-bg hover:text-sparkle-text'
                    )}
                >
                    Operations
                </button>
                <button
                    type="button"
                    onClick={() => onSelectView('terminals')}
                    className={cn(
                        'rounded-lg px-3 py-1.5 text-xs transition-colors',
                        activeView === 'terminals'
                            ? 'bg-[var(--accent-primary)] text-white'
                            : 'text-sparkle-text-secondary hover:bg-sparkle-bg hover:text-sparkle-text'
                    )}
                >
                    Terminals
                </button>
                {runningAppsEnabled && (
                    <button
                        type="button"
                        onClick={() => onSelectView('runningApps')}
                        className={cn(
                            'rounded-lg px-3 py-1.5 text-xs transition-colors',
                            activeView === 'runningApps'
                                ? 'bg-[var(--accent-primary)] text-white'
                                : 'text-sparkle-text-secondary hover:bg-sparkle-bg hover:text-sparkle-text'
                        )}
                    >
                        Running Apps
                    </button>
                )}
            </div>
        </>
    )
}
