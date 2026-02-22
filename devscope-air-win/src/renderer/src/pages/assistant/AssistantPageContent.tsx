import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
    Download, Folder, FolderOpen, GitBranch, Loader2, MessageSquare,
    MessageSquarePlus, MoreHorizontal, PlugZap, Settings2, Shield,
    Terminal, Trash2, XCircle, Zap, ChevronDown
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { AssistantComposer } from './AssistantComposer'
import { AssistantEventConsole } from './AssistantEventConsole'
import { AssistantMessage } from './AssistantMessage'
import { AssistantSessionsSidebar } from './AssistantSessionsSidebar'
import { CollapsiblePlainMessage } from './CollapsiblePlainMessage'
import { AnimatedHeight } from '@/components/ui/AnimatedHeight'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import type { AssistantPageController } from './useAssistantPageController'
import type { AssistantHistoryMessage } from './assistant-page-types'

type Props = { controller: AssistantPageController }

function getUserMessageDisplayText(message: AssistantHistoryMessage): string {
    const sourcePrompt = String(message.sourcePrompt || '').trim()
    if (sourcePrompt) return sourcePrompt

    const rawText = String(message.text || '')
    if (!rawText) return ''

    const withoutLegacyAttachmentBlock = rawText
        .replace(/\n{1,2}Attached files \(\d+\):[\s\S]*$/i, '')
        .trim()
    if (withoutLegacyAttachmentBlock !== rawText.trim()) {
        return withoutLegacyAttachmentBlock || 'Attached files for this request.'
    }
    return rawText
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
        activeModel,
        modelOptions,
        modelsLoading,
        modelsError,
        activeProfile,
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
        handleSelectModel,
        handleRefreshModels,
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
        handleExportEvents
    } = controller

    const recentProjectPaths = useMemo(() => {
        const paths = new Set<string>()
        // Combine paths from active sessions and available roots
        activeSessions.forEach((s: any) => {
            if (s.projectPath) paths.add(s.projectPath)
        })
        availableProjectRoots.forEach((r) => paths.add(r))
        return Array.from(paths).sort((a, b) => a.localeCompare(b))
    }, [activeSessions, availableProjectRoots])

    const [showProjectDropdown, setShowProjectDropdown] = useState(false)
    const projectDropdownRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (projectDropdownRef.current && !projectDropdownRef.current.contains(event.target as Node)) {
                setShowProjectDropdown(false)
            }
        }
        if (showProjectDropdown) {
            document.addEventListener('mousedown', handleClickOutside)
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside)
        }
    }, [showProjectDropdown])

    const canUseEventConsole = settings.assistantAllowEventConsole
    const hasChatMessages = displayHistoryGroups.length > 0

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
                                createdAt: session.createdAt,
                                updatedAt: session.updatedAt,
                                projectPath: session.projectPath
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
                            <section className={cn('flex min-w-0 flex-1 flex-col transition-all duration-300', canUseEventConsole && showEventConsole && 'border-r border-sparkle-border')}>
                                {!isEmptyChatState && (
                                    <div className="flex items-center justify-between gap-3 border-b border-sparkle-border bg-sparkle-card px-4 py-2.5 animate-slideInFromTop">
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
                                            {!hasChatMessages && (
                                                <button
                                                    type="button"
                                                    onClick={() => void handleSelectChatProjectPath()}
                                                    className="p-1.5 rounded-lg border border-sparkle-border text-sparkle-text-secondary hover:bg-sparkle-card-hover transition-colors"
                                                    title="Choose chat path"
                                                >
                                                    <FolderOpen size={14} />
                                                </button>
                                            )}
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

                                            {canUseEventConsole && (
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
                                            )}

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
                                )}

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
                                    <div ref={chatScrollRef} onScroll={handleChatScroll} className="flex-1 overflow-y-auto bg-sparkle-bg px-4 py-3 scrollbar-hide">
                                        <div className={cn('flex min-h-full w-full flex-col gap-3', isEmptyChatState ? 'justify-center items-center pb-0' : 'justify-end pb-8')}>
                                            <div className={cn('w-full space-y-3', isEmptyChatState ? 'pb-0 max-w-2xl' : 'pb-4')}>
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
                                                                text={getUserMessageDisplayText(message)}
                                                                isUser={message.role === 'user'}
                                                                attachments={message.attachments}
                                                            />
                                                        </div>
                                                    )
                                                })}

                                                {isEmptyChatState && (
                                                    <div className="flex flex-col items-center animate-fadeIn">
                                                        <div className="mb-8 flex h-20 w-20 items-center justify-center rounded-3xl bg-sparkle-card border border-sparkle-border shadow-2xl relative">
                                                            <div className="absolute inset-0 bg-sparkle-primary/5 rounded-3xl blur-xl" />
                                                            <div className="relative flex flex-col items-center">
                                                                <div className="w-10 h-8 rounded-lg border-[3px] border-sparkle-text-muted/20 flex items-center justify-center">
                                                                    <div className="w-4 h-[2px] bg-sparkle-text-muted/30" />
                                                                </div>
                                                            </div>
                                                        </div>

                                                        <h1 className="text-5xl font-bold text-white tracking-tight mb-10">
                                                            <span className="text-[var(--accent-primary)]">devs</span> don't use <span className="text-[var(--accent-primary)]">light mode</span>
                                                        </h1>

                                                        <div className="relative mb-12 w-80 mx-auto" ref={projectDropdownRef}>
                                                            <button
                                                                onClick={() => setShowProjectDropdown((prev) => !prev)}
                                                                className={cn(
                                                                    "group flex w-full items-center gap-3 px-5 py-2.5 bg-sparkle-card border transition-all shadow-xl",
                                                                    showProjectDropdown
                                                                        ? "rounded-t-2xl border-sparkle-border border-b-transparent bg-sparkle-card-hover"
                                                                        : "rounded-2xl border-sparkle-border hover:bg-sparkle-card-hover hover:border-sparkle-border-hover"
                                                                )}
                                                            >
                                                                <Folder size={16} className={cn("transition-colors", showProjectDropdown ? "text-[var(--accent-primary)]" : "text-sparkle-text-secondary")} />
                                                                <span className="text-[14px] font-medium text-sparkle-text flex-1 text-left">
                                                                    {effectiveProjectPath ? effectiveProjectPath.split(/[\\/]/).pop() : 'Select Project'}
                                                                </span>
                                                                <ChevronDown size={14} className={cn("text-sparkle-text-muted transition-transform duration-500 [transition-timing-function:cubic-bezier(0.16,1,0.3,1)]", showProjectDropdown && "rotate-180")} />
                                                            </button>

                                                            <div className="absolute left-0 top-full z-30 w-full overflow-hidden">
                                                                <AnimatedHeight isOpen={showProjectDropdown} duration={500}>
                                                                    <div className="p-2 space-y-1 bg-sparkle-card border border-sparkle-border border-t-0 rounded-b-2xl shadow-2xl">
                                                                        <div className="px-3 py-1.5 text-[9px] font-bold uppercase tracking-widest text-sparkle-text-muted/40">
                                                                            Recent Projects
                                                                        </div>
                                                                        <div className="max-h-64 overflow-y-auto space-y-0.5 scrollbar-hide text-left px-1 pb-1">
                                                                            {recentProjectPaths.map((root) => {
                                                                                const isActive = root === effectiveProjectPath
                                                                                return (
                                                                                    <button
                                                                                        key={root}
                                                                                        onClick={() => {
                                                                                            void handleApplyChatProjectPath(root)
                                                                                            setShowProjectDropdown(false)
                                                                                        }}
                                                                                        className={cn(
                                                                                            'group relative flex w-full items-center gap-3 rounded-lg border px-3 py-2 transition-all duration-200 backdrop-blur-[2px]',
                                                                                            isActive
                                                                                                ? 'border-white/10 bg-[var(--accent-primary)]/10 text-[var(--accent-primary)] shadow-[0_2px_10px_rgba(0,0,0,0.05)]'
                                                                                                : 'border-white/5 bg-sparkle-bg/40 text-sparkle-text-secondary hover:border-sparkle-border hover:bg-sparkle-card-hover/60 hover:text-sparkle-text'
                                                                                        )}
                                                                                    >
                                                                                        <div className="min-w-0 flex-1 overflow-hidden">
                                                                                            <div className={cn(
                                                                                                "truncate text-[13px] leading-tight transition-colors",
                                                                                                isActive ? "font-bold" : "font-medium"
                                                                                            )}>
                                                                                                {root.split(/[\\/]/).pop() || root}
                                                                                            </div>
                                                                                            <div className="truncate text-[9px] opacity-30 font-medium" title={root}>{root}</div>
                                                                                        </div>
                                                                                    </button>
                                                                                )
                                                                            })}
                                                                        </div>

                                                                        <div className="mt-1 border-t border-sparkle-border/30 pt-1 px-1">
                                                                            <button
                                                                                onClick={() => {
                                                                                    void handleSelectChatProjectPath()
                                                                                    setShowProjectDropdown(false)
                                                                                }}
                                                                                className="flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2 text-[13px] font-semibold text-[var(--accent-primary)] hover:bg-[var(--accent-primary)]/10 transition-colors"
                                                                            >
                                                                                <FolderOpen size={13} />
                                                                                <span>Open other path...</span>
                                                                            </button>
                                                                        </div>
                                                                    </div>
                                                                </AnimatedHeight>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                )}

                                <div className={cn('bg-sparkle-bg px-4 pb-4 transition-all duration-500 ease-in-out', isEmptyChatState ? 'pt-0' : 'pt-3 border-t border-sparkle-border')}>
                                    <div className={cn('mx-auto w-full transition-all duration-500 ease-in-out', isEmptyChatState && 'max-w-3xl')}>
                                        <AssistantComposer
                                            onSend={handleSend}
                                            disabled={isBusy || isChatHydrating}
                                            isSending={isSending}
                                            isThinking={isSending || isBusy}
                                            isConnected={status.connected}
                                            activeModel={activeModel}
                                            modelOptions={modelOptions}
                                            modelsLoading={modelsLoading}
                                            modelsError={modelsError}
                                            onSelectModel={handleSelectModel}
                                            onRefreshModels={handleRefreshModels}
                                            activeProfile={activeProfile}
                                        />
                                    </div>

                                    {isEmptyChatState && (
                                        <div className="mt-6 flex items-center justify-between px-2 text-[11px] font-medium text-sparkle-text-muted/60">
                                            <div className="flex items-center gap-4">
                                                <span className="text-white font-bold opacity-100 cursor-default">Local</span>
                                            </div>
                                            <div className="flex items-center gap-1.5 opacity-40">
                                                <GitBranch size={11} />
                                                <span>local-dev</span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </section>
                            {canUseEventConsole && (
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
                            )}
                        </div>
                    </div>
                </div>
            )}
            <ConfirmModal
                isOpen={showYoloConfirmModal}
                title="Enable YOLO mode?"
                message="YOLO mode allows the AI to execute commands and modify files without asking for permission in this session."
                confirmLabel="Enable YOLO"
                onConfirm={() => void handleEnableYoloMode()}
                onCancel={() => setShowYoloConfirmModal(false)}
                variant="warning"
            />
        </div>
    )
}
