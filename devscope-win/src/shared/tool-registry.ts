/**
 * DevScope - Central Tool Registry
 * Single source of truth for tool definitions, metadata, and detection logic.
 */

// Define ToolCategory locally or in a shared types file to avoid circular deps
// For now we will define it here or import from a clean shared type location
export type ToolCategory = 'language' | 'package_manager' | 'build_tool' | 'container' | 'version_control' | 'browser' | 'database' | 'ai_runtime' | 'ai_agent' | 'gpu_acceleration' | 'ai_framework' | 'unknown'

export interface DetectionConfig {
    strategy: 'cli' | 'process' | 'registry' | 'custom'
    command?: string        // Command to run (if different from tool.command)
    versionArgs?: string[]  // Arguments for version check (default: ['--version'])
    versionRegex?: string   // Regex to extract version from output
    processName?: string    // For 'process' strategy (e.g. 'Ollama.exe')
    customDetector?: string // For 'custom' strategy - key to a specialized function
}

export interface ToolDefinition {
    id: string              // Unique ID (usually the command)
    command: string         // Command to check (e.g. 'node', 'python')
    displayName: string     // UI Name
    description: string     // Short description
    themeColor: string      // Brand color (hex)
    icon?: string           // Simple Icons slug (e.g. 'nodedotjs', 'python')
    website: string         // Official website
    docsUrl: string         // Documentation URL
    category: ToolCategory
    usedFor: string[]       // Tags
    capabilities?: string[] // Famous abilities (e.g. ['local-inference', 'code-generation'])
    versionArg?: string     // Custom version argument (deprecated in favor of detection.versionArgs)
    alternateCommands?: string[] // Fallback commands (e.g. 'python3' for 'python')
    detectRunning?: boolean // Check if process is active (for services like Docker)
    installCommand?: string // Command to install (e.g. 'winget install Node.js')
    detection?: DetectionConfig
}

export const TOOL_REGISTRY: ToolDefinition[] = [
    // ========================================================================
    // Languages & Runtimes
    // ========================================================================
    {
        id: 'node',
        command: 'node',
        displayName: 'Node.js',
        description: 'Node.js is a powerful, asynchronous event-driven JavaScript runtime designed to build scalable network applications. It powers a vast ecosystem of server-side tools and libraries.',
        themeColor: '#339933',
        icon: 'nodedotjs',
        website: 'https://nodejs.org',
        docsUrl: 'https://nodejs.org/en/docs/',
        category: 'language',
        usedFor: ['web', 'backend', 'electron', 'scripting', 'api'],
        installCommand: 'winget install OpenJS.NodeJS.LTS',
        detection: { strategy: 'cli' }
    },
    {
        id: 'python',
        command: 'python',
        displayName: 'Python',
        description: 'Python is a high-level, interpreted programming language known for its easy-to-read syntax and versatility. It is a standard for data science, machine learning, and web development.',
        themeColor: '#3776AB',
        icon: 'python',
        website: 'https://www.python.org',
        docsUrl: 'https://docs.python.org/3/',
        category: 'language',
        usedFor: ['ai', 'ml', 'scripting', 'backend', 'data-science', 'automation'],
        alternateCommands: ['python3', 'py'],
        installCommand: 'winget install Python.Python.3.12'
    },
    {
        id: 'java',
        command: 'java',
        displayName: 'Java',
        description: 'Java is a class-based, object-oriented programming language designed to have as few implementation dependencies as possible. It is a workhorse for enterprise applications and Android development.',
        themeColor: '#007396',
        icon: 'openjdk',
        website: 'https://www.java.com',
        docsUrl: 'https://docs.oracle.com/en/java/',
        category: 'language',
        versionArg: '-version',
        usedFor: ['backend', 'android', 'enterprise', 'web'],
        installCommand: 'winget install Oracle.JDK.21'
    },
    {
        id: 'dotnet',
        command: 'dotnet',
        displayName: '.NET',
        description: '.NET is a free, cross-platform, open source developer platform for building many different types of applications. It supports multiple languages like C#, F#, and Visual Basic.',
        themeColor: '#512BD4',
        icon: 'dotnet',
        website: 'https://dotnet.microsoft.com',
        docsUrl: 'https://learn.microsoft.com/en-us/dotnet/',
        category: 'language',
        usedFor: ['backend', 'desktop', 'web', 'gaming', 'cloud', 'mobile'],
        installCommand: 'winget install Microsoft.DotNet.SDK.8'
    },
    {
        id: 'go',
        command: 'go',
        displayName: 'Go',
        description: 'Go is an open source programming language supported by Google. It is easy to learn and excellent for building high-performance, concurrent, and scalable network services.',
        themeColor: '#00ADD8',
        icon: 'go',
        website: 'https://go.dev',
        docsUrl: 'https://go.dev/doc/',
        category: 'language',
        versionArg: 'version',
        usedFor: ['backend', 'cli', 'cloud', 'microservices'],
        installCommand: 'winget install GoLang.Go'
    },
    {
        id: 'rust',
        command: 'rustc',
        displayName: 'Rust',
        description: 'Rust is a language empowering everyone to build reliable and efficient software. It guarantees memory safety and thread safety without a garbage collector.',
        themeColor: '#DEA584',
        icon: 'rust',
        website: 'https://www.rust-lang.org',
        docsUrl: 'https://doc.rust-lang.org/',
        category: 'language',
        usedFor: ['systems', 'cli', 'wasm', 'performance', 'embedded'],
        alternateCommands: ['rust'],
        installCommand: 'winget install Rustlang.Rustup'
    },
    {
        id: 'ruby',
        command: 'ruby',
        displayName: 'Ruby',
        description: 'Ruby is a dynamic, open source programming language with a focus on simplicity and productivity. It has an elegant syntax that is natural to read and easy to write, making it a favorite for web development (Rails) and scripting.',
        themeColor: '#CC342D',
        icon: 'ruby',
        website: 'https://www.ruby-lang.org',
        docsUrl: 'https://www.ruby-lang.org/en/documentation/',
        category: 'language',
        usedFor: ['web', 'scripting', 'devops', 'automation'],
        installCommand: 'winget install RubyInstallerTeam.Ruby.3.2'
    },
    {
        id: 'php',
        command: 'php',
        displayName: 'PHP',
        description: 'PHP is a popular general-purpose scripting language that is especially suited to web development. It is fast, flexible, and pragmatic, powering everything from your blog to the most popular websites in the world.',
        themeColor: '#777BB4',
        icon: 'php',
        website: 'https://www.php.net',
        docsUrl: 'https://www.php.net/docs.php',
        category: 'language',
        usedFor: ['web', 'backend', 'server-side'],
        installCommand: 'winget install PHP.PHP'
    },

    // ========================================================================
    // Package Managers
    // ========================================================================
    {
        id: 'npm',
        command: 'npm',
        displayName: 'npm',
        description: 'npm (Node Package Manager) is the default package manager for the JavaScript runtime Node.js. It consists of a command line client and an online database of public and paid-for private packages, making it the world\'s largest software registry.',
        themeColor: '#CB3837',
        icon: 'npm',
        website: 'https://www.npmjs.com',
        docsUrl: 'https://docs.npmjs.com/',
        category: 'package_manager',
        usedFor: ['nodejs', 'javascript', 'dependencies'],
        installCommand: 'Included with Node.js',
        detection: { strategy: 'cli' }
    },
    {
        id: 'pnpm',
        command: 'pnpm',
        displayName: 'pnpm',
        description: 'pnpm is a fast, disk space efficient package manager. It uses a content-addressable filesystem to store all (even different versions of) files on a disk only once, saving gigabytes of space and boosting installation speed.',
        themeColor: '#F69220',
        website: 'https://pnpm.io',
        docsUrl: 'https://pnpm.io/motivation',
        category: 'package_manager',
        usedFor: ['nodejs', 'javascript', 'monorepos'],
        installCommand: 'npm install -g pnpm',
        detection: { strategy: 'cli' }
    },
    {
        id: 'yarn',
        command: 'yarn',
        displayName: 'Yarn',
        description: 'Yarn is a package manager that doubles down on security, reliability, and speed. It caches every package it downloads so it never needs to download it again, and it parallelizes operations to maximize resource utilization.',
        themeColor: '#2C8EBB',
        website: 'https://yarnpkg.com',
        docsUrl: 'https://yarnpkg.com/getting-started',
        category: 'package_manager',
        usedFor: ['nodejs', 'javascript', 'workspaces'],
        installCommand: 'npm install -g yarn',
        detection: { strategy: 'cli' }
    },
    {
        id: 'pip',
        command: 'pip',
        displayName: 'pip',
        description: 'pip is the package installer for Python. It is the standard tool for installing and managing Python packages from the Python Package Index (PyPI) and other indexes.',
        themeColor: '#3775A9',
        website: 'https://pypi.org/project/pip/',
        docsUrl: 'https://pip.pypa.io/en/stable/',
        category: 'package_manager',
        usedFor: ['python', 'dependencies'],
        alternateCommands: ['pip3'],
        installCommand: 'Included with Python',
        detection: { strategy: 'cli' }
    },
    {
        id: 'poetry',
        command: 'poetry',
        displayName: 'Poetry',
        description: 'Poetry is a tool for dependency management and packaging in Python. It allows you to declare the libraries your project depends on and it will manage (install/update) them for you, while also providing a lockfile for reproducible builds.',
        themeColor: '#60A5FA',
        website: 'https://python-poetry.org',
        docsUrl: 'https://python-poetry.org/docs/',
        category: 'package_manager',
        usedFor: ['python', 'packaging', 'virtualenvs'],
        installCommand: 'pip install poetry'
    },
    {
        id: 'conda',
        command: 'conda',
        displayName: 'Conda',
        description: 'Conda is an open source package management system and environment management system. It effectively manages dependencies for any language, but is particularly popular in the Data Science and Machine Learning communities for managing complex scientific stacks.',
        themeColor: '#44A833',
        website: 'https://docs.conda.io',
        docsUrl: 'https://docs.conda.io/en/latest/',
        category: 'package_manager',
        usedFor: ['python', 'data-science', 'r', 'scientific-computing'],
        installCommand: 'winget install Anaconda.Miniconda3'
    },
    {
        id: 'chocolatey',
        command: 'choco',
        displayName: 'Chocolatey',
        description: 'Chocolatey is a software management automation for Windows. It wraps installers, executables, zips, and scripts into compiled packages, allowing you to manage your Windows software with the same ease as a Linux package manager.',
        themeColor: '#80B5EA',
        website: 'https://chocolatey.org',
        docsUrl: 'https://docs.chocolatey.org/en-us/',
        category: 'package_manager',
        usedFor: ['windows', 'system', 'automation'],
        alternateCommands: ['chocolatey'],
        installCommand: 'Set-ExecutionPolicy Bypass -Scope Process -Force; iex ((New-Object System.Net.WebClient).DownloadString("https://community.chocolatey.org/install.ps1"))'
    },
    {
        id: 'winget',
        command: 'winget',
        displayName: 'WinGet',
        description: 'WinGet is the official Windows Package Manager CLI. It is a comprehensive command-line tool that enables developers to discover, install, upgrade, remove, and configure applications on Windows 10 and Windows 11 computers.',
        themeColor: '#00D1F1',
        website: 'https://learn.microsoft.com/en-us/windows/package-manager/',
        docsUrl: 'https://learn.microsoft.com/en-us/windows/package-manager/winget/',
        category: 'package_manager',
        usedFor: ['windows', 'system', 'microsoft'],
        installCommand: 'Pre-installed on Windows 11'
    },
    {
        id: 'gem',
        command: 'gem',
        displayName: 'RubyGems',
        description: 'RubyGems is a package manager for the Ruby programming language that provides a standard format for distributing Ruby programs and libraries (called Gems), a tool for managing the installation of Gems, and a server for distributing them.',
        themeColor: '#E9573F',
        website: 'https://rubygems.org',
        docsUrl: 'https://guides.rubygems.org/',
        category: 'package_manager',
        usedFor: ['ruby', 'libraries'],
        installCommand: 'Included with Ruby'
    },
    {
        id: 'composer',
        command: 'composer',
        displayName: 'Composer',
        description: 'Composer is a tool for dependency management in PHP. It allows you to declare the libraries your project depends on and it will manage (install/update) them for you.',
        themeColor: '#885630',
        website: 'https://getcomposer.org',
        docsUrl: 'https://getcomposer.org/doc/',
        category: 'package_manager',
        usedFor: ['php', 'dependencies'],
        installCommand: 'winget install Composer.Composer'
    },

    // ========================================================================
    // Build Tools
    // ========================================================================
    {
        id: 'cmake',
        command: 'cmake',
        displayName: 'CMake',
        description: 'CMake is an open-source, cross-platform family of tools designed to build, test and package software. It is used to control the software compilation process using simple platform and compiler independent configuration files.',
        themeColor: '#064F8C',
        website: 'https://cmake.org',
        docsUrl: 'https://cmake.org/documentation/',
        category: 'build_tool',
        usedFor: ['c++', 'native', 'build-system'],
        installCommand: 'winget install Kitware.CMake'
    },
    {
        id: 'make',
        command: 'make',
        displayName: 'Make',
        description: 'GNU Make is a tool which controls the generation of executables and other non-source files of a program from the program\'s source files. It is the gold standard for build automation in Unix-like environments.',
        themeColor: '#000000',
        website: 'https://www.gnu.org/software/make/',
        docsUrl: 'https://www.gnu.org/software/make/manual/',
        category: 'build_tool',
        usedFor: ['c', 'c++', 'native', 'automation'],
        installCommand: 'winget install GnuWin32.Make',
        detection: { strategy: 'cli' }
    },
    {
        id: 'gradle',
        command: 'gradle',
        displayName: 'Gradle',
        description: 'Gradle is a build automation tool for multi-language software development. It controls the development process in the tasks of compilation and packaging to testing, deployment, and publishing. It is the official build tool for Android.',
        themeColor: '#02303A',
        website: 'https://gradle.org',
        docsUrl: 'https://docs.gradle.org/',
        category: 'build_tool',
        usedFor: ['java', 'android', 'kotlin', 'automation'],
        installCommand: 'winget install Gradle.Gradle',
        detection: { strategy: 'cli' }
    },
    {
        id: 'maven',
        command: 'mvn',
        displayName: 'Maven',
        description: 'Maven is a build automation tool used primarily for Java projects. It addresses two aspects of building software: how software is built, and its dependencies. It uses an XML file (pom.xml) to describe the software project being built.',
        themeColor: '#C71A36',
        website: 'https://maven.apache.org',
        docsUrl: 'https://maven.apache.org/guides/',
        category: 'build_tool',
        usedFor: ['java', 'dependency-management'],
        alternateCommands: ['maven'],
        installCommand: 'winget install Apache.Maven',
        detection: { strategy: 'cli' }
    },
    {
        id: 'msbuild',
        command: 'msbuild',
        displayName: 'MSBuild',
        description: 'MSBuild (Microsoft Build Engine) is a platform for building applications. It provides an XML schema for a project file that controls how the build platform processes and builds software. It is the build system for Visual Studio.',
        themeColor: '#9363D8',
        website: 'https://github.com/dotnet/msbuild',
        docsUrl: 'https://learn.microsoft.com/en-us/visualstudio/msbuild/msbuild',
        category: 'build_tool',
        usedFor: ['dotnet', 'windows', 'visual-studio'],
        installCommand: 'Included with Visual Studio or .NET SDK',
        detection: { strategy: 'cli' }
    },

    // ========================================================================
    // Containers & Virtualization
    // ========================================================================
    {
        id: 'docker',
        command: 'docker',
        displayName: 'Docker',
        description: 'Docker is a platform designed to help developers build, share, and run modern applications. It handles the boring setup, so you can focus on the code.',
        themeColor: '#2496ED',
        website: 'https://www.docker.com',
        docsUrl: 'https://docs.docker.com/',
        category: 'container',
        detectRunning: true,
        usedFor: ['containers', 'devops', 'virtualization'],
        installCommand: 'winget install Docker.DockerDesktop',
        detection: { strategy: 'process', processName: 'Docker Desktop' }
    },
    {
        id: 'podman',
        command: 'podman',
        displayName: 'Podman',
        description: 'Podman is a daemonless, open source, Linux native tool designed to make it easy to find, run, build, share and deploy applications using Open Containers Initiative (OCI) Containers and Container Images. It is compatible with the Docker CLI.',
        themeColor: '#892CA0',
        website: 'https://podman.io',
        docsUrl: 'https://docs.podman.io/',
        category: 'container',
        usedFor: ['containers', 'linux', 'security'],
        installCommand: 'winget install RedHat.Podman',
        detection: { strategy: 'cli' }
    },
    {
        id: 'wsl',
        command: 'wsl',
        displayName: 'WSL',
        description: 'WSL (Windows Subsystem for Linux) lets developers run a GNU/Linux environment -- including most command-line tools, utilities, and applications -- directly on Windows, unmodified, without the overhead of a traditional virtual machine or dual-boot setup.',
        themeColor: '#4E96E6',
        website: 'https://learn.microsoft.com/en-us/windows/wsl/',
        docsUrl: 'https://learn.microsoft.com/en-us/windows/wsl/',
        category: 'container',
        detectRunning: true,
        usedFor: ['linux', 'development', 'windows'],
        installCommand: 'wsl --install',
        detection: { strategy: 'cli' }
    },

    // ========================================================================
    // Version Control
    // ========================================================================
    {
        id: 'git',
        command: 'git',
        displayName: 'Git',
        description: 'Git is a free and open source distributed version control system designed to handle everything from small to very large projects with speed and efficiency.',
        themeColor: '#F05032',
        website: 'https://git-scm.com',
        docsUrl: 'https://git-scm.com/doc',
        category: 'version_control',
        usedFor: ['version-control', 'collaboration', 'source-code'],
        installCommand: 'winget install Git.Git',
        detection: { strategy: 'cli' }
    },
    {
        id: 'git-lfs',
        command: 'git-lfs',
        displayName: 'Git LFS',
        description: 'Git LFS (Large File Storage) is an open source Git extension for versioning large files. It replaces large files such as audio samples, videos, datasets, and graphics with text pointers inside Git, while storing the file contents on a remote server.',
        themeColor: '#F05032',
        website: 'https://git-lfs.com',
        docsUrl: 'https://github.com/git-lfs/git-lfs/wiki/Tutorial',
        category: 'version_control',
        usedFor: ['version-control', 'large-files', 'media'],
        installCommand: 'winget install GitHub.GitLFS',
        detection: { strategy: 'cli' }
    },

    // ========================================================================
    // AI & ML Runtimes
    // ========================================================================
    {
        id: 'ollama',
        command: 'ollama',
        displayName: 'Ollama',
        description: 'Ollama is a lightweight framework for running large language models locally. It provides a simple API for creating, running, and managing LLMs, making it easy to run models like Llama, Mistral, and more on your own hardware.',
        themeColor: '#FFFFFF',
        website: 'https://ollama.ai',
        docsUrl: 'https://github.com/ollama/ollama/blob/main/docs/README.md',
        category: 'ai_runtime',
        usedFor: ['local-llm', 'inference', 'ai', 'ml'],
        capabilities: ['Local Inference', 'Model Management', 'Open API'],
        detectRunning: true,
        installCommand: 'winget install Ollama.Ollama',
        detection: { strategy: 'process', processName: 'ollama' }
    },
    {
        id: 'lmstudio',
        command: 'lmstudio',
        displayName: 'LM Studio',
        description: 'LM Studio is a desktop application for discovering, downloading, and running local LLMs. It provides a user-friendly interface for managing models and includes an OpenAI-compatible API server.',
        themeColor: '#4A90D9',
        website: 'https://lmstudio.ai',
        docsUrl: 'https://lmstudio.ai/docs',
        category: 'ai_runtime',
        usedFor: ['local-llm', 'inference', 'ai', 'gui'],
        capabilities: ['GUI', 'Model Discovery', 'Local Inference'],
        detectRunning: true,
        installCommand: 'Download from https://lmstudio.ai',
        detection: { strategy: 'process', processName: 'LM Studio' }
    },
    {
        id: 'jan',
        command: 'jan',
        displayName: 'Jan',
        description: 'Jan is an open-source alternative to ChatGPT that runs 100% offline on your computer. It provides a clean, user-friendly interface for chatting with local LLMs.',
        themeColor: '#7C3AED',
        website: 'https://jan.ai',
        docsUrl: 'https://jan.ai/docs',
        category: 'ai_runtime',
        usedFor: ['local-llm', 'inference', 'ai', 'gui', 'offline'],
        capabilities: ['GUI', 'Offline AI', 'Private Chat'],
        detectRunning: true,
        installCommand: 'Download from https://jan.ai',
        detection: { strategy: 'process', processName: 'Jan' }
    },
    {
        id: 'gpt4all',
        command: 'gpt4all',
        displayName: 'GPT4All',
        description: 'GPT4All is an ecosystem of open-source chatbots that run locally on consumer grade CPUs and any GPU. It allows you to chat with models, use your own documents as private data, and more.',
        themeColor: '#000000',
        website: 'https://gpt4all.io',
        docsUrl: 'https://docs.gpt4all.io',
        category: 'ai_runtime',
        usedFor: ['local-llm', 'inference', 'ai', 'cpu-optimized'],
        capabilities: ['CPU Inference', 'Local Documents', 'Chat GUI'],
        installCommand: 'Download from https://gpt4all.io'
    },
    {
        id: 'open-webui',
        command: 'open-webui',
        displayName: 'Open WebUI',
        description: 'Open WebUI is an extensible, self-hosted interface for LLMs. It supports Ollama, OpenAI-compatible APIs, and more, providing a rich, ChatGPT-like experience with full control.',
        themeColor: '#3B82F6',
        website: 'https://openwebui.com',
        docsUrl: 'https://docs.openwebui.com',
        category: 'ai_runtime',
        usedFor: ['web-gui', 'self-hosted', 'ollama', 'frontend'],
        capabilities: ['Web Interface', 'Multi-Model Support', 'RAG Support'],
        installCommand: 'docker run -d -p 3000:8080 --add-host=host.docker.internal:host-gateway -v open-webui:/app/backend/data --name open-webui ghcr.io/open-webui/open-webui:main'
    },
    {
        id: 'cuda',
        command: 'nvcc',
        displayName: 'NVIDIA CUDA',
        description: 'CUDA is a parallel computing platform and programming model developed by NVIDIA for general computing on GPUs. It enables dramatic increases in computing performance by harnessing the power of the GPU for AI and ML workloads.',
        themeColor: '#76B900',
        website: 'https://developer.nvidia.com/cuda-toolkit',
        docsUrl: 'https://docs.nvidia.com/cuda/',
        category: 'ai_runtime',
        usedFor: ['gpu', 'ai', 'ml', 'deep-learning', 'parallel-computing'],
        capabilities: ['GPU Acceleration', 'Parallel Computing', 'Deep Learning'],
        alternateCommands: ['nvidia-smi'],
        installCommand: 'Download from https://developer.nvidia.com/cuda-downloads'
    },
    {
        id: 'pytorch',
        command: 'python',
        displayName: 'PyTorch',
        description: 'PyTorch is an open source machine learning framework based on the Torch library. It provides tensor computation with strong GPU acceleration and deep neural networks built on a tape-based autograd system.',
        themeColor: '#EE4C2C',
        website: 'https://pytorch.org',
        docsUrl: 'https://pytorch.org/docs/stable/index.html',
        category: 'ai_runtime',
        usedFor: ['gpu', 'ai', 'ml', 'deep-learning'],
        capabilities: ['Model Training', 'Production ML', 'Data Pipeline'],
        detection: { strategy: 'cli', versionRegex: '(\\d+\\.\\d+\\.\\d+)' },
        installCommand: 'pip install torch torchvision torchaudio'
    },
    {
        id: 'tensorflow',
        command: 'python',
        displayName: 'TensorFlow',
        description: 'TensorFlow is an end-to-end open source platform for machine learning. It has a comprehensive, flexible ecosystem of tools, libraries, and community resources that lets researchers push the state-of-the-art in ML.',
        themeColor: '#FF6F00',
        website: 'https://www.tensorflow.org',
        docsUrl: 'https://www.tensorflow.org/api_docs',
        category: 'ai_framework',
        usedFor: ['ai', 'ml', 'deep-learning', 'production'],
        capabilities: ['Tensors', 'Keras', 'Neural Networks', 'Edge AI'],
        detection: { strategy: 'custom', customDetector: 'tensorflow' },
        installCommand: 'pip install tensorflow'
    },
    {
        id: 'vllm',
        command: 'vllm',
        displayName: 'vLLM',
        description: 'vLLM is a high-throughput and memory-efficient inference and serving engine for LLMs. It uses PagedAttention to efficiently manage attention key and value memory, delivering state-of-the-art serving performance.',
        themeColor: '#4C51BF',
        website: 'https://vllm.ai',
        docsUrl: 'https://docs.vllm.ai/',
        category: 'ai_runtime',
        usedFor: ['serving', 'inference', 'performance', 'gpu'],
        capabilities: ['High Throughput', 'PagedAttention', 'API Serving'],
        installCommand: 'pip install vllm'
    },

    // ========================================================================
    // AI Agents & Coding Assistants
    // ========================================================================
    {
        id: 'claude-code',
        command: 'claude',
        displayName: 'Claude Code',
        description: 'Claude Code is an agentic coding tool by Anthropic that lives in your terminal. It can understand your codebase, edit files, run commands, and help you code faster with AI assistance.',
        themeColor: '#D97757',
        icon: 'anthropic',
        website: 'https://docs.anthropic.com/en/docs/claude-code',
        docsUrl: 'https://docs.anthropic.com/en/docs/claude-code',
        category: 'ai_agent',
        usedFor: ['ai', 'coding', 'terminal', 'automation'],
        capabilities: ['Agentic Editing', 'Terminal Assistant', 'Context Awareness'],
        installCommand: 'npm install -g @anthropic-ai/claude-code',
        detection: { strategy: 'cli', versionRegex: '(\\d+\\.\\d+\\.\\d+)' }
    },
    {
        id: 'github-copilot-cli',
        command: 'gh copilot',
        displayName: 'GitHub Copilot CLI',
        description: 'GitHub Copilot in the CLI brings AI-powered suggestions to your terminal. Get command suggestions, explanations, and shell command generation powered by GitHub Copilot.',
        themeColor: '#6e40c9',
        icon: 'githubcopilot',
        website: 'https://docs.github.com/en/copilot/github-copilot-in-the-cli',
        docsUrl: 'https://docs.github.com/en/copilot/github-copilot-in-the-cli',
        category: 'ai_agent',
        usedFor: ['ai', 'coding', 'terminal', 'github'],
        capabilities: ['Shell Suggestions', 'Command Explanation', 'CLI Automation'],
        alternateCommands: ['ghcs'],
        installCommand: 'gh extension install github/gh-copilot',
        detection: { strategy: 'cli' }
    },
    {
        id: 'aider',
        command: 'aider',
        displayName: 'Aider',
        description: 'Aider is an AI pair programming tool in your terminal. It lets you pair program with LLMs to edit code in your local git repo. Works with GPT-4, Claude, and other models.',
        themeColor: '#14B8A6',
        icon: 'aider',
        website: 'https://aider.chat',
        docsUrl: 'https://aider.chat/docs/',
        category: 'ai_agent',
        usedFor: ['ai', 'coding', 'pair-programming', 'git'],
        capabilities: ['Pair Programming', 'Git Integration', 'Terminal UI'],
        installCommand: 'pip install aider-install && aider-install',
        detection: { strategy: 'cli' }
    },
    {
        id: 'cursor',
        command: 'cursor',
        displayName: 'Cursor',
        description: 'Cursor is an AI-first code editor built for pair programming with AI. It features intelligent code completion, chat, and the ability to edit code with natural language.',
        themeColor: '#000000',
        icon: 'cursor',
        website: 'https://cursor.com',
        docsUrl: 'https://docs.cursor.com',
        category: 'ai_agent',
        usedFor: ['ai', 'coding', 'editor', 'ide'],
        capabilities: ['AI IDE', 'Code Editing', 'Codebase Chat'],
        installCommand: 'Download from https://cursor.com',
        detection: { strategy: 'cli' }
    },
    {
        id: 'windsurf',
        command: 'windsurf',
        displayName: 'Windsurf',
        description: 'Windsurf is the first agentic IDE, built by Codeium. It features "Flow" which allows agents and humans to work together seamlessly on complex coding tasks with deep context awareness.',
        themeColor: '#09B6A2',
        icon: 'codeium',
        website: 'https://codeium.com/windsurf',
        docsUrl: 'https://codeium.com/docs',
        category: 'ai_agent',
        usedFor: ['ai', 'coding', 'ide', 'agentic-flow'],
        capabilities: ['Agentic Flow', 'Deep Context', 'AI IDE'],
        installCommand: 'Download from https://codeium.com/windsurf'
    },
    {
        id: 'zed',
        command: 'zed',
        displayName: 'Zed',
        description: 'Zed is a high-performance, multiplayer code editor from the creators of Atom and Tree-sitter. It features native AI integration and is built for speed.',
        themeColor: '#000000',
        icon: 'zedindustries',
        website: 'https://zed.dev',
        docsUrl: 'https://zed.dev/docs',
        category: 'ai_agent',
        usedFor: ['ai', 'coding', 'editor', 'performance'],
        capabilities: ['High Performance', 'Multiplayer Coding', 'Native AI'],
        installCommand: 'winget install Zed.Zed'
    },
    {
        id: 'cody-cli',
        command: 'cody',
        displayName: 'Sourcegraph Cody',
        description: 'Cody is an AI coding assistant by Sourcegraph that understands your entire codebase. It provides context-aware code completions, explanations, and can answer questions about your code.',
        themeColor: '#FF5543',
        icon: 'sourcegraph',
        website: 'https://sourcegraph.com/cody',
        docsUrl: 'https://sourcegraph.com/docs/cody',
        category: 'ai_agent',
        usedFor: ['ai', 'coding', 'search', 'codebase'],
        capabilities: ['Codebase Awareness', 'Contextual Chat', 'Precise Search'],
        installCommand: 'npm install -g @sourcegraph/cody-agent'
    },
    {
        id: 'continue',
        command: 'continue',
        displayName: 'Continue',
        description: 'Continue is an open-source AI code assistant. It connects any LLM to your IDE for autocomplete, chat, and embeddings. Supports VS Code and JetBrains.',
        themeColor: '#1389FD',
        icon: 'continuedev',
        website: 'https://continue.dev',
        docsUrl: 'https://docs.continue.dev',
        category: 'ai_agent',
        usedFor: ['ai', 'coding', 'open-source', 'ide'],
        capabilities: ['Open Source', 'LLM Agnostic', 'IDE Extension'],
        installCommand: 'Search "Continue" in VS Code Extensions'
    },
    {
        id: 'open-interpreter',
        command: 'interpreter',
        displayName: 'Open Interpreter',
        description: 'Open Interpreter lets LLMs run code (Python, Javascript, Shell, and more) locally. You can chat with it in your terminal to control your computer and automate tasks.',
        themeColor: '#000000',
        icon: 'openai',
        website: 'https://openinterpreter.com',
        docsUrl: 'https://docs.openinterpreter.com',
        category: 'ai_agent',
        usedFor: ['ai', 'automation', 'terminal', 'code-execution'],
        capabilities: ['Code Execution', 'OS Control', 'Task Automation'],
        installCommand: 'pip install open-interpreter'
    },
    {
        id: 'fabric',
        command: 'fabric',
        displayName: 'Fabric',
        description: 'Fabric is an open-source framework for augmenting humans using AI. It provides a set of crowdsourced "patterns" for common AI tasks like summarizing, extracting wisdom, and more.',
        themeColor: '#000000',
        icon: 'openai',
        website: 'https://github.com/danielmiessler/fabric',
        docsUrl: 'https://github.com/danielmiessler/fabric',
        category: 'ai_agent',
        usedFor: ['ai', 'workflow', 'patterns', 'augmentation'],
        capabilities: ['AI Patterns', 'Content Synthesis', 'Modular AI'],
        installCommand: 'pipx install fabric-ai'
    },
    {
        id: 'shellgpt',
        command: 'sgpt',
        displayName: 'ShellGPT',
        description: 'ShellGPT is a command-line productivity tool powered by AI. It helps you generate shell commands, write code, and get answers directly in your terminal.',
        themeColor: '#4A5568',
        icon: 'gnubash',
        website: 'https://github.com/khulnasoft/shell-gpt',
        docsUrl: 'https://github.com/khulnasoft/shell-gpt',
        category: 'ai_agent',
        usedFor: ['ai', 'terminal', 'productivity', 'shell'],
        capabilities: ['Shell Generation', 'Quick Answers', 'Terminal Native'],
        alternateCommands: ['shell-gpt'],
        installCommand: 'pip install shell-gpt'
    },
    {
        id: 'tabnine',
        command: 'tabnine',
        displayName: 'Tabnine',
        description: 'Tabnine is an AI code assistant that provides intelligent code completions. It learns from your codebase and supports multiple languages and IDEs.',
        themeColor: '#6B54D3',
        icon: 'tabnine',
        website: 'https://www.tabnine.com',
        docsUrl: 'https://docs.tabnine.com',
        category: 'ai_agent',
        usedFor: ['ai', 'coding', 'autocomplete', 'privacy'],
        capabilities: ['Local Autocomplete', 'Private Training', 'Enterprise Grade'],
        installCommand: 'Search "Tabnine" in VS Code Extensions'
    },
    {
        id: 'codeium',
        command: 'codeium',
        displayName: 'Codeium',
        description: 'Codeium is a free AI-powered code acceleration toolkit. It provides autocomplete, search, and chat features across 70+ languages and 40+ IDEs.',
        themeColor: '#09B6A2',
        icon: 'codeium',
        website: 'https://codeium.com',
        docsUrl: 'https://codeium.com/documentation',
        category: 'ai_agent',
        usedFor: ['ai', 'coding', 'free', 'autocomplete'],
        capabilities: ['Free Tier', 'Fast Autocomplete', 'Broad IDE Support'],
        installCommand: 'Search "Codeium" in VS Code Extensions'
    },
    {
        id: 'goose',
        command: 'goose',
        displayName: 'Goose',
        description: 'Goose is an open-source AI developer agent that automates engineering tasks. It can write code, run shell commands, and manage files autonomously.',
        themeColor: '#F97316',
        icon: 'go',
        website: 'https://github.com/block/goose',
        docsUrl: 'https://github.com/block/goose',
        category: 'ai_agent',
        usedFor: ['ai', 'coding', 'automation', 'open-source'],
        capabilities: ['Autonomous Agent', 'Tool Using', 'Open Source'],
        installCommand: 'curl -fsSL https://github.com/block/goose/releases/download/stable/install.sh | bash'
    },
    {
        id: 'mentat',
        command: 'mentat',
        displayName: 'Mentat',
        description: 'Mentat is an AI coding assistant that coordinates edits across multiple files. It understands your codebase context and can make complex multi-file changes.',
        themeColor: '#8B5CF6',
        icon: 'openai',
        website: 'https://mentat.ai',
        docsUrl: 'https://github.com/AbanteAI/mentat',
        category: 'ai_agent',
        usedFor: ['ai', 'coding', 'multi-file', 'context'],
        capabilities: ['Multi-file Edits', 'Graph Context', 'Git Integrated'],
        installCommand: 'pip install mentat-ai'
    },
    {
        id: 'gpt-engineer',
        command: 'gpt-engineer',
        displayName: 'GPT Engineer',
        description: 'GPT Engineer is an AI agent that generates entire codebases from a prompt. Specify what you want to build and it creates the complete project structure.',
        themeColor: '#10B981',
        icon: 'openai',
        website: 'https://gptengineer.app',
        docsUrl: 'https://github.com/gpt-engineer-org/gpt-engineer',
        category: 'ai_agent',
        usedFor: ['ai', 'coding', 'generation', 'scaffolding'],
        capabilities: ['Project Generation', 'Rapid Scaffolding', 'Prompt to Code'],
        installCommand: 'pip install gpt-engineer'
    },
    {
        id: 'plandex',
        command: 'plandex',
        displayName: 'Plandex',
        description: 'Plandex is an open-source, terminal-based AI coding engine. it can handle complex, multi-stage tasks that span many files and directories, with a focus on reliability and developer control.',
        themeColor: '#000000',
        icon: 'gnubash',
        website: 'https://plandex.ai',
        docsUrl: 'https://github.com/plandex-ai/plandex',
        category: 'ai_agent',
        usedFor: ['ai', 'coding', 'terminal', 'multi-file'],
        capabilities: ['Complex Tasks', 'Multi-file Editing', 'Terminal Based'],
        installCommand: 'curl -sL https://plandex.ai/install.sh | bash'
    },
    {
        id: 'openhands',
        command: 'openhands',
        displayName: 'OpenHands',
        description: 'OpenHands (formerly OpenDevin) is an open-source platform for AI software agents. It aims to build agents that can interact with the world by writing code, using the terminal, and browsing the web.',
        themeColor: '#2563EB',
        icon: 'openai',
        website: 'https://github.com/All-Hands-AI/OpenHands',
        docsUrl: 'https://all-hands-ai.github.io/OpenHands/',
        category: 'ai_agent',
        usedFor: ['ai', 'coding', 'automation', 'open-source'],
        capabilities: ['Autonomous Coding', 'Web Browsing', 'Terminal Access'],
        installCommand: 'docker pull ghcr.io/all-hands-ai/openhands:main'
    },
    {
        id: 'supermaven',
        command: 'supermaven',
        displayName: 'Supermaven',
        description: 'Supermaven is an ultra-fast AI code completion tool with a 1-million-token context window. It provides near-instant suggestions and understands your entire codebase.',
        themeColor: '#F59E0B',
        icon: 'openai',
        website: 'https://supermaven.com',
        docsUrl: 'https://supermaven.com/docs',
        category: 'ai_agent',
        usedFor: ['ai', 'coding', 'autocomplete', 'fast'],
        capabilities: ['Huge Context', 'Ultra Fast', 'IDE Native'],
        installCommand: 'Search "Supermaven" in VS Code Extensions'
    },
    {
        id: 'phind',
        command: 'phind',
        displayName: 'Phind',
        description: 'Phind is an intelligent search engine and pair programmer for developers. It combines the power of LLMs with real-time web search to provide accurate answers and code examples.',
        themeColor: '#000000',
        icon: 'openai',
        website: 'https://phind.com',
        docsUrl: 'https://phind.com/docs',
        category: 'ai_agent',
        usedFor: ['ai', 'search', 'coding', 'pair-programming'],
        capabilities: ['AI Search', 'Code Generation', 'Web Integrated'],
        installCommand: 'Search "Phind" in VS Code Extensions'
    },
    {
        id: 'sweep',
        command: 'sweep',
        displayName: 'Sweep',
        description: 'Sweep is an AI junior developer that turns GitHub issues into pull requests. It reads your codebase, plans changes, and writes code to fix bugs and implement features.',
        themeColor: '#7C3AED',
        icon: 'github',
        website: 'https://sweep.dev',
        docsUrl: 'https://docs.sweep.dev',
        category: 'ai_agent',
        usedFor: ['ai', 'coding', 'github', 'automation'],
        capabilities: ['Issue to PR', 'Automated Bug Fix', 'Github Native'],
        installCommand: 'Install Sweep GitHub App from github.com/apps/sweep-ai'
    },
    {
        id: 'gemini-cli',
        command: 'gemini',
        displayName: 'Gemini CLI',
        description: 'Gemini CLI is Google\'s AI-powered command-line tool that brings Gemini directly to your terminal. It can help with coding, answer questions, and assist with various development tasks.',
        themeColor: '#4285F4',
        icon: 'googlegemini',
        website: 'https://github.com/google-gemini/gemini-cli',
        docsUrl: 'https://github.com/google-gemini/gemini-cli',
        category: 'ai_agent',
        usedFor: ['ai', 'coding', 'terminal', 'google'],
        capabilities: ['Gemini AI', 'Terminal Native', 'Code Assistance'],
        installCommand: 'npm install -g @google/gemini-cli'
    },
    {
        id: 'opencode',
        command: 'opencode',
        displayName: 'OpenCode',
        description: 'OpenCode is a terminal-based AI coding assistant. It provides an interactive coding experience with AI assistance directly in your terminal.',
        themeColor: '#10B981',
        icon: 'go',
        website: 'https://github.com/opencode-ai/opencode',
        docsUrl: 'https://github.com/opencode-ai/opencode',
        category: 'ai_agent',
        usedFor: ['ai', 'coding', 'terminal', 'open-source'],
        capabilities: ['Terminal UI', 'Code Editing', 'Open Source'],
        installCommand: 'curl -fsSL https://raw.githubusercontent.com/sst/opencode/main/install.sh | bash'
    },
    {
        id: 'droid',
        command: 'droid',
        displayName: 'Factory Droid',
        description: 'Factory Droid is an enterprise-grade AI coding agent that lives in your terminal. It handles end-to-end development workflows, understands your codebase, and integrates with tools like Jira, Notion, and Slack.',
        themeColor: '#6366F1',
        icon: 'android',
        website: 'https://factory.ai',
        docsUrl: 'https://docs.factory.ai',
        category: 'ai_agent',
        usedFor: ['ai', 'coding', 'terminal', 'enterprise'],
        capabilities: ['Agentic Coding', 'Enterprise Integration', 'Multi-file Edits'],
        installCommand: 'curl -fsSL https://factory.ai/install.sh | bash'
    },
    {
        id: 'codex-cli',
        command: 'codex',
        displayName: 'Codex CLI',
        description: 'Codex CLI is OpenAI\'s command-line coding assistant. It brings the power of OpenAI models to your terminal for code generation and assistance.',
        themeColor: '#10A37F',
        icon: 'openai',
        website: 'https://github.com/openai/codex-cli',
        docsUrl: 'https://github.com/openai/codex-cli',
        category: 'ai_agent',
        usedFor: ['ai', 'coding', 'terminal', 'openai'],
        capabilities: ['OpenAI Models', 'Code Generation', 'Terminal Native'],
        installCommand: 'npm install -g @openai/codex'
    },
    {
        id: 'amazon-q',
        command: 'q',
        displayName: 'Amazon Q Developer',
        description: 'Amazon Q Developer is AWS\'s AI-powered assistant for software development. It provides code suggestions, answers questions, and helps with AWS services.',
        themeColor: '#FF9900',
        icon: 'amazonaws',
        website: 'https://aws.amazon.com/q/developer/',
        docsUrl: 'https://docs.aws.amazon.com/amazonq/',
        category: 'ai_agent',
        usedFor: ['ai', 'coding', 'aws', 'cloud'],
        capabilities: ['AWS Integration', 'Code Suggestions', 'Cloud Native'],
        installCommand: 'Search "Amazon Q" in VS Code Extensions'
    },
    {
        id: 'amp',
        command: 'amp',
        displayName: 'Amp',
        description: 'Amp is a frontier coding agent by Sourcegraph that lets you wield the full power of leading models. Use it from your terminal with the CLI or as a VS Code extension.',
        themeColor: '#FF6B6B',
        icon: 'sourcegraph',
        website: 'https://ampcode.com',
        docsUrl: 'https://ampcode.com',
        category: 'ai_agent',
        usedFor: ['ai', 'coding', 'terminal', 'agentic-flow'],
        capabilities: ['Agentic Coding', 'Multi-model Support', 'Terminal & IDE'],
        installCommand: 'Search "Amp" in VS Code Extensions or visit ampcode.com'
    },
    {
        id: 'roo-code',
        command: 'roo',
        displayName: 'Roo Code',
        description: 'Roo Code is an AI coding assistant that helps developers write better code faster. It provides intelligent suggestions and code completions.',
        themeColor: '#8B5CF6',
        icon: 'openai',
        website: 'https://roo.dev',
        docsUrl: 'https://roo.dev/docs',
        category: 'ai_agent',
        usedFor: ['ai', 'coding', 'ide', 'autocomplete'],
        capabilities: ['Smart Completions', 'Code Analysis', 'IDE Integration'],
        installCommand: 'Search "Roo Code" in VS Code Extensions'
    },
    {
        id: 'cline',
        command: 'cline',
        displayName: 'Cline',
        description: 'Cline is an autonomous coding agent that lives in your IDE. It can create and edit files, run commands, and use the browser to complete complex tasks.',
        themeColor: '#EC4899',
        icon: 'visualstudiocode',
        website: 'https://github.com/cline/cline',
        docsUrl: 'https://github.com/cline/cline',
        category: 'ai_agent',
        usedFor: ['ai', 'coding', 'ide', 'agentic-flow'],
        capabilities: ['Autonomous Agent', 'File Editing', 'Browser Control'],
        installCommand: 'Search "Cline" in VS Code Extensions'
    },
    {
        id: 'kilo-code',
        command: 'kilo',
        displayName: 'Kilo Code',
        description: 'Kilo Code is an AI coding assistant focused on helping developers write clean, efficient code with intelligent suggestions.',
        themeColor: '#06B6D4',
        icon: 'openai',
        website: 'https://kilocode.ai',
        docsUrl: 'https://kilocode.ai/docs',
        category: 'ai_agent',
        usedFor: ['ai', 'coding', 'terminal', 'efficiency'],
        capabilities: ['Clean Code', 'Efficiency Focus', 'Smart Suggestions'],
        installCommand: 'Search "Kilo Code" in VS Code Extensions'
    }
]

export function getToolsByCategory(category: ToolCategory): ToolDefinition[] {
    return TOOL_REGISTRY.filter(tool => tool.category === category)
}

export function getToolById(id: string): ToolDefinition | undefined {
    if (!id) return undefined
    const lid = id.toLowerCase()
    return TOOL_REGISTRY.find(tool =>
        tool.id.toLowerCase() === lid ||
        tool.command.toLowerCase() === lid ||
        tool.alternateCommands?.some(alt => alt.toLowerCase() === lid)
    )
}
