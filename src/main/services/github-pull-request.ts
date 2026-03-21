import { execFile as execFileCallback } from 'child_process'
import log from 'electron-log'
import { randomUUID } from 'node:crypto'
import { unlink, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { promisify } from 'util'
import { generateGitPullRequestDraftWithProvider } from '../ai/git-text'
import { createGit, getRepoContext } from '../inspectors/git/core'
import { getAugmentedEnv } from '../inspectors/safe-exec'
import { pushCommits } from '../inspectors/git/write'
import { getGitHubPublishContext } from './github-publish'
import {
    parseGitHubRemoteRef,
    parseGitHubRepositoryNameWithOwnerFromRemoteUrl,
    parseGitHubRepositoryOwnerLogin
} from './github-remote'
import type {
    DevScopePullRequestSummary,
    DevScopeCreatePullRequestInput,
    DevScopePullRequestDraftSource,
    DevScopePullRequestProvider
} from '../../shared/contracts/devscope-git-contracts'

const execFileAsync = promisify(execFileCallback)
const GH_TIMEOUT_MS = 30_000
const GITHUB_PULL_REQUEST_JSON_FIELDS = 'number,title,url,baseRefName,headRefName,state,mergedAt,updatedAt,isCrossRepository,headRepository,headRepositoryOwner'

type PullRequestState = 'open' | 'closed' | 'merged'

type PullRequestInfo = DevScopePullRequestSummary & {
    updatedAt: string | null
    isCrossRepository?: boolean
    headRepositoryNameWithOwner?: string | null
    headRepositoryOwnerLogin?: string | null
}

type BranchState = {
    cwd: string
    branch: string | null
    detached: boolean
    hasWorkingTreeChanges: boolean
    upstreamRef: string | null
    ahead: number
    behind: number
    remotes: Array<{ name: string; fetchUrl: string; pushUrl: string }>
}

type BranchHeadContext = {
    headBranch: string
    headSelectors: string[]
    preferredHeadSelector: string
    remoteName: string | null
    headRepositoryNameWithOwner: string | null
    headRepositoryOwnerLogin: string | null
    isCrossRepository: boolean
}

type EnsuredDraft = {
    title: string
    body: string
    source: DevScopePullRequestDraftSource
    provider?: DevScopePullRequestProvider
}

function toServiceError(err: unknown, fallback: string): Error {
    if (err instanceof Error && err.message) return err
    return new Error(fallback)
}

async function runGh(cwd: string, args: string[]) {
    try {
        const result = await execFileAsync('gh', args, {
            cwd,
            timeout: GH_TIMEOUT_MS,
            windowsHide: true,
            maxBuffer: 1024 * 1024,
            env: getAugmentedEnv()
        })
        return {
            stdout: String(result.stdout || ''),
            stderr: String(result.stderr || '')
        }
    } catch (error: any) {
        const message = String(error?.stderr || error?.stdout || error?.message || '').trim()
        const lower = message.toLowerCase()

        if (error?.code === 'ENOENT') {
            throw new Error('GitHub CLI (`gh`) is required but was not found on PATH.')
        }
        if (
            lower.includes('not logged in')
            || lower.includes('gh auth login')
            || lower.includes('authentication failed')
            || lower.includes('no oauth token')
        ) {
            throw new Error('GitHub CLI is not authenticated. Run `gh auth login` and retry.')
        }
        if (
            lower.includes('could not resolve to a pullrequest')
            || lower.includes('pull request not found')
            || lower.includes('no pull requests found for branch')
        ) {
            throw new Error('Pull request not found for the current branch.')
        }

        throw new Error(message || 'GitHub CLI command failed.')
    }
}

function normalizePullRequestState(input: { state?: string | null; mergedAt?: string | null }): PullRequestState {
    if ((input.mergedAt || '').trim()) return 'merged'
    if (input.state === 'CLOSED' || input.state === 'closed') return 'closed'
    return 'open'
}

function toPullRequestSummary(entry: any): PullRequestInfo | null {
    if (!entry || typeof entry !== 'object') return null
    const number = Number(entry.number)
    const title = String(entry.title || '').trim()
    const url = String(entry.url || '').trim()
    const baseBranch = String(entry.baseRefName || '').trim()
    const headBranch = String(entry.headRefName || '').trim()
    if (!Number.isInteger(number) || number <= 0 || !title || !url || !baseBranch || !headBranch) {
        return null
    }

    const headRepositoryNameWithOwner = typeof entry.headRepository?.nameWithOwner === 'string'
        ? String(entry.headRepository.nameWithOwner).trim()
        : null
    const headRepositoryOwnerLogin = typeof entry.headRepositoryOwner?.login === 'string'
        ? String(entry.headRepositoryOwner.login).trim()
        : parseGitHubRepositoryOwnerLogin(headRepositoryNameWithOwner)

    return {
        number,
        title,
        url,
        baseBranch,
        headBranch,
        state: normalizePullRequestState({ state: entry.state, mergedAt: entry.mergedAt }),
        updatedAt: typeof entry.updatedAt === 'string' && entry.updatedAt.trim() ? entry.updatedAt.trim() : null,
        ...(typeof entry.isCrossRepository === 'boolean' ? { isCrossRepository: entry.isCrossRepository } : {}),
        ...(headRepositoryNameWithOwner ? { headRepositoryNameWithOwner } : {}),
        ...(headRepositoryOwnerLogin ? { headRepositoryOwnerLogin } : {})
    }
}

function parsePullRequestList(raw: string): PullRequestInfo[] {
    if (!raw.trim()) return []
    try {
        const parsed = JSON.parse(raw)
        if (!Array.isArray(parsed)) return []
        return parsed
            .map((entry) => toPullRequestSummary(entry))
            .filter((entry): entry is PullRequestInfo => Boolean(entry))
    } catch {
        return []
    }
}

function appendUnique(values: string[], next: string | null | undefined) {
    const normalized = String(next || '').trim()
    if (!normalized || values.includes(normalized)) return
    values.push(normalized)
}

function parseUpstreamRef(upstreamRef: string | null | undefined): { remoteName: string; branchName: string } | null {
    const normalized = String(upstreamRef || '').trim()
    if (!normalized || !normalized.includes('/')) return null

    if (normalized.startsWith('refs/remotes/')) {
        const remainder = normalized.slice('refs/remotes/'.length)
        const slashIndex = remainder.indexOf('/')
        if (slashIndex < 0) return null
        const remoteName = remainder.slice(0, slashIndex).trim()
        const branchName = remainder.slice(slashIndex + 1).trim()
        return remoteName && branchName ? { remoteName, branchName } : null
    }

    const [remoteName, ...branchParts] = normalized.split('/')
    const branchName = branchParts.join('/').trim()
    return remoteName && branchName ? { remoteName, branchName } : null
}

async function resolveRepoCwd(projectPath: string) {
    const git = createGit(projectPath)
    const repoContext = await getRepoContext(git, projectPath)
    return repoContext.repoRoot
}

export async function ensurePullRequestPrerequisites(projectPath: string): Promise<void> {
    const cwd = await resolveRepoCwd(projectPath)
    await runGh(cwd, ['--version'])
    await runGh(cwd, ['auth', 'status'])
}

async function readBranchState(projectPath: string): Promise<BranchState> {
    const cwd = await resolveRepoCwd(projectPath)
    const git = createGit(cwd)
    const [branchRaw, workingTreeRaw, upstreamRefRaw, aheadBehindRaw, remotes] = await Promise.all([
        git.raw(['rev-parse', '--abbrev-ref', 'HEAD']).catch(() => 'HEAD'),
        git.raw(['status', '--porcelain=v1']).catch(() => ''),
        git.raw(['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}']).catch(() => ''),
        git.raw(['rev-list', '--left-right', '--count', 'HEAD...@{u}']).catch(() => ''),
        git.getRemotes(true).catch(() => [])
    ])

    const branch = String(branchRaw || '').trim() || null
    const upstreamRef = String(upstreamRefRaw || '').trim() || null
    const workingTreeLines = String(workingTreeRaw || '')
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)
    const [aheadText, behindText] = String(aheadBehindRaw || '').trim().split(/\s+/)

    return {
        cwd,
        branch,
        detached: branch === 'HEAD' || !branch,
        hasWorkingTreeChanges: workingTreeLines.length > 0,
        upstreamRef,
        ahead: Number.isNaN(Number.parseInt(aheadText || '0', 10)) ? 0 : Number.parseInt(aheadText || '0', 10),
        behind: Number.isNaN(Number.parseInt(behindText || '0', 10)) ? 0 : Number.parseInt(behindText || '0', 10),
        remotes: remotes.map((remote) => ({
            name: remote.name,
            fetchUrl: String(remote.refs?.fetch || '').trim(),
            pushUrl: String(remote.refs?.push || '').trim()
        }))
    }
}

function getPreferredGitHubRemote(remotes: Array<{ name: string; fetchUrl: string; pushUrl: string }>) {
    return remotes.find((remote) => remote.name === 'origin' && parseGitHubRemoteRef(remote.pushUrl || remote.fetchUrl))
        ?? remotes.find((remote) => parseGitHubRemoteRef(remote.pushUrl || remote.fetchUrl))
        ?? null
}

async function resolveBranchHeadContext(projectPath: string, branchState: BranchState): Promise<BranchHeadContext> {
    const branch = String(branchState.branch || '').trim()
    if (!branch || branchState.detached) {
        throw new Error('Cannot resolve a pull request branch from detached HEAD.')
    }

    const upstream = parseUpstreamRef(branchState.upstreamRef)
    const trackedRemoteName = upstream?.remoteName ?? null
    const trackedRemoteBranch = upstream?.branchName || branch
    const trackedRemote = trackedRemoteName
        ? branchState.remotes.find((remote) => remote.name === trackedRemoteName) || null
        : null
    const trackedRepositoryNameWithOwner = parseGitHubRepositoryNameWithOwnerFromRemoteUrl(trackedRemote?.pushUrl || trackedRemote?.fetchUrl)
    const trackedOwnerLogin = parseGitHubRepositoryOwnerLogin(trackedRepositoryNameWithOwner)

    const publishContext = await getGitHubPublishContext(projectPath).catch(() => null)
    const upstreamFullName = publishContext?.upstream?.fullName || null
    const isCrossRepository = Boolean(
        trackedRepositoryNameWithOwner
        && upstreamFullName
        && trackedRepositoryNameWithOwner !== upstreamFullName
    )

    const headSelectors: string[] = []
    const ownerQualifiedSelector = isCrossRepository && trackedOwnerLogin
        ? `${trackedOwnerLogin}:${trackedRemoteBranch}`
        : trackedRemoteBranch
    appendUnique(headSelectors, ownerQualifiedSelector)
    appendUnique(headSelectors, trackedRemoteName ? `${trackedRemoteName}:${trackedRemoteBranch}` : null)
    appendUnique(headSelectors, branch)
    appendUnique(headSelectors, trackedRemoteBranch !== branch ? trackedRemoteBranch : null)

    return {
        headBranch: trackedRemoteBranch,
        headSelectors,
        preferredHeadSelector: ownerQualifiedSelector,
        remoteName: trackedRemoteName,
        headRepositoryNameWithOwner: trackedRepositoryNameWithOwner,
        headRepositoryOwnerLogin: trackedOwnerLogin,
        isCrossRepository
    }
}

async function listPullRequests(cwd: string, headSelector: string, state: 'open' | 'all') {
    const result = await runGh(cwd, [
        'pr',
        'list',
        '--head',
        headSelector,
        '--state',
        state,
        '--limit',
        '20',
        '--json',
        GITHUB_PULL_REQUEST_JSON_FIELDS
    ])
    return parsePullRequestList(result.stdout)
}

async function findOpenPullRequest(cwd: string, headSelectors: string[]) {
    for (const headSelector of headSelectors) {
        const matches = await listPullRequests(cwd, headSelector, 'open').catch(() => [])
        if (matches[0]) {
            return matches[0]
        }
    }
    return null
}

async function findLatestPullRequest(cwd: string, headSelectors: string[]) {
    const byNumber = new Map<number, PullRequestInfo>()
    for (const headSelector of headSelectors) {
        const matches = await listPullRequests(cwd, headSelector, 'all').catch(() => [])
        for (const match of matches) {
            byNumber.set(match.number, match)
        }
    }

    const parsed = Array.from(byNumber.values()).sort((left, right) => {
        const leftTime = left.updatedAt ? Date.parse(left.updatedAt) : 0
        const rightTime = right.updatedAt ? Date.parse(right.updatedAt) : 0
        return rightTime - leftTime
    })
    return parsed.find((entry) => entry.state === 'open') || parsed[0] || null
}

async function resolveDefaultBranch(cwd: string) {
    const result = await runGh(cwd, ['repo', 'view', '--json', 'defaultBranchRef', '--jq', '.defaultBranchRef.name'])
    const branch = String(result.stdout || '').trim()
    return branch || 'main'
}

async function resolveBaseBranch(cwd: string, branch: string, upstreamRef: string | null, isCrossRepository: boolean, preferredBaseBranch?: string | null) {
    const normalizedPreferred = String(preferredBaseBranch || '').trim()
    if (normalizedPreferred) {
        return normalizedPreferred
    }

    const git = createGit(cwd)
    const configured = String(await git.raw(['config', '--get', `branch.${branch}.gh-merge-base`]).catch(() => '')).trim()
    if (configured) return configured

    const upstream = parseUpstreamRef(upstreamRef)
    if (upstream && !isCrossRepository && upstream.branchName && upstream.branchName !== branch) {
        return upstream.branchName
    }

    return await resolveDefaultBranch(cwd).catch(() => 'main')
}

async function ensureNoWorkingTreeChanges(branchState: BranchState) {
    if (branchState.detached) {
        throw new Error('Detached HEAD: checkout a branch before creating a PR.')
    }
    if (branchState.hasWorkingTreeChanges) {
        throw new Error('Commit local changes before creating a PR.')
    }
    if (branchState.behind > 0 && branchState.ahead > 0) {
        throw new Error('Branch has diverged from upstream. Rebase or merge before creating a PR.')
    }
    if (branchState.behind > 0) {
        throw new Error('Branch is behind upstream. Pull or rebase before creating a PR.')
    }
}

async function pushCurrentBranchIfNeeded(projectPath: string, branchState: BranchState) {
    const preferredRemote = getPreferredGitHubRemote(branchState.remotes)
    if (!preferredRemote) {
        throw new Error('Add a GitHub remote before creating a PR.')
    }

    const branch = String(branchState.branch || '').trim()
    if (!branch) {
        throw new Error('Detached HEAD: checkout a branch before creating a PR.')
    }

    if (!branchState.upstreamRef || branchState.ahead > 0) {
        const upstream = parseUpstreamRef(branchState.upstreamRef)
        await pushCommits(branchState.cwd, {
            remoteName: upstream?.remoteName || preferredRemote.name,
            branchName: branch
        })
    }
}

async function buildRangeContext(cwd: string, baseBranch: string) {
    const git = createGit(cwd)
    const [commitSummaryRaw, diffSummaryRaw, diffPatchRaw, commitCountRaw] = await Promise.all([
        git.raw(['log', '--reverse', '--format=- %s', `${baseBranch}..HEAD`]).catch(() => ''),
        git.raw(['diff', '--stat', `${baseBranch}...HEAD`]).catch(() => ''),
        git.raw(['diff', '--unified=3', `${baseBranch}...HEAD`]).catch(() => ''),
        git.raw(['rev-list', '--count', `${baseBranch}..HEAD`]).catch(() => '0')
    ])

    const commitCount = Number.parseInt(String(commitCountRaw || '0').trim(), 10)
    if (!Number.isFinite(commitCount) || commitCount <= 0) {
        throw new Error('No local branch commits are available to include in a pull request.')
    }

    return {
        diff: [
            '## Commits',
            String(commitSummaryRaw || '').trim() || '(no commit summary available)',
            '',
            '## Diff Summary',
            String(diffSummaryRaw || '').trim() || '(no diff summary available)',
            '',
            '## Diff Patch',
            String(diffPatchRaw || '').trim() || '(no diff patch available)'
        ].join('\n'),
        commitMessages: String(commitSummaryRaw || '')
            .split(/\r?\n/)
            .map((line) => line.replace(/^-\s*/, '').trim())
            .filter(Boolean)
    }
}

function buildFallbackPullRequestDraft(input: {
    projectName: string
    currentBranch: string
    targetBranch: string
    guideText?: string
    commitMessages?: string[]
}) {
    const normalizedProjectName = String(input.projectName || 'project').trim() || 'project'
    const normalizedCurrentBranch = String(input.currentBranch || '').trim()
    const normalizedTargetBranch = String(input.targetBranch || '').trim() || 'main'
    const title = normalizedCurrentBranch
        ? `Update ${normalizedProjectName} (${normalizedCurrentBranch} -> ${normalizedTargetBranch})`
        : `Update ${normalizedProjectName}`
    const uniqueMessages = Array.from(new Set((input.commitMessages || []).map((message) => String(message || '').trim()).filter(Boolean))).slice(0, 6)
    const guideNote = String(input.guideText || '').trim()

    const bodyLines = [
        '## Summary',
        `- Prepare a pull request for ${normalizedProjectName}.`,
        `- Source branch: \`${normalizedCurrentBranch || 'current'}\` into \`${normalizedTargetBranch}\`.`,
        '',
        '## Changes',
        ...(uniqueMessages.length > 0
            ? uniqueMessages.map((message) => `- ${message}`)
            : ['- Review the branch diff and expand this summary before publishing.']),
        '',
        '## Testing',
        '- Not yet validated.',
        '',
        '## Risks',
        '- Review the generated title/body and confirm the target branch before publishing.'
    ]

    if (guideNote) {
        bodyLines.push('', '## Guide Notes', guideNote)
    }

    return {
        title,
        body: bodyLines.join('\n')
    }
}

async function ensureDraft(cwd: string, branch: string, baseBranch: string, input: DevScopeCreatePullRequestInput): Promise<EnsuredDraft> {
    const providedTitle = String(input.title || '').trim()
    const providedBody = String(input.body || '').trim()
    if (providedTitle && providedBody) {
        return {
            title: providedTitle,
            body: providedBody,
            source: 'provided'
        }
    }

    const rangeContext = await buildRangeContext(cwd, baseBranch)
    const fallbackDraft = buildFallbackPullRequestDraft({
        projectName: input.projectName || 'Project',
        currentBranch: branch,
        targetBranch: baseBranch,
        guideText: input.guideText,
        commitMessages: rangeContext.commitMessages
    })
    const provider = input.provider
        ? {
            provider: input.provider,
            ...(input.apiKey?.trim() ? { apiKey: input.apiKey.trim() } : {}),
            ...(input.model?.trim() ? { model: input.model.trim() } : {})
        }
        : null

    if (!provider) {
        return {
            ...fallbackDraft,
            source: 'fallback'
        }
    }

    const generateResult = await generateGitPullRequestDraftWithProvider({
        ...provider,
        draftInput: {
            projectName: input.projectName,
            currentBranch: branch,
            targetBranch: baseBranch,
            scopeLabel: 'Current branch changes',
            diff: rangeContext.diff,
            guideText: input.guideText
        }
    })

    if (!generateResult.success || !String(generateResult.title || '').trim() || !String(generateResult.body || '').trim()) {
        return {
            ...fallbackDraft,
            source: 'fallback',
            provider: provider.provider
        }
    }

    return {
        title: String(generateResult.title || '').trim(),
        body: String(generateResult.body || '').trim(),
        source: 'ai',
        provider: provider.provider
    }
}

async function createPullRequest(cwd: string, input: {
    baseBranch: string
    headSelector: string
    title: string
    body: string
    draft: boolean
}) {
    const bodyFile = join(tmpdir(), `devscope-pr-body-${process.pid}-${randomUUID()}.md`)
    await writeFile(bodyFile, input.body, 'utf8')
    try {
        const result = await runGh(cwd, [
            'pr',
            'create',
            '--base',
            input.baseBranch,
            '--head',
            input.headSelector,
            '--title',
            input.title,
            '--body-file',
            bodyFile,
            ...(input.draft ? ['--draft'] : [])
        ])
        return result.stdout.trim()
    } finally {
        await unlink(bodyFile).catch(() => undefined)
    }
}

export async function getCurrentBranchPullRequest(projectPath: string): Promise<DevScopePullRequestSummary | null> {
    const branchState = await readBranchState(projectPath)
    if (branchState.detached || !branchState.branch) {
        return null
    }

    const preferredRemote = getPreferredGitHubRemote(branchState.remotes)
    if (!preferredRemote) {
        return null
    }

    const headContext = await resolveBranchHeadContext(projectPath, branchState)
    const latest = await findLatestPullRequest(branchState.cwd, headContext.headSelectors)
    if (!latest) return null

    return {
        number: latest.number,
        title: latest.title,
        url: latest.url,
        baseBranch: latest.baseBranch,
        headBranch: latest.headBranch,
        state: latest.state
    }
}

export async function createOrOpenPullRequest(
    projectPath: string,
    input: DevScopeCreatePullRequestInput,
    onProgress?: (message: string) => void
) {
    onProgress?.('Checking branch...')
    const branchStateBeforePush = await readBranchState(projectPath)
    await ensureNoWorkingTreeChanges(branchStateBeforePush)

    const preferredRemote = getPreferredGitHubRemote(branchStateBeforePush.remotes)
    if (!preferredRemote) {
        throw new Error('Add a GitHub remote before creating a PR.')
    }

    onProgress?.('Pushing...')
    await pushCurrentBranchIfNeeded(projectPath, branchStateBeforePush)

    onProgress?.('Refreshing branch...')
    const branchState = await readBranchState(projectPath)
    await ensureNoWorkingTreeChanges(branchState)
    const branch = String(branchState.branch || '').trim()
    if (!branch) {
        throw new Error('Detached HEAD: checkout a branch before creating a PR.')
    }

    onProgress?.('Checking PR...')
    const headContext = await resolveBranchHeadContext(projectPath, branchState)
    const existing = await findOpenPullRequest(branchState.cwd, headContext.headSelectors)
    if (existing) {
        return {
            status: 'opened_existing' as const,
            draftSource: 'provided' as DevScopePullRequestDraftSource,
            pullRequest: {
                number: existing.number,
                title: existing.title,
                url: existing.url,
                baseBranch: existing.baseBranch,
                headBranch: existing.headBranch,
                state: existing.state
            }
        }
    }

    onProgress?.('Resolving base...')
    const baseBranch = await resolveBaseBranch(
        branchState.cwd,
        branch,
        branchState.upstreamRef,
        headContext.isCrossRepository,
        input.targetBranch
    )
    if (baseBranch === branch) {
        throw new Error('Choose a target branch that is different from the current branch.')
    }

    onProgress?.('Preparing PR...')
    const draft = await ensureDraft(branchState.cwd, branch, baseBranch, input)
    onProgress?.('Creating PR...')
    const createStdout = await createPullRequest(branchState.cwd, {
        baseBranch,
        headSelector: headContext.preferredHeadSelector,
        title: draft.title,
        body: draft.body,
        draft: input.draft !== false
    })

    onProgress?.('Finalizing PR...')
    const created = await findOpenPullRequest(branchState.cwd, headContext.headSelectors)
    if (created) {
        return {
            status: 'created' as const,
            draftSource: draft.source,
            ...(draft.provider ? { provider: draft.provider } : {}),
            pullRequest: {
                number: created.number,
                title: created.title,
                url: created.url,
                baseBranch: created.baseBranch,
                headBranch: created.headBranch,
                state: created.state
            }
        }
    }

    const urlMatch = createStdout.match(/https:\/\/github\.com\/[^\s]+\/pull\/\d+/i)
    if (!urlMatch) {
        throw new Error('Pull request was created, but DevScope could not resolve its URL.')
    }

    return {
        status: 'created' as const,
        draftSource: draft.source,
        ...(draft.provider ? { provider: draft.provider } : {}),
        pullRequest: {
            number: 0,
            title: draft.title,
            url: urlMatch[0],
            baseBranch,
            headBranch: headContext.headBranch,
            state: 'open' as PullRequestState
        }
    }
}

export function summarizePullRequestOutcome(input: {
    status: 'created' | 'opened_existing'
    draftSource: DevScopePullRequestDraftSource
    provider?: DevScopePullRequestProvider
}) {
    if (input.status === 'opened_existing') {
        return 'Opened existing pull request.'
    }

    if (input.draftSource === 'ai' && input.provider) {
        return `Created pull request with ${input.provider === 'groq' ? 'Groq' : input.provider === 'gemini' ? 'Gemini' : 'Codex'} draft content.`
    }

    if (input.draftSource === 'fallback') {
        return 'Created pull request with the built-in draft template.'
    }

    return 'Created pull request.'
}

export function logPullRequestError(context: string, error: unknown) {
    log.error(`[GitHub PR] ${context}:`, error)
    return toServiceError(error, 'Failed to handle pull request.')
}
