import { useEffect, useMemo, useRef, useState, useCallback, useDeferredValue } from 'react'
import { Search, X, Folder, File } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useCommandPalette } from '@/lib/commandPalette'
import { primeProjectDetailsCache } from '@/lib/projectViewCache'
import { useSettings } from '@/lib/settings'
import { cn, parseFileSearchQuery } from '@/lib/utils'
import { CommandPaletteIntro } from './CommandPaletteIntro'
import { CommandPaletteResults } from './CommandPaletteResults'
import type { CommandPaletteDomain as Domain, CommandPaletteResult as Result } from './command-palette-types'

function getParentPath(filePath: string): string {
    const normalized = String(filePath || '').trim()
    const sep = Math.max(normalized.lastIndexOf('/'), normalized.lastIndexOf('\\'))
    if (sep <= 0) return normalized
    if (sep === 2 && /^[A-Za-z]:[\\/]/.test(normalized)) return normalized.slice(0, 3)
    return normalized.slice(0, sep)
}

function resolveProjectName(filePath: string): string {
    const parentPath = getParentPath(filePath)
    const segments = parentPath.split(/[\\/]/).filter(Boolean)
    return segments[segments.length - 1] || parentPath || 'Folder'
}

const MAX_PER_GROUP = 8
const RECENT_KEY = 'devscope:palette:recent'

export function CommandPalette() {
    const { isOpen, close } = useCommandPalette()
    const { settings } = useSettings()
    const navigate = useNavigate()
    const inputRef = useRef<HTMLInputElement>(null)
    const loadedProjectsRootsKeyRef = useRef<string>('')

    const [query, setQuery] = useState('')
    const [projects, setProjects] = useState<any[]>([])
    const [files, setFiles] = useState<Array<{ name: string; path: string; project: string }>>([])
    const [loadingFiles, setLoadingFiles] = useState(false)
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
        setFiles([])
        setLoadingFiles(false)
    }, [paletteRoots])

    const parsed = useMemo(() => {
        const trimmed = query.trim()
        if (trimmed.startsWith('//')) return { domain: 'files' as Domain, term: trimmed.slice(2).trim() }
        if (trimmed.startsWith('/')) return { domain: 'projects' as Domain, term: trimmed.slice(1).trim() }
        return { domain: 'mixed' as Domain, term: trimmed }
    }, [query])

    const deferredSearchTerm = useDeferredValue(parsed.term)
    const parsedFileQuery = useMemo(() => parseFileSearchQuery(deferredSearchTerm), [deferredSearchTerm])

    useEffect(() => {
        if (!isOpen || parsed.domain !== 'files') {
            setFiles([])
            setLoadingFiles(false)
            return
        }
        if (!parsedFileQuery.term && !parsedFileQuery.hasExtensionFilter) {
            setFiles([])
            setLoadingFiles(false)
            return
        }

        let cancelled = false
        setLoadingFiles(true)

        void window.devscope.searchIndexedPaths({
            roots: paletteRoots,
            term: parsedFileQuery.term,
            extensionFilters: parsedFileQuery.extension ? [parsedFileQuery.extension] : [],
            limit: MAX_PER_GROUP,
            includeFiles: true,
            includeDirectories: false,
            showHidden: false
        }).then((result) => {
            if (cancelled) return
            if (!result?.success) {
                setFiles([])
                return
            }
            const nextFiles = (result.entries || []).map((entry) => ({
                name: entry.name,
                path: entry.path,
                project: projects.find((project) => entry.path.startsWith(project.path))?.name || resolveProjectName(entry.path)
            }))
            setFiles(nextFiles)
        }).catch((err) => {
            if (!cancelled) {
                console.error('indexed file search failed', err)
                setFiles([])
            }
        }).finally(() => {
            if (!cancelled) {
                setLoadingFiles(false)
            }
        })

        return () => {
            cancelled = true
        }
    }, [isOpen, paletteRoots, parsed.domain, parsedFileQuery.extension, parsedFileQuery.hasExtensionFilter, parsedFileQuery.term, projects])

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
                action: () => {
                    primeProjectDetailsCache(project)
                    navigate(`/projects/${encodeURIComponent(project.path)}`)
                }
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

                    <CommandPaletteResults
                        query={query}
                        results={results}
                        selectedIndex={selectedIndex}
                        setSelectedIndex={setSelectedIndex}
                        selectResult={selectResult}
                        loadingFiles={loadingFiles}
                    />
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
