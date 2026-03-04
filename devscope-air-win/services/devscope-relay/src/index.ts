import Fastify from 'fastify'
import cors from '@fastify/cors'
import websocket from '@fastify/websocket'
import { z } from 'zod'
import { loadConfig } from './config.js'
import { RelayStore } from './store.js'
import type { RelayEnvelopeV1 } from './types.js'

const config = loadConfig(process.env)
const store = new RelayStore()

const app = Fastify({
  logger: {
    level: config.nodeEnv === 'development' ? 'info' : 'warn'
  }
})

const rateLimitBuckets = new Map<string, { count: number; resetAt: number }>()

function getClientKey(request: { ip: string; headers: Record<string, unknown> }) {
  const forwarded = request.headers['x-forwarded-for']
  if (typeof forwarded === 'string' && forwarded.trim()) {
    return forwarded.split(',')[0]?.trim() || request.ip || 'unknown'
  }
  return request.ip || 'unknown'
}

function enforceRateLimit(request: { ip: string; headers: Record<string, unknown> }, limit: number) {
  const key = getClientKey(request)
  const now = Date.now()
  const bucket = rateLimitBuckets.get(key)
  if (!bucket || bucket.resetAt <= now) {
    rateLimitBuckets.set(key, { count: 1, resetAt: now + 60_000 })
    return { ok: true as const, retryAfterMs: 0 }
  }
  if (bucket.count >= limit) {
    return { ok: false as const, retryAfterMs: Math.max(0, bucket.resetAt - now) }
  }
  bucket.count += 1
  rateLimitBuckets.set(key, bucket)
  return { ok: true as const, retryAfterMs: 0 }
}

function enforceApiKey(headers: Record<string, unknown>, expectedApiKey: string): boolean {
  if (!expectedApiKey) return true
  const provided = headers['x-devscope-relay-key']
  return typeof provided === 'string' && provided.trim() === expectedApiKey
}

await app.register(cors, {
  origin: true,
  credentials: false
})

await app.register(websocket)

const pairingCreateSchema = z.object({
  ownerId: z.string().min(1),
  desktopDeviceId: z.string().min(1),
  desktopPublicKey: z.string().min(1),
  desktopLabel: z.string().optional(),
  deepLinkScheme: z.string().optional()
})

const pairingClaimSchema = z.object({
  pairingId: z.string().min(1),
  oneTimeToken: z.string().min(1),
  confirmationCode: z.string().length(6),
  mobileDeviceId: z.string().min(1),
  mobilePublicKey: z.string().min(1),
  mobileLabel: z.string().optional(),
  mobilePlatform: z.enum(['ios', 'android', 'web', 'desktop', 'unknown']).optional()
})

const pairingApproveSchema = z.object({
  pairingId: z.string().min(1),
  ownerId: z.string().min(1),
  approved: z.boolean()
})

const publishSchema = z.object({
  envelope: z.object({
    v: z.literal(1),
    ownerId: z.string().min(1),
    threadId: z.string().min(1),
    fromDeviceId: z.string().min(1),
    toDeviceId: z.string().min(1),
    nonce: z.string().min(1),
    ciphertext: z.string().min(1),
    authTag: z.string().min(1),
    sentAt: z.number().int()
  })
})

const challengeSchema = z.object({
  nonce: z.string().min(8).max(256)
})

app.get('/health', async () => ({
  ok: true,
  service: 'devscope-relay',
  now: new Date().toISOString()
}))

app.get('/.well-known/devscope', async () => ({
  service: 'devscope-relay',
  protocolVersion: '2026-02-27',
  relayKind: config.relayKind,
  capabilities: ['pairing', 'device-management', 'relay-websocket', 'e2ee-envelope-v1'],
  requiresTls: true,
  requiresE2EE: true,
  environment: config.nodeEnv,
  fingerprint: config.relayFingerprint,
  issuedAt: new Date().toISOString()
}))

app.post('/v1/validation/challenge', async (request, reply) => {
  const rate = enforceRateLimit(request, config.rateLimitMaxPerMinute)
  if (!rate.ok) {
    return reply.code(429).send({
      success: false,
      error: `Rate limit exceeded. Retry in ${Math.ceil(rate.retryAfterMs / 1000)}s.`
    })
  }

  const parsed = challengeSchema.safeParse(request.body)
  if (!parsed.success) {
    return reply.code(400).send({
      success: false,
      error: 'Invalid challenge payload.'
    })
  }

  const signature = store.issueChallenge(parsed.data.nonce, config.relaySecret)
  return {
    success: true,
    algorithm: 'hmac-sha256',
    signature,
    fingerprint: config.relayFingerprint
  }
})

app.post('/v1/pairings', async (request, reply) => {
  if (!enforceApiKey(request.headers as Record<string, unknown>, config.relayApiKey)) {
    return reply.code(401).send({ success: false, error: 'Invalid relay API key.' })
  }
  const rate = enforceRateLimit(request, config.rateLimitMaxPerMinute)
  if (!rate.ok) {
    return reply.code(429).send({
      success: false,
      error: `Rate limit exceeded. Retry in ${Math.ceil(rate.retryAfterMs / 1000)}s.`
    })
  }

  const parsed = pairingCreateSchema.safeParse(request.body)
  if (!parsed.success) {
    return reply.code(400).send({
      success: false,
      error: 'Invalid pairing create payload.'
    })
  }

  const pairing = store.createPairing({
    ...parsed.data,
    deepLinkScheme: parsed.data.deepLinkScheme || config.deepLinkScheme
  })
  const qrPayload = `${pairing.deepLinkScheme}://pair?pairingId=${encodeURIComponent(pairing.id)}&token=${encodeURIComponent(pairing.oneTimeToken)}`
  return {
    success: true,
    pairingId: pairing.id,
    oneTimeToken: pairing.oneTimeToken,
    confirmationCode: pairing.confirmationCode,
    qrPayload,
    expiresAt: pairing.expiresAt
  }
})

app.post('/v1/pairings/claim', async (request, reply) => {
  const rate = enforceRateLimit(request, config.rateLimitMaxPerMinute)
  if (!rate.ok) {
    return reply.code(429).send({
      success: false,
      error: `Rate limit exceeded. Retry in ${Math.ceil(rate.retryAfterMs / 1000)}s.`
    })
  }

  const parsed = pairingClaimSchema.safeParse(request.body)
  if (!parsed.success) {
    return reply.code(400).send({
      success: false,
      error: 'Invalid pairing claim payload.'
    })
  }

  const pairing = store.claimPairing(parsed.data)
  if (!pairing) {
    return reply.code(400).send({
      success: false,
      error: 'Pairing claim failed (invalid token/code or expired pairing).'
    })
  }

  return {
    success: true,
    pairingId: pairing.id,
    claimedAt: pairing.claimedAt,
    ownerId: pairing.ownerId
  }
})

app.post('/v1/pairings/approve', async (request, reply) => {
  if (!enforceApiKey(request.headers as Record<string, unknown>, config.relayApiKey)) {
    return reply.code(401).send({ success: false, error: 'Invalid relay API key.' })
  }
  const rate = enforceRateLimit(request, config.rateLimitMaxPerMinute)
  if (!rate.ok) {
    return reply.code(429).send({
      success: false,
      error: `Rate limit exceeded. Retry in ${Math.ceil(rate.retryAfterMs / 1000)}s.`
    })
  }

  const parsed = pairingApproveSchema.safeParse(request.body)
  if (!parsed.success) {
    return reply.code(400).send({
      success: false,
      error: 'Invalid pairing approval payload.'
    })
  }

  const pairing = store.getPairing(parsed.data.pairingId)
  if (!pairing || pairing.ownerId !== parsed.data.ownerId) {
    return reply.code(404).send({
      success: false,
      error: 'Pairing not found.'
    })
  }

  const approval = store.approvePairing(parsed.data.pairingId, parsed.data.approved)
  if (!approval.pairing) {
    return reply.code(400).send({
      success: false,
      error: 'Pairing approval failed.'
    })
  }

  return {
    success: true,
    pairingId: approval.pairing.id,
    approved: Boolean(approval.pairing.approvedAt),
    device: approval.device ?? null
  }
})

app.get('/v1/devices/:ownerId', async (request) => {
  const ownerId = String((request.params as Record<string, unknown>).ownerId || '').trim()
  const devices = ownerId ? store.listDevices(ownerId) : []
  return {
    success: true,
    devices
  }
})

app.delete('/v1/devices/:ownerId/:deviceId', async (request, reply) => {
  if (!enforceApiKey(request.headers as Record<string, unknown>, config.relayApiKey)) {
    return reply.code(401).send({ success: false, error: 'Invalid relay API key.' })
  }
  const params = request.params as Record<string, unknown>
  const ownerId = String(params.ownerId || '').trim()
  const deviceId = String(params.deviceId || '').trim()
  if (!ownerId || !deviceId) {
    return reply.code(400).send({ success: false, error: 'ownerId and deviceId are required.' })
  }

  const revoked = store.revokeDevice(ownerId, deviceId)
  if (!revoked) {
    return reply.code(404).send({ success: false, error: 'Device not found.' })
  }

  return { success: true }
})

app.post('/v1/relay/publish', async (request, reply) => {
  const rate = enforceRateLimit(request, config.rateLimitMaxPerMinute)
  if (!rate.ok) {
    return reply.code(429).send({
      success: false,
      error: `Rate limit exceeded. Retry in ${Math.ceil(rate.retryAfterMs / 1000)}s.`
    })
  }
  const parsed = publishSchema.safeParse(request.body)
  if (!parsed.success) {
    return reply.code(400).send({ success: false, error: 'Invalid relay envelope payload.' })
  }

  const envelope = parsed.data.envelope as RelayEnvelopeV1
  const delivered = store.publishEnvelope(envelope)
  return { success: true, delivered }
})

app.get('/v1/relay/ws', { websocket: true }, (connection, request) => {
  const query = request.query as Record<string, unknown>
  const ownerId = String(query.ownerId || '').trim()
  const deviceId = String(query.deviceId || '').trim()

  if (!ownerId || !deviceId) {
    connection.socket.close(1008, 'ownerId and deviceId required')
    return
  }

  store.registerSocket(ownerId, deviceId, connection.socket)
  store.touchDevice(ownerId, deviceId)

  connection.socket.send(JSON.stringify({
    type: 'relay/connected',
    ownerId,
    deviceId,
    now: Date.now()
  }))

  connection.socket.on('message', (raw: Buffer) => {
    let payload: unknown
    try {
      payload = JSON.parse(raw.toString('utf8'))
    } catch {
      connection.socket.send(JSON.stringify({ type: 'relay/error', error: 'Invalid JSON payload.' }))
      return
    }

    const parsed = publishSchema.safeParse(payload)
    if (!parsed.success) {
      connection.socket.send(JSON.stringify({ type: 'relay/error', error: 'Invalid envelope message.' }))
      return
    }

    const envelope = parsed.data.envelope as RelayEnvelopeV1
    store.touchDevice(ownerId, deviceId)
    const delivered = store.publishEnvelope(envelope)
    connection.socket.send(JSON.stringify({
      type: 'relay/ack',
      delivered,
      threadId: envelope.threadId,
      sentAt: envelope.sentAt
    }))
  })

  connection.socket.on('close', () => {
    store.unregisterSocket(ownerId, deviceId, connection.socket)
  })
})

setInterval(() => {
  store.pruneExpiredPairings()
  const now = Date.now()
  for (const [key, bucket] of rateLimitBuckets.entries()) {
    if (bucket.resetAt <= now) rateLimitBuckets.delete(key)
  }
}, 30_000).unref()

app.setErrorHandler((error, _request, reply) => {
  app.log.error(error)
  reply.code(500).send({
    success: false,
    error: 'Internal relay server error.'
  })
})

app
  .listen({ port: config.port, host: config.host })
  .then(() => {
    app.log.info(`relay listening on ${config.host}:${config.port}`)
  })
  .catch((error) => {
    app.log.error(error)
    process.exit(1)
  })
