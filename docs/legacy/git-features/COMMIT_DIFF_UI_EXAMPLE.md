# Commit Diff & Working Changes - UI Layout

## Commit Diff Modal

```
┌─────────────────────────────────────────────────────────────────┐
│  🔄 Fix authentication bug in login component                   │ ✕
│  abc1234  👤 John Doe  📅 Jan 16, 2026, 3:45 PM                 │
├─────────────────────────────────────────────────────────────────┤
│  📄 3 files changed  +45  -12    [Expand All] [Collapse All]    │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ▶ 📄 src/components/Login.tsx              +32  -8            │
│  ├─────────────────────────────────────────────────────────────┤
│                                                                  │
│  ▼ 📄 src/utils/auth.ts                     +10  -3            │
│  ├─────────────────────────────────────────────────────────────┤
│  │ diff --git a/src/utils/auth.ts b/src/utils/auth.ts          │
│  │ @@ -15,7 +15,10 @@ export function validateToken(token) {   │
│  │   if (!token) return false                                   │
│  │ - return jwt.verify(token, SECRET)                           │
│  │ + try {                                                       │
│  │ +   return jwt.verify(token, SECRET)                         │
│  │ + } catch (err) {                                             │
│  │ +   return false                                              │
│  │ + }                                                            │
│  │ }                                                             │
│  │                                                               │
│  │              [Show 45 More Lines...]                          │
│  └─────────────────────────────────────────────────────────────┘
│                                                                  │
│  ▶ 📄 src/types/user.ts                     +3   -1            │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Working Changes View

```
┌─────────────────────────────────────────────────────────────────┐
│  Git Tab - Working Changes                                      │
├─────────────────────────────────────────────────────────────────┤
│  📊 Modified: 2  Added: 1  Deleted: 0  Commits: 156             │
├─────────────────────────────────────────────────────────────────┤
│  [Working Changes (3)]  [Commit History]                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  3 files changed              [Expand All] [Collapse All]       │
│                                                                  │
│  ▼ M  📄 Login.tsx                    src/components/          │
│  ├─────────────────────────────────────────────────────────────┤
│  │ @@ -45,6 +45,8 @@ export function Login() {                │
│  │   const [password, setPassword] = useState('')               │
│  │ + const [error, setError] = useState('')                     │
│  │ + const [loading, setLoading] = useState(false)              │
│  │                                                               │
│  │   const handleSubmit = async () => {                         │
│  │ -   await login(email, password)                             │
│  │ +   setLoading(true)                                         │
│  │ +   try {                                                     │
│  │ +     await login(email, password)                           │
│  │                                                               │
│  │              [Show 28 More Lines...]                          │
│  └─────────────────────────────────────────────────────────────┘
│                                                                  │
│  ▶ M  📄 auth.ts                      src/utils/               │
│                                                                  │
│  ▶ A  📄 user.types.ts                src/types/               │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Color Coding

- **Green lines** (`+`) - Additions with green background
- **Red lines** (`-`) - Deletions with red background  
- **Blue lines** (`@@`) - Chunk headers with blue background
- **Gray lines** - Metadata (diff, index, ---, +++)

## Interaction

### Commit Diffs:
1. **By Default**: All files are collapsed (▶)
2. **Click File Header**: Expands to show diff (▼)
3. **Large Files**: Shows first 10 lines + "Show X More Lines..." button
4. **Click "Show More"**: Expands to full diff
5. **Click "Show Less"**: Collapses back to preview
6. **Expand All Button**: Opens all files at once
7. **Collapse All Button**: Closes all files

### Working Changes:
1. **By Default**: All files are collapsed (▶)
2. **Click File Header**: Loads and shows diff (▼)
3. **Lazy Loading**: Diff only fetches when you expand
4. **Same Truncation**: Large diffs show preview + "Show More"
5. **Expand All**: Loads all diffs simultaneously
6. **Status Badges**: M (modified), A (added), D (deleted)

## Benefits

✅ **Better Overview** - See all changed files at a glance
✅ **Faster Navigation** - Jump to specific files
✅ **Reduced Clutter** - Only see what you need
✅ **Smart Truncation** - Preview first 10 lines, expand on demand
✅ **Lazy Loading** - Working changes only load diffs when expanded
✅ **Performance** - Collapsed files don't render heavy diff content
✅ **Large Commits** - Handle commits with 50+ files easily
✅ **Large Files** - Files with 500+ line changes are manageable
✅ **Working Changes** - Same great UX for uncommitted changes
✅ **Consistent UI** - Same interface for both commit history and working changes
