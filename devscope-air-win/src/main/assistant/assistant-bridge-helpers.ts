import type { AssistantModelInfo } from './types'

export function now(): number {
    return Date.now()
}

export function createId(prefix: string): string {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

export function isServerRequestMessage(message: Record<string, unknown>): boolean {
    return Object.prototype.hasOwnProperty.call(message, 'id')
        && Object.prototype.hasOwnProperty.call(message, 'method')
        && !Object.prototype.hasOwnProperty.call(message, 'result')
        && !Object.prototype.hasOwnProperty.call(message, 'error')
}

export function extractTurnIdFromParams(params: Record<string, unknown> | undefined): string | null {
    if (!params) return null
    const direct = params.turnId
    if (typeof direct === 'string' && direct.trim()) return direct

    const turn = params.turn
    if (turn && typeof turn === 'object') {
        const turnId = (turn as Record<string, unknown>).id
        if (typeof turnId === 'string' && turnId.trim()) return turnId
    }
    return null
}

export function extractLegacyTurnId(params: Record<string, unknown> | undefined): string | null {
    if (!params) return null
    const msg = params.msg
    if (!msg || typeof msg !== 'object') return null
    const payload = (msg as Record<string, unknown>).payload
    if (!payload || typeof payload !== 'object') return null
    const raw = (payload as Record<string, unknown>).turn_id
    if (typeof raw === 'string' && raw.trim()) return raw
    return null
}

export function readString(value: unknown): string {
    return typeof value === 'string' ? value : ''
}

export function readRecord(value: unknown): Record<string, unknown> | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null
    return value as Record<string, unknown>
}

export function extractTurnError(params: Record<string, unknown>): string {
    const direct = readString(params.error).trim()
    if (direct) return direct

    const turn = readRecord(params.turn)
    const fromTurn = readString(turn?.error).trim()
    if (fromTurn) return fromTurn

    const details = readRecord(turn?.details)
    const fromDetails = readString(details?.message).trim()
    if (fromDetails) return fromDetails

    return ''
}

export function normalizeToken(value: string): string {
    return value.replace(/[^a-z]/gi, '').toLowerCase()
}

function isAssistantLikeRole(value: unknown): boolean {
    const normalized = normalizeToken(readString(value))
    return normalized === 'assistant' || normalized === 'agent' || normalized === 'model'
}

function isAssistantMessageItem(item: Record<string, unknown>): boolean {
    const itemType = normalizeToken(readString(item.type))
    if (
        itemType === 'agentmessage'
        || itemType === 'assistantmessage'
        || itemType === 'message'
    ) {
        return true
    }

    return isAssistantLikeRole(item.role) || isAssistantLikeRole(item.author)
}

export function readTextFromContent(value: unknown): string {
    if (!value) return ''
    if (typeof value === 'string') return value

    if (Array.isArray(value)) {
        return value.map((entry) => readTextFromContent(entry)).join('')
    }

    const record = readRecord(value)
    if (!record) return ''

    const direct = readString(record.text) || readString(record.value) || readString(record.message)
    if (direct) return direct

    return readTextFromContent(record.content || record.parts || record.output)
}

export function extractCompletedAgentText(params: Record<string, unknown>): string {
    const item = readRecord(params.item)
    if (!item || !isAssistantMessageItem(item)) {
        return ''
    }

    const directText = readString(item.text).trim()
    if (directText) return directText

    const contentText = readTextFromContent(item.content || item.parts).trim()
    if (contentText) return contentText

    return readString(item.message).trim()
}

export function extractCompletedAgentPhase(params: Record<string, unknown>): string {
    const item = readRecord(params.item)
    if (!item) return ''
    return readString(item.phase).trim()
}

export function extractAgentMessageDeltaPhase(params: Record<string, unknown>): string {
    const item = readRecord(params.item)
    const phase = readString(item?.phase).trim() || readString(params.phase).trim()
    return phase
}

export function extractAgentMessageDeltaItemType(params: Record<string, unknown>): string {
    const item = readRecord(params.item)
    return normalizeToken(readString(item?.type).trim())
}

export function shouldTreatAgentDeltaAsProvisional(params: Record<string, unknown>): boolean {
    const itemType = extractAgentMessageDeltaItemType(params)
    if (itemType === 'reasoning') return true

    const phase = extractAgentMessageDeltaPhase(params)
    if (!phase) return true

    return !isFinalAnswerPhase(phase)
}

function longestSuffixPrefixOverlap(base: string, next: string): number {
    const left = String(base || '')
    const right = String(next || '')
    if (!left || !right) return 0

    const maxProbe = Math.min(left.length, right.length, 320)
    for (let size = maxProbe; size >= 1; size -= 1) {
        if (left.slice(-size) === right.slice(0, size)) {
            return size
        }
    }
    return 0
}

function appendChunkText(base: string, chunk: string): string {
    const left = String(base || '')
    const right = String(chunk || '')
    if (!left) return right
    if (!right) return left

    const needsSpace = /[A-Za-z0-9]$/.test(left) && /^[A-Za-z0-9]/.test(right)
    return needsSpace ? `${left} ${right}` : `${left}${right}`
}

export function mergeAgentMessageDraft(
    current: string,
    incoming: string,
    options?: { preferReplaceForDisjointLong?: boolean }
): string {
    const existing = String(current || '')
    const next = String(incoming || '')
    if (!next) return existing
    if (!existing) return next
    if (next === existing) return existing

    if (next.startsWith(existing) || next.includes(existing)) {
        return next
    }
    if (existing.startsWith(next)) {
        const looksLikeSnapshotCorrection = next.length >= Math.max(24, Math.floor(existing.length * 0.6))
        if (looksLikeSnapshotCorrection) {
            return next
        }
    }

    const overlap = longestSuffixPrefixOverlap(existing, next)
    if (overlap > 0) {
        return `${existing}${next.slice(overlap)}`
    }

    const tokenLike = next.length <= 22 || !/\s/.test(next)
    if (tokenLike) {
        return appendChunkText(existing, next)
    }

    if (options?.preferReplaceForDisjointLong) {
        return next
    }

    return appendChunkText(existing, next)
}

export function isFinalAnswerPhase(phase: string): boolean {
    const normalized = normalizeToken(String(phase || ''))
    return normalized === 'final'
        || normalized === 'finalanswer'
        || normalized === 'answer'
        || normalized === 'finalresponse'
}

function normalizeModelId(value: string): string {
    return value.replace(/^models\//i, '').trim().toLowerCase()
}

function collectModelCapabilities(value: unknown): string[] | undefined {
    const source = value
    if (!Array.isArray(source)) return undefined

    const capabilities = source
        .map((capability) => {
            if (typeof capability === 'string') return capability.trim()
            const capRecord = readRecord(capability)
            return readString(capRecord?.id || capRecord?.name || capRecord?.label).trim()
        })
        .filter(Boolean)

    if (capabilities.length === 0) return undefined

    return Array.from(new Set(capabilities))
}

function parseModelEntry(raw: unknown, fallbackId = ''): AssistantModelInfo | null {
    if (typeof raw === 'string') {
        const id = raw.trim()
        if (!id) return null
        return { id, label: id, isDefault: false }
    }

    const entry = readRecord(raw)
    if (!entry) return null

    const id = readString(
        entry.model
        || entry.id
        || entry.modelId
        || entry.slug
        || entry.name
    ).trim() || fallbackId.trim()
    if (!id) return null

    const label = readString(
        entry.displayName
        || entry.label
        || entry.title
        || entry.name
        || entry.model
        || entry.id
    ).trim() || id

    const capabilities = collectModelCapabilities(
        entry.capabilities
        || entry.tags
        || entry.modalities
        || entry.supportedMethods
        || entry.features
    )

    return {
        id,
        label,
        isDefault: Boolean(entry.isDefault || entry.default || entry.recommended),
        capabilities
    }
}

function collectModelContainers(root: unknown): Array<{ value: unknown; source: string }> {
    const containers: Array<{ value: unknown; source: string }> = []
    const visited = new Set<unknown>()

    const push = (value: unknown, source: string) => {
        if (!value) return
        containers.push({ value, source })
    }

    const walk = (node: unknown, path: string, depth: number) => {
        if (!node || depth < 0) return
        if (visited.has(node)) return
        if (typeof node !== 'object') return
        visited.add(node)

        if (Array.isArray(node)) {
            if (path === 'result' || /(models?|items?|list|catalog|registry|available|options?|choices|supported|allowed)/i.test(path)) {
                push(node, path)
            }
            if (depth <= 0) return
            for (let index = 0; index < node.length; index += 1) {
                walk(node[index], `${path}[${index}]`, depth - 1)
            }
            return
        }

        const record = readRecord(node)
        if (!record) return
        for (const [key, child] of Object.entries(record)) {
            const childPath = path ? `${path}.${key}` : key
            const normalizedKey = key.toLowerCase()
            const keyLooksModelContainer = /(models|items|list|catalog|registry|map|bymodel|bymodels|byprovider|available|options?|choices|supported|allowed)/i.test(normalizedKey)
            const keyLooksSingleModel = normalizedKey === 'model'
                || normalizedKey === 'defaultmodel'
                || normalizedKey === 'recommendedmodel'
                || normalizedKey === 'activemodel'
            const keyAllowsTraversal = keyLooksModelContainer
                || keyLooksSingleModel
                || /(data|result|payload|response|provider|providers|meta|output|resources)/i.test(normalizedKey)
                || /(providers?|byprovider|models?|catalog|registry)/i.test(path)
                || path === 'result'
            if (!keyAllowsTraversal) continue

            if (keyLooksModelContainer || keyLooksSingleModel) {
                push(child, childPath)
            }
            walk(child, childPath, depth - 1)
        }
    }

    walk(root, 'result', 6)
    return containers
}

export function parseModelList(result: unknown): AssistantModelInfo[] {
    const root = readRecord(result)
    const nestedData = readRecord(root?.data)
    const nestedResult = readRecord(root?.result)
    const dataCandidates: Array<{ value: unknown; source: string }> = [
        { value: result, source: 'result' },
        { value: root?.items, source: 'root.items' },
        { value: root?.data, source: 'root.data' },
        { value: nestedData?.items, source: 'root.data.items' },
        { value: root?.models, source: 'root.models' },
        { value: nestedData?.models, source: 'root.data.models' },
        { value: root?.availableModels, source: 'root.availableModels' },
        { value: nestedData?.availableModels, source: 'root.data.availableModels' },
        { value: root?.available, source: 'root.available' },
        { value: nestedData?.available, source: 'root.data.available' },
        { value: root?.options, source: 'root.options' },
        { value: nestedData?.options, source: 'root.data.options' },
        { value: root?.supported, source: 'root.supported' },
        { value: nestedData?.supported, source: 'root.data.supported' },
        { value: root?.result, source: 'root.result' },
        { value: nestedResult?.items, source: 'root.result.items' },
        { value: nestedResult?.data, source: 'root.result.data' },
        { value: nestedResult?.models, source: 'root.result.models' },
        { value: nestedResult?.availableModels, source: 'root.result.availableModels' },
        { value: nestedResult?.available, source: 'root.result.available' },
        { value: nestedResult?.options, source: 'root.result.options' },
        { value: nestedResult?.supported, source: 'root.result.supported' }
    ]
    const recursiveCandidates = collectModelContainers(result)
    dataCandidates.push(...recursiveCandidates)

    const defaultModelId = [
        readString(root?.defaultModel).trim(),
        readString(root?.default).trim(),
        readString(root?.model).trim(),
        readString(root?.activeModel).trim(),
        readString(root?.selectedModel).trim(),
        readString(nestedData?.defaultModel).trim(),
        readString(nestedData?.activeModel).trim(),
        readString(nestedData?.selectedModel).trim(),
        readString(nestedResult?.defaultModel).trim(),
        readString(nestedResult?.model).trim(),
        readString(nestedResult?.activeModel).trim(),
        readString(nestedResult?.selectedModel).trim()
    ].find((value) => value.length > 0) || ''

    const models: AssistantModelInfo[] = []
    const seen = new Set<string>()
    const seenNormalized = new Set<string>()

    const pushModel = (entry: AssistantModelInfo | null) => {
        if (!entry) return
        const id = entry.id.trim()
        if (!id) return

        const normalizedId = normalizeModelId(id)
        if (seen.has(id) || seenNormalized.has(normalizedId)) return

        models.push({
            ...entry,
            id
        })
        seen.add(id)
        seenNormalized.add(normalizedId)
    }

    for (const { value, source } of dataCandidates) {
        if (!value) continue

        if (Array.isArray(value)) {
            for (const raw of value) {
                pushModel(parseModelEntry(raw))
            }
            continue
        }

        const sourceIsModelMap = /(models|items|list|catalog|registry|map|bymodel|bymodels|byprovider|available|options?|choices|supported|allowed)/i.test(source)
        if (!sourceIsModelMap) {
            const sourceLooksSingleModel = /(^|\.)(model|defaultmodel|recommendedmodel|activemodel|selectedmodel)$/i.test(source)
            if (sourceLooksSingleModel) {
                const direct = parseModelEntry(value)
                if (direct) pushModel(direct)
            }
            continue
        }

        const mapRecord = readRecord(value)
        if (!mapRecord) continue

        for (const [key, raw] of Object.entries(mapRecord)) {
            if (!key || key === 'default' || key === 'defaultModel') continue
            if (Array.isArray(raw)) {
                for (const nestedEntry of raw) {
                    pushModel(parseModelEntry(nestedEntry))
                }
                continue
            }
            pushModel(parseModelEntry(raw, key))
        }
    }

    if (models.length === 0) {
        return []
    }

    const normalizedDefaultId = normalizeModelId(defaultModelId)
    if (normalizedDefaultId) {
        const match = models.find((model) => normalizeModelId(model.id) === normalizedDefaultId)
        if (match) {
            match.isDefault = true
        }
    }

    if (!models.some((model) => model.isDefault)) {
        models[0].isDefault = true
    }

    return models
}

export function composeReasoningText(parts: string[]): string {
    let merged = ''
    for (const partRaw of parts) {
        const part = String(partRaw || '')
        if (!part.trim()) continue
        if (!merged) {
            merged = part
            continue
        }

        const startsStructured = /^\s*(#{1,6}\s|[-*]\s+|\d+\.\s+)/.test(part)
        if (startsStructured) {
            merged += `\n${part}`
            continue
        }

        const endsWithWhitespace = /\s$/.test(merged)
        const startsWithWhitespace = /^\s/.test(part)
        const startsWithPunctuation = /^[,.;:!?)]/.test(part)
        if (endsWithWhitespace || startsWithWhitespace || startsWithPunctuation) {
            merged += part
        } else {
            merged += ` ${part}`
        }
    }
    return merged.trim()
}

export function deriveSessionTitleFromPrompt(prompt: string, maxLength = 120): string {
    const lines = String(prompt || '')
        .replace(/\r/g, '\n')
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)

    if (lines.length === 0) return ''

    const firstLine = lines[0]
    const normalized = firstLine
        .replace(/^\s*#{1,6}\s+/, '')
        .replace(/[`*_~]/g, '')
        .replace(/\[(.*?)\]\((.*?)\)/g, '$1')
        .replace(/^["'`]+|["'`]+$/g, '')
        .replace(/\s+/g, ' ')
        .replace(/[.:;,\-–—]+$/g, '')
        .trim()

    if (!normalized) return ''
    if (normalized.length <= maxLength) return normalized
    return `${normalized.slice(0, Math.max(1, maxLength - 3)).trimEnd()}...`
}

export function isAutoSessionTitle(title: string): boolean {
    const normalized = String(title || '').trim()
    if (!normalized) return true
    return /^session\s+\d+$/i.test(normalized) || /^untitled session$/i.test(normalized)
}
