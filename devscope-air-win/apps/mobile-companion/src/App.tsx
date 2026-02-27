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

const DEFAULT_RELAY_URL = 'https://devscope-production.up.railway.app'
const DEVICE_ID_KEY = 'devscope.mobile.device.id.v1'
const DEVICE_PUB_KEY = 'devscope.mobile.device.pub.v1'

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

function createPublicKeyStub(): string {
  const bytes = new Uint8Array(24)
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes)
  } else {
    for (let i = 0; i < bytes.length; i += 1) {
      bytes[i] = Math.floor(Math.random() * 256)
    }
  }
  let out = ''
  for (const byte of bytes) out += String.fromCharCode(byte)
  return btoa(out)
}

function getOrCreateIdentity(): DeviceIdentity {
  const storedDeviceId = localStorage.getItem(DEVICE_ID_KEY)?.trim()
  const storedPub = localStorage.getItem(DEVICE_PUB_KEY)?.trim()
  const deviceId = storedDeviceId || createRandomToken('mobile')
  const publicKey = storedPub || createPublicKeyStub()
  localStorage.setItem(DEVICE_ID_KEY, deviceId)
  localStorage.setItem(DEVICE_PUB_KEY, publicKey)
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
  headers.set('content-type', 'application/json')
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

export default function App() {
  const [relayUrl, setRelayUrl] = useState(DEFAULT_RELAY_URL)
  const [relayApiKey, setRelayApiKey] = useState('')
  const [validation, setValidation] = useState<ValidationState>({ status: 'idle', message: '' })
  const [wellKnown, setWellKnown] = useState<WellKnownResponse | null>(null)
  const [pairingLink, setPairingLink] = useState('')
  const [confirmationCode, setConfirmationCode] = useState('')
  const [ownerId, setOwnerId] = useState('')
  const [pairingStatus, setPairingStatus] = useState<'idle' | 'claiming' | 'claimed' | 'approved' | 'error'>('idle')
  const [statusMessage, setStatusMessage] = useState('Not paired')
  const [devices, setDevices] = useState<ConnectedDevice[]>([])
  const [events, setEvents] = useState<string[]>([])
  const [threadId, setThreadId] = useState('mobile-thread')
  const identityRef = useRef<DeviceIdentity>(getOrCreateIdentity())
  const wsRef = useRef<WebSocket | null>(null)

  const normalizedRelayUrl = useMemo(() => normalizeUrl(relayUrl), [relayUrl])
  const mobileDeviceId = identityRef.current.deviceId
  const mobilePublicKey = identityRef.current.publicKey
  const targetDesktopDeviceId = useMemo(
    () => devices.find((item) => item.id !== mobileDeviceId && !item.revokedAt)?.id || '',
    [devices, mobileDeviceId]
  )

  useEffect(() => {
    const parsed = parsePairingFromCurrentUrl(window.location.href)
    if (parsed) {
      setPairingLink(`devscope://pair?pairingId=${encodeURIComponent(parsed.pairingId)}&token=${encodeURIComponent(parsed.token)}`)
    }
  }, [])

  useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.close()
        wsRef.current = null
      }
    }
  }, [])

  const pushEvent = (message: string) => {
    setEvents((prev) => [`${new Date().toLocaleTimeString()}  ${message}`, ...prev].slice(0, 120))
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
      if (wk.service !== 'devscope-relay') {
        throw new Error('Not a Devscope relay server.')
      }
      setWellKnown(wk)
      setValidation({
        status: 'ok',
        message: `Relay OK (${wk.relayKind}).`,
        fingerprint: wk.fingerprint
      })
      pushEvent(`Validated relay ${normalizedRelayUrl}`)
    } catch (error: any) {
      setValidation({ status: 'error', message: error?.message || 'Validation failed.' })
      pushEvent(`Validation error: ${error?.message || 'unknown error'}`)
    }
  }

  const claimPairing = async () => {
    const parsed = parsePairingDeepLink(pairingLink.trim())
    if (!parsed) {
      setPairingStatus('error')
      setStatusMessage('Invalid pairing deep-link payload.')
      return
    }
    const code = confirmationCode.trim()
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
            pairingId: parsed.pairingId,
            oneTimeToken: parsed.token,
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
    } catch (error: any) {
      setPairingStatus('error')
      setStatusMessage(error?.message || 'Unable to claim pairing.')
      pushEvent(`Pairing claim failed: ${error?.message || 'unknown error'}`)
    }
  }

  const fetchDevices = async (owner: string) => {
    if (!owner) return
    const response = await fetchJson<{ success: boolean; devices: ConnectedDevice[] }>(
      `${normalizedRelayUrl}/v1/devices/${encodeURIComponent(owner)}`,
      undefined,
      relayApiKey
    )
    setDevices(Array.isArray(response.devices) ? response.devices : [])
  }

  useEffect(() => {
    if (!ownerId || pairingStatus === 'error') return
    let cancelled = false
    const check = async () => {
      try {
        await fetchDevices(ownerId)
        if (cancelled) return
        const self = devices.find((item) => item.id === mobileDeviceId && !item.revokedAt)
        if (self && pairingStatus !== 'approved') {
          setPairingStatus('approved')
          setStatusMessage('Approved and linked.')
          pushEvent('Desktop approved this mobile device.')
        }
      } catch (error: any) {
        pushEvent(`Device refresh error: ${error?.message || 'unknown error'}`)
      }
    }

    void check()
    const timer = window.setInterval(() => {
      void check()
    }, 4000)

    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [ownerId, pairingStatus, mobileDeviceId, normalizedRelayUrl, relayApiKey, devices])

  const connectWebSocket = () => {
    if (!ownerId) {
      pushEvent('Set ownerId first by claiming a pairing.')
      return
    }
    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
    }
    const wsBase = toWsUrl(normalizedRelayUrl)
    const wsUrl = `${wsBase}?ownerId=${encodeURIComponent(ownerId)}&deviceId=${encodeURIComponent(mobileDeviceId)}`
    const ws = new WebSocket(wsUrl)
    wsRef.current = ws
    ws.onopen = () => pushEvent('Relay websocket connected.')
    ws.onclose = () => pushEvent('Relay websocket disconnected.')
    ws.onerror = () => pushEvent('Relay websocket error.')
    ws.onmessage = (event) => {
      const text = typeof event.data === 'string' ? event.data : '[binary]'
      pushEvent(`WS <- ${text.slice(0, 220)}`)
    }
  }

  const publishTestEnvelope = async () => {
    if (!ownerId || !targetDesktopDeviceId) {
      pushEvent('No desktop target found to publish test envelope.')
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
        ciphertext: btoa(`mobile-test:${Date.now()}`),
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
      pushEvent(`Published envelope. delivered=${result.delivered}`)
    } catch (error: any) {
      pushEvent(`Publish error: ${error?.message || 'unknown error'}`)
    }
  }

  return (
    <main className="page">
      <header className="card">
        <h1>Devscope Mobile Companion</h1>
        <p className="muted">Mobile web controller for desktop Devscope sessions.</p>
        <div className="pill-row">
          <span className="pill">Beta</span>
          <span className="pill">Controller Only</span>
          <span className="pill">E2EE Envelope</span>
        </div>
      </header>

      <section className="card">
        <h2>Relay Connection</h2>
        <label>
          Relay URL
          <input value={relayUrl} onChange={(e) => setRelayUrl(e.target.value)} placeholder="https://relay.example.com" />
        </label>
        <label>
          Relay API key (optional)
          <input value={relayApiKey} onChange={(e) => setRelayApiKey(e.target.value)} placeholder="x-devscope-relay-key" />
        </label>
        <button onClick={() => void validateServer()} disabled={validation.status === 'loading'}>
          {validation.status === 'loading' ? 'Validating...' : 'Validate Relay'}
        </button>
        {validation.status !== 'idle' && (
          <p className={`status ${validation.status}`}>{validation.message}{validation.fingerprint ? `  fingerprint=${validation.fingerprint}` : ''}</p>
        )}
        {wellKnown && (
          <p className="muted small">
            protocol={wellKnown.protocolVersion}  kind={wellKnown.relayKind}  capabilities={wellKnown.capabilities.join(', ')}
          </p>
        )}
      </section>

      <section className="card">
        <h2>Pairing Claim</h2>
        <p className="muted small">Paste desktop QR/deep-link payload and enter the same 6-digit code shown on desktop.</p>
        <label>
          Pairing link
          <textarea
            rows={3}
            value={pairingLink}
            onChange={(e) => setPairingLink(e.target.value)}
            placeholder="devscope://pair?pairingId=...&token=..."
          />
        </label>
        <label>
          Confirmation code
          <input
            value={confirmationCode}
            onChange={(e) => setConfirmationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder="123456"
          />
        </label>
        <button onClick={() => void claimPairing()} disabled={pairingStatus === 'claiming'}>
          {pairingStatus === 'claiming' ? 'Claiming...' : 'Claim Pairing'}
        </button>
        <p className={`status ${pairingStatus === 'error' ? 'error' : pairingStatus === 'approved' ? 'ok' : 'loading'}`}>{statusMessage}</p>
        <p className="muted small">mobileDeviceId={mobileDeviceId}</p>
      </section>

      <section className="card">
        <h2>Linked Devices</h2>
        <div className="actions">
          <input value={ownerId} onChange={(e) => setOwnerId(e.target.value.trim())} placeholder="ownerId" />
          <button onClick={() => void fetchDevices(ownerId)} disabled={!ownerId}>Refresh</button>
        </div>
        {devices.length === 0 && <p className="muted">No linked devices found.</p>}
        {devices.map((device) => (
          <article key={device.id} className="device-item">
            <strong>{device.label || device.id}</strong>
            <span className="muted small">{device.platform}  {device.id}</span>
            <span className="muted small">fingerprint={device.fingerprint}</span>
          </article>
        ))}
      </section>

      <section className="card">
        <h2>Relay Stream</h2>
        <div className="actions">
          <button onClick={connectWebSocket} disabled={!ownerId}>Connect WebSocket</button>
          <input value={threadId} onChange={(e) => setThreadId(e.target.value)} placeholder="threadId" />
          <button onClick={() => void publishTestEnvelope()} disabled={!ownerId}>Publish Test Envelope</button>
        </div>
        <div className="events">
          {events.length === 0 ? <p className="muted">No relay events yet.</p> : events.map((line, idx) => <p key={idx}>{line}</p>)}
        </div>
      </section>
    </main>
  )
}
