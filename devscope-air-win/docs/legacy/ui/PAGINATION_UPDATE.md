# Pagination Added to Git Views

## Changes Made

Added pagination (15 items per page) to two git views that were missing it:

### 1. **To Push Tab**
- Now shows 15 unpushed commits per page
- Previous/Next buttons
- Page counter (e.g., "2 / 5")
- Shows "Showing 16-30 of 73" counter
- Only appears when there are more than 15 commits

### 2. **Working Changes Tab**
- Now shows 15 changed files per page
- Previous/Next buttons
- Page counter (e.g., "1 / 3")
- Shows "Showing 1-15 of 42" counter
- Only appears when there are more than 15 files
- Pagination controls at the bottom after file list

## Implementation Details

### State Added
```typescript
- unpushedPage: number (tracks current page for unpushed commits)
- changesPage: number (tracks current page for working changes)
- ITEMS_PER_PAGE: 15 (constant for pagination)
```

### WorkingChangesView Component
Updated to accept pagination props:
```typescript
function WorkingChangesView({ 
    files, 
    projectPath, 
    currentPage,      // NEW
    onPageChange      // NEW
})
```

- Slices files array based on current page
- Renders pagination controls when needed
- Calculates total pages automatically

### Unpushed Commits View
- Uses `unpushedCommits.slice()` to paginate
- Same pagination UI as history view
- Consistent user experience across all tabs

## User Experience

### Before
- All items shown at once
- Scrolling through 50+ items was tedious
- Performance issues with many items

### After
- Clean 15-item pages
- Quick navigation with Previous/Next
- Clear indication of position (page X of Y)
- Better performance with large datasets
- Consistent with History tab pagination

## Pagination UI Pattern

All three paginated views now use the same pattern:

```
┌─────────────────────────────────────────────────┐
│  [Items 1-15 displayed here]                    │
├─────────────────────────────────────────────────┤
│  Showing 1-15 of 42    [Previous] 1/3 [Next]   │
└─────────────────────────────────────────────────┘
```

- Left: Item range counter
- Right: Navigation buttons + page indicator
- Disabled state when at first/last page
- Smooth transitions between pages

## Benefits

✅ **Scalability** - Handles repos with 100+ changed files
✅ **Performance** - Only renders 15 items at a time
✅ **Consistency** - Same pagination across all views
✅ **Usability** - Easy navigation with clear feedback
✅ **Clean UI** - No overwhelming lists
✅ **Fast loading** - Lazy-loaded diffs only for visible items

## Testing

To test pagination:
1. Make changes to 20+ files
2. Go to Working Changes tab
3. See pagination controls at bottom
4. Click Next/Previous to navigate
5. Create 20+ commits without pushing
6. Go to To Push tab
7. See pagination controls
8. Navigate through pages

## Notes

- Page resets to 1 when switching between tabs
- Pagination only shows when needed (>15 items)
- Expand All still works within current page
- Diffs are lazy-loaded per page for performance
