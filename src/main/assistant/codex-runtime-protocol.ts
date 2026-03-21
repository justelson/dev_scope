import type { ChildProcess, ChildProcessByStdio } from 'node:child_process'
import { spawnSync } from 'node:child_process'
import type readline from 'node:readline'
import type { Readable, Writable } from 'node:stream'
import type {
    AssistantApprovalRequestType,
    AssistantInteractionMode,
    AssistantRuntimeMode,
    AssistantThread
} from '../../shared/assistant/contracts'
import {
    asRecord,
    asString,
    buildToolActivity,
    extractItemPaths,
    normalizeItemType,
    readNumericValue,
    readStringArray,
    readTextValue,
    readToolOutput,
    readToolTiming
} from './codex-runtime-value-utils'
import {
    isAssistantItemType as isAssistantItemTypeImpl,
    mapRuntimeMode as mapRuntimeModeImpl,
    readTurnUsage as readTurnUsageImpl,
    toApprovalRequestType as toApprovalRequestTypeImpl,
    toUserInputQuestions as toUserInputQuestionsImpl
} from './codex-runtime-session-utils'

export {
    asRecord,
    asString,
    buildToolActivity,
    extractItemPaths,
    normalizeItemType,
    readNumericValue,
    readStringArray,
    readTextValue,
    readToolOutput,
    readToolTiming
}

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

export type CodexServerChildProcess = ChildProcessByStdio<Writable, Readable, Readable>

export interface SessionContext {
    child: CodexServerChildProcess
    output: readline.Interface
    pending: Map<string, PendingRpc>
    pendingApprovals: Map<string, PendingApprovalRequest>
    pendingUserInputs: Map<string, PendingUserInputRequest>
    nextRequestId: number
    stopping: boolean
    thread: AssistantThread
}

export function killChildTree(child: Pick<ChildProcess, 'pid' | 'kill'>): void {
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

export function readTurnUsage(turn: Record<string, unknown> | undefined, payload: Record<string, unknown>) {
    return readTurnUsageImpl(turn, payload, readNumericValue, asRecord)
}

export function isAssistantItemType(itemType: string): boolean {
    return isAssistantItemTypeImpl(itemType)
}

export function toUserInputQuestions(value: unknown) {
    return toUserInputQuestionsImpl(value, asRecord, asString)
}

export function toApprovalRequestType(method: string) {
    return toApprovalRequestTypeImpl(method)
}

export function mapRuntimeMode(mode: AssistantRuntimeMode) {
    return mapRuntimeModeImpl(mode)
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
