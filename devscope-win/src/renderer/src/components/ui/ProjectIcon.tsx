/**
 * DevScope - Project Icon Component
 * Renders project type and framework icons using Simple Icons CDN
 */

import { ComponentProps, useState } from 'react'
import {
    Folder, FolderOpen, FileCode, Box, Code,
    Server, Cpu, Smartphone, Globe, Terminal
} from 'lucide-react'

// Inline data to avoid ESM import issues
const PROJECT_TYPES_DATA: Record<string, { displayName: string; icon: string; themeColor: string }> = {
    // Web/Backend
    'node': { displayName: 'Node.js', icon: 'nodedotjs', themeColor: '#339933' },
    'python': { displayName: 'Python', icon: 'python', themeColor: '#3776AB' },
    'rust': { displayName: 'Rust', icon: 'rust', themeColor: '#DEA584' },
    'go': { displayName: 'Go', icon: 'go', themeColor: '#00ADD8' },
    'java': { displayName: 'Java', icon: 'openjdk', themeColor: '#007396' },
    'dotnet': { displayName: '.NET', icon: 'dotnet', themeColor: '#512BD4' },
    'ruby': { displayName: 'Ruby', icon: 'ruby', themeColor: '#CC342D' },
    'php': { displayName: 'PHP', icon: 'php', themeColor: '#777BB4' },
    'dart': { displayName: 'Dart/Flutter', icon: 'dart', themeColor: '#0175C2' },
    'elixir': { displayName: 'Elixir', icon: 'elixir', themeColor: '#4B275F' },
    'cpp': { displayName: 'C/C++', icon: 'cplusplus', themeColor: '#00599C' },
    'git': { displayName: 'Git Repository', icon: 'github', themeColor: '#FFFFFF' },
    // Mobile Apps
    'android': { displayName: 'Android', icon: 'android', themeColor: '#3DDC84' },
    'ios': { displayName: 'iOS/macOS', icon: 'apple', themeColor: '#000000' },
    'flutter': { displayName: 'Flutter', icon: 'flutter', themeColor: '#02569B' },
    'react-native': { displayName: 'React Native', icon: 'react', themeColor: '#61DAFB' },
    'kotlin-multiplatform': { displayName: 'Kotlin Multiplatform', icon: 'kotlin', themeColor: '#7F52FF' },
    'xamarin': { displayName: 'Xamarin/MAUI', icon: 'dotnet', themeColor: '#3498DB' },
    'ionic': { displayName: 'Ionic', icon: 'ionic', themeColor: '#3880FF' },
    // Desktop Apps
    'electron': { displayName: 'Electron', icon: 'electron', themeColor: '#47848F' },
    'tauri': { displayName: 'Tauri', icon: 'tauri', themeColor: '#FFC131' },
    'qt': { displayName: 'Qt', icon: 'qt', themeColor: '#41CD52' },
    'wpf': { displayName: 'WPF', icon: 'dotnet', themeColor: '#512BD4' },
    'winforms': { displayName: 'Windows Forms', icon: 'windows', themeColor: '#0078D6' },
    'swiftui': { displayName: 'SwiftUI', icon: 'swift', themeColor: '#F05138' }
}

const FRAMEWORKS_DATA: Record<string, { displayName: string; icon: string; themeColor: string }> = {
    'react': { displayName: 'React', icon: 'react', themeColor: '#61DAFB' },
    'nextjs': { displayName: 'Next.js', icon: 'nextdotjs', themeColor: '#000000' },
    'vue': { displayName: 'Vue.js', icon: 'vuedotjs', themeColor: '#4FC08D' },
    'nuxt': { displayName: 'Nuxt', icon: 'nuxtdotjs', themeColor: '#00DC82' },
    'angular': { displayName: 'Angular', icon: 'angular', themeColor: '#DD0031' },
    'svelte': { displayName: 'Svelte', icon: 'svelte', themeColor: '#FF3E00' },
    'electron': { displayName: 'Electron', icon: 'electron', themeColor: '#47848F' },
    'express': { displayName: 'Express', icon: 'express', themeColor: '#000000' },
    'nestjs': { displayName: 'NestJS', icon: 'nestjs', themeColor: '#E0234E' },
    'vite': { displayName: 'Vite', icon: 'vite', themeColor: '#646CFF' },
    'tailwind': { displayName: 'Tailwind CSS', icon: 'tailwindcss', themeColor: '#06B6D4' },
    'typescript': { displayName: 'TypeScript', icon: 'typescript', themeColor: '#3178C6' },
    'django': { displayName: 'Django', icon: 'django', themeColor: '#092E20' },
    'flask': { displayName: 'Flask', icon: 'flask', themeColor: '#000000' },
    'fastapi': { displayName: 'FastAPI', icon: 'fastapi', themeColor: '#009688' },
    'springboot': { displayName: 'Spring Boot', icon: 'springboot', themeColor: '#6DB33F' },
    'flutter': { displayName: 'Flutter', icon: 'flutter', themeColor: '#02569B' },
    'rails': { displayName: 'Ruby on Rails', icon: 'rubyonrails', themeColor: '#CC0000' },
    'laravel': { displayName: 'Laravel', icon: 'laravel', themeColor: '#FF2D20' }
}

function getProjectTypeById(id: string) {
    return PROJECT_TYPES_DATA[id]
}

function getFrameworkById(id: string) {
    return FRAMEWORKS_DATA[id]
}

interface ProjectIconProps extends ComponentProps<'div'> {
    projectType?: string     // Project type ID (e.g., 'node', 'python')
    framework?: string       // Framework ID (e.g., 'react', 'nextjs')
    size?: number
    className?: string
    showFallback?: boolean   // Show fallback icon if type/framework not found
}

// Fallback Lucide icons by project type
const TYPE_FALLBACK_ICONS: Record<string, any> = {
    'node': Globe,
    'python': Terminal,
    'rust': Cpu,
    'go': Server,
    'java': Box,
    'dotnet': Box,
    'ruby': FileCode,
    'php': Globe,
    'dart': Smartphone,
    'cpp': Terminal,
    'git': FolderOpen,
    'folder': Folder,
    'unknown': FileCode,
    'default': Code
}

export default function ProjectIcon({
    projectType,
    framework,
    size = 24,
    className,
    showFallback = true,
    ...props
}: ProjectIconProps) {
    const [imgError, setImgError] = useState(false)

    // Priority: framework icon > project type icon
    const frameworkData = framework ? getFrameworkById(framework) : undefined
    const typeData = projectType ? getProjectTypeById(projectType) : undefined

    const iconSlug = frameworkData?.icon || typeData?.icon
    const themeColor = frameworkData?.themeColor || typeData?.themeColor
    const displayName = frameworkData?.displayName || typeData?.displayName || projectType || 'Project'

    // Use Simple Icons CDN if we have an icon slug
    if (iconSlug && !imgError) {
        const iconUrl = `https://cdn.simpleicons.org/${iconSlug}/white`

        return (
            <div
                className={`relative flex items-center justify-center ${className}`}
                style={{ width: size, height: size }}
                title={displayName}
                {...props}
            >
                <img
                    src={iconUrl}
                    alt={`${displayName} logo`}
                    width={size}
                    height={size}
                    className="w-full h-full object-contain"
                    style={{ filter: themeColor ? `drop-shadow(0 0 1px ${themeColor})` : undefined }}
                    onError={() => setImgError(true)}
                    loading="lazy"
                />
            </div>
        )
    }

    // Fallback to Lucide icon
    if (!showFallback) return null

    const FallbackIcon = TYPE_FALLBACK_ICONS[projectType || 'default'] || TYPE_FALLBACK_ICONS['default']
    const fallbackColor = themeColor || '#a1a1aa'

    return (
        <div
            className={`flex items-center justify-center ${className}`}
            style={{ width: size, height: size }}
            title={displayName}
            {...props}
        >
            <FallbackIcon size={size * 0.75} style={{ color: fallbackColor }} />
        </div>
    )
}

// Convenience component for framework badges
interface FrameworkBadgeProps {
    framework: string
    size?: 'sm' | 'md' | 'lg'
    showLabel?: boolean
    className?: string
}

export function FrameworkBadge({ framework, size = 'sm', showLabel = true, className }: FrameworkBadgeProps) {
    const frameworkData = getFrameworkById(framework)
    if (!frameworkData) return null

    const iconSize = size === 'sm' ? 12 : size === 'md' ? 16 : 20
    const textSize = size === 'sm' ? 'text-[10px]' : size === 'md' ? 'text-xs' : 'text-sm'

    return (
        <span
            className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded ${className}`}
            style={{
                backgroundColor: `${frameworkData.themeColor}15`,
                color: frameworkData.themeColor,
                border: `1px solid ${frameworkData.themeColor}30`
            }}
        >
            <ProjectIcon framework={framework} size={iconSize} showFallback={false} />
            {showLabel && (
                <span className={`font-medium ${textSize}`}>{frameworkData.displayName}</span>
            )}
        </span>
    )
}
