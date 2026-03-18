import { ArrowRight, File, Folder, Slash } from 'lucide-react'

export function CommandPaletteIntro({
    recent,
    onSelectQuery
}: {
    recent: string[]
    onSelectQuery: (value: string) => void
}) {
    return (
        <div className="p-4 sm:p-5">
            <div className="mb-6">
                <div className="mb-3 flex items-center gap-2 px-1 text-[10px] font-mono font-bold uppercase tracking-widest text-[var(--accent-primary)]">
                    <Slash size={12} className="opacity-70" /> Quick Search
                </div>
                <div className="grid grid-cols-2 gap-3">
                    <button
                        onClick={() => onSelectQuery('/ ')}
                        className="group flex items-start gap-3 rounded-xl border border-sparkle-border bg-sparkle-bg p-3 text-left shadow-sm transition-all hover:border-[var(--accent-primary)]/40 hover:bg-sparkle-card-hover sm:p-4"
                    >
                        <div className="rounded-lg border border-sparkle-border bg-sparkle-card-hover p-2 text-sparkle-text-secondary transition-all group-hover:border-[var(--accent-primary)]/20 group-hover:bg-[var(--accent-primary)]/10 group-hover:text-[var(--accent-primary)]">
                            <Folder size={18} className="stroke-[1.5]" />
                        </div>
                        <div>
                            <div className="mb-0.5 text-[14px] font-semibold text-sparkle-text">Projects</div>
                            <div className="text-[11px] text-sparkle-text-muted">Type <span className="rounded border border-sparkle-border bg-sparkle-card px-1 py-0.5 font-mono text-sparkle-text-secondary">/</span></div>
                        </div>
                    </button>
                    <button
                        onClick={() => onSelectQuery('// ')}
                        className="group flex items-start gap-3 rounded-xl border border-sparkle-border bg-sparkle-bg p-3 text-left shadow-sm transition-all hover:border-[var(--accent-primary)]/40 hover:bg-sparkle-card-hover sm:p-4"
                    >
                        <div className="rounded-lg border border-sparkle-border bg-sparkle-card-hover p-2 text-sparkle-text-secondary transition-all group-hover:border-[var(--accent-primary)]/20 group-hover:bg-[var(--accent-primary)]/10 group-hover:text-[var(--accent-primary)]">
                            <File size={18} className="stroke-[1.5]" />
                        </div>
                        <div>
                            <div className="mb-0.5 text-[14px] font-semibold text-sparkle-text">Files</div>
                            <div className="text-[11px] text-sparkle-text-muted">Type <span className="rounded border border-sparkle-border bg-sparkle-card px-1 py-0.5 font-mono text-sparkle-text-secondary">//</span></div>
                        </div>
                    </button>
                </div>
            </div>

            {recent.length > 0 && (
                <div>
                    <div className="mb-2 flex items-center gap-2 px-1 text-[10px] font-mono font-bold uppercase tracking-widest text-[var(--accent-primary)]">History</div>
                    <div className="flex flex-col gap-1">
                        {recent.map((value) => (
                            <button
                                key={value}
                                onClick={() => onSelectQuery(`${value} `)}
                                className="group flex w-full items-center justify-between rounded-lg border border-transparent px-3 py-2 text-left text-[13px] text-sparkle-text-secondary transition-colors hover:border-sparkle-border/40 hover:bg-sparkle-card-hover hover:text-sparkle-text"
                            >
                                <div className="flex items-center gap-2.5">
                                    <div className="h-1.5 w-1.5 rounded-full bg-sparkle-text-muted transition-all group-hover:bg-[var(--accent-primary)]" />
                                    <span className="font-medium">{value}</span>
                                </div>
                                <ArrowRight size={14} className="text-[var(--accent-primary)] opacity-0 transition-opacity group-hover:opacity-100" />
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    )
}
