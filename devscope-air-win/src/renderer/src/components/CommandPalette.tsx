import { useEffect, useMemo, useRef, useState, ReactNode, useCallback, useDeferredValue } from 'react'
import { Search, Slash, X, Folder, File, ArrowRight } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useCommandPalette } from '@/lib/commandPalette'
import { useSettings } from '@/lib/settings'
import { cn, parseFileSearchQuery } from '@/lib/utils'
import { buildFileSearchIndex, searchFileIndex, type FileSearchIndex } from '@/lib/fileSearchIndex'

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

function QuickChips({ onSelect }: { onSelect: (v: string) => void }) {
    const chips = [
        { label: 'Projects', value: '/', icon: <Slash size={12} /> },
        { label: 'Files', value: '//', icon: <Slash size={12} /> }
    ]
    return (
        <div className="flex items-center gap-2 flex-wrap">
            {chips.map(c => (
                <button
                    key={c.label}
                    onClick={() => onSelect(c.value)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sparkle-accent/40 border border-sparkle-border-secondary text-sparkle-text-secondary hover:text-sparkle-text hover:bg-sparkle-accent/60 text-sm"
                >
                    {c.icon}
                    <span>{c.label}</span>
                </button>
            ))}
        </div>
    )
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

    const [query, setQuery] = useState('')
    const [projects, setProjects] = useState<any[]>([])
    const [loadingFiles, setLoadingFiles] = useState(false)
    const [fileIndexVersion, setFileIndexVersion] = useState(0)
    const [selectedIndex, setSelectedIndex] = useState(0)
    const [recent, setRecent] = useState<string[]>([])
    const [isClosing, setIsClosing] = useState(false)
    const paletteRoots = useMemo(() => {
        return Array.from(new Set([
            settings.projectsFolder,
            ...(settings.additionalFolders || [])
        ].filter((root): root is string => typeof root === 'string' && root.trim().length > 0)))
    }, [settings.projectsFolder, settings.additionalFolders])

    useEffect(() => {
        if (isOpen) {
            setIsClosing(false)
            setTimeout(() => inputRef.current?.focus(), 10)
        } else {
            setQuery('')
            setSelectedIndex(0)
        }
    }, [isOpen])

    const handleClose = () => {
        setIsClosing(true)
        setTimeout(() => {
            close()
        }, 200) // Match animation duration
    }

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
                setProjects(merged)
            })
            .catch(err => console.error('scanProjects failed', err))
    }, [isOpen, paletteRoots])

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
            if (treeRes?.success === false || !treeRes?.tree) return
            fileIndexCacheRef.current.set(project.path, buildFileSearchIndex(treeRes.tree))
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
                action: () => navigate(`/folder-browse/${encodeURIComponent(f.path)}`)
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
                "fixed inset-0 z-[60] bg-black/60 backdrop-blur-md flex items-start justify-center pt-24",
                isClosing ? "animate-modal-backdrop-out" : "animate-modal-backdrop"
            )}
            onClick={handleClose}
        >
            <div
                className={cn(
                    "w-full max-w-3xl mx-4 bg-sparkle-card/95 border border-sparkle-border-secondary rounded-2xl shadow-2xl overflow-hidden",
                    isClosing ? "animate-modal-out" : "animate-modal-in"
                )}
                onClick={e => e.stopPropagation()}
            >
                <div className="flex items-center gap-3 px-4 py-3 border-b border-sparkle-border-secondary bg-sparkle-accent/40">
                    <div className="p-2 rounded-xl bg-sparkle-accent/40 text-sparkle-text-secondary">
                        <Search size={16} />
                    </div>
                    <input
                        ref={inputRef}
                        value={query}
                        onChange={e => setQuery(e.target.value)}
                        placeholder="Search: / projects, // files"
                        className="flex-1 bg-transparent text-sparkle-text placeholder:text-sparkle-text-muted text-base outline-none"
                    />
                    <div className="flex items-center gap-2 text-[11px] text-sparkle-text-muted">
                        <Kbd>Ctrl</Kbd><span className="text-sparkle-text-muted">+</span><Kbd>K</Kbd>
                        <button onClick={handleClose} className="p-2 rounded-lg hover:bg-sparkle-accent/60 text-sparkle-text-secondary">
                            <X size={16} />
                        </button>
                    </div>
                </div>

                <div className="max-h-[420px] overflow-auto custom-scrollbar divide-y divide-sparkle-border-secondary">
                    {query.trim() === '' && (
                        <div className="p-4 space-y-3">
                            <QuickChips onSelect={(text) => setQuery(text + ' ')} />
                            {recent.length > 0 && (
                                <div>
                                    <div className="text-[11px] uppercase tracking-widest text-sparkle-text-muted mb-2">Recent</div>
                                    <div className="flex flex-wrap gap-2">
                                        {recent.map((r) => (
                                            <button
                                                key={r}
                                                onClick={() => setQuery(r + ' ')}
                                                className="px-3 py-1.5 rounded-lg bg-sparkle-accent/40 border border-sparkle-border-secondary text-sparkle-text-secondary hover:text-sparkle-text hover:bg-sparkle-accent/60 text-sm"
                                            >
                                                {r}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {results.length === 0 && query.trim() !== '' && !loadingFiles && (
                        <div className="p-6 text-center text-sparkle-text-muted text-sm">No matches yet. Try / or // prefixes.</div>
                    )}
                    {loadingFiles && (
                        <div className="p-3 text-center text-sparkle-text-secondary text-sm">Searching files...</div>
                    )}
                    {results.map((r, idx) => (
                        <button
                            key={r.id}
                            onClick={() => { r.action(); pushRecent(query); handleClose() }}
                            className={cn(
                                'w-full flex items-center gap-3 px-4 py-3 text-left transition-colors',
                                idx === selectedIndex ? 'bg-sparkle-accent/60' : 'hover:bg-sparkle-accent/40'
                            )}
                        >
                            <div className="p-2 rounded-lg bg-sparkle-accent/50 text-sparkle-text-secondary" style={{ border: `1px solid ${r.color || '#ffffff22'}` }}>
                                {r.icon || <Folder size={16} />}
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                    <span className="text-sparkle-text font-semibold truncate">{r.title}</span>
                                    {r.badge && (
                                        <span className="text-[10px] px-1.5 py-0.5 rounded-full border border-sparkle-border-secondary text-sparkle-text-muted">{r.badge}</span>
                                    )}
                                </div>
                                {r.subtitle && <p className="text-xs text-sparkle-text-muted truncate">{r.subtitle}</p>}
                            </div>
                            <ArrowRight size={14} className="text-sparkle-text-muted" />
                        </button>
                    ))}
                </div>
            </div>
        </div>
    )
}

function Kbd({ children }: { children: React.ReactNode }) {
    return <span className="px-2 py-1 rounded-md border border-sparkle-border-secondary bg-sparkle-accent/50 text-sparkle-text-secondary">{children}</span>
}

export default CommandPalette
