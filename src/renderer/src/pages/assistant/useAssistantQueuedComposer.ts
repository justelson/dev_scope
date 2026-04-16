import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { AssistantBusyMessageMode } from '@/lib/settings'
import type {
    AssistantComposerSendOptions,
    AssistantQueuedComposerMessage,
    ComposerContextFile
} from './assistant-composer-types'

type PendingComposerDispatch = {
    id: string
    prompt: string
    contextFiles: ComposerContextFile[]
    options: AssistantComposerSendOptions
}

export function useAssistantQueuedComposer(args: {
    selectedSessionId: string | null
    isAssistantBusy: boolean
    commandPending: boolean
    isThreadWorking: boolean
    activeTurnId: string | null
    busyMessageMode: AssistantBusyMessageMode
    dispatchPrompt: (
        prompt: string,
        contextFiles: ComposerContextFile[],
        options: AssistantComposerSendOptions
    ) => Promise<boolean>
    interruptTurn: (turnId?: string, sessionId?: string) => Promise<void>
}) {
    const {
        selectedSessionId,
        isAssistantBusy,
        commandPending,
        isThreadWorking,
        activeTurnId,
        busyMessageMode,
        dispatchPrompt,
        interruptTurn
    } = args

    const [queuedComposerMessagesBySessionId, setQueuedComposerMessagesBySessionId] = useState<Record<string, PendingComposerDispatch[]>>({})
    const [pausedQueueMessageIdBySessionId, setPausedQueueMessageIdBySessionId] = useState<Record<string, string | null>>({})
    const [sendingComposerPrompt, setSendingComposerPrompt] = useState(false)
    const queueDrainSessionIdRef = useRef<string | null>(null)

    const queuedComposerMessages = selectedSessionId ? (queuedComposerMessagesBySessionId[selectedSessionId] || []) : []
    const queuedComposerMessageCount = queuedComposerMessages.length
    const queuedComposerMessageItems = useMemo<AssistantQueuedComposerMessage[]>(() => (
        queuedComposerMessages.map((entry) => ({
            id: entry.id,
            prompt: entry.prompt,
            dispatchMode: entry.options.dispatchMode === 'force' ? 'force' : 'queue'
        }))
    ), [queuedComposerMessages])

    const handleDispatchPrompt = useCallback(async (
        prompt: string,
        contextFiles: ComposerContextFile[],
        options: AssistantComposerSendOptions
    ) => {
        setSendingComposerPrompt(true)
        try {
            return await dispatchPrompt(prompt, contextFiles, options)
        } finally {
            setSendingComposerPrompt(false)
        }
    }, [dispatchPrompt])

    const enqueueBusyPrompt = useCallback(async (
        mode: 'queue' | 'force',
        prompt: string,
        contextFiles: ComposerContextFile[],
        options: AssistantComposerSendOptions
    ) => {
        if (!selectedSessionId) return false

        const nextDispatch: PendingComposerDispatch = {
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            prompt,
            contextFiles,
            options: {
                ...options,
                dispatchMode: mode
            }
        }

        setQueuedComposerMessagesBySessionId((current) => {
            const existing = current[selectedSessionId] || []
            return {
                ...current,
                [selectedSessionId]: mode === 'force' ? [nextDispatch, ...existing] : [...existing, nextDispatch]
            }
        })
        setPausedQueueMessageIdBySessionId((current) => ({
            ...current,
            [selectedSessionId]: null
        }))

        if (mode === 'force' && (commandPending || isThreadWorking)) {
            try {
                await interruptTurn(activeTurnId || undefined, selectedSessionId)
            } catch {}
        }
        return true
    }, [activeTurnId, commandPending, interruptTurn, isThreadWorking, selectedSessionId])

    const handleSendPrompt = useCallback(async (
        prompt: string,
        contextFiles: ComposerContextFile[],
        options: AssistantComposerSendOptions
    ) => {
        if (isAssistantBusy) {
            const dispatchMode = options.dispatchMode === 'force' || options.dispatchMode === 'queue'
                ? options.dispatchMode
                : busyMessageMode
            return enqueueBusyPrompt(dispatchMode, prompt, contextFiles, options)
        }
        return handleDispatchPrompt(prompt, contextFiles, options)
    }, [busyMessageMode, enqueueBusyPrompt, handleDispatchPrompt, isAssistantBusy])

    useEffect(() => {
        if (!selectedSessionId) return
        if (isAssistantBusy) return
        if (queueDrainSessionIdRef.current === selectedSessionId) return

        const nextQueuedMessage = queuedComposerMessagesBySessionId[selectedSessionId]?.[0]
        if (!nextQueuedMessage) return
        if (pausedQueueMessageIdBySessionId[selectedSessionId] === nextQueuedMessage.id) return

        let cancelled = false
        queueDrainSessionIdRef.current = selectedSessionId

        void (async () => {
            const success = await handleDispatchPrompt(nextQueuedMessage.prompt, nextQueuedMessage.contextFiles, {
                ...nextQueuedMessage.options,
                dispatchMode: 'immediate'
            })
            if (cancelled) return

            if (success) {
                setQueuedComposerMessagesBySessionId((current) => {
                    const existing = current[selectedSessionId] || []
                    if (!existing.length || existing[0]?.id !== nextQueuedMessage.id) return current
                    return {
                        ...current,
                        [selectedSessionId]: existing.slice(1)
                    }
                })
                setPausedQueueMessageIdBySessionId((current) => ({
                    ...current,
                    [selectedSessionId]: null
                }))
            } else {
                setPausedQueueMessageIdBySessionId((current) => ({
                    ...current,
                    [selectedSessionId]: nextQueuedMessage.id
                }))
            }

            queueDrainSessionIdRef.current = null
        })()

        return () => {
            cancelled = true
            if (queueDrainSessionIdRef.current === selectedSessionId) {
                queueDrainSessionIdRef.current = null
            }
        }
    }, [
        handleDispatchPrompt,
        isAssistantBusy,
        pausedQueueMessageIdBySessionId,
        queuedComposerMessagesBySessionId,
        selectedSessionId
    ])

    return {
        sendingComposerPrompt,
        queuedComposerMessageCount,
        queuedComposerMessageItems,
        handleSendPrompt
    }
}
