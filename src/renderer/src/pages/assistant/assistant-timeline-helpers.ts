import type { AssistantActivity, AssistantMessage, AssistantProposedPlan } from '@shared/assistant/contracts'
import { estimateMarkdownContentHeight } from '@/lib/text-layout/markdown-blocks'
import { stripProposedPlanBlocks } from './assistant-proposed-plan'
import {
    estimateAttachmentGridHeight,
    getAssistantMessageWidth,
    getPlanCardContentWidth,
    getUserMessageBodyWidth,
    measureTimelinePlainTextHeight
} from './assistant-timeline-text-metrics'

export type TimelineEntry =
    | { id: string; createdAt: string; type: 'message'; message: AssistantMessage }
    | { id: string; createdAt: string; type: 'plan'; plan: AssistantProposedPlan; canImplement: boolean }
    | { id: string; createdAt: string; type: 'activity'; activity: AssistantActivity }
    | { id: string; createdAt: string; type: 'activity-group'; activities: AssistantActivity[] }

export type TimelineRenderRow =
    | { kind: 'message'; id: string; createdAt: string; message: AssistantMessage }
    | { kind: 'plan'; id: string; createdAt: string; plan: AssistantProposedPlan; canImplement: boolean }
    | { kind: 'activity'; id: string; createdAt: string; activity: AssistantActivity }
    | { kind: 'activity-group'; id: string; createdAt: string; activities: AssistantActivity[] }
    | { kind: 'working'; id: string; createdAt: string | null }

export type ParsedUserAttachment = {
    id: string
    name: string
    type: string
    path: string | null
    mime: string | null
    size: string | null
    preview: string | null
    note: string | null
}

function shouldRenderActivity(activity: AssistantActivity): boolean {
    return activity.tone === 'tool'
}

export function isSubagentActivity(activity: AssistantActivity): boolean {
    return activity.kind.startsWith('subagent.') || readActivityString(activity.payload?.category) === 'subagent'
}

function readActivityString(value: unknown): string {
    return typeof value === 'string' ? value.trim() : ''
}

function readActivityStringArray(value: unknown): string[] {
    if (!Array.isArray(value)) return []
    return value
        .filter((entry): entry is string => typeof entry === 'string')
        .map((entry) => entry.trim())
        .filter(Boolean)
}

function stringifyActivityValue(value: unknown): string {
    if (typeof value === 'string') return value.trim()
    if (typeof value === 'number' || typeof value === 'boolean') return String(value)
    if (Array.isArray(value) || (value && typeof value === 'object')) {
        try {
            return JSON.stringify(value, null, 2)
        } catch {
            return ''
        }
    }
    return ''
}

function readActivityNumber(value: unknown): number | null {
    if (typeof value === 'number' && Number.isFinite(value)) return value
    if (typeof value === 'string') {
        const parsed = Number(value)
        if (Number.isFinite(parsed)) return parsed
    }
    return null
}

function compareTimelinePosition(
    leftCreatedAt: string,
    leftId: string,
    rightCreatedAt: string,
    rightId: string
): number {
    return leftCreatedAt.localeCompare(rightCreatedAt) || leftId.localeCompare(rightId)
}

export function areMessagesEqual(left: AssistantMessage, right: AssistantMessage): boolean {
    return left.id === right.id
        && left.role === right.role
        && left.text === right.text
        && left.turnId === right.turnId
        && left.streaming === right.streaming
        && left.createdAt === right.createdAt
        && left.updatedAt === right.updatedAt
}

export function getActivityCommand(activity: AssistantActivity): string {
    const payload = activity.payload || {}
    return readActivityString(payload.command)
        || readActivityString(payload.toolName || payload.tool || payload.name)
        || readActivityString(payload.query)
        || readActivityStringArray(payload.paths)[0]
        || readActivityString(activity.detail)
        || activity.summary
}

export function getActivityOutput(activity: AssistantActivity): string {
    const payload = activity.payload || {}
    return readActivityString(payload.output)
        || stringifyActivityValue(payload.result)
        || stringifyActivityValue(payload.results)
        || stringifyActivityValue(payload.response)
        || stringifyActivityValue(payload.matches)
}

export function getActivityPatch(activity: AssistantActivity): string | null {
    return readActivityString(activity.payload?.patch) || null
}

export function areActivitiesEquivalent(left: AssistantActivity, right: AssistantActivity): boolean {
    return left.id === right.id
        && left.kind === right.kind
        && left.tone === right.tone
        && left.summary === right.summary
        && left.detail === right.detail
        && left.turnId === right.turnId
        && left.createdAt === right.createdAt
        && getActivityCommand(left) === getActivityCommand(right)
        && getActivityOutput(left) === getActivityOutput(right)
        && getActivityPatch(left) === getActivityPatch(right)
}

export function areActivityListsEqual(left: AssistantActivity[], right: AssistantActivity[]): boolean {
    if (left.length !== right.length) return false
    for (let index = 0; index < left.length; index += 1) {
        if (!areActivitiesEquivalent(left[index], right[index])) return false
    }
    return true
}

export function parseUserMessageAttachments(text: string): { body: string; attachments: ParsedUserAttachment[] } {
    const source = String(text || '')
    const markerMatch = source.match(/\n\nAttached files \((\d+)\):\n/)
    if (!markerMatch || markerMatch.index == null) {
        return { body: source, attachments: [] }
    }

    const body = source.slice(0, markerMatch.index).trimEnd()
    const attachmentBlock = source.slice(markerMatch.index + markerMatch[0].length).trim()
    if (!attachmentBlock) {
        return { body, attachments: [] }
    }

    const relevantLines = attachmentBlock
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)

    const sections: string[] = []
    let currentSection: string[] = []

    const attachmentHeaderPattern = /^\d+\.\s+.+\s+\[[A-Z]+\]$/

    for (const line of relevantLines) {
        if (attachmentHeaderPattern.test(line)) {
            if (currentSection.length > 0) {
                sections.push(currentSection.join('\n'))
            }
            currentSection = [line]
            continue
        }
        if (currentSection.length === 0) continue
        currentSection.push(line)
    }

    if (currentSection.length > 0) {
        sections.push(currentSection.join('\n'))
    }

    const attachments = sections.map((section, index) => {
        const lines = section.split('\n').map((line) => line.trim()).filter(Boolean)
        const header = lines[0] || `${index + 1}. Attachment [FILE]`
        const headerMatch = header.match(/^\d+\.\s+(.+?)\s+\[([A-Z]+)\]$/)
        const details = new Map<string, string>()

        for (const line of lines.slice(1)) {
            const separatorIndex = line.indexOf(':')
            if (separatorIndex <= 0) continue
            const key = line.slice(0, separatorIndex).trim().toLowerCase()
            const value = line.slice(separatorIndex + 1).trim()
            if (key && value) details.set(key, value)
        }

        return {
            id: `${header}-${index}`,
            name: headerMatch?.[1]?.trim() || `Attachment ${index + 1}`,
            type: headerMatch?.[2]?.trim() || 'FILE',
            path: details.get('path') || details.get('ref') || null,
            mime: details.get('mime') || null,
            size: details.get('size') || null,
            preview: details.get('preview') || null,
            note: details.get('note') || null
        }
    })

    return { body, attachments }
}

export function isClipboardAttachmentReference(path: string | null): boolean {
    return String(path || '').trim().toLowerCase().startsWith('clipboard://')
}

export function canRenderAttachmentImage(path: string | null): boolean {
    const normalized = String(path || '').trim()
    return Boolean(normalized) && !normalized.startsWith('clipboard://')
}

export async function copyTextToClipboard(value: string): Promise<void> {
    const normalized = String(value || '')
    if (!normalized.trim()) return

    const result = await window.devscope.copyToClipboard?.(normalized)
    if (result && result.success === false) {
        throw new Error(result.error || 'Failed to copy to clipboard')
    }
    if (result) return

    if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(normalized)
        return
    }

    const textarea = document.createElement('textarea')
    textarea.value = normalized
    textarea.setAttribute('readonly', 'true')
    textarea.style.position = 'fixed'
    textarea.style.opacity = '0'
    textarea.style.pointerEvents = 'none'
    document.body.appendChild(textarea)
    textarea.select()
    const success = document.execCommand('copy')
    document.body.removeChild(textarea)
    if (!success) {
        throw new Error('Failed to copy to clipboard')
    }
}

export function formatWorkingTimer(startIso: string, endIso: string): string | null {
    const startedAtMs = Date.parse(startIso)
    const endedAtMs = Date.parse(endIso)
    if (!Number.isFinite(startedAtMs) || !Number.isFinite(endedAtMs)) return null

    const elapsedSeconds = Math.max(0, Math.floor((endedAtMs - startedAtMs) / 1000))
    if (elapsedSeconds < 60) return `${elapsedSeconds}s`

    const hours = Math.floor(elapsedSeconds / 3600)
    const minutes = Math.floor((elapsedSeconds % 3600) / 60)
    const seconds = elapsedSeconds % 60

    if (hours > 0) {
        return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`
    }

    return seconds > 0 ? `${minutes}m ${seconds}s` : `${minutes}m`
}

export function getTimelineEntries(
    messages: AssistantMessage[],
    activities: AssistantActivity[],
    proposedPlans: AssistantProposedPlan[] = []
): TimelineEntry[] {
    const renderedActivities = activities.filter(shouldRenderActivity)
    const allEntries: TimelineEntry[] = [
        ...messages.map((message) => ({
            id: message.id,
            createdAt: message.createdAt,
            type: 'message' as const,
            message
        })),
        ...renderedActivities.map((activity) => ({
            id: activity.id,
            createdAt: activity.createdAt,
            type: 'activity' as const,
            activity
        })),
        ...proposedPlans.map((plan, index) => {
            const hasLaterMessage = messages.some((message) => {
                if (message.turnId && plan.turnId && message.turnId === plan.turnId) return false
                return compareTimelinePosition(plan.createdAt, plan.id, message.createdAt, message.id) < 0
            })
            return {
                id: `plan-${plan.id}-${index}`,
                createdAt: plan.createdAt,
                type: 'plan' as const,
                plan,
                canImplement: !hasLaterMessage
            }
        })
    ].sort((left, right) => compareTimelinePosition(left.createdAt, left.id, right.createdAt, right.id))

    const grouped: TimelineEntry[] = []
    let currentGroup: AssistantActivity[] = []

    for (const entry of allEntries) {
        if (entry.type === 'activity' && entry.activity) {
            if (
                currentGroup.length > 0
                && isSubagentActivity(currentGroup[0]) !== isSubagentActivity(entry.activity)
            ) {
                grouped.push(
                    currentGroup.length === 1
                        ? { id: currentGroup[0].id, createdAt: currentGroup[0].createdAt, type: 'activity', activity: currentGroup[0] }
                        : { id: `group-${currentGroup[0].id}`, createdAt: currentGroup[0].createdAt, type: 'activity-group', activities: currentGroup }
                )
                currentGroup = []
            }
            currentGroup.push(entry.activity)
            continue
        }
        if (currentGroup.length > 0) {
            grouped.push(
                currentGroup.length === 1
                    ? { id: currentGroup[0].id, createdAt: currentGroup[0].createdAt, type: 'activity', activity: currentGroup[0] }
                    : { id: `group-${currentGroup[0].id}`, createdAt: currentGroup[0].createdAt, type: 'activity-group', activities: currentGroup }
            )
            currentGroup = []
        }
        grouped.push(entry)
    }

    if (currentGroup.length > 0) {
        grouped.push(
            currentGroup.length === 1
                ? { id: currentGroup[0].id, createdAt: currentGroup[0].createdAt, type: 'activity', activity: currentGroup[0] }
                : { id: `group-${currentGroup[0].id}`, createdAt: currentGroup[0].createdAt, type: 'activity-group', activities: currentGroup }
        )
    }

    return grouped
}

export function buildTimelineRows(entries: TimelineEntry[], isWorking: boolean, activeWorkStartedAt: string | null): TimelineRenderRow[] {
    const rows: TimelineRenderRow[] = entries.map((entry) => {
        if (entry.type === 'message') {
            return { kind: 'message', id: entry.id, createdAt: entry.createdAt, message: entry.message }
        }
        if (entry.type === 'plan') {
            return { kind: 'plan', id: entry.id, createdAt: entry.createdAt, plan: entry.plan, canImplement: entry.canImplement }
        }
        if (entry.type === 'activity-group') {
            return { kind: 'activity-group', id: entry.id, createdAt: entry.createdAt, activities: entry.activities }
        }
        return { kind: 'activity', id: entry.id, createdAt: entry.createdAt, activity: entry.activity }
    })

    if (isWorking && entries.length > 0) {
        rows.push({
            kind: 'working',
            id: 'working-indicator-row',
            createdAt: activeWorkStartedAt
        })
    }

    return rows
}

export function getActivityDetails(activity: AssistantActivity): string[] {
    const payload = activity.payload || {}
    return [...new Set([
        readActivityString(activity.detail),
        ...readActivityStringArray(payload.paths),
        readActivityString(payload.query),
        readActivityString(payload.toolName || payload.tool || payload.name)
    ].filter(Boolean))]
}

export function getActivityPaths(activity: AssistantActivity): string[] {
    const payload = activity.payload || {}
    const payloadPaths = readActivityStringArray(payload.paths)
    if (payloadPaths.length > 0) return payloadPaths
    return readActivityString(activity.detail)
        .split('\n')
        .map((entry) => entry.trim())
        .filter(Boolean)
}

export function getCreatedFilePaths(activity: AssistantActivity): string[] {
    return readActivityStringArray(activity.payload?.createdPaths)
}

export function isCommandActivity(activity: AssistantActivity): boolean {
    return activity.kind === 'command' || Boolean(readActivityString(activity.payload?.command))
}

export function getActivityDiffStats(activity: AssistantActivity): { additions: number; deletions: number; fileCount: number | null } | null {
    if (activity.kind !== 'file-change') return null

    const payload = activity.payload || {}
    const additions = readActivityNumber(payload.additions)
    const deletions = readActivityNumber(payload.deletions)
    const fileCount = readActivityNumber(payload.fileCount)

    if (additions === null && deletions === null) return null

    return {
        additions: Math.max(0, additions || 0),
        deletions: Math.max(0, deletions || 0),
        fileCount: fileCount !== null ? Math.max(0, fileCount) : null
    }
}

export function getActivityFileCount(activity: AssistantActivity): number | null {
    const payloadCount = readActivityNumber(activity.payload?.fileCount)
    if (payloadCount !== null) return Math.max(0, payloadCount)
    if (activity.kind !== 'file-change') return null
    const pathCount = getActivityPaths(activity).length
    return pathCount > 0 ? pathCount : null
}

export function getActivityTitle(activity: AssistantActivity): string {
    if (activity.kind === 'subagent.spawn') return 'Subagent spawn'
    if (activity.kind === 'subagent.send-input') return 'Subagent check-in'
    if (activity.kind === 'subagent.wait') return 'Waiting on subagent'
    if (activity.kind === 'subagent.resume') return 'Resume subagent'
    if (activity.kind === 'subagent.close') return 'Close subagent'
    if (isSubagentActivity(activity)) return 'Subagent activity'
    if (activity.kind === 'user-input.resolved') return 'Consulted user'
    if (activity.kind === 'search') return 'Search'
    if (activity.kind === 'file-read') return 'Read file'
    if (activity.kind === 'file-change') return (getActivityFileCount(activity) || 0) > 1 ? 'Edited files' : 'Edited file'
    if (isCommandActivity(activity)) return 'Command'
    return activity.summary || 'Tool'
}

export function getActivityStatus(activity: AssistantActivity): 'success' | 'running' | 'failed' {
    const payload = activity.payload || {}
    const rawStatus = readActivityString(payload.status) || readActivityString(payload.state) || readActivityString(payload.phase)
    if (activity.tone === 'error') return 'failed'
    if (rawStatus === 'running' || rawStatus === 'in_progress' || rawStatus === 'pending' || rawStatus === 'started') return 'running'
    if (rawStatus === 'error' || rawStatus === 'failed' || rawStatus === 'cancelled') return 'failed'
    return 'success'
}

type SubagentThreadLabel = {
    threadId: string | null
    providerThreadId: string | null
    label: string
    role: string | null
    nickname: string | null
    state: string | null
}

function isSubagentThreadLabel(value: unknown): value is SubagentThreadLabel {
    if (!value || typeof value !== 'object') return false
    const candidate = value as Record<string, unknown>
    return typeof candidate.label === 'string'
}

export function getSubagentActivityThreadLabels(activity: AssistantActivity): SubagentThreadLabel[] {
    const value = activity.payload?.receiverThreadLabels
    if (!Array.isArray(value)) return []
    return value.filter(isSubagentThreadLabel)
}

export function getSubagentActivityTargets(activity: AssistantActivity): string[] {
    const labels = getSubagentActivityThreadLabels(activity)
    if (labels.length > 0) {
        return labels
            .map((entry) => readActivityString(entry.label) || readActivityString(entry.nickname) || readActivityString(entry.role))
            .filter(Boolean)
    }
    return readActivityStringArray(activity.payload?.receiverLocalThreadIds)
}

export function getSubagentActivityPrompt(activity: AssistantActivity): string {
    return readActivityString(activity.payload?.prompt)
}

export function getSubagentActivityModel(activity: AssistantActivity): string {
    return readActivityString(activity.payload?.model)
}

export function getSubagentActivityReasoning(activity: AssistantActivity): string {
    return readActivityString(activity.payload?.reasoningEffort)
}

export function getActivityElapsed(activity: AssistantActivity): string | null {
    const payload = activity.payload || {}
    const durationCandidate = payload.durationMs
    const durationMs = typeof durationCandidate === 'number' ? durationCandidate : typeof durationCandidate === 'string' ? Number(durationCandidate) : Number.NaN
    if (Number.isFinite(durationMs) && durationMs >= 0) {
        if (durationMs < 1000) return `${Math.max(1, Math.round(durationMs))}ms`
        if (durationMs < 60_000) return `${(durationMs / 1000).toFixed(durationMs < 10_000 ? 1 : 0)}s`
        return formatWorkingTimer(new Date(0).toISOString(), new Date(durationMs).toISOString())
    }
    const startedAt = readActivityString(payload.startedAt)
    const completedAt = readActivityString(payload.completedAt) || activity.createdAt
    return startedAt && completedAt ? formatWorkingTimer(startedAt, completedAt) : null
}

export function estimateTimelineRowHeight(
    row: TimelineRenderRow,
    options: { containerWidth?: number | null } = {}
): number {
    if (row.kind === 'working') return 48
    if (row.kind === 'activity') return isSubagentActivity(row.activity) ? 212 : 168
    if (row.kind === 'activity-group') {
        const containsSubagentActivity = row.activities.some((activity) => isSubagentActivity(activity))
        return containsSubagentActivity
            ? 132 + Math.min(row.activities.length, 6) * 124
            : 120 + Math.min(row.activities.length, 6) * 96
    }
    if (row.kind === 'plan') {
        const displayedPlan = stripProposedPlanBlocks(row.plan.planMarkdown || '')
        const planHeight = estimateMarkdownContentHeight(
            displayedPlan,
            getPlanCardContentWidth(options.containerWidth),
            'assistant'
        )
        return Math.min(3200, 136 + planHeight)
    }

    const parsedUserMessage = row.message.role === 'user'
        ? parseUserMessageAttachments(row.message.text || '')
        : null
    const attachmentCount = parsedUserMessage?.attachments.length || 0
    const rawBody = row.message.role === 'user'
        ? (parsedUserMessage?.body || '')
        : stripProposedPlanBlocks(row.message.text || '')

    if (row.message.role === 'assistant') {
        const assistantWidth = getAssistantMessageWidth(options.containerWidth)
        const contentHeight = row.message.streaming
            ? measureTimelinePlainTextHeight(rawBody || ' ', assistantWidth, 'pre-wrap').height
            : estimateMarkdownContentHeight(rawBody || ' ', assistantWidth, 'assistant')
        const footerHeight = row.message.streaming ? 48 : 36
        return Math.min(5600, 44 + contentHeight + footerHeight)
    }

    const userBodyWidth = getUserMessageBodyWidth(options.containerWidth)
    const textHeight = rawBody
        ? measureTimelinePlainTextHeight(rawBody, userBodyWidth, 'pre-wrap').height
        : 0
    const attachmentHeight = estimateAttachmentGridHeight(attachmentCount, userBodyWidth)
    const footerHeight = 38
    const bubbleChromeHeight = 28

    return Math.min(3200, bubbleChromeHeight + attachmentHeight + textHeight + footerHeight)
}
