# ⚠️ Electron Restart Required

## Issue
You're seeing this error:
```
Uncaught TypeError: window.devscope.getUnpushedCommits is not a function
```

## Why?
The **preload script** (`src/preload/index.ts`) only runs when Electron starts. We added new IPC functions, but the running app still has the old preload context.

## Solution

### **Restart the Electron app:**

1. **Stop the current dev server** (Ctrl+C in terminal)
2. **Restart it:**
   ```bash
   npm run dev
   ```

That's it! The new functions will be available after restart.

## What Changed
We added these new IPC functions to the preload:
- `getUnpushedCommits()`
- `getGitUser()`
- `getRepoOwner()`
- `stageFiles()`
- `createCommit()`
- `pushCommits()`

All are properly defined in:
- ✅ Backend: `src/main/inspectors/git.ts`
- ✅ IPC Handlers: `src/main/ipc/handlers.ts`
- ✅ Preload: `src/preload/index.ts`
- ✅ Frontend: `src/renderer/src/pages/ProjectDetails.tsx`

## Verification
After restart, open DevTools console and check:
```javascript
console.log(typeof window.devscope.getUnpushedCommits)
// Should output: "function"
```

## Note
Hot Module Replacement (HMR) works for React components but **not** for:
- Preload scripts
- Main process code
- IPC handlers

Always restart Electron when changing these files!
