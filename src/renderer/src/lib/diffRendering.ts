import { parsePatchFiles } from '@pierre/diffs'
import type { FileDiffMetadata, ParsedPatch } from '@pierre/diffs/react'
import type { Theme } from '@/lib/settings'

export interface FileDiffSummary {
    path: string
    previousPath?: string
    additions: number
    deletions: number
    totalLines: number
    fileDiff: FileDiffMetadata
}

export interface ParsedPatchRenderResult {
    patch: string
    metadata: string
    parsedPatches: ParsedPatch[]
    files: FileDiffMetadata[]
    error: string | null
}

const EMPTY_DIFF_MARKERS = new Set(['', 'No changes', 'No diff available'])
const PARSED_PATCH_RENDER_CACHE_LIMIT = 40
const parsedPatchRenderCache = new Map<string, ParsedPatchRenderResult>()

export function resolveDiffThemeType(theme: Theme): 'light' | 'dark' {
    return theme === 'light' ? 'light' : 'dark'
}

export function resolveDiffThemeName(theme: Theme): 'pierre-light' | 'pierre-dark' {
    return resolveDiffThemeType(theme) === 'light' ? 'pierre-light' : 'pierre-dark'
}

function fnv1a32(value: string): string {
    let hash = 0x811c9dc5

    for (let index = 0; index < value.length; index += 1) {
        hash ^= value.charCodeAt(index)
        hash = Math.imul(hash, 0x01000193)
    }

    return (hash >>> 0).toString(16)
}

export function buildPatchCacheKey(scope: string, patch: string): string {
    return `${scope}:${fnv1a32(patch)}`
}

function readParsedPatchRenderCache(cacheKey: string): ParsedPatchRenderResult | null {
    const cached = parsedPatchRenderCache.get(cacheKey)
    if (!cached) return null

    parsedPatchRenderCache.delete(cacheKey)
    parsedPatchRenderCache.set(cacheKey, cached)
    return cached
}

function writeParsedPatchRenderCache(cacheKey: string, value: ParsedPatchRenderResult): void {
    parsedPatchRenderCache.set(cacheKey, value)
    while (parsedPatchRenderCache.size > PARSED_PATCH_RENDER_CACHE_LIMIT) {
        const oldestKey = parsedPatchRenderCache.keys().next().value
        if (!oldestKey) break
        parsedPatchRenderCache.delete(oldestKey)
    }
}

export function normalizePatchText(patch: string): string {
    const normalized = patch.replace(/\r\n/g, '\n').trim()
    return EMPTY_DIFF_MARKERS.has(normalized) ? '' : normalized
}

export function resolveFileDiffPath(fileDiff: FileDiffMetadata): string {
    return (fileDiff.name || fileDiff.prevName || '').replace(/\\/g, '/')
}

export function summarizeFileDiff(fileDiff: FileDiffMetadata): FileDiffSummary {
    const additions = fileDiff.hunks.reduce((sum, hunk) => sum + hunk.additionLines, 0)
    const deletions = fileDiff.hunks.reduce((sum, hunk) => sum + hunk.deletionLines, 0)
    const changedLines = additions + deletions

    return {
        path: resolveFileDiffPath(fileDiff),
        previousPath: fileDiff.prevName?.replace(/\\/g, '/'),
        additions,
        deletions,
        totalLines: changedLines,
        fileDiff
    }
}

export function parsePatchForRendering(patch: string, scope: string): ParsedPatchRenderResult {
    const normalizedPatch = normalizePatchText(patch)
    if (!normalizedPatch) {
        return {
            patch: '',
            metadata: '',
            parsedPatches: [],
            files: [],
            error: null
        }
    }

    const cacheKey = buildPatchCacheKey(`render:${scope}`, normalizedPatch)
    const cached = readParsedPatchRenderCache(cacheKey)
    if (cached) return cached

    try {
        const parsedPatches = parsePatchFiles(normalizedPatch, buildPatchCacheKey(scope, normalizedPatch))
        const result = {
            patch: normalizedPatch,
            metadata: parsedPatches
                .map((entry) => entry.patchMetadata?.trim())
                .filter((value): value is string => Boolean(value))
                .join('\n\n'),
            parsedPatches,
            files: parsedPatches.flatMap((entry) => entry.files),
            error: null
        }
        writeParsedPatchRenderCache(cacheKey, result)
        return result
    } catch (error) {
        const result = {
            patch: normalizedPatch,
            metadata: '',
            parsedPatches: [],
            files: [],
            error: error instanceof Error ? error.message : 'Unable to parse diff'
        }
        writeParsedPatchRenderCache(cacheKey, result)
        return result
    }
}
