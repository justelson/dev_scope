import { memo, useCallback, useMemo, useState } from 'react'
import { Check, ChevronDown, Copy, FileCode2, FilePenLine, FileText, Search, Wrench } from 'lucide-react'
import type { AssistantActivity } from '@shared/assistant/contracts'
import { AnimatedHeight } from '@/components/ui/AnimatedHeight'
import { cn } from '@/lib/utils'
import { formatAssistantDateTime } from '@/lib/assistant/selectors'
import { scanPatchFileSummaries } from '@/lib/diffRendering'
import { DiffStats } from '@/pages/project-details/DiffStats'
import type { AssistantDiffTarget } from './assistant-diff-types'
import { getAssistantRelativeFilePath } from './assistant-file-navigation'
import {
    areActivitiesEquivalent,
    areActivityListsEqual,
    copyTextToClipboard,
    getActivityCommand,
    getActivityDetails,
    getActivityDiffStats,
    getActivityElapsed,
    getActivityOutput,
    getActivityPatch,
    getActivityPaths,
    getActivityStatus,
    getActivityTitle,
    getCreatedFilePaths
} from './assistant-timeline-helpers'

function getActivityIcon(activity: AssistantActivity) {
    if (activity.kind === 'search') return <Search size={13} />
    if (activity.kind === 'file-read') return <FileText size={13} />
    if (activity.kind === 'file-change') return <FilePenLine size={13} />
    return <Wrench size={13} />
}

const TimelineCopyButton = memo(({ value }: { value: string }) => {
    const [copied, setCopied] = useState(false)
    const [copyError, setCopyError] = useState<string | null>(null)

    const handleCopy = async () => {
        try {
            await copyTextToClipboard(value)
            setCopied(true)
            setCopyError(null)
            window.setTimeout(() => setCopied(false), 1600)
        } catch (error) {
            setCopyError(error instanceof Error ? error.message : 'Failed to copy')
            window.setTimeout(() => setCopyError(null), 2200)
        }
    }

    return (
        <button
            type="button"
            onClick={() => void handleCopy()}
            className={cn(
                'inline-flex h-7 w-7 items-center justify-center rounded-md border transition-colors',
                copied ? 'border-emerald-400/20 bg-emerald-500/[0.08] text-emerald-300'
                    : copyError ? 'border-red-400/20 bg-red-500/[0.08] text-red-100'
                        : 'border-white/10 bg-white/[0.03] text-sparkle-text-muted hover:border-white/20 hover:text-sparkle-text'
            )}
            title={copyError || (copied ? 'Copied' : 'Copy')}
        >
            {copied ? <Check size={11} /> : <Copy size={11} />}
        </button>
    )
})

const TimelineFilePathRow = memo(({
    displayPath,
    fullPath,
    isNew = false,
    onOpen,
    onViewDiff
}: {
    displayPath: string
    fullPath: string
    isNew?: boolean
    onOpen?: (filePath: string) => Promise<void> | void
    onViewDiff?: () => void
}) => {
    return (
        <div className="mt-1.5 rounded-md border border-white/10 bg-[var(--accent-primary)]/10 px-2 py-1">
            <div className="flex items-center gap-2">
                {onOpen ? (
                    <button
                        type="button"
                        onClick={() => void onOpen(fullPath)}
                        className="min-w-0 flex-1 text-left font-mono text-[12px] leading-6 text-[var(--accent-primary)] transition-colors hover:text-white"
                        title={fullPath}
                    >
                        <span className="flex items-center gap-2">
                            {isNew ? <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-sky-400 shadow-[0_0_10px_rgba(56,189,248,0.75)]" /> : null}
                            <span className="block min-w-0 whitespace-pre-wrap break-all">{displayPath}</span>
                        </span>
                    </button>
                ) : (
                    <div className="min-w-0 flex-1 font-mono text-[12px] leading-6 text-[var(--accent-primary)]" title={fullPath}>
                        <span className="flex items-center gap-2">
                            {isNew ? <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-sky-400 shadow-[0_0_10px_rgba(56,189,248,0.75)]" /> : null}
                            <span className="block min-w-0 whitespace-pre-wrap break-all">{displayPath}</span>
                        </span>
                    </div>
                )}
                <div className="flex shrink-0 items-center gap-1">
                    {onViewDiff ? (
                        <button
                            type="button"
                            onClick={onViewDiff}
                            className="inline-flex h-7 items-center gap-1 rounded-md border border-white/10 bg-white/[0.04] px-2 text-[10px] font-medium text-sparkle-text-secondary transition-colors hover:border-white/20 hover:bg-white/[0.06] hover:text-sparkle-text"
                            title={`View AI runtime diff for ${displayPath}`}
                        >
                            <FileCode2 size={11} />
                            <span>View diff</span>
                        </button>
                    ) : null}
                    <TimelineCopyButton value={displayPath} />
                </div>
            </div>
        </div>
    )
})

const TimelineToolCallCard = memo(({
    activity,
    projectRootPath,
    onOpenFilePath,
    onViewDiff
}: {
    activity: AssistantActivity
    projectRootPath?: string | null
    onOpenFilePath?: (filePath: string) => Promise<void> | void
    onViewDiff?: (target: AssistantDiffTarget) => void
}) => {
    const [expanded, setExpanded] = useState(false)
    const filePaths = useMemo(() => getActivityPaths(activity), [activity])
    const createdFilePaths = useMemo(() => getCreatedFilePaths(activity), [activity])
    const createdFilePathSet = useMemo(() => new Set(createdFilePaths), [createdFilePaths])
    const displayFilePaths = useMemo(
        () => filePaths.map((pathValue) => getAssistantRelativeFilePath(pathValue, projectRootPath)),
        [filePaths, projectRootPath]
    )
    const primaryValue = useMemo(() => getActivityCommand(activity), [activity])
    const title = useMemo(() => getActivityTitle(activity), [activity])
    const status = useMemo(() => getActivityStatus(activity), [activity])
    const elapsed = useMemo(() => getActivityElapsed(activity), [activity])
    const diffStats = useMemo(() => getActivityDiffStats(activity), [activity])
    const uniqueFileCount = useMemo(() => new Set(filePaths).size, [filePaths])
    const patch = useMemo(() => expanded ? getActivityPatch(activity) : null, [activity, expanded])
    const output = useMemo(() => expanded ? getActivityOutput(activity) : '', [activity, expanded])
    const detailLines = useMemo(
        () => expanded ? getActivityDetails(activity).filter((line) => line !== primaryValue && line !== output && !filePaths.includes(line)) : [],
        [activity, expanded, filePaths, output, primaryValue]
    )
    const patchFileSummaries = useMemo(() => expanded && patch ? scanPatchFileSummaries(patch) : [], [expanded, patch])
    const fileSectionEntries = useMemo(() => {
        if (!expanded) return []

        if (patchFileSummaries.length > 0) {
            return patchFileSummaries.map((summary) => ({
                fullPath: summary.path,
                displayPath: getAssistantRelativeFilePath(summary.path, projectRootPath) || summary.path,
                previousPath: summary.previousPath,
                isNew: createdFilePathSet.has(summary.path),
                additions: summary.additions,
                deletions: summary.deletions
            }))
        }

        if (activity.kind === 'file-change') {
            const fallbackChangedFileCount = Math.max(1, diffStats?.fileCount || 1)
            const uniquePaths: string[] = []
            for (const fullPath of filePaths) {
                if (uniquePaths.includes(fullPath)) continue
                uniquePaths.push(fullPath)
                if (uniquePaths.length >= fallbackChangedFileCount) break
            }

            return uniquePaths.map((fullPath) => {
                const originalIndex = filePaths.indexOf(fullPath)
                return {
                    fullPath,
                    displayPath: displayFilePaths[originalIndex] || fullPath,
                    previousPath: undefined,
                    isNew: createdFilePathSet.has(fullPath),
                    additions: null,
                    deletions: null
                }
            })
        }

        const seen = new Set<string>()
        return filePaths.flatMap((fullPath, index) => {
            if (seen.has(fullPath)) return []
            seen.add(fullPath)
            return [{
                fullPath,
                displayPath: displayFilePaths[index] || fullPath,
                previousPath: undefined,
                isNew: createdFilePathSet.has(fullPath),
                additions: null,
                deletions: null
            }]
        })
    }, [activity.kind, createdFilePathSet, diffStats?.fileCount, displayFilePaths, expanded, filePaths, patchFileSummaries, projectRootPath])
    const displayedFilePathSet = useMemo(
        () => new Set(fileSectionEntries.map((entry) => entry.fullPath)),
        [fileSectionEntries]
    )
    const secondaryPathEntries = useMemo(
        () => expanded ? filePaths.slice(1).map((fullPath, index) => ({
            fullPath,
            displayPath: displayFilePaths[index + 1] || fullPath,
            isNew: createdFilePathSet.has(fullPath)
        })) : [],
        [createdFilePathSet, displayFilePaths, expanded, filePaths]
    )
    const effectiveFileCount = diffStats?.fileCount ?? uniqueFileCount
    const isMultiFileChange = activity.kind === 'file-change' && effectiveFileCount > 1
    const primaryLabel = activity.kind === 'file-change'
        ? (isMultiFileChange ? `Edited files (${effectiveFileCount})` : displayFilePaths[0] || primaryValue || title)
        : primaryValue || title
    const filteredOutput = useMemo(() => {
        if (!expanded || activity.kind !== 'file-change' || !output) return output

        const filteredLines = output
            .split(/\r?\n/)
            .filter((line) => !displayedFilePathSet.has(line.trim()))

        return filteredLines.join('\n').trim()
    }, [activity.kind, displayedFilePathSet, expanded, output])
    const filteredDetailLines = useMemo(() => {
        if (!expanded || activity.kind !== 'file-change') return detailLines
        return detailLines.filter((line) => !displayedFilePathSet.has(line.trim()))
    }, [activity.kind, detailLines, displayedFilePathSet, expanded])
    const copyValue = useMemo(
        () => expanded ? [primaryValue, filteredOutput, ...filteredDetailLines].filter((value) => String(value || '').trim()).join('\n\n') : '',
        [expanded, filteredDetailLines, filteredOutput, primaryValue]
    )
    const canOpenFileSections = Boolean(onOpenFilePath && activity.kind === 'file-change')
    const canViewDiff = Boolean(expanded && onViewDiff && activity.kind === 'file-change' && patch)
    const primaryPathIsNew = Boolean(filePaths[0] && createdFilePathSet.has(filePaths[0]))
    const viewDiffForPath = useCallback((filePath: string, displayPath: string, previousPath?: string, isNew = false) => {
        if (!onViewDiff || !patch) return
        onViewDiff({
            activityId: activity.id,
            filePath,
            displayPath,
            patch,
            previousPath,
            createdAt: activity.createdAt,
            isNew
        })
    }, [activity.createdAt, activity.id, onViewDiff, patch])

    return (
        <div className="px-2 py-1.5">
            <button type="button" onClick={() => setExpanded((current) => !current)} className="flex w-full min-w-0 items-center gap-2 overflow-hidden rounded-lg text-left transition-colors hover:bg-white/[0.02]">
                <span className={cn('inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md border', status === 'success' ? 'border-emerald-400/20 bg-emerald-500/[0.10] text-emerald-300' : status === 'running' ? 'border-amber-400/20 bg-amber-500/[0.10] text-amber-300' : 'border-white/8 bg-white/[0.03] text-white/35')}>
                    {getActivityIcon(activity)}
                </span>
                <div className="min-w-0 flex-1">
                    <div className="flex min-w-0 items-center gap-2">
                        <p className="min-w-0 flex-1 truncate font-mono text-[11px] leading-5 text-sparkle-text-secondary">
                            <span className="inline-flex min-w-0 items-center gap-2">
                                {!isMultiFileChange && primaryPathIsNew ? <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-sky-400 shadow-[0_0_10px_rgba(56,189,248,0.75)]" /> : null}
                                <span className="truncate">{primaryLabel}</span>
                            </span>
                        </p>
                        {diffStats ? <DiffStats additions={diffStats.additions} deletions={diffStats.deletions} compact className="shrink-0 gap-1.5" /> : null}
                    </div>
                    <p className="truncate text-[9px] font-medium uppercase tracking-[0.14em] text-white/20">{title}{elapsed ? <span className="ml-1.5 normal-case tracking-normal text-white/22"> • {elapsed}</span> : null}</p>
                </div>
                <ChevronDown size={11} className={cn('shrink-0 text-white/15 transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] will-change-transform', expanded && 'rotate-180')} />
            </button>
            <AnimatedHeight isOpen={expanded} duration={240}>
                <div className="mt-2 rounded-lg border border-white/5 bg-black/20 p-2.5">
                    <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                            <p className="text-[10px] text-white/18">{formatAssistantDateTime(activity.createdAt)}{elapsed ? <span className="ml-1.5"> • {elapsed}</span> : null}</p>
                            <p className="mt-1 text-[9px] font-medium uppercase tracking-[0.14em] text-white/18">{title}</p>
                            {diffStats ? <DiffStats additions={diffStats.additions} deletions={diffStats.deletions} compact className="mt-1.5 gap-1.5" /> : null}
                        </div>
                        {copyValue && activity.kind !== 'file-change' ? <TimelineCopyButton value={copyValue} /> : null}
                    </div>
                    {activity.kind === 'file-change' && fileSectionEntries.length > 0 ? (
                        <div className="mt-2 space-y-2">
                            {fileSectionEntries.map(({ fullPath, displayPath, previousPath, isNew, additions, deletions }, index) => (
                                <div key={`${activity.id}-${fullPath}-${previousPath || index}`} className="rounded-md border border-white/5 bg-black/25 p-2">
                                    {isMultiFileChange ? (
                                        <div className="mb-1 flex items-center justify-between gap-2">
                                            <p className="text-[9px] font-medium uppercase tracking-[0.14em] text-white/18">File {index + 1}</p>
                                            {additions !== null && deletions !== null ? (
                                                <DiffStats additions={additions} deletions={deletions} compact className="shrink-0 gap-1.5" />
                                            ) : null}
                                        </div>
                                    ) : null}
                                    {!isMultiFileChange && additions !== null && deletions !== null ? (
                                        <DiffStats additions={additions} deletions={deletions} compact className="mb-1 gap-1.5" />
                                    ) : null}
                                    <TimelineFilePathRow
                                        displayPath={displayPath}
                                        fullPath={fullPath}
                                        isNew={isNew}
                                        onOpen={canOpenFileSections ? onOpenFilePath : undefined}
                                        onViewDiff={canViewDiff ? () => viewDiffForPath(fullPath, displayPath, previousPath, isNew) : undefined}
                                    />
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="mt-1.5 whitespace-pre-wrap break-all font-mono text-[11px] leading-5 text-white/20">{primaryLabel}</p>
                    )}
                    {activity.kind !== 'file-change' ? secondaryPathEntries.map(({ fullPath, displayPath, isNew }) => (
                        <TimelineFilePathRow
                            key={`${activity.id}-${fullPath}`}
                            displayPath={displayPath}
                            fullPath={fullPath}
                            isNew={isNew}
                            onOpen={onOpenFilePath}
                            onViewDiff={canViewDiff ? () => viewDiffForPath(fullPath, displayPath, undefined, isNew) : undefined}
                        />
                    )) : null}
                    {filteredOutput ? <div className="mt-2 rounded-md border border-white/5 bg-black/25 p-2"><p className="text-[9px] font-medium uppercase tracking-[0.14em] text-white/18">Result</p><p className="mt-1 whitespace-pre-wrap break-all font-mono text-[11px] leading-5 text-white/22">{filteredOutput}</p></div> : null}
                    {filteredDetailLines.map((line, index) => <p key={`${activity.id}-${index}`} className="mt-1.5 whitespace-pre-wrap break-all font-mono text-[11px] leading-5 text-white/18">{line}</p>)}
                </div>
            </AnimatedHeight>
        </div>
    )
}, (prev, next) => {
    return prev.projectRootPath === next.projectRootPath
        && prev.onOpenFilePath === next.onOpenFilePath
        && prev.onViewDiff === next.onViewDiff
        && areActivitiesEquivalent(prev.activity, next.activity)
})

export const TimelineToolCallList = memo(({
    activities,
    projectRootPath,
    onOpenFilePath,
    onViewDiff
}: {
    activities: AssistantActivity[]
    projectRootPath?: string | null
    onOpenFilePath?: (filePath: string) => Promise<void> | void
    onViewDiff?: (target: AssistantDiffTarget) => void
}) => {
    const [expanded, setExpanded] = useState(false)
    const header = useMemo(() => activities.length > 1 ? `Tool Calls (${activities.length})` : 'Tool Calls', [activities.length])
    const hasMore = activities.length > 5
    const visibleActivities = useMemo(() => expanded || !hasMore ? activities : activities.slice(-5), [activities, expanded, hasMore])

    return (
        <div className="max-w-4xl py-2">
            <div className="overflow-hidden rounded-xl border border-white/10 bg-white/[0.03]">
                <div className="flex items-center justify-between gap-2 px-2 pb-0 pt-1.5">
                    <div className="text-[9px] font-medium uppercase tracking-[0.22em] text-white/20">{header}</div>
                    {hasMore ? <button type="button" onClick={() => setExpanded(!expanded)} className="rounded border border-white/10 bg-white/[0.03] px-1.5 py-0.5 text-[9px] text-white/40 transition-colors hover:border-white/20 hover:bg-white/[0.05] hover:text-white/60" title={expanded ? 'Show last 5' : 'Show all'}>{expanded ? 'Show last 5' : `Show all ${activities.length}`}</button> : null}
                </div>
                <div>{visibleActivities.map((activity) => <div key={activity.id}><TimelineToolCallCard activity={activity} projectRootPath={projectRootPath} onOpenFilePath={onOpenFilePath} onViewDiff={onViewDiff} /></div>)}</div>
            </div>
        </div>
    )
}, (prev, next) => {
    return prev.projectRootPath === next.projectRootPath
        && prev.onOpenFilePath === next.onOpenFilePath
        && prev.onViewDiff === next.onViewDiff
        && areActivityListsEqual(prev.activities, next.activities)
})
