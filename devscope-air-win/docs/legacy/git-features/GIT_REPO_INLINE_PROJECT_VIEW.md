# Git Repository Inline Project View

## Overview
Added the ability to view Git repositories as full project details directly within the folder browser, without navigating away. Users can toggle between compact folder view and expanded project view.

## Features

### 1. Two View Modes for Git Repositories

#### Folder View (Default)
- Git repos shown as compact folder cards
- GitHub icon with "Git Repo" label
- Click to navigate into the folder
- Quick and clean for browsing

#### Project View (Toggle On)
- Git repos shown as expandable project cards
- Each repo has a "Show Details" button
- Clicking expands to show full project details inline
- Embedded iframe displays the complete project page

### 2. Toggle Button
Located in the Git Repositories section header:
- **"Show as Projects"** - Switches to project card view
- **"Show as Folders"** - Switches back to compact folder view
- Persists during the session

### 3. Expandable Project Cards

Each Git repository card includes:

**Collapsed State:**
```
┌─────────────────────────────────────────────────────────┐
│ [GitHub Icon]  my-project                               │
│                C:\path\to\project                       │
│                                                         │
│         [Show Details ▶] [Terminal] [Open Full View]   │
└─────────────────────────────────────────────────────────┘
```

**Expanded State:**
```
┌─────────────────────────────────────────────────────────┐
│ [GitHub Icon]  my-project                               │
│                C:\path\to\project                       │
│                                                         │
│         [Hide Details ▼] [Terminal] [Open Full View]   │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │                                                 │   │
│  │     [Full Project Details View Embedded]       │   │
│  │     - README tab                                │   │
│  │     - Files tab                                 │   │
│  │     - Git tab                                   │   │
│  │     - Scripts panel                             │   │
│  │     - All project information                   │   │
│  │                                                 │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### 4. Actions Available

**On Each Git Repo Card:**
1. **Show/Hide Details** - Toggle inline project view
2. **Terminal** - Open terminal in that directory
3. **Open Full View** - Navigate to dedicated project page

## User Flow

### Scenario 1: Quick Browse (Default)
```
1. User opens folder with Git repos
   ↓
2. Sees Git repos as compact folder cards
   ↓
3. Can click to navigate into folder
   ↓
4. Fast and clean browsing experience
```

### Scenario 2: View Project Details Inline
```
1. User clicks "Show as Projects" toggle
   ↓
2. Git repos expand to project cards
   ↓
3. User clicks "Show Details" on a repo
   ↓
4. Full project view expands inline (600px height)
   ↓
5. User can see README, files, Git info, scripts
   ↓
6. User clicks "Hide Details" to collapse
   ↓
7. Can expand multiple repos simultaneously
```

### Scenario 3: Open Full Project Page
```
1. User in project view mode
   ↓
2. Clicks "Open Full View" icon
   ↓
3. Navigates to dedicated project details page
   ↓
4. Full-screen project experience
```

## Technical Implementation

### State Management
```typescript
const [showAsProjects, setShowAsProjects] = useState(false)
const [expandedGitRepos, setExpandedGitRepos] = useState<Set<string>>(new Set())
```

### Toggle Function
```typescript
const toggleGitRepoExpansion = (repoPath: string) => {
    setExpandedGitRepos(prev => {
        const newSet = new Set(prev)
        if (newSet.has(repoPath)) {
            newSet.delete(repoPath)
        } else {
            newSet.add(repoPath)
        }
        return newSet
    })
}
```

### Embedded Project View
Uses iframe to embed the full project details page:
```tsx
<iframe
    src={`#/projects/${encodedPath}`}
    className="w-full h-full border-0"
    title={`${repo.name} Project Details`}
/>
```

## Visual Design

### Folder View Cards
- **Background**: `bg-white/5`
- **Border**: `border-white/10`
- **Hover**: `border-white/30` + `bg-white/10`
- **Icon**: GitHub logo in white box
- **Label**: "GIT REPO" in uppercase

### Project View Cards
- **Background**: `bg-sparkle-card`
- **Border**: `border-white/10`
- **Rounded**: `rounded-2xl`
- **Header**: Large GitHub icon + project name + path
- **Actions**: Primary button for expand/collapse
- **Embedded View**: 600px height iframe

### Toggle Button
- **Location**: Section header, right side
- **Style**: Outlined button with icon + text
- **States**: "Show as Projects" / "Show as Folders"

## Benefits

1. **No Navigation Required**: View project details without leaving the folder
2. **Multiple Repos**: Can expand multiple Git repos at once
3. **Quick Comparison**: Compare different projects side-by-side
4. **Flexible**: Toggle between compact and detailed views
5. **Full Functionality**: Embedded view has all project features
6. **Context Preserved**: Stay in folder browser while exploring projects

## Performance

- **Lazy Loading**: Project details only load when expanded
- **Iframe Isolation**: Each project runs in its own context
- **Efficient State**: Uses Set for O(1) expansion checks
- **Smooth Animations**: CSS transitions for expand/collapse

## Keyboard Shortcuts (Future)

Potential enhancements:
- `Space` - Toggle expansion of focused repo
- `E` - Expand all Git repos
- `C` - Collapse all Git repos
- `T` - Open terminal for focused repo

## Edge Cases

### No Git Repositories
- Toggle button doesn't appear
- Section doesn't render

### Single Git Repository
- Toggle still available
- Works the same way

### Many Git Repositories
- All can be expanded simultaneously
- Scroll to view all expanded content
- Performance remains good (lazy loading)

## Future Enhancements

1. **Tabs in Expanded View**: Switch between README/Files/Git without iframe
2. **Quick Actions**: Commit, push, pull directly from card
3. **Git Status Badge**: Show clean/dirty status on card
4. **Branch Indicator**: Display current branch
5. **Commit Count**: Show commits ahead/behind
6. **Collaborators**: Display contributor avatars
7. **Last Commit**: Show last commit message and time
8. **Size Adjustment**: Resizable embedded view height

## Files Modified

- `src/renderer/src/pages/FolderBrowse.tsx` - Added toggle, expansion state, and inline project view

## Testing

To test:
1. Navigate to a folder with Git repositories
2. Verify Git repos show with GitHub icon and "Git Repo" label
3. Click "Show as Projects" toggle
4. Verify repos expand to project cards
5. Click "Show Details" on a repo
6. Verify full project view appears inline
7. Verify README, Files, Git tabs work
8. Click "Hide Details" to collapse
9. Expand multiple repos simultaneously
10. Click "Open Full View" to navigate to project page
11. Click "Show as Folders" to return to compact view
