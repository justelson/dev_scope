import { ArrowRight, Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { CommandPaletteResult } from './command-palette-types'

export function CommandPaletteResults({
    query,
    results,
    selectedIndex,
    setSelectedIndex,
    selectResult,
    loadingFiles
}: {
    query: string
    results: CommandPaletteResult[]
    selectedIndex: number
    setSelectedIndex: (value: number | ((current: number) => number)) => void
    selectResult: (result?: CommandPaletteResult) => void
    loadingFiles: boolean
}) {
    return (
        <>
            {results.length > 0 ? (
                <div className="flex-1 p-2">
                    {results.map((result, index) => {
                        const isSelected = index === selectedIndex
                        const showGroupLabel = index === 0 || results[index - 1]?.group !== result.group

                        return (
                            <div key={result.id} className="mb-1.5 last:mb-0">
                                {showGroupLabel ? (
                                    <div className="mb-1 flex items-center gap-3 px-2 pt-2">
                                        <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/34">
                                            {result.group}
                                        </span>
                                    </div>
                                ) : null}

                                <button
                                    onClick={() => selectResult(result)}
                                    onMouseEnter={() => setSelectedIndex(index)}
                                    className={cn(
                                        'group flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left outline-none transition-all',
                                        isSelected
                                            ? 'border-white/12 bg-white/[0.04]'
                                            : 'border-transparent bg-transparent hover:border-white/10 hover:bg-white/[0.03]'
                                    )}
                                >
                                    <div className={cn(
                                        'flex h-10 w-10 items-center justify-center rounded-[10px] border transition-colors',
                                        isSelected
                                            ? 'border-[var(--accent-primary)]/18 bg-[var(--accent-primary)]/10 text-[var(--accent-primary)]'
                                            : 'border-white/8 bg-white/[0.035] text-white/56 group-hover:border-white/12 group-hover:text-white/80'
                                    )}>
                                        {result.icon}
                                    </div>

                                    <div className="min-w-0 flex-1">
                                        <div className="mb-1 flex items-center gap-2">
                                            <span className={cn(
                                                'truncate text-[14px] font-semibold transition-colors',
                                                isSelected ? 'text-white' : 'text-sparkle-text'
                                            )}>
                                                {result.title}
                                            </span>
                                            {result.badge ? (
                                                <span className={cn(
                                                    'rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em]',
                                                    isSelected
                                                        ? 'border-[var(--accent-primary)]/18 bg-[var(--accent-primary)]/10 text-[var(--accent-primary)]'
                                                        : 'border-white/8 bg-white/[0.03] text-white/42'
                                                )}>
                                                    {result.badge}
                                                </span>
                                            ) : null}
                                        </div>
                                        {result.subtitle ? (
                                            <p className={cn(
                                                'truncate text-[12px] transition-colors',
                                                isSelected ? 'text-white/62' : 'text-white/42'
                                            )}>
                                                {result.subtitle}
                                            </p>
                                        ) : null}
                                    </div>

                                    <ArrowRight
                                        size={16}
                                        className={cn(
                                            'transition-colors',
                                            isSelected ? 'text-white/60' : 'text-white/20 group-hover:text-white/45'
                                        )}
                                    />
                                </button>
                            </div>
                        )
                    })}
                </div>
            ) : null}

            {results.length === 0 && query.trim() !== '' && !loadingFiles ? (
                <div className="flex flex-col items-center justify-center p-12 text-center">
                    <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04]">
                        <Search size={24} className="stroke-[1.5] text-white/40" />
                    </div>
                    <div className="mb-1 text-base font-semibold text-sparkle-text">No results found</div>
                    <div className="max-w-[280px] text-[13px] text-white/46">
                        No match for "{query}". Try a broader term, or switch modes with `/` and `//`.
                    </div>
                </div>
            ) : null}

            {loadingFiles ? (
                <div className="flex flex-col items-center justify-center p-12 text-center">
                    <div className="mb-4 h-10 w-10 animate-spin rounded-full border-2 border-white/12 border-t-[var(--accent-primary)]" />
                    <div className="text-sm font-semibold text-sparkle-text">Scanning folders...</div>
                </div>
            ) : null}
        </>
    )
}
