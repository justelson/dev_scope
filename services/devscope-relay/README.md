# Devscope Relay Service

Deployable relay/API for optional remote access (Devscope Cloud or self-hosted).

## Goals
- Keep desktop execution local on the user's PC.
- Provide pairing + routing for mobile remote control.
- Enforce opt-in usage from the app settings.
- Relay encrypted envelopes (`e2ee-envelope-v1`) without reading payload content.

## Endpoints
- `GET /health`
- `GET /.well-known/devscope`
- `POST /v1/validation/challenge`
- `POST /v1/pairings`
- `POST /v1/pairings/claim`
- `POST /v1/pairings/approve`
- `GET /v1/devices/:ownerId`
- `DELETE /v1/devices/:ownerId/:deviceId`
- `GET /v1/relay/ws?ownerId=...&deviceId=...`
- `POST /v1/relay/publish`

## Security Defaults (Scaffold)
- Optional API key guard via `RELAY_API_KEY` and header `x-devscope-relay-key`.
- Basic in-memory per-IP rate limiting (`RATE_LIMIT_MAX_PER_MINUTE`).
- Pairing records are TTL-based and pruned periodically.

## Quick Start
1. Copy `.env.example` to `.env`.
2. Install deps in this folder.
3. Run `npm run dev`.
4. Validate with:
   - `GET http://localhost:8787/health`
- `GET http://localhost:8787/.well-known/devscope`

If `RELAY_API_KEY` is set, include `x-devscope-relay-key` for protected endpoints.

## Railway Deploy
1. Create a new Railway service from `services/devscope-relay`.
2. Set environment variables from `.env.example`.
3. Set `RELAY_KIND=devscope-cloud` for managed deployment.
4. Deploy and verify `/.well-known/devscope`.

## Self-Hosted Deploy
- Recommended: run behind HTTPS reverse proxy.
- Set `RELAY_KIND=self-hosted`.
- Point the app `Remote Access -> Self-hosted` URL at this server.
- Use the validation button in settings before enabling remote mode.

## E2EE Note
The relay is designed for encrypted payload pass-through. Server operators should still expect to see metadata:
- owner/device IDs
- timestamps
- relay connection events

If you need stronger privacy guarantees, minimize retention and avoid logging request bodies.
