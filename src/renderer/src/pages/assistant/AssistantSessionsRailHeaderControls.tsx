import { BriefcaseBusiness, GitBranch, Plus, SquarePen } from 'lucide-react'
import { cn } from '@/lib/utils'
import type {
    AssistantRailMode,
} from './useAssistantPageSidebarState'

export function AssistantSessionsRailHeaderControls(props: {
    railMode: AssistantRailMode
    commandPending: boolean
    playgroundRootMissing: boolean
    onRailModeChange: (mode: AssistantRailMode) => void
    onChooseProjectPath: () => void
    onOpenLabDialog: () => void
    onChoosePlaygroundRoot: () => void
    onCreatePlaygroundSession: (labId?: string | null) => void
}) {
    const {
        railMode,
        commandPending,
        playgroundRootMissing,
        onRailModeChange,
        onChooseProjectPath,
        onOpenLabDialog,
        onChoosePlaygroundRoot,
        onCreatePlaygroundSession
    } = props

    const addButtonLabel = railMode === 'playground' ? 'Add Lab' : 'Add Project'
    const addButtonTitle = railMode === 'playground' ? 'Add Playground lab' : 'Add project (Open Folder)'
    const newChatButtonTitle = railMode === 'playground' ? 'Start a chat-only Playground session' : 'Start a new chat'
    const playgroundNewChatDisabled = railMode === 'playground' && playgroundRootMissing
    const nextRailMode: AssistantRailMode = railMode === 'work' ? 'playground' : 'work'
    const railToggleLabel = nextRailMode === 'playground' ? 'Playground' : 'Work'
    const railToggleTitle = nextRailMode === 'playground' ? 'Switch sidebar to Playground' : 'Switch sidebar to Work'
    const RailToggleIcon = nextRailMode === 'playground' ? GitBranch : BriefcaseBusiness

    return (
        <>
            <div className="flex items-center justify-between gap-2 px-1 py-3">
                <div className="flex min-w-0 flex-1 items-center gap-1.5">
                    <span className="text-sm font-semibold tracking-tight text-sparkle-text">T3 x dvs</span>
                    <span className="rounded-full bg-white/[0.06] px-1.5 py-0.5 text-[8px] font-medium uppercase tracking-[0.18em] text-sparkle-text-muted/60">Alpha</span>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                    <button
                        type="button"
                        onClick={() => onRailModeChange(nextRailMode)}
                        className={cn(
                            'inline-flex h-8 items-center gap-1.5 rounded-full border border-transparent px-3 text-[11px] font-medium transition-colors',
                            nextRailMode === 'playground'
                                ? 'bg-violet-500/[0.12] text-violet-200 hover:bg-violet-500/[0.18] hover:text-violet-100'
                                : 'bg-sky-500/[0.12] text-sky-200 hover:bg-sky-500/[0.18] hover:text-sky-100'
                        )}
                        title={railToggleTitle}
                    >
                        <RailToggleIcon size={12} className="shrink-0" />
                        <span>{railToggleLabel}</span>
                    </button>
                </div>
            </div>

            <div className="mb-3 px-2">
                {railMode === 'playground' ? (
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={() => {
                                if (playgroundRootMissing) {
                                    onChoosePlaygroundRoot()
                                    return
                                }
                                onOpenLabDialog()
                            }}
                            disabled={commandPending}
                            className="flex min-w-0 flex-1 items-center justify-center gap-2 rounded-md border border-dashed border-white/10 bg-white/[0.02] px-3 py-2 text-xs text-sparkle-text-muted/70 transition-all hover:border-[var(--accent-primary)]/50 hover:bg-[var(--accent-primary)]/10 hover:text-[var(--accent-primary)] disabled:opacity-40"
                            title={playgroundRootMissing ? 'Choose Playground root' : addButtonTitle}
                        >
                            <GitBranch size={14} />
                            <span>{playgroundRootMissing ? 'Choose Playground Root' : 'Add Lab'}</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => onCreatePlaygroundSession(null)}
                            disabled={commandPending || playgroundNewChatDisabled}
                            className="inline-flex h-[34px] w-[42px] shrink-0 items-center justify-center rounded-md border border-transparent bg-white/[0.03] text-sparkle-text-secondary transition-colors hover:bg-white/[0.05] hover:text-sparkle-text disabled:cursor-not-allowed disabled:opacity-35"
                            title={playgroundNewChatDisabled ? 'Choose Playground root first' : newChatButtonTitle}
                            aria-label="New chat"
                        >
                            <SquarePen size={14} />
                        </button>
                    </div>
                ) : (
                    <button
                        type="button"
                        onClick={onChooseProjectPath}
                        disabled={commandPending}
                        className="flex w-full items-center justify-center gap-2 rounded-md border border-dashed border-white/10 bg-white/[0.02] px-3 py-2 text-xs text-sparkle-text-muted/70 transition-all hover:border-[var(--accent-primary)]/50 hover:bg-[var(--accent-primary)]/10 hover:text-[var(--accent-primary)] disabled:opacity-40"
                        title={addButtonTitle}
                    >
                        <Plus size={14} />
                        <span>{addButtonLabel}</span>
                    </button>
                )}
            </div>
        </>
    )
}
