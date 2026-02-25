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
    GitignorePattern
} from './git/types'

export {
    getGitStatus,
    getGitStatusDetailed,
    getGitHistory,
    getCommitDiff,
    getWorkingDiff,
    getWorkingChangesForAI,
    hasRemoteOrigin,
    getUnpushedCommits,
    getGitUser,
    getRepoOwner,
    checkIsGitRepo,
    getProjectGitOverview,
    getProjectsGitOverview
} from './git/read'

export {
    stageFiles,
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
