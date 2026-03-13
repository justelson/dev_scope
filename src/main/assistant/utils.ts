import { randomUUID } from 'node:crypto'
import type {
    AssistantLatestTurn,
    AssistantPendingApproval,
    AssistantPendingUserInput,
    AssistantThread
} from '../../shared/assistant/contracts'

const DEFAULT_SESSION_TITLE = 'New Session'
const PLAN_BLOCK_REGEX = /<proposed_plan>\s*([\s\S]*?)\s*<\/proposed_plan>/i

export function nowIso(): string {
    return new Date().toISOString()
}

export function createAssistantId(prefix: string): string {
    return `${prefix}-${randomUUID()}`
}

export function deriveSessionTitleFromPrompt(prompt: string): string {
    const normalized = String(prompt || '')
        .replace(/\s+/g, ' ')
        .trim()
    if (!normalized) return DEFAULT_SESSION_TITLE
    return normalized.slice(0, 60)
}

export function isDefaultSessionTitle(title: string): boolean {
    return title.trim().toLowerCase() === DEFAULT_SESSION_TITLE.toLowerCase()
}

export function extractProposedPlanMarkdown(text: string | undefined): string | undefined {
    const match = text ? PLAN_BLOCK_REGEX.exec(text) : null
    const planMarkdown = match?.[1]?.trim()
    return planMarkdown && planMarkdown.length > 0 ? planMarkdown : undefined
}

export function sanitizeOptionalPath(value: string | null | undefined): string | null {
    const normalized = String(value || '').trim()
    return normalized.length > 0 ? normalized : null
}

export function sortThreadsNewestFirst(threadIds: string[], threads: AssistantThread[]): string[] {
    const updatedAtById = new Map(threads.map((thread) => [thread.id, thread.updatedAt] as const))
    return [...threadIds].sort((left, right) => {
        const leftUpdatedAt = updatedAtById.get(left) || ''
        const rightUpdatedAt = updatedAtById.get(right) || ''
        return rightUpdatedAt.localeCompare(leftUpdatedAt) || right.localeCompare(left)
    })
}

export function clearResolvedApprovals(items: AssistantPendingApproval[]): AssistantPendingApproval[] {
    return items.filter((item) => item.status === 'pending')
}

export function clearResolvedUserInputs(items: AssistantPendingUserInput[]): AssistantPendingUserInput[] {
    return items.filter((item) => item.status === 'pending')
}

export function settleRunningTurn(latestTurn: AssistantLatestTurn | null, settledAt: string): AssistantLatestTurn | null {
    if (!latestTurn || latestTurn.state !== 'running') return latestTurn
    return {
        ...latestTurn,
        state: 'interrupted',
        completedAt: latestTurn.completedAt || settledAt
    }
}

export function runtimeStateAfterRestore(state: AssistantThread['state']): AssistantThread['state'] {
    if (state === 'running' || state === 'waiting' || state === 'ready' || state === 'starting') {
        return 'stopped'
    }
    return state
}

export const DEFAULT_ASSISTANT_MODELS: ReadonlyArray<{
    id: string
    label: string
    description?: string
}> = []

