# Expand All Loading State

## Feature Added

Added a **loading spinner** to the "Expand/Collapse All" button in both:
1. **Files tab** (main project files view)
2. **Working Changes tab** (git changes view)

Both now show a spinning wheel while expanding/collapsing folders or loading diffs.

## Changes Made

### Files Tab (Main Project View)

#### 1. New State
```typescript
const [isExpandingFolders, setIsExpandingFolders] = useState(false)
```

#### 2. Updated Button Logic
- Sets `isExpandingFolders = true` when clicked
- Shows spinner during transition
- Resets after 300ms (enough time to show feedback)
- Button disabled during loading

#### 3. Button UI
**States:**
- **Collapsed**: `⇕` (ChevronsUpDown icon)
- **Expanded**: `⇅` (ChevronsDownUp icon)
- **Loading**: `⟳` (RefreshCw spinning icon)

### Working Changes Tab (Git View)

#### 1. New State
```typescript
const [isExpandingAll, setIsExpandingAll] = useState(false)
```

#### 2. Updated expandAll Function
- Now `async` function
- Sets `isExpandingAll = true` at start
- Expands all files immediately (visual feedback)
- Loads all diffs in **parallel** using `Promise.all()`
- Sets `isExpandingAll = false` when complete
- Only loads diffs for current page (respects pagination)

#### 3. Updated Button UI
**Before:**
```tsx
<button onClick={expandAll}>
  <ChevronsUpDown size={12} />
  Expand All
</button>
```

**After:**
```tsx
<button onClick={expandAll} disabled={isExpandingAll}>
  {isExpandingAll ? (
    <>
      <RefreshCw size={12} className="animate-spin" />
      Loading...
    </>
  ) : (
    <>
      <ChevronsUpDown size={12} />
      Expand All
    </>
  )}
</button>
```

#### 4. Disabled States
- **Expand All** button disabled while loading
- **Collapse All** button also disabled while loading
- Both show reduced opacity when disabled
- Cursor changes to `not-allowed`

## User Experience

### Files Tab (Main View)
**Before:**
- Click expand/collapse button
- Folders expand/collapse instantly
- No visual feedback during transition

**After:**
- Click expand/collapse button
- Button shows spinning wheel briefly
- Folders expand/collapse
- Clear feedback that action is processing

### Working Changes Tab (Git View)
**Before:**
- Click "Expand All"
- Files expand but show individual loading spinners
- No indication of overall progress
- Could click button multiple times

**After:**
- Click "Expand All"
- Button immediately shows spinning wheel
- Text changes to "Loading..."
- Button disabled (can't click again)
- Collapse All also disabled
- All diffs load in parallel (faster!)
- Button returns to normal when complete

## Visual States

### Normal State
```
[⇕ Expand All]  [⇅ Collapse All]
```

### Loading State
```
[⟳ Loading...]  [⇅ Collapse All]
   (spinning)      (disabled)
```

### Completed State
```
[⇕ Expand All]  [⇅ Collapse All]
```

## Performance

- **Parallel loading**: All diffs load simultaneously
- **Respects pagination**: Only loads current page (max 15 files)
- **No duplicate requests**: Skips files that already have diffs loaded
- **Fast feedback**: Button state changes immediately

## Benefits

✅ **Clear feedback** - User knows something is happening
✅ **Prevents double-clicks** - Button disabled during load
✅ **Professional UX** - Matches loading patterns elsewhere
✅ **Faster loading** - Parallel requests instead of sequential
✅ **Consistent** - Same spinner used throughout app
✅ **Accessible** - Disabled state prevents confusion

## Testing

### Files Tab
1. Open any project
2. Go to Files tab
3. Click the expand/collapse button (⇕ or ⇅ icon)
4. Watch button briefly show spinning wheel (⟳)
5. Folders expand or collapse
6. Button returns to normal state

### Working Changes Tab
1. Make changes to 10+ files
2. Go to Git → Working Changes tab
3. Click "Expand All"
4. Watch button change to spinning wheel with "Loading..."
5. See all files expand and load diffs
6. Button returns to "Expand All" when done
7. Try clicking during loading (should be disabled)

## Technical Notes

- Uses `RefreshCw` icon with `animate-spin` class
- Same loading pattern as commit/push buttons
- `Promise.all()` ensures all loads complete before resetting state
- Error handling per file (one failure doesn't break others)
- Loading state persists until ALL diffs are loaded
