/**
 * DevScope - Gemini AI Integration
 * Uses Google Gemini API for commit message generation
 */

import log from 'electron-log'

const GEMINI_MODEL = 'gemini-1.5-flash'
const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models'

interface GeminiResponse {
    candidates?: Array<{
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

function buildGenerateUrl(apiKey: string): string {
    return `${GEMINI_API_BASE}/${GEMINI_MODEL}:generateContent?key=${apiKey}`
}

export async function testGeminiConnection(apiKey: string): Promise<{ success: boolean; error?: string }> {
    try {
        const response = await fetch(buildGenerateUrl(apiKey), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
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
            })
        })

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({})) as GeminiResponse
            return {
                success: false,
                error: errorData.error?.message || `HTTP ${response.status}: ${response.statusText}`
            }
        }

        const data = await response.json() as GeminiResponse
        const text = data.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('').trim()
        if (!text) return { success: false, error: 'Unexpected API response' }

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

    const maxDiffLength = 10000
    const truncatedDiff = diff.length > maxDiffLength
        ? `${diff.slice(0, maxDiffLength)}\n\n... (diff truncated)`
        : diff

    const prompt = `You generate detailed git commit messages.
Rules:
1. Use conventional commit format: type(scope): description
2. First line should be 50-72 chars and imperative
3. Add a blank line after the title
4. Add concise bullet points describing:
   - what changed
   - why it changed
   - key implementation details
5. Output only the commit message

Generate a commit message for this diff:
\`\`\`diff
${truncatedDiff}
\`\`\`
`

    try {
        log.info('[Gemini] Generating commit message...')

        const response = await fetch(buildGenerateUrl(apiKey), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [
                    {
                        role: 'user',
                        parts: [{ text: prompt }]
                    }
                ],
                generationConfig: {
                    temperature: 0.2,
                    maxOutputTokens: 320
                }
            })
        })

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({})) as GeminiResponse
            return {
                success: false,
                error: errorData.error?.message || `HTTP ${response.status}: ${response.statusText}`
            }
        }

        const data = await response.json() as GeminiResponse
        const message = data.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('').trim()
        if (!message) return { success: false, error: 'No response from AI' }

        return { success: true, message }
    } catch (err: any) {
        log.error('[Gemini] Generate commit message failed:', err)
        return { success: false, error: err.message || 'Failed to generate message' }
    }
}
