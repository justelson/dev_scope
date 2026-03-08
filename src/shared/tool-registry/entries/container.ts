import type { ToolDefinition } from '../types'

export const CONTAINER_TOOLS: ToolDefinition[] = [
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
        }
]
