<div align="center">
  <pre>
    ██
 ██████╗ ███████╗██╗   ██╗███████╗ ██████╗ ██████╗ ██████╗ ███████╗
 ██╔══██╗██╔════╝██║   ██║██╔════╝██╔════╝██╔═══██╗██╔══██╗██╔════╝
 ██║  ██║█████╗  ██║   ██║███████╗██║     ██║   ██║██████╔╝█████╗  
 ██║  ██║██╔══╝  ╚██╗ ██╔╝╚════██║██║     ██║   ██║██╔═══╝ ██╔══╝  
 ██████╔╝███████╗ ╚████╔╝ ███████║╚██████╗╚██████╔╝██║     ███████╗
 ╚═════╝ ╚══════╝  ╚═══╝  ╚══════╝ ╚═════╝ ╚═════╝ ╚═╝     ╚══════╝
  </pre>
</div>

<h1 align="center">DevScope</h1>

<p align="center">
  <strong>Unified Tool Sensing & AI Orchestration for Modern Developers</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Platform-Windows-blue?style=for-the-badge&logo=windows" alt="Windows Support"> <img src="https://img.shields.io/badge/License-MIT-green?style=for-the-badge" alt="License"> <img src="https://img.shields.io/badge/PRs-Welcome-brightgreen?style=for-the-badge" alt="PRs Welcome">
</p>

---

## Overview

DevScope is a high-performance, unified sensing system designed to give developers an crystal-clear view of their local development environment. It automatically discovers your tools, AI runtimes, and agentic frameworks, providing a centralized dashboard and integrated terminal experience.

Mainly targeted for Windows developers, DevScope eliminates the "fragmented environment" problem by providing a single source of truth for your developer stack.

## Key Features

| Feature | Description |
| :--- | :--- |
| **Unified Tool Sensing** | Automatically detects 50+ developer tools (Languages, Package Managers, Build Tools, Containers, Version Control). |
| **AI Runtime Discovery** | Deep-scans for Ollama, CUDA, Jan, LM Studio, and other local LLM runtimes. |
| **Agentic Frameworks** | Seamlessly detects and launches AI coding assistants like Claude Code, Aider, and Codex. |
| **AI Commit Assistant** | Integrated Groq-powered AI that generates detailed, conventional commit messages based on your diffs. |
| **Integrated Terminal** | A premium, XTerm-powered terminal with persistent context and PTY support. |
| **Modern Aesthetics** | A high-end UI built with the Sparkle Design System, featuring glassmorphism and smooth animations. |

## Supported Tool Categories

```mermaid
pie title DevScope Coverage
    "Languages" : 15
    "Package Managers" : 8
    "Build Tools" : 6
    "Containers" : 4
    "AI Runtimes" : 10
    "AI Agents" : 5
```

## Technology Stack

DevScope is built with a focus on performance and native Windows integration:

- **Frontend**: Vite + React + Tailwind CSS
- **Backend**: Electron (Main Process)
- **Design Core**: Sparkle Design System (Vanilla CSS + Custom Components)
- **AI Integration**: Groq API (Llama 3.1 8B Instant)
- **Sensing Engine**: Strategy-based Node.js engine with CLI, Process, and Custom Detectors

## Getting Started

### Prerequisites

- **Node.js**: v18.x or higher
- **npm**: v9.x or higher
- **Windows 10/11**: (Current primary target)

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/elsonmgaya/devscope.git
   cd devscope-win
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

### Running in Development

```bash
npm run dev
```

### Building for Production

```bash
npm run build
```

## Project Structure

```mermaid
graph TD
    A[Electron Main] --> B[Sensing Engine]
    A --> C[IPC Handlers]
    A --> D[Terminal Manager]
    C --> E[Renderer Process]
    E --> F[Vite/React UI]
    F --> G[Sparkle Design System]
    B --> H[Tool Registry]
    B --> I[Persistent Cache]
```

## Contributing

We welcome contributions! If you're a developer looking to improve tool detection or enhance the UI, feel free to submit a Pull Request.

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git checkout origin feature/AmazingFeature`)
5. Open a Pull Request

## Acknowledgements

Special thanks to the [Sparkle Design System](https://github.com/sparkle-design-system) for the UI framework and design inspiration that powers DevScope's modern aesthetic.

## License

Distributed under the MIT License. See `LICENSE` for more information.

---

<p align="center">
  Built with ❤️ for the developer community.
</p>
