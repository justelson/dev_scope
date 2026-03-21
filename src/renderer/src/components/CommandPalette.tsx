import { useEffect, useMemo, useRef, useState, ReactNode, useCallback, useDeferredValue } from 'react'
import { Search, X, Folder, File, ArrowRight } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useCommandPalette } from '@/lib/commandPalette'
import { useSettings } from '@/lib/settings'
import { cn, parseFileSearchQuery } from '@/lib/utils'
import { buildFileSearchIndex, searchFileIndex, type FileSearchIndex, type SearchTreeNode } from '@/lib/fileSearchIndex'
import { CommandPaletteIntro } from './CommandPaletteIntro'

type Domain = 'projects' | 'files' | 'mixed'

type Result = {
    id: string
    title: string
    subtitle?: string
    badge?: string
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
            window.setTimeout(() => inputRef.current?.focus(), 10)
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
        }, 200)
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
        const next = [normalized, ...recent.filter((item) => item !== normalized)].slice(0, 7)
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
            .catch((err) => console.error('scanProjects failed', err))
    }, [isOpen, paletteRoots, paletteRootsKey, projects.length])

    useEffect(() => {
        if (loadedProjectsRootsKeyRef.current === paletteRootsKey) return
        setProjects([])
    }, [paletteRootsKey])

    useEffect(() => {
        fileIndexCacheRef.current.clear()
        fileIndexLoadingRef.current.clear()
        setFileIndexVersion((prev) => prev + 1)
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
            setFileIndexVersion((prev) => prev + 1)
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
            const batchSize = 2
            for (let index = 0; index < projects.length; index += batchSize) {
                if (cancelled) break
                const batch = projects.slice(index, index + batchSize)
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

        const matches: { name: string; path: string; project: string }[] = []
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
                matches.push({
                    name: match.name,
                    path: match.path,
                    project: project.name
                })
                if (matches.length >= MAX_PER_GROUP) {
                    return matches
                }
            }
        }

        return matches
    }, [parsed.domain, parsedFileQuery, projects, fileIndexVersion])

    const results = useMemo<Result[]>(() => {
        const term = deferredSearchTerm.toLowerCase()

        const addProjects = () => projects
            .filter((project: any) => project.name.toLowerCase().includes(term))
            .slice(0, MAX_PER_GROUP)
            .map((project) => ({
                id: `proj-${project.path}`,
                title: project.name,
                subtitle: project.type,
                badge: '/ Project',
                icon: <Folder size={16} />,
                group: 'Projects',
                action: () => navigate(`/projects/${encodeURIComponent(project.path)}`)
            }))

        const addFiles = () => files.map((file) => ({
            id: `file-${file.path}`,
            title: file.name,
            subtitle: file.project,
            badge: '// File',
            icon: <File size={16} />,
            group: 'Files',
            action: () => navigate(`/folder-browse/${encodeURIComponent(getParentPath(file.path))}`)
        }))

        if (parsed.domain === 'projects') return addProjects()
        if (parsed.domain === 'files') return addFiles()
        return addProjects().slice(0, 6)
    }, [parsed.domain, deferredSearchTerm, projects, files, navigate])

    useEffect(() => {
        setSelectedIndex((current) => Math.min(current, Math.max(results.length - 1, 0)))
    }, [results.length])

    const selectResult = (result?: Result) => {
        if (!result) return
        result.action()
        pushRecent(query)
        handleClose()
    }

    useEffect(() => {
        if (!isOpen) return

        const handler = (event: KeyboardEvent) => {
            if (event.key === 'ArrowDown') {
                event.preventDefault()
                setSelectedIndex((current) => Math.min(current + 1, Math.max(results.length - 1, 0)))
                return
            }
            if (event.key === 'ArrowUp') {
                event.preventDefault()
                setSelectedIndex((current) => Math.max(current - 1, 0))
                return
            }
            if (event.key === 'Enter') {
                selectResult(results[selectedIndex])
                return
            }
            if (event.key === 'Escape') {
                handleClose()
            }
        }

        window.addEventListener('keydown', handler)
        return () => window.removeEventListener('keydown', handler)
    }, [isOpen, results, selectedIndex, query, recent, handleClose])

    if (!isOpen) return null

    return (
        <div
            className={cn(
                'fixed inset-0 z-[60] flex items-start justify-center bg-sparkle-bg/80 px-4 pt-[11vh] backdrop-blur-lg sm:px-6 sm:pt-[14vh]',
                isClosing ? 'animate-modal-backdrop-out' : 'animate-fadeIn'
            )}
            onClick={handleClose}
        >
            <div
                className={cn(
                    'relative mx-4 flex w-full max-w-[720px] flex-col overflow-hidden rounded-[24px] border border-white/10 bg-sparkle-card shadow-[0_24px_70px_-34px_rgba(0,0,0,0.42)]',
                    isClosing ? 'animate-modal-out' : 'animate-fadeIn'
                )}
                onClick={(event) => event.stopPropagation()}
            >
                <div className="relative bg-sparkle-card">
                    <Search
                        size={18}
                        className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[var(--accent-primary)]"
                    />
                    <input
                        ref={inputRef}
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                        placeholder="Search projects or type // for files"
                        className="h-[58px] w-full bg-transparent pl-12 pr-28 text-[16px] font-medium text-sparkle-text outline-none placeholder:text-white/34"
                    />
                    <div className="absolute right-3 top-1/2 flex -translate-y-1/2 items-center gap-2">
                        {query && (
                            <button
                                onClick={() => setQuery('')}
                                className="rounded-lg p-2 text-white/42 transition-colors hover:bg-white/[0.05] hover:text-white"
                                title="Clear search"
                            >
                                <X size={16} />
                            </button>
                        )}
                        <kbd className="hidden h-7 items-center justify-center rounded-md border border-white/10 bg-white/[0.04] px-2 text-[10px] font-semibold uppercase tracking-wide text-white/45 sm:inline-flex">
                            Esc
                        </kbd>
                    </div>
                </div>

                <div className="h-px w-full bg-gradient-to-r from-transparent via-white/6 to-transparent" />

                <div className="custom-scrollbar relative flex max-h-[46vh] flex-col overflow-y-auto bg-sparkle-card">
                    {query.trim() === '' && (
                        <CommandPaletteIntro recent={recent} onSelectQuery={setQuery} />
                    )}

                    {results.length > 0 && (
                        <div className="flex-1 p-2">
                            {results.map((result, index) => {
                                const isSelected = index === selectedIndex
                                const showGroupLabel = index === 0 || results[index - 1]?.group !== result.group

                                return (
                                    <div key={result.id} className="mb-1.5 last:mb-0">
                                        {showGroupLabel && (
                                            <div className="mb-1 flex items-center gap-3 px-2 pt-2">
                                                <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/34">
                                                    {result.group}
                                                </span>
                                            </div>
                                        )}

                                        <button
                                            onClick={() => selectResult(result)}
                                            onMouseEnter={() => setSelectedIndex(index)}
                                            className={cn(
                                                'group flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left outline-none transition-all',
                                                isSelected
                                                    ? 'border-white/12 bg-white/[0.04]'
                                                    : 'border-transparent bg-transparent hover:border-white/10 hover:bg-white/[0.03]'
                                            )}
                                        >
                                            <div className={cn(
                                                'flex h-10 w-10 items-center justify-center rounded-[10px] border transition-colors',
                                                isSelected
                                                    ? 'border-[var(--accent-primary)]/18 bg-[var(--accent-primary)]/10 text-[var(--accent-primary)]'
                                                    : 'border-white/8 bg-white/[0.035] text-white/56 group-hover:border-white/12 group-hover:text-white/80'
                                            )}>
                                                {result.icon || <Folder size={18} className="stroke-[1.6]" />}
                                            </div>

                                            <div className="min-w-0 flex-1">
                                                <div className="mb-1 flex items-center gap-2">
                                                    <span className={cn(
                                                        'truncate text-[14px] font-semibold transition-colors',
                                                        isSelected ? 'text-white' : 'text-sparkle-text'
                                                    )}>
                                                        {result.title}
                                                    </span>
                                                    {result.badge && (
                                                        <span className={cn(
                                                            'rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em]',
                                                            isSelected
                                                                ? 'border-[var(--accent-primary)]/18 bg-[var(--accent-primary)]/10 text-[var(--accent-primary)]'
                                                                : 'border-white/8 bg-white/[0.03] text-white/42'
                                                        )}>
                                                            {result.badge}
                                                        </span>
                                                    )}
                                                </div>
                                                {result.subtitle && (
                                                    <p className={cn(
                                                        'truncate text-[12px] transition-colors',
                                                        isSelected ? 'text-white/62' : 'text-white/42'
                                                    )}>
                                                        {result.subtitle}
                                                    </p>
                                                )}
                                            </div>

                                            <ArrowRight
                                                size={16}
                                                className={cn(
                                                    'transition-colors',
                                                    isSelected ? 'text-white/60' : 'text-white/20 group-hover:text-white/45'
                                                )}
                                            />
                                        </button>
                                    </div>
                                )
                            })}
                        </div>
                    )}

                    {results.length === 0 && query.trim() !== '' && !loadingFiles && (
                        <div className="flex flex-col items-center justify-center p-12 text-center">
                            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04]">
                                <Search size={24} className="stroke-[1.5] text-white/40" />
                            </div>
                            <div className="mb-1 text-base font-semibold text-sparkle-text">No results found</div>
                            <div className="max-w-[280px] text-[13px] text-white/46">
                                No match for "{query}". Try a broader term, or switch modes with `/` and `//`.
                            </div>
                        </div>
                    )}

                    {loadingFiles && (
                        <div className="flex flex-col items-center justify-center p-12 text-center">
                            <div className="mb-4 h-10 w-10 animate-spin rounded-full border-2 border-white/12 border-t-[var(--accent-primary)]" />
                            <div className="text-sm font-semibold text-sparkle-text">Scanning folders...</div>
                        </div>
                    )}
                </div>

                <div className="h-px w-full bg-gradient-to-r from-transparent via-white/6 to-transparent" />

                <div className="flex items-center justify-between gap-4 bg-sparkle-card px-4 py-3 text-[11px] text-white/40">
                    <div className="flex items-center gap-3">
                        <span className="flex items-center gap-1.5">
                            <kbd className="rounded-md border border-white/10 bg-white/[0.04] px-1.5 py-0.5 font-mono">Up</kbd>
                            <kbd className="rounded-md border border-white/10 bg-white/[0.04] px-1.5 py-0.5 font-mono">Down</kbd>
                            Navigate
                        </span>
                        <span className="flex items-center gap-1.5">
                            <kbd className="rounded-md border border-white/10 bg-white/[0.04] px-1.5 py-0.5 font-mono">Enter</kbd>
                            Open
                        </span>
                    </div>
                    <span className="hidden sm:inline text-white/32">Use `/` for projects and `//` for files</span>
                </div>
            </div>
        </div>
    )
}

export default CommandPalette
