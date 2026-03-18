export type DevScopeGitFileStatus = 'modified' | 'untracked' | 'added' | 'deleted' | 'renamed' | 'ignored' | 'unknown'

export type DevScopeGitStatusDetail = {
    path: string
    previousPath?: string
    status: DevScopeGitFileStatus
    code: string
    staged: boolean
    unstaged: boolean
    additions: number
    deletions: number
    stagedAdditions: number
    stagedDeletions: number
    unstagedAdditions: number
    unstagedDeletions: number
    statsLoaded?: boolean
}

export type DevScopeGitStatusEntryStats = {
    path: string
    additions: number
    deletions: number
    stagedAdditions: number
    stagedDeletions: number
    unstagedAdditions: number
    unstagedDeletions: number
    statsLoaded: boolean
}

export type DevScopePullRequestDraft = {
    title: string
    body: string
}

export type DevScopePullRequestDraftInput = {
    projectName?: string
    currentBranch: string
    targetBranch: string
    scopeLabel: string
    diff: string
    guideText?: string
}

export type DevScopeGitCommit = {
    hash: string
    shortHash: string
    parents: string[]
    author: string
    date: string
    message: string
    additions: number
    deletions: number
    filesChanged: number
    statsLoaded?: boolean
}

export type DevScopeGitHistoryCount = {
    totalCount: number
}

export type DevScopeGitBranchSummary = {
    name: string
    current: boolean
    commit: string
    label: string
    isRemote: boolean
    isLocal?: boolean
}

export type DevScopeGitRemoteSummary = {
    name: string
    fetchUrl: string
    pushUrl: string
}

export type DevScopeGitHubRepository = {
    owner: string
    repo: string
    fullName: string
    htmlUrl: string
    cloneUrl: string
    sshUrl: string
    defaultBranch?: string
    private: boolean
    isFork: boolean
    parentFullName?: string | null
    permissions?: {
        admin: boolean
        maintain: boolean
        push: boolean
        triage: boolean
        pull: boolean
    }
}

export type DevScopeGitHubPublishContext = {
    isGitHubRemote: boolean
    remoteName?: string | null
    upstream?: DevScopeGitHubRepository | null
    canOpenPullRequest: boolean
    summaryLines: string[]
}

export type DevScopeGitSyncStatus = {
    currentBranch: string
    upstreamBranch: string | null
    headHash: string | null
    upstreamHeadHash: string | null
    hasRemote: boolean
    ahead: number
    behind: number
    workingTreeChanged: boolean
    workingTreeChangeCount: number
    statusToken: string
    detached: boolean
}

export type DevScopeGitTagSummary = {
    name: string
    commit?: string
}

export type DevScopeGitStashSummary = {
    hash: string
    message: string
}

export type DevScopeProjectGitOverviewItem = {
    path: string
    isGitRepo: boolean
    changedCount: number
    unpushedCount: number
    hasRemote: boolean
    error?: string
}
