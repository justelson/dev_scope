import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useTerminal } from '@/App'
import { useFilePreview } from '@/components/ui/FilePreviewModal'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { CreateFileTypeModal } from '@/components/ui/CreateFileTypeModal'
import { PromptModal } from '@/components/ui/PromptModal'
import { useSettings } from '@/lib/settings'
import { trackRecentProject } from '@/lib/recentProjects'
import { useScriptRunModal } from './useScriptRunModal'
import { useProjectFileView } from './useProjectFileView'
import { getAllFolderPaths, isFileTreeFullyLoaded } from './fileTreeUtils'
import { createProjectGitActions } from './gitActions'
import { useProjectDataLifecycle } from './useProjectDataLifecycle'
import { ProjectDetailsContent } from './ProjectDetailsContent'
import { ProjectDetailsOverlays } from './ProjectDetailsOverlays'
import { ProjectDetailsErrorView, ProjectDetailsLoadingView } from './ProjectDetailsStateViews'
import { ProjectDetailsTransientUi } from './ProjectDetailsTransientUi'
import type {
    FileTreeNode,
    GitBranchSummary,
    GitCommit,
    GitRemoteSummary,
    GitSyncStatus,
    GitStatusDetail,
    GitStashSummary,
    GitTagSummary,
    InstalledIde,
    ProjectDetails
} from './types'

type FileSystemClipboardItem = {
    path: string
    name: string
    type: 'file' | 'directory'
}

type CreateFileSystemTarget = {
    destinationDirectory: string
    type: 'file' | 'directory'
    presetExtension?: string
}

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

function getParentFolderPath(currentPath: string): string | null {
    const raw = String(currentPath || '').trim().replace(/[\\/]+$/, '')
    if (!raw) return null

    if (/^[A-Za-z]:$/.test(raw)) return null
    if (/^\\\\[^\\]+\\[^\\]+$/.test(raw)) return null

    const lastSepIndex = Math.max(raw.lastIndexOf('\\'), raw.lastIndexOf('/'))
    if (lastSepIndex < 0) return null
    if (lastSepIndex === 0 && raw.startsWith('/')) return '/'

    const parent = raw.slice(0, lastSepIndex)
    if (!parent || parent === raw) return null

    if (/^[A-Za-z]:$/.test(parent)) {
        return `${parent}\\`
    }

    return parent
}

function splitFileNameForRename(name: string): { baseName: string; extensionSuffix: string } {
    const raw = String(name || '')
    const dotIndex = raw.lastIndexOf('.')
    if (dotIndex <= 0 || dotIndex === raw.length - 1) {
        return { baseName: raw, extensionSuffix: '' }
    }
    return {
        baseName: raw.slice(0, dotIndex),
        extensionSuffix: raw.slice(dotIndex)
    }
}

function getFileExtensionFromName(name: string): string {
    const dotIndex = name.lastIndexOf('.')
    if (dotIndex <= 0 || dotIndex === name.length - 1) return ''
    return name.slice(dotIndex + 1).toLowerCase()
}

function resolveBranchState(defaultBranch: string): {
    branchName: 'main' | 'master' | 'custom'
    customBranchName: string
} {
    const normalized = String(defaultBranch || '').trim()
    if (normalized === 'main') {
        return { branchName: 'main', customBranchName: '' }
    }
    if (normalized === 'master') {
        return { branchName: 'master', customBranchName: '' }
    }
    return {
        branchName: 'custom',
        customBranchName: normalized || 'develop'
    }
}

function validateCreateName(name: string): string | null {
    const trimmed = String(name || '').trim()
    if (!trimmed) return 'Name cannot be empty.'
    if (trimmed === '.' || trimmed === '..') return 'Name cannot be "." or "..".'
    if (trimmed.includes('/') || trimmed.includes('\\')) return 'Name cannot include path separators.'
    return null
}

const PROJECT_ACTIVE_TAB_STORAGE_PREFIX = 'devscope:project-details:active-tab:'
const PROJECT_GIT_ACTIVITY_STORAGE_PREFIX = 'devscope:project-details:git-activity:'

function readStoredProjectActiveTab(projectPath: string): 'readme' | 'files' | 'git' | null {
    try {
        const key = `${PROJECT_ACTIVE_TAB_STORAGE_PREFIX}${projectPath}`
        const raw = (window.localStorage.getItem(key) || '').trim()
        if (raw === 'readme' || raw === 'files' || raw === 'git') return raw
    } catch {
        // ignore storage access issues
    }
    return null
}

function writeStoredProjectActiveTab(projectPath: string, tab: 'readme' | 'files' | 'git'): void {
    try {
        const key = `${PROJECT_ACTIVE_TAB_STORAGE_PREFIX}${projectPath}`
        window.localStorage.setItem(key, tab)
    } catch {
        // ignore storage access issues
    }
}

function readStoredProjectGitActivity(projectPath: string): {
    lastFetched?: number
    lastPulled?: number
} {
    try {
        const key = `${PROJECT_GIT_ACTIVITY_STORAGE_PREFIX}${projectPath}`
        const raw = window.localStorage.getItem(key)
        if (!raw) return {}

        const parsed = JSON.parse(raw) as {
            lastFetched?: unknown
            lastPulled?: unknown
        }

        return {
            lastFetched: typeof parsed?.lastFetched === 'number' ? parsed.lastFetched : undefined,
            lastPulled: typeof parsed?.lastPulled === 'number' ? parsed.lastPulled : undefined
        }
    } catch {
        return {}
    }
}

function writeStoredProjectGitActivity(
    projectPath: string,
    value: {
        lastFetched?: number
        lastPulled?: number
    }
): void {
    try {
        const key = `${PROJECT_GIT_ACTIVITY_STORAGE_PREFIX}${projectPath}`
        window.localStorage.setItem(key, JSON.stringify({
            lastFetched: typeof value.lastFetched === 'number' ? value.lastFetched : null,
            lastPulled: typeof value.lastPulled === 'number' ? value.lastPulled : null
        }))
    } catch {
        // ignore storage access issues
    }
}

function mergeHistoryCommitStats(previousCommits: GitCommit[], nextCommits: GitCommit[]): GitCommit[] {
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

export default function ProjectDetailsPage() {
    const { projectPath } = useParams<{ projectPath: string }>()
    const decodedPath = projectPath ? decodeURIComponent(projectPath) : ''
    const navigate = useNavigate()
    const { openTerminal } = useTerminal()
    const { settings, updateSettings } = useSettings()
    const [project, setProject] = useState<ProjectDetails | null>(null)
    const projectRootPath = useMemo(() => String(decodedPath || project?.path || '').trim(), [decodedPath, project?.path])
    const projectTerminalLabel = useMemo(
        () => String(project?.displayName || project?.name || projectRootPath.split(/[\\/]/).pop() || 'Project'),
        [project?.displayName, project?.name, projectRootPath]
    )
    const [fileTree, setFileTree] = useState<FileTreeNode[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [showHidden, setShowHidden] = useState(false)
    const [copiedPath, setCopiedPath] = useState(false)
    const [installedIdes, setInstalledIdes] = useState<InstalledIde[]>([])
    const [loadingInstalledIdes, setLoadingInstalledIdes] = useState(false)
    const [openingIdeId, setOpeningIdeId] = useState<string | null>(null)
    const [activeTab, setActiveTab] = useState<'readme' | 'files' | 'git'>(() => (
        readStoredProjectActiveTab(decodedPath) || 'readme'
    ))
    const [showDependenciesModal, setShowDependenciesModal] = useState(false)
    const [showScriptsModal, setShowScriptsModal] = useState(false)
    const [isProjectLive, setIsProjectLive] = useState(false)
    const [activePorts, setActivePorts] = useState<number[]>([])
    const [gitHistory, setGitHistory] = useState<GitCommit[]>([])
    const [loadingGit, setLoadingGit] = useState(false)
    const [loadingGitHistory, setLoadingGitHistory] = useState(false)
    const [gitError, setGitError] = useState<string | null>(null)
    const [loadingFiles, setLoadingFiles] = useState(true)
    const [gitView, setGitView] = useState<'changes' | 'history' | 'unpushed' | 'pulls' | 'manage'>('manage')
    const [commitPage, setCommitPage] = useState(1)
    const [unpushedPage, setUnpushedPage] = useState(1)
    const [pullsPage, setPullsPage] = useState(1)
    const [changesPage, setChangesPage] = useState(1)
    const HISTORY_CHUNK_SIZE = 80
    const COMMITS_PER_PAGE = 15
    const ITEMS_PER_PAGE = 15
    const [historyLimit, setHistoryLimit] = useState(HISTORY_CHUNK_SIZE)
    const [loadingMoreHistory, setLoadingMoreHistory] = useState(false)
    const [selectedCommit, setSelectedCommit] = useState<GitCommit | null>(null)
    const [commitDiff, setCommitDiff] = useState<string>('')
    const [loadingDiff, setLoadingDiff] = useState(false)
    const [unpushedCommits, setUnpushedCommits] = useState<GitCommit[]>([])
    const [incomingCommits, setIncomingCommits] = useState<GitCommit[]>([])
    const [gitUser, setGitUser] = useState<{ name: string; email: string } | null>(null)
    const [repoOwner, setRepoOwner] = useState<string | null>(null)
    const [gitSyncStatus, setGitSyncStatus] = useState<GitSyncStatus | null>(null)
    const [commitMessage, setCommitMessage] = useState('')
    const [isCommitting, setIsCommitting] = useState(false)
    const [isGeneratingCommitMessage, setIsGeneratingCommitMessage] = useState(false)
    const [isPushing, setIsPushing] = useState(false)
    const [isFetching, setIsFetching] = useState(false)
    const [isPulling, setIsPulling] = useState(false)
    const [lastFetched, setLastFetched] = useState<number | undefined>(undefined)
    const [lastPulled, setLastPulled] = useState<number | undefined>(undefined)
    const [toast, setToast] = useState<{
        message: string
        visible: boolean
        actionLabel?: string
        actionTo?: string
        tone?: 'success' | 'error' | 'info'
    } | null>(null)
    const [showAuthorMismatch, setShowAuthorMismatch] = useState(false)
    const [isGitRepo, setIsGitRepo] = useState<boolean | null>(null)
    const [showInitModal, setShowInitModal] = useState(false)
    const [initStep, setInitStep] = useState<'config' | 'remote'>('config')
    const initialBranchState = useMemo(
        () => resolveBranchState(settings.gitInitDefaultBranch),
        [settings.gitInitDefaultBranch]
    )
    const [branchName, setBranchName] = useState<'main' | 'master' | 'custom'>(initialBranchState.branchName)
    const [customBranchName, setCustomBranchName] = useState(initialBranchState.customBranchName)
    const [createGitignore, setCreateGitignore] = useState(settings.gitInitCreateGitignore)
    const [gitignoreTemplate, setGitignoreTemplate] = useState<string>('')
    const [availableTemplates, setAvailableTemplates] = useState<string[]>([])
    const [createInitialCommit, setCreateInitialCommit] = useState(settings.gitInitCreateInitialCommit)
    const [initialCommitMessage, setInitialCommitMessage] = useState('Initial commit')
    const [isInitializing, setIsInitializing] = useState(false)
    const [remoteUrl, setRemoteUrl] = useState('')
    const [isAddingRemote, setIsAddingRemote] = useState(false)
    const [hasRemote, setHasRemote] = useState<boolean | null>(null)
    const [branches, setBranches] = useState<GitBranchSummary[]>([])
    const [remotes, setRemotes] = useState<GitRemoteSummary[]>([])
    const [tags, setTags] = useState<GitTagSummary[]>([])
    const [stashes, setStashes] = useState<GitStashSummary[]>([])
    const [gitStatusDetails, setGitStatusDetails] = useState<GitStatusDetail[]>([])
    const [gitStatusMap, setGitStatusMap] = useState<Record<string, FileTreeNode['gitStatus']>>({})
    const [targetBranch, setTargetBranch] = useState('')
    const [isSwitchingBranch, setIsSwitchingBranch] = useState(false)
    const [showCustomGitignore, setShowCustomGitignore] = useState(false)
    const [availablePatterns, setAvailablePatterns] = useState<any[]>([])
    const [selectedPatterns, setSelectedPatterns] = useState<Set<string>>(new Set())
    const [patternSearch, setPatternSearch] = useState('')
    const historyStatsRequestRef = useRef(0)
    const {
        previewFile,
        previewContent,
        loadingPreview,
        previewTruncated,
        previewSize,
        previewBytes,
        previewModifiedAt,
        openPreview,
        closePreview,
        openFile
    } = useFilePreview()
    const [readmeExpanded, setReadmeExpanded] = useState(false)
    const [readmeNeedsExpand, setReadmeNeedsExpand] = useState(false)
    const readmeContentRef = useRef<HTMLDivElement | null>(null)
    const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set())
    const [isExpandingFolders, setIsExpandingFolders] = useState(false)
    const [loadingFolderPaths, setLoadingFolderPaths] = useState<Set<string>>(new Set())
    const [sortBy, setSortBy] = useState<'name' | 'size' | 'type'>('name')
    const [sortAsc, setSortAsc] = useState(true)
    const [fileSearch, setFileSearch] = useState('')
    const [fileClipboardItem, setFileClipboardItem] = useState<FileSystemClipboardItem | null>(null)
    const workingStatsPendingPathsRef = useRef<Set<string>>(new Set())
    const [renameTarget, setRenameTarget] = useState<FileTreeNode | null>(null)
    const [renameDraft, setRenameDraft] = useState('')
    const [renameExtensionSuffix, setRenameExtensionSuffix] = useState('')
    const [renameErrorMessage, setRenameErrorMessage] = useState<string | null>(null)
    const [createTarget, setCreateTarget] = useState<CreateFileSystemTarget | null>(null)
    const [createDraft, setCreateDraft] = useState('')
    const [createErrorMessage, setCreateErrorMessage] = useState<string | null>(null)
    const [deleteTarget, setDeleteTarget] = useState<FileTreeNode | null>(null)
    const currentBranch = useMemo(() => branches.find(branch => branch.current)?.name || '', [branches])
    const {
        scriptRunner,
        scriptIntentContext,
        scriptPredictions,
        pendingScriptRun,
        scriptPortInput,
        setScriptPortInput,
        scriptExposeNetwork,
        setScriptExposeNetwork,
        scriptAdvancedOpen,
        setScriptAdvancedOpen,
        scriptExtraArgsInput,
        setScriptExtraArgsInput,
        scriptEnvInput,
        setScriptEnvInput,
        scriptRunError,
        setScriptRunError,
        runScript,
        closeScriptRunModal,
        handleConfirmScriptRun,
        scriptCommandPreview
    } = useScriptRunModal({
        project,
        defaultShell: settings.defaultShell,
        openTerminal
    })
    useEffect(() => {
        setTargetBranch(currentBranch)
    }, [currentBranch])
    useEffect(() => {
        if (!decodedPath) return
        trackRecentProject(decodedPath, 'project')
    }, [decodedPath])
    useEffect(() => {
        if (!decodedPath) return
        const storedTab = readStoredProjectActiveTab(decodedPath)
        const storedGitActivity = readStoredProjectGitActivity(decodedPath)
        setActiveTab(storedTab || 'readme')
        setLastFetched(storedGitActivity.lastFetched)
        setLastPulled(storedGitActivity.lastPulled)
        setPullsPage(1)
        setHistoryLimit(HISTORY_CHUNK_SIZE)
        setLoadingMoreHistory(false)
        workingStatsPendingPathsRef.current.clear()
    }, [decodedPath])
    useEffect(() => {
        if (!decodedPath) return
        writeStoredProjectGitActivity(decodedPath, { lastFetched, lastPulled })
    }, [decodedPath, lastFetched, lastPulled])
    useEffect(() => {
        const totalPages = Math.max(1, Math.ceil(incomingCommits.length / ITEMS_PER_PAGE))
        setPullsPage((prev) => Math.min(prev, totalPages))
    }, [incomingCommits.length, ITEMS_PER_PAGE])
    useEffect(() => {
        if (activeTab !== 'git' || gitView !== 'history' || gitHistory.length === 0) return

        const pageStart = Math.max(0, (commitPage - 1) * COMMITS_PER_PAGE)
        const pageEnd = Math.max(pageStart, commitPage * COMMITS_PER_PAGE)
        const missingStatsHashes = gitHistory
            .slice(pageStart, pageEnd)
            .filter((commit) => commit.statsLoaded !== true)
            .map((commit) => commit.hash)

        if (missingStatsHashes.length === 0) return

        const requestId = ++historyStatsRequestRef.current

        void window.devscope.getGitCommitStats(decodedPath, missingStatsHashes).then((result) => {
            if (requestId !== historyStatsRequestRef.current || !result?.success || !Array.isArray(result.commits)) {
                return
            }

            const statsByHash = new Map(result.commits.map((commit) => [commit.hash, commit]))
            if (statsByHash.size === 0) return

            setGitHistory((prev) => prev.map((commit) => {
                const stats = statsByHash.get(commit.hash)
                if (!stats) return commit
                return {
                    ...commit,
                    additions: stats.additions,
                    deletions: stats.deletions,
                    filesChanged: stats.filesChanged,
                    statsLoaded: true
                }
            }))
        })
    }, [activeTab, commitPage, decodedPath, gitHistory, gitView, COMMITS_PER_PAGE])
    useEffect(() => {
        if (gitHistory.length === 0) return

        const normalizedHistoryLimit = Math.max(
            HISTORY_CHUNK_SIZE,
            Math.ceil(gitHistory.length / HISTORY_CHUNK_SIZE) * HISTORY_CHUNK_SIZE
        )
        setHistoryLimit((prev) => (prev < normalizedHistoryLimit ? normalizedHistoryLimit : prev))
    }, [gitHistory.length])
    useEffect(() => {
        if (!showInitModal) return
        const nextBranchState = resolveBranchState(settings.gitInitDefaultBranch)
        setBranchName(nextBranchState.branchName)
        setCustomBranchName(nextBranchState.customBranchName)
        setCreateGitignore(settings.gitInitCreateGitignore)
        setCreateInitialCommit(settings.gitInitCreateInitialCommit)
    }, [
        showInitModal,
        settings.gitInitDefaultBranch,
        settings.gitInitCreateGitignore,
        settings.gitInitCreateInitialCommit
    ])
    useEffect(() => {
        if (!decodedPath) return
        writeStoredProjectActiveTab(decodedPath, activeTab)
    }, [decodedPath, activeTab])
    const loadInstalledIdes = async () => {
        setLoadingInstalledIdes(true)
        try {
            const result = await window.devscope.listInstalledIdes()
            if (result.success) {
                setInstalledIdes(result.ides)
                return
            }
            setInstalledIdes([])
        } catch (err) {
            console.error('Failed to load installed IDEs:', err)
            setInstalledIdes([])
        } finally {
            setLoadingInstalledIdes(false)
        }
    }
    useEffect(() => {
        void loadInstalledIdes()
    }, [decodedPath])
    const goBack = () => {
        const parentPath = getParentFolderPath(project?.path || decodedPath)
        if (parentPath) {
            navigate(`/folder-browse/${encodeURIComponent(parentPath)}`)
            return
        }
        navigate('/projects')
    }
    const showToast = (
        message: string,
        actionLabel?: string,
        actionTo?: string,
        tone: 'success' | 'error' | 'info' = 'success'
    ) => {
        setToast({ message, visible: false, actionLabel, actionTo, tone })
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
    const {
        loadProjectDetails,
        refreshGitData,
        refreshFileTree
    } = useProjectDataLifecycle({
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
        historyLimit,
        autoRefreshGitOnProjectOpen: settings.gitAutoRefreshOnProjectOpen,
        showInitModal,
        gitignoreTemplate,
        availableTemplates,
        availablePatterns,
        readmeExpanded,
        readmeCollapsedMaxHeight: README_COLLAPSED_MAX_HEIGHT,
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
    })
    const historyHasMore = gitHistory.length >= historyLimit && gitHistory.length > 0
    const loadMoreGitHistory = useCallback(async () => {
        if (!decodedPath || loadingMoreHistory) return false

        const nextLimit = historyLimit + HISTORY_CHUNK_SIZE
        setLoadingMoreHistory(true)

        try {
            const result = await window.devscope.getGitHistory(decodedPath, nextLimit, {
                all: false,
                includeStats: false
            })
            if (!result?.success) {
                return false
            }

            const nextCommits = result.commits || []
            setHistoryLimit(nextLimit)

            if (nextCommits.length <= gitHistory.length) {
                return false
            }

            setGitHistory((prev) => mergeHistoryCommitStats(prev, nextCommits))
            return true
        } finally {
            setLoadingMoreHistory(false)
        }
    }, [decodedPath, gitHistory.length, historyLimit, loadingMoreHistory])
    const {
        changedFiles,
        allFolderPathsSet,
        hasFileSearch,
        parsedFileSearch,
        folderChildInfoMap,
        effectiveExpandedFolders,
        visibleFileList
    } = useProjectFileView({
        fileTree,
        gitStatusMap,
        showHidden,
        sortBy,
        sortAsc,
        fileSearch,
        expandedFolders,
        previewableExtensions: PREVIEWABLE_EXTENSIONS,
        previewableFileNames: PREVIEWABLE_FILE_NAMES
    })
    const fileTreeFullyLoaded = useMemo(() => isFileTreeFullyLoaded(fileTree), [fileTree])
    const stagedFiles = useMemo(() => (
        gitStatusDetails
            .filter((item) => item.staged)
            .map((item) => {
                const normalizedPath = item.path.replace(/\\/g, '/')
                const segments = normalizedPath.split('/').filter(Boolean)
                const name = segments[segments.length - 1] || normalizedPath
                return { ...item, path: normalizedPath, name, gitStatus: item.status }
            })
            .sort((a, b) => a.path.localeCompare(b.path))
    ), [gitStatusDetails])
    const unstagedFiles = useMemo(() => (
        gitStatusDetails
            .filter((item) => item.unstaged)
            .map((item) => {
                const normalizedPath = item.path.replace(/\\/g, '/')
                const segments = normalizedPath.split('/').filter(Boolean)
                const name = segments[segments.length - 1] || normalizedPath
                return { ...item, path: normalizedPath, name, gitStatus: item.status }
            })
            .sort((a, b) => a.path.localeCompare(b.path))
    ), [gitStatusDetails])
    const ensureWorkingChangeStats = useCallback(async (paths: string[]) => {
        if (!decodedPath || paths.length === 0) return

        const normalizedPaths = Array.from(
            new Set(
                paths
                    .map((path) => String(path || '').replace(/\\/g, '/').trim())
                    .filter(Boolean)
            )
        )

        if (normalizedPaths.length === 0) return

        const pendingPaths = workingStatsPendingPathsRef.current
        const missingPaths = normalizedPaths.filter((path) => {
            if (pendingPaths.has(path)) return false
            const detail = gitStatusDetails.find((item) => item.path.replace(/\\/g, '/') === path)
            return detail?.statsLoaded !== true
        })

        if (missingPaths.length === 0) return

        missingPaths.forEach((path) => pendingPaths.add(path))

        try {
            const result = await window.devscope.getGitStatusEntryStats(decodedPath, missingPaths)
            const statsEntries = result?.success ? result.entries || [] : []
            const statsByPath = new Map(statsEntries.map((entry) => [entry.path.replace(/\\/g, '/'), entry]))

            setGitStatusDetails((prev) => prev.map((detail) => {
                const normalizedPath = detail.path.replace(/\\/g, '/')
                if (!missingPaths.includes(normalizedPath)) return detail

                const stats = statsByPath.get(normalizedPath)
                if (!stats) {
                    return {
                        ...detail,
                        statsLoaded: true
                    }
                }

                return {
                    ...detail,
                    additions: stats.additions,
                    deletions: stats.deletions,
                    stagedAdditions: stats.stagedAdditions,
                    stagedDeletions: stats.stagedDeletions,
                    unstagedAdditions: stats.unstagedAdditions,
                    unstagedDeletions: stats.unstagedDeletions,
                    statsLoaded: true
                }
            }))
        } finally {
            missingPaths.forEach((path) => pendingPaths.delete(path))
        }
    }, [decodedPath, gitStatusDetails])
    const handleCopyPath = async () => {
        if (projectRootPath) {
            try {
                // Try IPC first (more robust in Electron)
                if (window.devscope.copyToClipboard) {
                    await window.devscope.copyToClipboard(projectRootPath)
                } else {
                    // Fallback
                    await navigator.clipboard.writeText(projectRootPath)
                }
                setCopiedPath(true)
                showToast('Copied project path')
                setTimeout(() => setCopiedPath(false), 2000)
            } catch (err) {
                console.error('Failed to copy path:', err)
                showToast('Failed to copy path to clipboard', undefined, undefined, 'error')
            }
        }
    }

    const copyTextToClipboard = async (value: string, successMessage?: string): Promise<boolean> => {
        try {
            if (window.devscope.copyToClipboard) {
                const result = await window.devscope.copyToClipboard(value)
                if (!result.success) {
                    showToast(result.error || 'Failed to copy to clipboard', undefined, undefined, 'error')
                    return false
                }
            } else {
                await navigator.clipboard.writeText(value)
            }
            if (successMessage) showToast(successMessage)
            return true
        } catch (err: any) {
            showToast(err?.message || 'Failed to copy to clipboard', undefined, undefined, 'error')
            return false
        }
    }

    const refreshVisibleFileTree = async (targetPath?: string) => {
        const normalizedTargetPath = String(targetPath || '').trim()
        const shouldDeepRefresh = fileTreeFullyLoaded || fileSearch.trim().length > 0

        if (!projectRootPath || !normalizedTargetPath || normalizedTargetPath === projectRootPath) {
            return refreshFileTree({ deep: shouldDeepRefresh })
        }

        if (shouldDeepRefresh) {
            return refreshFileTree({ deep: true })
        }

        return refreshFileTree({ targetPath: normalizedTargetPath })
    }

    const handleToggleFolder = async (node: FileTreeNode) => {
        if (node.type !== 'directory') return

        if (expandedFolders.has(node.path)) {
            setExpandedFolders((prev) => {
                const next = new Set(prev)
                next.delete(node.path)
                return next
            })
            return
        }

        // Add to expanded folders BEFORE loading children to prevent close-on-load
        setExpandedFolders((prev) => {
            const next = new Set(prev)
            next.add(node.path)
            return next
        })

        const needsChildren = node.childrenLoaded === false || typeof node.children === 'undefined'
        if (needsChildren) {
            setLoadingFolderPaths((prev) => new Set(prev).add(node.path))
            try {
                await refreshFileTree({ targetPath: node.path })
            } catch (err: any) {
                showToast(err?.message || `Failed to load "${node.name}"`, undefined, undefined, 'error')
                // Remove from expanded folders if loading failed
                setExpandedFolders((prev) => {
                    const next = new Set(prev)
                    next.delete(node.path)
                    return next
                })
                return
            } finally {
                setLoadingFolderPaths((prev) => {
                    const next = new Set(prev)
                    next.delete(node.path)
                    return next
                })
            }
        }
    }

    const handleToggleAllFolders = async () => {
        setIsExpandingFolders(true)
        try {
            if (expandedFolders.size > 0) {
                setExpandedFolders(new Set())
                return
            }

            const nextTree = fileTreeFullyLoaded
                ? fileTree
                : (await refreshFileTree({ deep: true })) || fileTree

            setExpandedFolders(new Set(getAllFolderPaths(nextTree)))
        } finally {
            setIsExpandingFolders(false)
        }
    }

    const handleFileTreeOpen = async (node: FileTreeNode) => {
        if (node.type === 'directory') {
            await handleToggleFolder(node)
            return
        }
        await openFile(node.path)
    }

    const handleFileTreeOpenWith = async (node: FileTreeNode) => {
        if (node.type === 'directory') return
        const result = await window.devscope.openWith(node.path)
        if (!result.success) {
            showToast(result.error || `Failed to open "${node.name}" with...`, undefined, undefined, 'error')
        }
    }

    const handleFileTreeOpenInExplorer = async (node: FileTreeNode) => {
        const result = await window.devscope.openInExplorer(node.path)
        if (!result.success) {
            showToast(result.error || `Failed to open "${node.name}" in explorer`, undefined, undefined, 'error')
        }
    }

    const handleOpenProjectInIde = async (ideId: string) => {
        if (!projectRootPath) return

        setOpeningIdeId(ideId)
        try {
            const result = await window.devscope.openProjectInIde(projectRootPath, ideId)
            if (!result.success) {
                showToast(result.error || 'Failed to open project in IDE', undefined, undefined, 'error')
                return
            }
            showToast(`Opening in ${result.ide.name}`)
        } catch (err: any) {
            showToast(err?.message || 'Failed to open project in IDE', undefined, undefined, 'error')
        } finally {
            setOpeningIdeId(null)
        }
    }

    const handleFileTreeCopyPath = async (node: FileTreeNode) => {
        await copyTextToClipboard(node.path, `Copied path: ${node.name}`)
    }

    const handleFileTreeCopy = (node: FileTreeNode) => {
        setFileClipboardItem({
            path: node.path,
            name: node.name,
            type: node.type
        })
        showToast(`Copied ${node.type === 'directory' ? 'folder' : 'file'}: ${node.name}`)
    }

    const handleFileTreeRename = async (node: FileTreeNode) => {
        const splitName = splitFileNameForRename(node.name)
        setRenameTarget(node)
        setRenameDraft(splitName.baseName)
        setRenameExtensionSuffix(node.type === 'file' ? splitName.extensionSuffix : '')
        setRenameErrorMessage(null)
    }

    const handleFileTreeDelete = async (node: FileTreeNode) => {
        setDeleteTarget(node)
    }

    const handleFileTreePaste = async (node: FileTreeNode) => {
        if (!fileClipboardItem) return

        const destinationDirectory = node.type === 'directory'
            ? node.path
            : getParentFolderPath(node.path)

        if (!destinationDirectory) {
            showToast('Unable to resolve destination folder for paste.', undefined, undefined, 'error')
            return
        }

        const result = await window.devscope.pasteFileSystemItem(fileClipboardItem.path, destinationDirectory)
        if (!result.success) {
            showToast(result.error || `Failed to paste "${fileClipboardItem.name}"`, undefined, undefined, 'error')
            return
        }

        showToast(`Pasted ${fileClipboardItem.name}`)
        await refreshVisibleFileTree(destinationDirectory)
    }

    const resolveCreateDestinationDirectory = (node?: FileTreeNode): string | null => {
        if (!node) {
            return projectRootPath || null
        }
        if (node.type === 'directory') return node.path
        return getParentFolderPath(node.path)
    }

    const openCreatePrompt = (destinationDirectory: string, type: 'file' | 'directory', presetExtension?: string) => {
        setCreateTarget({ destinationDirectory, type, presetExtension })
        setCreateDraft('')
        setCreateErrorMessage(null)
    }

    const handleFileTreeCreateFile = (node?: FileTreeNode, presetExtension?: string) => {
        const destinationDirectory = resolveCreateDestinationDirectory(node)
        if (!destinationDirectory) {
            showToast('Unable to resolve destination folder.', undefined, undefined, 'error')
            return
        }
        openCreatePrompt(destinationDirectory, 'file', presetExtension)
    }

    const handleFileTreeCreateFolder = (node?: FileTreeNode) => {
        const destinationDirectory = resolveCreateDestinationDirectory(node)
        if (!destinationDirectory) {
            showToast('Unable to resolve destination folder.', undefined, undefined, 'error')
            return
        }
        openCreatePrompt(destinationDirectory, 'directory')
    }

    const submitCreateTarget = async (nextName?: string) => {
        if (!createTarget) return

        const normalizedName = String(nextName ?? createDraft).trim()
        const validationError = validateCreateName(normalizedName)
        if (validationError) {
            setCreateErrorMessage(validationError)
            return
        }

        const result = await window.devscope.createFileSystemItem(
            createTarget.destinationDirectory,
            normalizedName,
            createTarget.type
        )
        if (!result.success) {
            setCreateErrorMessage(result.error || `Failed to create ${createTarget.type}.`)
            return
        }

        const createdPath = result.path
        const createdName = result.name
        const createdType = result.type

        setCreateTarget(null)
        setCreateDraft('')
        setCreateErrorMessage(null)

        showToast(`Created ${createdType === 'file' ? 'file' : 'folder'}: ${createdName}`)
        await refreshVisibleFileTree(createTarget.destinationDirectory)

        if (createdType === 'file') {
            const ext = getFileExtensionFromName(createdName) || 'txt'
            await openPreview(
                { name: createdName, path: createdPath },
                ext,
                { startInEditMode: true }
            )
        }
    }

    const submitRenameTarget = async () => {
        if (!renameTarget) return
        const normalizedBaseName = renameDraft.trim()
        if (!normalizedBaseName) {
            setRenameErrorMessage('Name cannot be empty.')
            return
        }
        const normalizedNextName = renameTarget.type === 'file'
            ? `${normalizedBaseName}${renameExtensionSuffix}`
            : normalizedBaseName
        if (normalizedNextName === renameTarget.name) {
            setRenameTarget(null)
            setRenameDraft('')
            setRenameExtensionSuffix('')
            setRenameErrorMessage(null)
            return
        }

        const result = await window.devscope.renameFileSystemItem(renameTarget.path, normalizedNextName)
        if (!result.success) {
            setRenameErrorMessage(result.error || `Failed to rename "${renameTarget.name}"`)
            return
        }

        showToast(`Renamed to ${normalizedNextName}`)
        setRenameTarget(null)
        setRenameDraft('')
        setRenameExtensionSuffix('')
        setRenameErrorMessage(null)
        await refreshVisibleFileTree(getParentFolderPath(renameTarget.path) || projectRootPath)
    }

    const confirmDeleteTarget = async () => {
        if (!deleteTarget) return
        const result = await window.devscope.deleteFileSystemItem(deleteTarget.path)
        if (!result.success) {
            showToast(result.error || `Failed to delete "${deleteTarget.name}"`, undefined, undefined, 'error')
            return
        }

        if (fileClipboardItem?.path === deleteTarget.path) {
            setFileClipboardItem(null)
        }

        showToast(`Deleted ${deleteTarget.name}`)
        setDeleteTarget(null)
        await refreshVisibleFileTree(getParentFolderPath(deleteTarget.path) || projectRootPath)
    }

    useEffect(() => {
        if (activeTab !== 'files' || loadingFiles) return
        if (!fileSearch.trim()) return
        if (fileTreeFullyLoaded) return
        void refreshFileTree({ deep: true })
    }, [activeTab, fileSearch, fileTreeFullyLoaded, loadingFiles, refreshFileTree])

    const {
        handleCommitClick,
        handleCommit,
        handleGenerateCommitMessage,
        handleFetch,
        handlePush,
        handlePull,
        handleStageFile,
        handleUnstageFile,
        handleStageAll,
        handleUnstageAll,
        handleSwitchBranch,
        handleInitGit,
        handleAddRemote,
        handleSkipRemote,
        handleAuthorMismatchConfirm,
        handleOpenInExplorer
    } = createProjectGitActions({
        decodedPath,
        commitMessage,
        changedFiles,
        stagedFiles,
        unstagedFiles,
        gitUser,
        repoOwner,
        settings,
        unpushedCommits,
        targetBranch,
        currentBranch,
        branchName,
        customBranchName,
        createGitignore,
        gitignoreTemplate,
        selectedPatterns,
        createInitialCommit,
        initialCommitMessage,
        remoteUrl,
        projectPath: project?.path,
        refreshGitData,
        showToast,
        setSelectedCommit,
        setLoadingDiff,
        setCommitDiff,
        setShowAuthorMismatch,
        setIsGeneratingCommitMessage,
        setCommitMessage,
        setIsCommitting,
        setIsPushing,
        setIsFetching,
        setIsPulling,
        setLastFetched,
        setLastPulled,
        setIsSwitchingBranch,
        setIsInitializing,
        setIsGitRepo,
        setInitStep,
        setRemoteUrl,
        setHasRemote,
        setShowInitModal,
        setIsAddingRemote,
        setGitStatusDetails,
        setGitStatusMap
    })
    const formatRelTime = (ts?: number) => {
        if (!ts) return ''
        const days = Math.floor((Date.now() - ts) / 86400000)
        return days === 0 ? 'Today' : days === 1 ? 'Yesterday' : `${days} days ago`
    }
    if (loading) {
        return <ProjectDetailsLoadingView />
    }
    if (!project) {
        return <ProjectDetailsErrorView error={error} onBackToProjects={() => navigate('/projects')} />
    }
    const themeColor = project.typeInfo?.themeColor || '#525252'
    const isCondensedLayout = false
    return (
        <div
            className={isCondensedLayout
                ? 'animate-fadeIn pb-24 pl-6 pt-6 pr-6 transition-[width,margin-right,padding] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]'
                : 'mx-auto animate-fadeIn pb-24 px-6 pt-6 transition-[max-width,padding] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]'}
            style={{
                maxWidth: isCondensedLayout ? undefined : '1600px',
            }}
        >
            <ProjectDetailsOverlays
                project={project}
                showScriptsModal={showScriptsModal}
                setShowScriptsModal={setShowScriptsModal}
                showDependenciesModal={showDependenciesModal}
                setShowDependenciesModal={setShowDependenciesModal}
                onDependenciesUpdated={async () => {
                    await loadProjectDetails()
                }}
                onRunScript={runScript}
                scriptPredictions={scriptPredictions}
                selectedCommit={selectedCommit}
                commitDiff={commitDiff}
                loadingDiff={loadingDiff}
                setSelectedCommit={setSelectedCommit}
                setCommitDiff={setCommitDiff}
                showAuthorMismatch={showAuthorMismatch}
                gitUser={gitUser}
                repoOwner={repoOwner}
                handleAuthorMismatchConfirm={handleAuthorMismatchConfirm}
                setShowAuthorMismatch={setShowAuthorMismatch}
                dontShowAuthorWarning={!settings.gitWarnOnAuthorMismatch}
                setDontShowAuthorWarning={(value: boolean) => updateSettings({ gitWarnOnAuthorMismatch: !value })}
                showInitModal={showInitModal}
                setShowInitModal={setShowInitModal}
                setInitStep={setInitStep}
                initStep={initStep}
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
                handleInitGit={handleInitGit}
                remoteUrl={remoteUrl}
                setRemoteUrl={setRemoteUrl}
                isAddingRemote={isAddingRemote}
                handleAddRemote={handleAddRemote}
                handleSkipRemote={handleSkipRemote}
            />
            <ProjectDetailsContent
                isCondensedLayout={isCondensedLayout}
                themeColor={themeColor}
                project={project}
                isProjectLive={isProjectLive}
                activePorts={activePorts}
                formatRelTime={formatRelTime}
                onOpenTerminal={() => openTerminal({ displayName: projectTerminalLabel, id: 'main', category: 'project' }, projectRootPath)}
                scriptCount={Object.keys(project.scripts || {}).length}
                dependencyCount={Object.keys(project.dependencies || {}).length + Object.keys(project.devDependencies || {}).length}
                installedIdes={installedIdes}
                loadingInstalledIdes={loadingInstalledIdes}
                openingIdeId={openingIdeId}
                onOpenProjectInIde={handleOpenProjectInIde}
                handleCopyPath={handleCopyPath}
                copiedPath={copiedPath}
                handleOpenInExplorer={handleOpenInExplorer}
                goBack={goBack}
                activeTab={activeTab}
                setActiveTab={setActiveTab}
                fileTree={fileTree}
                loadingGit={loadingGit}
                loadingGitHistory={loadingGitHistory}
                loadingFiles={loadingFiles}
                changedFiles={changedFiles}
                stagedFiles={stagedFiles}
                unstagedFiles={unstagedFiles}
                unpushedCommits={unpushedCommits}
                onBrowseFolder={() => {
                    const encodedPath = encodeURIComponent(projectRootPath)
                    navigate(`/folder-browse/${encodedPath}`)
                }}
                onShowScriptsModal={() => setShowScriptsModal(true)}
                onShowDependenciesModal={() => setShowDependenciesModal(true)}
                loadProjectDetails={async () => {
                    await Promise.all([loadProjectDetails(), loadInstalledIdes()])
                }}
                refreshFileTree={refreshFileTree}
                onToggleAllFolders={handleToggleAllFolders}
                readmeContentRef={readmeContentRef}
                readmeExpanded={readmeExpanded}
                readmeNeedsExpand={readmeNeedsExpand}
                setReadmeExpanded={setReadmeExpanded}
                fileSearch={fileSearch}
                setFileSearch={setFileSearch}
                setIsExpandingFolders={setIsExpandingFolders}
                expandedFolders={expandedFolders}
                setExpandedFolders={setExpandedFolders}
                loadingFolderPaths={loadingFolderPaths}
                allFolderPathsSet={allFolderPathsSet}
                isExpandingFolders={isExpandingFolders}
                showHidden={showHidden}
                setShowHidden={setShowHidden}
                sortBy={sortBy}
                setSortBy={setSortBy}
                sortAsc={sortAsc}
                setSortAsc={setSortAsc}
                visibleFileList={visibleFileList}
                openPreview={openPreview}
                onFileTreeOpen={handleFileTreeOpen}
                onToggleFolder={handleToggleFolder}
                onFileTreeOpenWith={handleFileTreeOpenWith}
                onFileTreeOpenInExplorer={handleFileTreeOpenInExplorer}
                onFileTreeCopyPath={handleFileTreeCopyPath}
                onFileTreeCopy={handleFileTreeCopy}
                onFileTreeRename={handleFileTreeRename}
                onFileTreeDelete={handleFileTreeDelete}
                onFileTreePaste={handleFileTreePaste}
                onFileTreeCreateFile={handleFileTreeCreateFile}
                onFileTreeCreateFolder={handleFileTreeCreateFolder}
                hasFileClipboardItem={Boolean(fileClipboardItem)}
                gitUser={gitUser}
                repoOwner={repoOwner}
                gitError={gitError}
                gitView={gitView}
                setGitView={setGitView}
                refreshGitData={refreshGitData}
                isGitRepo={isGitRepo}
                setShowInitModal={setShowInitModal}
                currentBranch={currentBranch}
                targetBranch={targetBranch}
                setTargetBranch={setTargetBranch}
                branches={branches}
                isSwitchingBranch={isSwitchingBranch}
                handleSwitchBranch={handleSwitchBranch}
                commitMessage={commitMessage}
                setCommitMessage={setCommitMessage}
                handleGenerateCommitMessage={handleGenerateCommitMessage}
                isGeneratingCommitMessage={isGeneratingCommitMessage}
                isCommitting={isCommitting}
                settings={settings}
                handleCommit={handleCommit}
                handleStageFile={handleStageFile}
                handleUnstageFile={handleUnstageFile}
                handleStageAll={handleStageAll}
                handleUnstageAll={handleUnstageAll}
                ensureStatsForPaths={ensureWorkingChangeStats}
                hasRemote={hasRemote}
                gitSyncStatus={gitSyncStatus}
                incomingCommits={incomingCommits}
                setInitStep={setInitStep}
                handleFetch={handleFetch}
                handlePush={handlePush}
                handlePull={handlePull}
                isPushing={isPushing}
                isFetching={isFetching}
                isPulling={isPulling}
                lastFetched={lastFetched}
                lastPulled={lastPulled}
                gitHistory={gitHistory}
                historyHasMore={historyHasMore}
                loadingMoreHistory={loadingMoreHistory}
                loadMoreGitHistory={loadMoreGitHistory}
                remotes={remotes}
                tags={tags}
                stashes={stashes}
                decodedPath={decodedPath}
                changesPage={changesPage}
                setChangesPage={setChangesPage}
                ITEMS_PER_PAGE={ITEMS_PER_PAGE}
                handleCommitClick={handleCommitClick}
                unpushedPage={unpushedPage}
                setUnpushedPage={setUnpushedPage}
                pullsPage={pullsPage}
                setPullsPage={setPullsPage}
                COMMITS_PER_PAGE={COMMITS_PER_PAGE}
                commitPage={commitPage}
                setCommitPage={setCommitPage}
                scriptPredictions={scriptPredictions}
                scriptIntentContext={scriptIntentContext}
                runScript={runScript}
                setShowDependenciesModal={setShowDependenciesModal}
            />
            <ProjectDetailsTransientUi
                projectPath={project.path}
                pendingScriptRun={pendingScriptRun}
                scriptPortInput={scriptPortInput}
                setScriptPortInput={setScriptPortInput}
                setScriptRunError={setScriptRunError}
                scriptExposeNetwork={scriptExposeNetwork}
                setScriptExposeNetwork={setScriptExposeNetwork}
                scriptAdvancedOpen={scriptAdvancedOpen}
                setScriptAdvancedOpen={setScriptAdvancedOpen}
                scriptExtraArgsInput={scriptExtraArgsInput}
                setScriptExtraArgsInput={setScriptExtraArgsInput}
                scriptEnvInput={scriptEnvInput}
                setScriptEnvInput={setScriptEnvInput}
                scriptRunError={scriptRunError}
                scriptCommandPreview={scriptCommandPreview}
                scriptRunner={scriptRunner}
                closeScriptRunModal={closeScriptRunModal}
                handleConfirmScriptRun={handleConfirmScriptRun}
                previewFile={previewFile}
                previewContent={previewContent}
                loadingPreview={loadingPreview}
                previewTruncated={previewTruncated}
                previewSize={previewSize}
                previewBytes={previewBytes}
                previewModifiedAt={previewModifiedAt}
                openPreview={openPreview}
                onPreviewSaved={async () => {
                    await Promise.all([refreshVisibleFileTree(getParentFolderPath(previewFile?.path || '') || undefined), refreshGitData()])
                }}
                closePreview={closePreview}
                toast={toast}
                navigate={navigate}
                setToast={setToast}
            />
            <CreateFileTypeModal
                isOpen={Boolean(createTarget && createTarget.type === 'file')}
                destinationDirectory={createTarget?.destinationDirectory || ''}
                initialExtension={createTarget?.presetExtension}
                errorMessage={createErrorMessage}
                onCreate={async (fileName) => { await submitCreateTarget(fileName) }}
                onCancel={() => {
                    setCreateTarget(null)
                    setCreateErrorMessage(null)
                }}
            />
            <PromptModal
                isOpen={Boolean(createTarget && createTarget.type === 'directory')}
                title="Create New Folder"
                message={createTarget ? `Create in: ${createTarget.destinationDirectory}` : ''}
                value={createDraft}
                onChange={(value) => {
                    setCreateDraft(value)
                    if (createErrorMessage) setCreateErrorMessage(null)
                }}
                onConfirm={() => { void submitCreateTarget() }}
                onCancel={() => {
                    setCreateTarget(null)
                    setCreateDraft('')
                    setCreateErrorMessage(null)
                }}
                confirmLabel="Create Folder"
                placeholder="Enter folder name"
                errorMessage={createErrorMessage}
            />
            <PromptModal
                isOpen={Boolean(renameTarget)}
                title="Rename Item"
                message={renameTarget
                    ? renameTarget.type === 'file'
                        ? `Rename "${renameTarget.name}" (file extension is locked for safety)`
                        : `Rename "${renameTarget.name}"`
                    : ''}
                value={renameDraft}
                onChange={(value) => {
                    setRenameDraft(value)
                    if (renameErrorMessage) setRenameErrorMessage(null)
                }}
                onConfirm={() => { void submitRenameTarget() }}
                onCancel={() => {
                    setRenameTarget(null)
                    setRenameDraft('')
                    setRenameExtensionSuffix('')
                    setRenameErrorMessage(null)
                }}
                confirmLabel="Rename"
                placeholder="Enter new name"
                valueSuffix={renameTarget?.type === 'file' ? renameExtensionSuffix : ''}
                errorMessage={renameErrorMessage}
            />
            <ConfirmModal
                isOpen={Boolean(deleteTarget)}
                title="Delete Item?"
                message={deleteTarget ? `Are you sure you want to delete "${deleteTarget.name}"? This action cannot be undone.` : ''}
                confirmLabel="Delete"
                onConfirm={() => { void confirmDeleteTarget() }}
                onCancel={() => setDeleteTarget(null)}
                variant="danger"
                fullscreen
            />
        </div>
    )
}
