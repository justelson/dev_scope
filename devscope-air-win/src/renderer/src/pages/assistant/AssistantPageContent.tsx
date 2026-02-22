import { Link } from 'react-router-dom'
import {
    Download,
    FolderOpen,
    Loader2,
    MessageSquare,
    MessageSquarePlus,
    MoreHorizontal,
    PlugZap,
    Settings2,
    Shield,
    Terminal,
    Trash2,
    XCircle,
    Zap
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { AssistantComposer } from './AssistantComposer'
import { AssistantEventConsole } from './AssistantEventConsole'
import { AssistantMessage } from './AssistantMessage'
import { AssistantSessionsSidebar } from './AssistantSessionsSidebar'
import { CollapsiblePlainMessage } from './CollapsiblePlainMessage'
import type { AssistantPageController } from './useAssistantPageController'
type Props = {
    controller: AssistantPageController
}

export function AssistantPageContent({ controller }: Props) {
    const {
        settings,
        status,
        errorMessage,
        connectionState,
        isConnecting,
        isBusy,
        isSending,
        showEventConsole,
        showHeaderMenu,
        showYoloConfirmModal,
        chatProjectPath,
        availableProjectRoots,
        effectiveProjectPath,
        activeSessions,
        activeSessionId,
        activeSessionTitle,
        displayHistoryGroups,
        streamingTurnId,
        streamingText,
        allReasoning,
        allActivities,
        allApprovals,
        isEmptyChatState,
        isChatHydrating,
        eventLog,
        headerMenuRef,
        chatScrollRef,
        setShowHeaderMenu,
        setShowYoloConfirmModal,
        setChatProjectPath,
        handleEnableSafeMode,
        handleChatScroll,
        handleConnect,
        handleDisconnect,
        handleSend,
        handleRegenerate,
        handleCancelTurn,
        handleEnableYoloMode,
        handleSelectChatProjectPath,
        handleSessionsSidebarCollapsed,
        handleToggleEventConsole,
        handleExportConversation,
        handleClearHistory,
        handleApplyChatProjectPath,
        handleCreateSession,
        handleSelectSession,
        handleRenameSession,
        handleArchiveSession,
        handleDeleteSession,
        handleClearEvents,
        handleExportEvents,
        loadSnapshot
    } = controller

    return (
        <div className="h-full flex flex-col animate-fadeIn">
            {settings.assistantEnabled && (errorMessage || connectionState === 'error' || connectionState === 'disconnected') && (
                <div className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
                    <div className="flex items-center gap-2">
                        <XCircle size={16} className="shrink-0 text-amber-400" />
                        <div>
                            <span className="font-semibold text-amber-400 mr-2">Connection Issue:</span>
                            <span className="opacity-90">{errorMessage || 'The assistant background process disconnected.'}</span>
                        </div>
                    </div>
                    <button
                        onClick={() => void handleConnect()}
                        disabled={isConnecting}
                        className={cn(
                            'px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors border',
                            isConnecting
                                ? 'bg-amber-500/10 border-amber-500/20 text-amber-500/50 cursor-not-allowed'
                                : 'bg-amber-500/20 border-amber-500/40 text-amber-100 hover:bg-amber-500/30 hover:border-amber-500/60 shadow-sm'
                        )}
                    >
                        {isConnecting ? 'Reconnecting...' : 'Reconnect Now'}
                    </button>
                </div>
            )}

            {!settings.assistantEnabled ? (
                <div className="flex-1 rounded-2xl border border-dashed border-sparkle-border bg-sparkle-card/60 flex items-center justify-center p-8">
                    <div className="max-w-xl text-center">
                        <div className="mx-auto w-12 h-12 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center mb-4">
                            <PlugZap className="text-indigo-300" size={24} />
                        </div>
                        <h2 className="text-xl font-semibold text-sparkle-text mb-2">Assistant is turned off</h2>
                        <p className="text-sm text-sparkle-text-secondary mb-5">
                            Enable Assistant in settings, choose your defaults, then come back here to connect and start a session.
                        </p>
                        <Link
                            to="/settings/assistant"
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--accent-primary)] text-white hover:bg-[var(--accent-primary)]/85 transition-colors"
                        >
                            <Settings2 size={16} />
                            Open Assistant Settings
                        </Link>
                    </div>
                </div>
            ) : (
                <div className="flex-1 min-h-0 overflow-hidden">
                    <div className="h-full flex">
                        <AssistantSessionsSidebar
                            collapsed={settings.assistantSidebarCollapsed}
                            width={Number(settings.assistantSidebarWidth) || 320}
                            sessions={activeSessions.map((session) => ({
                                id: session.id,
                                title: session.title,
                                updatedAt: session.updatedAt
                            }))}
                            activeSessionId={activeSessionId}
                            onSetCollapsed={handleSessionsSidebarCollapsed}
                            onCreateSession={handleCreateSession}
                            onSelectSession={handleSelectSession}
                            onRenameSession={handleRenameSession}
                            onArchiveSession={handleArchiveSession}
                            onDeleteSession={handleDeleteSession}
                        />

                        <div className="flex-1 flex min-w-0">
                            <section className={cn('flex min-w-0 flex-1 flex-col transition-all duration-300', showEventConsole && 'border-r border-sparkle-border')}>
                                <div className="flex items-center justify-between gap-3 border-b border-sparkle-border bg-sparkle-card px-4 py-2.5">
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-2">
                                            <MessageSquare size={15} className="text-sparkle-text-secondary" />
                                            <h2 className="text-sm font-semibold text-sparkle-text">Conversation</h2>
                                        </div>
                                        <div className="mt-1 flex flex-wrap items-center gap-1.5">
                                            <span className="rounded-full border border-sparkle-border bg-sparkle-bg px-2 py-0.5 text-[10px] text-sparkle-text-secondary">
                                                Thread <strong className="inline-block max-w-[24ch] truncate align-bottom">{activeSessionTitle}</strong>
                                            </span>
                                            <span className="rounded-full border border-sparkle-border bg-sparkle-bg px-2 py-0.5 text-[10px] text-sparkle-text-secondary">
                                                Turn <strong>{isBusy ? 'running' : 'idle'}</strong>
                                            </span>
                                            <span
                                                className="max-w-[56ch] rounded-full border border-sparkle-border bg-sparkle-bg px-2 py-0.5 text-[10px] text-sparkle-text-secondary"
                                                title={effectiveProjectPath || 'No chat path selected'}
                                            >
                                                Path <strong className="inline-block max-w-[42ch] truncate align-bottom">{effectiveProjectPath || 'not set'}</strong>
                                            </span>
                                        </div>
                                    </div>
                                    <div className="relative flex items-center gap-2" ref={headerMenuRef}>
                                        <button
                                            type="button"
                                            onClick={() => void handleSelectChatProjectPath()}
                                            className="p-1.5 rounded-lg border border-sparkle-border text-sparkle-text-secondary hover:bg-sparkle-card-hover transition-colors"
                                            title="Choose chat path"
                                        >
                                            <FolderOpen size={14} />
                                        </button>

                                        <div className="inline-flex rounded-md border border-sparkle-border bg-sparkle-bg p-0.5">
                                            <button
                                                onClick={() => {
                                                    if (status.approvalMode === 'safe') return
                                                    void handleEnableSafeMode()
                                                }}
                                                className={cn(
                                                    'p-1.5 rounded transition-colors',
                                                    status.approvalMode === 'safe'
                                                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/35'
                                                        : 'text-sparkle-text-secondary hover:text-sparkle-text hover:bg-sparkle-card-hover'
                                                )}
                                                title="Safe approval mode"
                                            >
                                                <Shield size={13} />
                                            </button>
                                            <button
                                                onClick={() => {
                                                    if (status.approvalMode === 'yolo') return
                                                    setShowYoloConfirmModal(true)
                                                }}
                                                className={cn(
                                                    'p-1.5 rounded transition-colors',
                                                    status.approvalMode === 'yolo'
                                                        ? 'bg-amber-500/20 text-amber-400 border border-amber-500/35'
                                                        : 'text-sparkle-text-secondary hover:text-sparkle-text hover:bg-sparkle-card-hover'
                                                )}
                                                title="YOLO approval mode"
                                            >
                                                <Zap size={13} />
                                            </button>
                                        </div>

                                        {connectionState === 'connected' && (
                                            <button
                                                type="button"
                                                onClick={async () => {
                                                    await window.devscope.assistant.newThread()
                                                    await loadSnapshot()
                                                }}
                                                className="p-1.5 rounded-lg border border-sparkle-border text-sparkle-text-secondary hover:bg-sparkle-card-hover transition-colors"
                                                title="New thread"
                                            >
                                                <MessageSquarePlus size={14} />
                                            </button>
                                        )}

                                        <button
                                            type="button"
                                            onClick={handleToggleEventConsole}
                                            className={cn(
                                                'p-1.5 rounded-lg border transition-colors',
                                                showEventConsole
                                                    ? 'border-cyan-400/50 bg-cyan-500/15 text-cyan-300 shadow-[0_0_0_1px_rgba(34,211,238,0.22)]'
                                                    : 'border-sparkle-border hover:bg-sparkle-card-hover text-sparkle-text-secondary'
                                            )}
                                            title="Toggle Event Console"
                                        >
                                            <Terminal size={14} />
                                        </button>

                                        {isBusy && (
                                            <button
                                                type="button"
                                                onClick={handleCancelTurn}
                                                className="p-1.5 rounded-lg border border-amber-500/40 text-amber-300 bg-amber-500/10 hover:bg-amber-500/15 transition-colors"
                                                title="Cancel active turn"
                                            >
                                                <XCircle size={14} />
                                            </button>
                                        )}

                                        <button
                                            type="button"
                                            onClick={() => {
                                                if (connectionState === 'connected') {
                                                    void handleDisconnect()
                                                } else {
                                                    void handleConnect()
                                                }
                                            }}
                                            disabled={isConnecting}
                                            className={cn(
                                                'p-1.5 rounded-lg border transition-colors disabled:opacity-60',
                                                connectionState === 'connected'
                                                    ? 'border-emerald-500/40 text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/15'
                                                    : 'border-sparkle-border text-sparkle-text-secondary hover:bg-sparkle-card-hover'
                                            )}
                                            title={connectionState === 'connected' ? 'Disconnect assistant' : 'Connect assistant'}
                                        >
                                            <PlugZap size={14} />
                                        </button>

                                        <button
                                            type="button"
                                            onClick={() => setShowHeaderMenu((prev) => !prev)}
                                            className="p-1.5 rounded-lg border border-sparkle-border text-sparkle-text-secondary hover:bg-sparkle-card-hover transition-colors"
                                            title="More actions"
                                        >
                                            <MoreHorizontal size={14} />
                                        </button>

                                        {showHeaderMenu && (
                                            <div className="absolute right-0 top-full z-20 mt-2 w-52 rounded-lg border border-sparkle-border bg-sparkle-card p-1 shadow-lg">
                                                {connectionState === 'connected' && (
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            handleExportConversation('markdown')
                                                            setShowHeaderMenu(false)
                                                        }}
                                                        className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-xs text-sparkle-text-secondary hover:bg-sparkle-card-hover hover:text-sparkle-text transition-colors"
                                                    >
                                                        <Download size={13} />
                                                        Export Markdown
                                                    </button>
                                                )}
                                                {connectionState === 'connected' && (
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            handleExportConversation('json')
                                                            setShowHeaderMenu(false)
                                                        }}
                                                        className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-xs text-sparkle-text-secondary hover:bg-sparkle-card-hover hover:text-sparkle-text transition-colors"
                                                    >
                                                        <Download size={13} />
                                                        Export JSON
                                                    </button>
                                                )}
                                                <button
                                                    type="button"
                                                    onClick={async () => {
                                                        await handleClearHistory()
                                                        setShowHeaderMenu(false)
                                                    }}
                                                    className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-xs text-amber-300 hover:bg-amber-500/10 transition-colors"
                                                >
                                                    <Trash2 size={13} />
                                                    Clear Chat
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {isChatHydrating ? (
                                    <div className="flex-1 bg-sparkle-bg px-4 py-3">
                                        <div className="flex h-full w-full items-center justify-center">
                                            <div className="w-full max-w-[560px] rounded-2xl border border-sparkle-border bg-sparkle-card/80 px-6 py-8 text-center">
                                                <div className="mx-auto mb-3 inline-flex h-11 w-11 items-center justify-center rounded-xl border border-sparkle-border bg-sparkle-bg text-[var(--accent-primary)]">
                                                    <Loader2 size={20} className="animate-spin" />
                                                </div>
                                                <h3 className="text-base font-semibold text-sparkle-text">Loading chat</h3>
                                                <p className="mt-2 text-sm text-sparkle-text-secondary">
                                                    Restoring this session from memory...
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div ref={chatScrollRef} onScroll={handleChatScroll} className="flex-1 overflow-y-auto bg-sparkle-bg px-4 py-3">
                                        <div className={cn('flex min-h-full w-full flex-col gap-3', isEmptyChatState ? 'justify-center pb-0' : 'justify-end pb-8')}>
                                            <div className={cn('space-y-3', isEmptyChatState ? 'pb-0' : 'pb-4')}>
                                                {displayHistoryGroups.map((group) => {
                                                    if (group.role === 'assistant') {
                                                        return (
                                                            <div key={group.id} className="w-full">
                                                                <AssistantMessage
                                                                    attempts={group.messages}
                                                                    onRegenerate={handleRegenerate}
                                                                    isBusy={isBusy || isSending}
                                                                    streamingTurnId={streamingTurnId}
                                                                    streamingText={streamingText}
                                                                    reasoning={allReasoning}
                                                                    activities={allActivities}
                                                                    approvals={allApprovals}
                                                                />
                                                            </div>
                                                        )
                                                    }

                                                    const message = group.messages[0]
                                                    return (
                                                        <div key={message.id} className={cn('flex animate-fadeIn', message.role === 'user' ? 'justify-end' : 'justify-start')}>
                                                            <CollapsiblePlainMessage
                                                                text={message.text}
                                                                isUser={message.role === 'user'}
                                                            />
                                                        </div>
                                                    )
                                                })}

                                                {isEmptyChatState && (
                                                    <div className="mx-auto w-full max-w-[560px] rounded-2xl border border-sparkle-border bg-sparkle-card/80 px-6 py-6 text-center">
                                                        <div className="mx-auto mb-3 inline-flex h-11 w-11 items-center justify-center rounded-xl border border-sparkle-border bg-sparkle-bg text-[var(--accent-primary)]">
                                                            <MessageSquarePlus size={20} />
                                                        </div>
                                                        <h3 className="text-base font-semibold text-sparkle-text">Start a new chat</h3>
                                                        <p className="mt-2 text-sm text-sparkle-text-secondary">
                                                            Ask for code changes, reviews, or repository analysis. Thoughts and actions will appear automatically per reply.
                                                        </p>
                                                        <div className="mt-4 rounded-xl border border-sparkle-border bg-sparkle-bg/80 p-3 text-left">
                                                            <div className="mb-2 flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-sparkle-text-secondary">
                                                                <FolderOpen size={12} />
                                                                <span>Chat Path</span>
                                                            </div>
                                                            <div className="flex items-center gap-2">
                                                                <input
                                                                    type="text"
                                                                    value={chatProjectPath}
                                                                    onChange={(event) => setChatProjectPath(event.target.value)}
                                                                    onBlur={() => { void handleApplyChatProjectPath(chatProjectPath) }}
                                                                    placeholder={settings.projectsFolder || 'Select a folder path for this chat'}
                                                                    className="h-9 flex-1 rounded-lg border border-sparkle-border bg-sparkle-card px-3 text-xs text-sparkle-text placeholder:text-sparkle-text-muted/70 focus:border-[var(--accent-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]/20"
                                                                />
                                                                <button
                                                                    type="button"
                                                                    onClick={() => void handleSelectChatProjectPath()}
                                                                    className="h-9 rounded-lg border border-sparkle-border bg-sparkle-card px-3 text-xs font-medium text-sparkle-text-secondary transition-colors hover:bg-sparkle-card-hover hover:text-sparkle-text"
                                                                >
                                                                    Browse
                                                                </button>
                                                            </div>
                                                            {availableProjectRoots.length > 0 && (
                                                                <div className="mt-2 flex flex-wrap gap-1.5">
                                                                    {availableProjectRoots.map((rootPath) => (
                                                                        <button
                                                                            key={rootPath}
                                                                            type="button"
                                                                            onClick={() => { void handleApplyChatProjectPath(rootPath) }}
                                                                            className={cn(
                                                                                'max-w-full truncate rounded-md border px-2.5 py-1 text-[11px] transition-colors',
                                                                                rootPath === effectiveProjectPath
                                                                                    ? 'border-[var(--accent-primary)]/50 bg-[var(--accent-primary)]/15 text-sparkle-text'
                                                                                    : 'border-sparkle-border bg-sparkle-card text-sparkle-text-secondary hover:bg-sparkle-card-hover hover:text-sparkle-text'
                                                                            )}
                                                                            title={rootPath}
                                                                        >
                                                                            {rootPath}
                                                                        </button>
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                )}

                                <div className="border-t border-sparkle-border bg-sparkle-card px-4 py-3">
                                    <AssistantComposer
                                        onSend={handleSend}
                                        disabled={isBusy || isChatHydrating}
                                        isSending={isSending}
                                        isThinking={isSending || isBusy}
                                        isConnected={status.connected}
                                    />
                                </div>
                            </section>
                            <aside
                                aria-hidden={!showEventConsole}
                                className={cn(
                                    'shrink-0 overflow-hidden bg-sparkle-bg transition-all duration-300 ease-out',
                                    showEventConsole
                                        ? 'w-[430px] opacity-100 translate-x-0 border-l border-sparkle-border'
                                        : 'w-0 opacity-0 translate-x-4 pointer-events-none border-l border-transparent'
                                )}
                            >
                                <div className="h-full w-[430px]">
                                    <AssistantEventConsole
                                        events={eventLog}
                                        onClear={handleClearEvents}
                                        onExport={() => void handleExportEvents()}
                                    />
                                </div>
                            </aside>
                        </div>
                    </div>
                </div>
            )}
            {showYoloConfirmModal && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md animate-fadeIn"
                    onClick={() => setShowYoloConfirmModal(false)}
                >
                    <div
                        className="w-full max-w-md rounded-2xl border border-amber-500/30 bg-sparkle-card p-6 shadow-2xl"
                        onClick={(event) => event.stopPropagation()}
                    >
                        <h3 className="text-base font-semibold text-sparkle-text">Enable YOLO mode?</h3>
                        <p className="mt-2 text-sm text-sparkle-text-secondary">
                            YOLO mode allows the AI to execute commands and modify files without asking for permission in this session.
                        </p>
                        <div className="mt-5 flex items-center justify-end gap-2">
                            <button
                                type="button"
                                onClick={() => setShowYoloConfirmModal(false)}
                                className="rounded-lg border border-sparkle-border px-3 py-1.5 text-sm text-sparkle-text-secondary transition-colors hover:bg-sparkle-card-hover hover:text-sparkle-text"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={() => void handleEnableYoloMode()}
                                className="rounded-lg border border-amber-500/40 bg-amber-500/15 px-3 py-1.5 text-sm text-amber-200 transition-colors hover:bg-amber-500/25"
                            >
                                Enable YOLO
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
