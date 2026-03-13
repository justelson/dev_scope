import type { DevScopeGitHubPublishContext } from '@shared/contracts/devscope-api'
import type { PullRequestChangeSource } from './settings'

type BranchLike = {
    name: string
    isRemote: boolean
    isLocal?: boolean
}

type RemoteLike = {
    name: string
    pushUrl: string
}

type CommitLike = {
    hash: string
}

export type GitPublishPlan = {
    strategy: 'blocked' | 'direct-push' | 'publish-branch'
    remoteName: string | null
    hasRemote: boolean
    currentBranchNeedsPublish: boolean
    commitCount: number
    actionLabel: string
    title: string
    description: string
    summaryLines: string[]
}

export type PullRequestExecutionPlan = {
    changeSourceLabel: string
    requiresStaging: false
    requiresCommit: false
    requiresPush: false
    missingReason: string
    summaryLines: string[]
    publishPlan: GitPublishPlan
}

export function getPreferredGitRemote<T extends RemoteLike>(remotes: T[]): T | null {
    return remotes.find((remote) => remote.name === 'origin' && String(remote.pushUrl || '').trim())
        ?? remotes.find((remote) => String(remote.pushUrl || '').trim())
        ?? null
}

function getSelectedCommitCount<T extends CommitLike>(commits: T[], selectedCommitHash?: string | null) {
    if (!selectedCommitHash) return commits.length
    const selectedIndex = commits.findIndex((commit) => commit.hash === selectedCommitHash)
    return selectedIndex >= 0 ? commits.slice(selectedIndex).length : 0
}

function getPullRequestChangeSourceSummary(changeSource: PullRequestChangeSource) {
    if (changeSource === 'unstaged') return 'Unstaged changes'
    if (changeSource === 'staged') return 'Staged changes'
    if (changeSource === 'local-commits') return 'Local commits'
    return 'All local work'
}

export function getCurrentBranchPublishState<TBranch extends BranchLike, TRemote extends RemoteLike>(args: {
    currentBranch: string
    branches: TBranch[]
    remotes: TRemote[]
}) {
    const remote = getPreferredGitRemote(args.remotes)
    const currentBranchMeta = args.branches.find((branch) => branch.name === args.currentBranch)
    const currentBranchNeedsPublish = Boolean(
        args.currentBranch
        && currentBranchMeta
        && currentBranchMeta.isLocal !== false
        && !currentBranchMeta.isRemote
    )

    return {
        remote,
        remoteName: remote?.name ?? null,
        hasRemote: Boolean(remote?.pushUrl),
        currentBranchNeedsPublish
    }
}

export function buildGitPublishPlan<TBranch extends BranchLike, TRemote extends RemoteLike, TCommit extends CommitLike>(args: {
    currentBranch: string
    branches: TBranch[]
    remotes: TRemote[]
    unpushedCommits: TCommit[]
    selectedCommitHash?: string | null
    additionalCommitsPlanned?: number
    intent?: 'push-all' | 'push-range'
    githubPublishContext?: DevScopeGitHubPublishContext | null
}): GitPublishPlan {
    const publishState = getCurrentBranchPublishState(args)
    const selectedCommitCount = getSelectedCommitCount(args.unpushedCommits, args.selectedCommitHash)
    const additionalCommitsPlanned = Math.max(0, Number(args.additionalCommitsPlanned || 0))
    const commitCount = selectedCommitCount + additionalCommitsPlanned
    const isPartialRange =
        args.intent === 'push-range'
        && selectedCommitCount > 0
        && selectedCommitCount < args.unpushedCommits.length

    if (!publishState.hasRemote) {
        return {
            strategy: 'blocked',
            remoteName: null,
            hasRemote: false,
            currentBranchNeedsPublish: false,
            commitCount: 0,
            actionLabel: 'Add Remote',
            title: 'Remote required',
            description: 'Add a remote before opening a PR draft in the browser.',
            summaryLines: ['Add a remote repository before opening a PR draft.']
        }
    }

    if (publishState.currentBranchNeedsPublish) {
        return {
            strategy: 'publish-branch',
            remoteName: publishState.remoteName,
            hasRemote: true,
            currentBranchNeedsPublish: true,
            commitCount,
            actionLabel: 'Publish Branch',
            title: 'Current branch is local only',
            description: `Push "${args.currentBranch || 'current'}" yourself before opening a PR draft.`,
            summaryLines: [
                `Current branch "${args.currentBranch || 'current'}" is local only.`,
                `Push it to ${publishState.remoteName || 'remote'} before opening the PR draft in GitHub.`
            ]
        }
    }

    if (commitCount > 0) {
        return {
            strategy: 'direct-push',
            remoteName: publishState.remoteName,
            hasRemote: true,
            currentBranchNeedsPublish: false,
            commitCount,
            actionLabel: isPartialRange ? `Review ${commitCount} Commit${commitCount === 1 ? '' : 's'}` : 'Review Local Commits',
            title: isPartialRange ? 'Selected local commit range' : 'Local commits',
            description: 'DevScope will only draft the PR. Push the branch yourself when you are ready.',
            summaryLines: [
                isPartialRange
                    ? `Selected ${commitCount} local commit${commitCount === 1 ? '' : 's'} for draft context.`
                    : `${commitCount} local commit${commitCount === 1 ? '' : 's'} are available for draft context.`,
                `DevScope will not push commits automatically.`
            ]
        }
    }

    return {
        strategy: 'direct-push',
        remoteName: publishState.remoteName,
        hasRemote: true,
        currentBranchNeedsPublish: false,
        commitCount: 0,
        actionLabel: 'Open PR Draft',
        title: 'Browser draft only',
        description: 'DevScope will open the GitHub PR page for the current branch.',
        summaryLines: ['DevScope will open the GitHub PR page in your browser.']
    }
}

export function buildPullRequestExecutionPlan<TBranch extends BranchLike, TRemote extends RemoteLike, TCommit extends CommitLike>(args: {
    changeSource: PullRequestChangeSource
    draftMode: boolean
    currentBranch: string
    branches: TBranch[]
    remotes: TRemote[]
    unstagedFiles: Array<{ path: string }>
    stagedFiles: Array<{ path: string }>
    unpushedCommits: TCommit[]
    selectedCommitHash?: string | null
    headBranch: string
    githubPublishContext?: DevScopeGitHubPublishContext | null
}): PullRequestExecutionPlan {
    const hasUnstagedChanges = args.unstagedFiles.length > 0
    const hasStagedChanges = args.stagedFiles.length > 0
    const hasLocalCommits = args.unpushedCommits.length > 0
    const changeSourceLabel = getPullRequestChangeSourceSummary(args.changeSource)
    const selectedCommitCount = getSelectedCommitCount(args.unpushedCommits, args.selectedCommitHash)

    const missingReason = args.changeSource === 'unstaged'
        ? (hasUnstagedChanges ? '' : 'Make some unstaged changes first.')
        : args.changeSource === 'staged'
            ? (hasStagedChanges ? '' : 'Stage some files first.')
            : args.changeSource === 'local-commits'
                ? (hasLocalCommits ? '' : 'Create local commits first.')
                : (hasUnstagedChanges || hasStagedChanges || hasLocalCommits ? '' : 'There is no local work ready for a PR draft yet.')

    const publishPlan = buildGitPublishPlan({
        currentBranch: args.currentBranch,
        branches: args.branches,
        remotes: args.remotes,
        unpushedCommits: args.unpushedCommits,
        selectedCommitHash: args.changeSource === 'local-commits' ? args.selectedCommitHash : undefined,
        intent: args.changeSource === 'local-commits' ? 'push-range' : 'push-all',
        githubPublishContext: args.githubPublishContext
    })

    const summaryLines = [
        args.changeSource === 'unstaged'
            ? `Use ${args.unstagedFiles.length} unstaged file${args.unstagedFiles.length === 1 ? '' : 's'} for the draft context.`
            : args.changeSource === 'staged'
                ? `Use ${args.stagedFiles.length} staged file${args.stagedFiles.length === 1 ? '' : 's'} for the draft context.`
                : args.changeSource === 'local-commits'
                    ? `Use ${selectedCommitCount || args.unpushedCommits.length} local commit${(selectedCommitCount || args.unpushedCommits.length) === 1 ? '' : 's'} for the draft context.`
                    : 'Use all local work on this branch for the draft context.',
        ...publishPlan.summaryLines,
        publishPlan.hasRemote
            ? `Open a ${args.draftMode ? 'draft ' : ''}GitHub PR in the browser for ${args.currentBranch || 'the current branch'}.`
            : 'GitHub remote required before DevScope can open the PR flow.'
    ]

    return {
        changeSourceLabel,
        requiresStaging: false,
        requiresCommit: false,
        requiresPush: false,
        missingReason,
        summaryLines,
        publishPlan
    }
}

export function describeGitPublishSuccess(plan: GitPublishPlan, options?: { commitHash?: string; currentBranch?: string }) {
    if (plan.strategy === 'publish-branch') {
        return `Published branch "${options?.currentBranch || 'current'}" to ${plan.remoteName || 'remote'}.`
    }

    if (options?.commitHash) {
        return `Pushed selected local commits to ${plan.remoteName || 'remote'}.`
    }

    return `Pushed ${plan.commitCount} local commit${plan.commitCount === 1 ? '' : 's'} to ${plan.remoteName || 'remote'}.`
}
