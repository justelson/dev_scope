import { useCallback, useEffect, useRef } from 'react'
import { unstable_batchedUpdates } from 'react-dom'
import {
    getCachedFileTree,
    getCachedProjectDetails,
    setCachedFileTree,
    setCachedProjectDetails
} from '@/lib/projectViewCache'
import type { Dispatch, MutableRefObject, SetStateAction } from 'react'
import type {
    FileTreeNode,
    GitBranchSummary,
    GitCommit,
    GitRemoteSummary,
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

interface UseProjectDataLifecycleParams {
    decodedPath: string
    activeTab: 'readme' | 'files' | 'git'
    project: ProjectDetails | null
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
    setGitError: Dispatch<SetStateAction<string | null>>
    setIsGitRepo: Dispatch<SetStateAction<boolean | null>>
    setGitStatusDetails: Dispatch<SetStateAction<GitStatusDetail[]>>
    setGitHistory: Dispatch<SetStateAction<GitCommit[]>>
    setUnpushedCommits: Dispatch<SetStateAction<GitCommit[]>>
    setGitUser: Dispatch<SetStateAction<{ name: string; email: string } | null>>
    setRepoOwner: Dispatch<SetStateAction<string | null>>
    setHasRemote: Dispatch<SetStateAction<boolean | null>>
    setGitStatusMap: Dispatch<SetStateAction<Record<string, FileTreeNode['gitStatus']>>>
    setBranches: Dispatch<SetStateAction<GitBranchSummary[]>>
    setRemotes: Dispatch<SetStateAction<GitRemoteSummary[]>>
    setTags: Dispatch<SetStateAction<GitTagSummary[]>>
    setStashes: Dispatch<SetStateAction<GitStashSummary[]>>
    setTargetBranch: Dispatch<SetStateAction<string>>
    setGitView: Dispatch<SetStateAction<'changes' | 'history' | 'unpushed' | 'manage'>>
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
    project,
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
    setGitError,
    setIsGitRepo,
    setGitStatusDetails,
    setGitHistory,
    setUnpushedCommits,
    setGitUser,
    setRepoOwner,
    setHasRemote,
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
    const refreshGitRequestRef = useRef(0)
    const refreshFilesRequestRef = useRef(0)

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
        }

        setError(null)
        if (!hasCachedProject) {
            await yieldToBrowserPaint()
        }

        try {
            setLoadingFiles(true)
            const treePromise = window.devscope.getFileTree(decodedPath, { showHidden: true, maxDepth: -1 })
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

            const treeResult = await treePromise
            if (isStale()) return
            if (treeResult.success) {
                setFileTree(treeResult.tree)
                setCachedFileTree(decodedPath, treeResult.tree)
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
            if (!isStale()) {
                setLoadingFiles(false)
            }
        }
    }, [decodedPath, setLoading, setError, setProject, setFileTree, setLoadingFiles])

    const refreshGitData = useCallback(async (
        refreshFileTree: boolean = false,
        options?: { quiet?: boolean }
    ) => {
        if (!decodedPath) return

        const requestId = ++refreshGitRequestRef.current
        const isStaleRefresh = () => requestId !== refreshGitRequestRef.current
        const quiet = Boolean(options?.quiet)
        if (!quiet) {
            setLoadingGit(true)
        }
        await yieldToBrowserPaint()

        try {
            if (refreshFileTree) {
                setLoadingFiles(true)
                try {
                    const treeResult = await window.devscope.getFileTree(decodedPath, { showHidden: true, maxDepth: -1 })
                    if (!isStaleRefresh() && treeResult?.success && treeResult.tree) {
                        setFileTree(treeResult.tree)
                    }
                } finally {
                    if (!isStaleRefresh()) {
                        setLoadingFiles(false)
                    }
                }
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
                    setUnpushedCommits([])
                    setGitUser(null)
                    setRepoOwner(null)
                    setHasRemote(false)
                    setGitStatusMap({})
                    setBranches([])
                    setRemotes([])
                    setTags([])
                    setStashes([])
                })
                return
            }

            const responses = await Promise.allSettled([
                window.devscope.getGitStatusDetailed(decodedPath),
                window.devscope.getGitHistory(decodedPath),
                window.devscope.getUnpushedCommits(decodedPath),
                window.devscope.getGitUser(decodedPath),
                window.devscope.getRepoOwner(decodedPath),
                window.devscope.hasRemoteOrigin(decodedPath),
                window.devscope.listBranches(decodedPath),
                window.devscope.listRemotes(decodedPath),
                window.devscope.listTags(decodedPath),
                window.devscope.listStashes(decodedPath)
            ])
            if (isStaleRefresh()) return

            const [
                statusResult,
                historyResult,
                unpushedResult,
                userResult,
                ownerResult,
                remoteResult,
                branchesResult,
                remotesResult,
                tagsResult,
                stashesResult
            ] = responses

            const readErrors: string[] = []
            const appendError = (label: string, result: PromiseSettledResult<any>) => {
                if (result.status === 'rejected') {
                    readErrors.push(`${label}: ${result.reason?.message || 'request failed'}`)
                    return
                }
                if (!result.value?.success) {
                    readErrors.push(`${label}: ${result.value?.error || 'request failed'}`)
                }
            }

            appendError('status', statusResult)
            appendError('history', historyResult)
            appendError('unpushed', unpushedResult)
            appendError('user', userResult)
            appendError('owner', ownerResult)
            appendError('remote', remoteResult)
            appendError('branches', branchesResult)
            appendError('remotes', remotesResult)
            appendError('tags', tagsResult)
            appendError('stashes', stashesResult)

            let nextGitError: string | null = null
            if (readErrors.length > 0) {
                const preview = readErrors.slice(0, 3).join(' | ')
                const suffix = readErrors.length > 3 ? ` (+${readErrors.length - 3} more)` : ''
                nextGitError = `Git data partially loaded: ${preview}${suffix}`
            }

            unstable_batchedUpdates(() => {
                setIsGitRepo(true)
                setGitError(nextGitError)

                if (statusResult.status === 'fulfilled' && statusResult.value?.success) {
                    const details = (statusResult.value.entries || []) as GitStatusDetail[]
                    setGitStatusDetails(details)
                    const statusMap: Record<string, FileTreeNode['gitStatus']> = {}
                    for (const detail of details) {
                        statusMap[detail.path] = detail.status
                        statusMap[detail.path.replace(/\//g, '\\')] = detail.status
                        if (detail.previousPath) {
                            statusMap[detail.previousPath] = 'renamed'
                            statusMap[detail.previousPath.replace(/\//g, '\\')] = 'renamed'
                        }
                    }
                    setGitStatusMap(statusMap)
                }
                if (historyResult.status === 'fulfilled' && historyResult.value?.success) {
                    setGitHistory(historyResult.value.commits || [])
                }
                if (unpushedResult.status === 'fulfilled' && unpushedResult.value?.success) {
                    setUnpushedCommits(unpushedResult.value.commits || [])
                }
                if (userResult.status === 'fulfilled' && userResult.value?.success) {
                    setGitUser(userResult.value.user || null)
                }
                if (ownerResult.status === 'fulfilled' && ownerResult.value?.success) {
                    setRepoOwner(ownerResult.value.owner || null)
                }
                if (remoteResult.status === 'fulfilled' && remoteResult.value?.success) {
                    setHasRemote(remoteResult.value.hasRemote)
                }
                if (branchesResult.status === 'fulfilled' && branchesResult.value?.success) {
                    setBranches(branchesResult.value.branches || [])
                }
                if (remotesResult.status === 'fulfilled' && remotesResult.value?.success) {
                    setRemotes(remotesResult.value.remotes || [])
                }
                if (tagsResult.status === 'fulfilled' && tagsResult.value?.success) {
                    setTags(tagsResult.value.tags || [])
                }
                if (stashesResult.status === 'fulfilled' && stashesResult.value?.success) {
                    setStashes(stashesResult.value.stashes || [])
                }
            })
        } catch (err: any) {
            if (!isStaleRefresh()) {
                setGitError(err?.message || 'Failed to load git details')
            }
        } finally {
            if (!isStaleRefresh()) {
                if (!quiet) {
                    setLoadingGit(false)
                }
            }
        }
    }, [
        decodedPath,
        setLoadingGit,
        setGitError,
        setFileTree,
        setIsGitRepo,
        setGitStatusDetails,
        setGitHistory,
        setUnpushedCommits,
        setGitUser,
        setRepoOwner,
        setHasRemote,
        setGitStatusMap,
        setBranches,
        setRemotes,
        setTags,
        setStashes,
        setError
    ])

    const refreshFileTree = useCallback(async () => {
        if (!decodedPath) return

        const requestId = ++refreshFilesRequestRef.current
        const isStaleRefresh = () => requestId !== refreshFilesRequestRef.current
        setLoadingFiles(true)

        try {
            const treeResult = await window.devscope.getFileTree(decodedPath, { showHidden: true, maxDepth: -1 })
            if (!isStaleRefresh() && treeResult?.success && treeResult.tree) {
                setFileTree(treeResult.tree)
                setCachedFileTree(decodedPath, treeResult.tree)
            }
        } finally {
            if (!isStaleRefresh()) {
                setLoadingFiles(false)
            }
        }
    }, [decodedPath, setFileTree, setLoadingFiles])

    useEffect(() => {
        void loadProjectDetails()
    }, [loadProjectDetails])

    useEffect(() => {
        setGitHistory([])
        setUnpushedCommits([])
        setGitUser(null)
        setRepoOwner(null)
        setHasRemote(null)
        setGitError(null)
        setIsGitRepo(null)
        setGitStatusDetails([])
        setGitStatusMap({})
        setBranches([])
        setRemotes([])
        setTags([])
        setStashes([])
        setTargetBranch('')
        setGitView('manage')
        setCommitPage(1)
        setUnpushedPage(1)
        setChangesPage(1)
    }, [
        decodedPath,
        setGitHistory,
        setUnpushedCommits,
        setGitUser,
        setRepoOwner,
        setHasRemote,
        setGitError,
        setIsGitRepo,
        setGitStatusDetails,
        setGitStatusMap,
        setBranches,
        setRemotes,
        setTags,
        setStashes,
        setTargetBranch,
        setGitView,
        setCommitPage,
        setUnpushedPage,
        setChangesPage
    ])

    useEffect(() => {
        if (!decodedPath) return
        void refreshGitData(false)
    }, [decodedPath, refreshGitData])

    useEffect(() => {
        if (activeTab !== 'git' || !decodedPath) return
        void refreshGitData(false)
    }, [activeTab, decodedPath, refreshGitData])

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
