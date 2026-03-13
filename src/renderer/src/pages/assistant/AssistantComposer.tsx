import { useEffect, useMemo, useRef, useState } from 'react'
import {
    Check,
    ChevronDown,
    ChevronUp,
    FileCode2,
    FileImage,
    FileText,
    GitBranch,
    ListTodo,
    Loader2,
    Lock,
    LockOpen,
    MessageSquare,
    Plus,
    SendHorizontal,
    X
} from 'lucide-react'
import type { AssistantInteractionMode, AssistantRuntimeMode } from '@shared/assistant/contracts'
import type { DevScopeGitBranchSummary } from '@shared/contracts/devscope-api'
import { AnimatedHeight } from '@/components/ui/AnimatedHeight'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { VscodeEntryIcon } from '@/components/ui/VscodeEntryIcon'
import { useSettings } from '@/lib/settings'
import { cn } from '@/lib/utils'
import AssistantAttachmentPreviewModal from './AssistantAttachmentPreviewModal'
import {
    mergeAssistantComposerPreferences,
    readAssistantComposerPreferences,
    subscribeAssistantComposerPreferences,
    type AssistantComposerPreferenceEffort
} from './assistant-composer-preferences'
import {
    getOrCreateMentionIndex,
    primeMentionIndex,
    searchMentionIndex,
    type MentionCandidate
} from './assistant-composer-mentions'
import type { ComposerContextFile } from './assistant-composer-types'
import {
    ATTACHMENT_REMOVE_MS,
    buildAttachmentPath,
    buildTextAttachmentFromPaste,
    createAttachmentId,
    DRAFT_STORAGE_KEY,
    getContentTypeTag,
    getContextFileMeta,
    inferImageExtensionFromMimeType,
    isLargeTextPaste,
    isPastedTextAttachment,
    MAX_ATTACHMENT_CONTENT_CHARS,
    MAX_IMAGE_DATA_URL_CHARS,
    readFileAsDataUrl,
    summarizeTextPreview,
    toKbLabel
} from './assistant-composer-utils'

export type { ComposerContextFile } from './assistant-composer-types'

type AssistantComposerSendOptions = {
    model?: string
    runtimeMode: AssistantRuntimeMode
    interactionMode: AssistantInteractionMode
    effort: 'low' | 'medium' | 'high' | 'xhigh'
    serviceTier?: 'fast'
}

export type AssistantComposerProps = {
    onSend: (prompt: string, contextFiles: ComposerContextFile[], options: AssistantComposerSendOptions) => Promise<boolean>
    disabled: boolean
    isSending: boolean
    isThinking: boolean
    isConnected: boolean
    activeModel?: string
    modelOptions?: Array<{ id: string; label: string; description?: string }>
    modelsLoading?: boolean
    modelsError?: string | null
    onRefreshModels?: () => void
    activeProfile?: string
    runtimeMode?: AssistantRuntimeMode
    interactionMode?: AssistantInteractionMode
    projectPath?: string | null
    compact?: boolean
}

const getProfileLabel = (runtimeMode: AssistantRuntimeMode) => runtimeMode === 'full-access' ? 'Full access' : 'Safe'
const EFFORT_OPTIONS: AssistantComposerPreferenceEffort[] = ['low', 'medium', 'high', 'xhigh']
const EFFORT_LABELS: Record<(typeof EFFORT_OPTIONS)[number], string> = {
    low: 'Low',
    medium: 'Medium',
    high: 'High',
    xhigh: 'Extra High'
}

function OpenAILogo({ className }: { className?: string }) {
    return (
        <svg viewBox="0 0 158.7128 157.296" aria-hidden="true" className={className} fill="currentColor">
            <path d="M60.8734,57.2556v-14.9432c0-1.2586.4722-2.2029,1.5728-2.8314l30.0443-17.3023c4.0899-2.3593,8.9662-3.4599,13.9988-3.4599,18.8759,0,30.8307,14.6289,30.8307,30.2006,0,1.1007,0,2.3593-.158,3.6178l-31.1446-18.2467c-1.8872-1.1006-3.7754-1.1006-5.6629,0l-39.4812,22.9651ZM131.0276,115.4561v-35.7074c0-2.2028-.9446-3.7756-2.8318-4.8763l-39.481-22.9651,12.8982-7.3934c1.1007-.6285,2.0453-.6285,3.1458,0l30.0441,17.3024c8.6523,5.0341,14.4708,15.7296,14.4708,26.1107,0,11.9539-7.0769,22.965-18.2461,27.527v.0021ZM51.593,83.9964l-12.8982-7.5497c-1.1007-.6285-1.5728-1.5728-1.5728-2.8314v-34.6048c0-16.8303,12.8982-29.5722,30.3585-29.5722,6.607,0,12.7403,2.2029,17.9324,6.1349l-30.987,17.9324c-1.8871,1.1007-2.8314,2.6735-2.8314,4.8764v45.6159l-.0014-.0015ZM79.3562,100.0403l-18.4829-10.3811v-22.0209l18.4829-10.3811,18.4812,10.3811v22.0209l-18.4812,10.3811ZM91.2319,147.8591c-6.607,0-12.7403-2.2031-17.9324-6.1344l30.9866-17.9333c1.8872-1.1005,2.8318-2.6728,2.8318-4.8759v-45.616l13.0564,7.5498c1.1005.6285,1.5723,1.5728,1.5723,2.8314v34.6051c0,16.8297-13.0564,29.5723-30.5147,29.5723v.001ZM53.9522,112.7822l-30.0443-17.3024c-8.652-5.0343-14.471-15.7296-14.471-26.1107,0-12.1119,7.2356-22.9652,18.403-27.5272v35.8634c0,2.2028.9443,3.7756,2.8314,4.8763l39.3248,22.8068-12.8982,7.3938c-1.1007.6287-2.045.6287-3.1456,0ZM52.2229,138.5791c-17.7745,0-30.8306-13.3713-30.8306-29.8871,0-1.2585.1578-2.5169.3143-3.7754l30.987,17.9323c1.8871,1.1005,3.7757,1.1005,5.6628,0l39.4811-22.807v14.9435c0,1.2585-.4721,2.2021-1.5728,2.8308l-30.0443,17.3025c-4.0898,2.359-8.9662,3.4605-13.9989,3.4605h.0014ZM91.2319,157.296c19.0327,0,34.9188-13.5272,38.5383-31.4594,17.6164-4.562,28.9425-21.0779,28.9425-37.908,0-11.0112-4.719-21.7066-13.2133-29.4143.7867-3.3035,1.2595-6.607,1.2595-9.909,0-22.4929-18.2471-39.3247-39.3251-39.3247-4.2461,0-8.3363.6285-12.4262,2.045-7.0792-6.9213-16.8318-11.3254-27.5271-11.3254-19.0331,0-34.9191,13.5268-38.5384,31.4591C11.3255,36.0212,0,52.5373,0,69.3675c0,11.0112,4.7184,21.7065,13.2125,29.4142-.7865,3.3035-1.2586,6.6067-1.2586,9.9092,0,22.4923,18.2466,39.3241,39.3248,39.3241,4.2462,0,8.3362-.6277,12.426-2.0441,7.0776,6.921,16.8302,11.3251,27.5271,11.3251Z" />
        </svg>
    )
}

function getMentionQuery(text: string, cursor: number): { start: number; query: string } | null {
    const beforeCursor = text.slice(0, cursor)
    const match = beforeCursor.match(/(^|\s)@([^\s@]*)$/)
    if (!match || match.index == null) return null
    const start = match.index + match[1].length
    return { start, query: match[2] || '' }
}

function normalizeMentionLookupPath(pathValue: string): string {
    return String(pathValue || '').replace(/\\/g, '/').replace(/^\.\//, '').replace(/^\//, '').toLowerCase()
}

type InlineMentionTag = {
    id: string
    path: string
    relativePath: string
    label: string
    kind: 'file' | 'directory'
    start: number
    end: number
}

function sortInlineMentionTags(tags: InlineMentionTag[]): InlineMentionTag[] {
    return [...tags].sort((left, right) => left.start - right.start || left.end - right.end)
}

function reconcileInlineMentionTags(prevText: string, nextText: string, tags: InlineMentionTag[]): InlineMentionTag[] {
    if (tags.length === 0) return []
    if (prevText === nextText) return sortInlineMentionTags(tags)

    let prefixLength = 0
    while (
        prefixLength < prevText.length
        && prefixLength < nextText.length
        && prevText[prefixLength] === nextText[prefixLength]
    ) {
        prefixLength += 1
    }

    let suffixLength = 0
    while (
        suffixLength < prevText.length - prefixLength
        && suffixLength < nextText.length - prefixLength
        && prevText[prevText.length - 1 - suffixLength] === nextText[nextText.length - 1 - suffixLength]
    ) {
        suffixLength += 1
    }

    const previousChangedEnd = prevText.length - suffixLength
    const nextChangedEnd = nextText.length - suffixLength
    const delta = nextText.length - prevText.length

    return sortInlineMentionTags(tags.flatMap((tag) => {
        if (tag.end <= prefixLength) {
            return [tag]
        }
        if (tag.start >= previousChangedEnd) {
            return [{ ...tag, start: tag.start + delta, end: tag.end + delta }]
        }
        return []
    }))
}

function removeInlineMentionTagRange(tags: InlineMentionTag[], start: number, end: number): InlineMentionTag[] {
    return tags.filter((tag) => tag.end <= start || tag.start >= end)
}

function replaceInlineMentionTokensWithLabels(text: string, tags: InlineMentionTag[]): string {
    if (tags.length === 0) return text
    let result = text
    const sortedTags = sortInlineMentionTags(tags)
    for (let index = sortedTags.length - 1; index >= 0; index -= 1) {
        const tag = sortedTags[index]
        result = `${result.slice(0, tag.start)}${tag.label}${result.slice(tag.end)}`
    }
    return result
}

export function AssistantComposer({
    onSend,
    disabled,
    isSending,
    isThinking,
    isConnected,
    activeModel,
    modelOptions,
    modelsLoading,
    modelsError,
    onRefreshModels,
    activeProfile,
    runtimeMode,
    interactionMode,
    projectPath,
    compact = false
}: AssistantComposerProps) {
    const { settings } = useSettings()
    const iconTheme = settings.theme === 'light' ? 'light' : 'dark'
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
    const initialComposerPreferences = useMemo(() => readAssistantComposerPreferences(), [])
    const [selectedEffort, setSelectedEffort] = useState<'low' | 'medium' | 'high' | 'xhigh'>(initialComposerPreferences.effort || 'high')
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
    const availableModelOptions = modelOptions?.length
        ? modelOptions
        : (resolvedModel ? [{ id: resolvedModel, label: resolvedModel }] : [])
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
        const scored = baseCandidates.map((candidate, index) => {
            const relativeKey = normalizeMentionLookupPath(candidate.relativePath || candidate.path)
            const changeState = mentionChangedStateByPath[relativeKey]
            const modifiedAt = mentionRecentModifiedAtByPath[relativeKey]
            let score = (baseCandidates.length - index) * 10

            if (changeState === 'both') score += 1200
            else if (changeState === 'staged') score += 1100
            else if (changeState === 'unstaged') score += 1000

            if (typeof modifiedAt === 'number') {
                const ageMs = Math.max(0, Date.now() - modifiedAt)
                const ageHours = ageMs / (1000 * 60 * 60)
                if (ageHours <= 24) score += 260 - ageHours * 6
                else if (ageHours <= 24 * 7) score += 140 - ageHours * 0.5
                else if (ageHours <= 24 * 30) score += 40
            }

            if (!query && candidate.type === 'file') score += 12
            return { candidate, index, score }
        })

        return scored
            .sort((left, right) => right.score - left.score || left.index - right.index)
            .slice(0, 8)
            .map((entry) => entry.candidate)
    }, [mentionChangedStateByPath, mentionRecentModifiedAtByPath, mentionState?.query, projectNodes])
    const filteredModelOptions = useMemo(() => {
        const normalizedQuery = modelQuery.trim().toLowerCase()
        if (!normalizedQuery) return availableModelOptions
        return availableModelOptions.filter((model) =>
            String(model.label || model.id).toLowerCase().includes(normalizedQuery)
            || String(model.id || '').toLowerCase().includes(normalizedQuery)
            || String(model.description || '').toLowerCase().includes(normalizedQuery)
        )
    }, [availableModelOptions, modelQuery])
    const filteredBranches = useMemo(() => {
        const normalizedQuery = branchQuery.trim().toLowerCase()
        if (!normalizedQuery) return branches
        return branches.filter((branch) =>
            branch.name.toLowerCase().includes(normalizedQuery)
            || String(branch.label || '').toLowerCase().includes(normalizedQuery)
        )
    }, [branchQuery, branches])
    const activeMentionCandidate = mentionCandidates[activeMentionIndex] || null
    const activeModelCandidate = filteredModelOptions[activeModelIndex] || null

    const syncScrollAffordance = (
        element: HTMLDivElement | null,
        setCanScrollUp: (value: boolean) => void,
        setCanScrollDown: (value: boolean) => void
    ) => {
        if (!element) {
            setCanScrollUp(false)
            setCanScrollDown(false)
            return
        }
        const maxScrollTop = Math.max(0, element.scrollHeight - element.clientHeight)
        setCanScrollUp(element.scrollTop > 2)
        setCanScrollDown(maxScrollTop - element.scrollTop > 2)
    }

    const ensureListItemVisible = (
        listElement: HTMLDivElement | null,
        itemElement: HTMLElement | null,
        options?: { topInset?: number; bottomInset?: number }
    ) => {
        if (!listElement || !itemElement) return
        const topInset = options?.topInset ?? 26
        const bottomInset = options?.bottomInset ?? 26
        const itemTop = itemElement.offsetTop
        const itemBottom = itemTop + itemElement.offsetHeight
        const visibleTop = listElement.scrollTop + topInset
        const visibleBottom = listElement.scrollTop + listElement.clientHeight - bottomInset

        if (itemTop < visibleTop) {
            requestAnimationFrame(() => {
                listElement.scrollTop = Math.max(0, itemTop - topInset)
            })
            return
        }
        if (itemBottom > visibleBottom) {
            requestAnimationFrame(() => {
                listElement.scrollTop = Math.min(
                    listElement.scrollHeight - listElement.clientHeight,
                    itemBottom - listElement.clientHeight + bottomInset
                )
            })
        }
    }

    const syncComposerCursor = (element: HTMLTextAreaElement | null) => {
        setComposerCursor(element?.selectionStart ?? 0)
    }

    const syncTextareaOverlayScroll = (element: HTMLTextAreaElement | null) => {
        if (!element || !textareaOverlayRef.current) return
        textareaOverlayRef.current.scrollTop = element.scrollTop
        textareaOverlayRef.current.scrollLeft = element.scrollLeft
    }

    const upsertAttachment = (attachment: ComposerContextFile) => {
        setContextFiles((prev) => {
            const sameByPath = prev.find((entry) => entry.path === attachment.path && entry.path !== '')
            return sameByPath ? prev : [...prev, attachment]
        })
    }

    useEffect(() => {
        setSelectedRuntimeMode((current) => current || baseRuntimeMode)
    }, [baseRuntimeMode])
    useEffect(() => {
        setSelectedInteractionMode((current) => current || baseInteractionMode)
    }, [baseInteractionMode])
    useEffect(() => {
        setSelectedModel((current) => current || resolvedModel)
    }, [resolvedModel])
    useEffect(() => {
        if (!selectedModel && availableModelOptions.length > 0) {
            setSelectedModel(availableModelOptions[0].id)
        }
    }, [availableModelOptions, selectedModel])
    useEffect(() => {
        mergeAssistantComposerPreferences({
            model: selectedModel || undefined,
            runtimeMode: selectedRuntimeMode,
            interactionMode: selectedInteractionMode,
            effort: selectedEffort,
            fastModeEnabled
        })
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

    useEffect(() => {
        syncTextareaOverlayScroll(textareaRef.current)
    }, [inlineMentionTags, text])

    useEffect(() => {
        setShowMentionMenu(Boolean(mentionState))
        setActiveMentionIndex(0)
    }, [mentionState?.query, mentionState?.start])
    useEffect(() => {
        if (!showModelDropdown) {
            setModelQuery('')
            setActiveModelIndex(0)
        }
    }, [showModelDropdown])
    useEffect(() => {
        if (!showBranchDropdown) {
            setBranchQuery('')
            setActiveBranchIndex(0)
        }
    }, [showBranchDropdown])

    useEffect(() => {
        if (!showMentionMenu) {
            setMentionCanScrollUp(false)
            setMentionCanScrollDown(false)
            return
        }
        const frame = window.requestAnimationFrame(() => {
            syncScrollAffordance(mentionListRef.current, setMentionCanScrollUp, setMentionCanScrollDown)
        })
        return () => window.cancelAnimationFrame(frame)
    }, [mentionCandidates.length, mentionLoading, showMentionMenu])

    useEffect(() => {
        if (!showMentionMenu || !mentionListRef.current) return
        const activeButton = mentionListRef.current.querySelector(`[data-mention-index="${activeMentionIndex}"]`) as HTMLButtonElement | null
        if (activeButton) {
            ensureListItemVisible(mentionListRef.current, activeButton, { topInset: 24, bottomInset: 24 })
            syncScrollAffordance(mentionListRef.current, setMentionCanScrollUp, setMentionCanScrollDown)
        }
    }, [activeMentionIndex, mentionCandidates.length, showMentionMenu])

    useEffect(() => {
        if (!showModelDropdown) {
            setModelCanScrollUp(false)
            setModelCanScrollDown(false)
            return
        }
        const frame = window.requestAnimationFrame(() => {
            syncScrollAffordance(modelListRef.current, setModelCanScrollUp, setModelCanScrollDown)
        })
        return () => window.cancelAnimationFrame(frame)
    }, [filteredModelOptions.length, modelQuery, modelsError, modelsLoading, showModelDropdown])

    useEffect(() => {
        if (!showModelDropdown || !modelListRef.current) return
        const activeButton = modelListRef.current.querySelector(`[data-model-index="${activeModelIndex}"]`) as HTMLButtonElement | null
        if (activeButton) {
            ensureListItemVisible(modelListRef.current, activeButton, { topInset: 24, bottomInset: 24 })
            syncScrollAffordance(modelListRef.current, setModelCanScrollUp, setModelCanScrollDown)
        }
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

    useEffect(() => {
        const trimmedPath = String(projectPath || '').trim()
        if (!trimmedPath) {
            setIsGitRepo(false)
            setBranches([])
            setBranchesLoading(false)
            return
        }

        let cancelled = false
        const loadBranchState = async () => {
            setBranchesLoading(true)
            try {
                const repoResult = await window.devscope.checkIsGitRepo(trimmedPath)
                if (cancelled) return
                if (!repoResult?.success || !repoResult.isGitRepo) {
                    setIsGitRepo(false)
                    setBranches([])
                    return
                }
                setIsGitRepo(true)
                const branchResult = await window.devscope.listBranches(trimmedPath)
                if (cancelled) return
                setBranches(branchResult?.success ? (branchResult.branches || []) : [])
            } catch {
                if (!cancelled) {
                    setIsGitRepo(false)
                    setBranches([])
                }
            } finally {
                if (!cancelled) setBranchesLoading(false)
            }
        }

        void loadBranchState()
        return () => {
            cancelled = true
        }
    }, [projectPath])

    useEffect(() => {
        const trimmedPath = String(projectPath || '').trim()
        if (!trimmedPath) {
            setProjectNodes([])
            setMentionLoading(false)
            return
        }

        let cancelled = false
        setMentionLoading(true)
        primeMentionIndex(trimmedPath)
        const loadIndex = async () => {
            try {
                const entries = await getOrCreateMentionIndex(trimmedPath)
                if (!cancelled) setProjectNodes(entries)
            } catch {
                if (!cancelled) setProjectNodes([])
            } finally {
                if (!cancelled) setMentionLoading(false)
            }
        }
        void loadIndex()
        return () => {
            cancelled = true
        }
    }, [projectPath])

    useEffect(() => {
        const trimmedPath = String(projectPath || '').trim()
        if (!trimmedPath) {
            setMentionChangedStateByPath({})
            return
        }

        let cancelled = false
        const loadChangedMentionFiles = async () => {
            try {
                const repoResult = await window.devscope.checkIsGitRepo(trimmedPath)
                if (cancelled || !repoResult?.success || !repoResult.isGitRepo) {
                    if (!cancelled) setMentionChangedStateByPath({})
                    return
                }

                const statusResult = await window.devscope.getGitStatusDetailed(trimmedPath, { includeStats: false })
                if (cancelled || !statusResult?.success) {
                    if (!cancelled) setMentionChangedStateByPath({})
                    return
                }

                const nextChangedStateByPath: Record<string, 'staged' | 'unstaged' | 'both'> = {}
                for (const entry of statusResult.entries || []) {
                    if (!entry?.path || (!entry.staged && !entry.unstaged)) continue
                    const normalizedPath = normalizeMentionLookupPath(entry.path)
                    nextChangedStateByPath[normalizedPath] = entry.staged && entry.unstaged
                        ? 'both'
                        : entry.staged
                            ? 'staged'
                            : 'unstaged'
                }

                if (!cancelled) setMentionChangedStateByPath(nextChangedStateByPath)
            } catch {
                if (!cancelled) setMentionChangedStateByPath({})
            }
        }

        void loadChangedMentionFiles()
        return () => {
            cancelled = true
        }
    }, [projectPath])

    useEffect(() => {
        const trimmedPath = String(projectPath || '').trim()
        if (!trimmedPath || projectNodes.length === 0) {
            setMentionRecentModifiedAtByPath({})
            return
        }

        let cancelled = false
        setMentionRecentModifiedAtByPath({})
        const loadRecentMentionFiles = async () => {
            const candidatesByKey = new Map<string, MentionCandidate>()
            for (const candidate of projectNodes) {
                if (candidate.type !== 'file') continue
                candidatesByKey.set(normalizeMentionLookupPath(candidate.relativePath || candidate.path), candidate)
            }

            const recentPool: MentionCandidate[] = []
            const seedCandidates = [
                ...Object.keys(mentionChangedStateByPath).map((key) => candidatesByKey.get(key)).filter((candidate): candidate is MentionCandidate => Boolean(candidate)),
                ...searchMentionIndex(projectNodes, '', 24)
            ]

            const seen = new Set<string>()
            for (const candidate of seedCandidates) {
                if (candidate.type !== 'file') continue
                const key = normalizeMentionLookupPath(candidate.relativePath || candidate.path)
                if (seen.has(key)) continue
                seen.add(key)
                recentPool.push(candidate)
                if (recentPool.length >= 18) break
            }

            const results = await Promise.all(recentPool.map(async (candidate) => {
                try {
                    const result = await window.devscope.readFileContent(candidate.path)
                    if (!result?.success || typeof result.modifiedAt !== 'number') return null
                    return [normalizeMentionLookupPath(candidate.relativePath || candidate.path), result.modifiedAt] as const
                } catch {
                    return null
                }
            }))

            if (cancelled) return
            const nextRecentModifiedAtByPath: Record<string, number> = {}
            for (const entry of results) {
                if (!entry) continue
                nextRecentModifiedAtByPath[entry[0]] = entry[1]
            }
            setMentionRecentModifiedAtByPath(nextRecentModifiedAtByPath)
        }

        void loadRecentMentionFiles()
        return () => {
            cancelled = true
        }
    }, [mentionChangedStateByPath, projectNodes, projectPath])

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

    const removeAttachment = (id: string) => {
        setRemovingAttachmentIds((prev) => prev.includes(id) ? prev : [...prev, id])
        window.setTimeout(() => {
            setContextFiles((prev) => prev.filter((entry) => entry.id !== id))
            setRemovingAttachmentIds((prev) => prev.filter((entryId) => entryId !== id))
        }, ATTACHMENT_REMOVE_MS)
    }

    const applyMentionCandidate = (candidate: MentionCandidate) => {
        if (!mentionState) return
        const start = mentionState.start
        const cursor = textareaRef.current?.selectionStart ?? text.length
        const mentionToken = `@${candidate.name}`
        const nextText = `${text.slice(0, start)}${mentionToken} ${text.slice(cursor)}`
        const nextTag: InlineMentionTag = {
            id: createAttachmentId(),
            path: candidate.path,
            relativePath: candidate.relativePath,
            label: candidate.name,
            kind: candidate.type,
            start,
            end: start + mentionToken.length
        }
        setText(nextText)
        setInlineMentionTags((current) => sortInlineMentionTags([
            ...reconcileInlineMentionTags(text, nextText, current),
            nextTag
        ]))
        setShowMentionMenu(false)
        window.requestAnimationFrame(() => {
            const nextCursor = start + mentionToken.length + 1
            setComposerCursor(nextCursor)
            textareaRef.current?.focus()
            textareaRef.current?.setSelectionRange(nextCursor, nextCursor)
            syncTextareaOverlayScroll(textareaRef.current)
        })
    }

    const attachFile = async (file: File, source: 'paste' | 'manual') => {
        const declaredMimeType = String(file.type || '').trim().toLowerCase()
        const fallbackName = declaredMimeType.startsWith('image/') ? `${source}-image-${Date.now()}.${inferImageExtensionFromMimeType(declaredMimeType)}` : `${source}-file-${Date.now()}`
        const name = file.name || fallbackName
        const electronPath = String((file as File & { path?: string }).path || '').trim()
        const metaPath = electronPath || buildAttachmentPath(source, name)
        const mimeType = declaredMimeType || 'application/octet-stream'
        const looksLikeImageByName = /\.(png|jpe?g|gif|webp|svg|bmp|ico|tiff?|avif|apng|heic|heif|jfif|jxl)$/i.test(name)
        const needsInlineImageContent = source === 'paste' || !electronPath || metaPath.startsWith('clipboard://')

        const addImageAttachment = (dataUrl: string, resolvedMimeType: string) => {
            upsertAttachment({
                id: createAttachmentId(),
                path: metaPath,
                name,
                mimeType: resolvedMimeType,
                sizeBytes: file.size,
                kind: 'image',
                previewDataUrl: dataUrl,
                content: needsInlineImageContent ? dataUrl : undefined,
                previewText: source === 'paste'
                    ? (dataUrl.length <= MAX_IMAGE_DATA_URL_CHARS ? 'Pasted image from clipboard.' : 'Pasted image from clipboard (large image, sent as full payload).')
                    : 'Attached image file.',
                source,
                animateIn: true
            })
        }

        if (mimeType.startsWith('image/') || looksLikeImageByName) {
            try {
                const dataUrl = await readFileAsDataUrl(file)
                const dataUrlMimeMatch = dataUrl.match(/^data:([^;,]+)[;,]/i)
                addImageAttachment(dataUrl, String(dataUrlMimeMatch?.[1] || '').trim().toLowerCase() || (mimeType.startsWith('image/') ? mimeType : 'image/png'))
            } catch {}
            return
        }

        if (source === 'paste' && !declaredMimeType) {
            try {
                const dataUrl = await readFileAsDataUrl(file)
                const dataUrlMimeMatch = dataUrl.match(/^data:([^;,]+)[;,]/i)
                const dataUrlMimeType = String(dataUrlMimeMatch?.[1] || '').trim().toLowerCase()
                if (dataUrlMimeType.startsWith('image/')) {
                    addImageAttachment(dataUrl, dataUrlMimeType)
                    return
                }
            } catch {}
        }

        try {
            const rawText = await file.text()
            const trimmed = rawText.length > MAX_ATTACHMENT_CONTENT_CHARS ? `${rawText.slice(0, MAX_ATTACHMENT_CONTENT_CHARS)}\n\n[truncated]` : rawText
            const meta = getContextFileMeta({ path: metaPath, name, mimeType })
            upsertAttachment({ id: createAttachmentId(), path: metaPath, name, mimeType, sizeBytes: file.size, kind: meta.category === 'code' ? 'code' : 'doc', content: trimmed, previewText: summarizeTextPreview(rawText), source, animateIn: true })
        } catch {
            upsertAttachment({ id: createAttachmentId(), path: metaPath, name, mimeType, sizeBytes: file.size, kind: 'file', previewText: source === 'paste' ? 'Binary attachment from clipboard.' : 'Attached binary file.', source, animateIn: true })
        }
    }

    const handleSend = async () => {
        const prompt = replaceInlineMentionTokensWithLabels(text, inlineMentionTags).trim()
        const inlineMentionFiles: ComposerContextFile[] = inlineMentionTags.map((tag) => {
            const meta = getContextFileMeta({ path: tag.path, name: tag.label })
            return {
                id: `mention_${tag.id}`,
                path: tag.path,
                name: tag.label,
                kind: meta.category === 'image' ? 'image' : meta.category === 'code' ? 'code' : 'file',
                source: 'manual'
            }
        })
        const contextFilesForSend = [...contextFiles, ...inlineMentionFiles].filter((file, index, collection) => {
            const fileKey = `${String(file.path || '').toLowerCase()}::${String(file.name || '').toLowerCase()}`
            return collection.findIndex((candidate) => `${String(candidate.path || '').toLowerCase()}::${String(candidate.name || '').toLowerCase()}` === fileKey) === index
        })
        if ((!prompt && contextFilesForSend.length === 0) || disabled || isSending || !isConnected) return
        const prevText = text
        const prevTags = inlineMentionTags
        const prevFiles = contextFiles
        setText('')
        setInlineMentionTags([])
        setContextFiles([])
        setHistoryCursor(null)
        setDraftBeforeHistory('')
        try { localStorage.removeItem(DRAFT_STORAGE_KEY) } catch {}
        const success = await onSend(prompt, contextFilesForSend, {
            model: selectedModel || undefined,
            runtimeMode: selectedRuntimeMode,
            interactionMode: selectedInteractionMode,
            effort: selectedEffort,
            serviceTier: fastModeEnabled ? 'fast' : undefined
        })
        if (!success) {
            setText(prevText)
            setInlineMentionTags(prevTags)
            setContextFiles(prevFiles)
            return
        }
        if (prompt) {
            setSentPromptHistory((prev) => prev[prev.length - 1] === prompt ? prev : [...prev.slice(-49), prompt])
        }
    }

    const handleRecallPrevious = () => {
        if (!sentPromptHistory.length) return
        if (historyCursor == null) {
            setDraftBeforeHistory(text)
            const nextIndex = sentPromptHistory.length - 1
            setHistoryCursor(nextIndex)
            setText(sentPromptHistory[nextIndex])
            setInlineMentionTags([])
            return
        }
        const nextIndex = Math.max(0, historyCursor - 1)
        setHistoryCursor(nextIndex)
        setText(sentPromptHistory[nextIndex])
        setInlineMentionTags([])
    }

    const handleRecallNext = () => {
        if (historyCursor == null) return
        if (historyCursor >= sentPromptHistory.length - 1) {
            setHistoryCursor(null)
            setText(draftBeforeHistory)
            setInlineMentionTags([])
            setDraftBeforeHistory('')
            return
        }
        const nextIndex = historyCursor + 1
        setHistoryCursor(nextIndex)
        setText(sentPromptHistory[nextIndex])
        setInlineMentionTags([])
    }

    const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
        const target = event.currentTarget
        const selectionStart = target.selectionStart ?? 0
        const selectionEnd = target.selectionEnd ?? 0
        const atStart = selectionStart === 0 && selectionEnd === 0
        const atEnd = selectionStart === text.length && selectionEnd === text.length

        if (inlineMentionTags.length > 0 && (event.key === 'Backspace' || event.key === 'Delete')) {
            const isBackspace = event.key === 'Backspace'
            const overlappingTags = selectionStart === selectionEnd
                ? inlineMentionTags.filter((tag) => isBackspace
                    ? selectionStart > tag.start && selectionStart <= tag.end
                    : selectionStart >= tag.start && selectionStart < tag.end)
                : inlineMentionTags.filter((tag) => tag.start < selectionEnd && tag.end > selectionStart)

            if (overlappingTags.length > 0) {
                event.preventDefault()
                const rangeStart = Math.min(selectionStart, ...overlappingTags.map((tag) => tag.start))
                const rangeEnd = Math.max(selectionEnd, ...overlappingTags.map((tag) => tag.end))
                const nextText = `${text.slice(0, rangeStart)}${text.slice(rangeEnd)}`
                setText(nextText)
                setInlineMentionTags((current) => reconcileInlineMentionTags(
                    text,
                    nextText,
                    removeInlineMentionTagRange(current, rangeStart, rangeEnd)
                ))
                setComposerCursor(rangeStart)
                window.requestAnimationFrame(() => {
                    textareaRef.current?.focus()
                    textareaRef.current?.setSelectionRange(rangeStart, rangeStart)
                    syncTextareaOverlayScroll(textareaRef.current)
                })
                return
            }
        }

        if (showMentionMenu && mentionCandidates.length > 0) {
            if (event.key === 'ArrowDown') {
                event.preventDefault()
                setActiveMentionIndex((current) => (current + 1) % mentionCandidates.length)
                return
            }
            if (event.key === 'ArrowUp') {
                event.preventDefault()
                setActiveMentionIndex((current) => (current - 1 + mentionCandidates.length) % mentionCandidates.length)
                return
            }
            if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault()
                applyMentionCandidate(activeMentionCandidate || mentionCandidates[0])
                return
            }
            if (event.key === 'Escape') {
                event.preventDefault()
                setShowMentionMenu(false)
                return
            }
        }
        if (showModelDropdown && filteredModelOptions.length > 0) {
            if (event.key === 'ArrowDown') {
                event.preventDefault()
                setActiveModelIndex((current) => (current + 1) % filteredModelOptions.length)
                return
            }
            if (event.key === 'ArrowUp') {
                event.preventDefault()
                setActiveModelIndex((current) => (current - 1 + filteredModelOptions.length) % filteredModelOptions.length)
                return
            }
            if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault()
                setSelectedModel((activeModelCandidate || filteredModelOptions[0]).id)
                setShowModelDropdown(false)
                return
            }
            if (event.key === 'Escape') {
                event.preventDefault()
                setShowModelDropdown(false)
                return
            }
        }
        if (showBranchDropdown && filteredBranches.length > 0) {
            if (event.key === 'ArrowDown') {
                event.preventDefault()
                setActiveBranchIndex((current) => (current + 1) % filteredBranches.length)
                return
            }
            if (event.key === 'ArrowUp') {
                event.preventDefault()
                setActiveBranchIndex((current) => (current - 1 + filteredBranches.length) % filteredBranches.length)
                return
            }
            if (event.key === 'Escape') {
                event.preventDefault()
                setShowBranchDropdown(false)
                return
            }
        }
        if (!event.shiftKey && !event.ctrlKey && !event.metaKey && !event.altKey && event.key === 'ArrowUp' && atStart) {
            event.preventDefault()
            handleRecallPrevious()
            return
        }
        if (!event.shiftKey && !event.ctrlKey && !event.metaKey && !event.altKey && event.key === 'ArrowDown' && atEnd) {
            event.preventDefault()
            handleRecallNext()
            return
        }
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault()
            void handleSend()
        }
    }

    const handlePaste = (event: React.ClipboardEvent<HTMLTextAreaElement>) => {
        const clipboard = event.clipboardData
        if (!clipboard) return
        const items = Array.from(clipboard.items || [])
        const fileItems = items.filter((item) => item.kind === 'file')
        if (fileItems.length > 0) {
            event.preventDefault()
            for (const item of fileItems) {
                const file = item.getAsFile()
                if (file) void attachFile(file, 'paste')
            }
            return
        }
        const plainText = clipboard.getData('text/plain')
        if (isLargeTextPaste(plainText)) {
            event.preventDefault()
            upsertAttachment(buildTextAttachmentFromPaste(plainText))
        }
    }

    return (
        <>
            <div className={cn('relative flex flex-col', compact ? 'gap-1.5' : 'gap-2')}>
                <AnimatedHeight isOpen={contextFiles.length > 0} duration={220}>
                    <div className={cn('flex flex-wrap items-center', compact ? 'gap-1.5 pb-1' : 'gap-2 pb-1.5')}>
                        {contextFiles.map((file) => {
                            const meta = getContextFileMeta(file)
                            const contentType = getContentTypeTag(file)
                            const isRemoving = removingAttachmentIds.includes(file.id)
                            const isEntering = Boolean(file.animateIn)
                            return (
                                <article
                                    key={file.id}
                                    className={cn('group relative overflow-hidden rounded-md border border-white/10 bg-white/[0.03] px-2 py-1.5 transition-colors hover:bg-white/[0.05]', compact ? 'w-[220px]' : 'w-[280px]')}
                                    style={{
                                        transition: 'transform 190ms ease, opacity 190ms ease, filter 190ms ease',
                                        transform: isRemoving ? 'translateY(6px) scale(0.82)' : isEntering ? 'translateY(-8px) scale(0.86)' : 'translateY(0) scale(1)',
                                        opacity: isRemoving || isEntering ? 0 : 1,
                                        filter: isRemoving ? 'blur(1px)' : 'blur(0)'
                                    }}
                                >
                                    <button
                                        type="button"
                                        onClick={() => setPreviewAttachment(file)}
                                        className="relative flex min-w-0 flex-1 items-center gap-2 overflow-hidden rounded-md"
                                        disabled={isRemoving}
                                        title="Open preview"
                                    >
                                        {meta.category === 'image' && file.previewDataUrl ? (
                                            <img src={file.previewDataUrl} alt={meta.name} className="h-7 w-7 rounded object-cover" />
                                        ) : (
                                            <div className={cn('flex h-7 w-7 shrink-0 items-center justify-center rounded border', meta.category === 'image' ? 'border-cyan-400/30 bg-cyan-500/10 text-cyan-300' : meta.category === 'code' ? 'border-indigo-400/30 bg-indigo-500/10 text-indigo-300' : 'border-white/10 bg-sparkle-bg text-sparkle-text-secondary')}>
                                                {meta.category === 'image' ? <FileImage size={24} /> : meta.category === 'code' ? <FileCode2 size={24} /> : <FileText size={24} />}
                                            </div>
                                        )}
                                        <span className="min-w-0 flex-1 text-left">
                                            <span className="block truncate text-[11px] font-medium text-sparkle-text">{meta.name}</span>
                                            <span className="block truncate font-mono text-[10px] uppercase tracking-wide text-sparkle-text-muted">{contentType}</span>
                                        </span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={(event) => {
                                            event.stopPropagation()
                                            removeAttachment(file.id)
                                        }}
                                        className="ml-1 shrink-0 rounded p-1 text-sparkle-text-muted transition-colors hover:bg-rose-500/10 hover:text-rose-300"
                                        disabled={isRemoving}
                                        title="Remove attachment"
                                    >
                                        <X size={11} />
                                    </button>
                                </article>
                            )
                        })}
                    </div>
                </AnimatedHeight>

                <div ref={composerRootRef} className="relative z-10">
                    <div className="group rounded-[20px] border border-white/10 bg-sparkle-card transition-[border-color,box-shadow] duration-200 focus-within:border-[var(--accent-primary)]/28 focus-within:shadow-[0_0_0_1px_color-mix(in_srgb,var(--accent-primary)_18%,transparent),0_0_18px_color-mix(in_srgb,var(--accent-primary)_12%,transparent)]">
                        <input
                            ref={filePickerRef}
                            type="file"
                            className="hidden"
                            multiple
                            accept="image/*,text/*,.md,.markdown,.txt,.json,.yaml,.yml,.xml,.csv,.ts,.tsx,.js,.jsx,.mjs,.cjs,.py,.go,.rs,.java,.kt,.cs,.cpp,.c,.h,.css,.scss,.sass,.html,.sql,.toml,.sh,.ps1"
                            onChange={(event) => {
                                const files = event.target.files
                                if (files?.length) {
                                    for (const file of Array.from(files)) void attachFile(file, 'manual')
                                }
                                event.currentTarget.value = ''
                            }}
                        />

                        <div ref={mentionMenuRef} className="relative px-3 pb-2 pt-3 sm:px-4 sm:pt-4">
                            <div className={cn('pointer-events-none absolute inset-x-0 bottom-full z-30 mb-1 overflow-hidden', showMentionMenu ? 'pointer-events-auto' : 'pointer-events-none')}>
                                <AnimatedHeight isOpen={showMentionMenu} duration={220}>
                                    <div className="overflow-hidden rounded-xl border border-white/10 bg-sparkle-card shadow-2xl shadow-black/70 backdrop-blur-xl">
                                        <div className="relative">
                                            {mentionCanScrollUp && (
                                                <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex h-6 items-start justify-center before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:h-[150%] before:rounded-t-[10px] before:bg-gradient-to-b before:from-sparkle-card before:from-40% before:to-transparent">
                                                    <ChevronUp size={11} className="relative mt-0.5 text-sparkle-text-muted/70" />
                                                </div>
                                            )}
                                            <div
                                                ref={mentionListRef}
                                                onScroll={(event) => syncScrollAffordance(event.currentTarget, setMentionCanScrollUp, setMentionCanScrollDown)}
                                                className="max-h-56 overflow-y-auto px-1.5 pt-6 pb-6"
                                            >
                                            {mentionLoading ? (
                                                <div className="flex items-center gap-2 px-2 py-3 text-[11px] text-sparkle-text-secondary">
                                                    <Loader2 size={12} className="animate-spin" />
                                                    <span>Indexing project files...</span>
                                                </div>
                                            ) : mentionCandidates.length === 0 ? (
                                                <div className="px-2 py-3 text-[11px] text-sparkle-text-secondary">No matching files or folders.</div>
                                            ) : (
                                                mentionCandidates.map((candidate, index) => (
                                                    <button
                                                        key={candidate.path}
                                                        type="button"
                                                        data-mention-index={index}
                                                        onClick={() => applyMentionCandidate(candidate)}
                                                        className={cn(
                                                            'flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left transition-colors',
                                                            index === activeMentionIndex
                                                                ? 'bg-white/[0.08]'
                                                                : 'hover:bg-white/[0.04]'
                                                        )}
                                                    >
                                                        <VscodeEntryIcon
                                                            pathValue={candidate.relativePath || candidate.name}
                                                            kind={candidate.type}
                                                            theme={iconTheme}
                                                            className="shrink-0"
                                                        />
                                                        <div className="min-w-0 flex-1 truncate">
                                                            <span className="text-[13px] font-semibold text-sparkle-text">{candidate.name}</span>
                                                            <span className="ml-2 font-mono text-[11px] text-white/[0.12]">{candidate.relativePath}</span>
                                                        </div>
                                                    </button>
                                                ))
                                            )}
                                            </div>
                                            {mentionCanScrollDown && (
                                                <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex h-6 items-end justify-center before:pointer-events-none before:absolute before:inset-x-0 before:bottom-0 before:h-[150%] before:rounded-b-[10px] before:bg-gradient-to-t before:from-sparkle-card before:from-40% before:to-transparent">
                                                    <ChevronDown size={11} className="relative mb-0.5 text-sparkle-text-muted/70" />
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </AnimatedHeight>
                            </div>
                            
                            <div className="flex min-h-[56px] items-start gap-2">
                                <button
                                    type="button"
                                    onClick={() => filePickerRef.current?.click()}
                                    disabled={disabled}
                                    className="mt-0.5 rounded-lg p-1 text-sparkle-text-muted transition-colors hover:bg-white/[0.03] hover:text-sparkle-text disabled:opacity-50"
                                    title="Attach files"
                                >
                                    <Plus size={18} />
                                </button>

                                <div className="relative min-w-0 flex-1">
                                    <div
                                        ref={textareaOverlayRef}
                                        aria-hidden="true"
                                        className={cn(
                                            'pointer-events-none absolute inset-0 z-10 overflow-hidden pl-[3px] pr-2 text-sparkle-text',
                                            compact ? 'min-h-[52px] text-[13px] leading-[1.35rem]' : 'min-h-[58px] text-[14px] leading-[1.45rem]'
                                        )}
                                    >
                                        <div className="whitespace-pre-wrap break-words">
                                            {text.length === 0 ? (
                                                <span className="text-sparkle-text-muted/45">Ask anything, @tag files/folders</span>
                                            ) : (
                                                (() => {
                                                    const segments: any[] = []
                                                    let cursor = 0
                                                    for (const tag of sortInlineMentionTags(inlineMentionTags)) {
                                                        if (tag.start > cursor) {
                                                            segments.push(<span key={`text_${cursor}`}>{text.slice(cursor, tag.start)}</span>)
                                                        }
                                                        const rawToken = text.slice(tag.start, tag.end)
                                                        segments.push(
                                                            <span key={`tag_${tag.id}`} className="relative inline-block">
                                                                <span className="invisible">{rawToken}</span>
                                                                <span
                                                                    className="pointer-events-none absolute inset-0 inline-flex translate-y-[-1px] items-center gap-1 rounded-md border border-white/10 bg-sparkle-card px-1.5 py-[1px] text-sparkle-text shadow-[0_1px_2px_rgba(0,0,0,0.3)]"
                                                                >
                                                                    <VscodeEntryIcon
                                                                        pathValue={tag.relativePath || tag.label}
                                                                        kind={tag.kind}
                                                                        theme={iconTheme}
                                                                        className="size-3 shrink-0"
                                                                    />
                                                                    <span className="truncate">{rawToken.slice(1)}</span>
                                                                </span>
                                                            </span>
                                                        )
                                                        cursor = tag.end
                                                    }
                                                    if (cursor < text.length) {
                                                        segments.push(<span key={`text_tail_${cursor}`}>{text.slice(cursor)}</span>)
                                                    }
                                                    return segments
                                                })()
                                            )}
                                        </div>
                                    </div>
                                    <textarea
                                        ref={textareaRef}
                                        rows={3}
                                        value={text}
                                        onChange={(event) => {
                                            const nextText = event.target.value
                                            setInlineMentionTags((current) => reconcileInlineMentionTags(text, nextText, current))
                                            setText(nextText)
                                            setComposerCursor(event.target.selectionStart ?? nextText.length)
                                            syncTextareaOverlayScroll(event.target)
                                            if (historyCursor != null) setHistoryCursor(null)
                                        }}
                                        onClick={(event) => {
                                            syncComposerCursor(event.currentTarget)
                                            syncTextareaOverlayScroll(event.currentTarget)
                                        }}
                                        onKeyUp={(event) => {
                                            syncComposerCursor(event.currentTarget)
                                            syncTextareaOverlayScroll(event.currentTarget)
                                        }}
                                        onSelect={(event) => syncComposerCursor(event.currentTarget)}
                                        onScroll={(event) => syncTextareaOverlayScroll(event.currentTarget)}
                                        onKeyDown={handleKeyDown}
                                        onPaste={handlePaste}
                                        className={cn(
                                            'relative w-full resize-none overflow-y-auto bg-transparent pl-[3px] pr-2 text-transparent outline-none [caret-color:white] placeholder:text-transparent selection:bg-white/15',
                                            compact ? 'min-h-[52px] text-[13px] leading-[1.35rem]' : 'min-h-[58px] text-[14px] leading-[1.45rem]'
                                        )}
                                        placeholder="Ask anything, @tag files/folders"
                                        disabled={disabled || !isConnected}
                                    />
                                </div>
                            </div>
                        </div>

                        <div className={cn('flex items-center justify-between px-1.5 pb-1.5 sm:px-2 sm:pb-2', isCompactFooter ? 'gap-0.5' : 'flex-wrap gap-1 sm:flex-nowrap sm:gap-0')}>
                            <div className={cn('flex min-w-0 flex-1 items-center text-[11px]', isCompactFooter ? 'gap-0.5 overflow-hidden' : 'gap-0.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:min-w-max sm:overflow-visible')}>
                                <div className="relative min-w-0" ref={modelDropdownRef}>
                                    <div className={cn('pointer-events-none absolute bottom-full left-0 z-30 mb-2 w-[22rem] overflow-hidden', showModelDropdown ? 'pointer-events-auto' : 'pointer-events-none')}>
                                        <AnimatedHeight isOpen={showModelDropdown} duration={220}>
                                            <div className="overflow-hidden rounded-xl border border-white/10 bg-sparkle-card shadow-2xl shadow-black/70 backdrop-blur-xl">
                                                <div className="flex items-center justify-between border-b border-white/5 px-3 pt-2 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-sparkle-text-muted">
                                                    <span>Models</span>
                                                    {modelsLoading && <Loader2 size={11} className="animate-spin" />}
                                                </div>
                                                <div className="px-2.5 py-2">
                                                    <input
                                                        value={modelQuery}
                                                        onChange={(event) => {
                                                            setModelQuery(event.target.value)
                                                            setActiveModelIndex(0)
                                                        }}
                                                        placeholder="Search models..."
                                                        className="h-8 w-full rounded-lg border border-white/10 bg-white/[0.03] px-2.5 text-[11px] text-sparkle-text outline-none placeholder:text-sparkle-text-muted/60 focus:border-white/20"
                                                    />
                                                </div>
                                                <div className="relative">
                                                    {modelCanScrollUp && (
                                                        <div className="pointer-events-none absolute inset-x-1.5 top-0 z-10 flex h-8 items-start justify-center before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:h-[200%] before:rounded-t-[10px] before:bg-gradient-to-b before:from-sparkle-card before:from-50% before:to-transparent">
                                                            <ChevronUp size={13} className="relative mt-1 text-sparkle-text-muted/85" />
                                                        </div>
                                                    )}
                                                    <div
                                                        ref={modelListRef}
                                                        onScroll={(event) => syncScrollAffordance(event.currentTarget, setModelCanScrollUp, setModelCanScrollDown)}
                                                        className="max-h-64 overflow-y-auto px-1.5 pt-6 pb-6"
                                                    >
                                                    {filteredModelOptions.length === 0 ? (
                                                        <div className="px-2 py-2.5 text-[11px] text-sparkle-text-secondary">No models found.</div>
                                                    ) : (
                                                        filteredModelOptions.map((model, index) => {
                                                            const isActive = model.id === selectedModel
                                                            const isHighlighted = index === activeModelIndex
                                                            const isLatestModel = model.id === latestModelId
                                                            const secondaryLabel = model.description || (model.label && model.label !== model.id ? model.id : '')
                                                            return (
                                                                <button
                                                                    key={model.id}
                                                                    type="button"
                                                                    data-model-index={index}
                                                                    onClick={() => {
                                                                        setSelectedModel(model.id)
                                                                        setShowModelDropdown(false)
                                                                    }}
                                                                    className={cn(
                                                                        'grid min-h-8 w-full grid-cols-[1rem_minmax(0,1fr)_auto] items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors',
                                                                        isActive
                                                                            ? 'bg-white/[0.06] text-sparkle-text'
                                                                            : 'text-sparkle-text-secondary hover:bg-white/[0.03] hover:text-sparkle-text',
                                                                        isHighlighted && !isActive && 'bg-white/[0.04] text-sparkle-text'
                                                                    )}
                                                                >
                                                                    <span className="flex items-center justify-center">
                                                                        {isActive ? <Check size={13} className="text-sparkle-text" /> : <span className="h-[13px] w-[13px]" />}
                                                                    </span>
                                                                    <span className="min-w-0 truncate text-[12px] font-medium">{model.label || model.id}</span>
                                                                    <span className="truncate text-[10px] text-sparkle-text-muted">
                                                                        {isLatestModel ? 'Latest' : secondaryLabel}
                                                                    </span>
                                                                </button>
                                                            )
                                                        })
                                                    )}
                                                    </div>
                                                    {modelCanScrollDown && (
                                                        <div className="pointer-events-none absolute inset-x-1.5 bottom-0 z-10 flex h-8 items-end justify-center before:pointer-events-none before:absolute before:inset-x-0 before:bottom-0 before:h-[200%] before:rounded-b-[10px] before:bg-gradient-to-t before:from-sparkle-card before:from-50% before:to-transparent">
                                                            <ChevronDown size={13} className="relative mb-1 text-sparkle-text-muted/85" />
                                                        </div>
                                                    )}
                                                </div>
                                                {modelsError && <div className="px-3 pb-2"><p className="text-[10px] font-medium text-rose-400">{modelsError}</p></div>}
                                            </div>
                                        </AnimatedHeight>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setShowModelDropdown((prev) => {
                                            const next = !prev
                                            if (next && onRefreshModels) onRefreshModels()
                                            return next
                                        })}
                                        title={modelsError || 'Select model'}
                                        className={cn('min-w-0 shrink-0 whitespace-nowrap px-1.5 text-[13px] font-medium text-sparkle-text-secondary transition-colors hover:text-sparkle-text', isCompactFooter ? 'max-w-40' : 'sm:px-2.5')}
                                    >
                                        <span className={cn('flex min-w-0 items-center gap-2', isCompactFooter && 'max-w-32')}>
                                            <OpenAILogo className="h-3.5 w-3.5 shrink-0 text-current opacity-80" />
                                            <span className="truncate text-[13px] font-medium">{selectedModelLabel}</span>
                                            <ChevronDown size={10} className="-mr-0.5 ml-0.5 shrink-0 opacity-60" />
                                        </span>
                                    </button>
                                </div>

                                <span className="mx-0.5 hidden h-4 w-px bg-white/10 sm:block" />

                                <div className="relative min-w-0" ref={traitsDropdownRef}>
                                    <div className={cn('pointer-events-none absolute bottom-full left-0 z-30 mb-2 w-56 overflow-hidden', showTraitsDropdown ? 'pointer-events-auto' : 'pointer-events-none')}>
                                        <AnimatedHeight isOpen={showTraitsDropdown} duration={220}>
                                            <div className="space-y-2 rounded-xl border border-white/10 bg-sparkle-card p-2 shadow-lg">
                                                <div className="px-2 pt-1 text-[9px] font-semibold uppercase tracking-[0.16em] text-sparkle-text-muted">Reasoning</div>
                                                <div className="space-y-1 px-1">
                                                    {EFFORT_OPTIONS.map((effort) => (
                                                        <button
                                                            key={effort}
                                                            type="button"
                                                            onClick={() => setSelectedEffort(effort)}
                                                            className={cn(
                                                                'flex w-full items-center rounded-md px-2 py-1.5 text-left text-[11px] transition-colors',
                                                                selectedEffort === effort ? 'bg-white/[0.05] text-sparkle-text' : 'text-sparkle-text-secondary hover:bg-white/[0.03] hover:text-sparkle-text'
                                                            )}
                                                        >
                                                            {EFFORT_LABELS[effort]}
                                                        </button>
                                                    ))}
                                                </div>
                                                <div className="border-t border-white/5 px-2 pt-2 text-[9px] font-semibold uppercase tracking-[0.16em] text-sparkle-text-muted">Fast Mode</div>
                                                <div className="flex gap-1 px-1 pb-1">
                                                    <button
                                                        type="button"
                                                        onClick={() => setFastModeEnabled(false)}
                                                        className={cn('flex-1 rounded-md px-2 py-1.5 text-[11px] transition-colors', !fastModeEnabled ? 'bg-white/[0.05] text-sparkle-text' : 'text-sparkle-text-secondary hover:bg-white/[0.03] hover:text-sparkle-text')}
                                                    >
                                                        off
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => setFastModeEnabled(true)}
                                                        className={cn('flex-1 rounded-md px-2 py-1.5 text-[11px] transition-colors', fastModeEnabled ? 'bg-white/[0.05] text-sparkle-text' : 'text-sparkle-text-secondary hover:bg-white/[0.03] hover:text-sparkle-text')}
                                                    >
                                                        on
                                                    </button>
                                                </div>
                                            </div>
                                        </AnimatedHeight>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setShowTraitsDropdown((prev) => !prev)}
                                        className="shrink-0 whitespace-nowrap px-1.5 text-[13px] font-medium text-sparkle-text-secondary transition-colors hover:text-sparkle-text sm:px-2.5"
                                        title="Reasoning and speed"
                                    >
                                        <span className="inline-flex items-center gap-1.5">
                                            <span className="text-[13px] font-medium text-amber-200">{EFFORT_LABELS[selectedEffort]}</span>
                                            <ChevronDown size={10} className="-mr-0.5 ml-0.5 opacity-60" />
                                        </span>
                                    </button>
                                </div>

                                <span className="mx-0.5 hidden h-4 w-px bg-white/10 sm:block" />

                                <button
                                    type="button"
                                    onClick={() => setSelectedInteractionMode((current) => current === 'plan' ? 'default' : 'plan')}
                                    className={cn(
                                        'inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1.5 text-[13px] font-medium transition-colors sm:px-3',
                                        selectedInteractionMode === 'plan'
                                            ? 'border-white/10 bg-violet-500/10 text-violet-200 hover:border-white/20 hover:bg-violet-500/14 hover:text-violet-100'
                                            : 'border-white/10 bg-sky-500/10 text-sky-200 hover:border-white/20 hover:bg-sky-500/14 hover:text-sky-100'
                                    )}
                                    title={selectedInteractionMode === 'plan' ? 'Plan mode — click to return to normal chat mode' : 'Default mode — click to enter plan mode'}
                                >
                                    {selectedInteractionMode === 'plan' ? <ListTodo size={14} /> : <MessageSquare size={14} />}
                                    <span>{selectedInteractionMode === 'plan' ? 'Plan' : 'Chat'}</span>
                                </button>

                                <span className="mx-0.5 hidden h-4 w-px bg-white/10 sm:block" />

                                <button
                                    type="button"
                                    onClick={() => {
                                        if (selectedRuntimeMode === 'full-access') {
                                            setSelectedRuntimeMode('approval-required')
                                            return
                                        }
                                        setShowFullAccessConfirm(true)
                                    }}
                                    className={cn(
                                        'shrink-0 whitespace-nowrap px-1.5 text-[13px] font-medium transition-colors sm:px-2.5',
                                        selectedRuntimeMode === 'full-access' ? 'text-amber-200 hover:text-amber-100' : 'text-emerald-200 hover:text-emerald-100'
                                    )}
                                    title={displayedProfile}
                                >
                                    <span className="inline-flex items-center gap-1.5">
                                        {selectedRuntimeMode === 'full-access' ? <LockOpen size={14} /> : <Lock size={14} />}
                                        <span className="text-[13px] font-medium">{selectedRuntimeMode === 'full-access' ? 'Full access' : 'Supervised'}</span>
                                    </span>
                                </button>
                            </div>

                            <div className="flex shrink-0 items-center gap-2">
                                <button
                                    type="button"
                                    disabled={disabled || !isConnected || isThinking || (!text.trim() && contextFiles.length === 0)}
                                    onClick={() => void handleSend()}
                                    className={cn(
                                        'inline-flex h-[36px] w-[36px] items-center justify-center rounded-full transition-all duration-150',
                                        disabled || !isConnected || isThinking || (!text.trim() && contextFiles.length === 0)
                                            ? 'cursor-not-allowed bg-[#1f3873] text-white/45'
                                            : 'bg-[#2246a8] text-white hover:scale-[1.03] hover:bg-[#2955ca]'
                                    )}
                                >
                                    {isThinking ? <Loader2 size={18} className="animate-spin" /> : <SendHorizontal size={18} />}
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center justify-between px-1 pt-2 text-[11px] font-medium text-sparkle-text-secondary">
                        <div className="flex items-center gap-2">
                            <span>Local</span>
                            {(isThinking || mentionLoading || modelsLoading || branchesLoading) && (
                                <span className="inline-flex items-center gap-1 text-[10px] text-sparkle-text-muted">
                                    <span className="h-1.5 w-1.5 rounded-full bg-white/35 animate-pulse" />
                                    {isThinking ? 'Working...' : mentionLoading ? 'Indexing...' : modelsLoading ? 'Loading models...' : 'Loading...'}
                                </span>
                            )}
                        </div>

                        <div className="relative" ref={branchDropdownRef}>
                            <button
                                type="button"
                                onClick={() => setShowBranchDropdown((prev) => !prev)}
                                className="inline-flex max-w-[220px] items-center gap-1.5 px-1 py-0.5 text-sparkle-text-secondary transition-colors hover:text-sparkle-text"
                                title={isGitRepo ? (currentBranch || 'Current branch') : 'No git repository detected'}
                            >
                                {isGitRepo && <GitBranch size={12} />}
                                <span className="truncate">{branchButtonLabel}</span>
                                <ChevronDown size={11} className="-mr-0.5 ml-0.5 opacity-60" />
                            </button>

                            <div className={cn('pointer-events-none absolute bottom-full right-0 z-30 mb-2 w-72 overflow-hidden', showBranchDropdown ? 'pointer-events-auto' : 'pointer-events-none')}>
                                <AnimatedHeight isOpen={showBranchDropdown} duration={220}>
                                    <div className="rounded-xl border border-white/10 bg-sparkle-card p-2 shadow-lg">
                                        {!isGitRepo ? (
                                            <div className="px-2 py-2 text-[11px] text-sparkle-text-secondary">This folder is not a git repository.</div>
                                        ) : branches.length === 0 ? (
                                            <div className="flex items-center gap-2 px-2 py-2 text-[11px] text-sparkle-text-secondary">
                                                {branchesLoading && <Loader2 size={12} className="animate-spin" />}
                                                <span>{branchesLoading ? 'Loading branches...' : 'No branches found.'}</span>
                                            </div>
                                        ) : (
                                            <>
                                                <div className="pb-1">
                                                    <input
                                                        value={branchQuery}
                                                        onChange={(event) => {
                                                            setBranchQuery(event.target.value)
                                                            setActiveBranchIndex(0)
                                                        }}
                                                        placeholder="Search branches..."
                                                        className="block w-full min-w-0 rounded-md border border-white/10 bg-white/[0.03] px-2.5 py-1.5 text-[11px] text-sparkle-text outline-none placeholder:text-sparkle-text-muted/60"
                                                    />
                                                </div>
                                                <div className="max-h-64 space-y-0.5 overflow-y-auto scrollbar-hide px-1">
                                                    {filteredBranches.length === 0 ? (
                                                        <div className="px-2.5 py-2 text-[11px] text-sparkle-text-secondary">No branches found.</div>
                                                    ) : (
                                                        filteredBranches.map((branch, index) => (
                                                            <div
                                                                key={`${branch.name}-${branch.commit}`}
                                                                className={cn(
                                                                    'flex items-center justify-between rounded-md border px-2.5 py-2 text-left transition-colors',
                                                                    branch.current ? 'border-white/10 bg-white/[0.04] text-sparkle-text' : 'border-transparent text-sparkle-text-secondary hover:bg-white/[0.03]',
                                                                    index === activeBranchIndex && !branch.current && 'bg-white/[0.03] text-sparkle-text'
                                                                )}
                                                            >
                                                                <div className="min-w-0">
                                                                    <div className="truncate text-[12px] font-medium">{branch.name}</div>
                                                                    <div className="truncate text-[10px] text-sparkle-text-muted">{branch.current ? 'Current branch' : branch.label}</div>
                                                                </div>
                                                                {branch.current && <span className="ml-3 text-[10px] font-medium text-sparkle-text-secondary">Current</span>}
                                                            </div>
                                                        ))
                                                    )}
                                                </div>
                                            </>
                                        )}
                                    </div>
                                </AnimatedHeight>
                            </div>
                        </div>
                    </div>
                </div>

                <AssistantAttachmentPreviewModal
                    file={previewAttachment}
                    meta={previewAttachment ? getContextFileMeta(previewAttachment) : null}
                    contentType={previewAttachment ? getContentTypeTag(previewAttachment) : ''}
                    sizeLabel={previewAttachment ? toKbLabel(previewAttachment.sizeBytes) : ''}
                    showFormattingWarning={previewAttachment ? isPastedTextAttachment(previewAttachment) : false}
                    onClose={() => setPreviewAttachment(null)}
                />
            </div>

            <ConfirmModal
                isOpen={showFullAccessConfirm}
                title="Enable full access?"
                message="Full access disables approval prompts and lets Codex run with danger-full-access for this assistant thread. Only continue if you trust the current project and prompt."
                confirmLabel="Enable full access"
                cancelLabel="Stay safe"
                variant="warning"
                onConfirm={() => {
                    setSelectedRuntimeMode('full-access')
                    setShowFullAccessConfirm(false)
                }}
                onCancel={() => setShowFullAccessConfirm(false)}
            />
        </>
    )
}
