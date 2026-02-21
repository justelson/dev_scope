import type { ToolDefinition } from '../types'

export const VERSION_CONTROL_TOOLS: ToolDefinition[] = [
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
        }
]
