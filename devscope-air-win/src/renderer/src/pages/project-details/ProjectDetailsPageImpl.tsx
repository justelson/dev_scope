import { useState, useEffect, useMemo, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useTerminal } from '@/App'
import { useFilePreview } from '@/components/ui/FilePreviewModal'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { PromptModal } from '@/components/ui/PromptModal'
import { useSettings } from '@/lib/settings'
import { trackRecentProject } from '@/lib/recentProjects'
import { openAssistantDock } from '@/lib/assistantDockStore'
import { useScriptRunModal } from './useScriptRunModal'
import { useProjectFileView } from './useProjectFileView'
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
    GitStatusDetail,
    GitStashSummary,
    GitTagSummary,
    ProjectDetails
} from './types'

type FileSystemClipboardItem = {
    path: string
    name: string
    type: 'file' | 'directory'
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

const PROJECT_ACTIVE_TAB_STORAGE_PREFIX = 'devscope:project-details:active-tab:'

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

export default function ProjectDetailsPage() {
    const { projectPath } = useParams<{ projectPath: string }>()
    const decodedPath = projectPath ? decodeURIComponent(projectPath) : ''
    const navigate = useNavigate()
    const { openTerminal } = useTerminal()
    const { settings } = useSettings()
    const [project, setProject] = useState<ProjectDetails | null>(null)
    const [fileTree, setFileTree] = useState<FileTreeNode[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [showHidden, setShowHidden] = useState(false)
    const [copiedPath, setCopiedPath] = useState(false)
    const [activeTab, setActiveTab] = useState<'readme' | 'files' | 'git'>(() => (
        readStoredProjectActiveTab(decodedPath) || 'files'
    ))
    const [showDependenciesModal, setShowDependenciesModal] = useState(false)
    const [isProjectLive, setIsProjectLive] = useState(false)
    const [activePorts, setActivePorts] = useState<number[]>([])
    const [gitHistory, setGitHistory] = useState<GitCommit[]>([])
    const [loadingGit, setLoadingGit] = useState(false)
    const [gitError, setGitError] = useState<string | null>(null)
    const [loadingFiles, setLoadingFiles] = useState(true)
    const [gitView, setGitView] = useState<'changes' | 'history' | 'unpushed' | 'manage'>('manage')
    const [commitPage, setCommitPage] = useState(1)
    const [unpushedPage, setUnpushedPage] = useState(1)
    const [changesPage, setChangesPage] = useState(1)
    const COMMITS_PER_PAGE = 15
    const ITEMS_PER_PAGE = 15
    const [selectedCommit, setSelectedCommit] = useState<GitCommit | null>(null)
    const [commitDiff, setCommitDiff] = useState<string>('')
    const [loadingDiff, setLoadingDiff] = useState(false)
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
        tone?: 'success' | 'error' | 'info'
    } | null>(null)
    const [showAuthorMismatch, setShowAuthorMismatch] = useState(false)
    const [dontShowAuthorWarning, setDontShowAuthorWarning] = useState(false)
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
    const [gitStatusDetails, setGitStatusDetails] = useState<GitStatusDetail[]>([])
    const [gitStatusMap, setGitStatusMap] = useState<Record<string, FileTreeNode['gitStatus']>>({})
    const [targetBranch, setTargetBranch] = useState('')
    const [isSwitchingBranch, setIsSwitchingBranch] = useState(false)
    const [showCustomGitignore, setShowCustomGitignore] = useState(false)
    const [availablePatterns, setAvailablePatterns] = useState<any[]>([])
    const [selectedPatterns, setSelectedPatterns] = useState<Set<string>>(new Set())
    const [patternSearch, setPatternSearch] = useState('')
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
    const [sortBy, setSortBy] = useState<'name' | 'size' | 'type'>('name')
    const [sortAsc, setSortAsc] = useState(true)
    const [fileSearch, setFileSearch] = useState('')
    const [fileClipboardItem, setFileClipboardItem] = useState<FileSystemClipboardItem | null>(null)
    const [renameTarget, setRenameTarget] = useState<FileTreeNode | null>(null)
    const [renameDraft, setRenameDraft] = useState('')
    const [renameExtensionSuffix, setRenameExtensionSuffix] = useState('')
    const [renameErrorMessage, setRenameErrorMessage] = useState<string | null>(null)
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
        setActiveTab(storedTab || 'files')
    }, [decodedPath])
    useEffect(() => {
        if (!decodedPath) return
        writeStoredProjectActiveTab(decodedPath, activeTab)
    }, [decodedPath, activeTab])
    const goBack = () => {
        const parentPath = getParentFolderPath(project?.path || decodedPath)
        if (parentPath) {
            navigate(`/folder-browse/${encodeURIComponent(parentPath)}`)
            return
        }
        navigate('/projects')
    }
    const handleShipToAssistant = async () => {
        const projectScopePath = String(project?.path || decodedPath || '').trim()
        if (!projectScopePath) return

        openAssistantDock({ contextPath: projectScopePath })
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
        project,
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
    })
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

    const handleFileTreeOpen = async (node: FileTreeNode) => {
        if (node.type === 'directory') {
            setExpandedFolders((prev) => {
                const next = new Set(prev)
                next.add(node.path)
                return next
            })
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
        await loadProjectDetails()
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
        await loadProjectDetails()
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
        await loadProjectDetails()
    }

    const {
        handleCommitClick,
        handleCommit,
        handleGenerateCommitMessage,
        handlePush,
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
        dontShowAuthorWarning,
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
    return (
        <div className="max-w-[1600px] mx-auto animate-fadeIn pb-24 px-6 pt-6">
            <ProjectDetailsOverlays
                project={project}
                showDependenciesModal={showDependenciesModal}
                setShowDependenciesModal={setShowDependenciesModal}
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
                dontShowAuthorWarning={dontShowAuthorWarning}
                setDontShowAuthorWarning={setDontShowAuthorWarning}
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
                themeColor={themeColor}
                project={project}
                isProjectLive={isProjectLive}
                activePorts={activePorts}
                formatRelTime={formatRelTime}
                onOpenTerminal={() => openTerminal({ displayName: project.name, id: 'main', category: 'project' }, project.path)}
                handleCopyPath={handleCopyPath}
                copiedPath={copiedPath}
                handleOpenInExplorer={handleOpenInExplorer}
                goBack={goBack}
                activeTab={activeTab}
                setActiveTab={setActiveTab}
                fileTree={fileTree}
                loadingGit={loadingGit}
                loadingFiles={loadingFiles}
                changedFiles={changedFiles}
                stagedFiles={stagedFiles}
                unstagedFiles={unstagedFiles}
                unpushedCommits={unpushedCommits}
                onBrowseFolder={() => {
                    const encodedPath = encodeURIComponent(project.path)
                    navigate(`/folder-browse/${encodedPath}`)
                }}
                onShipToAssistant={() => void handleShipToAssistant()}
                loadProjectDetails={loadProjectDetails}
                refreshFileTree={refreshFileTree}
                readmeContentRef={readmeContentRef}
                readmeExpanded={readmeExpanded}
                readmeNeedsExpand={readmeNeedsExpand}
                setReadmeExpanded={setReadmeExpanded}
                fileSearch={fileSearch}
                setFileSearch={setFileSearch}
                setIsExpandingFolders={setIsExpandingFolders}
                expandedFolders={expandedFolders}
                setExpandedFolders={setExpandedFolders}
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
                onFileTreeOpenWith={handleFileTreeOpenWith}
                onFileTreeOpenInExplorer={handleFileTreeOpenInExplorer}
                onFileTreeCopyPath={handleFileTreeCopyPath}
                onFileTreeCopy={handleFileTreeCopy}
                onFileTreeRename={handleFileTreeRename}
                onFileTreeDelete={handleFileTreeDelete}
                onFileTreePaste={handleFileTreePaste}
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
                hasRemote={hasRemote}
                setInitStep={setInitStep}
                handlePush={handlePush}
                isPushing={isPushing}
                gitHistory={gitHistory}
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
                onPreviewSaved={async () => {
                    await Promise.all([refreshFileTree(), refreshGitData()])
                }}
                closePreview={closePreview}
                toast={toast}
                navigate={navigate}
                setToast={setToast}
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
