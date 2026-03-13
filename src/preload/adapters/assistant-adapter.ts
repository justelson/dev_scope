import { ipcRenderer } from 'electron'
import type {
    AssistantApprovalResponseInput,
    AssistantClearLogsInput,
    AssistantConnectOptions,
    AssistantDeleteMessageInput,
    AssistantEventStreamPayload,
    AssistantSendPromptOptions,
    AssistantUserInputResponseInput
} from '../../shared/assistant/contracts'
import { ASSISTANT_IPC, assertAssistantIpcContract } from '../../shared/assistant/contracts'

export function createAssistantAdapter() {
    assertAssistantIpcContract()

    return {
        getAIRuntimeStatus: async () => {
            const status = await ipcRenderer.invoke(ASSISTANT_IPC.getStatus)
            return { success: true as const, status }
        },
        assistant: {
            subscribe: () => ipcRenderer.invoke(ASSISTANT_IPC.subscribe),
            unsubscribe: () => ipcRenderer.invoke(ASSISTANT_IPC.unsubscribe),
            getSnapshot: () => ipcRenderer.invoke(ASSISTANT_IPC.getSnapshot),
            getStatus: () => ipcRenderer.invoke(ASSISTANT_IPC.getStatus),
            listModels: (forceRefresh = false) => ipcRenderer.invoke(ASSISTANT_IPC.listModels, forceRefresh),
            connect: (options?: AssistantConnectOptions) => ipcRenderer.invoke(ASSISTANT_IPC.connect, options),
            disconnect: (sessionId?: string) => ipcRenderer.invoke(ASSISTANT_IPC.disconnect, sessionId),
            createSession: (title?: string) => ipcRenderer.invoke(ASSISTANT_IPC.createSession, title),
            selectSession: (sessionId: string) => ipcRenderer.invoke(ASSISTANT_IPC.selectSession, sessionId),
            renameSession: (sessionId: string, title: string) => ipcRenderer.invoke(ASSISTANT_IPC.renameSession, sessionId, title),
            archiveSession: (sessionId: string, archived = true) => ipcRenderer.invoke(ASSISTANT_IPC.archiveSession, sessionId, archived),
            deleteSession: (sessionId: string) => ipcRenderer.invoke(ASSISTANT_IPC.deleteSession, sessionId),
            deleteMessage: (input: AssistantDeleteMessageInput) => ipcRenderer.invoke(ASSISTANT_IPC.deleteMessage, input),
            clearLogs: (input?: AssistantClearLogsInput) => ipcRenderer.invoke(ASSISTANT_IPC.clearLogs, input),
            setSessionProjectPath: (sessionId: string, projectPath: string | null) =>
                ipcRenderer.invoke(ASSISTANT_IPC.setSessionProjectPath, sessionId, projectPath),
            newThread: (sessionId?: string) => ipcRenderer.invoke(ASSISTANT_IPC.newThread, sessionId),
            sendPrompt: (prompt: string, options?: AssistantSendPromptOptions) => ipcRenderer.invoke(ASSISTANT_IPC.sendPrompt, prompt, options),
            interruptTurn: (turnId?: string, sessionId?: string) => ipcRenderer.invoke(ASSISTANT_IPC.interruptTurn, turnId, sessionId),
            respondApproval: (input: AssistantApprovalResponseInput) =>
                ipcRenderer.invoke(ASSISTANT_IPC.respondApproval, input),
            respondUserInput: (input: AssistantUserInputResponseInput) =>
                ipcRenderer.invoke(ASSISTANT_IPC.respondUserInput, input),
            onEvent: (callback: (payload: AssistantEventStreamPayload) => void) => {
                const listener = (_event: Electron.IpcRendererEvent, payload: AssistantEventStreamPayload) => {
                    callback(payload)
                }
                ipcRenderer.on(ASSISTANT_IPC.eventStream, listener)
                void ipcRenderer.invoke(ASSISTANT_IPC.subscribe).catch(() => undefined)
                return () => {
                    ipcRenderer.removeListener(ASSISTANT_IPC.eventStream, listener)
                    void ipcRenderer.invoke(ASSISTANT_IPC.unsubscribe).catch(() => undefined)
                }
            }
        }
    }
}
