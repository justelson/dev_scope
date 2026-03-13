import { useEffect, useMemo, useState } from 'react'
import {
    buildPullRequestExecutionPlan,
    getPreferredGitRemote
} from '@/lib/gitPublishPlanner'
import {
    buildGitHubPullRequestUrl,
    getProjectPullRequestConfig,
    getPullRequestChangeSourceLabel,
    mergeProjectPullRequestConfig,
    resolvePreferredPullRequestProvider,
    resolvePullRequestGuideText
} from '@/lib/pullRequestWorkflow'
import type {
    PullRequestChangeSource,
    PullRequestGuideMode,
    PullRequestGuideSource
} from '@/lib/settings'
import { buildPushRangeSummary } from '../PushRangeConfirmModal'
import { type PullRequestModalProps, type StatusMessage } from './types'
import {
    buildDiffContext,
    getPathTail
} from './utils'

export function usePullRequestModalController(props: PullRequestModalProps) {
    const {
        isOpen,
        projectName,
        projectPath,
        currentBranch,
        branches,
        remotes,
        unstagedFiles,
        stagedFiles,
        unpushedCommits,
        settings,
        updateSettings,
        showToast
    } = props

    const preferredRemote = useMemo(() => getPreferredGitRemote(remotes), [remotes])
    const projectDefaults = useMemo(
        () => getProjectPullRequestConfig(settings, projectPath),
        [projectPath, settings]
    )

    const [isAdvancedOpen, setIsAdvancedOpen] = useState(false)
    const [isDraftEditorOpen, setIsDraftEditorOpen] = useState(false)
    const [guideSource, setGuideSource] = useState<PullRequestGuideSource>(projectDefaults.guideSource)
    const [guideMode, setGuideMode] = useState<PullRequestGuideMode>(projectDefaults.guide.mode)
    const [guideText, setGuideText] = useState(projectDefaults.guide.text)
    const [guideFilePath, setGuideFilePath] = useState(projectDefaults.guide.filePath)
    const [targetBranch, setTargetBranch] = useState(projectDefaults.targetBranch)
    const [draftMode, setDraftMode] = useState(projectDefaults.draft)
    const [changeSource, setChangeSource] = useState<PullRequestChangeSource>(projectDefaults.changeSource)
    const [selectedCommitHash, setSelectedCommitHash] = useState<string | null>(unpushedCommits[0]?.hash ?? null)
    const [draftTitle, setDraftTitle] = useState('')
    const [draftBody, setDraftBody] = useState('')
    const [statusMessage, setStatusMessage] = useState<StatusMessage | null>(null)
    const [isGenerating, setIsGenerating] = useState(false)
    const [isExecuting, setIsExecuting] = useState(false)

    useEffect(() => {
        if (!isOpen) return
        const nextDefaults = getProjectPullRequestConfig(settings, projectPath)
        setIsAdvancedOpen(false)
        setIsDraftEditorOpen(false)
        setGuideSource(nextDefaults.guideSource)
        setGuideMode(nextDefaults.guide.mode)
        setGuideText(nextDefaults.guide.text)
        setGuideFilePath(nextDefaults.guide.filePath)
        setTargetBranch(nextDefaults.targetBranch)
        setDraftMode(nextDefaults.draft)
        setChangeSource(nextDefaults.changeSource)
        setSelectedCommitHash(unpushedCommits[0]?.hash ?? null)
        setDraftTitle('')
        setDraftBody('')
        setStatusMessage(null)
    }, [currentBranch, isOpen, projectPath, settings, unpushedCommits])

    useEffect(() => {
        if (!isOpen || typeof document === 'undefined') return
        const previousOverflow = document.body.style.overflow
        document.body.style.overflow = 'hidden'
        return () => {
            document.body.style.overflow = previousOverflow
        }
    }, [isOpen])

    useEffect(() => {
        if (selectedCommitHash && unpushedCommits.some((commit) => commit.hash === selectedCommitHash)) return
        setSelectedCommitHash(unpushedCommits[0]?.hash ?? null)
    }, [selectedCommitHash, unpushedCommits])

    const selectedPushSummary = useMemo(
        () => (selectedCommitHash ? buildPushRangeSummary(unpushedCommits, selectedCommitHash) : null),
        [selectedCommitHash, unpushedCommits]
    )
    const projectGuideConfig = useMemo(
        () => ({ mode: guideMode, text: guideText, filePath: guideFilePath }),
        [guideFilePath, guideMode, guideText]
    )
    const changeSourceLabel = getPullRequestChangeSourceLabel(changeSource)
    const targetBranchOptions = useMemo(() => {
        const names = branches.filter((branch) => branch.name).map((branch) => branch.name)
        return [...new Set([targetBranch, 'main', 'dev', ...names].map((name) => String(name || '').trim()).filter(Boolean))].map((name) => ({
            value: name,
            label: name
        }))
    }, [branches, targetBranch])
    const executionPlan = useMemo(
        () => buildPullRequestExecutionPlan({
            changeSource,
            draftMode,
            currentBranch,
            branches,
            remotes,
            unstagedFiles,
            stagedFiles,
            unpushedCommits,
            selectedCommitHash,
            headBranch: currentBranch,
            githubPublishContext: props.githubPublishContext
        }),
        [
            branches,
            changeSource,
            currentBranch,
            draftMode,
            props.githubPublishContext,
            remotes,
            selectedCommitHash,
            stagedFiles,
            unstagedFiles,
            unpushedCommits
        ]
    )
    const hasGitHubRemote = Boolean(preferredRemote?.pushUrl && buildGitHubPullRequestUrl({
        remoteUrl: preferredRemote.pushUrl,
        baseBranch: targetBranch || 'main',
        headBranch: currentBranch || 'head',
        title: draftTitle || 'Draft PR',
        body: draftBody || 'Draft body',
        draft: draftMode
    }))
    const publishPreview = executionPlan.publishPlan
    const primaryActionLabel = 'Open PR Draft'

    function persistProjectConfig() {
        updateSettings({
            gitProjectPullRequestConfigs: mergeProjectPullRequestConfig(settings, projectPath, {
                guideSource,
                guide: projectGuideConfig,
                targetBranch,
                draft: draftMode,
                changeSource
            })
        })
    }

    async function handlePickGuideFile() {
        const result = await window.devscope.selectMarkdownFile()
        if (!result?.success) {
            if (result?.error) showToast(result.error, undefined, undefined, 'error')
            return
        }
        if (!result.filePath) return
        setGuideMode('file')
        setGuideFilePath(result.filePath)
        setStatusMessage({
            tone: 'info',
            text: `Using ${getPathTail(result.filePath)} as the project PR guide.`
        })
    }

    async function ensureDraft() {
        if (draftTitle.trim() && draftBody.trim()) {
            return { title: draftTitle.trim(), body: draftBody.trim() }
        }

        const guideTextValue = await resolvePullRequestGuideText(settings, projectPath, guideSource, projectGuideConfig)
        const diffContext = await buildDiffContext({
            projectName,
            currentBranch,
            targetBranch,
            scopeLabel: changeSourceLabel,
            projectPath,
            changeSource,
            unstagedFiles,
            stagedFiles,
            unpushedCommits,
            selectedCommitHash,
            guideText: guideTextValue
        })
        const provider = resolvePreferredPullRequestProvider(settings)

        if (!provider) {
            setDraftTitle(diffContext.fallbackDraft.title)
            setDraftBody(diffContext.fallbackDraft.body)
            return diffContext.fallbackDraft
        }

        const result = await window.devscope.generatePullRequestDraft(provider.provider, provider.apiKey, {
            projectName,
            currentBranch,
            targetBranch,
            scopeLabel: changeSourceLabel,
            diff: diffContext.diff,
            guideText: guideTextValue
        })

        if (!result?.success) throw new Error(result?.error || 'Failed to generate the PR draft.')

        const nextDraft = {
            title: String(result.title || '').trim(),
            body: String(result.body || '').trim()
        }
        if (!nextDraft.title || !nextDraft.body) throw new Error('PR draft generation returned empty content.')

        setDraftTitle(nextDraft.title)
        setDraftBody(nextDraft.body)
        return nextDraft
    }

    async function handleGenerateDraft() {
        if (executionPlan.missingReason) {
            setStatusMessage({ tone: 'error', text: executionPlan.missingReason })
            return null
        }

        persistProjectConfig()
        setIsGenerating(true)
        setStatusMessage(null)
        try {
            const provider = resolvePreferredPullRequestProvider(settings)
            const draft = await ensureDraft()
            setStatusMessage({
                tone: 'success',
                text: provider
                    ? `Draft generated with ${provider.provider === 'groq' ? 'Groq' : 'Gemini'}.`
                    : 'No AI key was configured, so DevScope used the built-in draft template.'
            })
            return draft
        } catch (err: any) {
            const message = err?.message || 'Failed to generate the PR draft.'
            setStatusMessage({ tone: 'error', text: message })
            showToast(message, undefined, undefined, 'error')
            return null
        } finally {
            setIsGenerating(false)
        }
    }

    async function handleCopyDraft() {
        const title = draftTitle.trim()
        const body = draftBody.trim()
        if (!title || !body) {
            setStatusMessage({ tone: 'error', text: 'Generate or write the PR title and body first.' })
            return
        }

        try {
            const copyResult = await window.devscope.copyToClipboard(`# ${title}\n\n${body}`)
            if (!copyResult?.success) throw new Error(copyResult?.error || 'Failed to copy the PR draft.')
            setStatusMessage({ tone: 'success', text: 'Copied the PR draft to the clipboard.' })
            showToast('Copied PR draft to the clipboard.')
        } catch (err: any) {
            const message = err?.message || 'Failed to copy the PR draft.'
            setStatusMessage({ tone: 'error', text: message })
            showToast(message, undefined, undefined, 'error')
        }
    }

    async function openGitHubPr() {
        if (!hasGitHubRemote || !preferredRemote?.pushUrl) {
            const message = 'This flow currently opens GitHub PRs only. Add a GitHub remote first.'
            setStatusMessage({ tone: 'error', text: message })
            showToast(message, undefined, undefined, 'error')
            return
        }
        if (executionPlan.missingReason) {
            setStatusMessage({ tone: 'error', text: executionPlan.missingReason })
            return
        }

        setIsExecuting(true)
        setStatusMessage(null)
        try {
            persistProjectConfig()
            const ensuredDraft = await ensureDraft()
            if (!ensuredDraft.title || !ensuredDraft.body) {
                throw new Error('Generate or write the PR title and body first.')
            }

            const prUrl = buildGitHubPullRequestUrl({
                remoteUrl: preferredRemote.pushUrl,
                baseBranch: targetBranch,
                headBranch: currentBranch,
                title: ensuredDraft.title,
                body: ensuredDraft.body,
                draft: draftMode
            })

            if (!prUrl) throw new Error('Could not build the GitHub PR URL for this remote.')
            window.open(prUrl, '_blank', 'noopener,noreferrer')
            showToast(draftMode ? 'Opened GitHub draft PR page.' : 'Opened GitHub PR page.')
            props.onClose()
        } catch (err: any) {
            const message = err?.message || 'Failed to open the PR flow.'
            setStatusMessage({ tone: 'error', text: message })
            showToast(message, undefined, undefined, 'error')
        } finally {
            setIsExecuting(false)
        }
    }

    return {
        preferredRemote,
        projectGuideConfig,
        selectedPushSummary,
        changeSourceLabel,
        targetBranchOptions,
        hasGitHubRemote,
        executionPlan,
        publishPreview,
        primaryActionLabel,
        isAdvancedOpen,
        isDraftEditorOpen,
        guideSource,
        guideMode,
        guideText,
        guideFilePath,
        targetBranch,
        draftMode,
        changeSource,
        selectedCommitHash,
        draftTitle,
        draftBody,
        statusMessage,
        isGenerating,
        isExecuting,
        setIsAdvancedOpen,
        setIsDraftEditorOpen,
        setGuideSource,
        setGuideMode,
        setGuideText,
        setGuideFilePath,
        setTargetBranch,
        setDraftMode,
        setChangeSource,
        setSelectedCommitHash,
        setDraftTitle,
        setDraftBody,
        persistProjectConfig,
        handlePickGuideFile,
        handleGenerateDraft,
        handleCopyDraft,
        openGitHubPr
    }
}
