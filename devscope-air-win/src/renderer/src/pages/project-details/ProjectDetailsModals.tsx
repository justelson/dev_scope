import { useDeferredValue, useMemo, useState } from 'react'
import { AlertCircle, ExternalLink, Package, Search, X } from 'lucide-react'

export function AuthorMismatchModal({
    gitUser,
    repoOwner,
    onConfirm,
    onCancel,
    dontShowAgain,
    setDontShowAgain
}: {
    gitUser: { name: string; email: string },
    repoOwner: string,
    onConfirm: () => void,
    onCancel: () => void,
    dontShowAgain: boolean,
    setDontShowAgain: (value: boolean) => void
}) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md animate-fadeIn" onClick={onCancel}>
            <div
                className="bg-sparkle-card border border-yellow-500/30 rounded-2xl shadow-2xl w-full max-w-md m-4 overflow-hidden"
                onClick={e => e.stopPropagation()}
            >
                <div className="p-6">
                    <div className="flex items-start gap-4 mb-4">
                        <div className="p-3 rounded-xl bg-yellow-500/10 border border-yellow-500/20">
                            <AlertCircle size={24} className="text-yellow-500" />
                        </div>
                        <div className="flex-1">
                            <h3 className="text-lg font-semibold text-white mb-2">
                                Author Mismatch Warning
                            </h3>
                            <p className="text-sm text-white/60 mb-4">
                                Your current Git user doesn't match the repository owner.
                            </p>

                            <div className="space-y-3 bg-black/30 rounded-xl p-4 border border-white/5">
                                <div>
                                    <p className="text-xs text-white/40 mb-1">Repository Owner:</p>
                                    <p className="text-sm font-mono text-white/80">{repoOwner}</p>
                                </div>
                                <div>
                                    <p className="text-xs text-white/40 mb-1">Current Git User:</p>
                                    <p className="text-sm font-mono text-white/80">{gitUser.name}</p>
                                    <p className="text-xs font-mono text-white/40">{gitUser.email}</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <label className="flex items-center gap-2 mb-4 cursor-pointer group">
                        <input
                            type="checkbox"
                            checked={dontShowAgain}
                            onChange={(e) => setDontShowAgain(e.target.checked)}
                            className="w-4 h-4 rounded border-white/20 bg-white/5 text-[var(--accent-primary)] focus:ring-2 focus:ring-[var(--accent-primary)]/50"
                        />
                        <span className="text-sm text-white/60 group-hover:text-white/80 transition-colors">
                            Don't show this warning again
                        </span>
                    </label>

                    <div className="flex items-center gap-3">
                        <button
                            onClick={onCancel}
                            className="flex-1 px-4 py-2.5 bg-white/5 hover:bg-white/10 text-white text-sm font-medium rounded-lg transition-all border border-white/10"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={onConfirm}
                            className="flex-1 px-4 py-2.5 bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-500 hover:text-yellow-400 text-sm font-medium rounded-lg transition-all border border-yellow-500/30"
                        >
                            Commit Anyway
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}

export function DependenciesModal({ dependencies, onClose }: { dependencies: Record<string, string>, onClose: () => void }) {
    const [search, setSearch] = useState('')
    const deferredSearch = useDeferredValue(search)
    const searchValue = deferredSearch.toLowerCase()
    const filtered = useMemo(() => Object.entries(dependencies).filter(([name]) =>
        name.toLowerCase().includes(searchValue)
    ), [dependencies, searchValue])

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md animate-fadeIn" onClick={onClose}>
            <div
                className="bg-sparkle-card border border-white/10 rounded-2xl shadow-2xl w-full max-w-xl max-h-[80vh] flex flex-col m-4 overflow-hidden"
                onClick={e => e.stopPropagation()}
            >
                <div className="flex items-center justify-between p-5 border-b border-white/5 bg-white/5">
                    <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                        <Package size={20} className="text-[var(--accent-primary)]" />
                        Dependencies
                        <span className="px-2 py-0.5 rounded-full bg-white/10 text-xs font-normal text-white/60">
                            {Object.keys(dependencies).length}
                        </span>
                    </h3>
                    <button onClick={onClose} className="text-white/40 hover:text-white transition-colors p-1 rounded-lg hover:bg-white/10">
                        <X size={20} />
                    </button>
                </div>

                <div className="p-4 border-b border-white/5 bg-black/20">
                    <div className="relative">
                        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search packages..."
                            autoFocus
                            className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-[var(--accent-primary)]/50 focus:bg-white/10 transition-all"
                        />
                    </div>
                </div>

                <div className="overflow-y-auto p-2 custom-scrollbar flex-1 bg-black/10">
                    {filtered.length > 0 ? (
                        <div className="grid grid-cols-1 gap-1">
                            {filtered.map(([name, version]) => (
                                <div key={name} className="flex items-center justify-between p-3 hover:bg-white/5 rounded-xl group transition-all border border-transparent hover:border-white/5">
                                    <span className="text-sm text-white/80 font-mono font-medium">{name}</span>
                                    <div className="flex items-center gap-3">
                                        <span className="text-xs text-white/40 font-mono px-2 py-1 rounded bg-black/30 border border-white/5">{version}</span>
                                        <a
                                            href={`https://www.npmjs.com/package/${name}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="opacity-0 group-hover:opacity-100 text-[var(--accent-primary)] hover:brightness-125 transition-all p-1.5 hover:bg-[var(--accent-primary)]/10 rounded-lg"
                                            title="View on npm"
                                        >
                                            <ExternalLink size={14} />
                                        </a>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center py-16 text-white/30">
                            <Package size={48} className="mb-4 opacity-20" />
                            <p className="text-sm">No packages found</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}

