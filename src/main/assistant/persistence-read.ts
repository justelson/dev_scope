import type { Database as SqlDatabase, SqlValue } from 'sql.js/dist/sql-asm.js'
import type {
    AssistantActivity,
    AssistantDomainEvent,
    AssistantMessage,
    AssistantPendingApproval,
    AssistantPendingUserInput,
    AssistantProposedPlan,
    AssistantSession,
    AssistantSnapshot,
    AssistantThread
} from '../../shared/assistant/contracts'
import { recoverPersistedSnapshot } from './projector'
import { type AssistantHydratedThreadData, hydrateFocusedSessionSnapshot, summarizeThread } from './persistence-snapshot'
import {
    type AssistantMetaRow,
    PERSISTENCE_VERSION,
    parseJson,
    runSqlTransaction,
    shouldDeleteInvalidSession,
    toNullableString,
    toNumber
} from './persistence-utils'
import { persistAssistantSnapshotMeta } from './persistence-write'

export function readAssistantPersistenceRecord(db: SqlDatabase): { version: number; snapshot: AssistantSnapshot; events: AssistantDomainEvent[] } {
    return {
        version: PERSISTENCE_VERSION,
        snapshot: readAssistantSnapshot(db),
        events: []
    }
}

export function readAssistantSnapshot(db: SqlDatabase): AssistantSnapshot {
    const meta = readAssistantMeta(db)
    const sessions = removeInvalidSessions(db, readAssistantSessionSummaries(db))
    let selectedSessionId = meta.selectedSessionId

    if (selectedSessionId && !sessions.some((session) => session.id === selectedSessionId)) {
        selectedSessionId = sessions[0]?.id || null
    }

    let snapshot: AssistantSnapshot = {
        snapshotSequence: meta.snapshotSequence,
        updatedAt: meta.updatedAt,
        selectedSessionId,
        sessions,
        knownModels: meta.knownModels
    }
    snapshot = recoverPersistedSnapshot(snapshot)
    if (selectedSessionId) {
        snapshot = hydrateFocusedSessionSnapshot(snapshot, selectedSessionId, readActiveThreadDetails(db, selectedSessionId, snapshot))
    }
    if (selectedSessionId !== meta.selectedSessionId) {
        persistAssistantSnapshotMeta(db, snapshot)
    }
    return snapshot
}

export function readActiveThreadDetails(db: SqlDatabase, sessionId: string, snapshot: AssistantSnapshot): AssistantHydratedThreadData | null {
    const session = snapshot.sessions.find((entry) => entry.id === sessionId)
    const threadId = session?.activeThreadId || session?.threadIds[0] || null
    if (!threadId) return null

    const activePlanRow = db.exec('SELECT active_plan_json FROM assistant_threads WHERE id = ?', [threadId])[0]?.values?.[0] || null
    return {
        activePlan: parseJson(activePlanRow?.[0] ?? null, null),
        messages: readThreadRows<AssistantMessage>(db, 'assistant_messages', threadId, [
            'id', 'role', 'text', 'turn_id', 'streaming', 'created_at', 'updated_at'
        ], (row) => ({
            id: String(row[0] || ''),
            role: String(row[1] || 'assistant') as AssistantMessage['role'],
            text: String(row[2] || ''),
            turnId: toNullableString(row[3]),
            streaming: toNumber(row[4]) === 1,
            createdAt: String(row[5] || new Date(0).toISOString()),
            updatedAt: String(row[6] || new Date(0).toISOString())
        })),
        proposedPlans: readThreadRows<AssistantProposedPlan>(db, 'assistant_proposed_plans', threadId, [
            'id', 'turn_id', 'plan_markdown', 'created_at', 'updated_at'
        ], (row) => ({
            id: String(row[0] || ''),
            turnId: toNullableString(row[1]),
            planMarkdown: String(row[2] || ''),
            createdAt: String(row[3] || new Date(0).toISOString()),
            updatedAt: String(row[4] || new Date(0).toISOString())
        })),
        activities: readThreadRows<AssistantActivity>(db, 'assistant_activities', threadId, [
            'id', 'kind', 'tone', 'summary', 'detail', 'turn_id', 'created_at', 'payload_json'
        ], (row) => ({
            id: String(row[0] || ''),
            kind: String(row[1] || ''),
            tone: String(row[2] || 'info') as AssistantActivity['tone'],
            summary: String(row[3] || ''),
            detail: toNullableString(row[4]) || undefined,
            turnId: toNullableString(row[5]),
            createdAt: String(row[6] || new Date(0).toISOString()),
            payload: parseJson<Record<string, unknown> | undefined>(row[7], undefined)
        })),
        pendingApprovals: readThreadRows<AssistantPendingApproval>(db, 'assistant_pending_approvals', threadId, [
            'id', 'request_id', 'request_type', 'title', 'detail', 'command', 'paths_json', 'status', 'decision', 'turn_id', 'created_at', 'resolved_at'
        ], (row) => ({
            id: String(row[0] || ''),
            requestId: String(row[1] || ''),
            requestType: String(row[2] || 'command') as AssistantPendingApproval['requestType'],
            title: toNullableString(row[3]) || undefined,
            detail: toNullableString(row[4]) || undefined,
            command: toNullableString(row[5]) || undefined,
            paths: parseJson<string[] | undefined>(row[6], undefined),
            status: String(row[7] || 'pending') as AssistantPendingApproval['status'],
            decision: toNullableString(row[8]) as AssistantPendingApproval['decision'],
            turnId: toNullableString(row[9]),
            createdAt: String(row[10] || new Date(0).toISOString()),
            resolvedAt: toNullableString(row[11])
        })),
        pendingUserInputs: readThreadRows<AssistantPendingUserInput>(db, 'assistant_pending_user_inputs', threadId, [
            'id', 'request_id', 'questions_json', 'status', 'answers_json', 'turn_id', 'created_at', 'resolved_at'
        ], (row) => ({
            id: String(row[0] || ''),
            requestId: String(row[1] || ''),
            questions: parseJson(row[2], []),
            status: String(row[3] || 'pending') as AssistantPendingUserInput['status'],
            answers: parseJson<Record<string, string | string[]> | null>(row[4], null),
            turnId: toNullableString(row[5]),
            createdAt: String(row[6] || new Date(0).toISOString()),
            resolvedAt: toNullableString(row[7])
        }))
    }
}

function readAssistantMeta(db: SqlDatabase): AssistantMetaRow {
    const rows = db.exec('SELECT key, value FROM assistant_meta')
    const values = new Map<string, string>()
    for (const row of rows[0]?.values || []) {
        const key = typeof row[0] === 'string' ? row[0] : ''
        const value = typeof row[1] === 'string' ? row[1] : ''
        if (key) values.set(key, value)
    }
    return {
        snapshotSequence: Number(values.get('snapshotSequence') || '0') || 0,
        updatedAt: values.get('updatedAt') || new Date(0).toISOString(),
        selectedSessionId: values.get('selectedSessionId') || null,
        knownModels: parseJson(values.get('knownModels') || '', [])
    }
}

function readAssistantSessionSummaries(db: SqlDatabase): AssistantSession[] {
    const sessions = new Map<string, AssistantSession>()
    const sessionRows = db.exec(`
        SELECT id, title, project_path, archived, created_at, updated_at, active_thread_id
        FROM assistant_sessions
        ORDER BY updated_at DESC, id DESC
    `)[0]?.values || []

    for (const row of sessionRows) {
        const session: AssistantSession = {
            id: String(row[0] || ''),
            title: String(row[1] || 'New Session'),
            projectPath: toNullableString(row[2]),
            archived: toNumber(row[3]) === 1,
            createdAt: String(row[4] || new Date(0).toISOString()),
            updatedAt: String(row[5] || new Date(0).toISOString()),
            activeThreadId: toNullableString(row[6]),
            threadIds: [],
            threads: []
        }
        sessions.set(session.id, session)
    }

    const threadRows = db.exec(`
        SELECT
            id,
            session_id,
            provider_thread_id,
            model,
            cwd,
            message_count,
            last_seen_completed_turn_id,
            runtime_mode,
            interaction_mode,
            state,
            last_error,
            created_at,
            updated_at,
            latest_turn_json
        FROM assistant_threads
        ORDER BY session_id ASC, updated_at DESC, id DESC
    `)[0]?.values || []

    for (const row of threadRows) {
        const sessionId = String(row[1] || '')
        const session = sessions.get(sessionId)
        if (!session) continue
        const thread: AssistantThread = summarizeThread({
            id: String(row[0] || ''),
            providerThreadId: toNullableString(row[2]),
            model: String(row[3] || ''),
            cwd: toNullableString(row[4]),
            messageCount: toNumber(row[5]),
            lastSeenCompletedTurnId: toNullableString(row[6]),
            runtimeMode: String(row[7] || 'approval-required') as AssistantThread['runtimeMode'],
            interactionMode: String(row[8] || 'default') as AssistantThread['interactionMode'],
            state: String(row[9] || 'idle') as AssistantThread['state'],
            lastError: toNullableString(row[10]),
            createdAt: String(row[11] || new Date(0).toISOString()),
            updatedAt: String(row[12] || new Date(0).toISOString()),
            latestTurn: parseJson(row[13], null),
            activePlan: null,
            messages: [],
            proposedPlans: [],
            activities: [],
            pendingApprovals: [],
            pendingUserInputs: []
        })
        session.threads.push(thread)
        session.threadIds.push(thread.id)
    }

    return [...sessions.values()]
}

function removeInvalidSessions(db: SqlDatabase, sessions: AssistantSession[]): AssistantSession[] {
    const invalidSessionIds = sessions.filter(shouldDeleteInvalidSession).map((session) => session.id)
    if (invalidSessionIds.length === 0) return sessions

    runSqlTransaction(db, () => {
        for (const sessionId of invalidSessionIds) {
            db.run('DELETE FROM assistant_sessions WHERE id = ?', [sessionId])
        }
    })

    return sessions.filter((session) => !invalidSessionIds.includes(session.id))
}

function readThreadRows<T>(db: SqlDatabase, tableName: string, threadId: string, columns: string[], mapRow: (row: SqlValue[]) => T): T[] {
    const result = db.exec(`
        SELECT ${columns.join(', ')}
        FROM ${tableName}
        WHERE thread_id = ?
        ORDER BY created_at ASC, id ASC
    `, [threadId])[0]?.values || []
    return result.map((row) => mapRow(row))
}
