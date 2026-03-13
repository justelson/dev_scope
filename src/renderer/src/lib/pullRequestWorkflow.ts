import type {
    CommitAIProvider,
    ProjectPullRequestConfig,
    PullRequestGuideConfig,
    PullRequestGuideSource,
    PullRequestChangeSource,
    Settings
} from './settings'

export function normalizeProjectPullRequestKey(projectPath: string): string {
    return String(projectPath || '').trim().replace(/\\/g, '/').toLowerCase()
}

export function getDefaultProjectPullRequestConfig(settings: Settings): ProjectPullRequestConfig {
    return {
        guideSource: settings.gitPullRequestDefaultGuideSource,
        guide: { ...settings.gitPullRequestGlobalGuide, text: '', filePath: '' },
        targetBranch: settings.gitPullRequestDefaultTargetBranch,
        draft: settings.gitPullRequestDefaultDraft,
        changeSource: settings.gitPullRequestDefaultChangeSource
    }
}

export function getProjectPullRequestConfig(settings: Settings, projectPath: string): ProjectPullRequestConfig {
    const key = normalizeProjectPullRequestKey(projectPath)
    const stored = settings.gitProjectPullRequestConfigs[key]
    return stored ? { ...stored, guide: { ...stored.guide } } : getDefaultProjectPullRequestConfig(settings)
}

export function mergeProjectPullRequestConfig(
    settings: Settings,
    projectPath: string,
    partial: Partial<ProjectPullRequestConfig>
): Record<string, ProjectPullRequestConfig> {
    const key = normalizeProjectPullRequestKey(projectPath)
    const previous = getProjectPullRequestConfig(settings, projectPath)
    return {
        ...settings.gitProjectPullRequestConfigs,
        [key]: {
            ...previous,
            ...partial,
            guide: {
                ...previous.guide,
                ...(partial.guide || {})
            }
        }
    }
}

export function getPullRequestChangeSourceLabel(changeSource: PullRequestChangeSource) {
    if (changeSource === 'unstaged') return 'Unstaged changes'
    if (changeSource === 'staged') return 'Staged changes'
    if (changeSource === 'local-commits') return 'Local commits'
    return 'All local work'
}

export function resolvePreferredPullRequestProvider(settings: Settings): { provider: CommitAIProvider; apiKey: string } | null {
    const providerOrder = settings.commitAIProvider === 'groq'
        ? (['groq', 'gemini'] as const)
        : (['gemini', 'groq'] as const)

    for (const provider of providerOrder) {
        const apiKey = provider === 'groq' ? settings.groqApiKey : settings.geminiApiKey
        if (String(apiKey || '').trim()) {
            return {
                provider,
                apiKey: String(apiKey || '').trim()
            }
        }
    }

    return null
}

async function readGuideFile(filePath: string): Promise<string> {
    const normalized = String(filePath || '').trim()
    if (!normalized) return ''
    const result = await window.devscope.readTextFileFull(normalized)
    if (!result?.success) {
        throw new Error(result?.error || 'Failed to read guide file.')
    }
    return String(result.content || '').trim()
}

export async function resolvePullRequestGuideText(
    settings: Settings,
    projectPath: string,
    guideSource: PullRequestGuideSource,
    projectGuide: PullRequestGuideConfig
): Promise<string> {
    if (guideSource === 'none') {
        return ''
    }

    if (guideSource === 'project') {
        if (projectGuide.mode === 'file') {
            return await readGuideFile(projectGuide.filePath)
        }
        return String(projectGuide.text || '').trim()
    }

    if (guideSource === 'global') {
        const guide = settings.gitPullRequestGlobalGuide
        if (guide.mode === 'file') {
            return await readGuideFile(guide.filePath)
        }
        return String(guide.text || '').trim()
    }

    const templateCandidates = [
        `${projectPath}/.github/pull_request_template.md`,
        `${projectPath}/.github/PULL_REQUEST_TEMPLATE.md`,
        `${projectPath}/pull_request_template.md`,
        `${projectPath}/PULL_REQUEST_TEMPLATE.md`
    ]

    for (const candidate of templateCandidates) {
        const result = await window.devscope.readTextFileFull(candidate)
        if (result?.success && String(result.content || '').trim()) {
            return String(result.content || '').trim()
        }
    }

    return ''
}

export function buildFallbackPullRequestDraft(input: {
    projectName: string
    currentBranch: string
    targetBranch: string
    scopeLabel: string
    guideText?: string
    commitMessages?: string[]
}) {
    const normalizedProjectName = String(input.projectName || 'project').trim() || 'project'
    const normalizedCurrentBranch = String(input.currentBranch || '').trim()
    const normalizedTargetBranch = String(input.targetBranch || '').trim() || 'main'
    const branchSummary = normalizedCurrentBranch && normalizedCurrentBranch !== normalizedTargetBranch
        ? `${normalizedCurrentBranch} -> ${normalizedTargetBranch}`
        : normalizedProjectName
    const title = normalizedCurrentBranch
        ? `Update ${normalizedProjectName} (${branchSummary})`
        : `Update ${normalizedProjectName}`
    const uniqueMessages = Array.from(new Set((input.commitMessages || []).map((message) => String(message || '').trim()).filter(Boolean))).slice(0, 6)
    const guideNote = String(input.guideText || '').trim()

    const bodyLines = [
        '## Summary',
        `- Prepare a PR for ${normalizedProjectName}.`,
        `- Scope: ${input.scopeLabel}.`,
        normalizedCurrentBranch
            ? `- Source branch: \`${normalizedCurrentBranch}\` into \`${normalizedTargetBranch}\`.`
            : `- Target branch: \`${normalizedTargetBranch}\`.`,
        '',
        '## Changes',
        ...(uniqueMessages.length > 0
            ? uniqueMessages.map((message) => `- ${message}`)
            : ['- Review generated diff details and expand this summary before publishing.']),
        '',
        '## Testing',
        '- Not yet validated.',
        '',
        '## Risks',
        '- Review the generated title/body and confirm branch/guide settings before opening the PR.'
    ]

    if (guideNote) {
        bodyLines.push('', '## Guide Notes', guideNote)
    }

    return {
        title,
        body: bodyLines.join('\n')
    }
}

function parseGitHubRemoteWebUrl(remoteUrl: string): string | null {
    const trimmed = String(remoteUrl || '').trim()
    if (!trimmed) return null

    const sshMatch = trimmed.match(/^git@github\.com:([^/]+)\/(.+?)(?:\.git)?$/i)
    if (sshMatch) {
        return `https://github.com/${sshMatch[1]}/${sshMatch[2]}`
    }

    try {
        const url = new URL(trimmed)
        if (!/github\.com$/i.test(url.hostname)) {
            return null
        }
        const segments = url.pathname.split('/').filter(Boolean)
        if (segments.length < 2) return null
        const owner = segments[0]
        const repo = segments[1].replace(/\.git$/i, '')
        return `https://github.com/${owner}/${repo}`
    } catch {
        return null
    }
}

export function buildGitHubPullRequestUrl(input: {
    remoteUrl: string
    baseBranch: string
    headBranch: string
    headOwner?: string
    title: string
    body: string
    draft: boolean
}) {
    const repoWebUrl = parseGitHubRemoteWebUrl(input.remoteUrl)
    if (!repoWebUrl) {
        return null
    }

    const params = new URLSearchParams({
        expand: '1',
        title: input.title,
        body: input.body
    })

    if (input.draft) {
        params.set('draft', '1')
    }

    const compareHead = input.headOwner
        ? `${input.headOwner}:${input.headBranch}`
        : input.headBranch

    return `${repoWebUrl}/compare/${encodeURIComponent(input.baseBranch)}...${encodeURIComponent(compareHead)}?${params.toString()}`
}
