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
    startupCommand?: string // Preferred command to launch the tool
    versionCheckCommand?: string // Preferred command to check version
    updateCommand?: string // Preferred command to update
    logoUrl?: string // Optional direct logo URL
    detection?: DetectionConfig
}

