# DevScope - Developer Machine Status System

A local-only Electron desktop application that audits and monitors developer machine readiness.

## User Review Required

> [!IMPORTANT]
> **Sparkle Design System**: The frontend will use the **Dark theme** by default with **Dashboard layout** and **Subtle animations**. Please confirm or request changes.

> [!NOTE]
> This is a **Windows-only** implementation as specified. macOS and Linux adapters are not included but the architecture supports future expansion.

---

## Proposed Changes

### Project Structure

```
c:\Users\elson\my_coding_play\devscope\devscope-win\
├── package.json
├── electron.vite.config.ts
├── tailwind.config.js
├── tsconfig.json
├── src/
│   ├── main/                      # Electron main process
│   │   ├── index.ts               # Main entry point
│   │   ├── ipc/                   # IPC handlers
│   │   │   ├── index.ts
│   │   │   └── handlers.ts
│   │   ├── inspectors/            # System Inspector Layer
│   │   │   ├── index.ts
│   │   │   ├── types.ts           # Shared types & interfaces
│   │   │   ├── base-inspector.ts
│   │   │   ├── system/            # System context
│   │   │   │   └── windows-system.ts
│   │   │   ├── tooling/           # Developer tooling
│   │   │   │   ├── languages.ts
│   │   │   │   ├── package-managers.ts
│   │   │   │   ├── build-tools.ts
│   │   │   │   ├── containers.ts
│   │   │   │   └── version-control.ts
│   │   │   └── ai/                # AI & ML tooling
│   │   │       ├── llm-runtimes.ts
│   │   │       ├── gpu-acceleration.ts
│   │   │       └── ai-frameworks.ts
│   │   ├── normalizer/            # Capability Normalization Engine
│   │   │   ├── index.ts
│   │   │   └── schema.ts
│   │   ├── readiness/             # Health & Readiness Scoring
│   │   │   ├── index.ts
│   │   │   ├── rules.ts
│   │   │   └── scorer.ts
│   │   └── ai-analysis/           # AI Analysis Layer (Pluggable)
│   │       ├── index.ts
│   │       ├── local-adapter.ts
│   │       └── remote-adapter.ts
│   ├── preload/                   # Preload scripts
│   │   └── index.ts
│   └── renderer/                  # Frontend (React + Sparkle)
│       ├── index.html
│       ├── src/
│       │   ├── main.tsx
│       │   ├── App.tsx
│       │   ├── index.css          # Sparkle theme variables
│       │   ├── components/
│       │   │   ├── layout/
│       │   │   │   ├── TitleBar.tsx
│       │   │   │   ├── Sidebar.tsx
│       │   │   │   └── Dashboard.tsx
│       │   │   ├── cards/
│       │   │   │   ├── SystemOverview.tsx
│       │   │   │   ├── ToolingCard.tsx
│       │   │   │   ├── AIRuntimeCard.tsx
│       │   │   │   └── ReadinessScore.tsx
│       │   │   └── ui/
│       │   │       ├── Button.tsx
│       │   │       ├── Badge.tsx
│       │   │       └── ProgressRing.tsx
│       │   ├── hooks/
│       │   │   └── useDevScope.ts  # IPC hooks
│       │   └── lib/
│       │       └── utils.ts
│       └── assets/
```

---

### Core Components

#### [NEW] [package.json](file:///c:/Users/elson/my_coding_play/devscope/devscope-win/package.json)

Electron + Vite + React + TypeScript project with dependencies:
- `electron-vite` for build tooling
- `react`, `react-dom`, `react-router-dom` for UI
- `tailwindcss` with Sparkle tokens
- `lucide-react` for icons
- `clsx` for class utilities
- **`systeminformation`** for system data (like Sparkle app)
- `zustand` for state management
- `electron-log` for logging

---

#### [NEW] [types.ts](file:///c:/Users/elson/my_coding_play/devscope/devscope-win/src/main/inspectors/types.ts)

Normalized capability schema:

```typescript
interface Capability {
  tool: string
  installed: boolean
  version?: string
  status: 'healthy' | 'warning' | 'error' | 'unknown'
  usedFor: string[]
  metadata?: Record<string, unknown>
}

interface SystemHealth {
  os: { name: string; version: string; arch: string }
  cpu: { model: string; cores: number; usage?: number }
  ram: { total: number; available: number; used: number }
  disk: { total: number; available: number; path: string }[]
  gpu: { name: string; vram?: number; driver?: string }[]
}

interface ReadinessReport {
  level: 'ready' | 'partial' | 'not_ready'
  score: number // 0-100
  warnings: Warning[]
  recommendations: Recommendation[]
}
```

---

#### [NEW] [windows-system.ts](file:///c:/Users/elson/my_coding_play/devscope/devscope-win/src/main/inspectors/system/windows-system.ts)

Windows system inspector using:
- **PowerShell** for system info (`Get-CimInstance`, `Get-WmiObject`)
- **Registry reads** (read-only) for installed software
- Whitelisted commands only for security

```typescript
// Example: Get CPU info
async function getCpuInfo(): Promise<CpuInfo> {
  const result = await execPowerShell(
    'Get-CimInstance -ClassName Win32_Processor | Select-Object Name, NumberOfCores'
  )
  return parseCpuOutput(result)
}
```

---

#### [NEW] [languages.ts](file:///c:/Users/elson/my_coding_play/devscope/devscope-win/src/main/inspectors/tooling/languages.ts)

Detects installed languages & runtimes:

| Tool | Detection Method |
|------|------------------|
| Node.js | `node --version` |
| Python | `python --version`, `py --version` |
| Java | `java --version` |
| .NET | `dotnet --version` |
| Go | `go version` |
| Rust | `rustc --version` |

---

#### [NEW] [llm-runtimes.ts](file:///c:/Users/elson/my_coding_play/devscope/devscope-win/src/main/inspectors/ai/llm-runtimes.ts)

Detects local AI runtimes:

| Runtime | Detection Method |
|---------|------------------|
| Ollama | `ollama --version`, check port 11434 |
| LM Studio | Check common install paths, running process |
| LocalAI | Check running process, API endpoint |
| CUDA | `nvcc --version`, `nvidia-smi` |

---

#### [NEW] [handlers.ts](file:///c:/Users/elson/my_coding_play/devscope/devscope-win/src/main/ipc/handlers.ts)

IPC API contract:

```typescript
// Exposed via Electron IPC
ipcMain.handle('devscope:getSystemOverview', async () => SystemHealth)
ipcMain.handle('devscope:getDeveloperTooling', async () => ToolingReport)
ipcMain.handle('devscope:getAIRuntimeStatus', async () => AIRuntimeReport)
ipcMain.handle('devscope:getReadinessReport', async () => ReadinessReport)
ipcMain.handle('devscope:refreshAll', async () => FullReport)
```

---

#### [NEW] [index.css](file:///c:/Users/elson/my_coding_play/devscope/devscope-win/src/renderer/src/index.css)

Sparkle Design System tokens (from global skill):

```css
:root {
  --color-bg: #0c121f;
  --color-text: #f0f4f8;
  --color-card: #131c2c;
  --color-border: #1f2a3d;
  --color-primary: #4f90e6;
  --color-secondary: #3db58a;
  /* ... full Sparkle dark theme */
}
```

---

#### [NEW] [Dashboard.tsx](file:///c:/Users/elson/my_coding_play/devscope/devscope-win/src/renderer/src/components/layout/Dashboard.tsx)

Main dashboard layout with Sparkle styling (modeled after Sparkle's Home.jsx):
- **TitleBar** with window controls (minimize, maximize, close)
- **Sidebar** with navigation (Home, Dev Tools, AI, Settings)
- **Content area** with InfoCard grid

---

#### [NEW] [Home.tsx](file:///c:/Users/elson/my_coding_play/devscope/devscope-win/src/renderer/src/pages/Home.tsx)

**System Information Dashboard** (inspired by Sparkle's Home.jsx):

```tsx
// Grid layout with InfoCard components for system info
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
  <InfoCard icon={Cpu} iconBgColor="bg-blue-500/10" iconColor="text-blue-500"
    title="CPU" subtitle="Processor Information"
    items={[
      { label: "Model", value: systemInfo?.cpu_model },
      { label: "Cores", value: `${systemInfo?.cpu_cores} Cores` },
      { label: "Threads", value: `${systemInfo?.cpu_threads} Threads` }
    ]} />
  
  <InfoCard icon={Monitor} iconBgColor="bg-green-500/10" iconColor="text-green-500"
    title="GPU" subtitle="Graphics Information"
    items={[
      { label: "Model", value: systemInfo?.gpu_model },
      { label: "VRAM", value: systemInfo?.vram }
    ]} />
  
  <InfoCard icon={MemoryStick} iconBgColor="bg-purple-500/10" iconColor="text-purple-500"
    title="Memory" subtitle="RAM Information"
    items={[
      { label: "Total", value: formatBytes(systemInfo?.memory_total) },
      { label: "Type", value: systemInfo?.memory_type }
    ]} />
  
  <InfoCard icon={Server} iconBgColor="bg-red-500/10" iconColor="text-red-500"
    title="System" subtitle="OS Information"
    items={[
      { label: "Operating System", value: systemInfo?.os },
      { label: "Version", value: systemInfo?.os_version }
    ]} />
  
  <InfoCard icon={HardDrive} iconBgColor="bg-orange-500/10" iconColor="text-orange-500"
    title="Storage" subtitle="Disk Information"
    items={[
      { label: "Primary Disk", value: systemInfo?.disk_model },
      { label: "Total Space", value: systemInfo?.disk_size }
    ]} />
  
  <InfoCard icon={Zap} iconBgColor="bg-yellow-500/10" iconColor="text-yellow-500"
    title="Readiness" subtitle="Developer Readiness Score"
    items={[
      { label: "Score", value: `${readinessScore}%` },
      { label: "Status", value: readinessLevel }
    ]} />
</div>
```

---

#### [NEW] [InfoCard.tsx](file:///c:/Users/elson/my_coding_play/devscope/devscope-win/src/renderer/src/components/ui/InfoCard.tsx)

Reusable InfoCard component (adapted from Sparkle):

```tsx
const InfoCard = ({ icon: Icon, iconBgColor, iconColor, title, subtitle, items }) => (
  <div className="bg-sparkle-card backdrop-blur-sm rounded-xl border border-sparkle-border hover:shadow-sm overflow-hidden p-5">
    <div className="flex items-start gap-3 mb-4">
      <div className={cn("p-3 rounded-lg", iconBgColor)}>
        <Icon className={cn("text-lg", iconColor)} size={24} />
      </div>
      <div>
        <h2 className="text-lg font-semibold text-sparkle-text mb-1">{title}</h2>
        {subtitle && <p className="text-sparkle-text-secondary text-sm">{subtitle}</p>}
      </div>
    </div>
    <div className="space-y-3">
      {items.map((item, index) => (
        <div key={index}>
          <p className="text-sparkle-text-secondary text-xs mb-1">{item.label}</p>
          <p className="text-sparkle-text font-medium">{item.value}</p>
        </div>
      ))}
    </div>
  </div>
)
```

---

## Security Implementation

```typescript
// Whitelisted commands only - no shell injection
const ALLOWED_COMMANDS = new Set([
  'node', 'python', 'py', 'java', 'dotnet', 'go', 'rustc',
  'npm', 'pnpm', 'yarn', 'pip', 'poetry', 'conda', 'choco',
  'docker', 'git', 'ollama', 'nvcc', 'nvidia-smi'
])

async function safeExec(command: string, args: string[]): Promise<string> {
  if (!ALLOWED_COMMANDS.has(command)) {
    throw new Error(`Command not whitelisted: ${command}`)
  }
  // Use execFile (not exec) to prevent shell injection
  return execFileAsync(command, args)
}
```

---

## Verification Plan

### Automated Tests

No existing tests to build upon (fresh project). We will verify manually.

### Manual Verification

1. **Build and Launch**
   ```bash
   cd c:\Users\elson\my_coding_play\devscope\devscope-win
   npm install
   npm run dev
   ```
   - Verify Electron window opens
   - Verify no console errors

2. **System Detection**
   - Check that OS info displays correctly
   - Verify CPU/RAM/Disk stats are accurate
   - Confirm GPU detection (if present)

3. **Developer Tooling**
   - Verify installed tools show as "healthy"
   - Confirm missing tools show as "not installed"
   - Check version numbers are accurate

4. **AI Runtime Detection**
   - If Ollama is installed, verify it's detected
   - Check CUDA detection (if NVIDIA GPU present)

5. **Readiness Score**
   - Verify score calculation reflects detected tools
   - Check warnings display for missing items
   - Confirm recommendations are shown

6. **UI/UX Verification**
   - Confirm Sparkle dark theme is applied
   - Test window controls (minimize, maximize, close)
   - Verify sidebar navigation works
   - Check responsive layout

---

## Sparkle Design Configuration

Based on the global Sparkle skill, I recommend:

| Setting | Value | Reason |
|---------|-------|--------|
| **Creativity Level** | 3 (Balanced) | Mix of standard patterns with custom touches |
| **Layout Type** | Dashboard | Data-heavy with cards and stats |
| **Theme** | Dark | Developer-focused, reduces eye strain |
| **Animations** | Subtle | Professional feel without distraction |

**DOES THIS LOOK GOOD TO YOU?** Or would you like to customize any of these settings?
