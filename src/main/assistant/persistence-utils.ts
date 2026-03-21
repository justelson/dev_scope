import type { Database as SqlDatabase, SqlValue } from 'sql.js/dist/sql-asm.js'
import type {
    AssistantDomainEvent,
    AssistantSession,
    AssistantSnapshot
} from '../../shared/assistant/contracts'

export interface AssistantPersistenceRecord {
    version: number
    snapshot: AssistantSnapshot
    events: AssistantDomainEvent[]
}

export interface AssistantMetaRow {
    snapshotSequence: number
    updatedAt: string
    selectedSessionId: string | null
    knownModels: AssistantSnapshot['knownModels']
}

export const PERSISTENCE_VERSION = 3
export const PERSISTENCE_FLUSH_DEBOUNCE_MS = 1500

export function jsonStringify(value: unknown): string {
    return JSON.stringify(value ?? null)
}

export function parseJson<T>(value: SqlValue, fallback: T): T {
    if (typeof value !== 'string' || !value) return fallback
    try {
        return JSON.parse(value) as T
    } catch {
        return fallback
    }
}

export function sqlBool(value: boolean): number {
    return value ? 1 : 0
}

export function toNullableString(value: SqlValue): string | null {
    return typeof value === 'string' && value.length > 0 ? value : null
}

export function toNumber(value: SqlValue, fallback = 0): number {
    return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function normalizeAssistantPath(value?: string | null): string {
    return String(value || '').trim()
}

function resolveSessionProjectPath(session: AssistantSession): string {
    if (normalizeAssistantPath(session.projectPath)) return normalizeAssistantPath(session.projectPath)
    for (const thread of session.threads) {
        const cwd = normalizeAssistantPath(thread.cwd)
        if (cwd) return cwd
    }
    return ''
}

function hasSessionMessages(session: AssistantSession): boolean {
    return session.threads.some((thread) => {
        const summarizedCount = Number.isFinite(thread.messageCount) ? thread.messageCount : 0
        return summarizedCount > 0 || thread.messages.length > 0
    })
}

export function shouldDeleteInvalidSession(session: AssistantSession): boolean {
    return !resolveSessionProjectPath(session) && !hasSessionMessages(session)
}

export function runSqlTransaction(db: SqlDatabase, work: () => void): void {
    db.run('BEGIN')
    try {
        work()
        db.run('COMMIT')
    } catch (error) {
        db.run('ROLLBACK')
        throw error
    }
}

export function initializeAssistantPersistenceSchema(db: SqlDatabase): void {
    db.run('PRAGMA foreign_keys = ON;')
    db.run(`
        CREATE TABLE IF NOT EXISTS assistant_meta (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS assistant_sessions (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            project_path TEXT,
            archived INTEGER NOT NULL,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            active_thread_id TEXT
        );
        CREATE TABLE IF NOT EXISTS assistant_threads (
            id TEXT PRIMARY KEY,
            session_id TEXT NOT NULL,
            provider_thread_id TEXT,
            model TEXT NOT NULL,
            cwd TEXT,
            message_count INTEGER NOT NULL,
            last_seen_completed_turn_id TEXT,
            runtime_mode TEXT NOT NULL,
            interaction_mode TEXT NOT NULL,
            state TEXT NOT NULL,
            last_error TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            latest_turn_json TEXT,
            active_plan_json TEXT,
            FOREIGN KEY(session_id) REFERENCES assistant_sessions(id) ON DELETE CASCADE
        );
        CREATE TABLE IF NOT EXISTS assistant_messages (
            id TEXT PRIMARY KEY,
            thread_id TEXT NOT NULL,
            role TEXT NOT NULL,
            text TEXT NOT NULL,
            turn_id TEXT,
            streaming INTEGER NOT NULL,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            FOREIGN KEY(thread_id) REFERENCES assistant_threads(id) ON DELETE CASCADE
        );
        CREATE TABLE IF NOT EXISTS assistant_activities (
            id TEXT PRIMARY KEY,
            thread_id TEXT NOT NULL,
            kind TEXT NOT NULL,
            tone TEXT NOT NULL,
            summary TEXT NOT NULL,
            detail TEXT,
            turn_id TEXT,
            created_at TEXT NOT NULL,
            payload_json TEXT,
            FOREIGN KEY(thread_id) REFERENCES assistant_threads(id) ON DELETE CASCADE
        );
        CREATE TABLE IF NOT EXISTS assistant_proposed_plans (
            id TEXT PRIMARY KEY,
            thread_id TEXT NOT NULL,
            turn_id TEXT,
            plan_markdown TEXT NOT NULL,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            FOREIGN KEY(thread_id) REFERENCES assistant_threads(id) ON DELETE CASCADE
        );
        CREATE TABLE IF NOT EXISTS assistant_pending_approvals (
            id TEXT PRIMARY KEY,
            thread_id TEXT NOT NULL,
            request_id TEXT NOT NULL UNIQUE,
            request_type TEXT NOT NULL,
            title TEXT,
            detail TEXT,
            command TEXT,
            paths_json TEXT,
            status TEXT NOT NULL,
            decision TEXT,
            turn_id TEXT,
            created_at TEXT NOT NULL,
            resolved_at TEXT,
            FOREIGN KEY(thread_id) REFERENCES assistant_threads(id) ON DELETE CASCADE
        );
        CREATE TABLE IF NOT EXISTS assistant_pending_user_inputs (
            id TEXT PRIMARY KEY,
            thread_id TEXT NOT NULL,
            request_id TEXT NOT NULL UNIQUE,
            questions_json TEXT NOT NULL,
            status TEXT NOT NULL,
            answers_json TEXT,
            turn_id TEXT,
            created_at TEXT NOT NULL,
            resolved_at TEXT,
            FOREIGN KEY(thread_id) REFERENCES assistant_threads(id) ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS idx_assistant_threads_session ON assistant_threads(session_id, updated_at DESC, id DESC);
        CREATE INDEX IF NOT EXISTS idx_assistant_messages_thread ON assistant_messages(thread_id, created_at ASC, id ASC);
        CREATE INDEX IF NOT EXISTS idx_assistant_activities_thread ON assistant_activities(thread_id, created_at ASC, id ASC);
        CREATE INDEX IF NOT EXISTS idx_assistant_plans_thread ON assistant_proposed_plans(thread_id, created_at ASC, id ASC);
        CREATE INDEX IF NOT EXISTS idx_assistant_approvals_thread ON assistant_pending_approvals(thread_id, created_at ASC, id ASC);
        CREATE INDEX IF NOT EXISTS idx_assistant_user_inputs_thread ON assistant_pending_user_inputs(thread_id, created_at ASC, id ASC);
    `)
}
