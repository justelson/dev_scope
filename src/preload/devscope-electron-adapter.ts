/**
 * DevScope Air - Electron Adapter
 */

import type { DevScopeApi } from '../shared/contracts/devscope-api'
import { createDisabledAdapters } from './adapters/disabled-adapters'
import { createProjectsAdapter } from './adapters/projects-adapter'
import { createSettingsAndAiAdapter } from './adapters/settings-ai-adapter'
import { createSystemAdapter } from './adapters/system-adapter'
import { createUpdatesAdapter } from './adapters/updates-adapter'
import { createWindowAdapter } from './adapters/window-adapter'

export function createDevScopeElectronAdapter(): DevScopeApi {
    const api: DevScopeApi = {
        ...createSystemAdapter(),
        ...createSettingsAndAiAdapter(),
        ...createProjectsAdapter(),
        ...createDisabledAdapters(),
        ...createUpdatesAdapter(),
        ...createWindowAdapter()
    } as DevScopeApi

    return api
}
