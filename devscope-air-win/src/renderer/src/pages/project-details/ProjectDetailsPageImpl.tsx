import { useState, useEffect, useMemo, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useTerminal } from '@/App'
import { useFilePreview } from '@/components/ui/FilePreviewModal'
import { useSettings } from '@/lib/settings'
import { trackRecentProject } from '@/lib/recentProjects'
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
    GitStashSummary,
    GitTagSummary,
    ProjectDetails
} from './types'
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

export default function ProjectDetailsPage() {
    const { projectPath } = useParams<{ projectPath: string }>()
    const navigate = useNavigate()
    const { openTerminal } = useTerminal()
    const { settings } = useSettings()
    const [project, setProject] = useState<ProjectDetails | null>(null)
    const [fileTree, setFileTree] = useState<FileTreeNode[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [showHidden, setShowHidden] = useState(false)
    const [copiedPath, setCopiedPath] = useState(false)
    const [activeTab, setActiveTab] = useState<'readme' | 'files' | 'git'>('files')
    const [showDependenciesModal, setShowDependenciesModal] = useState(false)
    const [isProjectLive, setIsProjectLive] = useState(false)
    const [activePorts, setActivePorts] = useState<number[]>([])
    const [gitHistory, setGitHistory] = useState<GitCommit[]>([])
    const [loadingGit, setLoadingGit] = useState(false)
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
    const decodedPath = projectPath ? decodeURIComponent(projectPath) : ''
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
    const goBack = () => {
        const parentPath = getParentFolderPath(project?.path || decodedPath)
        if (parentPath) {
            navigate(`/folder-browse/${encodeURIComponent(parentPath)}`)
            return
        }
        navigate('/projects')
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
    const {
        loadProjectDetails,
        refreshGitData
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
    const {
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
    } = createProjectGitActions({
        decodedPath,
        commitMessage,
        changedFiles,
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
        setError,
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
        setIsAddingRemote
    })
    const formatRelTime = (ts?: number) => {
        if (!ts) return ''
        const days = Math.floor((Date.now() - ts) / 86400000)
        return days === 0 ? 'Today' : days === 1 ? 'Yesterday' : `${days} days ago`
    }
    if (loading) {
        return <ProjectDetailsLoadingView />
    }
    if (error || !project) {
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
                unpushedCommits={unpushedCommits}
                onBrowseFolder={() => {
                    const encodedPath = encodeURIComponent(project.path)
                    navigate(`/folder-browse/${encodedPath}`)
                }}
                loadProjectDetails={loadProjectDetails}
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
                gitUser={gitUser}
                repoOwner={repoOwner}
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
                closePreview={closePreview}
                toast={toast}
                navigate={navigate}
                setToast={setToast}
            />
        </div>
    )
}
