export type GitFileStatus = 'modified' | 'untracked' | 'added' | 'deleted' | 'renamed' | 'ignored' | 'unknown'

export interface GitStatusMap {
    [relativePath: string]: GitFileStatus
}

export interface ProjectGitOverview {
    path: string
    isGitRepo: boolean
    changedCount: number
    unpushedCount: number
    hasRemote: boolean
    error?: string
}

export interface GitBranchSummary {
    name: string
    current: boolean
    commit: string
    label: string
    isRemote: boolean
}

export interface GitRemoteSummary {
    name: string
    fetchUrl: string
    pushUrl: string
}

export interface GitTagSummary {
    name: string
    commit?: string
}

export interface CheckoutBranchOptions {
    autoStash?: boolean
    autoCleanupLock?: boolean
}

export interface CheckoutBranchResult {
    stashed: boolean
    cleanedLock?: boolean
    stashRef?: string
    stashMessage?: string
}

export interface GitCommit {
    hash: string
    shortHash: string
    parents: string[]
    author: string
    date: string
    message: string
}

export interface GitHistoryResult {
    commits: GitCommit[]
}

export interface GitignorePattern {
    id: string
    label: string
    description: string
    category: 'dependencies' | 'build' | 'environment' | 'ide' | 'os' | 'logs' | 'cache' | 'testing'
    patterns: string[]
}

export interface RepoContext {
    repoRoot: string
    projectRelativeToRepo: string
}

export interface CompactPatchResult {
    text: string
    omittedFiles: string[]
    totalFiles: number
    includedFiles: number
    wasTruncated: boolean
}
