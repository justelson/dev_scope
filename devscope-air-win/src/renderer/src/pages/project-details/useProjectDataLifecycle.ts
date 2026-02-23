import { useCallback, useEffect, useRef } from 'react'
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
    setActiveTab: Dispatch<SetStateAction<'readme' | 'files' | 'git'>>
    setLoadingGit: Dispatch<SetStateAction<boolean>>
    setIsGitRepo: Dispatch<SetStateAction<boolean | null>>
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
    setActiveTab,
    setLoadingGit,
    setIsGitRepo,
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
    setActivePorts
}: UseProjectDataLifecycleParams) {
    const loadDetailsRequestRef = useRef(0)

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
            const treePromise = window.devscope.getFileTree(decodedPath, { showHidden: true, maxDepth: -1 })
            const detailsResult = await window.devscope.getProjectDetails(decodedPath)

            if (isStale()) return

            if (detailsResult.success) {
                setProject(detailsResult.project)
                setCachedProjectDetails(decodedPath, detailsResult.project)
                if (detailsResult.project.readme) {
                    setActiveTab('readme')
                }
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
        }
    }, [decodedPath, setLoading, setError, setProject, setActiveTab, setFileTree])

    const refreshGitData = useCallback(async (refreshFileTree: boolean = false) => {
        if (!decodedPath) return

        setLoadingGit(true)
        await yieldToBrowserPaint()

        try {
            if (refreshFileTree) {
                const treeResult = await window.devscope.getFileTree(decodedPath, { showHidden: true, maxDepth: -1 })
                if (treeResult?.success && treeResult.tree) {
                    setFileTree(treeResult.tree)
                }
            }

            const repoResult = await window.devscope.checkIsGitRepo(decodedPath)
            if (!repoResult?.success) {
                throw new Error(repoResult?.error || 'Failed to check git repository')
            }

            if (!repoResult.isGitRepo) {
                setIsGitRepo(false)
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
                return
            }

            setIsGitRepo(true)

            const responses = await Promise.allSettled([
                window.devscope.getGitStatus(decodedPath),
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

            if (statusResult.status === 'fulfilled' && statusResult.value?.success) {
                setGitStatusMap(statusResult.value.status || {})
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
        } catch (err: any) {
            setError(err?.message || 'Failed to load git details')
        } finally {
            setLoadingGit(false)
        }
    }, [
        decodedPath,
        setLoadingGit,
        setFileTree,
        setIsGitRepo,
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

    useEffect(() => {
        void loadProjectDetails()
    }, [loadProjectDetails])

    useEffect(() => {
        setGitHistory([])
        setUnpushedCommits([])
        setGitUser(null)
        setRepoOwner(null)
        setHasRemote(null)
        setIsGitRepo(null)
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
        setIsGitRepo,
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
        void refreshGitData(true)
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
        refreshGitData
    }
}
