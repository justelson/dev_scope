import { ArrowUpRight, Blocks, Code2, Rocket, Users } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { useSettings } from '@/lib/settings'

const LIGHT_FLICKER_STOPPED_KEY = 'devscope:home:light-flicker-stopped:v1'

export default function Home() {
    const [flickerStopped, setFlickerStopped] = useState<boolean>(() => {
        try {
            return localStorage.getItem(LIGHT_FLICKER_STOPPED_KEY) === '1'
        } catch {
            return false
        }
    })
    const { settings } = useSettings()
    const tasksFeaturePath = settings.tasksPageEnabled ? '/tasks' : '/assistant'

    const cards = [
        {
            title: 'Cross-Root Project Memory',
            description: 'Scan multiple roots, normalize project context, and jump straight into active codebases without hunting.',
            icon: Blocks,
            tone: 'from-cyan-400/15 via-cyan-400/0 to-transparent',
            accent: 'text-cyan-300',
            border: 'group-hover:border-cyan-400/50',
            glow: 'bg-cyan-400/20',
            path: '/settings/projects',
            novelty: 'Novel feature: multi-root indexing'
        },
        {
            title: 'Git Action Surface',
            description: 'Stage, discard, commit, push, and inspect history from one unified project detail flow.',
            icon: Code2,
            tone: 'from-emerald-400/15 via-emerald-400/0 to-transparent',
            accent: 'text-emerald-300',
            border: 'group-hover:border-emerald-400/50',
            glow: 'bg-emerald-400/20',
            path: '/projects',
            novelty: 'Novel feature: write + read git workflow'
        },
        {
            title: 'Session-Based Assistant',
            description: 'Persistent assistant sessions with streaming events, project-aware prompts, and workflow helpers.',
            icon: Users,
            tone: 'from-amber-300/15 via-amber-300/0 to-transparent',
            accent: 'text-amber-200',
            border: 'group-hover:border-amber-300/55',
            glow: 'bg-amber-300/20',
            path: '/assistant',
            novelty: 'Novel feature: durable thread lifecycle'
        },
        {
            title: 'Operational Task Loop',
            description: 'Move between focused tasks and execution context fast, keeping momentum inside the app shell.',
            icon: Rocket,
            tone: 'from-blue-400/15 via-blue-400/0 to-transparent',
            accent: 'text-blue-300',
            border: 'group-hover:border-blue-400/55',
            glow: 'bg-blue-400/20',
            path: tasksFeaturePath,
            novelty: settings.tasksPageEnabled
                ? 'Novel feature: dedicated tasks surface'
                : 'Novel feature: assistant-driven fallback'
        }
    ]

    const stopFlicker = () => {
        setFlickerStopped(true)
        try {
            localStorage.setItem(LIGHT_FLICKER_STOPPED_KEY, '1')
        } catch {
            // Ignore storage failures and keep in-memory behavior.
        }
    }

    return (
        <div
            className="relative -m-6 w-[calc(100%+3rem)] min-h-[calc(100vh-46px)] animate-fadeIn overflow-hidden"
            style={{
                backgroundImage: 'radial-gradient(circle at 1px 1px, color-mix(in srgb, var(--color-border-secondary), transparent 25%) 1px, transparent 0)',
                backgroundSize: '18px 18px'
            }}
        >
            <div className="pointer-events-none absolute left-[20%] top-10 h-56 w-56 rounded-full bg-[var(--accent-primary)]/10 blur-3xl" />
            <div className="pointer-events-none absolute bottom-6 right-[12%] h-56 w-56 rounded-full bg-cyan-500/10 blur-3xl" />

            <section className="relative flex min-h-[calc(100vh-46px)] flex-col gap-6 p-0">
                <header className="mx-8 mt-8 border-4 border-double border-sparkle-border-secondary/80 bg-sparkle-card/70 px-8 pb-7 pt-10 text-center shadow-[0_18px_45px_rgba(0,0,0,0.22)] backdrop-blur-sm">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sparkle-text-secondary">DevScope Air</p>
                    <h1 className="mt-5 text-4xl font-extrabold tracking-tight text-sparkle-text md:text-5xl xl:text-6xl">
                        Devs Don&apos;t Use{' '}
                        <span
                            onDoubleClick={stopFlicker}
                            className={cn(
                                'mx-1 inline-block cursor-pointer select-none font-black uppercase tracking-[0.08em] text-[var(--accent-primary)] transition-[text-shadow,color] duration-200 hover:[text-shadow:0_0_14px_var(--accent-primary)]',
                                !flickerStopped && 'animate-broken-light'
                            )}
                        >
                            Light
                        </span>{' '}
                        Mode
                    </h1>
                    <p className="mt-3 text-sm leading-relaxed text-sparkle-text-secondary">
                        We are serious about this.
                    </p>
                    <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
                        <span className="rounded-full border border-sparkle-border bg-sparkle-bg/70 px-3 py-1 text-[11px] font-medium text-sparkle-text-secondary">Developer-first</span>
                        <span className="rounded-full border border-sparkle-border bg-sparkle-bg/70 px-3 py-1 text-[11px] font-medium text-sparkle-text-secondary">Dark-native</span>
                        <span className="rounded-full border border-sparkle-border bg-sparkle-bg/70 px-3 py-1 text-[11px] font-medium text-sparkle-text-secondary">Fast context</span>
                    </div>
                </header>

                <div className="grid flex-1 grid-cols-1 gap-4 px-8 pb-8 md:grid-cols-2 xl:grid-cols-4">
                    {cards.map(({ title, description, icon: Icon, tone, accent, border, glow, path, novelty }) => (
                        <Link
                            key={title}
                            to={path}
                            className={cn(
                                'group relative flex h-full flex-col overflow-hidden rounded-xl border-2 border-double border-sparkle-border-secondary bg-sparkle-bg/70 p-5 transition-all duration-200 hover:-translate-y-1',
                                border
                            )}
                        >
                            <div
                                className={cn(
                                    'pointer-events-none absolute inset-x-0 top-0 h-24 origin-top bg-gradient-to-b opacity-80 transition-all duration-500 ease-out group-hover:h-48 group-hover:scale-[1.12] group-hover:opacity-100',
                                    tone
                                )}
                            />
                            <div
                                className={cn(
                                    'pointer-events-none absolute -top-20 left-1/2 h-44 w-44 -translate-x-1/2 rounded-full blur-2xl opacity-0 transition-all duration-500 ease-out group-hover:-top-10 group-hover:h-64 group-hover:w-64 group-hover:opacity-100',
                                    glow
                                )}
                            />
                            <div className="relative">
                                <div className={cn('mb-4 inline-flex h-10 w-10 items-center justify-center rounded-lg border border-sparkle-border-secondary bg-sparkle-accent', accent)}>
                                    <Icon size={18} />
                                </div>
                                <h2 className="text-base font-semibold text-sparkle-text">{title}</h2>
                                <p className="mt-2 text-sm leading-relaxed text-sparkle-text-secondary">{description}</p>
                                <div className="mt-4 border-t-2 border-double border-sparkle-border-secondary/75 pt-3">
                                    <p className="text-[11px] uppercase tracking-[0.14em] text-sparkle-text-muted">{novelty}</p>
                                    <p className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-[var(--accent-primary)]">
                                        Open feature
                                        <ArrowUpRight size={13} />
                                    </p>
                                </div>
                            </div>
                        </Link>
                    ))}
                </div>
            </section>
        </div>
    )
}
