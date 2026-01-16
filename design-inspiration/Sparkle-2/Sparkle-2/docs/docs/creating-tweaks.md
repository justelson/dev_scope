---
title: Creating Tweaks
---

# Tweak Guidelines

This page describes how to structure and define tweaks for the application.

---

## Directory Structure

All tweaks should follow this format:

```text
resources/
└── tweaks/
    └── example-tweak/
        ├── apply.ps1
        ├── unapply.ps1   # optional if the tweak is reversible
        └── meta.json
```

!!! tip

    If the tweak does not have an unapply script, do **not** create a `unapply.ps1`.

---

## `meta.json` Properties

Each tweak **must** have a `meta.json`. The available properties are:

| Property             | Type                               | Description                                                                      |
| -------------------- | ---------------------------------- | -------------------------------------------------------------------------------- |
| **name**             | `string`                           | Folder name of the tweak.                                                        |
| **title**            | `string`                           | Text displayed in the UI.                                                        |
| **reversible**       | `bool` (optional, defaults `true`) | If false, the UI shows an "Apply" button instead of a toggle.                    |
| **modal**            | `string` (optional)                | Text shown in a modal before applying the tweak.                                 |
| **category**         | `string[]`                         | Used to sort tweaks in the UI.                                                   |
| **warning**          | `string` (optional)                | Displays an icon in the UI; hover to see the warning.                            |
| **restart**          | `bool` (optional)                  | Shows a message that a restart is required.                                      |
| **deep-description** | `string` (optional)                | Detailed description of the tweak. used for documentation. and supports markdown |
| **links**            | `string[]` (optional)              | Related resources or references.                                                 |

---

## Tweak Categories

Tweaks can be grouped into these categories:

- **General** — General purpose tweaks.
- **Appearance** — Changes Windows appearance.
- **Performance** — Improves system or gaming performance.
- **Privacy** — Enhances user privacy.
- **Gaming** — Optimizations for FPS, game services, or GPU settings.
- **Network** — Adjusts network settings.
- **GPU** — Modifies GPU-related settings.

---

## Example Tweak

Here’s an example of a `meta.json` for a tweak:

!!! note

    This is an example and is not a real tweak or contains real links

```json
{
  "name": "disable-animations",
  "title": "Disable Animations",
  "reversible": true,
  "modal": "Disabling animations can improve performance but may reduce visual effects.",
  "category": ["Performance", "Appearance"],
  "warning": "Some apps may not display smoothly.",
  "restart": true,
  "links": ["https://docs.microsoft.com/en-us/windows/animations"]
}
```

---
