import type { AssistantBusyMessageMode } from '@/lib/settings'
import { getContextFileMeta } from './assistant-composer-utils'
import { EFFORT_LABELS, EFFORT_OPTIONS } from './assistant-composer-controller-constants'

export function buildAssistantComposerControllerResult<T extends Record<string, unknown>>(input: T & {
    settingsAssistantBusyMessageMode: AssistantBusyMessageMode
}) {
    const { settingsAssistantBusyMessageMode, ...rest } = input
    return {
        ...rest,
        busyMessageMode: settingsAssistantBusyMessageMode,
        EFFORT_OPTIONS,
        EFFORT_LABELS,
        getContextFileMeta
    }
}
