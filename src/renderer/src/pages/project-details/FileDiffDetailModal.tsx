import { useState } from 'react'
import { Check, Copy, RefreshCw, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { DiffStats } from './DiffStats'
import MonacoDiffViewer from '@/components/ui/diff-viewer/MonacoDiffViewer'

interface FileDiffDetailModalProps {
    isOpen: boolean
    filePath: string
    diff: string
    loading?: boolean
    additions?: number
    deletions?: number
    status?: 'modified' | 'untracked' | 'added' | 'deleted' | 'renamed' | 'ignored' | 'unknown'
    subtitle?: string
    onClose: () => void
}

function getStatusTone(status?: FileDiffDetailModalProps['status']) {
    switch (status) {
        case 'modified':
            return 'bg-[#E2C08D]/20 text-[#E2C08D]'
        case 'untracked':
        case 'added':
            return 'bg-[#73C991]/20 text-[#73C991]'
        case 'deleted':
            return 'bg-[#FF6B6B]/20 text-[#FF6B6B]'
        case 'renamed':
            return 'bg-blue-500/20 text-blue-300'
        default:
            return 'bg-white/10 text-white/60'
    }
}

export function FileDiffDetailModal({
    isOpen,
    filePath,
    diff,
    loading = false,
    additions = 0,
    deletions = 0,
    status,
    subtitle,
    onClose
}: FileDiffDetailModalProps) {
    const [copied, setCopied] = useState(false)

    if (!isOpen) return null

    const hasDiff = Boolean(diff && diff !== 'No changes' && diff !== 'No diff available')
    const lines = hasDiff ? diff.split('\n') : []

    const handleCopyPath = async () => {
        await navigator.clipboard.writeText(filePath)
        setCopied(true)
        setTimeout(() => setCopied(false), 1200)
    }

    return (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={onClose}>
            <div
                className="w-full max-w-6xl h-[86vh] min-h-[420px] max-h-[86vh] overflow-hidden rounded-2xl bg-sparkle-card border border-white/10 shadow-2xl flex flex-col"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-white/10 bg-white/[0.03]">
                    <div className="min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                            <h4 className="text-sm font-semibold text-white truncate">{filePath}</h4>
                            {status && (
                                <span className={cn('text-[10px] uppercase font-bold px-1.5 py-0.5 rounded', getStatusTone(status))}>
                                    {status}
                                </span>
                            )}
                        </div>
                        {subtitle && <p className="text-xs text-white/50">{subtitle}</p>}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                        <DiffStats additions={additions} deletions={deletions} />
                        <button
                            onClick={() => { void handleCopyPath() }}
                            className={cn(
                                'p-1.5 rounded-lg transition-colors',
                                copied
                                    ? 'text-emerald-300 bg-emerald-500/10'
                                    : 'text-white/50 hover:text-white hover:bg-white/10'
                            )}
                            title={copied ? 'Copied' : 'Copy path'}
                        >
                            {copied ? <Check size={14} /> : <Copy size={14} />}
                        </button>
                        <button onClick={onClose} className="p-1.5 rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-colors">
                            <X size={16} />
                        </button>
                    </div>
                </div>

                <div className="flex-1 min-h-0 overflow-hidden bg-black/20">
                    {loading ? (
                        <div className="flex items-center justify-center py-16 text-white/30">
                            <RefreshCw size={18} className="animate-spin mr-2" />
                            <span className="text-sm">Loading diff...</span>
                        </div>
                    ) : hasDiff ? (
                        <MonacoDiffViewer filePath={filePath} diff={diff} />
                    ) : (
                        <div className="flex items-center justify-center py-16 text-white/35">
                            <span className="text-sm">No diff available for this file.</span>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
