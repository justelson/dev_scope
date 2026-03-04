# Landing Page Agent Brief

Status: Ready for implementation handoff  
Date: March 4, 2026

## Where The Landing App Should Live

Build the landing app here:

`C:\Users\elson\my_coding_play\devscope\devscope-air-win\apps\landing-web`

Why:
1. `devscope-air-win` is the active product track.
2. `apps/` already hosts standalone web clients (`mobile-companion`), so this keeps structure consistent.
3. It keeps marketing web concerns separated from Electron renderer code.

## Target Purpose

Create a public-facing product site for DevScope Air that explains value fast, builds trust, and drives install/signup intent.

Primary CTA goal:
1. Download / get started with DevScope Air.

Secondary CTA goal:
1. Join waitlist / follow updates.

## Required Page Sections

1. Hero
   - Product name: DevScope Air
   - One-line value proposition
   - Primary + secondary CTA buttons
2. About
   - What DevScope Air is
   - Why it exists
   - Who it is for
3. Feature pillars
   - Projects-first workflows
   - Git productivity
   - Assistant-aware workflows
   - File preview and project intelligence
4. How it works
   - 3-step flow (scan -> inspect -> act)
5. Proof/trust strip
   - Platform target (Windows)
   - Local-first positioning
   - Clear release status (Air is active)
6. FAQ
   - OS support
   - Data/privacy basics
   - Air vs legacy/full variant status
7. Final CTA footer
   - Repeat key action and quick links

## About Section Starter Copy (Draft)

Use this as a starting point (agent can refine tone):

"DevScope Air is a projects-first developer workspace for Windows.  
It gives you a single place to scan projects, inspect repository health, preview files, and move faster through day-to-day Git and code workflows.  
Built for developers who want less context switching and more momentum."

## Content Guardrails

1. Keep claims concrete and verifiable.
2. Avoid saying features are available if they are not in Air.
3. Mention legacy/full variant only as migration context, not as primary product.
4. Keep copy short and skimmable.

## Design Guardrails For The Agent

1. Responsive first: mobile + desktop polished.
2. Distinct visual identity (not generic template look).
3. Strong typography hierarchy.
4. Accessible contrast and keyboard-focus visibility.
5. Meaningful motion only (no noisy animations).

## Technical Guardrails For The Agent

1. Build as standalone web app (no Electron APIs).
2. Keep this app isolated under `apps/landing-web`.
3. Include simple build/run scripts in that app's `package.json`.
4. Prepare for static deployment (Vercel/Netlify compatible).

## Definition Of Done

1. Landing page is fully responsive.
2. All required sections exist with real copy.
3. CTA buttons are wired (even if temporarily to placeholders).
4. No references to internal-only implementation details.
5. README exists in `apps/landing-web` with run/build/deploy steps.
