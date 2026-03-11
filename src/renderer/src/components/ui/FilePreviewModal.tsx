/**
 * FilePreviewModal - Reusable modal for previewing files
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { Terminal as XtermTerminal } from 'xterm'
import { FitAddon } from 'xterm-addon-fit'
import { WebLinksAddon } from 'xterm-addon-web-links'
import 'xterm/css/xterm.css'
import { useSettings } from '@/lib/settings'
import { cn } from '@/lib/utils'
import type { DevScopePreviewTerminalSessionSummary } from '@shared/contracts/devscope-api'
import { summarizeGitDiff, type GitDiffSummary, type GitLineMarker } from './file-preview/gitDiff'
import type { PreviewFile, PreviewMediaItem, PreviewMeta, PreviewOpenOptions } from './file-preview/types'
import PreviewBody from './file-preview/PreviewBody'
import PreviewErrorBoundary from './file-preview/PreviewErrorBoundary'
import PreviewModalHeader from './file-preview/PreviewModalHeader'
import { isMediaPreviewType } from './file-preview/utils'
import { VIEWPORT_PRESETS, type ViewportPreset } from './file-preview/viewport'
import { useFilePreview } from './file-preview/useFilePreview'
import { navigateMarkdownLink } from './markdown/linkNavigation'

interface FilePreviewModalProps extends PreviewMeta {
    file: PreviewFile
    content: string
    loading?: boolean
    projectPath?: string
    onOpenLinkedPreview?: (
        file: { name: string; path: string },
        ext: string,
        options?: PreviewOpenOptions
    ) => Promise<void>
    mediaItems?: PreviewMediaItem[]
    onSaved?: (filePath: string) => Promise<void> | void
    onClose: () => void
}

type PendingIntent = 'close' | 'preview'
type OutlineItem = { label: string; line: number; kind: 'function' | 'class' | 'heading' }
type LocalDiffPreview = {
    additions: number
    deletions: number
    markers: GitLineMarker[]
}
type PythonOutputSource = 'stdout' | 'stderr' | 'system'
type PythonOutputEntry = {
    id: number
    source: PythonOutputSource
    text: string
    at: number
}
type PreviewTerminalSessionItem = DevScopePreviewTerminalSessionSummary & {
    hasUnreadOutput?: boolean
}
type PreviewTerminalState = 'idle' | 'connecting' | 'active' | 'exited' | 'error'
type TerminalPanelPhase = 'hidden' | 'entering' | 'visible' | 'exiting'

const LEFT_PANEL_MIN_WIDTH = 260
const LEFT_PANEL_MAX_WIDTH = 460
const RIGHT_PANEL_MIN_WIDTH = 240
const RIGHT_PANEL_MAX_WIDTH = 520
const PYTHON_OUTPUT_MAX_CHARS = 200_000
const PYTHON_OUTPUT_MIN_HEIGHT = 96
const PREVIEW_TERMINAL_MIN_HEIGHT = 140
const TERMINAL_PANEL_ANIMATION_MS = 220

function countLines(value: string): number {
    if (!value) return 0
    return value.split(/\r?\n/).length
}

function createPythonPreviewSessionId(): string {
    return `py-prev-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

function createPreviewTerminalSessionId(): string {
    return `preview-term-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

function readCssVariable(name: string, fallback: string): string {
    if (typeof window === 'undefined') return fallback
    const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
    return value || fallback
}

function formatRelativeActivity(timestamp: number): string {
    const deltaMs = Math.max(0, Date.now() - timestamp)
    const seconds = Math.floor(deltaMs / 1000)
    if (seconds < 60) return `${seconds}s`
    const minutes = Math.floor(seconds / 60)
    if (minutes < 60) return `${minutes}m`
    const hours = Math.floor(minutes / 60)
    return `${hours}h`
}

function mapTerminalStatusToState(status?: string | null): PreviewTerminalState {
    if (status === 'running') return 'active'
    if (status === 'error') return 'error'
    if (status === 'exited') return 'exited'
    return 'idle'
}

function isEditableFileType(fileType: PreviewFile['type']): boolean {
    return fileType === 'md'
        || fileType === 'json'
        || fileType === 'csv'
        || fileType === 'code'
        || fileType === 'text'
        || fileType === 'html'
}

function extractOutlineItems(content: string, fileType: PreviewFile['type']): OutlineItem[] {
    const lines = content.split(/\r?\n/)
    const items: OutlineItem[] = []
    const pushItem = (item: OutlineItem) => {
        if (items.length >= 120) return
        items.push(item)
    }

    for (let index = 0; index < lines.length; index += 1) {
        const line = lines[index] || ''
        const trimmed = line.trim()
        if (!trimmed) continue

        const headingMatch = /^(#{1,4})\s+(.+)$/.exec(trimmed)
        if (headingMatch && (fileType === 'md' || fileType === 'text')) {
            pushItem({ label: headingMatch[2].trim(), line: index + 1, kind: 'heading' })
            continue
        }

        const classMatch = /^(?:export\s+)?(?:default\s+)?class\s+([A-Za-z0-9_$]+)/.exec(trimmed)
        if (classMatch) {
            pushItem({ label: classMatch[1], line: index + 1, kind: 'class' })
            continue
        }

        const fnMatch = /^(?:export\s+)?(?:async\s+)?function\s+([A-Za-z0-9_$]+)/.exec(trimmed)
            || /^(?:const|let|var)\s+([A-Za-z0-9_$]+)\s*=\s*(?:async\s*)?(?:\([^)]*\)|[A-Za-z0-9_$]+)\s*=>/.exec(trimmed)
            || /^([A-Za-z0-9_$]+)\s*\([^)]*\)\s*\{?$/.exec(trimmed)
        if (fnMatch) {
            pushItem({ label: fnMatch[1], line: index + 1, kind: 'function' })
            continue
        }
    }

    return items
}

function buildLocalDiffPreview(previousContent: string, nextContent: string): LocalDiffPreview {
    const previousLines = previousContent.split(/\r?\n/)
    const nextLines = nextContent.split(/\r?\n/)

    let prefix = 0
    const minLength = Math.min(previousLines.length, nextLines.length)
    while (prefix < minLength && previousLines[prefix] === nextLines[prefix]) {
        prefix += 1
    }

    let suffix = 0
    while (
        suffix < (previousLines.length - prefix)
        && suffix < (nextLines.length - prefix)
        && previousLines[previousLines.length - 1 - suffix] === nextLines[nextLines.length - 1 - suffix]
    ) {
        suffix += 1
    }

    const removedCount = Math.max(0, previousLines.length - prefix - suffix)
    const addedCount = Math.max(0, nextLines.length - prefix - suffix)
    const markers: GitLineMarker[] = []

    if (addedCount > 0 && removedCount > 0) {
        for (let index = 0; index < addedCount; index += 1) {
            markers.push({ line: prefix + index + 1, type: 'modified' })
        }
    } else if (addedCount > 0) {
        for (let index = 0; index < addedCount; index += 1) {
            markers.push({ line: prefix + index + 1, type: 'added' })
        }
    } else if (removedCount > 0) {
        markers.push({ line: Math.max(1, prefix + 1), type: 'deleted' })
    }

    return {
        additions: addedCount,
        deletions: removedCount,
        markers
    }
}

export function FilePreviewModal({
    file,
    content,
    loading,
    truncated,
    size,
    previewBytes,
    modifiedAt,
    projectPath,
    onOpenLinkedPreview,
    mediaItems = [],
    onSaved,
    onClose
}: FilePreviewModalProps) {
    const navigate = useNavigate()
    const { settings, updateSettings } = useSettings()
    const isCsv = file.type === 'csv'
    const isHtml = file.type === 'html'
    const canEdit = isEditableFileType(file.type)
    const defaultMode: 'preview' | 'edit' = canEdit ? settings.filePreviewDefaultMode : 'preview'
    const initialMode: 'preview' | 'edit' = file.startInEditMode && canEdit ? 'edit' : defaultMode
    const defaultStartExpanded = settings.filePreviewOpenInFullscreen
    const defaultLeftPanelOpen = settings.filePreviewFullscreenShowLeftPanel
    const defaultRightPanelOpen = settings.filePreviewFullscreenShowRightPanel
    const canRunPython = (
        file.type === 'code'
        && (
            file.language === 'python'
            || /\.py$/i.test(file.name)
            || /\.py$/i.test(file.path)
        )
    )
    const canUsePreviewTerminal = Boolean(projectPath || file.path)
    const openMediaItem = useCallback(async (item: PreviewMediaItem) => {
        if (!onOpenLinkedPreview) return
        await onOpenLinkedPreview(
            { name: item.name, path: item.path },
            item.extension,
            {
                mediaItems: mediaItems.map(({ name, path, extension }) => ({ name, path, extension }))
            }
        )
    }, [mediaItems, onOpenLinkedPreview])

    const [viewport, setViewport] = useState<ViewportPreset>('responsive')
    const [htmlViewMode, setHtmlViewMode] = useState<'rendered' | 'code'>('rendered')
    const [mode, setMode] = useState<'preview' | 'edit'>('preview')
    const [isExpanded, setIsExpanded] = useState(false)
    const [leftPanelOpen, setLeftPanelOpen] = useState(true)
    const [rightPanelOpen, setRightPanelOpen] = useState(false)
    const [leftPanelWidth, setLeftPanelWidth] = useState(260)
    const [rightPanelWidth, setRightPanelWidth] = useState(288)
    const [isResizingPanels, setIsResizingPanels] = useState(false)
    const [csvDistinctColorsEnabled, setCsvDistinctColorsEnabled] = useState(true)
    const [gitDiffText, setGitDiffText] = useState<string>('No changes')
    const [gitDiffSummary, setGitDiffSummary] = useState<GitDiffSummary | null>(null)
    const [sourceContent, setSourceContent] = useState(content)
    const [draftContent, setDraftContent] = useState(content)
    const [loadingEditableContent, setLoadingEditableContent] = useState(false)
    const [hasLoadedEditableContent, setHasLoadedEditableContent] = useState(!truncated)
    const [isSaving, setIsSaving] = useState(false)
    const [saveError, setSaveError] = useState<string | null>(null)
    const [showUnsavedModal, setShowUnsavedModal] = useState(false)
    const [pendingIntent, setPendingIntent] = useState<PendingIntent | null>(null)
    const [gitSummaryRefreshToken, setGitSummaryRefreshToken] = useState(0)
    const [fileModifiedAt, setFileModifiedAt] = useState<number | null>(typeof modifiedAt === 'number' ? modifiedAt : null)
    const [conflictModifiedAt, setConflictModifiedAt] = useState<number | null>(null)

    const [editorWordWrap, setEditorWordWrap] = useState<'on' | 'off'>('off')
    const [editorMinimapEnabled, setEditorMinimapEnabled] = useState(true)
    const [editorFontSize, setEditorFontSize] = useState(13)
    const [findRequestToken, setFindRequestToken] = useState(0)
    const [replaceRequestToken, setReplaceRequestToken] = useState(0)
    const [focusLine, setFocusLine] = useState<number | null>(null)
    const [pythonSessionId, setPythonSessionId] = useState(() => createPythonPreviewSessionId())
    const [pythonRunState, setPythonRunState] = useState<'idle' | 'running' | 'success' | 'failed' | 'stopped'>('idle')
    const [pythonRunMode, setPythonRunMode] = useState<'terminal' | 'output'>(settings.filePreviewPythonRunMode)
    const [pythonOutputEntries, setPythonOutputEntries] = useState<PythonOutputEntry[]>([])
    const [pythonInterpreter, setPythonInterpreter] = useState('')
    const [pythonCommand, setPythonCommand] = useState('')
    const [pythonStopRequested, setPythonStopRequested] = useState(false)
    const [pythonOutputVisible, setPythonOutputVisible] = useState(false)
    const [pythonOutputHeight, setPythonOutputHeight] = useState(160)
    const [pythonShowTimestamps, setPythonShowTimestamps] = useState(false)
    const [isResizingPythonOutput, setIsResizingPythonOutput] = useState(false)
    const [terminalVisible, setTerminalVisible] = useState(false)
    const [terminalSessions, setTerminalSessions] = useState<PreviewTerminalSessionItem[]>([])
    const [terminalState, setTerminalState] = useState<PreviewTerminalState>('idle')
    const [terminalPanelPhase, setTerminalPanelPhase] = useState<TerminalPanelPhase>('hidden')
    const [terminalSessionId, setTerminalSessionId] = useState('')
    const [terminalGroupKey, setTerminalGroupKey] = useState('')
    const [terminalGroupCwd, setTerminalGroupCwd] = useState('')
    const [terminalHeight, setTerminalHeight] = useState(() =>
        Math.max(PREVIEW_TERMINAL_MIN_HEIGHT, Math.min(720, Math.round(settings.filePreviewTerminalPanelHeight || 220)))
    )
    const [isResizingTerminal, setIsResizingTerminal] = useState(false)
    const [terminalError, setTerminalError] = useState<string | null>(null)
    const [pendingTerminalCommand, setPendingTerminalCommand] = useState<string | null>(null)
    const [terminalShellLabel, setTerminalShellLabel] = useState(settings.defaultShell === 'cmd' ? 'CMD' : 'PowerShell')
    const [terminalSessionCwd, setTerminalSessionCwd] = useState(projectPath || file.path || '')
    const panelResizeRef = useRef<{ side: 'left' | 'right'; startX: number; startWidth: number } | null>(null)
    const outputResizeRef = useRef<{ startY: number; startHeight: number } | null>(null)
    const terminalResizeRef = useRef<{ startY: number; startHeight: number } | null>(null)
    const previewSurfaceRef = useRef<HTMLDivElement | null>(null)
    const pythonOutputScrollRef = useRef<HTMLDivElement | null>(null)
    const terminalHostRef = useRef<HTMLDivElement | null>(null)
    const xtermRef = useRef<XtermTerminal | null>(null)
    const fitAddonRef = useRef<FitAddon | null>(null)
    const terminalHydratedSessionIdRef = useRef('')
    const pythonOutputSequenceRef = useRef(1)
    const pythonSessionIdRef = useRef(pythonSessionId)
    const terminalSessionIdRef = useRef(terminalSessionId)

    const isDirty = draftContent !== sourceContent
    const totalFileLines = countLines(mode === 'edit' ? draftContent : sourceContent)
    const presetConfig = VIEWPORT_PRESETS[viewport]
    const isCompactHtmlViewport = isHtml && viewport !== 'responsive' && presetConfig.width <= 768
    const shouldShowTerminalPanel = canUsePreviewTerminal && terminalVisible
    const renderTerminalPanel = terminalPanelPhase !== 'hidden'
    const currentTerminalSession = terminalSessions.find((session) => session.sessionId === terminalSessionId) || null
    const previewResetKey = isMediaPreviewType(file.type)
        ? `media:${viewport}:${htmlViewMode}:${mode}`
        : `${file.path}:${file.type}:${viewport}:${htmlViewMode}:${mode}`
    const terminalTheme = useMemo(() => {
        const accent = readCssVariable('--accent-primary', settings.accentColor.primary || '#38bdf8')
        const card = readCssVariable('--color-card', '#0b1220')
        const bg = readCssVariable('--color-bg', '#020617')
        const text = '#e5e7eb'
        const textSecondary = '#94a3b8'
        const borderSecondary = readCssVariable('--color-border-secondary', '#334155')
        return {
            background: card,
            foreground: text,
            cursor: accent,
            cursorAccent: card,
            selectionBackground: `${accent}33`,
            black: bg,
            brightBlack: borderSecondary,
            red: '#f87171',
            brightRed: '#fca5a5',
            green: '#4ade80',
            brightGreen: '#86efac',
            yellow: '#facc15',
            brightYellow: '#fde047',
            blue: '#60a5fa',
            brightBlue: '#93c5fd',
            magenta: '#c084fc',
            brightMagenta: '#e9d5ff',
            cyan: '#22d3ee',
            brightCyan: '#67e8f9',
            white: textSecondary,
            brightWhite: text
        }
    }, [settings.accentColor.primary, settings.theme])

    useEffect(() => {
        const originalOverflow = document.body.style.overflow
        document.body.style.overflow = 'hidden'
        return () => {
            document.body.style.overflow = originalOverflow
        }
    }, [])

    useEffect(() => {
        pythonSessionIdRef.current = pythonSessionId
    }, [pythonSessionId])

    useEffect(() => {
        terminalSessionIdRef.current = terminalSessionId
    }, [terminalSessionId])

    useEffect(() => {
        if (!xtermRef.current) return
        xtermRef.current.options.theme = terminalTheme
    }, [terminalTheme])

    useEffect(() => {
        const normalizedHeight = Math.max(PREVIEW_TERMINAL_MIN_HEIGHT, Math.min(720, Math.round(terminalHeight)))
        if (settings.filePreviewTerminalPanelHeight === normalizedHeight) return
        const timer = window.setTimeout(() => {
            updateSettings({ filePreviewTerminalPanelHeight: normalizedHeight })
        }, 150)
        return () => window.clearTimeout(timer)
    }, [settings.filePreviewTerminalPanelHeight, terminalHeight, updateSettings])

    useEffect(() => {
        setViewport('responsive')
        setHtmlViewMode(initialMode === 'edit' && isHtml ? 'code' : 'rendered')
        setMode(initialMode)
        setIsExpanded(defaultStartExpanded)
        setLeftPanelOpen(defaultLeftPanelOpen)
        setRightPanelOpen(defaultRightPanelOpen)
        setSourceContent(content)
        setDraftContent(content)
        setHasLoadedEditableContent(!truncated)
        setLoadingEditableContent(false)
        setSaveError(null)
        setShowUnsavedModal(false)
        setPendingIntent(null)
        setFileModifiedAt(typeof modifiedAt === 'number' ? modifiedAt : null)
        setConflictModifiedAt(null)
        setEditorWordWrap('off')
        setEditorMinimapEnabled(true)
        setEditorFontSize(13)
        setFindRequestToken(0)
        setReplaceRequestToken(0)
        setFocusLine(null)
        setPythonSessionId(createPythonPreviewSessionId())
        setPythonRunState('idle')
        setPythonRunMode(settings.filePreviewPythonRunMode)
        setPythonOutputEntries([])
        setPythonInterpreter('')
        setPythonCommand('')
        setPythonStopRequested(false)
        setPythonOutputVisible(false)
        setPythonOutputHeight(160)
        setPythonShowTimestamps(false)
        setTerminalVisible(false)
        setTerminalSessions([])
        setTerminalState('idle')
        setTerminalSessionId('')
        setTerminalGroupKey('')
        setTerminalGroupCwd('')
        setTerminalHeight(Math.max(
            PREVIEW_TERMINAL_MIN_HEIGHT,
            Math.min(720, Math.round(settings.filePreviewTerminalPanelHeight || 220))
        ))
        setIsResizingTerminal(false)
        setTerminalError(null)
        setPendingTerminalCommand(null)
        setTerminalShellLabel(settings.defaultShell === 'cmd' ? 'CMD' : 'PowerShell')
        setTerminalSessionCwd(projectPath || file.path || '')
        pythonOutputSequenceRef.current = 1
    }, [
        content,
        defaultLeftPanelOpen,
        defaultRightPanelOpen,
        defaultStartExpanded,
        file.path,
        file.startInEditMode,
        initialMode,
        isHtml,
        modifiedAt,
        projectPath,
        settings.defaultShell,
        truncated
    ])

    useEffect(() => {
        if (isDirty || mode === 'edit') return
        const incomingModifiedAt = typeof modifiedAt === 'number' ? modifiedAt : null
        const hasKnownLocalVersion = typeof fileModifiedAt === 'number'
        const isIncomingOlderThanLocal = (
            incomingModifiedAt !== null
            && hasKnownLocalVersion
            && incomingModifiedAt < (fileModifiedAt - 1)
        )

        // Ignore stale payloads from slower parent refreshes so freshly saved edits stay visible.
        if (isIncomingOlderThanLocal) return

        const shouldUpdateSource = content !== sourceContent
        const shouldUpdateDraft = !isDirty && draftContent !== content
        const shouldUpdateVersion = incomingModifiedAt !== null && incomingModifiedAt !== fileModifiedAt

        if (shouldUpdateSource) setSourceContent(content)
        if (shouldUpdateDraft) setDraftContent(content)
        if (shouldUpdateVersion) setFileModifiedAt(incomingModifiedAt)
    }, [content, draftContent, fileModifiedAt, isDirty, mode, modifiedAt, sourceContent])

    const commitPendingIntent = useCallback(() => {
        if (pendingIntent === 'close') {
            onClose()
        } else if (pendingIntent === 'preview') {
            setMode('preview')
        }
        setPendingIntent(null)
    }, [onClose, pendingIntent])

    const handleInternalMarkdownLink = useCallback(async (href: string) => {
        await navigateMarkdownLink({
            href,
            filePath: file.path,
            navigate,
            openPreview: onOpenLinkedPreview
        })
    }, [file.path, navigate, onOpenLinkedPreview])

    const handleSave = useCallback(async () => {
        if (!canEdit || isSaving || !isDirty || !file.path) return true

        setIsSaving(true)
        setSaveError(null)
        try {
            const result = await window.devscope.writeTextFile(
                file.path,
                draftContent,
                typeof fileModifiedAt === 'number' ? fileModifiedAt : undefined
            )
            if (!result?.success) {
                const maybeConflict = result && 'conflict' in result ? result : null
                if (maybeConflict?.conflict) {
                    setConflictModifiedAt(
                        typeof maybeConflict.currentModifiedAt === 'number'
                            ? maybeConflict.currentModifiedAt
                            : Date.now()
                    )
                    setSaveError('File changed on disk. Review and choose reload or overwrite.')
                    return false
                }
                setSaveError(result?.error || 'Failed to save file changes.')
                return false
            }

            setSourceContent(draftContent)
            setHasLoadedEditableContent(true)
            setFileModifiedAt(typeof result.modifiedAt === 'number' ? result.modifiedAt : Date.now())
            setConflictModifiedAt(null)
            setGitSummaryRefreshToken((current) => current + 1)
            if (typeof onSaved === 'function') {
                void Promise.resolve(onSaved(file.path)).catch((error) => {
                    console.warn('Post-save refresh failed:', error)
                })
            }
            return true
        } catch (error: any) {
            setSaveError(error?.message || 'Failed to save file changes.')
            return false
        } finally {
            setIsSaving(false)
        }
    }, [canEdit, draftContent, file.path, fileModifiedAt, isDirty, isSaving, onSaved])

    const ensureEditableContentLoaded = useCallback(async () => {
        if (!canEdit || hasLoadedEditableContent || !file.path) return true

        setLoadingEditableContent(true)
        setSaveError(null)
        try {
            const result = await window.devscope.readTextFileFull(file.path)
            if (!result?.success) {
                setSaveError(result?.error || 'Failed to load full file for editing.')
                return false
            }
            const fullContent = String(result.content || '')
            setSourceContent(fullContent)
            setDraftContent(fullContent)
            setHasLoadedEditableContent(true)
            setFileModifiedAt(typeof result.modifiedAt === 'number' ? result.modifiedAt : Date.now())
            setConflictModifiedAt(null)
            return true
        } catch (error: any) {
            setSaveError(error?.message || 'Failed to load full file for editing.')
            return false
        } finally {
            setLoadingEditableContent(false)
        }
    }, [canEdit, file.path, hasLoadedEditableContent])

    useEffect(() => {
        if (mode !== 'edit') return
        if (!canEdit) return
        if (hasLoadedEditableContent || loadingEditableContent) return
        void ensureEditableContentLoaded()
    }, [canEdit, ensureEditableContentLoaded, hasLoadedEditableContent, loadingEditableContent, mode])

    const reloadFromDisk = useCallback(async () => {
        if (!file.path) return false
        setLoadingEditableContent(true)
        setSaveError(null)
        try {
            const result = await window.devscope.readTextFileFull(file.path)
            if (!result?.success) {
                setSaveError(result?.error || 'Failed to reload latest file content.')
                return false
            }
            const fullContent = String(result.content || '')
            setSourceContent(fullContent)
            setDraftContent(fullContent)
            setFileModifiedAt(typeof result.modifiedAt === 'number' ? result.modifiedAt : Date.now())
            setHasLoadedEditableContent(true)
            setConflictModifiedAt(null)
            return true
        } catch (error: any) {
            setSaveError(error?.message || 'Failed to reload latest file content.')
            return false
        } finally {
            setLoadingEditableContent(false)
        }
    }, [file.path])

    const overwriteOnConflict = useCallback(async () => {
        if (!canEdit || !file.path) return false
        setIsSaving(true)
        setSaveError(null)
        try {
            const result = await window.devscope.writeTextFile(file.path, draftContent)
            if (!result?.success) {
                setSaveError(result?.error || 'Failed to overwrite file after conflict.')
                return false
            }
            setSourceContent(draftContent)
            setFileModifiedAt(typeof result.modifiedAt === 'number' ? result.modifiedAt : Date.now())
            setConflictModifiedAt(null)
            setGitSummaryRefreshToken((current) => current + 1)
            if (typeof onSaved === 'function') {
                void Promise.resolve(onSaved(file.path)).catch((error) => {
                    console.warn('Post-save refresh failed:', error)
                })
            }
            return true
        } catch (error: any) {
            setSaveError(error?.message || 'Failed to overwrite file after conflict.')
            return false
        } finally {
            setIsSaving(false)
        }
    }, [canEdit, draftContent, file.path, onSaved])

    const appendPythonOutput = useCallback((source: PythonOutputSource, chunk: string) => {
        if (!chunk) return
        setPythonOutputEntries((previous) => {
            const nextEntry: PythonOutputEntry = {
                id: pythonOutputSequenceRef.current++,
                source,
                text: chunk,
                at: Date.now()
            }
            const next = [...previous, nextEntry]

            let totalChars = next.reduce((sum, entry) => sum + entry.text.length, 0)
            while (totalChars > PYTHON_OUTPUT_MAX_CHARS && next.length > 1) {
                const removed = next.shift()
                totalChars -= removed?.text.length || 0
            }

            if (totalChars > PYTHON_OUTPUT_MAX_CHARS && next.length === 1) {
                const only = next[0]
                const keepLength = Math.max(1, PYTHON_OUTPUT_MAX_CHARS)
                next[0] = {
                    ...only,
                    text: only.text.slice(Math.max(0, only.text.length - keepLength))
                }
            }

            return next
        })
        setPythonOutputVisible(true)
    }, [])

    const stopPythonRun = useCallback(async () => {
        if (!canRunPython) return false
        if (pythonRunState !== 'running') return false

        setPythonStopRequested(true)
        const result = await window.devscope.stopPythonPreview(pythonSessionIdRef.current)
        if (!result?.success) {
            appendPythonOutput('system', `[DevScope] Failed to stop run: ${result?.error || 'Unknown error'}\n`)
            setPythonStopRequested(false)
            return false
        }
        return true
    }, [appendPythonOutput, canRunPython, pythonRunState])

    const runPythonPreviewOutput = useCallback(async () => {
        if (!canRunPython || !file.path || pythonRunState === 'running') return

        if (mode === 'edit' && isDirty) {
            const saved = await handleSave()
            if (!saved) {
                appendPythonOutput('system', '[DevScope] Save failed. Run cancelled.\n')
                return
            }
        }

        setPythonRunState('running')
        setPythonStopRequested(false)
        setPythonOutputVisible(true)
        const nextSessionId = createPythonPreviewSessionId()
        pythonSessionIdRef.current = nextSessionId
        setPythonSessionId(nextSessionId)
        appendPythonOutput('system', `[DevScope] Running ${file.name}...\n`)

        const result = await window.devscope.runPythonPreview({
            sessionId: nextSessionId,
            filePath: file.path,
            projectPath
        })

        if (!result?.success) {
            setPythonRunState('failed')
            appendPythonOutput('system', `[DevScope] Failed to start Python run: ${result?.error || 'Unknown error'}\n`)
            return
        }

        if (typeof result.interpreter === 'string') {
            setPythonInterpreter(result.interpreter)
        }
        if (typeof result.command === 'string') {
            setPythonCommand(result.command)
        }
    }, [appendPythonOutput, canRunPython, file.name, file.path, handleSave, isDirty, mode, projectPath, pythonRunState])

    const buildTerminalPythonCommand = useCallback(() => {
        if (settings.defaultShell === 'cmd') {
            const escapedPath = file.path.replace(/"/g, '""')
            return `where py >nul 2>nul && py -3 "${escapedPath}" || (where python >nul 2>nul && python "${escapedPath}" || (where python3 >nul 2>nul && python3 "${escapedPath}" || echo [DevScope] Python not found in PATH.))`
        }

        const escapedPath = file.path.replace(/'/g, "''")
        return `$__devscopePy='${escapedPath}'; if (Get-Command py -ErrorAction SilentlyContinue) { py -3 $__devscopePy } elseif (Get-Command python -ErrorAction SilentlyContinue) { python $__devscopePy } elseif (Get-Command python3 -ErrorAction SilentlyContinue) { python3 $__devscopePy } else { Write-Host '[DevScope] Python not found in PATH.' -ForegroundColor Red }`
    }, [file.path, settings.defaultShell])

    const runPythonInTerminal = useCallback(async () => {
        if (!canRunPython || !file.path) return

        if (mode === 'edit' && isDirty) {
            const saved = await handleSave()
            if (!saved) {
                appendPythonOutput('system', '[DevScope] Save failed. Run cancelled.\n')
                return
            }
        }

        const command = buildTerminalPythonCommand()
        setTerminalVisible(true)
        setPendingTerminalCommand(`${command}\r`)
    }, [appendPythonOutput, buildTerminalPythonCommand, canRunPython, file.path, handleSave, isDirty, mode])

    const handleRunPython = useCallback(async () => {
        if (pythonRunMode === 'terminal') {
            await runPythonInTerminal()
            return
        }
        await runPythonPreviewOutput()
    }, [pythonRunMode, runPythonInTerminal, runPythonPreviewOutput])

    const clearPythonOutput = useCallback(() => {
        setPythonOutputEntries([])
        setPythonOutputVisible(false)
        if (pythonRunState !== 'running') {
            setPythonRunState('idle')
        }
    }, [pythonRunState])

    const closePreviewTerminal = useCallback(async (sessionId?: string) => {
        const targetSessionId = String(sessionId || terminalSessionIdRef.current || '').trim()
        if (!targetSessionId) return
        await window.devscope.closePreviewTerminal(targetSessionId).catch(() => undefined)
    }, [])

    const refreshPreviewTerminalSessions = useCallback(async (preferredSessionId?: string) => {
        if (!canUsePreviewTerminal) {
            setTerminalSessions([])
            setTerminalSessionId('')
            setTerminalGroupKey('')
            setTerminalGroupCwd('')
            return []
        }

        const targetPath = projectPath || file.path
        const result = await window.devscope.listPreviewTerminalSessions({ targetPath })
        if (!result?.success) {
            setTerminalError(result?.error || 'Failed to load terminal sessions.')
            return []
        }

        const nextSessions = (result.sessions || []) as PreviewTerminalSessionItem[]
        setTerminalGroupKey(String(result.groupKey || ''))
        setTerminalGroupCwd(String(result.cwd || targetPath || ''))
        setTerminalSessions((current) => {
            const unreadIds = new Set(current.filter((session) => session.hasUnreadOutput).map((session) => session.sessionId))
            return nextSessions.map((session) => ({
                ...session,
                hasUnreadOutput: unreadIds.has(session.sessionId)
                    && session.sessionId !== preferredSessionId
                    && session.sessionId !== terminalSessionIdRef.current
            }))
        })

        const selectedSessionId = (
            preferredSessionId
            || terminalSessionIdRef.current
            || nextSessions.find((session) => session.status === 'running')?.sessionId
            || nextSessions[0]?.sessionId
            || ''
        )

        terminalSessionIdRef.current = selectedSessionId
        setTerminalSessionId(selectedSessionId)

        const activeSession = nextSessions.find((session) => session.sessionId === selectedSessionId) || null
        setTerminalShellLabel(
            String(activeSession?.shell || settings.defaultShell || 'terminal')
                .replace(/\.exe$/i, '')
                .replace(/^pwsh$/i, 'PowerShell')
                .replace(/^powershell$/i, 'PowerShell')
                .replace(/^cmd$/i, 'CMD')
        )
        setTerminalSessionCwd(String(activeSession?.cwd || result.cwd || targetPath || ''))
        setTerminalState(mapTerminalStatusToState(activeSession?.status))

        if (!activeSession) {
            xtermRef.current?.clear()
        }

        return nextSessions
    }, [canUsePreviewTerminal, file.path, projectPath, settings.defaultShell])

    const createPreviewTerminalSession = useCallback(async (options?: { title?: string; preferredSessionId?: string }) => {
        if (!canUsePreviewTerminal) return null

        const nextSessionId = createPreviewTerminalSessionId()
        terminalSessionIdRef.current = nextSessionId
        setTerminalSessionId(nextSessionId)
        setTerminalState('connecting')
        setTerminalError(null)

        const result = await window.devscope.createPreviewTerminal({
            sessionId: nextSessionId,
            targetPath: projectPath || file.path,
            preferredShell: settings.defaultShell,
            cols: 100,
            rows: 28,
            title: options?.title
        })

        if (!result?.success) {
            setTerminalState('error')
            setTerminalError(result?.error || 'Failed to start terminal session.')
            return null
        }

        await refreshPreviewTerminalSessions(options?.preferredSessionId || nextSessionId)
        return nextSessionId
    }, [canUsePreviewTerminal, file.path, projectPath, refreshPreviewTerminalSessions, settings.defaultShell])

    const stopPreviewTerminalSession = useCallback(async (sessionId?: string) => {
        const targetSessionId = String(sessionId || terminalSessionIdRef.current || '').trim()
        if (!targetSessionId) return

        await closePreviewTerminal(targetSessionId)
        const nextSessions = await refreshPreviewTerminalSessions(
            targetSessionId === terminalSessionIdRef.current ? undefined : terminalSessionIdRef.current
        )
        if (targetSessionId === terminalSessionIdRef.current && nextSessions.length === 0) {
            setTerminalState('idle')
            setTerminalShellLabel(settings.defaultShell === 'cmd' ? 'CMD' : 'PowerShell')
            setTerminalSessionCwd(terminalGroupCwd || projectPath || file.path || '')
            xtermRef.current?.clear()
        }
    }, [closePreviewTerminal, file.path, projectPath, refreshPreviewTerminalSessions, settings.defaultShell, terminalGroupCwd])

    const restartPreviewTerminal = useCallback(async () => {
        if (!canUsePreviewTerminal) return
        setTerminalError(null)
        setPendingTerminalCommand(null)
        xtermRef.current?.clear()
        if (!terminalVisible) {
            setTerminalVisible(true)
            return
        }

        if (terminalSessionIdRef.current) {
            await stopPreviewTerminalSession(terminalSessionIdRef.current)
        }
        await createPreviewTerminalSession()
    }, [canUsePreviewTerminal, createPreviewTerminalSession, stopPreviewTerminalSession, terminalVisible])

    const selectPreviewTerminalSession = useCallback((sessionId: string) => {
        if (!sessionId) return
        terminalSessionIdRef.current = sessionId
        setTerminalSessionId(sessionId)
        setTerminalSessions((current) => current.map((session) => (
            session.sessionId === sessionId
                ? { ...session, hasUnreadOutput: false }
                : session
        )))
    }, [])

    const disposePreviewTerminal = useCallback(() => {
        terminalHydratedSessionIdRef.current = ''
        fitAddonRef.current = null
        xtermRef.current?.dispose()
        xtermRef.current = null
    }, [])

    useEffect(() => {
        if (!terminalVisible) {
            setTerminalState('idle')
            setTerminalError(null)
            setPendingTerminalCommand(null)
            disposePreviewTerminal()
            return
        }

        if (!renderTerminalPanel) return

        if (!canUsePreviewTerminal) {
            setTerminalState('error')
            setTerminalError('No valid path available to open terminal.')
            return
        }

        if (!currentTerminalSession) {
            disposePreviewTerminal()
            return
        }

        const host = terminalHostRef.current
        if (!host) return

        let terminal = xtermRef.current
        let fitAddon = fitAddonRef.current
        if (!terminal || !fitAddon) {
            terminal = new XtermTerminal({
                cursorBlink: true,
                fontFamily: 'Consolas, "Cascadia Code", monospace',
                fontSize: Math.max(11, Number.parseInt(readCssVariable('--terminal-font-size', '14'), 10) || 14),
                convertEol: true,
                scrollback: 5000,
                allowProposedApi: true,
                theme: terminalTheme
            })
            fitAddon = new FitAddon()
            const webLinksAddon = new WebLinksAddon()
            terminal.loadAddon(fitAddon)
            terminal.loadAddon(webLinksAddon)
            terminal.open(host)
            terminal.focus()
            xtermRef.current = terminal
            fitAddonRef.current = fitAddon

            terminal.onData((data) => {
                void window.devscope.writePreviewTerminal({
                    sessionId: terminalSessionIdRef.current,
                    data
                }).catch(() => undefined)
            })
        }

        if (terminalHydratedSessionIdRef.current !== currentTerminalSession.sessionId) {
            terminal.clear()
            if (currentTerminalSession.recentOutput) {
                terminal.write(currentTerminalSession.recentOutput)
            }
            terminalHydratedSessionIdRef.current = currentTerminalSession.sessionId
        }

        const syncTerminalSize = () => {
            const activeFitAddon = fitAddonRef.current
            if (!activeFitAddon) return
            activeFitAddon.fit()
            const dimensions = activeFitAddon.proposeDimensions?.()
            if (!dimensions) return
            void window.devscope.resizePreviewTerminal({
                sessionId: terminalSessionIdRef.current,
                cols: dimensions.cols,
                rows: dimensions.rows
            }).catch(() => undefined)
        }

        const resizeObserver = new ResizeObserver(() => {
            syncTerminalSize()
        })
        resizeObserver.observe(host)
            window.addEventListener('resize', syncTerminalSize)
            const initialSyncTimer = window.setTimeout(syncTerminalSize, 0)
            const settleSyncTimer = window.setTimeout(syncTerminalSize, TERMINAL_PANEL_ANIMATION_MS + 40)

        return () => {
            resizeObserver.disconnect()
            window.removeEventListener('resize', syncTerminalSize)
            window.clearTimeout(initialSyncTimer)
            window.clearTimeout(settleSyncTimer)
        }
    }, [canUsePreviewTerminal, currentTerminalSession, disposePreviewTerminal, renderTerminalPanel, terminalTheme, terminalVisible])

    useEffect(() => {
        if (!terminalVisible || !renderTerminalPanel) return
        const unsubscribe = window.devscope.onPreviewTerminalEvent((eventPayload) => {
            if (!eventPayload?.sessionId) return

            if (eventPayload.type === 'output') {
                const outputChunk = String(eventPayload.data || '')
                setTerminalSessions((current) => current.map((session) => {
                    if (session.sessionId !== eventPayload.sessionId) return session
                    const nextRecentOutput = `${session.recentOutput || ''}${outputChunk}`.slice(-60_000)
                    const isActive = eventPayload.sessionId === terminalSessionIdRef.current
                    return {
                        ...session,
                        recentOutput: nextRecentOutput,
                        lastActivityAt: Date.now(),
                        hasUnreadOutput: isActive ? false : true
                    }
                }))

                if (eventPayload.sessionId === terminalSessionIdRef.current) {
                    xtermRef.current?.write(outputChunk)
                }
                return
            }

            if (eventPayload.type === 'started') {
                void refreshPreviewTerminalSessions(eventPayload.sessionId).then(() => {
                    if (eventPayload.sessionId === terminalSessionIdRef.current) {
                        setTerminalState('active')
                        setTerminalError(null)
                        window.setTimeout(() => xtermRef.current?.focus(), 0)
                    }
                })
                return
            }

            if (eventPayload.type === 'error') {
                const message = String(eventPayload.message || 'Terminal session error.')
                setTerminalError(message)
                void refreshPreviewTerminalSessions(eventPayload.sessionId)
                return
            }

            if (eventPayload.type === 'exit') {
                void refreshPreviewTerminalSessions(eventPayload.sessionId)
            }
        })
        return () => unsubscribe()
    }, [refreshPreviewTerminalSessions, renderTerminalPanel, terminalVisible])

    useEffect(() => {
        if (!terminalVisible || !renderTerminalPanel || !canUsePreviewTerminal) return
        let active = true

        const initialize = async () => {
            const sessions = await refreshPreviewTerminalSessions()
            if (!active) return
            if (sessions.length === 0) {
                await createPreviewTerminalSession()
            }
        }

        void initialize()
        return () => {
            active = false
        }
    }, [canUsePreviewTerminal, createPreviewTerminalSession, refreshPreviewTerminalSessions, renderTerminalPanel, terminalVisible])

    useEffect(() => {
        if (!terminalVisible || !renderTerminalPanel) return
        const activeSession = currentTerminalSession
        if (!activeSession) {
            setTerminalState('idle')
            setTerminalShellLabel(settings.defaultShell === 'cmd' ? 'CMD' : 'PowerShell')
            setTerminalSessionCwd(terminalGroupCwd || projectPath || file.path || '')
            return
        }

        setTerminalShellLabel(
            String(activeSession.shell || settings.defaultShell || 'terminal')
                .replace(/\.exe$/i, '')
                .replace(/^pwsh$/i, 'PowerShell')
                .replace(/^powershell$/i, 'PowerShell')
                .replace(/^cmd$/i, 'CMD')
        )
        setTerminalSessionCwd(activeSession.cwd || terminalGroupCwd || projectPath || file.path || '')
        setTerminalState(mapTerminalStatusToState(activeSession.status))
        setTerminalSessions((current) => {
            let changed = false
            const nextSessions = current.map((session) => {
                if (session.sessionId !== terminalSessionId || !session.hasUnreadOutput) return session
                changed = true
                return { ...session, hasUnreadOutput: false }
            })
            return changed ? nextSessions : current
        })
    }, [currentTerminalSession, file.path, projectPath, renderTerminalPanel, settings.defaultShell, terminalGroupCwd, terminalSessionId, terminalVisible])

    useEffect(() => {
        if (!terminalVisible || !renderTerminalPanel) return
        if (!currentTerminalSession) return
        if (!xtermRef.current) return
        if (terminalHydratedSessionIdRef.current === currentTerminalSession.sessionId) return

        xtermRef.current.clear()
        if (currentTerminalSession.recentOutput) {
            xtermRef.current.write(currentTerminalSession.recentOutput)
        }
        terminalHydratedSessionIdRef.current = currentTerminalSession.sessionId
        window.setTimeout(() => xtermRef.current?.focus(), 0)
    }, [currentTerminalSession?.sessionId, currentTerminalSession?.recentOutput, renderTerminalPanel, terminalVisible])

    useEffect(() => {
        if (!pendingTerminalCommand) return
        if (!terminalVisible || terminalState !== 'active' || !terminalSessionIdRef.current) return
        const commandToWrite = pendingTerminalCommand
        setPendingTerminalCommand(null)
        void window.devscope.writePreviewTerminal({
            sessionId: terminalSessionIdRef.current,
            data: commandToWrite
        }).catch((error: any) => {
            setTerminalError(error?.message || 'Failed to send command to terminal.')
        })
    }, [pendingTerminalCommand, terminalState, terminalVisible])

    useEffect(() => {
        return () => {
            disposePreviewTerminal()
        }
    }, [disposePreviewTerminal])

    const requestIntent = useCallback((intent: PendingIntent) => {
        if (!isDirty) {
            if (intent === 'close') onClose()
            else setMode('preview')
            return
        }
        setPendingIntent(intent)
        setShowUnsavedModal(true)
    }, [isDirty, onClose])

    const handleModeChange = useCallback(async (nextMode: 'preview' | 'edit') => {
        if (nextMode === mode) return

        if (nextMode === 'preview') {
            requestIntent('preview')
            return
        }

        if (!canEdit) return

        const loaded = await ensureEditableContentLoaded()
        if (!loaded) return

        if (isHtml) setHtmlViewMode('code')
        setMode('edit')
    }, [canEdit, ensureEditableContentLoaded, isHtml, mode, requestIntent])

    const handleCloseRequest = useCallback(() => {
        requestIntent('close')
    }, [requestIntent])

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'e' && canEdit) {
                e.preventDefault()
                void handleModeChange(mode === 'edit' ? 'preview' : 'edit')
                return
            }
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's' && mode === 'edit') {
                e.preventDefault()
                void handleSave()
                return
            }
            if (e.key === 'Escape') {
                e.preventDefault()
                handleCloseRequest()
            }
        }
        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [canEdit, handleCloseRequest, handleModeChange, handleSave, mode])

    useEffect(() => {
        if (!canRunPython) return

        const unsubscribe = window.devscope.onPythonPreviewEvent((eventPayload) => {
            if (!eventPayload || eventPayload.sessionId !== pythonSessionIdRef.current) return

            if (eventPayload.type === 'started') {
                setPythonRunState('running')
                setPythonStopRequested(false)
                if (typeof eventPayload.interpreter === 'string') {
                    setPythonInterpreter(eventPayload.interpreter)
                }
                if (typeof eventPayload.command === 'string') {
                    setPythonCommand(eventPayload.command)
                }
                appendPythonOutput(
                    'system',
                    `[DevScope] Process started${typeof eventPayload.pid === 'number' ? ` (pid ${eventPayload.pid})` : ''}\n`
                )
                return
            }

            if (eventPayload.type === 'stdout' || eventPayload.type === 'stderr') {
                appendPythonOutput(eventPayload.type, String(eventPayload.text || ''))
                return
            }

            if (eventPayload.type === 'error') {
                setPythonRunState('failed')
                appendPythonOutput('system', `[DevScope] ${String(eventPayload.text || 'Runtime error')}\n`)
                return
            }

            if (eventPayload.type === 'exit') {
                const wasStopped = Boolean(eventPayload.stopped) || pythonStopRequested
                if (wasStopped) {
                    setPythonRunState('stopped')
                } else if (eventPayload.code === 0) {
                    setPythonRunState('success')
                } else {
                    setPythonRunState('failed')
                }
                setPythonStopRequested(false)
                const codeLabel = typeof eventPayload.code === 'number' ? `${eventPayload.code}` : 'null'
                appendPythonOutput(
                    'system',
                    `\n[DevScope] Process exited with code ${codeLabel}${eventPayload.signal ? ` (signal ${eventPayload.signal})` : ''}\n`
                )
            }
        })

        return () => unsubscribe()
    }, [appendPythonOutput, canRunPython, pythonStopRequested])

    useEffect(() => {
        if (!canRunPython) return
        return () => {
            void window.devscope.stopPythonPreview(pythonSessionIdRef.current).catch(() => undefined)
        }
    }, [canRunPython, file.path])

    useEffect(() => {
        const outputNode = pythonOutputScrollRef.current
        if (!outputNode) return
        outputNode.scrollTop = outputNode.scrollHeight
    }, [pythonOutputEntries])

    const startPythonOutputResize = useCallback((event: { preventDefault: () => void; clientY: number }) => {
        event.preventDefault()
        outputResizeRef.current = {
            startY: event.clientY,
            startHeight: pythonOutputHeight
        }
        setIsResizingPythonOutput(true)
    }, [pythonOutputHeight])

    useEffect(() => {
        if (!isResizingPythonOutput) return

        const maxHeight = Math.max(180, Math.floor(window.innerHeight * 0.7))
        const clamp = (value: number) => Math.min(maxHeight, Math.max(PYTHON_OUTPUT_MIN_HEIGHT, value))

        const onMove = (event: MouseEvent) => {
            const resize = outputResizeRef.current
            if (!resize) return
            const delta = resize.startY - event.clientY
            setPythonOutputHeight(clamp(resize.startHeight + delta))
        }

        const stop = () => {
            outputResizeRef.current = null
            setIsResizingPythonOutput(false)
            document.body.style.cursor = ''
            document.body.style.userSelect = ''
            window.removeEventListener('mousemove', onMove)
            window.removeEventListener('mouseup', stop)
        }

        document.body.style.cursor = 'row-resize'
        document.body.style.userSelect = 'none'
        window.addEventListener('mousemove', onMove)
        window.addEventListener('mouseup', stop)

        return stop
    }, [isResizingPythonOutput])

    const startTerminalResize = useCallback((event: { preventDefault: () => void; clientY: number }) => {
        event.preventDefault()
        terminalResizeRef.current = {
            startY: event.clientY,
            startHeight: terminalHeight
        }
        setIsResizingTerminal(true)
    }, [terminalHeight])

    useEffect(() => {
        if (!isResizingTerminal) return

        const maxHeight = Math.max(220, Math.floor(window.innerHeight * 0.78))
        const clamp = (value: number) => Math.min(maxHeight, Math.max(PREVIEW_TERMINAL_MIN_HEIGHT, value))

        const onMove = (event: MouseEvent) => {
            const resize = terminalResizeRef.current
            if (!resize) return
            const delta = resize.startY - event.clientY
            setTerminalHeight(clamp(resize.startHeight + delta))
        }

        const stop = () => {
            terminalResizeRef.current = null
            setIsResizingTerminal(false)
            document.body.style.cursor = ''
            document.body.style.userSelect = ''
            window.removeEventListener('mousemove', onMove)
            window.removeEventListener('mouseup', stop)
        }

        document.body.style.cursor = 'row-resize'
        document.body.style.userSelect = 'none'
        window.addEventListener('mousemove', onMove)
        window.addEventListener('mouseup', stop)

        return stop
    }, [isResizingTerminal])

    useEffect(() => {
        if (!isExpanded) return

        const applyBodyDragState = (active: boolean) => {
            if (active) {
                document.body.style.cursor = 'col-resize'
                document.body.style.userSelect = 'none'
            } else {
                document.body.style.cursor = ''
                document.body.style.userSelect = ''
            }
        }

        const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

        const handleMouseMove = (event: MouseEvent) => {
            const resize = panelResizeRef.current
            if (!resize) return

            if (resize.side === 'left') {
                const delta = event.clientX - resize.startX
                const nextWidth = clamp(resize.startWidth + delta, LEFT_PANEL_MIN_WIDTH, LEFT_PANEL_MAX_WIDTH)
                setLeftPanelWidth(nextWidth)
                return
            }

            const delta = resize.startX - event.clientX
            const nextWidth = clamp(resize.startWidth + delta, RIGHT_PANEL_MIN_WIDTH, RIGHT_PANEL_MAX_WIDTH)
            setRightPanelWidth(nextWidth)
        }

        const stopResize = () => {
            panelResizeRef.current = null
            setIsResizingPanels(false)
            applyBodyDragState(false)
            window.removeEventListener('mousemove', handleMouseMove)
            window.removeEventListener('mouseup', stopResize)
        }

        const handleMouseDown = (event: MouseEvent) => {
            const target = event.target as HTMLElement | null
            const side = target?.dataset?.previewResizeSide
            if (side !== 'left' && side !== 'right') return

            event.preventDefault()
            panelResizeRef.current = {
                side,
                startX: event.clientX,
                startWidth: side === 'left' ? leftPanelWidth : rightPanelWidth
            }
            setIsResizingPanels(true)
            applyBodyDragState(true)
            window.addEventListener('mousemove', handleMouseMove)
            window.addEventListener('mouseup', stopResize)
        }

        window.addEventListener('mousedown', handleMouseDown)
        return () => {
            window.removeEventListener('mousedown', handleMouseDown)
            stopResize()
        }
    }, [isExpanded, leftPanelWidth, rightPanelWidth])

    useEffect(() => {
        let disposed = false

        const loadGitDiffSummary = async () => {
            if (!projectPath || !file.path) {
                if (!disposed) {
                    setGitDiffText('No changes')
                    setGitDiffSummary(null)
                }
                return
            }

            try {
                const result = await window.devscope.getWorkingDiff(projectPath, file.path, 'combined')
                if (disposed || !result?.success) {
                    if (!disposed) {
                        setGitDiffText('No changes')
                        setGitDiffSummary(null)
                    }
                    return
                }

                const rawDiff = String(result.diff || 'No changes')
                if (!disposed) {
                    setGitDiffText(rawDiff)
                    setGitDiffSummary(summarizeGitDiff(rawDiff))
                }
            } catch {
                if (!disposed) {
                    setGitDiffText('No changes')
                    setGitDiffSummary(null)
                }
            }
        }

        void loadGitDiffSummary()
        return () => {
            disposed = true
        }
    }, [projectPath, file.path, gitSummaryRefreshToken])

    const handleOpenInBrowser = async () => {
        try {
            await window.devscope.openFile(file.path)
        } catch (err) {
            console.error('Failed to open in browser:', err)
        }
    }

    const modalStyle = useMemo(() => {
        if (isExpanded) {
            return {
                width: '100%',
                maxWidth: 'none',
                maxHeight: '100%',
                height: '100%'
            }
        }
        return {
            animation: 'scaleIn 0.15s ease-out',
            width: 'min(1400px, 95vw)',
            maxWidth: '1400px',
            height: 'min(920px, 90vh)',
            maxHeight: '90vh'
        }
    }, [isExpanded])

    const activeContent = mode === 'edit' ? draftContent : sourceContent
    const showPythonOutputPanel = canRunPython && (pythonOutputVisible || pythonRunState !== 'idle')
    const hasBottomPanel = showPythonOutputPanel || renderTerminalPanel
    const centerHtmlRenderedPreview = isHtml && htmlViewMode === 'rendered' && mode === 'preview' && !hasBottomPanel
    const flushResponsiveHtmlPreview = isHtml && htmlViewMode === 'rendered' && viewport === 'responsive' && !isExpanded

    useEffect(() => {
        if (shouldShowTerminalPanel) {
            setTerminalPanelPhase((current) => (current === 'visible' ? current : 'entering'))
            const rafId = window.requestAnimationFrame(() => {
                setTerminalPanelPhase((current) => (current === 'entering' ? 'visible' : current))
            })
            return () => window.cancelAnimationFrame(rafId)
        }

        setTerminalPanelPhase((current) => {
            if (current === 'hidden') return current
            return 'exiting'
        })
        const timeoutId = window.setTimeout(() => {
            setTerminalPanelPhase((current) => (current === 'exiting' ? 'hidden' : current))
        }, TERMINAL_PANEL_ANIMATION_MS)

        return () => window.clearTimeout(timeoutId)
    }, [shouldShowTerminalPanel])

    const pythonOutputHeightPx = `${Math.max(PYTHON_OUTPUT_MIN_HEIGHT, pythonOutputHeight)}px`
    const pythonStatusClass = (
        pythonRunState === 'success'
            ? 'text-emerald-300'
            : pythonRunState === 'failed'
                ? 'text-red-300'
                : pythonRunState === 'stopped'
                    ? 'text-amber-300'
                    : pythonRunState === 'running'
                        ? 'text-sky-300'
                        : 'text-sparkle-text-secondary'
    )
    const pythonOutputPanel = showPythonOutputPanel ? (
        <div
            className="border-t border-sparkle-border bg-sparkle-card/85 backdrop-blur-sm flex flex-col"
            style={{ height: pythonOutputHeightPx }}
        >
            <div
                onMouseDown={startPythonOutputResize}
                className="group relative h-2 cursor-row-resize bg-transparent hover:bg-[var(--accent-primary)]/12 transition-colors"
                title="Resize output"
            >
                <div className="pointer-events-none absolute left-1/2 top-1/2 h-[2px] w-12 -translate-x-1/2 -translate-y-1/2 rounded-full bg-sparkle-border-secondary/70 group-hover:bg-[var(--accent-primary)]/65 transition-colors" />
            </div>
            <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-sparkle-border-secondary">
                <div className="min-w-0">
                    <div className={cn('text-xs font-medium', pythonStatusClass)}>
                        Python Run: {pythonRunState}
                    </div>
                    {(pythonInterpreter || pythonCommand) && (
                        <div className="text-[10px] text-sparkle-text-muted truncate">
                            {pythonInterpreter ? `${pythonInterpreter} | ` : ''}{pythonCommand || file.name}
                        </div>
                    )}
                </div>
                <div className="flex items-center gap-1.5">
                    <button
                        type="button"
                        onClick={() => setPythonShowTimestamps((current) => !current)}
                        className={cn(
                            'rounded-md border px-2 py-1 text-[10px] transition-colors',
                            pythonShowTimestamps
                                ? 'border-sky-400/45 bg-sky-500/12 text-sky-200'
                                : 'border-sparkle-border text-sparkle-text-secondary hover:bg-sparkle-card-hover hover:text-sparkle-text'
                        )}
                        title="Toggle timestamps"
                    >
                        Time
                    </button>
                    <button
                        type="button"
                        onClick={clearPythonOutput}
                        className="rounded-md border border-sparkle-border px-2 py-1 text-[10px] text-sparkle-text-secondary hover:bg-sparkle-card-hover hover:text-sparkle-text transition-colors"
                    >
                        Clear
                    </button>
                </div>
            </div>
            <div
                ref={pythonOutputScrollRef}
                className="flex-1 min-h-0 overflow-auto custom-scrollbar px-3 py-2 text-[11px] leading-relaxed whitespace-pre-wrap break-words font-mono"
            >
                {pythonOutputEntries.length === 0 ? (
                    <span className="text-sparkle-text-muted">[No output yet]</span>
                ) : (
                    <div className="space-y-1">
                        {pythonOutputEntries.map((entry) => (
                            <div
                                key={entry.id}
                                className={cn(
                                    entry.source === 'stderr'
                                        ? 'text-red-300'
                                        : entry.source === 'system'
                                            ? 'text-sky-300'
                                            : 'text-sparkle-text-secondary'
                                )}
                            >
                                {pythonShowTimestamps && (
                                    <span className="text-[10px] text-sparkle-text-muted mr-2">
                                        [{new Date(entry.at).toLocaleTimeString()}]
                                    </span>
                                )}
                                <span>{entry.text}</span>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    ) : null
    const terminalHeightPx = `${Math.max(PREVIEW_TERMINAL_MIN_HEIGHT, terminalHeight)}px`
    const terminalStatusDotClass = (
        terminalState === 'active'
            ? 'bg-emerald-300'
            : terminalState === 'connecting'
                ? 'bg-sky-300'
                : terminalState === 'error'
                    ? 'bg-red-300'
                    : terminalState === 'exited'
                        ? 'bg-amber-300'
                        : 'bg-sparkle-text-secondary'
    )
    const terminalPanel = renderTerminalPanel ? (
        <div
            className={cn(
                'border-t border-sparkle-border bg-sparkle-card/90 backdrop-blur-sm flex flex-col transition-[opacity,transform] ease-out',
                terminalPanelPhase === 'visible'
                    ? 'opacity-100 translate-y-0'
                    : 'opacity-0 translate-y-2 pointer-events-none'
            )}
            style={{ height: terminalHeightPx, transitionDuration: `${TERMINAL_PANEL_ANIMATION_MS}ms` }}
        >
            <div
                onMouseDown={startTerminalResize}
                className="group relative h-2 cursor-row-resize bg-transparent hover:bg-[var(--accent-primary)]/12 transition-colors"
                title="Resize terminal"
            >
                <div className="pointer-events-none absolute left-1/2 top-1/2 h-[2px] w-12 -translate-x-1/2 -translate-y-1/2 rounded-full bg-sparkle-border-secondary/70 group-hover:bg-[var(--accent-primary)]/65 transition-colors" />
            </div>
            <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-sparkle-border-secondary">
                <div className="min-w-0 flex-1">
                    <div className="text-xs font-medium text-sparkle-text flex items-center gap-1.5">
                        <span className={cn('inline-block h-2 w-2 rounded-full', terminalStatusDotClass)} />
                        <span>Terminal</span>
                        <span className="rounded-md border border-amber-400/30 bg-amber-500/10 px-1.5 py-0.5 text-[9px] uppercase tracking-[0.16em] text-amber-200">
                            Beta
                        </span>
                        <span className="rounded-md border border-sparkle-border bg-sparkle-bg/60 px-1.5 py-0.5 text-[9px] uppercase tracking-[0.16em] text-sparkle-text-muted">
                            {terminalShellLabel}
                        </span>
                        <span className="rounded-md border border-sparkle-border bg-sparkle-bg/60 px-1.5 py-0.5 text-[9px] uppercase tracking-[0.16em] text-sparkle-text-muted">
                            {terminalSessions.length} session{terminalSessions.length === 1 ? '' : 's'}
                        </span>
                        {terminalGroupKey && (
                            <span className="rounded-md border border-sparkle-border bg-sparkle-bg/60 px-1.5 py-0.5 text-[9px] uppercase tracking-[0.16em] text-sparkle-text-muted">
                                linked
                            </span>
                        )}
                    </div>
                    <div className="text-[10px] text-sparkle-text-muted truncate">
                        {terminalGroupCwd || terminalSessionCwd || projectPath || file.path}
                    </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0 rounded-lg border border-sparkle-border bg-sparkle-bg/40 p-1">
                    <button
                        type="button"
                        onClick={() => { void createPreviewTerminalSession() }}
                        className="rounded-md px-2 py-1 text-[10px] text-sparkle-text-secondary hover:bg-sparkle-card-hover hover:text-sparkle-text transition-colors"
                    >
                        New
                    </button>
                    <button
                        type="button"
                        onClick={() => xtermRef.current?.clear()}
                        className="rounded-md px-2 py-1 text-[10px] text-sparkle-text-secondary hover:bg-sparkle-card-hover hover:text-sparkle-text transition-colors"
                    >
                        Clear
                    </button>
                    <button
                        type="button"
                        onClick={() => { void restartPreviewTerminal() }}
                        disabled={!currentTerminalSession}
                        className="rounded-md px-2 py-1 text-[10px] text-sparkle-text-secondary hover:bg-sparkle-card-hover hover:text-sparkle-text transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                        Restart
                    </button>
                    <button
                        type="button"
                        onClick={() => { void stopPreviewTerminalSession() }}
                        disabled={!currentTerminalSession}
                        className="rounded-md px-2 py-1 text-[10px] text-red-300 hover:bg-red-500/10 hover:text-red-200 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                        Stop
                    </button>
                    <button
                        type="button"
                        onClick={() => setTerminalVisible(false)}
                        className="rounded-md px-2 py-1 text-[10px] text-sparkle-text-secondary hover:bg-sparkle-card-hover hover:text-sparkle-text transition-colors"
                    >
                        Minimize
                    </button>
                </div>
            </div>
            <div className="flex-1 min-h-0 p-2">
                <div className="flex h-full min-h-0 gap-2">
                    <div className="min-w-0 flex-1 rounded-md border border-sparkle-border-secondary bg-sparkle-bg/40 p-2">
                        <div className="mb-2 flex items-center justify-between gap-2">
                            <div className="min-w-0">
                                <div className="text-[11px] font-medium text-sparkle-text truncate">
                                    {currentTerminalSession?.title || (terminalSessions.length > 0 ? 'Select a terminal session' : 'No terminal session')}
                                </div>
                                <div className="text-[10px] text-sparkle-text-muted truncate">
                                    {currentTerminalSession
                                        ? (terminalSessionCwd || terminalGroupCwd || projectPath || file.path)
                                        : (terminalGroupCwd || projectPath || file.path)}
                                </div>
                            </div>
                            <div className="text-[10px] text-sparkle-text-muted shrink-0">
                                {currentTerminalSession
                                    ? `${currentTerminalSession.status} / ${formatRelativeActivity(currentTerminalSession.lastActivityAt)} ago`
                                    : ''}
                            </div>
                        </div>
                        {currentTerminalSession ? (
                            <div
                                onMouseDownCapture={() => xtermRef.current?.focus()}
                                ref={terminalHostRef}
                                className="h-[calc(100%-2.25rem)] w-full overflow-hidden rounded-md border border-sparkle-border-secondary focus-within:border-[var(--accent-primary)]/60 focus-within:shadow-[0_0_0_1px_rgba(56,189,248,0.2)]"
                                style={{ backgroundColor: terminalTheme.background }}
                            />
                        ) : (
                            <div className="flex h-[calc(100%-2.25rem)] w-full items-center justify-center rounded-md border border-dashed border-sparkle-border-secondary bg-black/15 px-6 text-center">
                                <div className="max-w-sm space-y-3">
                                    <div className="text-sm font-medium text-sparkle-text">
                                        {terminalSessions.length > 0 ? 'Choose a session to continue' : 'No terminal is open'}
                                    </div>
                                    <div className="text-xs leading-relaxed text-sparkle-text-secondary">
                                        {terminalSessions.length > 0
                                            ? 'Pick a session from the sidebar to attach it here, or start a fresh shell for this directory.'
                                            : 'Start a new shell for this file or project. The session will stay grouped here and can be managed from Tasks.'}
                                    </div>
                                    <div className="flex items-center justify-center gap-2">
                                        <button
                                            type="button"
                                            onClick={() => { void createPreviewTerminalSession() }}
                                            className="rounded-md border border-sky-400/30 bg-sky-500/10 px-3 py-1.5 text-[11px] font-medium text-sky-200 transition-colors hover:bg-sky-500/15"
                                        >
                                            New Session
                                        </button>
                                        {terminalSessions.length > 0 && (
                                            <button
                                                type="button"
                                                onClick={() => selectPreviewTerminalSession(terminalSessions[0]?.sessionId || '')}
                                                className="rounded-md border border-sparkle-border px-3 py-1.5 text-[11px] font-medium text-sparkle-text-secondary transition-colors hover:bg-sparkle-card-hover hover:text-sparkle-text"
                                            >
                                                Select First
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                    <aside className="flex w-[220px] shrink-0 flex-col rounded-md border border-sparkle-border-secondary bg-sparkle-bg/55">
                        <div className="border-b border-sparkle-border-secondary px-3 py-2">
                            <div className="text-[11px] font-medium text-sparkle-text">Session Group</div>
                            <div className="mt-1 text-[10px] text-sparkle-text-muted truncate">
                                {terminalGroupCwd || projectPath || file.path}
                            </div>
                        </div>
                        <div className="flex-1 min-h-0 overflow-auto custom-scrollbar p-2 space-y-2">
                            {terminalSessions.length === 0 ? (
                                <div className="rounded-md border border-dashed border-sparkle-border-secondary px-3 py-4 text-center text-[11px] text-sparkle-text-muted">
                                    No sessions yet
                                </div>
                            ) : terminalSessions.map((session) => {
                                const isActiveSession = session.sessionId === terminalSessionId
                                const sessionStatusClass = (
                                    session.status === 'running'
                                        ? 'bg-emerald-300'
                                        : session.status === 'error'
                                            ? 'bg-red-300'
                                            : 'bg-amber-300'
                                )
                                const sessionPreview = String(session.recentOutput || '')
                                    .trim()
                                    .split(/\r?\n/)
                                    .filter(Boolean)
                                    .slice(-1)[0] || session.cwd

                                return (
                                    <div
                                        key={session.sessionId}
                                        className={cn(
                                            'rounded-lg border p-2 transition-colors',
                                            isActiveSession
                                                ? 'border-sky-400/35 bg-sky-500/12'
                                                : 'border-sparkle-border bg-sparkle-card/60 hover:border-sparkle-border-secondary hover:bg-sparkle-card-hover/60'
                                        )}
                                    >
                                        <div className="flex items-start justify-between gap-2">
                                            <button
                                                type="button"
                                                onClick={() => selectPreviewTerminalSession(session.sessionId)}
                                                className="min-w-0 flex-1 text-left"
                                            >
                                                <div className="flex items-center gap-1.5">
                                                    <span className={cn('inline-block h-2 w-2 rounded-full shrink-0', sessionStatusClass)} />
                                                    <span className="truncate text-[11px] font-medium text-sparkle-text">
                                                        {session.title}
                                                    </span>
                                                    {session.hasUnreadOutput && !isActiveSession && (
                                                        <span className="h-1.5 w-1.5 rounded-full bg-sky-300 shrink-0" />
                                                    )}
                                                </div>
                                                <div className="mt-1 truncate text-[10px] text-sparkle-text-muted">
                                                    {session.shell.replace(/\.exe$/i, '')} · {formatRelativeActivity(session.lastActivityAt)} ago
                                                </div>
                                                <div className="mt-1 truncate text-[10px] text-sparkle-text-secondary/90">
                                                    {sessionPreview}
                                                </div>
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => { void stopPreviewTerminalSession(session.sessionId) }}
                                                className="rounded-md px-1.5 py-1 text-[10px] text-red-300 hover:bg-red-500/10 hover:text-red-200 transition-colors"
                                                title="Stop session"
                                            >
                                                Stop
                                            </button>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </aside>
                </div>
            </div>
            {terminalError && (
                <div className="px-3 pb-2 text-[10px] text-red-300 truncate">
                    {terminalError}
                </div>
            )}
        </div>
    ) : null
    const localDiffPreview = useMemo(() => {
        if (mode !== 'edit' || !isDirty) return null
        return buildLocalDiffPreview(sourceContent, draftContent)
    }, [draftContent, isDirty, mode, sourceContent])
    const outlineItems = useMemo(() => extractOutlineItems(activeContent, file.type), [activeContent, file.type])
    const longLineCount = useMemo(
        () => activeContent.split(/\r?\n/).filter((line) => line.length > 120).length,
        [activeContent]
    )
    const trailingWhitespaceCount = useMemo(
        () => activeContent.split(/\r?\n/).filter((line) => /[ \t]+$/.test(line)).length,
        [activeContent]
    )
    const jsonDiagnostic = useMemo(() => {
        if (file.type !== 'json') return null
        try {
            JSON.parse(activeContent)
            return { ok: true, message: 'Valid JSON structure' }
        } catch (error: any) {
            return { ok: false, message: error?.message || 'Invalid JSON syntax' }
        }
    }, [activeContent, file.type])
    const isEditorToolsEnabled = mode === 'edit'
    const getEditorToolButtonClass = (isActive = false) => cn(
        'inline-flex items-center justify-center rounded-md border px-2 py-1 text-[11px] font-medium transition-colors',
        isEditorToolsEnabled
            ? isActive
                ? 'border-sky-400/45 bg-sky-500/10 text-sky-200 hover:bg-sky-500/15'
                : 'border-sparkle-border-secondary bg-sparkle-bg text-sparkle-text-secondary hover:border-sparkle-border hover:bg-sparkle-card-hover hover:text-sparkle-text'
            : 'border-transparent bg-sparkle-bg/45 text-sparkle-text-muted/80 cursor-not-allowed opacity-70'
    )

    const handleOutlineItemSelect = useCallback((item: OutlineItem) => {
        if (mode === 'edit') {
            setFocusLine(item.line)
            return
        }

        if (file.type === 'md') {
            const root = previewSurfaceRef.current
            if (!root) return

            const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9\s_-]/g, '').replace(/\s+/g, ' ').trim()
            const targetLabel = normalize(item.label)
            const headings = Array.from(root.querySelectorAll('h1,h2,h3,h4,h5,h6')) as HTMLElement[]
            const directMatch = headings.find((heading) => normalize(heading.textContent || '') === targetLabel)
                || headings.find((heading) => normalize(heading.textContent || '').includes(targetLabel))

            if (directMatch) {
                directMatch.scrollIntoView({ block: 'center', behavior: 'smooth' })
                return
            }
        }

        setFocusLine(item.line)
    }, [file.type, mode])

    const modalContent = (
        <div
            className={cn(
                'fixed z-[80] flex transition-[background-color,padding,backdrop-filter] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]',
                isExpanded
                    ? 'top-[46px] left-0 right-0 bottom-0 z-[45] items-stretch justify-stretch bg-sparkle-bg'
                    : 'inset-0 items-center justify-center bg-black/70 backdrop-blur-md'
            )}
            onClick={isExpanded ? undefined : handleCloseRequest}
            style={isExpanded ? undefined : { animation: 'fadeIn 0.18s ease-out' }}
            onWheel={e => e.stopPropagation()}
        >
            <div
                className={cn(
                    isExpanded
                        ? 'bg-sparkle-card w-full h-full max-h-none max-w-none flex flex-col m-0 overflow-hidden rounded-none border-0 shadow-none transition-[width,max-width,height,max-height,border-radius,margin,box-shadow,border-color] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]'
                        : 'bg-sparkle-card border border-white/10 rounded-2xl shadow-2xl w-full max-w-[95vw] max-h-[90vh] flex flex-col m-4 overflow-hidden transition-[width,max-width,height,max-height,border-radius,margin,box-shadow,border-color] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]'
                )}
                onClick={isExpanded ? undefined : (e => e.stopPropagation())}
                style={modalStyle}
            >
                <PreviewModalHeader
                    file={file}
                    gitDiffSummary={gitDiffSummary}
                    totalFileLines={totalFileLines}
                    mode={mode}
                    isEditable={canEdit}
                    isDirty={isDirty}
                    isSaving={isSaving}
                    isExpanded={isExpanded}
                    leftPanelOpen={leftPanelOpen}
                    rightPanelOpen={rightPanelOpen}
                    loadingEditableContent={loadingEditableContent}
                    onModeChange={(nextMode) => { void handleModeChange(nextMode) }}
                    onSave={() => { void handleSave() }}
                    onRevert={() => {
                        setDraftContent(sourceContent)
                        setSaveError(null)
                    }}
                    onToggleExpanded={() => setIsExpanded((current) => !current)}
                    onToggleLeftPanel={() => setLeftPanelOpen((current) => !current)}
                    onToggleRightPanel={() => setRightPanelOpen((current) => !current)}
                    viewport={viewport}
                    onViewportChange={setViewport}
                    htmlViewMode={htmlViewMode}
                    onHtmlViewModeChange={setHtmlViewMode}
                    csvDistinctColorsEnabled={csvDistinctColorsEnabled}
                    onCsvDistinctColorsEnabledChange={setCsvDistinctColorsEnabled}
                    onOpenInBrowser={handleOpenInBrowser}
                    onClose={handleCloseRequest}
                    liveDiffPreview={localDiffPreview}
                    canRunPython={canRunPython}
                    pythonRunState={pythonRunState}
                    pythonHasOutput={pythonOutputEntries.length > 0}
                    pythonRunMode={pythonRunMode}
                    onRunPython={() => { void handleRunPython() }}
                    onStopPython={() => { void stopPythonRun() }}
                    onClearPythonOutput={clearPythonOutput}
                    onPythonRunModeChange={setPythonRunMode}
                    canUseTerminal={canUsePreviewTerminal}
                    terminalVisible={shouldShowTerminalPanel}
                    onToggleTerminal={() => {
                        setTerminalVisible((current) => !current)
                    }}
                />

                {saveError && (
                    <div className="mx-4 mt-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-200">
                        {saveError}
                    </div>
                )}

                {isExpanded ? (
                    <div className="flex-1 min-h-0 flex bg-sparkle-bg">
                        <aside
                            className={cn(
                                'relative shrink-0 flex flex-col gap-3 overflow-hidden transition-[width,opacity,transform,padding,border-color] ease-out',
                                isResizingPanels ? 'duration-0' : 'duration-250',
                                leftPanelOpen
                                    ? 'border-r border-sparkle-border-secondary bg-sparkle-bg p-3 opacity-100 translate-x-0'
                                    : 'w-0 border-r border-transparent bg-transparent p-0 opacity-0 -translate-x-2 pointer-events-none'
                            )}
                            style={{ width: leftPanelOpen ? `${leftPanelWidth}px` : '0px' }}
                        >
                            <div className="text-[10px] uppercase tracking-wide text-sparkle-text-muted">Workspace</div>
                            <div className="rounded-xl border border-sparkle-border bg-sparkle-card p-3 flex flex-col gap-2 min-h-0 shadow-sm">
                                <div className="text-xs font-medium text-sparkle-text">Outline</div>
                                {outlineItems.length > 0 ? (
                                    <div className="space-y-1 overflow-y-auto custom-scrollbar pr-1 flex-1 min-h-0">
                                        {outlineItems.map((item) => (
                                            <button
                                                key={`${item.kind}:${item.line}:${item.label}`}
                                                type="button"
                                                onClick={() => handleOutlineItemSelect(item)}
                                                className="flex w-full items-center gap-1.5 rounded-md border border-transparent px-2 py-1 text-left text-[11px] whitespace-nowrap transition-colors hover:border-sparkle-border hover:bg-sparkle-card-hover/60"
                                                title={`${item.label} (line ${item.line})`}
                                            >
                                                <span className="shrink-0 text-[10px] uppercase text-sparkle-text-muted">{item.kind}</span>
                                                <span className="min-w-0 flex-1 truncate text-sparkle-text-secondary">{item.label}</span>
                                                <span className="shrink-0 text-[10px] text-sparkle-text-muted">:{item.line}</span>
                                            </button>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="text-[11px] text-sparkle-text-muted">
                                        No headings or symbols detected.
                                    </div>
                                )}
                            </div>
                            <div className="rounded-xl border border-sparkle-border bg-sparkle-card p-3 shadow-sm">
                                <div className="text-xs font-medium text-sparkle-text">File Metrics</div>
                                <div className="mt-1 text-[11px] text-sparkle-text-secondary">{countLines(activeContent)} lines</div>
                                <div className="text-[11px] text-sparkle-text-secondary">{activeContent.length.toLocaleString()} chars</div>
                                <div className="text-[11px] text-sparkle-text-secondary">{longLineCount} long lines (&gt;120)</div>
                            </div>
                            <div
                                data-preview-resize-side="left"
                                className={cn(
                                    'group absolute -right-1 top-0 z-30 h-full w-3 cursor-col-resize bg-transparent transition-colors',
                                    leftPanelOpen ? 'hover:bg-[var(--accent-primary)]/14' : 'pointer-events-none'
                                )}
                                title="Resize left panel"
                            >
                                <div
                                    data-preview-resize-side="left"
                                    className={cn(
                                        'pointer-events-none absolute left-1/2 top-1/2 h-16 w-[2px] -translate-x-1/2 -translate-y-1/2 rounded-full transition-all duration-200',
                                        leftPanelOpen
                                            ? 'bg-sparkle-border-secondary/80 opacity-70 group-hover:h-24 group-hover:bg-[var(--accent-primary)]/70 group-hover:opacity-100'
                                            : 'opacity-0'
                                    )}
                                />
                            </div>
                        </aside>
                        <div
                            ref={previewSurfaceRef}
                            className={cn(
                                'flex-1 min-w-0 custom-scrollbar flex',
                                isExpanded
                                    ? (centerHtmlRenderedPreview ? 'items-center justify-center' : 'items-stretch justify-start')
                                    : mode === 'edit'
                                        ? 'items-stretch justify-center'
                                        : (centerHtmlRenderedPreview ? 'items-center justify-center' : 'items-start justify-center'),
                                isExpanded ? 'p-0' : isCompactHtmlViewport ? 'p-2 sm:p-3' : 'p-4',
                                mode === 'edit' || isCsv || (isHtml && htmlViewMode === 'code') || hasBottomPanel ? 'overflow-hidden' : 'overflow-auto'
                            )}
                            style={{ overscrollBehavior: 'contain' }}
                        >
                            <div className="w-full h-full min-h-0 flex flex-col">
                                <div className={cn(
                                    'min-h-0',
                                    hasBottomPanel ? 'flex-1' : 'h-full',
                                    hasBottomPanel && mode !== 'edit' ? 'overflow-auto custom-scrollbar' : '',
                                    centerHtmlRenderedPreview ? 'flex items-center justify-center' : ''
                                )}>
                                    <PreviewErrorBoundary resetKey={previewResetKey}>
                                        <PreviewBody
                                            file={file}
                                            content={sourceContent}
                                            loading={loading}
                                            meta={{ truncated, size, previewBytes }}
                                            projectPath={projectPath}
                                            onInternalLinkClick={handleInternalMarkdownLink}
                                            gitDiffText={gitDiffText}
                                            viewport={viewport}
                                            presetConfig={presetConfig}
                                            htmlViewMode={htmlViewMode}
                                            csvDistinctColorsEnabled={csvDistinctColorsEnabled}
                                            mode={mode}
                                            editableContent={draftContent}
                                            onEditableContentChange={(nextValue) => {
                                                setDraftContent(nextValue)
                                                if (saveError) setSaveError(null)
                                            }}
                                            isEditable={canEdit}
                                            loadingEditableContent={loadingEditableContent}
                                            editorWordWrap={editorWordWrap}
                                            editorMinimapEnabled={editorMinimapEnabled}
                                            editorFontSize={editorFontSize}
                                            findRequestToken={findRequestToken}
                                            replaceRequestToken={replaceRequestToken}
                                            focusLine={focusLine}
                                            fillEditorHeight={isExpanded && mode === 'edit'}
                                            lineMarkersOverride={localDiffPreview?.markers}
                                            previewFocusLine={focusLine}
                                            isExpanded={isExpanded}
                                            mediaItems={mediaItems}
                                            onSelectMedia={openMediaItem}
                                        />
                                    </PreviewErrorBoundary>
                                </div>
                            </div>
                        </div>
                        <aside
                            className={cn(
                                'relative shrink-0 flex flex-col gap-3 overflow-hidden transition-[width,opacity,transform,padding,border-color] ease-out',
                                isResizingPanels ? 'duration-0' : 'duration-250',
                                rightPanelOpen
                                    ? 'border-l border-sparkle-border-secondary bg-sparkle-bg p-3 opacity-100 translate-x-0'
                                    : 'w-0 border-l border-transparent bg-transparent p-0 opacity-0 translate-x-2 pointer-events-none'
                            )}
                            style={{ width: rightPanelOpen ? `${rightPanelWidth}px` : '0px' }}
                        >
                            <div className="text-[10px] uppercase tracking-wide text-sparkle-text-muted">Inspector</div>
                            <div className="rounded-xl border border-sparkle-border bg-sparkle-card p-3 shadow-sm">
                                <div className="text-xs font-medium text-sparkle-text">File</div>
                                <div className="mt-1 text-[11px] text-sparkle-text-secondary break-all">{file.path}</div>
                            </div>
                            <div className="rounded-xl border border-sparkle-border bg-sparkle-card p-3 shadow-sm">
                                <div className="text-xs font-medium text-sparkle-text">Git Snapshot</div>
                                <div className="mt-1 text-[11px] text-emerald-300">+{gitDiffSummary?.additions ?? 0}</div>
                                <div className="text-[11px] text-red-300">-{gitDiffSummary?.deletions ?? 0}</div>
                            </div>
                            <div className="rounded-xl border border-sparkle-border bg-sparkle-card p-3 shadow-sm">
                                <div className="text-xs font-medium text-sparkle-text">Edit Session</div>
                                <div className="mt-1 text-[11px] text-sparkle-text-secondary">{mode === 'edit' ? 'Editing enabled' : 'Preview mode'}</div>
                                <div className="text-[11px] text-sparkle-text-secondary">{isDirty ? 'Unsaved changes present' : 'No unsaved changes'}</div>
                            </div>
                                <div className="rounded-xl border border-sparkle-border bg-sparkle-card p-3 flex flex-col gap-2 shadow-sm">
                                    <div className="text-xs font-medium text-sparkle-text">Editor Tools</div>
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <button
                                            type="button"
                                            onClick={() => setFindRequestToken((current) => current + 1)}
                                            disabled={!isEditorToolsEnabled}
                                            className={getEditorToolButtonClass(false)}
                                        >
                                            Find
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setReplaceRequestToken((current) => current + 1)}
                                            disabled={!isEditorToolsEnabled}
                                            className={getEditorToolButtonClass(false)}
                                        >
                                            Replace
                                        </button>
                                    </div>
                                    <div className="flex items-center justify-between text-[11px] text-sparkle-text-secondary">
                                        <span>Wrap</span>
                                        <button
                                            type="button"
                                            onClick={() => setEditorWordWrap((current) => current === 'on' ? 'off' : 'on')}
                                            disabled={!isEditorToolsEnabled}
                                            className={getEditorToolButtonClass(editorWordWrap === 'on')}
                                        >
                                            {editorWordWrap === 'on' ? 'On' : 'Off'}
                                        </button>
                                    </div>
                                    <div className="flex items-center justify-between text-[11px] text-sparkle-text-secondary">
                                        <span>Minimap</span>
                                        <button
                                            type="button"
                                            onClick={() => setEditorMinimapEnabled((current) => !current)}
                                            disabled={!isEditorToolsEnabled}
                                            className={getEditorToolButtonClass(editorMinimapEnabled)}
                                        >
                                            {editorMinimapEnabled ? 'On' : 'Off'}
                                        </button>
                                    </div>
                                    <div className="flex items-center justify-between text-[11px] text-sparkle-text-secondary">
                                        <span>Font</span>
                                        <div className="flex items-center gap-1">
                                            <button
                                                type="button"
                                                onClick={() => setEditorFontSize((current) => Math.max(11, current - 1))}
                                                disabled={!isEditorToolsEnabled}
                                                className={getEditorToolButtonClass(false)}
                                            >
                                                -
                                            </button>
                                            <span className="min-w-[2rem] text-center text-sparkle-text-secondary">{editorFontSize}</span>
                                            <button
                                                type="button"
                                                onClick={() => setEditorFontSize((current) => Math.min(22, current + 1))}
                                                disabled={!isEditorToolsEnabled}
                                                className={getEditorToolButtonClass(false)}
                                            >
                                                +
                                            </button>
                                        </div>
                                    </div>
                            </div>
                            <div className="rounded-xl border border-sparkle-border bg-sparkle-card p-3 shadow-sm">
                                <div className="text-xs font-medium text-sparkle-text">Diagnostics</div>
                                <div className="mt-1 text-[11px] text-sparkle-text-secondary">Trailing whitespace lines: {trailingWhitespaceCount}</div>
                                <div className="text-[11px] text-sparkle-text-secondary">Long lines (&gt;120): {longLineCount}</div>
                                {jsonDiagnostic && (
                                    <div className={cn('text-[11px]', jsonDiagnostic.ok ? 'text-emerald-300' : 'text-amber-300')}>
                                        {jsonDiagnostic.message}
                                    </div>
                                )}
                            </div>
                            <div
                                data-preview-resize-side="right"
                                className={cn(
                                    'group absolute -left-1 top-0 z-30 h-full w-3 cursor-col-resize bg-transparent transition-colors',
                                    rightPanelOpen ? 'hover:bg-[var(--accent-primary)]/14' : 'pointer-events-none'
                                )}
                                title="Resize right panel"
                            >
                                <div
                                    data-preview-resize-side="right"
                                    className={cn(
                                        'pointer-events-none absolute left-1/2 top-1/2 h-16 w-[2px] -translate-x-1/2 -translate-y-1/2 rounded-full transition-all duration-200',
                                        rightPanelOpen
                                            ? 'bg-sparkle-border-secondary/80 opacity-70 group-hover:h-24 group-hover:bg-[var(--accent-primary)]/70 group-hover:opacity-100'
                                            : 'opacity-0'
                                    )}
                                />
                            </div>
                        </aside>
                    </div>
                ) : (
                    <div
                        ref={previewSurfaceRef}
                        className={cn(
                            'flex-1 custom-scrollbar flex items-stretch justify-center bg-sparkle-bg',
                            flushResponsiveHtmlPreview ? 'p-0' : (isCompactHtmlViewport ? 'p-2 sm:p-3' : 'p-4'),
                            mode === 'edit' || isCsv || (isHtml && htmlViewMode === 'code') || hasBottomPanel ? 'overflow-hidden' : 'overflow-auto'
                        )}
                        style={{ overscrollBehavior: 'contain' }}
                    >
                        <div className="w-full h-full min-h-0 flex flex-col">
                            <div className={cn(
                                'min-h-0',
                                hasBottomPanel ? 'flex-1' : 'h-full',
                                hasBottomPanel && mode !== 'edit' ? 'overflow-auto custom-scrollbar' : '',
                                centerHtmlRenderedPreview ? 'flex items-center justify-center' : ''
                            )}>
                                <PreviewErrorBoundary resetKey={previewResetKey}>
                                    <PreviewBody
                                        file={file}
                                        content={sourceContent}
                                        loading={loading}
                                        meta={{ truncated, size, previewBytes }}
                                        projectPath={projectPath}
                                        onInternalLinkClick={handleInternalMarkdownLink}
                                        gitDiffText={gitDiffText}
                                        viewport={viewport}
                                        presetConfig={presetConfig}
                                        htmlViewMode={htmlViewMode}
                                        csvDistinctColorsEnabled={csvDistinctColorsEnabled}
                                        mode={mode}
                                        editableContent={draftContent}
                                        onEditableContentChange={(nextValue) => {
                                            setDraftContent(nextValue)
                                            if (saveError) setSaveError(null)
                                        }}
                                        isEditable={canEdit}
                                        loadingEditableContent={loadingEditableContent}
                                        editorWordWrap={editorWordWrap}
                                        editorMinimapEnabled={editorMinimapEnabled}
                                        editorFontSize={editorFontSize}
                                        findRequestToken={findRequestToken}
                                        replaceRequestToken={replaceRequestToken}
                                        focusLine={focusLine}
                                        fillEditorHeight={false}
                                        lineMarkersOverride={localDiffPreview?.markers}
                                        previewFocusLine={focusLine}
                                        isExpanded={false}
                                        mediaItems={mediaItems}
                                        onSelectMedia={openMediaItem}
                                    />
                                </PreviewErrorBoundary>
                            </div>
                        </div>
                    </div>
                )}

                {pythonOutputPanel}
                {terminalPanel}
            </div>

            {showUnsavedModal && (
                <div
                    className="fixed inset-0 z-[90] flex items-center justify-center bg-black/50 backdrop-blur-sm px-4"
                    onClick={() => {
                        setShowUnsavedModal(false)
                        setPendingIntent(null)
                    }}
                >
                    <div
                        className="w-full max-w-md rounded-2xl border border-amber-500/30 bg-sparkle-card p-5 shadow-2xl"
                        onClick={(event) => event.stopPropagation()}
                    >
                        <h3 className="text-sm font-semibold text-sparkle-text">Save changes before leaving?</h3>
                        <p className="mt-2 text-xs text-sparkle-text-secondary">
                            You have unsaved edits in <span className="font-medium text-sparkle-text">{file.name}</span>.
                        </p>
                        <div className="mt-4 flex items-center justify-end gap-2">
                            <button
                                type="button"
                                onClick={() => {
                                    setShowUnsavedModal(false)
                                    setPendingIntent(null)
                                }}
                                className="rounded-lg border border-sparkle-border px-3 py-1.5 text-sm text-sparkle-text-secondary transition-colors hover:bg-sparkle-card-hover hover:text-sparkle-text"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    setDraftContent(sourceContent)
                                    setShowUnsavedModal(false)
                                    commitPendingIntent()
                                }}
                                className="rounded-lg border border-amber-500/35 bg-amber-500/10 px-3 py-1.5 text-sm text-amber-200 transition-colors hover:bg-amber-500/20"
                            >
                                Discard
                            </button>
                            <button
                                type="button"
                                onClick={async () => {
                                    const saved = await handleSave()
                                    if (!saved) return
                                    setShowUnsavedModal(false)
                                    commitPendingIntent()
                                }}
                                className="rounded-lg border border-emerald-500/40 bg-emerald-500/15 px-3 py-1.5 text-sm text-emerald-200 transition-colors hover:bg-emerald-500/25"
                            >
                                Save
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {conflictModifiedAt !== null && (
                <div
                    className="fixed inset-0 z-[95] flex items-center justify-center bg-black/55 backdrop-blur-sm px-4"
                    onClick={() => setConflictModifiedAt(null)}
                >
                    <div
                        className="w-full max-w-lg rounded-2xl border border-amber-500/30 bg-sparkle-card p-5 shadow-2xl"
                        onClick={(event) => event.stopPropagation()}
                    >
                        <h3 className="text-sm font-semibold text-sparkle-text">File Changed On Disk</h3>
                        <p className="mt-2 text-xs text-sparkle-text-secondary">
                            Another process updated this file after you opened it. Reload to keep disk state or overwrite with your current editor changes.
                        </p>
                        <div className="mt-4 flex items-center justify-end gap-2">
                            <button
                                type="button"
                                onClick={() => setConflictModifiedAt(null)}
                                className="rounded-lg border border-sparkle-border px-3 py-1.5 text-sm text-sparkle-text-secondary transition-colors hover:bg-sparkle-card-hover hover:text-sparkle-text"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={async () => {
                                    const reloaded = await reloadFromDisk()
                                    if (!reloaded) return
                                    setConflictModifiedAt(null)
                                }}
                                className="rounded-lg border border-amber-500/35 bg-amber-500/10 px-3 py-1.5 text-sm text-amber-200 transition-colors hover:bg-amber-500/20"
                            >
                                Reload
                            </button>
                            <button
                                type="button"
                                onClick={async () => {
                                    const overwritten = await overwriteOnConflict()
                                    if (!overwritten) return
                                    setConflictModifiedAt(null)
                                }}
                                className="rounded-lg border border-emerald-500/40 bg-emerald-500/15 px-3 py-1.5 text-sm text-emerald-200 transition-colors hover:bg-emerald-500/25"
                            >
                                Overwrite
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )

    if (typeof document === 'undefined') {
        return modalContent
    }

    return createPortal(modalContent, document.body)
}

export { useFilePreview }

export default FilePreviewModal
