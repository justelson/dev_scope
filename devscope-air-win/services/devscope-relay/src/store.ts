import crypto from 'node:crypto'
import { randomUUID } from 'node:crypto'
import type { ConnectedDevice, PairingRecord, RelayEnvelopeV1 } from './types.js'

type RelaySocket = {
  readyState: number
  OPEN: number
  send: (data: string) => void
}

const PAIRING_TTL_MS = 5 * 60 * 1000

function randomDigits(length: number): string {
  let value = ''
  for (let index = 0; index < length; index += 1) {
    value += Math.floor(Math.random() * 10).toString()
  }
  return value
}

function fingerprintFromPublicKey(publicKey: string): string {
  return crypto.createHash('sha256').update(publicKey).digest('hex').slice(0, 24)
}

export class RelayStore {
  private readonly pairings = new Map<string, PairingRecord>()
  private readonly devicesByOwner = new Map<string, Map<string, ConnectedDevice>>()
  private readonly socketsByOwner = new Map<string, Map<string, Set<RelaySocket>>>()

  createPairing(input: {
    ownerId: string
    desktopDeviceId: string
    desktopPublicKey: string
    desktopLabel?: string
    deepLinkScheme: string
  }) {
    const now = Date.now()
    const pairingId = randomUUID()
    const oneTimeToken = randomUUID()
    const confirmationCode = randomDigits(6)

    const record: PairingRecord = {
      id: pairingId,
      ownerId: input.ownerId,
      desktopDeviceId: input.desktopDeviceId,
      desktopPublicKey: input.desktopPublicKey,
      desktopLabel: input.desktopLabel?.trim() || 'Desktop',
      deepLinkScheme: input.deepLinkScheme,
      oneTimeToken,
      confirmationCode,
      createdAt: now,
      expiresAt: now + PAIRING_TTL_MS,
      claimedAt: null,
      approvedAt: null,
      deniedAt: null,
      mobileDeviceId: null,
      mobilePublicKey: null,
      mobileLabel: null,
      mobilePlatform: 'unknown'
    }

    this.pairings.set(pairingId, record)
    return record
  }

  pruneExpiredPairings(now: number = Date.now()) {
    for (const [pairingId, record] of this.pairings.entries()) {
      if (record.expiresAt <= now) this.pairings.delete(pairingId)
    }
  }

  getPairing(pairingId: string): PairingRecord | null {
    const record = this.pairings.get(pairingId)
    if (!record) return null
    if (record.expiresAt <= Date.now()) {
      this.pairings.delete(pairingId)
      return null
    }
    return record
  }

  claimPairing(input: {
    pairingId: string
    oneTimeToken: string
    confirmationCode: string
    mobileDeviceId: string
    mobilePublicKey: string
    mobileLabel?: string
    mobilePlatform?: PairingRecord['mobilePlatform']
  }): PairingRecord | null {
    const record = this.getPairing(input.pairingId)
    if (!record) return null
    if (record.approvedAt || record.deniedAt) return null
    if (record.oneTimeToken !== input.oneTimeToken) return null
    if (record.confirmationCode !== input.confirmationCode) return null

    record.mobileDeviceId = input.mobileDeviceId
    record.mobilePublicKey = input.mobilePublicKey
    record.mobileLabel = input.mobileLabel?.trim() || 'Mobile device'
    record.mobilePlatform = input.mobilePlatform || 'unknown'
    record.claimedAt = Date.now()
    this.pairings.set(record.id, record)
    return record
  }

  approvePairing(pairingId: string, approved: boolean): { pairing: PairingRecord | null; device?: ConnectedDevice } {
    const record = this.getPairing(pairingId)
    if (!record) return { pairing: null }
    if (record.approvedAt || record.deniedAt) return { pairing: null }

    if (!approved) {
      record.deniedAt = Date.now()
      this.pairings.set(record.id, record)
      return { pairing: record }
    }

    if (!record.mobileDeviceId || !record.mobilePublicKey) {
      return { pairing: null }
    }

    record.approvedAt = Date.now()
    this.pairings.set(record.id, record)

    const device: ConnectedDevice = {
      id: record.mobileDeviceId,
      ownerId: record.ownerId,
      label: record.mobileLabel || 'Mobile device',
      platform: record.mobilePlatform,
      publicKey: record.mobilePublicKey,
      fingerprint: fingerprintFromPublicKey(record.mobilePublicKey),
      linkedAt: Date.now(),
      lastSeenAt: Date.now(),
      revokedAt: null
    }

    this.upsertDevice(device)
    return { pairing: record, device }
  }

  listDevices(ownerId: string): ConnectedDevice[] {
    const byId = this.devicesByOwner.get(ownerId)
    if (!byId) return []
    return Array.from(byId.values())
      .filter((entry) => entry.revokedAt == null)
      .sort((a, b) => b.lastSeenAt - a.lastSeenAt)
  }

  revokeDevice(ownerId: string, deviceId: string): boolean {
    const byId = this.devicesByOwner.get(ownerId)
    if (!byId) return false
    const device = byId.get(deviceId)
    if (!device) return false
    device.revokedAt = Date.now()
    byId.set(deviceId, device)
    return true
  }

  upsertDevice(device: ConnectedDevice) {
    let byId = this.devicesByOwner.get(device.ownerId)
    if (!byId) {
      byId = new Map<string, ConnectedDevice>()
      this.devicesByOwner.set(device.ownerId, byId)
    }
    byId.set(device.id, device)
  }

  touchDevice(ownerId: string, deviceId: string) {
    const byId = this.devicesByOwner.get(ownerId)
    if (!byId) return
    const device = byId.get(deviceId)
    if (!device) return
    device.lastSeenAt = Date.now()
    byId.set(deviceId, device)
  }

  registerSocket(ownerId: string, deviceId: string, socket: RelaySocket) {
    let byDevice = this.socketsByOwner.get(ownerId)
    if (!byDevice) {
      byDevice = new Map<string, Set<RelaySocket>>()
      this.socketsByOwner.set(ownerId, byDevice)
    }

    let sockets = byDevice.get(deviceId)
    if (!sockets) {
      sockets = new Set<RelaySocket>()
      byDevice.set(deviceId, sockets)
    }
    sockets.add(socket)
  }

  unregisterSocket(ownerId: string, deviceId: string, socket: RelaySocket) {
    const byDevice = this.socketsByOwner.get(ownerId)
    if (!byDevice) return
    const sockets = byDevice.get(deviceId)
    if (!sockets) return
    sockets.delete(socket)
    if (sockets.size === 0) byDevice.delete(deviceId)
    if (byDevice.size === 0) this.socketsByOwner.delete(ownerId)
  }

  publishEnvelope(envelope: RelayEnvelopeV1): number {
    const byDevice = this.socketsByOwner.get(envelope.ownerId)
    if (!byDevice) return 0

    let delivered = 0
    for (const [deviceId, sockets] of byDevice.entries()) {
      if (deviceId !== envelope.toDeviceId && envelope.toDeviceId !== '*') continue
      const payload = JSON.stringify({ type: 'relay/envelope', envelope })
      for (const socket of sockets) {
        if (socket.readyState !== socket.OPEN) continue
        socket.send(payload)
        delivered += 1
      }
    }

    return delivered
  }

  issueChallenge(nonce: string, relaySecret: string): string {
    return crypto.createHmac('sha256', relaySecret).update(nonce).digest('hex')
  }
}
