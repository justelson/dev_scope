import { useEffect, useMemo, useRef, useState } from 'react'
import { parsePairingDeepLink, parsePairingFromCurrentUrl } from './pairing'

type ValidationState = {
  status: 'idle' | 'loading' | 'success' | 'error'
  message: string
}

type WellKnownResponse = {
  service: string
  protocolVersion: string
  relayKind: 'devscope-cloud' | 'self-hosted'
  requiresE2EE: boolean
  fingerprint: string
}

type ConnectedDevice = {
  id: string
  ownerId: string
  label: string
  platform: 'ios' | 'android' | 'web' | 'desktop' | 'unknown'
  fingerprint: string
  linkedAt: number
  lastSeenAt: number
  revokedAt: number | null
}

type ClaimResult = {
  success: boolean
  ownerId?: string
  error?: string
}

type DeviceIdentity = {
  deviceId: string
  publicKey: string
  label: string
}

const STORAGE = {
  relayUrl: 'devscope.mobile.relay.url.v1',
  relayApiKey: 'devscope.mobile.relay.api-key.v1',
  ownerId: 'devscope.mobile.owner-id.v1',
  deviceId: 'devscope.mobile.device.id.v1',
  devicePub: 'devscope.mobile.device.pub.v1'
} as const

const DEFAULT_RELAY_URL = (import.meta.env.VITE_DEVSCOPE_RELAY_URL as string | undefined) || 'https://devscope-production.up.railway.app'

function normalizeUrl(url: string): string {
  return url.trim().replace(/\/+$/, '')
}

function toWsUrl(httpUrl: string): string {
  const url = new URL(httpUrl)
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:'
  url.pathname = '/v1/relay/ws'
  url.search = ''
  return url.toString()
}

function readStorage(key: string, fallback = ''): string {
  try {
    return localStorage.getItem(key)?.trim() || fallback
  } catch {
    return fallback
  }
}

function writeStorage(key: string, value: string): void {
  try {
    localStorage.setItem(key, value)
  } catch {
    // no-op
  }
}

function createRandomToken(prefix: string): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}-${crypto.randomUUID()}`
  }
  return `${prefix}-${Math.random().toString(36).slice(2, 12)}`
}

function createPublicKeyStub(): string {
  const bytes = new Uint8Array(24)
  crypto.getRandomValues(bytes)
  let out = ''
  for (const byte of bytes) out += String.fromCharCode(byte)
  return btoa(out)
}

function getOrCreateIdentity(): DeviceIdentity {
  const storedDeviceId = readStorage(STORAGE.deviceId)
  const storedPub = readStorage(STORAGE.devicePub)
  const deviceId = storedDeviceId || createRandomToken('mobile')
  const publicKey = storedPub || createPublicKeyStub()
  writeStorage(STORAGE.deviceId, deviceId)
  writeStorage(STORAGE.devicePub, publicKey)
  return { deviceId, publicKey, label: 'Devscope Mobile Web' }
}

async function fetchJson<T>(url: string, init?: RequestInit, relayApiKey?: string): Promise<T> {
  const headers = new Headers(init?.headers || {})
  if (init?.body) headers.set('content-type', 'application/json')
  if (relayApiKey?.trim()) headers.set('x-devscope-relay-key', relayApiKey.trim())

  const response = await fetch(url, { ...init, headers })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    const message = typeof payload?.error === 'string' ? payload.error : `Request failed (${response.status})`
    throw new Error(message)
  }
  return payload as T
}

function formatAge(timestamp: number): string {
  const delta = Math.max(0, Date.now() - timestamp)
  const mins = Math.floor(delta / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

function humanizeError(error: unknown): string {
  const message = error instanceof Error ? error.message : 'Unexpected error'
  if (/invalid relay api key/i.test(message)) {
    return 'Relay rejected API key. Use the same key as RELAY_API_KEY on server, or clear both sides.'
  }
  return message
}

export default function App() {
  const [relayUrl, setRelayUrl] = useState(() => readStorage(STORAGE.relayUrl, DEFAULT_RELAY_URL))
  const [relayApiKey, setRelayApiKey] = useState(() => readStorage(STORAGE.relayApiKey, import.meta.env.VITE_DEVSCOPE_RELAY_API_KEY || ''))
  const [ownerId, setOwnerId] = useState(() => readStorage(STORAGE.ownerId, ''))

  const [validation, setValidation] = useState<ValidationState>({ status: 'idle', message: '' })
  const [wellKnown, setWellKnown] = useState<WellKnownResponse | null>(null)
  const [pairingLink, setPairingLink] = useState('')
  const [pairingId, setPairingId] = useState('')
  const [pairingToken, setPairingToken] = useState('')
  const [confirmationCode, setConfirmationCode] = useState('')
  const [pairingStatus, setPairingStatus] = useState<ValidationState>({ status: 'idle', message: 'Ready to pair' })
  const [devices, setDevices] = useState<ConnectedDevice[]>([])
  const [events, setEvents] = useState<string[]>([])
  const [wsStatus, setWsStatus] = useState<'idle' | 'connecting' | 'connected' | 'error'>('idle')

  const identityRef = useRef<DeviceIdentity>(getOrCreateIdentity())
  const wsRef = useRef<WebSocket | null>(null)

  const normalizedRelayUrl = useMemo(() => normalizeUrl(relayUrl), [relayUrl])
  const mobileDeviceId = identityRef.current.deviceId

  useEffect(() => {
    writeStorage(STORAGE.relayUrl, relayUrl)
  }, [relayUrl])

  useEffect(() => {
    writeStorage(STORAGE.relayApiKey, relayApiKey)
  }, [relayApiKey])

  useEffect(() => {
    writeStorage(STORAGE.ownerId, ownerId)
  }, [ownerId])

  useEffect(() => {
    const parsed = parsePairingFromCurrentUrl(window.location.href)
    if (!parsed) return
    setPairingId(parsed.pairingId)
    setPairingToken(parsed.token)
  }, [])

  useEffect(() => {
    if (!ownerId) return
    const interval = window.setInterval(() => {
      void refreshDevices(ownerId, false)
    }, 6000)
    return () => window.clearInterval(interval)
  }, [ownerId, normalizedRelayUrl, relayApiKey])

  useEffect(() => {
    return () => {
      if (wsRef.current) wsRef.current.close()
    }
  }, [])

  const pushEvent = (line: string) => {
    setEvents((prev) => [`${new Date().toLocaleTimeString()} ${line}`, ...prev].slice(0, 120))
  }

  const parseLink = () => {
    const parsed = parsePairingDeepLink(pairingLink.trim())
    if (!parsed) {
      setPairingStatus({ status: 'error', message: 'Invalid pairing link.' })
      return
    }
    setPairingId(parsed.pairingId)
    setPairingToken(parsed.token)
    setPairingStatus({ status: 'success', message: 'Pairing link parsed.' })
  }

  const validateRelay = async () => {
    if (!normalizedRelayUrl) {
      setValidation({ status: 'error', message: 'Relay URL is required.' })
      return
    }
    setValidation({ status: 'loading', message: 'Validating relay...' })
    try {
      await fetchJson(`${normalizedRelayUrl}/health`)
      const wk = await fetchJson<WellKnownResponse>(`${normalizedRelayUrl}/.well-known/devscope`)
      if (wk.service !== 'devscope-relay') throw new Error('Not a compatible Devscope relay.')
      setWellKnown(wk)
      setValidation({ status: 'success', message: `Relay OK (${wk.relayKind})` })
      pushEvent(`Relay validated: ${normalizedRelayUrl}`)
    } catch (error) {
      setValidation({ status: 'error', message: humanizeError(error) })
    }
  }

  const refreshDevices = async (owner: string, updatePairingStatus = true) => {
    if (!owner) return
    try {
      const result = await fetchJson<{ success: boolean; devices: ConnectedDevice[] }>(
        `${normalizedRelayUrl}/v1/devices/${encodeURIComponent(owner)}`,
        undefined,
        relayApiKey
      )
      const next = Array.isArray(result.devices) ? result.devices : []
      setDevices(next)
      if (updatePairingStatus) {
        const self = next.find((device) => device.id === mobileDeviceId && !device.revokedAt)
        if (self) {
          setPairingStatus({ status: 'success', message: 'Approved and linked.' })
        }
      }
    } catch (error) {
      pushEvent(`Device refresh failed: ${humanizeError(error)}`)
    }
  }

  const claimPairing = async () => {
    const code = confirmationCode.trim()
    if (!pairingId.trim() || !pairingToken.trim()) {
      setPairingStatus({ status: 'error', message: 'Pairing ID and token are required.' })
      return
    }
    if (code.length !== 6) {
      setPairingStatus({ status: 'error', message: 'Enter the 6-digit code.' })
      return
    }

    setPairingStatus({ status: 'loading', message: 'Claiming pairing...' })
    try {
      const result = await fetchJson<ClaimResult>(
        `${normalizedRelayUrl}/v1/pairings/claim`,
        {
          method: 'POST',
          body: JSON.stringify({
            pairingId: pairingId.trim(),
            oneTimeToken: pairingToken.trim(),
            confirmationCode: code,
            mobileDeviceId,
            mobilePublicKey: identityRef.current.publicKey,
            mobileLabel: identityRef.current.label,
            mobilePlatform: 'web'
          })
        },
        relayApiKey
      )

      if (!result.success || !result.ownerId) {
        throw new Error(result.error || 'Pairing claim failed.')
      }

      setOwnerId(result.ownerId)
      setPairingStatus({ status: 'loading', message: 'Claimed. Waiting for desktop approval...' })
      await refreshDevices(result.ownerId, true)
      pushEvent(`Pairing claimed for owner ${result.ownerId}`)
    } catch (error) {
      setPairingStatus({ status: 'error', message: humanizeError(error) })
    }
  }

  const connectSocket = () => {
    if (!ownerId) {
      pushEvent('Set owner ID first.')
      return
    }
    if (wsRef.current) wsRef.current.close()

    const wsUrl = `${toWsUrl(normalizedRelayUrl)}?ownerId=${encodeURIComponent(ownerId)}&deviceId=${encodeURIComponent(mobileDeviceId)}`
    const ws = new WebSocket(wsUrl)
    wsRef.current = ws
    setWsStatus('connecting')
    ws.onopen = () => {
      setWsStatus('connected')
      pushEvent('Relay stream connected')
    }
    ws.onclose = () => {
      setWsStatus('idle')
      pushEvent('Relay stream disconnected')
    }
    ws.onerror = () => {
      setWsStatus('error')
      pushEvent('Relay stream error')
    }
    ws.onmessage = (event) => {
      const raw = typeof event.data === 'string' ? event.data : '[binary]'
      pushEvent(`WS: ${raw.slice(0, 180)}`)
    }
  }

  const disconnectSocket = () => {
    if (wsRef.current) wsRef.current.close()
    wsRef.current = null
    setWsStatus('idle')
  }

  return (
    <main className="page">
      <header className="card hero">
        <h1>Devscope Mobile Pairing</h1>
        <p className="muted">Quick setup: validate relay, claim pairing, confirm linked device.</p>
      </header>

      <section className="card">
        <h2>1. Relay</h2>
        <label>
          Relay URL
          <input value={relayUrl} onChange={(event) => setRelayUrl(event.target.value)} placeholder="https://relay.example.com" />
        </label>
        <label>
          Relay API Key (optional)
          <input value={relayApiKey} onChange={(event) => setRelayApiKey(event.target.value)} placeholder="Only if server uses RELAY_API_KEY" />
        </label>
        <button onClick={() => void validateRelay()} disabled={validation.status === 'loading'}>
          {validation.status === 'loading' ? 'Validating...' : 'Validate Relay'}
        </button>
        {validation.status !== 'idle' && <p className={`status ${validation.status}`}>{validation.message}</p>}
        {wellKnown && <p className="muted small">protocol {wellKnown.protocolVersion} | fingerprint {wellKnown.fingerprint}</p>}
      </section>

      <section className="card">
        <h2>2. Pair</h2>
        <label>
          Pairing Link (optional)
          <textarea rows={2} value={pairingLink} onChange={(event) => setPairingLink(event.target.value)} placeholder="devscope://pair?pairingId=...&token=..." />
        </label>
        <button onClick={parseLink} type="button">Parse Link</button>
        <label>
          Pairing ID
          <input value={pairingId} onChange={(event) => setPairingId(event.target.value)} />
        </label>
        <label>
          One-time Token
          <input value={pairingToken} onChange={(event) => setPairingToken(event.target.value)} />
        </label>
        <label>
          6-digit Code
          <input value={confirmationCode} onChange={(event) => setConfirmationCode(event.target.value.replace(/\D/g, '').slice(0, 6))} />
        </label>
        <button onClick={() => void claimPairing()} disabled={pairingStatus.status === 'loading'}>Claim Pairing</button>
        <p className={`status ${pairingStatus.status}`}>{pairingStatus.message}</p>
      </section>

      <section className="card">
        <h2>3. Devices</h2>
        <label>
          Owner ID
          <input value={ownerId} onChange={(event) => setOwnerId(event.target.value.trim())} placeholder="local-owner" />
        </label>
        <div className="row">
          <button onClick={() => void refreshDevices(ownerId, false)} type="button">Refresh Devices</button>
          <button onClick={wsStatus === 'connected' ? disconnectSocket : connectSocket} type="button" disabled={!ownerId}>
            {wsStatus === 'connected' ? 'Disconnect Stream' : 'Connect Stream'}
          </button>
        </div>
        <p className="muted small">Mobile device: {mobileDeviceId}</p>
        <div className="device-list">
          {devices.length === 0 && <p className="muted">No linked devices yet.</p>}
          {devices.map((device) => (
            <article key={device.id} className="device-item">
              <strong>{device.label || device.id}</strong>
              <span className="muted small">{device.platform} | {device.id}</span>
              <span className="muted small">linked {formatAge(device.linkedAt)} | seen {formatAge(device.lastSeenAt)}</span>
            </article>
          ))}
        </div>
      </section>

      <details className="card">
        <summary>Debug Log</summary>
        <div className="events">
          {events.length === 0 ? <p className="muted">No events</p> : events.map((line, index) => <p key={index}>{line}</p>)}
        </div>
      </details>
    </main>
  )
}
