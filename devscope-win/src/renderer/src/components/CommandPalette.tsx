import { useEffect, useMemo, useRef, useState, ReactNode } from 'react'
import { Search, Hash, DollarSign, Slash, X, Sparkles, Folder, File, Wrench, Terminal, ArrowRight } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { TOOL_REGISTRY } from "../../../shared/tool-registry"
import { useCommandPalette } from '@/lib/commandPalette'
import { useSettings } from '@/lib/settings'
import { cn } from '@/lib/utils'

type Domain = 'devtools' | 'agents' | 'projects' | 'files' | 'mixed'

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
        { label: 'DevTools', value: '#', icon: <Hash size={12} /> },
        { label: 'AI Agents', value: '$', icon: <DollarSign size={12} /> },
        { label: 'Projects', value: '/', icon: <Slash size={12} /> },
        { label: 'Files', value: '//', icon: <Slash size={12} /> },
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

const DEBOUNCE_MS = 160
const MAX_PER_GROUP = 8
const RECENT_KEY = 'devscope:palette:recent'

export function CommandPalette() {
    const { isOpen, close } = useCommandPalette()
    const { settings } = useSettings()
    const navigate = useNavigate()
    const inputRef = useRef<HTMLInputElement>(null)

    const [query, setQuery] = useState('')
    const [agents, setAgents] = useState<any[]>([])
    const [projects, setProjects] = useState<any[]>([])
    const [files, setFiles] = useState<{ name: string; path: string; project: string }[]>([])
    const [loadingFiles, setLoadingFiles] = useState(false)
    const [selectedIndex, setSelectedIndex] = useState(0)
    const [recent, setRecent] = useState<string[]>([])

    // autofocus when open
    useEffect(() => {
        if (isOpen) {
            setTimeout(() => inputRef.current?.focus(), 10)
        } else {
            setQuery('')
            setSelectedIndex(0)
        }
    }, [isOpen])

    // load recents on mount
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

    // fetch agents once
    useEffect(() => {
        if (!isOpen) return
        window.devscope.getAIAgents().then(res => {
            setAgents(res?.agents || [])
        }).catch(err => console.error('getAIAgents failed', err))
    }, [isOpen])

    // fetch projects when palette opens
    useEffect(() => {
        if (!isOpen || !settings.projectsFolder) return
        window.devscope.scanProjects(settings.projectsFolder).then(res => {
            if (res?.success) setProjects(res.projects || [])
        }).catch(err => console.error('scanProjects failed', err))
    }, [isOpen, settings.projectsFolder])

    const parsed = useMemo(() => {
        const trimmed = query.trim()
        if (trimmed.startsWith('//')) return { domain: 'files' as Domain, term: trimmed.slice(2).trim() }
        if (trimmed.startsWith('/')) return { domain: 'projects' as Domain, term: trimmed.slice(1).trim() }
        if (trimmed.startsWith('#')) return { domain: 'devtools' as Domain, term: trimmed.slice(1).trim() }
        if (trimmed.startsWith('$')) return { domain: 'agents' as Domain, term: trimmed.slice(1).trim() }
        return { domain: 'mixed' as Domain, term: trimmed }
    }, [query])

    // files fetch, debounced on term
    useEffect(() => {
        if (parsed.domain !== 'files') {
            setFiles([])
            return
        }
        if (!settings.projectsFolder || !parsed.term) {
            setFiles([])
            return
        }
        const handle = setTimeout(async () => {
            try {
                setLoadingFiles(true)
                const results: { name: string; path: string; project: string }[] = []
                // limit to first 3 projects for speed
                const targetProjects = projects.slice(0, 3)
                for (const project of targetProjects) {
                    const treeRes = await window.devscope.getFileTree(project.path, { maxDepth: 2, showHidden: false })
                    const walk = (nodes: any[]) => {
                        nodes.forEach(n => {
                            if (n.type === 'file' && n.name.toLowerCase().includes(parsed.term.toLowerCase())) {
                                results.push({ name: n.name, path: n.path, project: project.name })
                            }
                            if (n.children) walk(n.children)
                        })
                    }
                    if (treeRes?.success !== false && treeRes?.tree) {
                        walk(treeRes.tree)
                    }
                }
                setFiles(results.slice(0, MAX_PER_GROUP))
            } catch (err) {
                console.error('file search failed', err)
            } finally {
                setLoadingFiles(false)
            }
        }, DEBOUNCE_MS)
        return () => clearTimeout(handle)
    }, [parsed.domain, parsed.term, projects, settings.projectsFolder])

    const results = useMemo<Result[]>(() => {
        const term = parsed.term.toLowerCase()
        const addDevtools = () => TOOL_REGISTRY
            .filter(t => t.displayName.toLowerCase().includes(term) || t.id.toLowerCase().includes(term) || t.usedFor.some(u => u.toLowerCase().includes(term)))
            .slice(0, MAX_PER_GROUP)
            .map(t => ({
                id: `tool-${t.id}`,
                title: t.displayName,
                subtitle: t.description,
                badge: '# DevTool',
                color: t.themeColor,
                icon: <Wrench size={16} />,
                group: 'DevTools',
                action: () => navigate(`/devtools/${t.id}`)
            }))

        const addAgents = () => agents
            .filter((a: any) => a.displayName?.toLowerCase().includes(term) || a.tool?.toLowerCase().includes(term))
            .slice(0, MAX_PER_GROUP)
            .map(a => ({
                id: `agent-${a.tool}`,
                title: a.displayName || a.tool,
                subtitle: a.description,
                badge: '$ Agent',
                color: '#a855f7',
                icon: <Sparkles size={16} />,
                group: 'AI Agents',
                action: () => navigate(`/devtools/${a.tool}`)
            }))

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

        if (parsed.domain === 'devtools') return addDevtools()
        if (parsed.domain === 'agents') return addAgents()
        if (parsed.domain === 'projects') return addProjects()
        if (parsed.domain === 'files') return addFiles()

        // mixed: sample from multiple
        return [
            ...addDevtools().slice(0, 4),
            ...addAgents().slice(0, 3),
            ...addProjects().slice(0, 3)
        ]
    }, [parsed.domain, parsed.term, agents, projects, files, navigate])

    // keyboard navigation
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
                    close()
                }
            }
        }
        window.addEventListener('keydown', handler)
        return () => window.removeEventListener('keydown', handler)
    }, [isOpen, results, selectedIndex, close, query])

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-md flex items-start justify-center pt-24" onClick={close}>
            <div
                className="w-full max-w-3xl mx-4 bg-sparkle-card/90 border border-sparkle-border-secondary rounded-2xl shadow-2xl overflow-hidden"
                onClick={e => e.stopPropagation()}
                style={{ animation: 'scaleIn 0.14s ease-out' }}
            >
                <div className="flex items-center gap-3 px-4 py-3 border-b border-sparkle-border-secondary bg-sparkle-accent/40">
                    <div className="p-2 rounded-xl bg-sparkle-accent/40 text-sparkle-text-secondary">
                        <Search size={16} />
                    </div>
                    <input
                        ref={inputRef}
                        value={query}
                        onChange={e => setQuery(e.target.value)}
                        placeholder="Search — # devtools, $ agents, / projects, // files"
                        className="flex-1 bg-transparent text-sparkle-text placeholder:text-sparkle-text-muted text-base outline-none"
                    />
                    <div className="flex items-center gap-2 text-[11px] text-sparkle-text-muted">
                        <Kbd>Ctrl</Kbd><span className="text-sparkle-text-muted">+</span><Kbd>K</Kbd>
                        <button onClick={close} className="p-2 rounded-lg hover:bg-sparkle-accent/60 text-sparkle-text-secondary">
                            <X size={16} />
                        </button>
                    </div>
                </div>

                <div className="max-h-[420px] overflow-auto custom-scrollbar divide-y divide-sparkle-border-secondary">
                    {/* Empty / Quick area */}
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
                        <div className="p-6 text-center text-sparkle-text-muted text-sm">No matches yet. Try a prefix like #, $, /, //.</div>
                    )}
                    {loadingFiles && (
                        <div className="p-3 text-center text-sparkle-text-secondary text-sm">Searching files…</div>
                    )}
                    {results.map((r, idx) => (
                        <button
                            key={r.id}
                            onClick={() => { r.action(); pushRecent(query); close() }}
                            className={cn(
                                "w-full flex items-center gap-3 px-4 py-3 text-left transition-colors",
                                idx === selectedIndex ? "bg-sparkle-accent/60" : "hover:bg-sparkle-accent/40"
                            )}
                        >
                            <div className="p-2 rounded-lg bg-sparkle-accent/50 text-sparkle-text-secondary" style={{ border: `1px solid ${r.color || '#ffffff22'}` }}>
                                {r.icon || <Terminal size={16} />}
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

function PrefixLegend() {
    const items = [
        { icon: <Hash size={14} />, label: '# DevTools' },
        { icon: <DollarSign size={14} />, label: '$ AI Agents' },
        { icon: <Slash size={14} />, label: '/ Projects' },
        { icon: <Slash size={14} />, label: '// Files' },
    ]
    return (
        <div className="px-4 py-2 flex items-center gap-2 bg-sparkle-accent/40 border-b border-sparkle-border-secondary text-[11px] text-sparkle-text-muted">
            {items.map(item => (
                <span key={item.label} className="flex items-center gap-1 px-2 py-1 rounded-lg bg-sparkle-accent/50 border border-sparkle-border-secondary text-sparkle-text-secondary">
                    {item.icon}
                    <span>{item.label}</span>
                </span>
            ))}
        </div>
    )
}

export default CommandPalette
