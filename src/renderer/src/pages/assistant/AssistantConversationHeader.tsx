import { memo, type RefObject } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bot, ChevronLeft, ChevronRight, ListTodo, MoreHorizontal, PanelLeft, PanelRight, SquarePen } from 'lucide-react'
import { cn } from '@/lib/utils'
import { AssistantHeaderOpenWithButton } from './AssistantHeaderOpenWithButton'
import { AssistantProjectGitChip } from './AssistantProjectGitChip'

export const AssistantConversationHeader = memo(function AssistantConversationHeader(props: {
    rightPanelOpen: boolean
    rightPanelMode: 'none' | 'details' | 'plan' | 'diff'
    planPanelAvailable: boolean
    planProgressLabel: string | null
    planIsComplete: boolean
    activeHeaderMenu: 'none' | 'open-with' | 'more'
    setActiveHeaderMenu: (value: 'none' | 'open-with' | 'more') => void
    headerMenuRef: RefObject<HTMLDivElement | null>
    leftSidebarCollapsed: boolean
    latestProjectLabel: string
    selectedSessionTitle: string
    selectedSessionMode: 'work' | 'playground'
    activeThreadIsSubagent: boolean
    activeThreadLabel: string | null
    selectedProjectTooltip: string
    selectedProjectPath: string | null
    preferredShell: 'powershell' | 'cmd'
    gitRefreshToken: string
    onToggleLeftSidebar: () => void
    onTogglePlanPanel: () => void
    onCreateThread: () => void
    onToggleRightSidebar: () => void
}) {
    const {
        rightPanelOpen,
        rightPanelMode,
        planPanelAvailable,
        planProgressLabel,
        planIsComplete,
        activeHeaderMenu,
        setActiveHeaderMenu,
        headerMenuRef,
        leftSidebarCollapsed,
        latestProjectLabel,
        selectedSessionTitle,
        selectedSessionMode,
        activeThreadIsSubagent,
        activeThreadLabel,
        selectedProjectTooltip,
        selectedProjectPath,
        preferredShell,
        gitRefreshToken,
        onToggleLeftSidebar,
        onTogglePlanPanel,
        onCreateThread,
        onToggleRightSidebar
    } = props
    const showHeaderMenu = activeHeaderMenu === 'more'
    const navigate = useNavigate()

    return (
        <div className={cn(
            'flex items-center justify-between gap-2 bg-sparkle-card px-3 py-1.5',
            rightPanelOpen
                ? 'shadow-[inset_-1px_0_0_rgba(255,255,255,0.04),inset_0_-1px_0_rgba(255,255,255,0.04)]'
                : 'shadow-[inset_0_-1px_0_rgba(255,255,255,0.04)]'
        )}>
            <div className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden">
                <button
                    type="button"
                    onClick={onToggleLeftSidebar}
                    className="shrink-0 rounded-lg border border-transparent bg-white/[0.03] p-1.5 text-sparkle-text-secondary transition-colors hover:bg-white/[0.05] hover:text-sparkle-text"
                    title={leftSidebarCollapsed ? 'Expand assistant sidebar' : 'Collapse assistant sidebar'}
                    aria-label={leftSidebarCollapsed ? 'Expand assistant sidebar' : 'Collapse assistant sidebar'}
                >
                    {leftSidebarCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
                </button>
                <div className="flex min-w-0 flex-1 flex-col gap-1 overflow-hidden pl-1">
                    <h2 className="truncate text-[13px] font-semibold leading-tight text-sparkle-text">{selectedSessionTitle}</h2>
                    <div className="flex min-w-0 items-center gap-1.5 overflow-hidden">
                        <span className={cn(
                            'inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-[10px] font-medium leading-none',
                            selectedSessionMode === 'playground'
                                ? 'border-violet-400/20 bg-violet-500/[0.08] text-violet-100'
                                : 'border-sky-400/20 bg-sky-500/[0.08] text-sky-100'
                        )}>
                            {selectedSessionMode === 'playground' ? 'Playground chat' : 'Work chat'}
                        </span>
                        {activeThreadIsSubagent && activeThreadLabel ? (
                            <span
                                className="inline-flex max-w-[220px] shrink-0 items-center gap-1 rounded-full border border-violet-400/20 bg-violet-500/[0.08] px-2 py-0.5 text-[10px] font-medium leading-none text-violet-100"
                                title={`Viewing subagent thread: ${activeThreadLabel}`}
                            >
                                <Bot size={10} />
                                <span className="truncate">{activeThreadLabel}</span>
                            </span>
                        ) : null}
                        <span className="inline-flex max-w-[220px] shrink-0 items-center rounded-full border border-transparent bg-white/[0.04] px-2 py-0.5 text-[10px] font-medium leading-none text-sparkle-text-secondary" title={selectedProjectTooltip}>
                            <span className="truncate">{latestProjectLabel}</span>
                        </span>
                    </div>
                </div>
            </div>
            <div ref={headerMenuRef} className={cn('relative flex shrink-0 items-center gap-1.5', activeHeaderMenu !== 'none' ? 'z-[110]' : 'z-0')}>
                <AssistantHeaderOpenWithButton
                    projectPath={selectedProjectPath}
                    preferredShell={preferredShell}
                    menuWidthMode="trigger"
                    menuPresentation="inline"
                    contextActions={selectedProjectPath ? [{
                        id: 'project',
                        label: 'Project',
                        icon: 'project',
                        onSelect: () => navigate(`/projects/${encodeURIComponent(selectedProjectPath)}`)
                    }] : []}
                    menuOpen={activeHeaderMenu === 'open-with'}
                    onMenuOpenChange={(open) => setActiveHeaderMenu(open ? 'open-with' : 'none')}
                />
                <button
                    type="button"
                    onClick={onTogglePlanPanel}
                    className={cn(
                        'inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-[11px] font-medium transition-colors',
                        rightPanelMode === 'plan' && planIsComplete
                            ? 'border-emerald-400/30 bg-emerald-500/[0.10] text-emerald-100'
                            : rightPanelMode === 'plan'
                                ? 'border-violet-400/30 bg-violet-500/[0.10] text-violet-100'
                                : planIsComplete
                                    ? 'border-emerald-400/20 bg-emerald-500/[0.08] text-emerald-200 hover:border-emerald-300/35 hover:bg-emerald-500/[0.12]'
                                    : 'border-transparent bg-white/[0.03] text-sparkle-text-secondary hover:bg-white/[0.05] hover:text-sparkle-text'
                    )}
                    title={planPanelAvailable ? 'Show plan panel' : 'Show plan panel (no current running todo)'}
                >
                    <ListTodo size={13} />
                    <span>{planPanelAvailable ? (planProgressLabel || 'Plan') : 'Set plan'}</span>
                </button>
                <button
                    type="button"
                    onClick={() => setActiveHeaderMenu(showHeaderMenu ? 'none' : 'more')}
                    className="inline-flex size-8 items-center justify-center rounded-lg border border-transparent bg-white/[0.03] text-sparkle-text-secondary transition-colors hover:bg-white/[0.05] hover:text-sparkle-text"
                    title="More actions"
                >
                    <MoreHorizontal size={14} />
                </button>
                {showHeaderMenu ? (
                    <div className="absolute right-0 top-full z-[180] mt-2 w-64 rounded-lg border border-transparent bg-sparkle-card p-1 shadow-[0_18px_40px_rgba(0,0,0,0.32),inset_0_1px_0_rgba(255,255,255,0.03)]">
                        {selectedProjectPath ? (
                            <div className="mb-1 pb-1">
                                <AssistantProjectGitChip
                                    projectPath={selectedProjectPath}
                                    refreshToken={gitRefreshToken}
                                    variant="menu"
                                />
                            </div>
                        ) : null}
                        <button
                            type="button"
                            onClick={onCreateThread}
                            className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-xs text-sparkle-text-secondary transition-colors hover:bg-sparkle-card-hover hover:text-sparkle-text"
                        >
                            <SquarePen size={13} />
                            New thread
                        </button>
                        <button
                            type="button"
                            onClick={onToggleRightSidebar}
                            className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-xs text-sparkle-text-secondary transition-colors hover:bg-sparkle-card-hover hover:text-sparkle-text"
                        >
                            {rightPanelMode === 'details' ? <PanelRight size={13} /> : <PanelLeft size={13} />}
                            {rightPanelMode === 'details' ? 'Hide details' : 'Show details'}
                        </button>
                    </div>
                ) : null}
            </div>
        </div>
    )
})
