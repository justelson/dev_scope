/**
 * DevScope - Project Details Page
 * Premium Redesign with Right-Side Tools Panel
 */

import { useState, useEffect, useMemo, useRef, useCallback, startTransition, useDeferredValue } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
    ArrowLeft, FolderOpen, Terminal, ExternalLink,
    RefreshCw, Copy, Check, AlertCircle, BookOpen,
    ChevronRight, Search,
    GitBranch, GitCommitHorizontal, GitPullRequest, User,
    File, Folder, ChevronDown, ChevronUp,
    Eye, EyeOff, ChevronsUpDown, ChevronsDownUp, Plus, Link, Sparkles
} from 'lucide-react'
import { useTerminal } from '@/App'
import { cn, parseFileSearchQuery } from '@/lib/utils'
import ProjectIcon, { FrameworkBadge } from '@/components/ui/ProjectIcon'
import MarkdownRenderer from '@/components/ui/MarkdownRenderer'
import { FilePreviewModal, useFilePreview } from '@/components/ui/FilePreviewModal'
import { Select } from '@/components/ui/FormControls'
import { useSettings } from '@/lib/settings'
import { trackRecentProject } from '@/lib/recentProjects'
import { buildFileSearchIndex, searchFileIndex } from '@/lib/fileSearchIndex'
import { buildDirectoryChildInfoMap, formatFileSize, getAllFolderPaths } from './fileTreeUtils'
import { CommitDiffModal } from './CommitDiffModal'
import { GitGraph } from './GitGraph'
import { InitGitModal } from './InitGitModal'
import { AuthorMismatchModal, DependenciesModal } from './ProjectDetailsModals'
import { ProjectDetailsSidebar } from './ProjectDetailsSidebar'
import { ServerScriptRunModal } from './ServerScriptRunModal'
import { WorkingChangesView } from './WorkingChangesView'
import { getFileIcon } from './fileIcons'
import {
    appendScriptArgsForRunner,
    applyShellEnvOverrides,
    buildServerCliArgs,
    detectPackageScriptRunner,
    detectScriptIntentWithConfidence,
    getScriptCommand,
    parseEnvOverrideInput,
    type ScriptIntent,
    type ScriptIntentContext,
    type ScriptIntentPrediction,
    type ScriptRunDraft
} from './scriptRun'
import type {
    FileTreeNode,
    FrameworkDefinition,
    GitBranchSummary,
    GitCommit,
    GitRemoteSummary,
    GitStashSummary,
    GitTagSummary,
    PendingScriptRun,
    ProjectDetails,
    ProjectTypeDefinition
} from './types'

const EMPTY_SET = new Set<string>()
const README_COLLAPSED_MAX_HEIGHT = 500
const PREVIEWABLE_EXTENSIONS = new Set([
    'md', 'markdown', 'mdown', 'mdx',
    'html', 'htm',
    'json', 'jsonc', 'json5',
    'csv', 'tsv',
    'txt', 'log', 'ini', 'conf', 'env',
    'js', 'jsx', 'ts', 'tsx', 'mjs', 'cjs',
    'py', 'rb', 'java', 'kt', 'kts',
    'c', 'h', 'cpp', 'cxx', 'hpp', 'cs',
    'go', 'rs', 'php', 'swift', 'dart', 'scala', 'sql',
    'sh', 'bash', 'zsh', 'ps1', 'bat', 'cmd',
    'yml', 'yaml', 'toml', 'xml', 'css', 'scss', 'less', 'vue', 'svelte'
])
const PREVIEWABLE_FILE_NAMES = new Set([
    'dockerfile', 'makefile', '.gitignore', '.gitattributes', '.editorconfig', '.npmrc', '.eslintrc', '.prettierrc'
])

export default function ProjectDetailsPage() {
    const { projectPath } = useParams<{ projectPath: string }>()
    const navigate = useNavigate()
    const { openTerminal } = useTerminal()
    const { settings } = useSettings()

    // State
    const [project, setProject] = useState<ProjectDetails | null>(null)
    const [fileTree, setFileTree] = useState<FileTreeNode[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [showHidden, setShowHidden] = useState(false)
    const [copiedPath, setCopiedPath] = useState(false)
    const [activeTab, setActiveTab] = useState<'readme' | 'files' | 'git'>('files')
    const [showDependenciesModal, setShowDependenciesModal] = useState(false)
    // Live project indicator (running processes)
    const [isProjectLive, setIsProjectLive] = useState(false)
    const [activePorts, setActivePorts] = useState<number[]>([])

    // Git State
    const [gitHistory, setGitHistory] = useState<GitCommit[]>([])
    const [loadingGit, setLoadingGit] = useState(false)
    const [gitView, setGitView] = useState<'changes' | 'history' | 'unpushed' | 'manage'>('manage')
    const [commitPage, setCommitPage] = useState(1)
    const [unpushedPage, setUnpushedPage] = useState(1)
    const [changesPage, setChangesPage] = useState(1)
    const COMMITS_PER_PAGE = 15
    const ITEMS_PER_PAGE = 15

    // Commit Diff Modal State
    const [selectedCommit, setSelectedCommit] = useState<GitCommit | null>(null)
    const [commitDiff, setCommitDiff] = useState<string>('')
    const [loadingDiff, setLoadingDiff] = useState(false)

    // Git Management State
    const [unpushedCommits, setUnpushedCommits] = useState<GitCommit[]>([])
    const [gitUser, setGitUser] = useState<{ name: string; email: string } | null>(null)
    const [repoOwner, setRepoOwner] = useState<string | null>(null)
    const [commitMessage, setCommitMessage] = useState('')
    const [isCommitting, setIsCommitting] = useState(false)
    const [isGeneratingCommitMessage, setIsGeneratingCommitMessage] = useState(false)
    const [isPushing, setIsPushing] = useState(false)
    const [toast, setToast] = useState<{
        message: string
        visible: boolean
        actionLabel?: string
        actionTo?: string
    } | null>(null)
    const [showAuthorMismatch, setShowAuthorMismatch] = useState(false)
    const [dontShowAuthorWarning, setDontShowAuthorWarning] = useState(false)

    // Git Init State
    const [isGitRepo, setIsGitRepo] = useState<boolean | null>(null)
    const [showInitModal, setShowInitModal] = useState(false)
    const [initStep, setInitStep] = useState<'config' | 'remote'>('config')
    const [branchName, setBranchName] = useState<'main' | 'master' | 'custom'>('main')
    const [customBranchName, setCustomBranchName] = useState('')
    const [createGitignore, setCreateGitignore] = useState(true)
    const [gitignoreTemplate, setGitignoreTemplate] = useState<string>('')
    const [availableTemplates, setAvailableTemplates] = useState<string[]>([])
    const [createInitialCommit, setCreateInitialCommit] = useState(false)
    const [initialCommitMessage, setInitialCommitMessage] = useState('Initial commit')
    const [isInitializing, setIsInitializing] = useState(false)
    const [remoteUrl, setRemoteUrl] = useState('')
    const [isAddingRemote, setIsAddingRemote] = useState(false)
    const [hasRemote, setHasRemote] = useState<boolean | null>(null)
    const [branches, setBranches] = useState<GitBranchSummary[]>([])
    const [remotes, setRemotes] = useState<GitRemoteSummary[]>([])
    const [tags, setTags] = useState<GitTagSummary[]>([])
    const [stashes, setStashes] = useState<GitStashSummary[]>([])
    const [gitStatusMap, setGitStatusMap] = useState<Record<string, FileTreeNode['gitStatus']>>({})
    const [targetBranch, setTargetBranch] = useState('')
    const [isSwitchingBranch, setIsSwitchingBranch] = useState(false)

    // Custom Gitignore State
    const [showCustomGitignore, setShowCustomGitignore] = useState(false)
    const [availablePatterns, setAvailablePatterns] = useState<any[]>([])
    const [selectedPatterns, setSelectedPatterns] = useState<Set<string>>(new Set())
    const [patternSearch, setPatternSearch] = useState('')

    // File Preview Hook
    const {
        previewFile,
        previewContent,
        loadingPreview,
        previewTruncated,
        previewSize,
        previewBytes,
        openPreview,
        closePreview,
        openFile
    } = useFilePreview()

    // README State
    const [readmeExpanded, setReadmeExpanded] = useState(false)
    const [readmeNeedsExpand, setReadmeNeedsExpand] = useState(false)
    const readmeContentRef = useRef<HTMLDivElement | null>(null)


    // Files view state
    const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set())
    const [isExpandingFolders, setIsExpandingFolders] = useState(false)
    const [sortBy, setSortBy] = useState<'name' | 'size' | 'type'>('name')
    const [sortAsc, setSortAsc] = useState(true)
    const [fileSearch, setFileSearch] = useState('')
    const [pendingScriptRun, setPendingScriptRun] = useState<PendingScriptRun | null>(null)
    const [scriptPortInput, setScriptPortInput] = useState('')
    const [scriptExposeNetwork, setScriptExposeNetwork] = useState(false)
    const [scriptAdvancedOpen, setScriptAdvancedOpen] = useState(false)
    const [scriptExtraArgsInput, setScriptExtraArgsInput] = useState('')
    const [scriptEnvInput, setScriptEnvInput] = useState('')
    const [scriptRunError, setScriptRunError] = useState<string | null>(null)

    // Derived
    const decodedPath = projectPath ? decodeURIComponent(projectPath) : ''
    const currentBranch = useMemo(() => branches.find(branch => branch.current)?.name || '', [branches])

    useEffect(() => {
        setTargetBranch(currentBranch)
    }, [currentBranch])

    useEffect(() => {
        if (!decodedPath) return
        trackRecentProject(decodedPath, 'project')
    }, [decodedPath])

    // Go back function
    const goBack = () => {
        if (window.history.length > 1) {
            navigate(-1)
        } else {
            navigate('/projects')
        }
    }

    const showToast = (message: string, actionLabel?: string, actionTo?: string) => {
        setToast({ message, visible: false, actionLabel, actionTo })
        setTimeout(() => {
            setToast(prev => prev ? { ...prev, visible: true } : prev)
        }, 10)
    }

    useEffect(() => {
        if (!toast?.visible) return

        const hideTimer = setTimeout(() => {
            setToast(prev => prev ? { ...prev, visible: false } : prev)
        }, 2600)

        const removeTimer = setTimeout(() => {
            setToast(null)
        }, 3000)

        return () => {
            clearTimeout(hideTimer)
            clearTimeout(removeTimer)
        }
    }, [toast?.visible])

    const measureReadmeOverflow = useCallback(() => {
        const element = readmeContentRef.current
        if (!element) {
            setReadmeNeedsExpand(false)
            return
        }

        const hasOverflow = element.scrollHeight > README_COLLAPSED_MAX_HEIGHT + 12
        setReadmeNeedsExpand(hasOverflow)
    }, [])

    useEffect(() => {
        // Reset expansion when switching projects/readmes.
        setReadmeExpanded(false)
    }, [project?.path, project?.readme])

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
    }, [project?.readme, activeTab, readmeExpanded, measureReadmeOverflow])

    const loadProjectDetails = async () => {
        if (!decodedPath) return

        setLoading(true)
        setError(null)

        try {
            const [detailsResult, treeResult] = await Promise.all([
                window.devscope.getProjectDetails(decodedPath),
                // Always load with showHidden: true, filter on client side
                window.devscope.getFileTree(decodedPath, { showHidden: true, maxDepth: -1 })
            ])

            if (detailsResult.success) {
                setProject(detailsResult.project)
                // Default to README if visible, otherwise Files
                if (detailsResult.project.readme) setActiveTab('readme')
            } else {
                setError(detailsResult.error || 'Failed to load project details')
            }

            if (treeResult.success) {
                setFileTree(treeResult.tree)
            }
        } catch (err: any) {
            setError(err.message || 'Failed to load project')
        } finally {
            setLoading(false)
        }
    }

    const refreshGitData = useCallback(async (refreshFileTree: boolean = false) => {
        if (!decodedPath) return

        setLoadingGit(true)

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
    }, [decodedPath])

    // Effect: Load Project
    useEffect(() => {
        loadProjectDetails()
    }, [decodedPath])

    // Reset git-derived state when switching projects to avoid stale cross-project data.
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
    }, [decodedPath])

    // Preload git data in background as soon as the project page opens.
    useEffect(() => {
        if (!decodedPath) return
        void refreshGitData(false)
    }, [decodedPath, refreshGitData])

    // Effect: Load full Git data whenever Git tab opens
    useEffect(() => {
        if (activeTab !== 'git' || !decodedPath) return
        void refreshGitData(true)
    }, [activeTab, decodedPath, refreshGitData])

    // Effect: Load gitignore templates and auto-detect project type
    useEffect(() => {
        if (showInitModal && availableTemplates.length === 0) {
            window.devscope.getGitignoreTemplates().then(result => {
                if (result.success) {
                    setAvailableTemplates(result.templates)

                    // Auto-detect template based on project type
                    if (project?.type) {
                        const typeMap: Record<string, string> = {
                            'node': 'Node.js',
                            'python': 'Python',
                            'rust': 'Rust',
                            'go': 'Go',
                            'java': 'Java',
                            'dotnet': '.NET',
                            'ruby': 'Ruby',
                            'php': 'PHP',
                            'cpp': 'C/C++',
                            'dart': 'Dart/Flutter',
                            'elixir': 'Elixir'
                        }
                        const detectedTemplate = typeMap[project.type] || 'General'
                        setGitignoreTemplate(detectedTemplate)
                    } else {
                        setGitignoreTemplate('General')
                    }
                }
            })
        }
    }, [showInitModal, project?.type])

    // Effect: Load gitignore patterns when Custom template is selected
    useEffect(() => {
        if (gitignoreTemplate === 'Custom' && availablePatterns.length === 0) {
            window.devscope.getGitignorePatterns().then(result => {
                if (result.success) {
                    setAvailablePatterns(result.patterns)

                    // Auto-select common patterns based on project type
                    if (project?.type) {
                        const autoSelect = new Set<string>()

                        // Common for all
                        autoSelect.add('env_files')
                        autoSelect.add('logs')
                        autoSelect.add('cache')
                        autoSelect.add('macos')
                        autoSelect.add('windows')
                        autoSelect.add('linux')

                        // Type-specific
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

                        // IDE based on what's detected
                        autoSelect.add('vscode')
                        autoSelect.add('idea')
                        autoSelect.add('vim')

                        setSelectedPatterns(autoSelect)
                    }
                }
            })
        }
    }, [gitignoreTemplate, project?.type])

    const changedFiles = useMemo(() => {
        const byPath = new Map<string, FileTreeNode>()

        for (const [rawPath, status] of Object.entries(gitStatusMap)) {
            if (!status || status === 'ignored' || status === 'unknown') continue

            const normalizedPath = rawPath.replace(/\\/g, '/').replace(/^\.\//, '')
            const dedupeKey = normalizedPath.toLowerCase()
            if (byPath.has(dedupeKey)) continue

            const segments = normalizedPath.split('/').filter(Boolean)
            const name = segments[segments.length - 1] || normalizedPath

            byPath.set(dedupeKey, {
                name,
                path: normalizedPath,
                type: 'file',
                isHidden: name.startsWith('.'),
                gitStatus: status
            })
        }

        return Array.from(byPath.values()).sort((a, b) => a.path.localeCompare(b.path))
    }, [gitStatusMap])

    // Pre-compute all folder paths as Set for fast expand/collapse all
    const allFolderPathsSet = useMemo(() => new Set(getAllFolderPaths(fileTree)), [fileTree])
    const deferredFileSearch = useDeferredValue(fileSearch)
    const parsedFileSearch = useMemo(() => parseFileSearchQuery(deferredFileSearch), [deferredFileSearch])
    const hasFileSearch = deferredFileSearch.trim().length > 0
    const fileSearchIndex = useMemo(() => buildFileSearchIndex(fileTree), [fileTree])
    const folderChildInfoMap = useMemo(() => buildDirectoryChildInfoMap(fileTree), [fileTree])
    const indexedSearch = useMemo(() => {
        if (!hasFileSearch) return null
        return searchFileIndex(fileSearchIndex, parsedFileSearch, {
            showHidden,
            includeDirectories: true
        })
    }, [hasFileSearch, fileSearchIndex, parsedFileSearch, showHidden])

    // Auto-expand folders that contain search matches
    const searchExpandedFolders = useMemo(() => {
        if (!indexedSearch) return new Set<string>()
        return indexedSearch.expandedFolderPathSet
    }, [indexedSearch])

    // Effective expanded folders = manual + search auto-expand
    const effectiveExpandedFolders = useMemo(() => {
        if (hasFileSearch) {
            return new Set([...expandedFolders, ...searchExpandedFolders])
        }
        return expandedFolders
    }, [expandedFolders, searchExpandedFolders, hasFileSearch])

    // Pre-compute flattened visible file list (data only, no JSX)
    type FlatFileItem = {
        node: FileTreeNode
        depth: number
        isExpanded: boolean
        isFolder: boolean
        ext: string
        isPreviewable: boolean
        childInfo: { files: number; folders: number } | null
    }

    const visibleFileList = useMemo((): FlatFileItem[] => {
        const result: FlatFileItem[] = []
        const searchVisiblePaths = indexedSearch?.visiblePathSet

        const processNodes = (nodes: FileTreeNode[], depth: number) => {
            const filtered = nodes
                .filter(node => showHidden || !node.isHidden)
                .filter(node => !hasFileSearch || Boolean(searchVisiblePaths?.has(node.path)))
                .sort((a, b) => {
                    // Folders always first
                    if (a.type !== b.type) return a.type === 'directory' ? -1 : 1
                    if (sortBy === 'name') return sortAsc ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name)
                    if (sortBy === 'size') return sortAsc ? (a.size || 0) - (b.size || 0) : (b.size || 0) - (a.size || 0)
                    // Type = extension
                    const extA = a.name.split('.').pop() || ''
                    const extB = b.name.split('.').pop() || ''
                    return sortAsc ? extA.localeCompare(extB) : extB.localeCompare(extA)
                })

            for (const node of filtered) {
                const isFolder = node.type === 'directory'
                const ext = node.name.split('.').pop()?.toLowerCase() || ''
                const isPreviewable = PREVIEWABLE_EXTENSIONS.has(ext) || PREVIEWABLE_FILE_NAMES.has(node.name.toLowerCase())
                const childInfo = isFolder ? (folderChildInfoMap.get(node.path) || null) : null
                const isExpanded = effectiveExpandedFolders.has(node.path)

                result.push({ node, depth, isExpanded, isFolder, ext, isPreviewable, childInfo })

                // If folder is expanded, add children
                if (isFolder && isExpanded && node.children) {
                    processNodes(node.children, depth + 1)
                }
            }
        }

        processNodes(fileTree, 0)
        return result
    }, [fileTree, showHidden, hasFileSearch, indexedSearch, sortBy, sortAsc, effectiveExpandedFolders, folderChildInfoMap])

    // Effect: Poll running processes for this project
    useEffect(() => {
        const checkProjectStatus = async () => {
            if (!project?.path) return

            try {
                // Check running processes (dev servers, etc.)
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
        // Poll every 3s (slightly longer since process detection is heavier)
        const interval = setInterval(checkProjectStatus, 3000)
        return () => clearInterval(interval)
    }, [project?.path])

    const handleCopyPath = async () => {
        if (project?.path) {
            try {
                // Try IPC first (more robust in Electron)
                if (window.devscope.copyToClipboard) {
                    await window.devscope.copyToClipboard(project.path)
                } else {
                    // Fallback
                    await navigator.clipboard.writeText(project.path)
                }
                setCopiedPath(true)
                setTimeout(() => setCopiedPath(false), 2000)
            } catch (err) {
                console.error('Failed to copy path:', err)
                setError('Failed to copy path to clipboard')
            }
        }
    }

    const handleCommitClick = async (commit: GitCommit) => {
        if (!decodedPath) return

        setSelectedCommit(commit)
        setLoadingDiff(true)
        setCommitDiff('')

        try {
            const result = await window.devscope.getCommitDiff(decodedPath, commit.hash)
            if (result.success) {
                setCommitDiff(result.diff)
            } else {
                setCommitDiff(`Error loading diff: ${result.error}`)
            }
        } catch (err: any) {
            setCommitDiff(`Error: ${err.message}`)
        } finally {
            setLoadingDiff(false)
        }
    }

    const handleCommit = async () => {
        if (!decodedPath || !commitMessage.trim() || changedFiles.length === 0) return

        // Check for author mismatch
        const shouldWarn = localStorage.getItem('dontShowAuthorWarning') !== 'true'
        if (shouldWarn && gitUser && repoOwner && gitUser.name !== repoOwner) {
            setShowAuthorMismatch(true)
            return
        }

        await performCommit()
    }

    const handleGenerateCommitMessage = async () => {
        if (!decodedPath || changedFiles.length === 0) return

        const providerOrder = settings.commitAIProvider === 'groq'
            ? (['groq', 'gemini'] as const)
            : (['gemini', 'groq'] as const)

        const selectedProvider = providerOrder.find((provider) => {
            if (provider === 'groq') return Boolean(settings.groqApiKey?.trim())
            return Boolean(settings.geminiApiKey?.trim())
        })

        if (!selectedProvider) {
            showToast(
                'No API key configured for commit generation.',
                'Open AI Settings',
                '/settings/ai'
            )
            return
        }

        const apiKey = selectedProvider === 'groq' ? settings.groqApiKey : settings.geminiApiKey

        setIsGeneratingCommitMessage(true)
        setError(null)
        try {
            const diffResult = await window.devscope.getWorkingDiff(decodedPath)
            if (!diffResult?.success) {
                throw new Error(diffResult?.error || 'Failed to read working diff')
            }

            const generateResult = await window.devscope.generateCommitMessage(
                selectedProvider,
                apiKey,
                diffResult.diff || ''
            )

            if (!generateResult?.success || !generateResult?.message) {
                throw new Error(generateResult?.error || 'Failed to generate commit message')
            }

            setCommitMessage(generateResult.message.trim())
        } catch (err: any) {
            setError(`AI generation failed: ${err.message || 'Unknown error'}`)
        } finally {
            setIsGeneratingCommitMessage(false)
        }
    }

    const performCommit = async () => {
        if (!decodedPath || !commitMessage.trim()) return

        setIsCommitting(true)
        try {
            // Stage all changed files
            const filePaths = changedFiles.map(f => f.path)
            const stageResult = await window.devscope.stageFiles(decodedPath, filePaths)
            if (!stageResult?.success) {
                throw new Error(stageResult?.error || 'Failed to stage files')
            }

            // Create commit
            const commitResult = await window.devscope.createCommit(decodedPath, commitMessage)
            if (!commitResult?.success) {
                throw new Error(commitResult?.error || 'Failed to create commit')
            }

            // Clear message and reload
            setCommitMessage('')
            await refreshGitData(true)
        } catch (err: any) {
            setError(`Failed to commit: ${err.message}`)
        } finally {
            setIsCommitting(false)
        }
    }

    const handlePush = async () => {
        if (!decodedPath || unpushedCommits.length === 0) return

        setIsPushing(true)
        try {
            const pushResult = await window.devscope.pushCommits(decodedPath)
            if (!pushResult?.success) {
                throw new Error(pushResult?.error || 'Failed to push commits')
            }

            await refreshGitData(false)
        } catch (err: any) {
            setError(`Failed to push: ${err.message}`)
        } finally {
            setIsPushing(false)
        }
    }

    const handleSwitchBranch = async () => {
        if (!decodedPath || !targetBranch || targetBranch === currentBranch) return

        setIsSwitchingBranch(true)
        try {
            const checkoutResult = await window.devscope.checkoutBranch(decodedPath, targetBranch, {
                autoStash: true,
                autoCleanupLock: true
            })
            if (!checkoutResult?.success) {
                throw new Error(checkoutResult?.error || 'Failed to switch branch')
            }

            await refreshGitData(true)
            if (checkoutResult?.cleanedLock && checkoutResult?.stashed) {
                showToast(`Recovered stale Git lock and auto-stashed changes (${checkoutResult.stashRef || 'stash@{0}'}).`)
            } else if (checkoutResult?.cleanedLock) {
                showToast('Recovered stale Git lock and switched branch.')
            } else if (checkoutResult?.stashed) {
                showToast(`Switched branch after auto-stashing local changes (${checkoutResult.stashRef || 'stash@{0}'}).`)
            }
        } catch (err: any) {
            setError(`Failed to switch branch: ${err.message}`)
        } finally {
            setIsSwitchingBranch(false)
        }
    }

    const handleInitGit = async () => {
        if (!decodedPath) return

        setIsInitializing(true)
        try {
            // Get gitignore content if needed
            let gitignoreContent: string | undefined
            if (createGitignore && gitignoreTemplate) {
                if (gitignoreTemplate === 'Custom') {
                    // Generate custom gitignore from selected patterns
                    const result = await window.devscope.generateCustomGitignoreContent(Array.from(selectedPatterns))
                    if (result.success) {
                        gitignoreContent = result.content
                    }
                } else {
                    // Use template
                    const result = await window.devscope.generateGitignoreContent(gitignoreTemplate)
                    if (result.success) {
                        gitignoreContent = result.content
                    }
                }
            }

            // Get branch name
            const finalBranchName = branchName === 'custom' ? customBranchName : branchName

            // Initialize repo
            const initResult = await window.devscope.initGitRepo(
                decodedPath,
                finalBranchName,
                createGitignore,
                gitignoreContent
            )

            if (!initResult.success) {
                setError(`Failed to initialize git: ${initResult.error}`)
                setIsInitializing(false)
                return
            }

            setIsGitRepo(true)

            // Create initial commit if requested
            if (createInitialCommit) {
                const commitResult = await window.devscope.createInitialCommit(
                    decodedPath,
                    initialCommitMessage
                )

                if (!commitResult.success) {
                    setError(`Git initialized but failed to create initial commit: ${commitResult.error}`)
                }
            }

            await refreshGitData(true)

            // Move to remote setup step
            setInitStep('remote')
        } catch (err: any) {
            setError(`Failed to initialize git: ${err.message}`)
        } finally {
            setIsInitializing(false)
        }
    }

    const handleAddRemote = async () => {
        if (!decodedPath || !remoteUrl.trim()) return

        setIsAddingRemote(true)
        try {
            const result = await window.devscope.addRemoteOrigin(decodedPath, remoteUrl)

            if (!result.success) {
                setError(`Failed to add remote: ${result.error}`)
                setIsAddingRemote(false)
                return
            }

            // Success - close modal and reload
            setShowInitModal(false)
            setInitStep('config')
            setRemoteUrl('')
            setIsGitRepo(true)
            setHasRemote(true)

            await refreshGitData(true)
        } catch (err: any) {
            setError(`Failed to add remote: ${err.message}`)
        } finally {
            setIsAddingRemote(false)
        }
    }

    const handleSkipRemote = async () => {
        // Close modal and reload
        setShowInitModal(false)
        setInitStep('config')
        setRemoteUrl('')
        setIsGitRepo(true)
        setHasRemote(false)

        await refreshGitData(true)
    }

    const handleAuthorMismatchConfirm = () => {
        if (dontShowAuthorWarning) {
            localStorage.setItem('dontShowAuthorWarning', 'true')
        }
        setShowAuthorMismatch(false)
        performCommit()
    }

    const handleOpenInExplorer = async () => {
        if (project?.path) {
            console.log('Opening in explorer:', project.path)
            try {
                const result = await window.devscope.openInExplorer?.(project.path)
                if (result && !result.success) {
                    console.error('Failed to open in explorer:', result.error)
                    // If it failed, let's alert (for debugging visibility)
                    alert(`Failed to open folder: ${result.error}`)
                }
            } catch (err) {
                console.error('Failed to call openInExplorer:', err)
                alert(`Failed to invoke openInExplorer: ${err}`)
            }
        }
    }

    const scriptRunner = useMemo(
        () => detectPackageScriptRunner(project?.markers || []),
        [project?.markers]
    )
    const scriptIntentContext = useMemo<ScriptIntentContext>(() => ({
        frameworks: project?.frameworks || [],
        markers: project?.markers || []
    }), [project?.frameworks, project?.markers])
    const scriptPredictions = useMemo(() => {
        const predictions: Record<string, ScriptIntentPrediction> = {}
        if (!project?.scripts) return predictions
        for (const [name, command] of Object.entries(project.scripts)) {
            predictions[name] = detectScriptIntentWithConfidence(name, command, scriptIntentContext)
        }
        return predictions
    }, [project?.scripts, scriptIntentContext])

    const closeScriptRunModal = () => {
        setPendingScriptRun(null)
        setScriptPortInput('')
        setScriptExposeNetwork(false)
        setScriptAdvancedOpen(false)
        setScriptExtraArgsInput('')
        setScriptEnvInput('')
        setScriptRunError(null)
    }

    const launchScriptInTerminal = (scriptName: string, commandToRun: string) => {
        if (!project) return

        openTerminal(
            {
                id: `script-${scriptName}`,
                category: 'system',
                displayName: `Run: ${scriptName}`
            },
            project.path,
            commandToRun
        )
    }

    const buildScriptCommandWithOverrides = (
        scriptName: string,
        scriptIntent: ScriptIntent,
        options: ScriptRunDraft = {},
        scriptCommand: string = ''
    ) => {
        const baseCommand = getScriptCommand(scriptName, scriptRunner)
        const envOverrides: Record<string, string> = { ...(options.envOverrides || {}) }
        const intentArgs: string[] = []

        if (scriptIntent === 'server' && options.port) {
            const port = String(options.port)
            envOverrides.PORT = port
            envOverrides.DEV_PORT = port
            envOverrides.VITE_PORT = port
        }

        if (scriptIntent === 'server' && options.exposeNetwork) {
            envOverrides.HOST = '0.0.0.0'
            envOverrides.HOSTNAME = '0.0.0.0'
            envOverrides.BIND_ADDR = '0.0.0.0'
        }

        if (scriptIntent === 'server') {
            intentArgs.push(...buildServerCliArgs(scriptCommand, options))
        }

        if (options.extraArgs?.trim()) {
            intentArgs.push(options.extraArgs.trim())
        }

        const commandWithArgs = appendScriptArgsForRunner(baseCommand, intentArgs.join(' '), scriptRunner)
        return applyShellEnvOverrides(commandWithArgs, settings.defaultShell, envOverrides)
    }

    const getScriptRunDraftFromState = (
        scriptIntent: ScriptIntent,
        strictValidation: boolean
    ): { draft: ScriptRunDraft; error?: string } => {
        const draft: ScriptRunDraft = {}

        const envParseResult = parseEnvOverrideInput(scriptEnvInput)
        if (envParseResult.error && strictValidation) {
            return { draft, error: envParseResult.error }
        }
        if (Object.keys(envParseResult.envOverrides).length > 0) {
            draft.envOverrides = envParseResult.envOverrides
        }

        const extraArgs = scriptExtraArgsInput.trim()
        if (extraArgs) {
            draft.extraArgs = extraArgs
        }

        if (scriptIntent === 'server') {
            const rawPort = scriptPortInput.trim()
            if (rawPort) {
                const maybePort = Number(rawPort)
                if (!Number.isInteger(maybePort) || maybePort < 1 || maybePort > 65535) {
                    if (strictValidation) {
                        return { draft, error: 'Port must be a number between 1 and 65535.' }
                    }
                } else {
                    draft.port = maybePort
                }
            }

            if (scriptExposeNetwork) {
                draft.exposeNetwork = true
            }
        }

        return { draft }
    }

    const runScript = (scriptName: string, command: string) => {
        if (!project) return

        const prediction = scriptPredictions[scriptName] || detectScriptIntentWithConfidence(scriptName, command, scriptIntentContext)
        if (prediction.intent !== 'server') {
            const commandToRun = buildScriptCommandWithOverrides(scriptName, prediction.intent, {}, command)
            launchScriptInTerminal(scriptName, commandToRun)
            return
        }

        setPendingScriptRun({
            name: scriptName,
            command,
            intent: prediction.intent,
            confidence: prediction.confidence
        })
        setScriptPortInput('')
        setScriptExposeNetwork(false)
        setScriptAdvancedOpen(false)
        setScriptExtraArgsInput('')
        setScriptEnvInput('')
        setScriptRunError(null)
    }

    const handleConfirmScriptRun = () => {
        if (!pendingScriptRun) return

        const draftResult = getScriptRunDraftFromState(pendingScriptRun.intent, true)
        if (draftResult.error) {
            setScriptRunError(draftResult.error)
            return
        }

        const commandToRun = buildScriptCommandWithOverrides(
            pendingScriptRun.name,
            pendingScriptRun.intent,
            draftResult.draft,
            pendingScriptRun.command
        )

        launchScriptInTerminal(pendingScriptRun.name, commandToRun)
        closeScriptRunModal()
    }

    const scriptCommandPreview = pendingScriptRun
        ? buildScriptCommandWithOverrides(
            pendingScriptRun.name,
            pendingScriptRun.intent,
            getScriptRunDraftFromState(pendingScriptRun.intent, false).draft,
            pendingScriptRun.command
        )
        : ''

    const formatRelTime = (ts?: number) => {
        if (!ts) return ''
        const days = Math.floor((Date.now() - ts) / 86400000)
        return days === 0 ? 'Today' : days === 1 ? 'Yesterday' : `${days} days ago`
    }

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[50vh] animate-fadeIn gap-4">
                <RefreshCw size={32} className="text-[var(--accent-primary)] animate-spin" />
                <p className="text-white/40 text-sm">Loading Project...</p>
            </div>
        )
    }

    if (error || !project) {
        return (
            <div className="animate-fadeIn p-8">
                <div className="flex items-center gap-4 mb-8">
                    <button onClick={() => navigate('/projects')} className="p-2 text-white/40 hover:text-white bg-white/5 rounded-lg">
                        <ArrowLeft size={20} />
                    </button>
                    <h1 className="text-xl font-bold text-white">Error</h1>
                </div>
                <div className="p-6 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center gap-4">
                    <AlertCircle size={24} className="text-red-400" />
                    <span className="text-red-300">{error || 'Project not found'}</span>
                </div>
            </div>
        )
    }

    const themeColor = project.typeInfo?.themeColor || '#525252'

    return (
        <div className="max-w-[1600px] mx-auto animate-fadeIn pb-24 px-6 pt-6">

            {showDependenciesModal && project.dependencies && (
                <DependenciesModal dependencies={project.dependencies} onClose={() => setShowDependenciesModal(false)} />
            )}

            {selectedCommit && (
                <CommitDiffModal
                    commit={selectedCommit}
                    diff={commitDiff}
                    loading={loadingDiff}
                    onClose={() => {
                        setSelectedCommit(null)
                        setCommitDiff('')
                    }}
                />
            )}

            {showAuthorMismatch && gitUser && repoOwner && (
                <AuthorMismatchModal
                    gitUser={gitUser}
                    repoOwner={repoOwner}
                    onConfirm={handleAuthorMismatchConfirm}
                    onCancel={() => setShowAuthorMismatch(false)}
                    dontShowAgain={dontShowAuthorWarning}
                    setDontShowAgain={setDontShowAuthorWarning}
                />
            )}

            {/* Init Git Modal */}
            <InitGitModal
                isOpen={showInitModal}
                onClose={() => {
                    setShowInitModal(false)
                    setInitStep('config')
                }}
                step={initStep}
                branchName={branchName}
                setBranchName={setBranchName}
                customBranchName={customBranchName}
                setCustomBranchName={setCustomBranchName}
                createGitignore={createGitignore}
                setCreateGitignore={setCreateGitignore}
                gitignoreTemplate={gitignoreTemplate}
                setGitignoreTemplate={setGitignoreTemplate}
                availableTemplates={availableTemplates}
                availablePatterns={availablePatterns}
                selectedPatterns={selectedPatterns}
                setSelectedPatterns={setSelectedPatterns}
                patternSearch={patternSearch}
                setPatternSearch={setPatternSearch}
                createInitialCommit={createInitialCommit}
                setCreateInitialCommit={setCreateInitialCommit}
                initialCommitMessage={initialCommitMessage}
                setInitialCommitMessage={setInitialCommitMessage}
                isInitializing={isInitializing}
                onInit={handleInitGit}
                remoteUrl={remoteUrl}
                setRemoteUrl={setRemoteUrl}
                isAddingRemote={isAddingRemote}
                onAddRemote={handleAddRemote}
                onSkipRemote={handleSkipRemote}
            />

            {/* -- HERO HEADER -- */}
            <div className="relative rounded-2xl overflow-hidden border border-white/10 bg-gradient-to-br from-white/[0.03] to-transparent mb-8">
                {/* Accent glow */}
                <div
                    className="absolute -top-20 -right-20 w-40 h-40 rounded-full blur-3xl opacity-20 pointer-events-none"
                    style={{ background: themeColor }}
                />

                {/* Main Row */}
                <div className="relative p-5 flex items-center gap-5">
                    {/* Project Icon */}
                    <div
                        className="shrink-0 w-14 h-14 rounded-xl flex items-center justify-center border border-white/10"
                        style={{ background: `${themeColor}15` }}
                    >
                        <ProjectIcon projectType={project.type} framework={project.frameworks?.[0]} size={32} />
                    </div>

                    {/* Project Info */}
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-1">
                            <h1 className="text-xl font-bold text-white truncate">
                                {project.displayName}
                            </h1>
                            {project.version && (
                                <span className="text-xs font-mono text-white/40 bg-white/5 px-2 py-0.5 rounded">
                                    v{project.version}
                                </span>
                            )}
                        </div>
                        <div className="flex items-center gap-2 text-sm text-white/50">
                            <span
                                className="px-2 py-0.5 rounded text-xs font-medium"
                                style={{ background: `${themeColor}20`, color: themeColor }}
                            >
                                {project.typeInfo?.displayName || project.type}
                            </span>
                            {project.frameworks?.map(fw => (
                                <FrameworkBadge key={fw} framework={fw} size="sm" />
                            ))}
                        </div>
                    </div>


                    {/* Right Actions */}
                    <div className="flex items-center gap-3 shrink-0">
                        {isProjectLive && (
                            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-green-500/10 border border-green-500/20 animate-pulse">
                                <div className="w-2 h-2 rounded-full bg-green-500" />
                                <span className="text-xs font-semibold text-green-400">
                                    LIVE {activePorts.length > 0 && `(:${activePorts[0]})`}
                                </span>
                            </div>
                        )}

                        <div className="hidden md:block text-right mr-2">
                            <p className="text-[10px] uppercase tracking-wider text-white/30 font-medium">Modified</p>
                            <p className="text-sm text-white/60">{formatRelTime(project.lastModified)}</p>
                        </div>

                        <button
                            onClick={() => openTerminal({ displayName: project.name, id: 'main', category: 'project' }, project.path)}
                            className="flex items-center gap-2 px-4 py-2.5 bg-[var(--accent-primary)] hover:bg-[var(--accent-primary)]/80 text-white text-sm font-medium rounded-lg transition-all active:scale-95"
                        >
                            <Terminal size={16} />
                            Open Terminal
                        </button>
                    </div>
                </div>

                {/* Path Row */}
                <div className="flex items-center gap-2 px-5 py-3 bg-black/20 border-t border-white/5">
                    <FolderOpen size={14} className="text-white/30 shrink-0" />
                    <span className="flex-1 text-xs font-mono text-white/40 truncate">
                        {project.path}
                    </span>
                    <div className="flex items-center gap-1">
                        <button
                            onClick={handleCopyPath}
                            className={cn(
                                "p-1.5 rounded-md text-white/40 hover:text-white hover:bg-white/10 transition-all",
                                copiedPath && "text-green-400 hover:text-green-400"
                            )}
                            title="Copy path"
                        >
                            {copiedPath ? <Check size={14} /> : <Copy size={14} />}
                        </button>
                        <button
                            onClick={handleOpenInExplorer}
                            className="p-1.5 rounded-md text-white/40 hover:text-white hover:bg-white/10 transition-all"
                            title="Open in Explorer"
                        >
                            <ExternalLink size={14} />
                        </button>
                    </div>
                </div>
            </div>


            {/* -- STICKY TABS BAR -- */}
            <div className="sticky -top-6 z-20 bg-sparkle-bg/95 backdrop-blur-xl pt-10 pb-4 mb-6 -mx-6 px-6 border-b border-white/5">
                <div className="flex gap-3 items-center">
                    <button
                        onClick={goBack}
                        className="h-11 w-11 flex items-center justify-center text-white/50 hover:text-white bg-sparkle-card border border-white/10 hover:border-white/20 rounded-xl transition-all shadow-sm shrink-0"
                        title="Go Back"
                    >
                        <ArrowLeft size={18} />
                    </button>

                    <div className="flex-1 flex items-center h-11 p-1 bg-sparkle-card border border-white/10 rounded-xl shadow-sm">
                        <button
                            onClick={() => setActiveTab('readme')}
                            className={cn(
                                "flex-1 h-full flex items-center justify-center gap-2 rounded-lg text-sm font-medium transition-all",
                                activeTab === 'readme' ? "bg-white/10 text-white" : "text-white/40 hover:text-white hover:bg-white/5"
                            )}
                        >
                            <BookOpen size={15} /> README
                        </button>
                        <button
                            onClick={() => setActiveTab('files')}
                            className={cn(
                                "flex-1 h-full flex items-center justify-center gap-2 rounded-lg text-sm font-medium transition-all",
                                activeTab === 'files' ? "bg-white/10 text-white" : "text-white/40 hover:text-white hover:bg-white/5"
                            )}
                        >
                            <FolderOpen size={15} /> Files
                            <span className={cn(
                                "text-[10px] px-1.5 py-0.5 rounded-full",
                                activeTab === 'files' ? "bg-white/10" : "bg-white/5 opacity-60"
                            )}>
                                {fileTree.length}
                            </span>
                        </button>
                        <button
                            onClick={() => setActiveTab('git')}
                            className={cn(
                                "flex-1 h-full flex items-center justify-center gap-2 rounded-lg text-sm font-medium transition-all",
                                activeTab === 'git' ? "bg-white/10 text-white" : "text-white/40 hover:text-white hover:bg-white/5"
                            )}
                        >
                            <GitBranch size={15} />
                            Git
                            {loadingGit && (
                                <RefreshCw size={12} className="animate-spin text-[var(--accent-primary)]" />
                            )}
                            {changedFiles.length > 0 && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#E2C08D]/20 text-[#E2C08D]">
                                    {changedFiles.length}
                                </span>
                            )}
                            {unpushedCommits.length > 0 && (
                                <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-400/30">
                                    <GitPullRequest size={10} />
                                    {unpushedCommits.length}
                                </span>
                            )}
                        </button>
                    </div>

                    {/* Browse Folder button - switch to folder browse view */}
                    <button
                        onClick={() => {
                            const encodedPath = encodeURIComponent(project.path)
                            navigate(`/folder-browse/${encodedPath}`)
                        }}
                        className="h-11 flex items-center gap-2 px-4 text-white/50 hover:text-white bg-sparkle-card border border-white/10 hover:border-white/20 rounded-xl transition-all shadow-sm shrink-0"
                        title="Browse as Folder"
                    >
                        <Folder size={16} />
                        <span className="text-sm font-medium hidden sm:inline">Browse Folder</span>
                    </button>

                    <button
                        onClick={loadProjectDetails}
                        className="h-11 w-11 flex items-center justify-center text-white/40 hover:text-white bg-sparkle-card border border-white/10 hover:border-white/20 rounded-xl transition-all shadow-sm shrink-0"
                        title="Refresh"
                    >
                        <RefreshCw size={16} />
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-12 gap-6">

                {/* LEFT COLUMN: TABS & CONTENT */}
                <div className="col-span-12 lg:col-span-8 flex flex-col gap-6">
                    <div className="bg-sparkle-card border border-white/5 rounded-2xl overflow-hidden min-h-[500px] shadow-sm">
                        {activeTab === 'readme' ? (
                            <div className="relative">
                                {project.readme ? (
                                    <>
                                        <div
                                            ref={readmeContentRef}
                                            className={cn(
                                                "p-8 pt-6 overflow-hidden transition-all duration-300",
                                                !readmeExpanded && "max-h-[500px]"
                                            )}
                                        >
                                            <MarkdownRenderer content={project.readme} filePath={`${project.path}/README.md`} />
                                        </div>
                                        {readmeNeedsExpand && !readmeExpanded && (
                                            <div
                                                onClick={() => setReadmeExpanded(true)}
                                                className="absolute bottom-0 left-0 right-0 h-40 bg-gradient-to-t from-sparkle-card via-sparkle-card/80 to-transparent flex items-end justify-center pb-8 cursor-pointer group"
                                            >
                                                <span className="text-sm font-medium text-[var(--accent-primary)] group-hover:text-white transition-colors">
                                                    Read More
                                                </span>
                                            </div>
                                        )}
                                        {readmeNeedsExpand && readmeExpanded && (
                                            <div
                                                onClick={() => setReadmeExpanded(false)}
                                                className="px-8 pb-6 pt-4 text-center cursor-pointer group"
                                            >
                                                <span className="text-sm text-white/40 group-hover:text-white/60 transition-colors">
                                                    Show Less
                                                </span>
                                            </div>
                                        )}
                                    </>
                                ) : (
                                    <div className="flex flex-col items-center justify-center py-24 text-white/20">
                                        <BookOpen size={48} className="mb-4 opacity-50" />
                                        <p>No README.md found</p>
                                    </div>
                                )}
                            </div>
                        ) : activeTab === 'files' ? (
                            <div className="flex flex-col h-full">
                                {/* Header with search and controls */}
                                <div className="flex items-center gap-2 px-4 py-3 border-b border-white/5 bg-white/[0.02]">
                                    {/* Search */}
                                    <div className="relative flex-1">
                                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
                                        <input
                                            type="text"
                                            value={fileSearch}
                                            onChange={(e) => setFileSearch(e.target.value)}
                                            placeholder="Search files..."
                                            className="w-full bg-white/5 border border-white/10 rounded-lg pl-9 pr-3 py-1.5 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-white/20 transition-all"
                                        />
                                    </div>

                                    {/* Expand/Collapse All */}
                                    <button
                                        onClick={() => {
                                            setIsExpandingFolders(true)
                                            // Use startTransition for non-blocking updates
                                            startTransition(() => {
                                                if (expandedFolders.size > 0) {
                                                    setExpandedFolders(EMPTY_SET)
                                                } else {
                                                    setExpandedFolders(allFolderPathsSet)
                                                }
                                                // Small delay to show the spinner
                                                setTimeout(() => setIsExpandingFolders(false), 300)
                                            })
                                        }}
                                        disabled={isExpandingFolders}
                                        className={cn(
                                            "p-2 rounded-lg transition-all",
                                            isExpandingFolders && "opacity-50 cursor-not-allowed",
                                            expandedFolders.size > 0 ? "text-white/60 hover:text-white hover:bg-white/5" : "text-white/40 hover:text-white hover:bg-white/5"
                                        )}
                                        title={isExpandingFolders ? "Loading..." : expandedFolders.size > 0 ? "Collapse all folders" : "Expand all folders"}
                                    >
                                        {isExpandingFolders ? (
                                            <RefreshCw size={16} className="animate-spin" />
                                        ) : expandedFolders.size > 0 ? (
                                            <ChevronsDownUp size={16} />
                                        ) : (
                                            <ChevronsUpDown size={16} />
                                        )}
                                    </button>

                                    {/* Toggle hidden */}
                                    <button
                                        onClick={() => setShowHidden(!showHidden)}
                                        className={cn(
                                            "p-2 rounded-lg transition-all",
                                            showHidden ? "bg-white/10 text-white" : "text-white/40 hover:text-white hover:bg-white/5"
                                        )}
                                        title={showHidden ? "Hide hidden files" : "Show hidden files"}
                                    >
                                        {showHidden ? <Eye size={16} /> : <EyeOff size={16} />}
                                    </button>

                                    {/* Item count */}
                                    <span className="text-xs text-white/40 whitespace-nowrap">
                                        {fileTree.length} items
                                    </span>
                                </div>

                                {/* Column Headers */}
                                <div className="grid grid-cols-12 gap-2 px-4 py-2 border-b border-white/5 text-[10px] uppercase tracking-wider text-white/30 font-medium bg-black/10">
                                    <div className="col-span-6 flex items-center gap-1 cursor-pointer hover:text-white/50" onClick={() => { setSortBy('name'); setSortAsc(sortBy === 'name' ? !sortAsc : true) }}>
                                        Name {sortBy === 'name' && (sortAsc ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}
                                    </div>
                                    <div className="col-span-2 flex items-center gap-1 cursor-pointer hover:text-white/50" onClick={() => { setSortBy('type'); setSortAsc(sortBy === 'type' ? !sortAsc : true) }}>
                                        Type {sortBy === 'type' && (sortAsc ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}
                                    </div>
                                    <div className="col-span-2 flex items-center gap-1 cursor-pointer hover:text-white/50" onClick={() => { setSortBy('size'); setSortAsc(sortBy === 'size' ? !sortAsc : true) }}>
                                        Size {sortBy === 'size' && (sortAsc ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}
                                    </div>
                                    <div className="col-span-2 text-right">Info</div>
                                </div>

                                {/* File List - uses memoized visibleFileList for instant rendering */}
                                <div className="flex-1 overflow-y-auto custom-scrollbar">
                                    {visibleFileList.length === 0 ? (
                                        <div className="flex flex-col items-center justify-center py-16 text-white/30">
                                            <Search size={32} className="mb-3 opacity-30" />
                                            <p className="text-sm">No files found</p>
                                            {fileSearch && (
                                                <button
                                                    onClick={() => setFileSearch('')}
                                                    className="mt-2 text-xs text-[var(--accent-primary)] hover:underline"
                                                >
                                                    Clear search
                                                </button>
                                            )}
                                        </div>
                                    ) : (
                                        visibleFileList.map(({ node, depth, isExpanded, isFolder, ext, isPreviewable, childInfo }) => (
                                            <div
                                                key={node.path}
                                                className={cn(
                                                    "grid grid-cols-12 gap-2 px-4 py-2 border-b border-white/5 hover:bg-white/5 transition-colors group cursor-pointer",
                                                    node.isHidden && "opacity-50"
                                                )}
                                                style={{ paddingLeft: `${16 + depth * 20}px` }}
                                                onClick={() => {
                                                    if (isFolder) {
                                                        startTransition(() => {
                                                            setExpandedFolders(prev => {
                                                                const next = new Set(prev)
                                                                if (next.has(node.path)) {
                                                                    next.delete(node.path)
                                                                } else {
                                                                    next.add(node.path)
                                                                }
                                                                return next
                                                            })
                                                        })
                                                    } else {
                                                        openPreview({ name: node.name, path: node.path }, ext)
                                                    }
                                                }}
                                            >
                                                {/* Name */}
                                                <div className="col-span-6 flex items-center gap-2 min-w-0">
                                                    {isFolder ? (
                                                        <ChevronRight size={14} className={cn("text-white/30 transition-transform", isExpanded && "rotate-90")} />
                                                    ) : (
                                                        <span className="w-3.5" />
                                                    )}
                                                    {getFileIcon(node.name, isFolder, isExpanded)}
                                                    <span className={cn(
                                                        "text-sm truncate",
                                                        isFolder ? "text-white/80 font-medium" : "text-white/60",
                                                        node.gitStatus === 'modified' && "text-[#E2C08D]",
                                                        node.gitStatus === 'added' && "text-[#73C991]",
                                                        node.gitStatus === 'untracked' && "text-[#73C991]",
                                                        node.gitStatus === 'deleted' && "text-[#FF6B6B] line-through"
                                                    )}>
                                                        {node.name}
                                                    </span>
                                                    {node.gitStatus && node.gitStatus !== 'ignored' && node.gitStatus !== 'unknown' && (
                                                        <span className={cn(
                                                            "text-[9px] uppercase font-bold px-1 py-0.5 rounded shrink-0",
                                                            node.gitStatus === 'modified' && "bg-[#E2C08D]/20 text-[#E2C08D]",
                                                            node.gitStatus === 'added' && "bg-[#73C991]/20 text-[#73C991]",
                                                            node.gitStatus === 'untracked' && "bg-[#73C991]/20 text-[#73C991]",
                                                            node.gitStatus === 'deleted' && "bg-[#FF6B6B]/20 text-[#FF6B6B]"
                                                        )}>
                                                            {node.gitStatus.charAt(0)}
                                                        </span>
                                                    )}
                                                </div>

                                                {/* Type */}
                                                <div className="col-span-2 flex items-center">
                                                    <span className="text-xs text-white/40 uppercase">
                                                        {isFolder ? 'Folder' : ext || '-'}
                                                    </span>
                                                </div>

                                                {/* Size */}
                                                <div className="col-span-2 flex items-center">
                                                    <span className="text-xs text-white/40 font-mono">
                                                        {isFolder ? '-' : formatFileSize(node.size)}
                                                    </span>
                                                </div>

                                                {/* Info */}
                                                <div className="col-span-2 flex items-center justify-end">
                                                    {isFolder && childInfo && (
                                                        <span className="text-[10px] text-white/30">
                                                            {childInfo.folders > 0 && `${childInfo.folders} folders`}
                                                            {childInfo.folders > 0 && childInfo.files > 0 && ', '}
                                                            {childInfo.files > 0 && `${childInfo.files} files`}
                                                        </span>
                                                    )}
                                                    {isPreviewable && !isFolder && (
                                                        <span className="text-[10px] text-[var(--accent-primary)] opacity-0 group-hover:opacity-100 transition-opacity">
                                                            Preview
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        ) : activeTab === 'git' ? (
                            // COMPREHENSIVE GIT MANAGEMENT TAB
                            <div className="flex flex-col h-full">
                                {/* Git Management Header */}
                                {gitUser && (
                                    <div className="p-4 border-b border-white/5 bg-white/[0.02]">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className="p-2 rounded-lg bg-white/5">
                                                    <User size={16} className="text-white/60" />
                                                </div>
                                                <div>
                                                    <p className="text-xs text-white/40">Repository Owner</p>
                                                    <p className="text-sm font-medium text-white/80">{repoOwner || 'Unknown'}</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <div className="text-right">
                                                    <p className="text-xs text-white/40">Current User</p>
                                                    <p className="text-sm font-medium text-white/80">{gitUser.name}</p>
                                                </div>
                                                <div className="p-2 rounded-lg bg-[var(--accent-primary)]/10">
                                                    <User size={16} className="text-[var(--accent-primary)]" />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Git Sub-nav */}
                                <div className="flex items-center gap-1 px-4 py-3 border-b border-white/5 overflow-x-auto">
                                    <button
                                        onClick={() => setGitView('manage')}
                                        className={cn(
                                            "px-3 py-1.5 text-xs font-medium rounded-lg transition-colors border border-transparent whitespace-nowrap",
                                            gitView === 'manage'
                                                ? "bg-white/10 text-white border-white/5"
                                                : "text-white/50 hover:text-white hover:bg-white/5"
                                        )}
                                    >
                                        <span className="flex items-center gap-1.5">
                                            <GitBranch size={12} />
                                            Manage
                                        </span>
                                    </button>
                                    <button
                                        onClick={() => setGitView('changes')}
                                        className={cn(
                                            "px-3 py-1.5 text-xs font-medium rounded-lg transition-colors border border-transparent whitespace-nowrap",
                                            gitView === 'changes'
                                                ? "bg-white/10 text-white border-white/5"
                                                : "text-white/50 hover:text-white hover:bg-white/5"
                                        )}
                                    >
                                        Working Changes ({changedFiles.length})
                                    </button>
                                    <button
                                        onClick={() => setGitView('unpushed')}
                                        className={cn(
                                            "px-3 py-1.5 text-xs font-medium rounded-lg transition-colors border border-transparent whitespace-nowrap",
                                            gitView === 'unpushed'
                                                ? "bg-white/10 text-white border-white/5"
                                                : "text-white/50 hover:text-white hover:bg-white/5"
                                        )}
                                    >
                                        To Push ({unpushedCommits.length})
                                    </button>
                                    <button
                                        onClick={() => setGitView('history')}
                                        className={cn(
                                            "px-3 py-1.5 text-xs font-medium rounded-lg transition-colors border border-transparent whitespace-nowrap",
                                            gitView === 'history'
                                                ? "bg-white/10 text-white border-white/5"
                                                : "text-white/50 hover:text-white hover:bg-white/5"
                                        )}
                                    >
                                        History
                                    </button>
                                    <button
                                        onClick={() => void refreshGitData(true)}
                                        disabled={loadingGit}
                                        className="ml-auto px-3 py-1.5 text-xs font-medium rounded-lg transition-colors border border-white/10 text-white/70 hover:text-white hover:bg-white/5 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                                    >
                                        <span className="flex items-center gap-1.5">
                                            <RefreshCw size={12} className={cn(loadingGit && 'animate-spin')} />
                                            Refresh Git
                                        </span>
                                    </button>
                                </div>

                                <div className="p-4 flex-1 overflow-y-auto custom-scrollbar">
                                    {gitView === 'manage' ? (
                                        isGitRepo === false ? (
                                            // NOT A GIT REPO - Show Init UI
                                            <div className="flex flex-col items-center justify-center py-16 px-4">
                                                <div className="p-6 rounded-2xl bg-white/5 border border-white/10 mb-6">
                                                    <GitBranch size={48} className="text-white/30" />
                                                </div>
                                                <h3 className="text-lg font-semibold text-white mb-2">Git Not Initialized</h3>
                                                <p className="text-sm text-white/50 text-center mb-6 max-w-md">
                                                    This project is not a Git repository yet. Initialize Git to start tracking changes and collaborate with others.
                                                </p>
                                                <button
                                                    onClick={() => setShowInitModal(true)}
                                                    className="px-6 py-3 bg-[var(--accent-primary)] hover:bg-[var(--accent-primary)]/80 text-white text-sm font-medium rounded-lg transition-all flex items-center gap-2"
                                                >
                                                    <GitBranch size={18} />
                                                    Initialize Git Repository
                                                </button>
                                            </div>
                                        ) : (
                                            // MANAGE VIEW - Commit UI + Summary
                                            <div className="space-y-4">
                                                {/* Branch Controls */}
                                                <div className="bg-black/20 rounded-xl border border-white/5 p-4">
                                                    <div className="flex items-center justify-between gap-3 mb-3">
                                                        <h3 className="text-sm font-medium text-white/80 flex items-center gap-2">
                                                            <GitBranch size={16} />
                                                            Branch Switching
                                                        </h3>
                                                        <span className="text-xs text-white/40">
                                                            Current: <span className="font-mono text-white/70">{currentBranch || 'n/a'}</span>
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <Select
                                                            value={targetBranch}
                                                            onChange={setTargetBranch}
                                                            options={branches.map((branch) => ({
                                                                value: branch.name,
                                                                label: `${branch.current ? '* ' : ''}${branch.name}`
                                                            }))}
                                                            placeholder="No branches found"
                                                            disabled={branches.length === 0 || isSwitchingBranch}
                                                            className="flex-1"
                                                            size="md"
                                                        />
                                                        <button
                                                            onClick={handleSwitchBranch}
                                                            disabled={!targetBranch || targetBranch === currentBranch || isSwitchingBranch}
                                                            className="px-4 py-2 text-sm font-medium rounded-lg bg-[var(--accent-primary)] hover:bg-[var(--accent-primary)]/80 disabled:opacity-50 disabled:cursor-not-allowed text-white transition-all flex items-center gap-2"
                                                        >
                                                            {isSwitchingBranch ? (
                                                                <>
                                                                    <RefreshCw size={14} className="animate-spin" />
                                                                    Switching...
                                                                </>
                                                            ) : (
                                                                <>
                                                                    <GitBranch size={14} />
                                                                    Switch
                                                                </>
                                                            )}
                                                        </button>
                                                    </div>
                                                </div>

                                                {/* Commit Section */}
                                                {changedFiles.length > 0 && (
                                                    <div className="bg-black/20 rounded-xl border border-white/5 p-4">
                                                        <h3 className="text-sm font-medium text-white/80 mb-3 flex items-center gap-2">
                                                            <GitCommitHorizontal size={16} />
                                                            Create Commit
                                                        </h3>
                                                        <div className="relative">
                                                            <textarea
                                                                value={commitMessage}
                                                                onChange={(e) => setCommitMessage(e.target.value)}
                                                                placeholder="Enter commit message..."
                                                                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 pr-12 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[var(--accent-primary)]/50 resize-none mb-3"
                                                                rows={3}
                                                            />
                                                        </div>
                                                        <div className="mb-3 flex items-center justify-between gap-2">
                                                            <button
                                                                onClick={handleGenerateCommitMessage}
                                                                disabled={isGeneratingCommitMessage || isCommitting}
                                                                className="px-3 py-2 bg-violet-500/15 hover:bg-violet-500/25 disabled:opacity-50 disabled:cursor-not-allowed border border-violet-500/30 text-violet-300 text-xs font-medium rounded-lg transition-all flex items-center gap-2"
                                                            >
                                                                {isGeneratingCommitMessage ? (
                                                                    <>
                                                                        <RefreshCw size={14} className="animate-spin" />
                                                                        Generating...
                                                                    </>
                                                                ) : (
                                                                    <>
                                                                        <Sparkles size={14} />
                                                                        Generate with AI
                                                                    </>
                                                                )}
                                                            </button>
                                                            <span className="text-[11px] text-white/40 uppercase tracking-wide">
                                                                {settings.commitAIProvider}
                                                            </span>
                                                        </div>
                                                        <button
                                                            onClick={handleCommit}
                                                            disabled={!commitMessage.trim() || isCommitting}
                                                            className="w-full px-4 py-2.5 bg-[var(--accent-primary)] hover:bg-[var(--accent-primary)]/80 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-all flex items-center justify-center gap-2"
                                                        >
                                                            {isCommitting ? (
                                                                <>
                                                                    <RefreshCw size={16} className="animate-spin" />
                                                                    Committing...
                                                                </>
                                                            ) : (
                                                                <>
                                                                    <GitCommitHorizontal size={16} />
                                                                    Commit {changedFiles.length} {changedFiles.length === 1 ? 'File' : 'Files'}
                                                                </>
                                                            )}
                                                        </button>
                                                    </div>
                                                )}

                                                {/* Push Section - Show Add Remote if no remote, otherwise show push when there are unpushed commits */}
                                                {hasRemote === false ? (
                                                    <div className="bg-amber-500/10 rounded-xl border border-amber-500/20 p-4">
                                                        <h3 className="text-sm font-medium text-amber-400 mb-3 flex items-center gap-2">
                                                            <Link size={16} />
                                                            No Remote Repository
                                                        </h3>
                                                        <p className="text-xs text-white/50 mb-3">
                                                            Add a remote repository to push your commits to GitHub, GitLab, or other Git hosting services.
                                                        </p>
                                                        <button
                                                            onClick={() => {
                                                                setInitStep('remote')
                                                                setShowInitModal(true)
                                                            }}
                                                            className="w-full px-4 py-2.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 text-sm font-medium rounded-lg transition-all flex items-center justify-center gap-2 border border-amber-500/30"
                                                        >
                                                            <Plus size={16} />
                                                            Add Remote Repository
                                                        </button>
                                                    </div>
                                                ) : unpushedCommits.length > 0 && (
                                                    <div className="bg-black/20 rounded-xl border border-white/5 p-4">
                                                        <h3 className="text-sm font-medium text-white/80 mb-3 flex items-center gap-2">
                                                            <GitPullRequest size={16} />
                                                            Push to Remote
                                                        </h3>
                                                        <p className="text-xs text-white/50 mb-3">
                                                            You have {unpushedCommits.length} unpushed {unpushedCommits.length === 1 ? 'commit' : 'commits'}
                                                        </p>
                                                        <button
                                                            onClick={handlePush}
                                                            disabled={isPushing}
                                                            className="w-full px-4 py-2.5 bg-blue-500/20 hover:bg-blue-500/30 disabled:opacity-50 disabled:cursor-not-allowed text-blue-400 text-sm font-medium rounded-lg transition-all flex items-center justify-center gap-2 border border-blue-500/30"
                                                        >
                                                            {isPushing ? (
                                                                <>
                                                                    <RefreshCw size={16} className="animate-spin" />
                                                                    Pushing...
                                                                </>
                                                            ) : (
                                                                <>
                                                                    <GitPullRequest size={16} />
                                                                    Push Commits
                                                                </>
                                                            )}
                                                        </button>
                                                    </div>
                                                )}

                                                {/* Summary Sections */}
                                                <div className="space-y-3">
                                                    {(() => {
                                                        const hasWorkingChanges = changedFiles.length > 0
                                                        const hasUnpushedCommits = unpushedCommits.length > 0
                                                        const hasRecentCommits = gitHistory.length > 0
                                                        const visibleSummaryCards =
                                                            (hasWorkingChanges ? 1 : 0) +
                                                            (hasUnpushedCommits ? 1 : 0) +
                                                            (hasRecentCommits ? 1 : 0)

                                                        return (
                                                            <div className={cn(
                                                                "grid gap-3",
                                                                visibleSummaryCards >= 2 ? "grid-cols-1 md:grid-cols-2" : "grid-cols-1"
                                                            )}>
                                                    {/* Uncommitted Changes */}
                                                    {hasWorkingChanges && (
                                                        <div className="bg-[#E2C08D]/5 rounded-xl border border-[#E2C08D]/20 p-4">
                                                            <div className="flex items-center justify-between mb-2">
                                                                <h4 className="text-sm font-medium text-[#E2C08D]">Working Changes</h4>
                                                                <span className="text-xs bg-[#E2C08D]/20 text-[#E2C08D] px-2 py-0.5 rounded-full">
                                                                    {changedFiles.length}
                                                                </span>
                                                            </div>
                                                            <div className="space-y-1">
                                                                {changedFiles.slice(0, 3).map((file) => (
                                                                    <div key={file.path} className="flex items-center gap-2 text-xs text-white/60">
                                                                        <span className={cn(
                                                                            "text-[9px] uppercase font-bold px-1 py-0.5 rounded",
                                                                            file.gitStatus === 'modified' && "bg-[#E2C08D]/20 text-[#E2C08D]",
                                                                            file.gitStatus === 'added' && "bg-[#73C991]/20 text-[#73C991]",
                                                                            file.gitStatus === 'deleted' && "bg-[#FF6B6B]/20 text-[#FF6B6B]"
                                                                        )}>
                                                                            {file.gitStatus?.substring(0, 1)}
                                                                        </span>
                                                                        <span className="truncate">{file.name}</span>
                                                                    </div>
                                                                ))}
                                                                {changedFiles.length > 3 && (
                                                                    <button
                                                                        onClick={() => setGitView('changes')}
                                                                        className="text-xs text-[#E2C08D] hover:underline"
                                                                    >
                                                                        +{changedFiles.length - 3} more...
                                                                    </button>
                                                                )}
                                                            </div>
                                                        </div>
                                                    )}

                                                    {/* Committed but Not Pushed */}
                                                    {hasUnpushedCommits && (
                                                        <div className="bg-blue-500/5 rounded-xl border border-blue-500/20 p-4">
                                                            <div className="flex items-center justify-between mb-2">
                                                                <h4 className="text-sm font-medium text-blue-400">Recent Changes (To Push)</h4>
                                                                <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded-full">
                                                                    {unpushedCommits.length}
                                                                </span>
                                                            </div>
                                                            <div className="space-y-1">
                                                                {unpushedCommits.slice(0, 3).map((commit) => (
                                                                    <div key={commit.hash} className="text-xs text-white/60 truncate">
                                                                        <span className="font-mono text-white/40">{commit.shortHash}</span> {commit.message}
                                                                    </div>
                                                                ))}
                                                                {unpushedCommits.length > 3 && (
                                                                    <button
                                                                        onClick={() => setGitView('unpushed')}
                                                                        className="text-xs text-blue-400 hover:underline"
                                                                    >
                                                                        +{unpushedCommits.length - 3} more...
                                                                    </button>
                                                                )}
                                                            </div>
                                                        </div>
                                                    )}

                                                    {/* Recent Commits */}
                                                    {hasRecentCommits && (
                                                        <div className={cn(
                                                            "bg-white/5 rounded-xl border border-white/5 p-4",
                                                            visibleSummaryCards === 3 && "md:col-span-2"
                                                        )}>
                                                            <div className="flex items-center justify-between mb-2">
                                                                <h4 className="text-sm font-medium text-white/80">Recent Commits</h4>
                                                                <span className="text-xs bg-white/10 text-white/60 px-2 py-0.5 rounded-full">
                                                                    {gitHistory.length}
                                                                </span>
                                                            </div>
                                                            <div className="space-y-1">
                                                                {gitHistory.slice(0, 3).map((commit) => (
                                                                    <div key={commit.hash} className="text-xs text-white/60 truncate">
                                                                        <span className="font-mono text-white/40">{commit.shortHash}</span> {commit.message}
                                                                    </div>
                                                                ))}
                                                                {gitHistory.length > 3 && (
                                                                    <button
                                                                        onClick={() => setGitView('history')}
                                                                        className="text-xs text-[var(--accent-primary)] hover:underline"
                                                                    >
                                                                        View all...
                                                                    </button>
                                                                )}
                                                            </div>
                                                        </div>
                                                    )}
                                                            </div>
                                                        )
                                                    })()}

                                                    {/* Repository Metadata */}
                                                    {(branches.length > 0 || remotes.length > 0 || tags.length > 0 || stashes.length > 0) && (
                                                        <div className="bg-white/5 rounded-xl border border-white/5 p-4 space-y-4">
                                                            <div className="flex items-center justify-between">
                                                                <h4 className="text-sm font-medium text-white/80">Repository Details</h4>
                                                                <span className="text-xs text-white/40">Live Git metadata</span>
                                                            </div>

                                                            <div className="grid grid-cols-2 gap-2 text-xs">
                                                                <div className="bg-black/20 rounded-lg border border-white/5 px-3 py-2">
                                                                    <div className="text-white/40">Branches</div>
                                                                    <div className="text-white/80 font-medium">{branches.length}</div>
                                                                </div>
                                                                <div className="bg-black/20 rounded-lg border border-white/5 px-3 py-2">
                                                                    <div className="text-white/40">Remotes</div>
                                                                    <div className="text-white/80 font-medium">{remotes.length}</div>
                                                                </div>
                                                                <div className="bg-black/20 rounded-lg border border-white/5 px-3 py-2">
                                                                    <div className="text-white/40">Tags</div>
                                                                    <div className="text-white/80 font-medium">{tags.length}</div>
                                                                </div>
                                                                <div className="bg-black/20 rounded-lg border border-white/5 px-3 py-2">
                                                                    <div className="text-white/40">Stashes</div>
                                                                    <div className="text-white/80 font-medium">{stashes.length}</div>
                                                                </div>
                                                            </div>

                                                            {branches.length > 0 && (
                                                                <div className="space-y-1">
                                                                    <div className="text-xs text-white/40">Active Branches</div>
                                                                    {branches.slice(0, 4).map((branch) => (
                                                                        <div key={branch.name} className="text-xs text-white/65 truncate">
                                                                            <span className={cn('font-mono', branch.current && 'text-green-300')}>
                                                                                {branch.current ? '* ' : ''}{branch.name}
                                                                            </span>
                                                                            {branch.isRemote ? ' (remote)' : ''}
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            )}

                                                            {remotes.length > 0 && (
                                                                <div className="space-y-1">
                                                                    <div className="text-xs text-white/40">Remotes</div>
                                                                    {remotes.slice(0, 3).map((remote) => (
                                                                        <div key={remote.name} className="text-xs text-white/65 truncate">
                                                                            <span className="font-mono">{remote.name}</span>{' '}
                                                                            <span className="text-white/40">{remote.fetchUrl || remote.pushUrl}</span>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )
                                    ) : gitView === 'changes' ? (
                                        changedFiles.length > 0 ? (
                                            <WorkingChangesView
                                                files={changedFiles}
                                                projectPath={decodedPath}
                                                currentPage={changesPage}
                                                onPageChange={setChangesPage}
                                            />
                                        ) : (
                                            <div className="flex flex-col items-center justify-center py-24 text-white/30">
                                                <Check size={48} className="mb-4 opacity-50 text-green-400" />
                                                <p>No local changes</p>
                                                <p className="text-xs opacity-50">Working tree is clean</p>
                                            </div>
                                        )
                                    ) : gitView === 'unpushed' ? (
                                        unpushedCommits.length > 0 ? (
                                            <>
                                                <div className="space-y-2">
                                                    {unpushedCommits.slice((unpushedPage - 1) * ITEMS_PER_PAGE, unpushedPage * ITEMS_PER_PAGE).map((commit) => (
                                                        <div
                                                            key={commit.hash}
                                                            onClick={() => handleCommitClick(commit)}
                                                            className="bg-black/30 rounded-xl border border-white/5 p-4 hover:bg-white/5 cursor-pointer transition-colors"
                                                        >
                                                            <div className="flex items-start gap-3">
                                                                <GitCommitHorizontal size={16} className="text-blue-400 mt-0.5" />
                                                                <div className="flex-1 min-w-0">
                                                                    <p className="text-sm font-medium text-white/90 mb-1">{commit.message}</p>
                                                                    <div className="flex items-center gap-3 text-xs text-white/40">
                                                                        <span className="font-mono">{commit.shortHash}</span>
                                                                        <span>{commit.author}</span>
                                                                        <span>{new Date(commit.date).toLocaleDateString()}</span>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                                {unpushedCommits.length > ITEMS_PER_PAGE && (
                                                    <div className="flex items-center justify-between pt-4 mt-4 border-t border-white/5">
                                                        <span className="text-xs text-white/40">
                                                            Showing {((unpushedPage - 1) * ITEMS_PER_PAGE) + 1}-{Math.min(unpushedPage * ITEMS_PER_PAGE, unpushedCommits.length)} of {unpushedCommits.length}
                                                        </span>
                                                        <div className="flex items-center gap-2">
                                                            <button
                                                                onClick={() => setUnpushedPage(p => Math.max(1, p - 1))}
                                                                disabled={unpushedPage === 1}
                                                                className="px-3 py-1.5 text-xs font-medium rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                                                            >
                                                                Previous
                                                            </button>
                                                            <span className="text-xs text-white/60 px-2">
                                                                {unpushedPage} / {Math.ceil(unpushedCommits.length / ITEMS_PER_PAGE)}
                                                            </span>
                                                            <button
                                                                onClick={() => setUnpushedPage(p => Math.min(Math.ceil(unpushedCommits.length / ITEMS_PER_PAGE), p + 1))}
                                                                disabled={unpushedPage >= Math.ceil(unpushedCommits.length / ITEMS_PER_PAGE)}
                                                                className="px-3 py-1.5 text-xs font-medium rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                                                            >
                                                                Next
                                                            </button>
                                                        </div>
                                                    </div>
                                                )}
                                            </>
                                        ) : (
                                            <div className="flex flex-col items-center justify-center py-24 text-white/30">
                                                <GitPullRequest size={48} className="mb-4 opacity-50" />
                                                <p>No unpushed commits</p>
                                                <p className="text-xs opacity-50">All commits are synced</p>
                                            </div>
                                        )
                                    ) : gitView === 'history' ? (
                                        loadingGit ? (
                                            <div className="flex items-center justify-center py-24 text-white/30">
                                                <RefreshCw size={24} className="animate-spin mb-2" />
                                                <p className="text-xs">Loading history...</p>
                                            </div>
                                        ) : gitHistory.length > 0 ? (
                                            <>
                                                <GitGraph
                                                    commits={gitHistory.slice((commitPage - 1) * COMMITS_PER_PAGE, commitPage * COMMITS_PER_PAGE)}
                                                    onCommitClick={handleCommitClick}
                                                />
                                                {gitHistory.length > COMMITS_PER_PAGE && (
                                                    <div className="flex items-center justify-between pt-4 mt-4 border-t border-white/5">
                                                        <span className="text-xs text-white/40">
                                                            Showing {((commitPage - 1) * COMMITS_PER_PAGE) + 1}-{Math.min(commitPage * COMMITS_PER_PAGE, gitHistory.length)} of {gitHistory.length}
                                                        </span>
                                                        <div className="flex items-center gap-2">
                                                            <button
                                                                onClick={() => setCommitPage(p => Math.max(1, p - 1))}
                                                                disabled={commitPage === 1}
                                                                className="px-3 py-1.5 text-xs font-medium rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                                                            >
                                                                Previous
                                                            </button>
                                                            <span className="text-xs text-white/60 px-2">
                                                                {commitPage} / {Math.ceil(gitHistory.length / COMMITS_PER_PAGE)}
                                                            </span>
                                                            <button
                                                                onClick={() => setCommitPage(p => Math.min(Math.ceil(gitHistory.length / COMMITS_PER_PAGE), p + 1))}
                                                                disabled={commitPage >= Math.ceil(gitHistory.length / COMMITS_PER_PAGE)}
                                                                className="px-3 py-1.5 text-xs font-medium rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                                                            >
                                                                Next
                                                            </button>
                                                        </div>
                                                    </div>
                                                )}
                                            </>
                                        ) : (
                                            <div className="flex flex-col items-center justify-center py-24 text-white/30">
                                                <GitBranch size={48} className="mb-4 opacity-50" />
                                                <p>No commit history found</p>
                                            </div>
                                        )
                                    ) : null}
                                </div>
                            </div>
                        ) : null}
                    </div>
                </div>


                <ProjectDetailsSidebar
                    scripts={project.scripts}
                    dependencies={project.dependencies}
                    scriptPredictions={scriptPredictions}
                    scriptIntentContext={scriptIntentContext}
                    onRunScript={runScript}
                    onShowDependencies={() => setShowDependenciesModal(true)}
                />
            </div>

            <ServerScriptRunModal
                pendingScriptRun={pendingScriptRun}
                scriptPortInput={scriptPortInput}
                setScriptPortInput={(value) => {
                    setScriptPortInput(value)
                    setScriptRunError(null)
                }}
                scriptExposeNetwork={scriptExposeNetwork}
                setScriptExposeNetwork={(value) => {
                    setScriptExposeNetwork(value)
                    setScriptRunError(null)
                }}
                scriptAdvancedOpen={scriptAdvancedOpen}
                setScriptAdvancedOpen={setScriptAdvancedOpen}
                scriptExtraArgsInput={scriptExtraArgsInput}
                setScriptExtraArgsInput={(value) => {
                    setScriptExtraArgsInput(value)
                    setScriptRunError(null)
                }}
                scriptEnvInput={scriptEnvInput}
                setScriptEnvInput={(value) => {
                    setScriptEnvInput(value)
                    setScriptRunError(null)
                }}
                scriptRunError={scriptRunError}
                scriptCommandPreview={scriptCommandPreview}
                scriptRunner={scriptRunner}
                onClose={closeScriptRunModal}
                onConfirm={handleConfirmScriptRun}
            />

            {/* File Preview Modal */}
            {previewFile && (
                <FilePreviewModal
                    file={previewFile}
                    content={previewContent}
                    loading={loadingPreview}
                    truncated={previewTruncated}
                    size={previewSize}
                    previewBytes={previewBytes}
                    onClose={closePreview}
                />
            )}

            {toast && (
                <div
                    className={cn(
                        'fixed bottom-4 right-4 z-[80] max-w-sm rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-300 shadow-lg backdrop-blur-md transition-all duration-300',
                        toast.visible ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0 pointer-events-none'
                    )}
                >
                    <div className="flex items-start gap-2">
                        <AlertCircle size={16} className="mt-0.5 shrink-0" />
                        <div className="flex flex-col gap-1">
                            <span>{toast.message}</span>
                            {toast.actionTo && toast.actionLabel && (
                                <button
                                    onClick={() => {
                                        navigate(toast.actionTo!)
                                        setToast(null)
                                    }}
                                    className="text-left text-xs font-medium text-amber-200 underline underline-offset-2 hover:text-amber-100 transition-colors"
                                >
                                    {toast.actionLabel}
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
