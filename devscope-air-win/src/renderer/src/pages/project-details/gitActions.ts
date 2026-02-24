import type { GitCommit } from './types'

interface GitActionParams {
    decodedPath: string
    commitMessage: string
    changedFiles: Array<{ path: string }>
    gitUser: { name: string; email: string } | null
    repoOwner: string | null
    settings: any
    unpushedCommits: GitCommit[]
    targetBranch: string
    currentBranch: string
    branchName: 'main' | 'master' | 'custom'
    customBranchName: string
    createGitignore: boolean
    gitignoreTemplate: string
    selectedPatterns: Set<string>
    createInitialCommit: boolean
    initialCommitMessage: string
    remoteUrl: string
    dontShowAuthorWarning: boolean
    projectPath?: string
    refreshGitData: (refreshFileTree?: boolean) => Promise<void>
    showToast: (message: string, actionLabel?: string, actionTo?: string) => void
    setSelectedCommit: (commit: GitCommit | null) => void
    setLoadingDiff: (loading: boolean) => void
    setCommitDiff: (diff: string) => void
    setShowAuthorMismatch: (show: boolean) => void
    setIsGeneratingCommitMessage: (loading: boolean) => void
    setError: (value: string | null) => void
    setCommitMessage: (value: string) => void
    setIsCommitting: (loading: boolean) => void
    setIsPushing: (loading: boolean) => void
    setIsSwitchingBranch: (loading: boolean) => void
    setIsInitializing: (loading: boolean) => void
    setIsGitRepo: (value: boolean) => void
    setInitStep: (step: 'config' | 'remote') => void
    setRemoteUrl: (value: string) => void
    setHasRemote: (value: boolean) => void
    setShowInitModal: (value: boolean) => void
    setIsAddingRemote: (value: boolean) => void
}

export function createProjectGitActions(params: GitActionParams) {
    const performCommit = async () => {
        if (!params.decodedPath || !params.commitMessage.trim()) return

        params.setIsCommitting(true)
        try {
            const filePaths = params.changedFiles.map((file) => file.path)
            const stageResult = await window.devscope.stageFiles(params.decodedPath, filePaths)
            if (!stageResult?.success) {
                throw new Error(stageResult?.error || 'Failed to stage files')
            }

            const commitResult = await window.devscope.createCommit(params.decodedPath, params.commitMessage)
            if (!commitResult?.success) {
                throw new Error(commitResult?.error || 'Failed to create commit')
            }

            params.setCommitMessage('')
            await params.refreshGitData(true)
        } catch (err: any) {
            params.setError(`Failed to commit: ${err.message}`)
        } finally {
            params.setIsCommitting(false)
        }
    }

    const handleCommitClick = async (commit: GitCommit) => {
        if (!params.decodedPath) return

        params.setSelectedCommit(commit)
        params.setLoadingDiff(true)
        params.setCommitDiff('')

        try {
            const result = await window.devscope.getCommitDiff(params.decodedPath, commit.hash)
            if (result.success) {
                params.setCommitDiff(result.diff)
            } else {
                params.setCommitDiff(`Error loading diff: ${result.error}`)
            }
        } catch (err: any) {
            params.setCommitDiff(`Error: ${err.message}`)
        } finally {
            params.setLoadingDiff(false)
        }
    }

    const handleCommit = async () => {
        if (!params.decodedPath || !params.commitMessage.trim() || params.changedFiles.length === 0) return

        const shouldWarn = localStorage.getItem('dontShowAuthorWarning') !== 'true'
        if (shouldWarn && params.gitUser && params.repoOwner && params.gitUser.name !== params.repoOwner) {
            params.setShowAuthorMismatch(true)
            return
        }

        await performCommit()
    }

    const handleGenerateCommitMessage = async () => {
        if (!params.decodedPath || params.changedFiles.length === 0) return

        const providerOrder = params.settings.commitAIProvider === 'groq'
            ? (['groq', 'gemini'] as const)
            : (['gemini', 'groq'] as const)

        const selectedProvider = providerOrder.find((provider) => {
            if (provider === 'groq') return Boolean(params.settings.groqApiKey?.trim())
            return Boolean(params.settings.geminiApiKey?.trim())
        })

        if (!selectedProvider) {
            params.showToast(
                'No API key configured for commit generation.',
                'Open AI Settings',
                '/settings/ai'
            )
            return
        }

        const apiKey = selectedProvider === 'groq' ? params.settings.groqApiKey : params.settings.geminiApiKey

        params.setIsGeneratingCommitMessage(true)
        params.setError(null)
        try {
            const contextResult = await window.devscope.getWorkingChangesForAI(params.decodedPath)
            if (!contextResult?.success) {
                throw new Error(contextResult?.error || 'Failed to read working changes')
            }

            const generateResult = await window.devscope.generateCommitMessage(
                selectedProvider,
                apiKey,
                contextResult.context || ''
            )

            if (!generateResult?.success) {
                throw new Error(generateResult?.error || 'Failed to generate commit message')
            }
            if (!generateResult.message) {
                throw new Error('Failed to generate commit message')
            }

            params.setCommitMessage(generateResult.message.trim())
        } catch (err: any) {
            params.setError(`AI generation failed: ${err.message || 'Unknown error'}`)
        } finally {
            params.setIsGeneratingCommitMessage(false)
        }
    }

    const handlePush = async () => {
        if (!params.decodedPath || params.unpushedCommits.length === 0) return

        params.setIsPushing(true)
        try {
            const pushResult = await window.devscope.pushCommits(params.decodedPath)
            if (!pushResult?.success) {
                throw new Error(pushResult?.error || 'Failed to push commits')
            }

            await params.refreshGitData(false)
        } catch (err: any) {
            params.setError(`Failed to push: ${err.message}`)
        } finally {
            params.setIsPushing(false)
        }
    }

    const handleSwitchBranch = async () => {
        if (!params.decodedPath || !params.targetBranch || params.targetBranch === params.currentBranch) return

        params.setIsSwitchingBranch(true)
        try {
            const checkoutResult = await window.devscope.checkoutBranch(params.decodedPath, params.targetBranch, {
                autoStash: true,
                autoCleanupLock: true
            })
            if (!checkoutResult?.success) {
                throw new Error(checkoutResult?.error || 'Failed to switch branch')
            }

            await params.refreshGitData(true)
            if (checkoutResult?.cleanedLock && checkoutResult?.stashed) {
                params.showToast(`Recovered stale Git lock and auto-stashed changes (${checkoutResult.stashRef || 'stash@{0}'}).`)
            } else if (checkoutResult?.cleanedLock) {
                params.showToast('Recovered stale Git lock and switched branch.')
            } else if (checkoutResult?.stashed) {
                params.showToast(`Switched branch after auto-stashing local changes (${checkoutResult.stashRef || 'stash@{0}'}).`)
            }
        } catch (err: any) {
            params.setError(`Failed to switch branch: ${err.message}`)
        } finally {
            params.setIsSwitchingBranch(false)
        }
    }

    const handleInitGit = async () => {
        if (!params.decodedPath) return

        params.setIsInitializing(true)
        try {
            let gitignoreContent: string | undefined
            if (params.createGitignore && params.gitignoreTemplate) {
                if (params.gitignoreTemplate === 'Custom') {
                    const result = await window.devscope.generateCustomGitignoreContent(Array.from(params.selectedPatterns))
                    if (result.success) {
                        gitignoreContent = result.content
                    }
                } else {
                    const result = await window.devscope.generateGitignoreContent(params.gitignoreTemplate)
                    if (result.success) {
                        gitignoreContent = result.content
                    }
                }
            }

            const finalBranchName = params.branchName === 'custom' ? params.customBranchName : params.branchName

            const initResult = await window.devscope.initGitRepo(
                params.decodedPath,
                finalBranchName,
                params.createGitignore,
                gitignoreContent
            )

            if (!initResult.success) {
                params.setError(`Failed to initialize git: ${initResult.error}`)
                params.setIsInitializing(false)
                return
            }

            params.setIsGitRepo(true)

            if (params.createInitialCommit) {
                const commitResult = await window.devscope.createInitialCommit(
                    params.decodedPath,
                    params.initialCommitMessage
                )

                if (!commitResult.success) {
                    params.setError(`Git initialized but failed to create initial commit: ${commitResult.error}`)
                }
            }

            await params.refreshGitData(true)
            params.setInitStep('remote')
        } catch (err: any) {
            params.setError(`Failed to initialize git: ${err.message}`)
        } finally {
            params.setIsInitializing(false)
        }
    }

    const handleAddRemote = async () => {
        if (!params.decodedPath || !params.remoteUrl.trim()) return

        params.setIsAddingRemote(true)
        try {
            const result = await window.devscope.addRemoteOrigin(params.decodedPath, params.remoteUrl)

            if (!result.success) {
                params.setError(`Failed to add remote: ${result.error}`)
                params.setIsAddingRemote(false)
                return
            }

            params.setShowInitModal(false)
            params.setInitStep('config')
            params.setRemoteUrl('')
            params.setIsGitRepo(true)
            params.setHasRemote(true)

            await params.refreshGitData(true)
        } catch (err: any) {
            params.setError(`Failed to add remote: ${err.message}`)
        } finally {
            params.setIsAddingRemote(false)
        }
    }

    const handleSkipRemote = async () => {
        params.setShowInitModal(false)
        params.setInitStep('config')
        params.setRemoteUrl('')
        params.setIsGitRepo(true)
        params.setHasRemote(false)

        await params.refreshGitData(true)
    }

    const handleAuthorMismatchConfirm = () => {
        if (params.dontShowAuthorWarning) {
            localStorage.setItem('dontShowAuthorWarning', 'true')
        }
        params.setShowAuthorMismatch(false)
        void performCommit()
    }

    const handleOpenInExplorer = async () => {
        if (params.projectPath) {
            try {
                const result = await window.devscope.openInExplorer?.(params.projectPath)
                if (result && !result.success) {
                    alert(`Failed to open folder: ${result.error}`)
                }
            } catch (err) {
                alert(`Failed to invoke openInExplorer: ${err}`)
            }
        }
    }

    return {
        handleCommitClick,
        handleCommit,
        handleGenerateCommitMessage,
        handlePush,
        handleSwitchBranch,
        handleInitGit,
        handleAddRemote,
        handleSkipRemote,
        handleAuthorMismatchConfirm,
        handleOpenInExplorer
    }
}
