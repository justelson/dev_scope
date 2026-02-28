import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
    ArrowLeft,
    CheckCircle2,
    Cloud,
    KeyRound,
    Lock,
    RefreshCw,
    Server,
    Shield,
    Smartphone,
    Trash2,
    WifiOff
} from 'lucide-react'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { useSettings, type RemoteAccessMode } from '@/lib/settings'
import { cn } from '@/lib/utils'

type ValidationState = {
    status: 'idle' | 'loading' | 'success' | 'error'
    message: string
    fingerprint?: string
}

type RelayPairingState = {
    pairingId: string
    oneTimeToken: string
    confirmationCode: string
    qrPayload: string
    expiresAt: number
} | null

type RelayConnectedDevice = {
    id: string
    name?: string
    label?: string
    platform?: 'ios' | 'android' | 'web' | 'desktop' | 'unknown'
    linkedAt?: number
    lastSeenAt?: number
    fingerprint?: string
    verified?: boolean
}

const DEVSCOPE_CLOUD_URL = 'https://devscope-production.up.railway.app'

function normalizeUrl(raw: string): string {
    const trimmed = raw.trim()
    if (!trimmed) return ''
    return trimmed.replace(/\/+$/, '')
}

function formatRelativeTime(timestamp: number): string {
    const deltaMs = Math.max(0, Date.now() - timestamp)
    const mins = Math.floor(deltaMs / 60000)
    if (mins < 1) return 'just now'
    if (mins < 60) return `${mins}m ago`
    const hours = Math.floor(mins / 60)
    if (hours < 24) return `${hours}h ago`
    const days = Math.floor(hours / 24)
    return `${days}d ago`
}

export default function RemoteAccessSettings() {
    const { settings, updateSettings } = useSettings()
    const [showConsentModal, setShowConsentModal] = useState(false)
    const [pendingEnableAfterConsent, setPendingEnableAfterConsent] = useState(false)
    const [serverInput, setServerInput] = useState(settings.remoteAccessServerUrl || '')
    const [validation, setValidation] = useState<ValidationState>({ status: 'idle', message: '' })
    const [pairing, setPairing] = useState<RelayPairingState>(null)
    const [devicesLoading, setDevicesLoading] = useState(false)
    const remoteAccessChecked = settings.remoteAccessEnabled && settings.remoteAccessMode !== 'local-only'

    const normalizeRelayError = (message: string): string => {
        if (/invalid relay api key/i.test(message)) {
            return 'Relay API key was rejected. In Relay Identity, use the same key as server RELAY_API_KEY, or leave both empty.'
        }
        return message
    }

    const activeServerUrl = useMemo(() => {
        if (settings.remoteAccessMode === 'devscope-cloud') return DEVSCOPE_CLOUD_URL
        if (settings.remoteAccessMode === 'self-hosted') return normalizeUrl(settings.remoteAccessServerUrl || serverInput)
        return ''
    }, [settings.remoteAccessMode, settings.remoteAccessServerUrl, serverInput])

    const handleRemoteAccessToggle = (enabled: boolean) => {
        if (!enabled) {
            updateSettings({ remoteAccessEnabled: false })
            return
        }

        if (!settings.remoteAccessConsentAccepted) {
            setPendingEnableAfterConsent(true)
            setShowConsentModal(true)
            return
        }

        updateSettings({
            remoteAccessEnabled: true,
            remoteAccessMode: settings.remoteAccessMode === 'local-only' ? 'devscope-cloud' : settings.remoteAccessMode
        })
    }

    const handleModeChange = (mode: RemoteAccessMode) => {
        const updates: Partial<typeof settings> = { remoteAccessMode: mode }
        if (mode === 'local-only') updates.remoteAccessEnabled = false
        if (mode === 'devscope-cloud') {
            updates.remoteAccessServerUrl = ''
            setServerInput('')
            setValidation({ status: 'idle', message: '' })
        }
        updateSettings(updates)
    }

    const resolveServerUrl = (): string => {
        if (settings.remoteAccessMode === 'devscope-cloud') return DEVSCOPE_CLOUD_URL
        if (settings.remoteAccessMode === 'self-hosted') return normalizeUrl(serverInput || settings.remoteAccessServerUrl)
        return ''
    }

    const handleConsentConfirm = () => {
        const now = Date.now()
        updateSettings({
            remoteAccessConsentAccepted: true,
            remoteAccessConsentAcceptedAt: now,
            remoteAccessEnabled: pendingEnableAfterConsent ? true : settings.remoteAccessEnabled,
            remoteAccessMode:
                pendingEnableAfterConsent && settings.remoteAccessMode === 'local-only'
                    ? 'devscope-cloud'
                    : settings.remoteAccessMode
        })
        setPendingEnableAfterConsent(false)
        setShowConsentModal(false)
    }

    const handleConsentCancel = () => {
        setPendingEnableAfterConsent(false)
        setShowConsentModal(false)
    }

    const validateServer = async () => {
        const target = resolveServerUrl()

        if (!target) {
            setValidation({ status: 'error', message: 'Enter a server URL first.' })
            return
        }

        if (!/^https:\/\//i.test(target)) {
            setValidation({ status: 'error', message: 'Server URL must use HTTPS.' })
            return
        }

        setValidation({ status: 'loading', message: 'Validating relay compatibility...' })
        try {
            const result = await window.devscope.remoteAccess.validateServer(target)
            if (!result?.success) {
                setValidation({ status: 'error', message: result?.error || 'Unable to validate server.' })
                return
            }

            const payload = result.wellKnown || {}
            const requiresE2EE = (payload as any)?.requiresE2EE !== false

            setValidation({
                status: 'success',
                message: requiresE2EE
                    ? 'Compatible Devscope relay detected with E2EE support.'
                    : 'Relay detected, but E2EE is not required by this server.',
                fingerprint: String((payload as any)?.fingerprint || '')
            })

            if (settings.remoteAccessMode === 'self-hosted') {
                updateSettings({ remoteAccessServerUrl: target })
            }
        } catch (error: any) {
            setValidation({
                status: 'error',
                message: error?.name === 'AbortError' ? 'Validation timed out.' : (error?.message || 'Unable to validate server.')
            })
        }
    }

    const refreshDevices = async () => {
        const target = resolveServerUrl()
        if (!target || settings.remoteAccessMode === 'local-only') return
        setDevicesLoading(true)
        try {
            const result = await window.devscope.remoteAccess.listDevices({
                serverUrl: target,
                ownerId: settings.remoteAccessOwnerId,
                relayApiKey: settings.remoteAccessApiKey || undefined
            })
            if (!result?.success) {
            setValidation({ status: 'error', message: normalizeRelayError(result?.error || 'Failed to load connected devices.') })
            return
        }
            const normalized = (Array.isArray(result.devices) ? result.devices : []).map((device: RelayConnectedDevice) => ({
                id: String(device.id || ''),
                name: String(device.label || device.name || 'Unknown device'),
                platform: device.platform || 'unknown',
                linkedAt: Number(device.linkedAt) || Date.now(),
                lastSeenAt: Number(device.lastSeenAt) || Date.now(),
                fingerprint: String(device.fingerprint || ''),
                verified: device.verified !== false
            }))
            updateSettings({ remoteAccessConnectedDevices: normalized })
        } finally {
            setDevicesLoading(false)
        }
    }

    const removeDevice = async (deviceId: string) => {
        const target = resolveServerUrl()
        if (!target) return
        const result = await window.devscope.remoteAccess.revokeDevice({
            serverUrl: target,
            ownerId: settings.remoteAccessOwnerId,
            deviceId,
            relayApiKey: settings.remoteAccessApiKey || undefined
        })
        if (!result?.success) {
            setValidation({ status: 'error', message: normalizeRelayError(result?.error || 'Failed to revoke device.') })
            return
        }
        await refreshDevices()
    }

    const generatePairing = async () => {
        const target = resolveServerUrl()
        if (!target || settings.remoteAccessMode === 'local-only') return
        const desktopPublicKey = btoa(`${settings.remoteAccessOwnerId}:${settings.remoteAccessDesktopDeviceId}:${Date.now()}`)
        const result = await window.devscope.remoteAccess.createPairing({
            serverUrl: target,
            relayApiKey: settings.remoteAccessApiKey || undefined,
            ownerId: settings.remoteAccessOwnerId,
            desktopDeviceId: settings.remoteAccessDesktopDeviceId,
            desktopPublicKey,
            desktopLabel: 'Devscope Desktop',
            deepLinkScheme: 'devscope'
        })
        if (!result?.success) {
            setValidation({ status: 'error', message: normalizeRelayError(result?.error || 'Failed to create pairing request.') })
            return
        }
        setPairing({
            pairingId: result.pairingId || '',
            oneTimeToken: result.oneTimeToken || '',
            confirmationCode: result.confirmationCode || '',
            qrPayload: result.qrPayload || '',
            expiresAt: Number(result.expiresAt) || Date.now()
        })
    }

    return (
        <div className="animate-fadeIn">
            <div className="mb-6">
                <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="rounded-lg bg-cyan-500/10 p-2">
                            <Smartphone className="text-cyan-300" size={24} />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h1 className="text-xl font-semibold text-sparkle-text">Remote Access</h1>
                                <span className="rounded border border-amber-400/30 bg-amber-400/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-200">
                                    Beta
                                </span>
                            </div>
                            <p className="text-sm text-sparkle-text-secondary">Optional mobile control with cloud or self-hosted relay</p>
                        </div>
                    </div>
                    <Link
                        to="/settings"
                        className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-sparkle-border bg-sparkle-card px-4 py-2 text-sm text-sparkle-text transition-all hover:bg-sparkle-card-hover hover:text-[var(--accent-primary)]"
                    >
                        <ArrowLeft size={16} />
                        Back to Settings
                    </Link>
                </div>
            </div>

            <div className="space-y-6">
                <section className="rounded-xl border border-sparkle-border bg-sparkle-card p-5">
                    <div className="flex items-start justify-between gap-4">
                        <div>
                            <h2 className="text-base font-semibold text-sparkle-text">Opt-in Remote Access</h2>
                            <p className="mt-1 text-sm text-sparkle-text-secondary">
                                Local-only is default. Remote mode remains disabled until you explicitly opt in.
                            </p>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-xs text-sparkle-text-muted">
                                {remoteAccessChecked ? 'Enabled' : 'Disabled'}
                            </span>
                            <ToggleSwitch
                                checked={remoteAccessChecked}
                                onChange={handleRemoteAccessToggle}
                            />
                        </div>
                    </div>

                    <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
                        <ModeCard
                            active={settings.remoteAccessMode === 'local-only'}
                            icon={<WifiOff size={16} className="text-slate-300" />}
                            title="Local Only"
                            description="No cloud relay. Desktop remains isolated."
                            onClick={() => handleModeChange('local-only')}
                        />
                        <ModeCard
                            active={settings.remoteAccessMode === 'devscope-cloud'}
                            icon={<Cloud size={16} className="text-cyan-300" />}
                            title="Devscope Cloud"
                            description="Use managed relay service for fast setup."
                            onClick={() => handleModeChange('devscope-cloud')}
                        />
                        <ModeCard
                            active={settings.remoteAccessMode === 'self-hosted'}
                            icon={<Server size={16} className="text-indigo-300" />}
                            title="Self-Hosted"
                            description="Use your own Devscope relay instance."
                            onClick={() => handleModeChange('self-hosted')}
                        />
                    </div>

                    <div className="mt-4 rounded-lg border border-sparkle-border bg-sparkle-bg p-4 text-sm text-sparkle-text-secondary">
                        <div className="flex items-start gap-2">
                            <Lock size={14} className="mt-0.5 text-emerald-300" />
                            <p>
                                End-to-end encryption is required for remote payloads. Relay servers can still observe metadata
                                such as connection times and device identifiers.
                            </p>
                        </div>
                    </div>
                </section>

                <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
                    <section className="rounded-xl border border-sparkle-border bg-sparkle-card p-5">
                        <h2 className="text-base font-semibold text-sparkle-text">Relay Server Validation</h2>
                        <p className="mt-1 text-sm text-sparkle-text-secondary">
                            Validate compatibility before connecting. Custom servers must expose `/.well-known/devscope`.
                        </p>

                        <div className="mt-4 grid grid-cols-1 gap-3">
                            <div className="rounded-lg border border-sparkle-border bg-sparkle-bg p-3">
                                {settings.remoteAccessMode === 'self-hosted' ? (
                                    <label className="block">
                                        <span className="text-xs text-sparkle-text-muted">Self-hosted relay URL</span>
                                        <input
                                            value={serverInput}
                                            onChange={(event) => setServerInput(event.target.value)}
                                            placeholder="https://relay.example.com"
                                            className="mt-1 w-full rounded-lg border border-sparkle-border bg-sparkle-card px-3 py-2 text-sm text-sparkle-text outline-none transition-colors focus:border-[var(--accent-primary)]/40"
                                        />
                                    </label>
                                ) : (
                                    <div>
                                        <p className="text-xs text-sparkle-text-muted">Devscope Cloud endpoint</p>
                                        <p className="mt-1 break-all font-mono text-xs text-sparkle-text">{DEVSCOPE_CLOUD_URL}</p>
                                    </div>
                                )}
                            </div>

                            <div className="rounded-lg border border-sparkle-border bg-sparkle-bg p-3">
                                <div className="flex flex-wrap items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={() => void validateServer()}
                                        disabled={validation.status === 'loading' || settings.remoteAccessMode === 'local-only'}
                                        className={cn(
                                            'inline-flex items-center gap-2 rounded-md border border-sparkle-border bg-sparkle-card px-3 py-1.5 text-xs transition-colors',
                                            'text-sparkle-text-secondary hover:bg-sparkle-card-hover hover:text-sparkle-text disabled:opacity-60'
                                        )}
                                    >
                                        <RefreshCw size={13} className={cn(validation.status === 'loading' && 'animate-spin')} />
                                        Validate Server
                                    </button>
                                    {activeServerUrl && (
                                        <span className="rounded border border-sparkle-border px-2 py-1 font-mono text-[11px] text-sparkle-text-muted">
                                            Active
                                        </span>
                                    )}
                                </div>
                                {validation.status !== 'idle' && (
                                    <div
                                        className={cn(
                                            'mt-2 rounded-lg border px-3 py-2 text-xs',
                                            validation.status === 'success'
                                                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
                                                : validation.status === 'error'
                                                    ? 'border-red-500/30 bg-red-500/10 text-red-200'
                                                    : 'border-sparkle-border bg-sparkle-bg text-sparkle-text-secondary'
                                        )}
                                    >
                                        <p>{validation.message}</p>
                                        {validation.fingerprint && (
                                            <p className="mt-1 font-mono text-[11px] text-sparkle-text-muted">
                                                Fingerprint: {validation.fingerprint}
                                            </p>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    </section>

                    <section className="rounded-xl border border-sparkle-border bg-sparkle-card p-5">
                        <h2 className="text-base font-semibold text-sparkle-text">Relay Identity</h2>
                        <p className="mt-1 text-sm text-sparkle-text-secondary">
                            These identifiers scope device lists and pairing sessions.
                        </p>
                        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
                            <label className="block">
                                <span className="text-xs text-sparkle-text-muted">Owner ID</span>
                                <input
                                    value={settings.remoteAccessOwnerId}
                                    onChange={(event) => updateSettings({ remoteAccessOwnerId: event.target.value.trim() || 'local-owner' })}
                                    className="mt-1 w-full rounded-lg border border-sparkle-border bg-sparkle-bg px-3 py-2 text-sm text-sparkle-text outline-none transition-colors focus:border-[var(--accent-primary)]/40"
                                />
                            </label>
                            <label className="block">
                                <span className="text-xs text-sparkle-text-muted">Desktop Device ID</span>
                                <input
                                    value={settings.remoteAccessDesktopDeviceId}
                                    onChange={(event) => updateSettings({ remoteAccessDesktopDeviceId: event.target.value.trim() || 'desktop-primary' })}
                                    className="mt-1 w-full rounded-lg border border-sparkle-border bg-sparkle-bg px-3 py-2 text-sm text-sparkle-text outline-none transition-colors focus:border-[var(--accent-primary)]/40"
                                />
                            </label>
                            <label className="block">
                                <span className="text-xs text-sparkle-text-muted">Relay API Key (optional)</span>
                                <input
                                    type="password"
                                    value={settings.remoteAccessApiKey}
                                    onChange={(event) => updateSettings({ remoteAccessApiKey: event.target.value })}
                                    className="mt-1 w-full rounded-lg border border-sparkle-border bg-sparkle-bg px-3 py-2 text-sm text-sparkle-text outline-none transition-colors focus:border-[var(--accent-primary)]/40"
                                />
                            </label>
                            <label className="block">
                                <span className="text-xs text-sparkle-text-muted">Effective Server URL</span>
                                <input
                                    value={activeServerUrl || 'local-only'}
                                    readOnly
                                    className="mt-1 w-full rounded-lg border border-sparkle-border bg-sparkle-bg px-3 py-2 text-sm font-mono text-sparkle-text-muted outline-none"
                                />
                            </label>
                        </div>
                    </section>
                </div>

                <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
                <section className="rounded-xl border border-sparkle-border bg-sparkle-card p-5">
                    <h2 className="text-base font-semibold text-sparkle-text">Desktop Pairing</h2>
                    <p className="mt-1 text-sm text-sparkle-text-secondary">
                        Generate a QR payload and confirmation code for the mobile client.
                    </p>
                    <div className="mt-4 flex flex-wrap items-center gap-2">
                        <button
                            type="button"
                            onClick={() => void generatePairing()}
                            disabled={settings.remoteAccessMode === 'local-only'}
                            className="inline-flex items-center gap-2 rounded-md border border-sparkle-border bg-sparkle-bg px-3 py-1.5 text-xs text-sparkle-text-secondary transition-colors hover:bg-sparkle-card-hover hover:text-sparkle-text disabled:opacity-60"
                        >
                            <KeyRound size={13} />
                            Generate Pairing
                        </button>
                    </div>
                    {pairing && (
                        <div className="mt-3 space-y-2 rounded-lg border border-sparkle-border bg-sparkle-bg p-3 text-xs text-sparkle-text-secondary">
                            <p>Code: <span className="font-mono text-sparkle-text">{pairing.confirmationCode}</span></p>
                            <p>Pairing ID: <span className="font-mono text-sparkle-text">{pairing.pairingId}</span></p>
                            <p>QR payload: <span className="font-mono text-sparkle-text">{pairing.qrPayload}</span></p>
                            <p>Expires: <span className="text-sparkle-text">{new Date(pairing.expiresAt).toLocaleTimeString()}</span></p>
                        </div>
                    )}
                </section>

                <section className="rounded-xl border border-sparkle-border bg-sparkle-card p-5">
                    <div className="flex items-center justify-between gap-3">
                        <div>
                            <h2 className="text-base font-semibold text-sparkle-text">Connected Devices</h2>
                            <p className="mt-1 text-sm text-sparkle-text-secondary">
                                Paired phones appear here and can be revoked at any time.
                            </p>
                        </div>
                        <span className="rounded-md border border-sparkle-border bg-sparkle-bg px-2 py-1 text-xs text-sparkle-text-secondary">
                            {settings.remoteAccessConnectedDevices.length} devices
                        </span>
                    </div>
                    <div className="mt-3 flex items-center gap-2">
                        <button
                            type="button"
                            onClick={() => void refreshDevices()}
                            disabled={devicesLoading || settings.remoteAccessMode === 'local-only'}
                            className="inline-flex items-center gap-1 rounded border border-sparkle-border bg-sparkle-bg px-2 py-1 text-[11px] text-sparkle-text-secondary transition-colors hover:bg-sparkle-card-hover hover:text-sparkle-text disabled:opacity-60"
                        >
                            <RefreshCw size={11} className={cn(devicesLoading && 'animate-spin')} />
                            Refresh Devices
                        </button>
                    </div>

                    <div className="mt-4 space-y-2">
                        {settings.remoteAccessConnectedDevices.length === 0 && (
                            <div className="rounded-lg border border-sparkle-border bg-sparkle-bg p-3 text-sm text-sparkle-text-secondary">
                                No devices paired yet. Use the mobile client QR scan + code confirmation flow to link one.
                            </div>
                        )}

                        {settings.remoteAccessConnectedDevices.map((device) => (
                            <div
                                key={device.id}
                                className="flex items-center justify-between gap-3 rounded-lg border border-sparkle-border bg-sparkle-bg px-3 py-2"
                            >
                                <div>
                                    <p className="text-sm font-medium text-sparkle-text">{device.name}</p>
                                    <p className="text-xs text-sparkle-text-secondary">
                                        {device.platform.toUpperCase()} • linked {formatRelativeTime(device.linkedAt)} • seen {formatRelativeTime(device.lastSeenAt)}
                                    </p>
                                    <p className="mt-1 font-mono text-[11px] text-sparkle-text-muted">
                                        {device.fingerprint || 'no fingerprint'}
                                    </p>
                                </div>
                                <div className="flex items-center gap-2">
                                    {device.verified && (
                                        <span className="inline-flex items-center gap-1 rounded border border-emerald-500/30 px-2 py-1 text-[11px] text-emerald-200">
                                            <CheckCircle2 size={11} />
                                            Verified
                                        </span>
                                    )}
                                    <button
                                        type="button"
                                        onClick={() => void removeDevice(device.id)}
                                        className="inline-flex items-center gap-1 rounded border border-red-500/30 bg-red-500/10 px-2 py-1 text-[11px] text-red-200 transition-colors hover:bg-red-500/20"
                                        title="Revoke device"
                                    >
                                        <Trash2 size={11} />
                                        Revoke
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>

                <section className="rounded-xl border border-sparkle-border bg-sparkle-card p-5 xl:col-span-2">
                    <h2 className="text-base font-semibold text-sparkle-text">Mobile Pairing Flow</h2>
                    <p className="mt-1 text-sm text-sparkle-text-secondary">
                        Desktop shows QR + short code. Mobile scans QR, confirms code, then desktop approves device pairing.
                    </p>
                    <div className="mt-3 space-y-2 text-xs text-sparkle-text-secondary">
                        <p className="inline-flex items-center gap-2"><KeyRound size={13} className="text-cyan-300" />One-time pairing token expires quickly.</p>
                        <p className="inline-flex items-center gap-2"><Shield size={13} className="text-emerald-300" />Session payloads are relayed as E2EE envelopes.</p>
                        <p className="inline-flex items-center gap-2"><Lock size={13} className="text-violet-300" />Use only trusted relays and verify server fingerprint.</p>
                    </div>
                </section>
                </div>
            </div>

            <ConfirmModal
                isOpen={showConsentModal}
                title="Enable Devscope Cloud Relay?"
                message="This is optional and disabled by default. Enabling remote access connects your app to a relay service for mobile control. Your PC remains the execution host. Devscope Cloud must not be enabled unless you accept this connection."
                confirmLabel="I Understand, Enable"
                cancelLabel="Cancel"
                onConfirm={handleConsentConfirm}
                onCancel={handleConsentCancel}
                variant="warning"
            />
        </div>
    )
}

function ModeCard({
    active,
    icon,
    title,
    description,
    onClick
}: {
    active: boolean
    icon: React.ReactNode
    title: string
    description: string
    onClick: () => void
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={cn(
                'rounded-lg border p-3 text-left transition-colors',
                active
                    ? 'border-[var(--accent-primary)]/45 bg-[var(--accent-primary)]/12'
                    : 'border-sparkle-border bg-sparkle-bg hover:bg-sparkle-card-hover'
            )}
        >
            <p className="inline-flex items-center gap-2 text-sm font-medium text-sparkle-text">
                {icon}
                {title}
            </p>
            <p className="mt-1 text-xs text-sparkle-text-secondary">{description}</p>
        </button>
    )
}

function ToggleSwitch({
    checked,
    onChange
}: {
    checked: boolean
    onChange: (next: boolean) => void
}) {
    return (
        <button
            type="button"
            onClick={() => onChange(!checked)}
            aria-pressed={checked}
            className={cn(
                'relative inline-flex h-7 w-12 items-center rounded-full px-1 transition-colors',
                checked ? 'bg-[var(--accent-primary)]' : 'bg-sparkle-border'
            )}
        >
            <span
                className={cn(
                    'h-5 w-5 rounded-full bg-white shadow transition-transform',
                    checked ? 'translate-x-5' : 'translate-x-0'
                )}
            />
        </button>
    )
}
