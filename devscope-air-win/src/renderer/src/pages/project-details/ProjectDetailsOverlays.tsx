import { CommitDiffModal } from './CommitDiffModal'
import { InitGitModal } from './InitGitModal'
import { AuthorMismatchModal, DependenciesModal } from './ProjectDetailsModals'

export interface ProjectDetailsOverlaysProps {
    [key: string]: any
}

export function ProjectDetailsOverlays(props: ProjectDetailsOverlaysProps) {
    const {
        project,
        showDependenciesModal,
        setShowDependenciesModal,
        selectedCommit,
        commitDiff,
        loadingDiff,
        setSelectedCommit,
        setCommitDiff,
        showAuthorMismatch,
        gitUser,
        repoOwner,
        handleAuthorMismatchConfirm,
        setShowAuthorMismatch,
        dontShowAuthorWarning,
        setDontShowAuthorWarning,
        showInitModal,
        setShowInitModal,
        setInitStep,
        initStep,
        branchName,
        setBranchName,
        customBranchName,
        setCustomBranchName,
        createGitignore,
        setCreateGitignore,
        gitignoreTemplate,
        setGitignoreTemplate,
        availableTemplates,
        availablePatterns,
        selectedPatterns,
        setSelectedPatterns,
        patternSearch,
        setPatternSearch,
        createInitialCommit,
        setCreateInitialCommit,
        initialCommitMessage,
        setInitialCommitMessage,
        isInitializing,
        handleInitGit,
        remoteUrl,
        setRemoteUrl,
        isAddingRemote,
        handleAddRemote,
        handleSkipRemote
    } = props

    return (
        <>
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
        </>
    )
}
