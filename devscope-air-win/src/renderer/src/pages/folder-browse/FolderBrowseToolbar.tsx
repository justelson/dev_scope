import { Filter, Grid3x3, LayoutGrid, Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getProjectTypeById, type ContentLayout, type ViewMode } from './types'

interface FolderBrowseToolbarProps {
    searchQuery: string
    filterType: string
    projectTypes: string[]
    viewMode: ViewMode
    contentLayout: ContentLayout
    onSearchQueryChange: (value: string) => void
    onFilterTypeChange: (value: string) => void
    onViewModeChange: (value: ViewMode) => void
    onContentLayoutChange: (value: ContentLayout) => void
}

const VIEW_MODES: Array<{ id: ViewMode; icon: typeof LayoutGrid }> = [
    { id: 'finder', icon: Grid3x3 },
    { id: 'grid', icon: LayoutGrid }
]

export function FolderBrowseToolbar({
    searchQuery,
    filterType,
    projectTypes,
    viewMode,
    contentLayout,
    onSearchQueryChange,
    onFilterTypeChange,
    onViewModeChange,
    onContentLayoutChange
}: FolderBrowseToolbarProps) {
    return (
        <div className="sticky -top-6 z-20 bg-sparkle-bg/90 backdrop-blur-2xl pt-6 pb-5 mb-6 -mx-6 px-6">
            <div className="flex flex-col md:flex-row gap-4 justify-between items-center">
                <div className="flex flex-1 w-full gap-3">
                    <div className="relative flex-1 group/search">
                        <Search
                            className="absolute left-4 top-1/2 -translate-y-1/2 text-sparkle-text-secondary group-focus-within/search:text-sparkle-primary transition-colors"
                            size={18}
                        />
                        <input
                            type="text"
                            placeholder="Search in folder..."
                            value={searchQuery}
                            onChange={(event) => onSearchQueryChange(event.target.value)}
                            className="w-full bg-sparkle-card border border-sparkle-border rounded-2xl py-3 pl-11 pr-4 text-sm text-sparkle-text focus:outline-none focus:border-sparkle-primary/50 focus:ring-4 focus:ring-sparkle-primary/10 transition-all placeholder:text-sparkle-text-muted shadow-sm"
                        />
                    </div>

                    {projectTypes.length > 0 && (
                        <div className="relative min-w-[180px] group/filter">
                            <Filter
                                className="absolute left-4 top-1/2 -translate-y-1/2 text-sparkle-text-secondary pointer-events-none group-focus-within/filter:text-sparkle-primary transition-colors"
                                size={16}
                            />
                            <select
                                value={filterType}
                                onChange={(event) => onFilterTypeChange(event.target.value)}
                                className="w-full appearance-none bg-sparkle-card border border-sparkle-border rounded-2xl py-3 pl-11 pr-10 text-sm text-sparkle-text focus:outline-none focus:border-sparkle-primary/50 focus:ring-4 focus:ring-sparkle-primary/10 transition-all cursor-pointer shadow-sm"
                            >
                                <option value="all">All Types</option>
                                {projectTypes.map((type) => {
                                    const typeInfo = getProjectTypeById(type)
                                    return (
                                        <option key={type} value={type}>
                                            {typeInfo?.displayName || type}
                                        </option>
                                    )
                                })}
                            </select>
                        </div>
                    )}
                </div>

                <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1.5 rounded-xl border border-sparkle-border bg-sparkle-card p-1">
                        <button
                            onClick={() => onContentLayoutChange('grouped')}
                            className={cn(
                                'px-3 py-2 rounded-lg text-xs font-medium transition-all duration-200',
                                contentLayout === 'grouped'
                                    ? 'bg-sparkle-card-hover text-sparkle-text'
                                    : 'text-sparkle-text-muted hover:text-sparkle-text-secondary hover:bg-sparkle-card-hover'
                            )}
                        >
                            Grouped
                        </button>
                        <button
                            onClick={() => onContentLayoutChange('explorer')}
                            className={cn(
                                'px-3 py-2 rounded-lg text-xs font-medium transition-all duration-200',
                                contentLayout === 'explorer'
                                    ? 'bg-sparkle-card-hover text-sparkle-text'
                                    : 'text-sparkle-text-muted hover:text-sparkle-text-secondary hover:bg-sparkle-card-hover'
                            )}
                        >
                            Explorer
                        </button>
                    </div>

                    <div className="flex items-center gap-1 rounded-xl border border-sparkle-border bg-sparkle-card p-1">
                        {VIEW_MODES.map(({ id, icon: Icon }) => (
                            <button
                                key={id}
                                onClick={() => onViewModeChange(id)}
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
        </div>
    )
}
