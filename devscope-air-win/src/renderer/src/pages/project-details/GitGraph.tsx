import { useMemo } from 'react'
import { Calendar, User } from 'lucide-react'
import type { GitCommit } from './types'
import { DiffStats } from './DiffStats'

const BRANCH_COLORS = [
    '#22c55e',
    '#3b82f6',
    '#f97316',
    '#a855f7',
    '#06b6d4',
    '#ec4899'
]

export function GitGraph({
    commits,
    onCommitClick
}: {
    commits: GitCommit[]
    onCommitClick?: (commit: GitCommit) => void
}) {
    const lanes = useMemo(() => {
        const laneMap = new Map<string, number>()
        const activeLanes: (string | null)[] = []

        commits.forEach((commit) => {
            let assignedLane = -1
            for (let i = 0; i < activeLanes.length; i++) {
                if (activeLanes[i] === commit.hash) {
                    assignedLane = i
                    break
                }
            }

            if (assignedLane === -1) {
                assignedLane = 0
                if (activeLanes[0] !== null && activeLanes[0] !== commit.hash) {
                    const emptyLane = activeLanes.findIndex((lane) => lane === null)
                    assignedLane = emptyLane === -1 ? activeLanes.length : emptyLane
                }
            }

            laneMap.set(commit.hash, assignedLane)

            if (commit.parents.length > 0) {
                activeLanes[assignedLane] = commit.parents[0]
                for (let i = 1; i < commit.parents.length; i++) {
                    const parentHash = commit.parents[i]
                    if (!laneMap.has(parentHash)) {
                        const emptyLane = activeLanes.findIndex((lane, idx) => lane === null && idx !== assignedLane)
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
    const laneWidth = 24
    const nodeSize = 10
    const rowHeight = 64

    return (
        <div className="relative overflow-x-auto">
            <svg
                className="absolute top-0 left-0 pointer-events-none"
                width={maxLanes * laneWidth + 20}
                height={commits.length * rowHeight}
                style={{ minWidth: maxLanes * laneWidth + 20 }}
            >
                {commits.map((commit, idx) => {
                    const lane = lanes.get(commit.hash) || 0
                    const x = lane * laneWidth + laneWidth / 2 + 8
                    const y = idx * rowHeight + rowHeight / 2
                    const color = BRANCH_COLORS[lane % BRANCH_COLORS.length]

                    return (
                        <g key={`lines-${commit.hash}`}>
                            {idx < commits.length - 1 && (
                                <line
                                    x1={x}
                                    y1={y + nodeSize / 2}
                                    x2={x}
                                    y2={(idx + 1) * rowHeight + rowHeight / 2 - nodeSize / 2}
                                    stroke={color}
                                    strokeWidth={2}
                                    opacity={0.6}
                                />
                            )}

                            {commit.parents.slice(1).map((parentHash) => {
                                const parentIdx = commits.findIndex((candidate) => candidate.hash === parentHash)
                                if (parentIdx === -1) return null

                                const parentLane = lanes.get(parentHash) || 0
                                const parentX = parentLane * laneWidth + laneWidth / 2 + 8
                                const parentY = parentIdx * rowHeight + rowHeight / 2
                                const parentColor = BRANCH_COLORS[parentLane % BRANCH_COLORS.length]
                                const midY = (y + parentY) / 2

                                return (
                                    <path
                                        key={`merge-${commit.hash}-${parentHash}`}
                                        d={`M ${parentX} ${parentY + nodeSize / 2} C ${parentX} ${midY}, ${x} ${midY}, ${x} ${y - nodeSize / 2}`}
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

                {commits.map((commit, idx) => {
                    const lane = lanes.get(commit.hash) || 0
                    const x = lane * laneWidth + laneWidth / 2 + 8
                    const y = idx * rowHeight + rowHeight / 2
                    const color = BRANCH_COLORS[lane % BRANCH_COLORS.length]
                    const isMerge = commit.parents.length > 1

                    return (
                        <g key={`node-${commit.hash}`}>
                            <circle
                                cx={x}
                                cy={y}
                                r={isMerge ? nodeSize / 2 + 2 : nodeSize / 2}
                                fill="#09090b"
                                stroke={color}
                                strokeWidth={isMerge ? 3 : 2}
                            />
                            {isMerge && <circle cx={x} cy={y} r={3} fill={color} />}
                        </g>
                    )
                })}
            </svg>

            <div style={{ marginLeft: maxLanes * laneWidth + 20 }}>
                {commits.map((commit) => {
                    const isMerge = commit.parents.length > 1
                    const lane = lanes.get(commit.hash) || 0
                    const color = BRANCH_COLORS[lane % BRANCH_COLORS.length]

                    return (
                        <div
                            key={commit.hash}
                            className="flex items-center group cursor-pointer hover:bg-white/5 rounded-lg transition-colors -ml-2 pl-2"
                            style={{ height: rowHeight }}
                            onClick={() => onCommitClick?.(commit)}
                        >
                            <div className="flex-1 min-w-0 pr-4 flex items-center justify-between gap-3">
                                <div className="min-w-0">
                                    <div className="flex items-center gap-2 mb-0.5">
                                        <span className="text-sm font-medium text-white truncate">{commit.message}</span>
                                        {isMerge && (
                                            <span className="text-[10px] px-1.5 py-0.5 rounded font-medium shrink-0" style={{ backgroundColor: `${color}20`, color }}>
                                                Merge
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-3 text-xs text-white/40">
                                        <span className="font-mono bg-white/5 px-1.5 py-0.5 rounded text-white/50">{commit.shortHash}</span>
                                        <span className="flex items-center gap-1">
                                            <User size={10} /> {commit.author}
                                        </span>
                                        <span className="flex items-center gap-1">
                                            <Calendar size={10} /> {new Date(commit.date).toLocaleDateString()}
                                        </span>
                                    </div>
                                </div>
                                <div className="shrink-0">
                                    <DiffStats additions={commit.additions} deletions={commit.deletions} compact />
                                </div>
                            </div>
                        </div>
                    )
                })}
            </div>
        </div>
    )
}
