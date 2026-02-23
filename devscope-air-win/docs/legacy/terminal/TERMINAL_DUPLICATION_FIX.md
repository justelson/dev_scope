# Terminal Duplication Issue - Fixed ✅

## Problem

When opening a terminal for a project, duplicate terminal sessions were being created. This happened every time you clicked "Open Terminal" or any terminal-related button.

## Root Cause

The Terminal component had two places that created sessions:

1. **Initial creation** (line 246): When `initialCwd` is provided during terminal initialization, it creates a session
2. **Change detection** (lines 369-380): A `useEffect` watches for `initialCwd` changes and creates another session

### The Bug Flow:

```
1. User clicks "Open Terminal" → openTerminal(tool, '/project/path')
2. Terminal initializes → initialCwd = '/project/path'
3. initTerminal() runs → Creates session #1 ✅
4. useEffect detects initialCwd changed from undefined → '/project/path'
5. useEffect creates session #2 ❌ DUPLICATE!
```

## Solution

Added a `isFirstRenderRef` flag to skip the useEffect on the first render:

```typescript
const isFirstRenderRef = useRef(true)

useEffect(() => {
    // Skip the first render to avoid duplicate session creation
    if (isFirstRenderRef.current) {
        isFirstRenderRef.current = false
        prevCwdRef.current = initialCwd
        prevCommandRef.current = initialCommand
        return // Exit early, don't create session
    }

    // Only create new session on subsequent changes
    const cwdChanged = initialCwd && initialCwd !== prevCwdRef.current
    const commandChanged = initialCommand && initialCommand !== prevCommandRef.current
    
    if (hasInitialized && (cwdChanged || commandChanged)) {
        createSession(undefined, initialCommand)
    }
    
    prevCwdRef.current = initialCwd
    prevCommandRef.current = initialCommand
}, [initialCwd, initialCommand, hasInitialized])
```

## Additional Fix

Reset the `isFirstRenderRef` flag when the terminal closes, so it works correctly on the next open:

```typescript
// In cleanup effect
isFirstRenderRef.current = true
```

## How It Works Now

1. **First open**: Creates ONE session during initialization
2. **Subsequent opens**: Creates ONE session per open
3. **Directory changes**: Creates a new session only when switching to a different project directory
4. **Command changes**: Creates a new session only when running a different command in the same directory

## Testing

After restarting the Electron app:
1. Open a project
2. Click "Open Terminal" → Should create 1 session
3. Close terminal
4. Click "Open Terminal" again → Should create 1 new session (not 2)
5. Switch to different project → Should create 1 session for new project
6. Check "Active Terminals" section → Should show correct count

No more duplicate sessions! 🎉
