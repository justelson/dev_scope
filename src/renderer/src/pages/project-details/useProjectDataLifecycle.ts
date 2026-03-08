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

const HISTORY_COMMIT_LIMIT = 80
const INCOMING_COMMITS_LIMIT = 50

type GitRefreshMode = 'working' | 'unpushed' | 'pulls' | 'full'

function getRefreshModeForGitView(gitView: 'changes' | 'history' | 'unpushed' | 'pulls' | 'manage'): GitRefreshMode {
    if (gitView === 'changes') return 'working'
    if (gitView === 'unpushed') return 'unpushed'
    if (gitView === 'pulls') return 'pulls'
    return 'full'
}

function hasVisibleGitData(input: {
    isGitRepo: boolean | null
    gitStatusDetails: GitStatusDetail[]
    gitHistory: GitCommit[]
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

interface UseProjectDataLifecycleParams {
    decodedPath: string
    activeTab: 'readme' | 'files' | 'git'
    gitView: 'changes' | 'history' | 'unpushed' | 'pulls' | 'manage'
    project: ProjectDetails | null
    fileTree: FileTreeNode[]
    isGitRepo: boolean | null
    gitStatusDetails: GitStatusDetail[]
    gitHistory: GitCommit[]
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
    const fileTreeRef = useRef(fileTree)
    const gitSensorTokenRef = useRef<string | null>(null)

    useEffect(() => {
        fileTreeRef.current = fileTree
    }, [fileTree])

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
        const hasVisibleFocusedData = (
            gitView === 'history'
                ? gitHistory.length > 0
                : gitView === 'changes'
                    ? gitStatusDetails.length > 0
                    : gitView === 'unpushed'
                        ? unpushedCommits.length > 0 || gitSyncStatus !== null || hasRemote === false
                        : gitView === 'pulls'
                            ? incomingCommits.length > 0 || gitSyncStatus !== null || hasRemote === false
                            : hasVisibleGitData({
                                isGitRepo,
                                gitStatusDetails,
                                gitHistory,
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
        )
        const hasWarmGitData = hasVisibleGitData({
            isGitRepo,
            gitStatusDetails,
            gitHistory,
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
                    setGitStatusDetails([])
                    setGitHistory([])
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
                const statusMap: Record<string, FileTreeNode['gitStatus']> = {}
                for (const detail of details) {
                    statusMap[detail.path] = detail.status
                    statusMap[detail.path.replace(/\//g, '\\')] = detail.status
                    if (detail.previousPath) {
                        statusMap[detail.previousPath] = 'renamed'
                        statusMap[detail.previousPath.replace(/\//g, '\\')] = 'renamed'
                    }
                }
                setGitStatusDetails(details)
                setGitStatusMap(statusMap)
            }

            setIsGitRepo(true)

            const includeStatusStats = activeTab === 'git' && gitView === 'changes'

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

            if (mode === 'working') {
                setGitError(readErrors.length > 0 ? readErrors.join(' | ') : null)
                return
            }

            const shouldLoadIdentity = mode === 'full'
            const shouldLoadManageMetadata = mode === 'full' && (activeTab !== 'git' || gitView === 'manage')
            const shouldLoadSync = mode !== 'working'
            const shouldLoadRemoteState = mode === 'full' || mode === 'unpushed' || mode === 'pulls'
            const shouldLoadUnpushed = mode === 'full' || mode === 'unpushed'
            const shouldLoadHistory = mode === 'full'
            const shouldLoadIncomingCommits = mode === 'pulls' || (mode === 'full' && activeTab === 'git' && (gitView === 'pulls' || gitView === 'manage'))

            const loadSequential = async <T,>(label: string, task: () => Promise<T>, onSuccess: (value: T) => void) => {
                try {
                    const result = await task()
                    if (isStaleRefresh()) return false
                    onSuccess(result)
                    return true
                } catch (error) {
                    if (isStaleRefresh()) return false
                    appendError(label, error)
                    return true
                }
            }

            if (shouldLoadIdentity) {
                if (!(await loadSequential('user', () => window.devscope.getGitUser(decodedPath), (result) => {
                    if (result?.success) {
                        setGitUser(result.user || null)
                    } else {
                        appendError('user', result?.error || 'request failed')
                    }
                }))) return

                if (!(await loadSequential('owner', () => window.devscope.getRepoOwner(decodedPath), (result) => {
                    if (result?.success) {
                        setRepoOwner(result.owner || null)
                    } else {
                        appendError('owner', result?.error || 'request failed')
                    }
                }))) return
            }

            if (shouldLoadSync) {
                if (!(await loadSequential('sync', () => window.devscope.getGitSyncStatus(decodedPath), (result) => {
                    if (result?.success) {
                        setGitSyncStatus(result.sync || null)
                        setHasRemote(result.sync?.hasRemote ?? false)
                        gitSensorTokenRef.current = result.sync?.statusToken || null
                    } else {
                        appendError('sync', result?.error || 'request failed')
                    }
                }))) return
            }

            if (shouldLoadRemoteState) {
                if (!(await loadSequential('remote', () => window.devscope.hasRemoteOrigin(decodedPath), (result) => {
                    if (result?.success) {
                        setHasRemote(result.hasRemote)
                    } else {
                        appendError('remote', result?.error || 'request failed')
                    }
                }))) return
            }

            if (shouldLoadManageMetadata) {
                if (!(await loadSequential('branches', () => window.devscope.listBranches(decodedPath), (result) => {
                    if (result?.success) {
                        setBranches(result.branches || [])
                    } else {
                        appendError('branches', result?.error || 'request failed')
                    }
                }))) return

                if (!(await loadSequential('remotes', () => window.devscope.listRemotes(decodedPath), (result) => {
                    if (result?.success) {
                        setRemotes(result.remotes || [])
                    } else {
                        appendError('remotes', result?.error || 'request failed')
                    }
                }))) return
            }

            if (shouldLoadUnpushed) {
                if (!(await loadSequential('unpushed', () => window.devscope.getUnpushedCommits(decodedPath), (result) => {
                    if (result?.success) {
                        setUnpushedCommits(result.commits || [])
                    } else {
                        appendError('unpushed', result?.error || 'request failed')
                    }
                }))) return
            }

            if (shouldLoadHistory) {
                if (!(await loadSequential('history', () => window.devscope.getGitHistory(decodedPath, HISTORY_COMMIT_LIMIT, {
                    all: false,
                    includeStats: true
                }), (result) => {
                    if (result?.success) {
                        setGitHistory(result.commits || [])
                    } else {
                        appendError('history', result?.error || 'request failed')
                    }
                }))) return
            }

            if (shouldLoadIncomingCommits) {
                if (!(await loadSequential('incoming', () => window.devscope.getIncomingCommits(decodedPath, INCOMING_COMMITS_LIMIT), (result) => {
                    if (result?.success) {
                        setIncomingCommits(result.commits || [])
                    } else {
                        appendError('incoming', result?.error || 'request failed')
                    }
                }))) return
            }

            if (shouldLoadManageMetadata) {
                if (!(await loadSequential('tags', () => window.devscope.listTags(decodedPath), (result) => {
                    if (result?.success) {
                        setTags(result.tags || [])
                    } else {
                        appendError('tags', result?.error || 'request failed')
                    }
                }))) return

                if (!(await loadSequential('stashes', () => window.devscope.listStashes(decodedPath), (result) => {
                    if (result?.success) {
                        setStashes(result.stashes || [])
                    } else {
                        appendError('stashes', result?.error || 'request failed')
                    }
                }))) return
            }

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
        setLoadingGit,
        setLoadingGitHistory,
        setGitError,
        setFileTree,
        setIsGitRepo,
        setGitStatusDetails,
        setGitHistory,
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
        refreshFileTree
    ])

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
        if (!decodedPath || !autoRefreshGitOnProjectOpen) return
        void refreshGitData(false, { quiet: true, mode: 'working' })
    }, [autoRefreshGitOnProjectOpen, decodedPath, refreshGitData])

    useEffect(() => {
        if (activeTab !== 'git' || !decodedPath) return
        void refreshGitData(false, { mode: getRefreshModeForGitView(gitView) })
    }, [activeTab, decodedPath, gitView, refreshGitData])

    useEffect(() => {
        if (!decodedPath || !autoRefreshGitOnProjectOpen) return
        const intervalId = window.setInterval(() => {
            void refreshGitData(false, { quiet: true, mode: 'working' })
        }, 12000)
        return () => window.clearInterval(intervalId)
    }, [autoRefreshGitOnProjectOpen, decodedPath, refreshGitData])

    useEffect(() => {
        if (!decodedPath || activeTab !== 'git' || gitView !== 'changes' || autoRefreshGitOnProjectOpen) return
        const intervalId = window.setInterval(() => {
            void refreshGitData(false, { quiet: true, mode: 'working' })
        }, 45000)
        return () => window.clearInterval(intervalId)
    }, [activeTab, autoRefreshGitOnProjectOpen, decodedPath, gitView, refreshGitData])

    useEffect(() => {
        if (!decodedPath || activeTab !== 'git' || gitView === 'changes') return
        const intervalId = window.setInterval(() => {
            void refreshGitData(false, { quiet: true, mode: getRefreshModeForGitView(gitView) })
        }, 90000)
        return () => window.clearInterval(intervalId)
    }, [activeTab, decodedPath, gitView, refreshGitData])

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
