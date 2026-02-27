import { ipcRenderer } from 'electron'

export function createRemoteAccessAdapter() {
    return {
        remoteAccess: {
            validateServer: (serverUrl: string) =>
                ipcRenderer.invoke('devscope:remote:validateServer', { serverUrl }),
            challengeServer: (input: { serverUrl: string; nonce: string; relayApiKey?: string }) =>
                ipcRenderer.invoke('devscope:remote:challengeServer', input),
            createPairing: (input: {
                serverUrl: string
                relayApiKey?: string
                ownerId: string
                desktopDeviceId: string
                desktopPublicKey: string
                desktopLabel?: string
                deepLinkScheme?: string
            }) => ipcRenderer.invoke('devscope:remote:createPairing', input),
            claimPairing: (input: {
                serverUrl: string
                relayApiKey?: string
                pairingId: string
                oneTimeToken: string
                confirmationCode: string
                mobileDeviceId: string
                mobilePublicKey: string
                mobileLabel?: string
                mobilePlatform?: 'ios' | 'android' | 'web' | 'desktop' | 'unknown'
            }) => ipcRenderer.invoke('devscope:remote:claimPairing', input),
            approvePairing: (input: {
                serverUrl: string
                relayApiKey?: string
                pairingId: string
                ownerId: string
                approved: boolean
            }) => ipcRenderer.invoke('devscope:remote:approvePairing', input),
            listDevices: (input: { serverUrl: string; ownerId: string; relayApiKey?: string }) =>
                ipcRenderer.invoke('devscope:remote:listDevices', input),
            revokeDevice: (input: { serverUrl: string; ownerId: string; deviceId: string; relayApiKey?: string }) =>
                ipcRenderer.invoke('devscope:remote:revokeDevice', input),
            publishEnvelope: (input: {
                serverUrl: string
                relayApiKey?: string
                envelope: {
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
            }) => ipcRenderer.invoke('devscope:remote:publishEnvelope', input)
        }
    }
}
