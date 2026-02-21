import { AlignJustify, Filter, LayoutGrid, List, Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getProjectTypeById, type ViewMode } from './types'

interface FolderBrowseToolbarProps {
    searchQuery: string
    filterType: string
    projectTypes: string[]
    viewMode: ViewMode
    onSearchQueryChange: (value: string) => void
    onFilterTypeChange: (value: string) => void
    onViewModeChange: (value: ViewMode) => void
}

const VIEW_MODES: Array<{ id: ViewMode; icon: typeof LayoutGrid }> = [
    { id: 'grid', icon: LayoutGrid },
    { id: 'detailed', icon: AlignJustify },
    { id: 'list', icon: List }
]

export function FolderBrowseToolbar({
    searchQuery,
    filterType,
    projectTypes,
    viewMode,
    onSearchQueryChange,
    onFilterTypeChange,
    onViewModeChange
}: FolderBrowseToolbarProps) {
    return (
        <div className="sticky -top-6 z-20 bg-sparkle-bg/95 backdrop-blur-xl pt-6 pb-4 mb-6 -mx-6 px-6 border-b border-white/5">
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
                    <div className="flex items-center gap-1.5 bg-sparkle-card p-1.5 rounded-2xl border border-white/10 shadow-sm">
                        {VIEW_MODES.map(({ id, icon: Icon }) => (
                            <button
                                key={id}
                                onClick={() => onViewModeChange(id)}
                                className={cn(
                                    'p-2.5 rounded-xl transition-all duration-300',
                                    viewMode === id
                                        ? 'bg-white/10 text-white shadow-inner scale-105'
                                        : 'text-white/30 hover:text-white hover:bg-white/5'
                                )}
                            >
                                <Icon size={18} />
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    )
}
