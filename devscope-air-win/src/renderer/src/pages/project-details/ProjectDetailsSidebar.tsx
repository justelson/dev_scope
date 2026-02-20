import { Command, Package, Play } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
    SCRIPT_INTENT_BADGE_CLASSES,
    SCRIPT_INTENT_LABELS,
    detectScriptIntentWithConfidence,
    type ScriptIntentContext,
    type ScriptIntentPrediction
} from './scriptRun'

export function ProjectDetailsSidebar({
    scripts,
    dependencies,
    scriptPredictions,
    scriptIntentContext,
    onRunScript,
    onShowDependencies
}: {
    scripts?: Record<string, string>
    dependencies?: Record<string, string>
    scriptPredictions: Record<string, ScriptIntentPrediction>
    scriptIntentContext: ScriptIntentContext
    onRunScript: (name: string, command: string) => void
    onShowDependencies: () => void
}) {
    return (
        <div className="col-span-12 lg:col-span-4 flex flex-col gap-6">
            {scripts && Object.keys(scripts).length > 0 && (
                <div className="bg-sparkle-card border border-white/5 rounded-2xl overflow-hidden shadow-sm flex flex-col">
                    <div className="px-5 py-4 border-b border-white/5 bg-white/[0.02] flex items-center justify-between">
                        <div className="flex items-center gap-2 text-white/80 font-medium">
                            <Command size={18} className="text-[var(--accent-primary)]" />
                            <span>Scripts</span>
                        </div>
                        <span className="text-xs bg-white/5 text-white/40 px-2 py-1 rounded-md">
                            {Object.keys(scripts).length}
                        </span>
                    </div>
                    <div className="max-h-[380px] overflow-y-auto custom-scrollbar p-2">
                        {Object.entries(scripts).map(([name, command]) => {
                            const prediction = scriptPredictions[name] || detectScriptIntentWithConfidence(name, command, scriptIntentContext)
                            const confidencePercent = Math.round(prediction.confidence * 100)

                            return (
                                <div key={name} className="group flex items-center gap-3 p-3 hover:bg-white/5 rounded-xl transition-colors border border-transparent hover:border-white/5">
                                    <button
                                        onClick={() => onRunScript(name, command)}
                                        className="p-2.5 rounded-full bg-[var(--accent-primary)]/10 text-[var(--accent-primary)] group-hover:bg-[var(--accent-primary)] group-hover:text-white transition-all shrink-0"
                                        title="Run Script"
                                    >
                                        <Play size={16} />
                                    </button>
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center justify-between gap-2">
                                            <span className="text-sm font-medium text-white/90 truncate">{name}</span>
                                            <div className="flex items-center gap-1.5 shrink-0">
                                                <span className={cn('text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full border', SCRIPT_INTENT_BADGE_CLASSES[prediction.intent])}>
                                                    {SCRIPT_INTENT_LABELS[prediction.intent]}
                                                </span>
                                                <span className="text-[10px] text-white/45 bg-white/10 px-1.5 py-0.5 rounded-full border border-white/10">
                                                    {confidencePercent}%
                                                </span>
                                            </div>
                                        </div>
                                        <p className="text-xs text-white/40 truncate font-mono mt-0.5">{command}</p>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </div>
            )}

            {dependencies && (
                <div className="bg-sparkle-card border border-white/5 rounded-2xl overflow-hidden shadow-sm">
                    <div className="px-5 py-4 border-b border-white/5 bg-white/[0.02] flex items-center justify-between">
                        <div className="flex items-center gap-2 text-white/80 font-medium">
                            <Package size={18} className="text-purple-400" />
                            <span>Dependencies</span>
                            <span className="text-xs bg-white/5 text-white/40 px-2 py-1 rounded-md">
                                {Object.keys(dependencies).length}
                            </span>
                        </div>
                        <button
                            onClick={onShowDependencies}
                            className="text-xs text-white/40 hover:text-white transition-colors"
                        >
                            View All
                        </button>
                    </div>
                    <div className="p-2">
                        {Object.entries(dependencies).slice(0, 5).map(([name, version]) => (
                            <div key={name} className="flex items-center justify-between p-2.5 rounded-lg hover:bg-white/5 transition-colors">
                                <span className="text-sm text-white/70 truncate max-w-[150px]">{name}</span>
                                <span className="text-xs font-mono text-white/30 bg-white/5 px-1.5 py-0.5 rounded">{version}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    )
}
