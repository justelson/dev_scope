# Folder Browser - Git Repository Enhancement

## Overview
Enhanced the folder browser to visually distinguish Git repositories and added a toggle to switch between "Folders" and "Projects" view modes.

## Changes Made

### 1. Git Repository Visual Tags
**File**: `src/renderer/src/pages/FolderBrowse.tsx`

Git repositories now have:
- **Distinct styling**: White background with stronger borders
- **GitHub icon**: Replaces folder icon for Git repos
- **"Git Repo" label**: Small uppercase label below the name
- **Enhanced hover state**: More prominent hover effect

### 2. Folders/Projects Toggle
Added a new toggle button in the toolbar that allows users to switch between two view modes:

**Folders Mode (Default)**
- Shows all folders AND Git repositories
- Standard folder view with Git repos visually tagged
- Best for general file browsing

**Projects Mode**
- Shows ONLY Git repositories
- Filters out regular folders
- Useful for quickly finding version-controlled projects
- Section header changes to "Git Repositories"

### 3. Visual Improvements

#### Git Repository Card Styling
```
┌─────────────────────────────┐
│ [GitHub Icon]  Project Name │
│                Git Repo     │
│                          →  │
└─────────────────────────────┘
```

- Boxed GitHub icon with white background
- Bold white text for repository name
- Small "GIT REPO" label in uppercase
- Enhanced border and background on hover

#### Regular Folder Styling
```
┌─────────────────────────────┐
│ [Folder Icon]  Folder Name → │
└─────────────────────────────┘
```

- Yellow folder icon
- Standard text styling
- Subtle hover effect

## UI Components

### Toggle Button Location
The toggle is positioned in the toolbar, between the search/filter section and the view mode toggles:

```
[Search] [Filter] | [Folders/Projects Toggle] [Grid/List/Detailed Toggle]
```

### Toggle States

**Folders Mode (Active by Default)**
```
┌──────────────────────────────┐
│ [📁 Folders] | Projects      │
└──────────────────────────────┘
```

**Projects Mode**
```
┌──────────────────────────────┐
│ Folders | [💻 Projects]      │
└──────────────────────────────┘
```

## User Experience

### Default Behavior
- Opens in "Folders" mode showing all items
- Git repositories are visually tagged but mixed with folders
- Users can browse naturally through the file system

### Projects Mode
- Filters to show only Git repositories
- Useful for developers who want to see only version-controlled projects
- Section header updates to "Git Repositories"
- Empty state if no Git repos found

### Visual Hierarchy
1. **Git Repositories**: Most prominent with white styling and GitHub icon
2. **Regular Folders**: Standard yellow folder icon
3. **Files**: Blue file icons (unchanged)
4. **Projects**: Code projects with framework badges (unchanged)

## Technical Details

### State Management
```typescript
const [showAsProjects, setShowAsProjects] = useState(false)
```

### Filtering Logic
```typescript
const filteredFolders = useMemo(() => {
    if (searchQuery) return []
    
    if (showAsProjects) {
        // Show only Git repos
        return projects.filter(p => p.type === 'git')
    }
    
    // Show all folders + Git repos
    const gitRepos = projects.filter(p => p.type === 'git')
    return [...folders, ...gitRepos].sort()
}, [folders, projects, searchQuery, showAsProjects])
```

### Git Detection
Git repositories are detected by the backend scanner looking for `.git` folders:
- Type: `'git'`
- Marker: `'.git'`
- Treated as special project type

## Benefits

1. **Quick Identification**: Instantly see which folders are Git repositories
2. **Flexible Viewing**: Toggle between all folders or just Git repos
3. **Better Organization**: Visual hierarchy helps users navigate
4. **Developer-Friendly**: Focuses on version-controlled projects when needed
5. **Non-Intrusive**: Default behavior unchanged (shows all folders)

## Examples

### Mixed View (Folders Mode - Default)
```
Folders & Repositories (8)
┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│ 📁 Documents │ │ 🔲 my-app    │ │ 📁 Downloads │
│              │ │   Git Repo   │ │              │
└──────────────┘ └──────────────┘ └──────────────┘
```

### Git Only View (Projects Mode)
```
Git Repositories (3)
┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│ 🔲 my-app    │ │ 🔲 website   │ │ 🔲 backend   │
│   Git Repo   │ │   Git Repo   │ │   Git Repo   │
└──────────────┘ └──────────────┘ └──────────────┘
```

## Testing

To test the feature:

1. **Navigate to a folder** with mixed content (folders + Git repos)
2. **Verify Git repos** have GitHub icon and "Git Repo" label
3. **Click "Projects" toggle** - should show only Git repositories
4. **Click "Folders" toggle** - should show all folders and Git repos
5. **Hover over Git repos** - should have enhanced styling
6. **Click a Git repo** - should navigate into it

## Future Enhancements

Potential improvements:
- Show Git branch name on hover
- Display commit count or last commit date
- Add Git status indicators (clean, dirty, ahead/behind)
- Quick actions (pull, push, commit) on Git repo cards
- Filter by Git status (clean, modified, etc.)

## Files Modified

- `src/renderer/src/pages/FolderBrowse.tsx` - Added toggle and Git styling

## Compatibility

- ✅ Works with existing folder scanning
- ✅ No backend changes required
- ✅ Maintains all existing functionality
- ✅ Responsive design preserved
- ✅ Accessible keyboard navigation
