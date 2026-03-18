import type { ChildProcessWithoutNullStreams } from 'node:child_process'
import { spawnSync } from 'node:child_process'
import type readline from 'node:readline'
import type {
    AssistantApprovalRequestType,
    AssistantInteractionMode,
    AssistantRuntimeMode,
    AssistantThread,
    AssistantTurnUsage,
    AssistantUserInputQuestion
} from '../../shared/assistant/contracts'

export type JsonRpcId = string | number
export type JsonRpcMessage = Record<string, unknown>

export interface PendingRpc {
    method: string
    timer: NodeJS.Timeout
    resolve: (value: unknown) => void
    reject: (error: Error) => void
}

export interface PendingApprovalRequest {
    requestId: string
    jsonRpcId: JsonRpcId
    requestType: AssistantApprovalRequestType
    threadId: string
    turnId?: string
    itemId?: string
}

export interface PendingUserInputRequest {
    requestId: string
    jsonRpcId: JsonRpcId
    threadId: string
    turnId?: string
    itemId?: string
}

export interface SessionContext {
    child: ChildProcessWithoutNullStreams
    output: readline.Interface
    pending: Map<string, PendingRpc>
    pendingApprovals: Map<string, PendingApprovalRequest>
    pendingUserInputs: Map<string, PendingUserInputRequest>
    nextRequestId: number
    stopping: boolean
    thread: AssistantThread
}

export function asRecord(value: unknown): Record<string, unknown> | undefined {
    return value && typeof value === 'object' ? value as Record<string, unknown> : undefined
}

export function asString(value: unknown): string | undefined {
    return typeof value === 'string' ? value : undefined
}

export function normalizeItemType(value: unknown): string {
    return String(value || '')
        .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
        .replace(/[._/-]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase()
}

export function readTextValue(value: unknown): string | undefined {
    if (typeof value === 'string') {
        const trimmed = value.trim()
        return trimmed || undefined
    }
    if (Array.isArray(value)) {
        const combined = value
            .map((entry) => readTextValue(entry))
            .filter((entry): entry is string => Boolean(entry))
            .join('\n')
            .trim()
        return combined || undefined
    }
    const record = asRecord(value)
    if (!record) return undefined
    return readTextValue(
        record['text']
        ?? record['value']
        ?? record['message']
        ?? record['content']
        ?? record['parts']
        ?? record['output']
    )
}

export function readStringArray(value: unknown): string[] {
    if (typeof value === 'string') {
        const trimmed = value.trim()
        return trimmed ? [trimmed] : []
    }
    if (!Array.isArray(value)) return []
    return value
        .map((entry) => {
            if (typeof entry === 'string') return entry.trim()
            const record = asRecord(entry)
            return asString(record?.['path'])?.trim()
                || asString(record?.['filePath'])?.trim()
                || asString(record?.['targetPath'])?.trim()
                || asString(record?.['name'])?.trim()
                || ''
        })
        .filter((entry): entry is string => Boolean(entry))
}

export function extractItemPaths(item: Record<string, unknown>): string[] {
    const candidates = [
        ...readStringArray(item['path']),
        ...readStringArray(item['filePath']),
        ...readStringArray(item['targetPath']),
        ...readStringArray(item['paths']),
        ...readStringArray(item['files'])
    ]
    return [...new Set(candidates)]
}

export function readToolOutput(item: Record<string, unknown>): string | undefined {
    return readTextValue(item['stdout'])
        || readTextValue(item['stderr'])
        || readTextValue(item['output'])
        || readTextValue(item['result'])
        || readTextValue(asRecord(item['result'])?.['output'])
        || readTextValue(asRecord(item['result'])?.['stdout'])
        || readTextValue(asRecord(item['result'])?.['stderr'])
        || readTextValue(asRecord(item['response'])?.['output'])
        || readTextValue(asRecord(item['response'])?.['result'])
}

export function readNumericValue(value: unknown): number | undefined {
    if (typeof value === 'number' && Number.isFinite(value)) return value
    if (typeof value === 'string') {
        const parsed = Number(value)
        if (Number.isFinite(parsed)) return parsed
    }
    return undefined
}

export function readToolTiming(item: Record<string, unknown>) {
    const startedAt = asString(item['startedAt']) || asString(item['started_at']) || asString(item['startTime']) || asString(item['start_time'])
    const completedAt = asString(item['completedAt']) || asString(item['completed_at']) || asString(item['finishedAt']) || asString(item['finished_at']) || asString(item['endedAt']) || asString(item['ended_at'])
    const durationMs = readNumericValue(item['durationMs']) || readNumericValue(item['duration_ms']) || readNumericValue(item['elapsedMs']) || readNumericValue(item['elapsed_ms'])

    return {
        startedAt,
        completedAt,
        durationMs
    }
}

export function readTurnUsage(turn: Record<string, unknown> | undefined, payload: Record<string, unknown>): AssistantTurnUsage | null {
    const usage = asRecord(turn?.['usage'])
        || asRecord(turn?.['tokenUsage'])
        || asRecord(payload['usage'])
        || asRecord(payload['tokenUsage'])

    const inputTokens = readNumericValue(usage?.['inputTokens'] ?? usage?.['input_tokens'])
    const outputTokens = readNumericValue(usage?.['outputTokens'] ?? usage?.['output_tokens'])
    const reasoningOutputTokens = readNumericValue(usage?.['reasoningOutputTokens'] ?? usage?.['reasoning_output_tokens'])
    const cachedInputTokens = readNumericValue(usage?.['cachedInputTokens'] ?? usage?.['cached_input_tokens'])
    const totalTokens = readNumericValue(usage?.['totalTokens'] ?? usage?.['total_tokens'])
    const modelContextWindow = readNumericValue(usage?.['modelContextWindow'] ?? usage?.['model_context_window'])

    if ([inputTokens, outputTokens, reasoningOutputTokens, cachedInputTokens, totalTokens, modelContextWindow].every((value) => value === undefined)) {
        return null
    }

    return {
        inputTokens: inputTokens ?? null,
        outputTokens: outputTokens ?? null,
        reasoningOutputTokens: reasoningOutputTokens ?? null,
        cachedInputTokens: cachedInputTokens ?? null,
        totalTokens: totalTokens ?? null,
        modelContextWindow: modelContextWindow ?? null
    }
}

export function buildToolActivity(item: Record<string, unknown>, itemType: string):
    | {
        kind: string
        summary: string
        detail?: string
        tone: 'tool'
        data: Record<string, unknown>
    }
    | null {
    const command = readTextValue(item['command']) || readTextValue(asRecord(item['input'])?.['command'])
    const query = readTextValue(item['query']) || readTextValue(item['pattern']) || readTextValue(item['url'])
    const toolName = readTextValue(item['tool']) || readTextValue(item['name'])
    const paths = extractItemPaths(item)
    const output = readToolOutput(item)
    const timing = readToolTiming(item)
    const detail = readTextValue(item['detail'])
        || readTextValue(item['summary'])
        || readTextValue(item['description'])
        || readTextValue(item['message'])
        || readTextValue(item['text'])
        || readTextValue(item['content'])
        || output

    if (itemType.includes('file read') || (itemType.includes('file') && !itemType.includes('change') && paths.length > 0)) {
        return {
            kind: 'file-read',
            summary: paths.length > 1 ? 'Read files' : 'Read file',
            detail: paths.join('\n') || detail,
            tone: 'tool',
            data: { itemType, paths, startedAt: timing.startedAt, completedAt: timing.completedAt, durationMs: timing.durationMs }
        }
    }

    if (itemType.includes('file change') || itemType.includes('edit')) {
        return {
            kind: 'file-change',
            summary: paths.length > 1 ? 'Edited files' : 'Edited file',
            detail: paths.join('\n') || detail,
            tone: 'tool',
            data: { itemType, paths, startedAt: timing.startedAt, completedAt: timing.completedAt, durationMs: timing.durationMs }
        }
    }

    if (itemType.includes('search') || itemType.includes('web') || query) {
        return {
            kind: 'search',
            summary: 'Searched',
            detail: query || detail,
            tone: 'tool',
            data: {
                itemType,
                query,
                output: output && output !== query ? output : detail && detail !== query ? detail : undefined,
                startedAt: timing.startedAt,
                completedAt: timing.completedAt,
                durationMs: timing.durationMs
            }
        }
    }

    if (itemType.includes('command') || command) {
        return {
            kind: 'command',
            summary: 'Ran command',
            detail: command || detail,
            tone: 'tool',
            data: {
                itemType,
                command,
                paths,
                output: output && output !== command ? output : detail && detail !== command ? detail : undefined,
                startedAt: timing.startedAt,
                completedAt: timing.completedAt,
                durationMs: timing.durationMs
            }
        }
    }

    if (itemType.includes('tool') || itemType.includes('function') || toolName) {
        return {
            kind: 'tool',
            summary: 'Ran tool',
            detail: toolName || detail,
            tone: 'tool',
            data: {
                itemType,
                toolName,
                paths,
                output: output && output !== toolName ? output : detail && detail !== toolName ? detail : undefined,
                startedAt: timing.startedAt,
                completedAt: timing.completedAt,
                durationMs: timing.durationMs
            }
        }
    }

    return null
}

export function isAssistantItemType(itemType: string): boolean {
    return itemType.includes('assistant')
        || itemType.includes('agent message')
        || itemType.includes('agentmessage')
        || itemType.includes('message')
}

export function toUserInputQuestions(value: unknown): AssistantUserInputQuestion[] {
    const questions = Array.isArray(value) ? value : []
    return questions
        .map((entry) => {
            const record = asRecord(entry)
            const options = Array.isArray(record?.['options']) ? record['options'] : []
            const id = asString(record?.['id'])
            const header = asString(record?.['header'])
            const question = asString(record?.['question'])
            if (!id || !header || !question) return null
            return {
                id,
                header,
                question,
                options: options
                    .map((option) => {
                        const optionRecord = asRecord(option)
                        const label = asString(optionRecord?.['label'])
                        const description = asString(optionRecord?.['description'])
                        if (!label || !description) return null
                        return { label, description }
                    })
                    .filter((option): option is { label: string; description: string } => Boolean(option))
            }
        })
        .filter((question): question is AssistantUserInputQuestion => Boolean(question))
}

export function toApprovalRequestType(method: string): AssistantApprovalRequestType | undefined {
    if (method === 'item/commandExecution/requestApproval') return 'command'
    if (method === 'item/fileRead/requestApproval') return 'file-read'
    if (method === 'item/fileChange/requestApproval') return 'file-change'
    return undefined
}

export function mapRuntimeMode(mode: AssistantRuntimeMode): { approvalPolicy: 'on-request' | 'never'; sandbox: 'workspace-write' | 'danger-full-access' } {
    if (mode === 'full-access') {
        return { approvalPolicy: 'never', sandbox: 'danger-full-access' }
    }
    return { approvalPolicy: 'on-request', sandbox: 'workspace-write' }
}

export function killChildTree(child: ChildProcessWithoutNullStreams): void {
    if (process.platform === 'win32' && child.pid) {
        try {
            spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' })
            return
        } catch {
            // Fall through to direct kill.
        }
    }
    child.kill()
}

export function buildTurnParams(
    thread: AssistantThread,
    prompt: string,
    model?: string,
    runtimeMode?: AssistantRuntimeMode,
    _interactionMode?: AssistantInteractionMode,
    effort?: 'low' | 'medium' | 'high' | 'xhigh',
    serviceTier?: 'fast'
) {
    const params: Record<string, unknown> = {
        threadId: thread.providerThreadId,
        input: [{ type: 'text', text: prompt }],
        approvalPolicy: mapRuntimeMode(runtimeMode || thread.runtimeMode).approvalPolicy
    }
    const effectiveModel = model || thread.model
    if (effectiveModel) params['model'] = effectiveModel
    if (effort) params['effort'] = effort
    if (serviceTier) params['serviceTier'] = serviceTier
    return params
}
