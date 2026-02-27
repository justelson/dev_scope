import { useEffect, useMemo, useRef, useState } from 'react'
import { parsePairingDeepLink, parsePairingFromCurrentUrl } from './pairing'

type ValidationState = {
  status: 'idle' | 'loading' | 'ok' | 'error'
  message: string
  fingerprint?: string
}

type WellKnownResponse = {
  service: string
  protocolVersion: string
  relayKind: 'devscope-cloud' | 'self-hosted'
  requiresE2EE: boolean
  fingerprint: string
  capabilities: string[]
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
  pairingId?: string
  claimedAt?: number
  ownerId?: string
  error?: string
}

type DeviceIdentity = {
  deviceId: string
  publicKey: string
  label: string
}

type WsStatus = 'idle' | 'connecting' | 'connected' | 'error'

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

function createRandomToken(prefix: string): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}-${crypto.randomUUID()}`
  }
  return `${prefix}-${Math.random().toString(36).slice(2, 12)}`
}

function toBase64Utf8(input: string): string {
  const bytes = new TextEncoder().encode(input)
  let binary = ''
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte)
  })
  return btoa(binary)
}

function createPublicKeyStub(): string {
  const bytes = new Uint8Array(24)
  crypto.getRandomValues(bytes)
  let out = ''
  for (const byte of bytes) out += String.fromCharCode(byte)
  return btoa(out)
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

function getOrCreateIdentity(): DeviceIdentity {
  const storedDeviceId = readStorage(STORAGE.deviceId)
  const storedPub = readStorage(STORAGE.devicePub)
  const deviceId = storedDeviceId || createRandomToken('mobile')
  const publicKey = storedPub || createPublicKeyStub()
  writeStorage(STORAGE.deviceId, deviceId)
  writeStorage(STORAGE.devicePub, publicKey)
  return {
    deviceId,
    publicKey,
    label: 'Devscope Mobile Web'
  }
}

async function fetchJson<T>(
  url: string,
  init?: RequestInit,
  relayApiKey?: string
): Promise<T> {
  const headers = new Headers(init?.headers || {})
  if (init?.body) headers.set('content-type', 'application/json')
  if (relayApiKey?.trim()) {
    headers.set('x-devscope-relay-key', relayApiKey.trim())
  }
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
  const seconds = Math.floor(delta / 1000)
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  return `${hours}h`
}

export default function App() {
  const [relayUrl, setRelayUrl] = useState(() => readStorage(STORAGE.relayUrl, DEFAULT_RELAY_URL))
  const [relayApiKey, setRelayApiKey] = useState(() => readStorage(STORAGE.relayApiKey, import.meta.env.VITE_DEVSCOPE_RELAY_API_KEY || ''))
  const [ownerId, setOwnerId] = useState(() => readStorage(STORAGE.ownerId, ''))
  const [validation, setValidation] = useState<ValidationState>({ status: 'idle', message: '' })
  const [wellKnown, setWellKnown] = useState<WellKnownResponse | null>(null)
  const [pairingLink, setPairingLink] = useState('')
  const [pairingIdInput, setPairingIdInput] = useState('')
  const [pairingTokenInput, setPairingTokenInput] = useState('')
  const [confirmationCode, setConfirmationCode] = useState('')
  const [pairingStatus, setPairingStatus] = useState<'idle' | 'claiming' | 'claimed' | 'approved' | 'error'>('idle')
  const [statusMessage, setStatusMessage] = useState('Ready to pair')
  const [devices, setDevices] = useState<ConnectedDevice[]>([])
  const [threadId, setThreadId] = useState('mobile-thread')
  const [targetDeviceInput, setTargetDeviceInput] = useState('')
  const [testPayload, setTestPayload] = useState('mobile-test')
  const [events, setEvents] = useState<string[]>([])
  const [wsStatus, setWsStatus] = useState<WsStatus>('idle')
  const wsRef = useRef<WebSocket | null>(null)
  const identityRef = useRef<DeviceIdentity>(getOrCreateIdentity())

  const normalizedRelayUrl = useMemo(() => normalizeUrl(relayUrl), [relayUrl])
  const mobileDeviceId = identityRef.current.deviceId
  const mobilePublicKey = identityRef.current.publicKey
  const autoDesktopTargetId = useMemo(
    () => devices.find((item) => item.id !== mobileDeviceId && !item.revokedAt)?.id || '',
    [devices, mobileDeviceId]
  )
  const targetDesktopDeviceId = targetDeviceInput.trim() || autoDesktopTargetId

  useEffect(() => {
    const parsed = parsePairingFromCurrentUrl(window.location.href)
    if (!parsed) return
    setPairingIdInput(parsed.pairingId)
    setPairingTokenInput(parsed.token)
    setPairingLink(`devscope://pair?pairingId=${encodeURIComponent(parsed.pairingId)}&token=${encodeURIComponent(parsed.token)}`)
  }, [])

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
    return () => {
      if (wsRef.current) {
        wsRef.current.close()
        wsRef.current = null
      }
    }
  }, [])

  const pushEvent = (message: string) => {
    setEvents((prev) => [`${new Date().toLocaleTimeString()}  ${message}`, ...prev].slice(0, 160))
  }

  const parsePairingInput = () => {
    const parsed = parsePairingDeepLink(pairingLink.trim())
    if (!parsed) {
      pushEvent('Pairing link parse failed')
      return
    }
    setPairingIdInput(parsed.pairingId)
    setPairingTokenInput(parsed.token)
    pushEvent(`Pairing parsed: ${parsed.pairingId}`)
  }

  const validateServer = async () => {
    if (!normalizedRelayUrl) {
      setValidation({ status: 'error', message: 'Enter relay URL first.' })
      return
    }
    setValidation({ status: 'loading', message: 'Validating relay...' })
    try {
      await fetchJson(`${normalizedRelayUrl}/health`)
      const wk = await fetchJson<WellKnownResponse>(`${normalizedRelayUrl}/.well-known/devscope`)
      if (wk.service !== 'devscope-relay') throw new Error('Not a Devscope relay server.')
      setWellKnown(wk)
      setValidation({
        status: 'ok',
        message: `Relay validated (${wk.relayKind}).`,
        fingerprint: wk.fingerprint
      })
      pushEvent(`Relay validated: ${normalizedRelayUrl}`)
    } catch (error: any) {
      setValidation({
        status: 'error',
        message: error?.message || 'Relay validation failed.'
      })
      pushEvent(`Relay validation failed: ${error?.message || 'unknown error'}`)
    }
  }

  const refreshDevices = async (owner: string, checkApproval = true): Promise<ConnectedDevice[]> => {
    if (!owner) return []
    const response = await fetchJson<{ success: boolean; devices: ConnectedDevice[] }>(
      `${normalizedRelayUrl}/v1/devices/${encodeURIComponent(owner)}`,
      undefined,
      relayApiKey
    )
    const nextDevices = Array.isArray(response.devices) ? response.devices : []
    setDevices(nextDevices)

    if (checkApproval) {
      const self = nextDevices.find((item) => item.id === mobileDeviceId && !item.revokedAt)
      if (self && pairingStatus !== 'approved') {
        setPairingStatus('approved')
        setStatusMessage('Approved and linked.')
        pushEvent('Desktop approved this device.')
      }
    }

    return nextDevices
  }

  const claimPairing = async () => {
    const pairingId = pairingIdInput.trim()
    const oneTimeToken = pairingTokenInput.trim()
    const code = confirmationCode.trim()

    if (!pairingId || !oneTimeToken) {
      setPairingStatus('error')
      setStatusMessage('Provide pairingId and token (or parse link first).')
      return
    }
    if (code.length !== 6) {
      setPairingStatus('error')
      setStatusMessage('Enter the 6-digit confirmation code.')
      return
    }

    setPairingStatus('claiming')
    setStatusMessage('Claiming pairing...')
    try {
      const response = await fetchJson<ClaimResult>(
        `${normalizedRelayUrl}/v1/pairings/claim`,
        {
          method: 'POST',
          body: JSON.stringify({
            pairingId,
            oneTimeToken,
            confirmationCode: code,
            mobileDeviceId,
            mobilePublicKey,
            mobileLabel: identityRef.current.label,
            mobilePlatform: 'web'
          })
        },
        relayApiKey
      )
      if (!response.success || !response.ownerId) {
        throw new Error(response.error || 'Pairing claim failed.')
      }
      setOwnerId(response.ownerId)
      setPairingStatus('claimed')
      setStatusMessage('Claimed. Waiting for desktop approval...')
      pushEvent(`Pairing claimed for owner ${response.ownerId}`)
      await refreshDevices(response.ownerId, true)
    } catch (error: any) {
      setPairingStatus('error')
      setStatusMessage(error?.message || 'Unable to claim pairing.')
      pushEvent(`Pairing claim failed: ${error?.message || 'unknown error'}`)
    }
  }

  useEffect(() => {
    if (!ownerId || pairingStatus === 'error') return
    let active = true
    const tick = async () => {
      try {
        await refreshDevices(ownerId, true)
      } catch (error: any) {
        if (active) {
          pushEvent(`Device polling failed: ${error?.message || 'unknown error'}`)
        }
      }
    }

    void tick()
    const timer = window.setInterval(() => {
      void tick()
    }, 5000)

    return () => {
      active = false
      window.clearInterval(timer)
    }
  }, [ownerId, normalizedRelayUrl, relayApiKey, pairingStatus])

  const connectWebSocket = () => {
    if (!ownerId) {
      pushEvent('Cannot connect socket: ownerId missing.')
      return
    }
    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
    }
    try {
      const wsBase = toWsUrl(normalizedRelayUrl)
      const wsUrl = `${wsBase}?ownerId=${encodeURIComponent(ownerId)}&deviceId=${encodeURIComponent(mobileDeviceId)}`
      const ws = new WebSocket(wsUrl)
      wsRef.current = ws
      setWsStatus('connecting')
      ws.onopen = () => {
        setWsStatus('connected')
        pushEvent('Relay websocket connected')
      }
      ws.onclose = () => {
        setWsStatus('idle')
        pushEvent('Relay websocket closed')
      }
      ws.onerror = () => {
        setWsStatus('error')
        pushEvent('Relay websocket error')
      }
      ws.onmessage = (event) => {
        const raw = typeof event.data === 'string' ? event.data : '[binary]'
        pushEvent(`WS <- ${raw.slice(0, 220)}`)
      }
    } catch (error: any) {
      setWsStatus('error')
      pushEvent(`Websocket connect failed: ${error?.message || 'unknown error'}`)
    }
  }

  const disconnectWebSocket = () => {
    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
    }
    setWsStatus('idle')
    pushEvent('Relay websocket manually disconnected')
  }

  const publishTestEnvelope = async () => {
    if (!ownerId || !targetDesktopDeviceId) {
      pushEvent('Provide ownerId and a desktop target deviceId first.')
      return
    }
    try {
      const envelope = {
        v: 1 as const,
        ownerId,
        threadId: threadId.trim() || 'mobile-thread',
        fromDeviceId: mobileDeviceId,
        toDeviceId: targetDesktopDeviceId,
        nonce: createRandomToken('nonce'),
        ciphertext: toBase64Utf8(testPayload || `mobile-test:${Date.now()}`),
        authTag: createRandomToken('tag'),
        sentAt: Date.now()
      }
      const result = await fetchJson<{ success: boolean; delivered: number }>(
        `${normalizedRelayUrl}/v1/relay/publish`,
        {
          method: 'POST',
          body: JSON.stringify({ envelope })
        },
        relayApiKey
      )
      pushEvent(`Envelope published. delivered=${result.delivered}`)
    } catch (error: any) {
      pushEvent(`Publish failed: ${error?.message || 'unknown error'}`)
    }
  }

  return (
    <main className="page">
      <header className="card hero">
        <h1>Devscope Remote Mobile</h1>
        <p className="muted">Deployable web controller for pairing, approvals, and relay session checks.</p>
        <div className="pill-row">
          <span className="pill">Beta</span>
          <span className="pill">Vercel Ready</span>
          <span className="pill">Owner: {ownerId || 'not-linked'}</span>
        </div>
      </header>

      <section className="card">
        <h2>1. Relay Setup</h2>
        <label>
          Relay URL
          <input value={relayUrl} onChange={(event) => setRelayUrl(event.target.value)} placeholder="https://relay.example.com" />
        </label>
        <label>
          Relay API key (optional)
          <input value={relayApiKey} onChange={(event) => setRelayApiKey(event.target.value)} placeholder="x-devscope-relay-key" />
        </label>
        <button onClick={() => void validateServer()} disabled={validation.status === 'loading'}>
          {validation.status === 'loading' ? 'Validating...' : 'Validate Relay'}
        </button>
        {validation.status !== 'idle' && (
          <p className={`status ${validation.status}`}>
            {validation.message}
            {validation.fingerprint ? `  fingerprint=${validation.fingerprint}` : ''}
          </p>
        )}
        {wellKnown && (
          <p className="muted small">
            protocol={wellKnown.protocolVersion}  kind={wellKnown.relayKind}  e2ee={String(wellKnown.requiresE2EE)}
          </p>
        )}
      </section>

      <section className="card">
        <h2>2. Pairing Claim</h2>
        <p className="muted small">Paste the desktop pairing link, parse it, then confirm with the same 6-digit code.</p>
        <label>
          Pairing link (optional)
          <textarea
            rows={3}
            value={pairingLink}
            onChange={(event) => setPairingLink(event.target.value)}
            placeholder="devscope://pair?pairingId=...&token=..."
          />
        </label>
        <div className="row">
          <button onClick={parsePairingInput} type="button">Parse Link</button>
        </div>
        <label>
          Pairing ID
          <input value={pairingIdInput} onChange={(event) => setPairingIdInput(event.target.value)} placeholder="pairingId" />
        </label>
        <label>
          One-time token
          <input value={pairingTokenInput} onChange={(event) => setPairingTokenInput(event.target.value)} placeholder="oneTimeToken" />
        </label>
        <label>
          Confirmation code
          <input
            value={confirmationCode}
            onChange={(event) => setConfirmationCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder="123456"
          />
        </label>
        <button onClick={() => void claimPairing()} disabled={pairingStatus === 'claiming'}>
          {pairingStatus === 'claiming' ? 'Claiming...' : 'Claim Pairing'}
        </button>
        <p className={`status ${pairingStatus === 'approved' ? 'ok' : pairingStatus === 'error' ? 'error' : 'loading'}`}>
          {statusMessage}
        </p>
        <p className="muted small">mobileDeviceId={mobileDeviceId}</p>
      </section>

      <section className="card">
        <h2>3. Linked Devices</h2>
        <div className="row">
          <input value={ownerId} onChange={(event) => setOwnerId(event.target.value.trim())} placeholder="ownerId" />
          <button onClick={() => void refreshDevices(ownerId, false)} disabled={!ownerId} type="button">Refresh</button>
        </div>
        <label>
          Desktop target device ID (optional override)
          <input
            value={targetDeviceInput}
            onChange={(event) => setTargetDeviceInput(event.target.value)}
            placeholder={autoDesktopTargetId || 'auto-selected from linked devices'}
          />
        </label>
        {devices.length === 0 && <p className="muted">No linked devices yet.</p>}
        {devices.map((device) => (
          <article key={device.id} className="device-item">
            <strong>{device.label || device.id}</strong>
            <span className="muted small">{device.platform}  {device.id}</span>
            <span className="muted small">
              linked {formatAge(device.linkedAt)} ago  seen {formatAge(device.lastSeenAt)} ago
            </span>
            <span className="muted small">fingerprint={device.fingerprint}</span>
          </article>
        ))}
      </section>

      <section className="card">
        <h2>4. Relay Stream Check</h2>
        <div className="pill-row">
          <span className="pill">ws={wsStatus}</span>
          <span className="pill">target={targetDesktopDeviceId || 'none'}</span>
        </div>
        <div className="row">
          <button onClick={connectWebSocket} disabled={!ownerId || wsStatus === 'connecting'} type="button">Connect WS</button>
          <button onClick={disconnectWebSocket} disabled={wsStatus === 'idle'} type="button">Disconnect WS</button>
        </div>
        <label>
          Thread ID
          <input value={threadId} onChange={(event) => setThreadId(event.target.value)} placeholder="threadId" />
        </label>
        <label>
          Test payload
          <input value={testPayload} onChange={(event) => setTestPayload(event.target.value)} placeholder="message body" />
        </label>
        <button onClick={() => void publishTestEnvelope()} disabled={!ownerId} type="button">Publish Test Envelope</button>
        <div className="events">
          {events.length === 0 ? <p className="muted">No relay events yet.</p> : events.map((line, index) => <p key={index}>{line}</p>)}
        </div>
      </section>
    </main>
  )
}
