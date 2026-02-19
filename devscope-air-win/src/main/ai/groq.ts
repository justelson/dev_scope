/**
 * DevScope - Groq AI Integration
 * Uses Groq API for fast LLM inference
 */

import log from 'electron-log'

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions'
const MODEL = 'llama-3.1-8b-instant' // Fast and free tier

interface GroqResponse {
    choices?: Array<{
        message?: {
            content?: string
        }
    }>
    error?: {
        message?: string
    }
}

/**
 * Test the Groq API connection with a simple request
 */
export async function testGroqConnection(apiKey: string): Promise<{ success: boolean; error?: string }> {
    try {
        const response = await fetch(GROQ_API_URL, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: MODEL,
                messages: [
                    { role: 'user', content: 'Say "Connection successful" in exactly 2 words.' }
                ],
                max_tokens: 10
            })
        })

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({})) as GroqResponse
            return {
                success: false,
                error: errorData.error?.message || `HTTP ${response.status}: ${response.statusText}`
            }
        }

        const data = await response.json() as GroqResponse
        if (data.choices && data.choices.length > 0) {
            return { success: true }
        }

        return { success: false, error: 'Unexpected API response' }
    } catch (err: any) {
        log.error('[Groq] Connection test failed:', err)
        return { success: false, error: err.message || 'Connection failed' }
    }
}

/**
 * Generate a commit message from a git diff
 */
export async function generateCommitMessage(
    apiKey: string,
    diff: string
): Promise<{ success: boolean; message?: string; error?: string }> {
    if (!diff || diff.trim().length === 0) {
        return { success: false, error: 'No changes to commit' }
    }

    // Truncate diff if too long (Groq has token limits)
    const maxDiffLength = 8000
    const truncatedDiff = diff.length > maxDiffLength
        ? diff.slice(0, maxDiffLength) + '\n\n... (diff truncated)'
        : diff

    const systemPrompt = `You are a helpful assistant that generates descriptive git commit messages.
Follow these rules:
1. Use conventional commit format: type(scope): description
   Types: feat, fix, docs, style, refactor, test, chore, perf
2. First line (title): 50-72 characters max, imperative mood
3. Add a blank line after the title
4. Add a body with bullet points explaining:
   - What was changed
   - Why it was changed
   - Any important implementation details
5. Keep bullet points concise but informative
6. Only output the commit message, nothing else

Example format:
feat(auth): add user login functionality

- Implement JWT-based authentication flow
- Add login form with email/password validation
- Create auth context for session management
- Add protected route wrapper component`

    const userPrompt = `Generate a detailed commit message for these changes:

\`\`\`diff
${truncatedDiff}
\`\`\`

Commit message:`

    try {
        log.info('[Groq] Generating commit message...')

        const response = await fetch(GROQ_API_URL, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: MODEL,
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userPrompt }
                ],
                max_tokens: 300,
                temperature: 0.3 // Lower temperature for more consistent output
            })
        })

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({})) as GroqResponse
            return {
                success: false,
                error: errorData.error?.message || `HTTP ${response.status}: ${response.statusText}`
            }
        }

        const data = await response.json() as GroqResponse

        if (data.choices && data.choices.length > 0 && data.choices[0].message?.content) {
            const message = data.choices[0].message.content.trim()
            log.info('[Groq] Generated commit message:', message)
            return { success: true, message }
        }

        return { success: false, error: 'No response from AI' }
    } catch (err: any) {
        log.error('[Groq] Generate commit message failed:', err)
        return { success: false, error: err.message || 'Failed to generate message' }
    }
}
