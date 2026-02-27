export type RelayKind = 'devscope-cloud' | 'self-hosted'

export type DevicePlatform = 'ios' | 'android' | 'web' | 'desktop' | 'unknown'

export interface PairingRecord {
  id: string
  ownerId: string
  desktopDeviceId: string
  desktopPublicKey: string
  desktopLabel: string
  deepLinkScheme: string
  oneTimeToken: string
  confirmationCode: string
  createdAt: number
  expiresAt: number
  claimedAt: number | null
  approvedAt: number | null
  deniedAt: number | null
  mobileDeviceId: string | null
  mobilePublicKey: string | null
  mobileLabel: string | null
  mobilePlatform: DevicePlatform
}

export interface ConnectedDevice {
  id: string
  ownerId: string
  label: string
  platform: DevicePlatform
  publicKey: string
  fingerprint: string
  linkedAt: number
  lastSeenAt: number
  revokedAt: number | null
}

export interface RelayEnvelopeV1 {
  v: 1
  ownerId: string
  threadId: string
  fromDeviceId: string
  toDeviceId: string
  nonce: string
  ciphertext: string
  authTag: string
  sentAt: number
}
