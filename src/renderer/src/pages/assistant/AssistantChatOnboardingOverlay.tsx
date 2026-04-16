import { memo } from 'react'
import { FolderOpen, GitBranch, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

export const AssistantChatOnboardingOverlay = memo(function AssistantChatOnboardingOverlay(props: {
    mode: 'work-project' | 'playground-chat' | 'playground-root'
    busy?: boolean
    hasSession?: boolean
    playgroundRootConfigured?: boolean
    onChooseProject?: () => Promise<void> | void
    onChoosePlaygroundRoot?: () => Promise<void> | void
    onStartDetachedPlaygroundChat?: () => Promise<void> | void
}) {
    const {
        mode,
        busy = false,
        hasSession = false,
        playgroundRootConfigured = false,
        onChooseProject,
        onChoosePlaygroundRoot,
        onStartDetachedPlaygroundChat
    } = props

    const isWorkProjectMode = mode === 'work-project'
    const isPlaygroundRootMode = mode === 'playground-root'
    const title = isWorkProjectMode
        ? 'Select a project for Work chat'
        : (isPlaygroundRootMode ? 'Choose a Playground root' : 'Start a detached Playground chat')
    const body = isWorkProjectMode
        ? 'Work chats need a project folder so file context, terminal commands, and edits stay anchored to the right place.'
        : (isPlaygroundRootMode
            ? 'Playground needs a root folder before you can create labs or start playground chats. That keeps all playground work scoped under one known location.'
            : 'Playground supports chat-only sessions. Create or attach a lab later only when you need files or a repo.')
    const primaryLabel = isWorkProjectMode
        ? (hasSession ? 'Choose project' : 'Open folder to start')
        : (isPlaygroundRootMode ? 'Choose Playground root' : 'Start chatting')
    const showWorkModeSecondaryAction = isWorkProjectMode && (playgroundRootConfigured || Boolean(onChoosePlaygroundRoot))
    const workModeSecondaryLabel = playgroundRootConfigured ? 'Start new Playground chat' : 'Choose Playground root'

    return (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-sparkle-bg/58 px-6 py-6 backdrop-blur-[2px]">
            <div className={cn(
                'w-full max-w-md rounded-2xl border border-white/10 p-5 shadow-[0_24px_60px_rgba(0,0,0,0.34)]',
                isWorkProjectMode ? 'bg-sparkle-card' : 'bg-sparkle-card/92 backdrop-blur-xl'
            )}>
                <div className="mb-4 flex items-start gap-3">
                    <div className={cn(
                        'inline-flex size-10 shrink-0 items-center justify-center rounded-xl border',
                        isWorkProjectMode
                            ? 'border-sky-400/20 bg-sky-500/[0.10] text-sky-200'
                            : 'border-violet-400/20 bg-violet-500/[0.10] text-violet-200'
                    )}>
                        {isWorkProjectMode ? <FolderOpen size={18} /> : <GitBranch size={18} />}
                    </div>
                    <div className="min-w-0 flex-1">
                        <h3 className="text-sm font-semibold text-sparkle-text">{title}</h3>
                        <p className="mt-1 text-xs leading-5 text-sparkle-text-muted/75">{body}</p>
                    </div>
                </div>
                <div className="space-y-2">
                    <button
                        type="button"
                        onClick={() => {
                            if (isWorkProjectMode) {
                                void onChooseProject?.()
                                return
                            }
                            if (isPlaygroundRootMode) {
                                void onChoosePlaygroundRoot?.()
                                return
                            }
                            void onStartDetachedPlaygroundChat?.()
                        }}
                        disabled={busy}
                        className={cn(
                            'flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition-all',
                            busy
                                ? 'cursor-not-allowed bg-white/[0.06] text-sparkle-text-muted/60'
                                : isWorkProjectMode
                                    ? 'bg-sky-500/[0.16] text-sky-100 hover:bg-sky-500/[0.22]'
                                    : 'bg-violet-500/[0.16] text-violet-100 hover:bg-violet-500/[0.22]'
                        )}
                    >
                        {busy ? <Loader2 size={15} className="animate-spin" /> : (isWorkProjectMode ? <FolderOpen size={15} /> : <GitBranch size={15} />)}
                        <span>{primaryLabel}</span>
                    </button>
                    {showWorkModeSecondaryAction ? (
                        <button
                            type="button"
                            onClick={() => {
                                if (playgroundRootConfigured) {
                                    void onStartDetachedPlaygroundChat?.()
                                    return
                                }
                                void onChoosePlaygroundRoot?.()
                            }}
                            disabled={busy}
                            className="flex w-full items-center justify-center gap-2 rounded-xl border border-transparent bg-white/[0.04] px-4 py-3 text-sm font-medium text-sparkle-text-secondary transition-colors hover:bg-white/[0.06] hover:text-sparkle-text disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            <GitBranch size={15} />
                            <span>{workModeSecondaryLabel}</span>
                        </button>
                    ) : null}
                </div>
            </div>
        </div>
    )
})
