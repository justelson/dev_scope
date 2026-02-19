/**
 * DevScope - About Page
 */

import { Link } from 'react-router-dom'
import { ArrowLeft, Info, Github, Heart, ExternalLink } from 'lucide-react'
import { DevScopeLogoASCII } from '@/components/ui/DevScopeLogo'

export default function AboutSettings() {
    return (
        <div className="animate-fadeIn">
            {/* Header */}
            <div className="mb-6">
                <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-emerald-500/10">
                            <Info className="text-emerald-400" size={24} />
                        </div>
                        <div>
                            <h1 className="text-xl font-semibold text-sparkle-text">About DevScope</h1>
                            <p className="text-sm text-sparkle-text-secondary">Version and credits</p>
                        </div>
                    </div>
                    <Link
                        to="/settings"
                        className="inline-flex items-center gap-2 px-4 py-2 text-sm text-sparkle-text hover:text-[var(--accent-primary)] bg-sparkle-card hover:bg-sparkle-card-hover border border-sparkle-border rounded-lg transition-all shrink-0"
                    >
                        <ArrowLeft size={16} />
                        Back to Settings
                    </Link>
                </div>
            </div>

            <div className="space-y-6">
                {/* ASCII Logo & Version */}
                <div className="bg-sparkle-card rounded-xl border border-sparkle-border p-8 overflow-hidden">
                    <div className="flex flex-col items-center">
                        {/* ASCII Art Logo */}
                        <div className="mb-6 overflow-x-auto max-w-full">
                            <DevScopeLogoASCII />
                        </div>
                        
                        <p className="text-sparkle-text-secondary mb-4 text-center">Developer Machine Status System</p>
                        
                        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[var(--accent-primary)]/10 text-[var(--accent-primary)] text-sm font-medium">
                            Version 1.0.0 AIR
                        </div>
                        
                        <p className="text-xs text-sparkle-text-muted mt-4">by justelson</p>
                    </div>
                </div>

                {/* Info Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <InfoCard label="Platform" value="Windows" />
                    <InfoCard label="Framework" value="Electron + React" />
                    <InfoCard label="Design System" value="Sparkle" />
                    <InfoCard label="License" value="MIT" />
                </div>

                {/* Author */}
                <div className="bg-sparkle-card rounded-xl border border-sparkle-border p-5">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                            <Heart size={20} className="text-white" />
                        </div>
                        <div>
                            <p className="text-sm text-sparkle-text-secondary">Created by</p>
                            <p className="font-semibold text-sparkle-text">justelson</p>
                        </div>
                    </div>
                </div>

                {/* Links */}
                <div className="bg-sparkle-card rounded-xl border border-sparkle-border p-5">
                    <h3 className="font-semibold text-sparkle-text mb-4">Links</h3>
                    <div className="space-y-2">
                        <LinkRow 
                            icon={<Github size={18} />}
                            label="Source Code"
                            href="https://github.com/justelson/devscope"
                        />
                        <LinkRow 
                            icon={<ExternalLink size={18} />}
                            label="Report an Issue"
                            href="https://github.com/justelson/devscope/issues"
                        />
                    </div>
                </div>

                {/* Tech Stack */}
                <div className="bg-sparkle-card rounded-xl border border-sparkle-border p-5">
                    <h3 className="font-semibold text-sparkle-text mb-4">Built With</h3>
                    <div className="flex flex-wrap gap-2">
                        {['Electron', 'React', 'TypeScript', 'Tailwind CSS', 'Vite', 'Lucide Icons'].map((tech) => (
                            <span 
                                key={tech}
                                className="px-3 py-1 rounded-full bg-sparkle-accent text-sm text-sparkle-text-secondary"
                            >
                                {tech}
                            </span>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    )
}

function InfoCard({ label, value }: { label: string; value: string }) {
    return (
        <div className="bg-sparkle-card rounded-xl border border-sparkle-border p-4">
            <p className="text-xs text-sparkle-text-muted uppercase tracking-wide mb-1">{label}</p>
            <p className="font-semibold text-sparkle-text">{value}</p>
        </div>
    )
}

function LinkRow({ icon, label, href }: { icon: React.ReactNode; label: string; href: string }) {
    return (
        <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 p-3 rounded-lg hover:bg-sparkle-accent transition-colors group"
        >
            <span className="text-sparkle-text-secondary group-hover:text-[var(--accent-primary)] transition-colors">
                {icon}
            </span>
            <span className="text-sm text-sparkle-text group-hover:text-[var(--accent-primary)] transition-colors">
                {label}
            </span>
            <ExternalLink size={14} className="ml-auto text-sparkle-text-muted" />
        </a>
    )
}


