import log from 'electron-log'

type JsonRecord = Record<string, unknown>

function normalizeServerUrl(raw: unknown): string {
    return typeof raw === 'string' ? raw.trim().replace(/\/+$/, '') : ''
}

function isLocalHttp(url: URL): boolean {
    return url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname)
}

function resolveBaseUrl(raw: unknown): URL {
    const normalized = normalizeServerUrl(raw)
    if (!normalized) throw new Error('serverUrl is required.')
    const parsed = new URL(normalized)
    if (parsed.protocol !== 'https:' && !isLocalHttp(parsed)) {
        throw new Error('Remote relay must use HTTPS (except localhost for local development).')
    }
    return parsed
}

async function relayJsonRequest<T extends JsonRecord = JsonRecord>(
    serverUrl: unknown,
    path: string,
    init?: RequestInit
): Promise<T> {
    const base = resolveBaseUrl(serverUrl)
    const target = new URL(path, `${base.toString()}/`)
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 10000)

    try {
        const response = await fetch(target, {
            ...init,
            signal: controller.signal,
            headers: {
                Accept: 'application/json',
                ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
                ...(init?.headers || {})
            }
        })

        const text = await response.text()
        let payload: JsonRecord = {}
        if (text) {
            try {
                payload = JSON.parse(text) as JsonRecord
            } catch {
                payload = { raw: text }
            }
        }

        if (!response.ok) {
            const message = typeof payload.error === 'string'
                ? payload.error
                : `Remote relay request failed: ${response.status} ${response.statusText}`
            throw new Error(message)
        }

        return payload as T
    } finally {
        clearTimeout(timeout)
    }
}

function withRelayApiKeyHeader(relayApiKey?: string): Record<string, string> {
    const key = typeof relayApiKey === 'string' ? relayApiKey.trim() : ''
    if (!key) return {}
    return { 'x-devscope-relay-key': key }
}

function asErrorMessage(error: unknown): string {
    if (error instanceof Error && error.message) return error.message
    return 'Unexpected remote relay error.'
}

export async function handleRemoteValidateServer(
    _event: Electron.IpcMainInvokeEvent,
    input: { serverUrl?: string }
) {
    try {
        const payload = await relayJsonRequest(input?.serverUrl, '/.well-known/devscope')
        if (payload.service !== 'devscope-relay') {
            return { success: false, error: 'Server responded but is not a compatible Devscope relay.' }
        }
        return { success: true, wellKnown: payload }
    } catch (error) {
        log.warn('remote validate failed', error)
        return { success: false, error: asErrorMessage(error) }
    }
}

export async function handleRemoteChallengeServer(
    _event: Electron.IpcMainInvokeEvent,
    input: { serverUrl?: string; nonce?: string; relayApiKey?: string }
) {
    try {
        const nonce = String(input?.nonce || '').trim()
        if (!nonce) return { success: false, error: 'nonce is required.' }
        const payload = await relayJsonRequest<{ success?: boolean; signature?: string; fingerprint?: string; algorithm?: string; error?: string }>(
            input?.serverUrl,
            '/v1/validation/challenge',
            {
                method: 'POST',
                body: JSON.stringify({ nonce }),
                headers: withRelayApiKeyHeader(input?.relayApiKey)
            }
        )
        if (payload.success === false) return { success: false, error: payload.error || 'Challenge failed.' }
        return {
            success: true,
            signature: typeof payload.signature === 'string' ? payload.signature : '',
            fingerprint: typeof payload.fingerprint === 'string' ? payload.fingerprint : '',
            algorithm: typeof payload.algorithm === 'string' ? payload.algorithm : 'hmac-sha256'
        }
    } catch (error) {
        log.warn('remote challenge failed', error)
        return { success: false, error: asErrorMessage(error) }
    }
}

export async function handleRemoteCreatePairing(
    _event: Electron.IpcMainInvokeEvent,
    input: {
        serverUrl?: string
        relayApiKey?: string
        ownerId?: string
        desktopDeviceId?: string
        desktopPublicKey?: string
        desktopLabel?: string
        deepLinkScheme?: string
    }
) {
    try {
        const payload = await relayJsonRequest<{
            success?: boolean
            pairingId?: string
            oneTimeToken?: string
            confirmationCode?: string
            qrPayload?: string
            expiresAt?: number
            error?: string
        }>(
            input?.serverUrl,
            '/v1/pairings',
            {
                method: 'POST',
                body: JSON.stringify({
                    ownerId: String(input?.ownerId || '').trim(),
                    desktopDeviceId: String(input?.desktopDeviceId || '').trim(),
                    desktopPublicKey: String(input?.desktopPublicKey || '').trim(),
                    desktopLabel: typeof input?.desktopLabel === 'string' ? input.desktopLabel : undefined,
                    deepLinkScheme: typeof input?.deepLinkScheme === 'string' ? input.deepLinkScheme : undefined
                }),
                headers: withRelayApiKeyHeader(input?.relayApiKey)
            }
        )
        if (payload.success === false) return { success: false, error: payload.error || 'Pairing creation failed.' }
        return {
            success: true,
            pairingId: String(payload.pairingId || ''),
            oneTimeToken: String(payload.oneTimeToken || ''),
            confirmationCode: String(payload.confirmationCode || ''),
            qrPayload: String(payload.qrPayload || ''),
            expiresAt: Number(payload.expiresAt) || Date.now()
        }
    } catch (error) {
        log.warn('remote createPairing failed', error)
        return { success: false, error: asErrorMessage(error) }
    }
}

export async function handleRemoteClaimPairing(
    _event: Electron.IpcMainInvokeEvent,
    input: {
        serverUrl?: string
        relayApiKey?: string
        pairingId?: string
        oneTimeToken?: string
        confirmationCode?: string
        mobileDeviceId?: string
        mobilePublicKey?: string
        mobileLabel?: string
        mobilePlatform?: 'ios' | 'android' | 'web' | 'desktop' | 'unknown'
    }
) {
    try {
        const payload = await relayJsonRequest<{
            success?: boolean
            pairingId?: string
            claimedAt?: number
            ownerId?: string
            error?: string
        }>(
            input?.serverUrl,
            '/v1/pairings/claim',
            {
                method: 'POST',
                body: JSON.stringify({
                    pairingId: String(input?.pairingId || '').trim(),
                    oneTimeToken: String(input?.oneTimeToken || '').trim(),
                    confirmationCode: String(input?.confirmationCode || '').trim(),
                    mobileDeviceId: String(input?.mobileDeviceId || '').trim(),
                    mobilePublicKey: String(input?.mobilePublicKey || '').trim(),
                    mobileLabel: typeof input?.mobileLabel === 'string' ? input.mobileLabel : undefined,
                    mobilePlatform: input?.mobilePlatform
                }),
                headers: withRelayApiKeyHeader(input?.relayApiKey)
            }
        )
        if (payload.success === false) return { success: false, error: payload.error || 'Pairing claim failed.' }
        return {
            success: true,
            pairingId: String(payload.pairingId || ''),
            claimedAt: Number(payload.claimedAt) || Date.now(),
            ownerId: String(payload.ownerId || '')
        }
    } catch (error) {
        log.warn('remote claimPairing failed', error)
        return { success: false, error: asErrorMessage(error) }
    }
}

export async function handleRemoteApprovePairing(
    _event: Electron.IpcMainInvokeEvent,
    input: {
        serverUrl?: string
        relayApiKey?: string
        pairingId?: string
        ownerId?: string
        approved?: boolean
    }
) {
    try {
        const payload = await relayJsonRequest<{
            success?: boolean
            pairingId?: string
            approved?: boolean
            device?: JsonRecord | null
            error?: string
        }>(
            input?.serverUrl,
            '/v1/pairings/approve',
            {
                method: 'POST',
                body: JSON.stringify({
                    pairingId: String(input?.pairingId || '').trim(),
                    ownerId: String(input?.ownerId || '').trim(),
                    approved: Boolean(input?.approved)
                }),
                headers: withRelayApiKeyHeader(input?.relayApiKey)
            }
        )
        if (payload.success === false) return { success: false, error: payload.error || 'Pairing approval failed.' }
        return {
            success: true,
            pairingId: String(payload.pairingId || ''),
            approved: Boolean(payload.approved),
            device: payload.device || null
        }
    } catch (error) {
        log.warn('remote approvePairing failed', error)
        return { success: false, error: asErrorMessage(error) }
    }
}

export async function handleRemoteListDevices(
    _event: Electron.IpcMainInvokeEvent,
    input: { serverUrl?: string; ownerId?: string; relayApiKey?: string }
) {
    try {
        const ownerId = String(input?.ownerId || '').trim()
        if (!ownerId) return { success: false, error: 'ownerId is required.' }
        const encodedOwner = encodeURIComponent(ownerId)
        const payload = await relayJsonRequest<{ success?: boolean; devices?: JsonRecord[]; error?: string }>(
            input?.serverUrl,
            `/v1/devices/${encodedOwner}`,
            { method: 'GET', headers: withRelayApiKeyHeader(input?.relayApiKey) }
        )
        if (payload.success === false) return { success: false, error: payload.error || 'Listing devices failed.' }
        return { success: true, devices: Array.isArray(payload.devices) ? payload.devices : [] }
    } catch (error) {
        log.warn('remote listDevices failed', error)
        return { success: false, error: asErrorMessage(error) }
    }
}

export async function handleRemoteRevokeDevice(
    _event: Electron.IpcMainInvokeEvent,
    input: { serverUrl?: string; ownerId?: string; deviceId?: string; relayApiKey?: string }
) {
    try {
        const ownerId = encodeURIComponent(String(input?.ownerId || '').trim())
        const deviceId = encodeURIComponent(String(input?.deviceId || '').trim())
        if (!ownerId || !deviceId) return { success: false, error: 'ownerId and deviceId are required.' }
        const payload = await relayJsonRequest<{ success?: boolean; error?: string }>(
            input?.serverUrl,
            `/v1/devices/${ownerId}/${deviceId}`,
            { method: 'DELETE', headers: withRelayApiKeyHeader(input?.relayApiKey) }
        )
        if (payload.success === false) return { success: false, error: payload.error || 'Device revoke failed.' }
        return { success: true }
    } catch (error) {
        log.warn('remote revokeDevice failed', error)
        return { success: false, error: asErrorMessage(error) }
    }
}

export async function handleRemotePublishEnvelope(
    _event: Electron.IpcMainInvokeEvent,
    input: { serverUrl?: string; relayApiKey?: string; envelope?: JsonRecord }
) {
    try {
        const payload = await relayJsonRequest<{ success?: boolean; delivered?: number; error?: string }>(
            input?.serverUrl,
            '/v1/relay/publish',
            {
                method: 'POST',
                body: JSON.stringify({ envelope: input?.envelope || {} }),
                headers: withRelayApiKeyHeader(input?.relayApiKey)
            }
        )
        if (payload.success === false) return { success: false, error: payload.error || 'Publish failed.' }
        return { success: true, delivered: Number(payload.delivered) || 0 }
    } catch (error) {
        log.warn('remote publishEnvelope failed', error)
        return { success: false, error: asErrorMessage(error) }
    }
}
