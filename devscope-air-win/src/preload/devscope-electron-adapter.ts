/**
 * DevScope Air - Electron Adapter
 */

import type { DevScopeApi } from '../shared/contracts/devscope-api'
import { createAssistantAdapter } from './adapters/assistant-adapter'
import { createDisabledAdapters } from './adapters/disabled-adapters'
import { createProjectsAdapter } from './adapters/projects-adapter'
import { createRemoteAccessAdapter } from './adapters/remote-access-adapter'
import { createSettingsAndAiAdapter } from './adapters/settings-ai-adapter'
import { createSystemAdapter } from './adapters/system-adapter'
import { createWindowAdapter } from './adapters/window-adapter'

export function createDevScopeElectronAdapter(): DevScopeApi {
    const api: DevScopeApi = {
        ...createSystemAdapter(),
        ...createSettingsAndAiAdapter(),
        ...createProjectsAdapter(),
        ...createRemoteAccessAdapter(),
        ...createDisabledAdapters(),
        ...createAssistantAdapter(),
        ...createWindowAdapter()
    } as DevScopeApi

    return api
}
