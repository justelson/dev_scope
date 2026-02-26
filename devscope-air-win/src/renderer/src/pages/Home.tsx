import { Blocks, Code2, Rocket, Users } from 'lucide-react'

export default function Home() {
    const cards = [
        {
            title: 'What DevScope Air Is',
            description: 'A focused desktop workspace for active codebases, project context, and faster engineering decisions.',
            icon: Blocks
        },
        {
            title: 'Built For Developers',
            description: 'Designed for people who ship: less context-switching, cleaner project visibility, and practical tooling.',
            icon: Code2
        },
        {
            title: 'Team Direction',
            description: 'The app is evolving around dev-first workflows, predictable behavior, and simple, durable UX.',
            icon: Users
        },
        {
            title: 'Current Idea',
            description: 'Keep Home lightweight: quick orientation, short status context, and clear next actions.',
            icon: Rocket
        }
    ]

    return (
        <div
            className="-m-6 w-[calc(100%+3rem)] min-h-[calc(100vh-46px)] animate-fadeIn"
            style={{
                backgroundImage: 'radial-gradient(circle at 1px 1px, var(--color-border-secondary) 1px, transparent 0)',
                backgroundSize: '18px 18px'
            }}
        >
            <section className="flex min-h-[calc(100vh-46px)] flex-col gap-6 p-0">
                <header className="border-b-4 border-double border-sparkle-border-secondary/80 px-8 pb-6 pt-10 text-center">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sparkle-text-secondary">DevScope Air</p>
                    <h1 className="mt-5 text-4xl font-extrabold tracking-tight text-sparkle-text md:text-5xl">
                        Devs Don&apos;t Use Light Mode
                    </h1>
                    <p className="mt-3 text-sm leading-relaxed text-sparkle-text-secondary">
                        We are serious about this.
                    </p>
                </header>

                <div className="grid flex-1 grid-cols-1 gap-4 px-8 pb-8 md:grid-cols-2 xl:grid-cols-4">
                    {cards.map(({ title, description, icon: Icon }) => (
                        <article
                            key={title}
                            className="flex h-full flex-col rounded-xl border-2 border-double border-sparkle-border-secondary bg-sparkle-bg/70 p-5 transition-colors duration-200 hover:border-[var(--accent-primary)]/50"
                        >
                            <div className="mb-4 inline-flex h-9 w-9 items-center justify-center rounded-lg bg-sparkle-accent text-[var(--accent-primary)]">
                                <Icon size={18} />
                            </div>
                            <h2 className="text-base font-semibold text-sparkle-text">{title}</h2>
                            <p className="mt-2 text-sm leading-relaxed text-sparkle-text-secondary">{description}</p>
                        </article>
                    ))}
                </div>
            </section>
        </div>
    )
}
