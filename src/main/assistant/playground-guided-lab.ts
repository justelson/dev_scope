import type { AssistantPendingUserInput, AssistantSession } from '../../shared/assistant/contracts'
import { derivePlaygroundLabTitle } from './playground-service'
import { createAssistantId, nowIso, sanitizeOptionalPath } from './utils'

export const PLAYGROUND_LAB_DECISION_QUESTION_ID = 'playground_lab_decision'
export const PLAYGROUND_LAB_NAME_QUESTION_ID = 'playground_lab_name'
export const PLAYGROUND_REPO_URL_QUESTION_ID = 'playground_repo_url'

type PlaygroundLabDecision = 'continue-without-lab' | 'create-empty' | 'clone-repo'

const WORKSPACE_BUILD_PATTERN = /\b(create|build|make|scaffold|generate|implement|code|repo|repository|project|app|workspace|files?)\b/i
const LOCAL_ASSET_REFERENCE_PATTERN = /\b(folder|directory|path|drive|downloads?|desktop|documents?|videos?|recordings?|screen recordings?|screenshots?|frames?|mp4|mov|mkv|webm|avi|png|jpe?g|gif|wav|mp3)\b/i
const LOCAL_ACCESS_ACTION_PATTERN = /\b(open|look|inspect|read|analy[sz]e|extract|get|show|tell|find|use|load|view)\b/i

export function isPlaygroundNoLabSession(session: AssistantSession): boolean {
    return session.mode === 'playground'
        && !session.playgroundLabId
        && !sanitizeOptionalPath(session.projectPath)
}

export function buildPlaygroundNoLabRuntimePrompt(prompt: string): string {
    const normalizedPrompt = String(prompt || '').trim()
    if (!normalizedPrompt) return prompt
    return [
        '[DevScope Playground context]',
        'This chat is in Playground mode and does not currently have a lab attached.',
        'Treat this as a no-filesystem workspace by default, even if a temporary runtime cwd exists.',
        'Do not assume there is a repo, project tree, or editable codebase yet.',
        'If you can still answer usefully without filesystem access, do so directly.',
        'If you genuinely need a workspace, do not do filesystem or shell work. Ask the user to attach or create a lab first.',
        `If request_user_input is explicitly available in this turn, use question ids "${PLAYGROUND_LAB_DECISION_QUESTION_ID}", "${PLAYGROUND_LAB_NAME_QUESTION_ID}", and "${PLAYGROUND_REPO_URL_QUESTION_ID}" when relevant.`,
        'For the decision question, offer options that clearly map to: create an empty lab, clone a repository, or continue without a lab.',
        'For suggested lab names or repo URLs, use the actual suggested value as the option label so the user can accept it or replace it with a custom answer.',
        'If the user continues without a lab, keep helping in the no-lab environment instead of retrying the same lab request immediately.',
        '',
        normalizedPrompt
    ].join('\n')
}

export function buildPendingPlaygroundLabRequest(session: AssistantSession, prompt: string) {
    if (!isPlaygroundNoLabSession(session)) return null
    if (session.pendingLabRequest) return null

    const normalizedPrompt = String(prompt || '').trim()
    if (!normalizedPrompt) return null

    const repoUrlMatch = normalizedPrompt.match(/https?:\/\/[^\s]+(?:\.git)?/i)
    const repoUrl = repoUrlMatch ? repoUrlMatch[0] : null
    const referencesLocalAsset = LOCAL_ASSET_REFERENCE_PATTERN.test(normalizedPrompt)
    const needsWorkspace = Boolean(repoUrl)
        || WORKSPACE_BUILD_PATTERN.test(normalizedPrompt)
        || (referencesLocalAsset && (
            LOCAL_ACCESS_ACTION_PATTERN.test(normalizedPrompt)
            || /\b(my|this|that|these|those|there|here|inside|in)\b/i.test(normalizedPrompt)
        ))

    if (!needsWorkspace) return null

    return {
        id: createAssistantId('assistant-playground-lab-request'),
        kind: repoUrl ? 'clone-repo' as const : 'create-empty' as const,
        prompt: normalizedPrompt,
        suggestedLabName: derivePlaygroundLabTitle(undefined, repoUrl, undefined),
        repoUrl,
        createdAt: nowIso()
    }
}

export function isPlaygroundLabUserInputRequest(pendingInput: AssistantPendingUserInput | null | undefined): boolean {
    if (!pendingInput) return false
    return pendingInput.questions.some((question) => question.id === PLAYGROUND_LAB_DECISION_QUESTION_ID)
}

export function resolvePlaygroundLabGuidedAnswers(answers: Record<string, string | string[]>): {
    decision: PlaygroundLabDecision
    title?: string
    repoUrl?: string
} | null {
    const decisionAnswer = normalizeSingleAnswer(answers[PLAYGROUND_LAB_DECISION_QUESTION_ID])
    if (!decisionAnswer) return null

    const decision = parsePlaygroundLabDecision(decisionAnswer)
    if (!decision) return null

    const title = normalizeOptionalField(answers[PLAYGROUND_LAB_NAME_QUESTION_ID])
    const repoUrl = normalizeOptionalField(answers[PLAYGROUND_REPO_URL_QUESTION_ID])
    if (decision === 'clone-repo' && !looksLikeRepositoryUrl(repoUrl)) return null

    return {
        decision,
        title,
        repoUrl: decision === 'clone-repo' ? repoUrl : undefined
    }
}

export function buildPlaygroundLabContinuationAnswer(reason: string): string {
    const normalizedReason = String(reason || '').trim()
    if (!normalizedReason) {
        return 'Continue without a lab. Stay in the no-lab Playground environment and avoid assuming filesystem access.'
    }
    return `${normalizedReason}. Stay in the no-lab Playground environment and avoid assuming filesystem access.`
}

export function buildPlaygroundLabCreatedAnswer(input: {
    decision: Exclude<PlaygroundLabDecision, 'continue-without-lab'>
    rootPath: string
    title?: string
    repoUrl?: string
}): string {
    const location = `Lab ready at ${input.rootPath}.`
    if (input.decision === 'clone-repo') {
        return [
            input.repoUrl ? `Clone approved for ${input.repoUrl}.` : 'Repository clone approved.',
            input.title ? `Use the lab "${input.title}".` : null,
            location,
            'For this turn, use that path explicitly as the working directory for filesystem or shell actions.'
        ].filter(Boolean).join(' ')
    }

    return [
        'Create-empty-lab approved.',
        input.title ? `Use the lab "${input.title}".` : null,
        location,
        'For this turn, use that path explicitly as the working directory for filesystem or shell actions.'
    ].filter(Boolean).join(' ')
}

function normalizeSingleAnswer(value: string | string[] | undefined): string {
    if (Array.isArray(value)) return String(value[0] || '').trim()
    return String(value || '').trim()
}

function normalizeOptionalField(value: string | string[] | undefined): string | undefined {
    const normalized = normalizeSingleAnswer(value)
    if (!normalized) return undefined
    const collapsed = normalized.toLowerCase()
    if (collapsed === 'none' || collapsed === 'n/a' || collapsed === 'na' || collapsed === 'skip') return undefined
    return normalized
}

function parsePlaygroundLabDecision(value: string): PlaygroundLabDecision | null {
    const normalized = value.toLowerCase()
    if (/\b(without|continue|no lab|no workspace|skip|decline)\b/.test(normalized)) return 'continue-without-lab'
    if (/\b(clone|repo|repository|git)\b/.test(normalized)) return 'clone-repo'
    if (/\b(create|empty|new lab|workspace|lab)\b/.test(normalized)) return 'create-empty'
    return null
}

function looksLikeRepositoryUrl(value: string | undefined): value is string {
    if (!value) return false
    return /^(https?:\/\/|git@|ssh:\/\/)/i.test(value)
}
