# Remote Access Phase 1-2 (Cloud + Self-Hosted + Mobile)

Date: February 27, 2026

## Scope Delivered
- Opt-in-only remote access settings model in app state.
- Dedicated `Settings -> Remote Access` page with:
  - explicit consent gate
  - mode selection (`Local only`, `Devscope Cloud`, `Self-hosted`)
  - relay compatibility validation (`/.well-known/devscope`)
  - connected-device management UI
- Shared remote-access protocol contract in `src/shared/contracts/remote-access.ts`.
- Deployable relay service scaffold in `services/devscope-relay`.
- App-side relay bridge via Electron IPC/preload (`window.devscope.remoteAccess.*`), removing direct renderer fetch dependency.
- Basic relay hardening scaffold:
  - optional API key gate (`RELAY_API_KEY`)
  - per-IP in-memory rate limits
  - periodic pairing TTL pruning

## Trust Model
- Default is local-only.
- Remote access is disabled until user opts in.
- Pairing requires QR token + confirmation code + explicit desktop approval.
- Payload routing is designed for E2EE envelope pass-through.

## Server Validation Layer
Client compatibility checks:
1. `GET /.well-known/devscope`
2. Ensure `service === "devscope-relay"`
3. Ensure required capability includes `e2ee-envelope-v1`
4. Optionally verify challenge signature via `POST /v1/validation/challenge`

## Mobile Client Flow
1. Desktop creates pairing (`POST /v1/pairings`) and shows QR + code.
2. Mobile scans QR and claims pairing (`POST /v1/pairings/claim`).
3. Desktop approves pairing (`POST /v1/pairings/approve`).
4. Both devices establish relay websocket sessions.
5. Encrypted envelopes are routed with `/v1/relay/ws` or `/v1/relay/publish`.

## Next Implementation Track (Phase 3)
- Replace in-memory relay store with Postgres + Redis-backed persistence.
- Add auth/session tokens and refresh rotation.
- Implement desktop background relay websocket client (always-on when remote enabled).
- Implement production mobile app shell consuming this protocol.
