export type {
    GitFileStatus,
    GitStatusDetail,
    GitStatusMap,
    ProjectGitOverview,
    GitBranchSummary,
    GitRemoteSummary,
    GitTagSummary,
    CheckoutBranchOptions,
    CheckoutBranchResult,
    GitCommit,
    GitHistoryResult,
    GitignorePattern,
    GitSyncStatus
} from './git/types'

export {
    getGitStatus,
    getGitStatusDetailed,
    getGitStatusEntryStats,
    getGitHistory,
    getGitCommitStats,
    getCommitDiff,
    getWorkingDiff,
    getWorkingChangesForAI,
    hasRemoteOrigin,
    getGitSyncStatus,
    getIncomingCommits,
    getUnpushedCommits,
    getGitUser,
    getGlobalGitUser,
    getRepoOwner,
    checkIsGitRepo,
    getProjectGitOverview,
    getProjectsGitOverview
} from './git/read'

export {
    stageFiles,
    setGlobalGitUser,
    createCommit,
    pushCommits,
    initGitRepo,
    createInitialCommit,
    addRemoteOrigin,
    unstageFiles,
    discardChanges,
    fetchUpdates,
    pullUpdates,
    listBranches,
    createBranch,
    checkoutBranch,
    deleteBranch,
    listRemotes,
    setRemoteUrl,
    removeRemote,
    listTags,
    createTag,
    deleteTag,
    listStashes,
    createStash,
    applyStash,
    dropStash
} from './git/write'

export {
    getGitignoreTemplates,
    getGitignorePatterns,
    generateGitignoreContent,
    generateCustomGitignoreContent
} from './git/gitignore'
