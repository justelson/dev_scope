import { Search, Loader2, X, Filter, Eye, EyeOff, LayoutGrid, AlignJustify, List } from 'lucide-react'
import Dropdown from '@/components/ui/Dropdown'
import { cn } from '@/lib/utils'
import type { ViewMode } from './projectsTypes'

interface ProjectsToolbarProps {
    searchQuery: string
    setSearchQuery: (value: string) => void
    clearSearch: () => void
    isSearching: boolean
    filterType: string
    setFilterType: (value: string) => void
    projectTypes: string[]
    getProjectTypeLabel: (type: string) => string
    getProjectTypeColor: (type: string) => string | undefined
    showHiddenFiles: boolean
    setShowHiddenFiles: (value: boolean) => void
    viewMode: ViewMode
    setViewMode: (value: ViewMode) => void
    hasSearchResults: boolean
    searchResultsCount: number
}

export function ProjectsToolbar({
    searchQuery,
    setSearchQuery,
    clearSearch,
    isSearching,
    filterType,
    setFilterType,
    projectTypes,
    getProjectTypeLabel,
    getProjectTypeColor,
    showHiddenFiles,
    setShowHiddenFiles,
    viewMode,
    setViewMode,
    hasSearchResults,
    searchResultsCount
}: ProjectsToolbarProps) {
    return (
        <div className="sticky -top-6 z-20 bg-sparkle-bg/90 backdrop-blur-2xl pt-6 pb-5 mb-6 -mx-6 px-6">
            <div className="flex flex-col md:flex-row gap-4 justify-between items-center">
                <div className="flex flex-1 w-full gap-3">
                    <div className="relative flex-1 group/search">
                        <div className="absolute left-4 top-1/2 -translate-y-1/2 flex items-center justify-center w-4 h-4">
                            {isSearching ? (
                                <Loader2 className="text-indigo-400 animate-spin" size={16} />
                            ) : (
                                <Search className="text-sparkle-text-muted group-focus-within/search:text-indigo-400 transition-colors duration-200" size={16} />
                            )}
                        </div>
                        <input
                            type="text"
                            placeholder="Deep search all files and folders (try .ts)..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className={cn(
                                'w-full rounded-xl border border-sparkle-border bg-sparkle-card py-2.5 pl-11 pr-10 text-sm text-sparkle-text transition-all duration-200 placeholder:text-sparkle-text-muted focus:outline-none focus:bg-sparkle-card-hover focus:border-indigo-500/30',
                                searchQuery && 'border-indigo-500/30 bg-indigo-500/10'
                            )}
                        />
                        {searchQuery && (
                            <button
                                onClick={clearSearch}
                                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-sparkle-text-muted hover:text-sparkle-text-secondary hover:bg-sparkle-card-hover transition-colors"
                            >
                                <X size={14} />
                            </button>
                        )}
                    </div>

                    <Dropdown
                        value={filterType}
                        onChange={(value) => setFilterType(value)}
                        icon={<Filter size={14} />}
                        className="min-w-[160px]"
                        options={[
                            { value: 'all', label: 'All Types' },
                            ...projectTypes.map((type) => ({
                                value: type,
                                label: getProjectTypeLabel(type),
                                color: getProjectTypeColor(type)
                            }))
                        ]}
                    />
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setShowHiddenFiles(!showHiddenFiles)}
                        className={cn(
                            'flex items-center gap-2 px-3 py-2 rounded-xl border transition-all duration-200 text-sm',
                            showHiddenFiles
                                ? 'bg-indigo-500/15 border-indigo-500/30 text-indigo-300'
                                : 'bg-sparkle-card border-sparkle-border text-sparkle-text-secondary hover:text-sparkle-text hover:bg-sparkle-card-hover'
                        )}
                        title={showHiddenFiles ? 'Hide hidden files' : 'Show hidden files'}
                    >
                        {showHiddenFiles ? <Eye size={14} /> : <EyeOff size={14} />}
                        <span className="hidden sm:inline">Hidden</span>
                    </button>

                    <div className="flex items-center gap-1 rounded-xl border border-sparkle-border bg-sparkle-card p-1">
                        {[
                            { id: 'grid', icon: LayoutGrid },
                            { id: 'detailed', icon: AlignJustify },
                            { id: 'list', icon: List }
                        ].map(({ id, icon: Icon }) => (
                            <button
                                key={id}
                                onClick={() => setViewMode(id as ViewMode)}
                                className={cn(
                                    'p-2 rounded-lg transition-all duration-200',
                                    viewMode === id
                                        ? 'bg-sparkle-card-hover text-sparkle-text'
                                        : 'text-sparkle-text-muted hover:text-sparkle-text-secondary hover:bg-sparkle-card-hover'
                                )}
                            >
                                <Icon size={16} />
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {hasSearchResults && (
                <div className="mt-4 pt-4 border-t border-sparkle-border">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <Search size={16} className="text-indigo-400" />
                            <span className="text-sm text-sparkle-text-secondary">
                                Search results for "<span className="text-sparkle-text font-medium">{searchQuery}</span>"
                            </span>
                            <span className="text-xs text-sparkle-text-muted">
                                {searchResultsCount} items found
                            </span>
                        </div>
                        <button
                            onClick={clearSearch}
                            className="text-xs text-sparkle-text-muted hover:text-sparkle-text-secondary transition-colors"
                        >
                            Clear search
                        </button>
                    </div>
                </div>
            )}
        </div>
    )
}
