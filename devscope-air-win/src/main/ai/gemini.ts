/**
 * DevScope - Gemini AI Integration
 * Uses Google Gemini API for commit message generation
 */

import log from 'electron-log'
import { recordAiDebugLog, serializeForAiLog } from './ai-debug-log'
import { sanitizeCommitMessage, isLowQualityCommitMessage } from './commit-message-quality'

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com'
const GEMINI_API_VERSION = 'v1'
const MODEL_CACHE_TTL_MS = 10 * 60 * 1000
const PREFERRED_GEMINI_MODELS = [
    'gemini-flash-latest',
    'gemini-2.0-flash',
    'gemini-2.5-flash'
]

let cachedGeminiModel: string | null = null
let cachedGeminiModelAt = 0

interface GeminiResponse {
    candidates?: Array<{
        finishReason?: string
        content?: {
            parts?: Array<{
                text?: string
            }>
        }
    }>
    error?: {
        message?: string
    }
}

interface GeminiModelInfo {
    name?: string
    supportedGenerationMethods?: string[]
}

interface GeminiListModelsResponse {
    models?: GeminiModelInfo[]
    nextPageToken?: string
    error?: {
        message?: string
    }
}

function normalizeModelName(modelName: string): string {
    return modelName.replace(/^models\//, '')
}

function buildListModelsUrl(apiKey: string, pageToken?: string): string {
    const base = `${GEMINI_API_BASE}/${GEMINI_API_VERSION}/models?key=${encodeURIComponent(apiKey)}`
    return pageToken
        ? `${base}&pageToken=${encodeURIComponent(pageToken)}`
        : base
}

function buildGenerateUrl(apiKey: string, modelName: string): string {
    return `${GEMINI_API_BASE}/${GEMINI_API_VERSION}/models/${encodeURIComponent(normalizeModelName(modelName))}:generateContent?key=${encodeURIComponent(apiKey)}`
}

function hasGenerateContentSupport(model: GeminiModelInfo): boolean {
    const methods = model.supportedGenerationMethods || []
    return methods.some((method) => method.toLowerCase() === 'generatecontent')
}

function chooseBestModel(models: string[]): string | null {
    if (models.length === 0) return null

    for (const preferred of PREFERRED_GEMINI_MODELS) {
        if (models.includes(preferred)) {
            return preferred
        }
    }

    const stableFlash = models.find((name) =>
        /flash/i.test(name) && !/preview|experimental|exp/i.test(name)
    )
    if (stableFlash) return stableFlash

    const anyFlash = models.find((name) => /flash/i.test(name))
    if (anyFlash) return anyFlash

    return models[0]
}

async function listGenerateContentModels(apiKey: string): Promise<string[]> {
    const modelNames = new Set<string>()
    let pageToken: string | undefined
    let pages = 0

    do {
        const response = await fetch(buildListModelsUrl(apiKey, pageToken))
        const data = await response.json().catch(() => ({})) as GeminiListModelsResponse

        if (!response.ok) {
            throw new Error(data.error?.message || `HTTP ${response.status}: ${response.statusText}`)
        }

        for (const model of data.models || []) {
            if (!hasGenerateContentSupport(model)) continue
            if (!model.name) continue
            modelNames.add(normalizeModelName(model.name))
        }

        pageToken = data.nextPageToken
        pages += 1
    } while (pageToken && pages < 5)

    return Array.from(modelNames)
}

async function resolveGeminiModel(apiKey: string, forceRefresh = false): Promise<string> {
    const isCachedAndFresh = cachedGeminiModel
        && (Date.now() - cachedGeminiModelAt) < MODEL_CACHE_TTL_MS

    if (!forceRefresh && isCachedAndFresh) {
        return cachedGeminiModel as string
    }

    const availableModels = await listGenerateContentModels(apiKey)
    const selectedModel = chooseBestModel(availableModels)

    if (!selectedModel) {
        throw new Error('No Gemini models supporting generateContent were found for this API key.')
    }

    cachedGeminiModel = selectedModel
    cachedGeminiModelAt = Date.now()
    log.info(`[Gemini] Resolved model: ${selectedModel}`)
    return selectedModel
}

function extractResponseText(data: GeminiResponse): string {
    return data.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('').trim() || ''
}

function extractFinishReason(data: GeminiResponse): string | undefined {
    return data.candidates?.[0]?.finishReason
}

function shouldRetryWithRefreshedModel(status: number, errorMessage: string): boolean {
    if (status === 404) return true
    return /not found.*supported.*generatecontent|call listmodels/i.test(errorMessage)
}

function buildCompactDiffContext(diff: string, maxChars: number = 4500): string {
    const lines = diff.split('\n')
    const stagedPatchIndex = lines.findIndex((line) => line.trim() === '## STAGED PATCH')
    const compactBase = stagedPatchIndex >= 0 ? lines.slice(0, stagedPatchIndex).join('\n') : diff

    if (compactBase.length <= maxChars) return compactBase
    return `${compactBase.slice(0, maxChars)}\n... (compact context truncated)`
}

function maybeRemoveThinkingConfig(body: Record<string, unknown>): Record<string, unknown> | null {
    const generationConfig = body.generationConfig
    if (!generationConfig || typeof generationConfig !== 'object') return null

    const configRecord = generationConfig as Record<string, unknown>
    if (!('thinkingConfig' in configRecord)) return null

    const { thinkingConfig: _drop, ...restConfig } = configRecord
    return {
        ...body,
        generationConfig: restConfig
    }
}

function shouldRetryWithoutThinkingConfig(status: number, errorMessage: string): boolean {
    if (status !== 400) return false
    return /thinking.?config|thinking.?budget|unknown field|invalid json payload/i.test(errorMessage)
}

function extractStatusPathsFromDiffContext(diffContext: string): string[] {
    const marker = '## WORKING TREE STATUS (SHORT)'
    const start = diffContext.indexOf(marker)
    if (start < 0) return []

    const sectionText = diffContext.slice(start + marker.length)
    const lines = sectionText.split('\n')
    const paths: string[] = []

    for (const rawLine of lines) {
        const line = rawLine.trim()
        if (!line) continue
        if (line.startsWith('## ')) break

        const match = line.match(/^(?:\?\?|[MADRCU][ MADRCU]?)\s+(.+)$/)
        if (!match?.[1]) continue
        paths.push(match[1].trim())
    }

    return Array.from(new Set(paths))
}

function buildLocalFallbackCommitMessage(diffContext: string): string {
    const files = extractStatusPathsFromDiffContext(diffContext)
    if (files.length === 0) return ''

    const hasAI = files.some((file) => /src[\\/]+main[\\/]+ai[\\/]/i.test(file))
    const hasProjectDetails = files.some((file) => /project-details/i.test(file))
    const hasSettings = files.some((file) => /pages[\\/]+settings[\\/]/i.test(file))
    const hasBuild = files.some((file) => /(?:^|[\\/])(?:package\.json|package-lock\.json|bun\.lockb?|bun\.lock|README\.md)$/i.test(file))

    const type = hasAI || hasProjectDetails ? 'refactor' : 'chore'
    const scope = hasAI ? 'ai' : hasProjectDetails ? 'project-details' : hasBuild ? 'build' : 'repo'

    const areaLabels: string[] = []
    if (hasAI) areaLabels.push('AI commit generation')
    if (hasProjectDetails) areaLabels.push('project details')
    if (hasBuild) areaLabels.push('build and dependency setup')
    if (hasSettings) areaLabels.push('settings pages')

    const primaryArea = areaLabels.slice(0, 2).join(' and ') || 'project files'
    let title = `${type}(${scope}): improve ${primaryArea}`
    if (title.length > 72) {
        title = `${type}(${scope}): improve repository updates`
    }

    const topFiles = files.slice(0, 5)
    const topFilesText = topFiles.length > 0
        ? topFiles.join(', ') + (files.length > 5 ? ', and others.' : '.')
        : 'key source and configuration files.'

    const bullets = [
        `- Update ${files.length} changed file${files.length === 1 ? '' : 's'} in the current working tree.`,
        `- Focus changes on ${primaryArea}.`,
        `- Touch key paths including ${topFilesText}`,
        '- Keep the commit summary aligned with the currently modified files only.'
    ]

    return `${title}\n\n${bullets.join('\n')}`
}

async function requestGenerateContent(
    apiKey: string,
    body: Record<string, unknown>,
    options: { forceModelRefresh?: boolean; preferredModel?: string } = {}
): Promise<{
    success: boolean
    text?: string
    error?: string
    status?: number
    modelName?: string
    rawResponse?: unknown
    finishReason?: string
}> {
    let modelName: string
    try {
        if (options.preferredModel?.trim()) {
            modelName = normalizeModelName(options.preferredModel.trim())
        } else {
            modelName = await resolveGeminiModel(apiKey, options.forceModelRefresh)
        }
    } catch (err: any) {
        return { success: false, error: err?.message || 'Failed to resolve Gemini model', rawResponse: err }
    }

    const sendRequest = async (payload: Record<string, unknown>) => {
        const response = await fetch(buildGenerateUrl(apiKey, modelName), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        })
        const data = await response.json().catch(() => ({})) as GeminiResponse
        return { response, data }
    }

    let { response, data } = await sendRequest(body)
    const firstErrorMessage = data.error?.message || `HTTP ${response.status}: ${response.statusText}`
    if (!response.ok && shouldRetryWithoutThinkingConfig(response.status, firstErrorMessage)) {
        const fallbackBody = maybeRemoveThinkingConfig(body)
        if (fallbackBody) {
            const fallbackResult = await sendRequest(fallbackBody)
            response = fallbackResult.response
            data = fallbackResult.data
        }
    }

    if (!response.ok) {
        return {
            success: false,
            status: response.status,
            error: data.error?.message || `HTTP ${response.status}: ${response.statusText}`,
            modelName,
            rawResponse: data
        }
    }

    const text = extractResponseText(data)
    if (!text) {
        return {
            success: false,
            error: 'Unexpected API response',
            modelName,
            rawResponse: data,
            finishReason: extractFinishReason(data)
        }
    }

    return { success: true, text, modelName, rawResponse: data, finishReason: extractFinishReason(data) }
}

function chooseFallbackModelForTruncation(models: string[], currentModel?: string): string | null {
    const normalizedCurrent = currentModel ? normalizeModelName(currentModel) : ''
    const candidates = models.map(normalizeModelName).filter((name) => name !== normalizedCurrent)

    const preferredOrder = [
        'gemini-2.0-flash',
        'gemini-flash-latest'
    ]
    for (const preferred of preferredOrder) {
        if (candidates.includes(preferred)) return preferred
    }

    const non25Flash = candidates.find((name) => /flash/i.test(name) && !/2\.5|preview|experimental|exp/i.test(name))
    if (non25Flash) return non25Flash

    return null
}

async function resolveTruncationFallbackModel(apiKey: string, currentModel?: string): Promise<string | null> {
    try {
        const models = await listGenerateContentModels(apiKey)
        return chooseFallbackModelForTruncation(models, currentModel)
    } catch {
        return null
    }
}

export async function testGeminiConnection(apiKey: string): Promise<{ success: boolean; error?: string }> {
    try {
        const requestBody = {
            contents: [
                {
                    role: 'user',
                    parts: [{ text: 'Reply with exactly: Connection successful' }]
                }
            ],
            generationConfig: {
                temperature: 0.1,
                maxOutputTokens: 16
            }
        }

        let result = await requestGenerateContent(apiKey, requestBody)
        if (!result.success && result.error && shouldRetryWithRefreshedModel(result.status || 0, result.error)) {
            result = await requestGenerateContent(apiKey, requestBody, { forceModelRefresh: true })
        }

        if (!result.success) {
            return { success: false, error: result.error || 'Connection failed' }
        }

        return { success: true }
    } catch (err: any) {
        log.error('[Gemini] Connection test failed:', err)
        return { success: false, error: err.message || 'Connection failed' }
    }
}

export async function generateGeminiCommitMessage(
    apiKey: string,
    diff: string
): Promise<{ success: boolean; message?: string; error?: string }> {
    if (!diff || diff.trim().length === 0 || diff === 'No changes') {
        return { success: false, error: 'No changes to commit' }
    }

    const maxDiffLength = 7000
    const truncatedDiff = diff.length > maxDiffLength
        ? `${diff.slice(0, maxDiffLength)}\n\n... (diff truncated)`
        : diff
    const compactDiff = buildCompactDiffContext(truncatedDiff)

    const prompt = `You are an expert software engineer writing git commit messages for long-term project history.
Rules:
1. Use conventional commit format: type(scope): description
2. First line should be imperative and max 72 chars
3. Add a blank line after the title
4. Add 3-5 bullet points, each starting with "- "
5. Bullets must cover:
   - core code changes
   - behavior or developer impact
   - key implementation details or constraints
6. Keep output concise, specific, and grounded in the diff only
7. Do not invent details, tickets, benchmarks, or files not shown
8. Output only the commit message

Generate a commit message for this diff:
\`\`\`diff
${truncatedDiff}
\`\`\`
`
    const strictRetryPrompt = `Regenerate the commit message from this diff.
The previous draft was too vague or incomplete.

Rules:
1. Use conventional commit format: type(scope): description
2. Keep title imperative and max 72 chars
3. Add exactly 3-5 bullet points, each starting with "- "
4. Each bullet must be specific and complete (no vague bullets like "Update")
5. Include concrete details present in the diff (tools, dependencies, behavior)
6. Output only the commit message

Diff:
\`\`\`diff
${compactDiff}
\`\`\`
`

    try {
        log.info('[Gemini] Generating commit message...')

        const requestBody = {
            contents: [
                {
                    role: 'user',
                    parts: [{ text: prompt }]
                }
            ],
            generationConfig: {
                temperature: 0.15,
                maxOutputTokens: 900,
                thinkingConfig: {
                    thinkingBudget: 0
                }
            }
        }
        const strictRetryBody = {
            contents: [
                {
                    role: 'user',
                    parts: [{ text: strictRetryPrompt }]
                }
            ],
            generationConfig: {
                temperature: 0.1,
                maxOutputTokens: 1100,
                thinkingConfig: {
                    thinkingBudget: 0
                }
            }
        }

        let result = await requestGenerateContent(apiKey, requestBody)
        if (!result.success && result.error && shouldRetryWithRefreshedModel(result.status || 0, result.error)) {
            result = await requestGenerateContent(apiKey, requestBody, { forceModelRefresh: true })
        }

        if (!result.success || !result.text) {
            recordAiDebugLog({
                provider: 'gemini',
                action: 'generateCommitMessage',
                status: 'error',
                model: result.modelName,
                error: result.error || 'No response from AI',
                promptPreview: prompt,
                requestPayload: serializeForAiLog(requestBody),
                rawResponse: serializeForAiLog(result.rawResponse),
                metadata: {
                    diffLength: diff.length,
                    truncatedDiffLength: truncatedDiff.length,
                    compactDiffLength: compactDiff.length,
                    usedRetryPrompt: false
                }
            })
            return { success: false, error: result.error || 'No response from AI' }
        }

        let message = sanitizeCommitMessage(result.text)
        if (!message) {
            recordAiDebugLog({
                provider: 'gemini',
                action: 'generateCommitMessage',
                status: 'error',
                model: result.modelName,
                error: 'No response from AI',
                promptPreview: prompt,
                requestPayload: serializeForAiLog(requestBody),
                rawResponse: serializeForAiLog(result.rawResponse),
                candidateMessage: result.text,
                metadata: {
                    diffLength: diff.length,
                    truncatedDiffLength: truncatedDiff.length,
                    compactDiffLength: compactDiff.length,
                    usedRetryPrompt: false
                }
            })
            return { success: false, error: 'No response from AI' }
        }

        const initialCandidate = message
        let loggedRawResponse: unknown = result.rawResponse
        let loggedModel = result.modelName
        const initialFinishReason = result.finishReason
        let retriedCandidate: string | undefined
        let retryFinishReason: string | undefined
        let usedRetryPrompt = false
        let localFallbackUsed = false

        if (isLowQualityCommitMessage(message)) {
            log.warn('[Gemini] Low-quality commit message detected, retrying with strict prompt')
            usedRetryPrompt = true
            let strictRetry = await requestGenerateContent(apiKey, strictRetryBody, { forceModelRefresh: true })
            if (!strictRetry.success && strictRetry.error && shouldRetryWithRefreshedModel(strictRetry.status || 0, strictRetry.error)) {
                strictRetry = await requestGenerateContent(apiKey, strictRetryBody, { forceModelRefresh: true })
            }

            if (strictRetry.success && strictRetry.text) {
                const retriedMessage = sanitizeCommitMessage(strictRetry.text)
                retriedCandidate = retriedMessage
                retryFinishReason = strictRetry.finishReason
                if (!isLowQualityCommitMessage(retriedMessage)) {
                    message = retriedMessage
                    loggedRawResponse = strictRetry.rawResponse
                    loggedModel = strictRetry.modelName || loggedModel
                }
            }
        }

        let fallbackModel: string | null = null
        let fallbackFinishReason: string | undefined
        if (
            isLowQualityCommitMessage(message)
            && (initialFinishReason === 'MAX_TOKENS' || retryFinishReason === 'MAX_TOKENS')
        ) {
            fallbackModel = await resolveTruncationFallbackModel(apiKey, loggedModel)
            if (fallbackModel) {
                const fallbackPrompt = `Generate a concise commit message from this change summary.

Rules:
1. Format: type(scope): description
2. Title max 72 chars, imperative.
3. Add exactly 3-5 specific bullet points starting with "- ".
4. Output only the commit message.

Summary:
\`\`\`text
${compactDiff}
\`\`\`
`
                const fallbackBody = {
                    contents: [
                        {
                            role: 'user',
                            parts: [{ text: fallbackPrompt }]
                        }
                    ],
                    generationConfig: {
                        temperature: 0.1,
                        maxOutputTokens: 900,
                        thinkingConfig: {
                            thinkingBudget: 0
                        }
                    }
                }

                let fallbackResult = await requestGenerateContent(apiKey, fallbackBody, {
                    preferredModel: fallbackModel,
                    forceModelRefresh: true
                })
                if (!fallbackResult.success && fallbackResult.error && shouldRetryWithRefreshedModel(fallbackResult.status || 0, fallbackResult.error)) {
                    fallbackResult = await requestGenerateContent(apiKey, fallbackBody, {
                        preferredModel: fallbackModel,
                        forceModelRefresh: true
                    })
                }

                fallbackFinishReason = fallbackResult.finishReason
                if (fallbackResult.success && fallbackResult.text) {
                    const fallbackMessage = sanitizeCommitMessage(fallbackResult.text)
                    if (!isLowQualityCommitMessage(fallbackMessage)) {
                        message = fallbackMessage
                        usedRetryPrompt = true
                        retriedCandidate = fallbackMessage
                        loggedModel = fallbackResult.modelName || fallbackModel
                        loggedRawResponse = fallbackResult.rawResponse
                    }
                }
            }
        }

        if (isLowQualityCommitMessage(message)) {
            const localFallbackMessage = buildLocalFallbackCommitMessage(diff)
            if (localFallbackMessage && !isLowQualityCommitMessage(localFallbackMessage)) {
                message = localFallbackMessage
                localFallbackUsed = true
            }
        }

        if (isLowQualityCommitMessage(message)) {
            const failureMessage = 'AI response was incomplete (truncated). Please retry.'
            recordAiDebugLog({
                provider: 'gemini',
                action: 'generateCommitMessage',
                status: 'error',
                model: loggedModel,
                error: failureMessage,
                promptPreview: usedRetryPrompt ? strictRetryPrompt : prompt,
                requestPayload: serializeForAiLog(usedRetryPrompt ? strictRetryBody : requestBody),
                rawResponse: serializeForAiLog(loggedRawResponse),
                candidateMessage: retriedCandidate || initialCandidate,
                finalMessage: message,
                metadata: {
                    diffLength: diff.length,
                    truncatedDiffLength: truncatedDiff.length,
                    compactDiffLength: compactDiff.length,
                    usedRetryPrompt,
                    lowQualityInitialCandidate: isLowQualityCommitMessage(initialCandidate),
                    initialFinishReason: initialFinishReason || 'unknown',
                    retryFinishReason: retryFinishReason || 'none',
                    fallbackModel: fallbackModel || 'none',
                    fallbackFinishReason: fallbackFinishReason || 'none',
                    localFallbackUsed
                }
            })
            return { success: false, error: failureMessage }
        }

        recordAiDebugLog({
            provider: 'gemini',
            action: 'generateCommitMessage',
            status: 'success',
            model: loggedModel,
            promptPreview: usedRetryPrompt ? strictRetryPrompt : prompt,
            requestPayload: serializeForAiLog(usedRetryPrompt ? strictRetryBody : requestBody),
            rawResponse: serializeForAiLog(loggedRawResponse),
            candidateMessage: retriedCandidate || initialCandidate,
            finalMessage: message,
            metadata: {
                diffLength: diff.length,
                truncatedDiffLength: truncatedDiff.length,
                compactDiffLength: compactDiff.length,
                usedRetryPrompt,
                lowQualityInitialCandidate: isLowQualityCommitMessage(initialCandidate),
                initialFinishReason: initialFinishReason || 'unknown',
                retryFinishReason: retryFinishReason || 'none',
                fallbackModel: fallbackModel || 'none',
                fallbackFinishReason: fallbackFinishReason || 'none',
                localFallbackUsed
            }
        })

        return { success: true, message }
    } catch (err: any) {
        log.error('[Gemini] Generate commit message failed:', err)
        return { success: false, error: err.message || 'Failed to generate message' }
    }
}
