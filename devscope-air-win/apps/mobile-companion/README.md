# Devscope Mobile Companion (Web)

Deployable mobile web client for remote access pairing and relay validation.

## Delivered scope
- Relay validation (`/health`, `/.well-known/devscope`)
- Pairing claim (`/v1/pairings/claim`)
- Linked device polling (`/v1/devices/:ownerId`)
- Relay websocket connectivity (`/v1/relay/ws`)
- Test envelope publish (`/v1/relay/publish`)
- Persistent device identity in local storage

## Local run
1. `cd apps/mobile-companion`
2. `npm install`
3. Copy `.env.example` to `.env` and adjust values if needed
4. `npm run dev`

## Vercel deploy
1. Import this repository in Vercel.
2. Set project **Root Directory** to `apps/mobile-companion`.
3. Build settings:
   - Build command: `npm run build`
   - Output directory: `dist`
4. Add environment variables:
   - `VITE_DEVSCOPE_RELAY_URL` (required)
   - `VITE_DEVSCOPE_RELAY_API_KEY` (optional)
5. Deploy.

## Connect phone workflow
1. Open desktop app `Settings -> Remote Access`.
2. Validate relay server and generate pairing.
3. On mobile web app:
   - paste pairing deep-link and click `Parse Link`, or
   - paste `pairingId` + `oneTimeToken` directly.
4. Enter desktop confirmation code and click `Claim Pairing`.
5. Wait for desktop approval (device appears in linked devices).
6. Connect websocket and publish a test envelope to verify live relay path.

## Pairing URL support
- `devscope://pair?pairingId=<id>&token=<token>`
- Web query params:
  - `https://<mobile-web-app>/?pairingId=<id>&token=<token>`

## Notes
- This is Beta and focused on connection validation and control flow.
- Production E2EE message crypto integration remains a follow-up phase.
