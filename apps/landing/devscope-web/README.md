# DevScope Web Landing App

This package is the Vite-based landing site for DevScope. It is separate from the Windows desktop app at the repository root.

## Current Status

- Package: `devscope-web`
- Version: `0.0.0`
- Stack: Vite + React 19 + TypeScript + Tailwind CSS
- Deploy target: Vercel-ready static web app

## What Is In This Package

- A single-page landing experience in [`src/App.tsx`](./src/App.tsx)
- Tailwind-driven styling and theme tokens in [`src/index.css`](./src/index.css)
- Static assets served from [`public`](./public)

## Available Scripts

```bash
npm install
npm run dev
npm run build
npm run preview
```

## Script Reference

- `npm run dev`: starts the Vite dev server.
- `npm run build`: runs TypeScript build mode and creates the production bundle.
- `npm run preview`: serves the production build locally.
- `npm run lint`: runs ESLint for this package.

## Design Note

This landing app follows the same overall DevScope visual direction. The Sparkle-inspired design language used across the repo traces back to the original Sparkle project:

- `https://github.com/thedogecraft/sparkle`
