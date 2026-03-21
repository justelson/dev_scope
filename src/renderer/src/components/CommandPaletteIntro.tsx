import { ArrowRight, File, Folder, Slash } from 'lucide-react'

export function CommandPaletteIntro({
    recent,
    onSelectQuery
}: {
    recent: string[]
    onSelectQuery: (value: string) => void
}) {
    return (
        <div className="p-2">
            <div className="mb-4">
                <div className="mb-2 flex items-center gap-2 px-2 text-[11px] font-mono font-bold uppercase tracking-[0.12em] text-[var(--accent-primary)]">
                    <Slash size={12} className="opacity-70" /> Quick Search
                </div>
                <div className="flex flex-col gap-1">
                    <button
                        onClick={() => onSelectQuery('/ ')}
                        className="group flex items-center gap-3 rounded-xl border border-transparent px-3 py-2.5 text-left transition-all hover:border-white/10 hover:bg-white/[0.03]"
                    >
                        <div className="flex h-10 w-10 items-center justify-center rounded-[10px] border border-white/8 bg-white/[0.04] text-white/55 transition-all group-hover:border-[var(--accent-primary)]/20 group-hover:bg-[var(--accent-primary)]/10 group-hover:text-[var(--accent-primary)]">
                            <Folder size={17} className="stroke-[1.5]" />
                        </div>
                        <div className="min-w-0 flex-1">
                            <div className="text-[14px] font-semibold text-sparkle-text">Projects</div>
                            <div className="text-[12px] text-white/46">Jump directly into project details</div>
                        </div>
                        <span className="rounded-md border border-white/10 bg-white/[0.04] px-2 py-1 font-mono text-[11px] text-white/60">/</span>
                    </button>
                    <button
                        onClick={() => onSelectQuery('// ')}
                        className="group flex items-center gap-3 rounded-xl border border-transparent px-3 py-2.5 text-left transition-all hover:border-white/10 hover:bg-white/[0.03]"
                    >
                        <div className="flex h-10 w-10 items-center justify-center rounded-[10px] border border-white/8 bg-white/[0.04] text-white/55 transition-all group-hover:border-[var(--accent-primary)]/20 group-hover:bg-[var(--accent-primary)]/10 group-hover:text-[var(--accent-primary)]">
                            <File size={17} className="stroke-[1.5]" />
                        </div>
                        <div className="min-w-0 flex-1">
                            <div className="text-[14px] font-semibold text-sparkle-text">Files</div>
                            <div className="text-[12px] text-white/46">Search indexed files across projects</div>
                        </div>
                        <span className="rounded-md border border-white/10 bg-white/[0.04] px-2 py-1 font-mono text-[11px] text-white/60">//</span>
                    </button>
                </div>
            </div>

            {recent.length > 0 && (
                <div>
                    <div className="mb-2 flex items-center gap-2 px-2 text-[11px] font-mono font-bold uppercase tracking-[0.12em] text-[var(--accent-primary)]">Recent Searches</div>
                    <div className="flex flex-col gap-1">
                        {recent.map((value) => (
                            <button
                                key={value}
                                onClick={() => onSelectQuery(`${value} `)}
                                className="group flex w-full items-center justify-between rounded-xl border border-transparent px-3 py-2.5 text-left text-[13px] text-white/58 transition-colors hover:border-white/10 hover:bg-white/[0.03] hover:text-sparkle-text"
                            >
                                <div className="flex items-center gap-2.5">
                                    <div className="h-1.5 w-1.5 rounded-full bg-white/24 transition-all group-hover:bg-[var(--accent-primary)]" />
                                    <span className="font-medium">{value}</span>
                                </div>
                                <ArrowRight size={14} className="text-white/28 opacity-0 transition-opacity group-hover:opacity-100 group-hover:text-[var(--accent-primary)]" />
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    )
}
