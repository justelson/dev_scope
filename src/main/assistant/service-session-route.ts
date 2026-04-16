import type { AssistantPlaygroundState, AssistantSession } from '../../shared/assistant/contracts'
import { resolveAssistantProjectTarget } from '../../shared/assistant/session-routing'
import { ensurePlaygroundLabExists } from './playground-service'
import { sanitizeOptionalPath } from './utils'

export function resolveAssistantSessionRoute(args: {
    projectPath?: string | null
    mode?: AssistantSession['mode']
    playgroundLabId?: string | null
    playground: AssistantPlaygroundState
}): {
    mode: AssistantSession['mode']
    projectPath: string | null
    playgroundLabId: string | null
} {
    const explicitPlaygroundLab = args.playgroundLabId
        ? ensurePlaygroundLabExists(args.playground.labs, args.playgroundLabId)
        : null
    const inferredTarget = resolveAssistantProjectTarget(args.projectPath, args.playground)
    const inferredPlaygroundLab = inferredTarget.playgroundLabId
        ? ensurePlaygroundLabExists(args.playground.labs, inferredTarget.playgroundLabId)
        : null
    const shouldUsePlayground = Boolean(explicitPlaygroundLab)
        || args.mode === 'playground'
        || inferredTarget.mode === 'playground'

    if (!shouldUsePlayground) {
        return {
            mode: 'work',
            projectPath: inferredTarget.projectPath || sanitizeOptionalPath(args.projectPath),
            playgroundLabId: null
        }
    }

    const playgroundLab = explicitPlaygroundLab || inferredPlaygroundLab
    return {
        mode: 'playground',
        projectPath: inferredTarget.projectPath || playgroundLab?.rootPath || null,
        playgroundLabId: playgroundLab?.id || null
    }
}
