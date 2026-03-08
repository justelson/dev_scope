/**
 * DevScope - Type Definitions
 * Normalized capability schema for system inspection
 */

// ============================================================================
// System Health Types
// ============================================================================

export interface CpuInfo {
    model: string
    cores: number
    threads: number
    speed?: number
    usage?: number
}

export interface GpuInfo {
    model: string
    vram?: string
    driver?: string
    vendor?: string
}

export interface MemoryInfo {
    total: number
    available: number
    used: number
    type?: string
}

export interface DiskInfo {
    name: string
    size: number
    available: number
    type?: string
    path?: string
}

export interface OsInfo {
    name: string
    version: string
    build?: string
    arch: string
    hostname: string
    username: string
}

export interface SystemHealth {
    os: OsInfo
    cpu: CpuInfo
    memory: MemoryInfo
    disks: DiskInfo[]
    gpus: GpuInfo[]
    timestamp: number
}

// ============================================================================
// Developer Tooling Types
// ============================================================================

export type ToolStatus = 'healthy' | 'warning' | 'error' | 'not_installed' | 'unknown'

export type ToolCategory =
    | 'language'
    | 'package_manager'
    | 'build_tool'
    | 'container'
    | 'version_control'
    | 'ai_runtime'
    | 'ai_agent'
    | 'browser'
    | 'database'
    | 'gpu_acceleration'
    | 'ai_framework'
    | 'unknown'

export interface DetectedTool {
    id: string              // Unique ID (from shared registry)
    displayName: string
    category: ToolCategory
    installed: boolean
    version?: string
    status: ToolStatus
    path?: string
    usedFor: string[]
    description?: string
    website?: string
    docsUrl?: string
    lastChecked: number
    metadata?: Record<string, any>
}

export interface ToolingReport {
    languages: DetectedTool[]
    packageManagers: DetectedTool[]
    buildTools: DetectedTool[]
    containers: DetectedTool[]
    versionControl: DetectedTool[]
    timestamp: number
}

// ============================================================================
// AI Runtime Types
// ============================================================================

export interface AIRuntimeInfo extends DetectedTool {
    running?: boolean
    port?: number
    models?: string[]
    endpoint?: string
}

export interface AIRuntimeReport {
    llmRuntimes: AIRuntimeInfo[]
    gpuAcceleration: DetectedTool[]
    aiFrameworks: DetectedTool[]
    timestamp: number
}

// ============================================================================
// Readiness Types
// ============================================================================

export type ReadinessLevel = 'ready' | 'partial' | 'not_ready'

export type WarningSeverity = 'low' | 'medium' | 'high' | 'critical'

export interface Warning {
    id: string
    tool: string
    message: string
    severity: WarningSeverity
    suggestion?: string
}

export interface Recommendation {
    id: string
    title: string
    description: string
    priority: number
    category: ToolCategory
    installCommand?: string
    learnMoreUrl?: string
}

export interface ReadinessReport {
    level: ReadinessLevel
    score: number // 0-100
    totalTools: number
    installedTools: number
    healthyTools: number
    warnings: Warning[]
    recommendations: Recommendation[]
    timestamp: number
}

// ============================================================================
// Full Report Types
// ============================================================================

export interface FullReport {
    system: SystemHealth
    tooling: ToolingReport
    aiRuntime: AIRuntimeReport
    readiness: ReadinessReport
    timestamp: number
}

// ============================================================================
// IPC API Types
// ============================================================================

export interface DevScopeAPI {
    getSystemOverview: () => Promise<SystemHealth>
    getDeveloperTooling: () => Promise<ToolingReport>
    getAIRuntimeStatus: () => Promise<AIRuntimeReport>
    getReadinessReport: () => Promise<ReadinessReport>
    refreshAll: () => Promise<FullReport>
}
