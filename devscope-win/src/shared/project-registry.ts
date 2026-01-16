/**
 * DevScope - Project Registry
 * Definitions for project types and frameworks with icons and detection patterns.
 */

// =============================================================================
// Project Type Definitions
// =============================================================================

export interface ProjectTypeDefinition {
    id: string              // Unique identifier (e.g., 'node', 'python')
    displayName: string     // Human-readable name
    icon: string            // Simple Icons slug
    themeColor: string      // Brand color (hex)
    markers: string[]       // Files/folders that identify this type
    description: string     // Short description
}

export const PROJECT_TYPES: ProjectTypeDefinition[] = [
    {
        id: 'node',
        displayName: 'Node.js',
        icon: 'nodedotjs',
        themeColor: '#339933',
        markers: ['package.json'],
        description: 'JavaScript/Node.js project'
    },
    {
        id: 'python',
        displayName: 'Python',
        icon: 'python',
        themeColor: '#3776AB',
        markers: ['requirements.txt', 'pyproject.toml', 'setup.py', 'Pipfile'],
        description: 'Python project'
    },
    {
        id: 'rust',
        displayName: 'Rust',
        icon: 'rust',
        themeColor: '#DEA584',
        markers: ['Cargo.toml'],
        description: 'Rust project'
    },
    {
        id: 'go',
        displayName: 'Go',
        icon: 'go',
        themeColor: '#00ADD8',
        markers: ['go.mod'],
        description: 'Go/Golang project'
    },
    {
        id: 'java',
        displayName: 'Java',
        icon: 'openjdk',
        themeColor: '#007396',
        markers: ['pom.xml', 'build.gradle', 'build.gradle.kts'],
        description: 'Java project'
    },
    {
        id: 'dotnet',
        displayName: '.NET',
        icon: 'dotnet',
        themeColor: '#512BD4',
        markers: ['*.csproj', '*.sln', '*.fsproj'],
        description: '.NET/C# project'
    },
    {
        id: 'ruby',
        displayName: 'Ruby',
        icon: 'ruby',
        themeColor: '#CC342D',
        markers: ['Gemfile'],
        description: 'Ruby project'
    },
    {
        id: 'php',
        displayName: 'PHP',
        icon: 'php',
        themeColor: '#777BB4',
        markers: ['composer.json'],
        description: 'PHP project'
    },
    {
        id: 'dart',
        displayName: 'Dart/Flutter',
        icon: 'dart',
        themeColor: '#0175C2',
        markers: ['pubspec.yaml'],
        description: 'Dart or Flutter project'
    },
    {
        id: 'elixir',
        displayName: 'Elixir',
        icon: 'elixir',
        themeColor: '#4B275F',
        markers: ['mix.exs'],
        description: 'Elixir project'
    },
    {
        id: 'cpp',
        displayName: 'C/C++',
        icon: 'cplusplus',
        themeColor: '#00599C',
        markers: ['CMakeLists.txt', 'Makefile'],
        description: 'C or C++ project'
    },
    {
        id: 'git',
        displayName: 'Git Repository',
        icon: 'git',
        themeColor: '#F05032',
        markers: ['.git'],
        description: 'Version controlled folder'
    },
    // =========================================================================
    // Mobile App Types
    // =========================================================================
    {
        id: 'android',
        displayName: 'Android',
        icon: 'android',
        themeColor: '#3DDC84',
        markers: ['settings.gradle', 'settings.gradle.kts', 'AndroidManifest.xml'],
        description: 'Android native app project'
    },
    {
        id: 'ios',
        displayName: 'iOS/macOS',
        icon: 'apple',
        themeColor: '#000000',
        markers: ['*.xcodeproj', '*.xcworkspace', 'Podfile', 'Package.swift'],
        description: 'iOS or macOS native app project'
    },
    {
        id: 'flutter',
        displayName: 'Flutter',
        icon: 'flutter',
        themeColor: '#02569B',
        markers: ['pubspec.yaml', 'android', 'ios', 'lib'],
        description: 'Flutter cross-platform mobile app'
    },
    {
        id: 'react-native',
        displayName: 'React Native',
        icon: 'react',
        themeColor: '#61DAFB',
        markers: ['metro.config.js', 'app.json', 'android', 'ios'],
        description: 'React Native cross-platform mobile app'
    },
    {
        id: 'kotlin-multiplatform',
        displayName: 'Kotlin Multiplatform',
        icon: 'kotlin',
        themeColor: '#7F52FF',
        markers: ['shared', 'iosApp', 'androidApp', 'composeApp'],
        description: 'Kotlin Multiplatform project'
    },
    {
        id: 'xamarin',
        displayName: 'Xamarin/MAUI',
        icon: 'dotnet',
        themeColor: '#3498DB',
        markers: ['*.csproj', 'Platforms'],
        description: 'Xamarin or .NET MAUI mobile app'
    },
    {
        id: 'ionic',
        displayName: 'Ionic',
        icon: 'ionic',
        themeColor: '#3880FF',
        markers: ['ionic.config.json', 'capacitor.config.json'],
        description: 'Ionic hybrid mobile app'
    },
    // =========================================================================
    // Desktop App Types
    // =========================================================================
    {
        id: 'electron',
        displayName: 'Electron',
        icon: 'electron',
        themeColor: '#47848F',
        markers: ['electron.vite.config.ts', 'electron-builder.yml', 'electron-builder.json'],
        description: 'Electron desktop application'
    },
    {
        id: 'tauri',
        displayName: 'Tauri',
        icon: 'tauri',
        themeColor: '#FFC131',
        markers: ['tauri.conf.json', 'src-tauri'],
        description: 'Tauri desktop application'
    },
    {
        id: 'qt',
        displayName: 'Qt',
        icon: 'qt',
        themeColor: '#41CD52',
        markers: ['*.pro', 'CMakeLists.txt', '*.qml'],
        description: 'Qt desktop application'
    },
    {
        id: 'wpf',
        displayName: 'WPF',
        icon: 'dotnet',
        themeColor: '#512BD4',
        markers: ['*.csproj', '*.xaml'],
        description: 'Windows Presentation Foundation app'
    },
    {
        id: 'winforms',
        displayName: 'Windows Forms',
        icon: 'windows',
        themeColor: '#0078D6',
        markers: ['*.csproj', '*.Designer.cs'],
        description: 'Windows Forms desktop application'
    },
    {
        id: 'swiftui',
        displayName: 'SwiftUI',
        icon: 'swift',
        themeColor: '#F05138',
        markers: ['Package.swift', '*.xcodeproj', 'ContentView.swift'],
        description: 'SwiftUI macOS/iOS application'
    }
]

// =============================================================================
// Framework Definitions
// =============================================================================

export interface FrameworkDefinition {
    id: string              // Unique identifier
    displayName: string     // Human-readable name
    icon: string            // Simple Icons slug
    themeColor: string      // Brand color
    parentType: string      // Parent project type (e.g., 'node')
    detectPatterns: {
        dependencies?: string[]      // package.json dependencies
        devDependencies?: string[]   // package.json devDependencies
        files?: string[]             // Files that indicate this framework
        configFiles?: string[]       // Config files specific to this framework
    }
}

export const FRAMEWORKS: FrameworkDefinition[] = [
    // =========================================================================
    // Node.js Frameworks
    // =========================================================================
    {
        id: 'react',
        displayName: 'React',
        icon: 'react',
        themeColor: '#61DAFB',
        parentType: 'node',
        detectPatterns: {
            dependencies: ['react', 'react-dom'],
            files: ['src/App.jsx', 'src/App.tsx']
        }
    },
    {
        id: 'nextjs',
        displayName: 'Next.js',
        icon: 'nextdotjs',
        themeColor: '#000000',
        parentType: 'node',
        detectPatterns: {
            dependencies: ['next'],
            configFiles: ['next.config.js', 'next.config.mjs', 'next.config.ts']
        }
    },
    {
        id: 'vue',
        displayName: 'Vue.js',
        icon: 'vuedotjs',
        themeColor: '#4FC08D',
        parentType: 'node',
        detectPatterns: {
            dependencies: ['vue'],
            configFiles: ['vue.config.js', 'vite.config.ts']
        }
    },
    {
        id: 'nuxt',
        displayName: 'Nuxt',
        icon: 'nuxtdotjs',
        themeColor: '#00DC82',
        parentType: 'node',
        detectPatterns: {
            dependencies: ['nuxt'],
            configFiles: ['nuxt.config.js', 'nuxt.config.ts']
        }
    },
    {
        id: 'angular',
        displayName: 'Angular',
        icon: 'angular',
        themeColor: '#DD0031',
        parentType: 'node',
        detectPatterns: {
            dependencies: ['@angular/core'],
            configFiles: ['angular.json']
        }
    },
    {
        id: 'svelte',
        displayName: 'Svelte',
        icon: 'svelte',
        themeColor: '#FF3E00',
        parentType: 'node',
        detectPatterns: {
            dependencies: ['svelte'],
            configFiles: ['svelte.config.js']
        }
    },
    {
        id: 'electron',
        displayName: 'Electron',
        icon: 'electron',
        themeColor: '#47848F',
        parentType: 'node',
        detectPatterns: {
            dependencies: ['electron'],
            devDependencies: ['electron', 'electron-builder', 'electron-vite']
        }
    },
    {
        id: 'express',
        displayName: 'Express',
        icon: 'express',
        themeColor: '#000000',
        parentType: 'node',
        detectPatterns: {
            dependencies: ['express']
        }
    },
    {
        id: 'nestjs',
        displayName: 'NestJS',
        icon: 'nestjs',
        themeColor: '#E0234E',
        parentType: 'node',
        detectPatterns: {
            dependencies: ['@nestjs/core'],
            configFiles: ['nest-cli.json']
        }
    },
    {
        id: 'vite',
        displayName: 'Vite',
        icon: 'vite',
        themeColor: '#646CFF',
        parentType: 'node',
        detectPatterns: {
            devDependencies: ['vite'],
            configFiles: ['vite.config.js', 'vite.config.ts']
        }
    },
    {
        id: 'tailwind',
        displayName: 'Tailwind CSS',
        icon: 'tailwindcss',
        themeColor: '#06B6D4',
        parentType: 'node',
        detectPatterns: {
            devDependencies: ['tailwindcss'],
            configFiles: ['tailwind.config.js', 'tailwind.config.ts']
        }
    },
    {
        id: 'typescript',
        displayName: 'TypeScript',
        icon: 'typescript',
        themeColor: '#3178C6',
        parentType: 'node',
        detectPatterns: {
            devDependencies: ['typescript'],
            configFiles: ['tsconfig.json']
        }
    },

    // =========================================================================
    // Python Frameworks
    // =========================================================================
    {
        id: 'django',
        displayName: 'Django',
        icon: 'django',
        themeColor: '#092E20',
        parentType: 'python',
        detectPatterns: {
            files: ['manage.py'],
            configFiles: ['settings.py']
        }
    },
    {
        id: 'flask',
        displayName: 'Flask',
        icon: 'flask',
        themeColor: '#000000',
        parentType: 'python',
        detectPatterns: {
            files: ['app.py', 'wsgi.py']
        }
    },
    {
        id: 'fastapi',
        displayName: 'FastAPI',
        icon: 'fastapi',
        themeColor: '#009688',
        parentType: 'python',
        detectPatterns: {
            files: ['main.py']
        }
    },
    {
        id: 'pytorch',
        displayName: 'PyTorch',
        icon: 'pytorch',
        themeColor: '#EE4C2C',
        parentType: 'python',
        detectPatterns: {}
    },
    {
        id: 'tensorflow',
        displayName: 'TensorFlow',
        icon: 'tensorflow',
        themeColor: '#FF6F00',
        parentType: 'python',
        detectPatterns: {}
    },

    // =========================================================================
    // Java Frameworks
    // =========================================================================
    {
        id: 'springboot',
        displayName: 'Spring Boot',
        icon: 'springboot',
        themeColor: '#6DB33F',
        parentType: 'java',
        detectPatterns: {
            files: ['src/main/java'],
            configFiles: ['application.properties', 'application.yml']
        }
    },

    // =========================================================================
    // .NET Frameworks  
    // =========================================================================
    {
        id: 'aspnet',
        displayName: 'ASP.NET',
        icon: 'dotnet',
        themeColor: '#512BD4',
        parentType: 'dotnet',
        detectPatterns: {
            files: ['Program.cs', 'Startup.cs'],
            configFiles: ['appsettings.json']
        }
    },
    {
        id: 'maui',
        displayName: '.NET MAUI',
        icon: 'dotnet',
        themeColor: '#512BD4',
        parentType: 'dotnet',
        detectPatterns: {
            files: ['MauiProgram.cs']
        }
    },

    // =========================================================================
    // Flutter
    // =========================================================================
    {
        id: 'flutter',
        displayName: 'Flutter',
        icon: 'flutter',
        themeColor: '#02569B',
        parentType: 'dart',
        detectPatterns: {
            files: ['lib/main.dart'],
            configFiles: ['pubspec.yaml']
        }
    },

    // =========================================================================
    // Ruby Frameworks
    // =========================================================================
    {
        id: 'rails',
        displayName: 'Ruby on Rails',
        icon: 'rubyonrails',
        themeColor: '#CC0000',
        parentType: 'ruby',
        detectPatterns: {
            files: ['config/routes.rb', 'app/controllers'],
            configFiles: ['config/application.rb']
        }
    },

    // =========================================================================
    // PHP Frameworks
    // =========================================================================
    {
        id: 'laravel',
        displayName: 'Laravel',
        icon: 'laravel',
        themeColor: '#FF2D20',
        parentType: 'php',
        detectPatterns: {
            files: ['artisan'],
            configFiles: ['config/app.php']
        }
    }
]

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Get project type definition by ID
 */
export function getProjectTypeById(id: string): ProjectTypeDefinition | undefined {
    return PROJECT_TYPES.find(t => t.id === id)
}

/**
 * Get framework definition by ID
 */
export function getFrameworkById(id: string): FrameworkDefinition | undefined {
    return FRAMEWORKS.find(f => f.id === id)
}

/**
 * Get all frameworks for a given project type
 */
export function getFrameworksForType(typeId: string): FrameworkDefinition[] {
    return FRAMEWORKS.filter(f => f.parentType === typeId)
}

/**
 * Detect project type from markers found in a directory
 */
export function detectProjectTypeFromMarkers(markers: string[]): ProjectTypeDefinition | undefined {
    // Priority order: specific types first, then git
    for (const type of PROJECT_TYPES) {
        if (type.id === 'git') continue // Check git last

        for (const marker of type.markers) {
            if (marker.startsWith('*')) {
                // Wildcard match
                const ext = marker.slice(1)
                if (markers.some(m => m.endsWith(ext))) {
                    return type
                }
            } else {
                if (markers.includes(marker)) {
                    return type
                }
            }
        }
    }

    // Fallback to git if present
    if (markers.includes('.git')) {
        return getProjectTypeById('git')
    }

    return undefined
}

/**
 * Detect frameworks from package.json content
 */
export function detectFrameworksFromPackageJson(
    packageJson: { dependencies?: Record<string, string>; devDependencies?: Record<string, string> },
    fileList: string[]
): FrameworkDefinition[] {
    const detected: FrameworkDefinition[] = []
    const deps = packageJson.dependencies || {}
    const devDeps = packageJson.devDependencies || {}

    for (const framework of FRAMEWORKS.filter(f => f.parentType === 'node')) {
        const patterns = framework.detectPatterns
        let matched = false

        // Check dependencies
        if (patterns.dependencies?.some(d => d in deps)) {
            matched = true
        }

        // Check devDependencies
        if (patterns.devDependencies?.some(d => d in devDeps)) {
            matched = true
        }

        // Check config files
        if (patterns.configFiles?.some(f => fileList.includes(f))) {
            matched = true
        }

        if (matched) {
            detected.push(framework)
        }
    }

    return detected
}
