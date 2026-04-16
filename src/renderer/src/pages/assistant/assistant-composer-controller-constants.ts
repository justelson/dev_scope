import type { AssistantComposerSessionState } from './assistant-composer-session-state'
import type { AssistantComposerPreferenceEffort } from './assistant-composer-preferences'
import type { AssistantRuntimeMode } from '@shared/assistant/contracts'
import { DRAFT_STORAGE_KEY } from './assistant-composer-utils'

export const EFFORT_OPTIONS: AssistantComposerPreferenceEffort[] = ['low', 'medium', 'high', 'xhigh']
export const COMPOSER_SESSION_PERSIST_DEBOUNCE_MS = 180

export const EFFORT_LABELS: Record<(typeof EFFORT_OPTIONS)[number], string> = {
    low: 'Low',
    medium: 'Medium',
    high: 'High',
    xhigh: 'Extra High'
}

export function getProfileLabel(runtimeMode: AssistantRuntimeMode) {
    return runtimeMode === 'full-access' ? 'Full access' : 'Safe'
}

export function readLegacyComposerSessionState(): AssistantComposerSessionState {
    try {
        localStorage.removeItem(DRAFT_STORAGE_KEY)
    } catch {}
    return {}
}

export function syncScrollAffordance(
    element: HTMLDivElement | null,
    setCanScrollUp: (value: boolean) => void,
    setCanScrollDown: (value: boolean) => void
) {
    if (!element) {
        setCanScrollUp(false)
        setCanScrollDown(false)
        return
    }
    const maxScrollTop = Math.max(0, element.scrollHeight - element.clientHeight)
    setCanScrollUp(element.scrollTop > 2)
    setCanScrollDown(maxScrollTop - element.scrollTop > 2)
}

export function ensureListItemVisible(
    listElement: HTMLDivElement | null,
    itemElement: HTMLElement | null,
    options?: { topInset?: number; bottomInset?: number }
) {
    if (!listElement || !itemElement) return
    const topInset = options?.topInset ?? 26
    const bottomInset = options?.bottomInset ?? 26
    const itemTop = itemElement.offsetTop
    const itemBottom = itemTop + itemElement.offsetHeight
    const visibleTop = listElement.scrollTop + topInset
    const visibleBottom = listElement.scrollTop + listElement.clientHeight - bottomInset
    if (itemTop < visibleTop) {
        requestAnimationFrame(() => { listElement.scrollTop = Math.max(0, itemTop - topInset) })
        return
    }
    if (itemBottom > visibleBottom) {
        requestAnimationFrame(() => {
            listElement.scrollTop = Math.min(listElement.scrollHeight - listElement.clientHeight, itemBottom - listElement.clientHeight + bottomInset)
        })
    }
}
