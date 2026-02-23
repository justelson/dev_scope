type ProjectDetailsLike = Record<string, any>
type FileTreeLike = any[]

const CACHE_TTL_MS = 2 * 60 * 1000

const projectDetailsCache = new Map<string, { value: ProjectDetailsLike; updatedAt: number }>()
const fileTreeCache = new Map<string, { value: FileTreeLike; updatedAt: number }>()

function normalizePathKey(projectPath: string): string {
    return String(projectPath || '').trim().replace(/\\/g, '/').toLowerCase()
}

function isFresh(updatedAt: number): boolean {
    return Date.now() - updatedAt <= CACHE_TTL_MS
}

export function getCachedProjectDetails(projectPath: string): ProjectDetailsLike | null {
    const key = normalizePathKey(projectPath)
    if (!key) return null
    const cached = projectDetailsCache.get(key)
    if (!cached) return null
    if (!isFresh(cached.updatedAt)) {
        projectDetailsCache.delete(key)
        return null
    }
    return cached.value
}

export function setCachedProjectDetails(projectPath: string, value: ProjectDetailsLike): void {
    const key = normalizePathKey(projectPath)
    if (!key || !value) return
    projectDetailsCache.set(key, { value, updatedAt: Date.now() })
}

function hasRichDetails(value: ProjectDetailsLike): boolean {
    if (!value || typeof value !== 'object') return false
    return Boolean(
        value.readme
        || value.version
        || value.description
        || value.scripts
        || value.dependencies
        || value.devDependencies
        || value.frameworkInfo
        || value.typeInfo
    )
}

export function primeProjectDetailsCache(input: {
    name: string
    path: string
    type: string
    markers?: string[]
    frameworks?: string[]
    lastModified?: number
}): void {
    const key = normalizePathKey(input.path)
    if (!key) return

    const existing = projectDetailsCache.get(key)
    if (existing && isFresh(existing.updatedAt) && hasRichDetails(existing.value)) {
        return
    }

    projectDetailsCache.set(key, {
        value: {
            name: input.name,
            displayName: input.name,
            path: input.path,
            type: input.type,
            markers: Array.isArray(input.markers) ? input.markers : [],
            frameworks: Array.isArray(input.frameworks) ? input.frameworks : [],
            lastModified: typeof input.lastModified === 'number' ? input.lastModified : undefined
        },
        updatedAt: Date.now()
    })
}

export function getCachedFileTree(projectPath: string): FileTreeLike | null {
    const key = normalizePathKey(projectPath)
    if (!key) return null
    const cached = fileTreeCache.get(key)
    if (!cached) return null
    if (!isFresh(cached.updatedAt)) {
        fileTreeCache.delete(key)
        return null
    }
    return cached.value
}

export function setCachedFileTree(projectPath: string, value: FileTreeLike): void {
    const key = normalizePathKey(projectPath)
    if (!key || !Array.isArray(value)) return
    fileTreeCache.set(key, { value, updatedAt: Date.now() })
}
