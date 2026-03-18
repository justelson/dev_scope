import { useEffect, useMemo, useRef, useState } from 'react'
import type { AssistantInteractionMode, AssistantRuntimeMode } from '@shared/assistant/contracts'
import type { DevScopeGitBranchSummary } from '@shared/contracts/devscope-api'
import {
    searchMentionIndex,
    type MentionCandidate
} from './assistant-composer-mentions'
import { createAssistantComposerHandlers } from './assistant-composer-handlers'
import {
    getMentionQuery,
    normalizeMentionLookupPath,
    type InlineMentionTag
} from './assistant-composer-inline-mentions'
import { useAssistantComposerProjectData } from './useAssistantComposerProjectData'
import {
    mergeAssistantComposerPreferences,
    readAssistantComposerPreferences,
    subscribeAssistantComposerPreferences,
    type AssistantComposerPreferenceEffort
} from './assistant-composer-preferences'
import type { AssistantComposerProps, ComposerContextFile } from './assistant-composer-types'
import { getContextFileMeta, DRAFT_STORAGE_KEY } from './assistant-composer-utils'

const EFFORT_OPTIONS: AssistantComposerPreferenceEffort[] = ['low', 'medium', 'high', 'xhigh']

export const EFFORT_LABELS: Record<(typeof EFFORT_OPTIONS)[number], string> = {
    low: 'Low',
    medium: 'Medium',
    high: 'High',
    xhigh: 'Extra High'
}

const getProfileLabel = (runtimeMode: AssistantRuntimeMode) => runtimeMode === 'full-access' ? 'Full access' : 'Safe'

export function useAssistantComposerController(props: AssistantComposerProps) {
    const {
        onSend,
        disabled,
        isSending,
        isThinking,
        isConnected,
        activeModel,
        modelOptions,
        modelsLoading = false,
        modelsError = null,
        onRefreshModels,
        activeProfile,
        runtimeMode,
        interactionMode,
        projectPath,
        compact = false
    } = props

    const initialComposerPreferences = useMemo(() => readAssistantComposerPreferences(), [])
    const [text, setText] = useState('')
    const [inlineMentionTags, setInlineMentionTags] = useState<InlineMentionTag[]>([])
    const [contextFiles, setContextFiles] = useState<ComposerContextFile[]>([])
    const [sentPromptHistory, setSentPromptHistory] = useState<string[]>([])
    const [historyCursor, setHistoryCursor] = useState<number | null>(null)
    const [draftBeforeHistory, setDraftBeforeHistory] = useState('')
    const [showModelDropdown, setShowModelDropdown] = useState(false)
    const [showTraitsDropdown, setShowTraitsDropdown] = useState(false)
    const [showBranchDropdown, setShowBranchDropdown] = useState(false)
    const [showMentionMenu, setShowMentionMenu] = useState(false)
    const [showFullAccessConfirm, setShowFullAccessConfirm] = useState(false)
    const [composerCursor, setComposerCursor] = useState(0)
    const [modelQuery, setModelQuery] = useState('')
    const [branchQuery, setBranchQuery] = useState('')
    const [previewAttachment, setPreviewAttachment] = useState<ComposerContextFile | null>(null)
    const [removingAttachmentIds, setRemovingAttachmentIds] = useState<string[]>([])
    const [branches, setBranches] = useState<DevScopeGitBranchSummary[]>([])
    const [isGitRepo, setIsGitRepo] = useState(false)
    const [branchesLoading, setBranchesLoading] = useState(false)
    const [projectNodes, setProjectNodes] = useState<MentionCandidate[]>([])
    const [mentionLoading, setMentionLoading] = useState(false)
    const [activeMentionIndex, setActiveMentionIndex] = useState(0)
    const [activeModelIndex, setActiveModelIndex] = useState(0)
    const [activeBranchIndex, setActiveBranchIndex] = useState(0)
    const [mentionCanScrollUp, setMentionCanScrollUp] = useState(false)
    const [mentionCanScrollDown, setMentionCanScrollDown] = useState(false)
    const [mentionChangedStateByPath, setMentionChangedStateByPath] = useState<Record<string, 'staged' | 'unstaged' | 'both'>>({})
    const [mentionRecentModifiedAtByPath, setMentionRecentModifiedAtByPath] = useState<Record<string, number>>({})
    const [modelCanScrollUp, setModelCanScrollUp] = useState(false)
    const [modelCanScrollDown, setModelCanScrollDown] = useState(false)
    const [selectedEffort, setSelectedEffort] = useState<AssistantComposerPreferenceEffort>(initialComposerPreferences.effort || 'high')
    const [fastModeEnabled, setFastModeEnabled] = useState(initialComposerPreferences.fastModeEnabled ?? false)
    const [isCompactFooter, setIsCompactFooter] = useState(compact)
    const textareaRef = useRef<HTMLTextAreaElement>(null)
    const textareaOverlayRef = useRef<HTMLDivElement>(null)
    const filePickerRef = useRef<HTMLInputElement>(null)
    const composerRootRef = useRef<HTMLDivElement>(null)
    const modelDropdownRef = useRef<HTMLDivElement>(null)
    const modelListRef = useRef<HTMLDivElement>(null)
    const branchDropdownRef = useRef<HTMLDivElement>(null)
    const mentionMenuRef = useRef<HTMLDivElement>(null)
    const mentionListRef = useRef<HTMLDivElement>(null)
    const traitsDropdownRef = useRef<HTMLDivElement>(null)
    const didAutoRefreshModelsRef = useRef(false)

    const baseRuntimeMode: AssistantRuntimeMode = runtimeMode || (activeProfile === 'yolo-fast' ? 'full-access' : 'approval-required')
    const baseInteractionMode: AssistantInteractionMode = interactionMode || 'default'
    const resolvedModel = String(activeModel || '').trim()
    const availableModelOptions = modelOptions?.length ? modelOptions : (resolvedModel ? [{ id: resolvedModel, label: resolvedModel }] : [])
    const [selectedModel, setSelectedModel] = useState(initialComposerPreferences.model || resolvedModel)
    const [selectedRuntimeMode, setSelectedRuntimeMode] = useState<AssistantRuntimeMode>(initialComposerPreferences.runtimeMode || baseRuntimeMode)
    const [selectedInteractionMode, setSelectedInteractionMode] = useState<AssistantInteractionMode>(initialComposerPreferences.interactionMode || baseInteractionMode)
    const latestModelId = availableModelOptions[0]?.id || null
    const selectedModelLabel = availableModelOptions.find((entry) => entry.id === selectedModel)?.label || selectedModel || 'Select model'
    const currentBranch = branches.find((branch) => branch.current)?.name || null
    const branchButtonLabel = branchesLoading ? 'Loading branch...' : currentBranch || 'Select branch'
    const mentionState = useMemo(() => {
        const cursorInsideInlineMention = inlineMentionTags.some((tag) => composerCursor > tag.start && composerCursor <= tag.end)
        const cursorRightAfterMention = inlineMentionTags.some((tag) => composerCursor === tag.end + 1)
        if (cursorInsideInlineMention || cursorRightAfterMention) return null
        return getMentionQuery(text, composerCursor)
    }, [composerCursor, inlineMentionTags, text])
    const displayedProfile = selectedRuntimeMode === baseRuntimeMode ? (activeProfile || getProfileLabel(baseRuntimeMode)) : getProfileLabel(selectedRuntimeMode)
    const mentionCandidates = useMemo(() => {
        const query = String(mentionState?.query || '').trim()
        const baseCandidates = searchMentionIndex(projectNodes, query, 16)
        return baseCandidates.map((candidate, index) => {
            const relativeKey = normalizeMentionLookupPath(candidate.relativePath || candidate.path)
            const changeState = mentionChangedStateByPath[relativeKey]
            const modifiedAt = mentionRecentModifiedAtByPath[relativeKey]
            let score = (baseCandidates.length - index) * 10
            if (changeState === 'both') score += 1200
            else if (changeState === 'staged') score += 1100
            else if (changeState === 'unstaged') score += 1000
            if (typeof modifiedAt === 'number') {
                const ageHours = Math.max(0, Date.now() - modifiedAt) / (1000 * 60 * 60)
                if (ageHours <= 24) score += 260 - ageHours * 6
                else if (ageHours <= 24 * 7) score += 140 - ageHours * 0.5
                else if (ageHours <= 24 * 30) score += 40
            }
            if (!query && candidate.type === 'file') score += 12
            return { candidate, index, score }
        }).sort((left, right) => right.score - left.score || left.index - right.index).slice(0, 8).map((entry) => entry.candidate)
    }, [mentionChangedStateByPath, mentionRecentModifiedAtByPath, mentionState?.query, projectNodes])
    const filteredModelOptions = useMemo(() => {
        const normalizedQuery = modelQuery.trim().toLowerCase()
        if (!normalizedQuery) return availableModelOptions
        return availableModelOptions.filter((model) => String(model.label || model.id).toLowerCase().includes(normalizedQuery) || String(model.id || '').toLowerCase().includes(normalizedQuery) || String(model.description || '').toLowerCase().includes(normalizedQuery))
    }, [availableModelOptions, modelQuery])
    const filteredBranches = useMemo(() => {
        const normalizedQuery = branchQuery.trim().toLowerCase()
        if (!normalizedQuery) return branches
        return branches.filter((branch) => branch.name.toLowerCase().includes(normalizedQuery) || String(branch.label || '').toLowerCase().includes(normalizedQuery))
    }, [branchQuery, branches])
    const activeMentionCandidate = mentionCandidates[activeMentionIndex] || null
    const activeModelCandidate = filteredModelOptions[activeModelIndex] || null

    const syncScrollAffordance = (element: HTMLDivElement | null, setCanScrollUp: (value: boolean) => void, setCanScrollDown: (value: boolean) => void) => {
        if (!element) {
            setCanScrollUp(false)
            setCanScrollDown(false)
            return
        }
        const maxScrollTop = Math.max(0, element.scrollHeight - element.clientHeight)
        setCanScrollUp(element.scrollTop > 2)
        setCanScrollDown(maxScrollTop - element.scrollTop > 2)
    }
    const ensureListItemVisible = (listElement: HTMLDivElement | null, itemElement: HTMLElement | null, options?: { topInset?: number; bottomInset?: number }) => {
        if (!listElement || !itemElement) return
        const topInset = options?.topInset ?? 26
        const bottomInset = options?.bottomInset ?? 26
        const itemTop = itemElement.offsetTop
        const itemBottom = itemTop + itemElement.offsetHeight
        const visibleTop = listElement.scrollTop + topInset
        const visibleBottom = listElement.scrollTop + listElement.clientHeight - bottomInset
        if (itemTop < visibleTop) {
            requestAnimationFrame(() => { listElement.scrollTop = Math.max(0, itemTop - topInset) })
            return
        }
        if (itemBottom > visibleBottom) {
            requestAnimationFrame(() => {
                listElement.scrollTop = Math.min(listElement.scrollHeight - listElement.clientHeight, itemBottom - listElement.clientHeight + bottomInset)
            })
        }
    }
    const syncComposerCursor = (element: HTMLTextAreaElement | null) => setComposerCursor(element?.selectionStart ?? 0)
    const syncTextareaOverlayScroll = (element: HTMLTextAreaElement | null) => {
        if (!element || !textareaOverlayRef.current) return
        textareaOverlayRef.current.scrollTop = element.scrollTop
        textareaOverlayRef.current.scrollLeft = element.scrollLeft
    }

    useEffect(() => { setSelectedRuntimeMode((current) => current || baseRuntimeMode) }, [baseRuntimeMode])
    useEffect(() => { setSelectedInteractionMode((current) => current || baseInteractionMode) }, [baseInteractionMode])
    useEffect(() => { setSelectedModel((current) => current || resolvedModel) }, [resolvedModel])
    useEffect(() => {
        if (!selectedModel && availableModelOptions.length > 0) setSelectedModel(availableModelOptions[0].id)
    }, [availableModelOptions, selectedModel])
    useEffect(() => {
        mergeAssistantComposerPreferences({ model: selectedModel || undefined, runtimeMode: selectedRuntimeMode, interactionMode: selectedInteractionMode, effort: selectedEffort, fastModeEnabled })
    }, [fastModeEnabled, selectedEffort, selectedInteractionMode, selectedModel, selectedRuntimeMode])
    useEffect(() => subscribeAssistantComposerPreferences((preferences) => {
        if (preferences.model !== undefined) setSelectedModel(preferences.model)
        if (preferences.runtimeMode !== undefined) setSelectedRuntimeMode(preferences.runtimeMode)
        if (preferences.interactionMode !== undefined) setSelectedInteractionMode(preferences.interactionMode)
        if (preferences.effort !== undefined) setSelectedEffort(preferences.effort)
        if (preferences.fastModeEnabled !== undefined) setFastModeEnabled(preferences.fastModeEnabled)
    }), [])
    useEffect(() => {
        try {
            const saved = localStorage.getItem(DRAFT_STORAGE_KEY)
            if (saved?.trim()) {
                setText(saved)
                setInlineMentionTags([])
            }
        } catch {}
    }, [])
    useEffect(() => {
        try {
            if (text.trim()) localStorage.setItem(DRAFT_STORAGE_KEY, text)
            else localStorage.removeItem(DRAFT_STORAGE_KEY)
        } catch {}
    }, [text])
    useEffect(() => { syncTextareaOverlayScroll(textareaRef.current) }, [inlineMentionTags, text])
    useEffect(() => { setShowMentionMenu(Boolean(mentionState)); setActiveMentionIndex(0) }, [mentionState?.query, mentionState?.start])
    useEffect(() => { if (!showModelDropdown) { setModelQuery(''); setActiveModelIndex(0) } }, [showModelDropdown])
    useEffect(() => { if (!showBranchDropdown) { setBranchQuery(''); setActiveBranchIndex(0) } }, [showBranchDropdown])
    useEffect(() => {
        if (!showMentionMenu) {
            setMentionCanScrollUp(false)
            setMentionCanScrollDown(false)
            return
        }
        const frame = window.requestAnimationFrame(() => syncScrollAffordance(mentionListRef.current, setMentionCanScrollUp, setMentionCanScrollDown))
        return () => window.cancelAnimationFrame(frame)
    }, [mentionCandidates.length, mentionLoading, showMentionMenu])
    useEffect(() => {
        if (!showMentionMenu || !mentionListRef.current) return
        const activeButton = mentionListRef.current.querySelector(`[data-mention-index="${activeMentionIndex}"]`) as HTMLButtonElement | null
        if (!activeButton) return
        ensureListItemVisible(mentionListRef.current, activeButton, { topInset: 24, bottomInset: 24 })
        syncScrollAffordance(mentionListRef.current, setMentionCanScrollUp, setMentionCanScrollDown)
    }, [activeMentionIndex, mentionCandidates.length, showMentionMenu])
    useEffect(() => {
        if (!showModelDropdown) {
            setModelCanScrollUp(false)
            setModelCanScrollDown(false)
            return
        }
        const frame = window.requestAnimationFrame(() => syncScrollAffordance(modelListRef.current, setModelCanScrollUp, setModelCanScrollDown))
        return () => window.cancelAnimationFrame(frame)
    }, [filteredModelOptions.length, modelQuery, modelsError, modelsLoading, showModelDropdown])
    useEffect(() => {
        if (!showModelDropdown || !modelListRef.current) return
        const activeButton = modelListRef.current.querySelector(`[data-model-index="${activeModelIndex}"]`) as HTMLButtonElement | null
        if (!activeButton) return
        ensureListItemVisible(modelListRef.current, activeButton, { topInset: 24, bottomInset: 24 })
        syncScrollAffordance(modelListRef.current, setModelCanScrollUp, setModelCanScrollDown)
    }, [activeModelIndex, filteredModelOptions.length, showModelDropdown])
    useEffect(() => {
        if (!showModelDropdown && !showTraitsDropdown && !showBranchDropdown && !showMentionMenu) return
        const handleClickOutside = (event: MouseEvent) => {
            if (modelDropdownRef.current && !modelDropdownRef.current.contains(event.target as Node)) setShowModelDropdown(false)
            if (traitsDropdownRef.current && !traitsDropdownRef.current.contains(event.target as Node)) setShowTraitsDropdown(false)
            if (branchDropdownRef.current && !branchDropdownRef.current.contains(event.target as Node)) setShowBranchDropdown(false)
            if (mentionMenuRef.current && !mentionMenuRef.current.contains(event.target as Node)) setShowMentionMenu(false)
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [showBranchDropdown, showMentionMenu, showModelDropdown, showTraitsDropdown])
    useEffect(() => {
        if (!contextFiles.some((file) => file.animateIn)) return
        const rafId = window.requestAnimationFrame(() => setContextFiles((prev) => prev.map((file) => file.animateIn ? { ...file, animateIn: false } : file)))
        return () => window.cancelAnimationFrame(rafId)
    }, [contextFiles])
    useEffect(() => {
        if (previewAttachment && !contextFiles.some((entry) => entry.id === previewAttachment.id)) setPreviewAttachment(null)
    }, [contextFiles, previewAttachment])
    useAssistantComposerProjectData({
        projectPath,
        projectNodes,
        mentionChangedStateByPath,
        setIsGitRepo,
        setBranches,
        setBranchesLoading,
        setProjectNodes,
        setMentionLoading,
        setMentionChangedStateByPath,
        setMentionRecentModifiedAtByPath
    })
    useEffect(() => {
        const element = composerRootRef.current
        if (!element || typeof ResizeObserver === 'undefined') return
        const observer = new ResizeObserver((entries) => {
            const width = entries[0]?.contentRect.width || element.clientWidth
            setIsCompactFooter(compact || width < 760)
        })
        observer.observe(element)
        return () => observer.disconnect()
    }, [compact])
    useEffect(() => {
        if (availableModelOptions.length > 0) {
            didAutoRefreshModelsRef.current = false
            return
        }
        if (didAutoRefreshModelsRef.current || modelsLoading || !onRefreshModels) return
        didAutoRefreshModelsRef.current = true
        onRefreshModels()
    }, [availableModelOptions.length, modelsLoading, onRefreshModels])

    const handlers = createAssistantComposerHandlers({
        disabled,
        isConnected,
        isSending,
        onSend,
        text,
        setText,
        inlineMentionTags,
        setInlineMentionTags,
        contextFiles,
        setContextFiles,
        sentPromptHistory,
        setSentPromptHistory,
        historyCursor,
        setHistoryCursor,
        draftBeforeHistory,
        setDraftBeforeHistory,
        showMentionMenu,
        setShowMentionMenu,
        mentionCandidates,
        mentionState,
        activeMentionCandidate,
        setActiveMentionIndex,
        showModelDropdown,
        setShowModelDropdown,
        filteredModelOptions,
        activeModelCandidate,
        setActiveModelIndex,
        showBranchDropdown,
        setShowBranchDropdown,
        filteredBranches,
        setActiveBranchIndex,
        selectedModel,
        setSelectedModel,
        selectedRuntimeMode,
        setSelectedRuntimeMode,
        selectedInteractionMode,
        selectedEffort,
        fastModeEnabled,
        setComposerCursor,
        removingAttachmentIds,
        setRemovingAttachmentIds,
        textareaRef,
        syncTextareaOverlayScroll
    })

    return {
        disabled,
        isConnected,
        isThinking,
        modelsLoading,
        modelsError,
        compact,
        text,
        setText,
        inlineMentionTags,
        setInlineMentionTags,
        contextFiles,
        historyCursor,
        setHistoryCursor,
        showModelDropdown,
        setShowModelDropdown,
        showTraitsDropdown,
        setShowTraitsDropdown,
        showBranchDropdown,
        setShowBranchDropdown,
        showMentionMenu,
        showFullAccessConfirm,
        setShowFullAccessConfirm,
        previewAttachment,
        setPreviewAttachment,
        removingAttachmentIds,
        branches,
        isGitRepo,
        branchesLoading,
        mentionLoading,
        activeMentionIndex,
        activeModelIndex,
        activeBranchIndex,
        mentionCanScrollUp,
        mentionCanScrollDown,
        setMentionCanScrollUp,
        setMentionCanScrollDown,
        modelCanScrollUp,
        modelCanScrollDown,
        setModelCanScrollUp,
        setModelCanScrollDown,
        selectedEffort,
        setSelectedEffort,
        fastModeEnabled,
        setFastModeEnabled,
        isCompactFooter,
        textareaRef,
        textareaOverlayRef,
        filePickerRef,
        composerRootRef,
        modelDropdownRef,
        modelListRef,
        branchDropdownRef,
        mentionMenuRef,
        mentionListRef,
        traitsDropdownRef,
        mentionCandidates,
        selectedModel,
        setSelectedModel,
        selectedModelLabel,
        latestModelId,
        filteredModelOptions,
        setActiveModelIndex,
        branchQuery,
        setBranchQuery,
        currentBranch,
        branchButtonLabel,
        filteredBranches,
        setActiveBranchIndex,
        selectedInteractionMode,
        setSelectedInteractionMode,
        selectedRuntimeMode,
        setSelectedRuntimeMode,
        displayedProfile,
        activeMentionCandidate,
        syncScrollAffordance,
        syncComposerCursor,
        syncTextareaOverlayScroll,
        setComposerCursor,
        modelQuery,
        setModelQuery,
        EFFORT_OPTIONS,
        EFFORT_LABELS,
        onRefreshModels,
        getContextFileMeta,
        ...handlers
    }
}

export type AssistantComposerController = ReturnType<typeof useAssistantComposerController>
