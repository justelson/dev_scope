import { buildFallbackPullRequestDraft } from '@/lib/pullRequestWorkflow'
import type {
    PullRequestChangeSource
} from '@/lib/settings'
import { buildPushRangeSummary } from '../PushRangeConfirmModal'
import type { GitCommit } from '../types'

export const GUIDE_SOURCE_OPTIONS = [
    { value: 'project', label: 'Project guide' },
    { value: 'global', label: 'Global guide' },
    { value: 'repo-template', label: 'Repo template' },
    { value: 'none', label: 'None' }
] as const

export const SCOPE_OPTIONS = [
    { value: 'all-local-work', label: 'All local work' },
    { value: 'unstaged', label: 'Unstaged changes' },
    { value: 'staged', label: 'Staged changes' },
    { value: 'local-commits', label: 'Local commits' }
] as const

export function getPathTail(filePath: string): string {
    const normalized = String(filePath || '').trim().replace(/[\\/]+$/, '')
    if (!normalized) return ''
    const parts = normalized.split(/[/\\]/)
    return parts[parts.length - 1] || normalized
}

async function readCommitDiffs(projectPath: string, commits: GitCommit[]) {
    const orderedCommits = [...commits].reverse()
    const results = await Promise.all(orderedCommits.map((commit) => window.devscope.getCommitDiff(projectPath, commit.hash)))

    return orderedCommits.map((commit, index) => {
        const result = results[index]
        if (!result?.success) {
            return `Commit ${commit.shortHash} ${commit.message}\n(diff unavailable: ${result?.error || 'request failed'})`
        }

        const diff = String(result.diff || '').trim()
        return `Commit ${commit.shortHash} ${commit.message}\n${diff || '(empty diff)'}`
    }).join('\n\n')
}

export async function buildDiffContext(args: {
    projectName: string
    currentBranch: string
    targetBranch: string
    scopeLabel: string
    projectPath: string
    changeSource: PullRequestChangeSource
    unstagedFiles: Array<{ path: string; name?: string }>
    stagedFiles: Array<{ path: string; name?: string }>
    unpushedCommits: GitCommit[]
    selectedCommitHash: string | null
    guideText: string
}) {
    const sections: string[] = []
    const commitMessages: string[] = []

    if (args.changeSource === 'local-commits') {
        if (!args.selectedCommitHash) {
            throw new Error('Choose the push boundary commit first.')
        }

        const summary = buildPushRangeSummary(args.unpushedCommits, args.selectedCommitHash)
        if (!summary || summary.commitsToPush.length === 0) {
            throw new Error('No commits were selected for this PR.')
        }

        commitMessages.push(...summary.commitsToPush.map((commit) => commit.message))
        sections.push(`## Selected commits\n${await readCommitDiffs(args.projectPath, summary.commitsToPush)}`)
    } else {
        if (args.changeSource === 'all-local-work' && args.unpushedCommits.length > 0) {
            commitMessages.push(...args.unpushedCommits.map((commit) => commit.message))
            sections.push(`## Unpushed commits\n${await readCommitDiffs(args.projectPath, args.unpushedCommits)}`)
        }

        if (args.changeSource === 'unstaged' || args.changeSource === 'all-local-work') {
            const unstagedDiffResult = await window.devscope.getWorkingDiff(args.projectPath, undefined, 'unstaged')
            if (!unstagedDiffResult?.success) {
                throw new Error(unstagedDiffResult?.error || 'Failed to read unstaged diff.')
            }

            const unstagedDiff = String(unstagedDiffResult.diff || '').trim()
            if (unstagedDiff && unstagedDiff !== 'No changes') {
                sections.push(`## Unstaged changes\n${unstagedDiff}`)
            }
        }

        if (args.changeSource === 'staged' || args.changeSource === 'all-local-work') {
            const stagedDiffResult = await window.devscope.getWorkingDiff(args.projectPath, undefined, 'staged')
            if (!stagedDiffResult?.success) {
                throw new Error(stagedDiffResult?.error || 'Failed to read staged diff.')
            }

            const stagedDiff = String(stagedDiffResult.diff || '').trim()
            if (stagedDiff && stagedDiff !== 'No changes') {
                sections.push(`## Staged changes\n${stagedDiff}`)
            }
        }
    }

    const diff = sections.join('\n\n').trim()
    if (!diff) {
        throw new Error('No diff context is available for the selected PR scope yet.')
    }

    return {
        diff,
        commitMessages,
        fallbackDraft: buildFallbackPullRequestDraft({
            projectName: args.projectName,
            currentBranch: args.currentBranch,
            targetBranch: args.targetBranch,
            scopeLabel: args.scopeLabel,
            guideText: args.guideText,
            commitMessages
        })
    }
}
