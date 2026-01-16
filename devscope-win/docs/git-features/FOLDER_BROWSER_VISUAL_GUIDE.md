# Folder Browser - Visual Guide

## New Features Overview

### 1. Toggle Button (Top Right)

```
┌─────────────────────────────────────────────────────────────────┐
│  [Search...] [Filter ▼]    [📁 Folders | Projects] [⊞ ≡ ☰]    │
└─────────────────────────────────────────────────────────────────┘
                                    ↑                    ↑
                              New Toggle          View Mode Toggle
```

### 2. Folders Mode (Default) - Shows Everything

```
┌─────────────────────────────────────────────────────────────────┐
│ 📁 Folders & Repositories                                    8  │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │ 📁 Documents │  │ ┌───┐        │  │ 📁 Downloads │         │
│  │              │  │ │ ⚡ │ my-app │  │              │         │
│  │           → │  │ └───┘        │  │           → │         │
│  └──────────────┘  │ GIT REPO     │  └──────────────┘         │
│                     │           → │                             │
│  ┌──────────────┐  └──────────────┘  ┌──────────────┐         │
│  │ 📁 Projects  │  ┌──────────────┐  │ 📁 Music     │         │
│  │           → │  │ ┌───┐        │  │           → │         │
│  └──────────────┘  │ │ ⚡ │ website│  └──────────────┘         │
│                     │ └───┘        │                             │
│                     │ GIT REPO     │                             │
│                     │           → │                             │
│                     └──────────────┘                             │
└─────────────────────────────────────────────────────────────────┘

Legend:
📁 = Regular folder (yellow icon)
⚡ = Git repository (GitHub icon in white box)
```

### 3. Projects Mode - Shows Only Git Repos

```
┌─────────────────────────────────────────────────────────────────┐
│ ⚡ Git Repositories                                           3  │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │ ┌───┐        │  │ ┌───┐        │  │ ┌───┐        │         │
│  │ │ ⚡ │ my-app │  │ │ ⚡ │ website│  │ │ ⚡ │ backend│         │
│  │ └───┘        │  │ └───┘        │  │ └───┘        │         │
│  │ GIT REPO     │  │ GIT REPO     │  │ GIT REPO     │         │
│  │           → │  │           → │  │           → │         │
│  └──────────────┘  └──────────────┘  └──────────────┘         │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘

Note: Regular folders are hidden in this mode
```

## Visual Styling Details

### Git Repository Card

```
┌─────────────────────────────────────┐
│ ┌─────┐                             │  ← White/elevated background
│ │  ⚡  │  my-awesome-project         │  ← Bold white text
│ └─────┘                             │  ← GitHub icon in box
│ GIT REPO                         →  │  ← Small label + arrow
└─────────────────────────────────────┘
  ↑                                  ↑
  Stronger border              Chevron icon
```

**Styling:**
- Background: `bg-white/5` (slightly elevated)
- Border: `border-white/10` (more visible)
- Hover: `border-white/30` + `bg-white/10` (prominent)
- Icon: GitHub logo in white box (`bg-white/10`)
- Text: Bold white (`font-medium`)
- Label: Uppercase "GIT REPO" in muted white

### Regular Folder Card

```
┌─────────────────────────────────────┐
│ 📁  Documents                    →  │  ← Standard background
└─────────────────────────────────────┘
  ↑                                  ↑
  Yellow folder icon          Chevron icon
```

**Styling:**
- Background: `bg-sparkle-card/50` (standard)
- Border: `border-white/5` (subtle)
- Hover: `border-white/20` + `bg-white/5` (subtle)
- Icon: Yellow folder icon
- Text: Regular white/70 opacity

## Toggle Button States

### Folders Mode (Active)
```
┌──────────────────────────────┐
│ ┌──────────┐ ┌──────────┐   │
│ │📁 Folders│ │ Projects │   │  ← Folders highlighted
│ └──────────┘ └──────────┘   │
└──────────────────────────────┘
```

### Projects Mode (Active)
```
┌──────────────────────────────┐
│ ┌──────────┐ ┌──────────┐   │
│ │ Folders  │ │💻 Projects│   │  ← Projects highlighted
│ └──────────┘ └──────────┘   │
└──────────────────────────────┘
```

## Interaction Flow

### Scenario 1: Browse All Content (Default)
```
1. User opens folder
   ↓
2. Sees "Folders" mode active (default)
   ↓
3. Views all folders + Git repos mixed together
   ↓
4. Git repos are visually tagged with GitHub icon
   ↓
5. User can click any folder or Git repo to navigate
```

### Scenario 2: Find Git Repositories Only
```
1. User opens folder with many items
   ↓
2. Clicks "Projects" toggle
   ↓
3. View filters to show only Git repositories
   ↓
4. Section header changes to "Git Repositories"
   ↓
5. User quickly finds version-controlled projects
```

### Scenario 3: Identify Git Repos at a Glance
```
1. User browses in "Folders" mode
   ↓
2. Sees mix of folders and Git repos
   ↓
3. Git repos stand out with:
   - GitHub icon in white box
   - "GIT REPO" label
   - Elevated styling
   ↓
4. User instantly knows which are version-controlled
```

## Color Scheme

### Git Repository
- **Icon Box**: White with 10% opacity (`bg-white/10`)
- **Icon**: White GitHub logo
- **Background**: White with 5% opacity (`bg-white/5`)
- **Border**: White with 10% opacity (`border-white/10`)
- **Hover Border**: White with 30% opacity (`border-white/30`)
- **Hover Background**: White with 10% opacity (`bg-white/10`)
- **Text**: White bold (`text-white font-medium`)
- **Label**: White with 40% opacity (`text-white/40`)

### Regular Folder
- **Icon**: Yellow with 70% opacity (`text-yellow-400/70`)
- **Background**: Card background with 50% opacity (`bg-sparkle-card/50`)
- **Border**: White with 5% opacity (`border-white/5`)
- **Hover Border**: White with 20% opacity (`border-white/20`)
- **Hover Background**: White with 5% opacity (`bg-white/5`)
- **Text**: White with 70% opacity (`text-white/70`)

## Responsive Behavior

### Desktop (1920px+)
```
Grid: 6 columns
┌───┐ ┌───┐ ┌───┐ ┌───┐ ┌───┐ ┌───┐
└───┘ └───┘ └───┘ └───┘ └───┘ └───┘
```

### Laptop (1280px)
```
Grid: 5 columns
┌───┐ ┌───┐ ┌───┐ ┌───┐ ┌───┐
└───┘ └───┘ └───┘ └───┘ └───┘
```

### Tablet (768px)
```
Grid: 4 columns
┌───┐ ┌───┐ ┌───┐ ┌───┐
└───┘ └───┘ └───┘ └───┘
```

### Mobile (640px)
```
Grid: 3 columns
┌───┐ ┌───┐ ┌───┐
└───┘ └───┘ └───┘
```

## Accessibility

- **Keyboard Navigation**: Tab through folders and Git repos
- **Screen Readers**: Announces "Git Repository" for Git repos
- **Focus States**: Clear focus indicators on all interactive elements
- **Color Contrast**: Meets WCAG AA standards
- **Toggle Labels**: Clear "Folders" and "Projects" labels

## Performance

- **Filtering**: Instant toggle between modes (useMemo optimization)
- **Rendering**: Only renders visible items
- **Sorting**: Alphabetical sorting maintained in both modes
- **Search**: Works across both modes

## Edge Cases

### No Git Repositories
```
Projects Mode:
┌─────────────────────────────────────┐
│ No Git Repositories Found           │
│                                     │
│ This folder doesn't contain any    │
│ version-controlled projects.       │
└─────────────────────────────────────┘
```

### Only Git Repositories
```
Folders Mode:
┌─────────────────────────────────────┐
│ ⚡ Git Repositories              3  │
├─────────────────────────────────────┤
│ [All items are Git repos]          │
└─────────────────────────────────────┘
```

### Search Active
```
Both toggles work with search:
- Folders mode: Searches all folders + Git repos
- Projects mode: Searches only Git repos
```
