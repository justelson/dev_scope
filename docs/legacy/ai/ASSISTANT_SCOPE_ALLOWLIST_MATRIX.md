# Assistant Scope Allowlist Matrix

Quick reference to prevent out-of-scope edits.

## Phase 01
- Backend:
  - `src/main/assistant/**`
  - `src/main/ipc/handlers/assistant-handlers.ts`
  - `src/main/ipc/handlers.ts`
  - `src/preload/index.ts`
- Frontend:
  - `src/renderer/src/pages/Assistant.tsx`
  - `src/renderer/src/pages/settings/AssistantSettings.tsx`
  - `src/renderer/src/lib/settings.tsx`

## Phase 02
- Backend:
  - `src/main/assistant/**`
- Frontend:
  - `src/renderer/src/pages/Assistant.tsx`
  - `src/renderer/src/pages/assistant/**`

## Phase 03
- Backend:
  - `src/main/assistant/**`
  - `src/main/ipc/handlers/assistant-handlers.ts`
  - `src/preload/index.ts`
- Frontend:
  - `src/renderer/src/pages/Assistant.tsx`
  - `src/renderer/src/pages/assistant/**`

## Phase 04
- Backend:
  - `src/main/assistant/**`
- Frontend:
  - `src/renderer/src/pages/Assistant.tsx`
  - `src/renderer/src/pages/assistant/**`

## Phase 05
- Backend:
  - `src/main/assistant/**`
  - `src/main/ipc/handlers/assistant-handlers.ts`
  - `src/preload/index.ts`
- Frontend:
  - `src/renderer/src/pages/Assistant.tsx`
  - `src/renderer/src/pages/assistant/**`
  - `src/renderer/src/pages/settings/AssistantSettings.tsx`

## Phase 06
- Backend:
  - `src/main/assistant/**`
  - `src/main/ipc/handlers/assistant-handlers.ts`
  - `src/preload/index.ts`
- Frontend:
  - `src/renderer/src/pages/assistant/**`
  - `src/renderer/src/pages/settings/AssistantSettings.tsx`

## Phase 07
- Backend:
  - `src/main/assistant/**`
  - `src/main/ipc/handlers/assistant-handlers.ts`
  - `src/preload/index.ts`
- Frontend:
  - `src/renderer/src/pages/Assistant.tsx`
  - `src/renderer/src/pages/assistant/**`
  - `src/renderer/src/lib/settings.tsx` (only when required)

## Phase 08
- Backend:
  - `src/main/assistant/**`
  - `src/main/ipc/handlers/assistant-handlers.ts`
  - `src/preload/index.ts`
- Frontend:
  - `src/renderer/src/pages/assistant/**`
  - `src/renderer/src/pages/ProjectDetails.tsx` (context insertion entry only)

## Phase 09
- Backend:
  - `src/main/assistant/**`
  - `src/main/ipc/handlers/assistant-handlers.ts`
  - `src/preload/index.ts`
- Frontend:
  - `src/renderer/src/pages/assistant/**`
  - `src/renderer/src/components/ui/MarkdownRenderer.tsx` (assistant output only)

## Phase 10
- Backend:
  - `src/main/assistant/**`
  - `src/main/ipc/handlers/assistant-handlers.ts`
  - `src/preload/index.ts`
- Frontend:
  - `src/renderer/src/pages/settings/AssistantSettings.tsx`
  - `src/renderer/src/pages/assistant/**`
  - `src/renderer/src/lib/settings.tsx`

## Phase 11
- Backend:
  - `src/main/assistant/**`
  - `src/main/ipc/handlers/assistant-handlers.ts`
  - `src/preload/index.ts`
- Frontend:
  - `src/renderer/src/pages/Assistant.tsx`
  - `src/renderer/src/pages/assistant/**`

## Phase 12
- Backend:
  - `src/main/assistant/**`
  - `src/main/ipc/handlers/assistant-handlers.ts`
  - `src/preload/index.ts`
  - `src/main/inspectors/git/**` (workflow endpoints only)
- Frontend:
  - `src/renderer/src/pages/assistant/**`
  - `src/renderer/src/pages/ProjectDetails.tsx` (workflow entry points only)
  - `src/renderer/src/pages/project-details/**` (assistant workflow wiring only)

## Global Denylist (All Phases Unless Explicitly Instructed)

- `src/renderer/src/pages/Projects.tsx`
- `src/renderer/src/pages/FolderBrowse.tsx`
- `src/renderer/src/pages/Home.tsx`
- `src/main/inspectors/system/**`
- `src/main/inspectors/terminal/**`

