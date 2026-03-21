import { useEffect, useMemo, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import { DiffStats } from '../project-details/DiffStats'

type AssistantProjectGitChipProps = {
    projectPath?: string | null
    refreshToken?: string | number | null
}

type GitSummaryState = {
    isGitRepo: boolean
    loading: boolean
    additions: number
    deletions: number
}

const INITIAL_STATE: GitSummaryState = {
    isGitRepo: false,
    loading: false,
    additions: 0,
    deletions: 0
}

function GitHubMark({ className }: { className?: string }) {
    return (
        <svg viewBox="0 0 16 16" aria-hidden="true" className={className} fill="currentColor">
            <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
        </svg>
    )
}

export function AssistantProjectGitChip({ projectPath, refreshToken }: AssistantProjectGitChipProps) {
    const normalizedProjectPath = useMemo(() => String(projectPath || '').trim(), [projectPath])
    const requestIdRef = useRef(0)
    const [state, setState] = useState<GitSummaryState>(INITIAL_STATE)

    useEffect(() => {
        if (!normalizedProjectPath) {
            setState(INITIAL_STATE)
            return
        }

        let cancelled = false
        const requestId = ++requestIdRef.current

        setState((current) => ({
            ...current,
            loading: true
        }))

        void (async () => {
            try {
                const repoResult = await window.devscope.checkIsGitRepo(normalizedProjectPath)
                if (cancelled || requestId !== requestIdRef.current) return

                if (!repoResult?.success || !repoResult.isGitRepo) {
                    setState(INITIAL_STATE)
                    return
                }

                const statusResult = await window.devscope.getGitStatusDetailed(normalizedProjectPath, {
                    includeStats: true
                })
                if (cancelled || requestId !== requestIdRef.current) return

                if (!statusResult?.success) {
                    setState({
                        isGitRepo: true,
                        loading: false,
                        additions: 0,
                        deletions: 0
                    })
                    return
                }

                const totals = (statusResult.entries || []).reduce((summary, entry) => ({
                    additions: summary.additions + Math.max(0, Number(entry.additions) || 0),
                    deletions: summary.deletions + Math.max(0, Number(entry.deletions) || 0)
                }), { additions: 0, deletions: 0 })

                setState({
                    isGitRepo: true,
                    loading: false,
                    additions: totals.additions,
                    deletions: totals.deletions
                })
            } catch {
                if (cancelled || requestId !== requestIdRef.current) return
                setState({
                    isGitRepo: false,
                    loading: false,
                    additions: 0,
                    deletions: 0
                })
            }
        })()

        return () => {
            cancelled = true
        }
    }, [normalizedProjectPath, refreshToken])

    if (!state.isGitRepo && !state.loading) return null

    return (
        <div
            className={cn(
                'inline-flex h-8 items-center gap-1.5 rounded-lg border border-white/10 bg-sparkle-card px-2.5 text-[11px] font-medium text-sparkle-text-secondary transition-colors hover:border-white/20 hover:bg-white/[0.03] hover:text-sparkle-text',
                state.loading && 'animate-pulse'
            )}
            title={normalizedProjectPath || 'Git changes'}
        >
            <GitHubMark className="h-3.5 w-3.5 shrink-0 text-white/90" />
            <DiffStats
                additions={state.additions}
                deletions={state.deletions}
                compact
                loading={state.loading}
                preserveValuesWhileLoading
                showBar={false}
                className="gap-1.5"
            />
        </div>
    )
}
