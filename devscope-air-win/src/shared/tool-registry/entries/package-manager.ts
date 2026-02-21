import type { ToolDefinition } from '../types'

export const PACKAGE_MANAGER_TOOLS: ToolDefinition[] = [
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
        }
]
