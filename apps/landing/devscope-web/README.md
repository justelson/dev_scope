# DevScope Web Landing App

This package is the landing site for DevScope Air. It is separate from the Windows desktop app at the repository root.

## Package Role

- Present the DevScope Air product and branding
- Point users to the latest desktop release
- Stay decoupled from Electron-only runtime code

The landing app should resolve release downloads dynamically from GitHub releases rather than hardcoding versioned asset URLs.

## Stack

- Vite
- React 19
- TypeScript
- Tailwind CSS 4

## Scripts

```bash
npm install
npm run dev
npm run build
npm run preview
npm run lint
```

## Deployment

- Repo-root Vercel deploys should use the root-level `vercel.json`, which builds `apps/landing/devscope-web` explicitly.
- Package-root Vercel deploys should use this package's local `vercel.json`.
- Both configs now declare the Vite build/install/output settings explicitly so the landing deploy does not depend on Vercel dashboard auto-detection.

## Important Files

- [`src/App.tsx`](C:\Users\elson\my_coding_play\devscope\apps\landing\devscope-web\src\App.tsx): main landing page composition
- [`src/index.css`](C:\Users\elson\my_coding_play\devscope\apps\landing\devscope-web\src\index.css): landing styling
- [`src/lib/release-download.ts`](C:\Users\elson\my_coding_play\devscope\apps\landing\devscope-web\src\lib\release-download.ts): release asset resolution logic
- [`public`](C:\Users\elson\my_coding_play\devscope\apps\landing\devscope-web\public): static branding assets

## Boundary

Do not move desktop-only runtime behavior into this package. The landing app is marketing/distribution surface only.
