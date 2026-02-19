/**
 * DevScope - Project Details Page
 * Premium Redesign with Right-Side Tools Panel
 */

import { useState, useEffect, useMemo, useRef, useCallback, startTransition, useDeferredValue } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
    ArrowLeft, FolderOpen, Terminal, ExternalLink, FileText,
    RefreshCw, Package, Copy, Check, Play, AlertCircle, BookOpen,
    Clock, Tag, Hash, ChevronRight, Command, Search,
    GitBranch, GitCommitHorizontal, GitPullRequest, Calendar, User,
    File, Folder, X, Code, Image, FileJson, FileCode, ChevronDown, ChevronUp,
    Eye, EyeOff, ChevronsUpDown, ChevronsDownUp, Plus, Link, Sparkles
} from 'lucide-react'
import { useTerminal } from '@/App'
import { cn, parseFileSearchQuery } from '@/lib/utils'
import ProjectIcon, { FrameworkBadge } from '@/components/ui/ProjectIcon'
import MarkdownRenderer from '@/components/ui/MarkdownRenderer'
import { FilePreviewModal, useFilePreview } from '@/components/ui/FilePreviewModal'
import { Checkbox, Radio, Select, Input, Textarea } from '@/components/ui/FormControls'
import { useSettings } from '@/lib/settings'
import { trackRecentProject } from '@/lib/recentProjects'
import { buildFileSearchIndex, searchFileIndex } from '@/lib/fileSearchIndex'

// Stable empty Set for collapse (prevents new object on each click)
const EMPTY_SET = new Set<string>()
const README_COLLAPSED_MAX_HEIGHT = 500
const SERVER_SCRIPT_NAME_PATTERN = /(^|:)(dev|serve|start|preview|watch|host|web|electron|desktop|api|backend)/i
const SERVER_SCRIPT_COMMAND_PATTERN = /\b(vite|next\s+dev|nuxt|astro|webpack(?:-dev-server)?|react-scripts\s+start|serve|nodemon|ts-node-dev|concurrently|electron(?:\s+\.)?|expo\s+start|parcel|ng\s+serve|remix|svelte-kit)\b/i
const BUILD_SCRIPT_NAME_PATTERN = /(^|:)(build|bundle|compile|dist|release|prod|deploy)/i
const BUILD_SCRIPT_COMMAND_PATTERN = /\b(vite\s+build|next\s+build|nuxt\s+build|astro\s+build|webpack|rollup|tsc\b|esbuild\b|swc\b)\b/i
const TEST_SCRIPT_NAME_PATTERN = /(^|:)(test|spec|e2e|unit|integration|ci:test|coverage|vitest|jest|playwright|cypress)/i
const TEST_SCRIPT_COMMAND_PATTERN = /\b(jest|vitest|mocha|ava|tap|cypress|playwright|karma)\b/i
const LINT_SCRIPT_NAME_PATTERN = /(^|:)(lint|format|prettier|check|typecheck)/i
const LINT_SCRIPT_COMMAND_PATTERN = /\b(eslint|prettier|stylelint|biome|xo|standard|tsc\s+--noemit)\b/i
const PREVIEWABLE_EXTENSIONS = new Set([
    'md', 'markdown', 'mdown', 'mdx',
    'html', 'htm',
    'json', 'jsonc', 'json5',
    'csv', 'tsv',
    'txt', 'log', 'ini', 'conf', 'env',
    'js', 'jsx', 'ts', 'tsx', 'mjs', 'cjs',
    'py', 'rb', 'java', 'kt', 'kts',
    'c', 'h', 'cpp', 'cxx', 'hpp', 'cs',
    'go', 'rs', 'php', 'swift', 'dart', 'scala', 'sql',
    'sh', 'bash', 'zsh', 'ps1', 'bat', 'cmd',
    'yml', 'yaml', 'toml', 'xml', 'css', 'scss', 'less', 'vue', 'svelte'
])
const PREVIEWABLE_FILE_NAMES = new Set([
    'dockerfile', 'makefile', '.gitignore', '.gitattributes', '.editorconfig', '.npmrc', '.eslintrc', '.prettierrc'
])

// Inline types
interface ProjectTypeDefinition {
    id: string
    displayName: string
    icon: string
    themeColor: string
    markers: string[]
    description: string
}

interface FrameworkDefinition {
    id: string
    displayName: string
    icon: string
    themeColor: string
    parentType: string
    detectPatterns: any
}

interface ProjectDetails {
    name: string
    displayName: string
    path: string
    type: string
    typeInfo?: ProjectTypeDefinition
    markers: string[]
    frameworks: string[]
    frameworkInfo?: FrameworkDefinition[]
    description?: string
    version?: string
    readme?: string
    lastModified?: number
    scripts?: Record<string, string>
    dependencies?: Record<string, string>
    devDependencies?: Record<string, string>
}

interface FileTreeNode {
    name: string
    path: string
    type: 'file' | 'directory'
    size?: number
    children?: FileTreeNode[]
    isHidden: boolean
    gitStatus?: 'modified' | 'untracked' | 'added' | 'deleted' | 'renamed' | 'ignored' | 'unknown'
}

interface GitCommit {
    hash: string
    shortHash: string
    parents: string[]
    author: string
    date: string
    message: string
}

type ScriptIntent = 'server' | 'build' | 'test' | 'lint' | 'generic'
interface ScriptIntentPrediction {
    intent: ScriptIntent
    confidence: number
}

interface ScriptIntentContext {
    frameworks?: string[]
    markers?: string[]
}

interface PendingScriptRun {
    name: string
    command: string
    intent: ScriptIntent
    confidence: number
}

interface ScriptRunDraft {
    port?: number
    exposeNetwork?: boolean
    extraArgs?: string
    envOverrides?: Record<string, string>
}

const SCRIPT_INTENT_LABELS: Record<ScriptIntent, string> = {
    server: 'Server',
    build: 'Build',
    test: 'Test',
    lint: 'Lint',
    generic: 'General'
}

const SCRIPT_INTENT_BADGE_CLASSES: Record<ScriptIntent, string> = {
    server: 'border-emerald-500/30 bg-emerald-500/15 text-emerald-300',
    build: 'border-cyan-500/30 bg-cyan-500/15 text-cyan-300',
    test: 'border-amber-500/30 bg-amber-500/15 text-amber-300',
    lint: 'border-violet-500/30 bg-violet-500/15 text-violet-300',
    generic: 'border-white/15 bg-white/10 text-white/70'
}

function clampNumber(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value))
}

function detectScriptIntentWithConfidence(
    name: string,
    command: string,
    context: ScriptIntentContext = {}
): ScriptIntentPrediction {
    const normalizedName = name.toLowerCase().trim()
    const normalizedCommand = command.toLowerCase().trim()
    const scores: Record<'server' | 'build' | 'test' | 'lint', number> = {
        server: 0,
        build: 0,
        test: 0,
        lint: 0
    }

    if (SERVER_SCRIPT_NAME_PATTERN.test(normalizedName)) scores.server += 3
    if (SERVER_SCRIPT_COMMAND_PATTERN.test(normalizedCommand)) scores.server += 4
    if (normalizedCommand.includes('--watch') || normalizedCommand.includes(' --hot')) scores.server += 1

    if (BUILD_SCRIPT_NAME_PATTERN.test(normalizedName)) scores.build += 3
    if (BUILD_SCRIPT_COMMAND_PATTERN.test(normalizedCommand)) scores.build += 4

    if (TEST_SCRIPT_NAME_PATTERN.test(normalizedName)) scores.test += 3
    if (TEST_SCRIPT_COMMAND_PATTERN.test(normalizedCommand)) scores.test += 4

    if (LINT_SCRIPT_NAME_PATTERN.test(normalizedName)) scores.lint += 3
    if (LINT_SCRIPT_COMMAND_PATTERN.test(normalizedCommand)) scores.lint += 4

    if (/\b(dev|start|serve)\b/.test(normalizedName)) scores.server += 1
    if (/\bbuild\b/.test(normalizedName)) scores.build += 1
    if (/\b(test|spec|e2e)\b/.test(normalizedName)) scores.test += 1
    if (/\b(lint|format)\b/.test(normalizedName)) scores.lint += 1

    const frameworks = new Set((context.frameworks || []).map((framework) => framework.toLowerCase()))
    const markers = new Set((context.markers || []).map((marker) => marker.toLowerCase()))
    const hasWebFrameworkContext =
        frameworks.has('nextjs') ||
        frameworks.has('vite') ||
        frameworks.has('nuxt') ||
        frameworks.has('astro') ||
        frameworks.has('svelte') ||
        markers.has('vite.config.ts') ||
        markers.has('vite.config.js') ||
        markers.has('next.config.js') ||
        markers.has('next.config.ts') ||
        markers.has('next.config.mjs')

    if (hasWebFrameworkContext && /\b(dev|start|serve)\b/.test(normalizedName)) {
        scores.server += 1
    }
    if (hasWebFrameworkContext && /\bbuild\b/.test(normalizedName)) {
        scores.build += 1
    }

    if (/\b(jest|vitest|playwright|cypress)\b/.test(normalizedCommand)) {
        scores.test += 2
    }
    if (/\b(eslint|prettier|stylelint|biome)\b/.test(normalizedCommand)) {
        scores.lint += 2
    }

    const ranked = (Object.entries(scores) as Array<[keyof typeof scores, number]>)
        .sort((a, b) => b[1] - a[1])
    const [topIntent, topScore] = ranked[0]
    const secondScore = ranked[1]?.[1] ?? 0

    if (topScore <= 0) {
        return { intent: 'generic', confidence: 0.4 }
    }

    const margin = topScore - secondScore
    const baseConfidence = 0.52 + topScore * 0.06 + margin * 0.08
    const confidence = clampNumber(baseConfidence, 0.5, 0.98)

    return { intent: topIntent, confidence }
}

type PackageScriptRunner = 'npm' | 'pnpm' | 'yarn' | 'bun'

function detectPackageScriptRunner(markers: string[] = []): PackageScriptRunner {
    if (markers.includes('pnpm-lock.yaml')) return 'pnpm'
    if (markers.includes('yarn.lock')) return 'yarn'
    if (markers.includes('bun.lockb') || markers.includes('bun.lock')) return 'bun'
    return 'npm'
}

function getScriptCommand(scriptName: string, runner: PackageScriptRunner): string {
    if (runner === 'yarn') return `yarn ${scriptName}`
    if (runner === 'pnpm') return `pnpm run ${scriptName}`
    if (runner === 'bun') return `bun run ${scriptName}`
    return `npm run ${scriptName}`
}

function appendScriptArgsForRunner(baseCommand: string, args: string, runner: PackageScriptRunner): string {
    const trimmedArgs = args.trim()
    if (!trimmedArgs) return baseCommand
    if (runner === 'npm' || runner === 'pnpm') {
        return `${baseCommand} -- ${trimmedArgs}`
    }
    return `${baseCommand} ${trimmedArgs}`
}

function buildServerCliArgs(scriptCommand: string, options: ScriptRunDraft): string[] {
    const normalized = scriptCommand.toLowerCase()
    if (!normalized) return []

    // `concurrently` scripts usually need per-command flags; keep these env-only by default.
    if (/\bconcurrently\b/.test(normalized)) return []

    const args: string[] = []
    const hasNextDev = /\bnext\s+dev\b/.test(normalized)
    const hasCommonDevServer = /\b(vite|nuxt|astro|webpack(?:-dev-server)?|parcel|ng\s+serve|svelte-kit|remix)\b/.test(normalized)

    if (options.port) {
        if (hasNextDev) {
            args.push(`--port ${options.port}`)
        } else if (hasCommonDevServer) {
            args.push(`--port ${options.port}`)
        }
    }

    if (options.exposeNetwork) {
        if (hasNextDev) {
            args.push('--hostname 0.0.0.0')
        } else if (hasCommonDevServer) {
            args.push('--host 0.0.0.0')
        }
    }

    return args
}

function parseEnvOverrideInput(rawValue: string): { envOverrides: Record<string, string>; error?: string } {
    const envOverrides: Record<string, string> = {}
    const trimmed = rawValue.trim()
    if (!trimmed) return { envOverrides }

    const lines = rawValue.split(/\r?\n/)
    for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
        const line = lines[lineIndex].trim()
        if (!line || line.startsWith('#')) continue

        const separatorIndex = line.indexOf('=')
        if (separatorIndex < 1) {
            return {
                envOverrides,
                error: `Environment override line ${lineIndex + 1} must use KEY=VALUE format.`
            }
        }

        const key = line.slice(0, separatorIndex).trim()
        const value = line.slice(separatorIndex + 1)
        if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) {
            return {
                envOverrides,
                error: `Invalid environment variable name "${key}" on line ${lineIndex + 1}.`
            }
        }

        envOverrides[key] = value
    }

    return { envOverrides }
}

function applyShellEnvOverrides(
    baseCommand: string,
    shell: 'powershell' | 'cmd',
    envOverrides: Record<string, string>
): string {
    const entries = Object.entries(envOverrides).filter(([, value]) => value.length > 0)
    if (entries.length === 0) return baseCommand

    if (shell === 'cmd') {
        const cmdPrefix = entries
            .map(([key, value]) => `set "${key}=${value.replace(/"/g, '\\"')}"`)
            .join(' && ')
        return `${cmdPrefix} && ${baseCommand}`
    }

    const powershellPrefix = entries
        .map(([key, value]) => `$env:${key}='${value.replace(/'/g, "''")}'`)
        .join('; ')
    return `${powershellPrefix}; ${baseCommand}`
}

interface GitBranchSummary {
    name: string
    current: boolean
    commit: string
    label: string
    isRemote: boolean
}

interface GitRemoteSummary {
    name: string
    fetchUrl: string
    pushUrl: string
}

interface GitTagSummary {
    name: string
    commit?: string
}

interface GitStashSummary {
    hash: string
    message: string
}

// Branch colors for different lanes
const BRANCH_COLORS = [
    '#22c55e', // green - main/master
    '#3b82f6', // blue - feature branches
    '#f97316', // orange - other branches
    '#a855f7', // purple - more branches
    '#06b6d4', // cyan
    '#ec4899', // pink
]

// Git Graph with branch lanes visualization
function GitGraph({ commits, onCommitClick }: { commits: GitCommit[], onCommitClick?: (commit: GitCommit) => void }) {
    // Build commit map and calculate lanes
    const commitMap = new Map(commits.map(c => [c.hash, c]))

    // Calculate lane assignments for each commit
    const lanes = useMemo(() => {
        const laneMap = new Map<string, number>()
        const activeLanes: (string | null)[] = []

        commits.forEach((commit, idx) => {
            const isMerge = commit.parents.length > 1

            // Find if this commit continues an existing lane
            let assignedLane = -1
            for (let i = 0; i < activeLanes.length; i++) {
                if (activeLanes[i] === commit.hash) {
                    assignedLane = i
                    break
                }
            }

            // If no lane found, use lane 0 (main line) or find empty
            if (assignedLane === -1) {
                assignedLane = 0
                if (activeLanes[0] !== null && activeLanes[0] !== commit.hash) {
                    // Find first empty lane or create new
                    const emptyLane = activeLanes.findIndex(l => l === null)
                    assignedLane = emptyLane === -1 ? activeLanes.length : emptyLane
                }
            }

            laneMap.set(commit.hash, assignedLane)

            // Update lanes for parents
            if (commit.parents.length > 0) {
                // First parent continues in same lane
                activeLanes[assignedLane] = commit.parents[0]

                // Additional parents (merge sources) get their own lanes
                for (let i = 1; i < commit.parents.length; i++) {
                    const parentHash = commit.parents[i]
                    if (!laneMap.has(parentHash)) {
                        const emptyLane = activeLanes.findIndex((l, idx) => l === null && idx !== assignedLane)
                        const newLane = emptyLane === -1 ? activeLanes.length : emptyLane
                        activeLanes[newLane] = parentHash
                    }
                }
            } else {
                activeLanes[assignedLane] = null
            }
        })

        return laneMap
    }, [commits])

    const maxLanes = Math.max(...Array.from(lanes.values())) + 1
    const LANE_WIDTH = 24
    const NODE_SIZE = 10
    const ROW_HEIGHT = 64

    return (
        <div className="relative overflow-x-auto">
            <svg
                className="absolute top-0 left-0 pointer-events-none"
                width={maxLanes * LANE_WIDTH + 20}
                height={commits.length * ROW_HEIGHT}
                style={{ minWidth: maxLanes * LANE_WIDTH + 20 }}
            >
                {/* Draw connecting lines */}
                {commits.map((commit, idx) => {
                    const lane = lanes.get(commit.hash) || 0
                    const x = lane * LANE_WIDTH + LANE_WIDTH / 2 + 8
                    const y = idx * ROW_HEIGHT + ROW_HEIGHT / 2
                    const color = BRANCH_COLORS[lane % BRANCH_COLORS.length]

                    return (
                        <g key={`lines-${commit.hash}`}>
                            {/* Line to next commit in same lane */}
                            {idx < commits.length - 1 && (
                                <line
                                    x1={x}
                                    y1={y + NODE_SIZE / 2}
                                    x2={x}
                                    y2={(idx + 1) * ROW_HEIGHT + ROW_HEIGHT / 2 - NODE_SIZE / 2}
                                    stroke={color}
                                    strokeWidth={2}
                                    opacity={0.6}
                                />
                            )}

                            {/* Merge lines from other lanes */}
                            {commit.parents.slice(1).map((parentHash, pIdx) => {
                                const parentIdx = commits.findIndex(c => c.hash === parentHash)
                                if (parentIdx === -1) return null

                                const parentLane = lanes.get(parentHash) || 0
                                const parentX = parentLane * LANE_WIDTH + LANE_WIDTH / 2 + 8
                                const parentY = parentIdx * ROW_HEIGHT + ROW_HEIGHT / 2
                                const parentColor = BRANCH_COLORS[parentLane % BRANCH_COLORS.length]

                                // Draw curved merge line
                                const midY = (y + parentY) / 2

                                return (
                                    <path
                                        key={`merge-${commit.hash}-${parentHash}`}
                                        d={`M ${parentX} ${parentY + NODE_SIZE / 2} 
                                            C ${parentX} ${midY}, ${x} ${midY}, ${x} ${y - NODE_SIZE / 2}`}
                                        stroke={parentColor}
                                        strokeWidth={2}
                                        fill="none"
                                        opacity={0.6}
                                    />
                                )
                            })}
                        </g>
                    )
                })}

                {/* Draw nodes on top */}
                {commits.map((commit, idx) => {
                    const lane = lanes.get(commit.hash) || 0
                    const x = lane * LANE_WIDTH + LANE_WIDTH / 2 + 8
                    const y = idx * ROW_HEIGHT + ROW_HEIGHT / 2
                    const color = BRANCH_COLORS[lane % BRANCH_COLORS.length]
                    const isMerge = commit.parents.length > 1

                    return (
                        <g key={`node-${commit.hash}`}>
                            <circle
                                cx={x}
                                cy={y}
                                r={isMerge ? NODE_SIZE / 2 + 2 : NODE_SIZE / 2}
                                fill="#09090b"
                                stroke={color}
                                strokeWidth={isMerge ? 3 : 2}
                            />
                            {isMerge && (
                                <circle
                                    cx={x}
                                    cy={y}
                                    r={3}
                                    fill={color}
                                />
                            )}
                        </g>
                    )
                })}
            </svg>

            {/* Commit details */}
            <div style={{ marginLeft: maxLanes * LANE_WIDTH + 20 }}>
                {commits.map((commit, idx) => {
                    const isMerge = commit.parents.length > 1
                    const lane = lanes.get(commit.hash) || 0
                    const color = BRANCH_COLORS[lane % BRANCH_COLORS.length]

                    return (
                        <div
                            key={commit.hash}
                            className="flex items-center group cursor-pointer hover:bg-white/5 rounded-lg transition-colors -ml-2 pl-2"
                            style={{ height: ROW_HEIGHT }}
                            onClick={() => onCommitClick?.(commit)}
                        >
                            <div className="flex-1 min-w-0 pr-4">
                                <div className="flex items-center gap-2 mb-0.5">
                                    <span className="text-sm font-medium text-white truncate">
                                        {commit.message}
                                    </span>
                                    {isMerge && (
                                        <span
                                            className="text-[10px] px-1.5 py-0.5 rounded font-medium shrink-0"
                                            style={{ backgroundColor: `${color}20`, color }}
                                        >
                                            Merge
                                        </span>
                                    )}
                                </div>
                                <div className="flex items-center gap-3 text-xs text-white/40">
                                    <span className="font-mono bg-white/5 px-1.5 py-0.5 rounded text-white/50">
                                        {commit.shortHash}
                                    </span>
                                    <span className="flex items-center gap-1">
                                        <User size={10} /> {commit.author}
                                    </span>
                                    <span className="flex items-center gap-1">
                                        <Calendar size={10} /> {new Date(commit.date).toLocaleDateString()}
                                    </span>
                                </div>
                            </div>
                        </div>
                    )
                })}
            </div>
        </div>
    )
}

// -- Init Git Modal --
function InitGitModal({
    isOpen,
    onClose,
    step,
    branchName,
    setBranchName,
    customBranchName,
    setCustomBranchName,
    createGitignore,
    setCreateGitignore,
    gitignoreTemplate,
    setGitignoreTemplate,
    availableTemplates,
    availablePatterns,
    selectedPatterns,
    setSelectedPatterns,
    patternSearch,
    setPatternSearch,
    createInitialCommit,
    setCreateInitialCommit,
    initialCommitMessage,
    setInitialCommitMessage,
    isInitializing,
    onInit,
    remoteUrl,
    setRemoteUrl,
    isAddingRemote,
    onAddRemote,
    onSkipRemote
}: {
    isOpen: boolean
    onClose: () => void
    step: 'config' | 'remote'
    branchName: 'main' | 'master' | 'custom'
    setBranchName: (value: 'main' | 'master' | 'custom') => void
    customBranchName: string
    setCustomBranchName: (value: string) => void
    createGitignore: boolean
    setCreateGitignore: (value: boolean) => void
    gitignoreTemplate: string
    setGitignoreTemplate: (value: string) => void
    availableTemplates: string[]
    availablePatterns: any[]
    selectedPatterns: Set<string>
    setSelectedPatterns: (value: Set<string>) => void
    patternSearch: string
    setPatternSearch: (value: string) => void
    createInitialCommit: boolean
    setCreateInitialCommit: (value: boolean) => void
    initialCommitMessage: string
    setInitialCommitMessage: (value: string) => void
    isInitializing: boolean
    onInit: () => void
    remoteUrl: string
    setRemoteUrl: (value: string) => void
    isAddingRemote: boolean
    onAddRemote: () => void
    onSkipRemote: () => void
}) {
    const deferredPatternSearch = useDeferredValue(patternSearch)
    const patternSearchValue = deferredPatternSearch.toLowerCase()
    if (!isOpen) return null

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md animate-fadeIn" onClick={step === 'config' ? onClose : undefined}>
            <div
                className="bg-sparkle-card border border-white/10 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col m-4 overflow-hidden"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between p-5 border-b border-white/5 bg-white/5">
                    <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                        <GitBranch size={20} className="text-[var(--accent-primary)]" />
                        {step === 'config' ? 'Initialize Git Repository' : 'Add Remote Repository'}
                    </h3>
                    {step === 'config' && (
                        <button onClick={onClose} className="text-white/40 hover:text-white transition-colors p-1 rounded-lg hover:bg-white/10">
                            <X size={20} />
                        </button>
                    )}
                </div>

                {/* Content */}
                <div className="overflow-y-auto p-6 custom-scrollbar flex-1 space-y-6">
                    {step === 'config' ? (
                        <>
                            {/* Branch Name */}
                            <div>
                                <label className="block text-sm font-medium text-white/80 mb-3">
                                    Default Branch Name
                                </label>
                                <div className="space-y-2">
                                    <div className="p-3 rounded-lg hover:bg-white/5 transition-colors">
                                        <Radio
                                            checked={branchName === 'main'}
                                            onChange={() => setBranchName('main')}
                                            label="main"
                                            description="Recommended default branch name"
                                        />
                                    </div>
                                    <div className="p-3 rounded-lg hover:bg-white/5 transition-colors">
                                        <Radio
                                            checked={branchName === 'master'}
                                            onChange={() => setBranchName('master')}
                                            label="master"
                                            description="Traditional default branch name"
                                        />
                                    </div>
                                    <div className="p-3 rounded-lg hover:bg-white/5 transition-colors">
                                        <div className="flex items-center gap-3">
                                            <Radio
                                                checked={branchName === 'custom'}
                                                onChange={() => setBranchName('custom')}
                                                label="Custom"
                                                description="Enter your own branch name"
                                            />
                                        </div>
                                        {branchName === 'custom' && (
                                            <div className="mt-3 ml-8">
                                                <Input
                                                    value={customBranchName}
                                                    onChange={setCustomBranchName}
                                                    placeholder="branch-name"
                                                    size="sm"
                                                />
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* .gitignore */}
                            <div>
                                <Checkbox
                                    checked={createGitignore}
                                    onChange={setCreateGitignore}
                                    label="Create .gitignore file"
                                    description="Automatically ignore common files and directories"
                                    className="mb-4"
                                />
                                {createGitignore && (
                                    <div className="space-y-3 ml-8">
                                        <div>
                                            <label className="block text-xs font-medium text-white/60 mb-2">Template</label>
                                            <Select
                                                value={gitignoreTemplate}
                                                onChange={setGitignoreTemplate}
                                                options={availableTemplates.map(t => ({ value: t, label: t }))}
                                                size="sm"
                                            />
                                        </div>

                                        {/* Custom Gitignore Editor */}
                                        {gitignoreTemplate === 'Custom' && (
                                            <div className="bg-black/30 rounded-xl border border-white/5 p-4">
                                                <div className="flex items-center justify-between mb-3">
                                                    <h4 className="text-sm font-medium text-white/80">Select Patterns to Ignore</h4>
                                                    <span className="text-xs text-white/40">{selectedPatterns.size} selected</span>
                                                </div>

                                                {/* Search */}
                                                <div className="relative mb-3">
                                                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30 pointer-events-none" />
                                                    <Input
                                                        value={patternSearch}
                                                        onChange={setPatternSearch}
                                                        placeholder="Search patterns..."
                                                        size="sm"
                                                        className="pl-9"
                                                    />
                                                </div>

                                                {/* Pattern List */}
                                                <div className="max-h-64 overflow-y-auto custom-scrollbar space-y-3">
                                                    {['dependencies', 'build', 'environment', 'ide', 'os', 'logs', 'cache', 'testing'].map(category => {
                                                        const categoryPatterns = availablePatterns.filter(p =>
                                                            p.category === category &&
                                                            (!patternSearchValue ||
                                                                p.label.toLowerCase().includes(patternSearchValue) ||
                                                                p.description.toLowerCase().includes(patternSearchValue)
                                                            )
                                                        )

                                                        if (categoryPatterns.length === 0) return null

                                                        const categoryNames: Record<string, string> = {
                                                            'dependencies': 'Dependencies',
                                                            'build': 'Build Outputs',
                                                            'environment': 'Environment',
                                                            'ide': 'IDE & Editors',
                                                            'os': 'Operating System',
                                                            'logs': 'Logs',
                                                            'cache': 'Cache & Temp',
                                                            'testing': 'Testing'
                                                        }

                                                        return (
                                                            <div key={category}>
                                                                <div className="text-[10px] uppercase font-bold text-white/40 mb-2 px-1 tracking-wider">
                                                                    {categoryNames[category]}
                                                                </div>
                                                                <div className="space-y-1">
                                                                    {categoryPatterns.map(pattern => (
                                                                        <div key={pattern.id} className="rounded-lg hover:bg-white/5 transition-colors">
                                                                            <Checkbox
                                                                                checked={selectedPatterns.has(pattern.id)}
                                                                                onChange={(checked) => {
                                                                                    const newSelected = new Set(selectedPatterns)
                                                                                    if (checked) {
                                                                                        newSelected.add(pattern.id)
                                                                                    } else {
                                                                                        newSelected.delete(pattern.id)
                                                                                    }
                                                                                    setSelectedPatterns(newSelected)
                                                                                }}
                                                                                label={pattern.label}
                                                                                description={pattern.description}
                                                                                size="sm"
                                                                                className="p-2"
                                                                            />
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        )
                                                    })}
                                                </div>

                                                {/* Quick Actions */}
                                                <div className="flex items-center gap-2 mt-3 pt-3 border-t border-white/5">
                                                    <button
                                                        onClick={() => setSelectedPatterns(new Set(availablePatterns.map(p => p.id)))}
                                                        className="flex-1 px-3 py-2 text-xs font-medium rounded-lg bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-all border border-white/10 hover:border-white/20"
                                                    >
                                                        Select All
                                                    </button>
                                                    <button
                                                        onClick={() => setSelectedPatterns(new Set())}
                                                        className="flex-1 px-3 py-2 text-xs font-medium rounded-lg bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-all border border-white/10 hover:border-white/20"
                                                    >
                                                        Clear All
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Initial Commit */}
                            <div>
                                <Checkbox
                                    checked={createInitialCommit}
                                    onChange={setCreateInitialCommit}
                                    label="Create initial commit"
                                    description="Stage all files and create the first commit (optional)"
                                    className="mb-4"
                                />
                                {createInitialCommit && (
                                    <div className="ml-8">
                                        <label className="block text-xs font-medium text-white/60 mb-2">Commit Message</label>
                                        <Input
                                            value={initialCommitMessage}
                                            onChange={setInitialCommitMessage}
                                            placeholder="Initial commit"
                                            size="sm"
                                        />
                                    </div>
                                )}
                            </div>

                            {/* Info Box */}
                            <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4">
                                <p className="text-xs text-blue-400">
                                    This will initialize a new Git repository in your project directory. After initialization, you'll be prompted to add a remote repository (optional).
                                </p>
                            </div>
                        </>
                    ) : (
                        <>
                            {/* Remote URL */}
                            <div>
                                <label className="block text-sm font-medium text-white/80 mb-3">
                                    Remote Repository URL
                                </label>
                                <Input
                                    value={remoteUrl}
                                    onChange={setRemoteUrl}
                                    placeholder="https://github.com/username/repo.git"
                                    type="url"
                                />
                                <p className="text-xs text-white/40 mt-2">
                                    Enter the URL of your remote repository (GitHub, GitLab, etc.)
                                </p>
                            </div>

                            {/* Info Box */}
                            <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4">
                                <p className="text-xs text-green-400">
                                    ✓ Git repository initialized successfully! You can now add a remote repository to push your code, or skip this step and add it later.
                                </p>
                            </div>
                        </>
                    )}
                </div>

                {/* Footer */}
                <div className="flex items-center gap-3 p-5 border-t border-white/5 bg-black/20">
                    {step === 'config' ? (
                        <>
                            <button
                                onClick={onClose}
                                className="flex-1 px-4 py-2.5 bg-white/5 hover:bg-white/10 text-white text-sm font-medium rounded-lg transition-all border border-white/10"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={onInit}
                                disabled={isInitializing || (branchName === 'custom' && !customBranchName.trim())}
                                className="flex-1 px-4 py-2.5 bg-[var(--accent-primary)] hover:bg-[var(--accent-primary)]/80 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-all flex items-center justify-center gap-2"
                            >
                                {isInitializing ? (
                                    <>
                                        <RefreshCw size={16} className="animate-spin" />
                                        Initializing...
                                    </>
                                ) : (
                                    <>
                                        <GitBranch size={16} />
                                        Initialize Repository
                                    </>
                                )}
                            </button>
                        </>
                    ) : (
                        <>
                            <button
                                onClick={onSkipRemote}
                                disabled={isAddingRemote}
                                className="flex-1 px-4 py-2.5 bg-white/5 hover:bg-white/10 text-white text-sm font-medium rounded-lg transition-all border border-white/10 disabled:opacity-50"
                            >
                                Skip for Now
                            </button>
                            <button
                                onClick={onAddRemote}
                                disabled={isAddingRemote || !remoteUrl.trim()}
                                className="flex-1 px-4 py-2.5 bg-[var(--accent-primary)] hover:bg-[var(--accent-primary)]/80 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-all flex items-center justify-center gap-2"
                            >
                                {isAddingRemote ? (
                                    <>
                                        <RefreshCw size={16} className="animate-spin" />
                                        Adding Remote...
                                    </>
                                ) : (
                                    <>
                                        <GitPullRequest size={16} />
                                        Add Remote
                                    </>
                                )}
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>
    )
}

// -- Author Mismatch Modal --
function AuthorMismatchModal({
    gitUser,
    repoOwner,
    onConfirm,
    onCancel,
    dontShowAgain,
    setDontShowAgain
}: {
    gitUser: { name: string; email: string },
    repoOwner: string,
    onConfirm: () => void,
    onCancel: () => void,
    dontShowAgain: boolean,
    setDontShowAgain: (value: boolean) => void
}) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md animate-fadeIn" onClick={onCancel}>
            <div
                className="bg-sparkle-card border border-yellow-500/30 rounded-2xl shadow-2xl w-full max-w-md m-4 overflow-hidden"
                onClick={e => e.stopPropagation()}
            >
                <div className="p-6">
                    <div className="flex items-start gap-4 mb-4">
                        <div className="p-3 rounded-xl bg-yellow-500/10 border border-yellow-500/20">
                            <AlertCircle size={24} className="text-yellow-500" />
                        </div>
                        <div className="flex-1">
                            <h3 className="text-lg font-semibold text-white mb-2">
                                Author Mismatch Warning
                            </h3>
                            <p className="text-sm text-white/60 mb-4">
                                Your current Git user doesn't match the repository owner.
                            </p>

                            <div className="space-y-3 bg-black/30 rounded-xl p-4 border border-white/5">
                                <div>
                                    <p className="text-xs text-white/40 mb-1">Repository Owner:</p>
                                    <p className="text-sm font-mono text-white/80">{repoOwner}</p>
                                </div>
                                <div>
                                    <p className="text-xs text-white/40 mb-1">Current Git User:</p>
                                    <p className="text-sm font-mono text-white/80">{gitUser.name}</p>
                                    <p className="text-xs font-mono text-white/40">{gitUser.email}</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <label className="flex items-center gap-2 mb-4 cursor-pointer group">
                        <input
                            type="checkbox"
                            checked={dontShowAgain}
                            onChange={(e) => setDontShowAgain(e.target.checked)}
                            className="w-4 h-4 rounded border-white/20 bg-white/5 text-[var(--accent-primary)] focus:ring-2 focus:ring-[var(--accent-primary)]/50"
                        />
                        <span className="text-sm text-white/60 group-hover:text-white/80 transition-colors">
                            Don't show this warning again
                        </span>
                    </label>

                    <div className="flex items-center gap-3">
                        <button
                            onClick={onCancel}
                            className="flex-1 px-4 py-2.5 bg-white/5 hover:bg-white/10 text-white text-sm font-medium rounded-lg transition-all border border-white/10"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={onConfirm}
                            className="flex-1 px-4 py-2.5 bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-500 hover:text-yellow-400 text-sm font-medium rounded-lg transition-all border border-yellow-500/30"
                        >
                            Commit Anyway
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}

// -- Dependencies Modal --
function DependenciesModal({ dependencies, onClose }: { dependencies: Record<string, string>, onClose: () => void }) {
    const [search, setSearch] = useState('')
    const deferredSearch = useDeferredValue(search)
    const searchValue = deferredSearch.toLowerCase()
    const filtered = useMemo(() => Object.entries(dependencies).filter(([name]) =>
        name.toLowerCase().includes(searchValue)
    ), [dependencies, searchValue])

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md animate-fadeIn" onClick={onClose}>
            <div
                className="bg-sparkle-card border border-white/10 rounded-2xl shadow-2xl w-full max-w-xl max-h-[80vh] flex flex-col m-4 overflow-hidden"
                onClick={e => e.stopPropagation()}
            >
                <div className="flex items-center justify-between p-5 border-b border-white/5 bg-white/5">
                    <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                        <Package size={20} className="text-[var(--accent-primary)]" />
                        Dependencies
                        <span className="px-2 py-0.5 rounded-full bg-white/10 text-xs font-normal text-white/60">
                            {Object.keys(dependencies).length}
                        </span>
                    </h3>
                    <button onClick={onClose} className="text-white/40 hover:text-white transition-colors p-1 rounded-lg hover:bg-white/10">
                        <X size={20} />
                    </button>
                </div>

                <div className="p-4 border-b border-white/5 bg-black/20">
                    <div className="relative">
                        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search packages..."
                            autoFocus
                            className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-[var(--accent-primary)]/50 focus:bg-white/10 transition-all"
                        />
                    </div>
                </div>

                <div className="overflow-y-auto p-2 custom-scrollbar flex-1 bg-black/10">
                    {filtered.length > 0 ? (
                        <div className="grid grid-cols-1 gap-1">
                            {filtered.map(([name, version]) => (
                                <div key={name} className="flex items-center justify-between p-3 hover:bg-white/5 rounded-xl group transition-all border border-transparent hover:border-white/5">
                                    <span className="text-sm text-white/80 font-mono font-medium">{name}</span>
                                    <div className="flex items-center gap-3">
                                        <span className="text-xs text-white/40 font-mono px-2 py-1 rounded bg-black/30 border border-white/5">{version}</span>
                                        <a
                                            href={`https://www.npmjs.com/package/${name}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="opacity-0 group-hover:opacity-100 text-[var(--accent-primary)] hover:brightness-125 transition-all p-1.5 hover:bg-[var(--accent-primary)]/10 rounded-lg"
                                            title="View on npm"
                                        >
                                            <ExternalLink size={14} />
                                        </a>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center py-16 text-white/30">
                            <Package size={48} className="mb-4 opacity-20" />
                            <p className="text-sm">No packages found</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}

// -- Working Changes View --
function WorkingChangesView({
    files,
    projectPath,
    currentPage,
    onPageChange
}: {
    files: FileTreeNode[],
    projectPath: string,
    currentPage: number,
    onPageChange: (page: number) => void
}) {
    const [expandedFiles, setExpandedFiles] = useState<Set<string>>(new Set())
    const [fileDiffs, setFileDiffs] = useState<Map<string, string>>(new Map())
    const [loadingDiffs, setLoadingDiffs] = useState<Set<string>>(new Set())
    const [showFullDiff, setShowFullDiff] = useState<Set<string>>(new Set())
    const [isExpandingAll, setIsExpandingAll] = useState(false)

    const PREVIEW_LINES = 10
    const ITEMS_PER_PAGE = 15

    // Paginate files
    const paginatedFiles = files.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE)
    const totalPages = Math.ceil(files.length / ITEMS_PER_PAGE)

    const toggleFile = async (file: FileTreeNode) => {
        const isExpanded = expandedFiles.has(file.path)

        if (isExpanded) {
            // Collapse
            setExpandedFiles(prev => {
                const next = new Set(prev)
                next.delete(file.path)
                return next
            })
        } else {
            // Expand and load diff if not already loaded
            setExpandedFiles(prev => new Set(prev).add(file.path))

            if (!fileDiffs.has(file.path)) {
                setLoadingDiffs(prev => new Set(prev).add(file.path))

                try {
                    const result = await window.devscope.getWorkingDiff(projectPath, file.path)
                    if (result.success) {
                        setFileDiffs(prev => new Map(prev).set(file.path, result.diff))
                    }
                } catch (err) {
                    console.error('Failed to load diff:', err)
                } finally {
                    setLoadingDiffs(prev => {
                        const next = new Set(prev)
                        next.delete(file.path)
                        return next
                    })
                }
            }
        }
    }

    const toggleFullDiff = (path: string) => {
        setShowFullDiff(prev => {
            const next = new Set(prev)
            if (next.has(path)) {
                next.delete(path)
            } else {
                next.add(path)
            }
            return next
        })
    }

    const expandAll = async () => {
        setIsExpandingAll(true)

        // Expand all files first
        setExpandedFiles(new Set(paginatedFiles.map(f => f.path)))

        // Load diffs for files that don't have them yet
        const filesToLoad = paginatedFiles.filter(file => !fileDiffs.has(file.path))

        if (filesToLoad.length > 0) {
            // Load all diffs in parallel
            const loadPromises = filesToLoad.map(async (file) => {
                setLoadingDiffs(prev => new Set(prev).add(file.path))

                try {
                    const result = await window.devscope.getWorkingDiff(projectPath, file.path)
                    if (result.success) {
                        setFileDiffs(prev => new Map(prev).set(file.path, result.diff))
                    }
                } catch (err) {
                    console.error('Failed to load diff:', err)
                } finally {
                    setLoadingDiffs(prev => {
                        const next = new Set(prev)
                        next.delete(file.path)
                        return next
                    })
                }
            })

            await Promise.all(loadPromises)
        }

        setIsExpandingAll(false)
    }

    const collapseAll = () => {
        setExpandedFiles(new Set())
        setShowFullDiff(new Set())
    }

    return (
        <div className="space-y-2">
            {/* Toolbar */}
            <div className="flex items-center justify-between pb-2">
                <div className="text-xs text-white/50">
                    {files.length} {files.length === 1 ? 'file' : 'files'} changed
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={expandAll}
                        disabled={isExpandingAll}
                        className="px-3 py-1.5 text-xs font-medium rounded-lg bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-all flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isExpandingAll ? (
                            <>
                                <RefreshCw size={12} className="animate-spin" />
                                Loading...
                            </>
                        ) : (
                            <>
                                <ChevronsUpDown size={12} />
                                Expand All
                            </>
                        )}
                    </button>
                    <button
                        onClick={collapseAll}
                        disabled={isExpandingAll}
                        className="px-3 py-1.5 text-xs font-medium rounded-lg bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-all flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <ChevronsDownUp size={12} />
                        Collapse All
                    </button>
                </div>
            </div>

            {/* File List */}
            {paginatedFiles.map((file) => {
                const isExpanded = expandedFiles.has(file.path)
                const isLoading = loadingDiffs.has(file.path)
                const diff = fileDiffs.get(file.path) || ''
                const showFull = showFullDiff.has(file.path)
                const diffLines = diff.split('\n')
                const shouldTruncate = diffLines.length > PREVIEW_LINES + 5
                const displayLines = (isExpanded && !showFull && shouldTruncate)
                    ? diffLines.slice(0, PREVIEW_LINES)
                    : diffLines

                return (
                    <div key={file.path} className="bg-black/30 rounded-xl border border-white/5 overflow-hidden">
                        {/* File Header */}
                        <button
                            onClick={() => toggleFile(file)}
                            className="w-full flex items-center justify-between p-3 hover:bg-white/5 transition-colors group"
                        >
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                                <ChevronRight
                                    size={16}
                                    className={cn(
                                        "text-white/40 transition-transform shrink-0",
                                        isExpanded && "rotate-90"
                                    )}
                                />
                                <span className={cn(
                                    "text-[10px] uppercase font-bold px-1.5 py-0.5 rounded shrink-0",
                                    file.gitStatus === 'modified' && "bg-[#E2C08D]/20 text-[#E2C08D]",
                                    file.gitStatus === 'untracked' && "bg-[#73C991]/20 text-[#73C991]",
                                    file.gitStatus === 'added' && "bg-[#73C991]/20 text-[#73C991]",
                                    file.gitStatus === 'deleted' && "bg-[#FF6B6B]/20 text-[#FF6B6B]",
                                )}>
                                    {file.gitStatus?.substring(0, 1) || '?'}
                                </span>
                                {getFileIcon(file.name, false)}
                                <span className="text-sm font-mono text-white/80 truncate">
                                    {file.name}
                                </span>
                            </div>
                            <span className="text-xs text-white/30 truncate max-w-[200px] shrink-0">
                                {file.path.replace(file.name, '')}
                            </span>
                        </button>

                        {/* File Diff */}
                        {isExpanded && (
                            <div className="border-t border-white/5 bg-black/40">
                                {isLoading ? (
                                    <div className="flex items-center justify-center py-8 text-white/30">
                                        <RefreshCw size={16} className="animate-spin mr-2" />
                                        <span className="text-xs">Loading diff...</span>
                                    </div>
                                ) : diff ? (
                                    <>
                                        <pre className="text-xs font-mono text-white/70 whitespace-pre-wrap break-words p-4 overflow-x-auto">
                                            {displayLines.map((line, lineIdx) => {
                                                let lineClass = ''
                                                if (line.startsWith('+') && !line.startsWith('+++')) {
                                                    lineClass = 'text-green-400 bg-green-500/10'
                                                } else if (line.startsWith('-') && !line.startsWith('---')) {
                                                    lineClass = 'text-red-400 bg-red-500/10'
                                                } else if (line.startsWith('@@')) {
                                                    lineClass = 'text-blue-400 bg-blue-500/10'
                                                } else if (line.startsWith('diff') || line.startsWith('index') || line.startsWith('---') || line.startsWith('+++')) {
                                                    lineClass = 'text-white/40'
                                                }

                                                return (
                                                    <div key={lineIdx} className={cn('px-2 -mx-2', lineClass)}>
                                                        {line || ' '}
                                                    </div>
                                                )
                                            })}
                                        </pre>

                                        {shouldTruncate && (
                                            <div className="border-t border-white/5 p-3 text-center">
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation()
                                                        toggleFullDiff(file.path)
                                                    }}
                                                    className="text-xs text-[var(--accent-primary)] hover:text-white transition-colors font-medium"
                                                >
                                                    {showFull
                                                        ? `Show Less`
                                                        : `Show ${diffLines.length - PREVIEW_LINES} More Lines...`
                                                    }
                                                </button>
                                            </div>
                                        )}
                                    </>
                                ) : (
                                    <div className="flex items-center justify-center py-8 text-white/30">
                                        <span className="text-xs">No diff available</span>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )
            })}

            {/* Pagination */}
            {files.length > ITEMS_PER_PAGE && (
                <div className="flex items-center justify-between pt-4 mt-4 border-t border-white/5">
                    <span className="text-xs text-white/40">
                        Showing {((currentPage - 1) * ITEMS_PER_PAGE) + 1}-{Math.min(currentPage * ITEMS_PER_PAGE, files.length)} of {files.length}
                    </span>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => onPageChange(Math.max(1, currentPage - 1))}
                            disabled={currentPage === 1}
                            className="px-3 py-1.5 text-xs font-medium rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                        >
                            Previous
                        </button>
                        <span className="text-xs text-white/60 px-2">
                            {currentPage} / {totalPages}
                        </span>
                        <button
                            onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
                            disabled={currentPage >= totalPages}
                            className="px-3 py-1.5 text-xs font-medium rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                        >
                            Next
                        </button>
                    </div>
                </div>
            )}
        </div>
    )
}

// -- Commit Diff Modal --
function CommitDiffModal({ commit, diff, loading, onClose }: { commit: GitCommit, diff: string, loading: boolean, onClose: () => void }) {
    const [expandedFiles, setExpandedFiles] = useState<Set<string>>(new Set())
    const [showFullDiff, setShowFullDiff] = useState<Set<string>>(new Set())
    const [showCommitInfo, setShowCommitInfo] = useState(false)
    const [copiedHash, setCopiedHash] = useState(false)

    const PREVIEW_LINES = 10 // Show first 10 lines when truncated

    // Parse diff into file sections
    const parsedDiff = useMemo(() => {
        if (!diff) return []

        const files: Array<{ path: string; diff: string; additions: number; deletions: number; totalLines: number }> = []
        const lines = diff.split('\n')
        let currentFile: { path: string; diff: string; additions: number; deletions: number; totalLines: number } | null = null
        let inDiff = false

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i]

            // Detect file header (diff --git a/... b/...)
            if (line.startsWith('diff --git')) {
                if (currentFile) {
                    files.push(currentFile)
                }

                // Extract file path from "diff --git a/path b/path"
                const match = line.match(/diff --git a\/(.*?) b\/(.*)/)
                const path = match ? match[2] : 'unknown'

                currentFile = { path, diff: line + '\n', additions: 0, deletions: 0, totalLines: 0 }
                inDiff = true
            } else if (currentFile && inDiff) {
                currentFile.diff += line + '\n'
                currentFile.totalLines++

                // Count additions and deletions
                if (line.startsWith('+') && !line.startsWith('+++')) {
                    currentFile.additions++
                } else if (line.startsWith('-') && !line.startsWith('---')) {
                    currentFile.deletions++
                }
            }
        }

        if (currentFile) {
            files.push(currentFile)
        }

        return files
    }, [diff])

    const commitMeta = useMemo(() => {
        const lines = diff.split('\n')
        const fullHashLine = lines.find(line => line.startsWith('commit '))
        const authorLine = lines.find(line => line.startsWith('Author:'))
        const authorDateLine = lines.find(line => line.startsWith('AuthorDate:'))
        const commitDateLine = lines.find(line => line.startsWith('CommitDate:'))

        const fullHash = (fullHashLine?.replace(/^commit\s+/, '').trim() || commit.hash).trim()

        let authorName = commit.author
        let authorEmail: string | null = null
        if (authorLine) {
            const raw = authorLine.replace(/^Author:\s*/, '').trim()
            const match = raw.match(/^(.*)\s<(.+)>$/)
            if (match) {
                authorName = match[1].trim() || commit.author
                authorEmail = match[2].trim()
            } else {
                authorName = raw || commit.author
            }
        }

        const authorDate = (authorDateLine?.replace(/^AuthorDate:\s*/, '').trim() || commit.date).trim()
        const commitDate = (commitDateLine?.replace(/^CommitDate:\s*/, '').trim() || commit.date).trim()

        const commitDateIdx = lines.findIndex(line => line.startsWith('CommitDate:'))
        const messageLines: string[] = []
        if (commitDateIdx >= 0) {
            let idx = commitDateIdx + 1
            while (idx < lines.length && lines[idx].trim() === '') idx++
            while (idx < lines.length && lines[idx].startsWith('    ')) {
                messageLines.push(lines[idx].replace(/^    /, ''))
                idx++
            }
        }

        return {
            fullHash,
            shortHash: fullHash.substring(0, 7),
            authorName,
            authorEmail,
            authorDate,
            commitDate,
            messageLines,
            isMerge: commit.parents.length > 1
        }
    }, [commit, diff])

    const totalAdditions = useMemo(() => parsedDiff.reduce((sum, file) => sum + file.additions, 0), [parsedDiff])
    const totalDeletions = useMemo(() => parsedDiff.reduce((sum, file) => sum + file.deletions, 0), [parsedDiff])

    const copyCommitHash = async () => {
        const value = commitMeta.fullHash || commit.hash
        try {
            if (window.devscope.copyToClipboard) {
                await window.devscope.copyToClipboard(value)
            } else {
                await navigator.clipboard.writeText(value)
            }
            setCopiedHash(true)
            setTimeout(() => setCopiedHash(false), 1400)
        } catch {
            setCopiedHash(false)
        }
    }

    const toggleFile = (path: string) => {
        setExpandedFiles(prev => {
            const next = new Set(prev)
            if (next.has(path)) {
                next.delete(path)
            } else {
                next.add(path)
            }
            return next
        })
    }

    const toggleFullDiff = (path: string) => {
        setShowFullDiff(prev => {
            const next = new Set(prev)
            if (next.has(path)) {
                next.delete(path)
            } else {
                next.add(path)
            }
            return next
        })
    }

    const expandAll = () => {
        setExpandedFiles(new Set(parsedDiff.map(f => f.path)))
    }

    const collapseAll = () => {
        setExpandedFiles(new Set())
        setShowFullDiff(new Set())
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md animate-fadeIn" onClick={onClose}>
            <div
                className="relative bg-sparkle-card border border-white/10 rounded-2xl shadow-2xl w-full max-w-5xl max-h-[85vh] flex flex-col m-4 overflow-hidden"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-start justify-between p-5 border-b border-white/5 bg-white/5">
                    <div className="flex-1 min-w-0">
                        <h3 className="text-lg font-semibold text-white flex items-center gap-2 mb-2">
                            <GitCommitHorizontal size={20} className="text-[var(--accent-primary)]" />
                            {commit.message}
                        </h3>
                        <div className="flex items-center gap-4 text-xs text-white/50">
                            <span className="font-mono bg-white/5 px-2 py-1 rounded text-white/60">
                                {commit.shortHash}
                            </span>
                            <span className="flex items-center gap-1">
                                <User size={12} /> {commit.author}
                            </span>
                            <span className="flex items-center gap-1">
                                <Calendar size={12} /> {new Date(commit.date).toLocaleString()}
                            </span>
                        </div>

                        {!loading && (
                            <div className="mt-3 space-y-2">
                                <div className="flex flex-wrap items-center gap-2 text-[11px]">
                                    <span className="px-2 py-1 rounded bg-white/5 border border-white/10 text-white/70">
                                        {commitMeta.isMerge ? 'Merge Commit' : 'Regular Commit'}
                                    </span>
                                    <span className="px-2 py-1 rounded bg-white/5 border border-white/10 text-white/70">
                                        {parsedDiff.length} {parsedDiff.length === 1 ? 'file' : 'files'} changed
                                    </span>
                                    <span className="px-2 py-1 rounded bg-green-500/10 border border-green-500/20 text-green-300">
                                        +{totalAdditions}
                                    </span>
                                    <span className="px-2 py-1 rounded bg-red-500/10 border border-red-500/20 text-red-300">
                                        -{totalDeletions}
                                    </span>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                                    <div className="rounded-lg bg-black/25 border border-white/10 px-3 py-2">
                                        <div className="text-white/40 mb-1">Commit Hash</div>
                                        <div className="flex items-center gap-2">
                                            <span className="font-mono text-white/80 break-all">{commitMeta.fullHash}</span>
                                            <button
                                                onClick={copyCommitHash}
                                                className="p-1 rounded hover:bg-white/10 text-white/50 hover:text-white transition-colors shrink-0"
                                                title="Copy full hash"
                                            >
                                                {copiedHash ? <Check size={12} /> : <Copy size={12} />}
                                            </button>
                                        </div>
                                    </div>
                                    <div className="rounded-lg bg-black/25 border border-white/10 px-3 py-2">
                                        <div className="text-white/40 mb-1">Author</div>
                                        <div className="text-white/80">{commitMeta.authorName}</div>
                                        {commitMeta.authorEmail && (
                                            <div className="text-white/50 font-mono text-[11px]">{commitMeta.authorEmail}</div>
                                        )}
                                    </div>
                                    <div className="rounded-lg bg-black/25 border border-white/10 px-3 py-2">
                                        <div className="text-white/40 mb-1">Authored</div>
                                        <div className="text-white/80">{new Date(commitMeta.authorDate).toLocaleString()}</div>
                                    </div>
                                    <div className="rounded-lg bg-black/25 border border-white/10 px-3 py-2">
                                        <div className="text-white/40 mb-1">Committed</div>
                                        <div className="text-white/80">{new Date(commitMeta.commitDate).toLocaleString()}</div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                    <div className="flex items-center gap-2 ml-4 shrink-0">
                        {!loading && (
                            <button
                                onClick={() => setShowCommitInfo(true)}
                                className="px-3 py-1.5 text-xs font-medium rounded-lg bg-white/5 hover:bg-white/10 text-white/70 hover:text-white transition-all border border-white/10"
                            >
                                More Info
                            </button>
                        )}
                        <button onClick={onClose} className="text-white/40 hover:text-white transition-colors p-1 rounded-lg hover:bg-white/10">
                            <X size={20} />
                        </button>
                    </div>
                </div>

                {/* Toolbar */}
                {!loading && parsedDiff.length > 0 && (
                    <div className="flex items-center justify-between px-5 py-3 border-b border-white/5 bg-black/20">
                        <div className="flex items-center gap-3 text-xs text-white/50">
                            <span className="flex items-center gap-1">
                                <File size={12} />
                                {parsedDiff.length} {parsedDiff.length === 1 ? 'file' : 'files'} changed
                            </span>
                            <span className="text-green-400">
                                +{totalAdditions}
                            </span>
                            <span className="text-red-400">
                                -{totalDeletions}
                            </span>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={expandAll}
                                className="px-3 py-1.5 text-xs font-medium rounded-lg bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-all flex items-center gap-1.5"
                            >
                                <ChevronsUpDown size={12} />
                                Expand All
                            </button>
                            <button
                                onClick={collapseAll}
                                className="px-3 py-1.5 text-xs font-medium rounded-lg bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-all flex items-center gap-1.5"
                            >
                                <ChevronsDownUp size={12} />
                                Collapse All
                            </button>
                        </div>
                    </div>
                )}

                {/* Diff Content */}
                <div className="overflow-y-auto p-4 custom-scrollbar flex-1 bg-black/10">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-16 text-white/30">
                            <RefreshCw size={32} className="mb-4 animate-spin" />
                            <p className="text-sm">Loading diff...</p>
                        </div>
                    ) : parsedDiff.length > 0 ? (
                        <div className="space-y-2">
                            {parsedDiff.map((file, idx) => {
                                const isExpanded = expandedFiles.has(file.path)
                                const showFull = showFullDiff.has(file.path)
                                const diffLines = file.diff.split('\n')
                                const shouldTruncate = diffLines.length > PREVIEW_LINES + 5 // Only truncate if significantly longer
                                const displayLines = (isExpanded && !showFull && shouldTruncate)
                                    ? diffLines.slice(0, PREVIEW_LINES)
                                    : diffLines

                                return (
                                    <div key={idx} className="bg-black/30 rounded-xl border border-white/5 overflow-hidden">
                                        {/* File Header */}
                                        <button
                                            onClick={() => toggleFile(file.path)}
                                            className="w-full flex items-center justify-between p-3 hover:bg-white/5 transition-colors group"
                                        >
                                            <div className="flex items-center gap-3 flex-1 min-w-0">
                                                <ChevronRight
                                                    size={16}
                                                    className={cn(
                                                        "text-white/40 transition-transform shrink-0",
                                                        isExpanded && "rotate-90"
                                                    )}
                                                />
                                                {getFileIcon(file.path.split('/').pop() || '', false)}
                                                <span className="text-sm font-mono text-white/80 truncate">
                                                    {file.path}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-3 text-xs shrink-0">
                                                {file.additions > 0 && (
                                                    <span className="text-green-400 font-mono">
                                                        +{file.additions}
                                                    </span>
                                                )}
                                                {file.deletions > 0 && (
                                                    <span className="text-red-400 font-mono">
                                                        -{file.deletions}
                                                    </span>
                                                )}
                                            </div>
                                        </button>

                                        {/* File Diff (Collapsible) */}
                                        {isExpanded && (
                                            <div className="border-t border-white/5 bg-black/40">
                                                <pre className="text-xs font-mono text-white/70 whitespace-pre-wrap break-words p-4 overflow-x-auto">
                                                    {displayLines.map((line, lineIdx) => {
                                                        let lineClass = ''
                                                        if (line.startsWith('+') && !line.startsWith('+++')) {
                                                            lineClass = 'text-green-400 bg-green-500/10'
                                                        } else if (line.startsWith('-') && !line.startsWith('---')) {
                                                            lineClass = 'text-red-400 bg-red-500/10'
                                                        } else if (line.startsWith('@@')) {
                                                            lineClass = 'text-blue-400 bg-blue-500/10'
                                                        } else if (line.startsWith('diff') || line.startsWith('index') || line.startsWith('---') || line.startsWith('+++')) {
                                                            lineClass = 'text-white/40'
                                                        }

                                                        return (
                                                            <div key={lineIdx} className={cn('px-2 -mx-2', lineClass)}>
                                                                {line || ' '}
                                                            </div>
                                                        )
                                                    })}
                                                </pre>

                                                {/* Show More/Less Button */}
                                                {shouldTruncate && (
                                                    <div className="border-t border-white/5 p-3 text-center">
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation()
                                                                toggleFullDiff(file.path)
                                                            }}
                                                            className="text-xs text-[var(--accent-primary)] hover:text-white transition-colors font-medium"
                                                        >
                                                            {showFull
                                                                ? `Show Less`
                                                                : `Show ${diffLines.length - PREVIEW_LINES} More Lines...`
                                                            }
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )
                            })}
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center py-16 text-white/30">
                            <FileText size={48} className="mb-4 opacity-20" />
                            <p className="text-sm">No changes to display</p>
                        </div>
                    )}
                </div>

                {showCommitInfo && (
                    <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={() => setShowCommitInfo(false)}>
                        <div
                            className="w-full max-w-3xl max-h-[80vh] overflow-y-auto custom-scrollbar rounded-2xl bg-sparkle-card border border-white/10 shadow-2xl"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 bg-white/[0.03]">
                                <h4 className="text-sm font-semibold text-white">Commit Info</h4>
                                <button
                                    onClick={() => setShowCommitInfo(false)}
                                    className="text-white/40 hover:text-white transition-colors p-1 rounded-lg hover:bg-white/10"
                                >
                                    <X size={18} />
                                </button>
                            </div>

                            <div className="p-5 space-y-3 text-xs">
                                <p className="text-white/50 text-[11px]">
                                    Extra details hidden from the default view.
                                </p>

                                {commit.parents.length > 0 && (
                                    <div className="rounded-lg bg-black/25 border border-white/10 px-3 py-2">
                                        <div className="text-white/40 mb-1">Parents ({commit.parents.length})</div>
                                        <div className="flex flex-wrap gap-1.5">
                                            {commit.parents.map(parent => (
                                                <span key={parent} className="px-2 py-0.5 rounded bg-white/5 border border-white/10 text-[11px] font-mono text-white/70">
                                                    {parent}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                <div className="rounded-lg bg-black/25 border border-white/10 px-3 py-2">
                                    <div className="text-white/40 mb-1">Commit Message</div>
                                    <pre className="text-xs text-white/75 whitespace-pre-wrap break-words font-mono">
                                        {commitMeta.messageLines.length > 0 ? commitMeta.messageLines.join('\n') : commit.message}
                                    </pre>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}



// -- Helper functions for file info --
function getFileIcon(name: string, isDirectory: boolean, isExpanded?: boolean) {
    if (isDirectory) {
        return isExpanded ? <FolderOpen size={16} className="text-blue-400" /> : <Folder size={16} className="text-blue-400" />
    }

    const ext = name.split('.').pop()?.toLowerCase()
    switch (ext) {
        case 'js':
        case 'jsx':
            return <FileCode size={16} className="text-yellow-400" />
        case 'ts':
        case 'tsx':
            return <FileCode size={16} className="text-blue-400" />
        case 'json':
            return <FileJson size={16} className="text-yellow-500" />
        case 'md':
            return <FileText size={16} className="text-white/60" />
        case 'html':
        case 'htm':
            return <Code size={16} className="text-orange-400" />
        case 'css':
        case 'scss':
        case 'sass':
            return <FileCode size={16} className="text-pink-400" />
        case 'png':
        case 'jpg':
        case 'jpeg':
        case 'gif':
        case 'svg':
        case 'webp':
            return <Image size={16} className="text-purple-400" />
        default:
            return <File size={16} className="text-white/40" />
    }
}

function formatFileSize(bytes?: number): string {
    if (!bytes) return '-'
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function countChildren(node: FileTreeNode): { files: number; folders: number } {
    let files = 0
    let folders = 0

    if (node.children) {
        for (const child of node.children) {
            if (child.type === 'directory') {
                folders++
            } else {
                files++
            }
        }
    }

    return { files, folders }
}

function buildDirectoryChildInfoMap(nodes: FileTreeNode[]): Map<string, { files: number; folders: number }> {
    const infoMap = new Map<string, { files: number; folders: number }>()
    const stack: FileTreeNode[] = [...nodes]

    while (stack.length > 0) {
        const node = stack.pop()
        if (!node || node.type !== 'directory') continue
        infoMap.set(node.path, countChildren(node))
        if (node.children) {
            for (const child of node.children) {
                if (child.type === 'directory') {
                    stack.push(child)
                }
            }
        }
    }

    return infoMap
}

// Collect all folder paths recursively
function getAllFolderPaths(nodes: FileTreeNode[]): string[] {
    const paths: string[] = []
    for (const node of nodes) {
        if (node.type === 'directory') {
            paths.push(node.path)
            if (node.children) {
                paths.push(...getAllFolderPaths(node.children))
            }
        }
    }
    return paths
}

export default function ProjectDetailsPage() {
    const { projectPath } = useParams<{ projectPath: string }>()
    const navigate = useNavigate()
    const { openTerminal } = useTerminal()
    const { settings } = useSettings()

    // State
    const [project, setProject] = useState<ProjectDetails | null>(null)
    const [fileTree, setFileTree] = useState<FileTreeNode[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [showHidden, setShowHidden] = useState(false)
    const [copiedPath, setCopiedPath] = useState(false)
    const [activeTab, setActiveTab] = useState<'readme' | 'files' | 'git'>('files')
    const [showDependenciesModal, setShowDependenciesModal] = useState(false)
    // Live project indicator (running processes)
    const [isProjectLive, setIsProjectLive] = useState(false)
    const [activePorts, setActivePorts] = useState<number[]>([])

    // Git State
    const [gitHistory, setGitHistory] = useState<GitCommit[]>([])
    const [loadingGit, setLoadingGit] = useState(false)
    const [gitView, setGitView] = useState<'changes' | 'history' | 'unpushed' | 'manage'>('manage')
    const [commitPage, setCommitPage] = useState(1)
    const [unpushedPage, setUnpushedPage] = useState(1)
    const [changesPage, setChangesPage] = useState(1)
    const COMMITS_PER_PAGE = 15
    const ITEMS_PER_PAGE = 15

    // Commit Diff Modal State
    const [selectedCommit, setSelectedCommit] = useState<GitCommit | null>(null)
    const [commitDiff, setCommitDiff] = useState<string>('')
    const [loadingDiff, setLoadingDiff] = useState(false)

    // Git Management State
    const [unpushedCommits, setUnpushedCommits] = useState<GitCommit[]>([])
    const [gitUser, setGitUser] = useState<{ name: string; email: string } | null>(null)
    const [repoOwner, setRepoOwner] = useState<string | null>(null)
    const [commitMessage, setCommitMessage] = useState('')
    const [isCommitting, setIsCommitting] = useState(false)
    const [isGeneratingCommitMessage, setIsGeneratingCommitMessage] = useState(false)
    const [isPushing, setIsPushing] = useState(false)
    const [toast, setToast] = useState<{
        message: string
        visible: boolean
        actionLabel?: string
        actionTo?: string
    } | null>(null)
    const [showAuthorMismatch, setShowAuthorMismatch] = useState(false)
    const [dontShowAuthorWarning, setDontShowAuthorWarning] = useState(false)

    // Git Init State
    const [isGitRepo, setIsGitRepo] = useState<boolean | null>(null)
    const [showInitModal, setShowInitModal] = useState(false)
    const [initStep, setInitStep] = useState<'config' | 'remote'>('config')
    const [branchName, setBranchName] = useState<'main' | 'master' | 'custom'>('main')
    const [customBranchName, setCustomBranchName] = useState('')
    const [createGitignore, setCreateGitignore] = useState(true)
    const [gitignoreTemplate, setGitignoreTemplate] = useState<string>('')
    const [availableTemplates, setAvailableTemplates] = useState<string[]>([])
    const [createInitialCommit, setCreateInitialCommit] = useState(false)
    const [initialCommitMessage, setInitialCommitMessage] = useState('Initial commit')
    const [isInitializing, setIsInitializing] = useState(false)
    const [remoteUrl, setRemoteUrl] = useState('')
    const [isAddingRemote, setIsAddingRemote] = useState(false)
    const [hasRemote, setHasRemote] = useState<boolean | null>(null)
    const [branches, setBranches] = useState<GitBranchSummary[]>([])
    const [remotes, setRemotes] = useState<GitRemoteSummary[]>([])
    const [tags, setTags] = useState<GitTagSummary[]>([])
    const [stashes, setStashes] = useState<GitStashSummary[]>([])
    const [gitStatusMap, setGitStatusMap] = useState<Record<string, FileTreeNode['gitStatus']>>({})
    const [targetBranch, setTargetBranch] = useState('')
    const [isSwitchingBranch, setIsSwitchingBranch] = useState(false)

    // Custom Gitignore State
    const [showCustomGitignore, setShowCustomGitignore] = useState(false)
    const [availablePatterns, setAvailablePatterns] = useState<any[]>([])
    const [selectedPatterns, setSelectedPatterns] = useState<Set<string>>(new Set())
    const [patternSearch, setPatternSearch] = useState('')

    // File Preview Hook
    const {
        previewFile,
        previewContent,
        loadingPreview,
        previewTruncated,
        previewSize,
        previewBytes,
        openPreview,
        closePreview,
        openFile
    } = useFilePreview()

    // README State
    const [readmeExpanded, setReadmeExpanded] = useState(false)
    const [readmeNeedsExpand, setReadmeNeedsExpand] = useState(false)
    const readmeContentRef = useRef<HTMLDivElement | null>(null)


    // Files view state
    const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set())
    const [isExpandingFolders, setIsExpandingFolders] = useState(false)
    const [sortBy, setSortBy] = useState<'name' | 'size' | 'type'>('name')
    const [sortAsc, setSortAsc] = useState(true)
    const [fileSearch, setFileSearch] = useState('')
    const [pendingScriptRun, setPendingScriptRun] = useState<PendingScriptRun | null>(null)
    const [scriptPortInput, setScriptPortInput] = useState('')
    const [scriptExposeNetwork, setScriptExposeNetwork] = useState(false)
    const [scriptAdvancedOpen, setScriptAdvancedOpen] = useState(false)
    const [scriptExtraArgsInput, setScriptExtraArgsInput] = useState('')
    const [scriptEnvInput, setScriptEnvInput] = useState('')
    const [scriptRunError, setScriptRunError] = useState<string | null>(null)

    // Derived
    const decodedPath = projectPath ? decodeURIComponent(projectPath) : ''
    const currentBranch = useMemo(() => branches.find(branch => branch.current)?.name || '', [branches])

    useEffect(() => {
        setTargetBranch(currentBranch)
    }, [currentBranch])

    useEffect(() => {
        if (!decodedPath) return
        trackRecentProject(decodedPath, 'project')
    }, [decodedPath])

    // Go back function
    const goBack = () => {
        if (window.history.length > 1) {
            navigate(-1)
        } else {
            navigate('/projects')
        }
    }

    const showToast = (message: string, actionLabel?: string, actionTo?: string) => {
        setToast({ message, visible: false, actionLabel, actionTo })
        setTimeout(() => {
            setToast(prev => prev ? { ...prev, visible: true } : prev)
        }, 10)
    }

    useEffect(() => {
        if (!toast?.visible) return

        const hideTimer = setTimeout(() => {
            setToast(prev => prev ? { ...prev, visible: false } : prev)
        }, 2600)

        const removeTimer = setTimeout(() => {
            setToast(null)
        }, 3000)

        return () => {
            clearTimeout(hideTimer)
            clearTimeout(removeTimer)
        }
    }, [toast?.visible])

    const measureReadmeOverflow = useCallback(() => {
        const element = readmeContentRef.current
        if (!element) {
            setReadmeNeedsExpand(false)
            return
        }

        const hasOverflow = element.scrollHeight > README_COLLAPSED_MAX_HEIGHT + 12
        setReadmeNeedsExpand(hasOverflow)
    }, [])

    useEffect(() => {
        // Reset expansion when switching projects/readmes.
        setReadmeExpanded(false)
    }, [project?.path, project?.readme])

    useEffect(() => {
        if (!project?.readme) {
            setReadmeNeedsExpand(false)
            return
        }

        const rafId = requestAnimationFrame(measureReadmeOverflow)
        const lateMeasure1 = window.setTimeout(measureReadmeOverflow, 120)
        const lateMeasure2 = window.setTimeout(measureReadmeOverflow, 600)

        let observer: ResizeObserver | null = null
        if (readmeContentRef.current && typeof ResizeObserver !== 'undefined') {
            observer = new ResizeObserver(() => measureReadmeOverflow())
            observer.observe(readmeContentRef.current)
        }

        return () => {
            cancelAnimationFrame(rafId)
            clearTimeout(lateMeasure1)
            clearTimeout(lateMeasure2)
            observer?.disconnect()
        }
    }, [project?.readme, activeTab, readmeExpanded, measureReadmeOverflow])

    const loadProjectDetails = async () => {
        if (!decodedPath) return

        setLoading(true)
        setError(null)

        try {
            const [detailsResult, treeResult] = await Promise.all([
                window.devscope.getProjectDetails(decodedPath),
                // Always load with showHidden: true, filter on client side
                window.devscope.getFileTree(decodedPath, { showHidden: true, maxDepth: -1 })
            ])

            if (detailsResult.success) {
                setProject(detailsResult.project)
                // Default to README if visible, otherwise Files
                if (detailsResult.project.readme) setActiveTab('readme')
            } else {
                setError(detailsResult.error || 'Failed to load project details')
            }

            if (treeResult.success) {
                setFileTree(treeResult.tree)
            }
        } catch (err: any) {
            setError(err.message || 'Failed to load project')
        } finally {
            setLoading(false)
        }
    }

    const refreshGitData = useCallback(async (refreshFileTree: boolean = false) => {
        if (!decodedPath) return

        setLoadingGit(true)

        try {
            if (refreshFileTree) {
                const treeResult = await window.devscope.getFileTree(decodedPath, { showHidden: true, maxDepth: -1 })
                if (treeResult?.success && treeResult.tree) {
                    setFileTree(treeResult.tree)
                }
            }

            const repoResult = await window.devscope.checkIsGitRepo(decodedPath)
            if (!repoResult?.success) {
                throw new Error(repoResult?.error || 'Failed to check git repository')
            }

            if (!repoResult.isGitRepo) {
                setIsGitRepo(false)
                setGitHistory([])
                setUnpushedCommits([])
                setGitUser(null)
                setRepoOwner(null)
                setHasRemote(false)
                setGitStatusMap({})
                setBranches([])
                setRemotes([])
                setTags([])
                setStashes([])
                return
            }

            setIsGitRepo(true)

            const responses = await Promise.allSettled([
                window.devscope.getGitStatus(decodedPath),
                window.devscope.getGitHistory(decodedPath),
                window.devscope.getUnpushedCommits(decodedPath),
                window.devscope.getGitUser(decodedPath),
                window.devscope.getRepoOwner(decodedPath),
                window.devscope.hasRemoteOrigin(decodedPath),
                window.devscope.listBranches(decodedPath),
                window.devscope.listRemotes(decodedPath),
                window.devscope.listTags(decodedPath),
                window.devscope.listStashes(decodedPath)
            ])

            const [
                statusResult,
                historyResult,
                unpushedResult,
                userResult,
                ownerResult,
                remoteResult,
                branchesResult,
                remotesResult,
                tagsResult,
                stashesResult
            ] = responses

            if (statusResult.status === 'fulfilled' && statusResult.value?.success) {
                setGitStatusMap(statusResult.value.status || {})
            }
            if (historyResult.status === 'fulfilled' && historyResult.value?.success) {
                setGitHistory(historyResult.value.commits || [])
            }
            if (unpushedResult.status === 'fulfilled' && unpushedResult.value?.success) {
                setUnpushedCommits(unpushedResult.value.commits || [])
            }
            if (userResult.status === 'fulfilled' && userResult.value?.success) {
                setGitUser(userResult.value.user || null)
            }
            if (ownerResult.status === 'fulfilled' && ownerResult.value?.success) {
                setRepoOwner(ownerResult.value.owner || null)
            }
            if (remoteResult.status === 'fulfilled' && remoteResult.value?.success) {
                setHasRemote(remoteResult.value.hasRemote)
            }
            if (branchesResult.status === 'fulfilled' && branchesResult.value?.success) {
                setBranches(branchesResult.value.branches || [])
            }
            if (remotesResult.status === 'fulfilled' && remotesResult.value?.success) {
                setRemotes(remotesResult.value.remotes || [])
            }
            if (tagsResult.status === 'fulfilled' && tagsResult.value?.success) {
                setTags(tagsResult.value.tags || [])
            }
            if (stashesResult.status === 'fulfilled' && stashesResult.value?.success) {
                setStashes(stashesResult.value.stashes || [])
            }
        } catch (err: any) {
            setError(err?.message || 'Failed to load git details')
        } finally {
            setLoadingGit(false)
        }
    }, [decodedPath])

    // Effect: Load Project
    useEffect(() => {
        loadProjectDetails()
    }, [decodedPath])

    // Reset git-derived state when switching projects to avoid stale cross-project data.
    useEffect(() => {
        setGitHistory([])
        setUnpushedCommits([])
        setGitUser(null)
        setRepoOwner(null)
        setHasRemote(null)
        setIsGitRepo(null)
        setGitStatusMap({})
        setBranches([])
        setRemotes([])
        setTags([])
        setStashes([])
        setTargetBranch('')
        setGitView('manage')
        setCommitPage(1)
        setUnpushedPage(1)
        setChangesPage(1)
    }, [decodedPath])

    // Preload git data in background as soon as the project page opens.
    useEffect(() => {
        if (!decodedPath) return
        void refreshGitData(false)
    }, [decodedPath, refreshGitData])

    // Effect: Load full Git data whenever Git tab opens
    useEffect(() => {
        if (activeTab !== 'git' || !decodedPath) return
        void refreshGitData(true)
    }, [activeTab, decodedPath, refreshGitData])

    // Effect: Load gitignore templates and auto-detect project type
    useEffect(() => {
        if (showInitModal && availableTemplates.length === 0) {
            window.devscope.getGitignoreTemplates().then(result => {
                if (result.success) {
                    setAvailableTemplates(result.templates)

                    // Auto-detect template based on project type
                    if (project?.type) {
                        const typeMap: Record<string, string> = {
                            'node': 'Node.js',
                            'python': 'Python',
                            'rust': 'Rust',
                            'go': 'Go',
                            'java': 'Java',
                            'dotnet': '.NET',
                            'ruby': 'Ruby',
                            'php': 'PHP',
                            'cpp': 'C/C++',
                            'dart': 'Dart/Flutter',
                            'elixir': 'Elixir'
                        }
                        const detectedTemplate = typeMap[project.type] || 'General'
                        setGitignoreTemplate(detectedTemplate)
                    } else {
                        setGitignoreTemplate('General')
                    }
                }
            })
        }
    }, [showInitModal, project?.type])

    // Effect: Load gitignore patterns when Custom template is selected
    useEffect(() => {
        if (gitignoreTemplate === 'Custom' && availablePatterns.length === 0) {
            window.devscope.getGitignorePatterns().then(result => {
                if (result.success) {
                    setAvailablePatterns(result.patterns)

                    // Auto-select common patterns based on project type
                    if (project?.type) {
                        const autoSelect = new Set<string>()

                        // Common for all
                        autoSelect.add('env_files')
                        autoSelect.add('logs')
                        autoSelect.add('cache')
                        autoSelect.add('macos')
                        autoSelect.add('windows')
                        autoSelect.add('linux')

                        // Type-specific
                        if (project.type === 'node') {
                            autoSelect.add('node_modules')
                            autoSelect.add('dist')
                            autoSelect.add('next_build')
                            autoSelect.add('npm_logs')
                        } else if (project.type === 'python') {
                            autoSelect.add('python_venv')
                            autoSelect.add('dist')
                            autoSelect.add('coverage')
                        } else if (project.type === 'rust') {
                            autoSelect.add('rust_target')
                        } else if (project.type === 'go') {
                            autoSelect.add('go_vendor')
                            autoSelect.add('compiled')
                        } else if (project.type === 'java' || project.type === 'dotnet') {
                            autoSelect.add('compiled')
                            autoSelect.add('dotnet_build')
                        }

                        // IDE based on what's detected
                        autoSelect.add('vscode')
                        autoSelect.add('idea')
                        autoSelect.add('vim')

                        setSelectedPatterns(autoSelect)
                    }
                }
            })
        }
    }, [gitignoreTemplate, project?.type])

    const changedFiles = useMemo(() => {
        const byPath = new Map<string, FileTreeNode>()

        for (const [rawPath, status] of Object.entries(gitStatusMap)) {
            if (!status || status === 'ignored' || status === 'unknown') continue

            const normalizedPath = rawPath.replace(/\\/g, '/').replace(/^\.\//, '')
            const dedupeKey = normalizedPath.toLowerCase()
            if (byPath.has(dedupeKey)) continue

            const segments = normalizedPath.split('/').filter(Boolean)
            const name = segments[segments.length - 1] || normalizedPath

            byPath.set(dedupeKey, {
                name,
                path: normalizedPath,
                type: 'file',
                isHidden: name.startsWith('.'),
                gitStatus: status
            })
        }

        return Array.from(byPath.values()).sort((a, b) => a.path.localeCompare(b.path))
    }, [gitStatusMap])

    // Pre-compute all folder paths as Set for fast expand/collapse all
    const allFolderPathsSet = useMemo(() => new Set(getAllFolderPaths(fileTree)), [fileTree])
    const deferredFileSearch = useDeferredValue(fileSearch)
    const parsedFileSearch = useMemo(() => parseFileSearchQuery(deferredFileSearch), [deferredFileSearch])
    const hasFileSearch = deferredFileSearch.trim().length > 0
    const fileSearchIndex = useMemo(() => buildFileSearchIndex(fileTree), [fileTree])
    const folderChildInfoMap = useMemo(() => buildDirectoryChildInfoMap(fileTree), [fileTree])
    const indexedSearch = useMemo(() => {
        if (!hasFileSearch) return null
        return searchFileIndex(fileSearchIndex, parsedFileSearch, {
            showHidden,
            includeDirectories: true
        })
    }, [hasFileSearch, fileSearchIndex, parsedFileSearch, showHidden])

    // Auto-expand folders that contain search matches
    const searchExpandedFolders = useMemo(() => {
        if (!indexedSearch) return new Set<string>()
        return indexedSearch.expandedFolderPathSet
    }, [indexedSearch])

    // Effective expanded folders = manual + search auto-expand
    const effectiveExpandedFolders = useMemo(() => {
        if (hasFileSearch) {
            return new Set([...expandedFolders, ...searchExpandedFolders])
        }
        return expandedFolders
    }, [expandedFolders, searchExpandedFolders, hasFileSearch])

    // Pre-compute flattened visible file list (data only, no JSX)
    type FlatFileItem = {
        node: FileTreeNode
        depth: number
        isExpanded: boolean
        isFolder: boolean
        ext: string
        isPreviewable: boolean
        childInfo: { files: number; folders: number } | null
    }

    const visibleFileList = useMemo((): FlatFileItem[] => {
        const result: FlatFileItem[] = []
        const searchVisiblePaths = indexedSearch?.visiblePathSet

        const processNodes = (nodes: FileTreeNode[], depth: number) => {
            const filtered = nodes
                .filter(node => showHidden || !node.isHidden)
                .filter(node => !hasFileSearch || Boolean(searchVisiblePaths?.has(node.path)))
                .sort((a, b) => {
                    // Folders always first
                    if (a.type !== b.type) return a.type === 'directory' ? -1 : 1
                    if (sortBy === 'name') return sortAsc ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name)
                    if (sortBy === 'size') return sortAsc ? (a.size || 0) - (b.size || 0) : (b.size || 0) - (a.size || 0)
                    // Type = extension
                    const extA = a.name.split('.').pop() || ''
                    const extB = b.name.split('.').pop() || ''
                    return sortAsc ? extA.localeCompare(extB) : extB.localeCompare(extA)
                })

            for (const node of filtered) {
                const isFolder = node.type === 'directory'
                const ext = node.name.split('.').pop()?.toLowerCase() || ''
                const isPreviewable = PREVIEWABLE_EXTENSIONS.has(ext) || PREVIEWABLE_FILE_NAMES.has(node.name.toLowerCase())
                const childInfo = isFolder ? (folderChildInfoMap.get(node.path) || null) : null
                const isExpanded = effectiveExpandedFolders.has(node.path)

                result.push({ node, depth, isExpanded, isFolder, ext, isPreviewable, childInfo })

                // If folder is expanded, add children
                if (isFolder && isExpanded && node.children) {
                    processNodes(node.children, depth + 1)
                }
            }
        }

        processNodes(fileTree, 0)
        return result
    }, [fileTree, showHidden, hasFileSearch, indexedSearch, sortBy, sortAsc, effectiveExpandedFolders, folderChildInfoMap])

    // Effect: Poll running processes for this project
    useEffect(() => {
        const checkProjectStatus = async () => {
            if (!project?.path) return

            try {
                // Check running processes (dev servers, etc.)
                const processResult = await window.devscope.getProjectProcesses(project.path)
                if (processResult.success) {
                    setIsProjectLive(processResult.isLive)
                    setActivePorts(processResult.activePorts || [])
                }
            } catch (e) {
                console.error('[ProjectDetails] Failed to check project status:', e)
            }
        }

        checkProjectStatus()
        // Poll every 3s (slightly longer since process detection is heavier)
        const interval = setInterval(checkProjectStatus, 3000)
        return () => clearInterval(interval)
    }, [project?.path])

    const handleCopyPath = async () => {
        if (project?.path) {
            try {
                // Try IPC first (more robust in Electron)
                if (window.devscope.copyToClipboard) {
                    await window.devscope.copyToClipboard(project.path)
                } else {
                    // Fallback
                    await navigator.clipboard.writeText(project.path)
                }
                setCopiedPath(true)
                setTimeout(() => setCopiedPath(false), 2000)
            } catch (err) {
                console.error('Failed to copy path:', err)
                setError('Failed to copy path to clipboard')
            }
        }
    }

    const handleCommitClick = async (commit: GitCommit) => {
        if (!decodedPath) return

        setSelectedCommit(commit)
        setLoadingDiff(true)
        setCommitDiff('')

        try {
            const result = await window.devscope.getCommitDiff(decodedPath, commit.hash)
            if (result.success) {
                setCommitDiff(result.diff)
            } else {
                setCommitDiff(`Error loading diff: ${result.error}`)
            }
        } catch (err: any) {
            setCommitDiff(`Error: ${err.message}`)
        } finally {
            setLoadingDiff(false)
        }
    }

    const handleCommit = async () => {
        if (!decodedPath || !commitMessage.trim() || changedFiles.length === 0) return

        // Check for author mismatch
        const shouldWarn = localStorage.getItem('dontShowAuthorWarning') !== 'true'
        if (shouldWarn && gitUser && repoOwner && gitUser.name !== repoOwner) {
            setShowAuthorMismatch(true)
            return
        }

        await performCommit()
    }

    const handleGenerateCommitMessage = async () => {
        if (!decodedPath || changedFiles.length === 0) return

        const providerOrder = settings.commitAIProvider === 'groq'
            ? (['groq', 'gemini'] as const)
            : (['gemini', 'groq'] as const)

        const selectedProvider = providerOrder.find((provider) => {
            if (provider === 'groq') return Boolean(settings.groqApiKey?.trim())
            return Boolean(settings.geminiApiKey?.trim())
        })

        if (!selectedProvider) {
            showToast(
                'No API key configured for commit generation.',
                'Open AI Settings',
                '/settings/ai'
            )
            return
        }

        const apiKey = selectedProvider === 'groq' ? settings.groqApiKey : settings.geminiApiKey

        setIsGeneratingCommitMessage(true)
        setError(null)
        try {
            const diffResult = await window.devscope.getWorkingDiff(decodedPath)
            if (!diffResult?.success) {
                throw new Error(diffResult?.error || 'Failed to read working diff')
            }

            const generateResult = await window.devscope.generateCommitMessage(
                selectedProvider,
                apiKey,
                diffResult.diff || ''
            )

            if (!generateResult?.success || !generateResult?.message) {
                throw new Error(generateResult?.error || 'Failed to generate commit message')
            }

            setCommitMessage(generateResult.message.trim())
        } catch (err: any) {
            setError(`AI generation failed: ${err.message || 'Unknown error'}`)
        } finally {
            setIsGeneratingCommitMessage(false)
        }
    }

    const performCommit = async () => {
        if (!decodedPath || !commitMessage.trim()) return

        setIsCommitting(true)
        try {
            // Stage all changed files
            const filePaths = changedFiles.map(f => f.path)
            const stageResult = await window.devscope.stageFiles(decodedPath, filePaths)
            if (!stageResult?.success) {
                throw new Error(stageResult?.error || 'Failed to stage files')
            }

            // Create commit
            const commitResult = await window.devscope.createCommit(decodedPath, commitMessage)
            if (!commitResult?.success) {
                throw new Error(commitResult?.error || 'Failed to create commit')
            }

            // Clear message and reload
            setCommitMessage('')
            await refreshGitData(true)
        } catch (err: any) {
            setError(`Failed to commit: ${err.message}`)
        } finally {
            setIsCommitting(false)
        }
    }

    const handlePush = async () => {
        if (!decodedPath || unpushedCommits.length === 0) return

        setIsPushing(true)
        try {
            const pushResult = await window.devscope.pushCommits(decodedPath)
            if (!pushResult?.success) {
                throw new Error(pushResult?.error || 'Failed to push commits')
            }

            await refreshGitData(false)
        } catch (err: any) {
            setError(`Failed to push: ${err.message}`)
        } finally {
            setIsPushing(false)
        }
    }

    const handleSwitchBranch = async () => {
        if (!decodedPath || !targetBranch || targetBranch === currentBranch) return

        setIsSwitchingBranch(true)
        try {
            const checkoutResult = await window.devscope.checkoutBranch(decodedPath, targetBranch, {
                autoStash: true,
                autoCleanupLock: true
            })
            if (!checkoutResult?.success) {
                throw new Error(checkoutResult?.error || 'Failed to switch branch')
            }

            await refreshGitData(true)
            if (checkoutResult?.cleanedLock && checkoutResult?.stashed) {
                showToast(`Recovered stale Git lock and auto-stashed changes (${checkoutResult.stashRef || 'stash@{0}'}).`)
            } else if (checkoutResult?.cleanedLock) {
                showToast('Recovered stale Git lock and switched branch.')
            } else if (checkoutResult?.stashed) {
                showToast(`Switched branch after auto-stashing local changes (${checkoutResult.stashRef || 'stash@{0}'}).`)
            }
        } catch (err: any) {
            setError(`Failed to switch branch: ${err.message}`)
        } finally {
            setIsSwitchingBranch(false)
        }
    }

    const handleInitGit = async () => {
        if (!decodedPath) return

        setIsInitializing(true)
        try {
            // Get gitignore content if needed
            let gitignoreContent: string | undefined
            if (createGitignore && gitignoreTemplate) {
                if (gitignoreTemplate === 'Custom') {
                    // Generate custom gitignore from selected patterns
                    const result = await window.devscope.generateCustomGitignoreContent(Array.from(selectedPatterns))
                    if (result.success) {
                        gitignoreContent = result.content
                    }
                } else {
                    // Use template
                    const result = await window.devscope.generateGitignoreContent(gitignoreTemplate)
                    if (result.success) {
                        gitignoreContent = result.content
                    }
                }
            }

            // Get branch name
            const finalBranchName = branchName === 'custom' ? customBranchName : branchName

            // Initialize repo
            const initResult = await window.devscope.initGitRepo(
                decodedPath,
                finalBranchName,
                createGitignore,
                gitignoreContent
            )

            if (!initResult.success) {
                setError(`Failed to initialize git: ${initResult.error}`)
                setIsInitializing(false)
                return
            }

            setIsGitRepo(true)

            // Create initial commit if requested
            if (createInitialCommit) {
                const commitResult = await window.devscope.createInitialCommit(
                    decodedPath,
                    initialCommitMessage
                )

                if (!commitResult.success) {
                    setError(`Git initialized but failed to create initial commit: ${commitResult.error}`)
                }
            }

            await refreshGitData(true)

            // Move to remote setup step
            setInitStep('remote')
        } catch (err: any) {
            setError(`Failed to initialize git: ${err.message}`)
        } finally {
            setIsInitializing(false)
        }
    }

    const handleAddRemote = async () => {
        if (!decodedPath || !remoteUrl.trim()) return

        setIsAddingRemote(true)
        try {
            const result = await window.devscope.addRemoteOrigin(decodedPath, remoteUrl)

            if (!result.success) {
                setError(`Failed to add remote: ${result.error}`)
                setIsAddingRemote(false)
                return
            }

            // Success - close modal and reload
            setShowInitModal(false)
            setInitStep('config')
            setRemoteUrl('')
            setIsGitRepo(true)
            setHasRemote(true)

            await refreshGitData(true)
        } catch (err: any) {
            setError(`Failed to add remote: ${err.message}`)
        } finally {
            setIsAddingRemote(false)
        }
    }

    const handleSkipRemote = async () => {
        // Close modal and reload
        setShowInitModal(false)
        setInitStep('config')
        setRemoteUrl('')
        setIsGitRepo(true)
        setHasRemote(false)

        await refreshGitData(true)
    }

    const handleAuthorMismatchConfirm = () => {
        if (dontShowAuthorWarning) {
            localStorage.setItem('dontShowAuthorWarning', 'true')
        }
        setShowAuthorMismatch(false)
        performCommit()
    }

    const handleOpenInExplorer = async () => {
        if (project?.path) {
            console.log('Opening in explorer:', project.path)
            try {
                const result = await window.devscope.openInExplorer?.(project.path)
                if (result && !result.success) {
                    console.error('Failed to open in explorer:', result.error)
                    // If it failed, let's alert (for debugging visibility)
                    alert(`Failed to open folder: ${result.error}`)
                }
            } catch (err) {
                console.error('Failed to call openInExplorer:', err)
                alert(`Failed to invoke openInExplorer: ${err}`)
            }
        }
    }

    const scriptRunner = useMemo(
        () => detectPackageScriptRunner(project?.markers || []),
        [project?.markers]
    )
    const scriptIntentContext = useMemo<ScriptIntentContext>(() => ({
        frameworks: project?.frameworks || [],
        markers: project?.markers || []
    }), [project?.frameworks, project?.markers])
    const scriptPredictions = useMemo(() => {
        const predictions: Record<string, ScriptIntentPrediction> = {}
        if (!project?.scripts) return predictions
        for (const [name, command] of Object.entries(project.scripts)) {
            predictions[name] = detectScriptIntentWithConfidence(name, command, scriptIntentContext)
        }
        return predictions
    }, [project?.scripts, scriptIntentContext])

    const closeScriptRunModal = () => {
        setPendingScriptRun(null)
        setScriptPortInput('')
        setScriptExposeNetwork(false)
        setScriptAdvancedOpen(false)
        setScriptExtraArgsInput('')
        setScriptEnvInput('')
        setScriptRunError(null)
    }

    const launchScriptInTerminal = (scriptName: string, commandToRun: string) => {
        if (!project) return

        openTerminal(
            {
                id: `script-${scriptName}`,
                category: 'system',
                displayName: `Run: ${scriptName}`
            },
            project.path,
            commandToRun
        )
    }

    const buildScriptCommandWithOverrides = (
        scriptName: string,
        scriptIntent: ScriptIntent,
        options: ScriptRunDraft = {},
        scriptCommand: string = ''
    ) => {
        const baseCommand = getScriptCommand(scriptName, scriptRunner)
        const envOverrides: Record<string, string> = { ...(options.envOverrides || {}) }
        const intentArgs: string[] = []

        if (scriptIntent === 'server' && options.port) {
            const port = String(options.port)
            envOverrides.PORT = port
            envOverrides.DEV_PORT = port
            envOverrides.VITE_PORT = port
        }

        if (scriptIntent === 'server' && options.exposeNetwork) {
            envOverrides.HOST = '0.0.0.0'
            envOverrides.HOSTNAME = '0.0.0.0'
            envOverrides.BIND_ADDR = '0.0.0.0'
        }

        if (scriptIntent === 'server') {
            intentArgs.push(...buildServerCliArgs(scriptCommand, options))
        }

        if (options.extraArgs?.trim()) {
            intentArgs.push(options.extraArgs.trim())
        }

        const commandWithArgs = appendScriptArgsForRunner(baseCommand, intentArgs.join(' '), scriptRunner)
        return applyShellEnvOverrides(commandWithArgs, settings.defaultShell, envOverrides)
    }

    const getScriptRunDraftFromState = (
        scriptIntent: ScriptIntent,
        strictValidation: boolean
    ): { draft: ScriptRunDraft; error?: string } => {
        const draft: ScriptRunDraft = {}

        const envParseResult = parseEnvOverrideInput(scriptEnvInput)
        if (envParseResult.error && strictValidation) {
            return { draft, error: envParseResult.error }
        }
        if (Object.keys(envParseResult.envOverrides).length > 0) {
            draft.envOverrides = envParseResult.envOverrides
        }

        const extraArgs = scriptExtraArgsInput.trim()
        if (extraArgs) {
            draft.extraArgs = extraArgs
        }

        if (scriptIntent === 'server') {
            const rawPort = scriptPortInput.trim()
            if (rawPort) {
                const maybePort = Number(rawPort)
                if (!Number.isInteger(maybePort) || maybePort < 1 || maybePort > 65535) {
                    if (strictValidation) {
                        return { draft, error: 'Port must be a number between 1 and 65535.' }
                    }
                } else {
                    draft.port = maybePort
                }
            }

            if (scriptExposeNetwork) {
                draft.exposeNetwork = true
            }
        }

        return { draft }
    }

    const runScript = (scriptName: string, command: string) => {
        if (!project) return

        const prediction = scriptPredictions[scriptName] || detectScriptIntentWithConfidence(scriptName, command, scriptIntentContext)
        if (prediction.intent !== 'server') {
            const commandToRun = buildScriptCommandWithOverrides(scriptName, prediction.intent, {}, command)
            launchScriptInTerminal(scriptName, commandToRun)
            return
        }

        setPendingScriptRun({
            name: scriptName,
            command,
            intent: prediction.intent,
            confidence: prediction.confidence
        })
        setScriptPortInput('')
        setScriptExposeNetwork(false)
        setScriptAdvancedOpen(false)
        setScriptExtraArgsInput('')
        setScriptEnvInput('')
        setScriptRunError(null)
    }

    const handleConfirmScriptRun = () => {
        if (!pendingScriptRun) return

        const draftResult = getScriptRunDraftFromState(pendingScriptRun.intent, true)
        if (draftResult.error) {
            setScriptRunError(draftResult.error)
            return
        }

        const commandToRun = buildScriptCommandWithOverrides(
            pendingScriptRun.name,
            pendingScriptRun.intent,
            draftResult.draft,
            pendingScriptRun.command
        )

        launchScriptInTerminal(pendingScriptRun.name, commandToRun)
        closeScriptRunModal()
    }

    const scriptCommandPreview = pendingScriptRun
        ? buildScriptCommandWithOverrides(
            pendingScriptRun.name,
            pendingScriptRun.intent,
            getScriptRunDraftFromState(pendingScriptRun.intent, false).draft,
            pendingScriptRun.command
        )
        : ''

    const formatRelTime = (ts?: number) => {
        if (!ts) return ''
        const days = Math.floor((Date.now() - ts) / 86400000)
        return days === 0 ? 'Today' : days === 1 ? 'Yesterday' : `${days} days ago`
    }

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[50vh] animate-fadeIn gap-4">
                <RefreshCw size={32} className="text-[var(--accent-primary)] animate-spin" />
                <p className="text-white/40 text-sm">Loading Project...</p>
            </div>
        )
    }

    if (error || !project) {
        return (
            <div className="animate-fadeIn p-8">
                <div className="flex items-center gap-4 mb-8">
                    <button onClick={() => navigate('/projects')} className="p-2 text-white/40 hover:text-white bg-white/5 rounded-lg">
                        <ArrowLeft size={20} />
                    </button>
                    <h1 className="text-xl font-bold text-white">Error</h1>
                </div>
                <div className="p-6 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center gap-4">
                    <AlertCircle size={24} className="text-red-400" />
                    <span className="text-red-300">{error || 'Project not found'}</span>
                </div>
            </div>
        )
    }

    const themeColor = project.typeInfo?.themeColor || '#525252'

    return (
        <div className="max-w-[1600px] mx-auto animate-fadeIn pb-24 px-6 pt-6">

            {showDependenciesModal && project.dependencies && (
                <DependenciesModal dependencies={project.dependencies} onClose={() => setShowDependenciesModal(false)} />
            )}

            {selectedCommit && (
                <CommitDiffModal
                    commit={selectedCommit}
                    diff={commitDiff}
                    loading={loadingDiff}
                    onClose={() => {
                        setSelectedCommit(null)
                        setCommitDiff('')
                    }}
                />
            )}

            {showAuthorMismatch && gitUser && repoOwner && (
                <AuthorMismatchModal
                    gitUser={gitUser}
                    repoOwner={repoOwner}
                    onConfirm={handleAuthorMismatchConfirm}
                    onCancel={() => setShowAuthorMismatch(false)}
                    dontShowAgain={dontShowAuthorWarning}
                    setDontShowAgain={setDontShowAuthorWarning}
                />
            )}

            {/* Init Git Modal */}
            <InitGitModal
                isOpen={showInitModal}
                onClose={() => {
                    setShowInitModal(false)
                    setInitStep('config')
                }}
                step={initStep}
                branchName={branchName}
                setBranchName={setBranchName}
                customBranchName={customBranchName}
                setCustomBranchName={setCustomBranchName}
                createGitignore={createGitignore}
                setCreateGitignore={setCreateGitignore}
                gitignoreTemplate={gitignoreTemplate}
                setGitignoreTemplate={setGitignoreTemplate}
                availableTemplates={availableTemplates}
                availablePatterns={availablePatterns}
                selectedPatterns={selectedPatterns}
                setSelectedPatterns={setSelectedPatterns}
                patternSearch={patternSearch}
                setPatternSearch={setPatternSearch}
                createInitialCommit={createInitialCommit}
                setCreateInitialCommit={setCreateInitialCommit}
                initialCommitMessage={initialCommitMessage}
                setInitialCommitMessage={setInitialCommitMessage}
                isInitializing={isInitializing}
                onInit={handleInitGit}
                remoteUrl={remoteUrl}
                setRemoteUrl={setRemoteUrl}
                isAddingRemote={isAddingRemote}
                onAddRemote={handleAddRemote}
                onSkipRemote={handleSkipRemote}
            />

            {/* -- HERO HEADER -- */}
            <div className="relative rounded-2xl overflow-hidden border border-white/10 bg-gradient-to-br from-white/[0.03] to-transparent mb-8">
                {/* Accent glow */}
                <div
                    className="absolute -top-20 -right-20 w-40 h-40 rounded-full blur-3xl opacity-20 pointer-events-none"
                    style={{ background: themeColor }}
                />

                {/* Main Row */}
                <div className="relative p-5 flex items-center gap-5">
                    {/* Project Icon */}
                    <div
                        className="shrink-0 w-14 h-14 rounded-xl flex items-center justify-center border border-white/10"
                        style={{ background: `${themeColor}15` }}
                    >
                        <ProjectIcon projectType={project.type} framework={project.frameworks?.[0]} size={32} />
                    </div>

                    {/* Project Info */}
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-1">
                            <h1 className="text-xl font-bold text-white truncate">
                                {project.displayName}
                            </h1>
                            {project.version && (
                                <span className="text-xs font-mono text-white/40 bg-white/5 px-2 py-0.5 rounded">
                                    v{project.version}
                                </span>
                            )}
                        </div>
                        <div className="flex items-center gap-2 text-sm text-white/50">
                            <span
                                className="px-2 py-0.5 rounded text-xs font-medium"
                                style={{ background: `${themeColor}20`, color: themeColor }}
                            >
                                {project.typeInfo?.displayName || project.type}
                            </span>
                            {project.frameworks?.map(fw => (
                                <FrameworkBadge key={fw} framework={fw} size="sm" />
                            ))}
                        </div>
                    </div>


                    {/* Right Actions */}
                    <div className="flex items-center gap-3 shrink-0">
                        {isProjectLive && (
                            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-green-500/10 border border-green-500/20 animate-pulse">
                                <div className="w-2 h-2 rounded-full bg-green-500" />
                                <span className="text-xs font-semibold text-green-400">
                                    LIVE {activePorts.length > 0 && `(:${activePorts[0]})`}
                                </span>
                            </div>
                        )}

                        <div className="hidden md:block text-right mr-2">
                            <p className="text-[10px] uppercase tracking-wider text-white/30 font-medium">Modified</p>
                            <p className="text-sm text-white/60">{formatRelTime(project.lastModified)}</p>
                        </div>

                        <button
                            onClick={() => openTerminal({ displayName: project.name, id: 'main', category: 'project' }, project.path)}
                            className="flex items-center gap-2 px-4 py-2.5 bg-[var(--accent-primary)] hover:bg-[var(--accent-primary)]/80 text-white text-sm font-medium rounded-lg transition-all active:scale-95"
                        >
                            <Terminal size={16} />
                            Open Terminal
                        </button>
                    </div>
                </div>

                {/* Path Row */}
                <div className="flex items-center gap-2 px-5 py-3 bg-black/20 border-t border-white/5">
                    <FolderOpen size={14} className="text-white/30 shrink-0" />
                    <span className="flex-1 text-xs font-mono text-white/40 truncate">
                        {project.path}
                    </span>
                    <div className="flex items-center gap-1">
                        <button
                            onClick={handleCopyPath}
                            className={cn(
                                "p-1.5 rounded-md text-white/40 hover:text-white hover:bg-white/10 transition-all",
                                copiedPath && "text-green-400 hover:text-green-400"
                            )}
                            title="Copy path"
                        >
                            {copiedPath ? <Check size={14} /> : <Copy size={14} />}
                        </button>
                        <button
                            onClick={handleOpenInExplorer}
                            className="p-1.5 rounded-md text-white/40 hover:text-white hover:bg-white/10 transition-all"
                            title="Open in Explorer"
                        >
                            <ExternalLink size={14} />
                        </button>
                    </div>
                </div>
            </div>


            {/* -- STICKY TABS BAR -- */}
            <div className="sticky -top-6 z-20 bg-sparkle-bg/95 backdrop-blur-xl pt-10 pb-4 mb-6 -mx-6 px-6 border-b border-white/5">
                <div className="flex gap-3 items-center">
                    <button
                        onClick={goBack}
                        className="h-11 w-11 flex items-center justify-center text-white/50 hover:text-white bg-sparkle-card border border-white/10 hover:border-white/20 rounded-xl transition-all shadow-sm shrink-0"
                        title="Go Back"
                    >
                        <ArrowLeft size={18} />
                    </button>

                    <div className="flex-1 flex items-center h-11 p-1 bg-sparkle-card border border-white/10 rounded-xl shadow-sm">
                        <button
                            onClick={() => setActiveTab('readme')}
                            className={cn(
                                "flex-1 h-full flex items-center justify-center gap-2 rounded-lg text-sm font-medium transition-all",
                                activeTab === 'readme' ? "bg-white/10 text-white" : "text-white/40 hover:text-white hover:bg-white/5"
                            )}
                        >
                            <BookOpen size={15} /> README
                        </button>
                        <button
                            onClick={() => setActiveTab('files')}
                            className={cn(
                                "flex-1 h-full flex items-center justify-center gap-2 rounded-lg text-sm font-medium transition-all",
                                activeTab === 'files' ? "bg-white/10 text-white" : "text-white/40 hover:text-white hover:bg-white/5"
                            )}
                        >
                            <FolderOpen size={15} /> Files
                            <span className={cn(
                                "text-[10px] px-1.5 py-0.5 rounded-full",
                                activeTab === 'files' ? "bg-white/10" : "bg-white/5 opacity-60"
                            )}>
                                {fileTree.length}
                            </span>
                        </button>
                        <button
                            onClick={() => setActiveTab('git')}
                            className={cn(
                                "flex-1 h-full flex items-center justify-center gap-2 rounded-lg text-sm font-medium transition-all",
                                activeTab === 'git' ? "bg-white/10 text-white" : "text-white/40 hover:text-white hover:bg-white/5"
                            )}
                        >
                            <GitBranch size={15} />
                            Git
                            {loadingGit && (
                                <RefreshCw size={12} className="animate-spin text-[var(--accent-primary)]" />
                            )}
                            {changedFiles.length > 0 && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#E2C08D]/20 text-[#E2C08D]">
                                    {changedFiles.length}
                                </span>
                            )}
                            {unpushedCommits.length > 0 && (
                                <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-400/30">
                                    <GitPullRequest size={10} />
                                    {unpushedCommits.length}
                                </span>
                            )}
                        </button>
                    </div>

                    {/* Browse Folder button - switch to folder browse view */}
                    <button
                        onClick={() => {
                            const encodedPath = encodeURIComponent(project.path)
                            navigate(`/folder-browse/${encodedPath}`)
                        }}
                        className="h-11 flex items-center gap-2 px-4 text-white/50 hover:text-white bg-sparkle-card border border-white/10 hover:border-white/20 rounded-xl transition-all shadow-sm shrink-0"
                        title="Browse as Folder"
                    >
                        <Folder size={16} />
                        <span className="text-sm font-medium hidden sm:inline">Browse Folder</span>
                    </button>

                    <button
                        onClick={loadProjectDetails}
                        className="h-11 w-11 flex items-center justify-center text-white/40 hover:text-white bg-sparkle-card border border-white/10 hover:border-white/20 rounded-xl transition-all shadow-sm shrink-0"
                        title="Refresh"
                    >
                        <RefreshCw size={16} />
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-12 gap-6">

                {/* LEFT COLUMN: TABS & CONTENT */}
                <div className="col-span-12 lg:col-span-8 flex flex-col gap-6">
                    <div className="bg-sparkle-card border border-white/5 rounded-2xl overflow-hidden min-h-[500px] shadow-sm">
                        {activeTab === 'readme' ? (
                            <div className="relative">
                                {project.readme ? (
                                    <>
                                        <div
                                            ref={readmeContentRef}
                                            className={cn(
                                                "p-8 pt-6 overflow-hidden transition-all duration-300",
                                                !readmeExpanded && "max-h-[500px]"
                                            )}
                                        >
                                            <MarkdownRenderer content={project.readme} filePath={`${project.path}/README.md`} />
                                        </div>
                                        {readmeNeedsExpand && !readmeExpanded && (
                                            <div
                                                onClick={() => setReadmeExpanded(true)}
                                                className="absolute bottom-0 left-0 right-0 h-40 bg-gradient-to-t from-sparkle-card via-sparkle-card/80 to-transparent flex items-end justify-center pb-8 cursor-pointer group"
                                            >
                                                <span className="text-sm font-medium text-[var(--accent-primary)] group-hover:text-white transition-colors">
                                                    Read More
                                                </span>
                                            </div>
                                        )}
                                        {readmeNeedsExpand && readmeExpanded && (
                                            <div
                                                onClick={() => setReadmeExpanded(false)}
                                                className="px-8 pb-6 pt-4 text-center cursor-pointer group"
                                            >
                                                <span className="text-sm text-white/40 group-hover:text-white/60 transition-colors">
                                                    Show Less
                                                </span>
                                            </div>
                                        )}
                                    </>
                                ) : (
                                    <div className="flex flex-col items-center justify-center py-24 text-white/20">
                                        <BookOpen size={48} className="mb-4 opacity-50" />
                                        <p>No README.md found</p>
                                    </div>
                                )}
                            </div>
                        ) : activeTab === 'files' ? (
                            <div className="flex flex-col h-full">
                                {/* Header with search and controls */}
                                <div className="flex items-center gap-2 px-4 py-3 border-b border-white/5 bg-white/[0.02]">
                                    {/* Search */}
                                    <div className="relative flex-1">
                                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
                                        <input
                                            type="text"
                                            value={fileSearch}
                                            onChange={(e) => setFileSearch(e.target.value)}
                                            placeholder="Search files..."
                                            className="w-full bg-white/5 border border-white/10 rounded-lg pl-9 pr-3 py-1.5 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-white/20 transition-all"
                                        />
                                    </div>

                                    {/* Expand/Collapse All */}
                                    <button
                                        onClick={() => {
                                            setIsExpandingFolders(true)
                                            // Use startTransition for non-blocking updates
                                            startTransition(() => {
                                                if (expandedFolders.size > 0) {
                                                    setExpandedFolders(EMPTY_SET)
                                                } else {
                                                    setExpandedFolders(allFolderPathsSet)
                                                }
                                                // Small delay to show the spinner
                                                setTimeout(() => setIsExpandingFolders(false), 300)
                                            })
                                        }}
                                        disabled={isExpandingFolders}
                                        className={cn(
                                            "p-2 rounded-lg transition-all",
                                            isExpandingFolders && "opacity-50 cursor-not-allowed",
                                            expandedFolders.size > 0 ? "text-white/60 hover:text-white hover:bg-white/5" : "text-white/40 hover:text-white hover:bg-white/5"
                                        )}
                                        title={isExpandingFolders ? "Loading..." : expandedFolders.size > 0 ? "Collapse all folders" : "Expand all folders"}
                                    >
                                        {isExpandingFolders ? (
                                            <RefreshCw size={16} className="animate-spin" />
                                        ) : expandedFolders.size > 0 ? (
                                            <ChevronsDownUp size={16} />
                                        ) : (
                                            <ChevronsUpDown size={16} />
                                        )}
                                    </button>

                                    {/* Toggle hidden */}
                                    <button
                                        onClick={() => setShowHidden(!showHidden)}
                                        className={cn(
                                            "p-2 rounded-lg transition-all",
                                            showHidden ? "bg-white/10 text-white" : "text-white/40 hover:text-white hover:bg-white/5"
                                        )}
                                        title={showHidden ? "Hide hidden files" : "Show hidden files"}
                                    >
                                        {showHidden ? <Eye size={16} /> : <EyeOff size={16} />}
                                    </button>

                                    {/* Item count */}
                                    <span className="text-xs text-white/40 whitespace-nowrap">
                                        {fileTree.length} items
                                    </span>
                                </div>

                                {/* Column Headers */}
                                <div className="grid grid-cols-12 gap-2 px-4 py-2 border-b border-white/5 text-[10px] uppercase tracking-wider text-white/30 font-medium bg-black/10">
                                    <div className="col-span-6 flex items-center gap-1 cursor-pointer hover:text-white/50" onClick={() => { setSortBy('name'); setSortAsc(sortBy === 'name' ? !sortAsc : true) }}>
                                        Name {sortBy === 'name' && (sortAsc ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}
                                    </div>
                                    <div className="col-span-2 flex items-center gap-1 cursor-pointer hover:text-white/50" onClick={() => { setSortBy('type'); setSortAsc(sortBy === 'type' ? !sortAsc : true) }}>
                                        Type {sortBy === 'type' && (sortAsc ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}
                                    </div>
                                    <div className="col-span-2 flex items-center gap-1 cursor-pointer hover:text-white/50" onClick={() => { setSortBy('size'); setSortAsc(sortBy === 'size' ? !sortAsc : true) }}>
                                        Size {sortBy === 'size' && (sortAsc ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}
                                    </div>
                                    <div className="col-span-2 text-right">Info</div>
                                </div>

                                {/* File List - uses memoized visibleFileList for instant rendering */}
                                <div className="flex-1 overflow-y-auto custom-scrollbar">
                                    {visibleFileList.length === 0 ? (
                                        <div className="flex flex-col items-center justify-center py-16 text-white/30">
                                            <Search size={32} className="mb-3 opacity-30" />
                                            <p className="text-sm">No files found</p>
                                            {fileSearch && (
                                                <button
                                                    onClick={() => setFileSearch('')}
                                                    className="mt-2 text-xs text-[var(--accent-primary)] hover:underline"
                                                >
                                                    Clear search
                                                </button>
                                            )}
                                        </div>
                                    ) : (
                                        visibleFileList.map(({ node, depth, isExpanded, isFolder, ext, isPreviewable, childInfo }) => (
                                            <div
                                                key={node.path}
                                                className={cn(
                                                    "grid grid-cols-12 gap-2 px-4 py-2 border-b border-white/5 hover:bg-white/5 transition-colors group cursor-pointer",
                                                    node.isHidden && "opacity-50"
                                                )}
                                                style={{ paddingLeft: `${16 + depth * 20}px` }}
                                                onClick={() => {
                                                    if (isFolder) {
                                                        startTransition(() => {
                                                            setExpandedFolders(prev => {
                                                                const next = new Set(prev)
                                                                if (next.has(node.path)) {
                                                                    next.delete(node.path)
                                                                } else {
                                                                    next.add(node.path)
                                                                }
                                                                return next
                                                            })
                                                        })
                                                    } else {
                                                        openPreview({ name: node.name, path: node.path }, ext)
                                                    }
                                                }}
                                            >
                                                {/* Name */}
                                                <div className="col-span-6 flex items-center gap-2 min-w-0">
                                                    {isFolder ? (
                                                        <ChevronRight size={14} className={cn("text-white/30 transition-transform", isExpanded && "rotate-90")} />
                                                    ) : (
                                                        <span className="w-3.5" />
                                                    )}
                                                    {getFileIcon(node.name, isFolder, isExpanded)}
                                                    <span className={cn(
                                                        "text-sm truncate",
                                                        isFolder ? "text-white/80 font-medium" : "text-white/60",
                                                        node.gitStatus === 'modified' && "text-[#E2C08D]",
                                                        node.gitStatus === 'added' && "text-[#73C991]",
                                                        node.gitStatus === 'untracked' && "text-[#73C991]",
                                                        node.gitStatus === 'deleted' && "text-[#FF6B6B] line-through"
                                                    )}>
                                                        {node.name}
                                                    </span>
                                                    {node.gitStatus && node.gitStatus !== 'ignored' && node.gitStatus !== 'unknown' && (
                                                        <span className={cn(
                                                            "text-[9px] uppercase font-bold px-1 py-0.5 rounded shrink-0",
                                                            node.gitStatus === 'modified' && "bg-[#E2C08D]/20 text-[#E2C08D]",
                                                            node.gitStatus === 'added' && "bg-[#73C991]/20 text-[#73C991]",
                                                            node.gitStatus === 'untracked' && "bg-[#73C991]/20 text-[#73C991]",
                                                            node.gitStatus === 'deleted' && "bg-[#FF6B6B]/20 text-[#FF6B6B]"
                                                        )}>
                                                            {node.gitStatus.charAt(0)}
                                                        </span>
                                                    )}
                                                </div>

                                                {/* Type */}
                                                <div className="col-span-2 flex items-center">
                                                    <span className="text-xs text-white/40 uppercase">
                                                        {isFolder ? 'Folder' : ext || '-'}
                                                    </span>
                                                </div>

                                                {/* Size */}
                                                <div className="col-span-2 flex items-center">
                                                    <span className="text-xs text-white/40 font-mono">
                                                        {isFolder ? '-' : formatFileSize(node.size)}
                                                    </span>
                                                </div>

                                                {/* Info */}
                                                <div className="col-span-2 flex items-center justify-end">
                                                    {isFolder && childInfo && (
                                                        <span className="text-[10px] text-white/30">
                                                            {childInfo.folders > 0 && `${childInfo.folders} folders`}
                                                            {childInfo.folders > 0 && childInfo.files > 0 && ', '}
                                                            {childInfo.files > 0 && `${childInfo.files} files`}
                                                        </span>
                                                    )}
                                                    {isPreviewable && !isFolder && (
                                                        <span className="text-[10px] text-[var(--accent-primary)] opacity-0 group-hover:opacity-100 transition-opacity">
                                                            Preview
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        ) : activeTab === 'git' ? (
                            // COMPREHENSIVE GIT MANAGEMENT TAB
                            <div className="flex flex-col h-full">
                                {/* Git Management Header */}
                                {gitUser && (
                                    <div className="p-4 border-b border-white/5 bg-white/[0.02]">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className="p-2 rounded-lg bg-white/5">
                                                    <User size={16} className="text-white/60" />
                                                </div>
                                                <div>
                                                    <p className="text-xs text-white/40">Repository Owner</p>
                                                    <p className="text-sm font-medium text-white/80">{repoOwner || 'Unknown'}</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <div className="text-right">
                                                    <p className="text-xs text-white/40">Current User</p>
                                                    <p className="text-sm font-medium text-white/80">{gitUser.name}</p>
                                                </div>
                                                <div className="p-2 rounded-lg bg-[var(--accent-primary)]/10">
                                                    <User size={16} className="text-[var(--accent-primary)]" />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Git Sub-nav */}
                                <div className="flex items-center gap-1 px-4 py-3 border-b border-white/5 overflow-x-auto">
                                    <button
                                        onClick={() => setGitView('manage')}
                                        className={cn(
                                            "px-3 py-1.5 text-xs font-medium rounded-lg transition-colors border border-transparent whitespace-nowrap",
                                            gitView === 'manage'
                                                ? "bg-white/10 text-white border-white/5"
                                                : "text-white/50 hover:text-white hover:bg-white/5"
                                        )}
                                    >
                                        <span className="flex items-center gap-1.5">
                                            <GitBranch size={12} />
                                            Manage
                                        </span>
                                    </button>
                                    <button
                                        onClick={() => setGitView('changes')}
                                        className={cn(
                                            "px-3 py-1.5 text-xs font-medium rounded-lg transition-colors border border-transparent whitespace-nowrap",
                                            gitView === 'changes'
                                                ? "bg-white/10 text-white border-white/5"
                                                : "text-white/50 hover:text-white hover:bg-white/5"
                                        )}
                                    >
                                        Working Changes ({changedFiles.length})
                                    </button>
                                    <button
                                        onClick={() => setGitView('unpushed')}
                                        className={cn(
                                            "px-3 py-1.5 text-xs font-medium rounded-lg transition-colors border border-transparent whitespace-nowrap",
                                            gitView === 'unpushed'
                                                ? "bg-white/10 text-white border-white/5"
                                                : "text-white/50 hover:text-white hover:bg-white/5"
                                        )}
                                    >
                                        To Push ({unpushedCommits.length})
                                    </button>
                                    <button
                                        onClick={() => setGitView('history')}
                                        className={cn(
                                            "px-3 py-1.5 text-xs font-medium rounded-lg transition-colors border border-transparent whitespace-nowrap",
                                            gitView === 'history'
                                                ? "bg-white/10 text-white border-white/5"
                                                : "text-white/50 hover:text-white hover:bg-white/5"
                                        )}
                                    >
                                        History
                                    </button>
                                    <button
                                        onClick={() => void refreshGitData(true)}
                                        disabled={loadingGit}
                                        className="ml-auto px-3 py-1.5 text-xs font-medium rounded-lg transition-colors border border-white/10 text-white/70 hover:text-white hover:bg-white/5 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                                    >
                                        <span className="flex items-center gap-1.5">
                                            <RefreshCw size={12} className={cn(loadingGit && 'animate-spin')} />
                                            Refresh Git
                                        </span>
                                    </button>
                                </div>

                                <div className="p-4 flex-1 overflow-y-auto custom-scrollbar">
                                    {gitView === 'manage' ? (
                                        isGitRepo === false ? (
                                            // NOT A GIT REPO - Show Init UI
                                            <div className="flex flex-col items-center justify-center py-16 px-4">
                                                <div className="p-6 rounded-2xl bg-white/5 border border-white/10 mb-6">
                                                    <GitBranch size={48} className="text-white/30" />
                                                </div>
                                                <h3 className="text-lg font-semibold text-white mb-2">Git Not Initialized</h3>
                                                <p className="text-sm text-white/50 text-center mb-6 max-w-md">
                                                    This project is not a Git repository yet. Initialize Git to start tracking changes and collaborate with others.
                                                </p>
                                                <button
                                                    onClick={() => setShowInitModal(true)}
                                                    className="px-6 py-3 bg-[var(--accent-primary)] hover:bg-[var(--accent-primary)]/80 text-white text-sm font-medium rounded-lg transition-all flex items-center gap-2"
                                                >
                                                    <GitBranch size={18} />
                                                    Initialize Git Repository
                                                </button>
                                            </div>
                                        ) : (
                                            // MANAGE VIEW - Commit UI + Summary
                                            <div className="space-y-4">
                                                {/* Branch Controls */}
                                                <div className="bg-black/20 rounded-xl border border-white/5 p-4">
                                                    <div className="flex items-center justify-between gap-3 mb-3">
                                                        <h3 className="text-sm font-medium text-white/80 flex items-center gap-2">
                                                            <GitBranch size={16} />
                                                            Branch Switching
                                                        </h3>
                                                        <span className="text-xs text-white/40">
                                                            Current: <span className="font-mono text-white/70">{currentBranch || 'n/a'}</span>
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <Select
                                                            value={targetBranch}
                                                            onChange={setTargetBranch}
                                                            options={branches.map((branch) => ({
                                                                value: branch.name,
                                                                label: `${branch.current ? '* ' : ''}${branch.name}`
                                                            }))}
                                                            placeholder="No branches found"
                                                            disabled={branches.length === 0 || isSwitchingBranch}
                                                            className="flex-1"
                                                            size="md"
                                                        />
                                                        <button
                                                            onClick={handleSwitchBranch}
                                                            disabled={!targetBranch || targetBranch === currentBranch || isSwitchingBranch}
                                                            className="px-4 py-2 text-sm font-medium rounded-lg bg-[var(--accent-primary)] hover:bg-[var(--accent-primary)]/80 disabled:opacity-50 disabled:cursor-not-allowed text-white transition-all flex items-center gap-2"
                                                        >
                                                            {isSwitchingBranch ? (
                                                                <>
                                                                    <RefreshCw size={14} className="animate-spin" />
                                                                    Switching...
                                                                </>
                                                            ) : (
                                                                <>
                                                                    <GitBranch size={14} />
                                                                    Switch
                                                                </>
                                                            )}
                                                        </button>
                                                    </div>
                                                </div>

                                                {/* Commit Section */}
                                                {changedFiles.length > 0 && (
                                                    <div className="bg-black/20 rounded-xl border border-white/5 p-4">
                                                        <h3 className="text-sm font-medium text-white/80 mb-3 flex items-center gap-2">
                                                            <GitCommitHorizontal size={16} />
                                                            Create Commit
                                                        </h3>
                                                        <div className="relative">
                                                            <textarea
                                                                value={commitMessage}
                                                                onChange={(e) => setCommitMessage(e.target.value)}
                                                                placeholder="Enter commit message..."
                                                                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 pr-12 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[var(--accent-primary)]/50 resize-none mb-3"
                                                                rows={3}
                                                            />
                                                        </div>
                                                        <div className="mb-3 flex items-center justify-between gap-2">
                                                            <button
                                                                onClick={handleGenerateCommitMessage}
                                                                disabled={isGeneratingCommitMessage || isCommitting}
                                                                className="px-3 py-2 bg-violet-500/15 hover:bg-violet-500/25 disabled:opacity-50 disabled:cursor-not-allowed border border-violet-500/30 text-violet-300 text-xs font-medium rounded-lg transition-all flex items-center gap-2"
                                                            >
                                                                {isGeneratingCommitMessage ? (
                                                                    <>
                                                                        <RefreshCw size={14} className="animate-spin" />
                                                                        Generating...
                                                                    </>
                                                                ) : (
                                                                    <>
                                                                        <Sparkles size={14} />
                                                                        Generate with AI
                                                                    </>
                                                                )}
                                                            </button>
                                                            <span className="text-[11px] text-white/40 uppercase tracking-wide">
                                                                {settings.commitAIProvider}
                                                            </span>
                                                        </div>
                                                        <button
                                                            onClick={handleCommit}
                                                            disabled={!commitMessage.trim() || isCommitting}
                                                            className="w-full px-4 py-2.5 bg-[var(--accent-primary)] hover:bg-[var(--accent-primary)]/80 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-all flex items-center justify-center gap-2"
                                                        >
                                                            {isCommitting ? (
                                                                <>
                                                                    <RefreshCw size={16} className="animate-spin" />
                                                                    Committing...
                                                                </>
                                                            ) : (
                                                                <>
                                                                    <GitCommitHorizontal size={16} />
                                                                    Commit {changedFiles.length} {changedFiles.length === 1 ? 'File' : 'Files'}
                                                                </>
                                                            )}
                                                        </button>
                                                    </div>
                                                )}

                                                {/* Push Section - Show Add Remote if no remote, otherwise show push when there are unpushed commits */}
                                                {hasRemote === false ? (
                                                    <div className="bg-amber-500/10 rounded-xl border border-amber-500/20 p-4">
                                                        <h3 className="text-sm font-medium text-amber-400 mb-3 flex items-center gap-2">
                                                            <Link size={16} />
                                                            No Remote Repository
                                                        </h3>
                                                        <p className="text-xs text-white/50 mb-3">
                                                            Add a remote repository to push your commits to GitHub, GitLab, or other Git hosting services.
                                                        </p>
                                                        <button
                                                            onClick={() => {
                                                                setInitStep('remote')
                                                                setShowInitModal(true)
                                                            }}
                                                            className="w-full px-4 py-2.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 text-sm font-medium rounded-lg transition-all flex items-center justify-center gap-2 border border-amber-500/30"
                                                        >
                                                            <Plus size={16} />
                                                            Add Remote Repository
                                                        </button>
                                                    </div>
                                                ) : unpushedCommits.length > 0 && (
                                                    <div className="bg-black/20 rounded-xl border border-white/5 p-4">
                                                        <h3 className="text-sm font-medium text-white/80 mb-3 flex items-center gap-2">
                                                            <GitPullRequest size={16} />
                                                            Push to Remote
                                                        </h3>
                                                        <p className="text-xs text-white/50 mb-3">
                                                            You have {unpushedCommits.length} unpushed {unpushedCommits.length === 1 ? 'commit' : 'commits'}
                                                        </p>
                                                        <button
                                                            onClick={handlePush}
                                                            disabled={isPushing}
                                                            className="w-full px-4 py-2.5 bg-blue-500/20 hover:bg-blue-500/30 disabled:opacity-50 disabled:cursor-not-allowed text-blue-400 text-sm font-medium rounded-lg transition-all flex items-center justify-center gap-2 border border-blue-500/30"
                                                        >
                                                            {isPushing ? (
                                                                <>
                                                                    <RefreshCw size={16} className="animate-spin" />
                                                                    Pushing...
                                                                </>
                                                            ) : (
                                                                <>
                                                                    <GitPullRequest size={16} />
                                                                    Push Commits
                                                                </>
                                                            )}
                                                        </button>
                                                    </div>
                                                )}

                                                {/* Summary Sections */}
                                                <div className="space-y-3">
                                                    {(() => {
                                                        const hasWorkingChanges = changedFiles.length > 0
                                                        const hasUnpushedCommits = unpushedCommits.length > 0
                                                        const hasRecentCommits = gitHistory.length > 0
                                                        const visibleSummaryCards =
                                                            (hasWorkingChanges ? 1 : 0) +
                                                            (hasUnpushedCommits ? 1 : 0) +
                                                            (hasRecentCommits ? 1 : 0)

                                                        return (
                                                            <div className={cn(
                                                                "grid gap-3",
                                                                visibleSummaryCards >= 2 ? "grid-cols-1 md:grid-cols-2" : "grid-cols-1"
                                                            )}>
                                                    {/* Uncommitted Changes */}
                                                    {hasWorkingChanges && (
                                                        <div className="bg-[#E2C08D]/5 rounded-xl border border-[#E2C08D]/20 p-4">
                                                            <div className="flex items-center justify-between mb-2">
                                                                <h4 className="text-sm font-medium text-[#E2C08D]">Working Changes</h4>
                                                                <span className="text-xs bg-[#E2C08D]/20 text-[#E2C08D] px-2 py-0.5 rounded-full">
                                                                    {changedFiles.length}
                                                                </span>
                                                            </div>
                                                            <div className="space-y-1">
                                                                {changedFiles.slice(0, 3).map((file) => (
                                                                    <div key={file.path} className="flex items-center gap-2 text-xs text-white/60">
                                                                        <span className={cn(
                                                                            "text-[9px] uppercase font-bold px-1 py-0.5 rounded",
                                                                            file.gitStatus === 'modified' && "bg-[#E2C08D]/20 text-[#E2C08D]",
                                                                            file.gitStatus === 'added' && "bg-[#73C991]/20 text-[#73C991]",
                                                                            file.gitStatus === 'deleted' && "bg-[#FF6B6B]/20 text-[#FF6B6B]"
                                                                        )}>
                                                                            {file.gitStatus?.substring(0, 1)}
                                                                        </span>
                                                                        <span className="truncate">{file.name}</span>
                                                                    </div>
                                                                ))}
                                                                {changedFiles.length > 3 && (
                                                                    <button
                                                                        onClick={() => setGitView('changes')}
                                                                        className="text-xs text-[#E2C08D] hover:underline"
                                                                    >
                                                                        +{changedFiles.length - 3} more...
                                                                    </button>
                                                                )}
                                                            </div>
                                                        </div>
                                                    )}

                                                    {/* Committed but Not Pushed */}
                                                    {hasUnpushedCommits && (
                                                        <div className="bg-blue-500/5 rounded-xl border border-blue-500/20 p-4">
                                                            <div className="flex items-center justify-between mb-2">
                                                                <h4 className="text-sm font-medium text-blue-400">Recent Changes (To Push)</h4>
                                                                <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded-full">
                                                                    {unpushedCommits.length}
                                                                </span>
                                                            </div>
                                                            <div className="space-y-1">
                                                                {unpushedCommits.slice(0, 3).map((commit) => (
                                                                    <div key={commit.hash} className="text-xs text-white/60 truncate">
                                                                        <span className="font-mono text-white/40">{commit.shortHash}</span> {commit.message}
                                                                    </div>
                                                                ))}
                                                                {unpushedCommits.length > 3 && (
                                                                    <button
                                                                        onClick={() => setGitView('unpushed')}
                                                                        className="text-xs text-blue-400 hover:underline"
                                                                    >
                                                                        +{unpushedCommits.length - 3} more...
                                                                    </button>
                                                                )}
                                                            </div>
                                                        </div>
                                                    )}

                                                    {/* Recent Commits */}
                                                    {hasRecentCommits && (
                                                        <div className={cn(
                                                            "bg-white/5 rounded-xl border border-white/5 p-4",
                                                            visibleSummaryCards === 3 && "md:col-span-2"
                                                        )}>
                                                            <div className="flex items-center justify-between mb-2">
                                                                <h4 className="text-sm font-medium text-white/80">Recent Commits</h4>
                                                                <span className="text-xs bg-white/10 text-white/60 px-2 py-0.5 rounded-full">
                                                                    {gitHistory.length}
                                                                </span>
                                                            </div>
                                                            <div className="space-y-1">
                                                                {gitHistory.slice(0, 3).map((commit) => (
                                                                    <div key={commit.hash} className="text-xs text-white/60 truncate">
                                                                        <span className="font-mono text-white/40">{commit.shortHash}</span> {commit.message}
                                                                    </div>
                                                                ))}
                                                                {gitHistory.length > 3 && (
                                                                    <button
                                                                        onClick={() => setGitView('history')}
                                                                        className="text-xs text-[var(--accent-primary)] hover:underline"
                                                                    >
                                                                        View all...
                                                                    </button>
                                                                )}
                                                            </div>
                                                        </div>
                                                    )}
                                                            </div>
                                                        )
                                                    })()}

                                                    {/* Repository Metadata */}
                                                    {(branches.length > 0 || remotes.length > 0 || tags.length > 0 || stashes.length > 0) && (
                                                        <div className="bg-white/5 rounded-xl border border-white/5 p-4 space-y-4">
                                                            <div className="flex items-center justify-between">
                                                                <h4 className="text-sm font-medium text-white/80">Repository Details</h4>
                                                                <span className="text-xs text-white/40">Live Git metadata</span>
                                                            </div>

                                                            <div className="grid grid-cols-2 gap-2 text-xs">
                                                                <div className="bg-black/20 rounded-lg border border-white/5 px-3 py-2">
                                                                    <div className="text-white/40">Branches</div>
                                                                    <div className="text-white/80 font-medium">{branches.length}</div>
                                                                </div>
                                                                <div className="bg-black/20 rounded-lg border border-white/5 px-3 py-2">
                                                                    <div className="text-white/40">Remotes</div>
                                                                    <div className="text-white/80 font-medium">{remotes.length}</div>
                                                                </div>
                                                                <div className="bg-black/20 rounded-lg border border-white/5 px-3 py-2">
                                                                    <div className="text-white/40">Tags</div>
                                                                    <div className="text-white/80 font-medium">{tags.length}</div>
                                                                </div>
                                                                <div className="bg-black/20 rounded-lg border border-white/5 px-3 py-2">
                                                                    <div className="text-white/40">Stashes</div>
                                                                    <div className="text-white/80 font-medium">{stashes.length}</div>
                                                                </div>
                                                            </div>

                                                            {branches.length > 0 && (
                                                                <div className="space-y-1">
                                                                    <div className="text-xs text-white/40">Active Branches</div>
                                                                    {branches.slice(0, 4).map((branch) => (
                                                                        <div key={branch.name} className="text-xs text-white/65 truncate">
                                                                            <span className={cn('font-mono', branch.current && 'text-green-300')}>
                                                                                {branch.current ? '* ' : ''}{branch.name}
                                                                            </span>
                                                                            {branch.isRemote ? ' (remote)' : ''}
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            )}

                                                            {remotes.length > 0 && (
                                                                <div className="space-y-1">
                                                                    <div className="text-xs text-white/40">Remotes</div>
                                                                    {remotes.slice(0, 3).map((remote) => (
                                                                        <div key={remote.name} className="text-xs text-white/65 truncate">
                                                                            <span className="font-mono">{remote.name}</span>{' '}
                                                                            <span className="text-white/40">{remote.fetchUrl || remote.pushUrl}</span>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )
                                    ) : gitView === 'changes' ? (
                                        changedFiles.length > 0 ? (
                                            <WorkingChangesView
                                                files={changedFiles}
                                                projectPath={decodedPath}
                                                currentPage={changesPage}
                                                onPageChange={setChangesPage}
                                            />
                                        ) : (
                                            <div className="flex flex-col items-center justify-center py-24 text-white/30">
                                                <Check size={48} className="mb-4 opacity-50 text-green-400" />
                                                <p>No local changes</p>
                                                <p className="text-xs opacity-50">Working tree is clean</p>
                                            </div>
                                        )
                                    ) : gitView === 'unpushed' ? (
                                        unpushedCommits.length > 0 ? (
                                            <>
                                                <div className="space-y-2">
                                                    {unpushedCommits.slice((unpushedPage - 1) * ITEMS_PER_PAGE, unpushedPage * ITEMS_PER_PAGE).map((commit) => (
                                                        <div
                                                            key={commit.hash}
                                                            onClick={() => handleCommitClick(commit)}
                                                            className="bg-black/30 rounded-xl border border-white/5 p-4 hover:bg-white/5 cursor-pointer transition-colors"
                                                        >
                                                            <div className="flex items-start gap-3">
                                                                <GitCommitHorizontal size={16} className="text-blue-400 mt-0.5" />
                                                                <div className="flex-1 min-w-0">
                                                                    <p className="text-sm font-medium text-white/90 mb-1">{commit.message}</p>
                                                                    <div className="flex items-center gap-3 text-xs text-white/40">
                                                                        <span className="font-mono">{commit.shortHash}</span>
                                                                        <span>{commit.author}</span>
                                                                        <span>{new Date(commit.date).toLocaleDateString()}</span>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                                {unpushedCommits.length > ITEMS_PER_PAGE && (
                                                    <div className="flex items-center justify-between pt-4 mt-4 border-t border-white/5">
                                                        <span className="text-xs text-white/40">
                                                            Showing {((unpushedPage - 1) * ITEMS_PER_PAGE) + 1}-{Math.min(unpushedPage * ITEMS_PER_PAGE, unpushedCommits.length)} of {unpushedCommits.length}
                                                        </span>
                                                        <div className="flex items-center gap-2">
                                                            <button
                                                                onClick={() => setUnpushedPage(p => Math.max(1, p - 1))}
                                                                disabled={unpushedPage === 1}
                                                                className="px-3 py-1.5 text-xs font-medium rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                                                            >
                                                                Previous
                                                            </button>
                                                            <span className="text-xs text-white/60 px-2">
                                                                {unpushedPage} / {Math.ceil(unpushedCommits.length / ITEMS_PER_PAGE)}
                                                            </span>
                                                            <button
                                                                onClick={() => setUnpushedPage(p => Math.min(Math.ceil(unpushedCommits.length / ITEMS_PER_PAGE), p + 1))}
                                                                disabled={unpushedPage >= Math.ceil(unpushedCommits.length / ITEMS_PER_PAGE)}
                                                                className="px-3 py-1.5 text-xs font-medium rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                                                            >
                                                                Next
                                                            </button>
                                                        </div>
                                                    </div>
                                                )}
                                            </>
                                        ) : (
                                            <div className="flex flex-col items-center justify-center py-24 text-white/30">
                                                <GitPullRequest size={48} className="mb-4 opacity-50" />
                                                <p>No unpushed commits</p>
                                                <p className="text-xs opacity-50">All commits are synced</p>
                                            </div>
                                        )
                                    ) : gitView === 'history' ? (
                                        loadingGit ? (
                                            <div className="flex items-center justify-center py-24 text-white/30">
                                                <RefreshCw size={24} className="animate-spin mb-2" />
                                                <p className="text-xs">Loading history...</p>
                                            </div>
                                        ) : gitHistory.length > 0 ? (
                                            <>
                                                <GitGraph
                                                    commits={gitHistory.slice((commitPage - 1) * COMMITS_PER_PAGE, commitPage * COMMITS_PER_PAGE)}
                                                    onCommitClick={handleCommitClick}
                                                />
                                                {gitHistory.length > COMMITS_PER_PAGE && (
                                                    <div className="flex items-center justify-between pt-4 mt-4 border-t border-white/5">
                                                        <span className="text-xs text-white/40">
                                                            Showing {((commitPage - 1) * COMMITS_PER_PAGE) + 1}-{Math.min(commitPage * COMMITS_PER_PAGE, gitHistory.length)} of {gitHistory.length}
                                                        </span>
                                                        <div className="flex items-center gap-2">
                                                            <button
                                                                onClick={() => setCommitPage(p => Math.max(1, p - 1))}
                                                                disabled={commitPage === 1}
                                                                className="px-3 py-1.5 text-xs font-medium rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                                                            >
                                                                Previous
                                                            </button>
                                                            <span className="text-xs text-white/60 px-2">
                                                                {commitPage} / {Math.ceil(gitHistory.length / COMMITS_PER_PAGE)}
                                                            </span>
                                                            <button
                                                                onClick={() => setCommitPage(p => Math.min(Math.ceil(gitHistory.length / COMMITS_PER_PAGE), p + 1))}
                                                                disabled={commitPage >= Math.ceil(gitHistory.length / COMMITS_PER_PAGE)}
                                                                className="px-3 py-1.5 text-xs font-medium rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                                                            >
                                                                Next
                                                            </button>
                                                        </div>
                                                    </div>
                                                )}
                                            </>
                                        ) : (
                                            <div className="flex flex-col items-center justify-center py-24 text-white/30">
                                                <GitBranch size={48} className="mb-4 opacity-50" />
                                                <p>No commit history found</p>
                                            </div>
                                        )
                                    ) : null}
                                </div>
                            </div>
                        ) : null}
                    </div>
                </div>


                {/* RIGHT COLUMN: TOOLS & PANEL */}
                <div className="col-span-12 lg:col-span-4 flex flex-col gap-6">

                    {/* 1. Scripts Card */}
                    {project.scripts && Object.keys(project.scripts).length > 0 && (
                        <div className="bg-sparkle-card border border-white/5 rounded-2xl overflow-hidden shadow-sm flex flex-col">
                            <div className="px-5 py-4 border-b border-white/5 bg-white/[0.02] flex items-center justify-between">
                                <div className="flex items-center gap-2 text-white/80 font-medium">
                                    <Command size={18} className="text-[var(--accent-primary)]" />
                                    <span>Scripts</span>
                                </div>
                                <span className="text-xs bg-white/5 text-white/40 px-2 py-1 rounded-md">
                                    {Object.keys(project.scripts).length}
                                </span>
                            </div>
                            <div className="max-h-[380px] overflow-y-auto custom-scrollbar p-2">
                                {Object.entries(project.scripts).map(([name, cmd]) => {
                                    const prediction = scriptPredictions[name] || detectScriptIntentWithConfidence(name, cmd, scriptIntentContext)
                                    const confidencePercent = Math.round(prediction.confidence * 100)

                                    return (
                                        <div key={name} className="group flex items-center gap-3 p-3 hover:bg-white/5 rounded-xl transition-colors border border-transparent hover:border-white/5">
                                            <button
                                                onClick={() => runScript(name, cmd)}
                                                className="p-2.5 rounded-full bg-[var(--accent-primary)]/10 text-[var(--accent-primary)] group-hover:bg-[var(--accent-primary)] group-hover:text-white transition-all shrink-0"
                                                title="Run Script"
                                            >
                                                <Play size={16} />
                                            </button>
                                            <div className="min-w-0 flex-1">
                                                <div className="flex items-center justify-between gap-2">
                                                    <span className="text-sm font-medium text-white/90 truncate">{name}</span>
                                                    <div className="flex items-center gap-1.5 shrink-0">
                                                        <span className={cn('text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full border', SCRIPT_INTENT_BADGE_CLASSES[prediction.intent])}>
                                                            {SCRIPT_INTENT_LABELS[prediction.intent]}
                                                        </span>
                                                        <span className="text-[10px] text-white/45 bg-white/10 px-1.5 py-0.5 rounded-full border border-white/10">
                                                            {confidencePercent}%
                                                        </span>
                                                    </div>
                                                </div>
                                                <p className="text-xs text-white/40 truncate font-mono mt-0.5">{cmd}</p>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    )}
                    {/* 2. Dependencies Card */}
                    {project.dependencies && (
                        <div className="bg-sparkle-card border border-white/5 rounded-2xl overflow-hidden shadow-sm">
                            <div className="px-5 py-4 border-b border-white/5 bg-white/[0.02] flex items-center justify-between">
                                <div className="flex items-center gap-2 text-white/80 font-medium">
                                    <Package size={18} className="text-purple-400" />
                                    <span>Dependencies</span>
                                    <span className="text-xs bg-white/5 text-white/40 px-2 py-1 rounded-md">
                                        {Object.keys(project.dependencies).length}
                                    </span>
                                </div>
                                <button
                                    onClick={() => setShowDependenciesModal(true)}
                                    className="text-xs text-white/40 hover:text-white transition-colors"
                                >
                                    View All
                                </button>
                            </div>
                            <div className="p-2">
                                {Object.entries(project.dependencies).slice(0, 5).map(([name, ver]) => (
                                    <div key={name} className="flex items-center justify-between p-2.5 rounded-lg hover:bg-white/5 transition-colors">
                                        <span className="text-sm text-white/70 truncate max-w-[150px]">{name}</span>
                                        <span className="text-xs font-mono text-white/30 bg-white/5 px-1.5 py-0.5 rounded">{ver}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {pendingScriptRun && pendingScriptRun.intent === 'server' && (
                <div
                    className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 backdrop-blur-md animate-fadeIn"
                    onClick={closeScriptRunModal}
                >
                    <div
                        className="w-full max-w-3xl rounded-2xl border border-white/10 bg-sparkle-card shadow-2xl m-4 overflow-hidden"
                        onClick={(event) => event.stopPropagation()}
                    >
                        <div className="flex items-center justify-between px-5 py-4 border-b border-white/5 bg-white/[0.03]">
                            <div className="flex items-center gap-2 text-white/90 font-medium">
                                <Play size={16} className="text-[var(--accent-primary)]" />
                                <span>Run Server Script</span>
                            </div>
                            <button
                                onClick={closeScriptRunModal}
                                className="p-1.5 rounded-md text-white/40 hover:text-white hover:bg-white/10 transition-colors"
                                title="Close"
                            >
                                <X size={16} />
                            </button>
                        </div>

                        <div className="p-5 max-h-[70vh] overflow-y-auto">
                            <div className="grid gap-4 lg:grid-cols-2">
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-xs font-medium text-white/60 mb-2">Port Override (Optional)</label>
                                        <input
                                            type="text"
                                            inputMode="numeric"
                                            placeholder="Use project default port"
                                            value={scriptPortInput}
                                            onChange={(event) => {
                                                setScriptPortInput(event.target.value)
                                                setScriptRunError(null)
                                            }}
                                            className="w-full rounded-lg border border-white/10 bg-black/25 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[var(--accent-primary)]/40"
                                        />
                                        <p className="text-[11px] text-white/40 mt-1">
                                            Leave empty to keep the script default.
                                        </p>
                                    </div>

                                    <label className="flex items-start gap-3 rounded-lg border border-white/10 bg-black/20 px-3 py-3 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={scriptExposeNetwork}
                                            onChange={(event) => {
                                                setScriptExposeNetwork(event.target.checked)
                                                setScriptRunError(null)
                                            }}
                                            className="mt-0.5 h-4 w-4 rounded border-white/30 bg-black/30 text-[var(--accent-primary)] focus:ring-[var(--accent-primary)]"
                                        />
                                        <span className="text-sm text-white/75">
                                            Expose on local network (`0.0.0.0`).
                                            {!scriptExposeNetwork && <span className="block text-xs text-white/45 mt-0.5">Disabled = localhost/default host.</span>}
                                        </span>
                                    </label>

                                    <button
                                        type="button"
                                        onClick={() => setScriptAdvancedOpen((prev) => !prev)}
                                        className="w-full flex items-center justify-between rounded-lg border border-white/10 bg-black/20 px-3 py-2.5 text-sm text-white/80 hover:bg-black/30 transition-colors"
                                    >
                                        <span>Advanced Settings</span>
                                        {scriptAdvancedOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                    </button>

                                    {scriptAdvancedOpen && (
                                        <div className="space-y-3 rounded-lg border border-white/10 bg-black/15 p-3">
                                            <div>
                                                <label className="block text-xs font-medium text-white/60 mb-2">Additional Script Arguments (Optional)</label>
                                                <input
                                                    type="text"
                                                    placeholder="example: --strictPort --open"
                                                    value={scriptExtraArgsInput}
                                                    onChange={(event) => {
                                                        setScriptExtraArgsInput(event.target.value)
                                                        setScriptRunError(null)
                                                    }}
                                                    className="w-full rounded-lg border border-white/10 bg-black/25 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[var(--accent-primary)]/40"
                                                />
                                                <p className="text-[11px] text-white/40 mt-1">
                                                    Passed to `{scriptRunner}` after the script name.
                                                </p>
                                            </div>

                                            <div>
                                                <label className="block text-xs font-medium text-white/60 mb-2">Environment Overrides (Optional)</label>
                                                <textarea
                                                    rows={3}
                                                    placeholder={'PORT=4173\nAPI_BASE_URL=http://localhost:9000'}
                                                    value={scriptEnvInput}
                                                    onChange={(event) => {
                                                        setScriptEnvInput(event.target.value)
                                                        setScriptRunError(null)
                                                    }}
                                                    className="w-full rounded-lg border border-white/10 bg-black/25 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[var(--accent-primary)]/40 font-mono"
                                                />
                                                <p className="text-[11px] text-white/40 mt-1">
                                                    One `KEY=VALUE` per line. Lines starting with `#` are ignored.
                                                </p>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <div className="space-y-4">
                                    <div className="rounded-xl border border-white/10 bg-black/20 p-3 space-y-2">
                                        <div className="flex items-center justify-between gap-2">
                                            <div className="text-xs text-white/50">Script</div>
                                            <div className="flex items-center gap-1.5">
                                                <span className={cn('text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full border', SCRIPT_INTENT_BADGE_CLASSES[pendingScriptRun.intent])}>
                                                    {SCRIPT_INTENT_LABELS[pendingScriptRun.intent]}
                                                </span>
                                                <span className="text-[10px] text-white/45 bg-white/10 px-1.5 py-0.5 rounded-full border border-white/10">
                                                    {Math.round(pendingScriptRun.confidence * 100)}%
                                                </span>
                                            </div>
                                        </div>
                                        <div className="text-sm text-white/90 font-medium">{pendingScriptRun.name}</div>
                                        <div className="text-xs text-white/45 font-mono break-all">{pendingScriptRun.command}</div>
                                        <div className="text-xs text-white/45">
                                            App prediction: {SCRIPT_INTENT_LABELS[pendingScriptRun.intent]} script.
                                        </div>
                                    </div>

                                    <div className="rounded-lg border border-white/10 bg-black/20 p-3">
                                        <div className="text-[11px] text-white/50 mb-1">Final Command</div>
                                        <code className="text-[11px] text-white/75 break-all">
                                            {scriptCommandPreview}
                                        </code>
                                        <div className="text-[11px] text-white/40 mt-2">
                                            Uses {scriptRunner} runner with server-focused overrides.
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {scriptRunError && (
                                <div className="mt-4 text-xs text-red-300 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">
                                    {scriptRunError}
                                </div>
                            )}
                        </div>

                        <div className="px-5 py-4 border-t border-white/5 bg-white/[0.03] flex items-center justify-end gap-2">
                            <button
                                onClick={closeScriptRunModal}
                                className="px-3 py-2 rounded-lg text-sm text-white/60 hover:text-white hover:bg-white/10 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleConfirmScriptRun}
                                className="px-4 py-2 rounded-lg text-sm font-medium bg-[var(--accent-primary)] text-white hover:bg-[var(--accent-primary)]/85 transition-colors"
                            >
                                Run in Terminal
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* File Preview Modal */}
            {previewFile && (
                <FilePreviewModal
                    file={previewFile}
                    content={previewContent}
                    loading={loadingPreview}
                    truncated={previewTruncated}
                    size={previewSize}
                    previewBytes={previewBytes}
                    onClose={closePreview}
                />
            )}

            {toast && (
                <div
                    className={cn(
                        'fixed bottom-4 right-4 z-[80] max-w-sm rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-300 shadow-lg backdrop-blur-md transition-all duration-300',
                        toast.visible ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0 pointer-events-none'
                    )}
                >
                    <div className="flex items-start gap-2">
                        <AlertCircle size={16} className="mt-0.5 shrink-0" />
                        <div className="flex flex-col gap-1">
                            <span>{toast.message}</span>
                            {toast.actionTo && toast.actionLabel && (
                                <button
                                    onClick={() => {
                                        navigate(toast.actionTo!)
                                        setToast(null)
                                    }}
                                    className="text-left text-xs font-medium text-amber-200 underline underline-offset-2 hover:text-amber-100 transition-colors"
                                >
                                    {toast.actionLabel}
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
