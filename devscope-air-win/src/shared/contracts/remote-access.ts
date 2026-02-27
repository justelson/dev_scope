export const REMOTE_ACCESS_PROTOCOL_VERSION = '2026-02-27'

export type RemoteRelayKind = 'devscope-cloud' | 'self-hosted'
export type RemoteRelayCapability =
    | 'pairing'
    | 'device-management'
    | 'relay-websocket'
    | 'e2ee-envelope-v1'

export type RemoteDevicePlatform = 'ios' | 'android' | 'web' | 'desktop' | 'unknown'

export interface RemoteWellKnownResponse {
    service: 'devscope-relay'
    protocolVersion: string
    relayKind: RemoteRelayKind
    capabilities: RemoteRelayCapability[]
    requiresTls: boolean
    requiresE2EE: boolean
    environment: 'development' | 'staging' | 'production'
    fingerprint: string
    issuedAt: string
}

export interface RemoteE2EEEnvelopeV1 {
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

export interface RemotePairingCreateRequest {
    ownerId: string
    desktopDeviceId: string
    desktopPublicKey: string
    desktopLabel?: string
    deepLinkScheme?: string
}

export interface RemotePairingCreateResponse {
    pairingId: string
    oneTimeToken: string
    confirmationCode: string
    qrPayload: string
    expiresAt: number
}

export interface RemotePairingClaimRequest {
    pairingId: string
    oneTimeToken: string
    confirmationCode: string
    mobileDeviceId: string
    mobilePublicKey: string
    mobileLabel?: string
    mobilePlatform?: RemoteDevicePlatform
}

export interface RemotePairingApproveRequest {
    pairingId: string
    ownerId: string
    approved: boolean
}

export interface RemoteConnectedDevice {
    id: string
    ownerId: string
    label: string
    platform: RemoteDevicePlatform
    publicKey: string
    fingerprint: string
    linkedAt: number
    lastSeenAt: number
    revokedAt: number | null
}
