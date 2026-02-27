# Devscope Mobile Companion (Web MVP)

Mobile-first web controller for Devscope remote access.

## What this app does now
- Validates relay server (`/health`, `/.well-known/devscope`).
- Claims pairing from desktop QR/deep-link payload.
- Polls linked devices until desktop approval is visible.
- Connects to relay websocket and shows incoming events.
- Sends a test relay envelope to a desktop device.

## Quick start
1. `cd apps/mobile-companion`
2. `npm install`
3. `npm run dev`
4. Open the printed local URL on phone browser (same network), or deploy to Vercel.

## Pairing format
`devscope://pair?pairingId=<id>&token=<oneTimeToken>`

## Current limits
- This is a Beta MVP UI, not the final production mobile app.
- Envelope payload is stubbed test data (no full message encryption yet).
- Device revoke/rename controls are not implemented yet.

## Contract source of truth
`src/shared/contracts/remote-access.ts`
