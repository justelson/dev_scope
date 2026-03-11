import { useCallback, useEffect, useRef } from 'react'
import { unstable_batchedUpdates } from 'react-dom'
import {
    getCachedFileTree,
    getCachedProjectGitSnapshot,
    getCachedProjectDetails,
    setCachedFileTree,
    setCachedProjectGitSnapshot,
    setCachedProjectDetails
} from '@/lib/projectViewCache'
import { isFileTreeFullyLoaded, mergeDirectoryChildren } from './fileTreeUtils'
import type { Dispatch, MutableRefObject, SetStateAction } from 'react'
import type {
    FileTreeNode,
    GitBranchSummary,
    GitCommit,
    GitRemoteSummary,
    GitSyncStatus,
    GitStatusDetail,
    GitStashSummary,
    GitTagSummary,
    ProjectDetails
} from './types'

async function yieldToBrowserPaint(): Promise<void> {
    await new Promise<void>((resolve) => {
        if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
            window.requestAnimationFrame(() => resolve())
            return
        }
        setTimeout(resolve, 0)
    })
}

const INCOMING_COMMITS_LIMIT = 50

type GitRefreshMode = 'working' | 'history' | 'unpushed' | 'pulls' | 'full'

function getRefreshModeForGitView(gitView: 'changes' | 'history' | 'unpushed' | 'pulls' | 'manage'): GitRefreshMode {
    if (gitView === 'changes') return 'working'
    if (gitView === 'history') return 'history'
    if (gitView === 'unpushed') return 'unpushed'
    if (gitView === 'pulls') return 'pulls'
    return 'full'
}

function hasFocusedGitDataForView(input: {
    gitView: 'changes' | 'history' | 'unpushed' | 'pulls' | 'manage'
    isGitRepo: boolean | null
    gitStatusDetails: GitStatusDetail[]
    gitHistory: GitCommit[]
    gitHistoryTotalCount: number
    incomingCommits: GitCommit[]
    unpushedCommits: GitCommit[]
    gitUser: { name: string; email: string } | null
    repoOwner: string | null
    hasRemote: boolean | null
    gitSyncStatus: GitSyncStatus | null
    branches: GitBranchSummary[]
    remotes: GitRemoteSummary[]
    tags: GitTagSummary[]
    stashes: GitStashSummary[]
}): boolean {
    if (input.gitView === 'history') return input.gitHistoryTotalCount > 0 || input.gitHistory.length > 0
    if (input.gitView === 'changes') return input.gitStatusDetails.length > 0
    if (input.gitView === 'unpushed') {
        return input.unpushedCommits.length > 0 || input.gitSyncStatus !== null || input.hasRemote === false
    }
    if (input.gitView === 'pulls') {
        return input.incomingCommits.length > 0 || input.gitSyncStatus !== null || input.hasRemote === false
    }

    return hasVisibleGitData({
        isGitRepo: input.isGitRepo,
        gitStatusDetails: input.gitStatusDetails,
        gitHistory: input.gitHistory,
        gitHistoryTotalCount: input.gitHistoryTotalCount,
        incomingCommits: input.incomingCommits,
        unpushedCommits: input.unpushedCommits,
        gitUser: input.gitUser,
        repoOwner: input.repoOwner,
        hasRemote: input.hasRemote,
        gitSyncStatus: input.gitSyncStatus,
        branches: input.branches,
        remotes: input.remotes,
        tags: input.tags,
        stashes: input.stashes
    })
}

function mergeCommitStats(previousCommits: GitCommit[], nextCommits: GitCommit[]): GitCommit[] {
    if (previousCommits.length === 0 || nextCommits.length === 0) {
        return nextCommits
    }

    const previousByHash = new Map(previousCommits.map((commit) => [commit.hash, commit]))
    return nextCommits.map((commit) => {
        const previous = previousByHash.get(commit.hash)
        if (!previous || previous.statsLoaded !== true) {
            return commit
        }

        return {
            ...commit,
            additions: previous.additions,
            deletions: previous.deletions,
            filesChanged: previous.filesChanged,
            statsLoaded: true
        }
    })
}

function mergeGitStatusDetailStats(previousDetails: GitStatusDetail[], nextDetails: GitStatusDetail[]): GitStatusDetail[] {
    if (previousDetails.length === 0 || nextDetails.length === 0) {
        return nextDetails
    }

    const previousByPath = new Map(previousDetails.map((detail) => [detail.path.replace(/\\/g, '/'), detail]))
    return nextDetails.map((detail) => {
        const previous = previousByPath.get(detail.path.replace(/\\/g, '/'))
        if (!previous || previous.statsLoaded !== true) {
            return detail
        }

        return {
            ...detail,
            additions: previous.additions,
            deletions: previous.deletions,
            stagedAdditions: previous.stagedAdditions,
            stagedDeletions: previous.stagedDeletions,
            unstagedAdditions: previous.unstagedAdditions,
            unstagedDeletions: previous.unstagedDeletions,
            statsLoaded: true
        }
    })
}

function hasVisibleGitData(input: {
    isGitRepo: boolean | null
    gitStatusDetails: GitStatusDetail[]
    gitHistory: GitCommit[]
    gitHistoryTotalCount: number
    incomingCommits: GitCommit[]
    unpushedCommits: GitCommit[]
    gitUser: { name: string; email: string } | null
    repoOwner: string | null
    hasRemote: boolean | null
    gitSyncStatus: GitSyncStatus | null
    branches: GitBranchSummary[]
    remotes: GitRemoteSummary[]
    tags: GitTagSummary[]
    stashes: GitStashSummary[]
}): boolean {
    return input.isGitRepo === false
        || input.gitStatusDetails.length > 0
        || input.gitHistory.length > 0
        || input.gitHistoryTotalCount > 0
        || input.incomingCommits.length > 0
        || input.unpushedCommits.length > 0
        || input.gitUser !== null
        || input.repoOwner !== null
        || input.hasRemote !== null
        || input.gitSyncStatus !== null
        || input.branches.length > 0
        || input.remotes.length > 0
        || input.tags.length > 0
        || input.stashes.length > 0
}

function parseRepoOwnerFromRemoteUrl(remoteUrl: string): string | null {
    const trimmed = String(remoteUrl || '').trim()
    if (!trimmed) return null

    const sshScpMatch = trimmed.match(/^[^@]+@[^:]+:([^/]+)\/.+$/)
    if (sshScpMatch?.[1]) return sshScpMatch[1]

    try {
        const url = new URL(trimmed)
        const segments = url.pathname.split('/').filter(Boolean)
        return segments[0] || null
    } catch {
        return null
    }
}

function resolveRepoOwnerFromRemotes(remotes: GitRemoteSummary[]): string | null {
    const origin = remotes.find((remote) => remote.name === 'origin')
    const remoteUrl = origin?.fetchUrl || origin?.pushUrl || ''
    return parseRepoOwnerFromRemoteUrl(remoteUrl)
}

interface UseProjectDataLifecycleParams {
    decodedPath: string
    activeTab: 'readme' | 'files' | 'git'
    gitView: 'changes' | 'history' | 'unpushed' | 'pulls' | 'manage'
    project: ProjectDetails | null
    fileTree: FileTreeNode[]
    isGitRepo: boolean | null
    gitStatusDetails: GitStatusDetail[]
    gitHistory: GitCommit[]
    gitHistoryTotalCount: number
    incomingCommits: GitCommit[]
    unpushedCommits: GitCommit[]
    gitUser: { name: string; email: string } | null
    repoOwner: string | null
    hasRemote: boolean | null
    gitSyncStatus: GitSyncStatus | null
    gitStatusMap: Record<string, FileTreeNode['gitStatus']>
    branches: GitBranchSummary[]
    remotes: GitRemoteSummary[]
    tags: GitTagSummary[]
    stashes: GitStashSummary[]
    historyLimit: number
    autoRefreshGitOnProjectOpen: boolean
    showInitModal: boolean
    gitignoreTemplate: string
    availableTemplates: string[]
    availablePatterns: any[]
    readmeExpanded: boolean
    readmeCollapsedMaxHeight: number
    readmeContentRef: MutableRefObject<HTMLDivElement | null>
    setLoading: Dispatch<SetStateAction<boolean>>
    setError: Dispatch<SetStateAction<string | null>>
    setProject: Dispatch<SetStateAction<ProjectDetails | null>>
    setFileTree: Dispatch<SetStateAction<FileTreeNode[]>>
    setLoadingGit: Dispatch<SetStateAction<boolean>>
    setLoadingGitHistory: Dispatch<SetStateAction<boolean>>
    setGitError: Dispatch<SetStateAction<string | null>>
    setIsGitRepo: Dispatch<SetStateAction<boolean | null>>
    setGitStatusDetails: Dispatch<SetStateAction<GitStatusDetail[]>>
    setGitHistory: Dispatch<SetStateAction<GitCommit[]>>
    setGitHistoryTotalCount: Dispatch<SetStateAction<number>>
    setIncomingCommits: Dispatch<SetStateAction<GitCommit[]>>
    setUnpushedCommits: Dispatch<SetStateAction<GitCommit[]>>
    setGitUser: Dispatch<SetStateAction<{ name: string; email: string } | null>>
    setRepoOwner: Dispatch<SetStateAction<string | null>>
    setHasRemote: Dispatch<SetStateAction<boolean | null>>
    setGitSyncStatus: Dispatch<SetStateAction<GitSyncStatus | null>>
    setGitStatusMap: Dispatch<SetStateAction<Record<string, FileTreeNode['gitStatus']>>>
    setBranches: Dispatch<SetStateAction<GitBranchSummary[]>>
    setRemotes: Dispatch<SetStateAction<GitRemoteSummary[]>>
    setTags: Dispatch<SetStateAction<GitTagSummary[]>>
    setStashes: Dispatch<SetStateAction<GitStashSummary[]>>
    setTargetBranch: Dispatch<SetStateAction<string>>
    setGitView: Dispatch<SetStateAction<'changes' | 'history' | 'unpushed' | 'pulls' | 'manage'>>
    setCommitPage: Dispatch<SetStateAction<number>>
    setUnpushedPage: Dispatch<SetStateAction<number>>
    setChangesPage: Dispatch<SetStateAction<number>>
    setAvailableTemplates: Dispatch<SetStateAction<string[]>>
    setGitignoreTemplate: Dispatch<SetStateAction<string>>
    setAvailablePatterns: Dispatch<SetStateAction<any[]>>
    setSelectedPatterns: Dispatch<SetStateAction<Set<string>>>
    setReadmeExpanded: Dispatch<SetStateAction<boolean>>
    setReadmeNeedsExpand: Dispatch<SetStateAction<boolean>>
    setIsProjectLive: Dispatch<SetStateAction<boolean>>
    setActivePorts: Dispatch<SetStateAction<number[]>>
    setLoadingFiles: Dispatch<SetStateAction<boolean>>
}

export function useProjectDataLifecycle({
    decodedPath,
    activeTab,
    gitView,
    project,
    fileTree,
    isGitRepo,
    gitStatusDetails,
    gitHistory,
    gitHistoryTotalCount,
    incomingCommits,
    unpushedCommits,
    gitUser,
    repoOwner,
    hasRemote,
    gitSyncStatus,
    gitStatusMap,
    branches,
    remotes,
    tags,
    stashes,
    historyLimit,
    autoRefreshGitOnProjectOpen,
    showInitModal,
    gitignoreTemplate,
    availableTemplates,
    availablePatterns,
    readmeExpanded,
    readmeCollapsedMaxHeight,
    readmeContentRef,
    setLoading,
    setError,
    setProject,
    setFileTree,
    setLoadingGit,
    setLoadingGitHistory,
    setGitError,
    setIsGitRepo,
    setGitStatusDetails,
    setGitHistory,
    setGitHistoryTotalCount,
    setIncomingCommits,
    setUnpushedCommits,
    setGitUser,
    setRepoOwner,
    setHasRemote,
    setGitSyncStatus,
    setGitStatusMap,
    setBranches,
    setRemotes,
    setTags,
    setStashes,
    setTargetBranch,
    setGitView,
    setCommitPage,
    setUnpushedPage,
    setChangesPage,
    setAvailableTemplates,
    setGitignoreTemplate,
    setAvailablePatterns,
    setSelectedPatterns,
    setReadmeExpanded,
    setReadmeNeedsExpand,
    setIsProjectLive,
    setActivePorts,
    setLoadingFiles
}: UseProjectDataLifecycleParams) {
    const loadDetailsRequestRef = useRef(0)
    const refreshGitForegroundRequestRef = useRef(0)
    const refreshGitBackgroundRequestRef = useRef(0)
    const refreshFilesRequestRef = useRef(0)
    const refreshGitDataRef = useRef<((refreshFilesToo?: boolean, options?: { quiet?: boolean; mode?: GitRefreshMode }) => Promise<void>) | null>(null)
    const fileTreeRef = useRef(fileTree)
    const gitStatusDetailsRef = useRef(gitStatusDetails)
    const gitSensorTokenRef = useRef<string | null>(null)
    const previousGitTabStateRef = useRef({
        activeTab,
        decodedPath,
        gitView
    })

    useEffect(() => {
        fileTreeRef.current = fileTree
    }, [fileTree])

    useEffect(() => {
        gitStatusDetailsRef.current = gitStatusDetails
    }, [gitStatusDetails])

    const measureReadmeOverflow = useCallback(() => {
        const element = readmeContentRef.current
        if (!element) {
            setReadmeNeedsExpand(false)
            return
        }

        const hasOverflow = element.scrollHeight > readmeCollapsedMaxHeight + 12
        setReadmeNeedsExpand(hasOverflow)
    }, [readmeContentRef, setReadmeNeedsExpand, readmeCollapsedMaxHeight])

    useEffect(() => {
        setReadmeExpanded(false)
    }, [project?.path, project?.readme, setReadmeExpanded])

    useEffect(() => {
        if (!project?.readme) {
            setReadmeNeedsExpand(false)
            return
        }

        const rafId = requestAnimationFrame(measureReadmeOverflow)
        const lateMeasure1 = window.setTimeout(measureReadmeOverflow, 120)
        const lateMeasure2 = window.setTimeout(measureReadmeOverflow, 600)

        let observer: ResizeObserver | null = null
        if (readmeContentRef.current && typeof ResizeObserver !== 'undefined') {
            observer = new ResizeObserver(() => measureReadmeOverflow())
            observer.observe(readmeContentRef.current)
        }

        return () => {
            cancelAnimationFrame(rafId)
            clearTimeout(lateMeasure1)
            clearTimeout(lateMeasure2)
            observer?.disconnect()
        }
    }, [project?.readme, activeTab, readmeExpanded, measureReadmeOverflow, readmeContentRef, setReadmeNeedsExpand])

    const loadProjectDetails = useCallback(async () => {
        if (!decodedPath) return

        const requestId = ++loadDetailsRequestRef.current
        const isStale = () => requestId !== loadDetailsRequestRef.current
        const cachedProject = getCachedProjectDetails(decodedPath)
        const cachedTree = getCachedFileTree(decodedPath)
        const hasCachedProject = Boolean(cachedProject)

        if (cachedProject) {
            setProject(cachedProject as any)
            setError(null)
            setLoading(false)
        } else {
            setLoading(true)
        }
        if (cachedTree) {
            setFileTree(cachedTree as any)
            fileTreeRef.current = cachedTree as FileTreeNode[]
            setLoadingFiles(false)
        } else {
            setFileTree([])
            fileTreeRef.current = []
            setLoadingFiles(false)
        }

        setError(null)
        if (!hasCachedProject) {
            await yieldToBrowserPaint()
        }

        try {
            const detailsResult = await window.devscope.getProjectDetails(decodedPath)

            if (isStale()) return

            if (detailsResult.success) {
                setProject(detailsResult.project)
                setCachedProjectDetails(decodedPath, detailsResult.project)
                setError(null)
                setLoading(false)
            } else {
                if (!hasCachedProject) {
                    setError(detailsResult.error || 'Failed to load project details')
                }
                setLoading(false)
            }

        } catch (err: any) {
            if (isStale()) return
            if (!hasCachedProject) {
                setError(err.message || 'Failed to load project')
            }
        } finally {
            if (!isStale() && !hasCachedProject) {
                setLoading(false)
            }
        }
    }, [decodedPath, setLoading, setError, setProject, setFileTree, setLoadingFiles])

    const refreshFileTree = useCallback(async (options?: { deep?: boolean; targetPath?: string }) => {
        if (!decodedPath) return undefined

        const requestId = ++refreshFilesRequestRef.current
        const isStaleRefresh = () => requestId !== refreshFilesRequestRef.current
        const targetPath = typeof options?.targetPath === 'string' && options.targetPath.trim().length > 0
            ? options.targetPath.trim()
            : undefined
        const currentTree = fileTreeRef.current
        const deep = options?.deep ?? !targetPath
        setLoadingFiles(true)

        try {
            const treeResult = await window.devscope.getFileTree(decodedPath, {
                showHidden: true,
                maxDepth: deep ? -1 : 1,
                rootPath: targetPath
            })
            if (isStaleRefresh() || !treeResult?.success || !treeResult.tree) {
                return undefined
            }

            if (targetPath) {
                const mergedTree = mergeDirectoryChildren(currentTree, targetPath, treeResult.tree as FileTreeNode[])
                fileTreeRef.current = mergedTree
                setFileTree(mergedTree)
                setCachedFileTree(decodedPath, mergedTree)
                return mergedTree
            }

            fileTreeRef.current = treeResult.tree as FileTreeNode[]
            setFileTree(treeResult.tree)
            setCachedFileTree(decodedPath, treeResult.tree)
            return treeResult.tree as FileTreeNode[]
        } finally {
            if (!isStaleRefresh()) {
                setLoadingFiles(false)
            }
        }
    }, [decodedPath, setFileTree, setLoadingFiles])

    const refreshGitData = useCallback(async (
        refreshFilesToo: boolean = false,
        options?: { quiet?: boolean; mode?: GitRefreshMode }
    ) => {
        if (!decodedPath) return

        const quiet = Boolean(options?.quiet)
        const mode = options?.mode || 'full'
        const visibleRequestId = quiet ? refreshGitForegroundRequestRef.current : ++refreshGitForegroundRequestRef.current
        const backgroundRequestId = quiet ? ++refreshGitBackgroundRequestRef.current : refreshGitBackgroundRequestRef.current
        const isStaleRefresh = () => quiet
            ? (
                backgroundRequestId !== refreshGitBackgroundRequestRef.current
                || visibleRequestId !== refreshGitForegroundRequestRef.current
            )
            : visibleRequestId !== refreshGitForegroundRequestRef.current
        const cachedGitSnapshot = getCachedProjectGitSnapshot(decodedPath)
        const hasVisibleFocusedData = hasFocusedGitDataForView({
            gitView,
            isGitRepo,
            gitStatusDetails,
            gitHistory,
            gitHistoryTotalCount,
            incomingCommits,
            unpushedCommits,
            gitUser,
            repoOwner,
            hasRemote,
            gitSyncStatus,
            branches,
            remotes,
            tags,
            stashes
        })
        const hasWarmGitData = hasVisibleGitData({
            isGitRepo,
            gitStatusDetails,
            gitHistory,
            gitHistoryTotalCount,
            incomingCommits,
            unpushedCommits,
            gitUser,
            repoOwner,
            hasRemote,
            gitSyncStatus,
            branches,
            remotes,
            tags,
            stashes
        }) || Boolean(cachedGitSnapshot)
        const shouldShowForegroundLoading = !quiet && !(
            hasVisibleFocusedData
            || hasWarmGitData
        )
        const shouldUseHistoryLoading = !quiet && activeTab === 'git' && gitView === 'history'

        if (shouldUseHistoryLoading) {
            setLoadingGitHistory(true)
        } else if (shouldShowForegroundLoading) {
            setLoadingGit(true)
        }
        if (shouldShowForegroundLoading || shouldUseHistoryLoading) {
            await yieldToBrowserPaint()
        }

        try {
            if (refreshFilesToo) {
                await refreshFileTree({
                    deep: isFileTreeFullyLoaded(fileTree)
                })
            }

            const repoResult = await window.devscope.checkIsGitRepo(decodedPath)
            if (!repoResult?.success) {
                throw new Error(repoResult?.error || 'Failed to check git repository')
            }

            if (!repoResult.isGitRepo) {
                if (isStaleRefresh()) return
                unstable_batchedUpdates(() => {
                    setGitError(null)
                    setIsGitRepo(false)
                    gitStatusDetailsRef.current = []
                    setGitStatusDetails([])
                    setGitHistory([])
                    setGitHistoryTotalCount(0)
                    setIncomingCommits([])
                    setUnpushedCommits([])
                    setGitUser(null)
                    setRepoOwner(null)
                    setHasRemote(false)
                    setGitSyncStatus(null)
                    setGitStatusMap({})
                    setBranches([])
                    setRemotes([])
                    setTags([])
                    setStashes([])
                })
                return
            }

            const readErrors: string[] = []
            const appendError = (label: string, error: unknown) => {
                const message = error instanceof Error ? error.message : String(error || 'request failed')
                readErrors.push(`${label}: ${message}`)
            }

            const applyDetailedStatus = (details: GitStatusDetail[]) => {
                const mergedDetails = mergeGitStatusDetailStats(gitStatusDetailsRef.current, details)
                const statusMap: Record<string, FileTreeNode['gitStatus']> = {}
                for (const detail of mergedDetails) {
                    statusMap[detail.path] = detail.status
                    statusMap[detail.path.replace(/\//g, '\\')] = detail.status
                    if (detail.previousPath) {
                        statusMap[detail.previousPath] = 'renamed'
                        statusMap[detail.previousPath.replace(/\//g, '\\')] = 'renamed'
                    }
                }
                gitStatusDetailsRef.current = mergedDetails
                setGitStatusDetails(mergedDetails)
                setGitStatusMap(statusMap)
            }

            setIsGitRepo(true)

            const includeStatusStats = activeTab === 'git' && gitView === 'changes'

            if (mode === 'working') {
                try {
                    const statusResult = await window.devscope.getGitStatusDetailed(decodedPath, {
                        includeStats: includeStatusStats
                    })
                    if (isStaleRefresh()) return
                    if (statusResult?.success) {
                        applyDetailedStatus((statusResult.entries || []) as GitStatusDetail[])
                    } else {
                        appendError('status', statusResult?.error || 'request failed')
                    }
                } catch (error) {
                    if (isStaleRefresh()) return
                    appendError('status', error)
                }

                setGitError(readErrors.length > 0 ? readErrors.join(' | ') : null)
                return
            }

            const shouldLoadIdentity = mode === 'full'
            const shouldLoadManageMetadata = mode === 'full'
            const shouldLoadSync = true
            const shouldLoadUnpushed = mode === 'full' || mode === 'unpushed'
            const shouldLoadHistory = mode === 'full' || mode === 'history'
            const shouldLoadHistoryCount = mode === 'full' || mode === 'history'
            const shouldLoadIncomingCommits = mode === 'pulls' || (mode === 'full' && activeTab === 'git' && (gitView === 'pulls' || gitView === 'manage'))
            const tasks: Array<{
                label: string
                task: Promise<any>
                apply: (result: any) => void
            }> = [
                {
                    label: 'status',
                    task: window.devscope.getGitStatusDetailed(decodedPath, {
                        includeStats: includeStatusStats
                    }),
                    apply: (result) => {
                        if (result?.success) {
                            applyDetailedStatus((result.entries || []) as GitStatusDetail[])
                            return
                        }
                        appendError('status', result?.error || 'request failed')
                    }
                }
            ]

            if (shouldLoadSync) {
                tasks.push({
                    label: 'sync',
                    task: window.devscope.getGitSyncStatus(decodedPath),
                    apply: (result) => {
                        if (result?.success) {
                            setGitSyncStatus(result.sync || null)
                            setHasRemote(result.sync?.hasRemote ?? false)
                            gitSensorTokenRef.current = result.sync?.statusToken || null
                            return
                        }
                        appendError('sync', result?.error || 'request failed')
                    }
                })
            }

            if (shouldLoadIdentity) {
                tasks.push({
                    label: 'user',
                    task: window.devscope.getGitUser(decodedPath),
                    apply: (result) => {
                        if (result?.success) {
                            setGitUser(result.user || null)
                            return
                        }
                        appendError('user', result?.error || 'request failed')
                    }
                })
            }

            if (shouldLoadUnpushed) {
                tasks.push({
                    label: 'unpushed',
                    task: window.devscope.getUnpushedCommits(decodedPath),
                    apply: (result) => {
                        if (result?.success) {
                            setUnpushedCommits((prev) => mergeCommitStats(prev, result.commits || []))
                            return
                        }
                        appendError('unpushed', result?.error || 'request failed')
                    }
                })
            }

            if (shouldLoadHistory) {
                tasks.push({
                    label: 'history',
                    task: window.devscope.getGitHistory(decodedPath, historyLimit, {
                        all: false,
                        includeStats: false
                    }),
                    apply: (result) => {
                        if (result?.success) {
                            setGitHistory((prev) => mergeCommitStats(prev, result.commits || []))
                            return
                        }
                        appendError('history', result?.error || 'request failed')
                    }
                })
            }

            if (shouldLoadHistoryCount) {
                tasks.push({
                    label: 'history-count',
                    task: window.devscope.getGitHistoryCount(decodedPath, { all: false }),
                    apply: (result) => {
                        if (result?.success) {
                            setGitHistoryTotalCount(typeof result.totalCount === 'number' ? Math.max(0, result.totalCount) : 0)
                            return
                        }
                        appendError('history-count', result?.error || 'request failed')
                    }
                })
            }

            if (shouldLoadIncomingCommits) {
                tasks.push({
                    label: 'incoming',
                    task: window.devscope.getIncomingCommits(decodedPath, INCOMING_COMMITS_LIMIT),
                    apply: (result) => {
                        if (result?.success) {
                            setIncomingCommits(result.commits || [])
                            return
                        }
                        appendError('incoming', result?.error || 'request failed')
                    }
                })
            }

            if (shouldLoadManageMetadata) {
                tasks.push(
                    {
                        label: 'branches',
                        task: window.devscope.listBranches(decodedPath),
                        apply: (result) => {
                            if (result?.success) {
                                setBranches(result.branches || [])
                                return
                            }
                            appendError('branches', result?.error || 'request failed')
                        }
                    },
                    {
                        label: 'remotes',
                        task: window.devscope.listRemotes(decodedPath),
                        apply: (result) => {
                            if (result?.success) {
                                const nextRemotes = result.remotes || []
                                setRemotes(nextRemotes)
                                if (shouldLoadIdentity) {
                                    setRepoOwner(resolveRepoOwnerFromRemotes(nextRemotes))
                                }
                                return
                            }
                            appendError('remotes', result?.error || 'request failed')
                        }
                    },
                    {
                        label: 'tags',
                        task: window.devscope.listTags(decodedPath),
                        apply: (result) => {
                            if (result?.success) {
                                setTags(result.tags || [])
                                return
                            }
                            appendError('tags', result?.error || 'request failed')
                        }
                    },
                    {
                        label: 'stashes',
                        task: window.devscope.listStashes(decodedPath),
                        apply: (result) => {
                            if (result?.success) {
                                setStashes(result.stashes || [])
                                return
                            }
                            appendError('stashes', result?.error || 'request failed')
                        }
                    }
                )
            }

            const settledTasks = await Promise.allSettled(tasks.map((entry) => entry.task))
            if (isStaleRefresh()) return

            unstable_batchedUpdates(() => {
                settledTasks.forEach((result, index) => {
                    if (result.status === 'rejected') {
                        appendError(tasks[index].label, result.reason)
                        return
                    }
                    tasks[index].apply(result.value)
                })
            })

            if (readErrors.length > 0) {
                const preview = readErrors.slice(0, 3).join(' | ')
                const suffix = readErrors.length > 3 ? ` (+${readErrors.length - 3} more)` : ''
                setGitError(`Git data partially loaded: ${preview}${suffix}`)
            } else {
                setGitError(null)
            }
        } catch (err: any) {
            if (!isStaleRefresh()) {
                setGitError(err?.message || 'Failed to load git details')
            }
        } finally {
            if (!isStaleRefresh()) {
                if (!quiet) {
                    if (shouldUseHistoryLoading) {
                        setLoadingGitHistory(false)
                    } else {
                        setLoadingGit(false)
                    }
                }
            }
        }
    }, [
        activeTab,
        decodedPath,
        gitView,
        gitHistory,
        gitHistoryTotalCount,
        setLoadingGit,
        setLoadingGitHistory,
        setGitError,
        setFileTree,
        setIsGitRepo,
        setGitStatusDetails,
        setGitHistory,
        setGitHistoryTotalCount,
        setIncomingCommits,
        setUnpushedCommits,
        setGitUser,
        setRepoOwner,
        setHasRemote,
        setGitSyncStatus,
        setGitStatusMap,
        setBranches,
        setRemotes,
        setTags,
        setStashes,
        fileTree,
        historyLimit,
        refreshFileTree
    ])

    useEffect(() => {
        refreshGitDataRef.current = refreshGitData
    }, [refreshGitData])

    useEffect(() => {
        void loadProjectDetails()
    }, [loadProjectDetails])

    useEffect(() => {
        if (!decodedPath) return

        const cachedTree = getCachedFileTree(decodedPath)
        if (cachedTree) {
            setFileTree(cachedTree as any)
            setLoadingFiles(false)
            if (!isFileTreeFullyLoaded(cachedTree as FileTreeNode[])) {
                void refreshFileTree({ deep: true })
            }
            return
        }

        void refreshFileTree({ deep: true })
    }, [decodedPath, refreshFileTree, setFileTree, setLoadingFiles])

    useEffect(() => {
        if (!decodedPath) return

        const cachedGit = getCachedProjectGitSnapshot(decodedPath)
        gitSensorTokenRef.current = null

        if (cachedGit) {
            setIsGitRepo(typeof cachedGit.isGitRepo === 'boolean' ? cachedGit.isGitRepo : null)
            setGitStatusDetails(Array.isArray(cachedGit.gitStatusDetails) ? cachedGit.gitStatusDetails : [])
            setGitHistory(Array.isArray(cachedGit.gitHistory) ? cachedGit.gitHistory : [])
            setGitHistoryTotalCount(typeof cachedGit.gitHistoryTotalCount === 'number' ? cachedGit.gitHistoryTotalCount : 0)
            setIncomingCommits(Array.isArray(cachedGit.incomingCommits) ? cachedGit.incomingCommits : [])
            setUnpushedCommits(Array.isArray(cachedGit.unpushedCommits) ? cachedGit.unpushedCommits : [])
            setGitUser(cachedGit.gitUser || null)
            setRepoOwner(typeof cachedGit.repoOwner === 'string' ? cachedGit.repoOwner : null)
            setHasRemote(typeof cachedGit.hasRemote === 'boolean' ? cachedGit.hasRemote : null)
            setGitSyncStatus(cachedGit.gitSyncStatus || null)
            setGitStatusMap(cachedGit.gitStatusMap && typeof cachedGit.gitStatusMap === 'object' ? cachedGit.gitStatusMap : {})
            setBranches(Array.isArray(cachedGit.branches) ? cachedGit.branches : [])
            setRemotes(Array.isArray(cachedGit.remotes) ? cachedGit.remotes : [])
            setTags(Array.isArray(cachedGit.tags) ? cachedGit.tags : [])
            setStashes(Array.isArray(cachedGit.stashes) ? cachedGit.stashes : [])
            setGitError(null)
            setLoadingGit(false)
            setLoadingGitHistory(false)
        } else {
            setGitHistory([])
            setGitHistoryTotalCount(0)
            setIncomingCommits([])
            setUnpushedCommits([])
            setGitUser(null)
            setRepoOwner(null)
            setHasRemote(null)
            setGitSyncStatus(null)
            setGitError(null)
            setIsGitRepo(null)
            setGitStatusDetails([])
            setGitStatusMap({})
            setBranches([])
            setRemotes([])
            setTags([])
            setStashes([])
            setLoadingGit(false)
            setLoadingGitHistory(false)
        }

        setTargetBranch('')
        setGitView('manage')
        setCommitPage(1)
        setUnpushedPage(1)
        setChangesPage(1)
    }, [
        decodedPath,
        setBranches,
        setGitHistory,
        setGitHistoryTotalCount,
        setIncomingCommits,
        setGitStatusDetails,
        setGitStatusMap,
        setGitSyncStatus,
        setGitUser,
        setHasRemote,
        setLoadingGit,
        setLoadingGitHistory,
        setIsGitRepo,
        setRemotes,
        setRepoOwner,
        setStashes,
        setTags,
        setUnpushedCommits,
        setGitError,
        setTargetBranch,
        setGitView,
        setCommitPage,
        setUnpushedPage,
        setChangesPage
    ])

    useEffect(() => {
        if (!decodedPath || isGitRepo === null) return

        setCachedProjectGitSnapshot(decodedPath, {
            isGitRepo,
            gitStatusDetails,
            gitHistory,
            gitHistoryTotalCount,
            incomingCommits,
            unpushedCommits,
            gitUser,
            repoOwner,
            hasRemote,
            gitSyncStatus,
            gitStatusMap,
            branches,
            remotes,
            tags,
            stashes
        })
    }, [
        decodedPath,
        isGitRepo,
        gitStatusDetails,
        gitHistory,
        gitHistoryTotalCount,
        incomingCommits,
        unpushedCommits,
        gitUser,
        repoOwner,
        hasRemote,
        gitSyncStatus,
        gitStatusMap,
        branches,
        remotes,
        tags,
        stashes
    ])

    useEffect(() => {
        if (!decodedPath) return
        if (activeTab === 'git') return
        void refreshGitDataRef.current?.(false, { quiet: true, mode: 'full' })
    }, [activeTab, decodedPath])

    useEffect(() => {
        const previous = previousGitTabStateRef.current
        const enteringGitTab = previous.activeTab !== 'git' || previous.decodedPath !== decodedPath
        const switchingGitView = previous.activeTab === 'git'
            && previous.decodedPath === decodedPath
            && previous.gitView !== gitView

        previousGitTabStateRef.current = {
            activeTab,
            decodedPath,
            gitView
        }

        if (activeTab !== 'git' || !decodedPath) return

        const mode = getRefreshModeForGitView(gitView)
        const hasFocusedData = hasFocusedGitDataForView({
            gitView,
            isGitRepo,
            gitStatusDetails,
            gitHistory,
            gitHistoryTotalCount,
            incomingCommits,
            unpushedCommits,
            gitUser,
            repoOwner,
            hasRemote,
            gitSyncStatus,
            branches,
            remotes,
            tags,
            stashes
        })

        if (switchingGitView && hasFocusedData) {
            return
        }

        void refreshGitData(false, hasFocusedData && enteringGitTab ? { quiet: true, mode } : { mode })
    }, [activeTab, decodedPath, gitHistoryTotalCount, gitView, refreshGitData])

    useEffect(() => {
        if (!decodedPath || !autoRefreshGitOnProjectOpen) return
        const intervalId = window.setInterval(() => {
            void refreshGitDataRef.current?.(false, { quiet: true, mode: 'working' })
        }, 12000)
        return () => window.clearInterval(intervalId)
    }, [autoRefreshGitOnProjectOpen, decodedPath])

    useEffect(() => {
        if (!decodedPath || activeTab !== 'git' || gitView !== 'changes' || autoRefreshGitOnProjectOpen) return
        const intervalId = window.setInterval(() => {
            void refreshGitDataRef.current?.(false, { quiet: true, mode: 'working' })
        }, 45000)
        return () => window.clearInterval(intervalId)
    }, [activeTab, autoRefreshGitOnProjectOpen, decodedPath, gitView])

    useEffect(() => {
        if (!decodedPath || activeTab !== 'git' || gitView === 'changes') return
        const intervalId = window.setInterval(() => {
            void refreshGitDataRef.current?.(false, { quiet: true, mode: getRefreshModeForGitView(gitView) })
        }, 90000)
        return () => window.clearInterval(intervalId)
    }, [activeTab, decodedPath, gitView])

    useEffect(() => {
        if (!decodedPath || !autoRefreshGitOnProjectOpen) return

        let cancelled = false

        const pollSyncStatus = async () => {
            try {
                const result = await window.devscope.getGitSyncStatus(decodedPath)
                if (cancelled || !result?.success || !result.sync) return

                const previousToken = gitSensorTokenRef.current
                const nextToken = result.sync.statusToken
                gitSensorTokenRef.current = nextToken
                setGitSyncStatus(result.sync)
                setHasRemote(result.sync.hasRemote)

                if (result.sync.behind > 0 && activeTab === 'git' && (gitView === 'pulls' || gitView === 'manage')) {
                    const incomingResult = await window.devscope.getIncomingCommits(decodedPath, INCOMING_COMMITS_LIMIT)
                    if (!cancelled && incomingResult?.success) {
                        setIncomingCommits(incomingResult.commits || [])
                    }
                } else if (result.sync.behind === 0 && activeTab === 'git' && (gitView === 'pulls' || gitView === 'manage')) {
                    setIncomingCommits([])
                }

                if (!previousToken || previousToken === nextToken) return

                const shouldRunFullRefresh = result.sync.headHash !== gitSyncStatus?.headHash
                    || result.sync.upstreamHeadHash !== gitSyncStatus?.upstreamHeadHash
                    || result.sync.ahead !== gitSyncStatus?.ahead
                    || result.sync.behind !== gitSyncStatus?.behind
                    || result.sync.currentBranch !== gitSyncStatus?.currentBranch

                void refreshGitData(false, {
                    quiet: true,
                    mode: shouldRunFullRefresh ? getRefreshModeForGitView(gitView) : 'working'
                })
            } catch {
                // Keep the sensor silent.
            }
        }

        void pollSyncStatus()
        const intervalId = window.setInterval(() => {
            void pollSyncStatus()
        }, 15000)

        return () => {
            cancelled = true
            window.clearInterval(intervalId)
        }
    }, [
        activeTab,
        autoRefreshGitOnProjectOpen,
        decodedPath,
        gitSyncStatus?.ahead,
        gitSyncStatus?.behind,
        gitSyncStatus?.currentBranch,
        gitSyncStatus?.headHash,
        gitSyncStatus?.upstreamHeadHash,
        gitView,
        refreshGitData,
        setGitSyncStatus,
        setHasRemote,
        setIncomingCommits
    ])

    useEffect(() => {
        if (showInitModal && availableTemplates.length === 0) {
            window.devscope.getGitignoreTemplates().then((result) => {
                if (result.success) {
                    setAvailableTemplates(result.templates)

                    if (project?.type) {
                        const typeMap: Record<string, string> = {
                            node: 'Node.js',
                            python: 'Python',
                            rust: 'Rust',
                            go: 'Go',
                            java: 'Java',
                            dotnet: '.NET',
                            ruby: 'Ruby',
                            php: 'PHP',
                            cpp: 'C/C++',
                            dart: 'Dart/Flutter',
                            elixir: 'Elixir'
                        }
                        const detectedTemplate = typeMap[project.type] || 'General'
                        setGitignoreTemplate(detectedTemplate)
                    } else {
                        setGitignoreTemplate('General')
                    }
                }
            })
        }
    }, [showInitModal, availableTemplates.length, project?.type, setAvailableTemplates, setGitignoreTemplate])

    useEffect(() => {
        if (gitignoreTemplate === 'Custom' && availablePatterns.length === 0) {
            window.devscope.getGitignorePatterns().then((result) => {
                if (result.success) {
                    setAvailablePatterns(result.patterns)

                    if (project?.type) {
                        const autoSelect = new Set<string>()
                        autoSelect.add('env_files')
                        autoSelect.add('logs')
                        autoSelect.add('cache')
                        autoSelect.add('macos')
                        autoSelect.add('windows')
                        autoSelect.add('linux')

                        if (project.type === 'node') {
                            autoSelect.add('node_modules')
                            autoSelect.add('dist')
                            autoSelect.add('next_build')
                            autoSelect.add('npm_logs')
                        } else if (project.type === 'python') {
                            autoSelect.add('python_venv')
                            autoSelect.add('dist')
                            autoSelect.add('coverage')
                        } else if (project.type === 'rust') {
                            autoSelect.add('rust_target')
                        } else if (project.type === 'go') {
                            autoSelect.add('go_vendor')
                            autoSelect.add('compiled')
                        } else if (project.type === 'java' || project.type === 'dotnet') {
                            autoSelect.add('compiled')
                            autoSelect.add('dotnet_build')
                        }

                        autoSelect.add('vscode')
                        autoSelect.add('idea')
                        autoSelect.add('vim')
                        setSelectedPatterns(autoSelect)
                    }
                }
            })
        }
    }, [gitignoreTemplate, availablePatterns.length, project?.type, setAvailablePatterns, setSelectedPatterns])

    useEffect(() => {
        const checkProjectStatus = async () => {
            if (!project?.path) return

            try {
                const processResult = await window.devscope.getProjectProcesses(project.path)
                if (processResult.success) {
                    setIsProjectLive(processResult.isLive)
                    setActivePorts(processResult.activePorts || [])
                }
            } catch (e) {
                console.error('[ProjectDetails] Failed to check project status:', e)
            }
        }

        checkProjectStatus()
        const interval = setInterval(checkProjectStatus, 3000)
        return () => clearInterval(interval)
    }, [project?.path, setIsProjectLive, setActivePorts])

    return {
        loadProjectDetails,
        refreshGitData,
        refreshFileTree
    }
}
