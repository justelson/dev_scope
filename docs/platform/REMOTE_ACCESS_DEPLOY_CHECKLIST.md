# Remote Access Deployment Checklist

Use this after pulling branch `feature/remote-access-opt-in`.

## 1) Deploy Relay Service
1. Create a Railway project for `services/devscope-relay`.
2. Set environment variables:
   - `RELAY_KIND=devscope-cloud` (or `self-hosted`)
   - `RELAY_SECRET=<strong-secret>`
   - `RELAY_API_KEY=<optional-but-recommended>`
   - `RATE_LIMIT_MAX_PER_MINUTE=60`
3. Deploy and verify:
   - `GET /health`
   - `GET /.well-known/devscope`

## 2) Configure Desktop App
1. Open `Settings -> Remote Access`.
2. Keep default `Local only` unless you explicitly want remote mode.
3. Choose mode:
   - `Devscope Cloud` for managed URL
   - `Self-hosted` and enter your relay URL
4. Click `Validate Server`.
5. If relay has API key enabled, set `Relay API Key`.

## 3) Pair Mobile
1. In `Settings -> Remote Access`, set:
   - `Owner ID` (same identity used across your devices)
   - `Desktop Device ID`
2. Click `Generate Pairing`.
3. On mobile companion, scan/open QR payload and confirm code.
4. Approve pairing from desktop flow (API endpoint exists: `/v1/pairings/approve`).

## 4) Security Decisions
1. Keep remote disabled unless needed.
2. Use HTTPS relay URL only.
3. Prefer self-hosted if you want full infra control.
4. Rotate `RELAY_SECRET` and `RELAY_API_KEY` periodically.

## 5) Remaining Production Work
- Wire relay persistence to Postgres/Redis.
- Add authenticated owner identity (JWT/session).
- Add always-on desktop relay websocket worker.
- Complete mobile UI for chat/session control and approvals.
