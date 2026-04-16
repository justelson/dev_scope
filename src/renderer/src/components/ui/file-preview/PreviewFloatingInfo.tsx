import { Info } from 'lucide-react'

export interface PreviewFloatingInfoChip {
    label: string
    className: string
}

interface PreviewFloatingInfoProps {
    chips: PreviewFloatingInfoChip[]
}

export function PreviewFloatingInfo({ chips }: PreviewFloatingInfoProps) {
    if (chips.length === 0) return null

    return (
        <div className="pointer-events-none absolute bottom-3 right-3 z-20 translate-y-2 opacity-0 transition-all duration-200 group-hover/preview:translate-y-0 group-hover/preview:opacity-100 group-focus-within/preview:translate-y-0 group-focus-within/preview:opacity-100">
            <div className="group/info relative pointer-events-auto">
                <div className="pointer-events-none absolute bottom-full right-0 mb-2 w-[min(28rem,calc(100vw-2rem))] translate-y-1 rounded-xl border border-white/10 bg-sparkle-card/92 p-3 opacity-0 shadow-2xl shadow-black/35 backdrop-blur-md transition-all duration-150 group-hover/info:translate-y-0 group-hover/info:opacity-100 group-focus-within/info:translate-y-0 group-focus-within/info:opacity-100">
                    <div className="flex flex-wrap items-center justify-end gap-1.5">
                        {chips.map((chip) => (
                            <span key={`${chip.label}:${chip.className}`} className={chip.className}>
                                {chip.label}
                            </span>
                        ))}
                    </div>
                </div>
                <button
                    type="button"
                    className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-sparkle-card/88 text-sparkle-text-secondary shadow-lg shadow-black/25 backdrop-blur-md transition-colors hover:border-white/20 hover:bg-white/[0.05] hover:text-sparkle-text focus-visible:border-white/20 focus-visible:bg-white/[0.05] focus-visible:text-sparkle-text"
                    aria-label="Show file info"
                    title="Show file info"
                >
                    <Info size={14} />
                </button>
            </div>
        </div>
    )
}
