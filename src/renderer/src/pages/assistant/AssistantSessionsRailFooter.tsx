import type { ComponentProps, MouseEvent as ReactMouseEvent } from 'react'
import { Archive } from 'lucide-react'
import type { AssistantSession } from '@shared/assistant/contracts'
import { AnimatedHeight } from '@/components/ui/AnimatedHeight'
import { FileActionsMenu } from '@/components/ui/FileActionsMenu'
import { cn } from '@/lib/utils'
import { ProjectGroupIcon, SessionRow } from './AssistantSessionsRailRows'
import type { SessionProjectGroup } from './assistant-sessions-rail-utils'
import {
    getPrimarySessionThread,
    getSessionDisplayTitle,
    resolveSessionStatusPill
} from './assistant-sessions-rail-utils'

export function AssistantSessionsRailFooter(props: {
    compact: boolean
    activeSessionId: string | null
    activeThreadId: string | null
    recencyTierByThreadId: ReadonlyMap<string, number>
    limitedBackgroundActivitySessions: AssistantSession[]
    remainingBackgroundActivityCount: number
    archivedCount: number
    showArchivedSessions: boolean
    visibleArchivedGroups: SessionProjectGroup[]
    getSessionMenuItems: (session: AssistantSession, archived?: boolean) => ComponentProps<typeof FileActionsMenu>['items']
    onSessionContextMenu: (event: ReactMouseEvent<HTMLElement>, session: AssistantSession, archived?: boolean) => void
    onSetShowArchivedSessions: (value: boolean) => void
    onSelectSession: (sessionId: string) => void
    onSelectThread: (input: { sessionId: string; threadId: string }) => void
}) {
    const {
        compact,
        activeSessionId,
        activeThreadId,
        recencyTierByThreadId,
        limitedBackgroundActivitySessions,
        remainingBackgroundActivityCount,
        archivedCount,
        showArchivedSessions,
        visibleArchivedGroups,
        getSessionMenuItems,
        onSessionContextMenu,
        onSetShowArchivedSessions,
        onSelectSession,
        onSelectThread
    } = props

    return (
        <div className="mt-auto space-y-0.5 border-t border-white/10 px-1 py-2">
            {limitedBackgroundActivitySessions.length > 0 ? (
                <div className="mb-2 space-y-1">
                    <div className="flex items-center justify-between px-2">
                        <span className="text-[10px] uppercase tracking-[0.18em] text-sparkle-text-muted/35">Background Activity</span>
                        {remainingBackgroundActivityCount > 0 ? <span className="text-[10px] text-sparkle-text-muted/35">+{remainingBackgroundActivityCount} more</span> : null}
                    </div>
                    <div className="space-y-1">
                        {limitedBackgroundActivitySessions.map((session) => {
                            const status = resolveSessionStatusPill(session, activeSessionId, recencyTierByThreadId)
                            const primaryThread = getPrimarySessionThread(session)
                            const sessionMenuItems = getSessionMenuItems(session)
                            return (
                                <div key={`background-${session.id}`} className="group relative">
                                    <button
                                        type="button"
                                        onContextMenu={(event) => onSessionContextMenu(event, session)}
                                        onClick={() => {
                                            if (primaryThread) {
                                                onSelectThread({ sessionId: session.id, threadId: primaryThread.id })
                                            } else {
                                                onSelectSession(session.id)
                                            }
                                        }}
                                        className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 pr-10 text-left transition-colors hover:bg-white/[0.04]"
                                    >
                                        <span className={cn('h-1.5 w-1.5 rounded-full shrink-0', status?.dotClass || (session.mode === 'playground' ? 'bg-violet-400' : 'bg-sky-400'))} />
                                        <div className="min-w-0 flex-1">
                                            <div className="truncate text-[11px] font-medium text-sparkle-text">{getSessionDisplayTitle(session)}</div>
                                            <div className="truncate text-[10px] text-sparkle-text-muted/55">{session.mode === 'playground' ? 'Playground' : 'Work'} · {status?.label || 'Active'}</div>
                                        </div>
                                    </button>
                                    <div className="pointer-events-none absolute right-1 top-1/2 -translate-y-1/2 opacity-0 transition-opacity group-hover:pointer-events-auto group-hover:opacity-100 focus-within:pointer-events-auto focus-within:opacity-100">
                                        <FileActionsMenu
                                            items={sessionMenuItems}
                                            title={`${getSessionDisplayTitle(session)} actions`}
                                            presentation="portal"
                                            buttonClassName="h-7 w-7 border-transparent bg-white/[0.03] text-sparkle-text-secondary/65 hover:bg-white/[0.06] hover:text-sparkle-text"
                                        />
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </div>
            ) : null}

            {archivedCount > 0 ? (
                <button
                    type="button"
                    onClick={() => onSetShowArchivedSessions(!showArchivedSessions)}
                    className={cn(
                        'group flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs transition-colors',
                        showArchivedSessions
                            ? 'bg-white/[0.06] text-sparkle-text'
                            : 'text-sparkle-text-muted/70 hover:bg-white/[0.04] hover:text-sparkle-text'
                    )}
                >
                    <Archive size={14} className={cn('transition-colors', showArchivedSessions ? 'text-amber-400' : 'text-sparkle-text-muted/50')} />
                    <span className="flex-1 text-left">Archived Chats</span>
                    <span className="rounded-[4px] border border-white/10 bg-white/[0.03] px-1 py-0.5 text-[9px]">{archivedCount}</span>
                </button>
            ) : null}

            <AnimatedHeight isOpen={showArchivedSessions} duration={300}>
                <div className="mt-1 max-h-[30vh] overflow-y-auto rounded-lg bg-black/20 p-1 custom-scrollbar">
                    {visibleArchivedGroups.length > 0 ? visibleArchivedGroups.map((group) => (
                        <section key={`footer-archived-${group.key}`} className="mb-2 space-y-0.5 last:mb-0">
                            <div className="flex items-center gap-2 px-2 py-1 text-[10px] uppercase tracking-widest text-sparkle-text-muted/40">
                                <ProjectGroupIcon group={group} size={10} expanded />
                                <span className="truncate">{group.label}</span>
                            </div>
                            {group.sessions.map((session) => {
                                const primaryThread = getPrimarySessionThread(session)
                                const isActive = session.id === activeSessionId && primaryThread?.id === activeThreadId
                                return (
                                    <div key={session.id} className="group/menu-item relative">
                                        <SessionRow
                                            session={session}
                                            thread={primaryThread}
                                            isActive={isActive}
                                            recencyTierByThreadId={recencyTierByThreadId}
                                            archived
                                            compact={compact}
                                            onActivate={() => {
                                                if (!primaryThread || isActive) return
                                                onSelectThread({ sessionId: session.id, threadId: primaryThread.id })
                                            }}
                                            onContextMenu={(event) => onSessionContextMenu(event, session, true)}
                                            menuItems={getSessionMenuItems(session, true)}
                                        />
                                    </div>
                                )
                            })}
                        </section>
                    )) : <div className="py-4 text-center text-[10px] italic text-sparkle-text-muted/40">No archived sessions</div>}
                </div>
            </AnimatedHeight>
        </div>
    )
}
