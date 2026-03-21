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
import {
    PERSISTENCE_VERSION,
    jsonStringify,
    runSqlTransaction,
    sqlBool
} from './persistence-utils'

export function persistAssistantEvent(db: SqlDatabase, event: AssistantDomainEvent, snapshot: AssistantSnapshot): void {
    const session = event.sessionId ? snapshot.sessions.find((entry) => entry.id === event.sessionId) || null : null
    const thread = event.threadId
        ? snapshot.sessions
            .flatMap((entry) => entry.threads.map((candidate) => ({ sessionId: entry.id, thread: candidate })))
            .find((entry) => entry.thread.id === event.threadId) || null
        : null

    runSqlTransaction(db, () => {
        persistAssistantSnapshotMeta(db, snapshot)
        switch (event.type) {
            case 'session.created':
                if (session) {
                    upsertAssistantSession(db, session)
                    for (const createdThread of session.threads) {
                        upsertAssistantThreadSummary(db, session.id, createdThread)
                    }
                }
                break
            case 'session.updated':
            case 'session.selected':
                if (session) upsertAssistantSession(db, session)
                break
            case 'session.deleted':
                db.run('DELETE FROM assistant_sessions WHERE id = ?', [event.payload['sessionId'] as SqlValue])
                break
            case 'thread.created':
                if (session && thread) {
                    upsertAssistantSession(db, session)
                    upsertAssistantThreadSummary(db, thread.sessionId, thread.thread)
                }
                break
            case 'thread.updated': {
                if (thread) {
                    upsertAssistantThreadSummary(db, thread.sessionId, thread.thread)
                    const patch = (event.payload['patch'] as Record<string, unknown> | undefined) || {}
                    if (Object.prototype.hasOwnProperty.call(patch, 'messages')) replaceAssistantMessages(db, thread.thread)
                    if (Object.prototype.hasOwnProperty.call(patch, 'activities')) replaceAssistantActivities(db, thread.thread)
                    if (Object.prototype.hasOwnProperty.call(patch, 'proposedPlans')) replaceAssistantProposedPlans(db, thread.thread)
                    if (Object.prototype.hasOwnProperty.call(patch, 'pendingApprovals')) replaceAssistantPendingApprovals(db, thread.thread)
                    if (Object.prototype.hasOwnProperty.call(patch, 'pendingUserInputs')) replaceAssistantPendingUserInputs(db, thread.thread)
                }
                if (session) upsertAssistantSession(db, session)
                break
            }
            case 'thread.message.user':
            case 'thread.message.assistant.delta':
            case 'thread.message.assistant.completed':
                if (thread) {
                    upsertAssistantThreadSummary(db, thread.sessionId, thread.thread)
                    const payloadMessage = event.payload['message'] as Record<string, unknown> | undefined
                    const messageId = String(event.payload['messageId'] || payloadMessage?.['id'] || '')
                    const message = thread.thread.messages.find((entry) => entry.id === messageId)
                        || (event.type === 'thread.message.user' ? payloadMessage as unknown as AssistantMessage : null)
                    if (message) upsertAssistantMessage(db, thread.thread.id, message)
                }
                break
            case 'thread.plan.updated':
            case 'thread.latest-turn.updated':
                if (thread) upsertAssistantThreadSummary(db, thread.sessionId, thread.thread)
                break
            case 'thread.proposed-plan.upserted':
                if (thread) {
                    upsertAssistantThreadSummary(db, thread.sessionId, thread.thread)
                    const payloadPlan = event.payload['plan'] as Record<string, unknown> | undefined
                    const plan = thread.thread.proposedPlans.find((entry) => entry.id === String(payloadPlan?.['id'] || ''))
                    if (plan) upsertAssistantProposedPlan(db, thread.thread.id, plan)
                }
                break
            case 'thread.activity.appended':
                if (thread) {
                    upsertAssistantThreadSummary(db, thread.sessionId, thread.thread)
                    const payloadActivity = event.payload['activity'] as Record<string, unknown> | undefined
                    const activity = thread.thread.activities.find((entry) => entry.id === String(payloadActivity?.['id'] || ''))
                    if (activity) upsertAssistantActivity(db, thread.thread.id, activity)
                }
                break
            case 'thread.approval.updated':
                if (thread) {
                    upsertAssistantThreadSummary(db, thread.sessionId, thread.thread)
                    const payloadApproval = event.payload['approval'] as Record<string, unknown> | undefined
                    const approval = thread.thread.pendingApprovals.find((entry) => entry.requestId === String(payloadApproval?.['requestId'] || ''))
                    if (approval) upsertAssistantPendingApproval(db, thread.thread.id, approval)
                }
                break
            case 'thread.user-input.updated':
                if (thread) {
                    upsertAssistantThreadSummary(db, thread.sessionId, thread.thread)
                    const payloadUserInput = event.payload['userInput'] as Record<string, unknown> | undefined
                    const userInput = thread.thread.pendingUserInputs.find((entry) => entry.requestId === String(payloadUserInput?.['requestId'] || ''))
                    if (userInput) upsertAssistantPendingUserInput(db, thread.thread.id, userInput)
                }
                break
        }
    })
}

export function replaceAssistantSnapshot(db: SqlDatabase, snapshot: AssistantSnapshot): void {
    runSqlTransaction(db, () => {
        db.run('DELETE FROM assistant_pending_user_inputs')
        db.run('DELETE FROM assistant_pending_approvals')
        db.run('DELETE FROM assistant_proposed_plans')
        db.run('DELETE FROM assistant_activities')
        db.run('DELETE FROM assistant_messages')
        db.run('DELETE FROM assistant_threads')
        db.run('DELETE FROM assistant_sessions')

        persistAssistantSnapshotMeta(db, snapshot)
        for (const session of snapshot.sessions) {
            upsertAssistantSession(db, session)
            for (const thread of session.threads) {
                upsertAssistantThreadSummary(db, session.id, thread)
                replaceAssistantMessages(db, thread)
                replaceAssistantActivities(db, thread)
                replaceAssistantProposedPlans(db, thread)
                replaceAssistantPendingApprovals(db, thread)
                replaceAssistantPendingUserInputs(db, thread)
            }
        }
    })
}

export function persistAssistantSnapshotMeta(db: SqlDatabase, snapshot: AssistantSnapshot): void {
    upsertAssistantMeta(db, 'persistenceVersion', String(PERSISTENCE_VERSION))
    upsertAssistantMeta(db, 'snapshotSequence', String(snapshot.snapshotSequence))
    upsertAssistantMeta(db, 'updatedAt', snapshot.updatedAt)
    upsertAssistantMeta(db, 'selectedSessionId', snapshot.selectedSessionId || '')
    upsertAssistantMeta(db, 'knownModels', jsonStringify(snapshot.knownModels))
}

export function upsertAssistantMeta(db: SqlDatabase, key: string, value: string): void {
    db.run('INSERT OR REPLACE INTO assistant_meta (key, value) VALUES (?, ?)', [key, value])
}

function upsertAssistantSession(db: SqlDatabase, session: AssistantSession): void {
    db.run(`
        INSERT INTO assistant_sessions (id, title, project_path, archived, created_at, updated_at, active_thread_id)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
            title = excluded.title,
            project_path = excluded.project_path,
            archived = excluded.archived,
            created_at = excluded.created_at,
            updated_at = excluded.updated_at,
            active_thread_id = excluded.active_thread_id
    `, [
        session.id,
        session.title,
        session.projectPath,
        sqlBool(session.archived),
        session.createdAt,
        session.updatedAt,
        session.activeThreadId
    ])
}

function upsertAssistantThreadSummary(db: SqlDatabase, sessionId: string, thread: AssistantThread): void {
    db.run(`
        INSERT INTO assistant_threads (
            id, session_id, provider_thread_id, model, cwd, message_count, last_seen_completed_turn_id,
            runtime_mode, interaction_mode, state, last_error, created_at, updated_at, latest_turn_json, active_plan_json
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
            session_id = excluded.session_id,
            provider_thread_id = excluded.provider_thread_id,
            model = excluded.model,
            cwd = excluded.cwd,
            message_count = excluded.message_count,
            last_seen_completed_turn_id = excluded.last_seen_completed_turn_id,
            runtime_mode = excluded.runtime_mode,
            interaction_mode = excluded.interaction_mode,
            state = excluded.state,
            last_error = excluded.last_error,
            created_at = excluded.created_at,
            updated_at = excluded.updated_at,
            latest_turn_json = excluded.latest_turn_json,
            active_plan_json = excluded.active_plan_json
    `, [
        thread.id,
        sessionId,
        thread.providerThreadId,
        thread.model,
        thread.cwd,
        thread.messageCount,
        thread.lastSeenCompletedTurnId,
        thread.runtimeMode,
        thread.interactionMode,
        thread.state,
        thread.lastError,
        thread.createdAt,
        thread.updatedAt,
        jsonStringify(thread.latestTurn),
        jsonStringify(thread.activePlan)
    ])
}

function replaceAssistantMessages(db: SqlDatabase, thread: AssistantThread): void {
    db.run('DELETE FROM assistant_messages WHERE thread_id = ?', [thread.id])
    for (const message of thread.messages) upsertAssistantMessage(db, thread.id, message)
}

function replaceAssistantActivities(db: SqlDatabase, thread: AssistantThread): void {
    db.run('DELETE FROM assistant_activities WHERE thread_id = ?', [thread.id])
    for (const activity of thread.activities) upsertAssistantActivity(db, thread.id, activity)
}

function replaceAssistantProposedPlans(db: SqlDatabase, thread: AssistantThread): void {
    db.run('DELETE FROM assistant_proposed_plans WHERE thread_id = ?', [thread.id])
    for (const plan of thread.proposedPlans) upsertAssistantProposedPlan(db, thread.id, plan)
}

function replaceAssistantPendingApprovals(db: SqlDatabase, thread: AssistantThread): void {
    db.run('DELETE FROM assistant_pending_approvals WHERE thread_id = ?', [thread.id])
    for (const approval of thread.pendingApprovals) upsertAssistantPendingApproval(db, thread.id, approval)
}

function replaceAssistantPendingUserInputs(db: SqlDatabase, thread: AssistantThread): void {
    db.run('DELETE FROM assistant_pending_user_inputs WHERE thread_id = ?', [thread.id])
    for (const input of thread.pendingUserInputs) upsertAssistantPendingUserInput(db, thread.id, input)
}

function upsertAssistantMessage(db: SqlDatabase, threadId: string, message: AssistantMessage): void {
    db.run(`
        INSERT INTO assistant_messages (id, thread_id, role, text, turn_id, streaming, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
            thread_id = excluded.thread_id,
            role = excluded.role,
            text = excluded.text,
            turn_id = excluded.turn_id,
            streaming = excluded.streaming,
            created_at = excluded.created_at,
            updated_at = excluded.updated_at
    `, [message.id, threadId, message.role, message.text, message.turnId, sqlBool(message.streaming), message.createdAt, message.updatedAt])
}

function upsertAssistantActivity(db: SqlDatabase, threadId: string, activity: AssistantActivity): void {
    db.run(`
        INSERT INTO assistant_activities (id, thread_id, kind, tone, summary, detail, turn_id, created_at, payload_json)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
            thread_id = excluded.thread_id,
            kind = excluded.kind,
            tone = excluded.tone,
            summary = excluded.summary,
            detail = excluded.detail,
            turn_id = excluded.turn_id,
            created_at = excluded.created_at,
            payload_json = excluded.payload_json
    `, [activity.id, threadId, activity.kind, activity.tone, activity.summary, activity.detail || null, activity.turnId, activity.createdAt, jsonStringify(activity.payload)])
}

function upsertAssistantProposedPlan(db: SqlDatabase, threadId: string, plan: AssistantProposedPlan): void {
    db.run(`
        INSERT INTO assistant_proposed_plans (id, thread_id, turn_id, plan_markdown, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
            thread_id = excluded.thread_id,
            turn_id = excluded.turn_id,
            plan_markdown = excluded.plan_markdown,
            created_at = excluded.created_at,
            updated_at = excluded.updated_at
    `, [plan.id, threadId, plan.turnId, plan.planMarkdown, plan.createdAt, plan.updatedAt])
}

function upsertAssistantPendingApproval(db: SqlDatabase, threadId: string, approval: AssistantPendingApproval): void {
    db.run(`
        INSERT INTO assistant_pending_approvals (
            id, thread_id, request_id, request_type, title, detail, command, paths_json, status, decision, turn_id, created_at, resolved_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(request_id) DO UPDATE SET
            id = excluded.id,
            thread_id = excluded.thread_id,
            request_type = excluded.request_type,
            title = excluded.title,
            detail = excluded.detail,
            command = excluded.command,
            paths_json = excluded.paths_json,
            status = excluded.status,
            decision = excluded.decision,
            turn_id = excluded.turn_id,
            created_at = excluded.created_at,
            resolved_at = excluded.resolved_at
    `, [
        approval.id,
        threadId,
        approval.requestId,
        approval.requestType,
        approval.title || null,
        approval.detail || null,
        approval.command || null,
        jsonStringify(approval.paths),
        approval.status,
        approval.decision,
        approval.turnId,
        approval.createdAt,
        approval.resolvedAt
    ])
}

function upsertAssistantPendingUserInput(db: SqlDatabase, threadId: string, input: AssistantPendingUserInput): void {
    db.run(`
        INSERT INTO assistant_pending_user_inputs (
            id, thread_id, request_id, questions_json, status, answers_json, turn_id, created_at, resolved_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(request_id) DO UPDATE SET
            id = excluded.id,
            thread_id = excluded.thread_id,
            questions_json = excluded.questions_json,
            status = excluded.status,
            answers_json = excluded.answers_json,
            turn_id = excluded.turn_id,
            created_at = excluded.created_at,
            resolved_at = excluded.resolved_at
    `, [
        input.id,
        threadId,
        input.requestId,
        jsonStringify(input.questions),
        input.status,
        jsonStringify(input.answers),
        input.turnId,
        input.createdAt,
        input.resolvedAt
    ])
}
