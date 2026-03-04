# Devscope Mobile Companion (Scaffold)

This folder documents the mobile client contract for remote access.

## Required Capabilities
- Scan QR pairing payload from desktop.
- Enter/confirm short code before linking.
- Show connected device state and revoke status.
- Open relay websocket and exchange encrypted envelopes.

## Deep Link Format
`devscope://pair?pairingId=<id>&token=<oneTimeToken>`

## API Contract
Use `src/shared/contracts/remote-access.ts` as the single source of truth.

## Minimal Mobile Sequence
1. Parse deep-link payload.
2. Prompt user to confirm displayed 6-digit code.
3. Call `POST /v1/pairings/claim`.
4. Wait for desktop approval.
5. Connect websocket: `/v1/relay/ws?ownerId=...&deviceId=...`.

## Security Expectations
- Generate device keypair locally on mobile.
- Never send private keys to relay.
- Encrypt session payloads before `relay/publish`.
