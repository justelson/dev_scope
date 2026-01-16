# Sparkle Component Patterns

Reference guide for common UI patterns using Sparkle design system.

## Cards

### Basic Card
```jsx
<div className="bg-sparkle-card rounded-xl border border-sparkle-border p-5">
  Content
</div>
```

### Card with Header
```jsx
<div className="bg-sparkle-card rounded-xl border border-sparkle-border overflow-hidden">
  <div className="p-5 border-b border-sparkle-border">
    <h3 className="font-semibold text-sparkle-text">Title</h3>
  </div>
  <div className="p-5">
    Content
  </div>
</div>
```

### Interactive Card
```jsx
<div className="bg-sparkle-card rounded-xl border border-sparkle-border p-5 hover:border-sparkle-primary transition-colors cursor-pointer">
  Clickable content
</div>
```

## Buttons

### Button Group
```jsx
<div className="flex gap-2">
  <Button variant="primary">Save</Button>
  <Button variant="secondary">Cancel</Button>
</div>
```

### Icon Button
```jsx
<button className="p-2 rounded-lg text-sparkle-text-secondary hover:bg-sparkle-accent hover:text-sparkle-text transition-colors">
  <Icon size={20} />
</button>
```

## Lists

### Settings List
```jsx
<div className="divide-y divide-sparkle-border">
  {items.map(item => (
    <div key={item.id} className="flex items-center justify-between py-4">
      <div>
        <p className="text-sparkle-text font-medium">{item.title}</p>
        <p className="text-sparkle-text-secondary text-sm">{item.description}</p>
      </div>
      <Toggle checked={item.enabled} onChange={() => toggle(item.id)} />
    </div>
  ))}
</div>
```

### Action List
```jsx
<div className="space-y-2">
  {actions.map(action => (
    <button
      key={action.id}
      className="w-full flex items-center gap-3 p-3 rounded-lg text-sparkle-text-secondary hover:bg-sparkle-accent hover:text-sparkle-text transition-colors"
    >
      <action.icon size={20} />
      <span>{action.label}</span>
    </button>
  ))}
</div>
```

## Forms

### Form Group
```jsx
<div className="space-y-4">
  <Input label="Email" type="email" placeholder="you@example.com" />
  <Input label="Password" type="password" />
  <Button variant="primary" className="w-full">Sign In</Button>
</div>
```

### Inline Form
```jsx
<div className="flex gap-2">
  <Input placeholder="Search..." className="flex-1" />
  <Button variant="primary">Search</Button>
</div>
```

## Alerts & Badges

### Alert
```jsx
<div className="flex items-start gap-3 p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
  <AlertTriangle className="text-yellow-500 flex-shrink-0" size={20} />
  <div>
    <p className="font-medium text-yellow-500">Warning</p>
    <p className="text-sparkle-text-secondary text-sm">This action cannot be undone.</p>
  </div>
</div>
```

### Badge
```jsx
<span className="px-2 py-0.5 text-xs font-medium rounded-full bg-sparkle-primary/10 text-sparkle-primary">
  New
</span>
```

### Status Indicator
```jsx
<div className="flex items-center gap-2">
  <div className="w-2 h-2 rounded-full bg-green-500" />
  <span className="text-sm text-sparkle-text-secondary">Online</span>
</div>
```

## Navigation

### Tab Bar
```jsx
<div className="flex border-b border-sparkle-border">
  {tabs.map(tab => (
    <button
      key={tab.id}
      className={cn(
        "px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors",
        activeTab === tab.id
          ? "border-sparkle-primary text-sparkle-primary"
          : "border-transparent text-sparkle-text-secondary hover:text-sparkle-text"
      )}
    >
      {tab.label}
    </button>
  ))}
</div>
```

### Breadcrumb
```jsx
<nav className="flex items-center gap-2 text-sm">
  <a href="/" className="text-sparkle-text-secondary hover:text-sparkle-text">Home</a>
  <span className="text-sparkle-text-muted">/</span>
  <a href="/settings" className="text-sparkle-text-secondary hover:text-sparkle-text">Settings</a>
  <span className="text-sparkle-text-muted">/</span>
  <span className="text-sparkle-text">Profile</span>
</nav>
```

## Empty States

```jsx
<div className="flex flex-col items-center justify-center py-12 text-center">
  <div className="p-4 rounded-full bg-sparkle-accent mb-4">
    <Inbox className="text-sparkle-text-secondary" size={32} />
  </div>
  <h3 className="text-lg font-medium text-sparkle-text mb-1">No items yet</h3>
  <p className="text-sparkle-text-secondary mb-4">Get started by creating your first item.</p>
  <Button variant="primary">Create Item</Button>
</div>
```

## Color Accents

Use these background/text color combinations for icons and highlights:

| Color | Background | Text |
|-------|------------|------|
| Blue | `bg-blue-500/10` | `text-blue-500` |
| Green | `bg-green-500/10` | `text-green-500` |
| Yellow | `bg-yellow-500/10` | `text-yellow-500` |
| Red | `bg-red-500/10` | `text-red-500` |
| Purple | `bg-purple-500/10` | `text-purple-500` |
| Orange | `bg-orange-500/10` | `text-orange-500` |
