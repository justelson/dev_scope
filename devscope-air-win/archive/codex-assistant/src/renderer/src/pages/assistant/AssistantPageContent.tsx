import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import {
    Download, Folder, FolderOpen, Loader2, MessageSquare,
    MessageSquarePlus, MoreHorizontal, PlugZap, Settings2, Shield,
    Terminal, Trash2, XCircle, Zap, ChevronDown
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { AssistantComposer } from './AssistantComposer'
import { JulianLogo, OpenAILogo, T3CodeLogo } from './AssistantBrandMarks'
import { AssistantEventConsole } from './AssistantEventConsole'
import { AssistantTimeline } from './AssistantTimeline'
import { AssistantSessionsSidebar } from './AssistantSessionsSidebar'
import { AnimatedHeight } from '@/components/ui/AnimatedHeight'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import type { AssistantPageController } from './useAssistantPageController'
import type { AssistantApproval } from './assistant-page-types'
import type { ComposerContextFile } from './assistant-composer-types'

type Props = {
    controller: AssistantPageController
    layoutMode?: 'page' | 'dock'
}

const LAST_ASSISTANT_CHAT_PATH_STORAGE_KEY = 'devscope:assistant-last-chat-path:v1'
type ComposerSendMeta = {
    entryMode?: 'chat' | 'plan'
    reasoningLevel?: 'extra-high' | 'high' | 'medium' | 'low'
    fastModeEnabled?: boolean
}

function getPendingApprovalSummary(approval: AssistantApproval | null): string {
    if (!approval) return ''
    const request = approval.request && typeof approval.request === 'object'
        ? approval.request as Record<string, unknown>
        : {}
    const command = typeof request.command === 'string' ? request.command.trim() : ''
    if (command) return command
    const description = typeof request.description === 'string' ? request.description.trim() : ''
    if (description) return description
    const path = typeof request.path === 'string' ? request.path.trim() : ''
    if (path) return path
    const filePath = typeof request.filePath === 'string' ? request.filePath.trim() : ''
    if (filePath) return filePath
    return approval.method
}

export function AssistantPageContent({ controller, layoutMode = 'page' }: Props) {
    const location = useLocation()
    const navigate = useNavigate()
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
        sessions,
        activeSessionId,
        activeSessionTitle,
        displayHistoryGroups,
        streamingTurnId,
        streamingText,
        allApprovals,
        activePendingUserInput,
        activePendingProgress,
        activePendingResolvedAnswers,
        activePendingIsResponding,
        activeWorkItems,
        activeTelemetryTurnId,
        assistantPhase,
        assistantPhaseLabel,
        assistantIsWorking,
        threadTokenUsage,
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
        handleRespondApproval,
        handleRespondUserInput,
        handleCancelTurn,
        handleEnableYoloMode,
        handleSelectChatProjectPath,
        handleCreateSessionForSelectedProject,
        handleSessionsSidebarCollapsed,
        handleAssistantSidebarWidthChange,
        handleToggleEventConsole,
        handleExportConversation,
        handleClearHistory,
        handleApplyChatProjectPath,
        handlePendingUserInputSelectOption,
        handlePendingUserInputCustomAnswer,
        handlePendingUserInputPrevious,
        handlePendingUserInputNext,
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
    const sessionSidebarItems = useMemo(() => sessions.map((session) => ({
        id: session.id,
        title: session.title,
        createdAt: session.createdAt,
        updatedAt: session.updatedAt,
        messageCount: session.messageCount,
        archived: Boolean(session.archived),
        projectPath: session.projectPath
    })), [sessions])

    const [showProjectDropdown, setShowProjectDropdown] = useState(false)
    const [showProjectSelectorModal, setShowProjectSelectorModal] = useState(false)
    const [showScrollToBottom, setShowScrollToBottom] = useState(false)
    const projectDropdownRef = useRef<HTMLDivElement>(null)
    const previousPathnameRef = useRef(location.pathname)
    const shouldOpenDefaultThreadRef = useRef(location.pathname === '/assistant')
    const [isSidebarHeaderMinimized, setIsSidebarHeaderMinimized] = useState(layoutMode === 'dock')
    const pendingSendResolverRef = useRef<((result: boolean) => void) | null>(null)
    const latestBaseSendRef = useRef(baseHandleSend)
    const [crossDirSendState, setCrossDirSendState] = useState<{
        prompt: string
        contextFiles: ComposerContextFile[]
        sendMetadata?: ComposerSendMeta
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

    useEffect(() => {
        const previousPathname = previousPathnameRef.current
        if (location.pathname === '/assistant' && previousPathname !== '/assistant') {
            shouldOpenDefaultThreadRef.current = true
        }
        previousPathnameRef.current = location.pathname
    }, [location.pathname])

    useEffect(() => {
        if (!activeSessionId) return
        const normalizedPath = String(effectiveProjectPath || '').trim()
        if (!normalizedPath) return
        try {
            localStorage.setItem(LAST_ASSISTANT_CHAT_PATH_STORAGE_KEY, normalizedPath)
        } catch {
            // ignore storage failures
        }
    }, [activeSessionId, effectiveProjectPath])

    const isDockMode = layoutMode === 'dock'
    const isSkillsView = location.pathname === '/assistant/skills'
    const showCompactSidebarHeader = isDockMode && isSidebarHeaderMinimized
    const canUseEventConsole = settings.assistantAllowEventConsole
    const hasChatMessages = displayHistoryGroups.length > 0
    const sessionSidebarWidth = Number(settings.assistantSidebarWidth) || 320
    const compactSidebarWidth = Math.max(180, Math.min(340, sessionSidebarWidth - 24))
    const eventConsoleWidth = isDockMode ? 340 : 430
    const chatColumnWidthClass = isDockMode ? 'max-w-[min(92vw,760px)]' : 'max-w-[min(88vw,980px)]'
    const isDockSessionsExpanded = isDockMode && !settings.assistantSidebarCollapsed
    const isDockEventConsoleExpanded = isDockMode && canUseEventConsole && showEventConsole
    const showDockOverlayBackdrop = isDockSessionsExpanded || isDockEventConsoleExpanded
    const handleOpenChatFromSkills = async () => {
        if (!activeSessionId) {
            await handleCreateSession()
        }
        navigate('/assistant')
    }

    useEffect(() => {
        if (!shouldOpenDefaultThreadRef.current) return
        if (location.pathname !== '/assistant' || isChatHydrating) return
        if (activeSessionId) {
            shouldOpenDefaultThreadRef.current = false
            return
        }

        shouldOpenDefaultThreadRef.current = false
        let persistedLastChatPath = ''
        try {
            persistedLastChatPath = String(localStorage.getItem(LAST_ASSISTANT_CHAT_PATH_STORAGE_KEY) || '').trim()
        } catch {
            // ignore storage failures
        }
        const defaultProjectPath = String(persistedLastChatPath || effectiveProjectPath || availableProjectRoots[0] || '').trim()
        void handleCreateSession(defaultProjectPath)
    }, [location.pathname, isChatHydrating, activeSessionId, availableProjectRoots, effectiveProjectPath, handleCreateSession])

    const threadTokenCount = useMemo(() => {
        if (!threadTokenUsage) return null
        const total = Number(threadTokenUsage.totalTokens)
        if (Number.isFinite(total) && total > 0) return Math.floor(total)
        const input = Number(threadTokenUsage.inputTokens)
        const output = Number(threadTokenUsage.outputTokens)
        const fallback = (Number.isFinite(input) ? input : 0) + (Number.isFinite(output) ? output : 0)
        if (!Number.isFinite(fallback) || fallback <= 0) return null
        return Math.floor(fallback)
    }, [threadTokenUsage])
    const unresolvedApprovals = useMemo(
        () => [...allApprovals]
            .filter((entry) => !entry.decision)
            .sort((a, b) => a.timestamp - b.timestamp),
        [allApprovals]
    )
    const activePendingApproval = unresolvedApprovals[0] || null
    const activePendingApprovalSummary = useMemo(
        () => getPendingApprovalSummary(activePendingApproval),
        [activePendingApproval]
    )
    const hasPendingActionPanel = Boolean(activePendingApproval || activePendingUserInput)

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

    const updateScrollAffordances = () => {
        const viewport = chatScrollRef.current
        if (!viewport || isEmptyChatState || isChatHydrating) {
            setShowScrollToBottom(false)
            return
        }
        const distanceFromBottom = viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight
        setShowScrollToBottom(distanceFromBottom > 120)
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

    useEffect(() => {
        updateScrollAffordances()
        const handleWindowResize = () => updateScrollAffordances()
        window.addEventListener('resize', handleWindowResize)
        return () => window.removeEventListener('resize', handleWindowResize)
    }, [displayHistoryGroups, streamingText, isEmptyChatState, isChatHydrating])

    const sendWithLatestControllerState = async (
        prompt: string,
        contextFiles: ComposerContextFile[],
        sendMetadata?: ComposerSendMeta
    ) => {
        await new Promise<void>((resolve) => {
            window.requestAnimationFrame(() => resolve())
        })
        return await latestBaseSendRef.current(prompt, contextFiles, sendMetadata)
    }

    const handleSend = async (
        prompt: string,
        contextFiles: ComposerContextFile[],
        sendMetadata?: ComposerSendMeta
    ): Promise<boolean> => {
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
                    sendMetadata,
                    sessionPath,
                    uiPath
                })
            })
        }

        return await baseHandleSend(prompt, contextFiles, sendMetadata)
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

            const sent = await sendWithLatestControllerState(pending.prompt, pending.contextFiles, pending.sendMetadata)
            clearCrossDirSendState(sent)
        } catch {
            clearCrossDirSendState(false)
        }
    }

    const handleChatViewportScroll = () => {
        handleChatScroll()
        updateScrollAffordances()
    }

    const handleScrollToBottom = () => {
        const viewport = chatScrollRef.current
        if (!viewport) return
        viewport.scrollTo({ top: viewport.scrollHeight, behavior: 'smooth' })
        setShowScrollToBottom(false)
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
        <div className="assistant-t3-page h-full flex flex-col overflow-hidden animate-fadeIn [--accent-primary:var(--color-primary)] [--accent-secondary:var(--color-secondary)]">
            {settings.assistantEnabled && (errorMessage || connectionState === 'error' || connectionState === 'disconnected') && (
                <div className="assistant-t3-banner mb-4 flex flex-col justify-between gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200 sm:flex-row sm:items-center">
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
                <div className="assistant-t3-disabled-state flex flex-1 items-center justify-center rounded-lg border border-white/10 bg-sparkle-card p-8">
                    <div className="max-w-xl text-center">
                        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-md border border-white/10 bg-sparkle-bg">
                            <PlugZap className="text-sparkle-text-secondary" size={24} />
                        </div>
                        <h2 className="text-xl font-semibold text-sparkle-text mb-2">Assistant is turned off</h2>
                        <p className="text-sm text-sparkle-text-secondary mb-5">
                            Enable Assistant in settings, choose your defaults, then come back here to connect and start a session.
                        </p>
                        <Link
                            to="/settings/assistant"
                            className="inline-flex items-center gap-2 rounded-md border border-white/10 bg-sparkle-bg px-4 py-2 text-sparkle-text transition-colors hover:border-white/20 hover:bg-sparkle-card-hover"
                        >
                            <Settings2 size={16} />
                            Open Assistant Settings
                        </Link>
                    </div>
                </div>
            ) : (
                <div className="flex-1 min-h-0 overflow-hidden">
                    <div className={cn('assistant-t3-shell h-full flex', isDockMode && 'relative')}>
                        {!isDockMode && (
                            <AssistantSessionsSidebar
                                collapsed={settings.assistantSidebarCollapsed}
                                width={sessionSidebarWidth}
                                compact={false}
                                sessions={sessionSidebarItems}
                                activeSessionId={activeSessionId}
                                isThinking={assistantIsWorking}
                                onSetCollapsed={handleSessionsSidebarCollapsed}
                                onWidthChange={handleAssistantSidebarWidthChange}
                                onCreateSession={handleCreateSession}
                                onSelectSession={handleSelectSession}
                                onRenameSession={handleRenameSession}
                                onArchiveSession={handleArchiveSession}
                                onDeleteSession={handleDeleteSession}
                                projectPathOptions={recentProjectPaths}
                                selectedProjectPath={effectiveProjectPath}
                                onSelectProjectPath={handleApplyChatProjectPath}
                                onAddProject={handleCreateSessionForSelectedProject}
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
                                        isThinking={assistantIsWorking}
                                        onSetCollapsed={handleSessionsSidebarCollapsed}
                                        onWidthChange={handleAssistantSidebarWidthChange}
                                        onCreateSession={handleCreateSession}
                                        onSelectSession={handleSelectSession}
                                        onRenameSession={handleRenameSession}
                                        onArchiveSession={handleArchiveSession}
                                        onDeleteSession={handleDeleteSession}
                                        projectPathOptions={recentProjectPaths}
                                        selectedProjectPath={effectiveProjectPath}
                                        onSelectProjectPath={handleApplyChatProjectPath}
                                        onAddProject={handleCreateSessionForSelectedProject}
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
                                        isThinking={assistantIsWorking}
                                        onSetCollapsed={handleSessionsSidebarCollapsed}
                                        onWidthChange={handleAssistantSidebarWidthChange}
                                        onCreateSession={handleCreateSession}
                                        onSelectSession={handleSelectSession}
                                        onRenameSession={handleRenameSession}
                                        onArchiveSession={handleArchiveSession}
                                        onDeleteSession={handleDeleteSession}
                                        projectPathOptions={recentProjectPaths}
                                        selectedProjectPath={effectiveProjectPath}
                                        onSelectProjectPath={handleApplyChatProjectPath}
                                        onAddProject={handleCreateSessionForSelectedProject}
                                    />
                                </div>
                            </>
                        )}

                        <div className={cn('flex-1 flex min-w-0', isDockMode && 'relative')}>
                            <section className={cn(
                                'assistant-t3-thread-shell flex min-w-0 flex-1 flex-col transition-all duration-300',
                                isSkillsView && 'hidden',
                                !isDockMode && canUseEventConsole && showEventConsole && 'border-r border-white/5'
                            )}>
                                {!isEmptyChatState && (
                                    <div className={cn(
                                        'assistant-t3-thread-header flex items-center justify-between border-b border-white/5 bg-sparkle-card animate-slideInFromTop',
                                        isDockMode
                                            ? (showCompactSidebarHeader ? 'gap-1.5 px-2.5 py-1.5' : 'gap-2 px-3 py-2')
                                            : 'gap-3 px-4 py-2.5'
                                    )}>
                                        <div className="min-w-0 flex-1">
                                            {showCompactSidebarHeader ? (
                                                <div className={cn('flex items-center', isDockMode ? 'gap-1.5' : 'gap-2')}>
                                                    <MessageSquare size={isDockMode ? 14 : 15} className="text-sparkle-text-secondary" />
                                                    <h2 className={cn('min-w-0 truncate font-semibold text-sparkle-text', isDockMode ? 'text-xs' : 'text-sm')}>
                                                        {activeSessionTitle}
                                                    </h2>
                                                    {isBusy && (
                                                        <span className="inline-flex h-2 w-2 rounded-full bg-amber-300 animate-pulse" />
                                                    )}
                                                </div>
                                            ) : (
                                                <>
                                                    <div className="flex min-w-0 items-center gap-2">
                                                        <h2
                                                            className={cn(
                                                                'min-w-0 truncate font-semibold tracking-tight text-sparkle-text',
                                                                isDockMode ? 'max-w-[24ch] text-sm' : 'max-w-[36ch] text-base'
                                                            )}
                                                            title={activeSessionTitle}
                                                        >
                                                            {activeSessionTitle}
                                                        </h2>
                                                        {!isDockMode && isBusy && (
                                                            <span className="inline-flex h-2 w-2 rounded-full bg-amber-300 animate-pulse" />
                                                        )}
                                                    </div>
                                                    <div className={cn('mt-1 flex flex-wrap items-center text-sparkle-text-secondary', isDockMode ? 'gap-1.5 text-[10px]' : 'gap-2 text-xs')}>
                                                        <span
                                                            className={cn('inline-flex min-w-0 items-center gap-1.5', isDockMode ? 'max-w-[34ch]' : 'max-w-[56ch]')}
                                                            title={effectiveProjectPath || 'No chat path selected'}
                                                        >
                                                            <FolderOpen size={isDockMode ? 11 : 12} className="shrink-0 text-sparkle-text-muted" />
                                                            <span className="truncate">
                                                                {effectiveProjectPath ? resolvePathLabel(effectiveProjectPath) : 'Choose a project'}
                                                            </span>
                                                        </span>
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                        <div className={cn('relative flex shrink-0 items-center', isDockMode ? 'gap-1' : 'gap-2')} ref={headerMenuRef}>
                                            {isDockMode && (
                                                <button
                                                    type="button"
                                                    onClick={() => setIsSidebarHeaderMinimized((prev) => !prev)}
                                                    className={cn(
                                                        'assistant-t3-icon-button rounded-md border border-white/10 text-sparkle-text-secondary transition-colors hover:border-white/20 hover:bg-sparkle-card-hover hover:text-sparkle-text',
                                                        showCompactSidebarHeader ? 'h-6 w-6 p-0 inline-flex items-center justify-center' : 'p-1'
                                                    )}
                                                    title={isSidebarHeaderMinimized ? 'Expand thread header' : 'Minimize thread header'}
                                                >
                                                    <ChevronDown
                                                        size={12}
                                                        className={cn('transition-transform', !isSidebarHeaderMinimized && 'rotate-180')}
                                                    />
                                                </button>
                                            )}
                                            {isBusy && (
                                                <button
                                                    type="button"
                                                    onClick={handleCancelTurn}
                                                    className={cn(
                                                        'assistant-t3-icon-button rounded-md border border-amber-500/40 text-amber-300 bg-amber-500/10 hover:bg-amber-500/15 transition-colors',
                                                        isDockMode ? 'p-1' : 'p-1.5'
                                                    )}
                                                    title="Cancel active turn"
                                                >
                                                    <XCircle size={isDockMode ? 13 : 14} />
                                                </button>
                                            )}

                                            <button
                                                type="button"
                                                onClick={() => setShowHeaderMenu((prev) => !prev)}
                                                className={cn(
                                                    'assistant-t3-icon-button rounded-md border border-white/10 text-sparkle-text-secondary transition-colors hover:border-white/20 hover:bg-sparkle-card-hover',
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
                                                    'assistant-t3-menu absolute right-0 top-full z-20 mt-2 rounded-lg border border-white/10 bg-sparkle-card p-1 shadow-lg',
                                                    isDockMode ? 'w-48' : 'w-52'
                                                )}>
                                                    {!hasChatMessages && (
                                                        <>
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    void handleSelectChatProjectPath()
                                                                    setShowHeaderMenu(false)
                                                                }}
                                                                className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-xs text-sparkle-text-secondary transition-colors hover:bg-sparkle-card-hover hover:text-sparkle-text"
                                                            >
                                                                <FolderOpen size={13} />
                                                                Choose Chat Path
                                                            </button>
                                                            <div className="my-1 border-t border-white/5" />
                                                        </>
                                                    )}
                                                    <button
                                                        type="button"
                                                        disabled={isConnecting}
                                                        onClick={() => {
                                                            if (connectionState === 'connected') {
                                                                void handleDisconnect()
                                                            } else {
                                                                void handleConnect()
                                                            }
                                                            setShowHeaderMenu(false)
                                                        }}
                                                        className={cn(
                                                            'flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-xs transition-colors disabled:opacity-60',
                                                            connectionState === 'connected'
                                                                ? 'text-emerald-300 hover:bg-emerald-500/10'
                                                                : 'text-sparkle-text-secondary hover:bg-sparkle-card-hover hover:text-sparkle-text'
                                                        )}
                                                    >
                                                        <PlugZap size={13} />
                                                        {connectionState === 'connected' ? 'Disconnect Assistant' : 'Connect Assistant'}
                                                    </button>
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
                                                    {(threadTokenCount != null || effectiveProjectPath) && (
                                                        <div className="my-1 border-t border-white/5" />
                                                    )}
                                                    {threadTokenCount != null && (
                                                        <div className="flex items-center gap-2 rounded-md px-2.5 py-2 text-xs text-sparkle-text-muted">
                                                            <Download size={13} className="opacity-0" />
                                                            <span className="truncate">
                                                                {threadTokenCount.toLocaleString()} tokens
                                                            </span>
                                                        </div>
                                                    )}
                                                    {effectiveProjectPath && (
                                                        <div className="px-2.5 py-2 text-xs text-sparkle-text-muted" title={effectiveProjectPath}>
                                                            <div className="mb-1 text-[10px] uppercase tracking-[0.12em] opacity-60">Path</div>
                                                            <div className="truncate">{effectiveProjectPath}</div>
                                                        </div>
                                                    )}
                                                    {(threadTokenCount != null || effectiveProjectPath) && (
                                                        <div className="my-1 border-t border-white/5" />
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
                                    <div className={cn('assistant-t3-chat-scroll flex-1 bg-sparkle-bg', isDockMode ? 'px-3 py-2.5' : 'px-4 py-3')}>
                                        <div className="flex h-full w-full items-center justify-center">
                                            <div className={cn(
                                                'w-full rounded-2xl border border-white/10 bg-sparkle-card/80 text-center',
                                                isDockMode ? 'max-w-[460px] px-5 py-6' : 'max-w-[560px] px-6 py-8'
                                            )}>
                                                <div className={cn(
                                                    'mx-auto mb-3 inline-flex items-center justify-center rounded-xl border border-white/10 bg-sparkle-bg text-[var(--accent-primary)]',
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
                                    <div ref={chatScrollRef} onScroll={handleChatViewportScroll} className={cn('assistant-t3-chat-scroll flex-1 overflow-y-auto bg-sparkle-bg assistant-t3-chat-scrollbar', isDockMode ? 'px-3 py-2.5' : 'px-4 py-3')}>
                                        <div className={cn('flex min-h-full w-full flex-col items-center gap-3', isEmptyChatState ? 'justify-center pb-0' : 'justify-end pb-4')}>
                                            <div className={cn('mx-auto w-full space-y-3', chatColumnWidthClass, isEmptyChatState ? 'pb-0' : 'pb-1')}>
                                                <AssistantTimeline
                                                    historyGroups={displayHistoryGroups}
                                                    compact={isDockMode}
                                                    streamingTurnId={streamingTurnId}
                                                    streamingText={streamingText}
                                                    activeWorkItems={activeWorkItems}
                                                    assistantIsWorking={assistantIsWorking}
                                                    showThinking={settings.assistantShowThinking}
                                                    onRegenerate={handleRegenerate}
                                                />

                                                {isEmptyChatState && (
                                                    <div className={cn(
                                                        'mx-auto flex w-full flex-col items-center justify-center text-center animate-fadeIn',
                                                        isDockMode ? 'min-h-[300px]' : 'min-h-[420px]'
                                                    )}>
                                                        <div className={cn(
                                                            'flex items-center justify-center gap-3 mb-8',
                                                            isDockMode ? 'mb-5' : 'mb-8'
                                                        )}>
                                                            <div className={cn(
                                                                'flex items-center justify-center rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.08] to-white/[0.02]',
                                                                isDockMode ? 'h-14 w-14' : 'h-20 w-20'
                                                            )}>
                                                                <JulianLogo className={cn('text-sparkle-text', isDockMode ? 'h-8 w-8' : 'h-11 w-11')} />
                                                            </div>

                                                            <div className={cn(
                                                                'text-sparkle-text-muted/40 font-light',
                                                                isDockMode ? 'text-lg' : 'text-2xl'
                                                            )}>
                                                                X
                                                            </div>

                                                            <div className={cn(
                                                                'flex items-center justify-center rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.06] to-white/[0.01]',
                                                                isDockMode ? 'h-14 w-14' : 'h-20 w-20'
                                                            )}>
                                                                <T3CodeLogo className={cn(isDockMode ? 'h-8 w-8' : 'h-11 w-11')} />
                                                            </div>

                                                            <div className={cn(
                                                                'text-sparkle-text-muted/40 font-light',
                                                                isDockMode ? 'text-lg' : 'text-2xl'
                                                            )}>
                                                                X
                                                            </div>

                                                            <div className={cn(
                                                                'flex items-center justify-center rounded-2xl border border-white/10 bg-gradient-to-br from-[#10a37f]/10 to-[#1a7f64]/5',
                                                                isDockMode ? 'h-14 w-14' : 'h-20 w-20'
                                                            )}>
                                                                <OpenAILogo className={cn('text-[#10a37f]', isDockMode ? 'h-8 w-8' : 'h-11 w-11')} />
                                                            </div>
                                                        </div>

                                                        <p className={cn(
                                                            'mb-4 text-center font-mono uppercase tracking-[0.18em] text-sparkle-text-muted',
                                                            isDockMode ? 'text-[9px]' : 'text-[10px]'
                                                        )}>
                                    julian client x t3 code backend x codex app server
                                                        </p>

                                                        <h1 className={cn(
                                                            'font-semibold text-sparkle-text tracking-tight',
                                                            isDockMode ? 'mb-6 text-xl' : 'mb-10 text-4xl'
                                                        )}>
                                                            Devs don&apos;t use light mode
                                                        </h1>

                                                        <div className={cn('assistant-t3-project-picker relative mx-auto', isDockMode ? 'mb-8 w-64' : 'mb-12 w-80')} ref={projectDropdownRef}>
                                                            <button
                                                                onClick={() => setShowProjectDropdown((prev) => !prev)}
                                                                className={cn(
                                                                    'group flex w-full items-center bg-sparkle-card border transition-colors',
                                                                    isDockMode ? 'gap-2 px-3.5 py-2' : 'gap-3 px-5 py-2.5',
                                                                    showProjectDropdown
                                                                        ? 'rounded-lg border-white/10 border-b-transparent bg-sparkle-card-hover'
                                                                        : 'rounded-lg border-white/10 hover:border-white/20 hover:bg-sparkle-card-hover'
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
                                                                    <div className="rounded-b-lg border border-white/10 border-t-0 bg-sparkle-card p-2 shadow-xl">
                                                                        <div className="px-3 py-1.5 text-[9px] font-semibold text-sparkle-text-muted/70">
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
                                                                                                : 'border-white/5 bg-sparkle-bg/40 text-sparkle-text-secondary hover:border-white/20 hover:bg-sparkle-card-hover/60 hover:text-sparkle-text'
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
                                                                                        'border-white/5 bg-sparkle-bg/40 text-sparkle-text-secondary hover:border-white/20 hover:bg-sparkle-card-hover/60 hover:text-sparkle-text'
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

                                                                        <div className="mt-1 border-t border-white/5 px-1 pt-1">
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

                                                {false && isEmptyChatState && (
                                                    <div className="flex flex-col items-center animate-fadeIn">
                                                        <div className={cn(
                                                            'flex items-center justify-center gap-3 mb-8',
                                                            isDockMode ? 'mb-5' : 'mb-8'
                                                        )}>
                                                            {/* ChatGPT Logo */}
                                                            <div className={cn(
                                                                'flex items-center justify-center rounded-2xl bg-gradient-to-br from-[#10a37f]/10 to-[#1a7f64]/5 border border-[#10a37f]/20',
                                                                isDockMode ? 'h-14 w-14' : 'h-20 w-20'
                                                            )}>
                                                                <svg
                                                                    viewBox="0 0 24 24"
                                                                    fill="currentColor"
                                                                    className={cn('text-[#10a37f]', isDockMode ? 'h-8 w-8' : 'h-11 w-11')}
                                                                    xmlns="http://www.w3.org/2000/svg"
                                                                >
                                                                    <path d="M22.2819 9.8211a5.9847 5.9847 0 0 0-.5157-4.9108 6.0462 6.0462 0 0 0-6.5098-2.9A6.0651 6.0651 0 0 0 4.9807 4.1818a5.9847 5.9847 0 0 0-3.9977 2.9 6.0462 6.0462 0 0 0 .7427 7.0966 5.98 5.98 0 0 0 .511 4.9107 6.051 6.051 0 0 0 6.5146 2.9001A5.9847 5.9847 0 0 0 13.2599 24a6.0557 6.0557 0 0 0 5.7718-4.2058 5.9894 5.9894 0 0 0 3.9977-2.9001 6.0557 6.0557 0 0 0-.7475-7.0729zm-9.022 12.6081a4.4755 4.4755 0 0 1-2.8764-1.0408l.1419-.0804 4.7783-2.7582a.7948.7948 0 0 0 .3927-.6813v-6.7369l2.02 1.1686a.071.071 0 0 1 .038.052v5.5826a4.504 4.504 0 0 1-4.4945 4.4944zm-9.6607-4.1254a4.4708 4.4708 0 0 1-.5346-3.0137l.142.0852 4.783 2.7582a.7712.7712 0 0 0 .7806 0l5.8428-3.3685v2.3324a.0804.0804 0 0 1-.0332.0615L9.74 19.9502a4.4992 4.4992 0 0 1-6.1408-1.6464zM2.3408 7.8956a4.485 4.485 0 0 1 2.3655-1.9728V11.6a.7664.7664 0 0 0 .3879.6765l5.8144 3.3543-2.0201 1.1685a.0757.0757 0 0 1-.071 0l-4.8303-2.7865A4.504 4.504 0 0 1 2.3408 7.872zm16.5963 3.8558L13.1038 8.364 15.1192 7.2a.0757.0757 0 0 1 .071 0l4.8303 2.7913a4.4944 4.4944 0 0 1-.6765 8.1042v-5.6772a.79.79 0 0 0-.407-.667zm2.0107-3.0231l-.142-.0852-4.7735-2.7818a.7759.7759 0 0 0-.7854 0L9.409 9.2297V6.8974a.0662.0662 0 0 1 .0284-.0615l4.8303-2.7866a4.4992 4.4992 0 0 1 6.6802 4.66zM8.3065 12.863l-2.02-1.1638a.0804.0804 0 0 1-.038-.0567V6.0742a4.4992 4.4992 0 0 1 7.3757-3.4537l-.142.0805L8.704 5.459a.7948.7948 0 0 0-.3927.6813zm1.0976-2.3654l2.602-1.4998 2.6069 1.4998v2.9994l-2.5974 1.4997-2.6067-1.4997Z" />
                                                                </svg>
                                                            </div>

                                                            {/* X symbol */}
                                                            <div className={cn(
                                                                'text-sparkle-text-muted/40 font-light',
                                                                isDockMode ? 'text-2xl' : 'text-3xl'
                                                            )}>
                                                                ×
                                                            </div>

                                                            {/* Your Folder Logo */}
                                                            <div className={cn(
                                                                'flex items-center justify-center rounded-2xl border border-white/10 bg-gradient-to-br from-sparkle-card to-sparkle-bg',
                                                                isDockMode ? 'h-14 w-14' : 'h-20 w-20'
                                                            )}>
                                                                <svg
                                                                    viewBox="0 0 500 500"
                                                                    xmlns="http://www.w3.org/2000/svg"
                                                                    className={cn(isDockMode ? 'h-9 w-9' : 'h-12 w-12')}
                                                                >
                                                                    <rect x="102" y="114" width="342" height="102" rx="4" fill="var(--color-text-dark)" />
                                                                    <polygon points="58,408 58,306 256,306 267,266 404,266 364,408" fill="var(--accent-primary)" />
                                                                </svg>
                                                            </div>
                                                        </div>

                                                        <h1 className={cn(
                                                            'font-semibold text-sparkle-text tracking-tight',
                                                            isDockMode ? 'mb-6 text-xl' : 'mb-10 text-4xl'
                                                        )}>
                                                            Devs don't use light mode
                                                        </h1>

                                                        <div className={cn('assistant-t3-project-picker relative mx-auto', isDockMode ? 'mb-8 w-64' : 'mb-12 w-80')} ref={projectDropdownRef}>
                                                            <button
                                                                onClick={() => setShowProjectDropdown((prev) => !prev)}
                                                                className={cn(
                                                                    'group flex w-full items-center bg-sparkle-card border transition-colors',
                                                                    isDockMode ? 'gap-2 px-3.5 py-2' : 'gap-3 px-5 py-2.5',
                                                                    showProjectDropdown
                                                                        ? 'rounded-lg border-white/10 border-b-transparent bg-sparkle-card-hover'
                                                                        : 'rounded-lg border-white/10 hover:border-white/20 hover:bg-sparkle-card-hover'
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
                                                                    <div className="rounded-b-lg border border-white/10 border-t-0 bg-sparkle-card p-2 shadow-xl">
                                                                        <div className="px-3 py-1.5 text-[9px] font-semibold text-sparkle-text-muted/70">
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
                                                                                                : 'border-white/5 bg-sparkle-bg/40 text-sparkle-text-secondary hover:border-white/20 hover:bg-sparkle-card-hover/60 hover:text-sparkle-text'
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
                                                                                        'border-white/5 bg-sparkle-bg/40 text-sparkle-text-secondary hover:border-white/20 hover:bg-sparkle-card-hover/60 hover:text-sparkle-text'
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

                                                                        <div className="mt-1 border-t border-white/5 px-1 pt-1">
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
                                    'assistant-t3-composer-wrap relative bg-transparent pb-4 transition-all duration-500 ease-in-out',
                                    isDockMode ? 'px-3' : 'px-4',
                                    isEmptyChatState ? 'assistant-t3-empty-entry pt-2' : 'pt-1.5'
                                )}>
                                    {showScrollToBottom && !isEmptyChatState && (
                                        <div className={cn('pointer-events-none absolute inset-x-0 -top-12 z-20 mx-auto w-full', chatColumnWidthClass)}>
                                            <div className="flex justify-end pr-2">
                                                <button
                                                    type="button"
                                                    onClick={handleScrollToBottom}
                                                    className="pointer-events-auto inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-sparkle-card/94 px-3 py-1.5 text-[11px] font-medium text-sparkle-text-secondary shadow-[0_10px_28px_rgba(0,0,0,0.22)] backdrop-blur-md transition-colors hover:border-white/20 hover:bg-sparkle-card hover:text-sparkle-text"
                                                >
                                                    <ChevronDown size={12} />
                                                    <span>Bottom</span>
                                                </button>
                                            </div>
                                        </div>
                                    )}

                                    <div className={cn('relative mx-auto w-full transition-all duration-500 ease-in-out', chatColumnWidthClass)}>
                                        {hasPendingActionPanel && (
                                            <div className={cn(
                                                'mb-3 overflow-hidden rounded-2xl border border-white/10 bg-sparkle-card shadow-[0_10px_30px_rgba(0,0,0,0.16)]',
                                                isDockMode ? 'p-3' : 'p-4'
                                            )}>
                                                {activePendingApproval && (
                                                    <div className="space-y-3">
                                                        <div className="flex items-start justify-between gap-3">
                                                            <div>
                                                                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-amber-200">Pending approval</p>
                                                                <p className={cn('mt-1 font-medium text-sparkle-text', isDockMode ? 'text-[13px]' : 'text-sm')}>
                                                                    {activePendingApprovalSummary || 'The assistant needs permission to continue this turn.'}
                                                                </p>
                                                                <p className="mt-1 text-[11px] text-sparkle-text-secondary">
                                                                    {unresolvedApprovals.length} approval{unresolvedApprovals.length === 1 ? '' : 's'} waiting
                                                                </p>
                                                            </div>
                                                            <Shield size={16} className="mt-0.5 shrink-0 text-amber-300" />
                                                        </div>
                                                        <div className="flex flex-wrap items-center gap-2">
                                                            <button
                                                                type="button"
                                                                onClick={() => void handleRespondApproval(activePendingApproval.requestId, 'acceptForSession')}
                                                                className="rounded-lg border border-emerald-400/35 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-100 transition-colors hover:bg-emerald-500/18"
                                                            >
                                                                Approve
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => void handleRespondApproval(activePendingApproval.requestId, 'decline')}
                                                                className="rounded-lg border border-rose-400/35 bg-rose-500/10 px-3 py-1.5 text-xs font-semibold text-rose-100 transition-colors hover:bg-rose-500/18"
                                                            >
                                                                Decline
                                                            </button>
                                                        </div>
                                                    </div>
                                                )}

                                                {!activePendingApproval && activePendingUserInput && activePendingProgress && (
                                                    <div className="space-y-3">
                                                        <div className="flex items-start justify-between gap-3">
                                                            <div>
                                                                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--accent-primary)]">Need your input</p>
                                                                <p className={cn('mt-1 font-medium text-sparkle-text', isDockMode ? 'text-[13px]' : 'text-sm')}>
                                                                    {activePendingProgress.activeQuestion?.question}
                                                                </p>
                                                                <p className="mt-1 text-[11px] text-sparkle-text-secondary">
                                                                    Question {activePendingProgress.questionIndex + 1} of {activePendingUserInput.questions.length}
                                                                </p>
                                                            </div>
                                                            {activeTelemetryTurnId && (
                                                                <span className="rounded-full border border-white/10 bg-white/[0.03] px-2 py-1 text-[10px] font-medium text-sparkle-text-secondary">
                                                                    linked to live turn
                                                                </span>
                                                            )}
                                                        </div>

                                                        <div className="grid gap-2">
                                                            {activePendingProgress.activeQuestion?.options.map((option) => {
                                                                const isSelected = activePendingProgress.selectedOptionLabel === option.label && !activePendingProgress.usingCustomAnswer
                                                                return (
                                                                    <button
                                                                        key={`${activePendingProgress.activeQuestion?.id}:${option.label}`}
                                                                        type="button"
                                                                        onClick={() => handlePendingUserInputSelectOption(activePendingProgress.activeQuestion!.id, option.label)}
                                                                        className={cn(
                                                                            'rounded-xl border px-3 py-2 text-left transition-colors',
                                                                            isSelected
                                                                                ? 'border-white/10 bg-[var(--accent-primary)]/10 text-[var(--accent-primary)]'
                                                                                : 'border-white/5 bg-white/[0.03] text-sparkle-text-secondary hover:border-white/10 hover:bg-white/[0.04] hover:text-sparkle-text'
                                                                        )}
                                                                    >
                                                                        <div className="text-xs font-semibold">{option.label}</div>
                                                                        <div className="mt-1 text-[11px] opacity-80">{option.description}</div>
                                                                    </button>
                                                                )
                                                            })}
                                                        </div>

                                                        <textarea
                                                            value={activePendingProgress.customAnswer}
                                                            onChange={(event) => {
                                                                if (!activePendingProgress.activeQuestion) return
                                                                handlePendingUserInputCustomAnswer(
                                                                    activePendingProgress.activeQuestion.id,
                                                                    event.target.value
                                                                )
                                                            }}
                                                            rows={isDockMode ? 2 : 3}
                                                            placeholder="Custom answer..."
                                                            className="w-full rounded-xl border border-white/5 bg-white/[0.03] px-3 py-2 text-sm text-sparkle-text placeholder:text-sparkle-text-muted outline-none transition-colors focus:border-white/10 focus:bg-white/[0.05]"
                                                        />

                                                        <div className="flex flex-wrap items-center justify-between gap-2">
                                                            <div className="text-[11px] text-sparkle-text-secondary">
                                                                {activePendingProgress.answeredQuestionCount} answered
                                                            </div>
                                                            <div className="flex items-center gap-2">
                                                                <button
                                                                    type="button"
                                                                    onClick={handlePendingUserInputPrevious}
                                                                    disabled={activePendingProgress.questionIndex === 0 || activePendingIsResponding}
                                                                    className="rounded-lg border border-white/5 bg-white/[0.03] px-3 py-1.5 text-xs text-sparkle-text-secondary transition-colors hover:border-white/10 hover:bg-white/[0.04] hover:text-sparkle-text disabled:cursor-not-allowed disabled:opacity-40"
                                                                >
                                                                    Previous
                                                                </button>
                                                                {!activePendingProgress.isLastQuestion ? (
                                                                    <button
                                                                        type="button"
                                                                        onClick={handlePendingUserInputNext}
                                                                        disabled={!activePendingProgress.canAdvance || activePendingIsResponding}
                                                                        className="rounded-lg border border-white/10 bg-[var(--accent-primary)]/12 px-3 py-1.5 text-xs font-semibold text-[var(--accent-primary)] transition-colors hover:bg-[var(--accent-primary)]/18 disabled:cursor-not-allowed disabled:opacity-40"
                                                                    >
                                                                        Next
                                                                    </button>
                                                                ) : (
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => {
                                                                            if (!activePendingResolvedAnswers) return
                                                                            void handleRespondUserInput(activePendingUserInput.requestId, activePendingResolvedAnswers)
                                                                        }}
                                                                        disabled={!activePendingResolvedAnswers || activePendingIsResponding}
                                                                        className="rounded-lg border border-white/10 bg-[var(--accent-primary)]/12 px-3 py-1.5 text-xs font-semibold text-[var(--accent-primary)] transition-colors hover:bg-[var(--accent-primary)]/18 disabled:cursor-not-allowed disabled:opacity-40"
                                                                    >
                                                                        {activePendingIsResponding ? 'Submitting...' : 'Submit'}
                                                                    </button>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}

                                            </div>
                                        )}

                                        <AssistantComposer
                                            onSend={handleSend}
                                            onCancelTurn={() => void handleCancelTurn()}
                                            disabled={isChatHydrating}
                                            isSending={isSending}
                                            isThinking={assistantIsWorking}
                                            isConnected={status.connected}
                                            approvalMode={status.approvalMode}
                                            activeModel={activeModel}
                                            modelOptions={modelOptions}
                                            modelsLoading={modelsLoading}
                                            modelsError={modelsError}
                                            onSelectModel={handleSelectModel}
                                            onRefreshModels={handleRefreshModels}
                                            onEnableSafeMode={() => void handleEnableSafeMode()}
                                            onRequestEnableYoloMode={() => {
                                                if (status.approvalMode !== 'yolo') {
                                                    setShowYoloConfirmModal(true)
                                                }
                                            }}
                                            activeProfile={activeProfile}
                                            phase={assistantPhase}
                                            phaseLabel={assistantPhaseLabel}
                                            compact={isDockMode}
                                        />
                                    </div>
                                </div>
                            </section>
                            {isSkillsView && (
                                <section className="flex min-w-0 flex-1 flex-col">
                                    <div className={cn(
                                        'flex items-center justify-between border-b border-white/5 bg-sparkle-card',
                                        isDockMode ? 'gap-2 px-3 py-2' : 'gap-3 px-4 py-2.5'
                                    )}>
                                        <div className="min-w-0 flex-1">
                                            <div className={cn('flex items-center', isDockMode ? 'gap-1.5' : 'gap-2')}>
                                                <MessageSquare size={isDockMode ? 14 : 15} className="text-sparkle-text-secondary" />
                                                <h2 className={cn('truncate font-semibold text-sparkle-text', isDockMode ? 'text-xs' : 'text-sm')}>Skills</h2>
                                            </div>
                                            <p className={cn('mt-1 truncate text-sparkle-text-secondary', isDockMode ? 'text-[10px]' : 'text-xs')}>
                                                Assistant capabilities and runtime status.
                                            </p>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => { void handleOpenChatFromSkills() }}
                                            className={cn(
                                                'assistant-t3-icon-button inline-flex items-center gap-2 rounded-md border border-white/10 text-sparkle-text-secondary transition-colors hover:border-white/20 hover:bg-sparkle-card-hover hover:text-sparkle-text',
                                                isDockMode ? 'h-7 w-7 justify-center p-0' : 'px-2.5 py-1.5 text-xs'
                                            )}
                                            title="Open chat"
                                        >
                                            <MessageSquarePlus size={isDockMode ? 13 : 14} />
                                            {!isDockMode && <span>Open chat</span>}
                                        </button>
                                    </div>

                                    <div className={cn('flex-1 overflow-y-auto bg-sparkle-bg', isDockMode ? 'px-3 py-3' : 'px-4 py-4')}>
                                        <div className={cn('mx-auto w-full space-y-4 animate-fadeIn', isDockMode ? 'max-w-2xl' : 'max-w-3xl')}>
                                            <div
                                                className="animate-fadeIn rounded-2xl border border-orange-400/30 bg-gradient-to-r from-orange-500/15 via-orange-400/10 to-transparent p-5"
                                                style={{ animationDelay: '30ms', animationFillMode: 'both' }}
                                            >
                                                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-orange-200">Hot pre-alpha</p>
                                                <p className="mt-2 text-sm text-sparkle-text">
                                                    All skills are currently in hot pre-alpha, so even the main dev cannot use them yet.
                                                </p>
                                            </div>

                                            <div
                                                className="animate-fadeIn rounded-2xl border border-white/10 bg-sparkle-card p-4"
                                                style={{ animationDelay: '90ms', animationFillMode: 'both' }}
                                            >
                                                <h3 className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-sparkle-text-muted">Catalog</h3>
                                                <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                                                    {['Frontend Design', 'PDF Tools', 'Remotion Workflows', 'Skill Installer', 'Sparkle Design', 'Code Review Packs'].map((name, index) => (
                                                        <div
                                                            key={name}
                                                            className="animate-fadeIn rounded-xl border border-white/10 bg-sparkle-bg/70 px-3 py-2"
                                                            style={{ animationDelay: `${120 + (index * 35)}ms`, animationFillMode: 'both' }}
                                                        >
                                                            <div className="flex items-center justify-between gap-3">
                                                                <span className="text-sm font-medium text-sparkle-text">{name}</span>
                                                                <span className="rounded-full border border-orange-400/30 bg-orange-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-orange-200">
                                                                    Locked
                                                                </span>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </section>
                            )}
                            {!isSkillsView && canUseEventConsole && !isDockMode && (
                                <aside
                                    aria-hidden={!showEventConsole}
                                    className={cn(
                                        'shrink-0 overflow-hidden bg-sparkle-bg transition-[width,opacity,transform,border-color] duration-300 ease-out',
                                        showEventConsole
                                            ? 'opacity-100 translate-x-0 border-l border-white/5'
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
                            {!isSkillsView && canUseEventConsole && isDockMode && (
                                <aside
                                    aria-hidden={!showEventConsole}
                                    className={cn(
                                        'absolute inset-y-0 right-0 z-30 overflow-hidden border-l border-white/5 bg-sparkle-bg shadow-2xl transition-[opacity,transform] duration-300 ease-out',
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
                    <div className="relative w-full max-w-xl rounded-2xl border border-white/10 bg-sparkle-card p-5 shadow-2xl">
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
                                className="w-full rounded-lg border border-white/10 bg-sparkle-bg px-3 py-2 text-left text-sm text-sparkle-text-secondary transition-colors hover:border-white/20 hover:bg-sparkle-card-hover hover:text-sparkle-text"
                            >
                                Send in this session directory
                            </button>
                            <button
                                type="button"
                                onClick={() => void runCrossDirSendAction('switch-session-ui-dir')}
                                className="w-full rounded-lg border border-white/10 bg-sparkle-bg px-3 py-2 text-left text-sm text-sparkle-text-secondary transition-colors hover:border-white/20 hover:bg-sparkle-card-hover hover:text-sparkle-text"
                            >
                                Switch this session to current directory
                            </button>
                        </div>
                        <div className="mt-3 flex justify-end">
                            <button
                                type="button"
                                onClick={() => clearCrossDirSendState(false)}
                                className="rounded-lg border border-white/10 bg-sparkle-bg px-3 py-1.5 text-xs font-medium text-sparkle-text-secondary transition-colors hover:border-white/20 hover:bg-sparkle-card-hover hover:text-sparkle-text"
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
                    <div className="relative w-full max-w-2xl rounded-2xl border border-white/10 bg-sparkle-card p-5 shadow-2xl">
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
                                                    : 'border-white/5 bg-sparkle-bg/40 text-sparkle-text-secondary hover:border-white/20 hover:bg-sparkle-card-hover/60 hover:text-sparkle-text'
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
                                <div className="rounded-lg border border-white/10 bg-sparkle-bg/40 px-3 py-3 text-sm text-sparkle-text-secondary">
                                    No recent paths yet.
                                </div>
                            )}
                        </div>
                        <div className="mt-4 flex items-center justify-between gap-2">
                            <button
                                type="button"
                                onClick={() => setShowProjectSelectorModal(false)}
                                className="rounded-lg border border-white/10 bg-sparkle-bg px-3 py-1.5 text-xs font-medium text-sparkle-text-secondary transition-colors hover:border-white/20 hover:bg-sparkle-card-hover hover:text-sparkle-text"
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
