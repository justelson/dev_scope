/**
 * DevScope - AI Settings Page
 * Configure AI features like Groq API key for commit message generation
 */

import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Sparkles, Eye, EyeOff, ExternalLink, Check, AlertCircle } from 'lucide-react'
import { useSettings } from '@/lib/settings'

export default function AISettings() {
    const { settings, updateSettings } = useSettings()
    const [showKey, setShowKey] = useState(false)
    const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle')
    const [testError, setTestError] = useState('')

    const handleKeyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        updateSettings({ groqApiKey: e.target.value })
        setTestStatus('idle')
    }

    const handleTestConnection = async () => {
        if (!settings.groqApiKey) return

        setTestStatus('testing')
        setTestError('')

        try {
            const result = await window.devscope.testGroqConnection(settings.groqApiKey)
            if (result.success) {
                setTestStatus('success')
            } else {
                setTestStatus('error')
                setTestError(result.error || 'Connection failed')
            }
        } catch (err: any) {
            setTestStatus('error')
            setTestError(err.message || 'Connection failed')
        }
    }

    const handleClearKey = () => {
        updateSettings({ groqApiKey: '' })
        setTestStatus('idle')
    }

    return (
        <div className="animate-fadeIn">
            {/* Header */}
            <div className="mb-8">
                <Link
                    to="/settings"
                    className="inline-flex items-center gap-2 text-sparkle-text-secondary hover:text-sparkle-text transition-colors mb-4"
                >
                    <ArrowLeft size={16} />
                    <span className="text-sm">Back to Settings</span>
                </Link>
                <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 rounded-lg bg-violet-500/10">
                        <Sparkles className="text-violet-400" size={24} />
                    </div>
                    <h1 className="text-2xl font-semibold text-sparkle-text">AI Features</h1>
                </div>
                <p className="text-sparkle-text-secondary">
                    Configure AI-powered features like commit message generation
                </p>
            </div>

            {/* Settings Content */}
            <div className="space-y-6">
                {/* Groq API Key */}
                <div className="bg-sparkle-card rounded-xl border border-sparkle-border p-6">
                    <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-medium text-sparkle-text">Groq API Key</h3>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-violet-500/10 text-violet-400 border border-violet-500/20">
                            Free Tier Available
                        </span>
                    </div>
                    <p className="text-sm text-sparkle-text-secondary mb-4">
                        Enter your Groq API key to enable AI-powered commit message generation. Groq provides fast inference with a generous free tier.
                    </p>

                    <div className="flex items-center gap-3 mb-4">
                        <div className="flex-1 relative">
                            <input
                                type={showKey ? 'text' : 'password'}
                                value={settings.groqApiKey}
                                onChange={handleKeyChange}
                                placeholder="gsk_xxxxxxxxxxxx..."
                                className="w-full bg-sparkle-bg border border-sparkle-border rounded-lg px-4 py-3 pr-12 text-sm text-sparkle-text placeholder:text-sparkle-text-muted focus:outline-none focus:border-[var(--accent-primary)]/50 font-mono"
                            />
                            <button
                                onClick={() => setShowKey(!showKey)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-sparkle-text-muted hover:text-sparkle-text transition-colors"
                                title={showKey ? 'Hide key' : 'Show key'}
                            >
                                {showKey ? <EyeOff size={18} /> : <Eye size={18} />}
                            </button>
                        </div>

                        <button
                            onClick={handleTestConnection}
                            disabled={!settings.groqApiKey || testStatus === 'testing'}
                            className="px-4 py-3 bg-[var(--accent-primary)] text-white rounded-lg hover:bg-[var(--accent-primary)]/80 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium flex items-center gap-2"
                        >
                            {testStatus === 'testing' ? (
                                <>
                                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    Testing...
                                </>
                            ) : testStatus === 'success' ? (
                                <>
                                    <Check size={16} />
                                    Connected
                                </>
                            ) : (
                                'Test Connection'
                            )}
                        </button>
                    </div>

                    {/* Status Messages */}
                    {testStatus === 'success' && (
                        <div className="flex items-center gap-2 text-sm text-green-400 bg-green-500/10 border border-green-500/20 rounded-lg px-3 py-2">
                            <Check size={16} />
                            API key is valid and connection successful!
                        </div>
                    )}
                    {testStatus === 'error' && (
                        <div className="flex items-center gap-2 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                            <AlertCircle size={16} />
                            {testError}
                        </div>
                    )}

                    {/* Get API Key Link */}
                    <div className="mt-4 pt-4 border-t border-sparkle-border">
                        <a
                            href="https://console.groq.com/keys"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 text-sm text-[var(--accent-primary)] hover:underline"
                        >
                            <ExternalLink size={14} />
                            Get a free Groq API key
                        </a>
                    </div>
                </div>

                {/* How it works */}
                <div className="bg-violet-500/5 border border-violet-500/20 rounded-xl p-4">
                    <h4 className="font-medium text-violet-300 mb-2">How AI Commit Messages Work</h4>
                    <ul className="text-sm text-violet-300/80 space-y-1.5">
                        <li>• In the Git tab of any project, click the ✨ button next to the commit message</li>
                        <li>• DevScope analyzes your staged changes and generates a descriptive commit message</li>
                        <li>• Uses Llama 3.1 via Groq for fast, intelligent suggestions</li>
                        <li>• Your code diffs are sent securely to Groq's API</li>
                    </ul>
                </div>

                {/* Clear Key */}
                {settings.groqApiKey && (
                    <button
                        onClick={handleClearKey}
                        className="text-sm text-red-400 hover:text-red-300 transition-colors"
                    >
                        Clear API Key
                    </button>
                )}
            </div>
        </div>
    )
}
