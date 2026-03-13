import type { DevScopeFileTreeNode } from '@shared/contracts/devscope-api'

export type MentionCandidate = {
    path: string
    name: string
    relativePath: string
    type: 'file' | 'directory'
}

type MentionIndexCacheEntry = {
    projectPath: string
    entries: MentionCandidate[]
    loadedAt: number
}

const mentionIndexCache = new Map<string, MentionIndexCacheEntry>()

function normalizeProjectPath(projectPath: string): string {
    return projectPath.replace(/[\\/]+$/, '')
}

function flattenFileTree(nodes: DevScopeFileTreeNode[], projectPath: string, bucket: MentionCandidate[] = []): MentionCandidate[] {
    const normalizedProjectPath = normalizeProjectPath(projectPath)
    for (const node of nodes) {
        const normalizedPath = String(node.path || '').trim()
        const relativePath = normalizedPath.startsWith(normalizedProjectPath)
            ? normalizedPath.slice(normalizedProjectPath.length).replace(/^[\\/]+/, '')
            : normalizedPath
        bucket.push({
            path: normalizedPath,
            name: node.name,
            relativePath: relativePath || node.name,
            type: node.type
        })
        if (node.children?.length) flattenFileTree(node.children, normalizedProjectPath, bucket)
    }
    return bucket
}

export async function getOrCreateMentionIndex(projectPath: string): Promise<MentionCandidate[]> {
    const normalizedProjectPath = normalizeProjectPath(String(projectPath || '').trim())
    if (!normalizedProjectPath) return []

    const cached = mentionIndexCache.get(normalizedProjectPath)
    if (cached) return cached.entries

    const result = await window.devscope.getFileTree(normalizedProjectPath, { maxDepth: 5, showHidden: false })
    const entries = result.success ? flattenFileTree(result.tree || [], normalizedProjectPath) : []
    mentionIndexCache.set(normalizedProjectPath, {
        projectPath: normalizedProjectPath,
        entries,
        loadedAt: Date.now()
    })
    return entries
}

export function primeMentionIndex(projectPath: string): void {
    const normalizedProjectPath = normalizeProjectPath(String(projectPath || '').trim())
    if (!normalizedProjectPath || mentionIndexCache.has(normalizedProjectPath)) return
    void getOrCreateMentionIndex(normalizedProjectPath)
}

function scoreMentionCandidate(candidate: MentionCandidate, query: string): number {
    if (!query) return candidate.type === 'file' ? 2 : 1

    const normalizedQuery = query.toLowerCase()
    const lowerName = candidate.name.toLowerCase()
    const lowerPath = candidate.relativePath.toLowerCase()

    let score = 0
    if (lowerName === normalizedQuery) score += 120
    if (lowerName.startsWith(normalizedQuery)) score += 80
    if (lowerPath.startsWith(normalizedQuery)) score += 56
    if (lowerName.includes(normalizedQuery)) score += 32
    if (lowerPath.includes(normalizedQuery)) score += 18
    if (candidate.type === 'file') score += 6
    score -= Math.min(lowerPath.length, 120) * 0.05
    return score
}

export function searchMentionIndex(entries: MentionCandidate[], query: string, limit = 8): MentionCandidate[] {
    const normalizedQuery = String(query || '').trim().toLowerCase()
    const scored = entries
        .filter((entry) => !normalizedQuery || entry.name.toLowerCase().includes(normalizedQuery) || entry.relativePath.toLowerCase().includes(normalizedQuery))
        .map((entry) => ({ entry, score: scoreMentionCandidate(entry, normalizedQuery) }))
        .sort((left, right) => right.score - left.score || left.entry.relativePath.localeCompare(right.entry.relativePath))
        .slice(0, limit)
        .map((item) => item.entry)
    return scored
}

export function clearMentionIndex(projectPath?: string): void {
    const normalizedProjectPath = normalizeProjectPath(String(projectPath || '').trim())
    if (!normalizedProjectPath) {
        mentionIndexCache.clear()
        return
    }
    mentionIndexCache.delete(normalizedProjectPath)
}
