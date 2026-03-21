export function asRecord(value: unknown): Record<string, unknown> | undefined {
    return value && typeof value === 'object' ? value as Record<string, unknown> : undefined
}

export function asString(value: unknown): string | undefined {
    return typeof value === 'string' ? value : undefined
}

const PATH_VALUE_KEYS = [
    'path',
    'filePath',
    'targetPath',
    'sourcePath',
    'destinationPath',
    'oldPath',
    'newPath',
    'file_path',
    'target_path',
    'source_path',
    'destination_path',
    'old_path',
    'new_path',
    'relativePath',
    'absolutePath'
] as const

const PATCH_TEXT_KEYS = new Set([
    'patch',
    'diff',
    'content',
    'text',
    'input',
    'output',
    'stdout',
    'stderr',
    'result',
    'response',
    'changes',
    'edits',
    'arguments'
])

const FILE_CHANGE_ADDITION_KEYS = ['additions', 'insertions', 'added', 'addedLines', 'linesAdded', 'lines_added'] as const
const FILE_CHANGE_DELETION_KEYS = ['deletions', 'removals', 'removed', 'deletedLines', 'linesDeleted', 'lines_deleted'] as const
const FILE_CHANGE_COUNT_KEYS = ['fileCount', 'filesChanged', 'changedFiles', 'count', 'file_count'] as const

function normalizeExtractedPath(value: string, options?: { stripDiffPrefix?: boolean }): string | undefined {
    let candidate = String(value || '').trim()
    if (!candidate) return undefined
    candidate = candidate.replace(/^['"`]+|['"`]+$/g, '').trim()
    if (!candidate || candidate === '/dev/null') return undefined
    if (options?.stripDiffPrefix) {
        candidate = candidate.replace(/^[ab]\//, '')
    }
    return candidate || undefined
}

function extractPathsFromText(value: unknown): string[] {
    const text = readTextValue(value)
    if (!text) return []

    const matches = new Set<string>()
    const normalizedText = text.replace(/\r\n/g, '\n')
    const addPath = (candidate: string | undefined, stripDiffPrefix = false) => {
        const normalizedPath = normalizeExtractedPath(candidate || '', { stripDiffPrefix })
        if (normalizedPath) matches.add(normalizedPath)
    }

    for (const match of normalizedText.matchAll(/^\*\*\* (?:Update|Add|Delete) File:\s+(.+)$/gm)) {
        addPath(match[1])
    }
    for (const match of normalizedText.matchAll(/^\*\*\* Move to:\s+(.+)$/gm)) {
        addPath(match[1])
    }
    for (const match of normalizedText.matchAll(/^diff --git a\/(.+?) b\/(.+)$/gm)) {
        addPath(match[1], true)
        addPath(match[2], true)
    }
    for (const match of normalizedText.matchAll(/^(?:\+\+\+|---)\s+(?:[ab]\/)?(.+)$/gm)) {
        addPath(match[1], true)
    }

    return [...matches]
}

function looksLikePatchText(value: string): boolean {
    return value.includes('diff --git ')
        || value.includes('@@ ')
        || value.includes('*** Update File:')
        || value.includes('*** Add File:')
        || value.includes('*** Delete File:')
        || value.includes('*** Move to:')
        || (value.includes('--- ') && value.includes('+++ '))
}

function readPatchText(value: unknown, seen = new WeakSet<object>(), depth = 0): string | undefined {
    if (depth > 6) return undefined
    if (typeof value === 'string') {
        const trimmed = value.trim()
        return looksLikePatchText(trimmed) ? trimmed : undefined
    }
    if (!value || typeof value !== 'object') return undefined
    if (seen.has(value)) return undefined
    seen.add(value)
    if (Array.isArray(value)) {
        for (const entry of value) {
            const nested = readPatchText(entry, seen, depth + 1)
            if (nested) return nested
        }
        return undefined
    }

    const record = asRecord(value)
    if (!record) return undefined
    for (const [key, entry] of Object.entries(record)) {
        if (!PATCH_TEXT_KEYS.has(key)) continue
        const nested = readPatchText(entry, seen, depth + 1)
        if (nested) return nested
    }
    for (const entry of Object.values(record)) {
        const nested = readPatchText(entry, seen, depth + 1)
        if (nested) return nested
    }
    return undefined
}

function readNestedNumericStat(
    value: unknown,
    keys: readonly string[],
    seen = new WeakSet<object>(),
    depth = 0
): number | undefined {
    if (depth > 6 || !value || typeof value !== 'object') return undefined
    if (seen.has(value)) return undefined
    seen.add(value)

    if (Array.isArray(value)) {
        let total = 0
        let found = false
        for (const entry of value) {
            const nested = readNestedNumericStat(entry, keys, seen, depth + 1)
            if (nested === undefined) continue
            total += nested
            found = true
        }
        return found ? total : undefined
    }

    const record = asRecord(value)
    if (!record) return undefined
    for (const key of keys) {
        const direct = readNumericValue(record[key])
        if (direct !== undefined) return direct
    }

    let total = 0
    let found = false
    for (const entry of Object.values(record)) {
        const nested = readNestedNumericStat(entry, keys, seen, depth + 1)
        if (nested === undefined) continue
        total += nested
        found = true
    }
    return found ? total : undefined
}

function collectItemPaths(value: unknown, target: Set<string>, seen = new WeakSet<object>(), depth = 0): void {
    if (depth > 6) return
    if (typeof value === 'string') {
        for (const candidate of extractPathsFromText(value)) {
            target.add(candidate)
        }
        return
    }
    if (!value || typeof value !== 'object') return
    if (seen.has(value)) return
    seen.add(value)

    if (Array.isArray(value)) {
        for (const entry of value) {
            collectItemPaths(entry, target, seen, depth + 1)
        }
        return
    }

    const record = asRecord(value)
    if (!record) return

    for (const key of PATH_VALUE_KEYS) {
        for (const candidate of readStringArray(record[key])) {
            target.add(candidate)
        }
    }
    for (const [key, entry] of Object.entries(record)) {
        if (PATCH_TEXT_KEYS.has(key)) {
            for (const candidate of extractPathsFromText(entry)) {
                target.add(candidate)
            }
        }
        collectItemPaths(entry, target, seen, depth + 1)
    }
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
        const normalized = normalizeExtractedPath(value)
        return normalized ? [normalized] : []
    }
    if (!Array.isArray(value)) return []
    return value
        .map((entry) => {
            if (typeof entry === 'string') return entry.trim()
            const record = asRecord(entry)
            return asString(record?.['path'])?.trim()
                || asString(record?.['filePath'])?.trim()
                || asString(record?.['targetPath'])?.trim()
                || asString(record?.['sourcePath'])?.trim()
                || asString(record?.['destinationPath'])?.trim()
                || asString(record?.['oldPath'])?.trim()
                || asString(record?.['newPath'])?.trim()
                || asString(record?.['file_path'])?.trim()
                || asString(record?.['target_path'])?.trim()
                || asString(record?.['source_path'])?.trim()
                || asString(record?.['destination_path'])?.trim()
                || asString(record?.['old_path'])?.trim()
                || asString(record?.['new_path'])?.trim()
                || asString(record?.['relativePath'])?.trim()
                || asString(record?.['absolutePath'])?.trim()
                || asString(record?.['name'])?.trim()
                || ''
        })
        .map((entry) => normalizeExtractedPath(entry || ''))
        .filter((entry): entry is string => Boolean(entry))
}

export function extractItemPaths(item: Record<string, unknown>): string[] {
    const candidates = new Set<string>([
        ...readStringArray(item['path']),
        ...readStringArray(item['filePath']),
        ...readStringArray(item['targetPath']),
        ...readStringArray(item['sourcePath']),
        ...readStringArray(item['destinationPath']),
        ...readStringArray(item['oldPath']),
        ...readStringArray(item['newPath']),
        ...readStringArray(item['paths']),
        ...readStringArray(item['files'])
    ])
    collectItemPaths(item, candidates)
    return [...candidates]
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

function readPatchSummary(value: unknown): { additions: number; deletions: number; fileCount: number } | null {
    const text = readPatchText(value)
    if (!text) return null

    const normalized = text.replace(/\r\n/g, '\n')
    let additions = 0
    let deletions = 0
    const pathCandidates = new Set<string>(extractPathsFromText(normalized))

    for (const line of normalized.split('\n')) {
        if (line.startsWith('diff --git ')) continue
        if (line.startsWith('+++ ') || line.startsWith('--- ')) continue
        if (line.startsWith('+')) {
            additions += 1
            continue
        }
        if (line.startsWith('-')) {
            deletions += 1
        }
    }

    let fileCount = pathCandidates.size
    if (fileCount === 0 && (additions > 0 || deletions > 0)) {
        fileCount = 1
    }

    return { additions, deletions, fileCount }
}

function readCreatedFilePaths(value: unknown): string[] {
    const patchText = readPatchText(value)
    if (!patchText) return []

    const matches = new Set<string>()
    const normalizedText = patchText.replace(/\r\n/g, '\n')
    const addPath = (candidate: string | undefined, stripDiffPrefix = false) => {
        const normalizedPath = normalizeExtractedPath(candidate || '', { stripDiffPrefix })
        if (normalizedPath) matches.add(normalizedPath)
    }

    for (const match of normalizedText.matchAll(/^\*\*\* Add File:\s+(.+)$/gm)) {
        addPath(match[1])
    }

    let pendingCreatedFromDevNull = false
    for (const line of normalizedText.split('\n')) {
        if (line.startsWith('--- /dev/null')) {
            pendingCreatedFromDevNull = true
            continue
        }
        if (!pendingCreatedFromDevNull) continue
        const nextFileMatch = /^(?:\+\+\+)\s+(?:[ab]\/)?(.+)$/.exec(line)
        if (nextFileMatch) {
            addPath(nextFileMatch[1], true)
            pendingCreatedFromDevNull = false
            continue
        }
        if (line.trim()) pendingCreatedFromDevNull = false
    }

    return [...matches]
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
        const patchSummary = readPatchSummary(item)
        const patch = readPatchText(item)
        const createdPaths = readCreatedFilePaths(item)
        const additions = readNestedNumericStat(item, FILE_CHANGE_ADDITION_KEYS) ?? patchSummary?.additions
        const deletions = readNestedNumericStat(item, FILE_CHANGE_DELETION_KEYS) ?? patchSummary?.deletions
        const fileCount = readNestedNumericStat(item, FILE_CHANGE_COUNT_KEYS) ?? patchSummary?.fileCount ?? (paths.length > 0 ? paths.length : undefined)
        return {
            kind: 'file-change',
            summary: paths.length > 1 ? 'Edited files' : 'Edited file',
            detail: paths.join('\n') || detail,
            tone: 'tool',
            data: {
                itemType,
                paths,
                createdPaths,
                patch,
                additions,
                deletions,
                fileCount,
                startedAt: timing.startedAt,
                completedAt: timing.completedAt,
                durationMs: timing.durationMs
            }
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
