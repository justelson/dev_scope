import { app } from 'electron'
import { existsSync, mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import log from 'electron-log'
import type { AssistantDomainEvent, AssistantSnapshot } from '../../shared/assistant/contracts'
import { createDefaultSnapshot, recoverPersistedSnapshot } from './projector'

interface AssistantPersistenceRecord {
    version: number
    snapshot: AssistantSnapshot
    events: AssistantDomainEvent[]
}

const PERSISTENCE_VERSION = 1

function defaultRecord(): AssistantPersistenceRecord {
    return {
        version: PERSISTENCE_VERSION,
        snapshot: createDefaultSnapshot(),
        events: []
    }
}

export class AssistantPersistence {
    private readonly filePath: string
    private readonly tempPath: string
    private writeTimer: NodeJS.Timeout | null = null
    private latestRecord: AssistantPersistenceRecord = defaultRecord()

    constructor() {
        const assistantDir = join(app.getPath('userData'), 'assistant')
        if (!existsSync(assistantDir)) {
            mkdirSync(assistantDir, { recursive: true })
        }
        this.filePath = join(assistantDir, 'assistant-state.json')
        this.tempPath = `${this.filePath}.tmp`
    }

    load(): AssistantPersistenceRecord {
        try {
            if (!existsSync(this.filePath)) {
                this.latestRecord = defaultRecord()
                return this.latestRecord
            }

            const raw = readFileSync(this.filePath, 'utf8')
            const parsed = JSON.parse(raw) as Partial<AssistantPersistenceRecord>
            const record: AssistantPersistenceRecord = {
                version: parsed.version === PERSISTENCE_VERSION ? PERSISTENCE_VERSION : PERSISTENCE_VERSION,
                snapshot: recoverPersistedSnapshot(parsed.snapshot || createDefaultSnapshot()),
                events: Array.isArray(parsed.events) ? parsed.events : []
            }
            this.latestRecord = record
            return record
        } catch (error) {
            log.error('[AssistantPersistence] Failed to load state.', error)
            this.latestRecord = defaultRecord()
            return this.latestRecord
        }
    }

    replace(record: AssistantPersistenceRecord): void {
        this.latestRecord = record
        this.scheduleWrite()
    }

    flush(): void {
        if (this.writeTimer) {
            clearTimeout(this.writeTimer)
            this.writeTimer = null
        }
        this.writeNow()
    }

    private scheduleWrite(): void {
        if (this.writeTimer) {
            clearTimeout(this.writeTimer)
        }
        this.writeTimer = setTimeout(() => {
            this.writeTimer = null
            this.writeNow()
        }, 120)
    }

    private writeNow(): void {
        try {
            writeFileSync(this.tempPath, JSON.stringify(this.latestRecord, null, 2), 'utf8')
            renameSync(this.tempPath, this.filePath)
        } catch (error) {
            log.error('[AssistantPersistence] Failed to persist assistant state.', error)
            try {
                unlinkSync(this.tempPath)
            } catch {
                // Ignore cleanup failures.
            }
        }
    }
}

