import { useEffect, useMemo, useRef, useState } from 'react'
import { Terminal, Filter, Trash2, Download, Search, Check, Copy, ChevronDown, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

export type EventLogItem = {
    type: string
    timestamp: number
    payload: Record<string, unknown>
}

interface AssistantEventConsoleProps {
    events: EventLogItem[]
    onClear: () => void
    onExport: () => void
}

export function AssistantEventConsole({ events, onClear, onExport }: AssistantEventConsoleProps) {
    const [filterType, setFilterType] = useState<string>('all')
    const [searchQuery, setSearchQuery] = useState('')
    const [viewMode, setViewMode] = useState<'formatted' | 'raw'>('formatted')
    const [expandedEvents, setExpandedEvents] = useState<Set<string>>(new Set())
    const [copiedKey, setCopiedKey] = useState<string | null>(null)
    const [animatingKeys, setAnimatingKeys] = useState<Set<string>>(new Set())
    const knownKeysRef = useRef<Set<string>>(new Set())

    const getEventKey = (event: EventLogItem): string => {
        let payloadKey = ''
        try {
            payloadKey = JSON.stringify(event.payload)
        } catch {
            payloadKey = ''
        }
        return `${event.timestamp}:${event.type}:${payloadKey}`
    }

    useEffect(() => {
        const incomingKeys = events.map(getEventKey)
        const incomingSet = new Set(incomingKeys)

        if (knownKeysRef.current.size === 0) {
            knownKeysRef.current = incomingSet
            return
        }

        const newKeys = incomingKeys.filter((key) => !knownKeysRef.current.has(key))
        knownKeysRef.current = incomingSet

        if (newKeys.length === 0) return

        setAnimatingKeys((prev) => {
            const next = new Set(prev)
            for (const key of newKeys) next.add(key)
            return next
        })

        const timer = window.setTimeout(() => {
            setAnimatingKeys((prev) => {
                const next = new Set(prev)
                for (const key of newKeys) next.delete(key)
                return next
            })
        }, 420)

        return () => window.clearTimeout(timer)
    }, [events])

    // Extract unique event types for the filter dropdown
    const availableTypes = useMemo(() => {
        const types = new Set(events.map(e => e.type))
        return Array.from(types).sort()
    }, [events])

    // Filter and search logic
    const filteredEvents = useMemo(() => {
        let result = events

        if (filterType !== 'all') {
            result = result.filter(e => e.type === filterType)
        }

        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase()
            result = result.filter(e => {
                // Search across stringified payload
                try {
                    const str = JSON.stringify(e.payload).toLowerCase()
                    if (str.includes(query)) return true
                    if (e.type.toLowerCase().includes(query)) return true
                    return false
                } catch {
                    return false
                }
            })
        }

        return result
    }, [events, filterType, searchQuery])

    const toggleExpand = (eventKey: string) => {
        setExpandedEvents(prev => {
            const next = new Set(prev)
            if (next.has(eventKey)) next.delete(eventKey)
            else next.add(eventKey)
            return next
        })
    }

    const handleCopy = async (payload: Record<string, unknown>, eventKey: string) => {
        try {
            await window.devscope.copyToClipboard(JSON.stringify(payload, null, 2))
            setCopiedKey(eventKey)
            window.setTimeout(() => setCopiedKey(null), 2000)
        } catch (e) {
            console.error('Failed to copy', e)
        }
    }

    return (
        <div className="flex flex-col h-full bg-sparkle-bg border-l border-sparkle-border text-sparkle-text">
            {/* Header Toolbar */}
            <div className="flex-none p-3 border-b border-sparkle-border bg-sparkle-card flex flex-col gap-3">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sparkle-text-secondary">
                        <Terminal size={16} />
                        <h2 className="text-sm font-semibold text-sparkle-text">Events Console</h2>
                        <span className="text-xs bg-sparkle-bg px-2 py-0.5 rounded-full border border-sparkle-border">
                            {filteredEvents.length} / {events.length}
                        </span>
                    </div>
                    <div className="flex items-center gap-1">
                        <button
                            onClick={onExport}
                            className="p-1.5 rounded hover:bg-sparkle-bg text-sparkle-text-secondary hover:text-sparkle-text transition-colors"
                            title="Export to file"
                        >
                            <Download size={14} />
                        </button>
                        <button
                            onClick={onClear}
                            className="p-1.5 rounded hover:bg-sparkle-bg text-amber-500/80 hover:text-amber-400 transition-colors"
                            title="Clear events"
                        >
                            <Trash2 size={14} />
                        </button>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                        <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-sparkle-text-muted" />
                        <input
                            type="text"
                            placeholder="Search payload..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-sparkle-bg border border-sparkle-border rounded-lg pl-8 pr-3 py-1.5 text-xs text-sparkle-text focus:outline-none focus:border-[var(--accent-primary)]/50"
                        />
                    </div>

                    <div className="relative">
                        <div className="flex items-center gap-1 bg-sparkle-bg border border-sparkle-border rounded-lg pl-2 pr-1 py-1">
                            <Filter size={12} className="text-sparkle-text-muted" />
                            <select
                                value={filterType}
                                onChange={(e) => setFilterType(e.target.value)}
                                className="bg-transparent text-xs text-sparkle-text focus:outline-none w-28 text-ellipsis"
                            >
                                <option value="all">All Events</option>
                                {availableTypes.map(t => (
                                    <option key={t} value={t}>{t}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="flex items-center bg-sparkle-bg border border-sparkle-border rounded-lg p-1">
                        <button
                            onClick={() => setViewMode('formatted')}
                            className={cn(
                                "px-2 py-1 text-[10px] font-medium tracking-wide uppercase rounded",
                                viewMode === 'formatted' ? "bg-sparkle-card text-sparkle-text shadow-sm" : "text-sparkle-text-muted hover:text-sparkle-text-secondary"
                            )}
                        >
                            Pretty
                        </button>
                        <button
                            onClick={() => setViewMode('raw')}
                            className={cn(
                                "px-2 py-1 text-[10px] font-medium tracking-wide uppercase rounded",
                                viewMode === 'raw' ? "bg-sparkle-card text-sparkle-text shadow-sm" : "text-sparkle-text-muted hover:text-sparkle-text-secondary"
                            )}
                        >
                            Raw
                        </button>
                    </div>
                </div>
            </div>

            {/* Event List */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
                {filteredEvents.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-sparkle-text-muted space-y-2">
                        <Terminal size={24} className="opacity-20" />
                        <p className="text-xs">No events match current filters</p>
                    </div>
                ) : (
                    filteredEvents.map((event) => {
                        const eventKey = getEventKey(event)
                        const isExpanded = expandedEvents.has(eventKey)
                        const isCopied = copiedKey === eventKey
                        const isAnimating = animatingKeys.has(eventKey)
                        const timeString = new Date(event.timestamp).toLocaleTimeString(undefined, {
                            hour12: false,
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit',
                            fractionalSecondDigits: 3
                        })

                        return (
                            <div
                                key={eventKey}
                                className={cn(
                                    "border border-sparkle-border rounded-lg bg-sparkle-card overflow-hidden text-xs",
                                    isAnimating && "animate-fadeIn"
                                )}
                            >
                                <div
                                    className="flex items-center justify-between p-2 hover:bg-sparkle-bg cursor-pointer select-none"
                                    onClick={() => toggleExpand(eventKey)}
                                >
                                    <div className="flex items-center gap-2 min-w-0">
                                        <div className="text-sparkle-text-muted group-hover:text-sparkle-text shrink-0">
                                            {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                        </div>
                                        <div className="font-mono text-[10px] text-sparkle-text-muted shrink-0 w-[85px]">
                                            {timeString}
                                        </div>
                                        <div className="font-semibold text-[var(--accent-primary)] truncate">
                                            {event.type}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0">
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation()
                                                void handleCopy(event.payload, eventKey)
                                            }}
                                            className="p-1 rounded hover:bg-sparkle-card-hover text-sparkle-text-muted hover:text-sparkle-text transition-colors"
                                        >
                                            {isCopied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                                        </button>
                                    </div>
                                </div>

                                {isExpanded && (
                                    <div className="p-2 border-t border-sparkle-border bg-[#0d1117] overflow-x-auto">
                                        <pre className="text-[10px] font-mono leading-relaxed text-sparkle-text-secondary m-0">
                                            {viewMode === 'raw'
                                                ? JSON.stringify(event.payload)
                                                : JSON.stringify(event.payload, null, 2)}
                                        </pre>
                                    </div>
                                )}
                            </div>
                        )
                    })
                )}
            </div>
        </div>
    )
}
