import { exec } from 'child_process'
import { promisify } from 'util'
import log from 'electron-log'
import { join, relative } from 'path'

const execAsync = promisify(exec)

export type GitFileStatus = 'modified' | 'untracked' | 'added' | 'deleted' | 'renamed' | 'ignored' | 'unknown'

export interface GitStatusMap {
    [relativePath: string]: GitFileStatus
}

/**
 * Get git status for a project
 */
export async function getGitStatus(projectPath: string): Promise<GitStatusMap> {
    try {
        // limit output to 5000 lines to prevent buffer overflow on huge repos
        const { stdout } = await execAsync('git status --porcelain', {
            cwd: projectPath,
            maxBuffer: 10 * 1024 * 1024 // 10MB
        })

        const statusMap: GitStatusMap = {}

        stdout.split('\n').forEach(line => {
            if (!line.trim()) return

            // Format: "XY Path/to/file"
            // X = index status, Y = working tree status
            const statusPart = line.substring(0, 2)
            const filePath = line.substring(3).trim()

            // Clean quotes if present (git status can quote paths with spaces)
            const cleanPath = filePath.replace(/^"|"$/g, '')

            // Normalize slashes to match system
            const normalizedPath = cleanPath.split('/').join('\\') // Windows specific since we know user is on Windows
            // Actually, best to handle both

            let status: GitFileStatus = 'unknown'

            if (statusPart === '??') status = 'untracked'
            else if (statusPart === '!!') status = 'ignored'
            else if (statusPart.includes('M')) status = 'modified'
            else if (statusPart.includes('A')) status = 'added'
            else if (statusPart.includes('D')) status = 'deleted'
            else if (statusPart.includes('R')) status = 'renamed'

            // Normalize to forward slashes for consistency in map keys if needed, 
            // but file system usually returns backslashes on Windows.
            // Let's store both likely lookup keys or standardise.
            statusMap[cleanPath] = status
            statusMap[cleanPath.replace(/\//g, '\\')] = status // Store windows style too
        })

        return statusMap
    } catch (err) {
        // Not a git repo or git not installed
        // log.warn('Failed to get git status (probably not a git repo)', err)
        return {}
    }
}

export interface GitCommit {
    hash: string
    shortHash: string
    parents: string[]
    author: string
    date: string
    message: string
}

export interface GitHistoryResult {
    commits: GitCommit[]
}

/**
 * Get git history for a project
 */
export async function getGitHistory(projectPath: string, limit: number = 100): Promise<GitHistoryResult> {
    try {
        // Format: Hash|Parents|Author|Date|Message
        // Parents are space-separated
        const format = "%H|%P|%an|%ad|%s"

        const { stdout } = await execAsync(`git log --all --date=iso --pretty=format:"${format}" -n ${limit}`, {
            cwd: projectPath,
            maxBuffer: 10 * 1024 * 1024
        })

        const commits: GitCommit[] = []

        stdout.split('\n').forEach(line => {
            if (!line.trim()) return

            const parts = line.split('|')
            if (parts.length < 5) return

            const hash = parts[0]
            const parents = parts[1] ? parts[1].split(' ') : []
            const author = parts[2]
            const date = parts[3]
            const message = parts.slice(4).join('|') // Rejoin in case message contained |

            commits.push({
                hash,
                shortHash: hash.substring(0, 7),
                parents,
                author,
                date,
                message
            })
        })

        return { commits }
    } catch (err) {
        // log.warn('Failed to get git history', err)
        return { commits: [] }
    }
}

/**
 * Get diff for a specific commit
 */
export async function getCommitDiff(projectPath: string, commitHash: string): Promise<string> {
    try {
        const { stdout } = await execAsync(`git show ${commitHash} --format=fuller`, {
            cwd: projectPath,
            maxBuffer: 10 * 1024 * 1024 // 10MB
        })

        return stdout
    } catch (err) {
        log.error('Failed to get commit diff', err)
        throw new Error('Failed to get commit diff')
    }
}

/**
 * Get diff for working changes (unstaged + staged)
 */
export async function getWorkingDiff(projectPath: string, filePath?: string): Promise<string> {
    try {
        // Get both staged and unstaged changes
        const fileArg = filePath ? ` -- "${filePath}"` : ''
        const { stdout: staged } = await execAsync(`git diff --cached${fileArg}`, {
            cwd: projectPath,
            maxBuffer: 10 * 1024 * 1024
        }).catch(() => ({ stdout: '' }))
        
        const { stdout: unstaged } = await execAsync(`git diff${fileArg}`, {
            cwd: projectPath,
            maxBuffer: 10 * 1024 * 1024
        }).catch(() => ({ stdout: '' }))

        // Combine both diffs
        let combined = ''
        if (staged) combined += staged + '\n'
        if (unstaged) combined += unstaged
        
        return combined || 'No changes'
    } catch (err) {
        log.error('Failed to get working diff', err)
        throw new Error('Failed to get working diff')
    }
}

/**
 * Get unpushed commits (commits that exist locally but not on remote)
 */
export async function getUnpushedCommits(projectPath: string): Promise<GitCommit[]> {
    try {
        // Get current branch
        const { stdout: branch } = await execAsync('git rev-parse --abbrev-ref HEAD', {
            cwd: projectPath
        })
        const currentBranch = branch.trim()
        
        // Get unpushed commits
        const format = "%H|%P|%an|%ad|%s"
        const { stdout } = await execAsync(`git log origin/${currentBranch}..HEAD --date=iso --pretty=format:"${format}"`, {
            cwd: projectPath,
            maxBuffer: 10 * 1024 * 1024
        }).catch(() => ({ stdout: '' }))

        const commits: GitCommit[] = []
        
        if (!stdout.trim()) return commits

        stdout.split('\n').forEach(line => {
            if (!line.trim()) return

            const parts = line.split('|')
            if (parts.length < 5) return

            const hash = parts[0]
            const parents = parts[1] ? parts[1].split(' ') : []
            const author = parts[2]
            const date = parts[3]
            const message = parts.slice(4).join('|')

            commits.push({
                hash,
                shortHash: hash.substring(0, 7),
                parents,
                author,
                date,
                message
            })
        })

        return commits
    } catch (err) {
        // No remote or other error
        return []
    }
}

/**
 * Get git user configuration
 */
export async function getGitUser(projectPath: string): Promise<{ name: string; email: string } | null> {
    try {
        const { stdout: name } = await execAsync('git config user.name', {
            cwd: projectPath
        }).catch(() => ({ stdout: '' }))
        
        const { stdout: email } = await execAsync('git config user.email', {
            cwd: projectPath
        }).catch(() => ({ stdout: '' }))

        if (!name.trim() && !email.trim()) return null

        return {
            name: name.trim(),
            email: email.trim()
        }
    } catch (err) {
        return null
    }
}

/**
 * Get repository owner/author from remote URL
 */
export async function getRepoOwner(projectPath: string): Promise<string | null> {
    try {
        const { stdout } = await execAsync('git config --get remote.origin.url', {
            cwd: projectPath
        }).catch(() => ({ stdout: '' }))

        if (!stdout.trim()) return null

        // Parse owner from various git URL formats
        // https://github.com/owner/repo.git
        // git@github.com:owner/repo.git
        const url = stdout.trim()
        
        // HTTPS format
        let match = url.match(/https?:\/\/[^\/]+\/([^\/]+)\//)
        if (match) return match[1]
        
        // SSH format
        match = url.match(/:([^\/]+)\//)
        if (match) return match[1]
        
        return null
    } catch (err) {
        return null
    }
}

/**
 * Stage files for commit
 */
export async function stageFiles(projectPath: string, files: string[]): Promise<void> {
    try {
        if (files.length === 0) return
        
        const fileArgs = files.map(f => `"${f}"`).join(' ')
        await execAsync(`git add ${fileArgs}`, {
            cwd: projectPath
        })
    } catch (err) {
        log.error('Failed to stage files', err)
        throw new Error('Failed to stage files')
    }
}

/**
 * Create a commit
 */
export async function createCommit(projectPath: string, message: string): Promise<void> {
    try {
        await execAsync(`git commit -m "${message.replace(/"/g, '\\"')}"`, {
            cwd: projectPath
        })
    } catch (err) {
        log.error('Failed to create commit', err)
        throw new Error('Failed to create commit')
    }
}

/**
 * Push commits to remote
 */
export async function pushCommits(projectPath: string): Promise<void> {
    try {
        await execAsync('git push', {
            cwd: projectPath,
            maxBuffer: 10 * 1024 * 1024
        })
    } catch (err) {
        log.error('Failed to push commits', err)
        throw new Error('Failed to push commits')
    }
}

/**
 * Check if a directory is a git repository
 */
export async function checkIsGitRepo(projectPath: string): Promise<boolean> {
    try {
        await execAsync('git rev-parse --git-dir', {
            cwd: projectPath
        })
        return true
    } catch (err) {
        return false
    }
}

/**
 * Initialize a git repository
 */
export async function initGitRepo(
    projectPath: string,
    branchName: string,
    createGitignore: boolean,
    gitignoreTemplate?: string
): Promise<{ success: boolean; error?: string }> {
    try {
        // Initialize git repo
        await execAsync('git init', {
            cwd: projectPath
        })

        // Set default branch name
        await execAsync(`git branch -M ${branchName}`, {
            cwd: projectPath
        })

        // Create .gitignore if requested
        if (createGitignore && gitignoreTemplate) {
            const { writeFile } = await import('fs/promises')
            const gitignorePath = join(projectPath, '.gitignore')
            await writeFile(gitignorePath, gitignoreTemplate, 'utf-8')
        }

        return { success: true }
    } catch (err: any) {
        log.error('Failed to initialize git repo', err)
        return { success: false, error: err.message || 'Failed to initialize git repository' }
    }
}

/**
 * Create initial commit
 */
export async function createInitialCommit(projectPath: string, message: string): Promise<{ success: boolean; error?: string }> {
    try {
        // Stage all files
        await execAsync('git add .', {
            cwd: projectPath
        })

        // Create commit
        await execAsync(`git commit -m "${message.replace(/"/g, '\\"')}"`, {
            cwd: projectPath
        })

        return { success: true }
    } catch (err: any) {
        log.error('Failed to create initial commit', err)
        return { success: false, error: err.message || 'Failed to create initial commit' }
    }
}

/**
 * Add remote origin
 */
export async function addRemoteOrigin(projectPath: string, remoteUrl: string): Promise<{ success: boolean; error?: string }> {
    try {
        await execAsync(`git remote add origin "${remoteUrl}"`, {
            cwd: projectPath
        })

        return { success: true }
    } catch (err: any) {
        log.error('Failed to add remote origin', err)
        return { success: false, error: err.message || 'Failed to add remote origin' }
    }
}

/**
 * Get .gitignore templates based on project type
 */
export function getGitignoreTemplates(): string[] {
    return [
        'Node.js',
        'Python',
        'Rust',
        'Go',
        'Java',
        '.NET',
        'Ruby',
        'PHP',
        'C/C++',
        'Dart/Flutter',
        'Elixir',
        'General',
        'Custom'
    ]
}

/**
 * Get available gitignore patterns/tags
 */
export interface GitignorePattern {
    id: string
    label: string
    description: string
    category: 'dependencies' | 'build' | 'environment' | 'ide' | 'os' | 'logs' | 'cache' | 'testing'
    patterns: string[]
}

export function getGitignorePatterns(): GitignorePattern[] {
    return [
        // Dependencies
        {
            id: 'node_modules',
            label: 'node_modules',
            description: 'Node.js dependencies',
            category: 'dependencies',
            patterns: ['node_modules/', 'npm-debug.log*', 'yarn-debug.log*', 'yarn-error.log*', 'pnpm-debug.log*']
        },
        {
            id: 'vendor',
            label: 'vendor',
            description: 'PHP/Ruby dependencies',
            category: 'dependencies',
            patterns: ['vendor/', 'composer.lock']
        },
        {
            id: 'python_venv',
            label: 'Python Virtual Env',
            description: 'Python virtual environments',
            category: 'dependencies',
            patterns: ['venv/', 'env/', 'ENV/', '.venv', '__pycache__/', '*.py[cod]', '*$py.class']
        },
        {
            id: 'rust_target',
            label: 'Rust target',
            description: 'Rust build directory',
            category: 'dependencies',
            patterns: ['target/', 'Cargo.lock']
        },
        {
            id: 'go_vendor',
            label: 'Go vendor',
            description: 'Go dependencies',
            category: 'dependencies',
            patterns: ['vendor/', 'go.work']
        },

        // Build outputs
        {
            id: 'dist',
            label: 'dist',
            description: 'Distribution/build output',
            category: 'build',
            patterns: ['dist/', 'build/', 'out/']
        },
        {
            id: 'next_build',
            label: 'Next.js build',
            description: 'Next.js build files',
            category: 'build',
            patterns: ['.next/', '.nuxt/', '.cache/']
        },
        {
            id: 'compiled',
            label: 'Compiled files',
            description: 'Compiled binaries and objects',
            category: 'build',
            patterns: ['*.exe', '*.dll', '*.so', '*.dylib', '*.o', '*.obj', '*.class', '*.jar', '*.war']
        },
        {
            id: 'dotnet_build',
            label: '.NET build',
            description: '.NET build outputs',
            category: 'build',
            patterns: ['bin/', 'obj/', '*.suo', '*.user']
        },

        // Environment
        {
            id: 'env_files',
            label: '.env files',
            description: 'Environment variables',
            category: 'environment',
            patterns: ['.env', '.env.local', '.env.*.local', '.env.development', '.env.production']
        },
        {
            id: 'secrets',
            label: 'Secrets',
            description: 'Secret keys and credentials',
            category: 'environment',
            patterns: ['*.key', '*.pem', '*.p12', 'secrets.json', 'credentials.json']
        },
        {
            id: 'config_local',
            label: 'Local configs',
            description: 'Local configuration files',
            category: 'environment',
            patterns: ['config.local.*', 'settings.local.*', '*.local.json']
        },

        // IDE
        {
            id: 'vscode',
            label: 'VS Code',
            description: 'Visual Studio Code settings',
            category: 'ide',
            patterns: ['.vscode/']
        },
        {
            id: 'idea',
            label: 'IntelliJ IDEA',
            description: 'JetBrains IDE settings',
            category: 'ide',
            patterns: ['.idea/', '*.iml', '*.iws', '*.ipr']
        },
        {
            id: 'vim',
            label: 'Vim',
            description: 'Vim swap files',
            category: 'ide',
            patterns: ['*.swp', '*.swo', '*~', '.*.swp']
        },
        {
            id: 'sublime',
            label: 'Sublime Text',
            description: 'Sublime Text settings',
            category: 'ide',
            patterns: ['*.sublime-project', '*.sublime-workspace']
        },
        {
            id: 'visual_studio',
            label: 'Visual Studio',
            description: 'Visual Studio files',
            category: 'ide',
            patterns: ['.vs/', '*.suo', '*.user', '*.userosscache', '*.sln.docstates']
        },

        // OS
        {
            id: 'macos',
            label: 'macOS',
            description: 'macOS system files',
            category: 'os',
            patterns: ['.DS_Store', '.AppleDouble', '.LSOverride', '._*']
        },
        {
            id: 'windows',
            label: 'Windows',
            description: 'Windows system files',
            category: 'os',
            patterns: ['Thumbs.db', 'ehthumbs.db', 'Desktop.ini', '$RECYCLE.BIN/']
        },
        {
            id: 'linux',
            label: 'Linux',
            description: 'Linux system files',
            category: 'os',
            patterns: ['*~', '.directory', '.Trash-*']
        },

        // Logs
        {
            id: 'logs',
            label: 'Log files',
            description: 'Application logs',
            category: 'logs',
            patterns: ['*.log', 'logs/', 'log/', '*.log.*']
        },
        {
            id: 'npm_logs',
            label: 'npm logs',
            description: 'npm debug logs',
            category: 'logs',
            patterns: ['npm-debug.log*', 'yarn-debug.log*', 'yarn-error.log*', 'lerna-debug.log*']
        },

        // Cache
        {
            id: 'cache',
            label: 'Cache',
            description: 'Cache directories',
            category: 'cache',
            patterns: ['.cache/', 'cache/', '*.cache', '.parcel-cache/']
        },
        {
            id: 'temp',
            label: 'Temp files',
            description: 'Temporary files',
            category: 'cache',
            patterns: ['tmp/', 'temp/', '*.tmp', '*.temp']
        },

        // Testing
        {
            id: 'coverage',
            label: 'Coverage',
            description: 'Test coverage reports',
            category: 'testing',
            patterns: ['coverage/', '.nyc_output/', '*.lcov', 'htmlcov/']
        },
        {
            id: 'test_output',
            label: 'Test output',
            description: 'Test result files',
            category: 'testing',
            patterns: ['test-results/', 'junit.xml', '*.test', '*.spec.js.snap']
        }
    ]
}

/**
 * Generate .gitignore content based on template
 */
export function generateGitignoreContent(template: string): string {
    const templates: Record<string, string> = {
        'Node.js': `# Dependencies
node_modules/
npm-debug.log*
yarn-debug.log*
yarn-error.log*
pnpm-debug.log*

# Build outputs
dist/
build/
out/
.next/
.nuxt/
.cache/

# Environment
.env
.env.local
.env.*.local

# IDE
.vscode/
.idea/
*.swp
*.swo
*~

# OS
.DS_Store
Thumbs.db`,

        'Python': `# Byte-compiled / optimized / DLL files
__pycache__/
*.py[cod]
*$py.class

# Virtual environments
venv/
env/
ENV/
.venv

# Distribution / packaging
dist/
build/
*.egg-info/

# IDE
.vscode/
.idea/
*.swp

# Environment
.env

# OS
.DS_Store
Thumbs.db`,

        'Rust': `# Build outputs
target/
Cargo.lock

# IDE
.vscode/
.idea/
*.swp

# OS
.DS_Store
Thumbs.db`,

        'Go': `# Binaries
*.exe
*.exe~
*.dll
*.so
*.dylib

# Test binary
*.test

# Output
bin/
dist/

# Go workspace file
go.work

# IDE
.vscode/
.idea/
*.swp

# OS
.DS_Store
Thumbs.db`,

        'Java': `# Compiled class files
*.class

# Package Files
*.jar
*.war
*.nar
*.ear
*.zip
*.tar.gz
*.rar

# Build outputs
target/
build/
out/

# IDE
.vscode/
.idea/
*.iml
*.swp

# OS
.DS_Store
Thumbs.db`,

        '.NET': `# Build outputs
bin/
obj/
out/

# User-specific files
*.suo
*.user
*.userosscache
*.sln.docstates

# IDE
.vscode/
.vs/
*.swp

# OS
.DS_Store
Thumbs.db`,

        'Ruby': `# Gems
*.gem
.bundle/
vendor/bundle/

# IDE
.vscode/
.idea/
*.swp

# OS
.DS_Store
Thumbs.db`,

        'PHP': `# Composer
vendor/
composer.lock

# IDE
.vscode/
.idea/
*.swp

# Environment
.env

# OS
.DS_Store
Thumbs.db`,

        'C/C++': `# Compiled Object files
*.o
*.obj
*.exe
*.out
*.app

# Build directories
build/
cmake-build-*/

# IDE
.vscode/
.idea/
*.swp

# OS
.DS_Store
Thumbs.db`,

        'Dart/Flutter': `# Build outputs
build/
.dart_tool/
.flutter-plugins
.flutter-plugins-dependencies
.packages

# IDE
.vscode/
.idea/
*.swp

# OS
.DS_Store
Thumbs.db`,

        'Elixir': `# Build outputs
_build/
deps/
*.ez

# IDE
.vscode/
.idea/
*.swp

# OS
.DS_Store
Thumbs.db`,

        'General': `# Build outputs
dist/
build/
out/

# Dependencies
node_modules/
vendor/

# Environment
.env
.env.local

# IDE
.vscode/
.idea/
*.swp
*.swo
*~

# OS
.DS_Store
Thumbs.db
*.log`
    }

    return templates[template] || templates['General']
}

/**
 * Generate custom .gitignore content from selected patterns
 */
export function generateCustomGitignoreContent(selectedPatternIds: string[]): string {
    const allPatterns = getGitignorePatterns()
    const selectedPatterns = allPatterns.filter(p => selectedPatternIds.includes(p.id))
    
    // Group by category
    const byCategory: Record<string, GitignorePattern[]> = {}
    selectedPatterns.forEach(pattern => {
        if (!byCategory[pattern.category]) {
            byCategory[pattern.category] = []
        }
        byCategory[pattern.category].push(pattern)
    })
    
    // Generate content
    let content = '# Custom .gitignore\n\n'
    
    const categoryNames: Record<string, string> = {
        'dependencies': 'Dependencies',
        'build': 'Build Outputs',
        'environment': 'Environment & Secrets',
        'ide': 'IDE & Editors',
        'os': 'Operating System',
        'logs': 'Logs',
        'cache': 'Cache & Temp',
        'testing': 'Testing'
    }
    
    Object.entries(byCategory).forEach(([category, patterns]) => {
        content += `# ${categoryNames[category] || category}\n`
        patterns.forEach(pattern => {
            pattern.patterns.forEach(p => {
                content += `${p}\n`
            })
        })
        content += '\n'
    })
    
    return content.trim()
}
