import type { ToolDefinition, ToolCategory } from './types'
import { LANGUAGE_TOOLS } from './entries/language'
import { PACKAGE_MANAGER_TOOLS } from './entries/package-manager'
import { BUILD_TOOL_TOOLS } from './entries/build-tool'
import { CONTAINER_TOOLS } from './entries/container'
import { VERSION_CONTROL_TOOLS } from './entries/version-control'
import { AI_RUNTIME_TOOLS } from './entries/ai-runtime'
import { AI_FRAMEWORK_TOOLS } from './entries/ai-framework'
import { AI_AGENT_TOOLS_A } from './entries/ai-agent-a'
import { AI_AGENT_TOOLS_B } from './entries/ai-agent-b'

export const TOOL_REGISTRY: ToolDefinition[] = [
    ...LANGUAGE_TOOLS,
    ...PACKAGE_MANAGER_TOOLS,
    ...BUILD_TOOL_TOOLS,
    ...CONTAINER_TOOLS,
    ...VERSION_CONTROL_TOOLS,
    ...AI_RUNTIME_TOOLS,
    ...AI_FRAMEWORK_TOOLS,
    ...AI_AGENT_TOOLS_A,
    ...AI_AGENT_TOOLS_B
]

export function getToolsByCategory(category: ToolCategory): ToolDefinition[] {
    return TOOL_REGISTRY.filter((tool) => tool.category === category)
}

export function getToolById(id: string): ToolDefinition | undefined {
    if (!id) return undefined
    const lid = id.toLowerCase()
    return TOOL_REGISTRY.find((tool) =>
        tool.id.toLowerCase() === lid
        || tool.command.toLowerCase() === lid
        || tool.alternateCommands?.some((alt) => alt.toLowerCase() === lid)
    )
}
