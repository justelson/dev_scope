import { stat, unlink } from 'fs/promises'
import { isAbsolute, join, relative } from 'path'
import { simpleGit, type SimpleGit } from 'simple-git'
import type { CompactPatchResult, GitCommit, GitStatusMap, RepoContext } from './types'

const AI_NOISY_PATCH_FILE_PATTERN = /(?:^|\/)(?:package-lock\.json|yarn\.lock|pnpm-lock\.ya?ml|bun\.lockb?|bun\.lock|min\.(?:js|css)|dist\/|build\/|coverage\/)/i
const AI_PATCH_MAX_FILES = 16
const AI_PATCH_MAX_LINES_PER_FILE = 120
const AI_PATCH_MAX_LINES_TOTAL = 900

export function createGit(projectPath: string): SimpleGit {
    return simpleGit({
        baseDir: projectPath,
        binary: 'git',
        maxConcurrentProcesses: 6,
        trimmed: false
    })
}

export function normalizeGitPath(path: string): string {
    return path.replace(/^"|"$/g, '').replace(/\\/g, '/')
}

function sanitizePathSpec(pathSpec: string): string {
    return normalizeGitPath(pathSpec).replace(/^\.\/+/, '').replace(/\/{2,}/g, '/')
}

function isWindowsLikePath(pathSpec: string): boolean {
    return /^[A-Za-z]:\//.test(pathSpec)
}

function normalizeForCompare(pathSpec: string): string {
    const normalized = sanitizePathSpec(pathSpec).replace(/\/+$/, '')
    return process.platform === 'win32' ? normalized.toLowerCase() : normalized
}

function stripPrefixedPath(pathSpec: string, prefix: string): string {
    if (!prefix) return sanitizePathSpec(pathSpec)

    let current = sanitizePathSpec(pathSpec)
    const normalizedPrefix = sanitizePathSpec(prefix).replace(/\/+$/, '')
    if (!normalizedPrefix) return current

    while (current.length > 0) {
        const currentCompare = normalizeForCompare(current)
        const prefixCompare = normalizeForCompare(normalizedPrefix)

        if (currentCompare === prefixCompare) {
            current = ''
            continue
        }

        const prefixedCompare = `${prefixCompare}/`
        if (currentCompare.startsWith(prefixedCompare)) {
            current = current.slice(normalizedPrefix.length + 1)
            continue
        }

        break
    }

    return sanitizePathSpec(current)
}

export async function getRepoContext(git: SimpleGit, projectPath: string): Promise<RepoContext> {
    const repoRootRaw = await git.raw(['rev-parse', '--show-toplevel']).catch(() => projectPath)
    const repoRoot = sanitizePathSpec(repoRootRaw.trim() || projectPath)
    const relativeToRepoRaw = sanitizePathSpec(relative(repoRoot, projectPath))
    const projectRelativeToRepo = relativeToRepoRaw === '.' ? '' : relativeToRepoRaw

    return {
        repoRoot,
        projectRelativeToRepo
    }
}

export async function toPathSpec(
    git: SimpleGit,
    projectPath: string,
    filePath: string,
    repoContext?: RepoContext
): Promise<string> {
    const context = repoContext ?? await getRepoContext(git, projectPath)
    const normalizedInput = sanitizePathSpec(filePath)

    const directRelativeRaw = isAbsolute(filePath)
        ? sanitizePathSpec(relative(projectPath, filePath))
        : normalizedInput

    const directRelative = stripPrefixedPath(directRelativeRaw, context.projectRelativeToRepo)
    if (
        directRelative &&
        directRelative !== '.' &&
        !directRelative.startsWith('..') &&
        !isWindowsLikePath(directRelative)
    ) {
        return directRelative
    }

    if (isAbsolute(filePath)) {
        const repoRelativeRaw = sanitizePathSpec(relative(context.repoRoot, filePath))
        const repoRelative = stripPrefixedPath(repoRelativeRaw, context.projectRelativeToRepo)
        if (
            repoRelative &&
            repoRelative !== '.' &&
            !repoRelative.startsWith('..') &&
            !isWindowsLikePath(repoRelative)
        ) {
            return repoRelative
        }
    }

    const strippedInput = stripPrefixedPath(normalizedInput, context.projectRelativeToRepo)
    return strippedInput || normalizedInput
}

export function toError(err: unknown, fallback: string): Error {
    if (err instanceof Error && err.message) return new Error(err.message)
    return new Error(fallback)
}

export function toErrorMessage(err: unknown, fallback: string): string {
    if (err instanceof Error && err.message) return err.message
    return fallback
}

function parseDiffBlocks(patch: string): string[][] {
    const lines = patch.split('\n')
    const blocks: string[][] = []
    let current: string[] = []

    for (const line of lines) {
        if (line.startsWith('diff --git ')) {
            if (current.length > 0) blocks.push(current)
            current = [line]
            continue
        }
        if (current.length > 0) {
            current.push(line)
        }
    }

    if (current.length > 0) blocks.push(current)
    return blocks
}

function extractDiffFilePath(headerLine: string): string {
    const match = headerLine.match(/^diff --git a\/(.+?) b\/.+$/)
    return match?.[1] || headerLine
}

export function compactPatchForAI(patch: string): CompactPatchResult {
    const blocks = parseDiffBlocks(patch)
    if (blocks.length === 0) {
        return {
            text: '',
            omittedFiles: [],
            totalFiles: 0,
            includedFiles: 0,
            wasTruncated: false
        }
    }

    const outputBlocks: string[] = []
    const omittedFiles: string[] = []
    let includedFiles = 0
    let usedLines = 0
    let wasTruncated = false

    for (const block of blocks) {
        if (block.length === 0) continue
        const filePath = extractDiffFilePath(block[0])

        if (AI_NOISY_PATCH_FILE_PATTERN.test(filePath)) {
            omittedFiles.push(`${filePath} (noisy/generated)`)
            continue
        }

        if (includedFiles >= AI_PATCH_MAX_FILES) {
            omittedFiles.push(`${filePath} (file limit reached)`)
            wasTruncated = true
            continue
        }

        const remainingLines = AI_PATCH_MAX_LINES_TOTAL - usedLines
        if (remainingLines <= 0) {
            omittedFiles.push(`${filePath} (global line budget reached)`)
            wasTruncated = true
            continue
        }

        const allowedForFile = Math.min(AI_PATCH_MAX_LINES_PER_FILE, remainingLines)
        let selected = block.slice(0, allowedForFile)

        if (block.length > allowedForFile) {
            selected = [
                ...selected,
                `... (${block.length - allowedForFile} more lines omitted for ${filePath})`
            ]
            wasTruncated = true
        }

        outputBlocks.push(selected.join('\n'))
        includedFiles += 1
        usedLines += selected.length
    }

    return {
        text: outputBlocks.join('\n\n').trim(),
        omittedFiles,
        totalFiles: blocks.length,
        includedFiles,
        wasTruncated
    }
}

export function countTrackedChanges(statusMap: GitStatusMap): number {
    const changed = new Set<string>()

    for (const [filePath, status] of Object.entries(statusMap)) {
        if (status === 'ignored' || status === 'unknown') continue
        changed.add(normalizeGitPath(filePath))
    }

    return changed.size
}

export function parseCommitLog(stdout: string): GitCommit[] {
    const recordSep = '\x1e'
    const fieldSep = '\x1f'
    const commits: GitCommit[] = []
    const records = stdout.split(recordSep).map((record) => record.trim()).filter(Boolean)

    for (const record of records) {
        const parts = record.split(fieldSep)
        if (parts.length < 5) continue
        const [hash, parentText, author, date, ...messageParts] = parts
        const message = messageParts.join(fieldSep)
        commits.push({
            hash,
            shortHash: hash.substring(0, 7),
            parents: parentText ? parentText.split(' ').filter(Boolean) : [],
            author,
            date,
            message
        })
    }

    return commits
}

export function parseRepoOwner(remoteUrl: string): string | null {
    const trimmed = remoteUrl.trim()
    if (!trimmed) return null

    const sshScpMatch = trimmed.match(/^[^@]+@[^:]+:([^/]+)\/.+$/)
    if (sshScpMatch?.[1]) return sshScpMatch[1]

    try {
        const url = new URL(trimmed)
        const segments = url.pathname.split('/').filter(Boolean)
        return segments[0] || null
    } catch {
        return null
    }
}

export function assertNonEmpty(value: string, label: string): void {
    if (!value.trim()) {
        throw new Error(`${label} cannot be empty`)
    }
}

export function isCheckoutBlockedByLocalChanges(message: string): boolean {
    return /would be overwritten by (checkout|switch)/i.test(message)
}

export function isGitIndexLockConflict(message: string): boolean {
    return /index\.lock': File exists/i.test(message) || /Unable to create .*index\.lock/i.test(message)
}

export async function cleanupStaleIndexLock(projectPath: string, staleMs: number = 15_000): Promise<'removed' | 'active' | 'missing'> {
    const lockPath = join(projectPath, '.git', 'index.lock')

    try {
        const lockStat = await stat(lockPath)
        const ageMs = Date.now() - lockStat.mtimeMs

        if (ageMs < staleMs) {
            return 'active'
        }

        await unlink(lockPath)
        return 'removed'
    } catch (err: any) {
        if (err?.code === 'ENOENT') return 'missing'
        throw err
    }
}

export function stripPathPrefix(pathSpec: string, prefix: string): string {
    return stripPrefixedPath(pathSpec, prefix)
}
