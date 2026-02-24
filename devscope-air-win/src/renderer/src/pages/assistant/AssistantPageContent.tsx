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
import type { ComposerContextFile } from './assistant-composer-types'
import { toDisplayText } from './assistant-text-utils'

type Props = {
    controller: AssistantPageController
    layoutMode?: 'page' | 'dock'
}

function getUserMessageDisplayText(message: AssistantHistoryMessage): string {
    const sourcePrompt = toDisplayText(message.sourcePrompt).trim()
    if (sourcePrompt) return sourcePrompt

    const rawText = toDisplayText(message.text)
    if (!rawText) return ''

    const withoutLegacyAttachmentBlock = rawText
        .replace(/\n{1,2}Attached files \(\d+\):[\s\S]*$/i, '')
        .trim()
    if (withoutLegacyAttachmentBlock !== rawText.trim()) {
        return withoutLegacyAttachmentBlock || 'Attached files for this request.'
    }
    return rawText
}

export function AssistantPageContent({ controller, layoutMode = 'page' }: Props) {
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
        handleSend: baseHandleSend,
        handleRegenerate,
        handleCancelTurn,
        handleEnableYoloMode,
        handleSelectChatProjectPath,
        handleSessionsSidebarCollapsed,
        handleAssistantSidebarWidthChange,
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
    const recentProjectPathPreview = useMemo(
        () => recentProjectPaths.slice(0, 3),
        [recentProjectPaths]
    )
    const hasMoreRecentProjectPaths = recentProjectPaths.length > recentProjectPathPreview.length
    const sessionSidebarItems = useMemo(() => activeSessions.map((session) => ({
        id: session.id,
        title: session.title,
        createdAt: session.createdAt,
        updatedAt: session.updatedAt,
        projectPath: session.projectPath
    })), [activeSessions])

    const [showProjectDropdown, setShowProjectDropdown] = useState(false)
    const [showProjectSelectorModal, setShowProjectSelectorModal] = useState(false)
    const projectDropdownRef = useRef<HTMLDivElement>(null)
    const [isSidebarHeaderMinimized, setIsSidebarHeaderMinimized] = useState(layoutMode === 'dock')
    const pendingSendResolverRef = useRef<((result: boolean) => void) | null>(null)
    const latestBaseSendRef = useRef(baseHandleSend)
    const [crossDirSendState, setCrossDirSendState] = useState<{
        prompt: string
        contextFiles: ComposerContextFile[]
        sessionPath: string
        uiPath: string
    } | null>(null)

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

    const isDockMode = layoutMode === 'dock'
    const showCompactSidebarHeader = isDockMode && isSidebarHeaderMinimized
    const canUseEventConsole = settings.assistantAllowEventConsole
    const hasChatMessages = displayHistoryGroups.length > 0
    const sessionSidebarWidth = Number(settings.assistantSidebarWidth) || 320
    const compactSidebarWidth = Math.max(180, Math.min(340, sessionSidebarWidth - 24))
    const eventConsoleWidth = isDockMode ? 340 : 430
    const isDockSessionsExpanded = isDockMode && !settings.assistantSidebarCollapsed
    const isDockEventConsoleExpanded = isDockMode && canUseEventConsole && showEventConsole
    const showDockOverlayBackdrop = isDockSessionsExpanded || isDockEventConsoleExpanded

    const normalizeComparablePath = (value: string): string => (
        String(value || '')
            .trim()
            .replace(/\//g, '\\')
            .replace(/[\\]+$/, '')
            .toLowerCase()
    )

    const resolvePathLabel = (path: string): string => {
        const normalized = String(path || '').trim()
        if (!normalized) return 'not set'
        const parts = normalized.split(/[\\/]/).filter(Boolean)
        return parts[parts.length - 1] || normalized
    }

    const clearCrossDirSendState = (result: boolean) => {
        const resolver = pendingSendResolverRef.current
        pendingSendResolverRef.current = null
        setCrossDirSendState(null)
        if (resolver) resolver(result)
    }

    useEffect(() => {
        latestBaseSendRef.current = baseHandleSend
    }, [baseHandleSend])

    useEffect(() => {
        if (isDockMode) {
            setIsSidebarHeaderMinimized(true)
            return
        }
        setIsSidebarHeaderMinimized(false)
    }, [isDockMode])

    const sendWithLatestControllerState = async (prompt: string, contextFiles: ComposerContextFile[]) => {
        await new Promise<void>((resolve) => {
            window.requestAnimationFrame(() => resolve())
        })
        return await latestBaseSendRef.current(prompt, contextFiles)
    }

    const handleSend = async (prompt: string, contextFiles: ComposerContextFile[]): Promise<boolean> => {
        const activeSession = activeSessions.find((session) => session.id === activeSessionId) || null
        const sessionPath = String(activeSession?.projectPath || '').trim()
        const uiPath = String(effectiveProjectPath || '').trim()
        const hasCrossDirMismatch = Boolean(activeSessionId && sessionPath && uiPath)
            && normalizeComparablePath(sessionPath) !== normalizeComparablePath(uiPath)

        if (hasCrossDirMismatch) {
            if (pendingSendResolverRef.current) {
                pendingSendResolverRef.current(false)
                pendingSendResolverRef.current = null
            }
            return await new Promise<boolean>((resolve) => {
                pendingSendResolverRef.current = resolve
                setCrossDirSendState({
                    prompt,
                    contextFiles,
                    sessionPath,
                    uiPath
                })
            })
        }

        return await baseHandleSend(prompt, contextFiles)
    }

    const runCrossDirSendAction = async (
        action: 'new-session-ui-dir' | 'send-session-dir' | 'switch-session-ui-dir'
    ) => {
        const pending = crossDirSendState
        if (!pending) {
            clearCrossDirSendState(false)
            return
        }

        try {
            if (action === 'new-session-ui-dir') {
                await handleCreateSession(pending.uiPath)
            } else if (action === 'send-session-dir') {
                await handleApplyChatProjectPath(pending.sessionPath)
            } else {
                await handleApplyChatProjectPath(pending.uiPath)
            }

            const sent = await sendWithLatestControllerState(pending.prompt, pending.contextFiles)
            clearCrossDirSendState(sent)
        } catch {
            clearCrossDirSendState(false)
        }
    }

    useEffect(() => {
        return () => {
            if (pendingSendResolverRef.current) {
                pendingSendResolverRef.current(false)
                pendingSendResolverRef.current = null
            }
        }
    }, [])

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
                    <div className={cn('h-full flex', isDockMode && 'relative')}>
                        {!isDockMode && (
                            <AssistantSessionsSidebar
                                collapsed={settings.assistantSidebarCollapsed}
                                width={sessionSidebarWidth}
                                compact={false}
                                sessions={sessionSidebarItems}
                                activeSessionId={activeSessionId}
                                onSetCollapsed={handleSessionsSidebarCollapsed}
                                onWidthChange={handleAssistantSidebarWidthChange}
                                onCreateSession={handleCreateSession}
                                onSelectSession={handleSelectSession}
                                onRenameSession={handleRenameSession}
                                onArchiveSession={handleArchiveSession}
                                onDeleteSession={handleDeleteSession}
                            />
                        )}

                        {isDockMode && (
                            <>
                                <button
                                    type="button"
                                    aria-label="Dismiss assistant overlays"
                                    onClick={() => {
                                        if (isDockSessionsExpanded) {
                                            handleSessionsSidebarCollapsed(true)
                                        }
                                        if (isDockEventConsoleExpanded) {
                                            handleToggleEventConsole()
                                        }
                                    }}
                                    className={cn(
                                        'absolute inset-0 z-20 bg-black/40 backdrop-blur-[1px] transition-opacity duration-300',
                                        showDockOverlayBackdrop
                                            ? 'opacity-100 pointer-events-auto'
                                            : 'opacity-0 pointer-events-none'
                                    )}
                                />
                                <div className={cn(
                                    'relative z-10 shrink-0 overflow-hidden transition-[width,opacity,transform] duration-300 ease-out',
                                    settings.assistantSidebarCollapsed
                                        ? 'w-14 opacity-100 translate-x-0'
                                        : 'w-0 opacity-0 -translate-x-2 pointer-events-none'
                                )}>
                                    <AssistantSessionsSidebar
                                        collapsed
                                        width={compactSidebarWidth}
                                        compact
                                        sessions={sessionSidebarItems}
                                        activeSessionId={activeSessionId}
                                        onSetCollapsed={handleSessionsSidebarCollapsed}
                                        onWidthChange={handleAssistantSidebarWidthChange}
                                        onCreateSession={handleCreateSession}
                                        onSelectSession={handleSelectSession}
                                        onRenameSession={handleRenameSession}
                                        onArchiveSession={handleArchiveSession}
                                        onDeleteSession={handleDeleteSession}
                                    />
                                </div>
                                <div className={cn(
                                    'absolute inset-y-0 left-0 z-30 transition-[opacity,transform] duration-300 ease-out',
                                    settings.assistantSidebarCollapsed
                                        ? 'pointer-events-none -translate-x-4 opacity-0'
                                        : 'pointer-events-auto translate-x-0 opacity-100'
                                )}>
                                    <AssistantSessionsSidebar
                                        collapsed={false}
                                        width={compactSidebarWidth}
                                        compact
                                        sessions={sessionSidebarItems}
                                        activeSessionId={activeSessionId}
                                        onSetCollapsed={handleSessionsSidebarCollapsed}
                                        onWidthChange={handleAssistantSidebarWidthChange}
                                        onCreateSession={handleCreateSession}
                                        onSelectSession={handleSelectSession}
                                        onRenameSession={handleRenameSession}
                                        onArchiveSession={handleArchiveSession}
                                        onDeleteSession={handleDeleteSession}
                                    />
                                </div>
                            </>
                        )}

                        <div className={cn('flex-1 flex min-w-0', isDockMode && 'relative')}>
                            <section className={cn(
                                'flex min-w-0 flex-1 flex-col transition-all duration-300',
                                !isDockMode && canUseEventConsole && showEventConsole && 'border-r border-sparkle-border'
                            )}>
                                {!isEmptyChatState && (
                                    <div className={cn(
                                        'flex items-center justify-between border-b border-sparkle-border bg-sparkle-card animate-slideInFromTop',
                                        isDockMode
                                            ? (showCompactSidebarHeader ? 'gap-1.5 px-2.5 py-1.5' : 'gap-2 px-3 py-2')
                                            : 'gap-3 px-4 py-2.5'
                                    )}>
                                        <div className="min-w-0 flex-1">
                                            <div className={cn('flex items-center', isDockMode ? 'gap-1.5' : 'gap-2')}>
                                                <MessageSquare size={isDockMode ? 14 : 15} className="text-sparkle-text-secondary" />
                                                <h2 className={cn('font-semibold text-sparkle-text', isDockMode ? 'text-xs' : 'text-sm')}>Conversation</h2>
                                                {showCompactSidebarHeader && (
                                                    <>
                                                        <span className="rounded-full border border-sparkle-border bg-sparkle-bg px-1.5 py-0.5 text-[9px] text-sparkle-text-secondary">
                                                            Thread <strong className="inline-block max-w-[16ch] truncate align-bottom">{activeSessionTitle}</strong>
                                                        </span>
                                                        {isBusy && (
                                                            <span className="inline-flex h-2 w-2 rounded-full bg-amber-300 animate-pulse" />
                                                        )}
                                                    </>
                                                )}
                                            </div>
                                            {!showCompactSidebarHeader && (
                                                <div className={cn('mt-1 flex flex-wrap items-center', isDockMode ? 'gap-1' : 'gap-1.5')}>
                                                    <span className={cn(
                                                        'rounded-full border border-sparkle-border bg-sparkle-bg text-sparkle-text-secondary',
                                                        isDockMode ? 'px-1.5 py-0.5 text-[9px]' : 'px-2 py-0.5 text-[10px]'
                                                    )}>
                                                        Thread <strong className="inline-block max-w-[24ch] truncate align-bottom">{activeSessionTitle}</strong>
                                                    </span>
                                                    {!isDockMode && (
                                                        <span className="rounded-full border border-sparkle-border bg-sparkle-bg px-2 py-0.5 text-[10px] text-sparkle-text-secondary">
                                                            Turn <strong>{isBusy ? 'running' : 'idle'}</strong>
                                                        </span>
                                                    )}
                                                    <span
                                                        className={cn(
                                                            'rounded-full border border-sparkle-border bg-sparkle-bg text-sparkle-text-secondary',
                                                            isDockMode ? 'max-w-[34ch] px-1.5 py-0.5 text-[9px]' : 'max-w-[56ch] px-2 py-0.5 text-[10px]'
                                                        )}
                                                        title={effectiveProjectPath || 'No chat path selected'}
                                                    >
                                                        Path <strong className={cn('inline-block truncate align-bottom', isDockMode ? 'max-w-[24ch]' : 'max-w-[42ch]')}>{effectiveProjectPath || 'not set'}</strong>
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                        <div className={cn('relative flex shrink-0 items-center', isDockMode ? 'gap-1' : 'gap-2')} ref={headerMenuRef}>
                                            {isDockMode && (
                                                <button
                                                    type="button"
                                                    onClick={() => setIsSidebarHeaderMinimized((prev) => !prev)}
                                                    className={cn(
                                                        'rounded-lg border border-sparkle-border text-sparkle-text-secondary transition-colors hover:bg-sparkle-card-hover hover:text-sparkle-text',
                                                        showCompactSidebarHeader ? 'h-6 w-6 p-0 inline-flex items-center justify-center' : 'p-1'
                                                    )}
                                                    title={isSidebarHeaderMinimized ? 'Expand conversation header' : 'Minimize conversation header'}
                                                >
                                                    <ChevronDown
                                                        size={12}
                                                        className={cn('transition-transform', !isSidebarHeaderMinimized && 'rotate-180')}
                                                    />
                                                </button>
                                            )}
                                            {!showCompactSidebarHeader && !hasChatMessages && (
                                                <button
                                                    type="button"
                                                    onClick={() => void handleSelectChatProjectPath()}
                                                    className={cn(
                                                        'rounded-lg border border-sparkle-border text-sparkle-text-secondary hover:bg-sparkle-card-hover transition-colors',
                                                        isDockMode ? 'p-1' : 'p-1.5'
                                                    )}
                                                    title="Choose chat path"
                                                >
                                                    <FolderOpen size={isDockMode ? 13 : 14} />
                                                </button>
                                            )}
                                            {!showCompactSidebarHeader && (
                                                <div className={cn('inline-flex rounded-md border border-sparkle-border bg-sparkle-bg', isDockMode ? 'p-[3px]' : 'p-0.5')}>
                                                    <button
                                                        onClick={() => {
                                                            if (status.approvalMode === 'safe') return
                                                            void handleEnableSafeMode()
                                                        }}
                                                        className={cn(
                                                            'rounded transition-colors',
                                                            isDockMode ? 'p-1' : 'p-1.5',
                                                            status.approvalMode === 'safe'
                                                                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/35'
                                                                : 'text-sparkle-text-secondary hover:text-sparkle-text hover:bg-sparkle-card-hover'
                                                        )}
                                                        title="Safe approval mode"
                                                    >
                                                        <Shield size={isDockMode ? 12 : 13} />
                                                    </button>
                                                    <button
                                                        onClick={() => {
                                                            if (status.approvalMode === 'yolo') return
                                                            setShowYoloConfirmModal(true)
                                                        }}
                                                        className={cn(
                                                            'rounded transition-colors',
                                                            isDockMode ? 'p-1' : 'p-1.5',
                                                            status.approvalMode === 'yolo'
                                                                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/35'
                                                                : 'text-sparkle-text-secondary hover:text-sparkle-text hover:bg-sparkle-card-hover'
                                                        )}
                                                        title="YOLO approval mode"
                                                    >
                                                        <Zap size={isDockMode ? 12 : 13} />
                                                    </button>
                                                </div>
                                            )}

                                            {canUseEventConsole && !showCompactSidebarHeader && (
                                                <button
                                                    type="button"
                                                    onClick={handleToggleEventConsole}
                                                    className={cn(
                                                        'rounded-lg border transition-colors',
                                                        isDockMode ? 'p-1' : 'p-1.5',
                                                        showEventConsole
                                                            ? 'border-cyan-400/50 bg-cyan-500/15 text-cyan-300 shadow-[0_0_0_1px_rgba(34,211,238,0.22)]'
                                                            : 'border-sparkle-border hover:bg-sparkle-card-hover text-sparkle-text-secondary'
                                                    )}
                                                    title="Toggle Event Console"
                                                >
                                                    <Terminal size={isDockMode ? 13 : 14} />
                                                </button>
                                            )}

                                            {isBusy && (
                                                <button
                                                    type="button"
                                                    onClick={handleCancelTurn}
                                                    className={cn(
                                                        'rounded-lg border border-amber-500/40 text-amber-300 bg-amber-500/10 hover:bg-amber-500/15 transition-colors',
                                                        isDockMode ? 'p-1' : 'p-1.5'
                                                    )}
                                                    title="Cancel active turn"
                                                >
                                                    <XCircle size={isDockMode ? 13 : 14} />
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
                                                    'rounded-lg border transition-colors disabled:opacity-60',
                                                    isDockMode
                                                        ? (showCompactSidebarHeader ? 'h-6 w-6 p-0 inline-flex items-center justify-center' : 'p-1')
                                                        : 'p-1.5',
                                                    connectionState === 'connected'
                                                        ? 'border-emerald-500/40 text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/15'
                                                        : 'border-sparkle-border text-sparkle-text-secondary hover:bg-sparkle-card-hover'
                                                )}
                                                title={connectionState === 'connected' ? 'Disconnect assistant' : 'Connect assistant'}
                                            >
                                                <PlugZap size={isDockMode ? 13 : 14} />
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setShowHeaderMenu((prev) => !prev)}
                                                className={cn(
                                                    'rounded-lg border border-sparkle-border text-sparkle-text-secondary hover:bg-sparkle-card-hover transition-colors',
                                                    isDockMode
                                                        ? (showCompactSidebarHeader ? 'h-6 w-6 p-0 inline-flex items-center justify-center' : 'p-1')
                                                        : 'p-1.5'
                                                )}
                                                title="More actions"
                                            >
                                                <MoreHorizontal size={isDockMode ? 13 : 14} />
                                            </button>

                                            {showHeaderMenu && (
                                                <div className={cn(
                                                    'absolute right-0 top-full z-20 mt-2 rounded-lg border border-sparkle-border bg-sparkle-card p-1 shadow-lg',
                                                    isDockMode ? 'w-48' : 'w-52'
                                                )}>
                                                    {isDockMode && showCompactSidebarHeader && (
                                                        <>
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    if (status.approvalMode !== 'safe') {
                                                                        void handleEnableSafeMode()
                                                                    }
                                                                    setShowHeaderMenu(false)
                                                                }}
                                                                className={cn(
                                                                    'flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-xs transition-colors',
                                                                    status.approvalMode === 'safe'
                                                                        ? 'text-emerald-300 hover:bg-emerald-500/10'
                                                                        : 'text-sparkle-text-secondary hover:bg-sparkle-card-hover hover:text-sparkle-text'
                                                                )}
                                                            >
                                                                <Shield size={13} />
                                                                Safe Mode
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    if (status.approvalMode !== 'yolo') {
                                                                        setShowYoloConfirmModal(true)
                                                                    }
                                                                    setShowHeaderMenu(false)
                                                                }}
                                                                className={cn(
                                                                    'flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-xs transition-colors',
                                                                    status.approvalMode === 'yolo'
                                                                        ? 'text-amber-300 hover:bg-amber-500/10'
                                                                        : 'text-sparkle-text-secondary hover:bg-sparkle-card-hover hover:text-sparkle-text'
                                                                )}
                                                            >
                                                                <Zap size={13} />
                                                                YOLO Mode
                                                            </button>
                                                            {canUseEventConsole && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => {
                                                                        handleToggleEventConsole()
                                                                        setShowHeaderMenu(false)
                                                                    }}
                                                                    className={cn(
                                                                        'flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-xs transition-colors',
                                                                        showEventConsole
                                                                            ? 'text-cyan-300 hover:bg-cyan-500/10'
                                                                            : 'text-sparkle-text-secondary hover:bg-sparkle-card-hover hover:text-sparkle-text'
                                                                    )}
                                                                >
                                                                    <Terminal size={13} />
                                                                    {showEventConsole ? 'Hide Event Console' : 'Show Event Console'}
                                                                </button>
                                                            )}
                                                            <div className="my-1 border-t border-sparkle-border" />
                                                        </>
                                                    )}
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
                                    <div className={cn('flex-1 bg-sparkle-bg', isDockMode ? 'px-3 py-2.5' : 'px-4 py-3')}>
                                        <div className="flex h-full w-full items-center justify-center">
                                            <div className={cn(
                                                'w-full rounded-2xl border border-sparkle-border bg-sparkle-card/80 text-center',
                                                isDockMode ? 'max-w-[460px] px-5 py-6' : 'max-w-[560px] px-6 py-8'
                                            )}>
                                                <div className={cn(
                                                    'mx-auto mb-3 inline-flex items-center justify-center rounded-xl border border-sparkle-border bg-sparkle-bg text-[var(--accent-primary)]',
                                                    isDockMode ? 'h-9 w-9' : 'h-11 w-11'
                                                )}>
                                                    <Loader2 size={isDockMode ? 17 : 20} className="animate-spin" />
                                                </div>
                                                <h3 className={cn('font-semibold text-sparkle-text', isDockMode ? 'text-sm' : 'text-base')}>Loading chat</h3>
                                                <p className={cn('mt-2 text-sparkle-text-secondary', isDockMode ? 'text-xs' : 'text-sm')}>
                                                    Restoring this session from memory...
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div ref={chatScrollRef} onScroll={handleChatScroll} className={cn('flex-1 overflow-y-auto bg-sparkle-bg scrollbar-hide', isDockMode ? 'px-3 py-2.5' : 'px-4 py-3')}>
                                        <div className={cn('flex min-h-full w-full flex-col gap-3', isEmptyChatState ? 'justify-center items-center pb-0' : 'justify-end pb-8')}>
                                            <div className={cn('w-full space-y-3', isEmptyChatState ? (isDockMode ? 'pb-0 max-w-xl' : 'pb-0 max-w-2xl') : 'pb-4')}>
                                                {displayHistoryGroups.map((group) => {
                                                    if (group.role === 'assistant') {
                                                        return (
                                                            <div key={group.id} className="w-full">
                                                                <AssistantMessage
                                                                    attempts={group.messages}
                                                                    onRegenerate={handleRegenerate}
                                                                    isBusy={isBusy || isSending}
                                                                    compact={isDockMode}
                                                                    activeModel={activeModel}
                                                                    activeProfile={activeProfile}
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
                                                                compact={isDockMode}
                                                            />
                                                        </div>
                                                    )
                                                })}

                                                {isEmptyChatState && (
                                                    <div className="flex flex-col items-center animate-fadeIn">
                                                        <div className={cn(
                                                            'flex items-center justify-center rounded-3xl bg-sparkle-card border border-sparkle-border shadow-2xl relative',
                                                            isDockMode ? 'mb-5 h-14 w-14' : 'mb-8 h-20 w-20'
                                                        )}>
                                                            <div className="absolute inset-0 bg-sparkle-primary/5 rounded-3xl blur-xl" />
                                                            <div className="relative flex flex-col items-center">
                                                                <div className={cn(
                                                                    'rounded-lg border-[3px] border-sparkle-text-muted/20 flex items-center justify-center',
                                                                    isDockMode ? 'w-8 h-6' : 'w-10 h-8'
                                                                )}>
                                                                    <div className={cn('h-[2px] bg-sparkle-text-muted/30', isDockMode ? 'w-3' : 'w-4')} />
                                                                </div>
                                                            </div>
                                                        </div>

                                                        <h1 className={cn(
                                                            'font-bold text-white tracking-tight',
                                                            isDockMode ? 'mb-6 text-2xl' : 'mb-10 text-5xl'
                                                        )}>
                                                            <span className="text-[var(--accent-primary)]">devs</span> don't use <span className="text-[var(--accent-primary)]">light mode</span>
                                                        </h1>

                                                        <div className={cn('relative mx-auto', isDockMode ? 'mb-8 w-64' : 'mb-12 w-80')} ref={projectDropdownRef}>
                                                            <button
                                                                onClick={() => setShowProjectDropdown((prev) => !prev)}
                                                                className={cn(
                                                                    'group flex w-full items-center bg-sparkle-card border transition-all shadow-xl',
                                                                    isDockMode ? 'gap-2 px-3.5 py-2' : 'gap-3 px-5 py-2.5',
                                                                    showProjectDropdown
                                                                        ? "rounded-t-2xl border-sparkle-border border-b-transparent bg-sparkle-card-hover"
                                                                        : "rounded-2xl border-sparkle-border hover:bg-sparkle-card-hover hover:border-sparkle-border-hover"
                                                                )}
                                                            >
                                                                <Folder size={isDockMode ? 14 : 16} className={cn("transition-colors", showProjectDropdown ? "text-[var(--accent-primary)]" : "text-sparkle-text-secondary")} />
                                                                <span className={cn('font-medium text-sparkle-text flex-1 text-left', isDockMode ? 'text-[12px]' : 'text-[14px]')}>
                                                                    {effectiveProjectPath ? effectiveProjectPath.split(/[\\/]/).pop() : 'Select Project'}
                                                                </span>
                                                                <ChevronDown size={isDockMode ? 12 : 14} className={cn("text-sparkle-text-muted transition-transform duration-500 [transition-timing-function:cubic-bezier(0.16,1,0.3,1)]", showProjectDropdown && "rotate-180")} />
                                                            </button>

                                                            <div className="absolute left-0 top-full z-30 w-full overflow-hidden">
                                                                <AnimatedHeight isOpen={showProjectDropdown} duration={500}>
                                                                    <div className="p-2 space-y-1 bg-sparkle-card border border-sparkle-border border-t-0 rounded-b-2xl shadow-2xl">
                                                                        <div className="px-3 py-1.5 text-[9px] font-bold uppercase tracking-widest text-sparkle-text-muted/40">
                                                                            Recent Projects
                                                                        </div>
                                                                        <div className="max-h-64 overflow-y-auto space-y-0.5 scrollbar-hide text-left px-1 pb-1">
                                                                            {recentProjectPathPreview.map((root) => {
                                                                                const isActive = root === effectiveProjectPath
                                                                                return (
                                                                                    <button
                                                                                        key={root}
                                                                                        onClick={() => {
                                                                                            void handleApplyChatProjectPath(root)
                                                                                            setShowProjectDropdown(false)
                                                                                        }}
                                                                                        className={cn(
                                                                                            'group relative flex w-full items-center gap-3 rounded-lg border transition-all duration-200 backdrop-blur-[2px]',
                                                                                            isDockMode ? 'px-2 py-1.5' : 'px-3 py-2',
                                                                                            isActive
                                                                                                ? 'border-white/10 bg-[var(--accent-primary)]/10 text-[var(--accent-primary)] shadow-[0_2px_10px_rgba(0,0,0,0.05)]'
                                                                                                : 'border-white/5 bg-sparkle-bg/40 text-sparkle-text-secondary hover:border-sparkle-border hover:bg-sparkle-card-hover/60 hover:text-sparkle-text'
                                                                                        )}
                                                                                    >
                                                                                        <div className="min-w-0 flex-1 overflow-hidden">
                                                                                            <div className={cn(
                                                                                                'truncate leading-tight transition-colors',
                                                                                                isDockMode ? 'text-[12px]' : 'text-[13px]',
                                                                                                isActive ? "font-bold" : "font-medium"
                                                                                            )}>
                                                                                                {root.split(/[\\/]/).pop() || root}
                                                                                            </div>
                                                                                            <div className={cn('truncate opacity-30 font-medium', isDockMode ? 'text-[8px]' : 'text-[9px]')} title={root}>{root}</div>
                                                                                        </div>
                                                                                    </button>
                                                                                )
                                                                            })}
                                                                            {hasMoreRecentProjectPaths && (
                                                                                <button
                                                                                    onClick={() => {
                                                                                        setShowProjectSelectorModal(true)
                                                                                        setShowProjectDropdown(false)
                                                                                    }}
                                                                                    className={cn(
                                                                                        'group relative flex w-full items-center gap-3 rounded-lg border transition-all duration-200 backdrop-blur-[2px]',
                                                                                        isDockMode ? 'px-2 py-1.5' : 'px-3 py-2',
                                                                                        'border-white/5 bg-sparkle-bg/40 text-sparkle-text-secondary hover:border-sparkle-border hover:bg-sparkle-card-hover/60 hover:text-sparkle-text'
                                                                                    )}
                                                                                >
                                                                                    <div className="min-w-0 flex-1 overflow-hidden text-center">
                                                                                        <div className={cn('truncate leading-tight font-medium', isDockMode ? 'text-[12px]' : 'text-[13px]')}>
                                                                                            Show more...
                                                                                        </div>
                                                                                        <div className={cn('truncate opacity-30 font-medium', isDockMode ? 'text-[8px]' : 'text-[9px]')}>
                                                                                            Browse all {recentProjectPaths.length} paths
                                                                                        </div>
                                                                                    </div>
                                                                                    <ChevronDown size={isDockMode ? 11 : 12} className="-rotate-90 opacity-60" />
                                                                                </button>
                                                                            )}
                                                                        </div>

                                                                        <div className="mt-1 border-t border-sparkle-border/30 pt-1 px-1">
                                                                            <button
                                                                                onClick={() => {
                                                                                    void handleSelectChatProjectPath()
                                                                                    setShowProjectDropdown(false)
                                                                                }}
                                                                                className={cn(
                                                                                    'flex w-full items-center justify-center gap-2 rounded-lg font-semibold text-[var(--accent-primary)] hover:bg-[var(--accent-primary)]/10 transition-colors',
                                                                                    isDockMode ? 'px-2 py-1.5 text-[12px]' : 'px-3 py-2 text-[13px]'
                                                                                )}
                                                                            >
                                                                                <FolderOpen size={isDockMode ? 12 : 13} />
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

                                <div className={cn(
                                    'bg-sparkle-bg pb-4 transition-all duration-500 ease-in-out',
                                    isDockMode ? 'px-3' : 'px-4',
                                    isEmptyChatState ? 'pt-0' : 'pt-3 border-t border-sparkle-border'
                                )}>
                                    <div className={cn('mx-auto w-full transition-all duration-500 ease-in-out', isEmptyChatState && (isDockMode ? 'max-w-xl' : 'max-w-3xl'))}>
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
                                            compact={isDockMode}
                                        />
                                    </div>

                                    {isEmptyChatState && (
                                        <div className={cn(
                                            'mt-6 flex items-center justify-between px-2 font-medium text-sparkle-text-muted/60',
                                            isDockMode ? 'text-[10px]' : 'text-[11px]'
                                        )}>
                                            <div className="flex items-center gap-4">
                                                <span className="text-white font-bold opacity-100 cursor-default">Local</span>
                                            </div>
                                            <div className="flex items-center gap-1.5 opacity-40">
                                                <GitBranch size={isDockMode ? 10 : 11} />
                                                <span>local-dev</span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </section>
                            {canUseEventConsole && !isDockMode && (
                                <aside
                                    aria-hidden={!showEventConsole}
                                    className={cn(
                                        'shrink-0 overflow-hidden bg-sparkle-bg transition-[width,opacity,transform,border-color] duration-300 ease-out',
                                        showEventConsole
                                            ? 'opacity-100 translate-x-0 border-l border-sparkle-border'
                                            : 'opacity-0 translate-x-4 pointer-events-none border-l border-transparent'
                                    )}
                                    style={{ width: showEventConsole ? `${eventConsoleWidth}px` : '0px' }}
                                >
                                    <div className="h-full" style={{ width: `${eventConsoleWidth}px` }}>
                                        <AssistantEventConsole
                                            events={eventLog}
                                            onClear={handleClearEvents}
                                            onExport={() => void handleExportEvents()}
                                        />
                                    </div>
                                </aside>
                            )}
                            {canUseEventConsole && isDockMode && (
                                <aside
                                    aria-hidden={!showEventConsole}
                                    className={cn(
                                        'absolute inset-y-0 right-0 z-30 overflow-hidden border-l border-sparkle-border bg-sparkle-bg shadow-2xl transition-[opacity,transform] duration-300 ease-out',
                                        showEventConsole
                                            ? 'opacity-100 translate-x-0'
                                            : 'opacity-0 translate-x-full pointer-events-none'
                                    )}
                                    style={{ width: `${eventConsoleWidth}px`, maxWidth: '100%' }}
                                >
                                    <div className="h-full" style={{ width: `${eventConsoleWidth}px`, maxWidth: '100%' }}>
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
            {crossDirSendState && (
                <div className="fixed inset-0 z-[85] flex items-center justify-center p-4">
                    <div
                        className="absolute inset-0 bg-black/55 backdrop-blur-sm"
                        onClick={() => clearCrossDirSendState(false)}
                    />
                    <div className="relative w-full max-w-xl rounded-2xl border border-sparkle-border bg-sparkle-card p-5 shadow-2xl">
                        <h3 className="text-base font-semibold text-sparkle-text">
                            Send with different directory context?
                        </h3>
                        <p className="mt-2 text-sm text-sparkle-text-secondary">
                            This thread belongs to <span className="font-semibold text-sparkle-text">{resolvePathLabel(crossDirSendState.sessionPath)}</span>,
                            but you are currently in <span className="font-semibold text-sparkle-text">{resolvePathLabel(crossDirSendState.uiPath)}</span>.
                        </p>
                        <div className="mt-4 grid gap-2">
                            <button
                                type="button"
                                onClick={() => void runCrossDirSendAction('new-session-ui-dir')}
                                className="w-full rounded-lg border border-[var(--accent-primary)]/35 bg-[var(--accent-primary)]/12 px-3 py-2 text-left text-sm font-semibold text-[var(--accent-primary)] transition-colors hover:bg-[var(--accent-primary)]/20"
                            >
                                Create new session in current dir (Recommended)
                            </button>
                            <button
                                type="button"
                                onClick={() => void runCrossDirSendAction('send-session-dir')}
                                className="w-full rounded-lg border border-sparkle-border bg-sparkle-bg px-3 py-2 text-left text-sm text-sparkle-text-secondary transition-colors hover:bg-sparkle-card-hover hover:text-sparkle-text"
                            >
                                Send in this session directory
                            </button>
                            <button
                                type="button"
                                onClick={() => void runCrossDirSendAction('switch-session-ui-dir')}
                                className="w-full rounded-lg border border-sparkle-border bg-sparkle-bg px-3 py-2 text-left text-sm text-sparkle-text-secondary transition-colors hover:bg-sparkle-card-hover hover:text-sparkle-text"
                            >
                                Switch this session to current directory
                            </button>
                        </div>
                        <div className="mt-3 flex justify-end">
                            <button
                                type="button"
                                onClick={() => clearCrossDirSendState(false)}
                                className="rounded-lg border border-sparkle-border bg-sparkle-bg px-3 py-1.5 text-xs font-medium text-sparkle-text-secondary transition-colors hover:bg-sparkle-card-hover hover:text-sparkle-text"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {showProjectSelectorModal && (
                <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
                    <div
                        className="absolute inset-0 bg-black/55 backdrop-blur-sm"
                        onClick={() => setShowProjectSelectorModal(false)}
                    />
                    <div className="relative w-full max-w-2xl rounded-2xl border border-sparkle-border bg-sparkle-card p-5 shadow-2xl">
                        <h3 className="text-center text-base font-semibold text-sparkle-text">
                            Select project path
                        </h3>
                        <p className="mt-2 text-center text-sm text-sparkle-text-secondary">
                            Choose from recent paths or open another directory.
                        </p>
                        <div className="mt-4 max-h-[55vh] space-y-1 overflow-y-auto pr-1 scrollbar-hide">
                            {recentProjectPaths.length > 0 ? (
                                recentProjectPaths.map((root) => {
                                    const isActive = root === effectiveProjectPath
                                    return (
                                        <button
                                            key={`modal-${root}`}
                                            onClick={() => {
                                                void handleApplyChatProjectPath(root)
                                                setShowProjectSelectorModal(false)
                                            }}
                                            className={cn(
                                                'group relative flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-center transition-all duration-200 backdrop-blur-[2px]',
                                                isActive
                                                    ? 'border-white/10 bg-[var(--accent-primary)]/10 text-[var(--accent-primary)] shadow-[0_2px_10px_rgba(0,0,0,0.05)]'
                                                    : 'border-white/5 bg-sparkle-bg/40 text-sparkle-text-secondary hover:border-sparkle-border hover:bg-sparkle-card-hover/60 hover:text-sparkle-text'
                                            )}
                                        >
                                            <div className="min-w-0 flex-1 overflow-hidden text-center">
                                                <div className="truncate text-[13px] font-medium leading-tight">
                                                    {root.split(/[\\/]/).pop() || root}
                                                </div>
                                                <div className="truncate text-[10px] font-medium opacity-30" title={root}>
                                                    {root}
                                                </div>
                                            </div>
                                        </button>
                                    )
                                })
                            ) : (
                                <div className="rounded-lg border border-sparkle-border bg-sparkle-bg/40 px-3 py-3 text-sm text-sparkle-text-secondary">
                                    No recent paths yet.
                                </div>
                            )}
                        </div>
                        <div className="mt-4 flex items-center justify-between gap-2">
                            <button
                                type="button"
                                onClick={() => setShowProjectSelectorModal(false)}
                                className="rounded-lg border border-sparkle-border bg-sparkle-bg px-3 py-1.5 text-xs font-medium text-sparkle-text-secondary transition-colors hover:bg-sparkle-card-hover hover:text-sparkle-text"
                            >
                                Close
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    void handleSelectChatProjectPath()
                                    setShowProjectSelectorModal(false)
                                }}
                                className="rounded-lg border border-[var(--accent-primary)]/35 bg-[var(--accent-primary)]/12 px-3 py-1.5 text-xs font-semibold text-[var(--accent-primary)] transition-colors hover:bg-[var(--accent-primary)]/20"
                            >
                                Open other path...
                            </button>
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
