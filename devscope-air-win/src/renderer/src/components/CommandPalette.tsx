import { useEffect, useMemo, useRef, useState, ReactNode, useCallback, useDeferredValue } from 'react'
import { Search, Slash, X, Folder, File, ArrowRight } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useCommandPalette } from '@/lib/commandPalette'
import { useSettings } from '@/lib/settings'
import { cn, parseFileSearchQuery } from '@/lib/utils'
import { buildFileSearchIndex, searchFileIndex, type FileSearchIndex, type SearchTreeNode } from '@/lib/fileSearchIndex'

type Domain = 'projects' | 'files' | 'mixed'

type Result = {
    id: string
    title: string
    subtitle?: string
    badge?: string
    color?: string
    icon?: ReactNode
    action: () => void
    group: string
}

function getParentPath(filePath: string): string {
    const normalized = String(filePath || '').trim()
    const sep = Math.max(normalized.lastIndexOf('/'), normalized.lastIndexOf('\\'))
    if (sep <= 0) return normalized
    if (sep === 2 && /^[A-Za-z]:[\\/]/.test(normalized)) return normalized.slice(0, 3)
    return normalized.slice(0, sep)
}

// Quick chips component removed, functionality integrated directly into main markup

const MAX_PER_GROUP = 8
const RECENT_KEY = 'devscope:palette:recent'

export function CommandPalette() {
    const { isOpen, close } = useCommandPalette()
    const { settings } = useSettings()
    const navigate = useNavigate()
    const inputRef = useRef<HTMLInputElement>(null)
    const fileIndexCacheRef = useRef<Map<string, FileSearchIndex>>(new Map())
    const fileIndexLoadingRef = useRef<Set<string>>(new Set())
    const loadedProjectsRootsKeyRef = useRef<string>('')

    const [query, setQuery] = useState('')
    const [projects, setProjects] = useState<any[]>([])
    const [loadingFiles, setLoadingFiles] = useState(false)
    const [fileIndexVersion, setFileIndexVersion] = useState(0)
    const [selectedIndex, setSelectedIndex] = useState(0)
    const [recent, setRecent] = useState<string[]>([])
    const [isClosing, setIsClosing] = useState(false)
    const closeTimerRef = useRef<number | null>(null)
    const paletteRoots = useMemo(() => {
        return Array.from(new Set([
            settings.projectsFolder,
            ...(settings.additionalFolders || [])
        ].filter((root): root is string => typeof root === 'string' && root.trim().length > 0)))
    }, [settings.projectsFolder, settings.additionalFolders])
    const paletteRootsKey = useMemo(() => paletteRoots.join('||'), [paletteRoots])

    useEffect(() => {
        if (isOpen) {
            setIsClosing(false)
            setTimeout(() => inputRef.current?.focus(), 10)
        } else {
            setQuery('')
            setSelectedIndex(0)
            if (closeTimerRef.current) {
                window.clearTimeout(closeTimerRef.current)
                closeTimerRef.current = null
            }
        }
    }, [isOpen])

    const handleClose = useCallback(() => {
        if (isClosing) return
        setIsClosing(true)
        if (closeTimerRef.current) {
            window.clearTimeout(closeTimerRef.current)
        }
        closeTimerRef.current = window.setTimeout(() => {
            closeTimerRef.current = null
            close()
        }, 200) // Match animation duration
    }, [close, isClosing])

    useEffect(() => {
        return () => {
            if (closeTimerRef.current) {
                window.clearTimeout(closeTimerRef.current)
                closeTimerRef.current = null
            }
        }
    }, [])

    useEffect(() => {
        try {
            const stored = localStorage.getItem(RECENT_KEY)
            if (stored) setRecent(JSON.parse(stored))
        } catch (err) {
            console.error('load recents failed', err)
        }
    }, [])

    const pushRecent = (value: string) => {
        if (!value) return
        const normalized = value.trim()
        const next = [normalized, ...recent.filter(r => r !== normalized)].slice(0, 7)
        setRecent(next)
        try {
            localStorage.setItem(RECENT_KEY, JSON.stringify(next))
        } catch (err) {
            console.error('save recents failed', err)
        }
    }

    useEffect(() => {
        if (!isOpen || paletteRoots.length === 0) return
        if (projects.length > 0 && loadedProjectsRootsKeyRef.current === paletteRootsKey) return

        Promise.all(paletteRoots.map((root) => window.devscope.scanProjects(root)))
            .then((results) => {
                const merged: any[] = []
                const seen = new Set<string>()
                for (const result of results) {
                    if (!result?.success || !Array.isArray(result.projects)) continue
                    for (const project of result.projects) {
                        if (seen.has(project.path)) continue
                        seen.add(project.path)
                        merged.push(project)
                    }
                }
                loadedProjectsRootsKeyRef.current = paletteRootsKey
                setProjects(merged)
            })
            .catch(err => console.error('scanProjects failed', err))
    }, [isOpen, paletteRoots, paletteRootsKey, projects.length])

    useEffect(() => {
        if (loadedProjectsRootsKeyRef.current === paletteRootsKey) return
        setProjects([])
    }, [paletteRootsKey])

    useEffect(() => {
        fileIndexCacheRef.current.clear()
        fileIndexLoadingRef.current.clear()
        setFileIndexVersion(prev => prev + 1)
    }, [paletteRoots])

    const parsed = useMemo(() => {
        const trimmed = query.trim()
        if (trimmed.startsWith('//')) return { domain: 'files' as Domain, term: trimmed.slice(2).trim() }
        if (trimmed.startsWith('/')) return { domain: 'projects' as Domain, term: trimmed.slice(1).trim() }
        return { domain: 'mixed' as Domain, term: trimmed }
    }, [query])
    const deferredSearchTerm = useDeferredValue(parsed.term)
    const parsedFileQuery = useMemo(() => parseFileSearchQuery(deferredSearchTerm), [deferredSearchTerm])

    const ensureFileIndex = useCallback(async (project: any) => {
        if (!project?.path) return
        if (fileIndexCacheRef.current.has(project.path)) return
        if (fileIndexLoadingRef.current.has(project.path)) return

        fileIndexLoadingRef.current.add(project.path)
        try {
            const treeRes = await window.devscope.getFileTree(project.path, { maxDepth: -1, showHidden: false })
            const tree = (treeRes as { tree?: unknown } | null | undefined)?.tree
            if (treeRes?.success === false || !Array.isArray(tree)) return
            fileIndexCacheRef.current.set(project.path, buildFileSearchIndex(tree as SearchTreeNode[]))
            setFileIndexVersion(prev => prev + 1)
        } catch (err) {
            console.error('file index load failed', err)
        } finally {
            fileIndexLoadingRef.current.delete(project.path)
        }
    }, [])

    useEffect(() => {
        if (!isOpen || projects.length === 0) return
        let cancelled = false

        const warmup = async () => {
            const BATCH_SIZE = 2
            for (let i = 0; i < projects.length; i += BATCH_SIZE) {
                if (cancelled) break
                const batch = projects.slice(i, i + BATCH_SIZE)
                await Promise.all(batch.map((project) => ensureFileIndex(project)))
            }
            if (!cancelled) {
                setLoadingFiles(false)
            }
        }

        void warmup()
        return () => {
            cancelled = true
        }
    }, [isOpen, projects, ensureFileIndex])

    useEffect(() => {
        if (parsed.domain !== 'files') {
            setLoadingFiles(false)
            return
        }

        const targetProjects = projects.slice(0, 8)
        const missing = targetProjects.filter((project) => !fileIndexCacheRef.current.has(project.path))
        if (missing.length === 0) {
            setLoadingFiles(false)
            return
        }

        let cancelled = false
        setLoadingFiles(true)
        const loadMissing = async () => {
            await Promise.all(missing.map((project) => ensureFileIndex(project)))
            if (!cancelled) {
                setLoadingFiles(false)
            }
        }
        void loadMissing()
        return () => {
            cancelled = true
        }
    }, [parsed.domain, projects, ensureFileIndex, fileIndexVersion])

    const files = useMemo(() => {
        if (parsed.domain !== 'files') return []
        if (!parsedFileQuery.term && !parsedFileQuery.hasExtensionFilter) return []

        const results: { name: string; path: string; project: string }[] = []
        const seenPaths = new Set<string>()
        const targetProjects = projects.slice(0, 8)

        for (const project of targetProjects) {
            const index = fileIndexCacheRef.current.get(project.path)
            if (!index) continue

            const searchResult = searchFileIndex(index, parsedFileQuery, {
                showHidden: false,
                includeDirectories: false,
                limit: MAX_PER_GROUP
            })

            for (const match of searchResult.matches) {
                if (match.type !== 'file' || seenPaths.has(match.path)) continue
                seenPaths.add(match.path)
                results.push({
                    name: match.name,
                    path: match.path,
                    project: project.name
                })
                if (results.length >= MAX_PER_GROUP) {
                    return results
                }
            }
        }

        return results
    }, [parsed.domain, parsedFileQuery, projects, fileIndexVersion])

    const results = useMemo<Result[]>(() => {
        const term = deferredSearchTerm.toLowerCase()

        const addProjects = () => projects
            .filter((p: any) => p.name.toLowerCase().includes(term))
            .slice(0, MAX_PER_GROUP)
            .map(p => ({
                id: `proj-${p.path}`,
                title: p.name,
                subtitle: p.type,
                badge: '/ Project',
                color: '#38bdf8',
                icon: <Folder size={16} />,
                group: 'Projects',
                action: () => navigate(`/projects/${encodeURIComponent(p.path)}`)
            }))

        const addFiles = () => files
            .map(f => ({
                id: `file-${f.path}`,
                title: f.name,
                subtitle: f.project,
                badge: '// File',
                color: '#fbbf24',
                icon: <File size={16} />,
                group: 'Files',
                action: () => navigate(`/folder-browse/${encodeURIComponent(getParentPath(f.path))}`)
            }))

        if (parsed.domain === 'projects') return addProjects()
        if (parsed.domain === 'files') return addFiles()

        return addProjects().slice(0, 6)
    }, [parsed.domain, deferredSearchTerm, projects, files, navigate])

    useEffect(() => {
        if (!isOpen) return
        const handler = (e: KeyboardEvent) => {
            if (e.key === 'ArrowDown') {
                e.preventDefault()
                setSelectedIndex(i => Math.min(i + 1, Math.max(results.length - 1, 0)))
            } else if (e.key === 'ArrowUp') {
                e.preventDefault()
                setSelectedIndex(i => Math.max(i - 1, 0))
            } else if (e.key === 'Enter') {
                if (results[selectedIndex]) {
                    results[selectedIndex].action()
                    pushRecent(query)
                    handleClose()
                }
            } else if (e.key === 'Escape') {
                handleClose()
            }
        }
        window.addEventListener('keydown', handler)
        return () => window.removeEventListener('keydown', handler)
    }, [isOpen, results, selectedIndex, query])

    if (!isOpen) return null

    return (
        <div
            className={cn(
                "fixed inset-0 z-[60] bg-sparkle-bg/80 backdrop-blur-xl flex items-start justify-center pt-[10vh] sm:pt-[15vh] px-4",
                isClosing ? "animate-modal-backdrop-out" : "animate-fadeIn"
            )}
            onClick={handleClose}
        >
            <div
                className={cn(
                    "flex flex-col w-full max-w-2xl bg-sparkle-card border border-sparkle-border rounded-[14px] overflow-hidden shadow-2xl mx-4",
                    isClosing ? "animate-modal-out" : "animate-fadeIn"
                )}
                onClick={e => e.stopPropagation()}
            >
                {/* Search Header */}
                <div className="relative flex items-center gap-3 px-4 py-3.5 sm:px-5">
                    {/* Subtle top glow */}
                    <div className="absolute top-0 inset-x-0 h-[80px] bg-gradient-to-b from-[var(--accent-primary)]/10 to-transparent pointer-events-none opacity-50 hidden dark:block" />

                    <Search size={18} className="text-[var(--accent-primary)]/80 stroke-[2] ml-1" />
                    <input
                        ref={inputRef}
                        value={query}
                        onChange={e => setQuery(e.target.value)}
                        placeholder="What are you looking for?"
                        className="flex-1 bg-transparent text-sparkle-text placeholder:text-sparkle-text-muted/60 text-[16px] xl:text-[18px] font-medium outline-none ml-2"
                    />
                    <div className="flex items-center gap-2">
                        {query && (
                            <button
                                onClick={() => setQuery('')}
                                className="p-1.5 rounded-full hover:bg-sparkle-bg text-sparkle-text-muted hover:text-sparkle-text transition-colors"
                            >
                                <X size={16} />
                            </button>
                        )}
                        <kbd className="hidden sm:inline-flex items-center justify-center h-6 px-1.5 border border-sparkle-border/60 rounded bg-sparkle-bg text-[10px] font-medium text-sparkle-text-secondary shadow-sm">Esc</kbd>
                    </div>
                </div>

                <div className="h-[1px] w-full bg-gradient-to-r from-transparent via-sparkle-border/40 to-transparent" />

                {/* Main Content Area */}
                <div className="relative max-h-[55vh] overflow-y-auto custom-scrollbar flex flex-col bg-sparkle-bg/30">
                    {query.trim() === '' && (
                        <div className="p-4 sm:p-5">
                            <div className="mb-6">
                                <div className="text-[10px] font-mono font-bold uppercase tracking-widest text-[var(--accent-primary)] mb-3 flex items-center gap-2 px-1">
                                    <Slash size={12} className="opacity-70" /> Quick Search
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <button
                                        onClick={() => setQuery('/ ')}
                                        className="group text-left p-3 sm:p-4 rounded-xl border border-sparkle-border hover:border-[var(--accent-primary)]/40 bg-sparkle-bg hover:bg-sparkle-card-hover transition-all flex items-start gap-3 shadow-sm"
                                    >
                                        <div className="p-2 rounded-lg bg-sparkle-card-hover border border-sparkle-border group-hover:bg-[var(--accent-primary)]/10 group-hover:text-[var(--accent-primary)] group-hover:border-[var(--accent-primary)]/20 transition-all text-sparkle-text-secondary">
                                            <Folder size={18} className="stroke-[1.5]" />
                                        </div>
                                        <div>
                                            <div className="font-semibold text-[14px] text-sparkle-text mb-0.5">Projects</div>
                                            <div className="text-[11px] text-sparkle-text-muted">Type <span className="font-mono text-sparkle-text-secondary bg-sparkle-card border border-sparkle-border px-1 py-0.5 rounded">/</span></div>
                                        </div>
                                    </button>
                                    <button
                                        onClick={() => setQuery('// ')}
                                        className="group text-left p-3 sm:p-4 rounded-xl border border-sparkle-border hover:border-[var(--accent-primary)]/40 bg-sparkle-bg hover:bg-sparkle-card-hover transition-all flex items-start gap-3 shadow-sm"
                                    >
                                        <div className="p-2 rounded-lg bg-sparkle-card-hover border border-sparkle-border group-hover:bg-[var(--accent-primary)]/10 group-hover:text-[var(--accent-primary)] group-hover:border-[var(--accent-primary)]/20 transition-all text-sparkle-text-secondary">
                                            <File size={18} className="stroke-[1.5]" />
                                        </div>
                                        <div>
                                            <div className="font-semibold text-[14px] text-sparkle-text mb-0.5">Files</div>
                                            <div className="text-[11px] text-sparkle-text-muted">Type <span className="font-mono text-sparkle-text-secondary bg-sparkle-card border border-sparkle-border px-1 py-0.5 rounded">//</span></div>
                                        </div>
                                    </button>
                                </div>
                            </div>

                            {recent.length > 0 && (
                                <div>
                                    <div className="text-[10px] font-mono font-bold uppercase tracking-widest text-[var(--accent-primary)] mb-2 flex items-center gap-2 px-1">History</div>
                                    <div className="flex flex-col gap-1">
                                        {recent.map((r, i) => (
                                            <button
                                                key={r}
                                                onClick={() => setQuery(r + ' ')}
                                                className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-left text-[13px] text-sparkle-text-secondary hover:bg-sparkle-card-hover border border-transparent hover:border-sparkle-border/40 hover:text-sparkle-text group transition-colors"
                                            >
                                                <div className="flex items-center gap-2.5">
                                                    <div className="w-1.5 h-1.5 rounded-full bg-sparkle-text-muted group-hover:bg-[var(--accent-primary)] transition-all" />
                                                    <span className="font-medium">{r}</span>
                                                </div>
                                                <ArrowRight size={14} className="opacity-0 group-hover:opacity-100 text-[var(--accent-primary)] transition-opacity" />
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {results.length > 0 && (
                        <div className="p-2 sm:p-3 flex-1 pb-3">
                            {results.map((r, idx) => {
                                const isSelected = idx === selectedIndex;
                                return (
                                    <button
                                        key={r.id}
                                        onClick={() => { r.action(); pushRecent(query); handleClose() }}
                                        className={cn(
                                            'group w-full flex items-center gap-3 px-3 py-2.5 sm:px-4 sm:py-3 text-left transition-all outline-none rounded-xl mb-0.5',
                                            isSelected
                                                ? 'bg-sparkle-card border-l-[3px] border-l-[var(--accent-primary)] bg-[var(--accent-primary)]/5 shadow-sm'
                                                : 'hover:bg-sparkle-bg border-l-[3px] border-l-transparent border border-transparent hover:border-sparkle-border/40'
                                        )}
                                    >
                                        <div className={cn(
                                            "flex items-center justify-center transition-colors",
                                            isSelected ? "text-[var(--accent-primary)]" : "text-sparkle-text-secondary group-hover:text-sparkle-text"
                                        )}>
                                            {r.icon || <Folder size={18} className="stroke-[1.5]" />}
                                        </div>

                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-0.5">
                                                <span className={cn(
                                                    "text-[14px] font-medium truncate transition-colors",
                                                    isSelected ? "text-[var(--accent-primary)]" : "text-sparkle-text group-hover:text-[var(--accent-primary)]"
                                                )}>{r.title}</span>

                                                {r.badge && (
                                                    <span className={cn(
                                                        "text-[9px] px-1.5 py-0.5 rounded-md font-bold uppercase tracking-widest leading-none drop-shadow-sm border",
                                                        isSelected
                                                            ? "bg-[var(--accent-primary)]/10 text-[var(--accent-primary)] border-[var(--accent-primary)]/20"
                                                            : "bg-sparkle-bg text-sparkle-text-muted border-sparkle-border"
                                                    )}>{r.badge}</span>
                                                )}
                                            </div>
                                            {r.subtitle && (
                                                <p className={cn(
                                                    "text-[12px] truncate transition-colors",
                                                    isSelected ? "text-[var(--accent-primary)]/70" : "text-sparkle-text-muted"
                                                )}>{r.subtitle}</p>
                                            )}
                                        </div>

                                        <div className={cn(
                                            "flex items-center transition-opacity",
                                            isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                                        )}>
                                            <ArrowRight size={16} className={isSelected ? "text-[var(--accent-primary)]/80" : "text-sparkle-text-muted/50"} />
                                        </div>
                                    </button>
                                )
                            })}
                        </div>
                    )}

                    {results.length === 0 && query.trim() !== '' && !loadingFiles && (
                        <div className="p-16 text-center flex flex-col items-center justify-center opacity-60">
                            <div className="p-4 rounded-3xl bg-sparkle-card border border-sparkle-border/40 shadow-sm mb-5">
                                <Search size={32} className="text-sparkle-text-muted stroke-[1.5]" />
                            </div>
                            <div className="text-sparkle-text text-xl font-medium mb-1">No results found</div>
                            <div className="text-sparkle-text-muted text-[14px] max-w-[280px]">We couldn't find anything matching "{query}". Try adjusting your search.</div>
                        </div>
                    )}

                    {loadingFiles && (
                        <div className="p-16 text-center flex flex-col items-center justify-center opacity-60">
                            <div className="w-10 h-10 rounded-full border-2 border-[var(--accent-primary)]/20 border-t-[var(--accent-primary)] animate-spin mb-5" />
                            <div className="text-sparkle-text font-medium text-lg">Scanning folders...</div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="h-10 border-t border-sparkle-border border-x-0 border-b-0 bg-sparkle-bg/50 px-4 sm:px-5 flex items-center justify-between">
                    <div className="text-[10px] font-medium text-sparkle-text-muted flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent-primary)] animate-pulse shadow-[0_0_8px_var(--accent-primary)]" />
                        DevScope Command Flow
                    </div>
                    <div className="flex items-center gap-4 text-[10px] text-sparkle-text-muted font-medium">
                        <span className="flex items-center gap-1.5"><kbd className="font-mono bg-sparkle-card px-1.5 py-0.5 rounded border border-sparkle-border/60 shadow-sm">↑</kbd> <kbd className="font-mono bg-sparkle-card px-1.5 py-0.5 rounded border border-sparkle-border/60 shadow-sm">↓</kbd> Navigate</span>
                        <span className="flex items-center gap-1.5"><kbd className="font-mono bg-sparkle-card px-1.5 py-0.5 rounded border border-sparkle-border/60 shadow-sm">↵</kbd> Select</span>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default CommandPalette
