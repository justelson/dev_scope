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
            if (path === 'result' || /(models?|items?|list|catalog|registry)/i.test(path)) {
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
            const keyLooksModelContainer = /(models|items|list|catalog|registry|map|bymodel|bymodels|byprovider)/i.test(normalizedKey)
            const keyLooksSingleModel = normalizedKey === 'model'
                || normalizedKey === 'defaultmodel'
                || normalizedKey === 'recommendedmodel'
            const keyAllowsTraversal = keyLooksModelContainer
                || keyLooksSingleModel
                || /(data|result|payload|response|provider|providers|meta|output|resources)/i.test(normalizedKey)
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
        { value: root?.result, source: 'root.result' },
        { value: nestedResult?.items, source: 'root.result.items' },
        { value: nestedResult?.data, source: 'root.result.data' },
        { value: nestedResult?.models, source: 'root.result.models' }
    ]
    const recursiveCandidates = collectModelContainers(result)
    dataCandidates.push(...recursiveCandidates)

    const defaultModelId = [
        readString(root?.defaultModel).trim(),
        readString(root?.default).trim(),
        readString(root?.model).trim(),
        readString(nestedData?.defaultModel).trim(),
        readString(nestedResult?.defaultModel).trim(),
        readString(nestedResult?.model).trim()
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

        const sourceIsModelMap = /(models|items|list|catalog|registry|map|bymodel|bymodels|byprovider)/i.test(source)
        if (!sourceIsModelMap) {
            const sourceLooksSingleModel = /(^|\.)(model|defaultmodel|recommendedmodel)$/i.test(source)
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
