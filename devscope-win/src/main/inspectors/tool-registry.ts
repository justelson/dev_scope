/**
 * DevScope - Tool Registry
 * Central registry for tool metadata and command suggestions
 */

export interface ToolSuggestion {
    command: string
    description: string
}

export interface ToolMetadata {
    id: string
    displayName: string
    category: string
    suggestions: ToolSuggestion[]
}

/**
 * Get command suggestions for a tool
 */
export function getToolSuggestions(toolId: string): ToolSuggestion[] {
    const registry = TOOL_REGISTRY[toolId]
    if (registry) {
        return registry.suggestions
    }

    // Fallback for unknown tools
    return [
        { command: `${toolId} --version`, description: `Check ${toolId} version` },
        { command: `${toolId} --help`, description: `Show ${toolId} help` }
    ]
}

/**
 * Tool Registry - Organized by category
 */
const TOOL_REGISTRY: Record<string, ToolMetadata> = {
    // ========== Languages ==========
    node: {
        id: 'node',
        displayName: 'Node.js',
        category: 'language',
        suggestions: [
            { command: 'node --version', description: 'Check Node.js version' },
            { command: 'node -e "console.log(process.versions)"', description: 'Show all Node.js versions' },
            { command: 'npm list -g --depth=0', description: 'List global packages' },
            { command: 'npx envinfo --system --binaries', description: 'Display system info' }
        ]
    },
    python: {
        id: 'python',
        displayName: 'Python',
        category: 'language',
        suggestions: [
            { command: 'python --version', description: 'Check Python version' },
            { command: 'python -c "import sys; print(sys.executable)"', description: 'Show Python path' },
            { command: 'pip list', description: 'List installed packages' },
            { command: 'python -m site --user-site', description: 'Show user site-packages' }
        ]
    },
    java: {
        id: 'java',
        displayName: 'Java',
        category: 'language',
        suggestions: [
            { command: 'java -version', description: 'Check Java runtime version' },
            { command: 'javac -version', description: 'Check Java compiler version' },
            { command: 'java -XshowSettings:all 2>&1 | findstr "java.home"', description: 'Show Java home' }
        ]
    },
    dotnet: {
        id: 'dotnet',
        displayName: '.NET',
        category: 'language',
        suggestions: [
            { command: 'dotnet --version', description: 'Check .NET SDK version' },
            { command: 'dotnet --list-sdks', description: 'List installed SDKs' },
            { command: 'dotnet --list-runtimes', description: 'List installed runtimes' },
            { command: 'dotnet --info', description: 'Show detailed info' }
        ]
    },
    go: {
        id: 'go',
        displayName: 'Go',
        category: 'language',
        suggestions: [
            { command: 'go version', description: 'Check Go version' },
            { command: 'go env', description: 'Show Go environment' },
            { command: 'go env GOPATH', description: 'Show Go workspace path' }
        ]
    },
    rust: {
        id: 'rust',
        displayName: 'Rust',
        category: 'language',
        suggestions: [
            { command: 'rustc --version', description: 'Check Rust compiler version' },
            { command: 'cargo --version', description: 'Check Cargo version' },
            { command: 'rustup show', description: 'Show installed toolchains' }
        ]
    },
    ruby: {
        id: 'ruby',
        displayName: 'Ruby',
        category: 'language',
        suggestions: [
            { command: 'ruby --version', description: 'Check Ruby version' },
            { command: 'gem environment', description: 'Show RubyGems environment' },
            { command: 'gem list --local', description: 'List installed gems' }
        ]
    },
    php: {
        id: 'php',
        displayName: 'PHP',
        category: 'language',
        suggestions: [
            { command: 'php --version', description: 'Check PHP version' },
            { command: 'php -m', description: 'List loaded modules' },
            { command: 'php -i | findstr "Configuration"', description: 'Show config paths' }
        ]
    },

    // ========== Package Managers ==========
    npm: {
        id: 'npm',
        displayName: 'npm',
        category: 'package_manager',
        suggestions: [
            { command: 'npm --version', description: 'Check npm version' },
            { command: 'npm config list', description: 'Show npm configuration' },
            { command: 'npm list -g --depth=0', description: 'List global packages' },
            { command: 'npm cache verify', description: 'Verify cache integrity' }
        ]
    },
    pnpm: {
        id: 'pnpm',
        displayName: 'pnpm',
        category: 'package_manager',
        suggestions: [
            { command: 'pnpm --version', description: 'Check pnpm version' },
            { command: 'pnpm store path', description: 'Show store location' },
            { command: 'pnpm list -g', description: 'List global packages' }
        ]
    },
    yarn: {
        id: 'yarn',
        displayName: 'Yarn',
        category: 'package_manager',
        suggestions: [
            { command: 'yarn --version', description: 'Check Yarn version' },
            { command: 'yarn config list', description: 'Show configuration' },
            { command: 'yarn global list', description: 'List global packages' }
        ]
    },
    pip: {
        id: 'pip',
        displayName: 'pip',
        category: 'package_manager',
        suggestions: [
            { command: 'pip --version', description: 'Check pip version' },
            { command: 'pip list', description: 'List installed packages' },
            { command: 'pip config list', description: 'Show configuration' }
        ]
    },

    // ========== Build Tools ==========
    cmake: {
        id: 'cmake',
        displayName: 'CMake',
        category: 'build_tool',
        suggestions: [
            { command: 'cmake --version', description: 'Check CMake version' },
            { command: 'cmake --help', description: 'Show CMake help' }
        ]
    },
    gradle: {
        id: 'gradle',
        displayName: 'Gradle',
        category: 'build_tool',
        suggestions: [
            { command: 'gradle --version', description: 'Check Gradle version' },
            { command: 'gradle tasks', description: 'List available tasks' }
        ]
    },
    maven: {
        id: 'maven',
        displayName: 'Maven',
        category: 'build_tool',
        suggestions: [
            { command: 'mvn --version', description: 'Check Maven version' },
            { command: 'mvn dependency:tree', description: 'Show dependency tree' }
        ]
    },

    // ========== Containers ==========
    docker: {
        id: 'docker',
        displayName: 'Docker',
        category: 'container',
        suggestions: [
            { command: 'docker --version', description: 'Check Docker version' },
            { command: 'docker info', description: 'Show system information' },
            { command: 'docker ps', description: 'List running containers' },
            { command: 'docker images', description: 'List images' },
            { command: 'docker system df', description: 'Show disk usage' }
        ]
    },
    wsl: {
        id: 'wsl',
        displayName: 'WSL',
        category: 'container',
        suggestions: [
            { command: 'wsl --list --verbose', description: 'List distributions' },
            { command: 'wsl --status', description: 'Show WSL status' },
            { command: 'wsl --list --online', description: 'List available distros' }
        ]
    },

    // ========== Version Control ==========
    git: {
        id: 'git',
        displayName: 'Git',
        category: 'version_control',
        suggestions: [
            { command: 'git --version', description: 'Check Git version' },
            { command: 'git config --list', description: 'Show configuration' },
            { command: 'git status', description: 'Show working tree status' },
            { command: 'git remote -v', description: 'List remotes' }
        ]
    },

    // ========== AI Runtimes ==========
    ollama: {
        id: 'ollama',
        displayName: 'Ollama',
        category: 'ai_runtime',
        suggestions: [
            { command: 'ollama --version', description: 'Check Ollama version' },
            { command: 'ollama list', description: 'List downloaded models' },
            { command: 'ollama ps', description: 'Show running models' }
        ]
    },

    // ========== AI Agents ==========
    aider: {
        id: 'aider',
        displayName: 'Aider',
        category: 'ai_agent',
        suggestions: [
            { command: 'aider --version', description: 'Check Aider version' },
            { command: 'aider --help', description: 'Show help' },
            { command: 'aider --list-models', description: 'List available models' }
        ]
    },
    cursor: {
        id: 'cursor',
        displayName: 'Cursor',
        category: 'ai_agent',
        suggestions: [
            { command: 'cursor --version', description: 'Check Cursor version' },
            { command: 'cursor --help', description: 'Show help' }
        ]
    }
}
